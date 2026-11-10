import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { resolve } from "node:path";
const vite = process.env.DISTRIBUTION_TEST_URL ? null : await createServer({
  configFile: process.env.DISTRIBUTION_CONFIG_PATH || undefined,
  cacheDir: resolve("generated-artifacts/representative-distribution/vite-test-cache"),
  optimizeDeps: { entries: ["test-fixtures/bulk-assignment.html"] },
  logLevel: "error", server: { host: "127.0.0.1", port: 0, hmr: false },
});
if (vite) await vite.listen();
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Bratislava", reducedMotion: "reduce" });
page.setDefaultTimeout(30000);
const errors = [], confirms = [];
page.on("pageerror", e => errors.push(e.message));
const users = [
  { id: "original", name: "Original", isActive: true, eligible: true, countries: ["SK"] },
  { id: "second", name: "Second", isActive: true, eligible: true, countries: ["SK"] },
  { id: "third", name: "Third", isActive: true, eligible: true, countries: ["SK"] },
  { id: "gone", name: "Departed", isActive: false, eligible: false, countries: ["SK"] },
];
const groups = [{ countryCode: "SK", region: "A", count: 2 }, { countryCode: "SK", region: "B", count: 1 }, { countryCode: "SK", region: "", count: 1 }];
let plans = [], lastPreview = "", slow = false, ends = 0, suggestionDelay = false, aiFailure = false, expectedCountries = ["SK"];
const previews = [], loads = [];
await page.route("**/contexts/country-filter-context.tsx*", route => route.fulfill({
  contentType: "application/javascript", body: 'export function useCountryFilter(){return {selectedCountries:window.__testCountries||["SK"]}};export function CountryFilterProvider({children}){return children}',
}));
await page.route("**/api/**", async route => {
  const req = route.request(), path = new URL(req.url()).pathname;
  let data = [];
  if (path.endsWith("/distribution/users")) data = users;
  else if (path === "/api/representatives") data = users.filter(u => u.isActive).map(u => ({ ...u, clinicCount: 4 }));
  else if (path.endsWith("/distribution/suggestions")) {
    const body = req.postDataJSON();
    assert.equal(body.countryCode, "SK");
    if (suggestionDelay) await new Promise(resolve => setTimeout(resolve, 500));
    if (aiFailure) return route.fulfill({ status: 503, json: { code: "ai_unavailable" } });
    data = { countryCode: "SK", mode: body.mode, source: body.mode === "balanced" ? "ai" : "catalogue",
      catalogue: [{ name: "Bratislavský kraj", values: ["Bratislavský kraj", "bratislavsky kraj"], count: 2 },
        { name: "Trnavský kraj", values: ["Trnavský kraj"], count: 1 }],
      unmapped: [{ name: "Legacy territory", values: ["Legacy territory"], count: 1 }], unknownCount: 1, total: 5,
      groups: body.mode === "balanced" ? [{ index: 0, regions: ["Bratislavský kraj"], count: 2 },
        { index: 1, regions: ["Trnavský kraj"], count: 1 }] : [] };
  } else if (path.endsWith("/distribution/regions")) {
    loads.push(req.postDataJSON());
    if (slow) await new Promise(resolve => setTimeout(resolve, 500));
    data = { groups, total: 4 };
  } else if (path.endsWith("/distribution/plans") && req.method() === "POST") {
    const body = req.postDataJSON();
    assert.deepEqual(body.criteria.countryScope, expectedCountries);
    const affected = body.regions.reduce((count, r) => count + groups.find(g => g.region === r.region).count, 0);
    if (body.dryRun) { previews.push(body); lastPreview = JSON.stringify(body); data = { affected, unchanged: 4 - affected, fingerprint: lastPreview, groups }; }
    else {
      assert.equal(body.fingerprint, lastPreview);
      confirms.push(body);
      plans = [{ id: "plan-" + confirms.length, kind: body.kind, sourceName: body.fromUserId || null,
        startsAt: new Date().toISOString(), endsAt: body.endsAt || null,
        pending: 0, active: body.kind === "temporary" ? affected : 0, completed: body.kind === "temporary" ? 0 : affected, skipped: 0, conflict: 0 }, ...plans];
      data = { affected, planId: plans[0].id };
    }
  } else if (/\/distribution\/plans\/[^/]+\/end$/.test(path)) {
    ends++; plans = plans.map(p => ({ ...p, completed: p.completed + p.active, active: 0, pending: 0 })); data = { ok: true };
  } else if (path.endsWith("/distribution/plans")) data = plans;
  await route.fulfill({ json: data });
});
const choose = async (testId, name) => {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: new RegExp("^" + name) }).click();
};
const kind = async index => { await page.getByTestId("distribution-kind").click(); await page.getByRole("option").nth(index).click(); };
const preview = () => page.getByTestId("distribution-preview-button").click();
const confirm = async () => {
  const portfolio = await page.getByTestId("distribution-portfolio-total").count() > 0;
  await page.getByTestId("distribution-confirm").click();
  await page.waitForFunction(testId => !document.querySelector(`[data-testid="${testId}"]`),
    portfolio ? "distribution-portfolio-total" : "distribution-region-0");
};
const settle = () => page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); });
const out = "generated-artifacts/representative-distribution";
try {
  await mkdir(out, { recursive: true });
  await page.goto((process.env.DISTRIBUTION_TEST_URL || `http://127.0.0.1:${vite.httpServer.address().port}`) + "/test-fixtures/bulk-assignment.html", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByTestId("bulk-mode-regional").click();
  await page.getByTestId("distribution-load").click();
  await choose("distribution-target-0", "Second"); await choose("distribution-target-1", "Third");
  await preview(); await page.getByTestId("distribution-preview").waitFor();
  assert.equal(await page.getByTestId("distribution-confirm").isEnabled(), true);
  await choose("distribution-target-0", "Third");
  assert.equal(await page.getByTestId("distribution-confirm").isDisabled(), true);
  await choose("distribution-target-0", "Second"); await preview();
  await settle(); await page.screenshot({ path: out + "/regional.png" });
  await confirm();
  assert.equal(confirms[0].regions.length, 2);
  assert.notEqual(confirms[0].regions[0].userId, confirms[0].regions[1].userId);
  assert(!confirms[0].regions.some(r => r.region === ""));
  await kind(1); await choose("distribution-source", "Departed"); await page.getByTestId("distribution-load").click();
  await choose("distribution-target-0", "Second"); await preview(); await confirm();
  assert.equal(confirms[1].kind, "departure"); assert.equal(confirms[1].fromUserId, "gone");
  await kind(2); await choose("distribution-source", "Original");
  await page.getByTestId("distribution-end").click();
  await page.locator('[role="gridcell"]:not([disabled]):not([aria-disabled="true"])').last().click();
  await page.keyboard.press("Escape");
  await page.getByTestId("distribution-load").click();
  await choose("distribution-target-0", "Second"); await preview(); await confirm();
  assert.equal(confirms[2].kind, "temporary"); assert(confirms[2].endsAt.endsWith("Z"));
  await page.getByTestId("distribution-end-plan").first().click();
  await page.getByRole("alertdialog").getByRole("button").last().click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="distribution-end-plan"]'));
  assert.equal(ends, 1);
  await page.evaluate(() => document.documentElement.classList.add("dark")); await settle();
  await page.screenshot({ path: out + "/cover-dark.png" });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.setViewportSize({ width: 390, height: 844 }); await settle();
  await page.getByTestId("representative-distribution").scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + "/mobile.png" });
  const bounds = await page.getByTestId("representative-distribution").boundingBox();
  assert(bounds.x >= 0 && bounds.x + bounds.width <= 391);
  await page.setViewportSize({ width: 1440, height: 1000 });
  slow = true;
  const response = page.waitForResponse(r => r.url().endsWith("/distribution/regions"));
  await page.getByTestId("distribution-load").click();
  await page.getByTestId("filter-bulk-clinic-search").fill("changed-during-load");
  await response;
  await page.waitForFunction(() => !document.querySelector('[data-testid="distribution-load"]').disabled);
  assert.equal(await page.getByTestId("distribution-region-0").count(), 0, "Late region results must not reinstall a stale selection");
  assert.equal(await page.getByTestId("distribution-confirm").isDisabled(), true);
  slow = false;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("suggestion-load").click();
  await page.getByTestId("suggestion-region-0").click();
  await page.getByTestId("suggestion-apply").click();
  await page.getByTestId("filter-bulk-clinic-chip-region").waitFor();
  assert((await page.getByTestId("filter-bulk-clinic-chip-region").innerText()).includes("Bratislavský kraj"));
  await page.getByTestId("suggestion-mode").click(); await page.getByRole("option").nth(1).click();
  await page.getByTestId("suggestion-load").click();
  await page.getByTestId("suggestion-group-0").getByRole("button").click();
  assert.equal(await page.getByTestId("suggestion-region-0").getAttribute("data-state"), "checked");
  // An already loaded proposal is invalid as soon as mode or territory count changes.
  await page.getByTestId("suggestion-territories").click(); await page.getByRole("option", { name: "2", exact: true }).click();
  assert.equal(await page.getByTestId("suggestion-apply").count(), 0);
  await page.getByTestId("suggestion-load").click();
  await page.getByTestId("suggestion-group-1").getByRole("button").click();
  await page.getByTestId("suggestion-apply").click();
  aiFailure = true;
  await page.getByTestId("suggestion-load").click();
  await page.getByTestId("representative-region-suggestions").getByRole("alert").waitFor();
  aiFailure = false;
  suggestionDelay = true;
  const lateSuggestion = page.waitForResponse(r => r.url().endsWith("/distribution/suggestions"));
  await page.getByTestId("suggestion-load").click();
  await page.getByTestId("suggestion-mode").click(); await page.getByRole("option").nth(0).click();
  await lateSuggestion;
  assert.equal(await page.getByTestId("suggestion-region-0").count(), 0);
  suggestionDelay = false;
  await page.getByTestId("filter-bulk-clinic-search").fill("matching");
  await page.getByTestId("bulk-temporary-cover").click();
  const cover = async (target, entity) => {
    await choose("distribution-source", "Original"); await choose("distribution-single-target", target);
    await page.getByTestId("distribution-end").click();
    await page.locator('[role="gridcell"]:not([disabled]):not([aria-disabled="true"])').last().click();
    await page.keyboard.press("Escape");
    await page.getByTestId("distribution-load").click();
    await page.getByTestId("distribution-portfolio-total").waitFor();
    assert.equal(await page.getByTestId("distribution-region-0").count(), 0);
    await preview(); await page.getByTestId("distribution-preview").waitFor();
    const body = previews.at(-1);
    assert.equal(body.entity, entity); assert.equal(body.kind, "temporary");
    assert.equal(body.regions.length, 3); assert(body.regions.every(r => r.userId === target.toLowerCase()));
    assert(body.endsAt.endsWith("Z"));
  };
  await cover("Second", "clinic");
  assert.equal(previews.at(-1).criteria.search, "matching");
  assert(previews.at(-1).criteria.filterRules.some(r => r.field === "region" && r.op === "isAny"));
  await page.getByTestId("distribution-whole-portfolio").click();
  assert.equal(await page.getByTestId("distribution-confirm").isDisabled(), true);
  await page.getByTestId("distribution-load").click();
  await page.getByTestId("distribution-portfolio-total").waitFor();
  assert.deepEqual(loads.at(-1).criteria, { countryScope: ["SK"] });
  await preview(); await page.getByTestId("distribution-preview").waitFor();
  await settle(); await page.screenshot({ path: out + "/bulk-temporary.png" });
  await confirm();
  assert.deepEqual(confirms.at(-1).criteria, { countryScope: ["SK"] });
  await page.getByRole("button", { name: "Swap Representative", exact: true }).click();
  await page.getByRole("button", { name: "Hospital", exact: true }).click();
  await cover("Third", "hospital");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("representative-distribution").scrollIntoViewIfNeeded();
  await settle(); await page.screenshot({ path: out + "/hospital-temporary-mobile.png" });
  const coverBounds = await page.getByTestId("representative-distribution").boundingBox();
  assert(coverBounds.x >= 0 && coverBounds.x + coverBounds.width <= 391);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await confirm();
  assert.equal(confirms.at(-1).entity, "hospital");
  expectedCountries = ["SK", "CZ"];
  await page.evaluate(() => { window.__testCountries = ["SK", "CZ"]; });
  await page.getByTestId("filter-bulk-hospital-search").fill("only-sk");
  await choose("distribution-single-target", "Second");
  await page.getByTestId("distribution-load").click();
  await page.getByTestId("distribution-portfolio-total").waitFor();
  await preview(); await page.getByTestId("distribution-preview").waitFor();
  assert.deepEqual(previews.at(-1).criteria.countryScope, ["SK", "CZ"]);
  assert.equal(await page.getByTestId("distribution-confirm").isEnabled(), true,
    "Target eligibility must use actual selected record countries, not the wider global scope");
  assert.deepEqual(errors, []);
  console.log("PASS: regional regression; official/AI filter application, proposal staleness and AI failure; filtered/whole single-target cover in Bulk and Swap, clinics/hospitals, dark/mobile");
} catch (error) {
  await page.screenshot({ path: out + "/failure.png" }); console.error(errors, (await page.locator("body").innerText()).slice(-1600)); throw error;
} finally { await browser.close(); if (vite) await vite.close(); }
