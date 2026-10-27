import { z } from "zod";

export const healthcareStates = ["not_defined", "unreached", "unreachable", "reachable", "wrong_number", "not_working", "long_term_absent"] as const;
export type HealthcareState = typeof healthcareStates[number];
export const healthcareLabels: Record<HealthcareState,string> = {
  not_defined:"Not defined yet", unreached:"Unreached", unreachable:"Unreachable", reachable:"Reachable",
  wrong_number:"Wrong number", not_working:"Not working", long_term_absent:"Long-term absent",
};
export const healthcareSubstatuses = ["practice_closed", "doctor_left", "contact_not_found", "five_failed_attempts"] as const;
export const healthcarePolicySchema = z.object({
  enabled: z.object({
    not_defined:z.boolean().default(true),unreached:z.boolean().default(true),unreachable:z.boolean().default(true),
    reachable:z.boolean().default(true),wrong_number:z.boolean().default(true),not_working:z.boolean().default(true),
    long_term_absent:z.boolean().default(true),
  }).strict().default({}),
  failedAttempts:z.number().int().min(1).max(100).default(5),
  minTalkSeconds:z.number().int().min(1).max(3600).default(3),
}).strict();
export type HealthcarePolicy = z.infer<typeof healthcarePolicySchema>;
export const healthcareDefaultPolicy = healthcarePolicySchema.parse({});
export const healthcareSourceSchema = z.object({
  source:z.literal("healthcare_reachability"), hidden:z.boolean(),
  policy:healthcarePolicySchema.default({}),
  mapping:z.object({not_defined:z.string().min(1),unreached:z.string().min(1),unreachable:z.string().min(1),
    reachable:z.string().min(1),wrong_number:z.string().min(1),not_working:z.string().min(1),long_term_absent:z.string().min(1)}).strict(),
}).strict();
export const healthcareReviewSchema = z.object({
  expectedFingerprint:z.string().length(64),
  state:z.enum(["automatic","wrong_number","not_working","long_term_absent","unreachable"]),
  substatus:z.enum(healthcareSubstatuses).nullable(),
  proposedContact:z.string().trim().max(2000),
  voicemailCallId:z.string().min(1).max(200).nullable().optional(),
}).strict();
export type HealthcareCall = {
  id:string; key:string; at:number; ended:boolean; answered:boolean; talkSeconds:number; failed:boolean;
};
/** A SIP call is one attempt, even when it has duplicate log rows. Ring time
 * and caller-channel Up on forwarded calls are never conversation evidence. */
export function evaluateHealthcare(calls:HealthcareCall[], voicemailKeys:ReadonlySet<string>, manual:{
  state?:string|null; at?:number;
} = {}, policy:HealthcarePolicy=healthcareDefaultPolicy, previousState?:HealthcareState, counterResetAt=0) {
  const distinct = new Map<string,HealthcareCall>();
  for(const call of [...calls].sort((a,b)=>a.at-b.at)) if(call.ended) distinct.set(call.key,call);
  const ordered=Array.from(distinct.values()).sort((a,b)=>b.at-a.at || b.key.localeCompare(a.key));
  const success=ordered.find(c=>c.answered && c.talkSeconds>=policy.minTalkSeconds && !voicemailKeys.has(c.key));
  const override=manual.state && manual.state!=="automatic" && (!success || success.at<=(manual.at||0));
  const failures=ordered.filter(c=>c.at>Math.max(counterResetAt,success?.at||0) &&
    (c.failed || voicemailKeys.has(c.key) || c.answered && c.talkSeconds<policy.minTalkSeconds));
  const candidate:HealthcareState=override ? manual.state as HealthcareState : success ? "reachable" :
    failures.length>=policy.failedAttempts ? "unreachable" : failures.length ? "unreached" : "not_defined";
  const state:HealthcareState=policy.enabled[candidate] ? candidate :
    previousState && policy.enabled[previousState] ? previousState : "not_defined";
  const active=policy.enabled[candidate] || !!previousState && policy.enabled[previousState] || policy.enabled.not_defined;
  return {state, active, held:state!==candidate, failedAttempts:failures.length,
    lastAttempt:ordered[0]||null, reachableAt:success?.at??null};
}
