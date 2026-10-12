import { getOmniSmsNotificationAudience } from "../omni-sms-service";
import { notificationService } from "./notification-service";
import { smsReadCopy } from "../../shared/omni-sms-copy";

const countryLocales: Record<string, keyof typeof smsReadCopy> = {
  SK: "sk", CZ: "cs", HU: "hu", RO: "ro", IT: "it", DE: "de", AT: "de", CH: "de", US: "en",
};

/** Persist and push a notice only to people who can actually open this SMS. */
export async function notifyIncomingOmniSms(
  messageId: string,
  deliver = notificationService.sendNotificationToUsers.bind(notificationService),
) {
  const audience = await getOmniSmsNotificationAudience(messageId);
  for (const member of audience) {
    const locale = member.countries?.length === 1 ? countryLocales[member.countries[0]] || "en" : "en";
    const copy = smsReadCopy[locale];
    const provider = member.provider === "bulkgate" ? "BulkGate" : "SMSTOOLS";
    await deliver([member.id], {
      type: "new_sms", title: `${copy.newIncoming} · ${provider}`, message: copy.newIncoming,
      priority: "normal", entityType: "sms", entityId: messageId,
      countryCode: member.countryCode || undefined,
      metadata: { provider: member.provider, source: "omni_sms" },
    });
  }
  return audience.length;
}
