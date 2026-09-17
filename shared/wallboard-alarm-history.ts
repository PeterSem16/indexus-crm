import { z } from "zod";
import { wallboardAlarmTypes } from "./wallboard-alarms";

/** Alarm history is deliberately limited to operational alarm state. */
export const WALLBOARD_ALARM_HISTORY_RETENTION_DAYS = 30;

export const wallboardAlarmEndReasons = [
  "recovered",
  "observation_stopped",
  "rule_changed",
  "source_unavailable",
] as const;

const isoDateTime = z.string().datetime({ offset: true });

export const wallboardAlarmHistoryEntrySchema = z.object({
  incidentId: z.string().uuid(),
  revision: z.number().int().positive().max(2_147_483_647),
  type: z.enum(wallboardAlarmTypes),
  threshold: z.number().finite().min(0).max(86_400),
  startedAt: isoDateTime,
  lastObservedAt: isoDateTime,
  endedAt: isoDateTime.nullable(),
  endReason: z.enum(wallboardAlarmEndReasons).nullable(),
  acknowledgedAt: isoDateTime.nullable(),
  mutedAt: isoDateTime.nullable(),
  mutedUntil: isoDateTime.nullable(),
}).strict().superRefine((entry, ctx) => {
  const startedAt = Date.parse(entry.startedAt);
  const lastObservedAt = Date.parse(entry.lastObservedAt);
  if (lastObservedAt < startedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lastObservedAt"],
      message: "lastObservedAt must not precede startedAt",
    });
  }

  if ((entry.endedAt === null) !== (entry.endReason === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: entry.endedAt === null ? ["endReason"] : ["endedAt"],
      message: "endedAt and endReason must be provided together",
    });
  }

  if (entry.endedAt !== null) {
    const endedAt = Date.parse(entry.endedAt);
    if (endedAt !== lastObservedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endedAt"],
        message: "endedAt must equal lastObservedAt",
      });
    }
  }

  for (const [key, value] of [
    ["acknowledgedAt", entry.acknowledgedAt],
    ["mutedAt", entry.mutedAt],
  ] as const) {
    if (value !== null && (Date.parse(value) < startedAt || Date.parse(value) > lastObservedAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} must be between startedAt and lastObservedAt`,
      });
    }
  }

  if (
    entry.mutedAt !== null &&
    entry.mutedUntil !== null &&
    Date.parse(entry.mutedUntil) < Date.parse(entry.mutedAt)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mutedUntil"],
      message: "mutedUntil must not precede mutedAt",
    });
  }
  if (entry.mutedUntil !== null && entry.mutedAt === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mutedUntil"],
      message: "mutedUntil requires mutedAt",
    });
  }
});

export type WallboardAlarmHistoryEntry = z.infer<typeof wallboardAlarmHistoryEntrySchema>;

export const wallboardAlarmHistoryWriteSchema = z.object({
  entries: z.array(wallboardAlarmHistoryEntrySchema).min(1).max(100)
    .refine(
      (entries) => new Set(entries.map((entry) => entry.incidentId)).size === entries.length,
      "Duplicate incident IDs are not allowed in one write",
    ),
}).strict();