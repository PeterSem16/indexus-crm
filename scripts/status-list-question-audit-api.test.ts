import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { request,chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { pool } from "../server/db";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw Error("Development fixtures only");
const [user, outsider, mission, otherMission, clinic, contact, item, question, otherItem, otherQuestion] =
  Array.from({ length: 10 }, () => randomUUID());
const password = randomBytes(24).toString("hex"), username = `audit-${user}`;
const api = await request.newContext({ baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}` });
const other = await request.newContext({ baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}` });
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
const root = `/api/campaigns/${mission}/contacts/${contact}/status-list-workflows`;
const endpoint = `${root}/answers/${question}/note`;
const response = async (r: any, status = 200) => {
  const body = await r.json(); assert.equal(r.status(), status, JSON.stringify(body)); return body;
};
try {
  const hash = await bcrypt.hash(password, 10);
  for (const [id, role] of [[user, "admin"], [outsider, "user"]]) await pool.query(
    `INSERT INTO users(id,username,password_hash,full_name,email,role,is_active,assigned_countries)
     VALUES($1,$2,$3,'Synthetic audit tester',$4,$5,true,ARRAY['SK'])`,
    [id, `audit-${id}`, hash, `audit-${id}@example.invalid`, role]);
  for (const id of [mission, otherMission]) await pool.query(
    "INSERT INTO campaigns(id,name,country_codes,status,settings) VALUES($1,'Synthetic audit test',ARRAY['SK'],'active',$2)",
    [id, JSON.stringify({ statusListMode: "batch" })]);
  await pool.query("INSERT INTO clinics(id,name,country_code) VALUES($1,'Synthetic audit clinic','SK')", [clinic]);
  await pool.query("INSERT INTO campaign_contacts(id,campaign_id,contact_type,clinic_id) VALUES($1,$2,'clinic',$3)", [contact, mission, clinic]);
  for (const [id, mid] of [[item, mission], [otherItem, otherMission]]) await pool.query(
    "INSERT INTO campaign_status_list_items(id,campaign_id,step_id,label) VALUES($1,$2,'audit','Synthetic audit step')", [id, mid]);
  for (const [id, iid] of [[question, item], [otherQuestion, otherItem]]) await pool.query(
    "INSERT INTO campaign_status_list_questions(id,item_id,question_text) VALUES($1,$2,'Synthetic audit question')", [id, iid]);
  await pool.query(`INSERT INTO mission_status_list_answers(campaign_contact_id,question_id,value,updated_by)
    VALUES($1,$2,'false'::jsonb,$3)`, [contact, question, user]);
  await response(await api.patch(endpoint, { data: { note: "not authorized" } }), 401);
  await response(await api.post("/api/auth/login", { data: { username, password } }));
  await response(await other.post("/api/auth/login", { data: { username: `audit-${outsider}`, password } }));
  await response(await other.patch(endpoint, { data: { note: "not permitted" } }), 403);
  const before = await response(await api.get(root));
  assert.equal(before.answerMetadata[question].answeredByName, "Synthetic audit tester");
  assert.equal(before.answerMetadata[question].actorKind, "user");
  await response(await api.patch(endpoint, { data: {} }), 400);
  await response(await api.patch(endpoint, { data: { note: "x", confirm: true } }), 400);
  await response(await api.patch(endpoint, { data: { note: "x".repeat(10001) } }), 400);
  await response(await api.patch(`${root}/answers/${otherQuestion}/note`, { data: { note: "cross-Mission" } }), 404);
  await response(await api.patch(endpoint, { data: { note: "Saved in Batch without confirming" } }));
  const saved = await response(await api.get(root));
  assert.equal(saved.questionNotes[question].note, "Saved in Batch without confirming");
  assert.deepEqual(saved.answerMetadata, before.answerMetadata);
  assert.deepEqual(saved.answers, before.answers);
  await response(await api.patch(endpoint, { data: { note: null } }));
  const cleared = await response(await api.get(root));
  assert.equal(cleared.questionNotes[question].note, null);
  for (const table of ["campaign_contact_status_list_state", "mission_status_list_rule_runs", "mission_status_list_automatic_events"]) {
    const count = await pool.query(`SELECT count(*) FROM ${table} WHERE campaign_contact_id=$1`, [contact]);
    assert.equal(count.rows[0].count, "0", `${table}: note cannot admit actions or confirmations`);
  }
  await response(await api.patch(endpoint,{data:{note:"Preserved when note entry is disabled"}}));
  await response(await api.put(`/api/campaigns/${mission}/status-list/${item}/questions/${question}`,
    {data:{noteEnabled:false,previewActions:true}}));
  await response(await api.patch(endpoint,{data:{note:"Must not overwrite"}}),409);
  const disabled=await response(await api.get(root));
  assert.equal(disabled.questionNotes[question].note,"Preserved when note entry is disabled");
  const definitions=await response(await api.get(`/api/campaigns/${mission}/status-list`));
  assert.equal(definitions.find((entry:any)=>entry.id===item).questions.find((entry:any)=>entry.id===question).noteEnabled,false);
  assert.equal(definitions.find((entry:any)=>entry.id===item).questions.find((entry:any)=>entry.id===question).previewActions,true);
  const recap=await response(await api.post(`${root}/confirmation-preview`,{data:{changes:[{kind:"question",id:question,value:true}]}}));
  assert.equal(recap.readOnly,true);assert.deepEqual(recap.actions,[]);
  await response(await other.post(`${root}/confirmation-preview`,{data:{changes:[{kind:"question",id:question,value:true}]}}),403);
  const heading=await response(await api.post(`/api/campaigns/${mission}/status-list`,
    {data:{stepId:"audit-heading",label:"Synthetic heading",confirmationType:"info",icon:"Phone",previewActions:true}}));
  await response(await api.post(`${root}/confirmation-preview`,
    {data:{changes:[{kind:"item",id:heading.id,value:true}]}}),409);
  const automatic=await response(await api.post(`/api/campaigns/${mission}/status-list`,
    {data:{stepId:"audit-auto",label:"Synthetic explicit automatic",confirmationType:"auto"}}));
  const currentDefinitions=await response(await api.get(`/api/campaigns/${mission}/status-list`));
  assert.equal(currentDefinitions.find((entry:any)=>entry.id===automatic.id).automaticTrigger,"disabled",
    "New automatic steps must wait for an explicit saved trigger, never fall into legacy card-open execution");
  await mkdir("generated-artifacts/status-list-usability",{recursive:true});
  browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",headless:true,args:["--no-sandbox"]});
  const context=await browser.newContext({baseURL:`https://${process.env.REPLIT_DEV_DOMAIN}`,storageState:await api.storageState(),viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/");
  await page.evaluate("window.__name = value => value");
  await page.evaluate(async({campaignId,contactId,itemId,questionId})=>{
    const hookSource=await(await fetch("/src/components/use-status-list-action-recap.tsx")).text();
    const mainSource=await(await fetch("/src/main.tsx")).text();
    const reactPath=hookSource.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/)?.[1];
    const domPath=mainSource.match(/from\s+["']([^"']*\/react-dom_client\.js[^"']*)["']/)?.[1];
    if(!reactPath || !domPath)throw Error("Cannot resolve the application's Vite React modules");
    const [reactModule,domModule,{useStatusListActionRecap}]=await Promise.all([
      import(reactPath),import(domPath),import("/src/components/use-status-list-action-recap.tsx")]);
    const React=reactModule.default ?? reactModule;
    const createRoot=domModule.createRoot ?? domModule.default.createRoot;
    const mount=document.createElement("div");document.body.replaceChildren(mount);
    function Harness(){
      const [result,setResult]=React.useState("waiting");
      const recap=useStatusListActionRecap({campaignId,contactId,locale:"sk",mode:"batch",
        items:[{id:itemId,questions:[{id:questionId,previewActions:true}]}]});
      return React.createElement(React.Fragment,null,recap.dialog,
        React.createElement("button",{onClick:async()=>setResult(await recap.confirm([{kind:"question",id:questionId,value:true}])?"accepted":"cancelled")},"Fixture preview"),
        React.createElement("output",{"data-testid":"fixture-result"},result));
    }
    createRoot(mount).render(React.createElement(Harness));
  },{campaignId:mission,contactId:contact,itemId:item,questionId:question});
  await page.getByRole("button",{name:"Fixture preview",exact:true}).click();
  await page.getByTestId("status-list-recap-confirm").waitFor();
  await page.waitForFunction(()=>!(document.querySelector('[data-testid="status-list-recap-confirm"]') as HTMLButtonElement)?.disabled);
  await page.screenshot({path:"generated-artifacts/status-list-usability/recap-desktop.jpg"});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:"generated-artifacts/status-list-usability/recap-mobile.jpg"});
  assert.ok(await page.getByRole("dialog").evaluate(node=>node.getBoundingClientRect().width<=window.innerWidth),"recap must fit mobile viewport");
  await page.getByRole("button",{name:"Zrušiť",exact:true}).click();
  await page.getByTestId("fixture-result").filter({hasText:"cancelled"}).waitFor();
  assert.deepEqual(errors,[]);
  await context.close();
  console.log("Question usability API/browser passed: persisted note/recap controls, preserved history, exact Mission, cancellable read-only recap at 1440/390px, non-confirmable heading and explicit automatic activation.");
} finally {
  await browser?.close();
  await api.dispose(); await other.dispose();
  await pool.query("DELETE FROM campaign_contact_history WHERE campaign_contact_id=$1", [contact]);
  await pool.query("DELETE FROM campaign_contacts WHERE id=$1", [contact]);
  await pool.query("DELETE FROM campaign_status_list_questions WHERE id=ANY($1::varchar[])", [[question, otherQuestion]]);
  await pool.query("DELETE FROM campaign_status_list_items WHERE id=ANY($1::varchar[])", [[item, otherItem]]);
  await pool.query("DELETE FROM campaigns WHERE id=ANY($1::varchar[])", [[mission, otherMission]]);
  await pool.query("DELETE FROM clinics WHERE id=$1", [clinic]);
  await pool.query("DELETE FROM user_sessions WHERE user_id=ANY($1::varchar[])", [[user, outsider]]).catch(() => {});
  await pool.query("DELETE FROM users WHERE id=ANY($1::varchar[])", [[user, outsider]]);
  await pool.end();
}
