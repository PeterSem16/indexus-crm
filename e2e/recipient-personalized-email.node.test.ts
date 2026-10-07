import test from "node:test";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { build } from "esbuild";

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
