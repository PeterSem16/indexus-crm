import { Client } from "ssh2";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { ariSettings, ivrMessages } from "@shared/schema";

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

let cachedAriSettings: any = null;
let ariSettingsCacheTime = 0;
const ARI_SETTINGS_CACHE_TTL = 30000;

async function getAriSettings() {
  const now = Date.now();
  if (cachedAriSettings && (now - ariSettingsCacheTime) < ARI_SETTINGS_CACHE_TTL) {
    return cachedAriSettings;
  }
  const [settings] = await db.select().from(ariSettings).limit(1);
  cachedAriSettings = settings;
  ariSettingsCacheTime = now;
  return settings;
}

let pooledConn: Client | null = null;
let pooledSftp: any = null;
let pooledSettings: { host: string; sshPort: number; sshUsername: string; sshPassword: string } | null = null;
let poolIdleTimer: ReturnType<typeof setTimeout> | null = null;
const POOL_IDLE_TIMEOUT = 60000;

function resetPoolTimer() {
  if (poolIdleTimer) clearTimeout(poolIdleTimer);
  poolIdleTimer = setTimeout(() => {
    if (pooledConn) {
      console.log(`[AudioSync] Closing idle pooled SSH connection`);
      try { pooledConn.end(); } catch {}
      pooledConn = null;
      pooledSftp = null;
      pooledSettings = null;
    }
  }, POOL_IDLE_TIMEOUT);
}

async function getPooledSftp(settings: { host: string; sshPort: number; sshUsername: string; sshPassword: string }): Promise<{ conn: Client; sftp: any }> {
  if (pooledConn && pooledSftp && pooledSettings &&
      pooledSettings.host === settings.host && pooledSettings.sshPort === settings.sshPort) {
    resetPoolTimer();
    return { conn: pooledConn, sftp: pooledSftp };
  }

  if (pooledConn) {
    try { pooledConn.end(); } catch {}
    pooledConn = null;
    pooledSftp = null;
  }

  const t0 = Date.now();
  const conn = await connectSSH(settings);
  const sftp = await getSFTP(conn);
  console.log(`[AudioSync] Pooled SSH connection established in ${Date.now() - t0}ms`);

  conn.on("end", () => { pooledConn = null; pooledSftp = null; pooledSettings = null; });
  conn.on("close", () => { pooledConn = null; pooledSftp = null; pooledSettings = null; });
  conn.on("error", () => { pooledConn = null; pooledSftp = null; pooledSettings = null; });

  pooledConn = conn;
  pooledSftp = sftp;
  pooledSettings = settings;
  resetPoolTimer();
  return { conn, sftp };
}

function connectSSH(settings: { host: string; sshPort: number; sshUsername: string; sshPassword: string }): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on("ready", () => resolve(conn));
    conn.on("error", (err: Error) => {
      console.error(`[AudioSync] SSH error event: ${err.message}, level=${(err as any).level}`);
      reject(err);
    });
    conn.on("keyboard-interactive", (_name, _instructions, _lang, _prompts, finish) => {
      finish([settings.sshPassword]);
    });
    conn.connect({
      host: settings.host,
      port: settings.sshPort,
      username: settings.sshUsername,
      password: settings.sshPassword,
      readyTimeout: 10000,
      tryKeyboard: true,
    });
  });
}

function getSFTP(conn: Client): Promise<any> {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      resolve(sftp);
    });
  });
}

function sftpMkdir(sftp: any, dirPath: string): Promise<void> {
  return new Promise((resolve) => {
    sftp.mkdir(dirPath, (err: Error | null) => {
      resolve();
    });
  });
}

function sftpUpload(sftp: any, localPath: string, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, (err: Error | null) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function sftpUploadBuffer(sftp: any, buffer: Buffer, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const writeStream = sftp.createWriteStream(remotePath);
    writeStream.on("close", () => resolve());
    writeStream.on("error", (err: Error) => reject(err));
    writeStream.end(buffer);
  });
}

function sftpDownload(sftp: any, remotePath: string, localPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(localPath);
    const readStream = sftp.createReadStream(remotePath);
    readStream.on("error", (err: Error) => reject(err));
    writeStream.on("close", () => resolve());
    writeStream.on("error", (err: Error) => reject(err));
    readStream.pipe(writeStream);
  });
}

export async function downloadVoicemailRecordingFromAsterisk(recordingName: string, localDir: string): Promise<{ success: boolean; localPath?: string; error?: string }> {
  try {
    const settings = await getAriSettings();
    if (!settings?.host || !settings?.sshUsername || !settings?.sshPassword) {
      return { success: false, error: "SSH settings not configured" };
    }

    const conn = await connectSSH({
      host: settings.host,
      sshPort: settings.sshPort || 22,
      sshUsername: settings.sshUsername,
      sshPassword: settings.sshPassword,
    });

    const sftp = await getSFTP(conn);

    const recordingBasePath = "/var/spool/asterisk/recording";
    const remoteFilePath = `${recordingBasePath}/${recordingName}.wav`;

    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const localFilePath = path.join(localDir, `${recordingName}.wav`);

    try {
      await sftpDownload(sftp, remoteFilePath, localFilePath);
      console.log(`[AudioSync] Voicemail recording downloaded: ${remoteFilePath} → ${localFilePath}`);

      try {
        sftp.unlink(remoteFilePath, () => {});
      } catch {}

      conn.end();
      return { success: true, localPath: localFilePath };
    } catch (dlErr) {
      conn.end();
      if (fs.existsSync(localFilePath)) {
        try { fs.unlinkSync(localFilePath); } catch {}
      }
      return { success: false, error: `SFTP download failed: ${dlErr instanceof Error ? dlErr.message : String(dlErr)}` };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[AudioSync] Voicemail recording download failed: ${errMsg}`);
    return { success: false, error: errMsg };
  }
}

function findFfmpeg(): string | null {
  const candidates = ["ffmpeg", "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/snap/bin/ffmpeg"];
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} -version`, { timeout: 5000, stdio: "pipe" });
      return cmd;
    } catch {}
  }
  return null;
}

let ffmpegPath: string | null | undefined = undefined;

function getFfmpegPath(): string | null {
  if (ffmpegPath === undefined) {
    ffmpegPath = findFfmpeg();
    if (ffmpegPath) {
      console.log(`[AudioSync] Found ffmpeg at: ${ffmpegPath}`);
    } else {
      console.warn(`[AudioSync] ffmpeg not found! Install with: sudo apt install ffmpeg`);
    }
  }
  return ffmpegPath;
}

function convertToAsteriskWav(inputPath: string): string | null {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    return null;
  }

  const dir = path.dirname(inputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(dir, `${baseName}_ast.wav`);

  try {
    execSync(
      `${ffmpeg} -y -i ${JSON.stringify(inputPath)} -af "loudnorm=I=-16:TP=-1.5:LRA=11,volume=1.5" -ar 8000 -ac 1 -sample_fmt s16 -acodec pcm_s16le ${JSON.stringify(outputPath)}`,
      { timeout: 30000, stdio: "pipe" }
    );
    console.log(`[AudioSync] Converted ${path.basename(inputPath)} → WAV 8kHz mono 16-bit`);
    return outputPath;
  } catch (err) {
    console.error(`[AudioSync] FFmpeg conversion failed for ${inputPath}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export async function syncAudioToAsterisk(messageId?: string): Promise<SyncResult> {
  const settings = await getAriSettings();
  console.log(`[AudioSync] Settings loaded: host=${settings?.host || 'null'}, sshUsername=${settings?.sshUsername || 'null'}, sshPort=${settings?.sshPort || 'null'}, asteriskSoundsPath=${settings?.asteriskSoundsPath || 'null'}, sshPassword=${settings?.sshPassword ? '***SET***' : 'EMPTY'}`);
  if (!settings || !settings.host || !settings.sshUsername) {
    const reason = !settings ? 'no settings row' : !settings.host ? 'host is empty' : 'sshUsername is empty';
    console.log(`[AudioSync] Aborting: ${reason}`);
    return { success: false, synced: 0, failed: 0, errors: [`SSH credentials not configured in ARI settings (${reason})`] };
  }

  let messages;
  if (messageId) {
    messages = await db.select().from(ivrMessages).where(eq(ivrMessages.id, messageId));
  } else {
    messages = await db.select().from(ivrMessages).where(eq(ivrMessages.isActive, true));
  }

  if (messages.length === 0) {
    return { success: true, synced: 0, failed: 0, errors: [] };
  }

  console.log(`[AudioSync] Attempting SSH connection to ${settings.host}:${settings.sshPort} as '${settings.sshUsername}'...`);
  let conn: Client;
  try {
    conn = await connectSSH({
      host: settings.host,
      sshPort: settings.sshPort,
      sshUsername: settings.sshUsername,
      sshPassword: settings.sshPassword,
    });
    console.log(`[AudioSync] SSH connected successfully`);
  } catch (err) {
    const errDetail = err instanceof Error ? `${err.message} (${(err as any).level || 'unknown level'})` : String(err);
    console.error(`[AudioSync] SSH connection failed: ${errDetail}`);
    return { success: false, synced: 0, failed: 0, errors: [`SSH connection failed: ${errDetail}`] };
  }

  const remoteSoundsPath = settings.asteriskSoundsPath || "/var/lib/asterisk/sounds/custom";

  let sftp: any;
  try {
    sftp = await getSFTP(conn);
    await sftpMkdir(sftp, remoteSoundsPath);
  } catch (err) {
    conn.end();
    return { success: false, synced: 0, failed: 0, errors: [`SFTP init failed: ${err instanceof Error ? err.message : err}`] };
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];
  const tempFiles: string[] = [];

  for (const msg of messages) {
    if (!msg.filePath) {
      errors.push(`${msg.name}: no audio file`);
      failed++;
      continue;
    }

    const localPath = path.resolve(msg.filePath);
    if (!fs.existsSync(localPath)) {
      errors.push(`${msg.name}: local file not found (${msg.filePath})`);
      failed++;
      continue;
    }

    const soundName = msg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    try {
      const ext = path.extname(localPath).toLowerCase();
      let uploadPath = localPath;
      let remoteExt = ext || ".wav";

      if (ext !== ".wav" || !isAsteriskCompatibleWav(localPath)) {
        console.log(`[AudioSync] Converting ${msg.name} (${ext}) to Asterisk WAV format...`);
        const converted = convertToAsteriskWav(localPath);
        if (converted) {
          uploadPath = converted;
          remoteExt = ".wav";
          tempFiles.push(converted);
        } else {
          console.warn(`[AudioSync] ffmpeg not available, uploading ${msg.name} as-is (${ext}). Asterisk may not play it. Install ffmpeg: sudo apt install ffmpeg`);
        }
      } else {
        remoteExt = ".wav";
      }

      const remoteFileName = `${soundName}${remoteExt}`;
      const remotePath = `${remoteSoundsPath}/${remoteFileName}`;

      await sftpUpload(sftp, uploadPath, remotePath);
      const warning = !getFfmpegPath() && ext !== ".wav" ? " (WARNING: not converted - install ffmpeg!)" : "";
      console.log(`[AudioSync] Uploaded ${msg.name} → ${remotePath}${warning}`);
      if (!getFfmpegPath() && ext !== ".wav") {
        errors.push(`${msg.name}: uploaded as ${ext} without conversion (ffmpeg not found). Install: sudo apt install ffmpeg`);
      }
      synced++;
    } catch (err) {
      const errMsg = `${msg.name}: ${err instanceof Error ? err.message : err}`;
      errors.push(errMsg);
      console.error(`[AudioSync] ${errMsg}`);
      failed++;
    }
  }

  conn.end();

  for (const tmp of tempFiles) {
    try { fs.unlinkSync(tmp); } catch {}
  }

  return { success: failed === 0, synced, failed, errors };
}

function isAsteriskCompatibleWav(filePath: string): boolean {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) return false;
  const ffprobe = ffmpeg.replace("ffmpeg", "ffprobe");
  try {
    const output = execSync(
      `${ffprobe} -v error -select_streams a:0 -show_entries stream=sample_rate,channels,codec_name -of csv=p=0 ${JSON.stringify(filePath)}`,
      { timeout: 10000, encoding: "utf-8" }
    ).trim();
    const parts = output.split(",");
    const codec = parts[0];
    const sampleRate = parseInt(parts[1]);
    const channels = parseInt(parts[2]);
    return codec === "pcm_s16le" && sampleRate === 8000 && channels === 1;
  } catch {
    return false;
  }
}

export async function syncSingleAudio(messageId: string): Promise<SyncResult> {
  return syncAudioToAsterisk(messageId);
}

export async function prewarmSftpPool(): Promise<void> {
  try {
    const settings = await getAriSettings();
    if (settings?.host && settings?.sshUsername && settings?.sshPassword) {
      await getPooledSftp({
        host: settings.host,
        sshPort: settings.sshPort || 22,
        sshUsername: settings.sshUsername,
        sshPassword: settings.sshPassword,
      });
    }
  } catch (err) {
    console.warn(`[AudioSync] SFTP pool prewarm failed:`, err instanceof Error ? err.message : err);
  }
}

let mkdirDoneForPath: string | null = null;

export async function uploadBufferToAsterisk(wavBuffer: Buffer, remoteSoundName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getAriSettings();
    if (!settings || !settings.host || !settings.sshUsername) {
      return { success: false, error: "SSH credentials not configured" };
    }

    const { sftp } = await getPooledSftp({
      host: settings.host,
      sshPort: settings.sshPort,
      sshUsername: settings.sshUsername,
      sshPassword: settings.sshPassword,
    });

    const remoteSoundsPath = settings.asteriskSoundsPath || "/var/lib/asterisk/sounds/custom";
    if (mkdirDoneForPath !== remoteSoundsPath) {
      await sftpMkdir(sftp, remoteSoundsPath);
      mkdirDoneForPath = remoteSoundsPath;
    }

    const remotePath = `${remoteSoundsPath}/${remoteSoundName}.wav`;
    await sftpUploadBuffer(sftp, wavBuffer, remotePath);
    return { success: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    pooledConn = null;
    pooledSftp = null;
    pooledSettings = null;
    return { success: false, error: errMsg };
  }
}

export async function syncVoicemailGreetingToAsterisk(localFilePath: string, remoteSoundName: string, skipConversion?: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getAriSettings();
    if (!settings || !settings.host || !settings.sshUsername) {
      return { success: false, error: "SSH credentials not configured in ARI settings" };
    }

    const absPath = path.resolve(localFilePath);
    if (!fs.existsSync(absPath)) {
      return { success: false, error: `Local file not found: ${localFilePath}` };
    }

    const t0 = Date.now();
    const { sftp } = await getPooledSftp({
      host: settings.host,
      sshPort: settings.sshPort,
      sshUsername: settings.sshUsername,
      sshPassword: settings.sshPassword,
    });

    const remoteSoundsPath = settings.asteriskSoundsPath || "/var/lib/asterisk/sounds/custom";
    if (mkdirDoneForPath !== remoteSoundsPath) {
      await sftpMkdir(sftp, remoteSoundsPath);
      mkdirDoneForPath = remoteSoundsPath;
    }

    const ext = path.extname(absPath).toLowerCase();
    let uploadPath = absPath;
    let remoteExt = ".wav";
    const tempFiles: string[] = [];

    if (!skipConversion && (ext !== ".wav" || !isAsteriskCompatibleWav(absPath))) {
      const converted = convertToAsteriskWav(absPath);
      if (converted) {
        uploadPath = converted;
        tempFiles.push(converted);
      } else {
        remoteExt = ext || ".wav";
      }
    }

    const remotePath = `${remoteSoundsPath}/${remoteSoundName}${remoteExt}`;
    await sftpUpload(sftp, uploadPath, remotePath);
    console.log(`[AudioSync] Uploaded via pooled SFTP (${Date.now() - t0}ms): ${remoteSoundName}`);

    for (const tmp of tempFiles) {
      try { fs.unlinkSync(tmp); } catch {}
    }

    return { success: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[AudioSync] Voicemail greeting sync failed: ${errMsg}`);
    pooledConn = null;
    pooledSftp = null;
    pooledSettings = null;
    return { success: false, error: errMsg };
  }
}
