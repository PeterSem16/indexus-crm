import { expect, test, type Page } from "@playwright/test";

const campaignId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const optionA = "66666666-6666-4666-8666-666666666661";
const optionB = "66666666-6666-4666-8666-666666666662";
const optionC = "66666666-6666-4666-8666-666666666663";
const optionD = "66666666-6666-4666-8666-666666666664";
const optionCatalog = (count: number) => [
  { kind: "item", id: itemId, label: "Spolupráca", itemType: "step", confirmationType: "checkbox", hidden: false, writable: true },
  ...[optionA, optionB, optionC, optionD].slice(0, count).map((id, index) => ({
    kind: "item", id, label: ["Áno", "Nie", "Čaká", "Neurčené"][index], parentId: itemId, itemType: "option", hidden: false, writable: true,
  })),
];
const backgroundQuestion = "77777777-7777-4777-8777-777777777771";
const textQuestion = "77777777-7777-4777-8777-777777777772";

const items = [{
  id: itemId, campaignId, label: "Spolupráca", stepId: "MPN-01", parentId: null,
  sortOrder: 0, required: false, isHidden: false, itemType: "step", tab: "acquisition",
  confirmationType: "checkbox", questionSelectionMode: "single", autoConfirmOnSubQuestion: false,
  canonicalClinicStatusKey: null, automations: [], description: "",
  questions: [{ id: backgroundQuestion, itemId, questionText: "Priradené", fieldType: "yes_no", sortOrder: 0,
    isHidden: false, required: false, groupName: null, logicOperator: "OR", automations: [] }],
}];

async function setup(page: Page, dark = false, optionCount = 2, emptyStep = false) {
  const errors: string[] = [];
  let model = emptyStep ? [{ ...items[0], questions: [] as typeof items[0]["questions"],
    questionSelectionMode: "multiple", canonicalClinicStatusKey: "assignment_rep_unassigned" }] : items;
  let sourceRows: any[] = [];
  const parentCatalog = { kind: "item", id: itemId, label: "Spolupráca", fieldType: "checkbox",
    confirmationType: "checkbox", systemSourceEligible: true, hidden: false, writable: true };
  const plainCatalog = () => [parentCatalog, ...model[0].questions.map(q => ({
    kind: "question", id:q.id,parentId:itemId,label:q.questionText,fieldType:q.fieldType,systemSourceEligible:true,
    ...(sourceRows.some(s=>s.questionId===q.id)?{backgroundSource:"representative_assigned"}:{}),
  }))];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { errors.push(`Unexpected browser dialog: ${dialog.message()}`); await dialog.dismiss(); });
  await page.route("**/test-fixtures/status-list-admin.html*", async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/src="\/src\/main\.tsx[^"]*"/, 'src="/test-fixtures/status-list-admin.tsx"');
    await route.fulfill({ response, body: html });
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (emptyStep && path.endsWith("/sources") && route.request().method()==="POST") {
      const body=route.request().postDataJSON();
      expect(body.parentId).toBe(itemId);
      expect(body.config.source).toBe("representative_assigned");
      expect(body.config.check.behavior).toBe("confirm");
      model=[{...model[0],questions:[{...items[0].questions[0],questionText:body.label,isHidden:true}]}];
      sourceRows=[{questionId:backgroundQuestion,...body.config}];
      return route.fulfill({status:201,json:{questionId:backgroundQuestion,itemId}});
    }
    if (emptyStep && path.endsWith("/source-targets")) {
      expect(route.request().method()).toBe("POST");
      const body = route.request().postDataJSON();
      expect(body.source).toBe("representative_assigned");
      expect(body.parentId).toBe(itemId);
      model = [{ ...model[0], questions: [{ ...items[0].questions[0], questionText:body.label, isHidden:true }] }];
      return route.fulfill({ json: { questionId:backgroundQuestion,itemId } });
    }
    if (emptyStep && path.endsWith(`/sources/${backgroundQuestion}`)) {
      expect(route.request().method()).toBe("PUT");
      sourceRows = [{questionId:backgroundQuestion,...route.request().postDataJSON()}];
      return route.fulfill({ json: { ok:true } });
    }
    if (route.request().method() !== "GET") return route.fulfill({ json: { ok: true } });
    if (path.endsWith("/status-list")) return route.fulfill({ json: model });
    if (emptyStep && path.endsWith("/status-list-workflows")) return route.fulfill({json:{rules:[],catalog:plainCatalog()}});
    if (path.endsWith("/status-list-workflows")) return route.fulfill({ json: { rules: [], catalog: [
      { kind: "item", id: itemId, label: "Spolupráca", fieldType: "checkbox", hidden: false, writable: true },
    ] } });
    if (path.endsWith("/option-sources")) return route.fulfill({ json: { sources: [], coordinators: [], catalog: emptyStep ? plainCatalog() : optionCatalog(optionCount) } });
    if (emptyStep && path.endsWith("/sources")) return route.fulfill({json:{sources:sourceRows,catalog:plainCatalog()}});
    if (path.endsWith("/sources")) return route.fulfill({ json: { sources: [], catalog: [
      { kind: "question", id: backgroundQuestion, parentId: itemId, label: "Priradené", fieldType: "yes_no", systemSourceEligible: true },
      { kind: "question", id: textQuestion, parentId: itemId, label: "Typ priradenia", fieldType: "text", systemSourceEligible: true },
    ] } });
    return route.fulfill({ json: [] });
  });
  await page.goto(`/test-fixtures/status-list-admin.html?locale=sk${dark ? "&dark" : ""}`);
  await expect(page.getByTestId("status-list-workspace")).toBeVisible();
  return errors;
}

test("plain step without questions exposes source setup and creates the coordinator check in place", async ({page})=>{
  const errors = await setup(page,false,0,true);
  await page.getByTestId(`status-list-select-${itemId}`).click();
  await page.getByTestId("studio-stage-answer").click();
  const sourcePanel = page.getByTestId("status-list-background-sources");
  await expect(sourcePanel).toBeVisible();
  await expect(page.getByText("No compatible system source for this item.", {exact:false})).toHaveCount(0);
  const setupButton = sourcePanel.getByRole("button",{name:"Nastaviť zdroj",exact:true});
  await expect(setupButton).toBeVisible();
  await setupButton.scrollIntoViewIfNeeded();
  await page.screenshot({path:"/tmp/status-list-empty-step-source-button.jpg"});
  await setupButton.click();
  await expect(page.getByTestId("background-source-kind")).toHaveValue("representative_information");
  await expect(page.getByTestId("representative-check-settings")).toBeVisible();
  await page.getByTestId("representative-check-assigned-actions").click();
  await page.getByTestId("source-editor-stage-review").click();
  await expect(page.getByTestId("source-create-on-save")).toContainText("súčasne sa uloží konfigurácia");
  await expect(page.getByTestId("source-editor-save")).toBeEnabled();
  await page.getByTestId("source-editor-save").click();
  await expect(page.locator(".slse-source-dialog")).toHaveCount(0);
  await expect(sourcePanel).toContainText("Automatická kontrola koordinátora");
  await expect(sourcePanel).toContainText("Kontrola zapnutá");
  await sourcePanel.getByTestId("background-source-actions").click();
  await expect(page.getByTestId("status-list-studio-actions")).toBeVisible();
  await expect(page.getByTestId("background-coordinator-trigger")).toContainText("Kontrola zapnutá");
  await page.getByTestId("background-add-no").click();
  await page.getByTestId("service-action-stage-conditions").click();
  await expect(page.getByTestId("service-action-condition-answer")).toHaveValue("no");
  await page.screenshot({path:"/tmp/background-answer-no-action.jpg"});
  await page.getByRole("button",{name:"Zrušiť",exact:true}).click();
  await page.getByTestId("background-add-yes").click();
  await page.getByTestId("service-action-stage-conditions").click();
  await expect(page.getByTestId("service-action-condition-answer")).toHaveValue("yes");
  await page.getByRole("button",{name:"Zrušiť",exact:true}).click();
  await page.getByRole("button",{name:"Zavrieť",exact:true}).click();
  await expect(page.getByTestId(`status-list-select-${itemId}`)).toBeVisible();
  expect(errors).toEqual([]);
});

test("creating a source can be retried after a failed save without leaving the editor",async({page})=>{
  const errors=await setup(page,false,0,true);
  let attempts=0;
  await page.route(`**/api/campaigns/${campaignId}/status-list-workflows/sources`,async route=>{
    if(route.request().method()==="POST" && ++attempts===1)
      return route.fulfill({status:500,json:{error:"save_failed"}});
    await route.fallback();
  });
  await page.getByTestId(`status-list-select-${itemId}`).click();
  await page.getByTestId("studio-stage-answer").click();
  await page.getByTestId("status-list-background-sources").getByRole("button",{name:"Nastaviť zdroj",exact:true}).click();
  await page.getByTestId("source-editor-stage-review").click();
  await page.getByTestId("source-editor-save").click();
  await expect(page.getByTestId("source-editor-save")).toBeEnabled();
  await expect(page.locator(".slse-source-dialog")).toBeVisible();
  await page.getByTestId("source-editor-save").click();
  await expect(page.locator(".slse-source-dialog")).toHaveCount(0);
  expect(attempts).toBe(2);
  await expect(page.getByTestId("status-list-background-sources").locator(".slse-summary")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("studio numbering is not duplicated and contextual help explains actual outcomes", async ({ page }) => {
  const errors = await setup(page);
  await page.getByTestId(`status-list-select-${itemId}`).click();
  const stages = page.locator(".slqs-stages button");
  for (let index = 0; index < 5; index++) {
    const ordinal = String(index + 1).padStart(2, "0");
    expect((await stages.nth(index).innerText()).match(new RegExp(ordinal, "g"))).toHaveLength(1);
  }
  await page.getByTestId("studio-stage-answer").click();
  await expect(page.getByTestId("status-list-answer-branches")).toContainText("Nevyberá odpoveď za agenta");
  await page.getByTestId("status-list-help-open-answerBehavior").click();
  await expect(page.getByTestId("status-list-help-article")).toContainText("rodičovský krok");
  await page.getByTestId("status-list-help-close").click();
  await page.getByTestId("status-list-help-open-clinicOutcome").click();
  await expect(page.getByTestId("status-list-help-article")).toContainText("stav zmluvy");
  await expect(page.getByTestId("status-list-help-article")).toContainText("nie je automatický spätný prepis");
  await page.screenshot({ path: "/tmp/status-list-clinic-outcome-help.jpg" });
  await page.getByTestId("status-list-help-close").click();
  const sourcePanel = page.getByTestId("status-list-option-source-panel");
  await sourcePanel.getByTestId("status-list-help-open-answerSources").click();
  await expect(page.getByTestId("status-list-help-article")).toContainText("Doručenka");
  await expect(page.getByTestId("status-list-help-article")).toContainText("Odpoveď zo zdroja ≠ vykonaná akcia");
  await page.getByRole("searchbox").fill("neexistujuca kapitola xyz");
  await expect(page.getByTestId("status-list-help-article")).toContainText("Žiadna kapitola");
  expect(errors).toEqual([]);
});

test("missing Undefined is explained and can be repaired and saved directly from review", async ({ page }) => {
  const errors = await setup(page, false, 4);
  let saved: any = null, writes = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const endpoint = `/api/campaigns/${campaignId}/status-list-workflows/option-sources`;
  await page.route(`**${endpoint}/**`, async route => {
    expect(route.request().method()).toBe("PUT");
    saved = { groupId: itemId, ...route.request().postDataJSON() };
    writes++;
    await gate;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route(`**${endpoint}`, async route => route.fulfill({ json: {
    sources: saved ? [saved] : [], coordinators: [], catalog: optionCatalog(4),
  } }));
  await page.getByTestId(`status-list-select-${itemId}`).click();
  await page.getByTestId("studio-stage-answer").click();
  await page.getByTestId("status-list-option-source-panel").getByRole("button").first().click();
  await page.getByTestId("source-editor-stage-mapping").click();
  await page.getByTestId("option-source-map-waiting").selectOption(optionC);
  await page.getByTestId("option-source-map-unreachable").selectOption(optionB);
  await page.getByTestId("option-source-map-reachable").selectOption(optionA);
  await page.getByTestId("source-editor-stage-review").click();
  await expect(page.getByTestId("option-source-validation")).toContainText("Chýba priradenie pre stav: Nedefinované");
  await expect(page.getByTestId("source-editor-save")).toBeDisabled();
  expect(writes).toBe(0);
  await page.screenshot({ path: "/tmp/status-list-source-missing-mapping.jpg" });
  await page.getByTestId("option-source-map-not_defined").selectOption(optionD);
  await expect(page.getByTestId("option-source-validation")).toHaveCount(0);
  await expect(page.getByTestId("source-editor-save")).toBeEnabled();
  await page.getByTestId("source-editor-save").click();
  await expect(page.getByTestId("source-editor-save")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("status-list-source-editor")).toBeVisible();
  await expect(page.getByTestId("status-list-confirm-modal")).toHaveCount(0);
  release();
  await expect(page.getByTestId("status-list-source-editor")).toHaveCount(0);
  await expect(page.locator(".slse-source-dialog")).toHaveCount(0);
  await expect(page.getByTestId("status-list-confirm-modal")).toHaveCount(0);
  expect(writes).toBe(1);
  expect(saved.mapping).toEqual({ not_defined: optionD, waiting: optionC, unreachable: optionB, reachable: optionA });
  await page.getByTestId("status-list-option-source-panel").getByRole("button", { name: /^Upraviť/ }).click();
  await page.getByTestId("source-editor-stage-review").click();
  await expect(page.getByTestId("option-source-map-not_defined")).toHaveValue(optionD);
  await expect(page.getByTestId("source-editor-save")).toBeEnabled();
  expect(errors).toEqual([]);
});

test("three options explain the missing fourth and Relationships opens a practical manual", async ({ page }) => {
  const errors = await setup(page, true, 3);
  await page.getByTestId(`status-list-select-${itemId}`).click();
  await page.getByTestId("studio-stage-relationships").click();
  await page.getByTestId("status-list-help-open-relationships").click();
  await expect(page.getByTestId("status-list-help-article")).toContainText("Nie sú univerzálnym editorom automatizácií");
  await expect(page.getByTestId("status-list-help-article")).toContainText("nepotvrdí druhý krok");
  await expect(page.getByTestId("status-list-help-article")).toContainText("Preferované materiály");
  await page.screenshot({ path: "/tmp/status-list-relationships-help.jpg" });
  await page.getByTestId("status-list-help-close").click();
  await page.getByTestId("studio-stage-answer").click();
  await page.getByTestId("status-list-option-source-panel").getByRole("button").first().click();
  await page.getByTestId("source-editor-stage-review").click();
  await expect(page.getByTestId("option-source-validation")).toContainText("má 3 možností");
  await expect(page.getByTestId("option-source-validation")).toContainText("aspoň 4");
  await expect(page.getByTestId("source-editor-save")).toBeDisabled();
  await page.getByTestId("option-source-repair-mapping").click();
  await expect(page.getByTestId("option-source-map-not_defined")).toBeVisible();
  expect(errors).toEqual([]);
});

test("background source editor is a dismissible dirty-guarded modal", async ({ page }) => {
  const errors = await setup(page);
  await page.getByTestId("status-list-tab-rules").click();
  const panel = page.getByTestId("status-list-background-sources");
  await expect(panel).toBeVisible();
  await panel.getByRole("button").first().click();
  const modal = page.getByRole("dialog").filter({ has: page.getByTestId("status-list-source-editor") });
  await expect(modal).toBeVisible();
  await expect(panel.getByTestId("status-list-source-editor")).toHaveCount(0);
  await modal.getByTestId("background-source-kind").selectOption("representative_assignment_type");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("status-list-confirm-modal")).toBeVisible();
  await page.getByTestId("status-list-confirm-cancel").click();
  await expect(modal).toBeVisible();
  await modal.locator('button[aria-label="Zrušiť"]').click();
  await expect(page.getByTestId("status-list-confirm-modal")).toBeVisible();
  await page.getByTestId("status-list-confirm-accept").click();
  await expect(modal).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("option source editor fits a mobile viewport and keeps summaries outside the modal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await setup(page, true);
  await page.getByTestId(`status-list-select-${itemId}`).click();
  await page.getByTestId("studio-stage-answer").click();
  const panel = page.getByTestId("status-list-option-source-panel");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: /nastaviť zdroj možností/i }).click();
  const modal = page.getByRole("dialog").filter({ has: page.getByTestId("status-list-source-editor") });
  await expect(modal).toBeVisible();
  expect(await modal.evaluate(node => node.getBoundingClientRect().width)).toBeLessThanOrEqual(390);
  await expect(page.getByTestId("option-source-group")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
  expect(overflow).toBe(false);
  await modal.getByTestId("source-editor-cancel").click();
  expect(errors).toEqual([]);
});

test("Escape and the close affordance cannot dismiss a source editor while save is pending", async ({ page }) => {
  const errors = await setup(page);
  let releaseSave!: () => void;
  let requestStarted = false;
  const saveGate = new Promise<void>(resolve => { releaseSave = resolve; });
  await page.route("**/status-list-workflows/sources/**", async route => {
    if (route.request().method() !== "PUT") return route.fallback();
    requestStarted = true;
    await saveGate;
    await route.fulfill({ json: { ok: true } });
  });
  await page.getByTestId("status-list-tab-rules").click();
  const panel = page.getByTestId("status-list-background-sources");
  await panel.getByRole("button").first().click();
  const modal = page.getByRole("dialog").filter({ has: page.getByTestId("status-list-source-editor") });
  for (let step = 0; step < 3; step++) await modal.getByTestId("source-editor-next").click();
  await modal.getByTestId("source-editor-save").click();
  await expect.poll(() => requestStarted).toBe(true);
  await expect(modal.locator('button[aria-label="Zrušiť"]')).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(modal).toBeVisible();
  releaseSave();
  await expect(modal).toHaveCount(0);
  expect(errors).toEqual([]);
});
