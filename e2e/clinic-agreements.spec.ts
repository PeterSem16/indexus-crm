import { test, expect } from "@playwright/test";

const rows = [
  { id: "a1", clinicId: "fixture-clinic", title: "Cooperation agreement", contractNumber: "SK-1", validFrom: "2020-01-01", validTo: "2099-12-31", active: true, endedAt: null, fileName: "agreement.pdf", contentType: "application/pdf", fileSize: 1024, createdAt: "2026-10-04T00:00:00Z", updatedAt: "2026-10-04T00:00:00Z" },
  { id: "a2", clinicId: "fixture-clinic", title: "Expired agreement", contractNumber: null, validFrom: "2020-01-01", validTo: "2021-01-01", active: true, endedAt: null, fileName: "old.pdf", contentType: "application/pdf", fileSize: 1024, createdAt: "2026-10-04T00:00:00Z", updatedAt: "2026-10-04T00:00:00Z" },
];
async function fixture(page: any, params = "", uploadFails = false) {
  const errors: string[] = [];
  const mutations: Array<{ method: string; body: string }> = [];
  let data = structuredClone(rows);
  page.on("pageerror", (e: Error) => errors.push(e.message));
  await page.route("**/api/**", async (route: any) => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET" && !url.pathname.includes("/agreements"))
      errors.push(`Unexpected parent mutation: ${request.method()} ${url.pathname}`);
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: { user: { id: "fixture-agent", role: "admin", assignedCountries: ["SK"] } } });
    if (url.pathname.endsWith("/agreements")) {
      if (request.method() === "POST") {
        mutations.push({ method: "POST", body: request.postData() || "" });
        if (uploadFails) return route.fulfill({ status: 400, json: { error: "Unsupported agreement file" } });
        return route.fulfill({ status: 201, json: rows[0] });
      }
      return route.fulfill({ json: { agreements: data, canManage: true } });
    }
    if (/\/agreements\/a1$/.test(url.pathname) && request.method() === "PATCH") {
      const value = request.postDataJSON();
      mutations.push({ method: "PATCH", body: JSON.stringify(value) });
      data[0] = { ...data[0], ...value };
      return route.fulfill({ json: data[0] });
    }
    if (url.pathname.endsWith("/download")) return route.fulfill({ body: "%PDF-1.4", headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="agreement.pdf"' } });
    if (url.pathname.includes("/settings")) return route.fulfill({ json: {} });
    return route.fulfill({ json: [] });
  });
  await page.goto("/test-fixtures/clinic-agreements.html" + params);
  await page.getByRole("button", { name: "Agreements", exact: true }).click();
  return { errors, mutations };
}
test("actual inline clinic card manages multiple agreements without submitting parent form", async ({ page }) => {
  const state = await fixture(page);
  await expect(page.getByText("Cooperation agreement", { exact: true })).toBeVisible();
  await expect(page.getByText("Expired agreement", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/clinic-agreements-native-desktop.png", animations: "disabled" });
  await page.getByLabel("End validity").first().click();
  await expect.poll(() => state.mutations.length).toBe(1);
  expect(JSON.parse(state.mutations[0].body)).toEqual({ active: false });
  await expect(page.getByLabel("Edit details").first()).toHaveText("Edit details");
  await page.getByLabel("Edit details").first().click();
  await expect(page.getByLabel("Cancel edit")).toHaveText("Cancel edit");
  await expect(page.getByLabel("Save changes", { exact: true })).toHaveText("Save changes");
  await page.getByLabel("Agreement title", { exact: true }).first().fill("Updated agreement");
  await page.getByLabel("Save changes", { exact: true }).click();
  await expect(page.getByText("Updated agreement", { exact: true })).toBeVisible();
  expect(state.mutations.every(x => x.method === "PATCH")).toBeTruthy();
  expect(state.errors).toEqual([]);
});
test("read-only Nexus Pulse clinic keeps download usable, no mutation controls", async ({ page }) => {
  const state = await fixture(page, "?readonly");
  const link = page.getByRole("link", { name: "Download" }).first();
  await expect(link).toBeVisible();
  expect(await link.evaluate((e: HTMLElement) => e.closest("fieldset")?.disabled)).toBe(false);
  await expect(page.getByLabel("End validity")).toHaveCount(0);
  await expect(page.getByText("Add agreement", { exact: true })).toHaveCount(0);
  const download = page.waitForEvent("download");
  await link.click(); await download;
  expect(state.mutations).toEqual([]);
  expect(state.errors).toEqual([]);
});
test("sheet has agreements and rejected upload preserves draft with localized error", async ({ page }) => {
  const state = await fixture(page, "?sheet", true);
  const title = page.getByLabel("Agreement title *", { exact: true });
  await title.fill("Draft agreement");
  await page.getByRole("checkbox", { name: "The agreement has no time limit" }).check();
  await page.locator('input[type="file"]').setInputFiles({ name: "example.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await page.getByRole("button", { name: "Upload agreement" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(title).toHaveValue("Draft agreement");
  expect(state.mutations.length).toBe(1);
  expect(state.errors).toEqual([]);
});
test("unsaved clinic cannot upload agreements", async ({ page }) => {
  const state = await fixture(page, "?unsaved");
  await expect(page.getByText("Save clinic first", { exact: true })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  expect(state.mutations).toEqual([]);
});
test("new agreement defaults to today's app date and explicit unlimited validity is saved", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-04T23:30:00Z") });
  const state = await fixture(page);
  await expect(page.getByTestId("agreement-valid-from")).toHaveText("05.10.2026");
  await page.getByTestId("agreement-valid-to").click();
  await expect(page.locator('[role="grid"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("Agreement title *", { exact: true }).fill("Unlimited agreement");
  await page.locator('input[type="file"]').setInputFiles({ name: "example.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(page.getByRole("button", { name: "Upload agreement" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "The agreement has no time limit" }).check();
  await expect(page.getByTestId("agreement-valid-to")).toBeDisabled();
  await page.getByRole("button", { name: "Upload agreement" }).click();
  await expect.poll(() => state.mutations.length).toBe(1);
  expect(state.mutations[0].body).toContain('name="validFrom"\r\n\r\n2026-10-05');
  expect(state.mutations[0].body).not.toContain('name="validTo"');
  expect(state.errors).toEqual([]);
});
test("editing agreement to unlimited clears persisted end date, cancelling keeps original", async ({ page }) => {
  const state = await fixture(page);
  await page.getByLabel("Edit details").first().click();
  await page.getByRole("checkbox", { name: "The agreement has no time limit" }).first().check();
  await page.getByLabel("Cancel edit").click();
  expect(state.mutations).toEqual([]);
  await page.getByLabel("Edit details").first().click();
  await expect(page.getByRole("checkbox", { name: "The agreement has no time limit" }).first()).not.toBeChecked();
  await page.getByRole("checkbox", { name: "The agreement has no time limit" }).first().check();
  await page.getByLabel("Save changes", { exact: true }).click();
  await expect.poll(() => state.mutations.length).toBe(1);
  expect(JSON.parse(state.mutations[0].body)).toEqual({ validTo: "" });
  expect(state.errors).toEqual([]);
});
test("phone layout keeps agreement content and downloads within horizontal viewport", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await fixture(page, "?readonly");
  await expect(page.getByRole("link", { name: "Download" }).first()).toBeVisible();
  const panel = await page.getByTestId("clinic-agreements-panel").boundingBox();
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(403);
  await page.screenshot({ path: "/tmp/clinic-agreements-native-phone.png", animations: "disabled" });
});
test("phone agreement actions retain visible text and wrap within viewport", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  const state = await fixture(page);
  await expect(page.getByRole("link", { name: "Download" }).first()).toHaveText("Download");
  await expect(page.getByLabel("Edit details").first()).toHaveText("Edit details");
  await page.getByLabel("Edit details").first().click();
  for (const label of ["Cancel edit", "Save changes"]) {
    const button = page.getByLabel(label, { exact: true });
    await expect(button).toHaveText(label);
    const bounds = await button.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(402);
  }
  await page.getByLabel("Cancel edit").click();
  await expect(page.getByText("Cooperation agreement", { exact: true })).toBeVisible();
  expect(state.mutations).toEqual([]);
  expect(state.errors).toEqual([]);
});