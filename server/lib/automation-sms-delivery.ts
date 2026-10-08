import { automationSmsCountry, smsRecipientList } from "../../shared/automation-sms-policy";

type DeliveryDependencies = {
  createMessage: (message: any) => Promise<{ id: string }>;
  updateMessage: (id: string, changes: any) => Promise<unknown>;
  send: (options: any) => Promise<any>;
};

/** Preflight the complete audience before creating history or sending anything. */
export async function deliverAutomationSms(rendered: any, ctx: any, deps: DeliveryDependencies) {
  const modern = rendered.smsActionVersion === 2;
  const recipients = modern ? smsRecipientList(rendered.to) : [String(rendered.to || "").trim()];
  const text = String(rendered.text ?? rendered.message ?? "").trim();
  if (!recipients[0]) throw new Error("send_sms requires a phone number");
  if (!text) throw new Error("send_sms requires message text");
  const country = automationSmsCountry(ctx);
  if (modern && !country) throw new Error("SMS country is missing or ambiguous in the event/rule");
  const campaignId = ctx.newValues?.campaignId || ctx.oldValues?.campaignId ||
    ctx.event?.newValues?.campaignId || ctx.event?.oldValues?.campaignId || undefined;
  const promotional = rendered.kind === "promotional" || rendered.promotional === true;
  const outcomes: any[] = [];
  for (const number of recipients) {
    let communicationId: string | undefined;
    let result: any;
    try {
      const communication = await deps.createMessage({
        customerId: ctx.customer?.id || (ctx.contact?.type === "customer" ? ctx.contact?.id : null)
          || (ctx.event?.entityType === "customer" ? ctx.event?.entityId : null) || ctx.event?.customerId || null,
        campaignId,
        entityType: ctx.contact?.type || ctx.customer?.type || ctx.event?.entityType
          || (ctx.customer || ctx.event?.customerId ? "customer" : undefined),
        entityId: ctx.contact?.id || ctx.customer?.id || ctx.event?.entityId || ctx.event?.customerId || undefined,
        userId: ctx.user?.id || ctx.actor?.id || ctx.event?.userId || null,
        type: "sms", direction: "outbound", content: text, recipientPhone: number, status: "pending",
        metadata: JSON.stringify({ source: "automation_engine", ruleId: ctx.rule?.id || ctx.event?.ruleId || null,
          campaignId: campaignId || null }),
      });
      communicationId = communication.id;
      result = await deps.send({
        number, text, country,
        // An event-owned Mission is authoritative; explicit gateway choices
        // apply only when no Mission owns the message.
        provider: campaignId || rendered.provider === "default" ? undefined : rendered.provider,
        campaignId, campaignProviderMode: "reject-conflict", promotional,
        unicode: rendered.unicode === true, tag: communicationId,
      });
    } catch (error: any) {
      result = { success: false, error: error?.message || "SMS delivery failed" };
    }
    let historyError: string | undefined;
    if (communicationId) {
      try {
        await deps.updateMessage(communicationId, {
          status: result.success ? "sent" : "failed", provider: result.provider,
          externalId: result.smsId, errorMessage: result.success ? undefined : result.error,
          sentAt: result.success ? new Date() : undefined,
          metadata: JSON.stringify({ batchId: result.batchId || null, source: "automation_engine",
            ruleId: ctx.rule?.id || ctx.event?.ruleId || null, campaignId: campaignId || null }),
        });
      } catch {
        // Never retry a successful vendor send merely because history failed.
        historyError = "SMS delivery history could not be updated";
      }
    }
    outcomes.push({ success: result.success === true, communicationId, smsId: result.smsId,
      batchId: result.batchId, provider: result.provider, errorCode: result.errorCode,
      error: result.success ? undefined : result.error || "SMS delivery failed", historyError,
      ...(modern ? {} : { number: result.number }) });
  }
  const sentCount = outcomes.filter(item => item.success).length;
  const failedCount = outcomes.length - sentCount;
  const firstFailure = outcomes.find(item => !item.success);
  return {
    ok: failedCount === 0,
    ...(firstFailure ? { error: firstFailure.error } : {}),
    output: {
      ...(outcomes.length === 1 ? outcomes[0] : {}),
      kind: promotional ? "promotional" : "transactional",
      recipientCount: outcomes.length, sentCount, failedCount, deliveries: outcomes,
    },
  };
}
