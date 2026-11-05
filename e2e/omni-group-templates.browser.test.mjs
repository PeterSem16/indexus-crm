// Real production UI, test-only API responses; no live mail or authentication changes.
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
const errors = [], deliveries = [];
let revision = 1;
let groups = [
  { id: "care", name: "Customer support", emails: ["support@example.test"] },
  { id: "finance", name: "Finance", emails: ["billing@example.test"],
    replyTemplate: { subject: "Finance archive", body: "Finance messages attached.", includeSignature: false } },
];
const mailboxes = [
  { id: "personal", email: "me@example.test", displayName: "Personal account", type: "personal", isDefault: true },
  { id: "support", email: "support@example.test", displayName: "Support account", type: "shared" },
  { id: "billing", email: "billing@example.test", displayName: "Billing account", type: "shared" },
];
page.on("pageerror", error => errors.push(error.message));
await page.route("**/api/**", async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  let data = [];
  if (path === "/api/auth/me") data = { user: { id: "omni-fixture", username: "fixture", fullName: "Test Operator", email: "me@example.test", role: "admin", isActive: true, assignedCountries: ["SK"] } };
  if (path.includes("ms365-available-mailboxes")) data = mailboxes;
  if (path.includes("ms365-connection")) data = { connected: true, isConnected: true };
  if (path.includes("ms365-unread-counts")) data = { connected: true, counts: [] };
  if (path.includes("ms365-folders")) data = { connected: true, inboxId: "inbox", folders: [{ id: "inbox", displayName: "Inbox", wellKnownName: "inbox", unreadItemCount: 0, totalItemCount: 0 }] };
  if (path.includes("ms365-folder-messages")) data = { connected: true, emails: [], totalCount: 0 };
  if (path === "/api/tasks/assignment-options") data = { users: [], groups: [], canResolve: true };
  if (path === "/api/task-settings/access") data = { canManage: false };
  if (path === "/api/omni-sms/access") data = { isAdmin: false, grants: [], countries: [], gateways: [] };
  if (path === "/api/omni-sms/unread") data = { count: 0 };
  if (path === "/api/nexus/mailbox-groups") {
    if (request.method() === "PUT") { groups = request.postDataJSON().groups; revision++; }
    data = { groups, revision };
  }
  if (path.includes("ms365-search-emails")) data = { connected: true, totalCount: 1, emails: [
    { id: "result-1", subject: "Searched original", from: { emailAddress: { name: "Sender", address: "sender@example.test" } },
      toRecipients: [], receivedDateTime: "2026-11-05T10:00:00Z", isRead: true, bodyPreview: "Fixture", importance: "normal" },
  ] };
  if (path === "/api/nexus/search-export") {
    deliveries.push(request.postDataJSON());
    return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ sent: true, sender: "me@example.test" }) });
  }
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
});
const go = async () => {
  await page.goto(`http://127.0.0.1:${server.address().port}/email`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("omni-group-care").waitFor();
};
const saveGroups = async () => {
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/nexus/mailbox-groups") && response.request().method() === "PUT"),
    page.locator(".omni-group-editor > .flex.justify-end button").last().click(),
  ]);
};
const confirmSend = async () => {
  await page.getByTestId("search-export-recipient").fill("archive@example.test");
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/nexus/search-export")),
    page.getByTestId("confirm-send-search-export").click(),
  ]);
  await page.getByTestId("confirm-send-search-export").waitFor({ state: "hidden" });
};
const search = async scope => {
  await page.getByTestId("button-smart-search").click();
  await page.locator(".omni-scope-select").selectOption(scope);
  await page.getByTestId("input-smart-search").fill("fixture-search");
  await Promise.all([
    page.waitForResponse(response => response.url().includes("ms365-search-emails")),
    page.getByTestId("input-smart-search").press("Enter"),
  ]);
  await page.getByTestId("button-email-search-export").waitFor();
};
try {
  await go();
  await page.getByTestId("button-signature").click();
  await page.getByTestId("group-template-subject-care").waitFor();
  assert.match(await page.getByTestId("group-template-subject-care").inputValue(), /Customer support/);
  assert.equal(await page.locator(".omni-group-editor > .flex.justify-end button").last().isDisabled(), true,
    "displaying defaults for legacy groups does not dirty the editor");
  await page.getByTestId("group-template-subject-care").fill("Support correspondence");
  await page.getByTestId("group-template-body-care").fill("Please find the requested emails attached.");
  assert.equal(await page.getByTestId("group-template-signature-care").count(), 0,
    "groups must not create a second signature");
  await page.getByTestId("group-template-include-signature-care").check();
  await page.locator(".omni-group-editor > .flex input").fill("Operations");
  await page.locator(".omni-group-editor > .flex button").first().click();
  assert.match(await page.getByTestId(/^group-template-subject-/).last().inputValue(), /Operations/);
  await saveGroups();
  assert.equal(groups[0].replyTemplate.includeSignature, true);
  assert.equal(groups[1].replyTemplate.subject, "Finance archive");
  assert.ok(groups[2].replyTemplate.body);
  await page.getByTestId("settings-close").click();
  await go();
  await page.getByTestId("button-signature").click();
  assert.equal(await page.getByTestId("group-template-body-care").inputValue(), "Please find the requested emails attached.");
  assert.equal(await page.getByTestId("group-template-include-signature-care").isChecked(), true);
  await page.getByTestId("settings-close").click();

  // Use ordinary search to avoid unrelated AI/calendar interactions.
  await page.getByTestId("button-smart-search").click();
  await page.getByTestId("toggle-ai-search").click();
  await page.keyboard.press("Escape");
  await search("group:care");
  // Changing only the draft scope must not change the executed search's template.
  await page.getByTestId("button-smart-search").click();
  await page.locator(".omni-scope-select").selectOption("group:finance");
  await page.keyboard.press("Escape");
  await page.getByTestId("button-email-search-export").click();
  assert.equal(await page.getByTestId("search-export-subject").inputValue(), "Support correspondence");
  assert.equal(await page.getByTestId("search-export-sender").innerText(), "me@example.test");
  assert.equal(await page.getByTestId("search-export-include-signature").isChecked(), true);
  await mkdir("generated-artifacts/omni-group-templates", { recursive: true });
  await page.screenshot({ path: "generated-artifacts/omni-group-templates/desktop.png" });
  await page.getByTestId("search-export-subject").fill("One-time edited subject");
  await page.getByTestId("search-export-body").fill("One-time edited message.");
  assert.equal(await page.getByTestId("search-export-signature").count(), 0,
    "the existing personal signature is resolved by the server, never edited here");
  await confirmSend();
  assert.deepEqual(deliveries[0].delivery, { to: "archive@example.test", subject: "One-time edited subject", body: "One-time edited message.", includeSignature: true });
  assert.deepEqual(deliveries[0].messages.map(message => message.mailbox), ["support@example.test"]);
  assert.equal(groups[0].replyTemplate.subject, "Support correspondence");

  await page.getByTestId("button-email-search-export").click();
  assert.equal(await page.getByTestId("search-export-subject").inputValue(), "Support correspondence");
  await page.getByTestId("search-export-include-signature").uncheck();
  await confirmSend();
  assert.equal(deliveries[1].delivery.body, "Please find the requested emails attached.");
  await search("group:finance");
  await page.getByTestId("button-email-search-export").click();
  assert.equal(await page.getByTestId("search-export-subject").inputValue(), "Finance archive");
  assert.equal(await page.getByTestId("search-export-signature").count(), 0);
  assert.equal(await page.getByTestId("search-export-include-signature").isChecked(), false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("search-export-recipient").fill("archive@example.test");
  await page.getByTestId("confirm-send-search-export").scrollIntoViewIfNeeded();
  const bounds = await page.getByTestId("confirm-send-search-export").boundingBox();
  assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 844);
  await page.screenshot({ path: "generated-artifacts/omni-group-templates/mobile.png" });
  await confirmSend();
  assert.equal(deliveries[2].delivery.body, "Finance messages attached.");
  assert.deepEqual(errors, []);
  console.log("PASS group template defaults, persistence, group isolation, executed-search scope, editable send copies, signature on/off and mobile confirmation.");
} catch (error) {
  console.error("Browser errors:", errors);
  console.error("Visible screen:", (await page.locator("body").innerText()).slice(0, 2400));
  throw error;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
