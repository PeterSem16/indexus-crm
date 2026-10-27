import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import bcrypt from "bcrypt";
import { eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../db";
import { activityLogs, callRecordings, chatMessages, communicationMessages, session, taskComments, tasks, users, userSessions,
  workflowEvents, workflowRules, workflowRuns, type WorkflowEvent } from "../../shared/schema";
import { diagnoseAnalysisEligibility } from "./automation-eligibility";
import { eventMatchesRule, eventRuleExclusion } from "./automation-engine";
import { inspectAnalysisSource, loadAnalysisSource } from "./automation-analysis-source";
import { listEligibilitySources } from "./automation-eligibility-sources";
import { ELIGIBILITY_SOURCE_EVENTS } from "../../shared/automation-eligibility";
import { ensureAutomationInputHistorySchema } from "./automation-input-history-schema";

// Real persisted source policies and route checks; synthetic fixtures only.
// Stored rule is paused, so mailbox polling cannot run this test's analysis.
test("read-only eligibility distinguishes entry gates without disclosing private source data", async () => {
  await ensureAutomationInputHistorySchema(pool);
  const ids = Array.from({ length: 4 }, () => randomUUID());
  const sourceIds = Array.from({ length: 3 }, () => randomUUID());
  const eventIds = Array.from({ length: 2 }, () => randomUUID());
  const pickerIds = Array.from({ length: 11 }, () => randomUUID());
  const ruleId = randomUUID(), password = randomUUID(), prefix = `eligibility-${randomUUID()}`;
  const originalFetch = globalThis.fetch;
  try {
    const passwordHash = await bcrypt.hash(password, 4);
    await db.insert(users).values(ids.map((id, i) => ({ id, username: `${prefix}-${i}`,
      fullName: "Synthetic diagnostic user", email: `${prefix}-${i}@example.invalid`, passwordHash,
      role: i === 0 ? "admin" : "manager", assignedCountries: ["SK"], isActive: i !== 3 })));
    await db.insert(communicationMessages).values({ id: sourceIds[0], type: "email", direction: "inbound",
      content: "PRIVATE-CONTENT-MUST-NOT-LEAK", subject: "PRIVATE-SUBJECT", userId: ids[0], countryCode: "SK",
      externalId: `${prefix}-external`, metadata: JSON.stringify({ from: "private@example.invalid",
        mailboxSource: { kind: "personal", ownerUserId: ids[0] } }) });
    await db.insert(chatMessages).values([
      { id: sourceIds[1], senderId: ids[0], receiverId: ids[1], content: "PRIVATE-CHAT" },
      { id: sourceIds[2], senderId: ids[1], receiverId: ids[2], content: "OTHER-PRIVATE-CHAT" },
    ]);
    const [persisted] = await db.insert(workflowRules).values({ id: ruleId, name: prefix, module: "communication",
      enabled: false, countryCodes: ["SK"], createdByUserId: ids[0],
      trigger: { type: "event", entityType: "communication", eventType: "communication.received",
        analysis: { channels: ["email", "chat"], analyzeContent: true, analyzeAttachments: false } },
      actions: [] }).returning();
    const rule = { ...persisted, enabled: true };
    const [emailEvent, chatEvent] = await db.insert(workflowEvents).values([
      { id: eventIds[0], module: "communication", entityType: "communication", entityId: sourceIds[0],
        source: "manual", eventType: "email.received", countryCode: "SK" },
      { id: eventIds[1], module: "communication", entityType: "communication", entityId: sourceIds[1],
        source: "manual", eventType: "chat.received", countryCode: null },
    ]).returning();
    // All direct diagnostics must stay local: even an email with missing legacy
    // envelope fields must not refresh a token, fetch Graph, or invoke AI.
    globalThis.fetch = async () => { throw new Error("Diagnostics must not use external transport"); };
    const check = (candidate = rule, sourceId = sourceIds[0], eventType: any = "email.received", viewer = ids[0]) =>
      diagnoseAnalysisEligibility(candidate, viewer, sourceId, eventType);
    assert.deepEqual((await check()).reasons, ["eligible"]);
    assert.equal((await check()).countryUnknown, false);
    assert.equal((await check()).history.status, "verified");
    assert.equal(eventMatchesRule(rule, emailEvent), true);
    const laterRule = { ...rule, createdAt: new Date(chatEvent.createdAt.getTime() + 60000) };
    assert.equal(eventMatchesRule(laterRule, chatEvent), false);
    assert.equal(eventRuleExclusion(laterRule, chatEvent), "before_activation");
    assert.deepEqual((await check(laterRule, sourceIds[1], "chat.received")).reasons, ["before_activation"]);
    assert.deepEqual((await check(persisted)).reasons, ["rule_disabled"]);
    assert.deepEqual((await check({ ...rule, countryCodes: ["CZ"] })).reasons, ["country_mismatch"]);
    assert.deepEqual((await check(rule, sourceIds[1], "chat.received")).reasons, ["country_unknown"]);
    assert.equal((await check(rule, sourceIds[1], "chat.received")).countryUnknown, true);
    assert.deepEqual((await check({ ...rule, countryCodes: null, countryCode: null }, sourceIds[1], "chat.received")).reasons, ["eligible"]);
    assert.deepEqual((await check({ ...rule, countryCodes: [] }, sourceIds[1], "chat.received")).reasons, ["country_unknown"]);
    const trigger = rule.trigger as any;
    const config = (patch: object) => ({ ...rule, trigger: { ...trigger, analysis: { ...trigger.analysis, ...patch } } });
    assert.deepEqual((await check(config({ channels: ["chat"] }))).reasons, ["channel_unselected"]);
    assert.deepEqual((await check(config({ mailboxMode: "selected", mailboxUserIds: [ids[1]] }))).reasons, ["mailbox_filtered"]);
    assert.deepEqual((await check(config({ senderEmails: ["other@example.invalid"] }))).reasons, ["sender_filtered"]);
    assert.deepEqual((await check(config({ senderEmails: ["PRIVATE@example.invalid"] }))).reasons, ["eligible"]);
    assert.deepEqual((await check({ ...rule, createdByUserId: ids[1] })).reasons, ["creator_restricted"]);
    assert.deepEqual((await check({ ...rule, createdByUserId: ids[3] })).reasons, ["creator_restricted"]);
    const restricted = await check({ ...rule, createdByUserId: ids[3] });
    assert.equal(restricted.history.status, "verified", "current author restriction must not rewrite historical settings");
    assert.equal(restricted.history.permissions, "unknown", "never derive past permissions from current access");
    // Admin role is not permission to inspect unrelated private chat.
    assert.deepEqual((await check(rule, sourceIds[2], "chat.received")).reasons, ["source_unavailable"]);
    assert.deepEqual((await check(rule, randomUUID(), "chat.received")).reasons, ["source_unavailable"]);
    assert.equal((await check(rule, sourceIds[2], "chat.received")).history.status, "unavailable");
    assert.deepEqual((await check({ ...rule, createdByUserId: ids[1] }, sourceIds[2], "chat.received", ids[1])).reasons, ["event_missing"]);
    assert.deepEqual((await check(rule, sourceIds[0], "email.received", ids[1])).reasons, ["source_unavailable"]);
    assert.deepEqual((await check({ ...rule, trigger: { ...trigger, listenAfter: new Date(Date.now() + 60000).toISOString() } })).reasons, ["before_activation"]);
    assert.deepEqual((await check({ ...rule, trigger: { ...trigger, reviewActivatedAt: new Date(Date.now() + 60000).toISOString() } })).reasons, ["before_activation"]);
    // Matching and diagnostic use one execution gate, including result-based WHEN.
    for (const patch of [{ enabled: false }, { module: "task" }, { countryCodes: ["CZ"] }, { countryCodes: null },
      { trigger: { ...trigger, entityType: "other" } }, { trigger: { ...trigger, type: "schedule" } },
      { trigger: { ...trigger, eventType: "communication.sentiment.positive" } }]) {
      const candidate = { ...rule, ...patch } as typeof rule;
      for (const event of [emailEvent, chatEvent])
        assert.equal(eventMatchesRule(candidate, event), eventRuleExclusion(candidate, event) === null);
    }
    assert.equal(await loadAnalysisSource(config({ channels: ["chat"] }), emailEvent), null);
    assert.equal(await loadAnalysisSource({ ...rule, createdByUserId: ids[1] }, emailEvent), null);
    assert.equal(await inspectAnalysisSource(rule, { ...chatEvent, entityId: sourceIds[2] } as WorkflowEvent), null);
    const serialized = JSON.stringify(await check());
    assert.doesNotMatch(serialized, /PRIVATE|example\.invalid|ownerUserId|"(content|subject|token|attachments)"\s*:/i);
    const fixtureTime = new Date(Date.now() - 3600000);
    const from = fixtureTime, to = new Date(fixtureTime.getTime() + 1);
    await db.insert(communicationMessages).values([
      { id: pickerIds[0], type: "email", direction: "inbound", userId: ids[0],
        content: "PRIVATE-EMAIL", subject: "PRIVATE-SUBJECT", createdAt: fixtureTime },
      { id: pickerIds[1], type: "sms", direction: "inbound", countryCode: "SK", provider: "bulkgate",
        content: "PRIVATE-SMS", createdAt: fixtureTime },
      { id: pickerIds[2], type: "email", direction: "outbound", userId: ids[0],
        content: "PRIVATE-OUTBOUND", createdAt: fixtureTime },
      { id: pickerIds[3], type: "email", direction: "inbound", userId: ids[0],
        content: "PRIVATE-OLD", createdAt: new Date(fixtureTime.getTime() - 1) },
    ]);
    await db.insert(chatMessages).values([
      { id: pickerIds[4], senderId: ids[0], receiverId: ids[1], content: "PRIVATE-CHAT", createdAt: fixtureTime },
      { id: pickerIds[5], senderId: ids[1], receiverId: ids[2], content: "PRIVATE-OTHER-CHAT", createdAt: fixtureTime },
    ]);
    await db.insert(tasks).values({ id: pickerIds[6], assignedUserId: ids[0], createdByUserId: ids[0],
      country: "SK", title: "PRIVATE-TASK", description: "PRIVATE-BODY", createdAt: fixtureTime });
    await db.insert(taskComments).values({ id: pickerIds[7], taskId: pickerIds[6], userId: ids[0],
      content: "PRIVATE-COMMENT", createdAt: fixtureTime });
    await db.insert(callRecordings).values([
      { id: pickerIds[8], callLogId: randomUUID(), userId: ids[0], filename: "private.webm",
        filePath: "/private", transcriptionText: "PRIVATE-TRANSCRIPT", analysisStatus: "completed", createdAt: fixtureTime },
      { id: pickerIds[9], callLogId: randomUUID(), userId: ids[0], filename: "private.webm",
        filePath: "/private", transcriptionText: null, analysisStatus: "completed", createdAt: fixtureTime },
      { id: pickerIds[10], callLogId: randomUUID(), userId: ids[0], filename: "private.webm",
        filePath: "/private", transcriptionText: "PRIVATE-PENDING", analysisStatus: "pending", createdAt: fixtureTime },
    ]);
    const expected = { "email.received": pickerIds[0], "sms.received": pickerIds[1], "chat.received": pickerIds[4],
      "task.body_received": pickerIds[6], "task.message_received": pickerIds[7], "voice.transcribed": pickerIds[8] };
    for (const sourceEvent of ELIGIBILITY_SOURCE_EVENTS) {
      const list = await listEligibilitySources(rule, ids[0], { sourceEvent, from, to });
      assert.deepEqual(list, { records: [{ id: expected[sourceEvent], createdAt: fixtureTime.toISOString() }] });
      assert.doesNotMatch(JSON.stringify(list), /PRIVATE|example\.invalid|content|subject|token|attachments|filePath/);
      // No special admin shortcuts: same policy for every source, including SMS.
      const managerList = await listEligibilitySources(rule, ids[2], { sourceEvent, from, to });
      const probe = { module: "communication", eventType: sourceEvent, entityId: expected[sourceEvent] } as WorkflowEvent;
      assert.equal(managerList.records.some(row => row.id === expected[sourceEvent]), !!await inspectAnalysisSource(rule, probe, ids[2]));
      assert.deepEqual(await listEligibilitySources(rule, ids[3], { sourceEvent, from, to }), { records: [] });
    }
    assert.deepEqual(await listEligibilitySources(rule, ids[0], {
      sourceEvent: "email.received", from: to, to: new Date(to.getTime() + 1),
    }), { records: [] }, "exclusive upper time boundary");
    globalThis.fetch = originalFetch;

    const base = process.env.AUTOMATION_ELIGIBILITY_TEST_URL;
    if (base) {
      const path = `/api/automation/rules/${ruleId}/eligibility?${new URLSearchParams({ sourceId: sourceIds[0], sourceEvent: "email.received" })}`;
      assert.equal((await fetch(new URL(path, base))).status, 401);
      const login = async (index: number) => {
        const response = await fetch(new URL("/api/auth/login", base), { method: "POST",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ username: `${prefix}-${index}`, password }) });
        assert.equal(response.status, 200);
        const cookie = response.headers.getSetCookie().find(c => c.startsWith("connect.sid="))?.split(";")[0];
        assert.ok(cookie);
        return cookie;
      };
      const adminCookie = await login(0), managerCookie = await login(1);
      const get = async (url: string, cookie = adminCookie) => {
        let response = await fetch(new URL(url, base), { headers: { cookie } });
        for (let i = 0; response.status === 401 && i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 150));
          response = await fetch(new URL(url, base), { headers: { cookie } });
        }
        return response;
      };
      // The incoming shared sidebar must read its own count without gaining
      // cross-user mailbox access. Synthetic users have no connected mailbox.
      const ownUnread = await get(`/api/users/${ids[0]}/ms365-unread-counts`);
      assert.equal(ownUnread.status, 200);
      assert.deepEqual(await ownUnread.json(), { connected: false, counts: [] });
      assert.equal((await get(`/api/users/${ids[1]}/ms365-unread-counts`)).status, 403);
      const managerUnread = await get(`/api/users/${ids[1]}/ms365-unread-counts`, managerCookie);
      assert.equal(managerUnread.status, 200);
      assert.equal((await get(`/api/users/${ids[0]}/ms365-unread-counts`, managerCookie)).status, 403);
      assert.equal((await get(path, managerCookie)).status, 403);
      const listPath = `/api/automation/rules/${ruleId}/eligibility-sources?${new URLSearchParams({
        sourceEvent: "chat.received", from: from.toISOString(), to: to.toISOString(),
      })}`;
      assert.equal((await fetch(new URL(listPath, base))).status, 401);
      assert.equal((await get(listPath, managerCookie)).status, 403);
      const listResponse = await get(listPath);
      assert.equal(listResponse.status, 200);
      assert.equal(listResponse.headers.get("cache-control"), "no-store");
      assert.deepEqual(await listResponse.json(), { records: [{ id: pickerIds[4], createdAt: fixtureTime.toISOString() }] });
      assert.equal((await get(`/api/automation/rules/${ruleId}/eligibility-sources?sourceEvent=wrong`)).status, 400);
      assert.equal((await get(listPath.replace(ruleId, randomUUID()))).status, 404);
      const response = await get(path);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = await response.json();
      assert.deepEqual(body.reasons, ["rule_disabled"]);
      assert.equal(body.countryUnknown, false);
      assert.equal(body.history.status, "verified");
      assert.equal((await get(`/api/automation/rules/${ruleId}/eligibility?sourceId=x&sourceEvent=wrong`)).status, 400);
      assert.equal((await get(`/api/automation/rules/${randomUUID()}/eligibility?sourceId=x&sourceEvent=chat.received`)).status, 404);
      const hidden = await get(`/api/automation/rules/${ruleId}/eligibility?sourceId=${sourceIds[2]}&sourceEvent=chat.received`);
      assert.deepEqual(await hidden.json(), { reasons: ["source_unavailable"], countryUnknown: false,
        history: { status: "unavailable", permissions: "unknown" } });
      if (process.env.AUTOMATION_ELIGIBILITY_BROWSER_TEST === "1") {
        const { chromium, expect } = await import("@playwright/test");
        const browser = await chromium.launch({ headless: true,
          executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
        try {
          const context = await browser.newContext();
          await context.addCookies([{ name: "connect.sid", value: adminCookie.slice("connect.sid=".length), url: base }]);
          const page = await context.newPage();
          const errors: string[] = [], requests: string[] = [];
          page.on("pageerror", error => errors.push(error.message));
          page.on("request", request => { if (request.url().includes("/api/automation/")) requests.push(request.url()); });
          await page.goto(new URL("/automations?tab=runs", base).toString());
          const panel = page.getByTestId("automation-eligibility");
          await expect(panel).toBeVisible({ timeout: 20000 });
          const history = panel.getByTestId("automation-eligibility-history");
          await panel.locator("summary").click();
          await panel.locator("select").first().selectOption(ruleId);
          assert.equal(requests.filter(url => url.includes("/eligibility?")).length, 0, "opening must not inspect or execute");
          await panel.getByRole("button", { name: /load available|načítať dostupné/i }).click();
          await expect(panel.locator("select").nth(3)).toBeEnabled();
          await panel.locator("select").nth(3).selectOption(sourceIds[0]);
          assert.equal(requests.filter(url => url.includes("/eligibility?")).length, 0, "loading/selecting must not inspect or execute");
          await panel.locator("button[type=submit]").click();
          await expect(panel.getByRole("status")).toContainText(/paused|pozastaven/i);
          await expect(panel.getByRole("status").locator("li")).toHaveCount(1);
          await expect(history).toContainText(/Verified historical settings|Overené historické nastavenie/i);
          await expect(history).toContainText(/not eligibility|nie zaradenie/i);
          assert.doesNotMatch(await panel.innerText(), /PRIVATE-CONTENT|PRIVATE-SUBJECT|private@example/);
          await page.route("**/eligibility?**", route => route.fulfill({ status: 503, body: "{}" }));
          await panel.locator("button[type=submit]").click();
          await expect(panel.getByRole("alert")).toBeVisible();
          await page.unroute("**/eligibility?**");
          await panel.locator("button[type=submit]").click();
          await expect(panel.getByRole("status")).toBeVisible();
          await db.update(workflowRules).set({ countryCodes: ["CZ"] }).where(eq(workflowRules.id, ruleId));
          await panel.locator("button[type=submit]").click();
          await expect(history).toContainText(/differ from this version|od tejto verzie líši/i);
          await expect(panel.getByRole("status").locator("li")).toHaveCount(1);
          await page.setViewportSize({ width: 390, height: 844 });
          assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, "diagnostic must fit a phone viewport");
          await page.setViewportSize({ width: 1280, height: 720 });
          const checks = requests.filter(url => url.includes("/eligibility?")).length;
          await panel.locator("select").nth(2).selectOption("1");
          await expect(panel.locator("select").nth(3)).toBeDisabled();
          await expect(panel.locator("button[type=submit]")).toBeDisabled();
          await expect(panel.getByRole("status")).toHaveCount(0);
          await page.route("**/eligibility-sources?**", route => route.fulfill({ status: 503, body: "{}" }));
          await panel.getByRole("button", { name: /load available|načítať dostupné/i }).click();
          await expect(panel.getByRole("alert")).toBeVisible();
          await expect(panel.locator("button[type=submit]")).toBeDisabled();
          await page.unroute("**/eligibility-sources?**");
          await page.route("**/eligibility-sources?**", route => route.fulfill({
            status: 200, contentType: "application/json", body: JSON.stringify({ records: [] }),
          }));
          await panel.getByRole("button", { name: /load available|načítať dostupné/i }).click();
          await expect(panel.getByRole("status")).toContainText(/no accessible|nenašli prístupné/i);
          await expect(panel.locator("button[type=submit]")).toBeDisabled();
          await page.unroute("**/eligibility-sources?**");
          await panel.locator("select").nth(1).selectOption("chat.received");
          await expect(panel.getByRole("status")).toHaveCount(0);
          await panel.getByRole("button", { name: /load available|načítať dostupné/i }).click();
          await expect(panel.locator("select").nth(3)).toBeEnabled();
          await panel.locator("select").nth(3).selectOption(sourceIds[1]);
          const optionIds = await panel.locator("select").nth(3).locator("option").evaluateAll(options =>
            options.map(option => (option as HTMLOptionElement).value));
          assert.ok(!optionIds.includes(sourceIds[2]), "foreign private chat must not appear");
          assert.equal(requests.filter(url => url.includes("/eligibility?")).length, checks);
          // The same saved-rule inspector is present in the actual rule editor.
          await page.goto(new URL("/automations?tab=rules", base).toString());
          await page.getByTestId(`card-rule-${ruleId}`).locator(".el-expand").click();
          await page.getByTestId(`button-edit-${ruleId}`).click();
          await expect(page.getByTestId("automation-eligibility")).toBeVisible();
          assert.equal(requests.filter(url => /\/(dry-run|execute|test)(\?|$)/.test(url)).length, 0);
          assert.deepEqual(errors, []);
        } finally { await browser.close(); }
      }
    }
    assert.equal((await db.select().from(workflowRuns).where(eq(workflowRuns.ruleId, ruleId))).length, 0);
    const events = await db.select({ id: workflowEvents.id }).from(workflowEvents).where(inArray(workflowEvents.entityId, sourceIds));
    assert.deepEqual(events.map(e => e.id).sort(), [...eventIds].sort());
    assert.equal((await db.select({ id: workflowEvents.id }).from(workflowEvents)
      .where(inArray(workflowEvents.entityId, pickerIds))).length, 0, "listing must never publish source events");
  } finally {
    globalThis.fetch = originalFetch;
    await db.delete(taskComments).where(inArray(taskComments.id, pickerIds));
    await db.delete(tasks).where(inArray(tasks.id, pickerIds));
    await db.delete(callRecordings).where(inArray(callRecordings.id, pickerIds));
    await db.delete(chatMessages).where(inArray(chatMessages.id, pickerIds));
    await db.delete(communicationMessages).where(inArray(communicationMessages.id, pickerIds));
    await db.delete(workflowEvents).where(inArray(workflowEvents.id, eventIds));
    await db.delete(workflowRules).where(eq(workflowRules.id, ruleId));
    await db.delete(chatMessages).where(inArray(chatMessages.id, sourceIds));
    await db.delete(communicationMessages).where(inArray(communicationMessages.id, sourceIds));
    await db.delete(userSessions).where(inArray(userSessions.userId, ids));
    await db.delete(session).where(sql`(sess->'user'->>'id') IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)})`);
    await db.delete(activityLogs).where(inArray(activityLogs.userId, ids));
    await db.delete(users).where(inArray(users.id, ids));
    await pool.end();
  }
});
