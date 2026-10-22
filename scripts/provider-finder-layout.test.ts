import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { DEFAULT_FINDER_POLICY } from "../shared/provider-finder";

// Render the real finder and its real Dialog at representative viewport sizes.
// Only API data is synthetic; no customer records or country settings are changed.
const output = "generated-artifacts/provider-finder-redesign";
const prefix = "/api/provider-finder-layout-test";
const liveMap = process.argv.includes("--live-map");
const fixtures = Array.from({ length: 7 }, (_, index) => ({
  id: `layout-${index}`, type: index === 5 ? "hospital" : "clinic",
  name: ["Ambulancia Harmónia", "Gynekologické centrum Dúbravka", "Ambulancia Pod lesom",
    "Gynekologická ambulancia Lamač", "Zdravotné centrum Karlova Ves", "Nemocnica Západ", "Ambulancia Centrum"][index],
  address: `Testovacia ${index + 1}`, city: "Bratislava", distanceKm: 0.8 + index * 0.3,
  lat: 48.19 + index * 0.001, lng: 17.04 + index * 0.002,
  people: index === 3 ? [{ id: "layout-person", name: "Testovacia osoba" }] : [],
  suggestedPersonId: index === 3 ? "layout-person" : undefined,
  services: [], contracted: index < 3, cooperating: index < 3,
  uploadedContract: index < 2, hasRepresentative: index < 3, recentContact: index < 2,
  priorityScore: 92 - index * 10,
  quality: {
    score: 92 - index * 10, tier: index < 2 ? "recommended" : index === 2 ? "previous" : "other",
    matched: index < 2 ? ["currentAgreement", "cooperation", "representative"] : ["representative"],
    missing: index < 2 ? [] : ["currentAgreement"], unknown: [],
    breakdown: [{ criterion: "distance", points: 8 }], notNearest: index === 1,
  },
}));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"],
});
try {
  for (const size of [
    { width: 1024, height: 590, publicView: false },
    { width: 1440, height: 900, publicView: false },
    { width: 390, height: 844, publicView: false },
    { width: 390, height: 844, publicView: true },
  ]) {
    const { publicView, ...viewport } = size;
    const context = await browser.newContext({
      viewport, geolocation: { latitude: 48.19, longitude: 17.04 }, permissions: ["geolocation"],
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route(`**${prefix}/**`, async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/map-config")) {
        if (liveMap && process.env.GOOGLE_MAPS_BROWSER_API_KEY)
          return route.fulfill({ json: { browserKey: process.env.GOOGLE_MAPS_BROWSER_API_KEY } });
        // Explicitly exercise the usable list even when Google is unavailable.
        return route.fulfill({ status: 503, json: { error: "maps_not_configured" } });
      }
      if (path.endsWith("/geocode"))
        return route.fulfill({ json: { candidates: [{
          label: "GOOGLE ADDRESS FOR CONFIRMATION ONLY", point: { lat: 48.19, lng: 17.04 }, approximate: false,
        }] } });
      if (path.endsWith("/search"))
        return route.fulfill({ json: { results: fixtures, missingLocations: 3 } });
      throw Error(`Unexpected fixture route ${path}`);
    });
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}`, { waitUntil: "domcontentloaded" });
    const props = {
      context: { billingCompanyId: "country", country: "SK", companyName: "INDEXUS", mapsReady: true,
        policy: { ...DEFAULT_FINDER_POLICY, enabled: true, quality: { ...DEFAULT_FINDER_POLICY.quality, enabled: true } } },
      prefix, publicView, initialAddress: "Testovacia 1, Bratislava",
      customerName: publicView ? undefined : "Testovacia klientka", locale: "sk",
    };
    await page.evaluate(`(async () => {
      const mainSource=await (await fetch('/src/main.tsx')).text();
      const finderSource=await (await fetch('/src/components/provider-finder/ProviderFinder.tsx')).text();
      const reactPath=finderSource.match(/from "([^"]+\\/react\\.js[^"]*)"/)[1];
      const domPath=mainSource.match(/from "([^"]+\\/react-dom_client\\.js[^"]*)"/)[1];
      const reactModule = await import(reactPath);
      const React = reactModule.default || reactModule;
      const domModule = await import(domPath);
      const {createRoot} = domModule.default || domModule;
      const {Dialog,DialogContent,DialogTitle} = await import('/src/components/ui/dialog.tsx');
      const {ProviderFinder} = await import('/src/components/provider-finder/ProviderFinder.tsx');
      document.getElementById('root').style.display='none';
      const mount=document.createElement('div');document.body.append(mount);
      createRoot(mount).render(React.createElement(Dialog,{open:true},
        React.createElement(DialogContent,{className:'pf-host-dialog z-[10050]',overlayClassName:'z-[10040]'},
          React.createElement(DialogTitle,{className:'sr-only'},'Test'),
          React.createElement(ProviderFinder,{...${JSON.stringify(props)},
            onSelect:(selection)=>{window.__finderSelection=selection;},
            onClose:()=>{window.__finderClosed=true;}
          }))));
    })()`);
    const finder = page.getByTestId("provider-finder");
    await finder.waitFor();
    await finder.locator("#pf-address").fill("Moja zadaná adresa");
    await finder.locator("#pf-address").press("Enter");
    await finder.locator(".pf-candidate-confirmation button").first().click();
    await finder.locator(".pf-result").first().waitFor();
    assert.equal(await finder.locator(".pf-result").count(), 7);
    assert.equal(await finder.locator(".pf-is-recommended").count(), publicView ? 0 : 2,
      "recommendation highlighting follows real tiers and is never exposed publicly");
    if (publicView)
      assert.equal(await finder.locator(".pf-quality-result, .pf-reason, .pf-tier").count(), 0, "no internal evidence in public UI");
    assert.equal(await finder.getByText("GOOGLE ADDRESS FOR CONFIRMATION ONLY", { exact: true }).count(), 0);
    const first = finder.locator(".pf-result").first();
    assert.ok((await first.innerText()).includes("Ambulancia Harmónia"), "preserve API ranking");
    const visibleBox = await first.boundingBox();
    const footerBox = await finder.locator(".pf-modal-foot").boundingBox();
    assert.ok(visibleBox && footerBox && visibleBox.y >= 0 && visibleBox.y + Math.min(visibleBox.height, 90) <= footerBox.y,
      `first result is usable above the footer at ${viewport.width}x${viewport.height}`);
    assert.ok(footerBox.y + footerBox.height <= viewport.height + 1, "footer remains in viewport");
    assert.equal(await finder.locator(".pf-modal-foot .primary").isDisabled(), true);
    await finder.locator(".pf-result").nth(3).locator(".pf-result-select").click();
    await finder.locator("#pf-selected-person").selectOption("");
    assert.equal(await finder.locator(".pf-modal-foot .primary").isDisabled(), true, "required person cannot be omitted");
    await finder.locator("#pf-selected-person").selectOption("layout-person");
    assert.equal(await finder.locator(".pf-modal-foot .primary").isDisabled(), false);
    await first.locator(".pf-result-select").click();
    if (liveMap && viewport.width >= 1280) {
      const marker = finder.locator(".pf-map-marker").filter({ hasText: "2" });
      await marker.waitFor({ state: "visible", timeout: 30000 });
      await marker.click();
      assert.equal(await finder.locator(".pf-result").nth(1).locator(".pf-result-select").getAttribute("aria-pressed"), "true",
        "live Google marker selects the matching candidate");
      await first.locator(".pf-result-select").click();
    }
    await finder.locator(".pf-modal-foot .primary").click();
    const selection = await page.evaluate(() => (window as any).__finderSelection);
    assert.equal(selection.id, "layout-0", "actual selection callback");
    assert.equal(selection.country, "SK");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "no page horizontal overflow");
    await page.screenshot({ path: `${output}/finder-${publicView ? "public-" : ""}${viewport.width}.jpg` });
    if (viewport.width === 1440) {
      await page.evaluate(() => document.documentElement.classList.add("dark"));
      await page.screenshot({ path: `${output}/finder-dark.jpg` });
    }
    assert.deepEqual(errors, [], "no browser exceptions");
    console.log(`PASS ${publicView ? "public" : "internal"} ${viewport.width}x${viewport.height}: real Dialog, address confirmation, ranking, visible candidate, person requirement, selection, footer, privacy, no overflow`);
    await context.close();
  }
} finally {
  await browser.close();
}
