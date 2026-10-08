export const AUTOMATION_SMS_MAX_RECIPIENTS = 50;

/** Explicit recipients only. Formatting is not part of the routing identity. */
export function normalizeSmsRecipient(value: unknown): string {
  if (typeof value !== "string" || /{{|}}/.test(value))
    throw new Error("SMS recipients must be explicit international phone numbers");
  const normalized = value.trim().replace(/[\s().-]/g, "").replace(/^00/, "+");
  if (!/^\+[1-9]\d{6,14}$/.test(normalized))
    throw new Error("SMS number must include an international dial code and 7–15 digits");
  return normalized;
}

export function smsRecipientList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  if (!values.length || values.length > AUTOMATION_SMS_MAX_RECIPIENTS)
    throw new Error(`Choose between 1 and ${AUTOMATION_SMS_MAX_RECIPIENTS} SMS recipients`);
  return Array.from(new Set(values.map(normalizeSmsRecipient)));
}

/** The receiving number's dial code never determines rule/campaign ownership. */
export function automationSmsCountry(ctx: any): string | undefined {
  const eventCountry = ctx.event?.countryCode;
  if (typeof eventCountry === "string" && eventCountry.trim()) return eventCountry.trim().toUpperCase();
  const countries = Array.from(new Set([
    ...(Array.isArray(ctx.rule?.countryCodes) ? ctx.rule.countryCodes : []),
    ctx.rule?.countryCode,
  ].filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .map(value => value.trim().toUpperCase())));
  return countries.length === 1 ? countries[0] : undefined;
}
