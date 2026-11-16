"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { CTE, readAll } = require("./iscbc-new-clients-2026-source.cjs");
const { INSPECTION } = require("./iscbc-new-clients-2026.cjs");
const { buildModel, makeWorkbook, verifyWorkbook, check } = require("./iscbc-new-clients-2026-workbook.cjs");

const COUNTS = `${CTE} SELECT
  (SELECT COUNT_BIG(*) FROM Cohort) AS clients,
  (SELECT COUNT_BIG(*) FROM Con) AS contracts,
  (SELECT COUNT_BIG(*) FROM CS) AS services,
  (SELECT COUNT_BIG(*) FROM SC) AS collections`;
const ANNOUNCEMENT_CANDIDATES = `${CTE} SELECT COUNT_BIG(*) AS unverified_note_links
  FROM dbo.CollectionAnnouncements s
  WHERE s.can_client_id IN (SELECT cli_id FROM Cohort)
    AND (s.sco_id IS NULL OR s.sco_id NOT IN (SELECT sco_id FROM SC))
    AND ISNULL(s.can_deleted,0)<>1
    AND s.can_note IS NOT NULL AND LEN(LTRIM(RTRIM(CONVERT(nvarchar(max),s.can_note))))>0`;
const SOURCE_TIME = `SELECT CONVERT(varchar(23),GETUTCDATE(),121) AS utc_time,
  CONVERT(varchar(23),GETDATE(),121) AS source_wall_time`;
const COHORT_COUNTS = INSPECTION.find(([name]) => name === "COHORT")[1];

function equalCounts(first, second) {
  return Object.keys(first).length === Object.keys(second).length &&
    Object.keys(first).every(k => String(first[k]) === String(second[k]));
}
function validateCounts(model, counts, cohort) {
  for (const key of ["clients", "contracts", "services", "collections"]) {
    check(model.stats[key] === Number(counts[key]), "SOURCE_COUNT_MISMATCH");
  }
  for (const key of ["clients", "marked_deleted", "no_contract", "no_collection"]) {
    check(model.stats[key] === Number(cohort[key]), "COHORT_COUNT_MISMATCH");
  }
}
function privateOutput(home = os.homedir()) {
  const dir = fs.mkdtempSync(path.join(home, "iscbc-clients-2026-"));
  fs.chmodSync(dir, 0o700);
  check((fs.statSync(dir).mode & 0o777) === 0o700, "PRIVATE_DIRECTORY_MODE");
  return { dir, partial: path.join(dir, "report.partial.xlsx"), file: path.join(dir, "klienti-2026.xlsx") };
}
async function exportReport(pool, root, output = console.log, options = {}) {
  const XLSX = require(require.resolve("xlsx", { paths: [root] }));
  let files;
  async function single(query, name) {
    try { return (await pool.request().query(query)).recordset[0]; }
    catch (error) { error.reportStage = name; throw error; }
  }
  try {
    const start = await single(SOURCE_TIME, "SOURCE_TIME");
    const counts = await single(COUNTS, "SOURCE_COUNTS");
    const cohort = await single(COHORT_COUNTS, "COHORT_COUNTS");
    const uncertain = await single(ANNOUNCEMENT_CANDIDATES, "UNVERIFIED_ANNOUNCEMENTS");
    output("CBC_EXPORT_READ_STARTED");
    const extraction = await readAll(pool, name => output("READ=" + name));
    const model = buildModel(extraction);
    validateCounts(model, counts, cohort);
    output("CBC_EXPORT_SECOND_READ_STARTED");
    const verification = await readAll(pool);
    check(equalCounts(extraction.fingerprints, verification.fingerprints), "SOURCE_CHANGED_RETRY_EXPORT");
    const finalCounts = await single(COUNTS, "FINAL_COUNTS");
    const finalCohort = await single(COHORT_COUNTS, "FINAL_COHORT");
    const finalUncertain = await single(ANNOUNCEMENT_CANDIDATES, "FINAL_ANNOUNCEMENTS");
    check(equalCounts(counts, finalCounts) && equalCounts(cohort, finalCohort) &&
      equalCounts(uncertain, finalUncertain), "SOURCE_CHANGED_RETRY_EXPORT");
    const end = await single(SOURCE_TIME, "FINAL_TIME");
    const utc = new Date(end.utc_time.replace(" ", "T") + "Z");
    check(Number.isFinite(utc.getTime()), "INVALID_EXTRACTION_TIME");
    const countries = new Map();
    for (const c of extraction.data.clients) {
      const key = `${c.com_country_code || "NEURČENÁ"} / ${c.com_name || "NEURČENÁ"}`;
      countries.set(key, (countries.get(key) || 0) + 1);
    }
    const warnings = [
      "Bez potvrdeného dátumu objednania; tento stĺpec je prázdny.",
      "Zrušená zmluva nie je sama osebe dôkazom zrušenia odberu.",
      "Očakávaný termín je zo zmluvy, nie samostatné plánovanie každého odberu.",
      "Nepriradené poznámky bez preukázanej väzby nemožno pripísať klientovi.",
      `Oznámenia s neoverenou väzbou cez can_client_id, bez väzby na odber: ${Number(uncertain.unverified_note_links)}.`,
      "Textové poznámky zostali úplné; môžu prirodzene obsahovať osobné údaje. Súbor uchovávajte súkromne.",
    ];
    const metadata = {
      utc: `${start.utc_time} UTC až ${end.utc_time} UTC`,
      bratislava: new Intl.DateTimeFormat("sk-SK", {
        timeZone: "Europe/Bratislava", dateStyle: "medium", timeStyle: "long",
      }).format(utc),
      limitations: warnings.join(" "),
      countries: [...countries].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k}: ${n}`).join("; "),
    };
    const { wb, expected } = makeWorkbook(XLSX, model, metadata);
    output("CBC_EXPORT_WORKBOOK_VALIDATING");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true });
    verifyWorkbook(XLSX, buffer, expected);
    files = privateOutput(options.home);
    const fd = fs.openSync(files.partial, "wx", 0o600);
    try { fs.writeFileSync(fd, buffer); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    check((fs.statSync(files.partial).mode & 0o777) === 0o600, "PRIVATE_FILE_MODE");
    const disk = fs.readFileSync(files.partial);
    check(disk.equals(buffer), "DISK_CONTENT_MISMATCH");
    fs.renameSync(files.partial, files.file);
    output("EXTRACTION_UTC=" + metadata.utc);
    output("COUNTRIES=" + JSON.stringify([...countries].sort(([a], [b]) => a.localeCompare(b))));
    output("COUNTS=" + JSON.stringify(model.stats));
    output("UNVERIFIED_ANNOUNCEMENT_NOTE_LINKS=" + Number(uncertain.unverified_note_links));
    for (const control of model.controls) {
      output(`NOTE_COUNTS=${control.source}.${control.field}:source=${control.expected},exported=${control.exported},deleted_excluded=${control.excluded}`);
    }
    output("SHA256=" + crypto.createHash("sha256").update(disk).digest("hex"));
    output("PRIVATE_FILE=" + files.file);
    output("CBC_REPORT_OK");
    return { file: files.file, stats: model.stats };
  } catch (error) {
    if (files) {
      for (const file of [files.partial, files.file]) {
        try { fs.unlinkSync(file); } catch (e) { if (e.code !== "ENOENT") error.code = "PRIVATE_CLEANUP_FAILED"; }
      }
      try { fs.rmdirSync(files.dir); } catch {}
    }
    throw error;
  }
}
module.exports = { exportReport, validateCounts, privateOutput, equalCounts, COUNTS, COHORT_COUNTS, ANNOUNCEMENT_CANDIDATES };
