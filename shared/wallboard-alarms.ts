import { z } from "zod";

export const wallboardAlarmTypes = [
  "no_calls", "min_online", "min_available", "max_break", "long_break", "queue_wait",
] as const;
export type WallboardAlarmType = typeof wallboardAlarmTypes[number];

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const wallboardAlarmRuleSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  type: z.enum(wallboardAlarmTypes),
  /** Seconds for durations; agent count for staffing rules. */
  threshold: z.number().int().min(0).max(86400),
  direction: z.enum(["inbound", "outbound", "both"]),
  callEvent: z.enum(["started", "connected"]),
  delaySeconds: z.number().int().min(0).max(3600),
  mode: z.enum(["visual", "sound"]),
  /** Zero means once per incident; otherwise repeat at this interval. */
  repeatSeconds: z.number().int().min(0).max(3600)
    .refine((value) => value === 0 || value >= 10),
  schedule: z.object({
    enabled: z.boolean(),
    /** JavaScript weekday numbering: Sunday=0. Overnight windows use the starting day. */
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7)
      .refine((days) => new Set(days).size === days.length),
    startTime: time,
    endTime: time,
  }).strict(),
}).strict().superRefine((rule, ctx) => {
  if (rule.type !== "max_break" && rule.threshold < 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["threshold"], message: "Threshold must be at least 1" });
  }
  if (["min_online", "min_available", "max_break"].includes(rule.type) && rule.threshold > 1000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["threshold"], message: "Agent threshold cannot exceed 1000" });
  }
});

export const wallboardAlarmSettingsSchema = z.object({
  startupGraceSeconds: z.number().int().min(0).max(3600),
  volume: z.number().min(0.05).max(1),
  rules: z.array(wallboardAlarmRuleSchema).max(30)
    .refine((rules) => new Set(rules.map((rule) => rule.id)).size === rules.length, "Duplicate rule IDs"),
}).strict();

export type WallboardAlarmRule = z.infer<typeof wallboardAlarmRuleSchema>;
export type WallboardAlarmSettings = z.infer<typeof wallboardAlarmSettingsSchema>;
export function defaultWallboardAlarmSettings(): WallboardAlarmSettings {
  return { startupGraceSeconds: 30, volume: 0.5, rules: [] };
}

export interface WallboardCallActivity {
  inbound: { startedAt: string | null; connectedAt: string | null };
  outbound: { startedAt: string | null; connectedAt: string | null };
}

export interface WallboardAlarmIncident {
  ruleId: string;
  type: WallboardAlarmType;
  name: string;
  since: number;
  value: number;
  threshold: number;
  agentIds: string[];
  acknowledged: boolean;
  mutedUntil: number | null;
}