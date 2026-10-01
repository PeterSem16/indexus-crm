export interface TaskCompletionNotification {
  id: string;
  userId: string;
  type: string;
  title?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  isRead?: boolean;
  isDismissed?: boolean;
  createdAt?: string;
}

export interface TaskCompletionNotice {
  id: string;
  userId: string;
  taskId: string;
  entityTitle: string;
  taskTitle: string;
  resolution: string | null;
  source: "nexus_pulse" | "other";
  createdAt: string;
}

const MAX_DISPATCHED_IDS = 300;
let activeDispatchUserId: string | null = null;
const dispatchedNotificationIds = new Set<string>();
const acknowledgedNotificationIds = new Set<string>();

/** Reset side-effect deduplication whenever authentication crosses a user boundary. */
export function setActiveTaskCompletionNoticeUser(userId: string | null): void {
  if (activeDispatchUserId === userId) return;
  activeDispatchUserId = userId;
  dispatchedNotificationIds.clear();
  acknowledgedNotificationIds.clear();
}

/** Keep local acknowledgement visible through stale cache snapshots/remounts. */
export function acknowledgeTaskCompletionNotice(id: string, userId: string): void {
  setActiveTaskCompletionNoticeUser(userId);
  acknowledgedNotificationIds.add(id);
  if (acknowledgedNotificationIds.size > MAX_DISPATCHED_IDS) {
    acknowledgedNotificationIds.clear();
    acknowledgedNotificationIds.add(id);
  }
}

export function getAcknowledgedTaskCompletionNoticeIds(userId: string): ReadonlySet<string> {
  return activeDispatchUserId === userId
    ? acknowledgedNotificationIds
    : new Set<string>();
}

/**
 * Emit one live/persisted notification side effect across concurrent hook
 * mounts. Inbox cards still merge persisted snapshots independently, so a
 * later inbox remount can always rehydrate the saved unread notice.
 */
export function dispatchTaskCompletionNoticeOnce(
  notification: TaskCompletionNotification,
  userId: string,
  dispatch: (notification: TaskCompletionNotification) => void,
): boolean {
  if (
    !isTaskCompletionNotification(notification) ||
    notification.userId !== userId ||
    notification.isRead ||
    notification.isDismissed
  ) return false;

  setActiveTaskCompletionNoticeUser(userId);
  if (dispatchedNotificationIds.has(notification.id)) return false;
  dispatchedNotificationIds.add(notification.id);
  if (dispatchedNotificationIds.size > MAX_DISPATCHED_IDS) {
    dispatchedNotificationIds.clear();
    dispatchedNotificationIds.add(notification.id);
  }
  dispatch(notification);
  return true;
}

export function isTaskCompletionNotification(
  notification: TaskCompletionNotification | null | undefined,
): notification is TaskCompletionNotification {
  return notification?.type === "back_office_resolved" &&
    notification.entityType?.toLowerCase() === "task";
}

function toTaskCompletionNotice(notification: TaskCompletionNotification): TaskCompletionNotice | null {
  if (!isTaskCompletionNotification(notification)) return null;

  const metadata = notification.metadata ?? {};
  const taskId = typeof metadata.taskId === "string" ? metadata.taskId : notification.entityId;
  const metadataTaskTitle = typeof metadata.taskTitle === "string" && metadata.taskTitle.trim()
    ? metadata.taskTitle
    : null;
  const notificationTitle = typeof notification.title === "string" && notification.title.trim()
    ? notification.title
    : null;
  const taskTitle = metadataTaskTitle ?? notificationTitle;
  if (!taskId || !taskTitle?.trim()) return null;

  return {
    id: notification.id,
    userId: notification.userId,
    taskId,
    entityTitle: notificationTitle ?? taskTitle,
    taskTitle,
    resolution: typeof metadata.resolution === "string" && metadata.resolution.trim()
      ? metadata.resolution
      : null,
    source: metadata.source === "nexus_pulse" ? "nexus_pulse" : "other",
    createdAt: notification.createdAt ?? "",
  };
}

/**
 * Merge persisted and live notifications into the visible, unread notice list.
 * A read/dismissed server record removes a visible item; acknowledgedIds also
 * protects against briefly stale query-cache data after an acknowledgement.
 */
export function mergeTaskCompletionNotices(
  current: TaskCompletionNotice[],
  incoming: TaskCompletionNotification[],
  userId: string,
  acknowledgedIds: ReadonlySet<string> = new Set(),
): TaskCompletionNotice[] {
  const byId = new Map<string, TaskCompletionNotice>();
  for (const notice of current) {
    if (notice.userId === userId && !acknowledgedIds.has(notice.id)) {
      byId.set(notice.id, notice);
    }
  }

  for (const notification of incoming) {
    if (notification.userId !== userId || !isTaskCompletionNotification(notification)) continue;
    if (notification.isRead || notification.isDismissed) {
      byId.delete(notification.id);
      continue;
    }

    const notice = toTaskCompletionNotice(notification);
    if (!notice || acknowledgedIds.has(notice.id)) continue;
    byId.set(notice.id, notice);
  }

  return Array.from(byId.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
}