import { expect, test, type Page } from "@playwright/test";

type NoteState = {
  campaignId: string;
  campaignContactId: string;
  contactId: string;
  statusListItemId: string;
  itemNote: string | null;
  confirmedAt: string;
  confirmedByName: string;
};

const statusList = [
  {
    id: "ret-parent",
    label: "Retention parent",
    tab: "retention",
    required: false,
    questionSelectionMode: "multiple",
    itemType: "step",
    isHidden: false,
    automations: [],
    stepId: "ret-parent",
  },
  {
    id: "ret-child",
    parentId: "ret-parent",
    label: "Retention child",
    tab: "retention",
    required: false,
    itemType: "step",
    isHidden: false,
    automations: [],
    stepId: "ret-child",
  },
  {
    id: "acq-step",
    label: "Acquisition selection",
    tab: "acquisition",
    required: false,
    itemType: "step",
    isHidden: false,
    automations: [],
    stepId: "acq-step",
  },
];

function initialState(): NoteState[] {
  return [
    {
      campaignId: "campaign-1",
      campaignContactId: "campaign-contact-1",
      contactId: "contact-1",
      statusListItemId: "ret-parent",
      itemNote: "Parent note from server",
      confirmedAt: "2025-01-01T10:00:00.000Z",
      confirmedByName: "Test Agent",
    },
    {
      campaignId: "campaign-1",
      campaignContactId: "campaign-contact-1",
      contactId: "contact-1",
      statusListItemId: "ret-child",
      itemNote: "Child note from server",
      confirmedAt: "2025-01-01T10:01:00.000Z",
      confirmedByName: "Test Agent",
    },
  ];
}

async function installStatusListStub(page: Page) {
  let storedState = initialState();
  const requests: Array<{ method: string; url: string; body: unknown }> = [];
  let failNextNotePatch = false;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    let body: unknown = null;
    try {
      body = request.postDataJSON();
    } catch {
      // GETs and empty requests have no JSON body.
    }
    requests.push({ method, url: path, body });

    if (path === "/api/auth/me" && method === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "agent-1", username: "pulse-test", fullName: "Test Agent", role: "agent" },
        }),
      });
      return;
    }

    if (path === "/api/campaigns/campaign-1/status-list" && method === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(statusList) });
      return;
    }

    if (
      path === "/api/campaigns/campaign-1/contacts/campaign-contact-1/status-list-state" &&
      method === "GET"
    ) {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(storedState) });
      return;
    }

    const noteMatch = path.match(
      /^\/api\/campaigns\/campaign-1\/contacts\/campaign-contact-1\/status-list-state\/([^/]+)\/note$/,
    );
    if (noteMatch && method === "PATCH") {
      if (failNextNotePatch) {
        failNextNotePatch = false;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "intentional note failure" }),
        });
        return;
      }
      const note = (body as { note?: unknown } | null)?.note;
      storedState = storedState.map((row) =>
        row.statusListItemId === noteMatch[1]
          ? { ...row, itemNote: typeof note === "string" ? note : null }
          : row,
      );
      const state = storedState.find((row) => row.statusListItemId === noteMatch[1]);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, changed: true, state }),
      });
      return;
    }

    // A real status-list note save must not hit any of these mutation routes.
    if (method === "POST" || method === "PUT" || method === "DELETE") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }

    // CommunicationCanvas has several unrelated optional queries. Returning
    // empty JSON keeps this fixture focused while the status-list endpoints
    // above remain stateful and exact.
    await route.fulfill({ contentType: "application/json", body: JSON.stringify([]) });
  });

  return {
    requests,
    failNextPatch: () => {
      failNextNotePatch = true;
    },
    reset: () => {
      storedState = initialState();
      requests.length = 0;
    },
  };
}

function expectOnlyNoteMutations(requests: Array<{ method: string; url: string }>) {
  const mutations = requests.filter((request) =>
    ["POST", "PATCH", "PUT", "DELETE"].includes(request.method),
  );
  expect(mutations.length).toBeGreaterThan(0);
  expect(mutations.every((request) => request.url.endsWith("/status-list-state/ret-parent/note") ||
    request.url.endsWith("/status-list-state/ret-child/note"))).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("locale", "en");
  });
});

test("real fullscreen CommunicationCanvas keeps parent and child retention notes through save and reopen", async ({
  page,
}) => {
  const stub = await installStatusListStub(page);
  await page.goto("/test-fixtures/pulse-status-notes.html");

  await page.getByTestId("sl-phase-retention").click();
  await expect(page.locator("#sl-step-ret-parent").getByText("Retention parent", { exact: true })).toBeVisible();
  await expect(page.locator("#sl-step-ret-parent").getByText("Retention child", { exact: true })).toBeVisible();
  const parentNote = page.locator("#sl-step-ret-parent textarea").first();
  const childNote = page.locator("#sl-step-ret-parent textarea").nth(1);
  await expect(parentNote).toHaveValue("Parent note from server");
  await expect(childNote).toHaveValue("Child note from server");

  const save = page.getByTestId("btn-sl-batch-save");
  await expect(save).toBeDisabled();

  await parentNote.fill("Parent note edited");
  await expect(save).toBeEnabled();
  await page.screenshot({ path: "/tmp/pulse-status-note-fixed.png", animations: "disabled" });
  const patch = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      request.url().endsWith("/status-list-state/ret-parent/note"),
  );
  await save.click();
  expect((await patch).postDataJSON()).toEqual({ note: "Parent note edited" });
  await expect(save).toBeDisabled();
  expectOnlyNoteMutations(stub.requests);

  // A refetch after invalidation and a real unmount/remount must retain the
  // server value, rather than replacing the local textarea with an old snapshot.
  await page.getByTestId("btn-close-contact-card").click();
  await page.getByTestId("fixture-reopen").click();
  await expect(page.locator("#sl-step-ret-parent textarea").first()).toHaveValue(
    "Parent note edited",
  );
  await expect(page.locator("#sl-step-ret-parent textarea").nth(1)).toHaveValue(
    "Child note from server",
  );

  // Clearing is a first-class draft and is sent as the API's null payload.
  const clearPatch = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      request.url().endsWith("/status-list-state/ret-child/note"),
  );
  await page.locator("#sl-step-ret-parent textarea").nth(1).fill("");
  await page.getByTestId("btn-sl-batch-save").click();
  expect((await clearPatch).postDataJSON()).toEqual({ note: null });
  await expect(page.getByTestId("btn-close-contact-card")).toBeVisible();
  expectOnlyNoteMutations(stub.requests);
});

test("note error preserves text and retry succeeds without confirmation or automation", async ({
  page,
}) => {
  const stub = await installStatusListStub(page);
  await page.goto("/test-fixtures/pulse-status-notes.html");
  await page.getByTestId("sl-phase-retention").click();
  const parentNote = page.locator("#sl-step-ret-parent textarea").first();
  const save = page.getByTestId("btn-sl-batch-save");
  await expect(parentNote).toHaveValue("Parent note from server");

  await parentNote.fill("Retryable parent note");
  stub.failNextPatch();
  await save.click();
  await expect(parentNote).toHaveValue("Retryable parent note");
  await expect(save).toBeEnabled();

  const retryPatch = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      request.url().endsWith("/status-list-state/ret-parent/note"),
  );
  await save.click();
  expect((await retryPatch).postDataJSON()).toEqual({ note: "Retryable parent note" });
  await expect(save).toBeDisabled();
  expectOnlyNoteMutations(stub.requests);
  expect(stub.requests.some((request) => request.method === "PATCH")).toBe(true);
});

test("selection changes can be discarded while a note remains a note-only save", async ({ page }) => {
  const stub = await installStatusListStub(page);
  await page.goto("/test-fixtures/pulse-status-notes.html");
  const save = page.getByTestId("btn-sl-batch-save");
  const parentNote = page.locator("#sl-step-ret-parent textarea").first();

  await page.getByTestId("sl-phase-acquisition").click();
  await page.getByTestId("sl-check-acq-step").click();
  await expect(save).toBeEnabled();
  // Removing the staged selection must not turn the existing note into a
  // duplicate confirmation candidate.
  await page.getByTestId("sl-check-acq-step").click();
  await page.getByTestId("sl-phase-retention").click();
  await parentNote.fill("Selection mixed note");
  const patch = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      request.url().endsWith("/status-list-state/ret-parent/note"),
  );
  await save.click();
  expect((await patch).postDataJSON()).toEqual({ note: "Selection mixed note" });
  expectOnlyNoteMutations(stub.requests);
});

test("real CustomerInfoPanel history renders confirmation, note update, clear, actor, and time", async ({
  page,
}) => {
  await installStatusListStub(page);
  await page.goto("/test-fixtures/pulse-status-notes.html");

  const confirmation = page.getByTestId("history-item-history-confirmation");
  const update = page.getByTestId("history-item-history-note-update");
  const clear = page.getByTestId("history-item-history-note-clear");
  await expect(confirmation).toContainText("Retention parent");
  await expect(confirmation).toContainText("Parent note from server");
  await expect(confirmation).toContainText("Test Agent");
  await expect(confirmation).toContainText("10:00");
  await expect(update).toContainText("Edited historical note");
  await expect(update).toContainText("Test Agent");
  await expect(update).toContainText("11:15");
  await expect(clear).toContainText("Poznámka vymazaná");
  await expect(clear).toContainText("Test Agent");
  await expect(clear).toContainText("12:30");
});