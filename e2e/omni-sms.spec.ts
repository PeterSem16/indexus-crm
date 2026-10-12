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
  deliveryStatus: null,
  createdAt: "2026-02-18T10:24:00.000Z",
  sentAt: null,
  campaignId: "mission-41",
  campaignName: "Morning appointments",
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
  const replies: Array<typeof inboundMessage> = [];
  const requests: string[] = [];
  const incoming = [inboundMessage];
  const readIds = new Set<string>();
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    requests.push(`${request.method()} ${path}${url.search}`);
    if (path === "/api/auth/me") {
      return route.fulfill({ json: { user: { id: "sms-admin-1", username: "agent-one", fullName: "Agent One", role: "admin", isActive: true, assignedCountries: ["SK"], locale: "en" } } });
    }
    if (path === "/api/omni-sms/access") return route.fulfill({ json: access });
    if (path === "/api/omni-sms/unread") return route.fulfill({ json: { unread: incoming.filter(m => !readIds.has(m.id)).length } });
    if (path === "/api/omni-sms/messages" && request.method() === "GET") {
      const state = url.searchParams.get("readState");
      const messages = incoming.map(m => ({ ...m, isRead: readIds.has(m.id) })).filter(m =>
        state === "read" ? m.isRead : state === "unread" ? !m.isRead : true);
      return route.fulfill({ json: { messages, total: messages.length, page: 0, pageSize: 25 } });
    }
    const detail = incoming.find(m => path === `/api/omni-sms/messages/${m.id}`);
    if (detail && request.method() === "GET") return route.fulfill({ json: { ...detail, isRead: readIds.has(detail.id), replies } });
    const read = incoming.find(m => path === `/api/omni-sms/messages/${m.id}/read`);
    if (read && request.method() === "POST") {
      readIds.add(read.id);
      return route.fulfill({ json: { saved: true } });
    }
    if (path === "/api/omni-sms/permissions" && request.method() === "GET") return route.fulfill({ json: { users: [] } });
    if (path === "/api/send-sms" && request.method() === "POST") {
      sent.push(request.postDataJSON());
      replies.push({ ...inboundMessage, id: "sms-reply-42", direction: "outbound", status: "sent", content: request.postDataJSON().message });
      return route.fulfill({ json: { success: true, id: "sms-reply-42" } });
    }
    return route.fulfill({ status: 404, json: { error: "Not found" } });
  });
  return { sent, requests, receive: () => incoming.push({ ...inboundMessage, id: "sms-new-43", content: "A newly arrived SMS." }) };
}

test("SMS workspace loads a protected detail and sends a source-bound reply", async ({ page }) => {
  const api = await mockSmsApi(page);
  const runtimeErrors: string[] = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  await page.goto("/test-fixtures/omni-sms.html");
  await expect(page.getByTestId(`sms-message-${inboundMessage.id}`)).toBeVisible();
  await expect(page.getByText("BulkGate").first()).toBeVisible();
  await page.getByTestId(`sms-message-${inboundMessage.id}`).click();
  await expect.poll(() => api.requests.includes(`POST /api/omni-sms/messages/${inboundMessage.id}/read`)).toBe(true);
  await expect.poll(() => api.requests.some(request => request === `GET /api/omni-sms/messages/${inboundMessage.id}`)).toBe(true);
  await expect(page.getByText("The patient is considering cancelling the appointment.")).toBeVisible();
  await expect(page.getByTestId("sms-ai-analysis-alert")).toBeVisible();
  await expect(page.getByTestId("sms-campaign-name")).toContainText("Morning appointments");
  await expect(page.getByTestId("sms-campaign-name")).not.toContainText("mission-41");
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
  await expect(page.getByTestId("sms-reply-sms-reply-42")).toContainText("We will call you shortly.");
  await page.reload();
  await page.getByTestId(`sms-message-${inboundMessage.id}`).click();
  await expect(page.getByTestId("sms-reply-sms-reply-42")).toContainText("We will call you shortly.");
  expect(runtimeErrors).toEqual([]);
});

test("filters start collapsed and read filtering follows the private read receipt", async ({ page }) => {
  const api = await mockSmsApi(page);
  await page.goto("/test-fixtures/omni-sms.html");
  const row = page.getByTestId(`sms-message-${inboundMessage.id}`);
  await expect(row).toHaveClass(/is-unread/);
  await expect(row.getByText("Unread", { exact: true })).toBeVisible();
  await expect(page.getByTestId("sms-toggle-filters")).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("sms-filter-controls")).toHaveCount(0);
  await page.getByTestId("sms-toggle-filters").click();
  await expect(page.getByTestId("sms-filter-controls")).toBeVisible();
  await page.getByTestId("sms-read-filter").click();
  await page.getByRole("option", { name: "Unread", exact: true }).click();
  await expect.poll(() => api.requests.some(r => r.includes("readState=unread"))).toBe(true);
  await row.click();
  await expect(row).toHaveCount(0);
  await expect(page.getByTestId("sms-new-message-banner")).toHaveCount(0);
  await page.getByTestId("sms-read-filter").click();
  await page.getByRole("option", { name: "Read", exact: true }).click();
  await expect(row).toHaveClass(/is-read/);
  await expect(row.getByText("Read", { exact: true })).toBeVisible();
  expect(api.requests.filter(r => r === `POST /api/omni-sms/messages/${inboundMessage.id}/read`)).toHaveLength(1);
  await page.getByTestId("sms-toggle-filters").click();
  await expect(page.getByTestId("sms-filter-controls")).toHaveCount(0);
});

test("a new inbound SMS refreshes the box and unread banner without reloading", async ({ page }) => {
  const api = await mockSmsApi(page);
  await page.goto("/test-fixtures/omni-sms.html");
  await expect(page.getByTestId("sms-new-message-banner")).toContainText("1");
  await expect(page.getByTestId(`sms-message-${inboundMessage.id}`)).toBeVisible();
  api.receive();
  await Promise.all([
    expect(page.getByTestId("sms-message-sms-new-43")).toBeVisible({ timeout: 15_000 }),
    expect(page.getByTestId("sms-new-message-banner")).toContainText("2", { timeout: 15_000 }),
  ]);
  await expect(page.getByTestId("sms-message-sms-new-43")).toHaveClass(/is-unread/);
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
