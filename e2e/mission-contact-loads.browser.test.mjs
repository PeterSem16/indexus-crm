// Live dev-only regression, uses a separately seeded temporary account/Mission.
// Never installs auth bypasses and never touches a real Mission.
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import express from "express";
import { resolve } from "node:path";
const fixture=JSON.parse(await readFile("/tmp/mission-load-browser-fixture.json","utf8"));
let candidateServer;
if (process.env.CONTACT_LOAD_DIST) {
  const backend=fixture.devUrl, app=express();
  app.use("/api",express.raw({type:()=>true,limit:"6mb"}),async(req,res)=>{
    try {
      const response=await fetch(backend+req.originalUrl,{method:req.method,
        headers:{...(req.headers.cookie?{cookie:req.headers.cookie}:{}),
          ...(req.headers["content-type"]?{"content-type":req.headers["content-type"]}:{})},
        ...(!["GET","HEAD"].includes(req.method)?{body:req.body}:{})});
      for(const cookie of response.headers.getSetCookie())res.append("set-cookie",cookie);
      res.status(response.status).type(response.headers.get("content-type")||"application/json")
        .send(Buffer.from(await response.arrayBuffer()));
    } catch {res.status(502).json({error:"test_proxy_failed"});}
  });
  const dist=resolve(process.env.CONTACT_LOAD_DIST);
  app.use(express.static(dist));
  app.get("*",(_,res)=>res.sendFile(resolve(dist,"index.html")));
  candidateServer=app.listen(0,"127.0.0.1");
  await new Promise(r=>candidateServer.on("listening",r));
  fixture.devUrl=`http://127.0.0.1:${candidateServer.address().port}`;
}
const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:1440,height:1050}});
const page=await context.newPage();
page.setDefaultTimeout(25000);
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
const api=async(path,body)=>{
  const res=await context.request.post(`${fixture.devUrl}${path}`,{data:body});
  assert.ok(res.ok(),`HTTP ${res.status()} ${path}`); return res.json();
};
try {
  await api("/api/auth/login",{username:fixture.username,password:fixture.password});
  await page.goto(`${fixture.devUrl}/campaigns/${fixture.campaign}`,{waitUntil:"domcontentloaded"});
  await page.getByTestId("tab-contacts").click();
  if (process.argv.includes("--file")) {
    const name=`LOAD FILE NEW ${fixture.id}`;
    const csv=`name,email,country\n${name},${fixture.id}@example.test,SK\n${name},${fixture.id}@example.test,SK`;
    const upload=async content=>{
      await page.getByTestId("button-import-contacts").click();
      await page.getByTestId("button-import-type-clinic").click();
      await page.getByTestId("input-import-file").setInputFiles({name:"contacts.csv",mimeType:"text/csv",buffer:Buffer.from(content)});
      const response=page.waitForResponse(r=>r.url().endsWith("/contact-loads/preview"));
      await page.getByTestId("button-start-import").click();
      return (await response).json();
    };
    const bad=await upload(csv+"\n,broken,SK");
    assert.deepEqual(bad.counts,{new:1,existing:1,invalid:1});
    assert.equal(await page.getByTestId("button-apply-contact-load").isDisabled(),true);
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({state:"hidden"});
    const good=await upload(csv);
    assert.deepEqual(good.counts,{new:1,existing:1,invalid:0});
    await page.getByRole("dialog").getByRole("checkbox").click();
    const applied=page.waitForResponse(r=>r.url().endsWith(`/${good.id}/apply`));
    await page.getByTestId("button-apply-contact-load").click();
    assert.equal((await (await applied).json()).added,1);
    await page.getByRole("dialog").locator("article").filter({has:page.locator("button")}).first().locator("button").click();
    await page.getByTestId("button-confirm-contact-load-undo").waitFor();
    const undone=page.waitForResponse(r=>r.url().endsWith(`/${good.id}/undo`));
    await page.getByTestId("button-confirm-contact-load-undo").click();
    assert.equal((await (await undone).json()).removed,1);
    assert.deepEqual(errors,[]);
    console.log("PASS live multipart preview, invalid-row block, duplicate handling, apply and undo");
  } else {
  await page.getByTestId("button-generate-contacts").click();
  const customer=page.getByTestId("check-source-customer");
  if(await customer.getAttribute("aria-checked")==="true")await customer.click();
  await page.getByTestId("check-source-clinic").click();
  await page.getByTestId("add-group-clinic").click();
  await page.locator('[data-testid^="add-cond-"]').click();
  await page.locator('input[data-testid^="val-"]').fill("LOAD SAFETY");
  const previewResponse=page.waitForResponse(r=>r.url().endsWith("/contact-loads/preview"));
  await page.getByTestId("btn-confirm-generate").click();
  const preview=await (await previewResponse).json();
  assert.deepEqual(preview.counts,{new:1,existing:1,invalid:0});
  const button=page.getByTestId("button-apply-contact-load");
  await button.waitFor();
  assert.equal(await button.isDisabled(),true);
  await mkdir("generated-artifacts/contact-loads",{recursive:true});
  await page.screenshot({path:"generated-artifacts/contact-loads/review-light.png"});
  await page.evaluate(()=>document.documentElement.classList.add("dark"));
  await page.screenshot({path:"generated-artifacts/contact-loads/review-dark.png"});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:"generated-artifacts/contact-loads/review-mobile.png"});
  const bounds=await page.getByRole("dialog").boundingBox();
  assert.ok(bounds.x>=-1 && bounds.x+bounds.width<=391,"review fits mobile");
  await button.scrollIntoViewIfNeeded();
  const actionBounds=await button.boundingBox();
  assert.ok(actionBounds.y>=0 && actionBounds.y+actionBounds.height<=844,"mobile action remains reachable");
  await page.setViewportSize({width:1440,height:1050});
  await page.evaluate(()=>document.documentElement.classList.remove("dark"));
  await page.getByRole("dialog").getByRole("checkbox").click();
  const applyResponse=page.waitForResponse(r=>r.url().endsWith(`/${preview.id}/apply`));
  await button.click();
  const applyResult=await applyResponse;
  assert.equal(applyResult.status(),200);
  assert.equal((await applyResult.json()).added,1);
  await page.getByTestId("button-contact-load-history").waitFor();
  await page.reload({waitUntil:"domcontentloaded"});
  await page.getByTestId("tab-contacts").click();
  await page.getByTestId("button-contact-load-history").click();
  const article=page.getByRole("dialog").locator("article").filter({has:page.locator("button")}).first();
  await article.locator("button").click();
  await page.getByTestId("button-confirm-contact-load-undo").waitFor();
  await page.screenshot({path:"generated-artifacts/contact-loads/undo.png"});
  const undoResponse=page.waitForResponse(r=>r.url().endsWith(`/${preview.id}/undo`));
  await page.getByTestId("button-confirm-contact-load-undo").click();
  assert.deepEqual(await (await undoResponse).json(),{removed:1,protected:0,missing:0,status:"undone"});
  assert.deepEqual(errors,[]);
  console.log("PASS live CRM preview/apply/history after reload/undo and responsive review");
  }
} catch(error) {
  console.error("UI errors",errors);
  console.error((await page.locator("body").innerText()).slice(-2500));
  throw error;
} finally {
  await context.request.post(`${fixture.devUrl}/api/auth/logout`).catch(()=>{});
  await browser.close();
  if(candidateServer)await new Promise(r=>candidateServer.close(r));
}
