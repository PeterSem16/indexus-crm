import { expect, test, type Page } from "@playwright/test";
test.setTimeout(60000);

const campaignId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const items = [{
  id: itemId, campaignId, label: "Záujem o spoluprácu", stepId: "MPN-01", parentId: null,
  sortOrder: 0, required: false, isHidden: false, itemType: "step", tab: "acquisition",
  confirmationType: "checkbox", automations: [], description: "Vyberte odpoveď podľa rozhovoru.",
  questions: [],
}];

async function setup(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    errors.push(`Native dialog: ${dialog.message()}`);
    await dialog.dismiss();
  });
  await page.route("**/test-fixtures/status-list-admin.html*", async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/src="\/src\/main\.tsx[^"]*"/, 'src="/test-fixtures/status-list-admin.tsx"');
    await route.fulfill({ response, body: html });
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") return route.fulfill({ json: { ok: true } });
    if (path.endsWith("/status-list")) return route.fulfill({ json: items });
    if (path.endsWith("/status-list-workflows")) return route.fulfill({ json: { rules: [], catalog: [] } });
    if (path.endsWith("/option-sources") || path.endsWith("/sources")) return route.fulfill({ json: { sources: [], catalog: [], coordinators: [] } });
    return route.fulfill({ json: [] });
  });
  await page.goto("/test-fixtures/status-list-admin.html?locale=sk");
  await expect(page.getByTestId("status-list-workspace")).toBeVisible();
  return errors;
}

test("Content outline Add step opens the existing root-step studio flow", async ({ page }) => {
  const errors = await setup(page);
  await expect(page.getByTestId("status-list-add-step-content")).toBeVisible();
  await page.getByTestId("status-list-add-step-content").click();
  await expect(page.getByTestId("status-list-studio-create")).toBeVisible();

  // The original Tools entry remains available and keeps opening the same flow.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("status-list-studio-create")).toHaveCount(0);
  await page.getByTestId("status-list-tab-tools").click();
  await page.getByTestId("btn-add-status-list-item").click();
  await expect(page.getByTestId("status-list-studio-create")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Add step uses guarded navigation while the selected step has unsaved edits", async ({ page }) => {
  const errors = await setup(page);
  await page.getByTestId(`status-list-select-${itemId}`).click();
  await page.getByTestId("studio-stage-content").click();
  await page.getByTestId("status-list-step-name").fill("Neuložená zmena");
  await page.getByTestId("status-list-add-step-content").click();
  await expect(page.getByTestId("status-list-confirm-modal")).toBeVisible();
  await page.getByTestId("status-list-confirm-cancel").click();
  await expect(page.getByTestId("status-list-step-name")).toHaveValue("Neuložená zmena");

  await page.getByTestId("status-list-add-step-content").click();
  await page.getByTestId("status-list-confirm-accept").click();
  await expect(page.getByTestId("status-list-studio-create")).toBeVisible();
  expect(errors).toEqual([]);
});
