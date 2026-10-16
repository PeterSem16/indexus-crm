import { chromium } from "playwright";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import bcrypt from "bcrypt";
import { pool } from "../server/db";
import { DEFAULT_FINDER_POLICY } from "../shared/provider-finder";
import { ensureProviderFinderSchema } from "../server/lib/provider-finder-schema";

const fixturePath = "generated-artifacts/provider-finder/browser-fixtures.json";
async function cleanup(ids: Record<string, string>) {
  await pool.query("DELETE FROM user_sessions WHERE user_id=$1", [ids.user]);
  await pool.query("DELETE FROM customers WHERE id=$1", [ids.customer]);
  await pool.query("DELETE FROM web_form_submissions WHERE form_id=$1", [ids.form]);
  await pool.query("DELETE FROM web_forms WHERE id=$1", [ids.form]);
  await pool.query("DELETE FROM billing_details WHERE id=$1", [ids.company]);
  await pool.query("DELETE FROM clinics WHERE id=$1", [ids.clinic]);
  await pool.query("DELETE FROM users WHERE id=$1", [ids.user]);
  await fs.rm(fixturePath, { force: true });
}
async function main() {
  if (process.argv.includes("--cleanup")) { await cleanup(JSON.parse(await fs.readFile(fixturePath, "utf8"))); return; }
  await ensureProviderFinderSchema(pool);
  const ids = Object.fromEntries(["user", "customer", "form", "company", "clinic"].map(key => [key, randomUUID()]));
  const slug = `finder-browser-${ids.form}`; const username = `finder-browser-${ids.user}`;
  const password = randomBytes(24).toString("hex");
  await fs.mkdir("generated-artifacts/provider-finder", { recursive: true });
  await fs.writeFile(fixturePath, JSON.stringify({ ...ids, slug }));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,assigned_countries)
      VALUES($1,$2,$3,'Synthetic finder browser',$4,'admin',ARRAY['SK','CZ'])`, [ids.user, username, `${ids.user}@example.invalid`, await bcrypt.hash(password, 10)]);
    await pool.query(`INSERT INTO billing_details(id,country_code,company_name,address,city)
      VALUES($1,'SK','Synthetic finder browser company','test','test')`, [ids.company]);
    await pool.query(`INSERT INTO clinics(id,name,country_code,address,city,latitude,longitude)
      VALUES($1,'Synthetic finder browser clinic','SK','Test address','Test city',48.15,17.12)`, [ids.clinic]);
    await pool.query(`INSERT INTO customers(id,first_name,last_name,email,country,address,city,postal_code)
      VALUES($1,'Synthetic','FinderBrowser',$2,'SK','ORIGINAL TEST ADDRESS','Test city','00000')`, [ids.customer, `${ids.customer}@example.invalid`]);
    await pool.query(`INSERT INTO web_forms(id,name,slug,country_code,language,confirm_email_enabled)
      VALUES($1,'Synthetic provider finder order',$2,'SK','sk',false)`, [ids.form, slug]);
    await pool.query(`INSERT INTO provider_finder_policies(billing_company_id,country,settings) VALUES($1,'SK',$2)`,
      [ids.company, JSON.stringify({ ...DEFAULT_FINDER_POLICY, enabled: true, publicEnabled: true, services: ["Test service"] })]);
    await pool.query(`INSERT INTO provider_finder_profiles(billing_company_id,country,facility_type,facility_id,settings)
      VALUES($1,'SK','clinic',$2,$3)`, [ids.company, ids.clinic, JSON.stringify({ publicVisible: true, services: ["Test service"], contractReference: "SYNTHETIC TEST CONTRACT" })]);
    await pool.query(`INSERT INTO provider_finder_form_bindings(form_id,billing_company_id,country) VALUES($1,$2,'SK')`, [ids.form, ids.company]);
    browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
    const baseURL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 },
      geolocation: { latitude: 48.15, longitude: 17.11 }, permissions: ["geolocation"] });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    const response = await context.request.post("/api/auth/login", { data: { username, password } });
    assert.equal(response.status(), 200, "synthetic account login");
    async function openCountrySettings(country: string) {
      await page.goto("/configurator");
      await page.getByTestId("tab-billing-companies").click();
      await page.getByTestId("subtab-system-settings").click();
      await page.getByTestId("select-system-settings-country").click();
      await page.getByRole("option", { name: new RegExp(country === "SK" ? "Slov" : "Czech|Čes") }).click();
    }
    await openCountrySettings("SK");
    const countryFinder = page.getByTestId("country-provider-finder-settings");
    await countryFinder.waitFor();
    assert.equal(await countryFinder.getAttribute("data-country"), "SK");
    await page.getByTestId("select-provider-finder-company").selectOption(ids.company);
    await countryFinder.locator("#pf-default-radius").fill("17");
    const policySaved = page.waitForResponse(r => r.url().includes(`/api/provider-finder/config/${ids.company}/SK`) && r.request().method() === "PUT");
    await countryFinder.locator("button.primary").first().click();
    assert.equal((await policySaved).status(), 200);
    await page.screenshot({ path: "generated-artifacts/provider-finder/system-settings-desktop.png", fullPage: true });
    await openCountrySettings("CZ");
    assert.equal(await countryFinder.getAttribute("data-country"), "CZ");
    assert.equal(await countryFinder.locator(`option[value="${ids.company}"]`).count(), 0, "SK company cannot leak into CZ settings");
    await openCountrySettings("SK");
    await page.getByTestId("select-provider-finder-company").selectOption(ids.company);
    await countryFinder.locator("#pf-default-radius").waitFor();
    assert.equal(await countryFinder.locator("#pf-default-radius").inputValue(), "17", "country settings survive reload");
    await page.setViewportSize({ width: 390, height: 844 });
    await countryFinder.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "generated-artifacts/provider-finder/system-settings-mobile.png" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    console.log("PASS Billing Companies → System Settings → country: config save/reload and country isolation");
    await page.goto(`/customers?view=${ids.customer}`);
    const open = page.getByTestId("open-customer-provider-finder").first();
    await open.waitFor({ timeout: 45000 }); await open.click();
    if (await page.locator("#pf-company").count()) await page.locator("#pf-company").selectOption(ids.company);
    await page.getByTestId("provider-finder").waitFor();
    // Prefer the dedicated synthetic company if other configured companies are present.
    if (await page.locator("#pf-company").count()) await page.locator("#pf-company").selectOption(ids.company);
    await page.locator("#pf-address").fill("ALTERNATE TEST ADDRESS");
    await page.locator(".pf-button").filter({ hasText: /Použiť polohu|Use device location/ }).first().click();
    const result = page.locator(".pf-result").filter({ hasText: "Synthetic finder browser clinic" }).first();
    await result.waitFor({ timeout: 20000 }); await result.click();
    await page.screenshot({ path: "generated-artifacts/provider-finder/operator-desktop.png" });
    await page.locator(".pf-modal-foot .primary").click();
    await page.getByTestId("provider-finder").waitFor({ state: "hidden" });
    const saved = await context.request.get(`/api/provider-finder/customers/${ids.customer}`);
    assert.equal((await saved.json()).id, ids.clinic);
    assert.equal((await pool.query("SELECT address FROM customers WHERE id=$1", [ids.customer])).rows[0].address, "ORIGINAL TEST ADDRESS");
    console.log("PASS: real customer-card entry, GPS search, selection persistence, alternate address isolation");
    await page.goto(`/customers?view=${ids.customer}`); await open.waitFor({ timeout: 30000 });
    await open.click();
    if (await page.locator("#pf-company").count()) await page.locator("#pf-company").selectOption(ids.company);
    await page.getByTestId("provider-finder").waitFor(); await page.getByRole("button", { name: /Zavrieť|Close/, exact: true }).last().click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/f/${slug}`);
    const publicFinder = page.getByTestId("public-provider-finder"); await publicFinder.waitFor({ timeout: 30000 });
    await publicFinder.locator(".pf-button").filter({ hasText: /Použiť polohu/ }).first().click();
    const publicResult = publicFinder.locator(".pf-result").filter({ hasText: "Synthetic finder browser clinic" });
    await publicResult.waitFor({ timeout: 20000 }); await publicResult.click();
    await page.screenshot({ path: "generated-artifacts/provider-finder/public-mobile.png", fullPage: true });
    await publicFinder.locator(".pf-modal-foot .primary").click();
    await publicFinder.locator(".pf-selected-card").waitFor();
    assert.ok(await publicFinder.locator(".pf-selected-card").innerText());
    const submitted = page.waitForResponse(r => r.url().endsWith(`/api/public/web-form/${slug}/submit`) && r.request().method() === "POST");
    await page.getByRole("button", { name: "Odoslať žiadosť", exact: true }).click();
    const submissionResponse = await submitted;
    assert.equal(submissionResponse.status(), 200, "public submission succeeds without email delivery");
    const submittedRow = await pool.query("SELECT data FROM web_form_submissions WHERE form_id=$1 ORDER BY created_at DESC LIMIT 1", [ids.form]);
    const submittedData = typeof submittedRow.rows[0].data === "string" ? JSON.parse(submittedRow.rows[0].data) : submittedRow.rows[0].data;
    assert.equal(submittedData.providerSelection.id, ids.clinic, "selected provider stored with order");
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log("PASS: real public order form, mobile GPS search, public provider choice and order persistence; no browser exceptions");
    console.log(`Public fixture: /f/${slug}`);
  } finally {
    await browser?.close();
    if (!process.argv.includes("--keep")) await cleanup(ids);
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => pool.end());
