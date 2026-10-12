import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, type BrowserContext } from "@playwright/test";
import { storage } from "../server/storage";
import { pool } from "../server/db";

// Real development login and APIs. No authentication bypass or SMS/AI requests.
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const key = `notification-ui-${randomUUID()}`;
const fixture = await storage.createUser({
  username: key, password: "synthetic test fixture only",
  fullName: "Synthetic UI fixture", email: `${key}@example.invalid`,
  role: "admin", assignedCountries: ["SK"], isActive: true,
} as any);
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
let context: BrowserContext | null = null;
const runtimeErrors: string[] = [];
try {
  browser = await chromium.launch({ headless: true, executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", error => runtimeErrors.push(error.message));
  const login = await context.request.post(`${base}/api/auth/login`, {
    data: { username: key, password: "synthetic test fixture only" },
  });
  assert.equal(login.status(), 200);
  await page.goto(`${base}/automations?tab=notifications&section=notification-rules`);
  await page.getByTestId("button-add-rule").waitFor({ timeout: 60000 });
  await page.getByTestId("button-add-rule").click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#nr-name").fill(key);
  await dialog.locator("#nr-title").fill("Synthetic notice");
  await dialog.getByRole("switch").last().click(); // keep fixture inactive
  const createResponse = page.waitForResponse(response =>
    response.url().endsWith("/api/notification-rules") && response.request().method() === "POST");
  await dialog.getByTestId("save-notification-rule").click();
  const created = await (await createResponse).json();
  assert(created.id);
  assert.equal(created.isActive, false);
  assert.equal(created.sendPush, true);
  // Keep every potential recipient synthetic before testing the active switch.
  const { id: _id, createdBy: _createdBy, createdAt: _createdAt, updatedAt: _updatedAt, ...ruleFields } = created;
  assert.equal((await context.request.put(`${base}/api/notification-rules/${created.id}`, {
    data: { ...ruleFields, targetType: "specific_users", targetUserIds: [fixture.id] },
  })).status(), 200);
  await page.reload();
  await page.getByTestId(`edit-rule-${created.id}`).click();
  await dialog.locator("#nr-name").fill(`${key}-edited`);
  await dialog.locator("#nr-title").fill("Synthetic notice edited");
  await dialog.locator("#nr-conditions").fill('{"provider":["smstools","bulkgate"],"hasAngryTone":true}');
  const updateResponse = page.waitForResponse(response =>
    response.url().endsWith(`/api/notification-rules/${created.id}`) && response.request().method() === "PUT");
  await dialog.getByTestId("save-notification-rule").click();
  const updated = await (await updateResponse).json();
  assert.deepEqual(updated.triggerConditions, { provider: ["smstools", "bulkgate"], hasAngryTone: true });
  assert.deepEqual(updated.targetUserIds, [fixture.id]);
  const toggleResponse = page.waitForResponse(response => response.url().endsWith(`/${created.id}/toggle`));
  await page.getByTestId(`toggle-rule-${created.id}`).click();
  assert.equal((await (await toggleResponse).json()).isActive, true);
  await page.getByTestId(`delete-rule-${created.id}`).click();
  await page.getByRole("dialog").getByRole("button").first().click();
  assert((await (await context.request.get(`${base}/api/notification-rules`)).json()).some((r: any) => r.id === created.id));
  await page.getByTestId(`delete-rule-${created.id}`).click();
  const deleteResponse = page.waitForResponse(response =>
    response.url().endsWith(`/api/notification-rules/${created.id}`) && response.request().method() === "DELETE");
  await page.getByTestId("confirm-delete-notification-rule").click();
  assert.equal((await deleteResponse).status(), 200);

  // Metric alerts: create and edit through the UI without enabling the scheduler.
  await page.goto(`${base}/automations?tab=notifications&section=alert-rules`);
  await page.getByTestId("button-add-alert-rule").click();
  await dialog.locator("#alert-name").fill(`${key}-metric`);
  await dialog.getByRole("switch").last().click();
  const createMetric = page.waitForResponse(response =>
    response.url().endsWith("/api/alert-rules") && response.request().method() === "POST");
  await dialog.getByTestId("save-alert-rule").click();
  const metric = await (await createMetric).json();
  assert(metric.id);
  assert.equal(metric.isActive, false);
  await page.getByTestId(`edit-alert-rule-${metric.id}`).click();
  await dialog.locator("#alert-name").fill(`${key}-metric-edited`);
  const saveMetric = page.waitForResponse(response =>
    response.url().endsWith(`/api/alert-rules/${metric.id}`) && response.request().method() === "PATCH");
  await dialog.getByTestId("save-alert-rule").click();
  assert.equal((await (await saveMetric).json()).name, `${key}-metric-edited`);
  await page.getByTestId(`delete-alert-rule-${metric.id}`).click();
  const deleteMetric = page.waitForResponse(response =>
    response.url().endsWith(`/api/alert-rules/${metric.id}`) && response.request().method() === "DELETE");
  await page.getByTestId("confirm-delete-alert-rule").click();
  assert.equal((await deleteMetric).status(), 200);
  await page.goto(`${base}/automations?tab=notifications&section=notification-rules`);
  await page.getByTestId("button-add-rule").click();
  await dialog.waitFor();
  await page.screenshot({ path: "/tmp/notification-alerts-desktop.png" });
  await page.setViewportSize({ width: 402, height: 874 });
  await page.screenshot({ path: "/tmp/notification-alerts-mobile.png" });
  assert.equal(await dialog.evaluate(element => element.getBoundingClientRect().width <= window.innerWidth), true);
  assert.equal(await page.getByTestId("save-notification-rule").evaluate(button => {
    const rect = button.getBoundingClientRect();
    return rect.height > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight;
  }), true, "mobile save action must remain visible below the scrollable form");
  assert.deepEqual(runtimeErrors, []);
  console.log("Authenticated desktop/mobile UI: notification create/edit/toggle/delete confirmation + metric create/edit/delete PASSED");
} finally {
  await context?.request.post(`${base}/api/auth/logout`).catch(() => {});
  await browser?.close();
  await pool.query("DELETE FROM notification_rules WHERE created_by=$1", [fixture.id]);
  await pool.query("DELETE FROM alert_history WHERE user_id=$1", [fixture.id]).catch(() => {});
  await pool.query("DELETE FROM alert_rules WHERE created_by=$1", [fixture.id]);
  await pool.query("DELETE FROM notifications WHERE user_id=$1", [fixture.id]);
  await pool.query("DELETE FROM activity_logs WHERE user_id=$1", [fixture.id]);
  await pool.query("DELETE FROM user_sessions WHERE user_id=$1", [fixture.id]);
  await pool.query("DELETE FROM session WHERE sess::text LIKE $1", [`%${fixture.id}%`]).catch(() => {});
  await pool.query("DELETE FROM users WHERE id=$1", [fixture.id]);
  await pool.end();
}
