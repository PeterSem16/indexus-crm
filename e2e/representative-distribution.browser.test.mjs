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
let plans = [], lastPreview = "", slow = false, ends = 0;
await page.route("**/contexts/country-filter-context.tsx*", route => route.fulfill({
  contentType: "application/javascript", body: 'export function useCountryFilter(){return {selectedCountries:["SK"]}};export function CountryFilterProvider({children}){return children}',
}));
await page.route("**/api/**", async route => {
  const req = route.request(), path = new URL(req.url()).pathname;
  let data = [];
  if (path.endsWith("/distribution/users")) data = users;
  else if (path === "/api/representatives") data = users.filter(u => u.isActive).map(u => ({ ...u, clinicCount: 4 }));
  else if (path.endsWith("/distribution/regions")) {
    if (slow) await new Promise(resolve => setTimeout(resolve, 500));
    data = { groups, total: 4 };
  } else if (path.endsWith("/distribution/plans") && req.method() === "POST") {
    const body = req.postDataJSON();
    assert.deepEqual(body.criteria.countryScope, ["SK"]);
    const affected = body.regions.reduce((count, r) => count + groups.find(g => g.region === r.region).count, 0);
    if (body.dryRun) { lastPreview = JSON.stringify(body); data = { affected, unchanged: 4 - affected, fingerprint: lastPreview, groups }; }
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
  await page.getByTestId("distribution-confirm").click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="distribution-region-0"]'));
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
  assert.deepEqual(errors, []);
  console.log("PASS: regional targets, full preview binding, inactive source, dated temporary cover/end, stale response, dark and mobile UI");
} catch (error) {
  await page.screenshot({ path: out + "/failure.png" }); console.error(errors, (await page.locator("body").innerText()).slice(-1600)); throw error;
} finally { await browser.close(); if (vite) await vite.close(); }
