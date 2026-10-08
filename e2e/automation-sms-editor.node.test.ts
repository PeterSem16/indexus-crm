import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig";
import { getSmsActionCopy, smsCountryNames } from "../client/src/i18n/automation-sms-copy";

test("SMS editor: explicit multiple phones, prefix selection, modal variables/snapshots and responsive layout", async () => {
  for (const locale of ["sk", "en", "cs", "hu", "ro", "it", "de"]) {
    assert.deepEqual(Object.keys(getSmsActionCopy(locale)), Object.keys(getSmsActionCopy("en")));
    assert.equal(Object.keys(smsCountryNames[locale as keyof typeof smsCountryNames]).length, 9);
  }
  const result = await build({
    stdin: { contents: `
      import React,{useState} from "react";
      import {createRoot} from "react-dom/client";
      import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
      import {AutomationSendSmsAction} from "./client/src/components/automation-send-sms-action";
      import {Dialog,DialogContent,DialogTitle,DialogDescription} from "./client/src/components/ui/dialog";
      const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
      client.setQueryData(["/api/message-templates","sms"],[
        {id:"sk",name:"Slovak",language:"sk",content:"Task {{newValues.title}}"},
        {id:"de",name:"German",language:"de",content:"German text"},
        {id:"unsupported",name:"Unsupported",language:"sk",content:"{{newValues.missing}}"}
      ]);
      function Fixture(){
        const [parentOpen,setParentOpen]=useState(true);
        const [config,setConfig]=useState({smsActionVersion:2,to:["+421900123456"],text:"Original text",kind:"transactional",
          unicode:true,templateId:"deleted",templateName:"Deleted saved text",templateLanguage:"de",templateSnapshot:true,customSetting:"keep"});
        const [invalid,setInvalid]=useState(false);
        window.loadLegacy=()=>setConfig({to:"{{newValues.phone}}",text:"Legacy message",country:"CZ",customSetting:"legacy"});
        window.loadScalar=()=>setConfig({to:"+421900123456",text:"Scalar message"});
        return <QueryClientProvider client={client}>
          <Dialog open={parentOpen} onOpenChange={setParentOpen}>
             <DialogContent data-testid="parent-rule" className="task-modern-modal automation-editor-dialog automation-rule-dialog max-h-[90dvh]" overlayClassName="task-modern-modal-overlay">
              <DialogTitle>Rule fixture</DialogTitle><DialogDescription>SMS action</DialogDescription>
              <AutomationSendSmsAction config={config} onChange={setConfig} testId="sms" countryCodes={["CZ"]}
                onDraftValidityChange={setInvalid} availableVariables={[{value:"newValues.title",label:"Task title"}]}/>
              <button data-testid="parent-save" disabled={invalid}>Save rule</button>
            </DialogContent>
          </Dialog>
          <pre data-testid="config">{JSON.stringify(config)}</pre>
        </QueryClientProvider>;
      }
      createRoot(document.getElementById("root")).render(<Fixture/>);
    `, loader: "tsx", resolveDir: process.cwd() },
    plugins: [{
      name: "sms-test-language",
      setup(builder) {
        builder.onResolve({ filter: /^@\/i18n$/ }, () => ({ path: "language", namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `export const useI18n=()=>({locale:"sk",t:{common:{close:"Zavrieť"}}});`, loader: "ts",
        }));
      },
    }],
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const styles = await postcss([tailwindcss({ ...loadConfig(`${process.cwd()}/tailwind.config.ts`), content: [
    "client/src/components/automation-send-sms-action.tsx", "client/src/components/phone-number-field.tsx",
    "client/src/components/ui/{dialog,input,textarea,button,badge,select,label,popover,command}.tsx",
  ] })]).process(await readFile("client/src/index.css", "utf8"), { from: `${process.cwd()}/client/src/index.css` });
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setContent('<div id="root"></div>');
    await page.addStyleTag({ content: styles.css + await readFile("client/src/components/tasks/task-modal-modern.css", "utf8") + await readFile("client/src/pages/automations-workspace.css", "utf8") });
    await page.addScriptTag({ content: result.outputFiles[0].text });
    const state = async () => JSON.parse(await page.getByTestId("config").innerText());
    await expect(page.getByTestId("sms-recipient-0-country")).toContainText("+421");
    await expect(page.getByTestId("parent-save")).toBeEnabled();
    await page.getByTestId("sms-add-recipient").click();
    await expect(page.getByTestId("sms-recipient-1-country")).toContainText("+420");
    await expect(page.getByTestId("parent-save")).toBeDisabled();
    await page.getByTestId("sms-recipient-1-number").fill("600123456");
    await expect(page.getByTestId("parent-save")).toBeEnabled();
    assert.deepEqual((await state()).to, ["+421900123456", "+420600123456"]);
    await page.getByTestId("sms-recipient-1-country").click();
    await page.getByTestId("sms-recipient-1-country-SK").click();
    await page.getByTestId("sms-recipient-1-number").fill("900123456");
    await expect(page.getByTestId("parent-save")).toBeDisabled();
    await page.getByTestId("sms-recipient-1-number").fill("901123456");
    await expect(page.getByTestId("parent-save")).toBeEnabled();
    await page.getByTestId("sms-remove-recipient-0").click();
    assert.deepEqual((await state()).to, ["+421901123456"]);
    await page.getByTestId("sms-kind").click();
    await page.getByRole("option", { name: getSmsActionCopy("sk").promotional, exact: true }).click();
    assert.equal((await state()).kind, "promotional");
    await expect(page.getByTestId("sms")).toContainText(getSmsActionCopy("sk").kindHelp);
    await page.getByTestId("sms-open-editor").click();
    const dialog = page.getByTestId("sms-editor"), text = page.getByTestId("sms-text");
    await text.fill("Before chosen after");
    await text.evaluate(element => {
      const input = element as HTMLTextAreaElement; input.focus(); input.setSelectionRange(7, 13);
      input.dispatchEvent(new Event("select", { bubbles: true }));
    });
    await dialog.getByRole("button", { name: "{{newValues.title}}", exact: true }).click();
    await expect(text).toHaveValue("Before {{newValues.title}} after");
    assert.equal((await state()).text, "Original text");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("parent-rule")).toBeVisible();
    assert.equal((await state()).text, "Original text");
    await page.getByTestId("sms-open-editor").click();
    await expect(text).toHaveValue("Original text");
    await page.getByTestId("sms-template").click();
    await expect(page.getByRole("option", { name: /Deleted saved text/ })).toBeVisible();
    await expect(page.getByTestId("sms-template-option-unsupported")).toHaveAttribute("data-disabled", "");
    await page.getByTestId("sms-template-option-sk").click();
    await page.getByTestId("sms-template-language").click();
    await page.getByRole("option", { name: "Deutsch", exact: true }).click();
    await expect(text).toHaveValue("Task {{newValues.title}}");
     await page.getByTestId("sms-template").click();
     await page.getByTestId("sms-template-option-de").click();
     await expect(text).toHaveValue("German text");
     await page.getByTestId("sms-template-language").click();
     await page.getByRole("option", { name: "Slovenčina", exact: true }).click();
     await expect(text).toHaveValue("German text", { timeout: 1000 });
     await page.getByTestId("sms-template").click();
     await page.getByTestId("sms-template-option-sk").click();
    await page.getByTestId("sms-apply").click();
    const applied = await state();
    assert.equal(applied.templateLanguage, "sk");
    assert.equal(applied.templateId, "sk");
    assert.equal(applied.templateSnapshot, true);
    assert.equal(applied.customSetting, "keep");
    assert.deepEqual(applied.to, ["+421901123456"]);
    await page.getByTestId("sms-open-editor").click();
    await text.fill("{{newValues.missing}}");
    await expect(page.getByTestId("sms-apply")).toBeDisabled();
    await page.getByTestId("sms-cancel").click();
    assert.equal((await state()).text, "Task {{newValues.title}}");
    for (const viewport of [{ width: 1280, height: 600 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.getByTestId("sms-open-editor").click();
       await expect(dialog).toHaveClass(/task-modern-modal--nested/);
      const bounds = await dialog.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1);
       await page.getByTestId("sms-template-language").click();
       await page.getByRole("option", { name: "Deutsch", exact: true }).click();
       await page.getByTestId("sms-template").click();
       await page.getByTestId("sms-template-option-de").click();
       await expect(text).toHaveValue("German text");
      await expect(page.getByTestId("sms-apply")).toBeInViewport();
       await expect(page.getByTestId("sms-cancel")).toBeInViewport();
       await page.screenshot({path: `/tmp/sms-compose-${viewport.width}.png`});
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("parent-rule")).toBeVisible();
       assert.equal((await state()).text, "Task {{newValues.title}}");
    }
    await page.evaluate(() => (window as any).loadLegacy());
    await expect(page.getByTestId("sms-replace-legacy")).toBeVisible();
    assert.equal((await state()).to, "{{newValues.phone}}");
    await page.getByTestId("sms-replace-legacy").click();
    await expect(page.getByTestId("sms-replace-legacy")).toHaveCount(0);
    await expect(page.getByTestId("parent-save")).toBeDisabled();
    assert.equal((await state()).country, undefined);
    assert.equal((await state()).legacyRecipient, undefined);
    await page.getByTestId("sms-recipient-0-number").fill("600123456");
    assert.deepEqual((await state()).to, ["+420600123456"]);
    await page.evaluate(() => (window as any).loadScalar());
    await expect(page.getByTestId("sms-replace-legacy")).toHaveCount(0);
    await expect(page.getByTestId("sms-recipient-0-country")).toContainText("+421");
    assert.equal((await state()).to, "+421900123456", "Mounting an old explicit recipient must not migrate saved config");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
