import assert from "node:assert/strict";
import { randomUUID, randomBytes, randomInt } from "node:crypto";
import fs from "node:fs/promises";
import bcrypt from "bcrypt";
import { chromium, type Page } from "playwright";
import { pool } from "../server/db";
import { loadAresCompany, loadAnafCompany } from "../server/lib/company-registry-client";
import { healthcareLegalEntityTranslations as copies, withRegistryCopy } from "../client/src/i18n/healthcare-legal-entity-translations";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT)
  throw new Error("Browser fixtures must not run in production");
const user = randomUUID(), hospital = randomUUID();
const username = `registry-browser-${user}`, password = randomBytes(24).toString("hex");
const ico = String(randomInt(90_000_000, 99_000_000));
const dir = "generated-artifacts/company-registry";
const root = "/api/healthcare-legal-entities";
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
let testPage: Page | undefined;
try {
  await fs.mkdir(dir, { recursive: true });
  await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,assigned_countries,is_active)
    VALUES($1,$2,$3,'Synthetic registry tester',$4,'admin',ARRAY['SK','CZ','RO'],true)`,
  [user, username, `${user}@example.invalid`, await bcrypt.hash(password, 10)]);
  await pool.query(`INSERT INTO hospitals(id,name,country_code,ico,street_number,city)
    VALUES($1,$2,'RO',$3,'Original operational address','Original city')`, [hospital, username, `RO${ico}`]);
  const context = await browser.newContext({ baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}`, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  testPage = page;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  assert.equal((await context.request.post("/api/auth/login", { data: { username, password } })).status(), 200);
  // Only external lookup is stubbed. Preview ownership/expiry, save, links, detail, export and auth are real.
  await page.route(`**${root}/verify`, async route => {
    const body = route.request().postDataJSON();
    const country = body.facilityId === hospital ? "RO" : body.countryCode;
    assert.ok(["CZ", "RO"].includes(country));
    const result = country === "CZ" ? await loadAresCompany(ico, async () => ({
      ico, obchodniJmeno: `${username}-CZ`, pravniForma: "112",
      sidlo: { textovaAdresa: "Synthetic registered Czech seat", nazevObce: "Praha", psc: 11000 },
      datumAktualizace: "2026-10-16",
    })) : await loadAnafCompany(ico, async () => ({ found: [{
      date_generale: { cui: Number(ico), denumire: `${username}-RO`, adresa: "Synthetic Romanian registered seat" },
      inregistrare_scop_Tva: { scpTVA: true }, stare_inactiv: { statusInactivi: false },
    }], notFound: [] }));
    const expiresAt = new Date(Date.now() + 1800000).toISOString();
    const { rows } = await pool.query(`INSERT INTO healthcare_legal_entity_verifications
      (created_by,facility_type,facility_id,normalized,registry_people,raw_data,checked_at,source_updated_at,expires_at)
      VALUES($1,$2,$3,$4,'[]',$5,$6,$7,$8) RETURNING id`, [user, body.facilityType || null, body.facilityId || null,
      JSON.stringify(result.company), JSON.stringify(result.rawData), result.checkedAt, result.sourceUpdatedAt, expiresAt]);
    const existing = await pool.query("SELECT id FROM healthcare_legal_entities WHERE country_code=$1 AND ico=$2", [country, ico]);
    await route.fulfill({ json: { verificationId: rows[0].id, expiresAt, company: result.company,
      existingEntityId: existing.rows[0]?.id || null, registryPeople: [], documents: [],
      checkedAt: result.checkedAt, sourceUpdatedAt: result.sourceUpdatedAt } });
  });
  for (const country of ["CZ", "RO"] as const) {
    await page.goto("/healthcare-legal-entities");
    await page.getByTestId("button-new-legal-entity").click();
    const dialog = page.getByRole("dialog");
    const english = await dialog.getByText(copies.en.country, { exact: true }).count();
    const base = english ? copies.en : copies.sk;
    const c = withRegistryCopy(base, country);
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: country === "CZ" ? base.countryCZ : base.countryRO, exact: true }).click();
    await page.getByTestId("input-verify-ico").fill(country === "RO" ? `RO${ico}` : ico);
    await page.getByTestId("button-verify-ico").click();
    await dialog.getByRole("heading", { name: `${username}-${country}`, exact: true }).waitFor();
    assert.ok(!(await dialog.innerText()).includes("OR SR"));
    if (country === "RO") {
      await dialog.getByText(c.anafLimitation, { exact: true }).waitFor();
      await dialog.getByText(`${c.taxRegistered}: ${c.yes}`, { exact: true }).waitFor();
    }
    await page.screenshot({ path: `${dir}/${country.toLowerCase()}-preview-desktop.jpg` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${dir}/${country.toLowerCase()}-preview-mobile.jpg` });
    const [save] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith(`${root}/save`) && response.request().method() === "POST"),
      page.getByTestId("button-save-verified-entity").click(),
    ]);
    assert.equal(save.status(), 200);
    await page.getByRole("heading", { name: `${username}-${country}`, exact: true }).waitFor();
    const row = (await pool.query("SELECT * FROM healthcare_legal_entities WHERE country_code=$1 AND ico=$2", [country, ico])).rows[0];
    assert.equal(row.normalized.registrySource, country === "CZ" ? "ARES" : "ANAF");
    // The save response precedes onSuccess invalidation/navigation; do not reload the old preview URL.
    await page.waitForURL(url => url.searchParams.get("id") === row.id);
    await page.reload();
    await page.getByRole("heading", { name: `${username}-${country}`, exact: true }).waitFor();
    const bundle = await context.request.get(`${root}/${row.id}/export`);
    assert.equal(bundle.status(), 200);
    assert.equal((await bundle.json()).source.provider, country === "CZ" ? "ARES" : "ANAF");
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  // Country is explicit in rows and is usable through the native condition builder.
  await page.goto("/hospitals?tab=legal-entities");
  const filterId = "filter-healthcare-legal-entities";
  const search = page.getByTestId(`${filterId}-search`);
  await search.fill(username);
  const rows = page.locator('tbody tr[data-testid^="table-row-"]');
  await rows.filter({ hasText: `${username}-CZ` }).waitFor();
  await rows.filter({ hasText: `${username}-RO` }).waitFor();
  assert.equal(await rows.count(), 2);
  assert.ok((await rows.filter({ hasText: `${username}-CZ` }).innerText()).includes("CZ"));
  assert.ok((await rows.filter({ hasText: `${username}-RO` }).innerText()).includes("RO"));
  const countryCopy = (await page.getByRole("columnheader", { name: copies.en.country, exact: true }).count()) ? copies.en : copies.sk;
  await page.getByRole("columnheader", { name: countryCopy.country, exact: true }).click();
  await page.screenshot({ path: `${dir}/country-column-desktop.jpg` });
  await page.getByTestId(`${filterId}-open-filter`).click();
  await page.getByTestId(`${filterId}-add-rule`).click();
  const nameRule = page.getByTestId(`${filterId}-rule-name`);
  await nameRule.getByRole("combobox").first().click();
  await page.getByRole("option", { name: countryCopy.country, exact: true }).click();
  const countryRule = page.getByTestId(`${filterId}-rule-countryCode`);
  await countryRule.getByRole("combobox").last().click();
  assert.equal(await page.getByRole("option").count(), 3, "all authorized countries, including an empty country, stay selectable");
  await page.getByRole("option", { name: new RegExp(countryCopy.countryCZ) }).click();
  await page.keyboard.press("Escape");
  await rows.filter({ hasText: `${username}-CZ` }).waitFor();
  assert.equal(await rows.count(), 1);
  assert.equal(await rows.filter({ hasText: `${username}-RO` }).count(), 0);
  await page.getByTestId(`${filterId}-chip-remove-countryCode`).click();
  await rows.filter({ hasText: `${username}-RO` }).waitFor();
  await search.fill(countryCopy.countryRO);
  await rows.filter({ hasText: `${username}-RO` }).waitFor();
  assert.equal(await rows.filter({ hasText: `${username}-CZ` }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${dir}/country-column-mobile.jpg` });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/hospitals?tab=hospital");
  await page.getByTestId("filter-hospitals").locator("input").first().fill(username);
  await page.getByTestId(`button-edit-hospital-${hospital}`).click();
  const panel = page.getByTestId("healthcare-legal-entity-panel-hospital");
  await panel.waitFor();
  const base = (await panel.getByText(copies.en.operatorTitle, { exact: true }).count()) ? copies.en : copies.sk;
  const c = withRegistryCopy(base, "RO");
  await panel.getByRole("button", { name: c.verify, exact: true }).click();
  const verifyDialog = page.getByRole("dialog").filter({ has: page.locator(".ler-verify-content") });
  await verifyDialog.getByRole("button", { name: c.verify, exact: true }).click();
  await verifyDialog.getByRole("heading", { name: `${username}-RO`, exact: true }).waitFor();
  await verifyDialog.getByRole("checkbox").first().check();
  const [linked] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith(`${root}/save`) && response.request().method() === "POST"),
    verifyDialog.getByRole("button", { name: c.saveLink, exact: true }).click(),
  ]);
  assert.equal(linked.status(), 200);
  await panel.getByText(c.verifiedLink, { exact: true }).waitFor();
  const stored = (await pool.query("SELECT name,street_number,city,ico FROM hospitals WHERE id=$1", [hospital])).rows[0];
  assert.deepEqual(stored, { name: username, street_number: "Original operational address", city: "Original city", ico: `RO${ico}` });
  assert.deepEqual(errors, []);
  console.log("Registry browser checks passed: country selection, previews, mobile, persistence, export, real hospital link and unchanged operational fields.");
} catch (error) {
  if (testPage) {
    await testPage.screenshot({ path: `${dir}/failure.jpg` }).catch(() => {});
    console.error("Browser check location:", testPage.url());
    console.error("Visible dialogs:", (await testPage.getByRole("dialog").allTextContents()).join("\n").slice(0, 3000));
  }
  throw error;
} finally {
  await browser.close();
  const ids = (await pool.query("SELECT id FROM healthcare_legal_entities WHERE created_by=$1", [user])).rows.map(row => row.id);
  await pool.query("DELETE FROM healthcare_legal_entity_verifications WHERE created_by=$1", [user]);
  for (const table of ["healthcare_legal_entity_audit", "healthcare_legal_entity_facilities", "healthcare_legal_entity_person_links"])
    await pool.query(`DELETE FROM ${table} WHERE legal_entity_id=ANY($1::varchar[])`, [ids]);
  await pool.query(`DELETE FROM healthcare_legal_entity_snapshot_reviews WHERE snapshot_id IN
    (SELECT id FROM healthcare_legal_entity_snapshots WHERE legal_entity_id=ANY($1::varchar[]))`, [ids]);
  await pool.query("DELETE FROM healthcare_legal_entity_snapshots WHERE legal_entity_id=ANY($1::varchar[])", [ids]);
  await pool.query("DELETE FROM healthcare_legal_entities WHERE id=ANY($1::varchar[])", [ids]);
  await pool.query("DELETE FROM hospitals WHERE id=$1", [hospital]);
  await pool.query("DELETE FROM user_sessions WHERE user_id=$1", [user]);
  await pool.query("DELETE FROM users WHERE id=$1", [user]);
  await pool.end();
}
