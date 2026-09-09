export type CallOutcomeKind = "status_list" | "disposition" | "callback";

export interface CallOutcomeBadge {
  kind: CallOutcomeKind;
  code?: string;
  label?: string;
  color?: string | null;
  callbackDate?: string | null;
}

export interface CallOutcomeHistoryEvent {
  action: string;
  createdAt: Date | string;
  notes?: string | null;
  newStatus?: string | null;
  metadata?: Record<string, any> | null;
}

export function eventsForCallOutcome<T extends CallOutcomeHistoryEvent>(
  events: T[],
  callStart: Date | string,
  callEnd: Date | string,
  nextCallStart?: Date | string | null,
): T[] {
  const start = new Date(callStart).getTime();
  const end = new Date(callEnd).getTime();
  const nextStart = nextCallStart ? new Date(nextCallStart).getTime() : Number.POSITIVE_INFINITY;
  const windowEnd = Math.min(nextStart, Math.max(start, end) + 30 * 60 * 1000);
  return events
    .filter((event) => {
      const timestamp = new Date(event.createdAt).getTime();
      return timestamp >= start && timestamp < windowEnd;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

interface SelectCallOutcomeOptions {
  events: CallOutcomeHistoryEvent[];
  workflowMode: "status_list" | "disposition";
  statusListMode: "batch" | "immediate";
  statusListItems: Map<string, { label: string; color: string | null }>;
  dispositions: Map<string, { name: string; color: string | null }>;
}

export function selectCallOutcomeBadges(options: SelectCallOutcomeOptions): CallOutcomeBadge[] {
  const events = [...options.events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const badges: CallOutcomeBadge[] = [];

  if (options.workflowMode === "status_list") {
    const activeConfirmations = new Map<string, number>();
    for (const event of events) {
      if (event.action !== "status_list_confirmation") continue;
      const itemId = event.metadata?.statusListItemId as string | undefined;
      if (!itemId) continue;
      if (event.metadata?.confirmed === false) activeConfirmations.delete(itemId);
      else activeConfirmations.set(itemId, new Date(event.createdAt).getTime());
    }

    const latestItemId = [...activeConfirmations.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    const item = latestItemId ? options.statusListItems.get(latestItemId) : undefined;
    if (latestItemId && item) {
      badges.push({
        kind: "status_list",
        code: latestItemId,
        label: item.label,
        color: item.color,
      });
    }

    if (options.statusListMode === "batch") {
      const callback = [...events].reverse().find((event) =>
        event.action === "callback_set" ||
        event.newStatus === "callback_scheduled" ||
        event.metadata?.actionType === "set_callback" ||
        Boolean(event.metadata?.callbackDate));
      if (callback) {
        badges.push({
          kind: "callback",
          callbackDate: callback.metadata?.callbackDate || null,
        });
      }
    }
    return badges;
  }

  const dispositionEvent = [...events].reverse().find((event) => {
    const code = event.metadata?.dispositionCode || event.notes;
    return Boolean(code && options.dispositions.has(code));
  });
  const dispositionCode = dispositionEvent?.metadata?.dispositionCode || dispositionEvent?.notes;
  const disposition = dispositionCode ? options.dispositions.get(dispositionCode) : undefined;
  if (dispositionCode && disposition) {
    badges.push({
      kind: "disposition",
      code: dispositionCode,
      label: disposition.name,
      color: disposition.color,
    });
  }
  return badges;
}
