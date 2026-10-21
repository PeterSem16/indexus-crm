import assert from "node:assert/strict";
import { pool } from "../db";
import { resolveAutomationEmailCardRecipients as expand } from "./automation-email-card-recipients";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(`
    CREATE TEMP TABLE clinics(id varchar,email text,country_code text);
    CREATE TEMP TABLE hospitals(id varchar,email text,country_code text);
    CREATE TEMP TABLE collaborators(id varchar,email text,is_active boolean);
    CREATE TEMP TABLE contact_assignments(person_id varchar,entity_type text,entity_id varchar,
      is_active boolean,start_date timestamptz,end_date timestamptz);
    INSERT INTO clinics VALUES('clinic','main@example.test','SK'),('other','other@example.test','CZ');
    INSERT INTO hospitals VALUES('hospital','hospital@example.test','SK');
    INSERT INTO collaborators VALUES
      ('doctor','doctor@example.test',true),('nurse','nurse@example.test',true),
      ('shared','MAIN@example.test',true),('inactive','inactive@example.test',false),
      ('unassigned','unassigned@example.test',true),('ended','ended@example.test',true),
      ('future','future@example.test',true),('empty',' ',true),('foreign','foreign@example.test',true);
    INSERT INTO contact_assignments VALUES
      ('doctor','clinic','clinic',true,null,null),('doctor','clinic','clinic',true,null,null),
      ('shared','clinic','clinic',true,null,null),('inactive','clinic','clinic',true,null,null),
      ('unassigned','clinic','clinic',false,null,null),('ended','clinic','clinic',true,null,now()-interval '1 day'),
      ('future','clinic','clinic',true,now()+interval '1 day',null),('empty','clinic','clinic',true,null,null),
      ('foreign','clinic','other',true,null,null),('nurse','hospital','hospital',true,null,null);
  `);
  const query = (text: string, values: any[]) => client.query(text, values);
  const ctx = (entityType: string, entityId: string) => ({ event: { entityType, entityId, countryCode: "SK" } });
  assert.equal((await expand({ toCardSources: ["main", "persons"] }, ctx("clinic", "clinic"), query)).to,
    "main@example.test, doctor@example.test");
  assert.equal((await expand({ toCardSources: ["persons"] }, ctx("hospital", "hospital"), query)).to, "nurse@example.test");
  assert.equal((await expand({ toCardSources: ["main"] }, ctx("hospital", "hospital"), query)).to, "hospital@example.test");
  await assert.rejects(() => expand({ toCardSources: ["persons"] }, ctx("clinic", "other"), query), /country/);
  await client.query("UPDATE collaborators SET email='updated@example.test' WHERE id='doctor'");
  const updated = await expand({ toCardSources: ["persons"] }, ctx("clinic", "clinic"), query);
  assert.ok(updated.to.includes("updated@example.test"));
  assert.ok(!updated.to.includes("doctor@example.test"));
  console.log("Card recipient PostgreSQL joins: clinic/hospital scope, active temporal assignments, deduplication, country and execution-time freshness passed.");
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}
