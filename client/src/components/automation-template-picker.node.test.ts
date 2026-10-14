import assert from "node:assert/strict";
import test from "node:test";
import { classifySource, classifyMeanings } from "./automation-template-picker";
import { automationTemplatePickerCopy } from "../../../shared/automation-template-picker-copy";

test("source is the trigger, never the delivery channel; legacy analysis remains channel agnostic", () => {
  for (const [id, source] of [
    ["indexus-activity-email-analysis-task-positive-en", "tasks"],
    ["indexus-activity-task-analysis-email-negative-en", "email"],
    ["indexus-activity-sms-analysis-outbound-tone-angry-en", "calls"],
    ["indexus-activity-notification-clinic-created-en", "records"],
    ["indexus-automation-email-analysis-negative-sentiment-sk", "analysis"],
    ["indexus-sms-template-analysis-angry-tone-sk", "analysis"],
  ]) assert.equal(classifySource({ id, name: id }), source);
});
test("tone and sentiment are distinct, and a failed call is neither sentiment nor success", () => {
  const template = (id: string) => ({ id, name: id, content: "{{analysis.tone}} {{analysis.sentiment}}" });
  assert.deepEqual(classifyMeanings(template("indexus-activity-email-analysis-inbound-tone-calm-sk")), ["tone"]);
  assert.deepEqual(classifyMeanings(template("indexus-activity-email-analysis-inbound-sentiment-neutral-sk")), ["sentiment"]);
  assert.deepEqual(classifyMeanings(template("indexus-activity-email-call-outbound-unanswered-sk")), []);
  assert.deepEqual(classifyMeanings(template("indexus-activity-email-task-task-completed-sk")), ["success"]);
});
test("source and meaning labels are translated across all seven languages", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"])
    for (const key of ["calls", "tasks", "email", "analysis", "sentiment", "tone"])
      assert.ok(automationTemplatePickerCopy(locale, key).trim());
});
