import { test, expect } from "@playwright/test";

for (const width of [1360, 390]) {
  test(`legal entities are beside Persons and retain legacy record links at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const entity = { id: "navigation-entity", countryCode: "SK", ico: "12345678",
      name: "Navigation test operator", status: "active", checkedAt: "2026-10-15T08:00:00Z", facilityCount: 0 };
    await page.route("**/api/**", route => {
      const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
      const data = path === "/api/auth/me"
        ? { user: { id: "navigation-test", username: "navigation-test", fullName: "Navigation test",
          role: "admin", assignedCountries: ["SK"], isActive: true } }
        : path === "/api/healthcare-legal-entities" ? { items: [entity], canManage: true }
        : path === "/api/healthcare-legal-entities/navigation-entity" ? {
          entity, facilities: [], people: [], registryPeople: [], personLinks: [], history: [], audit: [],
          canManage: true, canViewSensitive: false,
        }
        : path === "/api/collaborators/stats" ? {
          total: 0, active: 0, inactive: 0, validAgreement: 0, expiredAgreement: 0, noAgreement: 0,
          types: {}, categories: {},
        } : path.includes("permissions") ? {} : [];
      return route.fulfill({ json: data });
    });
    await page.goto("/hospitals");
    const persons = page.getByTestId("tab-collaborators");
    const legal = page.getByTestId("tab-legal-entities");
    await expect(persons).toBeVisible({ timeout: 45_000 });
    await expect(legal).toBeVisible();
    expect(await persons.evaluate((node) => node.parentElement ===
      document.querySelector('[data-testid="tab-legal-entities"]')?.parentElement)).toBe(true);
    await expect(page.getByTestId("nav-healthcare-legal-entities")).toHaveCount(0);
    await legal.click();
    await expect(page).toHaveURL(/\/hospitals\?tab=legal-entities$/);
    await expect(page.getByTestId("healthcare-legal-entities-page")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(entity.name, { exact: true })).toBeVisible();
    await persons.click();
    await expect(page).toHaveURL(/tab=collaborators/);
    await expect(page.getByTestId("healthcare-legal-entities-page")).not.toBeVisible();
    await page.goBack();
    await expect(legal).toHaveAttribute("data-state", "active");
    await page.reload();
    await expect(page.getByTestId("healthcare-legal-entities-page")).toBeVisible();
    await page.goto("/healthcare-legal-entities?id=navigation-entity");
    await expect(page).toHaveURL(/\/hospitals\?.*id=navigation-entity.*tab=legal-entities/);
    await expect(legal).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("legal-entity-detail")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/hospitals\?tab=legal-entities$/);
    await expect(page.getByTestId("healthcare-legal-entities-page")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("legal-entities-tab.png") });
    expect(errors).toEqual([]);
  });
}
