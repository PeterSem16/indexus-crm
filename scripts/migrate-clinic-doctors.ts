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
import { and, eq, sql, isNotNull } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");

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

  // 2. Vyber všetky kliniky s doktorom
  const rows = await db
    .select()
    .from(clinics)
    .where(
      and(
        isNotNull(clinics.doctorFirstName),
        isNotNull(clinics.doctorLastName),
        sql`TRIM(${clinics.doctorFirstName}) <> ''`,
        sql`TRIM(${clinics.doctorLastName}) <> ''`,
      ),
    );

  console.log(`Nájdených klinik s doktorom: ${rows.length}\n`);

  let created = 0;
  let reused = 0;
  let assigned = 0;
  let skippedAssign = 0;
  const errors: Array<{ clinic: string; error: string }> = [];

  for (const c of rows) {
    const fn = (c.doctorFirstName || "").trim();
    const ln = (c.doctorLastName || "").trim();
    const title = (c.doctorTitle || "").trim() || null;
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
