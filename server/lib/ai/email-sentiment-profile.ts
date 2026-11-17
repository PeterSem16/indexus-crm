/** Capability grant and request policy only. Never activates a production route. */
export const EMAIL_SENTIMENT_MODEL = "indexus-email-sentiment:4b";
export const EMAIL_SENTIMENT_PROFILE = Object.freeze({
  service: "email.sentiment" as const,
  model: EMAIL_SENTIMENT_MODEL,
  timeoutMs: 30_000,
  maxRetries: 0,
  temperature: 0.1,
  max_tokens: 300,
  response_format: Object.freeze({ type: "json_object" as const }),
  stream: false as const,
});
