import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig";
import editorCopy from "../client/src/i18n/send-email-editor-translations";

test("automation email modal edits the real rule draft safely, preserves recipients and fits desktop/mobile", async () => {
  const translationSource = ts.createSourceFile("translations.ts", await readFile("client/src/i18n/translations.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const emailCopy = translationSource.statements.find(node => ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(decl => ts.isIdentifier(decl.name) && decl.name.text === "sendEmailActionTranslations"))!;
  assert.ok(emailCopy);
  for (const copy of Object.values(editorCopy)) assert.deepEqual(Object.keys(copy), Object.keys(editorCopy.en));
  const result = await build({
    stdin: { contents: `
      import React,{useState} from "react";
      import {createRoot} from "react-dom/client";
      import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
      import {AutomationSendEmailAction} from "./client/src/components/automation-send-email-action";
      import {Dialog,DialogContent,DialogTitle,DialogDescription} from "./client/src/components/ui/dialog";
      const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
      client.setQueryData(["/api/automation/email-mailboxes",undefined],{personal:{connected:true,email:"author@example.test"},system:[]});
      client.setQueryData(["/api/message-templates","email",true],[]);
      client.setQueryData(["/api/template-categories"],[]);
      function Fixture(){
        const [parentOpen,setParentOpen]=useState(true);
        const [config,setConfig]=useState({subject:"Initial subject",body:'<p>Initial body</p>',senderMode:"personal",to:"contact@example.test",templateId:"saved-template",templateSnapshot:true,templateName:"Saved copy",customSetting:"keep"});
        return <QueryClientProvider client={client}>
          <Dialog open={parentOpen} onOpenChange={setParentOpen}>
            <DialogContent className="task-modern-modal automation-rule-dialog overflow-y-auto" overlayClassName="task-modern-modal-overlay" data-testid="parent-rule">
              <DialogTitle>Rule editor</DialogTitle><DialogDescription>Existing rule draft</DialogDescription>
              <div className="overflow-y-auto p-4"><AutomationSendEmailAction config={config} onChange={setConfig} users={[]} groups={[]} roles={[]} countryCodes={[]}
                availableVariables={[{value:"newValues.firstName",label:"Contact name"}]} recipientTemplates={[]} testId="mail"/></div>
            </DialogContent>
          </Dialog>
          <pre data-testid="config">{JSON.stringify(config)}</pre>
        </QueryClientProvider>;
      }
      createRoot(document.getElementById("root")).render(<Fixture/>);
    `, loader: "tsx", resolveDir: process.cwd() },
    plugins: [{
      name: "test-language-context",
      setup(builder) {
        builder.onResolve({ filter: /^@\/i18n$/ }, () => ({ path: "language", namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `import editorCopy from "./client/src/i18n/send-email-editor-translations"; ${emailCopy.getText(translationSource)}
            export const useI18n=()=>({t:{sendEmailAction:sendEmailActionTranslations.sk,sendEmailEditor:editorCopy.sk,common:{close:"Zavrieť"}}});`,
          resolveDir: process.cwd(), loader: "ts",
        }));
      },
    }],
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const styles = await postcss([tailwindcss({ ...loadConfig(`${process.cwd()}/tailwind.config.ts`), content: [
    "client/src/components/automation-email-content-editor.tsx", "client/src/components/automation-send-email-action.tsx",
    "client/src/components/ui/{dialog,input,textarea,button,tabs,badge,select,label}.tsx",
  ] })]).process("@tailwind base; @tailwind components; @tailwind utilities;", { from: undefined });
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors: string[] = [], writes: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.method() !== "GET") writes.push(request.url()); });
    await page.route("**/api/automation/email-artwork/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' }));
    await page.setContent('<div id="root"></div>');
    await page.addStyleTag({ content: styles.css + await readFile("client/src/components/tasks/task-modal-modern.css", "utf8") + await readFile("client/src/pages/automations-workspace.css", "utf8") });
    await page.addStyleTag({ content: ":root{--background:0 0% 100%;--foreground:222 25% 15%;--card:0 0% 100%;--muted:220 16% 95%;--muted-foreground:220 10% 40%;--border:220 15% 85%;--primary:200 75% 35%;--primary-foreground:0 0% 100%}" });
    await page.addScriptTag({ content: result.outputFiles[0].text });
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.locator("textarea")).toHaveCount(0);
    await page.getByLabel("E-mailová adresa", { exact: true }).fill("incomplete@");
    await page.getByTestId("mail-open-editor").click();
    const dialog = page.getByTestId("mail-content-editor");
    const body = page.getByTestId("mail-editor-body"), subject = page.getByTestId("mail-editor-subject");
    const frame = page.frameLocator('[data-testid="mail-editor-preview"]');
    await expect(dialog).toBeVisible();
    assert.ok(await dialog.evaluate(element => Number(getComputedStyle(element).zIndex)) >
      await page.getByTestId("parent-rule").evaluate(element => Number(getComputedStyle(element).zIndex)));
    await expect(page.getByTestId("mail-editor-preview")).toHaveAttribute("sandbox", "");
    await body.fill('<p id="live">Original replace end</p>');
    await expect(frame.locator("#live")).toHaveText("Original replace end");
    await body.evaluate(element => {
      const field = element as HTMLTextAreaElement;
      const start = field.value.indexOf("replace");
      field.focus(); field.setSelectionRange(start, start + 7);
      field.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    await page.getByTestId("mail-editor-variable-newValues.firstName").click();
    await expect(body).toHaveValue('<p id="live">Original {{newValues.firstName}} end</p>');
    await subject.fill("Hello chosen person");
    await subject.evaluate(element => {
      const field = element as HTMLInputElement;
      field.focus(); field.setSelectionRange(6, 12);
      field.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    await page.getByTestId("mail-editor-variable-newValues.firstName").click();
    await expect(subject).toHaveValue("Hello {{newValues.firstName}} person");
    await body.fill('<p id="safe">Safe preview</p><img src="cid:indexus-automation-task"><script>window.parent.__previewScriptRan=true</script>');
    await expect(frame.locator("#safe")).toHaveText("Safe preview");
    await expect(page.getByTestId("mail-editor-preview")).toHaveAttribute("srcdoc", /\/api\/automation\/email-artwork\/task/);
    assert.equal(await page.evaluate(() => (window as any).__previewScriptRan), undefined);
    const config = JSON.parse(await page.getByTestId("config").innerText());
    assert.ok(config.body.includes("cid:indexus-automation-task"));
    assert.equal(config.templateId, "saved-template");
    assert.equal(config.templateSnapshot, true);
    assert.equal(config.senderMode, "personal");
    assert.equal(config.to, "contact@example.test");
    assert.equal(config.customSetting, "keep");
    await page.screenshot({ path: "/tmp/automation-email-editor-desktop.png" });
    const bodyBounds = await body.boundingBox(), previewBounds = await page.getByTestId("mail-editor-preview").boundingBox();
    assert.ok(bodyBounds && previewBounds && previewBounds.x > bodyBounds.x + bodyBounds.width);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("parent-rule")).toBeVisible();
    await expect(page.getByLabel("E-mailová adresa", { exact: true })).toHaveValue("incomplete@");
    await page.getByTestId("mail-open-editor").click();
    await expect(subject).toHaveValue("Hello {{newValues.firstName}} person");
    await expect(body).toHaveValue(config.body);
    await page.setViewportSize({ width: 1280, height: 520 });
    await expect(page.getByTestId("mail-editor-close")).toBeInViewport();
    assert.equal(await dialog.evaluate(element => element.scrollHeight <= element.clientHeight + 1), true);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => {
      const bounds = await dialog.boundingBox();
      return !!bounds && bounds.x >= 0 && bounds.width <= 390 && bounds.x + bounds.width <= 390;
    }).toBe(true);
    await expect(page.getByTestId("mail-editor-close")).toBeInViewport();
    await page.screenshot({ path: "/tmp/automation-email-editor-mobile.png" });
    const mobileBody = await body.boundingBox(), mobilePreview = await page.getByTestId("mail-editor-preview").boundingBox();
    assert.ok(mobileBody && mobilePreview && mobilePreview.y > mobileBody.y);
    const variablesBounds = await page.getByText(editorCopy.sk.variables, { exact: true }).boundingBox();
    assert.ok(mobileBody && variablesBounds && mobileBody.y + mobileBody.height <= variablesBounds.y);
    assert.equal(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1), true);
    await page.getByTestId("mail-editor-close").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("parent-rule")).toBeVisible();
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
  } finally { await browser.close(); }
});
