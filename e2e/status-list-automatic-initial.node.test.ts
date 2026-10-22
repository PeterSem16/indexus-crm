import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium,expect} from "@playwright/test";
import {createServer} from "vite";
import {getAutomaticInitialCopy} from "../client/src/components/status-list-automatic-initial-copy";

const server=await createServer({configFile:"vite.config.ts",logLevel:"error",
  server:{host:"127.0.0.1",port:4182,strictPort:true}});
await server.listen();
const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",headless:true,args:["--no-sandbox"]});
const page=await browser.newPage({viewport:{width:1100,height:900}});
const errors:string[]=[];
page.on("pageerror",error=>errors.push(error.message));
let previews=0,confirmations=0,delay=0,empty=false,large=false,stale=false;
await page.route("**/api/**",async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname.endsWith("/automatic-contacts"))return route.fulfill({json:{contacts:[
    {id:"a",label:"Synthetic Alpha"},{id:"b",label:"Synthetic Beta"},
  ]}});
  if(url.pathname.endsWith("/initial-preview")){
    previews++;
    const body=req.postDataJSON();
    assert.ok(body.scope==="contact" ? Boolean(body.contactId) : !body.contactId);
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    if(large)return route.fulfill({status:409,json:{error:"scope_too_large"}});
    const ids=body.scope==="mission" ? ["a","b"] : [body.contactId];
    const contacts=ids.map(id=>({id,label:`Initial ${id}`,actions:[
      {id:`ready-${id}`,actionType:"assign_task",questionLabel:"Unreachable",condition:true,
        status:empty ? "already_executed" : "batch_deferred",issues:[]},
      {id:`false-${id}`,actionType:"assign_task",questionLabel:"Reachable",condition:false,status:"condition_false",issues:[]},
    ]}));
    return route.fulfill({json:{fingerprint:"a".repeat(64),mode:"batch",contacts,
      summary:{contacts:ids.length,readyContacts:empty ? 0 : ids.length,readyActions:empty ? 0 : ids.length,
        skippedActions:ids.length*(empty ? 2 : 1)}}});
  }
  if(url.pathname.endsWith("/initial-confirm")){
    confirmations++;
    const body=req.postDataJSON();
    assert.equal(body.acknowledged,true);
    assert.equal(body.fingerprint,"a".repeat(64));
    return stale ? route.fulfill({status:409,json:{error:"preview_changed"}})
      : route.fulfill({json:{queued:0,deferred:body.scope==="mission" ? 2 : 1}});
  }
  if(url.pathname.includes("/automatic-items/") && req.method()==="GET")
    return route.fulfill({json:{item:{id:"item",label:"Reachable/Unreachable",isHidden:true,confirmationType:"auto"},
      config:{trigger:"background_change",enabled:true,revision:"revision"},mode:"batch",
      actions:[{id:"action",actionType:"assign_task",questionLabel:"Unreachable",issues:[]}],
      supportedConditionFields:["country"]}});
  throw Error(`Unexpected request ${req.method()} ${url.pathname}`);
});
const panel=page.getByTestId("automatic-initial-panel");
const previewButton=page.getByTestId("automatic-initial-preview");
const confirmButton=page.getByTestId("automatic-initial-confirm");
const ack=page.getByTestId("automatic-initial-acknowledgement");
const contact=page.locator(".slati-preview select");
async function load(locale="sk",dark=false){
  await page.goto(`http://127.0.0.1:4182/test-fixtures/status-list-automatic.html?locale=${locale}${dark ? "&dark=1" : ""}`);
  await contact.locator("option[value=a]").waitFor({state:"attached"});
  await expect(panel).toBeVisible();
}
try{
  for(const locale of ["en","sk","cs","hu","ro","it","de"]){
    await load(locale);
    await expect(page.getByTestId("automatic-initial-scope-contact")).toBeChecked();
    await expect(previewButton).toBeDisabled();
    await contact.selectOption("a");
    await previewButton.click();
    await expect(panel.locator(".slai-contact")).toHaveCount(1);
    await expect(panel.locator(".slai-contact")).toContainText("Initial a");
    await expect(panel.locator(".slai-action")).toHaveCount(2);
    await expect(confirmButton).toBeDisabled();
    await ack.check();
    await expect(confirmButton).toBeEnabled();
    assert.equal(confirmations,0,"preview/acknowledgement never confirm implicitly");
    assert.equal(await panel.locator(".slai-status").first().innerText(),getAutomaticInitialCopy(locale).statusNames.batch_deferred);
    assert.equal(await panel.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
    await page.getByTestId("automatic-initial-scope-mission").check();
    await expect(panel.locator(".slai-plan")).toHaveCount(0);
    await previewButton.click();
    await expect(panel.locator(".slai-contact")).toHaveCount(2);
  }
  await load();
  await contact.selectOption("a");
  delay=350;
  await previewButton.click();
  await contact.selectOption("b");
  await page.waitForTimeout(450);
  await expect(panel.locator(".slai-plan")).toHaveCount(0);
  delay=0;
  await previewButton.click();
  await expect(panel.locator(".slai-contact")).toContainText("Initial b");
  stale=true;
  await ack.check();await confirmButton.click();
  await expect(panel.locator(".slai-error")).toHaveText(getAutomaticInitialCopy("sk").previewChanged);
  await expect(panel.locator(".slai-plan")).toHaveCount(0);
  stale=false;
  await previewButton.click();
  await ack.check();await confirmButton.click();
  await expect(panel.locator(".slai-success")).toBeVisible();
  await expect(panel.locator(".slai-plan")).toHaveCount(0);
  assert.equal(confirmations,2,"only explicit clicks confirm");
  empty=true;
  await previewButton.click();
  await expect(panel.locator(".slai-contact")).toHaveCount(1);
  await expect(confirmButton).toHaveCount(0);
  await expect(panel.locator(".slai-status").first()).toHaveText(getAutomaticInitialCopy("sk").statusNames.already_executed);
  empty=false;large=true;
  await previewButton.click();
  await expect(panel.locator(".slai-error")).toHaveText(getAutomaticInitialCopy("sk").tooMany);
  large=false;delay=350;
  await previewButton.click();
  await page.locator(".slati-switch input").uncheck();
  await page.waitForTimeout(450);
  await expect(panel.locator(".slai-plan")).toHaveCount(0);
  await expect(previewButton).toBeDisabled();
  delay=0;
  await page.setViewportSize({width:390,height:844});
  await load("sk",true);
  await contact.selectOption("a");
  await previewButton.click();
  await expect(panel.locator(".slai-contact")).toHaveCount(1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await mkdir("generated-artifacts/status-list-initial",{recursive:true});
  await panel.screenshot({path:"generated-artifacts/status-list-initial/mobile-dark.jpg"});
  assert.deepEqual(errors,[]);
  console.log(`Initial-state UI: seven locales, explicit single/Mission scopes, acknowledgement, stale/empty/large guards, races, Batch result and mobile dark passed (${previews} previews).`);
}finally{await browser.close();await server.close();}
