import type { Locale } from "@/i18n/translations";
import { getRecordActivityCopy } from "./record-activity-translations";

export type ActivityDetail = readonly [label: string, value: string];

const sensitiveKey = /password|token|secret|email|phone|address|credential|authorization/i;
const identifierKey = /(^|[_-])(?:id|uuid|key)(?:$|[_-])|(?:Id|UUID|Key)$/i;

export function actionDisplayName(action: string, locale: Locale, fallback: string, actionType?: unknown): string {
  const copy = getRecordActivityCopy(locale);
  if (typeof actionType === "string" && actionType.trim()) {
    return copy.actions[actionType.trim().toLowerCase()] ?? copy.genericAction;
  }
  const key = action.trim().toLowerCase();
  if (copy.actions[key]) return copy.actions[key];
  return key ? copy.genericAction : fallback;
}

export function moduleDisplayName(module: string, locale: Locale, fallback: string): string {
  const copy = getRecordActivityCopy(locale);
  const key = module.trim().toLowerCase();
  if (copy.moduleNames[key]) return copy.moduleNames[key];
  if (!key || identifierKey.test(key)) return fallback;
  return key.split(/[_\s.-]+/).filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
}

function asObject(value: unknown): Record<string, unknown> | null {
  let candidate = value;
  if (typeof candidate === "string" && candidate.length < 12000 && /^[\s]*\{/.test(candidate)) {
    try { candidate = JSON.parse(candidate) as unknown; } catch { return null; }
  }
  return candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate as Record<string, unknown> : null;
}

function formatValue(value: unknown, field: string, locale: Locale): string | null {
  const copy = getRecordActivityCopy(locale);
  if (typeof value === "boolean") return value ? copy.yes : copy.no;
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  if (identifierKey.test(field) || /^(?:campaignId|recordId)$/i.test(field)) return null;
  if ((/valid.?from|valid.?to|date|created.?at|updated.?at/i.test(field)) && /^\d{4}-\d\d-\d\d(?:T.*)?$/.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium", ...(text.includes("T") ? { timeStyle: "short" as const } : {}), timeZone: "Europe/Bratislava" }).format(date);
    }
  }
  if (text.length > 1200) return `${text.slice(0, 1200)}…`;
  return text;
}

export function activityDetailEntries(
  details: Record<string, unknown> | null,
  locale: Locale,
  beforeLabel: string,
  afterLabel: string,
): ActivityDetail[] {
  const result: ActivityDetail[] = [];
  const addField = (field: string, oldValue: unknown, newValue: unknown) => {
    if (sensitiveKey.test(field) || identifierKey.test(field)) return;
    const before = formatValue(oldValue, field, locale);
    const after = formatValue(newValue, field, locale);
    if (before === null && after === null) return;
    const copy = getRecordActivityCopy(locale);
    const normalized = field.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
    const label = copy.fields[field] ?? copy.fields[normalized] ??
      field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
    result.push([label, `${beforeLabel}: ${before ?? "—"} · ${afterLabel}: ${after ?? "—"}`]);
  };

  const rootBefore = asObject(details?.before);
  const rootAfter = asObject(details?.after);
  if (rootBefore || rootAfter) {
    for (const field of Array.from(new Set([...Object.keys(rootBefore || {}), ...Object.keys(rootAfter || {})]))) {
      addField(field, rootBefore?.[field], rootAfter?.[field]);
    }
  }

  for (const [key, raw] of Object.entries(details || {})) {
    if (sensitiveKey.test(key) || identifierKey.test(key) || key === "campaignId" || key === "actionType") continue;
    const parsed = asObject(raw);
    if (key === "before" || key === "after") {
      if (!rootBefore && !rootAfter) {
        for (const [field, value] of Object.entries(parsed || {})) addField(field, key === "before" ? value : undefined, key === "after" ? value : undefined);
      }
      continue;
    }
    const before = parsed && asObject(parsed.before);
    const after = parsed && asObject(parsed.after);
    if (before || after) {
      for (const field of Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]))) {
        addField(field, before?.[field], after?.[field]);
      }
      continue;
    }
    if (parsed) {
      // Render explicitly named, authorized display names only; never stringify nested records or IDs.
      const name = parsed.name ?? parsed.displayName ?? parsed.campaignName;
      const label = getRecordActivityCopy(locale).fields[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
      const safeName = formatValue(name, "name", locale);
      if (safeName) result.push([label, safeName]);
      continue;
    }
    let value = formatValue(raw, key, locale);
    if (value && (key === "dispositionCode" || key === "outcome" || key === "previousStatus" || key === "newStatus")) {
      value = value.replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
    }
    if (value !== null) {
      const copy = getRecordActivityCopy(locale);
      const normalized = key.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
      const label = copy.fields[key] ?? copy.fields[normalized] ??
        key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
      result.push([label, value]);
    }
  }
  return result;
}
