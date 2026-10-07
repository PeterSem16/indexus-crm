export function taskChecklistText(checklist: unknown): string {
  if (!Array.isArray(checklist)) return "";
  return checklist.map(item => typeof item === "string" ? item : item?.label || "").join("\n");
}

/** Normalize saved items, never the live textarea draft or its caret. */
export function taskChecklistItems(text: string): string[] {
  return text.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
}
