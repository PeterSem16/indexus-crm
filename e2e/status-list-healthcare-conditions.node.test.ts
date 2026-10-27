import test from "node:test";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { getHealthcareCopy } from "../client/src/components/status-list-healthcare-copy";

test("unified healthcare IF conditions and regular action conditions in seven languages",async()=>{
  const vite=await createServer({configFile:false,root:"client",cacheDir:"/tmp/indexus-healthcare-conditions-cache",
    resolve:{alias:{"@":`${process.cwd()}/client/src`,"@shared":`${process.cwd()}/shared`}},esbuild:{jsx:"automatic"},
    server:{host:"127.0.0.1",port:0},logLevel:"error"});
  await vite.listen();
  const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
  try{
    for(const locale of ["sk","en","cs","hu","ro","it","de"]){
      const page=await browser.newPage({viewport:{width:locale==="sk"?390:1200,height:900}});
      await page.route("**/test-fixtures/conditions.html*",route=>route.fulfill({contentType:"text/html",body:
        '<html><body><div id="root"></div><script type="module" src="/test-fixtures/status-list-healthcare-conditions.tsx"></script></body></html>'}));
      await page.goto(`http://127.0.0.1:${(vite.httpServer!.address() as {port:number}).port}/test-fixtures/conditions.html?locale=${locale}`,
        {waitUntil:"domcontentloaded",timeout:90000});
      const c=getHealthcareCopy(locale);
      await page.getByTestId("status-workflow-nav-if").click();
      await expect(page.getByTestId("status-workflow-condition-field-0")).toHaveValue("healthcare.state");
      await expect(page.getByTestId("status-workflow-condition-value-0").locator("option[value='unreachable']")).toHaveText(c.states.unreachable);
      await page.getByTestId("status-workflow-condition-value-0").selectOption("reachable");
      await page.getByTestId("status-workflow-condition-op-1").selectOption("gte");
      await page.getByTestId("status-workflow-condition-value-1").fill("7");
      await page.getByTestId("status-workflow-save").click();
      const saved=JSON.parse(await page.getByTestId("saved-workflow").textContent()||"{}");
      assert.deepEqual(saved.conditions,[{field:"healthcare.state",op:"equals",value:"reachable"},
        {field:"healthcare.failed_attempts",op:"gte",value:"7"}]);
      await expect(page.getByTestId("service-action-condition-value-0").locator("option[value='reachable']")).toHaveText(c.states.reachable);
      await page.getByTestId("service-action-condition-value-0").selectOption("long_term_absent");
      await page.getByTestId("service-action-condition-value-1").fill("8");
      const payload=JSON.parse(await page.getByTestId("service-condition-payload").textContent()||"{}");
      assert.deepEqual(payload.rules,[{field:"healthcare.state",op:"eq",value:"long_term_absent"},
        {field:"healthcare.failed_attempts",op:"gte",value:"8"}]);
      await page.close();
    }
  }finally{await browser.close();await vite.close();}
});
