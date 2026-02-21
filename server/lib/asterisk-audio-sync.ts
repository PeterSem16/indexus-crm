import { Client } from "ssh2";
import * as fs from "fs";
import * as path from "path";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { ariSettings, ivrMessages } from "@shared/schema";

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

async function getAriSettings() {
  const [settings] = await db.select().from(ariSettings).limit(1);
  return settings;
}

function connectSSH(settings: { host: string; sshPort: number; sshUsername: string; sshPassword: string }): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on("ready", () => resolve(conn));
    conn.on("error", (err: Error) => reject(err));
    conn.connect({
      host: settings.host,
      port: settings.sshPort,
      username: settings.sshUsername,
      password: settings.sshPassword,
      readyTimeout: 10000,
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
    const readStream = fs.createReadStream(localPath);
    const writeStream = sftp.createWriteStream(remotePath);
    writeStream.on("close", () => resolve());
    writeStream.on("error", (err: Error) => reject(err));
    readStream.pipe(writeStream);
  });
}

export async function syncAudioToAsterisk(messageId?: string): Promise<SyncResult> {
  const settings = await getAriSettings();
  if (!settings || !settings.host || !settings.sshUsername) {
    return { success: false, synced: 0, failed: 0, errors: ["SSH credentials not configured in ARI settings"] };
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

  let conn: Client;
  try {
    conn = await connectSSH({
      host: settings.host,
      sshPort: settings.sshPort,
      sshUsername: settings.sshUsername,
      sshPassword: settings.sshPassword,
    });
  } catch (err) {
    return { success: false, synced: 0, failed: 0, errors: [`SSH connection failed: ${err instanceof Error ? err.message : err}`] };
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
    const ext = path.extname(msg.filePath) || ".wav";
    const remoteFileName = `${soundName}${ext}`;
    const remotePath = `${remoteSoundsPath}/${remoteFileName}`;

    try {
      await sftpUpload(sftp, localPath, remotePath);
      console.log(`[AudioSync] Uploaded ${msg.name} → ${remotePath}`);
      synced++;
    } catch (err) {
      const errMsg = `${msg.name}: upload failed - ${err instanceof Error ? err.message : err}`;
      errors.push(errMsg);
      console.error(`[AudioSync] ${errMsg}`);
      failed++;
    }
  }

  conn.end();

  return { success: failed === 0, synced, failed, errors };
}

export async function syncSingleAudio(messageId: string): Promise<SyncResult> {
  return syncAudioToAsterisk(messageId);
}
