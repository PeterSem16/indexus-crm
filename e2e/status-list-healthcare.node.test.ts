import assert from "node:assert/strict";
import test from "node:test";
import {chromium,expect} from "@playwright/test";
import {createServer} from "vite";
import {getHealthcareCopy,getHealthcareCounterSubstatus} from "../client/src/components/status-list-healthcare-copy";
import {healthcareLabels,healthcareStates} from "../shared/status-list-healthcare";

test("healthcare setup and agent controls: seven languages, mobile/dark, D-25/D-35, voicemail and reviewed actions",async()=>{
  const vite=await createServer({configFile:false,root:"client",cacheDir:"/tmp/indexus-healthcare-vite-cache",resolve:{alias:{"@":`${process.cwd()}/client/src`,"@shared":`${process.cwd()}/shared`}},
    esbuild:{jsx:"automatic"},
    server:{host:"127.0.0.1",port:0},logLevel:"error"});
  await vite.listen();
  const address=vite.httpServer!.address() as {port:number};
  const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
  const mapping=Object.fromEntries(healthcareStates.map(s=>[s,`option-${s}`]));
  try {
    for(const locale of ["sk","en","cs","hu","ro","it","de"]) {
      console.info(`Healthcare settings browser: ${locale}`);
      const page=await browser.newPage({viewport:{width:locale==="sk"?390:1100,height:860}});
      page.on("pageerror",error=>console.error("Healthcare fixture:",error.message));
      const c=getHealthcareCopy(locale);
      const initialPolicy={enabled:Object.fromEntries(healthcareStates.map(state=>[state,true])),failedAttempts:5,minTalkSeconds:3};
      let saved:any,settingsSaved:any,resetPayload:any,approved:any,created=0,storedPolicy=initialPolicy;
       let hasSource=true,hiddenFacts=false,showReviews=true,sourceCount=1;
      await page.route("**/test-fixtures/healthcare.html*",route=>route.fulfill({contentType:"text/html",body:'<html><head></head><body><div id="root"></div><script type="module" src="/test-fixtures/status-list-healthcare.tsx"></script></body></html>'}));
      await page.route("**/api/**",async route=>{
        const url=new URL(route.request().url()),method=route.request().method();
        let data:unknown=[];
        if(url.pathname.endsWith("/option-sources/group")&&method==="PUT"){settingsSaved=route.request().postDataJSON();storedPolicy=settingsSaved.policy;data={ok:true};}
         else if(url.pathname.endsWith("/option-sources"))data={sources:hasSource?Array.from({length:sourceCount},(_,index)=>({
           source:"healthcare_reachability",groupId:index?`duplicate-${index}`:"group",hidden:true,
           mapping:index?Object.fromEntries(healthcareStates.map(state=>[state,`duplicate-${index}-${state}`])):mapping,policy:storedPolicy,
         })):[],catalog:Array.from({length:sourceCount},(_,index)=>({
           id:index?`duplicate-${index}`:"group",kind:"item",label:"Provider reachability",itemType:"step",confirmationType:"info",
         }))};
        else if(url.pathname.endsWith("/sources"))data={sources:[],catalog:[]};
        else if(url.pathname.endsWith("/status-list-workflows"))data={catalog:[],rules:[]};
        else if(url.pathname.endsWith("/action-reviews/review")&&method==="POST"){approved=route.request().postDataJSON();data={ok:true};}
        else if(url.pathname.endsWith("/action-reviews"))data=showReviews?[{id:"review",label:"Unreachable",title:"Database administrator",targetLabel:"Database team",fingerprint:"b".repeat(64),actionType:"assign_task",callback:null}]:[];
        else if(url.pathname.endsWith("/healthcare/group/reset-counter")&&method==="POST"){resetPayload=route.request().postDataJSON();data={ok:true};}
        else if(url.pathname.endsWith("/healthcare/group")){saved=route.request().postDataJSON();data={ok:true};}
        else if(url.pathname.endsWith("/healthcare")&&method==="POST"){created++;hasSource=true;data={source:"healthcare_reachability",groupId:"group",hidden:true,mapping};}
        else if(url.pathname.endsWith("/healthcare"))data=Array.from({length:hiddenFacts?3:1},(_,index)=>({groupId:index?`duplicate-${index}`:"group",label:"Contacted healthcare provider",state:hiddenFacts?"not_defined":"unreachable",failedAttempts:hiddenFacts?0:5,
          fingerprint:"a".repeat(64),hasAlternativePhone:false,manualState:"automatic",substatus:"five_failed_attempts",proposedContact:"",
          lastAttempt:{id:"last-call",answered:true},active:true,held:false,config:{hidden:hiddenFacts,policy:storedPolicy}}));
        await route.fulfill({contentType:"application/json",body:JSON.stringify(data)});
      });
      await page.goto(`http://127.0.0.1:${address.port}/test-fixtures/healthcare.html?locale=${locale}&dark`,{waitUntil:"domcontentloaded",timeout:90000});
      await expect(page.getByTestId("healthcare-configured-source")).toBeVisible();
       await expect(page.getByTestId("healthcare-source-setup")).toHaveCount(1);
       await expect(page.getByTestId("healthcare-configured-source").getByRole("button").first()).toHaveAttribute("aria-expanded","false");
       await page.getByTestId("healthcare-configured-source").getByRole("button").first().click();
      await expect(page.getByTestId("action-execution-policy")).toHaveValue("automatic");
      await page.getByTestId("action-execution-policy").selectOption("review");
      await expect(page.getByTestId("action-execution-policy")).toHaveValue("review");
      await expect(page.getByTestId("background-source-actions")).toHaveCount(7);
       await expect(page.getByTestId("healthcare-agent-status")).toContainText(getHealthcareCounterSubstatus(locale,5));
       const settings=page.getByTestId("healthcare-source-settings");
       await settings.getByTestId("healthcare-failed-attempts").fill("8");
       await settings.getByTestId("healthcare-min-talk-seconds").fill("6");
       await settings.getByTestId("healthcare-use-wrong_number").uncheck();
       await settings.getByRole("button",{name:c.save,exact:true}).click();
       await expect(settings.getByTestId("healthcare-failed-attempts")).toHaveValue("8");
       assert.deepEqual(settingsSaved,{source:"healthcare_reachability",hidden:true,mapping,policy:{
         enabled:{...initialPolicy.enabled,wrong_number:false},failedAttempts:8,minTalkSeconds:6,
       }});
       await page.reload({waitUntil:"domcontentloaded"});
       await page.getByTestId("healthcare-configured-source").getByRole("button").first().click();
       const reloadedSettings=page.getByTestId("healthcare-source-settings");
       await expect(reloadedSettings.getByTestId("healthcare-failed-attempts")).toHaveValue("8");
       await expect(reloadedSettings.getByTestId("healthcare-min-talk-seconds")).toHaveValue("6");
       await expect(reloadedSettings.getByTestId("healthcare-use-wrong_number")).not.toBeChecked();
        await expect(page.getByTestId("healthcare-agent-status")).toContainText(getHealthcareCounterSubstatus(locale,8));
      await page.getByRole("button",{name:c.edit,exact:true}).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByLabel(c.substatus)).toHaveText(/.+/);
       await expect(page.getByTestId("healthcare-manual-state").locator('option[value="wrong_number"]')).toHaveCount(0);
       await page.getByTestId("healthcare-manual-state").selectOption("long_term_absent");
      await page.getByRole("button",{name:c.save,exact:true}).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
       assert.equal(saved.state,"long_term_absent");
      assert.equal(saved.expectedFingerprint,"a".repeat(64));
       await page.getByRole("button",{name:c.resetCounter,exact:true}).click();
       await page.getByLabel(c.resetReason).fill("Verified record correction");
       await page.getByRole("button",{name:c.resetConfirm,exact:true}).click();
       await expect.poll(()=>resetPayload).toBeTruthy();
       assert.deepEqual(resetPayload,{expectedFingerprint:"a".repeat(64),reason:"Verified record correction"});
      await page.getByRole("button",{name:"Database administrator",exact:true}).click();
      await expect(page.getByRole("dialog")).toContainText("Database team");
      await page.getByTestId("confirm-background-action").click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      assert.equal(approved.fingerprint,"b".repeat(64));
      await expect(page.getByTestId("create-healthcare-source")).toHaveCount(0);
      if(locale==="sk") {
        hasSource=false;
        created=0;
         await page.goto(`http://127.0.0.1:${address.port}/test-fixtures/healthcare.html?locale=sk`,{waitUntil:"domcontentloaded",timeout:90000});
        await expect(page.getByTestId("status-list-option-source-panel")).toBeVisible();
        await expect(page.getByTestId("create-healthcare-source")).toBeVisible();
        await page.getByTestId("create-healthcare-source").click();
        await expect.poll(()=>created).toBe(1);
        await expect(page.getByTestId("create-healthcare-source")).toHaveCount(0);
         await page.goto(`http://127.0.0.1:${address.port}/test-fixtures/healthcare.html?locale=sk&option-group&target=option-reachable&nested`,{waitUntil:"domcontentloaded",timeout:90000});
         const nestedSettings=page.getByTestId("healthcare-source-settings");
         await expect(nestedSettings).toBeVisible();
         await nestedSettings.getByRole("button",{name:c.save,exact:true}).click();
         await expect(nestedSettings).toContainText(c.saved);
         assert.equal(await page.locator("html").getAttribute("data-outer-submits"),null,"settings Save never submits the enclosing editor");
         await nestedSettings.getByTestId("healthcare-failed-attempts").fill("9");
         await nestedSettings.getByTestId("healthcare-failed-attempts").press("Enter");
         await expect.poll(()=>settingsSaved.policy.failedAttempts).toBe(9);
         assert.equal(await page.locator("html").getAttribute("data-outer-submits"),null);
        hiddenFacts=true;showReviews=false;
        await page.reload({waitUntil:"domcontentloaded",timeout:90000});
        await expect(page.getByTestId("healthcare-configured-source")).toBeVisible();
        await expect(page.getByTestId("healthcare-agent-status")).toHaveCount(0);
        await expect(page.getByTestId("agent-background-controls")).toHaveCount(0);
        await expect(page.getByRole("button",{name:c.resetCounter,exact:true})).toHaveCount(0);
        showReviews=true;
        await page.reload({waitUntil:"domcontentloaded",timeout:90000});
        await expect(page.getByTestId("background-action-reviews")).toBeVisible();
        await expect(page.getByTestId("healthcare-agent-status")).toHaveCount(0);
         sourceCount=3;
         await page.goto(`http://127.0.0.1:${address.port}/test-fixtures/healthcare.html?locale=sk&option-group&target=legacy-three-answer-group`,{waitUntil:"domcontentloaded",timeout:90000});
         const rows=page.getByTestId("healthcare-configured-source");
         await expect(rows).toHaveCount(3);
         await expect(page.getByTestId("healthcare-source-setup")).toHaveCount(1);
         for(let index=0;index<3;index++) {
           await expect(rows.nth(index).getByRole("button").first()).toHaveAttribute("aria-expanded","false");
           await expect(rows.nth(index).getByRole("button").first()).toContainText(`· ${index+1}`);
         }
         await rows.first().getByRole("button").first().click();
         await rows.first().getByTestId("healthcare-failed-attempts").fill("12");
         await rows.first().getByRole("button").first().click();
         await rows.first().getByRole("button").first().click();
         await expect(rows.first().getByTestId("healthcare-failed-attempts")).toHaveValue("12");
         await expect(page.getByTestId("create-healthcare-source")).toHaveCount(0);
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.close();
    }
  }finally{await browser.close();await vite.close();}
});
