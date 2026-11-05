import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { registerOmniMailboxGroupRoutes } from "./omni-mailbox-group-routes";
test("authenticated ownership, save/reload, revision conflicts, revoked membership and errors", async () => {
  const app = express(); app.use(express.json());
  const rows = new Map<string, any>(); let revoked = false, unavailable = false;
  const pool = { query: async (sql: string, values: any[] = []) => {
    if (unavailable) throw new Error("offline");
    const [userId, json, revision] = values;
    const row = rows.get(userId);
    if (sql.startsWith("SELECT")) return { rows: row ? [row] : [] };
    if (sql.startsWith("INSERT") ? !!row : !row || row.revision !== revision) return { rows: [] };
    const next = { groups: JSON.parse(json), revision: (row?.revision || 0) + 1 };
    rows.set(userId, next); return { rows: [next] };
  }};
  registerOmniMailboxGroupRoutes(app, (req: any, res, next) => {
    const id = req.header("x-test-user"); if (!id) return res.sendStatus(401);
    req.session = { user: { id } }; next();
  }, { getUserMs365Connection: async () => ({ email: "me@example.test", isConnected: true }),
    getUserMs365SharedMailboxes: async () => [{ email: "support@example.test", isActive: !revoked }] }, pool);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}/api/nexus/mailbox-groups`;
  const call = (user = "one", body?: unknown) => fetch(url, { method: body ? "PUT" : "GET", headers: {
    ...(user ? { "x-test-user": user } : {}), "Content-Type": "application/json",
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await call("")).status, 401);
    const groups = [{ id: "care", name: "Support", emails: ["support@example.test"] }];
    assert.deepEqual(await (await call()).json(), { groups: [], revision: 0 });
    assert.equal((await call("one", { groups, revision: 0 })).status, 200);
    assert.deepEqual(await (await call()).json(), { groups, revision: 1 });
    assert.deepEqual(await (await call("two")).json(), { groups: [], revision: 0 });
    assert.equal((await call("one", { groups: [], revision: 0 })).status, 409);
    assert.equal((await call("one", { groups, revision: 1 })).status, 200);
    assert.equal((await call("one", { groups: [{ id: "x", name: "X", emails: ["foreign@example.test"] }], revision: 2 })).status, 403);
    assert.equal((await call("one", { groups, revision: -1 })).status, 400);
    revoked = true;
    assert.deepEqual((await (await call()).json()).groups[0].emails, []);
    assert.equal((await call("one", { groups, revision: 2 })).status, 403);
    assert.equal((await call("one", { groups: [], revision: 2 })).status, 200);
    assert.deepEqual((await (await call()).json()).groups, []);
    unavailable = true; assert.equal((await call()).status, 500);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
