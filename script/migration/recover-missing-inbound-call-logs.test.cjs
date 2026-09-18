#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { Client } = require("pg");
const { CLASSIFY_SQL, applyCandidate } = require("./recover-missing-inbound-call-logs.cjs");
const {
  classifyFixture,
  deterministicCallLogId,
} = require("./recover-missing-inbound-call-logs-helper.cjs");

const before = new Date("2025-01-02T00:00:00.000Z");
const base = {
  id: "inbound-1",
  callLogId: null,
  status: "completed",
  answeredAt: "2025-01-01T10:01:00.000Z",
  completedAt: "2025-01-01T10:05:00.000Z",
  enteredQueueAt: "2025-01-01T10:00:00.000Z",
  assignedAgentId: "user-1",
  callerNumber: "+421000000000",
  ariChannelId: "channel-1",
  metadata: { campaignId: "campaign-1" },
};
const context = {
  before,
  userIds: new Set(["user-1"]),
  campaignIds: new Set(["campaign-1"]),
  callLogs: [],
};

test("selects only fully attributable historical answered calls", () => {
  assert.equal(classifyFixture(base, context), "missing");
  assert.equal(classifyFixture({ ...base, answeredAt: null }, context), "missing_answered_at");
  assert.equal(classifyFixture({ ...base, metadata: {} }, context), "missing_campaign_metadata");
  assert.equal(
    classifyFixture({ ...base, metadata: { campaignId: "other" } }, context),
    "invalid_campaign",
  );
  assert.equal(
    classifyFixture({ ...base, assignedAgentId: "deleted-user" }, context),
    "invalid_user",
  );
});

test("duplicate gates precede recovery", () => {
  assert.equal(classifyFixture({ ...base, callLogId: "linked" }, context), "already_linked");
  assert.equal(
    classifyFixture(base, {
      ...context,
      callLogs: [{ inboundCallLogId: base.id }],
    }),
    "backlink_repair",
  );
  assert.equal(
    classifyFixture(base, {
      ...context,
      callLogs: [{ sipCallId: base.ariChannelId }],
    }),
    "sip_channel_duplicate",
  );
  assert.equal(
    classifyFixture({ ...base, ariChannelId: null }, {
      ...context,
      callLogs: [{
        direction: "inbound",
        userId: base.assignedAgentId,
        phoneNumber: base.callerNumber,
        inboundCallLogId: null,
        startedAt: "2025-01-01T10:02:00.000Z",
        endedAt: "2025-01-01T10:03:00.000Z",
      }],
    }),
    "ambiguous_overlap",
  );
});

test("deterministic IDs are stable and inbound-specific", () => {
  assert.match(deterministicCallLogId("abc"), /^[0-9a-f-]{36}$/);
  assert.equal(deterministicCallLogId("abc"), deterministicCallLogId("abc"));
  assert.notEqual(deterministicCallLogId("abc"), deterministicCallLogId("def"));
});

test("real recovery SQL restores history once and safely repairs backlinks in temporary tables", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    // Temporary relations shadow production-shaped names only on this connection.
    // The real recovery queries below cannot read or change application records.
    await client.query(`
      CREATE TEMP TABLE users (id text PRIMARY KEY) ON COMMIT DROP;
      CREATE TEMP TABLE campaigns (id text PRIMARY KEY) ON COMMIT DROP;
      CREATE TEMP TABLE inbound_queues (id text PRIMARY KEY, name text) ON COMMIT DROP;
      CREATE TEMP TABLE inbound_call_logs (
        id text PRIMARY KEY, call_log_id text, status text, answered_at timestamp,
        completed_at timestamp, entered_queue_at timestamp, assigned_agent_id text,
        caller_number text, ari_channel_id text, metadata jsonb, customer_id text,
        queue_id text, talk_duration_seconds integer, created_at timestamp
      ) ON COMMIT DROP;
      CREATE TEMP TABLE call_logs (
        id text PRIMARY KEY, user_id text, customer_id text, campaign_id text,
        phone_number text, direction text, status text, started_at timestamp,
        answered_at timestamp, ended_at timestamp, duration_seconds integer,
        sip_call_id text, inbound_queue_id text, inbound_queue_name text,
        inbound_call_log_id text, created_at timestamp, is_forwarded boolean,
        forwarded_to_number text
      ) ON COMMIT DROP;
      INSERT INTO users VALUES ('user-1');
      INSERT INTO campaigns VALUES ('campaign-1');
      INSERT INTO inbound_queues VALUES ('queue-1', 'Test queue');
      INSERT INTO inbound_call_logs VALUES (
        'inbound-1', NULL, 'completed', '2025-01-01 10:01:00',
        '2025-01-01 10:05:00', '2025-01-01 10:00:00', 'user-1',
        'test-caller', 'channel-1', '{"campaignId":"campaign-1"}', NULL,
        'queue-1', 240, '2025-01-01 10:00:00'
      );
    `);
    const classified = await client.query(CLASSIFY_SQL, [before]);
    assert.deepEqual(classified.rows, [{ reason: "missing", count: 1 }]);
    assert.equal(await applyCandidate(client, "inbound-1", before), "inserted");
    assert.equal(await applyCandidate(client, "inbound-1", before), "already_linked");
    const result = await client.query("SELECT * FROM call_logs");
    assert.equal(result.rowCount, 1);
    assert.equal(result.rows[0].user_id, "user-1");
    assert.equal(result.rows[0].campaign_id, "campaign-1");
    assert.equal(result.rows[0].inbound_queue_name, "Test queue");
    assert.equal(result.rows[0].duration_seconds, 240);
    assert.equal(result.rows[0].is_forwarded, false);
    assert.equal(result.rows[0].started_at.getTime(), new Date("2025-01-01T10:00:00Z").getTime());
    await client.query("UPDATE inbound_call_logs SET call_log_id = NULL");
    assert.equal(await applyCandidate(client, "inbound-1", before), "backlink_repaired");
    await client.query("UPDATE inbound_call_logs SET call_log_id = NULL");
    await client.query("INSERT INTO call_logs (id, inbound_call_log_id) VALUES ('duplicate', 'inbound-1')");
    assert.equal(await applyCandidate(client, "inbound-1", before), "ambiguous_inbound_links");
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end();
  }
});