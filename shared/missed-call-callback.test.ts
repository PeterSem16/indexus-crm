import assert from "node:assert/strict";
import test from "node:test";
import {
  callbackPhoneKey, callbackRecordingDestinationMatches, selectedMissedCallbackSource, validateMissedCallback,
  type MissedCallbackEvidence,
} from "./missed-call-callback";

const evidence: MissedCallbackEvidence = {
  callId: "missed", campaignId: "mission", queueId: "queue", status: "abandoned",
  callerNumber: "+421 912 345 678", activeCampaignIds: ["mission", "other"],
  activeQueueIds: ["queue"], queueMember: true, missionAssigned: true,
  country: "SK", entityCountry: "SK", entityPhones: ["0912345678"], entityActive: true,
};
const input = { sourceId: "missed", campaignId: "mission", phone: "00421912345678" };

test("recognized person without enrollment can call back the verified original caller", () => {
  assert.equal(validateMissedCallback(evidence, input), null);
  for (const status of ["abandoned", "timeout", "overflow", "no_agents"]) {
    assert.equal(validateMissedCallback({ ...evidence, status }, input), null);
  }
});

test("actual SIP recording destination cannot substitute another country's same national number", () => {
  const binding = { destinationPhoneKey: "421912345678", destinationCountry: "SK" };
  assert.equal(callbackRecordingDestinationMatches(binding, "00421912345678", "912345678"), true);
  assert.equal(callbackRecordingDestinationMatches(binding, "0912345678", "912345678"), true);
  assert.equal(callbackRecordingDestinationMatches(binding, "00420912345678", "912345678"), false);
  assert.equal(callbackRecordingDestinationMatches({}, "+421912345678", "912345678"), false);
});

test("every authoritative authorization boundary fails closed", () => {
  for (const patch of [
    { campaignId: "other" }, { activeCampaignIds: ["other"] }, { activeQueueIds: ["other"] },
    { queueMember: false }, { missionAssigned: false }, { status: "answered" },
    { callerNumber: "+420912345678" }, { entityPhones: ["0912111111"] },
    { entityCountry: "CZ" },
  ]) assert.equal(validateMissedCallback({ ...evidence, ...patch }, input), "MISSED_CALLBACK_FORBIDDEN");
  assert.equal(validateMissedCallback(undefined, input), "MISSED_CALLBACK_FORBIDDEN");
  assert.equal(validateMissedCallback({ ...evidence, entityActive: false }, input), "CONTACT_INACTIVE");
  assert.equal(validateMissedCallback(evidence, { ...input, phone: "+420912345678" }), "MISSED_CALLBACK_FORBIDDEN");
});

test("full international phone identity preserves country and supported local formats", () => {
  assert.equal(callbackPhoneKey("+421912345678"), callbackPhoneKey("00421912345678"));
  assert.equal(callbackPhoneKey("0912345678", "SK"), callbackPhoneKey("+421912345678"));
  assert.equal(callbackPhoneKey("0421912345678", "SK"), callbackPhoneKey("+421912345678"));
  assert.notEqual(callbackPhoneKey("+420912345678"), callbackPhoneKey("+421912345678"));
  assert.equal(callbackPhoneKey("0212345678", "IT"), "390212345678");
  assert.equal(callbackPhoneKey("3912345678", "IT"), "393912345678");
  assert.equal(callbackPhoneKey("03912345678", "IT"), "3903912345678");
  assert.equal(callbackPhoneKey("393912345678", "IT"), "393912345678");
  assert.equal(callbackPhoneKey("anonymous", "SK"), null);
});

test("selection is bound to the person and Mission, not React's previous render", () => {
  const selection = {
    sourceId: "missed", campaignId: "mission", entityId: "person",
    contactType: "collaborator", callerNumber: evidence.callerNumber,
  };
  const dial = { campaignId: "mission", entityId: "person", contactType: "collaborator", phone: "0912345678", country: "SK" };
  assert.equal(selectedMissedCallbackSource(selection, dial), "missed");
  for (const patch of [
    { campaignId: "other" }, { entityId: "clinic" }, { contactType: "clinic" },
    { phone: "+421912111111" },
  ]) assert.equal(selectedMissedCallbackSource(selection, { ...dial, ...patch }), undefined);
  assert.equal(selectedMissedCallbackSource(null, dial), undefined);
});
