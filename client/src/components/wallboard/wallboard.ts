export type WallboardState =
  | "calling"
  | "ringing"
  | "working"
  | "available"
  | "break"
  | "offline";

export const WALLBOARD_PAGE_SIZE = 6;

export function formatWallboardDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }
  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remaining = rounded % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

export function getWallboardElapsedSeconds(
  stateSince: string | null,
  effectiveServerNow: number,
): number | null {
  if (!stateSince) return null;
  const since = Date.parse(stateSince);
  if (!Number.isFinite(since) || !Number.isFinite(effectiveServerNow)) return null;
  return Math.max(0, Math.floor((effectiveServerNow - since) / 1000));
}

/**
 * Translate the local receipt clock into the server clock used by generatedAt.
 * A stale snapshot is intentionally frozen at its server timestamp.
 */
export function getEffectiveWallboardServerTime(
  generatedAt: string,
  lastFetchedAt: number | null,
  localNow = Date.now(),
  stale = false,
): number | null {
  const generated = Date.parse(generatedAt);
  if (!Number.isFinite(generated)) return null;
  if (stale || lastFetchedAt === null) return generated;
  return generated + Math.max(0, localNow - lastFetchedAt);
}

export function paginateWallboard<T>(items: T[], page: number, pageSize = WALLBOARD_PAGE_SIZE): T[] {
  const start = Math.max(0, page) * pageSize;
  return items.slice(start, start + pageSize);
}

export function wallboardPageCount(itemCount: number, pageSize = WALLBOARD_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(itemCount / pageSize));
}