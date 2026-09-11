/**
 * Produces a persistence key without merging different international numbers.
 * `+421...` and `00421...` are equivalent; a local number remains deliberately
 * separate because its country cannot be inferred safely from the digits alone.
 */
export function normalizePhonePreferenceKey(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const hasInternationalPrefix = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (hasInternationalPrefix) {
    const e164Digits = digits.replace(/^00/, "");
    return e164Digits ? `e164:${e164Digits}` : null;
  }

  return `local:${digits}`;
}