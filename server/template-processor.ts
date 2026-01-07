import { PDFDocument } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface TemplateField {
  name: string;
  type: "text" | "checkbox" | "dropdown" | "signature";
  value?: string;
  required?: boolean;
}

export interface PlaceholderMapping {
  templateField: string;
  crmField: string;
  defaultValue?: string;
}

export async function extractPdfFormFields(pdfPath: string): Promise<TemplateField[]> {
  try {
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    const extractedFields: TemplateField[] = [];

    for (const field of fields) {
      const fieldName = field.getName();
      const fieldType = field.constructor.name;

      let type: TemplateField["type"] = "text";
      if (fieldType.includes("CheckBox")) {
        type = "checkbox";
      } else if (fieldType.includes("Dropdown") || fieldType.includes("OptionList")) {
        type = "dropdown";
      } else if (fieldType.includes("Signature")) {
        type = "signature";
      }

      extractedFields.push({
        name: fieldName,
        type,
        required: false,
      });
    }

    console.log(`[PDF Form] Extracted ${extractedFields.length} fields from ${pdfPath}`);
    return extractedFields;
  } catch (error) {
    console.error("[PDF Form] Error extracting fields:", error);
    throw new Error(`Failed to extract PDF form fields: ${error}`);
  }
}

export async function fillPdfForm(
  pdfPath: string,
  data: Record<string, string | boolean>,
  outputPath: string,
  flatten: boolean = true
): Promise<string> {
  try {
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    for (const [fieldName, value] of Object.entries(data)) {
      try {
        const field = form.getField(fieldName);
        const fieldType = field.constructor.name;

        if (fieldType.includes("TextField")) {
          const textField = form.getTextField(fieldName);
          textField.setText(String(value));
        } else if (fieldType.includes("CheckBox")) {
          const checkbox = form.getCheckBox(fieldName);
          if (value === true || value === "true" || value === "yes") {
            checkbox.check();
          } else {
            checkbox.uncheck();
          }
        } else if (fieldType.includes("Dropdown")) {
          const dropdown = form.getDropdown(fieldName);
          dropdown.select(String(value));
        }
      } catch (fieldError) {
        console.warn(`[PDF Form] Could not fill field "${fieldName}":`, fieldError);
      }
    }

    if (flatten) {
      form.flatten();
    }

    const filledPdfBytes = await pdfDoc.save();
    
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, filledPdfBytes);
    console.log(`[PDF Form] Filled PDF saved to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("[PDF Form] Error filling form:", error);
    throw new Error(`Failed to fill PDF form: ${error}`);
  }
}

export function extractHtmlPlaceholders(htmlContent: string): TemplateField[] {
  try {
    const placeholders = new Set<string>();
    
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    let match;
    while ((match = placeholderRegex.exec(htmlContent)) !== null) {
      const placeholder = match[1].trim();
      if (!placeholder.startsWith("#") && !placeholder.startsWith("/") && !placeholder.startsWith("^")) {
        placeholders.add(placeholder);
      }
    }
    
    const fillFieldRegex = /class="[^"]*fill-field[^"]*"[^>]*data-field="([^"]+)"/g;
    while ((match = fillFieldRegex.exec(htmlContent)) !== null) {
      placeholders.add(match[1]);
    }
    
    const labelRegex = /<(?:label|p|span)[^>]*>([^<]+):\s*<span[^>]*class="[^"]*fill-field[^"]*"[^>]*>/gi;
    while ((match = labelRegex.exec(htmlContent)) !== null) {
      const fieldName = match[1].trim().toLowerCase()
        .replace(/\s+/g, '_')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (fieldName && fieldName.length > 0 && fieldName.length < 50) {
        placeholders.add(fieldName);
      }
    }
    
    const extractedFields: TemplateField[] = Array.from(placeholders).map((name) => ({
      name,
      type: "text" as const,
      required: false,
    }));

    console.log(`[HTML] Extracted ${extractedFields.length} placeholders from HTML content`);
    return extractedFields;
  } catch (error) {
    console.error("[HTML] Error extracting placeholders:", error);
    return [];
  }
}

export async function extractPdfTextPlaceholders(pdfPath: string): Promise<TemplateField[]> {
  try {
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const form = pdfDoc.getForm();
    const formFields = form.getFields();
    
    if (formFields.length > 0) {
      return formFields.map(field => ({
        name: field.getName(),
        type: "text" as const,
        required: false,
      }));
    }
    
    console.log(`[PDF Text] No AcroForm fields found. PDF requires HTML-based template editing.`);
    return [];
  } catch (error) {
    console.error("[PDF Text] Error:", error);
    return [];
  }
}

export async function extractDocxPlaceholders(docxPath: string): Promise<TemplateField[]> {
  try {
    const content = fs.readFileSync(docxPath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" },
    });

    const text = doc.getFullText();
    
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const placeholders = new Set<string>();
    let match;
    
    while ((match = placeholderRegex.exec(text)) !== null) {
      const placeholder = match[1].trim();
      if (!placeholder.startsWith("#") && !placeholder.startsWith("/") && !placeholder.startsWith("^")) {
        placeholders.add(placeholder);
      }
    }

    const extractedFields: TemplateField[] = Array.from(placeholders).map((name) => ({
      name,
      type: "text" as const,
      required: false,
    }));

    console.log(`[DOCX] Extracted ${extractedFields.length} placeholders from ${docxPath}`);
    return extractedFields;
  } catch (error) {
    console.error("[DOCX] Error extracting placeholders:", error);
    throw new Error(`Failed to extract DOCX placeholders: ${error}`);
  }
}

export async function fillDocxTemplate(
  docxPath: string,
  data: Record<string, string | number | boolean>,
  outputPath: string
): Promise<string> {
  try {
    const content = fs.readFileSync(docxPath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" },
    });

    doc.render(data);

    const buf = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, buf);
    console.log(`[DOCX] Filled DOCX saved to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("[DOCX] Error filling template:", error);
    throw new Error(`Failed to fill DOCX template: ${error}`);
  }
}

export async function convertDocxToPdf(docxPath: string, outputDir: string): Promise<string> {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Check if soffice is available
    let sofficeCmd = "soffice";
    try {
      await execAsync("which soffice");
    } catch {
      // Try alternative paths
      const altPaths = [
        "/nix/store/j261ykwr6mxvai0v22sa9y6w421p30ay-libreoffice-7.6.7.2-wrapped/bin/soffice",
        "libreoffice",
      ];
      let found = false;
      for (const altPath of altPaths) {
        try {
          await execAsync(`${altPath} --version`);
          sofficeCmd = altPath;
          found = true;
          break;
        } catch {
          continue;
        }
      }
      if (!found) {
        throw new Error("LibreOffice not found. DOCX to PDF conversion requires LibreOffice.");
      }
    }

    const command = `${sofficeCmd} --headless --convert-to pdf --outdir "${outputDir}" "${docxPath}"`;
    console.log(`[LibreOffice] Converting DOCX to PDF: ${command}`);
    
    await execAsync(command, { timeout: 120000 });

    const docxBasename = path.basename(docxPath, path.extname(docxPath));
    const pdfPath = path.join(outputDir, `${docxBasename}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF output file not found: ${pdfPath}. LibreOffice conversion may have failed.`);
    }

    console.log(`[LibreOffice] Converted to PDF: ${pdfPath}`);
    return pdfPath;
  } catch (error: any) {
    console.error("[LibreOffice] Error converting to PDF:", error);
    if (error.message?.includes("not found")) {
      throw new Error("LibreOffice nie je nainštalované. Konverzia DOCX do PDF vyžaduje LibreOffice.");
    }
    throw new Error(`Nepodarilo sa konvertovať DOCX do PDF: ${error.message}`);
  }
}

export async function generateContractFromTemplate(
  templateType: "pdf_form" | "docx",
  sourcePath: string,
  data: Record<string, string | number | boolean>,
  outputDir: string,
  contractId: string
): Promise<{ pdfPath: string; intermediateDocxPath?: string }> {
  const timestamp = Date.now();
  
  if (templateType === "pdf_form") {
    const outputPath = path.join(outputDir, `contract_${contractId}_${timestamp}.pdf`);
    const pdfPath = await fillPdfForm(sourcePath, data as Record<string, string | boolean>, outputPath, true);
    return { pdfPath };
  } else if (templateType === "docx") {
    const docxOutputPath = path.join(outputDir, `contract_${contractId}_${timestamp}.docx`);
    await fillDocxTemplate(sourcePath, data, docxOutputPath);
    const pdfPath = await convertDocxToPdf(docxOutputPath, outputDir);
    return { pdfPath, intermediateDocxPath: docxOutputPath };
  } else {
    throw new Error(`Unknown template type: ${templateType}`);
  }
}

export const CRM_DATA_FIELDS = [
  { id: "customer.firstName", label: "Meno zákazníka", category: "customer" },
  { id: "customer.lastName", label: "Priezvisko zákazníka", category: "customer" },
  { id: "customer.fullName", label: "Celé meno zákazníka", category: "customer" },
  { id: "customer.email", label: "Email zákazníka", category: "customer" },
  { id: "customer.phone", label: "Telefón zákazníka", category: "customer" },
  { id: "customer.birthDate", label: "Dátum narodenia", category: "customer" },
  { id: "customer.personalId", label: "Rodné číslo", category: "customer" },
  { id: "customer.address.street", label: "Ulica", category: "address" },
  { id: "customer.address.city", label: "Mesto", category: "address" },
  { id: "customer.address.postalCode", label: "PSČ", category: "address" },
  { id: "customer.address.country", label: "Krajina", category: "address" },
  { id: "customer.address.fullAddress", label: "Celá adresa", category: "address" },
  { id: "contract.number", label: "Číslo zmluvy", category: "contract" },
  { id: "contract.date", label: "Dátum zmluvy", category: "contract" },
  { id: "contract.validFrom", label: "Platnosť od", category: "contract" },
  { id: "contract.validTo", label: "Platnosť do", category: "contract" },
  { id: "contract.totalAmount", label: "Celková suma", category: "contract" },
  { id: "company.name", label: "Názov spoločnosti", category: "company" },
  { id: "company.ico", label: "IČO", category: "company" },
  { id: "company.dic", label: "DIČ", category: "company" },
  { id: "company.address", label: "Adresa spoločnosti", category: "company" },
  { id: "today", label: "Dnešný dátum", category: "system" },
];

export const SLOVAK_FIELD_PATTERNS: Array<{
  patterns: RegExp[];
  placeholder: string;
  label: string;
}> = [
  {
    patterns: [
      /klientka\s*[:\-]?\s*(.+)/i,
      /rodička\s*[:\-]?\s*(.+)/i,
      /matka\s+dieťaťa\s*[:\-]?\s*(.+)/i,
      /meno\s+a\s+priezvisko\s*[:\-]?\s*(.+)/i,
      /zákazník\s*[:\-]?\s*(.+)/i,
      /objednávateľ\s*[:\-]?\s*(.+)/i,
    ],
    placeholder: "customer.fullName",
    label: "Meno zákazníka/klientky"
  },
  {
    patterns: [
      /otec\s+dieťaťa\s*[:\-]?\s*(.+)/i,
      /otec\s*[:\-]?\s*(.+)/i,
      /zákonný\s+zástupca\s*[\-–]\s*otec\s*[:\-]?\s*(.+)/i,
    ],
    placeholder: "father.fullName",
    label: "Meno otca"
  },
  {
    patterns: [
      /matka\s*[:\-]?\s*(.+)/i,
    ],
    placeholder: "mother.fullName",
    label: "Meno matky"
  },
  {
    patterns: [
      /trvalé\s+bydlisko\s*[:\-]?\s*(.+)/i,
      /trvalý\s+pobyt\s*[:\-]?\s*(.+)/i,
      /bydlisko\s*[:\-]?\s*(.+)/i,
      /adresa\s+trvalého\s+pobytu\s*[:\-]?\s*(.+)/i,
      /adresa\s*[:\-]?\s*(.+)/i,
    ],
    placeholder: "customer.permanentAddress",
    label: "Trvalé bydlisko"
  },
  {
    patterns: [
      /korešpondenčná\s+adresa\s*[:\-]?\s*(.+)/i,
      /doručovacia\s+adresa\s*[:\-]?\s*(.+)/i,
    ],
    placeholder: "customer.correspondenceAddress",
    label: "Korešpondenčná adresa"
  },
  {
    patterns: [
      /dátum\s+narodenia\s*[:\-]?\s*(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})/i,
      /narodená?\s*[:\-]?\s*(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})/i,
      /nar\.\s*(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})/i,
    ],
    placeholder: "customer.birthDate",
    label: "Dátum narodenia"
  },
  {
    patterns: [
      /rodné\s+číslo\s*[:\-]?\s*(\d{6}\/?(\d{3,4})?)/i,
      /r\.č\.\s*[:\-]?\s*(\d{6}\/?(\d{3,4})?)/i,
      /RČ\s*[:\-]?\s*(\d{6}\/?(\d{3,4})?)/i,
    ],
    placeholder: "customer.personalId",
    label: "Rodné číslo"
  },
  {
    patterns: [
      /telefón\s*[:\-]?\s*(\+?\d[\d\s\-]+)/i,
      /tel\.\s*[:\-]?\s*(\+?\d[\d\s\-]+)/i,
      /mobil\s*[:\-]?\s*(\+?\d[\d\s\-]+)/i,
    ],
    placeholder: "customer.phone",
    label: "Telefón"
  },
  {
    patterns: [
      /e-?mail\s*[:\-]?\s*([\w\.\-]+@[\w\.\-]+)/i,
    ],
    placeholder: "customer.email",
    label: "Email"
  },
  {
    patterns: [
      /IBAN\s*[:\-]?\s*([A-Z]{2}\d{2}[\s\d]+)/i,
      /číslo\s+účtu\s*[:\-]?\s*(.+)/i,
      /bankový\s+účet\s*[:\-]?\s*(.+)/i,
    ],
    placeholder: "customer.IBAN",
    label: "IBAN"
  },
  {
    patterns: [
      /číslo\s+zmluvy\s*[:\-]?\s*(.+)/i,
      /zmluva\s+č\.\s*[:\-]?\s*(.+)/i,
      /č\.\s*zmluvy\s*[:\-]?\s*(.+)/i,
    ],
    placeholder: "contract.number",
    label: "Číslo zmluvy"
  },
  {
    patterns: [
      /dátum\s+uzavretia\s*[:\-]?\s*(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})/i,
      /dňa\s*[:\-]?\s*(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})/i,
      /v\s+\w+\s+dňa\s+(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})/i,
    ],
    placeholder: "contract.date",
    label: "Dátum zmluvy"
  },
  {
    patterns: [
      /IČO\s*[:\-]?\s*(\d[\d\s]+)/i,
      /identifikačné\s+číslo\s*[:\-]?\s*(\d[\d\s]+)/i,
    ],
    placeholder: "company.identificationNumber",
    label: "IČO spoločnosti"
  },
  {
    patterns: [
      /DIČ\s*[:\-]?\s*(\d[\d\s]+)/i,
    ],
    placeholder: "company.taxIdentificationNumber",
    label: "DIČ spoločnosti"
  },
  {
    patterns: [
      /IČ\s*DPH\s*[:\-]?\s*([A-Z]{2}\d+)/i,
    ],
    placeholder: "company.vatNumber",
    label: "IČ DPH"
  },
];

export interface DetectedField {
  original: string;
  placeholder: string;
  label: string;
  context: string;
  confidence: number;
}

export function detectFieldsWithPatterns(text: string): DetectedField[] {
  const detectedFields: DetectedField[] = [];
  const seenOriginals = new Set<string>();
  
  const lines = text.split(/\n/);
  const totalLines = lines.length;
  
  const HEADER_SIZE = 40;
  const SIGNATURE_SIZE = 50;
  
  const fillFieldRegex = /[\.]{3,}|[_]{3,}|[\…]{2,}|:\s*$/;
  
  const isInAllowedSection = (lineIndex: number, line: string): boolean => {
    if (lineIndex < HEADER_SIZE) return true;
    if (lineIndex >= totalLines - SIGNATURE_SIZE) return true;
    if (fillFieldRegex.test(line)) return true;
    
    const prevLine = lineIndex > 0 ? lines[lineIndex - 1] : "";
    const nextLine = lineIndex < totalLines - 1 ? lines[lineIndex + 1] : "";
    if (fillFieldRegex.test(prevLine) || fillFieldRegex.test(nextLine)) return true;
    
    return false;
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (!isInAllowedSection(i, line)) {
      continue;
    }
    
    const context = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join(" ");
    
    for (const fieldDef of SLOVAK_FIELD_PATTERNS) {
      for (const pattern of fieldDef.patterns) {
        const match = pattern.exec(line);
        if (match && match[1]) {
          const original = match[1].trim();
          
          if (original.length < 2 || original.length > 200) continue;
          if (seenOriginals.has(original.toLowerCase())) continue;
          if (/^[\d\.\-\/\s]+$/.test(original) && original.length < 5) continue;
          
          seenOriginals.add(original.toLowerCase());
          detectedFields.push({
            original,
            placeholder: fieldDef.placeholder,
            label: fieldDef.label,
            context: context.substring(0, 100),
            confidence: 0.9
          });
          break;
        }
      }
    }
  }
  
  console.log(`[DOCX] Pattern detection found ${detectedFields.length} fields (header: first ${HEADER_SIZE}, signature: last ${SIGNATURE_SIZE})`);
  return detectedFields;
}

export async function extractDocxFullText(docxPath: string): Promise<string> {
  try {
    const content = fs.readFileSync(docxPath, "binary");
    const zip = new PizZip(content);
    
    const documentXml = zip.file("word/document.xml");
    if (!documentXml) {
      throw new Error("No document.xml found in DOCX");
    }
    
    const xmlContent = documentXml.asText();
    
    const textParts: string[] = [];
    
    const tableRegex = /<w:tbl[^>]*>([\s\S]*?)<\/w:tbl>/g;
    let tableMatch;
    while ((tableMatch = tableRegex.exec(xmlContent)) !== null) {
      const tableContent = tableMatch[1];
      const cellRegex = /<w:tc[^>]*>([\s\S]*?)<\/w:tc>/g;
      let cellMatch;
      const rowTexts: string[] = [];
      
      while ((cellMatch = cellRegex.exec(tableContent)) !== null) {
        const cellContent = cellMatch[1];
        const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
        let textMatch;
        let cellText = "";
        
        while ((textMatch = textRegex.exec(cellContent)) !== null) {
          cellText += textMatch[1];
        }
        
        if (cellText.trim()) {
          rowTexts.push(cellText.trim());
        }
      }
      
      if (rowTexts.length > 0) {
        textParts.push(rowTexts.join(": "));
      }
    }
    
    const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    let paragraphMatch;
    
    while ((paragraphMatch = paragraphRegex.exec(xmlContent)) !== null) {
      const paragraphContent = paragraphMatch[1];
      
      const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let textMatch;
      let paragraphText = "";
      
      while ((textMatch = textRegex.exec(paragraphContent)) !== null) {
        paragraphText += textMatch[1];
      }
      
      if (paragraphText.trim()) {
        textParts.push(paragraphText);
      }
    }
    
    const text = textParts.join("\n");
    console.log(`[DOCX] Extracted ${text.length} characters (including tables) from ${docxPath}`);
    return text;
  } catch (error) {
    console.error("[DOCX] Error extracting full text:", error);
    throw new Error(`Failed to extract DOCX text: ${error}`);
  }
}

export async function extractDocxStructuredContent(docxPath: string): Promise<{
  text: string;
  sections: Array<{ type: string; content: string; label?: string }>;
}> {
  try {
    const content = fs.readFileSync(docxPath, "binary");
    const zip = new PizZip(content);
    
    const documentXml = zip.file("word/document.xml");
    if (!documentXml) {
      throw new Error("No document.xml found in DOCX");
    }
    
    const xmlContent = documentXml.asText();
    const sections: Array<{ type: string; content: string; label?: string }> = [];
    const allText: string[] = [];
    
    const tableRegex = /<w:tbl[^>]*>([\s\S]*?)<\/w:tbl>/g;
    let tableMatch;
    while ((tableMatch = tableRegex.exec(xmlContent)) !== null) {
      const tableContent = tableMatch[1];
      const rowRegex = /<w:tr[^>]*>([\s\S]*?)<\/w:tr>/g;
      let rowMatch;
      
      while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
        const rowContent = rowMatch[1];
        const cellRegex = /<w:tc[^>]*>([\s\S]*?)<\/w:tc>/g;
        let cellMatch;
        const cells: string[] = [];
        
        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
          const cellContent = cellMatch[1];
          const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
          let textMatch;
          let cellText = "";
          
          while ((textMatch = textRegex.exec(cellContent)) !== null) {
            cellText += textMatch[1];
          }
          
          if (cellText.trim()) {
            cells.push(cellText.trim());
          }
        }
        
        if (cells.length >= 2) {
          const label = cells[0];
          const value = cells.slice(1).join(" ");
          sections.push({ type: "table-row", content: value, label });
          allText.push(`${label}: ${value}`);
        } else if (cells.length === 1) {
          sections.push({ type: "table-cell", content: cells[0] });
          allText.push(cells[0]);
        }
      }
    }
    
    const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    let paragraphMatch;
    
    while ((paragraphMatch = paragraphRegex.exec(xmlContent)) !== null) {
      const paragraphContent = paragraphMatch[1];
      
      const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let textMatch;
      let paragraphText = "";
      
      while ((textMatch = textRegex.exec(paragraphContent)) !== null) {
        paragraphText += textMatch[1];
      }
      
      if (paragraphText.trim()) {
        sections.push({ type: "paragraph", content: paragraphText.trim() });
        allText.push(paragraphText.trim());
      }
    }
    
    return {
      text: allText.join("\n"),
      sections
    };
  } catch (error) {
    console.error("[DOCX] Error extracting structured content:", error);
    throw new Error(`Failed to extract DOCX structured content: ${error}`);
  }
}

export const SAMPLE_DATA: Record<string, string> = {
  "customer.firstName": "Jana",
  "customer.lastName": "Nováková",
  "customer.fullName": "Jana Nováková",
  "customer.email": "jana.novakova@email.sk",
  "customer.phone": "+421 900 123 456",
  "customer.birthDate": "15.03.1990",
  "customer.personalId": "900315/1234",
  "customer.permanentAddress": "Hlavná 123, 831 01 Bratislava",
  "customer.correspondenceAddress": "Hlavná 123, 831 01 Bratislava",
  "customer.IBAN": "SK89 1100 0000 0012 3456 7890",
  "customer.address.street": "Hlavná 123",
  "customer.address.city": "Bratislava",
  "customer.address.postalCode": "831 01",
  "customer.address.country": "Slovensko",
  "father.fullName": "Peter Novák",
  "father.permanentAddress": "Hlavná 123, 831 01 Bratislava",
  "father.birthDate": "20.06.1988",
  "father.personalId": "880620/1234",
  "mother.fullName": "Mária Nováková",
  "mother.permanentAddress": "Hlavná 123, 831 01 Bratislava",
  "child.fullName": "Michal Novák",
  "child.birthDate": "01.01.2026",
  "child.birthPlace": "Bratislava",
  "company.name": "Cord Blood Center, s.r.o.",
  "company.address": "Bodenhof 4, 6014 Luzern, Švajčiarsko",
  "company.identificationNumber": "12345678",
  "company.taxIdentificationNumber": "2012345678",
  "company.vatNumber": "SK2012345678",
  "contract.number": "ZML-2026-0001",
  "contract.date": "7. januára 2026",
  "contract.validFrom": "7.1.2026",
  "contract.validTo": "31.12.2046",
  "representative.fullName": "Mgr. Martin Kováč",
  "today": new Date().toLocaleDateString("sk-SK"),
};

export async function insertPlaceholdersIntoDocx(
  docxPath: string,
  replacements: Array<{ original: string; placeholder: string }>,
  outputPath: string
): Promise<string> {
  try {
    const content = fs.readFileSync(docxPath, "binary");
    const zip = new PizZip(content);
    
    const documentXml = zip.file("word/document.xml");
    if (!documentXml) {
      throw new Error("No document.xml found in DOCX");
    }
    
    let xmlContent = documentXml.asText();
    
    const sortedReplacements = [...replacements].sort(
      (a, b) => b.original.length - a.original.length
    );
    
    for (const { original, placeholder } of sortedReplacements) {
      if (!original || original.length < 2) continue;
      
      const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedOriginal, 'g');
      xmlContent = xmlContent.replace(regex, `{{${placeholder}}}`);
    }
    
    const duplicatePlaceholderRegex = /(\{\{[^}]+\}\})\1+/g;
    xmlContent = xmlContent.replace(duplicatePlaceholderRegex, '$1');
    
    const mismatchedBracesRegex = /\{\{\{+|\}\}\}+/g;
    xmlContent = xmlContent.replace(mismatchedBracesRegex, (match) => {
      if (match.startsWith('{')) return '{{';
      return '}}';
    });
    
    zip.file("word/document.xml", xmlContent);
    
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputBuffer = zip.generate({ type: "nodebuffer" });
    fs.writeFileSync(outputPath, outputBuffer);
    
    console.log(`[DOCX] Inserted ${replacements.length} placeholders, saved to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("[DOCX] Error inserting placeholders:", error);
    throw new Error(`Failed to insert placeholders: ${error}`);
  }
}

export function getCustomerDataForContract(customer: any, contract?: any): Record<string, string> {
  const today = new Date().toLocaleDateString("sk-SK");
  
  const data: Record<string, string> = {
    "customer.firstName": customer.firstName || "",
    "customer.lastName": customer.lastName || "",
    "customer.fullName": `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
    "customer.email": customer.email || "",
    "customer.phone": customer.phone || "",
    "customer.birthDate": customer.birthDate ? new Date(customer.birthDate).toLocaleDateString("sk-SK") : "",
    "customer.personalId": customer.personalId || "",
    "customer.address.street": customer.street || "",
    "customer.address.city": customer.city || "",
    "customer.address.postalCode": customer.postalCode || "",
    "customer.address.country": customer.country || "",
    "customer.address.fullAddress": [customer.street, customer.city, customer.postalCode, customer.country]
      .filter(Boolean)
      .join(", "),
    "contract.number": contract?.contractNumber || "",
    "contract.date": contract?.createdAt ? new Date(contract.createdAt).toLocaleDateString("sk-SK") : today,
    "contract.validFrom": contract?.validFrom ? new Date(contract.validFrom).toLocaleDateString("sk-SK") : "",
    "contract.validTo": contract?.validTo ? new Date(contract.validTo).toLocaleDateString("sk-SK") : "",
    "contract.totalAmount": contract?.totalGrossAmount || "",
    "today": today,
  };

  return data;
}
