/**
 * normalize-junk-clinics.ts
 *
 * Vyčistí "junk" záznamy v `clinics`, kde názov alebo mesto je iba "???"
 * (rôzny počet otáznikov) alebo úplne prázdne. Zachová všetky napojenia
 * (personnel, collaborators, kampane …) — žiadny záznam s väzbou nezmaže.
 *
 * Stratégia (v poradí):
 *   1) Ak je v poriadku NÁZOV ale rozbité MESTO -> doplň mesto z osoby/work-addr
 *      (rovnako pre opačný prípad).
 *   2) Ak je rozbitý NÁZOV a klinika má napojenú osobu (personnel /
 *      collaborator.clinicId / clinicIds), pokús sa zostrojiť meno:
 *        - z workplace_name osoby
 *        - alebo "Pracovisko MUDr. Meno Priezvisko"
 *      Mesto sa doplní z collaborator_addresses (addressType='work') ak chýba.
 *   3) Ak klinika nemá ŽIADNU väzbu (orphan) -> bezpečne zmaže.
 *   4) Inak premenuje na "Neznáma ambulancia" a do `notes` uloží pôvodné hodnoty
 *      pre audit.
 *
 * Použitie:
 *   npx tsx scripts/normalize-junk-clinics.ts --dry-run
 *   npx tsx scripts/normalize-junk-clinics.ts                   # ostro
 *   npx tsx scripts/normalize-junk-clinics.ts --no-delete       # nemaž ani orphany
 *   npx tsx scripts/normalize-junk-clinics.ts --label="Neznáma ambulancia"
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../server/db";
import {
  clinics,
  collaborators,
  collaboratorAddresses,
  contactAssignments,
  clinicReferrals,
  clinicEvents,
  hospitalNetworkMembers,
  campaignContacts,
} from "../shared/schema";

const DRY_RUN = process.argv.includes("--dry-run");
const NO_DELETE = process.argv.includes("--no-delete");
const LABEL_ARG = process.argv.find((a) => a.startsWith("--label="));
const LABEL = LABEL_ARG ? LABEL_ARG.split("=")[1] : "Neznáma ambulancia";

type ClinicRow = typeof clinics.$inferSelect;

function isJunk(s: string | null | undefined) {
  if (s === null || s === undefined) return true;
  const t = s.trim();
  if (t === "") return true;
  return /^[?]+$/.test(t);
}

const stats = {
  scanned: 0,
  junkFound: 0,
  fixedFromPerson: 0,
  fixedCityOnly: 0,
  deletedOrphans: 0,
  labeledUnknown: 0,
  errors: 0,
};

async function getLinkedPersons(clinicId: string) {
  // 1) cez contact_assignments
  const aRows = await db
    .select({ personId: contactAssignments.personId })
    .from(contactAssignments)
    .where(
      and(
        eq(contactAssignments.entityType, "clinic"),
        eq(contactAssignments.entityId, clinicId),
      ),
    );

  // 2) cez collaborators.clinicId / clinicIds
  const primary = await db
    .select({ id: collaborators.id })
    .from(collaborators)
    .where(eq(collaborators.clinicId, clinicId));
  const arr = await db
    .select({ id: collaborators.id })
    .from(collaborators)
    .where(sql`${clinicId} = ANY(${collaborators.clinicIds})`);

  const ids = new Set<string>();
  for (const r of aRows) ids.add(r.personId);
  for (const r of primary) ids.add(r.id);
  for (const r of arr) ids.add(r.id);
  return Array.from(ids);
}

async function hasAnyOtherRefs(clinicId: string) {
  const tables: { name: string; q: () => Promise<{ id: string }[]> }[] = [
    {
      name: "clinic_referrals.clinicId",
      q: () =>
        db
          .select({ id: clinicReferrals.id })
          .from(clinicReferrals)
          .where(eq(clinicReferrals.clinicId, clinicId))
          .limit(1) as any,
    },
    {
      name: "clinic_referrals.referringClinicId",
      q: () =>
        db
          .select({ id: clinicReferrals.id })
          .from(clinicReferrals)
          .where(eq(clinicReferrals.referringClinicId, clinicId))
          .limit(1) as any,
    },
    {
      name: "clinic_events",
      q: () =>
        db
          .select({ id: clinicEvents.id })
          .from(clinicEvents)
          .where(eq(clinicEvents.clinicId, clinicId))
          .limit(1) as any,
    },
    {
      name: "hospital_network_members",
      q: () =>
        db
          .select({ id: hospitalNetworkMembers.id })
          .from(hospitalNetworkMembers)
          .where(eq(hospitalNetworkMembers.clinicId, clinicId))
          .limit(1) as any,
    },
    {
      name: "campaign_contacts",
      q: () =>
        db
          .select({ id: campaignContacts.id })
          .from(campaignContacts)
          .where(eq(campaignContacts.clinicId, clinicId))
          .limit(1) as any,
    },
  ];
  for (const t of tables) {
    const rows = await t.q();
    if (rows.length > 0) return true;
  }
  return false;
}

function buildPersonName(p: typeof collaborators.$inferSelect) {
  const parts = [p.titleBefore, p.firstName, p.lastName, p.titleAfter]
    .map((x) => (x || "").trim())
    .filter(Boolean);
  return parts.join(" ");
}

async function tryFixFromPerson(
  c: ClinicRow,
  personIds: string[],
): Promise<{ name?: string; city?: string }> {
  if (personIds.length === 0) return {};
  const persons = await db
    .select()
    .from(collaborators)
    .where(inArray(collaborators.id, personIds));

  let name: string | undefined;
  let city: string | undefined;

  // skús workplaceName z osoby
  for (const p of persons) {
    if (p.workplaceName && p.workplaceName.trim() && !isJunk(p.workplaceName)) {
      name = p.workplaceName.trim();
      break;
    }
  }
  // ak žiadny workplaceName, zostroj "Pracovisko + meno"
  if (!name) {
    for (const p of persons) {
      const fullName = buildPersonName(p);
      if (fullName) {
        name = `Pracovisko ${fullName}`;
        break;
      }
    }
  }

  // city: pozri work-adresy osôb
  if (isJunk(c.city)) {
    const addrs = await db
      .select({
        city: collaboratorAddresses.city,
        country: collaboratorAddresses.countryCode,
      })
      .from(collaboratorAddresses)
      .where(
        and(
          inArray(collaboratorAddresses.collaboratorId, personIds),
          eq(collaboratorAddresses.addressType, "work"),
        ),
      );
    for (const a of addrs) {
      if (a.city && !isJunk(a.city)) {
        city = a.city.trim();
        break;
      }
    }
  }

  return { name, city };
}

async function processClinic(c: ClinicRow) {
  const nameJunk = isJunk(c.name);
  const cityJunk = isJunk(c.city);
  if (!nameJunk && !cityJunk) return;
  stats.junkFound++;

  console.log(
    `\n# clinic ${c.id}  name="${c.name ?? ""}"  city="${c.city ?? ""}"  country=${c.countryCode}`,
  );

  // Mesto rozbité, názov OK -> doplň iba mesto
  if (!nameJunk && cityJunk) {
    const personIds = await getLinkedPersons(c.id);
    const { city } = await tryFixFromPerson(c, personIds);
    if (city) {
      console.log(`  -> CITY ONLY fix: city="${city}"`);
      if (!DRY_RUN) {
        await db
          .update(clinics)
          .set({ city, updatedAt: new Date() })
          .where(eq(clinics.id, c.id));
      }
      stats.fixedCityOnly++;
    } else {
      console.log(`  -> CITY ONLY junk, no source found, leaving as-is`);
    }
    return;
  }

  // Názov rozbitý -> skús dorobiť z osôb
  const personIds = await getLinkedPersons(c.id);

  if (personIds.length === 0) {
    // žiadne personnel/collaborator napojenie — preveriť ostatné odkazy
    const otherRefs = await hasAnyOtherRefs(c.id);
    if (!otherRefs && !NO_DELETE) {
      console.log(`  -> ORPHAN (no refs anywhere): DELETE`);
      if (!DRY_RUN) {
        await db.delete(clinics).where(eq(clinics.id, c.id));
      }
      stats.deletedOrphans++;
      return;
    }
    if (!otherRefs && NO_DELETE) {
      console.log(`  -> ORPHAN, --no-delete -> label as "${LABEL}"`);
    } else {
      console.log(`  -> no persons but other refs exist -> label as "${LABEL}"`);
    }
    const noteParts = [
      c.notes || null,
      `[normalize] pôvodné: name="${c.name ?? ""}", city="${c.city ?? ""}" @ ${new Date().toISOString().slice(0, 10)}`,
    ].filter(Boolean) as string[];
    if (!DRY_RUN) {
      await db
        .update(clinics)
        .set({
          name: nameJunk ? LABEL : c.name!,
          notes: noteParts.join(" | "),
          updatedAt: new Date(),
        } as any)
        .where(eq(clinics.id, c.id));
    }
    stats.labeledUnknown++;
    return;
  }

  // má aspoň jednu osobu — skús odvodiť meno
  const fix = await tryFixFromPerson(c, personIds);

  if (fix.name) {
    const patch: any = { name: fix.name, updatedAt: new Date() };
    if (cityJunk && fix.city) patch.city = fix.city;
    const noteParts = [
      c.notes || null,
      `[normalize] pôvodné: name="${c.name ?? ""}", city="${c.city ?? ""}" @ ${new Date().toISOString().slice(0, 10)}`,
    ].filter(Boolean) as string[];
    patch.notes = noteParts.join(" | ");
    console.log(
      `  -> FIX FROM PERSON: name="${fix.name}"` +
        (patch.city ? `, city="${patch.city}"` : ""),
    );
    if (!DRY_RUN) {
      await db.update(clinics).set(patch).where(eq(clinics.id, c.id));
    }
    stats.fixedFromPerson++;
    return;
  }

  // má osoby, no nedalo sa dorobiť meno
  console.log(`  -> has persons but cannot derive name -> label as "${LABEL}"`);
  const noteParts = [
    c.notes || null,
    `[normalize] pôvodné: name="${c.name ?? ""}", city="${c.city ?? ""}" @ ${new Date().toISOString().slice(0, 10)}`,
  ].filter(Boolean) as string[];
  if (!DRY_RUN) {
    await db
      .update(clinics)
      .set({ name: LABEL, notes: noteParts.join(" | "), updatedAt: new Date() } as any)
      .where(eq(clinics.id, c.id));
  }
  stats.labeledUnknown++;
}

async function run() {
  console.log("================================================================");
  console.log(" normalize-junk-clinics" + (DRY_RUN ? "  [DRY-RUN MODE]" : ""));
  if (NO_DELETE) console.log("  --no-delete (orphany sa premenujú namiesto mazania)");
  console.log(`  fallback label = "${LABEL}"`);
  console.log("================================================================");

  const all = await db.select().from(clinics);
  console.log(`Loaded ${all.length} clinics.\n`);

  for (const c of all) {
    stats.scanned++;
    try {
      await processClinic(c);
    } catch (err) {
      stats.errors++;
      console.error(`  ! ERROR for clinic ${c.id}:`, err);
    }
  }

  console.log("\n================================================================");
  console.log(" SUMMARY" + (DRY_RUN ? "  [DRY-RUN — no changes were written]" : ""));
  console.log("================================================================");
  console.log(`  Clinics scanned          : ${stats.scanned}`);
  console.log(`  Junk records found       : ${stats.junkFound}`);
  console.log(`  Fixed (name from person) : ${stats.fixedFromPerson}`);
  console.log(`  Fixed (city only)        : ${stats.fixedCityOnly}`);
  console.log(`  Orphans deleted          : ${stats.deletedOrphans}`);
  console.log(`  Labeled "${LABEL}" : ${stats.labeledUnknown}`);
  console.log(`  Errors                   : ${stats.errors}`);
  console.log("================================================================");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });
