import { test, expect } from "@playwright/test";

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
  test(`Healthcare Legal Entity verify, save, reopen and notes at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => { errors.push(error.message); console.error(error.stack); });
    const writes: any[] = [];
    let saved = false, notes = "";
    const entityId = "hle-browser-entity";
    await page.route("**/api/**", async route => {
      const req = route.request(), path = new URL(req.url()).pathname.replace(/\/$/, "");
      const entity = { ...company, id: entityId, notes, checkedAt: preview.checkedAt,
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
        writes.push(req.postDataJSON()); notes = req.postDataJSON().notes;
        return route.fulfill({ json: { ok: true } });
      }
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
    await expect(page.getByTestId("healthcare-legal-entities-page")).toBeVisible();
    if (width >= 768) await expect(page.getByTestId("nav-healthcare-legal-entities")).toBeVisible();
    await page.getByTestId("button-new-legal-entity").click();
    await page.getByTestId("input-verify-ico").fill(company.ico);
    await page.getByTestId("button-verify-ico").click();
    await expect(page.getByRole("dialog")).toContainText(company.name);
    await page.getByTestId("button-save-verified-entity").click();
    await expect(page).toHaveURL(new RegExp(`id=${entityId}`));
    await expect(page.getByTestId("legal-entity-detail")).toBeVisible();
    await expect(page.getByTestId("legal-entity-detail")).toContainText(company.name);
    await expect(page.getByTestId("legal-entity-detail")).toContainText("futureApiField");
    const notesInput = page.getByTestId("legal-entity-detail").locator("textarea");
    await notesInput.fill("Review note");
    await page.getByRole("button", { name: /Save notes|Uložiť poznámky/ }).click();
    await expect.poll(() => notes).toBe("Review note");
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("legal-entity-detail").locator("textarea")).toHaveValue("Review note");
    expect(writes[0]).toEqual({ ico: company.ico });
    expect(writes[1]).toEqual({ verificationId: "preview-test" });
    expect(errors).toEqual([]);
  });
}
