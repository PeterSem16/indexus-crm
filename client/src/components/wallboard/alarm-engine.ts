import type { WallboardSnapshot } from "@shared/wallboard";
import type {
  WallboardAlarmIncident, WallboardAlarmRule, WallboardAlarmSettings,
} from "@shared/wallboard-alarms";

export interface AlarmRuntime {
  startedAt: number | null;
  tracks: Record<string, {
    fingerprint: string;
    startedAt: number;
    pendingSince: number | null;
    incident: WallboardAlarmIncident | null;
  }>;
}
export function createAlarmRuntime(): AlarmRuntime {
  return { startedAt: null, tracks: {} };
}

/** End-exclusive local windows; overnight windows belong to their starting weekday. */
export function alarmScheduleActive(rule: WallboardAlarmRule, now: number): boolean {
  if (!rule.schedule.enabled) return true;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Bratislava", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const minute = Number(get("hour")) * 60 + Number(get("minute"));
  const parse = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const start = parse(rule.schedule.startTime);
  const end = parse(rule.schedule.endTime);
  if (start === end) return rule.schedule.days.includes(day);
  if (start < end) return rule.schedule.days.includes(day) && minute >= start && minute < end;
  return minute >= start
    ? rule.schedule.days.includes(day)
    : minute < end && rule.schedule.days.includes((day + 6) % 7);
}

export function alarmSourceUnavailable(rule: WallboardAlarmRule, snapshot: WallboardSnapshot, stale: boolean): boolean {
  if (stale || !snapshot.source.live) return true;
  if (rule.type === "no_calls" && !snapshot.callActivity) return true;
  return Boolean(snapshot.source.warning) &&
    (rule.type === "queue_wait" || (rule.type === "no_calls" && rule.direction !== "outbound"));
}

function condition(rule: WallboardAlarmRule, snapshot: WallboardSnapshot, now: number, startedAt: number) {
  const online = snapshot.agents.filter((agent) => agent.connected && agent.state !== "offline");
  const breaks = online.filter((agent) => agent.state === "break");
  let value = 0;
  let agentIds: string[] = [];
  switch (rule.type) {
    case "min_online": value = online.length; break;
    case "min_available": value = online.filter((agent) => agent.state === "available").length; break;
    case "max_break": value = breaks.length; agentIds = breaks.map((agent) => agent.id); break;
    case "long_break": {
      const elapsed = breaks.map((agent) => ({
        id: agent.id,
        seconds: agent.stateSince ? Math.max(0, Math.floor((now - Date.parse(agent.stateSince)) / 1000)) : 0,
      }));
      value = Math.max(0, ...elapsed.map((agent) => agent.seconds));
      agentIds = elapsed.filter((agent) => agent.seconds >= rule.threshold).map((agent) => agent.id);
      break;
    }
    case "queue_wait": {
      const age = Math.max(0, Math.floor((now - Date.parse(snapshot.generatedAt)) / 1000));
      value = snapshot.queue.waiting > 0 ? (snapshot.queue.longestWaitSeconds ?? 0) + age : 0;
      break;
    }
    case "no_calls": {
      const directions = rule.direction === "both" ? ["inbound", "outbound"] as const : [rule.direction];
      const timestamps = directions.map((direction) => {
        const activity = snapshot.callActivity?.[direction];
        const raw = rule.callEvent === "started" ? activity?.startedAt : activity?.connectedAt;
        return raw ? Date.parse(raw) : Number.NaN;
      }).filter((time) => Number.isFinite(time) && time <= now);
      const lastEvent = timestamps.length ? Math.max(...timestamps) : startedAt;
      value = Math.max(0, Math.floor((now - lastEvent) / 1000));
      break;
    }
  }
  const matches = rule.type === "min_online" || rule.type === "min_available"
    ? value < rule.threshold
    : rule.type === "max_break" ? value > rule.threshold : value >= rule.threshold;
  return { value, agentIds, matches };
}

/** Pure state transition; invalid/stale telemetry cannot advance pending alarms. */
export function advanceAlarms(
  runtime: AlarmRuntime,
  settings: WallboardAlarmSettings,
  snapshot: WallboardSnapshot,
  now: number,
  stale: boolean,
): { runtime: AlarmRuntime; incidents: WallboardAlarmIncident[]; suspended: boolean; graceRemainingSeconds: number } {
  const startedAt = runtime.startedAt ?? (stale || !snapshot.source.live ? null : now);
  const graceRemainingSeconds = startedAt === null ? settings.startupGraceSeconds
    : Math.max(0, Math.ceil(settings.startupGraceSeconds - (now - startedAt) / 1000));
  const tracks: AlarmRuntime["tracks"] = {};
  const incidents: WallboardAlarmIncident[] = [];
  let suspended = false;
  for (const rule of settings.rules) {
    const fingerprint = JSON.stringify(rule);
    const previous = runtime.tracks[rule.id];
    const track = previous?.fingerprint === fingerprint
      ? { ...previous }
      : { fingerprint, startedAt: now, pendingSince: null, incident: null };
    tracks[rule.id] = track;
    const unavailable = alarmSourceUnavailable(rule, snapshot, stale);
    if (rule.enabled && unavailable) suspended = true;
    if (!rule.enabled || unavailable || startedAt === null || graceRemainingSeconds > 0 || !alarmScheduleActive(rule, now)) {
      track.pendingSince = null;
      track.incident = null;
      continue;
    }
    const result = condition(rule, snapshot, now, track.startedAt);
    if (!result.matches) {
      track.pendingSince = null;
      track.incident = null;
      continue;
    }
    track.pendingSince ??= now;
    if (now - track.pendingSince < rule.delaySeconds * 1000) continue;
    track.incident = {
      ruleId: rule.id, type: rule.type, name: rule.name,
      since: track.incident?.since ?? now,
      value: result.value, threshold: rule.threshold, agentIds: result.agentIds,
      acknowledged: track.incident?.acknowledged ?? false,
      mutedUntil: track.incident?.mutedUntil ?? null,
    };
    incidents.push(track.incident);
  }
  return { runtime: { startedAt, tracks }, incidents, suspended, graceRemainingSeconds };
}

export function silenceAlarm(runtime: AlarmRuntime, ruleId: string, now: number, mute: boolean): AlarmRuntime {
  const track = runtime.tracks[ruleId];
  if (!track?.incident) return runtime;
  return {
    ...runtime,
    tracks: {
      ...runtime.tracks,
      [ruleId]: {
        ...track,
        incident: {
          ...track.incident,
          acknowledged: mute ? track.incident.acknowledged : true,
          mutedUntil: mute ? now + 5 * 60_000 : null,
        },
      },
    },
  };
}

export function alarmSoundDue(
  rule: WallboardAlarmRule,
  incident: WallboardAlarmIncident,
  now: number,
  lastPlayed: number | undefined,
): boolean {
  return rule.enabled && rule.mode === "sound" && !incident.acknowledged &&
    !(incident.mutedUntil !== null && incident.mutedUntil > now) &&
    (lastPlayed === undefined || (rule.repeatSeconds > 0 && now - lastPlayed >= rule.repeatSeconds * 1000));
}