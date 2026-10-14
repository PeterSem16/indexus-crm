/** API-shaped models shared by the production Rules and Run History views. */
export type OverviewRule = {
  id: string; name: string; description: string | null; module: string;
  countryCode: string | null; countryCodes?: string[] | null;
  enabled: boolean; isSystem: boolean; trigger: any; conditions: any; actions: any[];
  rateLimitPerHour: number | null; updatedAt: string;
  consecutiveErrorCount?: number; lastErrorMessage?: string | null; disabledReason?: string | null;
};
export type OverviewRun = {
  id: string; ruleId: string; status: string; skippedReason: string | null;
  startedAt: string; finishedAt: string | null; error: string | null;
};
export type OverviewCatalog = {
  countries: { value: string; label: string }[]; modules: { value: string; label: string }[];
  eventTypes: { value: string; label: string }[]; actionTypes: { value: string; label: string }[];
};
export const ruleNeedsReview = (rule: OverviewRule) =>
  !!rule.trigger?.legacySource && !rule.trigger.legacySource.reviewActivatedAt;
export const ruleHasErrors = (rule: OverviewRule) =>
  !!rule.disabledReason || (rule.consecutiveErrorCount || 0) > 0;
export const ruleCountries = (rule: OverviewRule): string[] =>
  rule.countryCodes?.length ? rule.countryCodes : rule.countryCode ? [rule.countryCode] : [];
export function matchesRuleState(rule: OverviewRule, state: string) {
  return state === "all" || state === "active" && rule.enabled || state === "paused" && !rule.enabled
    || state === "attention" && ruleHasErrors(rule) || state === "review" && ruleNeedsReview(rule);
}
export function runDurationMs(run: OverviewRun): number | null {
  if (!run.finishedAt) return null;
  const value = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
export function runStatistics(runs: OverviewRun[]) {
  const counts: Record<string, number> = {};
  const durations: number[] = [];
  for (const run of runs) {
    counts[run.status] = (counts[run.status] || 0) + 1;
    const duration = runDurationMs(run);
    if (duration !== null) durations.push(duration);
  }
  const completed = (counts.success || 0) + (counts.failed || 0);
  return {
    total: runs.length, counts,
    successRate: completed ? Math.round((counts.success || 0) / completed * 100) : null,
    avgDuration: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
  };
}
export function runDayKey(startedAt: string) {
  const date = new Date(startedAt);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
    : "—";
}
