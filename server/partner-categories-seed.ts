import { db } from "./db";
import { partnerCategories } from "@shared/schema";
import { eq } from "drizzle-orm";

const DEFAULT_CATEGORIES = [
  {
    code: "hospital_director", sortOrder: 1, entityScope: "hospital", isDefault: true, isActive: true,
    name: "Riaditeľ nemocnice",
    nameSk: "Riaditeľ nemocnice", nameCs: "Ředitel nemocnice", nameEn: "Hospital Director",
    nameHu: "Kórházigazgató", nameRo: "Director de spital", nameIt: "Direttore dell'ospedale", nameDe: "Krankenhausdirektor",
  },
  {
    code: "department_head", sortOrder: 2, entityScope: "hospital", isDefault: true, isActive: true,
    name: "Vedúci pôrodníckeho oddelenia",
    nameSk: "Vedúci pôrodníckeho oddelenia", nameCs: "Vedoucí porodnického oddělení", nameEn: "Head of Obstetrics Department",
    nameHu: "Szülészeti osztályvezető", nameRo: "Șeful secției de obstetrică", nameIt: "Responsabile del reparto di ostetricia", nameDe: "Leiter der Geburtshilfeabteilung",
  },
  {
    code: "head_nurse", sortOrder: 3, entityScope: "hospital", isDefault: true, isActive: true,
    name: "Hlavná/vrchná sestra pôrodníckeho oddelenia",
    nameSk: "Hlavná/vrchná sestra pôrodníckeho oddelenia", nameCs: "Vrchní sestra porodnického oddělení", nameEn: "Head Nurse of Obstetrics Department",
    nameHu: "Szülészeti osztály vezető nővér", nameRo: "Asistentă șefă a secției de obstetrică", nameIt: "Caposala del reparto di ostetricia", nameDe: "Oberschwester der Geburtshilfeabteilung",
  },
  {
    code: "delivery_midwife", sortOrder: 4, entityScope: "hospital", isDefault: true, isActive: true,
    name: "Pôrodné asistentky/hebamme",
    nameSk: "Pôrodné asistentky/hebamme", nameCs: "Porodní asistentky", nameEn: "Delivery Midwives",
    nameHu: "Szülésznők/bábák", nameRo: "Moașe", nameIt: "Ostetriche", nameDe: "Hebammen",
  },
  {
    code: "department_doctor", sortOrder: 5, entityScope: "hospital", isDefault: true, isActive: true,
    name: "Lekári pôrodníckeho oddelenia",
    nameSk: "Lekári pôrodníckeho oddelenia", nameCs: "Lékaři porodnického oddělení", nameEn: "Obstetrics Department Doctors",
    nameHu: "Szülészeti osztály orvosai", nameRo: "Medici secția de obstetrică", nameIt: "Medici del reparto di ostetricia", nameDe: "Ärzte der Geburtshilfeabteilung",
  },
  {
    code: "department_nurse", sortOrder: 6, entityScope: "hospital", isDefault: true, isActive: true,
    name: "Sestry pôrodníckeho oddelenia",
    nameSk: "Sestry pôrodníckeho oddelenia", nameCs: "Sestry porodnického oddělení", nameEn: "Obstetrics Department Nurses",
    nameHu: "Szülészeti osztály nővérei", nameRo: "Asistente secția de obstetrică", nameIt: "Infermiere del reparto di ostetricia", nameDe: "Schwestern der Geburtshilfeabteilung",
  },
  {
    code: "neonatology_head", sortOrder: 7, entityScope: "hospital", isDefault: true, isActive: true,
    name: "Primár neonatologického oddelenia",
    nameSk: "Primár neonatologického oddelenia", nameCs: "Primář neonatologického oddělení", nameEn: "Head of Neonatology Department",
    nameHu: "Neonatológiai osztályvezető", nameRo: "Șeful secției de neonatologie", nameIt: "Responsabile del reparto di neonatologia", nameDe: "Leiter der Neonatologieabteilung",
  },
  {
    code: "neonatology_doctor", sortOrder: 8, entityScope: "hospital", isDefault: true, isActive: true,
    name: "Lekári neonatologického oddelenia",
    nameSk: "Lekári neonatologického oddelenia", nameCs: "Lékaři neonatologického oddělení", nameEn: "Neonatology Department Doctors",
    nameHu: "Neonatológiai osztály orvosai", nameRo: "Medici secția de neonatologie", nameIt: "Medici del reparto di neonatologia", nameDe: "Ärzte der Neonatologieabteilung",
  },
  {
    code: "neonatology_nurse", sortOrder: 9, entityScope: "hospital", isDefault: true, isActive: true,
    name: "Sestry neonatologického oddelenia",
    nameSk: "Sestry neonatologického oddelenia", nameCs: "Sestry neonatologického oddělení", nameEn: "Neonatology Department Nurses",
    nameHu: "Neonatológiai osztály nővérei", nameRo: "Asistente secția de neonatologie", nameIt: "Infermiere del reparto di neonatologia", nameDe: "Schwestern der Neonatologieabteilung",
  },
  {
    code: "gynecologist_private", sortOrder: 10, entityScope: "clinic", isDefault: true, isActive: true,
    name: "Súkromný gynekológ",
    nameSk: "Súkromný gynekológ", nameCs: "Soukromý gynekolog", nameEn: "Private Gynecologist",
    nameHu: "Magán nőgyógyász", nameRo: "Ginecolog privat", nameIt: "Ginecologo privato", nameDe: "Privater Gynäkologe",
  },
  {
    code: "pediatrician_private", sortOrder: 11, entityScope: "clinic", isDefault: true, isActive: true,
    name: "Súkromný pediater",
    nameSk: "Súkromný pediater", nameCs: "Soukromý pediatr", nameEn: "Private Pediatrician",
    nameHu: "Magán gyermekorvos", nameRo: "Pediatru privat", nameIt: "Pediatra privato", nameDe: "Privater Kinderarzt",
  },
  {
    code: "prenatal_instructor", sortOrder: 12, entityScope: "independent", isDefault: true, isActive: true,
    name: "Lektorka predpôrodnej prípravy",
    nameSk: "Lektorka predpôrodnej prípravy", nameCs: "Lektorka předporodní přípravy", nameEn: "Prenatal Preparation Instructor",
    nameHu: "Szülésfelkészítő oktató", nameRo: "Instructor pregătire prenatală", nameIt: "Istruttrice di preparazione prenatale", nameDe: "Geburtsvorbereitungsleiterin",
  },
  {
    code: "doula", sortOrder: 13, entityScope: "independent", isDefault: true, isActive: true,
    name: "Dula",
    nameSk: "Dula", nameCs: "Dula", nameEn: "Doula",
    nameHu: "Dúla", nameRo: "Doula", nameIt: "Doula", nameDe: "Doula",
  },
  {
    code: "lactation_consultant", sortOrder: 14, entityScope: "independent", isDefault: true, isActive: true,
    name: "Laktačná poradkyňa",
    nameSk: "Laktačná poradkyňa", nameCs: "Laktační poradkyně", nameEn: "Lactation Consultant",
    nameHu: "Laktációs tanácsadó", nameRo: "Consultant în lactație", nameIt: "Consulente per l'allattamento", nameDe: "Stillberaterin",
  },
];

export async function seedPartnerCategories() {
  console.log("[PartnerCategories] Starting auto-seed...");
  try {
    let seeded = 0;
    let updated = 0;
    for (const cat of DEFAULT_CATEGORIES) {
      const existing = await db.select().from(partnerCategories).where(eq(partnerCategories.code, cat.code));
      if (existing.length === 0) {
        await db.insert(partnerCategories).values(cat);
        seeded++;
      } else {
        await db.update(partnerCategories)
          .set({ nameSk: cat.nameSk, nameCs: cat.nameCs, nameEn: cat.nameEn, nameHu: cat.nameHu, nameRo: cat.nameRo, nameIt: cat.nameIt, nameDe: cat.nameDe, isDefault: true })
          .where(eq(partnerCategories.code, cat.code));
        updated++;
      }
    }
    if (seeded > 0) {
      console.log(`[PartnerCategories] Seeded ${seeded} new categories, updated ${updated} existing`);
    } else {
      console.log(`[PartnerCategories] All ${DEFAULT_CATEGORIES.length} default categories present`);
    }
  } catch (err: any) {
    console.error("[PartnerCategories] Seed error:", err.message);
  }
}