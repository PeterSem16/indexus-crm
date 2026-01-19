import * as fs from 'fs';
import * as path from 'path';
import { db } from '../server/db';
import { clinics } from '../shared/schema';

async function seedHungaryClinics() {
  console.log('Reading Hungary clinics CSV file...');
  
  const csvPath = path.join(process.cwd(), 'attached_assets', 'gyneko_all_HU_1768834032671.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found at:', csvPath);
    process.exit(1);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  
  console.log(`Found ${lines.length - 1} records to process`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      const values = parseCSVLine(line);
      if (values.length < 12) { skippedCount++; continue; }
      
      const [country, name, speciality, healthcare, amenity, address, phone, email, website, openingHours, lat, lon] = values;
      if (!name || name.trim() === '') { skippedCount++; continue; }
      
      const { street, city, postalCode } = parseAddress(address);
      const notesParts: string[] = [];
      if (speciality) notesParts.push(`Speciality: ${speciality}`);
      if (openingHours) notesParts.push(`Hours: ${openingHours}`);
      if (healthcare) notesParts.push(`Type: ${healthcare}`);
      
      await db.insert(clinics).values({
        name: name.trim(),
        doctorName: null,
        address: street || address || null,
        city: city || null,
        postalCode: postalCode || null,
        countryCode: 'HU',
        phone: phone || null,
        email: email || null,
        website: website || null,
        latitude: lat && lat !== '' ? lat : null,
        longitude: lon && lon !== '' ? lon : null,
        isActive: true,
        notes: notesParts.length > 0 ? notesParts.join(' | ') : null
      });
      successCount++;
    } catch (error) {
      console.error(`Error importing line ${i}:`, error);
      errorCount++;
    }
  }

  console.log(`Import complete: ${successCount} clinics imported, ${errorCount} errors, ${skippedCount} skipped`);
}

function parseAddress(address: string): { street: string | null, city: string | null, postalCode: string | null } {
  if (!address || address.trim() === '') return { street: null, city: null, postalCode: null };
  const parts = address.split(',').map(p => p.trim());
  let street: string | null = parts[0] || null;
  let city: string | null = null;
  let postalCode: string | null = null;
  const postalRegex = /\b(\d{4})\b/;
  for (let i = 1; i < parts.length; i++) {
    const match = parts[i].match(postalRegex);
    if (match) {
      postalCode = match[1];
      const cityPart = parts[i].replace(postalRegex, '').trim();
      if (cityPart && !city) city = cityPart;
    } else if (!city && parts[i].length > 0) city = parts[i];
  }
  return { street, city, postalCode };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
    else current += char;
  }
  result.push(current);
  return result;
}

seedHungaryClinics().then(() => { console.log('Hungary clinics seed completed'); process.exit(0); }).catch((e) => { console.error('Failed:', e); process.exit(1); });
