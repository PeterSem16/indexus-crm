import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMissionFunnel, type FunnelInput } from "./mission-funnel";
import { emptyFunnelConfig } from "../../shared/mission-funnel";
import { loadFunnelEmailEvidence } from "./mission-funnel-email-evidence";
function fixture(): FunnelInput {
  const config = emptyFunnelConfig(); config.sources.email = ["proposal-sent"];
  return {
    config, clinics: [{ id: "clinic", name: "Clinic", representativeId: "coordinator", referred: false }],
    enrollments: [{ id: "contact", clinicId: "clinic" }], states: [], events: [],
    items: [{ id: "proposal-sent", stepId: "MPN-07b", label: "Proposal sent", parentId: null }],
    calls: [{ id: "call", clinicId: "clinic", contactId: "contact", direction: "outbound", status: "completed",
      at: "2026-09-01T08:00:00Z", answeredAt: "2026-09-01T08:00:03Z", duration: 20 }],
  };
}
test("an accepted configured proposal email counts without fabricating a status-list confirmation", () => {
  const input = fixture();
  input.emailEvidence = [
    { id: "later", contactId: "contact", at: "2026-09-03T08:00:00Z", actorId: "agent" },
    { id: "first", contactId: "contact", at: "2026-09-02T08:00:00Z", actorId: "agent" },
    { id: "foreign", contactId: "other-contact", at: "2026-09-01T08:00:00Z", actorId: "other-agent" },
  ];
  const report = computeMissionFunnel(input);
  const row = report.rows.find(row => row.key === "email")!;
  assert.equal(row.total, 1);
  assert.equal(row.members[0].firstDate, "2026-09-02T08:00:00Z");
  assert.equal(row.members[0].inferred, false);
  assert.equal(row.members[0].actorId, "agent");
  assert.deepEqual(input.states, []);
  assert.deepEqual(input.events, []);
});
test("email evidence respects reporting periods and disabled source mapping", () => {
  const input = fixture();
  input.emailEvidence = [{ id: "proof", contactId: "contact", at: "2026-09-03T08:00:00Z", actorId: "agent" }];
  assert.equal(computeMissionFunnel(input, { from: "2026-09-04" }).rows.find(r => r.key === "email")!.total, 0);
  input.config!.sources.email = [];
  assert.equal(computeMissionFunnel(input).rows.find(r => r.key === "email")!.total, null);
});
test("email loader skips unnecessary work and uses bounded Mission/contact/configured-source identities", async () => {
  const calls: any[] = [];
  const db = { query: async (sql: string, params: any[]) => {
    calls.push({ sql, params });
    return { rows: [{ id: "service:one", contactId: "contact", actorId: "agent", at: new Date("2026-09-02T08:00:00Z") }] };
  } };
  assert.deepEqual(await loadFunnelEmailEvidence(db, "mission", ["contact"], []), []);
  assert.equal(calls.length, 0);
  const result = await loadFunnelEmailEvidence(db, "mission", ["contact"], ["proposal-sent"]);
  assert.deepEqual(calls[0].params, ["mission", ["contact"], ["proposal-sent"]]);
  assert.equal(result[0].at, "2026-09-02T08:00:00.000Z");
  assert.match(calls[0].sql, /e\.status='succeeded'/);
  assert.doesNotMatch(calls[0].sql, /subject|ILIKE|notify_email/);
});
