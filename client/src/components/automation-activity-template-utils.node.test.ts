import assert from "node:assert/strict";
import test from "node:test";
import {
  activityTemplateIconKind,
  activityTemplateSourceModule,
  filterActivityCatalogTemplates,
  activityTemplateMissingVariables,
} from "./automation-activity-template-utils";

const variables = [{ value: "activity.title", label: "Title" }, { value: "activity.status", label: "Status" }];
const catalog = [
  { id: "indexus-activity-email-analysis-email-summary-en", content: "{{activity.title}}" },
  { id: "indexus-activity-task-analysis-task-positive-en", content: "{{activity.status}}" },
  { id: "indexus-activity-email-call-call-completed-en", content: "{{activity.title}}" },
  { id: "indexus-activity-email-task-task-created-en", content: "{{activity.title}}" },
  { id: "indexus-activity-email-task-task-due-en", content: "{{activity.missing}}" },
  { id: "legacy-template", content: "{{not.available}}" },
];

test("all catalog entries stay visible and compatible source entries sort first", () => {
  assert.equal(activityTemplateSourceModule(catalog[0].id), "analysis");
  assert.equal(activityTemplateSourceModule(catalog[2].id), "call");
  assert.deepEqual(
    filterActivityCatalogTemplates(catalog, "communication", variables).map(template => template.id),
    [catalog[0].id, catalog[1].id, catalog[2].id, catalog[3].id, "legacy-template", catalog[4].id],
  );
  assert.deepEqual(
    filterActivityCatalogTemplates(catalog, "task", variables).map(template => template.id),
    [catalog[3].id, catalog[0].id, catalog[1].id, catalog[2].id, catalog[4].id, "legacy-template"],
  );
  assert.deepEqual(
    filterActivityCatalogTemplates(catalog, "call", variables).map(template => template.id),
    [catalog[2].id, catalog[0].id, catalog[1].id, catalog[3].id, "legacy-template", catalog[4].id],
  );
  assert.deepEqual(
    filterActivityCatalogTemplates(catalog, "contract", variables).map(template => template.id),
    [catalog[0].id, catalog[1].id, catalog[2].id, catalog[3].id, "legacy-template", catalog[4].id],
  );
});

test("unsupported entries report missing variables and all legacy templates get icons", () => {
  assert.equal(filterActivityCatalogTemplates(catalog, "task", variables).length, catalog.length);
  assert.deepEqual(activityTemplateMissingVariables(catalog[4], variables), ["activity.missing"]);
  assert.equal(activityTemplateIconKind("indexus-activity-email-call-call-inbound-en"), "inbound");
  assert.equal(activityTemplateIconKind("indexus-activity-email-call-call-outbound-en"), "outbound");
  assert.equal(activityTemplateIconKind("indexus-activity-task-analysis-task-summary-en"), "task");
  assert.equal(activityTemplateIconKind("indexus-activity-email-analysis-email-summary-en"), "email");
  assert.equal(activityTemplateIconKind("legacy-template", "email"), "email");
  assert.equal(activityTemplateIconKind("indexus-automation-email-call-inbound-missed"), "inbound");
  assert.equal(activityTemplateIconKind("indexus-task-template-urgent-review"), "task");
});
