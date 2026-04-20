/**
 * INDEXUS — Migrate clinic doctors → collaborators (persons) + Medical Partner Network
 *
 * Pre každú kliniku, ktorá má vyplnené `doctor_first_name` + `doctor_last_name`:
 *   1) Nájde alebo vytvorí osobu (collaborator) s rovnakými údajmi
 *      a kategóriou `gynecologist_private` (Private Gynecologist).
 *   2) Vytvorí prepojenie do MPN (contact_assignments) na danú kliniku
 *      s pozíciou "Private Gynecologist" a is_primary = true.
 *
 * Spustenie:
 *   npx tsx scripts/migrate-clinic-doctors.ts            # dry-run
 *   npx tsx scripts/migrate-clinic-doctors.ts --apply    # naozaj zapíše
 */

import { db } from "../server/db";
import { clinics, collaborators, partnerCategories, contactAssignments } from "../shared/schema";
import { and, eq, sql, isNotNull, or } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");

// Známe tituly — zoznam je doplňovaný podľa SK/CZ reálnych dát
const TITLE_PREFIXES = [
  "MUDr.", "MDDr.", "MVDr.", "RNDr.", "PhDr.", "JUDr.", "PaedDr.", "ThDr.",
  "Dr.", "MD", "MD.", "Ing.", "Mgr.", "Bc.", "Prof.", "Doc.", "prof.", "doc.",
];
const TITLE_SUFFIXES = [
  "PhD.", "Ph.D.", "PhD", "CSc.", "CSc", "DrSc.", "MPH", "MBA", "MHA", "MSc.", "MSc",
  "FEBO", "FACOG", "MRCOG",
];

// Typické SK/CZ koncovky priezvisk — silné indikátory že ide o priezvisko, nie meno
const SURNAME_SUFFIX_RE = /(ová|ská|cká|ská|žská|čská|ský|cký|žský|čský|ovič|enko|áková|íková)$/i;

function looksLikeSurname(token: string): boolean {
  if (!token) return false;
  return SURNAME_SUFFIX_RE.test(token);
}

function parseDoctorName(raw: string): { title: string | null; firstName: string; lastName: string } | null {
  if (!raw) return null;
  let s = raw.trim().replace(/\s+/g, " ");
  // Vlož medzeru za bodku titulu, ak chýba ("MUDr.Ingrid" → "MUDr. Ingrid")
  s = s.replace(/([A-Za-záäčďéíĺľňóôŕšťúýž])\.([A-ZÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ])/g, "$1. $2");

  // Preskoč podozrivé reťazce — viacero doktorov, firemný dodatok, atď.
  if (/[\/\\(),;]|&| a /i.test(s)) return null;

  const tokens = s.split(" ").filter(Boolean);
  const titleTokens: string[] = [];
  // Odstráň prefix tituly z čela
  while (tokens.length && TITLE_PREFIXES.some(t => t.toLowerCase() === tokens[0].toLowerCase())) {
    titleTokens.push(tokens.shift()!);
  }
  // Odstráň suffix tituly z konca
  while (tokens.length && TITLE_SUFFIXES.some(t => t.toLowerCase() === tokens[tokens.length - 1].replace(/,$/, "").toLowerCase())) {
    tokens.pop();
  }
  if (tokens.length < 1) return null;
  if (tokens.length === 1) {
    // iba priezvisko (zriedkavé) — preskočiť, lebo nevieme firstName
    return null;
  }

  let firstName: string;
  let lastName: string;

  // Heuristika: ak prvý token vyzerá ako priezvisko a posledný nie, mená sú v opačnom poradí
  const firstLooksSurname = looksLikeSurname(tokens[0]);
  const lastLooksSurname = looksLikeSurname(tokens[tokens.length - 1]);

  if (firstLooksSurname && !lastLooksSurname) {
    // "Klacik Vladimír" → priezvisko=Klacik, meno=Vladimír
    lastName = tokens[0];
    firstName = tokens.slice(1).join(" ");
  } else {
    // Štandardné poradie: posledný token = priezvisko
    lastName = tokens[tokens.length - 1];
    firstName = tokens.slice(0, -1).join(" ");
  }

  const title = titleTokens.length ? titleTokens.join(" ") : null;
  return { title, firstName, lastName };
}

async function main() {
  console.log(`\n=== Migrate Clinic Doctors → Persons + MPN ===`);
  console.log(`Mode: ${APPLY ? "APPLY (zapisuje do DB)" : "DRY-RUN (iba náhľad, použi --apply)"}\n`);

  // 1. Načítaj kategóriu "Private Gynecologist"
  const [gpCategory] = await db
    .select()
    .from(partnerCategories)
    .where(eq(partnerCategories.code, "gynecologist_private"));

  if (!gpCategory) {
    console.error("CHYBA: Kategória 'gynecologist_private' neexistuje. Spusti najskôr seed kategórií.");
    process.exit(1);
  }
  console.log(`Kategória: ${gpCategory.name} (id=${gpCategory.id})\n`);

  // 2. Vyber všetky kliniky, kde je nejaká forma doktora — buď first/last, alebo doctor_name
  const rows = await db
    .select()
    .from(clinics)
    .where(
      or(
        and(
          isNotNull(clinics.doctorFirstName),
          isNotNull(clinics.doctorLastName),
          sql`TRIM(${clinics.doctorFirstName}) <> ''`,
          sql`TRIM(${clinics.doctorLastName}) <> ''`,
        ),
        and(
          isNotNull((clinics as any).doctorName),
          sql`TRIM(${(clinics as any).doctorName}) <> ''`,
        ),
      ),
    );

  console.log(`Nájdených klinik s nejakým doktorom: ${rows.length}\n`);

  let created = 0;
  let reused = 0;
  let assigned = 0;
  let skippedAssign = 0;
  let parsedFromName = 0;
  let unparseable = 0;
  const errors: Array<{ clinic: string; error: string }> = [];

  for (const c of rows) {
    let fn = (c.doctorFirstName || "").trim();
    let ln = (c.doctorLastName || "").trim();
    let title = (c.doctorTitle || "").trim() || null;
    const rawName = ((c as any).doctorName || "").trim();

    // Ak chýba first/last, skús parsovať z doctor_name
    if ((!fn || !ln) && rawName) {
      const parsed = parseDoctorName(rawName);
      if (parsed) {
        fn = fn || parsed.firstName;
        ln = ln || parsed.lastName;
        title = title || parsed.title;
        parsedFromName++;
      }
    }

    if (!fn || !ln) {
      unparseable++;
      console.log(`  ! SKIP    [${c.name}]  (nepodarilo sa získať first+last z "${rawName || "(prázdne)"}")`);
      continue;
    }

    const email = (c.email || "").trim() || null;
    const phone = (c.phone || "").trim() || null;
    const country = c.countryCode;
    const tag = `[${c.name}] ${title ?? ""} ${fn} ${ln}`.trim();

    try {
      // 2a) Nájdi existujúcu osobu
      let person = await findCollaborator(fn, ln, email, country);

      if (!person) {
        if (APPLY) {
          const [inserted] = await db
            .insert(collaborators)
            .values({
              countryCode: country,
              countryCodes: [country],
              firstName: fn,
              lastName: ln,
              titleBefore: title,
              email,
              phone,
              collaboratorType: "doctor",
              partnerCategory: gpCategory.id,
              isActive: true,
            })
            .returning();
          person = inserted;
        } else {
          person = { id: "(would-create)" } as any;
        }
        created++;
        console.log(`  + CREATE person  ${tag}`);
      } else {
        reused++;
        const currentCat = (person as any).partnerCategory || "";
        const needsUpdate = currentCat !== gpCategory.id;
        if (needsUpdate) {
          if (APPLY) {
            await db
              .update(collaborators)
              .set({ partnerCategory: gpCategory.id })
              .where(eq(collaborators.id, person.id));
          }
          console.log(
            `  = REUSE  person  ${tag}  (id=${person.id})  · position "${currentCat}" → gynecologist_private`,
          );
        } else {
          console.log(`  = REUSE  person  ${tag}  (id=${person.id})  · position OK`);
        }
      }

      // 2b) Skontroluj existujúce priradenie
      const personId = person!.id;
      let already = false;
      if (APPLY || personId !== "(would-create)") {
        const existing = await db
          .select()
          .from(contactAssignments)
          .where(
            and(
              eq(contactAssignments.personId, personId),
              eq(contactAssignments.entityType, "clinic"),
              eq(contactAssignments.entityId, c.id),
              eq(contactAssignments.isActive, true),
            ),
          );
        already = existing.length > 0;
      }

      if (already) {
        skippedAssign++;
        console.log(`    · already linked to MPN (clinic ${c.name})`);
        continue;
      }

      if (APPLY) {
        await db.insert(contactAssignments).values({
          personId,
          entityType: "clinic",
          entityId: c.id,
          categoryId: gpCategory.id,
          position: "Private Gynecologist",
          department: "Gynekologické oddelenie",
          isPrimary: true,
          isActive: true,
        });
      }
      assigned++;
      console.log(`    + LINK to MPN clinic ${c.name}`);
    } catch (e: any) {
      console.error(`  ! ERROR ${tag}: ${e.message}`);
      errors.push({ clinic: c.name || c.id, error: e.message });
    }
  }

  console.log(`\n=== Súhrn ===`);
  console.log(`Klinik spracovaných:        ${rows.length}`);
  console.log(`Osoby vytvorené:            ${created}`);
  console.log(`Osoby použité existujúce:   ${reused}`);
  console.log(`Priradení do MPN nových:    ${assigned}`);
  console.log(`Priradení už existujúcich:  ${skippedAssign}`);
  console.log(`Chyby:                      ${errors.length}`);
  if (errors.length) {
    console.log(`\nDetail chýb:`);
    for (const e of errors) console.log(`  - ${e.clinic}: ${e.error}`);
  }
  if (!APPLY) {
    console.log(`\nToto bol dry-run. Pre skutočný zápis spusti:\n  npx tsx scripts/migrate-clinic-doctors.ts --apply\n`);
  }

  process.exit(0);
}

async function findCollaborator(
  firstName: string,
  lastName: string,
  email: string | null,
  countryCode: string,
) {
  if (email) {
    const byEmail = await db
      .select()
      .from(collaborators)
      .where(
        and(
          sql`LOWER(${collaborators.email}) = LOWER(${email})`,
          sql`LOWER(${collaborators.firstName}) = LOWER(${firstName})`,
          sql`LOWER(${collaborators.lastName}) = LOWER(${lastName})`,
        ),
      );
    if (byEmail.length) return byEmail[0];
  }
  const byName = await db
    .select()
    .from(collaborators)
    .where(
      and(
        sql`LOWER(${collaborators.firstName}) = LOWER(${firstName})`,
        sql`LOWER(${collaborators.lastName}) = LOWER(${lastName})`,
        eq(collaborators.countryCode, countryCode),
      ),
    );
  return byName[0] || null;
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
