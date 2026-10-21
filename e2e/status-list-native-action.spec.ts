import { expect, test } from "@playwright/test";
import { humanAutomationCatalog } from "../server/lib/automation-human-templates";
import { templateEligibility } from "../client/src/components/automation-template-eligibility";
import { STATUS_LIST_ACTIVITY_FIELDS } from "../shared/status-list-template-context";

const savedWrites: Record<string, unknown>[] = [];
let nativeTemplates: Awaited<ReturnType<typeof humanAutomationCatalog>>["templates"] = [];
test.beforeAll(async () => {
  nativeTemplates = (await humanAutomationCatalog()).templates.filter(template => !template.id.startsWith("indexus-activity-"));
});
const nativeTemplate = (type: string) => nativeTemplates.find(template => template.type === type && template.language === "en" &&
  templateEligibility(template, STATUS_LIST_ACTIVITY_FIELDS, "status_list").usable)!;
const templateCatalog = (url: string) => nativeTemplates.filter(template => template.type === new URL(url).searchParams.get("type"))
  .map(template => ({ ...template, isActive: true, countryCodes: [] }));

const missionTemplate = { id: "mission-default-email", type: "email", name: "Mission welcome with PDF", language: "en",
  isActive: true, countryCodes: ["SK"], categoryId: "mission-mail",
  subject: "{{clinic.doctorTitle}} {{clinic.doctorLastName}}",
  contentHtml: "<p>{{clinic.doctorSalutationDoc}} {{clinic.doctorLastName}}</p><p>{{user.fullName}}</p>",
  attachments: [{ fileName: "mission.pdf", mimeType: "application/pdf", size: 3 }] };

for (const hospital of [false, true]) {
  for (const mode of ["persons", "both"] as const) {
    test(`card recipients ${hospital ? "hospital" : "clinic"}: ${mode} saves dynamic sources without the hidden main token`, async ({ page }) => {
      await parityApi(page, { hospital });
      await page.goto("/test-fixtures/status-list-native-action.html?action=send_email", { waitUntil: "networkidle" });
      await page.getByTestId("service-action-stage-details").click();
      const main = page.getByRole("checkbox", { name: "Main clinic / hospital email", exact: true });
      const persons = page.getByRole("checkbox", { name: "Assigned people", exact: true });
      await expect(main).toBeChecked();
      await expect(persons).not.toBeChecked();
      await persons.check();
      if (mode === "persons") await main.uncheck();
      await expect(persons).toBeChecked();
      await expect(main).toHaveJSProperty("checked", mode === "both");
      // Closing/reopening Details must not inject the former {{contact.email}} default.
      await page.getByTestId("service-action-stage-type").click();
      await page.getByTestId("service-action-stage-details").click();
      await expect(main).toHaveJSProperty("checked", mode === "both");
      await expect(persons).toBeChecked();
      if (!hospital && mode === "both") await page.screenshot({ path: "/tmp/status-list-card-email-recipients.jpg" });
      await page.getByTestId("service-action-stage-review").click();
      await expect(page.getByTestId("service-action-review")).toContainText("Assigned people");
      await page.getByTestId("status-list-automation-save").click();
      await expect(page.getByTestId("fixture-saved")).toHaveText('"saved"');
      expect(savedWrites[0].serviceActionConfig).toMatchObject({
        to: "", toCardSources: mode === "both" ? ["main", "persons"] : ["persons"],
        subject: "Original subject", body: "<p>Original body</p>",
      });
    });
  }
}

async function parityApi(page: import("@playwright/test").Page, options: { brokenAttachment?: boolean; hospital?: boolean } = {}) {
  savedWrites.length = 0;
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "PUT" && path.includes("/status-list/12/automations/")) {
      const body = request.postDataJSON();
      savedWrites.push(body);
      return route.fulfill({ json: { id: "saved", ...body } });
    }
    if (request.method() !== "GET") return route.fulfill({ status: 405, json: {} });
    const body = path === "/api/campaigns/42"
      ? { id: "42", countryCodes: ["SK"], settings: { defaultEmailTemplateId: missionTemplate.id, defaultEmailCategoryId: "mission-mail" } }
      : path.endsWith("/status-list-workflows/contact-types") ? { contactTypes: [options.hospital ? "hospital" : "clinic"] }
      : path.endsWith("/automation-attachments") ? (options.brokenAttachment
        ? [{ fileName: "mission.pdf", error: "File missing" }]
        : [{ fileName: "mission.pdf", mimeType: "application/pdf", size: 3, contentBase64: "cGRm" }])
      : path === "/api/message-templates" ? [...templateCatalog(request.url()), missionTemplate]
      : path === "/api/template-categories" ? [{ id: "mission-mail", name: "Mission mail" }]
      : path === "/api/automation/email-mailboxes" ? { personal: { connected: true, email: "manager@example.invalid" }, system: [] }
      : path === "/api/automation/users" ? [{ id: "manager-17", fullName: "Mira Novak", email: "manager@example.invalid" }]
      : path === "/api/automation/update-record/catalog" ? {
        entities: [{ value: "clinic", fields: ["notes", "isActive", "nextContactDate"] },
          { value: "hospital", fields: ["isActive", "autoRecruiting", "responsiblePersonId"] }], relations: {},
      }
      : [];
    return route.fulfill({ json: body });
  });
}

test("card recipients keep manual addresses independent and support CC and BCC sources", async ({ page }) => {
  await parityApi(page);
  await page.goto("/test-fixtures/status-list-native-action.html?action=send_email", { waitUntil: "networkidle" });
  await page.getByTestId("service-action-stage-details").click();
  await page.getByRole("checkbox", { name: "Main clinic / hospital email", exact: true }).uncheck();
  const address = page.locator("#status-list-email-action-to-address");
  await address.fill("manual@example.test");
  await address.press("Enter");
  await page.getByRole("tab", { name: /^CC\b/ }).click();
  await page.getByRole("checkbox", { name: "Assigned people", exact: true }).check();
  await page.getByRole("tab", { name: /^BCC\b/ }).click();
  await page.getByRole("checkbox", { name: "Main clinic / hospital email", exact: true }).check();
  await page.getByTestId("service-action-stage-review").click();
  await page.getByTestId("status-list-automation-save").click();
  await expect(page.getByTestId("fixture-saved")).toHaveText('"saved"');
  expect(savedWrites[0].serviceActionConfig).toMatchObject({
    to: "manual@example.test", toCardSources: [], ccCardSources: ["persons"], bccCardSources: ["main"],
  });
});

test("one email action offers the actual Mission template, copies its exact content and PDF bytes, and persists a snapshot", async ({ page }) => {
  await parityApi(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/test-fixtures/status-list-native-action.html?action=send_email", { waitUntil: "networkidle" });
  await page.getByTestId("service-action-stage-type").click();
  const type = page.getByTestId("service-action-type");
  await expect(type.locator("option[value=send_email]")).toHaveCount(1);
  await expect(type.locator("option[value=send_email_group],option[value=notify_email],option[value=send_contact_email]")).toHaveCount(0);
  await page.getByTestId("service-action-stage-details").click();
  await page.getByTestId("status-list-email-action-open-editor").click();
  const editor = page.getByTestId("status-list-email-action-content-editor");
  await editor.getByTestId("status-list-email-action-editor-template").click();
  const choice = page.getByTestId(`status-list-email-action-editor-template-template-${missionTemplate.id}`);
  await expect(choice).toBeEnabled();
  await choice.click();
  await expect(editor.getByTestId("status-list-email-action-editor-subject")).toHaveValue(missionTemplate.subject);
  await expect(editor.getByTestId("status-list-email-action-editor-body")).toHaveValue(missionTemplate.contentHtml);
  await editor.getByTestId("status-list-email-action-editor-close").click();
  await expect(page.getByTestId("status-list-email-action")).toContainText("mission.pdf");
  await page.screenshot({ path: "/tmp/status-list-mission-attachments.jpg" });
  await page.getByTestId("service-action-stage-review").click();
  await expect(page.getByTestId("service-action-review")).toContainText("mission.pdf");
  await page.getByTestId("status-list-automation-save").click();
  await expect(page.getByTestId("fixture-saved")).toHaveText('"saved"');
  expect(savedWrites[0]).toMatchObject({ actionType: "send_email", serviceActionConfig: {
    to: "{{contact.email}}", templateId: missionTemplate.id, templateSnapshot: true,
    subject: missionTemplate.subject, body: missionTemplate.contentHtml,
    attachments: [{ name: "mission.pdf", contentType: "application/pdf", contentBase64: "cGRm" }],
  } });
  expect(errors).toEqual([]);
});

test("an unreadable template attachment blocks saving and preserves the previous email snapshot", async ({ page }) => {
  await parityApi(page, { brokenAttachment: true });
  await page.goto("/test-fixtures/status-list-native-action.html?action=send_email", { waitUntil: "networkidle" });
  await page.getByTestId("status-list-email-action-open-editor").click();
  const editor = page.getByTestId("status-list-email-action-content-editor");
  await editor.getByTestId("status-list-email-action-editor-template").click();
  await page.getByTestId(`status-list-email-action-editor-template-template-${missionTemplate.id}`).click();
  await expect(editor.getByRole("alert")).toBeVisible();
  await expect(editor.getByTestId("status-list-email-action-editor-subject")).toHaveValue("Original subject");
  await expect(editor.getByTestId("status-list-email-action-editor-body")).toHaveValue("<p>Original body</p>");
  await editor.getByTestId("status-list-email-action-editor-close").click();
  await page.getByTestId("service-action-stage-review").click();
  await expect(page.getByTestId("status-list-automation-save")).toBeDisabled();
  expect(savedWrites).toHaveLength(0);
});

for (const hospital of [false, true]) test(`Update record uses the shared ${hospital ? "hospital" : "clinic"} editor, requires confirmation and saves typed changes`, async ({ page }) => {
  await parityApi(page, { hospital });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/test-fixtures/status-list-native-action.html?action=${hospital ? "update_record_hospital" : "update_record"}`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("update-record-0")).toBeVisible();
  await expect(page.getByTestId("update-record-0-ack")).not.toBeChecked();
  await page.getByTestId("service-action-stage-review").click();
  await expect(page.getByTestId("status-list-automation-save")).toBeDisabled();
  await page.getByTestId("service-action-stage-details").click();
  await page.getByTestId("update-record-0-ack").check();
  await page.screenshot({ path: `/tmp/status-list-update-${hospital ? "hospital" : "clinic"}.jpg` });
  await page.getByTestId("service-action-stage-review").click();
  await expect(page.getByTestId("service-action-review")).toContainText(hospital ? "autoRecruiting" : "Clinic reviewed");
  await page.getByTestId("status-list-automation-save").click();
  await expect(page.getByTestId("fixture-saved")).toHaveText('"saved"');
  expect(savedWrites[0]).toMatchObject({ actionType: "update_record", serviceActionConfig: {
    updateRecordVersion: 2, target: { mode: "event", entityType: hospital ? "hospital" : "clinic" },
    fields: hospital ? { autoRecruiting: true } : { notes: "Clinic reviewed" }, acknowledged: true,
  } });
  expect(errors).toEqual([]);
});
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
      : path === "/api/message-templates" ? templateCatalog(request.url())
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
  await reopened.getByTestId("notify-user-template-0").click();
  await page.getByTestId(`notify-user-template-0-template-${nativeTemplate("notification").id}`).click();
  await expect(reopened.getByTestId("notify-user-title-0")).toHaveValue(nativeTemplate("notification").subject);
  await expect(reopened.getByTestId("notify-user-message-0")).toHaveValue(nativeTemplate("notification").content);
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
    templateId: nativeTemplate("notification").id,
    targetRole: "role:supervisor",
    title: "Registration needs review",
    message: "Please review {{contact.name}}.",
  });
  expect(savedWrites[0]).not.toHaveProperty("serviceActionOwnerId");
  expect(errors).toEqual([]);
});

test("native email editor keeps pending recipients unsavable, then saves the same native email config", async ({ page }) => {
  savedWrites.length = 0;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "PUT" && path.includes("/status-list/12/automations/")) {
      const body = request.postDataJSON() as Record<string, unknown>;
      savedWrites.push(body);
      return route.fulfill({ json: { id: "native-email", ...body } });
    }
    if (request.method() !== "GET") return route.fulfill({ status: 405, json: {} });
    const body = path === "/api/campaigns/42" ? { id: "42", name: "Campaign registration", countryCodes: ["SK"], settings: { smsProvider: "smstools" } }
      : path === "/api/message-templates" ? templateCatalog(request.url())
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
  for (const width of [1100, 700, 374]) {
    await page.setViewportSize({ width: Math.max(width + 30, 390), height: 1000 });
    await expect.poll(async () => {
      const [form, container] = await Promise.all([email.boundingBox(), page.getByTestId("status-list-native-action").boundingBox()]);
      return form && container ? form.width / container.width : 0;
    }).toBeGreaterThan(0.95);
    if (width === 700) await page.screenshot({ path: "/tmp/status-list-email-full-width.jpg" });
  }
  await page.setViewportSize({ width: 1360, height: 1000 });
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
  await editor.getByTestId("status-list-email-action-editor-template").click();
  const selectedTemplate = page.getByTestId(`status-list-email-action-editor-template-template-${nativeTemplate("email").id}`);
  await expect(selectedTemplate).toBeEnabled();
  await selectedTemplate.click();
  await expect(editor.getByTestId("status-list-email-action-editor-subject")).toHaveValue(nativeTemplate("email").subject);
  await expect(editor.getByTestId("status-list-email-action-editor-body")).toHaveValue(nativeTemplate("email").contentHtml!);
  await expect(selectedTemplate).not.toBeVisible();
  await page.screenshot({ path: "/tmp/status-list-email-template-loaded.jpg" });
  await editor.getByTestId("status-list-email-action-editor-subject").fill("Registration status");
  await editor.getByTestId("status-list-email-action-editor-body").fill("<p>Reviewed successfully.</p>");
  await editor.getByTestId("status-list-email-action-editor-close").click();
  await page.getByTestId("service-action-stage-review").click();
  await page.getByTestId("status-list-automation-save").click();
  await expect(page.getByTestId("fixture-saved")).toHaveText('"saved"');
  expect(savedWrites[0].serviceActionConfig).toMatchObject({
    emailActionVersion: 2, senderMode: "personal", subject: "Registration status", body: "<p>Reviewed successfully.</p>", templateId: nativeTemplate("email").id,
  });
  expect(String((savedWrites[0].serviceActionConfig as any).to)).toContain("dispatch@example.invalid");
  expect(errors).toEqual([]);
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
         : path === "/api/message-templates" ? templateCatalog(request.url()) : [];
    return route.fulfill({ json: body });
  });
  await page.goto("/test-fixtures/status-list-native-action.html?action=send_sms", { waitUntil: "networkidle" });
  const sms = page.getByTestId("status-list-sms-action");
  await expect(page.getByTestId("status-list-native-action")).toContainText("Gateway inherited from the campaign mission");
  await expect(page.getByTestId("status-list-native-action")).not.toContainText("conflicts with the mission gateway");
  await sms.getByTestId("status-list-sms-action-open-editor").click();
  const editor = page.getByTestId("status-list-sms-action-editor");
  await expect(editor).toBeVisible();
  await editor.getByTestId("status-list-sms-action-template").click();
  await page.getByTestId(`status-list-sms-action-template-template-${nativeTemplate("sms").id}`).click();
  await expect(editor.getByTestId("status-list-sms-action-text")).toHaveValue(nativeTemplate("sms").content);
  await editor.getByTestId("status-list-sms-action-text").fill("Your registration is ready.");
  await editor.getByTestId("status-list-sms-action-apply").click();
  await page.getByTestId("service-action-stage-review").click();
  await page.getByTestId("status-list-automation-save").click();
  await expect(page.getByTestId("fixture-saved")).toHaveText('"saved"');
  expect(savedWrites[0].serviceActionConfig).toMatchObject({
    smsActionVersion: 2, provider: "default", text: "Your registration is ready.", to: ["+421900123456"], templateId: nativeTemplate("sms").id,
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
            : path === "/api/message-templates" ? templateCatalog(request.url()) : [];
    return route.fulfill({ json: body });
  });
  await page.goto("/test-fixtures/status-list-native-action.html?action=assign_task", { waitUntil: "networkidle" });
  const task = page.getByTestId("status-list-task-action");
  await expect(task).toBeVisible();
  await task.getByTestId("select-task-action-template").click();
  await page.getByTestId(`select-task-action-template-template-${nativeTemplate("task").id}`).click();
  await expect(task.getByTestId("input-task-action-title")).toHaveValue(nativeTemplate("task").subject);
  await expect(task.getByTestId("textarea-task-action-text")).toHaveValue(nativeTemplate("task").content);
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
    title: "Check registration", taskText: "Call {{contact.name}}.", recipients: [{ kind: "user", id: "manager-17" }], templateId: nativeTemplate("task").id,
  });
});
