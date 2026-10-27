import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import bcrypt from "bcrypt";
import { eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../db";
import { users, chatMessages, workflowRules, workflowEvents, workflowRuns, workflowActionLog,
  activityLogs, session, userSessions } from "../../shared/schema";
import { listSourceAttachments, readSourceAttachment, type AnalysisSource } from "./automation-analysis-source";
import { attachmentActivity } from "./automation-attachment-activity";
import { inspectAnalysisSource } from "./automation-analysis-source";

test("persisted private results stay authorized through API, browser and revoked source access", async () => {
  const userIds = [randomUUID(), randomUUID(), randomUUID()];
  const ruleId = randomUUID(), eventId = randomUUID(), messageId = randomUUID(), runId = randomUUID();
  const prefix = `attachment-outcomes-${randomUUID()}`, password = randomUUID();
  try {
    const passwordHash = await bcrypt.hash(password, 4);
    await db.insert(users).values(userIds.map((id, index) => ({ id, username: `${prefix}-${index}`,
      fullName: "Synthetic attachment test", email: `${prefix}-${index}@example.invalid`,
      passwordHash, role: "admin", isActive: true, assignedCountries: ["SK"] })));
    await db.insert(chatMessages).values({ id: messageId, senderId: userIds[0], receiverId: userIds[1],
      content: "PRIVATE-CHAT-CONTENT" });
    const [rule] = await db.insert(workflowRules).values({ id: ruleId, name: prefix, module: "communication",
      enabled: false, countryCodes: ["SK"], createdByUserId: userIds[0],
      trigger: { type: "event", eventType: "communication.received", entityType: "communication",
        analysis: { channels: ["chat"], analyzeContent: false, analyzeAttachments: true } }, actions: [] }).returning();
    const [event] = await db.insert(workflowEvents).values({ id: eventId, module: "communication",
      entityType: "communication", entityId: messageId, eventType: "chat.received", source: "manual" }).returning();
    const [run] = await db.insert(workflowRuns).values({ id: runId, ruleId, eventId, status: "success",
      payload: { analysis: { summary: "PRIVATE-DOCUMENT-CONTENT", attachments: [{ name: "/internal/PRIVATE" }],
        attachmentOutcomes: [{ position: 1, result: "invoice" }, { position: 2, result: "other" },
          { position: 3, result: "unprocessed", reason: "missing" },
          { position: 4, result: "unprocessed", reason: "unsupported" },
          { position: 5, result: "unprocessed", reason: "encrypted" },
          { position: 6, result: "unprocessed", reason: "unavailable" }] } },
      error: "PRIVATE-VENDOR-ERROR", finishedAt: new Date() }).returning();
    const deps = { rule: async () => rule, event: async () => event, canRead: inspectAnalysisSource };
    assert.equal((await attachmentActivity(run, userIds[0], deps)).status, "available");
    assert.equal((await attachmentActivity(run, userIds[1], deps)).status, "available");
    assert.deepEqual(await attachmentActivity(run, userIds[2], deps), { status: "unavailable", outcomes: [] });
    const missing = await listSourceAttachments({ channel: "chat", privateAttachments: [{ id: randomUUID() }],
      text: "", communication: {}, ownerUserId: userIds[0] } as AnalysisSource);
    assert.equal(missing.length, 1, "missing registry metadata must not abort the attachment list");
    await assert.rejects(readSourceAttachment({ channel: "chat" } as AnalysisSource, missing[0]), /analysis_attachment_missing/);

    const base = process.env.AUTOMATION_ATTACHMENT_TEST_URL;
    if (base) {
      const path = `/api/automation/runs/${runId}`;
      assert.equal((await fetch(new URL(path, base))).status, 401);
      const login = async (index: number) => {
        const response = await fetch(new URL("/api/auth/login", base), { method: "POST",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ username: `${prefix}-${index}`, password }) });
        assert.equal(response.status, 200);
        const cookie = response.headers.get("set-cookie")?.split(";")[0];
        assert.ok(cookie);
        return cookie;
      };
      const cookie = await login(0), outsiderCookie = await login(2);
      const get = (path: string, credential = cookie) => fetch(new URL(path, base), { headers: { cookie: credential } });
      const response = await get(path);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control") || "", /no-store/);
      const detail = await response.json();
      assert.equal(detail.attachmentAnalysis.outcomes.length, 6);
      assert.doesNotMatch(JSON.stringify(detail), /PRIVATE|internal|payload|eventId|sourceAttachmentId/);
      assert.deepEqual((await (await get(path, outsiderCookie)).json()).attachmentAnalysis, { status: "unavailable", outcomes: [] });
      const list = await (await get(`/api/automation/runs?ruleId=${ruleId}`)).json();
      assert.equal(list.length, 1);
      assert.doesNotMatch(JSON.stringify(list), /PRIVATE|payload|eventId|actionResults/);

      if (process.env.AUTOMATION_ATTACHMENT_BROWSER === "1") {
        const { chromium, expect } = await import("@playwright/test");
        const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"],
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
        try {
          const context = await browser.newContext();
          await context.addCookies([{ name: "connect.sid", value: cookie.slice("connect.sid=".length), url: base }]);
          const page = await context.newPage();
          const errors: string[] = [], writes: string[] = [];
          page.on("pageerror", error => errors.push(error.message));
          page.on("request", request => {
            if (request.method() !== "GET" && request.url().includes("/api/automation/")) writes.push(request.url());
          });
          await page.goto(new URL("/automations?tab=runs", base).toString());
          await page.getByTestId(`row-globalrun-${runId}`).click();
          const panel = page.getByTestId("automation-attachment-results");
          await expect(panel).toBeVisible();
          await expect(panel.locator("li")).toHaveCount(6);
          assert.match(await panel.innerText(), /Invoice|Faktúra/);
          assert.doesNotMatch(await panel.innerText(), /PRIVATE|internal|Vendor/);
          await page.setViewportSize({ width: 390, height: 844 });
          assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
          assert.deepEqual(errors, []);
          assert.deepEqual(writes, [], "viewing evidence must not replay analysis or actions");
        } finally { await browser.close(); }
      }
      await db.delete(chatMessages).where(eq(chatMessages.id, messageId));
      assert.deepEqual((await (await get(path)).json()).attachmentAnalysis, { status: "unavailable", outcomes: [] });
      assert.equal((await db.select().from(workflowRuns).where(eq(workflowRuns.ruleId, ruleId))).length, 1);
      assert.equal((await db.select().from(workflowActionLog).where(eq(workflowActionLog.runId, runId))).length, 0);
    }
  } finally {
    await db.delete(workflowActionLog).where(eq(workflowActionLog.runId, runId));
    await db.delete(workflowRuns).where(eq(workflowRuns.ruleId, ruleId));
    await db.delete(workflowEvents).where(eq(workflowEvents.id, eventId));
    await db.delete(workflowRules).where(eq(workflowRules.id, ruleId));
    await db.delete(chatMessages).where(eq(chatMessages.id, messageId));
    await db.delete(activityLogs).where(inArray(activityLogs.userId, userIds));
    await db.delete(userSessions).where(inArray(userSessions.userId, userIds));
    for (const id of userIds) await db.delete(session).where(sql`sess::text LIKE ${`%${id}%`}`);
    await db.delete(users).where(inArray(users.id, userIds));
    await pool.end();
  }
});
