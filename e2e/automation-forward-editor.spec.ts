import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({ json: path === "/api/auth/user"
      ? { id: "fixture-user", username: "Fixture", role: "admin", assignedCountries: ["SK"] }
      : [] });
  });
});

for (const branch of ["then", "else"] as const) {
  test(`sender matching applies directly and survives rule save (${branch})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`/test-fixtures/automation-forward-editor.html${branch === "else" ? "?else" : ""}`);
    await page.locator(`[data-testid="automation-${branch}-step"]`).getByRole("button", { name: "Edit", exact: true }).click();
    const block = page.locator(".automation-block-modal");
    await block.getByRole("button", { name: "Edit", exact: true }).click();
    const match = block.getByRole("checkbox", { name: "Match sender to an existing customer" });
    await match.check();
    await expect(match).toBeChecked();
    await expect(block.getByRole("button", { name: "Apply changes", exact: true })).toBeEnabled();
    await block.getByRole("button", { name: "Apply changes", exact: true }).click();
    await expect(block).toHaveCount(0);
    await page.locator(`[data-testid="automation-${branch}-step"]`).getByRole("button", { name: "Edit", exact: true }).click();
    const reopened = page.locator(".automation-block-modal");
    await reopened.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(reopened.getByRole("checkbox", { name: "Match sender to an existing customer" })).toBeChecked();
    await reopened.getByRole("button", { name: "Apply changes", exact: true }).click();
    await expect(reopened).toHaveCount(0);
    await page.getByRole("button", { name: "Save rule", exact: true }).click();
    await expect(page.getByTestId("saved-rule")).not.toHaveText("null");
    const saved = JSON.parse((await page.getByTestId("saved-rule").textContent())!);
    expect((branch === "then" ? saved.actions : saved.trigger.noMatchActions)[0].config.matchSender).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("invalid forwarding stays blocked; cancelling restores the checkbox", async ({ page }) => {
  await page.goto("/test-fixtures/automation-forward-editor.html");
  await page.locator('[data-testid="automation-then-step"]').getByRole("button", { name: "Edit", exact: true }).click();
  const block = page.locator(".automation-block-modal");
  await block.getByRole("button", { name: "Edit", exact: true }).click();
  await block.getByRole("checkbox", { name: "Match sender to an existing customer" }).check();
  await block.getByRole("button", { name: "Cancel", exact: true }).last().click();
  await expect(block).toHaveCount(0);
  await page.locator('[data-testid="automation-then-step"]').getByRole("button", { name: "Edit", exact: true }).click();
  const reopened = page.locator(".automation-block-modal");
  await reopened.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(reopened.getByRole("checkbox", { name: "Match sender to an existing customer" })).not.toBeChecked();
  await reopened.getByRole("combobox", { name: "Destination", exact: true }).click();
  await page.getByRole("option", { name: "INDEXUS user (internal task)", exact: true }).click();
  await expect(reopened.getByRole("button", { name: "Apply changes", exact: true })).toBeDisabled();
});
