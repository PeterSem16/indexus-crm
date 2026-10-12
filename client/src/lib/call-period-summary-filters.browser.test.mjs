import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Exercise the production page's real controls with isolated browser responses.
// This document never changes application authentication or server data.
const base = process.env.CALL_SUMMARY_TEST_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => { errors.push(error.message); console.error(error.message); });
  const now = new Date().toISOString();
  const calls = [
    { direction: "inbound", agent: "Agent A", quality: 9 },
    { direction: "inbound", agent: "Agent B", quality: 7 },
    { direction: "outbound", agent: "Agent A", quality: 5 },
  ].map((item, index) => ({
    id: `fixture-${index}`, userId: "fixture-user", customerId: null, campaignId: null,
    phoneNumber: `00000000${index}`, direction: item.direction, status: "completed",
    startedAt: now, createdAt: now, endedAt: now, answeredAt: now, durationSeconds: 60,
    customerName: null, campaignName: null, entityName: null, contactType: null,
    hasRecording: false, isMobile: false, isForwarded: false, isImportant: false,
    mobileAgentName: null, inboundQueueId: null, inboundQueueName: null,
    recording: { id: `recording-${index}`, agentName: item.agent, qualityScore: item.quality,
      analysisStatus: "completed", alertKeywords: [], transcriptionText: null, summary: null },
  }));
  let browseRequests = 0;
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/call-logs/browse") {
      browseRequests++;
      return route.fulfill({ json: calls });
    }
    if (path === "/api/auth/me") return route.fulfill({ status: 401, json: { user: null } });
    return route.fulfill({ json: [] });
  });
  await page.route("**/call-summary-filters-test", route => route.fulfill({
    contentType: "text/html",
    body: `<html><head><link rel="stylesheet" href="/src/index.css"></head><body>
      <div id="test-root"></div><script type="module">
        const refresh = await import("/@react-refresh");
        refresh.injectIntoGlobalHook(window);
        window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type;
        window.__vite_plugin_react_preamble_installed__=true;
        const source = await fetch("/src/pages/transcript-search.tsx").then(r=>r.text());
        const entry = await fetch("/src/main.tsx").then(r=>r.text());
        const reactModule = await import(source.match(/from\\s*["']([^"']*\\/react\\.js[^"']*)["']/)[1]);
        const React = reactModule.default || reactModule;
        const dom = await import(entry.match(/from\\s*["']([^"']*react-dom_client[^"']*)["']/)[1]);
        const createRoot = dom.createRoot || dom.default.createRoot;
        const query = await import(source.match(/from\\s*["']([^"']*react-query[^"']*)["']/)[1]);
        const {I18nProvider} = await import("/src/i18n/I18nProvider.tsx");
        const {AuthProvider} = await import("/src/contexts/auth-context.tsx");
        const {TooltipProvider} = await import("/src/components/ui/tooltip.tsx");
        const {TranscriptSearchContent} = await import("/src/pages/transcript-search.tsx");
        const client = new query.QueryClient({defaultOptions:{queries:{retry:false}}});
        window.summaryTestClient = client;
        createRoot(document.getElementById("test-root")).render(
          React.createElement(query.QueryClientProvider,{client},
            React.createElement(AuthProvider,null,
              React.createElement(I18nProvider,{userCountries:["SK"]},
                React.createElement(TooltipProvider,null,React.createElement(TranscriptSearchContent))))));
      </script></body></html>`,
  }));
  await page.goto(`${base}/call-summary-filters-test`);
  const summary = page.getByTestId("call-period-summary");
  const count = page.locator(".cps-count");
  const verify = async (total, quality) => {
    await summary.waitFor({ timeout: 60000 });
    await page.waitForFunction(value => document.querySelector(".cps-count")?.textContent === String(value), total);
    assert.equal(await page.getByTestId("calls-list-scroll").locator("[data-testid^='call-row-']").count(), total);
    if (quality !== null) assert.ok((await page.locator(".cps-quality-value").innerText()).includes(quality));
    else assert.equal(await page.locator(".cps-quality-value").count(), 0);
  };
  await verify(3, "7.0");
  await page.getByRole("button", { name: "Zavrieť súhrn hovorov" }).click();
  await summary.waitFor({ state: "detached" });
  await page.getByTestId("btn-toolbar-more-filters").click();
  await page.getByTestId("select-browse-direction").click();
  await page.getByRole("option").filter({ hasText: /Prichádzajúce|Prichádzajúci|Prichádzajú/i }).click();
  await verify(2, "8.0");
  await page.getByTestId("select-browse-agent").click();
  await page.getByRole("option", { name: "Agent A", exact: true }).click();
  await verify(1, "9.0");
  await page.getByTestId("calls-list-scroll").locator("[data-testid^='call-row-']").first().click();
  await page.getByTestId("select-browse-agent").click();
  await page.getByRole("option", { name: "Agent B", exact: true }).click();
  await verify(1, "7.0");
  await page.getByTestId("btn-clear-browse-filters").click();
  await verify(3, "7.0");
  await page.getByTestId("input-browse-search").fill("no-fixture-matches");
  await verify(0, null);
  await page.getByTestId("input-browse-search").fill("");
  await verify(3, "7.0");
  await page.getByRole("button", { name: "Zavrieť súhrn hovorov" }).click();
  await summary.waitFor({ state: "detached" });
  const beforeRefresh = browseRequests;
  await page.evaluate(() => window.summaryTestClient.invalidateQueries({ queryKey: ["/api/call-logs/browse"] }));
  assert.ok(browseRequests > beforeRefresh);
  assert.equal(await summary.count(), 0, "Background refresh does not reopen summary");
  assert.deepEqual(errors, []);
  console.log("PASS real Calls page: inbound, agent combinations, desktop detail, reset, text search, empty state and no replay on background refresh.");
} finally {
  await browser.close();
}
