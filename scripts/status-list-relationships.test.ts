import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import bcrypt from "bcrypt";
import { chromium, request, type Page } from "playwright";
import { pool } from "../server/db";
import { getStatusListWorkspaceCopy } from "../client/src/components/status-list-workspace-copy";

// Authenticated native-browser regression. All records belong to this synthetic
// fixture; no contact is enrolled and no live communication/action is executed.
const ids = Object.fromEntries(["user", "mission", "foreign", "current", "next", "hidden", "child", "dup1", "dup2", "quick", "q1", "q2", "q3", "q4", "foreignQ", "foreignItem", "action"].map(key => [key, randomUUID()]));
const username = `relationships-${ids.user}`, password = randomBytes(24).toString("hex");
const baseURL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const api = await request.newContext({ baseURL });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined, page: Page | undefined;
let checks = 0;
const check = (value: unknown, label: string) => { assert.ok(value, label); checks++; };
const value = async (sql: string, args: unknown[] = []) => (await pool.query(sql, args)).rows[0]?.value;
const stepValue = (column: "next_step_id" | "restrictions") => value(`SELECT ${column} AS value FROM campaign_status_list_items WHERE id=$1`, [ids.current]);
const questionRow = (id: string) => value("SELECT row_to_json(q) AS value FROM campaign_status_list_questions q WHERE id=$1", [id]);
const actionRow = () => value("SELECT row_to_json(a) AS value FROM campaign_status_list_automations a WHERE id=$1", [ids.action]);
const root = `/api/campaigns/${ids.mission}/status-list`;
const pictures = "generated-artifacts/status-list-relationships";
try {
  await mkdir(pictures, { recursive: true });
  await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,assigned_countries,is_active)
    VALUES($1,$2,$3,'Synthetic relationships admin',$4,'admin',ARRAY['SK'],true)`,
    [ids.user, username, `${ids.user}@example.invalid`, await bcrypt.hash(password, 4)]);
  await pool.query("INSERT INTO campaigns(id,name,country_codes) VALUES($1,'Synthetic relationship Mission',ARRAY['SK']),($2,'Synthetic foreign relationship Mission',ARRAY['SK'])", [ids.mission, ids.foreign]);
  await pool.query("INSERT INTO campaign_agents(campaign_id,user_id) VALUES($1,$2)", [ids.mission, ids.user]);
  for (const [id, code, label, tab, parent, hidden, kind, campaign] of [
    [ids.current, "REL-START", "Synthetic current step", "retention", null, false, "step", ids.mission],
    [ids.next, "REL-NEXT", "Overenie zmlúv", "acquisition", null, false, "step", ids.mission],
    [ids.hidden, "REL-HIDDEN", "Synthetic hidden parent", "contract", null, true, "step", ids.mission],
    [ids.child, "REL-CHILD", "Synthetic hidden child", null, ids.hidden, false, "step", ids.mission],
    [ids.dup1, "REL-DUP", "Synthetic duplicate one", null, null, false, "step", ids.mission],
    [ids.dup2, "REL-DUP", "Synthetic duplicate two", null, null, false, "step", ids.mission],
    [ids.quick, "OPT-01", "Synthetic quick callback", null, null, false, "option", ids.mission],
    [ids.foreignItem, "FOREIGN", "Synthetic foreign target", null, null, false, "step", ids.foreign],
  ]) await pool.query(`INSERT INTO campaign_status_list_items(id,campaign_id,step_id,label,tab,parent_id,is_hidden,item_type)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [id, campaign, code, label, tab, parent, hidden, kind]);
  await pool.query("UPDATE campaign_status_list_items SET next_step_id='removed-step',restrictions='Original internal guidance' WHERE id=$1", [ids.current]);
  for (const [id, item, label, group, logic, hidden] of [
    [ids.q1, ids.current, "Synthetic current question", "Kontakt", "OR", false],
    [ids.q2, ids.current, "Synthetic hidden sibling", "Kontakt", "ONE", true],
    [ids.q3, ids.current, "Synthetic other group", "Other", "OR", false],
    [ids.q4, ids.next, "Podpísaná zmluva", null, "OR", false],
    [ids.foreignQ, ids.foreignItem, "Synthetic foreign question", null, "OR", false],
  ]) await pool.query(`INSERT INTO campaign_status_list_questions(id,item_id,question_text,group_name,logic_operator,is_hidden)
    VALUES($1,$2,$3,$4,$5,$6)`, [id, item, label, group, logic, hidden]);
  await pool.query("UPDATE campaign_status_list_questions SET goto_question_id=$2 WHERE id=$1", [ids.q1, ids.foreignQ]);
  await pool.query(`INSERT INTO campaign_status_list_automations(id,status_list_item_id,action_type,target_role,task_description)
    VALUES($1,$2,'assign_task','role:back_office','Synthetic preserved action')`, [ids.action, ids.current]);
  const siblingBefore = await questionRow(ids.q2), otherBefore = await questionRow(ids.q3), actionBefore = await actionRow();
  const login = await api.post("/api/auth/login", { data: { username, password } });
  check(login.ok(), "Synthetic manager authenticates through the real API");
  browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ storageState: await api.storageState(), viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${baseURL}/campaigns/${ids.mission}?tab=settings&section=status_list`);
  await page.getByTestId("status-list-phase-retention").click();
  await page.getByTestId(`status-list-select-${ids.current}`).click();
  await page.getByTestId("status-list-toggle-fullscreen").click();
  const relationships = () => page!.getByTestId("studio-stage-relationships").click();
  const selectCurrent = async () => { await page!.getByTestId(`status-list-select-${ids.current}`).click(); await relationships(); };
  const saveStep = async () => {
    const saved = page!.waitForResponse(response => response.url().endsWith(`${root}/${ids.current}`) && response.request().method() === "PUT");
    await page!.getByTestId("status-list-save").click(); check((await saved).ok(), "Step relationship settings persist through the real API");
  };
  const saveQuestion = async () => {
    const saved = page!.waitForResponse(response => response.url().endsWith(`${root}/${ids.current}/questions/${ids.q1}`) && response.request().method() === "PUT");
    await page!.getByTestId("status-list-question-save").click(); check((await saved).ok(), "Question relationships persist through the real API");
  };
  const openQuestion = async () => {
    await selectCurrent();
    await page!.getByTestId("status-list-studio-children").getByRole("button", { name: "Synthetic current question", exact: true }).click();
    await relationships();
  };
  await relationships();
  check(await page.getByTestId("relationship-missing").isVisible(), "A missing saved step target is explained instead of silently cleared");
  check((await page.getByTestId("relationship-selected").innerText()).includes("removed-step"), "The original unresolved code remains visible");
  check(await page.getByTestId(`relationship-target-step:${ids.current}`).isDisabled(), "A step cannot newly navigate to itself");
  check(await page.getByTestId(`relationship-target-step:${ids.dup1}`).isDisabled() && await page.getByTestId(`relationship-target-step:${ids.dup2}`).isDisabled(), "Ambiguous duplicate IDs cannot be selected");
  check(await page.getByTestId(`relationship-target-step:${ids.quick}`).isDisabled(), "Quick status/callback buttons remain distinct from navigation");
  await page.getByTestId("relationship-target-search").fill("nothing-matches");
  check(await page.locator("[data-testid^='relationship-target-step:']").count() === 0 && (await page.getByTestId("relationship-selected").innerText()).includes("removed-step"), "An empty search retains the existing link");
  await page.getByTestId("status-list-step-restrictions").fill("Reviewed internal guidance, not executable logic");
  await saveStep();
  check(await stepValue("next_step_id") === "removed-step", "Editing internal guidance preserves an unresolved legacy reference");
  await page.getByTestId("relationship-target-search").fill("overenie zmluv");
  check(await page.getByTestId(`relationship-target-step:${ids.next}`).isVisible(), "Target search tolerates accents");
  await page.getByTestId(`relationship-target-step:${ids.next}`).click();
  check((await page.getByTestId("relationship-selected").innerText()).includes("Overenie zmlúv"), "The selected destination is identified by its real label");
  await saveStep();
  check(await stepValue("next_step_id") === "REL-NEXT", "Step navigation retains the existing code representation");
  await page.getByTestId("relationship-target-search").fill("REL-CHILD");
  await page.getByTestId(`relationship-target-step:${ids.child}`).click();
  check(await page.getByTestId("relationship-hidden").isVisible(), "A target hidden by its parent warns before saving");
  const selectedText = await page.getByTestId("relationship-selected").innerText();
  check(["en", "sk", "cs", "hu", "ro", "it", "de"].some(locale => selectedText.includes(getStatusListWorkspaceCopy(locale).contract)), "The inherited destination phase is shown in the active language");
  await saveStep();
  check(await stepValue("next_step_id") === "REL-CHILD", "An explicitly selected hidden link is preserved without changing visibility");
  check(await value("SELECT is_hidden AS value FROM campaign_status_list_items WHERE id=$1", [ids.hidden]), "Selecting a hidden destination does not reveal it");
  await openQuestion();
  check(await page.getByTestId("relationship-missing").isVisible(), "A question ID from another Mission cannot resolve as a local destination");
  check(await page.getByTestId(`relationship-target-question:${ids.foreignQ}`).count() === 0, "The target picker is scoped to the selected Mission");
  check(await page.getByTestId("relationship-group-mixed").isVisible(), "Different saved group modes are disclosed");
  check(await page.getByTestId("relationship-group-members").locator("li").count() === 2, "Draft membership includes the hidden sibling");
  await page.getByTestId("status-list-question-group").fill("Other");
  await page.getByTestId("status-list-question-logic").selectOption("AND");
  check((await page.getByTestId("relationship-group-members").innerText()).includes("Synthetic other group"), "Draft group changes immediately show their actual members");
  await page.getByTestId("relationship-target-kind").selectOption("question");
  await page.getByTestId("relationship-target-search").fill("podpisana zmluva");
  await page.getByTestId(`relationship-target-question:${ids.q4}`).click();
  check((await page.getByTestId("relationship-selected").innerText()).includes("Overenie zmlúv"), "Question destinations retain their parent identity");
  await page.getByTestId("relationship-target-kind").selectOption("step");
  check((await page.getByTestId("relationship-selected").innerText()).includes("Podpísaná zmluva"), "Changing picker filters does not change the selected reference");
  await saveQuestion();
  const updatedQuestion = await questionRow(ids.q1);
  check(updatedQuestion.goto_question_id === ids.q4 && updatedQuestion.group_name === "Other" && updatedQuestion.logic_operator === "AND", "Question UUID and grouping values persist exactly");
  check(JSON.stringify(await questionRow(ids.q2)) === JSON.stringify(siblingBefore) && JSON.stringify(await questionRow(ids.q3)) === JSON.stringify(otherBefore), "Saving one question does not rewrite any sibling");
  await page.getByTestId("relationship-target-search").fill("REL-NEXT");
  await page.getByTestId(`relationship-target-step:${ids.next}`).click();
  await saveQuestion();
  check((await questionRow(ids.q1)).goto_question_id === "step:REL-NEXT", "Question-to-step reference retains its existing prefix");
  await page.getByTestId("status-list-relationships-editor").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${pictures}/desktop.jpg`, animations: "disabled" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({ path: `${pictures}/desktop-dark.jpg`, animations: "disabled" });
  check(await page.locator(".slre-none").evaluate(node => {
    const style = getComputedStyle(node);
    const foreground = (style.color.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const background = (style.backgroundColor.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    return foreground.length === 3 && background.length === 3 && (
      Math.abs(foreground[0] - background[0]) > 80 || Math.abs(foreground[1] - background[1]) > 80 || Math.abs(foreground[2] - background[2]) > 80
    );
  }), "The no-link control remains readable after the dark-theme transition");
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("status-list-relationships-editor").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${pictures}/mobile.jpg`, animations: "disabled" });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Relationship editing fits a mobile viewport");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByTestId("relationship-clear").click();
  await saveQuestion();
  check((await questionRow(ids.q1)).goto_question_id === null, "Removing a question link is explicit and persists as NULL");
  await page.reload();
  await page.getByTestId("status-list-phase-retention").click();
  await openQuestion();
  check(await page.getByTestId("relationship-selected").count() === 0 && await page.getByTestId("status-list-question-group").inputValue() === "Other", "Cleared link and saved grouping survive a real reload");
  await pool.query("DELETE FROM campaign_status_list_items WHERE id=$1", [ids.child]);
  await page.reload();
  await page.getByTestId("status-list-phase-retention").click();
  await selectCurrent();
  check(await page.getByTestId("relationship-missing").isVisible() && await stepValue("next_step_id") === "REL-CHILD", "A deleted destination is reported on reload without a guessed replacement");
  await page.getByTestId("relationship-clear").click();
  await saveStep();
  check(await stepValue("next_step_id") === null, "Removing a step link is explicit and persists as NULL");
  check(await stepValue("restrictions") === "Reviewed internal guidance, not executable logic", "Internal guidance survives all link edits");
  check(JSON.stringify(await actionRow()) === JSON.stringify(actionBefore), "Relationship edits leave every original action byte-for-byte unchanged");
  check(await value("SELECT count(*)::int AS value FROM mission_status_list_rule_runs WHERE campaign_id=$1", [ids.mission]) === 0, "Reference and grouping edits never execute a workflow");
  check(errors.length === 0, `No browser runtime errors: ${errors.join("; ")}`);
  console.log(`Status List relationships native/API: ${checks} assertions passed`);
} catch (error) {
  await page?.screenshot({ path: `${pictures}/failure.jpg` }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await api.post("/api/auth/logout"); await api.dispose();
  for (const campaignId of [ids.mission, ids.foreign]) {
    await pool.query("DELETE FROM campaign_status_list_automations WHERE status_list_item_id IN(SELECT id FROM campaign_status_list_items WHERE campaign_id=$1)", [campaignId]);
    await pool.query("DELETE FROM campaign_status_list_questions WHERE item_id IN(SELECT id FROM campaign_status_list_items WHERE campaign_id=$1)", [campaignId]);
    await pool.query("DELETE FROM campaign_status_list_items WHERE campaign_id=$1", [campaignId]);
    await pool.query("DELETE FROM campaign_agents WHERE campaign_id=$1", [campaignId]);
    await pool.query("DELETE FROM campaigns WHERE id=$1", [campaignId]);
  }
  await pool.query("DELETE FROM user_sessions WHERE user_id=$1", [ids.user]);
  await pool.query("DELETE FROM users WHERE id=$1", [ids.user]);
  await pool.query("DELETE FROM mission_status_list_dirty WHERE entity_id=ANY($1::varchar[])", [Object.values(ids)]);
  await pool.end();
}
