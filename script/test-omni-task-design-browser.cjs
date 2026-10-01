const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { build } = require("esbuild");
const { chromium } = require("@playwright/test");

const ROOT = process.cwd();
const STAGED_SOURCE_ROOT = path.join(ROOT, ".local/pulse-prod-merge-proof/source");
const SOURCE_ROOT = path.resolve(
  process.env.OMNI_TASK_SOURCE_ROOT || (fs.existsSync(STAGED_SOURCE_ROOT) ? STAGED_SOURCE_ROOT : ROOT),
);
const CHROMIUM = process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";
const PROOF_DIR = "/tmp/omni-task-design-proof";
const USER = { id: "fixture-user", username: "fixture.admin", fullName: "Fixture Admin", role: "admin", countries: ["SK"] };
const fixtureTasks = [
  {
    id: "fixture-task-1",
    title: "Prepare the welcome pack",
    description: "INSTRUCTIONS ONLY: Print the approved welcome pack and leave it at reception.",
    status: "pending",
    priority: "urgent",
    assignedUserId: USER.id,
    createdByUserId: USER.id,
    customerId: "fixture-customer",
    assignedDepartmentId: "fixture-dept",
    tags: ["group_id:fixture-ops", "group_id:fixture-back-office"],
    createdAt: "2025-01-18T10:00:00.000Z",
    updatedAt: "2025-01-18T10:00:00.000Z",
    dueDate: "2025-02-15T10:00:00.000Z",
  },
  {
    id: "fixture-task-2",
    title: "Review the shipment checklist",
    description: "Check the delivery against the signed checklist.",
    status: "in_progress",
    priority: "high",
    assignedUserId: "another-fixture-user",
    createdByUserId: USER.id,
    tags: ["group_id:fixture-ops"],
    createdAt: "2025-01-17T10:00:00.000Z",
    updatedAt: "2025-01-17T10:00:00.000Z",
  },
];
const fixtureGroups = [{
  id: "fixture-ops",
  name: "Operations",
  displayAlias: "Operations",
  color: "#a92332",
  members: [{ userId: USER.id }],
}, {
  id: "fixture-back-office",
  name: "Back Office",
  displayAlias: "Back Office",
  isBackOffice: true,
  color: "#a92332",
  members: [{ userId: USER.id }],
}];

function bundleSource() {
  const pageEntry = path.join(SOURCE_ROOT, "client/src/pages/email-client.tsx");
  return `
  import React from "react";
  import { createRoot } from "react-dom/client";
  import { QueryClientProvider } from "@tanstack/react-query";
  import { TooltipProvider } from ${JSON.stringify(path.join(SOURCE_ROOT, "client/src/components/ui/tooltip.tsx"))};
  import { queryClient } from ${JSON.stringify(path.join(SOURCE_ROOT, "client/src/lib/queryClient.ts"))};
  import EmailClientPage from ${JSON.stringify(pageEntry)};
  import { I18nProvider } from ${JSON.stringify(path.join(SOURCE_ROOT, "client/src/i18n/I18nProvider.tsx"))};
  createRoot(document.getElementById("root")).render(
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <I18nProvider userCountries={["SK"]}>
          <div style={{ height: 56, flex: "none" }} aria-hidden="true"></div>
          <EmailClientPage />
        </I18nProvider>
      </QueryClientProvider>
    </TooltipProvider>
  );
`;
}

async function makeBundle() {
  const stagedSidebar = path.join(SOURCE_ROOT, "client/src/components/nexus/nexus-sidebar.tsx");
  const stagedTasksCss = path.join(SOURCE_ROOT, "client/src/components/nexus/nexus-signal-tasks.css");
  const stagedEntityDrawer = path.join(SOURCE_ROOT, "client/src/components/entity-detail-drawer.tsx");
  assert.ok(fs.existsSync(path.join(SOURCE_ROOT, "client/src/pages/email-client.tsx")),
    `EmailClientPage source not found in selected source tree: ${SOURCE_ROOT}`);
  assert.ok(fs.existsSync(stagedSidebar), `NexusSidebar source not found in selected source tree: ${SOURCE_ROOT}`);
  assert.ok(fs.existsSync(stagedTasksCss), `NEXUS Omni Tasks CSS not found in selected source tree: ${SOURCE_ROOT}`);
  assert.ok(fs.existsSync(stagedEntityDrawer), `EntityDetailDrawer source not found in selected source tree: ${SOURCE_ROOT}`);
  const result = await build({
    stdin: { contents: bundleSource(), resolveDir: ROOT, loader: "tsx" },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    logLevel: "error",
    jsx: "automatic",
    target: ["es2020"],
    outdir: path.join(ROOT, ".cache/omni-task-design-browser"),
    alias: { "@": path.join(SOURCE_ROOT, "client/src"), "@shared": path.join(SOURCE_ROOT, "shared") },
    plugins: [{
      name: "fixture-auth-context",
      setup(buildApi) {
          buildApi.onResolve({ filter: /(?:@\/components\/nexus\/nexus-sidebar|@\/components\/nexus\/nexus-signal-tasks\.css|@\/components\/entity-detail-drawer)/ }, args => ({
            path: args.path.endsWith(".css") ? stagedTasksCss : args.path.endsWith("entity-detail-drawer") ? stagedEntityDrawer : stagedSidebar,
          }));
        buildApi.onResolve({ filter: /contexts\/auth-context/ }, () => ({
          path: "fixture-auth-context",
          namespace: "omni-task-fixture",
        }));
        buildApi.onLoad({ filter: /.*/, namespace: "omni-task-fixture" }, () => ({
          loader: "js",
          contents: `export function useAuth() { return { user: window.__fixtureUser, isLoading: false }; }`,
        }));
      },
    }],
  });
  const javascript = result.outputFiles.find(file => file.path.endsWith(".js"));
  const componentCss = result.outputFiles.find(file => file.path.endsWith(".css"));
  assert.ok(javascript, "esbuild did not emit the real EmailClientPage bundle");
  assert.ok(componentCss, "esbuild did not emit the real component CSS");
  const distRoot = fs.existsSync(path.join(SOURCE_ROOT, "dist/public/assets"))
    ? path.join(SOURCE_ROOT, "dist/public/assets")
    : path.join(ROOT, "dist/public/assets");
  const distCss = fs.readdirSync(distRoot)
    .filter(file => /^index.*\.css$/.test(file))
    .map(file => fs.readFileSync(path.join(distRoot, file), "utf8"))
    .join("\n");
  assert.ok(distCss, `built Tailwind/theme CSS was not found in ${distRoot}`);
  return { javascript: javascript.text, styles: `${distCss}\n${componentCss.text}` };
}

function makeHtml(bundle, dark, { customTokens = true } = {}) {
  const testTokens = customTokens
    ? ":root { --primary: 2 76% 35%; --primary-foreground: 42 75% 88%; } .dark { --primary: 2 68% 42%; --primary-foreground: 42 75% 88%; }"
    : "";
  return `<!doctype html><html${dark ? ' class="dark"' : ""}><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.styles}${testTokens}</style></head>
    <body style="margin:0"><div id="root"></div><script>
      window.__fixtureUser=${JSON.stringify(USER)};
      window.__nativeFetchReference=window.fetch;
    </script><script>${bundle.javascript}</script></body></html>`;
}

function sendJson(route, data, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
}

function createApiRouter(requests, options = {}) {
  requests.sourceEntityType = null;
  requests.sourceEntityFailureCount = 0;
  const tasks = fixtureTasks.map(task => ({ ...task, tags: [...task.tags] }));
  let releaseTaskList;
  let taskListGate = Promise.resolve();
  if (options.holdTaskList) taskListGate = new Promise(resolve => { releaseTaskList = resolve; });
  const router = async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/")) return route.fulfill({ status: 200, contentType: "text/html", body: options.html });
    const body = request.postDataJSON?.() ?? null;
    requests.push({ method: request.method(), path: url.pathname, search: url.search, body });
    if (url.pathname === "/api/tasks" && request.method() === "GET") {
      await taskListGate;
      return sendJson(route, tasks);
    }
    if (url.pathname === "/api/task-groups") return sendJson(route, fixtureGroups);
    if (url.pathname === "/api/sms-messages") {
      return sendJson(route, [{
        id: "fixture-sms-1",
        direction: "inbound",
        deliveryStatus: "read",
        senderPhone: "+421 900 000 111",
        content: "SMS branch fixture",
        sentAt: "2025-01-18T12:00:00.000Z",
        createdAt: "2025-01-18T12:00:00.000Z",
      }]);
    }
    if (url.pathname === "/api/users") return sendJson(route, [USER, { id: "another-fixture-user", username: "fixture.other", fullName: "Other Agent" }]);
    if (url.pathname === `/api/users/${USER.id}/ms365-available-mailboxes`) {
      return sendJson(route, [{ email: "fixture@example.test", type: "personal", displayName: "Fixture mailbox" }]);
    }
    if (url.pathname === `/api/users/${USER.id}/ms365-folders`) return sendJson(route, { connected: true, folders: [], inboxId: null });
    if (url.pathname === "/api/departments") return sendJson(route, [{ id: "fixture-dept", name: "Operations" }]);
    if (url.pathname === "/api/customers/lookup") return sendJson(route, []);
    if (url.pathname === "/api/customers/fixture-customer") {
      return sendJson(route, { id: "fixture-customer", firstName: "Casey", lastName: "Patient", companyName: "Fixture Patient" });
    }
    if (url.pathname === "/api/clinics/lookup" && url.searchParams.get("id")) {
      return sendJson(route, [{ id: "fixture-clinic", name: "Fixture Clinic", countryCode: "SK" }]);
    }
    if (url.pathname === "/api/clinics/fixture-clinic") {
      return sendJson(route, { id: "fixture-clinic", name: "Fixture Clinic", countryCode: "SK" });
    }
    if (url.pathname === "/api/hospitals/fixture-hospital") {
      return sendJson(route, { id: "fixture-hospital", name: "Fixture Hospital", fullName: "Fixture Hospital", countryCode: "SK" });
    }
    if (url.pathname === "/api/collaborators/fixture-collaborator") {
      return sendJson(route, { id: "fixture-collaborator", firstName: "Cory", lastName: "Collaborator", email: "cory@example.test" });
    }
    if (/^\/api\/tasks\/[^/]+\/comments$/.test(url.pathname)) {
      return sendJson(route, [{ id: "fixture-comment-1", taskId: "fixture-task-1", userId: "another-fixture-user", content: "COMMENT THREAD ONLY: Vendor confirmed delivery for Monday.", createdAt: "2025-01-18T11:00:00.000Z" }]);
    }
    if (/^\/api\/tasks\/[^/]+$/.test(url.pathname) && request.method() === "PATCH") {
      const task = tasks.find(row => url.pathname.endsWith(row.id));
      if (task) Object.assign(task, body || {});
      await new Promise(resolve => setTimeout(resolve, 180));
      return sendJson(route, task || {});
    }
    if (url.pathname.endsWith("/source-entity")) {
      const entities = {
        customer: { type: "customer", id: "fixture-customer" },
        clinic: { type: "clinic", id: "fixture-clinic" },
        hospital: { type: "hospital", id: "fixture-hospital" },
      };
      if (requests.sourceEntityType === "error" && requests.sourceEntityFailureCount++ === 0) {
        return sendJson(route, { error: "Fixture source resolver unavailable" }, 503);
      }
      return sendJson(route, entities[requests.sourceEntityType] || null);
    }
    return sendJson(route, []);
  };
  return { router, releaseTaskList };
}

async function createPage(browser, bundle, width, height, { dark = false, holdTaskList = false, customTokens = true } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  const requests = [];
  const api = createApiRouter(requests, { html: makeHtml(bundle, dark, { customTokens }), holdTaskList });
  page.on("pageerror", error => { (page.__browserErrors ||= []).push(error.message); });
  await page.route("http://omni-task.test/**", api.router);
  await page.goto("http://omni-task.test/email");
  await page.getByTestId("tab-tasks").waitFor({ timeout: 8000 }).catch(async error => {
    console.error("Staged Omni app failed to mount", { errors: page.__browserErrors, requests, body: await page.locator("body").innerText().catch(() => "") });
    throw error;
  });
  return { page, requests, releaseTaskList: api.releaseTaskList };
}

async function selectTaskStatus(page, status, { verifyOptions = false } = {}) {
  const trigger = page.getByTestId("task-mobile-filter");
  await trigger.waitFor({ state: "visible" });
  await trigger.click();
  const options = page.locator('[role="option"]');
  const statusOrder = ["all", "open", "pending", "in_progress", "completed", "cancelled"];
  if (verifyOptions) {
    const labels = await options.allInnerTexts();
    assert.equal(labels.length, statusOrder.length, "the Radix task status selector should expose all six baseline modes");
    assert.ok(labels.every(label => label.trim().length > 0), "all Radix task status modes should have visible translated labels");
  }
  const optionIndex = statusOrder.indexOf(status);
  assert.notEqual(optionIndex, -1, `unknown task status ${status}`);
  const option = options.nth(optionIndex);
  const label = (await option.innerText()).trim();
  await option.click();
  await page.waitForFunction(({ testId, text }) => {
    const trigger = document.querySelector(`[data-testid="${testId}"]`);
    return trigger?.textContent?.trim() === text;
  }, { testId: "task-mobile-filter", text: label });
}

async function assertVisibleTaskRows(page, expectedIds, label) {
  const rowIds = await page.locator(".nexus-signal-task-row").evaluateAll(rows =>
    rows.map(row => row.getAttribute("data-testid")?.replace("task-item-", "")));
  assert.deepEqual(rowIds.sort(), [...expectedIds].sort(), `${label} should render only eligible task rows`);
}

async function verifyLinkedEntityCards(browser, bundle) {
  for (const type of ["customer", "clinic", "hospital"]) {
    const { page, requests } = await createPage(browser, bundle, 1280, 720);
    try {
      requests.sourceEntityType = type;
      await page.getByTestId("tab-tasks").click();
      await page.getByTestId("task-item-fixture-task-1").waitFor();
      await page.getByTestId("task-item-fixture-task-1").click();
      const openLink = page.getByTestId("task-open-linked-entity");
      await openLink.waitFor({ state: "visible" });
      await openLink.click();
      const expectedRequests = {
        customer: "/api/customers/fixture-customer",
        clinic: "/api/clinics/fixture-clinic",
        hospital: "/api/hospitals/fixture-hospital",
      };
      await page.waitForTimeout(350);
      const drawerState = await page.evaluate(() => ({
        customer: !!document.querySelector('[data-testid="drawer-customer-full"]'),
        clinicDialog: [...document.querySelectorAll('[role="dialog"]')].some(node => node.getAttribute("data-state") === "open"),
        hospital: !!document.querySelector('[data-testid="hospital-edit-backdrop"]'),
        collaborator: !!document.querySelector('[data-testid="drawer-collaborator-full"]'),
        text: document.body.innerText,
      }));
      if (type === "customer") assert.ok(drawerState.customer, `linked customer should open the real customer full card: ${JSON.stringify({ drawerState, errors: page.__browserErrors, requests })}`);
      if (type === "clinic") assert.ok(drawerState.clinicDialog, "linked clinic should open its institution detail card");
      if (type === "hospital") assert.ok(drawerState.hospital, "linked hospital should open its institution detail card");
      if (type === "collaborator") assert.ok(drawerState.collaborator, "linked collaborator should open its real collaborator card");
      assert.ok(requests.some(request => request.path === expectedRequests[type]), `${type} linked-card query should reach its real detail endpoint`);
      assert.deepEqual(page.__browserErrors || [], [], `${type} linked entity card should not raise browser errors`);
    } finally {
      await page.close();
    }
  }

  const unavailable = await createPage(browser, bundle, 1280, 720);
  try {
    await unavailable.page.getByTestId("tab-tasks").click();
    await unavailable.page.getByTestId("task-item-fixture-task-1").waitFor();
    await unavailable.page.getByTestId("task-item-fixture-task-1").click();
    await unavailable.page.waitForTimeout(100);
    assert.equal(await unavailable.page.getByTestId("task-open-linked-entity").count(), 0,
      "an authoritative null source-entity response must not guess from a legacy customerId");
  } finally {
    await unavailable.page.close();
  }

  const retry = await createPage(browser, bundle, 1280, 720);
  try {
    retry.requests.sourceEntityType = "error";
    await retry.page.getByTestId("tab-tasks").click();
    await retry.page.getByTestId("task-item-fixture-task-1").waitFor();
    await retry.page.getByTestId("task-item-fixture-task-1").click();
    const retryButton = retry.page.getByTestId("task-source-retry");
    await retryButton.waitFor({ state: "visible" });
    assert.ok((await retryButton.innerText()).trim(), "source resolver errors should show the existing translated retry action");
    await retryButton.click();
    await retry.page.waitForFunction(() =>
      document.querySelector('[data-testid="task-source-retry"]') === null,
    );
    assert.ok(retry.requests.filter(request => request.path.endsWith("/source-entity")).length >= 2,
      "retry should reissue the task source-entity query");
  } finally {
    await retry.page.close();
  }
}

async function verifyProductionPrimaryContrast(browser, bundle) {
  const { page } = await createPage(browser, bundle, 1280, 720, { customTokens: false });
  try {
    await page.getByTestId("tab-tasks").click();
    await page.getByTestId("task-item-fixture-task-1").waitFor();
    await page.getByTestId("task-subtab-all").click();
    await page.waitForTimeout(220);
    await page.getByTestId("task-item-fixture-task-1").click();
    await page.getByTestId("task-open-linked-entity").waitFor({ state: "detached" });
    const contrasts = await page.evaluate(() => {
      const ratio = element => {
        const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
        const luminance = value => {
          const channels = rgb(value).map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
          return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        };
        const values = [luminance(getComputedStyle(element).color), luminance(getComputedStyle(element).backgroundColor)].sort((a, b) => b - a);
        return { foreground: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor, ratio: (values[0] + 0.05) / (values[1] + 0.05) };
      };
      return {
        primaryForeground: getComputedStyle(document.documentElement).getPropertyValue("--primary-foreground").trim(),
        selectedScope: ratio(document.querySelector('[data-testid="task-subtab-all"]')),
        taskEyebrow: ratio(document.querySelector(".nexus-signal-eyebrow")),
      };
    });
    assert.ok(contrasts.primaryForeground, "production theme should provide --primary-foreground");
    assert.ok(contrasts.selectedScope.ratio >= 4.5, `production selected task scope should meet WCAG contrast: ${JSON.stringify(contrasts)}`);
    assert.ok(contrasts.taskEyebrow.ratio >= 4.5, `production TASK label should meet WCAG contrast: ${JSON.stringify(contrasts)}`);
  } finally {
    await page.close();
  }
}

async function verifyInitialLoadingAndDesktop(browser, bundle) {
  const { page, requests, releaseTaskList } = await createPage(browser, bundle, 1280, 720, { holdTaskList: true });
  try {
    await page.getByTestId("tab-tasks").click();
    await page.locator(".nexus-signal-queue").waitFor({ timeout: 10000 }).catch(async error => {
      console.error("Task queue did not mount", { errors: page.__browserErrors, requests, body: await page.locator("body").innerText().catch(() => "") });
      throw error;
    });
    await page.locator(".nexus-signal-queue .task-loading-skeleton").waitFor();
    assert.ok(await page.locator(".nexus-signal-queue").isVisible(), "task queue loading UI was not visible");
    releaseTaskList();
    await page.getByTestId("task-item-fixture-task-1").waitFor();
    await page.getByTestId("task-subtab-all").click();
    await page.waitForTimeout(220);
    assert.equal(await page.getByTestId("task-subtab-all").getAttribute("aria-pressed"), "true",
      "the selected queue scope should expose its active state accessibly");
    const taskIconParity = await page.evaluate(() => ({
      sidebar: document.querySelector('[data-testid="task-filter-all"] svg')?.tagName,
      sidebarTaskIcon: [...(document.querySelector('[data-testid="task-filter-all"] svg')?.querySelectorAll("path") || [])].map(path => path.getAttribute("d")),
      tabTaskIcon: [...(document.querySelector('[data-testid="tab-tasks"] svg')?.querySelectorAll("path") || [])].map(path => path.getAttribute("d")),
      queueTaskIcon: [...(document.querySelector(".nexus-signal-queue-header svg")?.querySelectorAll("path") || [])].map(path => path.getAttribute("d")),
      backOffice: document.querySelector('[data-testid="task-subtab-back-office"] svg')?.tagName,
      backOfficeGroup: document.querySelector('[data-testid="task-subtab-group-fixture-back-office"] svg')?.tagName,
      backOfficeIcon: [...(document.querySelector('[data-testid="task-subtab-back-office"] svg')?.querySelectorAll("path") || [])].map(path => path.getAttribute("d")),
      backOfficeGroupIcon: [...(document.querySelector('[data-testid="task-subtab-group-fixture-back-office"] svg')?.querySelectorAll("path") || [])].map(path => path.getAttribute("d")),
      backOfficeText: document.querySelector('[data-testid="task-subtab-back-office"]')?.textContent || "",
    }));
    assert.equal(taskIconParity.sidebar, "svg", "sidebar task filters should use lucide SVG icons");
    assert.equal(taskIconParity.backOffice, "svg", "Back Office should use the same lucide icon system");
    assert.equal(taskIconParity.backOfficeGroup, "svg", "an isBackOffice group should use a lucide icon");
    assert.deepEqual(taskIconParity.sidebarTaskIcon, taskIconParity.tabTaskIcon, "All Tasks sidebar and top-level tab should use the exact same Lucide icon");
    assert.deepEqual(taskIconParity.sidebarTaskIcon, taskIconParity.queueTaskIcon, "All Tasks sidebar and queue heading should use the exact same Lucide icon");
    assert.deepEqual(taskIconParity.backOfficeGroupIcon, taskIconParity.backOfficeIcon,
      "an isBackOffice group tab and dedicated Back Office tab should use the exact same Building2 icon");
    assert.equal(taskIconParity.backOfficeText.includes("🏢"), false, "Back Office must not use an emoji icon");
    const selectedScopeContrast = await page.getByTestId("task-subtab-all").evaluate(element => {
      const color = getComputedStyle(element).color;
      const background = getComputedStyle(element).backgroundColor;
      const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const luminance = value => {
        const channels = rgb(value).map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const values = [luminance(color), luminance(background)].sort((a, b) => b - a);
      return { color, background, ratio: (values[0] + 0.05) / (values[1] + 0.05) };
    });
    assert.ok(selectedScopeContrast.ratio >= 4.5,
      `selected task-scope text should meet WCAG contrast with custom non-white primary-foreground: ${JSON.stringify(selectedScopeContrast)}`);
    await page.getByTestId("task-filter-pending").click();
    const pendingBadgeContrast = await page.getByTestId("task-filter-pending").locator("[data-task-count-badge]").evaluate(element => {
      const color = getComputedStyle(element).color;
      const background = getComputedStyle(element).backgroundColor;
      const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const luminance = value => {
        const channels = rgb(value).map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const values = [luminance(color), luminance(background)].sort((a, b) => b - a);
      const rect = element.getBoundingClientRect();
      return { text: element.textContent.trim(), visible: rect.width > 0 && rect.height > 0, ratio: (values[0] + 0.05) / (values[1] + 0.05) };
    });
    assert.ok(pendingBadgeContrast.visible && pendingBadgeContrast.text, "selected Pending count should remain visible");
    assert.ok(pendingBadgeContrast.ratio >= 4.5, `Pending count contrast should pass with non-white primary-foreground: ${JSON.stringify(pendingBadgeContrast)}`);
    const backOfficeCountContrast = await page.getByTestId("task-subtab-back-office").locator("[data-task-count-badge]").evaluate(element => {
      const color = getComputedStyle(element).color;
      const background = getComputedStyle(element).backgroundColor;
      const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const luminance = value => {
        const channels = rgb(value).map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const values = [luminance(color), luminance(background)].sort((a, b) => b - a);
      return { text: element.textContent.trim(), ratio: (values[0] + 0.05) / (values[1] + 0.05) };
    });
    assert.ok(backOfficeCountContrast.text && backOfficeCountContrast.ratio >= 4.5,
      `Back Office queue counts should remain readable on their semantic amber surface: ${JSON.stringify(backOfficeCountContrast)}`);
    await page.getByTestId("task-filter-all").click();
    await page.getByTestId("task-subtab-my").hover();
    const inactiveTabHover = await page.getByTestId("task-subtab-my").evaluate(element => ({
      color: getComputedStyle(element).color,
      background: getComputedStyle(element).backgroundColor,
      outline: getComputedStyle(element).outlineStyle,
    }));
    assert.notEqual(inactiveTabHover.color, "rgba(0, 0, 0, 0)", "inactive task scopes should have readable hover text");
    await page.getByTestId("task-subtab-my").focus();
    await page.keyboard.press("Tab");
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "none",
      "task scope tabs should preserve a visible focus treatment");
    await page.getByTestId("task-item-fixture-task-1").click();
    await page.getByTestId("task-preview-comment-fixture-comment-1").waitFor();
    assert.equal(await page.getByTestId("tab-tasks").getAttribute("data-testid"), "tab-tasks");
    assert.equal(await page.locator(".nexus-signal-task-row").count(), 2);
    await page.getByTestId("task-subtab-group-fixture-ops").waitFor();
    assert.match(await page.getByTestId("task-subtab-group-fixture-ops").innerText(), /Operations\s*2/);
    assert.equal(await page.getByTestId("task-item-fixture-task-1").getAttribute("aria-current"), "true");
    assert.equal(await page.locator(".nexus-signal-detail-header [data-priority='urgent']").count(), 1);
    assert.equal(await page.locator(".nexus-signal-detail-header [data-status='pending']").count(), 1);
    await page.getByTestId("task-resolve-btn").waitFor({ state: "visible" });
    await page.getByTestId("task-reassign-btn").waitFor({ state: "visible" });
    assert.ok(await page.locator(".nexus-signal-brief").innerText().then(text => text.includes("INSTRUCTIONS ONLY")));
    assert.ok(await page.getByTestId("task-preview-comment-fixture-comment-1").innerText().then(text => text.includes("COMMENT THREAD ONLY")));
    assert.equal(await page.locator(".nexus-signal-brief").innerText().then(text => text.includes("COMMENT THREAD ONLY")), false);
    await page.getByTestId("btn-task-filters").click();
    await page.getByTestId("task-queue-search").fill("shipment checklist");
    await page.getByTestId("task-item-fixture-task-2").waitFor();
    assert.equal(await page.getByTestId("task-item-fixture-task-1").count(), 0, "task search should filter the queue");
    await page.getByTestId("task-queue-search").fill("");
    await page.getByTestId("task-filter-in-progress").click();
    await page.getByTestId("task-item-fixture-task-2").waitFor();
    assert.equal(await page.getByTestId("task-item-fixture-task-1").count(), 0, "sidebar status filter should filter tasks");
    await page.getByTestId("task-filter-all").click();
    await page.getByTestId("task-item-fixture-task-1").waitFor();

    // Keyboard navigation should leave a visible focus treatment on a real task row.
    await page.getByTestId("task-item-fixture-task-1").focus();
    await page.keyboard.press("Tab");
    const focusState = await page.evaluate(() => {
      const active = document.activeElement;
      const row = active?.closest(".nexus-signal-task-row");
      return row ? { focused: true, outline: getComputedStyle(row).outlineStyle, width: getComputedStyle(row).outlineWidth } : null;
    });
    assert.ok(focusState?.focused, `Tab should focus a task row; got ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 140))}`);
    assert.notEqual(focusState.outline, "none", "focused task row should have a visible outline");

    await page.getByTestId("task-item-fixture-task-1").click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(PROOF_DIR, "desktop-1280x720.png") });
    await page.getByTestId("task-action-start").click();
    await page.waitForFunction(() => document.querySelector(".nexus-signal-detail-header [data-status='in_progress']"));
    const mutation = requests.find(row => row.method === "PATCH" && row.path === "/api/tasks/fixture-task-1");
    assert.deepEqual(mutation?.body, { status: "in_progress" }, "start action must preserve the existing PATCH request and payload");
    assert.equal(await page.evaluate(() => window.fetch === window.__nativeFetchReference), true, "the native browser fetch binding must remain untouched");
    assert.deepEqual(page.__browserErrors || [], [], "EmailClientPage should not raise browser runtime errors");
    const taskTitle = await page.locator(".nexus-signal-detail-header h2").innerText();
    await page.getByTestId("tab-sms").click();
    await page.getByTestId("sms-item-fixture-sms-1").waitFor({ state: "visible" });
    assert.ok(await page.getByTestId("sms-item-fixture-sms-1").innerText().then(text => text.includes("SMS branch fixture")));
    assert.deepEqual(page.__browserErrors || [], [], "switching to the existing SMS tab should remain error-free");
    return { taskTitle, mutation };
  } finally {
    await page.close();
  }
}

async function verifyShortMobileAndDark(browser, bundle) {
  const layoutIssues = [];
  const measuredBounds = {};
  const short = await createPage(browser, bundle, 1280, 600);
  try {
    await short.page.getByTestId("tab-tasks").click();
    await short.page.getByTestId("task-item-fixture-task-1").waitFor();
    await short.page.getByTestId("task-item-fixture-task-1").click();
    await short.page.getByTestId("task-preview-comment-fixture-comment-1").waitFor();
    await short.page.waitForTimeout(250);
    await short.page.screenshot({ path: path.join(PROOF_DIR, "desktop-1280x600.png") });
    const bounds = await short.page.locator(".nexus-signal-tasks").boundingBox();
    measuredBounds.shortDesktop = bounds;
    assert.ok(bounds && bounds.height <= 545, `short viewport task workspace should respect the header inset (height ${bounds?.height})`);
  } finally {
    await short.page.close();
  }

  const mobile = await createPage(browser, bundle, 1280, 844);
  try {
    await mobile.page.getByTestId("tab-tasks").click();
    await mobile.page.getByTestId("task-subtab-all").click();
    await mobile.page.getByTestId("task-item-fixture-task-1").waitFor();
    await mobile.page.getByTestId("task-filter-pending").click();
    await assertVisibleTaskRows(mobile.page, ["fixture-task-1"], "desktop pending filter");
    await mobile.page.setViewportSize({ width: 390, height: 844 });
    await mobile.page.getByTestId("task-mobile-filter").waitFor({ state: "visible" });
    await selectTaskStatus(mobile.page, "all", { verifyOptions: true });
    await assertVisibleTaskRows(mobile.page, ["fixture-task-1", "fixture-task-2"], "mobile cleared desktop filter");
    for (const [status, ids] of [
      ["pending", ["fixture-task-1"]],
      ["in_progress", ["fixture-task-2"]],
      ["completed", []],
      ["cancelled", []],
    ]) {
      await selectTaskStatus(mobile.page, status);
      await assertVisibleTaskRows(mobile.page, ids, `mobile ${status} filter`);
      if (ids.length === 0) {
        const emptyState = mobile.page.locator(".nexus-signal-queue .flex.flex-col.items-center.justify-center");
        await emptyState.waitFor({ state: "visible" });
        assert.ok((await emptyState.innerText()).trim().length > 0, `${status} should show a nonblank empty state`);
      }
    }
    await selectTaskStatus(mobile.page, "all");
    await assertVisibleTaskRows(mobile.page, ["fixture-task-1", "fixture-task-2"], "mobile all status");
    await mobile.page.getByTestId("btn-task-filters").click();
    await mobile.page.getByTestId("task-queue-search").fill("no matching task exists");
    await mobile.page.waitForFunction(() => document.querySelectorAll(".nexus-signal-task-row").length === 0);
    const searchEmptyState = mobile.page.locator(".nexus-signal-queue .flex.flex-col.items-center.justify-center");
    await searchEmptyState.waitFor({ state: "visible" });
    assert.ok((await searchEmptyState.innerText()).trim().length > 0, "a search with no matches should render a nonblank empty state");
    await mobile.page.getByTestId("task-queue-search").fill("");
    await assertVisibleTaskRows(mobile.page, ["fixture-task-1", "fixture-task-2"], "cleared mobile search");
    await mobile.page.getByTestId("btn-task-filters").click();
    await mobile.page.getByTestId("task-item-fixture-task-1").click();
    await mobile.page.getByTestId("task-preview-comment-fixture-comment-1").waitFor();
    await mobile.page.getByTestId("button-open-task-comments").click();
    await mobile.page.getByTestId("input-task-comment").scrollIntoViewIfNeeded();
    assert.ok(await mobile.page.getByTestId("input-task-comment").isVisible(), "mobile comment composer should remain reachable from the task detail");
    await mobile.page.getByTestId("button-close-task-comments").click();
    await mobile.page.waitForTimeout(250);
    await mobile.page.screenshot({ path: path.join(PROOF_DIR, "mobile-390x844.png") });
    const detailBounds = await mobile.page.locator(".nexus-signal-detail").boundingBox();
    measuredBounds.mobileDetail = detailBounds;
    if (!detailBounds || detailBounds.width < 340 || detailBounds.x < 0 || detailBounds.x + detailBounds.width > 390) {
      layoutIssues.push(`mobile selected detail should fit a readable single-column width; got ${JSON.stringify(detailBounds)}`);
    }
    const titleBounds = await mobile.page.locator(".nexus-signal-detail-header h2").boundingBox();
    const actionBounds = await mobile.page.locator(".nexus-signal-actions").boundingBox();
    for (const [label, rect] of [["task title", titleBounds], ["task actions", actionBounds]]) {
      if (!rect || rect.x < 0 || rect.x + rect.width > 390 ||
          (detailBounds && (rect.x < detailBounds.x || rect.x + rect.width > detailBounds.x + detailBounds.width))) {
        layoutIssues.push(`mobile ${label} bounds should remain inside the detail card and viewport; got ${JSON.stringify(rect)}`);
      }
    }
    assert.equal(await mobile.page.locator(".nexus-signal-queue").isVisible(), false, "mobile selected-detail view should hide the queue");
    await mobile.page.getByTestId("task-detail-back-mobile").click();
    await mobile.page.getByTestId("task-item-fixture-task-1").waitFor({ state: "visible" });
    assert.equal(await mobile.page.getByTestId("task-item-fixture-task-1").getAttribute("aria-current"), "true",
      "mobile back should return to the queue with the selected task preserved");
    await mobile.page.getByTestId("btn-task-filters").click();
    assert.equal(await mobile.page.getByTestId("task-queue-search").inputValue(), "",
      "mobile queue should return without a stale search filter");
    await mobile.page.getByTestId("btn-task-filters").click();
    await mobile.page.screenshot({ path: path.join(PROOF_DIR, "mobile-queue-back-390x844.png") });
    await mobile.page.emulateMedia({ reducedMotion: "reduce" });
    const reducedMotion = await mobile.page.locator(".nexus-signal-task-row").first().evaluate(row => getComputedStyle(row).transitionDuration);
    assert.ok(parseFloat(reducedMotion) <= 0.001, `reduced-motion transitions should be effectively disabled, got ${reducedMotion}`);
    await mobile.page.getByTestId("tab-sms").click();
    await mobile.page.getByTestId("sms-item-fixture-sms-1").waitFor({ state: "visible" });
    assert.ok(await mobile.page.getByTestId("sms-item-fixture-sms-1").innerText().then(text => text.includes("SMS branch fixture")));
  } finally {
    await mobile.page.close();
  }

  const dark = await createPage(browser, bundle, 1280, 720, { dark: true });
  try {
    await dark.page.getByTestId("tab-tasks").click();
    await dark.page.getByTestId("task-item-fixture-task-1").waitFor();
    await dark.page.getByTestId("task-item-fixture-task-1").click();
    await dark.page.getByTestId("task-preview-comment-fixture-comment-1").waitFor();
    await dark.page.getByTestId("task-filter-pending").click();
    await dark.page.waitForTimeout(220);
    const darkPendingCount = await dark.page.getByTestId("task-filter-pending").locator("[data-task-count-badge]").evaluate(element => {
      const color = getComputedStyle(element).color;
      const background = getComputedStyle(element).backgroundColor;
      const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const luminance = value => {
        const channels = rgb(value).map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const values = [luminance(color), luminance(background)].sort((a, b) => b - a);
      const rect = element.getBoundingClientRect();
      return { text: element.textContent.trim(), visible: rect.width > 0 && rect.height > 0, ratio: (values[0] + 0.05) / (values[1] + 0.05) };
    });
    assert.ok(darkPendingCount.visible && darkPendingCount.text && darkPendingCount.ratio >= 4.5,
      `dark selected Pending count should remain visible and contrast-safe: ${JSON.stringify(darkPendingCount)}`);
    const readability = await dark.page.locator(".nexus-signal-detail").evaluate(element => {
      const style = getComputedStyle(element);
      return { color: style.color, background: style.backgroundColor };
    });
    assert.notEqual(readability.color, "rgba(0, 0, 0, 0)", "dark detail surface needs an explicit readable text color");
    assert.notEqual(readability.background, "rgba(0, 0, 0, 0)", "dark detail surface needs an explicit surface color");
    await dark.page.waitForTimeout(250);
    await dark.page.screenshot({ path: path.join(PROOF_DIR, "dark-1280x720.png") });
  } finally {
    await dark.page.close();
  }
  assert.deepEqual(layoutIssues, [], "mobile task workspace layout");
  return measuredBounds;
}

(async () => {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  const bundle = await makeBundle();
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM, args: ["--no-sandbox"] });
  try {
    const result = await verifyInitialLoadingAndDesktop(browser, bundle);
    await verifyLinkedEntityCards(browser, bundle);
    await verifyProductionPrimaryContrast(browser, bundle);
    const bounds = await verifyShortMobileAndDark(browser, bundle);
    console.log(`Real staged EmailClientPage Omni Tasks browser verification passed: ${result.taskTitle}; group counts, separate instructions/comments, search/filter and empty state, desktop-to-mobile five-mode status filtering, selected count contrast with custom non-white and production primary-foreground, lucide icon parity, linked customer/clinic/hospital cards, authoritative-null fail-closed, source retry, selection, actions, native-fetch identity, loading, keyboard focus, short/mobile/dark/reduced-motion.`);
    console.log(`Verified bounds: ${JSON.stringify(bounds)}`);
    console.log(`Screenshots: ${["desktop-1280x720", "desktop-1280x600", "mobile-390x844", "mobile-queue-back-390x844", "dark-1280x720"].map(name => path.join(PROOF_DIR, `${name}.png`)).join(", ")}`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});