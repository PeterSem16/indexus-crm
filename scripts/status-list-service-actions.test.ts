import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import bcrypt from "bcrypt";
import { chromium, request, type Page } from "playwright";
import { pool } from "../server/db";
import { statusListServiceActions } from "../client/src/lib/status-list-action-draft";

// Native browser + real authenticated API + persisted DB. Configuration only:
// no enrolled contacts, execution requests, outgoing messages or webhooks.
const ids = Object.fromEntries(["user", "mission", "foreign", "step", "foreignStep", "question", "foreignQuestion", "action", "group", "email", "sms", "status", "callback"].map(key => [key, randomUUID()]));
const username = `service-actions-${ids.user}`, password = randomBytes(24).toString("hex");
const baseURL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const api = await request.newContext({ baseURL });
const root = `/api/campaigns/${ids.mission}/status-list/${ids.step}`;
const pictures = "generated-artifacts/status-list-service-actions";
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined, page: Page | undefined;
let checks = 0, executionRequests = 0;
const check = (value: unknown, label: string) => { assert.ok(value, label); checks++; };
const record = async (id: string) => (await pool.query("SELECT * FROM campaign_status_list_automations WHERE id=$1", [id])).rows[0];
try {
  await mkdir(pictures, { recursive: true });
  await pool.query("INSERT INTO users(id,username,email,full_name,password_hash,role,assigned_countries,is_active) VALUES($1,$2,$3,'Synthetic action admin',$4,'admin',ARRAY['SK'],true)", [ids.user, username, `${ids.user}@example.invalid`, await bcrypt.hash(password, 4)]);
  await pool.query("INSERT INTO campaigns(id,name,country_codes,settings) VALUES($1,'Synthetic service-action Mission',ARRAY['SK'],$3),($2,'Synthetic foreign Mission',ARRAY['SK'],'{}')", [ids.mission, ids.foreign, JSON.stringify({ smsProvider: "smstools" })]);
  await pool.query("INSERT INTO campaign_agents(campaign_id,user_id) VALUES($1,$2)", [ids.mission, ids.user]);
  await pool.query("INSERT INTO campaign_status_list_items(id,campaign_id,step_id,label,tab) VALUES($1,$2,'ACTION-01','Synthetic action source','retention'),($3,$4,'FOREIGN','Synthetic foreign source','retention')", [ids.step, ids.mission, ids.foreignStep, ids.foreign]);
  await pool.query("INSERT INTO campaign_status_list_questions(id,item_id,question_text) VALUES($1,$2,'Synthetic action question'),($3,$4,'Synthetic foreign question')", [ids.question, ids.step, ids.foreignQuestion, ids.foreignStep]);
  await pool.query("INSERT INTO task_groups(id,name) VALUES($1,'Synthetic action group')", [ids.group]);
  await pool.query("INSERT INTO message_templates(id,name,type,content,subject) VALUES($1,'Synthetic service email','email','Synthetic email body','Synthetic subject'),($2,'Synthetic service SMS','sms','Synthetic SMS body',null)", [ids.email, ids.sms]);
  await pool.query("INSERT INTO campaign_dispositions(id,campaign_id,name,code,action_type) VALUES($1,$2,'Synthetic finished','SYN-DONE','none'),($3,$2,'Synthetic callback','SYN-CALL','callback')", [ids.status, ids.mission, ids.callback]);
  const opaque = '{"futurePredicate":{"keep":[1,2]},"version":5}';
  await pool.query("INSERT INTO campaign_status_list_automations(id,status_list_item_id,action_type,target_role,task_description,condition_json,email_recipients,assign_notify,assign_notify_channels,notify_agent_pulse) VALUES($1,$2,'assign_task','role:back_office','Synthetic preserved action',$3,ARRAY['keep@example.invalid'],true,ARRAY['email','push'],true)", [ids.action, ids.step, opaque]);
  const login = await api.post("/api/auth/login", { data: { username, password } });
  check(login.ok(), "Synthetic manager authenticates through the real API");
  check((await api.post(`/api/campaigns/${ids.foreign}/status-list/${ids.step}/automations`, { data: { actionType: "assign_task" } })).status() === 404, "Root create rejects source from another Mission");
  check((await api.post(`${root}/questions/${ids.foreignQuestion}/automations`, { data: { actionType: "assign_task" } })).status() === 404, "Question create rejects a foreign question");
  browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ storageState: await api.storageState(), viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", req => { if (req.method() === "POST" && /\/(execute|run-automation|send-sms|send-email|run-action)(\/|$)/.test(new URL(req.url()).pathname)) executionRequests++; });
  await page.goto(`${baseURL}/campaigns/${ids.mission}?tab=settings&section=status_list`);
  await page.getByTestId("status-list-phase-retention").click();
  await page.getByTestId(`status-list-select-${ids.step}`).click();
  await page.getByTestId("status-list-toggle-fullscreen").click();
  await page.getByTestId("studio-stage-actions").click();
  const modal = () => page!.getByTestId("status-list-service-action-editor");
  const stage = async (name: string) => { await page!.getByTestId(`service-action-stage-${name}`).click(); };
  const save = async (method: string) => {
    await stage("review");
    const response = page!.waitForResponse(res => res.request().method() === method && res.url().includes("/automations") && !res.url().includes("automation-services"));
    await page!.getByTestId("status-list-automation-save").click();
    const result = await response;
    const row = await result.json();
    check(result.ok(), `Service action ${method} persists successfully (HTTP ${result.status()}, ${row.error || ""})`);
    await modal().waitFor({ state: "hidden" });
    return row;
  };
  await page.getByTestId(`service-action-edit-${ids.action}`).click();
  check(await modal().isVisible(), "Existing action opens the new editor, not AutomationForm");
  await stage("conditions");
  check(await page.getByTestId("service-action-condition-mode").inputValue() === "stored", "Unknown predicate is explicitly preserved, not replaced with always");
  await stage("details");
  await page.getByTestId("service-action-taskDescription").fill("Synthetic reviewed action");
  await save("PUT");
  const edited = await record(ids.action);
  check(edited.condition_json === opaque, "Native editing preserves opaque condition bytes");
  check(edited.assign_notify && edited.notify_agent_pulse && edited.email_recipients[0] === "keep@example.invalid" && edited.assign_notify_channels.length === 2, "Native editing preserves dormant settings and notification channels");
  await page.getByTestId(`service-action-edit-${ids.action}`).click();
  await stage("details");
  await page.getByTestId("service-action-taskDescription").fill("Synthetic unsaved");
  page.once("dialog", dialog => dialog.dismiss());
  await page.keyboard.press("Escape");
  check(await modal().isVisible(), "Rejecting discard keeps the action draft open");
  check(await page.getByTestId("service-action-taskDescription").inputValue() === "Synthetic unsaved", "Discard rejection retains all draft text");
  page.once("dialog", dialog => dialog.accept());
  await page.keyboard.press("Escape");
  await modal().waitFor({ state: "hidden" });
  check((await record(ids.action)).task_description === "Synthetic reviewed action", "Discard never writes the draft");

  const created: Record<string, any> = {};
  for (const type of statusListServiceActions) {
    await page.getByTestId("status-list-studio-actions").locator("button").filter({ has: page.locator("svg.lucide-plus") }).first().click();
    await page.getByTestId("service-action-type").selectOption(type);
    await stage("details");
    if (type === "assign_task") {
      await page.getByTestId("service-action-targetRole").selectOption(`group:${ids.group}`);
      await page.getByTestId("service-action-taskDescription").fill("Synthetic task with {{campaign.name}}");
      await page.getByTestId("service-action-taskPriority").selectOption("high");
    }
    if (["send_email_group", "notify_email"].includes(type)) await page.getByTestId("service-action-emailRecipients").fill("one@example.invalid;two@example.invalid");
    if (["send_email_group", "notify_email", "send_contact_email"].includes(type)) await page.getByTestId("service-action-emailTemplateId").selectOption(ids.email);
    if (type === "send_sms") {
      check(await page.getByTestId("service-action-smsProvider").isDisabled(), "Mission gateway cannot be overridden from an action");
      await page.getByTestId("service-action-taskDescription").fill("Synthetic SMS without sending");
    }
    if (type === "set_contact_status") {
      await page.getByTestId("service-action-dispositionId").selectOption(ids.callback);
      await page.getByTestId("service-action-callbackOffsetDays").fill("2");
      await page.getByTestId("service-action-callbackTime").fill("10:30");
      await page.getByTestId("service-action-notifyAgentPulse").check();
    }
    if (type === "set_callback") {
      await page.getByTestId("service-action-callbackOffsetDays").fill("-1");
      await stage("review");
      await page.getByTestId("status-list-automation-save").click();
      check(await modal().isVisible(), "Invalid callback delay cannot close/save the editor");
      await stage("details");
      await page.getByTestId("service-action-callbackOffsetDays").fill("3");
    }
    if (type === "sys_webhook") await page.getByTestId("service-action-webhookTarget").fill("https://example.invalid/configuration-only");
    created[type] = await save("POST");
    const persisted = await record(created[type].id);
    check(persisted.action_type === type && persisted.status_list_item_id === ids.step && persisted.question_id === null, `${type} persists once on the exact step source`);
  }
  check((await record(created.assign_task.id)).task_group_id === ids.group, "Task group selection persists independently of a role");
  check((await record(created.send_email_group.id)).email_recipients.length === 2, "Explicit multi-recipient emails persist as an array");
  const callback = await record(created.set_contact_status.id);
  check(callback.callback_offset_days === 2 && callback.callback_time === "10:30" && callback.notify_agent_pulse, "Callback disposition preserves delay, fixed time and Pulse notification");
  check((await record(created.send_sms.id)).sms_provider === null, "Mission-derived gateway does not leak a conflicting action override");

  await page.getByTestId(`service-action-edit-${created.assign_task.id}`).click();
  await stage("conditions");
  await page.getByTestId("service-action-condition-mode").selectOption("country");
  await page.getByTestId("service-action-condition-country").selectOption("CZ");
  await save("PUT");
  check((await record(created.assign_task.id)).condition_value === "CZ", "Country condition persists through the real editor");
  await page.getByTestId(`service-action-edit-${created.assign_task.id}`).click();
  await stage("details");
  await page.screenshot({ path: `${pictures}/desktop.jpg`, animations: "disabled" });
  await page.setViewportSize({ width: 402, height: 874 });
  const bounds = await modal().boundingBox();
  check(!!bounds && bounds.x >= 0 && bounds.x + bounds.width <= 403, "Action editor fits a mobile viewport");
  await page.screenshot({ path: `${pictures}/mobile.jpg`, animations: "disabled" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate("document.documentElement.classList.add('dark')");
  await page.screenshot({ path: `${pictures}/dark.jpg`, animations: "disabled" });
  await page.keyboard.press("Escape");
  await modal().waitFor({ state: "hidden" });
  await page.getByTestId("studio-stage-relationships").click();
  await page.getByText("Synthetic action question", { exact: true }).last().click();
  await page.getByTestId("studio-stage-actions").click();
  await page.getByTestId("status-list-studio-actions").locator("button").filter({ has: page.locator("svg.lucide-plus") }).first().click();
  await stage("details");
  await page.getByTestId("service-action-taskDescription").fill("Synthetic question-specific action");
  const questionAction = await save("POST");
  check((await record(questionAction.id)).question_id === ids.question, "Question action uses its own question create route");
  await page.getByTestId(`service-action-edit-${questionAction.id}`).click();
  await stage("details");
  await page.getByTestId("service-action-taskDescription").fill("Synthetic retry draft");
  await page.route("**/automations/*", route => route.request().method() === "PUT" ? route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Synthetic save failure"}' }) : route.continue());
  await stage("review");
  await page.getByTestId("status-list-automation-save").click();
  await page.getByTestId("status-list-automation-save").waitFor({ state: "visible" });
  await stage("details");
  check(await page.getByTestId("service-action-taskDescription").inputValue() === "Synthetic retry draft", "Server failure keeps the editable draft rather than closing it");
  check((await record(questionAction.id)).task_description === "Synthetic question-specific action", "Failed save does not report a false persisted edit");
  check(executionRequests === 0, "No action execution, communication or webhook request occurred");
  check(errors.length === 0, `No browser runtime errors: ${errors.join("; ")}`);
  console.log(`Status List service actions: ${checks} authenticated browser/API assertions passed`);
} catch (error) {
  await page?.screenshot({ path: `${pictures}/failure.jpg` }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await api.post("/api/auth/logout"); await api.dispose();
  for (const mission of [ids.mission, ids.foreign]) {
    await pool.query("DELETE FROM campaign_status_list_automations WHERE status_list_item_id IN(SELECT id FROM campaign_status_list_items WHERE campaign_id=$1)", [mission]);
    await pool.query("DELETE FROM campaign_status_list_questions WHERE item_id IN(SELECT id FROM campaign_status_list_items WHERE campaign_id=$1)", [mission]);
    await pool.query("DELETE FROM campaign_status_list_items WHERE campaign_id=$1", [mission]);
    await pool.query("DELETE FROM campaign_dispositions WHERE campaign_id=$1", [mission]);
    await pool.query("DELETE FROM campaign_agents WHERE campaign_id=$1", [mission]);
    await pool.query("DELETE FROM campaigns WHERE id=$1", [mission]);
  }
  await pool.query("DELETE FROM task_groups WHERE id=$1", [ids.group]);
  await pool.query("DELETE FROM message_templates WHERE id=ANY($1::varchar[])", [[ids.email, ids.sms]]);
  await pool.query("DELETE FROM user_sessions WHERE user_id=$1", [ids.user]);
  await pool.query("DELETE FROM users WHERE id=$1", [ids.user]);
  await pool.query("DELETE FROM mission_status_list_dirty WHERE entity_id=ANY($1::varchar[])", [Object.values(ids)]);
  await pool.end();
}
