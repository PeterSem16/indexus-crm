import { Client as SshClient } from "ssh2";

export interface AmiActionResult {
  success: boolean;
  response: string;
}

/**
 * Runs an Asterisk CLI command via SSH.
 * Used when AMI port 5038 is not directly reachable from the CRM server.
 */
export function runAsteriskCliViaSsh(
  host: string,
  port: number,
  username: string,
  password: string,
  cliCommand: string
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve, reject) => {
    const conn = new SshClient();
    let output = "";

    const timer = setTimeout(() => {
      conn.end();
      reject(new Error(`SSH timeout connecting to ${host}:${port}`));
    }, 10000);

    conn.on("ready", () => {
      conn.exec(`asterisk -rx "${cliCommand.replace(/"/g, '\\"')}"`, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          conn.end();
          reject(err);
          return;
        }
        stream.on("data", (data: Buffer) => { output += data.toString(); });
        stream.stderr.on("data", (data: Buffer) => { output += data.toString(); });
        stream.on("close", () => {
          clearTimeout(timer);
          conn.end();
          const success = !output.toLowerCase().includes("no such channel") &&
                          !output.toLowerCase().includes("error") &&
                          !output.toLowerCase().includes("unable");
          resolve({ success, output: output.trim() });
        });
      });
    });

    conn.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    conn.connect({
      host,
      port,
      username,
      password,
      readyTimeout: 8000,
      hostVerifier: () => true,
    });
  });
}
