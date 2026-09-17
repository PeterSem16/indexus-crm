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
const BASE_URL = "http://wallboard-alarms.test/";
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const EMPTY_SETTINGS = { startupGraceSeconds: 0, volume: 0.5, rules: [] };
const rule = (id, name, type = "min_online", threshold = 2, mode = "visual") => ({
  id, name, enabled: true, type, threshold, direction: "both", callEvent: "started",
  delaySeconds: 0, mode, repeatSeconds: 0,
  schedule: { enabled: false, days: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "17:00" },
});

const AGENTS = [
  ["online", "Online Agent", "available", true],
  ["offline", "Offline Agent", "offline", false],
];

function makeSnapshot(campaignId = null) {
  const now = Date.now();
  return {
    generatedAt: new Date(now - 1_000).toISOString(),
    scope: { campaignId, campaignName: campaignId ? "Mission Atlas" : null },
    campaigns: [{ id: "mission-atlas", name: "Mission Atlas" }],
    agents: AGENTS.map(([id, name, state, connected]) => ({
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
    useEffect(() => { window.__setWallboardCampaign = setCampaignId; return () => delete window.__setWallboardCampaign; }, []);
    return <I18nProvider userCountries={[]}><WallboardPage campaignId={campaignId} /></I18nProvider>;
  }
  createRoot(document.getElementById("root")).render(<Harness />);
`;

async function makeBundle() {
  const result = await build({
    stdin: { contents: BUNDLE_SOURCE, resolveDir: ROOT, loader: "tsx" },
    bundle: true, write: false, outdir: path.join(ROOT, ".cache/wallboard-alarm-browser"),
    platform: "browser", format: "iife", jsx: "automatic", target: ["es2020"],
    alias: { "@": path.join(ROOT, "client/src"), "@shared": path.join(ROOT, "shared") },
  });
  const javascript = result.outputFiles.find(file => file.path.endsWith(".js"));
  const stylesheet = result.outputFiles.find(file => file.path.endsWith(".css"));
  assert.ok(javascript && stylesheet, "esbuild did not emit the wallboard bundle");
  // Radix Dialog positioning/scrolling utilities come from the application's
  // real Tailwind entrypoint, not WallboardAlarms.css. Compile that entrypoint
  // with the checked-in PostCSS/Tailwind config for faithful screenshots.
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
    settings: new Map([["all", { ...EMPTY_SETTINGS }]]),
    settingsGets: [],
    settingsPuts: [],
    failPut: false,
  };
  page.route("http://wallboard-alarms.test/**", route => {
    if (new URL(route.request().url()).pathname.startsWith("/api/")) return route.fallback();
    return route.fulfill({ status: 200, contentType: "text/html", body: htmlFor(bundle) });
  });
  // Snapshot and settings are intentionally separate routes.  The settings
  // route is registered last because Playwright checks newest matching routes
  // first; a broad snapshot matcher must never consume a settings request.
  page.route("**/api/wallboard**", async route => {
    const url = new URL(route.request().url());
    const campaignId = url.searchParams.get("campaignId");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(makeSnapshot(campaignId)) });
  });
  page.route("**/api/wallboard/alarms**", async route => {
    const url = new URL(route.request().url());
    const key = url.searchParams.get("campaignId") || "all";
    if (route.request().method() === "PUT") {
      state.settingsPuts.push({ key, body: route.request().postDataJSON() });
      if (state.failPut) {
        await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
        return;
      }
      state.settings.set(key, route.request().postDataJSON());
    } else {
      state.settingsGets.push(key);
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(state.settings.get(key) || EMPTY_SETTINGS),
    });
  });
  return state;
}

async function openSettings(page) {
  await page.getByRole("button", { name: "Alarms" }).click();
  await page.locator(".wb-alarm-dialog").waitFor({ state: "visible" });
}

async function testSettingsLifecycle(bundle) {
  const browser = testSettingsLifecycle.browser;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const state = installRoutes(page, bundle);
  await page.goto(BASE_URL);
  await page.locator(".wb-agent").first().waitFor();
  await openSettings(page);
  const dialog = page.locator(".wb-alarm-dialog");
  await dialog.getByRole("button", { name: "Add rule" }).click();
  await dialog.getByLabel("Name").fill("Low online");
  await dialog.locator(".wb-alarm-rule").nth(0).locator("select").nth(0).selectOption("min_online");
  await dialog.getByLabel("Threshold").fill("2");
  await dialog.getByRole("button", { name: "Add rule" }).click();
  await dialog.locator('input[required]').nth(1).fill("No calls");
  await dialog.locator(".wb-alarm-rule").nth(1).locator("select").nth(0).selectOption("no_calls");
  await dialog.getByRole("button", { name: "Add rule" }).click();
  await dialog.locator('input[required]').nth(2).fill("Long break");
  await dialog.locator(".wb-alarm-rule").nth(2).locator("select").nth(0).selectOption("long_break");
  for (let index = 3; index < 8; index++) {
    await dialog.getByRole("button", { name: "Add rule" }).click();
    await dialog.locator('input[required]').nth(index).fill(`Additional rule ${index + 1}`);
  }
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(state.settingsPuts.length, 1, "settings PUT was not persisted");
  assert.equal(state.settingsPuts[0].body.rules.length, 8, "multiple rules were not saved");

  await page.reload();
  await page.locator(".wb-agent").first().waitFor();
  await openSettings(page);
  const rules = page.locator(".wb-alarm-rule");
  assert.equal(await rules.count(), 8, "saved rules did not reload");
  const threshold = (index) => rules.nth(index).locator("label").filter({ hasText: /^Threshold/ });
  const dialogBox = await page.locator(".wb-alarm-dialog").boundingBox();
  assert.ok(dialogBox, "alarm editor has no layout box");
  assert.ok(dialogBox.x >= 0 && dialogBox.y >= 0 &&
    dialogBox.x + dialogBox.width <= 1280 &&
    dialogBox.y + dialogBox.height <= 720,
  "alarm editor is outside the 1280x720 viewport");
  const scroll = page.locator(".wb-alarm-settings-scroll");
  const scrollMetrics = await scroll.evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  assert.ok(scrollMetrics.scrollHeight > scrollMetrics.clientHeight,
    `populated alarm editor does not provide an internal scroller (${JSON.stringify(scrollMetrics)})`);
  assert.match(scrollMetrics.overflowY, /auto|scroll/, "alarm editor content is not scrollable");
  const saveBox = await page.getByRole("button", { name: "Save changes" }).boundingBox();
  assert.ok(saveBox && saveBox.y >= 0 && saveBox.y + saveBox.height <= 720,
    "alarm editor Save footer is offscreen");
  await page.screenshot({ path: "/tmp/wallboard-alarm-settings.png", fullPage: false });

  // max_break is an agent-count rule: its threshold is the literal count 2,
  // with no seconds/minutes control.  The other two rules are durations and
  // their threshold unit control (not the sustained-delay control) converts
  // two minutes to the canonical 120 seconds sent to the API.
  await rules.nth(0).locator("select").nth(0).selectOption("max_break");
  assert.equal(await threshold(0).locator("select").count(), 0, "max_break incorrectly exposes a duration threshold unit");
  await threshold(0).locator('input[type="number"]').fill("2");

  await rules.nth(1).locator("select").nth(0).selectOption("no_calls");
  assert.equal(await threshold(1).locator("select").count(), 1, "no_calls is missing its threshold unit control");
  await threshold(1).locator("select").selectOption("minutes");
  await threshold(1).locator('input[type="number"]').fill("2");

  await rules.nth(2).locator("select").nth(0).selectOption("long_break");
  assert.equal(await threshold(2).locator("select").count(), 1, "long_break is missing its threshold unit control");
  await threshold(2).locator("select").selectOption("minutes");
  await threshold(2).locator('input[type="number"]').fill("2");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.locator(".wb-alarm-dialog").waitFor({ state: "hidden" });
  const canonicalRules = state.settingsPuts.at(-1).body.rules;
  assert.deepEqual(canonicalRules.slice(0, 3).map(({ type, threshold: value }) => ({ type, threshold: value })), [
    { type: "max_break", threshold: 2 },
    { type: "no_calls", threshold: 120 },
    { type: "long_break", threshold: 120 },
  ], "threshold units were not converted to their canonical seconds/count values");
  await openSettings(page);
  page.once("dialog", dialog => dialog.accept());
  await page.locator(".wb-alarm-rule").last().getByRole("button", { name: "Delete" }).click();
  await page.locator(".wb-alarm-rule").first().getByLabel("Name").fill("Low online edited");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.locator(".wb-alarm-dialog").waitFor({ state: "hidden" });
  assert.equal(state.settingsPuts.at(-1).body.rules.length, 7, "rule deletion was not persisted");
  assert.equal(state.settingsPuts.at(-1).body.rules[0].name, "Low online edited", "rule edit was not persisted");

  await page.evaluate(() => window.__setWallboardCampaign("mission-atlas"));
  await page.getByRole("heading", { name: "Mission Atlas" }).waitFor();
  await openSettings(page);
  assert.equal(await page.locator(".wb-alarm-rule").count(), 0, "all-scope settings leaked into campaign scope");
  await page.getByRole("button", { name: "Cancel" }).click();
  assert.ok(state.settingsGets.includes("all") && state.settingsGets.includes("mission-atlas"), "settings requests were not scoped");

  // Keep a real portrait check as well; a desktop-only dialog can otherwise
  // pass while its footer is unreachable on a wallboard control handset.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.__setWallboardCampaign(null));
  await page.locator(".wb-agent").first().waitFor();
  await openSettings(page);
  const portraitBox = await page.locator(".wb-alarm-dialog").boundingBox();
  assert.ok(portraitBox && portraitBox.x >= 0 && portraitBox.y >= 0 &&
    portraitBox.x + portraitBox.width <= 390 &&
    portraitBox.y + portraitBox.height <= 844,
  "alarm editor is outside the 390x844 portrait viewport");
  const portraitSave = await page.getByRole("button", { name: "Save changes" }).boundingBox();
  assert.ok(portraitSave && portraitSave.y + portraitSave.height <= 844,
    "portrait alarm editor Save footer is offscreen");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.close();
}

async function testDraftRetentionAndAlerts(bundle) {
  const browser = testDraftRetentionAndAlerts.browser;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const state = installRoutes(page, bundle);
  state.settings.set("all", {
    startupGraceSeconds: 0, volume: 0.5,
    rules: [
      rule("low", "Low online", "min_online", 2),
      rule("calls", "No calls", "no_calls", 60),
    ],
  });
  await page.goto(BASE_URL);
  await page.locator(".wb-agent").first().waitFor();
  await page.locator(".wb-alarm-incident").first().waitFor();
  assert.equal(await page.locator(".wb-alarm-incident").count(), 2, "low-online and no-calls alerts were not shown");
  await page.getByRole("button", { name: "Presentation" }).click();
  await page.locator(".wb-shell.wb-present").waitFor();
  assert.ok(await page.locator(".wb-alarm-panel").isVisible(), "active alarm panel disappeared in presentation mode");
  await page.screenshot({ path: "/tmp/wallboard-alarm-active.png", fullPage: false });
  await page.keyboard.press("Escape");
  await page.locator(".wb-shell:not(.wb-present)").waitFor();

  await page.getByRole("button", { name: "Acknowledge" }).first().click();
  await page.getByText("Acknowledged", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Mute for 5 minutes" }).last().click();
  await page.getByText("Muted", { exact: true }).waitFor();

  state.failPut = true;
  await openSettings(page);
  const draft = page.locator(".wb-alarm-rule").first().getByLabel("Name");
  await draft.fill("Draft retained after failure");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("alert").filter({ hasText: "could not be saved" }).waitFor();
  assert.equal(await draft.inputValue(), "Draft retained after failure", "save errors discarded the draft");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.close();
}

async function testAudioAndPresentation(bundle) {
  const browser = testAudioAndPresentation.browser;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const state = installRoutes(page, bundle);
  state.settings.set("all", { startupGraceSeconds: 0, volume: 0.5, rules: [rule("visual", "Visual", "min_online", 2, "visual")] });
  await page.addInitScript(() => {
    class TestAudioContext {
      static created = 0;
      state = "suspended";
      currentTime = 0;
      destination = {};
      constructor() { window.__audioCreated = (window.__audioCreated || 0) + 1; }
      resume() { this.state = "running"; return Promise.resolve(); }
      suspend() { this.state = "suspended"; return Promise.resolve(); }
      close() { return Promise.resolve(); }
      createGain() { window.__audioGains = (window.__audioGains || 0) + 1; return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
      createOscillator() { window.__audioOscillators = (window.__audioOscillators || 0) + 1; return { frequency: { setValueAtTime() {} }, connect() {}, disconnect() {}, start() {}, stop() {} }; }
    }
    window.AudioContext = TestAudioContext;
  });
  await page.goto(BASE_URL);
  await page.locator(".wb-agent").first().waitFor();
  await page.locator(".wb-alarm-incident").first().waitFor();
  assert.equal(await page.evaluate(() => window.__audioOscillators || 0), 0, "visual alarms played sound before opt-in");
  await page.getByRole("button", { name: "Presentation" }).click();
  await page.locator(".wb-shell.wb-present").waitFor();
  await page.locator(".wb-alarm-dialog").count().then(count => assert.equal(count, 0, "settings dialog unexpectedly opened in presentation"));
  await page.keyboard.press("Escape");
  await page.locator(".wb-shell:not(.wb-present)").waitFor();

  await page.getByRole("button", { name: "Enable sound" }).click();
  await page.getByRole("button", { name: "Test sound" }).click();
  await page.waitForFunction(() => (window.__audioOscillators || 0) > 0);
  await page.close();
}

(async () => {
  const bundle = await makeBundle();
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM, args: ["--no-sandbox"] });
  testSettingsLifecycle.browser = browser;
  testDraftRetentionAndAlerts.browser = browser;
  testAudioAndPresentation.browser = browser;
  try {
    await testDraftRetentionAndAlerts(bundle);
    await testAudioAndPresentation(bundle);
    await testSettingsLifecycle(bundle);
    console.log("Wallboard alarm browser verification passed: scoped persistence/reload, units, draft retention, active alert acknowledgement/mute, visual silence, opt-in test sound, and presentation.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});