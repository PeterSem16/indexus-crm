// Explicit development-only setup/cleanup for mission-contact-loads.browser.test.mjs.
import pg from "pg";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
const file="/tmp/mission-load-browser-fixture.json";
if (process.env.NODE_ENV === "production" || !process.env.REPLIT_DEV_DOMAIN) throw Error("Development workspace only");
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const tx=await pool.connect();
try {
  await tx.query("BEGIN");
  if(process.argv.includes("--seed")) {
    if(await fs.stat(file).catch(()=>null))throw Error("Clean up the previous fixture first");
    const id=randomUUID(),campaign=randomUUID(),clinic=randomUUID(),old=randomUUID();
    const username=`load-safety-${id.slice(0,8)}`,password=`Fixture-${randomUUID()}`;
    await tx.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,is_active,assigned_countries)
      VALUES($1,$2,$3,'Load safety browser',$4,'admin',true,ARRAY['SK'])`,
    [id,username,`${username}@example.test`,await bcrypt.hash(password,10)]);
    await tx.query("INSERT INTO campaigns(id,name,country_codes,status,created_by) VALUES($1,$2,ARRAY['SK'],'draft',$3)",
      [campaign,`LOAD SAFETY BROWSER ${id.slice(0,8)}`,id]);
    for(const [clinicId,name] of [[clinic,"NEW"],[old,"KEEP"]])await tx.query(
      "INSERT INTO clinics(id,name,country_code) VALUES($1,$2,'SK')",[clinicId,`LOAD SAFETY ${name} ${id.slice(0,8)}`]);
    await tx.query(`INSERT INTO campaign_contacts(campaign_id,clinic_id,contact_type,status,notes,attempt_count)
      VALUES($1,$2,'clinic','completed','KEEP PREVIOUS WORK',2)`,[campaign,old]);
    await fs.writeFile(file,JSON.stringify({id,campaign,clinic,old,username,password,devUrl:`https://${process.env.REPLIT_DEV_DOMAIN}`}),{mode:0o600});
  } else if(process.argv.includes("--cleanup")) {
    const f=JSON.parse(await fs.readFile(file,"utf8"));
    const mission=(await tx.query("SELECT name,created_by FROM campaigns WHERE id=$1",[f.campaign])).rows[0];
    if(!mission?.name.startsWith("LOAD SAFETY BROWSER ") || mission.created_by!==f.id)throw Error("Fixture identity mismatch");
    const remaining=(await tx.query("SELECT clinic_id,status,notes,attempt_count FROM campaign_contacts WHERE campaign_id=$1",[f.campaign])).rows;
    if(remaining.length!==1 || remaining[0].clinic_id!==f.old || remaining[0].status!=="completed" ||
      remaining[0].notes!=="KEEP PREVIOUS WORK" || remaining[0].attempt_count!==2)throw Error("Original fixture work changed; preserve evidence");
    const newIds=(await tx.query("SELECT snapshots FROM mission_contact_loads WHERE campaign_id=$1",[f.campaign])).rows
      .flatMap(r=>r.snapshots.map(s=>s.clinic_id)).filter(Boolean);
    await tx.query("DELETE FROM campaign_contact_history WHERE user_id=$1",[f.id]);
    await tx.query("DELETE FROM entity_campaign_timeline WHERE campaign_id=$1",[f.campaign]);
    await tx.query("DELETE FROM activity_logs WHERE user_id=$1",[f.id]);
    await tx.query("DELETE FROM mission_contact_loads WHERE campaign_id=$1",[f.campaign]);
    await tx.query("DELETE FROM campaign_contacts WHERE campaign_id=$1",[f.campaign]);
    await tx.query("DELETE FROM campaigns WHERE id=$1",[f.campaign]);
    await tx.query("DELETE FROM clinics WHERE id=ANY($1::varchar[])",[[f.old,f.clinic,...newIds]]);
    await tx.query('DELETE FROM session WHERE sess::jsonb->\'user\'->>\'id\'=$1',[f.id]);
    await tx.query("DELETE FROM user_sessions WHERE user_id=$1",[f.id]);
    await tx.query("DELETE FROM users WHERE id=$1",[f.id]);
    await fs.unlink(file);
  } else throw Error("Use --seed or --cleanup");
  await tx.query("COMMIT");
  console.log("Development fixture operation completed; no real Mission changed.");
} catch(error){await tx.query("ROLLBACK");throw error;}
finally{tx.release();await pool.end();}
