import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";

/** Real production components in an isolated fixture, never an app auth bypass. */
test("automation editors preserve multiline checklist drafts and recipient selections", async () => {
  const temp = await mkdtemp(join(tmpdir(), "indexus-automation-editors-"));
  const root = process.cwd();
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    await build({
      stdin: { contents: `
        import React, {useState} from "react";
        import {createRoot} from "react-dom/client";
        import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
        import {I18nProvider} from "./client/src/i18n";
        import {AutomationCreateTaskAction} from "./client/src/components/automation-create-task-action";
        import {AutomationSendEmailAction} from "./client/src/components/automation-send-email-action";
        import {emailActionIssues} from "./shared/automation-email-action";
        const countries = ["SK"];
        const users=[{id:"user-a",fullName:"Anna Agent",email:"anna@example.test"}];
        const groups=[{id:"group-a",name:"Operations",displayAlias:"Tím operácií"}];
        const roles=[{id:"role-a",name:"Manager"}];
        function Fixture() {
          const [task,setTask]=useState({title:"Test task",taskText:"Test content",recipients:[{kind:"group",id:"group-a"}],checklist:[]});
          const [email,setEmail]=useState({emailActionVersion:2,senderMode:"personal",subject:"Test notice",body:"Test body",to:"",cc:"",bcc:"",toTargets:[],ccTargets:[],bccTargets:[]});
          const [saved,setSaved]=useState(null);
          const [draftInvalid,setDraftInvalid]=useState(false);
          return <main style={{maxWidth:740,margin:"20px auto"}}>
            <AutomationCreateTaskAction config={task} onChange={setTask} users={users.map(user=>({id:user.id,label:user.fullName}))}
              groups={groups} roles={roles} availableVariables={[]} testId="task-action"/>
            <button data-testid="external-checklist-reset" onClick={()=>setTask({...task,checklist:["External item"]})}>Reset checklist</button>
            <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}} data-testid="task-state">{JSON.stringify(task.checklist)}</pre>
            <AutomationSendEmailAction config={email} onChange={setEmail} users={users} groups={groups} roles={roles}
              countryCodes={countries} ruleId="fixture-rule" availableVariables={[{value:"newValues.email",label:"E-mail klienta"}]}
              recipientTemplates={["newValues.email"]} testId="email-action" onDraftValidityChange={setDraftInvalid}/>
             <button style={{position:"fixed",bottom:24,right:24,zIndex:100}} data-testid="save-fixture-email" disabled={draftInvalid || emailActionIssues(email).length>0} onClick={()=>setSaved(email)}>Save fixture email</button>
            <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}} data-testid="email-state">{JSON.stringify(email)}</pre>
            <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}} data-testid="saved-email-state">{JSON.stringify(saved)}</pre>
          </main>;
        }
        const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
        createRoot(document.getElementById("root")).render(<QueryClientProvider client={queryClient}>
          <I18nProvider userCountries={countries}><Fixture/></I18nProvider>
        </QueryClientProvider>);
      `, loader: "tsx", resolveDir: root },
      bundle: true, format: "iife", platform: "browser", jsx: "automatic",
      outfile: join(temp, "fixture.js"), define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });
    const script = await readFile(join(temp, "fixture.js"), "utf8");
    let css = await readFile(join(temp, "fixture.css"), "utf8").catch(() => "");
    const assets = await readdir(join(root, "dist/public/assets")).catch(() => []);
    const styleName = assets.find(name => /^index-.*\.css$/.test(name));
    if (styleName) css += await readFile(join(root, "dist/public/assets", styleName), "utf8");
    const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const templates = [
      { id: "generic-template", name: "A generic email", categoryId: "general-category", subject: "Generic", content: "Generic body", countryCodes: [] },
      { id: "automation-template", name: "Zmena údajov", categoryId: "indexus-automation-email-category", subject: "Automation", content: "Automation body", countryCodes: ["SK"] },
      { id: "foreign-template", name: "Italian automation", categoryId: "indexus-automation-email-category", subject: "Foreign", content: "Foreign body", countryCodes: ["IT"] },
      { id: "named-auto-template", name: "Ručná automatizácia", categoryId: "named-automation-category", subject: "Named automation", content: "Named automation body", countryCodes: ["SK"] },
    ];
    await page.route("http://automation.test/**", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/fixture.js") return route.fulfill({ contentType: "application/javascript", body: script });
      if (url.pathname === "/fixture.css") return route.fulfill({ contentType: "text/css", body: css });
      if (url.pathname === "/api/message-templates") return route.fulfill({ json: url.searchParams.get("type") === "task" ? [] : templates });
      if (url.pathname === "/api/template-categories") return route.fulfill({ json: [
        { id: "general-category", name: "General" },
        { id: "indexus-automation-email-category", name: "Automatizácia" },
        { id: "named-automation-category", name: "Automatizácia" },
      ] });
      if (url.pathname === "/api/automation/email-mailboxes") return route.fulfill({ json: {
        personal: { connected: true, email: "author@example.test", displayName: "Rule author" }, system: [],
      } });
      if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: '<html><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>' });
      return route.fulfill({ status: 404, body: "Fixture endpoint not found" });
    });
    await page.goto("http://automation.test/");
    const taskRoot = page.getByTestId("task-action");
    await taskRoot.locator("summary").filter({ hasText: /zoznam/i }).click();
    const checklist = page.getByTestId("task-action-checklist");
    await checklist.fill("First item");
    await checklist.press("Enter");
    assert.equal(await checklist.inputValue(), "First item\n");
    await checklist.press("Enter");
    assert.equal(await checklist.inputValue(), "First item\n\n");
    await checklist.pressSequentially("Second item");
    assert.equal(await checklist.inputValue(), "First item\n\nSecond item");
    assert.deepEqual(JSON.parse(await page.getByTestId("task-state").innerText()), ["First item", "Second item"]);
    await page.getByTestId("external-checklist-reset").click();
    await expect(checklist).toHaveValue("External item");
    const emailRoot = page.getByTestId("email-action");
    assert.equal(await emailRoot.getByRole("tabpanel").count(), 1);
    assert.equal(await emailRoot.getByRole("tab").count(), 3);
    await page.locator("#email-action-to-address").fill("main@example.test");
    await emailRoot.getByRole("tabpanel").getByRole("button", { name: "Pridať", exact: true }).click();
    await emailRoot.getByRole("tabpanel").getByRole("button", { name: "E-mail klienta", exact: true }).click();
    assert.equal(JSON.parse(await page.getByTestId("email-state").innerText()).to, "main@example.test, {{newValues.email}}");
    await emailRoot.getByRole("tab", { name: /^CC\b/ }).click();
    assert.equal(await emailRoot.getByRole("tabpanel").count(), 1);
    await page.locator("#email-action-cc-address").fill("copy@example.test");
    await emailRoot.getByRole("tab", { name: /^BCC\b/ }).click();
    assert.equal(JSON.parse(await page.getByTestId("email-state").innerText()).cc, "copy@example.test");
    await page.locator("#email-action-bcc-address").fill("hidden@example.test");
    // A complete address commits before the external Save button executes.
    await page.getByTestId("save-fixture-email").click();
    assert.equal(JSON.parse(await page.getByTestId("saved-email-state").innerText()).bcc, "hidden@example.test");
    await emailRoot.getByRole("tab", { name: /^CC\b/ }).click();
    await page.locator("#email-action-cc-address").fill("incomplete");
    await emailRoot.getByRole("tab", { name: /^BCC\b/ }).click();
    await expect(page.getByTestId("save-fixture-email")).toBeDisabled();
    await emailRoot.getByRole("tab", { name: /^CC\b/ }).click();
    assert.equal(await page.locator("#email-action-cc-address").inputValue(), "incomplete");
    await page.locator("#email-action-cc-address").fill("");
    await page.getByTestId("save-fixture-email").click();
    await expect(page.getByTestId("save-fixture-email")).toBeEnabled();
    await page.getByTestId("email-action-open-editor").click();
    await page.getByTestId("email-action-editor-template-language").click();
    await page.getByRole("option", { name: "Všetky jazyky", exact: true }).click();
    await page.getByTestId("email-action-editor-template").click();
    const choices = await page.getByRole("option").allTextContents();
    assert.ok(choices.findIndex(value => value.includes("Zmena údajov")) < choices.findIndex(value => value.includes("A generic email")));
    assert.ok(choices.findIndex(value => value.includes("Ručná automatizácia")) < choices.findIndex(value => value.includes("A generic email")));
    assert.equal(choices.some(value => value.includes("Italian automation")), false);
    await page.getByRole("option").filter({ hasText: "Zmena údajov" }).click();
    assert.equal(JSON.parse(await page.getByTestId("email-state").innerText()).templateSnapshot, true);
    await page.getByTestId("email-action-editor-close").click();
    await page.setViewportSize({ width: 390, height: 900 });
    const widths = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth }));
    assert.ok(widths.body <= widths.viewport, "recipient editor must not overflow on a phone");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await rm(temp, { recursive: true, force: true });
  }
});
