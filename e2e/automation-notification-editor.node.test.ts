import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig";
import { getNotificationCopy } from "../client/src/i18n/automation-notification-copy";

test("real notification modal: cursor variables, saved copies, cancel, language filtering and mobile bounds", async () => {
  for (const locale of ["sk", "en", "cs", "hu", "ro", "it", "de"])
    assert.deepEqual(Object.keys(getNotificationCopy(locale)), Object.keys(getNotificationCopy("en")));
  const result = await build({
    stdin: { contents: `
      import React,{useState} from "react";
      import {createRoot} from "react-dom/client";
      import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
      import {AutomationNotifyUserAction} from "./client/src/components/automation-notify-user-action";
      import {Dialog,DialogContent,DialogTitle,DialogDescription} from "./client/src/components/ui/dialog";
      const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
      client.setQueryData(["/api/message-templates","notification"],[
        {id:"sk-template",name:"Slovak",language:"sk",subject:"Template {{newValues.title}}",content:"Status {{newValues.status}}"},
        {id:"de-template",name:"German",language:"de",subject:"German title",content:"German body"},
        {id:"unsupported",name:"Unavailable",language:"sk",subject:"{{newValues.missing}}",content:"Not supported"}
      ]);
      function Fixture(){
        const [parentOpen,setParentOpen]=useState(true);
        const [config,setConfig]=useState({title:"Keep title",message:"Keep body",userId:"agent",priority:"normal",customSetting:"keep",
          templateId:"deleted-template",templateName:"Deleted saved copy",templateLanguage:"de",templateSnapshot:true});
        return <QueryClientProvider client={client}>
          <Dialog open={parentOpen} onOpenChange={setParentOpen}>
            <DialogContent data-testid="parent-rule" className="automation-rule-dialog task-modal-modern">
              <DialogTitle>Rule fixture</DialogTitle><DialogDescription>Notification action</DialogDescription>
              <AutomationNotifyUserAction config={config} onChange={setConfig} index={0}
                recipientSelector={<div data-testid="recipient">agent</div>}
                availableVariables={[{value:"newValues.title",label:"Task title"},{value:"newValues.status",label:"Status"}]}/>
            </DialogContent>
          </Dialog>
          <pre data-testid="config">{JSON.stringify(config)}</pre>
        </QueryClientProvider>;
      }
      createRoot(document.getElementById("root")).render(<Fixture/>);
    `, loader: "tsx", resolveDir: process.cwd() },
    plugins: [{
      name: "notification-test-language",
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
    "client/src/components/automation-notify-user-action.tsx",
    "client/src/components/ui/{dialog,input,textarea,button,badge,select,label}.tsx",
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
    await expect(page.getByTestId("notify-user-snapshot-0")).toContainText("Deleted saved copy");
    await page.getByTestId("notify-user-edit-0").click();
    const dialog = page.getByTestId("notify-user-editor-0");
    const title = page.getByTestId("notify-user-title-0"), message = page.getByTestId("notify-user-message-0");
    await expect(title).toHaveValue("Keep title");
    await title.fill("Before chosen after");
    await title.evaluate(element => {
      const input = element as HTMLInputElement; input.focus(); input.setSelectionRange(7, 13);
      input.dispatchEvent(new Event("select", { bubbles: true }));
    });
    await dialog.getByRole("button", { name: "{{newValues.title}}", exact: true }).click();
    await expect(title).toHaveValue("Before {{newValues.title}} after");
    await message.fill("Status chosen");
    await message.evaluate(element => {
      const input = element as HTMLTextAreaElement; input.focus(); input.setSelectionRange(7, 13);
      input.dispatchEvent(new Event("select", { bubbles: true }));
    });
    await dialog.getByRole("button", { name: "{{newValues.status}}", exact: true }).click();
    await expect(message).toHaveValue("Status {{newValues.status}}");
    assert.equal((await state()).title, "Keep title");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("parent-rule")).toBeVisible();
    assert.equal((await state()).message, "Keep body");
    await page.getByTestId("notify-user-edit-0").click();
    await expect(title).toHaveValue("Keep title");
    await page.getByTestId("notify-user-template-0").click();
    await expect(page.getByTestId("notify-template-option-deleted-template")).toBeVisible();
    await expect(page.getByTestId("notify-template-option-unsupported")).toHaveAttribute("data-disabled", "");
    await page.getByTestId("notify-template-option-sk-template").click();
    await expect(title).toHaveValue("Template {{newValues.title}}");
    await page.getByTestId("notify-user-template-language-0").click();
    await page.getByRole("option", { name: "Deutsch", exact: true }).click();
    await expect(title).toHaveValue("Template {{newValues.title}}");
    await page.getByTestId("notify-user-apply-0").click();
    const applied = await state();
    assert.equal(applied.templateId, "sk-template");
    assert.equal(applied.templateLanguage, "sk");
    assert.equal(applied.templateSnapshot, true);
    assert.equal(applied.notificationActionVersion, 2);
    assert.equal(applied.customSetting, "keep");
    assert.equal(applied.userId, "agent");
    await page.getByTestId("notify-user-edit-0").click();
    await message.fill("{{newValues.missing}}");
    await expect(page.getByTestId("notify-user-apply-0")).toBeDisabled();
    await expect(page.getByTestId("notify-user-unsupported-0")).toBeVisible();
    await dialog.getByRole("button", { name: getNotificationCopy("sk").cancel, exact: true }).click();
    assert.equal((await state()).message, "Status {{newValues.status}}");
    for (const viewport of [{ width: 1280, height: 600 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.getByTestId("notify-user-edit-0").click();
      const bounds = await dialog.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1);
      await page.getByTestId("notify-user-apply-0").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("notify-user-apply-0")).toBeInViewport();
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("parent-rule")).toBeVisible();
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
