import { z } from "zod";

export const funnelSources = [
  "qualified", "agreed", "proposalAccepted", "proposalUnaccepted", "proposalOther",
  "email", "sent", "received", "returned", "validated", "activeWith", "activeWithout",
  "materials17", "materials18", "materials19", "unqualified", "refused",
  "absent", "wrongNumber", "notWorking",
] as const;
export type FunnelSource = typeof funnelSources[number];
export const funnelSteps = [
  "assigned", "dialed", "connected", "qualified", "agreed", "wantsContract",
  "withoutContract", "email", "wantsToSign", "sent", "received", "returned",
  "validated", "cooperating", "materials",
] as const;
export type FunnelStep = typeof funnelSteps[number];
export const funnelExceptions = ["unqualified", "refused", "unreachable", "absent", "wrongNumber", "notWorking"] as const;
export type FunnelException = typeof funnelExceptions[number];
export const funnelConfigSchema = z.object({
  version: z.literal(1),
  absenceReturnQuestionId: z.string().min(1).max(100).nullable().optional(),
  sources: z.object(Object.fromEntries(funnelSources.map(key => [key, z.array(z.string().min(1).max(100)).max(100)])) as Record<FunnelSource, z.ZodArray<z.ZodString>>).strict(),
}).strict();
export type FunnelConfig = z.infer<typeof funnelConfigSchema>;
export interface FunnelItem { id: string; stepId: string; label: string; parentId: string | null }
export interface FunnelDateQuestion { id: string; label: string }
export interface FunnelMember {
  id: string; name: string; firstDate: string | null; inferred: boolean;
  evidenceDate: string | null; basis: "call" | "history" | "state" | "derived" | "current";
  returnDate?: string | null;
}
export interface FunnelRow {
  key: FunnelStep; total: number | null; direct: number | null; inferred: number | null;
  previousPercent: number | null; qualifiedPercent: number | null;
  members: FunnelMember[];
}
export interface MissionFunnelReport {
  version: string; generatedAt: string; timezone: string; missionName: string;
  canConfigure: boolean; config: FunnelConfig; items: FunnelItem[];
  dateQuestions?: FunnelDateQuestion[];
  rows: FunnelRow[];
  exceptions: { key: FunnelException; members: FunnelMember[]; measurable: boolean }[];
  quality: { clinics: number; cohort: number; withoutAttempt: number; provisional: number;
    orphanCalls: number; duplicateEnrollments: number; stateOnly: number; unknownProposal: number };
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
  };
  for (const source of funnelSources) {
    config.sources[source] = items.filter(item => codes[source]?.includes(item.stepId)).map(item => item.id);
  }
  return config;
}
