import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pool } from "../db";
import { loadRecordActivity, safeRecordActivityDetails } from "./agreement-workspace";

test("removal audit records snapshot the item label and type instead of relying on its mutable live definition", () => {
  const source = readFileSync("server/routes.ts", "utf8");
  const removalAudit = source.slice(source.indexOf("// Log unconfirmation to history (F9)"));
  const block = removalAudit.slice(0, removalAudit.indexOf("return res.json"));
  assert.match(block, /confirmed: false/);
  for (const field of ["itemLabel", "itemDescription", "itemType"]) assert.ok(block.includes(field));
});

test("record activity preserves strict positive and negative historical booleans without leaking arbitrary metadata", () => {
  for (const confirmed of [true, false]) {
    const details = safeRecordActivityDetails({
      confirmed, itemLabel: "A saved answer", password: "never-return",
      token: "never-return", statusListItemId: "internal-id", unrelated: { private: "never-return" },
    });
    assert.deepEqual(details, { confirmed, itemLabel: "A saved answer" });
    assert.deepEqual(safeRecordActivityDetails(JSON.stringify({ confirmed })), { confirmed });
  }
  for (const confirmed of [undefined, null, "false", "true", 0, 1, {}])
    assert.deepEqual(safeRecordActivityDetails({ confirmed }), {});
});

test("the real record-activity projection retains both removal events and does not manufacture a confirmation", async () => {
  const original = pool.query;
  const calls: string[] = [];
  (pool as any).query = async (sql: string) => {
    calls.push(sql);
    return { rows: [
      { id: "mission:removed-2", action: "status_list_confirmation", module: "Nexus Pulse",
        actor: "Fixture agent", createdAt: "2026-11-03T10:34:56.586Z", _cursorTime: "2026-11-03T10:34:56.586000Z",
        details: { confirmed: false, statusListItemLabel: "Contract received by partner" } },
      { id: "mission:removed-1", action: "status_list_confirmation", module: "Nexus Pulse",
        actor: "Fixture agent", createdAt: "2026-11-03T10:34:56.350Z", _cursorTime: "2026-11-03T10:34:56.350000Z",
        details: { confirmed: false, statusListItemLabel: "Cooperation offered — considering" } },
      { id: "mission:confirmed", action: "status_list_confirmation", module: "Nexus Pulse",
        createdAt: "2026-10-01T09:28:31.171Z",
        details: { confirmed: true, statusListItemLabel: "Cooperation offered — considering" } },
    ] };
  };
  try {
    const page = await loadRecordActivity("clinic", "fixture-clinic", "fixture-user", "fixture-mission", null);
    assert.deepEqual(page.events.map(e => e.details.confirmed), [false, false, true]);
    assert.equal(page.events[0].createdAt, "2026-11-03T10:34:56.586Z");
    assert.equal(page.events[0].actor, "Fixture agent");
    assert.equal(calls.length, 1);
    assert.match(calls[0].trim(), /^WITH viewer/);
    assert.doesNotMatch(calls[0], /\b(?:UPDATE|DELETE|INSERT)\s/i);
  } finally { pool.query = original; }
});
