import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import {
  claimStandingRecordingForSave,
  loadStandingRecordingRecoveryCandidates,
} from "./standing-recording-store";

test("recovery filters saved rows before limit and atomically grants only one concurrent claim", async () => {
  assert.ok(process.env.DATABASE_URL, "Requires the development PostgreSQL database");
  const setupClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const clientA = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const clientB = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const schemaName = `standing_recording_${randomUUID().replaceAll("-", "")}`;
  await setupClient.connect();
  try {
    await setupClient.query(`CREATE SCHEMA "${schemaName}"`);
    await setupClient.query(`SET search_path TO "${schemaName}", public`);
    await setupClient.query(`
      CREATE TABLE call_logs (
        id varchar PRIMARY KEY,
        inbound_call_log_id varchar,
        is_forwarded boolean NOT NULL,
        status text NOT NULL,
        ended_at timestamp
      );
      CREATE TABLE inbound_call_logs (
        id varchar PRIMARY KEY,
        call_log_id varchar,
        metadata jsonb
      );
    `);
    await clientA.connect();
    await clientB.connect();
    await Promise.all([
      clientA.query(`SET search_path TO "${schemaName}", public`),
      clientB.query(`SET search_path TO "${schemaName}", public`),
    ]);
    const testDbA = drizzle(clientA, { schema });
    const testDbB = drizzle(clientB, { schema });
    const rows = Array.from({ length: 601 }, (_, index) => {
      const callLogId = `call_${index}`;
      const inboundCallLogId = `inbound_${index}`;
      const retryable = index === 600;
      return {
        callLogId,
        inboundCallLogId,
        state: retryable ? "recording" : "saved",
      };
    });
    const callLogValues = rows.map((row, index) => {
      const p = index * 2;
      return `($${p + 1}, $${p + 2}, true, 'completed', NOW() - INTERVAL '1 second')`;
    });
    const callLogParams = rows.flatMap(row => [row.callLogId, row.inboundCallLogId]);
    await setupClient.query(
      `INSERT INTO call_logs (id,inbound_call_log_id,is_forwarded,status,ended_at) VALUES ${callLogValues.join(",")}`,
      callLogParams,
    );
    const inboundValues = rows.map((row, index) => {
      const offset = index * 3;
      return `($${offset + 1}, $${offset + 2}, jsonb_build_object(
        'standingForward', true,
        'standingForwardRecording', jsonb_build_object(
          'authorized', true,
          'recordingName', $${offset + 3}::text,
          'state', '${row.state}',
          'campaignId', null,
          'pbxIdentity', jsonb_build_object('host', 'pbx.example', 'port', 8088)
        )
      ))`;
    });
    const inboundParams = rows.flatMap(row => [
      row.inboundCallLogId,
      row.callLogId,
      `mobile_${row.callLogId}_standing_1710000000000`,
    ]);
    await setupClient.query(
      `INSERT INTO inbound_call_logs (id,call_log_id,metadata) VALUES ${inboundValues.join(",")}`,
      inboundParams,
    );

    const candidates = await loadStandingRecordingRecoveryCandidates(testDbA);
    assert.deepEqual(candidates.map(row => row.callLogId), ["call_600"]);

    const candidate = candidates[0];
    const candidateMetadata = candidate.metadata as Record<string, any>;
    const identity = { host: "pbx.example", port: 8088 };
    const now = Date.now();
    const claim = (claimToken: string) => claimStandingRecordingForSave({
      inboundCallLogId: candidate.inboundCallLogId,
      callLogId: candidate.callLogId,
      recordingName: candidateMetadata.standingForwardRecording.recordingName,
      pbxIdentity: identity,
      claimToken,
      recoveryAttempts: 1,
      nextRecoveryAt: new Date(now + 30_000).toISOString(),
      claimUntil: new Date(now + 15 * 60_000).toISOString(),
      recovery: true,
    }, testDbA);
    const claimB = (claimToken: string) => claimStandingRecordingForSave({
      inboundCallLogId: candidate.inboundCallLogId,
      callLogId: candidate.callLogId,
      recordingName: candidateMetadata.standingForwardRecording.recordingName,
      pbxIdentity: identity,
      claimToken,
      recoveryAttempts: 1,
      nextRecoveryAt: new Date(now + 30_000).toISOString(),
      claimUntil: new Date(now + 15 * 60_000).toISOString(),
      recovery: true,
    }, testDbB);
    const outcomes = await Promise.all([claim("worker-a"), claimB("worker-b")]);
    assert.equal(outcomes.filter(Boolean).length, 1);
    const stored = await setupClient.query(
      "SELECT metadata->'standingForwardRecording'->>'state' AS state FROM inbound_call_logs WHERE id=$1",
      [candidate.inboundCallLogId],
    );
    assert.equal(stored.rows[0].state, "saving");
  } finally {
    await clientA.end().catch(() => {});
    await clientB.end().catch(() => {});
    await setupClient.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`).catch(() => {});
    await setupClient.end();
  }
});