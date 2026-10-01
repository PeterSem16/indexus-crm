const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { build } = require("esbuild");
const { chromium } = require("@playwright/test");

// This regression intentionally bundles the checked-out application source.
// Unlike test-omni-task-design-browser.cjs it never selects the historical
// staged merge tree, even if OMNI_TASK_SOURCE_ROOT is set in the shell.
const ROOT = process.cwd();
const SOURCE_ROOT = path.resolve(ROOT);
const PROOF_DIR = "/tmp/omni-task-workspace-proof";
const CHROMIUM = process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";

const USER = {
  id: "fixture-user",
  username: "fixture.admin",
  fullName: "Fixture Admin",
  role: "admin",
  countries: ["SK"],
};
const PEOPLE = [
  { id: USER.id, fullName: USER.fullName, username: USER.username, avatarUrl: null },
  { id: "fixture-creator", fullName: "Original Creator", username: "origin.agent", avatarUrl: null },
  { id: "fixture-other", fullName: "Other Agent", username: "other.agent", avatarUrl: null },
];
const SYSTEM_USERS = PEOPLE.map(person => ({ ...person, role: "agent", isActive: true }));

const day = new Date();
const isoDay = (offset = 0) => {
  const value = new Date(day);
  value.setDate(value.getDate() + offset);
  return `${value.toISOString().slice(0, 10)}T12:00:00.000Z`;
};
const task = (id, values = {}) => ({
  id,
  title: `Fixture task ${id}`,
  description: `Fixture description for ${id}`,
  status: "pending",
  priority: "medium",
  assignedUserId: USER.id,
  createdByUserId: USER.id,
  createdAt: isoDay(-1),
  updatedAt: isoDay(-1),
  dueDate: isoDay(1),
  tags: ["fixture_tag"],
  ...values,
});
const FIXTURE_TASKS = [
  task("fixture-task-1", {
    title: "Pulse completion task",
    description: "Pulse source task instructions",
    createdByUserId: "fixture-creator",
    relatedEntityType: "status_list_item",
    tags: ["status_list", "group_id:fixture-ops", "source_keep"],
  }),
  task("fixture-task-2", {
    title: "Ordinary editable task",
    description: "Ordinary task details",
    status: "in_progress",
    priority: "high",
    assignedUserId: "fixture-other",
    tags: ["group_id:fixture-ops", "preserve_me"],
    createdAt: isoDay(-8),
    dueDate: null,
  }),
  task("fixture-task-3", {
    title: "Back Office question task",
    createdByUserId: "fixture-creator",
    tags: ["group_id:fixture-back-office"],
    relatedEntityType: "task",
  }),
  task("fixture-task-4", {
    title: "Completed task",
    status: "completed",
    resolution: "Already resolved",
    resolvedAt: isoDay(-1),
    resolvedByUserId: "fixture-other",
  }),
  task("fixture-task-5", {
    title: "No due date task",
    dueDate: null,
    priority: "low",
    createdAt: isoDay(-2),
  }),
  task("fixture-task-6", {
    title: "Pulse notification opt-out task",
    createdByUserId: "fixture-creator",
    relatedEntityType: "status_list_item",
    tags: ["status_list", "group_id:fixture-ops"],
  }),
  ...Array.from({ length: 23 }, (_, index) => task(`fixture-task-page-${String(index + 1).padStart(2, "0")}`, {
    title: `Pagination fixture ${String(index + 1).padStart(2, "0")}`,
    createdAt: isoDay(-index - 1),
    dueDate: index % 4 === 0 ? null : isoDay(index % 7),
    priority: ["low", "medium", "high", "urgent"][index % 4],
    status: index % 9 === 0 ? "completed" : "pending",
    resolvedAt: index % 9 === 0 ? isoDay(-index) : null,
    resolvedByUserId: index % 9 === 0 ? "fixture-other" : null,
    assignedUserId: index % 2 ? USER.id : "fixture-other",
    createdByUserId: index % 3 ? USER.id : "fixture-creator",
  })),
];

const FIXTURE_GROUPS = [
  {
    id: "fixture-ops",
    name: "Operations",
    displayAlias: "Ops",
    description: "Operations group",
    color: "#3878bd",
    isBackOffice: false,
    members: [
      { userId: USER.id, fullName: USER.fullName },
      { userId: "fixture-other", fullName: "Other Agent" },
      // Deliberately not in /api/tasks/people: editing must preserve this
      // historical inactive membership rather than silently deleting it.
      { userId: "fixture-inactive", fullName: "Inactive Historical Member" },
    ],
  },
  {
    id: "fixture-back-office",
    name: "Back Office",
    displayAlias: "Back Office",
    description: "",
    color: "#a92332",
    isBackOffice: true,
    members: [{ userId: USER.id, fullName: USER.fullName }],
  },
];
const FIXTURE_EMAILS = Array.from({ length: 30 }, (_, index) => ({
  id: `fixture-email-${String(index + 1).padStart(2, "0")}`,
  subject: `Pagination email ${String(index + 1).padStart(2, "0")}`,
  receivedDateTime: isoDay(-index),
  isRead: true,
  from: {
    emailAddress: {
      name: `Fixture Sender ${String(index + 1).padStart(2, "0")}`,
      address: `sender${index + 1}@example.test`,
    },
  },
  bodyPreview: `Fixture email preview ${index + 1}`,
}));
const FIXTURE_SMS = Array.from({ length: 30 }, (_, index) => ({
  id: `fixture-sms-${String(index + 1).padStart(2, "0")}`,
  direction: "inbound",
  sentAt: isoDay(-index),
  createdAt: isoDay(-index),
  content: `Pagination SMS ${String(index + 1).padStart(2, "0")}`,
  senderPhone: `+421900000${String(index + 1).padStart(2, "0")}`,
  recipientPhone: "+421900000000",
  deliveryStatus: "read",
  customer: {
    id: `fixture-customer-${index + 1}`,
    firstName: `Fixture`,
    lastName: `Customer ${String(index + 1).padStart(2, "0")}`,
  },
}));

function bundleSource() {
  const pageEntry = path.join(SOURCE_ROOT, "client/src/pages/email-client.tsx");
  const i18nEntry = path.join(SOURCE_ROOT, "client/src/i18n/I18nProvider.tsx");
  const queryClientEntry = path.join(SOURCE_ROOT, "client/src/lib/queryClient.ts");
  const tooltipEntry = path.join(SOURCE_ROOT, "client/src/components/ui/tooltip.tsx");
  const questionsInboxEntry = path.join(SOURCE_ROOT, "client/src/components/back-office-questions-inbox.tsx");
  const notificationHookEntry = path.join(SOURCE_ROOT, "client/src/hooks/use-notifications.ts");
  const quickCreateEntry = path.join(SOURCE_ROOT, "client/src/components/quick-create.tsx");
  const tasksPageEntry = path.join(SOURCE_ROOT, "client/src/pages/tasks.tsx");
  const countryProviderEntry = path.join(SOURCE_ROOT, "client/src/contexts/country-filter-context.tsx");
  const agentTaskCreateEntry = path.join(SOURCE_ROOT, "client/src/lib/agent-workspace-task-create.ts");
  return `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { QueryClientProvider } from "@tanstack/react-query";
    import { TooltipProvider } from ${JSON.stringify(tooltipEntry)};
    import { queryClient } from ${JSON.stringify(queryClientEntry)};
    import EmailClientPage from ${JSON.stringify(pageEntry)};
    import { BackOfficeQuestionsInbox } from ${JSON.stringify(questionsInboxEntry)};
    import { useNotifications } from ${JSON.stringify(notificationHookEntry)};
    import { I18nProvider } from ${JSON.stringify(i18nEntry)};
    import { QuickCreate } from ${JSON.stringify(quickCreateEntry)};
    import TasksPage from ${JSON.stringify(tasksPageEntry)};
    import { CountryFilterProvider } from ${JSON.stringify(countryProviderEntry)};
    import { createAgentWorkspaceTask } from ${JSON.stringify(agentTaskCreateEntry)};
    window.__testQueryClient = queryClient;
    function ManualPulseTaskCreateHarness() {
      const [creationNumber, setCreationNumber] = React.useState(0);
      const create = async () => {
        await createAgentWorkspaceTask({
          title: "Manual Nexus Pulse task " + (creationNumber + 1),
          description: "Created for a Mission-linked clinic.",
          priority: "medium",
          relatedEntityType: "clinic",
          relatedEntityId: "fixture-clinic",
          attachments: [],
        }, "fixture-user", { missionId: "fixture-mission", sessionId: "fixture-agent-session" });
        await queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        setCreationNumber(number => number + 1);
      };
      return <><button data-testid="button-create-manual-pulse-task" onClick={() => void create()}>Create manual Pulse task</button><EmailClientPage /></>;
    }
    function NotificationSocketHarness() {
      const { isConnected } = useNotifications();
      React.useEffect(() => { window.__notificationsSocketConnected = isConnected; }, [isConnected]);
      return null;
    }
    const content = window.location.pathname === "/__test-manual-pulse-create"
      ? <ManualPulseTaskCreateHarness />
      : window.location.pathname === "/__test-inbox"
      ? <><BackOfficeQuestionsInbox /><NotificationSocketHarness /></>
      : window.location.pathname === "/__test-create"
      ? <QuickCreate />
      : window.location.pathname === "/__test-tasks"
      ? <CountryFilterProvider><TasksPage /></CountryFilterProvider>
      : <><div style={{ height: 56, flex: "none" }} aria-hidden="true"></div><EmailClientPage /></>;
    createRoot(document.getElementById("root")).render(
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <I18nProvider userCountries={["SK"]}>
            {content}
          </I18nProvider>
        </QueryClientProvider>
      </TooltipProvider>
    );
  `;
}

async function makeBundle() {
  const required = [
    "client/src/pages/email-client.tsx",
    "client/src/components/tasks/task-groups-dialog.tsx",
    "client/src/components/tasks/task-queue-controls.tsx",
    "client/src/components/back-office-questions-inbox.tsx",
    "client/src/components/nexus/nexus-signal-tasks.css",
  ];
  for (const file of required) {
    assert.ok(fs.existsSync(path.join(SOURCE_ROOT, file)),
      `Required actual-root source is not ready: ${path.join(SOURCE_ROOT, file)}`);
  }
  assert.equal(SOURCE_ROOT, ROOT, "The browser harness must bundle the current checkout, not a staged source root");

  const result = await build({
    stdin: { contents: bundleSource(), resolveDir: ROOT, loader: "tsx" },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    logLevel: "error",
    jsx: "automatic",
    target: ["es2020"],
    outdir: path.join(ROOT, ".cache/omni-task-workspace-browser"),
    alias: { "@": path.join(SOURCE_ROOT, "client/src"), "@shared": path.join(SOURCE_ROOT, "shared") },
    plugins: [{
      name: "fixture-auth-context",
      setup(buildApi) {
        buildApi.onResolve({ filter: /contexts\/chat-context/ }, () => ({
          path: "fixture-chat-context", namespace: "omni-chat-fixture",
        }));
        buildApi.onLoad({ filter: /.*/, namespace: "omni-chat-fixture" }, () => ({
          loader: "js",
          contents: "export function useChatContext() { return { onlineUsers: [], openChat() {}, isConnected: false }; }",
        }));
        buildApi.onResolve({ filter: /contexts\/auth-context/ }, () => ({
          path: "fixture-auth-context",
          namespace: "omni-task-workspace-fixture",
        }));
        buildApi.onLoad({ filter: /.*/, namespace: "omni-task-workspace-fixture" }, () => ({
          loader: "js",
          contents: "export function useAuth() { return { user: window.__fixtureUser, isLoading: false }; }",
        }));
      },
    }],
  });
  const javascript = result.outputFiles.find(file => file.path.endsWith(".js"));
  const componentCss = result.outputFiles.find(file => file.path.endsWith(".css"));
  assert.ok(javascript, "esbuild did not emit the actual EmailClientPage bundle");
  assert.ok(componentCss, "esbuild did not emit the actual task component CSS");

  const cssRoots = [
    path.join(SOURCE_ROOT, "dist/public/assets"),
    path.join(ROOT, "dist/public/assets"),
  ];
  const distRoot = cssRoots.find(root => fs.existsSync(root) &&
    fs.readdirSync(root).some(file => /^index.*\.css$/.test(file)));
  assert.ok(distRoot, "Built theme CSS is unavailable; a built application CSS asset is required for visual checks");
  const themeCss = fs.readdirSync(distRoot)
    .filter(file => /^index.*\.css$/.test(file))
    .map(file => fs.readFileSync(path.join(distRoot, file), "utf8"))
    .join("\n");
  return { javascript: javascript.text, styles: `${themeCss}\n${componentCss.text}` };
}

function makeHtml(bundle, dark = false, user = USER) {
  return `<!doctype html><html${dark ? ' class="dark"' : ""}><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.styles}</style></head>
    <body style="margin:0"><div id="root"></div><script>
      window.__fixtureUser=${JSON.stringify(user)};
      window.__nativeFetchReference=window.fetch;
      window.__completionEvents=[];
      window.addEventListener("indexus:bo-resolved", event => window.__completionEvents.push(event.detail));
    </script><script>${bundle.javascript}</script></body></html>`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function jsonResponse(route, data, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
}

function makeApiRouter(requests, options = {}) {
  const state = {
    tasks: clone(options.tasks || FIXTURE_TASKS),
    comments: clone(options.comments || []),
    checklist: clone(options.checklist || (options.aiChecklist ? {} : Object.fromEntries(
      ["fixture-task-1", "fixture-task-6"].map(taskId => [taskId, [{
        id: `${taskId}-completed-step`, taskId, label: "Verified the approved change",
        required: false, doneAt: isoDay(0), doneByUserId: USER.id, note: null, position: 0,
      }]])))),
    aiChecklistStatus: clone(options.aiChecklistStatus || {}),
    aiChecklistFailures: options.failAiChecklist ? 1 : 0,
    aiChecklistCalls: 0,
    uploadCount: 0,
    groups: clone(FIXTURE_GROUPS),
    notifications: clone(options.notifications || []),
    failTaskPatchIds: new Set(),
    failGroupMutation: false,
    taskPageHold: null,
    releaseTaskPage: null,
    uploadHold: null,
    releaseUploads: null,
    commentHold: null,
    releaseComments: null,
    cancelHold: null,
    releaseCancel: null,
    resolutionDraftHold: null,
    releaseDraft: null,
    resolutionDraftFailures: options.resolutionDraftFailures || 0,
    agentSession: options.agentSession || {
      id: "fixture-agent-session",
      userId: USER.id,
      campaignId: "fixture-mission",
      campaignIds: ["fixture-mission"],
      endedAt: null,
    },
    authorizedMissionIds: options.authorizedMissionIds || ["fixture-mission"],
    manualPulseCreatedCount: 0,
  };
  if (options.holdTaskPage) {
    state.taskPageHold = new Promise(resolve => { state.releaseTaskPage = resolve; });
  }
  if (options.holdAttachmentUploads) {
    state.uploadHold = new Promise(resolve => { state.releaseUploads = resolve; });
  }
  if (options.holdCommentPosts) {
    state.commentHold = new Promise(resolve => { state.releaseComments = resolve; });
  }
  if (options.holdTaskCancel) {
    state.cancelHold = new Promise(resolve => { state.releaseCancel = resolve; });
  }
  if (options.holdResolutionDrafts) {
    state.resolutionDraftHold = new Promise(resolve => { state.releaseDraft = resolve; });
  }
  const completionChecklistProblem = existing => {
    if (existing.status === "cancelled") return { code: "task_inactive" };
    if (existing.relatedEntityType !== "status_list_item" && !existing.tags?.includes("status_list")) return null;
    const items = state.checklist[existing.id] || [];
    if (!items.length) return { code: "task_checklist_required", remainingCount: 0 };
    const remainingCount = items.filter(item => !item.doneAt).length;
    return remainingCount ? { code: "task_checklist_incomplete", remainingCount } : null;
  };
  const router = async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/")) {
      return route.fulfill({ status: 200, contentType: "text/html", body: options.html });
    }
    const body = request.headers()["content-type"]?.includes("multipart/form-data")
      ? null
      : request.postDataJSON?.() ?? null;
    requests.push({ method: request.method(), path: url.pathname, search: url.search, body: clone(body) });
    const method = request.method();

    const draftMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/resolution-draft$/);
    if (draftMatch && method === "POST") {
      const existing = state.tasks.find(item => item.id === draftMatch[1]);
      if (!existing) return jsonResponse(route, { error: "Task not found" }, 404);
      const problem = completionChecklistProblem(existing);
      if (problem) return jsonResponse(route, { status: "failed", errorCode: problem.code, ...problem }, 409);
      if (state.resolutionDraftHold) await state.resolutionDraftHold;
      if (state.resolutionDraftFailures > 0) {
        state.resolutionDraftFailures--;
        return jsonResponse(route, { status: "failed", errorCode: "provider_error" });
      }
      return jsonResponse(route, options.resolutionDraft
        ? { status: "generated", draft: options.resolutionDraft }
        : { status: "unavailable", errorCode: "api_key_missing" });
    }

    const aiChecklistMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/checklist\/ai$/);
    if (aiChecklistMatch) {
      const taskId = aiChecklistMatch[1];
      const enabled = options.aiChecklist && taskId === "fixture-task-1";
      const status = state.aiChecklistStatus[taskId] || (enabled ? "idle" : "preserved");
      if (method === "POST") {
        state.aiChecklistCalls++;
        if ((state.checklist[taskId] || []).length) {
          state.aiChecklistStatus[taskId] = "preserved";
          return jsonResponse(route, { status: "preserved" });
        }
        if (state.aiChecklistFailures > 0) {
          state.aiChecklistFailures--;
          state.aiChecklistStatus[taskId] = "failed";
          return jsonResponse(route, { status: "generating" }, 202);
        }
        state.aiChecklistStatus[taskId] = "generated";
        state.checklist[taskId] = [
          { id: "ai-step-1", label: "Zavolať klientovi a overiť chýbajúce údaje", required: false, position: 0, doneAt: null },
          { id: "ai-step-2", label: "Overiť verejné údaje kliniky", required: false, position: 1, doneAt: null },
          { id: "ai-step-3", label: "Konzultovať nezrovnalosti s obchodným oddelením", required: false, position: 2, doneAt: null },
        ];
        return jsonResponse(route, { status: "generating" }, 202);
      }
      return jsonResponse(route, { status });
    }
    const checklistMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/checklist$/);
    if (checklistMatch) {
      const taskId = checklistMatch[1];
      if (method === "GET") return jsonResponse(route, state.checklist[taskId] || []);
      if (method === "POST") {
        const item = { ...body, id: `manual-step-${Date.now()}`, doneAt: null };
        (state.checklist[taskId] ||= []).push(item);
        return jsonResponse(route, item, 201);
      }
    }
    const checklistItemMatch = url.pathname.match(/^\/api\/task-checklist\/([^/]+)$/);
    if (checklistItemMatch) {
      for (const [taskId, items] of Object.entries(state.checklist)) {
        const item = items.find(candidate => candidate.id === checklistItemMatch[1]);
        if (!item) continue;
        if (method === "DELETE") {
          state.checklist[taskId] = items.filter(candidate => candidate.id !== item.id);
          return jsonResponse(route, { success: true });
        }
        if (method === "PATCH") {
          Object.assign(item, body);
          if (typeof body.done === "boolean") item.doneAt = body.done ? new Date().toISOString() : null;
          return jsonResponse(route, item);
        }
      }
      return jsonResponse(route, { error: "Item not found" }, 404);
    }

    if (/^\/api\/tasks\/attachments\/[^/]+$/.test(url.pathname) && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSioAAAAASUVORK5CYII=", "base64"),
      });
    }
    if (url.pathname === "/api/tasks/attachments" && method === "POST") {
      if (state.uploadHold) await state.uploadHold;
      if (options.failAttachmentUploads) return jsonResponse(route, { error: "Upload failed" }, 503);
      const multipart = request.postDataBuffer().toString("utf8");
      const name = multipart.match(/filename="([^"]+)"/)?.[1] || "document.pdf";
      const type = multipart.match(/Content-Type:\s*([^\r\n]+)/i)?.[1] || "application/pdf";
      const id = `fixture-upload-${++state.uploadCount}`;
      return jsonResponse(route, { id, name, type, size: 24, url: `/api/tasks/attachments/${id}` }, 201);
    }

    if (url.pathname === "/api/tasks" && method === "GET") {
      if (state.taskPageHold) await state.taskPageHold;
      return jsonResponse(route, state.tasks);
    }
    if (url.pathname === "/api/tasks" && method === "POST") {
      const pulseOrigin = body?.pulseOrigin;
      const session = state.agentSession;
      const validatedManualPulse = !!pulseOrigin
        && pulseOrigin.sessionId === session?.id
        && session?.userId === USER.id
        && !session?.endedAt
        && [session?.campaignId, ...(session?.campaignIds || [])].includes(pulseOrigin.missionId)
        && state.authorizedMissionIds.includes(pulseOrigin.missionId);
      if (pulseOrigin && !validatedManualPulse) {
        return jsonResponse(route, { error: "Manual Nexus Pulse task provenance requires an active authorized Mission session" }, 403);
      }
      const { pulseOrigin: _ignoredOrigin, createdByUserId: _ignoredCreator, ...submittedTask } = body || {};
      const submittedTags = Array.isArray(submittedTask.tags)
        ? submittedTask.tags.filter(tag => tag !== "status_list" && tag !== "nexus_pulse_manual")
        : [];
      const createdTags = validatedManualPulse ? [...submittedTags, "nexus_pulse_manual"] : submittedTags;
      const created = task(
        validatedManualPulse
          ? `fixture-manual-pulse-task-${++state.manualPulseCreatedCount}`
          : `fixture-created-${state.tasks.length + 1}`,
        { ...submittedTask, createdByUserId: USER.id, tags: createdTags },
      );
      state.tasks.push(created);
      return jsonResponse(route, created, 201);
    }
    if (url.pathname === "/api/tasks/people" && method === "GET") return jsonResponse(route, PEOPLE);
    if (url.pathname === "/api/task-groups" && method === "GET") return jsonResponse(route, state.groups);
    if (url.pathname === "/api/task-groups" && method === "POST") {
      if (state.failGroupMutation) {
        state.failGroupMutation = false;
        return jsonResponse(route, { error: "Fixture group mutation failed" }, 503);
      }
      const created = {
        ...body,
        id: "fixture-created-group",
        members: (body.memberUserIds || []).map(userId => ({ userId })),
      };
      state.groups.push(created);
      return jsonResponse(route, created, 201);
    }
    const groupMatch = url.pathname.match(/^\/api\/task-groups\/([^/]+)$/);
    if (groupMatch && (method === "PATCH" || method === "PUT")) {
      if (state.failGroupMutation) {
        state.failGroupMutation = false;
        return jsonResponse(route, { error: "Fixture group mutation failed" }, 503);
      }
      const group = state.groups.find(item => item.id === groupMatch[1]);
      if (!group) return jsonResponse(route, { error: "Group not found" }, 404);
      Object.assign(group, body || {});
      if (body?.memberUserIds) {
        group.members = [...new Set(body.memberUserIds)].map(userId => ({
          userId,
          fullName: PEOPLE.find(person => person.id === userId)?.fullName
            || group.members.find(member => member.userId === userId)?.fullName
            || userId,
        }));
      }
      return jsonResponse(route, group);
    }
    if (groupMatch && method === "DELETE") {
      if (state.failGroupMutation) {
        state.failGroupMutation = false;
        return jsonResponse(route, { error: "Fixture group mutation failed" }, 503);
      }
      state.groups = state.groups.filter(item => item.id !== groupMatch[1]);
      return jsonResponse(route, { success: true });
    }
    if (url.pathname === "/api/task-groups-reorder" && method === "PUT") {
      requests.globalGroupOrder = body?.order || [];
      return jsonResponse(route, { success: true });
    }
    if (url.pathname === "/api/task-groups-reorder-role" && method === "PUT") {
      requests.roleGroupOrders ||= [];
      requests.roleGroupOrders.push(body || {});
      return jsonResponse(route, { success: true });
    }
    if (/^\/api\/task-groups-reorder-role\/[^/]+$/.test(url.pathname) && method === "DELETE") {
      return jsonResponse(route, { success: true });
    }

    const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch && method === "PATCH") {
      if (body?.status === "cancelled" && state.cancelHold) await state.cancelHold;
      if (state.failTaskPatchIds.has(taskMatch[1])) {
        state.failTaskPatchIds.delete(taskMatch[1]);
        return jsonResponse(route, { error: "Fixture task update failed" }, 503);
      }
      const existing = state.tasks.find(item => item.id === taskMatch[1]);
      if (!existing) return jsonResponse(route, { error: "Task not found" }, 404);
      const problem = body?.status === "completed" && existing.status !== "completed"
        ? completionChecklistProblem(existing) : null;
      if (problem) return jsonResponse(route, { error: "Task completion is blocked", ...problem }, 409);
      const previousStatus = existing.status;
      Object.assign(existing, body || {});
      if (body?.status && body.status !== previousStatus) {
        if (["completed", "cancelled"].includes(previousStatus) && !["completed", "cancelled"].includes(body.status)) {
          existing.workStartedAt = null;
          existing.workStoppedAt = null;
        }
        if (body.status === "in_progress" && !existing.workStartedAt) {
          existing.workStartedAt = new Date().toISOString();
          existing.workStoppedAt = null;
        }
        if (["completed", "cancelled"].includes(body.status) && existing.workStartedAt) {
          existing.workStoppedAt ||= new Date().toISOString();
        }
      }
      if (body?.status === "completed" && !existing.resolvedAt) {
        existing.resolvedAt = new Date().toISOString();
        existing.resolvedByUserId = USER.id;
      }
      const hasVerifiedPulseSource = existing.relatedEntityType === "status_list_item"
        || existing.tags?.includes("status_list")
        || existing.tags?.includes("nexus_pulse_manual");
      if (body?.status === "completed" && previousStatus !== "completed" &&
        (body.notifyAgent === true ? !!existing.createdByUserId : body.notifyAgent !== false && hasVerifiedPulseSource)) {
        state.notifications.push({
          id: `fixture-notification-${state.notifications.length + 1}`,
          userId: existing.createdByUserId,
          type: "back_office_resolved",
          title: existing.title,
          entityType: "task",
          entityId: existing.id,
          metadata: {
            source: "nexus_pulse",
            taskId: existing.id,
            taskTitle: existing.title,
            resolution: existing.resolution,
          },
          isRead: false,
          isDismissed: false,
          createdAt: new Date().toISOString(),
        });
      }
      existing.updatedAt = new Date().toISOString();
      return jsonResponse(route, existing);
    }
    const resolveMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/resolve$/);
    if (resolveMatch && method === "POST") {
      const existing = state.tasks.find(item => item.id === resolveMatch[1]);
      if (!existing) return jsonResponse(route, { error: "Task not found" }, 404);
      const problem = existing.status !== "completed" ? completionChecklistProblem(existing) : null;
      if (problem) return jsonResponse(route, { error: "Task completion is blocked", ...problem }, 409);
      Object.assign(existing, {
        status: "completed",
        resolution: body?.resolution || null,
        resolvedAt: new Date().toISOString(),
        resolvedByUserId: USER.id,
        workStoppedAt: existing.workStartedAt ? (existing.workStoppedAt || new Date().toISOString()) : null,
      });
      // Model the server's recipient derivation from the task's original
      // creator, independently of the request body. The UI must not supply
      // (or override) a recipient.
      const hasVerifiedPulseSource = existing.relatedEntityType === "status_list_item"
        || existing.tags?.includes("status_list")
        || existing.tags?.includes("nexus_pulse_manual");
      if (body?.notifyAgent === true ? !!existing.createdByUserId : body?.notifyAgent !== false && hasVerifiedPulseSource) {
        state.notifications.push({
          id: `fixture-notification-${state.notifications.length + 1}`,
          userId: existing.createdByUserId,
          type: "back_office_resolved",
          title: existing.title,
          entityType: "task",
          entityId: existing.id,
          metadata: {
            source: "nexus_pulse",
            taskId: existing.id,
            taskTitle: existing.title,
            resolution: existing.resolution,
          },
          isRead: false,
          isDismissed: false,
          createdAt: new Date().toISOString(),
        });
      }
      return jsonResponse(route, existing);
    }
    const commentMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/comments$/);
    if (commentMatch && method === "POST") {
      if (state.commentHold) await state.commentHold;
      const comment = {
        id: `fixture-new-comment-${state.comments.length + 1}`,
        taskId: commentMatch[1],
        userId: USER.id,
        content: body.content,
        metadata: { attachments: body.attachments || [] },
        createdAt: new Date().toISOString(),
      };
      state.comments.push(comment);
      return jsonResponse(route, comment, 201);
    }
    if (commentMatch && method === "GET") {
      return jsonResponse(route, [...(options.emptyComments ? [] : [{
        id: "fixture-comment-1",
        taskId: commentMatch[1],
        userId: "fixture-other",
        content: "Existing task thread comment",
        createdAt: isoDay(-1),
      }]), ...state.comments.filter(comment => comment.taskId === commentMatch[1])]);
    }

    if (url.pathname === "/api/notifications/unread-count") {
      const activeUserId = options.user?.id || USER.id;
      return jsonResponse(route, {
        count: state.notifications.filter(item =>
          item.userId === activeUserId && !item.isRead && !item.isDismissed).length,
      });
    }
    if (url.pathname === "/api/notifications") {
      const includeRead = url.searchParams.get("includeRead") !== "false";
      const activeUserId = options.user?.id || USER.id;
      const rows = state.notifications.filter(item =>
        item.userId === activeUserId && (includeRead || !item.isRead) && !item.isDismissed);
      return jsonResponse(route, rows);
    }
    const notificationAction = url.pathname.match(/^\/api\/notifications\/([^/]+)\/(read|dismiss)$/);
    if (notificationAction && method === "PATCH") {
      const notification = state.notifications.find(item => item.id === notificationAction[1]);
      if (notification) {
        if (notificationAction[2] === "read") notification.isRead = true;
        else notification.isDismissed = true;
      }
      return jsonResponse(route, notification || { success: true });
    }

    if (url.pathname === "/api/agent/bo-questions" && method === "GET") {
      return jsonResponse(route, options.boQuestions || []);
    }
    if (url.pathname === "/api/users") return jsonResponse(route, SYSTEM_USERS);
    if (url.pathname === `/api/users/${USER.id}/ms365-available-mailboxes`) {
      return jsonResponse(route, [{ email: "fixture@example.test", type: "personal", displayName: "Fixture mailbox" }]);
    }
    if (url.pathname === `/api/users/${USER.id}/ms365-folders`) {
      return jsonResponse(route, {
        connected: true,
        folders: [{ id: "fixture-folder", displayName: "Inbox", isInbox: true }],
        inboxId: "fixture-folder",
      });
    }
    const folderMessagesMatch = url.pathname.match(/^\/api\/users\/[^/]+\/ms365-folder-messages\/fixture-folder$/);
    if (folderMessagesMatch) {
      const skip = Number(url.searchParams.get("skip") || 0);
      const top = Number(url.searchParams.get("top") || FIXTURE_EMAILS.length);
      return jsonResponse(route, {
        connected: true,
        emails: FIXTURE_EMAILS.slice(skip, skip + top),
        totalCount: FIXTURE_EMAILS.length,
      });
    }
    if (url.pathname === "/api/departments") return jsonResponse(route, [{ id: "fixture-dept", name: "Operations" }]);
    if (url.pathname === "/api/customers/lookup") return jsonResponse(route, []);
    if (url.pathname === "/api/sms-messages") return jsonResponse(route, FIXTURE_SMS);
    if (url.pathname === "/api/chats") return jsonResponse(route, []);
    if (url.pathname === "/api/clinics/lookup" || url.pathname === "/api/task-tags") return jsonResponse(route, []);
    if (/^\/api\/tasks\/[^/]+\/source-entity$/.test(url.pathname)) return jsonResponse(route, null);
    const deleteCommentMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/comments\/([^/]+)$/);
    if (deleteCommentMatch && method === "DELETE") {
      state.comments = state.comments.filter(comment =>
        comment.taskId !== deleteCommentMatch[1] || comment.id !== deleteCommentMatch[2]);
      return jsonResponse(route, { success: true });
    }
    if (url.pathname === "/api/customers/fixture-customer") return jsonResponse(route, { id: "fixture-customer", firstName: "Casey", lastName: "Patient" });
    if (url.pathname.startsWith("/api/")) return jsonResponse(route, []);
    return route.continue();
  };
  return { router, state };
}

async function createPage(browser, bundle, width = 1280, height = 800, options = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.setDefaultTimeout(8000);
  const requests = [];
  const apiResponses = [];
  const webSockets = [];
  const api = makeApiRouter(requests, { ...options, html: makeHtml(bundle, options.dark, options.user || USER) });
  page.on("pageerror", error => { (page.__browserErrors ||= []).push(error.message); });
  page.on("response", response => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith("/api/")) return;
    apiResponses.push({ method: response.request().method(), path: url.pathname, status: response.status() });
    if (apiResponses.length > 50) apiResponses.shift();
  });
  await page.route("http://omni-task-workspace.test/**", api.router);
  if (options.websocket) {
    await page.routeWebSocket("**/ws/notifications*", socket => {
      webSockets.push(socket);
      socket.onMessage(() => {});
      socket.send(JSON.stringify({ type: "connected" }));
    });
  }
  const search = options.search ?? "?tab=tasks";
  const entryPath = options.manualPulseCreate ? "/__test-manual-pulse-create" :
    options.standaloneInbox ? "/__test-inbox" :
    options.standaloneCreate ? "/__test-create" : options.standaloneTasks ? "/__test-tasks" : "/email";
  await page.goto(`http://omni-task-workspace.test${entryPath}${options.standaloneInbox ? "" : search}`, { waitUntil: "domcontentloaded" });
  const mounted = options.manualPulseCreate
    ? page.getByTestId("button-create-manual-pulse-task")
    : options.standaloneInbox
    ? page.getByTestId("bo-questions-inbox")
    : options.standaloneCreate ? page.getByTestId("button-quick-create")
    : options.standaloneTasks ? page.locator('[data-testid^="task-card-"]').first()
    : page.getByTestId("tab-tasks");
  await mounted.waitFor({ timeout: 12000 }).catch(async error => {
    console.error("Actual-root Omni Tasks failed to mount", {
      sourceRoot: SOURCE_ROOT,
      errors: page.__browserErrors,
      requests,
      body: await page.locator("body").innerText().catch(() => ""),
    });
    throw error;
  });
  return { page, requests, apiResponses, state: api.state, releaseTaskPage: api.state.releaseTaskPage, webSockets };
}

function taskIds(page) {
  return page.locator(".nexus-signal-task-row").evaluateAll(rows =>
    rows.map(row => row.getAttribute("data-testid")?.replace("task-item-", "")));
}

function optionIndexFor(triggerTestId, value) {
  const orderedValues = {
    "task-date-filter": ["all", "today", "week", "month", "custom"],
    "task-date-basis": ["created", "due", "resolved"],
    "task-sort-field": ["created", "due", "resolved", "priority", "title"],
    "task-creator-filter": ["any", ...PEOPLE.map(person => person.id)],
    "task-resolver-filter": ["any", ...PEOPLE.map(person => person.id)],
    "edit-priority": ["low", "medium", "high", "urgent"],
    "edit-status": ["pending", "in_progress", "completed", "cancelled"],
    "edit-task-assignee": ["unassigned", ...PEOPLE.map(person => person.id)],
    "edit-task-group": ["no-group", ...FIXTURE_GROUPS.map(group => group.id)],
  };
  const values = orderedValues[triggerTestId];
  if (values) return values.indexOf(value);
  return null;
}

async function visibleOptionFor(page, triggerTestId, value) {
  const valueOption = page.locator(`[role="option"][data-value="${value}"]`);
  if (await valueOption.count()) {
    await valueOption.waitFor({ state: "visible" });
    return valueOption;
  }
  const index = optionIndexFor(triggerTestId, value);
  const options = page.locator('[role="option"]');
  const count = await options.count();
  if (index === null || index < 0 || index >= count) {
    throw new Error(`No visible option maps to value ${value} for ${triggerTestId}; found ${count} options`);
  }
  return options.nth(index);
}

async function chooseOption(page, triggerTestId, value) {
  if (triggerTestId.startsWith("task-") && await page.getByTestId("btn-task-filters").getAttribute("aria-expanded") !== "true") {
    await page.getByTestId("btn-task-filters").click();
  }
  await page.getByTestId(triggerTestId).click();
  const option = await visibleOptionFor(page, triggerTestId, value);
  try {
    await option.waitFor({ state: "visible", timeout: 5000 });
  } catch (error) {
    console.error("Select option did not appear", {
      triggerTestId,
      value,
      visibleOptions: await page.locator('[role="option"]').evaluateAll(items => items.map(item => ({
        text: item.textContent?.trim(),
        value: item.getAttribute("data-value"),
        role: item.getAttribute("role"),
      }))),
      triggerHtml: await page.getByTestId(triggerTestId).evaluate(element => element.outerHTML).catch(() => null),
    });
    throw error;
  }
  await option.click();
}

async function chooseEditSelect(page, index, value) {
  const editDialog = page.locator('[role="dialog"]:has([data-testid="edit-task-title"])');
  const trigger = editDialog.locator('[role="combobox"]').nth(index);
  await trigger.click();
  const triggerTestId = index === 0 ? "edit-priority" : "edit-status";
  const option = await visibleOptionFor(page, triggerTestId, value);
  try {
    await option.waitFor({ state: "visible", timeout: 5000 });
  } catch (error) {
    console.error("Task edit select option did not appear", {
      index,
      value,
      editDialogCount: await editDialog.count(),
      triggers: await editDialog.locator('[role="combobox"]').evaluateAll(items => items.map(item => ({
        text: item.textContent?.trim(),
        testId: item.getAttribute("data-testid"),
        expanded: item.getAttribute("aria-expanded"),
      }))),
      visibleOptions: await page.locator('[role="option"]').evaluateAll(items => items.map(item => ({
        text: item.textContent?.trim(),
        value: item.getAttribute("data-value"),
      }))),
    });
    throw error;
  }
  await option.click();
}

async function assertNoBrowserErrors(page, context) {
  assert.deepEqual(page.__browserErrors || [], [], `${context} should not raise browser errors`);
  assert.equal(
    await page.evaluate(() => window.fetch === window.__nativeFetchReference),
    true,
    `${context} must preserve the browser's native fetch binding`,
  );
}

async function verifyWorkspaceEntryAndQueue(browser, bundle) {
  const { page, requests, state } = await createPage(browser, bundle);
  try {
    await page.getByTestId("task-item-fixture-task-1").waitFor();
    await page.getByTestId("task-subtab-all").click();
    const workspaceUrlBeforeSettings = page.url();
    assert.equal(await page.locator(".nexus-signal-task-row").count(), 25,
      "the first queue page should contain the page-size slice of real task rows");

    await page.getByTestId("btn-task-groups-nexus").click();
    const groupDialog = page.getByTestId("dialog-task-groups");
    await groupDialog.waitFor({ state: "visible" });
    assert.equal(page.url(), workspaceUrlBeforeSettings,
      "opening task group settings must leave the current email/tasks URL unchanged");
    await page.screenshot({ path: path.join(PROOF_DIR, "group-workspace-dialog-desktop.png") });
    await assertNoBrowserErrors(page, "task-group workspace entry");
    return {
      page,
      requests,
      state,
      groupDialog,
    };
  } catch (error) {
    await page.close();
    throw error;
  }
}

async function verifyTaskAttachmentCreation(browser, bundle) {
  const { page, requests } = await createPage(browser, bundle, 1280, 800, { standaloneCreate: true });
  try {
    await page.getByTestId("button-quick-create").click();
    await page.getByTestId("menu-item-quick-task").click();
    const dialog = page.getByRole("dialog").last();
    await page.getByTestId("input-quick-task-title").fill("Created task with file");
    await dialog.getByTestId("input-task-attachment-files").setInputFiles({
      name: "Žiadosť.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4"),
    });
    await dialog.getByTestId("chip-task-attachment-0").waitFor();
    await dialog.locator('button[type="submit"]').click();
    await dialog.waitFor({ state: "hidden" });
    const creation = requests.find(request => request.path === "/api/tasks" && request.method === "POST");
    assert.equal(creation.body.title, "Created task with file");
    assert.equal(creation.body.attachments[0].id, "fixture-upload-1");
    await page.getByTestId("button-quick-create").click();
    await page.getByTestId("menu-item-quick-task").click();
    assert.equal(await page.getByTestId("chip-task-attachment-0").count(), 0);
    await assertNoBrowserErrors(page, "QuickCreate task attachment");
  } finally { await page.close(); }
}

async function verifyTasksPageAttachments(browser, bundle) {
  const { page, requests } = await createPage(browser, bundle, 1280, 800, { standaloneTasks: true });
  try {
    await page.getByTestId("task-details-fixture-task-1").click();
    await page.getByTestId("button-open-task-comments").click();
    const dialog = page.getByTestId("dialog-task-comments");
    await dialog.getByTestId("input-task-attachment-files").setInputFiles({
      name: "Príloha.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4"),
    });
    await dialog.getByTestId("chip-task-attachment-0").waitFor();
    await dialog.getByTestId("button-add-comment").click();
    await dialog.getByTestId("task-attachment-0").waitFor();
    const post = requests.find(request => request.method === "POST" && request.path.endsWith("/comments"));
    assert.equal(post.body.content, "");
    assert.equal(post.body.attachments[0].id, "fixture-upload-1");
    await assertNoBrowserErrors(page, "standalone Tasks attachment");
  } finally { await page.close(); }
}

async function verifyTaskAttachments(browser, bundle, width, height) {
  const tasks = clone(FIXTURE_TASKS);
  const correctName = "Snímka obrazovky – žiadosť.pdf";
  tasks[0].attachments = [{
    id: "fixture-existing-pdf",
    name: Buffer.from(correctName, "utf8").toString("latin1"),
    url: "/api/tasks/attachments/fixture-existing-pdf",
    type: "application/pdf",
    size: 40,
  }];
  const { page, requests, state } = await createPage(browser, bundle, width, height, { tasks });
  try {
    await page.getByTestId("task-item-fixture-task-1").click();
    const brief = page.locator(".nexus-signal-brief");
    await brief.getByTestId("task-attachment-0").waitFor();
    assert.equal(await brief.getByTestId("task-attachment-0").getAttribute("title"), correctName);
    assert.ok((await brief.getByTestId("task-attachment-0").innerText()).includes("PDF"));
    await page.getByTestId("task-action-edit").click();
    const dialog = page.getByRole("dialog").last();
    const files = dialog.getByTestId("input-task-attachment-files");
    await files.setInputFiles({
      name: "Rozpočet_žiadosti.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("fixture spreadsheet"),
    });
    await dialog.getByTestId("chip-task-attachment-1").waitFor();
    assert.ok((await dialog.getByTestId("chip-task-attachment-1").innerText()).includes("XLSX"));
    await dialog.getByTestId("button-remove-task-attachment-0").click();
    await dialog.getByTestId("edit-task-save").click();
    await dialog.waitFor({ state: "hidden" });
    const patch = requests.filter(request => request.method === "PATCH" &&
      request.path === "/api/tasks/fixture-task-1").at(-1);
    assert.equal(patch.body.attachments.length, 1);
    assert.equal(patch.body.attachments[0].id, "fixture-upload-1");
    assert.equal(state.tasks[0].attachments[0].name, "Rozpočet_žiadosti.xlsx");
    await brief.getByTestId("task-attachment-0").waitFor();
    assert.equal(await brief.getByTestId("task-attachment-0").getAttribute("title"), "Rozpočet_žiadosti.xlsx");

    await page.getByTestId("button-open-task-comments").click();
    const composer = page.getByTestId("dialog-task-comments");
    await composer.getByTestId("input-task-attachment-files").setInputFiles({
      name: "Odpoveď_Ľuboš.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("fixture word document"),
    });
    await composer.getByTestId("chip-task-attachment-0").waitFor();
    assert.ok((await composer.getByTestId("chip-task-attachment-0").innerText()).includes("DOCX"));
    assert.equal(await page.getByTestId("input-task-comment").inputValue(), "");
    await page.getByTestId("button-add-comment").click();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('[data-testid="dialog-task-comments"] a'))
      .some(link => link.getAttribute("title") === "Odpoveď_Ľuboš.docx"));
    const commentRequest = requests.filter(request => request.method === "POST" &&
      request.path === "/api/tasks/fixture-task-1/comments").at(-1);
    assert.equal(commentRequest.body.content, "");
    assert.equal(commentRequest.body.attachments[0].id, "fixture-upload-2");
    assert.equal(await composer.getByTestId("chip-task-attachment-0").count(), 0);
    await page.screenshot({ path: path.join(PROOF_DIR, `task-attachments-${width}.png`) });

    const uploadsBefore = requests.filter(request => request.path === "/api/tasks/attachments").length;
    await composer.getByTestId("input-task-attachment-files").setInputFiles({
      name: "too-large.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(15 * 1024 * 1024 + 1),
    });
    await composer.getByTestId("task-attachment-error").waitFor();
    assert.equal(requests.filter(request => request.path === "/api/tasks/attachments").length, uploadsBefore);
    assert.equal(await page.getByTestId("button-add-comment").isDisabled(), true);
    await assertNoBrowserErrors(page, "task attachment upload/edit/comment");
    return { width, height, uploads: uploadsBefore, attachmentOnlyComment: true };
  } finally {
    await page.close();
  }
}

async function verifyTaskAttachmentUploadFailure(browser, bundle) {
  const { page, requests } = await createPage(browser, bundle, 1280, 800, { failAttachmentUploads: true });
  try {
    await page.getByTestId("task-item-fixture-task-1").click();
    await page.getByTestId("button-open-task-comments").click();
    const composer = page.getByTestId("dialog-task-comments");
    await composer.getByTestId("input-task-attachment-files").setInputFiles({
      name: "failed.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4"),
    });
    await composer.getByTestId("task-attachment-error").waitFor();
    assert.equal(await composer.getByTestId("chip-task-attachment-0").count(), 0);
    assert.equal(await page.getByTestId("button-add-comment").isDisabled(), true);
    assert.equal(requests.some(request => request.path.endsWith("/comments") && request.method === "POST"), false);
    await assertNoBrowserErrors(page, "task upload failure");
  } finally {
    await page.close();
  }
}

async function verifyTaskFilterDropdown(browser, bundle, width, height) {
  const { page } = await createPage(browser, bundle, width, height);
  try {
    await page.getByTestId("task-item-fixture-task-1").waitFor();
    await page.getByTestId("task-subtab-all").click();
    const trigger = page.getByTestId("btn-task-filters");
    assert.equal(await page.getByTestId("task-date-filter").count(), 0,
      "Unused filters must not occupy the queue header");
    const triggerBounds = await trigger.boundingBox();
    const settingsBounds = await page.getByTestId("btn-task-groups-nexus").boundingBox();
    assert.ok(Math.abs(triggerBounds.y - settingsBounds.y) < 2);
    assert.ok(settingsBounds.x - triggerBounds.x < 40, "Filter button belongs immediately beside settings");
    assert.ok(triggerBounds.x >= 0 && settingsBounds.x + settingsBounds.width <= width,
      "Both header buttons must remain inside the mobile viewport");
    const before = await page.getByTestId("task-item-fixture-task-1").boundingBox();
    await trigger.click();
    const popup = page.getByTestId("task-filters-popover");
    await popup.waitFor({ state: "visible" });
    const bounds = await popup.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height + 1);
    const after = await page.getByTestId("task-item-fixture-task-1").boundingBox();
    assert.equal(after.y, before.y, "Opening the dropdown must not push the task list down");
    await page.getByTestId("task-queue-search").fill("Original Creator");
    const filtered = await taskIds(page);
    assert.ok(filtered.length > 0 && filtered.length < 25);
    await page.keyboard.press("Escape");
    await popup.waitFor({ state: "hidden" });
    assert.deepEqual(await taskIds(page), filtered, "Filters must remain applied when the popup closes");
    assert.equal(await trigger.getAttribute("data-active"), "true");
    await page.screenshot({ path: path.join(PROOF_DIR, `filters-closed-active-${width}.png`) });
    await trigger.click();
    assert.equal(await page.getByTestId("task-queue-search").inputValue(), "Original Creator");
    await page.getByTestId("task-clear-filters").click();
    assert.equal(await trigger.getAttribute("data-active"), "false");
    await chooseOption(page, "task-date-filter", "custom");
    await page.getByTestId("task-date-from").waitFor({ state: "visible" });
    await page.getByTestId("task-date-to").waitFor({ state: "visible" });
    await page.screenshot({ path: path.join(PROOF_DIR, `filters-open-${width}.png`) });
    await page.getByTestId("task-clear-filters").click();
    await page.getByTestId("tab-tasks").click();
    await popup.waitFor({ state: "hidden" });
    await assertNoBrowserErrors(page, "task filter dropdown");
    return { width, height, popupBounds: bounds };
  } finally {
    await page.close();
  }
}

async function verifyQueueControlsAndPagination(browser, bundle) {
  const { page, requests } = await createPage(browser, bundle);
  try {
    await page.getByTestId("task-item-fixture-task-1").waitFor();
    await page.getByTestId("task-subtab-all").click();
    assert.equal((await taskIds(page)).length, 25);
    await page.getByTestId("task-subtab-group-fixture-ops").click();
    assert.deepEqual((await taskIds(page)).sort(), ["fixture-task-1", "fixture-task-2", "fixture-task-6"],
      "a configured group scope should filter to tasks carrying that group_id tag");
    await page.getByTestId("task-subtab-back-office").click();
    assert.deepEqual(await taskIds(page), ["fixture-task-3"],
      "the dedicated Back Office scope should retain its matching task list");
    await page.getByTestId("task-subtab-reporting").click();
    await page.getByRole("dialog").last().waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await page.getByTestId("task-subtab-all").click();
    assert.equal((await taskIds(page)).length, 25);
    await page.getByTestId("task-page-next").click();
    await page.getByTestId("task-item-fixture-task-page-23").waitFor();
    assert.equal((await taskIds(page)).length, 4);
    await page.getByTestId("btn-task-filters").click();
    await page.getByTestId("task-date-filter").waitFor({ state: "visible" });
    await page.getByTestId("task-date-basis").waitFor({ state: "visible" });
    await page.getByTestId("task-sort-field").waitFor({ state: "visible" });
    await page.getByTestId("task-sort-direction").waitFor({ state: "visible" });
    await page.getByTestId("task-creator-filter").waitFor({ state: "visible" });
    await page.getByTestId("task-resolver-filter").waitFor({ state: "visible" });
    await page.waitForFunction(userId =>
      Array.isArray(window.__testQueryClient.getQueryData(["/api/tasks/people", userId])), USER.id, { timeout: 5000 })
      .catch(async error => {
        console.error("Task people query was not hydrated", {
          requests: requests.filter(request => request.path.includes("/api/tasks/people")),
          cachedPeople: await page.evaluate(userId =>
            window.__testQueryClient.getQueryData(["/api/tasks/people", userId]), USER.id),
        });
        throw error;
      });
    assert.deepEqual(await page.evaluate(userId =>
      window.__testQueryClient.getQueryData(["/api/tasks/people", userId]), USER.id),
    PEOPLE, "the documented people endpoint should hydrate the creator/resolver controls");
    assert.ok(requests.some(request => request.method === "GET" && request.path === "/api/tasks/people"),
      "the cache key remains user-scoped while the API request stays at the documented people URL");
    assert.equal(requests.some(request => /^\/api\/tasks\/people\/[^/]+$/.test(request.path)), false,
      "the user id must not be appended to /api/tasks/people by the default query-key URL builder");
    await page.getByTestId("task-queue-search").fill("Original Creator");
    const creatorSearchIds = FIXTURE_TASKS.filter(item => item.createdByUserId === "fixture-creator")
      .map(item => item.id).sort();
    assert.deepEqual((await taskIds(page)).sort(), creatorSearchIds,
      "person search should resolve creator names through the documented /api/tasks/people array");
    assert.equal(await page.getByTestId("task-page-prev").isDisabled(), true,
      "changing a person search on a later page should reset pagination to page one");
    await page.getByTestId("task-queue-search").fill("");

    await chooseOption(page, "task-creator-filter", "fixture-creator");
    const creatorFilterIds = FIXTURE_TASKS.filter(item => item.createdByUserId === "fixture-creator")
      .map(item => item.id).sort();
    assert.deepEqual((await taskIds(page)).sort(), creatorFilterIds,
      "the creator control should filter independently of free-text person search");
    await chooseOption(page, "task-resolver-filter", "fixture-other");
    const creatorAndResolverIds = FIXTURE_TASKS.filter(item =>
      item.createdByUserId === "fixture-creator" && item.resolvedByUserId === "fixture-other")
      .map(item => item.id).sort();
    assert.deepEqual((await taskIds(page)).sort(), creatorAndResolverIds,
      "creator and resolver filters should compose");
    await chooseOption(page, "task-resolver-filter", "any");
    assert.deepEqual((await taskIds(page)).sort(), creatorFilterIds,
      "clearing resolver should preserve the creator filter");
    await page.getByTestId("task-clear-filters").click();

    await chooseOption(page, "task-date-filter", "today");
    await chooseOption(page, "task-date-basis", "created");
    assert.equal(await page.getByTestId("task-page-prev").isDisabled(), true,
      "changing date criteria should reset pagination");
    await chooseOption(page, "task-date-filter", "week");
    await chooseOption(page, "task-date-filter", "month");
    await chooseOption(page, "task-date-filter", "custom");
    await page.getByTestId("task-date-from").waitFor({ state: "visible" });
    await page.getByTestId("task-date-to").waitFor({ state: "visible" });
    await page.getByTestId("task-date-from").fill(new Date().toISOString().slice(0, 10));
    await page.getByTestId("task-date-to").fill(new Date().toISOString().slice(0, 10));
    await chooseOption(page, "task-date-basis", "due");
    await chooseOption(page, "task-date-basis", "resolved");
    await page.getByTestId("task-clear-filters").click();
    await page.getByTestId("task-item-fixture-task-1").waitFor();

    let direction = "desc";
    const priorityRank = { urgent: 4, high: 3, medium: 2, low: 1 };
    const comparators = {
      title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      priority: (a, b) => (priorityRank[a.priority] || 0) - (priorityRank[b.priority] || 0),
      due: (a, b) => {
        const av = a.dueDate ? new Date(a.dueDate).getTime() : Number.NaN;
        const bv = b.dueDate ? new Date(b.dueDate).getTime() : Number.NaN;
        return Number.isNaN(av) ? (Number.isNaN(bv) ? 0 : -1) : Number.isNaN(bv) ? 1 : av - bv;
      },
    };
    for (const field of ["due", "title", "priority"]) {
      await chooseOption(page, "task-sort-field", field);
      for (const target of ["asc", "desc"]) {
        if (direction !== target) {
          await page.getByTestId("task-sort-direction").click();
          direction = target;
        }
        const sign = target === "asc" ? 1 : -1;
        const expected = [...FIXTURE_TASKS].sort((a, b) => {
          const result = comparators[field](a, b);
          return result === 0 ? a.id.localeCompare(b.id) : result * sign;
        }).slice(0, 25).map(item => item.id);
        assert.deepEqual(await taskIds(page), expected,
          `${field} ${target} ordering should be deterministic for nulls and tied values`);
      }
    }
    await page.getByTestId("task-page-next").click();
    await chooseOption(page, "task-sort-field", "title");
    assert.equal(await page.getByTestId("task-page-prev").isDisabled(), true,
      "changing sort while on a later page should reset pagination to page one");
    await page.screenshot({ path: path.join(PROOF_DIR, "queue-advanced-filters.png") });
    await assertNoBrowserErrors(page, "advanced task queue controls");
  } finally {
    await page.close();
  }
}

async function verifyEmailSmsPaginationIsolation(browser, bundle) {
  const email = await createPage(browser, bundle, 1280, 800, { search: "", holdTaskPage: true });
  try {
    await email.page.getByTestId("tab-email").click();
    await email.page.getByTestId("email-item-fixture-email-01").waitFor({ state: "visible" });
    assert.equal(await email.page.locator('[data-testid^="email-item-"]').count(), 25);
    await email.page.getByTestId("button-page-next").click();
    await email.page.getByTestId("email-item-fixture-email-26").waitFor({ state: "visible" });
    assert.deepEqual(
      await email.page.locator('[data-testid^="email-item-"]').evaluateAll(rows =>
        rows.map(row => row.getAttribute("data-testid").replace("email-item-", ""))),
      FIXTURE_EMAILS.slice(25).map(item => item.id),
      "email list should reach its local second page before pending Tasks data arrives",
    );
    assert.ok(email.requests.some(request => request.method === "GET" && request.path === "/api/tasks"),
      "the independent Tasks query should be in flight during the Email pagination check");
    email.releaseTaskPage();
    await email.page.waitForFunction(expectedCount => {
      const tasks = window.__testQueryClient.getQueryData(["/api/tasks"]);
      return Array.isArray(tasks) && tasks.length === expectedCount;
    }, FIXTURE_TASKS.length);
    assert.deepEqual(
      await email.page.locator('[data-testid^="email-item-"]').evaluateAll(rows =>
        rows.map(row => row.getAttribute("data-testid").replace("email-item-", ""))),
      FIXTURE_EMAILS.slice(25).map(item => item.id),
      "initial Tasks load must not clamp the Email list's independent second-page index",
    );
    await email.page.evaluate(async () => {
      await window.__testQueryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    });
    assert.deepEqual(
      await email.page.locator('[data-testid^="email-item-"]').evaluateAll(rows =>
        rows.map(row => row.getAttribute("data-testid").replace("email-item-", ""))),
      FIXTURE_EMAILS.slice(25).map(item => item.id),
      "a Tasks refetch must leave the Email list page and visible rows unchanged",
    );
    assert.ok(email.requests.filter(request => request.method === "GET" && request.path === "/api/tasks").length >= 2,
      "the Email isolation regression should exercise both the initial Tasks load and an explicit refetch");
    await email.page.screenshot({ path: path.join(PROOF_DIR, "email-second-page-after-task-refetch.png") });
    await assertNoBrowserErrors(email.page, "Email page while Tasks loads/refetches");
  } finally {
    await email.page.close();
  }

  const sms = await createPage(browser, bundle, 1280, 800, { search: "", holdTaskPage: true });
  try {
    await sms.page.getByTestId("tab-sms").click();
    await sms.page.getByTestId("sms-item-fixture-sms-01").waitFor({ state: "visible" });
    assert.equal(await sms.page.locator('[data-testid^="sms-item-"]').count(), 25);
    await sms.page.getByTestId("sms-page-next").click();
    await sms.page.getByTestId("sms-item-fixture-sms-26").waitFor({ state: "visible" });
    const expectedSmsPage = FIXTURE_SMS.slice(25).map(item => `sms-item-${item.id}`);
    assert.deepEqual(
      await sms.page.locator('[data-testid^="sms-item-"]').evaluateAll(rows =>
        rows.map(row => row.getAttribute("data-testid"))),
      expectedSmsPage,
      "SMS list should be on page two before pending Tasks data arrives",
    );
    sms.releaseTaskPage();
    await sms.page.waitForFunction(expectedCount => {
      const tasks = window.__testQueryClient.getQueryData(["/api/tasks"]);
      return Array.isArray(tasks) && tasks.length === expectedCount;
    }, FIXTURE_TASKS.length);
    await sms.page.evaluate(async () => {
      await window.__testQueryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    });
    assert.deepEqual(
      await sms.page.locator('[data-testid^="sms-item-"]').evaluateAll(rows =>
        rows.map(row => row.getAttribute("data-testid"))),
      expectedSmsPage,
      "a Tasks refetch must leave the SMS list page and visible rows unchanged",
    );
    assert.ok(sms.requests.filter(request => request.method === "GET" && request.path === "/api/tasks").length >= 2,
      "the SMS isolation regression should exercise both the initial Tasks load and an explicit refetch");
    await sms.page.screenshot({ path: path.join(PROOF_DIR, "sms-second-page-after-task-refetch.png") });
    await assertNoBrowserErrors(sms.page, "SMS page while Tasks loads/refetches");
  } finally {
    await sms.page.close();
  }
}

async function verifyActionRow(browser, bundle, width, height, dark = false) {
  const { page } = await createPage(browser, bundle, width, height, { dark });
  try {
    await page.getByTestId("task-item-fixture-task-1").click();
    const actions = page.locator(".nexus-signal-actions");
    await actions.waitFor({ state: "visible" });
    for (const testId of ["task-action-edit", "task-action-start", "task-action-cancel"]) {
      await page.getByTestId(testId).waitFor({ state: "visible" });
    }
    const measured = await actions.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const buttons = [...element.querySelectorAll("button")].map(button => {
        const bounds = button.getBoundingClientRect();
        return { testId: button.getAttribute("data-testid"), x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
      });
      return {
        x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        buttons,
      };
    });
    await page.screenshot({ path: path.join(PROOF_DIR, `actions-${dark ? "dark-" : ""}${width}x${height}.png`) });
    assert.ok(measured.buttons.length >= 3, `Edit/Start/Cancel should be individual buttons in one action row: ${JSON.stringify(measured)}`);
    assert.ok(measured.buttons.every(button => button.testId && button.width > 0),
      `all task actions should be visible, individually addressable buttons: ${JSON.stringify(measured)}`);
    assert.equal(new Set(measured.buttons.map(button => button.y)).size, 1,
      `all task actions should share one horizontal row at ${width}x${height}: ${JSON.stringify(measured)}`);
    assert.equal(await actions.locator('[role="menu"],[data-radix-collection-item]').count(), 0,
      "task actions should not be hidden in a dropdown menu");
    await assertNoBrowserErrors(page, `task action row ${width}x${height}`);
    return measured;
  } finally {
    await page.close();
  }
}

async function verifyTaskActionRequests(browser, bundle) {
  const { page, requests } = await createPage(browser, bundle);
  try {
    await page.getByTestId("task-subtab-all").click();
    await page.getByTestId("task-item-fixture-task-1").click();
    await page.getByTestId("task-action-start").click();
    await page.waitForFunction(() =>
      document.querySelector(".nexus-signal-detail-header [data-status='in_progress']"));
    assert.deepEqual(
      requests.find(request => request.method === "PATCH" && request.path === "/api/tasks/fixture-task-1")?.body,
      { status: "in_progress" },
      "the Start button should directly use the existing task PATCH status contract",
    );
    await page.getByTestId("task-action-cancel").click();
    const cancelDialog = page.getByTestId("dialog-cancel-task");
    await cancelDialog.waitFor();
    assert.equal(requests.filter(request =>
      request.method === "PATCH" && request.path === "/api/tasks/fixture-task-1" && request.body?.status === "cancelled").length, 0);
    await cancelDialog.getByTestId("button-confirm-cancel-task").click();
    await page.waitForFunction(() =>
      document.querySelector(".nexus-signal-detail-header [data-status='cancelled']"));
    const cancelRequest = requests.filter(request =>
      request.method === "PATCH" && request.path === "/api/tasks/fixture-task-1").at(-1);
    assert.deepEqual(cancelRequest?.body, { status: "cancelled" },
      "the Cancel button should confirm then PATCH the cancelled status");
    await assertNoBrowserErrors(page, "direct task action requests");
  } finally {
    await page.close();
  }
}

async function verifyCancelConfirmation(browser, bundle, { standaloneTasks = false, width = 1280, height = 800, dark = false } = {}) {
  const { page, requests, state } = await createPage(browser, bundle, width, height, { standaloneTasks, dark });
  const nativeDialogs = [];
  page.on("dialog", dialog => { nativeDialogs.push(dialog.message()); void dialog.dismiss(); });
  const cancelRequests = () => requests.filter(request => request.method === "PATCH" &&
    request.path === "/api/tasks/fixture-task-1" && request.body?.status === "cancelled");
  const openCancel = async () => {
    if (standaloneTasks) {
      await page.getByTestId("task-menu-fixture-task-1").click();
      await page.getByTestId("task-cancel-fixture-task-1").click();
    } else {
      await page.getByTestId("task-action-cancel").click();
    }
    const dialog = page.getByTestId("dialog-cancel-task");
    await dialog.waitFor();
    return dialog;
  };
  try {
    if (!standaloneTasks) {
      await page.getByTestId("task-subtab-all").click();
      await page.getByTestId("task-item-fixture-task-1").click();
    }
    let dialog = await openCancel();
    assert.equal(cancelRequests().length, 0, "opening the warning must not cancel the task");
    assert.match(await dialog.innerText(), /Pulse completion task/, "the modal must identify the selected task");
    const consequence = await dialog.getByTestId("task-cancel-consequence").innerText();
    assert.match(consequence, /dokonč|complet|finish/i, "the warning must explain that completion is unavailable after cancelling");
    const bounds = await dialog.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 &&
      bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1,
    "the confirmation must fit within the viewport");
    await page.screenshot({ path: path.join(PROOF_DIR, `task-cancel-${standaloneTasks ? "standalone-" : ""}${width}-${height}${dark ? "-dark" : ""}.png`) });
    await dialog.getByTestId("button-keep-task").click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(cancelRequests().length, 0, "keeping the task must never PATCH");
    dialog = await openCancel();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(cancelRequests().length, 0, "Escape must not cancel");
    dialog = await openCancel();
    state.failTaskPatchIds.add("fixture-task-1");
    await dialog.getByTestId("button-confirm-cancel-task").click();
    await page.waitForFunction(() => document.querySelector('[data-testid="dialog-cancel-task"] [data-testid="button-confirm-cancel-task"]:not(:disabled)'));
    assert.equal(cancelRequests().length, 1);
    assert.equal(state.tasks.find(task => task.id === "fixture-task-1").status, "pending");
    assert.equal(await dialog.isVisible(), true, "a failed PATCH must leave the warning open for retry");
    await dialog.getByTestId("button-confirm-cancel-task").click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(cancelRequests().length, 2, "retry should send one new cancel PATCH");
    assert.equal(state.tasks.find(task => task.id === "fixture-task-1").status, "cancelled");
    assert.deepEqual(nativeDialogs, [], "use a designed confirmation, never window.confirm");
    await assertNoBrowserErrors(page, "cancel confirmation");
  } finally { await page.close(); }
}

async function verifyCancelPendingGuard(browser, bundle) {
  const { page, requests, state } = await createPage(browser, bundle, 390, 844, { holdTaskCancel: true });
  try {
    await page.getByTestId("task-subtab-all").click();
    await page.getByTestId("task-item-fixture-task-1").click();
    await page.getByTestId("task-action-cancel").click();
    const dialog = page.getByTestId("dialog-cancel-task");
    await dialog.getByTestId("button-confirm-cancel-task").click();
    await page.waitForFunction(() => document.querySelector('[data-testid="button-confirm-cancel-task"]:disabled'));
    assert.equal(await dialog.getByTestId("button-keep-task").isDisabled(), true,
      "the task cannot be dismissed while the cancellation is in flight");
    await page.keyboard.press("Escape");
    assert.equal(await dialog.isVisible(), true, "Escape must not close a pending cancellation");
    assert.equal(requests.filter(request => request.method === "PATCH" &&
      request.path === "/api/tasks/fixture-task-1" && request.body?.status === "cancelled").length, 1);
    state.releaseCancel();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(state.tasks.find(task => task.id === "fixture-task-1").status, "cancelled");
    await assertNoBrowserErrors(page, "pending cancel guard");
  } finally { state.releaseCancel(); await page.close(); }
}

async function verifyResolutionChecklistAndNotes(browser, bundle, width, height, standaloneTasks = false, dark = false) {
  const draft = "Úloha bola vyriešená. Údaje boli overené a schválená zmena uložená.";
  const taskId = "fixture-task-1";
  const { page, requests, state } = await createPage(browser, bundle, width, height, {
    standaloneTasks, dark, resolutionDraft: draft,
    checklist: { [taskId]: [
      { id: "note-step-a", taskId, label: "Overiť údaje", required: false, doneAt: null, note: null, position: 0 },
      { id: "note-step-b", taskId, label: "Uložiť schválenú zmenu", required: false, doneAt: null, note: null, position: 1 },
    ] },
  });
  const openResolve = async () => {
    await page.getByTestId(standaloneTasks ? `task-resolve-${taskId}` : "task-resolve-btn").click();
    await page.getByTestId("dialog-task-resolution").waitFor();
  };
  const resolutionInput = page.getByTestId(standaloneTasks ? "input-resolve-resolution" : "resolve-text");
  try {
    if (!standaloneTasks) await page.getByTestId(`task-item-${taskId}`).click();
    await openResolve();
    await page.getByTestId("resolution-checklist-gate").waitFor();
    await resolutionInput.fill("Ručný text nesmie obísť checklist.");
    assert.equal(await page.getByTestId("resolve-confirm").isDisabled(), true);
    assert.equal(requests.filter(request => request.path.endsWith("/resolution-draft")).length, 0,
      "an unfinished Pulse checklist must not produce an AI success summary");
    assert.equal(requests.filter(request => request.path.endsWith("/resolve") && request.method === "POST").length, 0);
    await page.keyboard.press("Escape");
    await page.getByTestId("dialog-task-resolution").waitFor({ state: "hidden" });

    await page.getByTestId("button-toggle-note-step-a").click();
    const note = page.getByTestId("input-checklist-note-note-step-a");
    await note.waitFor();
    assert.equal(await note.getAttribute("maxLength"), "240");
    await note.fill("Správna adresa bola potvrdená.");
    await page.getByTestId("button-save-checklist-note-note-step-a").click();
    await page.getByTestId("checklist-note-note-step-a").getByText("Správna adresa bola potvrdená.", { exact: true }).waitFor();
    const notePatch = requests.filter(request => request.method === "PATCH" &&
      request.path === "/api/task-checklist/note-step-a").at(-1);
    assert.deepEqual(notePatch.body, { note: "Správna adresa bola potvrdená." },
      "editing a note must not overwrite another solver's checkbox state");
    await page.getByTestId("button-toggle-note-step-b").click();
    await page.getByTestId("input-checklist-note-note-step-b").fill("Zmena je uložená.");
    await page.getByTestId("button-save-checklist-note-note-step-b").click();
    await page.getByTestId("checklist-note-note-step-b").waitFor();
    assert.equal(state.checklist[taskId].every(item => !!item.doneAt), true);
    const checklistBounds = await page.getByTestId(`checklist-${taskId}`).boundingBox();
    assert.ok(checklistBounds && checklistBounds.x >= 0 && checklistBounds.x + checklistBounds.width <= width + 1,
      "saving notes and returning from a modal must not shift the checklist outside the viewport");
    await page.screenshot({ animations: "disabled", path: path.join(PROOF_DIR, `task-checklist-notes-${standaloneTasks ? "standalone-" : ""}${width}${dark ? "-dark" : ""}.png`) });

    await openResolve();
    await page.waitForFunction(([id, value]) => document.querySelector(`[data-testid="${id}"]`)?.value === value,
      [standaloneTasks ? "input-resolve-resolution" : "resolve-text", draft]);
    assert.equal(requests.filter(request => request.path.endsWith("/resolution-draft") && request.method === "POST").length, 1);
    assert.equal(state.tasks.find(task => task.id === taskId).status, "pending", "a generated draft must never complete the task");
    const modal = page.getByTestId("dialog-task-resolution");
    const box = await modal.boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1);
    await page.screenshot({ animations: "disabled", path: path.join(PROOF_DIR, `task-resolution-draft-${standaloneTasks ? "standalone-" : ""}${width}${dark ? "-dark" : ""}.png`) });
    await resolutionInput.fill(`${draft} Riešiteľ skontroloval výsledok.`);
    await page.getByTestId("resolve-confirm").click();
    await modal.waitFor({ state: "hidden" });
    const approval = requests.find(request => request.method === "POST" && request.path === `/api/tasks/${taskId}/resolve`);
    assert.equal(approval.body.resolution, `${draft} Riešiteľ skontroloval výsledok.`);
    assert.equal(Object.hasOwn(approval.body, "userId"), false);
    assert.equal(state.tasks.find(task => task.id === taskId).status, "completed");
    await assertNoBrowserErrors(page, "persisted checklist notes and editable resolution draft");
  } finally { await page.close(); }
}

async function verifyResolutionDraftTypingRace(browser, bundle) {
  const { page, requests, state } = await createPage(browser, bundle, 390, 844, {
    holdResolutionDrafts: true, resolutionDraft: "Neskorý AI návrh, ktorý nesmie prepísať ručný text.",
  });
  try {
    await page.getByTestId("task-item-fixture-task-1").click();
    await page.getByTestId("task-resolve-btn").click();
    const modal = page.getByTestId("dialog-task-resolution");
    await modal.waitFor();
    await page.waitForTimeout(200);
    assert.equal(requests.filter(request => request.path.endsWith("/resolution-draft")).length, 1);
    await page.getByTestId("resolve-text").fill("Vlastné overené zhrnutie riešiteľa.");
    state.releaseDraft();
    await page.waitForFunction(() => !document.querySelector('[data-testid="dialog-task-resolution"] .animate-spin'));
    assert.equal(await page.getByTestId("resolve-text").inputValue(), "Vlastné overené zhrnutie riešiteľa.",
      "a delayed AI result must never replace the resolver's own typing");
    assert.equal(state.tasks.find(task => task.id === "fixture-task-1").status, "pending");
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "hidden" });
    await assertNoBrowserErrors(page, "resolution draft typing race");
  } finally { state.releaseDraft?.(); await page.close(); }
}

async function verifyResolutionDraftFailureRetry(browser, bundle) {
  const { page, requests } = await createPage(browser, bundle, 1280, 800, {
    resolutionDraftFailures: 1, resolutionDraft: "Úloha bola vyriešená. Schválená zmena bola overená.",
  });
  try {
    await page.getByTestId("task-item-fixture-task-1").click();
    await page.getByTestId("task-resolve-btn").click();
    await page.getByTestId("button-resolution-draft-retry").waitFor();
    assert.equal(await page.getByTestId("resolve-text").inputValue(), "", "AI failure must not fabricate a success resolution");
    await page.getByTestId("button-resolution-draft-retry").click();
    await page.waitForFunction(() => document.querySelector('[data-testid="resolve-text"]')?.value.includes("Schválená"));
    assert.equal(requests.filter(request => request.path.endsWith("/resolution-draft") && request.method === "POST").length, 2);
    assert.equal(requests.filter(request => request.path.endsWith("/resolve") && request.method === "POST").length, 0);
    await assertNoBrowserErrors(page, "AI resolution failure and retry");
  } finally { await page.close(); }
}

async function verifyTaskEdits(browser, bundle) {
  const { page, requests, state } = await createPage(browser, bundle);
  try {
    await page.getByTestId("task-subtab-all").click();
    await page.getByTestId("task-item-fixture-task-2").click();
    await page.getByTestId("task-action-edit").click();
    await page.getByTestId("edit-task-title").fill("Edited ordinary task");
    await page.getByTestId("edit-task-description").fill("Updated details without losing tags");
    await page.getByTestId("edit-task-due-date").fill("");
    await chooseEditSelect(page, 0, "urgent");
    await chooseEditSelect(page, 1, "pending");
    await chooseOption(page, "edit-task-assignee", "fixture-creator");
    await chooseOption(page, "edit-task-group", "fixture-back-office");
    state.failTaskPatchIds.add("fixture-task-2");
    await page.getByTestId("edit-task-save").click();
    await page.getByRole("alert").waitFor({ state: "visible" });
    assert.equal(await page.getByRole("dialog").last().isVisible(), true,
      "an update error should keep the edit dialog open so the user can retry");
    assert.equal(state.tasks.find(item => item.id === "fixture-task-2").title, "Ordinary editable task",
      "a rejected patch must not mutate the test API state");
    await page.getByTestId("edit-task-save").click();
    await page.waitForFunction(() => document.querySelector('[data-testid="edit-task-title"]') === null);
    const mutation = requests.filter(request => request.method === "PATCH" && request.path === "/api/tasks/fixture-task-2").at(-1);
    assert.ok(mutation, "saving task edits should use the existing task PATCH endpoint");
    assert.equal(mutation.body.title, "Edited ordinary task");
    assert.equal(mutation.body.description, "Updated details without losing tags");
    assert.equal(mutation.body.priority, "urgent");
    assert.equal(mutation.body.status, "pending");
    assert.equal(mutation.body.assignedUserId, "fixture-creator");
    assert.equal(mutation.body.dueDate, null, "clearing the date should send an explicit null due date");
    assert.deepEqual(mutation.body.tags.sort(), ["group_id:fixture-back-office", "preserve_me"].sort(),
      "editing the group must preserve non-group source tags");
    assert.equal(state.tasks.find(item => item.id === "fixture-task-2").title, "Edited ordinary task",
      "successful save should update the task-query-backed list from refreshed API data");

    await page.getByTestId("task-item-fixture-task-1").click();
    await page.getByTestId("task-action-edit").click();
    await chooseEditSelect(page, 1, "completed");
    await page.getByTestId("edit-task-resolution").waitFor({ state: "visible" });
    assert.ok(await page.getByTestId("edit-task-notify-agent").count(),
      "editing a Pulse completion should expose its notification choice");
    const pulsePatchCount = requests.filter(request =>
      request.method === "PATCH" && request.path === "/api/tasks/fixture-task-1").length;
    await page.getByTestId("edit-task-save").click();
    await Promise.race([
      page.locator('[role="dialog"]:has([data-testid="edit-task-title"]) [role="alert"]')
        .waitFor({ state: "visible", timeout: 2500 }).catch(() => null),
      page.getByTestId("edit-task-title")
        .waitFor({ state: "detached", timeout: 2500 }).catch(() => null),
    ]);
    const resolutionError = await page.locator('[role="dialog"]:has([data-testid="edit-task-title"]) [role="alert"]').last()
      .innerText().catch(() => "");
    const dialogStillOpen = await page.getByTestId("edit-task-title").count() > 0;
    const pulsePatchesWithoutResolution = requests.filter(request =>
      request.method === "PATCH" && request.path === "/api/tasks/fixture-task-1").slice(pulsePatchCount);
    assert.ok(
      resolutionError && dialogStillOpen && pulsePatchesWithoutResolution.length === 0,
      `a completed-status edit without resolution must stay open with validation and send no PATCH; alert=${JSON.stringify(resolutionError)}, dialogOpen=${dialogStillOpen}, requests=${JSON.stringify(pulsePatchesWithoutResolution)}`,
    );
    await page.getByTestId("edit-task-resolution").fill("Edit-completion resolution");
    await page.getByTestId("edit-task-notify-agent").click();
    await chooseOption(page, "edit-task-group", "fixture-back-office");
    await page.getByTestId("edit-task-save").click();
    await page.waitForFunction(() => document.querySelector('[data-testid="edit-task-title"]') === null);
    const completionPatch = requests.filter(request => request.method === "PATCH" && request.path === "/api/tasks/fixture-task-1").at(-1);
    assert.equal(completionPatch?.body.status, "completed");
    assert.equal(completionPatch?.body.resolution, "Edit-completion resolution");
    assert.equal(completionPatch?.body.notifyAgent, false,
      "the Pulse edit-completion notification choice should be sent explicitly");
    assert.deepEqual(completionPatch?.body.tags.sort(), [
      "group_id:fixture-back-office", "source_keep", "status_list",
    ].sort(), "Pulse completion editing should preserve source/Status List tags while changing group_id");
    assert.equal(state.tasks.find(item => item.id === "fixture-task-1").title, "Pulse completion task",
      "Pulse edit should preserve the task title while changing only the configured fields");
    await assertNoBrowserErrors(page, "task edit/save/retry flows");
  } finally {
    await page.close();
  }
}

async function verifyCompletedTaskEdit(browser, bundle) {
  const { page, requests, state } = await createPage(browser, bundle);
  try {
    await page.getByTestId("task-subtab-all").click();
    await page.getByTestId("task-item-fixture-task-4").waitFor({ state: "visible" });
    const original = clone(state.tasks.find(item => item.id === "fixture-task-4"));
    const initialNotificationCount = state.notifications.length;
    await page.getByTestId("task-item-fixture-task-4").click();
    await page.getByTestId("task-action-edit").click();
    await page.getByTestId("edit-task-title").fill("Edited already-completed task");
    await page.getByTestId("edit-task-description").fill("Updated completed-task details");
    await page.getByTestId("edit-task-due-date").fill("");
    await chooseEditSelect(page, 0, "urgent");
    await chooseOption(page, "edit-task-assignee", "fixture-creator");
    await chooseOption(page, "edit-task-group", "fixture-back-office");
    await page.getByTestId("edit-task-save").click();
    await page.getByTestId("edit-task-title").waitFor({ state: "detached" });

    const patches = requests.filter(request =>
      request.method === "PATCH" && request.path === "/api/tasks/fixture-task-4");
    assert.equal(patches.length, 1, "editing an already-completed task should persist through one ordinary task PATCH");
    const mutation = patches[0];
    assert.equal(mutation.body.status, "completed", "the edit should preserve the task's completed status");
    assert.equal(mutation.body.title, "Edited already-completed task");
    assert.equal(mutation.body.description, "Updated completed-task details");
    assert.equal(mutation.body.priority, "urgent");
    assert.equal(mutation.body.assignedUserId, "fixture-creator");
    assert.equal(mutation.body.dueDate, null, "clearing an existing due date should send explicit null");
    assert.equal(mutation.body.resolution, original.resolution, "the existing completion resolution should be preserved");
    assert.deepEqual(mutation.body.tags.sort(), ["fixture_tag", "group_id:fixture-back-office"].sort());
    assert.equal(mutation.body.notifyAgent, false,
      "editing completed task details must explicitly avoid requesting a new notification");
    assert.equal(Object.hasOwn(mutation.body, "userId"), false, "the client must not forge a notification recipient");
    assert.equal(Object.hasOwn(mutation.body, "resolvedByUserId"), false,
      "the client must not forge or overwrite the original resolver attribution");
    assert.equal(Object.hasOwn(mutation.body, "resolvedAt"), false,
      "the client must not forge the task's original resolution timestamp");
    assert.equal(requests.some(request =>
      request.method === "POST" && request.path === "/api/tasks/fixture-task-4/resolve"), false,
    "an ordinary edit of an already-completed task must not retry the resolve endpoint");

    const updated = state.tasks.find(item => item.id === "fixture-task-4");
    assert.equal(updated.status, "completed");
    assert.equal(updated.resolution, original.resolution);
    assert.equal(updated.resolvedAt, original.resolvedAt);
    assert.equal(updated.resolvedByUserId, original.resolvedByUserId,
      "a content edit must preserve historical resolver attribution");
    assert.equal(updated.dueDate, null);
    assert.equal(state.notifications.length, initialNotificationCount,
      "editing completed-task details must not create another notification");

    await page.waitForFunction(title =>
      document.querySelector(".nexus-signal-detail-header h2")?.textContent?.trim() === title,
    "Edited already-completed task");
    const detail = page.locator(".nexus-signal-detail-header");
    await detail.locator('[data-status="completed"]').waitFor({ state: "visible" });
    await detail.locator('[data-priority="urgent"]').waitFor({ state: "visible" });
    await detail.getByText("Original Creator").waitFor({ state: "visible" });
    assert.equal(await detail.locator(".nexus-signal-meta > div").count(), 2,
      "the refreshed selected-task detail should no longer render a due date");
    await assertNoBrowserErrors(page, "editing an already-completed task");
    return { mutation: mutation.body, resolver: updated.resolvedByUserId, selectedDetailTitle: await detail.locator("h2").innerText() };
  } finally {
    await page.close();
  }
}

async function verifyPulseCompletionAndInbox(browser, bundle) {
  const { page, requests, state } = await createPage(browser, bundle, 1280, 800);
  try {
    await page.getByTestId("task-subtab-all").click();
    await page.getByTestId("task-item-fixture-task-1").waitFor();
    await page.getByTestId("task-item-fixture-task-1").click();
    await page.getByTestId("task-resolve-btn").click();
    await page.getByTestId("resolve-text").fill("Pulse resolution text");
    assert.ok(await page.getByTestId("task-notify-agent").count(),
      "Pulse resolve should offer notification to its original creator");
    await page.getByTestId("task-notify-agent").click();
    await page.getByTestId("resolve-confirm").click();
    await page.waitForFunction(() => document.querySelector('[data-testid="resolve-text"]') === null);
    const resolveOptOut = requests.find(request => request.method === "POST" && request.path === "/api/tasks/fixture-task-1/resolve");
    assert.deepEqual(resolveOptOut?.body, { resolution: "Pulse resolution text", notifyAgent: false },
      "resolution request must carry notifyAgent true/false and must not accept a client-selected recipient");
    assert.equal(Object.hasOwn(resolveOptOut?.body || {}, "userId"), false,
      "the browser must not send the notification recipient; the server owns recipient derivation");
    assert.equal(state.tasks.find(item => item.id === "fixture-task-1").createdByUserId, "fixture-creator",
      "the task fixture's original creator is distinct from the resolving user");

    await page.getByTestId("task-item-fixture-task-6").click();
    await page.getByTestId("task-resolve-btn").click();
    await page.getByTestId("resolve-text").fill("Pulse opt-in resolution text");
    await page.getByTestId("resolve-confirm").click();
    await page.waitForFunction(() => document.querySelector('[data-testid="resolve-text"]') === null);
    const resolveOptIn = requests.find(request => request.method === "POST" && request.path === "/api/tasks/fixture-task-6/resolve");
    assert.deepEqual(resolveOptIn?.body, { resolution: "Pulse opt-in resolution text", notifyAgent: true },
      "the checked Pulse notification choice should send notifyAgent=true");
    assert.equal(Object.hasOwn(resolveOptIn?.body || {}, "userId"), false,
      "the opt-in request must not select or override the recipient");
    assert.equal(state.notifications.length, 1);
    assert.equal(state.notifications[0].userId, "fixture-creator",
      "the server contract fixture derives the target from the task's original creator");
    assert.equal(state.notifications[0].metadata.source, "nexus_pulse");

    await page.getByTestId("task-item-fixture-task-2").click();
    await page.getByTestId("task-resolve-btn").click();
    assert.equal(await page.getByTestId("task-notify-agent").isChecked(), false,
      "ordinary tasks may explicitly notify their creator but default to no notification");
    assert.equal(await page.getByTestId("resolution-checklist-gate").count(), 0,
      "ordinary clinic/task records must not acquire Pulse checklist gates");
    await assertNoBrowserErrors(page, "Pulse completion and Back Office inbox");
  } finally {
    await page.close();
  }
}

async function verifyPulseStatusListMarkerFallback(browser, bundle, standaloneTasks) {
  const relationOnlyId = "fixture-legacy-pulse-relation";
  const tagOnlyId = "fixture-legacy-pulse-tag";
  const editRelationOnlyId = "fixture-legacy-pulse-edit";
  const clinicId = "fixture-ordinary-clinic-task";
  const checklistFor = id => [{
    id: `${id}-done`,
    taskId: id,
    label: "Confirmed the assigned work",
    required: true,
    doneAt: new Date().toISOString(),
    doneByUserId: USER.id,
    note: null,
    position: 0,
  }];
  const tasks = [
    task(relationOnlyId, {
      title: "Pulse task with persisted Status List relationship",
      createdByUserId: "fixture-creator",
      relatedEntityType: "status_list_item",
      relatedEntityId: "fixture-status-list-item",
      tags: ["fixture_tag"],
    }),
    task(tagOnlyId, {
      title: "Pulse task with persisted Status List tag",
      createdByUserId: "fixture-creator",
      relatedEntityType: null,
      tags: ["status_list"],
    }),
    task(editRelationOnlyId, {
      title: "Pulse task to complete through editing",
      createdByUserId: "fixture-creator",
      relatedEntityType: "status_list_item",
      relatedEntityId: "fixture-status-list-item-edit",
      tags: ["fixture_tag"],
    }),
    task(clinicId, {
      title: "Ordinary clinic task",
      relatedEntityType: "clinic",
      relatedEntityId: "fixture-clinic",
      createdByUserId: "fixture-legacy-creator",
      tags: ["fixture_tag"],
    }),
  ];
  const { page, requests, state } = await createPage(browser, bundle, 1280, 800, {
    standaloneTasks,
    tasks,
    checklist: {
      [relationOnlyId]: checklistFor(relationOnlyId),
      [tagOnlyId]: checklistFor(tagOnlyId),
      [editRelationOnlyId]: checklistFor(editRelationOnlyId),
    },
  });
  const openResolve = async taskId => {
    if (standaloneTasks) {
      await page.getByTestId(`task-resolve-${taskId}`).click();
    } else {
      await page.getByTestId(`task-item-${taskId}`).click();
      await page.getByTestId("task-resolve-btn").click();
    }
  };
  try {
    const notify = page.getByTestId("task-notify-agent");
    await openResolve(relationOnlyId);
    assert.equal(await notify.isChecked(), true,
      "the status-list entity relationship alone must show an enabled-by-default creator notification in either task interface");
    await page.getByTestId(standaloneTasks ? "input-resolve-resolution" : "resolve-text")
      .fill("Completed work for the original Pulse requester.");
    await notify.click();
    await page.getByTestId("resolve-confirm").click();
    await page.getByTestId(standaloneTasks ? "input-resolve-resolution" : "resolve-text")
      .waitFor({ state: "detached" });
    const optOut = requests.find(request =>
      request.method === "POST" && request.path === `/api/tasks/${relationOnlyId}/resolve`);
    assert.equal(optOut?.body.notifyAgent, false, "the opt-out must reach the resolver endpoint");
    assert.equal(state.notifications.length, 0, "an opted-out completion must not notify the creator");

    await openResolve(tagOnlyId);
    assert.equal(await notify.isChecked(), true,
      "the persisted status_list tag alone must also show the checked creator notification");
    await page.getByTestId(standaloneTasks ? "input-resolve-resolution" : "resolve-text")
      .fill("Completed the Pulse task.");
    await page.getByTestId("resolve-confirm").click();
    await page.getByTestId(standaloneTasks ? "input-resolve-resolution" : "resolve-text")
      .waitFor({ state: "detached" });
    const optIn = requests.find(request =>
      request.method === "POST" && request.path === `/api/tasks/${tagOnlyId}/resolve`);
    assert.equal(optIn?.body.notifyAgent, true, "the default opt-in must be persisted in the resolve request");
    assert.equal(Object.hasOwn(optIn?.body || {}, "userId"), false,
      "the browser cannot choose a notification recipient");
    assert.equal(state.notifications.length, 1);
    assert.equal(state.notifications[0].userId, "fixture-creator",
      "the notification is addressed to the task's original creator, not the completing user");

    if (standaloneTasks) {
      await page.getByTestId(`task-menu-${editRelationOnlyId}`).click();
      await page.getByTestId(`task-edit-${editRelationOnlyId}`).click();
      await page.getByTestId("select-edit-status").click();
      await page.locator('[role="option"]').nth(2).click();
      const editNotify = page.getByTestId("standalone-edit-notify-agent");
      assert.equal(await editNotify.isChecked(), true,
        "editing a Pulse task into completed status must offer an enabled-by-default notification");
      await page.getByTestId("btn-save-standalone-task-edit").click();
      await page.getByTestId("standalone-edit-resolution").waitFor({ state: "visible" });
      assert.equal(requests.some(request =>
        request.method === "PATCH" && request.path === `/api/tasks/${editRelationOnlyId}`), false,
      "a Pulse edit cannot complete without recording its resolution");
      await page.getByTestId("standalone-edit-resolution").fill("Resolved from the task editor.");
      await editNotify.click();
      await page.getByTestId("btn-save-standalone-task-edit").click();
      await page.getByTestId("standalone-edit-resolution").waitFor({ state: "detached" });
      const editCompletion = requests.find(request =>
        request.method === "PATCH" && request.path === `/api/tasks/${editRelationOnlyId}`);
      assert.equal(editCompletion?.body.status, "completed");
      assert.equal(editCompletion?.body.resolution, "Resolved from the task editor.");
      assert.equal(editCompletion?.body.notifyAgent, false,
        "standalone edit completion must honor notification opt-out");
      assert.equal(state.notifications.length, 1, "an opted-out edit completion must not send another creator notice");
    }

    await openResolve(clinicId);
    assert.equal(await notify.isChecked(), false,
      "ordinary clinic-linked tasks without Pulse provenance must default to no creator notification");
    assert.equal(await page.getByTestId("resolution-checklist-gate").count(), 0,
      "ordinary clinic-linked tasks must not acquire the Status List checklist gate");
    await page.getByTestId(standaloneTasks ? "input-resolve-resolution" : "resolve-text")
      .fill("Explicitly opted-in legacy creator notice.");
    await notify.click();
    await page.getByTestId("resolve-confirm").click();
    await page.getByTestId(standaloneTasks ? "input-resolve-resolution" : "resolve-text")
      .waitFor({ state: "detached" });
    const legacyOptIn = requests.find(request =>
      request.method === "POST" && request.path === `/api/tasks/${clinicId}/resolve`);
    assert.equal(legacyOptIn?.body.notifyAgent, true,
      "an unclassified legacy task can explicitly opt in to notifying its task creator");
    assert.equal(Object.hasOwn(legacyOptIn?.body || {}, "userId"), false,
      "the legacy opt-in cannot select or override its recipient");
    assert.equal(state.tasks.find(item => item.id === clinicId).tags.includes("nexus_pulse_manual"), false,
      "explicit notification does not retrofit an unverified Pulse origin marker");
    assert.equal(state.notifications.at(-1)?.userId, "fixture-legacy-creator",
      "an explicit legacy opt-in notifies only the server-derived original creator");
    await assertNoBrowserErrors(page, `${standaloneTasks ? "standalone " : "Omni "}Pulse-source marker fallback`);
  } finally {
    await page.close();
  }
}

async function verifyManualPulseTaskCreationAndOptIn(browser, bundle) {
  const { page, requests, state } = await createPage(browser, bundle, 1280, 800, {
    manualPulseCreate: true,
    tasks: [],
    checklist: {},
  });
  try {
    const createButton = page.getByTestId("button-create-manual-pulse-task");
    for (let index = 0; index < 2; index += 1) {
      const taskId = `fixture-manual-pulse-task-${index + 1}`;
      await createButton.click();
      await page.getByTestId(`task-item-${taskId}`).waitFor();
      const creation = requests.find(request =>
        request.method === "POST" && request.path === "/api/tasks" && request.body.title === `Manual Nexus Pulse task ${index + 1}`);
      assert.deepEqual(creation?.body.pulseOrigin, {
        missionId: "fixture-mission",
        sessionId: "fixture-agent-session",
      }, "the production manual-task request carries only the selected Mission and active session as provenance evidence");
      assert.equal(creation?.body.relatedEntityType, "clinic",
        "clinic/customer linkage is retained but is not used as the Pulse provenance marker");
      const persisted = state.tasks.find(item => item.id === taskId);
      assert.ok(persisted?.tags.includes("nexus_pulse_manual"),
        "the server fixture adds the reserved manual-Pulse marker only after verifying the supplied session");
      assert.equal(persisted.createdByUserId, USER.id,
        "the creator remains assigned by the server rather than supplied by the browser");

      await page.getByTestId(`task-item-${taskId}`).click();
      await page.getByTestId("task-resolve-btn").click();
      const notify = page.getByTestId("task-notify-agent");
      assert.equal(await notify.isChecked(), true,
        "verified manual Pulse tasks default to notifying their creator");
      assert.equal(await page.getByTestId("resolution-checklist-gate").count(), 0,
        "manual Pulse provenance must not activate the Status List checklist gate");
      await page.getByTestId("resolve-text").fill(`Manual Pulse resolution ${index + 1}`);
      if (index === 0) await notify.click();
      await page.getByTestId("resolve-confirm").click();
      await page.getByTestId("resolve-text").waitFor({ state: "detached" });
      const resolveRequest = requests.find(request =>
        request.method === "POST" && request.path === `/api/tasks/${taskId}/resolve`);
      assert.equal(resolveRequest?.body.notifyAgent, index === 0 ? false : true,
        "the manual-task notification choice is persisted for both opt-out and opt-in paths");
      assert.equal(Object.hasOwn(resolveRequest?.body || {}, "userId"), false,
        "the browser never selects the notification recipient");
    }
    assert.equal(state.notifications.length, 1);
    assert.equal(state.notifications[0].userId, USER.id,
      "only the server-derived creator is notified for the opted-in manual task");
    await assertNoBrowserErrors(page, "manual Nexus Pulse task creation and creator notice");
  } finally {
    await page.close();
  }
}

async function verifyInboxLifecycle(browser, bundle) {
  const notifications = [{
    id: "fixture-persisted-pulse-notice",
    userId: USER.id,
    type: "back_office_resolved",
    title: "CARE s.r.o. Gynekológia",
    entityType: "task",
    entityId: "fixture-task-1",
    metadata: {
      source: "nexus_pulse",
      taskId: "fixture-task-1",
      taskTitle: "Persisted Pulse task resolved",
      resolution: "The client record was reviewed and the verified clinic details were saved. Follow-up was completed with the coordinator and all remaining issues were documented for the next visit.",
    },
    isRead: false,
    isDismissed: false,
    createdAt: new Date().toISOString(),
  }, {
    id: "fixture-persisted-other-notice",
    userId: USER.id,
    type: "back_office_resolved",
    title: "Ordinary Back Office task resolved",
    entityType: "task",
    entityId: "fixture-task-3",
    metadata: {
      source: "back_office",
      taskId: "fixture-task-3",
      taskTitle: "Ordinary Back Office task resolved",
      resolution: "Non-Pulse resolution",
    },
    isRead: false,
    isDismissed: false,
    createdAt: new Date(Date.now() - 1000).toISOString(),
  }];
  const boQuestions = [{
    task: clone(FIXTURE_TASKS[2]),
    question: {
      id: "fixture-question-1",
      content: "Please confirm the answer for this task.",
      createdAt: isoDay(-1),
      userId: "fixture-creator",
      userName: "Original Creator",
    },
    comments: [],
    creator: { id: "fixture-creator", fullName: "Original Creator" },
  }];
  const { page, requests, state, webSockets } = await createPage(browser, bundle, 1280, 800, {
    standaloneInbox: true,
    websocket: true,
    notifications,
    boQuestions,
  });
  try {
    const pulseCard = page.getByTestId("bo-resolved-card-fixture-persisted-pulse-notice");
    const otherCard = page.getByTestId("bo-resolved-card-fixture-persisted-other-notice");
    await pulseCard.waitFor({ state: "visible" });
    await otherCard.waitFor({ state: "visible" });
    assert.equal(await pulseCard.getByText("CARE s.r.o. Gynekológia").count(), 1,
      "a Pulse completion notice should show the verified client name in place of the generated task title");
    const resolutionPreview = pulseCard.getByTestId("bo-task-resolution-preview");
    const completeResolution = notifications[0].metadata.resolution;
    assert.equal(await resolutionPreview.getAttribute("title"), completeResolution,
      "the truncated resolution preview should expose its full text as a hover tooltip");
    assert.equal(await resolutionPreview.getAttribute("aria-label"), completeResolution,
      "the full resolution should also be available to assistive technology");
    assert.ok(await resolutionPreview.evaluate(element => element.tabIndex >= 0),
      "the full-text tooltip should also be reachable by keyboard focus");
    await page.getByTestId("bo-question-fixture-task-3").waitFor({ state: "visible" });
    await page.waitForFunction(() => window.__notificationsSocketConnected === true);
    assert.ok(webSockets.length > 0, "the real useNotifications hook should open its actual notification WebSocket");
    assert.match(await pulseCard.getAttribute("class"), /border-emerald-400/,
      "the Pulse card should use the actual existing emerald completion-card treatment");
    assert.equal(await pulseCard.locator("svg.lucide-sparkles").count(), 1,
      "the Pulse completion card should include its existing Sparkles icon");
    assert.match(await otherCard.getAttribute("class"), /border-teal-300/,
      "a non-Pulse Back Office completion should retain the standard teal completion treatment");
    assert.equal(await otherCard.locator("svg.lucide-sparkles").count(), 0,
      "a non-Pulse card should not receive the Pulse-only Sparkles icon");
    webSockets[0].send(JSON.stringify({ type: "notification", notification: notifications[0] }));
    webSockets[0].send(JSON.stringify({ type: "notification", notification: notifications[0] }));
    await page.waitForTimeout(50);
    assert.equal(await pulseCard.count(), 1, "persisted plus live event copies should deduplicate by notification id");
    const dispatchedIds = await page.evaluate(() => window.__completionEvents.map(event => event.id).sort());
    assert.deepEqual(dispatchedIds, [
      "fixture-persisted-other-notice",
      "fixture-persisted-pulse-notice",
    ], "each persisted completion should dispatch one event, and duplicate live WebSocket delivery should not redispatch either id");
    await page.screenshot({ path: path.join(PROOF_DIR, "back-office-inbox-persisted-resolutions.png") });

    assert.ok(requests.some(request => request.method === "GET" &&
      request.path === "/api/notifications" && request.search.includes("includeRead=false")),
    "the inbox should hydrate completion notices from the persisted unread notifications API");
    await page.reload();
    await page.getByTestId("bo-resolved-card-fixture-persisted-pulse-notice").waitFor({ state: "visible" });
    await page.getByTestId("bo-question-fixture-task-3").waitFor({ state: "visible" });
    assert.equal(await page.getByTestId("bo-resolved-card-fixture-persisted-pulse-notice").count(), 1,
      "unread completion cards should hydrate after remount/offline return without duplicating");

    const pulseUrl = page.url();
    assert.equal(await page.getByTestId("btn-open-completed-task-fixture-persisted-pulse-notice").count(), 0,
      "a completion notice in Nexus Pulse must not offer an Open Task redirect");
    assert.equal(await pulseCard.locator("button").count(), 1, "completion notices should have only a Close action");
    await page.getByTestId("btn-dismiss-bo-resolved-fixture-persisted-pulse-notice").click();
    await page.getByTestId("bo-resolved-card-fixture-persisted-pulse-notice").waitFor({ state: "detached" });
    assert.equal(page.url(), pulseUrl, "closing the notice must keep the agent in Nexus Pulse");
    assert.ok(requests.some(request => request.method === "PATCH" &&
      request.path === "/api/notifications/fixture-persisted-pulse-notice/dismiss"),
    "closing the Pulse card should persist dismissal");
    await page.getByTestId("btn-dismiss-bo-resolved-fixture-persisted-other-notice").click();
    await page.getByTestId("bo-resolved-card-fixture-persisted-other-notice").waitFor({ state: "detached" });
    assert.ok(requests.some(request => request.method === "PATCH" &&
      request.path === "/api/notifications/fixture-persisted-other-notice/dismiss"),
    "dismissing the other resolution card should persist dismissal");
    assert.equal(state.notifications.find(item => item.id === "fixture-persisted-pulse-notice").isDismissed, true);
    assert.equal(state.notifications.find(item => item.id === "fixture-persisted-other-notice").isDismissed, true);
    assert.equal(await page.getByTestId("bo-question-fixture-task-3").count(), 1,
      "acknowledging completion cards must preserve the existing Back Office Questions inbox item");
    await page.reload();
    await page.getByTestId("bo-question-fixture-task-3").waitFor({ state: "visible" });
    assert.equal(await page.getByTestId("bo-resolved-card-fixture-persisted-pulse-notice").count(), 0,
      "a closed Pulse notice must stay closed after reload");
    assert.equal(page.url(), pulseUrl, "notification dismissal must never redirect on reload");
    await assertNoBrowserErrors(page, "persisted Back Office completion inbox");
  } finally {
    await page.close();
  }

  const foreignSession = await createPage(browser, bundle, 1280, 800, {
    standaloneInbox: true,
    websocket: true,
    user: { ...USER, id: "fixture-other", username: "other.agent", fullName: "Other Agent", role: "user" },
    notifications,
    boQuestions,
  });
  try {
    await foreignSession.page.getByTestId("bo-question-fixture-task-3").waitFor({ state: "visible" });
    await foreignSession.page.waitForFunction(() => window.__notificationsSocketConnected === true);
    assert.ok(foreignSession.webSockets.length > 0);
    assert.equal(await foreignSession.page.getByTestId("bo-resolved-card-fixture-persisted-pulse-notice").count(), 0,
      "an unread completion notice owned by another user must not leak across auth sessions");
    foreignSession.webSockets[0].send(JSON.stringify({ type: "notification", notification: notifications[0] }));
    await foreignSession.page.waitForTimeout(50);
    assert.equal(await foreignSession.page.getByTestId("bo-resolved-card-fixture-persisted-pulse-notice").count(), 0,
      "live completion events for a different user must also be ignored by the inbox");
    assert.equal(await foreignSession.page.evaluate(() => window.__completionEvents.length), 0,
      "a foreign-user WebSocket payload must not dispatch an inbox event");
    await assertNoBrowserErrors(foreignSession.page, "cross-session completion notice boundary");
  } finally {
    await foreignSession.page.close();
  }
}

async function verifyPulseEditCompletionSuccess(browser, bundle) {
  const { page, requests, state } = await createPage(browser, bundle);
  try {
    await page.getByTestId("task-subtab-all").click();
    await page.getByTestId("task-item-fixture-task-1").click();
    await page.getByTestId("task-action-edit").click();
    await chooseEditSelect(page, 1, "completed");
    await page.getByTestId("edit-task-resolution").fill("Completed through edit");
    await page.getByTestId("edit-task-notify-agent").click();
    await chooseOption(page, "edit-task-group", "fixture-back-office");
    await page.getByTestId("edit-task-save").click();
    await page.waitForFunction(() => document.querySelector('[data-testid="edit-task-title"]') === null);
    const patch = requests.filter(request =>
      request.method === "PATCH" && request.path === "/api/tasks/fixture-task-1").at(-1);
    assert.equal(patch?.body.status, "completed");
    assert.equal(patch?.body.resolution, "Completed through edit");
    assert.equal(patch?.body.notifyAgent, false);
    assert.deepEqual(patch?.body.tags.sort(), ["group_id:fixture-back-office", "source_keep", "status_list"].sort(),
      "edit-completion should preserve source/Status List tags while changing group_id");
    assert.equal(state.tasks.find(item => item.id === "fixture-task-1").status, "completed");
    await assertNoBrowserErrors(page, "Pulse edit completion");
  } finally {
    await page.close();
  }
}

async function verifyGroupEditorReachability(browser, bundle, width, height) {
  const { page } = await createPage(browser, bundle, width, height);
  try {
    await page.getByTestId("btn-task-groups-nexus").click();
    await page.getByTestId("dialog-task-groups").waitFor({ state: "visible" });
    await page.getByTestId("btn-create-group").click();
    await page.getByTestId("input-group-name").waitFor({ state: "visible" });
    const measureButtons = async () => {
      const results = {};
      for (const testId of ["btn-cancel-group", "btn-save-group"]) {
        results[testId] = await page.getByTestId(testId).evaluate(element => {
          const rect = element.getBoundingClientRect();
          return {
            x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom,
            width: rect.width, height: rect.height,
            viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
          };
        });
      }
      return results;
    };
    const createEditor = await measureButtons();
    await page.screenshot({ path: path.join(PROOF_DIR, `group-editor-create-${width}x${height}.png`) });
    const reachable = result => Object.values(result).every(bounds =>
      bounds.width > 0 && bounds.height > 0 && bounds.x >= 0 && bounds.y >= 0
      && bounds.right <= bounds.viewportWidth && bounds.bottom <= bounds.viewportHeight);
    if (reachable(createEditor)) {
      await page.getByTestId("btn-cancel-group").click();
      await page.getByTestId("btn-create-group").waitFor({ state: "visible" });
    } else {
      // Escape closes the pristine editor so this viewport can also record
      // whether the edit-mode footer is reachable without force-clicking.
      await page.keyboard.press("Escape");
      await page.getByTestId("dialog-task-groups").waitFor({ state: "hidden" });
      await page.getByTestId("btn-task-groups-nexus").click();
      await page.getByTestId("dialog-task-groups").waitFor({ state: "visible" });
    }
    await page.getByTestId("btn-edit-group-fixture-ops").click();
    await page.getByTestId("input-group-name").waitFor({ state: "visible" });
    const editEditor = await measureButtons();
    await page.screenshot({ path: path.join(PROOF_DIR, `group-editor-edit-${width}x${height}.png`) });
    const editReachable = reachable(editEditor);
    if (editReachable) {
      await page.getByTestId("btn-cancel-group").click();
    } else {
      await page.keyboard.press("Escape");
    }
    const failures = [];
    if (!reachable(createEditor)) failures.push("create");
    if (!editReachable) failures.push("edit");
    assert.deepEqual(failures, [],
      `group editor Save/Cancel controls must be reachable without masking at ${width}x${height}; create=${JSON.stringify(createEditor)} edit=${JSON.stringify(editEditor)}`);
    return { width, height, createEditor, editEditor };
  } finally {
    await page.close();
  }
}

async function verifyGroupModal(browser, bundle) {
  const { page, requests, state } = await createPage(browser, bundle, 1280, 1200);
  try {
    const workspaceUrlBeforeSettings = page.url();
    await page.getByTestId("btn-task-groups-nexus").click();
    const dialog = page.getByTestId("dialog-task-groups");
    await dialog.waitFor({ state: "visible" });
    assert.equal(page.url(), workspaceUrlBeforeSettings,
      "opening the gear dialog must not navigate away from the current email/tasks route");
    for (const selector of [
      "task-group-card-fixture-ops",
      "task-group-card-fixture-back-office",
      "btn-create-group",
    ]) await page.getByTestId(selector).waitFor({ state: "visible" });

    // Create uses the actual dialog controls and the real API contract. Search
    // is tested both ways, including the clear/reset path and multiple users.
    await page.getByTestId("btn-create-group").click();
    await page.getByTestId("input-group-name").fill("Browser Created Team");
    await page.getByTestId("input-group-description").fill("Created by the focused browser regression");
    await page.getByTestId("input-group-alias").fill("Browser Team");
    await page.getByTestId("input-member-search").fill("Other Agent");
    await page.getByTestId("member-toggle-fixture-other").click();
    await page.getByTestId("input-member-search").fill("");
    await page.getByTestId("input-member-search").fill("Original Creator");
    await page.getByTestId("member-toggle-fixture-creator").click();
    assert.equal(await page.getByTestId("chip-member-fixture-other").count(), 1,
      "group membership should permit selecting one active Indexus user");
    assert.equal(await page.getByTestId("chip-member-fixture-creator").count(), 1,
      "group membership should be multi-select, not a single-user picker");
    await page.getByTestId("input-member-search").fill("");
    await page.getByTestId("btn-clear-members").click();
    assert.equal(await page.getByTestId("badge-member-count").innerText(), "0",
      "Clear members should clear every selected user");
    await page.getByTestId("input-member-search").fill("Other Agent");
    await page.getByTestId("member-toggle-fixture-other").click();
    await page.getByTestId("input-member-search").fill("");
    await page.getByTestId("member-toggle-fixture-creator").click();
    state.failGroupMutation = true;
    await page.getByTestId("btn-save-group").click();
    await dialog.locator('[role="alert"]').filter({ hasText: "Fixture group mutation failed" }).waitFor({ state: "visible" });
    assert.equal(await page.getByTestId("input-group-name").inputValue(), "Browser Created Team",
      "a failed create should keep the editor open and preserve the user's form");
    await page.getByTestId("btn-save-group").click();
    await page.getByTestId("task-group-card-fixture-created-group").waitFor({ state: "visible" });
    const createRequest = requests.find(request => request.method === "POST" && request.path === "/api/task-groups");
    assert.equal(createRequest?.body.name, "Browser Created Team");
    assert.equal(createRequest?.body.displayAlias, "Browser Team");
    assert.deepEqual([...createRequest.body.memberUserIds].sort(), ["fixture-creator", "fixture-other"]);
    assert.ok(requests.filter(request => request.method === "POST" && request.path === "/api/task-groups").length === 2,
      "retry should submit the same create through the API rather than silently dismissing the error");
    await page.screenshot({ path: path.join(PROOF_DIR, "groups-created-retried.png") });

    await page.getByTestId("btn-edit-group-fixture-ops").click();
    await page.getByTestId("chip-member-fixture-inactive").waitFor({ state: "visible" });
    assert.ok(await page.getByTestId("member-toggle-fixture-inactive").isVisible(),
      "a selected inactive historical user should remain represented in the edit view");
    assert.ok(await dialog.getByRole("status").count() > 0,
      "the inactive member should be accompanied by the preservation warning");
    await page.getByTestId("input-member-search").fill("no such active member");
    await page.getByTestId("text-no-members").waitFor({ state: "visible" });
    await page.getByTestId("input-member-search").fill("");
    await page.getByTestId("member-toggle-fixture-other").waitFor({ state: "visible" });
    await page.getByTestId("input-group-alias").fill("Ops Edited");
    state.failGroupMutation = true;
    await page.getByTestId("btn-save-group").click();
    await dialog.locator('[role="alert"]').filter({ hasText: "Fixture group mutation failed" }).waitFor({ state: "visible" });
    assert.equal(await page.getByTestId("input-group-alias").inputValue(), "Ops Edited",
      "a failed group update should keep the editor open and retain dirty values");
    await page.getByTestId("btn-save-group").click();
    await page.getByTestId("task-group-card-fixture-ops").waitFor({ state: "visible" });
    const editRequest = requests.filter(request =>
      request.method === "PUT" && request.path === "/api/task-groups/fixture-ops").at(-1);
    assert.equal(editRequest?.body.displayAlias, "Ops Edited");
    assert.ok(editRequest?.body.memberUserIds.includes("fixture-inactive"),
      "the group edit payload must retain the inactive user id");
    assert.ok(state.groups.find(group => group.id === "fixture-ops").members.some(member => member.userId === "fixture-inactive"),
      "saving other group edits must preserve the inactive historical membership");

    await page.getByTestId("btn-edit-group-fixture-ops").click();
    await page.getByTestId("input-group-alias").fill("Unsaved alias");
    await page.getByTestId("btn-cancel-group").click();
    let confirmation = page.getByRole("alertdialog");
    await confirmation.waitFor({ state: "visible" });
    await confirmation.getByRole("button").first().click();
    assert.equal(await page.getByTestId("input-group-alias").inputValue(), "Unsaved alias",
      "canceling the discard confirmation should keep the dirty editor and edits open");
    await page.getByTestId("btn-cancel-group").click();
    confirmation = page.getByRole("alertdialog");
    await confirmation.getByRole("button").last().click();
    await page.getByTestId("btn-create-group").waitFor({ state: "visible" });
    assert.equal(await page.getByTestId("input-group-alias").count(), 0,
      "confirming discard should close the dirty editor without saving");

    await page.getByTestId("btn-delete-group-fixture-created-group").click();
    confirmation = page.getByRole("alertdialog");
    await confirmation.waitFor({ state: "visible" });
    await confirmation.getByRole("button").first().click();
    await page.getByTestId("task-group-card-fixture-created-group").waitFor({ state: "visible" });
    assert.equal(requests.filter(request =>
      request.method === "DELETE" && request.path === "/api/task-groups/fixture-created-group").length, 0,
    "canceling the delete confirmation must not issue a delete request");
    await page.getByTestId("btn-delete-group-fixture-created-group").click();
    confirmation = page.getByRole("alertdialog");
    state.failGroupMutation = true;
    await confirmation.getByRole("button").last().click();
    await confirmation.getByText("Fixture group mutation failed").waitFor({ state: "visible" });
    assert.equal(await confirmation.isVisible(), true, "delete API failure should keep its confirmation open for retry");
    await confirmation.getByRole("button").last().click();
    await page.getByTestId("task-group-card-fixture-created-group").waitFor({ state: "detached" });
    assert.equal(requests.filter(request =>
      request.method === "DELETE" && request.path === "/api/task-groups/fixture-created-group").length, 2,
    "delete should require confirmation and remain retryable after an API error");

    const advanced = dialog.locator("details");
    await advanced.locator("summary").click();
    await dialog.locator("details[open]").waitFor({ state: "visible" });
    const sections = dialog.locator("details[open] section");
    assert.equal(await sections.count(), 4,
      "advanced settings should retain global plus admin/manager/user group-order sections");
    const globalMove = sections.nth(0).locator("ol > li").first().getByRole("button").nth(1);
    await globalMove.click();
    await page.waitForFunction(() => document.querySelector('[data-testid="dialog-task-groups"]') !== null);
    assert.ok(requests.some(request => request.method === "PUT" && request.path === "/api/task-groups-reorder"),
      "the advanced global group ordering should remain functional");
    const managerMove = sections.nth(2).locator("ol > li").first().getByRole("button").nth(1);
    await managerMove.click();
    assert.ok(requests.roleGroupOrders?.some(order => order.role === "manager"),
      "the advanced manager-specific group order should remain functional");

    // A normal non-admin account is expected to retain list/read access only.
    const readonly = await createPage(browser, bundle, 1280, 1200, {
      user: { ...USER, role: "user" },
    });
    try {
      await readonly.page.getByTestId("btn-task-groups-nexus").click();
      await readonly.page.getByTestId("dialog-task-groups").waitFor({ state: "visible" });
      await readonly.page.getByTestId("task-group-card-fixture-ops").waitFor();
      assert.equal(await readonly.page.getByTestId("btn-create-group").count(), 0,
        "a read-only account should not receive group create permission");
      assert.equal(await readonly.page.getByTestId("btn-edit-group-fixture-ops").count(), 0,
        "a read-only account should not receive group edit permission");
      assert.equal(await readonly.page.getByTestId("btn-delete-group-fixture-ops").count(), 0,
        "a read-only account should not receive group delete permission");
      assert.equal(await readonly.page.getByTestId("dialog-task-groups").getByRole("status").count(), 1,
        "read-only accounts should be told group management is read-only");
    } finally {
      await readonly.page.close();
    }
    await page.screenshot({ path: path.join(PROOF_DIR, "groups-advanced-ordering.png") });
    await assertNoBrowserErrors(page, "group CRUD, permissions, and ordering");

    const manager = await createPage(browser, bundle, 1280, 1200, {
      user: { ...USER, role: "manager" },
    });
    try {
      await manager.page.getByTestId("btn-task-groups-nexus").click();
      const managerDialog = manager.page.getByTestId("dialog-task-groups");
      await managerDialog.waitFor({ state: "visible" });
      await manager.page.getByTestId("task-group-card-fixture-ops").waitFor();
      assert.equal(await manager.page.getByTestId("btn-create-group").count(), 1,
        "managers should retain the established ability to create groups");
      assert.equal(await manager.page.getByTestId("btn-edit-group-fixture-ops").count(), 1,
        "managers should retain the established ability to edit groups");
      assert.equal(await manager.page.getByTestId("btn-delete-group-fixture-ops").count(), 1,
        "managers should retain the established ability to delete groups");
      assert.equal(await managerDialog.getByRole("status").count(), 0,
        "the manager role should not receive the read-only explanation");
    } finally {
      await manager.page.close();
    }
  } finally {
    await page.close();
  }
}

async function verifyAutomaticAiChecklist(browser, bundle, width, height, failFirst = false) {
  const { page, state, requests } = await createPage(browser, bundle, width, height, {
    aiChecklist: true, failAiChecklist: failFirst,
  });
  try {
    await page.getByTestId("task-item-fixture-task-1").click();
    if (failFirst) {
      await page.getByTestId("button-checklist-ai-retry-fixture-task-1").waitFor({ timeout: 15000 });
      assert.equal(state.aiChecklistCalls, 1, "AI failures must not automatically loop");
      await page.getByTestId("button-checklist-ai-retry-fixture-task-1").click();
    }
    await page.getByTestId("checklist-item-ai-step-1").waitFor({ timeout: 15000 });
    assert.equal(state.aiChecklistCalls, failFirst ? 2 : 1);
    assert.equal(state.checklist["fixture-task-1"].length, 3);
    assert.ok(state.checklist["fixture-task-1"].every(item => !item.required && !item.doneAt));
    await page.getByTestId("button-toggle-ai-step-1").click();
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="button-toggle-ai-step-1"]')?.getAttribute("aria-pressed") === "true");
    assert.ok(state.checklist["fixture-task-1"][0].doneAt, "tick must persist through the checklist API");
    await page.getByTestId("button-edit-checklist-ai-step-2").click();
    await page.getByTestId("input-edit-checklist-ai-step-2").fill("Overiť údaje v oficiálnom registri");
    await page.getByTestId("button-save-checklist-ai-step-2").click();
    await page.getByTestId("checklist-item-ai-step-2").getByText("Overiť údaje v oficiálnom registri").waitFor();
    assert.equal(state.checklist["fixture-task-1"][1].label, "Overiť údaje v oficiálnom registri");
    await page.screenshot({ path: path.join(PROOF_DIR, `ai-checklist-${width}${failFirst ? "-retry" : ""}.png`) });
    for (const id of ["ai-step-1", "ai-step-2", "ai-step-3"]) {
      await page.getByTestId(`button-delete-checklist-${id}`).click();
      await page.getByTestId(`checklist-item-${id}`).waitFor({ state: "detached" });
    }
    await page.getByTestId("input-checklist-add-fixture-task-1").fill("Vlastný krok riešiteľa");
    await page.getByTestId("button-checklist-add-fixture-task-1").click();
    await page.getByText("Vlastný krok riešiteľa", { exact: true }).waitFor();
    assert.equal(state.aiChecklistCalls, failFirst ? 2 : 1, "deleting suggestions must not regenerate them");
    const starts = requests.filter(request => request.method === "POST" && request.path.endsWith("/checklist/ai"));
    if (failFirst) assert.equal(starts[1].body.retry, true);
    await assertNoBrowserErrors(page, "AI checklist actions");
  } finally {
    await page.close();
  }
}

async function verifyAiChecklistPreservesManualAndReadOnly(browser, bundle) {
  for (const readOnly of [false, true]) {
    const options = readOnly
      ? { aiChecklist: true, tasks: [task("fixture-task-1", { status: "completed" })] }
      : { aiChecklist: true, checklist: { "fixture-task-1": [{
        id: "existing-manual", label: "Pôvodný manuálny krok", required: true, doneAt: null, position: 0,
      }] } };
    const { page, state } = await createPage(browser, bundle, 1280, 800, options);
    try {
      if (readOnly) await page.getByTestId("task-subtab-all").click();
      await page.getByTestId("task-item-fixture-task-1").click();
      if (!readOnly) await page.getByTestId("checklist-item-existing-manual").waitFor();
      await page.waitForLoadState("networkidle");
      assert.equal(state.aiChecklistCalls, 0, "manual and completed checklists must not trigger generation");
      await assertNoBrowserErrors(page, "preserved AI checklist");
    } finally {
      await page.close();
    }
  }
}

async function verifyTaskElapsedAndOverdue(browser, bundle, width, height) {
  const fixture = task("fixture-task-1", { dueDate: isoDay(-1) });
  const { page, state } = await createPage(browser, bundle, width, height, { tasks: [fixture] });
  try {
    await page.getByTestId("task-item-fixture-task-1").click();
    const detail = page.locator(".nexus-signal-detail");
    await detail.getByTestId("task-overdue-fixture-task-1").waitFor();
    assert.equal(await detail.getByTestId("task-time-fixture-task-1").count(), 0, "pending task must not invent a start");
    await page.getByTestId("task-action-start").click();
    const timer = detail.getByTestId("task-time-fixture-task-1");
    await timer.waitFor();
    const startedAt = state.tasks[0].workStartedAt;
    assert.ok(startedAt, "start must use the persisted server timestamp");
    const firstText = (await timer.textContent()).trim();
    await page.waitForFunction(({ selector, original }) => {
      const element = document.querySelector(selector);
      return element && element.textContent.trim() !== original;
    }, { selector: '.nexus-signal-detail [data-testid="task-time-fixture-task-1"]', original: firstText }, { timeout: 5000 });
    const timerBounds = await timer.boundingBox();
    assert.ok(timerBounds && timerBounds.x >= 0 && timerBounds.x + timerBounds.width <= width,
      "elapsed clock must fit the viewport");
    await page.screenshot({ path: path.join(PROOF_DIR, `task-timer-overdue-${width}.png`) });
    await page.reload();
    await page.getByTestId("tab-tasks").click();
    await page.getByTestId("task-subtab-all").click();
    await page.getByTestId("task-item-fixture-task-1").click();
    await detail.getByTestId("task-time-fixture-task-1").waitFor();
    assert.equal(state.tasks[0].workStartedAt, startedAt, "reload must not restart the timer");
    await page.getByTestId("task-action-cancel").click();
    await page.getByTestId("button-confirm-cancel-task").click();
    await page.waitForFunction(() => !document.querySelector('.nexus-signal-detail [data-testid="task-overdue-fixture-task-1"]'));
    assert.ok(state.tasks[0].workStoppedAt, "terminal status must persist stopped time");
    const stoppedText = await detail.getByTestId("task-time-fixture-task-1").innerText();
    await page.waitForTimeout(1200);
    assert.equal(await detail.getByTestId("task-time-fixture-task-1").innerText(), stoppedText,
      "cancelled task's elapsed duration must stay frozen");
    await assertNoBrowserErrors(page, "task elapsed and overdue indicators");
  } finally {
    await page.close();
  }
}

async function verifyTaskRequestBrief(browser, bundle, width, height, standaloneTasks = false) {
  const requestedAction = "Prosím zmeniť názov kliniky.\nOveriť správne údaje a priložiť potvrdenie.";
  const description = `Vzorková klinika\nI request the following customer data change:${requestedAction}`;
  const { page, state } = await createPage(browser, bundle, width, height, {
    standaloneTasks,
    tasks: [task("fixture-task-1", { title: "Úprava údajov kliniky", description })],
  });
  try {
    await page.getByTestId(standaloneTasks ? "task-details-fixture-task-1" : "task-item-fixture-task-1").click();
    const brief = page.getByTestId("task-request-brief-fixture-task-1");
    const request = page.getByTestId("task-request-text-fixture-task-1");
    await request.waitFor();
    assert.equal((await request.textContent()).trim(), requestedAction,
      "the real submitter's request must be featured without the entity/template boilerplate");
    const bounds = await request.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width,
      "the readable request must fit both desktop and mobile");
    assert.equal(await request.evaluate(element => element.scrollWidth <= element.clientWidth), true,
      "the request must wrap instead of clipping horizontally");
    await page.screenshot({ path: path.join(PROOF_DIR, `task-request-brief-${standaloneTasks ? "standalone-" : ""}${width}.png`) });
    await page.getByTestId("button-task-request-original-fixture-task-1").click();
    assert.ok((await brief.textContent()).includes(description),
      "the complete original task description must remain available");
    assert.equal(state.tasks[0].description, description,
      "presentation must not rewrite saved task data");
    await assertNoBrowserErrors(page, "submitter request presentation");
  } finally {
    await page.close();
  }
}

async function verifyTaskWorkLayout(browser, bundle, width, height, dark = false) {
  const labels = [
    "Overiť údaje kliniky a porovnať názov, adresu a kontaktnú osobu s priloženými podkladmi pred vykonaním akejkoľvek zmeny.",
    "Skontrolovať chýbajúce informácie a spísať konkrétne otázky pre zadávateľa, aby nebolo potrebné dohľadávať ďalšie údaje.",
    "Konzultovať nezrovnalosti s obchodným oddelením a zaznamenať dohodnuté riešenie do komentára k úlohe.",
    "Pripraviť opravu údajov a overiť, že zachováva správne priradenie kliniky a históriu predchádzajúcej komunikácie.",
    "Skontrolovať výsledok a doplniť stručné vysvetlenie vykonaných zmien pre zadávateľa pred vyriešením úlohy.",
  ];
  const items = labels.map((label, position) => ({
    id: `work-layout-step-${position + 1}`, label, position, required: false, doneAt: null, doneByUserId: null,
  }));
  const { page, state } = await createPage(browser, bundle, width, height, {
    dark,
    emptyComments: true,
    tasks: [task("fixture-task-1", {
      title: "Overenie a oprava údajov kliniky",
      description: "Vzorková klinika\nI request the following customer data change:Prosím zmeniť názov a overiť kontaktné údaje podľa podkladov.",
    })],
    checklist: { "fixture-task-1": items },
    aiChecklistStatus: { "fixture-task-1": "generated" },
  });
  try {
    await page.getByTestId("task-item-fixture-task-1").click();
    const request = page.getByTestId("task-request-brief-fixture-task-1");
    const checklist = page.getByTestId("checklist-fixture-task-1");
    await checklist.waitFor();
    const body = page.locator(".nexus-signal-detail-body");
    const bodyBounds = await body.boundingBox();
    const requestBounds = await request.boundingBox();
    const checklistBounds = await checklist.boundingBox();
    const threadBounds = await page.locator(".task-comments-preview").boundingBox();
    assert.ok(bodyBounds && requestBounds && checklistBounds && threadBounds);
    assert.ok(requestBounds.width >= bodyBounds.width * 0.85,
      "the submitter's request must span the detail width instead of being buried in a narrow column");
    assert.ok(requestBounds.y + requestBounds.height <= checklistBounds.y + 2,
      "the request must appear above the procedure");
    if (Math.abs(checklistBounds.y - threadBounds.y) < 30) {
      assert.ok(checklistBounds.width > threadBounds.width,
        "the procedure must be wider than the secondary comments when laid out side by side");
    } else {
      assert.ok(threadBounds.y >= checklistBounds.y,
        "stacked comments must remain secondary and below the procedure");
    }
    assert.equal(await body.evaluate(element => element.scrollWidth <= element.clientWidth), true,
      "the detail must not overflow horizontally");
    for (const item of items) {
      const row = page.getByTestId(`checklist-item-${item.id}`);
      const text = row.getByText(item.label, { exact: true });
      const textBounds = await text.boundingBox();
      assert.ok(textBounds && textBounds.width >= 140,
        "long recommendation text needs usable reading width rather than a word-per-line strip");
      assert.equal(await text.evaluate(element => element.scrollWidth <= element.clientWidth + 1), true,
        "long steps must wrap without horizontal clipping");
    }
    const progress = page.getByTestId("checklist-progress-fixture-task-1");
    assert.equal(await progress.getAttribute("role"), "progressbar");
    assert.equal(Number(await progress.getAttribute("aria-valuenow")), 0);
    await page.screenshot({ path: path.join(PROOF_DIR, `task-work-layout-${width}-${height}${dark ? "-dark" : ""}.png`) });
    await page.getByTestId("button-toggle-work-layout-step-1").click();
    await page.waitForFunction(selector => {
      const element = document.querySelector(selector);
      const ratio = Number(element?.getAttribute("aria-valuenow")) / Number(element?.getAttribute("aria-valuemax"));
      return ratio >= 0.19 && ratio <= 0.21;
    }, '[data-testid="checklist-progress-fixture-task-1"]');
    assert.ok(state.checklist["fixture-task-1"][0].doneAt, "checking a step must still save through the real mutation path");
    await page.getByTestId("input-checklist-add-fixture-task-1").fill("Doplniť ručný krok po kontrole");
    await page.getByTestId("button-checklist-add-fixture-task-1").click();
    await page.getByText("Doplniť ručný krok po kontrole", { exact: true }).waitFor();
    await page.getByTestId("button-open-task-comments").click();
    await page.getByTestId("input-task-comment").fill("Údaje overené, pripravujem opravu.");
    await page.getByTestId("button-add-comment").click();
    await page.getByTestId("dialog-task-comments").getByText("Údaje overené, pripravujem opravu.", { exact: true }).waitFor();
    assert.equal(state.comments.length, 1, "the secondary comment composer must remain functional and reachable");
    await assertNoBrowserErrors(page, "redesigned task work layout");
  } finally {
    await page.close();
  }
}

async function verifyCommentsHistoryModal(browser, bundle, width, height, standaloneTasks = false, dark = false) {
  const comments = Array.from({ length: 48 }, (_, index) => ({
    id: `fixture-history-${index}`,
    taskId: "fixture-task-1",
    userId: index % 2 ? "fixture-other" : USER.id,
    content: `História komentára ${index + 1}: overenie údajov a zaznamenané riešenie.`,
    createdAt: new Date(Date.parse(isoDay(-1)) + index * 60000).toISOString(),
    metadata: { attachments: index === 0 ? [{
      id: "fixture-preview-image",
      name: "Kontrola údajov.png",
      type: "image/png",
      url: "/api/tasks/attachments/fixture-preview-image",
      size: 68,
    }] : [] },
  }));
  const { page, state } = await createPage(browser, bundle, width, height, {
    comments, standaloneTasks, dark, emptyComments: true,
  });
  try {
    await page.getByTestId(standaloneTasks ? "task-details-fixture-task-1" : "task-item-fixture-task-1").click();
    const preview = page.locator(".task-comments-preview");
    await preview.getByText(comments[47].content, { exact: true }).waitFor();
    assert.equal(await preview.getByTestId("input-task-comment").count(), 0,
      "the sidebar must preview comments rather than retain an inline composer");
    await page.getByTestId("button-open-task-comments").click();
    const modal = page.getByTestId("dialog-task-comments");
    await modal.waitFor();
    assert.equal(await modal.locator('[data-testid^="task-comment-fixture-history-"]').count(), 48,
      "the modal must render the complete history, not only the sidebar's recent preview");
    const bounds = await modal.boundingBox();
    const send = await modal.getByTestId("button-add-comment").boundingBox();
    assert.ok(bounds && bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1,
      "comments modal must be bounded by the viewport");
    assert.ok(send && send.y >= bounds.y && send.y + send.height <= height + 1,
      "the send action must be visible even with a long history");
    await modal.getByTestId("input-task-comment").fill("Rozpísaná odpoveď agentovi");
    const sendContrast = await modal.getByTestId("button-add-comment").evaluate((button) => {
      const style = getComputedStyle(button);
      const luminance = (color) => {
        const channels = color.match(/[\d.]+/g).slice(0, 3).map(value => {
          const channel = Number(value) / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    assert.ok(sendContrast >= 4.5, `send button contrast must remain readable: ${sendContrast}`);
    await page.screenshot({ path: path.join(PROOF_DIR, `comments-timeline-${width}-${height}${standaloneTasks ? "-standalone" : ""}${dark ? "-dark" : ""}.png`) });
    const imageComment = modal.getByTestId("task-comment-fixture-history-0");
    await imageComment.getByRole("button", { name: /Kontrola údajov\.png$/ }).click();
    const previewImage = modal.locator('img[src^="/api/tasks/attachments/fixture-preview-image"]');
    await previewImage.waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('img[src^="/api/tasks/attachments/fixture-preview-image"]')]
        .some(image => image.complete && image.naturalWidth > 0));
    assert.equal(await modal.getByTestId("input-task-comment").inputValue(), "Rozpísaná odpoveď agentovi",
      "viewing an attachment must not erase the draft");
    await page.screenshot({ path: path.join(PROOF_DIR, `comments-history-${width}-${height}${standaloneTasks ? "-standalone" : ""}${dark ? "-dark" : ""}.png`) });
    await page.keyboard.press("Escape");
    if (await modal.isVisible()) await page.keyboard.press("Escape");
    await modal.waitFor({ state: "hidden" });
    if (standaloneTasks) {
      assert.equal(await page.getByRole("dialog").count(), 1,
        "closing the nested comments modal must leave the standalone task details open");
    }
    await page.getByTestId("button-open-task-comments").click();
    assert.equal(await modal.getByTestId("input-task-comment").inputValue(), "Rozpísaná odpoveď agentovi",
      "ordinary close/reopen must preserve the task's draft");
    await modal.getByTestId("delete-comment-fixture-history-0").click();
    await modal.getByTestId("task-comment-fixture-history-0").waitFor({ state: "detached" });
    assert.equal(state.comments.length, 47);
    assert.equal(await modal.getByTestId("delete-comment-fixture-history-1").count(), 0,
      "the owner-only delete affordance must not be exposed for another author");
    await modal.getByTestId("button-add-comment").click();
    await modal.getByText("Rozpísaná odpoveď agentovi", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await preview.getByText("Rozpísaná odpoveď agentovi", { exact: true }).waitFor();
    await assertNoBrowserErrors(page, "modern full comment history and nested modal");
  } finally {
    await page.close();
  }
}

async function verifyCommentsComposerPendingLifecycle(browser, bundle) {
  const { page, state, requests } = await createPage(browser, bundle, 390, 844, {
    emptyComments: true, holdAttachmentUploads: true, holdCommentPosts: true,
  });
  try {
    await page.getByTestId("task-item-fixture-task-1").click();
    await page.getByTestId("button-open-task-comments").click();
    const modal = page.getByTestId("dialog-task-comments");
    const input = modal.getByTestId("input-task-comment");
    await input.fill("Odpoveď pripravená počas nahrávania");
    await modal.getByTestId("input-task-attachment-files").setInputFiles({
      name: "Prerušená_príloha.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4"),
    });
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="button-add-comment"]')?.disabled === true);
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "hidden" });
    await page.getByTestId("button-open-task-comments").click();
    assert.equal(await input.inputValue(), "Odpoveď pripravená počas nahrávania");
    assert.equal(await modal.getByTestId("button-add-comment").isDisabled(), false,
      "aborting an upload on close must not leave send permanently disabled on reopen");
    state.releaseUploads();
    await modal.getByTestId("button-add-comment").click();
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="input-task-comment"]')?.disabled === true);
    assert.equal(await modal.getByTestId("input-task-attachment-files").isDisabled(), true,
      "a pending send must not accept draft changes that its success callback would erase");
    assert.equal(requests.filter(request => request.method === "POST" && request.path.endsWith("/comments")).length, 1);
    state.releaseComments();
    await modal.getByText("Odpoveď pripravená počas nahrávania", { exact: true }).waitFor();
    assert.equal(await input.inputValue(), "");
    assert.equal(state.comments.length, 1);
    assert.equal(state.comments[0].metadata.attachments.length, 0,
      "the aborted upload must not appear in the sent comment");
    await assertNoBrowserErrors(page, "comment upload and pending-submit lifecycle");
  } finally {
    state.releaseUploads?.();
    state.releaseComments?.();
    await page.close();
  }
}

async function verifyCommentsUploadRecoveryAndBounds(browser, bundle) {
  const { page, state } = await createPage(browser, bundle, 390, 844, { emptyComments: true });
  try {
    await page.getByTestId("task-item-fixture-task-1").click();
    await page.getByTestId("button-open-task-comments").click();
    const modal = page.getByTestId("dialog-task-comments");
    const input = modal.getByTestId("input-task-comment");
    await input.fill("Text s prílohami zostáva pripravený.");
    await modal.getByTestId("input-task-attachment-files").setInputFiles({
      name: "Príloha_nad_limitom.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(16 * 1024 * 1024),
    });
    await modal.getByTestId("task-attachment-error").waitFor();
    assert.equal(await modal.getByTestId("button-add-comment").isDisabled(), true);
    await modal.getByTestId("button-dismiss-task-attachment-error").click();
    assert.equal(await modal.getByTestId("button-add-comment").isDisabled(), false,
      "discarding the rejected file must recover sending the retained draft");
    const files = Array.from({ length: 11 }, (_, index) => ({
      name: `${String(index).padStart(2, "0")}_${"Podklady_pre_overenie_údajov_a_vysvetlenie_zmeny_".repeat(2)}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4"),
    }));
    await modal.getByTestId("input-task-attachment-files").setInputFiles(files);
    await modal.getByTestId("chip-task-attachment-9").waitFor();
    await modal.getByTestId("task-attachment-error").waitFor();
    await modal.getByTestId("button-dismiss-task-attachment-error").click();
    assert.equal(await modal.locator('[data-testid^="chip-task-attachment-"]').count(), 10,
      "discarding the excess file must preserve the ten successful uploads");
    const sendBounds = await modal.getByTestId("button-add-comment").boundingBox();
    assert.ok(sendBounds && sendBounds.y >= 0 && sendBounds.y + sendBounds.height <= 844,
      "long attachment chips must not push the send action outside the mobile modal");
    assert.equal(await input.evaluate(element => getComputedStyle(element).resize), "none",
      "manual textarea resizing must not hide the non-scrolling footer");
    await page.screenshot({ path: path.join(PROOF_DIR, "comments-mobile-many-attachments.png") });
    await modal.getByTestId("button-add-comment").click();
    await modal.getByText("Text s prílohami zostáva pripravený.", { exact: true }).waitFor();
    assert.equal(state.comments[0].metadata.attachments.length, 10);
    await assertNoBrowserErrors(page, "comment upload recovery and bounded composer");
  } finally { await page.close(); }
}

async function verifyOrdinaryTaskAutomaticResolution(browser, bundle, standaloneTasks = false) {
  const taskId = "fixture-task-2";
  const draft = "The verified address was updated. Final confirmation is still pending.";
  const { page, requests, state } = await createPage(browser, bundle, 1280, 800, {
    standaloneTasks, holdResolutionDrafts: true, resolutionDraft: draft,
    tasks: FIXTURE_TASKS.map(task => task.id === taskId ? { ...task, assignedUserId: USER.id } : task),
    checklist: { [taskId]: [
      { id: "ordinary-done", taskId, label: "Verify and update the address", required: false, doneAt: isoDay(0), note: "Address verified and saved", position: 0 },
      { id: "ordinary-pending", taskId, label: "Confirm the update", required: false, doneAt: null, note: null, position: 1 },
    ] },
  });
  try {
    if (!standaloneTasks) await page.getByTestId(`task-item-${taskId}`).click();
    await page.getByTestId(standaloneTasks ? `task-resolve-${taskId}` : "task-resolve-btn").click();
    const modal = page.getByTestId("dialog-task-resolution");
    await modal.waitFor();
    const status = modal.getByTestId("resolution-ai-status");
    await status.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-testid="resolution-ai-status"]')?.getAttribute("aria-busy") === "true");
    assert.equal(await modal.getByTestId("resolution-checklist-gate").count(), 0,
      "an ordinary task must not acquire Pulse-only completion restrictions");
    assert.equal(requests.filter(request => request.path.endsWith("/resolution-draft") && request.method === "POST").length, 1,
      "ordinary tasks with completed steps must automatically request a draft");
    await modal.screenshot({ path: path.join(PROOF_DIR, `ordinary-resolution-generating-${standaloneTasks ? "tasks" : "omni"}.png`) });
    state.releaseDraft();
    const input = modal.getByTestId(standaloneTasks ? "input-resolve-resolution" : "resolve-text");
    await page.waitForFunction(({ selector, expected }) => document.querySelector(selector)?.value === expected,
      { selector: `[data-testid="${standaloneTasks ? "input-resolve-resolution" : "resolve-text"}"]`, expected: draft });
    assert.equal(await input.inputValue(), draft);
    assert.equal(await page.getByTestId("resolve-confirm").isEnabled(), true);
    assert.equal(state.tasks.find(task => task.id === taskId).status, "in_progress",
      "draft generation must not close or persist the task");
    await modal.screenshot({ path: path.join(PROOF_DIR, `ordinary-resolution-ready-${standaloneTasks ? "tasks" : "omni"}.png`) });
    await assertNoBrowserErrors(page, "ordinary automatic resolution");
  } finally { state.releaseDraft?.(); await page.close(); }
}

async function verifyNarrowCommentPreview(browser, bundle) {
  const { page, state } = await createPage(browser, bundle, 1280, 800, { emptyComments: true });
  try {
    await page.getByTestId("task-item-fixture-task-1").click();
    const preview = page.locator(".task-comments-preview");
    await preview.waitFor();
    await preview.evaluate(element => { element.style.width = "240px"; element.style.maxWidth = "100%"; });
    await preview.scrollIntoViewIfNeeded();
    const verifyBounds = async () => {
      const dimensions = await preview.evaluate(element => {
        const box = element.getBoundingClientRect();
        const heading = element.querySelector(".task-comments-heading").getBoundingClientRect();
        const button = element.querySelector('[data-testid="button-open-task-comments"]').getBoundingClientRect();
        const count = element.querySelector(".task-comments-count").getBoundingClientRect();
        return { width: box.width, overflow: element.scrollWidth > element.clientWidth + 1,
          headingBottom: heading.bottom, buttonTop: button.top, buttonRight: button.right, right: box.right, countWidth: count.width };
      });
      assert.ok(dimensions.width <= 241);
      assert.equal(dimensions.overflow, false, "the narrow comment preview must not overflow horizontally");
      assert.ok(dimensions.buttonTop >= dimensions.headingBottom - 1, "the action must not compress or overlap the heading");
      assert.ok(dimensions.buttonRight <= dimensions.right + 1);
      assert.ok(dimensions.countWidth < 45, "the comment counter must remain a compact badge, not consume half the heading");
    };
    await verifyBounds();
    await preview.screenshot({ path: path.join(PROOF_DIR, "comments-empty-240px.png") });
    await preview.getByTestId("button-open-task-comments").click();
    await page.getByTestId("input-task-comment").fill("Verified the change and saved the corrected address.");
    await page.getByTestId("button-add-comment").click();
    await page.getByTestId("dialog-task-comments").getByText("Verified the change and saved the corrected address.", { exact: true }).waitFor();
    await page.getByTestId("button-close-task-comments").click();
    await preview.getByText("Verified the change and saved the corrected address.", { exact: true }).waitFor();
    assert.equal(state.comments.length, 1);
    await verifyBounds();
    await preview.screenshot({ path: path.join(PROOF_DIR, "comments-filled-240px.png") });
    await assertNoBrowserErrors(page, "narrow comment preview");
  } finally { await page.close(); }
}

async function verifyTaskFullscreen(browser, bundle, width, height) {
  const { page, state } = await createPage(browser, bundle, width, height);
  try {
    await page.getByTestId("task-item-fixture-task-1").click();
    const noteId = "fixture-task-1-completed-step";
    await page.getByTestId(`button-add-checklist-note-${noteId}`).click();
    const note = page.getByTestId(`input-checklist-note-${noteId}`);
    await note.fill("Unsaved note must survive maximize and minimize.");
    await page.getByTestId("button-task-maximize").click();
    const modal = page.getByTestId("dialog-task-fullscreen");
    await modal.waitFor();
    const bounds = await modal.boundingBox();
    assert.ok(bounds);
    assert.ok(Math.abs(bounds.x) < 1 && Math.abs(bounds.y) < 1, JSON.stringify(bounds));
    assert.ok(Math.abs(bounds.width - width) < 2 && Math.abs(bounds.height - height) < 2,
      "the real task modal must cover the full viewport, not only expand its original pane");
    assert.equal(await page.locator('[data-testid="checklist-fixture-task-1"]').count(), 1,
      "the complete real detail must appear only once");
    await modal.getByTestId("task-request-brief-fixture-task-1").waitFor();
    assert.equal(await note.inputValue(), "Unsaved note must survive maximize and minimize.");
    await modal.getByTestId("button-open-task-comments").click();
    const comments = page.getByTestId("dialog-task-comments");
    await comments.waitFor();
    await comments.getByTestId("input-task-comment").fill("Comment saved from the full-screen task.");
    await comments.getByTestId("button-add-comment").click();
    await comments.getByText("Comment saved from the full-screen task.", { exact: true }).waitFor();
    await comments.getByTestId("button-close-task-comments").click();
    await modal.getByText("Comment saved from the full-screen task.", { exact: true }).waitFor();
    await modal.getByTestId("task-resolve-btn").click();
    const resolution = page.getByTestId("dialog-task-resolution");
    await resolution.waitFor();
    assert.ok(Number(await resolution.evaluate(element => getComputedStyle(element).zIndex)) >
      Number(await modal.evaluate(element => getComputedStyle(element).zIndex)));
    await page.keyboard.press("Escape");
    await resolution.waitFor({ state: "hidden" });
    assert.equal(await modal.isVisible(), true, "closing a nested action must leave the expanded task open");
    await modal.screenshot({ path: path.join(PROOF_DIR, `task-fullscreen-${width}-${height}.png`) });
    await modal.getByTestId("button-task-minimize").click();
    await modal.waitFor({ state: "hidden" });
    assert.equal(await note.inputValue(), "Unsaved note must survive maximize and minimize.");
    await page.getByText("Comment saved from the full-screen task.", { exact: true }).waitFor();
    assert.equal(state.comments.length, 1);
    if (width >= 768) {
      await page.getByTestId("button-nexus-fullscreen").click();
      await modal.waitFor();
      await page.keyboard.press("Escape");
      await modal.waitFor({ state: "hidden" });
    }
    await assertNoBrowserErrors(page, "task full-screen modal");
  } finally { await page.close(); }
}

async function verifyModernTaskModals(browser, bundle, width, height, dark = false) {
  const { page, requests, apiResponses } = await createPage(browser, bundle, width, height, { dark });
  try {
    const taskRow = page.getByTestId("task-item-fixture-task-1");
    try {
      await taskRow.waitFor({ timeout: 8000 });
    } catch (error) {
      console.error("Modern task modal fixture row did not mount", {
        sourceRoot: SOURCE_ROOT,
        taskRequests: requests.filter(request => /^\/api\/(?:tasks|task-groups)(?:\/|$)/.test(request.path)).slice(-20),
        taskResponses: apiResponses.filter(response => /^\/api\/(?:tasks|task-groups)(?:\/|$)/.test(response.path)).slice(-20),
        taskQuery: await page.evaluate(() => {
          const query = window.__testQueryClient.getQueryCache().find({ queryKey: ["/api/tasks"] });
          const data = query?.state.data;
          return {
            status: query?.state.status,
            fetchStatus: query?.state.fetchStatus,
            error: query?.state.error instanceof Error ? query.state.error.message : query?.state.error,
            taskCount: Array.isArray(data) ? data.length : null,
            taskIds: Array.isArray(data) ? data.slice(0, 5).map(task => task.id) : null,
          };
        }).catch(() => null),
        taskUi: (await page.locator("body").innerText().catch(() => "")).slice(0, 1200),
      });
      throw error;
    }
    await taskRow.click();
    const check = async (name, variant) => {
      const modal = page.locator('[role="dialog"].task-modern-modal:visible').last();
      await modal.waitFor();
      const art = modal.locator(`.task-modal-artwork--${variant}`);
      assert.equal(await art.count(), 1, `${name} must use the approved shared artwork`);
      assert.equal(await art.getAttribute("aria-hidden"), "true");
      const geometry = await modal.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { radius: parseFloat(getComputedStyle(element).borderRadius),
          x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, overflow: element.scrollWidth > element.clientWidth + 1 };
      });
      assert.ok(geometry.radius >= 16, `${name} radius ${geometry.radius}`);
      assert.equal(geometry.overflow, false, `${name} must not overflow horizontally`);
      assert.ok(geometry.x >= -1 && geometry.y >= -1 && geometry.right <= width + 1 && geometry.bottom <= height + 1,
        `${name} must fit within the viewport: ${JSON.stringify(geometry)}`);
      const footer = modal.locator(".task-modern-modal-footer").first();
      if (await footer.count()) {
        const bounds = await footer.boundingBox();
        assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= height + 1, `${name} footer must stay accessible`);
      }
      await modal.screenshot({ path: path.join(PROOF_DIR, `modern-${name}-${width}-${height}${dark ? "-dark" : ""}.png`) });
      await page.keyboard.press("Escape");
      await modal.waitFor({ state: "hidden" });
    };
    await page.getByTestId("task-action-edit").click();
    await check("edit", "edit");
    await page.getByTestId("task-reassign-btn").click();
    await check("assign", "assign");
    await page.getByTestId("task-resolve-btn").click();
    await check("resolve", "resolve");
    await page.getByTestId("button-open-task-comments").click();
    await check("comments", "comments");
    if (width >= 768) {
      await page.getByTestId("btn-task-groups-nexus").click();
      await check("groups", "groups");
      await page.getByTestId("task-subtab-reporting").click();
      await check("reporting", "detail");
    }
    await assertNoBrowserErrors(page, "modern task modals");
  } finally { await page.close(); }
}

async function main() {
  if (!process.env.OMNI_TASK_TEST_FILTER) fs.rmSync(PROOF_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  const bundle = await makeBundle();
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM, args: ["--no-sandbox"] });
  try {
    const results = [];
    const run = async (name, test) => {
      if (process.env.OMNI_TASK_TEST_FILTER && !name.includes(process.env.OMNI_TASK_TEST_FILTER)) return;
      try {
        const value = await test();
        results.push({ name, status: "passed", value });
        console.log(`PASS ${name}${value === undefined ? "" : `: ${JSON.stringify(value)}`}`);
      } catch (error) {
        results.push({ name, status: "failed", error: error.stack || String(error) });
        console.error(`FAIL ${name}: ${error.stack || error}`);
      }
    };
    await run("modern modal style desktop", () => verifyModernTaskModals(browser, bundle, 1280, 800));
    await run("modern modal style short desktop", () => verifyModernTaskModals(browser, bundle, 1280, 600));
    await run("modern modal style mobile", () => verifyModernTaskModals(browser, bundle, 390, 844));
    await run("modern modal style dark", () => verifyModernTaskModals(browser, bundle, 1280, 800, true));
    await run("task fullscreen desktop", () => verifyTaskFullscreen(browser, bundle, 1280, 800));
    await run("task fullscreen short desktop", () => verifyTaskFullscreen(browser, bundle, 1280, 600));
    await run("task fullscreen mobile", () => verifyTaskFullscreen(browser, bundle, 390, 844));
    await run("redesign ordinary automatic resolution Omni", () => verifyOrdinaryTaskAutomaticResolution(browser, bundle));
    await run("redesign ordinary automatic resolution Tasks", () => verifyOrdinaryTaskAutomaticResolution(browser, bundle, true));
    await run("redesign comments preview at 240px", () => verifyNarrowCommentPreview(browser, bundle));
    await run("automatic AI checklist desktop", () => verifyAutomaticAiChecklist(browser, bundle, 1280, 800));
    await run("automatic AI checklist mobile", () => verifyAutomaticAiChecklist(browser, bundle, 390, 844));
    await run("AI checklist explicit failure retry", () => verifyAutomaticAiChecklist(browser, bundle, 1280, 800, true));
    await run("AI checklist preserves manual and completed tasks", () => verifyAiChecklistPreservesManualAndReadOnly(browser, bundle));
    await run("task elapsed clock and overdue desktop", () => verifyTaskElapsedAndOverdue(browser, bundle, 1280, 800));
    await run("task elapsed clock and overdue mobile", () => verifyTaskElapsedAndOverdue(browser, bundle, 390, 844));
    await run("submitter request presentation desktop", () => verifyTaskRequestBrief(browser, bundle, 1280, 800));
    await run("submitter request presentation mobile", () => verifyTaskRequestBrief(browser, bundle, 390, 844));
    await run("standalone submitter request presentation desktop", () => verifyTaskRequestBrief(browser, bundle, 1280, 800, true));
    await run("standalone submitter request presentation mobile", () => verifyTaskRequestBrief(browser, bundle, 390, 844, true));
    for (const [width, height, dark] of [[1280, 800, false], [1280, 600, false], [390, 844, false], [1280, 800, true]]) {
      await run(`task work layout ${width}x${height}${dark ? " dark" : ""}`, () => verifyTaskWorkLayout(browser, bundle, width, height, dark));
    }
    for (const [width, height, standalone, dark] of [[1280, 600, false, false], [390, 844, false, false], [390, 844, true, false], [1280, 800, false, true]]) {
      await run(`comments history modal ${width}x${height}${standalone ? " standalone" : ""}${dark ? " dark" : ""}`, () =>
        verifyCommentsHistoryModal(browser, bundle, width, height, standalone, dark));
    }
    await run("comments composer pending upload and submit lifecycle", () => verifyCommentsComposerPendingLifecycle(browser, bundle));
    await run("comments composer upload recovery and mobile bounds", () => verifyCommentsUploadRecoveryAndBounds(browser, bundle));
    await run("QuickCreate task with attachment and clean reopen", () => verifyTaskAttachmentCreation(browser, bundle));
    await run("standalone Tasks attachment-only comment", () => verifyTasksPageAttachments(browser, bundle));
    for (const [width, height] of [[1280, 800], [390, 844]]) {
      await run(`task attachments upload/edit/comment ${width}x${height}`, () =>
        verifyTaskAttachments(browser, bundle, width, height));
    }
    await run("task attachment upload failure is visible and cannot be submitted", () =>
      verifyTaskAttachmentUploadFailure(browser, bundle));
    if (process.env.OMNI_TASK_ATTACHMENT_ONLY === "1") {
      console.log(`Results: ${JSON.stringify(results.map(({ name, status }) => ({ name, status })))}`);
      if (results.some(result => result.status === "failed")) process.exitCode = 1;
      return;
    }
    for (const [width, height] of [[1280, 800], [1280, 600], [390, 844]]) {
      await run(`collapsed task filter dropdown ${width}x${height}`, () =>
        verifyTaskFilterDropdown(browser, bundle, width, height));
    }
    if (process.env.OMNI_TASK_FILTER_ONLY === "1") {
      await run("filter values, sorting, people and pagination in the dropdown", () =>
        verifyQueueControlsAndPagination(browser, bundle));
      console.log(`Results: ${JSON.stringify(results.map(({ name, status }) => ({ name, status })))}`);
      if (results.some(result => result.status === "failed")) process.exitCode = 1;
      return;
    }
    await run("actual-root workspace/group entry", async () => {
      const entry = await verifyWorkspaceEntryAndQueue(browser, bundle);
      const result = {
        url: new URL(entry.page.url()).pathname + new URL(entry.page.url()).search,
        groupDialogVisible: await entry.groupDialog.isVisible(),
        taskGroupApiCalls: entry.requests.filter(item => item.path === "/api/task-groups").length,
      };
      await entry.page.close();
      return result;
    });
    for (const [width, height] of [[1280, 600], [1280, 800], [390, 844]]) {
      await run(`group editor Save/Cancel viewport reachability ${width}x${height}`, () =>
        verifyGroupEditorReachability(browser, bundle, width, height));
    }
    await run("task group modal CRUD, advanced ordering, and permissions", () => verifyGroupModal(browser, bundle));
    await run("global/group/Back Office queue scopes and advanced filters/pagination", () =>
      verifyQueueControlsAndPagination(browser, bundle));
    await run("Email/SMS local pagination is isolated from Tasks load/refetch", () =>
      verifyEmailSmsPaginationIsolation(browser, bundle));
    const actionMeasurements = [];
    for (const [width, height, dark] of [
      [1280, 800, false], [1280, 600, false], [390, 844, false], [390, 844, true],
    ]) {
      await run(`task action toolbar ${dark ? "dark " : ""}${width}x${height}`, async () => {
        const measured = await verifyActionRow(browser, bundle, width, height, dark);
        actionMeasurements.push(measured);
        return measured;
      });
    }
    await run("Start and Cancel action API behavior", () => verifyTaskActionRequests(browser, bundle));
    for (const [width, height, standaloneTasks, dark] of [
      [1280, 800, false, false],
      [390, 844, false, false],
      [390, 844, true, false],
      [1280, 800, false, true],
    ]) {
      await run(`task cancel confirmation ${standaloneTasks ? "standalone " : ""}${dark ? "dark " : ""}${width}x${height}`,
        () => verifyCancelConfirmation(browser, bundle, { width, height, standaloneTasks, dark }));
    }
    await run("task cancel pending guard", () => verifyCancelPendingGuard(browser, bundle));
    for (const [width, height, standaloneTasks, dark] of [
      [1280, 800, false, false], [390, 844, false, false],
      [390, 844, true, false], [1280, 800, false, true],
    ]) {
      await run(`task resolution checklist notes ${standaloneTasks ? "standalone " : ""}${dark ? "dark " : ""}${width}x${height}`,
        () => verifyResolutionChecklistAndNotes(browser, bundle, width, height, standaloneTasks, dark));
    }
    await run("task resolution draft typing race", () => verifyResolutionDraftTypingRace(browser, bundle));
    await run("task resolution draft failure retry", () => verifyResolutionDraftFailureRetry(browser, bundle));
    await run("task edit PATCH, validation, and preservation", () => verifyTaskEdits(browser, bundle));
    await run("edit already-completed task without repeat notification or resolver override", () =>
      verifyCompletedTaskEdit(browser, bundle));
    await run("Pulse completion edit payload", () => verifyPulseEditCompletionSuccess(browser, bundle));
    await run("Pulse resolution opt-in/opt-out payload", () => verifyPulseCompletionAndInbox(browser, bundle));
    await run("Omni Pulse notification with a single protected source marker", () =>
      verifyPulseStatusListMarkerFallback(browser, bundle, false));
    await run("standalone Pulse resolve/edit notification and clinic isolation", () =>
      verifyPulseStatusListMarkerFallback(browser, bundle, true));
    await run("manual Nexus Pulse create provenance and notification opt-in", () =>
      verifyManualPulseTaskCreationAndOptIn(browser, bundle));
    await run("Back Office persisted completion inbox lifecycle", () => verifyInboxLifecycle(browser, bundle));
    console.log(`Results: ${JSON.stringify(results.map(({ name, status }) => ({ name, status })))}`);
    console.log(`Action row DOM measurements: ${JSON.stringify(actionMeasurements)}`);
    console.log(`Screenshots: ${fs.readdirSync(PROOF_DIR).map(file => path.join(PROOF_DIR, file)).join(", ")}`);
    console.log(`Source root: ${SOURCE_ROOT}`);
    if (results.some(result => result.status === "failed")) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});