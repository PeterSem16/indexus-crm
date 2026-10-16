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
  if (ids.countrySnapshot) {
    const snapshot = JSON.parse(ids.countrySnapshot);
    await pool.query("DELETE FROM provider_finder_country_forms WHERE country='SK'");
    if (snapshot.policy) {
      const p = snapshot.policy;
      await pool.query(`INSERT INTO provider_finder_country_policies(country,settings,updated_by,updated_at)
        VALUES('SK',$1,$2,$3) ON CONFLICT(country) DO UPDATE SET settings=EXCLUDED.settings,
        updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at`, [p.settings, p.updated_by, p.updated_at]);
      for (const form of snapshot.forms)
        await pool.query("INSERT INTO provider_finder_country_forms(form_id,country) VALUES($1,'SK')", [form.form_id]);
    } else await pool.query("DELETE FROM provider_finder_country_policies WHERE country='SK'");
  }
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
  ids.countrySnapshot = JSON.stringify({
    policy: (await pool.query("SELECT * FROM provider_finder_country_policies WHERE country='SK'")).rows[0] || null,
    forms: (await pool.query("SELECT form_id FROM provider_finder_country_forms WHERE country='SK'")).rows,
  });
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
    await pool.query(`INSERT INTO provider_finder_country_policies(country,settings) VALUES('SK',$1)
      ON CONFLICT(country) DO UPDATE SET settings=EXCLUDED.settings`,
      [JSON.stringify({ ...DEFAULT_FINDER_POLICY, enabled: true, publicEnabled: true, preferContract: false,
        priorityWeights: { distance: 100, cooperation: 0, uploadedContract: 0, representative: 0, recentContact: 0 } })]);
    await pool.query(`INSERT INTO provider_finder_country_forms(form_id,country) VALUES($1,'SK')`, [ids.form]);
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
    assert.equal(await page.getByTestId("select-provider-finder-company").count(), 0, "no company selector");
    await countryFinder.locator("#pf-default-radius").fill("17");
    await countryFinder.locator("#pf-weight-representative").fill("42");
    const policySaved = page.waitForResponse(r => r.url().includes("/api/provider-finder/country-config/SK") && r.request().method() === "PUT");
    await countryFinder.locator("button.primary").first().click();
    assert.equal((await policySaved).status(), 200);
    await page.screenshot({ path: "generated-artifacts/provider-finder/system-settings-desktop.png", fullPage: true });
    await openCountrySettings("CZ");
    assert.equal(await countryFinder.getAttribute("data-country"), "CZ");
    assert.equal(await countryFinder.locator(`option[value="${ids.company}"]`).count(), 0, "SK company cannot leak into CZ settings");
    await openCountrySettings("SK");
    await countryFinder.locator("#pf-default-radius").waitFor();
    assert.equal(await countryFinder.locator("#pf-default-radius").inputValue(), "17", "country settings survive reload");
    assert.equal(await countryFinder.locator("#pf-weight-representative").inputValue(), "42", "criterion weight survives reload");
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
    assert.equal(await page.getByTestId("provider-finder").count(), 0, "locator is closed and optional");
    await publicFinder.locator("button").first().click();
    const publicModal = page.getByTestId("provider-finder");
    await publicModal.waitFor();
    await publicModal.locator(".pf-button").filter({ hasText: /Použiť polohu/ }).first().click();
    const publicResult = publicModal.locator(".pf-result").filter({ hasText: "Synthetic finder browser clinic" });
    await publicResult.waitFor({ timeout: 20000 }); await publicResult.click();
    for (const selector of [".pf-modal-head", ".pf-modal-foot"]) {
      const box = await publicModal.locator(selector).boundingBox();
      assert.ok(box && box.y >= 0 && box.y + box.height <= 845, `${selector} stays visible within the mobile viewport`);
    }
    await page.screenshot({ path: "generated-artifacts/provider-finder/public-mobile.png", fullPage: true });
    await publicModal.locator(".pf-modal-foot .primary").click();
    await publicFinder.locator(".pf-selected-card").waitFor();
    assert.ok(await publicFinder.locator(".pf-selected-card").innerText());
    await publicFinder.getByRole("button", { name: /Zmeniť|Change/ }).click();
    await publicModal.waitFor();
    await publicModal.getByRole("button", { name: /Zavrieť|Close/, exact: true }).last().click();
    assert.ok((await publicFinder.locator(".pf-selected-card").innerText()).includes("Synthetic finder browser clinic"),
      "closing locator without choosing preserves confirmed selection");
    const submitted = page.waitForResponse(r => r.url().endsWith(`/api/public/web-form/${slug}/submit`) && r.request().method() === "POST");
    await page.getByRole("button", { name: "Odoslať žiadosť", exact: true }).click();
    const submissionResponse = await submitted;
    assert.equal(submissionResponse.status(), 200, "public submission succeeds without email delivery");
    const submittedRow = await pool.query("SELECT data FROM web_form_submissions WHERE form_id=$1 ORDER BY created_at DESC LIMIT 1", [ids.form]);
    const submittedData = typeof submittedRow.rows[0].data === "string" ? JSON.parse(submittedRow.rows[0].data) : submittedRow.rows[0].data;
    assert.equal(submittedData.providerSelection.id, ids.clinic, "selected provider stored with order");
    await page.goto(`/f/${slug}`);
    await page.getByTestId("public-provider-finder").waitFor();
    assert.equal(await page.getByTestId("provider-finder").count(), 0);
    const optionalSubmitted = page.waitForResponse(r => r.url().endsWith(`/api/public/web-form/${slug}/submit`) && r.request().method() === "POST");
    await page.getByRole("button", { name: "Odoslať žiadosť", exact: true }).click();
    assert.equal((await optionalSubmitted).status(), 200, "an order can be submitted without opening the optional locator");
    const optionalRow = await pool.query("SELECT data FROM web_form_submissions WHERE form_id=$1 ORDER BY created_at DESC LIMIT 1", [ids.form]);
    const optionalData = typeof optionalRow.rows[0].data === "string" ? JSON.parse(optionalRow.rows[0].data) : optionalRow.rows[0].data;
    assert.ok(!optionalData.providerSelection, "optional locator is never silently required");
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log("PASS: real public order form, mobile GPS search, public provider choice and order persistence; no browser exceptions");
    console.log(`Public fixture: /f/${slug}`);
  } finally {
    await browser?.close();
    if (!process.argv.includes("--keep")) await cleanup(ids);
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => pool.end());
