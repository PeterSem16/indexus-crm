import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { request } from "playwright";
import { pool } from "../server/db";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw Error("Development fixtures only");
const [user, outsider, mission, otherMission, clinic, contact, item, question, otherItem, otherQuestion] =
  Array.from({ length: 10 }, () => randomUUID());
const password = randomBytes(24).toString("hex"), username = `audit-${user}`;
const api = await request.newContext({ baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}` });
const other = await request.newContext({ baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}` });
const root = `/api/campaigns/${mission}/contacts/${contact}/status-list-workflows`;
const endpoint = `${root}/answers/${question}/note`;
const response = async (r: any, status = 200) => {
  const body = await r.json(); assert.equal(r.status(), status, JSON.stringify(body)); return body;
};
try {
  const hash = await bcrypt.hash(password, 10);
  for (const [id, role] of [[user, "admin"], [outsider, "user"]]) await pool.query(
    `INSERT INTO users(id,username,password_hash,full_name,email,role,is_active,assigned_countries)
     VALUES($1,$2,$3,'Synthetic audit tester',$4,$5,true,ARRAY['SK'])`,
    [id, `audit-${id}`, hash, `audit-${id}@example.invalid`, role]);
  for (const id of [mission, otherMission]) await pool.query(
    "INSERT INTO campaigns(id,name,country_codes,status,settings) VALUES($1,'Synthetic audit test',ARRAY['SK'],'active',$2)",
    [id, JSON.stringify({ statusListMode: "batch" })]);
  await pool.query("INSERT INTO clinics(id,name,country_code) VALUES($1,'Synthetic audit clinic','SK')", [clinic]);
  await pool.query("INSERT INTO campaign_contacts(id,campaign_id,contact_type,clinic_id) VALUES($1,$2,'clinic',$3)", [contact, mission, clinic]);
  for (const [id, mid] of [[item, mission], [otherItem, otherMission]]) await pool.query(
    "INSERT INTO campaign_status_list_items(id,campaign_id,step_id,label) VALUES($1,$2,'audit','Synthetic audit step')", [id, mid]);
  for (const [id, iid] of [[question, item], [otherQuestion, otherItem]]) await pool.query(
    "INSERT INTO campaign_status_list_questions(id,item_id,question_text) VALUES($1,$2,'Synthetic audit question')", [id, iid]);
  await pool.query(`INSERT INTO mission_status_list_answers(campaign_contact_id,question_id,value,updated_by)
    VALUES($1,$2,'false'::jsonb,$3)`, [contact, question, user]);
  await response(await api.patch(endpoint, { data: { note: "not authorized" } }), 401);
  await response(await api.post("/api/auth/login", { data: { username, password } }));
  await response(await other.post("/api/auth/login", { data: { username: `audit-${outsider}`, password } }));
  await response(await other.patch(endpoint, { data: { note: "not permitted" } }), 403);
  const before = await response(await api.get(root));
  assert.equal(before.answerMetadata[question].answeredByName, "Synthetic audit tester");
  assert.equal(before.answerMetadata[question].actorKind, "user");
  await response(await api.patch(endpoint, { data: {} }), 400);
  await response(await api.patch(endpoint, { data: { note: "x", confirm: true } }), 400);
  await response(await api.patch(endpoint, { data: { note: "x".repeat(10001) } }), 400);
  await response(await api.patch(`${root}/answers/${otherQuestion}/note`, { data: { note: "cross-Mission" } }), 404);
  await response(await api.patch(endpoint, { data: { note: "Saved in Batch without confirming" } }));
  const saved = await response(await api.get(root));
  assert.equal(saved.questionNotes[question].note, "Saved in Batch without confirming");
  assert.deepEqual(saved.answerMetadata, before.answerMetadata);
  assert.deepEqual(saved.answers, before.answers);
  await response(await api.patch(endpoint, { data: { note: null } }));
  const cleared = await response(await api.get(root));
  assert.equal(cleared.questionNotes[question].note, null);
  for (const table of ["campaign_contact_status_list_state", "mission_status_list_rule_runs", "mission_status_list_automatic_events"]) {
    const count = await pool.query(`SELECT count(*) FROM ${table} WHERE campaign_contact_id=$1`, [contact]);
    assert.equal(count.rows[0].count, "0", `${table}: note cannot admit actions or confirmations`);
  }
  console.log("Question audit API passed: auth, Mission boundary, payload validation, provenance, Batch notes and zero effects.");
} finally {
  await api.dispose(); await other.dispose();
  await pool.query("DELETE FROM campaign_contact_history WHERE campaign_contact_id=$1", [contact]);
  await pool.query("DELETE FROM campaign_contacts WHERE id=$1", [contact]);
  await pool.query("DELETE FROM campaign_status_list_questions WHERE id=ANY($1::varchar[])", [[question, otherQuestion]]);
  await pool.query("DELETE FROM campaign_status_list_items WHERE id=ANY($1::varchar[])", [[item, otherItem]]);
  await pool.query("DELETE FROM campaigns WHERE id=ANY($1::varchar[])", [[mission, otherMission]]);
  await pool.query("DELETE FROM clinics WHERE id=$1", [clinic]);
  await pool.query("DELETE FROM user_sessions WHERE user_id=ANY($1::varchar[])", [[user, outsider]]).catch(() => {});
  await pool.query("DELETE FROM users WHERE id=ANY($1::varchar[])", [[user, outsider]]);
  await pool.end();
}
