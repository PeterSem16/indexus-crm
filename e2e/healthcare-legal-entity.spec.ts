import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { healthcareLegalEntityTranslations } from "../client/src/i18n/healthcare-legal-entity-translations";
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
  test(`historical pending snapshots stay discoverable under an unchanged latest result at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    const c = healthcareLegalEntityTranslations.sk;
    const errors: string[] = [], reviewedIds: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const history = [
      { id: "unchanged", checkedAt: "2026-10-15T08:00:00Z", sourceUpdatedAt: null, changeStatus: "unchanged", review: null },
      { id: "pending-two", checkedAt: "2026-10-14T08:00:00Z", sourceUpdatedAt: null, changeStatus: "pending", review: null as any },
      { id: "pending-one", checkedAt: "2026-10-13T08:00:00Z", sourceUpdatedAt: null, changeStatus: "pending", review: null as any },
      { id: "baseline", checkedAt: "2026-10-12T08:00:00Z", sourceUpdatedAt: null, changeStatus: "baseline", review: null },
    ];
    const entity = () => ({ ...company, id: "historical-entity", notes: "", checkedAt: preview.checkedAt,
      sourceUpdatedAt: null, changeStatus: "unchanged", pendingSnapshotCount: history.filter(item => item.changeStatus === "pending").length });
    const comparison = (index: number) => ({ current: history[index], previous: history[index + 1] || null,
      fields: history[index].id === "unchanged" ? [] : [{ field: "name", before: "Earlier registered name", after: company.name }],
      roles: { removed: [], added: [] } });
    await page.route("**/api/**", route => {
      const req = route.request(), path = new URL(req.url()).pathname.replace(/\/$/, "");
      if (path === "/api/auth/heartbeat") return route.fulfill({ json: { ok: true } });
      if (path === api) return route.fulfill({ json: { items: [
        entity(),
        { ...entity(), id: "baseline-entity", name: "Baseline-only operator", changeStatus: "baseline", pendingSnapshotCount: 0 },
        { ...entity(), id: "latest-pending", name: "Latest pending operator", changeStatus: "pending", pendingSnapshotCount: 1 },
      ], canManage: true } });
      if (path === `${api}/historical-entity`) return route.fulfill({ json: {
        entity: entity(), facilities: [], people: [], registryPeople: [], personLinks: [],
        history, comparison: comparison(0), canManage: true, canViewSensitive: false,
      } });
      const selected = history.findIndex(item => path === `${api}/historical-entity/snapshots/${item.id}${req.method() === "POST" ? "/review" : ""}`);
      if (selected >= 0 && req.method() === "POST") {
        expect(req.postDataJSON()).toEqual({ confirm: true, note: "" });
        reviewedIds.push(history[selected].id);
        history[selected].changeStatus = "reviewed";
        history[selected].review = { reviewedBy: user.id, reviewedByName: user.fullName, reviewedAt: "2026-10-15T10:00:00Z" };
        return route.fulfill({ json: comparison(selected) });
      }
      if (selected >= 0) return route.fulfill({ json: { snapshot: history[selected], comparison: comparison(selected) } });
      if (req.method() !== "GET") return route.fulfill({ status: 405, json: { error: "Unexpected write" } });
      return route.fulfill({ json: path === "/api/auth/me" ? { user } : path.includes("permissions") ? {} : [] });
    });
    await page.goto("/healthcare-legal-entities", { waitUntil: "networkidle" });
    const countFilter = page.getByTestId("filter-pending-registry-snapshots");
    await expect(countFilter).toHaveText(`${c.pendingSnapshots}: 3`);
    await expect(page.getByText(c.latestReviewStatus, { exact: true })).toBeVisible();
    await countFilter.click();
    await expect(page.getByText("Baseline-only operator", { exact: true })).toHaveCount(0);
    await expect(page.getByText(company.name, { exact: true })).toBeVisible();
    await expect(page.getByText("Latest pending operator", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: `${c.pendingSnapshots}: 2`, exact: true }).click();
    await expect(page).toHaveURL(/history=pending/);
    const detail = page.getByTestId("legal-entity-detail");
    await expect(detail.getByTestId("legal-entity-tab-history")).toHaveAttribute("aria-current", "page");
    await expect(detail.getByRole("button", { name: c.snapshot, exact: true })).toHaveCount(2);
    await detail.getByRole("button", { name: c.snapshot, exact: true }).last().click();
    const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: new RegExp(c.snapshot) }) });
    await dialog.getByTestId("button-review-registry-changes").click();
    await expect(dialog).toContainText(c.changesReviewed);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(detail.getByRole("button", { name: c.snapshot, exact: true })).toHaveCount(1);
    await detail.getByRole("button", { name: `${c.allSnapshots} (4)`, exact: true }).click();
    await expect(detail.getByRole("button", { name: c.snapshot, exact: true })).toHaveCount(4);
    await page.reload({ waitUntil: "networkidle" });
    await expect(detail.getByRole("button", { name: c.snapshot, exact: true })).toHaveCount(1);
    expect(reviewedIds).toEqual(["pending-one"]);
    expect(errors).toEqual([]);
  });
}

for (const width of [1360, 390]) {
  test(`saved OR SR changes can be explicitly reviewed and restored after reload at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    const c = healthcareLegalEntityTranslations.sk;
    page.on("pageerror", error => errors.push(error.message));
    const entityId = "review-entity";
    const snapshot = { id: "review-snapshot", checkedAt: preview.checkedAt, sourceUpdatedAt: preview.sourceUpdatedAt };
    let review: any = null;
    let failReview = true;
    const note = '<img src=x onerror="alert(1)">\nRozdiely sú posúdené & vysvetlené.';
    const writes: any[] = [];
    const comparison = () => ({ current: { ...snapshot, review }, previous: { ...snapshot, id: "earlier-snapshot", checkedAt: "2026-10-14T08:00:00Z" },
      fields: [{ field: "name", before: "Previous operator name", after: company.name }], roles: { removed: [], added: [] } });
    await page.route("**/api/**", route => {
      const req = route.request(), path = new URL(req.url()).pathname.replace(/\/$/, "");
      const entity = { ...company, id: entityId, notes: "", checkedAt: preview.checkedAt,
        sourceUpdatedAt: preview.sourceUpdatedAt, changeStatus: review ? "reviewed" : "pending" };
      if (path === "/api/auth/heartbeat") return route.fulfill({ json: { ok: true } });
      if (path === `${api}/${entityId}/snapshots/${snapshot.id}/review` && req.method() === "POST") {
        writes.push(req.postDataJSON());
        if (failReview) { failReview = false; return route.fulfill({ status: 500, json: { error: "request_failed" } }); }
        review = { reviewedBy: user.id, reviewedByName: user.fullName, reviewedAt: "2026-10-15T15:30:00Z", note: req.postDataJSON().note || null };
        return route.fulfill({ json: comparison() });
      }
      if (req.method() !== "GET") return route.fulfill({ status: 405, json: { error: "Unexpected write" } });
      if (path === api) return route.fulfill({ json: { items: [entity], canManage: true } });
      if (path === `${api}/${entityId}`) return route.fulfill({ json: {
        entity, facilities: [], people: [], registryPeople: [], personLinks: [], canManage: true, canViewSensitive: false,
        history: [{ ...snapshot, review, changeStatus: entity.changeStatus }], comparison: comparison(),
      } });
      if (path === `${api}/${entityId}/snapshots/${snapshot.id}`) return route.fulfill({ json: { snapshot, comparison: comparison() } });
      return route.fulfill({ json: path === "/api/auth/me" ? { user } : path.includes("permissions") ? {} : [] });
    });
    await page.goto(`/healthcare-legal-entities?id=${entityId}`, { waitUntil: "networkidle" });
    const panel = page.getByTestId("legal-entity-detail").getByTestId("registry-comparison-panel");
    await expect(panel).toContainText(c.changesPending);
    await panel.getByTestId("input-registry-review-note").fill(note);
    await panel.getByTestId("button-review-registry-changes").click();
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(panel.getByTestId("input-registry-review-note")).toHaveValue(note);
    await expect(panel.getByTestId("button-review-registry-changes")).toBeEnabled();
    await panel.getByTestId("button-review-registry-changes").click();
    await expect(panel).toContainText(`${c.reviewedBy}: Synthetic reviewer`);
    await expect(panel).toContainText(`${c.reviewedAt}:`);
    await expect(panel.getByTestId("registry-review-note")).toContainText(note);
    await expect(panel.getByTestId("registry-review-note").locator("img")).toHaveCount(0);
    await expect(panel.getByTestId("button-review-registry-changes")).toHaveCount(0);
    await page.reload({ waitUntil: "networkidle" });
    await expect(panel).toContainText(`${c.reviewedBy}: Synthetic reviewer`);
    await expect(panel.getByTestId("registry-review-note")).toContainText(note);
    await page.getByTestId("legal-entity-tab-history").click();
    await expect(page.getByTestId("legal-entity-detail")).toContainText(`${c.reviewedBy}: Synthetic reviewer`);
    await expect(page.getByTestId("registry-review-note")).toHaveCount(2);
    await page.getByRole("button", { name: c.snapshot, exact: true }).click();
    const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: new RegExp(c.snapshot) }) });
    await expect(dialog.getByTestId("registry-comparison-panel")).toContainText(`${c.reviewedBy}: Synthetic reviewer`);
    await expect(dialog.getByTestId("button-review-registry-changes")).toHaveCount(0);
    await expect(dialog.getByTestId("registry-review-note")).toContainText(note);
    await page.screenshot({ path: `test-results/healthcare-legal-entity-reviewed-${width}.png`, animations: "disabled" });
    expect(writes).toEqual([{ confirm: true, note }, { confirm: true, note }]);
    expect(errors).toEqual([]);
  });
}

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
    await expect(page.getByTestId("nav-healthcare-legal-entities")).toHaveCount(0);
    await expect(page.getByTestId("tab-legal-entities")).toHaveAttribute("data-state", "active");
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

type FacilityType = "clinic" | "hospital";
type Mutation = { path: string; method: string; body: Record<string, unknown> | null };
const formattedIco = "12 345 678"; // OR SR accepts whitespace and returns canonical IČO.
const entityId = "hle-nested-entity";
const confirmOperator = "I confirm this company is the operator of this site.";
const replaceOperator = "Replace the current active operator";
const saveLink = "Save company and operator link";
const fixtureUrl = (type: FacilityType, ico = formattedIco) =>
  `/test-fixtures/healthcare-legal-entity.html?${new URLSearchParams({ type, ico })}`;

/** All API requests stay inside the browser; no credentials or live writes. */
async function nestedFixture(page: Page, type: FacilityType,
  { hasOperator = false, authenticated = true, storedIco = formattedIco, structuredAddress = false } = {}) {
  const errors: string[] = [];
  const writes: Mutation[] = [];
  const blocked: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const facility = {
    id: `hle-${type}`, type, name: `Synthetic ${type}`, ico: storedIco, countryCode: "SK",
    address: "Site street 4", city: "Trnava", postalCode: "91701",
  };
  const oldLink = {
    id: "old-operator", legalEntityId: "old-entity", legalEntityName: "Previous synthetic operator",
    facilityType: type, facilityId: facility.id, facilityName: facility.name,
    relationship: "operator", validFrom: "2025-01-01T00:00:00Z", validTo: null as string | null,
    confirmedAt: "2025-01-01T00:00:00Z",
  };
  const links = hasOperator ? [oldLink] : [];
  let savedFacility: Record<string, unknown> | undefined;
  let saved = false;
  const entity = { ...company, id: entityId, notes: "", checkedAt: preview.checkedAt,
    sourceUpdatedAt: preview.sourceUpdatedAt, facilityCount: 1 };
  await page.route("**/api/**", async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/\/$/, "");
    const method = req.method();
    if (method !== "GET") writes.push({ path, method, body: req.postData() ? req.postDataJSON() : null });
    if (path === "/api/auth/me") return route.fulfill({ status: authenticated ? 200 : 401,
      json: authenticated ? { user } : { error: "unauthorized" } });
    if (path === "/api/auth/heartbeat") return route.fulfill({ json: { ok: true } });
    if (path === `${api}/verify` && method === "POST") return route.fulfill({ json: { ...preview, facility } });
    if (path === `${api}/save` && method === "POST") {
      const body = req.postDataJSON();
      if (body.applyFields?.length) return route.fulfill({ status: 400, json: { error: "invalid" } });
      if (links.some(link => !link.validTo && link.legalEntityId !== entityId) && !body.replaceExisting) {
        return route.fulfill({ status: 409, json: { error: "operator_conflict" } });
      }
      if (!body.confirmOperator) return route.fulfill({ status: 400, json: { error: "confirmation_required" } });
      if (facility.ico.replace(/\s/g, "") !== company.ico) {
        return route.fulfill({ status: 409, json: { error: "ico_mismatch" } });
      }
      if (body.replaceExisting) links.forEach(link => { link.validTo = "2026-10-15T09:00:00Z"; });
      links.push({ ...oldLink, id: "current-operator", legalEntityId: entityId,
        legalEntityName: company.name, validTo: null });
      saved = true;
      return route.fulfill({ json: { entityId, linkId: "current-operator" } });
    }
    if (path === `${api}/${entityId}/facilities/current-operator/end` && method === "POST") {
      links.find(link => link.id === "current-operator")!.validTo = "2026-10-15T10:00:00Z";
      return route.fulfill({ json: { ok: true } });
    }
    if (path === `/api/${type === "clinic" ? "clinics" : "hospitals"}/${facility.id}` && method === "PUT") {
      savedFacility = req.postDataJSON();
      return route.fulfill({ json: { ...facility, ...savedFacility } });
    }
    if (method !== "GET") {
      blocked.push(`${method} ${path}`);
      return route.fulfill({ status: 405, json: { error: "Unexpected fixture write blocked" } });
    }
    if (path === `${api}/facilities/${type}/${facility.id}`) return route.fulfill({ json: {
      facility, links, canManage: true,
      registryCompany: saved && links.some(link => link.legalEntityId === entityId && !link.validTo) ? company : null,
    } });
    if (path === api) return route.fulfill({ json: { items: saved ? [entity] : [], canManage: true } });
    if (path === `${api}/${entityId}`) return route.fulfill({ json: {
      entity, facilities: links.filter(link => link.legalEntityId === entityId),
      people: [], registryPeople: [], personLinks: [], history: [], audit: [],
      canManage: true, canViewSensitive: true, rawData: {},
    } });
    // Auxiliary drawer lookups (users, geography, tags, networks) are empty.
    return route.fulfill({ json: path.includes("settings") || path.includes("permissions") ? {} : [] });
  });
  await page.goto(fixtureUrl(type, storedIco) + (structuredAddress ? "&structuredAddress=true" : ""));
  return {
    errors, blocked, writes, links, facility, savedFacility: () => savedFacility,
    saveRequests: () => writes.filter(write => write.path === `${api}/save`),
    parentWrites: () => writes.filter(write => write.path === `/api/${type === "clinic" ? "clinics" : "hospitals"}/${facility.id}`),
  };
}

const fields = (page: Page, type: FacilityType) => ({
  name: page.getByTestId(type === "clinic" ? "input-clinic-name" : "input-ed-hospital-fullname"),
  ico: page.getByTestId(type === "clinic" ? "input-clinic-ico" : "input-ed-hospital-ico"),
  city: page.getByTestId(type === "clinic" ? "input-clinic-city" : "input-ed-hospital-city"),
  postalCode: page.getByTestId(type === "clinic" ? "input-clinic-postal" : "input-ed-hospital-postalcode"),
  save: page.getByTestId(type === "clinic" ? "button-save-clinic-drawer" : "button-save-hospital-drawer"),
});
async function addressTab(page: Page, type: FacilityType) {
  if (type === "clinic") await page.getByTestId("tab-clinic-address-drawer").click();
}
async function draftName(page: Page, type: FacilityType) {
  await fields(page, type).name.fill("Unsaved operational name");
  await addressTab(page, type);
}
async function openVerification(page: Page, type: FacilityType) {
  await expect(page.getByTestId(`healthcare-legal-entity-panel-${type}`).getByRole("button", { name: "Verify IČO", exact: true })).toBeEnabled();
  await page.getByTestId(`healthcare-legal-entity-panel-${type}`).getByRole("button", { name: "Verify IČO", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Registry verification" });
  await expect(dialog.getByRole("textbox")).toHaveAttribute("readonly", "");
  await dialog.getByRole("button", { name: "Verify IČO", exact: true }).click();
  await expect(dialog).toContainText(company.name);
  return dialog;
}
async function foregroundControl(control: Locator, page: Page) {
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  expect(await control.evaluate(element => {
    const r = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
}
async function assertDraft(page: Page, type: FacilityType) {
  if (type === "clinic") await page.getByTestId("tab-clinic-basic-drawer").click();
  await expect(fields(page, type).name).toHaveValue("Unsaved operational name");
  await addressTab(page, type);
}

for (const type of ["clinic", "hospital"] as const) {
  for (const width of [1360, 390]) {
    test.describe(`${type} native nested OR SR at ${width}px`, () => {
      test.use({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      test.setTimeout(90_000);

      test("comparison, cancel and confirm preserve drafts without implicit overwrites", async ({ page }) => {
        const state = await nestedFixture(page, type);
        await draftName(page, type);
        let dialog = await openVerification(page, type);
        // The real sheet/custom drawer is still mounted underneath the modal.
        const parent = type === "clinic" ? page.locator('[data-drawer-side="right"]').first()
          : page.locator('[data-fluid-drawer-width="wide"]');
        await expect(parent).toBeAttached();
        await foregroundControl(dialog.getByRole("heading"), page);
        expect(await dialog.evaluate(element => Number(getComputedStyle(element).zIndex)))
          .toBeGreaterThan(await parent.evaluate(element => Number(getComputedStyle(element).zIndex)));
        await expect(dialog).toContainText("Current site");
        await expect(dialog).toContainText("Registry value");
        for (const [label, current, registered] of [
          ["Company name", `Synthetic ${type}`, company.name],
          ["Registered address", "Site street 4", company.registeredAddress],
          ["City", "Trnava", company.city],
          ["Postal code", "91701", company.postalCode],
          ["IČO", formattedIco, company.ico],
        ]) {
          if (label !== "IČO") {
            await expect(dialog).toContainText(current);
            await expect(dialog).toContainText(registered);
          }
        }
        await expect(dialog.getByRole("checkbox")).toHaveCount(2);
        await expect(dialog.getByRole("checkbox", { checked: true })).toHaveCount(0);
        await expect(dialog.getByRole("button", { name: saveLink, exact: true })).toBeDisabled();
        await page.screenshot({ path: test.info().outputPath("nested-comparison.png"), animations: "disabled" });
        expect(state.saveRequests()).toEqual([]);
        // Cancellation must not mutate the operator, facility or unsaved form.
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
        await assertDraft(page, type);
        expect(state.parentWrites()).toEqual([]);
        dialog = await openVerification(page, type);
        await expect(dialog.getByRole("checkbox", { checked: true })).toHaveCount(0);
        await dialog.getByRole("checkbox", { name: confirmOperator, exact: true }).check();
        await foregroundControl(dialog.getByRole("button", { name: saveLink, exact: true }), page);
        await dialog.getByRole("button", { name: saveLink, exact: true }).click();
        await expect(dialog).not.toBeVisible();
        expect(state.saveRequests().map(write => write.body)).toEqual([{
          verificationId: preview.verificationId, facilityType: type, facilityId: `hle-${type}`, confirmOperator: true,
        }]);
        expect(state.writes.filter(write => write.path === `${api}/verify`).map(write => write.body)).toEqual([
          { ico: formattedIco, facilityType: type, facilityId: `hle-${type}` },
          { ico: formattedIco, facilityType: type, facilityId: `hle-${type}` },
        ]);
        expect(state.parentWrites()).toEqual([]);
        await expect(fields(page, type).ico).toHaveValue(formattedIco);
        await expect(fields(page, type).city).toHaveValue("Trnava");
        await expect(fields(page, type).postalCode).toHaveValue("91701");
        await expect(page.getByTestId(`healthcare-legal-entity-panel-${type}`)).toContainText("Confirmed operator");
        await assertDraft(page, type);
        await fields(page, type).save.click();
        await expect.poll(state.savedFacility).toBeTruthy();
        expect(state.savedFacility()).toMatchObject({ name: "Unsaved operational name", ico: formattedIco,
          city: "Trnava", postalCode: "91701" });
        expect(state.errors).toEqual([]);
        expect(state.blocked).toEqual([]);
      });

      test("registry differences stay read-only and never enter the draft or parent save", async ({ page }) => {
        const state = await nestedFixture(page, type);
        await draftName(page, type);
        const dialog = await openVerification(page, type);
        await expect(dialog.getByRole("checkbox")).toHaveCount(2);
        await expect(dialog).toContainText("Site street 4");
        await expect(dialog).toContainText(company.registeredAddress);
        await expect(dialog.getByRole("checkbox", { name: replaceOperator, exact: true })).not.toBeChecked();
        await dialog.getByRole("checkbox", { name: confirmOperator, exact: true }).check();
        await dialog.getByRole("button", { name: saveLink, exact: true }).click();
        await expect(dialog).not.toBeVisible();
        expect(state.saveRequests()[0].body).toEqual({
          verificationId: preview.verificationId, facilityType: type, facilityId: `hle-${type}`,
          confirmOperator: true,
        });
        expect(state.parentWrites()).toEqual([]);
        await expect(fields(page, type).ico).toHaveValue(formattedIco);
        await expect(fields(page, type).city).toHaveValue("Trnava");
        await expect(fields(page, type).postalCode).toHaveValue("91701");
        await assertDraft(page, type);
        await fields(page, type).save.click();
        await expect.poll(state.savedFacility).toBeTruthy();
        expect(state.savedFacility()).toMatchObject({
          name: "Unsaved operational name", ico: formattedIco, city: "Trnava", postalCode: "91701",
          [type === "clinic" ? "address" : "streetNumber"]: "Site street 4",
        });
        if (type === "clinic") expect(state.savedFacility()).toMatchObject({
          address: "Site street 4",
        });
        expect(state.errors).toEqual([]);
        expect(state.blocked).toEqual([]);
      });

      if (type === "clinic") test("structured clinic address survives confirmation and unrelated card save verbatim", async ({ page }) => {
        const state = await nestedFixture(page, type, { structuredAddress: true });
        await draftName(page, type);
        await page.getByTestId("input-clinic-postal").fill("91702");
        const dialog = await openVerification(page, type);
        await dialog.getByRole("checkbox", { name: confirmOperator, exact: true }).check();
        await dialog.getByRole("button", { name: saveLink, exact: true }).click();
        await expect(dialog).not.toBeVisible();
        expect(state.parentWrites()).toEqual([]);
        await expect(page.getByTestId("input-clinic-street")).toHaveValue("Site street");
        await expect(page.getByTestId("input-clinic-street-number")).toHaveValue("4");
        await expect(page.getByTestId("input-clinic-orientation-number")).toHaveValue("2");
        await expect(fields(page, type).postalCode).toHaveValue("91702");
        await assertDraft(page, type);
        await fields(page, type).save.click();
        await expect.poll(state.savedFacility).toBeTruthy();
        expect(state.savedFacility()).toMatchObject({
          name: "Unsaved operational name", address: "Site street 4/2, Trnava, SK",
          street: "Site street", streetNumber: "4", orientationNumber: "2", postalCode: "91702",
        });
        expect(state.errors).toEqual([]);
        expect(state.blocked).toEqual([]);
      });

      test("operator conflict keeps modal and draft until replacement is explicitly confirmed", async ({ page }) => {
        const state = await nestedFixture(page, type, { hasOperator: true });
        await draftName(page, type);
        const dialog = await openVerification(page, type);
        await dialog.getByRole("checkbox", { name: confirmOperator, exact: true }).check();
        await dialog.getByRole("button", { name: saveLink, exact: true }).click();
        await expect(dialog.getByRole("alert")).toHaveText("Another active operator is already linked. Explicitly confirm replacement to continue.");
        expect(state.links).toHaveLength(1);
        expect(state.links[0].validTo).toBeNull();
        expect(state.saveRequests()[0].body).not.toHaveProperty("replaceExisting");
        await expect(dialog.getByRole("checkbox", { name: replaceOperator, exact: true })).not.toBeChecked();
        await dialog.getByRole("checkbox", { name: replaceOperator, exact: true }).check();
        await dialog.getByRole("button", { name: saveLink, exact: true }).click();
        await expect(dialog).not.toBeVisible();
        expect(state.saveRequests()).toHaveLength(2);
        expect(state.saveRequests()[1].body).toEqual({
          verificationId: preview.verificationId, facilityType: type, facilityId: `hle-${type}`,
          confirmOperator: true, replaceExisting: true,
        });
        const panel = page.getByTestId(`healthcare-legal-entity-panel-${type}`);
        await expect(panel).toContainText("Previous synthetic operator");
        await expect(panel).toContainText(company.name);
        await expect(panel).toContainText("Ended");
        await expect(panel).toContainText("Confirmed operator");
        await assertDraft(page, type);
        await expect(fields(page, type).ico).toHaveValue(formattedIco);
        expect(state.parentWrites()).toEqual([]);
        expect(state.errors).toEqual([]);
        expect(state.blocked).toEqual([]);
      });

      test("a different saved IČO is never overwritten to force an operator link", async ({ page }) => {
        const state = await nestedFixture(page, type, { storedIco: "87654321" });
        await draftName(page, type);
        const dialog = await openVerification(page, type);
        await expect(dialog).toContainText("87654321");
        await expect(dialog.getByRole("checkbox")).toHaveCount(2);
        await dialog.getByRole("checkbox", { name: confirmOperator, exact: true }).check();
        await dialog.getByRole("button", { name: saveLink, exact: true }).click();
        await expect(dialog.getByRole("alert")).toBeVisible();
        expect(state.facility.ico).toBe("87654321");
        expect(state.links).toEqual([]);
        expect(state.saveRequests()[0].body).not.toHaveProperty("applyFields");
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
        await expect(fields(page, type).ico).toHaveValue(formattedIco);
        await expect(fields(page, type).city).toHaveValue("Trnava");
        await assertDraft(page, type);
        expect(state.parentWrites()).toEqual([]);
        expect(state.errors).toEqual([]);
        expect(state.blocked).toEqual([]);
      });

      test("open linked entity, cancel ending, then end relationship and retain history on reopened card", async ({ page }) => {
        const state = await nestedFixture(page, type);
        await addressTab(page, type);
        const dialog = await openVerification(page, type);
        await dialog.getByRole("checkbox", { name: confirmOperator, exact: true }).check();
        await dialog.getByRole("button", { name: saveLink, exact: true }).click();
        await expect(dialog).not.toBeVisible();
        await page.getByTestId(`healthcare-legal-entity-panel-${type}`).getByRole("button", { name: "Open entity", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/healthcare-legal-entities\\?id=${entityId}`));
        const detail = page.getByTestId("legal-entity-detail");
        await detail.getByRole("button", { name: "Healthcare sites", exact: true }).click();
        await detail.getByRole("button", { name: "End link", exact: true }).click();
        const confirmation = page.getByRole("alertdialog");
        await expect(confirmation).toContainText("The relationship will remain in history and will no longer be active.");
        await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
        expect(state.writes.filter(write => write.path.endsWith("/end"))).toEqual([]);
        await detail.getByRole("button", { name: "End link", exact: true }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "Confirm", exact: true }).click();
        await expect(confirmation).not.toBeVisible();
        await expect(detail).toContainText("Ended");
        await expect(detail.getByRole("button", { name: "End link", exact: true })).toHaveCount(0);
        expect(state.writes.filter(write => write.path.endsWith("/end"))).toEqual([{
          path: `${api}/${entityId}/facilities/current-operator/end`, method: "POST", body: null,
        }]);
        await page.goto(fixtureUrl(type));
        await addressTab(page, type);
        const panel = page.getByTestId(`healthcare-legal-entity-panel-${type}`);
        await expect(panel).toContainText(company.name);
        await expect(panel).toContainText("Ended");
        await expect(panel).not.toContainText("Confirmed operator");
        expect(state.parentWrites()).toEqual([]);
        expect(state.errors).toEqual([]);
        expect(state.blocked).toEqual([]);
      });
    });
  }
}

test("native facility harness still requires the normal authenticated API response", async ({ page }) => {
  await nestedFixture(page, "clinic", { authenticated: false });
  await expect(page.getByRole("alert")).toHaveText("Fixture requires an authenticated API response");
  await expect(page.getByTestId("healthcare-legal-entity-panel-clinic")).toHaveCount(0);
});
