import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = (file: string) => readFileSync(resolve(projectRoot, file), "utf8");

test("standalone Automation exposes its supported generic modules and service families", () => {
  const capabilities = source("server/lib/automation-capabilities.ts");
  const routes = source("server/lib/automation-routes.ts");
  const engine = source("server/lib/automation-engine.ts");
  assert.match(capabilities, /communication:\s*\["email\.received", "sms\.received", "sentiment\.negative"\]/);
  assert.match(capabilities, /outbound\.started/);
  assert.match(routes, /inboundServices:\s*INBOUND_CALL_SERVICES/);
  assert.match(routes, /outboundServices:\s*OUTBOUND_CALL_SERVICES/);
  assert.match(routes, /EVENT_DRAFT_SOURCES/);
  assert.match(routes, /SCHEDULE_INTERVALS/);
  assert.match(routes, /perRecordModules:\s*SCHEDULE_RECORD_MODULES/);
  assert.match(engine, /claimScheduledRuleDue/);
  assert.match(engine, /validateRuleCapabilities/);
  assert.match(engine, /scheduleNextDueAt/);
  assert.match(source("shared/schema.ts"), /scheduleInterval: text\("schedule_interval"\)/);
  assert.match(source("server/index.ts"), /ADD COLUMN IF NOT EXISTS schedule_next_due_at/);
  assert.doesNotMatch(capabilities, /nexus_pulse|card\.opened|schedule_callback|status_list/);
  assert.doesNotMatch(routes, /PROPOSED_PULSE|statusListServices|STATUS_LIST_SERVICES/);
});

test("Status List confirmations stay on the published inline executor", () => {
  const routes = source("server/routes.ts");
  const engine = source("server/lib/automation-engine.ts");

  assert.match(routes, /db\.insert\(campaignContactStatusListState\)/);
  assert.match(routes, /executeStatusListItemAutomations\(\{/);
  assert.doesNotMatch(routes, /persistStatusListConfirmation|status-list-executor|registerStatusListEventRunner/);
  assert.doesNotMatch(source("shared/schema.ts"), /statusListExecutor|overrideCallbackDate|overrideCallbackNote/);
  assert.doesNotMatch(routes, /\/api\/automation\/status-list\/.*\/propose/);
  assert.doesNotMatch(engine, /registerStatusListEventRunner|recoverUnclaimedStatusListEvents|processStatusListEvent/);
  assert.match(engine, /event\.source === "status-list" \|\| event\.module === "status_list"/);
  assert.doesNotMatch(source("server/lib/automation-routes.ts"), /draft-context\/missions|status-list\/.*propose/);
});

test("standalone call and inbound communication event producers are retained", () => {
  for (const file of ["server/routes.ts", "server/storage.ts", "server/inbound-routes.ts", "server/lib/email-monitoring-service.ts"]) {
    assert.match(source(file), /inbound-communication-events|outbound-call-automation|emitInboundAutomation|call-analysis-sentiment|emitPersistedInboundEvent|emitOutboundCallLifecycle/);
  }
  assert.match(source("server/inbound-routes.ts"), /source:\s*"inbound-call"/);
  assert.doesNotMatch(source("server/lib/event-bus.ts"), /pulseOrigin/);
  assert.match(source("server/lib/email-monitoring-service.ts"), /storeInboundEmailOnce/);
});

test("published task sentiment and recipient/resolver boundaries remain enforced", () => {
  const storage = source("server/storage.ts");
  const routes = source("server/routes.ts");
  const taskSentiment = source("server/lib/task-sentiment.ts");

  assert.match(storage, /assertTaskRecipientAllowed\(tx,/);
  assert.match(storage, /assertTaskResolverAllowed\(tx,/);
  assert.match(routes, /assertTaskRecipientAllowed\(tx,/);
  assert.match(routes, /assertTaskResolverAllowed\(tx,/);
  assert.match(routes, /analyzeAndEmitTaskNegativeSentiment/);
  assert.match(taskSentiment, /eventType: "sentiment\.negative"/);
});