import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { Client } from "ssh2";
import { createForwardedCelReader, parseForwardedCelExport } from "./forwarded-cel-source";

const event = {
  eventType: "HANGUP", eventTime: "2026-09-18T10:00:00.123456Z",
  uniqueId: "100.1", linkedId: "100.1", channel: `PJSIP/${"a".repeat(64)}`,
  peer: "", application: "Dial", extra: '{"dialstatus":"BUSY","hangupcause":17}',
};
assert.deepEqual(parseForwardedCelExport(JSON.stringify({ events: [event, event] })).events, [event, event]);
for (const changed of [
  { eventTime: "2026-09-18 10:00:00" },
  { channel: "PJSIP/private-number-0001" },
  { peer: "Local/private-number@context" },
  { extra: '{"caller":"private-number"}' },
  { extra: '{"dialstatus":{}}' },
  { uniqueId: "../etc/passwd" },
  { eventType: "<script>" },
]) {
  assert.throws(() => parseForwardedCelExport(JSON.stringify({ events: [{ ...event, ...changed }] })),
    /^Error: Forwarded CEL source unavailable or invalid$/);
}
assert.throws(() => parseForwardedCelExport("private remote error"), /source unavailable or invalid/);

async function transportTest(mode: "valid" | "invalid" | "exit" | "disconnect" | "overflow") {
  class FakeClient extends EventEmitter {
    command = "";
    end() {}
    connect() { queueMicrotask(() => this.emit("ready")); return this; }
    exec(command: string, callback: (err: null, stream: any) => void) {
      this.command = command;
      const stream = Object.assign(new EventEmitter(), { stderr: new EventEmitter() });
      callback(null, stream);
      queueMicrotask(() => {
        if (mode === "disconnect") return this.emit("close");
        stream.stderr.emit("data", Buffer.from("private diagnostic"));
        stream.emit("data", Buffer.from(mode === "overflow" ? "x".repeat(32 * 1024 * 1024 + 1)
          : mode === "invalid" ? "private malformed data" : JSON.stringify({ events: [event] })));
        stream.emit("close", mode === "exit" ? 1 : 0);
      });
    }
  }
  const client = new FakeClient();
  const result = createForwardedCelReader(() => client as unknown as Client)({
    host: "test.invalid", sshPort: 22, sshUsername: "test", sshPassword: "test-only",
  });
  if (mode === "valid") assert.equal((await result).events.length, 1);
  else await assert.rejects(result, /^Error: Forwarded CEL source unavailable or invalid$/);
  assert.equal(client.command, "/usr/local/libexec/indexus-read-forwarded-cel");
}
async function main() {
  for (const mode of ["valid", "invalid", "exit", "disconnect", "overflow"] as const) await transportTest(mode);
  console.log("Forwarded CEL source protocol and transport tests passed");
}
main().catch(() => { console.error("Forwarded CEL source tests failed"); process.exitCode = 1; });