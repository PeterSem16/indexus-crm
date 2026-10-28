import assert from "node:assert/strict";
import test from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { readFileSync } from "node:fs";
import { getStatusListRecapCopy } from "../client/src/components/status-list-recap-copy";

test("real batch dialog: callback editing, safe cancellation, DST, themes, locales and narrow screens", async () => {
  const server = await createServer({ configFile: "vite.config.ts", logLevel: "error",
    cacheDir: "/tmp/indexus-batch-save-vite-cache",
    server: { host: "127.0.0.1", port: 4189, strictPort: true } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({ timezoneId: "America/Los_Angeles" });
    const page = await context.newPage();
    const errors: string[] = [], writes: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {
      if (!["GET", "HEAD"].includes(request.method())) writes.push(`${request.method()} ${request.url()}`);
    });
    await page.clock.install({ time: new Date("2026-10-23T07:00:00.000Z") });
    const base = "http://127.0.0.1:4189/test-fixtures/status-list-batch-save.html";
    const confirm = page.getByTestId("btn-sl-batch-save-confirm");
    const result = async () => JSON.parse((await page.getByTestId("batch-result").textContent())!);
    await page.goto(`${base}?empty`, { waitUntil: "networkidle" });
    await expect(confirm).toBeDisabled();
    await expect(page.getByTestId("status-list-batch-callback-rescheduler")).toBeVisible();
    assert.equal(await page.locator('input[type="date"], input[type="time"], input[type="datetime-local"]').count(), 0);
    assert.equal((await result()).commits, 0);
    await page.getByRole("button", { name: "+1 pracovný deň", exact: true }).click();
    await expect(confirm).toBeEnabled();
    await page.getByTestId("status-list-batch-callback-hour").selectOption("13");
    await page.getByTestId("status-list-batch-callback-minute").selectOption("17");
    await page.locator("textarea").fill("Presný čas 13:17.");
    await expect(page.locator(".sl-batch-callback-summary")).toContainText("13:17");
    await expect(page.locator(".sl-batch-callback-summary")).toContainText("2026");
    await expect(page.locator(".sl-batch-callback-summary")).toContainText("Presný čas 13:17.");
    await confirm.click();
    assert.deepEqual(await result(), {
      commits: 1, cancelled: false, action: "reschedule", date: "2026-10-26T12:17:00.000Z", note: "Presný čas 13:17.",
    });
    await page.goto(`${base}?date=2026-10-23T08%3A30%3A00.000Z`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "+1 pracovný deň", exact: true }).click();
    await confirm.click();
    assert.equal((await result()).date, "2026-10-26T09:30:00.000Z", "preserve Bratislava 10:30 across DST and skip weekend");
    for (const action of ["rules", "do_not_call"]) {
      await page.goto(base, { waitUntil: "networkidle" });
      await page.locator(`.sl-batch-action`).nth(action === "rules" ? 0 : 2).click();
      await expect(page.getByTestId("status-list-batch-callback-rescheduler")).toHaveCount(0);
      await confirm.click();
      assert.equal((await result()).action, action);
      assert.equal((await result()).commits, 1);
    }
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator("textarea").fill("Zrušený koncept");
    await page.getByTestId("btn-sl-batch-save-cancel").click();
    assert.equal((await result()).commits, 0);
    assert.equal((await result()).cancelled, true);
    for (const locale of ["sk", "en", "cs", "hu", "ro", "it", "de"]) {
      await page.goto(`${base}?locale=${locale}`, { waitUntil: "networkidle" });
      await expect(page.locator(".sl-batch-note > span")).toHaveText(getStatusListRecapCopy(locale).callbackNote);
    }
    for (const [width, height, dark] of [[1280, 720, false], [1024, 550, true], [390, 740, false], [360, 520, true]] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(`${base}?${dark ? "dark" : ""}`, { waitUntil: "networkidle" });
      const dialog = page.getByRole("dialog");
      await expect(confirm).toBeInViewport();
      const bounds = await dialog.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1 &&
        bounds.y + bounds.height <= height + 1, `${width}×${height}: dialog and footer must fit`);
      assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
      const columns = await page.locator(".sl-batch-content").evaluate(el => getComputedStyle(el).gridTemplateColumns);
      if (width >= 701) {
        assert.equal(columns.trim().split(/\s+/).length, 2, "desktop has two columns");
        const left = await page.locator(".sl-batch-left").boundingBox();
        const right = await page.locator(".sl-batch-right").boundingBox();
        assert.ok(left && right && left.x + left.width <= right.x, "selection stays left of editor");
      } else {
        assert.equal(await page.locator(".sl-batch-content").evaluate(el => getComputedStyle(el).display), "flex");
      }
      if (await page.locator(".sl-batch-callback-summary").count()) {
        const summary = await page.locator(".sl-batch-callback-summary").boundingBox();
        const footer = await page.locator(".sl-batch-footer").boundingBox();
        assert.ok(summary && footer && summary.y + summary.height <= footer.y + 1, "date/time summary stays above actions");
      }
    }
    assert.deepEqual(writes, [], "no network mutations while opening, editing or cancelling the dialog");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});

test("desktop and mobile both use the shared dialog without changing their save handlers", () => {
  const source = readFileSync("client/src/pages/agent-workspace.tsx", "utf8");
  assert.equal((source.match(/<StatusListBatchSaveDialog\b/g) || []).length, 2);
  assert.ok(source.includes("onConfirm={handleSlBatchSaveConfirm}"), "desktop keeps its existing save handler");
  assert.ok(source.includes("onConfirm={handleMobileBatchSaveConfirm}"), "mobile keeps its existing save handler");
});
