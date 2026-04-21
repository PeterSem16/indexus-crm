/**
 * sync-workplace-to-org.ts
 *
 * Z prepojí "Adresa pracoviska" (collaborator_addresses.address_type='work')
 * každého collaboratora do tabuľky `hospitals` alebo `clinics`:
 *   - ak názov pracoviska obsahuje "nemocnic" -> hospitals
 *   - inak                                    -> clinics
 *
 * Match existujúceho záznamu = lower(name) + lower(city) + countryCode.
 *  - ak neexistuje  -> INSERT
 *  - ak existuje a chýbajú údaje -> UPDATE (doplnenie chýbajúcich polí)
 *  - ak je všetko zhodné -> SKIP
 *
 * Následne prelinkuje collaboratora cez hospitalId/hospitalIds[] alebo
 * clinicId/clinicIds[].
 *
 * Spustenie:
 *   npx tsx scripts/sync-workplace-to-org.ts            # vykoná zmeny
 *   npx tsx scripts/sync-workplace-to-org.ts --dry-run  # iba report, bez zápisu
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "../server/db";
import {
  collaborators,
  collaboratorAddresses,
  hospitals,
  clinics,
} from "../shared/schema";

const DRY_RUN = process.argv.includes("--dry-run");

type WorkAddr = typeof collaboratorAddresses.$inferSelect;

function norm(v: string | null | undefined): string {
  return (v || "").trim().toLowerCase();
}

function isHospitalName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("nemocnic") ||      // nemocnica / nemocnice / nemocničná
    n.includes("hospital") ||
    n.includes("kórház") ||         // HU
    n.includes("spital") ||         // RO
    n.includes("ospedale") ||       // IT
    n.includes("krankenhaus") ||    // DE
    n.includes("klinikum")          // DE - velká nemocnica
  );
}

interface Stats {
  total: number;
  skippedNoName: number;
  hospitalsCreated: number;
  hospitalsUpdated: number;
  hospitalsLinked: number;
  clinicsCreated: number;
  clinicsUpdated: number;
  clinicsLinked: number;
  unchanged: number;
  errors: number;
}

const stats: Stats = {
  total: 0,
  skippedNoName: 0,
  hospitalsCreated: 0,
  hospitalsUpdated: 0,
  hospitalsLinked: 0,
  clinicsCreated: 0,
  clinicsUpdated: 0,
  clinicsLinked: 0,
  unchanged: 0,
  errors: 0,
};

async function upsertHospital(addr: WorkAddr): Promise<string | null> {
  const name = (addr.name || "").trim();
  const country = addr.countryCode || "SK";

  // Match by name (case-insensitive) + city + country
  const existing = await db
    .select()
    .from(hospitals)
    .where(
      and(
        sql`lower(${hospitals.name}) = ${norm(name)}`,
        addr.city
          ? sql`lower(coalesce(${hospitals.city}, '')) = ${norm(addr.city)}`
          : sql`coalesce(${hospitals.city}, '') = ''`,
        eq(hospitals.countryCode, country),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    if (DRY_RUN) {
      console.log(`  [DRY] CREATE hospital: "${name}" / ${addr.city || "-"} / ${country}`);
      stats.hospitalsCreated++;
      return "dry-run-id";
    }
    const [created] = await db
      .insert(hospitals)
      .values({
        name,
        fullName: name,
        streetNumber: addr.streetNumber || null,
        city: addr.city || null,
        postalCode: addr.postalCode || null,
        region: addr.region || null,
        countryCode: country,
        dataSource: "workplace-sync",
      })
      .returning({ id: hospitals.id });
    stats.hospitalsCreated++;
    console.log(`  + CREATE hospital ${created.id} "${name}"`);
    return created.id;
  }

  const h = existing[0];
  const patch: Partial<typeof hospitals.$inferInsert> = {};
  if (!h.streetNumber && addr.streetNumber) patch.streetNumber = addr.streetNumber;
  if (!h.city && addr.city) patch.city = addr.city;
  if (!h.postalCode && addr.postalCode) patch.postalCode = addr.postalCode;
  if (!h.region && addr.region) patch.region = addr.region;
  if (!h.fullName && name) patch.fullName = name;

  if (Object.keys(patch).length === 0) {
    return h.id; // nothing to change
  }

  if (DRY_RUN) {
    console.log(`  [DRY] UPDATE hospital ${h.id} "${name}" with`, patch);
    stats.hospitalsUpdated++;
    return h.id;
  }
  await db
    .update(hospitals)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(hospitals.id, h.id));
  stats.hospitalsUpdated++;
  console.log(`  ~ UPDATE hospital ${h.id} "${name}"`, Object.keys(patch).join(","));
  return h.id;
}

async function upsertClinic(addr: WorkAddr): Promise<string | null> {
  const name = (addr.name || "").trim();
  const country = addr.countryCode || "SK";

  const existing = await db
    .select()
    .from(clinics)
    .where(
      and(
        sql`lower(${clinics.name}) = ${norm(name)}`,
        addr.city
          ? sql`lower(coalesce(${clinics.city}, '')) = ${norm(addr.city)}`
          : sql`coalesce(${clinics.city}, '') = ''`,
        eq(clinics.countryCode, country),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    if (DRY_RUN) {
      console.log(`  [DRY] CREATE clinic: "${name}" / ${addr.city || "-"} / ${country}`);
      stats.clinicsCreated++;
      return "dry-run-id";
    }
    const [created] = await db
      .insert(clinics)
      .values({
        name,
        address: addr.streetNumber || null,
        city: addr.city || null,
        postalCode: addr.postalCode || null,
        region: addr.region || null,
        countryCode: country,
        leadSource: "workplace-sync",
      })
      .returning({ id: clinics.id });
    stats.clinicsCreated++;
    console.log(`  + CREATE clinic ${created.id} "${name}"`);
    return created.id;
  }

  const c = existing[0];
  const patch: Partial<typeof clinics.$inferInsert> = {};
  if (!c.address && addr.streetNumber) patch.address = addr.streetNumber;
  if (!c.city && addr.city) patch.city = addr.city;
  if (!c.postalCode && addr.postalCode) patch.postalCode = addr.postalCode;
  if (!c.region && addr.region) patch.region = addr.region;

  if (Object.keys(patch).length === 0) {
    return c.id;
  }

  if (DRY_RUN) {
    console.log(`  [DRY] UPDATE clinic ${c.id} "${name}" with`, patch);
    stats.clinicsUpdated++;
    return c.id;
  }
  await db
    .update(clinics)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(clinics.id, c.id));
  stats.clinicsUpdated++;
  console.log(`  ~ UPDATE clinic ${c.id} "${name}"`, Object.keys(patch).join(","));
  return c.id;
}

async function linkCollaboratorToHospital(collabId: string, hospitalId: string) {
  if (DRY_RUN) {
    console.log(`  [DRY] LINK collab ${collabId} -> hospital ${hospitalId}`);
    stats.hospitalsLinked++;
    return;
  }
  const [collab] = await db
    .select({ hospitalId: collaborators.hospitalId, hospitalIds: collaborators.hospitalIds })
    .from(collaborators)
    .where(eq(collaborators.id, collabId))
    .limit(1);
  if (!collab) return;

  const ids = new Set(collab.hospitalIds || []);
  ids.add(hospitalId);
  const newPrimary = collab.hospitalId || hospitalId;
  const idsArr = Array.from(ids);

  const sameIds =
    (collab.hospitalIds || []).length === idsArr.length &&
    (collab.hospitalIds || []).every((x) => ids.has(x));
  if (collab.hospitalId === newPrimary && sameIds) {
    stats.unchanged++;
    return;
  }

  await db
    .update(collaborators)
    .set({ hospitalId: newPrimary, hospitalIds: idsArr, updatedAt: new Date() })
    .where(eq(collaborators.id, collabId));
  stats.hospitalsLinked++;
  console.log(`  -> linked collab ${collabId} to hospital ${hospitalId}`);
}

async function linkCollaboratorToClinic(collabId: string, clinicId: string) {
  if (DRY_RUN) {
    console.log(`  [DRY] LINK collab ${collabId} -> clinic ${clinicId}`);
    stats.clinicsLinked++;
    return;
  }
  const [collab] = await db
    .select({ clinicId: collaborators.clinicId, clinicIds: collaborators.clinicIds })
    .from(collaborators)
    .where(eq(collaborators.id, collabId))
    .limit(1);
  if (!collab) return;

  const ids = new Set(collab.clinicIds || []);
  ids.add(clinicId);
  const newPrimary = collab.clinicId || clinicId;
  const idsArr = Array.from(ids);

  const sameIds =
    (collab.clinicIds || []).length === idsArr.length &&
    (collab.clinicIds || []).every((x) => ids.has(x));
  if (collab.clinicId === newPrimary && sameIds) {
    stats.unchanged++;
    return;
  }

  await db
    .update(collaborators)
    .set({ clinicId: newPrimary, clinicIds: idsArr, updatedAt: new Date() })
    .where(eq(collaborators.id, collabId));
  stats.clinicsLinked++;
  console.log(`  -> linked collab ${collabId} to clinic ${clinicId}`);
}

async function run() {
  console.log("================================================================");
  console.log(" sync-workplace-to-org" + (DRY_RUN ? "  [DRY-RUN MODE]" : ""));
  console.log("================================================================");

  const workAddrs = await db
    .select()
    .from(collaboratorAddresses)
    .where(eq(collaboratorAddresses.addressType, "work"));

  console.log(`Found ${workAddrs.length} workplace addresses\n`);

  for (const addr of workAddrs) {
    stats.total++;
    const name = (addr.name || "").trim();
    if (!name) {
      stats.skippedNoName++;
      continue;
    }

    console.log(`[${stats.total}/${workAddrs.length}] collab=${addr.collaboratorId}  "${name}" (${addr.city || "-"})`);

    try {
      if (isHospitalName(name)) {
        const hid = await upsertHospital(addr);
        if (hid && hid !== "dry-run-id") {
          await linkCollaboratorToHospital(addr.collaboratorId, hid);
        } else if (DRY_RUN) {
          stats.hospitalsLinked++;
        }
      } else {
        const cid = await upsertClinic(addr);
        if (cid && cid !== "dry-run-id") {
          await linkCollaboratorToClinic(addr.collaboratorId, cid);
        } else if (DRY_RUN) {
          stats.clinicsLinked++;
        }
      }
    } catch (err) {
      stats.errors++;
      console.error(`  ! ERROR for collab ${addr.collaboratorId}:`, err);
    }
  }

  console.log("\n================================================================");
  console.log(" SUMMARY" + (DRY_RUN ? "  [DRY-RUN — no changes were written]" : ""));
  console.log("================================================================");
  console.log(`  Total work-addresses processed : ${stats.total}`);
  console.log(`  Skipped (no name)              : ${stats.skippedNoName}`);
  console.log(`  Hospitals created              : ${stats.hospitalsCreated}`);
  console.log(`  Hospitals updated              : ${stats.hospitalsUpdated}`);
  console.log(`  Hospitals linked to collab     : ${stats.hospitalsLinked}`);
  console.log(`  Clinics created                : ${stats.clinicsCreated}`);
  console.log(`  Clinics updated                : ${stats.clinicsUpdated}`);
  console.log(`  Clinics linked to collab       : ${stats.clinicsLinked}`);
  console.log(`  Unchanged (already linked)     : ${stats.unchanged}`);
  console.log(`  Errors                         : ${stats.errors}`);
  console.log("================================================================\n");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });
