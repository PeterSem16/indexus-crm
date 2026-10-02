import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import bcrypt from "bcrypt";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../db";
import { storage } from "../storage";
import {
  activityLogs, callLogs, notifications, roles, session, taskGroupMembers, taskGroups,
  taskSubscriptions, tasks, userSessions, users, workflowActionLog,
  workflowEvents, workflowRules, workflowRuns,
} from "@shared/schema";
import { runRule } from "./automation-engine";

// Real DB/engine integration, with only synthetic identities and no SIP, email,
// SMS, or external notification transport. Run only against a disposable dev DB.
// Set AUTOMATION_INBOUND_TEST_URL=http://127.0.0.1:5000 to verify authenticated
// task and notification endpoints against the running development application.
const suffix = randomUUID();
const prefix = `automation-inbound-${suffix}`;
const userIds = Array.from({ length: 3 }, () => randomUUID());
const groupIds = Array.from({ length: 3 }, () => randomUUID());
const roleIds = Array.from({ length: 3 }, () => randomUUID());
const ruleIds: string[] = [];
const eventIds: string[] = [];
const callLogIds: string[] = [];
const password = randomUUID();

async function checkAuthenticatedOverview(userIndex: number, taskId: string) {
  const baseUrl = process.env.AUTOMATION_INBOUND_TEST_URL;
  if (!baseUrl) return;
  const login = await fetch(new URL("/api/auth/login", baseUrl), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: `${prefix}-${userIndex}`, password }),
  });
  assert.equal(login.status, 200, `test user login failed: ${login.status}`);
  const cookies = login.headers.getSetCookie();
  const cookie = cookies.find(c => c.startsWith("connect.sid="))?.split(";")[0];
  if (!cookie) console.error("Login cookie names:", cookies.map(c => c.split("=")[0]));
  assert.ok(cookie, "authenticated login must return a session cookie");
  const get = async (path: string) => {
    let response = await fetch(new URL(path, baseUrl), { headers: { cookie } });
    // The PostgreSQL session store may commit just after the login response.
    for (let attempt = 0; response.status === 401 && attempt < 5; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      response = await fetch(new URL(path, baseUrl), { headers: { cookie } });
    }
    assert.equal(response.status, 200, `${path} must be available to logged-in agent`);
    return response.json();
  };
  const taskList = await get("/api/tasks?limit=200");
  assert.ok(taskList.data.some((task: any) => task.id === taskId &&
    task.tags.includes(`group_id:${groupIds[0]}`)));
  const notices = await get("/api/notifications?includeRead=true&includeDismissed=false&limit=100");
  assert.ok(notices.some((n: any) => n.title === prefix && n.countryCode === "SK" &&
    n.entityId === `${prefix}-call`));
}

async function fire(config: Record<string, unknown>, type: "create_task" | "notify_user" = "create_task",
  overrides: { campaignId?: string | null; countryCode?: string | null } = {}) {
  const ruleId = randomUUID();
  const eventId = randomUUID();
  ruleIds.push(ruleId);
  eventIds.push(eventId);
  await db.insert(workflowRules).values({
    id: ruleId, name: `${prefix}-rule`, module: "call", countryCode: "SK",
    trigger: { type: "event", entityType: "call", eventType: "call.timeout" },
    actions: [{ type, config }],
  });
  await db.insert(workflowEvents).values({
    id: eventId, source: "inbound-call", module: "call", entityType: "call",
    entityId: `${prefix}-call`, eventType: "call.timeout",
    countryCode: overrides.countryCode === undefined ? "SK" : overrides.countryCode,
    newValues: { callId: `${prefix}-call`, campaignId: overrides.campaignId === undefined ? `${prefix}-mission` : overrides.campaignId },
  });
  // Execute only the fixture rule; unrelated enabled rules must never run in a test.
  const [rule] = await db.select().from(workflowRules).where(eq(workflowRules.id, ruleId));
  const [event] = await db.select().from(workflowEvents).where(eq(workflowEvents.id, eventId));
  await runRule(rule, event, []);
  await db.update(workflowRules).set({ enabled: false }).where(eq(workflowRules.id, ruleId));
  const [run] = await db.select().from(workflowRuns)
    .where(and(eq(workflowRuns.ruleId, ruleId), eq(workflowRuns.eventId, eventId)));
  assert.ok(run, "the inbound event must reach the automation engine");
  return run;
}

async function run() {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Inbound delivery integration fixtures must not run in production");
  }
  try {
    const passwordHash = await bcrypt.hash(password, 4);
    for (let i = 0; i < userIds.length; i++) {
      await db.insert(users).values({
        id: userIds[i], username: `${prefix}-${i}`, email: `${prefix}-${i}@example.invalid`,
        fullName: `Test agent ${i}`, passwordHash, assignedCountries: ["SK"],
        isActive: i !== 2,
      });
    }
    for (let i = 0; i < groupIds.length; i++) {
      await db.insert(taskGroups).values({
        id: groupIds[i], name: `${prefix}-group-${i}`, isBackOffice: i === 0,
      });
    }
    await db.insert(taskGroupMembers).values([
      { groupId: groupIds[0], userId: userIds[0] },
      { groupId: groupIds[0], userId: userIds[1] },
      { groupId: groupIds[0], userId: userIds[2] },
      { groupId: groupIds[1], userId: userIds[0] },
      { groupId: groupIds[1], userId: userIds[1] },
    ]);
    for (let i = 0; i < roleIds.length; i++) {
      await db.insert(roles).values({
        id: roleIds[i], name: `${prefix}-role-${i}`, isActive: i !== 2,
        legacyRole: i === 1 ? "back_office" : null,
      });
    }
    await db.update(users).set({ roleId: roleIds[0] }).where(inArray(users.id, userIds.slice(0, 2)));

    // Exercise the real action handler with an outbound recipient template.
    // The call log owner and event recipient are both the persisted test user.
    const [outboundCall] = await db.insert(callLogs).values({
      userId: userIds[0],
      phoneNumber: "+421900000000",
      direction: "outbound",
      status: "initiated",
      startedAt: new Date(),
    }).returning({ id: callLogs.id });
    callLogIds.push(outboundCall.id);
    const outboundRuleId = randomUUID();
    const outboundEventId = randomUUID();
    const outboundNoticeTitle = `${prefix}-outbound-agent`;
    ruleIds.push(outboundRuleId);
    eventIds.push(outboundEventId);
    await db.insert(workflowRules).values({
      id: outboundRuleId,
      name: `${prefix}-outbound-agent-rule`,
      module: "call",
      trigger: { type: "event", entityType: "call", eventType: "outbound.started" },
      actions: [{
        type: "notify_user",
        config: { userId: "{{newValues.agentId}}", title: outboundNoticeTitle, message: "Outbound test" },
      }],
    });
    await db.insert(workflowEvents).values({
      id: outboundEventId,
      source: "storage",
      module: "call",
      entityType: "call",
      entityId: outboundCall.id,
      eventType: "outbound.started",
      newValues: { callId: outboundCall.id, agentId: userIds[0] },
    });
    const [outboundRule] = await db.select().from(workflowRules).where(eq(workflowRules.id, outboundRuleId));
    const [outboundEvent] = await db.select().from(workflowEvents).where(eq(workflowEvents.id, outboundEventId));
    await runRule(outboundRule, outboundEvent, []);
    const [outboundRun] = await db.select().from(workflowRuns).where(and(
      eq(workflowRuns.ruleId, outboundRuleId),
      eq(workflowRuns.eventId, outboundEventId),
    ));
    assert.equal(outboundRun?.status, "success", "verified outbound agent template must execute");
    const [outboundNotice] = await db.select().from(notifications)
      .where(eq(notifications.title, outboundNoticeTitle));
    assert.equal(outboundNotice?.userId, userIds[0], "outbound template must notify the persisted call owner");

    const bo = await fire({ taskGroupId: groupIds[0], title: prefix });
    assert.equal(bo.status, "success");
    const [boTask] = await db.select().from(tasks).where(eq(tasks.sourceRunId, bo.id));
    assert.ok(boTask);
    assert.equal((await db.select().from(tasks).where(eq(tasks.sourceRunId, bo.id))).length, 1);
    assert.equal(boTask.assignedUserId, [...userIds.slice(0, 2)].sort()[0]);
    assert.deepEqual(boTask.tags, [`group:${prefix}-group-0`, `group_id:${groupIds[0]}`, "back_office"]);
    assert.equal(boTask.country, "SK");
    assert.equal(boTask.relatedEntityId, `${prefix}-call`);
    assert.equal((bo.payload as any).newValues.campaignId, `${prefix}-mission`);

    const ordinary = await fire({ taskGroupId: groupIds[1], title: prefix });
    const ordinaryTasks = await db.select().from(tasks).where(eq(tasks.sourceRunId, ordinary.id));
    assert.equal(ordinaryTasks.length, 2);
    assert.deepEqual(ordinaryTasks.map(t => t.assignedUserId).sort(), userIds.slice(0, 2).sort());
    assert.ok(ordinaryTasks.every(t => t.country === "SK" && !t.tags.includes("back_office")));

    const role = await fire({ targetRole: `role:${prefix}-role-0`, title: prefix });
    assert.deepEqual((await db.select().from(tasks).where(eq(tasks.sourceRunId, role.id)))
      .map(t => t.assignedUserId).sort(), userIds.slice(0, 2).sort());
    await db.update(users).set({ roleId: roleIds[1] }).where(inArray(users.id, userIds.slice(0, 2)));
    const boRole = await fire({ targetRole: `role:${prefix}-role-1`, title: prefix });
    const boRoleTasks = await db.select().from(tasks).where(eq(tasks.sourceRunId, boRole.id));
    assert.equal(boRoleTasks.length, 1);
    assert.ok(boRoleTasks[0].tags.includes("back_office"));

    for (const config of [
      { taskGroupId: groupIds[2] }, // empty
      { taskGroupId: randomUUID() }, // deleted
      { targetRole: `role:${prefix}-role-2` }, // inactive
    ]) {
      const failed = await fire({ ...config, title: prefix });
      assert.equal(failed.status, "failed");
      assert.equal((await db.select().from(tasks).where(eq(tasks.sourceRunId, failed.id))).length, 0);
    }
    const missingMission = await fire({ taskGroupId: groupIds[0], title: prefix }, "create_task", { campaignId: null });
    const missingCountry = await fire({ taskGroupId: groupIds[0], title: prefix }, "create_task", { countryCode: null });
    const wrongCountry = await fire({ taskGroupId: groupIds[0], title: prefix, country: "CZ" });
    for (const rejected of [missingMission, missingCountry, wrongCountry]) {
      assert.equal(rejected.status, "failed");
      assert.equal((await db.select().from(tasks).where(eq(tasks.sourceRunId, rejected.id))).length, 0);
    }

    const notice = await fire({ taskGroupId: groupIds[0], title: prefix }, "notify_user");
    assert.equal(notice.status, "success");
    const roleNoticeTitle = `${prefix}-role-notice`;
    const roleNotice = await fire({ targetRole: `role:${prefix}-role-1`, title: roleNoticeTitle }, "notify_user");
    assert.equal(roleNotice.status, "success");
    for (const userId of userIds.slice(0, 2)) {
      // These are the same reads used by authenticated /api/tasks and /api/notifications.
      const visibleTasks = await storage.getAllTasks();
      assert.ok(visibleTasks.some(t => t.id === boTask.id && t.tags.includes(`group_id:${groupIds[0]}`)));
      assert.ok((await storage.getNotifications(userId, { includeRead: true }))
        .some(n => n.title === prefix && n.countryCode === "SK" && n.entityId === `${prefix}-call`));
      assert.ok((await storage.getNotifications(userId, { includeRead: true }))
        .some(n => n.title === roleNoticeTitle && n.countryCode === "SK"));
    }
    assert.equal((await storage.getNotifications(userIds[2], { includeRead: true }))
      .filter(n => n.title === prefix).length, 0);
    assert.equal((await db.select().from(notifications).where(eq(notifications.title, prefix))).length, 2);
    assert.equal((await db.select().from(notifications).where(eq(notifications.title, roleNoticeTitle))).length, 2);
    for (const i of [0, 1]) await checkAuthenticatedOverview(i, boTask.id);
    const rejectedNotice = await fire({ taskGroupId: groupIds[0], title: prefix, countryCode: "CZ" }, "notify_user");
    assert.equal(rejectedNotice.status, "failed");
    assert.equal((await db.select().from(notifications).where(eq(notifications.title, prefix))).length, 2);

    // Guard the authenticated page wiring as well as the persisted API reads.
    const page = readFileSync("client/src/pages/tasks.tsx", "utf8");
    const hook = readFileSync("client/src/hooks/use-notifications.ts", "utf8");
    assert.match(page, /queryKey:\s*\["\/api\/tasks"\]/);
    assert.match(page, /group_id:\$\{g\.id\}/);
    assert.match(hook, /\/api\/notifications\?includeRead=true&includeDismissed=false&limit=100/);
    console.log("Inbound automation delivery integration passed");
  } finally {
    // Always remove fixtures, even if an assertion fails. No real users or calls are touched.
    const runs = ruleIds.length ? await db.select({ id: workflowRuns.id }).from(workflowRuns)
      .where(inArray(workflowRuns.ruleId, ruleIds)) : [];
    if (runs.length) {
      const ids = runs.map(r => r.id);
      await db.delete(taskSubscriptions).where(inArray(taskSubscriptions.taskId,
        (await db.select({ id: tasks.id }).from(tasks).where(inArray(tasks.sourceRunId, ids))).map(t => t.id)));
      await db.delete(tasks).where(inArray(tasks.sourceRunId, ids));
      await db.delete(workflowActionLog).where(inArray(workflowActionLog.runId, ids));
      await db.delete(workflowRuns).where(inArray(workflowRuns.id, ids));
    }
    await db.delete(notifications).where(inArray(notifications.title, [prefix, `${prefix}-role-notice`]));
    await db.delete(notifications).where(eq(notifications.title, `${prefix}-outbound-agent`));
    if (eventIds.length) await db.delete(workflowEvents).where(inArray(workflowEvents.id, eventIds));
    if (ruleIds.length) await db.delete(workflowRules).where(inArray(workflowRules.id, ruleIds));
    if (callLogIds.length) await db.delete(callLogs).where(inArray(callLogs.id, callLogIds));
    await db.delete(taskGroupMembers).where(inArray(taskGroupMembers.groupId, groupIds));
    await db.delete(taskGroups).where(inArray(taskGroups.id, groupIds));
    await db.delete(session).where(sql`${session.sess}->'user'->>'id' IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
    await db.delete(userSessions).where(inArray(userSessions.userId, userIds));
    await db.delete(activityLogs).where(inArray(activityLogs.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
    await db.delete(roles).where(inArray(roles.id, roleIds));
    await pool.end();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });