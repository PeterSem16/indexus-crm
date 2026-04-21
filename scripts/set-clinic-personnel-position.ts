/**
 * set-clinic-personnel-position.ts
 *
 * Pre všetky osoby (collaborators), ktoré sú v paneli "Personnel" v ktorejkoľvek
 * KLINIKE (= contact_assignments s entity_type='clinic'), nastaví:
 *
 *   1) contact_assignments.position           = "Private gynecologist"
 *      (iba riadky kde entity_type='clinic')
 *
 *   2) collaborators.professional_classification = "Private gynecologist"
 *      (iba pre tie osoby, ktoré sú aspoň v jednej klinike personnel)
 *
 * Použitie:
 *   npx tsx scripts/set-clinic-personnel-position.ts --dry-run
 *   npx tsx scripts/set-clinic-personnel-position.ts
 *
 * Voliteľne iný text pozície:
 *   npx tsx scripts/set-clinic-personnel-position.ts --position="Private gynecologist"
 */

import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../server/db";
import { collaborators, contactAssignments } from "../shared/schema";

const DRY_RUN = process.argv.includes("--dry-run");
const POS_ARG = process.argv.find((a) => a.startsWith("--position="));
const POSITION = POS_ARG ? POS_ARG.split("=")[1] : "Private gynecologist";

async function run() {
  console.log("================================================================");
  console.log(" set-clinic-personnel-position" + (DRY_RUN ? "  [DRY-RUN MODE]" : ""));
  console.log(`  position = "${POSITION}"`);
  console.log("================================================================");

  // 1) všetky contact_assignments na kliniky
  const clinicAssignments = await db
    .select({
      id: contactAssignments.id,
      personId: contactAssignments.personId,
      entityId: contactAssignments.entityId,
      currentPosition: contactAssignments.position,
    })
    .from(contactAssignments)
    .where(eq(contactAssignments.entityType, "clinic"));

  console.log(`\nFound ${clinicAssignments.length} clinic-personnel assignment(s).`);

  const personIds = Array.from(new Set(clinicAssignments.map((a) => a.personId)));
  console.log(`Distinct persons in clinic personnel: ${personIds.length}`);

  // 2) UPDATE contact_assignments.position
  let assignmentsToChange = clinicAssignments.filter((a) => a.currentPosition !== POSITION);
  console.log(
    `Assignments needing update: ${assignmentsToChange.length}` +
      ` (skipping ${clinicAssignments.length - assignmentsToChange.length} already set)`,
  );

  if (DRY_RUN) {
    console.log(
      `  [DRY] would UPDATE contact_assignments SET position='${POSITION}'` +
        ` WHERE entity_type='clinic' AND position IS DISTINCT FROM '${POSITION}'`,
    );
  } else if (assignmentsToChange.length > 0) {
    const res = await db
      .update(contactAssignments)
      .set({ position: POSITION, updatedAt: new Date() })
      .where(
        sql`${contactAssignments.entityType} = 'clinic' AND (${contactAssignments.position} IS DISTINCT FROM ${POSITION})`,
      );
    console.log(`  ✓ updated ${(res as any)?.rowCount ?? "?"} assignment row(s).`);
  }

  // 3) UPDATE collaborators.professional_classification (iba pre dotknuté osoby)
  if (personIds.length === 0) {
    console.log("\nNo persons to update on collaborators side.");
  } else {
    const collabs = await db
      .select({
        id: collaborators.id,
        firstName: collaborators.firstName,
        lastName: collaborators.lastName,
        currentClass: collaborators.professionalClassification,
      })
      .from(collaborators)
      .where(inArray(collaborators.id, personIds));

    const collabsToChange = collabs.filter((c) => c.currentClass !== POSITION);
    console.log(
      `\nCollaborators needing professionalClassification update: ${collabsToChange.length}` +
        ` (skipping ${collabs.length - collabsToChange.length} already set)`,
    );

    if (DRY_RUN) {
      for (const c of collabsToChange.slice(0, 10)) {
        console.log(
          `  [DRY] ${c.firstName} ${c.lastName}` +
            `  ${c.currentClass || "(empty)"} -> "${POSITION}"`,
        );
      }
      if (collabsToChange.length > 10) {
        console.log(`  ... and ${collabsToChange.length - 10} more`);
      }
    } else if (collabsToChange.length > 0) {
      const res = await db
        .update(collaborators)
        .set({ professionalClassification: POSITION, updatedAt: new Date() })
        .where(
          sql`${collaborators.id} IN (${sql.join(collabsToChange.map((c) => sql`${c.id}`), sql`, `)})`,
        );
      console.log(`  ✓ updated ${(res as any)?.rowCount ?? collabsToChange.length} collaborator row(s).`);
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
