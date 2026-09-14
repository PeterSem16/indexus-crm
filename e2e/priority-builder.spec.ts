import { expect, test, type Page } from "@playwright/test";

type SavedViewPayload = { name: string; module: string; filters: string; isDefault: boolean };
type SavedView = SavedViewPayload & { id: string };
type CityRankingPayload = { cities: Array<{ key: string; city: string; countryCode: string }> };

const existingUnrankedView: SavedView = {
  id: "existing-unranked", name: "Existing queue", module: "agent-priority-builder", isDefault: true,
  filters: JSON.stringify({
    version: 1, name: "Existing queue",
    segments: [
      { id: "referral", sort: "priority", referralsFirst: true },
      { id: "scheduled_today", sort: "priority", referralsFirst: true },
      { id: "new", sort: "created_desc", referralsFirst: true },
      { id: "my_scheduled", sort: "priority", referralsFirst: true },
    ],
  }),
};

async function installSavedSearchApi(page: Page, options: {
  failGets?: number;
  failWrites?: number;
  postDelayMs?: number;
  initialViews?: SavedView[];
} = {}) {
  const savedViews: SavedView[] = [...(options.initialViews || [])];
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
      if (url.pathname.endsWith("/priority-builder/initial") && (body as SavedViewPayload & { existingId?: string }).existingId) {
        const existingId = (body as SavedViewPayload & { existingId: string }).existingId;
        const existing = savedViews.find(view => view.id === existingId && view.isDefault);
        if (!existing) {
          await route.fulfill({ status: 409, json: { error: "Priority view is no longer active" } });
          return;
        }
        writes.push(body);
        Object.assign(existing, body);
        await route.fulfill({ json: existing });
        return;
      }
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
  // The first-run default ranks its current fixture pool automatically. Tests
  // that call installCityRankingApi register a later, scenario-specific route.
  await page.route("**/api/agent/priority-builder/city-ranking", async route => {
    const body = JSON.parse(route.request().postData() || "{}") as CityRankingPayload;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ rankedKeys: body.cities.map(city => city.key), unknownKeys: [] }),
    });
  });
  return { savedViews, writes, patchIds };
}

async function installCityRankingApi(page: Page, options: {
  responses?: Array<{ rankedKeys: string[]; unknownKeys: string[] }>;
  fail?: boolean;
  delayMs?: number;
} = {}) {
  const requests: CityRankingPayload[] = [];
  let responseIndex = 0;
  await page.route("**/api/agent/priority-builder/city-ranking", async route => {
    const body = JSON.parse(route.request().postData() || "{}") as CityRankingPayload;
    requests.push(body);
    if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs));
    if (options.fail) {
      await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "fixture city ranking failure" }) });
      return;
    }
    const response = options.responses?.[Math.min(responseIndex++, (options.responses?.length || 1) - 1)] || {
      rankedKeys: body.cities.map(city => city.key),
      unknownKeys: [],
    };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(response) });
  });
  return { requests };
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
  await expect(page.locator(".priority-builder-row").first()).toContainText("New referrals");
  await expect(page.locator(".priority-builder-row").first().locator(".priority-builder-count")).toHaveText("2");
  await expect(page.locator(".priority-builder-section-head .priority-builder-total")).toContainText("8 eligible contacts");
  await expect(page.getByText("Deduplication active.")).toBeVisible();
  await expect(page.getByText("Why this order?")).toBeVisible();
  const previewBox = await page.locator(".priority-builder-preview").boundingBox();
  const firstResultBox = await page.locator(".priority-builder-card").first().boundingBox();
  expect(previewBox).not.toBeNull();
  expect(firstResultBox).not.toBeNull();
  expect(firstResultBox!.width).toBeGreaterThanOrEqual(previewBox!.width - 40); // padding, border, and scrollbar
  const firstCard = page.locator(".priority-builder-card").filter({ hasText: "Melichar" });
  await expect(firstCard).toContainText("Next up");
  await expect(firstCard).toContainText("Queue position 1");
  await expect(firstCard).toContainText("Group: New referrals");
  await expect(firstCard).toContainText("Scheduled callback: Not scheduled");
  await expect(firstCard).toContainText("Call attempts in this Mission: No attempts");
  const secondReferral = page.locator(".priority-builder-card").filter({ hasText: "Tes AmbuMed" });
  await expect(secondReferral).toContainText("Queue position 2");
  await expect(secondReferral).toContainText("Group: New referrals");
  await expect(secondReferral).not.toContainText("Next up");
  const scheduledCard = page.locator(".priority-builder-card").filter({ hasText: "Tes Klinika" });
  await expect(scheduledCard).toContainText("Group: Scheduled today");
  await expect(scheduledCard).toContainText("Call attempts in this Mission: No attempts");
  expect(await scheduledCard.textContent()).toMatch(/Scheduled callback:.*\d{4}/);
  const fallbackCard = page.locator(".priority-builder-card").filter({ hasText: "Tes Zdravotné" });
  await expect(fallbackCard).toContainText("Queue position 8");
  await expect(fallbackCard).toContainText("Group: Other eligible contacts");
  await expect(fallbackCard).toContainText("Call attempts in this Mission: Unknown");
  expect(await fallbackCard.textContent()).toMatch(/Scheduled callback:.*\d{4}/);
  await page.screenshot({ path: "/tmp/priority-clear-desktop.png" });

  for (const name of ["New referrals first", "Today's callbacks", "Fresh opportunities", "Recovery desk"]) {
    await page.getByRole("button", { name }).last().click();
    await expect(page.locator(".priority-builder-side-item.active").last()).toContainText(name);
  }
  // One idempotent first-run seed plus the four explicit preset activations.
  expect(api.writes.filter(write => write.isDefault)).toHaveLength(5);

  await page.getByRole("textbox", { name: "Search contacts" }).fill("Melichar");
  await expect(page.locator(".priority-builder-card")).toHaveCount(1);
  await expect(page.locator(".priority-builder-card")).toContainText("Melichar");
});

test("first-time mission users receive one persisted Referral + cities snapshot", async ({ page }) => {
  const api = await installSavedSearchApi(page);
  const cityApi = await installCityRankingApi(page);
  await openFixture(page, { width: 1280, height: 720 });

  await expect.poll(() => api.savedViews.length).toBe(1);
  const saved = JSON.parse(api.savedViews[0].filters);
  expect(saved).toMatchObject({
    name: "Referral + cities",
    presetId: "referral_cities",
    cityGrouping: { enabled: true, mode: "all" },
  });
  expect(saved.segments).toEqual([
    { id: "referral", sort: "priority", referralsFirst: true },
    { id: "scheduled_today", sort: "priority", referralsFirst: true },
    { id: "new", sort: "created_desc", referralsFirst: true },
    { id: "my_scheduled", sort: "priority", referralsFirst: true },
  ]);
  expect(cityApi.requests).toHaveLength(1);
  expect(cityApi.requests[0].cities.every(city => Object.keys(city).sort().join(",") === "city,countryCode,key")).toBe(true);
  await expect(page.getByRole("button", { name: /Auto/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Referral + cities" }).last()).toBeVisible();
});

test("returning to Referral + cities reactivates and saves the existing preset", async ({ page }) => {
  const api = await installSavedSearchApi(page);
  await openFixture(page, { width: 1280, height: 720 });
  await expect.poll(() => api.savedViews.length).toBe(1);
  const originalId = api.savedViews[0].id;
  await page.getByRole("button", { name: "Today's callbacks", exact: true }).last().click();
  await expect.poll(() => api.savedViews.find(view => view.id === originalId)?.isDefault).toBe(false);
  await expect(page.getByRole("button", { name: "Referral + cities", exact: true }).last()).toBeEnabled();
  await page.getByRole("button", { name: "Referral + cities", exact: true }).last().click();
  await expect.poll(() => api.savedViews.filter(view => view.isDefault).map(view => ({ id: view.id, preset: JSON.parse(view.filters).presetId })) ).toEqual([{ id: originalId, preset: "referral_cities" }]);
  await expect(page.getByRole("button", { name: "Save view", exact: true })).toBeEnabled();
  const writesBefore = api.patchIds.length;
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  await expect.poll(() => api.patchIds.length).toBeGreaterThan(writesBefore);
  expect(api.patchIds.at(-1)).toBe(originalId);
  expect(api.savedViews.filter(view => JSON.parse(view.filters).presetId === "referral_cities")).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Saved view name" })).toHaveValue("Referral + cities");
  await expect(page.getByRole("button", { name: "Save view", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Auto/ })).toBeEnabled();
});

test("an existing active personal view is preserved and skips first-run ranking", async ({ page }) => {
  const personalView = {
    id: "existing-personal",
    name: "My saved queue",
    module: "agent-priority-builder",
    isDefault: true,
    filters: JSON.stringify({
      version: 1,
      name: "My saved queue",
      segments: [{ id: "new", sort: "name_asc", referralsFirst: false }],
    }),
  } satisfies SavedView;
  const api = await installSavedSearchApi(page, { initialViews: [personalView] });
  const cityApi = await installCityRankingApi(page);
  await openFixture(page, { width: 1280, height: 720 });

  await expect(page.locator(".priority-builder-row").first()).toContainText("New contacts");
  await expect(page.getByRole("textbox", { name: "Saved view name" })).toHaveValue("My saved queue");
  await expect.poll(() => api.writes.length).toBe(0);
  expect(cityApi.requests).toHaveLength(0);
});

test("retained saved rows without a default remain usable and do not trigger seeding", async ({ page }) => {
  const retainedViews = ["Older queue", "Another queue"].map((name, index) => ({
    id: `retained-${index}`,
    name,
    module: "agent-priority-builder",
    isDefault: false,
    filters: JSON.stringify({
      version: 1,
      name,
      segments: [{ id: index ? "referral" : "new", sort: "created_desc", referralsFirst: true }],
    }),
  } satisfies SavedView));
  const api = await installSavedSearchApi(page, { initialViews: retainedViews });
  const cityApi = await installCityRankingApi(page);
  await openFixture(page, { width: 1280, height: 720 });

  await expect(page.getByRole("textbox", { name: "Saved view name" })).toHaveValue("Older queue");
  await expect(page.getByRole("button", { name: /Auto/ })).toBeEnabled();
  await expect.poll(() => api.writes.length).toBe(0);
  expect(cityApi.requests).toHaveLength(0);
});

test("referral-first group toggle persists independently and referral badges remain visible", async ({ page }) => {
  const api = await installSavedSearchApi(page);
  await openFixture(page, { width: 1280, height: 720 });
  const toggles = page.locator(".priority-builder-referral-toggle input");
  await expect(toggles).toHaveCount(4);
  await expect(toggles.nth(1)).toBeChecked();
  await expect(page.locator(".priority-builder-card-chip-referral")).toHaveCount(2);
  await toggles.nth(1).uncheck();
  await expect(page.getByRole("button", { name: /Auto/ })).toBeDisabled();
  await page.getByRole("textbox", { name: "Saved view name" }).fill("Referral group settings");
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.locator(".priority-builder-status")).toContainText("Saved to Contacts");
  await expect.poll(() => api.savedViews.length).toBe(2);
  const customView = api.savedViews.find(view => view.name === "Referral group settings")!;
  expect(JSON.parse(customView.filters).segments.map((segment: { referralsFirst: boolean }) => segment.referralsFirst)).toEqual([true, false, true, true]);
  await page.reload();
  await expect(toggles.nth(1)).not.toBeChecked();
  await expect(toggles.first()).toBeChecked();
  await expect(page.locator(".priority-builder-card-chip-referral")).toHaveCount(2);
  await page.screenshot({ path: "/tmp/priority-referral-group-settings.png" });
});

test("draft controls add, reorder, remove, reset, save, reopen and delete a personal view", async ({ page }) => {
  const api = await installSavedSearchApi(page);
  await openFixture(page, { width: 1280, height: 720 });

  const addGroup = page.getByRole("combobox", { name: "Add group" });
  await addGroup.selectOption({ label: "Team scheduled" });
  await expect(page.locator(".priority-builder-row").last()).toContainText("Team scheduled");
  await expect(page.locator(".priority-builder-status")).toContainText("Unsaved changes");
  await expect(page.getByRole("button", { name: /Auto/ })).toBeDisabled();
  await expect(page.locator(".priority-builder-queue-hint:visible")).toHaveText("Save changes before Auto or Next use this order.");
  await page.getByRole("button", { name: "Move group up" }).last().click();
  await expect(page.locator(".priority-builder-row").nth(3)).toContainText("Team scheduled");
  await page.getByRole("button", { name: "More segment actions" }).last().click();
  await page.getByRole("button", { name: "Remove segment" }).click();
  await expect(page.locator(".priority-builder-row")).toHaveCount(4);

  await page.getByRole("textbox", { name: "Saved view name" }).fill("Fixture custom queue");
  await page.getByRole("button", { name: "Rename view" }).click();
  await expect(page.getByRole("textbox", { name: "Saved view name" })).toBeFocused();
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.locator(".priority-builder-status")).toContainText("Saved to Contacts");
  await expect(page.getByRole("button", { name: /Auto/ })).toBeEnabled();
  await expect.poll(() => api.savedViews.length).toBe(2);
  expect(api.savedViews.find(view => view.name === "Fixture custom queue")!.isDefault).toBe(true);
  expect(JSON.parse(api.savedViews.find(view => view.name === "Fixture custom queue")!.filters)).not.toHaveProperty("presetId");
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
  await expect(page.locator(".priority-builder-row")).toHaveCount(4);
  await expect(page.locator(".priority-builder-row").first()).toContainText("New referrals");
});

test("original responsive mobile layout retains controls and delegates Auto and Next", async ({ page }) => {
  await installSavedSearchApi(page, { postDelayMs: 1500 });
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
  // New contacts includes referrals; enabled referral-first takes precedence
  // over created-desc, which still orders the two referral contacts.
  await expect(page.getByTestId("priority-fixture-next-contact")).toHaveText("referral-2");
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
  await installSavedSearchApi(page, { failGets: 1, failWrites: 1, initialViews: [existingUnrankedView] });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/test-fixtures/priority-builder.html");
  await expect(page.getByRole("alert")).toContainText("Saved views could not be loaded.");
  await expect(page.getByRole("button", { name: /Auto/ })).toBeDisabled();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("combobox", { name: "Add group" })).toBeEnabled();

  await page.getByRole("combobox", { name: "Add group" }).selectOption({ label: "Team scheduled" });
  await page.getByRole("textbox", { name: "Saved view name" }).fill("Failure queue");
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("alert")).toContainText("The view could not be saved.");
  await expect(page.getByRole("button", { name: /Auto/ })).toBeDisabled();
  await page.getByRole("alert").getByRole("button", { name: "Retry" }).click();
  await expect(page.locator(".priority-builder-status")).toContainText("Saved to Contacts");
  await expect(page.getByRole("button", { name: /Auto/ })).toBeEnabled();
});

test("city groups rank, lock while pending, save/reopen, refresh new cities, and keep legacy ordering when disabled", async ({ page }) => {
  const savedApi = await installSavedSearchApi(page, { initialViews: [existingUnrankedView] });
  const cityApi = await installCityRankingApi(page, {
    responses: [
      {
        rankedKeys: ["AT:vienna", "SK:bratislava", "CZ:prague", "CZ:brno", "SK:nitra"],
        unknownKeys: ["SK:zilina"],
      },
      {
        rankedKeys: ["SK:trnava", "AT:vienna", "SK:bratislava", "CZ:prague", "CZ:brno", "SK:nitra", "SK:zilina"],
        unknownKeys: [],
      },
    ],
    delayMs: 120,
  });
  await openFixture(page, { width: 1280, height: 720 });

  const grouping = page.getByTestId("toggle-priority-city-grouping");
  await grouping.check();
  await expect(page.getByTestId("priority-city-status")).toContainText("Ranking cities");
  await expect(page.getByRole("button", { name: "Save view" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Auto/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next contact" })).toBeDisabled();
  await expect(page.getByTestId("priority-city-status")).toContainText("AI city order ready");
  expect(cityApi.requests).toHaveLength(1);
  expect(cityApi.requests[0].cities.map(city => city.key)).toEqual([
    "SK:zilina", "SK:bratislava", "CZ:prague", "CZ:brno", "AT:vienna", "SK:nitra",
  ]);
  expect(cityApi.requests[0].cities.some(city => city.city === "")).toBe(false);
  await expect(page.locator(".priority-builder-preview-city-group")).toHaveCount(8);
  await expect(page.locator(".priority-builder-preview-segment-group").first()).toContainText("New referrals");
  await expect(page.locator(".priority-builder-preview-segment-group").first().locator(".priority-builder-preview-city-group").first()).toContainText("Bratislava");
  const firstCityGroup = page.locator(".priority-builder-preview-city-group").first();
  await firstCityGroup.locator(".priority-builder-preview-city-toggle").click();
  await expect(firstCityGroup.locator(".priority-builder-card")).toHaveCount(0);
  await firstCityGroup.locator(".priority-builder-preview-city-toggle").click();
  await expect(firstCityGroup.locator(".priority-builder-card")).toHaveCount(1);
  await page.screenshot({ path: "/tmp/priority-city-desktop.png" });

  await page.getByRole("button", { name: "Duplicate" }).click();
  await page.getByRole("textbox", { name: "Saved view name" }).fill("City fixture queue");
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.locator(".priority-builder-status")).toContainText("Saved to Contacts");
  await expect.poll(() => savedApi.savedViews.length).toBe(2);
  const savedFilters = JSON.parse(savedApi.savedViews.find(view => view.name === "City fixture queue")!.filters);
  expect(savedFilters.cityGrouping).toMatchObject({
    enabled: true,
    rankedKeys: ["AT:vienna", "SK:bratislava", "CZ:prague", "CZ:brno", "SK:nitra"],
    unknownKeys: ["SK:zilina"],
  });

  await page.reload();
  await expect(page.getByTestId("toggle-priority-city-grouping")).toBeChecked();
  await expect(page.locator(".priority-builder-preview-city-group")).toHaveCount(8);

  await page.evaluate(() => {
    const fixtureWindow = window as Window & { priorityFixtureAddCity?: () => void };
    fixtureWindow.priorityFixtureAddCity?.();
  });
  await expect(page.getByRole("button", { name: "Trnava, SK (1)" })).toBeVisible();
  await expect(page.locator(".priority-builder-preview-city-group")).toHaveCount(9);
  await expect(page.locator(".priority-builder-preview-segment-group").first().locator(".priority-builder-preview-city-group").first()).toContainText("Bratislava");
  await page.getByTestId("btn-priority-city-rerank").click();
  await expect(page.getByTestId("priority-city-status")).toContainText("AI city order ready");
  await expect.poll(() => cityApi.requests.length).toBe(2);
  await expect(page.locator(".priority-builder-preview-city-group").filter({ hasText: "Trnava" }).first()).toBeVisible();
  await expect(page.getByTestId("toggle-priority-city-grouping")).toBeChecked();

  await page.getByTestId("toggle-priority-city-grouping").click();
  await expect(page.locator(".priority-builder-preview-city-group")).toHaveCount(0);
  await expect(page.locator(".priority-builder-row").first()).toContainText("New referrals");
  await expect(page.getByRole("button", { name: /Auto/ })).toBeDisabled();
});

test("city ranking failure exposes retry and locks queue actions", async ({ page }) => {
  await installSavedSearchApi(page, { initialViews: [existingUnrankedView] });
  await installCityRankingApi(page, { fail: true });
  await openFixture(page, { width: 1280, height: 720 });
  await page.getByTestId("toggle-priority-city-grouping").click();
  await expect(page.getByTestId("priority-city-status")).toContainText("City ranking failed");
  await expect(page.getByTestId("btn-priority-city-retry")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save view" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Auto/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next contact" })).toBeDisabled();
  await page.getByTestId("toggle-priority-city-grouping").click();
  await expect(page.getByTestId("toggle-priority-city-grouping")).not.toBeChecked();
  await expect(page.getByTestId("priority-city-status")).not.toContainText("City ranking failed");
  await expect(page.getByRole("button", { name: /Auto/ })).toBeEnabled();
});

test("city grouped parent Next follows the first saved city contact", async ({ page }) => {
  await installSavedSearchApi(page);
  await installCityRankingApi(page, {
    responses: [{ rankedKeys: ["AT:vienna", "SK:bratislava", "SK:zilina", "CZ:brno", "CZ:prague", "SK:nitra"], unknownKeys: [] }],
  });
  await openFixture(page, { width: 390, height: 844 });
  await page.getByTestId("toggle-priority-city-grouping").check();
  await expect(page.getByTestId("priority-city-status")).toContainText("AI city order ready");
  await page.getByRole("button", { name: "Duplicate" }).click();
  await page.getByRole("textbox", { name: "Saved view name" }).fill("City mobile queue");
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.locator(".priority-builder-status")).toContainText("Saved to Contacts");
  await expect(page.getByRole("button", { name: "Next contact" })).toBeEnabled();
  await page.screenshot({ path: "/tmp/priority-city-mobile.png" });
  await page.getByRole("button", { name: "Next contact" }).click();
  await expect(page.getByTestId("priority-fixture-next-contact")).toHaveText("referral-2");
  await expect(page.locator(".priority-builder-preview")).toBeHidden();
});

test("selected cities stay authoritative for saved, reopened, empty and parent Next states", async ({ page }) => {
  await installSavedSearchApi(page);
  await installCityRankingApi(page, {
    responses: [{ rankedKeys: ["AT:vienna", "SK:bratislava", "SK:zilina", "CZ:brno", "CZ:prague", "SK:nitra"], unknownKeys: [] }],
  });
  await openFixture(page, { width: 390, height: 844 });

  await page.getByTestId("toggle-priority-city-grouping").check();
  await expect(page.getByTestId("priority-city-mode-all")).toBeChecked();
  await page.getByTestId("priority-city-mode-selected").check();
  const bratislava = page.getByTestId("priority-city-option-SK:bratislava");
  await expect(bratislava).toBeVisible();
  await bratislava.check();
  await page.getByRole("button", { name: "Duplicate" }).click();
  await page.getByRole("textbox", { name: "Saved view name" }).fill("Selected city queue");
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.locator(".priority-builder-status")).toContainText("Saved to Contacts");
  await page.getByRole("button", { name: "Next contact" }).click();
  await expect(page.getByTestId("priority-fixture-next-contact")).toHaveText("referral-2");

  await page.reload();
  await expect(page.getByTestId("priority-city-mode-selected")).toBeChecked();
  await expect(page.getByTestId("priority-city-option-SK:bratislava")).toBeChecked();
  await page.getByTestId("priority-city-option-SK:bratislava").uncheck();
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.locator(".priority-builder-status")).toContainText("Saved to Contacts");
  await page.getByRole("button", { name: "Next contact" }).click();
  await expect(page.getByTestId("priority-fixture-next-contact")).toHaveText("");
});

test("a delayed activation is serialized and duplicate names retain the POST response id", async ({ page }) => {
  const api = await installSavedSearchApi(page, { postDelayMs: 150 });
  await openFixture(page, { width: 1280, height: 720 });

  await page.getByRole("button", { name: "Fresh opportunities" }).last().click();
  await expect(page.getByRole("button", { name: "Recovery desk" }).last()).toBeDisabled();
  await expect.poll(() => api.writes.length).toBe(2);
  await expect(page.locator(".priority-builder-row").first()).toContainText("New contacts");

  await page.getByRole("combobox", { name: "Add group" }).selectOption({ label: "My scheduled" });
  await page.getByRole("textbox", { name: "Saved view name" }).fill("Same name");
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.locator(".priority-builder-status")).toContainText("Saved to Contacts");
  const createdId = api.savedViews.find(view => view.name === "Same name")!.id;
  api.savedViews.push({ ...api.savedViews.find(view => view.name === "Same name")!, id: "same-name-other" });
  await page.getByRole("combobox", { name: "Add group" }).selectOption({ label: "Team scheduled" });
  await page.getByRole("button", { name: "Save view" }).click();
  await expect.poll(() => api.patchIds.includes(createdId)).toBe(true);
  expect(api.patchIds).not.toContain("same-name-other");
});