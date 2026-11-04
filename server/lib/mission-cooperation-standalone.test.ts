import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyFunnelConfig, suggestFunnelConfig } from "../../shared/mission-funnel";
import { computeMissionFunnel, type FunnelInput } from "./mission-funnel";
import { cooperationRuleCopy, standaloneCooperationCopy, wantsToSignRuleCopy } from "../../client/src/components/campaigns/mission-material-package-copy";
import { missionFunnelHelpTranslations } from "../../client/src/components/campaigns/mission-funnel-help-translations";

const day = (n: number) => `2026-10-${String(n).padStart(2, "0")}T09:00:00.000Z`;
function fixture(): FunnelInput {
  const items = ["MPN-04b", "MPN-05b", "MPN-05c", "MPN-05d", "MPN-06a", "MPN-06b",
    "MPN-06c", "MPN-06d", "MPN-06e", "MPN-12e", "MPN-13d"]
    .map(stepId => ({ id: stepId, stepId, label: stepId, parentId: null }));
  const config = suggestFunnelConfig(items);
  config.materials = { packageSent: ["MPN-13d"], excluded: { materials17: [], materials18: [], materials19: [] } };
  return {
    items, config, clinics: [{ id: "clinic", name: "Clinic", representativeId: null, referred: false }],
    enrollments: [{ id: "enrollment", clinicId: "clinic" }], states: [], events: [],
    calls: [{ id: "call", clinicId: "clinic", contactId: "enrollment",
      direction: "outbound", status: "completed", at: day(1), answeredAt: day(1), duration: 20 }],
  };
}
function confirm(input: FunnelInput, itemId: string, date = 2, confirmed = true, contactId = "enrollment", actorId = "agent") {
  input.events.push({ id: String(input.events.length), contactId, itemId, at: day(date), confirmed, actorId });
  input.states = input.states.filter(s => !(s.contactId === contactId && s.itemId === itemId));
  if (confirmed) input.states.push({ contactId, itemId, at: day(date) });
}
const row = (input: FunnelInput, key: string, filters = {}) =>
  computeMissionFunnel(input, filters).rows.find(r => r.key === key)!;

test("MPN-06a alone, including explicit refusal, no longer proves cooperation", () => {
  for (const choice of [null, "MPN-05b", "MPN-05c", "MPN-05d"]) {
    const input = fixture();
    confirm(input, "MPN-06a");
    if (choice) confirm(input, choice);
    confirm(input, "MPN-13d", 3);
    assert.equal(row(input, "cooperating").total, 0, String(choice));
    assert.equal(row(input, "materials").total, 0);
    assert.equal(row(input, "packageSent").total, 1);
  }
});
test("validated contract alone preserves its real date/author without manufacturing agreement", () => {
  const input = fixture();
  confirm(input, "MPN-12e", 2, true, "enrollment", "validator");
  const before = JSON.stringify(input);
  const result = row(input, "cooperating");
  assert.equal(result.total, 1);
  assert.equal(result.members[0].firstDate, day(2));
  assert.equal(result.members[0].actorId, "validator");
  assert.equal(result.members[0].inferred, false);
  assert.equal(row(input, "agreed").total, 0);
  assert.equal(JSON.stringify(input), before);
});
test("state-only validation stays undated and unassigned to a guessed author", () => {
  const input = fixture();
  input.states = [{ contactId: "enrollment", itemId: "MPN-12e", at: day(2) }];
  const member = row(input, "cooperating").members[0];
  assert.equal(member.firstDate, null);
  assert.equal(member.actorId, null);
  assert.equal(member.basis, "state");
});
test("DAHOL pattern: accepted proposal counts even while cooperation is considering", () => {
  const input = fixture();
  confirm(input, "MPN-05b", 2);
  confirm(input, "MPN-06d", 3, true, "enrollment", "acceptance-agent");
  const before = JSON.stringify(input);
  const result = row(input, "wantsToSign");
  assert.equal(result.total, 1);
  assert.equal(result.members[0].firstDate, day(3));
  assert.equal(result.members[0].actorId, "acceptance-agent");
  assert.equal(result.direct, 1);
  assert.equal(row(input, "agreed").total, 0);
  assert.equal(row(input, "cooperating").total, 0);
  assert.equal(JSON.stringify(input), before);
});
test("no-contract branch requires simultaneous agreement and refusal in one enrollment", () => {
  const input = fixture();
  confirm(input, "MPN-05c", 2); confirm(input, "MPN-05c", 3, false);
  confirm(input, "MPN-06e", 4);
  input.enrollments.push({ id: "other", clinicId: "clinic" });
  confirm(input, "MPN-05c", 4, true, "other");
  assert.equal(row(input, "cooperating").total, 0);
  confirm(input, "MPN-05c", 5);
  assert.equal(row(input, "cooperating").members[0].firstDate, day(5));
});
test("package before/after validation counts once at first proven joint attainment", () => {
  for (const [packageDay, validationDay] of [[2, 3], [3, 2]]) {
    const input = fixture();
    confirm(input, "MPN-13d", packageDay); confirm(input, "MPN-12e", validationDay);
    assert.equal(row(input, "materials").total, 1);
    assert.equal(row(input, "materials").members[0].firstDate, day(3));
    assert.equal(row(input, "materials").previousPercent, 100);
  }
});
test("cooperation and package from separate enrollments never form a false combined result", () => {
  const input = fixture();
  input.enrollments.push({ id: "other", clinicId: "clinic" });
  confirm(input, "MPN-12e", 2); confirm(input, "MPN-13d", 3, true, "other");
  assert.equal(row(input, "cooperating").total, 1);
  assert.equal(row(input, "packageSent").total, 1);
  assert.equal(row(input, "materials").total, 0);
});
test("historical validation survives withdrawal and respects cohort periods", () => {
  const input = fixture();
  confirm(input, "MPN-12e", 2); confirm(input, "MPN-12e", 3, false);
  assert.equal(row(input, "cooperating").members[0].firstDate, day(2));
  assert.equal(row(input, "cooperating", { from: "2026-10-03" }).total, 0);
});
test("measurability follows the actual independent evidence rather than retired standalone sources", () => {
  const input = fixture();
  input.config = emptyFunnelConfig();
  input.config.sources.proposalOther = ["MPN-06a"];
  confirm(input, "MPN-06a");
  assert.equal(row(input, "cooperating").total, null);
  input.config.sources.validated = ["MPN-12e"];
  assert.equal(row(input, "cooperating").total, 0);
  input.config.sources.proposalAccepted = ["MPN-06d"];
  assert.equal(row(input, "wantsToSign").total, 0);
});
test("seven locales show the corrected cooperation and signing rules", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    const help = missionFunnelHelpTranslations[locale];
    assert.match(standaloneCooperationCopy[locale], /MPN-06a/);
    assert.ok(help.stages.cooperating.includes(standaloneCooperationCopy[locale]));
    assert.ok(help.stages.cooperating.includes(cooperationRuleCopy[locale].contract));
    assert.equal(help.stages.wantsToSign, wantsToSignRuleCopy[locale]);
  }
});

// Minimal anonymous current-state patterns from the read-only production
// diagnostic. These are not call-cohort evidence and contain no production IDs.
test("reviewed production status patterns: six cooperating, four packages, three combined, DAHOL included", () => {
  const patterns = [
    ["MPN-05b", "MPN-06d"], // DAHOL pattern
    ["MPN-05c", "MPN-06d", "MPN-12e"],
    ...Array.from({ length: 3 }, () => ["MPN-05b", "MPN-06d", "MPN-12e", "MPN-13d"]),
    ...Array.from({ length: 2 }, () => ["MPN-05c", "MPN-06d", "MPN-12e"]),
    ...Array.from({ length: 4 }, () => ["MPN-05c", "MPN-06c"]),
    ...Array.from({ length: 4 }, () => ["MPN-05c", "MPN-06d"]),
    ["MPN-05c", "MPN-06d", "MPN-13d"],
    ...Array.from({ length: 4 }, () => ["MPN-05d", "MPN-06a"]),
    ["MPN-05b", "MPN-06a"],
  ];
  const input = fixture();
  input.clinics = patterns.map((_, n) => ({ id: String(n), name: `Clinic ${n}`, representativeId: null, referred: false }));
  input.enrollments = patterns.map((_, n) => ({ id: `e${n}`, clinicId: String(n) }));
  input.calls = [];
  input.states = patterns.flatMap((codes, n) => codes.map(itemId => ({ contactId: `e${n}`, itemId, at: day(2) })));
  const before = JSON.stringify(input);
  const report = computeMissionFunnel(input, {}, new Date(day(4)), { allMilestones: true });
  const get = (key: string) => report.rows.find(r => r.key === key)!;
  assert.equal(patterns.length, 21);
  assert.equal(get("cooperating").total, 6);
  assert.equal(get("packageSent").total, 4);
  assert.equal(get("materials").total, 3);
  assert.equal(get("wantsToSign").total, 12);
  assert.ok(get("wantsToSign").members.some(m => m.id === "0"));
  assert.equal(get("materials").previousPercent, 50);
  assert.equal(get("cooperating").total, get("validated").total! + get("withoutContract").total!);
  assert.equal(JSON.stringify(input), before);
});
