export function visibleScheduledQueueGroups<T>(
  groups: Readonly<Record<string, readonly T[]>>,
  order: readonly string[],
  limit: number,
): Array<{ bucket: string; items: readonly T[]; total: number }> {
  let remaining = Math.max(0, limit);
  const visible: Array<{ bucket: string; items: readonly T[]; total: number }> = [];
  for (const bucket of order) {
    const items = groups[bucket] || [];
    if (!items.length || remaining === 0) continue;
    const slice = items.slice(0, remaining);
    visible.push({ bucket, items: slice, total: items.length });
    remaining -= slice.length;
  }
  return visible;
}