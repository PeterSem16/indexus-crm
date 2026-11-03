#!/usr/bin/env node
// Production operator diagnostic. PostgreSQL enforces READ ONLY throughout.
// Hypothetical policies run only in memory, never as saved configuration.
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const { createRequire, Module } = require("node:module");
const MISSION = "a65e7775-885c-4413-b2be-e63c92decd3d";
const NAME = "Medical Partner Cooperation";
const BASELINE = "661bf713314ea5582b75d4e25bc2b302a415c31a";
const PURE_FILES = [
  "server/lib/mission-funnel.ts", "server/lib/mission-funnel-actors.ts",
  "shared/mission-funnel.ts", "shared/mission-cooperation-policy.ts", "shared/email-purpose.ts",
];
const TARGETS = ["connected", "agreed", "wantsContract", "wantsToSign", "cooperating", "materials"];
const LIMIT = 200000;
const stop = message => { throw Error(message); };
const parse = value => typeof value === "string" ? JSON.parse(value) : value;
const iso = value => value instanceof Date ? value.toISOString() : String(value);
const row = (report, key) => report.rows.find(r => r.key === key);
const members = (report, key) => new Set(row(report, key).members.map(m => m.id));
const difference = (a, b) => [...a].filter(id => !b.has(id));
function exactReplace(source, before, after) {
  if (source.split(before).length !== 2) stop("AUDIT_ENGINE_ANCHOR_CHANGED");
  return source.replace(before, after);
}
function policySources(source) {
  let materials = exactReplace(source,
    "if (legacyCooperationReached.has(target) && (packageSent || partsSent))",
    'if (target.has("cooperating") && (packageSent || partsSent))');
  materials = exactReplace(materials, "materials: legacyCooperationMeasurable &&",
    "materials: cooperationMeasurable &&");
  materials = exactReplace(materials,
    "const materialsPreviousCount = legacyCooperationMeasurable || legacyCooperationCount > 0 ? legacyCooperationCount : null;",
    'const materialsPreviousCount = cooperationMeasurable ? rows.get("cooperating")!.size : null;');
  const contract = exactReplace(source,
    'else if (yes("proposalAccepted") || yes("proposalOther")) credit("wantsContract",',
    'else if (yes("proposalAccepted")) credit("wantsContract",');
  return { baseline: source, materials, contract };
}
function loadEngines(app, requireApp = createRequire(path.join(app, "package.json"))) {
  const sources = policySources(fs.readFileSync(path.join(app, PURE_FILES[0]), "utf8"));
  const esbuild = requireApp("esbuild");
  return Object.fromEntries(Object.entries(sources).map(([kind, source]) => {
    const result = esbuild.buildSync({
      stdin: { contents: source + '\nexport { funnelConfigSchema } from "../../shared/mission-funnel";\n',
        loader: "ts", resolveDir: path.join(app, "server/lib"), sourcefile: "mission-funnel.ts" },
      bundle: true, write: false, platform: "node", format: "cjs", external: ["zod"], logLevel: "silent",
    });
    const filename = path.join(app, `readonly-impact-${kind}.cjs`);
    const compiled = new Module(filename);
    compiled.filename = filename;
    compiled.require = requireApp;
    compiled._compile(result.outputFiles[0].text, filename);
    return [kind, compiled.exports];
  }));
}
function parseArgs(args) {
  if (args.length !== 5 || args[0] !== "--check" || args[1] !== "--from" || args[3] !== "--to")
    stop("USE_CHECK_FROM_TO_ONLY");
  const validDay = day => /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day + "T00:00:00Z")) &&
    new Date(day + "T00:00:00Z").toISOString().slice(0, 10) === day;
  if (!validDay(args[2]) || !validDay(args[4]) || args[2] > args[4]) stop("INVALID_COHORT_DATES");
  return { from: args[2], to: args[4] };
}
function summarize(input, engines, dates, now, timestampInfo = {}) {
  const aliases = new Map(input.clinics.map(c => c.id).sort().map((id, i) =>
    [id, `K${String(i + 1).padStart(4, "0")}`]));
  const positive = new Map();
  const clinicForContact = new Map(input.enrollments.map(e => [e.id, e.clinicId]));
  const codeForItem = new Map(input.items.map(item => [item.id, item.stepId]));
  for (const proof of [...input.states, ...input.events.filter(e => e.confirmed)]) {
    const clinic = clinicForContact.get(proof.contactId);
    if (!clinic) continue;
    const codes = positive.get(clinic) ?? new Set();
    const code = codeForItem.get(proof.itemId);
    if (code) codes.add(code);
    positive.set(clinic, codes);
  }
  const describe = (ids, baseline) => ({
    pocet: ids.length,
    zobrazenych: Math.min(ids.length, 40),
    ambulancie: ids.slice().sort((a, b) => aliases.get(a).localeCompare(aliases.get(b))).slice(0, 40).map(id => ({
      kod: aliases.get(id),
      spolupracuje: members(baseline, "cooperating").has(id),
      materialy: members(baseline, "materials").has(id),
      chceZmluvu: members(baseline, "wantsContract").has(id),
      pozitivneDokazy: ["MPN-05c", "MPN-06a", "MPN-06b", "MPN-06c", "MPN-06d", "MPN-06e", "MPN-13d"]
        .filter(code => positive.get(id)?.has(code)),
    })),
  });
  const scopes = [
    { nazov: "Inventúra celej Mission, aj bez prvého vytáčania; nie bežný časový Funnel",
      filters: {}, options: { allMilestones: true } },
    { nazov: "Bežný Funnel bez dátumového obmedzenia; vyžaduje prvý oprávnený pokus",
      filters: {}, options: {} },
    { nazov: "Vybraná kohorta podľa prvého oprávneného vytáčania", filters: dates, options: {} },
  ].map(scope => {
    const baseline = engines.baseline.computeMissionFunnel(input, scope.filters, now, scope.options);
    const materials = engines.materials.computeMissionFunnel(input, scope.filters, now, scope.options);
    const contract = engines.contract.computeMissionFunnel(input, scope.filters, now, scope.options);
    const baselineMaterials = members(baseline, "materials");
    const modeledMaterials = members(materials, "materials");
    const baselineWants = members(baseline, "wantsContract");
    const modeledWants = members(contract, "wantsContract");
    const connected = row(baseline, "connected");
    const eligible = scope.options.allMilestones ? new Set(input.clinics.map(c => c.id)) : members(baseline, "dialed");
    const packageIds = new Set(input.config.materials?.packageSent ?? []);
    const proofContacts = new Set([
      ...input.states.filter(s => packageIds.has(s.itemId)).map(s => s.contactId),
      ...input.events.filter(e => e.confirmed && packageIds.has(e.itemId)).map(e => e.contactId),
    ]);
    const packageClinics = new Set([...proofContacts].map(id => clinicForContact.get(id)).filter(id => eligible.has(id)));
    return {
      rozsah: scope.nazov, datumovyFilter: scope.filters,
      aktualnyFunnel: Object.fromEntries(TARGETS.map(key => {
        const r = row(baseline, key);
        return [key, { celkom: r.total, priame: r.direct, odvodene: r.inferred, percentoPredchadzajuceho: r.previousPercent }];
      })),
      dokazBalikaAspoRazAleboAktualne: describe([...packageClinics], baseline),
      modelMaterialyPodlaZobrazenejSpoluprace: {
        celkom: row(materials, "materials").total,
        percentoPredchadzajuceho: row(materials, "materials").previousPercent,
        pribudliBy: describe(difference(modeledMaterials, baselineMaterials), baseline),
        ubudliBy: describe(difference(baselineMaterials, modeledMaterials), baseline),
      },
      modelChceZmluvuIbaSuhlasAPrijataPonuka: {
        celkom: row(contract, "wantsContract").total,
        ubudliBy: describe(difference(baselineWants, modeledWants), baseline),
        pribudliBy: describe(difference(modeledWants, baselineWants), baseline),
      },
      zastihnutie: {
        celkom: connected.total, priamyDokazSpojenehoHovoru: connected.direct,
        ibaOdvodene: connected.inferred,
        ibaOdvodeneAmbulancie: describe(connected.members.filter(m => m.inferred).map(m => m.id), baseline),
        preukazanyRozhovorSLekarom: null,
        dovod: "Samotný answeredAt a trvanie hovoru nerozlišujú lekára, sestru a recepciu.",
      },
    };
  });
  const codes = ids => ids.map(id => codeForItem.get(id) ?? "[nedostupná položka]");
  return {
    mission: NAME, rezim: "READ ONLY; ROLLBACK; žiadne odosielanie ani zápisy",
    casAudituUTC: now.toISOString(), ...timestampInfo,
    rozsah: "Všetky existujúce ambulancie tejto Mission, všetky krajiny, bez filtra odporúčania či zástupcu.",
    obmedzenia: [
      "Modely sú samostatné hypotézy na vyčíslenie dopadu, nie schválené nové pravidlá; navzájom sa nekombinujú.",
      "Dokaz balíka aspoň raz alebo aktuálne nie je sám osebe dôkazom súbehu so spoluprácou ani dátumu zásielky.",
      "Pozitívne kódy v zozname znamenajú existenciu potvrdenia aspoň raz alebo aktuálneho stavu, nie ich vzájomný súbeh.",
      "E-mailové kroky, automatizácie, reálny obsah rozhovoru a prevádzková reaktivácia nie sú predmetom tohto auditu.",
      "Anonymné kódy sú konzistentné iba v tomto výstupe; každý podrobný zoznam je obmedzený na 40 ambulancií.",
    ],
    modelMaterialy: "Nahrádza iba pôvodnú podmienku spolupráce a jej menovateľ dosiahnutým výsledkom Spolupracuje.",
    modelChceZmluvu: "Nahrádza iba vstup do Chce zmluvu podmienkou súhlas AND prijatá ponuka; ostatné pravidlá zostávajú.",
    inventura: { ambulancie: input.clinics.length, zapisy: input.enrollments.length,
      potvrdeniaVHistorii: input.events.length, stavoveRiadky: input.states.length, evidovaneHovory: input.calls.length },
    pouziteMapovanie: {
      agreed: codes(input.config.sources.agreed), proposalAccepted: codes(input.config.sources.proposalAccepted),
      proposalOther: codes(input.config.sources.proposalOther), proposalUnaccepted: codes(input.config.sources.proposalUnaccepted),
      packageSent: codes(input.config.materials?.packageSent ?? []),
    },
    porovnania: scopes,
  };
}
async function inspect(client, engines, dates) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout='20s'");
    await client.query("SET LOCAL lock_timeout='3s'");
    const state = (await client.query(`SELECT current_setting('transaction_read_only') AS "readOnly",
      current_setting('TimeZone') AS "databaseTimeZone", transaction_timestamp() AS now`)).rows[0];
    if (state?.readOnly !== "on") stop("DATABASE_READ_ONLY_NOT_CONFIRMED");
    const mission = (await client.query("SELECT name,settings FROM campaigns WHERE id::text=$1", [MISSION])).rows[0];
    if (mission?.name !== NAME) stop("MISSION_IDENTITY_CHANGED");
    const saved = parse(mission.settings)?.missionFunnel;
    const checked = engines.baseline.funnelConfigSchema.safeParse(saved);
    if (!checked.success) stop("INVALID_SAVED_MAPPING");
    async function query(sql, params) {
      const rows = (await client.query(sql, params)).rows;
      if (rows.length > LIMIT) stop("DIAGNOSTIC_SCOPE_LIMIT");
      return rows;
    }
    const items = await query(`SELECT id::text AS id,step_id AS "stepId",parent_id::text AS "parentId"
      FROM campaign_status_list_items WHERE campaign_id::text=$1 ORDER BY sort_order,id LIMIT 200001`, [MISSION]);
    const ids = new Set(items.map(item => item.id));
    const config = { ...checked.data, sources: Object.fromEntries(Object.entries(checked.data.sources)
      .map(([key, values]) => [key, values.filter(id => ids.has(id))])),
      ...(checked.data.materials ? { materials: {
        packageSent: checked.data.materials.packageSent.filter(id => ids.has(id)),
        excluded: Object.fromEntries(Object.entries(checked.data.materials.excluded)
          .map(([key, values]) => [key, values.filter(id => ids.has(id))])),
      } } : {}) };
    const clinics = await query(`SELECT DISTINCT c.id::text AS id,
      CASE WHEN c.representative_id IS NULL THEN NULL ELSE 'assigned' END AS "representativeId",
      c.is_referred_by_doctor AS referred FROM clinics c
      JOIN campaign_contacts cc ON cc.clinic_id=c.id
      WHERE cc.campaign_id::text=$1 AND cc.contact_type='clinic' ORDER BY id LIMIT 200001`, [MISSION]);
    const clinicIds = clinics.map(c => c.id);
    const enrollments = await query(`SELECT id::text AS id,clinic_id::text AS "clinicId" FROM campaign_contacts
      WHERE campaign_id::text=$1 AND contact_type='clinic' AND clinic_id::text=ANY($2::text[]) LIMIT 200001`, [MISSION, clinicIds]);
    const contactIds = enrollments.map(e => e.id);
    const events = await query(`SELECT h.id::text AS id,h.campaign_contact_id::text AS "contactId",
      h.metadata->>'statusListItemId' AS "itemId",(h.metadata->>'confirmed')::boolean AS confirmed,h.created_at AS at
      FROM campaign_contact_history h JOIN campaign_status_list_items i ON i.id::text=h.metadata->>'statusListItemId'
      WHERE h.campaign_contact_id::text=ANY($1::text[]) AND i.campaign_id::text=$2
      AND h.action='status_list_confirmation' AND h.metadata->>'confirmed' IN ('true','false')
      ORDER BY h.created_at,h.id LIMIT 200001`, [contactIds, MISSION]);
    const states = await query(`SELECT s.campaign_contact_id::text AS "contactId",s.status_list_item_id::text AS "itemId",s.confirmed_at AS at
      FROM campaign_contact_status_list_state s JOIN campaign_status_list_items i ON i.id=s.status_list_item_id
      WHERE s.campaign_contact_id::text=ANY($1::text[]) AND i.campaign_id::text=$2 LIMIT 200001`, [contactIds, MISSION]);
    const calls = await query(`SELECT l.id::text AS id,l.campaign_contact_id::text AS "contactId",
      CASE WHEN cc.id IS NOT NULL AND cc.campaign_id::text=$1 AND cc.contact_type='clinic'
        AND cc.clinic_id::text=ANY($2::text[]) AND (l.customer_id IS NULL OR l.customer_id=cc.clinic_id) THEN cc.clinic_id::text
        WHEN cc.id IS NULL AND l.customer_id::text=ANY($2::text[]) THEN l.customer_id::text ELSE NULL END AS "clinicId",
      l.direction,l.status,l.started_at AS at,l.answered_at AS "answeredAt",l.duration_seconds AS duration,
      l.sip_call_id AS "sipCallId",l.metadata
      FROM call_logs l LEFT JOIN campaign_contacts cc ON cc.id=l.campaign_contact_id
      WHERE l.campaign_id::text=$1 AND (cc.clinic_id::text=ANY($2::text[]) OR l.customer_id::text=ANY($2::text[])
        OR cc.id IS NULL) LIMIT 200001`, [MISSION, clinicIds]);
    const input = {
      items: items.map(item => ({ ...item, label: "" })), config, enrollments,
      clinics: clinics.map((c, i) => ({ ...c, name: `Anonymous ${i + 1}` })),
      events: events.map(e => ({ ...e, at: iso(e.at) })), states: states.map(s => ({ ...s, at: iso(s.at) })),
      calls: calls.map(c => {
        let metadata = {};
        try { metadata = parse(c.metadata) ?? {}; } catch { /* Same legacy handling as native loader. */ }
        const { metadata: ignored, ...safe } = c;
        return { ...safe, at: iso(c.at), answeredAt: c.answeredAt ? iso(c.answeredAt) : null,
          duration: Number(c.duration) || 0,
          attemptAt: typeof metadata.funnelAttemptSentAt === "string" ? metadata.funnelAttemptSentAt : null };
      }),
    };
    return summarize(input, engines, dates, new Date(state.now), { casovePasmoDB: state.databaseTimeZone });
  } finally {
    await client.query("ROLLBACK");
  }
}
async function main(args) {
  const dates = parseArgs(args);
  const app = "/var/www/indexus-crm";
  const requireApp = createRequire(path.join(app, "package.json"));
  const head = cp.execFileSync("git", ["-C", app, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (head !== BASELINE) stop("PRODUCTION_BASELINE_CHANGED");
  cp.execFileSync("git", ["-C", app, "diff", "--quiet", BASELINE, "--", ...PURE_FILES], { stdio: "pipe" });
  if (new Date("2026-01-01T00:00:00Z").getTimezoneOffset() !== 0 ||
      new Date("2026-07-01T00:00:00Z").getTimezoneOffset() !== 0) stop("PROCESS_TIMEZONE_NOT_UTC");
  const engines = loadEngines(app, requireApp);
  const env = requireApp("dotenv").parse(fs.readFileSync(path.join(app, ".env")));
  if (!env.DATABASE_URL) stop("APPLICATION_DATABASE_CONFIGURATION_MISSING");
  const client = new (requireApp("pg").Client)({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    console.log(JSON.stringify({ produkcnaVerzia: head, ...await inspect(client, engines, dates) }, null, 2));
    console.log("AUDIT_FUNNEL_OK=READ_ONLY");
  } finally { await client.end(); }
}
if (require.main === module || !module.parent) main(process.argv.slice(2)).catch(error => {
  // Never print raw provider/DB messages, SQL, connection data or row details.
  const safe = /^(AUDIT_ENGINE_ANCHOR_CHANGED|USE_CHECK_FROM_TO_ONLY|INVALID_COHORT_DATES|DATABASE_READ_ONLY_NOT_CONFIRMED|MISSION_IDENTITY_CHANGED|INVALID_SAVED_MAPPING|DIAGNOSTIC_SCOPE_LIMIT|PRODUCTION_BASELINE_CHANGED|PROCESS_TIMEZONE_NOT_UTC|APPLICATION_DATABASE_CONFIGURATION_MISSING)$/.test(error.message || "")
    ? error.message : /^[0-9A-Z]{5}$/.test(error.code || "") ? `SQLSTATE_${error.code}` : "DIAGNOSTIC_FAILED";
  console.error(`STOP: ${safe}; audit nevykonáva zápisy.`);
  process.exitCode = 1;
});
module.exports = { MISSION, NAME, BASELINE, TARGETS, policySources, loadEngines, parseArgs, summarize, inspect };
