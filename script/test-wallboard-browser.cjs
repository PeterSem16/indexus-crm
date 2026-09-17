const path = require("node:path");
const assert = require("node:assert/strict");
const { build } = require("esbuild");
const { chromium } = require("@playwright/test");

const ROOT = process.cwd();
const CHROMIUM = process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";
const BASE_URL = "http://wallboard.test/";
const ALL_SCREENSHOT = "/tmp/wallboard-production-all.png";
const MISSION_SCREENSHOT = "/tmp/wallboard-production-mission.png";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const AGENTS = [
  ["AG-001", "Mira Novak", "ringing", "inbound", true],
  ["AG-002", "Jon Bell", "available", null, true],
  ["AG-003", "Priya Shah", "working", "outbound", true],
  ["AG-004", "Owen Reed", "break", null, true],
  ["AG-005", "Lina Costa", "offline", null, false],
  ["AG-006", "Noah Kim", "calling", "outbound", true],
];

function makeSnapshot(scopeId = null, phase = 0, source = { live: true, warning: null }, agentLimit = null) {
  const scoped = scopeId ? AGENTS.slice(0, 4) : AGENTS.slice(0, agentLimit || AGENTS.length);
  return {
    generatedAt: new Date(Date.now() - 1_500).toISOString(),
    scope: {
      campaignId: scopeId,
      campaignName: scopeId ? "Mission Atlas" : null,
    },
    campaigns: [
      { id: "mission-atlas", name: "Mission Atlas" },
      { id: "mission-borealis", name: "Mission Borealis" },
    ],
    agents: scoped.map(([id, name, initialState, direction, connected], index) => ({
      id,
      name,
      campaignIds: scopeId ? ["mission-atlas"] : index % 2 ? ["mission-borealis"] : ["mission-atlas"],
      campaignNames: scopeId ? ["Mission Atlas"] : index % 2 ? ["Mission Borealis"] : ["Mission Atlas"],
      state: phase > 0 && index === 0 ? "calling" : phase > 0 && index === 2 ? "working" : initialState,
      stateSince: new Date(Date.now() - (phase > 0 && index === 0 ? 12 : 47) * 1000).toISOString(),
      direction,
      connected,
    })),
    inbound: [
      {
        id: "call-001",
        campaignId: "mission-atlas",
        queueName: "Atlas priority queue",
        agentName: "Mira Novak",
        status: phase > 0 ? "talking" : "ringing",
        since: new Date(Date.now() - 23_000).toISOString(),
        callerLabel: "Caller · 204",
      },
    ],
    queue: {
      waiting: phase > 0 ? 2 : 3,
      longestWaitSeconds: phase > 0 ? 31 : 24,
      answeredToday: 126,
      averageWaitSeconds: 18,
    },
    source,
  };
}

const BUNDLE_SOURCE = `
  import React, { useEffect, useState } from "react";
  import { createRoot } from "react-dom/client";
  import WallboardPage from "./client/src/pages/wallboard.tsx";
  import { I18nProvider } from "./client/src/i18n/I18nProvider.tsx";

  function Harness() {
    const [campaignId, setCampaignId] = useState(null);
    useEffect(() => {
      window.__setWallboardCampaign = setCampaignId;
      return () => { delete window.__setWallboardCampaign; };
    }, []);
    return (
      <I18nProvider userCountries={[]}>
        <WallboardPage campaignId={campaignId} />
      </I18nProvider>
    );
  }

  createRoot(document.getElementById("root")).render(<Harness />);
`;

async function makeBundle() {
  const result = await build({
    stdin: { contents: BUNDLE_SOURCE, resolveDir: ROOT, loader: "tsx" },
    bundle: true,
    write: false,
    outdir: path.join(ROOT, ".cache/wallboard-browser"),
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    target: ["es2020"],
    alias: {
      "@": path.join(ROOT, "client/src"),
      "@shared": path.join(ROOT, "shared"),
    },
  });
  const javascript = result.outputFiles.find((file) => file.path.endsWith(".js"));
  const stylesheet = result.outputFiles.find((file) => file.path.endsWith(".css"));
  assert.ok(javascript, "esbuild did not emit the wallboard JavaScript bundle");
  assert.ok(stylesheet, "esbuild did not emit the real wallboard stylesheet");
  return { javascript: javascript.text, stylesheet: stylesheet.text };
}

function htmlFor(bundle) {
  return `<!doctype html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>${bundle.stylesheet}</style></head>
    <body><div id="root"></div><script>${bundle.javascript}</script></body></html>`;
}

async function installHtmlRoute(page, bundle) {
  await page.route("http://wallboard.test/**", (route) => {
    if (new URL(route.request().url()).pathname.startsWith("/api/")) return route.fallback();
    return route.fulfill({ status: 200, contentType: "text/html", body: htmlFor(bundle) });
  });
}

function installApiRoute(page, options = {}) {
  const state = {
    requests: 0,
    authStatus: null,
    errorStatus: options.errorStatus || null,
    empty: Boolean(options.empty),
    sourceWarning: Boolean(options.sourceWarning),
    raceDelay: options.raceDelay || 0,
    agentCount: options.agentCount || null,
  };
  const routeHandler = async (route) => {
    const requestUrl = new URL(route.request().url());
    const campaignId = requestUrl.searchParams.get("campaignId");
    state.requests += 1;

    if (state.raceDelay && !campaignId) await sleep(state.raceDelay);
    if (state.authStatus) {
      await route.fulfill({ status: state.authStatus, contentType: "application/json", body: "{}" });
      return;
    }
    if (state.errorStatus) {
      await route.fulfill({ status: state.errorStatus, contentType: "application/json", body: "{}" });
      return;
    }
    if (state.empty) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...makeSnapshot(), campaigns: [], agents: [], scope: { campaignId: null, campaignName: null } }),
      });
      return;
    }
    const phase = campaignId ? 0 : state.requests > 1 ? 1 : 0;
    const source = state.sourceWarning
      ? { live: false, warning: "Synthetic source warning" }
      : { live: true, warning: null };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeSnapshot(campaignId ? "mission-atlas" : null, phase, source, state.agentCount)),
    });
  };
  page.route("**/api/wallboard**", routeHandler);
  return state;
}

async function assertNoScrollAndCardsVisible(page, expectedCount) {
  const metrics = await page.evaluate(() => ({
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    bodyHeight: document.body.scrollHeight,
    documentHeight: document.documentElement.scrollHeight,
    cards: [...document.querySelectorAll(".wb-agent")].map((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
    }),
  }));
  assert.ok(metrics.bodyHeight <= metrics.innerHeight, `body scrolls at ${metrics.innerWidth}x${metrics.innerHeight}`);
  assert.ok(metrics.documentHeight <= metrics.innerHeight, `document scrolls at ${metrics.innerWidth}x${metrics.innerHeight}`);
  assert.equal(metrics.cards.length, expectedCount, "main agent-card count");
  for (const card of metrics.cards) {
    assert.ok(card.top >= 0 && card.bottom <= metrics.innerHeight, "agent card is outside the viewport");
    assert.ok(card.left >= 0 && card.right <= metrics.innerWidth, "agent card is outside the viewport width");
  }
}

async function waitForCards(page, expectedCount) {
  await page.locator(".wb-agent").first().waitFor({ state: "visible" });
  await page.waitForFunction((count) => document.querySelectorAll(".wb-agent").length === count, expectedCount);
}

async function testProductionViewport(bundle, width, height, expectedCount) {
  const browser = testProductionViewport.browser;
  const page = await browser.newPage({ viewport: { width, height } });
  const api = installApiRoute(page, { agentCount: expectedCount });
  await installHtmlRoute(page, bundle);
  await page.goto(BASE_URL);
  await waitForCards(page, expectedCount);
  assert.equal(await page.locator(".wb-agent").count(), expectedCount);

  // The real two-second poll changes ringing to calling and refreshes working state.
  await page.getByText("RINGING", { exact: true }).first().waitFor();
  await page.waitForFunction(
    () => document.querySelector(".wb-agent .wb-status")?.textContent === "CALLING",
    null,
    { timeout: 5_000 },
  );
  assert.ok(api.requests >= 2, "wallboard did not poll after its initial snapshot");
  assert.equal(await page.locator(".wb-agent").count(), expectedCount);

  const backLink = page.locator("a.wb-tool").first();
  assert.equal(await backLink.getAttribute("href"), "/campaigns", "all-scope back navigation");
  const presentationButton = page.getByRole("button", { name: "Presentation" });
  await presentationButton.click();
  await page.locator(".wb-shell.wb-present").waitFor();
  await assertNoScrollAndCardsVisible(page, expectedCount);
  await page.keyboard.press("Escape");
  await page.locator(".wb-shell:not(.wb-present)").waitFor();

  if (width !== 1920) {
    await backLink.click();
    await page.waitForURL(/\/campaigns$/);
  }

  if (width === 1920 && height === 1080) {
    await presentationButton.click();
    await page.locator(".wb-shell.wb-present").waitFor();
    await assertNoScrollAndCardsVisible(page, expectedCount);
    await page.screenshot({ path: ALL_SCREENSHOT, fullPage: false });
    await page.keyboard.press("Escape");
    await page.locator(".wb-shell:not(.wb-present)").waitFor();
    await page.evaluate(() => window.__setWallboardCampaign("mission-atlas"));
    await page.getByRole("heading", { name: "Mission Atlas" }).waitFor();
    await waitForCards(page, 4);
    assert.equal(await page.locator("a.wb-tool").first().getAttribute("href"), "/wallboard", "mission back navigation");
    await page.getByRole("button", { name: "Presentation" }).click();
    await page.locator(".wb-shell.wb-present").waitFor();
    await assertNoScrollAndCardsVisible(page, 4);
    await page.screenshot({ path: MISSION_SCREENSHOT, fullPage: false });
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: /Back to all Missions/i }).click();
    await page.waitForURL(/\/wallboard$/);
  }
  await page.close();
}

async function testStaleGeneration(bundle) {
  const browser = testProductionViewport.browser;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const api = installApiRoute(page, { raceDelay: 450 });
  await installHtmlRoute(page, bundle);
  await page.goto(BASE_URL);
  await page.waitForFunction(() => typeof window.__setWallboardCampaign === "function");
  await page.evaluate(() => window.__setWallboardCampaign("mission-atlas"));
  await page.getByRole("heading", { name: "Mission Atlas" }).waitFor();
  await waitForCards(page, 4);
  await sleep(650);
  assert.equal(await page.getByRole("heading", { name: "Mission Atlas" }).textContent(), "Mission Atlas");
  assert.equal(await page.locator(".wb-agent").count(), 4, "late global response reapplied after scope change");
  assert.ok(api.requests >= 2, "scope switch did not issue a scoped request");
  await page.close();
}

async function testAuthRevocation(bundle) {
  const browser = testProductionViewport.browser;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const api = installApiRoute(page);
  await installHtmlRoute(page, bundle);
  await page.goto(BASE_URL);
  await waitForCards(page, 6);
  api.authStatus = 401;
  await page.getByRole("button", { name: "Refresh" }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.locator(".wb-agent").count(), 0, "401 left staff visible");
  assert.match(await page.getByRole("alert").textContent(), /not authorized/i);

  api.authStatus = null;
  await page.reload();
  await waitForCards(page, 6);
  api.authStatus = 403;
  await page.getByRole("button", { name: "Refresh" }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.locator(".wb-agent").count(), 0, "403 left staff visible");
  assert.match(await page.getByRole("alert").textContent(), /not authorized/i);
  await page.close();
}

async function testErrorEmptyAndSource(bundle) {
  const browser = testProductionViewport.browser;
  const cases = [
    { name: "error", options: { errorStatus: 500 }, expected: /connection lost/i },
    { name: "empty", options: { empty: true }, expected: /no active mission/i },
    { name: "source warning", options: { sourceWarning: true }, expected: /source reported a warning/i },
  ];
  for (const testCase of cases) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    installApiRoute(page, testCase.options);
    await installHtmlRoute(page, bundle);
    await page.goto(BASE_URL);
    if (testCase.name === "error") {
      await page.getByRole("alert").waitFor();
      assert.match(await page.getByRole("alert").textContent(), testCase.expected);
      assert.equal(await page.locator(".wb-agent").count(), 0);
    } else if (testCase.name === "empty") {
      await page.getByText("No active Mission", { exact: false }).waitFor();
      assert.match(await page.locator(".wb-empty").textContent(), testCase.expected);
      assert.equal(await page.locator(".wb-agent").count(), 0);
    } else {
      await waitForCards(page, 6);
      await page.getByRole("status").filter({ hasText: "source reported a warning" }).waitFor();
      assert.match(await page.getByRole("status").textContent(), testCase.expected);
    }
    await page.close();
  }
}

(async () => {
  const bundle = await makeBundle();
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM,
    args: ["--no-sandbox"],
  });
  testProductionViewport.browser = browser;
  try {
    for (const [width, height, count] of [
      [1600, 900, 6],
      [1920, 1080, 6],
      [1280, 720, 4],
    ]) {
      await testProductionViewport(bundle, width, height, count);
    }
    await testStaleGeneration(bundle);
    await testAuthRevocation(bundle);
    await testErrorEmptyAndSource(bundle);
    console.log(`Wallboard browser verification passed: 1600x900, 1920x1080, 1280x720; exact 4/6 cards, polling, auth revocation, scope races, error/empty/source states, navigation, presentation/Escape.`);
    console.log(`Screenshots: ${ALL_SCREENSHOT} and ${MISSION_SCREENSHOT}`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});