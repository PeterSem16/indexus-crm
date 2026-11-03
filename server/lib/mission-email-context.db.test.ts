import { test } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../db";
import { resolveMissionEmailContext } from "./mission-email-context";

test("PostgreSQL verifies actual entity country, Mission access and exact typed membership", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Session-local tables shadow public tables; no application records change.
    await client.query(`
      CREATE TEMP TABLE users(id text,role text,role_id text,is_active boolean,assigned_countries text[]) ON COMMIT DROP;
      CREATE TEMP TABLE campaigns(id text,name text,country_codes text[],settings jsonb) ON COMMIT DROP;
      CREATE TEMP TABLE campaign_agents(campaign_id text,user_id text) ON COMMIT DROP;
      CREATE TEMP TABLE role_module_permissions(role_id text,module_key text,access text,can_edit boolean) ON COMMIT DROP;
      CREATE TEMP TABLE clinics(id text,country_code text) ON COMMIT DROP;
      CREATE TEMP TABLE hospitals(id text,country_code text) ON COMMIT DROP;
      CREATE TEMP TABLE collaborators(id text,country_code text) ON COMMIT DROP;
      CREATE TEMP TABLE customers(id text,country text) ON COMMIT DROP;
      CREATE TEMP TABLE campaign_contacts(id text,campaign_id text,contact_type text,
        clinic_id text,hospital_id text,collaborator_id text,customer_id text) ON COMMIT DROP;
      INSERT INTO users VALUES ('agent','user',NULL,true,ARRAY['SK']),('admin','admin',NULL,true,ARRAY[]::text[]);
      INSERT INTO campaigns VALUES ('mission','Mission',ARRAY['SK','CZ'],'{}'),('foreign','Other',ARRAY['SK'],'{}');
      INSERT INTO campaign_agents VALUES ('mission','agent');
      INSERT INTO clinics VALUES ('entity','SK'),('cz','CZ'),('it','IT');
      INSERT INTO hospitals VALUES ('entity','SK');
      INSERT INTO collaborators VALUES ('entity','SK');
      INSERT INTO customers VALUES ('entity','SK');
      INSERT INTO campaign_contacts VALUES
        ('clinic-member','mission','clinic','entity',NULL,NULL,NULL),
        ('cz-member','mission','clinic','cz',NULL,NULL,NULL),
        ('it-member','mission','clinic','it',NULL,NULL,NULL),
        ('hospital-member','mission','hospital',NULL,'entity',NULL,NULL),
        ('collaborator-member','mission','collaborator',NULL,NULL,'entity',NULL),
        ('customer-member','mission','customer',NULL,NULL,NULL,'entity'),
        ('foreign-member','foreign','clinic','entity',NULL,NULL,NULL);`);
    const db = { query: client.query.bind(client), connect: async () => client } as any;
    const body = { campaignId: "mission", entityId: "entity", entityType: "clinic" };
    for (const type of ["clinic", "hospital", "customer", "collaborator", "person"]) {
      const canonical = type === "person" ? "collaborator" : type;
      const context = await resolveMissionEmailContext(db, "agent", { ...body, entityType: type });
      assert.equal(context.campaignContactId, `${canonical}-member`);
      assert.equal(context.entityType, canonical);
      assert.equal(context.countryCode, "SK");
    }
    for (const patch of [
      { campaignId: "foreign" }, { entityId: "cz" }, { entityId: "it" },
      { entityId: "missing" }, { campaignCountryCode: "CZ" },
    ]) await assert.rejects(resolveMissionEmailContext(db, "agent", { ...body, ...patch }));
    // Admin can cross user-country boundaries, never the Mission's country boundary.
    assert.equal((await resolveMissionEmailContext(db, "admin", { ...body, entityId: "cz" })).countryCode, "CZ");
    await assert.rejects(resolveMissionEmailContext(db, "admin", { ...body, entityId: "it" }));
    await client.query("DELETE FROM campaign_contacts WHERE id='clinic-member'");
    await assert.rejects(resolveMissionEmailContext(db, "agent", body));
    const standalone = await resolveMissionEmailContext(db, "agent", { ...body, campaignId: null });
    assert.equal(standalone.campaignId, null, "no fallback to foreign Mission or a current roster");
    await client.query("UPDATE users SET is_active=false WHERE id='agent'");
    await assert.rejects(resolveMissionEmailContext(db, "agent", { ...body, entityType: "hospital" }));
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
