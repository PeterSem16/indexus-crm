// Start the development application first. No mailbox requests reach Microsoft.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(fs.existsSync("/repl/tools/bin/chromium") ? { executablePath: "/repl/tools/bin/chromium" } : {}),
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
    const errors = [];
    let posts = 0;
    let state = { phase: "idle", auth: "pending", send: "pending", receive: "pending",
      startedAt: null, finishedAt: null, errorCode: null, providerCode: null, senderAligned: true };
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/test-fixtures/system-mailbox-check.html", route => route.fulfill({
      contentType: "text/html",
      body: fs.readFileSync("client/test-fixtures/system-mailbox-check.html", "utf8")
        .replace('src="./', 'src="/test-fixtures/'),
    }));
    await page.route("**/api/**", async route => {
      if (route.request().url().endsWith("/SK/check")) {
        if (route.request().method() === "POST") {
          posts++;
          state = { ...state, phase: "checking", startedAt: new Date().toISOString() };
          setTimeout(() => {
            state = { ...state, phase: "received", auth: "ok", send: "ok", receive: "ok", finishedAt: new Date().toISOString() };
          }, 600);
        }
        await route.fulfill({ status: 200, json: state });
      } else await route.fulfill({ json: {} });
    });
    // Keep native window.fetch intact: wrappers can conceal receiver-binding bugs.
    const base = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000";
    await page.goto(`${base}/test-fixtures/system-mailbox-check.html`);
    const button = page.getByTestId("button-system-mailbox-check");
    await button.waitFor({ timeout: 15000 });
    await button.click();
    await page.getByText("Message received in Inbox", { exact: true }).waitFor({ timeout: 10000 });
    assert.equal(posts, 1);
    assert.deepEqual(errors, []);
    await page.setViewportSize({ width: 390, height: 760 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log("Mailbox browser UI: native fetch, one POST, receipt polling, mobile bounds PASSED");
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
