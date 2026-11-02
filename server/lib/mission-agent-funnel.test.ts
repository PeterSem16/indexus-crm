import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyFunnelConfig, funnelSources, type AgentFunnelResult, type FunnelStep } from "../../shared/mission-funnel";
import { computeMissionFunnel, type FunnelCall, type FunnelEvent, type FunnelInput } from "./mission-funnel";
import { computeMissionAgentFunnel } from "./mission-agent-funnel";

const time = (day: number) => `2026-09-${String(day).padStart(2, "0")}T10:00:00.000Z`;
const agents = ["a", "b", "c", "zero"].map(id => ({ id, name: `Agent ${id}` }));
const event = (itemId: string, day: number, actorId: string | null, contactId = "enroll", confirmed = true): FunnelEvent =>
  ({ id: `${contactId}-${itemId}-${day}-${actorId}-${confirmed}`, contactId, itemId, confirmed, at: time(day), actorId });
function call(id: string, actorId: string | null, clinicId = "clinic", day = 1): FunnelCall {
  return { id, actorId, clinicId, contactId: "enroll", direction: "outbound", status: "completed",
    at: time(day), attemptAt: time(day), answeredAt: time(day), duration: 60 };
}
function input(): FunnelInput {
  const config = emptyFunnelConfig();
  for (const key of funnelSources) config.sources[key] = [key];
  return {
    config, items: [], clinics: [{ id: "clinic", name: "Clinic", referred: true, representativeId: "representative" }],
    enrollments: [{ id: "enroll", clinicId: "clinic" }], calls: [call("first", "a")], states: [],
    events: [event("agreed", 2, "a"), event("proposalAccepted", 3, "b"), event("validated", 4, "c"),
      event("materials17", 5, "a"), event("materials18", 6, "b"), event("materials19", 7, "c")],
  };
}
const metric = (groups: AgentFunnelResult[], agent: string | null, step: FunnelStep) =>
  groups.find(group => group.agentId === agent)?.rows.find(row => row.key === step);

test("cohort ownership partitions the same outcomes by earliest outbound caller, not representative or closer", () => {
  const data = input();
  const report = computeMissionFunnel(data, { from: "2026-09-01", to: "2026-09-01" });
  const result = computeMissionAgentFunnel(report.rows, agents);
  assert.equal(metric(result.cohort, "a", "dialed")?.total, 1);
  assert.equal(metric(result.cohort, "a", "cooperating")?.total, 1);
  assert.equal(metric(result.cohort, "a", "materials")?.total, 1);
  assert.equal(metric(result.cohort, "a", "materials")?.previousPercent, 100);
  assert.equal(metric(result.cohort, "c", "cooperating")?.total, 0);
  assert.equal(result.cohort.some(group => group.agentId === "representative"), false);
  assert.equal(metric(result.cohort, "a", "assigned")?.total, null);
});

test("contribution credits the dated transition author after evaluating cross-agent AND evidence", () => {
  const report = computeMissionFunnel(input());
  const result = computeMissionAgentFunnel(report.rows, agents);
  for (const [step, actor] of [["dialed", "a"], ["connected", "a"], ["agreed", "a"],
    ["wantsContract", "b"], ["validated", "c"], ["cooperating", "c"], ["materials", "c"]] as const) {
    assert.equal(metric(result.contribution, actor, step)?.total, 1, step);
  }
  assert.equal(metric(result.contribution, "b", "cooperating")?.total, 0);
  assert.equal(metric(result.contribution, "c", "materials")?.missionPercent, 100);
  assert.equal(metric(result.contribution, "c", "materials")?.previousPercent, null);
  assert.equal(metric(result.contribution, "c", "materials")?.qualifiedPercent, null);
});

test("inferred predecessors are never credited to the later evidence author", () => {
  const report = computeMissionFunnel(input());
  const result = computeMissionAgentFunnel(report.rows, agents);
  assert.equal(metric(result.contribution, null, "qualified")?.inferred, 1);
  assert.equal(metric(result.contribution, null, "email")?.inferred, 1);
  assert.equal(metric(result.contribution, "c", "email")?.total, 0);
  assert.equal(metric(result.cohort, "a", "email")?.inferred, 1);
});

test("state-only confirmations have no invented dates or author", () => {
  const data = input();
  data.events = [];
  data.states = ["agreed", "proposalAccepted", "validated"].map(itemId => ({ contactId: "enroll", itemId, at: time(4) }));
  const report = computeMissionFunnel(data);
  const result = computeMissionAgentFunnel(report.rows, agents);
  const row = metric(result.contribution, null, "cooperating")!;
  assert.equal(row.total, 1);
  assert.equal(row.members[0].firstDate, null);
  assert.equal(row.members[0].actorId, null);
  assert.equal(metric(result.cohort, "a", "cooperating")?.total, 1);
});

test("simultaneous cross-author AND proofs are unknown while simple sources retain their own author", () => {
  const data = input();
  data.events = [event("agreed", 2, "a"), event("proposalAccepted", 2, "b"), event("validated", 2, "c")];
  const result = computeMissionAgentFunnel(computeMissionFunnel(data).rows, agents);
  assert.equal(metric(result.contribution, null, "cooperating")?.total, 1);
  assert.equal(metric(result.contribution, null, "wantsContract")?.total, 1);
  assert.equal(metric(result.contribution, "a", "agreed")?.total, 1);
  assert.equal(metric(result.contribution, "c", "validated")?.total, 1);
});

test("simultaneous first calls with conflicting identities do not pick an arbitrary cohort owner", () => {
  const data = input();
  data.calls.push(call("other", "b"));
  const result = computeMissionAgentFunnel(computeMissionFunnel(data).rows, agents);
  assert.equal(metric(result.cohort, null, "dialed")?.total, 1);
  assert.equal(metric(result.cohort, null, "materials")?.total, 1);
  assert.equal(metric(result.contribution, null, "connected")?.total, 1);
});

test("unknown and deleted authors are unassigned, not silently dropped or mapped to a current agent", () => {
  const data = input();
  data.calls[0].actorId = "deleted";
  data.events = [event("agreed", 2, null)];
  const result = computeMissionAgentFunnel(computeMissionFunnel(data).rows, agents);
  assert.equal(metric(result.cohort, null, "dialed")?.total, 1);
  assert.equal(metric(result.contribution, null, "agreed")?.total, 1);
  assert.equal(result.contribution.find(group => group.agentId === null)?.agentName, null);
});

test("equal earliest milestone across duplicate enrollments with conflicting actors is ambiguous", () => {
  const data = input();
  data.enrollments.push({ id: "duplicate", clinicId: "clinic" });
  data.events.push(event("agreed", 2, "b", "duplicate"));
  const report = computeMissionFunnel(data);
  assert.equal(report.rows.find(row => row.key === "agreed")?.total, 1);
  const result = computeMissionAgentFunnel(report.rows, agents);
  assert.equal(metric(result.contribution, null, "agreed")?.total, 1);
});

test("earlier original direct attainment keeps its author after undo/reconfirmation", () => {
  const data = input();
  data.events.push(event("agreed", 8, "b", "enroll", false), event("agreed", 9, "b"));
  const result = computeMissionAgentFunnel(computeMissionFunnel(data).rows, agents);
  assert.equal(metric(result.contribution, "a", "agreed")?.total, 1);
  assert.equal(metric(result.contribution, "b", "agreed")?.total, 0);
});

test("material author is the completing proof even after cooperation stops being active", () => {
  const data = input();
  data.events.push(event("agreed", 5, "b", "enroll", false));
  const result = computeMissionAgentFunnel(computeMissionFunnel(data).rows, agents);
  assert.equal(metric(result.contribution, "c", "materials")?.total, 1);
});

test("every measurable stage partitions exactly across known and unknown agents in both views", () => {
  const data = input();
  data.clinics.push({ id: "second", name: "Second", representativeId: null, referred: false });
  data.enrollments.push({ id: "second-enroll", clinicId: "second" });
  data.calls.push({ ...call("second", "b", "second"), contactId: "second-enroll" });
  data.events.push(event("qualified", 2, "b", "second-enroll"));
  const report = computeMissionFunnel(data);
  const result = computeMissionAgentFunnel(report.rows, agents);
  for (const mode of ["cohort", "contribution"] as const) for (const source of report.rows) {
    if (source.key === "assigned" || source.total === null) continue;
    const all = result[mode].flatMap(group => group.rows.find(row => row.key === source.key)!.members);
    assert.equal(all.length, source.total, `${mode}.${source.key}`);
    assert.equal(new Set(all.map(member => member.id)).size, source.total, `${mode}.${source.key}: no duplicate credit`);
    assert.equal(result[mode].reduce((sum, group) => sum + (metric([group], group.agentId, source.key)?.inferred ?? 0), 0), source.inferred);
  }
  assert.equal(result.cohort.reduce((sum, group) => sum + group.clinicCount, 0), 2);
  assert.equal(result.contribution.find(group => group.agentId === "c")?.clinicCount, 1);
});

test("period/referral and legacy-first-attempt semantics stay identical to the parent funnel", () => {
  const data = input();
  data.calls[0].attemptAt = null;
  assert.equal(metric(computeMissionAgentFunnel(computeMissionFunnel(data).rows, agents).cohort, "a", "dialed")?.total, 1);
  for (const filters of [{ from: "2026-09-02" }, { referral: "no" as const }]) {
    const result = computeMissionAgentFunnel(computeMissionFunnel(data, filters).rows, agents);
    assert.equal(result.cohort.reduce((sum, group) => sum + group.clinicCount, 0), 0);
    assert.equal(metric(result.cohort, "zero", "dialed")?.total, 0);
  }
});

test("missing mapping remains unmeasured and zero-activity agents remain zero, not missing", () => {
  const data = input();
  data.config = emptyFunnelConfig();
  const result = computeMissionAgentFunnel(computeMissionFunnel(data).rows, agents);
  assert.equal(metric(result.cohort, "zero", "dialed")?.total, 0);
  assert.equal(metric(result.cohort, "zero", "validated")?.total, null);
  assert.equal(metric(result.contribution, "zero", "validated")?.missionPercent, null);
});

test("comparison and attribution are read-only projections without mutating input rows", () => {
  const data = input(), before = JSON.stringify(data);
  const report = computeMissionFunnel(data), snapshot = JSON.stringify(report.rows);
  computeMissionAgentFunnel(report.rows, agents);
  assert.equal(JSON.stringify(data), before);
  assert.equal(JSON.stringify(report.rows), snapshot);
});
