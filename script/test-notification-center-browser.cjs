const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { build } = require("esbuild");
const { chromium } = require("@playwright/test");

const ROOT = process.cwd();
const CHROMIUM = process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";
const PROOF_DIR = "/tmp/notification-browser-proof";
const regressionFailures = [];

function verify(condition, message) {
  if (!condition) regressionFailures.push(message);
}

const BUNDLE_SOURCE = `
  import React from "react";
  import { createRoot } from "react-dom/client";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { NotificationBell } from "./client/src/components/notification-center.tsx";
  import { I18nProvider } from "./client/src/i18n/I18nProvider.tsx";

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  createRoot(document.getElementById("root")).render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider userCountries={window.__notificationLanguage === "sk" ? ["SK"] : []}>
        <div style={{ minHeight: "100vh", padding: 24 }}>
          <NotificationBell />
          <main style={{ marginTop: 24 }}>Synthetic fixture host</main>
        </div>
      </I18nProvider>
    </QueryClientProvider>
  );
`;

function makeNotification(index, isRead) {
  return {
    id: `fixture-notification-${index}`,
    userId: "fixture-user",
    type: "system",
    title: `Synthetic notification ${index}`,
    message: `Fixture message ${index}`,
    priority: index === 1 ? "urgent" : "normal",
    entityType: null,
    entityId: null,
    metadata: {},
    countryCode: null,
    isRead,
    isDismissed: false,
    createdAt: new Date(Date.now() - index * 60_000).toISOString(),
  };
}

function makeTask(index) {
  return {
    id: `fixture-task-${index}`,
    title: `Synthetic task ${index}`,
    status: index % 2 ? "pending" : "in_progress",
  };
}

function fixtures(count = 3, taskCount = 2) {
  return {
    notifications: Array.from({ length: count }, (_, index) => makeNotification(index + 1, index >= 2)),
    unreadCount: Math.min(2, count),
    isLoading: false,
    tasks: Array.from({ length: taskCount }, (_, index) => makeTask(index + 1)),
    tasksLoading: false,
    tasksError: false,
  };
}

async function makeBundle() {
  const result = await build({
    stdin: { contents: BUNDLE_SOURCE, resolveDir: ROOT, loader: "tsx" },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    logLevel: "error",
    jsx: "automatic",
    target: ["es2020"],
    outdir: path.join(ROOT, ".cache/notification-center-browser"),
    alias: {
      "@": path.join(ROOT, "client/src"),
      "@shared": path.join(ROOT, "shared"),
    },
    plugins: [{
      name: "synthetic-notification-hooks",
      setup(buildApi) {
        buildApi.onResolve({ filter: /use-notifications|use-my-open-tasks/ }, (args) => ({
          path: args.path.includes("use-my-open-tasks") ? "my-open-tasks" : "notifications",
          namespace: "fixture-hooks",
        }));
        buildApi.onLoad({ filter: /.*/, namespace: "fixture-hooks" }, (args) => ({
          loader: "js",
          resolveDir: ROOT,
          contents: `
            const React = require("react");
            function useFixture() {
              return React.useSyncExternalStore(
                (callback) => {
                  window.addEventListener("notification-fixture-change", callback);
                  return () => window.removeEventListener("notification-fixture-change", callback);
                },
                () => window.__notificationFixture,
                () => window.__notificationFixture
              );
            }
            ${args.path === "my-open-tasks" ? `
              export function useMyOpenTasks() {
                const fixture = useFixture();
                return {
                  tasks: fixture.tasks,
                  isLoading: fixture.tasksLoading,
                  isError: fixture.tasksError,
                  refetch: () => { window.__taskRefetches = (window.__taskRefetches || 0) + 1; },
                };
              }
            ` : `
              export function useNotifications() {
                const fixture = useFixture();
                return {
                  notifications: fixture.notifications,
                  unreadCount: fixture.unreadCount,
                  isLoading: fixture.isLoading,
                  markAsRead: () => {},
                  markAllAsRead: () => {},
                  dismiss: () => {},
                  dismissAll: () => {},
                };
              }
            `}
          `,
        }));
      },
    }],
  });
  const javascript = result.outputFiles.find((file) => file.path.endsWith(".js"));
  const componentCss = result.outputFiles.find((file) => file.path.endsWith(".css"));
  assert.ok(javascript, "esbuild did not emit the NotificationBell bundle");
  assert.ok(componentCss, "esbuild did not emit the real notification-center component CSS");
  const distCss = fs.readdirSync(path.join(ROOT, "dist/public/assets"))
    .filter((file) => /^index.*\.css$/.test(file))
    .map((file) => fs.readFileSync(path.join(ROOT, "dist/public/assets", file), "utf8"))
    .join("\n");
  assert.ok(distCss, "built dist/public/assets/index*.css (Tailwind utilities) was not found");
  return { javascript: javascript.text, styles: `${distCss}\n${componentCss.text}` };
}

async function createPage(browser, bundle, width, height, fixture, dark = false, language = "en") {
  const page = await browser.newPage({ viewport: { width, height } });
  const html = `<!doctype html><html${dark ? ' class="dark"' : ""}><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>${bundle.styles}</style></head><body><div id="root"></div>
    <script>window.__notificationFixture=${JSON.stringify(fixture)};
      window.__notificationLanguage=${JSON.stringify(language)}; window.__taskRefetches=0;</script>
    <script>${bundle.javascript}</script></body></html>`;
  await page.route("http://notification.test/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: html }));
  await page.goto("http://notification.test/");
  await page.getByTestId("button-notification-bell").waitFor();
  return page;
}

async function setFixture(page, fixture) {
  await page.evaluate((next) => {
    window.__notificationFixture = next;
    window.dispatchEvent(new Event("notification-fixture-change"));
  }, fixture);
}

async function openCenter(page) {
  await page.getByTestId("button-notification-bell").click();
  await page.getByTestId("notification-center-popover").waitFor();
}

async function inspectCountsAndGeometry(page, expected) {
  const tabValues = ["all", "unread", "tasks"];
  const expectedCounts = [expected.notifications, expected.unread, expected.tasks];
  const tabRects = await page.evaluate(() => {
    const rail = document.querySelector(".notification-focus-tab-rail");
    const railRect = rail.getBoundingClientRect();
    const tabs = [...document.querySelectorAll('[role="tab"]')].map((tab) => {
      const rect = tab.getBoundingClientRect();
      const badge = tab.querySelector(".notification-focus-tab-count");
      const badgeRect = badge.getBoundingClientRect();
      const labelRange = document.createRange();
      labelRange.selectNodeContents(tab);
      const labelRect = labelRange.getBoundingClientRect();
      const badgeStyle = getComputedStyle(badge);
      return {
        top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
        width: rect.width, height: rect.height,
        badgeBounds: { top: badgeRect.top, bottom: badgeRect.bottom, left: badgeRect.left, right: badgeRect.right },
        labelBounds: { top: labelRect.top, bottom: labelRect.bottom, left: labelRect.left, right: labelRect.right },
        badgeText: badge.textContent.trim(),
        badge: {
          background: badgeStyle.backgroundColor,
          color: badgeStyle.color,
          radius: badgeStyle.borderRadius,
          height: badgeStyle.height,
          fontSize: badgeStyle.fontSize,
          fontWeight: badgeStyle.fontWeight,
          padding: badgeStyle.padding,
          minWidth: badgeStyle.minWidth,
        },
        active: tab.getAttribute("data-state") === "active",
      };
    });
    return { rail: { top: railRect.top, bottom: railRect.bottom, left: railRect.left, right: railRect.right }, tabs };
  });
  assert.equal(tabRects.tabs.length, 3, "All, Unread and Tasks tabs should be rendered");
  const first = tabRects.tabs[0];
  for (const [index, tab] of tabRects.tabs.entries()) {
    assert.ok(Math.abs(tab.height - first.height) <= 1, `${tabValues[index]} trigger height differs`);
    assert.ok(Math.abs(tab.width - first.width) <= 2, `${tabValues[index]} trigger width differs`);
    assert.ok(Math.abs(tab.top - first.top) <= 1, `${tabValues[index]} trigger is vertically misaligned`);
    assert.ok(tab.left >= tabRects.rail.left - 1 && tab.right <= tabRects.rail.right + 1,
      `${tabValues[index]} trigger extends beyond the tab rail`);
    for (const [part, bounds] of [["label", tab.labelBounds], ["badge", tab.badgeBounds]]) {
      assert.ok(bounds.left >= tab.left - 1 && bounds.right <= tab.right + 1,
        `${tabValues[index]} ${part} extends outside its trigger`);
      assert.ok(bounds.left >= tabRects.rail.left - 1 && bounds.right <= tabRects.rail.right + 1,
        `${tabValues[index]} ${part} extends beyond the tab rail`);
    }
    assert.equal(tab.badgeText, String(expectedCounts[index]), `${tabValues[index]} counter`);
    verify(tab.badge.background !== "rgb(0, 0, 0)", `${tabValues[index]} count has a black background`);
  }
  const active = tabRects.tabs.filter((tab) => tab.active);
  assert.equal(active.length, 1, "exactly one notification tab should be active");
  return { ...tabRects, activeBadge: active[0].badge };
}

async function assertSelectedContent(page, tab, count) {
  const selected = page.getByTestId(`tab-notifications-${tab}`);
  await selected.waitFor();
  assert.equal(await selected.getAttribute("data-state"), "active");
  const panel = page.locator('[role="tabpanel"]:visible');
  await panel.waitFor();
  await page.waitForTimeout(220);
  const rows = tab === "tasks"
    ? panel.locator(".notification-focus-task-row")
    : panel.locator('[data-testid^="notification-item-"]');
  assert.equal(await rows.count(), count, `${tab} fixture display count`);
}

async function assertSummaryAndGap(page, expected = null) {
  const measurements = await page.evaluate(() => {
    const summary = document.querySelector(".notification-focus-summary").getBoundingClientRect();
    const rail = document.querySelector(".notification-focus-tab-rail").getBoundingClientRect();
    const triggers = [...document.querySelectorAll('[role="tab"]')];
    const triggerBottom = Math.max(...triggers.map((trigger) => trigger.getBoundingClientRect().bottom));
    const panel = document.querySelector('[role="tabpanel"]:not([hidden])');
    const panelRect = panel?.getBoundingClientRect();
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: window.__notificationLanguage,
      summaryHeight: summary.height,
      gap: panelRect ? panelRect.top - triggerBottom : null,
      railBottom: rail.bottom,
      triggerBottom,
      panelTop: panelRect?.top ?? null,
      summaryCount: (() => {
        const count = document.querySelector(".notification-focus-summary-count");
        const style = getComputedStyle(count);
        return {
          background: style.backgroundColor,
          color: style.color,
          border: style.border,
          radius: style.borderRadius,
          height: style.height,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          padding: style.padding,
          minWidth: style.minWidth,
        };
      })(),
    };
  });
  if (expected) {
    verify(Math.abs(measurements.summaryHeight - expected.height) <= 1,
      `summary height changed between tabs at ${measurements.viewport} (${measurements.language}): ${expected.height}px → ${measurements.summaryHeight}px`);
    verify(JSON.stringify(measurements.summaryCount) === JSON.stringify(expected.countStyle),
      "summary count styling changed between tabs");
  }
  verify(measurements.gap >= 4, `tab content has insufficient clearance from the rail (${measurements.gap}px)`);
  return { height: measurements.summaryHeight, countStyle: measurements.summaryCount };
}

async function saveScreenshot(page, name) {
  await page.screenshot({ path: path.join(PROOF_DIR, `${name}.png`), fullPage: false });
}

async function testPrimaryFlow(browser, bundle) {
  const page = await createPage(browser, bundle, 1280, 800, fixtures(3, 2));
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  try {
    await openCenter(page);
    await assertSelectedContent(page, "all", 3);
    const allTabMetrics = await inspectCountsAndGeometry(page, { notifications: 3, unread: 2, tasks: 2 });
    const summaryMetrics = await assertSummaryAndGap(page);
    await saveScreenshot(page, "desktop-all");

    await page.getByTestId("tab-notifications-unread").click();
    await assertSelectedContent(page, "unread", 2);
    const unreadTabMetrics = await inspectCountsAndGeometry(page, { notifications: 3, unread: 2, tasks: 2 });
    verify(JSON.stringify(unreadTabMetrics.activeBadge) === JSON.stringify(allTabMetrics.activeBadge),
      "active Unread count badge styling differs from active All");
    await assertSummaryAndGap(page, summaryMetrics);
    await saveScreenshot(page, "desktop-unread");

    await page.getByTestId("tab-notifications-tasks").click();
    await assertSelectedContent(page, "tasks", 2);
    const tasksTabMetrics = await inspectCountsAndGeometry(page, { notifications: 3, unread: 2, tasks: 2 });
    verify(JSON.stringify(tasksTabMetrics.activeBadge) === JSON.stringify(allTabMetrics.activeBadge),
      "active Tasks count badge styling differs from active All");
    await assertSummaryAndGap(page, summaryMetrics);
    await saveScreenshot(page, "desktop-tasks");

    await page.getByTestId("tab-notifications-tasks").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const firstTask = page.locator(".notification-focus-task-row").first();
    await firstTask.waitFor();
    await page.waitForTimeout(200);
    const focus = await firstTask.evaluate((row) => ({
      focused: row.contains(document.activeElement),
      shadow: getComputedStyle(row).boxShadow,
    }));
    assert.equal(focus.focused, true, `keyboard tabbing should focus the first task (active=${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 180))})`);
    assert.match(focus.shadow, /0px 0px 0px 2px inset/,
      `focused first task should have the additional 2px inset focus ring; got ${focus.shadow}`);

    await firstTask.click();
    await page.getByTestId("notification-center-popover").waitFor({ state: "detached" });
    await page.waitForFunction(() => location.pathname === "/email" && location.search.includes("tab=tasks&task=fixture-task-1"));
    assert.equal(await page.evaluate(() => `${location.pathname}${location.search}`), "/email?tab=tasks&task=fixture-task-1");
    assert.deepEqual(browserErrors, [], "browser runtime errors");
  } finally {
    await page.close();
  }
}

async function testResponsiveAndDark(browser, bundle) {
  const mobile = await createPage(browser, bundle, 390, 844, fixtures(3, 2));
  try {
    await openCenter(mobile);
    await assertSelectedContent(mobile, "all", 3);
    await inspectCountsAndGeometry(mobile, { notifications: 3, unread: 2, tasks: 2 });
    const mobileSummary = await assertSummaryAndGap(mobile);
    const bounds = await mobile.getByTestId("notification-center-popover").boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, "popover overflows the 390px mobile viewport");
    await saveScreenshot(mobile, "mobile-all");
    await mobile.getByTestId("tab-notifications-unread").click();
    await assertSelectedContent(mobile, "unread", 2);
    await inspectCountsAndGeometry(mobile, { notifications: 3, unread: 2, tasks: 2 });
    await assertSummaryAndGap(mobile, mobileSummary);
    await mobile.getByTestId("tab-notifications-tasks").click();
    await assertSelectedContent(mobile, "tasks", 2);
    await inspectCountsAndGeometry(mobile, { notifications: 3, unread: 2, tasks: 2 });
    await assertSummaryAndGap(mobile, mobileSummary);
    await saveScreenshot(mobile, "mobile-tasks");
  } finally {
    await mobile.close();
  }

  const dark = await createPage(browser, bundle, 1280, 800, fixtures(3, 2), true);
  try {
    await openCenter(dark);
    await assertSelectedContent(dark, "all", 3);
    await inspectCountsAndGeometry(dark, { notifications: 3, unread: 2, tasks: 2 });
    const darkSummary = await assertSummaryAndGap(dark);
    await saveScreenshot(dark, "dark-all");
    await dark.getByTestId("tab-notifications-unread").click();
    await assertSelectedContent(dark, "unread", 2);
    await inspectCountsAndGeometry(dark, { notifications: 3, unread: 2, tasks: 2 });
    await assertSummaryAndGap(dark, darkSummary);
    await dark.getByTestId("tab-notifications-tasks").click();
    await assertSelectedContent(dark, "tasks", 2);
    await inspectCountsAndGeometry(dark, { notifications: 3, unread: 2, tasks: 2 });
    await assertSummaryAndGap(dark, darkSummary);
    await saveScreenshot(dark, "dark-tasks");
  } finally {
    await dark.close();
  }
}

async function testCountExtremesAndTaskStates(browser, bundle) {
  for (const [count, taskCount] of [[0, 0], [1, 1], [123, 123]]) {
    const data = fixtures(count, taskCount);
    data.unreadCount = count === 0 ? 0 : count === 1 ? 1 : 123;
    if (count === 123) data.notifications = Array.from({ length: count }, (_, index) => makeNotification(index + 1, index >= 123));
    const page = await createPage(browser, bundle, count === 123 ? 320 : 1280, 900, data, false, count === 123 ? "sk" : "en");
    try {
      await openCenter(page);
      await assertSelectedContent(page, "all", count);
      const activeBadgeStyle = (await inspectCountsAndGeometry(page, {
        notifications: count,
        unread: data.unreadCount,
        tasks: taskCount,
      })).activeBadge;
      const summaryMetrics = await assertSummaryAndGap(page);
      if (count === 123) {
        const labels = await page.locator('[role="tab"]').allInnerTexts();
        assert.ok(labels[1].includes("Neprečítané") || labels[1].includes("Neprecitane"),
          `Slovak unread tab translation was not active: ${labels[1]}`);
      }
      await page.getByTestId("tab-notifications-unread").click();
      await assertSelectedContent(page, "unread", data.unreadCount);
      const unreadStyle = (await inspectCountsAndGeometry(page, {
        notifications: count,
        unread: data.unreadCount,
        tasks: taskCount,
      })).activeBadge;
      verify(JSON.stringify(unreadStyle) === JSON.stringify(activeBadgeStyle),
        `active Unread badge style differs at count ${count}`);
      await assertSummaryAndGap(page, summaryMetrics);
      await page.getByTestId("tab-notifications-tasks").click();
      await assertSelectedContent(page, "tasks", taskCount);
      const taskStyle = (await inspectCountsAndGeometry(page, {
        notifications: count,
        unread: data.unreadCount,
        tasks: taskCount,
      })).activeBadge;
      verify(JSON.stringify(taskStyle) === JSON.stringify(activeBadgeStyle),
        `active Tasks badge style differs at count ${count}`);
      await assertSummaryAndGap(page, summaryMetrics);
    } finally {
      await page.close();
    }
  }

  const page = await createPage(browser, bundle, 1280, 800, fixtures(3, 2));
  try {
    await openCenter(page);
    await page.getByTestId("tab-notifications-tasks").click();
    await setFixture(page, { ...fixtures(3, 2), tasksLoading: true });
    await page.locator(".notification-focus-task-list").getByText(/load/i).waitFor();
    await setFixture(page, { ...fixtures(3, 0), tasksError: true });
    await page.getByRole("alert").waitFor();
    await page.getByRole("button", { name: /try again/i }).click();
    assert.equal(await page.evaluate(() => window.__taskRefetches), 1, "task error retry did not call refetch");
  } finally {
    await page.close();
  }
}

(async () => {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  const bundle = await makeBundle();
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM,
    args: ["--no-sandbox"],
  });
  try {
    await testPrimaryFlow(browser, bundle);
    await testResponsiveAndDark(browser, bundle);
    await testCountExtremesAndTaskStates(browser, bundle);
    if (regressionFailures.length) {
      console.error(`NotificationCenter layout regressions (${regressionFailures.length}):\n- ${regressionFailures.join("\n- ")}`);
      console.error(`Screenshots: ${["desktop-all", "desktop-unread", "desktop-tasks", "mobile-all", "mobile-tasks", "dark-all", "dark-tasks"].map((name) => path.join(PROOF_DIR, `${name}.png`)).join(", ")}`);
      throw new Error(`NotificationCenter layout regressions:\n- ${regressionFailures.join("\n- ")}`);
    }
    console.log("NotificationCenter browser regression passed: real component, All/Unread/Tasks counts and fixture rows, aligned triggers and badges, summary/gap, task navigation/popover close, keyboard focus, mobile/dark, 0/1/123 counts, loading/error retry.");
    console.log(`Screenshots: ${["desktop-all", "desktop-unread", "desktop-tasks", "mobile-all", "mobile-tasks", "dark-all", "dark-tasks"].map((name) => path.join(PROOF_DIR, `${name}.png`)).join(", ")}`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});