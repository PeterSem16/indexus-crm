const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { build } = require("esbuild");
const postcss = require("postcss");
const tailwind = require("tailwindcss");
const autoprefixer = require("autoprefixer");
const { chromium, expect } = require("@playwright/test");

// Compile and exercise the real published Automation page. API traffic is
// intercepted at the browser network boundary; window.fetch stays native.
const ROOT = process.cwd();
const screenshots = path.join(ROOT, ".local/screenshots");
const harness = `
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { I18nProvider } from "@/i18n/I18nProvider";
import { AuthProvider } from "@/contexts/auth-context";
import AutomationsPage from "@/pages/automations";
import "@/index.css";

Object.assign(window.__automationFixture, {
  invalidateRules: () => queryClient.invalidateQueries({ queryKey: ["/api/automation/rules"] }),
});
createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    <I18nProvider><AuthProvider><AutomationsPage /></AuthProvider></I18nProvider>
  </QueryClientProvider>
);
`;

const rulesInitial = [
  {
    id: "rule-task", name: "Task status notify", description: "Task flow", module: "task",
    countryCode: "SK", enabled: true, isSystem: false,
    trigger: { type: "event", entityType: "task", eventType: "status_changed" },
    conditions: { all: [{ field: "newValues.status", op: "eq", value: "done" }] },
    actions: [{ type: "notify_user", config: { title: "Task changed", message: "Status update" } }],
    rateLimitPerHour: 6, consecutiveErrorCount: 0, updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "rule-customer", name: "Customer welcome", description: "Customer flow", module: "customer",
    countryCode: "US", enabled: false, isSystem: false,
    trigger: { type: "event", entityType: "customer", eventType: "created" },
    conditions: null, actions: [{ type: "notify_user", config: {} }],
    rateLimitPerHour: null, consecutiveErrorCount: 0, updatedAt: "2025-01-02T00:00:00Z",
  },
];
const sentimentRule = {
  id: "rule-sentiment", name: "Negative inbound sentiment", description: "Review difficult conversations",
  module: "communication", countryCode: "SK", enabled: true, isSystem: false,
  trigger: { type: "event", entityType: "communication", eventType: "sentiment.negative" },
  conditions: { all: [{ field: "newValues.type", op: "in", value: ["email", "sms"] }] },
  actions: [{ type: "notify_user", config: { title: "Review conversation" } }],
  rateLimitPerHour: 4, consecutiveErrorCount: 0, updatedAt: "2025-01-03T00:00:00Z",
};
const catalog = {
  managedServices: [
    { id: "notification_rules", label: "Notification rules", executor: "notification_rules", configApi: "/api/notification-rules" },
    { id: "metric_alerts", label: "Metric alerts", executor: "alert_evaluator", configApi: "/api/alert-rules" },
  ],
  modules: [
    { value: "task", label: "Task" }, { value: "customer", label: "Customer" },
    { value: "communication", label: "Communication" }, { value: "call", label: "Call" },
    { value: "contract", label: "Contract" }, { value: "hospital", label: "Hospital" },
    { value: "clinic", label: "Clinic" }, { value: "collaborator", label: "Collaborator" },
    { value: "invoice", label: "Invoice" },
  ],
  schedule: {
    intervals: ["every_5_min", "every_15_min", "every_30_min", "hourly", "every_6_hours", "daily", "weekly"],
    modes: [{ value: "once", label: "One action per interval" }, { value: "per_record", label: "Evaluate matching records" }],
    perRecordModules: ["task", "customer", "hospital", "clinic"],
    maxMatches: 100,
  },
  eventTypes: [
    { value: "created", label: "Entity created", availableIn: ["task", "customer", "hospital", "clinic", "collaborator", "invoice"], changeSnapshot: false },
    { value: "updated", label: "Entity updated", availableIn: ["task", "customer", "hospital", "clinic", "collaborator", "invoice"], changeSnapshot: true },
    { value: "status_changed", label: "Status changed", availableIn: ["task", "customer"], changeSnapshot: true },
    { value: "email.received", label: "New inbound email", availableIn: ["communication"], changeSnapshot: false },
    { value: "sms.received", label: "New inbound SMS", availableIn: ["communication"], changeSnapshot: false },
    { value: "sentiment.negative", label: "Negative sentiment in inbound message", availableIn: ["communication"], changeSnapshot: false },
    { value: "task.assigned", label: "Task assigned to a user", availableIn: ["task"], changeSnapshot: true },
    { value: "task.completed", label: "Task completed", availableIn: ["task"], changeSnapshot: false },
    { value: "task.overdue", label: "Task became overdue (auto)", availableIn: ["task"], changeSnapshot: false },
    { value: "contract.completed", label: "Contract completed", availableIn: ["contract"], changeSnapshot: true },
    { value: "contract.cancelled", label: "Contract cancelled", availableIn: ["contract"], changeSnapshot: true },
    { value: "call.assigned", label: "Inbound call assigned to agent", availableIn: ["call"], changeSnapshot: false },
    { value: "call.answered", label: "Inbound call answered", availableIn: ["call"], changeSnapshot: false },
    { value: "call.completed", label: "Inbound call completed", availableIn: ["call"], changeSnapshot: false },
    { value: "call.abandoned", label: "Inbound call abandoned (caller hangup)", availableIn: ["call"], changeSnapshot: false },
    { value: "call.timeout", label: "Inbound call timed out", availableIn: ["call"], changeSnapshot: false },
    { value: "outbound.started", label: "Outbound call started", availableIn: ["call"], changeSnapshot: false },
    { value: "outbound.answered", label: "Outbound call answered", availableIn: ["call"], changeSnapshot: false },
    { value: "outbound.completed", label: "Outbound call completed", availableIn: ["call"], changeSnapshot: false },
    { value: "outbound.unanswered", label: "Outbound call unanswered", availableIn: ["call"], changeSnapshot: false },
  ],
  actionTypes: [
    { value: "create_task", label: "Create task", availableIn: ["task", "customer", "hospital", "clinic"], recipientTypes: [], purpose: "Create a task", needs: [], configSchema: { title: "string", priority: "string" } },
    { value: "notify_user", label: "Notify user(s)", availableIn: ["task", "customer", "communication", "call"], recipientTypes: [], purpose: "Send an in-app notification", needs: [], configSchema: { title: "string", message: "string" } },
    { value: "send_email", label: "Send email", availableIn: ["communication", "customer"], recipientTypes: [], purpose: "Send an email", needs: [], configSchema: { to: "string", subject: "string", body: "string" } },
    { value: "send_sms", label: "Send SMS", availableIn: ["communication", "customer"], recipientTypes: [], purpose: "Send an SMS", needs: [], configSchema: { to: "string", text: "string" } },
    { value: "webhook", label: "Call webhook", availableIn: ["task", "customer"], recipientTypes: [], purpose: "Call an external webhook", needs: [], configSchema: { url: "string" } },
    { value: "update_entity", label: "Update entity", availableIn: ["task", "customer", "hospital", "clinic", "invoice"], recipientTypes: [], purpose: "Update allow-listed fields", needs: [], configSchema: { fields: "object" } },
    { value: "assign_user", label: "Assign user", availableIn: ["task", "customer", "hospital"], recipientTypes: [], purpose: "Assign a record", needs: [], configSchema: { strategy: "string" } },
    { value: "add_tag", label: "Add tags", availableIn: ["task", "customer", "hospital", "clinic"], recipientTypes: [], purpose: "Add tags", needs: [], configSchema: { tags: "string[]" } },
    { value: "remove_tag", label: "Remove tags", availableIn: ["task", "customer", "hospital", "clinic"], recipientTypes: [], purpose: "Remove tags", needs: [], configSchema: { tags: "string[]" } },
  ],
  operators: [
    { value: "eq", label: "equals", arity: 1, availableIn: ["task", "customer", "communication", "call", "contract", "hospital", "clinic", "collaborator", "invoice"] },
    { value: "neq", label: "not equals", arity: 1, availableIn: ["task", "customer", "communication", "call", "contract", "hospital", "clinic", "collaborator", "invoice"] },
    { value: "gt", label: ">", arity: 1, availableIn: ["task", "customer", "communication", "call", "contract", "hospital", "clinic", "collaborator", "invoice"] },
    { value: "gte", label: ">=", arity: 1, availableIn: ["task", "customer", "communication", "call", "contract", "hospital", "clinic", "collaborator", "invoice"] },
    { value: "lt", label: "<", arity: 1, availableIn: ["task", "customer", "communication", "call", "contract", "hospital", "clinic", "collaborator", "invoice"] },
    { value: "lte", label: "<=", arity: 1, availableIn: ["task", "customer", "communication", "call", "contract", "hospital", "clinic", "collaborator", "invoice"] },
    { value: "in", label: "in (comma list)", arity: 1, availableIn: ["task", "customer", "communication", "call", "contract", "hospital", "clinic", "collaborator", "invoice"] },
    { value: "not_in", label: "not in (comma list)", arity: 1, availableIn: ["task", "customer", "communication", "call", "contract", "hospital", "clinic", "collaborator", "invoice"] },
    { value: "contains", label: "contains", arity: 1, availableIn: ["task", "customer", "communication", "call", "contract", "hospital", "clinic", "collaborator", "invoice"] },
    { value: "starts_with", label: "starts with", arity: 1, availableIn: ["task", "customer", "communication", "call", "contract", "hospital", "clinic", "collaborator", "invoice"] },
    { value: "is_null", label: "is empty", arity: 0, availableIn: ["task", "customer", "communication", "call", "contract", "hospital", "clinic", "collaborator", "invoice"] },
    { value: "is_not_null", label: "is set", arity: 0, availableIn: ["task", "customer", "communication", "call", "contract", "hospital", "clinic", "collaborator", "invoice"] },
    { value: "changed", label: "changed (any)", arity: 0, availableIn: ["task", "customer", "communication", "call", "contract", "hospital", "clinic", "collaborator", "invoice"] },
    { value: "changed_to", label: "changed to", arity: 1, availableIn: ["task", "customer", "communication", "call", "contract", "hospital", "clinic", "collaborator", "invoice"] },
    { value: "changed_from", label: "changed from", arity: 1, availableIn: ["task", "customer", "communication", "call", "contract", "hospital", "clinic", "collaborator", "invoice"] },
  ],
  fields: {
    task: [{ value: "newValues.status", label: "Status", type: "string", options: ["pending", "done"] }, { value: "newValues.title", label: "Title", type: "string" }],
    customer: [{ value: "newValues.name", label: "Name", type: "string" }, { value: "newValues.lastCallResult", label: "Last call result", type: "string" }],
    communication: [{ value: "newValues.type", label: "Channel", type: "enum", options: ["email", "sms", "inbound_call", "outbound_call", "task"] }],
    call: [{ value: "newValues.status", label: "Call status", type: "string" }],
    contract: [{ value: "newValues.status", label: "Contract status", type: "string" }],
    hospital: [{ value: "newValues.name", label: "Name", type: "string" }],
    clinic: [{ value: "newValues.name", label: "Name", type: "string" }],
    collaborator: [{ value: "newValues.name", label: "Name", type: "string" }],
    invoice: [{ value: "newValues.status", label: "Invoice status", type: "string" }],
  },
  fieldsByEvent: {
    task: { status_changed: [{ value: "newValues.status", label: "Status", type: "string" }], created: [{ value: "newValues.title", label: "Title", type: "string" }], updated: [{ value: "newValues.title", label: "Title", type: "string" }] },
    customer: { created: [{ value: "newValues.name", label: "Name", type: "string" }], updated: [{ value: "newValues.lastCallResult", label: "Last call result", type: "string" }] },
    communication: { "sentiment.negative": [{ value: "newValues.type", label: "Channel", type: "enum", options: ["email", "sms", "inbound_call", "outbound_call", "task"] }], "email.received": [{ value: "newValues.type", label: "Channel", type: "enum", options: ["email", "sms"] }] },
  },
  recipients: [],
  recipientTemplatesByEvent: {},
  countries: [{ value: "SK", label: "Slovakia" }, { value: "US", label: "United States" }],
  inboundServices: [
    { id: "inbound_call_completed", eventType: "call.completed", actionType: "create_task", config: {}, conditions: null },
  ],
  outboundServices: [
    { id: "outbound_call_unanswered", eventType: "outbound.unanswered", actionType: "create_task", config: {}, conditions: null },
  ],
};
const runRows = [
  { id: "run-success", ruleId: "rule-task", status: "success", skippedReason: null, startedAt: "2025-01-02T10:00:00Z", finishedAt: "2025-01-02T10:00:01Z", error: null },
  { id: "run-failed", ruleId: "rule-customer", status: "failed", skippedReason: null, startedAt: "2025-01-02T11:00:00Z", finishedAt: "2025-01-02T11:00:02Z", error: "Fixture failure" },
];
const notificationRules = [{
  id: "notification-rule-one", name: "Inbound email notice", description: "Notify assigned team",
  triggerType: "new_email", triggerConditions: null, countryCodes: ["SK"], targetType: "role",
  targetRoles: ["manager"], targetUserIds: [], notificationTitle: "New email",
  notificationMessage: "A new email arrived", priority: "normal", sendPush: true,
  sendEmail: false, sendSms: false, isActive: true,
}];
const alertRules = [{
  id: "alert-rule-one", name: "Overdue tasks", description: "Monitor overdue tasks",
  metricType: "overdue_tasks", comparisonOperator: "gt", thresholdValue: 3,
  checkFrequency: "daily", notificationPriority: "high", targetType: "all",
  targetRoles: [], targetUserIds: [], countryCodes: ["SK"], cooldownMinutes: 60,
  isActive: true, lastCheckedAt: null, lastAlertedAt: null, createdAt: "2025-01-01T00:00:00Z",
  createdBy: "fixture-user",
}];

async function compile() {
  const result = await build({
    stdin: { contents: harness, resolveDir: ROOT, sourcefile: "automation-indexus-browser-fixture.tsx", loader: "tsx" },
    bundle: true, write: false, outfile: "/tmp/automation-indexus-browser-fixture.js",
    platform: "browser", format: "iife", jsx: "automatic", target: ["es2020"],
    alias: { "@": path.join(ROOT, "client/src") },
  });
  const rawCSS = result.outputFiles.find(file => file.path.endsWith(".css"));
  assert.ok(rawCSS, "The Automation page must bundle its real app and Tasks modal CSS.");
  const css = await postcss([
    tailwind({ config: path.join(ROOT, "tailwind.config.ts") }), autoprefixer(),
  ]).process(rawCSS.text, { from: path.join(ROOT, "client/src/index.css") });
  assert.match(css.css, /\.task-modern-modal\s*\{/, "The real Tasks modal skin must be bundled with Automation.");
  assert.match(css.css, /\.task-modal-artwork\s*\{/, "The shared Tasks dialog artwork must be bundled with Automation.");
  assert.match(css.css, /\.automation-editor-dialog/, "Automation-specific responsive modal rules must be bundled.");
  return {
    js: result.outputFiles.find(file => file.path.endsWith(".js")).text,
    css: css.css,
  };
}

async function main() {
  const source = fs.readFileSync(path.join(ROOT, "client/src/pages/automations.tsx"), "utf8");
  const assistantSource = fs.readFileSync(path.join(ROOT, "client/src/components/automation-draft-assistant.tsx"), "utf8");
  assert.ok(source.includes("AutomationServiceCatalog"), "Standalone Services must be available from the real Automation page.");
  assert.ok(source.includes("AutomationDraftAssistant"), "The event-based AI draft assistant must be available from Automation.");
  assert.ok(source.includes("SentimentSourcePicker") || source.includes("sentiment-source-picker"),
    "The rule editor must retain configurable sentiment source channels.");
  const serviceCatalogSource = fs.readFileSync(path.join(ROOT, "client/src/components/automation-service-catalog.tsx"), "utf8");
  for (const cutoverUI of ["StatusListRuleDraftDialog", "status-list-action-adapter", "choose-status-list"]) {
    assert.ok(!serviceCatalogSource.includes(cutoverUI), `Status List engine cutover UI leaked into the service catalog: ${cutoverUI}`);
  }
  for (const statusListDraftPath of [
    "StatusListRuleDraftDialog", "draft-context/missions", "status_list",
  ]) {
    assert.ok(!assistantSource.includes(statusListDraftPath), `Status List draft UI leaked into the central AI assistant: ${statusListDraftPath}`);
  }
  assert.ok(!source.includes("draftCampaignId"), "Status List campaign draft deep links must not return.");
  console.log("PASS source boundary: standalone Automation features are present; Status List draft UI and engine cutover remain excluded");

  const compiled = await compile();
  const server = http.createServer((req, res) => {
    if (req.url === "/fixture.js" || req.url === "/fixture.css") {
      const js = req.url.endsWith(".js");
      res.writeHead(200, { "Content-Type": js ? "text/javascript" : "text/css" });
      return res.end(js ? compiled.js : compiled.css);
    }
    if (req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
    }
    res.writeHead(404);
    res.end("Unexpected fixture request");
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const pageErrors = [];
  const unexpectedRequests = [];
  const cases = [];
  let browser;
  fs.mkdirSync(screenshots, { recursive: true });
  try {
    browser = await chromium.launch({
      headless: true, executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
      args: ["--no-sandbox"],
    });

    async function fixture(options = {}) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const requests = [];
      const state = {
        rules: [...(options.rules || rulesInitial)], created: [], patches: [], deletes: [], dryRuns: [], tests: 0,
        notifications: [...notificationRules], notificationCreates: [], notificationUpdates: [],
        notificationToggles: [], notificationDeletes: [], alerts: [...alertRules],
        alertCreates: [], alertUpdates: [], alertToggles: [], alertDeletes: [], schedulePreviews: [],
        aiDrafts: [],
      };
      page.on("pageerror", error => {
        pageErrors.push(error.message);
        console.error(`BROWSER PAGEERROR: ${error.stack || error.message}`);
      });
      await page.route("**/api/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        const pathname = url.pathname;
        let body = request.postDataJSON();
        requests.push({ path: pathname, method: request.method(), search: url.search, body });
        let response = { status: 200, body: {} };
        if (pathname === "/api/auth/me" && request.method() === "GET") {
          response = { status: 200, body: { user: { id: "fixture-user", username: "fixture", role: "manager", assignedCountries: ["SK"], fullName: "Fixture Manager" } } };
        } else if (pathname === "/api/automation/rules" && request.method() === "GET") {
          response = options.rulesFailure || { status: 200, body: state.rules };
        } else if (pathname === "/api/automation/catalog" && request.method() === "GET") {
          response = options.catalogFailure || { status: 200, body: catalog };
        } else if (pathname === "/api/automation/users" && request.method() === "GET") {
          response = { status: 200, body: [{ id: "fixture-user", fullName: "Fixture Manager", email: "manager@example.test", role: "manager" }] };
        } else if (pathname === "/api/users" && request.method() === "GET") {
          response = { status: 200, body: [{ id: "fixture-user", fullName: "Fixture Manager", email: "manager@example.test", role: "manager" }] };
        } else if (pathname === "/api/roles" && request.method() === "GET") {
          response = { status: 200, body: [{ id: "manager", name: "Manager", isActive: true }] };
        } else if (pathname === "/api/departments" && request.method() === "GET") {
          response = { status: 200, body: [{ id: "fixture-department", name: "Operations" }] };
        } else if (pathname === "/api/task-groups" && request.method() === "GET") {
          response = { status: 200, body: [{ id: "fixture-group", name: "Operations", members: [{ userId: "fixture-user" }] }] };
        } else if (pathname === "/api/automation/draft-context/events" && request.method() === "GET") {
          response = { status: 200, body: {
            sources: [
              { module: "task", label: "Task", events: ["created", "updated", "status_changed", "task.assigned", "task.completed", "task.overdue"], fields: ["newValues.status", "newValues.title"], fieldsByEvent: { status_changed: ["newValues.status"], created: ["newValues.title"], updated: ["newValues.title"] } },
              { module: "customer", label: "Customer", events: ["created", "updated"], fields: ["newValues.name", "newValues.lastCallResult"], fieldsByEvent: { created: ["newValues.name"], updated: ["newValues.lastCallResult"] } },
              { module: "communication", label: "Communication", events: ["email.received", "sms.received", "sentiment.negative"], fields: ["newValues.type"], fieldsByEvent: { "email.received": ["newValues.type"], "sentiment.negative": ["newValues.type"] } },
            ],
            countries: ["SK", "CZ", "AT", "HU", "RO", "IT", "DE"],
            intents: ["create_task", "notify_role", "draft_reply", "set_contact_status", "set_callback", "send_email_group", "notify_email", "send_contact_email", "send_sms", "sys_webhook", "update_entity", "assign_user", "add_tag", "remove_tag"],
          } };
        } else if (pathname === "/api/automation/draft-context/events/propose" && request.method() === "POST") {
          state.aiDrafts.push(body);
          response = { status: 200, body: {
            scope: {
              module: body.module, entityType: body.module, eventType: body.eventType,
              countryCode: body.countryCode, conditionField: body.conditionField || null,
              conditionValue: body.conditionValue || null,
            },
            proposals: [{
              intent: body.desiredIntent || "notify_role",
              evidence: body.instruction.slice(0, Math.min(40, body.instruction.length)),
              condition: "Notify the manager when the selected event occurs",
              explanation: "This is an unactivated proposal for human review.",
              draftText: "Please review this editable message proposal.",
              missingInformation: [], support: "not_integrated",
            }],
            questions: [],
          } };
        } else if (pathname === "/api/automation/schedule-preview" && request.method() === "POST") {
          state.schedulePreviews.push(body);
          response = { status: 200, body: { matchedCount: 2, overLimit: false, maxMatches: 100 } };
        } else if (pathname === "/api/notification-rules" && request.method() === "GET") {
          response = { status: 200, body: state.notifications };
        } else if (pathname === "/api/notification-rules" && request.method() === "POST") {
          state.notificationCreates.push(body);
          const rule = { ...notificationRules[0], ...body, id: "notification-rule-created" };
          state.notifications = [...state.notifications, rule];
          response = { status: 201, body: rule };
        } else if (/^\/api\/notification-rules\/[^/]+$/.test(pathname) && request.method() === "PUT") {
          const id = pathname.split("/").pop();
          state.notificationUpdates.push({ id, body });
          state.notifications = state.notifications.map(rule => rule.id === id ? { ...rule, ...body } : rule);
          response = { status: 200, body: state.notifications.find(rule => rule.id === id) };
        } else if (/^\/api\/notification-rules\/[^/]+\/toggle$/.test(pathname) && request.method() === "PATCH") {
          const id = pathname.split("/")[3];
          state.notificationToggles.push({ id, body });
          state.notifications = state.notifications.map(rule => rule.id === id ? { ...rule, isActive: body.isActive } : rule);
          response = { status: 200, body: state.notifications.find(rule => rule.id === id) };
        } else if (/^\/api\/notification-rules\/[^/]+$/.test(pathname) && request.method() === "DELETE") {
          const id = pathname.split("/").pop();
          state.notificationDeletes.push(id);
          state.notifications = state.notifications.filter(rule => rule.id !== id);
          response = { status: 200, body: { success: true } };
        } else if (pathname === "/api/alert-rules" && request.method() === "GET") {
          response = { status: 200, body: state.alerts };
        } else if (pathname === "/api/alert-rules" && request.method() === "POST") {
          state.alertCreates.push(body);
          const alert = { ...alertRules[0], ...body, id: "alert-rule-created" };
          state.alerts = [...state.alerts, alert];
          response = { status: 201, body: alert };
        } else if (/^\/api\/alert-rules\/[^/]+$/.test(pathname) && request.method() === "PATCH") {
          const id = pathname.split("/").pop();
          state.alertUpdates.push({ id, body });
          state.alerts = state.alerts.map(alert => alert.id === id ? { ...alert, ...body } : alert);
          response = { status: 200, body: state.alerts.find(alert => alert.id === id) };
        } else if (/^\/api\/alert-rules\/[^/]+\/toggle$/.test(pathname) && request.method() === "POST") {
          const id = pathname.split("/")[3];
          state.alertToggles.push(id);
          const alert = state.alerts.find(row => row.id === id);
          const updatedAlert = { ...alert, isActive: !alert.isActive };
          state.alerts = state.alerts.map(row => row.id === id ? updatedAlert : row);
          response = { status: 200, body: updatedAlert };
        } else if (/^\/api\/alert-rules\/[^/]+$/.test(pathname) && request.method() === "DELETE") {
          const id = pathname.split("/").pop();
          state.alertDeletes.push(id);
          state.alerts = state.alerts.filter(alert => alert.id !== id);
          response = { status: 200, body: { success: true } };
        } else if (pathname === "/api/automation/runs" && request.method() === "GET") {
          response = { status: 200, body: runRows };
        } else if (/^\/api\/automation\/runs\/[^/]+$/.test(pathname) && request.method() === "GET") {
          response = { status: 200, body: { event: { module: "task", entityType: "task", eventType: "status_changed", entityId: "fixture-task" }, actions: [{ id: "action-one", status: "success", actionIndex: 0, actionType: "notify_user", output: { delivered: true } }] } };
        } else if (/^\/api\/automation\/rules\/[^/]+\/runs$/.test(pathname) && request.method() === "GET") {
          response = { status: 200, body: runRows.filter(run => run.ruleId === pathname.split("/")[4]) };
        } else if (/^\/api\/automation\/rules\/[^/]+\/test$/.test(pathname) && request.method() === "POST") {
          state.dryRuns.push(body);
          response = { status: 200, body: { conditionMet: true, actions: [{ type: "notify_user", rendered: { title: "Task changed" } }], ctx: { entityType: "task", entityId: "fixture-task" } } };
        } else if (/^\/api\/automation\/rules\/[^/]+\/reset-errors$/.test(pathname) && request.method() === "POST") {
          response = { status: 200, body: { success: true } };
        } else if (pathname === "/api/automation/rules" && request.method() === "POST") {
          state.created.push(body);
          const rule = { ...rulesInitial[0], ...body, id: "rule-created", updatedAt: "2025-01-03T00:00:00Z" };
          state.rules = [...state.rules, rule];
          response = { status: 201, body: rule };
        } else if (/^\/api\/automation\/rules\/[^/]+$/.test(pathname) && request.method() === "PATCH") {
          const id = pathname.split("/").pop();
          state.patches.push({ id, body });
          state.rules = state.rules.map(rule => rule.id === id ? { ...rule, ...body } : rule);
          response = { status: 200, body: state.rules.find(rule => rule.id === id) };
        } else if (/^\/api\/automation\/rules\/[^/]+$/.test(pathname) && request.method() === "DELETE") {
          const id = pathname.split("/").pop();
          state.deletes.push(id);
          state.rules = state.rules.filter(rule => rule.id !== id);
          response = { status: 200, body: { success: true } };
        } else {
          unexpectedRequests.push(`${request.method()} ${pathname}`);
          response = { status: 500, body: { error: "Unexpected fixture API request" } };
        }
        await route.fulfill({
          status: response.status, contentType: "application/json", body: JSON.stringify(response.body),
        });
      });
      await page.addInitScript(() => {
        window.__automationFixture = {};
        window.__nativeFetch = window.fetch;
      });
      await page.goto(origin);
      await expect(page.getByTestId("text-page-title")).toBeVisible();
      return { page, requests, state };
    }

    async function test(name, run) {
      await run();
      cases.push(name);
      console.log(`PASS ${name}`);
    }

    await test("Services catalog remains populated and configures a real workflow action", async () => {
      const { page, state, requests } = await fixture();
      await page.getByTestId("tab-automation-services").click();
      const services = page.getByTestId("automation-service-catalog");
      await expect(services).toBeVisible();
      await expect(services.getByTestId("choose-service-notify_user")).toBeVisible();
      await expect(services.getByTestId("choose-service-create_task")).toBeVisible();
      await expect(services.getByTestId("automation-status-list-services")).toBeVisible();
      await expect(services.locator("#automation-pulse-services")).toHaveCount(0);

      await page.getByTestId("button-create-rule").click();
      const initialPicker = page.locator(".automation-service-dialog");
      await expect(initialPicker.getByTestId("automation-service-catalog")).toBeVisible();
      await initialPicker.getByTestId("choose-service-notify_user").click();
      const pickerEditor = page.locator(".automation-editor-dialog");
      await expect(pickerEditor).toBeVisible();
      await expect(pickerEditor).toHaveClass(/automation-rule-dialog/);
      await expect(pickerEditor.getByTestId("tab-builder")).toBeVisible();
      await expect(pickerEditor.getByTestId("tab-json")).toBeVisible();
      await expect(pickerEditor.getByTestId("button-save-rule-header")).toHaveCount(0);
      await expect(pickerEditor.getByTestId("button-save-rule")).toBeVisible();
      await pickerEditor.getByTestId("tab-json").click();
      const pickerDraft = JSON.parse(await pickerEditor.getByTestId("textarea-rule-json").inputValue());
      assert.equal(pickerDraft.actions[0].type, "notify_user");
      await page.getByRole("button", { name: /cancel/i }).click();
      await expect(pickerEditor).toHaveCount(0);

      await page.getByTestId("choose-service-notify_user").click();
      const editor = page.locator(".automation-editor-dialog");
      await expect(editor).toBeVisible();
      await expect(editor).toHaveClass(/automation-rule-dialog/);
      await expect(editor.getByTestId("tab-builder")).toBeVisible();
      await expect(editor.getByTestId("tab-json")).toBeVisible();
      await editor.getByTestId("tab-json").click();
      const draft = JSON.parse(await editor.getByTestId("textarea-rule-json").inputValue());
      assert.equal(draft.actions[0].type, "notify_user");
      assert.ok(state.created.length === 0, "Opening a service must not save or activate a rule.");
      assert.ok(!requests.some(request => request.path.includes("status-list") || request.path.includes("draft-context/missions")),
        "Standalone Services must not call the owning Mission's legacy Status List engine.");
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(editor).toHaveCount(0);
      await page.screenshot({ path: path.join(screenshots, "automation-indexus-services-1280x720.png"), animations: "disabled" });
      await page.close();
    });

    await test("AI event proposal stays unactivated until a person saves disabled and explicitly activates a rule", async () => {
      const { page, state, requests } = await fixture();
      await page.getByTestId("tab-automation-assistant").click();
      await expect(page.getByTestId("automation-event-draft")).toBeVisible();
      await expect(page.getByTestId("select-event-module")).toBeVisible();
      await page.getByTestId("select-event-module").click();
      await page.getByRole("option", { name: /Task/ }).click();
      await page.getByTestId("select-event-type").click();
      await page.getByRole("option", { name: /status_changed|Status changed/ }).click();
      await page.getByTestId("select-event-country").click();
      await page.getByRole("option", { name: "SK" }).click();
      await page.locator("#event-draft-instruction").fill("Please notify the manager when the task becomes done.");
      await page.getByRole("button", { name: /generate|draft/i }).click();
      await expect.poll(() => state.aiDrafts.length).toBe(1);
      await expect(page.getByText(/unactivated proposal|proposal/i).first()).toBeVisible();
      assert.equal(state.aiDrafts[0].module, "task");
      assert.equal(state.aiDrafts[0].eventType, "status_changed");
      assert.equal(state.aiDrafts[0].countryCode, "SK");
      assert.equal(state.created.length, 0, "AI proposal generation must never save or activate a workflow.");
      assert.ok(requests.some(request => request.path === "/api/automation/draft-context/events/propose" && request.method === "POST"));
      assert.ok(!requests.some(request => request.path.includes("/draft-context/missions")),
        "The central assistant must not query Status List/Mission draft endpoints.");
      await page.screenshot({ path: path.join(screenshots, "automation-indexus-ai-draft-1280x720.png"), animations: "disabled" });

      await page.getByTestId("tab-automation-services").click();
      await page.getByTestId("choose-service-notify_user").click();
      await page.getByTestId("input-rule-name").fill("Human-reviewed event workflow");
      await expect(page.getByTestId("switch-enabled")).toHaveAttribute("aria-checked", "false");
      await page.getByTestId("button-save-rule").click();
      await expect.poll(() => state.created.length).toBe(1);
      assert.equal(state.created[0].enabled, false, "Saving reviewed AI-inspired work must leave it disabled until explicitly activated.");
      await page.getByTestId("tab-rules").click();
      await page.getByTestId("switch-enabled-rule-created").click();
      await expect.poll(() => state.patches.length).toBe(1);
      assert.deepEqual(state.patches[0], { id: "rule-created", body: { enabled: true } });
      await page.close();
    });

    await test("notification and metric-alert tabs expose their persisted standalone managers", async () => {
      const { page, state, requests } = await fixture();
      await page.getByTestId("tab-automation-notifications").click();
      await expect(page.getByTestId("toggle-rule-notification-rule-one")).toBeVisible();
      await page.screenshot({ path: path.join(screenshots, "automation-indexus-notifications-1280x720.png"), animations: "disabled" });
      await page.getByTestId("toggle-rule-notification-rule-one").click();
      await expect.poll(() => state.notificationToggles.length).toBe(1);
      assert.equal(state.notificationToggles[0].id, "notification-rule-one");
      await page.getByTestId("button-add-rule").click();
      await page.getByTestId("input-rule-name").fill("Fixture notification workflow");
      await page.getByTestId("button-wizard-next").click();
      await page.getByTestId("button-wizard-next").click();
      await page.getByTestId("target-role").click();
      await page.getByTestId("role-manager").click();
      await page.getByTestId("button-wizard-next").click();
      await page.getByTestId("input-notification-title").fill("Review new message");
      await page.getByTestId("input-notification-message").fill("A fixture message was received.");
      await page.getByTestId("switch-send-email").click();
      await page.getByTestId("button-save-rule").click();
      await expect.poll(() => state.notificationCreates.length).toBe(1);
      assert.equal(state.notificationCreates[0].name, "Fixture notification workflow");
      assert.equal(state.notificationCreates[0].triggerType, "new_email");
      assert.equal(state.notificationCreates[0].targetType, "role");
      assert.deepEqual(state.notificationCreates[0].targetRoles, ["manager"]);
      assert.equal(state.notificationCreates[0].notificationTitle, "Review new message");
      assert.equal(state.notificationCreates[0].notificationMessage, "A fixture message was received.");
      assert.equal(state.notificationCreates[0].sendEmail, true);

      await page.getByTestId("edit-rule-notification-rule-one").click();
      await page.getByTestId("input-rule-name").fill("Edited notification workflow");
      await page.getByTestId("button-wizard-next").click();
      await page.getByTestId("button-wizard-next").click();
      await page.getByTestId("button-wizard-next").click();
      await page.getByTestId("input-notification-title").fill("Updated notice title");
      await page.getByTestId("button-save-rule").click();
      await expect.poll(() => state.notificationUpdates.length).toBe(1);
      assert.equal(state.notificationUpdates[0].id, "notification-rule-one");
      assert.equal(state.notificationUpdates[0].body.name, "Edited notification workflow");
      assert.equal(state.notificationUpdates[0].body.notificationTitle, "Updated notice title");
      await page.getByTestId("delete-rule-notification-rule-created").click();
      await expect.poll(() => state.notificationDeletes.length).toBe(1);
      assert.equal(state.notificationDeletes[0], "notification-rule-created");
      await page.getByTestId("subtab-alert-rules").click();
      const overdueSwitch = page.getByRole("switch", { name: "Toggle Overdue tasks" });
      await expect(overdueSwitch).toBeVisible();
      await expect(page.getByRole("button", { name: "Create alert" })).toBeVisible();
      await page.screenshot({ path: path.join(screenshots, "automation-indexus-alerts-1280x720.png"), animations: "disabled" });
      await overdueSwitch.click();
      await expect.poll(() => state.alertToggles.length).toBe(1);
      assert.equal(state.alertToggles[0], "alert-rule-one");
      assert.ok(requests.some(request => request.path === "/api/notification-rules"));
      assert.ok(requests.some(request => request.path === "/api/alert-rules"));
      await page.close();
    });

    await test("alert manager creates an accurately configured alert and deletes an existing alert", async () => {
      const { page, state, requests } = await fixture();
      await page.getByTestId("tab-automation-notifications").click();
      await page.getByTestId("subtab-alert-rules").click();
      await page.getByRole("button", { name: "Create alert" }).click();
      await page.screenshot({ path: path.join(screenshots, "automation-indexus-alert-editor-1280x720.png"), animations: "disabled" });
      const alertDialog = page.getByRole("dialog");
      await alertDialog.getByRole("textbox").fill("Fixture overdue alert");
      await alertDialog.getByRole("combobox").nth(0).click();
      await page.getByRole("option", { name: /overdue tasks/i }).click();
      await alertDialog.getByRole("combobox").nth(1).click();
      await page.getByRole("option", { name: "gte" }).click();
      await alertDialog.getByRole("spinbutton").nth(0).fill("7");
      await alertDialog.getByRole("combobox").nth(2).click();
      await page.getByRole("option", { name: /every 6 hours/i }).click();
      await alertDialog.getByRole("button", { name: "Save alert" }).click();
      await expect.poll(() => state.alertCreates.length).toBe(1);
      assert.equal(state.alertCreates[0].name, "Fixture overdue alert");
      assert.equal(state.alertCreates[0].metricType, "overdue_tasks");
      assert.equal(state.alertCreates[0].comparisonOperator, "gte");
      assert.equal(state.alertCreates[0].thresholdValue, 7);
      assert.equal(state.alertCreates[0].checkFrequency, "every_6_hours");
      assert.equal(state.alertCreates[0].notificationPriority, "high");
      let confirmation = "";
      page.once("dialog", async dialog => { confirmation = dialog.message(); await dialog.accept(); });
      await page.getByRole("button", { name: "Delete Overdue tasks" }).click();
      await expect.poll(() => state.alertDeletes.length).toBe(1);
      assert.equal(state.alertDeletes[0], "alert-rule-one");
      assert.equal(confirmation, 'Delete "Overdue tasks"?');
      assert.ok(requests.some(request => request.path === "/api/alert-rules/alert-rule-one" && request.method === "DELETE"));
      await page.close();
    });

    await test("Rules and Runs tabs, run filters, and history detail stay functional", async () => {
      const { page, requests } = await fixture();
      await page.getByTestId("tab-rules").click();
      await expect(page.getByTestId("card-rule-rule-task")).toBeVisible();
      await expect(page.getByTestId("card-rule-rule-customer")).toBeVisible();
      assert.equal(await page.evaluate(() => window.fetch === window.__nativeFetch), true, "Fixture must not replace native fetch.");
      await page.getByTestId("tab-runs").click();
      await expect(page.getByTestId("row-globalrun-run-success")).toBeVisible();
      await page.getByTestId("select-runs-status").click();
      await page.getByRole("option", { name: "Failed" }).click();
      await expect(page.getByTestId("row-globalrun-run-failed")).toBeVisible();
      await expect(page.getByTestId("row-globalrun-run-success")).toHaveCount(0);
      await page.getByTestId("select-runs-rule").click();
      await page.getByRole("option", { name: "Customer welcome" }).click();
      await expect(page.getByTestId("text-runs-count")).toContainText("1 run");
      await page.getByTestId("tab-rules").click();
      fs.mkdirSync(screenshots, { recursive: true });
      await page.screenshot({ path: path.join(screenshots, "automation-indexus-rules-1280x720.png"), animations: "disabled" });
      await page.getByTestId("button-history-rule-task").click();
      await expect(page.getByText("Run history: Task status notify")).toBeVisible();
      await expect(page.getByTestId("row-run-run-success")).toBeVisible();
      await page.getByTestId("row-run-run-success").getByRole("button", { name: "Detail" }).click();
      await expect(page.locator("pre")).toContainText("fixture-task");
      assert.ok(requests.some(request => request.path === "/api/automation/runs" && request.search.includes("ruleId=rule-task")));
      await page.screenshot({ path: path.join(screenshots, "automation-indexus-history-1280x720.png"), animations: "disabled" });
      await page.close();
    });

    await test("builder supports module and country selection and JSON create payload", async () => {
      const { page, state } = await fixture();
      await page.getByTestId("tab-automation-services").click();
      await page.getByTestId("choose-service-notify_user").click();
      const editor = page.locator(".automation-editor-dialog");
      await expect(editor).toBeVisible();
      await page.getByTestId("input-rule-name").fill("Created in browser fixture");
      await page.getByTestId("select-country-SK").click();
      await editor.locator('[data-testid="rule-source-event"] .automation-step-toggle').click();
      await page.getByTestId("select-module").click();
      await page.getByRole("option", { name: "Customer" }).click();
      await expect(page.getByTestId("select-module")).toContainText("Customer");
      await page.getByTestId("tab-json").click();
      const json = page.getByTestId("textarea-rule-json");
      await expect.poll(async () => JSON.parse(await json.inputValue()).name).toBe("Created in browser fixture");
      let draft = JSON.parse(await json.inputValue());
      assert.equal(draft.name, "Created in browser fixture");
      await page.getByTestId("tab-builder").click();
      await expect(page.getByTestId("input-rule-name")).toHaveValue("Created in browser fixture");
      await page.getByTestId("tab-json").click();
      draft = JSON.parse(await json.inputValue());
      draft.description = "Edited through JSON";
      await json.fill(JSON.stringify(draft, null, 2));
      await page.getByTestId("button-save-rule").click();
      await expect(editor).toHaveCount(0);
      assert.equal(state.created.length, 1);
      assert.equal(state.created[0].name, "Created in browser fixture");
      assert.equal(state.created[0].module, "customer");
      assert.equal(state.created[0].countryCode, null);
      assert.deepEqual(state.created[0].countryCodes, ["SK"]);
      assert.equal(state.created[0].description, "Edited through JSON");
      assert.equal(state.created[0].trigger.entityType, "customer");
      assert.ok(state.created[0].actions.length > 0);
      await page.close();
    });

    await test("schedule and sentiment source configurations persist in create and edit payloads", async () => {
      const { page, state } = await fixture({ rules: [...rulesInitial, sentimentRule] });
      await page.getByTestId("tab-automation-services").click();
      await page.getByTestId("choose-service-notify_user").click();
      await page.getByTestId("input-rule-name").fill("Scheduled task review");
      await page.getByTestId("tab-json").click();
      const createJsonField = page.getByTestId("textarea-rule-json");
      await expect.poll(async () => JSON.parse(await createJsonField.inputValue()).name).toBe("Scheduled task review");
      const scheduled = JSON.parse(await createJsonField.inputValue());
      scheduled.module = "task";
      scheduled.countryCode = "SK";
      scheduled.countryCodes = ["SK"];
      scheduled.trigger = { type: "schedule", interval: "daily", mode: "once" };
      scheduled.conditions = null;
      scheduled.actions = [{ type: "notify_user", config: { title: "Review overdue work" } }];
      await createJsonField.fill(JSON.stringify(scheduled, null, 2));
      await page.getByTestId("button-save-rule").click();
      await expect.poll(() => state.created.length).toBe(1);
      assert.deepEqual(state.created[0].trigger, { type: "schedule", interval: "daily", mode: "once" });
      assert.deepEqual(state.created[0].countryCodes, ["SK"]);
      assert.equal(state.created[0].conditions, null);

      await page.getByTestId("tab-rules").click();
      await page.getByTestId("button-edit-rule-sentiment").click();
      await page.getByTestId("tab-json").click();
      const editJsonField = page.getByTestId("textarea-rule-json");
      await expect.poll(async () => JSON.parse(await editJsonField.inputValue()).name).toBe("Negative inbound sentiment");
      const sentiment = JSON.parse(await editJsonField.inputValue());
      sentiment.conditions = {
        all: [{ field: "newValues.type", op: "in", value: ["email", "sms", "inbound_call"] }],
      };
      await editJsonField.fill(JSON.stringify(sentiment, null, 2));
      await page.getByTestId("button-save-rule").click();
      await expect.poll(() => state.patches.length).toBe(1);
      assert.equal(state.patches[0].body.trigger.eventType, "sentiment.negative");
      assert.deepEqual(state.patches[0].body.conditions.all[0].value, ["email", "sms", "inbound_call"]);
      await page.close();
    });

    await test("sentiment channel picker edits a human-reviewed condition before save", async () => {
      const { page, state } = await fixture({ rules: [...rulesInitial, sentimentRule] });
      await page.getByTestId("tab-rules").click();
      await page.getByTestId("button-edit-rule-sentiment").click();
      const editor = page.locator(".automation-editor-dialog");
      await expect(editor.getByTestId("sentiment-source-picker")).toBeVisible();
      const inboundCall = editor.getByTestId("sentiment-source-inboundCall");
      await expect(inboundCall).toHaveAttribute("aria-pressed", "false");
      await inboundCall.click();
      await expect(inboundCall).toHaveAttribute("aria-pressed", "true");
      await page.getByTestId("button-save-rule").click();
      await expect.poll(() => state.patches.length).toBe(1);
      assert.equal(state.patches[0].id, "rule-sentiment");
      assert.deepEqual(state.patches[0].body.conditions.all[0].value, ["email", "sms", "inbound_call"]);
      await page.close();
    });

    await test("per-record schedule mode previews matching records before any save", async () => {
      const { page, state } = await fixture();
      await page.getByTestId("tab-rules").click();
      await page.getByTestId("button-edit-rule-task").click();
      await page.locator(".automation-trigger-switch").getByRole("button", { name: /schedule/i }).click();
      await page.getByTestId("select-schedule-mode").click();
      await page.getByRole("option", { name: /matching record/i }).click();
      await expect.poll(() => state.schedulePreviews.length, { timeout: 5000 }).toBeGreaterThan(0);
      const preview = state.schedulePreviews.at(-1);
      assert.equal(preview.trigger.type, "schedule");
      assert.equal(preview.trigger.mode, "per_record");
      assert.equal(preview.module, "task");
      assert.equal(state.patches.length, 0, "Previewing a schedule must not persist the draft.");
      await page.close();
    });

    await test("edit builder saves through JSON and enabled toggle sends PATCH payload", async () => {
      const { page, state } = await fixture();
      await page.getByTestId("tab-rules").click();
      await page.getByTestId("button-edit-rule-task").click();
      await expect(page.getByTestId("input-rule-name")).toHaveValue("Task status notify");
      await page.getByTestId("input-rule-name").fill("Task status edited");
      await page.getByTestId("input-rate-limit").fill("12");
      await page.getByTestId("tab-json").click();
      const jsonField = page.getByTestId("textarea-rule-json");
      await expect.poll(async () => JSON.parse(await jsonField.inputValue()).name).toBe("Task status edited");
      const json = JSON.parse(await jsonField.inputValue());
      json.description = "Edit via JSON";
      await jsonField.fill(JSON.stringify(json, null, 2));
      await page.getByTestId("button-save-rule").click();
      await expect(page.locator(".automation-editor-dialog")).toHaveCount(0);
      assert.equal(state.patches.length, 1);
      assert.equal(state.patches[0].id, "rule-task");
      assert.equal(state.patches[0].body.name, "Task status edited");
      assert.equal(state.patches[0].body.rateLimitPerHour, 12);
      assert.equal(state.patches[0].body.description, "Edit via JSON");

      await page.getByTestId("switch-enabled-rule-task").click();
      await expect.poll(() => state.patches.length).toBe(2);
      assert.deepEqual(state.patches[1], { id: "rule-task", body: { enabled: false } });
      await page.close();
    });

    await test("delete confirmation, run history, and nested dry-run use real API requests", async () => {
      const { page, state, requests } = await fixture();
      await page.getByTestId("tab-rules").click();
      let confirmation = "";
      page.on("dialog", async dialog => { confirmation = dialog.message(); await dialog.accept(); });
      await page.getByTestId("button-delete-rule-customer").click();
      await expect.poll(() => state.deletes.length).toBe(1);
      assert.equal(confirmation, 'Delete "Customer welcome"?');
      assert.ok(requests.some(request => request.path === "/api/automation/rules/rule-customer" && request.method === "DELETE"));

      await page.getByTestId("button-edit-rule-task").click();
      await page.getByTestId("button-open-dryrun").click();
      const dryRun = page.locator(".automation-dryrun-dialog");
      await expect(dryRun).toBeVisible();
      await expect(dryRun.locator(".task-modal-artwork")).toBeVisible();
      await page.getByTestId("textarea-dryrun-sample").fill(JSON.stringify({
        entityType: "task", entityId: "fixture-task", eventType: "status_changed",
        newValues: { status: "done" }, oldValues: { status: "pending" }, countryCode: "SK",
      }, null, 2));
      await page.getByTestId("button-run-dryrun").click();
      await expect(page.getByTestId("badge-condition-result")).toContainText("MATCH");
      assert.equal(state.dryRuns.length, 1);
      assert.equal(state.dryRuns[0].sampleEvent.entityId, "fixture-task");
      await page.screenshot({ path: path.join(screenshots, "automation-indexus-dryrun-1280x720.png"), animations: "disabled" });
      await page.getByRole("button", { name: "Close" }).last().click();
      await expect(dryRun).toHaveCount(0);
      await page.close();
    });

    await test("editor and dry-run header, footer, and full controls remain reachable at compact viewports and dark theme", async () => {
      const { page } = await fixture();
      await page.evaluate(() => document.documentElement.classList.add("dark"));
      await page.getByTestId("tab-rules").click();
      await page.getByTestId("button-edit-rule-task").click();
      const editor = page.locator(".automation-editor-dialog");
      const editorFooter = editor.locator(".task-modern-modal-footer");
      for (const scenario of [
        { width: 1280, height: 720, dark: false },
        { width: 1280, height: 720, dark: true },
        { width: 390, height: 700, dark: false },
        { width: 390, height: 700, dark: true },
      ]) {
        const viewport = { width: scenario.width, height: scenario.height };
        await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), scenario.dark);
        await page.setViewportSize(viewport);
        await editor.getByTestId("tab-builder").click();
        await editor.locator('[role="tabpanel"][data-state="active"]').evaluate(el => el.scrollTo({ top: 0, behavior: "instant" }));
        await page.waitForTimeout(250);
        await expect(editor.locator(".task-modal-artwork")).toBeVisible();
        await expect(page.getByRole("heading", { name: "Edit: Task status notify" })).toBeVisible();
        await expect(page.getByTestId("tab-builder")).toBeVisible();
        await expect(page.getByTestId("tab-json")).toBeVisible();
        await expect(editor.locator(".automation-workspace")).toBeVisible();
        await expect(editor.getByTestId("automation-preview-panel")).toHaveCount(1);
        await expect(editor.locator(".automation-preview-rail")).not.toBeVisible();
        await expect(editor.locator(".automation-step-when")).toBeVisible();
        await expect(editor.locator(".automation-step-if")).toBeVisible();
        await expect(editor.locator(".automation-step-then")).toBeVisible();
        await expect(page.getByTestId("button-save-rule-header")).toHaveCount(0);
        await expect(page.getByTestId("button-save-rule")).toBeVisible();
        await expect(editor.getByRole("button", { name: "Save rule", exact: true })).toHaveCount(1);
        await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
        const footerBox = await editorFooter.boundingBox();
        const saveBox = await page.getByTestId("button-save-rule").boundingBox();
        assert.ok(footerBox && saveBox);
        assert.ok(footerBox.y >= 0 && footerBox.y + footerBox.height <= viewport.height,
          `The modal footer must remain in the viewport at ${viewport.width}x${viewport.height}.`);
        assert.ok(saveBox.y + saveBox.height <= viewport.height);
        fs.mkdirSync(screenshots, { recursive: true });
        const nameField = await editor.getByTestId("input-rule-name").boundingBox();
        assert.ok(nameField && nameField.y > 0 && nameField.y + nameField.height < footerBox.y,
          "Opening Builder must show the rule's basic fields above the footer.");
        const formMetrics = await editor.evaluate(el => ({
          horizontalOverflow: el.scrollWidth - el.clientWidth,
          inputFontSize: parseFloat(getComputedStyle(el.querySelector('[data-testid="input-rule-name"]')).fontSize),
        }));
        assert.ok(formMetrics.horizontalOverflow <= 1, "The editor must not overflow horizontally.");
        assert.ok(formMetrics.inputFontSize >= 13, "Form typography must remain readable.");
        const theme = scenario.dark ? "dark" : "light";
        await page.screenshot({ path: path.join(screenshots, `automation-indexus-editor-${viewport.width}x${viewport.height}-${theme}.png`), animations: "disabled" });
        const previewPanel = editor.getByTestId("automation-preview-panel");
        await previewPanel.locator("summary").click();
        await expect(editor.locator(".automation-preview-rail")).toBeVisible();
        await expect(editor.locator(".automation-preview-rail")).toContainText("Task status notify");
        await expect(page.getByTestId("button-save-rule")).toBeVisible();
        await previewPanel.locator(".automation-inspector-tabs button").nth(1).click();
        await expect(previewPanel.locator(".automation-inspector-test")).toBeVisible();
        await previewPanel.locator(".automation-inspector-tabs button").first().click();
        await previewPanel.locator("summary").click();
      }
      const tabPanel = editor.locator('[role="tabpanel"][data-state="active"]');
      const panelMetrics = await tabPanel.evaluate(el => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
      assert.ok(panelMetrics.scrollHeight > panelMetrics.clientHeight, "Builder controls must use the scrollable editor body.");
      await tabPanel.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: "instant" }));
      await expect(page.getByTestId("input-rate-limit")).toBeVisible();
      const advancedField = await page.getByTestId("input-rate-limit").boundingBox();
      const footer = await editorFooter.boundingBox();
      assert.ok(advancedField && footer && advancedField.y < footer.y, "Advanced controls must be reachable above the fixed footer after scrolling.");
      await page.getByTestId("button-open-dryrun").click();
      const dryRun = page.locator(".automation-dryrun-dialog");
      await expect(dryRun).toBeVisible();
      await expect(dryRun.getByRole("heading", { name: "Dry-run: Task status notify" })).toBeVisible();
      await expect(dryRun.locator(".task-modern-modal-footer").getByRole("button", { name: "Close" })).toBeVisible();
      await page.close();
    });

    await test("rules and catalog HTTP failures do not throw browser errors or issue unrelated API calls", async () => {
      const { page: denied, requests: deniedRequests } = await fixture({
        rulesFailure: { status: 403, body: { error: "Automation permission denied" } },
      });
      await expect(denied.getByTestId("text-page-title")).toBeVisible();
      await denied.getByTestId("tab-rules").click();
      await expect(denied.getByTestId("card-rule-rule-task")).toHaveCount(0);
      await denied.close();

      const { page: unavailable, requests: failedRequests } = await fixture({
        catalogFailure: { status: 503, body: { error: "Automation catalog unavailable" } },
      });
      await unavailable.getByTestId("button-create-rule").click();
      await expect(unavailable.locator(".automation-service-dialog")).toHaveCount(0);
      await unavailable.close();
      assert.ok(deniedRequests.some(request => request.path === "/api/automation/rules"));
      assert.ok(failedRequests.some(request => request.path === "/api/automation/catalog"));
    });

    assert.deepEqual(pageErrors, [], "No browser pageerrors are allowed.");
    assert.deepEqual(unexpectedRequests, [], "Only the existing automation endpoints may be requested.");
    console.log(`Automation INDEXUS checks completed: ${cases.length} browser cases; 0 pageerrors; 0 unexpected API requests.`);
    console.log("Screenshots: .local/screenshots/automation-indexus-*.png");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });