import { test, expect } from "@playwright/test";
import type { RegistryPerson } from "../shared/healthcare-legal-entity";

test.use({ actionTimeout: 15_000 });

for (const width of [1360, 390]) {
  test(`registry roles timeline preserves dates, statuses and unknown history at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const api = "/api/healthcare-legal-entities";
    const entity = {
      id: "timeline-fixture", countryCode: "SK", ico: "12345678", name: "Timeline fixture company",
      status: "active", legalForm: "s.r.o.", notes: "", facilityCount: 0,
      registryReference: { section: "Sro", court: "B", insertNumber: 123 },
    };
    let people: RegistryPerson[] = [
      { key: "historic", name: "Historical registry example", role: "Konateľ", kind: "statutory", current: false,
        validFrom: "2017-02-01", validTo: "2020-09-30" },
      { key: "unknown", name: "Undated registry example", role: "Spoločník", kind: "shareholder", current: false,
        validFrom: null, validTo: null },
      { key: "current", name: "Current registry example with a deliberately long display name for mobile",
        role: "Konateľ a člen štatutárneho orgánu", kind: "statutory", current: true,
        validFrom: "2024-05-01", validTo: null },
      { key: "end-only", name: "End-only registry example", role: "Člen predstavenstva", kind: "statutory", current: false,
        validFrom: "not-a-date", validTo: "2022-04-30" },
    ];
    await page.route("**/api/**", route => {
      const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
      if (path === "/api/auth/heartbeat") return route.fulfill({ json: { ok: true } });
      if (route.request().method() !== "GET") return route.fulfill({ status: 405, json: {} });
      if (path === api) return route.fulfill({ json: { items: [entity], canManage: true } });
      if (path === `${api}/${entity.id}`) return route.fulfill({ json: {
        entity, registryPeople: people, facilities: [], people: [], personLinks: [], history: [], audit: [],
        canManage: true, canViewSensitive: false,
      } });
      return route.fulfill({ json: path === "/api/auth/me" ? { user: {
        id: "timeline-reviewer", username: "timeline-reviewer", role: "admin", isActive: true,
        assignedCountries: ["SK"], fullName: "Timeline fixture reviewer",
      } } : path.includes("permissions") ? {} : [] });
    });
    await page.goto(`/healthcare-legal-entities?id=${entity.id}`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("legal-entity-tab-people")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("legal-entity-tab-people").click();
    const timeline = page.getByTestId("registry-roles-timeline");
    await expect(timeline).toBeVisible();
    const rows = timeline.locator('[data-testid^="registry-role-"]');
    await expect(rows).toHaveCount(4);
    expect(await rows.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-testid")))).toEqual([
      "registry-role-current", "registry-role-end-only", "registry-role-historic", "registry-role-unknown",
    ]);
    await expect(page.getByTestId("registry-role-current")).toContainText("2024");
    await expect(page.getByTestId("registry-role-historic")).toContainText("2017");
    await expect(page.getByTestId("registry-role-historic")).toContainText("2020");
    await expect(timeline).not.toContainText("Invalid Date");
    await expect(timeline).not.toContainText("not-a-date");
    await expect.poll(async () => {
      const box = await timeline.boundingBox();
      return !!box && box.x >= -1 && box.x + box.width <= width + 1;
    }).toBe(true);
    await page.screenshot({ path: `test-results/registry-roles-timeline-${width}.png`, animations: "disabled" });
    people = [];
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("legal-entity-tab-people").click();
    await expect(page.locator('[data-testid^="registry-role-"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
