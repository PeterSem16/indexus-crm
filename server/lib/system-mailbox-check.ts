import { randomUUID } from "node:crypto";

export interface MailboxConnection {
  id: string; email: string; accountId?: string | null; isConnected: boolean;
  accessToken: string | null; updatedAt: Date | string;
}
export interface MailboxCheckResult {
  phase: "idle" | "checking" | "sent" | "received" | "failed" | "timeout";
  auth: "pending" | "ok" | "failed";
  send: "pending" | "ok" | "failed";
  receive: "pending" | "ok" | "failed" | "timeout";
  startedAt: string | null; finishedAt: string | null;
  errorCode: string | null; providerCode: string | null; senderAligned: boolean;
}
interface Dependencies {
  connection(country: string): Promise<MailboxConnection | undefined>;
  sender(country: string): Promise<string | null | undefined>;
  token(country: string, connection: MailboxConnection): Promise<string>;
  fetch: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  attempts?: number;
}
export class MailboxCheckError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
const address = (value: string | null | undefined) => (value || "").trim().toLowerCase();
const identity = (c: MailboxConnection) => JSON.stringify([c.id, address(c.email), c.accountId || ""]);
const revision = (c: MailboxConnection) => `${identity(c)}:${new Date(c.updatedAt).toISOString()}`;
const blank = (senderAligned = false): MailboxCheckResult => ({
  phase: "idle", auth: "pending", send: "pending", receive: "pending",
  startedAt: null, finishedAt: null, errorCode: null, providerCode: null, senderAligned,
});
const safeCode = (value: unknown) => typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(value) ? value : null;

/** Fixed-recipient loopback check. Never accepts addresses or email content from a browser. */
export class SystemMailboxChecks {
  private records = new Map<string, { identity: string; revision: string; result: MailboxCheckResult }>();
  private busy = new Set<string>();
  private lastStarted = new Map<string, number>();
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;
  constructor(private deps: Dependencies) {
    this.now = deps.now || Date.now;
    this.sleep = deps.sleep || ((ms) => new Promise(resolve => setTimeout(resolve, ms)));
  }
  private async aligned(country: string, c?: MailboxConnection) {
    return !!c?.isConnected && !!address(c.email) &&
      address(await this.deps.sender(country)) === address(c.email);
  }
  async status(country: string): Promise<MailboxCheckResult> {
    const c = await this.deps.connection(country);
    const aligned = await this.aligned(country, c);
    const record = this.records.get(country);
    if (!c || !record || record.identity !== identity(c) ||
        (!this.busy.has(country) && record.revision !== revision(c)))
      return blank(aligned);
    return { ...record.result, senderAligned: aligned };
  }
  async start(country: string): Promise<MailboxCheckResult> {
    if (this.busy.has(country)) throw new MailboxCheckError(409, "check_running");
    if (this.lastStarted.has(country) && this.now() - this.lastStarted.get(country)! < 60_000)
      throw new MailboxCheckError(429, "check_cooldown");
    this.busy.add(country); // Reserve before database awaits: concurrent clicks must not send twice.
    try {
      const c = await this.deps.connection(country);
      if (!c?.isConnected || !c.accessToken || !address(c.email))
        throw new MailboxCheckError(409, "not_connected");
      const aligned = await this.aligned(country, c);
      const record = { identity: identity(c), revision: revision(c), result: {
        ...blank(aligned), phase: "checking" as const, startedAt: new Date(this.now()).toISOString(),
      } as MailboxCheckResult };
      this.records.set(country, record);
      this.lastStarted.set(country, this.now());
      void this.run(country, c, record);
      return { ...record.result };
    } catch (e) { this.busy.delete(country); throw e; }
  }
  private async run(country: string, c: MailboxConnection, record: { identity: string; revision: string; result: MailboxCheckResult }) {
    const result = record.result;
    let stage: "auth" | "send" | "receive" = "auth";
    const ensureCurrent = async () => {
      const current = await this.deps.connection(country);
      if (!current?.isConnected || identity(current) !== record.identity)
        throw new MailboxCheckError(409, "mailbox_changed");
      return current;
    };
    try {
      if (!result.senderAligned) throw new MailboxCheckError(409, "sender_mismatch");
      const token = await this.deps.token(country, c);
      // Refreshes may update updatedAt; retain the current revision without exposing token metadata.
      record.revision = revision(await ensureCurrent());
      const graph = async (path: string, method = "GET", body?: object) => {
        const response = await this.deps.fetch(`https://graph.microsoft.com/v1.0${path}`, {
          method, redirect: "error", signal: AbortSignal.timeout(15_000),
          headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          result.providerCode = safeCode(payload?.error?.code);
          throw new MailboxCheckError(response.status, response.status === 403 ? "permission_denied" : "provider_rejected");
        }
        return response.status === 202 || response.status === 204 ? {} : response.json();
      };
      // Verify the token's mailbox identity, not merely a successful Graph response.
      const profile = await graph("/me?$select=mail,userPrincipalName");
      if (address(profile.mail) !== address(c.email) && address(profile.userPrincipalName) !== address(c.email))
        throw new MailboxCheckError(409, "mailbox_changed");
      result.auth = "ok";
      stage = "send";
      await ensureCurrent();
      if (!await this.aligned(country, c)) throw new MailboxCheckError(409, "sender_mismatch");
      const nonce = randomUUID();
      const subject = `INDEXUS [MAILBOX-CHECK:${nonce}]`;
      await graph("/me/sendMail", "POST", {
        message: {
          subject,
          body: { contentType: "Text", content: "INDEXUS system mailbox verification. This diagnostic contains no contact data. No reply is required." },
          toRecipients: [{ emailAddress: { address: c.email } }],
          internetMessageHeaders: [{ name: "X-INDEXUS-Mailbox-Check", value: nonce }],
        },
        saveToSentItems: true,
      });
      result.send = "ok";
      result.phase = "sent"; // 202 means accepted, not delivered.
      stage = "receive";
      const query = new URLSearchParams({
        "$filter": `subject eq '${subject}'`,
        "$select": "id,subject,from,toRecipients,internetMessageHeaders",
        "$top": "5",
      });
      for (let attempt = 0; attempt < (this.deps.attempts ?? 20); attempt++) {
        await ensureCurrent();
        const messages = await graph(`/me/mailFolders/inbox/messages?${query}`);
        if (Array.isArray(messages.value) && messages.value.some((message: any) =>
          message.subject === subject &&
          address(message.from?.emailAddress?.address) === address(c.email) &&
          Array.isArray(message.toRecipients) && message.toRecipients.some((r: any) => address(r.emailAddress?.address) === address(c.email)) &&
          Array.isArray(message.internetMessageHeaders) && message.internetMessageHeaders.some((h: any) =>
            String(h.name).toLowerCase() === "x-indexus-mailbox-check" && h.value === nonce))) {
          result.receive = "ok"; result.phase = "received"; return;
        }
        if (attempt + 1 < (this.deps.attempts ?? 20)) await this.sleep(3000);
      }
      result.receive = "timeout"; result.phase = "timeout"; result.errorCode = "receive_timeout";
    } catch (e) {
      result[stage] = "failed"; result.phase = "failed";
      result.errorCode = e instanceof MailboxCheckError ? e.code : "check_failed";
      // No raw exceptions/provider responses: they may contain addresses or tokens.
    } finally {
      result.finishedAt = new Date(this.now()).toISOString();
      this.busy.delete(country);
    }
  }
}
