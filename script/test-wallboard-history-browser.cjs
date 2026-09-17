const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { build } = require("esbuild");
const { chromium } = require("@playwright/test");
const postcss = require("postcss");
const tailwindcss = require("tailwindcss");
const autoprefixer = require("autoprefixer");

const ROOT = process.cwd();
const CHROMIUM = process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";
const BASE_URL = "http://wallboard-history.test/";
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const EMPTY_SETTINGS = { startupGraceSeconds: 0, volume: 0.5, rules: [] };
const rule = (id = "low-online") => ({
  id, name: "Low online", enabled: true, type: "min_online", threshold: 2,
  direction: "both", callEvent: "started", delaySeconds: 0, mode: "visual",
  repeatSeconds: 0,
  schedule: { enabled: false, days: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "17:00" },
});

const ENTRY_KEYS = [
  "acknowledgedAt", "endedAt", "endReason", "incidentId", "lastObservedAt",
  "mutedAt", "mutedUntil", "revision", "startedAt", "threshold", "type",
].sort();

const LOCALE_COUNTRIES = {
  en: [], sk: ["SK"], cs: ["CZ"], hu: ["HU"], ro: ["RO"], it: ["IT"], de: ["DE"],
};
const HISTORY_TITLES = {
  en: "Alarm history",
  sk: "História alarmov",
  cs: "Historie alarmů",
  hu: "Riasztási előzmények",
  ro: "Istoric alerte",
  it: "Cronologia allarmi",
  de: "Alarmverlauf",
};

function makeSnapshot(campaignId, active) {
  const now = Date.now();
  const agents = [
    ["online", "Online Agent", "available", true],
    ["second", "Second Agent", active ? "offline" : "available", !active],
  ];
  return {
    generatedAt: new Date(now - 1_000).toISOString(),
    scope: { campaignId, campaignName: campaignId ? "Mission Atlas" : null },
    campaigns: [{ id: "mission-atlas", name: "Mission Atlas" }],
    agents: agents.map(([id, name, state, connected]) => ({
      id, name, state, connected, direction: null, avatarUrl: null,
      campaignIds: campaignId ? ["mission-atlas"] : [],
      campaignNames: campaignId ? ["Mission Atlas"] : [],
      stateSince: new Date(now - 60_000).toISOString(),
      sessionStartedAt: connected ? new Date(now - 3_600_000).toISOString() : null,
      lastMissionAt: connected ? null : new Date(now - 3_600_000).toISOString(),
      todayMissionSeconds: 0, todayAccruing: connected,
    })),
    inbound: [],
    queue: { waiting: 0, longestWaitSeconds: 0, answeredToday: 0, averageWaitSeconds: 0 },
    callActivity: {
      inbound: { startedAt: new Date(now - 120_000).toISOString(), connectedAt: new Date(now - 110_000).toISOString() },
      outbound: { startedAt: new Date(now - 120_000).toISOString(), connectedAt: new Date(now - 110_000).toISOString() },
    },
    source: { live: true, warning: null },
  };
}

const BUNDLE_SOURCE = `
  import React, { useEffect, useState } from "react";
  import { createRoot } from "react-dom/client";
  import WallboardPage from "./client/src/pages/wallboard.tsx";
  import { I18nProvider } from "./client/src/i18n/I18nProvider.tsx";
  function Harness() {
    const [campaignId, setCampaignId] = useState(null);
    const [countries, setCountries] = useState([]);
    useEffect(() => {
      window.__setWallboardCampaign = setCampaignId;
      window.__setWallboardLocale = locale => setCountries({
        en: [], sk: ["SK"], cs: ["CZ"], hu: ["HU"], ro: ["RO"], it: ["IT"], de: ["DE"],
      }[locale] || []);
      return () => {
        delete window.__setWallboardCampaign;
        delete window.__setWallboardLocale;
      };
    }, []);
    return <I18nProvider userCountries={countries}><WallboardPage campaignId={campaignId} /></I18nProvider>;
  }
  createRoot(document.getElementById("root")).render(<Harness />);
`;

async function makeBundle() {
  const result = await build({
    stdin: { contents: BUNDLE_SOURCE, resolveDir: ROOT, loader: "tsx" },
    bundle: true, write: false, outdir: path.join(ROOT, ".cache/wallboard-history-browser"),
    platform: "browser", format: "iife", jsx: "automatic", target: ["es2020"],
    alias: { "@": path.join(ROOT, "client/src"), "@shared": path.join(ROOT, "shared") },
  });
  const javascript = result.outputFiles.find(file => file.path.endsWith(".js"));
  const stylesheet = result.outputFiles.find(file => file.path.endsWith(".css"));
  assert.ok(javascript && stylesheet, "esbuild did not emit the wallboard bundle");
  const indexCssPath = path.join(ROOT, "client/src/index.css");
  const indexCss = await postcss([
    tailwindcss({ config: path.join(ROOT, "tailwind.config.ts") }),
    autoprefixer(),
  ]).process(fs.readFileSync(indexCssPath, "utf8"), { from: indexCssPath });
  assert.match(indexCss.css, /\.fixed\s*\{/, "Tailwind dialog positioning utilities were not compiled");
  return { javascript: javascript.text, stylesheet: `${indexCss.css}\n${stylesheet.text}` };
}

function htmlFor(bundle) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${bundle.stylesheet}</style></head><body><div id="root"></div><script>${bundle.javascript}</script></body></html>`;
}

function installRoutes(page, bundle) {
  const state = {
    active: true,
    failPost: false,
    failGet: false,
    settingsGets: [],
    historyGets: [],
    historyPosts: [],
    history: new Map([["all", new Map()], ["mission-atlas", new Map()]]),
  };
  page.route("http://wallboard-history.test/**", route => {
    if (new URL(route.request().url()).pathname.startsWith("/api/")) return route.fallback();
    return route.fulfill({ status: 200, contentType: "text/html", body: htmlFor(bundle) });
  });
  page.route(/\/api\/wallboard(?:\?.*)?$/, async route => {
    const url = new URL(route.request().url());
    const campaignId = url.searchParams.get("campaignId");
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(makeSnapshot(campaignId, state.active && !campaignId)),
    });
  });
  page.route(/\/api\/wallboard\/alarms(?:\?.*)?$/, async route => {
    const url = new URL(route.request().url());
    const key = url.searchParams.get("campaignId") || "all";
    state.settingsGets.push(key);
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(key === "all" ? { ...EMPTY_SETTINGS, rules: [rule()] } : EMPTY_SETTINGS),
    });
  });
  page.route(/\/api\/wallboard\/alarm-history(?:\?.*)?$/, async route => {
    const url = new URL(route.request().url());
    const key = url.searchParams.get("campaignId") || "all";
    const days = Number(url.searchParams.get("days") || 7);
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      state.historyPosts.push({ key, body });
      if (state.failPost) {
        await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
        return;
      }
      assert.ok(body && Array.isArray(body.entries), "history POST must contain an entries array");
      const scope = state.history.get(key);
      for (const entry of body.entries) {
        assert.deepEqual(Object.keys(entry).sort(), ENTRY_KEYS, "history entry shape changed");
        const previous = scope.get(entry.incidentId);
        if (!previous || entry.revision > previous.revision) scope.set(entry.incidentId, entry);
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    state.historyGets.push({ key, days });
    if (state.failGet) {
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      return;
    }
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1_000;
    const items = [...state.history.get(key).values()]
      .filter(entry => Date.parse(entry.startedAt) >= cutoff)
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ items, retentionDays: 30, truncated: false }),
    });
  });
  return state;
}

async function waitUntil(predicate, message, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(100);
  }
  throw new Error(message);
}

async function closeDialog(page) {
  await page.keyboard.press("Escape");
  await page.locator('[data-testid="wallboard-alarm-history-dialog"]').waitFor({ state: "hidden" });
}

async function openHistory(page) {
  await page.getByTestId("wallboard-alarm-history-open").click();
  await page.locator('[data-testid="wallboard-alarm-history-dialog"]').waitFor({ state: "visible" });
}

async function testHistory(bundle) {
  const browser = testHistory.browser;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const state = installRoutes(page, bundle);
  await page.goto(BASE_URL);
  await page.locator(".wb-agent").first().waitFor();
  await page.locator(".wb-alarm-incident").first().waitFor();
  await waitUntil(() => state.history.get("all").size === 1, "initial active observation was not persisted");
  await openHistory(page);
  await page.locator('[data-testid="wallboard-alarm-history-item"]').first().waitFor();
  await page.getByText("End not recorded", { exact: true }).waitFor();
  await closeDialog(page);

  // The real hook must emit the complete lifecycle, not a component fixture.
  await page.getByRole("button", { name: "Acknowledge" }).click();
  await page.getByText("Acknowledged", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Mute for 5 minutes" }).click();
  await page.getByText("Muted", { exact: true }).waitFor();
  await waitUntil(
    () => state.historyPosts.some(post => post.body.entries.some(entry => entry.mutedAt)),
    `acknowledge/mute was not posted (history POSTs: ${JSON.stringify(state.historyPosts)})`,
  );
  state.active = false;
  await waitUntil(() => [...state.history.get("all").values()].some(entry => entry.endReason === "recovered"), "recovery was not persisted");
  const recovered = [...state.history.get("all").values()].find(entry => entry.endReason === "recovered");
  assert.ok(recovered && recovered.acknowledgedAt && recovered.mutedAt && recovered.mutedUntil, "persisted recovery lost acknowledge/mute timestamps");

  await openHistory(page);
  await page.locator('[data-testid="wallboard-alarm-history-item"]').first().waitFor();
  assert.ok(state.historyGets.some(request => request.key === "all" && request.days === 7), "history GET did not include the default time range");
  await page.getByText("History is retained for up to 30 days and limited to the latest 1,000 records.", { exact: true }).waitFor();
  assert.equal(await page.locator('[data-testid="wallboard-alarm-history-item"]').count(), 1, "persisted lifecycle is not displayed");
  await page.getByTestId("wallboard-alarm-history-days-1").click();
  await waitUntil(() => state.historyGets.some(request => request.key === "all" && request.days === 1), "one-day history filter was not requested");
  assert.equal(await page.getByTestId("wallboard-alarm-history-days-1").getAttribute("data-active"), "true", "one-day filter did not become active");
  await page.getByTestId("wallboard-alarm-history-days-30").click();
  await waitUntil(() => state.historyGets.some(request => request.key === "all" && request.days === 30), "thirty-day history filter was not requested");

  // A campaign scope has a distinct settings/history stream and must not see all-scope rows.
  await closeDialog(page);
  await page.evaluate(() => window.__setWallboardCampaign("mission-atlas"));
  await page.getByRole("heading", { name: "Mission Atlas" }).waitFor();
  await openHistory(page);
  await page.locator(".wb-history-state").filter({ hasText: "No alarm observations" }).waitFor();
  assert.equal(await page.locator('[data-testid="wallboard-alarm-history-item"]').count(), 0, "all-scope history leaked into campaign scope");
  assert.ok(state.historyGets.some(request => request.key === "mission-atlas"), "campaign history was not scoped");
  assert.ok(state.settingsGets.includes("mission-atlas"), "campaign alarm settings were not scoped");

  // Exercise both empty and failed reads, including the visible retry path.
  state.failGet = true;
  await closeDialog(page);
  await openHistory(page);
  await page.getByRole("alert").filter({ hasText: "Alarm history could not be loaded" }).waitFor();
  state.failGet = false;
  await page.getByRole("alert").filter({ hasText: "Alarm history could not be loaded" }).getByRole("button", { name: "Try again" }).click();
  await page.locator(".wb-history-state").filter({ hasText: "No alarm observations" }).waitFor();

  await closeDialog(page);
  await page.evaluate(() => window.__setWallboardCampaign(null));
  await page.locator(".wb-alarm-incident").count().then(count => assert.equal(count, 0, "campaign switch recreated a campaign alarm"));
  await page.locator(".wb-title").filter({ hasText: "All Missions" }).waitFor().catch(() => undefined);
  await page.getByTestId("wallboard-alarm-history-open").waitFor();

  // A failed write is surfaced while the observer remains open.
  state.failPost = true;
  state.active = true;
  await page.locator(".wb-alarm-incident").first().waitFor();
  await page.getByTestId("wallboard-alarm-history-persistence-warning").waitFor();
  await openHistory(page);
  await page.getByTestId("wallboard-alarm-history-dialog").locator(".wb-history-warning")
    .filter({ hasText: "may not have been saved" }).waitFor();
  state.failPost = false;

  // pagehide closes observation; the persisted row must never be mislabeled recovered.
  state.active = false;
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await waitUntil(() => [...state.history.get("all").values()].some(entry => entry.endReason === "observation_stopped"), "pagehide observation close was not persisted");
  const stopped = [...state.history.get("all").values()].find(entry => entry.endReason === "observation_stopped");
  assert.ok(stopped && stopped.endedAt, "closed observer row has no end timestamp");
  assert.notEqual(stopped.endReason, "recovered", "closed observer was falsely reported as recovered");

  await closeDialog(page);
  await openHistory(page);
  await page.locator('[data-testid="wallboard-alarm-history-item"]').nth(1).waitFor();
  assert.equal(await page.locator('[data-testid="wallboard-alarm-history-item"]').count(), 2, "history did not retain recovered and stopped rows");

  // All seven supported locale labels are rendered by the real translated dialog.
  for (const [locale, country] of Object.entries(LOCALE_COUNTRIES)) {
    await page.evaluate(value => window.__setWallboardLocale(value), locale);
    await page.getByRole("heading", { name: HISTORY_TITLES[locale] }).waitFor();
  }
  await page.evaluate(() => window.__setWallboardLocale("en"));
  await page.getByRole("heading", { name: HISTORY_TITLES.en }).waitFor();

  fs.mkdirSync(path.join(ROOT, "screenshots"), { recursive: true });
  await page.screenshot({ path: path.join(ROOT, "screenshots/wallboard-alarm-history.jpg"), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  // Radix keeps its 200ms open animation class while the viewport is
  // changing. Poll the settled layout rather than sampling that transition.
  await page.waitForFunction(() => {
    const element = document.querySelector('[data-testid="wallboard-alarm-history-dialog"]');
    if (!element) return false;
    const box = element.getBoundingClientRect();
    return box.left >= 0 && box.top >= 0 &&
      box.right <= window.innerWidth && box.bottom <= window.innerHeight;
  }, undefined, { timeout: 2_000 }).catch(() => undefined);
  const mobileBox = await page.locator('[data-testid="wallboard-alarm-history-dialog"]').boundingBox();
  const mobileLayout = await page.locator('[data-testid="wallboard-alarm-history-dialog"]').evaluate(element => {
    const style = getComputedStyle(element);
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      box: element.getBoundingClientRect().toJSON(),
      width: style.width,
      maxWidth: style.maxWidth,
      minWidth: style.minWidth,
      transform: style.transform,
    };
  });
  assert.ok(mobileBox && mobileBox.x >= 0 && mobileBox.y >= 0 &&
    mobileBox.x + mobileBox.width <= 390 && mobileBox.y + mobileBox.height <= 844,
  `history dialog is outside the 390x844 mobile viewport (${JSON.stringify(mobileLayout)})`);
  await page.screenshot({ path: path.join(ROOT, "screenshots/wallboard-alarm-history-mobile.jpg"), fullPage: false });
  await closeDialog(page);
  await page.getByRole("button", { name: "Presentation" }).click();
  await page.locator(".wb-shell.wb-present").waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".wb-shell:not(.wb-present)").waitFor();
  await page.close();
}

(async () => {
  const bundle = await makeBundle();
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM, args: ["--no-sandbox"] });
  testHistory.browser = browser;
  try {
    await testHistory(bundle);
    console.log("Wallboard alarm history browser verification passed: scoped lifecycle persistence, filters, empty/error retry, persistence warning, observer close semantics, seven locales, responsive dialog, and presentation mode.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});