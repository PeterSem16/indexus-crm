import { expect, test, type Page } from "@playwright/test";
import { translations, COUNTRY_TO_LOCALE } from "../client/src/i18n/translations";

type SavedView = {
  id: string;
  name: string;
  module: string;
  filters: string;
  isDefault: boolean;
};

type CityRequest = { cities: Array<{ key: string; city: string; countryCode: string }> };

const initialRichSearchView: SavedView = {
  id: "rich-search-view",
  name: "Rich search fixture",
  module: "agent-priority-builder",
  isDefault: true,
  filters: JSON.stringify({
    version: 1,
    name: "Rich search fixture",
    segments: [
      { id: "referral", sort: "priority", referralsFirst: true },
      { id: "scheduled_today", sort: "priority", referralsFirst: true },
      { id: "new", sort: "created_desc", referralsFirst: true },
      { id: "my_scheduled", sort: "priority", referralsFirst: true },
    ],
  }),
};

async function installRichSearchApis(page: Page) {
  const cityRequests: CityRequest[] = [];
  await page.route("**/api/saved-searches**", async route => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify([initialRichSearchView]) });
      return;
    }
    // The fixture starts with a persisted active view. Search itself must not
    // write a saved view, but return a valid response if a browser retries.
    await route.fulfill({ status: 204, body: "" });
  });
  await page.route("**/api/agent/priority-builder/city-ranking", async route => {
    const body = JSON.parse(route.request().postData() || "{}") as CityRequest;
    cityRequests.push(body);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        rankedKeys: body.cities.map(city => city.key),
        unknownKeys: [],
      }),
    });
  });
  return cityRequests;
}

async function openRichSearchFixture(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/test-fixtures/priority-builder.html?rich-search=1");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.locator(".priority-builder-toolbar input[aria-label='Search contacts']")).toBeVisible();
  await expect(page.getByTestId("toggle-priority-city-grouping")).not.toBeChecked();
  await expect(page.locator("input[aria-label='Saved view name']")).toHaveValue("Rich search fixture");
  await expect(page.locator(".priority-builder-preview .priority-builder-card")).toHaveCount(4);
}

function previewCards(page: Page) {
  return page.locator(".priority-builder-preview .priority-builder-card");
}

function searchInput(page: Page) {
  return page.locator(".priority-builder-toolbar input[aria-label='Search contacts']");
}

function searchField(page: Page) {
  return page.locator(".priority-builder-toolbar select.priority-builder-select");
}

test("rich results expose the real nested clinic identity and preserve queue badges", async ({ page }) => {
  await installRichSearchApis(page);
  await openRichSearchFixture(page);

  // Search does not replace the evaluation-order editor.
  await expect(page.locator(".priority-builder-editor .priority-builder-row")).toHaveCount(4);
  await expect(previewCards(page).first().locator(".priority-builder-card-chip")).toHaveCount(5);
  await expect(previewCards(page).first().locator(".priority-builder-card-chip-referral")).toBeVisible();
  await searchInput(page).fill("Eva");
  await expect(previewCards(page)).toHaveCount(1);

  const card = previewCards(page).first();
  const identity = card.locator(".priority-contact-identity");
  await expect(identity.locator(".priority-contact-person")).toContainText("MUDr. Eva Semanová");
  await expect(identity.locator(".priority-contact-organization")).toContainText("ALLATURA");
  await expect(identity.locator(".priority-contact-channels")).toContainText("+421 33 555 1100");
  await expect(identity.locator(".priority-contact-channels")).toContainText("eva.semanova@allatura.example.org");
  await expect(identity.locator(".priority-contact-person mark")).toContainText("Eva");
  await expect(identity.locator(".priority-contact-channels mark")).toContainText("eva");
  await expect(identity.locator(".priority-contact-match")).toContainText("Match");
  await expect(identity.locator(".priority-contact-match")).toContainText("contact name");
  await expect(card.locator(".priority-builder-card-chip")).toHaveCount(4);
  await expect(card.locator(".priority-builder-card-chip-position")).toContainText("Queue position 2");
  await expect(card.locator(".priority-builder-card-chip-group")).toContainText("New contacts");
  await page.screenshot({ path: "/tmp/priority-search-production-desktop.png" });

  // Diacritic-insensitive name matching uses the same visible person value.
  await searchInput(page).fill("Semanova");
  await expect(previewCards(page)).toHaveCount(1);
  await expect(previewCards(page).first().locator(".priority-contact-person")).toContainText("MUDr. Eva Semanová");

  // A non-match is explicit, and clearing restores the complete queue.
  await searchInput(page).fill("not-a-real-rich-contact");
  await expect(previewCards(page)).toHaveCount(0);
  await expect(page.locator(".priority-builder-preview .priority-builder-detail").filter({ hasText: "No contacts match" })).toBeVisible();
  await searchInput(page).fill("");
  await expect(previewCards(page)).toHaveCount(4);
});

test("rich search supports secondary fields, city matches, and grouped-card badges", async ({ page }) => {
  const cityRequests = await installRichSearchApis(page);
  await openRichSearchFixture(page);

  await searchField(page).selectOption("name");
  await searchInput(page).fill("Semanova");
  await expect(previewCards(page)).toHaveCount(1);
  await expect(previewCards(page).first().locator(".priority-contact-person")).toContainText("MUDr. Eva Semanová");

  await searchField(page).selectOption("phone");
  await searchInput(page).fill("335552200");
  await expect(previewCards(page)).toHaveCount(1);
  await expect(previewCards(page).first().locator(".priority-contact-channels")).toContainText("+421 33 555 2200");
  await expect(previewCards(page).first().locator(".priority-contact-channels mark")).toContainText("33 555 2200");

  await searchField(page).selectOption("email");
  await searchInput(page).fill("recepcia@allatura.example.org");
  await expect(previewCards(page)).toHaveCount(1);
  await expect(previewCards(page).first().locator(".priority-contact-channels")).toContainText("recepcia@allatura.example.org");
  await expect(previewCards(page).first().locator(".priority-contact-channels mark")).toContainText("recepcia@allatura.example.org");

  // mobile2 is searchable even though the primary number remains visible.
  await searchField(page).selectOption("phone");
  await searchInput(page).fill("948200202");
  await expect(previewCards(page)).toHaveCount(1);
  const mobileCard = previewCards(page).first();
  await expect(mobileCard).toContainText("Mária Mobilová");
  await expect(mobileCard.locator(".priority-contact-channels")).toContainText("+421 948 200 202");

  await searchField(page).selectOption("all");
  await searchInput(page).fill("Trnava");
  await expect(previewCards(page)).toHaveCount(2);
  await expect(previewCards(page).filter({ hasText: "MUDr. Eva Semanová" }).first().locator(".priority-contact-channel").filter({ hasText: "Trnava" })).toBeVisible();
  await expect(previewCards(page).filter({ hasText: "MUDr. Eva Semanová" }).first().locator(".priority-contact-match")).toContainText("city");

  // Grouping adds exactly one city chip to the four original chips.
  await searchInput(page).fill("Semanova");
  await page.getByTestId("toggle-priority-city-grouping").click();
  await expect(page.getByTestId("priority-city-status")).toContainText("AI city order ready");
  await expect.poll(() => cityRequests.length).toBe(1);
  const groupedCard = previewCards(page).first();
  await expect(groupedCard.locator(".priority-builder-card-chip")).toHaveCount(5);
  await expect(groupedCard.locator(".priority-builder-card-chip-city")).toContainText("Trnava");
});

test("selection and queue actions remain parent-owned while rich search is active", async ({ page }) => {
  await installRichSearchApis(page);
  await openRichSearchFixture(page);

  await searchInput(page).fill("Semanová");
  await expect(previewCards(page)).toHaveCount(1);
  await previewCards(page).first().click();
  await expect(page.getByTestId("priority-fixture-selected-contact")).toHaveText("rich-clinic-semanova");

  // Search only filters the preview. Auto and Next still use the persisted
  // full queue, so Next selects the referral hospital rather than the result.
  await page.locator(".priority-builder-sidebar").getByRole("button", { name: /Auto/ }).click();
  await expect(page.getByTestId("priority-fixture-auto")).toHaveText("true");
  await page.locator(".priority-builder-sidebar").getByRole("button", { name: /Next/ }).click();
  await expect(page.getByTestId("priority-fixture-next-calls")).toHaveText("1");
  await expect(page.getByTestId("priority-fixture-next-contact")).toHaveText("rich-hospital-1");
});

test("sensitive collaborator password data is never a searchable contact field", async ({ page }) => {
  await installRichSearchApis(page);
  await openRichSearchFixture(page);

  await searchInput(page).fill("fixture-mobile-password-hash-do-not-search-7f4c");
  await expect(previewCards(page)).toHaveCount(0);
  await expect(page.locator(".priority-builder-preview .priority-builder-detail").filter({ hasText: "No contacts match" })).toBeVisible();
});

test("mobile search reveals rich results and clearing returns to the priority editor", async ({ page }) => {
  await installRichSearchApis(page);
  await openRichSearchFixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".priority-builder-editor")).toBeVisible();
  await searchInput(page).fill("seman");
  await expect(page.locator(".priority-builder-preview")).toBeVisible();
  await expect(previewCards(page)).toHaveCount(1);
  await expect(previewCards(page).first().locator(".priority-contact-person")).toContainText("MUDr. Eva Semanová");
  await previewCards(page).first().scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: "/tmp/priority-search-production-mobile.png" });
  await searchInput(page).fill("");
  await expect(page.locator(".priority-builder-editor")).toBeVisible();
});

test("rich search copy renders in all seven application languages", async ({ page }) => {
  await installRichSearchApis(page);
  for (const country of ["GB", "SK", "CZ", "HU", "RO", "IT", "DE"]) {
    const locale = COUNTRY_TO_LOCALE[country] || "en";
    const copy = translations[locale].agentWorkspace.priorityBuilderSearchResult;
    expect(Object.keys(copy)).toHaveLength(14);
    expect(Object.values(copy).every(value => typeof value === "string" && value.trim().length > 0)).toBe(true);
    await page.goto(`/test-fixtures/priority-builder.html?rich-search=1&country=${country}`);
    await page.locator(".priority-builder-search input").fill("seman");
    await expect(previewCards(page)).toHaveCount(1);
    await expect(previewCards(page).first().locator(".priority-contact-eyebrow")).toHaveText(copy.contactPerson);
    await expect(previewCards(page).first().locator(".priority-contact-match")).toContainText(copy.match);
    await expect(page.locator(".priority-builder-preview-head p")).toHaveText(copy.resultsFor.replace("{query}", "seman"));
    if (country === "SK") await page.screenshot({ path: "/tmp/priority-search-production-sk.png" });
  }
});