import { z } from "zod";
import { emailPurposeSchema, type EmailPurpose } from "./email-purpose";

export const funnelSources = [
  "qualified", "agreed", "proposalAccepted", "proposalUnaccepted", "proposalOther",
  "email", "sent", "received", "returned", "validated", "activeWith", "activeWithout",
  "materials17", "materials18", "materials19", "unqualified", "refused",
  "absent", "wrongNumber", "notWorking",
] as const;
export type FunnelSource = typeof funnelSources[number];
// Keep the retired contract-active source in saved v1 configurations, but it no
// longer controls cooperation: that branch uses validated + agreed + proposal.
export const configurableFunnelSources = funnelSources.filter(source => source !== "activeWith");
export const funnelSteps = [
  "assigned", "dialed", "connected", "qualified", "agreed", "wantsContract",
  "withoutContract", "email", "wantsToSign", "sent", "received", "returned",
  "validated", "cooperating", "packageSent", "materials",
] as const;
export type FunnelStep = typeof funnelSteps[number];
export const funnelExceptions = ["unqualified", "refused", "unreachable", "absent", "wrongNumber", "notWorking"] as const;
export type FunnelException = typeof funnelExceptions[number];
export const funnelConfigSchema = z.object({
  version: z.literal(1),
  emailPurposes: z.array(emailPurposeSchema.refine(p => p !== "unspecified")).max(4)
    .refine(values => new Set(values).size === values.length).optional(),
  absenceReturnQuestionId: z.string().min(1).max(100).nullable().optional(),
  materials: z.object({
    packageSent: z.array(z.string().min(1).max(100)).max(100),
    excluded: z.object({
      materials17: z.array(z.string().min(1).max(100)).max(100),
      materials18: z.array(z.string().min(1).max(100)).max(100),
      materials19: z.array(z.string().min(1).max(100)).max(100),
    }).strict(),
  }).strict().optional(),
  sources: z.object(Object.fromEntries(funnelSources.map(key => [key, z.array(z.string().min(1).max(100)).max(100)])) as Record<FunnelSource, z.ZodArray<z.ZodString>>).strict(),
}).strict();
export type FunnelConfig = z.infer<typeof funnelConfigSchema>;
/** An explicit [] disables typed-message proofs, not legacy mapped actions. */
export function effectiveFunnelEmailPurposes(config?: Pick<FunnelConfig, "emailPurposes">): EmailPurpose[] {
  return config?.emailPurposes ?? ["cooperation_proposal"];
}
export interface FunnelItem { id: string; stepId: string; label: string; parentId: string | null }
export interface FunnelDateQuestion { id: string; label: string }
export interface FunnelMember {
  id: string; name: string; firstDate: string | null; inferred: boolean;
  evidenceDate: string | null; basis: "call" | "history" | "state" | "derived" | "current";
  /** Explicitly distinguishes a reviewed record date from a sending date. */
  timestampKind?: "recorded";
  returnDate?: string | null;
  /** Author of the actual dated proof. Derived/current/ambiguous proof has no author. */
  actorId?: string | null;
}
export interface FunnelRow {
  key: FunnelStep; total: number | null; direct: number | null; inferred: number | null;
  previousPercent: number | null; qualifiedPercent: number | null;
  members: FunnelMember[];
}
export interface MissionFunnelReport {
  version: string; generatedAt: string; timezone: string; missionName: string;
  canConfigure: boolean; canReviewHistoricalEmails?: boolean; config: FunnelConfig; items: FunnelItem[];
  dateQuestions?: FunnelDateQuestion[];
  agentComparison?: AgentFunnelComparison;
  rows: FunnelRow[];
  exceptions: { key: FunnelException; members: FunnelMember[]; measurable: boolean }[];
  quality: { clinics: number; cohort: number; withoutAttempt: number; provisional: number;
    orphanCalls: number; duplicateEnrollments: number; stateOnly: number; unknownProposal: number };
}
export interface AgentFunnelMetric extends FunnelRow {
  missionPercent: number | null;
}
export interface AgentFunnelResult {
  agentId: string | null;
  agentName: string | null;
  /** Distinct clinics represented in this view, not a sum of milestone counts. */
  clinicCount: number;
  rows: AgentFunnelMetric[];
}
export interface AgentFunnelComparison {
  version: "agent-funnel-v1";
  cohort: AgentFunnelResult[];
  contribution: AgentFunnelResult[];
}
export interface FunnelFilters { from?: string; to?: string; referral?: "all" | "yes" | "no" }

export function emptyFunnelConfig(): FunnelConfig {
  const sources = {} as FunnelConfig["sources"];
  for (const key of funnelSources) sources[key] = [];
  return { version: 1, sources };
}

// Exact business codes only. Canonical status keys and translated labels are
// intentionally NOT interpreted: they are shared by positive and negative choices.
export function suggestFunnelConfig(items: FunnelItem[]): FunnelConfig {
  const config = emptyFunnelConfig();
  const codes: Partial<Record<FunnelSource, string[]>> = {
    qualified: ["MPN-04b"], agreed: ["MPN-05c"], proposalAccepted: ["MPN-06d"],
    proposalUnaccepted: ["MPN-06e"], proposalOther: ["MPN-06a", "MPN-06b", "MPN-06c"],
    email: ["MPN-07b"], sent: ["MPN-08b"], received: ["MPN-10c"],
    returned: ["MPN-11a"], validated: ["MPN-12e"], unqualified: ["MPN-04c"],
    refused: ["MPN-05d"],
    materials17: ["MPN-13d"], materials18: ["MPN-14d"], materials19: ["MPN-15d"],
  };
  for (const source of funnelSources) {
    config.sources[source] = items.filter(item => codes[source]?.includes(item.stepId)).map(item => item.id);
  }
  const excluded = {
    materials17: items.filter(item => item.stepId === "MPN-13e").map(item => item.id),
    materials18: items.filter(item => item.stepId === "MPN-14e").map(item => item.id),
    materials19: items.filter(item => item.stepId === "MPN-15e").map(item => item.id),
  };
  if (Object.values(excluded).some(ids => ids.length)) config.materials = { packageSent: [], excluded };
  return config;
}
