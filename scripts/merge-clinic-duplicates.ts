/**
 * merge-clinic-duplicates.ts
 *
 * Nájde duplicitné záznamy v `clinics` (rovnaký normalizovaný názov + mesto +
 * krajina), zlúči ich do jedného "vyhrávajúceho" záznamu (winner), prenesie
 * doňho chýbajúce údaje z ostatných (losers) a presmeruje VŠETKY referencie:
 *
 *   - collaborators.clinicId          (primárna)
 *   - collaborators.clinicIds[]       (zoznam)
 *   - contact_assignments.entityId    (panel Personnel; ošetrený unique konflikt)
 *   - clinic_referrals.clinicId
 *   - clinic_referrals.referringClinicId
 *   - clinic_events.clinicId
 *   - hospital_network_members.clinicId
 *   - campaign_contacts.clinicId
 *
 * Až keď sú všetky referencie presmerované, loser sa vymaže.
 *
 * Použitie:
 *   npx tsx scripts/merge-clinic-duplicates.ts --dry-run                # report
 *   npx tsx scripts/merge-clinic-duplicates.ts                          # ostro
 *   npx tsx scripts/merge-clinic-duplicates.ts --only="gynosan"         # iba skupiny
 *                                                                        obsahujúce
 *                                                                        substring
 *   npx tsx scripts/merge-clinic-duplicates.ts --min-group=3            # iba skupiny
 *                                                                        s >=3
 *
 * Normalizácia názvu (na párovanie):
 *   lowercase → odstrániť diakritiku → odstrániť všetky znaky okrem [a-z0-9]
 *   "GYNOSAN, s.r.o."  -> "gynosansro"
 *   "Gynosan,s.r.o."   -> "gynosansro"   (match!)
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../server/db";
import {
  clinics,
  collaborators,
  contactAssignments,
  clinicReferrals,
  clinicEvents,
  hospitalNetworkMembers,
  campaignContacts,
} from "../shared/schema";

const DRY_RUN = process.argv.includes("--dry-run");
const ONLY_ARG = process.argv.find((a) => a.startsWith("--only="));
const ONLY = ONLY_ARG ? ONLY_ARG.split("=")[1].toLowerCase() : null;
const MIN_GROUP_ARG = process.argv.find((a) => a.startsWith("--min-group="));
const MIN_GROUP = MIN_GROUP_ARG ? parseInt(MIN_GROUP_ARG.split("=")[1], 10) : 2;

type ClinicRow = typeof clinics.$inferSelect;

const stats = {
  groupsTotal: 0,
  groupsMerged: 0,
  recordsMerged: 0,    // počet "loser" kliník zlúčených do winnerov
  fieldsCopied: 0,     // koľko prázdnych polí vo winneri sme doplnili
  refsRedirected: 0,   // počet riadkov v iných tabuľkách ktoré sme presmerovali
  refsDeletedDup: 0,   // contact_assignments duplikáty zmazané
  recordsDeleted: 0,
  errors: 0,
};

function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normName(s: string | null | undefined) {
  if (!s) return "";
  return stripDiacritics(s.toLowerCase()).replace(/[^a-z0-9]/g, "");
}

function normCity(s: string | null | undefined) {
  if (!s) return "";
  return stripDiacritics(s.toLowerCase()).replace(/[^a-z0-9]/g, "");
}

function groupKey(c: ClinicRow) {
  return [
    normName(c.name),
    normCity(c.city),
    (c.countryCode || "").toUpperCase(),
  ].join("|");
}

/**
 * Skóre "úplnosti" záznamu — koľko nenulových polí má.
 * Pri rovnakom skóre vyhráva starší záznam (podľa createdAt).
 */
function completenessScore(c: ClinicRow): number {
  const fields: (keyof ClinicRow)[] = [
    "name", "address", "city", "postalCode", "region", "countryCode",
    "phone", "phone2", "email", "website",
    "doctorName", "doctorTitle", "doctorFirstName", "doctorLastName",
    "leadSource", "leadSourceNotes", "notes" as any,
  ];
  let n = 0;
  for (const f of fields) {
    const v = (c as any)[f];
    if (v !== null && v !== undefined && String(v).trim() !== "") n++;
  }
  return n;
}

function pickWinner(rows: ClinicRow[]): ClinicRow {
  return [...rows].sort((a, b) => {
    const sa = completenessScore(a);
    const sb = completenessScore(b);
    if (sb !== sa) return sb - sa; // viac vyplnených polí = vyššie
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb; // pri rovnakom skóre vyhráva starší
  })[0];
}

function mergeFieldsPatch(winner: ClinicRow, loser: ClinicRow) {
  const patch: Record<string, any> = {};
  const fields: (keyof ClinicRow)[] = [
    "address", "city", "postalCode", "region",
    "phone", "phone2", "email", "website",
    "doctorName", "doctorTitle", "doctorFirstName", "doctorLastName",
    "leadSource", "leadSourceDate", "leadSourceNotes",
  ];
  for (const f of fields) {
    const wv = (winner as any)[f];
    const lv = (loser as any)[f];
    const wEmpty = wv === null || wv === undefined || String(wv).trim() === "";
    const lFilled = lv !== null && lv !== undefined && String(lv).trim() !== "";
    if (wEmpty && lFilled) {
      patch[f] = lv;
    }
  }
  return patch;
}

async function redirectSimpleRefs(loserId: string, winnerId: string) {
  // clinic_referrals.clinicId
  if (DRY_RUN) {
    console.log(`    [DRY] redirect clinic_referrals.clinic_id ${loserId} -> ${winnerId}`);
  } else {
    const r1 = await db
      .update(clinicReferrals)
      .set({ clinicId: winnerId })
      .where(eq(clinicReferrals.clinicId, loserId));
    stats.refsRedirected += (r1 as any)?.rowCount || 0;
  }

  // clinic_referrals.referringClinicId
  if (DRY_RUN) {
    console.log(`    [DRY] redirect clinic_referrals.referring_clinic_id ${loserId} -> ${winnerId}`);
  } else {
    const r2 = await db
      .update(clinicReferrals)
      .set({ referringClinicId: winnerId })
      .where(eq(clinicReferrals.referringClinicId, loserId));
    stats.refsRedirected += (r2 as any)?.rowCount || 0;
  }

  // clinic_events
  if (DRY_RUN) {
    console.log(`    [DRY] redirect clinic_events.clinic_id ${loserId} -> ${winnerId}`);
  } else {
    const r3 = await db
      .update(clinicEvents)
      .set({ clinicId: winnerId })
      .where(eq(clinicEvents.clinicId, loserId));
    stats.refsRedirected += (r3 as any)?.rowCount || 0;
  }

  // hospital_network_members
  if (DRY_RUN) {
    console.log(`    [DRY] redirect hospital_network_members.clinic_id ${loserId} -> ${winnerId}`);
  } else {
    const r4 = await db
      .update(hospitalNetworkMembers)
      .set({ clinicId: winnerId })
      .where(eq(hospitalNetworkMembers.clinicId, loserId));
    stats.refsRedirected += (r4 as any)?.rowCount || 0;
  }

  // campaign_contacts
  if (DRY_RUN) {
    console.log(`    [DRY] redirect campaign_contacts.clinic_id ${loserId} -> ${winnerId}`);
  } else {
    const r5 = await db
      .update(campaignContacts)
      .set({ clinicId: winnerId })
      .where(eq(campaignContacts.clinicId, loserId));
    stats.refsRedirected += (r5 as any)?.rowCount || 0;
  }
}

async function redirectCollaborators(loserId: string, winnerId: string) {
  // 1) clinicId (primárna) — ak ukazuje na loser, prepíš na winner
  const primaries = await db
    .select({ id: collaborators.id })
    .from(collaborators)
    .where(eq(collaborators.clinicId, loserId));
  for (const c of primaries) {
    if (DRY_RUN) {
      console.log(`    [DRY] collaborator ${c.id}.clinicId ${loserId} -> ${winnerId}`);
    } else {
      await db
        .update(collaborators)
        .set({ clinicId: winnerId, updatedAt: new Date() })
        .where(eq(collaborators.id, c.id));
      stats.refsRedirected++;
    }
  }

  // 2) clinicIds[] — pre každý záznam, ktorý má loser v poli, nahraď ho winnerom (a dedupni)
  const arrays = await db
    .select({ id: collaborators.id, clinicIds: collaborators.clinicIds })
    .from(collaborators)
    .where(sql`${loserId} = ANY(${collaborators.clinicIds})`);
  for (const c of arrays) {
    const next = Array.from(
      new Set((c.clinicIds || []).map((x) => (x === loserId ? winnerId : x))),
    );
    if (DRY_RUN) {
      console.log(`    [DRY] collaborator ${c.id}.clinicIds [${loserId}] -> [${winnerId}] (dedup)`);
    } else {
      await db
        .update(collaborators)
        .set({ clinicIds: next, updatedAt: new Date() })
        .where(eq(collaborators.id, c.id));
      stats.refsRedirected++;
    }
  }
}

async function redirectContactAssignments(loserId: string, winnerId: string) {
  // contact_assignments rows pre loser-clinic
  const losers = await db
    .select()
    .from(contactAssignments)
    .where(
      and(
        eq(contactAssignments.entityType, "clinic"),
        eq(contactAssignments.entityId, loserId),
      ),
    );

  if (losers.length === 0) return;

  // existujúce (personId) priradenia na winner kliniku — zabraňme duplicitám
  const winnerExisting = await db
    .select({ personId: contactAssignments.personId })
    .from(contactAssignments)
    .where(
      and(
        eq(contactAssignments.entityType, "clinic"),
        eq(contactAssignments.entityId, winnerId),
      ),
    );
  const winnerPersonIds = new Set(winnerExisting.map((r) => r.personId));

  for (const row of losers) {
    if (winnerPersonIds.has(row.personId)) {
      // už existuje rovnaké priradenie na winnera — len zmaž loser-row
      if (DRY_RUN) {
        console.log(`    [DRY] delete duplicate assignment id=${row.id} (person ${row.personId})`);
      } else {
        await db.delete(contactAssignments).where(eq(contactAssignments.id, row.id));
        stats.refsDeletedDup++;
      }
    } else {
      if (DRY_RUN) {
        console.log(`    [DRY] redirect assignment id=${row.id} clinic ${loserId} -> ${winnerId}`);
      } else {
        await db
          .update(contactAssignments)
          .set({ entityId: winnerId, updatedAt: new Date() })
          .where(eq(contactAssignments.id, row.id));
        stats.refsRedirected++;
      }
      winnerPersonIds.add(row.personId);
    }
  }
}

async function mergeGroup(rows: ClinicRow[]) {
  const winner = pickWinner(rows);
  const losers = rows.filter((r) => r.id !== winner.id);

  console.log(
    `\n# GROUP "${winner.name}" / ${winner.city || "-"} / ${winner.countryCode} ` +
      `(${rows.length} records, winner=${winner.id})`,
  );
  for (const l of losers) {
    console.log(`  loser: ${l.id}  "${l.name}"  ${l.city || "-"}`);
  }

  // 1) doplň chýbajúce polia winnerovi
  const aggregatePatch: Record<string, any> = {};
  for (const l of losers) {
    const p = mergeFieldsPatch({ ...winner, ...aggregatePatch } as ClinicRow, l);
    Object.assign(aggregatePatch, p);
  }
  if (Object.keys(aggregatePatch).length > 0) {
    console.log(`  patch winner with: ${Object.keys(aggregatePatch).join(", ")}`);
    if (!DRY_RUN) {
      await db
        .update(clinics)
        .set({ ...aggregatePatch, updatedAt: new Date() })
        .where(eq(clinics.id, winner.id));
    }
    stats.fieldsCopied += Object.keys(aggregatePatch).length;
  }

  // 2) presmeruj referencie a vymaž losers
  for (const loser of losers) {
    try {
      await redirectSimpleRefs(loser.id, winner.id);
      await redirectCollaborators(loser.id, winner.id);
      await redirectContactAssignments(loser.id, winner.id);

      if (DRY_RUN) {
        console.log(`  [DRY] DELETE clinic ${loser.id}`);
      } else {
        await db.delete(clinics).where(eq(clinics.id, loser.id));
        stats.recordsDeleted++;
      }
      stats.recordsMerged++;
    } catch (err) {
      stats.errors++;
      console.error(`  ! ERROR merging loser ${loser.id}:`, err);
    }
  }

  stats.groupsMerged++;
}

async function run() {
  console.log("================================================================");
  console.log(" merge-clinic-duplicates" + (DRY_RUN ? "  [DRY-RUN MODE]" : ""));
  if (ONLY) console.log(`  filter --only="${ONLY}"`);
  if (MIN_GROUP !== 2) console.log(`  filter --min-group=${MIN_GROUP}`);
  console.log("================================================================");

  const all = await db.select().from(clinics);
  console.log(`Loaded ${all.length} clinics\n`);

  // zoskup podľa kľúča
  const groups = new Map<string, ClinicRow[]>();
  for (const c of all) {
    const k = groupKey(c);
    if (!k.startsWith("|")) {
      const arr = groups.get(k) || [];
      arr.push(c);
      groups.set(k, arr);
    }
  }

  // filtruj duplicity
  const dupGroups: ClinicRow[][] = [];
  for (const [, rows] of groups) {
    if (rows.length < MIN_GROUP) continue;
    if (ONLY) {
      const hit = rows.some((r) => (r.name || "").toLowerCase().includes(ONLY));
      if (!hit) continue;
    }
    dupGroups.push(rows);
  }

  stats.groupsTotal = dupGroups.length;
  console.log(`Found ${dupGroups.length} duplicate group(s).`);

  for (const rows of dupGroups) {
    await mergeGroup(rows);
  }

  console.log("\n================================================================");
  console.log(" SUMMARY" + (DRY_RUN ? "  [DRY-RUN — no changes were written]" : ""));
  console.log("================================================================");
  console.log(`  Duplicate groups found     : ${stats.groupsTotal}`);
  console.log(`  Groups merged              : ${stats.groupsMerged}`);
  console.log(`  Loser records merged in    : ${stats.recordsMerged}`);
  console.log(`  Fields copied to winners   : ${stats.fieldsCopied}`);
  console.log(`  References redirected      : ${stats.refsRedirected}`);
  console.log(`  Duplicate assignments del. : ${stats.refsDeletedDup}`);
  console.log(`  Loser records deleted      : ${stats.recordsDeleted}`);
  console.log(`  Errors                     : ${stats.errors}`);
  console.log("================================================================");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });
