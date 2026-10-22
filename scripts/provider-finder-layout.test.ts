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
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    const geocodes: string[] = [], searches: any[] = [];
    let releaseGeocode: (() => void) | undefined, releaseSearch: (() => void) | undefined;
    page.on("pageerror", error => errors.push(error.message));
    await page.route(`**${prefix}/**`, async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/map-config")) {
        if (liveMap && process.env.GOOGLE_MAPS_BROWSER_API_KEY)
          return route.fulfill({ json: { browserKey: process.env.GOOGLE_MAPS_BROWSER_API_KEY } });
        // Explicitly exercise the usable list even when Google is unavailable.
        return route.fulfill({ status: 503, json: { error: "maps_not_configured" } });
      }
      if (path.endsWith("/geocode")) {
        const address = route.request().postDataJSON().address;
        geocodes.push(address);
        if (address === "Slow geocode") await new Promise<void>(resolve => { releaseGeocode = resolve; });
        const lat = address === "Empty fixture" ? 48.3 : address === "Slow geocode" ? 48.6
          : address.startsWith("New ") ? 48.7 : address === "Slow search" ? 48.8 : 48.19;
        const candidates = address === "Not found" ? [] : [{
          label: "GOOGLE ADDRESS FOR CONFIRMATION ONLY", point: { lat, lng: 17.04 }, approximate: address === "Approximate fixture",
        }];
        if (address === "Ambiguous fixture") candidates.push({
          label: "SECOND GOOGLE CONFIRMATION", point: { lat: 48.21, lng: 17.05 }, approximate: false,
        });
        return route.fulfill({ json: { candidates } });
      }
      if (path.endsWith("/search")) {
        const input = route.request().postDataJSON();
        searches.push(input);
        if (input.point.lat === 48.8) await new Promise<void>(resolve => { releaseSearch = resolve; });
        const results = input.point.lat === 48.3 && input.radiusKm < 50 ? []
          : input.point.lat === 48.7 ? fixtures.map(row => ({ ...row, name: `NEW ${row.name}` })) : fixtures;
        return route.fulfill({ json: { results, missingLocations: 3 } });
      }
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
      const root=createRoot(mount);
      let finderProps=${JSON.stringify(props)};
      window.__finderRender=(changes={})=>{finderProps={...finderProps,...changes};root.render(React.createElement(Dialog,{open:true},
        React.createElement(DialogContent,{className:'pf-host-dialog z-[10050]',overlayClassName:'z-[10040]'},
          React.createElement(DialogTitle,{className:'sr-only'},'Test'),
          React.createElement(ProviderFinder,{...finderProps,
            onSelect:async(selection)=>{if(window.__finderFailSave)throw new Error('Fixture save failure');window.__finderSelection=selection;},
            onClose:()=>{window.__finderClosed=true;}
          }))));};
      window.__finderRender();
    })()`);
    const finder = page.getByTestId("provider-finder");
    await finder.waitFor();
    if (viewport.width < 761) await finder.locator(".atlas-mobile-nav button").nth(1).click();
    await finder.locator(".atlas-result-card").first().waitFor();
    assert.equal(await finder.locator(".atlas-result-card").count(), 7, "automatic search needs no first click");
    assert.equal(await finder.locator(".is-recommended").count(), publicView ? 0 : 2,
      "recommendation highlighting follows real tiers and is never exposed publicly");
    if (publicView)
      assert.equal(await finder.locator(".atlas-evidence-summary, .atlas-tier, .atlas-score-note").count(), 0, "no internal evidence in public UI");
    assert.equal(await finder.getByText("GOOGLE ADDRESS FOR CONFIRMATION ONLY", { exact: true }).count(), 0);
    const first = finder.locator(".atlas-result-card").first();
    assert.ok((await first.innerText()).includes("Ambulancia Harmónia"), "preserve API ranking");
    const visibleBox = await first.boundingBox();
    const footerBox = await finder.locator(".pf-modal-foot").boundingBox();
    assert.ok(visibleBox && footerBox && visibleBox.y >= 0 && visibleBox.y + Math.min(visibleBox.height, 90) <= footerBox.y,
      `first result is usable above the footer at ${viewport.width}x${viewport.height}`);
    assert.ok(footerBox.y + footerBox.height <= viewport.height + 1, "footer remains in viewport");
    assert.equal(await finder.locator(".atlas-confirm").isDisabled(), true);
    await finder.locator(".atlas-result-card").nth(3).locator(".atlas-card-main").click();
    assert.equal(await finder.locator("#pf-selected-person option[value='']").count(), 0, "a required person cannot be cleared");
    assert.equal(await finder.locator("#pf-selected-person").inputValue(), "layout-person", "required person is resolved from the selected result");
    await finder.locator("#pf-selected-person").selectOption("layout-person");
    assert.equal(await finder.locator(".atlas-confirm").isDisabled(), false);
    await first.locator(".atlas-card-main").click();
    if (liveMap && viewport.width >= 1280) {
      const marker = finder.locator(".pf-map-marker").filter({ hasText: "2" });
      await marker.waitFor({ state: "visible", timeout: 30000 });
      await marker.click();
      assert.equal(await finder.locator(".atlas-result-card").nth(1).locator(".atlas-card-main").getAttribute("aria-pressed"), "true",
        "live Google marker selects the matching candidate");
      await first.locator(".atlas-card-main").click();
    }
    await finder.locator(".atlas-confirm").click();
    const selection = await page.evaluate(() => (window as any).__finderSelection);
    assert.equal(selection.id, "layout-0", "actual selection callback");
    assert.equal(selection.country, "SK");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "no page horizontal overflow");
    await page.screenshot({ path: `${output}/finder-${publicView ? "public-" : ""}${viewport.width}.jpg` });
    if (viewport.width === 1440) {
      await page.evaluate(() => document.documentElement.classList.add("dark"));
      await page.screenshot({ path: `${output}/finder-dark.jpg` });
      await page.evaluate(() => document.documentElement.classList.remove("dark"));
      const edit = async (address: string) => {
        if (!await finder.locator("#pf-address").isVisible()) await finder.locator(".atlas-edit-button").click();
        await finder.locator("#pf-address").fill(address);
        const focusStyle = await finder.locator("#pf-address").evaluate(element => {
          const input = getComputedStyle(element);
          const field = getComputedStyle(element.parentElement!);
          return { outline: input.outlineStyle, border: input.borderTopWidth, shadow: field.boxShadow, fieldBorder: field.borderTopWidth };
        });
        assert.deepEqual(focusStyle, { outline: "none", border: "0px", shadow: "none", fieldBorder: "1px" },
          "focused address has only one thin wrapper border, never a second inner outline");
        if (address === "Ambiguous fixture") await page.screenshot({ path: `${output}/finder-edit-focus.jpg` });
        await finder.locator("#pf-address").press("Enter");
      };
      const rerender = async (initialAddress: string) =>
        page.evaluate(address => (window as any).__finderRender({ initialAddress: address }), initialAddress);
      const waitResults = async () => {
        await finder.locator(".atlas-result-card").first().waitFor({ state: "visible" });
        await page.waitForFunction(() => document.querySelector(".atlas-modal")?.getAttribute("aria-busy") === "false");
      };
      const radius = (value: string) => finder.locator("#pf-radius").evaluate((input, next) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, next);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
      let searchCount = searches.length;
      await edit("Ambiguous fixture");
      await finder.locator(".atlas-candidate").nth(1).waitFor();
      assert.equal(searches.length, searchCount, "ambiguous addresses never trigger an automatic nearby search");
      assert.equal(await finder.getByTestId("provider-results-map").count(), 0, "formatted Google candidates never appear beside a map");
      assert.equal(await finder.locator(".atlas-edit-panel").count(), 0, "confirmation is not covered by the edit panel");
      await page.screenshot({ path: `${output}/finder-address-confirmation.jpg` });
      await finder.locator(".atlas-candidate").nth(1).click();
      await waitResults();
      assert.equal(searches.at(-1).point.lat, 48.21, "use exactly the explicitly confirmed location");
      assert.equal(await finder.getByText("SECOND GOOGLE CONFIRMATION", { exact: true }).count(), 0);
      searchCount = searches.length;
      await edit("Approximate fixture");
      await finder.locator(".atlas-candidate").waitFor();
      assert.equal(searches.length, searchCount, "a single approximate candidate still needs confirmation");
      assert.equal(await finder.getByTestId("provider-results-map").count(), 0);
      await finder.locator(".atlas-candidate").click();
      await waitResults();
      await edit("Not found");
      await finder.locator(".atlas-inline-error").waitFor();
      assert.equal(await finder.locator(".atlas-result-card").count(), 0);
      assert.equal(await finder.getByTestId("provider-results-map").count(), 0, "do not keep the previous location after a failed address");
      assert.equal(await finder.locator(".atlas-confirm").isDisabled(), true);
      await edit("Recovered precise fixture");
      await waitResults();
      await first.locator(".atlas-card-main").click();
      await finder.locator(".atlas-edit-button").click();
      await finder.locator(".atlas-type-options button").nth(0).click();
      await finder.locator(".atlas-type-options button").nth(1).click();
      searchCount = searches.length;
      await finder.locator(".atlas-primary-button").click();
      await finder.locator(".atlas-inline-error").waitFor();
      assert.equal(searches.length, searchCount, "invalid filters are not submitted");
      assert.equal(await finder.locator(".atlas-confirm").isDisabled(), true);
      await finder.locator(".atlas-edit-actions .atlas-quiet-button").last().click();
      assert.equal(await finder.locator(".atlas-confirm").isDisabled(), false, "cancel restores the committed selection");
      const geocodeCount = geocodes.length;
      await finder.locator(".atlas-edit-button").click();
      await radius("50");
      await finder.locator(".atlas-person-toggle input").check();
      await finder.locator(".atlas-person-edit > input").fill("Test");
      await finder.locator(".atlas-primary-button").click();
      await waitResults();
      assert.equal(geocodes.length, geocodeCount, "filter edits reuse the confirmed origin");
      assert.equal(searches.at(-1).radiusKm, 50);
      assert.equal(searches.at(-1).peopleOnly, true);
      assert.equal(searches.at(-1).personQuery, "Test");
      await finder.locator(".atlas-edit-button").click();
      await radius("25");
      await edit("Empty fixture");
      await finder.locator(".atlas-empty").waitFor();
      await finder.locator(".atlas-empty button").last().click();
      await waitResults();
      assert.equal(searches.at(-1).radiusKm, 50, "empty results can expand the radius without another address lookup");
      const beforeMissing = geocodes.length;
      await rerender("");
      await finder.locator("#pf-address").waitFor();
      assert.equal(geocodes.length, beforeMissing, "missing customer addresses do not send meaningless lookups");
      assert.equal(await finder.locator(".atlas-result-card").count(), 0);
      const slowGeocode = page.waitForRequest(request => request.url().endsWith("/geocode") && request.postDataJSON().address === "Slow geocode");
      await rerender("Slow geocode");
      await slowGeocode;
      await rerender("New exact");
      await waitResults();
      assert.match(await first.innerText(), /NEW /);
      releaseGeocode?.();
      assert.equal(searches.some(search => search.point.lat === 48.6), false, "aborted old geocodes cannot start a search");
      const slowSearch = page.waitForRequest(request => request.url().endsWith("/search") && request.postDataJSON().point.lat === 48.8);
      await rerender("Slow search");
      await slowSearch;
      await rerender("New final");
      await waitResults();
      releaseSearch?.();
      assert.match(await first.innerText(), /NEW /, "late results cannot replace the current customer's results");
      assert.equal(await finder.locator(".atlas-confirm").isDisabled(), true, "changing customers invalidates the old selection");
      await first.locator(".atlas-card-main").click();
      await page.evaluate(() => { (window as any).__finderFailSave = true; });
      await finder.locator(".atlas-confirm").click();
      await finder.locator(".atlas-live-error").waitFor();
      assert.equal(await finder.locator(".atlas-confirm").isDisabled(), false, "a failed save remains visible and retryable");
      console.log("PASS lifecycle: ambiguity, approximate/invalid/missing addresses, correction, filter validation, radius recovery, cancellation, scope races and failed-save recovery");
    }
    assert.deepEqual(errors, [], "no browser exceptions");
    console.log(`PASS ${publicView ? "public" : "internal"} ${viewport.width}x${viewport.height}: real Dialog, automatic search, ranking, visible candidate, person requirement, selection, footer, privacy, no overflow`);
    await context.close();
  }
} finally {
  await browser.close();
}
