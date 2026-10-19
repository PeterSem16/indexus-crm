import assert from "node:assert/strict";
import { actionCopy, catalogFieldLabel, catalogOperatorLabel } from "../components/status-list-service-action-copy";
import {
  statusListActionDraft, statusListActionPayload, statusListActionDirty, statusListActionError,
  statusListServiceActions, type SavedStatusListAction,
} from "./status-list-action-draft";
const original: SavedStatusListAction = {
  id: "action", statusListItemId: "source", questionId: "question", sortOrder: 7, actionType: "assign_task",
  targetRole: "role:coordinator", taskGroupId: "saved-group", taskDescription: "Existing description", taskDeadlineOffset: "+48h", taskPriority: "high",
  assignNotify: true, assignNotifyChannels: ["email", "push"], emailRecipients: ["keep@example.invalid"], notifyAgentPulse: true,
  emailTemplateId: "saved-email", smsTemplateId: "saved-sms", smsProvider: "bulkgate",
  callbackOffsetDays: 4, callbackTime: "10:30", dispositionId: "saved-status", webhookTarget: "https://example.invalid",
  conditionField: null, conditionOperator: null, conditionValue: null, conditionJson: '{ "logic": "AND", "rules": [{"field":"country","op":"eq","value":"SK"}], "future":"keep" }',
  createdAt: new Date(), updatedAt: new Date(),
};
let checks = 0;
const check = (value: unknown, label: string) => { assert.ok(value, label); checks++; };
const draft = statusListActionDraft(original);
check(!statusListActionDirty(draft, original), "Opening the editor is not an edit");
check(draft.conditionMode === "compound", "Known condition rules are editable");
const payload = statusListActionPayload({ ...draft, taskDescription: "Reviewed" }, original);
check(payload.conditionJson === original.conditionJson, "Unedited condition bytes remain exactly unchanged");
for (const key of ["emailRecipients", "notifyAgentPulse", "assignNotify", "assignNotifyChannels", "smsProvider", "smsTemplateId", "emailTemplateId", "callbackTime", "dispositionId", "sortOrder"] as const)
  check(JSON.stringify(payload[key]) === JSON.stringify(original[key]), `Editing task text preserves ${key}`);
for (const key of ["id", "statusListItemId", "questionId", "createdAt", "updatedAt"]) check(!(key in payload), `No read-only/ownership field ${key} is round-tripped`);
check(payload.taskDescription === "Reviewed", "The changed field is updated");
check(original.taskDescription === "Existing description", "Serialization never mutates original data");
for (const conditionJson of ['{broken', '{"futureMode":"x","rules":{}}', '{"__type":"field_changed_to","field":"country","value":false}']) {
  const action = { ...original, conditionJson };
  const saved = statusListActionDraft(action);
  check(saved.conditionMode === "stored", "Unknown or malformed conditions are visibly retained");
  check(statusListActionPayload({ ...saved, taskDescription: "Reviewed" }, action).conditionJson === conditionJson, "Unrelated edits never turn unknown conditions into always");
}
const legacy = { ...original, conditionJson: null, conditionField: "custom_future_field", conditionOperator: "neq", conditionValue: "keep" };
check(statusListActionDraft(legacy).conditionMode === "stored", "Unsupported legacy field predicates do not become always");
check(statusListActionPayload({ ...statusListActionDraft(legacy), taskDescription: "Reviewed" }, legacy).conditionOperator === "neq", "Legacy operators survive unrelated edits");
const changed = statusListActionPayload({ ...draft, conditionLogic: "OR" }, original);
check(JSON.parse(changed.conditionJson as string).future === "keep" && JSON.parse(changed.conditionJson as string).logic === "OR", "Known condition edits retain extension metadata");
const clear = statusListActionPayload({ ...draft, conditionMode: "always" }, original);
check(clear.conditionJson === null && clear.conditionField === null, "Explicitly choosing always removes the old predicate");
const country = statusListActionPayload({ ...draft, conditionMode: "country", conditionCountry: "CZ" }, original);
check(country.conditionField === "country" && country.conditionValue === "CZ" && country.conditionOperator === "eq" && country.conditionJson === null, "Country mode uses the existing legacy encoding");
const answer = statusListActionPayload({ ...draft, conditionMode: "answer", conditionAnswer: "yes" }, original);
check(answer.conditionField === "answer" && answer.conditionValue === "yes", "Legacy answer predicates stay editable");
const field = statusListActionPayload({ ...draft, conditionMode: "field_changed_to", fieldChangedKey: "contact.contract_signed", fieldChangedValue: "false" }, original);
check(JSON.parse(field.conditionJson as string).__type === "field_changed_to" && JSON.parse(field.conditionJson as string).value === "false", "Current-value predicates preserve string booleans");
for (const type of statusListServiceActions) check(statusListActionDraft(undefined, type).actionType === type, `All nine service types remain available: ${type}`);
let fresh = statusListActionDraft(undefined, "set_callback");
check(statusListActionPayload({ ...fresh, callbackOffsetDays: "3" }).callbackOffsetDays === 3, "Callback delays serialize as integers");
for (const days of ["", "-1", "1.5", "Infinity", "9007199254740992"]) check(statusListActionError({ ...fresh, callbackOffsetDays: days }) === "callback", "Invalid callback offsets cannot silently default");
check(statusListActionError({ ...fresh, callbackOffsetDays: "0" }) === null, "Same-day callback remains supported");
const status = { ...original, actionType: "set_contact_status", dispositionId: "old-status", callbackOffsetDays: null, callbackTime: null };
const statusDraft = { ...statusListActionDraft(status), dispositionId: "callback-status" };
check(statusListActionPayload(statusDraft, status, null, true).callbackTime === "09:00"
  && statusListActionPayload(statusDraft, status, null, true).callbackOffsetDays === 1, "Choosing a callback disposition persists its displayed defaults");
check(statusListActionError({ ...statusDraft, callbackTime: "25:80" }, true) === "callback", "Invalid fixed callback times cannot save");
fresh = statusListActionDraft(undefined, "send_sms");
check(statusListActionPayload({ ...fresh, smsProvider: "bulkgate", taskDescription: "Synthetic" }, undefined, "smstools").smsProvider === null, "Mission SMS policy remains authoritative");
check(statusListActionPayload({ ...fresh, smsProvider: "bulkgate", taskDescription: "Synthetic" }).smsProvider === "bulkgate", "Explicit gateway works only without Mission policy");
check(statusListActionError(fresh) === "sms", "An empty SMS cannot be saved as a send action");
fresh = statusListActionDraft(undefined, "notify_email");
check(statusListActionError({ ...fresh, emailRecipients: "not-an-email" }) === "email", "Invalid explicit email addresses are rejected");
check(statusListActionPayload({ ...fresh, emailRecipients: "one@example.invalid;two@example.invalid\nthree@example.invalid" }).emailRecipients instanceof Array, "Multiple email recipients serialize to the existing array");
fresh = statusListActionDraft(undefined, "sys_webhook");
check(statusListActionError({ ...fresh, webhookTarget: "javascript:alert(1)" }) === "webhook", "Webhook configuration rejects executable URI schemes");
check(statusListActionError({ ...fresh, webhookTarget: "https://example.invalid/hook" }) === null, "HTTPS webhooks remain supported");
check(statusListActionError({ ...draft, conditionRules: [] }) === "condition", "Empty compound conditions require explicit always instead");
for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
  for (const key of ["title", "safety", "stored"]) check(actionCopy(locale, key) !== key, `${locale}: localized editor copy ${key}`);
  for (const field of ["call_count", "days_in_status", "last_call_outcome", "country", "has_email", "has_phone", "is_pregnant", "due_date_weeks", "segment", "answer_is_yes", "answer_for_question", "hour_of_day", "day_of_week", "dispositions_count", "assigned_status_code", "contact.status_code", "contact.segment", "contact.contract_signed", "contact.hospital_id", "contact.clinic_id", "contact.days_since_last_change"])
    check(catalogFieldLabel(locale, field, "UNTRANSLATED") !== "UNTRANSLATED", `${locale}: localized condition field ${field}`);
  for (const op of ["eq", "neq", "contains", "gt", "lt", "gte", "lte"])
    check(catalogOperatorLabel(locale, op, "UNTRANSLATED") !== "UNTRANSLATED", `${locale}: localized operator ${op}`);
}
console.log(`Status List action draft: ${checks} assertions passed`);
