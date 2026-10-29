import { test, expect } from "@playwright/test";
import { agreementWorkspaceTranslations } from "../client/src/i18n/agreement-workspace-translations";
const wx=agreementWorkspaceTranslations.en;

const original = [
  { id:"a1",groupId:"a1",version:2,title:"Cooperation agreement",contractNumber:"SK-1",validFrom:"2020-01-01",validTo:"2099-12-31",active:true,endedAt:null,fileName:"agreement.pdf",contentType:"application/pdf",fileSize:1024,createdAt:"2026-10-04T10:00:00Z",updatedAt:"2026-10-04T10:00:00Z",reason:"Renewal",createdByName:"Test administrator",archivedAt:null,fileDeletedAt:null,filePurgedAt:null},
  { id:"a0",groupId:"a1",version:1,title:"Cooperation agreement",contractNumber:"SK-1",validFrom:"2019-01-01",validTo:"2019-12-31",active:false,endedAt:null,fileName:"original.docx",contentType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",fileSize:2048,createdAt:"2026-10-01T10:00:00Z",updatedAt:"2026-10-01T10:00:00Z",reason:null,createdByName:"Test administrator",archivedAt:null,fileDeletedAt:null,filePurgedAt:null},
];
async function fixture(page:any,params="",rejectUpload=false) {
  const errors:string[]=[],writes:any[]=[];
  let rows:any[]=structuredClone(original);
  page.on("pageerror",(e:Error)=>errors.push(e.message));
  await page.route("**/api/**",async(route:any)=>{
    const req=route.request(),url=new URL(req.url()),p=url.pathname;
    if(p==="/api/auth/me")return route.fulfill({json:{user:{id:"fixture-agent",role:"admin",assignedCountries:["SK"]}}});
    if(p.endsWith("/record-activity"))return route.fulfill({json:{events:[{id:"evt",action:"agreement_version_added",module:"Healthcare Network",actor:"Test administrator",createdAt:"2026-10-04T10:00:00Z",details:{title:"Cooperation agreement",reason:"Renewal",version:2}}],nextCursor:null}});
    if(p.endsWith("/preview"))return route.fulfill({body:"%PDF-1.4\nfixture",contentType:"application/pdf"});
    if(p.endsWith("/download"))return route.fulfill({body:"%PDF-1.4\nfixture",headers:{"content-type":"application/pdf","content-disposition":'attachment; filename="agreement.pdf"'}});
    if(p.includes("/agreements")){
      if(req.method()==="GET")return route.fulfill({json:{agreements:rows,canManage:!params.includes("readonly"),canDelete:!params.includes("readonly")}});
      writes.push({method:req.method(),path:p,body:req.postData()});
      if(req.method()==="POST"&&p.endsWith("/agreements"))return route.fulfill({status:rejectUpload?400:201,json:rejectUpload?{error:"Rejected"}:original[0]});
      const id=p.split("/agreements/")[1]?.split("/")[0],row=rows.find(r=>r.id===id);
      if(req.method()==="PATCH"){Object.assign(row,req.postDataJSON());return route.fulfill({json:row});}
      if(p.endsWith("/file")){Object.assign(row,{fileDeletedAt:new Date().toISOString(),filePurgedAt:new Date().toISOString(),fileDeleteReason:req.postDataJSON().reason});return route.fulfill({status:204});}
      if(p.endsWith("/archive")){rows=rows.map(r=>({...r,archivedAt:new Date().toISOString(),active:false}));return route.fulfill({status:204});}
    }
    if(p.includes("settings"))return route.fulfill({json:{}});
    return route.fulfill({json:[]});
  });
  await page.goto("/test-fixtures/clinic-agreements.html"+params);
  await page.getByRole("button",{name:"Agreements",exact:true}).click();
  const panel=page.getByTestId(params.includes("hospital")?"hospital-agreements-panel":"clinic-agreements-panel");
  await expect(panel.getByText("agreement.pdf",{exact:true}).first()).toBeVisible();
  return {errors,writes,panel};
}
test("native clinic drawer: timelines, metadata save and genuine modal preview",async({page})=>{
  const state=await fixture(page);
  await expect(state.panel.getByText("v2",{exact:true}).first()).toBeVisible();
  await state.panel.getByRole("button",{name:/v1.*original.docx/}).click();
  await expect(state.panel.getByText("original.docx",{exact:true}).last()).toBeVisible();
  await state.panel.getByRole("button",{name:"Edit details",exact:true}).click();
  await state.panel.getByLabel("Agreement title",{exact:true}).fill("Updated agreement");
  await state.panel.getByRole("button",{name:"Save changes",exact:true}).click();
  await expect.poll(()=>state.writes.length).toBe(1);
  expect(JSON.parse(state.writes[0].body).title).toBe("Updated agreement");
  await state.panel.getByRole("button",{name:"Preview",exact:true}).first().click();
  const dialog=page.getByRole("dialog");
  await expect(dialog.locator("iframe")).toBeVisible();
  expect(await dialog.locator("iframe").getAttribute("src")).toMatch(/^blob:.*#zoom=page-fit/);
  const width=await dialog.evaluate(el=>el.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(page.viewportSize()!.width * .9);
  await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);
  expect(state.errors).toEqual([]);
});
test("reason-required purge retains audit; archive is a separate action",async({page})=>{
  const state=await fixture(page,"?sheet");
  await state.panel.getByRole("button",{name:wx.fileDelete,exact:true}).first().click();
  let dialog=page.getByRole("dialog").last();
  const submit=dialog.getByRole("button",{name:wx.fileDeleteConfirm,exact:true});
  await expect(submit).toBeDisabled();
  await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
  expect(state.writes).toEqual([]);
  await state.panel.getByRole("button",{name:wx.fileDelete,exact:true}).first().click();
  dialog=page.getByRole("dialog").last();
  await dialog.locator("textarea").fill("Duplicate scan");
  await dialog.getByRole("button",{name:wx.fileDeleteConfirm,exact:true}).click();
  await expect.poll(()=>state.writes.length).toBe(1);
  await expect(state.panel.getByRole("button",{name:"Preview",exact:true})).toHaveCount(0);
  await expect(state.panel.getByText("agreement.pdf",{exact:true}).first()).toBeVisible();
  await state.panel.getByRole("button",{name:"Archive agreement",exact:true}).click();
  dialog=page.getByRole("dialog").last();await dialog.locator("textarea").fill("Superseded contract");
  await dialog.getByRole("button",{name:"Archive agreement",exact:true}).click();
  await expect.poll(()=>state.writes.length).toBe(2);
  await state.panel.getByRole("button",{name:/^Archive/}).click();
  await expect(state.panel.getByText("agreement.pdf",{exact:true}).first()).toBeVisible();
  expect(state.errors).toEqual([]);
});
test("version form explains missing reason and successfully submits after correction",async({page})=>{
  const state=await fixture(page,"?sheet");
  await state.panel.getByRole("button",{name:"New version",exact:true}).click();
  const dialog=page.getByRole("dialog").last();
  await dialog.getByRole("checkbox").check();
  await dialog.locator('input[type="file"]').setInputFiles({name:"signed.docx",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",buffer:Buffer.from("document fixture")});
  const save=dialog.getByRole("button",{name:"Save version",exact:true});
  await expect(save).toBeEnabled();
  await save.click();
  await expect(dialog.getByRole("alert")).toHaveText(wx.reasonRequired!);
  await expect(dialog.locator("textarea")).toBeFocused();
  expect(state.writes).toHaveLength(0);
  await dialog.locator("textarea").fill("New signed version");
  await save.click();
  await expect(page.getByRole("dialog",{name:wx.versionTitle})).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toContain('name="parentId"');
  expect(state.writes[0].body).toContain('New signed version');
  expect(state.errors).toEqual([]);
});
test("upload failure preserves version draft and never submits parent record",async({page})=>{
  const state=await fixture(page,"?sheet",true);
  await state.panel.getByRole("button",{name:"New version",exact:true}).click();
  const dialog=page.getByRole("dialog").last();
  await dialog.getByLabel("Agreement title *",{exact:true}).fill("Version draft");
  await dialog.getByRole("checkbox").check();
  await dialog.locator("textarea").fill("New signed version");
  await dialog.locator('input[type="file"]').setInputFiles({name:"new.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4")});
  await dialog.getByRole("button",{name:"Save version",exact:true}).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("Agreement title *",{exact:true})).toHaveValue("Version draft");
  expect(state.writes).toHaveLength(1);expect(state.writes[0].path).toMatch(/\/agreements$/);
  expect(state.writes[0].body).toContain('name="parentId"');expect(state.errors).toEqual([]);
});
test("read-only Pulse card retains preview/download and shared activity without writes",async({page})=>{
  const state=await fixture(page,"?readonly");
  await expect(state.panel.getByRole("button",{name:"Add agreement",exact:true})).toHaveCount(0);
  await expect(state.panel.getByRole("button",{name:wx.fileDelete,exact:true})).toHaveCount(0);
  await expect(state.panel.getByRole("link",{name:"Download",exact:true}).first()).toBeVisible();
  await page.getByRole("button",{name:"Record activity",exact:true}).click();
  const dialog=page.getByRole("dialog").last();
  await expect(dialog.getByText("Test administrator",{exact:false})).toBeVisible();
  await dialog.getByRole("button",{name:/Test administrator/}).click();
  await expect(dialog.getByText("Renewal",{exact:true})).toBeVisible();
  expect(state.writes).toEqual([]);expect(state.errors).toEqual([]);
});
test("hospital Agreements loads real workspace and exposes record activity",async({page})=>{
  const state=await fixture(page,"?hospital");
  await expect(state.panel.getByText("Cooperation agreement",{exact:true}).first()).toBeVisible();
  await page.getByRole("button",{name:"Record activity",exact:true}).click();
  await expect(page.getByRole("dialog").last().getByText("Test administrator",{exact:false})).toBeVisible();
  expect(state.errors).toEqual([]);
});
test("activity uses colored readable actions, resolved Mission names and translated changes",async({page})=>{
  const state=await fixture(page,"?readonly");
  await page.route("**/record-activity**",route=>route.fulfill({json:{events:[
    {id:"event-1",action:"status_list_action",module:"Nexus Pulse",actor:"Test administrator",createdAt:"2026-10-29T08:45:00Z",details:{actionType:"set_callback",campaignId:"301a0f6d-2eea-475b-811f-a59bc90bb83d",campaignName:"Patient support",callbackDate:"2026-10-30T08:00:00Z"}},
    {id:"event-2",action:"agreement_updated",module:"Nexus Pulse",actor:"Test administrator",createdAt:"2026-10-29T08:30:00Z",details:{before:{title:"Original contract",active:true},after:{title:"Signed contract",active:false},version:2}},
    {id:"event-3",action:"status_list_background",module:"Nexus Pulse",actor:null,createdAt:"2026-10-29T08:00:00Z",details:{campaignName:"Patient support"}}
  ],nextCursor:null}}));
  await page.getByRole("button",{name:"Record activity",exact:true}).click();
  const dialog=page.getByRole("dialog").last();
  await expect(dialog.getByRole("button",{name:/Background automation ran/})).toBeVisible();
  for(const button of await dialog.locator("button[aria-expanded]").all())await button.click();
  await expect(dialog.getByText("Patient support",{exact:true}).first()).toBeVisible();
  await expect(dialog.getByText("Before: Yes · After: No",{exact:true})).toBeVisible();
  expect(await dialog.innerText()).not.toMatch(/campaignId|301a0f6d|status_list_|validFrom/);
  await page.screenshot({path:"generated-artifacts/agreement-history-light.png"});
  await page.evaluate(()=>document.documentElement.classList.add("dark"));
  await page.screenshot({path:"generated-artifacts/agreement-history-dark.png"});
  expect(state.errors).toEqual([]);
});
test("mobile dark drawer fits the screen and keeps upload modal reachable",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem("theme","dark"));
  const state=await fixture(page);
  await state.panel.getByRole("button",{name:"Add agreement",exact:true}).click();
  const bounds=await page.getByRole("dialog").last().boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(391);
  expect(state.errors).toEqual([]);
});
