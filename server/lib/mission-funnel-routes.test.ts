import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { registerMissionFunnelRoutes, parseFunnelSettings } from "./mission-funnel-routes";
import { emptyFunnelConfig, funnelSteps } from "../../shared/mission-funnel";
import { missionClinicReferralSql } from "./mission-funnel-referral";

async function fixture(run: (url: string, sql: { text: string; args: unknown[] }[]) => Promise<void>, options: {
  role?: string; roleId?: string; assigned?: boolean; moduleRead?: boolean; moduleEdit?: boolean;
  countries?: string[]; missionCountries?: string[]; settings?: unknown; itemIds?: string[];
  respond?: (text: string, args: unknown[]) => unknown[] | undefined;
} = {}) {
  const sql: { text: string; args: unknown[] }[] = [];
  const query = async (text: string, args: unknown[] = []) => {
    sql.push({text,args});
    if (text.includes("FROM users u CROSS JOIN campaigns")) return {rows:[{
      role: options.role ?? "admin", role_id: options.roleId ?? null,
      assigned_countries: options.countries ?? ["SK"], country_codes: options.missionCountries ?? ["SK"],
      assigned: options.assigned ?? false, module_read: options.moduleRead ?? false,
      module_edit: options.moduleEdit ?? false, name:"Mission",settings:options.settings ?? "{}",
    }]};
    if (text.startsWith("SELECT settings")) return {rows:[{settings:options.settings ?? "{}"}]};
    if (text.startsWith("SELECT id FROM campaign_status_list_items")) return {rows:(options.itemIds??[]).map(id=>({id}))};
    const custom = options.respond?.(text, args);
    if (custom) return { rows: custom };
    return {rows:[]};
  };
  const database={query,connect:async()=>({query,release(){}})};
  const app=express();
  app.use(express.json());
  app.use((req:any,_res,next)=>{req.session={user:{id:"actor"}}; next();});
  registerMissionFunnelRoutes(app, (req,res,next)=>{
    if(req.headers["x-anonymous"]) return res.status(401).json({error:"Unauthorized"});
    next();
  },database as any);
  const server=app.listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));
  try {await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`,sql);}
  finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
}
const report="/api/campaigns/mission/mission-funnel";
test("referral eligibility reads person links in the same protected clinic query, never as extra contacts", async () => {
  await fixture(async(url,sql)=>{
    const response=await fetch(url+report+"?referral=yes");
    assert.equal(response.status,200);
    const queries=sql.filter(s=>s.text.includes("SELECT DISTINCT c.id"));
    assert.equal(queries.length,1);
    const query=queries[0];
    assert.ok(query.text.includes(missionClinicReferralSql));
    assert.match(query.text,/cc\.campaign_id=\$1/);
    assert.match(query.text,/cc\.contact_type='clinic'/);
    assert.match(query.text,/c\.country_code=ANY\(\$3::text\[\]\)/);
    assert.deepEqual(query.args,["mission",false,["SK"]]);
    assert.doesNotMatch(query.text,/JOIN collaborators/);
  },{role:"user",assigned:true});
});
test("report denies anonymous access before any database query",async()=>{
  await fixture(async(url,sql)=>{
    const response=await fetch(url+report,{headers:{"x-anonymous":"yes"}});
    assert.equal(response.status,401);assert.equal(sql.length,0);
  });
});
test("country and module scope are both mandatory; assigned agent cannot bypass country",async()=>{
  await fixture(async(url)=>assert.equal((await fetch(url+report)).status,403),
    {role:"user",assigned:true,countries:["CZ"]});
  await fixture(async(url)=>assert.equal((await fetch(url+report)).status,403),
    {role:"user"});
});
test("read-only snapshot binds Mission and authorized countries and does not write",async()=>{
  await fixture(async(url,sql)=>{
    const response=await fetch(url+report+"?referral=yes");
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.canConfigure,false);
    assert.equal(body.rows.length,funnelSteps.length);
    assert.ok(sql.some(s=>s.text.includes("REPEATABLE READ READ ONLY")));
    const clinics=sql.find(s=>s.text.includes("SELECT DISTINCT c.id"))!;
    assert.ok(clinics.text.includes(missionClinicReferralSql));
    assert.deepEqual(clinics.args,["mission",false,["SK"]]);
    assert.equal(sql.some(s=>/^\s*(INSERT|UPDATE|DELETE)\b/.test(s.text)),false);
  },{role:"user",assigned:true});
});
test("agent comparison uses scoped original authors and the same read-only snapshot", async () => {
  const config = emptyFunnelConfig();
  config.sources.agreed = ["agreement"];
  config.sources.proposalAccepted = ["accepted"];
  config.sources.validated = ["validated"];
  await fixture(async (url, sql) => {
    const response = await fetch(url + report + "?from=2026-09-01&to=2026-09-01&referral=yes");
    assert.equal(response.status, 200);
    const body = await response.json();
    const cohort = body.agentComparison.cohort;
    const contribution = body.agentComparison.contribution;
    assert.equal(cohort.find((row: any) => row.agentId === "caller").rows.find((row: any) => row.key === "cooperating").total, 1);
    assert.equal(contribution.find((row: any) => row.agentId === "closer").rows.find((row: any) => row.key === "cooperating").total, 1);
    assert.equal(body.canConfigure, false);
    const directory = sql.find(query => query.text.includes("COALESCE(NULLIF(BTRIM(u.full_name)"))!;
    assert.deepEqual(new Set(directory.args[0] as string[]), new Set(["caller", "closer"]));
    assert.deepEqual(directory.args.slice(1), ["mission", false, ["SK"]]);
    assert.match(directory.text, /campaign_agents/);
    assert.match(directory.text, /assigned_countries &&/);
    assert.ok(sql.findIndex(query => query.text === "COMMIT") > sql.indexOf(directory));
    assert.ok(sql.some(query => query.text.includes('h.user_id AS "actorId"')));
    assert.ok(sql.some(query => query.text.includes('l.user_id AS "actorId"')));
    assert.equal(sql.some(query => /^\s*(INSERT|UPDATE|DELETE)\b/.test(query.text)), false);
    assert.equal(JSON.stringify(body).includes("password"), false);
  }, {
    role: "user", assigned: true, settings: { missionFunnel: config },
    respond: text => {
      if (text.includes('step_id AS "stepId"')) return ["agreement", "accepted", "validated"].map(id => ({ id, stepId: id, label: id, parentId: null }));
      if (text.includes("SELECT DISTINCT c.id")) return [{ id: "clinic", name: "Clinic", representativeId: null, referred: true }];
      if (text.includes('SELECT id,clinic_id AS "clinicId"')) return [{ id: "contact", clinicId: "clinic" }];
      if (text.includes("SELECT h.id")) return ["agreement", "accepted", "validated"].map((itemId, i) => ({
        id: itemId, contactId: "contact", itemId, confirmed: true, at: `2026-09-0${i + 2}T10:00:00Z`, actorId: i === 2 ? "closer" : "caller",
      }));
      if (text.includes("SELECT l.id")) return [{
        id: "call", clinicId: "clinic", contactId: "contact", actorId: "caller", direction: "outbound",
        status: "completed", at: "2026-09-01T10:00:00Z", answeredAt: "2026-09-01T10:00:05Z", duration: 30, metadata: {},
      }];
      if (text.includes("COALESCE(NULLIF(BTRIM(u.full_name)")) return [{ id: "caller", name: "Caller" }, { id: "closer", name: "Closer" }];
      return undefined;
    },
  });
});
test("invalid dates and reversed ranges fail before reading sensitive data",async()=>{
  await fixture(async(url,sql)=>{
    for(const suffix of ["?from=2026-02-30","?from=2026-10-02&to=2026-10-01","?referral=invalid"]){
      assert.equal((await fetch(url+report+suffix)).status,400);
    }
    assert.equal(sql.length,0);
  });
});
test("configuration denied to assigned agents and partial-country managers",async()=>{
  for(const options of [
    {role:"user",assigned:true},
    {role:"manager",countries:["SK"],missionCountries:["SK","CZ"]},
  ]) await fixture(async(url,sql)=>{
    const response=await fetch(url+report+"/config",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(emptyFunnelConfig())});
    assert.equal(response.status,403);
    assert.equal(sql.some(s=>s.text.startsWith("UPDATE")),false);
  },options);
});
test("foreign source UUIDs are rejected atomically",async()=>{
  const config=emptyFunnelConfig();config.sources.qualified=["foreign"];
  await fixture(async(url,sql)=>{
    const response=await fetch(url+report+"/config",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(config)});
    assert.equal(response.status,400);
    assert.equal(sql.some(s=>s.text.startsWith("UPDATE")),false);
    assert.ok(sql.some(s=>s.text==="ROLLBACK"));
  });
});
test("configuration save row-locks and preserves unrelated module settings",async()=>{
  await fixture(async(url,sql)=>{
    const response=await fetch(url+report+"/config",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(emptyFunnelConfig())});
    assert.equal(response.status,200);
    assert.ok(sql.some(s=>s.text.includes("FOR UPDATE")));
    const update=sql.find(s=>s.text.startsWith("UPDATE campaigns"))!;
    const settings=JSON.parse(String(update.args[1]));
    assert.deepEqual(settings.faq,[{title:"Retain"}]);
    assert.equal(settings.recordCalls,true);
    assert.equal(settings.missionFunnel.version,1);
  },{settings:JSON.stringify({faq:[{title:"Retain"}],recordCalls:true})});
});
test("invalid settings fail explicitly rather than replacing the shared settings object",()=>{
  assert.throws(()=>parseFunnelSettings("[]"));
  assert.throws(()=>parseFunnelSettings("broken"));
  assert.deepEqual(parseFunnelSettings(null),{});
});
test("attempt evidence rejects unowned calls and invalid dates without modifying call state",async()=>{
  await fixture(async(url,sql)=>{
    const base=url+"/api/call-logs/call/funnel-attempt";
    const send=(sentAt:string)=>fetch(base,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sentAt})});
    assert.equal((await send("invalid")).status,400);
    assert.equal((await send(new Date().toISOString())).status,404);
    assert.equal(sql.some(s=>s.text.startsWith("UPDATE call_logs")),false);
    assert.ok(sql.some(s=>s.text.includes("l.user_id=$2") && s.args[1]==="actor"));
  });
});
