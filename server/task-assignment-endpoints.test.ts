import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import test from "node:test";
import vm from "node:vm";
import express from "express";
import ts from "typescript";
import { createRequirePersistedAdmin, isPersistedAdministrator } from "./lib/admin-authorization";
import { taskPeopleCandidateAllowed, userMayAccessTaskCountry } from "./lib/task-contract";
import { TaskAssignmentAccessError, taskAssignmentPolicyVersionMatches } from "./lib/task-assignment-access";

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
assert.ok(requireAuthSource);

const settingsStart = source.indexOf("  const requireTaskSettingsAdmin = createRequirePersistedAdmin(storage);");
const settingsEnd = source.indexOf("  const listTaskGroups =", settingsStart);
assert.ok(settingsStart >= 0 && settingsEnd > settingsStart);
const settingsRoutes = ts.transpileModule(
  `const requireAuth = ${requireAuthSource};\n${source.slice(settingsStart, settingsEnd)}`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const optionsStart = source.indexOf('  app.get("/api/tasks/assignment-options", requireAuth, async (req, res) => {');
const optionsEnd = source.indexOf('  app.get("/api/tasks/people"', optionsStart);
assert.ok(optionsStart >= 0 && optionsEnd > optionsStart);
const optionsRoute = ts.transpileModule(
  `const requireAuth = ${requireAuthSource};\n${source.slice(optionsStart, optionsEnd)}`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const claimStart = source.indexOf('  app.post("/api/back-office/tasks/:taskId/claim", requireAuth, async (req, res) => {');
const claimEnd = source.indexOf("  // Add a free-text note to a back-office task", claimStart);
const forwardTargetsStart = source.indexOf('  app.get("/api/back-office/forward-targets", requireAuth, async (req, res) => {');
const forwardStart = source.indexOf('  app.post("/api/back-office/tasks/:taskId/forward", requireAuth, async (req, res) => {');
const forwardEnd = source.indexOf("  // Agent inbox: back-office questions", forwardStart);
assert.ok(claimStart >= 0 && claimEnd > claimStart && forwardTargetsStart >= 0 && forwardStart > forwardTargetsStart && forwardEnd > forwardStart);
const backOfficeRoutes = ts.transpileModule(
  `const requireAuth = ${requireAuthSource};\n${source.slice(claimStart, claimEnd)}\n${source.slice(forwardTargetsStart, forwardEnd)}`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;

type QueryCondition =
  | { kind: "eq"; field: string; value: unknown }
  | { kind: "in"; field: string; values: unknown[] }
  | { kind: "and"; conditions: QueryCondition[] };

function makeHarness() {
  const tables = {
    users: {
      id: "id", fullName: "fullName", username: "username", email: "email", avatarUrl: "avatarUrl",
      isActive: "isActive", role: "role", assignedCountries: "assignedCountries",
    },
    taskAssignmentAccess: { id: "id", allowedUserIds: "allowedUserIds", updatedAt: "updatedAt" },
  };
  const users = [
    { id: "admin", fullName: "Admin", username: "admin", email: null, avatarUrl: null, isActive: true, role: "admin", assignedCountries: [] },
    { id: "manager", fullName: "Manager", username: "manager", email: null, avatarUrl: null, isActive: true, role: "manager", assignedCountries: ["SK"] },
    { id: "member-1", fullName: "Member One", username: "one", email: "one@example.test", avatarUrl: null, isActive: true, role: "user", assignedCountries: ["SK"] },
    { id: "member-2", fullName: "Member Two", username: "two", email: "two@example.test", avatarUrl: null, isActive: true, role: "user", assignedCountries: ["SK"] },
    { id: "inactive", fullName: "Inactive", username: "inactive", email: null, avatarUrl: null, isActive: false, role: "user", assignedCountries: ["SK"] },
  ];
  const actors = new Map(users.map(user => [user.id, user]));
  let setting = { id: 1, allowedUserIds: null as string[] | null, updatedAt: new Date("2025-01-01T00:00:00.000Z") };
  let failWrite = false;
  let transactionCount = 0;
  let settingsReadCount = 0;
  let userAuthorizationReads = 0;

  const eq = (field: string, value: unknown): QueryCondition => ({ kind: "eq", field, value });
  const inArray = (field: string, values: unknown[]): QueryCondition => ({ kind: "in", field, values });
  const and = (...conditions: QueryCondition[]): QueryCondition => ({ kind: "and", conditions });
  const matches = (row: any, condition?: QueryCondition): boolean => {
    if (!condition) return true;
    if (condition.kind === "eq") return row[condition.field] === condition.value;
    if (condition.kind === "in") return condition.values.includes(row[condition.field]);
    return condition.conditions.every(part => matches(row, part));
  };

  function select(projection?: Record<string, string>) {
    return {
      from(table: unknown) {
        let condition: QueryCondition | undefined;
        let maximum = Infinity;
        const chain: any = {
          where(value: QueryCondition) { condition = value; return chain; },
          orderBy() { return chain; },
          limit(value: number) { maximum = value; return chain; },
          for() { return chain; },
          then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
            const isSettings = table === tables.taskAssignmentAccess;
            if (isSettings) settingsReadCount++;
            const rows = isSettings ? [setting] : table === tables.users ? users : [];
            const result = rows.filter(row => matches(row, condition)).slice(0, maximum).map((row: any) =>
              projection ? Object.fromEntries(Object.entries(projection).map(([key, field]) => [key, row[field]])) : row,
            );
            return Promise.resolve(result).then(resolve, reject);
          },
        };
        return chain;
      },
    };
  }

  const db = {
    select,
    insert(table: unknown) {
      return {
        values(values: any) {
          return {
            async onConflictDoUpdate(options: any) {
              if (table === tables.taskAssignmentAccess) {
                setting = { ...values, ...options.set };
              }
              if (failWrite) throw new Error("Test write failure after staged write");
            },
          };
        },
      };
    },
    async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      transactionCount++;
      const before = { ...setting, allowedUserIds: setting.allowedUserIds ? [...setting.allowedUserIds] : null };
      try {
        return await fn(db);
      } catch (error) {
        setting = before;
        throw error;
      }
    },
  };
  const storage = {
    async getUser(id: string) {
      userAuthorizationReads++;
      return actors.get(id);
    },
    async getRole() { return undefined; },
  };
  const taskAssignmentAllowlist = async () => ({
    configured: setting.allowedUserIds !== null,
    allowedUserIds: setting.allowedUserIds ?? [],
    updatedAt: setting.updatedAt,
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const id = req.header("x-test-actor");
    (req as any).session = id ? { user: { id, role: "admin" } } : {};
    next();
  });
  vm.runInNewContext(settingsRoutes, {
    app, storage, db, ...tables, and, eq, inArray,
    createRequirePersistedAdmin, isPersistedAdministrator, taskAssignmentAllowlist,
    taskAssignmentPolicyVersionMatches,
    console: { error() {} },
  });
  return {
    app, users, get setting() { return setting; },
    set failWrite(value: boolean) { failWrite = value; },
    get transactionCount() { return transactionCount; },
    get settingsReadCount() { return settingsReadCount; },
    get userAuthorizationReads() { return userAuthorizationReads; },
  };
}

test("real task-settings users GET/PUT enforce authorization, validation, optimistic writes, and rollback", async () => {
  const harness = makeHarness();
  const server = createServer(harness.app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  async function request(actor: string | undefined, method: string, body?: unknown) {
    const response = await fetch(`${base}/api/task-settings/users`, {
      method,
      headers: { ...(actor ? { "x-test-actor": actor } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() as any };
  }

  try {
    const initial = await request("admin", "GET");
    assert.equal(initial.status, 200);
    assert.equal(initial.body.configured, false);
    assert.deepEqual(initial.body.allowedUserIds, []);
    assert.equal(initial.body.updatedAt, harness.setting.updatedAt.toISOString());
    assert.deepEqual(initial.body.users.map((user: any) => user.id), harness.users.map(user => user.id));
    const initialVersion = initial.body.updatedAt;

    for (const actor of ["manager", "member-1"]) {
      const reads = harness.settingsReadCount;
      const txs = harness.transactionCount;
      assert.equal((await request(actor, "GET")).status, 403);
      assert.equal((await request(actor, "PUT", { allowedUserIds: [], expectedUpdatedAt: initialVersion })).status, 403);
      assert.equal(harness.settingsReadCount, reads, "non-admins are denied before reading allowlist settings");
      assert.equal(harness.transactionCount, txs, "non-admins are denied before opening a settings transaction");
    }

    const malformedBodies = [
      {},
      { allowedUserIds: "member-1", expectedUpdatedAt: initialVersion },
      { allowedUserIds: [1], expectedUpdatedAt: initialVersion },
      { allowedUserIds: [], expectedUpdatedAt: undefined },
    ];
    for (const body of malformedBodies) assert.equal((await request("admin", "PUT", body)).status, 400);
    assert.equal((await request("admin", "PUT", { allowedUserIds: ["member-1", "member-1"], expectedUpdatedAt: initialVersion })).status, 400);
    for (const id of ["missing-user", "inactive"]) {
      const before = harness.setting;
      assert.equal((await request("admin", "PUT", { allowedUserIds: [id], expectedUpdatedAt: initialVersion })).status, 400);
      assert.deepEqual(harness.setting, before, "invalid IDs must not alter persisted policy");
    }

    const selected = await request("admin", "PUT", { allowedUserIds: ["member-1"], expectedUpdatedAt: initialVersion });
    assert.equal(selected.status, 200);
    assert.equal(selected.body.configured, true);
    assert.deepEqual(selected.body.allowedUserIds, ["member-1"]);
    const selectedVersion = selected.body.updatedAt;
    assert.notEqual(selectedVersion, initialVersion);

    const stale = await request("admin", "PUT", { allowedUserIds: ["member-2"], expectedUpdatedAt: initialVersion });
    assert.equal(stale.status, 409);
    assert.deepEqual(harness.setting.allowedUserIds, ["member-1"]);

    const empty = await request("admin", "PUT", { allowedUserIds: [], expectedUpdatedAt: selectedVersion });
    assert.equal(empty.status, 200);
    assert.equal(empty.body.configured, true, "an explicit empty array remains configured");
    assert.deepEqual(empty.body.allowedUserIds, []);

    const beforeFailedWrite = { ...harness.setting, allowedUserIds: harness.setting.allowedUserIds ? [...harness.setting.allowedUserIds] : null };
    harness.failWrite = true;
    const failedWrite = await request("admin", "PUT", { allowedUserIds: ["member-2"], expectedUpdatedAt: empty.body.updatedAt });
    assert.equal(failedWrite.status, 500);
    assert.deepEqual(harness.setting, beforeFailedWrite, "failed database writes roll back the persisted policy");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("real assignment-options route filters allowlisted country-accessible recipients/groups and computes canResolve", async () => {
  const tables = {
    users: {
      id: "id", fullName: "fullName", username: "username", email: "email", avatarUrl: "avatarUrl",
      role: "role", assignedCountries: "assignedCountries", isActive: "isActive",
    },
    taskGroups: { id: "id", name: "name", description: "description", color: "color", icon: "icon", isBackOffice: "isBackOffice" },
    taskGroupMembers: { groupId: "groupId", userId: "userId" },
  };
  const people = [
    { id: "actor", fullName: "Actor", username: "actor", email: null, avatarUrl: null, role: "manager", assignedCountries: ["SK"], isActive: true },
    { id: "recipient", fullName: "Recipient", username: "recipient", email: null, avatarUrl: null, role: "user", assignedCountries: ["SK"], isActive: true },
    { id: "foreign", fullName: "Foreign", username: "foreign", email: null, avatarUrl: null, role: "user", assignedCountries: ["CZ"], isActive: true },
    { id: "unselected", fullName: "Unselected", username: "unselected", email: null, avatarUrl: null, role: "user", assignedCountries: ["SK"], isActive: true },
    { id: "inactive", fullName: "Inactive", username: "inactive", email: null, avatarUrl: null, role: "user", assignedCountries: ["SK"], isActive: false },
  ];
  const groups = [
    { id: "eligible-group", name: "Eligible", description: null, color: null, icon: null, isBackOffice: false },
    { id: "foreign-group", name: "Foreign", description: null, color: null, icon: null, isBackOffice: false },
    { id: "empty-group", name: "Empty", description: null, color: null, icon: null, isBackOffice: false },
  ];
  const memberships = [
    { groupId: "eligible-group", userId: "recipient" },
    { groupId: "eligible-group", userId: "unselected" },
    { groupId: "foreign-group", userId: "foreign" },
    { groupId: "empty-group", userId: "unselected" },
  ];
  let allowedUserIds = ["actor", "recipient", "foreign", "inactive"];
  const eq = (field: string, value: unknown): QueryCondition => ({ kind: "eq", field, value });
  const inArray = (field: string, values: unknown[]): QueryCondition => ({ kind: "in", field, values });
  const and = (...conditions: QueryCondition[]): QueryCondition => ({ kind: "and", conditions });
  const db = {
    select(projection?: Record<string, string>) {
      return {
        from(table: unknown) {
          let condition: QueryCondition | undefined;
          const chain: any = {
            where(value: QueryCondition) { condition = value; return chain; },
            then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
              const rows = table === tables.users ? people : table === tables.taskGroups ? groups : table === tables.taskGroupMembers ? memberships : [];
              const matches = (row: any, item?: QueryCondition): boolean => {
                if (!item) return true;
                if (item.kind === "eq") return row[item.field] === item.value;
                if (item.kind === "in") return item.values.includes(row[item.field]);
                return item.conditions.every(part => matches(row, part));
              };
              const result = rows.filter(row => matches(row, condition)).map((row: any) =>
                projection ? Object.fromEntries(Object.entries(projection).map(([key, field]) => [key, row[field]])) : row,
              );
              return Promise.resolve(result).then(resolve, reject);
            },
          };
          return chain;
        },
      };
    },
  };
  const taskAssignmentAllowlist = async () => ({ configured: true, allowedUserIds, updatedAt: new Date("2025-01-02T00:00:00.000Z") });
  const isTaskAssignmentUserAllowed = async (_executor: unknown, id: string) =>
    people.some(person => person.id === id && person.isActive) && allowedUserIds.includes(id);
  const app = express();
  app.use((req, _res, next) => {
    const id = req.header("x-test-actor");
    (req as any).session = id ? { user: { id, role: "manager", assignedCountries: ["SK"] } } : {};
    next();
  });
  vm.runInNewContext(optionsRoute, {
    app, db, ...tables, eq, inArray, and,
    taskAssignmentAllowlist, isTaskAssignmentUserAllowed, taskPeopleCandidateAllowed,
    console: { error() {} },
  });
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    const base = `http://127.0.0.1:${address.port}/api/tasks/assignment-options`;
    assert.equal((await fetch(base)).status, 401);
    const response = await fetch(base, { headers: { "x-test-actor": "actor" } });
    assert.equal(response.status, 200);
    const options = await response.json() as any;
    assert.deepEqual(options.users.map((person: any) => person.id), ["actor", "recipient"]);
    assert.deepEqual(options.groups.map((group: any) => [group.id, group.memberCount]), [["eligible-group", 1]]);
    assert.equal(options.canResolve, true);

    allowedUserIds = ["recipient", "foreign", "inactive"];
    const noResolver = await fetch(base, { headers: { "x-test-actor": "actor" } });
    assert.equal(noResolver.status, 200);
    assert.equal((await noResolver.json() as any).canResolve, false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("actual BO claim and forward routes reject unapproved users and notify only eligible group recipients", async () => {
  const tables = {
    tasks: { id: "id", status: "status", boState: "boState" },
    users: {
      id: "id", role: "role", roleId: "roleId", assignedCountries: "assignedCountries", isActive: "isActive",
      fullName: "fullName", username: "username", email: "email",
    },
    taskGroups: { id: "id" },
    taskGroupMembers: { groupId: "groupId", userId: "userId" },
    taskComments: {},
  };
  const people = [
    { id: "actor", role: "admin", roleId: null, assignedCountries: ["SK"], isActive: true, fullName: "Actor", username: "actor", email: null },
    { id: "selected", role: "admin", roleId: null, assignedCountries: ["SK"], isActive: true, fullName: "Selected", username: "selected", email: null },
    { id: "unselected", role: "admin", roleId: null, assignedCountries: ["SK"], isActive: true, fullName: "Unselected", username: "unselected", email: null },
    { id: "foreign", role: "admin", roleId: null, assignedCountries: ["CZ"], isActive: true, fullName: "Foreign", username: "foreign", email: null },
  ];
  const group = { id: "bo-group", name: "BO Group", isBackOffice: true };
  const memberships = ["unselected", "selected", "foreign"].map(userId => ({ groupId: group.id, userId }));
  const allowed = new Set(["selected"]);
  const seedTask = () => ({
    id: "task-1", title: "Follow up", status: "pending", boState: "received", country: "SK",
    assignedUserId: "unselected", createdByUserId: "agent", tags: ["back_office"], updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  });
  let task = seedTask();
  let comments: any[] = [];
  let notifications: { ids: string[]; payload: any }[] = [];
  const condition = (kind: string, field?: string, value?: unknown): any => ({ kind, field, value });
  const eq = (field: string, value: unknown) => condition("eq", field, value);
  const ne = (field: string, value: unknown) => condition("ne", field, value);
  const and = (...conditions: any[]) => ({ kind: "and", conditions });
  const sql = () => ({ kind: "always" });
  const matches = (row: any, expr: any): boolean => {
    if (!expr || expr.kind === "always") return true;
    if (expr.kind === "eq") return row[expr.field] === expr.value;
    if (expr.kind === "ne") return row[expr.field] !== expr.value;
    if (expr.kind === "and") return expr.conditions.every((part: any) => matches(row, part));
    return true;
  };
  const db: any = {
    select(projection?: Record<string, string>) {
      return {
        from(table: unknown) {
          let filter: any;
          let count = Infinity;
          let joinedTable: unknown;
          const chain: any = {
            where(expr: any) { filter = expr; return chain; },
            for() { return chain; },
            limit(n: number) { count = n; return chain; },
            innerJoin(joinTable: unknown) { joinedTable = joinTable; return chain; },
            then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
              let rows = table === tables.tasks ? [task]
                : table === tables.users ? people
                  : table === tables.taskGroups ? [group]
                    : table === tables.taskGroupMembers ? memberships
                      : [];
              if (table === tables.taskGroupMembers && joinedTable === tables.users) {
                rows = memberships.map(member => ({
                  ...member,
                  ...people.find(person => person.id === member.userId),
                }));
              }
              const result = rows.filter(row => matches(row, filter)).slice(0, count).map((row: any) =>
                projection ? Object.fromEntries(Object.entries(projection).map(([key, field]) => [key, row[field]])) : row,
              );
              return Promise.resolve(result).then(resolve, reject);
            },
          };
          return chain;
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: any) {
          let filter: any;
          const chain: any = {
            where(expr: any) { filter = expr; return chain; },
            returning() {
              if (table !== tables.tasks || !matches(task, filter)) return Promise.resolve([]);
              task = { ...task, ...values };
              return Promise.resolve([task]);
            },
          };
          return chain;
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: any) {
          if (table === tables.taskComments) comments.push(values);
          return Promise.resolve();
        },
      };
    },
    async transaction<T>(callback: (tx: any) => Promise<T>) { return callback(db); },
  };
  const storage = {
    async getAllUsers() { return people; },
    async getAllRoles() { return [{ id: "admin-role", name: "Admin" }]; },
  };
  const assertTaskRecipientAllowed = async (_tx: unknown, id: string, country?: string | null) => {
    const user = people.find(person => person.id === id && person.isActive);
    if (!user || !allowed.has(id)) throw new TaskAssignmentAccessError("The selected user is not approved");
    if (country && !userMayAccessTaskCountry(user.role, user.assignedCountries, country)) {
      throw new TaskAssignmentAccessError("The selected user is not authorized for this task country");
    }
  };
  const countryAuthorizedTaskRecipientIds = async (_tx: unknown, ids: string[], country?: string | null) =>
    ids.filter(id => {
      const person = people.find(user => user.id === id && user.isActive);
      return !!person && allowed.has(id) && userMayAccessTaskCountry(person.role, person.assignedCountries, country);
    });
  const isTaskAssignmentUserAllowed = async (_tx: unknown, id: string) =>
    people.some(person => person.id === id && person.isActive) && allowed.has(id);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const id = req.header("x-test-actor");
    (req as any).session = id ? { user: { id, role: "admin", assignedCountries: ["SK"] } } : {};
    next();
  });
  vm.runInNewContext(backOfficeRoutes, {
    app, db, storage, ...tables,
    eq, ne, and, sql,
    getBackOfficeTask: async (id: string) => id === task.id ? task : undefined,
    canAccessBoTask: () => true,
    assertTaskRecipientAllowed,
    countryAuthorizedTaskRecipientIds,
    isTaskAssignmentUserAllowed,
    taskPeopleCandidateAllowed,
    userMayAccessTaskCountry,
    transitionTaskWorkTiming: () => ({}),
    notificationService: { async sendNotificationToUsers(ids: string[], payload: any) { notifications.push({ ids, payload }); } },
    TaskAssignmentAccessError,
    userMayAccessTaskCountry,
    console: { error() {}, warn() {} },
  });
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  async function post(path: string, actor: string, body?: unknown) {
    const response = await fetch(`${base}${path}`, {
      method: "POST", headers: { "content-type": "application/json", "x-test-actor": actor },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() as any };
  }
  try {
    const targetResponse = await fetch(`${base}/api/back-office/forward-targets?taskId=task-1`, {
      headers: { "x-test-actor": "actor" },
    });
    assert.equal(targetResponse.status, 200);
    const targets = await targetResponse.json() as any;
    assert.deepEqual(targets.admins.map((person: any) => person.id), ["selected"]);
    assert.deepEqual(targets.groups.map((item: any) => [item.id, item.memberCount]), [["bo-group", 1]]);

    let result = await post("/api/back-office/tasks/task-1/claim", "unselected");
    assert.equal(result.status, 403);
    assert.equal(task.assignedUserId, "unselected");
    assert.equal(comments.length, 0);

    task = seedTask();
    result = await post("/api/back-office/tasks/task-1/forward", "actor", { targetType: "admin", targetId: "unselected" });
    assert.equal(result.status, 403);
    assert.equal(task.assignedUserId, "unselected");
    assert.equal(comments.length, 0);
    assert.equal(notifications.length, 0);

    result = await post("/api/back-office/tasks/task-1/forward", "actor", { targetType: "group", targetId: group.id });
    assert.equal(result.status, 200);
    assert.equal(task.assignedUserId, "selected", "the first eligible member remains the nominal group owner");
    assert.ok(task.tags.includes("group_id:bo-group"));
    assert.deepEqual(Array.from(notifications.at(-1)?.ids || []), ["selected"]);

    task = seedTask();
    comments = [];
    notifications = [];
    allowed.clear();
    result = await post("/api/back-office/tasks/task-1/forward", "actor", { targetType: "group", targetId: group.id });
    assert.equal(result.status, 400);
    assert.equal(task.assignedUserId, "unselected");
    assert.deepEqual(comments, []);
    assert.deepEqual(notifications, []);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});