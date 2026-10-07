import test from "node:test";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import ts from "typescript";

test("real HTML editor preserves recipient bindings, CSS, links and ordinary edits across recipients", async () => {
  const result = await build({
    stdin: { contents: `
      import React,{useState} from "react";
      import {createRoot} from "react-dom/client";
      import {EditableEmailFrame} from "./client/src/components/editable-email-frame";
      import {recipientEditorHtml,readRecipientEditorHtml,renderRecipientDraft,sendRecipientCopies} from "./client/src/lib/recipient-personalized-email";
      const people={
        "anna@example.test":{name:"MUDr. Anna Nováková",salutation:"Vážená pani"},
        "peter@example.test":{name:"Ing. Peter Novák",salutation:"Vážený pán"}
      };
      function Fixture(){
        const [recipient,setRecipient]=useState("anna@example.test");
        const [draft,setDraft]=useState('<style>.greeting{font-weight:700;color:rgb(120,0,0)}</style><p class="greeting">{{clinic.doctorSalutationFull}} {{clinic.doctorFullName}},</p><p id="ordinary">Original body</p><a href="mailto:{{clinic.email}}">Address</a>');
        const [sent,setSent]=useState([]);
        const resolveFor=email=>token=>({
          "{{clinic.doctorFullName}}":people[email].name,
          "{{clinic.doctorSalutationFull}}":people[email].salutation,
          "{{clinic.email}}":email
        })[token]||token;
        const resolve=resolveFor(recipient);
        return <main>
          <select aria-label="Recipient preview" value={recipient} onChange={event=>setRecipient(event.target.value)}>
            {Object.keys(people).map(email=><option key={email}>{email}</option>)}
          </select>
          <EditableEmailFrame title="Recipient HTML editor" value={recipientEditorHtml(draft,resolve)} onChange={html=>setDraft(readRecipientEditorHtml(html))}/>
          <pre data-testid="draft">{draft}</pre>
          <button onClick={async()=>{
            const copies=[];
            await sendRecipientCopies(Object.keys(people),async email=>{
              copies.push({to:[email],body:renderRecipientDraft(draft,resolveFor(email),true),cc:"archive@example.test",attachments:[{name:"information.pdf"}]});
            },()=>{});
            setSent(copies);
          }}>Send fixture copies</button>
          <pre data-testid="sent">{JSON.stringify(sent)}</pre>
        </main>;
      }
      createRoot(document.getElementById("root")).render(<Fixture/>);
    `, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: result.outputFiles[0].text });
    const frame = page.frameLocator('iframe[title="Recipient HTML editor"]');
    await expect(frame.locator(".greeting")).toHaveText("Vážená pani MUDr. Anna Nováková,");
    await expect(frame.locator("a")).toHaveAttribute("href", "mailto:anna@example.test");
    await frame.locator("#ordinary").evaluate(element => {
      element.textContent = "Edited ordinary body";
      element.dispatchEvent(new InputEvent("input", { bubbles: true }));
    });
    await expect(page.getByTestId("draft")).toContainText("{{clinic.doctorFullName}}");
    await expect(page.getByTestId("draft")).toContainText("{{clinic.email}}");
    await page.getByRole("combobox", { name: "Recipient preview" }).selectOption("peter@example.test");
    await expect(frame.locator(".greeting")).toHaveText("Vážený pán Ing. Peter Novák,");
    await expect(frame.locator("#ordinary")).toHaveText("Edited ordinary body");
    await expect(frame.locator("a")).toHaveAttribute("href", "mailto:peter@example.test");
    assert.equal(await frame.locator(".greeting").evaluate(element => getComputedStyle(element).color), "rgb(120, 0, 0)");
    await page.getByRole("button", { name: "Send fixture copies" }).click();
    await expect(page.getByTestId("sent")).toContainText("Edited ordinary body");
    const sent = JSON.parse(await page.getByTestId("sent").innerText());
    assert.equal(sent.length, 2);
    assert.ok(sent[0].body.includes("Vážená pani MUDr. Anna Nováková"));
    assert.ok(sent[1].body.includes("Vážený pán Ing. Peter Novák"));
    for (const copy of sent) {
      assert.equal(copy.to.length, 1);
      assert.equal(copy.cc, "archive@example.test");
      assert.equal(copy.attachments[0].name, "information.pdf");
      assert.equal(copy.body.includes("data-pulse-recipient"), false);
      assert.equal(copy.body.includes("{{"), false);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("three clinic selections use the real template resolver despite duplicate primary-address personnel", async () => {
  // Exercise the actual module-level resolver, not a mock salutation dictionary.
  const source = ts.createSourceFile("agent-workspace.tsx",
    await readFile("client/src/pages/agent-workspace.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(["SalGender", "SALUTATION_SHORT", "SALUTATION_FULL", "SALUTATION_DOC",
    "detectSalutationGender", "computeSalutations", "parsePersonName", "applyTemplateVars"]);
  const declarations = source.statements.filter(node =>
    ((ts.isFunctionDeclaration(node) || ts.isTypeAliasDeclaration(node)) && !!node.name && names.has(node.name.text)) ||
    (ts.isVariableStatement(node) && node.declarationList.declarations.some(decl => ts.isIdentifier(decl.name) && names.has(decl.name.text))));
  assert.equal(declarations.length, names.size, "All production salutation dependencies must be tested");
  const result = await build({
    stdin: { contents: `
      import React,{useState} from "react";
      import {createRoot} from "react-dom/client";
      import {EditableEmailFrame} from "./client/src/components/editable-email-frame";
      import {recipientSelection,recipientEmailOptions,recipientContext,preserveRecipientFields,
        recipientEditorHtml,readRecipientEditorHtml,renderRecipientDraft,sendRecipientCopies} from "./client/src/lib/recipient-personalized-email";
      ${declarations.map(node => node.getText(source)).join("\n")}
      const base={clinic:{id:"parent-clinic",clinicName:"Test clinic",email:"clinic@example.test",
        doctorTitle:"MUDr.",doctorFirstName:"Diana",doctorLastName:"Klinická"},lang:"sk"};
      const person={id:"assigned",email:"anna@example.test",firstName:"Anna",lastName:"Nováková",titleBefore:"MUDr.",titleAfter:""};
      const people=[person,{...person,id:"legacy",email:"CLINIC@example.test"},
        {...person,id:"duplicate",email:"clinic@example.test",firstName:"Peter",lastName:"Iný"}];
      function Fixture(){
        const [selected,setSelected]=useState(["clinic@example.test"]);
        const [requested,setRequested]=useState("");
        const [draft,setDraft]=useState(()=>preserveRecipientFields(
          '<p id="greeting">{{clinic.doctorSalutationFull}} {{clinic.doctorFullName}},</p><p id="ordinary">Original body</p>',
          value=>applyTemplateVars(value,base)));
        const [sent,setSent]=useState([]);
        const state=recipientSelection(base,selected,requested,people);
        const resolve=token=>state.previewContext ? applyTemplateVars(token,state.previewContext) : token;
        return <main>
          {recipientEmailOptions(base,people).map(option=><label key={option.email}>
            <input type="checkbox" value={option.email} checked={selected.includes(option.email)}
              onChange={event=>setSelected(current=>event.target.checked?[...current,option.email]:current.filter(email=>email!==option.email))}/>
            {option.email}{option.name?' — '+option.name:''}
          </label>)}
          <select aria-label="Preview recipient" value={state.previewRecipient} onChange={event=>setRequested(event.target.value)}>
            {selected.map(email=><option key={email}>{email}</option>)}
          </select>
          {state.ambiguousEmails.length>0 && <p role="alert">Ambiguous recipient</p>}
          <EditableEmailFrame title="Clinic email preview" value={recipientEditorHtml(draft,resolve)}
            onChange={html=>setDraft(readRecipientEditorHtml(html))}/>
          <button disabled={selected.length===0 || state.ambiguousEmails.length>0} onClick={async()=>{
            const copies=[];
            await sendRecipientCopies(selected,async email=>{
              const context=recipientContext(base,email,people);
              copies.push({to:[email],body:renderRecipientDraft(draft,token=>applyTemplateVars(token,context),true),
                customerId:base.clinic.id,cc:"archive@example.test",attachments:[{name:"guide.pdf"}]});
              return true;
            },()=>{});
            setSent(copies);
          }}>Send fixture copies</button>
          <pre data-testid="sent">{JSON.stringify(sent)}</pre>
        </main>;
      }
      createRoot(document.getElementById("root")).render(<Fixture/>);
    `, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: result.outputFiles[0].text });
    const frame = page.frameLocator('iframe[title="Clinic email preview"]');
    const primary = page.locator('input[value="clinic@example.test"]');
    const person = page.locator('input[value="anna@example.test"]');
    const send = page.getByRole("button", { name: "Send fixture copies" });
    const preview = page.getByRole("combobox", { name: "Preview recipient" });
    await expect(page.getByRole("checkbox")).toHaveCount(2);
    await expect(frame.locator("#greeting")).toHaveText("Vážená pani MUDr. Diana Klinická,");
    await expect(send).toBeEnabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await person.check();
    await preview.selectOption("anna@example.test");
    await expect(frame.locator("#greeting")).toHaveText("Vážená pani MUDr. Anna Nováková,");
    await expect(send).toBeEnabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await preview.selectOption("clinic@example.test");
    await expect(frame.locator("#greeting")).toHaveText("Vážená pani MUDr. Diana Klinická,");
    await send.click();
    await expect(page.getByTestId("sent")).toContainText("Anna Nováková");
    const copies = JSON.parse(await page.getByTestId("sent").innerText());
    assert.equal(copies.length, 2);
    assert.deepEqual(copies.map((copy: any) => copy.to), [["clinic@example.test"], ["anna@example.test"]]);
    assert.ok(copies[0].body.includes("Diana Klinická") && !copies[0].body.includes("Anna Nováková"));
    assert.ok(copies[1].body.includes("Anna Nováková") && !copies[1].body.includes("Diana Klinická"));
    for (const copy of copies) {
      assert.equal(copy.customerId, "parent-clinic");
      assert.equal(copy.cc, "archive@example.test");
      assert.equal(copy.attachments[0].name, "guide.pdf");
    }
    await primary.uncheck();
    await expect(frame.locator("#greeting")).toHaveText("Vážená pani MUDr. Anna Nováková,");
    await expect(send).toBeEnabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await primary.check();
    await person.uncheck();
    await expect(frame.locator("#greeting")).toHaveText("Vážená pani MUDr. Diana Klinická,");
    await expect(send).toBeEnabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
