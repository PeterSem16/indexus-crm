"use strict";

// SQL Server 2008 R2: SELECT-only CTEs, no temp tables or snapshot-setting changes.
const crypto = require("node:crypto");
const { COHORT } = require("./iscbc-new-clients-2026.cjs");
const CTE = `WITH Cohort AS (
  SELECT c.cli_id,c.per_id,c.pot_id,c.com_id FROM dbo.Clients c WHERE ${COHORT}
), Con AS (
  SELECT con.con_id,con.cli_id,con.pot_id FROM dbo.Contracts con
  WHERE con.cli_id IN (SELECT cli_id FROM Cohort)
), CS AS (
  SELECT cs.cse_id,cs.con_id,cs.sin_id,cs.sco_id FROM dbo.ContractServices cs
  WHERE cs.con_id IN (SELECT con_id FROM Con)
), SC AS (
  SELECT sc.sco_id FROM dbo.ServiceCollections sc
  WHERE sc.sco_id IN (SELECT sco_id FROM CS WHERE sco_id IS NOT NULL)
), Pot AS (
  SELECT p.pot_id,p.cnt_id FROM dbo.PotentialClients p
  WHERE p.cli_id IN (SELECT cli_id FROM Cohort)
    OR p.pot_id IN (SELECT pot_id FROM Cohort WHERE pot_id IS NOT NULL)
    OR p.pot_id IN (SELECT pot_id FROM Con WHERE pot_id IS NOT NULL)
)`;
const id = (column, alias = column.split(".").pop()) =>
  `CONVERT(varchar(40),${column}) AS [${alias}]`;
const date = (column, alias = column.split(".").pop()) =>
  `CONVERT(varchar(23),${column},121) AS [${alias}]`;
const inScope = (column, group, key) => `${column} IN (SELECT ${key} FROM ${group})`;
const client = c => inScope(c, "Cohort", "cli_id");
const contract = c => inScope(c, "Con", "con_id");
const service = c => inScope(c, "CS", "cse_id");
const collection = c => inScope(c, "SC", "sco_id");
const potential = c => inScope(c, "Pot", "pot_id");
const history = c => `${c} IN (SELECT h.hcs_id FROM dbo.HistoryContractServices h WHERE ${service("h.cse_id")})`;
const schedule = c => `${c} IN (SELECT sh.csh_id FROM dbo.ContractServiceSchedules sh WHERE ${history("sh.hcs_id")})`;

const DATA = [
  ["clients", `SELECT ${id("c.cli_id")},${id("c.per_id")},${id("c.pot_id")},
    ${id("c.com_id")},c.cli_deleted,${date("c.cli_inserted")},
    p.pda_first_name,p.pda_middle_name,p.pda_last_name,${id("p.pda_id")},
    co.com_country_code,co.com_name
    FROM dbo.Clients c
    LEFT JOIN dbo.PersonalData p ON p.per_id=c.per_id AND p.pda_valid=1
    LEFT JOIN dbo.Companies co ON co.com_id=c.com_id WHERE ${COHORT}`],
  ["contracts", `SELECT ${id("s.con_id")},${id("s.cli_id")},s.con_number,
    st.csa_code,st.csa_default_name,${date("s.con_inserted")},
    ${date("s.con_expected_collection_date")},${date("s.con_cancelled")},
    ${date("s.con_terminated")},ct.cur_code
    FROM dbo.Contracts s LEFT JOIN dbo.ContractStatuses st ON st.csa_id=s.csa_id
    LEFT JOIN dbo.ContractTemplates ct ON ct.cte_id=s.cte_id
    WHERE ${contract("s.con_id")}`],
  ["services", `SELECT ${id("s.cse_id")},${id("s.con_id")},${id("s.sin_id")},
    ${id("s.sco_id")},s.cse_active,s.cse_rollback,s.cse_invoicing_finished,
    ${date("s.cse_inserted")},si.sin_name,ser.ser_name,
    ser.ser_is_collectable,ser.ser_is_storable,ser.ser_sum_to_storage
    FROM dbo.ContractServices s
    LEFT JOIN dbo.ServiceInstances si ON si.sin_id=s.sin_id
    LEFT JOIN dbo.Services ser ON ser.ser_id=si.ser_id
    WHERE ${service("s.cse_id")}`],
  ["collections", `SELECT ${id("s.sco_id")},${id("s.com_id")},
    ${date("s.sco_collection_made")},${date("s.sco_inserted")},
    st.csu_code,st.csu_default_name
    FROM dbo.ServiceCollections s LEFT JOIN dbo.CollectionStatuses st ON st.csu_id=s.csu_id
    WHERE ${collection("s.sco_id")}`],
  ["invoicing", `SELECT ${id("s.sii_id")},${id("s.sin_id")},${id("s.com_id")},
    co.com_name,s.sii_invoicing_period,s.sii_invoicing_start_dt_field,
    s.sii_invoicing_end_dt_field
    FROM dbo.ServiceInstanceInvoicings s LEFT JOIN dbo.Companies co ON co.com_id=s.com_id
    WHERE s.sin_id IN (SELECT sin_id FROM CS)`],
  ["history", `SELECT ${id("s.hcs_id")},${id("s.cse_id")},s.hcs_actual,
    ${date("s.hcs_from")},${date("s.hcs_to")},${date("s.hcs_inserted")}
    FROM dbo.HistoryContractServices s WHERE ${service("s.cse_id")}`],
  ["schedules", `SELECT ${id("s.csh_id")},${id("s.hcs_id")},${id("s.sch_id")},
    s.csh_name,s.csh_preliminary_schedule,${date("s.csh_generate_after")},
    ${date("s.csh_inserted")},t.sch_name AS template_name,
    ${id("p.pty_id")},p.pty_name,p.pty_installments_count
    FROM dbo.ContractServiceSchedules s
    LEFT JOIN dbo.ScheduleTemplates t ON t.sch_id=s.sch_id
    LEFT JOIN dbo.PriceListPayments pl ON pl.plp_id=t.plp_id
    LEFT JOIN dbo.PaymentTypes p ON p.pty_id=pl.pty_id
    WHERE ${schedule("s.csh_id")}`],
  ["installments", `SELECT ${id("s.csy_id")},${id("s.csh_id")},s.csy_name,
    s.csy_installments_id,CONVERT(varchar(80),CONVERT(decimal(19,4),s.csy_amount)) AS amount,
    s.csy_paymentdate_field,s.csy_days_from_field_value,s.csy_days_from_previous,
    ${date("s.csy_inserted")}
    FROM dbo.ContractServiceSchedulePayments s WHERE ${schedule("s.csh_id")}`],
  ["scheduled", `SELECT ${id("s.spa_id")},${id("s.csy_id")},${id("s.inv_id")},
    s.spa_name,s.spa_installments_id,${date("s.spa_date_of_payment")},
    CONVERT(varchar(80),CONVERT(decimal(19,4),s.spa_amount_home)) AS amount,
    i.cur_code_home AS currency
    FROM dbo.ScheduledPayments s LEFT JOIN dbo.Invoices i ON i.inv_id=s.inv_id
    WHERE s.csy_id IN (
      SELECT sp.csy_id FROM dbo.ContractServiceSchedulePayments sp WHERE ${schedule("sp.csh_id")})`],
  ["additional", `SELECT ${id("s.csp_id")},${id("s.cse_id")},${id("p.pty_id")},
    p.pty_name,p.pty_installments_count
    FROM dbo.ContractServicePayments s
    LEFT JOIN dbo.PriceListPayments pl ON pl.plp_id=s.plp_id
    LEFT JOIN dbo.PaymentTypes p ON p.pty_id=pl.pty_id
    WHERE ${service("s.cse_id")}`],
];

// Each table is selected once with EXISTS/IN, never joined to a one-to-many
// attachment. Overlapping note links therefore do not multiply source records.
const NOTES = [];
function notes(table, keys, fields, scope, links, at = null, author = null, deleted = null) {
  NOTES.push({ table, keys, fields, scope, links, at, author, deleted });
}
notes("Clients", ["cli_id"], ["cli_note", "cli_marketing_note"], client("s.cli_id"),
  ["cli_id", "per_id"], "cli_updated", "cli_updated_by", "cli_deleted");
notes("Persons", ["per_id"], ["per_note"], "s.per_id IN (SELECT per_id FROM Cohort)", ["per_id"]);
notes("PotentialClients", ["pot_id"], ["pot_note"], potential("s.pot_id"),
  ["pot_id", "cli_id"], "pot_updated", "pot_updated_by", "pot_deleted");
notes("Contracts", ["con_id"], ["con_note", "CON_TERMINATION_RECEIVED_REASON", "CON_Disposal_Str"],
  contract("s.con_id"), ["con_id", "cli_id"], "con_updated", "con_updated_by");
notes("ContractServices", ["cse_id"], ["cse_note"], service("s.cse_id"),
  ["cse_id", "con_id", "sco_id"], "cse_updated", "cse_updated_by");
notes("ServiceCollections", ["sco_id"], ["sco_note", "sco_doctors_note", "sco_laboratory_note"],
  collection("s.sco_id"), ["sco_id"], "sco_updated", "sco_updated_by");
notes("Remarks", ["rem_id"], ["rem_note"],
  `(${client("s.cli_id")} OR ${contract("s.con_id")} OR ${potential("s.pot_id")}
    OR s.cnt_id IN (SELECT cnt_id FROM Pot WHERE cnt_id IS NOT NULL))`,
  ["cli_id", "con_id", "pot_id", "cnt_id"], "rem_date", "rem_login", "rem_deleted");
notes("HistoryContractServices", ["hcs_id"], ["hcs_note"], service("s.cse_id"),
  ["hcs_id", "cse_id"], "hcs_inserted", "hcs_inserted_by");
notes("HistoryContractServicePayments", ["hsp_id"], ["hsp_note"],
  `s.csp_id IN (SELECT p.csp_id FROM dbo.ContractServicePayments p WHERE ${service("p.cse_id")})`,
  ["hsp_id", "csp_id"], "hsp_inserted", "hsp_inserted_by");
notes("HistoryContractServiceSurcharges", ["hss_id"], ["hss_note"],
  `s.css_id IN (SELECT p.css_id FROM dbo.ContractServiceSurcharges p WHERE ${service("p.cse_id")})`,
  ["hss_id", "css_id"], "hss_inserted", "hss_inserted_by");
notes("ServiceCollectionStateHistories", ["ssh_id"], ["ssh_note"], collection("s.sco_id"),
  ["sco_id"], "ssh_changed", "ssh_changed_by");
notes("ContractStateHistories", ["nsh_id"], ["nsh_note"], contract("s.con_id"),
  ["con_id"], "nsh_changed", "nsh_changed_by");
notes("ContractFormStateHistories", ["osh_id"], ["osh_note"], contract("s.con_id"),
  ["con_id"], "osh_changed", "osh_changed_by");
notes("ContractDocuments", ["cdo_id"], ["cdo_note"], contract("s.con_id"),
  ["con_id", "cdo_id"], "cdo_inserted", "cdo_inserted_by");
notes("DocumentStateHistories", ["dsh_id"], ["dsh_note"],
  `s.cdo_id IN (SELECT d.cdo_id FROM dbo.ContractDocuments d WHERE ${contract("d.con_id")})`,
  ["cdo_id"], "dsh_changed", "dsh_changed_by");
notes("ExternalDocuments", ["edo_id"], ["edo_note"], contract("s.con_id"),
  ["con_id"], "edo_inserted", "edo_inserted_by");
notes("Amendments", ["ame_id"], ["ame_note"], contract("s.con_id"),
  ["con_id", "ame_id"], "ame_inserted", "ame_inserted_by");
notes("AmendmentStateHistories", ["ash_id"], ["ash_note"],
  `s.ame_id IN (SELECT a.ame_id FROM dbo.Amendments a WHERE ${contract("a.con_id")})`,
  ["ame_id"], "ash_changed", "ash_changed_by");
notes("Certificates", ["cer_id"], ["cer_note"], collection("s.sco_id"),
  ["sco_id"], "cer_inserted", "cer_inserted_by");
notes("ContractsPersons", ["con_id", "per_id", "pcr_id"], ["cop_note"], contract("s.con_id"),
  ["con_id", "per_id"]);
notes("ContractRelations", ["con_id", "con_id_related", "ccr_id"], ["crs_note"],
  `(${contract("s.con_id")} OR ${contract("s.con_id_related")})`, ["con_id", "con_id_related"]);
notes("MergedClients", ["mer_id"], ["mer_note"],
  `(${client("s.cli_id_new")} OR ${client("s.cli_id_old")})`,
  ["cli_id_new", "cli_id_old"], "mer_merged", "mer_merged_by");
notes("StorageCampaingRecords", ["scr_id"], ["scr_note"],
  `(${client("s.cli_id")} OR ${contract("s.con_id")})`,
  ["cli_id", "con_id"], "scr_inserted", "scr_inserted_by");
notes("CollectionAnnouncements", ["can_id"], ["can_note"], collection("s.sco_id"),
  ["sco_id", "can_client_id"], "can_updated", "can_updated_by", "can_deleted");
notes("CollectionTransports", ["ctr_id"], ["ctr_note"],
  `s.ctr_id IN (SELECT a.ctr_id FROM dbo.CollectionAnnouncements a
    WHERE ${collection("a.sco_id")} AND ISNULL(a.can_deleted,0)<>1)`,
  ["ctr_id"], "ctr_updated", "ctr_updated_by");
notes("Prepayments", ["pre_id"], ["pre_note"], contract("s.con_id"),
  ["con_id"], "pre_date_of_payment");
notes("Invoices", ["inv_id"], ["inv_note", "inv_bsp_note"], service("s.cse_id"),
  ["cse_id"], "inv_updated", "inv_updated_by");
notes("ScheduledPayments", ["spa_id"], ["spa_note"],
  `(s.csy_id IN (SELECT p.csy_id FROM dbo.ContractServiceSchedulePayments p WHERE ${schedule("p.csh_id")})
    OR s.inv_id IN (SELECT i.inv_id FROM dbo.Invoices i WHERE ${service("i.cse_id")}))`,
  ["csy_id", "inv_id"], "spa_updated", "spa_updated_by");
for (const table of ["Rewards", "Rewards3", "RewardsCZ"]) {
  notes(table, ["rew_id"], ["rew_remark", "rew_remark_old"],
    `(${contract("s.con_id")} OR ${collection("s.sco_id")})`, ["con_id", "sco_id"]);
}
notes("Reward.ActRemarks", ["rar_id"], ["rar_remark"],
  `s.rac_id IN (SELECT a.rac_id FROM Reward.Acts a
    WHERE ${contract("a.con_id_bound")} OR ${collection("a.sco_id_bound")})`,
  ["rac_id"], "rar_date", "rar_login", "rar_deleted");

function quotedTable(table) {
  return table.split(".").map(p => `[${p}]`).join(".");
}
// Explicitly verified source columns. ScheduledPayments has only spa_updated
// and spa_updated_by; a common suffix does not prove inserted fields exist.
const UPDATED_WITH_INSERTED = new Set([
  "Clients", "PotentialClients", "Contracts", "ContractServices",
  "ServiceCollections", "CollectionAnnouncements", "CollectionTransports", "Invoices",
]);
// Reuse the exact cohort scope for attribution, including indirect/shared
// links. Do not infer ownership from a similarly named, unverified ID column.
function clientScope(scope) {
  const sources = {
    Cohort: key => `SELECT nc.${key}`,
    Con: key => `SELECT oc.${key} FROM dbo.Contracts oc WHERE oc.cli_id=nc.cli_id`,
    CS: key => `SELECT os.${key} FROM dbo.ContractServices os
      JOIN dbo.Contracts oc ON oc.con_id=os.con_id WHERE oc.cli_id=nc.cli_id`,
    SC: key => `SELECT sc.${key} FROM dbo.ServiceCollections sc WHERE sc.sco_id IN (
      SELECT os.sco_id FROM dbo.ContractServices os JOIN dbo.Contracts oc ON oc.con_id=os.con_id
      WHERE oc.cli_id=nc.cli_id AND os.sco_id IS NOT NULL)`,
    Pot: key => `SELECT op.${key} FROM dbo.PotentialClients op WHERE
      (op.cli_id=nc.cli_id OR op.pot_id=nc.pot_id OR op.pot_id IN (
        SELECT oc.pot_id FROM dbo.Contracts oc WHERE oc.cli_id=nc.cli_id AND oc.pot_id IS NOT NULL))`,
  };
  const result = scope.replace(/SELECT (\w+) FROM (Cohort|Con|CS|SC|Pot)\b(?: WHERE (\w+) IS NOT NULL)?/g,
    (_, key, source, nonnull) => sources[source](key) +
      (nonnull ? ` AND ${source === "Pot" ? "op" : "nc"}.${nonnull} IS NOT NULL` : ""));
  if (/\bFROM (Cohort|Con|CS|SC|Pot)\b/.test(result)) {
    throw Object.assign(new Error(), { code: "UNMAPPED_NOTE_CLIENT_SCOPE" });
  }
  return result;
}
function noteQuery(spec, counts = false) {
  const active = spec.deleted ? `ISNULL(s.[${spec.deleted}],0)<>1` : "1=1";
  const nonempty = f => `s.[${f}] IS NOT NULL AND
    LEN(LTRIM(RTRIM(CONVERT(nvarchar(max),s.[${f}]))))>0`;
  if (counts) {
    return `${CTE} SELECT ${spec.fields.flatMap((f, i) => [
      `COALESCE(SUM(CONVERT(bigint,CASE WHEN (${nonempty(f)}) AND (${active}) THEN 1 ELSE 0 END)),0) AS n${i}`,
      `COALESCE(SUM(CONVERT(bigint,CASE WHEN (${nonempty(f)}) AND NOT (${active}) THEN 1 ELSE 0 END)),0) AS d${i}`,
    ]).join(",")} FROM ${quotedTable(spec.table)} s WHERE ${spec.scope}`;
  }
  const columns = [...new Set([...spec.keys, ...spec.links])].map(k => id(`s.[${k}]`, k));
  columns.push(`STUFF((SELECT ','+CONVERT(varchar(40),nc.cli_id) FROM Cohort nc
    WHERE (${clientScope(spec.scope)}) ORDER BY nc.cli_id
    FOR XML PATH(''),TYPE).value('.','varchar(max)'),1,1,'') AS _clients`);
  columns.push(...spec.fields.map(f => `CONVERT(nvarchar(max),s.[${f}]) AS [${f}]`));
  const fallback = spec.at?.endsWith("_updated") && UPDATED_WITH_INSERTED.has(spec.table) ?
    spec.at.replace(/_updated$/, "_inserted") : null;
  columns.push(spec.at ? date(fallback ?
    `COALESCE(s.[${spec.at}],s.[${fallback}])` : `s.[${spec.at}]`, "_at") :
    "CAST(NULL AS varchar(23)) AS _at");
  columns.push(spec.at ?
    (fallback ? `CASE WHEN s.[${spec.at}] IS NULL THEN '${fallback}' ELSE '${spec.at}' END AS _dateField` :
      `'${spec.at}' AS _dateField`) : "CAST(NULL AS varchar(80)) AS _dateField");
  columns.push(spec.author ? (fallback ?
    `CASE WHEN s.[${spec.at}] IS NULL THEN s.[${spec.author.replace(/_updated_by$/, "_inserted_by")}]
      ELSE s.[${spec.author}] END AS _author` : `s.[${spec.author}] AS _author`) :
    "CAST(NULL AS varchar(80)) AS _author");
  return `${CTE} SELECT ${columns.join(",")} FROM ${quotedTable(spec.table)} s
    WHERE (${spec.scope}) AND (${active}) AND
    (${spec.fields.map(f => `(${nonempty(f)})`).join(" OR ")})`;
}

function digest(rows) {
  const sorted = rows.map(row => JSON.stringify(Object.keys(row).sort().map(k => [k, row[k]]))).sort();
  const hash = crypto.createHash("sha256");
  for (const row of sorted) hash.update(String(Buffer.byteLength(row))).update(":").update(row);
  return hash.digest("hex");
}
function hasNote(text) {
  // Match SQL LEN/LTRIM/RTRIM semantics without trimming exported content.
  return text != null && String(text).replace(/^ +| +$/g, "").length > 0;
}
async function readAll(pool, progress = () => {}) {
  const result = { data: {}, notes: [], fingerprints: {} };
  async function query(name, sql) {
    progress(name);
    try { return (await pool.request().query(sql)).recordset; }
    catch (error) { error.reportStage = name; throw error; }
  }
  for (const [name, sql] of DATA) {
    const rows = await query(name, `${CTE} ${sql}`);
    result.data[name] = rows;
    result.fingerprints[name] = digest(rows);
  }
  for (const spec of NOTES) {
    const count = (await query(`count:${spec.table}`, noteQuery(spec, true)))[0];
    const rows = await query(`notes:${spec.table}`, noteQuery(spec));
    spec.fields.forEach((field, i) => {
      const actual = rows.filter(row => hasNote(row[field])).length;
      if (actual !== Number(count[`n${i}`])) {
        throw Object.assign(new Error(), { code: "NOTE_COUNT_MISMATCH", reportStage: spec.table });
      }
    });
    result.notes.push({ spec, rows, counts: count });
    result.fingerprints[`notes:${spec.table}`] = digest(rows);
    result.fingerprints[`counts:${spec.table}`] = digest([count]);
  }
  return result;
}

module.exports = { CTE, DATA, NOTES, noteQuery, clientScope, hasNote, digest, readAll };
