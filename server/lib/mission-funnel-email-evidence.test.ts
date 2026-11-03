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
  input.config!.emailPurposes = [];
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
  assert.deepEqual(calls[0].params, ["mission", ["contact"], ["proposal-sent"], []]);
  assert.equal(result[0].at, "2026-09-02T08:00:00.000Z");
  assert.match(calls[0].sql, /e\.status='succeeded'/);
  assert.doesNotMatch(calls[0].sql, /subject|ILIKE|notify_email/);
});
test("typed proofs can measure email without a legacy checkbox but never a postal shipment", async () => {
  const input = fixture();
  input.config!.sources.email = [];
  input.config!.emailPurposes = ["cooperation_proposal"];
  input.emailEvidence = [{ id: "typed:one", contactId: "contact", at: "2026-09-02T08:00:00Z", actorId: "agent" }];
  const report = computeMissionFunnel(input);
  assert.equal(report.rows.find(r => r.key === "email")!.direct, 1);
  assert.equal(report.rows.find(r => r.key === "sent")!.members.length, 0);
  let params: unknown[] = [];
  await loadFunnelEmailEvidence({ query: async (_sql, values) => {
    params = values!; return { rows: [] };
  } }, "mission", ["contact"], [], ["cooperation_proposal"]);
  assert.deepEqual(params, ["mission", ["contact"], [], ["cooperation_proposal"]]);
});
test("reviewed recorded time never becomes a sending date or a dated attainment", () => {
  const input=fixture();
  input.emailEvidence=[{id:"review",contactId:"contact",at:null,recordedAt:"2026-09-23T10:05:03Z",actorId:"sender"}];
  const row=computeMissionFunnel(input).rows.find(row=>row.key==="email")!;
  assert.equal(row.total,1);assert.equal(row.direct,1);assert.equal(row.inferred,0);
  assert.equal(row.members[0].firstDate,null);
  assert.equal(row.members[0].evidenceDate,"2026-09-23T10:05:03Z");
  assert.equal(row.members[0].timestampKind,"recorded");
  assert.equal(row.members[0].actorId,"sender");
  assert.deepEqual(input.events,[]);assert.deepEqual(input.states,[]);
});
test("a reviewed unknown date replaces inferred email evidence without borrowing its later timestamp", () => {
  const input=fixture();
  input.config!.sources.agreed=["agreed"];input.config!.sources.proposalAccepted=["accepted"];
  input.config!.sources.sent=["sent"];
  input.events=["agreed","accepted","sent"].map((itemId,i)=>({
    id:String(i),contactId:"contact",itemId,confirmed:true,at:"2026-10-05T08:00:00Z",
  }));
  input.emailEvidence=[{id:"review",contactId:"contact",at:null,recordedAt:"2026-09-23T10:05:03Z"}];
  const member=computeMissionFunnel(input).rows.find(row=>row.key==="email")!.members[0];
  assert.equal(member.inferred,false);assert.equal(member.firstDate,null);
  assert.equal(member.timestampKind,"recorded");
});
test("loader keeps a null sending time and explicitly preserves the separate record date",async()=>{
  const result=await loadFunnelEmailEvidence({query:async()=>({rows:[{
    id:"review:x",contactId:"contact",at:null,recordedAt:new Date("2026-09-23T10:05:03Z"),
  }]})},"mission",["contact"],["proposal-sent"]);
  assert.equal(result[0].at,null);assert.equal(result[0].recordedAt,"2026-09-23T10:05:03.000Z");
});
