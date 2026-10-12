import type { OmniSmsMessage } from "@shared/omni-sms";
import { providerCountryAllowed } from "./omni-sms-policy";

// Apply only AFTER the source message has passed current persisted access checks.
// No caller-supplied recipient, gateway, entity or Mission belongs in this result.
export function authoritativeOmniSmsReply(source: OmniSmsMessage) {
  const phone = source.direction === "inbound" ? source.senderPhone : source.recipientPhone;
  if (!phone || !source.countryCode || !source.provider ||
      !providerCountryAllowed(source.provider, source.countryCode)) return null;
  return {
    to: phone,
    customerId: source.entityId || source.customerId || undefined,
    contactType: source.entityType || "customer",
    campaignId: source.campaignId || undefined,
    provider: source.provider,
    country: source.countryCode,
  };
}
