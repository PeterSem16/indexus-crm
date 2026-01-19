import * as fs from 'fs';
import * as path from 'path';
import { db } from '../server/db';
import { clinics } from '../shared/schema';

async function seedClinics() {
  console.log('Reading CSV file...');
  
  const csvPath = path.join(process.cwd(), 'attached_assets', 'clinics_export.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found at:', csvPath);
    process.exit(1);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');
  
  console.log(`Found ${lines.length - 1} clinic records to import`);

  const existingClinics = await db.select().from(clinics);
  if (existingClinics.length > 0) {
    console.log(`Warning: There are already ${existingClinics.length} clinics in the database.`);
    console.log('Skipping import to avoid duplicates. Clear the clinics table first if you want to reimport.');
    return;
  }

  console.log('Importing clinics...');
  let successCount = 0;
  let errorCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      const values = parseCSVLine(line);
      
      if (values.length < 11) continue;
      
      await db.insert(clinics).values({
        name: values[0] || 'Unknown Clinic',
        doctorName: values[1] || null,
        address: values[2] || null,
        city: values[3] || null,
        postalCode: values[4] || null,
        countryCode: values[5] || 'SK',
        phone: values[6] || null,
        email: values[7] || null,
        website: values[8] || null,
        latitude: values[9] || null,
        longitude: values[10] || null,
        isActive: values[11] === 't' || values[11] === 'true',
        notes: values[12] || null
      });
      successCount++;
    } catch (error) {
      console.error(`Error importing line ${i}:`, error);
      errorCount++;
    }
  }

  console.log(`Import complete: ${successCount} clinics imported, ${errorCount} errors`);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
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
