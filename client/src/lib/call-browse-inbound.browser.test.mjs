import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Render the real page using browser-only API fixtures. Application auth and
// stored data are unchanged; this is not a production/session verification.
const base = process.env.CALL_BROWSE_TEST_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const browser = await chromium.launch({
  executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const canonicalRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  const now = new Date().toISOString();
  const inbound = {
    id: "inbound:fixture", recordSource: "inbound", userId: null,
    customerId: null, campaignId: "fixture-mission", campaignName: "Fixture Mission",
    campaignContactId: null, phoneNumber: "000000001", direction: "inbound",
    status: "abandoned", startedAt: now, createdAt: now, endedAt: now,
    answeredAt: null, durationSeconds: 0, ringTimeSeconds: 27, notes: null,
    customerName: null, entityName: null, contactType: null,
    hasRecording: false, recording: null, isMobile: false, isForwarded: false,
    isImportant: false, mobileAgentName: null, mobileOutboundCallerId: null,
    inboundQueueId: "fixture-queue", inboundQueueName: "Fixture Queue",
    hungUpBy: null, dispositionCode: null, dispositionName: null,
    dispositionSubstatuses: [],
  };
  const canonical = { ...inbound, id: "fixture-canonical", recordSource: undefined,
    userId: "fixture-user", phoneNumber: "000000002" };
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/call-logs/browse") return route.fulfill({ json: [inbound, canonical] });
    if (path === "/api/auth/me") return route.fulfill({ json: {
      user: { id: "fixture-user", username: "Fixture", role: "admin", assignedCountries: ["SK"] },
    } });
    if (path.startsWith("/api/call-logs/")) canonicalRequests.push(path);
    return route.fulfill({ json: [] });
  });
  await page.route("**/call-browse-inbound-test", route => route.fulfill({
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
      const query = await import(source.match(/from\\s*["']([^"']*react-query[^"']*)["']/)[1]);
      const {I18nProvider} = await import("/src/i18n/I18nProvider.tsx");
      const {AuthProvider} = await import("/src/contexts/auth-context.tsx");
      const {TooltipProvider} = await import("/src/components/ui/tooltip.tsx");
      const {TranscriptSearchContent} = await import("/src/pages/transcript-search.tsx");
      const client = new query.QueryClient({defaultOptions:{queries:{retry:false}}});
      (dom.createRoot || dom.default.createRoot)(document.getElementById("test-root")).render(
        React.createElement(query.QueryClientProvider,{client},
          React.createElement(AuthProvider,null,
            React.createElement(I18nProvider,{userCountries:["SK"]},
              React.createElement(TooltipProvider,null,React.createElement(TranscriptSearchContent))))));
    </script></body></html>`,
  }));
  await page.goto(`${base}/call-browse-inbound-test`);
  await page.getByTestId("call-row-inbound:fixture").waitFor({ timeout: 60000 });
  await page.getByTestId("call-row-inbound:fixture").click();
  await page.getByTestId("analysis-detail-inbound:fixture").waitFor();
  assert.equal(await page.getByTestId("btn-important-inbound:fixture").count(), 0);
  assert.equal(await page.getByTestId("open-call-contact-inbound:fixture").count(), 0);
  assert.equal(canonicalRequests.some(path => path.includes("inbound:") || path.includes("inbound%3A")), false);
  await page.getByTestId("call-row-fixture-canonical").click();
  await page.getByTestId("btn-important-fixture-canonical").waitFor();
  assert.equal(await page.getByTestId("open-call-contact-fixture-canonical").count(), 1);
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log("PASS: inbound-only row opens without canonical API calls; canonical controls stay available");
} finally {
  await browser.close();
}
