import assert from "node:assert/strict";
import test from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { getStatusListHelpExamples, exampleChapterIds } from "../client/src/components/status-list-help-examples";
import { getStatusListHelpCopy, statusListHelpSectionIds } from "../client/src/components/status-list-help-copy";

const locales = ["sk", "en", "cs", "hu", "ro", "it", "de"];

test("detailed help examples have complete translated chapters and preserved Slovak recipes", () => {
  assert.equal(new Set(statusListHelpSectionIds).size, statusListHelpSectionIds.length);
  for (const locale of locales) {
    const chapters = getStatusListHelpExamples(locale);
    for (const key of exampleChapterIds) {
      assert.deepEqual(getStatusListHelpCopy(locale).sections[key], chapters[key]);
      assert.ok(chapters[key].title.trim());
      assert.ok(chapters[key].paragraphs.every(text => text.trim().length > 30));
      assert.equal(chapters[key].examples.length, key === "healthcareExamples" ? 6 : 4);
      for (const example of chapters[key].examples) {
        assert.ok(example.title.trim());
        assert.ok(example.paragraphs.length >= 2);
        assert.ok(example.paragraphs.every(text => text.trim()));
      }
    }
    if (locale !== "en") assert.notEqual(chapters.healthcareExamples.title, getStatusListHelpExamples("en").healthcareExamples.title);
  }
  const { healthcareExamples, previousAutomationExamples } = getStatusListHelpExamples("sk");
  assert.ok(healthcareExamples.examples[0].paragraphs.includes(
    "Príklad nadväzujúcej automatizácie:\nKEĎ: aktivuje sa odpoveď Reachable\nPOTOM: odošli interné oznámenie\n„Kontakt je opäť dosiahnuteľný.“"));
  assert.match(healthcareExamples.examples[1].paragraphs.join(" "), /nahlásené číslo/);
  assert.match(healthcareExamples.examples[1].paragraphs.join(" "), /správnemu poskytovateľovi alebo personálu/);
  assert.doesNotMatch(healthcareExamples.examples[1].paragraphs.join(" "), /Navrhnutý nový kontakt/);
  assert.match(healthcareExamples.examples[2].paragraphs.join(" "), /Neúspešné pokusy ≥ 5/);
  assert.match(healthcareExamples.examples[5].paragraphs.join(" "), /predchádzajúci stav bol Wrong number/);
  assert.match(previousAutomationExamples.examples[0].paragraphs.join(" "), /6 pracovných dní o 09:00/);
  assert.equal(getStatusListHelpExamples("unknown"), getStatusListHelpExamples("en"));
});

test("help examples render and search in seven languages, mobile and dark mode without mutations", async () => {
  const vite = await createServer({
    configFile: false, root: "client", cacheDir: "/tmp/indexus-help-examples-vite-cache",
    resolve: { alias: { "@": `${process.cwd()}/client/src`, "@shared": `${process.cwd()}/shared` } },
    esbuild: { jsx: "automatic" }, server: { host: "127.0.0.1", port: 0 }, logLevel: "error",
  });
  await vite.listen();
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    for (const locale of locales) {
      const page = await browser.newPage({ viewport: { width: locale === "sk" ? 390 : 1200, height: 860 } });
      const errors: string[] = [], mutations: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("request", request => {
        if (!["GET", "HEAD"].includes(request.method())) mutations.push(request.method() + " " + request.url());
      });
      await page.route("**/test-fixtures/help.html*", route => route.fulfill({
        contentType: "text/html",
        body: '<html><body><div id="root"></div><script type="module" src="/test-fixtures/status-list-help.tsx"></script></body></html>',
      }));
      const port = (vite.httpServer!.address() as { port: number }).port;
      await page.goto(`http://127.0.0.1:${port}/test-fixtures/help.html?locale=${locale}${locale === "sk" ? "&dark" : ""}`,
        { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.getByTestId("status-list-help-open").click();
      const chapters = getStatusListHelpExamples(locale);
      const article = page.getByTestId("status-list-help-article");
      for (const key of exampleChapterIds) {
        await page.getByTestId(`status-list-help-chapter-${key}`).click();
        await expect(article.getByRole("heading", { name: chapters[key].title, exact: true })).toBeVisible();
        await expect(article.locator(".status-list-help-example")).toHaveCount(chapters[key].examples.length);
        const text = await article.textContent();
        for (const example of chapters[key].examples) {
          assert.ok(text?.includes(example.title));
          for (const paragraph of example.paragraphs) assert.ok(text?.includes(paragraph), `${locale}: complete paragraph missing`);
        }
      }
      // Search must include the nested recipes, not only the chapter introduction.
      const deepText = chapters.previousAutomationExamples.examples[3].paragraphs.at(-1)!;
      await page.getByTestId("status-list-help-search").fill(deepText);
      await expect(page.getByTestId("status-list-help-chapter-previousAutomationExamples")).toBeVisible();
      await expect(page.getByTestId("status-list-help-chapter-healthcareExamples")).toHaveCount(0);
      await expect(article).toContainText(deepText);
      await page.getByTestId("status-list-help-search").fill("zzzz-no-help-example-678901");
      await expect(article.getByRole("status")).toHaveText(getStatusListHelpCopy(locale).empty);
      await page.getByTestId("status-list-help-close").click();
      await page.getByTestId("status-list-help-open-healthcareExamples").click();
      await expect(page.getByTestId("status-list-help-search")).toHaveValue("");
      await expect(page.getByTestId("status-list-help-chapter-healthcareExamples")).toHaveAttribute("aria-current", "page");
      await expect(article.locator(".status-list-help-example")).toHaveCount(6);
      const recipe = article.getByTestId("status-list-help-example-1").locator("p").nth(1);
      assert.equal(await recipe.evaluate(element => getComputedStyle(element).whiteSpace), "pre-line");
      const bounds = await page.getByTestId("status-list-help-dialog").boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= (locale === "sk" ? 390 : 1200));
      assert.equal(await article.evaluate(element => element.scrollWidth > element.clientWidth), false);
      if (locale === "sk") {
        await recipe.scrollIntoViewIfNeeded();
        await page.screenshot({ path: "/tmp/status-list-help-examples-mobile.png" });
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(mutations, [], "help must not mutate data or execute actions");
      await page.close();
    }
  } finally {
    await browser.close();
    await vite.close();
  }
});
