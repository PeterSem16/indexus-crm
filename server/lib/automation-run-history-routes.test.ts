import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import bcrypt from "bcrypt";
import { eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../db";
import { users, chatMessages, tasks, workflowRules, workflowEvents, workflowRuns, workflowActionLog,
  activityLogs, session, userSessions } from "../../shared/schema";
import { canReadRunSource } from "./automation-run-source";

test("non-analysis history enforces live source access through the API, including changed rules and deleted sources", async () => {
  const base = process.env.AUTOMATION_HISTORY_TEST_URL;
  assert.ok(base, "Set AUTOMATION_HISTORY_TEST_URL to the running development server");
  const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const ruleId = randomUUID(), eventId = randomUUID(), messageId = randomUUID(), runId = randomUUID(), taskId = randomUUID();
  const prefix = `history-privacy-${randomUUID()}`, password = randomUUID();
  try {
    const passwordHash = await bcrypt.hash(password, 4);
    await db.insert(users).values(ids.map((id, index) => ({
      id, username: `${prefix}-${index}`, fullName: "Synthetic history test",
      email: `${prefix}-${index}@example.invalid`, passwordHash,
      role: index < 2 ? "user" : "admin", isActive: true, assignedCountries: ["SK"],
    })));
    await db.insert(chatMessages).values({ id: messageId, senderId: ids[0], receiverId: ids[1],
      content: "PRIVATE-chat-body" });
    const [rule] = await db.insert(workflowRules).values({ id: ruleId, name: prefix, module: "communication",
      enabled: false, createdByUserId: ids[0], trigger: { type: "event", eventType: "chat.received" },
      actions: [{ type: "send_email", config: { body: "PRIVATE-template" } }] }).returning();
    const [event] = await db.insert(workflowEvents).values({ id: eventId, module: "communication",
      entityType: "communication", entityId: messageId, eventType: "chat.received", source: "manual",
      newValues: { content: "PRIVATE-event-copy" } }).returning();
    await db.insert(workflowRuns).values({ id: runId, ruleId, eventId, status: "failed",
      payload: { event, rule }, error: "PRIVATE-vendor-error", finishedAt: new Date() });
    await db.insert(workflowActionLog).values({ runId, actionIndex: 0, actionType: "send_email",
      status: "failed", output: { path: "/internal/PRIVATE", body: "PRIVATE-response" },
      error: "PRIVATE-vendor-error", retryCount: 2 });
    const path = `/api/automation/runs/${runId}`;
    const anonymous = await fetch(new URL(path, base));
    assert.equal(anonymous.status, 401);
    const login = async (index: number) => {
      const response = await fetch(new URL("/api/auth/login", base), { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ username: `${prefix}-${index}`, password }) });
      assert.equal(response.status, 200);
      const cookie = response.headers.get("set-cookie")?.split(";")[0];
      assert.ok(cookie);
      return cookie;
    };
    const [participant, outsider] = await Promise.all([login(1), login(2)]);
    const get = async (cookie: string) => {
      const response = await fetch(new URL(path, base), { headers: { cookie } });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control") || "", /no-store/);
      const detail = await response.json();
      assert.doesNotMatch(JSON.stringify(detail), /PRIVATE|internal|payload|newValues|actionResults|error|output/);
      return detail;
    };
    assert.equal(await canReadRunSource(rule, event, ids[1]), true);
    assert.equal(await canReadRunSource(rule, event, ids[2]), false, "admin role never grants access to private chat");
    const detail = await get(participant);
    assert.equal(detail.sourceAccess, "available");
    assert.equal(detail.actions.length, 1);
    assert.equal(detail.actions[0].status, "failed");
    assert.equal(detail.actions[0].retryCount, 2);
    assert.ok(detail.actions[0].executedAt);
    assert.deepEqual((await get(outsider)).actions, []);
    const listResponse = await fetch(new URL(`/api/automation/runs?ruleId=${ruleId}`, base),
      { headers: { cookie: outsider } });
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json();
    assert.equal(list.length, 1);
    assert.doesNotMatch(JSON.stringify(list), /PRIVATE|internal|payload|error|output|eventId/);

    if (process.env.AUTOMATION_HISTORY_BROWSER === "1") {
      const { chromium, expect } = await import("@playwright/test");
      const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"],
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
      try {
        // Admin outsider is used to verify both operational navigation and denied detail.
        const context = await browser.newContext();
        await context.addCookies([{ name: "connect.sid", value: outsider.slice("connect.sid=".length), url: base }]);
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto(new URL("/automations?tab=runs", base).toString());
        await page.getByTestId(`row-globalrun-${runId}`).click();
        await expect(page.locator(".rh-inspector [role=status]")).toBeVisible();
        await expect(page.locator(".rh-logged-action")).toHaveCount(0);
        assert.doesNotMatch(await page.locator(".rh-inspector").innerText(), /PRIVATE|internal|vendor/);

        // Make this admin an actual chat participant, without changing the history rule.
        await db.update(chatMessages).set({ receiverId: ids[2] }).where(eq(chatMessages.id, messageId));
        await page.reload();
        await page.getByTestId(`row-globalrun-${runId}`).click();
        await expect(page.locator(".rh-logged-action")).toHaveCount(1);
        await expect(page.locator(".rh-logged-action time")).toBeVisible();
        await expect(page.locator(".rh-raw-json")).toHaveCount(0);
        assert.doesNotMatch(await page.locator(".rh-inspector").innerText(), /PRIVATE|internal|vendor/);
        assert.deepEqual(errors, []);
        await db.update(chatMessages).set({ receiverId: ids[1] }).where(eq(chatMessages.id, messageId));
      } finally { await browser.close(); }
    }

    // Current rule no longer describes the executed source or actions.
    await db.update(workflowRules).set({ module: "task", trigger: { type: "event", eventType: "task.completed",
      analysis: { channels: ["task"], analyzeAttachments: true } }, actions: [] }).where(eq(workflowRules.id, ruleId));
    const historical = await get(participant);
    assert.equal(historical.sourceAccess, "available");
    assert.equal(historical.actions[0].actionType, "send_email");
    assert.equal("attachmentAnalysis" in historical, false);

    // Task history uses the existing task policy, not rule ownership.
    await db.insert(tasks).values({ id: taskId, title: "PRIVATE-task", assignedUserId: ids[1],
      createdByUserId: ids[0], country: "SK" });
    const taskEvent = { ...event, module: "task", entityType: "task", entityId: taskId, eventType: "created" };
    assert.equal(await canReadRunSource(rule, taskEvent, ids[1]), true);
    await db.update(tasks).set({ assignedUserId: ids[3] }).where(eq(tasks.id, taskId));
    assert.equal(await canReadRunSource(rule, taskEvent, ids[1]), false, "revoked task assignment takes effect immediately");
    await db.delete(tasks).where(eq(tasks.id, taskId));
    assert.equal(await canReadRunSource(rule, taskEvent, ids[1]), false);

    // Deletion of a source cannot expose its retained event or payload copies.
    await db.delete(chatMessages).where(eq(chatMessages.id, messageId));
    const deleted = await get(participant);
    assert.equal(deleted.sourceAccess, "unavailable");
    assert.deepEqual(deleted.actions, []);
    await db.delete(workflowEvents).where(eq(workflowEvents.id, eventId));
    assert.equal((await get(participant)).sourceAccess, "unavailable");
    await db.delete(workflowRules).where(eq(workflowRules.id, ruleId));
    assert.equal((await get(participant)).sourceAccess, "unavailable");
  } finally {
    await db.delete(workflowActionLog).where(eq(workflowActionLog.runId, runId));
    await db.delete(workflowRuns).where(eq(workflowRuns.id, runId));
    await db.delete(workflowEvents).where(eq(workflowEvents.id, eventId));
    await db.delete(workflowRules).where(eq(workflowRules.id, ruleId));
    await db.delete(chatMessages).where(eq(chatMessages.id, messageId));
    await db.delete(tasks).where(eq(tasks.id, taskId));
    await db.delete(activityLogs).where(inArray(activityLogs.userId, ids));
    await db.delete(userSessions).where(inArray(userSessions.userId, ids));
    for (const id of ids) await db.delete(session).where(sql`sess::text LIKE ${`%${id}%`}`);
    await db.delete(users).where(inArray(users.id, ids));
    await pool.end();
  }
});
