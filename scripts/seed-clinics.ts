import XLSX from 'xlsx';
import { db } from '../server/db';
import { clinics } from '../shared/schema';

interface ExcelRow {
  'Lekár': string;
  'Ambulancia': string;
  'Adresa': string;
  'Telefón': string;
  'Email': string;
  'GPS_lat': number;
  'GPS_lng': number;
  'ZZZ_URL': string;
}

function parseAddress(address: string): { address: string; city: string; postalCode: string } {
  const addressParts = address.trim();
  const postalCodeMatch = addressParts.match(/(\d{3}\s?\d{2})/);
  let postalCode = '';
  let city = '';
  let streetAddress = addressParts;

  if (postalCodeMatch) {
    postalCode = postalCodeMatch[1].replace(/\s/g, ' ');
    const afterPostalCode = addressParts.substring(addressParts.indexOf(postalCode) + postalCode.length).trim();
    const cityMatch = afterPostalCode.match(/^([^(]+)/);
    if (cityMatch) {
      city = cityMatch[1].trim();
    }
    streetAddress = addressParts.substring(0, addressParts.indexOf(postalCode)).trim();
  }

  return {
    address: streetAddress || addressParts,
    city: city || '',
    postalCode: postalCode.replace(' ', ' ') || ''
  };
}

async function seedClinics() {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile('attached_assets/zzz_gynekologia_cistene_enriched_1768829144845.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);

  console.log(`Found ${data.length} clinic records to import`);

  const existingClinics = await db.select().from(clinics);
  if (existingClinics.length > 0) {
    console.log(`Warning: There are already ${existingClinics.length} clinics in the database.`);
    console.log('Skipping import to avoid duplicates. Clear the clinics table first if you want to reimport.');
    return;
  }

  console.log('Importing clinics...');
  let successCount = 0;
  let errorCount = 0;

  for (const row of data) {
    try {
      const { address, city, postalCode } = parseAddress(row['Adresa'] || '');
      
      await db.insert(clinics).values({
        name: row['Ambulancia'] || 'Unknown Clinic',
        doctorName: row['Lekár'] || null,
        address: address || null,
        city: city || null,
        postalCode: postalCode || null,
        countryCode: 'SK',
        phone: row['Telefón'] || null,
        email: row['Email'] || null,
        website: row['ZZZ_URL'] || null,
        latitude: row['GPS_lat'] ? String(row['GPS_lat']) : null,
        longitude: row['GPS_lng'] ? String(row['GPS_lng']) : null,
        isActive: true,
        notes: null
      });
      successCount++;
    } catch (error) {
      console.error(`Error importing clinic ${row['Ambulancia']}:`, error);
      errorCount++;
    }
  }

  console.log(`Import complete: ${successCount} clinics imported, ${errorCount} errors`);
}

seedClinics()
  .then(() => {
    console.log('Seed script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed script failed:', error);
    process.exit(1);
  });
