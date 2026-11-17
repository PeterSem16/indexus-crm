"use strict";
// Isolated real-component browser tests. Synthetic HTTP fixtures only; no CRM login or AI calls.
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const assert = require("node:assert/strict");
const { build } = require("esbuild"), { chromium } = require("playwright");
const postcss = require("postcss"), tailwindcss = require("tailwindcss");
async function main() {
  const out = path.resolve("generated-artifacts/email-note-jobs-ui");
  fs.mkdirSync(out, { recursive: true });
  // Generate current native utilities/tokens, not an unrelated old dist bundle.
  // The imported phase-pipeline stylesheet is irrelevant to this isolated fixture.
  const css = (await postcss([tailwindcss()]).process(
    fs.readFileSync("client/src/index.css","utf8").replace(/^@import.*$/gm,""),
    {from:path.resolve("client/src/index.css")})).css;
  await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React,{useState} from "react";
    import {createRoot} from "react-dom/client";
    import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
    import {I18nProvider,useI18n} from "./client/src/i18n/I18nProvider";
    import {EmailNoteDraft} from "./client/src/components/nexus/EmailNoteDraft";
    const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
    const countries=[];
    function Harness(){
      const [id,setId]=useState("one");const {locale,setLocale}=useI18n();
      window.changeNoteEmail=setId;window.noteLocale=locale;window.setNoteLocale=setLocale;
      window.refreshNote=()=>client.invalidateQueries();
      return <main style={{maxWidth:850,margin:"24px auto",padding:16}}>
        <EmailNoteDraft key={id} userId="synthetic-owner" emailId={id} mailbox="synthetic@example.test"/>
      </main>
    }
    createRoot(document.getElementById("root")).render(
      <QueryClientProvider client={client}><I18nProvider userCountries={countries}><Harness/></I18nProvider></QueryClientProvider>);
  ` }, outfile: path.join(out,"ui.js"), bundle:true,platform:"browser",format:"iife",
    jsx:"automatic",tsconfig:"tsconfig.json",define:{"process.env.NODE_ENV":'"production"'},logLevel:"silent" });
  const server=http.createServer((req,res)=>{
    if(req.url==="/ui.js"){res.setHeader("Content-Type","application/javascript");return res.end(fs.readFileSync(path.join(out,"ui.js")));}
    if(req.url==="/style.css"){res.setHeader("Content-Type","text/css");return res.end(css);}
    res.setHeader("Content-Type","text/html");res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/ui.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"],
    ...(fs.existsSync("/repl/tools/bin/chromium")?{executablePath:"/repl/tools/bin/chromium"}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1200,height:760},permissions:["clipboard-read","clipboard-write"]});
    const page=await context.newPage(),errors=[],writes=[];
    page.on("pageerror",e=>errors.push(e.message));
    let enabled=false,record=null,forbidden=false;
    const original="Klient žiada vysvetlenie sumy na doručenej faktúre.";
    await page.route("**/api/**",async route=>{
      const req=route.request();
      if(forbidden)return route.fulfill({status:403,json:{error:"forbidden"}});
      if(req.method()==="POST"){
        writes.push({method:"POST",body:req.postDataJSON(),url:req.url()});
        record={id:"draft-one",status:"pending",note:null,version:1};
        return route.fulfill({status:202,json:{enabled,record}});
      }
      if(req.method()==="PATCH"){
        const body=req.postDataJSON();writes.push({method:"PATCH",body,url:req.url()});
        record={...record,status:"approved",approved_note:body.note,approved_by:"synthetic-owner",
          approved_at:"2026-11-17T21:00:00.000Z",version:record.version+1};
      }
      return route.fulfill({json:{enabled,record}});
    });
    const firstResponse=page.waitForResponse(r=>r.url().includes("/ai-note"));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>!!window.refreshNote);
    await firstResponse;
    assert.equal(await page.getByTestId("email-note-draft").count(),0);
    enabled=true;await page.evaluate(()=>{window.setNoteLocale("sk");window.refreshNote();});
    await page.getByRole("button",{name:/Vytvoriť poznámku/}).waitFor();
    await page.getByRole("button",{name:/Vytvoriť poznámku/}).click();
    await page.getByText("Čaká na spracovanie",{exact:true}).waitFor();
    assert.deepEqual(writes[0].body,{});
    record={...record,status:"processing",version:2};
    await page.evaluate(()=>window.refreshNote());
    await page.getByText("Spracováva sa",{exact:true}).waitFor();
    record={...record,status:"review_required",note:original,version:3};
    await page.evaluate(()=>window.refreshNote());
    await page.getByTestId("email-note-edit").waitFor();
    assert.equal(await page.getByTestId("email-note-edit").inputValue(),original);
    const edited="Klient žiada objasniť sumu uvedenú na doručenej faktúre.";
    await page.getByTestId("email-note-edit").fill(edited);
    await page.evaluate(()=>window.refreshNote());
    assert.equal(await page.getByTestId("email-note-edit").inputValue(),edited);
    await page.getByRole("button",{name:/Kopírovať/}).click();
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),edited);
    await page.getByRole("button",{name:/Schváliť/}).click();
    await page.getByText(edited,{exact:true}).waitFor();
    assert.equal(writes[1].body.note,edited);assert.equal(writes[1].body.version,3);
    assert.ok((await page.locator("main").innerText()).includes("synthetic-owner"));
    for(const locale of ["en","sk","cs","hu","ro","it","de"]){
      await page.evaluate(value=>window.setNoteLocale(value),locale);
      await page.waitForFunction(value=>window.noteLocale===value,locale);
      assert.equal(await page.getByText(edited,{exact:true}).count(),1);
      assert.ok((await page.locator("h3").innerText()).trim());
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>document.documentElement.classList.add("dark"));
    await page.waitForFunction(()=>{
      const rgb=getComputedStyle(document.querySelector('[data-testid="email-note-draft"]')).color.match(/\d+/g).map(Number);
      return rgb[0]>180 && rgb[1]>180 && rgb[2]>180;
    });
    await page.screenshot({path:path.join(out,"approved-mobile-dark.jpg")});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"No mobile overflow");
    record={id:"draft-two",status:"review_required",note:"Iný syntetický klient požaduje potvrdenie prijatia správy.",version:1};
    await page.evaluate(()=>{window.setNoteLocale("sk");window.changeNoteEmail("two");});
    await page.getByTestId("email-note-edit").waitFor();
    await page.waitForFunction(()=>document.querySelector("textarea")?.value.includes("Iný syntetický"));
    assert.ok(!(await page.getByTestId("email-note-edit").inputValue()).includes(edited));
    record={...record,status:"failed",error_code:"gateway_timeout",note:null};
    await page.evaluate(()=>window.refreshNote());
    await page.getByText("Chyba spracovania",{exact:true}).waitFor();
    assert.equal(await page.getByTestId("email-note-edit").count(),0);
    forbidden=true;await page.evaluate(()=>window.refreshNote());
    await page.getByRole("alert").first().waitFor();
    assert.equal(writes.length,2);
    assert.deepEqual(errors,[]);
    console.log("PASS: real UI create/pending/processing/review/edit/copy/approve/audit/failed/403, seven locales, scoped switching, mobile dark; synthetic fixtures only.");
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
