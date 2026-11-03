import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createCustomerEmailHandler } from "./lib/customer-email-handler";
import { deliverAttributedEmail, resolveMissionEmailContext, missionEmailFields } from "./lib/mission-email-context";
import { insertCommunicationMessageSchema, sendEmailSchema } from "../shared/schema";

// Execute the actual registered handlers, not a copy of their sending logic.
// Only the provider/token boundary and persistence are mocked; no real email is sent.
const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
const paths = [
  "/api/ms365/send-email-from-mailbox", "/api/ms365/send-email", "/api/send-email",
  "/api/users/:userId/ms365-send-email", "/api/users/:userId/ms365-reply/:emailId",
  "/api/users/:userId/ms365-forward/:emailId",
];
function harness(path: string, options: { country?: string; denied?: boolean; unlinked?: boolean; failSave?: boolean; failSend?: boolean; noProvider?: boolean } = {}) {
  const rows: any[] = [];
  const sends: string[] = [];
  const pool = { query: async (sql: string, values: any[]) => {
    if (sql.includes("FROM message_templates")) return { rows: values[0] === "proposal-template" ? [{
      id: "proposal-template", name: "Proposal", type: "email", is_active: true,
      country_codes: ["SK"], email_purpose: "cooperation_proposal",
    }] : [] };
    if (sql.includes("FROM users u CROSS JOIN campaigns")) return { rows: options.denied || values[1] !== "mission" ? [] : [{
      role: "user", assigned: true, assigned_countries: ["SK"], country_codes: ["SK", "CZ"],
    }] };
    if (sql.includes("FROM campaign_contacts")) return { rows: options.unlinked ? [] : [{ id: "member" }] };
    if (sql.includes("FROM users WHERE")) return { rows: [{ role: "user", assigned_countries: ["SK"] }] };
    return { rows: [{ country_code: options.country ?? "SK" }] };
  } } as any;
  const storage = {
    async createCommunicationMessage(data: any) {
      if (options.failSave) throw new Error("save failed");
      const row = { ...insertCommunicationMessageSchema.parse(data), id: `message-${rows.length}` };
      rows.push(row); return row;
    },
    async updateCommunicationMessage(id: string, patch: any) { Object.assign(rows.find(r => r.id === id), patch); },
    async getUserMs365Connection() { return { isConnected: true, accessToken: "test-token", email: "personal@example.invalid" }; },
    async getSystemMs365Connection(country: string) {
      assert.equal(country, "SK"); return { accessToken: "test-token", email: "system@example.invalid" };
    },
    async getUserMs365SharedMailbox(id: string) {
      return { id, userId: id === "foreign" ? "other" : "agent", email: "shared@example.invalid" };
    },
    async getUserMs365SharedMailboxes() { return [{ email: "shared@example.invalid" }]; },
    async createActivityLog() {},
    async getCustomer(id: string) {
      return id === "customer" ? { id, email: "recipient@example.invalid", firstName: "Test", lastName: "Customer" } : null;
    },
    async findCustomersByEmail() { throw new Error("Mission must never be inferred by address"); },
  };
  function transport(name: string) {
    return async () => {
      assert.equal(rows.length, 1, "one durable envelope before transport");
      assert.equal(rows[0].status, "pending");
      sends.push(name);
      if (options.failSend) throw new Error("transport failed");
      return { conversationId: "conversation", externalId: "immutable-message",
        externalIdType: "immutable", internetMessageId: "<message@example.invalid>",
        sentAt: "2026-01-01T10:01:02.000Z", acceptedAt: new Date().toISOString(),
        sentAtSource: "ms365_sent_datetime", sentItemLocation: "originating_mailbox" };
    };
  }
  const provider = {
    getValidAccessToken: async () => ({ accessToken: "test-token" }),
    sendEmail: transport("personal"),
    sendEmailAndGetConversationId: transport("personal"),
    sendEmailFromSharedMailboxAndGetConversationId: transport("shared"),
    sendEmailFromSharedMailbox: transport("shared"),
    sendEmailWithSignature: transport("signature"),
    replyToEmail: transport("reply"),
    forwardEmail: transport("forward"),
  };
  let handler: any;
  const start = source.indexOf(`  app.post("${path}"`);
  assert.notEqual(start, -1);
  const terminator = source.slice(start, start + 160).includes("createCustomerEmailHandler(") ? "\n  }));" : "\n  });";
  const end = source.indexOf(terminator, start) + terminator.length;
  const script = ts.transpileModule(source.slice(start, end).replace(/await import\(/g, "await __import("), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  runInNewContext(script, {
    app: { post: (_path: string, ...handlers: any[]) => { handler = handlers.at(-1); } },
    requireAuth: () => {}, uploadEmailAttachment: { array: () => () => {} },
    storage, pool, resolveMissionEmailContext, deliverAttributedEmail, missionEmailFields, sendEmailSchema, createCustomerEmailHandler,
    process: { env: { SENDGRID_API_KEY: options.noProvider ? undefined : "test-only-not-a-credential" } },
    fetch: async () => { await transport("sendgrid")(); return { ok: true }; },
    logActivity: async () => {},
    console: { log() {}, error() {}, warn() {} },
    __import: async (module: string) => {
      if (module === "./lib/token-crypto") return { decryptTokenSafe: (token: string) => token };
      if (module === "./lib/ms365") return provider;
      if (module === "@microsoft/microsoft-graph-client") return {
        Client: { init: () => ({ api: () => ({
          top() { return this; }, orderby() { return this; }, select() { return this; },
          async get() { return { value: [] }; },
        }) }) },
      };
      throw new Error(`Unexpected dependency: ${module}`);
    },
  });
  return {
    rows, sends,
    async request(body: any, actor = "agent") {
      let status = 200;
      let json: any;
      const res = { status(code: number) { status = code; return this; }, json(data: any) { json = data; return this; } };
      await handler({ body, params: { userId: actor, emailId: "original", customerId: "customer" },
        session: { user: { id: "agent" }, ms365: { accessToken: "test-token" } } }, res);
      return { status, json };
    },
  };
}
const message = { to: ["recipient@example.invalid"], subject: "Subject", body: "Body",
  campaignId: "mission", customerId: "clinic", contactType: "clinic" };

for (const path of paths) {
  test(`${path}: carries server-owned template purpose and blocks an unknown template before sending`, async () => {
    const h = harness(path);
    assert.equal((await h.request({ ...message, emailTemplateId: "proposal-template", emailPurpose: "reminder" })).status, 200);
    const snapshot = JSON.parse(h.rows[0].metadata).missionEmail;
    assert.equal(snapshot.purpose, "cooperation_proposal");
    assert.equal(snapshot.templateId, "proposal-template");
    assert.equal(snapshot.campaignContactId, "member");
    const blocked = harness(path);
    assert.equal((await blocked.request({ ...message, emailTemplateId: "unknown" })).status, 403);
    assert.equal(blocked.sends.length, 0);
  });
  test(`${path}: stores exact Mission/entity and real timestamps before sending`, async () => {
    const h = harness(path);
    assert.equal((await h.request(message)).status, 200);
    assert.equal(h.sends.length, 1);
    assert.equal(h.rows.length, 1);
    assert.equal(h.rows[0].campaignId, "mission");
    assert.equal(h.rows[0].entityType, "clinic");
    assert.equal(h.rows[0].entityId, "clinic");
    assert.equal(h.rows[0].countryCode, "SK");
    assert.equal(h.rows[0].direction, "outbound");
    assert.equal(h.rows[0].status, "sent");
    assert.ok(h.rows[0].sentAt instanceof Date);
  });
  test(`${path}: foreign Mission, missing membership or actual foreign country never reaches provider`, async () => {
    for (const options of [{ denied: true }, { unlinked: true }, { country: "CZ" }]) {
      const h = harness(path, options);
      assert.equal((await h.request(message)).status, 403);
      assert.equal(h.sends.length, 0); assert.equal(h.rows.length, 0);
    }
    const h = harness(path);
    assert.equal((await h.request({ ...message, campaignId: "foreign" })).status, 403);
    assert.equal((await h.request({ ...message, campaignCountryCode: "CZ" })).status, 403);
    assert.equal(h.sends.length, 0);
  });
}
test("shared and system mailbox transports persist the same verified envelope; missing save blocks delivery", async () => {
  const path = paths[0];
  for (const [patch, transport] of [
    [{ mailboxId: "shared" }, "shared"], [{ useSystemMailbox: true }, "personal"],
  ] as const) {
    const h = harness(path);
    assert.equal((await h.request({ ...message, ...patch })).status, 200);
    assert.deepEqual(h.sends, [transport]);
    assert.equal(h.rows[0].entityType, "clinic");
    assert.equal(h.rows[0].campaignId, "mission");
    assert.equal(JSON.parse(h.rows[0].metadata).conversationId, "conversation");
    assert.equal(h.rows[0].externalId, "immutable-message");
    assert.equal(h.rows[0].sentAt.toISOString(), "2026-01-01T10:01:02.000Z");
    assert.equal(JSON.parse(h.rows[0].metadata).sendEvidence.sentAtSource, "ms365_sent_datetime");
    const blocked = harness(path, { failSave: true });
    assert.equal((await blocked.request({ ...message, ...patch })).status, 500);
    assert.equal(blocked.sends.length, 0);
  }
  const h = harness(path);
  assert.equal((await h.request({ ...message, mailboxId: "foreign" })).status, 400);
  assert.equal(h.sends.length, 0);
});
test("personal and email-client compose preserve the provider receipt without overwriting it afterward", async () => {
  for (const path of [paths[0], paths[1], paths[3]]) {
    const h = harness(path);
    assert.equal((await h.request(message)).status, 200);
    assert.equal(h.rows[0].externalId, "immutable-message");
    assert.equal(h.rows[0].sentAt.toISOString(), "2026-01-01T10:01:02.000Z");
    const metadata = JSON.parse(h.rows[0].metadata);
    assert.equal(metadata.conversationId, "conversation");
    assert.equal(metadata.sendEvidence.externalIdType, "immutable");
  }
});
test("standalone compose explicitly stays unassigned; failed provider retains the verified Mission", async () => {
  const h = harness(paths[0]);
  assert.equal((await h.request({ ...message, campaignId: null })).status, 200);
  assert.equal(h.rows[0].campaignId, null);
  assert.equal(h.rows[0].entityType, "clinic");
  const failed = harness(paths[0], { failSend: true });
  assert.equal((await failed.request(message)).status, 500);
  assert.equal(failed.rows[0].status, "failed");
  assert.equal(failed.rows[0].campaignId, "mission");
  assert.equal(failed.rows[0].sentAt, null);
});
test("user send/reply/forward cannot use someone else's connection", async () => {
  for (const path of paths.slice(3)) {
    const h = harness(path);
    assert.equal((await h.request(message, "other-user")).status, 403);
    assert.equal(h.sends.length, 0);
  }
});
test("both Pulse compose and inline reply carry the selected Mission; system country is not guessed", () => {
  const client = readFileSync(new URL("../client/src/pages/agent-workspace.tsx", import.meta.url), "utf8");
  for (const call of client.matchAll(/await sendEmailMutation\.mutateAsync\(\{([\s\S]*?)\n\s*\}\);/g)) {
    assert.match(call[1], /campaignId: selectedCampaignId \|\| undefined/);
    assert.doesNotMatch(call[1], /campaignCountryCode:.*countryCodes/);
  }
});

test("customer email also persists Mission and rejects a conflicting route target or country", async () => {
  const path = "/api/customers/:customerId/messages/email";
  const body = { ...message, customerId: "customer", contactType: "customer", content: "Body" };
  const h = harness(path);
  assert.equal((await h.request(body)).status, 200);
  assert.deepEqual(h.sends, ["sendgrid"]);
  assert.equal(h.rows[0].campaignId, "mission");
  assert.equal(h.rows[0].entityType, "customer");
  assert.equal(h.rows[0].entityId, "customer");
  for (const patch of [{ customerId: "other" }, { campaignId: "foreign" }, { campaignCountryCode: "CZ" }]) {
    const blocked = harness(path);
    assert.equal((await blocked.request({ ...body, ...patch })).status, 403);
    assert.equal(blocked.sends.length, 0);
  }
  const unconfigured = harness(path, { noProvider: true });
  assert.equal((await unconfigured.request(body)).status, 503);
  assert.equal(unconfigured.rows.length, 0, "no simulated sent row, even with a verified Mission");
  assert.equal(unconfigured.sends.length, 0);
});
