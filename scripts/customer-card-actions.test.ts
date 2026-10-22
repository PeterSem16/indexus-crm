import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import ts from "typescript";
import { chromium } from "playwright";

// Extract the production JSX, not an approximation of its buttons or handlers.
const source = await readFile("client/src/pages/customers.tsx", "utf8");
const finder = await readFile("client/src/components/provider-finder/CustomerProviderFinder.tsx", "utf8");
function extract(text: string, testId: string, header: boolean) {
  const ast = ts.createSourceFile("fixture.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result = "";
  function visit(node: ts.Node) {
    if (result) return;
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === "data-testid"
      && node.initializer && ts.isStringLiteral(node.initializer) && node.initializer.text === testId) {
      let parent: ts.Node | undefined = node.parent;
      while (parent) {
        if (ts.isJsxElement(parent)) {
          const attrs = parent.openingElement.attributes.getText(ast);
          if (!header || attrs.includes("customer-card-header")) { result = parent.getText(ast); break; }
        }
        parent = parent.parent;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(result, `Missing production JSX for ${testId}`);
  return result;
}
const editHeader = extract(source, "button-view-customer-details", true);
const viewHeader = extract(source, "button-edit-from-view", true);
const launch = extract(finder, "open-customer-provider-finder", false);
const code = ts.transpileModule(`function CustomerProviderFinder(){return <div className="pf-root pf-header-root">${launch}</div>;}
function Fixture(){return <main><section data-fixture="edit">${editHeader}</section><section data-fixture="view">${viewHeader}</section></main>;}`,
{ compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
await mkdir("generated-artifacts/customer-card-actions", { recursive: true });
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 820 }, reducedMotion: "reduce" });
    // tsx preserves nested function names with this helper when serializing callbacks.
    await page.addInitScript("window.__name = (fn) => fn");
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(async ({ code }) => {
      const mainSource = await (await fetch("/src/main.tsx")).text();
      const finderSource = await (await fetch("/src/components/provider-finder/ProviderFinder.tsx")).text();
      const dependency = (name: string, text: string) => {
        const match = text.match(new RegExp(`from "([^"]+/${name}\\.js[^"]*)"`));
        if (!match) throw new Error(`Missing transformed dependency ${name}`);
        return match[1];
      };
      const reactModule = await import(dependency("react", finderSource));
      const React = reactModule.default || reactModule;
      const domModule = await import(dependency("react-dom_client", mainSource));
      const { createRoot } = domModule.default || domModule;
      const icons = await import(dependency("lucide-react", finderSource));
      const { Button } = await import("/src/components/ui/button.tsx");
      const { Badge } = await import("/src/components/ui/badge.tsx");
      const { translations } = await import("/src/i18n/translations.ts");
      await import("/src/components/customer-card-actions.css");
      await import("/src/components/provider-finder/provider-finder.css");
      await import("/src/components/provider-finder/provider-finder-atlas.css");
      document.getElementById("root")!.style.display = "none";
      const host = document.createElement("div"); document.body.append(host);
      const root = createRoot(host);
      const hits: { name: string; value: unknown }[] = [];
      const record = (name: string) => (value: unknown) => hits.push({ name, value });
      const customer = { id: "fixture-customer", firstName: "Testovacia Alexandra", lastName: "Dlhé priezvisko klientky",
        country: "SK", phone: "+421000000000", phone2: "+421000000001", email: "fixture@example.invalid",
        email2: "second@example.invalid", isClient: true, status: "active", leadScore: 65 };
      const scope: Record<string, any> = {
        React, Button, Badge, ...icons, editingCustomer: customer, viewingCustomer: customer,
        t: translations.sk, c: translations.sk.providerFinder, isRegistered: true,
        StatusBadge: () => React.createElement("span", null, "Active"),
        getCountryFlag: () => "SK", setOpen: record("finder"),
        makeCall: record("call"), callContext: { setAutoRecord: record("autoRecord") },
      };
      for (const name of ["setSelectedPhones", "setSmsDialogCustomer", "setSmsDialogOpenedAt", "setSelectedEmails",
        "setEmailDialogCustomer", "setEmailDialogOpenedAt", "setViewingCustomer", "setEditingCustomer"])
        scope[name] = record(name);
      (window as any).__iconHits = hits;
      (window as any).__renderIcons = (changes = {}) => {
        Object.assign(scope, changes);
        const keys = Object.keys(scope);
        const Fixture = new Function(...keys, `${code};return Fixture;`)(...keys.map(key => scope[key]));
        root.render(React.createElement(Fixture));
      };
      (window as any).__renderIcons();
    }, { code });
    const edit = page.locator('[data-fixture="edit"]');
    const view = page.locator('[data-fixture="view"]');
    await edit.getByTestId("button-view-customer-details").waitFor();
    const finderBox = await edit.getByTestId("open-customer-provider-finder").boundingBox();
    assert.ok(finderBox && finderBox.width === 38 && finderBox.height === 38, "use the real header icon, not the inline finder button");
    const ids = ["button-call-from-drawer", "button-sms-from-drawer", "button-email-from-drawer",
      "button-view-customer-details", "button-close-customer-drawer"];
    for (const id of ids) {
      const button = edit.getByTestId(id);
      assert.ok(await button.getAttribute("aria-label"), `Accessible label: ${id}`);
      const box = await button.boundingBox();
      assert.ok(box && box.width === 38 && box.height === 38, `Uniform tile size: ${id}`);
      const style = await button.evaluate(element => {
        const css = getComputedStyle(element);
        return { radius: css.borderRadius, border: css.borderColor };
      });
      assert.equal(style.radius, "12px", `Rounded finder-style corners: ${id}`);
      assert.notEqual(style.border, "rgba(0, 0, 0, 0)", `Visible tile border: ${id}`);
      assert.ok(box.x >= 0 && box.x + box.width <= width, `Tile fits viewport: ${id}`);
      await button.click();
    }
    await edit.getByTestId("open-customer-provider-finder").click();
    await view.getByTestId("button-edit-from-view").click();
    await view.getByTestId("button-close-view-customer").click();
    const hits = await page.evaluate(() => (window as any).__iconHits);
    assert.ok(hits.some((hit: any) => hit.name === "call" && hit.value.customerId === "fixture-customer"));
    assert.deepEqual(hits.find((hit: any) => hit.name === "setSelectedPhones").value, ["+421000000000", "+421000000001"]);
    assert.deepEqual(hits.find((hit: any) => hit.name === "setSelectedEmails").value, ["fixture@example.invalid", "second@example.invalid"]);
    assert.ok(hits.some((hit: any) => hit.name === "setViewingCustomer" && hit.value?.id === "fixture-customer"));
    assert.ok(hits.some((hit: any) => hit.name === "setEditingCustomer" && hit.value?.id === "fixture-customer"));
    assert.ok(hits.some((hit: any) => hit.name === "finder" && hit.value === true));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `generated-artifacts/customer-card-actions/light-${width}.jpg` });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: `generated-artifacts/customer-card-actions/dark-${width}.jpg` });
    await page.evaluate(() => (window as any).__renderIcons({ isRegistered: false }));
    await edit.getByTestId("button-call-from-drawer").waitFor({ state: "detached" });
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: production headers, consistent tiles, long names, light/dark, accessible labels, original actions and phone visibility`);
    await page.close();
  }
} finally { await browser.close(); }
