import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { z } from "zod";

// Exercise the real registration/authorization functions without starting the
// monolithic app or contacting integrations. No alternate auth path is shipped.
const source = readFileSync(new URL("./status-list-workflow-routes.ts", import.meta.url), "utf8")
  .replace(/^import[\s\S]*?;\s*$/gm, "");
const compiled = transformSync(source, { loader: "ts", format: "cjs", target: "es2022" }).code;
class WorkflowError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
const registered = new Map<string, Function[]>();
const reads: string[] = [];
let connections = 0, releases = 0, inventories = 0;
let liveReads = 0, switches = 0;
let serviceReads = 0;
let exportFails = false;
const pool = {
  async query(sql: string) {
    reads.push(sql);
    return { rows: [{ country_codes: ["SK", "CZ"] }] };
  },
  async connect() {
    connections++;
    return { release() { releases++; } };
  },
};
const app: Record<string, Function> = {};
for (const method of ["get", "post", "put", "patch", "delete"])
  app[method] = (path: string, ...handlers: Function[]) => registered.set(`${method} ${path}`, handlers);
const requireAuth = () => {};
const construct = new Function(
  "module", "pool", "storage", "canAgentReadCampaignByWorkspaceCountry", "StatusListWorkflowError",
  "registerStatusListOrganizationRoutes", "readTransitionInventory", "medicalPartnerAudit", "z",
  "CallbackTransitionError", "readCallbackReadiness", "switchCallbackOwner",
  "readStatusListServiceHistory",
  "readTransitionExport",
  "readCallbackServiceStatus",
  `${compiled}; return module.exports.registerStatusListWorkflowRoutes;`,
);
const register = construct({ exports: {} }, pool, {}, () => false, WorkflowError, () => {},
  async () => { inventories++; return { activationAllowed: false }; },
  () => null, z, WorkflowError, async () => { liveReads++; return { owner: "legacy" }; },
  async () => { switches++; return { ok: true, owner: "compatible" }; },
  async () => { serviceReads++; return { events: [] }; },
  async () => {
    if (exportFails) throw new Error("simulated export failure");
    return { activationAllowed: false, format: "export" };
  }, async () => ({ activationAllowed: false, counts: { pending: 0, blocked: 0, done: 0, deferred: 0 }, group: null, cutovers: [] }));
register(app, requireAuth);
const root = "/api/campaigns/:campaignId/status-list-workflows/transition-inventory";
const handlers = registered.get(`get ${root}`)!;
assert.equal(handlers[0], requireAuth);
for (const method of ["post", "put", "patch", "delete"]) assert.ok(!registered.has(`${method} ${root}`));

async function request(user?: Record<string, unknown>, endpoint = `get ${root}`, input?: unknown) {
  let status = 200, body: any;
  const headers = new Map();
  const req = { params: { campaignId: "mission" }, session: user ? { user } : undefined, body: input, query: {} };
  const res = {
    setHeader(key: string, value: string) { headers.set(key, value); },
    status(code: number) { status = code; return res; },
    json(value: unknown) { body = value; },
  };
  await registered.get(endpoint)![1](req, res);
  assert.equal(headers.get("Cache-Control"), "no-store");
  return { status, body };
}
assert.equal((await request()).status, 401);
assert.equal((await request({ role: "user", assignedCountries: ["SK", "CZ"] })).status, 403);
assert.equal((await request({ role: "manager", assignedCountries: ["SK"] })).status, 403);
assert.equal(connections, 0);
assert.equal(inventories, 0);
const allowed = await request({ role: "manager", assignedCountries: ["SK", "CZ"] });
assert.equal(allowed.status, 200);
assert.equal(allowed.body.current.activationAllowed, false);
assert.equal(allowed.body.audited, null);
assert.equal((await request({ role: "admin" })).status, 200);
assert.equal(inventories, 2);
assert.equal(connections, 2);
assert.equal(releases, 2);
const exportRoot = root.replace("transition-inventory", "transition-export");
const exportEndpoint = `get ${exportRoot}`;
assert.equal(registered.get(exportEndpoint)![0], requireAuth);
for (const method of ["post", "put", "patch", "delete"]) assert.ok(!registered.has(`${method} ${exportRoot}`));
assert.equal((await request(undefined, exportEndpoint)).status, 401);
assert.equal((await request({ role: "user", assignedCountries: ["SK", "CZ"] }, exportEndpoint)).status, 403);
assert.equal((await request({ role: "manager", assignedCountries: ["SK"] }, exportEndpoint)).status, 403);
assert.equal(connections, 2);
const exported = await request({ role: "manager", assignedCountries: ["SK", "CZ"] }, exportEndpoint);
assert.equal(exported.status, 200);
assert.equal(exported.body.format, "export");
assert.equal(exported.body.activationAllowed, false);
assert.equal((await request({ role: "owner" }, exportEndpoint)).status, 200);
assert.equal(connections, 4);
assert.equal(releases, 4);
exportFails = true;
const failed = await request({ role: "admin" }, exportEndpoint);
assert.equal(failed.status, 500);
assert.deepEqual(failed.body, { error: "workflow_failed" });
assert.equal(connections, 5);
assert.equal(releases, 5);
assert.ok(reads.every(sql => /^\s*SELECT\b/i.test(sql)));
const live = `get ${root.replace("transition-inventory", "transition-readiness")}`;
const change = `post ${root.replace("transition-inventory", "transition-switch")}`;
const manager = { id: "manager", role: "manager", assignedCountries: ["SK", "CZ"] };
const serviceHistory = "get /api/campaigns/:campaignId/status-list-workflows/service-history";
assert.equal((await request(undefined, serviceHistory)).status, 401);
assert.equal((await request({ role: "user" }, serviceHistory)).status, 403);
assert.equal((await request({ ...manager, assignedCountries: ["SK"] }, serviceHistory)).status, 403);
assert.equal(serviceReads, 0, "unauthorized requests must not read service history");
assert.equal((await request(manager, serviceHistory)).status, 200);
assert.equal(serviceReads, 1);
const payload = { fingerprint: "a".repeat(64), expectedOwner: "legacy", targetOwner: "compatible",
  backupConfirmed: true, missionNameConfirmation: "Mission" };
assert.equal((await request(undefined, live)).status, 401);
assert.equal((await request({ role: "user", assignedCountries: ["SK", "CZ"] }, live)).status, 403);
assert.equal(liveReads, 0);
assert.equal((await request(manager, live)).status, 200);
assert.equal(liveReads, 1);
assert.equal(switches, 0, "GET/readiness must never call a switch");
assert.equal((await request(undefined, change, payload)).status, 401);
assert.equal((await request({ ...manager, assignedCountries: ["SK"] }, change, payload)).status, 403);
assert.equal((await request(manager, change, { ...payload, backupConfirmed: false })).status, 400);
assert.equal((await request(manager, change, { ...payload, audited: {}, productionLiveVerified: true })).status, 400);
assert.equal((await request(manager, change, { ...payload, fingerprint: "historical-sample" })).status, 400);
assert.equal(switches, 0);
assert.equal((await request(manager, change, payload)).status, 200);
assert.equal(switches, 1);
const runtime = `get ${root.replace("transition-inventory", "transition-runtime")}`;
assert.equal((await request(undefined, runtime)).status, 401);
assert.equal((await request({ role: "user" }, runtime)).status, 403);
assert.equal((await request({ ...manager, assignedCountries: ["SK"] }, runtime)).status, 403);
assert.equal((await request(manager, runtime)).body.activationAllowed, false);
console.log("Transition route checks passed: actual inventory/export/readiness/switch/service-history handlers, auth/country boundaries, strict payloads, no-store, no GET activation, export failure and release.");
