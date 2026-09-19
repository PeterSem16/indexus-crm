import assert from "node:assert/strict";
import test from "node:test";
import { reconcileForwardedEvidence } from "./forwarded-call-evidence";
import type { ForwardedCelEvent } from "./forwarded-cel-source";

const transfer = new Date("2026-06-01T12:00:00.000Z");
const timestamp = (seconds: number) => new Date(transfer.getTime() + seconds * 1000).toISOString();
const rootChannel = `PJSIP/${"a".repeat(64)}`;
const externalChannel = `PJSIP/${"b".repeat(64)}`;
function event(eventType: string, seconds: number, uniqueId = "root", overrides: Partial<ForwardedCelEvent> = {}): ForwardedCelEvent {
  return {
    eventType, eventTime: timestamp(seconds), uniqueId, linkedId: "root",
    channel: uniqueId === "root" ? rootChannel : externalChannel,
    peer: "", application: "", extra: "{}", ...overrides,
  };
}
const connected = [
  event("ANSWER", 0), // caller was already answered for queue music
  event("CHAN_START", 1, "external"),
  event("ANSWER", 5, "external"),
  event("BRIDGE_ENTER", 5, "root", { extra: '{"bridge_id":"bridge-1"}' }),
  event("BRIDGE_ENTER", 5, "external", { extra: '{"bridge_id":"bridge-1"}' }),
  event("HANGUP", 20.125, "root", { extra: '{"dialstatus":"ANSWER"}' }),
];
const reduce = (events: ForwardedCelEvent[]) => reconcileForwardedEvidence("root", transfer, null, events);

test("actual PJSIP answer plus root bridge produces source timestamps and talk time", () => {
  const result = reduce(connected);
  assert.equal(result.status, "completed");
  assert.equal(result.answeredAt, timestamp(5));
  assert.equal(result.endedAt, timestamp(20.125));
  assert.equal(result.durationSeconds, 15);
  assert.equal(result.externalUniqueId, "external");
});

test("precise ANSWER is not replaced by a later bridge connection timestamp", () => {
  const preciseAnswer = "2026-06-01T12:00:05.123456Z";
  const preciseEnd = "2026-06-01T12:00:20.987654Z";
  const result = reduce(connected.map(e =>
    e.uniqueId === "external" && e.eventType === "ANSWER" ? { ...e, eventTime: preciseAnswer } :
    e.eventType === "BRIDGE_ENTER" ? { ...e, eventTime: timestamp(6) } :
    e.eventType === "HANGUP" ? { ...e, eventTime: preciseEnd } : e));
  assert.equal(result.answeredAt, preciseAnswer);
  assert.equal(result.endedAt, preciseEnd);
  assert.equal(result.bridgedAt, timestamp(6));
  assert.equal(result.durationSeconds, 15);
  const boundary = reduce(connected.map(e =>
    e.uniqueId === "external" && e.eventType === "ANSWER" ? { ...e, eventTime: "2026-06-01T12:00:05.999999Z" } :
    e.eventType === "BRIDGE_ENTER" ? { ...e, eventTime: timestamp(6) } :
    e.eventType === "HANGUP" ? { ...e, eventTime: "2026-06-01T12:00:20.999000Z" } : e));
  assert.equal(boundary.durationSeconds, 14);
});

test("linkedid alone, caller Up/ANSWER and Local Up/ANSWER never prove external answer", () => {
  const unrelated = reduce(connected.filter(e => e.eventType !== "BRIDGE_ENTER"));
  assert.equal(unrelated.status, "forwarded");
  assert.equal(unrelated.answeredAt, null);
  assert.equal(unrelated.durationSeconds, 0);
  const local = reduce(connected.map(e => e.uniqueId === "external" ? { ...e, channel: "Local/opaque" } : e));
  assert.equal(local.answeredAt, null);
  assert.equal(reduce([event("ANSWER", 0), event("HANGUP", 30)]).answeredAt, null);
});

test("wrong root uniqueid and old pre-handoff desk leg are rejected", () => {
  assert.equal(reconcileForwardedEvidence("other-root", transfer, null, connected).answeredAt, null);
  const old = connected.map(e => e.eventType === "CHAN_START" ? { ...e, eventTime: timestamp(-1) } : e);
  assert.equal(reduce(old).answeredAt, null);
});

test("explicit exact bridge peer is accepted without bridge_id", () => {
  const result = reduce(connected.map(e => e.eventType === "BRIDGE_ENTER"
    ? { ...e, extra: "{}", peer: e.uniqueId === "external" ? rootChannel : externalChannel } : e));
  assert.equal(result.status, "completed");
});

test("different bridge and nonoverlapping membership cannot complete call", () => {
  const otherBridge = connected.map(e => e.uniqueId === "external" && e.eventType === "BRIDGE_ENTER"
    ? { ...e, extra: '{"bridge_id":"other"}' } : e);
  assert.equal(reduce(otherBridge).answeredAt, null);
  const nonoverlap = [
    ...connected.map(e => e.uniqueId === "external" && e.eventType === "BRIDGE_ENTER"
      ? { ...e, eventTime: timestamp(8) } : e),
    event("BRIDGE_EXIT", 6, "root", { extra: '{"bridge_id":"bridge-1"}' }),
  ];
  assert.equal(reduce(nonoverlap).answeredAt, null);
});

test("busy and no-answer use root HANGUP dialstatus and exact end, not elapsed polling time", () => {
  for (const [dialstatus, status] of [["BUSY", "busy"], ["NOANSWER", "no_answer"], ["CONGESTION", "failed"]]) {
    const result = reduce([event("ANSWER", 0), event("HANGUP", 17.875, "root", { extra: JSON.stringify({ dialstatus }) })]);
    assert.equal(result.status, status);
    assert.equal(result.endedAt, timestamp(17.875));
    assert.equal(result.answeredAt, null);
    assert.equal(result.durationSeconds, 0);
  }
  assert.equal(reduce([event("HANGUP", 17, "external", { extra: '{"dialstatus":"BUSY"}' })]).endedAt, null);
});

test("provisional hangup persists through restart and accepts late authoritative answer", () => {
  const provisional = reduce([event("HANGUP", 20.125, "root", { extra: '{"dialstatus":"NOANSWER"}' })]);
  const restarted = JSON.parse(JSON.stringify(provisional));
  const final = reconcileForwardedEvidence("root", transfer, restarted, connected);
  assert.equal(final.status, "completed");
  assert.equal(final.endedAt, timestamp(20.125));
  assert.equal(final.durationSeconds, 15);
  assert.deepEqual(reconcileForwardedEvidence("root", transfer, final, connected.concat(connected)), final);
  assert.deepEqual(reconcileForwardedEvidence("root", transfer, final, []), final);
});

test("out-of-order replay and ambiguous channel identities fail safely", () => {
  assert.deepEqual(reduce([...connected].reverse()), reduce(connected));
  const ambiguous = [...connected, event("ANSWER", 2, "root", { channel: "PJSIP/different" })];
  assert.equal(reduce(ambiguous).answeredAt, null);
  const invalidTime = connected.map(e => e.eventType === "ANSWER" && e.uniqueId === "external"
    ? { ...e, eventTime: "not-a-time" } : e);
  assert.equal(reduce(invalidTime).answeredAt, null);
});

test("no source end means no invented completion and arbitrary extra is not persisted", () => {
  const result = reduce(connected.filter(e => e.eventType !== "HANGUP").map(e =>
    e.eventType === "ANSWER" ? { ...e, extra: '{"secret":"must-not-persist"}' } : e));
  assert.equal(result.status, "answered");
  assert.equal(result.endedAt, null);
  assert.equal(result.durationSeconds, 0);
  assert.equal(JSON.stringify(result).includes("must-not-persist"), false);
});