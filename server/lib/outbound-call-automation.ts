import { campaigns, users, type CallLog } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { emitEventOnce } from "./event-bus";

export type OutboundCallEventType =
  | "outbound.started"
  | "outbound.answered"
  | "outbound.completed"
  | "outbound.unanswered";

const TERMINAL_UNANSWERED = new Set(["no_answer", "busy", "cancelled", "failed"]);
const TERMINAL_COMPLETED = new Set(["completed"]);
const isAnswered = (call: Pick<CallLog, "answeredAt" | "status">) =>
  !!call.answeredAt || call.status === "answered";

/** Accept an agent recipient only when the saved call owner resolves to a users row. */
export function verifiedOutboundAgentId(callLogUserId: unknown, verifiedUserId: unknown): string | null {
  return typeof callLogUserId === "string" && callLogUserId.trim() &&
    typeof verifiedUserId === "string" && verifiedUserId === callLogUserId
    ? verifiedUserId
    : null;
}

export function outboundCallEventValues(current: CallLog, agentId: string | null) {
  return {
    callId: current.id,
    campaignId: current.campaignId || null,
    agentId,
    status: current.status,
    durationSeconds: current.durationSeconds ?? null,
    talkDuration: current.durationSeconds ?? null,
    startedAt: current.startedAt,
    answeredAt: current.answeredAt,
    endedAt: current.endedAt,
  };
}

/** Shared writer kept injectable so recipient scope and durable event intent are testable. */
export async function writeOutboundCallEvents(
  current: CallLog,
  events: OutboundCallEventType[],
  agentId: string | null,
  countryCode: string | null,
  emitOnce: typeof emitEventOnce = emitEventOnce,
): Promise<void> {
  const newValues = outboundCallEventValues(current, agentId);
  for (const eventType of events) {
    await emitOnce({
      source: "storage",
      module: "call",
      entityType: "call",
      entityId: current.id,
      eventType,
      newValues,
      actorUserId: agentId,
      countryCode,
    }, `outbound-call:${current.id}:${eventType}`);
  }
}

/**
 * Resolve lifecycle transitions only from database-returned call-log rows.
 * `previous === null` means a durable insert; updates must provide the saved
 * pre-update row so arbitrary status payloads cannot create an event.
 */
export function outboundCallTransitions(
  previous: CallLog | null,
  current: CallLog | null | undefined,
): OutboundCallEventType[] {
  if (!current || current.direction !== "outbound" ||
      typeof current.id !== "string" || !current.id.trim() ||
      current.id.trim() !== current.id) return [];

  const events: OutboundCallEventType[] = [];
  if (!previous) events.push("outbound.started");
  const hadAnswered = previous ? isAnswered(previous) : false;
  if (isAnswered(current) && !hadAnswered) events.push("outbound.answered");
  const hasVerifiedAnswer = isAnswered(current) || (previous ? isAnswered(previous) : false);
  const previousHadVerifiedAnswer = previous ? isAnswered(previous) : false;
  // A bare `completed` status is ambiguous (notably for mobile duration
  // reports); only persisted answer evidence permits a post-call completion.
  if (TERMINAL_COMPLETED.has(current.status) && hasVerifiedAnswer &&
      (!previous || !TERMINAL_COMPLETED.has(previous.status) || !previousHadVerifiedAnswer)) {
    events.push("outbound.completed");
  } else if (!isAnswered(current) && TERMINAL_UNANSWERED.has(current.status) &&
      (!previous || (!TERMINAL_UNANSWERED.has(previous.status) && previous.status !== current.status))) {
    events.push("outbound.unanswered");
  }
  return events;
}

/** Emit post-write lifecycle events with scope derived exclusively from saved data. */
export async function emitOutboundCallLifecycle(
  previous: CallLog | null,
  current: CallLog | null | undefined,
): Promise<void> {
  const events = outboundCallTransitions(previous, current);
  if (!current || !events.length) return;

  // Do not accept SIP/provider identifiers as identity: the persisted primary
  // key returned by call_logs is the canonical event identity.
  const [user] = current.userId
    ? await db.select({ id: users.id }).from(users).where(eq(users.id, current.userId)).limit(1)
    : [];
  const agentId = verifiedOutboundAgentId(current.userId, user?.id);
  const countryCodes = current.campaignId
    ? (await db.select({ countryCodes: campaigns.countryCodes })
      .from(campaigns).where(eq(campaigns.id, current.campaignId)).limit(1))[0]?.countryCodes
    : undefined;
  const countryCode = countryCodes?.length === 1 && /^[A-Z]{2}$/i.test(countryCodes[0])
    ? countryCodes[0].toUpperCase()
    : null;
  await writeOutboundCallEvents(current, events, agentId, countryCode);
}