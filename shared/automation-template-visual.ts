export type TemplateVisualTone = "positive" | "negative" | "urgent" | "deadline" | "info";
export const TEMPLATE_VISUAL_PALETTES = {
  positive: { accent: "#13835a", background: "#eaf8f0", border: "#b6dfca", foreground: "#15553e" },
  negative: { accent: "#c73951", background: "#fff0f3", border: "#f0bbc5", foreground: "#84273b" },
  urgent: { accent: "#b9620b", background: "#fff5e5", border: "#edcc98", foreground: "#79460f" },
  deadline: { accent: "#7851b8", background: "#f5effd", border: "#d6c4ef", foreground: "#533080" },
  info: { accent: "#316bd8", background: "#edf4ff", border: "#c4d6f7", foreground: "#23497e" },
} as const;
/** Meaning is conveyed by labels/icons too; color never substitutes for a condition. */
export function templateVisualTone(id: string): TemplateVisualTone {
  if (/negative|tone-rude|sentiment-angry|cancel|abandon|complaint|reject|failed|missed|unanswered/.test(id)) return "negative";
  if (/urgent|angry|tone-concerned|attention|action-required/.test(id)) return "urgent";
  if (/positive|tone-calm|success|completed|thank/.test(id)) return "positive";
  if (/deadline|overdue|reminder|due-date/.test(id)) return "deadline";
  return "info";
}
