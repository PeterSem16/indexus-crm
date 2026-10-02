export type CallAnalysisSentimentEventInput = {
  recordingId: string;
  callLogId?: string | null;
  customerId?: string | null;
  campaignId?: string | null;
  direction: unknown;
  sentiment: unknown;
  analysisStatus: unknown;
  recordingMode?: unknown;
  audioScope?: unknown;
  analyzedAt?: unknown;
  authorized: boolean;
};

export type CallAnalysisSentimentEvent = {
  source: "call-analysis";
  module: "communication";
  entityType: "communication";
  entityId: string;
  eventType: "sentiment.negative";
  newValues: {
    type: "inbound_call" | "outbound_call";
    sentiment: "negative" | "angry";
    recordingId: string;
    callLogId?: string;
    customerId?: string;
    campaignId?: string;
  };
  countryCode: string;
  idempotencyKey: string;
};

/** Returns a country only when the persisted owner has access to that country. */
export function resolveCallAnalysisAuthorizedCountry(input: {
  assignedCountries: string[];
  missionCountryCodes?: string[] | null;
  customerCountry?: string | null;
}): string | null {
  if (input.missionCountryCodes !== undefined && input.missionCountryCodes !== null) {
    return input.missionCountryCodes.find(country => input.assignedCountries.includes(country)) || null;
  }
  return input.customerCountry && input.assignedCountries.includes(input.customerCountry)
    ? input.customerCountry
    : null;
}

/** Constructs a safe event only from completed, authorized persisted analysis data. */
export function buildCallAnalysisSentimentEvent(
  input: CallAnalysisSentimentEventInput & { countryCode?: string | null },
): CallAnalysisSentimentEvent | null {
  if (!input.authorized || input.analysisStatus !== "completed" || !input.analyzedAt) return null;
  if (input.recordingMode === "agent_only" || input.audioScope === "agent_only") return null;
  if (input.sentiment !== "negative" && input.sentiment !== "angry") return null;
  if (input.direction !== "inbound" && input.direction !== "outbound") return null;
  if (!input.countryCode) return null;

  const callLogId = input.callLogId || undefined;
  const canonicalId = callLogId || input.recordingId;
  return {
    source: "call-analysis",
    module: "communication",
    entityType: "communication",
    entityId: canonicalId,
    eventType: "sentiment.negative",
    newValues: {
      type: input.direction === "inbound" ? "inbound_call" : "outbound_call",
      sentiment: input.sentiment,
      recordingId: input.recordingId,
      ...(callLogId ? { callLogId } : {}),
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
    },
    countryCode: input.countryCode,
    idempotencyKey: `call:${canonicalId}:sentiment.negative`,
  };
}