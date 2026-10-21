import { expect, test } from "@playwright/test";

// Express serves the SPA template for every HTML path. Keep Vite's real React
// preamble and load the dev-only fixture only in this intercepted test response.
test.beforeEach(async ({ page }) => {
  await page.route("**/test-fixtures/status-workflow-editor.html*", async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/src="\/src\/main\.tsx[^"]*"/, 'src="/test-fixtures/status-workflow-editor.tsx"');
    await route.fulfill({ response, body: html });
  });
});

const item = (id: string, label: string, extra = {}) => ({ kind: "item", id, label, fieldType: "checkbox", hidden: false, writable: true, sortOrder: 0, ...extra });
const catalog = [
  item("accepted", "Cooperation agreed", { parentId: "source", itemType: "option", multiSelectable: true }),
  item("destination", "Contract proposal", { sortOrder: 2 }),
  item("source", "Willingness to cooperate", { sortOrder: 1 }),
  item("yesno", "Proceed?", { kind: "question", fieldType: "yesno", parentId: "source" }),
  item("text", "Details", { kind: "question", fieldType: "text", parentId: "destination" }),
  item("system", "Automatic result", { writable: false, hidden: true, sortOrder: 3 }),
  item("refused", "Cooperation refused", { parentId: "source", itemType: "option", multiSelectable: true }),
];

test("real editor groups answers, persists exact branches, reopens, toggles and deletes", async ({ page }) => {
  let rules: any[] = []; const writes: any[] = []; const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const request = route.request();
    if (!request.url().includes("/status-list-workflows")) return route.fulfill({ json: [] });
    if (request.url().includes("/status-list-workflows/sources")) return route.fulfill({ json: { sources: [], catalog } });
    if (request.method() === "GET") return route.fulfill({ json: { catalog, rules } });
    const data = request.method() === "DELETE" ? null : request.postDataJSON();
    writes.push({ method: request.method(), data });
    if (request.method() === "DELETE") rules = [];
    else rules = [{ ...data, id: "saved-rule", campaignId: "workflow-test" }];
    return route.fulfill({ json: rules[0] || { success: true } });
  });
  await page.goto("/test-fixtures/status-workflow-editor.html");
  await page.getByTestId("status-workflow-create").click();
  await page.getByTestId("status-workflow-name").fill("Hierarchy regression");
  await page.getByTestId("status-workflow-overview-when").click();
  await expect(page.locator(".editor-window")).toHaveCSS("background-color", "rgb(255, 253, 250)");
  await page.getByTestId("status-workflow-source").click();
  const picker = page.locator(".status-workflow-picker-shell");
  await expect(picker.locator(".question-group")).toHaveCount(3);
  await expect(picker.locator(".question-group").first()).toContainText("Willingness to cooperate");
  await picker.getByRole("textbox").fill("agreed");
  await expect(picker.locator(".question-group")).toHaveCount(1);
  await picker.locator('[data-catalog-ref="item:accepted"]').click();
  await expect(page.getByTestId("status-workflow-source")).toContainText("Willingness to cooperate");
  await page.getByTestId("status-workflow-source-value").selectOption("true");
  await page.getByTestId("status-workflow-nav-then").click();
  await page.getByTestId("status-workflow-add-then-action").click();
  await page.getByTestId("status-workflow-then-target-0").click();
  await expect(picker.locator('[data-catalog-ref="item:accepted"]')).toBeDisabled();
  await expect(picker.locator('[data-catalog-ref="item:system"]')).toBeDisabled();
  await picker.locator('[data-catalog-ref="item:destination"]').click();
  await page.screenshot({ path: "generated-artifacts/status-workflow-redesign/integrated-desktop.jpg" });
  await page.getByTestId("status-workflow-then-mode-0").getByRole("radio").nth(1).check();
  await expect(page.getByTestId("status-workflow-then-answer-0")).toContainText("Krok je potvrdený");
  await page.getByTestId("status-workflow-nav-else").click();
  await page.getByTestId("status-workflow-add-else-action").click();
  await page.getByTestId("status-workflow-else-target-0").click();
  await picker.locator('[data-catalog-ref="question:yesno"]').click();
  await page.getByTestId("status-workflow-else-answer-0").selectOption("no");
  await page.getByTestId("status-workflow-nav-if").click();
  await page.getByTestId("status-workflow-add-condition").click();
  await page.getByTestId("status-workflow-condition-value-0").getByRole("button").nth(1).click();
  await page.getByTestId("status-workflow-save").click();
  await expect(page.locator(".status-workflow-shell")).toHaveCount(0);
  expect(writes[0].data.source).toEqual({ kind: "item", id: "accepted" });
  expect(writes[0].data.sourceValue).toBe(true);
  expect(writes[0].data.thenActions).toEqual([{ type: "set_answer", target: { kind: "item", id: "destination" }, value: true, mode: "replace" }]);
  expect(writes[0].data.elseActions[0]).toMatchObject({ target: { kind: "question", id: "yesno" }, value: "no" });
  expect(writes[0].data.conditions[0].value).toBe(false);
  await page.getByRole("button", { name: "Upraviť workflow", exact: true }).click();
  await page.getByTestId("status-workflow-nav-then").click();
  await expect(page.getByTestId("status-workflow-then-target-0")).toContainText("Contract proposal");
  await expect(page.getByTestId("status-workflow-then-mode-0").getByRole("radio").nth(1)).toBeChecked();
  await page.getByTestId("status-workflow-add-then-action").click();
  await expect(page.locator(".action-card")).toHaveCount(2);
  await page.locator(".editor-footer").getByRole("button", { name: "Zrušiť", exact: true }).click();
  expect(writes).toHaveLength(1);
  await page.getByRole("switch").click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].data.enabled).toBe(false);
  await page.getByRole("button", { name: "Odstrániť", exact: true }).click();
  await page.getByTestId("status-list-confirm-accept").click();
  await expect.poll(() => writes.length).toBe(3);
  expect(writes[2].method).toBe("DELETE");
  expect(errors).toEqual([]);
});

test("each internal action has a typed editor and survives reopening", async ({ page }) => {
  let rules: any[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    if (request.url().includes("/status-list-workflows/sources")) return route.fulfill({ json: { sources: [], catalog } });
    if (request.method() === "GET") return route.fulfill({ json: { rules, catalog } });
    const data = request.postDataJSON();
    rules = [{ ...data, id: "typed-rule", campaignId: "workflow-test" }];
    return route.fulfill({ json: rules[0] });
  });
  await page.goto("/test-fixtures/status-workflow-editor.html");
  await page.getByTestId("status-workflow-create").click();
  await page.getByTestId("status-workflow-name").fill("Internal actions");
  await page.getByTestId("status-workflow-overview-then").click();
  await page.getByTestId("status-workflow-add-then-action").click();
  for (const type of ["set_answer", "clear_answer", "confirm_step", "unconfirm_step", "add_selection", "remove_selection", "replace_note", "append_note", "clear_note"]) {
    await page.getByTestId("status-workflow-then-type-0").selectOption(type);
    if (type === "replace_note" || type === "append_note") {
      await page.getByTestId("status-workflow-then-target-0").click();
      await expect(page.locator('[data-catalog-ref="item:accepted"]')).toBeEnabled();
      await page.locator('[data-catalog-ref="item:accepted"]').click();
      await page.getByTestId("status-workflow-then-text-0").fill("Independent note");
    }
    await page.getByTestId("status-workflow-save").click();
    await expect(page.locator(".status-workflow-shell")).toHaveCount(0);
    expect(rules[0].thenActions[0].type).toBe(type);
    const keys = Object.keys(rules[0].thenActions[0]).sort();
    expect(keys).toEqual((type === "set_answer" ? ["type", "target", "value", "mode"] : ["replace_note", "append_note"].includes(type) ? ["type", "target", "text"] : ["type", "target"]).sort());
    await page.getByRole("button", { name: "Upraviť workflow", exact: true }).click();
    await page.getByTestId("status-workflow-nav-then").click();
    await expect(page.getByTestId("status-workflow-then-type-0")).toHaveValue(type);
    if (type === "replace_note" || type === "append_note") await expect(page.getByTestId("status-workflow-then-text-0")).toHaveValue("Independent note");
  }
});

test("mobile, keyboard dismissal, empty search and all translations", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({
    json: route.request().url().includes("/status-list-workflows/sources")
      ? { sources: [], catalog }
      : { rules: [], catalog },
  }));
  const locales = ["en", "sk", "cs", "hu", "ro", "it", "de"];
  const localizedSourceTitles = ["Background answers", "Odpovede na pozadí", "Odpovědi na pozadí", "Háttérválaszok", "Răspunsuri în fundal", "Risposte in background", "Hintergrundantworten"];
  for (let index = 0; index < locales.length; index++) {
    const locale = locales[index];
    await page.goto(`/test-fixtures/status-workflow-editor.html?locale=${locale}`);
    await expect(page.getByTestId("status-list-background-sources")).toBeVisible();
    await expect(page.getByTestId("status-list-background-sources").locator("h3")).toHaveText(localizedSourceTitles[index]);
    await page.getByTestId("status-workflow-create").click();
    await page.getByTestId("status-workflow-overview-when").click();
    await page.getByTestId("status-workflow-source").click();
    await page.locator(".picker-search input").fill("no-result-zzz");
    await expect(page.locator(".picker-empty strong")).not.toBeEmpty();
    await page.keyboard.press("Escape");
    await expect(page.locator(".status-workflow-picker-shell")).toHaveCount(0);
    await expect(page.getByTestId("status-workflow-source")).toBeFocused();
    await expect(page.locator(".status-workflow-shell")).not.toContainText(/\bTrue\b|\bFalse\b/);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("status-list-background-sources")).toBeVisible();
  await page.getByTestId("status-workflow-nav-then").click();
  await page.getByTestId("status-workflow-add-then-action").click();
  await expect(page.getByTestId("status-workflow-save")).toBeInViewport();
  await expect(page.locator(".editor-window")).toHaveCSS("background-color", "rgb(255, 253, 250)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "generated-artifacts/status-workflow-redesign/integrated-mobile.jpg" });
});

test("background source panel creates, edits, hides and removes owned mappings", async ({ page }) => {
  let sources: any[] = [];
  const writes: Array<{ method: string; url: string; body?: any }> = [];
  const sourceCatalog = catalog.map(item => ({ ...item, systemSourceEligible: item.id === "yesno" }));
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = request.url();
    if (url.includes("/status-list-workflows/sources")) {
      if (request.method() === "GET") return route.fulfill({ json: { sources, catalog: sourceCatalog } });
      const questionId = decodeURIComponent(url.split("/").pop() || "");
      if (request.method() === "PUT") {
        const body = request.postDataJSON();
        writes.push({ method: "PUT", url, body });
        sources = [...sources.filter(source => source.questionId !== questionId), { questionId, ...body }];
        return route.fulfill({ json: { success: true } });
      }
      writes.push({ method: "DELETE", url });
      sources = sources.filter(source => source.questionId !== questionId);
      return route.fulfill({ json: { success: true } });
    }
    if (url.includes("/status-list-workflows")) {
      if (request.method() === "GET") return route.fulfill({ json: { catalog: sourceCatalog, rules: [] } });
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto("/test-fixtures/status-workflow-editor.html?locale=en");
  const panel = page.getByTestId("status-list-background-sources");
  await panel.getByRole("button", { name: "Configure source" }).click();
  await expect(panel.getByTestId("background-source-question")).toHaveValue("yesno");
  await panel.getByTestId("source-editor-stage-evaluation").click();
  await panel.getByTestId("background-source-hidden").click();
  await panel.getByTestId("source-editor-stage-review").click();
  await panel.getByTestId("source-editor-save").click();
  await expect(panel).toContainText("Proceed?");
  expect(writes[0]).toMatchObject({
    method: "PUT", body: { source: "representative_assigned", hidden: true },
  });
  await panel.getByRole("button", { name: "Edit source" }).click();
  await expect(panel.getByTestId("background-source-question")).toHaveValue("yesno");
  await panel.getByTestId("source-editor-stage-evaluation").click();
  await panel.getByTestId("background-source-hidden").click();
  await panel.getByTestId("source-editor-stage-review").click();
  await panel.getByTestId("source-editor-save").click();
  expect(writes[1]).toMatchObject({
    method: "PUT", body: { source: "representative_assigned", hidden: false },
  });
  await panel.getByRole("button", { name: "Remove source" }).click();
  await page.getByTestId("status-list-confirm-accept").click();
  await expect.poll(() => writes.length).toBe(3);
  expect(writes[2].method).toBe("DELETE");
  await expect(panel).toContainText("No background sources configured.");
});

test("background source selects background trigger and remains unavailable as a target", async ({ page }) => {
  const derivedQuestion = item("representative", "Assigned representative", {
    kind: "question", fieldType: "yesno", writable: false, backgroundSource: "representative_assigned",
  });
  const derivedCatalog = [...catalog, derivedQuestion];
  const saved: any[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = request.url();
    if (url.includes("/status-list-workflows/sources")) return route.fulfill({ json: { sources: [{ questionId: "representative", source: "representative_assigned", hidden: false }], catalog: derivedCatalog } });
    if (url.includes("/status-list-workflows")) {
      if (request.method() === "GET") return route.fulfill({ json: { catalog: derivedCatalog, rules: [] } });
      if (request.method() === "POST") {
        saved.push(request.postDataJSON());
        return route.fulfill({ json: { ...saved[0], id: "background-rule", campaignId: "workflow-test" } });
      }
    }
    return route.fulfill({ json: [] });
  });
  await page.goto("/test-fixtures/status-workflow-editor.html?locale=en");
  await page.getByTestId("status-workflow-create").click();
  await page.getByTestId("status-workflow-name").fill("Representative change");
  await page.getByTestId("status-workflow-overview-when").click();
  await page.getByTestId("status-workflow-source").click();
  const picker = page.locator(".status-workflow-picker-shell");
  await picker.locator('[data-catalog-ref="question:representative"]').click();
  await expect(page.locator(".editor-content")).toContainText("Background transition");
  await expect(page.locator(".editor-content")).toContainText("Runs when the configured source changes the answer.");
  await expect(page.locator(".editor-content")).not.toContainText("agent confirms");
  await expect(page.locator(".editor-content")).not.toContainText("This rule does not run in the background");
  await page.getByTestId("status-workflow-nav-then").click();
  await page.getByTestId("status-workflow-add-then-action").click();
  await page.getByTestId("status-workflow-then-target-0").click();
  await expect(page.locator(".status-workflow-picker-shell").locator('[data-catalog-ref="question:representative"]')).toBeDisabled();
  await page.locator(".status-workflow-picker-shell").locator('[data-catalog-ref="item:destination"]').click();
  await page.getByTestId("status-workflow-save").click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].trigger).toBe("background_transition");
  expect(saved[0].source).toEqual({ kind: "question", id: "representative" });
});
