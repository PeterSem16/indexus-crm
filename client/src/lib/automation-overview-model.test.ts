import assert from "node:assert/strict";
import { matchesRuleState, ruleCountries, ruleHasErrors, ruleNeedsReview,
  runDayKey, runDurationMs, runStatistics, type OverviewRule, type OverviewRun } from "./automation-overview-model";
import { automationOverviewTranslations } from "../i18n/automation-overview-translations";

const rule: OverviewRule = {
  id: "r", name: "Test", description: null, module: "task", countryCode: "SK",
  enabled: true, isSystem: false, trigger: {}, conditions: null, actions: [],
  rateLimitPerHour: null, updatedAt: "2026-10-14T09:00:00Z",
};
assert.deepEqual(ruleCountries({ ...rule, countryCodes: ["HU", "CZ"] }), ["HU", "CZ"]);
assert.deepEqual(ruleCountries({ ...rule, countryCodes: [] }), ["SK"]);
assert.deepEqual(ruleCountries({ ...rule, countryCode: null }), []);
assert.equal(ruleNeedsReview({ ...rule, trigger: { legacySource: { kind: "metric" } } }), true);
assert.equal(ruleNeedsReview({ ...rule, trigger: { legacySource: { reviewActivatedAt: "2026-10-14" } } }), false);
assert.equal(ruleHasErrors({ ...rule, consecutiveErrorCount: 2 }), true);
assert.equal(ruleHasErrors({ ...rule, consecutiveErrorCount: 0, disabledReason: "disabled" }), true);
assert.equal(matchesRuleState(rule, "active"), true);
assert.equal(matchesRuleState(rule, "paused"), false);
assert.equal(matchesRuleState({ ...rule, enabled: false, disabledReason: "disabled" }, "attention"), true);
assert.equal(matchesRuleState({ ...rule, enabled: false, disabledReason: "disabled" }, "paused"), true);

const run: OverviewRun = { id: "x", ruleId: "r", status: "success", startedAt: "2026-10-14T00:00:00Z",
  finishedAt: "2026-10-14T00:00:00.100Z", error: null, skippedReason: null };
assert.equal(runDurationMs(run), 100);
assert.equal(runDurationMs({ ...run, finishedAt: null }), null);
assert.equal(runDurationMs({ ...run, finishedAt: "invalid" }), null);
assert.equal(runDurationMs({ ...run, finishedAt: "2026-10-13T23:59:59Z" }), null);
assert.equal(runDayKey("2026-10-13T22:15:00Z"), "2026-10-14");
assert.equal(runDayKey("2026-01-13T23:15:00Z"), "2026-01-14");
assert.equal(runDayKey("invalid"), "—");
const stats = runStatistics([run, { ...run, id: "f", status: "failed" }, { ...run, id: "s", status: "skipped" },
  { ...run, id: "p", status: "pending", finishedAt: null }]);
assert.equal(stats.total, 4);
assert.equal(stats.successRate, 50); // Skipped and unfinished runs are not unsuccessful executions.
assert.equal(stats.avgDuration, 100);
assert.equal(stats.counts.pending, 1);
assert.equal(runStatistics([]).successRate, null);
assert.equal(runStatistics([]).avgDuration, null);
assert.equal(runStatistics([{ ...run, status: "running", finishedAt: null }]).avgDuration, null);
const keys = Object.keys(automationOverviewTranslations.en);
assert.equal(Object.keys(automationOverviewTranslations).length, 7);
for (const copy of Object.values(automationOverviewTranslations)) {
  assert.deepEqual(Object.keys(copy), keys);
  for (const value of Object.values(copy)) assert.ok(typeof value === "string" && value.trim());
  assert.ok(copy.confirmDelete.includes("{name}"));
  assert.ok(copy.errors.includes("{count}"));
}
console.log("Automation overview: scope, review/error states, run statistics, Bratislava dates and all seven locales passed.");
