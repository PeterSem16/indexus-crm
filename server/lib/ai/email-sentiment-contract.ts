export interface EmailSentimentAnalysis {
  sentiment: "positive" | "neutral" | "negative" | "angry";
  hasInappropriateContent: boolean;
  hasAngryTone: boolean;
  hasRudeExpressions: boolean;
  wantsToCancel: boolean;
  wantsConsent: boolean;
  doesNotAcceptContract: boolean;
  alertLevel: "none" | "warning" | "critical";
  note: string;
}

/** No coercion, missing-field defaults, alias repairs or invented model findings. */
export function parseEmailSentimentAnalysis(content: string): EmailSentimentAnalysis {
  try {
    if (typeof content !== "string" || content.length > 32_768) throw new Error();
    const trimmed = content.trim();
    // Preserve compatibility with the original OpenAI caller's fenced JSON.
    const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
    const value = JSON.parse(fenced ? fenced[1] : trimmed);
    const booleans = ["hasInappropriateContent", "hasAngryTone", "hasRudeExpressions",
      "wantsToCancel", "wantsConsent", "doesNotAcceptContract"];
    const fields = ["sentiment", ...booleans, "alertLevel", "note"];
    if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== fields.length ||
      !fields.every(key => Object.hasOwn(value, key)) ||
      !["positive", "neutral", "negative", "angry"].includes(value.sentiment) ||
      !["none", "warning", "critical"].includes(value.alertLevel) ||
      !booleans.every(key => typeof value[key] === "boolean") ||
      typeof value.note !== "string" || !value.note.trim() || value.note.length > 1000)
      throw new Error();
    return value as EmailSentimentAnalysis;
  } catch {
    // Never include the source email, model text or parser exception in diagnostics.
    throw new Error("email_sentiment_invalid_analysis");
  }
}

/** Preserve a machine-readable reason without echoing a vendor message or email. */
export function emailSentimentReviewReason(error: unknown):
  "possible_prompt_injection_affected_consent_classification" | "unspecified" {
  const value = error as { reason_code?: unknown; message?: unknown } | null;
  if (value?.reason_code === "possible_prompt_injection_affected_consent_classification" ||
    value?.message === "REVIEW_REQUIRED: possible prompt injection affected consent classification")
    return "possible_prompt_injection_affected_consent_classification";
  return "unspecified";
}

/** A safe, explicit failure identity; never a successful all-false classification. */
export function emailSentimentRequestId(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value)
    ? value : undefined;
}

export function emailSentimentFailure(error: unknown): {
  status: "review_required" | "failed"; code: string;
  reason?: ReturnType<typeof emailSentimentReviewReason>;
  httpStatus?: number; request_id?: string;
} {
  const value = error as {
    status?: unknown; code?: unknown; type?: unknown; message?: unknown; error?: unknown;
  } | null;
  if (value?.status === 422 && value.code === "review_required" && value.type === "review_required")
    return { status: "review_required", code: "review_required",
      reason: emailSentimentReviewReason(value.error) };
  if (value?.message === "email_sentiment_invalid_analysis")
    return { status: "failed", code: "email_sentiment_invalid_analysis" };
  if (value?.status === 503 || value?.status === 504) {
    const envelope = value.error as { request_id?: unknown } | null;
    const requestId = emailSentimentRequestId(envelope?.request_id);
    return { status: "failed", code: "email_sentiment_unavailable", httpStatus: value.status,
      ...(requestId ? { request_id: requestId } : {}) };
  }
  return { status: "failed", code: "email_sentiment_unavailable" };
}
