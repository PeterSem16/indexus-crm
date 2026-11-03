import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyFunnelConfig, suggestFunnelConfig } from "../../shared/mission-funnel";
import { standaloneCooperationItemIds } from "../../shared/mission-cooperation-policy";
import { computeMissionFunnel, type FunnelInput } from "./mission-funnel";
import { standaloneCooperationCopy } from "../../client/src/components/campaigns/mission-material-package-copy";
import { missionFunnelHelpTranslations } from "../../client/src/components/campaigns/mission-funnel-help-translations";

const day = (n: number) => `2026-10-${String(n).padStart(2, "0")}T09:00:00.000Z`;
function fixture(): FunnelInput {
  const items = [
    ["yes", "MPN-05c"], ["not-needed", "MPN-06a"], ["not-offered", "MPN-06b"],
    ["considering", "MPN-06c"], ["accepted", "MPN-06d"], ["unaccepted", "MPN-06e"],
    ["validated", "MPN-12e"], ["sent-package", "MPN-13d"],
  ].map(([id, stepId]) => ({ id, stepId, label: stepId, parentId: null }));
  return {
    items, config: suggestFunnelConfig(items),
    clinics: [{ id: "clinic", name: "Clinic", representativeId: null, referred: false }],
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
const rows = (input: FunnelInput, filters = {}) => computeMissionFunnel(input, filters).rows;
const cooperation = (input: FunnelInput, filters = {}) => rows(input, filters).find(r => r.key === "cooperating")!;

test("only the exact, uniquely identified and mapped choice is standalone evidence", () => {
  assert.deepEqual(standaloneCooperationItemIds(fixture().items, ["not-needed"]), ["not-needed"]);
  assert.deepEqual(standaloneCooperationItemIds(fixture().items, ["considering"]), []);
  assert.deepEqual(standaloneCooperationItemIds([
    ...fixture().items, { id: "duplicate", stepId: "MPN-06a" },
  ], ["not-needed"]), []);
  assert.deepEqual(standaloneCooperationItemIds([{ id: "wrong", stepId: "MPN-06e" }], ["wrong"]), []);
});
test("not necessary alone proves cooperation with its true author/date, not consent", () => {
  const input = fixture();
  confirm(input, "not-needed", 2, true, "enrollment", "original-agent");
  const before = JSON.stringify(input);
  const result = cooperation(input);
  assert.equal(result.total, 1);
  assert.equal(result.direct, 1);
  assert.equal(result.members[0].firstDate, day(2));
  assert.equal(result.members[0].actorId, "original-agent");
  assert.equal(result.members[0].inferred, false);
  assert.equal(rows(input).find(r => r.key === "agreed")!.total, 0);
  assert.equal(rows(input).find(r => r.key === "withoutContract")!.total, 0);
  assert.equal(JSON.stringify(input), before);
});
test("unaccepted, considering and not-offered never become standalone cooperation", () => {
  for (const itemId of ["unaccepted", "considering", "not-offered"]) {
    const input = fixture(); confirm(input, itemId);
    assert.equal(cooperation(input).total, 0, itemId);
  }
  const input = fixture(); confirm(input, "unaccepted"); confirm(input, "yes", 3);
  assert.equal(cooperation(input).total, 1);
  assert.equal(cooperation(input).members[0].firstDate, day(3));
});
test("stored-state-only evidence has no fabricated history, date or author", () => {
  const input = fixture();
  input.states = [{ contactId: "enrollment", itemId: "not-needed", at: day(2) }];
  const result = cooperation(input);
  assert.equal(result.total, 1);
  assert.equal(result.members[0].firstDate, null);
  assert.equal(result.members[0].actorId, null);
  assert.equal(result.members[0].basis, "state");
  assert.equal(input.events.length, 0);
});
test("historical standalone attainment survives later withdrawal and follows cohort periods", () => {
  const input = fixture();
  confirm(input, "not-needed", 2); confirm(input, "not-needed", 3, false);
  assert.equal(cooperation(input).total, 1);
  assert.equal(cooperation(input).members[0].firstDate, day(2));
  assert.equal(cooperation(input, { from: "2026-10-03" }).total, 0);
});
test("a clinic is counted once across enrollments and across independent cooperation proofs", () => {
  const input = fixture();
  input.enrollments.push({ id: "another", clinicId: "clinic" });
  confirm(input, "not-needed", 2);
  for (const item of ["yes", "accepted", "validated"]) confirm(input, item, 3, true, "another");
  assert.equal(cooperation(input).total, 1);
  assert.equal(cooperation(input).members[0].firstDate, day(2));
});
test("all other rows, including material eligibility and rates, stay unchanged", () => {
  const input = fixture();
  confirm(input, "not-needed", 2);
  input.config!.materials = {
    packageSent: ["sent-package"], excluded: { materials17: [], materials18: [], materials19: [] },
  };
  confirm(input, "sent-package", 3);
  const legacy = structuredClone(input);
  legacy.items = legacy.items.map(item => item.id === "not-needed" ? { ...item, stepId: "OTHER-CODE" } : item);
  const onlyOtherRows = (value: FunnelInput) => rows(value).filter(r => r.key !== "cooperating");
  assert.deepEqual(onlyOtherRows(input), onlyOtherRows(legacy));
  assert.equal(rows(input).find(r => r.key === "materials")!.total, 0);
  for (const item of ["yes", "accepted", "validated"]) confirm(input, item, 4);
  assert.equal(rows(input).find(r => r.key === "materials")!.total, 1);
});
test("removing a mapped source disables standalone credit without rewriting saved config", () => {
  const input = fixture(); confirm(input, "not-needed");
  input.config!.sources.proposalOther = ["considering"];
  assert.equal(cooperation(input).total, 0);
  const config = emptyFunnelConfig();
  config.sources.proposalOther = ["not-needed"];
  input.config = config;
  assert.equal(cooperation(input).total, 1);
  assert.equal(rows(input).find(r => r.key === "materials")!.total, null);
});
test("all seven locales explain the standalone exception only for cooperation", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    const copy = standaloneCooperationCopy[locale];
    assert.match(copy, /MPN-06a/);
    assert.ok(missionFunnelHelpTranslations[locale].stages.cooperating.includes(copy));
    assert.ok(missionFunnelHelpTranslations[locale].content.combined.includes(copy));
    assert.ok(!missionFunnelHelpTranslations[locale].stages.materials.includes(copy));
  }
});
