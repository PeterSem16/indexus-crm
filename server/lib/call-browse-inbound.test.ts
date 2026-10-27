import test from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import type { InboundCallLog } from "@shared/schema";
import { callBrowsePageQuery, inboundBrowseCampaignId, inboundOnlyBrowseEntry } from "./call-browse-inbound";

function fixture(overrides: Partial<InboundCallLog> = {}): InboundCallLog {
  return {
    id: "inbound-test", queueId: "queue-test", callLogId: null,
    callerNumber: "+421900000000", callerName: null, customerId: null,
    assignedAgentId: null, ariChannelId: null, didNumber: null,
    status: "abandoned", enteredQueueAt: new Date("2026-10-27T09:39:48Z"),
    answeredAt: null, completedAt: new Date("2026-10-27T09:40:15Z"),
    waitDurationSeconds: 26, talkDurationSeconds: 0, queuePosition: null,
    abandonReason: "caller_left_stasis", transferredTo: null,
    calledBack: false, calledBackAt: null, calledBackByUserId: null,
    metadata: { campaignId: "mission-at-call-time" },
    createdAt: new Date("2026-10-27T09:39:48Z"),
    ...overrides,
  };
}
const labels = { queueName: "Queue", campaignName: "Mission", customerName: null };

test("unlinked abandoned inbound is visible but never fabricates answer, audio or assignment", () => {
  const entry = inboundOnlyBrowseEntry(fixture(), labels);
  assert.equal(entry.id, "inbound:inbound-test");
  assert.equal(entry.recordSource, "inbound");
  assert.equal(entry.status, "abandoned");
  assert.equal(entry.answeredAt, null);
  assert.equal(entry.durationSeconds, 0);
  assert.equal(entry.ringTimeSeconds, 27);
  assert.equal(entry.userId, null);
  assert.equal(entry.isForwarded, false);
  assert.equal(entry.hasRecording, false);
  assert.equal(entry.recording, null);
  assert.equal(entry.isImportant, false);
  assert.equal(entry.campaignContactId, null);
  assert.deepEqual(entry.dispositionSubstatuses, []);
});

test("inconsistent legacy talk counters cannot turn abandon into a conversation", () => {
  const entry = inboundOnlyBrowseEntry(fixture({
    answeredAt: new Date("2026-10-27T09:39:49Z"), talkDurationSeconds: 999,
  }), labels);
  assert.equal(entry.durationSeconds, 0);
  assert.equal(entry.answeredAt, null);
});

test("Mission attribution uses only verified call-time metadata", () => {
  assert.equal(inboundBrowseCampaignId({ campaignId: "historical" }), "historical");
  for (const metadata of [
    null, {}, { campaignId: "" }, { campaignId: 123 },
    { campaignId: "historical", campaignClassificationConflict: true },
    { campaignId: "historical", campaignClassificationUnverified: true },
  ]) {
    assert.equal(inboundBrowseCampaignId(metadata), null);
    const entry = inboundOnlyBrowseEntry(fixture({ metadata }), labels);
    assert.equal(entry.campaignId, null);
    assert.equal(entry.campaignName, null);
  }
});

test("forwarding labels require persisted evidence, not a queue's current settings", () => {
  assert.equal(inboundOnlyBrowseEntry(fixture(), labels).isForwarded, false);
  assert.equal(inboundOnlyBrowseEntry(fixture({
    metadata: { campaignId: "historical", standingForward: true },
  }), labels).isForwarded, true);
});

test("combined SQL binds parameters and applies both ownership/date scopes before pagination", () => {
  const query = new PgDialect().sqlToQuery(callBrowsePageQuery({
    userId: "viewer-not-sql", isPrivileged: false,
    dateFrom: new Date("2026-10-26T23:00:00Z"),
    dateTo: new Date("2026-10-27T22:59:59Z"), limit: 2, offset: 3,
  }));
  assert.match(query.sql, /UNION ALL/);
  assert.match(query.sql, /NOT EXISTS/i);
  assert.match(query.sql, /"call_logs"."inbound_call_log_id"/);
  assert.match(query.sql, /"inbound_call_logs"."call_log_id"/);
  assert.match(query.sql, /"call_logs"."user_id" = \$/);
  assert.match(query.sql, /"inbound_call_logs"."assigned_agent_id" = \$/);
  assert.equal(query.params.filter(p => p === "viewer-not-sql").length, 2);
  assert.equal(query.sql.includes("viewer-not-sql"), false);
  assert.deepEqual(query.params.slice(-2), [2, 3]);
});

test("combined paging executes with real SQL: no duplicates, privilege leaks or missing interleaved rows", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout='15s'");
    // Temporary tables shadow application tables only in this dedicated session.
    await client.query(`CREATE TEMP TABLE call_logs (
      id varchar PRIMARY KEY, started_at timestamp NOT NULL,
      user_id varchar, inbound_call_log_id varchar
    ) ON COMMIT DROP`);
    await client.query(`CREATE TEMP TABLE inbound_call_logs (
      id varchar PRIMARY KEY, entered_queue_at timestamp NOT NULL,
      assigned_agent_id varchar, call_log_id varchar
    ) ON COMMIT DROP`);
    await client.query(`INSERT INTO call_logs VALUES
      ('canonical-new','2026-10-27 10:05:00','viewer',NULL),
      ('canonical-old','2026-10-27 10:01:00','other','inbound-linked-by-parent'),
      ('canonical-linked','2026-10-27 10:00:00','other',NULL)`);
    await client.query(`INSERT INTO inbound_call_logs VALUES
      ('inbound-unassigned','2026-10-27 10:04:00',NULL,NULL),
      ('inbound-own','2026-10-27 10:03:00','viewer',NULL),
      ('inbound-other','2026-10-27 10:02:00','other',NULL),
      ('inbound-linked-by-parent','2026-10-27 10:01:00','viewer',NULL),
      ('inbound-linked-by-child','2026-10-27 10:00:00','viewer','canonical-linked'),
      ('inbound-outside','2026-10-26 23:00:00','viewer',NULL)`);
    async function page(privileged: boolean, offset: number, limit = 2) {
      const q = new PgDialect().sqlToQuery(callBrowsePageQuery({
        userId: "viewer", isPrivileged: privileged,
        dateFrom: new Date("2026-10-27T00:00:00Z"),
        dateTo: new Date("2026-10-27T23:59:59Z"), offset, limit,
      }));
      return (await client.query(q.sql, q.params)).rows;
    }
    const all = [...await page(true, 0), ...await page(true, 2), ...await page(true, 4)];
    assert.deepEqual(all.map(r => r.id), [
      "canonical-new", "inbound-unassigned", "inbound-own",
      "inbound-other", "canonical-old", "canonical-linked",
    ]);
    assert.deepEqual((await page(false, 0, 20)).map(r => r.id),
      ["canonical-new", "inbound-own"]);
    // Conversion of an orphan to canonical history must keep exactly one row.
    await client.query(`INSERT INTO call_logs VALUES
      ('recovered','2026-10-27 10:03:00','viewer','inbound-own')`);
    assert.deepEqual((await page(false, 0, 20)).map(r => r.id),
      ["canonical-new", "recovered"]);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});
