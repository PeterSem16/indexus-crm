import type { AnalysisSource } from "./automation-analysis-source";
import { matchRecordContacts } from "./automation-record-entry";
import { updateRecordOwner } from "./automation-update-record";
import { forwardSenderDecision } from "../../shared/automation-forward-review";

export async function matchForwardSender(source: AnalysisSource, ctx: any) {
  const owner = await updateRecordOwner(ctx.rule.createdByUserId);
  const country = typeof source.communication.countryCode === "string" ? source.communication.countryCode : null;
  const ruleCountries: string[] | null = ctx.rule.countryCodes?.length ? ctx.rule.countryCodes
    : ctx.rule.countryCode ? [ctx.rule.countryCode] : null;
  if (country && ruleCountries && !ruleCountries.includes(country)) throw new Error("forward_source_not_eligible");
  // Never expose cross-country candidates through a shared countryless task.
  const countries = country ? [country] : ruleCountries?.length === 1 ? ruleCountries : null;
  if (!countries) return { ...forwardSenderDecision(true, [], true), country: null };
  const email = source.channel === "email" && typeof source.communication.senderEmail === "string" ? source.communication.senderEmail : undefined;
  const phone = source.channel === "sms" && typeof source.communication.senderPhone === "string" ? source.communication.senderPhone : undefined;
  if (!email && !phone) return { ...forwardSenderDecision(true, []), country: countries[0] };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || phone && !/^(?:\+|00)?[\d ()-]{7,40}$/.test(phone.trim()))
    return { ...forwardSenderDecision(true, []), country: countries[0] };
  const plan = await matchRecordContacts({ targetType: "customer", email: email || undefined, phone: phone || undefined }, owner, countries);
  return { ...forwardSenderDecision(true, plan.records.map(record => record.id), plan.truncated), country: countries[0] };
}
