"use strict";
// Marker distinguishes cohort selection from independent creation-year counts.
const COHORT = "/* CBC_REPORT_COHORT */ c.cli_inserted >= '20260101' AND c.cli_inserted < '20270101'";
const COLLECTION_COHORT = `EXISTS (
  SELECT 1 FROM dbo.Contracts rc
  JOIN dbo.ContractServices rcs ON rcs.con_id=rc.con_id
  JOIN dbo.ServiceCollections rsc ON rsc.sco_id=rcs.sco_id
  WHERE rc.cli_id=c.cli_id
    AND rsc.sco_collection_made >= '20260101' AND rsc.sco_collection_made < '20270101'
)`;
const REPORTS = Object.freeze({
  new_clients: {
    key: "new_clients", title: "Noví klienti ISCBC 2026", filename: "novi-klienti-2026.xlsx",
    predicate: COHORT,
    selection: "Klienti založení >= 01.01.2026 a < 01.01.2027 podľa Clients.cli_inserted, vrátane klientov bez zmluvy a bez odberu.",
  },
  collection_clients: {
    key: "collection_clients", title: "Klienti s odberom ISCBC 2026", filename: "klienti-s-odberom-2026.xlsx",
    predicate: COLLECTION_COHORT,
    selection: "Všetci klienti s aspoň jedným skutočným odberom >= 01.01.2026 a < 01.01.2027 podľa ServiceCollections.sco_collection_made; rok založenia klienta nerozhoduje.",
  },
});
function reportDefinition(key = "new_clients") {
  if (!Object.hasOwn(REPORTS, key)) {
    throw Object.assign(new Error(), { code: "UNKNOWN_REPORT_SCOPE" });
  }
  return REPORTS[key];
}
function scopedQuery(sql, key = "new_clients") {
  const report = reportDefinition(key);
  if (report.key === "new_clients") return sql;
  return sql.split(COHORT).join(`(${report.predicate})`);
}
function inPeriod(value) {
  return value != null && String(value) >= "2026-01-01" && String(value) < "2027-01-01";
}
module.exports = { COHORT, COLLECTION_COHORT, REPORTS, reportDefinition, scopedQuery, inPeriod };
