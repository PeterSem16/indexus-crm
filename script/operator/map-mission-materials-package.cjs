#!/usr/bin/env node
// Approved, narrowly scoped configuration change. Never changes status answers.
const assert = require("node:assert/strict");
const MISSION = "a65e7775-885c-4413-b2be-e63c92decd3d";
const NAME = "Medical Partner Cooperation";
const CODE = "MPN-13d";
const PATH = ["missionFunnel", "materials", "packageSent"];
const fail = reason => { throw Error(reason); };
const parse = value => typeof value === "string" ? JSON.parse(value) : value;
const object = value => !!value && typeof value === "object" && !Array.isArray(value);

async function mapPackage(client, apply = false) {
  await client.query(apply ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout='20s'");
    await client.query("SET LOCAL lock_timeout='5s'");
    const mission = (await client.query(
      `SELECT name,settings FROM campaigns WHERE id::text=$1${apply ? " FOR UPDATE" : ""}`, [MISSION])).rows[0];
    if (mission?.name !== NAME) fail("MISSION_IDENTITY_CHANGED");
    const settings = parse(mission.settings);
    const config = settings?.missionFunnel;
    if (!object(settings) || !object(config) || config.version !== 1 ||
        !object(config.sources) || !object(config.materials) || !object(config.materials.excluded))
      fail("SAVED_MAPPING_SHAPE_CHANGED");
    const items = (await client.query(
      `SELECT id,item_type FROM campaign_status_list_items
       WHERE campaign_id::text=$1 AND step_id=$2${apply ? " FOR SHARE" : ""}`, [MISSION, CODE])).rows;
    if (items.length !== 1 || !["option", "step"].includes(items[0].item_type))
      fail("PACKAGE_SOURCE_MISSING_OR_AMBIGUOUS");
    const id = items[0].id;
    if (!Array.isArray(config.sources.materials17) || !config.sources.materials17.includes(id))
      fail("REVIEWED_LEGACY_MAPPING_CHANGED");
    const old = config.materials.packageSent;
    if (!Array.isArray(old) || !(old.length === 0 || old.length === 1 && old[0] === id))
      fail("PACKAGE_MAPPING_CHANGED");
    const needed = old.length === 0;
    if (apply && needed) {
      const updated = (await client.query(
        `UPDATE campaigns
         SET settings=jsonb_set(settings::jsonb,$2::text[],to_jsonb($3::text[]),false)::text
         WHERE id::text=$1 RETURNING settings`,
        [MISSION, PATH, [id]])).rows;
      if (updated.length !== 1) fail("UPDATE_SCOPE_CHANGED");
      assert.deepEqual(parse(updated[0].settings)?.missionFunnel?.materials?.packageSent, [id]);
      // Compare all remaining JSON in PostgreSQL, preserving numeric precision
      // and detecting any unexpected trigger-side changes before COMMIT.
      const unchanged = (await client.query(
        `SELECT ($1::jsonb #- $3::text[]) = ($2::jsonb #- $3::text[]) AS unchanged`,
        [mission.settings, updated[0].settings, PATH])).rows[0]?.unchanged;
      if (unchanged !== true) fail("OTHER_SETTINGS_CHANGED");
    }
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    return {
      mission: NAME,
      rezim: apply ? "Zápis schváleného mapovania" : "Iba kontrola, bez zápisu",
      pred: old.length ? [CODE] : [],
      ciel: [CODE],
      zmenaPotrebna: needed,
      zmenaVykonana: apply && needed,
      ostatneNastaveniaZachovane: true,
      odpovedeADatumyNezmenene: true,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
async function main(args) {
  if (args.length !== 1 || !["--check", "--apply"].includes(args[0])) fail("USE_CHECK_OR_APPLY");
  const fs = require("node:fs");
  const app = "/var/www/indexus-crm";
  const req = require("node:module").createRequire(app + "/package.json");
  const env = req("dotenv").parse(fs.readFileSync(app + "/.env"));
  if (!env.DATABASE_URL) fail("APPLICATION_DATABASE_CONFIGURATION_MISSING");
  const client = new (req("pg").Client)({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    console.log(JSON.stringify(await mapPackage(client, args[0] === "--apply"), null, 2));
    console.log(args[0] === "--apply" ? `MAPOVANIE_OK=${CODE}` : `MAPOVANIE_KONTROLA_OK=${CODE}`);
  } finally { await client.end(); }
}
if (require.main === module || !module.parent) {
  main(process.argv.slice(2)).catch(error => {
    const known = /^(MISSION_IDENTITY_CHANGED|SAVED_MAPPING_SHAPE_CHANGED|PACKAGE_SOURCE_MISSING_OR_AMBIGUOUS|REVIEWED_LEGACY_MAPPING_CHANGED|PACKAGE_MAPPING_CHANGED|UPDATE_SCOPE_CHANGED|OTHER_SETTINGS_CHANGED|USE_CHECK_OR_APPLY|APPLICATION_DATABASE_CONFIGURATION_MISSING)$/;
    const safe = known.test(error.message || "") ? error.message :
      /^[0-9A-Z]{5}$/.test(error.code || "") ? `SQLSTATE_${error.code}` : "OPERATION_FAILED";
    console.error(`STOP: ${safe}; zmena nebola potvrdena alebo vysledok treba overit.`);
    process.exitCode = 1;
  });
}
module.exports = { MISSION, NAME, CODE, PATH, mapPackage };
