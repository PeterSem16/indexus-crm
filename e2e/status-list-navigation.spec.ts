import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page, options: {
  phase?: string; hidden?: boolean; actions?: boolean; failure?: boolean;
  sibling?: boolean; kind?: "child" | "root" | "option"; sourceManaged?: boolean; mode?: string;
} = {}) {
  const writes: Array<{ path: string; body: any }> = [];
  const previews: any[] = [];
  const sourceKind = options.kind || "child";
  const actions = options.actions ? [
    { id: "callback", actionType: "set_callback", callbackOffsetDays: 7 },
    { id: "task", actionType: "assign_task" },
    { id: "status", actionType: "set_contact_status" },
  ] : [];
  let state: any[] = options.sibling ? [{ statusListItemId: "previous", confirmedAt: "2026-10-26T09:00:00Z" }] : [];
  let releaseCommit: (() => void) | undefined;
  let holdCommit = false;
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let json: unknown = [];
    if (path.endsWith("/confirmation-preview")) {
      previews.push(request.postDataJSON());
      await route.fulfill({ json: { readOnly: true, mode: options.mode || "immediate", actions: actions.map(action => ({
        id: action.id, sourceLabel: "Unknown yet", actionType: action.actionType, condition: "matched",
        targetLabel: action.id === "task" ? "Medical Partner team" : action.id === "status" ? "Unreachable" : undefined,
      })) } });
      return;
    }
    if (request.method() !== "GET" && path.includes("/status-list")) {
      const body = request.postDataJSON();
      writes.push({ path, body });
      if (holdCommit && path.endsWith("/source")) await new Promise<void>(resolve => { releaseCommit = resolve; });
      if (options.failure) {
        await route.fulfill({ json: { ok: false, actionResults: [{ ok: false }] } });
        return;
      }
      const id = path.split("/").at(-1)!;
      state = state.filter(row => row.statusListItemId !== id);
      if (body.confirm) state.push({ statusListItemId: id, confirmedAt: "2026-10-26T10:00:00Z" });
      await route.fulfill({ json: { ok: true, actionResults: [] } });
      return;
    }
    if (path === "/api/auth/me") json = { user: { id: "agent-1", username: "pulse-test", fullName: "Test Agent", role: "agent" } };
    if (path === "/api/campaigns/campaign-1/status-list") json = [
      { id: "source-parent", stepId: "MPN-04", label: "Qualification", tab: "acquisition", questionSelectionMode: "single", automations: [] },
      { id: "source", stepId: "MPN-04a", label: "Unknown yet",
        parentId: sourceKind === "child" ? "source-parent" : null, tab: sourceKind === "child" ? null : "acquisition",
        itemType: sourceKind === "option" ? "option" : "step", sourceManaged: !!options.sourceManaged,
        nextStepId: "MPN-05a", automations: actions },
      { id: "previous", stepId: "MPN-04b", label: "Previous choice", parentId: "source-parent", automations: [] },
      { id: "target-parent", stepId: "MPN-05", label: "Cooperation", tab: options.phase || "acquisition", isHidden: !!options.hidden, automations: [] },
      { id: "target", stepId: "MPN-05a", label: "Cooperation not offered yet", parentId: "target-parent", automations: [] },
    ];
    if (path.endsWith("/status-list-state")) json = state;
    if (path.endsWith("/status-list-workflows")) json = { answers: [], sources: [], catalog: [] };
    await route.fulfill({ json });
  });
  await page.goto(`/test-fixtures/pulse-status-notes.html?mode=${options.mode || "immediate"}`);
  await expect(page.getByTestId("sl-agent-item-source-parent")).toBeVisible();
  return { writes, previews, hold: () => { holdCommit = true; }, release: () => releaseCommit?.() };
}

test("one complete recap: callback, task, unreachable and final redirect; cancel preserves old answer", async ({ page }) => {
  const captured = await setup(page, { actions: true, sibling: true, phase: "retention" });
  await expect(page.getByTestId("sl-nextstep-btn-source")).toHaveCount(0);
  await page.getByTestId("sl-check-source").click();
  const recap = page.getByTestId("status-list-action-recap");
  await expect(recap).toContainText("Medical Partner team");
  await expect(recap).toContainText("Unreachable");
  await expect(page.getByTestId("status-list-recap-callback-date")).toBeVisible();
  await expect(page.getByTestId("status-list-recap-navigation")).toContainText("Cooperation not offered yet");
  await expect(page.getByTestId("status-list-recap-navigation")).toContainText("Unknown yet");
  expect(captured.writes).toEqual([]);
  await page.getByRole("dialog").getByRole("button", { name: /Cancel|Zrušiť/, exact: true }).click();
  expect(captured.writes).toEqual([]);
  await expect(page.getByTestId("sl-check-previous")).toHaveClass(/bg-emerald-500/);
  await expect(page.locator("#sl-step-MPN-05a")).toHaveCount(0);
  await page.getByTestId("sl-check-source").click();
  await page.getByTestId("status-list-recap-confirm").click();
  await expect(page.locator("#sl-step-MPN-05a")).toHaveClass(/ring-2/);
  await expect(page.locator("#sl-step-MPN-05a")).toBeInViewport();
  expect(captured.writes.map(write => write.body.confirm)).toEqual([false, true]);
  expect(captured.writes[1].body.overrideCallbackDate).toBeTruthy();
  expect(captured.writes.some(write => write.path.endsWith("/target"))).toBe(false);
});

for (const kind of ["root", "child", "option"] as const) {
  test(`${kind}: redirect only after successful commit, no separate link or second modal`, async ({ page }) => {
    const captured = await setup(page, { kind, phase: "retention" });
    captured.hold();
    if (kind === "option") await page.getByRole("button", { name: "Unknown yet", exact: true }).click();
    else await page.getByTestId("sl-check-source").click();
    await expect(page.getByTestId("status-list-recap-navigation")).toBeVisible();
    expect(captured.writes).toEqual([]);
    await page.getByTestId("status-list-recap-confirm").click();
    await expect.poll(() => captured.writes.length).toBe(1);
    await expect(page.locator("#sl-step-MPN-05a")).toHaveCount(0);
    captured.release();
    await expect(page.locator("#sl-step-MPN-05a")).toHaveClass(/ring-2/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(captured.writes).toHaveLength(1);
  });
}

test("failed action does not redirect", async ({ page }) => {
  await setup(page, { failure: true, phase: "retention" });
  await page.getByTestId("sl-check-source").click();
  await page.getByTestId("status-list-recap-confirm").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#sl-step-MPN-05a")).toHaveCount(0);
});

test("hidden destination warns in same recap, without blocking the actual answer", async ({ page }) => {
  const captured = await setup(page, { hidden: true });
  await page.getByTestId("sl-check-source").click();
  await expect(page.getByTestId("status-list-recap-navigation")).toContainText(/unavailable|nedostupný/);
  await page.getByTestId("status-list-recap-confirm").click();
  await expect.poll(() => captured.writes.length).toBe(1);
  await expect(page.locator("#sl-step-MPN-05a")).toHaveCount(0);
});

test("system-owned answer stays protected", async ({ page }) => {
  const captured = await setup(page, { sourceManaged: true });
  await expect(page.getByTestId("sl-check-source")).toBeDisabled();
  await expect(page.getByTestId("sl-nextstep-btn-source")).toHaveCount(0);
  expect(captured.writes).toEqual([]);
});

test("Batch stages silently, reviews on Save, then redirects after commit", async ({ page }) => {
  const captured = await setup(page, { mode: "batch", phase: "retention" });
  await page.getByTestId("sl-check-source").click();
  await expect(page.getByTestId("status-list-action-recap")).toHaveCount(0);
  expect(captured.writes).toEqual([]);
  await page.getByTestId("btn-sl-batch-save").click();
  await page.getByTestId("btn-sl-batch-save-confirm").click();
  await expect(page.getByTestId("status-list-recap-navigation")).toBeVisible();
  expect(captured.writes).toEqual([]);
  await page.getByTestId("status-list-recap-confirm").click();
  await expect(page.locator("#sl-step-MPN-05a")).toHaveClass(/ring-2/);
  expect(captured.writes).toHaveLength(1);
});

test("mobile dark recap contains actions and final redirect; reduced motion navigation works", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.documentElement.classList.add("dark")));
  await setup(page, { actions: true });
  await page.getByTestId("sl-check-source").click();
  await expect(page.getByTestId("status-list-action-recap")).toContainText("Medical Partner team");
  await page.getByTestId("status-list-recap-navigation").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("status-list-recap-navigation")).toBeInViewport();
  await expect(page.getByTestId("status-list-recap-confirm")).toBeInViewport();
  await page.screenshot({ path: "/tmp/status-list-navigation-mobile.jpg" });
  await page.getByTestId("status-list-recap-confirm").click();
  await expect(page.locator("#sl-step-MPN-05a")).toHaveClass(/ring-2/);
});
