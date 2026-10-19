import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { request, chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { pool } from "../server/db";
import { statusListWorkflowSchema, workflowConditionMatches, type StatusListWorkflow } from "../shared/status-list-workflow";
import { getStatusListWorkflowCopy } from "../client/src/components/status-list-workflow-copy";
import { processStatusListItemWorkflow } from "../server/lib/status-list-workflow";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT)
  throw new Error("Synthetic fixtures must not run in production");
const ids = Array.from({ length: 16 }, () => randomUUID());
const [user, mission, otherMission, customer, cc, cc2, source, target, question, answer, exclusive, derived, foreign, otherQuestion, boolQuestion, historyItem] = ids;
const username = `workflow-test-${user}`, password = randomBytes(24).toString("hex");
const root = `/api/campaigns/${mission}/status-list-workflows`;
const contactRoot = `/api/campaigns/${mission}/contacts/${cc}/status-list-workflows`;
const api = await request.newContext({ baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}` });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let checks = 0;
const check = (value: unknown, message: string) => { assert.ok(value, message); checks++; };
const body = async (response: any, status = 200) => {
  assert.equal(response.status(), status, `Unexpected response ${await response.text()}`);
  checks++;
  return response.json();
};
const rule: StatusListWorkflow = {
  name: "Synthetic readiness", enabled: true, source: { kind: "question", id: question }, sourceValue: "yes",
  trigger: "agent_confirmation", logic: "and", conditions: [{ field: "hospital_id", op: "not_empty" }],
  thenActions: [{ type: "set_answer", target: { kind: "question", id: answer }, value: "Ready", mode: "replace" }],
  elseActions: [{ type: "set_answer", target: { kind: "question", id: answer }, value: "Missing hospital", mode: "replace" }],
};
try {
  await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,assigned_countries,is_active)
    VALUES($1,$2,$3,'Synthetic workflow tester',$4,'admin',ARRAY['SK'],true)`,
  [user, username, `${user}@example.invalid`, await bcrypt.hash(password, 10)]);
  for (const id of [mission, otherMission]) await pool.query(`INSERT INTO campaigns(id,name,country_codes,status,settings)
    VALUES($1,$2,ARRAY['SK'],'active',$3)`, [id, `${username}-${id}`, JSON.stringify({ workflowMode: "status_list" })]);
  await pool.query("INSERT INTO customers(id,first_name,last_name,email,country) VALUES($1,'Synthetic','Workflow',$2,'SK')", [customer, `${customer}@example.invalid`]);
  for (const id of [cc, cc2]) await pool.query("INSERT INTO campaign_contacts(id,campaign_id,customer_id,contact_type) VALUES($1,$2,$3,'customer')", [id, mission, customer]);
  for (const [id, label, parentId, kind] of [
    [source, "Interest", null, "checkbox"], [target, "Target choice", null, "checkbox"],
    [exclusive, "Sibling choice", null, "checkbox"], [derived, "System derived", null, "auto"],
    [historyItem, "History source", null, "checkbox"],
  ]) await pool.query(`INSERT INTO campaign_status_list_items(id,campaign_id,step_id,label,parent_id,confirmation_type)
    VALUES($1::varchar,$2,$1::text,$3,$4,$5)`, [id, mission, label, parentId, kind]);
  await pool.query("INSERT INTO campaign_status_list_items(id,campaign_id,step_id,label) VALUES($1::varchar,$2,$1::text,'Foreign')", [foreign, otherMission]);
  for (const [id, item, label, field] of [
    [question, source, "Interested?", "yesno"], [answer, target, "Readiness", "text"],
    [boolQuestion, target, "Boolean choice", "checkbox"], [otherQuestion, foreign, "Foreign answer", "text"],
  ]) await pool.query(`INSERT INTO campaign_status_list_questions(id,item_id,question_text,field_type)
    VALUES($1,$2,$3,$4)`, [id, item, label, field]);
  check(!statusListWorkflowSchema.safeParse({ ...rule, trigger: "background" }).success, "Background trigger not accidentally executable");
  check(!workflowConditionMatches({ field: "status", op: "not_equals", value: "x" }, undefined), "Unknown comparisons fail closed");
  check(workflowConditionMatches({ field: "answer", ref: { kind: "question", id: answer }, op: "empty" }, undefined), "Explicit empty comparison");
  const unauth = await request.newContext({ baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}` });
  await body(await unauth.get(root), 401); await unauth.dispose();
  await body(await api.post("/api/auth/login", { data: { username, password } }));
  const catalog = await body(await api.get(root));
  check(catalog.catalog.some((item: any) => item.id === derived && !item.writable), "Derived targets marked read-only");
  check(!catalog.catalog.some((item: any) => item.id === foreign), "Other Mission excluded from catalog");
  const saved = await body(await api.post(root, { data: rule }), 201);
  await body(await api.post(root, { data: { ...rule, thenActions: [{ ...rule.thenActions[0], target: { kind: "question", id: otherQuestion } }] } }), 400);
  await body(await api.post(root, { data: { ...rule, thenActions: [{ ...rule.thenActions[0], target: { kind: "item", id: derived }, value: true }] } }), 400);
  await body(await api.put(`${contactRoot}/answers/${otherQuestion}`, { data: { value: "No" } }), 404);
  await body(await api.get(`/api/campaigns/${otherMission}/contacts/${cc}/status-list-workflows`), 404);
  await body(await api.put(`${contactRoot}/answers/${boolQuestion}`, { data: { value: false } }), 400);
  await body(await api.put(`${contactRoot}/answers/${question}`, { data: { value: "yes" } }));
  let state = await body(await api.get(contactRoot));
  check(state.answers[answer] === "Missing hospital", "ELSE writes persisted target answer");
  check(state.runs.length === 1 && state.runs[0].branch === "else", "ELSE run audited once");
  await Promise.all(Array.from({ length: 4 }, () => api.put(`${contactRoot}/answers/${question}`, { data: { value: "yes" } }).then(res => body(res))));
  state = await body(await api.get(contactRoot));
  check(state.runs.length === 1, "Concurrent unchanged answers do not repeat actions");
  await pool.query("UPDATE customers SET hospital_name='Synthetic hospital' WHERE id=$1", [customer]);
  await body(await api.put(`${contactRoot}/answers/${question}`, { data: { value: null } }));
  await body(await api.put(`${contactRoot}/answers/${question}`, { data: { value: "yes" } }));
  state = await body(await api.get(contactRoot));
  check(state.answers[answer] === "Ready", "THEN sees real linked customer hospital");
  check(state.runs.length === 2, "New transition executes again");
  const guarded = { ...rule, thenActions: [{ ...rule.thenActions[0], value: "Must not replace", mode: "if_empty" }] };
  await body(await api.put(`${root}/${saved.id}`, { data: guarded }));
  await body(await api.put(`${contactRoot}/answers/${question}`, { data: { value: null } }));
  await body(await api.put(`${contactRoot}/answers/${question}`, { data: { value: "yes" } }));
  state = await body(await api.get(contactRoot));
  check(state.answers[answer] === "Ready" && state.runs[0].results[0].reason === "not_empty", "Only-if-empty preserves answer with audit");
  await body(await api.put(`${root}/${saved.id}`, { data: { ...rule, enabled: false } }));
  await body(await api.put(`${contactRoot}/answers/${question}`, { data: { value: null } }));
  await body(await api.put(`${contactRoot}/answers/${question}`, { data: { value: "yes" } }));
  state = await body(await api.get(contactRoot));
  check(state.runs.length === 3, "Disabled rule does not execute");
  const itemRule: StatusListWorkflow = { ...rule, name: "Item confirmation rule", source: { kind: "item", id: source },
    sourceValue: true, conditions: [], thenActions: [{ type: "set_answer", target: { kind: "item", id: target }, value: true, mode: "replace" }], elseActions: [] };
  const itemSaved = await body(await api.post(root, { data: itemRule }), 201);
  const confirmationRoot = `/api/campaigns/${mission}/contacts/${cc}/status-list-state/${source}`;
  await Promise.all(Array.from({ length: 3 }, () => api.post(confirmationRoot, { data: { confirm: true } }).then(res => body(res))));
  state = await body(await api.get(contactRoot));
  check(state.runs.filter((run: any) => run.ruleName === itemRule.name).length === 1, "Duplicate legacy confirmations execute once");
  check((await pool.query("SELECT id FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1 AND status_list_item_id=$2", [cc, target])).rowCount === 1, "Target item confirmed without duplicate state");
  const originalRuns = state.runs.length;
  const targetState = await pool.query("SELECT id FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1 AND status_list_item_id=$2", [cc, target]);
  await processStatusListItemWorkflow({ campaignId: mission, campaignContactId: cc, itemId: target, actorId: user, stateId: targetState.rows[0].id });
  check((await body(await api.get(contactRoot))).runs.length === originalRuns, "Target writes do not chain");
  await body(await api.patch(`${confirmationRoot}/note`, { data: { note: "Synthetic note only" } }));
  check((await body(await api.get(contactRoot))).runs.length === originalRuns, "Note edit does not rerun");
  await pool.query("UPDATE campaign_status_list_items SET question_selection_mode='single' WHERE id=$1", [source]);
  await pool.query("UPDATE campaign_status_list_items SET parent_id=$1 WHERE id=ANY($2::varchar[])", [source, [target, exclusive]]);
  await pool.query("DELETE FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1 AND status_list_item_id=$2", [cc, target]);
  await pool.query("INSERT INTO campaign_contact_status_list_state(campaign_contact_id,status_list_item_id,confirmed_by_user_id) VALUES($1,$2,$3)", [cc, exclusive, user]);
  await body(await api.put(`${root}/${itemSaved.id}`, { data: { ...itemRule, thenActions: [{ ...itemRule.thenActions[0], mode: "if_empty" }] } }));
  await body(await api.post(confirmationRoot, { data: { confirm: false } }));
  await body(await api.post(confirmationRoot, { data: { confirm: true } }));
  state = await body(await api.get(contactRoot));
  check(state.runs[0].results[0].reason === "not_empty", "If-empty preserves an exclusive sibling");
  check((await pool.query("SELECT id FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1 AND status_list_item_id=$2", [cc, exclusive])).rowCount === 1, "Existing exclusive answer retained");
  await body(await api.put(`${root}/${itemSaved.id}`, { data: itemRule }));
  await body(await api.post(confirmationRoot, { data: { confirm: false } }));
  await body(await api.post(confirmationRoot, { data: { confirm: true } }));
  check((await pool.query("SELECT id FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1 AND status_list_item_id=$2", [cc, exclusive])).rowCount === 0, "Explicit replacement clears exclusive sibling");
  check(Object.keys((await body(await api.get(`/api/campaigns/${mission}/contacts/${cc2}/status-list-workflows`))).answers).length === 0, "Contact isolation");
  await body(await api.delete(`${root}/${itemSaved.id}`));
  check((await body(await api.get(contactRoot))).runs.some((run: any) => run.ruleName === itemRule.name), "Run history survives rule deletion");
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
    const copy = getStatusListWorkflowCopy(locale);
    check(Object.values(copy).every(value => typeof value === "string" && value.length > 0), `Complete ${locale} copy`);
  }
  // Real authenticated application rendering (no mocked API).
  browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}`, storageState: await api.storageState(), viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/campaigns/${mission}?tab=settings&section=status_list`);
  await page.getByTestId("tab-settings").click();
  // Settings keeps the builder behind its native Status List navigation.
  const builder = page.getByTestId("status-list-workflows");
  if (!(await builder.isVisible())) {
    const controls = page.getByRole("button", { name: /status list|stavový zoznam|zoznam stavov/i });
    if (await controls.count()) await controls.first().click();
  }
  await builder.waitFor({ state: "visible", timeout: 30000 });
  check((await builder.innerText()).includes(rule.name), "Real persisted rule visible in builder");
  await page.getByTestId("status-workflow-create").click();
  await page.getByTestId("status-workflow-name").fill("Browser-created workflow");
  await page.getByTestId("status-workflow-overview-when").click();
  await page.getByTestId("status-workflow-source").click();
  await page.getByRole("option", { name: "Interest", exact: true }).click();
  await page.getByTestId("status-workflow-overview-back").click();
  await page.getByTestId("status-workflow-overview-then").click();
  await page.getByTestId("status-workflow-add-then-action").click();
  await page.getByTestId("status-workflow-then-target-0").click();
  await page.getByRole("option", { name: "Boolean choice", exact: true }).click();
  await page.getByTestId("status-workflow-overview-back").click();
  await mkdir("generated-artifacts/status-list-workflow", { recursive: true });
  await page.screenshot({ path: "generated-artifacts/status-list-workflow/editor-desktop.jpg" });
  await page.getByTestId("status-workflow-save").click();
  await builder.getByText("Browser-created workflow", { exact: true }).waitFor();
  check((await body(await api.get(root))).rules.some((entry: any) => entry.name === "Browser-created workflow"), "Real browser create/save persisted");
  await page.reload();
  await builder.getByText("Browser-created workflow", { exact: true }).waitFor();
  await builder.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "generated-artifacts/status-list-workflow/desktop.jpg" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "generated-artifacts/status-list-workflow/mobile.jpg" });
  check(errors.length === 0, `No browser runtime errors: ${errors.join("; ")}`);
  console.log(`Status List workflow: ${checks} assertions passed (real persistence, authorization, branches, idempotency, audit, UI).`);
} catch (error) {
  console.error("Workflow check failed after", checks, "assertions:", error);
  throw error;
} finally {
  await browser?.close();
  await api.post("/api/auth/logout");
  await api.dispose();
  await pool.query("DELETE FROM campaign_contact_history WHERE campaign_contact_id=ANY($1::varchar[])", [[cc, cc2]]);
  await pool.query("DELETE FROM campaign_contact_status_list_state WHERE campaign_contact_id=ANY($1::varchar[])", [[cc, cc2]]);
  await pool.query("DELETE FROM mission_status_list_rule_runs WHERE campaign_id=ANY($1::varchar[])", [[mission, otherMission]]);
  await pool.query("DELETE FROM mission_status_list_answers WHERE campaign_contact_id=ANY($1::varchar[])", [[cc, cc2]]);
  await pool.query("DELETE FROM campaign_contacts WHERE id=ANY($1::varchar[])", [[cc, cc2]]);
  await pool.query("DELETE FROM campaign_status_list_questions WHERE id=ANY($1::varchar[])", [[question, answer, otherQuestion, boolQuestion]]);
  await pool.query("DELETE FROM campaign_status_list_items WHERE campaign_id=ANY($1::varchar[])", [[mission, otherMission]]);
  await pool.query("DELETE FROM campaigns WHERE id=ANY($1::varchar[])", [[mission, otherMission]]);
  await pool.query("DELETE FROM customers WHERE id=$1", [customer]);
  await pool.query("DELETE FROM user_sessions WHERE user_id=$1", [user]);
  await pool.query("DELETE FROM users WHERE id=$1", [user]);
  await pool.end();
}
