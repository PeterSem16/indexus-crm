import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "@playwright/test";
import {createServer} from "vite";
const server=await createServer({configFile:"vite.config.ts",logLevel:"error",cacheDir:"/tmp/indexus-automatic-browser-cache",
  server:{host:"127.0.0.1",port:4181,strictPort:true}});
await server.listen();
const origin="http://127.0.0.1:4181";
const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:1100,height:900}});
const page=await context.newPage();
const errors:string[]=[];
page.on("pageerror",error=>errors.push(error.message));
let writes=0,previews=0;
await page.route("**/api/**",async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname.endsWith("/automatic-contacts"))return route.fulfill({json:{contacts:[
    {id:"a",label:"Synthetic Alpha"},{id:"b",label:"Synthetic Beta"},
  ]}});
  if(url.pathname.endsWith("/automatic-preview")){
    previews++;
    const contact=url.pathname.includes("/contacts/a/") ? "a" : "b";
    if(contact==="a")await new Promise(resolve=>setTimeout(resolve,350));
    return route.fulfill({json:{readOnly:true,trigger:"background_change",mode:"immediate",enabled:true,baseline:false,
      actions:[{id:contact,actionType:"notify_role",questionLabel:`Only ${contact}`,condition:true,status:"waiting_transition"}]}});
  }
  if(url.pathname.includes("/automatic-items/")){
    if(req.method()==="PUT")writes++;
    return route.fulfill({json:{item:{id:"item",label:"Reachable/Unreachable",isHidden:true,confirmationType:"auto"},
      config:{trigger:"background_change",enabled:true,revision:"revision"},mode:"batch",
      actions:[{id:"action",actionType:"notify_role",questionLabel:"Synthetic system question",issues:[]}],
      supportedConditionFields:["country","history.call_answered","history.email_reply"]}});
  }
  throw Error(`Unexpected action request: ${req.method()} ${url.pathname}`);
});
try{
  for(const locale of ["en","sk","cs","hu","ro","it","de"]){
    await page.goto(`${origin}/test-fixtures/status-list-automatic.html?locale=${locale}`);
    await page.locator(".slati-preview select option[value=a]").waitFor({state:"attached"});
    const selects=page.locator("select");
    await selects.last().selectOption("a");
    await page.locator(".slati-preview-action button").click();
    await selects.last().selectOption("b");
    await page.locator(".slati-preview-action button").click();
    await page.locator(".slati-result").getByText("Only b",{exact:true}).waitFor();
    await page.waitForTimeout(450);
    assert.equal(await page.locator(".slati-result").getByText("Only a",{exact:true}).count(),0);
    assert.equal(await page.locator(".slati").evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
    assert.notEqual(await page.locator(".slati-status").innerText(),"waiting_transition",`translate status in ${locale}`);
    assert.equal(writes,0,"preview never writes configuration or calls runtime");
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${origin}/test-fixtures/status-list-automatic.html?locale=sk&dark=1`);
  await page.locator(".slati-preview select option[value=a]").waitFor({state:"attached"});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"mobile has no horizontal overflow");
  await mkdir("generated-artifacts/status-list-automatic",{recursive:true});
  await page.screenshot({path:"generated-artifacts/status-list-automatic/mobile-dark.jpg",fullPage:true});
  assert.deepEqual(errors,[]);
  assert.equal(previews,14);
  console.log("Status List automatic browser: seven locales, contact-switch race, no writes, mobile dark layout passed.");
}finally{await browser.close();await server.close();}
