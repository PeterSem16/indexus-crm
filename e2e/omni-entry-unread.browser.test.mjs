// Real production bundle, isolated HTTP fixtures. No database or Graph calls.
import assert from "node:assert/strict";
import express from "express";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const dist = resolve(process.env.OMNI_TEST_DIST || "dist/public");
const app = express();
app.use(express.static(dist));
app.use((_, res) => res.sendFile(resolve(dist, "index.html")));
const server = app.listen(0, "127.0.0.1");
await new Promise(r => server.once("listening", r));
const browser = await chromium.launch({
  executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(15_000);
const user = { id: "omni-entry-fixture", username: "fixture", fullName: "Test Operator",
  email: "operator@example.test", role: "admin", isActive: true,
  assignedCountries: ["SK"], language: "en" };
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let unread = 7, connected = true, unreadRequests = 0, readWrites = 0;
const message = { id: "unread-fixture", subject: "Unread fixture", isRead: false,
  receivedDateTime: "2026-11-17T10:00:00Z", importance: "normal",
  from: { emailAddress: { name: "Synthetic Sender", address: "sender@example.test" } },
  bodyPreview: "Synthetic message", hasAttachments: false };
await page.route("**/api/**", async route => {
  const req = route.request(), path = new URL(req.url()).pathname;
  let data = [];
  if (path === "/api/auth/me") data = { user };
  else if (path.includes("ms365-available-mailboxes")) data = [
    { id: "personal", email: user.email, displayName: "Personal", type: "personal", isDefault: true },
  ];
  else if (path.includes("ms365-connection")) data = { connected: true, isConnected: true };
  else if (path.includes("ms365-unread-counts")) {
    unreadRequests++;
    data = { connected, totalUnread: unread,
      counts: [{ mailbox: user.email, unreadCount: unread }] };
  } else if (path.includes("ms365-folders")) data = { connected: true, inboxId: "localized-inbox",
    folders: [{ id: "localized-inbox", displayName: "Doručená pošta",
      unreadItemCount: 2, totalItemCount: 200 }] };
  else if (path.includes("ms365-folder-messages")) data = { connected: true, emails: [message], totalCount: 1 };
  else if (path.endsWith("/read-status") && req.method() === "PATCH") {
    readWrites++;
    message.isRead = JSON.parse(req.postData() || "{}").isRead;
    unread = message.isRead ? 6 : 7;
    data = { success: true };
  } else if (path === "/api/omni-sms/unread") data = { unread: 2 };
  else if (path === "/api/omni-sms/access") data = { isAdmin: false, grants: [], countries: [], gateways: [] };
  else if (path === "/api/nexus/mailbox-groups") data = { groups: [], revision: 0 };
  else if (path === "/api/tasks/assignment-options") data = { users: [], groups: [], canResolve: true };
  else if (path === "/api/task-settings/access") data = { canManage: false };
  else if (path === "/api/task-settings/users") data = { configured: false, users: [], allowedUserIds: [] };
  await route.fulfill({ json: data });
});

const count = () => page.getByTestId("tab-email").locator(".omni-tab-count");
const waitCount = value => page.waitForFunction(expected =>
  document.querySelector('[data-testid="tab-email"] .omni-tab-count')?.textContent === String(expected), value);

try {
  const base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(`${base}/email?tab=sms`);
  await page.getByTestId("tab-sms").waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="tab-sms"]')?.getAttribute("aria-selected") === "true");
  await waitCount(7);
  assert.equal(await page.getByTestId("nav-nexus-omni").getAttribute("href"), "/email?tab=email");
  assert.equal(await page.getByTestId("nexus-omni-unread-sms").getAttribute("href"), "/email?tab=sms");
  assert.equal(unreadRequests, 1, "all mounted consumers share one unread query");

  await page.getByTestId("nav-nexus-omni").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="tab-email"]')?.getAttribute("aria-selected") === "true");
  await waitCount(7);
  console.log("PASS menu opens Email despite unread SMS; localized Inbox badge uses total across mailboxes");

  // A toolbar tab change does not remount the page. Main menu must still reset it.
  await page.getByTestId("tab-sms").click();
  await page.getByTestId("nav-nexus-omni").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="tab-email"]')?.getAttribute("aria-selected") === "true");
  await page.getByTestId("nexus-omni-unread-sms").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="tab-sms"]')?.getAttribute("aria-selected") === "true");
  await page.getByTestId("nav-nexus-omni").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="tab-email"]')?.getAttribute("aria-selected") === "true");
  console.log("PASS repeated main-menu entry and explicit SMS shortcut stay independent");

  assert.equal(readWrites, 0, "navigation never changes message read state");
  await page.getByTestId("email-item-unread-fixture").hover();
  await page.getByTestId("toggle-read-unread-fixture").click();
  await waitCount(6);
  assert.equal(await page.getByTestId("nexus-omni-unread-email").innerText(), "6");
  await page.getByTestId("email-item-unread-fixture").hover();
  await page.getByTestId("toggle-read-unread-fixture").click();
  await waitCount(7);
  assert.equal(readWrites, 2, "read and unread mutations refresh the shared counter");
  console.log("PASS mark read/unread immediately refreshes toolbar and sidebar together");
  unread = 0;
  const zeroResponse = page.waitForResponse(r => r.url().includes("ms365-unread-counts"));
  await page.reload();
  await zeroResponse;
  await page.getByTestId("tab-email").waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid="nexus-omni-unread-email"]'));
  assert.equal(await count().count(), 0, "no zero badge, even though folder reports unread messages");
  unread = 9; connected = false;
  const disconnectedResponse = page.waitForResponse(r => r.url().includes("ms365-unread-counts"));
  await page.reload();
  await page.getByTestId("tab-email").waitFor();
  await disconnectedResponse;
  assert.equal(await count().count(), 0, "disconnected state never displays a stale count");
  assert.deepEqual(errors, []);
  await mkdir("generated-artifacts/omni-entry-unread", { recursive: true });
  connected = true; unread = 7;
  await page.reload();
  await waitCount(7);
  await page.screenshot({ path: "generated-artifacts/omni-entry-unread/toolbar.jpg" });
  console.log("PASS zero and disconnected counts; no page errors");
} finally {
  await context.close();
  await browser.close();
  await new Promise(r => server.close(r));
}
