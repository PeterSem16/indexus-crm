import assert from "node:assert/strict";
import test from "node:test";
import { emailActionIssues } from "../../shared/automation-email-action";
import { statusListNativeActionIssues } from "../../shared/status-list-service-config";
import { resolveAutomationEmailCardRecipients as expand } from "./automation-email-card-recipients";
import { resolveEmailRecipients } from "./automation-email-policy";
import { automationEmailCardRecipientCopy } from "../../client/src/i18n/automation-email-card-recipient-translations";

const base = { emailActionVersion: 2, senderMode: "personal", subject: "Notice", body: "<p>Message</p>", to: "" };
const context = { event: { entityType: "clinic", entityId: "owned-card", countryCode: "SK" },
  contact: { type: "clinic", id: "owned-card" } };
const query = async (sql: string, values: any[]) => {
  if (sql.includes("FROM clinics")) {
    assert.deepEqual(values, ["owned-card"]);
    return { rows: [{ email: "Main@example.test", country_code: "SK" }] };
  }
  assert.deepEqual(values, ["clinic", "owned-card"]);
  assert.match(sql, /a\.is_active=true AND p\.is_active=true/);
  assert.match(sql, /a\.start_date<=now\(\)/);
  assert.match(sql, /a\.end_date>now\(\)/);
  return { rows: [{ email: "person@example.test" }, { email: "MAIN@example.test" }] };
};
const deps = { group: async () => [], userEmail: async () => "person@example.test" };

test("card sources validate and satisfy required To without altering old actions", () => {
  assert.deepEqual(emailActionIssues({ ...base, toCardSources: ["persons"] }), []);
  assert.deepEqual(statusListNativeActionIssues("send_email", { ...base, toCardSources: ["main", "persons"] }), []);
  for (const invalid of [null, "main", ["other"], ["main", "main"], [{ entityId: "foreign" }]])
    assert.ok(emailActionIssues({ ...base, toCardSources: invalid }).some(issue => issue.includes("card recipients")));
  assert.ok(emailActionIssues(base).some(issue => issue.includes("To recipient")));
  for (const copy of Object.values(automationEmailCardRecipientCopy))
    assert.deepEqual(Object.keys(copy), Object.keys(automationEmailCardRecipientCopy.en));
});

test("legacy or empty card sources do not query cards or change configured recipients", async () => {
  const old = { ...base, to: "old@example.test" };
  assert.equal(await expand(old, {}, async () => { throw new Error("must not query"); }), old);
  const empty = { ...old, toCardSources: [] };
  assert.equal(await expand(empty, {}, async () => { throw new Error("must not query"); }), empty);
});

test("main only, Persons only and both load actual addresses and never trust draft identity", async () => {
  const main = await expand({ ...base, toCardSources: ["main"], entityId: "foreign" }, context, query);
  assert.equal(main.to, "main@example.test");
  const persons = await expand({ ...base, toCardSources: ["persons"] }, context, query);
  assert.equal(persons.to, "person@example.test, main@example.test");
  const input = { ...base, to: "manual@example.test", toCardSources: ["main", "persons"] };
  const before = structuredClone(input);
  assert.equal((await expand(input, context, query)).to, "manual@example.test, main@example.test, person@example.test");
  assert.deepEqual(input, before);
});

test("common planner deduplicates card, user, manual and CC/BCC addresses with To precedence", async () => {
  const config = await expand({ ...base, toCardSources: ["main"], toTargets: [{ kind: "user", id: "agent" }],
    ccCardSources: ["persons"], cc: "copy@example.test", bcc: "MAIN@example.test; hidden@example.test" }, context, query);
  assert.deepEqual(await resolveEmailRecipients(config, deps), {
    to: ["main@example.test", "person@example.test"], cc: ["copy@example.test"], bcc: ["hidden@example.test"], count: 4,
  });
});

test("missing identities, cross-country/deleted cards and mismatched parent contacts fail before sending", async () => {
  const config = { ...base, toCardSources: ["persons"] };
  for (const bad of [{}, { event: { ...context.event, entityType: "customer" } },
    { event: { ...context.event, countryCode: undefined } },
    { ...context, contact: { id: "other", type: "clinic" } }])
    await assert.rejects(() => expand(config, bad, query), /verified|conflicts/);
  await assert.rejects(() => expand(config, { event: { ...context.event, countryCode: "CZ" } }, query), /country/);
  await assert.rejects(() => expand(config, context, async () => ({ rows: [] })), /no longer exists/);
  await assert.rejects(() => expand({ ...base, toCardSources: ["anyone"] }, context, query), /Invalid/);
});

test("empty eligible persons, invalid addresses and combined recipient limits fail explicitly", async () => {
  const onlyCard = async (sql: string) => ({ rows: sql.includes("FROM clinics")
    ? [{ email: "main@example.test", country_code: "SK" }] : [] });
  await assert.rejects(() => expand({ ...base, toCardSources: ["persons"] }, context, onlyCard), /no available/);
  // With both selected, an institution that has no eligible people still has its main email.
  assert.equal((await expand({ ...base, toCardSources: ["main", "persons"] }, context, onlyCard)).to, "main@example.test");
  await assert.rejects(() => expand({ ...base, toCardSources: ["main"] }, context, async () =>
    ({ rows: [{ email: "invalid", country_code: "SK" }] })), /invalid/);
  await assert.rejects(() => expand({ ...base, toCardSources: ["persons"] }, context, async sql =>
    ({ rows: sql.includes("FROM clinics") ? [{ country_code: "SK" }] :
      Array.from({ length: 101 }, (_, i) => ({ email: `p${i}@example.test` })) })), /100-person/);
  const expanded = await expand({ ...base, toCardSources: ["main"], cc:
    Array.from({ length: 100 }, (_, i) => `p${i}@example.test`).join(",") }, context, query);
  await assert.rejects(() => resolveEmailRecipients(expanded, deps), /100-person/);
});
