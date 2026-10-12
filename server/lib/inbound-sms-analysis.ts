/** Provider-independent analysis. Transport and Mission attribution stay outside this service. */
export interface SmsAnalysisResult {
  sentiment: string;
  alertLevel: string;
  note: string;
  hasInappropriateContent: boolean;
  hasAngryTone: boolean;
  hasRudeExpressions: boolean;
  wantsToCancel: boolean;
  wantsConsent: boolean;
  doesNotAcceptContract: boolean;
}

export interface AnalysisMessage {
  id: string;
  type: string;
  direction: string;
  provider: string | null;
  content: string | null;
  aiAnalyzed: boolean | null;
}

export interface InboundSmsAnalysisDependencies {
  load: (id: string) => Promise<AnalysisMessage | null | undefined>;
  analyze: (content: string) => Promise<SmsAnalysisResult | null>;
  persist: (id: string, patch: Record<string, unknown>) => Promise<unknown>;
  received: (id: string) => Promise<void>;
  analyzed?: (id: string, result: SmsAnalysisResult) => Promise<void>;
  negative: (id: string, result: SmsAnalysisResult) => Promise<void>;
}

/** Fail independently from receipt handling; callers schedule this after durable inbox delivery. */
export async function analyzePersistedInboundSms(
  id: string,
  deps: InboundSmsAnalysisDependencies,
) {
  const message = await deps.load(id);
  if (!message || message.type !== "sms" || message.direction !== "inbound" ||
      !["bulkgate", "smstools"].includes(message.provider || "")) return "ignored";
  if (message.aiAnalyzed) return "already_analyzed";
  await deps.received(id);
  if (!message.content?.trim()) return "empty";
  const result = await deps.analyze(message.content);
  if (!result) return "unavailable";
  if (!["positive", "neutral", "negative", "angry"].includes(result.sentiment) ||
      !["none", "warning", "critical"].includes(result.alertLevel)) {
    throw new Error("invalid_sms_analysis_result");
  }
  const saved = await deps.persist(id, {
    aiAnalyzed: true,
    aiSentiment: result.sentiment,
    aiAlertLevel: result.alertLevel,
    aiHasAngryTone: result.hasAngryTone,
    aiHasRudeExpressions: result.hasRudeExpressions,
    aiWantsToCancel: result.wantsToCancel,
    aiWantsConsent: result.wantsConsent,
    aiDoesNotAcceptContract: result.doesNotAcceptContract,
    aiAnalysisNote: result.note,
    aiAnalyzedAt: new Date(),
  });
  if (!saved) throw new Error("sms_analysis_persistence_failed");
  await deps.analyzed?.(id, result);
  if (result.sentiment === "negative" || result.sentiment === "angry" || result.hasAngryTone) {
    await deps.negative(id, result);
  }
  return "analyzed";
}

const activeAnalyses = new Set<string>();
/** Deduplicate local scheduling without keeping content or identities in a queue. */
export function scheduleInboundSmsAnalysis(
  id: string,
  deps: InboundSmsAnalysisDependencies,
) {
  if (activeAnalyses.has(id)) return;
  activeAnalyses.add(id);
  void analyzePersistedInboundSms(id, deps)
    .catch(() => console.error("[SMS Analysis] Background processing failed"))
    .finally(() => activeAnalyses.delete(id));
}
