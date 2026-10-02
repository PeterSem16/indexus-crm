import assert from "node:assert/strict";
import { test } from "node:test";
import { EVENT_DRAFT_SOURCES, validateEventDraftInput, validateEventDraftOutput } from "./automation-event-draft";

const manager = { role: "manager", assignedCountries: ["CZ"] };
const valid = {
  module: "task", eventType: "task.completed", countryCode: "CZ",
  conditionField: "newValues.priority", conditionValue: "urgent",
  desiredIntent: "notify_user", instruction: "Notify a user when urgent tasks are completed.",
};

test("only actual events and permitted countries can be drafted", () => {
  assert.equal(validateEventDraftInput(valid, manager).eventType, "task.completed");
  assert.throws(() => validateEventDraftInput({ ...valid, module: "clinic", eventType: "task.completed" }, manager));
  assert.throws(() => validateEventDraftInput({ ...valid, countryCode: "SK" }, manager));
  assert.throws(() => validateEventDraftInput(valid, { role: "user", assignedCountries: ["CZ"] }));
  assert.throws(() => validateEventDraftInput({ ...valid, conditionField: "newValues.mobilePasswordHash" }, manager));
  assert.throws(() => validateEventDraftInput({ ...valid, conditionValue: "" }, manager));
  assert.throws(() => validateEventDraftInput({ ...valid, desiredIntent: "send_contact_email" }, manager));
  assert.equal(validateEventDraftInput({ ...valid, countryCode: "SK" }, { role: "admin" }).countryCode, "SK");
});

test("catalogue does not advertise status events or fields absent from emitters", () => {
  for (const module of ["hospital", "clinic", "collaborator"]) {
    const source = EVENT_DRAFT_SOURCES.find(s => s.module === module)!;
    assert.equal((source.events as readonly string[]).includes("status_changed"), false);
  }
  assert.equal((EVENT_DRAFT_SOURCES.find(s => s.module === "collaborator")!.fields as readonly string[]).includes("newValues.status"), false);
  assert.equal((EVENT_DRAFT_SOURCES.find(s => s.module === "call")!.fields as readonly string[]).includes("newValues.agentId"), false);
});

test("output must be grounded in instruction and stay at chosen action", () => {
  const input = validateEventDraftInput(valid, manager);
  const proposal = {
    intent: "notify_user", evidence: "urgent tasks are completed",
    condition: "On completion", explanation: "Notify a role",
    missingInformation: ["Which role receives it?"],
  };
  const output = validateEventDraftOutput({ proposals: [proposal], questions: [] }, input);
  assert.equal(output.scope.countryCode, "CZ");
  assert.equal(output.proposals[0].support, "not_integrated");
  assert.throws(() => validateEventDraftOutput({ proposals: [{ ...proposal, evidence: "Signed and verified" }], questions: [] }, input));
  assert.throws(() => validateEventDraftOutput({ proposals: [{ ...proposal, intent: "send_sms" }], questions: [] }, input));
});