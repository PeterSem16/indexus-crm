// Real Nexus Omni page -> real note HTTP handlers -> private PostgreSQL cluster.
// No production login bypass; auth/Graph/AI are fixtures in this test-only server.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { startCrmFixture, syntheticNote } from "./email-notes-crm-fixture";
import { createEmailNoteService } from "../server/lib/email-note-jobs-service";

const out = "generated-artifacts/email-notes-crm-ui";
await fs.mkdir(out, { recursive: true });
const fixture = await startCrmFixture();
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium",
  headless: true, args: ["--no-sandbox"] });
const checks: string[] = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce", permissions: ["clipboard-read", "clipboard-write"] });
  await context.addCookies([{ name: "notes_fixture_user", value: "owner", url: fixture.base }]);
  const page = await context.newPage(), errors: string[] = [], external: string[] = [];
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => errors.push(error.message));
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.protocol.startsWith("http") && url.origin !== fixture.base) {
      external.push(url.origin); return route.abort();
    }
    return route.continue();
  });
  const openEmail = async (id: string) => {
    await page.getByTestId(`email-item-${id}`).first().click();
    await page.getByText(`Syntetický e-mail ${id}`, { exact: true }).first().waitFor();
  };
  await page.goto(`${fixture.base}/email?tab=email`);
  await page.getByTestId("tab-email").waitFor();
  await page.getByTestId("nav-nexus-omni").click();
  const disabledResponse = page.waitForResponse(r => r.url().includes("/ai-note"));
  await openEmail("one");
  assert.equal((await (await disabledResponse).json()).enabled, false);
  assert.equal(await page.getByTestId("email-note-draft").count(), 0);
  assert.equal(fixture.submissions.length, 0);
  checks.push("Default-off flag hides notes and creates no job");

  fixture.setEnabled(true);
  await page.reload();
  await openEmail("one");
  const create = page.getByRole("button", { name: /Vytvoriť poznámku/ }).first();
  await create.waitFor();
  const submitted = page.waitForResponse(r => r.url().includes("/ai-note") && r.request().method() === "POST");
  await create.click();
  assert.equal((await submitted).status(), 202);
  await page.getByText("Čaká na spracovanie", { exact: true }).first().waitFor();
  assert.equal(fixture.submissions.length, 1);
  assert.match(fixture.submissions[0].text, /^Syntetický e-mail one\n\nVymyslený test:/);
  checks.push("Real Omni create action reads the exact persisted synthetic email, not browser-supplied text");

  await fixture.complete();
  const edit = page.locator('[data-testid="email-note-edit"]:visible').first();
  await edit.waitFor();
  assert.equal(await edit.inputValue(), syntheticNote);
  const saved = await fixture.service.get(fixture.scope);
  assert.equal(saved.status, "review_required");
  const binding = (await fixture.pool.query(
    "SELECT owner_user_id,mailbox_email,message_id FROM email_note_jobs WHERE id=$1", [saved.id])).rows[0];
  assert.deepEqual(binding, { owner_user_id: "owner", mailbox_email: fixture.scope.mailbox, message_id: "one" });
  assert.equal(saved.approved_at, null);
  assert.equal((await fixture.pool.query("SELECT count(*)::int n FROM email_note_job_audit")).rows[0].n, 0);
  const fresh = createEmailNoteService(fixture.pool, { enabled: () => true, client: {
    submit: async () => { throw Error("UNEXPECTED_EXTERNAL_REQUEST"); },
    poll: async () => { throw Error("UNEXPECTED_EXTERNAL_REQUEST"); },
  } });
  assert.equal((await fresh.get(fixture.scope)).note, syntheticNote);
  checks.push("Completed result persisted across service instances as review_required, never auto-approved");

  const edited = "Odosielateľ žiada vysvetlenie postupu doručenia informačných materiálov.";
  await edit.fill(edited);
  await page.getByRole("button", { name: /Kopírovať/ }).first().click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), edited);
  await page.screenshot({ path: `${out}/review-required-desktop.jpg`, fullPage: true });
  const approvedResponse = page.waitForResponse(r => r.url().includes("/ai-note") && r.request().method() === "PATCH");
  await page.getByRole("button", { name: /Schváliť/ }).first().click();
  assert.equal((await approvedResponse).status(), 200);
  await page.getByText(edited, { exact: true }).first().waitFor();
  const approved = await fresh.get(fixture.scope);
  assert.equal(approved.status, "approved");
  assert.equal(approved.approved_by, "owner");
  assert.ok(approved.approved_at);
  assert.equal(approved.note, syntheticNote);
  assert.equal(approved.approved_note, edited);
  const audit = (await fixture.pool.query("SELECT * FROM email_note_job_audit WHERE note_id=$1", [approved.id])).rows;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor_user_id, "owner");
  assert.equal(audit[0].previous_note, syntheticNote);
  assert.equal(audit[0].approved_note, edited);
  assert.ok(audit[0].created_at);
  checks.push("Browser user edited/copied/explicitly approved; immutable original and one timestamped actor audit persisted");
  await page.reload();
  await openEmail("one");
  await page.getByText(edited, { exact: true }).first().waitFor();
  await page.screenshot({ path: `${out}/approved-desktop.jpg`, fullPage: true });
  checks.push("Approved note survives full page reload in existing Nexus Omni email detail");

  const api = `${fixture.base}/api/users/owner/ms365-email/one/ai-note?mailbox=personal`;
  const other = await browser.newContext();
  await other.addCookies([{ name: "notes_fixture_user", value: "other", url: fixture.base }]);
  const anonymous = await browser.newContext();
  for (const method of ["GET", "POST", "PATCH"]) {
    assert.equal((await anonymous.request.fetch(api, { method })).status(), 401);
    assert.equal((await other.request.fetch(api, { method })).status(), 403);
    fixture.setRevoked(true);
    assert.equal((await context.request.fetch(api, { method })).status(), 403);
    fixture.setRevoked(false);
  }
  assert.equal((await context.request.patch(api, { data: { note: "short", version: saved.version } })).status(), 400);
  assert.equal((await context.request.patch(api, {
    data: { note: "Syntetická zmena so starou verziou záznamu.", version: saved.version },
  })).status(), 409);
  assert.equal((await fixture.pool.query("SELECT count(*)::int n FROM email_note_job_audit")).rows[0].n, 1);
  checks.push("Real API enforces 401/403 for all actions and 409 for stale approval; no extra audit was written");
  await other.close(); await anonymous.close();

  await openEmail("two");
  await page.getByRole("button", { name: /Vytvoriť poznámku/ }).first().waitFor();
  assert.equal(await page.getByTestId("email-note-edit").count(), 0);
  assert.equal(await page.getByText(edited, { exact: true }).count(), 0);
  assert.equal(await fixture.service.get({ ...fixture.scope, messageId: "two" }), null);
  checks.push("Switching to another email never leaks the first note or approval");
  await openEmail("one");
  await page.getByText(edited, { exact: true }).first().waitFor();
  await page.getByTestId("email-item-one").first().dblclick();
  const dialog = page.getByRole("dialog").last();
  await dialog.waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  const mobileNote = dialog.getByTestId("email-note-draft");
  await mobileNote.scrollIntoViewIfNeeded();
  assert.ok((await mobileNote.boundingBox())!.width > 250, "Readable mobile modal, not a collapsed desktop pane");
  await dialog.screenshot({ path: `${out}/approved-mobile-dark.jpg`, animations: "disabled" });
  assert.equal(await mobileNote.getByText(edited, { exact: true }).count(), 1);
  checks.push("Existing Omni desktop detail and mobile dark email modal render the approved note");
  assert.deepEqual(errors, []);
  assert.equal(fixture.submissions.length, 1);
  const report = { crm_integration: "PASS", ui: "PASS", checks, production_changed: false,
    external_ai_calls: 0, external_graph_calls: 0, blocked_external_origins: [...new Set(external)],
    scope: "Current full CRM frontend + real note routes/service/PostgreSQL. Auth, Graph and AI boundaries are local fixtures.",
    approval: "Explicit Playwright user click; real human production acceptance is not claimed." };
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await fixture.close();
}
