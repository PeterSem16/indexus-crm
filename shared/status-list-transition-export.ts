import { z } from "zod";

/** Deliberately contains no free-form configuration, labels, recipients or secrets. */
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().uuid();
export const transitionExportSchema = z.object({
  format: z.literal("indexus-transition-inventory-v1"),
  campaignId: id,
  capturedAt: z.string().datetime(),
  source: z.object({
    instance: digest,
    commit: z.string().regex(/^[a-f0-9]{40}$/).nullable(),
    runtime: z.enum(["production", "non_production", "unknown"]),
    // Runtime mode and a checksum do not authenticate a remote production server.
    productionIdentityVerified: z.literal(false),
  }).strict(),
  records: z.array(z.object({
    kind: z.enum(["campaign", "item", "question", "automation", "disposition", "rule", "source", "option_source", "email_template", "sms_template", "task_group"]),
    id,
    digest,
  }).strict()).max(30000),
  dependencies: z.array(z.object({
    owner: id,
    kind: z.enum(["item", "question", "disposition", "email_template", "sms_template", "task_group", "mailbox", "gateway", "role_membership", "webhook", "workflow_references", "source_references", "executor", "schema"]),
    // Invalid/legacy non-UUID references are opaque hashes, never free-form text.
    target: z.union([id, digest]).nullable(),
    state: z.enum(["present", "missing", "unknown"]),
    digest: digest.nullable(),
  }).strict()).max(60000),
  unknowns: z.array(z.enum(["source_identity", "source_commit", "runtime", "schema", "external_dependencies", "workflow_references", "source_references"])).max(20),
  fingerprint: digest,
  activationAllowed: z.literal(false),
}).strict().superRefine((value, context) => {
  if (value.records.filter(row => row.kind === "campaign" && row.id === value.campaignId).length !== 1 ||
      value.records.some(row => row.kind === "campaign" && row.id !== value.campaignId))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "campaign_manifest" });
  if (!value.unknowns.includes("source_identity") ||
      !value.dependencies.some(row => row.kind === "schema") ||
      !value.dependencies.some(row => row.kind === "executor" && row.state === "unknown"))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "coverage_manifest" });
  if (value.dependencies.some(row => row.state === "present" && !row.digest))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "dependency_integrity" });
});
export type TransitionExport = z.infer<typeof transitionExportSchema>;
export const TRANSITION_EXPORT_MAX_BYTES = 12 * 1024 * 1024;
export const TRANSITION_EXPORT_MAX_AGE_MS = 15 * 60 * 1000;

/** Shared canonical bytes, independent of JSON property order. Array order is significant. */
export function canonicalTransitionJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalTransitionJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, entry]) =>
      `${JSON.stringify(key)}:${canonicalTransitionJson(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function transitionExportPayload(value: TransitionExport) {
  const { fingerprint: _, ...payload } = value;
  return canonicalTransitionJson(payload);
}
export async function verifyTransitionExport(input: unknown): Promise<TransitionExport> {
  const parsed = transitionExportSchema.parse(input);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(transitionExportPayload(parsed)));
  const actual = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== parsed.fingerprint) throw new Error("integrity");
  const keys = parsed.records.map(row => `${row.kind}:${row.id}`);
  const deps = parsed.dependencies.map(row => `${row.owner}:${row.kind}:${row.target}`);
  if (new Set(keys).size !== keys.length || new Set(deps).size !== deps.length) throw new Error("duplicate");
  return parsed;
}
export type TransitionExportDiff = {
  changes: { kind: string; id: string; change: "added" | "removed" | "changed" }[];
  blockers: ("baseline_missing" | "source_changed" | "campaign_changed" | "stale" | "clock" | "unknown" | "dependencies" | "configuration_changed" | "historical_only" | "out_of_order")[];
  approvalValid: false;
  activationAllowed: false;
};
/** Baseline freshness is irrelevant; only the new evidence must be fresh. No approval is inferred. */
export function compareTransitionExports(current: TransitionExport, previous: TransitionExport | null, now = Date.now()): TransitionExportDiff {
  const blockers: TransitionExportDiff["blockers"] = ["historical_only"];
  const changes: TransitionExportDiff["changes"] = [];
  if (!previous) blockers.push("baseline_missing");
  if (previous && current.campaignId !== previous.campaignId) blockers.push("campaign_changed");
  if (previous && Date.parse(previous.capturedAt) > Date.parse(current.capturedAt)) blockers.push("out_of_order");
  if (previous && canonicalTransitionJson(current.source) !== canonicalTransitionJson(previous.source)) blockers.push("source_changed");
  const age = now - Date.parse(current.capturedAt);
  if (!Number.isFinite(age) || age > TRANSITION_EXPORT_MAX_AGE_MS) blockers.push("stale");
  if (age < -60_000) blockers.push("clock");
  if (current.unknowns.length || !current.source.productionIdentityVerified ||
      !current.source.commit || current.source.runtime !== "production") blockers.push("unknown");
  if (current.dependencies.some(row => row.state !== "present") || !current.dependencies.length) blockers.push("dependencies");
  const before = new Map(previous?.records.map(row => [`${row.kind}:${row.id}`, row]) || []);
  for (const row of current.records) {
    const key = `${row.kind}:${row.id}`;
    const old = before.get(key);
    if (!old || old.digest !== row.digest) changes.push({ kind: row.kind, id: row.id, change: old ? "changed" : "added" });
    before.delete(key);
  }
  for (const row of Array.from(before.values())) changes.push({ kind: row.kind, id: row.id, change: "removed" });
  const oldDeps = new Map(previous?.dependencies.map(row => [`${row.owner}:${row.kind}:${row.target}`, row]) || []);
  for (const row of current.dependencies) {
    const key = `${row.owner}:${row.kind}:${row.target}`;
    const old = oldDeps.get(key);
    if (!old || canonicalTransitionJson(old) !== canonicalTransitionJson(row))
      changes.push({ kind: `dependency:${row.kind}`, id: row.owner, change: old ? "changed" : "added" });
    oldDeps.delete(key);
  }
  for (const row of Array.from(oldDeps.values())) changes.push({ kind: `dependency:${row.kind}`, id: row.owner, change: "removed" });
  if (previous && changes.length) blockers.push("configuration_changed");
  return { changes, blockers, approvalValid: false, activationAllowed: false };
}
