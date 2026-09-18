import { expect, test, type Page } from "@playwright/test";

test.setTimeout(90_000);

function makeCall(id: string, index: number) {
  const at = new Date(Date.now() - index * 60_000).toISOString();
  return {
    id,
    userId: "calls-agent",
    customerId: `customer-${id}`,
    campaignId: null,
    phoneNumber: `+421900${String(index).padStart(6, "0")}`,
    direction: index % 2 ? "inbound" : "outbound",
    status: "completed",
    startedAt: at,
    answeredAt: at,
    endedAt: new Date(new Date(at).getTime() + 60_000).toISOString(),
    durationSeconds: 60,
    notes: null,
    createdAt: at,
    customerName: id === "latest-call" ? "Newest caller" : `Caller ${index}`,
    campaignName: null,
    hasRecording: true,
    isMobile: false,
    mobileAgentName: null,
    mobileOutboundCallerId: null,
    isImportant: false,
    campaignContactId: null,
    hungUpBy: "customer",
    inboundQueueId: null,
    inboundQueueName: null,
    dispositionCode: null,
    dispositionName: null,
    dispositionSubstatuses: null,
    contactType: null,
    entityName: null,
    recording: {
      id: `analysis-${id}`,
      analysisStatus: "completed",
      transcriptionText: `Transcript for ${id}.`,
      sentiment: "neutral",
      qualityScore: 7,
      scriptComplianceScore: 8,
      summary: `Summary for ${id}`,
      alertKeywords: [],
      keyTopics: [],
      actionItems: [],
      complianceNotes: null,
      scriptComplianceDetails: null,
      customerName: null,
      agentName: "Calls Agent",
      campaignName: null,
    },
  };
}

async function openCalls(page: Page) {
  const errors: string[] = [];
  let browseRequests = 0;
  let exposeLatest = false;
  const calls = Array.from({ length: 45 }, (_, index) => makeCall(`call-${index}`, index));

  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    let body: unknown = [];

    if (path === "/api/auth/me") {
      body = {
        user: {
          id: "calls-agent",
          username: "calls-agent",
          fullName: "Calls Agent",
          role: "admin",
          isActive: true,
          assignedCountries: ["SK"],
          country: "SK",
          language: "en",
          preferredLanguage: "en",
        },
      };
    } else if (path === "/api/call-logs/browse") {
      browseRequests += 1;
      body = exposeLatest ? [makeCall("latest-call", -1), ...calls] : calls;
    } else if (path === "/api/call-recordings") {
      const callLogId = url.searchParams.get("callLogId")!;
      body = [{
        id: `recording-${callLogId}`,
        callLogId,
        filename: `${callLogId}.wav`,
        durationSeconds: 60,
        analysisStatus: "completed",
        customerName: `Caller ${callLogId}`,
      }];
    } else if (path === "/api/campaign-contact-disposition") {
      body = {
        dispositionCode: "completed",
        dispositionName: "Completed",
        dispositionColor: null,
        dispositionIcon: null,
        checklistItems: [],
      };
    } else if (/^\/api\/call-recordings\/[^/]+\/analysis$/.test(path)) {
      const recordingId = path.split("/")[3];
      body = {
        id: recordingId,
        analysisStatus: "completed",
        transcriptionText: "Test transcript.",
        transcriptionLanguage: "en",
        sentiment: "neutral",
        qualityScore: 7,
        summary: "Test summary.",
        keyTopics: [],
        actionItems: [],
        complianceNotes: null,
        scriptComplianceScore: 8,
        scriptComplianceDetails: null,
        alertKeywords: [],
        analyzedAt: new Date().toISOString(),
        analysisResult: {},
      };
    } else if (path.endsWith("/checklist-response")) {
      body = null;
    } else if (path === "/api/agent-sessions/active") {
      body = null;
    } else if (path.includes("/unread-count") || path.endsWith("/count")) {
      body = { count: 0 };
    } else if (!["GET", "HEAD"].includes(request.method())) {
      await route.fulfill({ status: 405, json: { error: "Blocked test mutation" } });
      return;
    }
    await route.fulfill({ status: 200, json: body });
  });

  await page.goto("/campaigns");
  await page.getByTestId("tab-transcripts").click();
  await expect(page.getByTestId("calls-transcripts-page")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("call-row-call-0")).toBeVisible();

  return {
    errors,
    browseRequests: () => browseRequests,
    exposeLatest: () => { exposeLatest = true; },
  };
}

test("calls refresh on reopen and focus while preserving selection and keeping deep-list detail visible", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  const fixture = await openCalls(page);

  const list = page.getByTestId("calls-list-scroll");
  await page.getByTestId("call-row-call-40").click();
  expect(await list.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByTestId("analysis-detail-call-40")).toBeVisible();
  await expect(page.getByTestId("player-call-40")).toBeInViewport();

  const beforeAutomaticRefresh = fixture.browseRequests();
  fixture.exposeLatest();
  await expect.poll(fixture.browseRequests, { timeout: 20_000 }).toBeGreaterThan(beforeAutomaticRefresh);
  await expect(page.getByTestId("call-row-latest-call")).toHaveCount(1);
  await expect(page.getByTestId("analysis-detail-call-40")).toBeVisible();
  await expect(page.getByTestId("call-row-call-40")).toHaveClass(/bg-primary/);

  const beforeFocusRefresh = fixture.browseRequests();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(fixture.browseRequests).toBeGreaterThan(beforeFocusRefresh);
  await expect(page.getByTestId("analysis-detail-call-40")).toBeVisible();
  await expect(page.getByTestId("call-row-call-40")).toHaveClass(/bg-primary/);

  const beforeReopen = fixture.browseRequests();
  await page.getByTestId("tab-campaigns").click();
  await page.getByTestId("tab-transcripts").click();
  await expect.poll(fixture.browseRequests).toBeGreaterThan(beforeReopen);
  await expect(page.getByTestId("call-row-latest-call")).toHaveCount(1);
  await expect(page.getByTestId("analysis-detail-latest-call")).toBeVisible();

  const paneFitsViewport = await page.getByTestId("call-detail-pane").evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight + 1 && element.scrollWidth <= element.clientWidth + 1;
  });
  expect(paneFitsViewport).toBe(true);
  await page.screenshot({ path: "screenshots/calls-transcripts-desktop.png", animations: "disabled" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("call-row-call-35").click();
  await expect(page.getByTestId("player-call-35")).toBeInViewport();
  const playButtonFullyVisible = await page.getByTestId("btn-play-recording-recording-call-35").evaluate(button => {
    const buttonRect = button.getBoundingClientRect();
    const detailRect = button.closest('[data-testid="call-detail-pane"]')!.getBoundingClientRect();
    const visibleTop = Math.max(0, detailRect.top);
    const visibleBottom = Math.min(window.innerHeight, detailRect.bottom);
    return buttonRect.top >= visibleTop && buttonRect.bottom <= visibleBottom;
  });
  expect(playButtonFullyVisible).toBe(true);
  expect(await page.getByTestId("calls-transcripts-page").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: "screenshots/calls-transcripts-mobile.png", animations: "disabled" });
  await page.getByTestId("button-mobile-call-list").click();
  await expect(page.getByTestId("calls-list-pane")).toBeVisible();
  await expect(page.getByTestId("call-detail-pane")).toBeHidden();
  expect(fixture.errors).toEqual([]);
});