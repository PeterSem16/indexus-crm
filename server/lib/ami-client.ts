import { Client as SshClient } from "ssh2";
import * as net from "net";

export interface AmiActionResult {
  success: boolean;
  response: string;
}

/**
 * Sends an AMI action to Asterisk by tunneling through SSH.
 * Used when AMI port 5038 is not directly reachable from the CRM server
 * (firewall blocks external access, but AMI runs on localhost on Asterisk server).
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
      // Forward a connection to AMI port on the remote host (localhost:5038 on Asterisk server)
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
