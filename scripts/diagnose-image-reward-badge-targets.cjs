#!/usr/bin/env node
/**
 * Read-only review of the 34 doctors explicitly visible in the supplied image.
 * Never writes a badge flag or payment state. Names and organisations stay in
 * the private review file, not in stdout/server logs.
 */
const fs = require("node:fs");
const crypto = require("node:crypto");
const XLSX = require("xlsx");
const { Client } = require("pg");
const { nameKey, safeOutputPath } = require("./limit-unpaid-reward-badges-from-excel.cjs");

const TARGETS = [
  ["Dagmar Gavorníková", "TeleMedCare, s.r.o."],
  ["Dušan Táborský", "PROFEM, s.r.o."],
  ["Radmila Sládičeková MPH", "RADMA GYN, s.r.o."],
  ["Martin Gažo", "GYN SANTE s.r.o."],
  ["Boris Hudec", "GYNEMAB, s.r.o."],
  ["Rafik Al Khoury", "MATRIS, s.r.o."],
  ["Jozef Tholt", "GynAT s.r.o."],
  ["Jela Kubalová", "Gyn. Ambul. Trenčín, s.r.o."],
  ["Vladimír Klacík", "Gynmare, s.r.o."],
  ["Mária Oravcová", "OK GYN, s.r.o."],
  ["Karol Javorka", "Javorka, s.r.o."],
  ["Stela Muránska", "Centrum prenatálnej diagnostiky, s.r.o."],
  ["Marián Raučina", "GYN-RS, s.r.o."],
  ["Ján Baláž", "GYTAP, s.r.o."],
  ["Júlia Frívaldská", "TETRAO, s.r.o."],
  ["Michal Dandár", "MIDAN-Prešov, s.r.o."],
  ["Ján Kováč", "MUDr. Ján Kováč, s.r.o."],
  ["Tatiana Ivanovová", "Tatiana Ivanovová - TRIGYN-L, s.r.o."],
  ["Ján Pružinský", "Gynmaster s.r.o."],
  ["Ivan Dečkov", "Dečkov s.r.o."],
  ["Pavol Kopka", "Kengimed s.r.o."],
  ["Ružena Bugárová", "GYNARUB s.r.o."],
  ["Pavol Hartel", "GYN-PRAKTIK s.r.o."],
  ["Daniel Olejár", "Gyndanol, s.r.o."],
  ["Zuzana Melichová", "TETRAO, s.r.o."],
  ["Dagmar Kapralčíková", "GYNEKODK s.r.o."],
  ["Branislav Murín", "B.G.M.GYN s.r.o."],
  ["Jana Paučínová", "Gynekológia Paučínová, s.r.o."],
  ["Gabriel Mančík", "VITAL, s.r.o."],
  ["Klaudia Zuzčáková", "GYNSERVIS, s.r.o."],
  ["Alžbeta Vargová", "MUDr. Alžbeta Vargová, s.r.o."],
  ["Peter Linkesch ml.", "DERMAGYN s.r.o."],
  ["Mária Hudecová", "GYNEMAB s.r.o."],
  ["Ivana Kleinová", "GYNOMED s.r.o."],
];

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const line = fs.readFileSync("/var/www/indexus-crm/.env", "utf8")
    .split(/\r?\n/).find(value => value.startsWith("DATABASE_URL="));
  if (!line) throw new Error("Application DATABASE_URL is missing");
  let url = line.slice("DATABASE_URL=".length).trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1);
  }
  if (!url) throw new Error("Application DATABASE_URL is empty");
  return url;
}

function personKey(name) {
  return nameKey(name.replace(/\bml\./gi, ""));
}

function organisationKey(name) {
  return String(name || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\bs\s*\.?\s*r\s*\.?\s*o\s*\.?\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function buildReview(people, assignments, clinics) {
  if (TARGETS.length !== 34 || new Set(TARGETS.map(([name]) => personKey(name))).size !== 34) {
    throw new Error("Image target list is incomplete or contains duplicate names");
  }
  const peopleByName = new Map();
  for (const person of people) {
    const key = personKey(`${person.first_name || ""} ${person.last_name || ""}`);
    if (!peopleByName.has(key)) peopleByName.set(key, []);
    peopleByName.get(key).push(person);
  }
  const clinicsById = new Map(clinics.map(row => [row.id, row]));
  const assignmentsByPerson = new Map();
  for (const row of assignments) {
    if (!assignmentsByPerson.has(row.person_id)) assignmentsByPerson.set(row.person_id, []);
    assignmentsByPerson.get(row.person_id).push(row.entity_id);
  }
  const stats = {
    targetsInImage: TARGETS.length, noExactPersonName: 0,
    oneNameAndOneOrganisationMatch: 0, multipleOrganisationMatches: 0,
    nameMatchWithoutOrganisationMatch: 0, multipleNameMatchesWithoutOrganisationMatch: 0,
    inactiveSingleOrganisationMatches: 0,
  };
  const report = [[
    "Meno na obrázku", "Organizácia na obrázku", "Výsledok",
    "INDEXUS ID", "Meno na karte", "Aktívna karta", "Zhoda organizácie",
    "Organizácia/pracovisko v INDEXUS", "Prepojené ambulancie", "Krajina",
  ]];
  for (const [name, organisation] of TARGETS) {
    const candidates = peopleByName.get(personKey(name)) || [];
    const reviewed = candidates.map(person => {
      const clinicIds = new Set([
        person.clinic_id, ...(person.clinic_ids || []), ...(assignmentsByPerson.get(person.id) || []),
      ].filter(Boolean));
      const linkedClinics = [...clinicIds].map(id => clinicsById.get(id)).filter(Boolean);
      const evidence = [
        person.company_name, person.workplace_name,
        ...linkedClinics.flatMap(clinic => [clinic.name, clinic.pzs_name]),
      ].filter(Boolean);
      const exactOrganisation = evidence.some(value =>
        organisationKey(value) && organisationKey(value) === organisationKey(organisation));
      return { person, exactOrganisation, evidence, linkedClinics };
    });
    const organisationMatches = reviewed.filter(item => item.exactOrganisation);
    let status;
    if (!candidates.length) {
      stats.noExactPersonName++;
      status = "MENO SA NENAŠLO";
    } else if (organisationMatches.length === 1) {
      stats.oneNameAndOneOrganisationMatch++;
      if (!organisationMatches[0].person.is_active) stats.inactiveSingleOrganisationMatches++;
      status = "JEDNA ZHODA MENA A ORGANIZÁCIE";
    } else if (organisationMatches.length > 1) {
      stats.multipleOrganisationMatches++;
      status = "VIAC ZHÔD MENA A ORGANIZÁCIE";
    } else if (candidates.length === 1) {
      stats.nameMatchWithoutOrganisationMatch++;
      status = "LEN ZHODA MENA";
    } else {
      stats.multipleNameMatchesWithoutOrganisationMatch++;
      status = "VIAC ZHÔD MENA, ORGANIZÁCIA NEPOTVRDENÁ";
    }
    for (const item of reviewed.length ? reviewed : [null]) {
      report.push([
        name, organisation, status,
        item?.person.id || "",
        item ? `${item.person.first_name} ${item.person.last_name}` : "",
        item ? (item.person.is_active ? "áno" : "nie") : "",
        item ? (item.exactOrganisation ? "presná" : "nie") : "",
        item?.evidence.join("; ") || "",
        item?.linkedClinics.map(row => row.name).join("; ") || "",
        item?.person.country_code || "",
      ]);
    }
  }
  return { stats, report };
}

function writePrivateReview(file, rows) {
  const safeFile = safeOutputPath(file);
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [31, 37, 43, 39, 31, 15, 21, 60, 60, 12].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(book, sheet, "Kontrola 34 osôb");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  const handle = fs.openSync(safeFile, "wx", 0o600);
  try { fs.writeFileSync(handle, buffer); }
  finally { fs.closeSync(handle); }
}

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--report") {
    throw new Error("Usage: node scripts/diagnose-image-reward-badge-targets.cjs --report /private/review.xlsx (read-only)");
  }
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const database = (await client.query("SELECT current_database() AS db")).rows[0].db;
    const people = (await client.query(
      `SELECT id, first_name, last_name, is_active, country_code, company_name,
              workplace_name, clinic_id, clinic_ids
         FROM collaborators`
    )).rows;
    const exactNames = new Set(TARGETS.map(([name]) => personKey(name)));
    const candidateIds = people.filter(row => exactNames.has(personKey(`${row.first_name} ${row.last_name}`)))
      .map(row => row.id);
    const assignments = candidateIds.length
      ? (await client.query(
        `SELECT person_id, entity_id FROM contact_assignments
          WHERE entity_type = 'clinic' AND is_active = true
            AND person_id = ANY($1::varchar[])`, [candidateIds]
      )).rows : [];
    const matchingPeople = people.filter(row => candidateIds.includes(row.id));
    const clinicIds = [...new Set(matchingPeople.flatMap(row => [
      row.clinic_id, ...(row.clinic_ids || []),
    ]).concat(assignments.map(row => row.entity_id)).filter(Boolean))];
    const clinics = clinicIds.length
      ? (await client.query(
        "SELECT id, name, pzs_name FROM clinics WHERE id = ANY($1::varchar[])", [clinicIds]
      )).rows : [];
    const { stats, report } = buildReview(matchingPeople, assignments, clinics);
    await client.query("ROLLBACK");
    writePrivateReview(process.argv[3], report);
    console.log(JSON.stringify({
      database, ...stats,
      targetListHash: crypto.createHash("sha256").update(JSON.stringify(TARGETS)).digest("hex"),
      privateReportRows: report.length - 1,
    }, null, 2));
    console.log("Private review created; do not share its contents in chat.");
  } finally {
    await client.end();
  }
}

if (require.main === module) main().catch(error => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
module.exports = { TARGETS, personKey, organisationKey, buildReview };