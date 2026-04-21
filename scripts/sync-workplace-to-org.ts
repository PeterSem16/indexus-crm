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
  collaboratorAgreements,
  hospitals,
  clinics,
} from "../shared/schema";

type CollabStatus = "current_collaborator" | "former_collaborator" | null;

/**
 * Map collaboratorId -> "current_collaborator" | "former_collaborator" | null
 * - "current"  = aspoň jedna dohoda s validTo >= dnes (alebo bez validTo a isValid=true)
 * - "former"   = má dohody, ale všetky vypršali pred dneškom
 * - null       = nemá žiadne dohody (nemeníme leadSource)
 */
const collabStatusMap = new Map<string, CollabStatus>();

async function buildCollabStatusMap() {
  const agreements = await db.select().from(collaboratorAgreements);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byCollab = new Map<string, typeof agreements>();
  for (const a of agreements) {
    const arr = byCollab.get(a.collaboratorId) || [];
    arr.push(a);
    byCollab.set(a.collaboratorId, arr);
  }

  for (const [collabId, list] of byCollab.entries()) {
    let hasCurrent = false;
    for (const a of list) {
      const y = a.validToYear, m = a.validToMonth, d = a.validToDay;
      // No validTo set + marked valid -> current
      if (!y || !m || !d) {
        if (a.isValid) { hasCurrent = true; break; }
        continue;
      }
      const validTo = new Date(y, m - 1, d);
      if (validTo >= today) { hasCurrent = true; break; }
    }
    collabStatusMap.set(collabId, hasCurrent ? "current_collaborator" : "former_collaborator");
  }
}

const DRY_RUN = process.argv.includes("--dry-run");
const ONLY_ARG = process.argv.find((a) => a.startsWith("--only="));
const ONLY: "hospitals" | "clinics" | "all" = ONLY_ARG
  ? (ONLY_ARG.split("=")[1] as any)
  : "all";
if (!["all", "hospitals", "clinics"].includes(ONLY)) {
  console.error(`Invalid --only value: ${ONLY}. Use 'hospitals' or 'clinics'.`);
  process.exit(1);
}

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

interface CountryStats {
  total: number;
  hospitalsCreated: number;
  hospitalsUpdated: number;
  clinicsCreated: number;
  clinicsUpdated: number;
  current: number;
  former: number;
  noStatus: number;
  skippedNoName: number;
}

function emptyCountryStats(): CountryStats {
  return {
    total: 0,
    hospitalsCreated: 0,
    hospitalsUpdated: 0,
    clinicsCreated: 0,
    clinicsUpdated: 0,
    current: 0,
    former: 0,
    noStatus: 0,
    skippedNoName: 0,
  };
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
  byCountry: Map<string, CountryStats>;
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
  byCountry: new Map(),
};

function getCountryStats(country: string): CountryStats {
  let cs = stats.byCountry.get(country);
  if (!cs) {
    cs = emptyCountryStats();
    stats.byCountry.set(country, cs);
  }
  return cs;
}

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
      getCountryStats(country).hospitalsCreated++;
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
    getCountryStats(country).hospitalsCreated++;
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
    getCountryStats(country).hospitalsUpdated++;
    return h.id;
  }
  await db
    .update(hospitals)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(hospitals.id, h.id));
  stats.hospitalsUpdated++;
  getCountryStats(country).hospitalsUpdated++;
  console.log(`  ~ UPDATE hospital ${h.id} "${name}"`, Object.keys(patch).join(","));
  return h.id;
}

async function upsertClinic(addr: WorkAddr): Promise<string | null> {
  const name = (addr.name || "").trim();
  const country = addr.countryCode || "SK";
  const status = collabStatusMap.get(addr.collaboratorId) || null;

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
      console.log(`  [DRY] CREATE clinic: "${name}" / ${addr.city || "-"} / ${country} / leadSource=${status || "(none)"}`);
      stats.clinicsCreated++;
      const cs = getCountryStats(country);
      cs.clinicsCreated++;
      if (status === "current_collaborator") cs.current++;
      else if (status === "former_collaborator") cs.former++;
      else cs.noStatus++;
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
        leadSource: status || null,
        leadSourceDate: status ? new Date() : null,
        leadSourceNotes: status ? "Auto-set from workplace-sync (collaborator agreement state)" : null,
      })
      .returning({ id: clinics.id });
    stats.clinicsCreated++;
    const cs = getCountryStats(country);
    cs.clinicsCreated++;
    if (status === "current_collaborator") cs.current++;
    else if (status === "former_collaborator") cs.former++;
    else cs.noStatus++;
    console.log(`  + CREATE clinic ${created.id} "${name}" leadSource=${status || "(none)"}`);
    return created.id;
  }

  const c = existing[0];
  const patch: Partial<typeof clinics.$inferInsert> = {};
  if (!c.address && addr.streetNumber) patch.address = addr.streetNumber;
  if (!c.city && addr.city) patch.city = addr.city;
  if (!c.postalCode && addr.postalCode) patch.postalCode = addr.postalCode;
  if (!c.region && addr.region) patch.region = addr.region;

  // leadSource: vždy preber aktuálny stav (môže sa časom meniť current <-> former)
  if (status && c.leadSource !== status) {
    patch.leadSource = status;
    patch.leadSourceDate = new Date();
    if (!c.leadSourceNotes) {
      patch.leadSourceNotes = "Auto-set from workplace-sync (collaborator agreement state)";
    }
  }

  if (Object.keys(patch).length === 0) {
    return c.id;
  }

  if (DRY_RUN) {
    console.log(`  [DRY] UPDATE clinic ${c.id} "${name}" with`, patch);
    stats.clinicsUpdated++;
    getCountryStats(country).clinicsUpdated++;
    return c.id;
  }
  await db
    .update(clinics)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(clinics.id, c.id));
  stats.clinicsUpdated++;
  getCountryStats(country).clinicsUpdated++;
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

  console.log("Building collaborator agreement-status map...");
  await buildCollabStatusMap();
  let curr = 0, form = 0;
  for (const v of collabStatusMap.values()) {
    if (v === "current_collaborator") curr++;
    else if (v === "former_collaborator") form++;
  }
  console.log(`  -> ${collabStatusMap.size} collaborators with agreements (${curr} current, ${form} former)\n`);

  const workAddrs = await db
    .select()
    .from(collaboratorAddresses)
    .where(eq(collaboratorAddresses.addressType, "work"));

  console.log(`Found ${workAddrs.length} workplace addresses\n`);

  for (const addr of workAddrs) {
    stats.total++;
    const country = addr.countryCode || "SK";
    getCountryStats(country).total++;
    const name = (addr.name || "").trim();
    if (!name) {
      stats.skippedNoName++;
      getCountryStats(country).skippedNoName++;
      continue;
    }

    console.log(`[${stats.total}/${workAddrs.length}] collab=${addr.collaboratorId}  "${name}" (${addr.city || "-"})`);

    try {
      const wantsHospital = isHospitalName(name);
      // Apply --only filter — preskoč adresy mimo zvoleného typu
      if (ONLY === "hospitals" && !wantsHospital) continue;
      if (ONLY === "clinics" && wantsHospital) continue;

      if (wantsHospital) {
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

  if (stats.byCountry.size > 0) {
    console.log("\n----------------------------------------------------------------");
    console.log(" BREAKDOWN BY COUNTRY");
    console.log("----------------------------------------------------------------");
    const header =
      "  CC  | Total | Skip | H+ | H~ | C+ | C~ | Curr | Form | NoStat";
    console.log(header);
    console.log("  ----+-------+------+----+----+----+----+------+------+-------");
    const rows = Array.from(stats.byCountry.entries()).sort(
      (a, b) => b[1].total - a[1].total,
    );
    for (const [cc, cs] of rows) {
      const pad = (n: number, w: number) => String(n).padStart(w);
      console.log(
        `  ${cc.padEnd(3)} | ${pad(cs.total, 5)} | ${pad(cs.skippedNoName, 4)} | ${pad(cs.hospitalsCreated, 2)} | ${pad(cs.hospitalsUpdated, 2)} | ${pad(cs.clinicsCreated, 2)} | ${pad(cs.clinicsUpdated, 2)} | ${pad(cs.current, 4)} | ${pad(cs.former, 4)} | ${pad(cs.noStatus, 5)}`,
      );
    }
    console.log("  Legenda:  H+ = hospitals created   H~ = hospitals updated");
    console.log("            C+ = clinics created     C~ = clinics updated");
    console.log("            Curr/Form/NoStat = leadSource pri novovytvorených ambulanciách");
  }
  console.log("================================================================\n");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });
