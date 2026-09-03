#!/usr/bin/env node
/**
 * Replace a collaborator update campaign's recipients with:
 *   - all collaborators from the workbook's email sheet, and
 *   - collaborators matched by the workbook's unique DPP agreement numbers.
 *
 * Overlapping collaborators are inserted only once. The default is dry-run;
 * --commit is required for the transactional delete-and-recreate operation.
 *
 * Examples:
 *   node scripts/reset-collaborator-update-campaign-from-excel.cjs \
 *     --xlsx /tmp/emailspolupracovniciCZ2026.xlsx \
 *     --campaign-name "JMHZ kama na update udajov"
 *
 *   node scripts/reset-collaborator-update-campaign-from-excel.cjs \
 *     --xlsx /tmp/emailspolupracovniciCZ2026.xlsx \
 *     --campaign-id <campaign-id> \
 *     --commit
 */

const crypto = require("crypto");
const fs = require("fs");
const xlsx = require("xlsx");
const { Pool } = require("pg");

const EMAIL_SHEET = "149 s emailovou adresou";
const DPP_SHEET = "Iba DPP";
const COMMIT = process.argv.includes("--commit");

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeEmail(value) {
  return text(value).toLowerCase().replace(/\s+/g, "");
}

function normalizeId(value) {
  return text(value).replace(/\.0+$/, "");
}

function normalizeDpp(value) {
  const raw = text(value).toUpperCase().replace(/\s+/g, " ");
  const match = raw.match(/^DPP\s*[-:/]?\s*(\d+)$/);
  return match ? `DPP ${String(Number(match[1]))}` : raw;
}

function firstEmailFromRow(row) {
  return Object.values(row)
    .map(value => normalizeEmail(value))
    .find(value => value.includes("@")) || "";
}

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = process.env.CRM_ENV_FILE || "/var/www/indexus-crm/.env";
  if (!fs.existsSync(envPath)) {
    throw new Error(`DATABASE_URL is not set and env file was not found: ${envPath}`);
  }
  const line = fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find(value => value.startsWith("DATABASE_URL="));
  if (!line) throw new Error(`DATABASE_URL was not found in ${envPath}`);
  let value = line.slice("DATABASE_URL=".length).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

function loadWorkbook(inputPath) {
  if (!fs.existsSync(inputPath)) throw new Error(`Excel file was not found: ${inputPath}`);
  const workbook = xlsx.readFile(inputPath, { cellDates: false });
  for (const sheet of [EMAIL_SHEET, DPP_SHEET]) {
    if (!workbook.SheetNames.includes(sheet)) {
      throw new Error(`Required sheet "${sheet}" was not found`);
    }
  }
  const rows = sheet => xlsx.utils.sheet_to_json(workbook.Sheets[sheet], {
    defval: "",
    raw: false,
  });

  const emailRows = rows(EMAIL_SHEET).map((row, index) => ({
    excelRow: index + 2,
    legacyId: normalizeId(row["ID spolupracovíka"] || row["ID spolupracovníka"]),
    name: text(row["Plné meno"]),
    email: normalizeEmail(row.Email),
  })).filter(row => row.legacyId || row.email);

  const dppRows = rows(DPP_SHEET).map((row, index) => ({
    excelRow: index + 2,
    agreement: text(row["Dohoda"] || row["ID spolupracovníka"]),
    dppKey: normalizeDpp(row["Dohoda"] || row["ID spolupracovníka"]),
    excelEmail: firstEmailFromRow(row),
  })).filter(row => row.dppKey);

  const uniqueDppRows = new Map();
  for (const row of dppRows) {
    if (!uniqueDppRows.has(row.dppKey)) uniqueDppRows.set(row.dppKey, row);
  }

  return {
    emailRows,
    dppRows: [...uniqueDppRows.values()],
  };
}

function countryToLanguage(countryCode) {
  switch (text(countryCode).toUpperCase()) {
    case "SK": return "sk";
    case "CZ": return "cs";
    case "HU": return "hu";
    case "RO": return "ro";
    case "IT":
    case "CH": return "it";
    case "DE":
    case "AT": return "de";
    default: return "en";
  }
}

function displayName(row) {
  return [row.title_before, row.first_name, row.last_name, row.title_after]
    .filter(Boolean)
    .join(" ");
}

async function findCampaign(pool, campaignId, campaignName) {
  if (campaignId) {
    const result = await pool.query(
      `SELECT id, name, status, language, token_valid_days, filter_criteria
         FROM collaborator_update_campaigns
        WHERE id = $1`,
      [campaignId],
    );
    return result.rows;
  }
  if (!campaignName) {
    throw new Error("Provide --campaign-id or --campaign-name");
  }
  const result = await pool.query(
    `SELECT id, name, status, language, token_valid_days, filter_criteria
       FROM collaborator_update_campaigns
      WHERE LOWER(name) = LOWER($1)`,
    [campaignName],
  );
  return result.rows;
}

async function loadRecipients(pool, workbook) {
  if (workbook.emailRows.length !== 149) {
    throw new Error(`Expected 149 email-sheet rows, got ${workbook.emailRows.length}`);
  }
  if (workbook.dppRows.length !== 8) {
    throw new Error(`Expected 8 unique DPP numbers, got ${workbook.dppRows.length}`);
  }

  const emailIds = [...new Set(workbook.emailRows.map(row => row.legacyId).filter(Boolean))];
  if (emailIds.length !== 149) {
    throw new Error(`Expected 149 unique email-sheet IDs, got ${emailIds.length}`);
  }

  const collaboratorsResult = await pool.query(
    `SELECT id, legacy_id, title_before, first_name, last_name, title_after,
            email, country_code
       FROM collaborators
      WHERE legacy_id = ANY($1::text[])`,
    [emailIds],
  );
  const byLegacyId = new Map();
  for (const row of collaboratorsResult.rows) {
    const key = normalizeId(row.legacy_id);
    if (!byLegacyId.has(key)) byLegacyId.set(key, []);
    byLegacyId.get(key).push(row);
  }

  const recipients = new Map();
  const problems = [];
  for (const input of workbook.emailRows) {
    const matches = byLegacyId.get(input.legacyId) || [];
    if (matches.length !== 1) {
      problems.push(`email sheet row ${input.excelRow}, ID ${input.legacyId}: ${matches.length === 0 ? "NOT_FOUND" : "MULTIPLE_DB_ROWS"}`);
      continue;
    }
    const row = matches[0];
    if (!row.email || !normalizeEmail(row.email)) {
      problems.push(`email sheet row ${input.excelRow}, ID ${input.legacyId}: DB_EMAIL_MISSING`);
      continue;
    }
    if (normalizeEmail(row.email) !== input.email) {
      problems.push(`email sheet row ${input.excelRow}, ID ${input.legacyId}: DB_EMAIL_MISMATCH`);
      continue;
    }
    recipients.set(row.id, row);
  }

  const dppResult = await pool.query(
    `SELECT ca.contract_number, c.id, c.legacy_id, c.title_before,
            c.first_name, c.last_name, c.title_after, c.email, c.country_code
       FROM collaborator_agreements ca
       JOIN collaborators c ON c.id = ca.collaborator_id
      WHERE ca.contract_number IS NOT NULL
        AND UPPER(TRIM(ca.contract_number)) LIKE 'DPP %'`,
  );
  const agreementsByKey = new Map();
  for (const row of dppResult.rows) {
    const key = normalizeDpp(row.contract_number);
    if (!agreementsByKey.has(key)) agreementsByKey.set(key, []);
    agreementsByKey.get(key).push(row);
  }

  let dppOverlap = 0;
  const dppCollaboratorIds = new Set();
  for (const input of workbook.dppRows) {
    const agreementRows = agreementsByKey.get(input.dppKey) || [];
    if (agreementRows.length === 0) {
      problems.push(`DPP ${input.agreement}: AGREEMENT_NOT_FOUND`);
      continue;
    }
    const uniquePeople = new Map(agreementRows.map(row => [row.id, row]));
    for (const row of uniquePeople.values()) {
      dppCollaboratorIds.add(row.id);
      if (!row.email || !normalizeEmail(row.email)) {
        problems.push(`DPP ${input.agreement}, ID ${row.legacy_id}: DB_EMAIL_MISSING`);
        continue;
      }
      if (recipients.has(row.id)) {
        dppOverlap++;
      } else {
        recipients.set(row.id, row);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`Recipient validation failed:\n${problems.map(problem => `  ${problem}`).join("\n")}`);
  }
  if (recipients.size !== 154) {
    throw new Error(`Expected 154 unique recipients, got ${recipients.size}`);
  }

  return {
    recipients: [...recipients.values()].sort((a, b) =>
      String(a.legacy_id).localeCompare(String(b.legacy_id), undefined, { numeric: true })
    ),
    dppPeople: dppCollaboratorIds.size,
    dppOverlap,
  };
}

function makeInsertQuery(rows, campaignId, expiresAt, campaignLanguage) {
  const params = [];
  const values = rows.map((row, index) => {
    const offset = index * 6;
    const language = campaignLanguage && campaignLanguage !== "auto"
      ? campaignLanguage
      : countryToLanguage(row.country_code);
    params.push(
      campaignId,
      row.id,
      crypto.randomBytes(24).toString("base64url"),
      row.email,
      language,
      expiresAt,
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
  });
  return {
    sql: `INSERT INTO collaborator_update_requests
            (campaign_id, collaborator_id, token, email, language, expires_at)
          VALUES ${values.join(", ")}`,
    params,
  };
}

async function main() {
  const inputPath = argument("--xlsx");
  if (!inputPath) throw new Error("Missing --xlsx argument");

  const campaignId = argument("--campaign-id");
  const campaignName = argument("--campaign-name");
  const workbook = loadWorkbook(inputPath);
  const pool = new Pool({ connectionString: readDatabaseUrl() });

  try {
    const campaigns = await findCampaign(pool, campaignId, campaignName);
    if (campaigns.length !== 1) {
      if (campaigns.length === 0 && !campaignId) {
        const suggestions = await pool.query(
          `SELECT id, name, status
             FROM collaborator_update_campaigns
            WHERE name ILIKE '%JMHZ%'
            ORDER BY created_at DESC`,
        );
        const detail = suggestions.rows.length > 0
          ? suggestions.rows.map(row => `  ${row.id} | ${row.name} | ${row.status}`).join("\n")
          : "  No JMHZ campaign candidates found";
        throw new Error(`Campaign was not found by exact name.\n${detail}`);
      }
      throw new Error(`Expected exactly one campaign, found ${campaigns.length}`);
    }

    const campaign = campaigns[0];
    if (campaign.status === "sending") {
      throw new Error("Campaign is currently sending; reset was not started");
    }

    const { recipients, dppPeople, dppOverlap } = await loadRecipients(pool, workbook);
    const existingCountResult = await pool.query(
      `SELECT count(*)::int AS count
         FROM collaborator_update_requests
        WHERE campaign_id = $1`,
      [campaign.id],
    );
    const existingCount = existingCountResult.rows[0].count;
    const expiresAt = new Date(
      Date.now() + (Number(campaign.token_valid_days) || 30) * 24 * 3600 * 1000,
    );
    const legacyIds = recipients.map(row => String(row.legacy_id));

    console.log(`Režim: ${COMMIT ? "COMMIT (ostrý reset)" : "DRY-RUN (nič sa nezapíše)"}`);
    console.log(`Kampaň: ${campaign.id} | ${campaign.name} | status=${campaign.status}`);
    console.log(`Pôvodných requestov: ${existingCount}`);
    console.log(`Email sheet: ${workbook.emailRows.length} kontaktov`);
    console.log(`DPP: ${workbook.dppRows.length} dohôd, ${dppPeople} osôb, ${dppOverlap} prekrývajúcich sa`);
    console.log(`Nových unikátnych requestov: ${recipients.length}`);
    console.log(`Expirácia nových odkazov: ${expiresAt.toISOString()}`);

    if (!COMMIT) return;

    const filterCriteria = { legacyIds: legacyIds.join(",") };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        `SELECT id, status, language, token_valid_days
           FROM collaborator_update_campaigns
          WHERE id = $1
          FOR UPDATE`,
        [campaign.id],
      );
      if (locked.rows.length !== 1) throw new Error("Campaign disappeared before reset");
      if (locked.rows[0].status === "sending") {
        throw new Error("Campaign started sending before reset; no changes committed");
      }

      await client.query(
        `DELETE FROM collaborator_update_requests WHERE campaign_id = $1`,
        [campaign.id],
      );

      for (let start = 0; start < recipients.length; start += 100) {
        const batch = recipients.slice(start, start + 100);
        const insert = makeInsertQuery(
          batch,
          campaign.id,
          expiresAt,
          locked.rows[0].language,
        );
        await client.query(insert.sql, insert.params);
      }

      await client.query(
        `UPDATE collaborator_update_campaigns
            SET filter_criteria = $1::jsonb, updated_at = now()
          WHERE id = $2`,
        [JSON.stringify(filterCriteria), campaign.id],
      );
      await client.query("COMMIT");
      console.log(`Reset dokončený: vytvorených ${recipients.length} nových requestov`);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});