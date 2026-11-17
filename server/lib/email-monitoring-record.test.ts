import test from "node:test";
import assert from "node:assert/strict";
import { createEmailMonitoringRecorder, monitoringSnapshot, readMonitoringSnapshot,
  type EmailMonitoringScope } from "./email-monitoring-record";
const scope: EmailMonitoringScope = { externalId: "synthetic-message", mailbox: "agent@example.test",
  kind: "personal", ownerUserId: "synthetic-owner" };
const analysis = { sentiment: "neutral" as const, hasInappropriateContent: false, hasAngryTone: false,
  hasRudeExpressions: false, wantsToCancel: false, wantsConsent: false, doesNotAcceptContract: true,
  alertLevel: "none" as const, note: "Zákazník odmieta ponuku, existujúcu službu ponecháva." };
test("an unlinked mailbox result retains nine exact fields and is isolated from other users and mailboxes", () => {
  const saved = monitoringSnapshot(scope, analysis);
  assert.deepEqual(readMonitoringSnapshot(saved, scope)?.analysis, analysis);
  for (const other of [{ ...scope, ownerUserId: "another" }, { ...scope, mailbox: "other@example.test" },
    { ...scope, kind: "system" as const, ownerUserId: null }])
    assert.equal(readMonitoringSnapshot(saved, other), null);
  assert.deepEqual(readMonitoringSnapshot(saved, { ...scope, mailbox: " AGENT@example.test " })?.analysis, analysis);
  assert.throws(() => readMonitoringSnapshot({ ...saved, analysis: { note: "not a full result" } }, scope), /invalid/);
  assert.throws(() => monitoringSnapshot(scope, { ...analysis, note: "x".repeat(101) }));
});
test("unlinked or pre-existing metadata does not gate persistence on a CRM contact", async () => {
  let saved: ReturnType<typeof monitoringSnapshot> | null = null, calls = 0, writes = 0;
  const recorder = createEmailMonitoringRecorder({
    read: async s => readMonitoringSnapshot(saved, s),
    save: async (s, a) => { writes++; saved = monitoringSnapshot(s, a);
      return { detail: readMonitoringSnapshot(saved, s)!, created: true }; },
  });
  const infer = async () => { calls++; return analysis; };
  assert.deepEqual((await recorder.obtain(scope, infer)).detail.analysis, analysis);
  assert.equal((await recorder.obtain(scope, infer)).created, false);
  assert.equal(calls, 1); assert.equal(writes, 1);
});
test("a save outage retries the same answer, not another inference or a repaired note", async () => {
  let calls = 0, attempts = 0;
  const recorder = createEmailMonitoringRecorder({
    read: async () => null,
    save: async (s, a) => { attempts++; if (attempts === 1) throw Error("synthetic_database_outage");
      return { detail: readMonitoringSnapshot(monitoringSnapshot(s, a), s)!, created: true }; },
  });
  const infer = async () => { calls++; return analysis; };
  await assert.rejects(recorder.obtain(scope, infer), /database_outage/);
  assert.equal((await recorder.obtain(scope, infer)).detail.analysis.note, analysis.note);
  assert.equal(calls, 1); assert.equal(attempts, 2);
});
test("overlapping polling shares one inference and invalid JSON is never stored", async () => {
  let calls = 0, writes = 0;
  const recorder = createEmailMonitoringRecorder({ read: async () => null,
    save: async (s, a) => { writes++; return { detail: readMonitoringSnapshot(monitoringSnapshot(s, a), s)!, created: true }; } });
  await Promise.all(Array.from({ length: 4 }, () => recorder.obtain(scope, async () => {
    calls++; await new Promise(r => setTimeout(r, 5)); return analysis;
  })));
  assert.equal(calls, 1); assert.equal(writes, 1);
  await assert.rejects(recorder.obtain({ ...scope, externalId: "invalid" }, async () => ({} as any)));
  assert.equal(writes, 1);
});
