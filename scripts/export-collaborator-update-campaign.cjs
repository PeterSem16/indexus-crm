#!/usr/bin/env node
/**
 * Read-only export of a collaborator Data Update campaign.
 *
 * The workbook contains exactly two sheets:
 *   - persons: one row per collaborator reached by the campaign
 *   - summary: campaign totals and export notes
 *
 * One-to-many records (addresses, agreements and field snapshots) are kept in
 * JSON columns in the same person row so that no person is split across sheets.
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
const AdmZip = require("adm-zip");
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

const CARD_VALUE_TO_EDUCATION = Object.fromEntries(
  Object.entries(EDUCATION_TO_CARD_VALUE).map(([label, code]) => [code, label]),
);

const CODE_LABELS = {
  collaborator_type: {
    doctor: "Lekár",
    nurse: "Sestra",
    resident: "Rezident",
    callCenter: "Call centrum",
    headNurse: "Vrchná sestra",
    bm: "B&M",
    vedono: "Vedono",
    external: "Externý spolupracovník",
    representative: "Reprezentant",
    other: "Iný",
  },
  marital_status: {
    single: "Slobodný/-á",
    married: "Ženatý/Vydatá",
    divorced: "Rozvedený/-á",
    widowed: "Vdovec/Vdova",
  },
  professional_classification: {
    gynecology_specialists: "Lekári v gynekológii a pôrodníctve (špecialisti)",
    general_practitioners: "Všeobecní lekári (lekári v príprave/absolventi)",
    chief_physicians: "Primári v oblasti zdravotníctva",
    medical_directors: "Vedúci lekári a riaditelia zdravotníckych zariadení",
    specialized_midwives: "Pôrodné asistentky so špecializáciou",
    charge_midwives: "Staničné sestry (pôrodné asistentky)",
    midwives_no_specialization: "Pôrodné asistentky bez špecializácie",
    head_nurses: "Vrchné a staničné sestry (všeobecné sestry)",
    surgical_nurses: "Sestry pre starostlivosť v chirurgických odboroch",
    general_nurses_no_spec: "Všeobecné sestry bez špecializácie",
    internal_medicine_nurses: "Sestry pre starostlivosť v interných odboroch",
    practical_nurses: "Praktické sestry",
    healthcare_assistants: "Ošetrovatelia v zdravotníckych zariadeniach",
  },
  reward_type: {
    fixed: "Fixná čiastka",
    percentage: "Percentuálna sadzba",
  },
  fixed_reward_currency: {
    EUR: "Euro (EUR)",
    CZK: "Česká koruna (CZK)",
    HUF: "Maďarský forint (HUF)",
    RON: "Rumunský leu (RON)",
  },
  agreement_type: {
    DOVP: "Dohoda o vykonaní práce",
    ZOD: "Zmluva o dielo",
    dpp: "Dohoda o vykonaní práce",
    dpc: "Dohoda o pracovnej činnosti",
  },
  agreement_form: {
    DOVP: "Dohoda o vykonaní práce",
    ZOD: "Zmluva o dielo",
    dohodaOVykonaniPrace: "Dohoda o vykonaní práce",
    zmluvaODieloPodnikatel: "Zmluva o dielo (podnikateľ)",
    zmluvaODieloFyzickaOsoba: "Zmluva o dielo (fyzická osoba)",
  },
  reward_types: {
    recruitment: "Naverbovanie",
    assistance: "Asistencia",
    puk_collection: "Odber PUK",
    plk_collection: "Odber PLK",
    tpu_collection: "Odber TPU",
    tpl_collection: "Odber TPL",
    informing: "Informovanie",
    emergency_grant: "Núdzový grant",
    prophylaxis: "Profylaxia",
    head_nurse: "Vrchná sestra",
    lecture: "Prednáška",
    management: "Vedenie",
    disability_card: "ZŤP preukaz",
    old_age_pension: "Starobný dôchodok",
    widow_pension: "Vdovský dôchodok",
    vip: "VIP",
    dpa_signed: "DPA podpísané",
    monthly_rewarding_signed: "Mesačné odmeny podpísané",
    internal_employee: "Interný zamestnanec",
    contact_person_reward: "Odmena kontaktnej osobe",
    responsible_person_reward: "Odmena zodpovednej osobe",
  },
  cbc_activities: {
    recruitment: "Naverbovanie",
    assistance: "Asistencia",
    puk_collection: "Odber PUK",
    plk_collection: "Odber PLK",
    tpu_collection: "Odber TPU",
    tpl_collection: "Odber TPL",
    informing: "Informovanie",
    emergency_grant: "Núdzový grant",
    prophylaxis: "Profylaxia",
    head_nurse: "Vrchná sestra",
    lecture: "Prednáška",
    management: "Vedenie",
    disability_card: "ZŤP preukaz",
    old_age_pension: "Starobný dôchodok",
    widow_pension: "Vdovský dôchodok",
    vip: "VIP",
    dpa_signed: "DPA podpísané",
    monthly_rewarding_signed: "Mesačné odmeny podpísané",
    internal_employee: "Interný zamestnanec",
    contact_person_reward: "Odmena kontaktnej osobe",
    responsible_person_reward: "Odmena zodpovednej osobe",
  },
  preferred_language: {
    sk: "Slovenčina",
    cs: "Čeština",
    hu: "Maďarčina",
    ro: "Rumunčina",
    it: "Taliančina",
    de: "Nemčina",
    en: "Angličtina",
  },
  language: {
    sk: "Slovenčina",
    cs: "Čeština",
    hu: "Maďarčina",
    ro: "Rumunčina",
    it: "Taliančina",
    de: "Nemčina",
    en: "Angličtina",
  },
  campaign_status: {
    draft: "Koncept",
    sent: "Odoslaná",
    opened: "Otvorená",
    submitted: "Odoslané údaje",
    approved: "Schválená",
    rejected: "Zamietnutá",
    pending: "Čaká na kontrolu",
  },
  data_source: {
    iscbc: "ISCBC – migrácia z pôvodného CBC",
    indexus: "INDEXUS",
  },
  call_recording_mode: {
    full: "Kompletná nahrávka",
    transcription_only: "Iba prepis",
    off: "Vypnuté",
  },
  address_type: {
    permanent: "Trvalé bydlisko",
    correspondence: "Korešpondenčná adresa",
    work: "Pracovná adresa",
    company: "Firemná adresa",
  },
  country_code: {
    SK: "Slovensko",
    CZ: "Česko",
    HU: "Maďarsko",
    RO: "Rumunsko",
    IT: "Taliansko",
    DE: "Nemecko",
    AT: "Rakúsko",
    CH: "Švajčiarsko",
    PL: "Poľsko",
    US: "Spojené štáty",
    GB: "Spojené kráľovstvo",
  },
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
const RELATION_ID_KEYS = new Set([
  "hospital_id", "hospital_ids",
  "clinic_id", "clinic_ids",
  "representative_id", "representative_ids",
]);
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

function fullEducation(value) {
  const code = text(value).toUpperCase();
  return CARD_VALUE_TO_EDUCATION[code] || value;
}

function displayFieldKey(key) {
  const normalized = snakeCase(key).replace(/^contact_/, "");
  const withoutJmhz = normalized.replace(/^jmhz_/, "");
  const aliases = {
    education_highest: "highest_education",
    birth_surname: "maiden_name",
    is_leading_employee: "is_manager",
  };
  return aliases[withoutJmhz] || withoutJmhz;
}

function humanizeValue(key, value) {
  if (value === null || value === undefined) return value;
  const normalizedKey = displayFieldKey(key);
  if (normalizedKey === "highest_education") return fullEducation(value);
  if (Array.isArray(value)) {
    const arrayKey = CODE_LABELS[normalizedKey] ? normalizedKey : normalizedKey.replace(/s$/, "");
    return value.map(item => humanizeValue(arrayKey, item));
  }
  if (typeof value === "boolean") return value ? "Áno" : "Nie";
  if (typeof value === "object") return humanizeObject(value);
  const labelKey = normalizedKey.endsWith("_country_code")
    ? "country_code"
    : normalizedKey.endsWith("_address_type")
      ? "address_type"
      : normalizedKey;
  const labels = CODE_LABELS[labelKey];
  if (!labels) return value;
  const stringValue = String(value);
  return labels[stringValue] ||
    labels[stringValue.toLowerCase()] ||
    labels[stringValue.toUpperCase()] ||
    value;
}

function humanizeObject(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(item => humanizeObject(item));
  const output = {};
  const fieldKey = value.field ? displayFieldKey(value.field) : null;
  for (const [key, item] of Object.entries(value)) {
    if (fieldKey && [
      "original_value",
      "submitted_new_value",
      "value_written_on_approve",
      "current_database_value",
      "submitted_value",
    ].includes(key)) {
      output[key] = humanizeValue(fieldKey, item);
    } else {
      output[key] = humanizeValue(key, item);
    }
  }
  return output;
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
  const columns = [...keys].filter(key =>
    preferredColumns.includes(key) ||
    normalizedRows.some(row => row[key] !== null && row[key] !== undefined &&
      (typeof row[key] !== "string" || row[key].trim() !== "")),
  );
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
  return columns;
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

function setCellStyle(xml, cellRef, styleId) {
  const expression = new RegExp(`(<c\\s+[^>]*\\br="${cellRef}"[^>]*)(>)`);
  return xml.replace(expression, (_match, attributes, closing) => {
    const withoutStyle = attributes.replace(/\s+s="\d+"/g, "");
    return `${withoutStyle} s="${styleId}"${closing}`;
  });
}

function addWorkbookStyles(filePath, personColumns, personRows, summaryRows) {
  const zip = new AdmZip(filePath);
  const stylesEntry = zip.getEntry("xl/styles.xml");
  if (!stylesEntry) return;

  let stylesXml = stylesEntry.getData().toString("utf8");
  const fillsMatch = stylesXml.match(/<fills count="(\d+)">([\s\S]*?)<\/fills>/);
  const cellXfsMatch = stylesXml.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/);
  if (!fillsMatch || !cellXfsMatch) return;

  const updatedFill =
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFE699"/><bgColor indexed="64"/></patternFill></fill>';
  const newFill =
    '<fill><patternFill patternType="solid"><fgColor rgb="FFC6EFCE"/><bgColor indexed="64"/></patternFill></fill>';
  const headerFill =
    '<fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill>';
  const fillStart = Number(fillsMatch[1]);
  stylesXml = stylesXml.replace(
    fillsMatch[0],
    `<fills count="${fillStart + 3}">${fillsMatch[2]}${updatedFill}${newFill}${headerFill}</fills>`,
  );

  const xfStart = Number(cellXfsMatch[1]);
  const updatedStyle = xfStart;
  const newStyle = xfStart + 1;
  const headerStyle = xfStart + 2;
  const styleXfs =
    `<xf numFmtId="0" fontId="0" fillId="${fillStart}" borderId="0" xfId="0" applyFill="1"/>` +
    `<xf numFmtId="0" fontId="0" fillId="${fillStart + 1}" borderId="0" xfId="0" applyFill="1"/>` +
    `<xf numFmtId="0" fontId="0" fillId="${fillStart + 2}" borderId="0" xfId="0" applyFill="1"/>`;
  stylesXml = stylesXml.replace(
    cellXfsMatch[0],
    `<cellXfs count="${xfStart + 3}">${cellXfsMatch[2]}${styleXfs}</cellXfs>`,
  );
  zip.updateFile("xl/styles.xml", Buffer.from(stylesXml, "utf8"));

  const styleSheet = (sheetFile, columns, rows, bodyStyleForRow) => {
    const entry = zip.getEntry(sheetFile);
    if (!entry) return;
    let xml = entry.getData().toString("utf8");
    columns.forEach((_column, index) => {
      xml = setCellStyle(xml, `${columnName(index + 1)}1`, headerStyle);
    });
    rows.forEach((row, rowIndex) => {
      const styles = bodyStyleForRow(row) || {};
      for (const [column, kind] of Object.entries(styles)) {
        const index = columns.indexOf(column);
        if (index < 0) continue;
        xml = setCellStyle(
          xml,
          `${columnName(index + 1)}${rowIndex + 2}`,
          kind === "updated" ? updatedStyle : newStyle,
        );
      }
    });
    zip.updateFile(sheetFile, Buffer.from(xml, "utf8"));
  };

  styleSheet(
    "xl/worksheets/sheet1.xml",
    personColumns,
    personRows,
    row => row.__campaignCellStyles,
  );
  styleSheet(
    "xl/worksheets/sheet2.xml",
    ["metric", "value"],
    summaryRows,
    row => {
      if (row.metric === "legend_updated") return { value: "updated" };
      if (row.metric === "legend_new") return { value: "new" };
      return {};
    },
  );
  zip.writeZip(filePath);
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

function relatedRowsMap(rows, valueKey) {
  const byCollaborator = new Map();
  for (const row of rows) {
    const list = byCollaborator.get(row.collaborator_id) || [];
    list.push(row[valueKey]);
    byCollaborator.set(row.collaborator_id, list);
  }
  return byCollaborator;
}

function idsFromPerson(person, singularKey, pluralKey) {
  const values = [];
  if (person?.[singularKey]) values.push(person[singularKey]);
  if (Array.isArray(person?.[pluralKey])) values.push(...person[pluralKey]);
  return values.map(value => String(value)).filter(Boolean);
}

function relationNameList(person, singularKey, pluralKey, namesById) {
  return [...new Set(idsFromPerson(person, singularKey, pluralKey)
    .map(id => namesById.get(id) || id))]
    .join(", ");
}

async function relationNameMaps(client, requests) {
  const hospitalIds = new Set();
  const clinicIds = new Set();
  const representativeIds = new Set();
  for (const request of requests) {
    const person = request.person || {};
    for (const id of idsFromPerson(person, "hospital_id", "hospital_ids")) hospitalIds.add(id);
    for (const id of idsFromPerson(person, "clinic_id", "clinic_ids")) clinicIds.add(id);
    for (const id of idsFromPerson(person, "representative_id", "representative_ids")) representativeIds.add(id);
  }

  const [hospitals, clinics, representatives] = await Promise.all([
    hospitalIds.size
      ? client.query(
          `SELECT id, COALESCE(NULLIF(full_name, ''), name) AS display_name
             FROM hospitals
            WHERE id = ANY($1::text[])`,
          [[...hospitalIds]],
        )
      : { rows: [] },
    clinicIds.size
      ? client.query(
          `SELECT id, COALESCE(NULLIF(name, ''), doctor_name) AS display_name
             FROM clinics
            WHERE id = ANY($1::text[])`,
          [[...clinicIds]],
        )
      : { rows: [] },
    representativeIds.size
      ? client.query(
          `SELECT id, full_name AS display_name
             FROM users
            WHERE id = ANY($1::text[])`,
          [[...representativeIds]],
        )
      : { rows: [] },
  ]);

  return {
    hospitals: new Map(hospitals.rows.map(row => [row.id, row.display_name])),
    clinics: new Map(clinics.rows.map(row => [row.id, row.display_name])),
    representatives: new Map(representatives.rows.map(row => [row.id, row.display_name])),
  };
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

function exportColumnForCampaignField(field) {
  const addressMatch = field.match(ADDRESS_FIELD_RE);
  if (addressMatch) {
    return `address_${addressMatch[1]}_${snakeCase(addressMatch[2])}`;
  }
  const destination = JMHZ_DESTINATIONS[field];
  if (destination?.currentKey) return destination.currentKey;
  if (destination?.requestOnly) return null;
  return snakeCase(field);
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
    const displayKey = JMHZ_DESTINATIONS[change.field]?.currentKey || change.field;
    const currentForDisplay = humanizeValue(displayKey, current);
    const appliedForDisplay = humanizeValue(displayKey, appliedValue);
    return {
      request_id: request.id,
      collaborator_id: request.collaborator_id,
      collaborator_legacy_id: person.legacy_id || "",
      field: change.field,
      destination: destinationFor(change.field),
      original_value: change.oldValue,
      submitted_new_value: change.newValue,
      value_written_on_approve: appliedForDisplay,
      current_database_value: currentForDisplay,
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

function personRow(
  person,
  addresses,
  otherData,
  agreements,
  snapshots,
  relationNames,
  requestRows,
  fieldRows,
  changeRows,
) {
  const row = {};
  for (const [key, value] of Object.entries(person || {})) {
    if (SECRET_KEY_RE.test(key) || RELATION_ID_KEYS.has(key)) continue;
    row[key] = humanizeValue(key, value);
  }
  row.collaborator_id = person?.id || row.collaborator_id || "";
  row.iscbc_legacy_id = person?.legacy_id || "";
  row.hospital_names = relationNameList(person, "hospital_id", "hospital_ids", relationNames.hospitals);
  row.clinic_names = relationNameList(person, "clinic_id", "clinic_ids", relationNames.clinics);
  row.representative_names = relationNameList(
    person,
    "representative_id",
    "representative_ids",
    relationNames.representatives,
  );
  row.mobile_password_hash_present = person && person.mobile_password_hash ? "YES" : "NO";
  row.addresses_json = humanizeObject(addresses || []);
  for (const address of addresses || []) {
    const addressType = address.address_type || "unknown";
    for (const [key, value] of Object.entries(address)) {
      if (key === "collaborator_id" || key === "address_type" || SECRET_KEY_RE.test(key)) continue;
      const column = `address_${addressType}_${key}`;
      if (!(column in row) || text(row[column]) === "") row[column] = humanizeValue(key, value);
    }
  }
  row.other_data_json = humanizeObject(otherData || "");
  row.agreements_json = humanizeObject(agreements || []);
  row.contact_field_snapshots_json = humanizeObject(snapshots || []);
  row.campaign_request_count = requestRows.length;
  row.campaign_request_ids = requestRows.map(request => request.id).join(", ");
  row.campaign_statuses = [...new Set(
    requestRows.map(request => humanizeValue("campaign_status", request.status)),
  )].join(", ");
  row.campaign_emails = [...new Set(requestRows.map(request => request.email).filter(Boolean))].join(", ");
  row.campaign_sent_at = requestRows.map(request => request.sent_at).filter(Boolean).sort()[0] || "";
  row.campaign_opened_at = requestRows.map(request => request.opened_at).filter(Boolean).sort()[0] || "";
  row.campaign_submitted_at = requestRows.map(request => request.submitted_at).filter(Boolean).sort()[0] || "";
  row.campaign_reviewed_at = requestRows.map(request => request.reviewed_at).filter(Boolean).sort()[0] || "";
  row.campaign_submitted = requestRows.some(request => request.submitted_at) ? "YES" : "NO";
  row.campaign_approved = requestRows.some(request => request.status === "approved") ? "YES" : "NO";
  row.campaign_changed_field_count = changeRows.length;
  row.campaign_updated_field_count = fieldRows.filter(field => field.updated_by_this_campaign === "YES").length;
  row.campaign_obtained_field_count = fieldRows.length;
  row.campaign_obtained_fields = [...new Set(fieldRows.map(field => field.field))].join(", ");
  row.campaign_changed_fields = [...new Set(changeRows.map(change => change.field))].join(", ");
  row.campaign_updated_fields = [...new Set(
    fieldRows.filter(field => field.updated_by_this_campaign === "YES").map(field => field.field),
  )].join(", ");
  row.campaign_requests_json = requestRows.map(request => humanizeObject({
    request_id: request.id,
    email: request.email,
    language: request.language,
    status: request.status,
    sent_at: request.sent_at,
    opened_at: request.opened_at,
    submitted_at: request.submitted_at,
    reviewed_by: request.reviewed_by,
    reviewed_at: request.reviewed_at,
    review_note: request.review_note,
    submitted_data: request.submitted_data,
    changes: request.changes,
  }));
  row.campaign_field_audit_json = humanizeObject(fieldRows);
  row.campaign_changes_json = humanizeObject(changeRows);
  const campaignCellStyles = {};
  for (const field of fieldRows) {
    const column = exportColumnForCampaignField(field.field);
    if (!column) continue;
    const isUpdated = field.updated_by_this_campaign === "YES";
    const isNew = field.changed_in_submission === "YES" && !text(field.original_value);
    if (isNew && campaignCellStyles[column] !== "updated") campaignCellStyles[column] = "new";
    else if (isUpdated) campaignCellStyles[column] = "updated";
  }
  Object.defineProperty(row, "__campaignCellStyles", {
    value: campaignCellStyles,
    enumerable: false,
  });
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
    let agreementRows = [];
    const snapshotsResult = await client.query(
      `SELECT contact_id, campaign_id, field_name, last_value, updated_at
         FROM contact_field_snapshots
        WHERE campaign_id = $1
        ORDER BY contact_id, field_name`,
      [campaign.id],
    );
    if (collaboratorIds.length > 0) {
      const [addresses, otherData, agreements] = await Promise.all([
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
        client.query(
          `SELECT collaborator_id, to_jsonb(a) AS agreement
             FROM collaborator_agreements a
            WHERE collaborator_id = ANY($1::text[])
            ORDER BY collaborator_id, id`,
          [collaboratorIds],
        ),
      ]);
      addressRows = addresses.rows;
      otherRows = otherData.rows;
      agreementRows = agreements.rows;
    }

    const relationNames = await relationNameMaps(client, requests);
    await client.query("COMMIT");

    const addressesByCollaborator = addressMap(addressRows);
    const otherByCollaborator = otherDataMap(otherRows);
    const agreementsByCollaborator = relatedRowsMap(agreementRows, "agreement");
    const snapshotRows = snapshotsResult.rows.map(row => ({
      snapshot: {
        contact_id: row.contact_id,
        campaign_id: row.campaign_id,
        field_name: row.field_name,
        last_value: row.last_value,
        updated_at: row.updated_at,
      },
      contact_id: row.contact_id,
      collaborator_in_campaign_export: requests.some(request => request.collaborator_id === row.contact_id)
        ? "YES"
        : "NO",
    }));
    const snapshotsByCollaborator = relatedRowsMap(snapshotRows, "snapshot");
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
      if (!request.collaborator_id) continue;
      personsById.set(request.collaborator_id, request.person || { id: request.collaborator_id });
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
        otherByCollaborator.get(collaboratorId) || "",
        agreementsByCollaborator.get(collaboratorId) || [],
        snapshotsByCollaborator.get(collaboratorId) || [],
        relationNames,
        requestsForPerson,
        fields,
        changes,
      ));
    }
    const summaryRows = [
      { metric: "campaign_id", value: campaign.id },
      { metric: "campaign_name", value: campaign.name },
      { metric: "campaign_status", value: humanizeValue("campaign_status", campaign.status) },
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
      { metric: "contact_field_snapshot_rows_for_campaign", value: snapshotRows.length },
      { metric: "contact_field_snapshot_contacts_for_campaign", value: new Set(snapshotRows.map(row => row.contact_id)).size },
      { metric: "agreements_for_exported_persons", value: agreementRows.length },
      { metric: "legend_updated", value: "ŽLTÁ bunka = hodnota aktualizovaná cez kampaň" },
      { metric: "legend_new", value: "ZELENÁ bunka = nová hodnota doplnená cez kampaň" },
      { metric: "exported_at_utc", value: new Date().toISOString() },
    ];

    const workbook = xlsx.utils.book_new();
    const personColumns = writeSheet(workbook, "persons", personRows, truncationState, [
      "collaborator_id", "iscbc_legacy_id", "title_before", "first_name",
      "middle_name", "last_name", "maiden_name", "title_after",
      "birth_day", "birth_month", "birth_year", "birth_place",
      "highest_education",
      "hospital_names", "clinic_names", "representative_names",
      "campaign_request_count", "campaign_statuses", "campaign_obtained_fields",
      "campaign_changed_fields", "campaign_updated_fields",
    ]);
    summaryRows.push({ metric: "truncated_excel_cells", value: truncationState.count });
    writeSheet(workbook, "summary", summaryRows, truncationState, ["metric", "value"]);

    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    xlsx.writeFile(workbook, outputPath);
    addWorkbookStyles(outputPath, personColumns, personRows, summaryRows);

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