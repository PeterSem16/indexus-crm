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
import * as fsSync from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { db } from "../server/db";
import { clinics, collaborators, contactAssignments, collaboratorAddresses } from "@shared/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

// ────────────────────────────────────────────────────────────────────────────
// SK kraj-mapping: 2-písmenková skratka → plný úradný názov
// ────────────────────────────────────────────────────────────────────────────
const REGION_MAP: Record<string, string> = {
  BA: "Bratislavský kraj",
  TT: "Trnavský kraj",
  TN: "Trenčiansky kraj",
  NR: "Nitriansky kraj",
  ZA: "Žilinský kraj",
  BB: "Banskobystrický kraj",
  PO: "Prešovský kraj",
  KE: "Košický kraj",
};
const REGION_FULL_NAMES = new Set(Object.values(REGION_MAP));

function normalizeRegion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (REGION_MAP[upper]) return REGION_MAP[upper];
  return trimmed;
}

function isRegionInvalid(value: string | null | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return !REGION_FULL_NAMES.has(trimmed);
}

// ────────────────────────────────────────────────────────────────────────────
// PSČ lookup cez OpenAI (s perzistentnou cache)
// ────────────────────────────────────────────────────────────────────────────
const PSC_CACHE_PATH = path.resolve(
  process.cwd(),
  "attached_assets/postal_code_cache.json",
);
let pscCache: Record<string, string> = {};
let pscCacheDirty = false;
let openaiClient: OpenAI | null = null;

function loadPscCache(): void {
  try {
    if (fsSync.existsSync(PSC_CACHE_PATH)) {
      pscCache = JSON.parse(fsSync.readFileSync(PSC_CACHE_PATH, "utf-8"));
    }
  } catch (err) {
    console.warn(`  ⚠ PSČ cache sa nedala načítať: ${(err as Error).message}`);
    pscCache = {};
  }
}

function flushPscCache(): void {
  if (!pscCacheDirty) return;
  try {
    fsSync.writeFileSync(PSC_CACHE_PATH, JSON.stringify(pscCache, null, 2), "utf-8");
    pscCacheDirty = false;
  } catch (err) {
    console.warn(`  ⚠ PSČ cache sa nedala uložiť: ${(err as Error).message}`);
  }
}

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY chýba – AI doplnenie PSČ nie je možné.");
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function pscCacheKey(
  street: string | null | undefined,
  city: string | null | undefined,
  countryCode: string | null | undefined,
): string {
  return [
    String(street ?? "").trim().toLowerCase(),
    String(city ?? "").trim().toLowerCase(),
    String(countryCode ?? "SK").trim().toUpperCase(),
  ].join("|");
}

type AddrLookup = { psc: string | null; district: string | null };

function readCacheEntry(key: string): { psc: string | null; district: string | null; isLegacy: boolean } | null {
  const v = pscCache[key];
  if (v === undefined) return null;
  if (typeof v === "string") return { psc: v || null, district: null, isLegacy: true };
  return { psc: v.psc || null, district: v.district || null, isLegacy: false };
}

async function lookupAddress(
  street: string | null | undefined,
  city: string | null | undefined,
  countryCode: string | null | undefined = "SK",
): Promise<AddrLookup> {
  const cleanStreet = String(street ?? "").trim();
  const cleanCity = String(city ?? "").trim();
  if (!cleanStreet && !cleanCity) return { psc: null, district: null };

  const key = pscCacheKey(cleanStreet, cleanCity, countryCode);
  const cached = readCacheEntry(key);
  // Hit iba ak nový formát (poznáme oboje) a aspoň jedno z nich je vyplnené.
  // Starý formát (len PSČ) → AI volanie aby sme dohrali okres.
  if (cached && !cached.isLegacy && (cached.psc || cached.district)) {
    return { psc: cached.psc, district: cached.district };
  }

  const country = (countryCode ?? "SK").toUpperCase();
  const countryName = country === "SK" ? "Slovensko" : country;
  const prompt = `Pre adresu "${cleanStreet}, ${cleanCity}, ${countryName}" mi vráť dva údaje:
1) PSČ vo formáte "XXX XX" (5 číslic s medzerou medzi 3. a 4.)
2) Okres (administratívna jednotka), napríklad "Bratislava IV", "Banská Bystrica", "Trnava".
Odpovedaj IBA v presnom formáte JSON na jednom riadku, žiadne komentáre:
{"psc":"841 03","okres":"Bratislava IV"}
Ak niektorý údaj nepoznáš, daj prázdny string. Ak adresa nie je jednoznačná, daj NEZNAME ako hodnotu.`;

  try {
    // gpt-5 je najnovší a najsilnejší model. Použitý s minimálnym
    // reasoningom — úloha je faktografická, nie analytická.
    const resp = await getOpenAI().chat.completions.create({
      model: "gpt-5",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 384,
      reasoning_effort: "minimal",
    } as any);
    const raw = resp.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let psc: string | null = null;
    let district: string | null = null;
    if (jsonMatch) {
      try {
        const obj = JSON.parse(jsonMatch[0]);
        const m = String(obj.psc ?? "").match(/(\d{3})\s?(\d{2})/);
        psc = m ? `${m[1]} ${m[2]}` : null;
        const dRaw = String(obj.okres ?? "").trim();
        district = dRaw && dRaw.toUpperCase() !== "NEZNAME" ? dRaw : null;
      } catch {
        const m = raw.match(/(\d{3})\s?(\d{2})/);
        psc = m ? `${m[1]} ${m[2]}` : null;
      }
    } else {
      const m = raw.match(/(\d{3})\s?(\d{2})/);
      psc = m ? `${m[1]} ${m[2]}` : null;
    }
    pscCache[key] = { psc: psc ?? "", district: district ?? "" };
    pscCacheDirty = true;
    return { psc, district };
  } catch (err) {
    console.warn(`  ⚠ AI lookup zlyhal pre "${cleanStreet}, ${cleanCity}": ${(err as Error).message}`);
    // Transientné chyby NECACHEujeme – ďalší beh môže skúsiť znova.
    return { psc: null, district: null };
  }
}

async function lookupAddressesBatch(
  inputs: { street: string | null; city: string | null; countryCode: string | null }[],
  concurrency = 8,
): Promise<AddrLookup[]> {
  const results: AddrLookup[] = new Array(inputs.length).fill(null).map(() => ({ psc: null, district: null }));
  let cursor = 0;
  let resolvedFromCache = 0;
  let resolvedFromAI = 0;

  async function worker() {
    while (cursor < inputs.length) {
      const myIdx = cursor++;
      const it = inputs[myIdx];
      const k = pscCacheKey(it.street, it.city, it.countryCode);
      const cached = readCacheEntry(k);
      const hadValid = cached && (cached.psc || cached.district);
      const out = await lookupAddress(it.street, it.city, it.countryCode);
      results[myIdx] = out;
      if (hadValid) resolvedFromCache++;
      else resolvedFromAI++;
      if ((resolvedFromAI + resolvedFromCache) % 50 === 0) {
        console.log(`    … Adresy progress: ${resolvedFromAI + resolvedFromCache}/${inputs.length} (cache=${resolvedFromCache}, AI=${resolvedFromAI})`);
      }
      if (resolvedFromAI > 0 && resolvedFromAI % 25 === 0) {
        flushPscCache();
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  flushPscCache();
  console.log(`    ✓ Adresy doplnené: ${resolvedFromCache} z cache, ${resolvedFromAI} cez AI`);
  return results;
}

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
const SKIP_AI = args["no-ai"] === "true";
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
  // Alternatívne firstName variant(y) v prípade bilingválneho zápisu
  // "Ján / János Perhács" → firstName="Ján", aliasFirstNames=["János"]
  aliasFirstNames?: string[];
}

function parsePersonName(raw: string): ParsedPerson {
  const original = raw.trim();
  if (!original) {
    return { raw, titleBefore: null, firstName: null, lastName: null, titleAfter: null, warning: "empty" };
  }
  const [namePart, ...afterParts] = original.split(",");
  const afterTitles = afterParts.map((s) => s.trim()).filter(Boolean);
  // "Klaudia/Claudia" → "Klaudia / Claudia" (ošetrenie bez medzier okolo "/")
  const normalizedNamePart = namePart.replace(/(\S)\/(\S)/g, "$1 / $2");
  const tokens = normalizedNamePart.trim().split(/\s+/);
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
  // Slash je oddeľovač alternatívnych variantov toho istého mena (bilingual
  // alebo rodné/manželské priezvisko).
  //   "Ján / János Perhács"      → firstName="Ján",   lastName="Perhács", alias="János"
  //   "Zoltán Hegedűs / Hegedus" → firstName="Zoltán", lastName="Hegedűs"  (Hegedus zahodené)
  //   "Marčela Levska / Tichová" → firstName="Marčela", lastName="Levska" (Tichová zahodené)
  const aliasFirstNames: string[] = [];
  const slashIdx = nameTokens.indexOf("/");
  if (slashIdx > 0 && slashIdx < nameTokens.length - 1) {
    const before = nameTokens.slice(0, slashIdx);
    const between = nameTokens.slice(slashIdx + 1, nameTokens.length - 1);
    const last = nameTokens[nameTokens.length - 1];
    if (between.length > 0) {
      // Alternatíva firstName: ponechaj prvý variant + priezvisko
      aliasFirstNames.push(between.join(" "));
      nameTokens.splice(0, nameTokens.length, ...before, last);
    } else {
      // Alternatíva lastName: ponechaj len `before` (firstName + lastName1)
      nameTokens.splice(0, nameTokens.length, ...before);
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
    aliasFirstNames: aliasFirstNames.length ? aliasFirstNames : undefined,
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

type PscLookupHint = { street: string | null; city: string | null; countryCode: string };
type ClinicWritePlan =
  | { kind: "INSERT"; csvRow: number; data: typeof clinics.$inferInsert; pscLookup: PscLookupHint | null }
  | {
      kind: "UPDATE";
      csvRow: number;
      clinicId: string;
      matchType: "id_zz" | "name_city_exact" | "name_city_fuzzy";
      score: number;
      diff: Record<string, { from: any; to: any }>;
      pscLookup: PscLookupHint | null;
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
  position: string | null; // "Súkromný gynekológ" pre primary
  categoryId: string | null; // partner_categories.id pre primary (Súkromný gynekológ)
};

// MPN kategória "Súkromný gynekológ" – partner_categories.code='gynecologist_private'
const PRIVATE_GYNECOLOGIST_CATEGORY_ID = "053995ca-0e6f-4b7f-bb8d-0fe45b512ded";

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
      district: string | null;
      countryCode: string;
    };
    clinicCompany: {
      name: string;
      ico: string | null;
      phone: string | null;
      email: string | null;
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
      region: normalizeRegion(get(r, "region")) ?? undefined,
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
        initialStatus: "initial:not_contacted",
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
      plans.push({
        kind: "INSERT",
        csvRow: rowNum,
        data: insertData,
        pscLookup: {
          street: [csvFields.street, csvFields.streetNumber].filter(Boolean).join(" ") || null,
          city: csvFields.city ?? null,
          countryCode: (csvFields.countryCode as string | undefined) ?? "SK",
        },
      });
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
        "initialStatus",
      ];
      // initialStatus pre nový import → "initial:not_contacted" (iba ak prázdny v DB)
      // Hodnota musí matchovať PIPELINE_CATEGORIES options vo wizarde
      // (initial:not_contacted, initial:former, initial:active_contract).
      (csvFields as any).initialStatus = "initial:not_contacted";
      for (const k of FILL_IF_EMPTY) {
        const newVal = (csvFields as any)[k];
        const oldVal = (existing as any)[k];
        if (newVal != null && newVal !== "" && (oldVal == null || oldVal === "")) {
          diff[k as string] = { from: oldVal ?? null, to: newVal };
        }
      }
      // Špeciálny FIX pre `region`: ak v DB je 2-písmenková skratka alebo iný neplatný
      // tvar (napr. "BA"), prepíš na úradný názov ("Bratislavský kraj").
      if (csvFields.region && isRegionInvalid(existing.region) && existing.region !== csvFields.region) {
        diff["region"] = { from: existing.region ?? null, to: csvFields.region };
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
      const needsPsc = !existing.postalCode || existing.postalCode.trim() === "";
      plans.push({
        kind: "UPDATE",
        csvRow: rowNum,
        clinicId: matched.clinic.id,
        matchType: matched.type,
        score: Math.round(matched.score * 1000) / 1000,
        diff,
        pscLookup: needsPsc
          ? {
              street: [csvFields.street, csvFields.streetNumber].filter(Boolean).join(" ") || null,
              city: csvFields.city ?? null,
              countryCode: (csvFields.countryCode as string | undefined) ?? "SK",
            }
          : null,
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
        categoryId: idx === 0 ? PRIVATE_GYNECOLOGIST_CATEGORY_ID : null,
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
          district: csvFields.district ?? null,
          countryCode: csvFields.countryCode ?? "SK",
        },
        clinicCompany: {
          name,
          ico: csvFields.ico ?? null,
          phone: csvFields.phone ?? null,
          email: csvFields.email ?? null,
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

  // ── 5a. AI-doplnenie PSČ + okresu (pre INSERTy a pre UPDATEy bez údajov) ──
  const csvRowToAddr = new Map<number, AddrLookup>();
  if (!SKIP_AI) {
    loadPscCache();
    // Lookup robíme pre KAŽDÚ neprázdnu adresu – využijeme ho aj pri vypĺňaní
    // collaborator_addresses (PSČ/okres pre Company Address osôb).
    const lookupTargets: { csvRow: number; hint: PscLookupHint }[] = [];
    for (const p of plans) {
      if (p.kind === "SKIP_AMBIGUOUS") continue;
      if (!p.pscLookup) continue;
      if (!p.pscLookup.street && !p.pscLookup.city) continue;
      lookupTargets.push({ csvRow: p.csvRow, hint: p.pscLookup });
    }
    if (lookupTargets.length) {
      console.log(`\n→ AI doplnenie PSČ + okresu pre ${lookupTargets.length} ambulancií (cache + OpenAI) …`);
      const addrs = await lookupAddressesBatch(lookupTargets.map((t) => t.hint));
      lookupTargets.forEach((t, i) => csvRowToAddr.set(t.csvRow, addrs[i]));
    }
  } else {
    console.log(`\n→ AI doplnenie PSČ + okresu vynechané (--no-ai)`);
  }

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
            const addr = csvRowToAddr.get(p.csvRow);
            const insertData: any = { ...p.data };
            if (addr?.psc) insertData.postalCode = addr.psc;
            if (addr?.district && !insertData.district) insertData.district = addr.district;
            const [row] = await tx.insert(clinics).values(insertData).returning({ id: clinics.id });
            csvRowToClinicId.set(p.csvRow, row.id);
            actuallyInserted++;
          } else if (p.kind === "UPDATE") {
            csvRowToClinicId.set(p.csvRow, p.clinicId);
            const fieldsToUpdate: Record<string, any> = Object.fromEntries(
              Object.entries(p.diff).map(([k, v]) => [k, v.to]),
            );
            const addr = csvRowToAddr.get(p.csvRow);
            if (addr?.psc && !("postalCode" in fieldsToUpdate)) {
              fieldsToUpdate.postalCode = addr.psc;
            }
            // okres iba ak diff ho ešte nepriniesol z CSV (FILL_IF_EMPTY už v plánovaní)
            // a v AI lookupe niečo prišlo
            if (addr?.district && !("district" in fieldsToUpdate)) {
              // dobeh pre kliniky kde CSV district bol prázdny ale AI ho našiel
              const [curr] = await tx
                .select({ district: clinics.district })
                .from(clinics)
                .where(eq(clinics.id, p.clinicId))
                .limit(1);
              if (!curr?.district || curr.district.trim() === "") {
                fieldsToUpdate.district = addr.district;
              }
            }
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

    // Predčítame psc/region/district pre všetky cieľové kliniky (na vyplnenie Company adries osôb)
    const allClinicIds = Array.from(
      new Set(
        personPlans
          .map((g) => csvRowToClinicId.get(g.clinicLookup.csvRow))
          .filter((x): x is string => Boolean(x)),
      ),
    );
    const clinicById = new Map<string, { postalCode: string | null; region: string | null; district: string | null }>();
    if (allClinicIds.length > 0) {
      const rows = await db
        .select({
          id: clinics.id,
          postalCode: clinics.postalCode,
          region: clinics.region,
          district: clinics.district,
        })
        .from(clinics)
        .where(inArray(clinics.id, allClinicIds));
      for (const r of rows) {
        clinicById.set(r.id, {
          postalCode: r.postalCode ?? null,
          region: r.region ?? null,
          district: r.district ?? null,
        });
      }
    }

    // ── Načítaj všetky "orphan" osoby (clinic_id IS NULL) pre globálnu adopciu ──
    // Takéto záznamy pochádzajú zo starších importov a tu im pridelíme kliniku
    // namiesto vytvorenia novej duplicitnej osoby.
    const orphanRows = await db
      .select({
        id: collaborators.id,
        firstName: collaborators.firstName,
        lastName: collaborators.lastName,
      })
      .from(collaborators)
      .where(isNull(collaborators.clinicId));
    const orphanByKey = new Map<string, string>(); // key → personId
    for (const o of orphanRows) {
      const k = `${(o.firstName ?? "").toLowerCase().trim()}|${(o.lastName ?? "").toLowerCase().trim()}`;
      if (!orphanByKey.has(k)) orphanByKey.set(k, o.id);
    }
    let adoptedOrphans = 0;

    // Globálny alias-cluster: pre každé `lower(fn|ln)` zoznam ekvivalentných
    // (fn|ln) zo všetkých CSV slash-mien. Použité v per-clinic existing-match
    // lookup, aby `MUDr. János Perhács` (CSV) matchol `Ján Perhács` (DB).
    const aliasClusters = new Map<string, Set<string>>();
    for (const grp of personPlans) {
      for (const pp of grp.persons) {
        const fn = (pp.parsed.firstName ?? "").toLowerCase().trim();
        const ln = (pp.parsed.lastName ?? "").toLowerCase().trim();
        const aliases = (pp.parsed.aliasFirstNames ?? []).map((a) => a.toLowerCase().trim()).filter(Boolean);
        if (!fn || !ln || aliases.length === 0) continue;
        const cluster = new Set<string>([`${fn}|${ln}`, ...aliases.map((a) => `${a}|${ln}`)]);
        for (const k of cluster) {
          const ex = aliasClusters.get(k) ?? new Set<string>();
          for (const c of cluster) ex.add(c);
          aliasClusters.set(k, ex);
        }
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
              isPrimary: contactAssignments.isPrimary,
              position: contactAssignments.position,
              categoryId: contactAssignments.categoryId,
              firstName: collaborators.firstName,
              lastName: collaborators.lastName,
              countryCode: collaborators.countryCode,
              countryCodes: collaborators.countryCodes,
              companyName: collaborators.companyName,
              ico: collaborators.ico,
              phone: collaborators.phone,
              email: collaborators.email,
              professionalClassification: collaborators.professionalClassification,
              partnerCategory: collaborators.partnerCategory,
            })
            .from(contactAssignments)
            .leftJoin(collaborators, eq(collaborators.id, contactAssignments.personId))
            .where(
              and(
                eq(contactAssignments.entityType, "clinic"),
                eq(contactAssignments.entityId, clinicId),
              ),
            );
          const existingByKey = new Map(
            existingAss.map((a) => [
              `${(a.firstName ?? "").toLowerCase()}|${(a.lastName ?? "").toLowerCase()}`,
              a,
            ]),
          );

          for (const pp of grp.persons) {
            const fn = (pp.parsed.firstName ?? "").trim();
            const ln = (pp.parsed.lastName ?? "").trim();
            // INSERT používa `firstName: fn || ln`, lookup musí byť rovnaký inak
            // pri opakovaných behoch vznikajú duplikáty (napr. "Böhmer Böhmer").
            const insertedFn = fn || ln;
            const key = `${insertedFn.toLowerCase()}|${ln.toLowerCase()}`;
            // Bilingual aliases — "Ján / János Perhács" má alias "János" pre tú
            // istú osobu. Ak existuje per-clinic záznam pre alias, použi ho.
            // Doplnené o globálny aliasClusters (reverz: "jános" → "ján" aj keď
            // tento konkrétny CSV riadok aliasy neuvádza).
            const aliasKeysSet = new Set<string>(
              (pp.parsed.aliasFirstNames ?? []).map(
                (af) => `${af.toLowerCase().trim()}|${ln.toLowerCase()}`,
              ),
            );
            const cluster = aliasClusters.get(key);
            if (cluster) for (const c of cluster) if (c !== key) aliasKeysSet.add(c);
            const aliasKeys = [...aliasKeysSet];
            let existingMatch = existingByKey.get(key);
            if (!existingMatch) {
              for (const ak of aliasKeys) {
                const m = existingByKey.get(ak);
                if (m) { existingMatch = m; break; }
              }
            }

            if (existingMatch) {
              // Idempotentný fix: doplniť chýbajúce polia
              // 1) collaborators – fill-if-empty
              const collabUpdates: Record<string, any> = {};
              if (!existingMatch.countryCode || existingMatch.countryCode === "") {
                collabUpdates.countryCode = "SK";
              }
              if (!existingMatch.countryCodes || existingMatch.countryCodes.length === 0) {
                collabUpdates.countryCodes = ["SK"];
              }
              if (!existingMatch.companyName) {
                collabUpdates.companyName = grp.clinicCompany.name;
              }
              if (!existingMatch.ico && grp.clinicCompany.ico) {
                collabUpdates.ico = grp.clinicCompany.ico;
              }
              if (!existingMatch.phone && grp.clinicCompany.phone) {
                collabUpdates.phone = grp.clinicCompany.phone;
              }
              if (!existingMatch.email && grp.clinicCompany.email) {
                collabUpdates.email = grp.clinicCompany.email;
              }
              if (pp.isPrimary && !existingMatch.professionalClassification) {
                collabUpdates.professionalClassification = "gynecology_specialists";
              }
              if (pp.isPrimary && !(existingMatch as any).partnerCategory) {
                collabUpdates.partnerCategory = PRIVATE_GYNECOLOGIST_CATEGORY_ID;
              }
              if (Object.keys(collabUpdates).length > 0) {
                collabUpdates.updatedAt = sql`now()`;
                await tx
                  .update(collaborators)
                  .set(collabUpdates)
                  .where(eq(collaborators.id, existingMatch.personId));
              }
              // 2) contact_assignments.position + categoryId pre primary, ak chýbajú
              const updates: Record<string, any> = {};
              if (pp.isPrimary && pp.position && !existingMatch.position) {
                updates.position = pp.position;
              }
              if (pp.isPrimary && pp.categoryId && !existingMatch.categoryId) {
                updates.categoryId = pp.categoryId;
              }
              if (Object.keys(updates).length > 0) {
                updates.updatedAt = sql`now()`;
                await tx
                  .update(contactAssignments)
                  .set(updates)
                  .where(eq(contactAssignments.id, existingMatch.assignmentId));
              }
              // 3) collaborator_addresses (company) – vytvoriť alebo doplniť
              const addrLookup = csvRowToAddr.get(grp.clinicLookup.csvRow) ?? null;
              const clinicAddr = clinicById.get(clinicId) ?? null;
              const fullRegion =
                normalizeRegion(grp.clinicAddress.region) ||
                normalizeRegion(clinicAddr?.region ?? null);
              const districtForAddr =
                grp.clinicAddress.district ??
                addrLookup?.district ??
                clinicAddr?.district ??
                null;
              const pscForAddr = addrLookup?.psc ?? clinicAddr?.postalCode ?? null;
              const existingAddr = await tx
                .select({
                  id: collaboratorAddresses.id,
                  postalCode: collaboratorAddresses.postalCode,
                  region: collaboratorAddresses.region,
                  district: collaboratorAddresses.district,
                  city: collaboratorAddresses.city,
                  streetNumber: collaboratorAddresses.streetNumber,
                })
                .from(collaboratorAddresses)
                .where(
                  and(
                    eq(collaboratorAddresses.collaboratorId, existingMatch.personId),
                    eq(collaboratorAddresses.addressType, "company"),
                  ),
                )
                .limit(1);
              if (existingAddr.length === 0) {
                await tx.insert(collaboratorAddresses).values({
                  collaboratorId: existingMatch.personId,
                  addressType: "company",
                  name: grp.clinicAddress.name,
                  streetNumber: grp.clinicAddress.streetNumber,
                  city: grp.clinicAddress.city,
                  postalCode: pscForAddr,
                  region: fullRegion,
                  district: districtForAddr,
                  countryCode: grp.clinicAddress.countryCode,
                });
              } else {
                const ex = existingAddr[0];
                const addrUpd: Record<string, any> = {};
                if ((!ex.postalCode || ex.postalCode.trim() === "") && pscForAddr) {
                  addrUpd.postalCode = pscForAddr;
                }
                if ((!ex.district || ex.district.trim() === "") && districtForAddr) {
                  addrUpd.district = districtForAddr;
                }
                // region: ak existujúci je prázdny ALEBO neplatná skratka → prepíš
                if (fullRegion && (isRegionInvalid(ex.region) || !ex.region || ex.region.trim() === "")) {
                  if (ex.region !== fullRegion) addrUpd.region = fullRegion;
                }
                if ((!ex.streetNumber || ex.streetNumber.trim() === "") && grp.clinicAddress.streetNumber) {
                  addrUpd.streetNumber = grp.clinicAddress.streetNumber;
                }
                if ((!ex.city || ex.city.trim() === "") && grp.clinicAddress.city) {
                  addrUpd.city = grp.clinicAddress.city;
                }
                if (Object.keys(addrUpd).length > 0) {
                  await tx
                    .update(collaboratorAddresses)
                    .set(addrUpd)
                    .where(eq(collaboratorAddresses.id, ex.id));
                }
              }
              // collaborator_type='doctor' pre primary, ak chýba
              if (pp.isPrimary && !(existingMatch as any).collaboratorType) {
                await tx
                  .update(collaborators)
                  .set({ collaboratorType: "doctor", updatedAt: sql`now()` })
                  .where(eq(collaborators.id, existingMatch.personId));
              }
              // Alias-orphan absorpcia: ak existuje orphan pod alias menom
              // (napr. Klaudia má kliniku, Claudia je orphan), zlúč ho do
              // existingMatch a vymaž duplikát.
              for (const ak of aliasKeys) {
                const aliasOrphanId = orphanByKey.get(ak);
                if (!aliasOrphanId) continue;
                const orphanAss = await tx
                  .select({ id: contactAssignments.id, entityType: contactAssignments.entityType, entityId: contactAssignments.entityId })
                  .from(contactAssignments)
                  .where(eq(contactAssignments.personId, aliasOrphanId));
                const primaryAss = await tx
                  .select({ entityType: contactAssignments.entityType, entityId: contactAssignments.entityId })
                  .from(contactAssignments)
                  .where(eq(contactAssignments.personId, existingMatch.personId));
                const taken = new Set(primaryAss.map((a) => `${a.entityType}|${a.entityId}`));
                for (const a of orphanAss) {
                  const k2 = `${a.entityType}|${a.entityId}`;
                  if (taken.has(k2)) {
                    await tx.delete(contactAssignments).where(eq(contactAssignments.id, a.id));
                  } else {
                    await tx.update(contactAssignments).set({ personId: existingMatch.personId, updatedAt: sql`now()` }).where(eq(contactAssignments.id, a.id));
                    taken.add(k2);
                  }
                }
                await tx.delete(collaboratorAddresses).where(eq(collaboratorAddresses.collaboratorId, aliasOrphanId));
                await tx.delete(collaborators).where(eq(collaborators.id, aliasOrphanId));
                orphanByKey.delete(ak);
                adoptedOrphans++;
              }
              continue;
            }

            // ── Orphan adopcia ──
            // Existuje osoba s rovnakým menom ale bez clinic_id (zo staršieho
            // importu)? Adoptuj ju namiesto vytvorenia novej duplicity.
            // Pre bilingválne mená skús aj alias variant.
            let orphanId = orphanByKey.get(key);
            let orphanKeyUsed = key;
            if (!orphanId) {
              for (const ak of aliasKeys) {
                const oid = orphanByKey.get(ak);
                if (oid) { orphanId = oid; orphanKeyUsed = ak; break; }
              }
            }
            if (orphanId) {
              const adopt: Record<string, any> = {
                clinicId,
                clinicIds: [clinicId],
                countryCode: "SK",
                countryCodes: ["SK"],
                companyName: grp.clinicCompany.name,
                ico: grp.clinicCompany.ico,
                phone: grp.clinicCompany.phone,
                email: grp.clinicCompany.email,
                isActive: true,
                updatedAt: sql`now()`,
              };
              if (pp.isPrimary) {
                adopt.professionalClassification = "gynecology_specialists";
                adopt.partnerCategory = PRIVATE_GYNECOLOGIST_CATEGORY_ID;
                adopt.collaboratorType = "doctor";
              }
              if (pp.parsed.titleBefore) adopt.titleBefore = pp.parsed.titleBefore;
              if (pp.parsed.titleAfter) adopt.titleAfter = pp.parsed.titleAfter;
              await tx
                .update(collaborators)
                .set(adopt)
                .where(eq(collaborators.id, orphanId));
              await tx.insert(contactAssignments).values({
                personId: orphanId,
                entityType: "clinic",
                entityId: clinicId,
                isPrimary: pp.isPrimary,
                position: pp.position,
                categoryId: pp.categoryId,
                isActive: true,
              });
              // Adresa: rovnaká logika ako pri novom INSERT
              const adoptAddrLookup = csvRowToAddr.get(grp.clinicLookup.csvRow) ?? null;
              const adoptClinicAddr = clinicById.get(clinicId) ?? null;
              await tx.insert(collaboratorAddresses).values({
                collaboratorId: orphanId,
                addressType: "company",
                name: grp.clinicAddress.name,
                streetNumber: grp.clinicAddress.streetNumber,
                city: grp.clinicAddress.city,
                postalCode: adoptAddrLookup?.psc ?? adoptClinicAddr?.postalCode ?? null,
                region:
                  normalizeRegion(grp.clinicAddress.region) ||
                  normalizeRegion(adoptClinicAddr?.region ?? null),
                district:
                  grp.clinicAddress.district ??
                  adoptAddrLookup?.district ??
                  adoptClinicAddr?.district ??
                  null,
                countryCode: grp.clinicAddress.countryCode,
              });
              orphanByKey.delete(orphanKeyUsed);
              adoptedOrphans++;
              const cacheEntry = {
                assignmentId: "",
                personId: orphanId,
                isPrimary: pp.isPrimary,
                position: pp.position,
                categoryId: pp.categoryId,
                firstName: fn || ln,
                lastName: ln,
                countryCode: "SK",
              } as any;
              existingByKey.set(key, cacheEntry);
              for (const ak of aliasKeys) existingByKey.set(ak, cacheEntry);
              continue;
            }

            const [pers] = await tx
              .insert(collaborators)
              .values({
                countryCode: "SK",
                countryCodes: ["SK"],
                titleBefore: pp.parsed.titleBefore,
                firstName: fn || ln, // schema vyžaduje notnull firstName
                lastName: ln,
                titleAfter: pp.parsed.titleAfter,
                clinicId,
                clinicIds: [clinicId],
                companyName: grp.clinicCompany.name,
                ico: grp.clinicCompany.ico,
                phone: grp.clinicCompany.phone,
                email: grp.clinicCompany.email,
                professionalClassification: pp.isPrimary ? "gynecology_specialists" : null,
                partnerCategory: pp.isPrimary ? PRIVATE_GYNECOLOGIST_CATEGORY_ID : null,
                collaboratorType: pp.isPrimary ? "doctor" : null,
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
              categoryId: pp.categoryId,
              isActive: true,
            });
            actuallyAssignments++;

            // Company adresa = adresa ambulancie (PSČ/okres/kraj z CSV → AI → materskej kliniky)
            const newAddrLookup = csvRowToAddr.get(grp.clinicLookup.csvRow) ?? null;
            const newClinicAddr = clinicById.get(clinicId) ?? null;
            await tx.insert(collaboratorAddresses).values({
              collaboratorId: pers.id,
              addressType: "company",
              name: grp.clinicAddress.name,
              streetNumber: grp.clinicAddress.streetNumber,
              city: grp.clinicAddress.city,
              postalCode: newAddrLookup?.psc ?? newClinicAddr?.postalCode ?? null,
              region:
                normalizeRegion(grp.clinicAddress.region) ||
                normalizeRegion(newClinicAddr?.region ?? null),
              district:
                grp.clinicAddress.district ??
                newAddrLookup?.district ??
                newClinicAddr?.district ??
                null,
              countryCode: grp.clinicAddress.countryCode,
            });

            const newCacheEntry = {
              assignmentId: "",
              personId: pers.id,
              isPrimary: pp.isPrimary,
              position: pp.position,
              categoryId: pp.categoryId,
              firstName: fn || ln,
              lastName: ln,
              countryCode: "SK",
            } as any;
            existingByKey.set(key, newCacheEntry);
            for (const ak of aliasKeys) existingByKey.set(ak, newCacheEntry);
          }
        });
      } catch (e: any) {
        errors.push({ csvRow: grp.clinicLookup.csvRow, error: `persons: ${String(e?.message ?? e)}` });
      }
    }

    // ── 5-pre. Dedup duplikátnych collaborators (následok skoršieho bugu) ──
    // V minulosti sa pri opakovaných behoch vytvárali duplikáty osôb, kde
    // first_name = last_name (CSV nemal krstné meno). Zachováme najstaršiu
    // kópiu (clinic_id, first_name, last_name) a ostatné aj s ich
    // contact_assignments + collaborator_addresses vymažeme.
    let dedupedCollabs = 0;
    try {
      const dupRows: { ids: string[] }[] = await db.execute(sql`
        SELECT array_agg(id ORDER BY created_at) AS ids
        FROM collaborators
        WHERE first_name = last_name
          AND clinic_id IS NOT NULL
        GROUP BY clinic_id, lower(first_name), lower(last_name)
        HAVING COUNT(*) > 1
      `).then((r: any) => r.rows ?? r);
      for (const row of dupRows) {
        const ids: string[] = (row as any).ids;
        if (!Array.isArray(ids) || ids.length < 2) continue;
        const toDelete = ids.slice(1); // ponechaj najstaršiu
        await db.delete(collaboratorAddresses).where(inArray(collaboratorAddresses.collaboratorId, toDelete));
        await db.delete(contactAssignments).where(inArray(contactAssignments.personId, toDelete));
        await db.delete(collaborators).where(inArray(collaborators.id, toDelete));
        dedupedCollabs += toDelete.length;
      }
    } catch (e: any) {
      console.warn(`  ⚠ Dedup duplikátnych osôb zlyhal: ${e?.message ?? e}`);
    }

    // ── 5-pre-b. Vyčisti zlé záznamy s "/" v priezvisku (starý parser) ──
    // "Ján / János Perhács" sa starým parserom uložil ako lastName="/ János Perhács".
    // Po oprave parsera tieto záznamy zmažeme — orphan adopcia / nový INSERT v
    // ďalšom behu vytvorí korektný záznam.
    let cleanedSlashNames = 0;
    try {
      const badRows = await db
        .select({ id: collaborators.id })
        .from(collaborators)
        .where(sql`${collaborators.lastName} LIKE '%/%' OR ${collaborators.firstName} LIKE '%/%'`);
      const badIds = badRows.map((r) => r.id);
      if (badIds.length > 0) {
        await db.delete(collaboratorAddresses).where(inArray(collaboratorAddresses.collaboratorId, badIds));
        await db.delete(contactAssignments).where(inArray(contactAssignments.personId, badIds));
        await db.delete(collaborators).where(inArray(collaborators.id, badIds));
        cleanedSlashNames = badIds.length;
      }
    } catch (e: any) {
      console.warn(`  ⚠ Čistenie zlých "/" mien zlyhalo: ${e?.message ?? e}`);
    }

    // ── 5-pre-c. Zlúč zostávajúcich orphan duplikátov do "claimed" záznamov ──
    // Ak existuje orphan (clinic_id IS NULL) a zároveň "claimed" osoba
    // (clinic_id IS NOT NULL) s rovnakým menom, ktorú orphan-adopcia
    // nezachytila (napr. CSV mal len danú kliniku, nie všetky), presunieme
    // contact_assignments + collaborator_addresses na claimed a orphan zmažeme.
    let mergedOrphans = 0;
    try {
      const mergeRows: { primary_id: string; orphan_ids: string[] }[] = await db.execute(sql`
        WITH grouped AS (
          SELECT
            lower(first_name) AS fn_l,
            lower(last_name)  AS ln_l,
            array_agg(id) FILTER (WHERE clinic_id IS NULL)     AS orphans,
            (array_agg(id ORDER BY created_at DESC)
              FILTER (WHERE clinic_id IS NOT NULL))[1]         AS primary_id
          FROM collaborators
          WHERE first_name IS NOT NULL AND last_name IS NOT NULL
          GROUP BY lower(first_name), lower(last_name)
        )
        SELECT primary_id, orphans AS orphan_ids
        FROM grouped
        WHERE primary_id IS NOT NULL
          AND orphans IS NOT NULL
          AND array_length(orphans, 1) > 0
      `).then((r: any) => r.rows ?? r);
      for (const row of mergeRows) {
        const primaryId: string = (row as any).primary_id;
        const orphanIds: string[] = (row as any).orphan_ids ?? [];
        if (!primaryId || orphanIds.length === 0) continue;
        // Načítaj orphan assignments + assignments primary-osoby a rozhodni
        // čo presunúť (kde nie je duplicita) a čo zmazať.
        const orphanAss = await db
          .select({
            id: contactAssignments.id,
            entityType: contactAssignments.entityType,
            entityId: contactAssignments.entityId,
          })
          .from(contactAssignments)
          .where(inArray(contactAssignments.personId, orphanIds));
        const primaryAss = await db
          .select({
            entityType: contactAssignments.entityType,
            entityId: contactAssignments.entityId,
          })
          .from(contactAssignments)
          .where(eq(contactAssignments.personId, primaryId));
        const primaryEntKeys = new Set(
          primaryAss.map((a) => `${a.entityType}|${a.entityId}`),
        );
        const moveIds: string[] = [];
        const dropIds: string[] = [];
        for (const a of orphanAss) {
          if (primaryEntKeys.has(`${a.entityType}|${a.entityId}`)) {
            dropIds.push(a.id);
          } else {
            moveIds.push(a.id);
            primaryEntKeys.add(`${a.entityType}|${a.entityId}`);
          }
        }
        if (moveIds.length > 0) {
          await db
            .update(contactAssignments)
            .set({ personId: primaryId, updatedAt: sql`now()` })
            .where(inArray(contactAssignments.id, moveIds));
        }
        if (dropIds.length > 0) {
          await db.delete(contactAssignments).where(inArray(contactAssignments.id, dropIds));
        }
        // Adresy: presuň ak primary nemá company-adresu
        const primaryAddrCnt = await db
          .select({ id: collaboratorAddresses.id })
          .from(collaboratorAddresses)
          .where(
            and(
              eq(collaboratorAddresses.collaboratorId, primaryId),
              eq(collaboratorAddresses.addressType, "company"),
            ),
          );
        if (primaryAddrCnt.length === 0) {
          // Vyber 1 orphan adresu a presuň ju
          const [oneAddr] = await db
            .select({ id: collaboratorAddresses.id })
            .from(collaboratorAddresses)
            .where(
              and(
                inArray(collaboratorAddresses.collaboratorId, orphanIds),
                eq(collaboratorAddresses.addressType, "company"),
              ),
            )
            .limit(1);
          if (oneAddr) {
            await db
              .update(collaboratorAddresses)
              .set({ collaboratorId: primaryId })
              .where(eq(collaboratorAddresses.id, oneAddr.id));
          }
        }
        await db.delete(collaboratorAddresses).where(inArray(collaboratorAddresses.collaboratorId, orphanIds));
        await db.delete(collaborators).where(inArray(collaborators.id, orphanIds));
        mergedOrphans += orphanIds.length;
      }
    } catch (e: any) {
      console.warn(`  ⚠ Zlúčenie orphan duplikátov zlyhalo: ${e?.message ?? e}`);
    }

    // ── 5-pre-d. Globálny merge alias-mien ──
    // CSV bilingválne mená (napr. "Ján / János Perhács") generujú aliasFirstNames.
    // Z legacy stavu môžu existovať záznamy pod oboma variantmi, niektoré s rôznymi
    // priradeniami. Zlúčime ich do kanonického záznamu (firstName z parser-výstupu).
    let mergedAliasPersons = 0;
    try {
      const aliasPairs = new Map<string, { canonical: { fn: string; ln: string }; aliases: string[] }>();
      for (const grp of personPlans) {
        for (const pp of grp.persons) {
          const fn = (pp.parsed.firstName ?? "").trim();
          const ln = (pp.parsed.lastName ?? "").trim();
          const aliases = (pp.parsed.aliasFirstNames ?? []).map((s) => s.trim()).filter(Boolean);
          if (!fn || !ln || aliases.length === 0) continue;
          const k = `${fn.toLowerCase()}|${ln.toLowerCase()}`;
          if (!aliasPairs.has(k)) {
            aliasPairs.set(k, { canonical: { fn, ln }, aliases: [] });
          }
          const entry = aliasPairs.get(k)!;
          for (const a of aliases) {
            if (!entry.aliases.some((x) => x.toLowerCase() === a.toLowerCase())) {
              entry.aliases.push(a);
            }
          }
        }
      }
      for (const { canonical, aliases } of aliasPairs.values()) {
        // Kanonický záznam = záznam s firstName=canonical.fn, lastName=canonical.ln
        // ktorý má najviac assignments. Ak chýba, vyberieme prvý z aliasov.
        const allByLastName = await db
          .select({ id: collaborators.id, firstName: collaborators.firstName, lastName: collaborators.lastName })
          .from(collaborators)
          .where(sql`lower(${collaborators.lastName}) = ${canonical.ln.toLowerCase()}`);
        const allowedFn = new Set(
          [canonical.fn.toLowerCase(), ...aliases.map((a) => a.toLowerCase())],
        );
        const allCandidates = allByLastName.filter((c) =>
          allowedFn.has((c.firstName ?? "").toLowerCase()),
        );
        if (allCandidates.length < 2) continue;
        // Spočítaj assignments per kandidát
        const counts = new Map<string, number>();
        for (const c of allCandidates) {
          const r = await db
            .select({ n: sql<number>`count(*)::int` })
            .from(contactAssignments)
            .where(eq(contactAssignments.personId, c.id));
          counts.set(c.id, Number(r[0]?.n ?? 0));
        }
        // Preferuj kandidáta s firstName === canonical.fn (case-insensitive),
        // pri rovnosti vyberi toho s najviac assignments.
        const sorted = [...allCandidates].sort((a, b) => {
          const aIsCanon = a.firstName?.toLowerCase() === canonical.fn.toLowerCase() ? 1 : 0;
          const bIsCanon = b.firstName?.toLowerCase() === canonical.fn.toLowerCase() ? 1 : 0;
          if (aIsCanon !== bIsCanon) return bIsCanon - aIsCanon;
          return (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
        });
        const primary = sorted[0];
        const dupes = sorted.slice(1);
        if (dupes.length === 0) continue;
        // Presuň assignments dupes → primary, dedup podľa (entity_type, entity_id)
        const primaryAss = await db
          .select({ entityType: contactAssignments.entityType, entityId: contactAssignments.entityId })
          .from(contactAssignments)
          .where(eq(contactAssignments.personId, primary.id));
        const taken = new Set(primaryAss.map((a) => `${a.entityType}|${a.entityId}`));
        for (const d of dupes) {
          const dass = await db
            .select({ id: contactAssignments.id, entityType: contactAssignments.entityType, entityId: contactAssignments.entityId })
            .from(contactAssignments)
            .where(eq(contactAssignments.personId, d.id));
          for (const a of dass) {
            const k2 = `${a.entityType}|${a.entityId}`;
            if (taken.has(k2)) {
              await db.delete(contactAssignments).where(eq(contactAssignments.id, a.id));
            } else {
              await db.update(contactAssignments).set({ personId: primary.id, updatedAt: sql`now()` }).where(eq(contactAssignments.id, a.id));
              taken.add(k2);
            }
          }
          await db.delete(collaboratorAddresses).where(eq(collaboratorAddresses.collaboratorId, d.id));
          await db.delete(collaborators).where(eq(collaborators.id, d.id));
          mergedAliasPersons++;
        }
      }
    } catch (e: any) {
      console.warn(`  ⚠ Merge alias-mien zlyhal: ${e?.message ?? e}`);
    }

    // ── 5a. Migrácia legacy initial_status ──
    // Stará hodnota "not_contacted" → nová "initial:not_contacted"
    // (musí súhlasiť s PIPELINE_CATEGORIES vo wizarde, aby UI zvýraznil "New contact")
    let migratedInitialStatus = 0;
    try {
      const res = await db
        .update(clinics)
        .set({ initialStatus: "initial:not_contacted", updatedAt: sql`now()` })
        .where(eq(clinics.initialStatus, "not_contacted"))
        .returning({ id: clinics.id });
      migratedInitialStatus = res.length;
    } catch (e: any) {
      console.warn(`  ⚠ Migrácia initial_status zlyhala: ${e?.message ?? e}`);
    }

    // ── 5a-bis. Normalizácia región skratiek v collaborator_addresses ──
    // Niektoré staré záznamy majú 2-písmenovú skratku (BA, KE, …). Prepíšeme
    // na plný úradný názov, aby UI vedelo regióny správne zobraziť.
    let normalizedRegions = 0;
    try {
      const shortRows = await db
        .select({ id: collaboratorAddresses.id, region: collaboratorAddresses.region })
        .from(collaboratorAddresses)
        .where(
          inArray(collaboratorAddresses.region, [
            "BA", "BB", "BL", "KE", "NR", "PO", "TT", "TN", "ZA",
          ]),
        );
      for (const row of shortRows) {
        const full = normalizeRegion(row.region);
        if (full && full !== row.region) {
          await db
            .update(collaboratorAddresses)
            .set({ region: full })
            .where(eq(collaboratorAddresses.id, row.id));
          normalizedRegions++;
        }
      }
    } catch (e: any) {
      console.warn(`  ⚠ Normalizácia regiónov adries zlyhala: ${e?.message ?? e}`);
    }

    // ── 5b. Deaktivácia ambulancií bez Healthcare facility ID (id_zz) ──
    // Užívateľská požiadavka: ak existujúca klinika nemá vyplnené id_zz,
    // znamená to, že nebola overená v štátnom registri a má sa zneaktívniť.
    let deactivated = 0;
    try {
      const res = await db
        .update(clinics)
        .set({ isActive: false, updatedAt: sql`now()` })
        .where(
          and(
            eq(clinics.isActive, true),
            sql`(${clinics.idZz} IS NULL OR ${clinics.idZz} = '')`,
          ),
        )
        .returning({ id: clinics.id });
      deactivated = res.length;
    } catch (e: any) {
      console.warn(`  ⚠ Deaktivácia kliník bez id_zz zlyhala: ${e?.message ?? e}`);
    }

    console.log(``);
    console.log(`════════════════════════════════════════════════════════════`);
    console.log(`  ZÁPIS DOKONČENÝ`);
    console.log(`    Vložené nové kliniky:        ${actuallyInserted}`);
    console.log(`    Aktualizované kliniky:       ${actuallyUpdated}`);
    console.log(`    Vytvorené osoby:             ${actuallyPersons}`);
    console.log(`    Vytvorené priradenia:        ${actuallyAssignments}`);
    console.log(`    Deaktivované (bez id_zz):    ${deactivated}`);
    console.log(`    Dedup duplikátnych osôb:     ${dedupedCollabs}`);
    console.log(`    Adoptované orphan-osoby:     ${adoptedOrphans}`);
    console.log(`    Vyčistené "/" mená:          ${cleanedSlashNames}`);
    console.log(`    Zlúčené orphan duplikáty:    ${mergedOrphans}`);
    console.log(`    Zlúčené alias-mená:          ${mergedAliasPersons}`);
    console.log(`    Migrované initial_status:    ${migratedInitialStatus}`);
    console.log(`    Normalizované regióny adries:${normalizedRegions}`);
    if (errors.length) {
      console.log(`    ⚠ Chyby:                    ${errors.length}`);
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
