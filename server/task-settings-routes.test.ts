import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import test from "node:test";
import vm from "node:vm";
import express from "express";
import ts from "typescript";
import { createRequirePersistedAdmin, isPersistedAdministrator } from "./lib/admin-authorization";

// Execute the actual route declarations and middleware from routes.ts rather
// than reconstructing route wiring in the test. Database operations are isolated
// so this authorization regression never changes real groups or users.
const source = readFileSync("server/routes.ts", "utf8");
const ast = ts.createSourceFile("routes.ts", source, ts.ScriptTarget.Latest, true);
let requireAuthSource = "";
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "requireAuth" && node.initializer) {
    requireAuthSource = node.initializer.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(requireAuthSource, "actual requireAuth middleware must exist");
const start = source.indexOf("  // ─── Task Groups API");
const end = source.indexOf("  // Shared policy for task listing", start);
assert.ok(start >= 0 && end > start, "actual Tasks group route block must exist");
const compiledRoutes = ts.transpileModule(
  `const requireAuth = ${requireAuthSource};\n${source.slice(start, end)}`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;

const protectedEndpoints = [
  { method: "GET", path: "/api/task-settings/groups" },
  { method: "GET", path: "/api/task-settings/groups/group-1" },
  { method: "GET", path: "/api/task-settings/users" },
  { method: "POST", path: "/api/task-groups", body: { name: "Group", memberUserIds: ["member-1"] } },
  { method: "PUT", path: "/api/task-groups/group-1", body: { name: "Updated", memberUserIds: ["member-1"], sortOrder: 2 } },
  { method: "DELETE", path: "/api/task-groups/group-1" },
  { method: "PUT", path: "/api/task-groups-reorder", body: { order: [{ id: "group-1", sortOrder: 1 }] } },
  { method: "PUT", path: "/api/task-groups-reorder-role", body: { role: "user", order: [{ id: "group-1", sortOrder: 2 }] } },
  { method: "DELETE", path: "/api/task-groups-reorder-role/user" },
  { method: "POST", path: "/api/task-groups/group-1/members/member-1" },
  { method: "DELETE", path: "/api/task-groups/group-1/members/member-1" },
] as const;

test("Tasks settings HTTP routes enforce fresh persisted administrator authorization on every endpoint", async () => {
  const group = { id: "group-1", name: "Group", sortOrder: 0 };
  const tables = {
    taskGroups: { id: "id", name: "name", sortOrder: "sortOrder" },
    taskGroupMembers: { groupId: "groupId", userId: "userId" },
    taskGroupRoleSortOrders: { groupId: "groupId", role: "role" },
    users: { id: "id", fullName: "fullName", username: "username", avatarUrl: "avatarUrl" },
  };
  type Actor = { id: string; role: string; roleId?: string; isActive: boolean };
  const actors: Record<string, Actor> = {
    admin: { id: "admin", role: "admin", isActive: true },
    customAdmin: { id: "customAdmin", role: "user", roleId: "administrator-role", isActive: true },
    manager: { id: "manager", role: "manager", isActive: true },
    user: { id: "user", role: "user", isActive: true },
    namedAdmin: { id: "namedAdmin", role: "user", roleId: "admin-display-name", isActive: true },
    customManager: { id: "customManager", role: "user", roleId: "manager-role", isActive: true },
    inactive: { id: "inactive", role: "admin", isActive: false },
    missingRole: { id: "missingRole", role: "user", roleId: "deleted-role", isActive: true },
    revoked: { id: "revoked", role: "admin", isActive: true },
  };
  const roles: Record<string, { name: string; legacyRole: string | null }> = {
    "administrator-role": { name: "Operations lead", legacyRole: "admin" },
    "admin-display-name": { name: "Admin", legacyRole: "user" },
    "manager-role": { name: "Manager", legacyRole: "manager" },
  };
  let authorizationReads = 0;
  let settingsOperations = 0;
  let failUserLookup = false;
  let failRoleLookup = false;
  const storage = {
    async getUser(id: string) {
      authorizationReads++;
      if (failUserLookup) throw new Error("Test actor lookup failure");
      return actors[id];
    },
    async getRole(id: string) {
      authorizationReads++;
      if (failRoleLookup) throw new Error("Test role lookup failure");
      return roles[id];
    },
    async createTaskGroupWithMembers() { settingsOperations++; return group; },
    async updateTaskGroupWithMembers() { settingsOperations++; return group; },
    async addTaskGroupMember() { settingsOperations++; return true; },
  };
  function query() {
    let rows: unknown[] = [];
    const chain = {
      from(table: unknown) { rows = table === tables.taskGroups ? [group] : []; return chain; },
      where() { return chain; },
      limit() { return chain; },
      orderBy() { return chain; },
      set() { return chain; },
      values() { return chain; },
      then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve(rows).then(resolve, reject);
      },
    };
    settingsOperations++;
    return chain;
  }
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const actorId = req.header("x-test-actor");
    (req as any).session = actorId ? {
      // All non-admin sessions claim admin. Persisted records must win.
      user: { id: actorId, role: actorId === "customAdmin" ? "user" : "admin", roleId: "administrator-role" },
    } : {};
    next();
  });
  vm.runInNewContext(compiledRoutes, {
    app, storage, ...tables,
    db: { select: query, update: query, delete: query, insert: query },
    eq: () => null, and: () => null,
    createRequirePersistedAdmin, isPersistedAdministrator,
    taskAssignmentAllowlist: async () => ({ configured: false, allowedUserIds: [], updatedAt: null }),
    console: { error() {} },
  });
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  async function request(actorId: string | undefined, endpoint: { method: string; path: string; body?: unknown }) {
    const response = await fetch(`${baseUrl}${endpoint.path}`, {
      method: endpoint.method,
      headers: { "content-type": "application/json", ...(actorId ? { "x-test-actor": actorId } : {}) },
      ...(endpoint.body === undefined ? {} : { body: JSON.stringify(endpoint.body) }),
    });
    const body = await response.json();
    return { response, body };
  }

  try {
    for (const endpoint of protectedEndpoints) {
      for (const actorId of [undefined, "manager", "user", "namedAdmin", "customManager", "inactive", "missingRole", "deleted-user"]) {
        const before = settingsOperations;
        const { response, body } = await request(actorId, endpoint);
        assert.equal(response.status, actorId ? 403 : 401, `${actorId}: ${endpoint.method} ${endpoint.path}`);
        assert.equal(body.error, actorId ? "Admin access required" : "Unauthorized");
        assert.equal(settingsOperations, before, "denied requests must not read or mutate settings");
      }
      for (const actorId of ["admin", "customAdmin"]) {
        const before = settingsOperations;
        const { response } = await request(actorId, endpoint);
        assert.equal(response.status, 200, `${actorId}: ${endpoint.method} ${endpoint.path}`);
        assert.ok(settingsOperations > before, "authorized requests must reach the real route handler");
      }
    }
    const assignmentSettings = await request("admin", { method: "GET", path: "/api/task-settings/users" });
    assert.deepEqual(Object.keys(assignmentSettings.body).sort(), ["allowedUserIds", "configured", "updatedAt", "users"]);
    assert.equal(assignmentSettings.body.configured, false);
    assert.deepEqual(assignmentSettings.body.allowedUserIds, []);
    assert.deepEqual(assignmentSettings.body.users, []);
    assert.equal(assignmentSettings.body.updatedAt, null);

    // Management lists use the exact same shape as operational group lists.
    const operational = await request("user", { method: "GET", path: "/api/task-groups" });
    const management = await request("admin", { method: "GET", path: "/api/task-settings/groups" });
    assert.deepEqual(management.body, operational.body);
    for (const path of ["/api/task-groups", "/api/task-groups/group-1"]) {
      for (const actorId of ["user", "manager"]) {
        assert.equal((await request(actorId, { method: "GET", path })).response.status, 200);
      }
      assert.equal((await request(undefined, { method: "GET", path })).response.status, 401);
    }

    assert.equal((await request(undefined, { method: "GET", path: "/api/task-settings/access" })).response.status, 401);
    for (const actorId of Object.keys(actors)) {
      const { response, body } = await request(actorId, { method: "GET", path: "/api/task-settings/access" });
      assert.equal(response.status, 200);
      assert.deepEqual(body, { canManage: ["admin", "customAdmin", "revoked"].includes(actorId) });
      assert.equal(response.headers.get("cache-control"), "no-store");
    }

    // A current session cannot retain management access after demotion.
    assert.equal((await request("revoked", protectedEndpoints[0])).response.status, 200);
    actors.revoked.role = "manager";
    for (const endpoint of protectedEndpoints) {
      const before = settingsOperations;
      assert.equal((await request("revoked", endpoint)).response.status, 403);
      assert.equal(settingsOperations, before);
    }
    assert.deepEqual((await request("revoked", { method: "GET", path: "/api/task-settings/access" })).body, { canManage: false });

    // Authorization precedes handler payload validation, including inline
    // membership replacement and ordering fields.
    for (const endpoint of protectedEndpoints.filter(endpoint => ["POST", "PUT"].includes(endpoint.method))) {
      assert.equal((await request("manager", { ...endpoint, body: {} })).response.status, 403);
    }
    assert.ok(authorizationReads > 0);

    // Database errors fail closed, never silently granting settings access.
    failUserLookup = true;
    for (const endpoint of protectedEndpoints) {
      const before = settingsOperations;
      assert.equal((await request("admin", endpoint)).response.status, 500);
      assert.equal(settingsOperations, before);
    }
    assert.equal((await request("admin", { method: "GET", path: "/api/task-settings/access" })).response.status, 500);
    failUserLookup = false;
    failRoleLookup = true;
    for (const endpoint of protectedEndpoints) {
      const before = settingsOperations;
      assert.equal((await request("customAdmin", endpoint)).response.status, 500);
      assert.equal(settingsOperations, before);
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});