import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { request, chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { pool } from "../server/db";
import { evaluateBackgroundContact, runStatusListBackgroundBatch, recoverStatusListBackground, STATUS_LIST_SYSTEM_ACTOR } from "../server/lib/status-list-background";
import { cloneCampaignWithConfiguration } from "../server/lib/clone-campaign";
import { getStatusListBackgroundCopy } from "../client/src/components/status-list-background-copy";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw Error("Development fixtures only");
const [user, manager, mission, other, clinic, hospital, cc, hc, unsupported, item, question, typeQuestion, target, foreign, plain] =
  Array.from({ length: 15 }, () => randomUUID());
const ids = [user, manager, mission, other, clinic, hospital, cc, hc, unsupported, item, question, typeQuestion, target, foreign, plain];
const password = randomBytes(24).toString("hex"), username = `background-${user}`;
const api = await request.newContext({ baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}` });
const outsider = await request.newContext({ baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}` });
const root = `/api/campaigns/${mission}/status-list-workflows`;
const contactRoot = `/api/campaigns/${mission}/contacts/${cc}/status-list-workflows`;
let checks = 0;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let clonedId: string | undefined;
const check = (ok: unknown, message: string) => { assert.ok(ok, message); checks++; };
const body = async (response: any, status = 200) => {
  assert.equal(response.status(), status, (await response.text()).slice(0, 250)); checks++; return response.json();
};
const scalar = async (sql: string, values: unknown[] = []) => (await pool.query(sql, values)).rows[0]?.value;
const answer = (qid = question, contact = cc) => scalar("SELECT value FROM mission_status_list_answers WHERE campaign_contact_id=$1 AND question_id=$2", [contact, qid]);
const runs = () => scalar("SELECT count(*)::int AS value FROM mission_status_list_rule_runs WHERE campaign_id=$1", [mission]);
try {
  const hash = await bcrypt.hash(password, 10);
  await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,assigned_countries,is_active)
    VALUES($1,$2,$3,'Synthetic background admin',$4,'admin',ARRAY['SK'],true),
    ($5,$6,$7,'Synthetic foreign manager',$4,'manager',ARRAY['HU'],true)`,
  [user, username, `${user}@example.invalid`, hash, manager, `background-${manager}`, `${manager}@example.invalid`]);
  await pool.query("INSERT INTO campaigns(id,name,country_codes) VALUES($1,'Synthetic background',ARRAY['SK']),($2,'Synthetic foreign',ARRAY['SK'])", [mission, other]);
  await pool.query("INSERT INTO clinics(id,name,country_code) VALUES($1,'Synthetic background clinic','SK')", [clinic]);
  await pool.query("INSERT INTO hospitals(id,name,country_code) VALUES($1,'Synthetic background hospital','SK')", [hospital]);
  await pool.query(`INSERT INTO campaign_contacts(id,campaign_id,contact_type,clinic_id,hospital_id)
    VALUES($1,$2,'clinic',$3,NULL),($4,$2,'hospital',NULL,$5),($6,$2,'collaborator',NULL,NULL)`, [cc, mission, clinic, hc, hospital, unsupported]);
  await pool.query(`INSERT INTO campaign_status_list_items(id,campaign_id,step_id,label) VALUES($1,$2,'bg','Synthetic background step'),($3,$4,'foreign','Foreign')`, [item, mission, foreign, other]);
  for (const [id, field, label] of [[question, "yesno", "Synthetic representative assigned"], [typeQuestion, "text", "Synthetic assignment type"], [target, "text", "Synthetic workflow result"], [plain, "checkbox", "Synthetic incompatible question"]])
    await pool.query("INSERT INTO campaign_status_list_questions(id,item_id,question_text,field_type) VALUES($1,$2,$3,$4)", [id, item, label, field]);
  await pool.query(`INSERT INTO clinic_representative_assignments(clinic_id,user_id,assignment_type) VALUES($1,$2,'manual')`, [clinic, user]);
  await body(await api.get(`${root}/sources`), 401);
  await body(await api.post("/api/auth/login", { data: { username, password } }));
  await body(await outsider.post("/api/auth/login", { data: { username: `background-${manager}`, password } }));
  await body(await outsider.get(`${root}/sources`), 403);
  await body(await outsider.put(`${root}/sources/${question}`, { data: { source: "representative_assigned", hidden: true } }), 403);
  await body(await api.put(`${root}/sources/${plain}`, { data: { source: "representative_assigned", hidden: true } }), 400);
  await body(await api.put(`/api/campaigns/${other}/status-list-workflows/sources/${question}`, { data: { source: "representative_assigned", hidden: true } }), 404);
  await body(await api.put(`${root}/sources/${question}`, { data: { source: "representative_assigned", hidden: true } }));
  await body(await api.put(`${root}/sources/${typeQuestion}`, { data: { source: "representative_assignment_type", hidden: false } }));
  const rule = { name: "Synthetic background transition", enabled: true, source: { kind: "question", id: question },
    trigger: "background_transition", logic: "and", conditions: [{ field: "answer", ref: { kind: "question", id: question }, op: "equals", value: "yes" }],
    thenActions: [{ type: "set_answer", target: { kind: "question", id: target }, mode: "replace", value: "Assigned" }],
    elseActions: [{ type: "set_answer", target: { kind: "question", id: target }, mode: "replace", value: "Unassigned" }] };
  await body(await api.post(root, { data: rule }), 201);
  await body(await api.post(root, { data: { ...rule, name: "Must not chain", source: { kind: "question", id: target },
    trigger: "agent_confirmation", conditions: [], elseActions: [], thenActions: [{ type: "append_note", target: { kind: "item", id: item }, text: "Must not execute" }] } }), 201);
  await body(await api.post(root, { data: { ...rule, trigger: "agent_confirmation" } }), 400);
  await body(await api.post(root, { data: { ...rule, source: { kind: "question", id: target } } }), 400);
  await body(await api.post(root, { data: { ...rule, thenActions: [{ ...rule.thenActions[0], target: { kind: "question", id: typeQuestion } }] } }), 400);
  await evaluateBackgroundContact(cc);
  check(await answer() === "yes", "Baseline reads temporal clinic assignment");
  check(await answer(typeQuestion) === "manual", "Assignment type maps authoritative history");
  check(await runs() === 0 && await answer(target) === undefined, "Initial baseline never replays actions");
  await evaluateBackgroundContact(hc);
  check(await answer(question, hc) === "no", "Hospital with no assignment is known no");
  await evaluateBackgroundContact(unsupported);
  check(await answer(question, unsupported) === null, "Unsupported entity remains unknown, not no");
  await body(await api.put(`${contactRoot}/answers/${question}`, { data: { value: "no" } }), 400);
  const before = await scalar("SELECT count(*)::int AS value FROM mission_status_list_transitions WHERE campaign_contact_id=$1", [cc]);
  await Promise.all(Array.from({ length: 5 }, () => evaluateBackgroundContact(cc)));
  check(await runs() === 0, "Concurrent unchanged evaluation does not fire");
  check(await scalar("SELECT count(*)::int AS value FROM mission_status_list_transitions WHERE campaign_contact_id=$1", [cc]) === before, "Unchanged values have no transition");
  await pool.query("UPDATE clinic_representative_assignments SET valid_to=now() WHERE clinic_id=$1 AND valid_to IS NULL", [clinic]);
  check(await scalar("SELECT count(*)::int AS value FROM mission_status_list_dirty WHERE kind='clinic' AND entity_id=$1", [clinic]) === 1, "Database writer commits durable dirty event");
  await Promise.all(Array.from({ length: 5 }, () => evaluateBackgroundContact(cc)));
  check(await answer() === "no" && await answer(target) === "Unassigned", "Source transition executes ELSE without agent interaction");
  check(await runs() === 1, "Concurrent source transitions execute exactly once");
  check(await answer(typeQuestion) === null, "Unassignment clears source-owned assignment type");
  const audit = await body(await api.get(contactRoot));
  check(audit.runs[0].actorKind === "system" && !audit.runs[0].actorName, "System never impersonates configuring user");
  check(audit.transitions.some((t: any) => t.previous === "yes" && t.value === "no" && !t.baseline), "Transition audit separate from runs");
  check(audit.catalog.find((q: any) => q.id === question).hidden && !audit.catalog.find((q: any) => q.id === question).writable, "Hidden independent of system ownership");
  check(!audit.catalog.find((q: any) => q.id === typeQuestion).hidden && !audit.catalog.find((q: any) => q.id === typeQuestion).writable, "Visible derived answer also readonly");
  await pool.query(`INSERT INTO clinic_representative_assignments(clinic_id,user_id,assignment_type) VALUES($1,$2,'bulk_region')`, [clinic, user]);
  for (let i = 0; i < 6 && await answer() !== "yes"; i++) await runStatusListBackgroundBatch();
  check(await answer() === "yes" && await answer(target) === "Assigned", "Dirty worker evaluates without card or authenticated request");
  check(await answer(typeQuestion) === "bulk_region" && await runs() === 2, "Multiple sources share current snapshot");
  await pool.query(`INSERT INTO hospital_representative_assignments(hospital_id,user_id,assignment_type,valid_from) VALUES($1,$2,'import',now()+interval '1 day')`, [hospital, user]);
  await evaluateBackgroundContact(hc);
  check(await answer(question, hc) === "no", "Future assignment is not prematurely active");
  await pool.query("UPDATE hospital_representative_assignments SET valid_from=now()-interval '1 minute' WHERE hospital_id=$1", [hospital]);
  await pool.query("DELETE FROM mission_status_list_dirty WHERE entity_id=ANY($1::varchar[])", [[hospital, hc, mission]]);
  await recoverStatusListBackground();
  check(await answer(question, hc) === "yes" && await answer(typeQuestion, hc) === "import", "Timed recovery follows temporal activation even without dirty hint");
  const revision = await scalar("SELECT revision AS value FROM mission_status_list_sources WHERE question_id=$1", [question]);
  await body(await api.put(`${root}/sources/${question}`, { data: { source: "representative_assigned", hidden: false } }));
  await evaluateBackgroundContact(cc);
  check(await scalar("SELECT revision AS value FROM mission_status_list_sources WHERE question_id=$1", [question]) === revision, "Visibility edit preserves initialized source generation");
  check(await runs() === 3, "Visibility-only edit does not fire actions");
  await body(await api.delete(`${root}/sources/${question}`));
  await body(await api.put(`${root}/sources/${question}`, { data: { source: "representative_assigned", hidden: true } }));
  await evaluateBackgroundContact(cc);
  check(await runs() === 3, "Re-enabling uses a fresh non-replaying baseline");
  check(await scalar("SELECT updated_by AS value FROM mission_status_list_answers WHERE campaign_contact_id=$1 AND question_id=$2", [cc, question]) === STATUS_LIST_SYSTEM_ACTOR, "Answer provenance is explicitly non-human");
  check(!await scalar("SELECT note AS value FROM mission_status_list_notes WHERE campaign_contact_id=$1 AND status_list_item_id=$2", [cc, item]), "Background writes do not chain agent automations");
  const clone = await cloneCampaignWithConfiguration(mission, user, "Synthetic background clone");
  assert.ok(clone);
  clonedId = clone.id;
  const clonedSources = (await pool.query("SELECT question_id,revision,source FROM mission_status_list_sources WHERE campaign_id=$1", [clone.id])).rows;
  check(clonedSources.length === 2 && clonedSources.every(s => ![question, typeQuestion].includes(s.question_id)), "Cloning remaps background question references");
  check(clonedSources.every(s => s.revision !== revision), "Cloning starts fresh source generations");
  check(await scalar("SELECT count(*)::int AS value FROM mission_status_list_transitions WHERE campaign_id=$1", [clone.id]) === 0, "Clone excludes operational transitions");
  await body(await api.post(`/api/campaigns/${mission}/nexus-pulse/versions`, { data: { changeNote: "Synthetic background snapshot" } }), 201);
  const snapshot = await scalar("SELECT snapshot AS value FROM nexus_pulse_module_revisions WHERE campaign_id=$1 ORDER BY version_number DESC LIMIT 1", [mission]);
  check(snapshot.workflowSources.length === 2 && !("revision" in snapshot.workflowSources[0]), "Version snapshots contain configuration only, not runtime source generations");
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
    const copy = getStatusListBackgroundCopy(locale);
    check(Object.values(copy).every(value => typeof value === "string" && value.length), `Complete ${locale} source copy`);
  }
  browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}`, storageState: await api.storageState(), viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/campaigns/${mission}?tab=settings&section=status_list`);
  await page.getByTestId(`status-list-select-${item}`).click();
  await page.getByTestId("status-list-inspector-owner").click();
  await page.getByTestId("status-list-background-sources").waitFor();
  await page.getByTestId("status-list-background-sources").scrollIntoViewIfNeeded();
  check(await page.getByTestId("status-list-background-sources").getByText("Synthetic representative assigned", { exact: true }).count() > 0, "Native UI shows configured source");
  await mkdir("generated-artifacts/status-list-workflow", { recursive: true });
  await page.screenshot({ path: "generated-artifacts/status-list-workflow/background-desktop.jpg" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("status-list-background-sources").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "generated-artifacts/status-list-workflow/background-mobile.jpg" });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Background panel has no mobile document overflow");
  check(errors.length === 0, "No native browser runtime errors");
  console.log(`Status List background: ${checks} assertions passed`);
} finally {
  await browser?.close();
  await api.post("/api/auth/logout"); await outsider.post("/api/auth/logout");
  await api.dispose(); await outsider.dispose();
  const campaignIds = [mission, other, ...(clonedId ? [clonedId] : [])];
  await pool.query("DELETE FROM campaign_contact_history WHERE campaign_contact_id=ANY($1::varchar[])", [[cc, hc, unsupported]]);
  await pool.query("DELETE FROM campaign_contact_status_list_state WHERE campaign_contact_id=ANY($1::varchar[])", [[cc, hc, unsupported]]);
  await pool.query("DELETE FROM campaign_contacts WHERE campaign_id=ANY($1::varchar[])", [[mission, other]]);
  await pool.query("DELETE FROM campaign_status_list_questions WHERE item_id IN (SELECT id FROM campaign_status_list_items WHERE campaign_id=ANY($1::varchar[]))", [campaignIds]);
  await pool.query("DELETE FROM campaign_status_list_items WHERE campaign_id=ANY($1::varchar[])", [campaignIds]);
  await pool.query("DELETE FROM nexus_pulse_module_revisions WHERE campaign_id=ANY($1::varchar[])", [campaignIds]);
  await pool.query("DELETE FROM campaigns WHERE id=ANY($1::varchar[])", [campaignIds]);
  await pool.query("DELETE FROM clinic_representative_assignments WHERE clinic_id=$1", [clinic]);
  await pool.query("DELETE FROM hospital_representative_assignments WHERE hospital_id=$1", [hospital]);
  await pool.query("DELETE FROM clinics WHERE id=$1", [clinic]);
  await pool.query("DELETE FROM hospitals WHERE id=$1", [hospital]);
  await pool.query("DELETE FROM user_sessions WHERE user_id=ANY($1::varchar[])", [[user, manager]]);
  await pool.query("DELETE FROM users WHERE id=ANY($1::varchar[])", [[user, manager]]);
  await pool.query("DELETE FROM mission_status_list_dirty WHERE entity_id=ANY($1::varchar[])", [[...ids, ...campaignIds]]);
  await pool.end();
}
