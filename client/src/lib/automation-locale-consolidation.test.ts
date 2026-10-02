import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { translations } from "../i18n/translations";

test("all seven locales retain the standalone automation namespaces and shared labels", () => {
  assert.equal(Object.keys(translations).length, 7);
  for (const [locale, dictionary] of Object.entries(translations)) {
    assert.equal(typeof dictionary.mpn.collaborator, "string", locale);
    assert.ok(dictionary.mpn.collaborator.trim(), locale);
    for (const namespace of ["automationServices", "automationCatalog", "automationDraft"]) {
      assert.equal(namespace in dictionary, true, `${locale}.${namespace}`);
    }
    assert.equal(typeof dictionary.automationServices.heading, "string", `${locale}.automationServices.heading`);
    assert.equal(typeof dictionary.automationServices.statusList.info, "string", `${locale}.automationServices.statusList.info`);
    assert.equal(typeof dictionary.automationServices.statusList.editorNotice, "string", `${locale}.automationServices.statusList.editorNotice`);
    assert.equal(typeof dictionary.automationServices.workspace.when, "string", `${locale}.automationServices.workspace.when`);
    assert.equal(typeof dictionary.automationServices.workspace.if, "string", `${locale}.automationServices.workspace.if`);
    assert.equal(typeof dictionary.automationServices.workspace.then, "string", `${locale}.automationServices.workspace.then`);
    assert.equal(typeof dictionary.automationServices.workspace.previewMustBeSafe, "string", `${locale}.automationServices.workspace.previewMustBeSafe`);
    assert.equal(typeof dictionary.automationServices.editor.conditionsReset, "string", `${locale}.automationServices.editor.conditionsReset`);
    assert.equal(typeof dictionary.automationCatalog.collaborator, "string", `${locale}.automationCatalog.collaborator`);
    assert.equal(typeof dictionary.automationDraft.eventIntro, "string", `${locale}.automationDraft.eventIntro`);
    for (const id of ["create_task", "notify_user", "send_email", "send_sms", "webhook", "update_entity", "assign_user", "add_tag", "remove_tag"]) {
      assert.equal(typeof dictionary.automationServices.names[id], "string", `${locale}.automationServices.names.${id}`);
      assert.ok(dictionary.automationServices.names[id].trim(), `${locale}.automationServices.names.${id}`);
    }
    assert.equal("statusListExecutor" in dictionary.campaigns.detail, false, locale);
    assert.equal(typeof dictionary.tasks.title, "string", locale);
  }
});

test("standalone automation restore retains the native IF/THEN workspace and full catalog prefill paths", () => {
  const page = readFileSync(new URL("../pages/automations.tsx", import.meta.url), "utf8");
  const catalog = readFileSync(new URL("../components/automation-service-catalog.tsx", import.meta.url), "utf8");
  assert.match(page, /data-testid="automation-workspace"/);
  assert.match(page, /data-testid="rule-source-event"/);
  assert.match(page, /data-testid="automation-if-step"/);
  assert.match(page, /data-testid="automation-then-step"/);
  assert.match(page, /onSelectInbound=\{\(service: InboundService\)/);
  assert.match(page, /onSelectOutbound=\{\(service: InboundService\)/);
  assert.match(page, /\/api\/automation\/schedule-preview/);
  assert.match(page, /select-schedule-mode/);
  assert.match(page, /select-recipient-target-/);
  assert.match(catalog, /choose-inbound-/);
  assert.match(catalog, /choose-outbound-/);
  assert.match(catalog, /data-testid="automation-managed-services"/);
  assert.match(catalog, /data-testid="automation-status-list-services"/);
  assert.doesNotMatch(page + catalog, /StatusListRuleDraftDialog|draft-context\/missions|status_list\/execute/i);
});

test("shared entity drawers and notification rules do not depend on excluded automation screens", () => {
  const drawer = readFileSync(new URL("../components/entity-detail-drawer.tsx", import.meta.url), "utf8");
  const notifications = readFileSync(new URL("../components/notification-center.tsx", import.meta.url), "utf8");
  assert.match(drawer, /<SheetTitle>\{t\.mpn\.collaborator\}<\/SheetTitle>/);
  assert.match(notifications, /<TabsContent value="rules"[^>]*>\s*<NotificationRulesManager \/>/);
  const assistant = readFileSync(new URL("../components/automation-draft-assistant.tsx", import.meta.url), "utf8");
  const eventDraft = readFileSync(new URL("../components/automation-event-draft-panel.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(assistant, /StatusListRuleDraftDialog|draft-context\/missions|status_list/);
  assert.match(eventDraft, /\/api\/automation\/draft-context\/events\/propose/);
  assert.match(eventDraft, /credentials:\s*"include"/);
  assert.doesNotMatch(eventDraft, /\/draft-context\/missions/);
  assert.doesNotMatch(notifications, /\/automations\?tab=notifications/);
});