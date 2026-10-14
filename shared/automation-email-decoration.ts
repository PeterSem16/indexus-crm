/** Application-owned PNGs: these names are also the public artwork allow-list. */
export const AUTOMATION_STATE_ICONS = [
  "happy", "neutral", "concerned", "angry", "calm", "urgent",
  "pending", "progress", "completed", "cancelled",
] as const;
export type AutomationStateIcon = typeof AUTOMATION_STATE_ICONS[number];
export const isAutomationStateArtwork = (name: string) =>
  AUTOMATION_STATE_ICONS.some(icon => name === `state-${icon}`);

export type EmailBadgePalette = { background: string; foreground: string; border: string };
export const EMAIL_BADGE_PALETTES = {
  mint: { background: "#e7f6ee", foreground: "#176b50", border: "#b9dfcb" },
  blue: { background: "#eaf2ff", foreground: "#285ba3", border: "#c2d6f3" },
  lavender: { background: "#f2edfb", foreground: "#695486", border: "#ded4f0" },
  amber: { background: "#fff2d9", foreground: "#885415", border: "#eccb8e" },
  coral: { background: "#fff0e5", foreground: "#93503c", border: "#f3d2bf" },
  rose: { background: "#ffe8ed", foreground: "#a32d4d", border: "#eeb5c4" },
  slate: { background: "#edf1f4", foreground: "#536578", border: "#cdd8e0" },
} satisfies Record<string, EmailBadgePalette>;

export function priorityBadgePalette(value: unknown): EmailBadgePalette {
  switch (value) {
    case "low": return EMAIL_BADGE_PALETTES.blue;
    case "normal": case "medium": return EMAIL_BADGE_PALETTES.mint;
    case "high": return EMAIL_BADGE_PALETTES.amber;
    case "urgent": case "critical": return EMAIL_BADGE_PALETTES.rose;
    default: return EMAIL_BADGE_PALETTES.slate;
  }
}
export function stateIcon(value: unknown): AutomationStateIcon | null {
  switch (value) {
    case "positive": return "happy";
    case "negative": case "concerned": return "concerned";
    case "angry": case "rude": return "angry";
    case "calm": return "calm";
    case "neutral": return "neutral";
    case "pending": return "pending";
    case "in_progress": return "progress";
    case "completed": return "completed";
    case "cancelled": return "cancelled";
    case "urgent": case "overdue": return "urgent";
    default: return null;
  }
}
export function stateBadgePalette(value: unknown): EmailBadgePalette {
  if (["positive", "calm", "completed"].includes(String(value))) return EMAIL_BADGE_PALETTES.mint;
  if (["angry", "rude", "cancelled"].includes(String(value))) return EMAIL_BADGE_PALETTES.rose;
  if (["negative", "concerned"].includes(String(value))) return EMAIL_BADGE_PALETTES.coral;
  if (["pending", "urgent", "overdue"].includes(String(value))) return EMAIL_BADGE_PALETTES.amber;
  if (value === "in_progress") return EMAIL_BADGE_PALETTES.blue;
  return EMAIL_BADGE_PALETTES.lavender;
}
/** This describes the event family, not an invented analysis result. */
export function templateEventIcon(id: string): AutomationStateIcon {
  if (/angry|rude/.test(id)) return "angry";
  if (/negative|concerned|missed|unanswered|failed/.test(id)) return "concerned";
  if (/cancel|abandon|reject/.test(id)) return "cancelled";
  if (/urgent|deadline|overdue|reminder|due-date/.test(id)) return "urgent";
  if (/completed|success/.test(id)) return "completed";
  if (/positive|thank/.test(id)) return "happy";
  if (/calm/.test(id)) return "calm";
  if (/in-progress|progress/.test(id)) return "progress";
  if (/new-task|task-event-created|assigned|handover/.test(id)) return "pending";
  return "neutral";
}
export function emailBadgeStyle(palette: EmailBadgePalette) {
  return `display:inline-block;vertical-align:middle;margin:0 8px 8px 0;border-radius:999px;padding:8px 12px;font-size:12px;line-height:24px;font-weight:700;background:${palette.background};color:${palette.foreground};border:1px solid ${palette.border};`;
}
export function emailStateImage(icon: AutomationStateIcon, size = 26) {
  return `<img src="cid:indexus-automation-state-${icon}" width="${size}" height="${size}" alt="" role="presentation" style="display:inline-block;vertical-align:middle;width:${size}px;height:${size}px;margin:0 8px 0 0;border:0;">`;
}
