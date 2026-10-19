import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { request, chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { pool } from "../server/db";
import { evaluateBackgroundContact, recoverStatusListBackground, installStatusListBackgroundTriggers } from "../server/lib/status-list-background";
import { evaluateReachability, defaultReachabilityPolicy, optionSourceConfigSchema } from "../shared/status-list-option-source";
import { cloneCampaignWithConfiguration } from "../server/lib/clone-campaign";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw Error("Development fixtures only");
const [user, manager, mission, foreign, clinic, cc, coordinatorGroup, reachGroup, resultItem, resultQuestion, foreignItem] =
  Array.from({ length: 11 }, () => randomUUID());
const coordinatorOptions = Array.from({ length: 3 }, () => randomUUID());
const secondQuestion = randomUUID();
const reachOptions = Array.from({ length: 4 }, () => randomUUID());
const password = randomBytes(24).toString("hex"), username = `options-${user}`;
const baseURL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const api = await request.newContext({ baseURL });
const outsider = await request.newContext({ baseURL });
const root = `/api/campaigns/${mission}/status-list-workflows`;
const optionRoot = `${root}/option-sources`;
const policy = { ...defaultReachabilityPolicy };
const coordinator = { source: "coordinator" as const, hidden: false,
  mapping: { unassigned: coordinatorOptions[0], assigned: coordinatorOptions[1] },
  users: [{ userId: user, optionId: coordinatorOptions[2] }] };
const reachability = { source: "reachability" as const, hidden: false, policy,
  mapping: { not_defined: reachOptions[0], waiting: reachOptions[1], unreachable: reachOptions[2], reachable: reachOptions[3] } };
let checks = 0, cloneId: string | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const check = (value: unknown, message: string) => { assert.ok(value, message); checks++; };
const scalar = async (sql: string, args: unknown[] = []) => (await pool.query(sql, args)).rows[0]?.value;
const body = async (response: Awaited<ReturnType<typeof api.get>>, status = 200): Promise<any> => {
  const json = await response.json();
  assert.equal(response.status(), status, JSON.stringify(json)); checks++; return json;
};
const state = (groupId: string) => scalar("SELECT option_id AS value FROM mission_status_list_option_source_state WHERE campaign_contact_id=$1 AND group_id=$2", [cc, groupId]);
const runCount = () => scalar("SELECT count(*)::int AS value FROM mission_status_list_rule_runs WHERE campaign_id=$1", [mission]);
const message = async (type: "email" | "sms", direction: string, status: string, campaignId: string | null = mission, ageHours = 0, replyTo: string | null = null) => {
  const id = randomUUID();
  await pool.query(`INSERT INTO communication_messages(id,type,direction,status,campaign_id,entity_type,entity_id,content,sent_at,reply_to_sms_id)
    VALUES($1,$2,$3,$4,$5,'clinic',$6,'Synthetic test',now()-($7::int*interval '1 hour'),$8)`,
  [id, type, direction, status, campaignId, clinic, ageHours, replyTo]); return id;
};
const call = async (status: string, answer: boolean, duration = 0, forwarded = false, campaignId = mission, contactId = cc) => {
  const id = randomUUID();
  await pool.query(`INSERT INTO call_logs(id,user_id,phone_number,campaign_id,campaign_contact_id,status,
    answered_at,ended_at,duration_seconds,is_forwarded) VALUES($1,$2,'+421900000000',$3,$4,$5,
    CASE WHEN $6 THEN now()-interval '2 minutes' ELSE NULL END,now(),$7,$8)`,
  [id, user, campaignId, contactId, status, answer, duration, forwarded]); return id;
};
try {
  // Pure semantics, including threshold, deadline, channel and expiry boundaries.
  const now = Date.now();
  const evidence = (kind: "success" | "failure" | "waiting", at: number, channel: "calls" | "email" | "sms" = "calls") => [{ id: "one", kind, at, channel }];
  check(evaluateReachability([], policy, now) === "not_defined", "No communication is undefined");
  check(evaluateReachability(evidence("waiting", now, "email"), policy, now) === "waiting", "Sent email awaits response");
  check(evaluateReachability(evidence("waiting", now - 48 * 3600_000, "sms"), policy, now) === "unreachable", "Wait deadline boundary");
  check(evaluateReachability(evidence("failure", now), { ...policy, failedAttempts: 2 }, now) !== "unreachable", "Failure threshold configurable");
  check(evaluateReachability(evidence("success", now, "sms"), { ...policy, sms: false }, now) === "not_defined", "Disabled channel excluded");
  check(evaluateReachability([...evidence("success", now - 1000), ...evidence("failure", now)], policy, now) === "reachable", "Later failed attempt preserves success");
  check(evaluateReachability(evidence("success", now - 2 * 86400_000), { ...policy, successValidDays: 1 }, now) === "not_defined", "Success expiry is not invented failure");
  check(!optionSourceConfigSchema.safeParse({ ...reachability, mapping: { ...reachability.mapping, waiting: reachOptions[0] } }).success, "Duplicate outcome mapping rejected");
  const hash = await bcrypt.hash(password, 10);
  await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,assigned_countries,is_active)
    VALUES($1,$2,$3,'Synthetic option admin',$4,'admin',ARRAY['SK'],true),
    ($5,$6,$7,'Synthetic foreign manager',$4,'manager',ARRAY['HU'],true)`,
  [user, username, `${user}@example.invalid`, hash, manager, `options-${manager}`, `${manager}@example.invalid`]);
  await pool.query("INSERT INTO campaigns(id,name,country_codes) VALUES($1,'Synthetic option sources',ARRAY['SK']),($2,'Synthetic other Mission',ARRAY['SK'])", [mission, foreign]);
  await pool.query("UPDATE campaigns SET settings=$2 WHERE id=$1", [mission, JSON.stringify({ syntheticUnrelatedSetting: "keep" })]);
  await pool.query("INSERT INTO campaign_agents(campaign_id,user_id) VALUES($1,$2)", [mission, user]);
  await pool.query("INSERT INTO clinics(id,name,country_code) VALUES($1,'Synthetic source clinic','SK')", [clinic]);
  await pool.query("INSERT INTO campaign_contacts(id,campaign_id,contact_type,clinic_id) VALUES($1,$2,'clinic',$3)", [cc, mission, clinic]);
  for (const [id, label] of [[coordinatorGroup, "HP Assignment — To Whom"], [reachGroup, "Healthcare Provider Reachability Status"], [resultItem, "Synthetic result"]])
    await pool.query("INSERT INTO campaign_status_list_items(id,campaign_id,step_id,label,question_selection_mode) VALUES($1,$2,'options',$3,'single')", [id, mission, label]);
  for (const [parent, options, labels] of [
    [coordinatorGroup, coordinatorOptions, ["Unassigned", "Assigned", "Specific coordinator"]],
    [reachGroup, reachOptions, ["Not defined yet", "Waiting for response", "Unreachable", "Reachable"]],
  ] as const) for (let i = 0; i < options.length; i++) {
    if (parent === reachGroup && i === 1) continue;
    await pool.query(`INSERT INTO campaign_status_list_items(id,campaign_id,parent_id,step_id,label,item_type,sort_order,confirmation_type)
      VALUES($1,$2,$3,'options',$4,$6,$5,$7)`, [options[i], mission, parent, labels[i], i, parent === reachGroup ? "step" : "option", parent === reachGroup ? "radio" : "checkbox"]);
  }
  await pool.query("UPDATE campaign_status_list_items SET confirmation_type='info' WHERE id=$1", [reachGroup]);
  await pool.query("INSERT INTO campaign_status_list_items(id,campaign_id,step_id,label) VALUES($1,$2,'foreign','Foreign')", [foreignItem, foreign]);
  await pool.query("INSERT INTO campaign_status_list_questions(id,item_id,question_text,field_type) VALUES($1,$2,'Synthetic result','text')", [resultQuestion, resultItem]);
  await pool.query("INSERT INTO campaign_status_list_questions(id,item_id,question_text,sort_order,is_hidden) VALUES($1,$2,'Synthetic hidden subquestion',1,true)", [secondQuestion, resultItem]);
  await installStatusListBackgroundTriggers();
  await body(await api.get(optionRoot), 401);
  await body(await api.get(`${root}/history`), 401);
  await body(await api.post("/api/auth/login", { data: { username, password } }));
  await body(await outsider.post("/api/auth/login", { data: { username: `options-${manager}`, password } }));
  const organizationPath = `${root}/organization`;
  await body(await outsider.get(organizationPath), 403);
  await body(await outsider.patch(organizationPath, { data: { operation: "create", name: "Forbidden" } }), 403);
  const organized = await body(await api.patch(organizationPath, { data: { operation: "create", name: "Synthetic category" } }));
  const categoryId = organized.categories[0].id;
  await body(await api.patch(organizationPath, { data: { operation: "create", name: "synthetic CATEGORY" } }), 409);
  await body(await api.patch(organizationPath, { data: { operation: "assign", kind: "item", id: foreignItem, categoryId } }), 404);
  await body(await api.patch(organizationPath, { data: { operation: "assign", kind: "item", id: reachGroup, categoryId } }));
  await body(await api.patch(organizationPath, { data: { operation: "assign", kind: "question", id: resultQuestion, categoryId } }));
  await body(await api.patch(`${root}/items/${reachGroup}/presentation`, { data: { tab: "acquisition" } }));
  await body(await api.patch(`${root}/items/${resultItem}/presentation`, { data: { tab: "retention" } }));
  await body(await api.patch(`${root}/items/${resultItem}/presentation`, { data: { tab: "custom_invalid" } }), 400);
  await body(await api.patch(organizationPath, { data: { operation: "rename", id: categoryId, name: "Renamed category" } }));
  await body(await api.patch(organizationPath, { data: { operation: "rename", id: categoryId, name: "Synthetic category" } }));
  check(await scalar("SELECT tab AS value FROM campaign_status_list_items WHERE id=$1", [reachGroup]) === "acquisition", "Category edits preserve agent phase assignments");
  check(await scalar("SELECT settings::jsonb->>'syntheticUnrelatedSetting' AS value FROM campaigns WHERE id=$1", [mission]) === "keep", "Category edits preserve unrelated Mission settings");
  await body(await outsider.post(`${root}/items/${resultItem}/questions/${secondQuestion}/move`, { data: { direction: "up" } }), 403);
  await body(await api.post(`${root}/items/${foreignItem}/questions/${secondQuestion}/move`, { data: { direction: "up" } }), 404);
  await body(await api.post(`${root}/items/${resultItem}/questions/${secondQuestion}/move`, { data: { direction: "up", neighborId: resultQuestion } }));
  check(await scalar("SELECT id AS value FROM campaign_status_list_questions WHERE item_id=$1 ORDER BY sort_order,id LIMIT 1", [resultItem]) === secondQuestion, "Subquestion order is persisted");
  await body(await api.post(`${root}/items/${resultItem}/questions/${secondQuestion}/move`, { data: { direction: "down" } }));
  await body(await outsider.get(optionRoot), 403);
  await body(await outsider.put(`${optionRoot}/${reachGroup}`, { data: reachability }), 403);
  await body(await outsider.post(`${optionRoot}/${reachGroup}/waiting-option`, { data: { label: "Waiting for response" } }), 403);
  await body(await outsider.get(`${root}/history`), 403);
  await body(await outsider.patch(`${root}/items/${reachGroup}/presentation`, { data: { isHidden: true } }), 403);
  await body(await api.patch(`${root}/items/${foreignItem}/presentation`, { data: { isHidden: true } }), 404);
  await body(await api.patch(`${root}/items/${reachGroup}/presentation`, { data: { confirmationType: "auto" } }), 400);
  const waitingOption = await body(await api.post(`${optionRoot}/${reachGroup}/waiting-option`, { data: { label: "Waiting for response" } }), 201);
  reachOptions[1] = waitingOption.id;
  reachability.mapping.waiting = waitingOption.id;
  check(await scalar("SELECT item_type AS value FROM campaign_status_list_items WHERE id=$1", [waitingOption.id]) === "step", "Explicit waiting addition preserves real radio-step representation");
  check(await scalar("SELECT confirmation_type AS value FROM campaign_status_list_items WHERE id=$1", [waitingOption.id]) === "radio", "Waiting step is a mutually exclusive radio choice");
  await body(await api.post(`${optionRoot}/${reachGroup}/waiting-option`, { data: { label: "Another waiting option" } }), 400);
  await body(await api.put(`${optionRoot}/${reachGroup}`, { data: { ...reachability, mapping: { ...reachability.mapping, reachable: foreignItem } } }), 400);
  await body(await api.put(`${optionRoot}/${coordinatorGroup}`, { data: coordinator }));
  await body(await api.put(`${optionRoot}/${reachGroup}`, { data: reachability }));
  await body(await api.post(root, { data: { name: "Synthetic reachable transition", enabled: true,
    source: { kind: "item", id: reachOptions[3] }, trigger: "background_transition", logic: "and", conditions: [],
    thenActions: [{ type: "set_answer", target: { kind: "question", id: resultQuestion }, value: "Reached", mode: "replace" }], elseActions: [] } }), 201);
  await body(await api.post(root, { data: { name: "Forbidden source write", enabled: true,
    source: { kind: "item", id: resultItem }, trigger: "agent_confirmation", logic: "and", conditions: [],
    thenActions: [{ type: "set_answer", target: { kind: "item", id: reachOptions[0] }, value: true, mode: "replace" }], elseActions: [] } }), 400);
  await evaluateBackgroundContact(cc);
  check(await state(coordinatorGroup) === coordinatorOptions[0], "Coordinator baseline unassigned");
  check(await state(reachGroup) === reachOptions[0] && await runCount() === 0, "Undefined baseline has no actions");
  await body(await api.post(`/api/campaigns/${mission}/contacts/${cc}/status-list-state/${reachOptions[3]}`, { data: { confirm: true } }), 400);
  await assert.rejects(pool.query(`INSERT INTO campaign_contact_status_list_state(campaign_contact_id,status_list_item_id,confirmed_by_user_id)
    VALUES($1,$2,$3)`, [cc, reachOptions[3], user]), /derived_answer/); checks++;
  // The representative is deliberately unrelated to the Mission coordinator.
  await pool.query("INSERT INTO clinic_representative_assignments(clinic_id,user_id,assignment_type) VALUES($1,$2,'manual')", [clinic, manager]);
  await evaluateBackgroundContact(cc);
  check(await state(coordinatorGroup) === coordinatorOptions[0], "Representative never stands in for coordinator");
  await pool.query("UPDATE campaign_contacts SET assigned_to=$2 WHERE id=$1", [cc, user]);
  await Promise.all(Array.from({ length: 4 }, () => evaluateBackgroundContact(cc)));
  check(await state(coordinatorGroup) === coordinatorOptions[2], "Specific coordinator mapping follows Mission assigned user");
  await pool.query("UPDATE campaign_contacts SET assigned_to=NULL WHERE id=$1", [cc]);
  await evaluateBackgroundContact(cc);
  check(await state(coordinatorGroup) === coordinatorOptions[0], "Coordinator removal works after previous user assignment");
  await message("email", "outbound", "delivered", foreign);
  await call("completed", true, 30, false, foreign);
  await evaluateBackgroundContact(cc);
  check(await state(reachGroup) === reachOptions[0], "Other-Mission communication ignored");
  const outbound = await message("sms", "outbound", "sent");
  await evaluateBackgroundContact(cc);
  check(await state(reachGroup) === reachOptions[1], "Sent SMS means waiting");
  await pool.query("UPDATE communication_messages SET status='delivered' WHERE id=$1", [outbound]);
  await evaluateBackgroundContact(cc);
  check(await state(reachGroup) === reachOptions[1] && await runCount() === 0, "Receipt is not success");
  await pool.query("UPDATE communication_messages SET sent_at=now()-interval '49 hours' WHERE id=$1", [outbound]);
  await pool.query("DELETE FROM mission_status_list_dirty WHERE entity_id=$1", [mission]);
  for (let i = 0; i < 40 && await state(reachGroup) !== reachOptions[2]; i++) await recoverStatusListBackground();
  check(await state(reachGroup) === reachOptions[2], "Timed recovery expires waiting with no agent or dirty hint");
  const forwarded = await call("completed", true, 100, true);
  await evaluateBackgroundContact(cc);
  check(await state(reachGroup) !== reachOptions[3], "Forwarded caller-channel answer is not success");
  await message("sms", "inbound", "delivered", null, 0, outbound);
  await Promise.all(Array.from({ length: 5 }, () => evaluateBackgroundContact(cc)));
  check(await state(reachGroup) === reachOptions[3], "Bound incoming reply proves reachability");
  check(await runCount() === 1, "Concurrent transition executes once");
  await call("no_answer", false);
  await evaluateBackgroundContact(cc);
  check(await state(reachGroup) === reachOptions[3] && await runCount() === 1, "Later no answer does not erase success or replay");
  const selectionCount = await scalar(`SELECT count(*)::int AS value FROM campaign_contact_status_list_state s
    JOIN campaign_status_list_items i ON i.id=s.status_list_item_id WHERE s.campaign_contact_id=$1 AND i.parent_id=$2`, [cc, reachGroup]);
  check(selectionCount === 1, "Exclusive derived group has exactly one selection");
  const audit = await body(await api.get(`/api/campaigns/${mission}/contacts/${cc}/status-list-workflows`));
  check(audit.transitions.some((t: any) => t.targetKind === "item" && !t.baseline), "Group transitions are visible in audit");
  check(audit.runs[0].actorKind === "system", "Non-human audit principal");
  check(audit.catalog.filter((x: any) => reachOptions.includes(x.id)).every((x: any) => !x.writable && x.backgroundSource === "reachability"), "All derived options readonly");
  const presentationRevision = await scalar("SELECT revision AS value FROM mission_status_list_option_sources WHERE group_id=$1", [reachGroup]);
  await body(await api.put(`${optionRoot}/${reachGroup}`, { data: { ...reachability, hidden: true } }));
  check(await scalar("SELECT revision AS value FROM mission_status_list_option_sources WHERE group_id=$1", [reachGroup]) === presentationRevision, "Visibility change does not rebaseline");
  await body(await api.put(`${optionRoot}/${reachGroup}`, { data: reachability }));
  const clone = await cloneCampaignWithConfiguration(mission, user, "Synthetic source clone");
  cloneId = clone.id;
  const clonedOrganization = await scalar("SELECT settings::jsonb->'statusListOrganizer' AS value FROM campaigns WHERE id=$1", [cloneId]);
  check(clonedOrganization.categories[0].name === "Synthetic category" && clonedOrganization.categories[0].id !== categoryId, "Cloned custom categories have fresh identities");
  check(Object.keys(clonedOrganization.assignments).length === 2 && !clonedOrganization.assignments[reachGroup] && !clonedOrganization.assignments[resultQuestion], "Clone remaps item and subquestion category assignments");
  const clonedSources = (await pool.query("SELECT group_id,config FROM mission_status_list_option_sources WHERE campaign_id=$1", [cloneId])).rows;
  check(clonedSources.length === 2, "Clone includes both source configurations");
  check(clonedSources.every(s => ![coordinatorGroup, reachGroup].some(id => id === s.group_id) &&
    Object.values(s.config.mapping).every(id => ![...coordinatorOptions, ...reachOptions].some(original => original === String(id)))), "Clone remaps group and every mapped option");
  check(await scalar("SELECT count(*)::int AS value FROM mission_status_list_option_source_state WHERE campaign_contact_id IN (SELECT id FROM campaign_contacts WHERE campaign_id=$1)", [cloneId]) === 0, "Clone has no operational source state");
  const savedVersion = await body(await api.post(`/api/campaigns/${mission}/nexus-pulse/versions`,
    { data: { changeNote: "Synthetic option source snapshot" } }), 201);
  const snapshot = await scalar("SELECT snapshot AS value FROM nexus_pulse_module_revisions WHERE campaign_id=$1 ORDER BY version_number DESC LIMIT 1", [mission]);
  check(snapshot.workflowOptionSources.length === 2 &&
    snapshot.workflowOptionSources.every((s: any) => !s.revision), "Snapshot includes config without runtime generations");
  check(snapshot.campaign.settings.statusListOrganizer.categories[0].id === categoryId, "Version includes settings-only categories");
  await body(await api.put(`${optionRoot}/${reachGroup}`, { data: { ...reachability, policy: { ...policy, replyWaitHours: 72 } } }));
  const versionNumber = await scalar("SELECT max(version_number)::int AS value FROM nexus_pulse_module_revisions WHERE campaign_id=$1", [mission]);
  await body(await api.post(`/api/campaigns/${mission}/nexus-pulse/versions/${versionNumber}/restore`, { data: { confirm: true } }), 201);
  const restored = await body(await api.get(optionRoot));
  check(restored.sources.find((s: any) => s.groupId === reachGroup).policy.replyWaitHours === policy.replyWaitHours, "Version restore preserves configured policy");
  await evaluateBackgroundContact(cc);
  check(await runCount() === 1, "Restore initializes without replay");
  // Re-enable establishes a fresh baseline, even when current value is successful.
  await body(await api.delete(`${optionRoot}/${reachGroup}`));
  await body(await api.put(`${optionRoot}/${reachGroup}`, { data: reachability }));
  await evaluateBackgroundContact(cc);
  check(await runCount() === 1, "Re-enable never replays existing success");
  const revision = await scalar("SELECT revision AS value FROM mission_status_list_option_sources WHERE group_id=$1", [reachGroup]);
  await body(await api.put(`${optionRoot}/${reachGroup}`, { data: { ...reachability, hidden: true } }));
  await body(await api.patch(`${root}/items/${reachGroup}/presentation`, { data: { isHidden: false, required: true } }));
  const shown = await body(await api.get(optionRoot));
  check(shown.catalog.filter((item: any) => item.id === reachGroup || item.parentId === reachGroup).every((item: any) => !item.hidden), "Actual parent visibility wins over the old source-config hidden snapshot");
  check(await scalar("SELECT required AS value FROM campaign_status_list_items WHERE id=$1", [reachGroup]), "Required answer persists independently");
  check(await scalar("SELECT revision AS value FROM mission_status_list_option_sources WHERE group_id=$1", [reachGroup]) === revision, "Visibility and required changes never re-baseline the source");
  await evaluateBackgroundContact(cc);
  check(await runCount() === 1, "Presentation changes do not execute or replay actions");
  await body(await api.post(`${root}/items/${reachOptions[1]}/move`, { data: { direction: "up" } }));
  const moved = (await pool.query("SELECT id FROM campaign_status_list_items WHERE parent_id=$1 ORDER BY sort_order,id", [reachGroup])).rows.map(row => row.id);
  check(moved.indexOf(reachOptions[1]) < moved.indexOf(reachOptions[3]), "Group choices reorder in persistent storage");
  await body(await api.post(`${root}/items/${reachOptions[1]}/move`, { data: { direction: "down" } }));
  await body(await api.post(`${root}/items/${foreignItem}/move`, { data: { direction: "up" } }), 404);
  await body(await outsider.post(`${root}/items/${reachOptions[1]}/move`, { data: { direction: "up" } }), 403);
  check((await body(await api.get(`${root}/history`))).runs.length === 1, "Manager history returns real, Mission-scoped executions");
  await body(await api.delete(`${optionRoot}/${reachGroup}`));
  // Native browser creates and edits the actual group mapping in the Mission editor.
  browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ storageState: await api.storageState(), viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${baseURL}/campaigns/${mission}?tab=settings&section=status_list`);
  await page.getByTestId(`status-list-select-${reachGroup}`).click();
  check(await page.getByTestId(`status-list-select-${reachOptions[3]}`).count() === 0, "Nested choices start collapsed");
  check(await page.locator(".slw-tree .slw-tree-label small").count() === 0, "The outline does not display question codes");
  await page.getByTestId("status-list-phase-retention").click();
  check(await page.getByTestId(`status-list-select-${reachGroup}`).count() === 0 && await page.getByTestId(`status-list-select-${resultItem}`).isVisible(), "Retention filters by persisted assignment");
  await page.getByTestId(`status-list-expand-${resultItem}`).click();
  check(await page.getByTestId(`status-list-question-row-${secondQuestion}`).getAttribute("data-hidden") === "true", "Hidden subquestions have an explicit hidden state");
  await page.getByTestId(`status-list-move-${secondQuestion}-up`).click();
  await page.waitForFunction(question => document.querySelector(".slw-question-row")?.getAttribute("data-testid") === `status-list-question-row-${question}`, secondQuestion);
  check(await scalar("SELECT id AS value FROM campaign_status_list_questions WHERE item_id=$1 ORDER BY sort_order,id LIMIT 1", [resultItem]) === secondQuestion, "Native subquestion reorder survives a database read");
  await page.getByTestId("status-list-phase-acquisition").click();
  check(await page.getByTestId(`status-list-select-${resultItem}`).count() === 0 && await page.getByTestId(`status-list-select-${reachGroup}`).isVisible(), "Acquisition excludes retention questions");
  check(await page.getByTestId("status-list-category-manager").count() === 0, "Custom category UI is removed");
  // The detail pane must obey the same filter, including zero-result filters.
  // Previously an empty selection mounted the legacy definition's ALL-root fallback.
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.getByTestId("status-list-phase-contract").click();
    check(await page.locator(".slw-tree [data-testid^='status-list-select-']").count() === 0, "Empty Contract filter has no selectable rows");
    check(await page.locator(".slw-detail-heading").count() === 0, "Empty filter cannot retain a stale detail heading");
    check(await page.locator(".slw-detail input, .slw-detail textarea, .slw-detail select").count() === 0, "Empty filter never mounts unrelated editing forms");
    check(await page.locator(".slw-detail [data-testid^='chk-select-item-']").count() === 0, "Empty filter never falls back to all legacy roots");
    await page.getByTestId("status-list-phase-retention").click();
    await page.getByTestId(`status-list-select-${resultItem}`).click();
    check(await page.locator(".slw-detail-heading").innerText().then(text => text.includes("Synthetic result")), "Retention selects only its own detail after repeated empty filters");
  }
  const search = page.locator(".slw-search input");
  await search.fill("no-such-synthetic-question");
  check(await page.locator(".slw-detail-heading").count() === 0 && await page.locator(".slw-detail input, .slw-detail textarea, .slw-detail select").count() === 0, "Empty text search clears detail without leaking a legacy form");
  await search.fill("");
  await page.getByTestId(`status-list-select-${resultItem}`).click();
  for (const id of ["status-list-step-name", "status-list-step-id", "status-list-step-next-step", "status-list-step-restrictions", "status-list-step-confirmation-type", "status-list-step-required", "status-list-step-auto-confirm", "status-list-step-selection-mode", "status-list-step-canonical-status", "status-list-step-save"]) {
    check(await page.getByTestId(id).isVisible(), `Selected question exposes integrated control ${id}`);
  }
  await page.getByTestId("status-list-step-restrictions").fill("Synthetic reviewed condition");
  await page.getByTestId("status-list-step-required").click();
  await page.getByTestId("status-list-step-auto-confirm").click();
  await page.getByTestId("status-list-step-selection-mode").click();
  await page.getByRole("option", { name: /Multiple \(checkboxes\)|Viacnásobný \(zaškrtať viacero\)/ }).click();
  const stepSave = page.waitForResponse(response => response.url().endsWith(`/status-list/${resultItem}`) && response.request().method() === "PUT");
  await page.getByTestId("status-list-step-save").click();
  check((await stepSave).ok(), "Integrated step editor saves through real endpoint");
  const storedStep = (await pool.query("SELECT restrictions,required,auto_confirm_on_sub_question,question_selection_mode,tab FROM campaign_status_list_items WHERE id=$1", [resultItem])).rows[0];
  check(storedStep.restrictions === "Synthetic reviewed condition" && storedStep.required && storedStep.auto_confirm_on_sub_question && storedStep.question_selection_mode === "multiple" && storedStep.tab === "retention", "Integrated step settings persist together without changing phase");
  await page.getByTestId(`status-list-select-question-${secondQuestion}`).click();
  await page.getByTestId("status-list-question-text").waitFor();
  check(await page.getByTestId("status-list-step-name").count() === 0, "Selected subquestion never displays editable parent settings");
  check(await page.getByTestId("status-list-question-text").inputValue() === "Synthetic hidden subquestion", "Subquestion selection opens its own saved definition");
  await page.getByTestId("status-list-question-text").fill("Synthetic hidden subquestion reviewed");
  await page.getByTestId("status-list-question-required").click();
  const questionSave = page.waitForResponse(response => response.url().endsWith(`/questions/${secondQuestion}`) && response.request().method() === "PUT");
  await page.getByTestId("status-list-question-save").click();
  check((await questionSave).ok(), "Integrated subquestion saves through its own endpoint");
  const storedQuestion = (await pool.query("SELECT question_text,required,is_hidden FROM campaign_status_list_questions WHERE id=$1", [secondQuestion])).rows[0];
  check(storedQuestion.question_text === "Synthetic hidden subquestion reviewed" && storedQuestion.required && storedQuestion.is_hidden, "Subquestion changes persist without altering visibility");
  check(await scalar("SELECT required AS value FROM campaign_status_list_items WHERE id=$1", [resultItem]), "Subquestion edit does not overwrite parent configuration");
  await page.getByTestId(`status-list-select-question-${secondQuestion}`).click();
  await page.getByTestId("status-list-question-text").waitFor();
  await page.getByTestId("status-list-question-text").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "generated-artifacts/status-list-options/integrated-subquestion.jpg" });
  await page.getByTestId(`status-list-select-${resultItem}`).click();
  await page.getByTestId("status-list-step-name").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "generated-artifacts/status-list-options/integrated-step.jpg" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({ path: "generated-artifacts/status-list-options/integrated-step-dark.jpg" });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("status-list-step-name").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "generated-artifacts/status-list-options/integrated-step-mobile.jpg" });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Integrated settings fit the mobile viewport");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await page.getByTestId("status-list-phase-retention").click();
  await page.getByTestId(`status-list-select-${resultItem}`).click();
  check(await page.getByTestId("status-list-step-restrictions").inputValue() === "Synthetic reviewed condition" && await page.getByTestId("status-list-step-auto-confirm").getAttribute("data-state") === "checked", "Step settings survive a real reload");
  await page.getByTestId(`status-list-expand-${resultItem}`).click();
  await page.getByTestId(`status-list-select-question-${secondQuestion}`).click();
  check(await page.getByTestId("status-list-question-text").inputValue() === "Synthetic hidden subquestion reviewed" && await page.getByTestId("status-list-question-required").getAttribute("data-state") === "checked", "Subquestion settings survive a real reload independently");
  await page.getByTestId(`status-list-select-${resultItem}`).click();
  await page.getByTestId(`status-list-add-question-${resultItem}`).click();
  await page.getByTestId("status-list-question-text").fill("Synthetic newly added subquestion");
  const newQuestionSaved = page.waitForResponse(response => response.url().endsWith(`/status-list/${resultItem}/questions`) && response.request().method() === "POST");
  await page.getByTestId("status-list-question-save").click();
  check((await newQuestionSaved).ok(), "A new subquestion is created within selected parent settings");
  const newQuestionId = await scalar("SELECT id AS value FROM campaign_status_list_questions WHERE item_id=$1 AND question_text='Synthetic newly added subquestion'", [resultItem]);
  check(!!newQuestionId, "New subquestion belongs to the selected parent in storage");
  const removeQuestion = page.waitForResponse(response => response.url().endsWith(`/questions/${newQuestionId}`) && response.request().method() === "DELETE");
  await page.getByTestId(`status-list-delete-question-${newQuestionId}`).click();
  check((await removeQuestion).ok() && !await scalar("SELECT id AS value FROM campaign_status_list_questions WHERE id=$1", [newQuestionId]), "New subquestion can be deleted without deleting its parent");
  await page.getByTestId(`status-list-add-child-${resultItem}`).click();
  await page.locator("#slw-new-step-name").fill("Synthetic nested question");
  const nestedSaved = page.waitForResponse(response => response.url().endsWith(`/campaigns/${mission}/status-list`) && response.request().method() === "POST");
  await page.locator(".slw-add-step-footer button").last().click();
  check((await nestedSaved).ok(), "Nested step creation works inside the new inspector");
  const nestedId = await scalar("SELECT id AS value FROM campaign_status_list_items WHERE parent_id=$1 AND label='Synthetic nested question'", [resultItem]);
  await page.getByTestId(`status-list-select-${nestedId}`).click();
  check(await page.getByTestId("status-list-step-name").inputValue() === "Synthetic nested question", "Nested question opens its own complete settings and inherits Retention");
  page.once("dialog", dialog => dialog.accept());
  const nestedRemoved = page.waitForResponse(response => response.url().endsWith(`/status-list/${nestedId}`) && response.request().method() === "DELETE");
  await page.getByTestId(`status-list-delete-${nestedId}`).click();
  check((await nestedRemoved).ok() && !await scalar("SELECT id AS value FROM campaign_status_list_items WHERE id=$1", [nestedId]), "Nested question deletion removes only the synthetic child");
  await page.getByTestId(`status-list-select-${resultItem}`).click();
  await page.getByTestId("status-list-phase-retention").click();
  await page.getByTestId("status-list-visibility-hidden").click();
  check(await page.getByTestId(`status-list-question-row-${secondQuestion}`).isVisible(), "Hidden filter retains hidden subquestions");
  await page.screenshot({ path: "generated-artifacts/status-list-options/hidden-questions.jpg" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({ path: "generated-artifacts/status-list-options/hidden-questions-dark.jpg" });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.getByTestId("status-list-visibility-visible").click();
  check(await page.getByTestId(`status-list-question-row-${secondQuestion}`).count() === 0, "Visible filter excludes hidden subquestions");
  await page.getByTestId("status-list-visibility-all").click();
  await page.getByTestId("status-list-phase-all").click();
  await page.getByTestId(`status-list-select-${reachGroup}`).click();
  check(await page.getByTestId("status-list-phase-assignment").inputValue() === "acquisition", "Agent tab assignment is visible in item details");
  const phaseSaved = page.waitForResponse(response => response.url().endsWith(`/status-list/${reachGroup}`) && response.request().method() === "PUT");
  await page.getByTestId("status-list-phase-assignment").selectOption("retention");
  await page.getByTestId("status-list-step-save").click();
  check((await phaseSaved).ok(), "Native phase assignment saves");
  await page.getByTestId("status-list-phase-retention").click();
  await page.getByTestId(`status-list-select-${reachGroup}`).waitFor({ state: "visible" });
  const phaseRestored = page.waitForResponse(response => response.url().endsWith(`/status-list/${reachGroup}`) && response.request().method() === "PUT");
  await page.getByTestId("status-list-phase-assignment").selectOption("acquisition");
  await page.getByTestId("status-list-step-save").click();
  await phaseRestored;
  await page.getByTestId("status-list-phase-all").click();
  await page.getByTestId(`status-list-select-${coordinatorGroup}`).waitFor({ state: "visible" });
  await page.getByTestId(`status-list-select-${reachGroup}`).click();
  const rootLabels = page.locator(".slw-tree > div > .slw-tree-row > button.slw-tree-label");
  const beforeRootMove = await rootLabels.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-testid")));
  const rootIndex = beforeRootMove.indexOf(`status-list-select-${reachGroup}`);
  const rootDirection = rootIndex > 0 ? "up" : "down";
  const movedRootResponse = page.waitForResponse(response => response.url().endsWith(`/items/${reachGroup}/move`) && response.request().method() === "POST");
  await page.getByTestId(`status-list-move-${reachGroup}-${rootDirection}`).click();
  const moveResponse = await movedRootResponse;
  check(moveResponse.ok(), "Native question-row reorder saves");
  const neighbor = moveResponse.request().postDataJSON().neighborId;
  const orderedRoots = (await pool.query("SELECT id FROM campaign_status_list_items WHERE campaign_id=$1 AND parent_id IS NULL ORDER BY sort_order,id", [mission])).rows.map(row => row.id);
  check(rootDirection === "up" ? orderedRoots.indexOf(reachGroup) < orderedRoots.indexOf(neighbor) : orderedRoots.indexOf(reachGroup) > orderedRoots.indexOf(neighbor), "Persisted move crosses its explicit visible neighbor");
  await page.waitForFunction(({ id, neighbor, direction }) => {
    const ids = Array.from(document.querySelectorAll(".slw-tree > div > .slw-tree-row > button.slw-tree-label")).map(node => node.getAttribute("data-testid")?.replace("status-list-select-", ""));
    return ids.includes(id) && ids.includes(neighbor) && (direction === "up" ? ids.indexOf(id) < ids.indexOf(neighbor) : ids.indexOf(id) > ids.indexOf(neighbor));
  }, { id: reachGroup, neighbor, direction: rootDirection });
  check(true, "Question row moves to its visible neighboring position");
  check(await page.getByTestId("status-list-category-assignment").count() === 0, "Item details no longer offer custom categories");
  await page.getByTestId(`status-list-select-${reachGroup}`).click();
  await page.getByTestId("status-list-inspector-owner").click();
  const panel = page.getByTestId("status-list-option-source-panel");
  await panel.waitFor({ state: "visible", timeout: 30_000 });
  // The editor may default to Slovak independent of the browser locale.
  await panel.locator("header button").click();
  await page.getByTestId("option-source-group").selectOption(reachGroup);
  for (const [key, option] of Object.entries(reachability.mapping))
    await page.getByTestId(`option-source-map-${key}`).selectOption(option);
  await page.getByTestId("option-source-policy-replyWaitHours").fill("24");
  const saved = page.waitForResponse(response => response.url().endsWith(`/option-sources/${reachGroup}`) && response.request().method() === "PUT");
  await panel.locator("button").last().click();
  check((await saved).ok(), "Native browser saves the real mapping");
  const persisted = await body(await api.get(optionRoot));
  check(persisted.sources.find((s: any) => s.groupId === reachGroup).policy.replyWaitHours === 24, "Native policy save persisted");
  await page.reload();
  await page.getByTestId(`status-list-select-${reachGroup}`).click();
  await page.getByTestId("status-list-inspector-owner").click();
  await page.getByTestId("option-source-policy-replyWaitHours").waitFor({ state: "visible" });
  check(await page.getByTestId("option-source-policy-replyWaitHours").inputValue() === "24", "Contextual source survives a real reload");
  check(await page.getByTestId("btn-open-cla-template").count() === 0, "Utility buttons are hidden from the content tab");
  const workspace = page.getByTestId("status-list-workspace");
  const draft = page.getByTestId("option-source-policy-replyWaitHours");
  await draft.fill("25");
  await draft.evaluate(node => { (window as any).__statusListDraftNode = node; });
  await page.getByTestId("status-list-toggle-fullscreen").click();
  check(await workspace.getAttribute("data-fullscreen") === "true", "Status List maximizes");
  const fullBounds = await workspace.boundingBox();
  check(!!fullBounds && fullBounds.x === 0 && fullBounds.width === 1440 && fullBounds.height >= 900, "Maximized workspace fills the desktop viewport");
  check(await draft.inputValue() === "25" && await draft.evaluate(node => node === (window as any).__statusListDraftNode), "Maximizing preserves the same editor and unsaved draft");
  await page.getByTestId("status-list-toggle-fullscreen").click();
  check(await workspace.getAttribute("data-fullscreen") === "false" && await draft.inputValue() === "25", "Restoring preserves the draft");
  await draft.fill("24");
  await page.getByTestId("status-list-toggle-fullscreen").click();
  await page.getByTestId("status-list-tab-tools").click();
  for (const id of ["btn-open-cla-template", "btn-open-import-dispositions", "btn-ai-suggest-canonical", "btn-toggle-preview", "btn-add-status-list-item"]) {
    check(await page.getByTestId(id).isVisible(), `Tools tab exposes ${id}`);
  }
  await page.getByTestId("btn-add-status-list-item").click();
  check(await page.locator(".slw-add-step").isVisible(), "Tools opens the guided step form");
  check(await page.getByTestId("select-add-tab-assignment").isVisible(), "Phase assignment is a primary creation field");
  check(await page.getByTestId("select-add-canonical-clinic-status").count() === 0 || !await page.getByTestId("select-add-canonical-clinic-status").isVisible(), "Advanced settings do not compete with primary fields");
  await page.locator(".slw-add-step").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "generated-artifacts/status-list-options/add-step-desktop.jpg" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".slw-add-step").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "generated-artifacts/status-list-options/add-step-mobile.jpg" });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Guided Add step fits mobile width");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#slw-new-step-name").fill("Synthetic guided hidden retention step");
  await page.getByTestId("select-add-tab-assignment").click();
  await page.getByRole("option", { name: "Retention", exact: true }).click();
  await page.getByTestId("select-add-step-visibility").click();
  await page.getByRole("option", { name: /Skryť pred agentmi|Keep hidden from agents/ }).click();
  const stepCreated = page.waitForResponse(response => response.url().endsWith(`/campaigns/${mission}/status-list`) && response.request().method() === "POST");
  await page.locator(".slw-add-step-footer button").last().click();
  check((await stepCreated).ok(), "Guided Add step saves through real API");
  const createdStep = (await pool.query("SELECT id,tab,is_hidden FROM campaign_status_list_items WHERE campaign_id=$1 AND label='Synthetic guided hidden retention step'", [mission])).rows[0];
  check(createdStep?.tab === "retention" && createdStep?.is_hidden === true, "Guided phase and visibility persist without changing advanced defaults");
  await page.getByTestId("btn-open-cla-template").click();
  const template = page.locator('[role="dialog"][data-state="open"]');
  await template.waitFor({ state: "visible" });
  check(await template.evaluate(node => { const rect = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)); }), "Template dialog stays interactive above the fullscreen workspace");
  await page.keyboard.press("Escape");
  await template.waitFor({ state: "hidden" });
  check(await workspace.getAttribute("data-fullscreen") === "true", "Escape closes the nested dialog first");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector('[data-testid="status-list-workspace"]')?.getAttribute("data-fullscreen") === "false", undefined, { timeout: 3000 });
  check(await workspace.getAttribute("data-fullscreen") === "false", "Escape restores the Status List window");
  await page.getByTestId("status-list-tab-rules").click();
  check(await page.getByTestId("status-list-workflows").isVisible(), "Rules are a separate functional tab");
  await page.getByTestId("status-list-tab-tests").click();
  await page.getByTestId("status-list-history").waitFor({ state: "visible" });
  const runsBeforeDry = await runCount();
  await page.getByTestId("status-list-dry-run").locator("select").first().selectOption({ label: "Synthetic reachable transition" });
  await page.getByTestId("status-list-dry-run").locator("select").nth(1).selectOption("true");
  await page.getByTestId("status-list-run-test").click();
  check(await page.getByTestId("status-list-test-result").isVisible(), "Dry-run displays its real hypothetical result");
  check(await runCount() === runsBeforeDry, "Browser dry-run creates no execution rows");
  await page.getByTestId("status-list-tab-content").click();
  await page.getByTestId(`status-list-expand-${reachGroup}`).click();
  await page.getByTestId(`status-list-select-${reachOptions[3]}`).click();
  await page.getByTestId("status-list-inspector-owner").click();
  await page.getByTestId("status-list-option-source-panel").waitFor({ state: "visible" });
  check(await page.getByTestId("option-source-group").inputValue() === reachGroup, "A child choice configures its parent source, not a competing source");
  await mkdir("generated-artifacts/status-list-options", { recursive: true });
  await page.screenshot({ path: "generated-artifacts/status-list-options/desktop.jpg", fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("status-list-toggle-fullscreen").click();
  check(await workspace.getAttribute("data-fullscreen") === "true", "Mobile fullscreen activates");
  const restore = page.getByTestId("status-list-toggle-fullscreen");
  await page.screenshot({ path: "generated-artifacts/status-list-options/fullscreen-mobile.jpg" });
  const restoreHit = await restore.evaluate(node => { const rect = node.getBoundingClientRect(); const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2); return { okay: node.contains(hit), rect: rect.toJSON(), hit: hit?.outerHTML.slice(0, 400), workspaceTop: getComputedStyle(node.closest(".slw")!).top, hostStyle: node.closest(".slw")!.parentElement?.getAttribute("style") }; });
  if (!restoreHit.okay) console.log("Mobile restore diagnostics", restoreHit);
  check(restoreHit.okay, "Mobile restore control is not covered by another element");
  await page.getByTestId("status-list-option-source-panel").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "generated-artifacts/status-list-options/mobile.jpg" });
  const mobilePanel = await page.getByTestId("status-list-option-source-panel").boundingBox();
  check(!!mobilePanel && mobilePanel.width >= 220, "Mobile inspector retains a usable input width");
  await restore.click();
  check(await workspace.getAttribute("data-fullscreen") === "false", "Mobile fullscreen restores");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobile page has no horizontal overflow");
  check(!errors.length, `Native browser runtime errors: ${errors.join("; ")}`);
  console.log(`Status List option sources: ${checks} assertions passed`);
} catch (error) {
  console.error("Option source verification failed:", error);
  throw error;
} finally {
  await browser?.close();
  await api.post("/api/auth/logout"); await outsider.post("/api/auth/logout");
  await api.dispose(); await outsider.dispose();
  await pool.query("DELETE FROM call_logs WHERE user_id=$1", [user]);
  await pool.query("DELETE FROM communication_messages WHERE entity_id=$1", [clinic]);
  for (const id of [cloneId, mission, foreign].filter(Boolean)) {
    await pool.query("DELETE FROM mission_status_list_option_sources WHERE campaign_id=$1", [id]);
    await pool.query("DELETE FROM campaign_contact_history WHERE campaign_contact_id IN (SELECT id FROM campaign_contacts WHERE campaign_id=$1)", [id]);
    await pool.query("DELETE FROM campaign_contact_status_list_state WHERE campaign_contact_id IN (SELECT id FROM campaign_contacts WHERE campaign_id=$1)", [id]);
    await pool.query("DELETE FROM campaign_contacts WHERE campaign_id=$1", [id]);
    await pool.query("DELETE FROM campaign_agents WHERE campaign_id=$1", [id]);
    await pool.query("DELETE FROM campaign_status_list_questions WHERE item_id IN (SELECT id FROM campaign_status_list_items WHERE campaign_id=$1)", [id]);
    await pool.query("DELETE FROM campaign_status_list_items WHERE campaign_id=$1", [id]);
    await pool.query("DELETE FROM nexus_pulse_module_revisions WHERE campaign_id=$1", [id]);
    await pool.query("DELETE FROM campaigns WHERE id=$1", [id]);
  }
  await pool.query("DELETE FROM clinic_representative_assignments WHERE clinic_id=$1", [clinic]);
  await pool.query("DELETE FROM clinics WHERE id=$1", [clinic]);
  await pool.query("DELETE FROM user_sessions WHERE user_id=ANY($1::varchar[])", [[user, manager]]);
  await pool.query("DELETE FROM users WHERE id=ANY($1::varchar[])", [[user, manager]]);
  await pool.query("DELETE FROM mission_status_list_dirty WHERE entity_id=ANY($1::varchar[])", [[mission, foreign, cc, clinic, cloneId].filter(Boolean)]);
  await pool.end();
}
