import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig";

test("task recipient modal, template language filters, and nested-dialog help behave at desktop and mobile sizes", async () => {
  const temp = await mkdtemp(join(tmpdir(), "indexus-automation-routing-"));
  const root = process.cwd();
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    await build({
      stdin: { contents: `
        import React,{useState} from "react";
        import {createRoot} from "react-dom/client";
        import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
        import {I18nProvider} from "./client/src/i18n";
        import {Dialog,DialogContent,DialogTitle} from "./client/src/components/ui/dialog";
        import {AutomationCreateTaskAction} from "./client/src/components/automation-create-task-action";
        import {AutomationSendEmailAction} from "./client/src/components/automation-send-email-action";
        import {AutomationStepHelp} from "./client/src/components/automation-step-help";
        const users=[{id:"person-1",label:"Mira Kovac"},{id:"person-2",label:"Tomas Novak"}];
        const groups=[{id:"group-new",name:"Care team",displayAlias:"Care team"}];
        const initial={title:"Saved task title",taskText:"Saved task instructions",assignedUserId:"person-2",taskGroupId:"missing-group",targetRole:"role:Legacy role",assignedDepartmentId:"department-old",assignedDepartmentName:"Old department",templateId:"task-de",templateLanguage:"de",templateName:"German snapshot"};
        const helpCopy={help:"Help",whenTitle:"When",when:["Select an event or schedule."],ifTitle:"If",if:["ALL requires every check. ANY requires at least one."],thenTitle:"Then",then:["Groups receive one shared task; people and roles receive personal tasks."],chooseRecipients:"Choose recipients",groupsFirst:"Groups",people:"People",groups:"Groups",roles:"Roles",searchRecipients:"Search recipients…",noMatches:"No matching recipients.",unavailable:"Saved recipient unavailable",selectionSummary:"Selected recipients",apply:"Apply",cancel:"Cancel",language:"Template language",allLanguages:"All languages",currentSnapshot:"Current saved snapshot"};
        function Fixture(){
          const [task,setTask]=useState(initial);
          const [roles,setRoles]=useState([{id:"role-new",name:"Coordinator"}]);
          window.loadRoleCatalog=()=>setRoles([{id:"role-new",name:"Coordinator"},{id:"role-old",name:"Legacy role"}]);
          const [email,setEmail]=useState({emailActionVersion:2,senderMode:"personal",templateId:"email-de",templateName:"German snapshot",templateLanguage:"de",subject:"Keep this subject",body:"<p>Keep this body</p>",to:"",cc:"",bcc:"",toTargets:[],ccTargets:[],bccTargets:[]});
          return <Dialog open><DialogContent className="automation-rule-dialog task-modal-modern" data-testid="parent-rule-dialog">
            <DialogTitle>Rule draft fixture</DialogTitle>
            <div className="automation-rule-dialog-content">
              <AutomationCreateTaskAction config={task} onChange={setTask} users={users} groups={groups} roles={roles} availableVariables={[]} testId="task-action"/>
              <AutomationSendEmailAction config={email} onChange={setEmail} users={[]} groups={[]} roles={[]} countryCodes={["US"]} ruleId="rule-fixture" availableVariables={[]} recipientTemplates={[]} testId="email-action"/>
              <div className="automation-help-fixture">
                <AutomationStepHelp step="when" copy={helpCopy}/>
                <AutomationStepHelp step="if" copy={helpCopy}/>
                <AutomationStepHelp step="then" copy={helpCopy}/>
              </div>
              <pre data-testid="task-state">{JSON.stringify(task)}</pre>
              <pre data-testid="email-state">{JSON.stringify(email)}</pre>
            </div>
          </DialogContent></Dialog>;
        }
        const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
        createRoot(document.getElementById("root")).render(<QueryClientProvider client={client}><I18nProvider userCountries={["US"]}><Fixture/></I18nProvider></QueryClientProvider>);
      `, loader: "tsx", resolveDir: root },
      bundle: true, format: "iife", platform: "browser", jsx: "automatic",
      outfile: join(temp, "fixture.js"), define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
    });
    const script = await readFile(join(temp, "fixture.js"), "utf8");
    const bundledCss = await readFile(join(temp, "fixture.css"), "utf8").catch(() => "");
    const actualStyles = await postcss([tailwindcss({ ...loadConfig(join(root, "tailwind.config.ts")), content: [
      "client/src/components/automation-{create-task-action,task-recipient-dialog,step-help,send-email-action,email-content-editor}.tsx",
      "client/src/components/ui/{dialog,input,textarea,button,tabs,badge,select,label,popover}.tsx",
    ] })]).process(await readFile(join(root, "client/src/index.css"), "utf8"), { from: join(root, "client/src/index.css") });
    const css = bundledCss
      + actualStyles.css
      + await readFile(join(root, "client/src/pages/automations-workspace.css"), "utf8")
      + await readFile(join(root, "client/src/components/tasks/task-modal-modern.css"), "utf8");
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const templates = [
      { id: "task-en", type: "task", name: "English task", subject: "English title", content: "English instructions", language: "en", isActive: true },
      { id: "task-de", type: "task", name: "German snapshot", subject: "German title", content: "German instructions", language: "de", isActive: false },
      { id: "email-en", name: "English email", categoryId: "auto", subject: "English email subject", contentHtml: "<p>English email body</p>", language: "en", countryCodes: ["US"] },
      { id: "email-de", name: "German snapshot", categoryId: "auto", subject: "German email subject", contentHtml: "<p>German email body</p>", language: "de", countryCodes: ["US"] },
    ];
    await page.route("http://automation.test/**", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/fixture.js") return route.fulfill({ contentType: "application/javascript", body: script });
      if (url.pathname === "/fixture.css") return route.fulfill({ contentType: "text/css", body: css });
      if (url.pathname === "/api/message-templates") return route.fulfill({ json: url.searchParams.get("type") === "task" ? templates.filter(t => t.type === "task") : templates.filter(t => !t.type) });
      if (url.pathname === "/api/template-categories") return route.fulfill({ json: [{ id: "auto", name: "Automation" }] });
      if (url.pathname === "/api/automation/email-mailboxes") return route.fulfill({ json: { personal: { connected: true, email: "staff@example.test" }, system: [] } });
      if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: '<html><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>' });
      return route.fulfill({ status: 404, body: "Unknown fixture request" });
    });
    await page.goto("http://automation.test/");
    const originalTask = JSON.parse(await page.getByTestId("task-state").innerText());
    const legacyTargetDialog = page.getByTestId("button-edit-task-recipients");
    await legacyTargetDialog.click();
    await page.evaluate(() => (window as any).loadRoleCatalog());
    await page.getByTestId("recipient-view-role").click();
    await expect(page.getByTestId("recipient-option-role-role-old")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("task-recipient-apply").click();
    assert.deepEqual(JSON.parse(await page.getByTestId("task-state").innerText()), originalTask,
      "applying the untouched selection after role data loads must not migrate legacy assignments");
    await page.getByTestId("automation-if-help").click();
    await expect(page.getByTestId("automation-if-help-content")).toContainText("ALL requires every check");
    await page.keyboard.press("Escape");
    await page.getByTestId("automation-then-help").click();
    await expect(page.getByTestId("automation-then-help-content")).toContainText("one shared task");
    await page.keyboard.press("Escape");
    await page.getByTestId("automation-when-help").click();
    await expect(page.getByTestId("automation-when-help-content")).toContainText("event or schedule");
    await page.keyboard.press("Escape");

    for (const viewport of [{ width: 1280, height: 720 }, { width: 1280, height: 520 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.getByTestId("button-edit-task-recipients").click();
      const modal = page.getByTestId("task-recipient-dialog");
      await expect(modal).toBeVisible();
      await expect(page.getByTestId("recipient-view-group")).toHaveAttribute("aria-pressed", "true");
      const box = await modal.boundingBox();
      assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
        `recipient modal must fit ${viewport.width}x${viewport.height}: ${JSON.stringify(box)}`);
      const close = await page.getByTestId("task-recipient-close").boundingBox();
      assert.ok(close && close.x > box.x + box.width - 70, "close X remains at upper right despite global hover styling");
      await expect(page.getByTestId("task-recipient-apply")).toBeInViewport();
      await page.screenshot({ path: `/tmp/automation-recipient-${viewport.width}x${viewport.height}.png` });
      await page.getByTestId("recipient-search").fill("Care");
      await page.getByTestId("recipient-option-group-group-new").click();
      await page.getByTestId("recipient-view-user").click();
      await page.getByTestId("recipient-option-user-person-1").click();
      await page.getByTestId("recipient-view-role").click();
      await page.getByTestId("recipient-option-role-role-new").click();
      await page.keyboard.press("Escape");
      await expect(modal).toHaveCount(0);
      await expect(page.getByTestId("parent-rule-dialog")).toBeVisible();
      assert.deepEqual(JSON.parse(await page.getByTestId("task-state").innerText()), originalTask, "cancel/Escape must not mutate the persisted rule draft");
    }

    await page.getByTestId("button-edit-task-recipients").click();
    await page.getByTestId("recipient-option-group-group-new").click();
    await page.getByTestId("recipient-view-user").click();
    await page.getByTestId("recipient-option-user-person-1").click();
    await page.getByTestId("recipient-view-role").click();
    await page.getByTestId("recipient-option-role-role-new").click();
    await page.getByTestId("task-recipient-apply").click();
    const appliedTask = JSON.parse(await page.getByTestId("task-state").innerText());
    assert.deepEqual(appliedTask.recipients, [
      { kind: "user", id: "person-2" }, { kind: "group", id: "missing-group" }, { kind: "role", id: "role-old" },
      { kind: "group", id: "group-new" }, { kind: "user", id: "person-1" }, { kind: "role", id: "role-new" },
    ]);
    assert.equal("assignedUserId" in appliedTask, false);
    assert.equal("taskGroupId" in appliedTask, false);
    assert.equal("targetRole" in appliedTask, false);
    await page.getByTestId("button-edit-task-recipients").click();
    await expect(page.getByTestId("recipient-option-group-group-new")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("recipient-view-group")).toContainText("2");
    await page.getByTestId("task-recipient-close").click();

    const taskLanguage = page.getByTestId("select-task-template-language");
    await expect(taskLanguage).toContainText("English");
    await page.getByTestId("select-task-template-language").click();
    await expect(page.getByRole("option", { name: "All languages" })).toBeVisible();
    await page.getByRole("option", { name: "Deutsch" }).click();
    await expect(page.getByTestId("select-task-action-template")).toContainText("German snapshot");
    const taskAfterFilter = JSON.parse(await page.getByTestId("task-state").innerText());
    assert.equal(taskAfterFilter.title, "Saved task title");
    assert.equal(taskAfterFilter.taskText, "Saved task instructions");
    assert.equal(taskAfterFilter.templateLanguage, "de");

    await page.getByTestId("email-action-open-editor").click();
    await expect(page.getByTestId("email-action-editor-template-language")).toContainText("English");
    await page.getByTestId("email-action-editor-template-language").click();
    await page.getByRole("option", { name: "Deutsch" }).click();
    const emailState = JSON.parse(await page.getByTestId("email-state").innerText());
    assert.equal(emailState.subject, "Keep this subject");
    assert.equal(emailState.body, "<p>Keep this body</p>");
    assert.equal(emailState.templateLanguage, "de");
    await expect(page.getByTestId("email-action-editor-template")).toContainText("German snapshot");
    await page.getByTestId("email-action-editor-close").click();
    await expect(page.getByTestId("parent-rule-dialog")).toBeVisible();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await rm(temp, { recursive: true, force: true });
  }
});
