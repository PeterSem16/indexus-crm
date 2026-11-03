import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestFunnelConfig, type MissionFunnelReport } from "../../shared/mission-funnel";
import { computeMissionFunnel, type FunnelInput } from "./mission-funnel";
import { computeMissionAgentFunnel } from "./mission-agent-funnel";
import { missionEmailFunnel } from "./mission-email-content";
import { missionFunnelTranslations } from "../../client/src/i18n/mission-funnel-translations";

const date = (n: number) => `2026-10-${String(n).padStart(2, "0")}T09:00:00.000Z`;
function fixture(): FunnelInput {
  const codes = ["MPN-04b","MPN-05c","MPN-06a","MPN-06d","MPN-06e","MPN-12e",
    "MPN-13d","MPN-14d","MPN-15d","MPN-13e","MPN-14e","MPN-15e"];
  const items = codes.map(id => ({ id, stepId: id, label: id, parentId: null }));
  const config = suggestFunnelConfig(items);
  config.materials!.packageSent = ["MPN-13d"];
  return { items, config, clinics: [{ id: "c", name: "Clinic", representativeId: null, referred: false }],
    enrollments: [{ id: "e", clinicId: "c" }], events: [], states: [],
    calls: [{ id: "call", clinicId: "c", contactId: "e", direction: "outbound", status: "completed",
      at: date(1), answeredAt: date(1), duration: 10, actorId: "a" }] };
}
function confirm(input: FunnelInput, itemId: string, day: number, confirmed = true, contactId = "e") {
  input.events.push({ id: String(input.events.length), contactId, itemId, confirmed, at: date(day), actorId: "a" });
  input.states = input.states.filter(s => s.contactId !== contactId || s.itemId !== itemId);
  if (confirmed) input.states.push({ contactId, itemId, at: date(day) });
}
const report = (input: FunnelInput, filters = {}) => computeMissionFunnel(input, filters);
const row = (input: FunnelInput, key: "packageSent" | "materials" | "cooperating", filters = {}) =>
  report(input, filters).rows.find(r => r.key === key)!;

test("package without consent or validation is independent, dated and attributed", () => {
  const input = fixture(); confirm(input,"MPN-13d",2);
  const before = JSON.stringify(input), sent = row(input,"packageSent");
  assert.equal(sent.total,1); assert.equal(sent.direct,1); assert.equal(sent.inferred,0);
  assert.equal(sent.previousPercent,null);
  assert.equal(sent.members[0].firstDate,date(2)); assert.equal(sent.members[0].actorId,"a");
  assert.equal(row(input,"materials").total,0); assert.equal(row(input,"cooperating").total,0);
  assert.equal(JSON.stringify(input),before);
});
test("approved audited four-clinic pattern becomes four shipped and zero combined", () => {
  const input = fixture();
  input.clinics = []; input.enrollments = []; input.calls = [];
  for (let i = 0; i < 4; i++) {
    const id = "c"+i, contactId="e"+i;
    input.clinics.push({id,name:id,representativeId:null,referred:false});
    input.enrollments.push({id:contactId,clinicId:id});
    input.calls.push({id:"call"+i,clinicId:id,contactId,direction:"outbound",status:"completed",
      at:date(1),answeredAt:date(1),duration:10});
    for (const code of ["MPN-06d","MPN-13d",i===1?"MPN-05c":"MPN-12e"]) confirm(input,code,2,true,contactId);
  }
  assert.equal(row(input,"packageSent").total,4); assert.equal(row(input,"materials").total,0);
  assert.equal(row(input,"cooperating").total,0);
});
test("combined rule and dates stay unchanged when cooperation follows shipping", () => {
  const input=fixture();confirm(input,"MPN-13d",2);
  for (const code of ["MPN-05c","MPN-06d","MPN-12e"]) confirm(input,code,4);
  assert.equal(row(input,"packageSent").members[0].firstDate,date(2));
  assert.equal(row(input,"materials").members[0].firstDate,date(4));
  assert.equal(row(input,"materials").previousPercent,100);
});
test("MPN-06a alone still does not broaden the combined materials prerequisite", () => {
  const input=fixture();confirm(input,"MPN-06a",2);confirm(input,"MPN-13d",3);
  assert.equal(row(input,"cooperating").total,1);
  assert.equal(row(input,"packageSent").total,1);assert.equal(row(input,"materials").total,0);
});
test("state-only shipping never invents a date or author", () => {
  const input=fixture();input.states=[{contactId:"e",itemId:"MPN-13d",at:date(2)}];
  const sent=row(input,"packageSent");
  assert.equal(sent.total,1);assert.equal(sent.members[0].firstDate,null);
  assert.equal(sent.members[0].actorId,null);assert.equal(sent.members[0].basis,"state");
});
test("historical shipment remains after withdrawal and obeys first-call cohort", () => {
  const input=fixture();confirm(input,"MPN-13d",2);confirm(input,"MPN-13d",3,false);
  assert.equal(row(input,"packageSent").total,1);
  assert.equal(row(input,"packageSent",{from:"2026-10-02",to:"2026-10-31"}).total,0);
});
test("component exclusions are not fabricated sending and all-declined sends nothing", () => {
  const input=fixture();input.config!.materials!.packageSent=[];
  for (const code of ["MPN-13e","MPN-14e","MPN-15e"]) confirm(input,code,2);
  assert.equal(row(input,"packageSent").total,0);
  confirm(input,"MPN-13e",3,false);confirm(input,"MPN-13d",3);
  assert.equal(row(input,"packageSent").total,1);
});
test("unmapped shipping is unknown, not measured zero", () => {
  const input=fixture();delete input.config!.materials;
  input.config!.sources.materials18=[];input.config!.sources.materials19=[];
  assert.equal(row(input,"packageSent").total,null);
});
test("duplicate enrollments count once, but component evidence cannot cross enrollments", () => {
  const input=fixture();input.enrollments.push({id:"e2",clinicId:"c"});
  confirm(input,"MPN-13d",2);confirm(input,"MPN-13d",3,true,"e2");
  assert.equal(row(input,"packageSent").total,1);
  input.config!.materials!.packageSent=[];
  confirm(input,"MPN-14d",3);confirm(input,"MPN-15d",3,true,"e2");
  assert.equal(row(input,"packageSent").total,0);
});
test("agent cohort and contribution views include independent shipping without changing cooperation", () => {
  const input=fixture();confirm(input,"MPN-13d",2);
  const rows=report(input).rows;
  const agents=computeMissionAgentFunnel(rows,[{id:"a",name:"Agent"}]);
  for (const mode of ["cohort","contribution"] as const) {
    assert.equal(agents[mode][0].rows.find(r=>r.key==="packageSent")!.total,1);
    assert.equal(agents[mode][0].rows.find(r=>r.key==="materials")!.total,0);
  }
});
test("email period includes both outcomes in every locale without inheriting the first-call cohort", () => {
  const input=fixture();input.calls=[];confirm(input,"MPN-13d",2);
  assert.equal(row(input,"packageSent").total,0);
  const projected: MissionFunnelReport={...computeMissionFunnel(input,{},new Date(),{allMilestones:true}),
    missionName:"Mission",canConfigure:false};
  for (const locale of ["en","sk","cs","hu","ro","it","de"] as const) {
    const rows=missionEmailFunnel(projected,
      {frequency:"daily",weekday:1,monthDay:1,country:"SK",locale},new Date("2026-10-03T10:00:00Z"));
    const labels=missionFunnelTranslations[locale].stepLabels;
    assert.deepEqual(rows.find(r=>r[0]===labels.packageSent),[labels.packageSent,1,0]);
    assert.deepEqual(rows.find(r=>r[0]===labels.materials),[labels.materials,0,0]);
  }
});
test("period summaries retain unknown shipment dates separately instead of backdating them", () => {
  const input=fixture();input.states=[{contactId:"e",itemId:"MPN-13d",at:date(2)}];
  const projected: MissionFunnelReport={...computeMissionFunnel(input,{},new Date(),{allMilestones:true}),
    missionName:"Mission",canConfigure:false};
  const rows=missionEmailFunnel(projected,
    {frequency:"daily",weekday:1,monthDay:1,country:"SK",locale:"sk"},new Date("2026-10-03T10:00:00Z"));
  assert.deepEqual(rows.find(r=>r[0]===missionFunnelTranslations.sk.stepLabels.packageSent),
    [missionFunnelTranslations.sk.stepLabels.packageSent,0,1]);
});
