import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { emailActionIssues, emailAddressList } from "../../shared/automation-email-action";
import { addCountrySignature, renderEmailValue, renderEmailAddressConfig, resolveEmailRecipients, sanitizeAutomationEmail, selectAutomationEmailSender } from "./automation-email-policy";
import { sendAutomationGraphEmail } from "./automation-email-graph";
import { ensureAutomationEmailTemplates } from "./automation-email-templates";
import { validMessageTemplateCountries } from "./message-template-countries";
import { validateRuleCapabilities } from "./automation-capabilities";
import { automationEmailInlineAttachments } from "./automation-email-assets";

const config = { emailActionVersion: 2, senderMode: "system", subject: "Notice", body: "<p>Ready</p>", to: "primary@example.test" };
test("multiple users, groups, roles and raw addresses combine, deduplicate with To precedence", async () => {
  const calls: string[] = [];
  const plan = await resolveEmailRecipients({ ...config,
    to: "PRIMARY@example.test; ops@example.test",
    toTargets: [{ kind: "group", id: "first" }, { kind: "role", id: "Manager" }],
    cc: "ops@example.test, copy@example.test",
    ccTargets: [{ kind: "group", id: "first" }, { kind: "user", id: "c" }],
    bcc: "COPY@example.test; hidden@example.test",
  }, {
    group: async target => { calls.push(`${target.kind}:${target.id}`); return target.kind === "group" ? ["a", "b"] : ["b"]; },
    userEmail: async id => `${id}@example.test`,
  });
  assert.deepEqual(plan.to, ["primary@example.test", "ops@example.test", "a@example.test", "b@example.test"]);
  assert.deepEqual(plan.cc, ["copy@example.test", "c@example.test"]);
  assert.deepEqual(plan.bcc, ["hidden@example.test"]);
  assert.equal(plan.count, 7);
  assert.deepEqual(calls, ["group:first", "role:Manager"]);
});
test("missing or empty target blocks the whole recipient plan", async () => {
  await assert.rejects(resolveEmailRecipients({ ...config, toTargets: [{ kind: "group", id: "deleted" }] },
    { group: async () => [], userEmail: async () => "" }), /no active members/);
  await assert.rejects(resolveEmailRecipients({ ...config, ccTargets: [{ kind: "user", id: "no-email" }] },
    { group: async () => ["no-email"], userEmail: async () => "" }), /no valid email/);
});
test("recipient limits, address validity and sender settings are enforced", async () => {
  assert.deepEqual(emailAddressList("ONE@example.test; two@example.test one@example.test"), ["one@example.test", "two@example.test"]);
  assert.throws(() => emailAddressList("bad"), /invalid/);
  assert.throws(() => emailAddressList("{{newValues.email}}"), /unresolved/);
  assert.ok(emailActionIssues({ ...config, senderMode: "personal", includeSystemSignature: true }).length);
  assert.ok(emailActionIssues({ ...config, senderDisplayName: "spoof\r\nheader" }).length);
  assert.ok(emailActionIssues({ ...config, toTargets: [{ kind: "user", id: "{{actorUserId}}" }] }).length);
  await assert.rejects(resolveEmailRecipients({ ...config,
    to: Array.from({ length: 101 }, (_v, i) => `u${i}@example.test`) },
    { group: async () => [], userEmail: async () => "" }), /100-person/);
});
test("HTML template values are escaped and missing fields fail explicitly", () => {
  assert.equal(renderEmailValue("<p>{{newValues.name}}</p>", { newValues: { name: "<img onerror=bad>" } }, true),
    "<p>&lt;img onerror=bad&gt;</p>");
  assert.throws(() => renderEmailValue("{{newValues.email}}", { newValues: {} }), /unavailable/);
  assert.throws(() => renderEmailValue("{{constructor.name}}", {}), /unavailable/);
  assert.throws(() => renderEmailAddressConfig({ ...config, cc: "{{newValues.email}}" }, { newValues: {} }), /unavailable/);
  assert.equal(renderEmailAddressConfig({ ...config, cc: "{{newValues.email}}" }, { newValues: { email: "copy@example.test" } }).cc, "copy@example.test");
});
test("email sanitizer retains design and CID GIFs but strips executable content", () => {
  const safe = sanitizeAutomationEmail('<p style="color:red" onclick="bad()">Hello<script>bad()</script><img src="cid:indexus-automation-task"><a href="java&#x73;cript:bad()">bad</a><img src="/__mockup/image"></p>');
  assert.match(safe, /style="color:red"/);
  assert.match(safe, /cid:indexus-automation-task/);
  assert.doesNotMatch(safe, /onclick|script:|<script|\/__mockup/);
  const signed = addCountrySignature("<html><body><p>Message</p></body></html>", "<script>x</script>\nINDEXUS");
  assert.match(signed, /&lt;script&gt;x&lt;\/script&gt;<br>INDEXUS/);
  assert.match(signed, /INDEXUS<\/div><\/body>/);
  assert.equal(addCountrySignature("body", ""), "body");
});
test("country metadata is global or a valid unique operating-country list", () => {
  assert.equal(validMessageTemplateCountries([]), true);
  assert.equal(validMessageTemplateCountries(["SK", "CZ"]), true);
  assert.equal(validMessageTemplateCountries(["SK", "SK"]), false);
  assert.equal(validMessageTemplateCountries(["XX"]), false);
  assert.equal(validMessageTemplateCountries("SK"), false);
});
test("sender uses immutable author or actual event country, never actor/config/first rule country", () => {
  const ctx = { rule: { createdByUserId: "author", countryCodes: ["SK", "CZ"] },
    event: { actorUserId: "actor", countryCode: "CZ" } };
  assert.deepEqual(selectAutomationEmailSender({ senderMode: "personal", senderUserId: "spoof" }, ctx),
    { mode: "personal", authorId: "author", country: "CZ" });
  assert.deepEqual(selectAutomationEmailSender({ senderMode: "system", countryCode: "SK" }, ctx),
    { mode: "system", authorId: undefined, country: "CZ" });
  assert.throws(() => selectAutomationEmailSender({ senderMode: "personal" }, { event: ctx.event }), /known rule author/);
  assert.throws(() => selectAutomationEmailSender({ senderMode: "system", countryCode: "SK" }, { rule: ctx.rule }), /actual event country/);
});
test("copied email content validates independently of deleted template identity", () => {
  const rule = { name: "Notice", module: "customer", trigger: { type: "event", entityType: "customer", eventType: "created" }, actions: [
    { type: "send_email", config: { ...config, templateSnapshot: true, templateId: "deleted",
      taskGroupId: "group", toTargets: [{ kind: "role", id: "Manager" }] } },
  ] };
  assert.deepEqual(validateRuleCapabilities(rule), []);
  assert.ok(validateRuleCapabilities({ ...rule, actions: [
    { type: "send_email", config: { ...config, body: "{{rule.createdByUserId}}" } },
  ] }).length);
  assert.ok(emailActionIssues({ ...config, templateSnapshot: true, body: "" }).length);
});
test("Graph receives one mixed-recipient message and redacts vendor failures", async () => {
  let count = 0;
  await sendAutomationGraphEmail("dummy-token", { message: { toRecipients: ["one", "two"], ccRecipients: ["copy"] }, saveToSentItems: true },
    async (_url, options) => {
      count++;
      const payload = JSON.parse(String(options?.body));
      assert.equal(payload.message.toRecipients.length, 2);
      assert.equal(payload.message.ccRecipients.length, 1);
      return new Response(null, { status: 202 });
    });
  assert.equal(count, 1);
  await assert.rejects(sendAutomationGraphEmail("dummy", { message: {}, saveToSentItems: true },
    async () => new Response("recipient-private@example.test", { status: 403 })),
    error => error instanceof Error && error.message.includes("403") && !error.message.includes("@"));
});
test("approved defaults use a persistent seed marker and portable inline assets", async () => {
  const queries: string[] = [];
  await ensureAutomationEmailTemplates({ query: async sql => { queries.push(sql); } });
  assert.equal(queries.length, 8);
  assert.match(queries[0], /ON CONFLICT \(id\) DO NOTHING RETURNING id/);
  assert.match(queries[0], /country_codes/);
  assert.doesNotMatch(queries[0], /indexus-automation-email-(data-change|information)/);
  assert.match(queries[1], /approved-automation-emails-non-task/);
  assert.match(queries[1], /indexus-automation-email-data-change/);
  assert.match(queries[1], /indexus-automation-email-information/);
  assert.doesNotMatch(queries[1], /indexus-automation-email-(new-task|action-needed|completed|deadline)/);
  assert.match(queries[1], /ON CONFLICT \(id\) DO NOTHING RETURNING id/);
  const templates = JSON.parse(await readFile("server/assets/automation-email/templates.json", "utf8"));
  assert.equal(templates.length, 6);
  assert.equal(new Set(templates.map((template: any) => template.id)).size, 6);
  for (const template of templates) {
    assert.match(template.contentHtml, /cid:indexus-automation-/);
    assert.doesNotMatch(template.contentHtml, /\/__mockup\/|9. októbra 2026|SYSTEM_SIGNATURE_START|Slovensko · systémová schránka/);
    const assets = await automationEmailInlineAttachments(template.contentHtml);
    assert.equal(assets.length, 1);
    assert.equal(assets[0].isInline, true);
    assert.match(Buffer.from(assets[0].contentBytes, "base64").toString("ascii", 0, 6), /^GIF8/);
  }
  await assert.rejects(automationEmailInlineAttachments('<img src="cid:../../private">'), /unavailable/);
});
