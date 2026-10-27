import { z } from "zod";
import { healthcareSourceSchema } from "./status-list-healthcare";

export const reachabilityStates = ["not_defined", "waiting", "unreachable", "reachable"] as const;
export const reachabilityPolicySchema = z.object({
  calls: z.boolean(),
  email: z.boolean(),
  sms: z.boolean(),
  failedAttempts: z.number().int().min(1).max(100),
  replyWaitHours: z.number().int().min(1).max(720),
  minimumTalkSeconds: z.number().int().min(1).max(600),
  successValidDays: z.number().int().min(0).max(3650),
}).strict().refine(p => p.calls || p.email || p.sms, "Select a communication channel");
export const defaultReachabilityPolicy = {
  calls: true, email: true, sms: true, failedAttempts: 1,
  replyWaitHours: 48, minimumTalkSeconds: 1, successValidDays: 0,
};
const id = z.string().min(1).max(100);
export const optionSourceConfigSchema = z.discriminatedUnion("source", [
  healthcareSourceSchema,
  z.object({
    source: z.literal("reachability"), hidden: z.boolean(),
    mapping: z.object({ not_defined: id, waiting: id, unreachable: id, reachable: id }).strict(),
    policy: reachabilityPolicySchema,
  }).strict(),
  z.object({
    source: z.literal("coordinator"), hidden: z.boolean(),
    mapping: z.object({ unassigned: id, assigned: id }).strict(),
    users: z.array(z.object({ userId: id, optionId: id }).strict()).max(100),
  }).strict(),
]).superRefine((config, ctx) => {
  const options = Object.values(config.mapping);
  if (new Set(options).size !== options.length) ctx.addIssue({ code: "custom", message: "Each state requires a different option" });
  if (config.source === "coordinator" && new Set(config.users.map(u => u.userId)).size !== config.users.length)
    ctx.addIssue({ code: "custom", message: "Duplicate coordinator mapping" });
});
export type OptionSourceConfig = z.infer<typeof optionSourceConfigSchema>;
export type ReachabilityPolicy = z.infer<typeof reachabilityPolicySchema>;
export type OptionSource = OptionSourceConfig & { groupId: string };
export type CommunicationEvidence = {
  id: string; channel: "calls" | "email" | "sms";
  kind: "success" | "failure" | "waiting"; at: number;
};
/** No delivery/open receipt is success. A known successful conversation wins
 * over later failures unless the explicitly configured validity expires. */
export function evaluateReachability(evidence: CommunicationEvidence[], policy: ReachabilityPolicy, now: number) {
  const selected = evidence.filter(e => policy[e.channel] && Number.isFinite(e.at) && e.at <= now);
  const success = selected.filter(e => e.kind === "success").sort((a, b) => b.at - a.at)[0];
  if (success && (!policy.successValidDays || now - success.at <= policy.successValidDays * 86400_000)) return "reachable";
  const recent = selected.filter(e => !success || e.at > success.at);
  if (recent.some(e => e.kind === "waiting" && now - e.at < policy.replyWaitHours * 3600_000)) return "waiting";
  if (new Set(recent.filter(e => e.kind === "failure" ||
    (e.kind === "waiting" && now - e.at >= policy.replyWaitHours * 3600_000)).map(e => e.id)).size >= policy.failedAttempts)
    return "unreachable";
  return "not_defined";
}
export function remapOptionSource(config: OptionSourceConfig, ids: Map<string, string>): OptionSourceConfig {
  const remap = (value: string) => {
    const mapped = ids.get(value);
    if (!mapped) throw new Error("Missing cloned source option");
    return mapped;
  };
  return { ...config, mapping: Object.fromEntries(Object.entries(config.mapping).map(([key, value]) => [key, remap(value)])),
    ...(config.source === "coordinator" ? { users: config.users.map(u => ({ ...u, optionId: remap(u.optionId) })) } : {}) } as OptionSourceConfig;
}
