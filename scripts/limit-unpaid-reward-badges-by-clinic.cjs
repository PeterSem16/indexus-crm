#!/usr/bin/env node
/**
 * One-time maintenance for the screenshot's 34 person/clinic pairs. A person is
 * eligible only when their exact normalized name is linked to a clinic whose
 * name/provider matches the pictured organisation, OR their own company /
 * workplace matches it and they have a clinic link. All qualifying duplicate
 * cards are included; a name-only clinic link is never sufficient.
 *
 * This changes ONLY collaborators.unpaid_reward_badge_eligible. Deploy the
 * static badge code only AFTER this allowlist is applied: selected people must
 * show the badge in Nexus Pulse and person cards even without any Actions.
 */
const fs = require("node:fs");
const crypto = require("node:crypto");
const { Client } = require("pg");
const { safeOutputPath } = require("./limit-unpaid-reward-badges-from-excel.cjs");
const { TARGETS, personKey, organisationKey } = require("./diagnose-image-reward-badge-targets.cjs");

const digest = value => crypto.createHash("sha256").update(value).digest("hex");
function fail(message) { throw new Error(message); }

// Reviewed name variants from the private production clinic-link diagnostic.
// Each alias applies only to its one screenshot row, never to all people at
// the same provider. These do not create or change clinic membership.
const CLINIC_NAME_ALIASES = new Map([
  [8, ["Gynekologická ambulancia Trenčín s.r.o."]],
  [10, ["Gynekologická ambulancia,OK GYN,s.r.o."]],
  [18, ["TRIGYN-L, s.r.o."]],
  [34, ["Gynekologická ambulancia, Gynomed, s.r.o."]],
]);
const APPROVED_UNRESOLVED_ROWS = [1, 5, 15, 16, 28, 33];
const PRE_ALIAS_REPORT_HASH = "a4928b54a6f70fab8032c6c38aaada240f268c0822f90e110ca5dbd21319a90e";
const PRE_ALIAS_REPORT_FILE_SHA256 = "f02c3db78eb87ee601e6202669a8052189f5a371396872c0f0366c35e94c1020";
const PRE_ALIAS_UNRESOLVED_ROWS = [1, 5, 8, 10, 15, 16, 18, 28, 33, 34];

function options(args) {
  const result = {};
  const valueFlags = new Set([
    "--report", "--approval-report", "--expect-database", "--expect-targets", "--expect-unresolved",
    "--expect-people", "--expect-pairs", "--confirm-hash", "--confirm-pairs-hash", "--backup",
  ]);
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === "--commit") {
      if (result.commit) fail("Duplicate --commit");
      result.commit = true;
    } else if (valueFlags.has(key)) {
      if (result[key] || !args[i + 1] || args[i + 1].startsWith("--")) fail(`Invalid ${key}`);
      result[key] = args[++i];
    } else fail(`Unknown argument ${key}`);
  }
  if (!result.commit && [...valueFlags].some(key => !["--report", "--approval-report"].includes(key) && result[key])) {
    fail("Confirmation options require --commit");
  }
  if (result.commit && [...valueFlags].some(key => key !== "--report" && !result[key])) {
    fail("Commit requires database, approved target/unresolved/person/pair counts, both hashes and a private backup path");
  }
  if (result.commit && result["--report"]) fail("Private diagnostic report is available only in dry-run");
  return result;
}

function approvedPairsFromEarlierReview(file) {
  const input = safeOutputPath(file);
  if (fs.statSync(input).mode & 0o077) fail("Earlier private review must not be group/world accessible");
  const bytes = fs.readFileSync(input);
  if (digest(bytes) !== PRE_ALIAS_REPORT_FILE_SHA256) {
    fail("Earlier private review bytes differ from the independently recorded SHA-256");
  }
  return deriveApprovedPairsFromSnapshot(JSON.parse(bytes.toString("utf8")));
}

function deriveApprovedPairsFromSnapshot(report) {
  if (report.database !== "indexus_crm" || report.planHash !== PRE_ALIAS_REPORT_HASH ||
      !Array.isArray(report.targets) || report.targets.length !== 34) {
    fail("Earlier private review is not the approved pre-alias production snapshot");
  }
  const unresolvedRows = report.targets.flatMap((target, index) =>
    target.selection === "unresolved" ? [index + 1] : []);
  if (JSON.stringify(unresolvedRows) !== JSON.stringify(PRE_ALIAS_UNRESOLVED_ROWS)) {
    fail("Earlier private review has unexpected unresolved rows");
  }
  const approvedPairs = new Set();
  let approvedTargets = 0;
  for (const [index, target] of report.targets.entries()) {
    const row = index + 1;
    if (target.name !== TARGETS[index][0] || target.organisation !== TARGETS[index][1]) {
      fail(`Earlier private review has unexpected target order at row ${row}`);
    }
    let pairCount = 0;
    if (target.selection === "name + clinic") {
      const clinicIds = new Set(target.strictClinicMatches.map(clinic => clinic.id));
      for (const candidate of target.candidates.filter(candidate => candidate.selected)) {
        for (const clinic of candidate.linkedClinics) {
          if (clinicIds.has(clinic.id)) {
            approvedPairs.add(JSON.stringify([candidate.id, clinic.id]));
            pairCount++;
          }
        }
      }
    } else if (CLINIC_NAME_ALIASES.has(row)) {
      const keys = new Set(CLINIC_NAME_ALIASES.get(row).map(organisationKey));
      for (const candidate of target.candidates) {
        for (const clinic of candidate.linkedClinics) {
          if ([clinic.name, clinic.providerName].some(value => keys.has(organisationKey(value)))) {
            approvedPairs.add(JSON.stringify([candidate.id, clinic.id]));
            pairCount++;
          }
        }
      }
    } else if (target.selection !== "unresolved") {
      fail(`Earlier private review has unapproved selection at row ${row}`);
    }
    if ((APPROVED_UNRESOLVED_ROWS.includes(row) && pairCount) ||
        (!APPROVED_UNRESOLVED_ROWS.includes(row) && !pairCount)) {
      fail(`Earlier private review cannot independently approve row ${row}`);
    }
    if (pairCount) approvedTargets++;
  }
  if (approvedTargets !== 28) fail("Earlier private review must approve exactly 28 targets");
  return [...approvedPairs].map(value => JSON.parse(value)).sort((a, b) =>
    a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const line = fs.readFileSync("/var/www/indexus-crm/.env", "utf8")
    .split(/\r?\n/).find(value => value.startsWith("DATABASE_URL="));
  if (!line) fail("Application DATABASE_URL is missing");
  let url = line.slice("DATABASE_URL=".length).trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1);
  }
  if (!url) fail("Application DATABASE_URL is empty");
  return url;
}

function resolveTargetPairs(people, clinics, assignments) {
  if (TARGETS.length !== 34 || new Set(TARGETS.map(([name]) => personKey(name))).size !== 34) {
    fail("Expected 34 distinct screenshot people");
  }
  const peopleByName = new Map();
  for (const person of people) {
    const key = personKey(`${person.first_name || ""} ${person.last_name || ""}`);
    if (!peopleByName.has(key)) peopleByName.set(key, []);
    peopleByName.get(key).push(person);
  }
  const clinicsById = new Map(clinics.map(row => [row.id, row]));
  const linkedClinicsByPerson = new Map();
  function link(personId, clinicId) {
    if (!personId || !clinicsById.has(clinicId)) return;
    if (!linkedClinicsByPerson.has(personId)) linkedClinicsByPerson.set(personId, new Set());
    linkedClinicsByPerson.get(personId).add(clinicId);
  }
  for (const person of people) {
    link(person.id, person.clinic_id);
    for (const id of person.clinic_ids || []) link(person.id, id);
  }
  for (const row of assignments) link(row.person_id, row.entity_id);

  const personIds = new Set();
  const pairs = [];
  const details = [];
  const unresolvedRows = [];
  let noMatchingClinic = 0;
  let noPersonInMatchingClinic = 0;
  let targetsWithMultipleLinkedCards = 0;
  let targetsWithSeveralClinicRecords = 0;
  let matchedViaClinicAlias = 0;
  let matchedViaCompanyAndClinicLink = 0;
  let uniqueNameButClinicUnverified = 0;
  let unresolvedTargets = 0;
  for (const [index, [name, organisation]] of TARGETS.entries()) {
    const key = organisationKey(organisation);
    const matchingClinics = clinics.filter(clinic =>
      [clinic.name, clinic.pzs_name].some(value => organisationKey(value) === key));
    if (!matchingClinics.length) noMatchingClinic++;
    if (matchingClinics.length > 1) targetsWithSeveralClinicRecords++;
    const aliasKeys = new Set((CLINIC_NAME_ALIASES.get(index + 1) || []).map(organisationKey));
    const aliasClinics = clinics.filter(clinic =>
      [clinic.name, clinic.pzs_name].some(value => aliasKeys.has(organisationKey(value))));
    const clinicIds = new Set(matchingClinics.map(row => row.id));
    const aliasClinicIds = new Set(aliasClinics.map(row => row.id));
    const candidates = peopleByName.get(personKey(name)) || [];
    const strictMatches = candidates.filter(person =>
      [...(linkedClinicsByPerson.get(person.id) || [])].some(id => clinicIds.has(id)));
    const aliasMatches = strictMatches.length ? [] : candidates.filter(person =>
      [...(linkedClinicsByPerson.get(person.id) || [])].some(id => aliasClinicIds.has(id)));
    const directMatches = strictMatches.length ? strictMatches : aliasMatches;
    if (aliasMatches.length) matchedViaClinicAlias++;
    if (!directMatches.length) noPersonInMatchingClinic++;
    let matches = directMatches;
    if (!matches.length) {
      const linkedCandidates = candidates.filter(person => (linkedClinicsByPerson.get(person.id)?.size || 0) > 0);
      const companyMatches = linkedCandidates.filter(person =>
        [person.company_name, person.workplace_name].some(value => organisationKey(value) === key));
      if (companyMatches.length) {
        matches = companyMatches;
        matchedViaCompanyAndClinicLink++;
      } else if (candidates.length === 1 && linkedCandidates.length === 1) {
        // A clinic link without an organisation match is not proof that this
        // is the specific clinic pictured. Keep the candidate unresolved.
        uniqueNameButClinicUnverified++;
      }
    }
    if (!matches.length) {
      unresolvedTargets++;
      unresolvedRows.push(index + 1);
    }
    if (matches.length > 1) targetsWithMultipleLinkedCards++;
    details.push({
      name, organisation,
      strictClinicMatches: matchingClinics.map(clinic => ({
        id: clinic.id, name: clinic.name, providerName: clinic.pzs_name,
      })),
      aliasClinicMatches: aliasClinics.map(clinic => ({
        id: clinic.id, name: clinic.name, providerName: clinic.pzs_name,
      })),
      selection: strictMatches.length ? "name + clinic" :
        aliasMatches.length ? "name + reviewed clinic alias" :
        matches.length ? "name + person organisation + clinic link" : "unresolved",
      candidates: candidates.map(person => ({
        id: person.id,
        name: `${person.first_name || ""} ${person.last_name || ""}`.trim(),
        active: person.is_active,
        company: person.company_name,
        workplace: person.workplace_name,
        linkedClinics: [...(linkedClinicsByPerson.get(person.id) || [])]
          .map(id => clinicsById.get(id))
          .filter(Boolean)
          .map(clinic => ({ id: clinic.id, name: clinic.name, providerName: clinic.pzs_name })),
        selected: matches.some(match => match.id === person.id),
      })),
    });
    for (const person of matches) {
      personIds.add(person.id);
      const connected = [...(linkedClinicsByPerson.get(person.id) || [])]
        .filter(id => strictMatches.length ? clinicIds.has(id) :
          aliasMatches.length ? aliasClinicIds.has(id) : true).sort();
      pairs.push([name, organisation, person.id, connected]);
    }
  }
  return {
    personIds, pairs, details, unresolvedRows,
    matchedTargets: 34 - unresolvedTargets,
    noMatchingClinic,
    noPersonInMatchingClinic,
    targetsWithMultipleLinkedCards,
    targetsWithSeveralClinicRecords,
    matchedViaClinicAlias,
    matchedViaCompanyAndClinicLink,
    uniqueNameButClinicUnverified,
    unresolvedTargets,
  };
}

function privateBackup(file, data) {
  const safeFile = safeOutputPath(file);
  const handle = fs.openSync(safeFile, "wx", 0o600);
  try { fs.writeFileSync(handle, JSON.stringify(data, null, 2) + "\n"); }
  finally { fs.closeSync(handle); }
}

async function main() {
  const args = options(process.argv.slice(2));
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query(args.commit
      ? "BEGIN ISOLATION LEVEL READ COMMITTED"
      : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    if (args.commit) {
      // The deployed application must have created the table before cutover.
      // Serialize maintenance runs, then lock the pair table before the source
      // tables. Ordinary reads continue; conflicting writes briefly wait.
      await client.query("SELECT pg_advisory_xact_lock(17381, 20260929)");
      const tableReady = (await client.query(
        "SELECT to_regclass('public.unpaid_reward_badge_clinic_pairs') AS table_name"
      )).rows[0].table_name;
      if (!tableReady) fail("Deploy the badge-pair table migration before committing");
      await client.query("LOCK TABLE unpaid_reward_badge_clinic_pairs IN EXCLUSIVE MODE");
      await client.query(
        "LOCK TABLE collaborators, clinics, contact_assignments, collaborator_activities IN SHARE MODE"
      );
    }
    const database = (await client.query("SELECT current_database() AS db")).rows[0].db;
    const people = (await client.query(
      `SELECT id, first_name, last_name, is_active, company_name, workplace_name, clinic_id, clinic_ids,
              unpaid_reward_badge_eligible
         FROM collaborators ORDER BY id`
    )).rows;
    const clinics = (await client.query(
      "SELECT id, name, pzs_name FROM clinics ORDER BY id"
    )).rows;
    const assignments = (await client.query(
      `SELECT person_id, entity_id FROM contact_assignments
        WHERE entity_type = 'clinic' AND is_active = true
        ORDER BY person_id, entity_id`
    )).rows;
    const match = resolveTargetPairs(people, clinics, assignments);
    const selected = [...match.personIds].sort();
    const selectedPairs = [...new Set(match.pairs.flatMap(([, , personId, clinicIds]) =>
      clinicIds.map(clinicId => JSON.stringify([personId, clinicId]))))]
      .map(value => JSON.parse(value)).sort((a, b) =>
        a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    const pairsHash = digest(JSON.stringify(selectedPairs));
    const earlierApprovedPairs = args["--approval-report"]
      ? approvedPairsFromEarlierReview(args["--approval-report"]) : null;
    const priorReviewPairsMatch = earlierApprovedPairs
      ? JSON.stringify(earlierApprovedPairs) === JSON.stringify(selectedPairs) : null;
    const existingTable = (await client.query(
      "SELECT to_regclass('public.unpaid_reward_badge_clinic_pairs') AS table_name"
    )).rows[0].table_name;
    const previousPairs = existingTable ? (await client.query(
      `SELECT collaborator_id, clinic_id FROM unpaid_reward_badge_clinic_pairs ORDER BY collaborator_id, clinic_id`
    )).rows : [];
    const latestActions = selected.length ? (await client.query(
      `SELECT DISTINCT ON (collaborator_id)
              collaborator_id, reward_paid, reward_paid_at
         FROM collaborator_activities
        WHERE collaborator_id = ANY($1::varchar[])
        ORDER BY collaborator_id, due_date DESC NULLS LAST, created_at DESC, id DESC`,
      [selected]
    )).rows : [];
    const latestByPerson = new Map(latestActions.map(row => [row.collaborator_id, row]));
    const badgeVisibleForSelected = selected.filter(id => {
      const latest = latestByPerson.get(id);
      return latest && !(latest.reward_paid && latest.reward_paid_at);
    }).length;
    const selectedWithPaidLatestAction = latestByPerson.size - badgeVisibleForSelected;
    const toHide = people.filter(row => !match.personIds.has(row.id) && row.unpaid_reward_badge_eligible).length;
    const toEnable = people.filter(row => match.personIds.has(row.id) && !row.unpaid_reward_badge_eligible).length;
    const planHash = digest(JSON.stringify({
      database, targets: TARGETS, aliases: [...CLINIC_NAME_ALIASES], pairs: match.pairs,
      unresolvedRows: match.unresolvedRows, selectedPairs,
      previousPairs: previousPairs.map(row => [row.collaborator_id, row.clinic_id]),
      personSnapshot: people.map(row => [
        row.id, row.first_name, row.last_name, row.is_active, row.company_name, row.workplace_name,
        row.clinic_id, row.clinic_ids,
        row.unpaid_reward_badge_eligible,
      ]),
      clinicSnapshot: clinics.map(row => [row.id, row.name, row.pzs_name]),
      assignmentSnapshot: assignments.map(row => [row.person_id, row.entity_id]),
      latestActions: latestActions.map(row => [row.collaborator_id, row.reward_paid, row.reward_paid_at]),
      selected, toHide, toEnable,
    }));
    console.log(JSON.stringify({
      database, targetsInImage: TARGETS.length,
      matchedTargets: match.matchedTargets,
      noMatchingClinic: match.noMatchingClinic,
      noPersonInMatchingClinic: match.noPersonInMatchingClinic,
      targetsWithMultipleLinkedCards: match.targetsWithMultipleLinkedCards,
      targetsWithSeveralClinicRecords: match.targetsWithSeveralClinicRecords,
      matchedViaClinicAlias: match.matchedViaClinicAlias,
      matchedViaCompanyAndClinicLink: match.matchedViaCompanyAndClinicLink,
      uniqueNameButClinicUnverified: match.uniqueNameButClinicUnverified,
      unresolvedTargets: match.unresolvedTargets,
      unresolvedRows: match.unresolvedRows,
      selectedPersonCards: selected.length,
      selectedClinicPairs: selectedPairs.length,
      pairsHash,
      priorReviewPairsMatch,
      selectedWithUnpaidLatestAction: badgeVisibleForSelected,
      selectedWithNoAction: selected.length - latestByPerson.size,
      selectedWithPaidLatestAction,
      collaboratorsInDb: people.length,
      badgeFlagsToHide: toHide, badgeFlagsToEnable: toEnable,
      planHash,
    }, null, 2));
    if (!args.commit) {
      await client.query("ROLLBACK");
      if (args["--report"]) privateBackup(args["--report"], {
        database, createdAt: new Date().toISOString(), planHash, targets: match.details,
      });
      return;
    }
    if (match.matchedTargets !== 28 ||
        JSON.stringify(match.unresolvedRows) !== JSON.stringify(APPROVED_UNRESOLVED_ROWS) ||
        match.matchedViaClinicAlias !== 4 || match.matchedViaCompanyAndClinicLink ||
        !selected.length || !selectedPairs.length || selectedWithPaidLatestAction) {
      fail("Commit refused: expected exactly 28 verified targets, four reviewed aliases, six approved unresolved rows and no paid latest Action");
    }
    if (priorReviewPairsMatch !== true) {
      fail("Commit refused: person-clinic pairs differ from the earlier independent private review");
    }
    if (args["--expect-database"] !== database ||
        args["--expect-targets"] !== "28" ||
        args["--expect-unresolved"] !== "6" ||
        args["--expect-people"] !== String(selected.length) ||
        args["--expect-pairs"] !== String(selectedPairs.length) ||
        args["--confirm-pairs-hash"] !== pairsHash ||
        args["--confirm-hash"] !== planHash) {
      fail("Commit refused: database, target/person/pair counts or confirmed hashes changed");
    }
    privateBackup(args["--backup"], {
      database, planHash, at: new Date().toISOString(),
      previous: people.map(row => ({
        id: row.id, unpaidRewardBadgeEligible: row.unpaid_reward_badge_eligible,
      })),
      previousPairs,
    });
    await client.query(`DELETE FROM unpaid_reward_badge_clinic_pairs`);
    for (const [personId, clinicId] of selectedPairs) {
      await client.query(
        `INSERT INTO unpaid_reward_badge_clinic_pairs (collaborator_id, clinic_id) VALUES ($1, $2)`,
        [personId, clinicId]
      );
    }
    const updated = await client.query(
      `UPDATE collaborators
          SET unpaid_reward_badge_eligible = (id = ANY($1::varchar[]))
        WHERE unpaid_reward_badge_eligible IS DISTINCT FROM (id = ANY($1::varchar[]))`,
      [selected]
    );
    if (updated.rowCount !== toHide + toEnable) fail("Updated count differs from preview; rolling back");
    const savedPairs = (await client.query(
      `SELECT collaborator_id, clinic_id FROM unpaid_reward_badge_clinic_pairs
        ORDER BY collaborator_id, clinic_id`
    )).rows.map(row => [row.collaborator_id, row.clinic_id]);
    if (JSON.stringify(savedPairs) !== JSON.stringify(selectedPairs)) {
      fail("Saved pair set differs from confirmed preview; rolling back");
    }
    await client.query("COMMIT");
    console.log(`Applied ${updated.rowCount} badge visibility changes and ${savedPairs.length} clinic pairs; payment fields unchanged.`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) main().catch(error => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
module.exports = { options, resolveTargetPairs, approvedPairsFromEarlierReview, deriveApprovedPairsFromSnapshot };