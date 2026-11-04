import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMissionFunnel, type FunnelInput, type FunnelCall } from "./mission-funnel";
import { configurableFunnelSources, emptyFunnelConfig, suggestFunnelConfig, funnelConfigSchema, funnelSources } from "../../shared/mission-funnel";

const at = (day: string) => `${day}T10:00:00.000Z`;
function setup(): FunnelInput {
  const config = emptyFunnelConfig();
  for (const key of funnelSources) config.sources[key] = [key];
  return {
    clinics: [{ id: "a", name: "Clinic A", representativeId: "r", referred: true }],
    enrollments: [{ id: "c", clinicId: "a" }], config, items: [],
    events: [], states: [], calls: [call("1","2026-09-01")],
  };
}
function call(id: string, day: string, status = "no_answer"): FunnelCall {
  return { id, clinicId: "a", contactId: "c", direction: "outbound", status, at: at(day), answeredAt: null, duration: 0 };
}
function confirm(input: FunnelInput, item: string, day: string, confirmed = true, contactId = "c") {
  input.events.push({ id: String(input.events.length), contactId, itemId: item, at: at(day), confirmed });
  input.states = input.states.filter(s => s.contactId !== contactId || s.itemId !== item);
  if (confirmed) input.states.push({ contactId, itemId: item, at: at(day) });
}
function row(input: FunnelInput, key: string, filters = {}) {
  return computeMissionFunnel(input, filters).rows.find(r => r.key === key)!;
}
test("one clinic, repeated attempts and enrollments count once; first date is retained", () => {
  const input = setup();
  input.enrollments.push({ id: "duplicate", clinicId: "a" });
  input.calls.push(call("2","2026-09-03"));
  confirm(input,"qualified","2026-09-05"); confirm(input,"qualified","2026-09-09");
  assert.equal(row(input,"qualified").total,1);
  assert.equal(row(input,"qualified").members[0].firstDate,at("2026-09-05"));
  assert.equal(computeMissionFunnel(input).quality.duplicateEnrollments,1);
});
test("cohort filter is applied after first attempt across all history; assignment stays current", () => {
  const input = setup(); input.calls.push(call("2","2026-10-05"));
  confirm(input,"validated","2026-10-06");
  assert.equal(row(input,"validated",{from:"2026-10-01"}).total,0);
  assert.equal(row(input,"assigned",{from:"2026-10-01"}).total,1);
  assert.equal(row(input,"validated",{from:"2026-09-01",to:"2026-09-30"}).total,1);
});
test("null proposal is not proof of wants contract; exact unaccepted creates no-contract branch", () => {
  const input=setup(); confirm(input,"agreed","2026-09-02");
  assert.equal(row(input,"wantsContract").total,0);
  assert.equal(computeMissionFunnel(input).quality.unknownProposal,1);
  confirm(input,"proposalUnaccepted","2026-09-03");
  assert.equal(row(input,"withoutContract").total,1);
  assert.equal(row(input,"wantsContract").total,0);
});
test("AND requires concurrent choices on the same enrollment, not marginal matches", () => {
  const input=setup();
  confirm(input,"agreed","2026-09-02"); confirm(input,"agreed","2026-09-03",false);
  confirm(input,"proposalUnaccepted","2026-09-04");
  assert.equal(row(input,"withoutContract").total,0);
  input.enrollments.push({id:"other",clinicId:"a"});
  confirm(input,"agreed","2026-09-02",true,"other");
  assert.equal(row(input,"withoutContract").total,0);
});
test("inferred contract predecessors remain separate, with no fabricated date or no-contract pollution", () => {
  const input=setup(); confirm(input,"agreed","2026-09-02");
  confirm(input,"proposalAccepted","2026-09-03"); confirm(input,"validated","2026-09-05");
  const email = row(input,"email");
  assert.equal(email.total,1); assert.equal(email.direct,0); assert.equal(email.inferred,1);
  assert.equal(email.members[0].firstDate,null);
  assert.equal(email.members[0].evidenceDate,at("2026-09-03"));
  assert.equal(row(input,"cooperating").total,1);
  const other=setup(); confirm(other,"agreed","2026-09-02"); confirm(other,"proposalUnaccepted","2026-09-03");
  confirm(other,"activeWithout","2026-09-04");
  assert.equal(row(other,"cooperating").total,1);
  assert.equal(row(other,"email").total,0);
});
test("later direct evidence replaces inferred provenance without multiplying clinic", () => {
  const input=setup(); confirm(input,"agreed","2026-09-02"); confirm(input,"proposalAccepted","2026-09-03");
  confirm(input,"email","2026-09-06");
  assert.equal(row(input,"email").direct,1); assert.equal(row(input,"email").inferred,0);
  assert.equal(row(input,"email").members[0].firstDate,at("2026-09-06"));
});
test("validated contract alone proves cooperation without the retired source", () => {
  const input=setup();
  input.config!.sources.activeWith=[];
  confirm(input,"validated","2026-09-02");
  assert.equal(row(input,"cooperating").total,1);
  confirm(input,"agreed","2026-09-03");
  assert.equal(row(input,"cooperating").total,1);
  confirm(input,"proposalAccepted","2026-09-04");
  const cooperation=row(input,"cooperating");
  assert.equal(cooperation.total,1);
  assert.equal(cooperation.direct,1);
  assert.equal(cooperation.members[0].firstDate,at("2026-09-02"));
  assert.equal(cooperation.members[0].basis,"history");
  const legacy=setup();
  confirm(legacy,"agreed","2026-09-02");
  confirm(legacy,"proposalAccepted","2026-09-03");
  confirm(legacy,"activeWith","2026-09-04");
  assert.equal(row(legacy,"cooperating").total,0);
});
test("no-contract cooperation never joins withdrawn or separate-enrollment evidence", () => {
  const input=setup();
  confirm(input,"agreed","2026-09-02");
  confirm(input,"agreed","2026-09-03",false);
  confirm(input,"proposalUnaccepted","2026-09-04");
  assert.equal(row(input,"cooperating").total,0);
  input.enrollments.push({id:"other",clinicId:"a"});
  confirm(input,"agreed","2026-09-05",true,"other");
  assert.equal(row(input,"cooperating").total,0);
  confirm(input,"agreed","2026-09-06");
  assert.equal(row(input,"cooperating").members[0].firstDate,at("2026-09-06"));
});
test("state-only contract cooperation retains an unknown date and does not mutate its sources", () => {
  const input=setup();
  input.states=["agreed","validated","proposalAccepted"].map(itemId=>({contactId:"c",itemId,at:at("2026-09-03")}));
  const before=JSON.stringify(input);
  const cooperation=row(input,"cooperating");
  assert.equal(cooperation.total,1);
  assert.equal(cooperation.members[0].firstDate,null);
  assert.equal(cooperation.members[0].basis,"state");
  assert.equal(JSON.stringify(input),before);
});
test("production-code suggestions measure contract cooperation and all three materials without a poster", () => {
  const input=setup();
  input.items=["MPN-05c","MPN-06d","MPN-12e","MPN-13d","MPN-14d","MPN-15d","MPN-16d"]
    .map(stepId=>({id:stepId,stepId,label:stepId,parentId:null}));
  input.config=suggestFunnelConfig(input.items);
  assert.deepEqual(input.config.sources.materials17,["MPN-13d"]);
  assert.deepEqual(input.config.sources.materials18,["MPN-14d"]);
  assert.deepEqual(input.config.sources.materials19,["MPN-15d"]);
  assert.deepEqual(input.config.sources.activeWith,[]);
  assert.equal(row(input,"cooperating").total,0);
  assert.equal(row(input,"materials").total,0);
  for (const id of ["MPN-05c","MPN-06d","MPN-12e"]) confirm(input,id,"2026-09-02");
  assert.equal(row(input,"cooperating").total,1);
  confirm(input,"MPN-13d","2026-09-03");
  confirm(input,"MPN-14d","2026-09-03");
  assert.equal(row(input,"materials").total,0);
  confirm(input,"MPN-15d","2026-09-04");
  assert.equal(row(input,"materials").total,1);
  assert.equal(row(input,"materials").members[0].firstDate,at("2026-09-04"));
});
test("retired source remains save-compatible but is not offered in the configuration editor", () => {
  assert.equal(new Set<string>(configurableFunnelSources).has("activeWith"),false);
  assert.equal(configurableFunnelSources.includes("activeWithout"),true);
  const config=emptyFunnelConfig();
  config.sources.activeWith=["legacy-id"];
  assert.equal(funnelConfigSchema.safeParse(config).success,true);
});
test("cooperation is unknown when no complete branch is mapped, including materials", () => {
  const input=setup();
  input.config!.sources.agreed=[];
  input.config!.sources.validated=[];
  assert.equal(row(input,"cooperating").total,null);
  assert.equal(row(input,"materials").total,null);
});
test("no-contract cooperation needs exactly agreement AND no contract, with no third confirmation", () => {
  const input=setup();
  input.config!.sources.activeWithout=[];
  confirm(input,"proposalUnaccepted","2026-09-02");
  assert.equal(row(input,"cooperating").total,0);
  confirm(input,"agreed","2026-09-03");
  assert.equal(row(input,"cooperating").total,1);
  assert.equal(row(input,"cooperating").members[0].firstDate,at("2026-09-03"));
  const agreementOnly=setup(); confirm(agreementOnly,"agreed","2026-09-02");
  assert.equal(row(agreementOnly,"cooperating").total,0);
});
test("materials require cooperation AND all three material choices; poster is not needed", () => {
  const input=setup(); confirm(input,"agreed","2026-09-02"); confirm(input,"proposalUnaccepted","2026-09-03");
  for (const key of ["materials17","materials18","materials19"]) confirm(input,key,"2026-09-04");
  assert.equal(row(input,"materials").total,1);
  confirm(input,"activeWithout","2026-09-05");
  assert.equal(row(input,"materials").total,1);
});
test("one recorded package counts once; exclusions do not fabricate individual item sends", () => {
  const input=setup();
  input.config!.materials={packageSent:["package"],excluded:{materials17:[],materials18:["declined18"],materials19:[]}};
  for(const key of ["materials17","materials18","materials19"] as const) input.config!.sources[key]=[];
  confirm(input,"agreed","2026-09-02");confirm(input,"proposalUnaccepted","2026-09-03");
  confirm(input,"declined18","2026-09-04");
  assert.equal(row(input,"materials").total,0);
  confirm(input,"package","2026-09-05");
  confirm(input,"package","2026-09-06");
  assert.equal(row(input,"materials").total,1);
  assert.equal(row(input,"materials").members[0].firstDate,at("2026-09-05"));
  assert.equal(input.states.some(state=>state.itemId==="materials18"),false);
});
test("legacy package evidence allows explicit declined components but not unknown or all-declined items", () => {
  const input=setup();
  input.config!.materials={packageSent:[],excluded:{materials17:["declined17"],materials18:["declined18"],materials19:["declined19"]}};
  confirm(input,"agreed","2026-09-02");confirm(input,"proposalUnaccepted","2026-09-03");
  confirm(input,"materials17","2026-09-04");confirm(input,"materials19","2026-09-04");
  assert.equal(row(input,"materials").total,0);
  confirm(input,"declined18","2026-09-05");
  assert.equal(row(input,"materials").total,1);
  const excluded=setup();excluded.config!.materials=input.config!.materials;
  for(const key of ["agreed","proposalUnaccepted","declined17","declined18","declined19"])confirm(excluded,key,"2026-09-02");
  assert.equal(row(excluded,"materials").total,0);
});
test("canonical production refusals are mapped automatically without requiring declined materials sent",()=>{
  const input=setup();
  input.items=["MPN-05c","MPN-06e","MPN-13d","MPN-14e","MPN-15d"]
    .map(stepId=>({id:stepId,stepId,label:stepId,parentId:null}));
  input.config=suggestFunnelConfig(input.items);
  assert.deepEqual(input.config.materials!.excluded.materials18,["MPN-14e"]);
  for(const key of ["MPN-05c","MPN-06e","MPN-13d","MPN-14e","MPN-15d"])
    confirm(input,key,"2026-09-23");
  assert.equal(row(input,"materials").total,1);
  assert.equal(input.states.some(state=>state.itemId==="MPN-14d"),false);
});
test("unreachable requires five consecutive unsuccessful attempts and deduplicates SIP sessions", () => {
  const input=setup();
  for(let i=2;i<=5;i++) input.calls.push(call(String(i),`2026-09-0${i}`));
  const unreachable=()=>computeMissionFunnel(input).exceptions.find(e=>e.key==="unreachable")!.members.length;
  assert.equal(unreachable(),1);
  input.calls.push({...call("6","2026-09-06","completed"),answeredAt:at("2026-09-06"),duration:10});
  assert.equal(unreachable(),0);
  input.calls=input.calls.slice(0,5).map(c=>({...c,sipCallId:"one-physical-call"}));
  assert.equal(unreachable(),0);
});
test("cancelled-only logs are not calls; provisional first attempts are counted visibly", () => {
  const input=setup(); input.calls=[call("1","2026-09-01","cancelled")];
  assert.equal(row(input,"dialed").total,0);
  assert.equal(computeMissionFunnel(input).quality.withoutAttempt,1);
  input.calls.push(call("2","2026-09-02"));
  assert.equal(computeMissionFunnel(input).quality.provisional,1);
});
test("unmapped sources are unknown, zero denominators are null, referral filters apply also to assignment", () => {
  const input=setup(); input.config=emptyFunnelConfig();
  assert.equal(row(input,"qualified").total,null); assert.equal(row(input,"connected").previousPercent,0);
  assert.equal(row(input,"connected").qualifiedPercent,null);
  assert.equal(row(input,"assigned",{referral:"no"}).total,0);
});
test("date filtering uses Bratislava local day and inclusive end date", () => {
  const input=setup(); input.calls[0].at="2026-09-30T22:30:00Z";
  assert.equal(row(input,"dialed",{from:"2026-10-01",to:"2026-10-01"}).total,1);
  assert.equal(row(input,"dialed",{to:"2026-09-30"}).total,0);
});
test("state-only AND evidence has an unknown date, never a fabricated historic overlap", () => {
  const input=setup();
  input.states=[{contactId:"c",itemId:"agreed",at:at("2026-09-03")},{contactId:"c",itemId:"proposalAccepted",at:at("2026-09-04")}];
  assert.equal(row(input,"wantsToSign").members[0].firstDate,null);
  assert.equal(row(input,"wantsToSign").members[0].basis,"state");
});
test("only exact business codes suggest mapping; canonical or similar labels are never guessed", () => {
  const config=suggestFunnelConfig([
    {id:"yes",stepId:"MPN-04b",label:"Qualified",parentId:null},
    {id:"no",stepId:"MPN-04c",label:"Qualified",parentId:null},
    {id:"fake",stepId:"custom",label:"Contract validated",parentId:null},
  ]);
  assert.deepEqual(config.sources.qualified,["yes"]);
  assert.deepEqual(config.sources.validated,[]);
  assert.equal(funnelConfigSchema.safeParse(config).success,true);
});
test("read-only projection does not mutate the input", () => {
  const input=setup(); confirm(input,"agreed","2026-09-02"); const before=JSON.stringify(input);
  computeMissionFunnel(input); assert.equal(JSON.stringify(input),before);
});
test("long-term absence belongs to unreachable, retains return date, resumes on return without state writes", () => {
  const input=setup(); confirm(input,"absent","2026-09-02");
  input.absenceReturns={c:"2026-11-02"};
  const before=computeMissionFunnel(input,{},new Date("2026-10-30T12:00:00Z"));
  assert.equal(before.exceptions.find(e=>e.key==="absent")!.members[0].returnDate,"2026-11-02");
  assert.equal(before.exceptions.find(e=>e.key==="unreachable")!.members.length,1);
  const after=computeMissionFunnel(input,{},new Date("2026-11-02T12:00:00Z"));
  assert.equal(after.exceptions.find(e=>e.key==="absent")!.members.length,0);
  assert.equal(after.exceptions.find(e=>e.key==="unreachable")!.members.length,0);
  assert.equal(input.states.some(s=>s.itemId==="absent"),true);
});
test("refusal keeps a six-calendar-month return date including month end",()=>{
  const input=setup();confirm(input,"refused","2026-08-31");
  const result=computeMissionFunnel(input);
  assert.equal(result.exceptions.find(e=>e.key==="refused")!.members[0].returnDate,at("2027-02-28"));
});
