/**
 * backfill-personnel-from-links.ts
 *
 * Pre každého collaboratora prejde jeho väzby na clinic/hospital
 * (clinicId, clinicIds[], hospitalId, hospitalIds[]) a vytvorí
 * chýbajúce záznamy v `contact_assignments` — to je tabuľka,
 * ktorú zobrazuje panel "Personnel" v detaile ambulancie/nemocnice.
 *
 * Použitie:
 *   npx tsx scripts/backfill-personnel-from-links.ts --dry-run
 *   npx tsx scripts/backfill-personnel-from-links.ts
 */

import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { collaborators, contactAssignments } from "../shared/schema";

const DRY_RUN = process.argv.includes("--dry-run");

const stats = {
  collabsScanned: 0,
  clinicLinks: 0,
  hospitalLinks: 0,
  created: 0,
  skippedExisting: 0,
  errors: 0,
};

async function ensureAssignment(
  personId: string,
  entityType: "clinic" | "hospital",
  entityId: string,
  isActive: boolean,
  position: string | null,
  isPrimary: boolean,
) {
  if (DRY_RUN) {
    console.log(
      `  [DRY] PERSONNEL ${entityType}=${entityId} <- person=${personId}` +
        (isPrimary ? " (primary)" : ""),
    );
    stats.created++;
    return;
  }

  const existing = await db
    .select({ id: contactAssignments.id })
    .from(contactAssignments)
    .where(
      and(
        eq(contactAssignments.personId, personId),
        eq(contactAssignments.entityType, entityType),
        eq(contactAssignments.entityId, entityId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    stats.skippedExisting++;
    return;
  }

  await db.insert(contactAssignments).values({
    personId,
    entityType,
    entityId,
    position,
    isPrimary,
    isActive,
    notes: "Auto-created by backfill-personnel-from-links",
  });
  stats.created++;
  console.log(
    `  + personnel ${entityType}/${entityId} <- person ${personId}` +
      (isPrimary ? " (primary)" : ""),
  );
}

async function run() {
  console.log("================================================================");
  console.log(" backfill-personnel-from-links" + (DRY_RUN ? "  [DRY-RUN MODE]" : ""));
  console.log("================================================================");

  const all = await db.select().from(collaborators);
  console.log(`Loaded ${all.length} collaborators\n`);

  for (const c of all) {
    stats.collabsScanned++;
    const personId = c.id;
    const isActive = c.isActive ?? true;
    // "position" v personnel paneli — použijeme názov pracoviska, ak je
    const position = (c.workplaceName || "").trim() || null;

    // ---- CLINICS ----
    const clinicIds = new Set<string>();
    if (c.clinicId) clinicIds.add(c.clinicId);
    if (Array.isArray(c.clinicIds)) {
      for (const cid of c.clinicIds) if (cid) clinicIds.add(cid);
    }
    for (const cid of clinicIds) {
      stats.clinicLinks++;
      const isPrimary = cid === c.clinicId;
      try {
        await ensureAssignment(personId, "clinic", cid, isActive, position, isPrimary);
      } catch (err) {
        stats.errors++;
        console.error(`  ! ERROR clinic ${cid} <- person ${personId}:`, err);
      }
    }

    // ---- HOSPITALS ----
    const hospitalIds = new Set<string>();
    if (c.hospitalId) hospitalIds.add(c.hospitalId);
    if (Array.isArray(c.hospitalIds)) {
      for (const hid of c.hospitalIds) if (hid) hospitalIds.add(hid);
    }
    for (const hid of hospitalIds) {
      stats.hospitalLinks++;
      const isPrimary = hid === c.hospitalId;
      try {
        await ensureAssignment(personId, "hospital", hid, isActive, position, isPrimary);
      } catch (err) {
        stats.errors++;
        console.error(`  ! ERROR hospital ${hid} <- person ${personId}:`, err);
      }
    }
  }

  console.log("\n================================================================");
  console.log(" SUMMARY" + (DRY_RUN ? "  [DRY-RUN — no changes were written]" : ""));
  console.log("================================================================");
  console.log(`  Collaborators scanned   : ${stats.collabsScanned}`);
  console.log(`  Clinic links found      : ${stats.clinicLinks}`);
  console.log(`  Hospital links found    : ${stats.hospitalLinks}`);
  console.log(`  Personnel created       : ${stats.created}`);
  console.log(`  Skipped (already exists): ${stats.skippedExisting}`);
  console.log(`  Errors                  : ${stats.errors}`);
  console.log("================================================================");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });
