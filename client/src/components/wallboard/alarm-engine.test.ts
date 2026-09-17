import { describe, expect, it } from "vitest";
import type { WallboardSnapshot } from "@shared/wallboard";
import {
  advanceAlarms,
  alarmScheduleActive,
  alarmSoundDue,
  createAlarmRuntime,
  silenceAlarm,
} from "./alarm-engine";
import type {
  WallboardAlarmRule,
  WallboardAlarmSettings,
} from "@shared/wallboard-alarms";
import {
  wallboardAlarmRuleSchema,
  wallboardAlarmSettingsSchema,
} from "@shared/wallboard-alarms";

const iso = (time: number) => new Date(time).toISOString();
const baseTime = Date.parse("2025-01-15T12:00:00.000Z");

function rule(overrides: Partial<WallboardAlarmRule> = {}): WallboardAlarmRule {
  return {
    id: "rule-1",
    name: "Test alarm",
    enabled: true,
    type: "min_online",
    threshold: 2,
    direction: "both",
    callEvent: "started",
    delaySeconds: 0,
    mode: "visual",
    repeatSeconds: 0,
    schedule: { enabled: false, days: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "17:00" },
    ...overrides,
  };
}

function snapshot(overrides: Partial<WallboardSnapshot> = {}): WallboardSnapshot {
  return {
    generatedAt: iso(baseTime),
    scope: { campaignId: null, campaignName: null },
    campaigns: [],
    agents: [
      {
        id: "online",
        name: "Online",
        campaignIds: [],
        campaignNames: [],
        state: "available",
        stateSince: iso(baseTime - 60_000),
        direction: null,
        connected: true,
        avatarUrl: null,
        sessionStartedAt: iso(baseTime - 3_600_000),
        lastMissionAt: null,
        todayMissionSeconds: 0,
        todayAccruing: true,
      },
      {
        id: "offline",
        name: "Offline",
        campaignIds: [],
        campaignNames: [],
        state: "offline",
        stateSince: iso(baseTime - 60_000),
        direction: null,
        connected: false,
        avatarUrl: null,
        sessionStartedAt: null,
        lastMissionAt: iso(baseTime - 3_600_000),
        todayMissionSeconds: 0,
        todayAccruing: false,
      },
    ],
    inbound: [],
    queue: { waiting: 0, longestWaitSeconds: 0, answeredToday: 0, averageWaitSeconds: 0 },
    callActivity: {
      inbound: { startedAt: null, connectedAt: null },
      outbound: { startedAt: null, connectedAt: null },
    },
    source: { live: true, warning: null },
    ...overrides,
  };
}

function settings(...rules: WallboardAlarmRule[]): WallboardAlarmSettings {
  return { startupGraceSeconds: 0, volume: 0.5, rules };
}

function run(
  alarm: WallboardAlarmRule,
  data: Partial<WallboardSnapshot>,
  now = baseTime,
  runtime = createAlarmRuntime(),
  options: { startupGraceSeconds?: number; stale?: boolean } = {},
) {
  return advanceAlarms(
    runtime,
    settings(alarm),
    snapshot(data),
    now,
    options.stale ?? false,
  );
}

describe("wallboard alarm engine", () => {
  it("enforces the shared rule contract for count thresholds, repeats, and IDs", () => {
    expect(wallboardAlarmRuleSchema.safeParse(rule({ type: "max_break", threshold: 0 })).success).toBe(true);
    expect(wallboardAlarmRuleSchema.safeParse(rule({ type: "min_online", threshold: 0 })).success).toBe(false);
    expect(wallboardAlarmRuleSchema.safeParse(rule({ type: "no_calls", repeatSeconds: 1 })).success).toBe(false);
    expect(wallboardAlarmSettingsSchema.safeParse(settings(
      rule({ id: "duplicate" }),
      rule({ id: "duplicate" }),
    )).success).toBe(false);
  });

  it("uses exact threshold semantics for staffing, duration, queue, and no-call rules", () => {
    const agents = [
      snapshot().agents[0],
      { ...snapshot().agents[0], id: "available-2" },
      { ...snapshot().agents[0], id: "break", state: "break" as const },
    ];
    expect(run(rule({ type: "min_online", threshold: 2 }), { agents }).incidents).toHaveLength(0);
    expect(run(rule({ type: "min_online", threshold: 4 }), { agents }).incidents).toHaveLength(1);
    expect(run(rule({ type: "min_available", threshold: 2 }), { agents }).incidents).toHaveLength(0);
    expect(run(rule({ type: "min_available", threshold: 3 }), { agents }).incidents).toHaveLength(1);
    expect(run(rule({ type: "max_break", threshold: 1 }), { agents }).incidents).toHaveLength(0);
    expect(run(rule({ type: "max_break", threshold: 0 }), { agents }).incidents).toHaveLength(1);

    const longBreak = { ...snapshot().agents[0], id: "long-break", state: "break" as const, stateSince: iso(baseTime - 60_000) };
    expect(run(rule({ type: "long_break", threshold: 60 }), { agents: [longBreak] }).incidents).toHaveLength(1);
    expect(run(rule({ type: "long_break", threshold: 61 }), { agents: [longBreak] }).incidents).toHaveLength(0);
    expect(run(rule({ type: "queue_wait", threshold: 60 }), {
      queue: { waiting: 1, longestWaitSeconds: 60, answeredToday: 0, averageWaitSeconds: 0 },
    }).incidents).toHaveLength(1);
    expect(run(rule({ type: "queue_wait", threshold: 61 }), {
      queue: { waiting: 1, longestWaitSeconds: 60, answeredToday: 0, averageWaitSeconds: 0 },
    }).incidents).toHaveLength(0);
    expect(run(rule({ type: "no_calls", threshold: 60 }), {
      callActivity: { inbound: { startedAt: iso(baseTime - 60_000), connectedAt: null }, outbound: { startedAt: null, connectedAt: null } },
    }).incidents).toHaveLength(1);
  });

  it("counts no-call seconds from started or connected events, by direction or both", () => {
    const activity = {
      inbound: { startedAt: iso(baseTime - 100_000), connectedAt: iso(baseTime - 30_000) },
      outbound: { startedAt: iso(baseTime - 80_000), connectedAt: iso(baseTime - 70_000) },
    };
    expect(run(rule({ type: "no_calls", threshold: 90, direction: "inbound", callEvent: "started" }), { callActivity: activity }).incidents).toHaveLength(1);
    expect(run(rule({ type: "no_calls", threshold: 90, direction: "inbound", callEvent: "connected" }), { callActivity: activity }).incidents).toHaveLength(0);
    expect(run(rule({ type: "no_calls", threshold: 75, direction: "both", callEvent: "started" }), { callActivity: activity }).incidents).toHaveLength(1);
    expect(run(rule({ type: "no_calls", threshold: 75, direction: "both", callEvent: "connected" }), { callActivity: activity }).incidents).toHaveLength(0);
  });

  it("uses a no-history startup baseline and does not advance during startup grace", () => {
    const alarm = rule({ type: "no_calls", threshold: 10 });
    const first = advanceAlarms(createAlarmRuntime(), settings(alarm), snapshot(), baseTime, false);
    expect(first.incidents).toHaveLength(0);
    expect(first.runtime.startedAt).toBe(baseTime);
    const duringGrace = advanceAlarms(
      first.runtime,
      { ...settings(alarm), startupGraceSeconds: 30 },
      snapshot(),
      baseTime + 20_000,
      false,
    );
    expect(duringGrace.incidents).toHaveLength(0);
    const afterGrace = advanceAlarms(
      duringGrace.runtime,
      { ...settings(alarm), startupGraceSeconds: 30 },
      snapshot(),
      baseTime + 31_000,
      false,
    );
    expect(afterGrace.incidents).toHaveLength(1);
  });

  it("requires a condition to remain true for its sustained delay and resets it on recovery", () => {
    const alarm = rule({ delaySeconds: 10 });
    const first = run({ ...alarm, delaySeconds: 0 }, {}, baseTime);
    expect(first.incidents).toHaveLength(1);
    // Make the first transition at an explicit pending timestamp with a
    // non-zero delay; the engine must not turn a recovered condition into an
    // incident by carrying pending time across snapshots.
    const delayed = rule({ delaySeconds: 10, threshold: 2 });
    const pending = run(delayed, {}, baseTime);
    expect(pending.incidents).toHaveLength(0);
    const recovered = run(delayed, { agents: snapshot().agents.concat({
      ...snapshot().agents[0], id: "online-2",
    }) }, baseTime + 5_000, pending.runtime);
    expect(recovered.incidents).toHaveLength(0);
    const retriggered = run(delayed, {}, baseTime + 16_000, recovered.runtime);
    expect(retriggered.incidents).toHaveLength(0);
    const incident = run(delayed, {}, baseTime + 26_000, retriggered.runtime);
    expect(incident.incidents).toHaveLength(1);
  });

  it("suspends only alarm types dependent on unavailable queue/call telemetry", () => {
    const alarms = settings(
      rule({ id: "staff", type: "min_online", threshold: 2 }),
      rule({ id: "queue", type: "queue_wait", threshold: 1 }),
      rule({ id: "inbound-calls", type: "no_calls", direction: "inbound", threshold: 1 }),
      rule({ id: "outbound-calls", type: "no_calls", direction: "outbound", threshold: 1 }),
    );
    const result = advanceAlarms(
      createAlarmRuntime(),
      alarms,
      snapshot({
        source: { live: true, warning: "queue unavailable" },
        callActivity: {
          inbound: { startedAt: iso(baseTime - 10_000), connectedAt: null },
          outbound: { startedAt: iso(baseTime - 10_000), connectedAt: null },
        },
      }),
      baseTime,
      false,
    );
    expect(result.suspended).toBe(true);
    expect(result.incidents.map((incident) => incident.ruleId)).toEqual(["staff", "outbound-calls"]);
    const stale = advanceAlarms(createAlarmRuntime(), alarms, snapshot(), baseTime, true);
    expect(stale.incidents).toHaveLength(0);
    expect(stale.suspended).toBe(true);
  });

  it("evaluates the complete agent snapshot, including offline agents", () => {
    const complete = snapshot();
    const result = run(rule({ type: "min_online", threshold: 2 }), { agents: complete.agents });
    expect(result.incidents).toHaveLength(1);
    const filtered = run(rule({ type: "min_online", threshold: 1 }), { agents: complete.agents.filter(agent => agent.state !== "offline") });
    expect(filtered.incidents).toHaveLength(0);
  });

  it("assigns overnight schedules to their starting weekday and handles DST", () => {
    const overnight = rule({
      schedule: { enabled: true, days: [1], startTime: "22:00", endTime: "02:00" },
    });
    // Monday 23:00 and Tuesday 01:00 are one Monday-starting window.
    expect(alarmScheduleActive(overnight, Date.parse("2025-01-13T22:00:00Z"))).toBe(true);
    expect(alarmScheduleActive(overnight, Date.parse("2025-01-14T00:00:00Z"))).toBe(true);
    expect(alarmScheduleActive(overnight, Date.parse("2025-01-14T03:00:00Z"))).toBe(false);
    // The Sunday window starts at 23:00 local before the spring transition.
    // 01:30 local exists after the transition; 04:30 local is past its end.
    const dst = rule({
      schedule: { enabled: true, days: [0], startTime: "23:00", endTime: "04:00" },
    });
    expect(alarmScheduleActive(dst, Date.parse("2025-03-30T21:30:00Z"))).toBe(true);
    expect(alarmScheduleActive(dst, Date.parse("2025-03-30T23:30:00Z"))).toBe(true);
    expect(alarmScheduleActive(dst, Date.parse("2025-03-31T02:30:00Z"))).toBe(false);
  });

  it("keeps acknowledgement until recovery, then allows a retrigger", () => {
    const alarm = rule({ threshold: 2 });
    const active = run(alarm, {}, baseTime);
    const acknowledgedRuntime = silenceAlarm(active.runtime, alarm.id, baseTime, false);
    expect(acknowledgedRuntime.tracks[alarm.id].incident?.acknowledged).toBe(true);
    const stillActive = run(alarm, {}, baseTime + 1_000, acknowledgedRuntime);
    expect(stillActive.incidents[0].acknowledged).toBe(true);
    const recovered = run(alarm, { agents: snapshot().agents.concat({
      ...snapshot().agents[0], id: "online-2",
    }) }, baseTime + 2_000, stillActive.runtime);
    expect(recovered.incidents).toHaveLength(0);
    const retriggered = run(alarm, {}, baseTime + 3_000, recovered.runtime);
    expect(retriggered.incidents[0].acknowledged).toBe(false);
  });

  it("mutes for five minutes and resumes sound after expiry", () => {
    const alarm = rule({ mode: "sound", repeatSeconds: 0 });
    const active = run(alarm, {}, baseTime);
    const mutedRuntime = silenceAlarm(active.runtime, alarm.id, baseTime, true);
    const muted = mutedRuntime.tracks[alarm.id].incident!;
    expect(muted.mutedUntil).toBe(baseTime + 300_000);
    expect(alarmSoundDue(alarm, muted, baseTime + 299_999, undefined)).toBe(false);
    expect(alarmSoundDue(alarm, muted, baseTime + 300_000, undefined)).toBe(true);
  });

  it("only plays sound rules when enabled, once per incident or at repeat interval", () => {
    const visual = rule({ mode: "visual" });
    const active = run(visual, {}, baseTime).incidents[0];
    expect(alarmSoundDue(visual, active, baseTime, undefined)).toBe(false);
    const sound = { ...visual, mode: "sound" as const, repeatSeconds: 0 };
    expect(alarmSoundDue(sound, active, baseTime, undefined)).toBe(true);
    expect(alarmSoundDue(sound, active, baseTime + 100_000, baseTime)).toBe(false);
    const repeating = { ...sound, repeatSeconds: 60 };
    expect(alarmSoundDue(repeating, active, baseTime + 59_999, baseTime)).toBe(false);
    expect(alarmSoundDue(repeating, active, baseTime + 60_000, baseTime)).toBe(true);
    expect(alarmSoundDue({ ...sound, enabled: false }, active, baseTime, undefined)).toBe(false);
  });

  it("deleting a rule drops its track and editing it resets pending/incident state", () => {
    const alarm = rule({ delaySeconds: 10 });
    const pending = run(alarm, {}, baseTime);
    const deleted = advanceAlarms(pending.runtime, settings(), snapshot(), baseTime + 1_000, false);
    expect(deleted.runtime.tracks[alarm.id]).toBeUndefined();
    const edited = advanceAlarms(
      pending.runtime,
      settings({ ...alarm, threshold: 3 }),
      snapshot(),
      baseTime + 1_000,
      false,
    );
    expect(edited.runtime.tracks[alarm.id].pendingSince).toBe(baseTime + 1_000);
    expect(edited.incidents).toHaveLength(0);
  });
});