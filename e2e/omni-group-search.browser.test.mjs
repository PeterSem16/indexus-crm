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
const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, reducedMotion: "reduce" });
page.setDefaultTimeout(15_000);
const errors = [], searches = [], endpoints = [];
let groups = [{ id: "care", name: "Customer support", emails: ["support@example.test"] }], revision = 1;
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
  if (path === "/api/omni-sms/access") data = { isAdmin: true, grants: [], countries: ["SK"], providers: [] };
  if (path === "/api/omni-sms/unread") data = { count: 0 };
  if (path.includes("ms365-unread-counts")) data = { connected: true, counts: [] };
  if (path === "/api/tasks/assignment-options") data = { users: [], groups: [], canResolve: true };
  if (path.includes("ms365-folders")) data = { connected: true, inboxId: "inbox", folders: [{ id: "inbox", displayName: "Inbox", wellKnownName: "inbox", unreadItemCount: 0, totalItemCount: 0 }] };
  if (path.includes("ms365-folder-messages")) data = { connected: true, emails: [], totalCount: 0 };
  if (path === "/api/nexus/mailbox-groups") {
    if (request.method() === "PUT") { const body = request.postDataJSON(); groups = body.groups; revision++; }
    data = { groups, revision };
  }
  if (path === "/api/nexus/ai-search") data = { searchQuery: "invoice", explanation: "Invoice search", searchScope: "all", suggestions: [] };
  if (path.includes("ms365-search-emails")) {
    searches.push(url.searchParams.get("mailbox"));
    data = { connected: true, emails: [], totalCount: 0 };
  }
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
});
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/email`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-smart-search").waitFor();
  await page.getByTestId("omni-group-care").click();
  await page.getByTestId("button-smart-search").click();
  await page.locator(".omni-scope-select").selectOption("group:care");
  await page.getByTestId("input-smart-search").fill("Find invoices");
  // AI deliberately returns scope=all; execution MUST retain the selected group.
  await page.getByTestId("input-smart-search").press("Enter");
  await page.getByTestId("smart-search-panel").getByText("Invoice search", { exact: true }).waitFor();
  await Promise.all([
    page.waitForResponse(response => response.url().includes("ms365-search-emails")),
    page.getByTestId("execute-ai-search").click(),
  ]);
  assert.ok(searches.length);
  assert.deepEqual([...new Set(searches)], ["support@example.test"]);
  await page.getByTestId("button-signature").click();
  await page.locator(".omni-group-editor").waitFor();
  await page.locator(".omni-group-editor > .flex input").fill("Finance");
  await page.locator(".omni-group-editor > .flex button").first().click();
  const groupCard = page.locator(".omni-group-editor .omni-group-card").last();
  await groupCard.getByText("Billing account", { exact: true }).click();
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/nexus/mailbox-groups") && response.request().method() === "PUT"),
    page.locator(".omni-group-editor > .flex.justify-end button").last().click(),
  ]);
  assert.ok(groups.some(g => g.name === "Finance" && g.emails.includes("billing@example.test")));
  await page.getByTestId("settings-close").click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("button-smart-search").waitFor();
  assert.ok(await page.getByRole("button", { name: "Finance", exact: true }).count());
  // Ordinary search uses exactly the same scope as AI search.
  await page.getByTestId("button-smart-search").click();
  await page.locator(".omni-scope-select").selectOption("group:care");
  await page.getByTestId("toggle-ai-search").click();
  await page.getByTestId("input-smart-search").fill("ordinary-search");
  await Promise.all([
    page.waitForResponse(response => response.url().includes("ms365-search-emails")),
    page.getByTestId("input-smart-search").press("Enter"),
  ]);
  assert.deepEqual([...new Set(searches)], ["support@example.test"]);
  await page.getByTestId("button-signature").click();
  const finance = page.locator(".omni-group-card").nth(1);
  await finance.getByRole("textbox").fill("Accounting");
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/nexus/mailbox-groups") && response.request().method() === "PUT"),
    page.locator(".omni-group-editor > .flex.justify-end button").last().click(),
  ]);
  assert.ok(groups.some(g => g.name === "Accounting"));
  await finance.locator('button[aria-label]').click();
  await finance.locator('[role="alert"] button').first().click();
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/nexus/mailbox-groups") && response.request().method() === "PUT"),
    page.locator(".omni-group-editor > .flex.justify-end button").last().click(),
  ]);
  assert.equal(groups.length, 1);
  await page.getByTestId("settings-close").click();
  await page.getByTestId("button-smart-search").click();
  await page.getByTestId("toggle-ai-search").click();
  await page.locator(".omni-scope-select").selectOption("group:care");
  await mkdir("generated-artifacts/omni-groups", { recursive: true });
  await page.screenshot({ path: "generated-artifacts/omni-groups/desktop.png" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({ path: "generated-artifacts/omni-groups/dark.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok((await page.getByTestId("smart-search-panel").boundingBox()).width <= 390);
  await page.screenshot({ path: "generated-artifacts/omni-groups/mobile.png" });
  assert.deepEqual(errors, []);
  console.log("PASS real Omni: selected group cannot be widened by AI, group save/reload, desktop/dark/mobile.");
} catch (error) {
  console.error("Browser errors:", errors);
  console.error("Visible body:", (await page.locator("body").innerText()).slice(-2500));
  console.error("Fixture endpoints:", [...new Set(endpoints)]);
  throw error;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
