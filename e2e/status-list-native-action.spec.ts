import { expect, test } from "@playwright/test";

const savedWrites: Record<string, unknown>[] = [];
test("legacy status-list notification keeps null config until explicit conversion; cancelled message edits are discarded and applied payload persists", async ({ page }) => {
  savedWrites.length = 0;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "PUT" && /^\/api\/campaigns\/42\/status-list\/12\/automations\/[^/]+$/.test(path)) {
      const body = request.postDataJSON() as Record<string, unknown>;
      savedWrites.push(body);
      return route.fulfill({ json: { id: "legacy-notify", ...body } });
    }
    if (request.method() !== "GET") return route.fulfill({ status: 405, json: { error: "Unexpected fixture write" } });
    const body = path === "/api/auth/me" || path === "/api/auth/user"
      ? { id: "manager-17", username: "Mira", fullName: "Mira Novak", email: "mira@example.invalid", role: "manager", assignedCountries: ["SK"] }
      : path === "/api/campaigns/42" ? { id: "42", name: "Campaign registration", countryCodes: ["SK"], settings: { smsProvider: "smstools" } }
        : path === "/api/roles" ? [{ id: "supervisor", name: "supervisor", description: "Team supervisor", isActive: true }]
          : path === "/api/automation/users" ? [{ id: "manager-17", fullName: "Mira Novak", email: "mira@example.invalid" }]
            : path === "/api/task-groups" ? []
              : path === "/api/automation/email-mailboxes" ? { personal: { connected: true, email: "mira@example.invalid" }, system: [] }
                : path.includes("permissions") ? {} : [];
    return route.fulfill({ json: body });
  });

  await page.goto("/test-fixtures/status-list-native-action.html", { waitUntil: "networkidle" });
  const editor = page.getByTestId("status-list-service-action-editor");
  await expect(editor).toBeVisible();
  await expect(page.getByTestId("fixture-dirty")).toHaveText("false");
  await expect(page.getByTestId("service-action-convert-native")).toBeVisible();
  await page.getByTestId("service-action-convert-native").click();
  await expect(page.getByTestId("notify-user-action-0")).toBeVisible();

  const openMessage = page.getByTestId("notify-user-edit-0");
  await openMessage.click();
  const messageEditor = page.getByTestId("notify-user-editor-0");
  await expect(messageEditor).toBeVisible();
  await expect(messageEditor.getByRole("button", { name: /analysis\.summary/ })).toHaveCount(0);
  await messageEditor.getByTestId("notify-user-title-0").fill("Discard this title");
  await messageEditor.getByTestId("notify-user-message-0").fill("Discard this message");
  await messageEditor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(messageEditor).toHaveCount(0);

  await openMessage.click();
  const reopened = page.getByTestId("notify-user-editor-0");
  await expect(reopened.getByTestId("notify-user-title-0")).toHaveValue("Manager notice");
  await expect(reopened.getByTestId("notify-user-message-0")).toHaveValue("Manager notice");
  await reopened.getByTestId("notify-user-title-0").fill("Registration needs review");
  await reopened.getByTestId("notify-user-message-0").fill("Please review {{contact.name}}.");
  await reopened.getByTestId("notify-user-apply-0").click();

  await page.getByTestId("service-action-stage-review").click();
  await expect(page.locator('[data-testid="service-action-review"]')).toContainText("Registration needs review");
  await expect(page.locator('[data-testid="service-action-review"]')).toContainText("supervisor");
  await page.getByTestId("status-list-automation-save").click();
  await expect(page.getByTestId("fixture-saved")).toHaveText('"saved"');
  expect(savedWrites).toHaveLength(1);
  expect(savedWrites[0].serviceActionConfig).toMatchObject({
    notificationActionVersion: 2,
    targetRole: "role:supervisor",
    title: "Registration needs review",
    message: "Please review {{contact.name}}.",
  });
  expect(savedWrites[0]).not.toHaveProperty("serviceActionOwnerId");
  expect(errors).toEqual([]);
});

test("native email editor keeps pending recipients unsavable, then saves the same native email config", async ({ page }) => {
  savedWrites.length = 0;
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "PUT" && path.includes("/status-list/12/automations/")) {
      const body = request.postDataJSON() as Record<string, unknown>;
      savedWrites.push(body);
      return route.fulfill({ json: { id: "native-email", ...body } });
    }
    if (request.method() !== "GET") return route.fulfill({ status: 405, json: {} });
    const body = path === "/api/campaigns/42" ? { id: "42", name: "Campaign registration", countryCodes: ["SK"], settings: { smsProvider: "smstools" } }
      : path === "/api/roles" ? [{ id: "supervisor", name: "supervisor", isActive: true }]
        : path === "/api/automation/users" ? [{ id: "manager-17", fullName: "Mira Novak", email: "mira@example.invalid" }]
          : path === "/api/task-groups" ? []
            : path === "/api/automation/email-mailboxes" ? { personal: { connected: true, email: "manager@example.invalid" }, system: [{ countryCode: "SK", connected: true, email: "sk@example.invalid" }] }
              : [];
    return route.fulfill({ json: body });
  });
  await page.goto("/test-fixtures/status-list-native-action.html?action=send_email_group", { waitUntil: "networkidle" });
  const email = page.getByTestId("status-list-email-action");
  await expect(email).toBeVisible();
  await expect(email).toContainText("manager@example.invalid");
  const address = page.locator("#status-list-email-action-to-address");
  await address.fill("not-an-email");
  await email.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByTestId("service-action-stage-review").click();
  await expect(page.getByTestId("status-list-automation-save")).toBeDisabled();
  await page.getByTestId("service-action-stage-details").click();
  await address.fill("dispatch@example.invalid");
  await email.getByRole("button", { name: "Add", exact: true }).click();
  await email.getByTestId("status-list-email-action-open-editor").click();
  const editor = page.getByTestId("status-list-email-action-content-editor");
  await expect(editor).toBeVisible();
  await editor.getByTestId("status-list-email-action-editor-subject").fill("Registration status");
  await editor.getByTestId("status-list-email-action-editor-body").fill("<p>Reviewed successfully.</p>");
  await editor.getByTestId("status-list-email-action-editor-close").click();
  await page.getByTestId("service-action-stage-review").click();
  await page.getByTestId("status-list-automation-save").click();
  await expect(page.getByTestId("fixture-saved")).toHaveText('"saved"');
  expect(savedWrites[0].serviceActionConfig).toMatchObject({
    emailActionVersion: 2, senderMode: "personal", subject: "Registration status", body: "<p>Reviewed successfully.</p>",
  });
  expect(String((savedWrites[0].serviceActionConfig as any).to)).toContain("dispatch@example.invalid");
});

test("native SMS editor shows campaign gateway and accepts the inherited default without a false conflict", async ({ page }) => {
  savedWrites.length = 0;
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "PUT" && path.includes("/status-list/12/automations/")) {
      const body = request.postDataJSON() as Record<string, unknown>;
      savedWrites.push(body);
      return route.fulfill({ json: { id: "native-sms", ...body } });
    }
    if (request.method() !== "GET") return route.fulfill({ status: 405, json: {} });
    const body = path === "/api/campaigns/42" ? { id: "42", name: "Campaign registration", countryCodes: ["SK"], settings: { smsProvider: "smstools" } }
      : path === "/api/roles" ? [] : path === "/api/automation/users" ? [] : path === "/api/task-groups" ? []
        : path === "/api/message-templates" ? [] : [];
    return route.fulfill({ json: body });
  });
  await page.goto("/test-fixtures/status-list-native-action.html?action=send_sms", { waitUntil: "networkidle" });
  const sms = page.getByTestId("status-list-sms-action");
  await expect(page.getByTestId("status-list-native-action")).toContainText("Gateway inherited from the campaign mission");
  await expect(page.getByTestId("status-list-native-action")).not.toContainText("conflicts with the mission gateway");
  await sms.getByTestId("status-list-sms-action-open-editor").click();
  const editor = page.getByTestId("status-list-sms-action-editor");
  await expect(editor).toBeVisible();
  await editor.getByTestId("status-list-sms-action-text").fill("Your registration is ready.");
  await editor.getByTestId("status-list-sms-action-apply").click();
  await page.getByTestId("service-action-stage-review").click();
  await page.getByTestId("status-list-automation-save").click();
  await expect(page.getByTestId("fixture-saved")).toHaveText('"saved"');
  expect(savedWrites[0].serviceActionConfig).toMatchObject({
    smsActionVersion: 2, provider: "default", text: "Your registration is ready.", to: ["+421900123456"],
  });
});

test("native task editor reuses task participant dialog and saves task content with actual user participants", async ({ page }) => {
  savedWrites.length = 0;
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "PUT" && path.includes("/status-list/12/automations/")) {
      const body = request.postDataJSON() as Record<string, unknown>;
      savedWrites.push(body);
      return route.fulfill({ json: { id: "native-task", ...body } });
    }
    if (request.method() !== "GET") return route.fulfill({ status: 405, json: {} });
    const body = path === "/api/campaigns/42" ? { id: "42", name: "Campaign registration", countryCodes: ["SK"], settings: {} }
      : path === "/api/automation/users" ? [{ id: "manager-17", fullName: "Mira Novak", email: "mira@example.invalid" }]
        : path === "/api/task-groups" ? [{ id: "triage", name: "Triage", members: [{ userId: "manager-17" }] }]
          : path === "/api/roles" ? [{ id: "supervisor", name: "supervisor", isActive: true }]
            : path === "/api/message-templates" ? [] : [];
    return route.fulfill({ json: body });
  });
  await page.goto("/test-fixtures/status-list-native-action.html?action=assign_task", { waitUntil: "networkidle" });
  const task = page.getByTestId("status-list-task-action");
  await expect(task).toBeVisible();
  await expect(task.getByTestId("button-edit-task-recipients")).toContainText("Mira Novak");
  await task.getByTestId("input-task-action-title").fill("Check registration");
  await task.getByTestId("textarea-task-action-text").fill("Call {{contact.name}}.");
  await task.getByTestId("button-edit-task-recipients").click();
  await expect(page.getByRole("dialog").last()).toBeVisible();
  await page.getByRole("button", { name: /Apply/i }).last().click();
  await page.getByTestId("service-action-stage-review").click();
  await page.getByTestId("status-list-automation-save").click();
  await expect(page.getByTestId("fixture-saved")).toHaveText('"saved"');
  expect(savedWrites[0].serviceActionConfig).toMatchObject({
    title: "Check registration", taskText: "Call {{contact.name}}.", recipients: [{ kind: "user", id: "manager-17" }],
  });
});
