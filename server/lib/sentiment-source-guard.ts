/**
 * Rules saved before call/task sentiment existed have no source condition.
 * Do not broaden them implicitly when new kinds of analysis arrive.
 * Advanced/nested source expressions are deliberately fail-closed for the
 * newly connected sources; the rule editor saves an explicit top-level filter.
 */
const EXPANDED_SOURCES = new Set(["inbound_call", "outbound_call", "task"]);

function explicitlyIncludesSource(node: unknown, source: string): boolean {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  const condition = node as Record<string, unknown>;
  if (condition.field !== "newValues.type") return false;
  return condition.op === "eq" && condition.value === source ||
    condition.op === "in" && Array.isArray(condition.value) && condition.value.includes(source);
}

export function permitsSentimentSource(
  conditions: unknown,
  event: { module: string; eventType: string; newValues?: unknown },
): boolean {
  if (event.module !== "communication" || event.eventType !== "sentiment.negative") return true;
  const source = (event.newValues as Record<string, unknown> | null)?.type;
  if (typeof source !== "string" || !EXPANDED_SOURCES.has(source)) return true;
  if (explicitlyIncludesSource(conditions, source)) return true;
  if (!conditions || typeof conditions !== "object" || Array.isArray(conditions)) return false;
  const all = (conditions as Record<string, unknown>).all;
  return Array.isArray(all) && all.some(node => explicitlyIncludesSource(node, source));
}