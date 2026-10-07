import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { loadAutomationTemplateLocales, localizeAutomationEmail, type AutomationEmailDefault } from "../server/lib/automation-template-locales";
import { automationEmailInlineAttachments } from "../server/lib/automation-email-assets";
import { loadAutomationCallTemplates } from "../server/lib/automation-call-templates";

test("all localized default and call email designs retain working artwork and fit desktop and mobile", async () => {
  const sources: AutomationEmailDefault[] = JSON.parse(await readFile("server/assets/automation-email/templates.json", "utf8"));
  const locales = await loadAutomationTemplateLocales();
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const calls = await loadAutomationCallTemplates();
    for (const { language, templates } of calls) {
      for (const { email } of templates) {
        const image = (await automationEmailInlineAttachments(email.contentHtml))[0];
        const html = email.contentHtml.replace(`cid:${image.contentId}`, `data:${image.contentType};base64,${image.contentBytes}`);
        for (const width of [760, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await page.setContent(html);
          await expect(page.locator("h1")).toHaveText(email.name);
          assert.equal(await page.locator("html").getAttribute("lang"), language);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, `${email.id}/${width}`);
          await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
          if (language === "sk" && email.id.endsWith("inbound-missed") && width === 760) {
            await page.screenshot({ path: "/tmp/automation-email-call-sk-desktop.png", fullPage: true });
          }
        }
      }
    }
    for (const locale of locales) {
      for (const source of sources) {
        const template = localizeAutomationEmail(source, locale);
        let html = template.contentHtml;
        for (const image of await automationEmailInlineAttachments(html)) {
          html = html.replace(`cid:${image.contentId}`, `data:${image.contentType};base64,${image.contentBytes}`);
        }
        for (const width of [760, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await page.setContent(html);
          await expect(page.locator("h1")).toBeVisible();
          await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
          assert.equal(await page.locator("html").getAttribute("lang"), locale.language);
          assert.equal(await page.title(), locale.email[source.id.replace("indexus-automation-email-", "")].texts[0]);
          assert.equal(await page.locator("img").getAttribute("alt"), locale.email[source.id.replace("indexus-automation-email-", "")].artworkAlt);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true,
            `${locale.language}/${source.id} overflows at ${width}px`);
          const button = page.locator("[title]").last();
          await expect(button).toHaveAttribute("title", locale.linkTitle);
          const bounds = await button.boundingBox();
          assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
          if (locale.language === "en" && source.id.endsWith("new-task") && width === 760) {
            await page.screenshot({ path: "/tmp/automation-email-localized-en-desktop.png", fullPage: true });
          }
          if (locale.language === "de" && source.id.endsWith("data-change") && width === 390) {
            await page.screenshot({ path: "/tmp/automation-email-localized-de-mobile.png", fullPage: true });
          }
        }
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
