import assert from "node:assert/strict";
import test from "node:test";
import {chromium,expect} from "@playwright/test";
import {createServer} from "vite";
import {getHealthcareManagementCopy} from "../client/src/components/status-list-healthcare-management-copy";
import {getHealthcareCopy} from "../client/src/components/status-list-healthcare-copy";
import {healthcareStates} from "../shared/status-list-healthcare";

test("healthcare controls create through Content, select the real group and confirm source removal",async()=>{
  const vite=await createServer({configFile:false,root:"client",cacheDir:"/tmp/indexus-healthcare-management-cache",
    resolve:{alias:{"@":`${process.cwd()}/client/src`,"@shared":`${process.cwd()}/shared`}},esbuild:{jsx:"automatic"},
    server:{host:"127.0.0.1",port:0},logLevel:"error"});
  await vite.listen();
  const {port}=vite.httpServer!.address() as {port:number};
  const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
  try {
    const page=await browser.newPage({viewport:{width:1100,height:900}});
    const errors:string[]=[];
    page.on("pageerror",error=>errors.push(error.message));
    let removed=0,hasSource=true,failRemove=false,created=0;
    const writes:string[]=[];
    await page.route("**/test-fixtures/healthcare-management.html*",route=>route.fulfill({contentType:"text/html",
      body:'<html><body><div id="root"></div><script type="module" src="/test-fixtures/status-list-healthcare.tsx"></script></body></html>'}));
    await page.route("**/api/**",async route=>{
      const url=new URL(route.request().url()),method=route.request().method();
      if(!["GET","HEAD"].includes(method))writes.push(`${method} ${url.pathname}`);
      let data:unknown=[];
      if(url.pathname.endsWith("/option-sources/group")&&method==="DELETE") {
        if(failRemove){await route.fulfill({status:409,contentType:"application/json",body:'{"error":"callback_configuration_not_independent"}'});return;}
        removed++;hasSource=false;data={ok:true};
      } else if(url.pathname.endsWith("/healthcare")&&method==="POST") {
        created++;hasSource=true;data={groupId:"group"};
      } else if(url.pathname.endsWith("/option-sources"))data={sources:hasSource?[{source:"healthcare_reachability",
        groupId:"group",hidden:true,mapping:Object.fromEntries(healthcareStates.map(state=>[state,`option-${state}`]))}]:[],
        catalog:[{id:"group",kind:"item",label:"Provider reachability",itemType:"step",confirmationType:"info"}]};
      else if(url.pathname.endsWith("/sources"))data={sources:[],catalog:[]};
      else if(url.pathname.endsWith("/status-list-workflows"))data={catalog:[],rules:[]};
      await route.fulfill({contentType:"application/json",body:JSON.stringify(data)});
    });
    const rules=()=>page.getByTestId("status-list-tab-rules").click();
    const open=()=>page.getByTestId("healthcare-open-content-group");
    const remove=()=>page.getByTestId("healthcare-remove-background-source-group");
    for(const locale of ["sk","en","cs","hu","ro","it","de"]) {
      const c=getHealthcareManagementCopy(locale);
      assert.ok(Object.values(c).every(value=>value.trim().length>0));
      await page.goto(`http://127.0.0.1:${port}/test-fixtures/healthcare-management.html?workspace&locale=${locale}`,{timeout:90000});
      await rules();
      await expect(page.getByTestId("healthcare-add-custom-question-group")).toBeVisible();
      await expect(open()).toHaveText(c.openContent);
      await expect(remove()).toBeVisible();
      await page.getByTestId("healthcare-add-custom-question-group").click();
      await expect(page.getByTestId("management-content-editor")).toHaveAttribute("data-creating","true");
      await expect(page.getByTestId("status-list-tab-content")).toHaveAttribute("aria-current","page");
      await rules();await open().click();
      await expect(page.getByTestId("management-content-editor")).toHaveAttribute("data-group","group");
    }
    assert.deepEqual(writes,[],"navigation and initial loading must not create or delete records");
    await rules();
    await page.getByTestId("healthcare-configured-source").getByRole("button").first().click();
    await page.getByTestId("healthcare-failed-attempts").fill("6");
    await expect(remove()).toBeDisabled();
    await expect(open()).toBeDisabled();
    await page.getByTestId("healthcare-source-settings").getByRole("button").filter({hasText:/Abbrechen/}).click();
    await expect(remove()).toBeEnabled();
    await remove().click();
    const dialog=page.getByRole("alertdialog").or(page.getByRole("dialog"));
    await expect(dialog).toContainText(getHealthcareManagementCopy("de").removeHelp);
    await dialog.getByRole("button").first().click();
    assert.equal(removed,0);
    failRemove=true;
    await remove().click();await dialog.getByRole("button").last().click();
    await expect(page.getByTestId("healthcare-configured-source")).toBeVisible();
    assert.equal(removed,0);
    failRemove=false;
    await remove().click();await dialog.getByRole("button").last().click();
    await expect(page.getByTestId("healthcare-configured-source")).toHaveCount(0);
    assert.equal(removed,1);
    assert.ok(writes.every(write=>write==="DELETE /api/campaigns/mission/status-list-workflows/option-sources/group"));
    for(const locale of ["sk","en","cs","hu","ro","it","de"]) for(const variant of ["","&subquestion"]) {
      hasSource=false;
      const before=created;
      await page.goto(`http://127.0.0.1:${port}/test-fixtures/healthcare-management.html?workspace&studio&locale=${locale}${variant}`,{timeout:90000});
      await expect(page.getByTestId("status-list-tab-content")).toHaveAttribute("aria-current","page");
      await expect(page.getByTestId("status-list-question-studio")).toBeVisible();
      await page.getByTestId("studio-stage-answer").click();
      const editor=page.getByTestId("status-list-question-studio");
      await expect(editor.getByTestId("create-healthcare-source")).toBeVisible();
      await expect(editor.getByTestId("create-healthcare-source")).toHaveText(getHealthcareCopy(locale).create);
      assert.equal(created,before,"opening the question must never create a source");
      await editor.getByTestId("create-healthcare-source").click();
      await expect.poll(()=>created).toBe(before+1);
      await expect(editor.getByTestId("create-healthcare-source")).toHaveCount(0);
      await expect(editor.getByTestId("healthcare-configured-source")).toHaveCount(1);
    }
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await vite.close();}
});
