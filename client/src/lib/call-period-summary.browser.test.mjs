import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Mount the real production component and its real translations in an isolated
// browser document. No app-auth bypass, credentials, real contacts, or API mocks.
const base = process.env.CALL_SUMMARY_TEST_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 760, height: 560 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/period-summary-test", route => route.fulfill({
    contentType: "text/html",
    body: `<html><head><link rel="stylesheet" href="/src/index.css"></head><body>
      <div id="test-root" style="position:relative;width:100%;height:400px"></div>
      <script type="module">
        const refresh = await import("/@react-refresh");
        refresh.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        const componentSource = await fetch("/src/components/call-period-summary.tsx").then(r=>r.text());
        const entrySource = await fetch("/src/main.tsx").then(r=>r.text());
        const reactUrl = componentSource.match(/from\\s*["']([^"']*\\/react\\.js[^"']*)["']/)[1];
        const domUrl = entrySource.match(/from\\s*["']([^"']*react-dom_client[^"']*)["']/)[1];
        const reactModule = await import(reactUrl);
        const React = reactModule.default || reactModule;
        const domModule = await import(domUrl);
        const createRoot = domModule.createRoot || domModule.default.createRoot;
        const {I18nProvider} = await import("/src/i18n/I18nProvider.tsx");
        const {CallPeriodSummary} = await import("/src/components/call-period-summary.tsx");
        const root = createRoot(document.getElementById("test-root"));
        window.renderSummary = props => root.render(React.createElement(I18nProvider, {userCountries:["SK"]}, React.createElement(CallPeriodSummary, props)));
        window.renderSummary({scopeKey:"first", ready:false, period:"Test period", total:11, withAlerts:0, avgQ:"7.0"});
      </script></body></html>`,
  }));
  await page.goto(`${base}/period-summary-test`);
  await page.waitForFunction(() => typeof window.renderSummary === "function");
  const render = props => page.evaluate(value => window.renderSummary(value), { scopeKey: "first", ready: true, period: "Test period", total: 11, withAlerts: 0, avgQ: "7.0", ...props });
  const summary = page.getByTestId("call-period-summary");
  assert.equal(await summary.count(), 0, "No partial/loading summary");
  await render({});
  await summary.waitFor();
  await page.waitForFunction(() => document.querySelector(".cps-count")?.textContent === "11");
  await page.locator('[data-testid="call-summary-lottie"] svg').waitFor();
  const assertCentered = async () => {
    const bounds = await page.locator(".cps-summary-toast").boundingBox();
    const viewport = page.viewportSize();
    assert.ok(Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2) < 2, "Horizontally centered");
    assert.ok(Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2) < 2, "Vertically centered");
    assert.equal(await summary.evaluate(e => e.parentElement === document.body), true, "Not confined by a list/player ancestor");
  };
  await assertCentered();
  assert.equal(await summary.evaluate(e => getComputedStyle(e).pointerEvents), "none");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(await page.locator(".cps-summary-toast").evaluate(e => getComputedStyle(e).borderTopWidth), "0px");
  assert.ok((await summary.innerText()).includes("Pekná práca!"));
  await page.getByRole("button", { name: "Zavrieť súhrn hovorov" }).click();
  await summary.waitFor({ state: "detached" });
  await render({});
  assert.equal(await summary.count(), 0, "No replay after normal rerender");
  await render({ scopeKey: "direction:inbound", total: 3, avgQ: "8.0" });
  await summary.waitFor();
  await page.waitForFunction(() => document.querySelector(".cps-count")?.textContent === "3");
  assert.ok((await summary.innerText()).includes("Výborná práca!"));
  await render({ scopeKey: "direction:inbound|agent:one", total: 1, avgQ: "9.5" });
  await page.waitForFunction(() => document.querySelector(".cps-count")?.textContent === "1");
  assert.ok((await summary.innerText()).includes("Mimoriadny výsledok!"));
  await render({ scopeKey: "second" });
  await summary.waitFor();
  await page.mouse.move(0, 0);
  await summary.waitFor({ state: "detached", timeout: 8500 });
  await render({ scopeKey: "third", total: 0, avgQ: null });
  await summary.waitFor();
  assert.equal(await page.locator(".cps-count").innerText(), "0");
  assert.equal(await page.locator(".cps-quality-value").count(), 0);
  await page.keyboard.press("Escape");
  await summary.waitFor({ state: "detached" });
  await render({ scopeKey: "fourth", ready: false });
  assert.equal(await summary.count(), 0);
  await render({ scopeKey: "fourth", avgQ: "9.5" });
  await summary.waitFor();
  assert.ok((await summary.innerText()).includes("Mimoriadny výsledok!"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await render({ scopeKey: "mobile" });
  await page.waitForFunction(() => document.querySelector(".cps-count")?.textContent === "11");
  await assertCentered();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log("PASS production component: readiness, real Lottie, close, Escape, auto-dismiss, repeat selection, no replay on rerender, praise, empty, mobile and reduced motion.");
} finally {
  await browser.close();
}
