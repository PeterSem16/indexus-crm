import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db";
import { executeEvent, saveWorkflowQuestion, workflowTransaction, processStatusListItemWorkflow } from "../server/lib/status-list-workflow";
import { statusListWorkflowSchema, remapStatusListWorkflow, type StatusListWorkflow } from "../shared/status-list-workflow";
import { getStatusListChainCopy } from "../client/src/components/status-list-chain-copy";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw Error("Development fixtures only");
const [mission, otherMission, user, customer, cc, otherCc, item, item2] = Array.from({ length: 8 }, () => randomUUID());
const questions = Array.from({ length: 14 }, () => randomUUID());
let checks = 0;
const check = (value: unknown, label: string) => { assert.ok(value, label); checks++; };
const ref = (index: number) => ({ kind: "question" as const, id: questions[index] });
const base = (from: number, to: number, chain = false): StatusListWorkflow => ({
  name: `Synthetic chain ${from} to ${to}`, enabled: true, source: ref(from),
  trigger: "agent_confirmation", logic: "and", conditions: [], runTargetAutomations: chain,
  thenActions: [{ type: "set_answer", target: ref(to), value: "yes", mode: "replace" }], elseActions: [],
});
const add = async (definition: StatusListWorkflow) => (await pool.query(`INSERT INTO mission_status_list_rules(campaign_id,definition,created_by)
  VALUES($1,$2::jsonb,$3) RETURNING id`, [mission, JSON.stringify(statusListWorkflowSchema.parse(definition)), user])).rows[0].id as string;
const value = async (index: number, contact = cc) => (await pool.query("SELECT value FROM mission_status_list_answers WHERE campaign_contact_id=$1 AND question_id=$2", [contact, questions[index]])).rows[0]?.value;
const reset = async () => {
  await pool.query("DELETE FROM mission_status_list_rules WHERE campaign_id=$1", [mission]);
  await pool.query("DELETE FROM mission_status_list_rule_runs WHERE campaign_id=$1", [mission]);
  await pool.query("DELETE FROM mission_status_list_answers WHERE campaign_contact_id=$1", [cc]);
};
const fire = () => saveWorkflowQuestion({ campaignId: mission, campaignContactId: cc, actorId: user, questionId: questions[0], value: "yes" });
try {
  await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,is_active)
    VALUES($1::varchar,$1::text,$2,'Synthetic chain tester','not-a-login','admin',true)`, [user, `${user}@example.invalid`]);
  for (const id of [mission, otherMission]) await pool.query("INSERT INTO campaigns(id,name,country_codes,status) VALUES($1,'Synthetic chain',ARRAY['SK'],'active')", [id]);
  await pool.query("INSERT INTO customers(id,first_name,last_name,email,country) VALUES($1,'Synthetic','Chain',$2,'SK')", [customer, `${customer}@example.invalid`]);
  for (const [id, campaign] of [[cc, mission], [otherCc, otherMission]]) await pool.query("INSERT INTO campaign_contacts(id,campaign_id,customer_id,contact_type) VALUES($1,$2,$3,'customer')", [id, campaign, customer]);
  for (const id of [item, item2]) await pool.query("INSERT INTO campaign_status_list_items(id,campaign_id,step_id,label,confirmation_type) VALUES($1::varchar,$2,$1::text,'Synthetic chain step','checkbox')", [id, mission]);
  for (const [index, id] of questions.entries()) await pool.query("INSERT INTO campaign_status_list_questions(id,item_id,question_text,field_type,sort_order) VALUES($1,$2,$3,'yesno',$4)", [id, item, `Synthetic chain question ${index}`, index]);
  const defaults = { ...base(0, 1) }; delete defaults.runTargetAutomations;
  check(!statusListWorkflowSchema.parse(defaults).runTargetAutomations, "Legacy rules default to write-only");
  const first = await add(defaults); await add(base(1, 2));
  await fire();
  check(await value(1) === "yes" && await value(2) === undefined, "Default does not run target rules");
  await pool.query("UPDATE mission_status_list_rules SET definition=$2::jsonb WHERE id=$1", [first, JSON.stringify(base(0, 1, true))]);
  await saveWorkflowQuestion({ campaignId: mission, campaignContactId: cc, actorId: user, questionId: questions[0], value: null });
  await fire();
  check(await value(2) === undefined, "Unchanged target does not emit a chained transition");
  await reset(); await add(base(0, 1, true)); await add(base(1, 2));
  await Promise.all([fire(), fire(), fire()]);
  check(await value(2) === "yes", "Explicit opt-in runs downstream rules");
  let runs = (await pool.query("SELECT * FROM mission_status_list_rule_runs WHERE campaign_id=$1", [mission])).rows;
  check(runs.length === 2, "Concurrent event replay runs each rule once");
  const child = runs.find(row => row.results[0].causation);
  check(child?.results[0].causation.depth === 1 && child.results[0].causation.parentRunId, "Audit preserves depth and parent run");
  check(child?.actor_kind === "user", "User attribution survives chaining");
  check(await value(2, otherCc) === undefined, "Chain never crosses Mission/contact boundaries");
  await reset(); await add(base(0, 1, true)); await add(base(1, 0, true)); await fire();
  check(await value(0) === "yes" && await value(1) === "yes", "Cycle cannot overwrite root answer");
  runs = (await pool.query("SELECT results FROM mission_status_list_rule_runs WHERE campaign_id=$1", [mission])).rows;
  check(runs.some(row => row.results.some((result: any) => result.reason === "chain_conflict")), "Cycle stop is audited");
  await reset();
  const root = base(0, 1, true); root.thenActions.push({ type: "set_answer", target: ref(2), value: "yes", mode: "replace" });
  await add(root); await add(base(1, 3)); const conflict = base(2, 3); conflict.thenActions = [{ type: "set_answer", target: ref(3), value: "no", mode: "replace" }]; await add(conflict);
  await fire();
  check(await value(3) === "yes", "Breadth-first stable order prevents competing child writes");
  runs = (await pool.query("SELECT results FROM mission_status_list_rule_runs WHERE campaign_id=$1", [mission])).rows;
  check(runs.some(row => row.results.some((result: any) => result.reason === "chain_conflict")), "Competing write recorded as blocked");
  await reset();
  for (let i = 0; i < 13; i++) await add(base(i, i + 1, true));
  await fire();
  check(await value(11) === "yes" && await value(12) === undefined, "Depth cap bounds long chains");
  runs = (await pool.query("SELECT results FROM mission_status_list_rule_runs WHERE campaign_id=$1", [mission])).rows;
  check(runs.some(row => row.results.some((result: any) => result.chainStatus === "limit_reached")), "Depth limit appears in audit");
  await reset();
  await pool.query("UPDATE campaign_status_list_items SET question_selection_mode='single' WHERE id=$1", [item]);
  await add(base(0, 1, true)); await fire();
  check(await value(0) === "yes" && await value(1) === undefined, "Exclusive sibling changes cannot erase the chain source");
  check((await pool.query("SELECT results FROM mission_status_list_rule_runs WHERE campaign_id=$1", [mission])).rows[0].results[0].reason === "chain_conflict", "Exclusive conflict rolls back its write and audits the block");
  await pool.query("UPDATE campaign_status_list_items SET question_selection_mode='multiple' WHERE id=$1", [item]);
  await reset();
  await add(base(0, 1, true));
  for (let i = 0; i < 102; i++) await add({ ...base(1, 2), name: `Synthetic fanout ${i}` });
  await fire();
  runs = (await pool.query("SELECT results FROM mission_status_list_rule_runs WHERE campaign_id=$1", [mission])).rows;
  check(runs.length === 100, "Wide fanout is capped at 100 executions");
  check(runs.some(row => row.results.some((result: any) => result.chainStatus === "limit_reached")), "Execution cap is visible in persisted audit");
  await reset();
  const system = base(0, 1, true); system.trigger = "background_transition";
  // Invoke a trusted background event against a real system-owned source.
  await pool.query("INSERT INTO mission_status_list_sources(question_id,campaign_id,source) VALUES($1,$2,'representative_assigned')", [questions[0], mission]);
  await add(system); await add(base(1, 2));
  await workflowTransaction(cc, async client => {
    const at = (await client.query("SELECT clock_timestamp() AS at")).rows[0].at;
    return executeEvent(client, { campaignId: mission, campaignContactId: cc, actorId: "system", source: ref(0), trigger: "background_transition", value: "yes", eventId: `transition:${randomUUID()}`, occurredAt: at });
  });
  runs = (await pool.query("SELECT actor_kind,results FROM mission_status_list_rule_runs WHERE campaign_id=$1", [mission])).rows;
  check(runs.length === 2 && runs.every(row => row.actor_kind === "system"), `Background chain remains system-owned: ${JSON.stringify(runs)}`);
  await pool.query("DELETE FROM mission_status_list_sources WHERE question_id=$1", [questions[0]]);
  await reset();
  const confirm = base(0, 1, true); confirm.thenActions = [{ type: "confirm_step", target: { kind: "item", id: item2 } }];
  const targetRule = { ...base(1, 2), source: { kind: "item" as const, id: item2 } };
  await add(confirm); await add(targetRule); await fire();
  const state = (await pool.query("SELECT id FROM campaign_contact_status_list_state WHERE campaign_contact_id=$1 AND status_list_item_id=$2", [cc, item2])).rows[0];
  await processStatusListItemWorkflow({ campaignId: mission, campaignContactId: cc, actorId: user, itemId: item2, stateId: state.id });
  check((await pool.query("SELECT id FROM mission_status_list_rule_runs WHERE campaign_id=$1", [mission])).rowCount === 2, "Chained step shares canonical confirmation identity with later delivery");
  check(await value(2) === "yes", "New confirmation chains through actual item state");
  const cloned = remapStatusListWorkflow(base(0, 1, true), new Map([[questions[0], "new-source"], [questions[1], "new-target"]]));
  check(cloned.runTargetAutomations && cloned.source.id === "new-source" && cloned.thenActions[0].target.id === "new-target", "Clone preserves opt-in and remaps references");
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) check(Object.values(getStatusListChainCopy(locale)).every(text => !!text.trim()), `Chain copy complete: ${locale}`);
  console.log(`Status List controlled chaining: ${checks} checks passed`);
} finally {
  await pool.query("DELETE FROM campaigns WHERE id=ANY($1::varchar[])", [[mission, otherMission]]);
  await pool.query("DELETE FROM customers WHERE id=$1", [customer]);
  await pool.query("DELETE FROM users WHERE id=$1", [user]);
  await pool.end();
}
