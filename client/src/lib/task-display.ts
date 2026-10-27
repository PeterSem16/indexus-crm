// Older Pulse-generated tasks embedded a database UUID in their visible text.
// Keep the stored text and relational IDs unchanged; only omit that marker in UI.
function stripTaskUuid(value: string | null | undefined): string {
  return (value || "").replace(/[ \t]*\((?:ID:\s*|#)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi, "");
}

// Convert complete system-generated timestamps only at presentation time.
// The task description in storage and in edit forms remains untouched.
export function taskDisplayText(value: string | null | undefined, locale = "sk"): string {
  return stripTaskUuid(value).replace(
    /(?<![A-Za-z0-9_/?&=%#.-])(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2}))(?![A-Za-z0-9_/?&=%#])/g,
    (iso) => {
      const date = new Date(iso);
      if (!Number.isFinite(date.getTime()) ||
          new Date(`${iso.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== iso.slice(0, 10)) return iso;
      return new Intl.DateTimeFormat(locale, {
        timeZone: "Europe/Bratislava", day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).format(date);
    },
  );
}