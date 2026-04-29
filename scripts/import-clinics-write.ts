/**
 * INDEXUS – Zápisový skript pre import SK gynekologických ambulancií z CSV.
 *
 * Vstup:  attached_assets/indexus_gyn_data_import_*.csv
 * Výstup: zápis do `clinics`, `collaborators` (cez `contact_assignments`)
 *         + audit log do attached_assets/import_write_log_<TS>.md
 *
 * Defaultne beží v --dry-run režime (žiadny zápis do DB).
 * Pre reálny zápis použi flag `--commit`.
 *
 * Spustenie:
 *   npx tsx scripts/import-clinics-write.ts                # dry-run, prvá ukážka
 *   npx tsx scripts/import-clinics-write.ts --limit=5      # dry-run len 5 ambulancií
 *   npx tsx scripts/import-clinics-write.ts --commit       # REÁLNY zápis (so súhlasom)
 *   npx tsx scripts/import-clinics-write.ts --commit --limit=5
 *
 * Pravidlá:
 *  • UPSERT key = id_zz (primárny), inak fuzzy name+city (Levenshtein) –
 *    rovnaká logika ako v import-clinics-mapping.ts.
 *  • UPDATE NIKDY NEMAŽE existujúce non-null polia. Zapíše iba prázdne polia
 *    (vrátane doctor_*).
 *  • legacy_id sa NIKDY nedotýka (zostane prázdne / nezmenené).
 *  • IČO sa NEpoužíva ako match key (jedna firma môže mať viac ambulancií).
 *  • Pri ambiguite (>1 kandidát s podobným skóre) sa riadok PRESKOČÍ
 *    – nezapíše sa ani INSERT ani UPDATE; treba ručnú intervenciu.
 *  • Osoby (primary_contact_person, contact_person_2..6) sa vytvoria ako
 *    `collaborators` + `contact_assignments` (entityType=clinic).
 *    Pri opakovaných spusteniach sa duplicitné osoby nevytvárajú –
 *    match podľa (clinicId, firstName, lastName).
 *  • Pripojenie k DB cez existujúci `server/db.ts` (DATABASE_URL).
 */

import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "../server/db";
import { clinics, collaborators, contactAssignments, collaboratorAddresses } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";

// ────────────────────────────────────────────────────────────────────────────
// CLI argumenty
// ────────────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const COMMIT = args.commit === "true";
const LIMIT = args.limit ? Number(args.limit) : null;
const CSV_PATH = path.resolve(
  process.cwd(),
  String(args.csv ?? "attached_assets/indexus_gyn_data_import_1777373378251.csv"),
);
const LOG_TS = new Date().toISOString().replace(/[:.]/g, "-");
const LOG_PATH = path.resolve(
  process.cwd(),
  `attached_assets/import_write_log_${LOG_TS}.md`,
);

// ────────────────────────────────────────────────────────────────────────────
// CSV parser (RFC4180-light)
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
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        // skip
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r[0] && r[0].trim() !== ""));
}

// ────────────────────────────────────────────────────────────────────────────
// Helpery
// ────────────────────────────────────────────────────────────────────────────
const PIPE = /\s*\|\s*/;

function clean(v: string | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function splitPipe(v: string | undefined | null): string[] {
  if (!v) return [];
  return v.split(PIPE).map((s) => s.trim()).filter(Boolean);
}

function normalizePhone(v: string | null): string | null {
  if (!v) return null;
  // ponechá '+' a číslice, inde whitespace skomprimuje
  const t = v.replace(/\s+/g, " ").trim();
  return t || null;
}

function normalizeEmail(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  return t || null;
}

function normalizeAddress(v: string | null): string | null {
  if (!v) return null;
  const t = v.replace(/\s*\n\s*/g, ", ").replace(/\s+/g, " ").trim();
  return t || null;
}

function digitsOnly(v: string | null): string | null {
  if (!v) return null;
  const t = v.replace(/\D+/g, "");
  return t || null;
}

// Tituly
const TITLE_BEFORE = new Set([
  "MUDr.", "MDDr.", "MVDr.", "PharmDr.", "Mgr.", "Bc.", "Ing.", "JUDr.",
  "RNDr.", "PaedDr.", "PhDr.", "ThDr.", "Dr.", "doc.", "prof.", "akad.",
  "MUDr", "MDDr", "Ing", "Mgr", "Bc",
]);
const TITLE_AFTER = new Set([
  "PhD.", "PhD", "CSc.", "CSc", "DrSc.", "DrSc", "MBA", "MPH",
  "FEBS", "FEBO", "FACS", "MHA", "DiS.", "DiS", "MSc.", "MSc",
]);

interface ParsedPerson {
  raw: string;
  titleBefore: string | null;
  firstName: string | null;
  lastName: string | null;
  titleAfter: string | null;
  warning?: string;
}

function parsePersonName(raw: string): ParsedPerson {
  const original = raw.trim();
  if (!original) {
    return { raw, titleBefore: null, firstName: null, lastName: null, titleAfter: null, warning: "empty" };
  }
  const [namePart, ...afterParts] = original.split(",");
  const afterTitles = afterParts.map((s) => s.trim()).filter(Boolean);
  const tokens = namePart.trim().split(/\s+/);
  const titlesBefore: string[] = [];
  const nameTokens: string[] = [];
  for (const tok of tokens) {
    const norm = tok.endsWith(".") ? tok : tok + ".";
    if (TITLE_BEFORE.has(tok) || TITLE_BEFORE.has(norm) || /^(prof|doc|akad)\./i.test(tok)) {
      titlesBefore.push(tok);
    } else {
      nameTokens.push(tok);
    }
  }
  while (nameTokens.length > 0) {
    const last = nameTokens[nameTokens.length - 1];
    const norm = last.endsWith(".") ? last : last + ".";
    if (TITLE_AFTER.has(last) || TITLE_AFTER.has(norm)) {
      afterTitles.unshift(nameTokens.pop()!);
    } else break;
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

function buildDoctorFullName(p: ParsedPerson): string | null {
  if (!p.firstName && !p.lastName) return null;
  const parts = [p.titleBefore, p.firstName, p.lastName].filter(Boolean);
  let out = parts.join(" ");
  if (p.titleAfter) out += `, ${p.titleAfter}`;
  return out.trim() || null;
}

// Web URL
const PORTAL_DOMAINS = [
  /e-vuc\.sk/i, /zoznam\.sk/i, /azet\.sk/i,
  /mojaambulancia\.sk/i, /najlekar\.sk/i,
];
function isPortalUrl(u: string): boolean {
  return PORTAL_DOMAINS.some((rx) => rx.test(u));
}
function rootUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/^https?:$/i.test(u.protocol)) return null;
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return null;
  }
}
function pickClinicWebsite(piped: string | null | undefined): string | null {
  if (!piped) return null;
  const candidates = splitPipe(piped)
    .filter((u) => /^https?:\/\//i.test(u))
    .filter((u) => !isPortalUrl(u));
  if (!candidates.length) return null;
  const freq = new Map<string, number>();
  for (const u of candidates) {
    const root = rootUrl(u);
    if (root) freq.set(root, (freq.get(root) ?? 0) + 1);
  }
  if (!freq.size) return rootUrl(candidates[candidates.length - 1]);
  let best = "";
  let bestN = -1;
  for (const [root, n] of freq) {
    if (n >= bestN) {
      bestN = n;
      best = root;
    }
  }
  return best || null;
}

// Fuzzy match
function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(s\s*r\s*o|spol\s*s\s*r\s*o|akciova\s*spolocnost|a\s*s|n\s*o)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const al = a.length;
  const bl = b.length;
  let prev = new Array(bl + 1);
  let curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}
function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / maxLen;
}
const NAME_SIM_THRESHOLD = 0.85;
const CITY_SIM_THRESHOLD = 0.9;
const AMBIGUITY_GAP = 0.05;

// ────────────────────────────────────────────────────────────────────────────
// Špecializačná mapa (en kľúč → SK label)
// ────────────────────────────────────────────────────────────────────────────
const SPECIALTY_LABEL: Record<string, string> = {
  gynecology_obstetrics: "gynekológia a pôrodníctvo",
  gynaecology_obstetrics: "gynekológia a pôrodníctvo",
  gynaecology: "gynekológia a pôrodníctvo",
  gynecology: "gynekológia a pôrodníctvo",
  obstetrics: "gynekológia a pôrodníctvo",
};

// ────────────────────────────────────────────────────────────────────────────
// Hlavná logika
// ────────────────────────────────────────────────────────────────────────────
type ExistingClinic = {
  id: string;
  legacyId: string | null;
  ico: string | null;
  idZz: string | null;
  name: string;
  city: string | null;
};

type ClinicWritePlan =
  | { kind: "INSERT"; csvRow: number; data: typeof clinics.$inferInsert }
  | {
      kind: "UPDATE";
      csvRow: number;
      clinicId: string;
      matchType: "id_zz" | "name_city_exact" | "name_city_fuzzy";
      score: number;
      diff: Record<string, { from: any; to: any }>;
    }
  | {
      kind: "SKIP_AMBIGUOUS";
      csvRow: number;
      name: string;
      city: string | null;
      candidates: { dbName: string; dbCity: string | null; score: number }[];
    };

type PersonPlan = {
  csvRow: number;
  csvIndex: number; // 0 = primary_contact_person, 1..5 = contact_person_2..6
  parsed: ParsedPerson;
  isPrimary: boolean;
  position: string | null; // "Lekár" pre primary
};

async function main() {
  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`  INDEXUS – Import ambulancií ${COMMIT ? "(REÁLNY ZÁPIS)" : "(DRY-RUN)"}`);
  console.log(`══════════════════════════════════════════════════════════`);
  console.log(`  CSV:    ${CSV_PATH}`);
  console.log(`  Limit:  ${LIMIT ?? "—"}`);
  console.log(`  Commit: ${COMMIT}`);
  console.log(``);

  // ── 1. Načítaj CSV ──
  const text = await fs.readFile(CSV_PATH, "utf8");
  const all = parseCsv(text);
  if (all.length < 2) throw new Error("CSV je prázdne");
  const header = all[0];
  const dataRows = all.slice(1);
  console.log(`→ Načítaných ${dataRows.length} riadkov, ${header.length} stĺpcov`);

  const colIdx = new Map<string, number>();
  header.forEach((h, i) => colIdx.set(h.trim(), i));
  const get = (r: string[], col: string) => clean(r[colIdx.get(col) ?? -1]);

  // ── 2. Načítaj existujúce kliniky pre fuzzy match ──
  console.log(`→ Načítavam existujúce kliniky z DB …`);
  const existingClinics: ExistingClinic[] = await db
    .select({
      id: clinics.id,
      legacyId: clinics.legacyId,
      ico: clinics.ico,
      idZz: clinics.idZz,
      name: clinics.name,
      city: clinics.city,
    })
    .from(clinics);
  console.log(`  ✓ ${existingClinics.length} existujúcich kliník v DB`);

  const byIdZz = new Map<string, ExistingClinic>();
  const byCity = new Map<string, ExistingClinic[]>();
  for (const c of existingClinics) {
    if (c.idZz) byIdZz.set(c.idZz, c);
    const nCity = normalizeName(c.city);
    const arr = byCity.get(nCity) ?? [];
    arr.push(c);
    byCity.set(nCity, arr);
  }

  function findFuzzyCandidates(name: string, city: string | null) {
    const nName = normalizeName(name);
    const nCity = normalizeName(city);
    if (!nName) return [];
    const cityKeys = [nCity];
    if (nCity) {
      for (const k of byCity.keys()) {
        if (k === nCity || !k) continue;
        if (similarity(k, nCity) >= CITY_SIM_THRESHOLD) cityKeys.push(k);
      }
    }
    const pool: ExistingClinic[] = [];
    for (const ck of cityKeys) {
      const arr = byCity.get(ck);
      if (arr) pool.push(...arr);
    }
    if (!pool.length) return [];
    const scored: { c: ExistingClinic; score: number }[] = [];
    for (const c of pool) {
      const sc = similarity(normalizeName(c.name), nName);
      if (sc >= NAME_SIM_THRESHOLD) scored.push({ c, score: sc });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  // ── 3. Sprav plán pre každý CSV riadok ──
  console.log(`→ Pripravujem UPSERT plán …`);
  const plans: ClinicWritePlan[] = [];
  const personPlans: {
    clinicLookup: { csvRow: number };
    persons: PersonPlan[];
    clinicAddress: {
      name: string;
      streetNumber: string | null;
      city: string | null;
      region: string | null;
      countryCode: string;
    };
  }[] = [];

  let processed = 0;
  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    if (get(r, "record_type") !== "medical_provider_practice") continue;
    if (LIMIT !== null && processed >= LIMIT) break;
    processed++;
    const rowNum = i + 2;

    // ── extrahuj polia ──
    const name = get(r, "provider_name");
    if (!name) {
      plans.push({
        kind: "SKIP_AMBIGUOUS",
        csvRow: rowNum,
        name: "(prázdne)",
        city: null,
        candidates: [],
      });
      continue;
    }
    const idZz = get(r, "id_zz");
    const ico = digitsOnly(get(r, "ico"));
    const city = get(r, "city");

    const websiteFallback = pickClinicWebsite(
      [get(r, "website_primary"), get(r, "websites_all"), get(r, "source_urls")]
        .filter(Boolean)
        .join(" | "),
    );

    // poznámky: legal_name, primary_specialty, kod_pzs_all, notes
    const noteParts: string[] = [];
    const legalName = get(r, "legal_name");
    if (legalName && legalName !== name) noteParts.push(`Právny názov: ${legalName}`);
    const primarySpec = get(r, "primary_specialty");
    if (primarySpec) {
      const skLabel = SPECIALTY_LABEL[primarySpec.toLowerCase()] ?? primarySpec;
      noteParts.push(`Špecializácia: ${skLabel}`);
    }
    const kodPzsAll = splitPipe(get(r, "kod_pzs_all"));
    if (kodPzsAll.length) noteParts.push(`Všetky kódy PZS: ${kodPzsAll.join(", ")}`);
    const csvNotes = get(r, "notes");
    if (csvNotes) noteParts.push(csvNotes);
    const newNotes = noteParts.length ? noteParts.join("\n\n") : null;

    // doctor_* z primary_contact_person
    const primaryName = get(r, "primary_contact_person");
    const primaryParsed = primaryName ? parsePersonName(primaryName) : null;

    const csvFields: Partial<typeof clinics.$inferInsert> = {
      name,
      idZz: idZz ?? undefined,
      ico: ico ?? undefined,
      countryCode: get(r, "country_code") ?? "SK",
      pzsCode: get(r, "kod_pzs_primary"),
      pzsName: get(r, "kod_pzs_description"),
      street: get(r, "street"),
      streetNumber: get(r, "building_number"),
      orientationNumber: get(r, "orientation_number"),
      city: city ?? undefined,
      district: get(r, "district"),
      region: get(r, "region"),
      address: normalizeAddress(get(r, "address_full")),
      phone: normalizePhone(get(r, "primary_phone")),
      phone2: normalizePhone(get(r, "phone_2")),
      phone3: normalizePhone(get(r, "phone_3")),
      email: normalizeEmail(get(r, "primary_email")),
      email2: normalizeEmail(get(r, "email_2")),
      email3: normalizeEmail(get(r, "email_3")),
      website: websiteFallback,
      notes: newNotes,
      doctorTitle: primaryParsed?.titleBefore ?? null,
      doctorFirstName: primaryParsed?.firstName ?? null,
      doctorLastName: primaryParsed?.lastName ?? null,
      doctorName: primaryParsed ? buildDoctorFullName(primaryParsed) : null,
    };

    // ── match logika ──
    let matched: { clinic: ExistingClinic; type: "id_zz" | "name_city_exact" | "name_city_fuzzy"; score: number } | null = null;
    if (idZz && byIdZz.has(idZz)) {
      matched = { clinic: byIdZz.get(idZz)!, type: "id_zz", score: 1 };
    } else {
      const cands = findFuzzyCandidates(name, city);
      if (cands.length === 1) {
        matched = {
          clinic: cands[0].c,
          type: cands[0].score >= 0.999 ? "name_city_exact" : "name_city_fuzzy",
          score: cands[0].score,
        };
      } else if (cands.length > 1) {
        if (cands[0].score - cands[1].score >= AMBIGUITY_GAP) {
          matched = {
            clinic: cands[0].c,
            type: cands[0].score >= 0.999 ? "name_city_exact" : "name_city_fuzzy",
            score: cands[0].score,
          };
        } else {
          plans.push({
            kind: "SKIP_AMBIGUOUS",
            csvRow: rowNum,
            name,
            city,
            candidates: cands.slice(0, 5).map((m) => ({
              dbName: m.c.name,
              dbCity: m.c.city,
              score: Math.round(m.score * 1000) / 1000,
            })),
          });
          // nepriradiť osoby — preskakuje sa celý riadok
          continue;
        }
      }
    }

    if (!matched) {
      // INSERT — naplň kompletnú novú kliniku
      const insertData: typeof clinics.$inferInsert = {
        name,
        countryCode: csvFields.countryCode ?? "SK",
        initialStatus: "not_contacted",
        idZz: csvFields.idZz,
        ico: csvFields.ico,
        pzsCode: csvFields.pzsCode,
        pzsName: csvFields.pzsName,
        street: csvFields.street,
        streetNumber: csvFields.streetNumber,
        orientationNumber: csvFields.orientationNumber,
        city: csvFields.city,
        district: csvFields.district,
        region: csvFields.region,
        address: csvFields.address,
        phone: csvFields.phone,
        phone2: csvFields.phone2,
        phone3: csvFields.phone3,
        email: csvFields.email,
        email2: csvFields.email2,
        email3: csvFields.email3,
        website: csvFields.website,
        notes: csvFields.notes,
        doctorTitle: csvFields.doctorTitle,
        doctorFirstName: csvFields.doctorFirstName,
        doctorLastName: csvFields.doctorLastName,
        doctorName: csvFields.doctorName,
      };
      plans.push({ kind: "INSERT", csvRow: rowNum, data: insertData });
    } else {
      // UPDATE — pripravíme diff (iba prázdne polia naplníme)
      const dbRow = await db
        .select()
        .from(clinics)
        .where(eq(clinics.id, matched.clinic.id))
        .limit(1);
      const existing = dbRow[0];
      const diff: Record<string, { from: any; to: any }> = {};
      const FILL_IF_EMPTY: (keyof typeof clinics.$inferInsert)[] = [
        "idZz", "ico", "pzsCode", "pzsName",
        "street", "streetNumber", "orientationNumber",
        "city", "district", "region", "address",
        "phone", "phone2", "phone3",
        "email", "email2", "email3",
        "website",
        "doctorTitle", "doctorFirstName", "doctorLastName", "doctorName",
      ];
      for (const k of FILL_IF_EMPTY) {
        const newVal = (csvFields as any)[k];
        const oldVal = (existing as any)[k];
        if (newVal != null && newVal !== "" && (oldVal == null || oldVal === "")) {
          diff[k as string] = { from: oldVal ?? null, to: newVal };
        }
      }
      // notes: append iba tie časti, ktoré v existujúcich poznámkach ešte nie sú
      // (idempotentné – opakované spustenie už nepridá nič)
      if (newNotes && newNotes.trim()) {
        const oldNotes = (existing.notes ?? "").trim();
        const newParts = newNotes.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
        const partsToAdd = newParts.filter((p) => !oldNotes.includes(p));
        if (partsToAdd.length) {
          const merged = oldNotes ? `${oldNotes}\n\n${partsToAdd.join("\n\n")}` : partsToAdd.join("\n\n");
          diff["notes"] = { from: oldNotes || null, to: merged };
        }
      }
      plans.push({
        kind: "UPDATE",
        csvRow: rowNum,
        clinicId: matched.clinic.id,
        matchType: matched.type,
        score: Math.round(matched.score * 1000) / 1000,
        diff,
      });
    }

    // ── osoby ──
    const persons: PersonPlan[] = [];
    const personCols = [
      "primary_contact_person",
      "contact_person_2",
      "contact_person_3",
      "contact_person_4",
      "contact_person_5",
      "contact_person_6",
    ];
    personCols.forEach((col, idx) => {
      const raw = get(r, col);
      if (!raw) return;
      const parsed = parsePersonName(raw);
      if (!parsed.lastName) return; // nezapisujme bez priezviska
      persons.push({
        csvRow: rowNum,
        csvIndex: idx,
        parsed,
        isPrimary: idx === 0,
        position: idx === 0 ? "Súkromný gynekológ" : null,
      });
    });
    if (persons.length) {
      personPlans.push({
        clinicLookup: { csvRow: rowNum },
        persons,
        clinicAddress: {
          name,
          streetNumber: [csvFields.street, csvFields.streetNumber].filter(Boolean).join(" ") || null,
          city: csvFields.city ?? null,
          region: csvFields.region ?? null,
          countryCode: csvFields.countryCode ?? "SK",
        },
      });
    }
  }

  // ── 4. Sumár plánu ──
  const inserts = plans.filter((p) => p.kind === "INSERT").length;
  const updates = plans.filter((p) => p.kind === "UPDATE").length;
  const skips = plans.filter((p) => p.kind === "SKIP_AMBIGUOUS").length;
  const updatesWithChanges = plans.filter(
    (p) => p.kind === "UPDATE" && Object.keys(p.diff).length > 0,
  ).length;
  const updatesNoOp = updates - updatesWithChanges;
  const totalPersons = personPlans.reduce((s, x) => s + x.persons.length, 0);

  console.log(``);
  console.log(`════════════════════════════════════════════════════════════`);
  console.log(`  Plán pripravený${LIMIT !== null ? ` (limit ${LIMIT})` : ""}:`);
  console.log(`    INSERT:     ${inserts}`);
  console.log(`    UPDATE:     ${updates} (z toho s reálnymi zmenami: ${updatesWithChanges}, no-op: ${updatesNoOp})`);
  console.log(`    SKIP (amb): ${skips}`);
  console.log(`    Osoby:      ${totalPersons}`);
  console.log(`════════════════════════════════════════════════════════════`);

  // ── 5. Zápis (alebo dry-run) ──
  let actuallyInserted = 0;
  let actuallyUpdated = 0;
  let actuallyPersons = 0;
  let actuallyAssignments = 0;
  const errors: { csvRow: number; error: string }[] = [];

  if (!COMMIT) {
    console.log(`\n⚠ DRY-RUN: žiadne zmeny v DB. Pre reálny zápis pridaj flag --commit.`);
  } else {
    console.log(`\n→ ZAPISUJEM do DB (transakcia per klinika) …`);
    // Map: csvRow → clinicId (aby sme priradili osoby aj pre INSERT-nuté kliniky)
    const csvRowToClinicId = new Map<number, string>();

    for (const p of plans) {
      if (p.kind === "SKIP_AMBIGUOUS") continue;
      try {
        await db.transaction(async (tx) => {
          if (p.kind === "INSERT") {
            const [row] = await tx.insert(clinics).values(p.data).returning({ id: clinics.id });
            csvRowToClinicId.set(p.csvRow, row.id);
            actuallyInserted++;
          } else if (p.kind === "UPDATE") {
            csvRowToClinicId.set(p.csvRow, p.clinicId);
            const fieldsToUpdate = Object.fromEntries(
              Object.entries(p.diff).map(([k, v]) => [k, v.to]),
            );
            if (Object.keys(fieldsToUpdate).length === 0) return; // no-op
            await tx
              .update(clinics)
              .set({ ...fieldsToUpdate, updatedAt: sql`now()` })
              .where(eq(clinics.id, p.clinicId));
            actuallyUpdated++;
          }
        });
      } catch (e: any) {
        errors.push({ csvRow: p.csvRow, error: String(e?.message ?? e) });
      }
    }

    // Osoby — po klinikách
    for (const grp of personPlans) {
      const clinicId = csvRowToClinicId.get(grp.clinicLookup.csvRow);
      if (!clinicId) continue; // klinika sa nezapísala (skip ambiguous)
      try {
        await db.transaction(async (tx) => {
          // existujúce osoby pre kliniku
          const existingAss = await tx
            .select({
              assignmentId: contactAssignments.id,
              personId: contactAssignments.personId,
              firstName: collaborators.firstName,
              lastName: collaborators.lastName,
            })
            .from(contactAssignments)
            .leftJoin(collaborators, eq(collaborators.id, contactAssignments.personId))
            .where(
              and(
                eq(contactAssignments.entityType, "clinic"),
                eq(contactAssignments.entityId, clinicId),
              ),
            );
          const existingKey = new Set(
            existingAss.map((a) => `${(a.firstName ?? "").toLowerCase()}|${(a.lastName ?? "").toLowerCase()}`),
          );

          for (const pp of grp.persons) {
            const fn = (pp.parsed.firstName ?? "").trim();
            const ln = (pp.parsed.lastName ?? "").trim();
            const key = `${fn.toLowerCase()}|${ln.toLowerCase()}`;
            if (existingKey.has(key)) continue; // dup, preskoč

            const [pers] = await tx
              .insert(collaborators)
              .values({
                countryCode: "SK",
                titleBefore: pp.parsed.titleBefore,
                firstName: fn || ln, // schema vyžaduje notnull firstName
                lastName: ln,
                titleAfter: pp.parsed.titleAfter,
                clinicId,
                clinicIds: [clinicId],
                isActive: true,
              })
              .returning({ id: collaborators.id });
            actuallyPersons++;

            await tx.insert(contactAssignments).values({
              personId: pers.id,
              entityType: "clinic",
              entityId: clinicId,
              isPrimary: pp.isPrimary,
              position: pp.position,
              isActive: true,
            });
            actuallyAssignments++;

            // Company adresa = adresa ambulancie
            await tx.insert(collaboratorAddresses).values({
              collaboratorId: pers.id,
              addressType: "company",
              name: grp.clinicAddress.name,
              streetNumber: grp.clinicAddress.streetNumber,
              city: grp.clinicAddress.city,
              region: grp.clinicAddress.region,
              countryCode: grp.clinicAddress.countryCode,
            });

            existingKey.add(key);
          }
        });
      } catch (e: any) {
        errors.push({ csvRow: grp.clinicLookup.csvRow, error: `persons: ${String(e?.message ?? e)}` });
      }
    }

    console.log(``);
    console.log(`════════════════════════════════════════════════════════════`);
    console.log(`  ZÁPIS DOKONČENÝ`);
    console.log(`    Vložené nové kliniky:    ${actuallyInserted}`);
    console.log(`    Aktualizované kliniky:   ${actuallyUpdated}`);
    console.log(`    Vytvorené osoby:         ${actuallyPersons}`);
    console.log(`    Vytvorené priradenia:    ${actuallyAssignments}`);
    if (errors.length) {
      console.log(`    ⚠ Chyby:                ${errors.length}`);
    }
    console.log(`════════════════════════════════════════════════════════════`);
  }

  // ── 6. Audit log ──
  const md: string[] = [];
  md.push(`# Import write log – ${LOG_TS}`);
  md.push(``);
  md.push(`- CSV: \`${path.relative(process.cwd(), CSV_PATH)}\``);
  md.push(`- Mode: **${COMMIT ? "COMMIT" : "DRY-RUN"}**`);
  md.push(`- Limit: ${LIMIT ?? "—"}`);
  md.push(``);
  md.push(`## Sumár plánu`);
  md.push(``);
  md.push(`| Akcia | Počet |`);
  md.push(`|---|---:|`);
  md.push(`| INSERT (nová klinika) | ${inserts} |`);
  md.push(`| UPDATE (s reálnymi zmenami) | ${updatesWithChanges} |`);
  md.push(`| UPDATE (no-op – nič na doplnenie) | ${updatesNoOp} |`);
  md.push(`| SKIP (ambiguous match) | ${skips} |`);
  md.push(`| Osoby celkom v pláne | ${totalPersons} |`);
  if (COMMIT) {
    md.push(``);
    md.push(`## Skutočne zapísané`);
    md.push(``);
    md.push(`| Akcia | Počet |`);
    md.push(`|---|---:|`);
    md.push(`| Vložené kliniky | ${actuallyInserted} |`);
    md.push(`| Aktualizované kliniky | ${actuallyUpdated} |`);
    md.push(`| Vytvorené osoby | ${actuallyPersons} |`);
    md.push(`| Vytvorené priradenia (contact_assignments) | ${actuallyAssignments} |`);
    md.push(`| Chyby | ${errors.length} |`);
    if (errors.length) {
      md.push(``);
      md.push(`### Chyby`);
      md.push(``);
      errors.slice(0, 50).forEach((e) =>
        md.push(`- riadok ${e.csvRow}: ${e.error}`),
      );
      if (errors.length > 50) md.push(`- … a ďalších ${errors.length - 50}`);
    }
  }

  // SKIP detail
  const skipped = plans.filter((p): p is Extract<ClinicWritePlan, { kind: "SKIP_AMBIGUOUS" }> => p.kind === "SKIP_AMBIGUOUS");
  if (skipped.length) {
    md.push(``);
    md.push(`## Preskočené (ambiguous match) – ${skipped.length}`);
    md.push(``);
    skipped.slice(0, 30).forEach((s) => {
      md.push(`- **riadok ${s.csvRow}: ${s.name}** (${s.city ?? "—"})`);
      s.candidates.forEach((c) =>
        md.push(`    - kandidát: ${c.dbName} (${c.dbCity ?? "—"}) – skóre ${c.score}`),
      );
    });
    if (skipped.length > 30) md.push(`- … a ďalších ${skipped.length - 30}`);
  }

  // UPDATE diff sample
  const updatesArr = plans.filter((p): p is Extract<ClinicWritePlan, { kind: "UPDATE" }> => p.kind === "UPDATE" && Object.keys(p.diff).length > 0);
  if (updatesArr.length) {
    md.push(``);
    md.push(`## UPDATE – ukážka prvých ${Math.min(10, updatesArr.length)} (s reálnymi zmenami)`);
    md.push(``);
    updatesArr.slice(0, 10).forEach((u) => {
      md.push(`### Riadok ${u.csvRow} → klinika ${u.clinicId} (match: ${u.matchType}, skóre ${u.score})`);
      md.push(``);
      md.push(`| Pole | Pôvodné | Nové |`);
      md.push(`|---|---|---|`);
      Object.entries(u.diff).forEach(([k, v]) =>
        md.push(`| \`${k}\` | ${escapeMd(String(v.from ?? "—"))} | ${escapeMd(String(v.to ?? "—"))} |`),
      );
      md.push(``);
    });
  }

  // INSERT sample
  const insertsArr = plans.filter((p): p is Extract<ClinicWritePlan, { kind: "INSERT" }> => p.kind === "INSERT");
  if (insertsArr.length) {
    md.push(``);
    md.push(`## INSERT – ukážka prvých ${Math.min(5, insertsArr.length)}`);
    md.push(``);
    insertsArr.slice(0, 5).forEach((ins) => {
      md.push(`### Riadok ${ins.csvRow} → nová klinika`);
      md.push(``);
      md.push("```json");
      md.push(JSON.stringify(ins.data, null, 2));
      md.push("```");
      md.push(``);
    });
  }

  await fs.writeFile(LOG_PATH, md.join("\n"), "utf8");
  console.log(`\n→ Audit log uložený: ${path.relative(process.cwd(), LOG_PATH)}\n`);
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, "<br>").slice(0, 200);
}

main().catch((e) => {
  console.error(`✗ Chyba: ${e?.message ?? e}`);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
