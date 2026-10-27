import type { AnalysisSourceExclusion } from "./automation-analysis";
import { ANALYSIS_SOURCE_EVENTS } from "./automation-analysis-triggers";

export const ELIGIBILITY_SOURCE_EVENTS = ANALYSIS_SOURCE_EVENTS;
export type EligibilitySourceEvent = typeof ELIGIBILITY_SOURCE_EVENTS[number];
export type EligibilityReason = AnalysisSourceExclusion | "source_unavailable" | "creator_restricted" |
  "event_missing" | "rule_disabled" | "event_mismatch" | "before_activation" |
  "country_mismatch" | "country_unknown" | "eligible";
/** No source text, participants, addresses, attachments, or event payloads cross this boundary. */
export type AnalysisEligibilityDiagnostic = {
  reasons: EligibilityReason[];
  countryUnknown: boolean;
  history: EligibilityHistory;
};

export type RuleInputSettings = {
  module: "communication" | "other"; enabled: boolean; createdAt: string;
  eventType: string | null; channels: string[]; countries: string[] | null;
  listenAfter: string | null; reviewActivatedAt: string | null;
  mailboxMode: "all" | "selected"; mailboxCount: number; senderCount: number;
  analyzeContent: boolean | null; analyzeAttachments: boolean | null;
  textSearch: boolean | null; hasConditions: boolean;
};
/** Minimal picker metadata. Never include message text, subjects or participants. */
export type EligibilitySourceOption = { id: string; createdAt: string };
export type EligibilitySourceList = { records: EligibilitySourceOption[] };
export type EligibilitySourceListInput = {
  sourceEvent: EligibilitySourceEvent; from: Date; to: Date;
};
export const ELIGIBILITY_SOURCE_SCAN_LIMIT = 200;
export function eligibilitySourceListInput(value: unknown): EligibilitySourceListInput | null {
  if (!value || typeof value !== "object") return null;
  const { sourceEvent, from, to } = value as Record<string, unknown>;
  if (typeof sourceEvent !== "string" || !(ELIGIBILITY_SOURCE_EVENTS as readonly string[]).includes(sourceEvent) ||
      typeof from !== "string" || typeof to !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(from) || !/^\d{4}-\d{2}-\d{2}T/.test(to)) return null;
  const start = new Date(from), end = new Date(to);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
      start >= end || end.getTime() - start.getTime() > 31 * 86400000) return null;
  return { sourceEvent: sourceEvent as EligibilitySourceEvent, from: start, to: end };
}
export function eligibilityInput(value: unknown): { sourceId: string; sourceEvent: EligibilitySourceEvent } | null {
  if (!value || typeof value !== "object") return null;
  const { sourceId, sourceEvent } = value as Record<string, unknown>;
  if (typeof sourceId !== "string" || !sourceId.trim() || sourceId.length > 128 ||
      typeof sourceEvent !== "string" || !(ELIGIBILITY_SOURCE_EVENTS as readonly string[]).includes(sourceEvent)) return null;
  return { sourceId: sourceId.trim(), sourceEvent: sourceEvent as EligibilitySourceEvent };
}

export type EligibilityHistory = {
  status: "verified" | "missing" | "event_missing" | "unavailable";
  /** Historical permissions are deliberately never inferred from current access. */
  permissions: "unknown";
  eventAt?: string;
  version?: string;
  recordedAt?: string;
  settings?: RuleInputSettings;
  currentSettings?: RuleInputSettings;
  changed?: boolean;
};
