// Real application bundle; isolated HTTP records, no database or external payments.
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
page.setDefaultTimeout(12000);
const errors = [], writes = [];
page.on("pageerror", e => errors.push(e.message));
const user = { id: "banking-fixture", username: "banking-admin", fullName: "Banking fixture",
  role: "admin", isActive: true, assignedCountries: ["SK"], language: "en" };
let clinic;
await page.route("**/api/**", async route => {
  const req = route.request(), path = new URL(req.url()).pathname, method = req.method();
  let data = [];
  if (path === "/api/auth/me") data = { user };
  else if (path === "/api/countries") data = [{ code: "SK", name: "Slovakia", isActive: true }];
  else if (path === "/api/clinics/stats") data = { total: clinic ? 1 : 0, pipeline: {}, noStatus: 0, otherStatus: 0, referralCount: 0, conferenceCount: 0, byCountry: {} };
  else if (path === "/api/clinics" && method === "POST") {
    writes.push({ method, body: req.postDataJSON() }); clinic = { ...req.postDataJSON(), id: "banking-clinic" }; data = clinic;
  } else if (path === "/api/clinics/banking-clinic" && method === "PUT") {
    writes.push({ method, body: req.postDataJSON() }); clinic = { ...clinic, ...req.postDataJSON() }; data = clinic;
  } else if (path === "/api/clinics") data = clinic ? [clinic] : [];
  else if (path === "/api/clinics/banking-clinic") data = clinic;
  else if (path.includes("/representative")) data = { assignment: null };
  else if (path.includes("ms365-connection")) data = { connected: false };
  else if (path.includes("ms365-unread-counts")) data = { connected: false, counts: [] };
  else if (path === "/api/nexus/mailbox-groups") data = { groups: [], revision: 0 };
  await route.fulfill({ json: data });
});
const fields = {
  name: () => page.getByTestId("input-clinic-bank-account-name"),
  number: () => page.getByTestId("wizard-input-account-number"),
  code: () => page.getByTestId("wizard-input-bank-code"),
  iban: () => page.getByTestId("wizard-input-collaborator-iban"),
  swift: () => page.getByTestId("wizard-input-collaborator-swift"),
};
const output = "generated-artifacts/clinic-banking";
const settle = () => page.evaluate(async () => {
  await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
});
try {
  await mkdir(output, { recursive: true });
  await page.goto(`http://127.0.0.1:${server.address().port}/hospitals?tab=clinics`);
  await page.getByTestId("button-add-clinic").click();
  await page.getByTestId("input-add-clinic-name").fill("Banking test clinic");
  await page.getByTestId("select-add-clinic-country").click();
  await page.getByRole("option", { name: /Slovakia/ }).click();
  await page.getByTestId("tab-clinic-add-banking").click();
  assert.equal(await page.getByTestId("bank-account-section").locator(".grid").first().evaluate(el => getComputedStyle(el).display), "grid", "Real Tailwind styling must be present");
  await fields.name().fill("Clinic agreement account");
  await fields.number().fill("19-8742637541");
  await fields.code().fill("1200");
  await page.getByTestId("btn-convert-iban").click();
  assert.equal(await fields.iban().inputValue(), "SK3112000000198742637541");
  await fields.swift().fill("testskbx");
  await settle();
  await page.screenshot({ path: `${output}/create.png` });
  await page.getByTestId("button-save-clinic-add").click();
  await page.getByTestId("button-close-clinic-add").waitFor();
  assert.equal(clinic.bankAccountName, "Clinic agreement account");
  assert.equal(clinic.bankAccountNumber, "19-8742637541");
  assert.equal(clinic.bankCode, "1200");
  assert.equal(clinic.bankAccountIban, "SK3112000000198742637541");
  assert.equal(clinic.swiftCode, "TESTSKBX");
  await page.getByTestId("button-close-clinic-add").click();
  await page.getByTestId("button-edit-clinic-banking-clinic").click();
  await page.getByTestId("tab-clinic-banking-drawer").click();
  assert.equal(await fields.name().inputValue(), clinic.bankAccountName);
  assert.equal(await fields.number().inputValue(), clinic.bankAccountNumber);
  assert.equal(await fields.iban().inputValue(), clinic.bankAccountIban);
  await fields.name().fill("Updated contract account");
  await fields.iban().fill("CZ65 0800 0000 1920 0014 5399");
  await page.getByTestId("button-save-clinic-drawer").click();
  await page.getByTestId("button-edit-clinic-banking-clinic").click();
  await page.getByTestId("tab-clinic-banking-drawer").click();
  assert.equal(await fields.name().inputValue(), "Updated contract account");
  assert.equal(await fields.iban().inputValue(), "CZ6508000000192000145399", "Foreign contract IBAN must not be replaced with an SK account");
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await settle();
  await page.screenshot({ path: `${output}/edit-dark.png` });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.setViewportSize({ width: 390, height: 844 });
  await settle();
  await page.screenshot({ path: `${output}/mobile.png` });
  for (const field of Object.values(fields)) {
    const bounds = await field().boundingBox();
    assert(bounds.x >= 0 && bounds.x + bounds.width <= 391, "Bank input must fit a phone viewport");
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const field of Object.values(fields)) await field().fill("");
  await page.getByTestId("button-save-clinic-drawer").click();
  for (const key of ["bankAccountName", "bankAccountNumber", "bankCode", "bankAccountIban", "swiftCode"]) assert.equal(clinic[key], null);
  assert.equal(writes.filter(w => w.method === "POST").length, 1);
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log("PASS: Add Clinic, edit/reopen/clear, all five bank fields, SK conversion, foreign contract IBAN, mobile and dark mode");
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` });
  console.error(errors, (await page.locator("body").innerText()).slice(-2500));
  throw error;
} finally {
  await browser.close(); server.close(); server.closeAllConnections();
}
