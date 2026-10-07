import assert from "node:assert/strict";
import { test } from "node:test";
import { validTaskActionRecipients, taskActionContent, taskActionDeadline } from "../../shared/automation-task-action";
import { planTaskActionRecipients } from "./automation-task-plan";
import { validateRuleCapabilities } from "./automation-capabilities";
import { validateAutomationActions } from "./automation-action-policy";
import { DEFAULT_TASK_MESSAGE_TEMPLATES, ensureTaskMessageTemplates, validTaskMessageTemplate } from "./task-message-templates";
import { taskTemplateContext } from "./task-template-variables";
import { templateVariableToken, taskSalutationFields } from "../../shared/task-template-variables";

test("mixed recipient selection is bounded, unique and cannot contain arbitrary metadata", () => {
  assert.equal(validTaskActionRecipients([{ kind: "user", id: "a" }, { kind: "group", id: "a" }, { kind: "role", id: "r" }]), true);
  for (const value of [[], null, [{ kind: "user", id: "" }], [{ kind: "department", id: "d" }],
    [{ kind: "user", id: "a", secret: "unexpected" }], [{ kind: "user", id: "a" }, { kind: "user", id: "a" }],
    Array.from({ length: 101 }, (_, i) => ({ kind: "user", id: `${i}` }))])
    assert.equal(validTaskActionRecipients(value), false);
});

test("groups share one task while user and role overlaps are deduplicated", async () => {
  const planned = await planTaskActionRecipients([
    { kind: "user", id: "b" }, { kind: "group", id: "g" },
    { kind: "role", id: "r" }, { kind: "role", id: "r2" },
  ], async recipient => ({
    userIds: recipient.kind === "user" ? [recipient.id] : ["a", "b"],
    tags: recipient.kind === "group" ? ["group_id:g", "group:Team", "back_office"] : [recipient.id],
    isBackOffice: recipient.kind === "group",
  }));
  assert.equal(planned.length, 3);
  assert.equal(planned.filter(plan => plan.groupId === "g").length, 1);
  assert.deepEqual(planned.filter(plan => !plan.groupId).map(plan => plan.owner).sort(), ["a", "b"]);
  assert.deepEqual(planned.find(plan => !plan.groupId && plan.owner === "b")!.tags.sort(), ["r", "r2"]);
});

test("an unavailable target rejects the whole plan and prevents partial writes", async () => {
  await assert.rejects(planTaskActionRecipients([{ kind: "user", id: "a" }, { kind: "group", id: "empty" }],
    async recipient => ({ userIds: recipient.kind === "user" ? ["a"] : [], tags: [], isBackOffice: false })), /authorized active/);
});

test("role fanout cannot create an unbounded number of tasks", async () => {
  await assert.rejects(planTaskActionRecipients([{ kind: "role", id: "huge" }],
    async () => ({ userIds: Array.from({ length: 101 }, (_, i) => `${i}`), tags: [], isBackOffice: false })), /100-task/);
});

test("relative deadlines use elapsed minutes, preserve weekends and recalculate per invocation", () => {
  const now = new Date("2026-10-09T23:45:00Z");
  assert.equal(taskActionDeadline({ dueInHours: 0.5 }, now)?.toISOString(), "2026-10-10T00:15:00.000Z");
  assert.equal(taskActionDeadline({ dueInHours: 24 }, now)?.getTime(), now.getTime() + 86400000);
  assert.equal(taskActionDeadline({ dueInHours: 2 }, new Date(now.getTime() + 1000))?.getTime(),
    now.getTime() + 1000 + 7200000);
  assert.equal(taskActionDeadline({}, now), null);
  assert.equal(taskActionDeadline({ dueInHours: 0 }, now), null);
  for (const dueInHours of [-1, Infinity, NaN, "abc", 1000000])
    assert.throws(() => taskActionDeadline({ dueInHours }, now));
});

test("fixed dates are timezone explicit and mutually exclusive with duration", () => {
  const now = new Date();
  assert.equal(taskActionDeadline({ dueAt: "2026-10-10T10:30:00+02:00" }, now)?.toISOString(), "2026-10-10T08:30:00.000Z");
  for (const dueAt of ["2026-10-10", "2026-10-10T10:30:00", "invalid", "2026-02-30T10:30:00Z", "2026-10-10T24:30:00Z"])
    assert.throws(() => taskActionDeadline({ dueAt }, now));
  assert.throws(() => taskActionDeadline({ dueAt: "2026-10-10T10:30:00Z", dueInHours: 24 }, now));
});

test("short context and task text remain visible on existing task cards", () => {
  assert.equal(taskActionContent({ description: " Context ", taskText: " Main instructions " }), "Context\n\nMain instructions");
  assert.equal(taskActionContent({ description: "Legacy description" }), "Legacy description");
  assert.equal(taskActionContent({ taskText: "" }), null);
});

const rule = (config: any, module = "task") => ({
  name: "Test", module, trigger: { type: "event", entityType: module, eventType: "created" },
  actions: [{ type: "create_task", config }],
});

test("save validation accepts mixed recipients and retains legacy targets", () => {
  assert.deepEqual(validateRuleCapabilities(rule({ title: "Review", taskText: "Check {{newValues.title}}",
    recipients: [{ kind: "user", id: "u" }, { kind: "group", id: "g" }, { kind: "role", id: "r" }], dueInHours: 0.5 })), []);
  assert.deepEqual(validateRuleCapabilities(rule({ title: "Legacy", assignedUserId: "u", dueInHours: 24 })), []);
  for (const module of ["customer", "clinic", "hospital", "collaborator", "contract", "invoice"])
    assert.deepEqual(validateRuleCapabilities(rule({ title: "Generic", taskText: "Check record",
      recipients: [{ kind: "user", id: "u" }] }, module)), []);
});

test("save validation rejects mixed legacy targets, bad dates and unavailable task variables", () => {
  for (const config of [
    { title: "X", recipients: [], taskText: "Text" },
    { title: "X", recipients: [{ kind: "user", id: "u" }], assignedUserId: "u" },
    { title: "X", assignedUserId: "u", dueInHours: -1 },
    { title: "X", assignedUserId: "u", dueAt: "2026-10-10T10:00:00" },
    { title: "X", assignedUserId: "u", taskText: "{{customer.password}}" },
    { title: "X", assignedUserId: "u", taskText: 123 },
  ]) assert.ok(validateRuleCapabilities(rule(config)).length > 0);
});

test("edited AI drafts support the same safe task action fields", () => {
  assert.deepEqual(validateAutomationActions([{ type: "create_task", config: {
    title: "Review", taskText: "Check", templateId: "template",
    recipients: [{ kind: "group", id: "g" }, { kind: "role", id: "r" }], dueInHours: 0.5,
  } }], "ai_draft"), []);
});

test("approved default templates seed only once and do not restore later deletions", async () => {
  const queries: string[] = [];
  await ensureTaskMessageTemplates({ query: async sql => queries.push(sql) });
  assert.equal(DEFAULT_TASK_MESSAGE_TEMPLATES.length, 7);
  assert.equal(queries.length, 1);
  assert.match(queries[0], /automation_template_seeds/);
  assert.match(queries[0], /ON CONFLICT \(id\) DO NOTHING RETURNING id/);
  assert.match(queries[0], /CROSS JOIN seed/);
  assert.equal(validTaskMessageTemplate({ name: "Task", content: "Text", format: "text" }), true);
  for (const body of [{ name: "", content: "Text" }, { name: "Task", content: "" },
    { name: "Task", content: "Text", format: "html" }, { name: "Task", content: "Text", contentHtml: "<p>Text</p>" }])
    assert.equal(validTaskMessageTemplate(body), false);
});

test("catalog paths and existing message keys insert exactly one pair of braces", () => {
  for (const value of ["newValues.firstName", "{{newValues.firstName}}", "{{{{newValues.firstName}}}}"])
    assert.equal(templateVariableToken(value), "{{newValues.firstName}}");
  assert.equal(templateVariableToken("{{customer.salutation}}"), "{{customer.salutation}}");
});

test("Task salutations use event names, template language and no fabricated identity", () => {
  const ctx = { event: { module: "customer", countryCode: "SK" }, newValues: { firstName: "Anna", lastName: "Nováková" } };
  assert.equal(taskTemplateContext(ctx).newValues.salutationFull, "Vážená pani");
  assert.equal(taskTemplateContext(ctx, "en").newValues.salutationFull, "Dear Ms.");
  assert.equal(taskTemplateContext(ctx, "cs").newValues.salutationDoc, "Vážená paní doktorko");
  assert.equal(ctx.newValues.hasOwnProperty("salutation"), false);
  assert.equal(taskTemplateContext({ event: { module: "clinic" }, newValues: {
    doctorFirstName: "Peter", doctorLastName: "Novák",
  } }).newValues.salutationDoc, "Vážený pán doktor");
  assert.equal(taskTemplateContext({ event: { module: "collaborator" }, newValues: {} }).newValues.salutation, "");
  for (const language of ["en", "sk", "cs", "hu", "ro", "it", "de"])
    assert.ok(taskTemplateContext(ctx, language).newValues.salutationFull);
  assert.equal(taskSalutationFields("task").length, 0);
  assert.equal(taskSalutationFields("customer", "schedule.tick").length, 0);
});

test("salutation variables are accepted only in supported event contexts", () => {
  const config = { title: "Contact", taskText: "{{newValues.salutationFull}}", assignedUserId: "u", templateLanguage: "sk" };
  for (const module of ["customer", "clinic", "collaborator"])
    assert.deepEqual(validateRuleCapabilities(rule(config, module)), []);
  assert.ok(validateRuleCapabilities(rule(config, "task")).length);
  assert.ok(validateRuleCapabilities(rule({ ...config, templateLanguage: "bad" }, "customer")).length);
});
