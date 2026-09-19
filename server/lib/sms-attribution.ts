export type SmsEntityType = "customer" | "hospital" | "clinic" | "collaborator";

export interface SmsEntityCandidate {
  id: string;
  type: SmsEntityType;
  name?: string | null;
  country?: string | null;
}

export function normalizeSmsPhone(phone: string | null | undefined): string {
  return (phone || "")
    .replace(/[^\d+]/g, "")
    .replace(/^00/, "+")
    .replace(/^\+?(421|420)/, "")
    .replace(/^0/, "");
}

/**
 * Phone ownership is advisory only. It may identify an entity when unique, but
 * it can never prove Mission membership; exact outbound correlation does that.
 */
export function uniqueSmsEntity(candidates: SmsEntityCandidate[]): SmsEntityCandidate | null {
  const unique = new Map<string, SmsEntityCandidate>();
  for (const candidate of candidates) {
    if (candidate.id) unique.set(`${candidate.type}:${candidate.id}`, candidate);
  }
  return unique.size === 1 ? [...unique.values()][0] : null;
}