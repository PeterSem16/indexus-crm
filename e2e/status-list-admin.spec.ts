import { expect, test, type Page } from "@playwright/test";

const campaignId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const questionId = "33333333-3333-4333-8333-333333333333";
const actionId = "44444444-4444-4444-8444-444444444444";
const items = [{
  id: itemId, campaignId, label: "Záujem o spoluprácu", stepId: "MPN-01", parentId: null,
  sortOrder: 0, required: false, isHidden: false, itemType: "step", tab: "acquisition",
  confirmationType: "checkbox", questionSelectionMode: "single", autoConfirmOnSubQuestion: false,
  canonicalClinicStatusKey: null, automations: [], description: "Vyberte odpoveď podľa rozhovoru.",
  questions: [{
    id: questionId, itemId, questionText: "Má záujem, teraz nemôže hovoriť", fieldType: "checkbox",
    sortOrder: 0, isHidden: false, required: false, groupName: "Výsledok", logicOperator: "ONE",
    automations: [{ id: actionId, actionType: "set_callback", callbackOffsetDays: 7,
      callbackTime: "09:00", callbackBusinessDaysOnly: true, callbackExistingPolicy: "keep_existing",
      conditionJson: '{"logic":"AND","rules":[{"field":"call_count","op":"gte","value":"1"}]}' }],
  }],
}];
async function setup(page: Page, locale = "sk", dark = false) {
  const errors: string[] = [], writes: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { errors.push(`Native dialog: ${dialog.message()}`); await dialog.dismiss(); });
  await page.route("**/test-fixtures/status-list-admin.html*", async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/src="\/src\/main\.tsx[^"]*"/, 'src="/test-fixtures/status-list-admin.tsx"');
    await route.fulfill({ response, body: html });
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") {
      writes.push(path);
      return route.fulfill({ json: { ok: true } });
    }
    if (path.endsWith("/status-list")) return route.fulfill({ json: items });
    if (path.endsWith("/service-history")) return route.fulfill({ json: { events: [{
      id: "callback:1", at: "2026-10-21T08:00:00Z", automationId: actionId, actionType: "set_callback",
      state: "done", outcome: "kept_existing", callbackDate: "2026-10-28T08:00:00Z",
      actorName: "Agent", itemLabel: items[0].label, questionLabel: items[0].questions[0].questionText,
    }] } });
    if (path.endsWith("/status-list-workflows")) return route.fulfill({ json: { rules: [], catalog: [] } });
    if (path.endsWith("/option-sources") || path.endsWith("/sources")) return route.fulfill({ json: { sources: [], catalog: [], coordinators: [] } });
    return route.fulfill({ json: [] });
  });
  await page.goto(`/test-fixtures/status-list-admin.html?locale=${locale}${dark ? "&dark" : ""}`);
  await expect(page.getByTestId("status-list-workspace")).toBeVisible();
  return { errors, writes };
}

test("unsaved navigation uses the modal; cancel preserves the draft and confirm discards it", async ({ page }) => {
  const state = await setup(page);
  await page.getByTestId(`status-list-select-${itemId}`).click();
  await page.getByTestId("studio-stage-content").click();
  await page.getByTestId("status-list-step-name").fill("Neuložená zmena");
  await page.getByTestId("status-list-tab-rules").click();
  await expect(page.getByTestId("status-list-confirm-modal")).toBeVisible();
  await page.getByTestId("status-list-confirm-cancel").click();
  await expect(page.getByTestId("status-list-step-name")).toHaveValue("Neuložená zmena");
  await page.getByTestId("status-list-tab-rules").click();
  await page.getByTestId("status-list-confirm-accept").click();
  await expect(page.getByTestId("status-list-tab-rules")).toHaveAttribute("aria-current", "page");
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test("answers have a suboption chooser; reporting help and original action history are readable", async ({ page }) => {
  const state = await setup(page);
  await page.getByTestId(`status-list-select-${itemId}`).click();
  await page.getByTestId("studio-stage-answer").click();
  await expect(page.getByTestId("status-list-answer-branches")).toContainText("Rôzne odpovede");
  await expect(page.getByTestId("status-list-canonical-status")).toBeVisible();
  await page.getByTestId("status-list-branch-select").selectOption(`question:${questionId}`);
  await expect(page.getByTestId("status-list-question-studio")).toContainText("Má záujem, teraz nemôže hovoriť");
  await page.getByTestId("status-list-tab-rules").click();
  await page.getByTestId("status-list-service-history").first().locator("summary").click();
  await expect(page.getByTestId("status-list-service-history").first()).toContainText("Ponechaný pôvodný termín");
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test("complete admin preview includes question actions and conditions without executing anything", async ({ page }) => {
  const state = await setup(page);
  await page.getByTestId("status-list-tab-tools").click();
  await page.getByTestId("btn-toggle-preview").click();
  await expect(page.locator(".sl-admin-preview")).toContainText("Má záujem, teraz nemôže hovoriť");
  await expect(page.locator(".sl-admin-preview")).toContainText("7");
  await page.screenshot({ path: "/tmp/status-list-admin-preview.jpg", fullPage: true });
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test("mobile dark editor remains within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page, "sk", true);
  await page.getByTestId(`status-list-select-${itemId}`).click();
  await page.getByTestId("studio-stage-answer").click();
  await expect(page.getByTestId("status-list-answer-branches")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
  expect(overflow).toBe(false);
  await page.screenshot({ path: "/tmp/status-list-admin-mobile.jpg", fullPage: true });
  expect(state.errors).toEqual([]);
});
