import assert from "node:assert/strict";
import { executeStatusListNativeService, canManageNativeMission, createStatusListServiceWriteGuard, resolveStatusListServiceAuthor } from "./status-list-native-service";
import { statusListNativeActionIssues, statusListNativeActionType } from "../../shared/status-list-service-config";

const input = { campaignId: "mission", campaignContactId: "membership", itemId: "item", userId: "agent", confirmationId: "confirmation" };
const owner = { id: "manager", role: "manager", assignedCountries: ["SK"], isActive: true };
const source = { campaign_name: "Mission", mission_countries: ["SK"], mission_settings: { smsProvider: "smstools" },
  contact_type: "clinic", entity_id: "clinic", country: "SK", name: "Test clinic",
  email: "contact@example.test", phone: "+421900000000" };
const configs = {
  send_email: { emailActionVersion: 2, senderMode: "personal", subject: "Unified", body: "<p>{{clinic.name}}</p>",
    to: "{{contact.email}}", toTargets: [{ kind: "group", id: "team" }],
    attachments: [{ name: "mission.pdf", contentType: "application/pdf", contentBase64: "cGRm" }] },
  update_record: { updateRecordVersion: 2, target: { mode: "event", entityType: "clinic" },
    fields: { notes: "Reviewed" }, acknowledged: true },
  assign_task: { title: "Task {{contact.name}}", taskText: "Details", recipients: [{ kind: "user", id: "participant" }], priority: "high", dueInHours: 24 },
  notify_role: { notificationActionVersion: 2, title: "Title", message: "{{contact.name}}", taskGroupId: "group" },
  send_email_group: { emailActionVersion: 2, senderMode: "personal", subject: "Subject", body: "<p>{{contact.name}}</p>",
    to: ["to@example.test"], cc: ["cc@example.test"], bcc: ["bcc@example.test"] },
  notify_email: { emailActionVersion: 2, senderMode: "system", subject: "Subject", body: "Body", toTargets: [{ kind: "role", id: "back_office" }] },
  send_contact_email: { emailActionVersion: 2, senderMode: "system", subject: "Subject", body: "Body", to: "{{contact.email}}" },
  send_sms: { smsActionVersion: 2, to: ["+421900000000"], text: "{{contact.name}}", provider: "smstools", kind: "transactional" },
};
function harness(options: { owner?: any; source?: any; duplicate?: string; result?: any; throwDelivery?: boolean; throwHistory?: boolean } = {}) {
  const calls: any[] = [], queries: any[] = [];
  return { calls, queries, deps: {
    query: async (sql: string, params?: any[]) => {
      queries.push({ sql, params });
      if (sql.includes("SELECT c.name")) return { rows: options.source === null ? [] : [options.source || source] };
      if (sql.includes("FROM users")) return { rows: options.owner === null ? [] : [options.owner || owner] };
      if (sql.includes("INSERT INTO status_list_service_executions")) return { rows: options.duplicate ? [] : [{ id: "run" }] };
      if (sql.includes("SELECT status,result")) return { rows: [{ status: options.duplicate }] };
      if (sql.includes("UPDATE status_list_service_executions") && options.throwHistory) throw Error("History unavailable");
      return { rows: [] };
    },
    execute: async (...args: any[]) => {
      calls.push(args);
      if (options.throwDelivery) throw Error("provider token recipient@example.test");
      return options.result || { ok: true, output: { taskIds: ["task"], sentCount: 1, recipient: "private@example.test" } };
    },
  } };
}
for (const [actionType, config] of Object.entries(configs)) {
  assert.deepEqual(statusListNativeActionIssues(actionType, config), [], actionType);
  const h = harness();
  const automation = { id: "automation", actionType, serviceActionConfig: config, serviceActionOwnerId: "manager" };
  const result = await executeStatusListNativeService(automation, input, h.deps);
  assert.equal(result.ok, true);
  assert.equal(h.calls.length, 1);
  const [type, sentConfig, ctx, runId] = h.calls[0];
  assert.equal(type, statusListNativeActionType(actionType));
  assert.equal(runId, "run");
  for (const [key, value] of Object.entries(config)) assert.deepEqual(sentConfig[key], value, `${actionType}.${key}`);
  assert.equal(ctx.rule.createdByUserId, "manager", "personal sender is saved author, not agent");
  assert.equal(ctx.event.actorUserId, "agent");
  assert.equal(ctx.contact.email, "contact@example.test");
  assert.equal(ctx.newValues.campaignId, "mission");
  assert.equal(ctx.event.countryCode, "SK");
  assert.equal(sentConfig.relatedEntityId, actionType === "assign_task" ? "item" : "clinic");
  assert.equal(sentConfig.customerId, null);
  assert.ok(h.queries[2].sql.includes("ON CONFLICT"));
  assert.ok(!JSON.stringify(result).includes("private@example.test"));
}
const sms = { id: "automation", actionType: "send_sms", serviceActionConfig: configs.send_sms, serviceActionOwnerId: "manager" };
{
  assert.deepEqual(statusListNativeActionIssues("send_email", configs.send_email), []);
  assert.equal(statusListNativeActionType("update_record"), "update_entity");
  assert.ok(statusListNativeActionIssues("update_record", { ...configs.update_record, target: { mode: "event", entityType: "customer" } }).length);
  assert.ok(statusListNativeActionIssues("update_record", { ...configs.update_record, acknowledged: false }).length);
  assert.ok(statusListNativeActionIssues("update_record", { ...configs.update_record, fields: { id: "forged" } }).length);
  assert.ok(statusListNativeActionIssues("update_record", null).length);
  assert.ok(statusListNativeActionIssues("send_email", null).length);
  const h = harness({ source: { ...source, contact_type: "hospital" } });
  const result = await executeStatusListNativeService({ ...sms, actionType: "update_record", serviceActionConfig: configs.update_record }, input, h.deps);
  assert.equal(result.error, "service_record_target_mismatch");
  assert.equal(h.calls.length, 0, "never update a guessed entity type");
  const hospital = harness({ source: { ...source, contact_type: "hospital" } });
  const resultHospital = await executeStatusListNativeService({ ...sms, actionType: "update_record", serviceActionConfig: {
    ...configs.update_record, target: { mode: "event", entityType: "hospital" }, fields: { autoRecruiting: true },
  } }, input, hospital.deps);
  assert.equal(resultHospital.ok, true);
  assert.equal(hospital.calls[0][0], "update_entity");
  assert.equal(hospital.calls[0][2].event.module, "hospital");
}
for (const duplicate of ["pending", "succeeded", "failed"]) {
  const h = harness({ duplicate });
  const result = await executeStatusListNativeService(sms, input, h.deps);
  assert.equal(result.duplicate, true);
  assert.equal(result.ok, duplicate === "succeeded");
  assert.equal(h.calls.length, 0, "never replay an already-started external effect");
}
for (const badOwner of [null, { ...owner, isActive: false }, { ...owner, role: "user" }, { ...owner, assignedCountries: ["CZ"] }]) {
  const h = harness({ owner: badOwner });
  assert.equal((await executeStatusListNativeService(sms, input, h.deps)).ok, false);
  assert.equal(h.calls.length, 0);
}
for (const badSource of [null, { ...source, entity_id: null }, { ...source, country: "CZ" },
  { ...source, country: null, mission_countries: ["SK", "CZ"] }]) {
  const h = harness({ source: badSource });
  assert.equal((await executeStatusListNativeService(sms, input, h.deps)).ok, false);
  assert.equal(h.calls.length, 0);
}
{
  const h = harness();
  const conflict = { ...sms, serviceActionConfig: { ...configs.send_sms, provider: "bulkgate" } };
  assert.equal((await executeStatusListNativeService(conflict, input, h.deps)).error, "service_gateway_conflict");
  assert.equal(h.calls.length, 0);
}
{
  const h = harness({ throwDelivery: true });
  const result = await executeStatusListNativeService(sms, input, h.deps);
  assert.equal(result.error, "service_action_failed");
  assert.ok(!JSON.stringify(h.queries.at(-1)).includes("recipient@example.test"));
}
{
  const h = harness({ throwHistory: true });
  await assert.rejects(executeStatusListNativeService(sms, input, h.deps));
  assert.equal(h.calls.length, 1, "history error must not resend");
}
{
  const h = harness();
  await executeStatusListNativeService({ ...sms, serviceActionConfig: {
    ...configs.send_sms, countryCode: "CZ", relatedEntityId: "other", createdByUserId: "forged",
  } }, input, h.deps);
  assert.equal(h.calls[0][1].countryCode, "SK");
  assert.equal(h.calls[0][1].relatedEntityId, "clinic");
  assert.equal(h.calls[0][1].createdByUserId, "agent");
}
for (const value of [true, false, "later"]) {
  const h = harness({ source: { ...source, question_id: "question", question_value: value, answer_revision: "revision" } });
  const result = await executeStatusListNativeService({ ...sms, conditionField: "answer", conditionValue: String(value) },
    { ...input, confirmationId: "answer:revision" }, h.deps);
  assert.equal(result.ok, true);
  assert.equal(h.calls.length, 1, "answer-specific actions include No/false");
}
{
  const h = harness({ source: { ...source, question_id: "question", question_value: true, answer_revision: "current" } });
  const result = await executeStatusListNativeService(sms, { ...input, confirmationId: "answer:old" }, h.deps);
  assert.equal(result.status, "answer_superseded");
  assert.equal(h.calls.length, 0);
}
{
  const h = harness({ source: { ...source, question_id: "question", question_value: false } });
  const result = await executeStatusListNativeService({ ...sms, conditionField: "answer", conditionValue: "yes" }, input, h.deps);
  assert.equal(result.status, "condition_false");
  assert.equal(h.calls.length, 0);
}
async function guardTest({ role = "manager", assignedCountries = ["SK"], config = configs.send_email_group,
  existing, actionType = "send_email_group", campaignFound = true }: any = {}) {
  let status = 200, next = false, response: any;
  const req: any = { method: existing ? "PUT" : "POST",
    params: { campaignId: "mission", itemId: "item", ...(existing ? { autoId: "action" } : {}) },
    session: { user: { id: "real-manager", role, assignedCountries } },
    body: { actionType, serviceActionConfig: config, serviceActionOwnerId: "forged" } };
  const res: any = { status: (value: number) => { status = value; return res; }, json: (value: any) => { response = value; } };
  const guard = createStatusListServiceWriteGuard({
    query: async sql => ({ rows: sql.includes("SELECT c.country_codes")
      ? campaignFound ? [{ country_codes: ["SK"] }] : [] : existing ? [existing] : [] }),
    gateway: async () => "smstools",
  });
  await guard(req, res, () => { next = true; });
  return { status, next, response, body: req.body };
}
assert.equal((await guardTest()).body.serviceActionOwnerId, "real-manager");
assert.equal((await guardTest({ role: "user" })).status, 403);
assert.equal((await guardTest({ assignedCountries: ["CZ"] })).status, 403);
assert.equal((await guardTest({ campaignFound: false })).status, 404);
assert.equal((await guardTest({ config: { ...configs.send_email_group, body: "" } })).status, 400);
assert.equal((await guardTest({ actionType: "send_sms", config: { ...configs.send_sms, provider: "bulkgate" } })).status, 400);
assert.equal((await guardTest({ existing: { action_type: "send_email_group",
  service_action_config: configs.send_email_group, service_action_owner_id: "original-author" } })).body.serviceActionOwnerId, "original-author");
{
  const query = async () => ({ rows: [{ owner_id: "saved-manager", country_codes: ["SK"] }] });
  const viewer = { id: "editing-manager", role: "manager", assignedCountries: ["SK"] };
  assert.deepEqual(await resolveStatusListServiceAuthor("action", viewer, { query }), { status: 200, ownerId: "saved-manager" });
  assert.equal((await resolveStatusListServiceAuthor("action", { ...viewer, assignedCountries: ["CZ"] }, { query })).status, 403);
  assert.equal((await resolveStatusListServiceAuthor("missing", viewer, { query: async () => ({ rows: [] }) })).status, 404);
  assert.deepEqual(await resolveStatusListServiceAuthor("legacy", viewer, {
    query: async () => ({ rows: [{ owner_id: null, country_codes: ["SK"] }] }),
  }), { status: 200, ownerId: "editing-manager" });
}
assert.equal(canManageNativeMission({ ...owner, role: "admin", assignedCountries: [] }, []), true);
assert.equal(canManageNativeMission(owner, ["SK", "CZ"]), false);
assert.equal(statusListNativeActionType("__proto__"), undefined);
assert.deepEqual(statusListNativeActionIssues("set_callback", null), []);
assert.ok(statusListNativeActionIssues("set_callback", configs.send_sms).length);
assert.ok(statusListNativeActionIssues("send_email_group", { ...configs.send_email_group, to: "broken" }).length);
assert.ok(statusListNativeActionIssues("assign_task", { ...configs.assign_task, assignedUserId: "conflict" }).length);
assert.ok(statusListNativeActionIssues("notify_role", { ...configs.notify_role, userId: "conflict" }).length);
assert.ok(statusListNativeActionIssues("send_sms", { ...configs.send_sms, to: ["broken"] }).length);
console.log("Status List native services: six mappings, exact native configs, saved sender, Mission/country/owner boundaries, privacy, reservation and no replay passed.");
