import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import bcrypt from "bcrypt";
import {request} from "playwright";
import {pool} from "../server/db";
if(process.env.NODE_ENV==="production" || process.env.REPLIT_DEPLOYMENT)throw Error("Development fixtures only");
const [user,outsider,mission,clinic,contact,item,action]=Array.from({length:7},()=>randomUUID());
const password=randomBytes(24).toString("hex"),username=`automatic-${user}`;
const api=await request.newContext({baseURL:`https://${process.env.REPLIT_DEV_DOMAIN}`});
const other=await request.newContext({baseURL:`https://${process.env.REPLIT_DEV_DOMAIN}`});
const root=`/api/campaigns/${mission}/status-list-workflows`;
const endpoint=`${root}/automatic-items/${item}`;
const preview=`/api/campaigns/${mission}/contacts/${contact}/status-list-workflows/automatic-preview`;
const response=async(r:any,status=200)=>{const body=await r.json();assert.equal(r.status(),status,JSON.stringify(body));return body;};
try{
  const hash=await bcrypt.hash(password,10);
  await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,assigned_countries,is_active)
    VALUES($1,$2,$3,'Synthetic trigger admin',$4,'admin',ARRAY['SK'],true),
    ($5,$6,$7,'Synthetic foreign manager',$4,'manager',ARRAY['HU'],true)`,
  [user,username,`${user}@example.invalid`,hash,outsider,`automatic-${outsider}`,`${outsider}@example.invalid`]);
  await pool.query("INSERT INTO campaigns(id,name,country_codes) VALUES($1,'Synthetic automatic API',ARRAY['SK'])",[mission]);
  await pool.query("INSERT INTO clinics(id,name,country_code) VALUES($1,'Synthetic automatic clinic','SK')",[clinic]);
  await pool.query("INSERT INTO campaign_contacts(id,campaign_id,contact_type,clinic_id) VALUES($1,$2,'clinic',$3)",[contact,mission,clinic]);
  await pool.query(`INSERT INTO campaign_status_list_items(id,campaign_id,step_id,label,confirmation_type,is_hidden)
    VALUES($1,$2,'auto-test','Synthetic hidden auto','auto',true)`,[item,mission]);
  await pool.query(`INSERT INTO campaign_status_list_automations(id,status_list_item_id,action_type,
    service_action_config,service_action_owner_id) VALUES($1,$2,'notify_role',$3::jsonb,$4)`,
  [action,item,JSON.stringify({notificationActionVersion:2,title:"Test",message:"Test",taskGroupId:randomUUID()}),user]);
  await response(await api.get(endpoint),401);
  await response(await api.post("/api/auth/login",{data:{username,password}}));
  await response(await other.post("/api/auth/login",{data:{username:`automatic-${outsider}`,password}}));
  await response(await other.get(endpoint),403);
  await response(await other.post(preview,{data:{itemId:item}}),403);
  const initial=await response(await api.get(endpoint));
  assert.equal(initial.item.confirmationType,"auto");
  assert.deepEqual(initial.actions[0].issues,[]);
  await response(await api.put(endpoint,{data:{trigger:"agent_confirmation",enabled:true,
    expectedRevision:null,acknowledged:true}}),409);
  const enabled=await response(await api.put(endpoint,{data:{trigger:"card_open",enabled:true,
    expectedRevision:null,acknowledged:true}}));
  assert.equal(enabled.config.enabled,true);
  const before=(await pool.query("SELECT count(*) FROM mission_status_list_automatic_events WHERE campaign_id=$1",[mission])).rows[0].count;
  const result=await response(await api.post(preview,{data:{itemId:item}}));
  assert.equal(result.readOnly,true);
  assert.equal(result.actions[0].status,"ready");
  assert.equal((await pool.query("SELECT count(*) FROM mission_status_list_automatic_events WHERE campaign_id=$1",[mission])).rows[0].count,before);
  const contacts=await response(await api.get(`${root}/automatic-contacts?search=Synthetic`));
  assert.ok(contacts.contacts.some((row:any)=>row.id===contact));
  await response(await api.put(endpoint,{data:{trigger:"card_open",enabled:false,
    expectedRevision:null,acknowledged:true}}),409);
  await response(await api.put(endpoint,{data:{trigger:"card_open",enabled:false,
    expectedRevision:enabled.config.revision,acknowledged:true}}));
  console.log("Status List automatic API: authenticated preview, exact contact, admin/foreign scope, config concurrency, hidden trigger validation and zero side effects passed.");
}finally{
  await pool.query("DELETE FROM mission_status_list_dirty WHERE kind='mission' AND entity_id=$1",[mission]).catch(()=>{});
  await pool.query("DELETE FROM campaign_status_list_automations WHERE id=$1",[action]);
  await pool.query("DELETE FROM campaign_status_list_items WHERE id=$1",[item]);
  await pool.query("DELETE FROM campaign_contacts WHERE id=$1",[contact]);
  await pool.query("DELETE FROM campaigns WHERE id=$1",[mission]);
  await pool.query("DELETE FROM clinics WHERE id=$1",[clinic]);
  await pool.query("DELETE FROM user_sessions WHERE user_id=ANY($1::varchar[])",[[user,outsider]]);
  await pool.query("DELETE FROM users WHERE id=ANY($1::varchar[])",[[user,outsider]]);
  await api.dispose();await other.dispose();await pool.end();
}
