import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

const pdfPath = process.argv[2];
if (!pdfPath) {
  process.stderr.write('Usage: node pdf-text-extractor.mjs <pdf-path>\n');
  process.exit(1);
}

const origWarn = console.warn;
const origError = console.error;
console.warn = (...args) => process.stderr.write(args.join(' ') + '\n');
console.error = (...args) => process.stderr.write(args.join(' ') + '\n');

try {
  const buf = fs.readFileSync(pdfPath);
  const uint8 = new Uint8Array(buf);
  const doc = await getDocument({ data: uint8, verbosity: VerbosityLevel.ERRORS }).promise;
  
  const result = [];
  
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const pageText = tc.items
      .filter(item => item.str && item.str.trim())
      .map(item => item.str)
      .join(' ');
    if (pageText.trim()) {
      result.push(pageText);
    }
  }
  
  console.log(JSON.stringify({ text: result.join('\n') }));
} catch (error) {
  console.error(JSON.stringify({ error: error.message }));
  process.exit(1);
}
