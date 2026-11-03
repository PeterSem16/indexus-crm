/** Live-send evidence only. Never reconstruct historical dates from created_at. */
export interface Ms365SendEvidence {
  conversationId: string | null;
  externalId: string | null;
  internetMessageId: string | null;
  sentAt: string;
  acceptedAt: string;
  sentAtSource: "ms365_sent_datetime" | "ms365_accepted_at";
  externalIdType: "immutable" | null;
  sentItemLocation: "originating_mailbox" | "shared_mailbox";
  sentItemMailbox?: string;
}

export function isMs365SendEvidence(value: unknown): value is Ms365SendEvidence {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Partial<Ms365SendEvidence>;
  return typeof receipt.sentAt === "string" && typeof receipt.acceptedAt === "string" &&
    (receipt.sentAtSource === "ms365_sent_datetime" || receipt.sentAtSource === "ms365_accepted_at") &&
    (receipt.externalIdType === null || receipt.externalIdType === "immutable") &&
    (receipt.sentItemLocation === "originating_mailbox" || receipt.sentItemLocation === "shared_mailbox") &&
    [receipt.conversationId, receipt.externalId, receipt.internetMessageId].every(v => v === null || typeof v === "string") &&
    (receipt.sentItemMailbox === undefined || typeof receipt.sentItemMailbox === "string");
}

interface GraphRequest {
  header(name: string, value: string): GraphRequest;
  select(fields: string): GraphRequest;
  post(body: unknown): Promise<any>;
  get(): Promise<any>;
}
interface GraphClient { api(path: string): GraphRequest }

export class Ms365DeliveryError extends Error {
  readonly deliveryUncertain: boolean;
  declare readonly sendEvidence?: Partial<Ms365SendEvidence>;
  constructor(error: unknown, evidence?: Partial<Ms365SendEvidence>) {
    const code = Number((error as { statusCode?: unknown })?.statusCode);
    const rejected = code >= 400 && code < 500 && code !== 408;
    super(rejected ? "ms365_send_rejected" : "ms365_send_outcome_unknown");
    this.deliveryUncertain = !rejected;
    // Error loggers must not print the shared-mailbox address.
    if (evidence) Object.defineProperty(this, "sendEvidence", { value: evidence, enumerable: false });
  }
}

/**
 * A draft ID requested as ImmutableId survives movement into Sent Items.
 * Only draft creation may fall back to sendMail: a failed send POST must NEVER
 * trigger another transmission. Receipt reads cannot turn an accepted send
 * into a delivery failure. Acceptance is recorded separately from provider time.
 */
export async function sendWithMs365Evidence(
  client: GraphClient, message: Record<string, unknown>, mailboxEmail?: string,
): Promise<Ms365SendEvidence> {
  const base = mailboxEmail ? `/users/${encodeURIComponent(mailboxEmail)}` : "/me";
  const location = mailboxEmail
    ? { sentItemLocation: "shared_mailbox" as const, sentItemMailbox: mailboxEmail }
    : { sentItemLocation: "originating_mailbox" as const };
  const immutable = (path: string) => client.api(path).header("Prefer", 'IdType="ImmutableId"');
  let draft: any;
  try { draft = await immutable(`${base}/messages`).post(message); }
  catch { /* Draft creation has not submitted a message for delivery. */ }
  if (!draft?.id || typeof draft.id !== "string") {
    try { await client.api(`${base}/sendMail`).post({ message, saveToSentItems: true }); }
    catch (error) { throw new Ms365DeliveryError(error); }
    const acceptedAt = new Date().toISOString();
    return { conversationId: null, externalId: null, internetMessageId: null,
      sentAt: acceptedAt, acceptedAt, sentAtSource: "ms365_accepted_at",
      externalIdType: null, ...location };
  }
  const path = `${base}/messages/${encodeURIComponent(draft.id)}`;
  try { await immutable(`${path}/send`).post({}); }
  catch (error) {
    throw new Ms365DeliveryError(error, {
      externalId: draft.id, externalIdType: "immutable",
      conversationId: typeof draft.conversationId === "string" ? draft.conversationId : null,
      ...location,
    });
  }
  const acceptedAt = new Date().toISOString();
  const evidence: Ms365SendEvidence = {
    conversationId: typeof draft.conversationId === "string" ? draft.conversationId : null,
    externalId: draft.id, internetMessageId: null, acceptedAt, sentAt: acceptedAt,
    sentAtSource: "ms365_accepted_at", externalIdType: "immutable",
    ...location,
  };
  // Exchange may expose the sent copy asynchronously. Do not retry delivery.
  try {
    const sent = await immutable(path)
      .select("id,conversationId,internetMessageId,sentDateTime,isDraft").get();
    const time = Date.parse(sent?.sentDateTime);
    if (sent?.id === draft.id && sent.isDraft === false && Number.isFinite(time) &&
        time > 0 && time <= Date.parse(acceptedAt) + 60_000) {
      evidence.sentAt = new Date(time).toISOString();
      evidence.sentAtSource = "ms365_sent_datetime";
      evidence.internetMessageId = typeof sent.internetMessageId === "string" ? sent.internetMessageId : null;
      evidence.conversationId = typeof sent.conversationId === "string" ? sent.conversationId : evidence.conversationId;
    }
  } catch { /* Accepted send remains accepted; never print Graph contents. */ }
  return evidence;
}
