import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

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
  `${compiled}; return module.exports.registerStatusListWorkflowRoutes;`,
);
const register = construct({ exports: {} }, pool, {}, () => false, WorkflowError, () => {},
  async () => { inventories++; return { activationAllowed: false }; },
  () => null, { ZodError: class extends Error {} });
register(app, requireAuth);
const root = "/api/campaigns/:campaignId/status-list-workflows/transition-inventory";
const handlers = registered.get(`get ${root}`)!;
assert.equal(handlers[0], requireAuth);
for (const method of ["post", "put", "patch", "delete"]) assert.ok(!registered.has(`${method} ${root}`));

async function request(user?: Record<string, unknown>) {
  let status = 200, body: any;
  const headers = new Map();
  const req = { params: { campaignId: "mission" }, session: user ? { user } : undefined };
  const res = {
    setHeader(key: string, value: string) { headers.set(key, value); },
    status(code: number) { status = code; return res; },
    json(value: unknown) { body = value; },
  };
  await handlers[1](req, res);
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
assert.ok(reads.every(sql => /^\s*SELECT\b/i.test(sql)));
console.log("Transition route checks passed: real handler, auth/country boundaries, no-store, GET-only and release.");
