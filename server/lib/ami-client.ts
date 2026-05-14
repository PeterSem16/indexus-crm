import { Client as SshClient } from "ssh2";

export interface AmiActionResult {
  success: boolean;
  response: string;
}

/**
 * Sends an AMI action to Asterisk by tunneling through SSH.
 * AMI port 5038 may be blocked externally but always listens on localhost on the Asterisk server.
 */
export function sendAmiActionViaSshTunnel(
  host: string,
  sshPort: number,
  sshUsername: string,
  sshPassword: string,
  amiUsername: string,
  amiPassword: string,
  actionFields: Record<string, string>
): Promise<AmiActionResult> {
  return new Promise((resolve, reject) => {
    const conn = new SshClient();

    const timer = setTimeout(() => {
      conn.end();
      reject(new Error(`SSH tunnel timeout connecting to ${host}:${sshPort}`));
    }, 15000);

    conn.on("ready", () => {
      conn.forwardOut("127.0.0.1", 0, "127.0.0.1", 5038, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          conn.end();
          reject(new Error(`SSH port forward to AMI failed: ${err.message}`));
          return;
        }

        let buffer = "";
        let phase: "banner" | "login" | "action" | "done" = "banner";

        const sendLogin = () => {
          stream.write(`Action: Login\r\nUsername: ${amiUsername}\r\nSecret: ${amiPassword}\r\n\r\n`);
          phase = "login";
        };

        const sendAction = () => {
          const lines = Object.entries(actionFields)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\r\n");
          stream.write(lines + "\r\n\r\n");
          phase = "action";
        };

        stream.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();

          if (phase === "banner") {
            const idx = buffer.indexOf("\r\n");
            if (idx !== -1) {
              buffer = buffer.slice(idx + 2);
              sendLogin();
            }
            return;
          }

          while (true) {
            const idx = buffer.indexOf("\r\n\r\n");
            if (idx === -1) break;

            const packet = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 4);

            // Skip unsolicited events (e.g. FullyBooted) — wait only for Response: packets
            if (!packet.includes("Response:")) {
              continue;
            }

            if (phase === "login") {
              if (packet.includes("Response: Success")) {
                sendAction();
              } else {
                clearTimeout(timer);
                conn.end();
                reject(new Error(`AMI login failed: ${packet}`));
                return;
              }
            } else if (phase === "action") {
              phase = "done";
              clearTimeout(timer);
              conn.end();
              resolve({
                success: packet.includes("Response: Success"),
                response: packet,
              });
              return;
            }
          }
        });

        stream.on("error", (err: Error) => {
          clearTimeout(timer);
          conn.end();
          reject(new Error(`AMI tunnel stream error: ${err.message}`));
        });

        stream.on("close", () => {
          if (phase !== "done") {
            clearTimeout(timer);
            conn.end();
            reject(new Error(`AMI tunnel closed in phase '${phase}'`));
          }
        });
      });
    });

    conn.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`SSH connection error: ${err.message}`));
    });

    conn.connect({
      host,
      port: sshPort,
      username: sshUsername,
      password: sshPassword,
      readyTimeout: 8000,
      hostVerifier: () => true,
    });
  });
}

/**
 * Runs a single shell command on a remote server via SSH exec.
 * Used for setup tasks (e.g. mkdir) before recording starts.
 */
export function runSshCommand(
  host: string,
  sshPort: number,
  username: string,
  password: string,
  command: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new SshClient();
    const timer = setTimeout(() => { conn.end(); reject(new Error(`SSH command timeout: ${command}`)); }, 10000);

    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); reject(err); return; }
        let out = "";
        stream.on("data", (d: Buffer) => { out += d.toString(); });
        stream.stderr.on("data", (d: Buffer) => { out += d.toString(); });
        stream.on("close", () => { clearTimeout(timer); conn.end(); resolve(out.trim()); });
      });
    });
    conn.on("error", (err) => { clearTimeout(timer); reject(err); });
    conn.connect({ host, port: sshPort, username, password, readyTimeout: 8000, hostVerifier: () => true });
  });
}

/**
 * Downloads a file from a remote server via SSH exec (cat).
 * Used to retrieve MixMonitor recordings which ARI cannot serve.
 * Tries multiple extensions (.wav, .WAV, .ulaw, .gsm) if basePath has no extension.
 */
export function downloadFileViaSsh(
  host: string,
  sshPort: number,
  username: string,
  password: string,
  basePath: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const conn = new SshClient();

    const timer = setTimeout(() => {
      conn.end();
      reject(new Error(`SSH download timeout for ${basePath}`));
    }, 20000);

    conn.on("ready", () => {
      // Find the actual file — first try known extensions at the specified path,
      // then fall back to a recursive find across the whole Asterisk spool (catches wrong-dir cases)
      const baseName = basePath.split("/").pop() || "";
      const findCmd = [
        `ls ${basePath}.wav ${basePath}.WAV ${basePath}.ulaw ${basePath}.gsm ${basePath}.sln 2>/dev/null | head -1`,
        `find /var/spool/asterisk/ -name "${baseName}*" 2>/dev/null | head -1`,
      ].join(" || ");
      let foundPath = "";

      conn.exec(findCmd, (err, findStream) => {
        if (err) {
          clearTimeout(timer);
          conn.end();
          reject(err);
          return;
        }

        let findOutput = "";
        findStream.on("data", (d: Buffer) => { findOutput += d.toString(); });
        findStream.on("close", () => {
          foundPath = findOutput.trim().split("\n")[0].trim();
          if (!foundPath) {
            clearTimeout(timer);
            conn.end();
            reject(new Error(`Recording file not found at ${basePath}.* (also searched /var/spool/asterisk/ recursively)`));
            return;
          }
          console.log(`[SSH-Download] Found recording at: ${foundPath}`);

          // Download the file via cat
          conn.exec(`cat "${foundPath}"`, (err2, catStream) => {
            if (err2) {
              clearTimeout(timer);
              conn.end();
              reject(err2);
              return;
            }

            const chunks: Buffer[] = [];
            catStream.on("data", (chunk: Buffer) => { chunks.push(chunk); });
            catStream.on("close", () => {
              clearTimeout(timer);
              conn.end();
              const buf = Buffer.concat(chunks);
              if (buf.length < 100) {
                reject(new Error(`Downloaded file too small (${buf.length} bytes) — still recording?`));
              } else {
                resolve(buf);
              }
            });
            catStream.on("error", (e: Error) => {
              clearTimeout(timer);
              conn.end();
              reject(e);
            });
          });
        });
      });
    });

    conn.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`SSH connection error: ${err.message}`));
    });

    conn.connect({
      host,
      port: sshPort,
      username,
      password,
      readyTimeout: 8000,
      hostVerifier: () => true,
    });
  });
}
