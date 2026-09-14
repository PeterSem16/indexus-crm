import { expect, test, type Page } from "@playwright/test";

type SavedViewPayload = { name: string; module: string; filters: string; isDefault: boolean };
type SavedView = SavedViewPayload & { id: string };

async function installSavedSearchApi(page: Page, options: { failGets?: number; failWrites?: number; postDelayMs?: number } = {}) {
  const savedViews: SavedView[] = [];
  const writes: SavedViewPayload[] = [];
  const patchIds: string[] = [];
  let nextId = 1;
  let remainingGetFailures = options.failGets || 0;
  let remainingWriteFailures = options.failWrites || 0;
  await page.route("**/api/saved-searches**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET") {
      if (remainingGetFailures-- > 0) {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "fixture get failure" }) });
        return;
      }
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(savedViews) });
      return;
    }
    const body = JSON.parse(request.postData() || "{}") as SavedViewPayload;
    if (remainingWriteFailures-- > 0) {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "fixture write failure" }) });
      return;
    }
    if (request.method() === "POST") {
      if (options.postDelayMs) await new Promise(resolve => setTimeout(resolve, options.postDelayMs));
      writes.push(body);
      savedViews.forEach(view => { view.isDefault = false; });
      const saved = { ...body, id: `fixture-view-${nextId++}` };
      savedViews.push(saved);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(saved) });
      return;
    }
    const id = url.pathname.split("/").pop();
    const index = savedViews.findIndex(view => view.id === id);
    if (request.method() === "PATCH" && index >= 0) {
      writes.push(body);
      patchIds.push(id || "");
      if (body.isDefault) savedViews.forEach(view => { view.isDefault = false; });
      savedViews[index] = { ...savedViews[index], ...body };
    }
    if (request.method() === "DELETE" && index >= 0) savedViews.splice(index, 1);
    await route.fulfill({ status: 204, body: "" });
  });
  return { savedViews, writes, patchIds };
}

async function openFixture(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto("/test-fixtures/priority-builder.html");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
  if (viewport.width > 800) await expect(page.getByText("INDEXUS")).toBeVisible();
  else await expect(page.getByText("INDEXUS")).toBeHidden();
  await expect(page.getByRole("combobox", { name: "Add group" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Add group" })).toBeEnabled();
}

test("original desktop layout has Indexus sidebar, derived first-match counts, presets and search", async ({ page }) => {
  const api = await installSavedSearchApi(page);
  await openFixture(page, { width: 1280, height: 720 });

  const dialog = page.getByRole("dialog");
  await expect.poll(async () => (await dialog.boundingBox())?.width || 0).toBe(1216);
  await expect.poll(async () => (await dialog.boundingBox())?.height || 0).toBe(656);
  await expect(page.locator(".priority-builder-sidebar")).toBeVisible();
  await expect(page.getByText("Evaluation order")).toBeVisible();
  await expect(page.getByText("Live result")).toBeVisible();
  await expect(page.locator(".priority-builder-row").first()).toContainText("Referral");
  await expect(page.locator(".priority-builder-row").first().locator(".priority-builder-count")).toHaveText("2");
  await expect(page.locator(".priority-builder-section-head .priority-builder-total")).toContainText("8 eligible contacts");
  await expect(page.getByText("Deduplication active.")).toBeVisible();
  await expect(page.getByText("Why this order?")).toBeVisible();
  const previewBox = await page.locator(".priority-builder-preview").boundingBox();
  const firstResultBox = await page.locator(".priority-builder-card").first().boundingBox();
  expect(previewBox).not.toBeNull();
  expect(firstResultBox).not.toBeNull();
  expect(firstResultBox!.width).toBeGreaterThanOrEqual(previewBox!.width - 35); // 17px padding per side plus 1px border
  const firstCard = page.locator(".priority-builder-card").filter({ hasText: "Melichar" });
  await expect(firstCard).toContainText("Next up");
  await expect(firstCard).toContainText("Queue position 1");
  await expect(firstCard).toContainText("Group: Referral");
  await expect(firstCard).toContainText("Scheduled callback: Not scheduled");
  await expect(firstCard).toContainText("Call attempts in this Mission: 2");
  const secondReferral = page.locator(".priority-builder-card").filter({ hasText: "Tes AmbuMed" });
  await expect(secondReferral).toContainText("Queue position 2");
  await expect(secondReferral).toContainText("Group: Referral");
  await expect(secondReferral).not.toContainText("Next up");
  const scheduledCard = page.locator(".priority-builder-card").filter({ hasText: "Tes Klinika" });
  await expect(scheduledCard).toContainText("Group: Scheduled today");
  await expect(scheduledCard).toContainText("Call attempts in this Mission: No attempts");
  expect(await scheduledCard.textContent()).toMatch(/Scheduled callback:.*\d{4}/);
  const fallbackCard = page.locator(".priority-builder-card").filter({ hasText: "Tes Zdravotné" });
  await expect(fallbackCard).toContainText("Queue position 6");
  await expect(fallbackCard).toContainText("Group: Other eligible contacts");
  await expect(fallbackCard).toContainText("Call attempts in this Mission: Unknown");
  expect(await fallbackCard.textContent()).toMatch(/Scheduled callback:.*\d{4}/);
  await page.screenshot({ path: "/tmp/priority-clear-desktop.png" });

  for (const name of ["Referral first", "Today's callbacks", "Fresh opportunities", "Recovery desk"]) {
    await page.getByRole("button", { name }).last().click();
    await expect(page.locator(".priority-builder-side-item.active").last()).toContainText(name);
  }
  expect(api.writes.filter(write => write.isDefault)).toHaveLength(4);

  await page.getByRole("textbox", { name: "Search contacts" }).fill("Melichar");
  await expect(page.locator(".priority-builder-card")).toHaveCount(1);
  await expect(page.locator(".priority-builder-card")).toContainText("Melichar");
});

test("draft controls add, reorder, remove, reset, save, reopen and delete a personal view", async ({ page }) => {
  const api = await installSavedSearchApi(page);
  await openFixture(page, { width: 1280, height: 720 });

  const addGroup = page.getByRole("combobox", { name: "Add group" });
  await addGroup.selectOption({ label: "My scheduled" });
  await expect(page.locator(".priority-builder-row").last()).toContainText("My scheduled");
  await expect(page.getByRole("status")).toContainText("Unsaved changes");
  await expect(page.getByRole("button", { name: /Auto/ })).toBeDisabled();
  await expect(page.locator(".priority-builder-queue-hint:visible")).toHaveText("Save changes before Auto or Next use this order.");
  await page.getByRole("button", { name: "Move group up" }).last().click();
  await expect(page.locator(".priority-builder-row").nth(2)).toContainText("My scheduled");
  await page.getByRole("button", { name: "More segment actions" }).last().click();
  await page.getByRole("button", { name: "Remove segment" }).click();
  await expect(page.locator(".priority-builder-row")).toHaveCount(3);

  await page.getByRole("textbox", { name: "Saved view name" }).fill("Fixture custom queue");
  await page.getByRole("button", { name: "Rename view" }).click();
  await expect(page.getByRole("textbox", { name: "Saved view name" })).toBeFocused();
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("status")).toContainText("Saved to Contacts");
  await expect(page.getByRole("button", { name: /Auto/ })).toBeEnabled();
  await expect.poll(() => api.savedViews.length).toBe(1);
  expect(api.savedViews[0].isDefault).toBe(true);
  expect(JSON.parse(api.savedViews[0].filters)).not.toHaveProperty("presetId");
  await expect(page.getByRole("button", { name: "Fixture custom queue" }).last()).toBeVisible();
  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.getByRole("textbox", { name: "Saved view name" })).toHaveValue("Fixture custom queue copy");

  await page.reload();
  await expect(page.getByRole("button", { name: "Fixture custom queue" }).last()).toBeVisible();
  await page.getByRole("button", { name: "Fixture custom queue" }).last().click();
  await expect(page.getByRole("button", { name: "Delete view" })).toBeVisible();
  await page.getByRole("button", { name: "Delete view" }).click();
  await expect.poll(() => api.savedViews.some(view => view.name === "Fixture custom queue")).toBe(false);

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.locator(".priority-builder-row")).toHaveCount(3);
  await expect(page.locator(".priority-builder-row").first()).toContainText("Referral");
});

test("original responsive mobile layout retains controls and delegates Auto and Next", async ({ page }) => {
  await installSavedSearchApi(page, { postDelayMs: 150 });
  await openFixture(page, { width: 390, height: 844 });

  const dialog = page.getByRole("dialog");
  await expect.poll(async () => (await dialog.boundingBox())?.width || 0).toBe(374);
  await expect.poll(async () => (await dialog.boundingBox())?.height || 0).toBe(828);
  await expect(page.locator(".priority-builder-sidebar")).toBeHidden();
  await expect(page.locator(".priority-builder-preview")).toBeHidden();
  await expect(page.getByRole("combobox", { name: "Add group" })).toBeVisible();
  const mobileViews = page.getByRole("combobox", { name: "Active view" });
  await expect(mobileViews).toBeVisible();
  await mobileViews.selectOption("fresh_opportunities");
  await expect(mobileViews).toHaveValue("fresh_opportunities");
  await expect(page.locator(".priority-builder-row").first()).toContainText("New contacts");
  await page.screenshot({ path: "/tmp/original-priority-production-mobile.png" });

  // The controls are parent callbacks in production; fixture state proves they are not mock actions.
  await expect(page.getByRole("button", { name: /Auto/ })).toBeDisabled();
  await expect(page.locator(".priority-builder-queue-hint:visible")).toHaveText("Save changes before Auto or Next use this order.");
  await expect(page.getByRole("button", { name: /Auto/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next contact" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save view" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
  // Wait for the selected preset to reach the authoritative parent queue, then use its callbacks.
  await expect(page.getByRole("button", { name: /Auto/ })).toBeEnabled();
  await page.getByRole("button", { name: /Auto/ }).click();
  await expect(page.getByTestId("priority-fixture-auto")).toHaveText("true");
  await page.getByRole("button", { name: "Next contact" }).click();
  await expect(page.getByTestId("priority-fixture-next-calls")).toHaveText("1");
  await expect(page.getByTestId("priority-fixture-next-contact")).toHaveText("new-2");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("priority-fixture-closed")).toBeVisible();
});

test("priority builder stays inside the viewport across desktop, tablet and mobile dimensions", async ({ page }) => {
  await installSavedSearchApi(page);
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
    { width: 1024, height: 600 },
    { width: 820, height: 600 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ];

  for (const viewport of viewports) {
    await openFixture(page, viewport);
    const dialog = page.getByRole("dialog");
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport.width);
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const addGroup = page.getByRole("combobox", { name: "Add group" });
    const save = page.getByRole("button", { name: "Save view" });
    await addGroup.scrollIntoViewIfNeeded();
    await expect(addGroup).toBeVisible();
    await expect(save).toBeVisible();
    if (viewport.height <= 600) {
      const editorMetrics = await page.locator(".priority-builder-editor").evaluate(element => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
      }));
      expect(editorMetrics.scrollHeight).toBeGreaterThan(editorMetrics.clientHeight);
      expect(editorMetrics.scrollTop).toBeGreaterThan(0);
    }
    const saveBox = await save.boundingBox();
    expect(saveBox).not.toBeNull();
    expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(viewport.height);
    await expect(page.getByRole("button", { name: "Close" })).toBeVisible();

    if (viewport.width === 1920) {
      await expect.poll(async () => (await dialog.boundingBox())?.width || 0).toBe(1856);
      await page.screenshot({ path: "/tmp/priority-clear-wide.png" });
    }
  }
});

test("saved-view load and write failures keep queue actions locked and expose retry", async ({ page }) => {
  await installSavedSearchApi(page, { failGets: 1, failWrites: 1 });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/test-fixtures/priority-builder.html");
  await expect(page.getByRole("alert")).toContainText("Saved views could not be loaded.");
  await expect(page.getByRole("button", { name: /Auto/ })).toBeDisabled();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("combobox", { name: "Add group" })).toBeEnabled();

  await page.getByRole("combobox", { name: "Add group" }).selectOption({ label: "My scheduled" });
  await page.getByRole("textbox", { name: "Saved view name" }).fill("Failure queue");
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("alert")).toContainText("The view could not be saved.");
  await expect(page.getByRole("button", { name: /Auto/ })).toBeDisabled();
  await page.getByRole("alert").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("status")).toContainText("Saved to Contacts");
  await expect(page.getByRole("button", { name: /Auto/ })).toBeEnabled();
});

test("a delayed activation is serialized and duplicate names retain the POST response id", async ({ page }) => {
  const api = await installSavedSearchApi(page, { postDelayMs: 150 });
  await openFixture(page, { width: 1280, height: 720 });

  await page.getByRole("button", { name: "Fresh opportunities" }).last().click();
  await expect(page.getByRole("button", { name: "Recovery desk" }).last()).toBeDisabled();
  await expect.poll(() => api.writes.length).toBe(1);
  await expect(page.locator(".priority-builder-row").first()).toContainText("New contacts");

  await page.getByRole("combobox", { name: "Add group" }).selectOption({ label: "My scheduled" });
  await page.getByRole("textbox", { name: "Saved view name" }).fill("Same name");
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("status")).toContainText("Saved to Contacts");
  const createdId = api.savedViews.find(view => view.name === "Same name")!.id;
  api.savedViews.push({ ...api.savedViews.find(view => view.name === "Same name")!, id: "same-name-other" });
  await page.getByRole("combobox", { name: "Add group" }).selectOption({ label: "Team scheduled" });
  await page.getByRole("button", { name: "Save view" }).click();
  await expect.poll(() => api.patchIds.includes(createdId)).toBe(true);
  expect(api.patchIds).not.toContain("same-name-other");
});