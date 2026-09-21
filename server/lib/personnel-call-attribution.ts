import type { CampaignTimelineAction } from "@shared/schema";

export function isPersonnelDialingEnabled(settings: unknown): boolean {
  try {
    const parsed = typeof settings === "string" ? JSON.parse(settings) : settings;
    return !!parsed && typeof parsed === "object" && !Array.isArray(parsed)
      && (parsed as Record<string, unknown>).enablePersonnelDialing === true;
  } catch {
    return false;
  }
}

export function resolvePersonnelCallTimelineAction(status: unknown): CampaignTimelineAction | null {
  if (status === "answered" || status === "completed") return "call_answered";
  if (status === "failed") return "call_failed";
  if (status === "no_answer") return "call_missed";
  return null;
}