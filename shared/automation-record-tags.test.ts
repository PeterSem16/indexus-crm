import test from "node:test";
import assert from "node:assert/strict";
import { RECORD_TAG_ENTITY_TYPES, visibleRecordTags, recordTagsContain, recordTagsLack, tagActionIssues } from "./automation-record-tags";
import { fieldsForEvent, operatorsForEvent, validateRuleCapabilities } from "../server/lib/automation-capabilities";
import { getAutomationRecordTagCopy } from "../client/src/i18n/automation-record-tag-copy";

test("Tags: all ten records, exact normalized membership, protected routing and seven languages", () => {
  assert.equal(RECORD_TAG_ENTITY_TYPES.length, 10);
  assert.deepEqual(visibleRecordTags(["group_id:g", "group:Team", "status_list", "back_office", "source_entity:clinic:c",
    " VIP ", "vip", "ＶＩＰ", "Needs   follow-up", "__internal"]), ["VIP", "Needs follow-up"]);
  assert.equal(recordTagsContain(["Urgent review"], "Urgent"), false);
  assert.equal(recordTagsContain(["ＶＩＰ", "Needs   follow-up"], "vip"), true);
  assert.equal(recordTagsContain(["Needs   follow-up"], "needs follow-up"), true);
  assert.equal(recordTagsLack(undefined, "VIP"), false);
  assert.equal(recordTagsLack([], "group_id:g"), false);
  assert.equal(recordTagsLack([], ""), false);
  assert.equal(recordTagsLack([], "VIP"), true);
  const keys = Object.keys(getAutomationRecordTagCopy("en")).sort();
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
    const copy = getAutomationRecordTagCopy(locale);
    assert.deepEqual(Object.keys(copy).sort(), keys);
    assert.ok(Object.values(copy).every(value => typeof value === "string" && value.length > 0));
  }
  for (const module of RECORD_TAG_ENTITY_TYPES) {
    const config = { recordTagActionVersion: 2, target: { mode: "event", entityType: module }, tags: ["VIP"], acknowledged: true };
    assert.deepEqual(tagActionIssues(config, module), []);
    assert.ok(fieldsForEvent(module, "updated").some(field => field.value === "newValues.tags" && field.type === "tags"));
    const rule = { module, trigger: { type: "event", entityType: module, eventType: "updated" },
      conditions: { field: "newValues.tags", op: "contains", value: "VIP" }, actions: [{ type: "add_tag", config }] };
    assert.deepEqual(validateRuleCapabilities(rule), [], module);
    assert.ok(validateRuleCapabilities({ ...rule, conditions: { ...rule.conditions, value: "group_id:g" } }).length);
    assert.ok(tagActionIssues({ ...config, tags: ["VIP", "vip"] }, module).length);
    assert.ok(tagActionIssues({ ...config, tags: ["source_entity:clinic:c"] }, module).length);
    assert.ok(tagActionIssues({ ...config, acknowledged: false }, module).length);
    assert.ok(tagActionIssues({ ...config, tags: ["{{newValues.title}}"] }, module).length);
  }
  assert.deepEqual(operatorsForEvent("updated", "tags").map(op => op.value), ["contains", "not_contains"]);
  assert.ok(!operatorsForEvent("updated", "string").some(op => op.value === "not_contains"));
});
