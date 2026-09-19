import { Client as SshClient } from "ssh2";

/** Only the minimized, server-owned CEL export is accepted, never browser events. */
export interface ForwardedCelEvent {
  eventType: string;
  eventTime: string;
  uniqueId: string;
  linkedId: string;
  channel: string;
  peer: string;
  application: string;
  extra: string;
}

export interface ForwardedCelSshConfig {
  host: string;
  sshPort: number;
  sshUsername: string;
  sshPassword: string;
}

const MAX_BYTES = 32 * 1024 * 1024;
const MAX_EVENTS = 250_000;
const READER_COMMAND = "/usr/local/libexec/indexus-read-forwarded-cel";
const identifier = /^[a-zA-Z0-9_.:-]{1,160}$/;
const channel = /^(?:[A-Za-z0-9_]+\/[a-f0-9]{64})?$/;
const safeFailure = () => new Error("Forwarded CEL source unavailable or invalid");

/**
 * Strictly validate the helper protocol without including remote output in errors.
 * Channel names are hashed on the PBX; raw dial strings must never reach logs.
 */
export function parseForwardedCelExport(text: string): { events: ForwardedCelEvent[] } {
  try {
    if (Buffer.byteLength(text) > MAX_BYTES) throw safeFailure();
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.events) || parsed.events.length > MAX_EVENTS) throw safeFailure();
    const events: ForwardedCelEvent[] = parsed.events.map((item: unknown) => {
      if (!item || typeof item !== "object") throw safeFailure();
      const row = item as Record<string, unknown>;
      const fields = ["eventType", "eventTime", "uniqueId", "linkedId", "channel", "peer", "application", "extra"] as const;
      if (fields.some(key => typeof row[key] !== "string")) throw safeFailure();
      const event = Object.fromEntries(fields.map(key => [key, row[key]])) as unknown as ForwardedCelEvent;
      if (!/^[A-Z_]{1,40}$/.test(event.eventType)
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(event.eventTime)
        || !Number.isFinite(Date.parse(event.eventTime))
        || !identifier.test(event.uniqueId) || !identifier.test(event.linkedId)
        || !channel.test(event.channel)
        || event.peer.length > 4096
        || !event.peer.split(",").every(value => channel.test(value))
        || !/^[A-Za-z0-9_]{0,80}$/.test(event.application)
        || event.extra.length > 1024) throw safeFailure();
      const extra = JSON.parse(event.extra || "{}");
      if (!extra || Array.isArray(extra) || typeof extra !== "object") throw safeFailure();
      for (const [key, value] of Object.entries(extra)) {
        if (!["bridge_id", "dialstatus", "hangupcause"].includes(key)
          || !["string", "number"].includes(typeof value)
          || !/^[a-zA-Z0-9_.:-]{0,160}$/.test(String(value))) throw safeFailure();
      }
      return event;
    });
    return { events };
  } catch {
    throw safeFailure();
  }
}

/** Dependency injection is limited to tests; production uses the configured PBX SSH account. */
export function createForwardedCelReader(createClient: () => SshClient = () => new SshClient()) {
  return async (config: ForwardedCelSshConfig, _cursor?: string): Promise<{ events: ForwardedCelEvent[]; cursor?: string }> => {
    // Full retained replay is deliberate: a cursor alone would lose unfinished
    // calls after a worker restart. The durable reconciler is idempotent.
    return new Promise((resolve, reject) => {
      const client = createClient();
      let settled = false;
      let bytes = 0;
      const chunks: Buffer[] = [];
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        client.end();
        if (error) return reject(safeFailure());
        try {
          resolve(parseForwardedCelExport(Buffer.concat(chunks).toString("utf8")));
        } catch {
          reject(safeFailure());
        }
      };
      const timer = setTimeout(() => finish(safeFailure()), 30_000);
      client.on("error", () => finish(safeFailure()));
      client.on("close", () => { if (!settled) finish(safeFailure()); });
      client.on("ready", () => {
        client.exec(READER_COMMAND, (error, stream) => {
          if (error) return finish(safeFailure());
          stream.on("data", (data: Buffer) => {
            if (settled) return;
            bytes += data.length;
            if (bytes > MAX_BYTES) return finish(safeFailure());
            chunks.push(Buffer.from(data));
          });
          // Drain but never forward remote diagnostics: they can contain PII.
          stream.stderr.on("data", () => {});
          stream.on("error", () => finish(safeFailure()));
          stream.on("close", (code: number | null, signal?: string) => {
            finish(code === 0 && !signal ? undefined : safeFailure());
          });
        });
      });
      try {
        client.connect({
          host: config.host,
          port: config.sshPort,
          username: config.sshUsername,
          password: config.sshPassword,
          readyTimeout: 15_000,
        });
      } catch {
        finish(safeFailure());
      }
    });
  };
}

export const readForwardedCelEvents = createForwardedCelReader();