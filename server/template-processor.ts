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
  data: Record<string, any>,
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
  data: Record<string, any>,
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

// ============================================================================
// MULTILINGUAL CRM FIELD ONTOLOGY
// Comprehensive mapping of labels in multiple languages to CRM field placeholders
// Supported languages: Slovak (SK), Czech (CZ), Hungarian (HU), Romanian (RO), 
//                      Italian (IT), German (DE), English (EN)
// ============================================================================

export interface CRMFieldDefinition {
  id: string;
  category: "customer" | "father" | "mother" | "child" | "contract" | "company" | "invoice" | "system";
  description: string;
  synonyms: {
    sk: string[];
    cz: string[];
    hu: string[];
    ro: string[];
    it: string[];
    de: string[];
    en: string[];
  };
}

export const CRM_FIELD_ONTOLOGY: CRMFieldDefinition[] = [
  // ===================== CUSTOMER FIELDS =====================
  {
    id: "customer.fullName",
    category: "customer",
    description: "Full name of the customer/client",
    synonyms: {
      sk: ["pani", "pán", "meno", "meno a priezvisko", "klientka", "klient", "zákazník", "zákazníčka", "objednávateľ", "rodička", "objednávateľka", "zmluvná strana"],
      cz: ["paní", "pan", "jméno", "jméno a příjmení", "klientka", "klient", "zákazník", "zákaznice", "objednatel", "rodička", "smluvní strana"],
      hu: ["hölgy", "úr", "név", "teljes név", "ügyfél", "megrendelő", "várandós anya", "szerződő fél"],
      ro: ["doamna", "domnul", "nume", "nume complet", "client", "clientă", "comanditar", "gravidă", "parte contractantă"],
      it: ["signora", "signor", "nome", "nome e cognome", "cliente", "ordinante", "gestante", "parte contraente"],
      de: ["frau", "herr", "name", "vollständiger name", "kundin", "kunde", "auftraggeber", "schwangere", "vertragspartei"],
      en: ["mrs", "mr", "name", "full name", "client", "customer", "orderer", "pregnant woman", "contracting party"]
    }
  },
  {
    id: "customer.firstName",
    category: "customer",
    description: "First/given name of the customer",
    synonyms: {
      sk: ["krstné meno", "meno"],
      cz: ["křestní jméno", "jméno"],
      hu: ["keresztnév", "utónév"],
      ro: ["prenume"],
      it: ["nome di battesimo", "nome"],
      de: ["vorname"],
      en: ["first name", "given name"]
    }
  },
  {
    id: "customer.lastName",
    category: "customer",
    description: "Last/family name of the customer",
    synonyms: {
      sk: ["priezvisko"],
      cz: ["příjmení"],
      hu: ["vezetéknév", "családnév"],
      ro: ["nume de familie"],
      it: ["cognome"],
      de: ["nachname", "familienname"],
      en: ["last name", "surname", "family name"]
    }
  },
  {
    id: "customer.maidenName",
    category: "customer",
    description: "Maiden name of the customer",
    synonyms: {
      sk: ["rodné meno", "rodné priezvisko"],
      cz: ["rodné jméno", "rodné příjmení"],
      hu: ["leánykori név"],
      ro: ["nume de fată"],
      it: ["nome da nubile"],
      de: ["mädchenname", "geburtsname"],
      en: ["maiden name", "birth name"]
    }
  },
  {
    id: "customer.birthDate",
    category: "customer",
    description: "Date of birth of the customer",
    synonyms: {
      sk: ["dátum narodenia", "narodená", "narodený", "nar", "nar.", "dátum nar"],
      cz: ["datum narození", "narozena", "narozen", "nar", "nar."],
      hu: ["születési dátum", "született", "szül", "szül."],
      ro: ["data nașterii", "născut", "născută", "data naștere"],
      it: ["data di nascita", "nato", "nata", "nato il", "nata il"],
      de: ["geburtsdatum", "geboren", "geb", "geb."],
      en: ["date of birth", "born", "dob", "birth date"]
    }
  },
  {
    id: "customer.personalId",
    category: "customer",
    description: "National ID / Personal identification number",
    synonyms: {
      sk: ["rodné číslo", "rč", "r.č", "r.č."],
      cz: ["rodné číslo", "rč", "r.č", "r.č."],
      hu: ["személyi szám", "személyi azonosító", "személyazonosító"],
      ro: ["cnp", "cod numeric personal"],
      it: ["codice fiscale", "cf"],
      de: ["personalausweisnummer", "ausweisnummer", "identifikationsnummer"],
      en: ["personal id", "national id", "id number", "ssn"]
    }
  },
  {
    id: "customer.idCardNumber",
    category: "customer",
    description: "ID card number",
    synonyms: {
      sk: ["číslo občianskeho preukazu", "číslo op", "číslo dokladu"],
      cz: ["číslo občanského průkazu", "číslo op", "číslo dokladu"],
      hu: ["személyi igazolvány száma", "igazolványszám"],
      ro: ["număr carte de identitate", "nr ci"],
      it: ["numero carta d'identità", "numero ci"],
      de: ["ausweisnummer", "personalausweisnummer"],
      en: ["id card number", "identity card number"]
    }
  },
  {
    id: "customer.permanentAddress",
    category: "customer",
    description: "Permanent address of the customer",
    synonyms: {
      sk: ["trvalé bydlisko", "trvalý pobyt", "trvale bytom", "adresa", "bydlisko", "adresa trvalého pobytu", "s trvalým pobytom"],
      cz: ["trvalé bydliště", "trvalý pobyt", "trvale bytem", "adresa", "bydliště", "adresa trvalého pobytu"],
      hu: ["állandó lakcím", "lakcím", "cím", "lakóhely"],
      ro: ["adresa permanentă", "domiciliu", "adresa", "reședință"],
      it: ["indirizzo permanente", "residenza", "indirizzo", "domicilio"],
      de: ["ständige adresse", "wohnsitz", "adresse", "wohnort", "anschrift"],
      en: ["permanent address", "address", "residence", "home address"]
    }
  },
  {
    id: "customer.correspondenceAddress",
    category: "customer",
    description: "Correspondence/mailing address",
    synonyms: {
      sk: ["korešpondenčná adresa", "doručovacia adresa", "adresa na doručovanie"],
      cz: ["korespondenční adresa", "doručovací adresa"],
      hu: ["levelezési cím", "postacím"],
      ro: ["adresa de corespondență", "adresa poștală"],
      it: ["indirizzo di corrispondenza", "indirizzo postale"],
      de: ["korrespondenzadresse", "postadresse", "zustelladresse"],
      en: ["correspondence address", "mailing address", "postal address"]
    }
  },
  {
    id: "customer.city",
    category: "customer",
    description: "City of residence",
    synonyms: {
      sk: ["mesto", "obec"],
      cz: ["město", "obec"],
      hu: ["város", "település"],
      ro: ["oraș", "localitate"],
      it: ["città", "comune"],
      de: ["stadt", "ort", "gemeinde"],
      en: ["city", "town"]
    }
  },
  {
    id: "customer.postalCode",
    category: "customer",
    description: "Postal/ZIP code",
    synonyms: {
      sk: ["psč", "poštové smerovacie číslo"],
      cz: ["psč", "poštovní směrovací číslo"],
      hu: ["irányítószám"],
      ro: ["cod poștal"],
      it: ["cap", "codice postale"],
      de: ["plz", "postleitzahl"],
      en: ["postal code", "zip code", "zip"]
    }
  },
  {
    id: "customer.phone",
    category: "customer",
    description: "Phone number",
    synonyms: {
      sk: ["telefón", "tel", "tel.", "mobil", "telefónne číslo", "kontaktné číslo"],
      cz: ["telefon", "tel", "tel.", "mobil", "telefonní číslo"],
      hu: ["telefon", "tel", "mobil", "telefonszám"],
      ro: ["telefon", "tel", "mobil", "număr de telefon"],
      it: ["telefono", "tel", "cellulare", "numero di telefono"],
      de: ["telefon", "tel", "handy", "telefonnummer", "mobiltelefon"],
      en: ["phone", "tel", "mobile", "phone number", "cell"]
    }
  },
  {
    id: "customer.email",
    category: "customer",
    description: "Email address",
    synonyms: {
      sk: ["email", "e-mail", "emailová adresa", "e-mailová adresa"],
      cz: ["email", "e-mail", "emailová adresa"],
      hu: ["email", "e-mail", "e-mail cím"],
      ro: ["email", "e-mail", "adresa de email"],
      it: ["email", "e-mail", "indirizzo email"],
      de: ["email", "e-mail", "e-mail-adresse"],
      en: ["email", "e-mail", "email address"]
    }
  },
  {
    id: "customer.bankAccount",
    category: "customer",
    description: "Bank account number / IBAN",
    synonyms: {
      sk: ["iban", "číslo účtu", "bankový účet", "účet"],
      cz: ["iban", "číslo účtu", "bankovní účet", "účet"],
      hu: ["iban", "bankszámlaszám", "számlaszám"],
      ro: ["iban", "cont bancar", "număr cont"],
      it: ["iban", "conto bancario", "numero conto"],
      de: ["iban", "kontonummer", "bankkonto"],
      en: ["iban", "bank account", "account number"]
    }
  },
  {
    id: "customer.bankSwift",
    category: "customer",
    description: "Bank SWIFT/BIC code",
    synonyms: {
      sk: ["swift", "swift kód", "bic"],
      cz: ["swift", "swift kód", "bic"],
      hu: ["swift", "swift kód", "bic"],
      ro: ["swift", "cod swift", "bic"],
      it: ["swift", "codice swift", "bic"],
      de: ["swift", "swift-code", "bic"],
      en: ["swift", "swift code", "bic"]
    }
  },
  // ===================== FATHER FIELDS =====================
  {
    id: "father.fullName",
    category: "father",
    description: "Full name of the father",
    synonyms: {
      sk: ["otec", "otec dieťaťa", "zákonný zástupca - otec", "meno otca"],
      cz: ["otec", "otec dítěte", "zákonný zástupce - otec", "jméno otce"],
      hu: ["apa", "gyermek apja", "törvényes képviselő - apa", "apa neve"],
      ro: ["tată", "tatăl copilului", "reprezentant legal - tată", "numele tatălui"],
      it: ["padre", "padre del bambino", "rappresentante legale - padre", "nome del padre"],
      de: ["vater", "vater des kindes", "gesetzlicher vertreter - vater", "name des vaters"],
      en: ["father", "father of the child", "legal guardian - father", "father's name"]
    }
  },
  {
    id: "father.birthDate",
    category: "father",
    description: "Date of birth of the father",
    synonyms: {
      sk: ["dátum narodenia otca", "otec - dátum narodenia", "otec nar"],
      cz: ["datum narození otce", "otec - datum narození"],
      hu: ["apa születési dátuma"],
      ro: ["data nașterii tatălui"],
      it: ["data di nascita del padre"],
      de: ["geburtsdatum des vaters"],
      en: ["father's date of birth", "father dob"]
    }
  },
  {
    id: "father.personalId",
    category: "father",
    description: "Personal ID of the father",
    synonyms: {
      sk: ["rodné číslo otca", "otec - rodné číslo", "rč otca"],
      cz: ["rodné číslo otce", "otec - rodné číslo"],
      hu: ["apa személyi száma"],
      ro: ["cnp tată"],
      it: ["codice fiscale padre"],
      de: ["personalausweisnummer des vaters"],
      en: ["father's personal id", "father ssn"]
    }
  },
  {
    id: "father.permanentAddress",
    category: "father",
    description: "Permanent address of the father",
    synonyms: {
      sk: ["adresa otca", "bydlisko otca", "trvalý pobyt otca"],
      cz: ["adresa otce", "bydliště otce", "trvalý pobyt otce"],
      hu: ["apa címe", "apa lakhelye"],
      ro: ["adresa tatălui"],
      it: ["indirizzo del padre"],
      de: ["adresse des vaters"],
      en: ["father's address"]
    }
  },
  // ===================== MOTHER FIELDS =====================
  {
    id: "mother.fullName",
    category: "mother",
    description: "Full name of the mother",
    synonyms: {
      sk: ["matka", "matka dieťaťa", "zákonný zástupca - matka", "meno matky"],
      cz: ["matka", "matka dítěte", "zákonný zástupce - matka", "jméno matky"],
      hu: ["anya", "gyermek anyja", "törvényes képviselő - anya", "anya neve"],
      ro: ["mamă", "mama copilului", "reprezentant legal - mamă", "numele mamei"],
      it: ["madre", "madre del bambino", "rappresentante legale - madre", "nome della madre"],
      de: ["mutter", "mutter des kindes", "gesetzliche vertreterin - mutter", "name der mutter"],
      en: ["mother", "mother of the child", "legal guardian - mother", "mother's name"]
    }
  },
  {
    id: "mother.birthDate",
    category: "mother",
    description: "Date of birth of the mother",
    synonyms: {
      sk: ["dátum narodenia matky", "matka - dátum narodenia"],
      cz: ["datum narození matky", "matka - datum narození"],
      hu: ["anya születési dátuma"],
      ro: ["data nașterii mamei"],
      it: ["data di nascita della madre"],
      de: ["geburtsdatum der mutter"],
      en: ["mother's date of birth", "mother dob"]
    }
  },
  {
    id: "mother.personalId",
    category: "mother",
    description: "Personal ID of the mother",
    synonyms: {
      sk: ["rodné číslo matky", "matka - rodné číslo", "rč matky"],
      cz: ["rodné číslo matky", "matka - rodné číslo"],
      hu: ["anya személyi száma"],
      ro: ["cnp mamă"],
      it: ["codice fiscale madre"],
      de: ["personalausweisnummer der mutter"],
      en: ["mother's personal id", "mother ssn"]
    }
  },
  // ===================== CHILD FIELDS =====================
  {
    id: "child.fullName",
    category: "child",
    description: "Full name of the child",
    synonyms: {
      sk: ["dieťa", "meno dieťaťa", "novorodenec"],
      cz: ["dítě", "jméno dítěte", "novorozenec"],
      hu: ["gyermek", "gyermek neve", "újszülött"],
      ro: ["copil", "numele copilului", "nou-născut"],
      it: ["bambino", "nome del bambino", "neonato"],
      de: ["kind", "name des kindes", "neugeborenes"],
      en: ["child", "child's name", "newborn", "baby"]
    }
  },
  {
    id: "child.birthDate",
    category: "child",
    description: "Date of birth of the child",
    synonyms: {
      sk: ["dátum narodenia dieťaťa", "narodené dňa", "dátum pôrodu"],
      cz: ["datum narození dítěte", "datum porodu"],
      hu: ["gyermek születési dátuma", "születési dátum"],
      ro: ["data nașterii copilului", "data naștere"],
      it: ["data di nascita del bambino", "data di nascita"],
      de: ["geburtsdatum des kindes", "geburtstermin"],
      en: ["child's date of birth", "date of birth", "birth date"]
    }
  },
  {
    id: "child.birthPlace",
    category: "child",
    description: "Place of birth of the child",
    synonyms: {
      sk: ["miesto narodenia", "narodené v", "miesto pôrodu", "pôrodnica"],
      cz: ["místo narození", "porodnice"],
      hu: ["születési hely", "szülészet"],
      ro: ["locul nașterii", "maternitate"],
      it: ["luogo di nascita", "ospedale"],
      de: ["geburtsort", "geburtsklinik"],
      en: ["place of birth", "birthplace", "hospital"]
    }
  },
  {
    id: "child.expectedBirthDate",
    category: "child",
    description: "Expected date of birth",
    synonyms: {
      sk: ["predpokladaný dátum pôrodu", "očakávaný dátum narodenia", "termín pôrodu"],
      cz: ["předpokládaný termín porodu", "očekávaný datum narození"],
      hu: ["várható szülés dátuma", "szülés időpontja"],
      ro: ["data estimată a nașterii", "termen naștere"],
      it: ["data prevista di nascita", "data presunta parto"],
      de: ["voraussichtlicher geburtstermin", "errechneter termin"],
      en: ["expected date of birth", "due date", "expected delivery date"]
    }
  },
  // ===================== CONTRACT FIELDS =====================
  {
    id: "contract.number",
    category: "contract",
    description: "Contract number",
    synonyms: {
      sk: ["číslo zmluvy", "zmluva č", "č. zmluvy", "zmluva číslo"],
      cz: ["číslo smlouvy", "smlouva č", "č. smlouvy"],
      hu: ["szerződésszám", "szerződés száma"],
      ro: ["număr contract", "contract nr"],
      it: ["numero contratto", "contratto n"],
      de: ["vertragsnummer", "vertrag nr"],
      en: ["contract number", "contract no", "agreement number"]
    }
  },
  {
    id: "contract.date",
    category: "contract",
    description: "Date of the contract",
    synonyms: {
      sk: ["dátum", "dňa", "v bratislave dňa", "uzatvorené dňa", "podpísané dňa"],
      cz: ["datum", "dne", "v praze dne", "uzavřeno dne"],
      hu: ["dátum", "keltezés", "aláírás napja"],
      ro: ["data", "la data de", "semnat la"],
      it: ["data", "in data", "firmato il"],
      de: ["datum", "am", "unterschrieben am"],
      en: ["date", "on", "signed on", "dated"]
    }
  },
  {
    id: "contract.validFrom",
    category: "contract",
    description: "Contract valid from date",
    synonyms: {
      sk: ["platnosť od", "platná od", "účinnosť od"],
      cz: ["platnost od", "platná od", "účinnost od"],
      hu: ["érvényes ettől", "hatályos ettől"],
      ro: ["valabil de la", "în vigoare de la"],
      it: ["valido dal", "in vigore dal"],
      de: ["gültig ab", "gültig von"],
      en: ["valid from", "effective from"]
    }
  },
  {
    id: "contract.validTo",
    category: "contract",
    description: "Contract valid until date",
    synonyms: {
      sk: ["platnosť do", "platná do", "účinnosť do"],
      cz: ["platnost do", "platná do", "účinnost do"],
      hu: ["érvényes eddig", "hatályos eddig"],
      ro: ["valabil până la", "în vigoare până la"],
      it: ["valido fino al", "in vigore fino al"],
      de: ["gültig bis"],
      en: ["valid until", "valid to", "effective until"]
    }
  },
  {
    id: "contract.totalAmount",
    category: "contract",
    description: "Total contract amount",
    synonyms: {
      sk: ["celková suma", "suma", "celková cena", "cena spolu"],
      cz: ["celková částka", "částka", "celková cena", "cena celkem"],
      hu: ["összesen", "teljes összeg", "végösszeg"],
      ro: ["suma totală", "total", "preț total"],
      it: ["importo totale", "totale", "prezzo totale"],
      de: ["gesamtbetrag", "gesamtsumme", "gesamtpreis"],
      en: ["total amount", "total", "total price"]
    }
  },
  // ===================== COMPANY/BILLING FIELDS =====================
  {
    id: "company.name",
    category: "company",
    description: "Company/provider name",
    synonyms: {
      sk: ["spoločnosť", "poskytovateľ", "dodávateľ", "obchodné meno"],
      cz: ["společnost", "poskytovatel", "dodavatel", "obchodní jméno"],
      hu: ["cég", "szolgáltató", "cégnév"],
      ro: ["societate", "furnizor", "nume companie"],
      it: ["società", "fornitore", "ragione sociale"],
      de: ["gesellschaft", "unternehmen", "anbieter", "firmenname"],
      en: ["company", "provider", "supplier", "company name"]
    }
  },
  {
    id: "company.identificationNumber",
    category: "company",
    description: "Company identification number (IČO)",
    synonyms: {
      sk: ["ičo", "ič", "identifikačné číslo", "ičo spoločnosti"],
      cz: ["ičo", "ič", "identifikační číslo"],
      hu: ["cégjegyzékszám", "adószám"],
      ro: ["cui", "cod unic de înregistrare"],
      it: ["partita iva", "p.iva", "codice fiscale azienda"],
      de: ["handelsregisternummer", "hrb"],
      en: ["company id", "registration number", "business id"]
    }
  },
  {
    id: "company.taxIdentificationNumber",
    category: "company",
    description: "Tax identification number (DIČ)",
    synonyms: {
      sk: ["dič", "daňové identifikačné číslo"],
      cz: ["dič", "daňové identifikační číslo"],
      hu: ["adószám", "adóazonosító"],
      ro: ["cod fiscal", "cif"],
      it: ["codice fiscale"],
      de: ["steuernummer", "steuer-id"],
      en: ["tax id", "tax number", "tin"]
    }
  },
  {
    id: "company.vatNumber",
    category: "company",
    description: "VAT identification number",
    synonyms: {
      sk: ["ič dph", "ičdph", "daňové identifikačné číslo pre dph"],
      cz: ["dič pro dph", "ičdph"],
      hu: ["áfa szám", "közösségi adószám"],
      ro: ["cod tva", "număr tva"],
      it: ["numero partita iva", "partita iva"],
      de: ["ust-idnr", "umsatzsteuer-identifikationsnummer"],
      en: ["vat number", "vat id", "vat registration"]
    }
  },
  {
    id: "company.address",
    category: "company",
    description: "Company address",
    synonyms: {
      sk: ["sídlo", "sídlo spoločnosti", "adresa spoločnosti"],
      cz: ["sídlo", "sídlo společnosti", "adresa společnosti"],
      hu: ["székhely", "cég címe"],
      ro: ["sediu", "adresa societății"],
      it: ["sede legale", "indirizzo società"],
      de: ["firmensitz", "geschäftsadresse"],
      en: ["registered office", "company address", "business address"]
    }
  },
  {
    id: "company.bankAccount",
    category: "company",
    description: "Company bank account",
    synonyms: {
      sk: ["bankový účet spoločnosti", "účet spoločnosti", "iban spoločnosti"],
      cz: ["bankovní účet společnosti", "účet společnosti"],
      hu: ["cég bankszámlaszáma"],
      ro: ["cont bancar societate"],
      it: ["conto bancario società"],
      de: ["firmenkonto", "geschäftskonto"],
      en: ["company bank account", "business account"]
    }
  },
  // ===================== INVOICE FIELDS =====================
  {
    id: "invoice.number",
    category: "invoice",
    description: "Invoice number",
    synonyms: {
      sk: ["číslo faktúry", "faktúra č", "č. faktúry"],
      cz: ["číslo faktury", "faktura č"],
      hu: ["számlaszám", "számla száma"],
      ro: ["număr factură", "factură nr"],
      it: ["numero fattura", "fattura n"],
      de: ["rechnungsnummer", "rechnung nr"],
      en: ["invoice number", "invoice no"]
    }
  },
  {
    id: "invoice.date",
    category: "invoice",
    description: "Invoice date",
    synonyms: {
      sk: ["dátum vystavenia", "dátum faktúry"],
      cz: ["datum vystavení", "datum faktury"],
      hu: ["számla kelte", "kiállítás dátuma"],
      ro: ["data emiterii", "data facturii"],
      it: ["data fattura", "data emissione"],
      de: ["rechnungsdatum", "ausstellungsdatum"],
      en: ["invoice date", "date of issue"]
    }
  },
  {
    id: "invoice.dueDate",
    category: "invoice",
    description: "Invoice due date",
    synonyms: {
      sk: ["dátum splatnosti", "splatnosť"],
      cz: ["datum splatnosti", "splatnost"],
      hu: ["fizetési határidő", "esedékesség"],
      ro: ["data scadentă", "termen de plată"],
      it: ["data scadenza", "scadenza"],
      de: ["fälligkeitsdatum", "zahlbar bis"],
      en: ["due date", "payment due"]
    }
  },
  {
    id: "invoice.totalAmount",
    category: "invoice",
    description: "Invoice total amount",
    synonyms: {
      sk: ["suma na úhradu", "celková suma faktúry", "k úhrade"],
      cz: ["částka k úhradě", "celková částka faktury"],
      hu: ["fizetendő összeg", "bruttó összeg"],
      ro: ["suma de plată", "total de plată"],
      it: ["importo da pagare", "totale fattura"],
      de: ["zu zahlender betrag", "rechnungsbetrag"],
      en: ["amount due", "total to pay", "invoice total"]
    }
  },
  // ===================== SYSTEM FIELDS =====================
  {
    id: "today",
    category: "system",
    description: "Current date (today)",
    synonyms: {
      sk: ["dnešný dátum", "dnes"],
      cz: ["dnešní datum", "dnes"],
      hu: ["mai dátum", "ma"],
      ro: ["data de azi", "astăzi"],
      it: ["data odierna", "oggi"],
      de: ["heutiges datum", "heute"],
      en: ["today's date", "today", "current date"]
    }
  },
  {
    id: "representative.fullName",
    category: "customer",
    description: "Legal representative full name",
    synonyms: {
      sk: ["zákonný zástupca", "zástupca", "splnomocnenec", "v zastúpení"],
      cz: ["zákonný zástupce", "zástupce", "zmocněnec"],
      hu: ["törvényes képviselő", "képviselő", "meghatalmazott"],
      ro: ["reprezentant legal", "împuternicit"],
      it: ["rappresentante legale", "procuratore"],
      de: ["gesetzlicher vertreter", "bevollmächtigter"],
      en: ["legal representative", "representative", "authorized person"]
    }
  },
  {
    id: "service.type",
    category: "contract",
    description: "Type of service",
    synonyms: {
      sk: ["typ služby", "služba", "balík", "program"],
      cz: ["typ služby", "služba", "balíček", "program"],
      hu: ["szolgáltatás típusa", "csomag", "program"],
      ro: ["tip serviciu", "serviciu", "pachet"],
      it: ["tipo di servizio", "servizio", "pacchetto"],
      de: ["dienstleistungsart", "service", "paket"],
      en: ["service type", "service", "package", "plan"]
    }
  },
];

// ============================================================================
// SECTION HEADING DETECTION - Identify document sections and their entities
// Used to determine context for ambiguous field labels like "trvalé bydlisko"
// ============================================================================

export interface SectionHeading {
  entity: "customer" | "father" | "mother" | "child" | "company" | "contract" | "witness";
  keywords: {
    sk: string[];
    cz: string[];
    hu: string[];
    ro: string[];
    it: string[];
    de: string[];
    en: string[];
  };
}

export const SECTION_HEADINGS: SectionHeading[] = [
  {
    entity: "customer",
    keywords: {
      sk: ["údaje o objednávateľovi", "údaje objednávateľa", "objednávateľ", "klient", "klientka", "zákazník", "rodička", "osobné údaje klienta", "údaje o rodičke", "údaje rodičky", "údaje o klientke", "zmluvná strana", "zhotoviteľ"],
      cz: ["údaje o objednateli", "objednatel", "klient", "klientka", "zákazník", "rodička", "osobní údaje klienta", "smluvní strana"],
      hu: ["megrendelő adatai", "ügyfél adatai", "megrendelő", "ügyfél", "várandós anya", "szerződő fél"],
      ro: ["datele comanditarului", "datele clientului", "comanditar", "client", "gravidă", "parte contractantă"],
      it: ["dati del committente", "dati del cliente", "committente", "cliente", "gestante", "parte contraente"],
      de: ["auftraggeber daten", "kundendaten", "auftraggeber", "kunde", "schwangere", "vertragspartei"],
      en: ["customer data", "client data", "customer", "client", "pregnant woman", "contracting party", "orderer"]
    }
  },
  {
    entity: "father",
    keywords: {
      sk: ["údaje o otcovi", "údaje otca", "otec dieťaťa", "otec", "manžel", "partner"],
      cz: ["údaje o otci", "otec dítěte", "otec", "manžel", "partner"],
      hu: ["apa adatai", "az apa adatai", "apa", "férj", "partner"],
      ro: ["datele tatălui", "tatăl", "soț", "partener"],
      it: ["dati del padre", "padre", "marito", "partner"],
      de: ["daten des vaters", "vater", "ehemann", "partner"],
      en: ["father data", "father details", "father", "husband", "partner"]
    }
  },
  {
    entity: "mother",
    keywords: {
      sk: ["údaje o matke", "údaje matky", "matka dieťaťa", "matka", "manželka"],
      cz: ["údaje o matce", "matka dítěte", "matka", "manželka"],
      hu: ["anya adatai", "az anya adatai", "anya", "feleség"],
      ro: ["datele mamei", "mama", "soție"],
      it: ["dati della madre", "madre", "moglie"],
      de: ["daten der mutter", "mutter", "ehefrau"],
      en: ["mother data", "mother details", "mother", "wife"]
    }
  },
  {
    entity: "child",
    keywords: {
      sk: ["údaje o dieťati", "údaje dieťaťa", "dieťa", "novorodenec", "novorodeniatko", "bábätko"],
      cz: ["údaje o dítěti", "dítě", "novorozenec", "miminko"],
      hu: ["gyermek adatai", "gyermek", "újszülött", "baba"],
      ro: ["datele copilului", "copil", "nou-născut"],
      it: ["dati del bambino", "bambino", "neonato"],
      de: ["daten des kindes", "kind", "neugeborenes", "baby"],
      en: ["child data", "child details", "child", "newborn", "baby"]
    }
  },
  {
    entity: "company",
    keywords: {
      sk: ["údaje o spoločnosti", "spoločnosť", "poskytovateľ", "dodávateľ", "zhotoviteľ"],
      cz: ["údaje o společnosti", "společnost", "poskytovatel", "dodavatel"],
      hu: ["cég adatai", "társaság", "szolgáltató", "szállító"],
      ro: ["datele companiei", "companie", "furnizor"],
      it: ["dati della società", "società", "fornitore"],
      de: ["firmendaten", "unternehmen", "anbieter", "lieferant"],
      en: ["company data", "company details", "company", "provider", "supplier"]
    }
  },
  {
    entity: "witness",
    keywords: {
      sk: ["svedok", "svedkovia", "prítomní svedkovia"],
      cz: ["svědek", "svědci", "přítomní svědci"],
      hu: ["tanú", "tanúk"],
      ro: ["martor", "martori"],
      it: ["testimone", "testimoni"],
      de: ["zeuge", "zeugen"],
      en: ["witness", "witnesses"]
    }
  }
];

// Detect sections in document text and their line ranges
export interface DetectedSection {
  entity: "customer" | "father" | "mother" | "child" | "company" | "contract" | "witness";
  startLine: number;
  endLine: number;
  headingText: string;
}

export function detectDocumentSections(text: string): DetectedSection[] {
  const lines = text.split('\n');
  const sections: DetectedSection[] = [];
  
  // Flatten all keywords for matching
  const keywordToEntity: Record<string, DetectedSection['entity']> = {};
  for (const heading of SECTION_HEADINGS) {
    for (const lang of Object.keys(heading.keywords) as Array<keyof typeof heading.keywords>) {
      for (const kw of heading.keywords[lang]) {
        keywordToEntity[kw.toLowerCase()] = heading.entity;
      }
    }
  }
  
  // Find section headings
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase().trim();
    if (line.length < 3) continue;
    
    // Check against all keywords
    for (const [keyword, entity] of Object.entries(keywordToEntity)) {
      if (line.includes(keyword)) {
        sections.push({
          entity,
          startLine: i,
          endLine: lines.length - 1, // Will be updated when next section is found
          headingText: lines[i].trim()
        });
        break;
      }
    }
  }
  
  // Update end lines based on next section
  for (let i = 0; i < sections.length - 1; i++) {
    sections[i].endLine = sections[i + 1].startLine - 1;
  }
  
  return sections;
}

// Get entity for a specific line based on detected sections
export function getEntityForLine(sections: DetectedSection[], lineIndex: number): DetectedSection['entity'] | null {
  for (const section of sections) {
    if (lineIndex >= section.startLine && lineIndex <= section.endLine) {
      return section.entity;
    }
  }
  return null;
}

// Generate section context for AI prompt
export function getSectionHeadingsForAIPrompt(): string {
  let result = "";
  for (const heading of SECTION_HEADINGS) {
    const examples = [
      ...heading.keywords.sk.slice(0, 3),
      ...heading.keywords.en.slice(0, 1)
    ].join(", ");
    result += `\n- ${heading.entity.toUpperCase()}: ${examples}`;
  }
  return result;
}

// Build a flat lookup table for fast matching
const buildLabelLookup = (): Record<string, string> => {
  const lookup: Record<string, string> = {};
  
  for (const field of CRM_FIELD_ONTOLOGY) {
    for (const lang of Object.keys(field.synonyms) as Array<keyof typeof field.synonyms>) {
      for (const synonym of field.synonyms[lang]) {
        const normalized = synonym.toLowerCase().trim();
        if (!lookup[normalized]) {
          lookup[normalized] = field.id;
        }
      }
    }
  }
  
  return lookup;
};

const LABEL_TO_PLACEHOLDER = buildLabelLookup();

// Export for use in AI prompt
export function getCRMFieldsForAIPrompt(): string {
  const categories: Record<string, string[]> = {};
  
  for (const field of CRM_FIELD_ONTOLOGY) {
    if (!categories[field.category]) {
      categories[field.category] = [];
    }
    const examples = [
      ...field.synonyms.sk.slice(0, 2),
      ...field.synonyms.en.slice(0, 1)
    ].join(", ");
    categories[field.category].push(`  - ${field.id}: ${field.description} (${examples})`);
  }
  
  let result = "";
  for (const [category, fields] of Object.entries(categories)) {
    result += `\n### ${category.toUpperCase()}:\n${fields.join("\n")}`;
  }
  
  return result;
}

// Find the placeholder for a given label
function findPlaceholderForLabel(label: string): string | null {
  const normalizedLabel = label.toLowerCase().replace(/[:\-–\s]+$/, "").trim();
  
  // Try exact match first
  if (LABEL_TO_PLACEHOLDER[normalizedLabel]) {
    return LABEL_TO_PLACEHOLDER[normalizedLabel];
  }
  
  // Try partial match
  for (const [key, placeholder] of Object.entries(LABEL_TO_PLACEHOLDER)) {
    if (normalizedLabel.includes(key) || key.includes(normalizedLabel)) {
      return placeholder;
    }
  }
  
  return null;
}

export interface FillFieldReplacement {
  original: string;      // The fill marker (dots/underscores) to replace
  placeholder: string;   // The CRM field name
  label: string;         // The label that precedes the fill marker
  lineIndex: number;     // Line number for reference
}

// Detect fill-field markers and return replacements where ONLY the markers are replaced
export function detectFillFieldReplacements(text: string): FillFieldReplacement[] {
  const replacements: FillFieldReplacement[] = [];
  const lines = text.split(/\n/);
  const totalLines = lines.length;
  
  const HEADER_SIZE = 40;
  const SIGNATURE_SIZE = 50;
  
  // Pattern to match fill markers: 3+ dots, underscores, or ellipsis
  const fillMarkerPattern = /([.]{3,}|[_]{3,}|[…]{2,})/g;
  
  // Pattern to extract label before fill marker
  const labelBeforeMarkerPattern = /^(.+?)\s*[:–\-]?\s*([.]{3,}|[_]{3,}|[…]{2,})/;
  
  const usedPlaceholders = new Set<string>();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Only process header, signature, or fill-field lines
    const isHeader = i < HEADER_SIZE;
    const isSignature = i >= totalLines - SIGNATURE_SIZE;
    const hasFillMarker = fillMarkerPattern.test(line);
    
    if (!isHeader && !isSignature && !hasFillMarker) {
      continue;
    }
    
    // Reset regex state
    fillMarkerPattern.lastIndex = 0;
    
    // Find all fill markers on this line
    let match;
    while ((match = fillMarkerPattern.exec(line)) !== null) {
      const fillMarker = match[1];
      const markerIndex = match.index;
      
      // Get the text before this marker to find the label
      const textBefore = line.substring(0, markerIndex).trim();
      
      // Extract the label (last meaningful word/phrase before the marker)
      const labelMatch = textBefore.match(/([^\n,;()]+?)[:–\-]?\s*$/);
      const label = labelMatch ? labelMatch[1].trim() : textBefore;
      
      if (!label || label.length < 2) continue;
      
      // Find the appropriate placeholder for this label
      const placeholder = findPlaceholderForLabel(label);
      
      if (placeholder) {
        // Create unique key combining placeholder + line to allow same field in different sections
        const uniqueKey = `${placeholder}_line${i}`;
        if (!usedPlaceholders.has(uniqueKey)) {
          usedPlaceholders.add(uniqueKey);
          replacements.push({
            original: fillMarker,
            placeholder: placeholder,
            label: label,
            lineIndex: i
          });
        }
      }
    }
  }
  
  console.log(`[DOCX] Fill-field detection found ${replacements.length} markers to replace`);
  return replacements;
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
  replacements: Array<{ original: string; placeholder: string; label?: string; lineIndex?: number }>,
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
    
    // Sort replacements by line index to process in document order
    const sortedReplacements = [...replacements].sort((a, b) => 
      (a.lineIndex ?? 9999) - (b.lineIndex ?? 9999)
    );
    
    // Track labels we've successfully matched to avoid double-replacement
    const usedLabels = new Set<string>();
    let replacementCount = 0;
    
    console.log(`[DOCX Insert] Processing ${sortedReplacements.length} replacements...`);
    
    // Process replacements in line order
    for (const { original, placeholder, label, lineIndex } of sortedReplacements) {
      if (!original || !placeholder) {
        console.log(`[DOCX Insert] Skipping empty replacement`);
        continue;
      }
      
      console.log(`[DOCX Insert] Processing: label="${label}" placeholder="${placeholder}" line=${lineIndex}`);
      
      // Escape the original for regex
      const escapedMarker = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let matched = false;
      
      // If we have a label, try to match label + marker pattern FIRST
      if (label) {
        const normalizedLabel = label.toLowerCase().trim();
        
        // Skip if we already processed this exact label
        if (usedLabels.has(normalizedLabel)) {
          console.log(`[DOCX Insert] Skipping duplicate label "${label}" for ${placeholder}`);
          continue;
        }
        
        const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Pattern: label text, optional separator (: -), then the fill marker (dots/underscores)
        // This is more specific - must match the exact label before the dots
        const labelWithMarkerRegex = new RegExp(
          `(${escapedLabel}[^<]*?[:–\\-]?\\s*)(${escapedMarker})`,
          'i'
        );
        
        if (labelWithMarkerRegex.test(xmlContent)) {
          xmlContent = xmlContent.replace(labelWithMarkerRegex, `$1{{${placeholder}}}`);
          usedLabels.add(normalizedLabel);
          replacementCount++;
          matched = true;
          console.log(`[DOCX Insert] SUCCESS: Replaced "${original.substring(0, 15)}..." after label "${label}" with {{${placeholder}}}`);
          continue;
        }
        
        // Try alternative: label might be in separate XML element
        // Match label in one <w:t> and dots in another nearby
        const labelOnlyRegex = new RegExp(`<w:t[^>]*>${escapedLabel}[^<]*</w:t>`, 'i');
        if (labelOnlyRegex.test(xmlContent)) {
          // Found the label - now find the next dots sequence after it
          const labelMatch = xmlContent.match(labelOnlyRegex);
          if (labelMatch && labelMatch.index !== undefined) {
            const afterLabel = xmlContent.substring(labelMatch.index + labelMatch[0].length);
            const dotsInNextElement = afterLabel.match(/^[^<]*(<[^>]+>)*[^<]*?([.]{3,}|[_]{3,}|[…]{2,})/);
            
            if (dotsInNextElement) {
              const dotsMarker = dotsInNextElement[2];
              const fullPattern = new RegExp(
                `(${escapedLabel}[^<]*</w:t>[^]*?)(${dotsMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
                'i'
              );
              
              if (fullPattern.test(xmlContent)) {
                xmlContent = xmlContent.replace(fullPattern, `$1{{${placeholder}}}`);
                usedLabels.add(normalizedLabel);
                replacementCount++;
                matched = true;
                console.log(`[DOCX Insert] SUCCESS: Replaced dots after separate label "${label}" with {{${placeholder}}}`);
                continue;
              }
            }
          }
        }
        
        // If label-specific matching failed, try simple marker replacement as fallback
        if (!matched) {
          console.log(`[DOCX Insert] Label pattern failed for "${label}", trying simple marker...`);
          const simpleMarkerRegex = new RegExp(escapedMarker);
          if (simpleMarkerRegex.test(xmlContent)) {
            xmlContent = xmlContent.replace(simpleMarkerRegex, `{{${placeholder}}}`);
            usedLabels.add(normalizedLabel);
            replacementCount++;
            matched = true;
            console.log(`[DOCX Insert] SUCCESS: Replaced marker with {{${placeholder}}} (simple fallback)`);
          } else {
            console.log(`[DOCX Insert] FAILED: Could not find marker "${original.substring(0, 20)}..." in XML`);
          }
        }
      } else {
        // No label provided - try simple replacement
        const simpleMarkerRegex = new RegExp(escapedMarker);
        if (simpleMarkerRegex.test(xmlContent)) {
          xmlContent = xmlContent.replace(simpleMarkerRegex, `{{${placeholder}}}`);
          replacementCount++;
          matched = true;
          console.log(`[DOCX Insert] SUCCESS: Replaced "${original.substring(0, 20)}..." with {{${placeholder}}} (no label)`);
        } else {
          console.log(`[DOCX Insert] FAILED: Could not find marker without label in XML`);
        }
      }
    }
    
    // Cleanup: fix any duplicate or malformed placeholders
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
    
    console.log(`[DOCX] Inserted ${replacementCount} placeholders, saved to ${outputPath}`);
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
