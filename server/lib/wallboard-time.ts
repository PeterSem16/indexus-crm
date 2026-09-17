/**
 * Time calculations used by the wallboard.  These are kept free of database
 * and process-clock state so snapshots can be tested at DST boundaries.
 */

function bratislavaParts(value: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Bratislava",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  return Object.fromEntries(parts
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)]));
}

function offsetAt(value: Date): number {
  const local = bratislavaParts(value);
  return Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  ) - value.getTime();
}

/**
 * Return the instant corresponding to local midnight in Europe/Bratislava.
 *
 * Solving the offset rather than subtracting today's offset is important for
 * snapshots around the spring and autumn DST transitions.
 */
export function startOfBratislavaDay(value: Date): Date {
  const local = bratislavaParts(value);
  const localMidnight = Date.UTC(local.year, local.month - 1, local.day);
  let candidate = localMidnight;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    candidate = localMidnight - offsetAt(new Date(candidate));
  }
  return new Date(candidate);
}

export interface WallboardSessionInterval {
  startedAt: Date;
  endedAt: Date | null;
  lastActiveAt: Date | null;
  accruing?: boolean;
}

export interface WallboardSessionScope {
  campaignId: string | null;
  campaignIds: string[] | null;
}

export function wallboardSessionMissionIds(session: WallboardSessionScope): string[] {
  return Array.from(new Set([
    ...(session.campaignId ? [session.campaignId] : []),
    ...(session.campaignIds || []),
  ]));
}

export function wallboardSessionIncludesMission(
  session: WallboardSessionScope,
  missionId: string,
): boolean {
  return wallboardSessionMissionIds(session).includes(missionId);
}

export function selectNewestWallboardSession<T extends { startedAt: Date; id: string }>(
  rows: readonly T[],
): T | undefined {
  return rows.reduce<T | undefined>((newest, row) =>
    !newest ||
    row.startedAt.getTime() > newest.startedAt.getTime() ||
    (row.startedAt.getTime() === newest.startedAt.getTime() && row.id > newest.id)
      ? row
      : newest, undefined);
}

function effectiveEnd(interval: WallboardSessionInterval, now: Date): number {
  const started = interval.startedAt.getTime();
  if (interval.endedAt) return Math.max(started, interval.endedAt.getTime());
  if (interval.accruing) return Math.max(started, now.getTime());
  return Math.max(started, interval.lastActiveAt?.getTime() ?? started);
}

/**
 * Calculate the union (not the sum) of session intervals in a window.
 * Abandoned open sessions stop at lastActiveAt and therefore never tick
 * forever after a disconnected browser.
 */
export function unionWallboardSessionSeconds(
  intervals: readonly WallboardSessionInterval[],
  windowStart: Date,
  windowEnd: Date,
  now: Date,
): number {
  const start = windowStart.getTime();
  const end = windowEnd.getTime();
  if (end <= start) return 0;
  const clipped = intervals
    .map((interval) => ({
      start: Math.max(start, interval.startedAt.getTime()),
      end: Math.min(end, effectiveEnd(interval, now)),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  let total = 0;
  let mergedStart = 0;
  let mergedEnd = 0;
  for (const interval of clipped) {
    if (!mergedStart) {
      mergedStart = interval.start;
      mergedEnd = interval.end;
    } else if (interval.start <= mergedEnd) {
      mergedEnd = Math.max(mergedEnd, interval.end);
    } else {
      total += mergedEnd - mergedStart;
      mergedStart = interval.start;
      mergedEnd = interval.end;
    }
  }
  if (mergedStart) total += mergedEnd - mergedStart;
  return Math.floor(total / 1000);
}
