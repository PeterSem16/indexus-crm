import { expect, test, type Page } from "@playwright/test";

type SavedView = {
  id: string;
  name: string;
  module: string;
  filters: string;
  isDefault: boolean;
};

const cityRankingPayload = {
  cities: [
    { key: "SK:bratislava", city: "Bratislava", countryCode: "SK" },
    { key: "CZ:zilina", city: "Žilina", countryCode: "CZ" },
  ],
};

// Keep the active view persisted so this spec exercises reopening a real saved
// city-grouped view, rather than relying on the editor's initial local draft.
const persistedManyCitiesView: SavedView = {
  id: "many-cities-view",
  name: "Many cities fixture",
  module: "agent-priority-builder",
  isDefault: true,
  filters: JSON.stringify({
    version: 1,
    name: "Many cities fixture",
    segments: [
      { id: "new", sort: "created_desc", referralsFirst: true },
    ],
    cityGrouping: {
      enabled: true,
      rankedKeys: cityRankingPayload.cities.map(city => city.key),
      unknownKeys: [],
      mode: "all",
      selectedKeys: [],
    },
  }),
};

async function installManyCitiesApis(page: Page) {
  await page.route("**/api/saved-searches**", async route => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([persistedManyCitiesView]),
      });
      return;
    }
    await route.fulfill({ status: 204, body: "" });
  });
  await page.route("**/api/agent/priority-builder/city-ranking", async route => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        rankedKeys: cityRankingPayload.cities.map(city => city.key),
        unknownKeys: [],
      }),
    });
  });
}

async function openManyCitiesFixture(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("/test-fixtures/priority-builder.html?many-cities=1");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByTestId("toggle-priority-city-grouping")).toBeChecked();
  await expect(page.locator(".priority-builder-section-head .priority-builder-total")).toContainText("225 eligible contacts");
  await page.getByTestId("priority-city-mode-selected").check();
  await expect(page.getByTestId("priority-city-options")).toBeVisible();
  await expect(page.getByTestId("priority-city-option-SK:bratislava")).toBeVisible();
}

function selectedCount(page: Page) {
  return page.locator(".priority-builder-city-selected-count strong");
}

test("bounded city picker searches accents and keeps global bulk actions", async ({ page }) => {
  await installManyCitiesApis(page);
  await openManyCitiesFixture(page, 1280, 720);

  const dialog = page.getByRole("dialog");
  const options = page.getByTestId("priority-city-options");
  const footer = page.locator(".priority-builder-save");
  const mobileControls = page.locator(".priority-builder-mobile-controls");
  await expect(options.locator("input[type=checkbox]")).toHaveCount(225);
  await expect(footer).toBeVisible();
  await expect(mobileControls).toBeHidden();

  const dialogBox = await dialog.boundingBox();
  const optionsBox = await options.boundingBox();
  const footerBox = await footer.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(optionsBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(optionsBox!.height).toBeGreaterThanOrEqual(130);
  expect(optionsBox!.height).toBeLessThan(340);
  expect(optionsBox!.y + optionsBox!.height).toBeLessThanOrEqual(footerBox!.y + 1);
  expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height + 1);

  const lastOption = options.locator("input[type=checkbox]").last();
  await lastOption.scrollIntoViewIfNeeded();
  await expect(lastOption).toBeVisible();
  await lastOption.check();
  await expect(selectedCount(page)).toHaveText("1 / 225");
  await expect(page.locator(".priority-builder-card")).toHaveCount(1);

  const citySearch = page.getByTestId("priority-city-search");
  await citySearch.fill("zilina");
  await expect(options.locator("input[type=checkbox]")).toHaveCount(1);
  await expect(options).toContainText("Žilina");

  // Select-all is intentionally global, not limited to the current search.
  await page.getByTestId("priority-city-select-all").click();
  await expect(selectedCount(page)).toHaveText("225 / 225");
  await expect(page.locator(".priority-builder-card")).toHaveCount(225);
  await page.getByTestId("priority-city-clear").click();
  await expect(selectedCount(page)).toHaveText("0 / 225");
  await expect(page.locator(".priority-builder-card")).toHaveCount(0);
  await expect(options.locator("input[type=checkbox]:checked")).toHaveCount(0);

  await citySearch.fill("this-city-does-not-exist");
  await expect(options.locator("input[type=checkbox]")).toHaveCount(0);
  await expect(options).toContainText("No matching cities");
  // Keep the no-match assertion above, but make the desktop artifact useful
  // for visual review: show the populated list at its top with checked rows.
  await citySearch.fill("");
  await expect(options.locator("input[type=checkbox]")).toHaveCount(225);
  for (const index of [0, 1, 2]) {
    await options.locator("input[type=checkbox]").nth(index).check();
  }
  await options.evaluate(element => { element.scrollTop = 0; });
  await expect(options).toHaveJSProperty("scrollTop", 0);
  await expect(options.locator("input[type=checkbox]:checked")).toHaveCount(3);
  await page.screenshot({ path: "/tmp/pulse-city-picker-desktop.png", fullPage: true });
});

test("city picker and footer remain visible on the mobile fullscreen ancestor", async ({ page }) => {
  await installManyCitiesApis(page);
  await openManyCitiesFixture(page, 390, 844);

  const dialog = page.getByRole("dialog");
  const options = page.getByTestId("priority-city-options");
  const footer = page.locator(".priority-builder-save");
  const mobileControls = page.locator(".priority-builder-mobile-controls");
  await expect(mobileControls).toBeVisible();
  await expect(footer).toBeVisible();
  await expect(options.locator("input[type=checkbox]")).toHaveCount(225);

  const dialogBox = await dialog.boundingBox();
  const footerBox = await footer.boundingBox();
  const optionsBox = await options.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(optionsBox).not.toBeNull();
  expect(optionsBox!.height).toBeGreaterThanOrEqual(90);
  expect(optionsBox!.height).toBeLessThan(300);
  expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height + 1);
  // Retain the end-of-list accessibility check, then return to a populated
  // top-of-list view for the mobile visual artifact.
  await options.locator("input[type=checkbox]").last().scrollIntoViewIfNeeded();
  await expect(options.locator("input[type=checkbox]").last()).toBeVisible();
  for (const index of [0, 1]) {
    await options.locator("input[type=checkbox]").nth(index).check();
  }
  await options.evaluate(element => { element.scrollTop = 0; });
  await expect(options).toHaveJSProperty("scrollTop", 0);
  await expect(options.locator("input[type=checkbox]:checked")).toHaveCount(2);
  await page.screenshot({ path: "/tmp/pulse-city-picker-mobile.png", fullPage: true });
});