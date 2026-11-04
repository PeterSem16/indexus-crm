import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const out = "generated-artifacts/status-list-phase-evidence";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const items = [
    { id: "acq", stepId: "A", label: "First contact", tab: "acquisition", confirmationType: "info", itemType: "step",
      questions: [{ id: "yes", questionText: "Contact established?", fieldType: "yesno" },
        { id: "no", questionText: "More information needed?", fieldType: "yes_no" }] },
    { id: "contract", stepId: "C", label: "Contract review", tab: "contract", confirmationType: "info", itemType: "step",
      questionSelectionMode: "single", questions: [
        { id: "review", questionText: "Reviewing contract", fieldType: "checkbox" },
        { id: "signed", questionText: "Contract signed", fieldType: "checkbox" }] },
  ];
  await page.route("**/phase-progress-test", route => route.fulfill({ contentType: "text/html", body: `<html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css">
    </head><body><main id="root" style="max-width:920px;margin:24px auto"></main><script type="module">
    const refresh=await import("/@react-refresh");refresh.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
    const source=await fetch("/src/components/status-list-agent-preview.tsx").then(r=>r.text());
    const entry=await fetch("/src/main.tsx").then(r=>r.text());
    const workspace=await fetch("/src/pages/agent-workspace.tsx").then(r=>r.text());
    const rm=await import(source.match(/from\\s*["']([^"']*\\/react\\.js[^"']*)["']/)[1]);const React=rm.default||rm;
    const dom=await import(entry.match(/from\\s*["']([^"']*react-dom_client[^"']*)["']/)[1]);
    const query=await import(workspace.match(/from\\s*["']([^"']*react-query[^"']*)["']/)[1]);
    const {I18nProvider}=await import("/src/i18n/I18nProvider.tsx");
    const {AuthProvider}=await import("/src/contexts/auth-context.tsx");
    const {TooltipProvider}=await import("/src/components/ui/tooltip.tsx");
    const {StatusListAgentPreview}=await import("/src/components/status-list-agent-preview.tsx");
    const client=new query.QueryClient({defaultOptions:{queries:{retry:false}}});
    (dom.createRoot||dom.default.createRoot)(document.getElementById("root")).render(
      React.createElement(query.QueryClientProvider,{client},React.createElement(AuthProvider,null,
        React.createElement(I18nProvider,null,React.createElement(TooltipProvider,null,
          React.createElement(StatusListAgentPreview,{items:${JSON.stringify(items)},locale:"en",statusListMode:"batch"}))))));
    </script></body></html>` }));
  await page.goto(`${base}/phase-progress-test`);
  const acq = page.getByTestId("sl-phase-acquisition");
  const contract = page.getByTestId("sl-phase-contract");
  const retention = page.getByTestId("sl-phase-retention");
  await acq.waitFor();
  assert.match(await acq.getAttribute("aria-label"), /0 of 2/);
  await page.getByTestId("btn-sl-q-yes-yes").click();
  assert.match(await acq.getAttribute("aria-label"), /50 percent/);
  await page.getByTestId("btn-sl-q-no-no").click();
  assert.match(await acq.getAttribute("aria-label"), /2 of 2.*100 percent/);
  await contract.click();
  await page.getByTestId("btn-sl-q-signed").click();
  assert.match(await contract.getAttribute("aria-label"), /1 of 1.*100 percent/);
  await page.getByTestId("btn-sl-q-review").click();
  assert.match(await contract.getAttribute("aria-label"), /1 of 1.*100 percent/);
  assert.equal(await page.getByTestId("btn-sl-q-signed").getAttribute("aria-pressed"), "false");
  assert.match(await contract.textContent(), /Draft/);
  assert.match(await retention.textContent(), /No steps yet/);
  assert.equal(await contract.getAttribute("aria-pressed"), "true");
  for (const button of [acq, contract, retention]) {
    assert.equal(Math.round((await button.boundingBox()).height), 64);
    assert.equal(await button.locator(".sl-phase-card__percent").evaluate(node => getComputedStyle(node).fontSize), "18px");
    if (await button.locator(".sl-phase-card__draft").count()) {
      const caption = await button.locator(".sl-phase-card__caption").boundingBox();
      const draft = await button.locator(".sl-phase-card__draft").boundingBox();
      assert.ok(draft.x >= caption.x + caption.width - 65);
    }
  }
  await page.screenshot({ path: `${out}/desktop.png` });
  await page.getByTestId("btn-sl-q-review").click();
  assert.match(await contract.getAttribute("aria-label"), /0 of 1.*0 percent/);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const button of [acq, contract, retention]) {
      const rect = await button.boundingBox();
      assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width);
      assert.equal(await button.locator(".sl-phase-card__percent").evaluate(node => getComputedStyle(node).fontSize), "18px");
      assert.equal(Math.round(rect.height), 100);
      const label = button.locator(".sl-phase-card__label");
      assert.ok(await label.evaluate(node => node.scrollWidth <= node.clientWidth));
      if (await button.locator(".sl-phase-card__draft").count()) {
        const caption = await button.locator(".sl-phase-card__caption").boundingBox();
        const draft = await button.locator(".sl-phase-card__draft").boundingBox();
        assert.ok(draft.y >= caption.y + caption.height);
      }
    }
    await page.screenshot({ path: `${out}/mobile-${width}.png` });
  }
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({ path: `${out}/dark.png` });
  await retention.focus();
  await page.keyboard.press("Enter");
  assert.equal(await retention.getAttribute("aria-pressed"), "true");
  assert.deepEqual(errors, []);
  console.log("Phase progress: yes/no, single-choice replacement/removal, draft, empty, keyboard, desktop, dark and 320/390px verified.");
} finally { await browser.close(); }
