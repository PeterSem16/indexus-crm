import * as net from "net";

export interface AmiActionResult {
  success: boolean;
  response: string;
}

export function sendAmiAction(
  host: string,
  port: number,
  username: string,
  password: string,
  actionFields: Record<string, string>
): Promise<AmiActionResult> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let buffer = "";
    let phase: "banner" | "login" | "action" | "done" = "banner";

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`AMI timeout connecting to ${host}:${port}`));
    }, 8000);

    const sendLogin = () => {
      const msg = `Action: Login\r\nUsername: ${username}\r\nSecret: ${password}\r\n\r\n`;
      socket.write(msg);
      phase = "login";
    };

    const sendAction = () => {
      const lines = Object.entries(actionFields)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\r\n");
      socket.write(lines + "\r\n\r\n");
      phase = "action";
    };

    socket.on("data", (chunk) => {
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
            socket.destroy();
            reject(new Error(`AMI login failed: ${packet}`));
            return;
          }
        } else if (phase === "action") {
          phase = "done";
          clearTimeout(timer);
          socket.end();
          resolve({
            success: packet.includes("Response: Success"),
            response: packet,
          });
          return;
        }
      }
    });

    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    socket.on("close", () => {
      if (phase !== "done") {
        clearTimeout(timer);
        reject(new Error(`AMI connection closed in phase '${phase}'`));
      }
    });
  });
}
