import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCallAnalysisSentimentEvent,
  resolveCallAnalysisAuthorizedCountry,
} from "./call-analysis-sentiment";

const base = {
  recordingId: "recording-1",
  callLogId: "call-1",
  customerId: "customer-1",
  campaignId: "mission-1",
  sentiment: "negative",
  analysisStatus: "completed",
  analyzedAt: new Date(),
  authorized: true,
  countryCode: "SK",
};

test("builds safe inbound and outbound sentiment events using persisted direction", () => {
  const inbound = buildCallAnalysisSentimentEvent({ ...base, direction: "inbound" });
  assert.deepEqual(inbound, {
    source: "call-analysis",
    module: "communication",
    entityType: "communication",
    entityId: "call-1",
    eventType: "sentiment.negative",
    newValues: {
      type: "inbound_call",
      sentiment: "negative",
      recordingId: "recording-1",
      callLogId: "call-1",
      customerId: "customer-1",
      campaignId: "mission-1",
    },
    countryCode: "SK",
    idempotencyKey: "call:call-1:sentiment.negative",
  });
  assert.equal(
    buildCallAnalysisSentimentEvent({ ...base, direction: "outbound", sentiment: "angry" })?.newValues.type,
    "outbound_call",
  );
});

test("uses recording ID for stable fallback event identity", () => {
  const event = buildCallAnalysisSentimentEvent({
    ...base,
    callLogId: null,
    direction: "outbound",
  });
  assert.equal(event?.entityId, "recording-1");
  assert.equal(event?.idempotencyKey, "call:recording-1:sentiment.negative");
});

test("authorizes Mission and customer countries only against persisted owner access", () => {
  assert.equal(resolveCallAnalysisAuthorizedCountry({
    assignedCountries: ["SK", "CZ"],
    missionCountryCodes: ["HU", "SK"],
  }), "SK");
  assert.equal(resolveCallAnalysisAuthorizedCountry({
    assignedCountries: ["SK"],
    missionCountryCodes: ["HU"],
  }), null);
  assert.equal(resolveCallAnalysisAuthorizedCountry({
    assignedCountries: ["SK"],
    missionCountryCodes: [],
    customerCountry: "SK",
  }), null);
  assert.equal(resolveCallAnalysisAuthorizedCountry({
    assignedCountries: ["SK"],
    customerCountry: "SK",
  }), "SK");
  assert.equal(resolveCallAnalysisAuthorizedCountry({
    assignedCountries: ["SK"],
    customerCountry: "HU",
  }), null);
});

test("does not emit for neutral, short/incomplete, unauthorized, or agent-only analysis", () => {
  const invalidInputs = [
    { ...base, direction: "inbound", sentiment: "neutral" },
    { ...base, direction: "inbound", analysisStatus: "processing" },
    { ...base, direction: "inbound", analyzedAt: null },
    { ...base, direction: "inbound", authorized: false },
    { ...base, direction: "inbound", recordingMode: "agent_only" },
    { ...base, direction: "inbound", audioScope: "agent_only" },
    { ...base, direction: "inbound", countryCode: null },
    { ...base, direction: "client-supplied-direction" },
  ];
  for (const input of invalidInputs) {
    assert.equal(buildCallAnalysisSentimentEvent(input), null);
  }
});

test("event content excludes transcript and analysis prose", () => {
  const event = buildCallAnalysisSentimentEvent({ ...base, direction: "inbound" });
  assert.ok(event);
  assert.deepEqual(Object.keys(event.newValues).sort(), [
    "callLogId",
    "campaignId",
    "customerId",
    "recordingId",
    "sentiment",
    "type",
  ]);
});