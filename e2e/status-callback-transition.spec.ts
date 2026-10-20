import { expect, test, type Page } from "@playwright/test";
import { medicalPartnerAudit, MEDICAL_PARTNER_AUDIT_CAMPAIGN } from "../shared/status-list-transition-audit";
import type { TransitionInventories } from "../shared/status-list-transition";
import { getStatusListCallbackTransitionCopy } from "../client/src/components/status-list-callback-transition-copy";

type Owner = "legacy" | "compatible";
type Readiness = {
  campaignId: string;
  missionName: string;
  fingerprint: string;
  capturedAt: string;
  owner: Owner;
  supported: boolean;
  ready: boolean;
  blockers: string[];
  callbackCount: number;
  pendingCount: number;
  failedCount: number;
  legacyOnlyCount: number;
  audit: Array<{ at: string; from: string; to: string; actorName: string | null }>;
};

const audited = medicalPartnerAudit(MEDICAL_PARTNER_AUDIT_CAMPAIGN)!;
const inventory: TransitionInventories = {
  current: { ...structuredClone(audited), source: "current_configuration", fingerprint: "current-test", evidence: {
    ...audited.evidence, sourceCommit: null, schemaAvailable: true,
  } },
  audited: structuredClone(audited),
};

function makeReadiness(overrides: Partial<Readiness> = {}): Readiness {
  return {
    campaignId: MEDICAL_PARTNER_AUDIT_CAMPAIGN,
    missionName: "Medical Partner Mission",
    fingerprint: "live-fingerprint-72ac",
    capturedAt: "2026-10-20T12:15:00.000Z",
    owner: "legacy",
    supported: true,
    ready: true,
    blockers: [],
    callbackCount: 8,
    pendingCount: 0,
    failedCount: 0,
    legacyOnlyCount: 0,
    audit: [],
    ...overrides,
  };
}

async function setup(page: Page, initial = makeReadiness()) {
  const errors: string[] = [];
  const posts: Array<{ url: string; body: Record<string, unknown> }> = [];
  let current = structuredClone(initial);
  let readinessGets = 0;
  let postStatus = 200;
  page.on("pageerror", error => errors.push(error.message));

  await page.route("**/test-fixtures/status-transition.html*", async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/src="\/src\/main\.tsx[^"]*"/, 'src="/test-fixtures/status-transition.tsx"');
    await route.fulfill({ response, body: html });
  });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/status-list-workflows/transition-readiness") && route.request().method() === "GET") {
      readinessGets++;
      return route.fulfill({ json: current });
    }
    if (url.pathname.endsWith("/status-list-workflows/transition-switch") && route.request().method() === "POST") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      posts.push({ url: url.pathname, body });
      if (postStatus === 200) {
        current = {
          ...current,
          owner: body.targetOwner as Owner,
          capturedAt: "2026-10-20T12:18:00.000Z",
          audit: [{
            at: "2026-10-20T12:17:00.000Z",
            from: body.expectedOwner as string,
            to: body.targetOwner as string,
            actorName: "Mara Novák",
          }, ...current.audit],
        };
      }
      return route.fulfill({ status: postStatus, json: postStatus === 200 ? { accepted: true } : { error: "stale_fingerprint" } });
    }
    if (url.pathname.endsWith("/status-list-workflows/transition-inventory")) return route.fulfill({ json: inventory });
    if (url.pathname.endsWith("/history")) return route.fulfill({ json: { runs: [] } });
    return route.fulfill({ json: { rules: [], catalog: [] } });
  });
  return {
    errors,
    posts,
    getReadinessGets: () => readinessGets,
    setReadiness: (next: Readiness) => { current = structuredClone(next); },
    setPostStatus: (status: number) => { postStatus = status; },
  };
}

async function openAndConfirm(page: Page, missionName = "Medical Partner Mission") {
  await page.getByTestId("callback-transition-open-confirm").click();
  await expect(page.getByTestId("callback-transition-submit")).toBeDisabled();
  await page.getByTestId("callback-transition-mission-confirmation").fill(missionName);
  await page.getByTestId("callback-transition-backup-confirmation").check();
  await expect(page.getByTestId("callback-transition-submit")).toBeEnabled();
  await page.getByTestId("callback-transition-submit").click();
}

test("mount and refresh only read; unsupported and blocked readiness never offer an active switch", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/test-fixtures/status-transition.html?locale=en");
  await expect(page.getByTestId("callback-transition-control")).toBeVisible();
  await expect.poll(state.getReadinessGets).toBeGreaterThan(0);
  expect(state.posts).toEqual([]);

  const beforeRefresh = state.getReadinessGets();
  await page.getByTestId("callback-transition-refresh").click();
  await expect.poll(state.getReadinessGets).toBeGreaterThan(beforeRefresh);
  expect(state.posts).toEqual([]);

  state.setReadiness(makeReadiness({ supported: false, blockers: ["unsupported_mission"] }));
  await page.getByTestId("callback-transition-refresh").click();
  await expect(page.getByTestId("callback-transition-unavailable")).toBeVisible();
  await expect(page.getByTestId("callback-transition-open-confirm")).toHaveCount(0);
  expect(state.posts).toEqual([]);

  state.setReadiness(makeReadiness({ ready: false, blockers: ["pending_events"] }));
  await page.getByTestId("callback-transition-refresh").click();
  await expect(page.getByTestId("callback-transition-open-confirm")).toBeDisabled();
  await expect(page.getByTestId("callback-transition-blockers")).toContainText("Pending callback events");
  expect(state.posts).toEqual([]);
});

test("requires exact Mission name and operator acknowledgment, posts the live fingerprint, then refreshes owner and audit", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/test-fixtures/status-transition.html?locale=en");
  await expect(page.getByTestId("callback-transition-open-confirm")).toBeEnabled();
  expect(state.posts).toEqual([]);

  await page.getByTestId("callback-transition-open-confirm").click();
  const submit = page.getByTestId("callback-transition-submit");
  await expect(submit).toBeDisabled();
  await page.getByTestId("callback-transition-mission-confirmation").fill("Medical Partner");
  await expect(submit).toBeDisabled();
  await page.getByTestId("callback-transition-mission-confirmation").fill("Medical Partner Mission");
  await expect(submit).toBeDisabled();
  await page.getByTestId("callback-transition-backup-confirmation").check();
  await expect(submit).toBeEnabled();
  const getsBeforePost = state.getReadinessGets();
  await submit.click();

  await expect(page.getByTestId("callback-transition-switch-success")).toBeVisible();
  expect(state.posts).toHaveLength(1);
  expect(state.posts[0].body).toEqual({
    fingerprint: "live-fingerprint-72ac",
    expectedOwner: "legacy",
    targetOwner: "compatible",
    backupConfirmed: true,
    missionNameConfirmation: "Medical Partner Mission",
  });
  expect(state.posts[0].url).toContain("/campaigns/");
  await expect.poll(state.getReadinessGets).toBeGreaterThan(getsBeforePost);
  await expect(page.getByTestId("callback-transition-control")).toContainText("Compatible callback layer");
  await page.getByText(getStatusListCallbackTransitionCopy("en").audit).click();
  await expect(page.getByTestId("callback-transition-control")).toContainText("Mara Novák");
  expect(state.errors).toEqual([]);
});

test("409 resets confirmation, reports a localized stale-state error, and refreshes live readiness", async ({ page }) => {
  const state = await setup(page);
  state.setPostStatus(409);
  await page.goto("/test-fixtures/status-transition.html?locale=en");
  const getsBefore = state.getReadinessGets();
  await openAndConfirm(page);

  await expect(page.getByTestId("callback-transition-switch-error")).toContainText("409");
  await expect(page.getByTestId("callback-transition-submit")).toHaveCount(0);
  await expect.poll(state.getReadinessGets).toBeGreaterThan(getsBefore);
  expect(state.posts).toHaveLength(1);
  await page.getByTestId("callback-transition-open-confirm").click();
  await expect(page.getByTestId("callback-transition-mission-confirmation")).toHaveValue("");
  await expect(page.getByTestId("callback-transition-backup-confirmation")).not.toBeChecked();
  await expect(page.getByTestId("callback-transition-submit")).toBeDisabled();
  expect(state.errors).toEqual([]);
});

test("compatible-to-legacy rollback uses the same confirmation and expected-owner guard", async ({ page }) => {
  const state = await setup(page, makeReadiness({ owner: "compatible" }));
  await page.goto("/test-fixtures/status-transition.html?locale=en");
  await expect(page.getByTestId("callback-transition-open-confirm")).toContainText("Legacy callbacks");
  await openAndConfirm(page);
  await expect(page.getByTestId("callback-transition-switch-success")).toBeVisible();
  expect(state.posts).toHaveLength(1);
  expect(state.posts[0].body).toEqual({
    fingerprint: "live-fingerprint-72ac",
    expectedOwner: "compatible",
    targetOwner: "legacy",
    backupConfirmed: true,
    missionNameConfirmation: "Medical Partner Mission",
  });
  await expect(page.getByTestId("callback-transition-control")).toContainText("Legacy callbacks");
  expect(state.errors).toEqual([]);
});

test("all seven locales render and the dark mobile confirmation and help stay within viewport", async ({ page }) => {
  const state = await setup(page);
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
    await page.goto(`/test-fixtures/status-transition.html?locale=${locale}`);
    const copy = getStatusListCallbackTransitionCopy(locale);
    await expect(page.getByTestId("callback-transition-control")).toContainText(copy.title);
    expect(await page.getByTestId("callback-transition-control").innerText()).not.toContain("undefined");
    if (locale === "en") {
      await page.getByTestId("callback-transition-open-confirm").click();
      const desktopDialog = await page.locator(".slct-dialog").boundingBox();
      expect(desktopDialog).not.toBeNull();
      expect(desktopDialog!.x).toBeGreaterThanOrEqual(0);
      expect(desktopDialog!.x + desktopDialog!.width).toBeLessThanOrEqual(1280);
      expect(desktopDialog!.y).toBeGreaterThanOrEqual(0);
      expect(desktopDialog!.y + desktopDialog!.height).toBeLessThanOrEqual(900);
      await page.getByTestId("callback-transition-cancel").click();
    }
  }
  expect(state.posts).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/test-fixtures/status-transition.html?locale=de&dark=1");
  await page.getByTestId("callback-transition-open-confirm").click();
  await expect(page.getByTestId("callback-transition-backup-confirmation").locator("xpath=..")).toContainText("ALLE Produktions-Worker");
  await page.getByText(getStatusListCallbackTransitionCopy("de").helpTitle).click();
  await expect(page.getByText(getStatusListCallbackTransitionCopy("de").releaseAcknowledgment)).toBeVisible();
  const dialog = await page.locator(".slct-dialog").boundingBox();
  expect(dialog).not.toBeNull();
  expect(dialog!.x).toBeGreaterThanOrEqual(0);
  expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(390);
  expect(dialog!.y).toBeGreaterThanOrEqual(0);
  expect(dialog!.y + dialog!.height).toBeLessThanOrEqual(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(state.errors).toEqual([]);
});
