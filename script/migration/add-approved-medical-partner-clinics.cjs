// One-off reviewed additive import. Default is read-only; --apply enables writes.
// No contact generation endpoint: that endpoint deletes existing contacts.
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const missionId = "a65e7775-885c-4413-b2be-e63c92decd3d";
const approved = [
  ["f8da23f4-1dc7-42be-ba88-6bfa610328e1", "Gynekologická ambulancia"],
  ["86e240f1-cf0c-4c1e-b74d-3fdeaaf3f60f", "Gynekologicko-pôrodnícka ambulancia Akupunktúra s.r.o."],
  ["4fe10d0d-35e4-45c2-96b1-8748ea9df367", "Gynekologická ambulancia, MUDr. Jana Kolejáková, (gynfet, s. r. o.)"],
  ["732b33e7-8490-43a8-9ba2-6eb9da7710fd", "Health Medical Centre"],
  ["d9965907-e7a3-4928-8b42-65a551ab3c56", "MUDr. Ľubomír Barák CSc."],
  ["69a0e52c-e1d3-4797-b285-ca0c16d44938", "MUDr. Ľubomír Cajchan"],
  ["97ca4535-6c2f-4c15-aa5d-f84cf84a8bb7", "MUDr. Zdenka Betáková"],
  ["fa102577-f915-4b67-9303-9334ccd712fe", "Gynekológia"],
  ["1b8a04cd-c343-4afc-a6b1-de58c2577a67", "GYNOD s.r.o."],
  ["23b82cd0-0dcd-46b4-831a-21b1081c8d34", "MUDr. Ľubica Benková"],
  ["9d5407e0-a731-4603-b483-44728c7de272", "Sanatórium Helios"],
  ["11aacd59-e6ce-4638-866f-98029c2a324e", "M-CENTRUM, s.r.o., gynekologická ambulancia"],
  ["7f194e16-93d2-4753-8926-29c339f53ef6", "Sonoclinic s.r.o., Prof. MUDr Dankovčík, PhD, MPH"],
];

function validPhone(value) {
  let v = String(value || "").replace(/\D/g, "");
  if (v.startsWith("00421")) v = v.slice(5);
  else if (v.startsWith("421") && v.length === 12) v = v.slice(3);
  else if (v.startsWith("0") && v.length === 10) v = v.slice(1);
  return /^[2-9]\d{8}$/.test(v) && new Set(v).size > 2;
}

async function applyReviewed(db, apply) {
  await db.query(apply ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await db.query("SET LOCAL lock_timeout = '5s'");
    await db.query("SET LOCAL statement_timeout = '30s'");
    if (apply) {
      // No unique (campaign_id, clinic_id) index exists: table lock also guards
      // against concurrent inserts performed by callers not using our lock key.
      await db.query(`LOCK TABLE campaigns, clinics, collaborators, contact_assignments,
        dedupe_entity_aliases, campaign_contacts, campaign_phases, campaign_contact_phases
        IN SHARE ROW EXCLUSIVE MODE`);
    }
    const mission = (await db.query(
      "SELECT id, name, country_codes, status FROM campaigns WHERE id=$1", [missionId]
    )).rows[0];
    if (!mission || mission.name !== "Medical Partner Cooperation" ||
        !["active", "paused", "draft"].includes(mission.status) ||
        (mission.country_codes?.length && !mission.country_codes.includes("SK")))
      throw new Error("Mission nezodpovedá schválenému cieľu");
    const activePhases = (await db.query(
      "SELECT id FROM campaign_phases WHERE campaign_id=$1 AND status='active'", [missionId]
    )).rows;
    if (activePhases.length) throw new Error("Mission používa aktívne fázy; najprv treba určiť cieľovú fázu. Bez zápisu.");

    // Canonical person aliases are resolved recursively, both for explicit and
    // legacy workplace memberships. Explicit inactive assignments win.
    const people = (await db.query(`
      WITH RECURSIVE ids AS (
        SELECT DISTINCT id AS original_id, id AS canonical_id, ARRAY[id::text] AS path
        FROM collaborators
        UNION ALL
        SELECT p.original_id, a.canonical_id, p.path || a.canonical_id::text
        FROM ids p JOIN dedupe_entity_aliases a
          ON a.entity_kind='person' AND a.loser_id=p.canonical_id
        WHERE NOT a.canonical_id::text=ANY(p.path)
      ), canonical AS (
        SELECT DISTINCT original_id, canonical_id FROM ids p
        WHERE NOT EXISTS (SELECT 1 FROM dedupe_entity_aliases a
          WHERE a.entity_kind='person' AND a.loser_id=p.canonical_id)
      ), explicit_links AS (
        SELECT a.entity_id AS clinic_id, p.canonical_id AS person_id,
          bool_or(a.is_active) AS active
        FROM contact_assignments a JOIN canonical p ON p.original_id=a.person_id
        WHERE a.entity_type='clinic' AND a.entity_id=ANY($1::text[])
        GROUP BY a.entity_id, p.canonical_id
      ), legacy_links AS (
        SELECT DISTINCT c.id AS clinic_id, p.canonical_id AS person_id
        FROM collaborators old JOIN canonical p ON p.original_id=old.id
        JOIN clinics c ON c.id=old.clinic_id OR c.id=ANY(old.clinic_ids)
        WHERE c.id=ANY($1::text[])
      ), accepted AS (
        SELECT clinic_id, person_id FROM explicit_links WHERE active
        UNION
        SELECT l.clinic_id, l.person_id FROM legacy_links l
        WHERE NOT EXISTS (SELECT 1 FROM explicit_links e
          WHERE e.clinic_id=l.clinic_id AND e.person_id=l.person_id)
      )
      SELECT DISTINCT a.clinic_id FROM accepted a
      JOIN collaborators p ON p.id=a.person_id AND p.is_active
    `, [approved.map(([id]) => id)])).rows;
    const withPeople = new Set(people.map(p => p.clinic_id));
    const result = [];
    for (const [id, name] of approved) {
      const c = (await db.query(`SELECT id, name, country_code, is_active,
        pzs_code, phone, phone2, phone3 FROM clinics WHERE id=$1`, [id])).rows[0];
      if (!c || c.name !== name || !c.is_active || c.country_code !== "SK" ||
          String(c.pzs_code || "").trim() || !withPeople.has(id) ||
          ![c.phone, c.phone2, c.phone3].some(validPhone))
        throw new Error("Zmenili sa podmienky ambulancie: " + name);
      const redirected = await db.query(`SELECT 1 FROM dedupe_entity_aliases
        WHERE entity_kind='clinic' AND loser_id=$1 LIMIT 1`, [id]);
      if (redirected.rowCount) throw new Error("Ambulancia je presmerovaná: " + name);
      const existing = await db.query(`SELECT id, contact_type FROM campaign_contacts
        WHERE campaign_id=$1 AND clinic_id=$2`, [missionId, id]);
      if (existing.rowCount > 1 || existing.rows.some(r => r.contact_type !== "clinic"))
        throw new Error("Nejednoznačné existujúce členstvo: " + name);
      if (existing.rowCount === 1) {
        result.push({ ambulancia: name, vysledok: "Už je v Mission — bez zmeny" });
        continue;
      }
      if (apply) {
        const contactId = randomUUID();
        await db.query(`INSERT INTO campaign_contacts
          (id,campaign_id,clinic_id,contact_type,status,attempt_count,priority_score)
          VALUES ($1,$2,$3,'clinic','pending',0,50)`, [contactId, missionId, id]);
        await db.query(`INSERT INTO entity_campaign_timeline
          (id,entity_type,entity_id,entity_name,campaign_id,campaign_name,
           campaign_contact_id,channel,action,status,notes,metadata)
          VALUES ($1,'clinic',$2,$3,$4,$5,$6,'phone','contact_added','pending',$7,$8::jsonb)`,
          [randomUUID(), id, name, missionId, mission.name, contactId,
            "Manuálne schválené doplnenie 13 ambulancií na základe porovnania exportu.",
            JSON.stringify({ source: "reviewed_manual_import", cohort: "approved-13-2026-09-23" })]);
      }
      result.push({ ambulancia: name, vysledok: apply ? "Pridaná" : "Navrhnutá na pridanie" });
    }
    if (apply) {
      const verified = (await db.query(`SELECT clinic_id, count(*)::int AS count
        FROM campaign_contacts WHERE campaign_id=$1 AND clinic_id=ANY($2::text[])
        GROUP BY clinic_id`, [missionId, approved.map(([id]) => id)])).rows;
      if (verified.length !== 13 || verified.some(r => r.count !== 1))
        throw new Error("Záverečné overenie členstva zlyhalo");
    }
    const total = (await db.query("SELECT count(*)::int AS total FROM campaign_contacts WHERE campaign_id=$1", [missionId])).rows[0].total;
    await db.query(apply ? "COMMIT" : "ROLLBACK");
    return { result, total, applied: apply };
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function main() {
  const line = fs.readFileSync(".env", "utf8").split(/\r?\n/).find(v => v.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL chýba");
  let url = line.slice(13).trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) url = url.slice(1, -1);
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    const outcome = await applyReviewed(db, process.argv.includes("--apply"));
    console.table(outcome.result);
    console.log(outcome.applied ? "COMMIT — overených 13 členstiev." : "READ ONLY — bez zápisu.");
    console.log("Celkový počet kontaktov Mission:", outcome.total);
  } finally {
    await db.end();
  }
}
if (require.main === module) main().catch(e => {
  // PostgreSQL details can include sensitive values; print only code.
  console.error("Zápis nepotvrdený:", e.code || (e.message.startsWith("connect") ? "pripojenie" : e.message));
  process.exitCode = 1;
});
module.exports = { applyReviewed, approved, validPhone };