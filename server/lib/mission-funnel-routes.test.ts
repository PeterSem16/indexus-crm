import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { registerMissionFunnelRoutes, parseFunnelSettings } from "./mission-funnel-routes";
import { emptyFunnelConfig } from "../../shared/mission-funnel";

async function fixture(run: (url: string, sql: { text: string; args: unknown[] }[]) => Promise<void>, options: {
  role?: string; roleId?: string; assigned?: boolean; moduleRead?: boolean; moduleEdit?: boolean;
  countries?: string[]; missionCountries?: string[]; settings?: unknown; itemIds?: string[];
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
    assert.equal(body.rows.length,15);
    assert.ok(sql.some(s=>s.text.includes("REPEATABLE READ READ ONLY")));
    const clinics=sql.find(s=>s.text.includes("SELECT DISTINCT c.id"))!;
    assert.deepEqual(clinics.args,["mission",false,["SK"]]);
    assert.equal(sql.some(s=>/^\s*(INSERT|UPDATE|DELETE)\b/.test(s.text)),false);
  },{role:"user",assigned:true});
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
