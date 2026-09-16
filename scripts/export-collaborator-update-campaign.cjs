#!/usr/bin/env node
/**
 * Read-only export of a collaborator Data Update campaign.
 *
 * The workbook contains:
 *   - persons: all non-secret columns from collaborators
 *   - campaign_requests: one row per campaign request
 *   - field_audit: every field submitted through the campaign
 *   - campaign_changes: only fields recorded as changed by the form
 *   - field_snapshots: contact_field_snapshots rows for this campaign
 *   - addresses: all collaborator address rows
 *   - other_data: collaborator_other_data rows
 *   - summary and README
 *
 * It deliberately does not export request tokens or password hashes.
 *
 * Usage on CORPCRM01:
 *   node scripts/export-collaborator-update-campaign.cjs \
 *     --campaign-name "JMHZ kaman na update udajov" \
 *     --output /tmp/jmhz-campaign-export.xlsx
 *
 * Or:
 *   node scripts/export-collaborator-update-campaign.cjs \
 *     --campaign-id <campaign-id> \
 *     --output /tmp/campaign-export.xlsx
 *
 * DATABASE_URL may be supplied in the environment. Otherwise the script
 * reads only DATABASE_URL from CRM_ENV_FILE or /var/www/indexus-crm/.env.
 * The database transaction is explicitly read-only.
 */

const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const { Pool } = require("pg");

const EDUCATION_TO_CARD_VALUE = {
  "Bez vzdělání": "A",
  "Neúplné základní vzdělání": "B",
  "Základní vzdělání": "C",
  "Nižší střední vzdělání": "D",
  "Nižší střední odborné vzdělání": "E",
  "Střední odborné vzdělání s výučním listem": "H",
  "Střední nebo střední odborné vzdělání bez maturity a výučního listu": "J",
  "Úplné střední všeobecné vzdělání": "K",
  "Úplné střední odborné vzdělání s vyučením i maturitou": "L",
  "Úplné střední odborné vzdělání s maturitou (bez vyučení)": "M",
  "Vyšší odborné vzdělání": "N",
  "Vyšší odborné vzdělání v konzervatoři": "P",
  "Vysokoškolské bakalářské vzdělání": "R",
  "Vysokoškolské magisterské vzdělání": "T",
  "Vysokoškolské doktorské vzdělání": "V",
};

const PROFESSION_TO_CARD_VALUE = {
  "Lékaři v gynekologii a porodnictví (specialisté)": "gynecology_specialists",
  "Všeobecní lékaři (lékaři v přípravě/absolventi)": "general_practitioners",
  "Primáři v oblasti zdravotnictví": "chief_physicians",
  "Vedoucí lékaři a ředitelé zdravotnických zařízení": "medical_directors",
  "Porodní asistentky se specializací": "specialized_midwives",
  "Staniční sestry (porodní asistentky)": "charge_midwives",
  "Porodní asistentky bez specializace": "midwives_no_specialization",
  "Vrchní a staniční sestry (všeobecné sestry)": "head_nurses",
  "Sestry pro péči v chirurgických oborech": "surgical_nurses",
  "Všeobecné sestry bez specializace": "general_nurses_no_spec",
  "Sestry pro péči v interních oborech": "internal_medicine_nurses",
  "Praktické sestry (dříve zdravotničtí asistenti)": "practical_nurses",
  "Ošetřovatelé ve zdravotnických zařízeních": "healthcare_assistants",
};

const JMHZ_DESTINATIONS = {
  jmhz_educationHighest: {
    destination: "collaborators.highest_education",
    currentKey: "highest_education",
    transform: value => EDUCATION_TO_CARD_VALUE[String(value ?? "").trim()] ?? value,
  },
  jmhz_birthPlace: {
    destination: "collaborators.birth_place",
    currentKey: "birth_place",
  },
  jmhz_birthSurname: {
    destination: "collaborators.maiden_name",
    currentKey: "maiden_name",
  },
  jmhz_profession: {
    destination: "collaborators.professional_classification",
    currentKey: "professional_classification",
    transform: value => PROFESSION_TO_CARD_VALUE[String(value ?? "").trim()] ?? value,
  },
  jmhz_workPlace: {
    destination: "collaborators.workplace_name",
    currentKey: "workplace_name",
  },
  jmhz_isLeadingEmployee: {
    destination: "collaborators.is_manager",
    currentKey: "is_manager",
    transform: value => String(value ?? "").trim() === "Ano",
  },
  jmhz_birthCountry: {
    destination: "request_only.birthCountry",
    requestOnly: true,
  },
  jmhz_educationRequired: {
    destination: "request_only.educationRequired",
    requestOnly: true,
  },
};

const ADDRESS_FIELD_RE = /^addr_(permanent|correspondence)_(streetNumber|city|postalCode)$/;
const SECRET_KEY_RE = /(password|access_token|refresh_token|secret)/i;
const EXCEL_CELL_LIMIT = 32767;

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function sameValue(a, b) {
  if (a === null || a === undefined) a = "";
  if (b === null || b === undefined) b = "";
  return String(a).trim() === String(b).trim();
}

function snakeCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function jsonString(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value) || typeof value === "object") return JSON.stringify(value);
  return value;
}

function excelValue(value, truncationState) {
  const converted = jsonString(value);
  if (typeof converted !== "string" || converted.length <= EXCEL_CELL_LIMIT) return converted;
  truncationState.count += 1;
  return `${converted.slice(0, EXCEL_CELL_LIMIT - 80)} … [TRUNCATED; full value is in the database]`;
}

function normalizeRow(row, truncationState) {
  const output = {};
  for (const [key, value] of Object.entries(row)) {
    output[key] = excelValue(value, truncationState);
  }
  return output;
}

function writeSheet(workbook, name, rows, truncationState, preferredColumns = []) {
  const normalizedRows = rows.map(row => normalizeRow(row, truncationState));
  const keys = new Set(preferredColumns);
  for (const row of normalizedRows) {
    for (const key of Object.keys(row)) keys.add(key);
  }
  const columns = [...keys];
  const sheet = xlsx.utils.json_to_sheet(
    normalizedRows.length > 0 ? normalizedRows : [{}],
    { header: columns },
  );
  if (normalizedRows.length === 0) {
    xlsx.utils.sheet_add_aoa(sheet, [columns], { origin: "A1" });
  }
  sheet["!autofilter"] = { ref: `A1:${columnName(columns.length)}${Math.max(1, normalizedRows.length + 1)}` };
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  xlsx.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
}

function columnName(number) {
  let result = "";
  let n = Math.max(1, number);
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
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
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value;
}

async function findCampaign(client, campaignId, campaignName) {
  if (!campaignId && !campaignName) {
    throw new Error("Provide --campaign-id or --campaign-name");
  }
  const result = await client.query(
    `SELECT id, name, status, form_type, created_at, updated_at,
            send_started_at, send_finished_at, filter_criteria
       FROM collaborator_update_campaigns
      WHERE ($1::text IS NOT NULL AND id = $1)
         OR ($1::text IS NULL AND LOWER(name) = LOWER($2))
      ORDER BY created_at DESC`,
    [campaignId || null, campaignName || null],
  );
  if (result.rows.length !== 1) {
    const detail = result.rows.map(row => `${row.id} | ${row.name} | ${row.status}`).join("\n");
    throw new Error(
      result.rows.length === 0
        ? `Campaign not found${detail ? `\n${detail}` : ""}`
        : `Campaign selector matched ${result.rows.length} campaigns; use --campaign-id`,
    );
  }
  return result.rows[0];
}

function addressMap(addressRows) {
  const byCollaborator = new Map();
  for (const row of addressRows) {
    const personRows = byCollaborator.get(row.collaborator_id) || [];
    personRows.push(row.address);
    byCollaborator.set(row.collaborator_id, personRows);
  }
  return byCollaborator;
}

function otherDataMap(rows) {
  return new Map(rows.map(row => [row.collaborator_id, row.other_data]));
}

function addressFor(addresses, type) {
  return (addresses || []).find(row => row.address_type === type) || {};
}

function currentValueFor(changeField, person, addresses) {
  const addressMatch = changeField.match(ADDRESS_FIELD_RE);
  if (addressMatch) {
    return addressFor(addresses, addressMatch[1])[snakeCase(addressMatch[2])];
  }
  const destination = JMHZ_DESTINATIONS[changeField];
  if (destination) return destination.requestOnly ? null : person[destination.currentKey];
  return person[snakeCase(changeField)];
}

function destinationFor(changeField) {
  const addressMatch = changeField.match(ADDRESS_FIELD_RE);
  if (addressMatch) {
    return `collaborator_addresses[${addressMatch[1]}].${snakeCase(addressMatch[2])}`;
  }
  return JMHZ_DESTINATIONS[changeField]?.destination ||
    `collaborators.${snakeCase(changeField)}`;
}

function appliedValueFor(changeField, newValue) {
  const destination = JMHZ_DESTINATIONS[changeField];
  return destination?.transform ? destination.transform(newValue) : newValue;
}

function changeRowsForRequest(request, person, addresses) {
  const changes = Array.isArray(request.changes) ? request.changes : [];
  return changes.map(change => {
    const current = currentValueFor(change.field, person, addresses);
    const appliedValue = appliedValueFor(change.field, change.newValue);
    const approved = request.status === "approved";
    const requestOnly = Boolean(JMHZ_DESTINATIONS[change.field]?.requestOnly);
    return {
      request_id: request.id,
      collaborator_id: request.collaborator_id,
      collaborator_legacy_id: person.legacy_id || "",
      field: change.field,
      destination: destinationFor(change.field),
      original_value: change.oldValue,
      submitted_new_value: change.newValue,
      value_written_on_approve: appliedValue,
      current_database_value: current,
      submitted_changed_field: "YES",
      approved: approved ? "YES" : "NO",
      writable_to_collaborator_card: requestOnly ? "NO" : "YES",
      updated_by_this_campaign: approved && !requestOnly && sameValue(current, appliedValue) ? "YES" : "NO",
      current_value_matches_approved_value:
        approved && !requestOnly ? (sameValue(current, appliedValue) ? "YES" : "NO") : "",
      submitted_at: request.submitted_at,
      reviewed_at: request.reviewed_at,
    };
  });
}

function submittedFieldRows(request, person, addresses) {
  const submitted = request.submitted_data && typeof request.submitted_data === "object"
    ? request.submitted_data
    : {};
  const changes = Array.isArray(request.changes) ? request.changes : [];
  const byField = new Map(changes.map(change => [change.field, change]));
  const rows = [];

  for (const [key, value] of Object.entries(submitted)) {
    if (key === "consent") {
      rows.push({
        request_id: request.id,
        collaborator_id: request.collaborator_id,
        collaborator_legacy_id: person.legacy_id || "",
        submitted_data_key: key,
        field: key,
        destination: "request_only.consent",
        obtained_in_campaign: "YES",
        submitted_value: value,
        original_value: "",
        changed_in_submission: "NO",
        approved: request.status === "approved" ? "YES" : "NO",
        updated_by_this_campaign: "NO",
        current_database_value: "",
      });
      continue;
    }

    let field = key;
    if (key.startsWith("contact_")) field = key.slice("contact_".length);
    else if (JMHZ_DESTINATIONS[`jmhz_${key}`]) field = `jmhz_${key}`;
    const change = byField.get(field);
    const current = currentValueFor(field, person, addresses);
    const requestOnly = Boolean(JMHZ_DESTINATIONS[field]?.requestOnly);
    const appliedValue = change ? appliedValueFor(field, change.newValue) : value;
    const approved = request.status === "approved";

    rows.push({
      request_id: request.id,
      collaborator_id: request.collaborator_id,
      collaborator_legacy_id: person.legacy_id || "",
      submitted_data_key: key,
      field,
      destination: destinationFor(field),
      obtained_in_campaign: "YES",
      submitted_value: value,
      original_value: change ? change.oldValue : "",
      changed_in_submission: change ? "YES" : "NO",
      approved: approved ? "YES" : "NO",
      updated_by_this_campaign:
        approved && !requestOnly && change && sameValue(current, appliedValue) ? "YES" : "NO",
      current_database_value: current,
    });
  }
  return rows;
}

function personRow(person, addresses, otherData, requestRows, fieldRows, changeRows) {
  const row = {};
  for (const [key, value] of Object.entries(person || {})) {
    if (SECRET_KEY_RE.test(key)) continue;
    row[key] = value;
  }
  row.mobile_password_hash_present = person && person.mobile_password_hash ? "YES" : "NO";
  row.addresses_json = addresses || [];
  row.other_data_json = otherData || "";
  row.campaign_request_count = requestRows.length;
  row.campaign_request_ids = requestRows.map(request => request.id).join(", ");
  row.campaign_statuses = [...new Set(requestRows.map(request => request.status))].join(", ");
  row.campaign_submitted = requestRows.some(request => request.submitted_at) ? "YES" : "NO";
  row.campaign_approved = requestRows.some(request => request.status === "approved") ? "YES" : "NO";
  row.campaign_changed_field_count = changeRows.length;
  row.campaign_updated_field_count = fieldRows.filter(field => field.updated_by_this_campaign === "YES").length;
  row.campaign_changed_fields = [...new Set(changeRows.map(change => change.field))].join(", ");
  row.campaign_updated_fields = [...new Set(
    fieldRows.filter(field => field.updated_by_this_campaign === "YES").map(field => field.field),
  )].join(", ");
  return row;
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log("Usage: node scripts/export-collaborator-update-campaign.cjs --campaign-id <id> [--output file.xlsx]");
    console.log("   or: node scripts/export-collaborator-update-campaign.cjs --campaign-name <name> [--output file.xlsx]");
    console.log("Optional: --include-tests");
    return;
  }

  const campaignId = arg("--campaign-id");
  const campaignName = arg("--campaign-name");
  const includeTests = process.argv.includes("--include-tests");
  let outputPath = arg("--output", `./collaborator-update-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
  if (!outputPath.toLowerCase().endsWith(".xlsx")) outputPath += ".xlsx";

  const pool = new Pool({ connectionString: readDatabaseUrl(), max: 1 });
  const client = await pool.connect();
  const truncationState = { count: 0 };

  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    await client.query("SET LOCAL statement_timeout = '120s'");

    const campaign = await findCampaign(client, campaignId, campaignName);
    const requestsResult = await client.query(
      `SELECT r.id, r.campaign_id, r.collaborator_id, r.email, r.language, r.status,
              r.send_error, r.sent_at, r.reminded_at, r.opened_at, r.submitted_at,
              r.expires_at, r.submitted_data, r.changes, r.reviewed_by,
              r.reviewed_at, r.review_note, r.created_at,
              to_jsonb(c) AS person
         FROM collaborator_update_requests r
         LEFT JOIN collaborators c ON c.id = r.collaborator_id
        WHERE r.campaign_id = $1
          AND ($2::boolean OR r.token NOT LIKE 'test-%')
        ORDER BY r.submitted_at NULLS LAST, r.created_at, r.id`,
      [campaign.id, includeTests],
    );
    const requests = requestsResult.rows;
    const collaboratorIds = [...new Set(requests.map(row => row.collaborator_id).filter(Boolean))];

    let addressRows = [];
    let otherRows = [];
    const snapshotsResult = await client.query(
      `SELECT contact_id, campaign_id, field_name, last_value, updated_at
         FROM contact_field_snapshots
        WHERE campaign_id = $1
        ORDER BY contact_id, field_name`,
      [campaign.id],
    );
    if (collaboratorIds.length > 0) {
      const [addresses, otherData] = await Promise.all([
        client.query(
          `SELECT collaborator_id, to_jsonb(a) AS address
             FROM collaborator_addresses a
            WHERE collaborator_id = ANY($1::text[])
            ORDER BY collaborator_id, address_type, id`,
          [collaboratorIds],
        ),
        client.query(
          `SELECT collaborator_id, to_jsonb(o) AS other_data
             FROM collaborator_other_data o
            WHERE collaborator_id = ANY($1::text[])`,
          [collaboratorIds],
        ),
      ]);
      addressRows = addresses.rows;
      otherRows = otherData.rows;
    }

    await client.query("COMMIT");

    const addressesByCollaborator = addressMap(addressRows);
    const otherByCollaborator = otherDataMap(otherRows);
    const snapshotExportRows = snapshotsResult.rows.map(row => ({
      ...row,
      collaborator_in_campaign_export: requests.some(request => request.collaborator_id === row.contact_id)
        ? "YES"
        : "NO",
    }));
    const requestsByCollaborator = new Map();
    const allChangeRows = [];
    const allFieldRows = [];
    for (const request of requests) {
      const person = request.person || {};
      const addresses = addressesByCollaborator.get(request.collaborator_id) || [];
      const changes = changeRowsForRequest(request, person, addresses);
      const fields = submittedFieldRows(request, person, addresses);
      allChangeRows.push(...changes);
      allFieldRows.push(...fields);
      const list = requestsByCollaborator.get(request.collaborator_id) || [];
      list.push(request);
      requestsByCollaborator.set(request.collaborator_id, list);
    }

    const personsById = new Map();
    for (const request of requests) {
      if (!request.person || !request.collaborator_id) continue;
      personsById.set(request.collaborator_id, request.person);
    }

    const personRows = [];
    for (const [collaboratorId, person] of personsById) {
      const requestsForPerson = requestsByCollaborator.get(collaboratorId) || [];
      const addresses = addressesByCollaborator.get(collaboratorId) || [];
      const fields = allFieldRows.filter(row => row.collaborator_id === collaboratorId);
      const changes = allChangeRows.filter(row => row.collaborator_id === collaboratorId);
      personRows.push(personRow(
        person,
        addresses,
        otherByCollaborator.get(collaboratorId)?.other_data || "",
        requestsForPerson,
        fields,
        changes,
      ));
    }

    const requestRows = requests.map(request => ({
      request_id: request.id,
      campaign_id: request.campaign_id,
      collaborator_id: request.collaborator_id,
      collaborator_legacy_id: request.person?.legacy_id || "",
      collaborator_name: [
        request.person?.title_before,
        request.person?.first_name,
        request.person?.last_name,
        request.person?.title_after,
      ].filter(Boolean).join(" "),
      campaign_email: request.email,
      language: request.language,
      status: request.status,
      send_error: request.send_error,
      sent_at: request.sent_at,
      reminded_at: request.reminded_at,
      opened_at: request.opened_at,
      submitted_at: request.submitted_at,
      expires_at: request.expires_at,
      reviewed_by: request.reviewed_by,
      reviewed_at: request.reviewed_at,
      review_note: request.review_note,
      submitted_data_json: request.submitted_data,
      change_count: Array.isArray(request.changes) ? request.changes.length : 0,
    }));

    const addressExportRows = addressRows.map(row => row.address);
    const otherExportRows = otherRows.map(row => row.other_data);
    const summaryRows = [
      { metric: "campaign_id", value: campaign.id },
      { metric: "campaign_name", value: campaign.name },
      { metric: "campaign_status", value: campaign.status },
      { metric: "campaign_form_type", value: campaign.form_type },
      { metric: "campaign_created_at", value: campaign.created_at },
      { metric: "campaign_send_started_at", value: campaign.send_started_at },
      { metric: "campaign_send_finished_at", value: campaign.send_finished_at },
      { metric: "include_test_requests", value: includeTests ? "YES" : "NO" },
      { metric: "request_count_exported", value: requests.length },
      { metric: "unique_person_count_exported", value: personsById.size },
      { metric: "submitted_request_count", value: requests.filter(row => row.submitted_at).length },
      { metric: "approved_request_count", value: requests.filter(row => row.status === "approved").length },
      { metric: "rejected_request_count", value: requests.filter(row => row.status === "rejected").length },
      { metric: "changed_field_rows", value: allChangeRows.length },
      { metric: "submitted_field_rows", value: allFieldRows.length },
      { metric: "fields_marked_updated_by_campaign", value: allFieldRows.filter(row => row.updated_by_this_campaign === "YES").length },
      { metric: "fields_not_written_to_card", value: allFieldRows.filter(row => row.destination.startsWith("request_only.")).length },
      { metric: "contact_field_snapshot_rows_for_campaign", value: snapshotExportRows.length },
      { metric: "contact_field_snapshot_contacts_for_campaign", value: new Set(snapshotExportRows.map(row => row.contact_id)).size },
      { metric: "exported_at_utc", value: new Date().toISOString() },
    ];

    const readmeRows = [
      { item: "Scope", value: "Read-only export of one collaborator Data Update campaign." },
      { item: "Persons", value: "All non-secret columns from collaborators, plus campaign summary flags." },
      { item: "Obtained in campaign", value: "field_audit.obtained_in_campaign = YES means the public form submitted that field." },
      { item: "Changed in submission", value: "field_audit.changed_in_submission = YES means the application recorded a before/after change." },
      { item: "Updated by campaign", value: "YES means the request was approved, the field is writable to the card, and the current database value matches the approved value." },
      { item: "Field snapshots", value: "field_snapshots contains contact_field_snapshots rows with this campaign_id. An empty sheet means no delta-tracking snapshot was found for the campaign." },
      { item: "Request-only", value: "JMHZ birthCountry and educationRequired are retained on the campaign request and are not written to the collaborator card by the current application." },
      { item: "Sensitive fields", value: "Request tokens and mobile_password_hash are not exported. mobile_password_hash_present shows only whether a hash exists. Bank and personal data are included because the export is intended for a protected server-side audit." },
      { item: "Important limitation", value: "For submitted fields with no recorded change, the application does not store a separate pre-submission snapshot; original_value is blank. Exact before/after values are available for rows in campaign_changes." },
    ];

    const workbook = xlsx.utils.book_new();
    writeSheet(workbook, "persons", personRows, truncationState);
    writeSheet(workbook, "campaign_requests", requestRows, truncationState);
    writeSheet(workbook, "field_audit", allFieldRows, truncationState);
    writeSheet(workbook, "campaign_changes", allChangeRows, truncationState);
    writeSheet(workbook, "field_snapshots", snapshotExportRows, truncationState);
    writeSheet(workbook, "addresses", addressExportRows, truncationState);
    writeSheet(workbook, "other_data", otherExportRows, truncationState);
    summaryRows.push({ metric: "truncated_excel_cells", value: truncationState.count });
    writeSheet(workbook, "summary", summaryRows, truncationState, ["metric", "value"]);
    writeSheet(workbook, "README", readmeRows, truncationState, ["item", "value"]);

    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    xlsx.writeFile(workbook, outputPath);

    console.log("=== Collaborator campaign export ===");
    console.log(`Campaign: ${campaign.id} | ${campaign.name}`);
    console.log(`Requests exported: ${requests.length}`);
    console.log(`Unique persons: ${personsById.size}`);
    console.log(`Submitted requests: ${requests.filter(row => row.submitted_at).length}`);
    console.log(`Approved requests: ${requests.filter(row => row.status === "approved").length}`);
    console.log(`Changed fields: ${allChangeRows.length}`);
    console.log(`Fields marked updated by campaign: ${allFieldRows.filter(row => row.updated_by_this_campaign === "YES").length}`);
    console.log(`Output: ${path.resolve(outputPath)}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(`ERROR: ${error?.message || error}`);
  process.exitCode = 1;
});