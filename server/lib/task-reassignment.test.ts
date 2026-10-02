import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import express from "express";
import ts from "typescript";
import type { Task, TaskGroup } from "@shared/schema";
import { canAccessTaskByPolicy, type TaskAccessUser } from "./task-contract";
import {
  assertTaskReassignmentActive,
  buildTaskReassignmentChange,
  buildTaskReassignmentTargets,
  parseTaskReassignmentTarget,
  taskReassignmentActorGroups,
  taskReassignmentGroupId,
  TaskReassignmentError,
  type TaskReassignmentCatalog,
  type TaskReassignmentTarget,
} from "./task-reassignment";
import { registerTaskReassignmentRoutes } from "./task-reassignment-route";
import { TaskAssignmentAccessError } from "./task-assignment-access";

const actor: TaskAccessUser = { id: "actor", role: "user", assignedCountries: ["SK"] };
const manager = { ...actor, role: "manager" };
const task = {
  id: "task-1", title: "Existing task", country: "SK", assignedUserId: "owner", createdByUserId: "creator",
  status: "in_progress", boState: "in_progress", updatedAt: new Date("2026-01-01T00:00:00Z"),
  tags: ["status_list", "source_entity:clinic:clinic-1", "urgent", "group_id:old", "group:Old group", "back_office"],
  description: "Keep request", resolution: "Saved draft", relatedEntityType: "status_list_item",
  relatedEntityId: "item-1", attachments: [{ id: "upload-1" }], workStartedAt: new Date("2025-12-31T23:00:00Z"),
} as Task;
const person = (id: string, countries = ["SK"], isActive = true) => ({
  id, assignedCountries: countries, isActive, role: "user", username: id,
  fullName: `Person ${id}`, email: `${id}@example.invalid`, avatarUrl: null,
});
const group = (id: string, isBackOffice = false) => ({
  id, name: `${id} group`, description: null, color: "#123456", isBackOffice,
} as TaskGroup);
const catalog: TaskReassignmentCatalog = {
  users: [person("actor"), person("owner"), person("old-member"), person("new-member"), person("new-second"),
    person("outside"), person("foreign", ["CZ"]), person("inactive", ["SK"], false)],
  groups: [group("old", true), group("new"), group("bo", true), group("private"), group("empty"),
    group("inactive"), group("foreign")],
  members: [
    { groupId: "old", userId: "actor" }, { groupId: "old", userId: "owner" }, { groupId: "old", userId: "old-member" },
    { groupId: "new", userId: "actor" }, { groupId: "new", userId: "new-member" },
    { groupId: "new", userId: "new-member" }, { groupId: "new", userId: "new-second" },
    { groupId: "new", userId: "inactive" }, { groupId: "new", userId: "foreign" },
    { groupId: "bo", userId: "actor" }, { groupId: "bo", userId: "new-member" },
    { groupId: "private", userId: "outside" },
    { groupId: "inactive", userId: "inactive" }, { groupId: "foreign", userId: "foreign" },
  ],
};
const errorCode = (code: string) => (error: unknown) => error instanceof TaskReassignmentError && error.code === code;

test("strict exactly-one target parser rejects ambiguous, missing, malformed and injected fields", () => {
  for (const body of [undefined, null, [], "new", {}, { newAssignedUserId: "" }, { newTaskGroupId: " " },
    { newAssignedUserId: null }, { newTaskGroupId: 1 }, { newTaskGroupId: [] },
    { newTaskGroupId: "new", newAssignedUserId: "owner" },
    { newTaskGroupId: "new", newAssignedUserId: null }, { newAssignedUserId: "owner", country: "CZ" }]) {
    assert.throws(() => parseTaskReassignmentTarget(body), errorCode("invalid_target"));
  }
  assert.deepEqual(parseTaskReassignmentTarget({ newTaskGroupId: " new " }), { newTaskGroupId: "new" });
  assert.deepEqual(parseTaskReassignmentTarget({ newAssignedUserId: "owner" }), { newAssignedUserId: "owner" });
});

test("task-scoped targets allow eligible recipients outside the current group and exclude unavailable groups/users", () => {
  const targets = buildTaskReassignmentTargets(actor, task, catalog);
  assert.deepEqual(new Set(targets.users.map(user => user.id)), new Set(["actor", "new-member", "new-second", "old-member", "owner", "outside"]));
  assert.deepEqual(targets.groups.map(row => row.id), ["bo", "new", "old"]);
  assert.equal(targets.groups.find(row => row.id === "new")?.memberCount, 3);
  assert.deepEqual(Object.keys(targets.users[0]).sort(), ["avatarUrl", "email", "fullName", "id", "username"]);
  assert.deepEqual(Object.keys(targets.groups[0]).sort(), ["color", "description", "id", "memberCount", "name"]);
  for (const user of targets.users) assert.doesNotThrow(() => buildTaskReassignmentChange(actor, task, { newAssignedUserId: user.id }, catalog));
  for (const row of targets.groups) assert.doesNotThrow(() => buildTaskReassignmentChange(actor, task, { newTaskGroupId: row.id }, catalog));
  const outsideTransfer = buildTaskReassignmentChange(actor, task, { newAssignedUserId: "outside" }, catalog);
  assert.equal(outsideTransfer.data.assignedUserId, "outside");
  assert.equal(outsideTransfer.data.boState, "received");
  assert.deepEqual(outsideTransfer.data.tags, ["status_list", "source_entity:clinic:clinic-1", "urgent"]);
  for (const id of ["missing", "private", "empty", "foreign", "inactive"]) {
    assert.throws(() => buildTaskReassignmentChange(actor, task, { newTaskGroupId: id }, catalog), errorCode("invalid_group_target"));
  }
  assert.ok(buildTaskReassignmentTargets(manager, task, catalog).groups.some(row => row.id === "private"));
  assert.ok(!buildTaskReassignmentTargets(manager, task, catalog).groups.some(row => row.id === "foreign"));
});

test("current group remains visible when its only members are no longer eligible", () => {
  const targets = buildTaskReassignmentTargets(actor, task, {
    ...catalog,
    users: catalog.users.filter(user => !["actor", "owner", "old-member"].includes(user.id)),
  });
  assert.deepEqual(targets.users.map(user => user.id), ["new-member", "new-second", "outside"]);
  assert.deepEqual(targets.groups.map(group => group.id), ["bo", "new", "old"]);
  assert.equal(targets.groups.find(group => group.id === "old")?.memberCount, 0);
  assert.equal(buildTaskReassignmentChange(actor, task, { newTaskGroupId: "old" }, {
    ...catalog,
    users: catalog.users.filter(user => !["actor", "owner", "old-member"].includes(user.id)),
  }).changed, false, "a display-only current-group selection does not reroute the task");
});

test("personal recipients must be active and able to access task country, even for an admin actor", () => {
  const personal = { ...task, assignedUserId: actor.id, tags: ["status_list"] };
  for (const id of ["foreign", "inactive", "missing"]) {
    assert.throws(() => buildTaskReassignmentChange(actor, personal, { newAssignedUserId: id }, catalog), errorCode("invalid_user_target"));
  }
  const admin = { ...actor, role: "admin", assignedCountries: [] };
  assert.throws(() => buildTaskReassignmentChange(admin, personal, { newAssignedUserId: "foreign" }, catalog), errorCode("invalid_user_target"));
  const countryless = { ...personal, country: null };
  assert.ok(buildTaskReassignmentTargets(admin, countryless, catalog).users.some(row => row.id === "foreign"));
});

test("source task country and relationship authorization apply before exposing any targets", () => {
  assert.throws(() => buildTaskReassignmentTargets({ ...actor, assignedCountries: ["CZ"] }, task, catalog), errorCode("task_not_found"));
  assert.throws(() => buildTaskReassignmentTargets({ ...actor, id: "outside" }, task, catalog), errorCode("task_not_found"));
  assert.throws(() => buildTaskReassignmentTargets({ ...manager, assignedCountries: ["CZ"] }, task, catalog), errorCode("task_not_found"));
});

test("single group handoff preserves nominal owner and all source provenance while moving shared visibility", () => {
  const change = buildTaskReassignmentChange(actor, task, { newTaskGroupId: "new" }, catalog);
  const next = { ...task, ...change.data };
  assert.equal(next.id, task.id);
  assert.equal(next.assignedUserId, "owner");
  assert.equal(next.createdByUserId, task.createdByUserId);
  assert.deepEqual(next.attachments, task.attachments);
  assert.equal(next.relatedEntityId, task.relatedEntityId);
  assert.equal(next.workStartedAt, task.workStartedAt);
  assert.equal(next.resolution, task.resolution);
  assert.equal(next.status, task.status);
  assert.equal(next.boState, "received");
  assert.deepEqual(next.tags, ["status_list", "source_entity:clinic:clinic-1", "urgent", "group_id:new", "group:new group"]);
  assert.deepEqual(change.recipientIds, ["actor", "new-member", "new-second"]);
  assert.ok(canAccessTaskByPolicy(person("new-member"), next, new Set(["new"])));
  assert.ok(!canAccessTaskByPolicy(person("old-member"), next, new Set(["old"])));
  assert.ok(!canAccessTaskByPolicy(person("foreign", ["CZ"]), next, new Set(["new"])));
  assert.ok(canAccessTaskByPolicy(person("owner"), next, new Set(["old"])));
  assert.ok(canAccessTaskByPolicy(person("creator"), next));
  const boChange = buildTaskReassignmentChange(actor, task, { newTaskGroupId: "bo" }, catalog);
  assert.ok("tags" in boChange.data && boChange.data.tags?.includes("back_office"));
  assert.equal(buildTaskReassignmentChange(actor, task, { newTaskGroupId: "old" }, catalog).changed, false);
});

test("completed, cancelled and done queue tasks reject both forms of reassignment", () => {
  for (const inactive of [{ ...task, status: "completed" }, { ...task, status: "cancelled" }, { ...task, boState: "done" }]) {
    for (const target of [{ newTaskGroupId: "new" }, { newAssignedUserId: "owner" }]) {
      assert.throws(() => buildTaskReassignmentChange(actor, inactive, target, catalog), errorCode("task_inactive"));
    }
  }
});

// Exercise the actual storage transaction without importing the application or
// touching its database. This also makes lock/recheck ordering regression-testable.
const storageSource = readFileSync("server/storage.ts", "utf8");
const storageAst = ts.createSourceFile("storage.ts", storageSource, ts.ScriptTarget.Latest, true);
let methodSource = "";
let loaderSource = "";
function visit(node: ts.Node) {
  if (ts.isMethodDeclaration(node) && node.name.getText(storageAst) === "reassignTask") methodSource = node.getText(storageAst);
  if (ts.isFunctionDeclaration(node) && node.name?.text === "loadTaskReassignmentCatalog") loaderSource = node.getText(storageAst);
  ts.forEachChild(node, visit);
}
visit(storageAst);
assert.ok(methodSource && loaderSource);
const compiled = ts.transpileModule(`${loaderSource}\nglobalThis.reassign = async function ${methodSource.slice("async ".length)}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

function storageFixture(initial = task, currentCatalog = catalog) {
  let current = { ...initial };
  const history: any[] = [];
  const locks: { table: string; lock: string }[] = [];
  let writes = 0;
  let transactionTail = Promise.resolve();
  const tables = {
    tasks: { table: "tasks", id: "id" },
    users: { table: "users", id: "id", fullName: "fullName", username: "username", email: "email", avatarUrl: "avatarUrl", isActive: "isActive", role: "role", assignedCountries: "assignedCountries" },
    taskGroups: { table: "groups", id: "id" },
    taskGroupMembers: { table: "members", groupId: "groupId", userId: "userId" },
    taskComments: { table: "comments" },
  };
  type Predicate = (row: any) => boolean;
  const eq = (column: string, value: unknown): Predicate => row => row[column] === value;
  const inArray = (column: string, values: unknown[]): Predicate => row => values.includes(row[column]);
  const or = (...predicates: Predicate[]): Predicate => row => predicates.some(predicate => predicate(row));
  const tx = {
    select: () => {
      let table = "";
      let predicate: Predicate = () => true;
      let limit = Infinity;
      const query = {
        from(value: { table: string }) { table = value.table; return query; },
        where(value: Predicate) { predicate = value; return query; },
        for(lock: string) { locks.push({ table, lock }); return query; },
        limit(value: number) { limit = value; return query; },
        then(resolve: (value: any[]) => unknown) {
          const rows = table === "tasks" ? [current] : currentCatalog[table as keyof TaskReassignmentCatalog];
          return Promise.resolve(rows.filter(predicate).slice(0, limit)).then(resolve);
        },
      };
      return query;
    },
    update: () => ({
      set: (data: Partial<Task>) => ({
        where: () => ({
          returning: async () => { writes++; current = { ...current, ...data }; return [current]; },
        }),
      }),
    }),
    insert: () => ({ values: async (value: any) => { history.push(value); } }),
  };
  const db = {
    transaction: (callback: (connection: typeof tx) => Promise<unknown>) => {
      const next = transactionTail.then(() => callback(tx));
      transactionTail = next.then(() => undefined, () => undefined);
      return next;
    },
  };
  const context = {
    ...tables, db, eq, or, inArray, sql: () => (() => false),
    canAccessTaskByPolicy, taskReassignmentActorGroups, taskReassignmentGroupId,
    buildTaskReassignmentChange, assertTaskReassignmentActive, TaskReassignmentError, Date,
    isTaskAssignmentUserAllowed: async () => true,
    assertTaskRecipientAllowed: async () => undefined,
    TaskAssignmentAccessError,
  };
  vm.runInNewContext(compiled, context);
  return {
    reassign: (target: TaskReassignmentTarget, expectedUpdatedAt = initial.updatedAt, user = actor) =>
      (context as any).reassign(initial.id, target, user, expectedUpdatedAt),
    history, locks, current: () => current, writes: () => writes,
  };
}

test("storage handoff updates one task, locks and revalidates target, and records old/new groups atomically", async () => {
  const fixture = storageFixture();
  const result = await fixture.reassign({ newTaskGroupId: "new" });
  assert.equal(result.task.id, task.id);
  assert.equal(fixture.writes(), 1);
  assert.deepEqual(fixture.locks[0], { table: "tasks", lock: "update" });
  assert.ok(fixture.locks.some(lock => lock.table === "users" && lock.lock === "share"));
  assert.ok(fixture.locks.some(lock => lock.table === "members" && lock.lock === "share"));
  assert.ok(fixture.locks.some(lock => lock.table === "groups" && lock.lock === "share"));
  assert.equal(fixture.history.length, 1);
  assert.equal(fixture.history[0].metadata.oldTaskGroupId, "old");
  assert.equal(fixture.history[0].metadata.newTaskGroupId, "new");
  assert.equal(fixture.history[0].metadata.newAssignedUserId, "owner");
  assert.ok(result.task.updatedAt > task.updatedAt);
});

test("concurrent reassignment guard rejects stale writes without duplicate history", async () => {
  const fixture = storageFixture();
  const results = await Promise.allSettled([
    fixture.reassign({ newTaskGroupId: "new" }),
    fixture.reassign({ newTaskGroupId: "bo" }),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
  assert.ok(errorCode("task_changed")(rejected.reason));
  assert.equal(fixture.writes(), 1);
  assert.equal(fixture.history.length, 1);
  const repeat = await fixture.reassign({ newTaskGroupId: "new" }, fixture.current().updatedAt);
  assert.equal(repeat.changed, false);
  assert.equal(fixture.history.length, 1);
});

test("locked storage recheck prevents completion races, membership revocation and newly inactive recipients", async () => {
  for (const status of ["completed", "cancelled"]) {
    const fixture = storageFixture({ ...task, status });
    await assert.rejects(fixture.reassign({ newTaskGroupId: "new" }), errorCode("task_inactive"));
    assert.equal(fixture.writes(), 0);
  }
  const revokedCatalog = { ...catalog, members: catalog.members.filter(member => member.userId !== actor.id) };
  const revoked = storageFixture(task, revokedCatalog);
  await assert.rejects(revoked.reassign({ newTaskGroupId: "new" }), errorCode("task_not_found"));
  assert.equal(revoked.writes(), 0);
  const inactive = storageFixture(task, { ...catalog, users: catalog.users.map(user => ({ ...user, isActive: false })) });
  await assert.rejects(inactive.reassign({ newTaskGroupId: "new" }), errorCode("invalid_group_target"));
  assert.equal(inactive.writes(), 0);
});

async function routeFixture(run: (request: (method: string, body?: unknown, authenticated?: boolean) => Promise<{ status: number; body: any }>, state: any) => Promise<void>) {
  const storage = storageFixture();
  const sideEffects = { notifications: [] as any[], events: [] as any[], logs: [] as any[], allowed: true };
  const app = express();
  app.use(express.json());
  registerTaskReassignmentRoutes(app, (req, res, next) => {
    if (!req.get("x-test-user")) return void res.sendStatus(401);
    (req as any).session = { user: actor };
    next();
  }, {
    getTask: async () => storage.current(),
    canAccessTask: async (_user, row) => sideEffects.allowed && canAccessTaskByPolicy(actor, row, new Set(["old", "new", "bo"])),
    getTargets: async row => buildTaskReassignmentTargets(actor, row, catalog),
    reassign: async (_id, target, _user, expected) => storage.reassign(target, expected),
    log: async result => { sideEffects.logs.push(result); },
    emitUserAssignment: async result => { sideEffects.events.push(result); },
    notifyGroup: async result => { sideEffects.notifications.push(result); },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  const request = async (method: string, body?: unknown, authenticated = true) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/tasks/task-1/${method === "GET" ? "reassign-targets" : "reassign"}`, {
      method, headers: { "Content-Type": "application/json", ...(authenticated ? { "x-test-user": "actor" } : {}) },
      ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
    });
    const text = await response.text();
    return { status: response.status, body: response.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text };
  };
  try { await run(request, { storage, ...sideEffects, sideEffects }); }
  finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("HTTP group handoff and repeat preserve identity/history, dedupe group recipients, and emit no unrelated user automation", async () => {
  await routeFixture(async (request, state) => {
    const targets = await request("GET");
    assert.equal(targets.status, 200);
    assert.ok(targets.body.groups.some((row: any) => row.id === "new"));
    assert.equal((await request("POST", { newTaskGroupId: "new" })).status, 200);
    assert.equal((await request("POST", { newTaskGroupId: "new" })).status, 200);
    assert.equal(state.storage.writes(), 1);
    assert.equal(state.storage.history.length, 1);
    assert.equal(state.notifications.length, 1);
    assert.deepEqual(state.notifications[0].recipientIds, ["actor", "new-member", "new-second"]);
    assert.equal(state.events.length, 0);
    assert.equal(state.logs.length, 1);
    assert.ok(state.storage.current().tags.includes("group_id:new"));
    assert.ok(!state.storage.current().tags.includes("group_id:old"));
  });
});

test("HTTP user handoff permits outside-group recipients and removes shared routing", async () => {
  await routeFixture(async (request, state) => {
    assert.equal((await request("POST", { newAssignedUserId: "old-member" })).status, 200);
    assert.equal(state.events.length, 1);
    assert.equal(state.notifications.length, 0);
    assert.equal(state.storage.current().assignedUserId, "old-member");
    assert.equal((await request("POST", { newTaskGroupId: "new" })).status, 200);
    const targets = await request("GET");
    assert.deepEqual(new Set(targets.body.users.map((row: any) => row.id)),
      new Set(["actor", "new-member", "new-second", "old-member", "outside", "owner"]));
    assert.equal((await request("POST", { newAssignedUserId: "owner" })).status, 200);
    assert.ok(!state.storage.current().tags.some((tag: string) => tag.startsWith("group_id:")));
    assert.equal(state.events.length, 2);
  });
});

test("HTTP authorization/input failures never read targets, write, log or notify", async () => {
  await routeFixture(async (request, state) => {
    assert.equal((await request("GET", undefined, false)).status, 401);
    assert.equal((await request("POST", { newTaskGroupId: "new" }, false)).status, 401);
    assert.equal((await request("POST", { newTaskGroupId: "new", newAssignedUserId: "owner" })).status, 400);
    assert.equal((await request("POST", { newTaskGroupId: "private" })).status, 400);
    assert.equal((await request("POST", { newAssignedUserId: "foreign" })).status, 400);
    state.sideEffects.allowed = false;
    assert.equal((await request("GET")).status, 404);
    assert.equal((await request("POST", { newTaskGroupId: "new" })).status, 404);
    assert.equal(state.storage.writes(), 0);
    assert.equal(state.logs.length, 0);
    assert.equal(state.notifications.length, 0);
    assert.equal(state.events.length, 0);
  });
});