import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { chromium, request } from "playwright";
import { mkdir } from "node:fs/promises";
import { pool } from "../server/db";
import { defaultReachabilityPolicy } from "../shared/status-list-option-source";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw Error("Development fixtures only");
const [user, outsider, mission, otherMission, item, contact, clinic] = Array.from({length:7},()=>randomUUID());
const password = randomBytes(24).toString("hex");
const baseURL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const api = await request.newContext({baseURL});
const other = await request.newContext({baseURL});
const root = `/api/campaigns/${mission}/status-list-workflows`;
const definitions = `/api/campaigns/${mission}/status-list`;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const read = async (r: any, status=200) => {
  const body=await r.json();assert.equal(r.status(),status,JSON.stringify(body));return body;
};
try {
  const hash=await bcrypt.hash(password,10);
  for(const [id,role] of [[user,"admin"],[outsider,"user"]]) await pool.query(`INSERT INTO users
    (id,username,password_hash,full_name,email,role,is_active,assigned_countries)
    VALUES($1,$2,$3,'Synthetic refinement tester',$4,$5,true,ARRAY['SK'])`,
  [id,`refinement-${id}`,hash,`refinement-${id}@example.invalid`,role]);
  for(const id of [mission,otherMission]) await pool.query(`INSERT INTO campaigns(id,name,country_codes,status,settings)
    VALUES($1,'Synthetic refinement test',ARRAY['SK'],'active','{"statusListMode":"batch"}')`,[id]);
  await pool.query("INSERT INTO clinics(id,name,country_code) VALUES($1,'Synthetic refinement clinic','SK')",[clinic]);
  await pool.query("INSERT INTO campaign_contacts(id,campaign_id,contact_type,clinic_id) VALUES($1,$2,'clinic',$3)",[contact,mission,clinic]);
  await pool.query(`INSERT INTO campaign_status_list_items(id,campaign_id,step_id,label,confirmation_type)
    VALUES($1,$2,'refinement','Synthetic heading','info')`,[item,mission]);
  await read(await api.post("/api/auth/login",{data:{username:`refinement-${user}`,password}}));
  await read(await other.post("/api/auth/login",{data:{username:`refinement-${outsider}`,password}}));
  await read(await other.post(`${root}/source-targets`,{data:{source:"representative_assigned",label:"Forbidden"}}),403);
  await read(await api.post(`${root}/source-targets`,{data:{source:"reachability",label:"Invalid",options:{waiting:"Missing"}}}),400);
  for (const source of ["representative_assigned","representative_assignment_type"] as const) {
    const target=await read(await api.post(`${root}/source-targets`,{data:{source,label:`Synthetic ${source}`}}),201);
    const catalog=await read(await api.get(`${root}/sources`));
    assert.equal(catalog.catalog.find((q:any)=>q.id===target.questionId).systemSourceEligible,true);
    await read(await api.put(`${root}/sources/${target.questionId}`,{data:{source,hidden:true}}));
    const saved=await read(await api.get(`${root}/sources`));
    assert.equal(saved.sources.find((s:any)=>s.questionId===target.questionId).source,source);
    await read(await api.put(`${definitions}/${target.itemId}/questions/${target.questionId}`,{data:{noteEnabled:false}}));
    await read(await api.put(`${root}/sources/${target.questionId}`,{data:{source,hidden:false}}));
    await read(await api.delete(`${root}/sources/${target.questionId}`));
    await pool.query("DELETE FROM campaign_status_list_items WHERE id=$1 AND campaign_id=$2",[target.itemId,mission]);
  }
  for(const source of ["reachability","coordinator"] as const) {
    const options=source==="reachability"?{not_defined:"Not defined",waiting:"Waiting",unreachable:"Unreachable",reachable:"Reachable"}:{unassigned:"Unassigned",assigned:"Assigned"};
    const target=await read(await api.post(`${root}/source-targets`,{data:{source,label:`Synthetic ${source}`,options}}),201);
    const config=source==="reachability"
      ? {source,mapping:target.mapping,policy:defaultReachabilityPolicy}
      : {source,mapping:target.mapping,users:[]};
    await read(await api.put(`${root}/option-sources/${target.groupId}`,{data:{...config,hidden:true}}));
    const saved=await read(await api.get(`${root}/option-sources`));
    assert.equal(saved.sources.find((s:any)=>s.groupId===target.groupId).source,source);
    await read(await api.delete(`${root}/option-sources/${target.groupId}`));
    await pool.query("DELETE FROM campaign_status_list_items WHERE id=$1 AND campaign_id=$2",[target.groupId,mission]);
  }
  const question=await read(await api.post(`${definitions}/${item}/questions`,{data:{questionText:"Synthetic first choice",groupName:"Appointments",logicOperator:"ONE",icon:"Clock3",noteEnabled:false}}));
  const second=await read(await api.post(`${definitions}/${item}/questions`,{data:{questionText:"Synthetic second choice",groupName:" Appointments ",logicOperator:"OR",noteEnabled:false}}));
  assert.equal(second.groupName,"Appointments");assert.equal(second.logicOperator,"ONE");
  await read(await api.put(`${definitions}/${item}/questions/${question.id}`,{data:{logicOperator:"AND"}}));
  assert.deepEqual((await pool.query("SELECT DISTINCT logic_operator FROM campaign_status_list_questions WHERE item_id=$1 AND group_name='Appointments'",[item])).rows,[{logic_operator:"AND"}]);
  await read(await api.put(`${definitions}/${item}/questions/${question.id}`,{data:{logicOperator:"ONE"}}));
  await read(await api.put(`/api/campaigns/${otherMission}/status-list/${item}/questions/${question.id}`,{data:{questionText:"Must not overwrite"}}),404);
  await read(await other.put(`${definitions}/${item}/questions/${question.id}`,{data:{questionText:"Forbidden"}}),403);
  await pool.query(`INSERT INTO campaign_status_list_automations(id,status_list_item_id,question_id,action_type,condition_field,sort_order)
    VALUES($1,$2,$3,'set_callback','always',0)`,[randomUUID(),item,question.id]);
  await mkdir("generated-artifacts/status-list-refinement",{recursive:true});
  browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",headless:true,args:["--no-sandbox"]});
  const context=await browser.newContext({baseURL,storageState:await api.storageState(),viewport:{width:1440,height:1000}});
  const page=await context.newPage();const errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/");
  await page.evaluate("window.__name = value => value");
  await page.evaluate(async ({campaignId,contactId,questionId})=>{
    const builderSource=await(await fetch("/src/components/campaign-status-list-builder.tsx")).text();
    const mainSource=await(await fetch("/src/main.tsx")).text();
    const reactPath=builderSource.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/)?.[1];
    const queryPath=builderSource.match(/from\s+["']([^"']*tanstack_react-query\.js[^"']*)["']/)?.[1];
    const domPath=mainSource.match(/from\s+["']([^"']*react-dom_client\.js[^"']*)["']/)?.[1];
    if(!reactPath||!queryPath||!domPath)throw Error("Vite modules not found");
    const [react,dom,query,{queryClient},{I18nProvider},{CampaignStatusListBuilder},{useStatusListActionRecap}]=await Promise.all([
      import(reactPath),import(domPath),import(queryPath),import("/src/lib/queryClient.ts"),
      import("/src/i18n/I18nProvider.tsx"),import("/src/components/campaign-status-list-builder.tsx"),import("/src/components/use-status-list-action-recap.tsx")]);
    const React=react.default??react;
    const createRoot=dom.createRoot??dom.default.createRoot;
    const mount=document.createElement("div");document.body.replaceChildren(mount);
    (window as any).__refinementMount=mount;
    function Harness() {
      const recap=useStatusListActionRecap({campaignId,contactId,locale:"en",items:[],mode:"batch"});
      return React.createElement(React.Fragment,null,React.createElement(CampaignStatusListBuilder,{campaignId}),recap.dialog,
        React.createElement("button",{"data-testid":"fixture-open-recap",onClick:()=>void recap.confirm([{kind:"question",id:questionId,value:true}],true)},"Fixture action recap"));
    }
    createRoot(mount).render(React.createElement(query.QueryClientProvider,{client:queryClient},React.createElement(I18nProvider,null,React.createElement(Harness))));
  },{campaignId:mission,contactId:contact,questionId:question.id});
  await page.getByTestId("status-list-workspace").waitFor();
  const nav=page.locator(".slw-tabs");
  assert.match(await nav.locator("button").last().textContent()||"",/preview/i);
  await page.getByTestId("status-list-toggle-fullscreen").click();
  await page.getByTestId("btn-toggle-preview").click();
  await page.getByTestId("status-list-agent-preview-modal").waitFor();
  await page.keyboard.press("Escape");
  await page.getByTestId("status-list-agent-preview-modal").waitFor({state:"hidden"});
  await page.keyboard.press("Escape");
  await page.waitForFunction(()=>document.querySelector('[data-testid="status-list-workspace"]')?.getAttribute("data-fullscreen")==="false");
  // Select the actual outline row by its saved label, without depending on internal editor-stage markup.
  await page.locator(".slw-tree").getByText("Synthetic heading",{exact:true}).click();
  await page.getByTestId(`status-list-expand-${item}`).click();
  await page.getByTestId(`status-list-question-row-${question.id}`).getByText("Synthetic first choice",{exact:true}).click();
  const preview=page.getByTestId("status-list-live-question-preview");
  await preview.waitFor();
  const choice=preview.getByRole("button",{name:"Synthetic first choice",exact:true});
  await choice.waitFor();assert.equal(await choice.locator("svg").count(),1);
  await choice.click();
  await page.locator(".slqs-stages button").filter({hasText:/Answer/}).click();
  await page.getByTestId("status-list-question-group").selectOption("__create__");
  await page.getByTestId("status-list-new-group-name").fill("New appointments");
  await page.getByTestId("status-list-create-group").click();
  await page.getByTestId("status-list-question-save").click();
  await page.getByText("All changes saved",{exact:true}).first().waitFor();
  await page.getByTestId(`status-list-question-row-${second.id}`).getByRole("button").first().click();
  await page.locator(".slqs-stages button").filter({hasText:/Answer/}).click();
  assert.equal(await page.getByTestId("status-list-question-group").locator('option[value="New appointments"]').count(),1);
  await page.screenshot({path:"generated-artifacts/status-list-refinement/editor-desktop.jpg"});
  await page.getByTestId("status-list-tab-rules").click();
  const bg=page.getByTestId("status-list-background-sources");
  await bg.getByRole("button",{name:"Configure source",exact:true}).click();
  await bg.getByTestId("status-list-source-editor").waitFor();
  await bg.getByTestId("status-list-create-source-target").click();
  await bg.getByTestId("background-source-question").locator("option").filter({hasText:/Representative/}).last().waitFor({state:"attached"});
  await bg.getByTestId("source-editor-stage-review").click();
  await bg.getByTestId("source-editor-save").click();
  await bg.getByTestId("status-list-source-editor").waitFor({state:"hidden"});
  const optionsPanel=page.getByTestId("status-list-option-source-panel");
  await optionsPanel.getByRole("button",{name:"Configure option source",exact:true}).click();
  await optionsPanel.getByTestId("status-list-source-editor").waitFor();
  await optionsPanel.getByTestId("status-list-create-source-target").click();
  await optionsPanel.getByTestId("source-editor-stage-review").click();
  await optionsPanel.getByTestId("source-editor-save").click();
  await optionsPanel.getByTestId("status-list-source-editor").waitFor({state:"hidden"});
  await page.screenshot({path:"generated-artifacts/status-list-refinement/sources-desktop.jpg"});
  await page.setViewportSize({width:390,height:844});
  await page.getByTestId("btn-toggle-preview").click();
  const modal=page.getByTestId("status-list-agent-preview-modal");await modal.waitFor();
  await page.waitForTimeout(300);
  const bounds=await modal.boundingBox();assert.ok(bounds&&bounds.width<=390,"preview fits phone");
  await page.screenshot({path:"generated-artifacts/status-list-refinement/preview-mobile.jpg"});
  await page.keyboard.press("Escape");
  await page.getByTestId("fixture-open-recap").click();
  await page.getByTestId("status-list-recap-confirm").waitFor();
  await page.waitForFunction(()=>!(document.querySelector('[data-testid="status-list-recap-confirm"]') as HTMLButtonElement)?.disabled);
  assert.equal(await page.getByTestId("status-list-action-recap").locator("article").count(),1);
  await page.waitForTimeout(300);
  await page.screenshot({path:"generated-artifacts/status-list-refinement/recap-mobile.jpg"});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:"generated-artifacts/status-list-refinement/recap-desktop.jpg"});
  await page.getByRole("button",{name:"Cancel",exact:true}).click();
  assert.equal((await pool.query("SELECT count(*) FROM mission_status_list_answers WHERE campaign_contact_id=$1 AND question_id=$2",[contact,question.id])).rows[0].count,"0");
  assert.deepEqual(errors,[]);
  await context.close();
  console.log("Editor refinement passed: scoped compatible targets, both source families, grouped rule persistence, real builder modal navigation, reusable groups and live control preview.");
} catch (error) {
  const pages=browser?.contexts().flatMap(context=>context.pages()) || [];
  if(pages.length) {
    await pages[pages.length-1].screenshot({path:"generated-artifacts/status-list-refinement/failure.jpg"}).catch(()=>{});
    console.error((await pages[pages.length-1].locator("body").innerText()).slice(-2400));
  }
  throw error;
} finally {
  await browser?.close();await api.dispose();await other.dispose();
  await pool.query("DELETE FROM campaign_contact_history WHERE campaign_contact_id=$1",[contact]);
  await pool.query("DELETE FROM campaign_contacts WHERE id=$1",[contact]);
  await pool.query("DELETE FROM campaigns WHERE id=ANY($1::varchar[])",[[mission,otherMission]]);
  await pool.query("DELETE FROM clinics WHERE id=$1",[clinic]);
  await pool.query("DELETE FROM user_sessions WHERE user_id=ANY($1::varchar[])",[[user,outsider]]).catch(()=>{});
  await pool.query("DELETE FROM users WHERE id=ANY($1::varchar[])",[[user,outsider]]);
  await pool.end();
}
