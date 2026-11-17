"use strict";
// Isolated real-component browser check; never signs into CRM, calls AI or writes CRM data.
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const assert = require("node:assert/strict");
const { build } = require("esbuild"), { chromium } = require("playwright");
async function main() {
  const out = path.resolve("generated-artifacts/email-monitoring-detail-ui");
  fs.mkdirSync(out, { recursive: true });
  const assets = path.resolve("dist/public/assets");
  const cssPath = process.argv[2] || fs.readdirSync(assets).filter(file => file.endsWith(".css"))
    .map(file => path.join(assets, file)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
  const css = fs.readFileSync(cssPath);
  await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React, {useState} from "react";
    import {createRoot} from "react-dom/client";
    import {I18nProvider, useI18n} from "./client/src/i18n";
    import {EmailMonitoringAnalysis} from "./client/src/components/nexus/EmailMonitoringAnalysis";
    function Harness() {
      const [result, setResult] = useState(null);
      const {setLocale, locale} = useI18n();
      window.setResult = setResult; window.setLanguage = setLocale; window.uiLocale = locale;
      return <main style={{maxWidth: 850, margin: "24px auto", padding: 16}}>
        <p style={{marginBottom: 16}}>Syntetické overenie komponentu — nie produkčný e-mail.</p>
        <EmailMonitoringAnalysis result={result}/>
      </main>;
    }
    const countries = [];
    createRoot(document.getElementById("root")).render(<I18nProvider userCountries={countries}><Harness/></I18nProvider>);
  ` }, outfile: path.join(out, "ui.js"), bundle: true, platform: "browser", format: "iife",
    jsx: "automatic", tsconfig: "tsconfig.json", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent" });
  const server = http.createServer((req, res) => {
    if (req.url === "/ui.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(fs.readFileSync(path.join(out, "ui.js"))); }
    if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css"); return res.end(css); }
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/ui.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"],
    ...(fs.existsSync("/repl/tools/bin/chromium") ? { executablePath: "/repl/tools/bin/chromium" } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
    const errors = [], apiCalls = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", req => { if (req.url().includes("/api/")) apiCalls.push(req.url()); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => typeof window.setResult === "function");
    assert.equal(await page.getByTestId("email-monitoring-analysis").count(), 0);
    await page.getByTestId("email-monitoring-empty").waitFor();
    await page.evaluate(() => window.setLanguage("sk"));
    await page.waitForFunction(() => window.uiLocale === "sk");
    assert.match(await page.getByTestId("email-monitoring-empty").innerText(), /nie je uložený výsledok/);
    assert.equal(await page.getByTestId("email-monitoring-note").count(), 0);
    await page.screenshot({ path: path.join(out, "no-saved-result.jpg") });
    const result = { source: "email.monitoring", analyzedAt: "2026-11-17T11:00:00.000Z", analysis: {
      sentiment: "neutral", hasInappropriateContent: false, hasAngryTone: false, hasRudeExpressions: false,
      wantsToCancel: false, wantsConsent: false, doesNotAcceptContract: true, alertLevel: "none",
      note: "Zákazník odmieta novú ponuku, existujúcu službu ponecháva.",
    } };
    await page.evaluate(value => { window.setLanguage("sk"); window.setResult(value); }, result);
    await page.waitForFunction(() => window.uiLocale === "sk");
    await page.getByTestId("email-monitoring-analysis").waitFor();
    assert.equal(await page.getByTestId("email-monitoring-note").textContent(), result.analysis.note);
    assert.equal(await page.locator("[data-analysis-field]").count(), 6);
    assert.equal(await page.locator("dl > div").count(), 8);
    assert.match(await page.locator('[data-analysis-field="doesNotAcceptContract"]').innerText(), /Áno/);
    assert.match(await page.locator('[data-analysis-field="wantsToCancel"]').innerText(), /Nie/);
    for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
      await page.evaluate(value => window.setLanguage(value), locale);
      await page.waitForFunction(value => window.uiLocale === value, locale);
      assert.equal(await page.getByTestId("email-monitoring-note").textContent(), result.analysis.note);
      for (const value of await page.locator("dl dt, dl dd").allTextContents()) assert.ok(value.trim());
    }
    await page.evaluate(() => window.setLanguage("sk"));
    await page.screenshot({ path: path.join(out, "neutral-note.jpg"), fullPage: true });
    for (const alertLevel of ["warning", "critical"]) {
      await page.evaluate(value => window.setResult(value), { ...result, analysis: { ...result.analysis,
        alertLevel, sentiment: "angry", hasAngryTone: true, wantsToCancel: true } });
      await page.waitForTimeout(30);
      assert.equal(await page.getByTestId("email-monitoring-note").textContent(), result.analysis.note);
    }
    const hostile = '<img src=x onerror="window.unsafeNoteExecuted=true">Presná poznámka.';
    await page.evaluate(value => window.setResult(value), { ...result, analysis: { ...result.analysis, note: hostile } });
    await page.waitForTimeout(30);
    assert.equal(await page.getByTestId("email-monitoring-note").textContent(), hostile);
    assert.equal(await page.getByTestId("email-monitoring-note").locator("img").count(), 0);
    assert.equal(await page.evaluate(() => !!window.unsafeNoteExecuted), false);
    await page.evaluate(value => { window.setResult(value); document.documentElement.classList.add("dark"); }, result);
    await page.waitForTimeout(30);
    await page.screenshot({ path: path.join(out, "dark-note.jpg"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(out, "mobile-note.jpg"), fullPage: true });
    await page.evaluate(value => window.setResult(value), { ...result, source: "email.sentiment" });
    await page.waitForTimeout(30);
    assert.equal(await page.getByTestId("email-monitoring-analysis").count(), 0);
    assert.deepEqual(apiCalls, []); assert.deepEqual(errors, []);
    const source = fs.readFileSync("client/src/pages/email-client.tsx", "utf8");
    assert.equal((source.match(/<EmailMonitoringAnalysis result=/g) || []).length, 2,
      "both the existing reading pane and modal must display the same production component");
    assert.ok(source.includes("if (!response.ok) throw new Error"));
    console.log("EMAIL_MONITORING_UI_PASS: exact Slovak note; all 9 fields; none/warning/critical; 7 languages; escaped HTML; both detail mounts; dark/mobile; no AI or CRM calls.");
  } finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
    fs.rmSync(path.join(out, "ui.js"), { force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
