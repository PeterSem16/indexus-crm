const callingCodes: Record<string, string> = {
  SK: "421", CZ: "420", CS: "420", HU: "36", RO: "40", IT: "39",
  DE: "49", AT: "43", PL: "48",
};

/** Full international identity, never a last-nine-digits authorization. */
export function callbackPhoneKey(value: unknown, country?: string | null): string | null {
  const text = String(value || "").trim();
  let digits = text.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 16) return null;
  if (text.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  const prefix = callingCodes[String(country || "").toUpperCase()];
  if (!prefix) return `local:${digits}`;
  // Italian national mobile numbers can themselves start with 39, and
  // geographic numbers (including the 039 area) retain their leading zero.
  if (prefix === "39" && (digits.startsWith("0") || (digits.length === 10 && digits.startsWith("3")))) {
    return prefix + digits;
  }
  if (digits.startsWith(`0${prefix}`) && digits.length > prefix.length + 8) return digits.slice(1);
  if (digits.startsWith(prefix) && digits.length > prefix.length + 7) return digits;
  // Italian geographic numbers retain their leading zero internationally.
  return prefix + (prefix === "39" ? digits : digits.replace(/^0/, ""));
}

/** Bind the authorized callback to the full number actually observed by Asterisk. */
export function callbackRecordingDestinationMatches(
  binding: { destinationPhoneKey?: string; destinationCountry?: string | null } | null,
  observed: unknown,
  legacyExpected: string,
): boolean {
  if (!binding) return !!legacyExpected && String(observed || "").replace(/\D/g, "").slice(-9) === legacyExpected;
  if (!binding.destinationPhoneKey) return false;
  return callbackPhoneKey(observed, binding.destinationCountry) === binding.destinationPhoneKey;
}

export interface MissedCallbackSelection {
  sourceId: string;
  campaignId: string;
  entityId: string;
  contactType: string;
  callerNumber: string;
}

/** Card changes, Mission changes and manual dialing cannot reuse another callback. */
export function selectedMissedCallbackSource(
  selection: MissedCallbackSelection | null,
  input: { campaignId?: string | null; entityId?: string | null; contactType: string; phone: string; country?: string },
): string | undefined {
  if (!selection || selection.campaignId !== input.campaignId ||
      selection.entityId !== input.entityId || selection.contactType !== input.contactType) return undefined;
  const original = callbackPhoneKey(selection.callerNumber, input.country);
  return original && original === callbackPhoneKey(input.phone, input.country) ? selection.sourceId : undefined;
}

export interface MissedCallbackEvidence {
  callId: string;
  campaignId: string | null;
  queueId: string;
  status: string;
  callerNumber: string;
  activeCampaignIds: string[];
  activeQueueIds: string[];
  queueMember: boolean;
  missionAssigned: boolean;
  country?: string | null;
  entityCountry?: string | null;
  entityPhones: unknown[];
  entityActive: boolean;
}

export function validateMissedCallback(
  evidence: MissedCallbackEvidence | undefined,
  input: { sourceId: string; campaignId: string; phone: unknown },
): "CONTACT_INACTIVE" | "MISSED_CALLBACK_FORBIDDEN" | null {
  if (!evidence || evidence.callId !== input.sourceId || evidence.campaignId !== input.campaignId ||
      !evidence.activeCampaignIds.includes(input.campaignId) || !evidence.queueMember ||
      !evidence.missionAssigned ||
      (evidence.activeQueueIds.length > 0 && !evidence.activeQueueIds.includes(evidence.queueId)) ||
      !["abandoned", "timeout", "overflow", "no_agents"].includes(evidence.status)) return "MISSED_CALLBACK_FORBIDDEN";
  if (!evidence.entityActive) return "CONTACT_INACTIVE";
  const original = callbackPhoneKey(evidence.callerNumber, evidence.country);
  if (!original || original !== callbackPhoneKey(input.phone, evidence.country) ||
      !evidence.entityPhones.some(phone => callbackPhoneKey(phone, evidence.entityCountry || evidence.country) === original)) {
    return "MISSED_CALLBACK_FORBIDDEN";
  }
  return null;
}
