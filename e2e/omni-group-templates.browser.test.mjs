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
let revision = 1, personalAvailable = true;
let groups = [
  { id: "care", name: "Customer support", emails: ["support@example.test", "empty@example.test"] },
  { id: "finance", name: "Finance", emails: ["billing@example.test"],
    replyTemplate: { subject: "Finance archive", body: "Finance messages attached.", includeSignature: false } },
];
const mailboxes = [
  { id: "personal", email: "me@example.test", displayName: "Personal account", type: "personal", isDefault: true },
  { id: "support", email: "support@example.test", displayName: "Support account", type: "shared" },
  { id: "billing", email: "billing@example.test", displayName: "Billing account", type: "shared" },
  { id: "empty", email: "empty@example.test", displayName: "Empty account", type: "shared" },
];
page.on("pageerror", error => errors.push(error.message));
await page.route("**/api/**", async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  let data = [];
  if (path === "/api/auth/me") data = { user: { id: "omni-fixture", username: "fixture", fullName: "Test Operator", email: "me@example.test", role: "admin", isActive: true, assignedCountries: ["SK"] } };
  if (path.includes("ms365-available-mailboxes")) data = mailboxes.filter(mailbox => personalAvailable || mailbox.type !== "personal");
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
  if (path.includes("ms365-search-emails") && new URL(request.url()).searchParams.get("mailbox") === "empty@example.test")
    data = { connected: true, totalCount: 0, emails: [] };
  if (path === "/api/nexus/search-export") {
    const payload = request.postDataJSON();
    if (!payload.delivery) return route.fulfill({ status: 200, contentType: "application/zip",
      headers: { "Content-Disposition": `attachment; filename="nexus-omni-${payload.format}.zip"` },
      body: Buffer.from("UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==", "base64") });
    deliveries.push(payload);
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
const settleDialog = async () => page.getByRole("dialog").evaluate(async element => {
  await Promise.all(element.getAnimations({ subtree: true })
    .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
    .map(animation => animation.finished.catch(() => {})));
});
const search = async (scope, query = "fixture-search") => {
  await page.getByTestId("button-smart-search").click();
  await page.locator(".omni-scope-select").selectOption(scope);
  await page.getByTestId("input-smart-search").fill(query);
  await Promise.all([
    page.waitForResponse(response => response.url().includes("ms365-search-emails")),
    page.getByTestId("input-smart-search").press("Enter"),
  ]);
  await page.getByTestId("button-email-search-export").waitFor();
};
const assertHeaderFits = async () => {
  const header = page.getByTestId("omni-search-results-header");
  await header.waitFor();
  const layout = await header.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { width: element.clientWidth, scrollWidth: element.scrollWidth, left: rect.left, right: rect.right };
  });
  assert.ok(layout.scrollWidth <= layout.width + 1, "result controls must not overflow the actual results pane");
  for (const id of ["button-export-search", "button-email-search-export", "search-export-format"]) {
    const control = page.getByTestId(id);
    assert.equal(await control.isVisible(), true, `${id} must remain visible`);
    const bounds = await control.boundingBox();
    assert.ok(bounds && bounds.x >= layout.left - 1 && bounds.x + bounds.width <= layout.right + 1,
      `${id} must fit inside the actual ${layout.width}px header`);
  }
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
  await search("group:care", "Requested invoice correspondence with a deliberately long search description that must not displace the download or email controls");
  await assertHeaderFits();
  await mkdir("generated-artifacts/omni-results-header", { recursive: true });
  await page.screenshot({ path: "generated-artifacts/omni-results-header/narrow-desktop.png" });
  await page.getByTestId("search-export-format").click();
  await page.getByRole("option", { name: "MSG", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"), page.getByTestId("button-export-search").click(),
  ]);
  assert.equal(download.suggestedFilename(), "nexus-omni-msg.zip");
  // Changing only the draft scope must not change the executed search's template.
  await page.getByTestId("button-smart-search").click();
  await page.locator(".omni-scope-select").selectOption("group:finance");
  await page.getByTestId("input-smart-search").fill("unexecuted draft criteria");
  await page.keyboard.press("Escape");
  await page.getByTestId("button-email-search-export").click();
  assert.equal(await page.getByTestId("search-export-subject").inputValue(), "Support correspondence");
  assert.equal(await page.getByTestId("search-export-sender").innerText(), "me@example.test");
  assert.equal(await page.getByTestId("search-export-include-signature").isChecked(), true);
  const supportBody = await page.getByTestId("search-export-body").inputValue();
  assert.ok(supportBody.startsWith("Please find the requested emails attached.\n\nKritériá vyhľadávania"));
  assert.match(supportBody, /Requested invoice correspondence.*download or email controls/);
  assert.match(supportBody, /Bez dátumového obmedzenia/);
  assert.match(supportBody, /Skupina kont: Customer support/);
  assert.match(supportBody, /support@example\.test/);
  assert.match(supportBody, /empty@example\.test/, "include searched accounts even if they have no matches");
  assert.doesNotMatch(supportBody, /billing@example|unexecuted draft/);
  await mkdir("generated-artifacts/omni-group-templates", { recursive: true });
  await settleDialog();
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
  assert.equal(deliveries[1].delivery.body, supportBody);
  assert.equal(groups[0].replyTemplate.body, "Please find the requested emails attached.",
    "dynamic search criteria must never be saved into the reusable group template");
  await search("group:finance");
  await page.getByTestId("button-email-search-export").click();
  assert.equal(await page.getByTestId("search-export-subject").inputValue(), "Finance archive");
  assert.equal(await page.getByTestId("search-export-signature").count(), 0);
  assert.equal(await page.getByTestId("search-export-include-signature").isChecked(), false);
  const financeBody = await page.getByTestId("search-export-body").inputValue();
  assert.ok(financeBody.startsWith("Finance messages attached.\n\nKritériá vyhľadávania"));
  assert.match(financeBody, /fixture-search/);
  assert.match(financeBody, /billing@example\.test/);
  assert.doesNotMatch(financeBody, /support@example|empty@example/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("search-export-recipient").fill("archive@example.test");
  await page.getByTestId("confirm-send-search-export").scrollIntoViewIfNeeded();
  const bounds = await page.getByTestId("confirm-send-search-export").boundingBox();
  assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 844);
  await settleDialog();
  await page.screenshot({ path: "generated-artifacts/omni-group-templates/mobile.png" });
  await confirmSend();
  assert.equal(deliveries[2].delivery.body, financeBody);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.getByTestId("button-smart-search").click();
  await page.getByTestId("input-smart-search").fill("");
  for (const id of ["search-date-from", "search-date-to"]) {
    await page.getByTestId(id).click();
    await page.locator('[data-state="open"][data-side] button[name="day"]').filter({ hasText: /^5$/ }).first().click();
  }
  await Promise.all([
    page.waitForResponse(response => response.url().includes("ms365-search-emails")),
    page.getByTestId("execute-date-search").click(),
  ]);
  await assertHeaderFits();
  await page.getByTestId("button-email-search-export").click();
  const dateBody = await page.getByTestId("search-export-body").inputValue();
  assert.match(dateBody, /Bez textového obmedzenia/);
  assert.match(dateBody, /Dátum od: \d{2}\. \d{2}\. \d{4}/);
  assert.match(dateBody, /Dátum do: \d{2}\. \d{2}\. \d{4}/);
  assert.match(dateBody, /billing@example\.test/);
  assert.doesNotMatch(dateBody, /fixture-search|support@example|empty@example/);
  await settleDialog();
  await page.screenshot({ path: "generated-artifacts/omni-results-header/date-criteria-dialog.png" });
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "generated-artifacts/omni-results-header/date-only.png" });
  await page.getByTestId("button-expand-search").click();
  await assertHeaderFits();
  await page.getByTestId("button-expand-search").click();
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await assertHeaderFits();
  await page.screenshot({ path: "generated-artifacts/omni-results-header/dark.png" });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await go();
  await search("all");
  await page.getByTestId("button-email-search-export").click();
  const allAccountsBody = await page.getByTestId("search-export-body").inputValue();
  for (const mailbox of mailboxes) assert.ok(allAccountsBody.includes(`- ${mailbox.email}`));
  assert.doesNotMatch(allAccountsBody, /Skupina kont:/);
  await page.keyboard.press("Escape");
  const originalBody = groups[0].replyTemplate.body;
  groups[0].replyTemplate.body = "x".repeat(20000);
  await go();
  await search("group:care");
  await page.getByTestId("button-email-search-export").click();
  assert.ok((await page.getByTestId("search-export-body").inputValue()).length > 20000);
  assert.match(await page.getByRole("alert").innerText(), /20 000/);
  assert.equal(await page.getByTestId("confirm-send-search-export").isDisabled(), true);
  groups[0].replyTemplate.body = originalBody;
  // Missing personal sender must never make the send action disappear.
  personalAvailable = false;
  await go();
  await search("group:care");
  await assertHeaderFits();
  assert.equal(await page.getByTestId("button-email-search-export").isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log("PASS executed criteria and all searched accounts including zero matches; editable send copies, group isolation, date-only/all accounts, size guard, responsive controls and personal signature.");
} catch (error) {
  console.error("Browser errors:", errors);
  console.error("Visible screen:", (await page.locator("body").innerText()).slice(0, 2400));
  throw error;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
