import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Use the real readiness component, with only external SIP registration
  // replaced at the browser module boundary. Never place real calls in tests.
  await page.route("**/contexts/sip-context.tsx*", route => route.fulfill({
    contentType: "application/javascript",
    body: "export function useSip(){return {isRegistered:false,ensureRegistered:async()=>false}}",
  }));
  await page.addInitScript(() => {
    localStorage.setItem("locale", "en");
  });
});

test("initial required readiness has one clear start action and a working exit on desktop and mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/test-fixtures/pulse-readiness.html");
    await expect(page.getByTestId("button-pulse-start")).toBeVisible();
    await expect(page.getByTestId("button-pulse-retry")).toHaveCount(0);
    await expect(page.getByTestId("button-pulse-continue")).toHaveCount(0);
    const dialog = page.getByTestId("nexus-pulse-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("opacity", "1");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/pulse-readiness-intro-${width}.png`, animations: "disabled" });
    await page.getByTestId("button-pulse-return").click();
    await expect(page.getByTestId("returned-to-indexus")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("starting the actual diagnostic run removes start and does not offer premature continuation", async ({ page }) => {
  await page.goto("/test-fixtures/pulse-readiness.html");
  await page.getByTestId("button-pulse-start").click();
  await expect(page.getByTestId("button-pulse-start")).toHaveCount(0);
  await expect(page.getByTestId("button-pulse-continue")).toHaveCount(0);
  await expect(page.getByTestId("button-pulse-retry")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/pulse-readiness-running.png" });
});