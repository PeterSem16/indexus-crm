import {test,after} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {pool} from "../db";
const {reviewProposalBatch,MISSION,SUBJECT}=createRequire(import.meta.url)("../../script/operator/review-mission-proposal-emails.cjs");
after(async()=>{await pool.end()});
async function fixture(run:(client:any)=>Promise<void>){
  const c=await pool.connect();
  try{
    await c.query(`CREATE TEMP TABLE campaigns(id text PRIMARY KEY,name text,country_codes text[]);
      CREATE TEMP TABLE clinics(id text PRIMARY KEY,country_code text);
      CREATE TEMP TABLE campaign_contacts(id text PRIMARY KEY,clinic_id text,campaign_id text,contact_type text);
      CREATE TEMP TABLE communication_messages(id text PRIMARY KEY,customer_id text,user_id text,
        subject text,status text,campaign_id text,provider text,external_id text,metadata text,
        type text,direction text,sent_at timestamp,created_at timestamp);
      CREATE TEMP TABLE campaign_contact_history(id text PRIMARY KEY,campaign_contact_id text,
        user_id text,action text,metadata jsonb);`);
    await c.query("INSERT INTO campaigns VALUES($1,'Medical Partner Cooperation',ARRAY['SK'])",[MISSION]);
    await c.query(`INSERT INTO clinics SELECT 'clinic-'||i,'SK' FROM generate_series(0,33) i;
      INSERT INTO campaign_contacts SELECT 'contact-'||i,'clinic-'||i,
        '${MISSION}','clinic' FROM generate_series(0,33) i;`);
    await c.query(`INSERT INTO communication_messages
      SELECT 'message-'||lpad(i::text,2,'0'),'clinic-'||(i%34),'sender',$1,'sent',NULL,NULL,NULL,
        '{"contactType":"clinic","sentVia":"ms365"}','email','outbound',NULL,
        '2026-09-23 10:05:03.998123'::timestamp FROM generate_series(0,37) i`,[SUBJECT]);
    await run(c);
  }finally{c.release(true)}
}
test("real PostgreSQL dry run, atomic apply, precise record times and idempotent retry",async()=>{
  await fixture(async c=>{
    const preview=await reviewProposalBatch(c);
    assert.equal(preview.status,"ready");
    const result=await reviewProposalBatch(c,{apply:true,expectedFingerprint:preview.fingerprint});
    assert.equal(result.updates,38);
    const {rows}=await c.query(`SELECT count(*)::int AS records,
      count(*) FILTER(WHERE campaign_id=$1)::int AS bound,
      count(*) FILTER(WHERE sent_at IS NOT NULL)::int AS invented
      FROM communication_messages`,[MISSION]);
    assert.deepEqual(rows[0],{records:38,bound:38,invented:0});
    const audit=await c.query("SELECT metadata FROM campaign_contact_history LIMIT 1");
    assert.equal(audit.rows[0].metadata.originalRecordedAt,"2026-09-23T10:05:03.998123Z");
    assert.equal(audit.rows[0].metadata.originalSentAt,null);
    assert.equal((await reviewProposalBatch(c,{apply:true,expectedFingerprint:preview.fingerprint})).status,"already_applied");
    assert.equal((await c.query("SELECT count(*)::int AS n FROM campaign_contact_history")).rows[0].n,38);
  });
});
test("a real PostgreSQL transaction rolls every row back if an audit fails mid-batch",async()=>{
  await fixture(async c=>{
    const preview=await reviewProposalBatch(c);
    let writes=0;
    const failing={query:async(sql:string,params:any[])=>{
      if(sql.startsWith("INSERT")&&++writes===3)throw Error("simulated audit failure");
      return c.query(sql,params);
    }};
    await assert.rejects(reviewProposalBatch(failing,{apply:true,expectedFingerprint:preview.fingerprint}),/audit failure/);
    assert.equal((await c.query("SELECT count(*)::int AS n FROM campaign_contact_history")).rows[0].n,0);
    assert.equal((await c.query("SELECT count(*)::int AS n FROM communication_messages WHERE campaign_id IS NOT NULL")).rows[0].n,0);
  });
});
