export const MISSION_RECORDING_TIMEZONE = "Europe/Bratislava" as const;

export type MissionRecordingMode = "both" | "agent_only";
export type MissionRecordingInactiveReason = "disabled" | "not_started" | "expired";

export interface MissionCallRecordingPolicy {
  enabled: boolean;
  activeFrom: string | null;
  activeUntil: string | null;
  mode: MissionRecordingMode;
  customerMask: "soft_tone";
  timezone: typeof MISSION_RECORDING_TIMEZONE;
}

export interface MissionCallRecordingSnapshot extends MissionCallRecordingPolicy {
  active: boolean;
  evaluatedAt: string;
  inactiveReason?: MissionRecordingInactiveReason;
}

export interface CustomerActivitySegment {
  startSeconds: number;
  endSeconds: number;
}

export interface MissionSettingsWithRecording {
  callRecordingPolicy?: Partial<MissionCallRecordingPolicy>;
  [key: string]: unknown;
}

export const DEFAULT_MISSION_RECORDING_POLICY: MissionCallRecordingPolicy = {
  enabled: false,
  activeFrom: null,
  activeUntil: null,
  mode: "both",
  customerMask: "soft_tone",
  timezone: MISSION_RECORDING_TIMEZONE,
};

function parseIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseMissionSettingsObject(value: unknown): MissionSettingsWithRecording {
  if (!value) return {};
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as MissionSettingsWithRecording
      : {};
  } catch {
    return {};
  }
}

export function normalizeMissionRecordingPolicy(value: unknown): MissionCallRecordingPolicy {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    enabled: raw.enabled === true,
    activeFrom: parseIsoDate(raw.activeFrom),
    activeUntil: parseIsoDate(raw.activeUntil),
    mode: raw.mode === "agent_only" ? "agent_only" : "both",
    customerMask: "soft_tone",
    timezone: MISSION_RECORDING_TIMEZONE,
  };
}

export function getMissionRecordingPolicy(settings: unknown): MissionCallRecordingPolicy {
  return normalizeMissionRecordingPolicy(parseMissionSettingsObject(settings).callRecordingPolicy);
}

export function resolveMissionRecordingPolicy(
  settings: unknown,
  evaluatedAt: Date = new Date(),
): MissionCallRecordingSnapshot {
  const policy = getMissionRecordingPolicy(settings);
  const timestamp = evaluatedAt.getTime();
  let inactiveReason: MissionRecordingInactiveReason | undefined;
  if (!policy.enabled) inactiveReason = "disabled";
  else if (policy.activeFrom && timestamp < new Date(policy.activeFrom).getTime()) inactiveReason = "not_started";
  else if (policy.activeUntil && timestamp > new Date(policy.activeUntil).getTime()) inactiveReason = "expired";

  return {
    ...policy,
    active: !inactiveReason,
    evaluatedAt: evaluatedAt.toISOString(),
    ...(inactiveReason ? { inactiveReason } : {}),
  };
}

export function validateMissionRecordingSettings(settings: unknown): string | null {
  const parsed = parseMissionSettingsObject(settings);
  const raw = parsed.callRecordingPolicy;
  if (raw === undefined) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return "Invalid Mission call recording policy";
  }
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.enabled !== "boolean") {
    return "Mission call recording enabled must be a boolean";
  }
  if (candidate.mode !== "both" && candidate.mode !== "agent_only") {
    return "Invalid Mission call recording mode";
  }
  for (const field of ["activeFrom", "activeUntil"] as const) {
    const value = candidate[field];
    if (value !== null && value !== undefined && parseIsoDate(value) === null) {
      return `Invalid Mission call recording ${field}`;
    }
  }
  const from = parseIsoDate(candidate.activeFrom);
  const until = parseIsoDate(candidate.activeUntil);
  if (from && until && new Date(until).getTime() < new Date(from).getTime()) {
    return "Mission call recording activeUntil must be after activeFrom";
  }
  return null;
}