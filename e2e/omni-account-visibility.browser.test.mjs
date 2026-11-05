// Focused real-bundle regression for standalone mailbox visibility and shared
// settings launchers. All HTTP fixtures stay in this test, never in the app.
import assert from "node:assert/strict";
import express from "express";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const app = express();
app.use(express.static("dist/public"));
app.use((_, res) => res.sendFile(process.cwd() + "/dist/public/index.html"));
const server = app.listen(0, "127.0.0.1");
await new Promise(resolve => server.on("listening", resolve));
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, reducedMotion: "reduce" });
page.setDefaultTimeout(15_000);
let smsAdmin = false, taskManager = true;
const errors = [];
const mailboxes = [
  { id: "personal", email: "me@example.test", displayName: "Personal account", type: "personal", isDefault: true },
  { id: "support", email: "support@example.test", displayName: "Support account", type: "shared" },
  { id: "billing", email: "billing@example.test", displayName: "Billing account", type: "shared" },
];
page.on("pageerror", error => errors.push(error.message));
await page.route("**/api/**", async route => {
  const path = new URL(route.request().url()).pathname;
  let data = [];
  if (path === "/api/auth/me") data = { user: { id: "omni-fixture", username: "fixture", fullName: "Test Operator", email: "me@example.test", role: "admin", isActive: true, assignedCountries: ["SK"] } };
  if (path.includes("ms365-available-mailboxes")) data = mailboxes;
  if (path.includes("ms365-connection")) data = { connected: true, isConnected: true };
  if (path.includes("ms365-unread-counts")) data = { connected: true, counts: [] };
  if (path.includes("ms365-folders")) data = { connected: true, inboxId: "inbox", folders: [{ id: "inbox", displayName: "Inbox", wellKnownName: "inbox", unreadItemCount: 0, totalItemCount: 0 }] };
  if (path.includes("ms365-folder-messages")) data = { connected: true, emails: [], totalCount: 0 };
  if (path === "/api/nexus/mailbox-groups") data = { groups: [{ id: "care", name: "Customer support", emails: ["support@example.test"] }], revision: 1 };
  if (path === "/api/tasks/assignment-options") data = { users: [], groups: [], canResolve: true };
  if (path === "/api/task-settings/access") data = { canManage: taskManager };
  if (path === "/api/task-settings/users") data = { configured: false, allowedUserIds: [], users: [], updatedAt: null };
  if (path === "/api/omni-sms/access") data = { isAdmin: smsAdmin, grants: [{ countryCode: "SK", provider: "bulkgate" }],
    countries: ["SK"], gateways: [{ provider: "bulkgate", countries: ["SK"] }] };
  if (path === "/api/omni-sms/unread") data = { unread: 0 };
  if (path === "/api/omni-sms/messages") data = { messages: [], total: 0, page: 1, pageSize: 50 };
  if (path === "/api/omni-sms/permissions") data = { users: [] };
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
});
const groupMember = page.locator('.omni-group-children button[title="support@example.test"]');
const standalone = page.getByTestId("account-expanded-support@example.test");
const loadEmail = async () => {
  await page.goto(`http://127.0.0.1:${server.address().port}/email`, { waitUntil: "domcontentloaded" });
  await groupMember.waitFor();
};
try {
  await loadEmail();
  await standalone.waitFor();
  await page.getByTestId("button-signature").click();
  const toggle = page.getByTestId("account-show-individually-support");
  await toggle.waitFor();
  assert.equal(await toggle.getAttribute("aria-checked"), "true");
  await toggle.click();
  await page.getByTestId("settings-close").click();
  await standalone.waitFor({ state: "detached" });
  assert.equal(await groupMember.count(), 1);
  await groupMember.click();
  assert.match(await groupMember.getAttribute("class"), /selected/);
  await loadEmail();
  assert.equal(await standalone.count(), 0);
  assert.equal(await groupMember.count(), 1);
  // Restoring the same preference restores only the independent account row.
  await page.getByTestId("button-signature").click();
  assert.equal(await toggle.getAttribute("aria-checked"), "false");
  await toggle.click();
  await page.getByTestId("settings-close").click();
  await standalone.waitFor();
  assert.equal(await groupMember.count(), 1);

  await page.getByTestId("tab-sms").click();
  const smsSettings = page.getByTestId("button-sms-settings");
  await smsSettings.waitFor();
  assert.equal(await page.getByTestId("button-sms-manage-access").count(), 0);
  assert.equal(await page.getByTestId("sms-toggle-filters").count(), 0);
  await smsSettings.click();
  await page.getByTestId("sms-filter-controls").waitFor();
  assert.equal(await smsSettings.getAttribute("aria-expanded"), "true");
  await mkdir("generated-artifacts/omni-visibility", { recursive: true });
  await page.screenshot({ path: "generated-artifacts/omni-visibility/sms-settings.png" });

  smsAdmin = true;
  await loadEmail();
  await page.getByTestId("tab-sms").click();
  await page.getByTestId("button-sms-manage-access").click();
  await page.locator(".sms-permissions-panel").waitFor();
  await page.getByTestId("tab-tasks").click();
  await page.getByTestId("button-task-groups-settings").click();
  await page.getByTestId("dialog-task-groups").waitFor();
  assert.equal(await page.getByTestId("btn-task-groups-nexus").count(), 0);
  await page.screenshot({ path: "generated-artifacts/omni-visibility/task-settings.png" });

  taskManager = false;
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/task-settings/access")),
    loadEmail(),
  ]);
  await page.getByTestId("tab-tasks").click();
  assert.equal(await page.getByTestId("button-task-groups-settings").count(), 0);
  await page.getByTestId("tab-sms").click();
  await smsSettings.waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await smsSettings.boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390);
  await page.screenshot({ path: "generated-artifacts/omni-visibility/mobile.png" });
  assert.deepEqual(errors, []);
  console.log("PASS account visibility on/off/reload and group access; ordinary/admin SMS settings; permitted/denied task settings; mobile toolbar.");
} catch (error) {
  console.error("Browser errors:", errors);
  console.error("Visible screen:", (await page.locator("body").innerText()).slice(0, 2000));
  throw error;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
