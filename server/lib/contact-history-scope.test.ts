import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareContactHistory } from "./contact-history-scope";
const database = {
  query: async (sql: string, params: any[] = []) => {
    if (sql.includes("FROM users u CROSS JOIN campaigns")) return { rows: params[1] === "hidden" ? [] : [{
      role: "user", assigned_countries: ["SK"], country_codes: ["SK"], assigned: true,
      module_read: false, module_edit: false, name: `Mission ${params[1]}`,
    }] };
    throw new Error("Unexpected diagnostic query");
  },
} as any;
test("all history excludes unreadable Missions and never assigns unscoped rows to selected Mission", async () => {
  const history = await prepareContactHistory(database, "agent", [
    { id: "1", campaignId: "medical", action: "callback_change", metadata: { callbackDate: "2026-11-03T08:00:00Z" } },
    { id: "2", campaignId: "fmo", type: "call" },
    { id: "3", campaignId: "hidden", type: "email" },
    { id: "4", campaignName: "stale source", type: "email" },
  ]);
  assert.deepEqual(history.map(row => row.id), ["1", "2", "4"]);
  assert.equal(history[0].campaignName, "Mission medical");
  assert.equal(history[2].campaignId, null);
  assert.equal(history[2].campaignName, null);
  assert.equal(history[0].metadata.callbackDate, "2026-11-03T08:00:00Z");
});
test("legacy inbound callback date and historical status-list snapshots survive normalization", async () => {
  const result = await prepareContactHistory(database, "agent", [
    { id: "cb", action: "callback_set", callbackDate: "2026-11-03T08:00:00Z" },
    { id: "step", campaignId: "medical", action: "status_list_confirmation",
      metadata: { itemLabel: "Historical proposal label", confirmed: true,
        statusListHistory: { itemLabel: "Later renamed label" } } },
  ]);
  assert.equal(result[0].metadata.callbackDate, "2026-11-03T08:00:00Z");
  assert.match(result[1].content!, /Historical proposal label/);
  assert.doesNotMatch(result[1].content!, /Later renamed/);
});
