#!/usr/bin/env node
// Diagnostic only: no writes, inferred consent, report-policy changes or sends.
const MISSION = "a65e7775-885c-4413-b2be-e63c92decd3d";
const NAME = "Medical Partner Cooperation";
const CHOICES = ["MPN-06a", "MPN-06e"];

function analyzeEnrollment(events, currentIds, agreedIds, options) {
  const agreed = new Set(agreedIds);
  const current = new Set(currentIds);
  const active = new Set();
  const hasAgreement = values => [...agreed].some(id => values.has(id));
  const overlap = Object.fromEntries(CHOICES.map(key => [key, null]));
  let confirmationRecorded = false, removalRecorded = false, withdrawnAfterConfirmation = false;
  let ambiguous = false;
  const relevant = new Set([...agreed, ...Object.values(options).flat()]);
  const sorted = events.filter(e => relevant.has(e.itemId)).sort((a, b) =>
    a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  for (let i = 0; i < sorted.length;) {
    const at = sorted[i].at;
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}$/.test(at))
      throw Error("Unexpected database timestamp format");
    const batch = new Map();
    while (i < sorted.length && sorted[i].at === at) {
      const event = sorted[i++];
      if (typeof event.confirmed !== "boolean") throw Error("Invalid confirmation event");
      if (agreed.has(event.itemId)) {
        confirmationRecorded ||= event.confirmed;
        removalRecorded ||= !event.confirmed;
      }
      const states = batch.get(event.itemId) || new Set();
      states.add(event.confirmed);
      batch.set(event.itemId, states);
    }
    const before = hasAgreement(active);
    for (const [id, states] of batch) {
      // Exact-timestamp contradictions are unknown, not an arbitrary ID order.
      if (states.size > 1) { ambiguous = true; active.delete(id); }
      else if (states.has(true)) active.add(id);
      else active.delete(id);
    }
    if (before && !hasAgreement(active) &&
        [...batch].some(([id, states]) => agreed.has(id) && states.size === 1 && states.has(false)))
      withdrawnAfterConfirmation = true;
    if (hasAgreement(active)) for (const key of CHOICES) {
      if (overlap[key] === null && options[key].some(id => active.has(id))) overlap[key] = at;
    }
  }
  return {
    aktualneOdpovede: CHOICES.filter(key => options[key].some(id => current.has(id))),
    suhlasAktualne: hasAgreement(current),
    potvrdenieSuhlasuVHistorii: confirmationRecorded,
    odobratieSuhlasuVHistorii: removalRecorded,
    preukazaneOdobratiePoPotvrdeni: withdrawnAfterConfirmation,
    suhlasNaKonciHistorie: hasAgreement(active),
    rozporneUdalostiVRovnakomCase: ambiguous,
    prvyPreukazanySubehCasDB: overlap,
  };
}

function summarize(enrollments, states, events, agreedIds, options) {
  const grouped = new Map();
  for (const enrollment of [...enrollments].sort((a, b) =>
    a.clinicId.localeCompare(b.clinicId) || a.id.localeCompare(b.id))) {
    const row = analyzeEnrollment(events.filter(e => e.contactId === enrollment.id),
      states.filter(s => s.contactId === enrollment.id).map(s => s.itemId), agreedIds, options);
    const rows = grouped.get(enrollment.clinicId) || [];
    rows.push(row);
    grouped.set(enrollment.clinicId, rows);
  }
  const clinics = [...grouped.values()].map((rows, index) => ({
    ambulancia: index + 1,
    zapisy: rows.map((row, i) => ({
      zapis: i + 1, ...row,
      suhlasIbaNaInomZapise: !row.suhlasAktualne &&
        rows.some((other, j) => j !== i && other.suhlasAktualne),
      potvrdenieSuhlasuNaInomZapise: !row.potvrdenieSuhlasuVHistorii &&
        rows.some((other, j) => j !== i && other.potvrdenieSuhlasuVHistorii),
    })),
  }));
  return {
    mission: NAME,
    rozsah: "Aktuálni držitelia MPN-06a/MPN-06e; všetky ich zápisy v rovnakej Mission. Bez filtra obdobia a kohorty.",
    pocetAmbulancii: clinics.length,
    pocetZapisov: enrollments.length,
    pravidlo: "Súbeh iba na jednom zápise; presné databázové časy, žiadne domyslené dátumy.",
    ambulancie: clinics,
  };
}

async function inspect(client) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '20s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
    const mission = (await client.query("SELECT name,settings FROM campaigns WHERE id=$1", [MISSION])).rows[0];
    if (mission?.name !== NAME) throw Error("Mission identity differs");
    const settings = typeof mission.settings === "string" ? JSON.parse(mission.settings) : mission.settings;
    const agreedIds = settings?.missionFunnel?.sources?.agreed;
    if (!Array.isArray(agreedIds) || !agreedIds.length || agreedIds.some(id => typeof id !== "string"))
      throw Error("No usable saved agreement mapping");
    const items = (await client.query(
      "SELECT id,step_id AS step,label FROM campaign_status_list_items WHERE campaign_id=$1", [MISSION])).rows;
    if (agreedIds.some(id => !items.some(item => item.id === id))) throw Error("Agreement mapping references missing items");
    const options = Object.fromEntries(CHOICES.map(key => [key, items.filter(item => item.step === key).map(item => item.id)]));
    if (CHOICES.some(key => options[key].length !== 1)) throw Error("Target choices are missing or ambiguous");
    const candidates = (await client.query(`
      SELECT DISTINCT cc.clinic_id AS "clinicId"
      FROM campaign_contacts cc JOIN clinics c ON c.id=cc.clinic_id
      JOIN campaign_contact_status_list_state s ON s.campaign_contact_id=cc.id
      WHERE cc.campaign_id=$1 AND cc.contact_type='clinic'
        AND s.status_list_item_id=ANY($2::text[])`,
    [MISSION, Object.values(options).flat()])).rows.map(row => row.clinicId);
    if (candidates.length > 100) throw Error("Unexpected candidate scope; stop");
    const enrollments = (await client.query(`
      SELECT id,clinic_id AS "clinicId" FROM campaign_contacts
      WHERE campaign_id=$1 AND contact_type='clinic' AND clinic_id=ANY($2::text[])`,
    [MISSION, candidates])).rows;
    const contactIds = enrollments.map(row => row.id);
    const itemIds = [...new Set([...agreedIds, ...Object.values(options).flat()])];
    const states = (await client.query(`
      SELECT campaign_contact_id AS "contactId",status_list_item_id AS "itemId"
      FROM campaign_contact_status_list_state
      WHERE campaign_contact_id=ANY($1::text[]) AND status_list_item_id=ANY($2::text[])`,
    [contactIds, itemIds])).rows;
    const events = (await client.query(`
      SELECT h.id,h.campaign_contact_id AS "contactId",
        h.metadata->>'statusListItemId' AS "itemId",
        (h.metadata->>'confirmed')::boolean AS confirmed,
        to_char(h.created_at,'YYYY-MM-DD"T"HH24:MI:SS.US') AS at
      FROM campaign_contact_history h
      JOIN campaign_status_list_items i ON i.id=h.metadata->>'statusListItemId'
      WHERE h.campaign_contact_id=ANY($1::text[]) AND i.campaign_id=$2
        AND i.id=ANY($3::text[]) AND h.action='status_list_confirmation'
        AND h.metadata->>'confirmed' IN ('true','false')
      ORDER BY h.created_at,h.id`, [contactIds, MISSION, itemIds])).rows;
    const report = summarize(enrollments, states, events, agreedIds, options);
    report.mapovanieSuhlasu = items.filter(item => agreedIds.includes(item.id)).map(({ step, label }) => ({ krok: step, moznost: label }));
    report.odoslaneAleboZmeneneZaznamy = 0;
    return report;
  } finally {
    await client.query("ROLLBACK");
  }
}

async function main(args) {
  if (args.length !== 1 || args[0] !== "--check") throw Error("Use --check; this tool is read-only");
  const path = require("node:path");
  const fs = require("node:fs");
  const cp = require("node:child_process");
  const app = "/var/www/indexus-crm";
  const requireApp = require("node:module").createRequire(path.join(app, "package.json"));
  const env = requireApp("dotenv").parse(fs.readFileSync(path.join(app, ".env")));
  if (!env.DATABASE_URL) throw Error("Application database configuration is missing");
  const client = new (requireApp("pg").Client)({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    const head = cp.execFileSync("git", ["-C", app, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    if (head !== "5820719e87ec2b298958f568e137b58a53758cc1")
      throw Error("Production release differs; review before running");
    await client.connect();
    const report = await inspect(client);
    console.log(JSON.stringify({ produkcnaVerzia: head, ...report }, null, 2));
  } finally { await client.end(); }
}

if (require.main === module || !module.parent) {
  main(process.argv.slice(2)).catch(error => {
    // PostgreSQL message/detail can contain row values; never print them.
    const code = /^[0-9A-Z]{5}$/.test(error.code || "") ? error.code : "diagnostic";
    const safe = !error.code && /^(Use --check|Application database configuration|Production release differs|Mission identity|No usable|Agreement mapping|Target choices|Unexpected candidate|Unexpected database timestamp|Invalid confirmation)/.test(error.message || "")
      ? error.message : "Read-only check failed; no business-data writes were performed";
    console.error(`STOP ${code}: ${safe}`);
    process.exitCode = 1;
  });
}
module.exports = { MISSION, NAME, CHOICES, analyzeEnrollment, summarize, inspect };
