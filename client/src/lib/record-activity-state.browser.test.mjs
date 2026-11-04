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
    actor: "Fixture agent", createdAt: n === 2 ? "2026-10-01T09:28:31.171Z" : `2026-11-03T10:34:56.${n === 0 ? "586" : "350"}Z`,
    details: { confirmed, campaignName: "Fixture Mission",
      statusListItemLabel: n === 0 ? "Contract received by partner" : "Cooperation offered — considering" },
  }));
  await page.route("**/api/**", route => route.fulfill({ json: [] }));
  const requests = [];
  await page.route("**/api/clinics/fixture/record-activity*", route => {
    const url = new URL(route.request().url()); requests.push(url);
    const audit = url.searchParams.get("scope") === "status-list";
    const older = url.searchParams.has("before");
    const extra = { id: "fixture-call", action: "call", module: "Nexus Pulse",
      actor: "Fixture agent", createdAt: "2026-11-04T10:00:00Z", details: {} };
    return route.fulfill({ json: { events: older ? [{
      id: "older-fixture", action: "status_list_answer", module: "Nexus Pulse",
      actor: "Fixture agent", createdAt: "2026-09-30T09:00:00Z",
      details: { questionLabel: "Send materials?", previous: true, value: false, reason: "Recorded review note" },
    }] : audit ? events : [...events, extra], nextCursor: audit && !older ? "older-fixture" : null } });
  });
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
  const trigger = page.getByRole("button").first();
  await trigger.waitFor();
  assert.equal(await trigger.getAttribute("title"), await trigger.getAttribute("aria-label"));
  assert.ok(await trigger.getAttribute("aria-label"));
  assert.equal(await trigger.textContent(), "");
  const triggerStyle = await trigger.evaluate(button => {
    const style = getComputedStyle(button);
    return { width: style.width, height: style.height, radius: style.borderRadius, color: style.color };
  });
  assert.deepEqual(triggerStyle, { width: "38px", height: "38px", radius: "12px", color: "rgb(40, 100, 134)" });
  await page.screenshot({ path: "generated-artifacts/record-activity-evidence/action-button.png" });
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
  await Promise.all([
    page.waitForResponse(response => new URL(response.url()).searchParams.get("scope") === "status-list"),
    dialog.getByRole("button", { name: "Status List audit", exact: true }).click(),
  ]);
  await removedBadges.first().waitFor();
  assert.equal(await dialog.getByText("Call recorded", { exact: true }).count(), 0);
  await dialog.getByText("Contract received by partner", { exact: true }).waitFor();
  assert.equal(await dialog.getByText("No reason was recorded.", { exact: true }).count(), 3);
  assert.equal(await dialog.getByText(/11:34:56/).count(), 2);
  assert.equal(await dialog.getByText(/11:28:31/).count(), 1);
  await page.screenshot({ path: "generated-artifacts/record-activity-evidence/audit-desktop.png" });
  await dialog.getByRole("button", { name: /Load/i }).click();
  await dialog.getByText("Selected → Not selected", { exact: true }).waitFor();
  assert.equal(await dialog.getByText("Recorded review note", { exact: true }).count(), 1);
  assert.ok(requests.some(url => url.searchParams.get("scope") === "status-list" && url.searchParams.get("before") === "older-fixture"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const rect = document.querySelector('[role="dialog"]')?.getBoundingClientRect();
    return rect && rect.x >= 0 && rect.right <= window.innerWidth;
  });
  const bounds = await dialog.boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390);
  await page.screenshot({ path: "generated-artifacts/record-activity-evidence/audit-mobile.png" });
  await page.setViewportSize({ width: 1200, height: 900 });
  await Promise.all([
    page.waitForResponse(response => response.url().includes("/record-activity") && !new URL(response.url()).searchParams.has("scope")),
    dialog.getByRole("button", { name: "All activity", exact: true }).click(),
  ]);
  await dialog.locator("b").filter({ hasText: /^Call recorded$/ }).waitFor();
  assert.deepEqual(errors, []);
  console.log("Record activity: real removal/confirmation badges, action filter and search verified.");
} finally { await browser.close(); }
