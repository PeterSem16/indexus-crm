import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../db";
import { ensureContactLoadSchema, previewLoad, applyLoad, undoLoad } from "./mission-contact-loads";
import { fileCandidates } from "./mission-contact-load-file";
import { contactKinds, entityTables, entityColumns } from "./mission-contact-load-plan";

test("real database: additive, idempotent, concurrent, atomic failure, permissions and protected undo", async () => {
  const actor=randomUUID(),campaign=randomUUID(), old=randomUUID(),first=randomUUID(),second=randomUUID();
  const oldContact=randomUUID();
  const imported: {table:string;id:string}[]=[];
  const selected=(rows:any[],criteria:any[])=>rows.filter(row=>criteria[0]?.ids?.includes(row.id));
  const preview=(ids:string[])=>previewLoad(pool,actor,campaign,"crm",{contactSources:["clinic"],clinicCriteria:[{ids}]},selected);
  await ensureContactLoadSchema(pool);
  try {
    await pool.query("INSERT INTO users(id,username,email,full_name,password_hash,role,is_active,assigned_countries) VALUES($1,$2,$3,'Contact safety test','not-a-login','admin',true,ARRAY['SK'])",[actor,actor,`${actor}@example.test`]);
    await pool.query("INSERT INTO campaigns(id,name,country_codes,status) VALUES($1,'Contact safety test',ARRAY['SK'],'draft')",[campaign]);
    for(const id of [old,first,second]) await pool.query("INSERT INTO clinics(id,name,country_code) VALUES($1,$2,'SK')",[id,id]);
    await pool.query(`INSERT INTO campaign_contacts(id,campaign_id,clinic_id,contact_type,status,notes,attempt_count,callback_date)
      VALUES($1,$2,$3,'clinic','callback_scheduled','preserved work',3,'2030-01-01')`,[oldContact,campaign,old]);
    await pool.query("INSERT INTO campaign_contact_history(campaign_contact_id,user_id,action,notes) VALUES($1,$2,'note_added','keep history')",[oldContact,actor]);
    const before=(await pool.query("SELECT to_jsonb(c) AS row FROM campaign_contacts c WHERE id=$1",[oldContact])).rows[0].row;
    const plan=await preview([old,first]);
    assert.deepEqual(plan.counts,{new:1,existing:1,invalid:0});
    const applied=await Promise.all([applyLoad(pool,actor,campaign,plan.id),applyLoad(pool,actor,campaign,plan.id)]);
    assert.deepEqual(applied.map(v=>v.added),[1,1]);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM campaign_contacts WHERE campaign_id=$1",[campaign])).rows[0].n,2);
    assert.deepEqual((await pool.query("SELECT to_jsonb(c) AS row FROM campaign_contacts c WHERE id=$1",[oldContact])).rows[0].row,before);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM campaign_contact_history WHERE campaign_contact_id=$1",[oldContact])).rows[0].n,1);
    assert.deepEqual(await undoLoad(pool,actor,campaign,plan.id,false),{removable:1,protected:0,missing:0});
    const added=(await pool.query("SELECT id FROM campaign_contacts WHERE campaign_id=$1 AND clinic_id=$2",[campaign,first])).rows[0].id;
    // A history-only write must protect the enrollment even if updated_at is unchanged.
    await pool.query("INSERT INTO campaign_contact_history(campaign_contact_id,user_id,action) VALUES($1,$2,'note_added')",[added,actor]);
    assert.deepEqual(await undoLoad(pool,actor,campaign,plan.id,true),{removed:0,protected:1,missing:0,status:"undone"});
    assert.equal((await undoLoad(pool,actor,campaign,plan.id,true)).protected,1);
    const stale=await preview([second]), concurrent=await preview([second]);
    await applyLoad(pool,actor,campaign,concurrent.id);
    await assert.rejects(applyLoad(pool,actor,campaign,stale.id),/stale_preview/);
    const undo=await undoLoad(pool,actor,campaign,concurrent.id,true);
    assert.equal(undo.removed,1);
    for (const kind of contactKinds) {
      const name=`Safety-${kind}-${actor}`;
      const csv=kind==="customer" || kind==="collaborator"
        ? `first_name,last_name,email,country\n${name},Test,${kind}-${actor}@example.test,SK`
        : `name,email,country\n${name},${kind}-${actor}@example.test,SK`;
      const filePlan=await previewLoad(pool,actor,campaign,"file",{},selected,country=>
        fileCandidates({originalname:"fixture.csv",buffer:Buffer.from(csv)},kind,country));
      assert.equal(filePlan.counts.new,1);
      await applyLoad(pool,actor,campaign,filePlan.id);
      const saved=(await pool.query("SELECT snapshots FROM mission_contact_loads WHERE id=$1",[filePlan.id])).rows[0].snapshots[0];
      imported.push({table:entityTables[kind],id:saved[entityColumns[kind]]});
      assert.equal((await undoLoad(pool,actor,campaign,filePlan.id,true)).removed,1);
      // Undo membership is not deletion of the shared CRM profile.
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${entityTables[kind]} WHERE id=$1`,[saved[entityColumns[kind]]])).rows[0].n,1);
    }
    const failed=await previewLoad(pool,actor,campaign,"file",{},selected,()=>[
      {type:"clinic",name:"new transaction fixture",country:"SK",row:1,data:{name:"new transaction fixture",country_code:"SK"}},
      {type:"clinic",name:"invalid DB fixture",country:"SK",row:2,data:{name:"invalid DB fixture",country_code:"SK",unknown_column:"reject"}},
    ]);
    await assert.rejects(applyLoad(pool,actor,campaign,failed.id));
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM clinics WHERE name='new transaction fixture'")).rows[0].n,0);
    assert.equal((await pool.query("SELECT status FROM mission_contact_loads WHERE id=$1",[failed.id])).rows[0].status,"preview");
    const expired=await preview([second]);
    await pool.query("UPDATE mission_contact_loads SET expires_at=now()-interval '1 minute' WHERE id=$1",[expired.id]);
    await assert.rejects(applyLoad(pool,actor,campaign,expired.id),/preview_expired/);
    const changed=await preview([second]);
    await pool.query("UPDATE clinics SET name='Changed after preview' WHERE id=$1",[second]);
    await assert.rejects(applyLoad(pool,actor,campaign,changed.id),/stale_preview/);
    await pool.query("UPDATE users SET role='manager',assigned_countries=ARRAY['CZ'] WHERE id=$1",[actor]);
    await assert.rejects(preview([old]),/forbidden/);
    await pool.query("UPDATE users SET role='user' WHERE id=$1",[actor]);
    await assert.rejects(preview([old]),/forbidden/);
    await assert.rejects(undoLoad(pool,actor,campaign,plan.id,true),/forbidden/);
  } finally {
    await pool.query("DELETE FROM campaign_contact_history WHERE user_id=$1",[actor]);
    await pool.query("DELETE FROM entity_campaign_timeline WHERE campaign_id=$1",[campaign]);
    await pool.query("DELETE FROM activity_logs WHERE user_id=$1",[actor]);
    await pool.query("DELETE FROM mission_contact_loads WHERE campaign_id=$1",[campaign]);
    await pool.query("DELETE FROM campaign_contacts WHERE campaign_id=$1",[campaign]);
    await pool.query("DELETE FROM campaigns WHERE id=$1",[campaign]);
    await pool.query("DELETE FROM clinics WHERE id=ANY($1::varchar[])",[[old,first,second]]);
    for (const row of imported) await pool.query(`DELETE FROM ${row.table} WHERE id=$1`,[row.id]);
    await pool.query("DELETE FROM users WHERE id=$1",[actor]);
    await pool.end();
  }
});
