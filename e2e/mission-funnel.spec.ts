import { test, expect, type Page } from "@playwright/test";
import { computeMissionFunnel } from "../server/lib/mission-funnel";
import { emptyFunnelConfig, funnelSources } from "../shared/mission-funnel";

const config = emptyFunnelConfig();
for (const key of funnelSources) config.sources[key] = [key];
const computed = computeMissionFunnel({
  clinics: [{id:"clinic-a",name:"Clinic Aurora",representativeId:"rep",referred:true}],
  enrollments: [{id:"contact",clinicId:"clinic-a"}], items:funnelSources.map(key=>({id:key,stepId:key,label:`Source ${key}`,parentId:null})),config,
  calls:[{id:"call",clinicId:"clinic-a",contactId:"contact",direction:"outbound",status:"completed",at:"2026-09-01T10:00:00Z",answeredAt:"2026-09-01T10:00:10Z",duration:30}],
  states:["qualified","agreed","proposalAccepted","validated"].map(itemId=>({contactId:"contact",itemId,at:"2026-09-02T10:00:00Z"})),
  events:["qualified","agreed","proposalAccepted","validated"].map((itemId,index)=>({id:`event-${index}`,contactId:"contact",itemId,confirmed:true,at:`2026-09-0${index+2}T10:00:00Z`})),
});
const report={...computed,missionName:"Medical Partner Cooperation",canConfigure:true,dateQuestions:[{id:"return-date",label:"Return date"}]};
async function fixture(page:Page, {readonly=false,error=false,dark=false,data=report}={}) {
  const calls: {url:string;method:string;body:any}[]=[];
  const errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/api/**",async route=>{
    const request=route.request(),url=new URL(request.url());
    calls.push({url:url.pathname+url.search,method:request.method(),body:request.postDataJSON()});
    if(url.pathname.endsWith("/config")) return route.fulfill({json:{success:true}});
    if(url.pathname.endsWith("/mission-funnel")) return route.fulfill(error ? {status:500,json:{error:"Unavailable"}} : {json:{...data,canConfigure:!readonly}});
    return route.fulfill({json:{}});
  });
  await page.goto(`/test-fixtures/mission-funnel.html${dark?"?dark":""}`);
  return {calls,errors};
}
test("real report renders all milestones and separates inferred evidence in clinic details",async({page})=>{
  const {errors}=await fixture(page);
  await expect(page.getByRole("heading",{name:"Mission funnel",exact:true})).toBeVisible();
  await expect(page.getByText(/Clinic-level conversion evidence.*Medical Partner Cooperation/)).toBeVisible();
  const rows=page.locator("tbody tr");
  await expect(rows).toHaveCount(15);
  const email=page.getByTestId("mission-funnel-step-email");
  await email.getByRole("button").click();
  await expect(page.getByText("Clinic Aurora",{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});
test("referral filter is sent to server and a failed report has a retry path",async({page})=>{
  const state=await fixture(page);
  await expect(page.getByRole("heading",{name:"Mission funnel",exact:true})).toBeVisible();
  await page.getByTestId("mission-funnel-referral").selectOption("yes");
  await expect.poll(()=>state.calls.some(c=>c.url.includes("referral=yes"))).toBe(true);
  await page.route("**/api/campaigns/*/mission-funnel?**",route=>route.fulfill({status:500,json:{error:"Unavailable"}}));
  await page.getByTestId("mission-funnel-referral").selectOption("no");
  await expect(page.getByRole("button",{name:/Retry/})).toBeVisible();
});
test("read-only role does not expose configuration writes",async({page})=>{
  const {calls}=await fixture(page,{readonly:true});
  await expect(page.getByRole("heading",{name:"Mission funnel",exact:true})).toBeVisible();
  await expect(page.getByText("Configure sources",{exact:true})).toHaveCount(0);
  expect(calls.every(c=>c.method==="GET")).toBe(true);
});
test("mapping save performs only the dedicated config PUT",async({page})=>{
  const {calls}=await fixture(page);
  await expect(page.getByRole("heading",{name:"Mission funnel",exact:true})).toBeVisible();
  await page.getByTestId("mission-funnel-config-expand").click();
  await page.getByTestId("mission-funnel-config-save").click();
  await expect.poll(()=>calls.filter(c=>c.method==="PUT").length).toBe(1);
  expect(calls.filter(c=>c.method!=="GET").map(c=>c.url)).toEqual(["/api/campaigns/fixture-mission/mission-funnel/config"]);
  expect(calls.find(c=>c.method==="PUT")!.body.version).toBe(1);
});
test("mobile dark report remains usable without document-level horizontal overflow",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const {errors}=await fixture(page,{dark:true});
  await expect(page.getByRole("heading",{name:"Mission funnel",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.screenshot({path:"generated-artifacts/mission-funnel/mobile-dark.jpg",fullPage:true});
  expect(errors).toEqual([]);
});
test("period picker permits past years and sends the full date; missing sources remain unmeasured",async({page})=>{
  const {calls}=await fixture(page);
  const from=page.getByTestId("mission-funnel-from-wrapper");
  await from.getByTestId("input-create-task-duedate-year").selectOption("2025");
  await expect.poll(()=>calls.some(c=>c.url.includes("from=2025-"))).toBe(true);
  await from.getByRole("button").click();
  await expect.poll(()=>calls.at(-1)!.url.includes("from=")).toBe(false);
});
test("graphical funnel matches all 15 table counts and opens evidence using the keyboard without writes",async({page})=>{
  const {calls,errors}=await fixture(page);
  const chart=page.getByTestId("mission-funnel-chart");
  await expect(chart).toBeVisible();
  for(const row of report.rows) {
    await expect(chart.getByTestId(`mission-funnel-chart-step-${row.key}`))
      .toHaveAttribute("data-value",row.total===null?"unmeasured":String(row.total));
  }
  const email=chart.getByTestId("mission-funnel-chart-step-email");
  await expect(email).toHaveAttribute("aria-label",/Inferred: 1/);
  await email.focus();
  await email.press("Enter");
  await expect(email).toHaveAttribute("aria-pressed","true");
  await expect(page.getByText("Clinic Aurora",{exact:true})).toBeVisible();
  expect(calls.every(call=>call.method==="GET")).toBe(true);
  expect(errors).toEqual([]);
});
test("graph preserves varying and increasing counts, separates current and branch counts, and keeps zero distinct from unknown",async({page})=>{
  const counts: Record<string,number|null> = {
    assigned:500,dialed:100,connected:70,qualified:50,agreed:45,wantsContract:30,
    withoutContract:15,email:20,wantsToSign:24,sent:12,received:0,returned:null,
    validated:null,cooperating:34,materials:null,
  };
  const data={...report,rows:report.rows.map(row=>({...row,total:counts[row.key],direct:counts[row.key],inferred:counts[row.key]===null?null:0}))};
  const {errors}=await fixture(page,{data});
  const chart=page.getByTestId("mission-funnel-chart");
  await expect(chart).toBeVisible();
  for(const row of data.rows){
    await expect(chart.getByTestId(`mission-funnel-chart-step-${row.key}`))
      .toHaveAttribute("data-value",row.total===null?"unmeasured":String(row.total));
  }
  await expect(chart.getByTestId("mission-funnel-chart-step-received")).toContainText("0");
  await expect(chart.getByTestId("mission-funnel-chart-step-returned")).toContainText("Unmeasured");
  await chart.scrollIntoViewIfNeeded();
  await page.screenshot({path:"generated-artifacts/mission-funnel/chart-desktop.jpg",fullPage:false});
  expect(errors).toEqual([]);
});
test("all-zero and all-unmeasured charts render without invalid SVG geometry",async({page})=>{
  for(const value of [0,null]){
    const data={...report,rows:report.rows.map(row=>({...row,total:value,direct:value,inferred:value}))};
    const {errors}=await fixture(page,{data,dark:true});
    const chart=page.getByTestId("mission-funnel-chart");
    await expect(chart).toBeVisible();
    expect(await chart.locator("svg").evaluateAll(svgs=>svgs.every(svg=>!/(NaN|Infinity)/.test(svg.outerHTML)))).toBe(true);
    expect(errors).toEqual([]);
  }
});
