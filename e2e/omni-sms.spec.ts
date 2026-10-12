import { test, expect } from "@playwright/test";

const inboundMessage = {
  id: "sms-inbound-41",
  countryCode: "SK",
  provider: "bulkgate",
  direction: "inbound",
  content: "Please call me about the appointment tomorrow.",
  recipientPhone: null,
  senderPhone: "+421900111222",
  status: "received",
  deliveryStatus: "read",
  createdAt: "2026-02-18T10:24:00.000Z",
  sentAt: null,
  campaignId: "mission-41",
  entityId: "customer-41",
  entityType: "customer",
  customerId: "customer-41",
  customer: { id: "customer-41", firstName: "Marta", lastName: "Novak" },
  contactName: "Marta Novak",
  aiAnalyzed: true,
  aiAlertLevel: "warning",
  aiSentiment: "negative",
  aiHasAngryTone: false,
  aiHasRudeExpressions: false,
  aiWantsToCancel: true,
  aiWantsConsent: false,
  aiDoesNotAcceptContract: false,
  aiAnalysisNote: "The patient is considering cancelling the appointment.",
};

async function mockSmsApi(page: import("@playwright/test").Page, access = {
  isAdmin: true,
  countries: ["SK", "UNASSIGNED"],
  grants: [],
  gateways: [
    { provider: "bulkgate", label: "BulkGate", countries: ["SK"] },
    { provider: "smstools", label: "SMSTOOLS", countries: ["SK"] },
  ],
}) {
  const sent: unknown[] = [];
  const requests: string[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    requests.push(`${request.method()} ${path}${url.search}`);
    if (path === "/api/auth/me") {
      return route.fulfill({ json: { user: { id: "sms-admin-1", username: "agent-one", fullName: "Agent One", role: "admin", isActive: true, assignedCountries: ["SK"], locale: "en" } } });
    }
    if (path === "/api/omni-sms/access") return route.fulfill({ json: access });
    if (path === "/api/omni-sms/messages" && request.method() === "GET") {
      return route.fulfill({ json: { messages: [inboundMessage], total: 1, page: 0, pageSize: 25 } });
    }
    if (path === `/api/omni-sms/messages/${inboundMessage.id}` && request.method() === "GET") return route.fulfill({ json: inboundMessage });
    if (path === "/api/omni-sms/permissions" && request.method() === "GET") return route.fulfill({ json: { users: [] } });
    if (path === "/api/send-sms" && request.method() === "POST") {
      sent.push(request.postDataJSON());
      return route.fulfill({ json: { success: true, id: "sms-reply-42" } });
    }
    return route.fulfill({ status: 404, json: { error: "Not found" } });
  });
  return { sent, requests };
}

test("SMS workspace loads a protected detail and sends a source-bound reply", async ({ page }) => {
  const api = await mockSmsApi(page);
  const runtimeErrors: string[] = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  await page.goto("/test-fixtures/omni-sms.html");
  await expect(page.getByTestId(`sms-message-${inboundMessage.id}`)).toBeVisible();
  await expect(page.getByText("BulkGate").first()).toBeVisible();
  await page.getByTestId(`sms-message-${inboundMessage.id}`).click();
  await expect.poll(() => api.requests.some(request => request === `GET /api/omni-sms/messages/${inboundMessage.id}`)).toBe(true);
  await expect(page.getByText("The patient is considering cancelling the appointment.")).toBeVisible();
  await expect(page.getByTestId("sms-ai-analysis-alert")).toBeVisible();
  await page.getByTestId("sms-reply-input").fill("We will call you shortly.");
  await page.getByTestId("sms-reply-send").click();
  await expect.poll(() => api.sent.length).toBe(1);
  expect(api.sent[0]).toEqual({
    sourceSmsId: inboundMessage.id,
    to: inboundMessage.senderPhone,
    message: "We will call you shortly.",
    gateway: "bulkgate",
    customerId: inboundMessage.customerId,
    contactType: inboundMessage.entityType,
    campaignId: inboundMessage.campaignId,
  });
  expect(api.requests).toContain(`GET /api/omni-sms/messages/${inboundMessage.id}`);
  expect(runtimeErrors).toEqual([]);
});

test("an ordinary agent without grants makes no messages request", async ({ page }) => {
  const api = await mockSmsApi(page, {
    isAdmin: false,
    countries: ["SK"],
    grants: [],
    gateways: [{ provider: "bulkgate", label: "BulkGate", countries: ["SK"] }],
  });
  await page.goto("/test-fixtures/omni-sms.html");
  await expect(page.getByText("No SMS access has been granted for this country.")).toBeVisible();
  expect(api.requests.some(request => request.startsWith("GET /api/omni-sms/messages?"))).toBe(false);
});

test("administrator grants and revokes each gateway for the selected user/country", async ({ page }) => {
  await mockSmsApi(page);
  const changes: unknown[] = [];
  let providers: string[] = [];
  await page.route("**/api/omni-sms/permissions**", async route => {
    if (route.request().method() === "PUT") {
      changes.push(route.request().postDataJSON());
      providers = route.request().postDataJSON().providers;
      return route.fulfill({ json: { saved: true } });
    }
    return route.fulfill({ json: { users: [{ id: "sms-reader-2", name: "Test Agent", username: "test-agent",
      assignedCountries: ["SK"], providers }] } });
  });
  await page.goto("/test-fixtures/omni-sms.html");
  await expect(page.getByTestId(`sms-message-${inboundMessage.id}`)).toBeVisible();
  await page.getByRole("button", { name: "Manage access" }).click();
  const permissions = page.locator(".sms-permissions-panel");
  await expect(permissions.getByText("Test Agent")).toBeVisible();
  await permissions.getByRole("button", { name: "BulkGate" }).click();
  await permissions.getByRole("button", { name: /save/i }).click();
  await expect.poll(() => changes.length).toBe(1);
  expect(changes[0]).toEqual({ countryCode: "SK", providers: ["bulkgate"] });
  await expect(permissions.getByRole("button", { name: "BulkGate" })).toHaveAttribute("aria-pressed", "true");
  await permissions.getByRole("button", { name: "BulkGate" }).click();
  await permissions.getByRole("button", { name: /save/i }).click();
  await expect.poll(() => changes.length).toBe(2);
  expect(changes[1]).toEqual({ countryCode: "SK", providers: [] });
});

test("mobile detail keeps the reply controls within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSmsApi(page);
  await page.goto("/test-fixtures/omni-sms.html");
  await page.getByTestId(`sms-message-${inboundMessage.id}`).click();
  await expect(page.getByTestId("sms-reply-input")).toBeVisible();
  const bounds = await page.getByTestId("sms-reply-bar").boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/omni-sms-mobile.png" });
});
