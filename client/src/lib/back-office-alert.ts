/**
 * Back Office new-task alert dispatch + dedup.
 *
 * `useNotifications()` is mounted more than once at the same time (the
 * NotificationBell and the notifications page), and every mount opens its own
 * WebSocket. The server therefore delivers the *same* notification to each
 * mount, which would otherwise play the chime / show the toast twice for a
 * single task. The module-level `processedBoNotificationIds` set guarantees the
 * alert fires exactly once per notification id across every live mount.
 *
 * This logic is deliberately framework-free (no React, no DOM) so it can be
 * unit-tested without a browser harness — see `back-office-alert.test.ts`.
 */

const MAX_TRACKED_IDS = 300;

// Check-then-add is atomic here (no awaits in between), so concurrent mounts
// processing the same id can never both win the race.
const processedBoNotificationIds = new Set<string>();

export interface BackOfficeAlertNotification {
  id: string;
  title?: string | null;
  metadata?: { isBackOffice?: boolean; [key: string]: any } | null;
}

export interface BackOfficeAlertHandlers {
  /** Play the chime. May be a no-op (muted) or throw (audio blocked). */
  playChime: () => void;
  /** Show the on-screen toast. Always runs for a fresh BO notification. */
  showToast: () => void;
}

/**
 * Fire the Back Office new-task alert for `notif` at most once across all
 * mounts. Returns `true` only the first time a given notification id is seen
 * (i.e. when the alert actually fired), so callers can run additional
 * once-per-task side effects (cache invalidation, etc.) only on that delivery.
 *
 * The chime is treated as best-effort: if `playChime` throws (e.g. autoplay is
 * blocked), the toast is still shown.
 */
export function dispatchBackOfficeAlert(
  notif: BackOfficeAlertNotification | null | undefined,
  handlers: BackOfficeAlertHandlers,
): boolean {
  if (!notif || notif.metadata?.isBackOffice !== true) return false;
  if (processedBoNotificationIds.has(notif.id)) return false;

  processedBoNotificationIds.add(notif.id);
  if (processedBoNotificationIds.size > MAX_TRACKED_IDS) {
    processedBoNotificationIds.clear();
    processedBoNotificationIds.add(notif.id);
  }

  try {
    handlers.playChime();
  } catch {
    /* audio is best-effort; never let a blocked chime suppress the toast */
  }
  handlers.showToast();
  return true;
}

/** Test-only helper: forget all tracked ids so cases start from a clean slate. */
export function __resetBackOfficeAlertDedup(): void {
  processedBoNotificationIds.clear();
}
