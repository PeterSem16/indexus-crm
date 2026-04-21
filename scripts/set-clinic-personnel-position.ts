/**
 * set-clinic-personnel-position.ts
 *
 * Pre všetky osoby v paneli "Personnel" v ktorejkoľvek KLINIKE nastaví Position
 * (= partner_categories kategóriu — to čo v UI vyberáš v dropdowne) na zadaný kód.
 *
 * Default: "gynecologist_private"  (zobrazí sa ako "Súkromný gynekológ" / "Private Gynecologist")
 *
 * Aktualizuje:
 *   1) contact_assignments.category_id  (kde entity_type='clinic')
 *      → Position v paneli Personnel v karte Clinic
 *   2) collaborators.partner_category   (pre tie isté osoby)
 *      → Position v Edit Collaborator
 *
 * Použitie:
 *   npx tsx scripts/set-clinic-personnel-position.ts --dry-run
 *   npx tsx scripts/set-clinic-personnel-position.ts
 *   npx tsx scripts/set-clinic-personnel-position.ts --code=pediatrician_private
 *   npx tsx scripts/set-clinic-personnel-position.ts --category-id=<uuid>
 */

import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../server/db";
import {
  collaborators,
  contactAssignments,
  partnerCategories,
} from "../shared/schema";

const DRY_RUN = process.argv.includes("--dry-run");
const CODE_ARG = process.argv.find((a) => a.startsWith("--code="));
const ID_ARG = process.argv.find((a) => a.startsWith("--category-id="));
const CODE = CODE_ARG ? CODE_ARG.split("=")[1] : "gynecologist_private";

async function run() {
  console.log("================================================================");
  console.log(" set-clinic-personnel-position" + (DRY_RUN ? "  [DRY-RUN MODE]" : ""));
  console.log("================================================================");

  // 1) nájdi cieľovú kategóriu
  let category;
  if (ID_ARG) {
    const id = ID_ARG.split("=")[1];
    [category] = await db
      .select()
      .from(partnerCategories)
      .where(eq(partnerCategories.id, id))
      .limit(1);
  } else {
    [category] = await db
      .select()
      .from(partnerCategories)
      .where(eq(partnerCategories.code, CODE))
      .limit(1);
  }
  if (!category) {
    console.error(
      `\nFATAL: Kategória s ${ID_ARG ? "id" : `code="${CODE}"`} sa nenašla v partner_categories.`,
    );
    console.error("Vypíš dostupné kategórie:");
    const all = await db.select().from(partnerCategories);
    for (const c of all) console.error(`  - ${c.code}  (${c.entityScope})  id=${c.id}  "${c.name}"`);
    process.exit(2);
  }
  console.log(
    `Target category: code="${category.code}"  name="${category.name}"  id=${category.id}` +
      `  scope=${category.entityScope}`,
  );
  if (category.entityScope !== "clinic") {
    console.log(
      `  ⚠ pozor: kategória má scope "${category.entityScope}", nie "clinic" — UI ju nemusí zobrazovať pri klinikách.`,
    );
  }

  // 2) všetky contact_assignments na kliniky
  const clinicAssignments = await db
    .select({
      id: contactAssignments.id,
      personId: contactAssignments.personId,
      currentCategoryId: contactAssignments.categoryId,
    })
    .from(contactAssignments)
    .where(eq(contactAssignments.entityType, "clinic"));

  console.log(`\nFound ${clinicAssignments.length} clinic-personnel assignment(s).`);
  const personIds = Array.from(new Set(clinicAssignments.map((a) => a.personId)));
  console.log(`Distinct persons in clinic personnel: ${personIds.length}`);

  const assignmentsToChange = clinicAssignments.filter(
    (a) => a.currentCategoryId !== category.id,
  );
  console.log(
    `Assignments needing update: ${assignmentsToChange.length}` +
      ` (skipping ${clinicAssignments.length - assignmentsToChange.length} already set)`,
  );

  // 3) UPDATE contact_assignments.category_id
  if (assignmentsToChange.length > 0) {
    if (DRY_RUN) {
      console.log(
        `  [DRY] would UPDATE contact_assignments SET category_id='${category.id}'` +
          ` WHERE entity_type='clinic' AND category_id IS DISTINCT FROM '${category.id}'`,
      );
    } else {
      const res = await db
        .update(contactAssignments)
        .set({ categoryId: category.id, updatedAt: new Date() })
        .where(
          sql`${contactAssignments.entityType} = 'clinic' AND (${contactAssignments.categoryId} IS DISTINCT FROM ${category.id})`,
        );
      console.log(`  ✓ updated ${(res as any)?.rowCount ?? assignmentsToChange.length} assignment row(s).`);
    }
  }

  // 4) UPDATE collaborators.partner_category (iba dotknuté osoby)
  if (personIds.length === 0) {
    console.log("\nNo persons to update on collaborators side.");
  } else {
    const collabs = await db
      .select({
        id: collaborators.id,
        firstName: collaborators.firstName,
        lastName: collaborators.lastName,
        currentPartnerCategory: collaborators.partnerCategory,
      })
      .from(collaborators)
      .where(inArray(collaborators.id, personIds));

    const collabsToChange = collabs.filter((c) => c.currentPartnerCategory !== category.id);
    console.log(
      `\nCollaborators needing partner_category update: ${collabsToChange.length}` +
        ` (skipping ${collabs.length - collabsToChange.length} already set)`,
    );

    if (collabsToChange.length > 0) {
      if (DRY_RUN) {
        for (const c of collabsToChange.slice(0, 10)) {
          console.log(
            `  [DRY] ${c.firstName} ${c.lastName}` +
              `  ${c.currentPartnerCategory || "(empty)"} -> ${category.id}`,
          );
        }
        if (collabsToChange.length > 10) {
          console.log(`  ... and ${collabsToChange.length - 10} more`);
        }
      } else {
        const res = await db
          .update(collaborators)
          .set({ partnerCategory: category.id, updatedAt: new Date() })
          .where(inArray(collaborators.id, collabsToChange.map((c) => c.id)));
        console.log(
          `  ✓ updated ${(res as any)?.rowCount ?? collabsToChange.length} collaborator row(s).`,
        );
      }
    }
  }

  console.log("\n================================================================");
  console.log(" Hotovo." + (DRY_RUN ? "  [DRY-RUN — no changes were written]" : ""));
  console.log("================================================================");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });
