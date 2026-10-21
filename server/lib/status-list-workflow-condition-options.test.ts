import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pool } from "../db";
import { readWorkflowConditionOptions, workflowConditionOptionsQuery } from "./status-list-workflow-condition-options";

async function run() {
  for (const field of ["status", "contact_type", "clinic_id; DROP TABLE clinics", "", ["clinic_id"]]) {
    assert.equal(workflowConditionOptionsQuery.safeParse({ field }).success, false);
  }
  assert.equal(workflowConditionOptionsQuery.safeParse({ field: "clinic_id", q: "x".repeat(101) }).success, false);
  const routeSource = readFileSync("server/lib/status-list-workflow-routes.ts", "utf8");
  assert.match(routeSource, /app\.get\(`\$\{root\}\/condition-options`, requireAuth, route\(async \(req, res\) => \{\s*await authorize\(req, true\);\s*res\.json\(await readWorkflowConditionOptions/);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TEMP TABLE campaign_contacts(campaign_id text, contact_type text, customer_id text, clinic_id text, hospital_id text) ON COMMIT DROP;
      CREATE TEMP TABLE customers(id text, clinic_id text, hospital_name text) ON COMMIT DROP;
      CREATE TEMP TABLE clinics(id text, name text) ON COMMIT DROP;
      CREATE TEMP TABLE hospitals(id text, name text) ON COMMIT DROP;
      INSERT INTO clinics VALUES ('cl1','Clinic Alpha'),('cl2','Clinic Beta'),('cl3','Private other Mission'),('literal','100%_Clinic');
      INSERT INTO hospitals VALUES ('h1','Hospital Alpha'),('h2','Other Mission Hospital');
      INSERT INTO customers VALUES ('cu1','cl2','Legacy customer hospital'),('cu2',NULL,'');
      INSERT INTO campaign_contacts VALUES
        ('mission','clinic',NULL,'cl1','h1'),('mission','clinic',NULL,'cl1','h1'),
        ('mission','customer','cu1','wrong-clinic','wrong-hospital'),('mission','customer','cu2',NULL,NULL),
        ('other','clinic',NULL,'cl3','h2'),('mission','clinic',NULL,'literal',NULL);
    `);
    const clinics = await readWorkflowConditionOptions(client, "mission", { field: "clinic_id" });
    assert.deepEqual(clinics.options.map(o => o.value).sort(), ["cl1", "cl2", "literal"]);
    assert.equal(clinics.options.find(o => o.value === "cl2")?.label, "Clinic Beta");
    assert.equal(clinics.truncated, false);
    const hospitals = await readWorkflowConditionOptions(client, "mission", { field: "hospital_id" });
    assert.deepEqual(hospitals.options.map(o => o.value).sort(), ["Legacy customer hospital", "h1"]);
    assert.equal(hospitals.options.find(o => o.value === "h1")?.label, "Hospital Alpha");
    const search = await readWorkflowConditionOptions(client, "mission", { field: "clinic_id", q: "Beta" });
    assert.deepEqual(search.options, [{ value: "cl2", label: "Clinic Beta" }]);
    const withSaved = await readWorkflowConditionOptions(client, "mission", { field: "clinic_id", q: "Beta", value: "cl1" });
    assert.equal(withSaved.options[0].value, "cl1");
    const literal = await readWorkflowConditionOptions(client, "mission", { field: "clinic_id", q: "%_" });
    assert.deepEqual(literal.options, [{ value: "literal", label: "100%_Clinic" }]);
    assert.deepEqual((await readWorkflowConditionOptions(client, "mission", { field: "clinic_id", value: "cl3", q: "Private" })).options, []);
    assert.deepEqual((await readWorkflowConditionOptions(client, "missing", { field: "hospital_id" })).options, []);
    await client.query(`INSERT INTO clinics SELECT 'bulk'||n,'Bulk '||n FROM generate_series(1,60)n;
      INSERT INTO campaign_contacts SELECT 'mission','clinic',NULL,'bulk'||n,NULL FROM generate_series(1,60)n`);
    const limited = await readWorkflowConditionOptions(client, "mission", { field: "clinic_id", value: "bulk59" });
    assert.equal(limited.options.length, 50);
    assert.equal(limited.truncated, true);
    assert.equal(limited.options[0].value, "bulk59");
    console.log("Workflow condition choices: validation, authorization boundary, SQL/runtime parity, Mission isolation, names, legacy values, literal search and limits passed");
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
