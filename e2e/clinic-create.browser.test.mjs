// Real built UI, isolated HTTP fixtures; no auth bypass or database mutations.
import assert from "node:assert/strict";
import express from "express";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const dist = resolve(process.env.CLINIC_TEST_DIST || "dist/public");
const app = express();
app.use(express.static(dist));
app.use((_, res) => res.sendFile(resolve(dist, "index.html")));
const server = app.listen(0, "127.0.0.1");
await new Promise(resolve => server.on("listening", resolve));
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [], writes = [];
page.on("pageerror", error => errors.push(error.message));
const user = { id: "clinic-fixture-admin", username: "clinic-admin", fullName: "Clinic Test",
  role: "admin", isActive: true, assignedCountries: ["SK"], language: "en", email: "clinic@example.test" };
const existingPerson = { id: "existing-person", firstName: "Existing", lastName: "Doctor", countryCode: "SK", isActive: true };
const newPerson = { id: "new-person", firstName: "New", lastName: "Doctor", countryCode: "SK", isActive: true };
let clinic = null, failedUpload = false, representative = null, people = [], agreementCount = 0;
await page.route("**/api/**", async route => {
  const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
  let data = [], status = 200;
  if (method !== "GET") writes.push({ path, method, body: req.postData() });
  if (path === "/api/auth/me") data = { user };
  else if (path === "/api/countries") data = [{ code: "SK", name: "Slovakia", isActive: true }];
  else if (path === "/api/clinics/stats") data = { total: clinic ? 1 : 0, pipeline: {}, noStatus: 0, otherStatus: 0, referralCount: 0, conferenceCount: 0, byCountry: {} };
  else if (path === "/api/clinics" && method === "POST") {
    clinic = { ...req.postDataJSON(), id: "created-clinic" }; data = clinic; status = 201;
  } else if (path === "/api/clinics/created-clinic" && method === "PUT") {
    clinic = { ...clinic, ...req.postDataJSON() }; data = clinic;
  } else if (path === "/api/clinics") data = clinic ? [clinic] : [];
  else if (path === "/api/collaborators/lookup") data = /New/i.test(url.searchParams.get("q")) ? [] : [existingPerson];
  else if (path === "/api/collaborators/existing-person") data = existingPerson;
  else if (path === "/api/collaborators/new-person") data = newPerson;
  else if (path === "/api/collaborators" && method === "POST") data = { ...req.postDataJSON(), ...newPerson };
  else if (path === "/api/representatives") data = [{ id: "representative", name: "Assigned Representative", email: "rep@example.test", clinicCount: 0 }];
  else if (path === "/api/clinics/created-clinic/representative") {
    if (method === "POST") representative = { ...req.postDataJSON(), id: "assignment", validFrom: new Date().toISOString(), user: { fullName: "Assigned Representative" } };
    data = method === "GET" ? { assignment: representative } : representative;
  } else if (path === "/api/institutions/clinic/created-clinic/personnel") {
    if (method === "POST") {
      const body = req.postDataJSON();
      people.push({ ...body, assignment_id: "saved-" + body.personId, person_id: body.personId,
        first_name: body.personId === newPerson.id ? "New" : "Existing", last_name: "Doctor" });
    }
    data = method === "GET" ? { assigned: people, legacy: [], clinicDoctor: null } : people.at(-1);
  } else if (path.startsWith("/api/institutions/clinic/created-clinic/personnel/") && method === "PUT") {
    const id = path.split("/").at(-1), body = req.postDataJSON();
    people = people.map(row => row.assignment_id === id ? { ...row, ...body } : row);
    data = people.find(row => row.assignment_id === id);
  } else if (path === "/api/clinics/created-clinic/agreements") {
    if (method === "POST") {
      if (!failedUpload && agreementCount === 1) { failedUpload = true; status = 503; data = { error: "fixture_retry" }; }
      else { agreementCount++; data = { id: "agreement-" + agreementCount }; }
    } else data = { agreements: [], canManage: true, canDelete: true };
  } else if (path === "/api/suggest-region-district") data = { region: "Trnavský kraj", district: "Trnava", confidence: "high" };
  else if (path.includes("ms365-connection")) data = { connected: false };
  else if (path.includes("ms365-unread-counts")) data = { connected: false, counts: [] };
  else if (path === "/api/nexus/mailbox-groups") data = { groups: [], revision: 0 };
  await route.fulfill({ status, json: data });
});
const shots = "generated-artifacts/clinic-create";
const tab = name => page.getByTestId("tab-clinic-add-" + name);
const assignExisting = async () => {
  await page.getByTestId("button-add-personnel-drawer").click();
  await page.getByTestId("input-search-collab-drawer").fill("Existing");
  await page.getByTestId("option-collab-drawer-existing-person").click();
  await page.getByTestId("button-confirm-assign-drawer").click();
  await page.getByTestId("form-assign-personnel-drawer").waitFor({ state: "hidden" });
};
try {
  await mkdir(shots, { recursive: true });
  await page.goto(`http://127.0.0.1:${server.address().port}/hospitals?tab=clinics`);
  await page.getByTestId("button-add-clinic").click();
  await page.getByTestId("input-add-clinic-name").fill("Creation fixture clinic");
  assert.equal(await page.locator('[data-testid^="input-add-doctor-"]').count(), 0, "No obsolete Doctor fields");
  await page.getByTestId("select-add-clinic-country").click();
  await page.getByRole("option", { name: /Slovakia/ }).click();
  await tab("personnel").click();
  await assignExisting();
  assert.equal(writes.filter(w => w.path.includes("/personnel")).length, 0, "Draft selection must not write an institution link");
  await page.getByTestId("button-remove-person-drawer-existing-person").click();
  await assignExisting();
  await page.getByTestId("button-add-personnel-drawer").click();
  await page.getByTestId("input-search-collab-drawer").fill("New");
  await page.getByTestId("button-add-new-person-personnel").click();
  await page.getByTestId("wizard-input-collaborator-firstname").fill("New");
  await page.getByTestId("wizard-input-collaborator-lastname").fill("Doctor");
  await page.getByTestId("wizard-button-save").click();
  await page.getByTestId("wizard-button-save").waitFor({ state: "hidden" });
  await page.getByTestId("button-confirm-assign-drawer").click();
  await page.getByTestId("form-assign-personnel-drawer").waitFor({ state: "hidden" });
  assert.equal(await page.getByTestId("button-remove-person-drawer-new-person").count(), 1);
  await page.screenshot({ path: `${shots}/personnel.png` });
  await tab("representative").click();
  await page.getByTestId("button-representative-assign").click();
  await page.getByTestId("select-representative-user").click();
  await page.getByRole("option", { name: /Assigned Representative/ }).click();
  await page.getByTestId("button-representative-confirm").click();
  await page.getByTestId("button-representative-confirm").waitFor({ state: "hidden" });
  assert.equal(writes.filter(w => w.path.endsWith("/representative")).length, 0);
  await tab("agreements").click();
  await page.getByTestId("input-create-agreement-files").setInputFiles([
    { name: "first.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") },
    { name: "second.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") },
  ]);
  await page.getByTestId("button-save-clinic-add").click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="button-save-clinic-add"]')?.disabled);
  assert.equal(writes.filter(w => w.path === "/api/clinics" && w.method === "POST").length, 0, "Invalid agreement metadata must fail before creating the clinic");
  for (const checkbox of await page.getByTestId("clinic-create-agreements").getByRole("checkbox").all()) await checkbox.check();
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity && Number(a.effect?.getTiming().duration) < 1000).map(a => a.finished.catch(() => {}))));
  await page.screenshot({ path: `${shots}/agreements.png` });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({ path: `${shots}/agreements-dark.png` });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${shots}/agreements-mobile.png` });
  await page.setViewportSize({ width: 1440, height: 900 });
  // The address is on the basic-data tab in this drawer.
  await tab("basic").click();
  const city = page.getByTestId("input-add-clinic-city");
  if (!(await city.count())) await tab("address").click();
  await city.fill("Trnava");
  await page.getByTestId("button-suggest-region").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="select-add-clinic-district"]')?.textContent?.includes("Trnava"));
  await page.getByTestId("button-save-clinic-add").click();
  await page.getByRole("alert").filter({ hasText: /The clinic was created|Ambulancia bola vytvorená/ }).first().waitFor();
  assert.equal(clinic.initialStatus, "not_contacted");
  assert.equal(people.length, 2);
  assert.equal(agreementCount, 1);
  await tab("agreements").click();
  const agreementForms = page.getByTestId("clinic-create-agreements").locator("fieldset");
  assert.equal(await agreementForms.nth(0).locator("input").first().isDisabled(), true, "Already uploaded metadata must remain fixed");
  assert.equal(await agreementForms.nth(1).locator("input").first().isDisabled(), false, "Unfinished agreement remains editable after a failure");
  await agreementForms.nth(1).locator('input:not([type="hidden"])').first().fill("Corrected second agreement");
  await page.getByTestId("button-save-clinic-add").click();
  await page.getByTestId("button-close-clinic-add").waitFor();
  assert.equal(writes.filter(w => w.path === "/api/clinics" && w.method === "POST").length, 1, "Retry must reuse the existing clinic");
  assert.equal(writes.filter(w => w.path.endsWith("/personnel") && w.method === "POST").length, 2, "Successful people must not be assigned twice");
  assert.equal(writes.filter(w => w.path.endsWith("/representative") && w.method === "POST").length, 1);
  assert.equal(agreementCount, 2, "Retry uploads only the remaining agreement");
  await page.getByTestId("button-close-clinic-add").click();
  await page.getByTestId("button-edit-clinic-created-clinic").click();
  await page.getByTestId("tab-clinic-personnel-drawer").click();
  await page.getByTestId("button-edit-assignment-existing-person").click();
  await page.getByTestId("card-edit-person-existing-person").locator("textarea").fill("Existing clinic edit");
  await page.getByTestId("button-save-edit-person").click();
  await page.getByTestId("card-edit-person-existing-person").waitFor({ state: "hidden" });
  assert.equal(people.find(row => row.person_id === existingPerson.id).notes, "Existing clinic edit", "Existing-clinic editing must still persist immediately");
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log("PASS: real Add Clinic UI, Person lookup/create/remove, representative, agreements, defaults, address and partial-save retry");
} catch (error) {
  await page.screenshot({ path: `${shots}/failure.png` });
  console.error("PAGE_ERRORS", errors);
  console.error("VISIBLE_TEXT", (await page.locator("body").innerText()).slice(-3500));
  throw error;
} finally {
  await browser.close(); server.close();
}
