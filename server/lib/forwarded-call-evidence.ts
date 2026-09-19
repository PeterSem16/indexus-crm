import type { ForwardedCelEvent } from "./forwarded-cel-source";

export interface ForwardedCallEvidence {
  events: ForwardedCelEvent[];
  answeredAt: string | null;
  bridgedAt: string | null;
  endedAt: string | null;
  externalUniqueId: string | null;
  status: "forwarded" | "answered" | "completed" | "busy" | "no_answer" | "failed";
  durationSeconds: number;
}

function extra(event: ForwardedCelEvent): Record<string, unknown> {
  try {
    const value = JSON.parse(event.extra);
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

function peers(event: ForwardedCelEvent): string[] {
  return event.peer.split(",").map(value => value.trim()).filter(Boolean);
}

function bridgeId(event: ForwardedCelEvent): string | null {
  const value = extra(event).bridge_id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function sourceMicroseconds(value: string): bigint {
  const fraction = /\.(\d{1,6})Z$/.exec(value)?.[1] ?? "";
  const microsBelowMillisecond = fraction.padEnd(6, "0").slice(3);
  return BigInt(Date.parse(value)) * BigInt(1000) + BigInt(microsBelowMillisecond || "0");
}

/**
 * Replayable, monotonic evidence reduction. Linkedid is only a candidate filter,
 * NEVER proof of an answer. An external PJSIP ANSWER must also be connected to
 * the exact root by a CEL bridge peer or overlapping bridge memberships.
 * Caller ANSWER, Local ANSWER, channel disappearance and wall-clock time cannot
 * complete a call. Missing/inconsistent evidence remains unresolved.
 */
export function reconcileForwardedEvidence(
  rootUniqueId: string,
  transferredAt: Date,
  previous: ForwardedCallEvidence | null,
  incoming: readonly ForwardedCelEvent[],
): ForwardedCallEvidence {
  const transferMs = transferredAt.getTime();
  const candidates = [...(previous?.events ?? []), ...incoming].filter(event =>
    (event.uniqueId === rootUniqueId || event.linkedId === rootUniqueId) &&
    ["CHAN_START", "ANSWER", "BRIDGE_ENTER", "BRIDGE_EXIT", "HANGUP"].includes(event.eventType) &&
    Number.isFinite(Date.parse(event.eventTime)) && Date.parse(event.eventTime) >= transferMs,
  ).map(event => ({
    ...event,
    // Persist only correlation/outcome attributes, not arbitrary CEL app data.
    extra: JSON.stringify(Object.fromEntries(Object.entries(extra(event))
      .filter(([key]) => ["bridge_id", "dialstatus", "hangupcause"].includes(key)))),
  }));
  const events = Array.from(new Map(candidates.map(event => [JSON.stringify(event), event])).values())
    .sort((a, b) => Number(sourceMicroseconds(a.eventTime) - sourceMicroseconds(b.eventTime)) ||
      JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const root = events.filter(event => event.uniqueId === rootUniqueId);
  const rootNames = new Set(root.map(event => event.channel).filter(Boolean));
  // A uniqueid must not identify several channel names; do not guess after a
  // masquerade/ambiguous source identity.
  const rootChannel = rootNames.size === 1 ? Array.from(rootNames)[0] : null;
  const rootHangup = root.find(event => event.eventType === "HANGUP");
  const endMs = rootHangup ? Date.parse(rootHangup.eventTime) : Infinity;

  const overlapsRoot = (leg: ForwardedCelEvent, answerMs: number): number | null => {
    if (!rootChannel) return null;
    const entries = events.filter(event => event.uniqueId === leg.uniqueId &&
      event.channel === leg.channel && event.eventType === "BRIDGE_ENTER");
    const matches: number[] = [];
    for (const entry of entries) {
      const entered = Date.parse(entry.eventTime);
      if (entered < answerMs || entered > endMs) continue;
      if (peers(entry).includes(rootChannel)) matches.push(entered);
      const id = bridgeId(entry);
      for (const rootEntry of root.filter(event => event.eventType === "BRIDGE_ENTER")) {
        const rootEntered = Date.parse(rootEntry.eventTime);
        const connected = Math.max(entered, rootEntered);
        if (connected > endMs) continue;
        const rootLeft = root.find(event =>
          ["BRIDGE_EXIT", "HANGUP"].includes(event.eventType) &&
          Date.parse(event.eventTime) >= rootEntered &&
          (event.eventType === "HANGUP" || bridgeId(event) === bridgeId(rootEntry)));
        const legLeft = events.find(event => event.uniqueId === leg.uniqueId &&
          ["BRIDGE_EXIT", "HANGUP"].includes(event.eventType) &&
          Date.parse(event.eventTime) >= entered &&
          (event.eventType === "HANGUP" || bridgeId(event) === id));
        if ((rootLeft && Date.parse(rootLeft.eventTime) <= connected) ||
            (legLeft && Date.parse(legLeft.eventTime) <= connected)) continue;
        if (peers(rootEntry).includes(leg.channel) || id && id === bridgeId(rootEntry)) {
          matches.push(connected);
        }
      }
    }
    return matches.length ? Math.min(...matches) : null;
  };

  const answers = events.filter(event =>
    event.eventType === "ANSWER" && event.uniqueId !== rootUniqueId &&
    event.linkedId === rootUniqueId && /^PJSIP\/[^\s,/]+$/i.test(event.channel) &&
    !rootNames.has(event.channel),
  ).flatMap(answer => {
    // A new leg created AFTER handoff, not an earlier desk/queue answer.
    const started = events.find(event => event.uniqueId === answer.uniqueId &&
      event.eventType === "CHAN_START" && event.channel === answer.channel &&
      Date.parse(event.eventTime) <= Date.parse(answer.eventTime));
    if (!started) return [];
    if (new Set(events.filter(event => event.uniqueId === answer.uniqueId).map(event => event.channel)).size !== 1) return [];
    const connected = overlapsRoot(answer, Date.parse(answer.eventTime));
    return connected === null ? [] : [{ answer, connected }];
  }).sort((a, b) => a.connected - b.connected);
  const verified = answers[0];
  // Bridge evidence AUTHORIZEs the external answer, but does not replace its
  // timestamp. Preserve CEL's precise answer time (including microseconds);
  // keep the connection time separately so the two meanings are never conflated.
  const answeredAt = previous?.answeredAt ?? verified?.answer.eventTime ?? null;
  const bridgedAt = previous?.bridgedAt ?? (verified ? new Date(verified.connected).toISOString() : null);
  const endedAt = previous?.endedAt ?? rootHangup?.eventTime ?? null;
  const dialStatus = rootHangup ? String(extra(rootHangup).dialstatus ?? "").toUpperCase() : "";
  let status: ForwardedCallEvidence["status"] = answeredAt ? endedAt ? "completed" : "answered" : "forwarded";
  if (!answeredAt && endedAt) {
    if (dialStatus === "BUSY") status = "busy";
    else if (["NOANSWER", "CANCEL"].includes(dialStatus)) status = "no_answer";
    else if (["CHANUNAVAIL", "CONGESTION", "INVALIDARGS"].includes(dialStatus)) status = "failed";
  }
  return {
    events, answeredAt, bridgedAt, endedAt,
    externalUniqueId: previous?.externalUniqueId ?? verified?.answer.uniqueId ?? null,
    status,
    durationSeconds: answeredAt && endedAt
      ? Math.max(0, Number((sourceMicroseconds(endedAt) - sourceMicroseconds(answeredAt)) / BigInt(1_000_000))) : 0,
  };
}