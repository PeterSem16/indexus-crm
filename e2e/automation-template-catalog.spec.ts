import { test, expect } from "@playwright/test";

test("real four editors: nested searchable source/meaning picker selects and explains unavailable templates", async ({ page }) => {
  let additions = false;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path === "/api/auth/user") data = { id: "fixture-user", username: "fixture", fullName: "Fixture", role: "admin", assignedCountries: ["SK"], language: "en" };
    if (/status|mailbox|connection/.test(path)) data = { connected: true };
    if (path === "/api/message-templates") {
      const type = new URL(route.request().url()).searchParams.get("type") || "email";
      const template = (slug: string, name: string, content: string) => ({
        id: `indexus-activity-${type}-${slug}-en`, name, content, contentHtml: type === "email" ? `<p>${content}</p>` : null,
        subject: name, language: "en", type, isActive: true,
      });
      data = [
        template("analysis-inbound-tone-angry", "Inbound call · Angry tone", "{{analysis.tone}}\n{{analysis.sentiment}}"),
        template("analysis-outbound-positive", "Outbound call · Positive sentiment", "{{analysis.sentiment}}"),
        template("analysis-email-negative", "Email · Negative sentiment", "{{analysis.sentiment}}"),
        template("task-task-created", "Task · Created", "{{activity.title}}"),
        { id: `indexus-automation-${type}-deadline-en`, name: "Original deadline reminder", subject: "Deadline · {{activity.title}} [{{activity.id}}]", content: "Task: {{activity.title}}\nID: {{activity.id}}\nDeadline: {{activity.dueDate}}", type, language: "en", isActive: true },
        template("analysis-voice-tone-rude", "Calls · Rude tone · unavailable", "{{analysis.privateField}}"),
        { id: `indexus-${type}-template-analysis-negative-en`, name: "Original analysis · Negative", subject: "Original", content: "{{analysis.sentiment}}", type, language: "en", isActive: true },
        ...(additions ? [template("analysis-voice-tone-calm", "Calls · Calm tone · newly added", "{{analysis.tone}}")] : []),
      ];
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
  });
  await page.goto("/test-fixtures/automation-template-catalog.html");
  for (const type of ["email", "task", "notification", "sms"]) {
    await page.getByTestId(`type-${type}`).click();
    const openEditor = type === "notification" ? "notify-user-edit-0" : "catalog-open-editor";
    if (type !== "task") await page.getByTestId(openEditor).click();
    const pickerId = type === "email" ? "catalog-editor-template" : type === "task" ? "select-task-action-template" : type === "notification" ? "notify-user-template-0" : "catalog-template";
    await page.getByTestId(pickerId).click();
    const picker = page.getByTestId(`${pickerId}-dialog`);
    await expect(picker).toBeVisible();
    await page.getByTestId(`${pickerId}-source-calls`).click();
    await page.getByTestId(`${pickerId}-meaning-tone`).click();
    await expect(picker.getByRole("button", { name: /Task · Created/ })).toHaveCount(0);
    await expect(picker.getByRole("button", { name: /Outbound call · Positive sentiment/ })).toHaveCount(0);
    await page.getByTestId(`${pickerId}-search`).fill("Angry tone");
    const row = picker.getByRole("button", { name: /Inbound call · Angry tone/ });
    await expect(row).toBeVisible();
    await row.click();
    await expect(picker).not.toBeVisible();
    if (type !== "task") await page.keyboard.press("Escape");
    // Task applies immediately; modal editors keep draft values until Save.
    if (type === "task") await expect(page.getByTestId("saved-config")).toContainText("{{analysis.tone}}");
  }
  await page.getByTestId("type-task").click();
  await page.getByTestId("select-task-action-template").click();
  const picker = page.getByTestId("select-task-action-template-dialog");
  await expect(page.getByTestId("select-task-action-template-availability-usable")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("select-task-action-template-search").fill("unavailable");
  await expect(picker.getByRole("button", { name: /Rude tone · unavailable/ })).toHaveCount(0);
  await page.getByTestId("select-task-action-template-availability-unavailable").click();
  await expect(picker.getByRole("button", { name: /Rude tone · unavailable/ })).toBeDisabled();
  await expect(picker).toContainText("{{analysis.privateField}}");
  await page.getByTestId("select-task-action-template-search").fill("");
  await page.getByTestId("select-task-action-template-availability-usable").click();
  additions = true;
  await picker.getByRole("button", { name: /Refresh templates/ }).click();
  await page.getByTestId("select-task-action-template-search").fill("newly added");
  await expect(picker.getByRole("button", { name: /Calm tone · newly added/ })).toBeVisible();
  await page.getByTestId("select-task-action-template-search").fill("");
  await page.screenshot({ path: ".local/screenshots/automation-template-categorized-picker.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(picker).toBeVisible();
  const bounds = await picker.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: ".local/screenshots/automation-template-picker-mobile.png" });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByTestId("source-task").click();
  await page.getByTestId("select-task-action-template").click();
  await page.getByTestId("select-task-action-template-search").fill("Original deadline");
  const deadline = picker.getByRole("button", { name: /Original deadline reminder/ });
  await expect(deadline).toBeEnabled();
  await expect(deadline).toContainText("All required fields are available and the source fits this action");
  await expect(deadline).toContainText("[title]");
  await expect(deadline).toContainText("[id]");
  await expect(deadline).toContainText("dueDate");
  await page.screenshot({ path: ".local/screenshots/automation-template-deadline-identity.png" });
  await deadline.click();
  await expect(page.getByTestId("saved-config")).toContainText("{{activity.title}}");
  await expect(page.getByTestId("saved-config")).toContainText("{{activity.id}}");
  await expect(page.getByTestId("saved-config")).toContainText("{{activity.dueDate}}");
  await page.getByTestId("source-call").click();
  await page.getByTestId("select-task-action-template").click();
  await expect(picker.getByRole("button", { name: /Original deadline reminder/ })).toHaveCount(0);
  await page.getByTestId("select-task-action-template-availability-unavailable").click();
  await page.getByTestId("select-task-action-template-search").fill("Original deadline");
  await expect(deadline).toBeDisabled();
  await expect(deadline).toContainText("Requires Tasks");
  await expect(deadline).toContainText("Telephone calls");
});
