import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { and, eq } from "drizzle-orm";
import { communicationMessages } from "../../shared/schema";
import { availableOmniEmails } from "./omni-mailbox-group-routes";
import { resolveEmailMonitoringDetail } from "./email-monitoring-detail";
import { emailMonitoringFields } from "./ai/email-monitoring-contract";
import { monitoringSnapshot, readMonitoringSnapshot } from "./email-monitoring-record";

const analysis = { sentiment: "neutral" as const, hasInappropriateContent: false, hasAngryTone: false,
  hasRudeExpressions: false, wantsToCancel: false, wantsConsent: false, doesNotAcceptContract: true,
  alertLevel: "none" as const, note: "Zákazník odmieta novú ponuku, existujúcu službu ponecháva." };
function saved(source: unknown = { kind: "personal", ownerUserId: "agent-a" }) {
  return { externalId: "message-a", type: "email", direction: "inbound", ...emailMonitoringFields(analysis),
    metadata: JSON.stringify({ mailboxSource: source, emailMonitoringAnalysis: analysis }) };
}

const source = fs.readFileSync("server/routes.ts", "utf8");
const begin = source.indexOf('  app.get("/api/users/:userId/ms365-email/:emailId",');
const end = source.indexOf('  app.get("/api/users/:userId/ms365-email/:emailId/attachments/', begin);
assert.ok(begin > 0 && end > begin);
function harness(rows = [saved()], activeRule = true, snapshot: unknown = null) {
  const calls = { inventory: 0, graph: 0, candidates: 0, inference: 0, writes: 0, stored: 0 };
  let handler: any;
  let revoked = false;
  const storage = {
    getUserMs365Connection: async () => { calls.inventory++; return { isConnected: true,
      email: "agent@example.test", accessToken: "SYNTHETIC_TOKEN", refreshToken: null }; },
    getUserMs365SharedMailboxes: async () => [{ email: "shared@example.test", isActive: !revoked }],
    getAllEmailRoutingRules: async () => activeRule ? [{ isActive: true, enableAiAnalysis: true }] : [],
    findCustomersByEmail: async () => [], getEmailMetadata: async () => null,
  };
  const context = { app: { get: (_path: string, _auth: unknown, fn: unknown) => { handler = fn; } },
    requireAuth() {}, storage, availableOmniEmails, resolveEmailMonitoringDetail, communicationMessages, and, eq,
    loadStoredEmailMonitoring: async (scope: any) => { calls.stored++; return readMonitoringSnapshot(snapshot, scope); },
    db: { select: () => ({ from: () => ({ where: () => ({ limit: async (n: number) => {
      assert.equal(n, 101); calls.candidates++; return rows;
    } }) }) }) },
    analyzeEmailContent: async () => { calls.inference++; return null; },
    require: (name: string) => {
      if (name === "./lib/token-crypto") return { decryptTokenSafe: () => "SYNTHETIC" };
      if (name === "./lib/ms365") return {
        getValidAccessToken: async () => ({ accessToken: "SYNTHETIC" }),
        getEmailById: async () => { calls.graph++; return { id: "message-a", isRead: true,
          from: { emailAddress: { address: "sender@example.test" } }, subject: "Synthetic",
          body: { content: "Synthetic", contentType: "text" }, hasAttachments: false }; },
        markEmailAsRead: async () => { calls.writes++; },
      };
      throw Error(`Unexpected dependency: ${name}`);
    }, console: { log() {}, error() {} },
  };
  vm.runInNewContext(ts.transpile(source.slice(begin, end), { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022 }), context);
  async function call({ owner = "agent-a", mailbox = "personal" as any } = {}) {
    let status = 200, data: any, headers: any = {};
    const res = { status(code: number) { status = code; return res; },
      json(value: any) { data = value; return res; }, setHeader(key: string, value: string) { headers[key] = value; } };
    await handler({ params: { userId: owner, emailId: "message-a" },
      session: { user: { id: "agent-a" } }, query: { mailbox } }, res);
    return { status, data, headers };
  }
  return { calls, call, revoke() { revoked = true; } };
}
test("real detail handler returns stored monitoring independently of legacy sentiment and never calls AI", async () => {
  const h = harness(), response = await h.call();
  assert.equal(response.status, 200);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.deepEqual(response.data.emailMonitoringAnalysis.analysis, analysis);
  assert.equal(response.data.aiAnalysis, null);
  assert.equal(h.calls.inference, 0);
  assert.equal(h.calls.writes, 0);
});
test("the real handler reads an unlinked mailbox snapshot without a CRM row, model call or write", async () => {
  const h = harness([], true, monitoringSnapshot({ externalId: "message-a", mailbox: "agent@example.test",
    kind: "personal", ownerUserId: "agent-a" }, analysis));
  const response = await h.call();
  assert.equal(response.status, 200);
  assert.deepEqual(response.data.emailMonitoringAnalysis.analysis, analysis);
  assert.equal(response.data.linkedCustomer, null);
  assert.equal(h.calls.inference, 0); assert.equal(h.calls.writes, 0);
  assert.equal((await h.call({ owner: "another-user" })).status, 403);
  assert.equal(h.calls.stored, 1);
});
test("cross-user, ungranted and malformed mailbox requests stop before message or result reads", async () => {
  for (const input of [{ owner: "other" }, { mailbox: "foreign@example.test" }, { mailbox: ["personal"] }]) {
    const h = harness(), response = await h.call(input);
    assert.equal(response.status, Array.isArray(input.mailbox) ? 400 : 403);
    assert.equal(h.calls.graph, 0); assert.equal(h.calls.candidates, 0); assert.equal(h.calls.inference, 0);
  }
});
test("a shared-mailbox request cannot receive the user's personal monitoring result", async () => {
  const h = harness(undefined, false), response = await h.call({ mailbox: "shared@example.test" });
  assert.equal(response.status, 200);
  assert.equal(response.data.emailMonitoringAnalysis, null);
});
test("unmonitored emails retain the separately routed existing sentiment behavior", async () => {
  const h = harness([]), response = await h.call();
  assert.equal(response.status, 200);
  assert.equal(response.data.emailMonitoringAnalysis, null);
  assert.equal(h.calls.inference, 1);
});
test("a shared result is visible only while its mailbox grant remains active", async () => {
  const h = harness([saved({ kind: "system", mailboxEmail: "shared@example.test", countryCode: "SK" })]);
  const allowed = await h.call({ mailbox: "shared@example.test" });
  assert.equal(allowed.status, 200);
  assert.deepEqual(allowed.data.emailMonitoringAnalysis.analysis, analysis);
  h.revoke();
  assert.equal((await h.call({ mailbox: "shared@example.test" })).status, 403);
  assert.equal(h.calls.candidates, 1); assert.equal(h.calls.graph, 1); assert.equal(h.calls.inference, 0);
});
