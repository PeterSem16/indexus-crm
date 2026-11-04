import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pool } from "../db";
import { loadRecordActivity, parseRecordActivityScope, safeRecordActivityDetails } from "./agreement-workspace";

test("audit scope accepts only the two supported server-side modes", () => {
  assert.equal(parseRecordActivityScope(undefined), "all");
  assert.equal(parseRecordActivityScope("all"), "all");
  assert.equal(parseRecordActivityScope("status-list"), "status-list");
  for (const bad of ["", "status_list_", ["status-list"], {}, true, "status-list' OR 1=1"])
    assert.throws(() => parseRecordActivityScope(bad), /invalid_activity_scope/);
});

test("Status List audit projects scalar answer transitions and real outcomes without forwarding raw sources", () => {
  const input = { previous: true, value: false, itemNote: "Saved note", ruleName: "Reviewed rule",
    sourceLabel: "Saved source", ok: false, skipped: false, status: "failed", rawSource: "never-return",
    analysis: { private: "never-return" }, token: "never-return" };
  assert.deepEqual(safeRecordActivityDetails(input, "status_list_answer"), {
    previous: true, value: false, itemNote: "Saved note", ruleName: "Reviewed rule",
    sourceLabel: "Saved source", ok: false, skipped: false, status: "failed",
  });
  assert.deepEqual(safeRecordActivityDetails(input, "agreement_added"), {});
  assert.deepEqual(safeRecordActivityDetails({ value: { password: "never-return" } }, "status_list_answer"), {});
  assert.deepEqual(safeRecordActivityDetails({ status: ["failed"], ok: "false" }, "status_list_action"), {});
});

test("audit is bound in SQL before pagination, preserves Mission authorization and carries the exact cursor", async () => {
  const original = pool.query;
  let captured: { sql: string; values: unknown[] } | undefined;
  (pool as any).query = async (sql: string, values: unknown[]) => {
    captured = { sql, values };
    return { rows: Array.from({ length: 51 }, (_, n) => ({
      id: `mission:fixture-${n}`, action: "status_list_confirmation",
      createdAt: "2026-11-03T10:34:56.350Z", _cursorTime: "2026-11-03 10:34:56.350123",
      details: { confirmed: false },
    })) };
  };
  try {
    const cursor = { time: "2026-11-04 10:00:00.123456", id: "mission:next-page" };
    const page = await loadRecordActivity("hospital", "fixture-record", "fixture-user", "fixture-mission", cursor, "status-list");
    assert.equal(page.events.length, 50);
    assert.deepEqual(captured!.values, ["fixture-record", "fixture-user", "fixture-mission", "hospital", false, cursor.time, cursor.id, "status-list"]);
    assert.match(captured!.sql, /left\(s\.action,12\)='status_list_'/);
    assert.ok(captured!.sql.indexOf("$8::text") < captured!.sql.indexOf("ORDER BY s.created_at"));
    assert.match(captured!.sql, /c\.campaign_id IN \(SELECT id FROM authorized_missions\)/);
    assert.deepEqual(JSON.parse(Buffer.from(page.nextCursor!, "base64url").toString()), {
      time: "2026-11-03 10:34:56.350123", id: "mission:fixture-49",
    });
    await loadRecordActivity("clinic", "fixture-record", "fixture-user", undefined, null);
    assert.equal(captured!.values[7], "all");
  } finally { pool.query = original; }
});

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
