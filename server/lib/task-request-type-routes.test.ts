import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import express from "express";
import type { Server } from "node:http";
import { taskRequestTypes, taskGroups, users, taskAssignmentAccess } from "@shared/schema";
import { createRequirePersistedAdmin } from "./admin-authorization";
import { registerTaskRequestTypeRoutes } from "./task-request-type-routes";

function parameters(value: any): string[] {
  if (Array.isArray(value)) return value.flatMap(parameters);
  if (typeof value?.value === "string") return [value.value];
  return (value?.queryChunks || []).flatMap(parameters);
}
const stored: any[] = [];
const database: any = {
  select() {
    let table: any, condition: any;
    const query: any = {
      from(value: any) { table = value; return query; },
      where(value: any) { condition = value; return query; },
      limit() { return query; }, orderBy() { return query; }, for() { return query; },
      then(resolve: any, reject: any) {
        const ids = parameters(condition);
        const rows = table === taskRequestTypes ? stored.filter(row => !row.deleted)
          : table === taskGroups ? [{ id: "bo" }].filter(row => ids.includes(row.id))
          : table === users ? [{ id: "a", isActive: true, assignedCountries: ["SK"] }].filter(row => ids.includes(row.id))
          : table === taskAssignmentAccess ? [{ allowedUserIds: ["a"] }] : [];
        return Promise.resolve(rows).then(resolve, reject);
      },
    };
    return query;
  },
  insert() {
    return { values(data: any) { return { returning: async () => {
      const row = { id: "created-type", deleted: false, ...data };
      stored.push(row); return [row];
    } }; } };
  },
  update() {
    return { set(data: any) { return { where(condition: any) { return { returning: async () => {
      const row = stored.find(row => row.id === parameters(condition)[0]);
      if (!row) return [];
      Object.assign(row, data); return [row];
    } }; } }; } };
  },
  async transaction(work: any) { return work(database); },
};
let server: Server, base: string;
before(async () => {
  const app = express();
  app.use(express.json());
  const auth: express.RequestHandler = (req, res, next) => {
    const id = req.header("x-test-user");
    if (!id) { res.sendStatus(401); return; }
    (req as any).session = { user: { id, role: "admin" } }; next();
  };
  const admin = createRequirePersistedAdmin({
    getUser: async (id: string) => ({ id, isActive: true, role: id === "admin" ? "admin" : "user" }),
  } as any);
  registerTaskRequestTypeRoutes(app, auth, admin, database);
  await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
async function request(method: string, path = "", body?: unknown, actor = "admin") {
  return fetch(`${base}/api/task-request-types${path}`, { method, headers: {
    ...(actor ? { "x-test-user": actor } : {}), "Content-Type": "application/json",
  }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
it("requires authentication and persisted administrator authority for writes", async () => {
  assert.equal((await request("GET", "", undefined, "")).status, 401);
  const body = { name: "Unauthorized", groupIds: [], userIds: [], enabled: true };
  assert.equal((await request("POST", "", body, "ordinary")).status, 403);
  assert.equal(stored.length, 0);
});
it("creates, edits and soft-deletes one type while preserving combined defaults", async () => {
  const body = { name: " Authored type ", groupIds: ["bo", "bo"], userIds: ["a", "a"], enabled: true };
  const response = await request("POST", "", body);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id: "created-type", deleted: false, name: "Authored type", groupIds: ["bo"], userIds: ["a"], enabled: true });
  const update = await request("PUT", "/created-type", { name: "Renamed", groupIds: [], userIds: ["a"], enabled: false });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).enabled, false);
  assert.equal((await (await request("GET", "", undefined, "ordinary")).json()).length, 1);
  assert.equal((await request("DELETE", "/created-type")).status, 204);
  assert.equal(stored[0].deleted, true);
  assert.deepEqual(await (await request("GET")).json(), []);
});
it("rejects malformed input and unknown or unapproved recipients without creating records", async () => {
  const count = stored.length;
  for (const body of [
    { name: "", groupIds: [], userIds: [], enabled: true },
    { name: "Missing group", groupIds: ["missing"], userIds: [], enabled: true },
    { name: "Missing person", groupIds: [], userIds: ["missing"], enabled: true },
  ]) assert.equal((await request("POST", "", body)).status, 400);
  assert.equal(stored.length, count);
  assert.equal((await request("DELETE", "/missing")).status, 404);
});
