export type OutboundCallProvider = "O2-IMS";

export function normalizePhoneForRouting(value: string | null | undefined): string {
  const cleaned = (value || "").trim().replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return `+${cleaned.slice(1).replace(/\D/g, "")}`;
  if (cleaned.startsWith("00")) return `+${cleaned.slice(2).replace(/\D/g, "")}`;
  return cleaned.replace(/\D/g, "");
}

export function isO2ImsOutboundCallerId(value: string | null | undefined): boolean {
  const normalized = normalizePhoneForRouting(value);
  return /^\+42122213323\d$/.test(normalized) || /^42122213323\d$/.test(normalized);
}

export function resolveOutboundCallProvider(
  callerIdNumber: string | null | undefined,
): OutboundCallProvider | undefined {
  return isO2ImsOutboundCallerId(callerIdNumber) ? "O2-IMS" : undefined;
}