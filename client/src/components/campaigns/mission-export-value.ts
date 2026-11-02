/** Numeric Excel values with an explicit display format; CSV uses readable text. */
export interface ExportFormattedValue { value: number; format: string; text: string }
export type ExportCell = string | number | ExportFormattedValue;
export const exportCellText = (cell: ExportCell) => typeof cell === "object" ? cell.text : String(cell);

const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
export function exportDate(input: string | null | undefined): ExportFormattedValue | "" {
  if (!input) return "";
  const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(input);
  const instant = new Date(onlyDate ? `${input}T00:00:00Z` : input);
  if (!Number.isFinite(instant.getTime()) || onlyDate && instant.toISOString().slice(0, 10) !== input)
    throw new Error("Invalid report export date");
  const parts = onlyDate
    ? { year: input.slice(0, 4), month: input.slice(5, 7), day: input.slice(8, 10), hour: "00", minute: "00", second: "00" }
    : Object.fromEntries(clock.formatToParts(instant).map(part => [part.type, part.value]));
  const { year, month, day, hour, minute, second } = parts;
  // Excel has no timezone. Store the explicit Bratislava wall clock, independent
  // of the browser/Node timezone, so CSV, Excel and report scope agree.
  const wallClock = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  return {
    value: (wallClock - Date.UTC(1899, 11, 30)) / 86_400_000,
    format: onlyDate ? "dd.mm.yyyy" : "dd.mm.yyyy hh:mm:ss",
    text: `${day}.${month}.${year}${onlyDate ? "" : ` ${hour}:${minute}:${second}`}`,
  };
}
export function exportDuration(seconds: number): ExportFormattedValue {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error("Invalid report export duration");
  const whole = Math.round(seconds);
  return { value: whole / 86_400, format: "[h]:mm:ss",
    text: `${Math.floor(whole / 3600)}:${String(Math.floor(whole / 60) % 60).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}` };
}
