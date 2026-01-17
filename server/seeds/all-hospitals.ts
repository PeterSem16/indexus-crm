import { db } from "../db";
import { hospitals } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { slovakHospitals } from "./slovak-hospitals";
import { czechHospitals } from "./czech-hospitals";
import { hungarianHospitals } from "./hungarian-hospitals";
import { romanianHospitals } from "./romanian-hospitals";
import { italianHospitals } from "./italian-hospitals";
import { germanHospitals } from "./german-hospitals";
import { usaHospitals } from "./usa-hospitals";

interface HospitalSeedData {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  countryCode: string;
  phone: string;
  email: string;
  website: string;
  latitude: string;
  longitude: string;
  category: string;
}

export async function seedAllHospitals(dbInstance = db) {
  console.log("Starting hospital seeding for all countries...");
  
  const allHospitals: HospitalSeedData[] = [
    ...slovakHospitals,
    ...czechHospitals,
    ...hungarianHospitals,
    ...romanianHospitals,
    ...italianHospitals,
    ...germanHospitals,
    ...usaHospitals,
  ];

  console.log(`Total hospitals to seed: ${allHospitals.length}`);
  console.log(`  - Slovakia: ${slovakHospitals.length}`);
  console.log(`  - Czech Republic: ${czechHospitals.length}`);
  console.log(`  - Hungary: ${hungarianHospitals.length}`);
  console.log(`  - Romania: ${romanianHospitals.length}`);
  console.log(`  - Italy: ${italianHospitals.length}`);
  console.log(`  - Germany: ${germanHospitals.length}`);
  console.log(`  - USA: ${usaHospitals.length}`);

  let insertedCount = 0;
  let skippedCount = 0;

  for (const hospital of allHospitals) {
    try {
      const existingHospitals = await dbInstance
        .select()
        .from(hospitals)
        .where(
          and(
            eq(hospitals.name, hospital.name),
            eq(hospitals.countryCode, hospital.countryCode)
          )
        );

      if (existingHospitals.length > 0) {
        skippedCount++;
        continue;
      }

      await dbInstance.insert(hospitals).values({
        name: hospital.name,
        fullName: hospital.name,
        streetNumber: hospital.address,
        city: hospital.city,
        postalCode: hospital.postalCode,
        countryCode: hospital.countryCode,
        phone: hospital.phone,
        email: hospital.email,
        website: hospital.website,
        latitude: hospital.latitude,
        longitude: hospital.longitude,
        category: hospital.category,
        isActive: true,
        autoRecruiting: false,
        svetZdravia: false,
      });

      insertedCount++;
    } catch (error) {
      console.error(`Error inserting hospital ${hospital.name}:`, error);
    }
  }

  console.log(`\nSeeding complete!`);
  console.log(`  - Inserted: ${insertedCount}`);
  console.log(`  - Skipped (already exist): ${skippedCount}`);

  return { 
    inserted: insertedCount, 
    skipped: skippedCount,
    total: allHospitals.length,
    breakdown: {
      SK: slovakHospitals.length,
      CZ: czechHospitals.length,
      HU: hungarianHospitals.length,
      RO: romanianHospitals.length,
      IT: italianHospitals.length,
      DE: germanHospitals.length,
      US: usaHospitals.length
    }
  };
}

export { slovakHospitals, czechHospitals, hungarianHospitals, romanianHospitals, italianHospitals, germanHospitals, usaHospitals };
