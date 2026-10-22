import assert from "node:assert/strict";
import { statusListHistoryFacts, loadStatusListHistoryFacts } from "./status-list-history";
import { statusListHistoryFields, statusListHistoryMatches } from "../../shared/status-list-history";
import { workflowConditionMatches, workflowConditionSchema } from "../../shared/status-list-workflow";
import { getStatusListHistoryCopy } from "../../client/src/components/status-list-history-copy";

const call = { direction: "outbound", started_at: new Date(), status: "no_answer", is_forwarded: false };
const msg = { direction: "outbound", type: "sms", status: "sent" };
const facts = (calls: any[] = [], messages: any[] = []) => statusListHistoryFacts({ calls, messages });
assert.ok(Object.values(facts()).every(value => value === false));
assert.equal(facts([call])["history.outreach_attempted"], true);
assert.equal(facts([{ ...call, direction: "inbound" }])["history.outreach_attempted"], false);
assert.equal(facts([call])["history.call_failed"], true);
assert.equal(facts([{ ...call, status: "ringing" }])["history.call_failed"], false);
assert.equal(facts([call])["history.reached"], false);
const answered = { ...call, status: "completed", answered_at: new Date(), duration_seconds: 2 };
assert.equal(facts([answered])["history.reached"], true);
assert.equal(facts([{ ...answered, duration_seconds: 0 }])["history.reached"], false);
assert.equal(facts([{ ...answered, is_forwarded: true }])["history.reached"], false);
assert.equal(facts([call, answered])["history.call_failed"], true);
assert.equal(facts([call, answered])["history.reached"], true);
assert.equal(facts([], [msg])["history.sms_sent"], true);
assert.equal(facts([], [msg])["history.message_delivered"], false);
assert.equal(facts([], [msg])["history.reached"], false);
assert.equal(facts([], [{ ...msg, status: "delivered" }])["history.message_delivered"], true);
for (const status of ["draft", "queued", "pending", "failed", "unknown"]) {
  assert.equal(facts([], [{ ...msg, status }])["history.sms_sent"], false);
  assert.equal(facts([], [{ ...msg, status }])["history.reached"], false);
}
assert.equal(facts([], [{ ...msg, status: "failed" }])["history.outreach_attempted"], true);
for (const type of ["email", "sms"]) {
  assert.equal(facts([], [{ type, direction: "inbound", status: "received" }])["history.reached"], true);
  assert.equal(facts([], [{ type, direction: "inbound", status: "failed" }])["history.reached"], false);
  assert.equal(facts([], [{ type, direction: "inbound", status: "received" }])["history.outreach_attempted"], false);
}
for (const op of ["eq", "neq", "equals", "not_equals"])
  for (const value of ["true", "false", true, false])
    assert.equal(statusListHistoryMatches(null, "history.reached", op, value), false);
assert.equal(statusListHistoryMatches(facts(), "history.typo", "neq", "true"), false);
assert.equal(statusListHistoryMatches(facts(), "history.reached", "eq", "false"), true);
assert.equal(statusListHistoryMatches(facts(), "history.reached", "eq", ""), false);
assert.equal(workflowConditionSchema.safeParse({ field: "history.reached", op: "empty" }).success, false);
assert.equal(workflowConditionSchema.safeParse({ field: "history.reached", op: "equals", value: "nope" }).success, false);
assert.equal(workflowConditionMatches({ field: "history.reached", op: "equals", value: "false" }, false), true);
assert.equal(workflowConditionMatches({ field: "history.reached", op: "not_equals", value: true }, undefined), false);
let queries = 0;
const client = { async query() { queries++; return { rows: [] }; } };
assert.equal(await loadStatusListHistoryFacts(client, "m", null), null);
assert.equal(queries, 0);
assert.equal(await loadStatusListHistoryFacts(client, "m", "unknown"), null);
assert.equal(queries, 1);
for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
  const copy = getStatusListHistoryCopy(locale);
  assert.equal(copy.fields.length, statusListHistoryFields.length);
  assert.ok(copy.fields.every(field => field.label && field.description && !field.description.includes("undefined")));
  assert.ok(copy.scope && copy.timing && copy.examples);
}
console.log("Status List history: policy, negative/unknown states, workflow validation and seven-language catalog passed");
