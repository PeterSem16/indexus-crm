/**
 * Ephemeral advisory card-work presence.
 *
 * This is intentionally separate from call/SIP state.  A browser may stop
 * sending these updates at any time; wallboard consumers must treat the
 * twenty-second lease as a hint rather than an authoritative activity log.
 */

export const WALLBOARD_PRESENCE_TTL_MS = 20_000;

export type WallboardPresence = {
  sessionId: string;
  campaignId: string;
  working: boolean;
  changedAt: string;
  seenAt: string;
};

type StoredPresence = WallboardPresence & { expiresAt: number };

const presenceByUser = new Map<string, StoredPresence>();

function removeExpired(userId: string, now: number): StoredPresence | undefined {
  const current = presenceByUser.get(userId);
  if (!current) return undefined;
  if (current.expiresAt <= now) {
    presenceByUser.delete(userId);
    return undefined;
  }
  return current;
}

/**
 * Read the latest advisory card-work state for a user.
 *
 * Expiration is checked on read as well as write so abandoned browser tabs do
 * not remain visible when there is no subsequent heartbeat to clean them up.
 */
export function getWallboardPresence(userId: string, now = Date.now()): WallboardPresence | undefined {
  const current = removeExpired(userId, now);
  if (!current) return undefined;
  const { expiresAt: _expiresAt, ...presence } = current;
  return presence;
}

/**
 * Store one authenticated browser update.  `changedAt` is deliberately
 * stable for heartbeats of the same card and working state; `seenAt` and the
 * lease are refreshed on every update.
 */
export function updateWallboardPresence(
  userId: string,
  update: Pick<WallboardPresence, "sessionId" | "campaignId" | "working">,
  now = Date.now(),
): WallboardPresence {
  const previous = removeExpired(userId, now);
  const seenAt = new Date(now).toISOString();
  const sameState = previous &&
    previous.sessionId === update.sessionId &&
    previous.campaignId === update.campaignId &&
    previous.working === update.working;
  const next: StoredPresence = {
    sessionId: update.sessionId,
    campaignId: update.campaignId,
    working: update.working,
    changedAt: sameState ? previous.changedAt : seenAt,
    seenAt,
    expiresAt: now + WALLBOARD_PRESENCE_TTL_MS,
  };
  presenceByUser.set(userId, next);
  const { expiresAt: _expiresAt, ...presence } = next;
  return presence;
}

/**
 * Test/support cleanup.  Production callers should rely on the TTL instead.
 */
export function clearWallboardPresence(userId?: string): void {
  if (userId) presenceByUser.delete(userId);
  else presenceByUser.clear();
}