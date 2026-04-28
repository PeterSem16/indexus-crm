/**
 * READ-ONLY mapping/comparison script for INDEXUS gyn import CSV.
 *
 * Účel:
 *   1. Načíta CSV (`attached_assets/indexus_gyn_data_import_*.csv`).
 *   2. Pre každý CSV stĺpec ukáže navrhnuté DB pole (clinics / collaborators)
 *      a transformáciu, ktorá by sa použila pri reálnej migrácii.
 *   3. Pre 5 vzorových riadkov ukáže výsledok mapovania (čo by sa zapísalo).
 *   4. Porovná s aktuálnym stavom DB (zhoda podľa ICO+id_zz alebo legacyId)
 *      a zhrnie: koľko nových klinik by vzniklo, koľko by sa UPDATE-ovalo,
 *      koľko osôb by sa vytvorilo a aké duplicity sa zistili.
 *   5. Výsledok zapíše do `attached_assets/import_mapping_report.md`
 *      a vytlačí krátke zhrnutie do konzoly.
 *
 * NEZAPISUJE NIČ DO DB. Slúži na schválenie mapovania pred zápisovou fázou.
 *
 * Spustenie:
 *   - Replit:  npx tsx scripts/import-clinics-mapping.ts
 *   - Ubuntu:  DATABASE_URL=... npx tsx scripts/import-clinics-mapping.ts
 *
 * Voliteľný parameter:
 *   --csv=cesta/k/inemu.csv   (default = attached_assets/indexus_gyn_data_import_1777373378251.csv)
 *   --samples=N               (default = 5)
 */

import * as fs from "fs";
import * as path from "path";
import { db } from "../server/db";
import { clinics, collaborators, contactAssignments } from "../shared/schema";
import { sql } from "drizzle-orm";

// ────────────────────────────────────────────────────────────────────────────
// CLI args
// ────────────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const CSV_PATH = path.resolve(
  process.cwd(),
  (args.csv as string) ||
    "attached_assets/indexus_gyn_data_import_1777373378251.csv",
);
const SAMPLE_COUNT = Number(args.samples ?? 5);
const REPORT_PATH = path.resolve(
  process.cwd(),
  "attached_assets/import_mapping_report.md",
);

// ────────────────────────────────────────────────────────────────────────────
// Minimal RFC 4180 CSV parser (handles quoted fields, embedded newlines,
// escaped double quotes "" and CRLF). Žiadny extra balík.
// ────────────────────────────────────────────────────────────────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        // ignore – we'll handle on \n
      } else {
        field += c;
      }
    }
  }
  // posledné pole / riadok
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r[0] && r[0].trim() !== ""));
}

// ────────────────────────────────────────────────────────────────────────────
// Helpery na transformácie
// ────────────────────────────────────────────────────────────────────────────
const PIPE = /\s*\|\s*/;

function clean(v: string | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function splitPipe(v: string | undefined | null): string[] {
  if (!v) return [];
  return v
    .split(PIPE)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitTags(v: string | undefined | null): string[] {
  if (!v) return [];
  return v
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Slovenské tituly – pred menom / za menom
const TITLE_BEFORE = new Set([
  "MUDr.",
  "MDDr.",
  "MVDr.",
  "PharmDr.",
  "Mgr.",
  "Bc.",
  "Ing.",
  "JUDr.",
  "RNDr.",
  "PaedDr.",
  "PhDr.",
  "ThDr.",
  "Dr.",
  "doc.",
  "prof.",
  "akad.",
  "MUDr",
  "MDDr",
  "Ing",
  "Mgr",
  "Bc",
]);
const TITLE_AFTER = new Set([
  "PhD.",
  "PhD",
  "CSc.",
  "CSc",
  "DrSc.",
  "DrSc",
  "MBA",
  "MPH",
  "FEBS",
  "FEBO",
  "FACS",
  "MHA",
  "DiS.",
  "DiS",
  "MSc.",
  "MSc",
]);

interface ParsedPerson {
  raw: string;
  titleBefore: string | null;
  firstName: string | null;
  lastName: string | null;
  titleAfter: string | null;
  warning?: string;
}

/**
 * Parsuje meno typu "MUDr. Dagmar Psalmanová, PhD., MBA"
 * alebo "Slávka Pialová" alebo "prof. MUDr. Ján Novák, CSc."
 */
function parsePersonName(raw: string): ParsedPerson {
  const original = raw.trim();
  if (!original) {
    return {
      raw,
      titleBefore: null,
      firstName: null,
      lastName: null,
      titleAfter: null,
      warning: "empty",
    };
  }

  // Rozdeliť na časť pred prvou čiarkou (meno + tituly pred) a za (tituly po)
  const [namePart, ...afterParts] = original.split(",");
  const afterTitles = afterParts.map((s) => s.trim()).filter(Boolean);

  // Tokenizovať namePart
  const tokens = namePart.trim().split(/\s+/);
  const titlesBefore: string[] = [];
  const nameTokens: string[] = [];
  for (const tok of tokens) {
    const norm = tok.endsWith(".") ? tok : tok + ".";
    if (
      TITLE_BEFORE.has(tok) ||
      TITLE_BEFORE.has(norm) ||
      /^(prof|doc|akad)\./i.test(tok)
    ) {
      titlesBefore.push(tok);
    } else {
      nameTokens.push(tok);
    }
  }

  // Niektoré tituly za menom môžu byť v nameTokens (napr. "Novák PhD")
  while (nameTokens.length > 0) {
    const last = nameTokens[nameTokens.length - 1];
    const norm = last.endsWith(".") ? last : last + ".";
    if (TITLE_AFTER.has(last) || TITLE_AFTER.has(norm)) {
      afterTitles.unshift(nameTokens.pop()!);
    } else {
      break;
    }
  }

  let firstName: string | null = null;
  let lastName: string | null = null;
  if (nameTokens.length === 1) {
    lastName = nameTokens[0];
  } else if (nameTokens.length >= 2) {
    firstName = nameTokens[0];
    lastName = nameTokens.slice(1).join(" ");
  }

  return {
    raw,
    titleBefore: titlesBefore.length ? titlesBefore.join(" ") : null,
    firstName,
    lastName,
    titleAfter: afterTitles.length ? afterTitles.join(", ") : null,
    warning: !lastName ? "no last name parsed" : undefined,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Mapovanie CSV stĺpcov → DB polia (návrh)
// ────────────────────────────────────────────────────────────────────────────
type FieldMapping = {
  csv: string;
  target: string; // "clinics.column" | "collaborators.column" | "ignored" | "derived"
  transform: string;
  note?: string;
};

const FIELD_MAP: FieldMapping[] = [
  { csv: "external_id", target: "clinics.legacy_id", transform: "trim", note: "UPSERT key (primary)" },
  { csv: "source_system", target: "ignored", transform: "—", note: "len pre log" },
  { csv: "record_type", target: "ignored", transform: "filter == medical_provider_practice", note: "filter, neukladá sa" },
  { csv: "country_code", target: "clinics.country_code", transform: "trim, default SK" },
  { csv: "provider_name", target: "clinics.name", transform: "trim", note: "povinné" },
  { csv: "legal_name", target: "clinics.notes (append)", transform: "ak ≠ provider_name → 'Právny názov: …'" },
  { csv: "ico", target: "clinics.ico", transform: "trim, len číslice", note: "UPSERT key (sekundárny)" },
  { csv: "id_zz", target: "clinics.id_zz", transform: "trim", note: "UPSERT key (terciárny – stabilný kľúč ZZ)" },
  { csv: "primary_specialty", target: "clinics.notes (append)", transform: "'Špecializácia: …' (en kľúč → SK label v notes)" },
  { csv: "kod_pzs_primary", target: "clinics.pzs_code", transform: "trim" },
  { csv: "kod_pzs_all", target: "clinics.notes (append)", transform: "split('|') → 'Všetky kódy PZS: a, b, c'" },
  { csv: "kod_pzs_count", target: "ignored", transform: "—", note: "derivovateľné" },
  { csv: "kod_pzs_description", target: "clinics.pzs_name", transform: "trim, max ~ TEXT" },
  { csv: "weekly_office_hours", target: "clinics.notes (append)", transform: "'Týž. ord. hodiny: X h'", note: "žiadne dedikované pole" },
  { csv: "insurance_vszp", target: "clinics.notes (append)", transform: "1/0 → 'Poisťovňa VšZP: áno/nie'" },
  { csv: "insurance_dovera", target: "clinics.notes (append)", transform: "1/0 → 'Poisťovňa Dôvera: áno/nie'" },
  { csv: "insurance_union", target: "clinics.notes (append)", transform: "1/0 → 'Poisťovňa Union: áno/nie'" },
  { csv: "street", target: "clinics.street", transform: "trim" },
  { csv: "building_number", target: "clinics.street_number", transform: "trim" },
  { csv: "orientation_number", target: "clinics.orientation_number", transform: "trim" },
  { csv: "city", target: "clinics.city", transform: "trim" },
  { csv: "district", target: "clinics.district", transform: "trim" },
  { csv: "region", target: "clinics.region", transform: "trim" },
  { csv: "country", target: "ignored", transform: "—", note: "country_code už máme" },
  { csv: "address_full", target: "clinics.address", transform: "trim, normalizovať newliny → ', '" },
  { csv: "primary_phone", target: "clinics.phone", transform: "normalizePhone (+421…)" },
  { csv: "phone_2", target: "clinics.phone2", transform: "normalizePhone" },
  { csv: "phone_3", target: "clinics.phone3", transform: "normalizePhone" },
  { csv: "phone_4", target: "clinics.notes (append)", transform: "'Tel. 4: …'", note: "žiadne pole phone4" },
  { csv: "phone_5", target: "clinics.notes (append)", transform: "'Tel. 5: …'" },
  { csv: "phone_6", target: "clinics.notes (append)", transform: "'Tel. 6: …'" },
  { csv: "phones_all", target: "ignored", transform: "—", note: "už rozparsované" },
  { csv: "primary_email", target: "clinics.email", transform: "trim, lower" },
  { csv: "email_2", target: "clinics.email2", transform: "trim, lower" },
  { csv: "email_3", target: "clinics.email3", transform: "trim, lower" },
  { csv: "email_4", target: "clinics.notes (append)", transform: "'Email 4: …'" },
  { csv: "email_5", target: "clinics.notes (append)", transform: "'Email 5: …'" },
  { csv: "emails_all", target: "ignored", transform: "—" },
  { csv: "primary_contact_person", target: "clinics.doctor_* + collaborators[0]", transform: "parsePersonName → doctor_title/first/last + vytvorí osobu (is_primary=true)" },
  { csv: "contact_person_2", target: "collaborators[1]", transform: "parsePersonName → ďalšia osoba (is_primary=false)" },
  { csv: "contact_person_3", target: "collaborators[2]", transform: "parsePersonName" },
  { csv: "contact_person_4", target: "collaborators[3]", transform: "parsePersonName" },
  { csv: "contact_person_5", target: "collaborators[4]", transform: "parsePersonName" },
  { csv: "contact_person_6", target: "collaborators[5]", transform: "parsePersonName" },
  { csv: "contact_persons_all", target: "ignored", transform: "—" },
  { csv: "website_primary", target: "clinics.website", transform: "trim" },
  { csv: "websites_all", target: "clinics.notes (append)", transform: "split('|') → 'Ďalšie weby: …' (bez primary)" },
  { csv: "source_urls", target: "clinics.notes (append)", transform: "'Zdroj URL: …'" },
  { csv: "source_files", target: "clinics.notes (append)", transform: "'Zdroj súbory: …'" },
  { csv: "notes", target: "clinics.notes (append)", transform: "raw" },
  { csv: "contact_enriched_from_web", target: "clinics.notes (append)", transform: "ak ='1' → 'Kontakt obohatený z webu: áno'" },
  { csv: "contact_enriched_source_url", target: "clinics.notes (append)", transform: "'Zdroj obohatenia: …'" },
  { csv: "contact_enriched_note", target: "clinics.notes (append)", transform: "raw" },
  { csv: "import_tags", target: "clinics.tags", transform: "split(';') → text[]" },
  { csv: "data_quality_flags", target: "clinics.notes (append)", transform: "'Quality flags: …'" },
];

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`✗ CSV nenájdené: ${CSV_PATH}`);
    process.exit(1);
  }

  console.log(`→ Načítavam CSV: ${path.relative(process.cwd(), CSV_PATH)}`);
  const text = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parseCsv(text);
  if (rows.length < 2) {
    console.error("✗ CSV je prázdne alebo nevalidné");
    process.exit(1);
  }
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);
  console.log(`  ✓ ${dataRows.length} riadkov, ${headers.length} stĺpcov`);

  // Validovať že každý CSV stĺpec má položku v FIELD_MAP
  const mapByCsv = new Map(FIELD_MAP.map((f) => [f.csv, f]));
  const unmapped = headers.filter((h) => !mapByCsv.has(h));
  const extraInMap = FIELD_MAP.filter((f) => !headers.includes(f.csv)).map((f) => f.csv);

  // Pomocný indexer
  const colIdx = new Map(headers.map((h, i) => [h, i]));
  const get = (row: string[], col: string) => clean(row[colIdx.get(col) ?? -1]);

  // Štatistiky
  let countMedicalProvider = 0;
  const icoSet = new Set<string>();
  const idZzSet = new Set<string>();
  const externalIdSet = new Set<string>();
  let personsTotal = 0;
  const personWarnings: { row: number; raw: string; warning: string }[] = [];
  const samples: any[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const recordType = get(r, "record_type");
    if (recordType !== "medical_provider_practice") continue;
    countMedicalProvider++;

    const ico = get(r, "ico");
    const idZz = get(r, "id_zz");
    const ext = get(r, "external_id");
    if (ico) icoSet.add(ico);
    if (idZz) idZzSet.add(idZz);
    if (ext) externalIdSet.add(ext);

    const personCols = [
      "primary_contact_person",
      "contact_person_2",
      "contact_person_3",
      "contact_person_4",
      "contact_person_5",
      "contact_person_6",
    ];
    const parsedPersons: ParsedPerson[] = [];
    for (const pc of personCols) {
      const raw = get(r, pc);
      if (!raw) continue;
      const parsed = parsePersonName(raw);
      personsTotal++;
      parsedPersons.push(parsed);
      if (parsed.warning) {
        personWarnings.push({ row: i + 2, raw, warning: parsed.warning });
      }
    }

    if (samples.length < SAMPLE_COUNT) {
      samples.push({
        rowNumber: i + 2,
        clinic: {
          legacy_id: ext,
          name: get(r, "provider_name"),
          ico,
          id_zz: idZz,
          country_code: get(r, "country_code"),
          street: get(r, "street"),
          street_number: get(r, "building_number"),
          orientation_number: get(r, "orientation_number"),
          city: get(r, "city"),
          district: get(r, "district"),
          region: get(r, "region"),
          phone: get(r, "primary_phone"),
          phone2: get(r, "phone_2"),
          email: get(r, "primary_email"),
          website: get(r, "website_primary"),
          pzs_code: get(r, "kod_pzs_primary"),
          tags: splitTags(get(r, "import_tags") ?? ""),
        },
        primaryPerson: parsedPersons[0] ?? null,
        otherPersons: parsedPersons.slice(1),
      });
    }
  }

  // ──── DB porovnanie ────
  console.log(`→ Porovnávam s DB (clinics) …`);
  const existingClinics = await db
    .select({
      id: clinics.id,
      legacyId: clinics.legacyId,
      ico: clinics.ico,
      idZz: clinics.idZz,
      name: clinics.name,
    })
    .from(clinics);

  const byLegacy = new Map<string, (typeof existingClinics)[0]>();
  const byIco = new Map<string, (typeof existingClinics)[0][]>();
  const byIdZz = new Map<string, (typeof existingClinics)[0]>();
  for (const c of existingClinics) {
    if (c.legacyId) byLegacy.set(c.legacyId, c);
    if (c.idZz) byIdZz.set(c.idZz, c);
    if (c.ico) {
      const arr = byIco.get(c.ico) ?? [];
      arr.push(c);
      byIco.set(c.ico, arr);
    }
  }

  let matchByLegacy = 0;
  let matchByIdZz = 0;
  let matchByIco = 0;
  let willInsert = 0;
  const csvIcoCount = new Map<string, number>();
  for (const r of dataRows) {
    if (get(r, "record_type") !== "medical_provider_practice") continue;
    const ext = get(r, "external_id");
    const idZz = get(r, "id_zz");
    const ico = get(r, "ico");
    if (ico) csvIcoCount.set(ico, (csvIcoCount.get(ico) ?? 0) + 1);
    let matched = false;
    if (ext && byLegacy.has(ext)) {
      matchByLegacy++;
      matched = true;
    } else if (idZz && byIdZz.has(idZz)) {
      matchByIdZz++;
      matched = true;
    } else if (ico && byIco.has(ico)) {
      matchByIco++;
      matched = true;
    }
    if (!matched) willInsert++;
  }

  const csvDuplicateIcos = [...csvIcoCount.entries()].filter(([, n]) => n > 1);

  // Counts in collaborators table (kto bude zlinkovaný)
  const [{ collabCount }] = await db.execute<{ collabCount: number }>(
    sql`SELECT COUNT(*)::int AS "collabCount" FROM collaborators`,
  ).then((r) => r.rows as any);
  const [{ assignmentCount }] = await db.execute<{ assignmentCount: number }>(
    sql`SELECT COUNT(*)::int AS "assignmentCount" FROM contact_assignments WHERE entity_type = 'clinic'`,
  ).then((r) => r.rows as any);

  // ──── Markdown report ────
  const md: string[] = [];
  md.push(`# INDEXUS Import – Mapping Report`);
  md.push(``);
  md.push(`> Read-only analýza CSV → cieľové DB polia. Žiadny zápis sa neudial.`);
  md.push(``);
  md.push(`**CSV súbor:** \`${path.relative(process.cwd(), CSV_PATH)}\``);
  md.push(`**Vygenerované:** ${new Date().toISOString()}`);
  md.push(``);
  md.push(`## 1. Zhrnutie`);
  md.push(``);
  md.push(`| Metrika | Hodnota |`);
  md.push(`|---|---|`);
  md.push(`| CSV riadkov spolu | ${dataRows.length} |`);
  md.push(`| Riadkov \`record_type = medical_provider_practice\` | ${countMedicalProvider} |`);
  md.push(`| Unikátnych \`external_id\` | ${externalIdSet.size} |`);
  md.push(`| Unikátnych \`ICO\` | ${icoSet.size} |`);
  md.push(`| Unikátnych \`id_zz\` | ${idZzSet.size} |`);
  md.push(`| Osôb na extrakciu (kontaktné osoby spolu) | ${personsTotal} |`);
  md.push(`| **Existujúcich kliník v DB** | ${existingClinics.length} |`);
  md.push(`| Match podľa \`legacy_id\` (= external_id) | ${matchByLegacy} |`);
  md.push(`| Match podľa \`id_zz\` | ${matchByIdZz} |`);
  md.push(`| Match podľa \`ICO\` | ${matchByIco} |`);
  md.push(`| **Nové kliniky (INSERT)** | ${willInsert} |`);
  md.push(`| **UPDATE kliník** | ${matchByLegacy + matchByIdZz + matchByIco} |`);
  md.push(`| Existujúcich osôb (collaborators) v DB | ${collabCount} |`);
  md.push(`| Existujúcich väzieb klinika↔osoba | ${assignmentCount} |`);
  md.push(``);
  md.push(`## 2. UPSERT stratégia`);
  md.push(``);
  md.push(`Klinika sa hľadá v tomto poradí (prvý nájdený match vyhráva):`);
  md.push(``);
  md.push(`1. \`clinics.legacy_id\` = CSV \`external_id\` *(najpresnejšie – stabilný kľúč zo zdrojového systému)*`);
  md.push(`2. \`clinics.id_zz\` = CSV \`id_zz\``);
  md.push(`3. \`clinics.ico\` = CSV \`ico\` *(POZOR: ICO nie je unikátne – jedno IČO môže mať viac ambulancií. Ak match vráti viac kliník, riadok sa OZNAČÍ a NEZAPÍŠE bez manuálneho rozhodnutia.)*`);
  md.push(``);
  md.push(`Osoby (kontaktné):`);
  md.push(``);
  md.push(`- pre každý riadok CSV sa spracuje 1–6 kontaktných osôb (\`primary_contact_person\` + \`contact_person_2..6\`)`);
  md.push(`- match osoby v DB: \`collaborators.last_name\` + \`collaborators.first_name\` (case-insensitive) v rámci tej istej kliniky`);
  md.push(`- ak osoba v DB neexistuje → INSERT do \`collaborators\` + INSERT do \`contact_assignments(entity_type='clinic', entity_id=clinic.id, is_primary=…)\``);
  md.push(`- ak existuje → UPDATE základných polí (titly, telefón, email iba ak sú v CSV vyplnené a v DB prázdne; UPSERT NIKDY nemaže existujúce hodnoty)`);
  md.push(``);
  md.push(`Lekár-vedúci kliniky (\`primary_contact_person\`) sa **navyše** zapíše aj do polí klinky \`doctor_title\`, \`doctor_first_name\`, \`doctor_last_name\`, \`doctor_name\` (kvôli kompatibilite s formulárom), ak sú prázdne.`);
  md.push(``);
  md.push(`## 3. Mapovanie CSV → DB (návrh)`);
  md.push(``);
  md.push(`| # | CSV stĺpec | Cieľ | Transformácia | Pozn. |`);
  md.push(`|---|---|---|---|---|`);
  FIELD_MAP.forEach((f, idx) => {
    md.push(
      `| ${idx + 1} | \`${f.csv}\` | \`${f.target}\` | ${f.transform} | ${f.note ?? ""} |`,
    );
  });
  md.push(``);
  if (unmapped.length) {
    md.push(`### ⚠ CSV stĺpce bez mapovania`);
    md.push(``);
    unmapped.forEach((c) => md.push(`- \`${c}\``));
    md.push(``);
  }
  if (extraInMap.length) {
    md.push(`### ⚠ Mapovania bez CSV stĺpca`);
    md.push(``);
    extraInMap.forEach((c) => md.push(`- \`${c}\``));
    md.push(``);
  }

  md.push(`## 4. Vzorové riadky (${samples.length})`);
  md.push(``);
  samples.forEach((s, i) => {
    md.push(`### Vzorka ${i + 1} (CSV riadok ${s.rowNumber})`);
    md.push(``);
    md.push(`**Klinika:**`);
    md.push("");
    md.push("```json");
    md.push(JSON.stringify(s.clinic, null, 2));
    md.push("```");
    md.push("");
    md.push(`**Hlavná osoba (primary_contact_person):**`);
    md.push("");
    md.push("```json");
    md.push(JSON.stringify(s.primaryPerson, null, 2));
    md.push("```");
    if (s.otherPersons.length) {
      md.push("");
      md.push(`**Ďalšie osoby (${s.otherPersons.length}):**`);
      md.push("");
      md.push("```json");
      md.push(JSON.stringify(s.otherPersons, null, 2));
      md.push("```");
    }
    md.push(``);
  });

  md.push(`## 5. Duplicity / problémy v CSV`);
  md.push(``);
  if (csvDuplicateIcos.length) {
    md.push(`### Viacnásobné riadky s rovnakým ICO (${csvDuplicateIcos.length})`);
    md.push(``);
    md.push(`Tieto IČO sa v CSV vyskytujú viackrát – pre nich sa UPSERT bude opierať o \`external_id\` alebo \`id_zz\`, nie o \`ico\`:`);
    md.push(``);
    csvDuplicateIcos.slice(0, 50).forEach(([ico, n]) => md.push(`- \`${ico}\` × ${n}`));
    if (csvDuplicateIcos.length > 50) md.push(`- … a ďalších ${csvDuplicateIcos.length - 50}`);
    md.push(``);
  } else {
    md.push(`Všetky ICO v CSV sú unikátne. ✓`);
    md.push(``);
  }
  if (personWarnings.length) {
    md.push(`### Problémové parsovania mien (${personWarnings.length})`);
    md.push(``);
    personWarnings.slice(0, 30).forEach((w) =>
      md.push(`- riadok ${w.row}: \`${w.raw.replace(/\n/g, " ")}\` – ${w.warning}`),
    );
    if (personWarnings.length > 30) md.push(`- … a ďalších ${personWarnings.length - 30}`);
    md.push(``);
  } else {
    md.push(`Všetky mená sa rozparsovali bez varovania. ✓`);
    md.push(``);
  }

  md.push(`## 6. DB polia v \`clinics\`, ktoré CSV nepokrýva`);
  md.push(``);
  md.push(`Tieto polia v CSV nie sú prítomné a pri UPDATE existujúcich kliník zostanú **nedotknuté**:`);
  md.push(``);
  md.push(`- \`postal_code\` *(SK CSV ho neobsahuje – ostane to čo je v DB)*`);
  md.push(`- \`latitude\`, \`longitude\``);
  md.push(`- \`is_active\`, \`is_referred_by_doctor\`, \`is_from_conference\``);
  md.push(`- \`lead_source\`, \`lead_source_date\`, \`lead_source_notes\``);
  md.push(`- \`conference_name\`, \`conference_date\``);
  md.push(`- \`initial_status\`, \`interest_cooperation\`, \`interest_contract\`, \`contract_status\``);
  md.push(`- \`last_call_result\`, \`last_call_note\`, \`next_contact_date\``);
  md.push(`- \`contract_sent_date\`, \`contract_returned_date\``);
  md.push(`- \`has_flyers\`, \`flyers_sent_date\`, \`flyers_location\``);
  md.push(`- \`doctor_position_category_id\` *(ak chceš, vieme ho odvodiť z titulu \`MUDr.\` → \"doctor\")*`);
  md.push(``);
  md.push(`## 7. Otvorené otázky pre teba (potvrď / oprav)`);
  md.push(``);
  md.push(`1. **\`primary_specialty\`** (\`gynecology_obstetrics\`) – mám ho zapísať len do \`notes\`, alebo chceš ho mapovať na nejakú iné pole (napr. nový \`primary_specialty\` stĺpec)?`);
  md.push(`2. **Poisťovne** (\`insurance_vszp/dovera/union\`) – stačí v \`notes\`, alebo chceš preto vytvoriť relácie cez \`health_insurance_companies\` (vyžaduje schema change)?`);
  md.push(`3. **Telefóny 4–6, e-maily 4–5** – aktuálne idú do \`notes\`. OK, alebo majú ísť do \`contact_channels\` (per-osoba)?`);
  md.push(`4. **\`primary_contact_person\`** – má sa skopírovať do \`clinics.doctor_*\` polí len ak sú prázdne, alebo vždy prepísať?`);
  md.push(`5. **Tagy** (\`import_tags\`) – navrhujem doplniť každej importovanej klinike navyše tag \`indexus_import_2026_04\` na ľahkú identifikáciu. OK?`);
  md.push(`6. **Match podľa ICO** – ak existuje viac kliník s rovnakým ICO, navrhujem riadok preskočiť a zalogovať. Alebo radšej priradiť k tej s najpresnejším id_zz?`);
  md.push(`7. **Polia, ktoré v CSV chýbajú** (napr. \`postal_code\`, \`latitude/longitude\`) – nechať existujúce hodnoty v DB nedotknuté pri UPDATE? *(odporúčané)*`);
  md.push(``);

  md.push(`## 7. Ďalšie kroky`);
  md.push(``);
  md.push(`Po tom, čo schváliš (alebo upravíš) toto mapovanie, pripravím zápisový script \`scripts/import-clinics-write.ts\` s týmito vlastnosťami:`);
  md.push(``);
  md.push(`- \`--dry-run\` (default) – iba vypíše čo by spravil, nič nezapíše`);
  md.push(`- \`--commit\` – skutočný zápis v jednej DB transakcii pre každý riadok`);
  md.push(`- \`--limit=N\` – spracuje len prvých N riadkov`);
  md.push(`- log do \`attached_assets/import_run_<timestamp>.log\``);
  md.push(`- pre UPDATE NIKDY nemaže existujúce non-null polia`);
  md.push(`- bezpečné spustenie aj na Replit aj na Ubuntu (\`DATABASE_URL=… npx tsx scripts/import-clinics-write.ts --commit\`)`);
  md.push(``);

  fs.writeFileSync(REPORT_PATH, md.join("\n"), "utf-8");

  // ──── Konzola ────
  console.log(``);
  console.log(`════════════════════════════════════════════════════════════`);
  console.log(`  Mapping report uložený do:`);
  console.log(`    ${path.relative(process.cwd(), REPORT_PATH)}`);
  console.log(`════════════════════════════════════════════════════════════`);
  console.log(``);
  console.log(`Krátke zhrnutie:`);
  console.log(`  • CSV riadkov:               ${dataRows.length}`);
  console.log(`  • Z toho ambulancií:         ${countMedicalProvider}`);
  console.log(`  • Unikátnych external_id:    ${externalIdSet.size}`);
  console.log(`  • Unikátnych ICO:            ${icoSet.size}`);
  console.log(`  • Osôb na extrakciu:         ${personsTotal}`);
  console.log(`  • Existujúce kliniky v DB:   ${existingClinics.length}`);
  console.log(`  • Match by legacy_id:        ${matchByLegacy}`);
  console.log(`  • Match by id_zz:            ${matchByIdZz}`);
  console.log(`  • Match by ICO:              ${matchByIco}`);
  console.log(`  • → INSERT (nové kliniky):   ${willInsert}`);
  console.log(`  • → UPDATE (existujúce):     ${matchByLegacy + matchByIdZz + matchByIco}`);
  if (unmapped.length) {
    console.log(``);
    console.log(`  ⚠ ${unmapped.length} CSV stĺpcov bez mapovania:`);
    unmapped.forEach((c) => console.log(`     - ${c}`));
  }
  if (personWarnings.length) {
    console.log(``);
    console.log(`  ⚠ ${personWarnings.length} mien sa parsovalo s warningom (detail v reporte)`);
  }
  console.log(``);
  console.log(`Pozri report a daj mi vedieť úpravy mapovania (alebo OK).`);
  console.log(`Žiadny zápis do DB sa neudial.`);

  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Chyba:", err);
  process.exit(1);
});
