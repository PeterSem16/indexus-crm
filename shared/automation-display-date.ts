import { getTaskDeadlineTimestamp } from "./task-deadline";

const locales: Record<string, string> = {
  en: "en-GB", sk: "sk-SK", cs: "cs-CZ", hu: "hu-HU",
  ro: "ro-RO", it: "it-IT", de: "de-DE",
};
const countryLanguages: Record<string, string> = {
  SK: "sk", CZ: "cs", HU: "hu", RO: "ro", IT: "it", DE: "de", AT: "de",
};
const timestampFields = new Set([
  "createdAt", "updatedAt", "startedAt", "answeredAt", "endedAt",
  "completedAt", "resolvedAt", "callbackDate", "overdueDeadlineAt",
]);

/** Presentation only: retain original event values for comparisons and URL tokens. */
export function automationDateDisplay(
  field: string, raw: unknown, module: string | undefined, language?: string, country?: string | null,
): string | undefined {
  const taskDeadline = field === "dueDate" && module === "task";
  if (!taskDeadline && !timestampFields.has(field)) return undefined;
  if (raw == null || raw === "") return "";
  if (!(raw instanceof Date) && typeof raw !== "string") throw new Error(`Invalid template date: ${field}`);
  const text = raw instanceof Date
    ? (Number.isFinite(raw.getTime()) ? raw.toISOString() : "") : raw;
  const calendar = taskDeadline
    ? /^(\d{4}-\d{2}-\d{2})(?:T00:00(?::00(?:\.0+)?)?(?:Z|\+00:00))?$/.exec(text)?.[1]
    : undefined;
  if (calendar && getTaskDeadlineTimestamp(calendar) == null)
    throw new Error(`Invalid template date: ${field}`);
  if (!calendar && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(text))
    throw new Error(`Template timestamp needs a timezone: ${field}`);
  const date = new Date(calendar ? `${calendar}T12:00:00Z` : text);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid template date: ${field}`);
  const lang = language?.toLowerCase().split(/[-_]/)[0];
  const locale = locales[lang || ""] || locales[countryLanguages[country || ""]] || locales.en;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Bratislava",
    dateStyle: "short",
    ...(calendar ? {} : { timeStyle: "short" as const, hourCycle: "h23" as const }),
  }).format(date);
}
