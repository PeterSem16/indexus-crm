#!/usr/bin/env node
"use strict";

// Reviewed, frozen one-off cleanup. With no apply flag this always uses a
// read-only transaction. The evidence snapshots are deliberately not runtime
// dependencies; the complete email cohort is in the adjacent tracked manifest.
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

const BOGUS_EMAIL = "info@zzz.sk";
const LOGIN_SOURCE = "https://www.zzz.sk/login";
const CLOSURE_SOURCE = "https://www.e-vuc.sk/e-vuc/poskytovatelia/tmm-slovakia.html?page_id=106643";
const DEMKOVA_SOURCE = "https://stitnik.oma.sk/zdravotnictvo/ordinacia";
const MANIFEST_PATH = path.join(__dirname, "reviewed-medical-partner-cleanup.json");

class CleanupError extends Error {}

const verified = [
  {
    id: "e0eccebe-041f-49d5-98b3-0ff883d16f18",
    name: "Gynekologická ambulancia",
    country_code: "SK",
    address: "Andreja Hlinku 28",
    city: "Zlaté Moravce",
    source: "https://www.zzz.sk/zariadenie/2664-gynekologicka-ambulancia-mudr-ladislav-janovsky",
    evidence: "MUDr. Ladislav Janovský; Andreja Hlinku 28, 953 01 Zlaté Moravce; +421905340307",
  },
  {
    id: "2e0498ad-0cc0-44d6-9851-6d794048950c",
    name: "Gynekologická ambulancia",
    country_code: "SK",
    address: "Ochtinská",
    city: "932 Štítnik",
    source: DEMKOVA_SOURCE,
    evidence: "MUDr. Katarína Demková; Ochtinská 29, 049 32 Štítnik",
    demkova: true,
  },
  {
    id: "d314072a-dc48-48cd-b8e5-8bd9494566af",
    name: "Gynekológia",
    country_code: "SK",
    address: "Einsteinova 7",
    city: "Petržalka",
    source: "https://mapalekarov.sk/bratislava/gynekologia; https://www.mojlekar.eu/ambulancia/146/MUDrRoman-Zacok-Gynekologia-volne-terminy-na-objednanie",
    evidence: "MUDr. Dagmar Gavorníková; Einsteinova 7; odlišné pracovisko od MUDr. Romana Žáčoka",
  },
  {
    id: "108a09c5-d52d-47df-b31e-b3ef451edd90",
    name: "Gynekologicko-pôrodnícka ambulancia VEGAFEM s. r. o.",
    country_code: "SK",
    address: "Líščie údolie 57",
    city: "Karlova Ves",
    source: "https://www.zzz.sk/zariadenie/10655-gynekologicko-porodnicka-ambulancia-vegafem-s-r-o-mudr-veronika-gaborikova",
    evidence: "MUDr. Veronika Gáboriková; Líščie údolie 57, 841 04 Karlova Ves; +421260264143",
  },
];

const closure = {
  id: "6e9b3848-06b5-40b8-8550-d4bc68ef661b",
  name: "Gynekologicko-pôrodnícka ambulancia MUDr. Mária Mihálová s.r.o.",
  country_code: "SK",
  address: "Janka Kráľa 15",
  city: "Bojnice",
};

function loadManifest() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  if (manifest.version !== 1 || manifest.bogusEmail !== BOGUS_EMAIL ||
      !Array.isArray(manifest.clinics) || manifest.clinics.length !== 313)
    throw new CleanupError("Neplatný alebo neúplný zmrazený manifest");
  const ids = new Set();
  for (const guard of manifest.clinics) {
    const keys = Object.keys(guard).sort().join(",");
    if (keys !== "address,city,country_code,id,name" || !guard.id || ids.has(guard.id))
      throw new CleanupError("Neplatný alebo duplicitný záznam manifestu");
    ids.add(guard.id);
  }
  return manifest;
}

function same(a, b) {
  return a === b;
}

function assertIdentity(row, guard) {
  if (!row || row.id !== guard.id || !same(row.name, guard.name) ||
      !same(row.country_code, guard.country_code))
    throw new CleanupError(`Zmenená identita ambulancie ${guard.id}`);

  // The sole approved address correction remains an accepted exact identity on
  // later runs, without weakening guards for any other clinic.
  const demkovaAfter = guard.id === verified[1].id &&
    row.address === "Ochtinská 29" && row.city === "Štítnik";
  if (!demkovaAfter &&
      (!same(row.address, guard.address) || !same(row.city, guard.city)))
    throw new CleanupError(`Zmenená adresa alebo mesto ambulancie ${guard.id}`);
}

function appendNote(notes, marker, text) {
  const current = notes == null ? "" : String(notes);
  if (current.includes(marker)) return { value: notes, added: false };
  return {
    value: current ? `${current}\n\n${text}` : text,
    added: true,
  };
}

function isBogusEmail(value) {
  return typeof value === "string" && value.trim().toLowerCase() === BOGUS_EMAIL;
}

/**
 * Pure planner: validates the frozen identity and returns only explicit column
 * updates. It never mutates its inputs.
 */
function planClinic(row, guard, scopes) {
  assertIdentity(row, guard);
  const set = {};
  const stats = { emailValuesRemoved: 0, notesAdded: 0, enrichedFields: 0, deactivated: 0 };
  let notes = row.notes;

  if (scopes.email) {
    const removed = [];
    for (const field of ["email", "email2", "email3"]) {
      if (isBogusEmail(row[field])) {
        set[field] = null;
        removed.push(`${field}=„${row[field]}“`);
      }
    }
    if (removed.length) {
      const marker = "[ZZZ-EMAIL-CLEANUP:v1]";
      const text = `${marker} Odstránená neplatná e-mailová hodnota. Audit — pôvodné polia a hodnoty: ${removed.join(", ")}. Zdroj: ${LOGIN_SOURCE}`;
      const appended = appendNote(notes, marker, text);
      notes = appended.value;
      if (appended.added) stats.notesAdded++;
      stats.emailValuesRemoved += removed.length;
    }
  }

  if (scopes.verified) {
    const item = verified.find(v => v.id === row.id);
    if (item) {
      const marker = `[OVERENIE-VEREJNEHO-ZDROJA:v1:${item.id}]`;
      const text = `${marker} Skontrolované 23.09.2026, stredná miera istoty. Adresárový dôkaz: ${item.evidence}. Nejde o oficiálne potvrdenie aktuálnej prevádzky. Zdroj: ${item.source}`;
      const appended = appendNote(notes, marker, text);
      notes = appended.value;
      if (appended.added) stats.notesAdded++;

      if (item.demkova) {
        const postalBlank = row.postal_code == null || String(row.postal_code).trim() === "";
        const postalFrozenError = row.postal_code === "447 04";
        const postalAlreadyCorrected = row.postal_code === "04932";
        if (!postalBlank && !postalFrozenError && !postalAlreadyCorrected)
          throw new CleanupError(`Zmenené PSČ ambulancie ${row.id}`);
        if (row.address === "Ochtinská" && row.city === "932 Štítnik") {
          set.address = "Ochtinská 29";
          set.city = "Štítnik";
          stats.enrichedFields += 2;
        }
        if (postalBlank || postalFrozenError) {
          set.postal_code = "04932";
          stats.enrichedFields++;
          const marker = "[OPRAVA-PSC:v1:2e0498ad]";
          const original = postalBlank ? "prázdna hodnota" : `„${row.postal_code}“`;
          const text = `${marker} Pole postal_code opravené z ${original} na „04932“ podľa adresy Ochtinská 29, 049 32 Štítnik. Zdroj: ${DEMKOVA_SOURCE}`;
          const appended = appendNote(notes, marker, text);
          notes = appended.value;
          if (appended.added) stats.notesAdded++;
        }
      }
    }

    if (row.id === closure.id) {
      const marker = "[OVERENE-ZRUSENIE:v1:2024-08-31]";
      const text = `${marker} Konkrétne pracovisko ID ZZ63-36684279-A0001 na adrese Janka Kráľa 15, Bojnice bolo oficiálne zrušené k 31.08.2024; nejde o tvrdenie o zrušení právnickej osoby. Zdroj: ${CLOSURE_SOURCE}`;
      const appended = appendNote(notes, marker, text);
      notes = appended.value;
      if (appended.added) stats.notesAdded++;
      if (row.is_active !== false) {
        set.is_active = false;
        stats.deactivated++;
      }
    }
  }

  if (notes !== row.notes) set.notes = notes;
  return { set, stats };
}

function mergeStats(total, add) {
  for (const key of Object.keys(add)) total[key] += add[key];
}

async function executeCleanup(db, options = {}) {
  const scopes = {
    email: options.email !== false,
    verified: options.verified !== false,
  };
  const apply = Boolean(options.apply);
  const manifest = options.manifest || loadManifest();
  const guards = new Map();
  if (scopes.email) for (const guard of manifest.clinics) guards.set(guard.id, guard);
  if (scopes.verified) {
    for (const item of verified) guards.set(item.id, item);
    guards.set(closure.id, closure);
  }
  const ids = [...guards.keys()].sort();
  const totals = { emailValuesRemoved: 0, notesAdded: 0, enrichedFields: 0, deactivated: 0, rowsChanged: 0 };

  await db.query(apply ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await db.query("SET LOCAL lock_timeout = '5s'");
    await db.query("SET LOCAL statement_timeout = '30s'");
    // Prevent a clinic redirect from being inserted between alias validation
    // and clinic updates. This is intentionally acquired before clinic rows.
    if (apply) await db.query("LOCK TABLE dedupe_entity_aliases IN SHARE MODE");
    const selected = await db.query(`SELECT id,name,country_code,address,city,postal_code,
      email,email2,email3,is_active,notes FROM clinics WHERE id=ANY($1::text[])
      ORDER BY id${apply ? " FOR UPDATE" : ""}`, [ids]);
    const rows = new Map(selected.rows.map(row => [row.id, row]));
    if (rows.size !== ids.length) throw new CleanupError("Niektorá zmrazená ambulancia chýba");

    const redirected = await db.query(`SELECT loser_id FROM dedupe_entity_aliases
      WHERE entity_kind='clinic' AND loser_id=ANY($1::text[]) ORDER BY loser_id`, [ids]);
    if (redirected.rowCount) throw new CleanupError(`Ambulancia je presmerovaná: ${redirected.rows[0].loser_id}`);

    for (const id of ids) {
      const row = rows.get(id);
      const guard = guards.get(id);
      const plan = planClinic(row, guard, scopes);
      mergeStats(totals, plan.stats);
      const fields = Object.keys(plan.set);
      if (!fields.length) continue;
      totals.rowsChanged++;
      if (apply) {
        const assignments = fields.map((field, index) => `"${field}"=$${index + 2}`);
        const values = fields.map(field => plan.set[field]);
        const result = await db.query(
          `UPDATE clinics SET ${assignments.join(",")}, updated_at=now() WHERE id=$1`,
          [id, ...values]
        );
        if (result.rowCount !== 1) throw new CleanupError(`Súbežná zmena ambulancie ${id}`);
      }
    }
    await db.query(apply ? "COMMIT" : "ROLLBACK");
    return { ...totals, inspected: ids.length, applied: apply, scopes };
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) throw new CleanupError("DATABASE_URL chýba");
  const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/)
    .find(value => value.startsWith("DATABASE_URL="));
  if (!line) throw new CleanupError("DATABASE_URL chýba");
  let value = line.slice("DATABASE_URL=".length).trim();
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  return value;
}

function parseArgs(argv) {
  const allowed = new Set(["--apply-email-cleanup", "--apply-verified-updates", "--apply-all"]);
  const unknown = argv.filter(arg => !allowed.has(arg));
  if (unknown.length) throw new CleanupError("Neznámy parameter príkazového riadka");
  const all = argv.includes("--apply-all");
  const email = all || argv.includes("--apply-email-cleanup");
  const verifiedScope = all || argv.includes("--apply-verified-updates");
  return {
    apply: email || verifiedScope,
    email: !email && !verifiedScope ? true : email,
    verified: !email && !verifiedScope ? true : verifiedScope,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = new Client({ connectionString: databaseUrl() });
  await db.connect();
  try {
    const result = await executeCleanup(db, options);
    console.log(JSON.stringify(result));
    console.log(result.applied ? "COMMIT — schválené zmeny boli uložené." : "READ ONLY — bez zápisu.");
  } finally {
    await db.end();
  }
}

function publicError(error) {
  if (error instanceof CleanupError) return error.message;
  const code = typeof error?.code === "string" && /^[A-Z0-9_]{2,12}$/.test(error.code)
    ? ` (kód ${error.code})`
    : "";
  return `neočakávaná chyba${code}`;
}

if (require.main === module) main().catch(error => {
  // PostgreSQL/network messages and details can echo credentials or endpoints.
  console.error("Čistenie nepotvrdené:", publicError(error));
  process.exitCode = 1;
});

module.exports = {
  BOGUS_EMAIL,
  CleanupError,
  closure,
  verified,
  loadManifest,
  isBogusEmail,
  planClinic,
  executeCleanup,
  parseArgs,
  publicError,
};