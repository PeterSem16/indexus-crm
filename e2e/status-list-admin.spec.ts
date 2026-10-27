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
async function setup(page: Page, locale = "sk", dark = false, additionalItems: any[] = []) {
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
    if (path.endsWith("/status-list")) return route.fulfill({ json: [...items, ...additionalItems] });
    if (path.endsWith("/service-history")) return route.fulfill({ json: { events: [{
      id: "callback:1", at: "2026-10-21T08:00:00Z", automationId: actionId, actionType: "set_callback",
      state: "done", outcome: "kept_existing", callbackDate: "2026-10-28T08:00:00Z",
      actorName: "Agent", itemLabel: items[0].label, questionLabel: items[0].questions[0].questionText,
    }] } });
    if (path.endsWith("/status-list-workflows")) return route.fulfill({ json: { rules: [], catalog: [
      ...[...items, ...additionalItems].map(item => ({ kind: "item", id: item.id, label: item.label, fieldType: "checkbox", hidden: false, writable: true })),
      { kind: "question", id: questionId, label: "Má záujem", fieldType: "checkbox", hidden: false, writable: true },
    ] } });
    if (path.endsWith("/option-sources") || path.endsWith("/sources")) return route.fulfill({ json: { sources: [], catalog: [], coordinators: [] } });
    return route.fulfill({ json: [] });
  });
  await page.goto(`/test-fixtures/status-list-admin.html?locale=${locale}${dark ? "&dark" : ""}`);
  await expect(page.getByTestId("status-list-workspace")).toBeVisible();
  return { errors, writes };
}

const quickTranslations = { en: "Reschedule call", sk: "Preplánovať hovor", cs: "Přeplánovat hovor", hu: "Hívás átütemezése", ro: "Reprogramează apelul", it: "Riprogramma chiamata", de: "Anruf verschieben" };
const translatedQuickId = "55555555-5555-4555-8555-555555555555";
const quickItem = { ...items[0], id: translatedQuickId, itemType: "option", label: "preplánovať hovor", questions: [], automations: [] };

test("AI names remain editable drafts, save together and survive reopening", async ({ page }) => {
  const state = await setup(page, "en", false, [quickItem]);
  let saved = { ...quickItem, labelTranslations: {} };
  let generationCalls = 0;
  await page.route("**/status-list-label-translations", async route => {
    generationCalls++;
    expect(route.request().postDataJSON()).toEqual({ text: quickItem.label });
    await route.fulfill({ json: { translations: quickTranslations } });
  });
  await page.route(`**/status-list/${translatedQuickId}`, async route => {
    expect(route.request().method()).toBe("PUT");
    saved = { ...saved, ...route.request().postDataJSON() };
    await route.fulfill({ json: saved });
  });
  await page.route(`**/campaigns/${campaignId}/status-list`, route => route.fulfill({ json: [...items, saved] }));
  await page.getByTestId(`status-list-select-${translatedQuickId}`).click();
  await page.getByTestId("quick-option-ai-translate").click();
  for (const [language, name] of Object.entries(quickTranslations)) {
    await expect(page.getByTestId(`quick-option-name-${language}`)).toHaveValue(name);
  }
  await expect(page.getByTestId("quick-option-preview")).toHaveText(quickTranslations.en);
  expect(state.writes).toEqual([]);
  expect(generationCalls).toBe(1);
  await page.getByTestId("quick-option-name-de").fill("Rückruf verschieben");
  await page.getByTestId("quick-option-save").click();
  await expect(page.getByTestId("quick-option-save")).toBeDisabled();
  expect(saved.labelTranslations).toEqual({ ...quickTranslations, de: "Rückruf verschieben" });
  await page.reload();
  await page.getByTestId(`status-list-select-${translatedQuickId}`).click();
  await expect(page.getByTestId("quick-option-name-de")).toHaveValue("Rückruf verschieben");
  await page.screenshot({ path: "/tmp/status-list-button-translations.jpg", fullPage: true });
  await page.getByTestId("quick-option-name").fill("Nový názov");
  for (const language of Object.keys(quickTranslations)) await expect(page.getByTestId(`quick-option-name-${language}`)).toHaveValue("");
  await expect(page.getByTestId("quick-option-preview")).toHaveText("Nový názov");
  expect(state.errors).toEqual([]);
});

test("a new Quick Option can generate and save all seven names before its first save", async ({ page }) => {
  const state = await setup(page, "en");
  let created: any = null;
  await page.route("**/status-list-label-translations", route => route.fulfill({ json: { translations: quickTranslations } }));
  await page.route(`**/campaigns/${campaignId}/status-list`, async route => {
    if (route.request().method() === "POST") {
      created = { ...quickItem, ...route.request().postDataJSON(), id: translatedQuickId };
      return route.fulfill({ json: created });
    }
    return route.fulfill({ json: created ? [...items, created] : items });
  });
  await page.getByTestId("status-list-tab-tools").click();
  await page.getByTestId("btn-add-status-list-option").click();
  await page.getByTestId("input-option-label").fill(quickItem.label);
  await page.getByTestId("quick-option-ai-translate").click();
  await expect(page.getByTestId("quick-option-name-de")).toHaveValue(quickTranslations.de);
  expect(created).toBeNull();
  await page.getByTestId("btn-confirm-add-option").click();
  await expect(page.getByTestId("status-list-quick-option-editor")).toBeVisible();
  expect(created.labelTranslations).toEqual(quickTranslations);
  expect(created.label).toBe(quickItem.label);
  expect(state.errors).toEqual([]);
});

test("AI errors preserve the manually reviewed translations and do not save", async ({ page }) => {
  const state = await setup(page, "sk", true, [{ ...quickItem, labelTranslations: quickTranslations }]);
  await page.route("**/status-list-label-translations", route => route.fulfill({ status: 503, json: { error: "translation_unavailable" } }));
  await page.getByTestId(`status-list-select-${translatedQuickId}`).click();
  await page.getByTestId("quick-option-ai-translate").click();
  await expect(page.getByTestId("quick-option-translation-error")).toBeVisible();
  await expect(page.getByTestId("quick-option-name-de")).toHaveValue(quickTranslations.de);
  await expect(page.getByTestId("quick-option-save")).toBeDisabled();
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test("a main question exposes Add subquestion immediately and opens its creation modal", async ({ page }) => {
  const state = await setup(page);
  await page.getByTestId(`status-list-select-${itemId}`).click();
  const add = page.getByTestId(`status-list-add-subquestion-${itemId}`);
  await expect(add).toBeVisible();
  await add.click();
  await expect(page.getByTestId("status-list-studio-create")).toBeVisible();
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test("Quick Option has focused tabs and callback editing stays in a modal", async ({ page }) => {
  const quickId = "55555555-5555-4555-8555-555555555555";
  const state = await setup(page, "sk", false, [{
    ...items[0], id: quickId, itemType: "option", label: "Preplánovať hovor",
    questions: [], automations: items[0].questions[0].automations,
  }]);
  await page.getByTestId(`status-list-select-${quickId}`).click();
  await expect(page.getByTestId("quick-option-editor-tabs")).toBeVisible();
  await page.locator("#quick-option-tab-actions").click();
  await expect(page.locator("#quick-option-panel-actions")).toBeVisible();
  await page.getByTestId(`service-action-edit-${actionId}`).click();
  const dialog = page.getByTestId("quick-option-action-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("status-list-service-action-editor")).toBeVisible();
  await expect(page.getByTestId("quick-option-action-editor")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/status-list-quick-option-modal.jpg" });
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

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

test("the real agent preview includes questions without executing anything", async ({ page }) => {
  const state = await setup(page);
  await page.getByTestId("status-list-tab-tools").click();
  await page.getByTestId("btn-toggle-preview").click();
  await expect(page.getByTestId("status-list-agent-preview")).toContainText("Má záujem, teraz nemôže hovoriť");
  await expect(page.getByTestId("status-list-preview-safety")).toBeVisible();
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
