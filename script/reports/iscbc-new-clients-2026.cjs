"use strict";

// Standalone operator tool. Never import a migration or the running application.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { COHORT } = require("./iscbc-new-clients-2026-scope.cjs");

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

function parseConfig(source, env) {
  const match = source.match(/^const MSSQL_CONFIG\s*=\s*(\{[\s\S]*?^\});/m);
  if (!match) fail("CONFIG_OBJECT_NOT_FOUND");
  try {
    return vm.runInNewContext(`(${match[1]})`, { process: { env } }, { timeout: 1000 });
  } catch {
    fail("CONFIG_PARSE_FAILED");
  }
}

function loadConfig(root, env = process.env, read = fs.readFileSync) {
  const get = file => parseConfig(read(path.join(root, "script/migration", file), "utf8"), env);
  let cfg = get("sync-collaborators-iscbc.cjs");
  if (cfg.database !== "CBC") fail("CONFIG_DATABASE_MISMATCH");
  if (!cfg.server || !cfg.user) fail("CONFIG_IDENTITY_MISSING");
  if (!cfg.password) {
    const legacy = get("test-migration-20.cjs");
    if (!["server", "port", "user", "database"].every(
      key => String(cfg[key] ?? "") === String(legacy[key] ?? ""),
    )) fail("CONFIG_IDENTITY_MISMATCH");
    cfg = { ...cfg, password: legacy.password };
  }
  if (!cfg.password) fail("CONFIG_PASSWORD_MISSING");
  const options = { ...cfg.options, useUTC: true, readOnlyIntent: true };
  delete options.instanceName;
  return {
    ...cfg, database: "CBC", options, connectionTimeout: 15000,
    requestTimeout: 60000, pool: { max: 1, min: 0, idleTimeoutMillis: 1000 },
  };
}

const SERVICE_SCOPE = `FROM dbo.ContractServices cs
  JOIN dbo.Contracts con ON con.con_id=cs.con_id
  JOIN dbo.Clients c ON c.cli_id=con.cli_id`;

const INSPECTION = [
  ["SOURCE_TIME", `SELECT GETDATE() AS server_wall_time, GETUTCDATE() AS utc_time,
    CONVERT(varchar(40),SERVERPROPERTY('ProductVersion')) AS version,
    (SELECT snapshot_isolation_state FROM sys.databases WHERE name=DB_NAME()) AS snapshot_state`],
  ["COHORT", `SELECT COUNT_BIG(*) AS clients,
    COALESCE(SUM(CONVERT(bigint,x.deleted)),0) AS marked_deleted,
    COALESCE(SUM(CONVERT(bigint,x.no_person)),0) AS no_person,
    COALESCE(SUM(CONVERT(bigint,x.no_contract)),0) AS no_contract,
    COALESCE(SUM(CONVERT(bigint,x.no_collection)),0) AS no_collection
    FROM (
      SELECT c.cli_id, CASE WHEN c.cli_deleted=1 THEN 1 ELSE 0 END AS deleted,
        CASE WHEN c.per_id IS NULL THEN 1 ELSE 0 END AS no_person,
        CASE WHEN NOT EXISTS(SELECT 1 FROM dbo.Contracts con WHERE con.cli_id=c.cli_id)
          THEN 1 ELSE 0 END AS no_contract,
        CASE WHEN NOT EXISTS(SELECT 1 FROM dbo.Contracts con
          JOIN dbo.ContractServices cs ON cs.con_id=con.con_id
          JOIN dbo.ServiceCollections sc ON sc.sco_id=cs.sco_id
          WHERE con.cli_id=c.cli_id)
          THEN 1 ELSE 0 END AS no_collection
      FROM dbo.Clients c WHERE ${COHORT}
    ) x`],
  ["LINK_COUNTS", `SELECT COUNT_BIG(*) AS service_rows,
    COUNT(DISTINCT con.con_id) AS contracts_with_service,
    COUNT(DISTINCT cs.sco_id) AS linked_collection_ids,
    SUM(CONVERT(bigint,CASE WHEN cs.sco_id IS NOT NULL AND sc.sco_id IS NULL THEN 1 ELSE 0 END))
      AS dangling_collection_links
    ${SERVICE_SCOPE}
    LEFT JOIN dbo.ServiceCollections sc ON sc.sco_id=cs.sco_id WHERE ${COHORT}`],
  ["COLLECTION_EVIDENCE", `SELECT st.csu_code,
    CASE WHEN sc.sco_collection_made IS NULL THEN 0 ELSE 1 END AS has_collection_date,
    COUNT_BIG(*) AS collections
    FROM dbo.ServiceCollections sc LEFT JOIN dbo.CollectionStatuses st ON st.csu_id=sc.csu_id
    WHERE EXISTS(SELECT 1 ${SERVICE_SCOPE}
      WHERE ${COHORT} AND cs.sco_id=sc.sco_id)
    GROUP BY st.csu_code,CASE WHEN sc.sco_collection_made IS NULL THEN 0 ELSE 1 END
    ORDER BY st.csu_code,has_collection_date`],
  ["SERVICE_BILLING_REFERENCE", `SELECT DISTINCT c.com_id AS client_company,
    ser.com_id AS service_company,si.sin_id,si.sin_name,ser.ser_name,
    ser.ser_is_collectable,ser.ser_is_storable,
    sii.com_id AS invoicing_company,sii.sii_invoicing_period,
    sii.sii_invoicing_start_dt_field,sii.sii_invoicing_end_dt_field
    ${SERVICE_SCOPE}
    LEFT JOIN dbo.ServiceInstances si ON si.sin_id=cs.sin_id
    LEFT JOIN dbo.Services ser ON ser.ser_id=si.ser_id
    LEFT JOIN dbo.ServiceInstanceInvoicings sii ON sii.sin_id=si.sin_id
    WHERE ${COHORT} ORDER BY c.com_id,si.sin_id,sii.com_id,sii.sii_invoicing_period`],
  ["PAYMENT_TYPE_REFERENCE", `SELECT DISTINCT p.pty_id,p.pty_name,p.pty_installments_count
    ${SERVICE_SCOPE}
    JOIN dbo.ContractServicePayments cp ON cp.cse_id=cs.cse_id
    JOIN dbo.PriceListPayments pl ON pl.plp_id=cp.plp_id
    JOIN dbo.PaymentTypes p ON p.pty_id=pl.pty_id
    WHERE ${COHORT} ORDER BY p.pty_id`],
  ["SCHEDULE_REFERENCE", `SELECT DISTINCT t.sch_id,t.sch_name,
    p.pty_id,p.pty_name,p.pty_installments_count
    ${SERVICE_SCOPE}
    JOIN dbo.HistoryContractServices h ON h.cse_id=cs.cse_id
    JOIN dbo.ContractServiceSchedules s ON s.hcs_id=h.hcs_id
    LEFT JOIN dbo.ScheduleTemplates t ON t.sch_id=s.sch_id
    LEFT JOIN dbo.PriceListPayments pl ON pl.plp_id=t.plp_id
    LEFT JOIN dbo.PaymentTypes p ON p.pty_id=pl.pty_id
    WHERE ${COHORT} ORDER BY t.sch_id,p.pty_id`],
  ["STORAGE_CAMPAIGN_REFERENCE", `SELECT DISTINCT s.scs_id,s.scs_storage_period,
    s.scs_price_multiplier,s.scs_installments
    ${SERVICE_SCOPE}
    JOIN dbo.StorageCampaignServices s ON s.scs_id=cs.scs_id
    WHERE ${COHORT} ORDER BY s.scs_id`],
  ["MODULES_USING_PERIOD", `SELECT SCHEMA_NAME(o.schema_id) AS [schema],o.name,
    o.type_desc
    FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id
    WHERE m.definition LIKE '%sii_invoicing_period%' ORDER BY [schema],o.name`],
  ["EXTRA_NOTE_METADATA", `SELECT t.name AS table_name,c.name AS column_name,
    TYPE_NAME(c.user_type_id) AS data_type
    FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
    WHERE SCHEMA_NAME(t.schema_id)='dbo' AND t.name IN
      ('Certificates','DocumentStateHistories','ExternalDocuments','StorageCampaingRecords',
       'Invoices','Rewards','Rewards3','RewardsCZ','ContractRelations')
    ORDER BY t.name,c.column_id`],
  ["EXCEL_MODULE", null],
];

function safeError(error) {
  const code = /^[A-Z][A-Z0-9_]{0,40}$/.test(error.code || "") ? error.code : "ERROR";
  const number = error.number ?? error.originalError?.info?.number;
  return `CODE=${code}${Number.isInteger(number) ? " SQL_NUMBER=" + number : ""}`;
}

async function inspect(pool, root, output = console.log) {
  let failures = 0;
  for (const [name, query] of INSPECTION) {
    try {
      if (!query) {
        let installed = false;
        try { require.resolve("xlsx", { paths: [root] }); installed = true; } catch {}
        output("EXCEL_MODULE=" + JSON.stringify({ xlsx_available: installed }));
        continue;
      }
      const rows = (await pool.request().query(query)).recordset;
      output(name + "=" + JSON.stringify(rows));
    } catch (error) {
      failures++;
      output(name + "_FAILED " + safeError(error));
    }
  }
  return failures;
}

async function main() {
  let pool, stage = "ARGUMENTS";
  try {
    if (process.argv.length !== 3 || !["--inspect", "--export", "--export-both"].includes(process.argv[2])) fail("USE_INSPECT_OR_EXPORT");
    const root = "/var/www/indexus-crm";
    stage = "OPERATOR_PATH";
    if (fs.realpathSync(process.cwd()) !== root) fail("WRONG_DIRECTORY");
    stage = "MODULE";
    const sql = require(require.resolve("mssql", { paths: [root] }));
    stage = "CONFIG";
    const cfg = loadConfig(root);
    stage = "CONNECTION";
    pool = await new sql.ConnectionPool(cfg).connect();
    if (["--export", "--export-both"].includes(process.argv[2])) {
      stage = "EXPORT";
      const exporter = require("./iscbc-new-clients-2026-export.cjs");
      await exporter.exportReports(pool, root);
      return;
    }
    stage = "INSPECTION";
    const failures = await inspect(pool, root);
    console.log(failures ? "CBC_INSPECTION_INCOMPLETE" : "CBC_INSPECTION_OK");
    if (failures) process.exitCode = 1;
  } catch (error) {
    const detail = /^[A-Za-z0-9_.:]+$/.test(error.reportStage || "") ? ` SECTION=${error.reportStage}` : "";
    const report = /^[a-z_]+$/.test(error.reportKey || "") ? ` REPORT=${error.reportKey}` : "";
    console.error(`CBC_REPORT_FAILED STAGE=${stage}${report}${detail} ${safeError(error)}`);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
}

module.exports = { parseConfig, loadConfig, safeError, inspect, INSPECTION, COHORT };
if (require.main === module) main();
