import { test, expect, type Page } from "@playwright/test";
import { computeMissionFunnel } from "../server/lib/mission-funnel";
import { emptyFunnelConfig, funnelSources } from "../shared/mission-funnel";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";

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
async function fixture(page:Page, {readonly=false,error=false,dark=false,data=report,locale="en"}={}) {
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
  await page.goto(`/test-fixtures/mission-funnel.html?locale=${locale}${dark?"&dark":""}`);
  return {calls,errors};
}
for (const locale of ["en", "sk", "de"]) {
  test(`export scope stays inline and toolbar aligns in ${locale}`, async ({ page }) => {
    await fixture(page, { locale });
    const toolbar = page.getByTestId("mission-funnel-export-toolbar");
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 800 });
      const layout = await toolbar.evaluate(element => {
        const select = element.querySelector("select")!.getBoundingClientRect();
        const text = element.querySelector("label span")!.getBoundingClientRect();
        const buttons = Array.from(element.querySelectorAll("button")).map(button => button.getBoundingClientRect());
        return { select: { y: select.y, height: select.height }, text: { y: text.y, height: text.height },
          buttons: buttons.map(button => ({ y: button.y, height: button.height })),
          overflow: document.documentElement.scrollWidth > innerWidth };
      });
      expect(Math.abs(layout.text.y + layout.text.height / 2 - layout.select.y - layout.select.height / 2)).toBeLessThan(2);
      expect(layout.overflow).toBe(false);
      if (width === 1280)
        for (const button of layout.buttons) {
          expect(Math.abs(button.y - layout.select.y)).toBeLessThan(2);
          expect(button.height).toBe(layout.select.height);
        }
    }
  });
}
test("read-only users download filtered funnel CSV and a real Excel workbook", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-30T12:00:00Z") });
  const { calls, errors } = await fixture(page, { readonly: true });
  await page.getByTestId("reporting-preset-lastMonth").click();
  await page.getByTestId("mission-funnel-referral").selectOption("yes");
  await expect(page.getByTestId("mission-funnel-export")).toBeEnabled();
  await expect(page.getByTestId("mission-funnel-export-csv")).toHaveCount(0);
  await page.getByTestId("mission-funnel-export").click();
  const csvDownload = page.waitForEvent("download");
  await page.getByTestId("mission-funnel-export-csv").click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toContain("2026-09-01_2026-09-30_yes.csv");
  const content = await readFile((await csv.path())!, "utf8");
  expect(content).toContain("Clinic Aurora");
  expect(content).toContain("Europe/Bratislava");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByTestId("mission-funnel-export").click();
  const xlsxDownload = page.waitForEvent("download");
  await page.getByTestId("mission-funnel-export-xlsx").click();
  const excel = await xlsxDownload;
  expect(excel.suggestedFilename()).toContain("2026-09-01_2026-09-30_yes.xlsx");
  const workbook = XLSX.read(await readFile((await excel.path())!));
  expect(workbook.SheetNames).toHaveLength(20);
  expect(calls.every(call => call.method === "GET")).toBe(true);
  expect(errors).toEqual([]);
});
test("compact export menu supports keyboard dismissal and small-screen selection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await fixture(page, { dark: true });
  const trigger = page.getByTestId("mission-funnel-export");
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  const menu = await page.getByRole("menu").boundingBox();
  expect(menu!.x).toBeGreaterThanOrEqual(0);
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "generated-artifacts/mission-funnel/export-menu-mobile.jpg" });
  expect(errors).toEqual([]);
});

test("a selected step downloads every clinic with typed readable dates and no clinic IDs", async ({ page }) => {
  const { errors } = await fixture(page);
  await page.getByTestId("mission-funnel-export-step").selectOption("cooperating");
  await page.getByTestId("mission-funnel-export").click();
  const waiting = page.waitForEvent("download");
  await page.getByTestId("mission-funnel-export-xlsx").click();
  const file = await waiting;
  expect(file.suggestedFilename()).toContain("_cooperating.xlsx");
  const workbook = XLSX.read(await readFile((await file.path())!), { cellNF: true });
  expect(workbook.SheetNames).toHaveLength(3);
  const evidence = workbook.Sheets[workbook.SheetNames[2]];
  const rows = XLSX.utils.sheet_to_json(evidence, { header: 1 }) as unknown[][];
  expect(JSON.stringify(rows)).not.toContain("Clinic ID");
  expect(rows.length).toBeGreaterThan(1);
  expect(evidence.C2.t).toBe("n");
  expect(evidence.C2.z).toBe("dd.mm.yyyy hh:mm:ss");
  expect(errors).toEqual([]);
});
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

test("assigned cohort is a count card rather than a full conversion bar", async ({ page }) => {
  const { errors } = await fixture(page);
  const assigned = page.getByTestId("mission-funnel-chart-step-assigned");
  await expect(assigned).toBeVisible();
  await expect(assigned).toHaveAttribute("data-value", "1");
  await expect(assigned.locator("svg rect, svg path, svg line")).toHaveCount(0);
  await expect(assigned).not.toContainText("100%");
  await assigned.click();
  await expect(page.getByText("Clinic Aurora", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("focused mapping retains choices across tabs, search, removal and save", async ({ page }) => {
  const { calls, errors } = await fixture(page);
  await page.getByTestId("mission-funnel-config-expand").click();
  const mapping = page.getByTestId("mission-funnel-mapping");
  await expect(mapping.getByRole("tab")).toHaveCount(4);
  await expect(mapping.locator('[data-testid^="mapping-source-"]')).toHaveCount(1);
  await mapping.getByRole("textbox").fill("Source sent");
  await mapping.getByTestId("mapping-item-sent").click();
  await expect(mapping.getByTestId("mapping-remove-sent")).toBeVisible();
  await mapping.getByTestId("mapping-tab-contract").click();
  await mapping.getByTestId("mission-funnel-source-select-validated").click();
  await expect(mapping.getByTestId("mapping-remove-validated")).toBeVisible();
  await mapping.getByTestId("mapping-tab-contact").click();
  await expect(mapping.getByTestId("mapping-remove-sent")).toBeVisible();
  await mapping.getByTestId("mapping-remove-qualified").click();
  await mapping.getByTestId("mapping-tab-exceptions").click();
  await mapping.locator("#mission-funnel-absence-return-question").selectOption("return-date");
  await mapping.getByTestId("mission-funnel-config-save").click();
  await expect.poll(() => calls.filter(call => call.method === "PUT").length).toBe(1);
  const body = calls.find(call => call.method === "PUT")!.body;
  expect(body.sources.qualified).toEqual(["sent"]);
  expect(body.sources.validated).toEqual(["validated"]);
  expect(body.sources.activeWith).toEqual(["activeWith"]);
  expect(body.absenceReturnQuestionId).toBe("return-date");
  expect(calls.filter(call => call.method !== "GET").map(call => call.url))
    .toEqual(["/api/campaigns/fixture-mission/mission-funnel/config"]);
  await mapping.getByRole("textbox").fill("");
  await mapping.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "generated-artifacts/mission-funnel/mapping-desktop.jpg" });
  expect(errors).toEqual([]);
});

test("mapping tabs support keyboard navigation and mobile dark layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await fixture(page, { dark: true });
  await page.getByTestId("mission-funnel-config-expand").click();
  const mapping = page.getByTestId("mission-funnel-mapping");
  await mapping.getByTestId("mapping-tab-contact").focus();
  await page.keyboard.press("ArrowRight");
  await expect(mapping.getByTestId("mapping-tab-contract")).toHaveAttribute("aria-selected", "true");
  await expect(mapping.getByTestId("mapping-source-proposalAccepted")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await mapping.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "generated-artifacts/mission-funnel/mapping-mobile-dark.jpg" });
  expect(errors).toEqual([]);
});

test("read-only funnel manual explains every stage, source and quality measure without writes", async ({ page }) => {
  const { calls, errors } = await fixture(page, { readonly: true });
  const trigger = page.getByTestId("mission-funnel-help");
  await trigger.click();
  const dialog = page.getByTestId("mission-funnel-help-dialog");
  const content = page.getByTestId("mission-funnel-help-content");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-help-chapter-nav] button")).toHaveCount(10);
  await dialog.getByTestId("mission-funnel-help-chapter-contact-contract").click();
  await expect(content.locator("dl > div")).toHaveCount(15);
  await dialog.getByTestId("mission-funnel-help-chapter-sources").click();
  await expect(content.locator("dl > div")).toHaveCount(19);
  await dialog.getByTestId("mission-funnel-help-chapter-exceptions-quality").click();
  await expect(content.locator("[data-quality-key]")).toHaveCount(8);
  await dialog.getByTestId("mission-funnel-help-chapter-combined").click();
  await expect(content).toContainText("poster");
  await page.screenshot({ path: "generated-artifacts/mission-funnel/manual-desktop.jpg" });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(calls.every(call => call.method === "GET")).toBe(true);
  expect(errors).toEqual([]);
});

test("context help opens exact chapter and supports keyboard chapter changes", async ({ page }) => {
  const { calls, errors } = await fixture(page);
  const dialog = page.getByTestId("mission-funnel-help-dialog");
  for (const chapter of ["contact-contract", "without-contract", "combined"]) {
    await page.getByTestId(`mission-funnel-help-context-${chapter}`).click();
    await expect(dialog.getByTestId(`mission-funnel-help-chapter-${chapter}`)).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
  }
  await page.getByTestId("mission-funnel-config-expand").click();
  await page.getByTestId("mission-funnel-help-context-configuration").click();
  const current = dialog.getByTestId("mission-funnel-help-chapter-configuration");
  await expect(current).toHaveAttribute("aria-current", "page");
  await current.focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByTestId("mission-funnel-help-chapter-sources")).toBeFocused();
  expect(calls.every(call => call.method === "GET")).toBe(true);
  expect(errors).toEqual([]);
});

test("manual works during report failure and on a short dark mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 667 });
  const { errors } = await fixture(page, { error: true, dark: true, locale: "sk" });
  await page.getByTestId("mission-funnel-help").click();
  const dialog = page.getByTestId("mission-funnel-help-dialog");
  await expect(dialog).toBeVisible();
  const select = dialog.getByTestId("mission-funnel-help-mobile-chapter");
  await select.selectOption("combined");
  const content = dialog.getByTestId("mission-funnel-help-content");
  await expect(content).toContainText(/plagát/i);
  await expect(content.locator("h3")).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(668);
  expect(await content.evaluate(element => element.clientHeight)).toBeGreaterThan(150);
  await page.screenshot({ path: "generated-artifacts/mission-funnel/manual-mobile-dark.jpg" });
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("manual reads in every supported language", async ({ page }) => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
    const { errors } = await fixture(page, { locale, readonly: true });
    await page.getByTestId("mission-funnel-help").click();
    const dialog = page.getByTestId("mission-funnel-help-dialog");
    await dialog.getByTestId("mission-funnel-help-chapter-evidence").click();
    await expect(page.getByTestId("mission-funnel-help-content").locator("p").nth(1)).not.toBeEmpty();
    if (locale !== "en") await expect(dialog).not.toContainText("First date is the earliest direct attainment");
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  }
});
