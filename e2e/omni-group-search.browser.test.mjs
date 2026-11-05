// Runs the real production bundle with test-only HTTP responses. No auth bypass
// or fixtures are installed in the application; Microsoft 365 is never called.
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
const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(15_000);
const errors = [], searches = [], endpoints = [], exportRequests = [];
let groups = [{ id: "care", name: "Customer support", emails: ["support@example.test"] }], revision = 1;
let smsIsAdmin = true, canManageTaskSettings = true;
const mailboxes = [
  { id: "personal", email: "me@example.test", displayName: "Personal account", type: "personal", isDefault: true },
  { id: "support", email: "support@example.test", displayName: "Support account", type: "shared" },
  { id: "billing", email: "billing@example.test", displayName: "Billing account", type: "shared" },
];
page.on("pageerror", error => errors.push(error.message));
await page.route("**/api/**", async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  endpoints.push(path);
  let data = [];
  if (path === "/api/auth/me") data = { user: { id: "omni-fixture", username: "omni-fixture", fullName: "Test Operator", email: "me@example.test", role: "admin", isActive: true, assignedCountries: ["SK"], language: "en" } };
  if (path.includes("ms365-available-mailboxes")) data = mailboxes;
  if (path.includes("ms365-connection")) data = { connected: true, isConnected: true };
  if (path === "/api/omni-sms/access") data = { isAdmin: smsIsAdmin,
    grants: [{ countryCode: "SK", provider: "bulkgate" }], countries: ["SK"], gateways: [{ provider: "bulkgate", countries: ["SK"] }] };
  if (path === "/api/task-settings/access") data = { canManage: canManageTaskSettings };
  if (path === "/api/task-settings/users") data = { configured: false, allowedUserIds: [], users: [], updatedAt: null };
  if (path === "/api/omni-sms/unread") data = { count: 0 };
  if (path.includes("ms365-unread-counts")) data = { connected: true, counts: [] };
  if (path === "/api/tasks/assignment-options") data = { users: [], groups: [], canResolve: true };
  if (path.includes("ms365-folders")) data = { connected: true, inboxId: "inbox", folders: [{ id: "inbox", displayName: "Inbox", wellKnownName: "inbox", unreadItemCount: 0, totalItemCount: 0 }] };
  if (path.includes("ms365-folder-messages")) data = { connected: true, emails: [], totalCount: 0 };
  if (path === "/api/nexus/mailbox-groups") {
    if (request.method() === "PUT") { const body = request.postDataJSON(); groups = body.groups; revision++; }
    data = { groups, revision };
  }
  if (path === "/api/nexus/ai-search") data = { searchQuery: "invoice", explanation: "Invoice search", searchScope: "all", dateFrom: "2020-01-01", dateTo: "2020-01-31", suggestions: [] };
  if (path.includes("ms365-search-emails")) {
    searches.push({ mailbox: url.searchParams.get("mailbox"), q: url.searchParams.get("q"), dateFrom: url.searchParams.get("dateFrom"), dateTo: url.searchParams.get("dateTo") });
    data = { connected: true, emails: [
      { id: "result-1", subject: "Invoice result", from: { emailAddress: { name: "Sender", address: "sender@example.test" } },
        toRecipients: [], receivedDateTime: "2026-11-05T10:00:00Z", isRead: true, bodyPreview: "Invoice", importance: "normal" },
      { id: "result-2", subject: "Second invoice", from: { emailAddress: { name: "Sender", address: "sender@example.test" } },
        toRecipients: [], receivedDateTime: "2026-11-06T10:00:00Z", isRead: true, bodyPreview: "Invoice", importance: "normal" },
    ], totalCount: 2 };
  }
  if (path === "/api/nexus/search-export") {
    const payload = request.postDataJSON();
    exportRequests.push(payload);
    if (payload.delivery) {
      return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ sent: true, sender: "me@example.test" }) });
    }
    // ZIP transport fixture; original MIME/ZIP contents are checked by the HTTP tests.
    return route.fulfill({ status: 200, contentType: "application/zip",
      body: Buffer.from("UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==", "base64") });
  }
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
});
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/email`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-smart-search").waitFor();
  assert.equal(await page.locator(".omni-top h1").innerText(), "NEXUS Omni");
  assert.equal(await page.locator(".omni-searchbar").count(), 0);
  const searchButton = await page.getByTestId("button-smart-search").boundingBox();
  const settingsButton = await page.getByTestId("button-signature").boundingBox();
  assert.equal(searchButton.y, settingsButton.y);
  await page.getByTestId("omni-group-care").click();
  await page.getByTestId("button-smart-search").click();
  await page.locator(".omni-scope-select").selectOption("group:care");
  const expectedDate = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const searchesBeforeDraft = searches.length;
  await page.getByTestId("search-date-from").click();
  await page.locator('[data-state="open"][data-side] button[name="day"].bg-accent').click();
  await page.getByTestId("search-date-to").click();
  await page.locator('[data-state="open"][data-side] button[name="day"].bg-accent').click();
  assert.equal(searches.length, searchesBeforeDraft, "editing search dates must not immediately refetch");
  await page.getByTestId("input-smart-search").fill("Find invoices");
  // AI deliberately returns scope=all; execution MUST retain the selected group.
  await page.getByTestId("input-smart-search").press("Enter");
  await page.getByTestId("smart-search-panel").getByText("Invoice search", { exact: true }).waitFor();
  await Promise.all([
    page.waitForResponse(response => response.url().includes("ms365-search-emails")),
    page.getByTestId("execute-ai-search").click(),
  ]);
  assert.ok(searches.length);
  assert.deepEqual([...new Set(searches.map(item => item.mailbox))], ["support@example.test"]);
  assert.ok(searches.some(item => item.dateFrom === expectedDate && item.dateTo === expectedDate), "explicit dates must override AI dates");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("button-export-search").click()]);
  assert.equal(download.suggestedFilename(), "nexus-omni-eml.zip");
  assert.equal(exportRequests.at(-1).format, "eml");
  assert.deepEqual(exportRequests.at(-1).messages, [
    { id: "result-1", mailbox: "support@example.test", subject: "Invoice result" },
    { id: "result-2", mailbox: "support@example.test", subject: "Second invoice" },
  ]);
  await page.getByTestId("search-export-format").click();
  await page.getByRole("option", { name: "MSG", exact: true }).click();
  const [msgDownload] = await Promise.all([page.waitForEvent("download"), page.getByTestId("button-export-search").click()]);
  assert.equal(msgDownload.suggestedFilename(), "nexus-omni-msg.zip");
  assert.equal(exportRequests.at(-1).format, "msg");
  await page.getByTestId("button-email-search-export").click();
  assert.equal(await page.getByTestId("search-export-sender").innerText(), "me@example.test");
  await page.getByTestId("search-export-recipient").fill("archive@example.test");
  await page.getByTestId("search-export-subject").fill("Invoices");
  await page.getByTestId("search-export-body").fill("Please see the attached archive.");
  const [sendResponse] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/nexus/search-export") && response.request().postDataJSON()?.delivery),
    page.getByTestId("confirm-send-search-export").click(),
  ]);
  assert.equal(sendResponse.status(), 202);
  const sendPayload = exportRequests.at(-1);
  assert.equal(sendPayload.format, "msg");
  assert.deepEqual(sendPayload.delivery, { to: "archive@example.test", subject: "Invoices", body: "Please see the attached archive." });
  assert.deepEqual(sendPayload.messages.map(message => message.id), ["result-1", "result-2"]);
  await page.getByTestId("confirm-send-search-export").waitFor({ state: "hidden" });
  await page.getByTestId("button-signature").click();
  await page.locator(".omni-group-editor").waitFor();
  await page.locator(".omni-group-editor > .flex input").fill("Finance");
  await page.locator(".omni-group-editor > .flex button").first().click();
  const groupCard = page.locator(".omni-group-editor .omni-group-card").last();
  await groupCard.locator(".omni-group-palette").first().getByRole("button").nth(13).click();
  await groupCard.locator(".omni-group-palette").nth(1).getByRole("button").nth(7).click();
  await groupCard.getByText("Billing account", { exact: true }).click();
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/nexus/mailbox-groups") && response.request().method() === "PUT"),
    page.locator(".omni-group-editor > .flex.justify-end button").last().click(),
  ]);
  assert.ok(groups.some(g => g.name === "Finance" && g.emails.includes("billing@example.test")));
  assert.ok(groups.some(g => g.name === "Finance" && g.icon === "rocket" && g.color === "#14B8A6"));
  await page.getByTestId("settings-close").click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("button-smart-search").waitFor();
  await page.getByRole("button", { name: "Finance", exact: true }).waitFor();
  assert.equal(await page.getByTestId("account-expanded-support@example.test").count(), 1);
  assert.equal(await page.locator('.omni-group-children button[title="support@example.test"]').count(), 1,
    "a visible standalone account can also appear inside its group");
  await page.getByTestId("button-signature").click();
  const supportVisibility = page.getByTestId("account-show-individually-support");
  assert.equal(await supportVisibility.getAttribute("aria-checked"), "true");
  await supportVisibility.click();
  assert.equal(await supportVisibility.getAttribute("aria-checked"), "false");
  await page.getByTestId("settings-close").click();
  assert.equal(await page.getByTestId("account-expanded-support@example.test").count(), 0,
    "hidden account must not have a standalone navigation row");
  assert.equal(await page.locator('.omni-group-children button[title="support@example.test"]').count(), 1,
    "hiding standalone navigation must not remove an account from its group");
  const hiddenSupportInGroup = page.locator('.omni-group-children button[title="support@example.test"]');
  await hiddenSupportInGroup.click();
  assert.ok((await hiddenSupportInGroup.getAttribute("class")).includes("selected"),
    "a hidden standalone account remains selectable inside its group");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("button-smart-search").waitFor();
  await page.locator('.omni-group-children button[title="support@example.test"]').waitFor();
  assert.equal(await page.getByTestId("account-expanded-support@example.test").count(), 0,
    "standalone visibility preference persists after reload");
  assert.equal(await page.locator('.omni-group-children button[title="support@example.test"]').count(), 1);
  const financeMark = page.getByRole("button", { name: "Finance", exact: true }).locator(".omni-group-mark");
  assert.equal(await financeMark.evaluate(el => getComputedStyle(el).color), "rgb(20, 184, 166)");
  assert.equal(await financeMark.locator(".omni-group-badge").count(), 1);
  await mkdir("generated-artifacts/omni-groups", { recursive: true });
  await page.screenshot({ path: "generated-artifacts/omni-groups/compact-toolbar.png" });
  // Ordinary search uses exactly the same scope as AI search.
  await page.getByTestId("button-smart-search").click();
  await page.locator(".omni-scope-select").selectOption("group:care");
  await page.getByTestId("toggle-ai-search").click();
  await page.getByTestId("input-smart-search").fill("ordinary-search");
  await Promise.all([
    page.waitForResponse(response => response.url().includes("ms365-search-emails")),
    page.getByTestId("input-smart-search").press("Enter"),
  ]);
  assert.deepEqual([...new Set(searches.map(item => item.mailbox))], ["support@example.test"]);
  // Date-only searches execute without AI parsing while AI mode remains enabled.
  await page.getByTestId("button-smart-search").click();
  await page.getByTestId("toggle-ai-search").click();
  await page.getByTestId("input-smart-search").fill("");
  await page.getByTestId("search-date-from").click();
  await page.locator('[data-state="open"][data-side] button[name="day"].bg-accent').click();
  await page.getByTestId("search-date-to").click();
  await page.locator('[data-state="open"][data-side] button[name="day"].bg-accent').click();
  const countBeforeDateOnly = searches.length;
  await Promise.all([
    page.waitForResponse(response => response.url().includes("ms365-search-emails")),
    page.getByTestId("execute-date-search").click(),
  ]);
  assert.equal(searches.length, countBeforeDateOnly + 1);
  assert.equal(searches.at(-1).q, null);
  assert.equal(searches.at(-1).dateFrom, expectedDate);
  assert.equal(searches.at(-1).dateTo, expectedDate);
  await page.getByTestId("button-signature").click();
  const finance = page.locator(".omni-group-card").nth(1);
  await finance.getByRole("textbox").first().fill("Accounting");
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/nexus/mailbox-groups") && response.request().method() === "PUT"),
    page.locator(".omni-group-editor > .flex.justify-end button").last().click(),
  ]);
  assert.ok(groups.some(g => g.name === "Accounting"));
  await finance.locator(":scope > div").first().getByRole("button").click();
  await finance.locator('[role="alert"] button').first().click();
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/nexus/mailbox-groups") && response.request().method() === "PUT"),
    page.locator(".omni-group-editor > .flex.justify-end button").last().click(),
  ]);
  assert.equal(groups.length, 1);
  await page.getByTestId("settings-close").click();
  await page.getByTestId("button-smart-search").click();
  await page.locator(".omni-scope-select").selectOption("group:care");
  await mkdir("generated-artifacts/omni-groups", { recursive: true });
  await page.screenshot({ path: "generated-artifacts/omni-groups/desktop.png" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({ path: "generated-artifacts/omni-groups/dark.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok((await page.getByTestId("smart-search-panel").boundingBox()).width <= 390);
  await page.screenshot({ path: "generated-artifacts/omni-groups/mobile.png" });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.keyboard.press("Escape");
  await page.getByTestId("smart-search-overlay").waitFor({ state: "detached" });
  await page.getByTestId("tab-sms").click();
  smsIsAdmin = false;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("tab-sms").click();
  await page.getByTestId("button-sms-settings").waitFor();
  assert.equal(await page.getByTestId("button-sms-manage-access").count(), 0,
    "ordinary SMS users retain filter settings but do not receive admin permission controls");
  await page.getByTestId("button-sms-settings").click();
  await page.getByTestId("sms-filter-controls").waitFor();
  smsIsAdmin = true;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("tab-sms").click();
  await page.getByTestId("button-sms-manage-access").waitFor();
  await page.getByTestId("button-sms-manage-access").click();
  await page.locator(".sms-permissions-panel").waitFor();

  await page.getByTestId("tab-tasks").click();
  await page.getByTestId("button-task-groups-settings").waitFor();
  await page.getByTestId("button-task-groups-settings").click();
  await page.getByTestId("dialog-task-groups").waitFor();
  canManageTaskSettings = false;
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/task-settings/access")),
    page.reload({ waitUntil: "domcontentloaded" }),
  ]);
  await page.getByTestId("tab-tasks").click();
  assert.equal(await page.getByTestId("button-task-groups-settings").count(), 0,
    "task settings entry is absent when server-resolved permission is denied");
  assert.deepEqual(errors, []);
  console.log("PASS real Omni: group search and account visibility persistence; permission-aware SMS/task toolbar settings; desktop/dark/mobile.");
} catch (error) {
  console.error("Browser errors:", errors);
  const body = await page.locator("body").innerText();
  console.error("Visible body:", body.slice(0, 1400), body.slice(-1000));
  console.error("Fixture endpoints:", [...new Set(endpoints)]);
  throw error;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
