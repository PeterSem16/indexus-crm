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
  item("accepted", "Cooperation agreed", { parentId: "source", itemType: "option" }),
  item("destination", "Contract proposal", { sortOrder: 2 }),
  item("source", "Willingness to cooperate", { sortOrder: 1 }),
  item("yesno", "Proceed?", { kind: "question", fieldType: "yesno", parentId: "source" }),
  item("text", "Details", { kind: "question", fieldType: "text", parentId: "destination" }),
  item("system", "Automatic result", { writable: false, hidden: true, sortOrder: 3 }),
  item("refused", "Cooperation refused", { parentId: "source", itemType: "option" }),
];

test("real editor groups answers, persists exact branches, reopens, toggles and deletes", async ({ page }) => {
  let rules: any[] = []; const writes: any[] = []; const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const request = route.request();
    if (!request.url().includes("/status-list-workflows")) return route.fulfill({ json: [] });
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
  page.on("dialog", dialog => dialog.accept());
  await page.locator('[data-testid="status-list-workflows"] button').last().click();
  await expect.poll(() => writes.length).toBe(3);
  expect(writes[2].method).toBe("DELETE");
  expect(errors).toEqual([]);
});

test("mobile, keyboard dismissal, empty search and all translations", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ json: { rules: [], catalog } }));
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
    await page.goto(`/test-fixtures/status-workflow-editor.html?locale=${locale}`);
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
  await page.getByTestId("status-workflow-nav-then").click();
  await page.getByTestId("status-workflow-add-then-action").click();
  await expect(page.getByTestId("status-workflow-save")).toBeInViewport();
  await expect(page.locator(".editor-window")).toHaveCSS("background-color", "rgb(255, 253, 250)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "generated-artifacts/status-workflow-redesign/integrated-mobile.jpg" });
});
