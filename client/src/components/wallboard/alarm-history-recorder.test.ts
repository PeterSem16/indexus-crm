import { describe, expect, it, vi } from "vitest";
import { AlarmHistoryRecorder, AlarmHistoryWriter, HISTORY_HEARTBEAT_MS } from "./alarm-history-recorder";
import type { WallboardAlarmHistoryEntry } from "@shared/wallboard-alarm-history";
import type { WallboardAlarmIncident } from "@shared/wallboard-alarms";

const start = Date.parse("2026-09-17T10:00:00Z");
const incident = (since = start): WallboardAlarmIncident => ({
  ruleId: "private-rule", name: "DO NOT EXPORT +421123456789", type: "min_online",
  since, value: 1, threshold: 2, agentIds: ["private-agent"], acknowledged: false, mutedUntil: null,
});
function harness() {
  const rows: WallboardAlarmHistoryEntry[] = [];
  let id = 0;
  const recorder = new AlarmHistoryRecorder(row => rows.push(row), () => `id-${++id}`);
  return { recorder, rows };
}

describe("personal observed alarm history", () => {
  it("records start once, throttles observations, preserves ack and mute after recovery", () => {
    const { recorder, rows } = harness();
    recorder.observe([incident()], start, () => "recovered");
    recorder.observe([incident()], start + 1000, () => "recovered");
    expect(rows).toHaveLength(1);
    recorder.silence("private-rule", start + 2000, true);
    recorder.silence("private-rule", start + 3000, false);
    recorder.silence("private-rule", start + 4000, false);
    expect(rows).toHaveLength(3);
    recorder.observe([], start + 5000, () => "recovered");
    expect(rows.at(-1)).toMatchObject({
      revision: 4, endReason: "recovered", endedAt: new Date(start + 5000).toISOString(),
      acknowledgedAt: new Date(start + 3000).toISOString(),
      mutedAt: new Date(start + 2000).toISOString(),
      mutedUntil: new Date(start + 302000).toISOString(),
    });
    expect(new Set(rows.map(row => row.incidentId)).size).toBe(1);
    expect(JSON.stringify(rows)).not.toMatch(/private|421123|agentIds|ruleId|"name"|"value"/);
  });

  it.each(["source_unavailable", "rule_changed"] as const)("does not invent recovery or elapsed time for %s", reason => {
    const { recorder, rows } = harness();
    recorder.observe([incident()], start, () => reason);
    recorder.observe([incident()], start + HISTORY_HEARTBEAT_MS, () => reason);
    recorder.observe([], start + 30_000, () => reason);
    expect(rows.at(-1)).toMatchObject({
      endReason: reason, endedAt: new Date(start + HISTORY_HEARTBEAT_MS).toISOString(),
    });
  });

  it("close is idempotent and a later observation has a new identity", () => {
    const { recorder, rows } = harness();
    recorder.observe([incident()], start, () => "recovered");
    recorder.close();
    recorder.close();
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ endReason: "observation_stopped", endedAt: new Date(start).toISOString() });
    recorder.observe([incident(start + 1000)], start + 1000, () => "recovered");
    expect(rows[2].incidentId).not.toBe(rows[0].incidentId);
  });

  it("does not count a browser timer suspension as observed duration", () => {
    const { recorder, rows } = harness();
    recorder.observe([incident()], start, () => "recovered");
    recorder.observe([incident()], start + 120_000, () => "recovered");
    expect(rows[1]).toMatchObject({
      endedAt: new Date(start).toISOString(), endReason: "observation_stopped",
    });
    expect(rows[2].startedAt).toBe(new Date(start + 120_000).toISOString());
    expect(rows[2].incidentId).not.toBe(rows[0].incidentId);
  });

  it("uses the latest local observation when closing between persisted heartbeats", () => {
    const { recorder, rows } = harness();
    recorder.observe([incident()], start, () => "recovered");
    recorder.observe([incident()], start + 3000, () => "recovered");
    expect(rows).toHaveLength(1);
    recorder.close();
    expect(rows[1].endedAt).toBe(new Date(start + 3000).toISOString());
  });

  it("replacement incident finishes old observation without mutating snapshots", () => {
    const { recorder, rows } = harness();
    recorder.observe([incident()], start, () => "rule_changed");
    recorder.observe([incident(start + 5000)], start + 5000, () => "rule_changed");
    expect(rows.map(row => row.revision)).toEqual([1, 2, 1]);
    expect(rows[0].endedAt).toBeNull();
    expect(rows[1].endReason).toBe("rule_changed");
  });
});

describe("scope-bound history writer", () => {
  it("does not bind the native request implementation to the writer instance", async () => {
    const { recorder, rows } = harness();
    recorder.observe([incident()], start, () => "recovered");
    let receiver: unknown = "not-called";
    const request = (async function(this: unknown) {
      receiver = this;
      return new Response("{}");
    }) as typeof fetch;
    const writer = new AlarmHistoryWriter("/history", vi.fn(), request);
    writer.enqueue(rows[0]);
    await writer.flush();
    expect(receiver).toBeUndefined();
  });

  it("coalesces revisions and retains newer changes arriving during a request", async () => {
    const { recorder, rows } = harness();
    recorder.observe([incident()], start, () => "recovered");
    recorder.silence("private-rule", start + 1000, true);
    let complete!: (response: Response) => void;
    const request = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { complete = resolve; }))
      .mockResolvedValue(new Response("{}"));
    const errors = vi.fn();
    const writer = new AlarmHistoryWriter("/api/wallboard/alarm-history?campaignId=A", errors, request);
    writer.enqueue(rows[0]);
    writer.enqueue(rows[1]);
    writer.enqueue(rows[0]);
    const pending = writer.flush();
    expect(JSON.parse(request.mock.calls[0][1].body).entries[0].revision).toBe(2);
    recorder.close();
    writer.enqueue(rows[2]);
    complete(new Response("{}"));
    await pending;
    await writer.flush();
    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(request.mock.calls[1][1].body).entries[0].revision).toBe(3);
    await writer.flush();
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0]).toContain("campaignId=A");
  });

  it("keeps retry IDs stable, reports errors, and backs off failed writes", async () => {
    const { recorder, rows } = harness();
    recorder.observe([incident()], start, () => "recovered");
    const request = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockResolvedValue(new Response("{}"));
    const errors = vi.fn();
    const writer = new AlarmHistoryWriter("/history", errors, request);
    writer.enqueue(rows[0]);
    await writer.flush();
    await writer.flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenLastCalledWith(true);
    await writer.flush(true);
    expect(request.mock.calls[0][1].body).toBe(request.mock.calls[1][1].body);
    expect(errors).toHaveBeenLastCalledWith(false);
  });

  it.each([401, 403])("never retries a forbidden observer (%s) into a new session", async status => {
    const { recorder, rows } = harness();
    recorder.observe([incident()], start, () => "recovered");
    const request = vi.fn().mockResolvedValue(new Response("{}", { status }));
    const writer = new AlarmHistoryWriter("/history", vi.fn(), request);
    writer.enqueue(rows[0]);
    await writer.flush();
    writer.enqueue(rows[0]);
    await writer.flush(true);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("bounds backlog to 100 and reports loss explicitly", async () => {
    const { recorder, rows } = harness();
    recorder.observe([incident()], start, () => "recovered");
    const request = vi.fn().mockResolvedValue(new Response("{}"));
    const errors = vi.fn();
    const writer = new AlarmHistoryWriter("/history", errors, request);
    for (let i = 0; i < 105; i++) writer.enqueue({ ...rows[0], incidentId: `id-${i}` });
    expect(errors).toHaveBeenCalledWith(true);
    await writer.flush();
    expect(JSON.parse(request.mock.calls[0][1].body).entries).toHaveLength(100);
    expect(errors).toHaveBeenLastCalledWith(true);
  });
});