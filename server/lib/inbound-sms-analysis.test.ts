import assert from "node:assert/strict";
import test from "node:test";
import { analyzePersistedInboundSms, type SmsAnalysisResult } from "./inbound-sms-analysis";

const angry: SmsAnalysisResult = {
  sentiment: "angry", alertLevel: "warning", note: "fixture",
  hasInappropriateContent: false, hasAngryTone: true, hasRudeExpressions: false,
  wantsToCancel: true, wantsConsent: false, doesNotAcceptContract: false,
};
for (const provider of ["bulkgate", "smstools"]) {
  test(`${provider}: identical persisted badges, events and intent`, async () => {
    const calls: string[] = [];
    let patch: any;
    assert.equal(await analyzePersistedInboundSms("fixture", {
      load: async id => ({ id, type: "sms", direction: "inbound", provider, content: "fixture text", aiAnalyzed: false }),
      analyze: async content => { assert.equal(content, "fixture text"); calls.push("analyze"); return angry; },
      received: async () => { calls.push("received"); },
      persist: async (_id, value) => { patch = value; calls.push("persist"); return { id: "fixture", ...value }; },
      negative: async () => { calls.push("negative"); },
    }), "analyzed");
    assert.deepEqual(calls, ["received", "analyze", "persist", "negative"]);
    assert.equal(patch.aiHasAngryTone, true);
    assert.equal(patch.aiWantsToCancel, true);
    assert.equal(patch.aiAnalyzed, true);
    assert(patch.aiAnalyzedAt instanceof Date);
    assert(!("campaignId" in patch), "analysis must not rewrite Mission attribution");
    assert(!("provider" in patch), "analysis must not rewrite transport");
  });
}
test("calm cancellation does not become an angry alert", async () => {
  let negative = false;
  await analyzePersistedInboundSms("fixture", {
    load: async id => ({ id, type: "sms", direction: "inbound", provider: "smstools", content: "fixture", aiAnalyzed: false }),
    received: async () => {},
    analyze: async () => ({ ...angry, sentiment: "neutral", hasAngryTone: false }),
    persist: async () => ({ id: "fixture" }),
    negative: async () => { negative = true; },
  });
  assert.equal(negative, false);
});
test("already analyzed, outbound and unknown sources never rerun analysis", async () => {
  for (const extra of [{ aiAnalyzed: true }, { direction: "outbound" }, { provider: "unknown" }]) {
    let touched = false;
    await analyzePersistedInboundSms("fixture", {
      load: async id => ({ id, type: "sms", direction: "inbound", provider: "bulkgate", content: "fixture", aiAnalyzed: false, ...extra }),
      received: async () => { touched = true; }, analyze: async () => { touched = true; return angry; },
      persist: async () => { touched = true; return {}; }, negative: async () => { touched = true; },
    });
    assert.equal(touched, false);
  }
});
test("failed persistence cannot emit a sentiment alert", async () => {
  let negative = false;
  await assert.rejects(analyzePersistedInboundSms("fixture", {
    load: async id => ({ id, type: "sms", direction: "inbound", provider: "smstools", content: "fixture", aiAnalyzed: false }),
    received: async () => {}, analyze: async () => angry, persist: async () => { throw new Error("fixture failure"); },
    negative: async () => { negative = true; },
  }));
  assert.equal(negative, false);
});
test("unavailable AI does not fabricate neutral results", async () => {
  let persisted = false;
  assert.equal(await analyzePersistedInboundSms("fixture", {
    load: async id => ({ id, type: "sms", direction: "inbound", provider: "smstools", content: "fixture", aiAnalyzed: false }),
    received: async () => {}, analyze: async () => null,
    persist: async () => { persisted = true; return {}; }, negative: async () => {},
  }), "unavailable");
  assert.equal(persisted, false);
});
