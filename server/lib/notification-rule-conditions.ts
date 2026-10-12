/** Small, explicit equality filters for persisted notification-event data. */
export function notificationConditionsNeedAnalysis(conditions: unknown): boolean {
  return !!conditions && typeof conditions === "object" && !Array.isArray(conditions) &&
    Object.keys(conditions).some(key => !["countryCode", "provider"].includes(key));
}

export function matchesNotificationConditions(
  conditions: unknown,
  data: { countryCode?: string; metadata?: Record<string, unknown> },
): boolean {
  if (conditions == null) return true;
  if (typeof conditions !== "object" || Array.isArray(conditions)) return false;
  const supported = new Set([
    "countryCode", "provider", "sentiment", "alertLevel", "hasAngryTone",
    "hasRudeExpressions", "wantsToCancel", "wantsConsent", "doesNotAcceptContract",
  ]);
  return Object.entries(conditions).every(([key, expected]) => {
    if (!supported.has(key)) return false;
    const actual = key === "countryCode" ? data.countryCode : data.metadata?.[key];
    if (Array.isArray(expected)) return expected.length > 0 &&
      expected.every(value => ["string", "boolean", "number"].includes(typeof value)) &&
      expected.includes(actual);
    return ["string", "boolean", "number"].includes(typeof expected) && actual === expected;
  });
}
