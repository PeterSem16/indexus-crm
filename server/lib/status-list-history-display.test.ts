import test from "node:test";
import assert from "node:assert/strict";
import { loadStatusListHistoryDisplay, resolveManualStatusListSource } from "./status-list-history-display";

test("old history labels are batched and cannot cross Mission boundaries", async () => {
  const calls: string[] = [];
  const db = { async query(sql: string) {
    calls.push(sql);
    if (sql.includes("FROM campaign_status_list_automations")) return { rows: [
      { id: "automation", campaign_id: "mission", status_list_item_id: "item", question_id: "question",
        action_type: "set_contact_status", disposition_id: "disposition" },
    ] };
    if (sql.includes("FROM campaign_status_list_questions")) return { rows: [
      { id: "question", campaign_id: "mission", question_text: "Question label", item_id: "item" },
    ] };
    if (sql.includes("FROM campaign_status_list_items")) return { rows: [
      { id: "item", campaign_id: "mission", label: "Step label" },
    ] };
    return { rows: [{ id: "disposition", code: "no_time", name: "No time", campaign_id: "mission" }] };
  } };
  const display = await loadStatusListHistoryDisplay(db, [
    { id: "one", action: "status_list_action", campaignId: "mission", metadata: { automationId: "automation" } },
    { id: "two", action: "status_list_action", campaignId: "other", metadata: { automationId: "automation" } },
    { id: "three", action: "status_list_answer", campaignId: "mission", metadata: { questionId: "question" } },
  ]);
  assert.equal(display.get("one")?.questionLabel, "Question label");
  assert.equal(display.get("one")?.dispositionName, "No time");
  assert.equal(display.get("two")?.itemLabel, null);
  assert.equal(display.get("two")?.dispositionName, null);
  assert.equal(display.get("three")?.questionLabel, "Question label");
  assert.equal(calls.length, 4);
});
test("manual provenance is validated against Mission and parent step before any status write", async () => {
  let values: unknown;
  const valid = await resolveManualStatusListSource({ async query(_sql, params) {
    values = params;
    return { rows: [{ id: "step", label: "Step at selection", question_id: "q", question_text: "Question at selection" }] };
  } }, { statusListItemId: "step", questionId: "q" }, "mission");
  assert.deepEqual(values, ["step", "mission", "q"]);
  assert.equal(valid.questionLabel, "Question at selection");
  assert.equal(valid.actionType, "set_contact_status");
  await assert.rejects(resolveManualStatusListSource({ async query() { return { rows: [] }; } },
    { statusListItemId: "foreign-step" }, "mission"), /not_in_mission/);
  await assert.rejects(resolveManualStatusListSource({ async query() { throw Error("must not query"); } },
    { statusListItemId: 99 }, "mission"), /invalid/);
});
