// Older Pulse-generated tasks embedded a database UUID in their visible text.
// Keep the stored text and relational IDs unchanged; only omit that marker in UI.
export function taskDisplayText(value: string | null | undefined): string {
  return (value || "").replace(/[ \t]*\((?:ID:\s*|#)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi, "");
}