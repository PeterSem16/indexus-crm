import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.use({ actionTimeout: 15_000 });

const api = "/api/healthcare-legal-entities";
const user = { id: "hle-browser-admin", username: "hle-browser", fullName: "Synthetic reviewer", email: "hle@example.invalid",
  role: "admin", isActive: true, assignedCountries: ["SK"], preferredLanguage: "en" };
const company = { countryCode: "SK", ico: "12345678", name: "Synthetic Healthcare Operator",
  legalForm: "s.r.o.", registeredAddress: "Registered office 8", city: "Bratislava", postalCode: "81101",
  status: "active", registryReference: { section: "Sro", court: "B", insertNumber: 123 },
  establishedAt: "2020-01-01", terminatedAt: null };
const preview = { verificationId: "preview-test", expiresAt: "2099-01-01T12:00:00Z", company,
  existingEntityId: null, registryPeople: [], documents: [], checkedAt: "2026-10-15T08:00:00Z", sourceUpdatedAt: "2026-10-13T19:00:00" };

for (const width of [1360, 390]) {
  test(`Healthcare Legal Entity native list, drawer, edits and complete download at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => { errors.push(error.message); console.error(error.stack); });
    const writes: any[] = [];
    let saved = false, notes = "";
    const details: Record<string, string> = {};
    const entityId = "hle-browser-entity";
    await page.route("**/api/**", async route => {
      const req = route.request(), path = new URL(req.url()).pathname.replace(/\/$/, "");
      const entity = { ...company, ...details, registryCompany: company, details, id: entityId, notes, checkedAt: preview.checkedAt,
        sourceUpdatedAt: preview.sourceUpdatedAt, facilityCount: 0 };
      if (path === "/api/auth/heartbeat") return route.fulfill({ json: { ok: true } });
      if (path === `${api}/verify`) {
        writes.push(req.postDataJSON());
        return route.fulfill({ json: preview });
      }
      if (path === `${api}/save`) {
        writes.push(req.postDataJSON()); saved = true;
        return route.fulfill({ json: { entityId, linkId: null } });
      }
      if (path === `${api}/${entityId}` && req.method() === "PATCH") {
        const body = req.postDataJSON();
        writes.push(body);
        if (body.notes !== undefined) notes = body.notes;
        for (const [key, value] of Object.entries(body.details || {})) {
          if (value === null) delete details[key];
          else details[key] = String(value);
        }
        return route.fulfill({ json: { ok: true } });
      }
      if (path === `${api}/${entityId}/export`) return route.fulfill({
        contentType: "application/json",
        headers: { "Content-Disposition": 'attachment; filename="healthcare-legal-entity-12345678-orsr-2026-10-15.json"' },
        body: JSON.stringify({ format: "indexus.healthcare-legal-entity.v1", entity,
          snapshot: { rawData: { futureApiField: { retained: true } } } }),
      });
      if (req.method() !== "GET") return route.fulfill({ status: 405, json: { error: "Fixture write blocked" } });
      if (path === api) return route.fulfill({ json: { items: saved ? [entity] : [], canManage: true } });
      if (path === `${api}/${entityId}`) return route.fulfill({ json: {
        entity, facilities: [], people: [], registryPeople: [], personLinks: [], audit: [],
        history: [{ id: "snapshot-test", checkedAt: preview.checkedAt, sourceUpdatedAt: preview.sourceUpdatedAt }],
        canManage: true, canViewSensitive: true, rawData: { futureApiField: { retained: true } },
      } });
      const result = path === "/api/auth/me" ? { user } : path.includes("permissions") ? {} : [];
      return route.fulfill({ json: result });
    });
    await page.goto("/healthcare-legal-entities", { waitUntil: "networkidle" });
    await expect(page.getByTestId("healthcare-legal-entities-page")).toBeVisible({ timeout: 30_000 });
    if (width >= 768) await expect(page.getByTestId("nav-healthcare-legal-entities")).toBeVisible();
    await page.getByTestId("button-new-legal-entity").click();
    await page.getByTestId("input-verify-ico").fill(company.ico);
    await page.getByTestId("button-verify-ico").click();
    await expect(page.getByRole("dialog")).toContainText(company.name);
    await page.getByTestId("button-save-verified-entity").click();
    await expect(page).toHaveURL(new RegExp(`id=${entityId}`));
    await expect(page.getByTestId("legal-entity-detail")).toBeVisible();
    await expect(page.getByTestId("legal-entity-detail")).toContainText(company.name);
    await expect.poll(async () => {
      const box = await page.getByTestId("legal-entity-detail").boundingBox();
      return !!box && box.x >= -1 && box.x + box.width <= width + 1;
    }).toBe(true);
    await page.screenshot({ path: `test-results/healthcare-legal-entity-drawer-${width}.png`, animations: "disabled" });
    // The source JSON is retained/downloadable but is no longer the primary overview.
    const notesInput = page.getByTestId("legal-entity-detail").locator("textarea");
    await notesInput.fill("Review note");
    await page.getByTestId("input-legal-entity-name").fill("Edited healthcare entity");
    await page.getByTestId("legal-entity-tab-facilities").click();
    await page.getByTestId("legal-entity-tab-overview").click();
    await expect(page.getByTestId("input-legal-entity-name")).toHaveValue("Edited healthcare entity");
    await expect(notesInput).toHaveValue("Review note");
    await page.getByTestId("button-save-legal-entity").click();
    await expect.poll(() => notes).toBe("Review note");
    await expect.poll(() => details.name).toBe("Edited healthcare entity");
    await expect(page.getByTestId("button-save-legal-entity")).toBeDisabled();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("legal-entity-detail").locator("textarea")).toHaveValue("Review note");
    await expect(page.getByTestId("input-legal-entity-name")).toHaveValue("Edited healthcare entity");
    const downloadPending = page.waitForEvent("download");
    await page.getByTestId("button-download-legal-entity").click();
    const download = await downloadPending;
    expect(download.suggestedFilename()).toBe("healthcare-legal-entity-12345678-orsr-2026-10-15.json");
    const file = await download.path();
    expect(file).not.toBeNull();
    const exported = JSON.parse(await readFile(file!, "utf8"));
    expect(exported.snapshot.rawData.futureApiField.retained).toBe(true);
    await page.getByTestId("button-close-legal-entity").click();
    await expect(page).not.toHaveURL(/id=/);
    await expect(page.getByTestId("legal-entity-detail")).not.toBeVisible();
    await expect(page.getByText("Edited healthcare entity", { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/healthcare-legal-entity-list-${width}.png`, fullPage: true, animations: "disabled" });
    expect(writes[0]).toEqual({ ico: company.ico });
    expect(writes[1]).toEqual({ verificationId: "preview-test" });
    expect(errors).toEqual([]);
  });
}

test("native entity search and advanced filter presets narrow the actual table", async ({ page }) => {
  test.setTimeout(120_000);
  const items = [
    { ...company, id: "entity-active", facilityCount: 1, notes: "", checkedAt: new Date().toISOString() },
    { ...company, id: "entity-retired", name: "Retired legal entity", ico: "87654321", status: "terminated",
      facilityCount: 0, notes: "", checkedAt: "2020-01-01T00:00:00Z" },
  ];
  await page.route("**/api/**", route => {
    const req = route.request(), path = new URL(req.url()).pathname.replace(/\/$/, "");
    if (path === "/api/auth/heartbeat") return route.fulfill({ json: { ok: true } });
    if (req.method() !== "GET") return route.fulfill({ status: 405, json: {} });
    return route.fulfill({ json: path === api ? { items, canManage: true } :
      path === "/api/auth/me" ? { user } : path.includes("permissions") ? {} : [] });
  });
  await page.goto("/healthcare-legal-entities", { waitUntil: "networkidle" });
  const filter = "filter-healthcare-legal-entities";
  await expect(page.getByRole("row").filter({ hasText: "Retired legal entity" })).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId(`${filter}-search`).fill(company.ico);
  await expect(page.getByRole("row").filter({ hasText: "Retired legal entity" })).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: company.name })).toHaveCount(1);
  await page.getByTestId(`${filter}-search`).fill("");
  await page.getByTestId(`${filter}-open-filter`).click();
  await expect(page.getByTestId(`${filter}-drawer`)).toBeVisible();
  await page.getByTestId(`${filter}-preset-active`).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("row").filter({ hasText: "Retired legal entity" })).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: company.name })).toHaveCount(1);
  await page.getByTestId(`${filter}-chip-remove-status`).click();
  await expect(page.getByRole("row").filter({ hasText: "Retired legal entity" })).toHaveCount(1);
});
