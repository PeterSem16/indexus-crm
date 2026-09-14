import { expect, test, type Page } from "@playwright/test";

type SavedViewPayload = {
  name: string;
  module: string;
  filters: string;
  isDefault: boolean;
};

type SavedView = SavedViewPayload & { id: string };

async function installSavedSearchApi(page: Page) {
  const savedViews: SavedView[] = [];
  const writes: SavedViewPayload[] = [];
  let nextId = 1;

  await page.route("**/api/saved-searches**", async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(savedViews),
      });
      return;
    }

    const body = JSON.parse(request.postData() || "{}") as SavedViewPayload;
    writes.push(body);

    if (request.method() === "POST") {
      const saved = { ...body, id: `fixture-view-${nextId++}` };
      savedViews.push(saved);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(saved),
      });
      return;
    }

    const id = url.pathname.split("/").pop();
    const existing = savedViews.findIndex(view => view.id === id);
    if (request.method() === "PATCH" && existing >= 0) {
      savedViews[existing] = { ...savedViews[existing], ...body };
    }
    if (request.method() === "DELETE" && existing >= 0) {
      savedViews.splice(existing, 1);
    }
    await route.fulfill({ status: 204, body: "" });
  });

  return { savedViews, writes };
}

async function openFixture(
  page: Page,
  viewport: { width: number; height: number },
  expectResults = viewport.width > 680,
) {
  await page.setViewportSize(viewport);
  await page.goto("/test-fixtures/priority-builder.html");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Add group" })).toBeVisible();
  if (expectResults) {
    await expect(page.getByText("Live results")).toBeVisible();
  } else {
    await expect(page.getByText("Live results")).toBeHidden();
  }
}

test("approved desktop shell keeps header, controls, full-width rows, and four presets", async ({ page }) => {
  const api = await installSavedSearchApi(page);
  await openFixture(page, { width: 1280, height: 720 });

  const dialog = page.getByRole("dialog");
  await expect.poll(async () => (await dialog.boundingBox())?.width || 0).toBe(880);
  await expect.poll(async () => (await dialog.boundingBox())?.height || 0).toBe(532);

  const results = page.locator(".priority-builder-results");
  const row = page.locator(".priority-builder-contact").first();
  const resultsBox = await results.boundingBox();
  const rowBox = await row.boundingBox();
  expect(resultsBox).not.toBeNull();
  expect(rowBox).not.toBeNull();
  expect(rowBox!.width).toBeGreaterThanOrEqual(resultsBox!.width - 28);
  expect(await page.locator(".priority-builder-contact").count()).toBeGreaterThanOrEqual(5);
  await page.screenshot({ path: "/tmp/priority-desktop.png" });

  const presets = [
    ["referral_first", "Referral"],
    ["todays_callbacks", "Scheduled today"],
    ["fresh_opportunities", "New contacts"],
    ["recovery_desk", "Unhandled / missed"],
  ] as const;
  const presetPicker = page.getByRole("combobox", { name: "Active view" });
  for (const [value, firstGroup] of presets) {
    await presetPicker.selectOption(value);
    await expect(presetPicker).toHaveValue(value);
    await expect(page.locator(".priority-builder-group").first()).toContainText(firstGroup);
  }
  expect(api.writes.filter(write => write.isDefault)).toHaveLength(4);
});

test("Add group creates a draft, custom save omits presetId, and close works", async ({ page }) => {
  const api = await installSavedSearchApi(page);
  await openFixture(page, { width: 1280, height: 720 });

  const addGroup = page.getByRole("combobox", { name: "Add group" });
  await addGroup.selectOption({ label: "My scheduled" });
  await expect(page.getByRole("combobox", { name: "Active view" })).toHaveValue("__draft__");
  await expect(page.locator(".priority-builder-group").last()).toContainText("My scheduled");

  const viewName = page.getByRole("textbox", { name: "Saved view name" });
  await viewName.fill("Fixture custom queue");
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("status")).toContainText("Saved to Contacts");

  const customWrite = api.writes.at(-1);
  expect(customWrite).toBeDefined();
  expect(customWrite!.name).toBe("Fixture custom queue");
  expect(JSON.parse(customWrite!.filters)).not.toHaveProperty("presetId");

  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("priority-fixture-closed")).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("approved mobile shell fits the viewport and keeps Add group visible", async ({ page }) => {
  await installSavedSearchApi(page);
  await openFixture(page, { width: 390, height: 844 });

  const dialog = page.getByRole("dialog");
  await expect.poll(async () => (await dialog.boundingBox())?.width || 0).toBe(374);
  await expect.poll(async () => (await dialog.boundingBox())?.height || 0).toBe(828);
  await expect(page.getByRole("combobox", { name: "Add group" })).toBeVisible();
  await expect(page.getByText("Live results")).toBeHidden();

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(horizontalOverflow).toBe(false);
  await page.screenshot({ path: "/tmp/priority-mobile.png" });
});