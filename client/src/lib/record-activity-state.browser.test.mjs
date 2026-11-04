import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Mount the real component with fixture API responses, not an auth bypass.
const base = process.env.RECORD_ACTIVITY_TEST_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const browser = await chromium.launch({
  executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const events = [false, false, true].map((confirmed, n) => ({
    id: `fixture-${n}`, action: "status_list_confirmation", module: "Nexus Pulse",
    actor: "Fixture agent", createdAt: `2026-11-03T10:34:5${6 - n}.350Z`,
    details: { confirmed, campaignName: "Fixture Mission",
      statusListItemLabel: n === 0 ? "Contract received by partner" : "Cooperation offered — considering" },
  }));
  await page.route("**/api/**", route => route.fulfill({ json: [] }));
  await page.route("**/api/clinics/fixture/record-activity*", route =>
    route.fulfill({ json: { events, nextCursor: null } }));
  await page.route("**/record-activity-state-test", route => route.fulfill({
    contentType: "text/html",
    body: `<html><head><link rel="stylesheet" href="/src/index.css"></head><body>
      <div id="test-root"></div><script type="module">
      const refresh=await import("/@react-refresh");
      refresh.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;
      window.__vite_plugin_react_preamble_installed__=true;
      const source=await fetch("/src/components/record-activity-button.tsx").then(r=>r.text());
      const entry=await fetch("/src/main.tsx").then(r=>r.text());
      const workspace=await fetch("/src/pages/agent-workspace.tsx").then(r=>r.text());
      const rm=await import(source.match(/from\\s*["']([^"']*\\/react\\.js[^"']*)["']/)[1]);
      const React=rm.default||rm;
      const dom=await import(entry.match(/from\\s*["']([^"']*react-dom_client[^"']*)["']/)[1]);
      const query=await import(workspace.match(/from\\s*["']([^"']*react-query[^"']*)["']/)[1]);
      const {I18nProvider}=await import("/src/i18n/I18nProvider.tsx");
      const {AuthProvider}=await import("/src/contexts/auth-context.tsx");
      const {TooltipProvider}=await import("/src/components/ui/tooltip.tsx");
      const {RecordActivityButton}=await import("/src/components/record-activity-button.tsx");
      const client=new query.QueryClient({defaultOptions:{queries:{retry:false}}});
      (dom.createRoot||dom.default.createRoot)(document.getElementById("test-root")).render(
        React.createElement(query.QueryClientProvider,{client},
          React.createElement(AuthProvider,null,React.createElement(I18nProvider,null,
            React.createElement(TooltipProvider,null,
              React.createElement(RecordActivityButton,{recordType:"clinic",recordId:"fixture"}))))));
      </script></body></html>`,
  }));
  await page.goto(`${base}/record-activity-state-test`);
  await page.getByRole("button").first().click();
  const dialog = page.getByRole("dialog");
  const removedBadges = dialog.locator("b").filter({ hasText: /^Step confirmation removed$/ });
  const confirmedBadges = dialog.locator("b").filter({ hasText: /^Step confirmed$/ });
  await removedBadges.first().waitFor();
  assert.equal(await removedBadges.count(), 2);
  assert.equal(await confirmedBadges.count(), 1);
  assert.equal(await dialog.getByText("Activity recorded", { exact: true }).count(), 0);
  for (const row of await dialog.locator("ol > li").all()) await row.getByRole("button").first().click();
  assert.equal(await dialog.getByText("Fixture Mission", { exact: true }).count(), 3);
  await mkdir("generated-artifacts/record-activity-evidence", { recursive: true });
  await page.screenshot({ path: "generated-artifacts/record-activity-evidence/history.png" });
  const actions = dialog.getByRole("combobox").nth(1);
  await actions.selectOption("status_list_unconfirmed");
  assert.equal(await confirmedBadges.count(), 0);
  assert.equal(await removedBadges.count(), 2);
  await actions.selectOption("");
  await dialog.getByRole("textbox").first().fill("Step confirmation removed");
  assert.equal(await confirmedBadges.count(), 0);
  assert.equal(await removedBadges.count(), 2);
  assert.deepEqual(errors, []);
  console.log("Record activity: real removal/confirmation badges, action filter and search verified.");
} finally { await browser.close(); }
