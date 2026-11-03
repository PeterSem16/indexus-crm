import { test, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../db";
import { missionClinicReferralSql } from "./mission-funnel-referral";
import { computeMissionFunnel, type FunnelInput } from "./mission-funnel";
import { emptyFunnelConfig } from "../../shared/mission-funnel";

after(async () => { await pool.end(); });
test("real PostgreSQL referral union preserves clinic units, both person links and authorized Mission scope", async () => {
  const clinics = ["direct","primary","array","both","none","foreign-country","other-mission","not-enrolled"]
    .map(id => ({ id, name:id, country_code:id==="foreign-country"?"HU":"SK", is_referred_by_doctor:id==="direct" }));
  const persons = [
    { clinic_id:"primary",clinic_ids:[],is_referred_by_doctor:true,is_active:false },
    { clinic_id:null,clinic_ids:["array"],is_referred_by_doctor:true },
    { clinic_id:"both",clinic_ids:["both"],is_referred_by_doctor:true },
    { clinic_id:"both",clinic_ids:["both"],is_referred_by_doctor:true },
    { clinic_id:"none",clinic_ids:["none"],is_referred_by_doctor:false },
    { clinic_id:null,clinic_ids:null,is_referred_by_doctor:true },
    ...["foreign-country","other-mission","not-enrolled"].map(clinic_id =>
      ({clinic_id,clinic_ids:[],is_referred_by_doctor:true})),
  ];
  const contacts = clinics.filter(c=>c.id!=="not-enrolled")
    .map(c=>({clinic_id:c.id,campaign_id:c.id==="other-mission"?"other":"mission",contact_type:"clinic"}));
  contacts.push({clinic_id:"both",campaign_id:"mission",contact_type:"clinic"});
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout='5s'");
    // CTE fixtures only: no real rows, temporary tables, migrations or writes.
    const query = await client.query(`
      WITH clinics AS (SELECT * FROM jsonb_to_recordset($4::jsonb)
        AS r(id text,name text,country_code text,is_referred_by_doctor boolean)),
      collaborators AS (SELECT * FROM jsonb_to_recordset($5::jsonb)
        AS r(clinic_id text,clinic_ids text[],is_referred_by_doctor boolean,is_active boolean)),
      campaign_contacts AS (SELECT * FROM jsonb_to_recordset($6::jsonb)
        AS r(clinic_id text,campaign_id text,contact_type text))
      SELECT DISTINCT c.id,c.name,NULL::text AS "representativeId",${missionClinicReferralSql} AS referred
      FROM clinics c JOIN campaign_contacts cc ON cc.clinic_id=c.id
      WHERE cc.campaign_id=$1 AND cc.contact_type='clinic' AND ($2::boolean OR c.country_code=ANY($3::text[]))
      ORDER BY c.id`, ["mission",false,["SK"],JSON.stringify(clinics),JSON.stringify(persons),JSON.stringify(contacts)]);
    assert.equal(query.rows.length,5);
    assert.deepEqual(query.rows.filter(r=>r.referred).map(r=>r.id),["array","both","direct","primary"]);
    for (const row of query.rows) assert.deepEqual(Object.keys(row).sort(),["id","name","referred","representativeId"]);
    const at="2026-11-01T10:00:00Z";
    const input: FunnelInput={clinics:query.rows,config:emptyFunnelConfig(),items:[],events:[],states:[],
      enrollments:query.rows.map(c=>({id:"e-"+c.id,clinicId:c.id})),
      calls:query.rows.map(c=>({id:"call-"+c.id,clinicId:c.id,contactId:"e-"+c.id,
        direction:"outbound",status:"completed",at,answeredAt:at,duration:10}))};
    const projection=(referral:"all"|"yes"|"no",from?:string) => computeMissionFunnel(input,{referral,from});
    const count=(referral:"all"|"yes"|"no") => projection(referral).rows.find(r=>r.key==="dialed")!.total;
    assert.deepEqual([count("all"),count("yes"),count("no")],[5,4,1]);
    assert.equal(projection("yes","2026-11-02").rows.find(r=>r.key==="dialed")!.total,0);
    assert.equal(projection("yes").rows.find(r=>r.key==="cooperating")!.members.length,0);
    assert.equal(JSON.stringify(persons).includes("status_list"),false);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
