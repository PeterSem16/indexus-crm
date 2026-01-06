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
