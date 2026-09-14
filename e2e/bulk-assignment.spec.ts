import { expect, test } from "@playwright/test";

test("full clinic and hospital filters feed preview and confirm, and edits invalidate preview", async ({ page }) => {
  const requests: Array<{ url: string; body: any }> = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/contexts/country-filter-context.tsx*", route => route.fulfill({
    contentType: "application/javascript",
    body: 'const selectedCountries=["SK"]; export function useCountryFilter(){return {selectedCountries}}',
  }));
  await page.route("**/api/**", async route => {
    const url = route.request().url();
    if (url.includes("/api/representatives")) {
      return route.fulfill({ json: [
        { id: "rep-a", name: "Representative Alpha", clinicCount: 2 },
        { id: "rep-b", name: "Representative Beta", clinicCount: 3 },
      ] });
    }
    if (url.includes("bulk-assign-representative")) {
      const body = route.request().postDataJSON();
      requests.push({ url, body });
      return route.fulfill({ json: {
        affected: 2, previewIds: ["entity-1", "entity-2"],
        previewFingerprint: "fixture-preview-fingerprint",
      } });
    }
    return route.fulfill({ json: [] });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/test-fixtures/bulk-assignment.html");
  await page.getByRole("combobox").last().click();
  await page.getByRole("option", { name: "Representative Alpha", exact: true }).click();
  await page.getByTestId("filter-bulk-clinic-open-filter").click();
  await expect(page.getByText("Filter rules", { exact: true })).toBeVisible();
  await page.getByTestId("filter-bulk-clinic-preset-active").click();
  await expect(page.getByTestId("filter-bulk-clinic-rule-status")).toBeVisible();
  await page.screenshot({ path: "/tmp/bulk-assignment-filters.png", animations: "disabled" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm", exact: true })).toBeEnabled();
  expect(requests[0].body.criteria.filterRules).toEqual(expect.arrayContaining([
    expect.objectContaining({ field: "status", op: "is", value: "active" }),
  ]));
  await page.getByTestId("filter-bulk-clinic-search").fill("Clinic subset");
  await expect(page.getByRole("button", { name: "Confirm", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2].body.dryRun).toBe(false);
  expect(requests[2].body.criteria).toEqual(requests[1].body.criteria);
  expect(requests[2].body.previewIds).toEqual(["entity-1", "entity-2"]);
  expect(requests[2].body.previewFingerprint).toBe("fixture-preview-fingerprint");
  expect(requests[2].body.previewTargetUserId).toBe("rep-a");
  await page.getByRole("button", { name: /^Hospitals?$/ }).click();
  await expect(page.getByRole("button", { name: "Confirm", exact: true })).toBeDisabled();
  await page.getByTestId("filter-bulk-hospital-open-filter").click();
  await page.getByTestId("filter-bulk-hospital-preset-active").click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect.poll(() => requests.length).toBe(4);
  expect(requests[3].url).toContain("/api/hospitals/");
  expect(errors).toEqual([]);
});