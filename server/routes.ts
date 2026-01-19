import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertUserSchema, insertCustomerSchema, updateUserSchema, loginSchema,
  insertProductSchema, insertCustomerProductSchema, insertBillingDetailsSchema,
  insertCustomerNoteSchema, insertActivityLogSchema, sendEmailSchema, sendSmsSchema,
  insertComplaintTypeSchema, insertCooperationTypeSchema, insertVipStatusSchema, insertHealthInsuranceSchema,
  insertLaboratorySchema, insertHospitalSchema, insertClinicSchema,
  insertCollaboratorSchema, insertCollaboratorAddressSchema, insertCollaboratorOtherDataSchema, insertCollaboratorAgreementSchema,
  insertLeadScoringCriteriaSchema,
  insertServiceConfigurationSchema, insertServiceInstanceSchema, insertInvoiceTemplateSchema, insertInvoiceLayoutSchema,
  insertRoleSchema, insertRoleModulePermissionSchema, insertRoleFieldPermissionSchema,
  insertSavedSearchSchema,
  insertCampaignSchema, insertCampaignContactSchema, insertCampaignContactHistorySchema,
  insertSipSettingsSchema, insertCallLogSchema,
  insertInstanceVatRateSchema,
  insertContractTemplateSchema, insertContractTemplateVersionSchema, insertContractInstanceSchema,
  insertContractInstanceProductSchema, insertContractParticipantSchema, insertContractSignatureRequestSchema,
  insertGsmSenderConfigSchema,
  insertVisitEventSchema,
  type SafeUser, type Customer, type Product, type BillingDetails, type ActivityLog, type LeadScoringCriteria,
  type ServiceConfiguration, type InvoiceTemplate, type InvoiceLayout, type Role,
  type Campaign, type CampaignContact, type ContractInstance
} from "@shared/schema";
import Handlebars from "handlebars";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import multer from "multer";
import OpenAI from "openai";
import {
  extractPdfFormFields,
  extractDocxPlaceholders,
  extractHtmlPlaceholders,
  fillPdfForm,
  fillDocxTemplate,
  convertDocxToPdf,
  generateContractFromTemplate,
  getCustomerDataForContract,
  CRM_DATA_FIELDS,
} from "./template-processor";
import { convertPdfToDocx, isConverterAvailable } from "./pdf-to-docx-converter";
import mammoth from "mammoth";
import { PDFDocument as PDFLibDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import { notificationService } from "./lib/notification-service";
import * as XLSX from "xlsx";
import { STORAGE_PATHS, ensureAllDirectoriesExist, getPublicUrl, DATA_ROOT } from "./config/storage-paths";

// Initialize all storage directories
ensureAllDirectoriesExist();

// Global uploads directory (for backward compatibility)
const uploadsDir = DATA_ROOT;

// OpenAI client for AI-powered PDF conversion
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// AI-powered email content analysis for sentiment, characteristics, and intent detection
interface EmailAnalysisResult {
  sentiment: "positive" | "neutral" | "negative" | "angry";
  hasInappropriateContent: boolean;
  alertLevel: "none" | "warning" | "critical";
  note: string;
  // Extended characteristics
  hasAngryTone: boolean;
  hasRudeExpressions: boolean;
  wantsToCancel: boolean; // Chce zrušiť zmluvu
  wantsConsent: boolean; // Chce urobiť súhlas
  doesNotAcceptContract: boolean; // Neakceptuje zmluvu
}

async function analyzeEmailContent(content: string, subject: string): Promise<EmailAnalysisResult | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.log("[AI Analysis] OpenAI API key not configured, skipping analysis");
    return null;
  }

  try {
    // Strip HTML tags and limit content length
    const cleanContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an email analyzer for a cord blood banking CRM system. Analyze customer emails for sentiment and intent.

Analyze for these characteristics:
1. sentiment: "positive", "neutral", "negative", or "angry" (frustrated/upset customer)
2. hasInappropriateContent: true if email contains profanity, threats, harassment, or offensive language
3. hasAngryTone: true if the customer sounds angry, frustrated, upset or uses aggressive language
4. hasRudeExpressions: true if email contains rude, vulgar, or impolite expressions
5. wantsToCancel: true if customer expresses intent to cancel/terminate their contract or service ("chcem zrušiť", "ukončiť zmluvu", "vypovedať", "nechcem pokračovať")
6. wantsConsent: true if customer wants to give consent or sign/approve something ("súhlasím", "chcem podpísať", "dávam súhlas", "akceptujem")
7. doesNotAcceptContract: true if customer explicitly refuses or rejects a contract/agreement ("neakceptujem", "nesúhlasím", "odmietam", "nechcem podpísať")
8. alertLevel: "none" (normal), "warning" (needs attention), "critical" (urgent/inappropriate)
9. note: Brief explanation in Slovak language

Respond ONLY with valid JSON:
{"sentiment":"neutral","hasInappropriateContent":false,"hasAngryTone":false,"hasRudeExpressions":false,"wantsToCancel":false,"wantsConsent":false,"doesNotAcceptContract":false,"alertLevel":"none","note":"Stručné vysvetlenie"}

Slovak anger indicators: "nahnevaný", "nespokojný", "sťažujem", "hanba", "katastrofa", "nekompetentní", "okamžite", "právnik"
Slovak profanity: check for vulgar words like "sakra", "do riti", "kurva" and similar`
        },
        {
          role: "user",
          content: `Analyze this email:\n\nSubject: ${subject}\n\nContent: ${cleanContent}`
        }
      ],
      temperature: 0.1,
      max_tokens: 300,
    });

    let resultText = response.choices[0]?.message?.content?.trim();
    if (!resultText) return null;

    // Strip markdown code block if present (OpenAI sometimes wraps JSON in ```json...```)
    if (resultText.startsWith("```")) {
      resultText = resultText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    // Parse JSON response
    const parsed = JSON.parse(resultText);
    return {
      sentiment: parsed.sentiment || "neutral",
      hasInappropriateContent: parsed.hasInappropriateContent === true,
      alertLevel: parsed.alertLevel || "none",
      note: parsed.note || "",
      hasAngryTone: parsed.hasAngryTone === true,
      hasRudeExpressions: parsed.hasRudeExpressions === true,
      wantsToCancel: parsed.wantsToCancel === true,
      wantsConsent: parsed.wantsConsent === true,
      doesNotAcceptContract: parsed.doesNotAcceptContract === true,
    };
  } catch (error) {
    console.error("[AI Analysis] Error analyzing email:", error);
    return null;
  }
}

// AI-powered SMS content analysis for sentiment, characteristics, and intent detection
async function analyzeSmsContent(content: string): Promise<EmailAnalysisResult | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.log("[AI SMS Analysis] OpenAI API key not configured, skipping analysis");
    return null;
  }

  try {
    const cleanContent = content.trim().substring(0, 500);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an SMS analyzer for a cord blood banking CRM system. Analyze customer SMS messages for sentiment and intent.

SMS messages are typically short. Analyze for:
1. sentiment: "positive", "neutral", "negative", or "angry" (frustrated/upset customer)
2. hasInappropriateContent: true if SMS contains profanity, threats, harassment, or offensive language
3. hasAngryTone: true if the customer sounds angry, frustrated, upset or uses aggressive language
4. hasRudeExpressions: true if SMS contains rude, vulgar, or impolite expressions
5. wantsToCancel: true if customer expresses intent to cancel/terminate their contract or service ("chcem zrušiť", "ukončiť", "vypovedať", "nechcem")
6. wantsConsent: true if customer wants to give consent or sign/approve something ("súhlasím", "ok", "áno", "akceptujem")
7. doesNotAcceptContract: true if customer explicitly refuses or rejects ("neakceptujem", "nesúhlasím", "odmietam", "nie")
8. alertLevel: "none" (normal), "warning" (needs attention), "critical" (urgent/inappropriate)
9. note: Brief explanation in Slovak language

Respond ONLY with valid JSON:
{"sentiment":"neutral","hasInappropriateContent":false,"hasAngryTone":false,"hasRudeExpressions":false,"wantsToCancel":false,"wantsConsent":false,"doesNotAcceptContract":false,"alertLevel":"none","note":"Stručné vysvetlenie"}

Slovak anger indicators: "nahnevaný", "nespokojný", "sťažujem", "katastrofa", "okamžite", "právnik"
Slovak profanity: check for vulgar words`
        },
        {
          role: "user",
          content: `Analyze this SMS: ${cleanContent}`
        }
      ],
      temperature: 0.1,
      max_tokens: 300,
    });

    let resultText = response.choices[0]?.message?.content?.trim();
    if (!resultText) return null;

    if (resultText.startsWith("```")) {
      resultText = resultText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    const parsed = JSON.parse(resultText);
    console.log(`[AI SMS Analysis] Result: sentiment=${parsed.sentiment}, alert=${parsed.alertLevel}`);
    
    return {
      sentiment: parsed.sentiment || "neutral",
      hasInappropriateContent: parsed.hasInappropriateContent === true,
      alertLevel: parsed.alertLevel || "none",
      note: parsed.note || "",
      hasAngryTone: parsed.hasAngryTone === true,
      hasRudeExpressions: parsed.hasRudeExpressions === true,
      wantsToCancel: parsed.wantsToCancel === true,
      wantsConsent: parsed.wantsConsent === true,
      doesNotAcceptContract: parsed.doesNotAcceptContract === true,
    };
  } catch (error) {
    console.error("[AI SMS Analysis] Error analyzing SMS:", error);
    return null;
  }
}

// Configure multer for agreement file uploads
const agreementStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STORAGE_PATHS.agreements);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `agreement-${uniqueSuffix}${ext}`);
  },
});

const uploadAgreement = multer({
  storage: agreementStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "application/msword", 
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, JPEG, PNG, DOC, DOCX are allowed."));
    }
  },
});

// Configure multer for invoice image uploads
const invoiceImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STORAGE_PATHS.invoiceImages);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `invoice-image-${uniqueSuffix}${ext}`);
  },
});

const uploadInvoiceImage = multer({
  storage: invoiceImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, GIF, WEBP, SVG are allowed."));
    }
  },
});

// Configure multer for user avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STORAGE_PATHS.avatars);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, GIF, WEBP are allowed."));
    }
  },
});

// Configure multer for email image uploads
const emailImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STORAGE_PATHS.emailImages);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `email-${uniqueSuffix}${ext}`);
  },
});

const uploadEmailImage = multer({
  storage: emailImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, GIF, WEBP are allowed."));
    }
  },
});

// Configure multer for contract template PDF uploads
const contractPdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STORAGE_PATHS.contractPdfs);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `contract-template-${uniqueSuffix}${ext}`);
  },
});

const uploadContractPdf = multer({
  storage: contractPdfStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF and DOCX files are allowed."));
    }
  },
});

// Configure multer for SuperDoc DOCX uploads (memory storage for direct buffer access)
const uploadDocxMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for large documents
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream", // SuperDoc may send as binary
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.docx')) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only DOCX files are allowed."));
    }
  },
});

// Watermark translations by locale
const WATERMARK_TRANSLATIONS: Record<string, { cancelled: string; reason: string }> = {
  sk: { cancelled: "ZRUŠENÁ", reason: "Dôvod" },
  cs: { cancelled: "ZRUŠENO", reason: "Důvod" },
  hu: { cancelled: "TÖRÖLT", reason: "Ok" },
  ro: { cancelled: "ANULAT", reason: "Motiv" },
  it: { cancelled: "ANNULLATO", reason: "Motivo" },
  de: { cancelled: "STORNIERT", reason: "Grund" },
  en: { cancelled: "CANCELLED", reason: "Reason" },
};

// Get user locale from assigned countries (priority: en > first country)
function getUserLocale(assignedCountries: string[] = []): string {
  const countryToLocale: Record<string, string> = {
    US: "en", SK: "sk", CZ: "cs", HU: "hu", RO: "ro", IT: "it", DE: "de"
  };
  
  // If multiple countries or US is in the list, use English
  if (assignedCountries.length > 1 || assignedCountries.includes("US")) {
    return "en";
  }
  
  // Single country - use its locale
  if (assignedCountries.length === 1) {
    return countryToLocale[assignedCountries[0]] || "en";
  }
  
  return "en"; // Default to English
}

// Add cancellation watermark to PDF for cancelled contracts
async function addCancellationWatermark(pdfBuffer: Buffer, cancellationReason: string | null, locale: string = "en"): Promise<Buffer> {
  try {
    const pdfDoc = await PDFLibDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const translations = WATERMARK_TRANSLATIONS[locale] || WATERMARK_TRANSLATIONS.en;
    const watermarkText = translations.cancelled;
    const reasonText = cancellationReason ? `${translations.reason}: ${cancellationReason}` : "";
    
    for (const page of pages) {
      const { width, height } = page.getSize();
      
      // Draw large diagonal "ZRUŠENÁ" watermark
      const fontSize = Math.min(width, height) / 6;
      const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
      
      page.drawText(watermarkText, {
        x: width / 2 - textWidth / 2,
        y: height / 2,
        size: fontSize,
        font,
        color: rgb(0.8, 0.2, 0.2),
        opacity: 0.35,
        rotate: degrees(-45),
      });
      
      // Draw reason text at bottom
      if (reasonText) {
        const reasonFontSize = 12;
        page.drawText(reasonText, {
          x: 50,
          y: 30,
          size: reasonFontSize,
          font,
          color: rgb(0.8, 0.2, 0.2),
          opacity: 0.8,
        });
      }
      
      // Draw red border
      page.drawRectangle({
        x: 10,
        y: 10,
        width: width - 20,
        height: height - 20,
        borderColor: rgb(0.8, 0.2, 0.2),
        borderWidth: 3,
        opacity: 0.5,
      });
    }
    
    const modifiedPdfBytes = await pdfDoc.save();
    return Buffer.from(modifiedPdfBytes);
  } catch (error) {
    console.error("Error adding watermark:", error);
    return pdfBuffer; // Return original if watermark fails
  }
}

// Helper function to convert date strings to Date objects
function parseDateFields(data: Record<string, any>): Record<string, any> {
  const result = { ...data };
  if (typeof result.fromDate === 'string') {
    result.fromDate = result.fromDate ? new Date(result.fromDate) : null;
  }
  if (typeof result.toDate === 'string') {
    result.toDate = result.toDate ? new Date(result.toDate) : null;
  }
  return result;
}

// Extract text from PDF using pdftotext command (more reliable than pdf-parse)
async function extractPdfText(filePath: string): Promise<string> {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    
    // Use pdftotext from poppler-utils - more reliable than pdf-parse
    const { stdout } = await execAsync(`pdftotext -layout "${filePath}" -`);
    console.log(`[PDF Text] Extracted ${stdout.length} characters using pdftotext`);
    return stdout || "";
  } catch (error) {
    console.warn("[PDF Text] pdftotext extraction failed (this is OK for scanned PDFs):", error);
    return "";
  }
}

// Convert PDF pages to JPEG images using pdftoppm (poppler-utils) - for AI processing
async function convertPdfToImages(pdfPath: string, maxPages: number = 3): Promise<string[]> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);
  
  const outputDir = path.dirname(pdfPath);
  const baseName = path.basename(pdfPath, ".pdf");
  const outputPrefix = path.join(outputDir, `${baseName}-page`);
  
  try {
    // Convert PDF to JPEG images - 100 DPI keeps files small (~200-300KB per page)
    // Use 85% quality JPEG to reduce file size further while maintaining readability
    // This prevents API timeouts and speeds up processing
    await execAsync(`pdftoppm -jpeg -jpegopt quality=85 -r 100 -l ${maxPages} "${pdfPath}" "${outputPrefix}"`);
    
    // Find all generated image files
    const files = fs.readdirSync(outputDir);
    const imageFiles = files
      .filter(f => f.startsWith(`${baseName}-page`) && (f.endsWith(".jpg") || f.endsWith(".png")))
      .sort()
      .slice(0, maxPages)
      .map(f => path.join(outputDir, f));
    
    console.log(`[PDF Conversion] Generated ${imageFiles.length} JPEG images from PDF (max ${maxPages} pages, 100 DPI, 85% quality)`);
    return imageFiles;
  } catch (error) {
    console.error("PDF to image conversion failed:", error);
    return [];
  }
}

// Extract PDF pages as high-quality PNG images for use in HTML editor
async function extractPdfPagesAsImages(
  pdfPath: string, 
  categoryId: number, 
  countryCode: string,
  maxPages: number = 10
): Promise<{ pages: { pageNumber: number; imageUrl: string; fileName: string }[] }> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);
  
  // Create permanent directory for extracted images
  const outputDir = path.join(uploadsDir, "contract-pdfs", `category-${categoryId}`, countryCode);
  
  // Ensure directory exists and clean previous extractions
  if (fs.existsSync(outputDir)) {
    const oldFiles = fs.readdirSync(outputDir);
    for (const file of oldFiles) {
      if (file.startsWith("page-") && file.endsWith(".png")) {
        fs.unlinkSync(path.join(outputDir, file));
      }
    }
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPrefix = path.join(outputDir, "page");
  
  try {
    // Convert PDF to high-quality PNG images at 200 DPI for clear text
    await execAsync(`pdftoppm -png -r 200 -l ${maxPages} "${pdfPath}" "${outputPrefix}"`);
    
    // Find all generated image files
    const files = fs.readdirSync(outputDir);
    const imageFiles = files
      .filter(f => f.startsWith("page-") && f.endsWith(".png"))
      .sort((a, b) => {
        const numA = parseInt(a.match(/page-(\d+)/)?.[1] || "0");
        const numB = parseInt(b.match(/page-(\d+)/)?.[1] || "0");
        return numA - numB;
      })
      .slice(0, maxPages);
    
    const pages = imageFiles.map((fileName, index) => {
      const filePath = path.join(outputDir, fileName);
      const stats = fs.statSync(filePath);
      console.log(`[PDF Extract] Page ${index + 1}: ${fileName} (${Math.round(stats.size / 1024)}KB)`);
      
      return {
        pageNumber: index + 1,
        imageUrl: `/uploads/contract-pdfs/category-${categoryId}/${countryCode}/${fileName}`,
        fileName
      };
    });
    
    console.log(`[PDF Extract] Extracted ${pages.length} PNG pages from PDF at 200 DPI`);
    return { pages };
  } catch (error) {
    console.error("PDF page extraction failed:", error);
    return { pages: [] };
  }
}

// AI-powered PDF to HTML conversion using OpenAI Vision
async function convertPdfToHtmlWithAI(
  pdfPath: string,
  categoryId: number,
  countryCode: string,
  maxPages: number = 10
): Promise<{
  htmlContent: string;
  extractedText: string;
  embeddedImages: { fileName: string; imageUrl: string; sizeKB: number }[];
  pageImages: { pageNumber: number; imageUrl: string; fileName: string }[];
  conversionMethod: "ai" | "text-only";
}> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);
  
  // Create directories for assets
  const baseDir = path.join(uploadsDir, "contract-pdfs", `category-${categoryId}`, countryCode);
  const imagesDir = path.join(baseDir, "images");
  const pagesDir = path.join(baseDir, "pages");
  
  // Clean and create directories
  for (const dir of [imagesDir, pagesDir]) {
    if (fs.existsSync(dir)) {
      const oldFiles = fs.readdirSync(dir);
      for (const file of oldFiles) {
        try { fs.unlinkSync(path.join(dir, file)); } catch (e) {}
      }
    } else {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  let extractedText = "";
  let embeddedImages: { fileName: string; imageUrl: string; sizeKB: number }[] = [];
  let pageImages: { pageNumber: number; imageUrl: string; fileName: string }[] = [];
  let htmlContent = "";
  let conversionMethod: "ai" | "text-only" = "ai";
  
  // 1. Extract text using Python pdfplumber (handles two-column layouts)
  let pdfPages: { pageNumber: number; text: string; hasColumns: boolean }[] = [];
  try {
    const pythonScript = path.join(process.cwd(), 'server', 'pdf-extractor.py');
    const { stdout } = await execAsync(`python3 "${pythonScript}" "${pdfPath}"`);
    const result = JSON.parse(stdout);
    
    if (result.success) {
      extractedText = result.fullText || "";
      pdfPages = result.pages || [];
      console.log(`[PDF] Extracted ${extractedText.length} chars from ${pdfPages.length} pages (pdfplumber)`);
    } else {
      console.warn("[PDF] pdfplumber failed:", result.error);
      // Fallback to pdftotext
      const { stdout: fallbackText } = await execAsync(`pdftotext "${pdfPath}" -`);
      extractedText = fallbackText || "";
      console.log(`[PDF] Fallback: extracted ${extractedText.length} chars (pdftotext)`);
    }
  } catch (error) {
    console.warn("[PDF] Python extraction failed, trying pdftotext:", error);
    try {
      const { stdout } = await execAsync(`pdftotext "${pdfPath}" -`);
      extractedText = stdout || "";
      console.log(`[PDF] Fallback extracted ${extractedText.length} chars`);
    } catch (e) {
      console.warn("[PDF] All text extraction failed");
    }
  }
  
  // 2. Extract embedded images (logos, graphics) - skip if fails
  try {
    const imagePrefix = path.join(imagesDir, "img");
    await execAsync(`pdfimages -png "${pdfPath}" "${imagePrefix}"`);
    
    const files = fs.readdirSync(imagesDir);
    embeddedImages = files
      .filter(f => f.endsWith(".png") || f.endsWith(".jpg"))
      .map(fileName => {
        const filePath = path.join(imagesDir, fileName);
        const stats = fs.statSync(filePath);
        const sizeKB = Math.round(stats.size / 1024);
        if (sizeKB < 1) {
          try { fs.unlinkSync(filePath); } catch (e) {}
          return null;
        }
        return {
          fileName,
          imageUrl: `/uploads/contract-pdfs/category-${categoryId}/${countryCode}/images/${fileName}`,
          sizeKB
        };
      })
      .filter(Boolean) as typeof embeddedImages;
    console.log(`[PDF AI] Extracted ${embeddedImages.length} embedded images`);
  } catch (error) {
    console.warn("[PDF AI] Embedded image extraction skipped:", error);
  }
  
  // 3. Convert PDF pages to images for AI analysis (300 DPI for better quality)
  let pageImagePaths: string[] = [];
  try {
    const pagePrefix = path.join(pagesDir, "page");
    await execAsync(`pdftoppm -png -r 300 -l ${maxPages} "${pdfPath}" "${pagePrefix}"`);
    
    const files = fs.readdirSync(pagesDir);
    const sortedFiles = files
      .filter(f => f.endsWith(".png"))
      .sort((a, b) => {
        const numA = parseInt(a.match(/(\d+)/)?.[1] || "0");
        const numB = parseInt(b.match(/(\d+)/)?.[1] || "0");
        return numA - numB;
      });
    
    pageImages = sortedFiles.map((fileName, index) => ({
      pageNumber: index + 1,
      imageUrl: `/uploads/contract-pdfs/category-${categoryId}/${countryCode}/pages/${fileName}`,
      fileName
    }));
    
    pageImagePaths = sortedFiles.map(f => path.join(pagesDir, f));
    console.log(`[PDF AI] Created ${pageImages.length} page images for AI analysis`);
  } catch (error) {
    console.warn("[PDF AI] Page image creation failed, will use text-only:", error);
  }
  
  // 4. Generate empty HTML template - user will edit manually using page images as reference
  console.log("[PDF] Creating empty template - images available for reference");
  conversionMethod = "text-only";
  
  // Create a clean starting template for the contract
  const pageCount = pageImages.length || 1;
  
  htmlContent = `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="utf-8">
  <title>Zmluva</title>
  <style>
    .contract-content { 
      max-width: 700px; 
      margin: 0 auto; 
      font-family: 'Times New Roman', Georgia, serif; 
      font-size: 12px; 
      line-height: 1.6; 
      color: #000; 
      padding: 20px 30px;
    }
    .contract-content h2 {
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      margin: 20px 0;
    }
    .contract-content h3 { 
      font-size: 13px; 
      font-weight: bold;
      margin: 25px 0 12px; 
      text-align: center;
    }
    .contract-content p { 
      margin: 8px 0; 
      text-align: justify;
    }
    .contract-content .parties {
      margin: 20px 0;
    }
    .contract-content .fill-field {
      display: inline-block;
      border-bottom: 1px dotted #000;
      min-width: 200px;
      padding: 2px 5px;
    }
    .contract-content .signature-block {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
    }
    .contract-content .signature {
      text-align: center;
      width: 45%;
    }
    .contract-content .signature-line {
      border-top: 1px solid #000;
      margin-top: 50px;
      padding-top: 5px;
    }
    @media print { 
      .contract-content { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="contract-content">
    <h2>ZMLUVA</h2>
    
    <p style="text-align: center; margin-bottom: 30px;">
      <em>Prepíšte obsah zmluvy podľa obrázkov stránok zobrazených vľavo.</em>
    </p>
    
    <div class="parties">
      <p><strong>Zmluvná strana 1:</strong></p>
      <p>Názov: <span class="fill-field" contenteditable="true"></span></p>
      <p>Sídlo: <span class="fill-field" contenteditable="true"></span></p>
      <p>IČO: <span class="fill-field" contenteditable="true"></span></p>
    </div>
    
    <div class="parties">
      <p><strong>Zmluvná strana 2:</strong></p>
      <p>Meno: <span class="fill-field" contenteditable="true"></span></p>
      <p>Adresa: <span class="fill-field" contenteditable="true"></span></p>
    </div>
    
    <h3>Článok I - Predmet zmluvy</h3>
    <p>Tu vložte text článku I...</p>
    
    <h3>Článok II - Práva a povinnosti</h3>
    <p>Tu vložte text článku II...</p>
    
    <h3>Článok III - Záverečné ustanovenia</h3>
    <p>Tu vložte text článku III...</p>
    
    <div class="signature-block">
      <div class="signature">
        <div class="signature-line">Zmluvná strana 1</div>
      </div>
      <div class="signature">
        <div class="signature-line">Zmluvná strana 2</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  
  console.log(`[PDF] Created empty template with ${pageCount} page images for reference`);
  
  return { htmlContent, extractedText, embeddedImages, pageImages, conversionMethod };
}

// Read images and convert to base64 for OpenAI Vision
function imagesToBase64(imagePaths: string[]): { type: "image_url"; image_url: { url: string; detail: "high" } }[] {
  return imagePaths.map(imagePath => {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString("base64");
    // Prefer PNG for lossless quality, fallback to JPEG
    const mimeType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";
    const fileSizeKB = Math.round(imageBuffer.length / 1024);
    console.log(`[PDF Conversion] Image ${path.basename(imagePath)}: ${fileSizeKB}KB (${mimeType})`);
    return {
      type: "image_url" as const,
      image_url: {
        url: `data:${mimeType};base64,${base64}`,
        detail: "high" as const  // Force high resolution - prevents auto-downscaling
      }
    };
  });
}

// Cleanup temporary image files
function cleanupTempImages(imagePaths: string[]): void {
  for (const imagePath of imagePaths) {
    try {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    } catch (e) {
      console.error(`Failed to cleanup temp image ${imagePath}:`, e);
    }
  }
}

declare module "express-session" {
  interface SessionData {
    user: SafeUser;
    pendingMs365UserId?: string;
  }
}

const MemoryStoreSession = MemoryStore(session);

// Helper function to log user activities
async function logActivity(
  userId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  entityName?: string,
  details?: object,
  ipAddress?: string
) {
  try {
    await storage.createActivityLog({
      userId,
      action,
      entityType: entityType || null,
      entityId: entityId || null,
      entityName: entityName || null,
      details: details ? JSON.stringify(details) : null,
      ipAddress: ipAddress || null,
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

// NBS Exchange Rate Fetcher (XML format - ECB rates via NBS)
// Currency names mapping for display
const currencyNames: Record<string, string> = {
  USD: "americký dolár",
  JPY: "japonský jen",
  CZK: "česká koruna",
  DKK: "dánska koruna",
  GBP: "britská libra",
  HUF: "maďarský forint",
  PLN: "poľský zlotý",
  RON: "rumunský leu",
  SEK: "švédska koruna",
  CHF: "švajčiarsky frank",
  ISK: "islandská koruna",
  NOK: "nórska koruna",
  TRY: "turecká líra",
  AUD: "austrálsky dolár",
  BRL: "brazílsky real",
  CAD: "kanadský dolár",
  CNY: "čínsky juan",
  HKD: "hongkongský dolár",
  IDR: "indonézska rupia",
  ILS: "izraelský šekel",
  INR: "indická rupia",
  KRW: "juhokórejský won",
  MXN: "mexické peso",
  MYR: "malajzijský ringgit",
  NZD: "novozélandský dolár",
  PHP: "filipínske peso",
  SGD: "singapurský dolár",
  THB: "thajský baht",
  ZAR: "juhoafrický rand"
};

async function fetchNBSExchangeRates(): Promise<{ currencyCode: string; currencyName: string; rate: string; rateDate: string }[]> {
  try {
    // Build URL with current date
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD format
    const url = `https://nbs.sk/export/sk/exchange-rate/${dateStr}/xml`;
    
    console.log(`[ExchangeRates] Fetching from: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch NBS rates: ${response.status}`);
    }
    
    const xmlText = await response.text();
    const rates: { currencyCode: string; currencyName: string; rate: string; rateDate: string }[] = [];
    
    // Extract date from XML (format: <Cube time="2026-01-02">)
    const dateMatch = xmlText.match(/time="(\d{4}-\d{2}-\d{2})"/);
    const rateDate = dateMatch ? dateMatch[1] : dateStr;
    
    // Parse each Cube element with currency and rate
    // XML structure: <Cube currency="USD" rate="1,1721"/>
    const rateRegex = /<Cube\s+currency="([A-Z]{3})"\s+rate="([^"]+)"\s*\/>/g;
    
    let match;
    while ((match = rateRegex.exec(xmlText)) !== null) {
      const currencyCode = match[1].trim();
      // Rate value may have space as thousand separator and comma as decimal
      const rateValue = match[2].trim().replace(/\s/g, "").replace(",", ".");
      
      if (currencyCode && rateValue) {
        const currencyName = currencyNames[currencyCode] || currencyCode;
        
        rates.push({
          currencyCode,
          currencyName,
          rate: parseFloat(rateValue).toFixed(6),
          rateDate
        });
      }
    }
    
    console.log(`[ExchangeRates] Fetched ${rates.length} rates from NBS XML`);
    return rates;
  } catch (error) {
    console.error("[ExchangeRates] Failed to fetch NBS rates:", error);
    return [];
  }
}

// Schedule automatic exchange rate update at midnight
let exchangeRateInterval: NodeJS.Timeout | null = null;
let exchangeRateSchedulerInitialized = false;

function scheduleExchangeRateUpdate() {
  // Singleton guard - only initialize once
  if (exchangeRateSchedulerInitialized) {
    console.log("[ExchangeRates] Scheduler already initialized, skipping");
    return;
  }
  exchangeRateSchedulerInitialized = true;
  
  // Calculate milliseconds until next midnight
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  
  const msUntilMidnight = midnight.getTime() - now.getTime();
  
  console.log(`[ExchangeRates] Scheduled update in ${Math.round(msUntilMidnight / 1000 / 60)} minutes (at midnight)`);
  
  // Initial fetch if database is empty
  (async () => {
    const existingRates = await storage.getLatestExchangeRates();
    if (existingRates.length === 0) {
      console.log("[ExchangeRates] No rates in database, fetching initial rates...");
      const rates = await fetchNBSExchangeRates();
      if (rates.length > 0) {
        await storage.upsertExchangeRates(rates);
        console.log(`[ExchangeRates] Saved ${rates.length} initial rates`);
      }
    }
  })();
  
  // Set timeout for first midnight, then interval every 24 hours
  setTimeout(async () => {
    await performExchangeRateUpdate();
    
    // Then set up daily interval
    exchangeRateInterval = setInterval(async () => {
      await performExchangeRateUpdate();
    }, 24 * 60 * 60 * 1000); // Every 24 hours
  }, msUntilMidnight);
}

async function performExchangeRateUpdate() {
  console.log("[ExchangeRates] Performing scheduled update...");
  try {
    const rates = await fetchNBSExchangeRates();
    if (rates.length > 0) {
      await storage.upsertExchangeRates(rates);
      console.log(`[ExchangeRates] Updated ${rates.length} rates`);
    }
  } catch (error) {
    console.error("[ExchangeRates] Scheduled update failed:", error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize WebSocket notification service
  notificationService.initialize(httpServer);
  
  // Start email monitoring service for automatic sentiment analysis
  const { startEmailMonitoring } = await import("./lib/email-monitoring-service");
  startEmailMonitoring();

  // Trust proxy for production (nginx, cloudflare, etc.)
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "nexus-biolink-secret-key",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStoreSession({
        checkPeriod: 86400000, // prune expired entries every 24h
      }),
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // Serve uploaded files statically from DATA_ROOT
  // On Ubuntu: /data -> /var/www/indexus-crm/data
  // On Replit: /uploads -> ./uploads
  app.use("/data", express.static(DATA_ROOT));
  app.use("/uploads", express.static(DATA_ROOT)); // backward compatibility

  // Auth middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // Helper to check billing company country access
  const checkBillingCompanyAccess = async (req: Request, res: Response, billingDetailsId: string): Promise<boolean> => {
    const userCountries = req.session.user?.assignedCountries || [];
    const billingCompany = await storage.getBillingDetailsById(billingDetailsId);
    if (!billingCompany) {
      res.status(404).json({ error: "Billing company not found" });
      return false;
    }
    // Check if user has access to any of the billing company's countries
    const billingCountries = billingCompany.countryCodes?.length ? billingCompany.countryCodes : [billingCompany.countryCode];
    const hasAccess = billingCountries.some(country => userCountries.includes(country));
    if (!hasAccess) {
      res.status(403).json({ error: "Access denied" });
      return false;
    }
    return true;
  };

  // Auth routes
  
  // Check auth method for a user (step 1 of login flow)
  app.post("/api/auth/check-auth-method", async (req, res) => {
    try {
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }
      
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ error: "Používateľ neexistuje" });
      }
      
      if (!user.isActive) {
        return res.status(401).json({ error: "Účet je deaktivovaný" });
      }
      
      const authMethod = (user as any).authMethod || "classic";
      
      console.log(`[Auth] Checking auth method for user: ${username} -> ${authMethod}`);
      
      res.json({ 
        authMethod,
        userId: user.id,
        fullName: user.fullName
      });
    } catch (error) {
      console.error("Check auth method error:", error);
      res.status(500).json({ error: "Chyba pri overovaní používateľa" });
    }
  });
  
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      // First check if user exists and what auth method they use
      const userByUsername = await storage.getUserByUsername(username);
      
      if (userByUsername && (userByUsername as any).authMethod === "ms365") {
        // User needs to login via MS365 - return special response
        return res.status(200).json({ 
          requireMs365: true, 
          message: "Tento účet vyžaduje prihlásenie cez Microsoft 365",
          userId: userByUsername.id
        });
      }
      
      const user = await storage.validatePassword(username, password);
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      if (!user.isActive) {
        return res.status(401).json({ error: "Account is deactivated" });
      }
      
      const { passwordHash, ...safeUser } = user;
      req.session.user = safeUser;
      
      // Log login activity with auth method
      console.log(`[Auth] User logged in via classic auth: ${user.username} (${user.fullName})`);
      await logActivity(user.id, "login", "user", user.id, `${user.fullName} (classic auth)`, undefined, req.ip);
      
      res.json({ user: safeUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // MS365 login endpoint for users with authMethod = ms365
  app.post("/api/auth/login-ms365", async (req, res) => {
    try {
      const { username } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ error: "Používateľ neexistuje" });
      }
      
      if ((user as any).authMethod !== "ms365") {
        return res.status(400).json({ error: "Tento účet nevyžaduje Microsoft 365 prihlásenie" });
      }
      
      // Generate MS365 auth URL with user ID in state (session doesn't persist across OAuth redirects)
      const clientId = process.env.MS365_CLIENT_ID;
      const tenantId = process.env.MS365_TENANT_ID;
      
      if (!clientId || !tenantId) {
        return res.status(500).json({ error: "Microsoft 365 nie je nakonfigurovaný" });
      }
      
      // Always use HTTPS for redirect URI (Replit runs behind a proxy)
      const redirectUri = `https://${req.get("host")}/api/auth/microsoft/callback`;
      const scopes = ["openid", "profile", "email", "User.Read"];
      
      // Include user ID in state parameter (format: login:{userId})
      const stateParam = `login:${user.id}`;
      console.log("[MS365 Login] Generated state with userId:", stateParam);
      
      const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
        `client_id=${clientId}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes.join(" "))}&` +
        `response_mode=query&` +
        `state=${encodeURIComponent(stateParam)}`;
      
      res.json({ authUrl });
    } catch (error) {
      console.error("MS365 login error:", error);
      res.status(500).json({ error: "Chyba pri príprave prihlásenia cez Microsoft 365" });
    }
  });

  // NOTE: MS365 callback is handled by a unified handler later in this file
  // This ensures both login (state=login) and connection flows (PKCE state) work correctly

  app.post("/api/auth/logout", async (req, res) => {
    const userId = req.session.user?.id;
    const userName = req.session.user?.fullName;
    
    if (userId) {
      await logActivity(userId, "logout", "user", userId, userName, undefined, req.ip);
    }
    
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.user) {
      return res.json({ user: null });
    }
    res.json({ user: req.session.user });
  });

  // Users API (protected)
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { passwordHash, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", requireAuth, async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check for existing username
      const existingUsername = await storage.getUserByUsername(validatedData.username);
      if (existingUsername) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      // Check for existing email
      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      const user = await storage.createUser(validatedData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const validatedData = updateUserSchema.parse(req.body);
      
      // Check for duplicate username if updating
      if (validatedData.username) {
        const existing = await storage.getUserByUsername(validatedData.username);
        if (existing && existing.id !== req.params.id) {
          return res.status(400).json({ error: "Username already exists" });
        }
      }
      
      // Check for duplicate email if updating
      if (validatedData.email) {
        const existing = await storage.getUserByEmail(validatedData.email);
        if (existing && existing.id !== req.params.id) {
          return res.status(400).json({ error: "Email already exists" });
        }
      }
      
      const user = await storage.updateUser(req.params.id, validatedData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // User avatar upload
  app.post("/api/users/:id/avatar", requireAuth, uploadAvatar.single("avatar"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      const user = await storage.updateUser(req.params.id, { avatarUrl });
      
      if (!user) {
        // Delete the uploaded file if user not found
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: "User not found" });
      }
      
      // Update session if it's the current user
      if (req.session.user && req.session.user.id === req.params.id) {
        req.session.user = { ...req.session.user, avatarUrl } as SafeUser;
      }
      
      res.json({ avatarUrl, user });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      res.status(500).json({ error: "Failed to upload avatar" });
    }
  });

  // Email images upload API
  app.post("/api/email-images", requireAuth, uploadEmailImage.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const imageUrl = `/uploads/email-images/${req.file.filename}`;
      res.json({ 
        success: true, 
        url: imageUrl,
        filename: req.file.filename,
        originalName: req.file.originalname
      });
    } catch (error) {
      console.error("Error uploading email image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Get all email images
  app.get("/api/email-images", requireAuth, async (req, res) => {
    try {
      const emailImagesDir = path.join(process.cwd(), "uploads", "email-images");
      if (!fs.existsSync(emailImagesDir)) {
        fs.mkdirSync(emailImagesDir, { recursive: true });
        return res.json([]);
      }
      
      const files = fs.readdirSync(emailImagesDir);
      const images = files
        .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
        .map(file => ({
          filename: file,
          url: `/uploads/email-images/${file}`,
          createdAt: fs.statSync(path.join(emailImagesDir, file)).mtime
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json(images);
    } catch (error) {
      console.error("Error fetching email images:", error);
      res.status(500).json({ error: "Failed to fetch images" });
    }
  });

  // Customers API (protected)
  app.get("/api/customers", requireAuth, async (req, res) => {
    try {
      const customers = await storage.getAllCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      
      // Log activity
      await logActivity(
        req.session.user!.id,
        "create",
        "customer",
        customer.id,
        `${customer.firstName} ${customer.lastName}`,
        { country: customer.country },
        req.ip
      );
      
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating customer:", error);
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const partialSchema = insertCustomerSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      // Get old customer data for comparison
      const oldCustomer = await storage.getCustomer(req.params.id);
      
      const customer = await storage.updateCustomer(req.params.id, validatedData);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      // Build old/new values for changed fields
      const changedFields = Object.keys(validatedData);
      const oldValues: Record<string, any> = {};
      const newValues: Record<string, any> = {};
      
      changedFields.forEach(field => {
        if (oldCustomer && (oldCustomer as any)[field] !== (customer as any)[field]) {
          oldValues[field] = (oldCustomer as any)[field];
          newValues[field] = (customer as any)[field];
        }
      });
      
      // Check for status changes specifically
      const statusChanged = oldCustomer && oldCustomer.status !== customer.status;
      const clientStatusChanged = oldCustomer && oldCustomer.clientStatus !== customer.clientStatus;
      
      // Log activity with old/new values
      await logActivity(
        req.session.user!.id,
        "update",
        "customer",
        customer.id,
        `${customer.firstName} ${customer.lastName}`,
        { 
          changes: changedFields,
          oldValues,
          newValues,
          ...(statusChanged && { oldStatus: oldCustomer?.status, newStatus: customer.status }),
          ...(clientStatusChanged && { oldClientStatus: oldCustomer?.clientStatus, newClientStatus: customer.clientStatus }),
        },
        req.ip
      );
      
      // Trigger customer_updated automations
      triggerCustomerAutomations(customer, changedFields, oldCustomer, req.session?.user?.id).catch(err => 
        console.error("Customer automation trigger error:", err)
      );
      
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating customer:", error);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteCustomer(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  // GDPR Customer Consents API
  app.get("/api/customers/:id/consents", requireAuth, async (req, res) => {
    try {
      const consents = await storage.getCustomerConsents(req.params.id);
      res.json(consents);
    } catch (error) {
      console.error("Error fetching consents:", error);
      res.status(500).json({ error: "Failed to fetch consents" });
    }
  });

  app.post("/api/customers/:id/consents", requireAuth, async (req, res) => {
    try {
      const consentData = {
        ...req.body,
        customerId: req.params.id,
        grantedByUserId: req.session.user!.id,
        grantedAt: req.body.granted ? new Date() : null,
      };
      const consent = await storage.createCustomerConsent(consentData);
      
      // Log activity
      await logActivity(
        req.session.user!.id,
        req.body.granted ? "consent_granted" : "consent_created",
        "consent",
        consent.id,
        `${req.body.consentType} for customer ${req.params.id}`,
        { consentType: req.body.consentType, legalBasis: req.body.legalBasis, customerId: req.params.id },
        req.ip
      );
      
      res.status(201).json(consent);
    } catch (error) {
      console.error("Error creating consent:", error);
      res.status(500).json({ error: "Failed to create consent" });
    }
  });

  app.patch("/api/customers/:customerId/consents/:id", requireAuth, async (req, res) => {
    try {
      const consent = await storage.updateCustomerConsent(req.params.id, req.body);
      if (!consent) {
        return res.status(404).json({ error: "Consent not found" });
      }
      res.json(consent);
    } catch (error) {
      console.error("Error updating consent:", error);
      res.status(500).json({ error: "Failed to update consent" });
    }
  });

  app.post("/api/customers/:customerId/consents/:id/revoke", requireAuth, async (req, res) => {
    try {
      const consent = await storage.revokeCustomerConsent(
        req.params.id,
        req.session.user!.id,
        req.body.reason
      );
      if (!consent) {
        return res.status(404).json({ error: "Consent not found" });
      }
      
      // Log activity
      await logActivity(
        req.session.user!.id,
        "consent_revoked",
        "consent",
        consent.id,
        `${consent.consentType} for customer ${req.params.customerId}`,
        { consentType: consent.consentType, reason: req.body.reason, customerId: req.params.customerId },
        req.ip
      );
      
      res.json(consent);
    } catch (error) {
      console.error("Error revoking consent:", error);
      res.status(500).json({ error: "Failed to revoke consent" });
    }
  });

  // GDPR Data Export
  app.get("/api/customers/:id/gdpr-export", requireAuth, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      const exportData = await storage.getCustomerDataExport(req.params.id);
      
      // Log the export activity
      await logActivity(
        req.session.user!.id,
        "export",
        "customer",
        req.params.id,
        `${customer.firstName} ${customer.lastName}`,
        { exportType: "gdpr_data_export" },
        req.ip
      );
      
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting customer data:", error);
      res.status(500).json({ error: "Failed to export customer data" });
    }
  });

  // GDPR Access Log for Customer
  app.get("/api/customers/:id/access-logs", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getActivityLogsByEntity("customer", req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching access logs:", error);
      res.status(500).json({ error: "Failed to fetch access logs" });
    }
  });

  // Customer Email History - get all inbound/outbound emails linked to customer
  app.get("/api/customers/:id/emails", requireAuth, async (req, res) => {
    try {
      const emails = await storage.getCustomerEmailNotifications(req.params.id);
      res.json(emails);
    } catch (error) {
      console.error("Error fetching customer emails:", error);
      res.status(500).json({ error: "Failed to fetch customer emails" });
    }
  });

  // ============================================
  // Microsoft 365 / Entra ID Integration API
  // ============================================
  
  // PKCE store is now persisted to database (see storage.savePkceEntry/getPkceEntry)
  // Cleanup old PKCE codes (older than 10 minutes) - runs every minute
  setInterval(() => {
    storage.cleanupExpiredPkceEntries().catch(err => 
      console.error("Error cleaning up expired PKCE entries:", err)
    );
  }, 60000);
  
  // Get MS365 configuration status
  app.get("/api/ms365/status", requireAuth, async (req, res) => {
    try {
      const { getConfigStatus, isConfigured } = await import("./lib/ms365");
      const status = getConfigStatus();
      res.json(status);
    } catch (error) {
      console.error("Error fetching MS365 status:", error);
      res.status(500).json({ error: "Failed to fetch MS365 status", configured: false });
    }
  });
  
  // Initiate OAuth flow with Microsoft
  app.get("/api/auth/microsoft", requireAuth, async (req, res) => {
    try {
      const { getAuthorizationUrl, isConfigured } = await import("./lib/ms365");
      
      if (!isConfigured()) {
        return res.status(400).json({ error: "MS365 integration not configured" });
      }
      
      // Check if admin consent is requested
      const useAdminConsent = req.query.admin_consent === 'true';
      const userId = req.session.user!.id;
      
      const { url, codeVerifier, state } = await getAuthorizationUrl(undefined, useAdminConsent);
      
      // Store PKCE verifier in database (persisted across server restarts)
      await storage.savePkceEntry(state, codeVerifier, 'user', userId);
      
      // Also store in session for security
      (req.session as any).ms365State = state;
      
      res.json({ authUrl: url, state });
    } catch (error) {
      console.error("Error initiating MS365 auth:", error);
      res.status(500).json({ error: "Failed to initiate Microsoft authentication" });
    }
  });
  
  // OAuth callback from Microsoft (handles login, user connection, and system connections)
  app.get("/api/auth/microsoft/callback", async (req, res) => {
    console.log("[MS365 Callback] Request received with query:", JSON.stringify(req.query));
    try {
      const { code, state, error: authError, error_description } = req.query;
      
      if (authError) {
        console.error("MS365 auth error:", authError, error_description);
        return res.redirect(`/?ms365_error=${encodeURIComponent(String(error_description || authError))}`);
      }
      
      if (!code) {
        return res.redirect("/?ms365_error=Missing%20authorization%20code");
      }
      
      const stateStr = String(state || "");
      console.log("[MS365 Callback] Processing state:", stateStr);
      
      // Handle login flow (state starts with "login:") - for users with authMethod = ms365
      if (stateStr.startsWith("login:")) {
        console.log("[MS365 Callback] Login flow detected");
        
        // Extract user ID from state parameter (format: login:{userId})
        const pendingUserId = stateStr.substring(6); // Remove "login:" prefix
        console.log("[MS365 Callback] Extracted userId from state:", pendingUserId);
        
        if (!pendingUserId) {
          console.log("[MS365 Callback] ERROR: userId not found in state");
          return res.redirect("/?error=invalid_state");
        }
        
        // Exchange code for token
        const clientId = process.env.MS365_CLIENT_ID!;
        const clientSecret = process.env.MS365_CLIENT_SECRET!;
        const tenantId = process.env.MS365_TENANT_ID!;
        const redirectUri = `https://${req.get("host")}/api/auth/microsoft/callback`;
        
        const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: String(code),
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
            scope: "openid profile email User.Read",
          }),
        });
        
        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error("Token exchange failed:", errorText);
          return res.redirect("/?error=token_exchange_failed");
        }
        
        const tokens = await tokenResponse.json();
        
        // Get user info from Microsoft Graph
        const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        
        if (!graphResponse.ok) {
          console.error("Graph API failed");
          return res.redirect("/?error=graph_api_failed");
        }
        
        const msUser = await graphResponse.json();
        
        // Verify the MS365 email matches the user's email
        const user = await storage.getUser(pendingUserId);
        if (!user) {
          return res.redirect("/?error=user_not_found");
        }
        
        if (!user.isActive) {
          return res.redirect("/?error=account_deactivated");
        }
        
        // Verify email matches (case insensitive)
        const msEmail = (msUser.mail || msUser.userPrincipalName || "").toLowerCase();
        const userEmail = user.email.toLowerCase();
        
        if (msEmail !== userEmail && !msEmail.includes(userEmail.split("@")[0])) {
          console.error(`Email mismatch: MS365=${msEmail}, CRM=${userEmail}`);
          return res.redirect("/?error=email_mismatch");
        }
        
        // Login successful - set session
        const { passwordHash, ...safeUser } = user;
        req.session.user = safeUser;
        
        // Log login activity with MS365 auth method
        console.log(`[Auth] User logged in via MS365: ${user.username} (${user.fullName})`);
        await logActivity(user.id, "login", "user", user.id, `${user.fullName} (MS365 auth)`, JSON.stringify({ method: "ms365", msEmail }), req.ip);
        
        // Save session explicitly before redirect
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error("[MS365 Callback] Session save error:", err);
              reject(err);
            } else {
              console.log("[MS365 Callback] Session saved successfully, redirecting...");
              resolve();
            }
          });
        });
        
        return res.redirect("/");
      }
      
      // For non-login flows, we need a state parameter
      if (!stateStr) {
        return res.redirect("/?ms365_error=Missing%20state%20parameter");
      }
      
      // Get PKCE data from database (persisted across server restarts)
      const pkceData = await storage.getPkceEntry(stateStr);
      console.log("[MS365 Callback] PKCE data found:", pkceData ? `type=${pkceData.type}, countryCode=${pkceData.countryCode}` : "null");
      
      if (!pkceData) {
        console.error("MS365 auth error: PKCE entry not found or expired for state:", stateStr);
        return res.redirect("/?ms365_error=Session%20expired%20-%20please%20try%20again");
      }
      
      // Check if this is a system connection
      if (pkceData.type === 'system' && pkceData.countryCode) {
        // Handle system email connection
        const { acquireTokenByCode, getUserProfile } = await import("./lib/ms365");
        const { encryptTokenWithMarker } = await import("./lib/token-crypto");
        
        const tokenResult = await acquireTokenByCode(String(code), pkceData.codeVerifier);
        await storage.deletePkceEntry(stateStr);
        
        const profile = await getUserProfile(tokenResult.accessToken);
        const countryCode = pkceData.countryCode;
        const userId = pkceData.userId;
        
        const existing = await storage.getSystemMs365Connection(countryCode);
        const connectionData = {
          countryCode,
          accessToken: encryptTokenWithMarker(tokenResult.accessToken),
          refreshToken: tokenResult.refreshToken ? encryptTokenWithMarker(tokenResult.refreshToken) : null,
          tokenExpiresAt: tokenResult.expiresOn,
          accountId: null,
          email: profile.mail || profile.userPrincipalName,
          displayName: profile.displayName,
          isConnected: true,
          connectedByUserId: userId,
        };
        
        if (existing) {
          await storage.updateSystemMs365Connection(countryCode, connectionData);
        } else {
          await storage.createSystemMs365Connection(connectionData);
        }
        
        console.log(`[MS365] System email connected for country ${countryCode}: ${profile.mail || profile.userPrincipalName}`);
        return res.redirect(`/configurator?tab=countries&subtab=system-settings&ms365_connected=true&country=${countryCode}`);
      }
      
      // Handle regular user connection
      // SECURITY: Validate state matches the one stored in user's session (CSRF protection)
      const sessionState = (req.session as any)?.ms365State;
      if (!sessionState || sessionState !== stateStr) {
        console.error("MS365 auth error: State mismatch - possible CSRF attack");
        return res.redirect("/?ms365_error=Invalid%20session%20state%20-%20please%20try%20again");
      }
      
      // PKCE verifier already retrieved from database above
      const { acquireTokenByCode, getUserProfile } = await import("./lib/ms365");
      
      // Exchange code for tokens
      const tokenResult = await acquireTokenByCode(String(code), pkceData.codeVerifier);
      
      // Clean up PKCE store and session state
      await storage.deletePkceEntry(stateStr);
      delete (req.session as any).ms365State;
      
      // Get user profile from Microsoft Graph
      const profile = await getUserProfile(tokenResult.accessToken);
      
      // Store tokens in session
      if (req.session) {
        (req.session as any).ms365 = {
          accessToken: tokenResult.accessToken,
          refreshToken: (tokenResult as any).refreshToken,
          expiresOn: tokenResult.expiresOn,
          expiresAt: tokenResult.expiresOn?.getTime(),
          account: tokenResult.account,
          profile,
          connectedAt: new Date(),
        };
        
        // Also save to database if user is logged in (with encrypted tokens)
        const crmUser = req.session.user;
        if (crmUser) {
          try {
            const { encryptTokenWithMarker } = await import("./lib/token-crypto");
            const existing = await storage.getUserMs365Connection(crmUser.id);
            
            // Encrypt tokens before storing (with ENC: prefix for unambiguous identification)
            const connectionData = {
              userId: crmUser.id,
              accessToken: encryptTokenWithMarker(tokenResult.accessToken),
              refreshToken: tokenResult.refreshToken ? encryptTokenWithMarker(tokenResult.refreshToken) : null,
              tokenExpiresAt: tokenResult.expiresOn,
              accountId: null, // Not using MSAL account anymore
              email: profile.mail || profile.userPrincipalName,
              displayName: profile.displayName,
              isConnected: true,
              lastSyncAt: new Date(),
            };
            
            if (existing) {
              await storage.updateUserMs365Connection(crmUser.id, connectionData);
            } else {
              await storage.createUserMs365Connection(connectionData);
            }
            
            console.log(`[MS365] Connection saved for user ${crmUser.username}, refresh token: ${tokenResult.refreshToken ? 'present' : 'missing'}`);
          } catch (dbError) {
            console.error("Error saving MS365 connection to database:", dbError);
          }
        }
      }
      
      // Redirect back to app with success
      res.redirect("/?ms365_connected=true");
    } catch (error) {
      console.error("Error in MS365 callback:", error);
      res.redirect(`/?ms365_error=${encodeURIComponent("Authentication failed")}`);
    }
  });
  
  // Front-channel logout from Microsoft
  app.get("/api/auth/microsoft/logout", (req, res) => {
    try {
      // Clear MS365 session data
      if (req.session) {
        delete (req.session as any).ms365;
        delete (req.session as any).ms365State;
      }
      res.status(200).send("Logged out from Microsoft 365");
    } catch (error) {
      console.error("Error in MS365 logout:", error);
      res.status(500).send("Logout error");
    }
  });
  
  // Disconnect MS365 (clear session)
  app.post("/api/ms365/disconnect", requireAuth, async (req, res) => {
    try {
      if (req.session) {
        delete (req.session as any).ms365;
        delete (req.session as any).ms365State;
      }
      
      const { getLogoutUrl } = await import("./lib/ms365");
      res.json({ 
        message: "Disconnected from Microsoft 365",
        logoutUrl: getLogoutUrl() 
      });
    } catch (error) {
      console.error("Error disconnecting MS365:", error);
      res.status(500).json({ error: "Failed to disconnect" });
    }
  });
  
  // Get current MS365 connection status
  app.get("/api/ms365/connection", requireAuth, async (req, res) => {
    try {
      const ms365Session = (req.session as any)?.ms365;
      
      if (!ms365Session) {
        return res.json({ connected: false });
      }
      
      // Check if token is expired
      const expiresOn = new Date(ms365Session.expiresOn);
      const isExpired = expiresOn < new Date();
      
      res.json({
        connected: !isExpired,
        profile: ms365Session.profile,
        connectedAt: ms365Session.connectedAt,
        expiresOn: ms365Session.expiresOn,
        isExpired,
      });
    } catch (error) {
      console.error("Error fetching MS365 connection:", error);
      res.status(500).json({ error: "Failed to fetch connection status" });
    }
  });
  
  // Test MS365 connection - get user profile
  app.get("/api/ms365/me", requireAuth, async (req, res) => {
    try {
      const ms365Session = (req.session as any)?.ms365;
      
      if (!ms365Session?.accessToken) {
        return res.status(401).json({ error: "Not connected to Microsoft 365" });
      }
      
      const { getUserProfile } = await import("./lib/ms365");
      const profile = await getUserProfile(ms365Session.accessToken);
      
      res.json(profile);
    } catch (error) {
      console.error("Error fetching MS365 profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });
  
  // Get emails from MS365
  app.get("/api/ms365/emails", requireAuth, async (req, res) => {
    try {
      const ms365Session = (req.session as any)?.ms365;
      
      if (!ms365Session?.accessToken) {
        return res.status(401).json({ error: "Not connected to Microsoft 365" });
      }
      
      const top = parseInt(req.query.top as string) || 10;
      const { getUserEmails } = await import("./lib/ms365");
      const emails = await getUserEmails(ms365Session.accessToken, top);
      
      res.json(emails);
    } catch (error) {
      console.error("Error fetching MS365 emails:", error);
      res.status(500).json({ error: "Failed to fetch emails" });
    }
  });
  
  // Send email via MS365
  app.post("/api/ms365/send-email", requireAuth, async (req, res) => {
    try {
      const ms365Session = (req.session as any)?.ms365;
      
      if (!ms365Session?.accessToken) {
        return res.status(401).json({ error: "Not connected to Microsoft 365" });
      }
      
      const { to, subject, body, isHtml } = req.body;
      
      if (!to || !subject || !body) {
        return res.status(400).json({ error: "Missing required fields: to, subject, body" });
      }
      
      const { sendEmail } = await import("./lib/ms365");
      await sendEmail(ms365Session.accessToken, Array.isArray(to) ? to : [to], subject, body, isHtml !== false);
      
      res.json({ message: "Email sent successfully" });
    } catch (error) {
      console.error("Error sending MS365 email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });
  
  // Send email from shared mailbox via MS365 (uses user's stored connection with token refresh)
  app.post("/api/ms365/send-email-from-mailbox", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      
      // Get user's MS365 connection from database
      const ms365Connection = await storage.getUserMs365Connection(userId);
      
      if (!ms365Connection || !ms365Connection.isConnected) {
        return res.status(401).json({ error: "Not connected to Microsoft 365. Please connect your MS365 account first." });
      }
      
      // Decrypt tokens for use (handles both encrypted and legacy plaintext tokens)
      const { decryptTokenSafe } = await import("./lib/token-crypto");
      let accessToken: string;
      let refreshToken: string | null;
      
      try {
        accessToken = decryptTokenSafe(ms365Connection.accessToken);
        refreshToken = ms365Connection.refreshToken ? decryptTokenSafe(ms365Connection.refreshToken) : null;
      } catch (decryptError) {
        console.error("[MS365] Token decryption failed:", decryptError);
        await storage.updateUserMs365Connection(userId, { isConnected: false });
        return res.status(401).json({ 
          error: "MS365 session corrupted. Please reconnect your Microsoft 365 account.",
          requiresReauth: true
        });
      }
      
      // Get valid access token, refreshing if necessary
      const { getValidAccessToken } = await import("./lib/ms365");
      const tokenResult = await getValidAccessToken(
        accessToken,
        ms365Connection.tokenExpiresAt,
        refreshToken
      );
      
      if (!tokenResult) {
        // Token expired and cannot be refreshed - user needs to re-authenticate
        await storage.updateUserMs365Connection(userId, { isConnected: false });
        return res.status(401).json({ 
          error: "MS365 session expired. Please reconnect your Microsoft 365 account.",
          requiresReauth: true
        });
      }
      
      // Update stored token if it was refreshed (encrypt before storing)
      if (tokenResult.refreshed) {
        const { encryptTokenWithMarker } = await import("./lib/token-crypto");
        const updateData: any = {
          accessToken: encryptTokenWithMarker(tokenResult.accessToken),
          tokenExpiresAt: tokenResult.expiresOn,
          lastSyncAt: new Date(),
        };
        
        // Only update refresh token if a new one was returned, otherwise preserve existing
        if (tokenResult.refreshToken) {
          updateData.refreshToken = encryptTokenWithMarker(tokenResult.refreshToken);
        }
        
        await storage.updateUserMs365Connection(userId, updateData);
      }
      
      const { to, cc, subject, body, isHtml, mailboxId, attachments, customerId } = req.body;
      
      if (!to || !subject || !body) {
        return res.status(400).json({ error: "Missing required fields: to, subject, body" });
      }
      
      // Determine which mailbox to use
      // mailboxId = null means use personal mailbox (explicit choice from frontend)
      // mailboxId = undefined means use default mailbox behavior
      // mailboxId = string means use specific shared mailbox
      let sharedMailboxEmail: string | null = null;
      
      if (mailboxId === null) {
        // Explicit personal mailbox - do not use shared mailbox
        sharedMailboxEmail = null;
      } else if (mailboxId) {
        // Specific shared mailbox requested
        const mailbox = await storage.getUserMs365SharedMailbox(mailboxId);
        if (!mailbox || mailbox.userId !== userId) {
          return res.status(400).json({ error: "Invalid mailbox" });
        }
        sharedMailboxEmail = mailbox.email;
      } else {
        // mailboxId is undefined - use personal mailbox by default (safest choice)
        sharedMailboxEmail = null;
      }
      
      const toArray = Array.isArray(to) ? to : [to];
      const ccArray = cc ? (Array.isArray(cc) ? cc : [cc]) : undefined;
      const fromEmail = sharedMailboxEmail || ms365Connection.email;
      
      const { sendEmail, sendEmailFromSharedMailbox } = await import("./lib/ms365");
      
      if (sharedMailboxEmail) {
        // Send from shared mailbox
        await sendEmailFromSharedMailbox(
          tokenResult.accessToken,
          sharedMailboxEmail,
          toArray,
          subject,
          body,
          isHtml !== false,
          ccArray,
          attachments
        );
      } else {
        // Send from user's own mailbox
        await sendEmail(tokenResult.accessToken, toArray, subject, body, isHtml !== false);
      }
      
      // Log email to customer history if customerId is provided
      let messageId: string | undefined;
      if (customerId) {
        try {
          // Save to communication_messages table
          const message = await storage.createCommunicationMessage({
            customerId,
            userId,
            type: "email",
            subject,
            content: body,
            status: "sent",
            recipients: toArray.join(", "),
            metadata: JSON.stringify({
              from: fromEmail,
              cc: ccArray?.join(", ") || null,
              isHtml: isHtml !== false,
              sentVia: "ms365",
              sharedMailbox: sharedMailboxEmail || null,
            }),
          });
          messageId = message.id;
          
          // Also log to activity logs
          await storage.createActivityLog({
            userId,
            action: "email_sent",
            entityType: "customer",
            entityId: customerId,
            entityName: toArray[0],
            details: JSON.stringify({
              messageId: message.id,
              subject,
              to: toArray,
              cc: ccArray || [],
              from: fromEmail,
            }),
          });
        } catch (logError) {
          console.error("[MS365] Failed to log email to customer history:", logError);
          // Don't fail the request - email was already sent
        }
      }
      
      res.json({ 
        message: sharedMailboxEmail 
          ? "Email sent successfully from shared mailbox" 
          : "Email sent successfully from your mailbox", 
        from: fromEmail,
        messageId,
      });
    } catch (error: any) {
      console.error("Error sending MS365 email from mailbox:", error);
      
      // Check for specific Graph API errors and provide better messages
      if (error.code === 'ErrorSendAsDenied') {
        return res.status(403).json({ 
          error: "Nemáte oprávnenie odosielať emaily z tejto zdieľanej schránky. Požiadajte administrátora Exchange o nastavenie oprávnenia 'Send As' alebo 'Send on Behalf'.",
          code: 'SEND_AS_DENIED'
        });
      }
      
      if (error.code === 'ErrorItemNotFound' || error.statusCode === 404) {
        return res.status(404).json({ 
          error: "Schránka nebola nájdená. Skontrolujte emailovú adresu zdieľanej schránky.",
          code: 'MAILBOX_NOT_FOUND'
        });
      }
      
      res.status(500).json({ error: "Nepodarilo sa odoslať email. Skúste to znova." });
    }
  });
  
  // Get calendar events from MS365
  app.get("/api/ms365/calendar", requireAuth, async (req, res) => {
    try {
      const ms365Session = (req.session as any)?.ms365;
      
      if (!ms365Session?.accessToken) {
        return res.status(401).json({ error: "Not connected to Microsoft 365" });
      }
      
      const startDate = req.query.start ? new Date(req.query.start as string) : new Date();
      const endDate = req.query.end ? new Date(req.query.end as string) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      const { getCalendarEvents } = await import("./lib/ms365");
      const events = await getCalendarEvents(ms365Session.accessToken, startDate, endDate);
      
      res.json(events);
    } catch (error) {
      console.error("Error fetching MS365 calendar:", error);
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  });
  
  // Get contacts from MS365
  app.get("/api/ms365/contacts", requireAuth, async (req, res) => {
    try {
      const ms365Session = (req.session as any)?.ms365;
      
      if (!ms365Session?.accessToken) {
        return res.status(401).json({ error: "Not connected to Microsoft 365" });
      }
      
      const top = parseInt(req.query.top as string) || 50;
      const { getContacts } = await import("./lib/ms365");
      const contacts = await getContacts(ms365Session.accessToken, top);
      
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching MS365 contacts:", error);
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  // ============================================
  // User MS365 Connections API
  // ============================================
  
  // Get current user's MS365 connection
  app.get("/api/users/:userId/ms365-connection", requireAuth, async (req, res) => {
    try {
      const connection = await storage.getUserMs365Connection(req.params.userId);
      if (connection) {
        // Don't expose tokens to client
        const { accessToken, refreshToken, ...safeConnection } = connection;
        res.json({ ...safeConnection, hasTokens: !!accessToken });
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Error fetching user MS365 connection:", error);
      res.status(500).json({ error: "Failed to fetch MS365 connection" });
    }
  });

  // Connect user to MS365 (save tokens after OAuth)
  app.post("/api/users/:userId/ms365-connection", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const ms365Session = (req.session as any)?.ms365;
      
      if (!ms365Session?.accessToken) {
        return res.status(400).json({ error: "No active MS365 session. Please authenticate first." });
      }
      
      // Get user info from MS365
      const { getUserProfile } = await import("./lib/ms365");
      const profile = await getUserProfile(ms365Session.accessToken);
      
      // Check if connection exists
      const existing = await storage.getUserMs365Connection(userId);
      
      if (existing) {
        // Update existing connection
        const updated = await storage.updateUserMs365Connection(userId, {
          accessToken: ms365Session.accessToken,
          refreshToken: ms365Session.refreshToken,
          tokenExpiresAt: ms365Session.expiresAt ? new Date(ms365Session.expiresAt) : null,
          email: profile.mail || profile.userPrincipalName,
          displayName: profile.displayName,
          isConnected: true,
          lastSyncAt: new Date(),
        });
        const { accessToken, refreshToken, ...safeConnection } = updated!;
        res.json(safeConnection);
      } else {
        // Create new connection
        const connection = await storage.createUserMs365Connection({
          userId,
          accessToken: ms365Session.accessToken,
          refreshToken: ms365Session.refreshToken,
          tokenExpiresAt: ms365Session.expiresAt ? new Date(ms365Session.expiresAt) : null,
          email: profile.mail || profile.userPrincipalName,
          displayName: profile.displayName,
          isConnected: true,
          lastSyncAt: new Date(),
        });
        const { accessToken, refreshToken, ...safeConnection } = connection;
        res.json(safeConnection);
      }
    } catch (error) {
      console.error("Error saving user MS365 connection:", error);
      res.status(500).json({ error: "Failed to save MS365 connection" });
    }
  });

  // Disconnect user from MS365
  app.delete("/api/users/:userId/ms365-connection", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Also delete all shared mailboxes
      const mailboxes = await storage.getUserMs365SharedMailboxes(userId);
      for (const mb of mailboxes) {
        await storage.deleteUserMs365SharedMailbox(mb.id);
      }
      
      await storage.deleteUserMs365Connection(userId);
      
      // Clear session if it's the current user
      if (req.session.user?.id === userId) {
        delete (req.session as any).ms365;
      }
      
      res.json({ message: "Disconnected from MS365" });
    } catch (error) {
      console.error("Error disconnecting user MS365:", error);
      res.status(500).json({ error: "Failed to disconnect from MS365" });
    }
  });

  // ============================================
  // User MS365 Shared Mailboxes API
  // ============================================
  
  // Get user's shared mailboxes
  app.get("/api/users/:userId/ms365-shared-mailboxes", requireAuth, async (req, res) => {
    try {
      const mailboxes = await storage.getUserMs365SharedMailboxes(req.params.userId);
      res.json(mailboxes);
    } catch (error) {
      console.error("Error fetching shared mailboxes:", error);
      res.status(500).json({ error: "Failed to fetch shared mailboxes" });
    }
  });

  // Add a shared mailbox
  app.post("/api/users/:userId/ms365-shared-mailboxes", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { email, displayName, isDefault } = req.body;
      
      // Get user's MS365 connection
      const connection = await storage.getUserMs365Connection(userId);
      if (!connection) {
        return res.status(400).json({ error: "User must be connected to MS365 first" });
      }
      
      const mailbox = await storage.createUserMs365SharedMailbox({
        connectionId: connection.id,
        userId,
        email,
        displayName,
        isDefault: isDefault || false,
        isActive: true,
      });
      
      res.status(201).json(mailbox);
    } catch (error) {
      console.error("Error creating shared mailbox:", error);
      res.status(500).json({ error: "Failed to add shared mailbox" });
    }
  });

  // Update a shared mailbox
  app.patch("/api/users/:userId/ms365-shared-mailboxes/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const mailbox = await storage.updateUserMs365SharedMailbox(id, req.body);
      if (!mailbox) {
        return res.status(404).json({ error: "Shared mailbox not found" });
      }
      res.json(mailbox);
    } catch (error) {
      console.error("Error updating shared mailbox:", error);
      res.status(500).json({ error: "Failed to update shared mailbox" });
    }
  });

  // Delete a shared mailbox
  app.delete("/api/users/:userId/ms365-shared-mailboxes/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteUserMs365SharedMailbox(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Shared mailbox not found" });
      }
      res.json({ message: "Shared mailbox deleted" });
    } catch (error) {
      console.error("Error deleting shared mailbox:", error);
      res.status(500).json({ error: "Failed to delete shared mailbox" });
    }
  });

  // Set default shared mailbox
  app.post("/api/users/:userId/ms365-shared-mailboxes/:id/set-default", requireAuth, async (req, res) => {
    try {
      const { userId, id } = req.params;
      const mailbox = await storage.setDefaultUserMs365SharedMailbox(userId, id);
      if (!mailbox) {
        return res.status(404).json({ error: "Shared mailbox not found" });
      }
      res.json(mailbox);
    } catch (error) {
      console.error("Error setting default mailbox:", error);
      res.status(500).json({ error: "Failed to set default mailbox" });
    }
  });

  // Get all available mailboxes for sending (user's own + shared)
  app.get("/api/users/:userId/ms365-available-mailboxes", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const connection = await storage.getUserMs365Connection(userId);
      const sharedMailboxes = await storage.getUserMs365SharedMailboxes(userId);
      
      const mailboxes = [];
      
      // Add user's own mailbox if connected
      if (connection && connection.isConnected) {
        mailboxes.push({
          id: 'personal',
          email: connection.email,
          displayName: connection.displayName || connection.email,
          type: 'personal',
          isDefault: sharedMailboxes.length === 0 || !sharedMailboxes.some(m => m.isDefault),
        });
      }
      
      // Add shared mailboxes
      for (const mb of sharedMailboxes) {
        if (mb.isActive) {
          mailboxes.push({
            id: mb.id,
            email: mb.email,
            displayName: mb.displayName,
            type: 'shared',
            isDefault: mb.isDefault,
          });
        }
      }
      
      res.json(mailboxes);
    } catch (error) {
      console.error("Error fetching available mailboxes:", error);
      res.status(500).json({ error: "Failed to fetch available mailboxes" });
    }
  });

  // Get unread email counts for all user's mailboxes
  app.get("/api/users/:userId/ms365-unread-counts", requireAuth, async (req, res) => {
    try {
      const userId = req.params.userId;
      const ms365Connection = await storage.getUserMs365Connection(userId);
      
      if (!ms365Connection || !ms365Connection.isConnected) {
        return res.json({ connected: false, counts: [] });
      }
      
      const { decryptTokenSafe } = await import("./lib/token-crypto");
      let accessToken: string;
      let refreshToken: string | null;
      
      try {
        accessToken = decryptTokenSafe(ms365Connection.accessToken);
        refreshToken = ms365Connection.refreshToken ? decryptTokenSafe(ms365Connection.refreshToken) : null;
      } catch (decryptError) {
        console.error("[MS365] Token decryption failed:", decryptError);
        return res.json({ connected: false, counts: [], error: "Token decryption failed" });
      }
      
      const { getValidAccessToken, getAllMailboxUnreadCounts } = await import("./lib/ms365");
      const tokenResult = await getValidAccessToken(accessToken, ms365Connection.tokenExpiresAt, refreshToken);
      
      if (!tokenResult || !tokenResult.accessToken) {
        return res.json({ connected: false, counts: [], requiresReauth: true });
      }
      
      if (tokenResult.refreshed) {
        const { encryptTokenWithMarker } = await import("./lib/token-crypto");
        const updateData: any = {
          accessToken: encryptTokenWithMarker(tokenResult.accessToken),
          tokenExpiresAt: tokenResult.expiresOn,
          lastSyncAt: new Date(),
        };
        if (tokenResult.refreshToken) {
          updateData.refreshToken = encryptTokenWithMarker(tokenResult.refreshToken);
        }
        await storage.updateUserMs365Connection(userId, updateData);
      }
      
      const sharedMailboxes = await storage.getUserMs365SharedMailboxes(userId);
      const sharedEmails = sharedMailboxes.filter(m => m.isActive).map(m => m.email);
      
      const counts = await getAllMailboxUnreadCounts(tokenResult.accessToken, sharedEmails);
      // Only sum accessible mailboxes with positive counts
      const totalUnread = counts.reduce((sum, c) => sum + (c.accessible && c.unreadCount > 0 ? c.unreadCount : 0), 0);
      
      res.json({ 
        connected: true, 
        counts,
        totalUnread,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching unread counts:", error);
      res.status(500).json({ error: "Failed to fetch unread counts" });
    }
  });

  // Get recent emails from a mailbox
  app.get("/api/users/:userId/ms365-recent-emails", requireAuth, async (req, res) => {
    try {
      const userId = req.params.userId;
      const mailboxEmail = req.query.mailbox as string | undefined;
      const top = parseInt(req.query.top as string) || 10;
      const onlyUnread = req.query.unread === "true";
      
      const ms365Connection = await storage.getUserMs365Connection(userId);
      
      if (!ms365Connection || !ms365Connection.isConnected) {
        return res.json({ connected: false, emails: [] });
      }
      
      const { decryptTokenSafe } = await import("./lib/token-crypto");
      let accessToken: string;
      let refreshToken: string | null;
      
      try {
        accessToken = decryptTokenSafe(ms365Connection.accessToken);
        refreshToken = ms365Connection.refreshToken ? decryptTokenSafe(ms365Connection.refreshToken) : null;
      } catch (decryptError) {
        return res.json({ connected: false, emails: [], error: "Token decryption failed" });
      }
      
      const { getValidAccessToken, getRecentEmails } = await import("./lib/ms365");
      const tokenResult = await getValidAccessToken(accessToken, ms365Connection.tokenExpiresAt, refreshToken);
      
      if (!tokenResult || !tokenResult.accessToken) {
        return res.json({ connected: false, emails: [], requiresReauth: true });
      }
      
      if (tokenResult.refreshed) {
        const { encryptTokenWithMarker } = await import("./lib/token-crypto");
        const updateData: any = {
          accessToken: encryptTokenWithMarker(tokenResult.accessToken),
          tokenExpiresAt: tokenResult.expiresOn,
          lastSyncAt: new Date(),
        };
        if (tokenResult.refreshToken) {
          updateData.refreshToken = encryptTokenWithMarker(tokenResult.refreshToken);
        }
        await storage.updateUserMs365Connection(userId, updateData);
      }
      
      const emails = await getRecentEmails(
        tokenResult.accessToken,
        mailboxEmail === "personal" ? undefined : mailboxEmail,
        top,
        onlyUnread
      );
      
      res.json({ 
        connected: true, 
        emails,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching recent emails:", error);
      res.status(500).json({ error: "Failed to fetch recent emails" });
    }
  });

  // =====================================
  // EMAIL CLIENT API
  // =====================================

  // Get mail folders
  app.get("/api/users/:userId/ms365-folders", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const mailboxEmail = req.query.mailbox as string | undefined;
      
      const ms365Connection = await storage.getUserMs365Connection(userId);
      if (!ms365Connection || !ms365Connection.isConnected) {
        return res.json({ connected: false, folders: [] });
      }
      
      const { decryptTokenSafe } = await import("./lib/token-crypto");
      const { getValidAccessToken, getMailFolders, getInboxFolderId } = await import("./lib/ms365");
      
      let accessToken: string;
      let refreshToken: string | null;
      
      try {
        accessToken = decryptTokenSafe(ms365Connection.accessToken);
        refreshToken = ms365Connection.refreshToken ? decryptTokenSafe(ms365Connection.refreshToken) : null;
      } catch {
        return res.json({ connected: false, folders: [] });
      }
      
      const tokenResult = await getValidAccessToken(accessToken, ms365Connection.tokenExpiresAt, refreshToken);
      if (!tokenResult?.accessToken) {
        return res.json({ connected: false, folders: [], requiresReauth: true });
      }
      
      const actualMailbox = mailboxEmail === "personal" ? undefined : mailboxEmail;
      
      // Fetch folders and inbox ID in parallel
      const [folders, inboxId] = await Promise.all([
        getMailFolders(tokenResult.accessToken, actualMailbox),
        getInboxFolderId(tokenResult.accessToken, actualMailbox)
      ]);
      
      res.json({ 
        connected: true, 
        folders,
        inboxId
      });
    } catch (error) {
      console.error("Error fetching mail folders:", error);
      res.status(500).json({ error: "Failed to fetch mail folders" });
    }
  });

  // Get emails from folder
  app.get("/api/users/:userId/ms365-folder-messages/:folderId", requireAuth, async (req, res) => {
    try {
      const { userId, folderId } = req.params;
      const mailboxEmail = req.query.mailbox as string | undefined;
      const top = parseInt(req.query.top as string) || 50;
      const skip = parseInt(req.query.skip as string) || 0;
      
      const ms365Connection = await storage.getUserMs365Connection(userId);
      if (!ms365Connection || !ms365Connection.isConnected) {
        return res.json({ connected: false, emails: [], totalCount: 0 });
      }
      
      const { decryptTokenSafe } = await import("./lib/token-crypto");
      const { getValidAccessToken, getMailFolderMessages } = await import("./lib/ms365");
      
      let accessToken: string;
      let refreshToken: string | null;
      
      try {
        accessToken = decryptTokenSafe(ms365Connection.accessToken);
        refreshToken = ms365Connection.refreshToken ? decryptTokenSafe(ms365Connection.refreshToken) : null;
      } catch {
        return res.json({ connected: false, emails: [], totalCount: 0 });
      }
      
      const tokenResult = await getValidAccessToken(accessToken, ms365Connection.tokenExpiresAt, refreshToken);
      if (!tokenResult?.accessToken) {
        return res.json({ connected: false, emails: [], totalCount: 0, requiresReauth: true });
      }
      
      const result = await getMailFolderMessages(
        tokenResult.accessToken, 
        folderId, 
        mailboxEmail === "personal" ? undefined : mailboxEmail,
        top,
        skip
      );
      res.json({ connected: true, ...result });
    } catch (error) {
      console.error("Error fetching folder messages:", error);
      res.status(500).json({ error: "Failed to fetch folder messages" });
    }
  });

  // Search emails across mailbox
  app.get("/api/users/:userId/ms365-search-emails", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const query = req.query.q as string;
      const mailboxEmail = req.query.mailbox as string | undefined;
      const top = parseInt(req.query.top as string) || 50;
      
      if (!query || query.trim().length < 2) {
        return res.json({ connected: true, emails: [], totalCount: 0 });
      }
      
      const ms365Connection = await storage.getUserMs365Connection(userId);
      if (!ms365Connection || !ms365Connection.isConnected) {
        return res.json({ connected: false, emails: [], totalCount: 0 });
      }
      
      const { decryptTokenSafe, encryptTokenSafe } = await import("./lib/token-crypto");
      const { getValidAccessToken, searchEmails } = await import("./lib/ms365");
      
      let accessToken: string;
      let refreshToken: string | null;
      
      try {
        accessToken = decryptTokenSafe(ms365Connection.accessToken);
        refreshToken = ms365Connection.refreshToken ? decryptTokenSafe(ms365Connection.refreshToken) : null;
      } catch {
        return res.json({ connected: false, emails: [], totalCount: 0 });
      }
      
      const tokenResult = await getValidAccessToken(accessToken, ms365Connection.tokenExpiresAt, refreshToken);
      if (!tokenResult?.accessToken) {
        return res.json({ connected: false, emails: [], totalCount: 0, requiresReauth: true });
      }
      
      if (tokenResult.refreshed && tokenResult.refreshToken) {
        await storage.updateUserMs365ConnectionTokens(userId, {
          accessToken: encryptTokenSafe(tokenResult.accessToken),
          refreshToken: encryptTokenSafe(tokenResult.refreshToken),
          tokenExpiresAt: tokenResult.expiresOn || new Date(Date.now() + 3600 * 1000),
        });
      }
      
      const result = await searchEmails(
        tokenResult.accessToken, 
        query.trim(),
        mailboxEmail === "personal" ? undefined : mailboxEmail,
        top
      );
      res.json({ connected: true, ...result });
    } catch (error) {
      console.error("Error searching emails:", error);
      res.status(500).json({ error: "Failed to search emails" });
    }
  });

  // Get single email detail
  app.get("/api/users/:userId/ms365-email/:emailId", requireAuth, async (req, res) => {
    try {
      const { userId, emailId } = req.params;
      const mailboxEmail = req.query.mailbox as string | undefined;
      
      const ms365Connection = await storage.getUserMs365Connection(userId);
      if (!ms365Connection || !ms365Connection.isConnected) {
        return res.status(400).json({ error: "MS365 not connected" });
      }
      
      const { decryptTokenSafe } = await import("./lib/token-crypto");
      const { getValidAccessToken, getEmailById, markEmailAsRead } = await import("./lib/ms365");
      
      let accessToken: string;
      let refreshToken: string | null;
      
      try {
        accessToken = decryptTokenSafe(ms365Connection.accessToken);
        refreshToken = ms365Connection.refreshToken ? decryptTokenSafe(ms365Connection.refreshToken) : null;
      } catch {
        return res.status(400).json({ error: "Token decryption failed" });
      }
      
      const tokenResult = await getValidAccessToken(accessToken, ms365Connection.tokenExpiresAt, refreshToken);
      if (!tokenResult?.accessToken) {
        return res.status(401).json({ error: "Token expired", requiresReauth: true });
      }
      
      const email = await getEmailById(
        tokenResult.accessToken, 
        emailId, 
        mailboxEmail === "personal" ? undefined : mailboxEmail
      );
      
      if (!email) {
        return res.status(404).json({ error: "Email not found" });
      }
      
      // Mark as read automatically
      if (!email.isRead) {
        await markEmailAsRead(tokenResult.accessToken, emailId, true, mailboxEmail === "personal" ? undefined : mailboxEmail);
      }
      
      // Auto-link inbound email to customer based on sender email
      let linkedCustomer = null;
      let aiAnalysisResult = null;
      try {
        const senderEmail = email.from?.emailAddress?.address;
        const receivedDateTime = email.receivedDateTime ? new Date(email.receivedDateTime) : new Date();
        const actualMailbox = mailboxEmail === "personal" ? ms365Connection.email : mailboxEmail;
        
        console.log(`[EmailRouter] Processing email ${emailId} from ${senderEmail}, mailbox=${actualMailbox}`);
        
        // Check if there's a routing rule that enables auto-assign customer
        const routingRules = await storage.getAllEmailRoutingRules();
        const activeRules = routingRules.filter(r => r.isActive);
        
        console.log(`[EmailRouter] Found ${activeRules.length} active routing rules`);
        
        // Check if any active rule has autoAssignCustomer enabled (default is true)
        // If no rules exist, default to auto-assign enabled
        const shouldAutoAssign = activeRules.length === 0 || activeRules.some(r => r.autoAssignCustomer !== false);
        
        // Check if AI analysis is enabled in any active rule
        const shouldAnalyzeWithAI = activeRules.some(r => r.enableAiAnalysis === true);
        
        console.log(`[EmailRouter] shouldAutoAssign=${shouldAutoAssign}, shouldAnalyzeWithAI=${shouldAnalyzeWithAI}`);
        
        if (senderEmail && actualMailbox && shouldAutoAssign) {
          // Search for customer by sender email
          const matchingCustomers = await storage.findCustomersByEmail(senderEmail);
          
          if (matchingCustomers.length > 0) {
            const customer = matchingCustomers[0]; // Take first match
            linkedCustomer = {
              id: customer.id,
              firstName: customer.firstName,
              lastName: customer.lastName,
              email: customer.email
            };
            
            // Check if notification already exists for this email
            const existingNotifications = await storage.getCustomerEmailNotifications(customer.id);
            const alreadyLinked = existingNotifications.some(n => n.messageId === emailId);
            
            if (!alreadyLinked) {
              // Add to customer's email history (personal communication tracking)
              await storage.createCustomerEmailNotification({
                customerId: customer.id,
                messageId: emailId,
                mailboxEmail: actualMailbox,
                subject: email.subject || "(bez predmetu)",
                senderEmail: senderEmail,
                senderName: email.from?.emailAddress?.name || senderEmail,
                direction: "inbound",
                bodyPreview: email.bodyPreview ? email.bodyPreview.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim().substring(0, 300) : undefined,
                receivedAt: receivedDateTime,
                priority: email.importance === "high" ? "high" : "normal",
                isRead: false
              });
              console.log(`[EmailRouter] Linked email ${emailId} to customer ${customer.firstName} ${customer.lastName} (${customer.email})`);
            }
          }
        }
        
        // AI Content Analysis if enabled
        if (shouldAnalyzeWithAI && actualMailbox) {
          try {
            const emailContent = email.body?.content || email.bodyPreview || "";
            const analysisResult = await analyzeEmailContent(emailContent, email.subject || "");
            
            if (analysisResult) {
              // Store AI analysis in email metadata with extended characteristics
              const existingMetadata = await storage.getEmailMetadataByMessageId(emailId, actualMailbox);
              const metadataData: any = {
                messageId: emailId,
                mailboxEmail: actualMailbox,
                aiAnalyzed: true,
                aiSentiment: analysisResult.sentiment,
                aiHasInappropriateContent: analysisResult.hasInappropriateContent,
                aiAlertLevel: analysisResult.alertLevel,
                aiAnalysisNote: analysisResult.note,
                aiAnalyzedAt: new Date(),
                // Extended AI characteristics
                aiHasAngryTone: analysisResult.hasAngryTone,
                aiHasRudeExpressions: analysisResult.hasRudeExpressions,
                aiWantsToCancel: analysisResult.wantsToCancel,
                aiWantsConsent: analysisResult.wantsConsent,
                aiDoesNotAcceptContract: analysisResult.doesNotAcceptContract,
              };
              
              // Pipeline automation - move customer to specific stage based on AI analysis
              if (linkedCustomer) {
                const ruleWithPipeline = activeRules.find(r => r.aiPipelineActions);
                if (ruleWithPipeline && ruleWithPipeline.aiPipelineActions) {
                  const actions = ruleWithPipeline.aiPipelineActions as {
                    onAngryTone?: { enabled: boolean; stageId: string };
                    onRudeExpressions?: { enabled: boolean; stageId: string };
                    onWantsToCancel?: { enabled: boolean; stageId: string };
                    onWantsConsent?: { enabled: boolean; stageId: string };
                    onDoesNotAcceptContract?: { enabled: boolean; stageId: string };
                  };
                  
                  let pipelineAction: { stageId: string; reason: string } | null = null;
                  
                  // Check each trigger in priority order (most critical first)
                  if (analysisResult.wantsToCancel && actions.onWantsToCancel?.enabled && actions.onWantsToCancel.stageId) {
                    pipelineAction = { stageId: actions.onWantsToCancel.stageId, reason: "Zákazník chce zrušiť zmluvu" };
                  } else if (analysisResult.hasRudeExpressions && actions.onRudeExpressions?.enabled && actions.onRudeExpressions.stageId) {
                    pipelineAction = { stageId: actions.onRudeExpressions.stageId, reason: "Email obsahuje hrubé výrazy" };
                  } else if (analysisResult.hasAngryTone && actions.onAngryTone?.enabled && actions.onAngryTone.stageId) {
                    pipelineAction = { stageId: actions.onAngryTone.stageId, reason: "Zákazník je nahnevaný" };
                  } else if (analysisResult.doesNotAcceptContract && actions.onDoesNotAcceptContract?.enabled && actions.onDoesNotAcceptContract.stageId) {
                    pipelineAction = { stageId: actions.onDoesNotAcceptContract.stageId, reason: "Zákazník neakceptuje zmluvu" };
                  } else if (analysisResult.wantsConsent && actions.onWantsConsent?.enabled && actions.onWantsConsent.stageId) {
                    pipelineAction = { stageId: actions.onWantsConsent.stageId, reason: "Zákazník chce dať súhlas" };
                  }
                  
                  if (pipelineAction) {
                    try {
                      // Get stage details for logging
                      const targetStage = await storage.getPipelineStage(pipelineAction.stageId);
                      const targetPipeline = targetStage ? await storage.getPipeline(targetStage.pipelineId) : null;
                      const stageName = targetStage?.name || "Neznáma fáza";
                      const pipelineName = targetPipeline?.name || "Neznámy pipeline";
                      const fullStageName = `${pipelineName} → ${stageName}`;
                      
                      // Find deals for this customer and move them to the designated stage
                      const customerDeals = await storage.getDealsByCustomer(linkedCustomer.id);
                      const openDeals = customerDeals.filter(d => d.status === "open");
                      
                      if (openDeals.length > 0) {
                        // Move all open deals for this customer to the new stage
                        for (const deal of openDeals) {
                          await storage.moveDealToStage(deal.id, pipelineAction.stageId);
                          console.log(`[EmailRouter] Pipeline automation: Moved deal ${deal.id} to stage ${pipelineAction.stageId}`);
                        }
                        
                        metadataData.aiPipelineActionTaken = true;
                        metadataData.aiPipelineStageId = pipelineAction.stageId;
                        metadataData.aiPipelineActionReason = pipelineAction.reason;
                        metadataData.aiPipelineStageName = fullStageName;
                        
                        // Log to customer activity history
                        await storage.createActivityLog({
                          id: crypto.randomUUID(),
                          userId: "system",
                          action: "pipeline_stage_changed",
                          entityType: "customer",
                          entityId: linkedCustomer.id,
                          details: `AI automatizácia: ${pipelineAction.reason}. Presun ${openDeals.length} obchod(ov) do fázy "${fullStageName}"`,
                          createdAt: new Date(),
                        });
                        
                        console.log(`[EmailRouter] Pipeline automation: Moved ${openDeals.length} deal(s) for customer ${linkedCustomer.id} to "${fullStageName}" - ${pipelineAction.reason}`);
                      } else {
                        console.log(`[EmailRouter] Pipeline automation: No open deals found for customer ${linkedCustomer.id}, skipping stage move`);
                      }
                    } catch (pipelineError) {
                      console.error("[EmailRouter] Pipeline automation error:", pipelineError);
                    }
                  }
                }
              }
              
              if (existingMetadata) {
                await storage.updateEmailMetadata(existingMetadata.id, metadataData);
              } else {
                await storage.createEmailMetadata(metadataData);
              }
              
              aiAnalysisResult = analysisResult;
              console.log(`[EmailRouter] AI analyzed email ${emailId}: sentiment=${analysisResult.sentiment}, alert=${analysisResult.alertLevel}, angry=${analysisResult.hasAngryTone}, rude=${analysisResult.hasRudeExpressions}, wantsCancel=${analysisResult.wantsToCancel}`);
              
              // Trigger notification for negative sentiment
              if (analysisResult.sentiment === "negative" || analysisResult.sentiment === "angry" || analysisResult.hasAngryTone) {
                try {
                  await notificationService.triggerNotification("sentiment_negative", {
                    title: `Negatívny sentiment: ${email.subject || "Email bez predmetu"}`,
                    message: analysisResult.note || `Email od ${email.from?.emailAddress?.name || email.from?.emailAddress?.address || "neznámy"} obsahuje negatívny sentiment`,
                    entityType: "email",
                    entityId: emailId,
                    countryCode: linkedCustomer?.country,
                    priority: analysisResult.alertLevel === "critical" ? "urgent" : analysisResult.alertLevel === "warning" ? "high" : "normal",
                    metadata: {
                      sentiment: analysisResult.sentiment,
                      alertLevel: analysisResult.alertLevel,
                      hasAngryTone: analysisResult.hasAngryTone,
                      wantsToCancel: analysisResult.wantsToCancel,
                      customerName: linkedCustomer ? `${linkedCustomer.firstName} ${linkedCustomer.lastName}` : null,
                      senderEmail: email.from?.emailAddress?.address,
                    }
                  });
                  console.log(`[EmailRouter] Notification triggered for negative sentiment email ${emailId}`);
                } catch (notifError) {
                  console.error("[EmailRouter] Error triggering notification:", notifError);
                }
              }
            }
          } catch (aiError) {
            console.error("[EmailRouter] AI analysis error:", aiError);
          }
        }
      } catch (linkError) {
        console.error("[EmailRouter] Error linking email to customer:", linkError);
        // Don't fail the request, just log the error
      }
      
      // Also fetch existing AI analysis if not just analyzed
      let existingAiAnalysis = aiAnalysisResult;
      if (!existingAiAnalysis) {
        const actualMailbox = mailboxEmail === "personal" ? ms365Connection.email : mailboxEmail;
        if (actualMailbox) {
          const metadata = await storage.getEmailMetadata(emailId, actualMailbox);
          if (metadata?.aiAnalyzed) {
            // Get pipeline stage name dynamically if not stored
            let pipelineStageName = metadata.aiPipelineStageName;
            if (!pipelineStageName && metadata.aiPipelineStageId) {
              try {
                const stage = await storage.getPipelineStage(metadata.aiPipelineStageId);
                if (stage) {
                  const pipeline = await storage.getPipeline(stage.pipelineId);
                  pipelineStageName = `${pipeline?.name || "Neznámy"} → ${stage.name}`;
                }
              } catch (e) {
                console.error("Error loading pipeline stage name:", e);
              }
            }
            
            existingAiAnalysis = {
              sentiment: metadata.aiSentiment as any,
              hasInappropriateContent: metadata.aiHasInappropriateContent,
              alertLevel: metadata.aiAlertLevel as any,
              note: metadata.aiAnalysisNote || "",
              hasAngryTone: metadata.aiHasAngryTone || false,
              hasRudeExpressions: metadata.aiHasRudeExpressions || false,
              wantsToCancel: metadata.aiWantsToCancel || false,
              wantsConsent: metadata.aiWantsConsent || false,
              doesNotAcceptContract: metadata.aiDoesNotAcceptContract || false,
              pipelineActionTaken: metadata.aiPipelineActionTaken || false,
              pipelineStageId: metadata.aiPipelineStageId || null,
              pipelineStageName: pipelineStageName || null,
              pipelineActionReason: metadata.aiPipelineActionReason || null,
            };
          }
        }
      }
      
      res.json({ ...email, linkedCustomer, aiAnalysis: existingAiAnalysis });
    } catch (error) {
      console.error("Error fetching email:", error);
      res.status(500).json({ error: "Failed to fetch email" });
    }
  });

  // Send email with signature
  app.post("/api/users/:userId/ms365-send-email", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { to, cc, bcc, subject, body, isHtml, mailboxEmail } = req.body;
      
      if (!to || !Array.isArray(to) || to.length === 0) {
        return res.status(400).json({ error: "Recipient is required" });
      }
      
      const ms365Connection = await storage.getUserMs365Connection(userId);
      if (!ms365Connection || !ms365Connection.isConnected) {
        return res.status(400).json({ error: "MS365 not connected" });
      }
      
      const { decryptTokenSafe } = await import("./lib/token-crypto");
      const { getValidAccessToken, sendEmailWithSignature } = await import("./lib/ms365");
      
      let accessToken: string;
      let refreshToken: string | null;
      
      try {
        accessToken = decryptTokenSafe(ms365Connection.accessToken);
        refreshToken = ms365Connection.refreshToken ? decryptTokenSafe(ms365Connection.refreshToken) : null;
      } catch {
        return res.status(400).json({ error: "Token decryption failed" });
      }
      
      const tokenResult = await getValidAccessToken(accessToken, ms365Connection.tokenExpiresAt, refreshToken);
      if (!tokenResult?.accessToken) {
        return res.status(401).json({ error: "Token expired", requiresReauth: true });
      }
      
      // Get signature for this mailbox
      const signatureMailbox = mailboxEmail || "personal";
      const signature = await storage.getEmailSignature(userId, signatureMailbox);
      const signatureHtml = signature?.isActive ? signature.htmlContent : "";
      
      const success = await sendEmailWithSignature(
        tokenResult.accessToken,
        to,
        subject || "",
        body || "",
        signatureHtml,
        isHtml !== false,
        cc || [],
        bcc || [],
        mailboxEmail === "personal" ? undefined : mailboxEmail
      );
      
      if (success) {
        // Log outbound email to customer history for each recipient AND each matching customer
        try {
          const actualMailbox = mailboxEmail === "personal" ? ms365Connection.email : mailboxEmail;
          const sanitizedBodyPreview = body ? body.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim().substring(0, 300) : undefined;
          
          for (const recipientEmail of to) {
            const matchingCustomers = await storage.findCustomersByEmail(recipientEmail);
            // Log for ALL matching customers (e.g., mother and partner sharing same email)
            for (const customer of matchingCustomers) {
              await storage.createCustomerEmailNotification({
                customerId: customer.id,
                messageId: `outbound-${Date.now()}-${customer.id}-${Math.random().toString(36).substr(2, 9)}`,
                mailboxEmail: actualMailbox || "",
                subject: subject || "(bez predmetu)",
                senderEmail: actualMailbox || "",
                recipientEmail: recipientEmail,
                direction: "outbound",
                bodyPreview: sanitizedBodyPreview,
                receivedAt: new Date(),
                priority: "normal",
                isRead: true
              });
              console.log(`[EmailRouter] Logged outbound email to customer ${customer.firstName} ${customer.lastName} (${customer.email})`);
            }
          }
        } catch (linkError) {
          console.error("[EmailRouter] Error logging outbound email to customer:", linkError);
        }
        
        res.json({ success: true, message: "Email sent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send email" });
      }
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Reply to email
  app.post("/api/users/:userId/ms365-reply/:emailId", requireAuth, async (req, res) => {
    try {
      const { userId, emailId } = req.params;
      const { body, isHtml, replyAll, mailboxEmail } = req.body;
      
      const ms365Connection = await storage.getUserMs365Connection(userId);
      if (!ms365Connection || !ms365Connection.isConnected) {
        return res.status(400).json({ error: "MS365 not connected" });
      }
      
      const { decryptTokenSafe } = await import("./lib/token-crypto");
      const { getValidAccessToken, replyToEmail } = await import("./lib/ms365");
      
      let accessToken: string;
      let refreshToken: string | null;
      
      try {
        accessToken = decryptTokenSafe(ms365Connection.accessToken);
        refreshToken = ms365Connection.refreshToken ? decryptTokenSafe(ms365Connection.refreshToken) : null;
      } catch {
        return res.status(400).json({ error: "Token decryption failed" });
      }
      
      const tokenResult = await getValidAccessToken(accessToken, ms365Connection.tokenExpiresAt, refreshToken);
      if (!tokenResult?.accessToken) {
        return res.status(401).json({ error: "Token expired", requiresReauth: true });
      }
      
      // Get signature
      const signatureMailbox = mailboxEmail || "personal";
      const signature = await storage.getEmailSignature(userId, signatureMailbox);
      const signatureHtml = signature?.isActive ? signature.htmlContent : "";
      
      const success = await replyToEmail(
        tokenResult.accessToken,
        emailId,
        body || "",
        signatureHtml,
        isHtml !== false,
        replyAll === true,
        mailboxEmail === "personal" ? undefined : mailboxEmail
      );
      
      if (success) {
        res.json({ success: true, message: "Reply sent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send reply" });
      }
    } catch (error) {
      console.error("Error replying to email:", error);
      res.status(500).json({ error: "Failed to send reply" });
    }
  });

  // Forward email
  app.post("/api/users/:userId/ms365-forward/:emailId", requireAuth, async (req, res) => {
    try {
      const { userId, emailId } = req.params;
      const { to, body, isHtml, mailboxEmail } = req.body;
      
      if (!to || !Array.isArray(to) || to.length === 0) {
        return res.status(400).json({ error: "Recipient is required" });
      }
      
      const ms365Connection = await storage.getUserMs365Connection(userId);
      if (!ms365Connection || !ms365Connection.isConnected) {
        return res.status(400).json({ error: "MS365 not connected" });
      }
      
      const { decryptTokenSafe } = await import("./lib/token-crypto");
      const { getValidAccessToken, forwardEmail } = await import("./lib/ms365");
      
      let accessToken: string;
      let refreshToken: string | null;
      
      try {
        accessToken = decryptTokenSafe(ms365Connection.accessToken);
        refreshToken = ms365Connection.refreshToken ? decryptTokenSafe(ms365Connection.refreshToken) : null;
      } catch {
        return res.status(400).json({ error: "Token decryption failed" });
      }
      
      const tokenResult = await getValidAccessToken(accessToken, ms365Connection.tokenExpiresAt, refreshToken);
      if (!tokenResult?.accessToken) {
        return res.status(401).json({ error: "Token expired", requiresReauth: true });
      }
      
      // Get signature
      const signatureMailbox = mailboxEmail || "personal";
      const signature = await storage.getEmailSignature(userId, signatureMailbox);
      const signatureHtml = signature?.isActive ? signature.htmlContent : "";
      
      const success = await forwardEmail(
        tokenResult.accessToken,
        emailId,
        to,
        body || "",
        signatureHtml,
        isHtml !== false,
        mailboxEmail === "personal" ? undefined : mailboxEmail
      );
      
      if (success) {
        res.json({ success: true, message: "Email forwarded successfully" });
      } else {
        res.status(500).json({ error: "Failed to forward email" });
      }
    } catch (error) {
      console.error("Error forwarding email:", error);
      res.status(500).json({ error: "Failed to forward email" });
    }
  });

  // Delete email
  app.delete("/api/users/:userId/ms365-email/:emailId", requireAuth, async (req, res) => {
    try {
      const { userId, emailId } = req.params;
      const mailboxEmail = req.query.mailbox as string | undefined;
      
      const ms365Connection = await storage.getUserMs365Connection(userId);
      if (!ms365Connection || !ms365Connection.isConnected) {
        return res.status(400).json({ error: "MS365 not connected" });
      }
      
      const { decryptTokenSafe } = await import("./lib/token-crypto");
      const { getValidAccessToken, deleteEmail } = await import("./lib/ms365");
      
      let accessToken: string;
      let refreshToken: string | null;
      
      try {
        accessToken = decryptTokenSafe(ms365Connection.accessToken);
        refreshToken = ms365Connection.refreshToken ? decryptTokenSafe(ms365Connection.refreshToken) : null;
      } catch {
        return res.status(400).json({ error: "Token decryption failed" });
      }
      
      const tokenResult = await getValidAccessToken(accessToken, ms365Connection.tokenExpiresAt, refreshToken);
      if (!tokenResult?.accessToken) {
        return res.status(401).json({ error: "Token expired", requiresReauth: true });
      }
      
      const success = await deleteEmail(
        tokenResult.accessToken,
        emailId,
        mailboxEmail === "personal" ? undefined : mailboxEmail
      );
      
      if (success) {
        res.json({ success: true, message: "Email deleted" });
      } else {
        res.status(500).json({ error: "Failed to delete email" });
      }
    } catch (error) {
      console.error("Error deleting email:", error);
      res.status(500).json({ error: "Failed to delete email" });
    }
  });

  // =====================================
  // EMAIL SIGNATURES API
  // =====================================

  // Get all signatures for user
  app.get("/api/users/:userId/email-signatures", requireAuth, async (req, res) => {
    try {
      const signatures = await storage.getEmailSignatures(req.params.userId);
      res.json(signatures);
    } catch (error) {
      console.error("Error fetching email signatures:", error);
      res.status(500).json({ error: "Failed to fetch email signatures" });
    }
  });

  // Get signature for specific mailbox
  app.get("/api/users/:userId/email-signatures/:mailboxEmail", requireAuth, async (req, res) => {
    try {
      const signature = await storage.getEmailSignature(req.params.userId, req.params.mailboxEmail);
      res.json(signature || { htmlContent: "", isActive: false });
    } catch (error) {
      console.error("Error fetching email signature:", error);
      res.status(500).json({ error: "Failed to fetch email signature" });
    }
  });

  // Create/Update signature
  app.put("/api/users/:userId/email-signatures/:mailboxEmail", requireAuth, async (req, res) => {
    try {
      const { userId, mailboxEmail } = req.params;
      const { htmlContent, isActive } = req.body;
      
      const signature = await storage.upsertEmailSignature({
        userId,
        mailboxEmail,
        htmlContent: htmlContent || "",
        isActive: isActive !== false,
      });
      
      res.json(signature);
    } catch (error) {
      console.error("Error saving email signature:", error);
      res.status(500).json({ error: "Failed to save email signature" });
    }
  });

  // Delete signature
  app.delete("/api/users/:userId/email-signatures/:mailboxEmail", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteEmailSignature(req.params.userId, req.params.mailboxEmail);
      if (!deleted) {
        return res.status(404).json({ error: "Signature not found" });
      }
      res.json({ message: "Signature deleted" });
    } catch (error) {
      console.error("Error deleting email signature:", error);
      res.status(500).json({ error: "Failed to delete email signature" });
    }
  });

  // ============================================
  // EMAIL ROUTING RULES API
  // ============================================

  // Get all email routing rules
  app.get("/api/email-routing-rules", requireAuth, async (req, res) => {
    try {
      const rules = await storage.getAllEmailRoutingRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching email routing rules:", error);
      res.status(500).json({ error: "Failed to fetch email routing rules" });
    }
  });

  // Get single email routing rule
  app.get("/api/email-routing-rules/:id", requireAuth, async (req, res) => {
    try {
      const rule = await storage.getEmailRoutingRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Error fetching email routing rule:", error);
      res.status(500).json({ error: "Failed to fetch email routing rule" });
    }
  });

  // Create email routing rule
  app.post("/api/email-routing-rules", requireAuth, async (req, res) => {
    try {
      const ruleData = {
        ...req.body,
        createdBy: req.session.user!.id,
      };
      const rule = await storage.createEmailRoutingRule(ruleData);
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating email routing rule:", error);
      res.status(500).json({ error: "Failed to create email routing rule" });
    }
  });

  // Update email routing rule
  app.patch("/api/email-routing-rules/:id", requireAuth, async (req, res) => {
    try {
      const rule = await storage.updateEmailRoutingRule(req.params.id, req.body);
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Error updating email routing rule:", error);
      res.status(500).json({ error: "Failed to update email routing rule" });
    }
  });

  // Delete email routing rule
  app.delete("/api/email-routing-rules/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteEmailRoutingRule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json({ message: "Rule deleted" });
    } catch (error) {
      console.error("Error deleting email routing rule:", error);
      res.status(500).json({ error: "Failed to delete email routing rule" });
    }
  });

  // Toggle email routing rule active status
  app.post("/api/email-routing-rules/:id/toggle", requireAuth, async (req, res) => {
    try {
      const { isActive } = req.body;
      const rule = await storage.toggleEmailRoutingRule(req.params.id, isActive);
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Error toggling email routing rule:", error);
      res.status(500).json({ error: "Failed to toggle email routing rule" });
    }
  });

  // ============================================
  // EMAIL TAGS API
  // ============================================

  // Get all email tags
  app.get("/api/email-tags", requireAuth, async (req, res) => {
    try {
      const tags = await storage.getAllEmailTags();
      res.json(tags);
    } catch (error) {
      console.error("Error fetching email tags:", error);
      res.status(500).json({ error: "Failed to fetch email tags" });
    }
  });

  // Create email tag
  app.post("/api/email-tags", requireAuth, async (req, res) => {
    try {
      const tag = await storage.createEmailTag(req.body);
      res.status(201).json(tag);
    } catch (error) {
      console.error("Error creating email tag:", error);
      res.status(500).json({ error: "Failed to create email tag" });
    }
  });

  // Update email tag
  app.patch("/api/email-tags/:id", requireAuth, async (req, res) => {
    try {
      const tag = await storage.updateEmailTag(req.params.id, req.body);
      if (!tag) {
        return res.status(404).json({ error: "Tag not found" });
      }
      res.json(tag);
    } catch (error) {
      console.error("Error updating email tag:", error);
      res.status(500).json({ error: "Failed to update email tag" });
    }
  });

  // Delete email tag
  app.delete("/api/email-tags/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteEmailTag(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Tag not found" });
      }
      res.json({ message: "Tag deleted" });
    } catch (error) {
      console.error("Error deleting email tag:", error);
      res.status(500).json({ error: "Failed to delete email tag" });
    }
  });

  // ============================================
  // CUSTOMER EMAIL NOTIFICATIONS API
  // ============================================

  // Get customer email notifications
  app.get("/api/customers/:customerId/email-notifications", requireAuth, async (req, res) => {
    try {
      const notifications = await storage.getCustomerEmailNotifications(req.params.customerId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching customer email notifications:", error);
      res.status(500).json({ error: "Failed to fetch customer email notifications" });
    }
  });

  // Get unread count for customer
  app.get("/api/customers/:customerId/email-notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const count = await storage.getUnreadCustomerEmailNotificationsCount(req.params.customerId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  // Mark notification as read
  app.post("/api/customer-email-notifications/:id/mark-read", requireAuth, async (req, res) => {
    try {
      const notification = await storage.markCustomerEmailNotificationRead(
        req.params.id, 
        req.session.user!.id
      );
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Tasks API (protected)
  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getAllTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/my", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getTasksByUser(req.session.user!.id);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching user tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  app.post("/api/tasks", requireAuth, async (req, res) => {
    try {
      const taskData = {
        ...req.body,
        createdByUserId: req.session.user!.id,
      };
      const task = await storage.createTask(taskData);
      
      await logActivity(
        req.session.user!.id,
        "create",
        "task",
        task.id,
        task.title,
        { priority: task.priority, assignedUserId: task.assignedUserId },
        req.ip
      );
      
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const task = await storage.updateTask(req.params.id, req.body);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      await logActivity(
        req.session.user!.id,
        "update",
        "task",
        task.id,
        task.title,
        req.body,
        req.ip
      );
      
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      const deleted = await storage.deleteTask(req.params.id);
      if (deleted) {
        await logActivity(
          req.session.user!.id,
          "delete",
          "task",
          req.params.id,
          task.title,
          {},
          req.ip
        );
      }
      
      res.json({ success: deleted });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Resolve task with solution
  app.post("/api/tasks/:id/resolve", requireAuth, async (req, res) => {
    try {
      const { resolution } = req.body;
      if (!resolution) {
        return res.status(400).json({ error: "Resolution text is required" });
      }
      
      const task = await storage.resolveTask(req.params.id, resolution, req.session.user!.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      await logActivity(
        req.session.user!.id,
        "resolve",
        "task",
        task.id,
        task.title,
        { resolution },
        req.ip
      );
      
      res.json(task);
    } catch (error) {
      console.error("Error resolving task:", error);
      res.status(500).json({ error: "Failed to resolve task" });
    }
  });

  // Reassign task to another user
  app.post("/api/tasks/:id/reassign", requireAuth, async (req, res) => {
    try {
      const { newAssignedUserId } = req.body;
      if (!newAssignedUserId) {
        return res.status(400).json({ error: "New assigned user ID is required" });
      }
      
      const task = await storage.reassignTask(req.params.id, newAssignedUserId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      await logActivity(
        req.session.user!.id,
        "reassign",
        "task",
        task.id,
        task.title,
        { newAssignedUserId },
        req.ip
      );
      
      res.json(task);
    } catch (error) {
      console.error("Error reassigning task:", error);
      res.status(500).json({ error: "Failed to reassign task" });
    }
  });

  // Task Comments API
  app.get("/api/tasks/:taskId/comments", requireAuth, async (req, res) => {
    try {
      const comments = await storage.getTaskComments(req.params.taskId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching task comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/tasks/:taskId/comments", requireAuth, async (req, res) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Comment content is required" });
      }
      
      const comment = await storage.createTaskComment({
        taskId: req.params.taskId,
        userId: req.session.user!.id,
        content,
      });
      
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating task comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.delete("/api/tasks/:taskId/comments/:commentId", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteTaskComment(req.params.commentId);
      res.json({ success: deleted });
    } catch (error) {
      console.error("Error deleting task comment:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // Products API (protected)
  app.get("/api/products", requireAuth, async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", requireAuth, async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const partialSchema = insertProductSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      const product = await storage.updateProduct(req.params.id, validatedData);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Duplicate Product API
  app.post("/api/products/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const { newName } = req.body;
      if (!newName || typeof newName !== "string") {
        return res.status(400).json({ error: "New product name is required" });
      }
      const newProduct = await storage.duplicateProduct(req.params.id, newName);
      res.status(201).json(newProduct);
    } catch (error) {
      console.error("Error duplicating product:", error);
      res.status(500).json({ error: "Failed to duplicate product" });
    }
  });

  // Market Product Instances API
  app.get("/api/products/:productId/instances", requireAuth, async (req, res) => {
    try {
      const instances = await storage.getMarketProductInstances(req.params.productId);
      res.json(instances);
    } catch (error) {
      console.error("Error fetching market product instances:", error);
      res.status(500).json({ error: "Failed to fetch instances" });
    }
  });

  // Get collections (market product instances) filtered by country
  app.get("/api/products/:productId/collections", requireAuth, async (req, res) => {
    try {
      const { country } = req.query;
      if (!country || typeof country !== "string") {
        return res.status(400).json({ error: "Country parameter is required" });
      }
      const collections = await storage.getMarketProductInstancesByCountry(req.params.productId, country);
      res.json(collections);
    } catch (error) {
      console.error("Error fetching collections:", error);
      res.status(500).json({ error: "Failed to fetch collections" });
    }
  });

  // Get billsets (instance prices) for a collection
  app.get("/api/collections/:instanceId/billsets", requireAuth, async (req, res) => {
    try {
      const prices = await storage.getInstancePrices(req.params.instanceId, "market");
      // Filter only active billsets
      const activePrices = prices.filter((p: any) => p.isActive !== false);
      res.json(activePrices);
    } catch (error) {
      console.error("Error fetching billsets:", error);
      res.status(500).json({ error: "Failed to fetch billsets" });
    }
  });

  app.post("/api/products/:productId/instances", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields({ ...req.body, productId: req.params.productId });
      const instance = await storage.createMarketProductInstance(data);
      res.status(201).json(instance);
    } catch (error) {
      console.error("Error creating market product instance:", error);
      res.status(500).json({ error: "Failed to create instance" });
    }
  });

  app.patch("/api/product-instances/:id", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      const instance = await storage.updateMarketProductInstance(req.params.id, data);
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }
      res.json(instance);
    } catch (error) {
      console.error("Error updating market product instance:", error);
      res.status(500).json({ error: "Failed to update instance" });
    }
  });

  app.delete("/api/product-instances/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteMarketProductInstance(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Instance not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting market product instance:", error);
      res.status(500).json({ error: "Failed to delete instance" });
    }
  });

  // Instance Prices API
  app.get("/api/instance-prices/:instanceId/:instanceType", requireAuth, async (req, res) => {
    try {
      const prices = await storage.getInstancePrices(req.params.instanceId, req.params.instanceType);
      res.json(prices);
    } catch (error) {
      console.error("Error fetching instance prices:", error);
      res.status(500).json({ error: "Failed to fetch prices" });
    }
  });

  app.post("/api/instance-prices", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      if (data.countryCode === "") data.countryCode = null;
      const price = await storage.createInstancePrice(data);
      res.status(201).json(price);
    } catch (error) {
      console.error("Error creating instance price:", error);
      res.status(500).json({ error: "Failed to create price" });
    }
  });

  app.patch("/api/instance-prices/:id", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      if (data.countryCode === "") data.countryCode = null;
      const price = await storage.updateInstancePrice(req.params.id, data);
      if (!price) {
        return res.status(404).json({ error: "Price not found" });
      }
      res.json(price);
    } catch (error) {
      console.error("Error updating instance price:", error);
      res.status(500).json({ error: "Failed to update price" });
    }
  });

  app.delete("/api/instance-prices/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteInstancePrice(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Price not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting instance price:", error);
      res.status(500).json({ error: "Failed to delete price" });
    }
  });

  // Instance Payment Options API
  app.get("/api/instance-payment-options/:instanceId/:instanceType", requireAuth, async (req, res) => {
    try {
      const options = await storage.getInstancePaymentOptions(req.params.instanceId, req.params.instanceType);
      res.json(options);
    } catch (error) {
      console.error("Error fetching payment options:", error);
      res.status(500).json({ error: "Failed to fetch payment options" });
    }
  });

  app.post("/api/instance-payment-options", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      // Convert empty strings to null for numeric fields
      if (data.paymentTypeFee === "") data.paymentTypeFee = null;
      if (data.installmentCount === "") data.installmentCount = null;
      const option = await storage.createInstancePaymentOption(data);
      res.status(201).json(option);
    } catch (error) {
      console.error("Error creating payment option:", error);
      res.status(500).json({ error: "Failed to create payment option" });
    }
  });

  app.patch("/api/instance-payment-options/:id", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      // Convert empty strings to null for numeric fields
      if (data.paymentTypeFee === "") data.paymentTypeFee = null;
      if (data.installmentCount === "") data.installmentCount = null;
      const option = await storage.updateInstancePaymentOption(req.params.id, data);
      if (!option) {
        return res.status(404).json({ error: "Payment option not found" });
      }
      res.json(option);
    } catch (error) {
      console.error("Error updating payment option:", error);
      res.status(500).json({ error: "Failed to update payment option" });
    }
  });

  app.delete("/api/instance-payment-options/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteInstancePaymentOption(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Payment option not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting payment option:", error);
      res.status(500).json({ error: "Failed to delete payment option" });
    }
  });

  // Payment Installments API
  app.get("/api/payment-installments/:paymentOptionId", requireAuth, async (req, res) => {
    try {
      const installments = await storage.getPaymentInstallments(req.params.paymentOptionId);
      res.json(installments);
    } catch (error) {
      console.error("Error fetching payment installments:", error);
      res.status(500).json({ error: "Failed to fetch payment installments" });
    }
  });

  app.post("/api/payment-installments", requireAuth, async (req, res) => {
    try {
      const installment = await storage.createPaymentInstallment(req.body);
      res.status(201).json(installment);
    } catch (error) {
      console.error("Error creating payment installment:", error);
      res.status(500).json({ error: "Failed to create payment installment" });
    }
  });

  app.post("/api/payment-installments/bulk", requireAuth, async (req, res) => {
    try {
      const { paymentOptionId, installments } = req.body;
      // First delete existing installments
      await storage.deletePaymentInstallmentsByOption(paymentOptionId);
      // Then create new ones
      const created = await storage.bulkCreatePaymentInstallments(installments);
      res.status(201).json(created);
    } catch (error) {
      console.error("Error bulk creating payment installments:", error);
      res.status(500).json({ error: "Failed to create payment installments" });
    }
  });

  app.patch("/api/payment-installments/:id", requireAuth, async (req, res) => {
    try {
      const installment = await storage.updatePaymentInstallment(req.params.id, req.body);
      if (!installment) {
        return res.status(404).json({ error: "Payment installment not found" });
      }
      res.json(installment);
    } catch (error) {
      console.error("Error updating payment installment:", error);
      res.status(500).json({ error: "Failed to update payment installment" });
    }
  });

  app.delete("/api/payment-installments/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deletePaymentInstallment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Payment installment not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting payment installment:", error);
      res.status(500).json({ error: "Failed to delete payment installment" });
    }
  });

  // Instance Discounts API
  app.get("/api/instance-discounts/:instanceId/:instanceType", requireAuth, async (req, res) => {
    try {
      const discounts = await storage.getInstanceDiscounts(req.params.instanceId, req.params.instanceType);
      res.json(discounts);
    } catch (error) {
      console.error("Error fetching discounts:", error);
      res.status(500).json({ error: "Failed to fetch discounts" });
    }
  });

  app.post("/api/instance-discounts", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      // Convert empty strings to null for numeric fields
      if (data.fixedValue === "") data.fixedValue = null;
      if (data.percentageValue === "") data.percentageValue = null;
      const discount = await storage.createInstanceDiscount(data);
      res.status(201).json(discount);
    } catch (error) {
      console.error("Error creating discount:", error);
      res.status(500).json({ error: "Failed to create discount" });
    }
  });

  app.patch("/api/instance-discounts/:id", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      // Convert empty strings to null for numeric fields
      if (data.fixedValue === "") data.fixedValue = null;
      if (data.percentageValue === "") data.percentageValue = null;
      const discount = await storage.updateInstanceDiscount(req.params.id, data);
      if (!discount) {
        return res.status(404).json({ error: "Discount not found" });
      }
      res.json(discount);
    } catch (error) {
      console.error("Error updating discount:", error);
      res.status(500).json({ error: "Failed to update discount" });
    }
  });

  app.delete("/api/instance-discounts/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteInstanceDiscount(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Discount not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting discount:", error);
      res.status(500).json({ error: "Failed to delete discount" });
    }
  });

  // Instance VAT Rates API
  app.get("/api/instance-vat-rates/:instanceId/:instanceType", requireAuth, async (req, res) => {
    try {
      const vatRates = await storage.getInstanceVatRates(req.params.instanceId, req.params.instanceType);
      res.json(vatRates);
    } catch (error) {
      console.error("Error fetching VAT rates:", error);
      res.status(500).json({ error: "Failed to fetch VAT rates" });
    }
  });

  app.post("/api/instance-vat-rates", requireAuth, async (req, res) => {
    try {
      // Preprocess data - convert empty strings to null for optional fields
      const rawData = parseDateFields(req.body);
      if (rawData.vatRate === "") rawData.vatRate = null;
      if (rawData.accountingCode === "") rawData.accountingCode = null;
      if (rawData.billingDetailsId === "") rawData.billingDetailsId = null;
      if (rawData.category === "") rawData.category = null;
      if (rawData.description === "") rawData.description = null;
      
      // Validate with Zod schema
      const validationResult = insertInstanceVatRateSchema.safeParse(rawData);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Validation failed", details: validationResult.error.flatten() });
      }
      
      const vatRate = await storage.createInstanceVatRate(validationResult.data);
      res.status(201).json(vatRate);
    } catch (error) {
      console.error("Error creating VAT rate:", error);
      res.status(500).json({ error: "Failed to create VAT rate" });
    }
  });

  app.patch("/api/instance-vat-rates/:id", requireAuth, async (req, res) => {
    try {
      // Preprocess data - convert empty strings to null for optional fields
      const rawData = parseDateFields(req.body);
      if (rawData.vatRate === "") rawData.vatRate = null;
      if (rawData.accountingCode === "") rawData.accountingCode = null;
      if (rawData.billingDetailsId === "") rawData.billingDetailsId = null;
      if (rawData.category === "") rawData.category = null;
      if (rawData.description === "") rawData.description = null;
      
      const vatRate = await storage.updateInstanceVatRate(req.params.id, rawData);
      if (!vatRate) {
        return res.status(404).json({ error: "VAT rate not found" });
      }
      res.json(vatRate);
    } catch (error) {
      console.error("Error updating VAT rate:", error);
      res.status(500).json({ error: "Failed to update VAT rate" });
    }
  });

  app.delete("/api/instance-vat-rates/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteInstanceVatRate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "VAT rate not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting VAT rate:", error);
      res.status(500).json({ error: "Failed to delete VAT rate" });
    }
  });

  // Market Product Services API
  app.get("/api/product-instances/:instanceId/services", requireAuth, async (req, res) => {
    try {
      const services = await storage.getMarketProductServices(req.params.instanceId);
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  app.post("/api/product-instances/:instanceId/services", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields({ ...req.body, instanceId: req.params.instanceId });
      const service = await storage.createMarketProductService(data);
      res.status(201).json(service);
    } catch (error) {
      console.error("Error creating service:", error);
      res.status(500).json({ error: "Failed to create service" });
    }
  });

  app.patch("/api/product-services/:id", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      const service = await storage.updateMarketProductService(req.params.id, data);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({ error: "Failed to update service" });
    }
  });

  app.delete("/api/product-services/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteMarketProductService(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Service not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ error: "Failed to delete service" });
    }
  });

  // Customer Products API (protected)
  app.get("/api/customers/:customerId/products", requireAuth, async (req, res) => {
    try {
      const customerProducts = await storage.getCustomerProducts(req.params.customerId);
      res.json(customerProducts);
    } catch (error) {
      console.error("Error fetching customer products:", error);
      res.status(500).json({ error: "Failed to fetch customer products" });
    }
  });

  app.post("/api/customers/:customerId/products", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCustomerProductSchema.parse({
        ...req.body,
        customerId: req.params.customerId,
      });
      const customerProduct = await storage.addProductToCustomer(validatedData);
      res.status(201).json(customerProduct);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error adding product to customer:", error);
      res.status(500).json({ error: "Failed to add product to customer" });
    }
  });

  app.delete("/api/customer-products/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.removeProductFromCustomer(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Customer product not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error removing product from customer:", error);
      res.status(500).json({ error: "Failed to remove product from customer" });
    }
  });

  app.patch("/api/customer-products/:id", requireAuth, async (req, res) => {
    try {
      const { billsetId } = req.body;
      if (!billsetId) {
        return res.status(400).json({ error: "billsetId is required" });
      }
      const updated = await storage.updateCustomerProduct(req.params.id, { billsetId });
      if (!updated) {
        return res.status(404).json({ error: "Customer product not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating customer product:", error);
      res.status(500).json({ error: "Failed to update customer product" });
    }
  });

  // Invoices API (protected)
  app.get("/api/invoices", requireAuth, async (req, res) => {
    try {
      const invoices = await storage.getAllInvoices();
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.get("/api/customers/:customerId/invoices", requireAuth, async (req, res) => {
    try {
      const invoices = await storage.getInvoicesByCustomer(req.params.customerId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching customer invoices:", error);
      res.status(500).json({ error: "Failed to fetch customer invoices" });
    }
  });

  // Get all documents (contracts + invoices) for a customer with creator info
  app.get("/api/customers/:customerId/documents", requireAuth, async (req, res) => {
    try {
      const customerId = req.params.customerId;
      
      // Get contracts
      const contracts = await storage.getContractInstancesByCustomer(customerId);
      
      // Get invoices
      const invoices = await storage.getInvoicesByCustomer(customerId);
      
      // Get all users for creator lookup
      const users = await storage.getAllUsers();
      const userMap = new Map(users.map(u => [u.id, u]));
      
      // Transform contracts to document format
      const contractDocs = contracts.map(c => ({
        id: c.id,
        type: "contract" as const,
        number: c.contractNumber,
        status: c.status,
        createdAt: c.createdAt,
        createdBy: c.createdBy,
        createdByName: c.createdBy ? userMap.get(c.createdBy)?.fullName || userMap.get(c.createdBy)?.username : null,
        pdfPath: c.pdfPath,
        totalAmount: c.totalGrossAmount,
        currency: c.currency,
        cancellationReason: c.cancellationReason,
        validFrom: c.validFrom,
        validTo: c.validTo,
      }));
      
      // Transform invoices to document format
      const invoiceDocs = invoices.map(i => ({
        id: i.id,
        type: "invoice" as const,
        number: i.invoiceNumber,
        status: i.status,
        createdAt: i.generatedAt,
        createdBy: null, // invoices don't have createdBy field
        createdByName: null,
        pdfPath: i.pdfPath,
        totalAmount: i.totalAmount,
        currency: i.currency,
        dueDate: i.dueDate,
      }));
      
      // Combine and sort by date (newest first)
      const documents = [...contractDocs, ...invoiceDocs].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      
      res.json(documents);
    } catch (error) {
      console.error("Error fetching customer documents:", error);
      res.status(500).json({ error: "Failed to fetch customer documents" });
    }
  });

  // Download document PDF with watermark support for cancelled contracts
  app.get("/api/customers/:customerId/documents/:docType/:docId/pdf", requireAuth, async (req, res) => {
    try {
      const { customerId, docType, docId } = req.params;
      
      if (docType === "contract") {
        const contract = await storage.getContractInstance(docId);
        if (!contract || contract.customerId !== customerId) {
          return res.status(404).json({ error: "Contract not found" });
        }
        
        if (!contract.pdfPath) {
          return res.status(400).json({ error: "PDF not available" });
        }
        
        const fullPath = path.join(process.cwd(), contract.pdfPath);
        if (!fs.existsSync(fullPath)) {
          return res.status(404).json({ error: "PDF file not found" });
        }
        
        let pdfBuffer = await fs.promises.readFile(fullPath);
        
        // Add watermark if cancelled
        if (contract.status === "cancelled") {
          const userLocale = getUserLocale(req.session.user?.assignedCountries || []);
          pdfBuffer = await addCancellationWatermark(pdfBuffer, contract.cancellationReason, userLocale);
        }
        
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="zmluva-${contract.contractNumber}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.send(pdfBuffer);
      } else if (docType === "invoice") {
        const invoices = await storage.getInvoicesByCustomer(customerId);
        const invoice = invoices.find(i => i.id === docId);
        
        if (!invoice) {
          return res.status(404).json({ error: "Invoice not found" });
        }
        
        if (!invoice.pdfPath) {
          return res.status(400).json({ error: "PDF not available" });
        }
        
        const fullPath = path.join(process.cwd(), invoice.pdfPath);
        if (!fs.existsSync(fullPath)) {
          return res.status(404).json({ error: "PDF file not found" });
        }
        
        const pdfBuffer = await fs.promises.readFile(fullPath);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="faktura-${invoice.invoiceNumber}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.send(pdfBuffer);
      } else {
        return res.status(400).json({ error: "Invalid document type" });
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ error: "Failed to download document" });
    }
  });

  // Generate invoice for a single customer
  app.post("/api/customers/:customerId/invoices/generate", requireAuth, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const customerProducts = await storage.getCustomerProducts(req.params.customerId);
      if (customerProducts.length === 0) {
        return res.status(400).json({ error: "Customer has no products to invoice" });
      }

      const invoiceNumber = await storage.getNextInvoiceNumber();
      let totalAmount = 0;
      
      for (const cp of customerProducts) {
        const price = cp.priceOverride ? parseFloat(cp.priceOverride) : 0;
        totalAmount += price * cp.quantity;
      }

      // Get billing details for the customer's country
      const billingInfo = await storage.getBillingDetails(customer.country);
      const paymentTermDays = billingInfo?.defaultPaymentTerm || 14;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + paymentTermDays);

      const invoice = await storage.createInvoice({
        invoiceNumber,
        customerId: customer.id,
        totalAmount: totalAmount.toFixed(2),
        currency: "EUR",
        status: "generated",
        pdfPath: null,
        paymentTermDays,
        dueDate,
        billingCompanyName: billingInfo?.companyName || null,
        billingAddress: billingInfo?.address || null,
        billingCity: billingInfo?.city || null,
        billingTaxId: billingInfo?.taxId || null,
        billingBankName: billingInfo?.bankName || null,
        billingBankIban: billingInfo?.bankIban || null,
        billingBankSwift: billingInfo?.bankSwift || null,
      });

      res.status(201).json(invoice);
    } catch (error) {
      console.error("Error generating invoice:", error);
      res.status(500).json({ error: "Failed to generate invoice" });
    }
  });

  // Generate PDF for an invoice
  app.get("/api/invoices/:id/pdf", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const customer = await storage.getCustomer(invoice.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const invoiceItems = await storage.getInvoiceItems(invoice.id);
      const customerProducts = await storage.getCustomerProducts(invoice.customerId);

      const doc = new PDFDocument({ margin: 50 });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
      
      doc.pipe(res);

      // Header with billing company info
      if (invoice.billingCompanyName) {
        doc.fontSize(18).font("Helvetica-Bold").text(invoice.billingCompanyName, { align: "left" });
        doc.fontSize(9).font("Helvetica");
        if (invoice.billingAddress) doc.text(invoice.billingAddress);
        if (invoice.billingCity) doc.text(invoice.billingCity);
        if (invoice.billingTaxId) doc.text(`Tax ID: ${invoice.billingTaxId}`);
        doc.moveDown();
        if (invoice.billingBankName) doc.text(`Bank: ${invoice.billingBankName}`);
        if (invoice.billingBankIban) doc.text(`IBAN: ${invoice.billingBankIban}`);
        if (invoice.billingBankSwift) doc.text(`SWIFT: ${invoice.billingBankSwift}`);
      } else {
        doc.fontSize(18).font("Helvetica-Bold").text("INDEXUS", { align: "left" });
        doc.fontSize(10).font("Helvetica").text("Cord Blood Banking Services");
      }
      doc.moveDown(2);

      // Invoice details
      doc.fontSize(16).font("Helvetica-Bold").text("INVOICE", { align: "left" });
      doc.fontSize(10).font("Helvetica");
      doc.text(`Invoice Number: ${invoice.invoiceNumber}`);
      doc.text(`Issue Date: ${new Date(invoice.generatedAt).toLocaleDateString()}`);
      if (invoice.dueDate) {
        doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`);
        doc.text(`Payment Terms: ${invoice.paymentTermDays} days`);
      }
      doc.text(`Status: ${invoice.status.toUpperCase()}`);
      doc.moveDown();

      // Customer details
      doc.fontSize(12).font("Helvetica-Bold").text("Bill To:");
      doc.fontSize(10).font("Helvetica");
      doc.text(`${customer.firstName} ${customer.lastName}`);
      doc.text(customer.email);
      if (customer.address) doc.text(customer.address);
      if (customer.city) doc.text(customer.city);
      doc.text(customer.country);
      doc.moveDown(2);

      // Products table header
      doc.fontSize(10).font("Helvetica-Bold");
      const tableTop = doc.y;
      doc.text("Description", 50, tableTop, { width: 200 });
      doc.text("Qty", 250, tableTop, { width: 50, align: "center" });
      doc.text("Price", 300, tableTop, { width: 100, align: "right" });
      doc.text("Total", 400, tableTop, { width: 100, align: "right" });
      
      doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
      doc.moveDown();

      // Items - use invoice items if available, otherwise customer products
      doc.font("Helvetica");
      let subtotal = 0;
      
      if (invoiceItems.length > 0) {
        for (const item of invoiceItems) {
          const price = parseFloat(item.unitPrice);
          const lineTotal = parseFloat(item.lineTotal);
          subtotal += lineTotal;

          const y = doc.y;
          doc.text(item.description, 50, y, { width: 200 });
          doc.text(item.quantity.toString(), 250, y, { width: 50, align: "center" });
          doc.text(`${price.toFixed(2)} ${invoice.currency}`, 300, y, { width: 100, align: "right" });
          doc.text(`${lineTotal.toFixed(2)} ${invoice.currency}`, 400, y, { width: 100, align: "right" });
          doc.moveDown(0.5);
        }
      } else {
        for (const cp of customerProducts) {
          const price = cp.priceOverride ? parseFloat(cp.priceOverride) : 0;
          const lineTotal = price * cp.quantity;
          subtotal += lineTotal;

          const y = doc.y;
          doc.text(cp.product.name, 50, y, { width: 200 });
          doc.text(cp.quantity.toString(), 250, y, { width: 50, align: "center" });
          doc.text(`${price.toFixed(2)} EUR`, 300, y, { width: 100, align: "right" });
          doc.text(`${lineTotal.toFixed(2)} EUR`, 400, y, { width: 100, align: "right" });
          doc.moveDown(0.5);
        }
      }

      // Totals
      doc.moveTo(50, doc.y + 10).lineTo(550, doc.y + 10).stroke();
      doc.moveDown();
      doc.fontSize(10).font("Helvetica");
      
      if (invoice.subtotal && invoice.vatRate && invoice.vatAmount) {
        doc.text(`Subtotal: ${parseFloat(invoice.subtotal).toFixed(2)} ${invoice.currency}`, { align: "right" });
        doc.text(`VAT (${parseFloat(invoice.vatRate).toFixed(0)}%): ${parseFloat(invoice.vatAmount).toFixed(2)} ${invoice.currency}`, { align: "right" });
        doc.moveDown(0.5);
      }
      
      doc.fontSize(12).font("Helvetica-Bold");
      doc.text(`Total: ${parseFloat(invoice.totalAmount).toFixed(2)} ${invoice.currency}`, { align: "right" });
      doc.moveDown(3);

      // Footer
      doc.fontSize(8).font("Helvetica").fillColor("gray");
      doc.text("Thank you for choosing INDEXUS for your cord blood banking needs.", { align: "center" });

      doc.end();
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // Bulk invoice generation
  app.post("/api/invoices/bulk-generate", requireAuth, async (req, res) => {
    try {
      const { customerIds } = req.body as { customerIds: string[] };
      
      if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
        return res.status(400).json({ error: "Please provide an array of customer IDs" });
      }

      const results: { customerId: string; success: boolean; invoiceId?: string; error?: string }[] = [];

      for (const customerId of customerIds) {
        try {
          const customer = await storage.getCustomer(customerId);
          if (!customer) {
            results.push({ customerId, success: false, error: "Customer not found" });
            continue;
          }

          const customerProducts = await storage.getCustomerProducts(customerId);
          if (customerProducts.length === 0) {
            results.push({ customerId, success: false, error: "No products to invoice" });
            continue;
          }

          const invoiceNumber = await storage.getNextInvoiceNumber();
          let totalAmount = 0;
          
          for (const cp of customerProducts) {
            const price = cp.priceOverride ? parseFloat(cp.priceOverride) : 0;
            totalAmount += price * cp.quantity;
          }

          const billingInfo = await storage.getBillingDetails(customer.country);
          const paymentTermDays = billingInfo?.defaultPaymentTerm || 14;
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + paymentTermDays);

          const invoice = await storage.createInvoice({
            invoiceNumber,
            customerId,
            totalAmount: totalAmount.toFixed(2),
            currency: "EUR",
            status: "generated",
            pdfPath: null,
            paymentTermDays,
            dueDate,
            billingCompanyName: billingInfo?.companyName || null,
            billingAddress: billingInfo?.address || null,
            billingCity: billingInfo?.city || null,
            billingTaxId: billingInfo?.taxId || null,
            billingBankName: billingInfo?.bankName || null,
            billingBankIban: billingInfo?.bankIban || null,
            billingBankSwift: billingInfo?.bankSwift || null,
          });

          results.push({ customerId, success: true, invoiceId: invoice.id });
        } catch (error) {
          results.push({ customerId, success: false, error: "Failed to generate invoice" });
        }
      }

      const successCount = results.filter(r => r.success).length;
      res.json({ 
        message: `Generated ${successCount} of ${customerIds.length} invoices`,
        results 
      });
    } catch (error) {
      console.error("Error in bulk invoice generation:", error);
      res.status(500).json({ error: "Failed to generate invoices" });
    }
  });

  // Billing Details (Billing Companies) API (protected)
  app.get("/api/billing-details", requireAuth, async (req, res) => {
    try {
      const userCountries = req.session.user?.assignedCountries || [];
      const { country } = req.query;
      
      if (country && typeof country === 'string') {
        // Only allow access if user has access to this country
        if (!userCountries.includes(country)) {
          return res.json([]);
        }
        const details = await storage.getBillingDetailsByCountry(country);
        return res.json(details);
      }
      
      // Filter all billing details by user's assigned countries (check countryCodes array)
      const allDetails = await storage.getAllBillingDetails();
      const filteredDetails = allDetails.filter(d => {
        const billingCountries = d.countryCodes?.length ? d.countryCodes : [d.countryCode];
        return billingCountries.some(country => userCountries.includes(country));
      });
      res.json(filteredDetails);
    } catch (error) {
      console.error("Error fetching billing details:", error);
      res.status(500).json({ error: "Failed to fetch billing details" });
    }
  });

  app.get("/api/billing-details/:id", requireAuth, async (req, res) => {
    try {
      const userCountries = req.session.user?.assignedCountries || [];
      const param = req.params.id;
      
      // Try to get by ID first
      const details = await storage.getBillingDetailsById(param);
      if (!details) {
        return res.status(404).json({ error: "Billing company not found" });
      }
      
      // Check if user has access to any of this billing company's countries
      const billingCountries = details.countryCodes?.length ? details.countryCodes : [details.countryCode];
      const hasAccess = billingCountries.some(country => userCountries.includes(country));
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(details);
    } catch (error) {
      console.error("Error fetching billing details:", error);
      res.status(500).json({ error: "Failed to fetch billing details" });
    }
  });

  app.post("/api/billing-details", requireAuth, async (req, res) => {
    try {
      const userCountries = req.session.user?.assignedCountries || [];
      const validatedData = insertBillingDetailsSchema.parse(req.body);
      
      // Normalize countryCodes - ensure it's populated
      const billingCountries = validatedData.countryCodes?.length 
        ? validatedData.countryCodes 
        : (validatedData.countryCode ? [validatedData.countryCode] : []);
      
      if (!billingCountries.length) {
        return res.status(400).json({ error: "At least one country must be selected" });
      }
      
      const hasAccess = billingCountries.every(country => userCountries.includes(country));
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied - you cannot create billing companies for these countries" });
      }
      
      // Normalize data: ensure countryCode is synchronized with first country in array
      const normalizedData = {
        ...validatedData,
        countryCodes: billingCountries,
        countryCode: billingCountries[0],
      };
      
      const details = await storage.createBillingDetails(normalizedData);
      res.status(201).json(details);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating billing company:", error);
      res.status(500).json({ error: "Failed to create billing company" });
    }
  });

  app.patch("/api/billing-details/:id", requireAuth, async (req, res) => {
    try {
      const userCountries = req.session.user?.assignedCountries || [];
      const userId = req.session.user?.id;
      
      // Check if user has access to this billing company's countries
      const existing = await storage.getBillingDetailsById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Billing company not found" });
      }
      const existingCountries = existing.countryCodes?.length ? existing.countryCodes : [existing.countryCode];
      const hasExistingAccess = existingCountries.some(country => userCountries.includes(country));
      if (!hasExistingAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Normalize the update payload
      let normalizedBody = { ...req.body };
      
      // If countryCodes is being updated, validate and normalize
      if ('countryCodes' in req.body) {
        const newCountries = Array.isArray(req.body.countryCodes) ? req.body.countryCodes : [];
        
        if (!newCountries.length) {
          return res.status(400).json({ error: "At least one country must be selected" });
        }
        
        const hasAccessToAll = newCountries.every(country => userCountries.includes(country));
        if (!hasAccessToAll) {
          return res.status(403).json({ error: "Access denied - you cannot assign countries you don't have access to" });
        }
        
        // Synchronize countryCode with first country
        normalizedBody.countryCodes = newCountries;
        normalizedBody.countryCode = newCountries[0];
      } else if ('countryCode' in req.body && req.body.countryCode !== existing.countryCode) {
        // If only countryCode is being updated (without countryCodes), validate access
        const newCountryCode = req.body.countryCode;
        if (!userCountries.includes(newCountryCode)) {
          return res.status(403).json({ error: "Access denied - you cannot assign a country you don't have access to" });
        }
        // Synchronize countryCodes with the new countryCode
        normalizedBody.countryCodes = [newCountryCode];
      }
      
      const details = await storage.updateBillingDetails(req.params.id, normalizedBody, userId);
      res.json(details);
    } catch (error) {
      console.error("Error updating billing company:", error);
      res.status(500).json({ error: "Failed to update billing company" });
    }
  });

  app.delete("/api/billing-details/:id", requireAuth, async (req, res) => {
    try {
      const userCountries = req.session.user?.assignedCountries || [];
      
      // Check if user has access to this billing company's countries
      const existing = await storage.getBillingDetailsById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Billing company not found" });
      }
      const existingCountries = existing.countryCodes?.length ? existing.countryCodes : [existing.countryCode];
      const hasAccess = existingCountries.some(country => userCountries.includes(country));
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const success = await storage.deleteBillingDetails(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Billing company not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting billing company:", error);
      res.status(500).json({ error: "Failed to delete billing company" });
    }
  });

  // Billing Company Accounts
  app.get("/api/billing-details/:id/accounts", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const accounts = await storage.getBillingCompanyAccounts(req.params.id);
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching billing company accounts:", error);
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  app.post("/api/billing-details/:id/accounts", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const account = await storage.createBillingCompanyAccount({
        ...req.body,
        billingDetailsId: req.params.id,
      });
      res.status(201).json(account);
    } catch (error) {
      console.error("Error creating billing company account:", error);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  app.patch("/api/billing-company-accounts/:id", requireAuth, async (req, res) => {
    try {
      // Get the account first to find its billing company
      const existingAccount = await storage.getBillingCompanyAccountById(req.params.id);
      if (!existingAccount) {
        return res.status(404).json({ error: "Account not found" });
      }
      if (!await checkBillingCompanyAccess(req, res, existingAccount.billingDetailsId)) return;
      
      const account = await storage.updateBillingCompanyAccount(req.params.id, req.body);
      res.json(account);
    } catch (error) {
      console.error("Error updating billing company account:", error);
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  app.delete("/api/billing-company-accounts/:id", requireAuth, async (req, res) => {
    try {
      // Get the account first to find its billing company
      const existingAccount = await storage.getBillingCompanyAccountById(req.params.id);
      if (!existingAccount) {
        return res.status(404).json({ error: "Account not found" });
      }
      if (!await checkBillingCompanyAccess(req, res, existingAccount.billingDetailsId)) return;
      
      const success = await storage.deleteBillingCompanyAccount(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting billing company account:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  app.post("/api/billing-details/:id/accounts/:accountId/default", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      await storage.setDefaultBillingCompanyAccount(req.params.id, req.params.accountId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting default account:", error);
      res.status(500).json({ error: "Failed to set default account" });
    }
  });

  // Billing Company Audit Log
  app.get("/api/billing-details/:id/audit-log", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const logs = await storage.getBillingCompanyAuditLog(req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit log:", error);
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  // Billing Company Laboratories
  app.get("/api/billing-details/:id/laboratories", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const labs = await storage.getBillingCompanyLaboratories(req.params.id);
      res.json(labs);
    } catch (error) {
      console.error("Error fetching laboratories:", error);
      res.status(500).json({ error: "Failed to fetch laboratories" });
    }
  });

  app.put("/api/billing-details/:id/laboratories", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const { laboratoryIds } = req.body as { laboratoryIds: string[] };
      await storage.setBillingCompanyLaboratories(req.params.id, laboratoryIds || []);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting laboratories:", error);
      res.status(500).json({ error: "Failed to set laboratories" });
    }
  });

  // Billing Company Collaborators
  app.get("/api/billing-details/:id/collaborators", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const collabs = await storage.getBillingCompanyCollaborators(req.params.id);
      res.json(collabs);
    } catch (error) {
      console.error("Error fetching collaborators:", error);
      res.status(500).json({ error: "Failed to fetch collaborators" });
    }
  });

  app.put("/api/billing-details/:id/collaborators", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const { collaboratorIds } = req.body as { collaboratorIds: string[] };
      await storage.setBillingCompanyCollaborators(req.params.id, collaboratorIds || []);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting collaborators:", error);
      res.status(500).json({ error: "Failed to set collaborators" });
    }
  });

  // Billing company couriers
  app.get("/api/billing-details/:id/couriers", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const couriers = await storage.getBillingCompanyCouriers(req.params.id);
      res.json(couriers);
    } catch (error) {
      console.error("Error fetching couriers:", error);
      res.status(500).json({ error: "Failed to fetch couriers" });
    }
  });

  app.post("/api/billing-details/:id/couriers", requireAuth, async (req, res) => {
    try {
      if (!await checkBillingCompanyAccess(req, res, req.params.id)) return;
      const courier = await storage.createBillingCompanyCourier({
        ...req.body,
        billingDetailsId: req.params.id,
      });
      res.json(courier);
    } catch (error) {
      console.error("Error creating courier:", error);
      res.status(500).json({ error: "Failed to create courier" });
    }
  });

  app.patch("/api/billing-details/:billingId/couriers/:courierId", requireAuth, async (req, res) => {
    try {
      // Verify the courier exists and belongs to the specified billing company
      const existingCourier = await storage.getBillingCompanyCourierById(req.params.courierId);
      if (!existingCourier) {
        return res.status(404).json({ error: "Courier not found" });
      }
      if (existingCourier.billingDetailsId !== req.params.billingId) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!await checkBillingCompanyAccess(req, res, existingCourier.billingDetailsId)) return;
      
      const courier = await storage.updateBillingCompanyCourier(req.params.courierId, req.body);
      res.json(courier);
    } catch (error) {
      console.error("Error updating courier:", error);
      res.status(500).json({ error: "Failed to update courier" });
    }
  });

  app.delete("/api/billing-details/:billingId/couriers/:courierId", requireAuth, async (req, res) => {
    try {
      // Verify the courier exists and belongs to the specified billing company
      const existingCourier = await storage.getBillingCompanyCourierById(req.params.courierId);
      if (!existingCourier) {
        return res.status(404).json({ error: "Courier not found" });
      }
      if (existingCourier.billingDetailsId !== req.params.billingId) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!await checkBillingCompanyAccess(req, res, existingCourier.billingDetailsId)) return;
      
      const deleted = await storage.deleteBillingCompanyCourier(req.params.courierId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting courier:", error);
      res.status(500).json({ error: "Failed to delete courier" });
    }
  });

  // Legacy endpoint for backwards compatibility
  app.put("/api/billing-details/:countryCode", requireAuth, async (req, res) => {
    try {
      const validatedData = insertBillingDetailsSchema.parse({
        ...req.body,
        countryCode: req.params.countryCode,
      });
      const details = await storage.upsertBillingDetails(validatedData);
      res.json(details);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating billing details:", error);
      res.status(500).json({ error: "Failed to update billing details" });
    }
  });

  // Manual invoice creation with items
  app.post("/api/customers/:customerId/invoices/manual", requireAuth, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const { items, currency, paymentTermDays: requestedPaymentDays } = req.body as {
        items: Array<{ productId?: string; description: string; quantity: number; unitPrice: string }>;
        currency: string;
        paymentTermDays?: number;
      };

      if (!items || items.length === 0) {
        return res.status(400).json({ error: "At least one item is required" });
      }

      // Get billing details for the customer's country
      const billingInfo = await storage.getBillingDetails(customer.country);
      const vatRate = billingInfo ? parseFloat(billingInfo.vatRate) : 0;
      const paymentTermDays = requestedPaymentDays || billingInfo?.defaultPaymentTerm || 14;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + paymentTermDays);

      // Calculate totals
      let subtotal = 0;
      const invoiceItems: Array<{ productId: string | null; description: string; quantity: number; unitPrice: string; lineTotal: string }> = [];

      for (const item of items) {
        const lineTotal = parseFloat(item.unitPrice) * item.quantity;
        subtotal += lineTotal;
        invoiceItems.push({
          productId: item.productId || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: lineTotal.toFixed(2),
        });
      }

      const vatAmount = subtotal * (vatRate / 100);
      const totalAmount = subtotal + vatAmount;

      // Create invoice
      const invoiceNumber = await storage.getNextInvoiceNumber();
      const invoice = await storage.createInvoice({
        invoiceNumber,
        customerId: customer.id,
        subtotal: subtotal.toFixed(2),
        vatRate: vatRate.toString(),
        vatAmount: vatAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        currency: currency || billingInfo?.currency || "EUR",
        status: "generated",
        pdfPath: null,
        paymentTermDays,
        dueDate,
        billingCompanyName: billingInfo?.companyName || null,
        billingAddress: billingInfo?.address || null,
        billingCity: billingInfo?.city || null,
        billingTaxId: billingInfo?.taxId || null,
        billingBankName: billingInfo?.bankName || null,
        billingBankIban: billingInfo?.bankIban || null,
        billingBankSwift: billingInfo?.bankSwift || null,
      });

      // Create invoice items
      await storage.createInvoiceItems(
        invoiceItems.map(item => ({
          invoiceId: invoice.id,
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        }))
      );

      res.status(201).json({ 
        invoice,
        subtotal: subtotal.toFixed(2),
        vatRate,
        vatAmount: vatAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
      });
    } catch (error) {
      console.error("Error creating manual invoice:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  // Get invoice with items
  app.get("/api/invoices/:id/details", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const items = await storage.getInvoiceItems(invoice.id);
      const customer = await storage.getCustomer(invoice.customerId);
      const billingInfo = customer ? await storage.getBillingDetails(customer.country) : null;
      
      res.json({ invoice, items, customer, billingInfo });
    } catch (error) {
      console.error("Error fetching invoice details:", error);
      res.status(500).json({ error: "Failed to fetch invoice details" });
    }
  });

  // Customer Notes API
  app.get("/api/customers/:customerId/notes", requireAuth, async (req, res) => {
    try {
      const notes = await storage.getCustomerNotes(req.params.customerId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching customer notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/customers/:customerId/notes", requireAuth, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const { content } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Note content is required" });
      }

      const note = await storage.createCustomerNote({
        customerId: req.params.customerId,
        userId: req.session.user!.id,
        content,
      });

      // Log activity
      await logActivity(
        req.session.user!.id,
        "note_added",
        "customer",
        customer.id,
        `${customer.firstName} ${customer.lastName}`,
        { noteId: note.id, content },
        req.ip
      );

      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating customer note:", error);
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.delete("/api/customers/:customerId/notes/:noteId", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteCustomerNote(req.params.noteId);
      if (!deleted) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json({ message: "Note deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer note:", error);
      res.status(500).json({ error: "Failed to delete note" });
    }
  });

  // Activity Logs API
  app.get("/api/activity-logs", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAllActivityLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  app.get("/api/users/:userId/activity-logs", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getActivityLogsByUser(req.params.userId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching user activity logs:", error);
      res.status(500).json({ error: "Failed to fetch user activity logs" });
    }
  });

  app.get("/api/customers/:customerId/activity-logs", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getActivityLogsByEntity("customer", req.params.customerId);
      
      // Also get consent logs (stored with entityType="consent" but with customerId in details)
      const consentLogs = await storage.getConsentLogsByCustomerId(req.params.customerId);
      
      // Also get campaign participations from campaign_contacts table
      const campaignContacts = await storage.getCampaignContactsByCustomer(req.params.customerId);
      
      // Create synthetic activity logs for campaign participations that don't have real logs
      const campaignLogs = campaignContacts.map(cc => ({
        id: `campaign-${cc.id}`,
        userId: null,
        action: "campaign_joined",
        entityType: "customer",
        entityId: req.params.customerId,
        entityName: null,
        details: JSON.stringify({ 
          campaignId: cc.campaignId, 
          campaignName: cc.campaign?.name || "Kampaň",
          synthetic: true 
        }),
        ipAddress: null,
        createdAt: cc.createdAt,
      }));
      
      // Filter out synthetic logs for campaigns that already have real activity logs
      const existingCampaignIds = new Set(
        logs
          .filter(l => l.action === "campaign_joined")
          .map(l => {
            try {
              const details = JSON.parse(l.details || "{}");
              return details.campaignId;
            } catch { return null; }
          })
          .filter(Boolean)
      );
      
      const newCampaignLogs = campaignLogs.filter(cl => {
        try {
          const details = JSON.parse(cl.details || "{}");
          return !existingCampaignIds.has(details.campaignId);
        } catch { return true; }
      });
      
      // Combine and sort by date
      const allLogs = [...logs, ...consentLogs, ...newCampaignLogs].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      res.json(allLogs);
    } catch (error) {
      console.error("Error fetching customer activity logs:", error);
      res.status(500).json({ error: "Failed to fetch customer activity logs" });
    }
  });

  // Communication Messages API
  app.get("/api/customers/:customerId/messages", requireAuth, async (req, res) => {
    try {
      const messages = await storage.getCommunicationMessagesByCustomer(req.params.customerId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching customer messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Update a communication message (for editing saved email records)
  app.patch("/api/customers/:customerId/messages/:messageId", requireAuth, async (req, res) => {
    try {
      const { subject, content } = req.body;
      
      const updated = await storage.updateCommunicationMessage(req.params.messageId, {
        subject,
        content,
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating message:", error);
      res.status(500).json({ error: "Failed to update message" });
    }
  });

  app.post("/api/customers/:customerId/messages/email", requireAuth, async (req, res) => {
    try {
      const parsed = sendEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }
      const { subject, content } = parsed.data;
      
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      if (!customer.email) {
        return res.status(400).json({ error: "Customer has no email address" });
      }

      const user = req.session.user!;
      
      // Create message record
      const message = await storage.createCommunicationMessage({
        customerId: req.params.customerId,
        userId: user.id,
        type: "email",
        subject,
        content,
        recipientEmail: customer.email,
        status: "pending",
      });

      // Try to send email via SendGrid or fallback to simulation
      const sendGridApiKey = process.env.SENDGRID_API_KEY;
      const fromEmail = process.env.EMAIL_FROM || "noreply@nexusbiolink.com";
      
      if (sendGridApiKey) {
        try {
          const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${sendGridApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: customer.email }] }],
              from: { email: fromEmail },
              subject,
              content: [{ type: "text/plain", value: content }],
            }),
          });

          if (response.ok) {
            await storage.updateCommunicationMessage(message.id, {
              status: "sent",
              sentAt: new Date(),
            });
            
            await logActivity(user.id, "send_email", "communication", message.id, 
              `Email to ${customer.firstName} ${customer.lastName}`, { subject });
            
            return res.json({ ...message, status: "sent", sentAt: new Date() });
          } else {
            const errorText = await response.text();
            await storage.updateCommunicationMessage(message.id, {
              status: "failed",
              errorMessage: errorText,
            });
            return res.status(500).json({ error: "Failed to send email", details: errorText });
          }
        } catch (emailError: any) {
          await storage.updateCommunicationMessage(message.id, {
            status: "failed",
            errorMessage: emailError.message,
          });
          return res.status(500).json({ error: "Failed to send email", details: emailError.message });
        }
      } else {
        // Simulate sending (for demo purposes when no API key configured)
        await storage.updateCommunicationMessage(message.id, {
          status: "sent",
          sentAt: new Date(),
        });
        
        await logActivity(user.id, "send_email", "communication", message.id, 
          `Email to ${customer.firstName} ${customer.lastName}`, { subject, simulated: true });
        
        res.json({ ...message, status: "sent", sentAt: new Date(), simulated: true });
      }
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Send invoice calculation email with HTML format
  app.post("/api/send-invoice-email", requireAuth, async (req, res) => {
    try {
      const { customerId, billsetId, recipients } = req.body;
      
      if (!customerId || !billsetId || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      const productSet = await storage.getProductSet(billsetId);
      if (!productSet) {
        return res.status(404).json({ error: "Product set not found" });
      }
      
      const collections = await storage.getProductSetCollections(billsetId);
      const storageItems = await storage.getProductSetStorage(billsetId);
      
      // Enrich with names
      const enrichedCollections = await Promise.all(collections.map(async (col: any) => {
        if (col.instanceId) {
          const instance = await storage.getMarketProductInstance(col.instanceId);
          return { ...col, instanceName: instance?.name || null };
        }
        return col;
      }));
      
      const enrichedStorage = await Promise.all(storageItems.map(async (stor: any) => {
        if (stor.serviceId) {
          const service = await storage.getMarketProductService(stor.serviceId);
          return { ...stor, serviceName: service?.name || null };
        }
        return stor;
      }));
      
      // Get billing company details
      let billingCompany: any = null;
      if (customer.country) {
        const billingDetails = await storage.getBillingDetailsByCountry(customer.country);
        if (billingDetails.length > 0) {
          billingCompany = billingDetails[0];
        }
      }
      
      const currencySymbol = productSet.currency === "EUR" ? "€" : 
                             productSet.currency === "CZK" ? "Kč" : 
                             productSet.currency === "USD" ? "$" : productSet.currency;
      
      // Calculate totals
      let totalGross = 0;
      
      // Build HTML email content
      let collectionsHtml = '';
      enrichedCollections.forEach((col: any, idx: number) => {
        const lineGross = parseFloat(col.lineGrossAmount || 0);
        totalGross += lineGross;
        collectionsHtml += `
          <tr style="background-color: #eff6ff;">
            <td style="padding: 12px; border-bottom: 1px solid #dbeafe;">
              <strong>${idx + 1}. Odber</strong>
              ${col.instanceName ? `<br><span style="color: #6b7280; font-size: 14px;">${col.instanceName}</span>` : ''}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #dbeafe; text-align: right; font-family: monospace;">
              ${lineGross.toFixed(2)} ${currencySymbol}
            </td>
          </tr>
        `;
      });
      
      let storageHtml = '';
      enrichedStorage.forEach((stor: any, idx: number) => {
        const lineGross = parseFloat(stor.lineGrossAmount || stor.priceOverride || 0);
        totalGross += lineGross;
        storageHtml += `
          <tr style="background-color: #f0fdf4;">
            <td style="padding: 12px; border-bottom: 1px solid #dcfce7;">
              <strong>${enrichedCollections.length + idx + 1}. Uskladnenie</strong>
              ${stor.serviceName ? `<br><span style="color: #6b7280; font-size: 14px;">${stor.serviceName}</span>` : ''}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #dcfce7; text-align: right; font-family: monospace;">
              ${lineGross.toFixed(2)} ${currencySymbol}
            </td>
          </tr>
        `;
      });
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Kalkulácia faktúry</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${billingCompany ? `
  <div style="border-bottom: 2px solid #7c3aed; padding-bottom: 20px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: #7c3aed;">${billingCompany.name || 'Fakturačná spoločnosť'}</h2>
    ${billingCompany.address ? `<p style="margin: 5px 0; color: #6b7280;">${billingCompany.address}</p>` : ''}
    ${billingCompany.ico ? `<p style="margin: 5px 0; color: #6b7280;">IČO: ${billingCompany.ico}</p>` : ''}
  </div>
  ` : ''}
  
  <h1 style="color: #1f2937; font-size: 24px; margin-bottom: 10px;">Kalkulácia faktúry</h1>
  <p style="color: #6b7280; margin-bottom: 20px;">Zostava: <strong>${productSet.name}</strong></p>
  
  <p style="margin-bottom: 20px;">
    Vážený/á ${customer.firstName} ${customer.lastName},<br>
    nižšie nájdete kalkuláciu vašej faktúry:
  </p>
  
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <thead>
      <tr style="background-color: #f3f4f6;">
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Položka</th>
        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Cena s DPH</th>
      </tr>
    </thead>
    <tbody>
      ${collectionsHtml}
      ${storageHtml}
    </tbody>
    <tfoot>
      <tr style="background-color: #f9fafb;">
        <td style="padding: 12px; font-weight: bold; border-top: 2px solid #e5e7eb;">Celkom:</td>
        <td style="padding: 12px; font-weight: bold; text-align: right; font-family: monospace; border-top: 2px solid #e5e7eb; font-size: 18px; color: #7c3aed;">
          ${totalGross.toFixed(2)} ${currencySymbol}
        </td>
      </tr>
    </tfoot>
  </table>
  
  <p style="color: #6b7280; font-size: 14px;">
    V prípade otázok nás neváhajte kontaktovať.
  </p>
  
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
  
  <p style="color: #9ca3af; font-size: 12px;">
    Tento email bol vygenerovaný automaticky z CRM systému INDEXUS.
  </p>
</body>
</html>
      `;
      
      const user = req.session.user!;
      const subject = `Kalkulácia faktúry - ${productSet.name}`;
      
      // Create message record for each recipient
      for (const recipientEmail of recipients) {
        const message = await storage.createCommunicationMessage({
          customerId,
          userId: user.id,
          type: "email",
          subject,
          content: htmlContent,
          recipientEmail,
          status: "pending",
        });
        
        // Try to send email via SendGrid or fallback to simulation
        const sendGridApiKey = process.env.SENDGRID_API_KEY;
        const fromEmail = process.env.EMAIL_FROM || "noreply@nexusbiolink.com";
        
        if (sendGridApiKey) {
          try {
            const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${sendGridApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                personalizations: [{ to: [{ email: recipientEmail }] }],
                from: { email: fromEmail },
                subject,
                content: [{ type: "text/html", value: htmlContent }],
              }),
            });

            if (response.ok) {
              await storage.updateCommunicationMessage(message.id, {
                status: "sent",
                sentAt: new Date(),
              });
            } else {
              const errorText = await response.text();
              await storage.updateCommunicationMessage(message.id, {
                status: "failed",
                errorMessage: errorText,
              });
            }
          } catch (emailError: any) {
            await storage.updateCommunicationMessage(message.id, {
              status: "failed",
              errorMessage: emailError.message,
            });
          }
        } else {
          // Simulate sending
          await storage.updateCommunicationMessage(message.id, {
            status: "sent",
            sentAt: new Date(),
          });
        }
        
        await logActivity(user.id, "send_email", "communication", message.id, 
          `Invoice calculation email to ${customer.firstName} ${customer.lastName}`, { subject, recipient: recipientEmail });
      }
      
      res.json({ success: true, recipientCount: recipients.length });
    } catch (error) {
      console.error("Error sending invoice email:", error);
      res.status(500).json({ error: "Failed to send invoice email" });
    }
  });

  app.post("/api/customers/:customerId/messages/sms", requireAuth, async (req, res) => {
    try {
      const parsed = sendSmsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }
      const { content } = parsed.data;
      
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      if (!customer.phone) {
        return res.status(400).json({ error: "Customer has no phone number" });
      }

      const user = req.session.user!;
      
      // Create message record
      const message = await storage.createCommunicationMessage({
        customerId: req.params.customerId,
        userId: user.id,
        type: "sms",
        direction: "outbound",
        content,
        recipientPhone: customer.phone,
        status: "pending",
        provider: "bulkgate",
      });

      // Try to send SMS via BulkGate or fallback to simulation
      const { sendTransactionalSms, isBulkGateConfigured } = await import("./lib/bulkgate");
      
      if (isBulkGateConfigured()) {
        try {
          const result = await sendTransactionalSms({
            number: customer.phone,
            text: content,
            country: customer.country || undefined,
            tag: `customer-${customer.id}`,
          });

          if (result.success) {
            await storage.updateCommunicationMessage(message.id, {
              status: "sent",
              sentAt: new Date(),
              externalId: result.smsId,
            });
            
            await logActivity(user.id, "send_sms", "communication", message.id, 
              `SMS to ${customer.firstName} ${customer.lastName}`);
            
            return res.json({ ...message, status: "sent", sentAt: new Date(), smsId: result.smsId });
          } else {
            await storage.updateCommunicationMessage(message.id, {
              status: "failed",
              errorMessage: result.error || "BulkGate error",
            });
            return res.status(500).json({ error: "Failed to send SMS", details: result.error });
          }
        } catch (smsError: any) {
          await storage.updateCommunicationMessage(message.id, {
            status: "failed",
            errorMessage: smsError.message,
          });
          return res.status(500).json({ error: "Failed to send SMS", details: smsError.message });
        }
      } else {
        // Simulate sending (for demo purposes when no credentials configured)
        await storage.updateCommunicationMessage(message.id, {
          status: "sent",
          sentAt: new Date(),
        });
        
        await logActivity(user.id, "send_sms", "communication", message.id, 
          `SMS to ${customer.firstName} ${customer.lastName}`, { simulated: true });
        
        res.json({ ...message, status: "sent", sentAt: new Date(), simulated: true });
      }
    } catch (error) {
      console.error("Error sending SMS:", error);
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  app.get("/api/communication-messages", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const messages = await storage.getAllCommunicationMessages(limit);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching communication messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // ========== BULKGATE SMS GATEWAY ==========
  
  // Get BulkGate status
  app.get("/api/bulkgate/status", requireAuth, async (req, res) => {
    try {
      const { getBulkGateStatus, getCredit } = await import("./lib/bulkgate");
      const status = getBulkGateStatus();
      
      if (status.configured) {
        const creditResult = await getCredit();
        return res.json({
          ...status,
          credit: creditResult.success ? creditResult.credit : null,
          currency: creditResult.success ? creditResult.currency : null,
          creditError: creditResult.success ? null : creditResult.error,
        });
      }
      
      res.json(status);
    } catch (error) {
      console.error("Error getting BulkGate status:", error);
      res.status(500).json({ error: "Failed to get BulkGate status" });
    }
  });
  
  // Send SMS via BulkGate (direct, without customer)
  app.post("/api/bulkgate/send", requireAuth, async (req, res) => {
    try {
      const { number, text, country, senderId, senderIdValue, tag } = req.body;
      
      if (!number || !text) {
        return res.status(400).json({ error: "Missing required fields: number, text" });
      }
      
      const { sendTransactionalSms, isBulkGateConfigured } = await import("./lib/bulkgate");
      
      if (!isBulkGateConfigured()) {
        return res.status(400).json({ error: "BulkGate nie je nakonfigurovaný" });
      }
      
      const user = req.session.user!;
      
      // Create message record
      const message = await storage.createCommunicationMessage({
        userId: user.id,
        type: "sms",
        direction: "outbound",
        content: text,
        recipientPhone: number,
        status: "pending",
        provider: "bulkgate",
      });
      
      const result = await sendTransactionalSms({
        number,
        text,
        country,
        senderId,
        senderIdValue,
        tag,
      });
      
      if (result.success) {
        await storage.updateCommunicationMessage(message.id, {
          status: "sent",
          sentAt: new Date(),
          externalId: result.smsId,
        });
        
        await logActivity(user.id, "send_sms", "communication", message.id, `SMS to ${number}`);
        
        return res.json({
          success: true,
          messageId: message.id,
          smsId: result.smsId,
          partIds: result.partIds,
        });
      } else {
        await storage.updateCommunicationMessage(message.id, {
          status: "failed",
          errorMessage: result.error,
        });
        
        return res.status(500).json({ error: result.error });
      }
    } catch (error) {
      console.error("Error sending SMS via BulkGate:", error);
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });
  
  // BulkGate DLR/webhook callback (delivery reports + incoming SMS)
  // Supports both GET (low-level API) and POST (bulk API)
  app.all("/api/auth/bulkgate/callback", async (req, res) => {
    try {
      const { parseWebhook, verifyWebhookToken } = await import("./lib/bulkgate");
      
      // Normalize payload - POST uses body, GET uses query params
      const payload = req.method === "GET" ? req.query : req.body;
      const token = (req.query.token as string) || payload.token;
      
      console.log(`[BulkGate DLR] ${req.method} received:`, JSON.stringify(payload));
      
      // Verify token if configured
      if (!verifyWebhookToken(token)) {
        console.warn("[BulkGate DLR] Invalid or missing token");
        return res.status(403).json({ received: false, error: "Invalid token" });
      }
      
      const webhookData = parseWebhook(payload);
      console.log(`[BulkGate DLR] Parsed as: ${webhookData.type}, status=${payload.status}`);
      
      if (webhookData.type === "delivery_report") {
        // Update message status based on delivery report
        if (webhookData.smsId) {
          const messages = await storage.getAllCommunicationMessages(1000);
          const message = messages.find(m => m.externalId === webhookData.smsId);
          
          if (message) {
            // Map BulkGate status codes to readable status
            const statusMap: Record<string, string> = {
              "1": "pending", "2": "sent", "3": "delivered",
              "4": "failed", "5": "expired", "6": "rejected",
            };
            const readableStatus = statusMap[webhookData.status || ""] || webhookData.status;
            
            await storage.updateCommunicationMessage(message.id, {
              deliveryStatus: readableStatus,
              deliveredAt: readableStatus === "delivered" ? new Date() : undefined,
              status: readableStatus === "delivered" ? "delivered" : 
                      readableStatus === "failed" ? "failed" : message.status,
            });
            console.log(`[BulkGate DLR] Updated message ${message.id} with status: ${readableStatus}`);
          }
        }
      } else if (webhookData.type === "inbox") {
        // Store incoming SMS (status = 10)
        const incomingMessage = await storage.createCommunicationMessage({
          type: "sms",
          direction: "inbound",
          content: webhookData.text || "",
          senderPhone: webhookData.number,
          status: "received",
          provider: "bulkgate",
          externalId: webhookData.smsId,
        });
        
        console.log(`[BulkGate DLR] Stored incoming SMS from ${webhookData.number}: ${incomingMessage.id}`);
        
        // Try to link to customer by phone number
        let linkedCustomerId: string | undefined;
        if (webhookData.number) {
          const customers = await storage.findCustomersByPhone(webhookData.number);
          if (customers.length > 0) {
            linkedCustomerId = customers[0].id;
            await storage.updateCommunicationMessage(incomingMessage.id, {
              customerId: customers[0].id,
            });
            console.log(`[BulkGate DLR] Linked incoming SMS to customer ${customers[0].firstName} ${customers[0].lastName}`);
          }
        }
        
        // Run AI analysis for incoming SMS
        if (webhookData.text) {
          try {
            const aiResult = await analyzeSmsContent(webhookData.text);
            if (aiResult) {
              await storage.updateCommunicationMessage(incomingMessage.id, {
                aiAnalyzed: true,
                aiSentiment: aiResult.sentiment,
                aiAlertLevel: aiResult.alertLevel,
                aiHasAngryTone: aiResult.hasAngryTone,
                aiHasRudeExpressions: aiResult.hasRudeExpressions,
                aiWantsToCancel: aiResult.wantsToCancel,
                aiWantsConsent: aiResult.wantsConsent,
                aiDoesNotAcceptContract: aiResult.doesNotAcceptContract,
                aiAnalysisNote: aiResult.note,
                aiAnalyzedAt: new Date(),
              });
              console.log(`[BulkGate DLR] AI analysis complete for SMS ${incomingMessage.id}: sentiment=${aiResult.sentiment}, alert=${aiResult.alertLevel}`);
              
              // Trigger notification for negative sentiment SMS
              if (aiResult.sentiment === "negative" || aiResult.sentiment === "angry" || aiResult.hasAngryTone) {
                try {
                  let customerName: string | null = null;
                  let countryCode: string | undefined;
                  if (linkedCustomerId) {
                    const customer = await storage.getCustomer(linkedCustomerId);
                    if (customer) {
                      customerName = `${customer.firstName} ${customer.lastName}`;
                      countryCode = customer.country;
                    }
                  }
                  
                  await notificationService.triggerNotification("sentiment_negative", {
                    title: `Negatívna SMS od ${customerName || webhookData.number}`,
                    message: aiResult.note || `SMS obsahuje negatívny sentiment`,
                    entityType: "sms",
                    entityId: incomingMessage.id,
                    countryCode: countryCode,
                    priority: aiResult.alertLevel === "critical" ? "urgent" : aiResult.alertLevel === "warning" ? "high" : "normal",
                    metadata: {
                      sentiment: aiResult.sentiment,
                      alertLevel: aiResult.alertLevel,
                      hasAngryTone: aiResult.hasAngryTone,
                      wantsToCancel: aiResult.wantsToCancel,
                      customerName: customerName,
                      senderPhone: webhookData.number,
                    }
                  });
                  console.log(`[BulkGate DLR] Notification triggered for negative sentiment SMS ${incomingMessage.id}`);
                } catch (notifError) {
                  console.error("[BulkGate DLR] Error triggering notification:", notifError);
                }
              }
            }
          } catch (aiError) {
            console.error("[BulkGate DLR] AI analysis failed:", aiError);
          }
        }
      }
      
      // Always respond with 200 OK to acknowledge callback
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("[BulkGate DLR] Error processing callback:", error);
      // Still return 200 to prevent callback retries
      res.status(200).json({ received: true, error: "Processing error" });
    }
  });
  
  // Get all SMS messages (both sent and received)
  app.get("/api/sms-messages", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const direction = req.query.direction as string | undefined;
      
      const messages = await storage.getAllCommunicationMessages(limit);
      const smsMessages = messages.filter(m => {
        if (m.type !== "sms") return false;
        if (direction && m.direction !== direction) return false;
        return true;
      });
      
      // Enrich with customer data
      const enrichedMessages = await Promise.all(smsMessages.map(async (msg) => {
        if (msg.customerId) {
          const customer = await storage.getCustomer(msg.customerId);
          if (customer) {
            return {
              ...msg,
              customer: {
                id: customer.id,
                firstName: customer.firstName,
                lastName: customer.lastName,
              },
            };
          }
        }
        return msg;
      }));
      
      res.json(enrichedMessages);
    } catch (error) {
      console.error("Error fetching SMS messages:", error);
      res.status(500).json({ error: "Failed to fetch SMS messages" });
    }
  });

  // ========== GSM SENDER CONFIGURATION ==========

  // Get BulkGate credit
  app.get("/api/integrations/bulkgate/credit", requireAuth, async (req, res) => {
    try {
      const { getCredit } = await import("./lib/bulkgate");
      const result = await getCredit();
      res.json(result);
    } catch (error) {
      console.error("Error fetching BulkGate credit:", error);
      res.status(500).json({ success: false, error: "Failed to fetch credit" });
    }
  });

  // Get all GSM sender configs
  app.get("/api/config/gsm-sender-configs", requireAuth, async (req, res) => {
    try {
      const configs = await storage.getAllGsmSenderConfigs();
      res.json(configs);
    } catch (error) {
      console.error("Error fetching GSM sender configs:", error);
      res.status(500).json({ error: "Failed to fetch GSM sender configs" });
    }
  });

  // Upsert GSM sender config (create or update by country)
  app.post("/api/config/gsm-sender-configs", requireAuth, async (req, res) => {
    try {
      const parsed = insertGsmSenderConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      
      // Server-side guard: Clear senderIdValue for types that don't need it
      // gSystem, gShort, gPush don't need values - BulkGate generates them automatically
      const typesWithoutValue = ["gSystem", "gShort", "gPush"];
      const dataToSave = {
        ...parsed.data,
        senderIdValue: typesWithoutValue.includes(parsed.data.senderIdType) 
          ? null 
          : parsed.data.senderIdValue,
      };
      
      const config = await storage.upsertGsmSenderConfig(dataToSave);
      await logActivity(req.session.user!.id, "upsert", "gsm_sender_config", config.id, config.countryCode);
      res.json(config);
    } catch (error) {
      console.error("Error upserting GSM sender config:", error);
      res.status(500).json({ error: "Failed to save GSM sender config" });
    }
  });

  // Delete GSM sender config
  app.delete("/api/config/gsm-sender-configs/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteGsmSenderConfig(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Config not found" });
      }
      await logActivity(req.session.user!.id, "delete", "gsm_sender_config", req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting GSM sender config:", error);
      res.status(500).json({ error: "Failed to delete GSM sender config" });
    }
  });

  // ========== COUNTRY SYSTEM SETTINGS ==========
  
  // Get all country system settings
  app.get("/api/config/country-system-settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getAllCountrySystemSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching country system settings:", error);
      res.status(500).json({ error: "Failed to fetch country system settings" });
    }
  });

  // Get country system settings by country code
  app.get("/api/config/country-system-settings/:countryCode", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getCountrySystemSettingsByCountry(req.params.countryCode);
      res.json(settings || null);
    } catch (error) {
      console.error("Error fetching country system settings:", error);
      res.status(500).json({ error: "Failed to fetch country system settings" });
    }
  });

  // Upsert country system settings (create or update by country)
  app.post("/api/config/country-system-settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.upsertCountrySystemSettings(req.body);
      await logActivity(req.session.user!.id, "upsert", "country_system_settings", settings.id, settings.countryCode);
      res.json(settings);
    } catch (error) {
      console.error("Error upserting country system settings:", error);
      res.status(500).json({ error: "Failed to save country system settings" });
    }
  });

  // Delete country system settings
  app.delete("/api/config/country-system-settings/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteCountrySystemSettings(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Settings not found" });
      }
      await logActivity(req.session.user!.id, "delete", "country_system_settings", req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting country system settings:", error);
      res.status(500).json({ error: "Failed to delete country system settings" });
    }
  });

  // ========== SYSTEM MS365 CONNECTIONS (per-country system email) ==========

  // Get all system MS365 connections
  app.get("/api/config/system-ms365-connections", requireAuth, async (req, res) => {
    try {
      const connections = await storage.getAllSystemMs365Connections();
      // Don't expose tokens, just connection status
      const safeConnections = connections.map(conn => ({
        id: conn.id,
        countryCode: conn.countryCode,
        email: conn.email,
        displayName: conn.displayName,
        isConnected: conn.isConnected,
        lastSyncAt: conn.lastSyncAt,
        connectedByUserId: conn.connectedByUserId,
        createdAt: conn.createdAt,
        hasTokens: !!conn.accessToken,
      }));
      res.json(safeConnections);
    } catch (error) {
      console.error("Error fetching system MS365 connections:", error);
      res.status(500).json({ error: "Failed to fetch system MS365 connections" });
    }
  });

  // Get system MS365 connection for a country
  app.get("/api/config/system-ms365-connections/:countryCode", requireAuth, async (req, res) => {
    try {
      const connection = await storage.getSystemMs365Connection(req.params.countryCode);
      if (!connection) {
        return res.json(null);
      }
      // Don't expose tokens
      res.json({
        id: connection.id,
        countryCode: connection.countryCode,
        email: connection.email,
        displayName: connection.displayName,
        isConnected: connection.isConnected,
        lastSyncAt: connection.lastSyncAt,
        connectedByUserId: connection.connectedByUserId,
        createdAt: connection.createdAt,
        hasTokens: !!connection.accessToken,
      });
    } catch (error) {
      console.error("Error fetching system MS365 connection:", error);
      res.status(500).json({ error: "Failed to fetch system MS365 connection" });
    }
  });

  // Initiate MS365 auth for system email (stores country code in state)
  app.post("/api/config/system-ms365-connections/:countryCode/auth", requireAuth, async (req, res) => {
    try {
      const countryCode = req.params.countryCode;
      const userId = req.session.user!.id;
      
      const { getAuthorizationUrl, isConfigured } = await import("./lib/ms365");
      
      if (!isConfigured()) {
        return res.status(400).json({ error: "MS365 integration not configured" });
      }
      
      // Generate auth URL with system email state prefix
      const { url, codeVerifier, state } = await getAuthorizationUrl(`system:${countryCode}`, false);
      
      // Store PKCE verifier in database (persisted across server restarts)
      await storage.savePkceEntry(state, codeVerifier, 'system', userId, countryCode);
      
      res.json({ authUrl: url });
    } catch (error) {
      console.error("Error initiating system MS365 auth:", error);
      res.status(500).json({ error: "Failed to initiate MS365 authentication" });
    }
  });

  // Save system MS365 connection (called after OAuth callback)
  app.post("/api/config/system-ms365-connections/:countryCode", requireAuth, async (req, res) => {
    try {
      const countryCode = req.params.countryCode;
      const userId = req.session.user!.id;
      const { email, displayName, accessToken, refreshToken, tokenExpiresAt, accountId } = req.body;
      
      // Check if connection already exists
      const existing = await storage.getSystemMs365Connection(countryCode);
      
      if (existing) {
        // Update existing connection
        const updated = await storage.updateSystemMs365Connection(countryCode, {
          email,
          displayName,
          accessToken,
          refreshToken,
          tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : undefined,
          accountId,
          isConnected: true,
          connectedByUserId: userId,
        });
        await logActivity(userId, "update", "system_ms365_connection", existing.id, `Updated system email for ${countryCode}`);
        res.json({
          id: updated!.id,
          countryCode: updated!.countryCode,
          email: updated!.email,
          displayName: updated!.displayName,
          isConnected: updated!.isConnected,
          hasTokens: true,
        });
      } else {
        // Create new connection
        const created = await storage.createSystemMs365Connection({
          countryCode,
          email,
          displayName,
          accessToken,
          refreshToken,
          tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : undefined,
          accountId,
          isConnected: true,
          connectedByUserId: userId,
        });
        await logActivity(userId, "create", "system_ms365_connection", created.id, `Connected system email for ${countryCode}`);
        res.json({
          id: created.id,
          countryCode: created.countryCode,
          email: created.email,
          displayName: created.displayName,
          isConnected: created.isConnected,
          hasTokens: true,
        });
      }
    } catch (error) {
      console.error("Error saving system MS365 connection:", error);
      res.status(500).json({ error: "Failed to save system MS365 connection" });
    }
  });

  // Disconnect system MS365 for a country
  app.delete("/api/config/system-ms365-connections/:countryCode", requireAuth, async (req, res) => {
    try {
      const countryCode = req.params.countryCode;
      const userId = req.session.user!.id;
      
      const deleted = await storage.deleteSystemMs365Connection(countryCode);
      if (!deleted) {
        return res.status(404).json({ error: "Connection not found" });
      }
      
      await logActivity(userId, "delete", "system_ms365_connection", countryCode, `Disconnected system email for ${countryCode}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting system MS365:", error);
      res.status(500).json({ error: "Failed to disconnect system MS365" });
    }
  });

  // ========== NOTIFICATIONS ==========

  // Get notifications for current user
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const includeRead = req.query.includeRead === "true";
      const includeDismissed = req.query.includeDismissed === "true";
      
      const notificationsList = await storage.getNotifications(userId, { limit, includeRead, includeDismissed });
      res.json(notificationsList);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Get unread notifications count
  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const count = await storage.getUnreadNotificationsCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  // Mark notification as read
  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const notification = await storage.markNotificationRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification read:", error);
      res.status(500).json({ error: "Failed to mark notification read" });
    }
  });

  // Mark all notifications as read
  app.patch("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const count = await storage.markAllNotificationsRead(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error marking all notifications read:", error);
      res.status(500).json({ error: "Failed to mark all notifications read" });
    }
  });

  // Dismiss notification
  app.patch("/api/notifications/:id/dismiss", requireAuth, async (req, res) => {
    try {
      const notification = await storage.dismissNotification(req.params.id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error dismissing notification:", error);
      res.status(500).json({ error: "Failed to dismiss notification" });
    }
  });

  // Dismiss all notifications
  app.patch("/api/notifications/dismiss-all", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const count = await storage.dismissAllNotifications(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error dismissing all notifications:", error);
      res.status(500).json({ error: "Failed to dismiss all notifications" });
    }
  });

  // Delete notification
  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteNotification(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // ========== NOTIFICATION RULES ==========

  // Get all notification rules
  app.get("/api/notification-rules", requireAuth, async (req, res) => {
    try {
      const rules = await storage.getNotificationRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching notification rules:", error);
      res.status(500).json({ error: "Failed to fetch notification rules" });
    }
  });

  // Get notification rule by ID
  app.get("/api/notification-rules/:id", requireAuth, async (req, res) => {
    try {
      const rule = await storage.getNotificationRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Notification rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Error fetching notification rule:", error);
      res.status(500).json({ error: "Failed to fetch notification rule" });
    }
  });

  // Create notification rule
  app.post("/api/notification-rules", requireAuth, async (req, res) => {
    try {
      const ruleData = { 
        ...req.body, 
        createdBy: req.session.user!.id,
        triggerConditions: req.body.triggerConditions || null,
        countryCodes: req.body.countryCodes?.length ? req.body.countryCodes : null,
        targetRoles: req.body.targetRoles?.length ? req.body.targetRoles : null,
        targetUserIds: req.body.targetUserIds?.length ? req.body.targetUserIds : null,
      };
      const rule = await storage.createNotificationRule(ruleData);
      await logActivity(req.session.user!.id, "create", "notification_rule", rule.id, rule.name);
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating notification rule:", error);
      res.status(500).json({ error: "Failed to create notification rule" });
    }
  });

  // Update notification rule
  app.put("/api/notification-rules/:id", requireAuth, async (req, res) => {
    try {
      const updateData = {
        ...req.body,
        triggerConditions: req.body.triggerConditions || null,
        countryCodes: req.body.countryCodes?.length ? req.body.countryCodes : null,
        targetRoles: req.body.targetRoles?.length ? req.body.targetRoles : null,
        targetUserIds: req.body.targetUserIds?.length ? req.body.targetUserIds : null,
      };
      const rule = await storage.updateNotificationRule(req.params.id, updateData);
      if (!rule) {
        return res.status(404).json({ error: "Notification rule not found" });
      }
      await logActivity(req.session.user!.id, "update", "notification_rule", rule.id, rule.name);
      res.json(rule);
    } catch (error) {
      console.error("Error updating notification rule:", error);
      res.status(500).json({ error: "Failed to update notification rule" });
    }
  });

  // Toggle notification rule
  app.patch("/api/notification-rules/:id/toggle", requireAuth, async (req, res) => {
    try {
      const { isActive } = req.body;
      const rule = await storage.toggleNotificationRule(req.params.id, isActive);
      if (!rule) {
        return res.status(404).json({ error: "Notification rule not found" });
      }
      await logActivity(req.session.user!.id, "toggle", "notification_rule", rule.id, rule.name);
      res.json(rule);
    } catch (error) {
      console.error("Error toggling notification rule:", error);
      res.status(500).json({ error: "Failed to toggle notification rule" });
    }
  });

  // Delete notification rule
  app.delete("/api/notification-rules/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteNotificationRule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Notification rule not found" });
      }
      await logActivity(req.session.user!.id, "delete", "notification_rule", req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting notification rule:", error);
      res.status(500).json({ error: "Failed to delete notification rule" });
    }
  });

  // ========== CONFIGURATION TABLES ==========

  // Complaint Types
  app.get("/api/config/complaint-types", requireAuth, async (req, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const types = countryCode 
        ? await storage.getComplaintTypesByCountry(countryCode)
        : await storage.getAllComplaintTypes();
      res.json(types);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch complaint types" });
    }
  });

  app.post("/api/config/complaint-types", requireAuth, async (req, res) => {
    try {
      const parsed = insertComplaintTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const type = await storage.createComplaintType(parsed.data);
      await logActivity(req.session.user!.id, "create", "complaint_type", type.id, type.name);
      res.status(201).json(type);
    } catch (error) {
      res.status(500).json({ error: "Failed to create complaint type" });
    }
  });

  app.put("/api/config/complaint-types/:id", requireAuth, async (req, res) => {
    try {
      const type = await storage.updateComplaintType(req.params.id, req.body);
      if (!type) return res.status(404).json({ error: "Complaint type not found" });
      await logActivity(req.session.user!.id, "update", "complaint_type", type.id, type.name);
      res.json(type);
    } catch (error) {
      res.status(500).json({ error: "Failed to update complaint type" });
    }
  });

  app.delete("/api/config/complaint-types/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteComplaintType(req.params.id);
      if (!success) return res.status(404).json({ error: "Complaint type not found" });
      await logActivity(req.session.user!.id, "delete", "complaint_type", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete complaint type" });
    }
  });

  // Cooperation Types
  app.get("/api/config/cooperation-types", requireAuth, async (req, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const types = countryCode 
        ? await storage.getCooperationTypesByCountry(countryCode)
        : await storage.getAllCooperationTypes();
      res.json(types);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cooperation types" });
    }
  });

  app.post("/api/config/cooperation-types", requireAuth, async (req, res) => {
    try {
      const parsed = insertCooperationTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const type = await storage.createCooperationType(parsed.data);
      await logActivity(req.session.user!.id, "create", "cooperation_type", type.id, type.name);
      res.status(201).json(type);
    } catch (error) {
      res.status(500).json({ error: "Failed to create cooperation type" });
    }
  });

  app.put("/api/config/cooperation-types/:id", requireAuth, async (req, res) => {
    try {
      const type = await storage.updateCooperationType(req.params.id, req.body);
      if (!type) return res.status(404).json({ error: "Cooperation type not found" });
      await logActivity(req.session.user!.id, "update", "cooperation_type", type.id, type.name);
      res.json(type);
    } catch (error) {
      res.status(500).json({ error: "Failed to update cooperation type" });
    }
  });

  app.delete("/api/config/cooperation-types/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteCooperationType(req.params.id);
      if (!success) return res.status(404).json({ error: "Cooperation type not found" });
      await logActivity(req.session.user!.id, "delete", "cooperation_type", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete cooperation type" });
    }
  });

  // VIP Statuses
  app.get("/api/config/vip-statuses", requireAuth, async (req, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const statuses = countryCode 
        ? await storage.getVipStatusesByCountry(countryCode)
        : await storage.getAllVipStatuses();
      res.json(statuses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch VIP statuses" });
    }
  });

  app.post("/api/config/vip-statuses", requireAuth, async (req, res) => {
    try {
      const parsed = insertVipStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const status = await storage.createVipStatus(parsed.data);
      await logActivity(req.session.user!.id, "create", "vip_status", status.id, status.name);
      res.status(201).json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to create VIP status" });
    }
  });

  app.put("/api/config/vip-statuses/:id", requireAuth, async (req, res) => {
    try {
      const status = await storage.updateVipStatus(req.params.id, req.body);
      if (!status) return res.status(404).json({ error: "VIP status not found" });
      await logActivity(req.session.user!.id, "update", "vip_status", status.id, status.name);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to update VIP status" });
    }
  });

  app.delete("/api/config/vip-statuses/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteVipStatus(req.params.id);
      if (!success) return res.status(404).json({ error: "VIP status not found" });
      await logActivity(req.session.user!.id, "delete", "vip_status", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete VIP status" });
    }
  });

  // Health Insurance Companies
  app.get("/api/config/health-insurance", requireAuth, async (req, res) => {
    try {
      const countryCode = req.query.countryCode as string;
      const companies = countryCode 
        ? await storage.getHealthInsuranceByCountry(countryCode)
        : await storage.getAllHealthInsuranceCompanies();
      res.json(companies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch health insurance companies" });
    }
  });

  app.post("/api/config/health-insurance", requireAuth, async (req, res) => {
    try {
      const parsed = insertHealthInsuranceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const company = await storage.createHealthInsurance(parsed.data);
      await logActivity(req.session.user!.id, "create", "health_insurance", company.id, company.name);
      res.status(201).json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to create health insurance company" });
    }
  });

  app.put("/api/config/health-insurance/:id", requireAuth, async (req, res) => {
    try {
      const company = await storage.updateHealthInsurance(req.params.id, req.body);
      if (!company) return res.status(404).json({ error: "Health insurance company not found" });
      await logActivity(req.session.user!.id, "update", "health_insurance", company.id, company.name);
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to update health insurance company" });
    }
  });

  app.patch("/api/config/health-insurance/:id", requireAuth, async (req, res) => {
    try {
      const company = await storage.updateHealthInsurance(req.params.id, req.body);
      if (!company) return res.status(404).json({ error: "Health insurance company not found" });
      await logActivity(req.session.user!.id, "update", "health_insurance", company.id, company.name);
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to update health insurance company" });
    }
  });

  app.delete("/api/config/health-insurance/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteHealthInsurance(req.params.id);
      if (!success) return res.status(404).json({ error: "Health insurance company not found" });
      await logActivity(req.session.user!.id, "delete", "health_insurance", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete health insurance company" });
    }
  });

  // Laboratories
  app.get("/api/config/laboratories", requireAuth, async (req, res) => {
    try {
      const countryCode = req.query.countryCode as string;
      const laboratories = countryCode 
        ? await storage.getLaboratoriesByCountry(countryCode)
        : await storage.getAllLaboratories();
      res.json(laboratories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch laboratories" });
    }
  });

  app.post("/api/config/laboratories", requireAuth, async (req, res) => {
    try {
      const parsed = insertLaboratorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const laboratory = await storage.createLaboratory(parsed.data);
      await logActivity(req.session.user!.id, "create", "laboratory", laboratory.id, laboratory.name);
      res.status(201).json(laboratory);
    } catch (error) {
      res.status(500).json({ error: "Failed to create laboratory" });
    }
  });

  app.put("/api/config/laboratories/:id", requireAuth, async (req, res) => {
    try {
      const laboratory = await storage.updateLaboratory(req.params.id, req.body);
      if (!laboratory) return res.status(404).json({ error: "Laboratory not found" });
      await logActivity(req.session.user!.id, "update", "laboratory", laboratory.id, laboratory.name);
      res.json(laboratory);
    } catch (error) {
      res.status(500).json({ error: "Failed to update laboratory" });
    }
  });

  app.patch("/api/config/laboratories/:id", requireAuth, async (req, res) => {
    try {
      const laboratory = await storage.updateLaboratory(req.params.id, req.body);
      if (!laboratory) return res.status(404).json({ error: "Laboratory not found" });
      await logActivity(req.session.user!.id, "update", "laboratory", laboratory.id, laboratory.name);
      res.json(laboratory);
    } catch (error) {
      res.status(500).json({ error: "Failed to update laboratory" });
    }
  });

  app.delete("/api/config/laboratories/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteLaboratory(req.params.id);
      if (!success) return res.status(404).json({ error: "Laboratory not found" });
      await logActivity(req.session.user!.id, "delete", "laboratory", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete laboratory" });
    }
  });

  // Hospitals
  app.get("/api/hospitals", requireAuth, async (req, res) => {
    try {
      const countryCodes = req.query.countries as string;
      const hospitals = countryCodes 
        ? await storage.getHospitalsByCountry(countryCodes.split(","))
        : await storage.getAllHospitals();
      res.json(hospitals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch hospitals" });
    }
  });

  app.get("/api/hospitals/:id", requireAuth, async (req, res) => {
    try {
      const hospital = await storage.getHospital(req.params.id);
      if (!hospital) return res.status(404).json({ error: "Hospital not found" });
      res.json(hospital);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch hospital" });
    }
  });

  app.post("/api/hospitals", requireAuth, async (req, res) => {
    try {
      const parsed = insertHospitalSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const hospital = await storage.createHospital(parsed.data);
      await logActivity(req.session.user!.id, "create", "hospital", hospital.id, hospital.name);
      res.status(201).json(hospital);
    } catch (error) {
      res.status(500).json({ error: "Failed to create hospital" });
    }
  });

  app.put("/api/hospitals/:id", requireAuth, async (req, res) => {
    try {
      const hospital = await storage.updateHospital(req.params.id, req.body);
      if (!hospital) return res.status(404).json({ error: "Hospital not found" });
      await logActivity(req.session.user!.id, "update", "hospital", hospital.id, hospital.name);
      res.json(hospital);
    } catch (error) {
      res.status(500).json({ error: "Failed to update hospital" });
    }
  });

  // Seed Slovak hospitals endpoint (admin only)
  app.post("/api/hospitals/seed-slovak", requireAuth, async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const { seedSlovakHospitals, slovakHospitals } = await import('./seeds/slovak-hospitals');
      const { db } = await import('./db');
      
      const result = await seedSlovakHospitals(db);
      
      await logActivity(user.id, "seed", "hospital", "bulk", `Slovak hospitals seed: ${result.created} created, ${result.skipped} skipped`);
      
      res.json({ 
        success: true, 
        message: `Seed completed: ${result.created} hospitals created, ${result.skipped} skipped`,
        total: slovakHospitals.length,
        ...result 
      });
    } catch (error: any) {
      console.error("Hospital seed error:", error);
      res.status(500).json({ error: "Failed to seed hospitals", details: error.message });
    }
  });

  // Seed all hospitals endpoint (admin only) - SK, CZ, HU, RO, IT, DE, US
  app.post("/api/hospitals/seed-all", requireAuth, async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const { seedAllHospitals } = await import('./seeds/all-hospitals');
      const { db } = await import('./db');
      
      const result = await seedAllHospitals(db);
      
      await logActivity(user.id, "seed", "hospital", "bulk", `All countries hospital seed: ${result.inserted} created, ${result.skipped} skipped`);
      
      res.json({ 
        success: true, 
        message: `Seed completed: ${result.inserted} hospitals created, ${result.skipped} skipped`,
        ...result 
      });
    } catch (error: any) {
      console.error("Hospital seed all countries error:", error);
      res.status(500).json({ error: "Failed to seed hospitals", details: error.message });
    }
  });

  app.delete("/api/hospitals/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteHospital(req.params.id);
      if (!success) return res.status(404).json({ error: "Hospital not found" });
      await logActivity(req.session.user!.id, "delete", "hospital", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete hospital" });
    }
  });

  // Clinics (Ambulancie) routes
  app.get("/api/clinics", requireAuth, async (req, res) => {
    try {
      const countryCodes = req.query.countries as string;
      const clinicsList = countryCodes 
        ? await storage.getClinicsByCountry(countryCodes.split(","))
        : await storage.getAllClinics();
      res.json(clinicsList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clinics" });
    }
  });

  app.get("/api/clinics/:id", requireAuth, async (req, res) => {
    try {
      const clinic = await storage.getClinic(req.params.id);
      if (!clinic) return res.status(404).json({ error: "Clinic not found" });
      res.json(clinic);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clinic" });
    }
  });

  app.post("/api/clinics", requireAuth, async (req, res) => {
    try {
      const parsed = insertClinicSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const clinic = await storage.createClinic(parsed.data);
      await logActivity(req.session.user!.id, "create", "clinic", clinic.id, clinic.name);
      res.status(201).json(clinic);
    } catch (error) {
      res.status(500).json({ error: "Failed to create clinic" });
    }
  });

  app.put("/api/clinics/:id", requireAuth, async (req, res) => {
    try {
      const clinic = await storage.updateClinic(req.params.id, req.body);
      if (!clinic) return res.status(404).json({ error: "Clinic not found" });
      await logActivity(req.session.user!.id, "update", "clinic", clinic.id, clinic.name);
      res.json(clinic);
    } catch (error) {
      res.status(500).json({ error: "Failed to update clinic" });
    }
  });

  app.delete("/api/clinics/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteClinic(req.params.id);
      if (!success) return res.status(404).json({ error: "Clinic not found" });
      await logActivity(req.session.user!.id, "delete", "clinic", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete clinic" });
    }
  });

  // Collaborators routes
  app.get("/api/collaborators", requireAuth, async (req, res) => {
    try {
      const countryCodes = req.query.countries ? String(req.query.countries).split(",") : undefined;
      const collaborators = countryCodes 
        ? await storage.getCollaboratorsByCountry(countryCodes)
        : await storage.getAllCollaborators();
      res.json(collaborators);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch collaborators" });
    }
  });

  app.get("/api/collaborators/:id", requireAuth, async (req, res) => {
    try {
      const collaborator = await storage.getCollaborator(req.params.id);
      if (!collaborator) return res.status(404).json({ error: "Collaborator not found" });
      res.json(collaborator);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch collaborator" });
    }
  });

  app.post("/api/collaborators", requireAuth, async (req, res) => {
    try {
      console.log("[Collaborators] POST request body:", JSON.stringify(req.body, null, 2));
      const parsed = insertCollaboratorSchema.safeParse(req.body);
      if (!parsed.success) {
        console.log("[Collaborators] Validation failed:", JSON.stringify(parsed.error.issues, null, 2));
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      console.log("[Collaborators] Validation passed, parsed data:", JSON.stringify(parsed.data, null, 2));
      const collaborator = await storage.createCollaborator(parsed.data);
      await logActivity(req.session.user!.id, "create", "collaborator", collaborator.id, `${collaborator.firstName} ${collaborator.lastName}`);
      res.status(201).json(collaborator);
    } catch (error) {
      res.status(500).json({ error: "Failed to create collaborator" });
    }
  });

  app.put("/api/collaborators/:id", requireAuth, async (req, res) => {
    try {
      console.log("[Collaborators] PUT request for id:", req.params.id, "body:", JSON.stringify(req.body, null, 2));
      const collaborator = await storage.updateCollaborator(req.params.id, req.body);
      if (!collaborator) return res.status(404).json({ error: "Collaborator not found" });
      await logActivity(req.session.user!.id, "update", "collaborator", collaborator.id, `${collaborator.firstName} ${collaborator.lastName}`);
      res.json(collaborator);
    } catch (error) {
      res.status(500).json({ error: "Failed to update collaborator" });
    }
  });

  app.delete("/api/collaborators/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteCollaborator(req.params.id);
      if (!success) return res.status(404).json({ error: "Collaborator not found" });
      await logActivity(req.session.user!.id, "delete", "collaborator", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete collaborator" });
    }
  });

  // Set mobile app credentials for collaborator
  app.put("/api/collaborators/:id/mobile-credentials", requireAuth, async (req, res) => {
    try {
      const { mobileAppEnabled, mobileUsername, mobilePassword } = req.body;
      
      if (typeof mobileAppEnabled !== 'boolean') {
        return res.status(400).json({ error: "mobileAppEnabled is required" });
      }
      
      // Check if username is already taken by another collaborator
      if (mobileUsername && mobileAppEnabled) {
        const existing = await storage.getCollaboratorByMobileUsername(mobileUsername);
        if (existing && existing.id !== req.params.id) {
          return res.status(400).json({ error: "Username already taken" });
        }
      }
      
      const collaborator = await storage.setCollaboratorMobileCredentials(req.params.id, {
        mobileAppEnabled,
        mobileUsername,
        mobilePassword
      });
      
      if (!collaborator) {
        return res.status(404).json({ error: "Collaborator not found" });
      }
      
      await logActivity(
        req.session.user!.id,
        "update_mobile_credentials",
        "collaborator",
        collaborator.id,
        `${collaborator.firstName} ${collaborator.lastName}`
      );
      
      // Return collaborator without password hash
      const { mobilePasswordHash, ...safeCollaborator } = collaborator;
      res.json(safeCollaborator);
    } catch (error) {
      console.error("Failed to set mobile credentials:", error);
      res.status(500).json({ error: "Failed to set mobile credentials" });
    }
  });

  // Collaborator Addresses routes
  app.get("/api/collaborators/:id/addresses", requireAuth, async (req, res) => {
    try {
      const addresses = await storage.getCollaboratorAddresses(req.params.id);
      res.json(addresses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch addresses" });
    }
  });

  app.put("/api/collaborators/:id/addresses/:type", requireAuth, async (req, res) => {
    try {
      const parsed = insertCollaboratorAddressSchema.safeParse({
        ...req.body,
        collaboratorId: req.params.id,
        addressType: req.params.type
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const address = await storage.upsertCollaboratorAddress(parsed.data);
      const collaborator = await storage.getCollaborator(req.params.id);
      await logActivity(
        req.session.user!.id, 
        "update_address", 
        "collaborator", 
        req.params.id, 
        collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : "",
        { addressType: req.params.type }
      );
      res.json(address);
    } catch (error) {
      res.status(500).json({ error: "Failed to save address" });
    }
  });

  // Collaborator Other Data routes
  app.get("/api/collaborators/:id/other-data", requireAuth, async (req, res) => {
    try {
      const data = await storage.getCollaboratorOtherData(req.params.id);
      res.json(data || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch other data" });
    }
  });

  app.put("/api/collaborators/:id/other-data", requireAuth, async (req, res) => {
    try {
      const parsed = insertCollaboratorOtherDataSchema.safeParse({
        ...req.body,
        collaboratorId: req.params.id
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const data = await storage.upsertCollaboratorOtherData(parsed.data);
      const collaborator = await storage.getCollaborator(req.params.id);
      await logActivity(
        req.session.user!.id, 
        "update_other_data", 
        "collaborator", 
        req.params.id, 
        collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : ""
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to save other data" });
    }
  });

  // Collaborator Agreements routes
  app.get("/api/collaborators/:id/agreements", requireAuth, async (req, res) => {
    try {
      const agreements = await storage.getCollaboratorAgreements(req.params.id);
      res.json(agreements);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agreements" });
    }
  });

  app.post("/api/collaborators/:id/agreements", requireAuth, async (req, res) => {
    try {
      const parsed = insertCollaboratorAgreementSchema.safeParse({
        ...req.body,
        collaboratorId: req.params.id
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      const agreement = await storage.createCollaboratorAgreement(parsed.data);
      const collaborator = await storage.getCollaborator(req.params.id);
      await logActivity(
        req.session.user!.id, 
        "create_agreement", 
        "collaborator", 
        req.params.id, 
        collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : "",
        { billingCompany: req.body.billingCompanyId, contractNumber: req.body.contractNumber }
      );
      res.status(201).json(agreement);
    } catch (error) {
      res.status(500).json({ error: "Failed to create agreement" });
    }
  });

  app.put("/api/collaborators/:id/agreements/:agreementId", requireAuth, async (req, res) => {
    try {
      const agreement = await storage.updateCollaboratorAgreement(req.params.agreementId, req.body);
      if (!agreement) return res.status(404).json({ error: "Agreement not found" });
      const collaborator = await storage.getCollaborator(req.params.id);
      await logActivity(
        req.session.user!.id, 
        "update_agreement", 
        "collaborator", 
        req.params.id, 
        collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : "",
        { agreementId: req.params.agreementId }
      );
      res.json(agreement);
    } catch (error) {
      res.status(500).json({ error: "Failed to update agreement" });
    }
  });

  app.delete("/api/collaborators/:id/agreements/:agreementId", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteCollaboratorAgreement(req.params.agreementId);
      if (!success) return res.status(404).json({ error: "Agreement not found" });
      const collaborator = await storage.getCollaborator(req.params.id);
      await logActivity(
        req.session.user!.id, 
        "delete_agreement", 
        "collaborator", 
        req.params.id, 
        collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : "",
        { agreementId: req.params.agreementId }
      );
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete agreement" });
    }
  });

  // Get activity logs for a specific collaborator
  app.get("/api/collaborators/:id/activity-logs", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getActivityLogsByEntity("collaborator", req.params.id);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  // ============================================================================
  // INDEXUS Connect Mobile API - for mobile app used by collaborators
  // JWT-based authentication for secure mobile access
  // ============================================================================
  
  const MOBILE_JWT_SECRET = process.env.SESSION_SECRET;
  const MOBILE_JWT_EXPIRES_IN = "30d"; // Mobile tokens valid for 30 days
  
  if (!MOBILE_JWT_SECRET) {
    console.warn("[Mobile API] Warning: SESSION_SECRET not set, mobile API will reject all requests");
  }
  
  // Helper to extract collaborator from JWT token and update last active timestamp
  async function getMobileCollaboratorFromToken(req: any, updateActivity: boolean = true): Promise<{ collaboratorId: string } | null> {
    if (!MOBILE_JWT_SECRET) {
      return null; // Fail-secure if no secret configured
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    try {
      const jwt = await import("jsonwebtoken");
      const token = authHeader.split(" ")[1];
      const decoded = jwt.default.verify(token, MOBILE_JWT_SECRET) as { collaboratorId: string };
      
      // Update last active timestamp (fire and forget - don't await)
      if (updateActivity && decoded.collaboratorId) {
        storage.updateCollaborator(decoded.collaboratorId, { 
          mobileLastActiveAt: new Date() 
        }).catch(() => {});
      }
      
      return decoded;
    } catch (error) {
      return null;
    }
  }
  
  // Mobile app authentication - issues JWT token
  app.post("/api/mobile/auth/login", async (req, res) => {
    try {
      if (!MOBILE_JWT_SECRET) {
        return res.status(500).json({ error: "Mobile API not configured" });
      }
      
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      const collaborator = await storage.validateCollaboratorMobilePassword(username, password);
      if (!collaborator) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Update last login timestamp
      await storage.updateCollaboratorMobileLogin(collaborator.id);
      
      // Generate JWT token
      const jwt = await import("jsonwebtoken");
      const token = jwt.default.sign(
        { collaboratorId: collaborator.id, countryCode: collaborator.countryCode },
        MOBILE_JWT_SECRET,
        { expiresIn: MOBILE_JWT_EXPIRES_IN }
      );
      
      // Return collaborator info (exclude password hash)
      const { mobilePasswordHash, ...safeCollaborator } = collaborator;
      res.json({
        success: true,
        collaborator: safeCollaborator,
        token
      });
    } catch (error) {
      console.error("Mobile login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
  
  // Mobile token verification endpoint
  app.get("/api/mobile/auth/verify", async (req, res) => {
    try {
      const tokenData = await getMobileCollaboratorFromToken(req);
      if (!tokenData) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      const collaborator = await storage.getCollaborator(tokenData.collaboratorId);
      if (!collaborator || !collaborator.mobileAppEnabled) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { mobilePasswordHash, ...safeCollaborator } = collaborator;
      res.json({ valid: true, collaborator: safeCollaborator });
    } catch (error) {
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // Get hospitals for mobile app (filtered by collaborator's country)
  app.get("/api/mobile/hospitals", async (req, res) => {
    try {
      const tokenData = await getMobileCollaboratorFromToken(req);
      if (!tokenData) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      const collaborator = await storage.getCollaborator(tokenData.collaboratorId);
      if (!collaborator || !collaborator.mobileAppEnabled) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const hospitals = await storage.getHospitalsByCountry([collaborator.countryCode]);
      res.json(hospitals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch hospitals" });
    }
  });

  // Create new hospital from mobile app
  app.post("/api/mobile/hospitals", async (req, res) => {
    try {
      const tokenData = await getMobileCollaboratorFromToken(req);
      if (!tokenData) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      const collaborator = await storage.getCollaborator(tokenData.collaboratorId);
      if (!collaborator || !collaborator.mobileAppEnabled) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      if (!collaborator.canEditHospitals) {
        return res.status(403).json({ error: "No permission to add hospitals" });
      }
      
      const parsed = insertHospitalSchema.safeParse({
        ...req.body,
        countryCode: collaborator.countryCode,
        createdByCollaboratorId: collaborator.id
      });
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      
      const hospital = await storage.createHospital(parsed.data);
      res.status(201).json(hospital);
    } catch (error) {
      res.status(500).json({ error: "Failed to create hospital" });
    }
  });

  // Update hospital from mobile app
  app.put("/api/mobile/hospitals/:id", async (req, res) => {
    try {
      const tokenData = await getMobileCollaboratorFromToken(req);
      if (!tokenData) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      const collaborator = await storage.getCollaborator(tokenData.collaboratorId);
      if (!collaborator || !collaborator.mobileAppEnabled) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      if (!collaborator.canEditHospitals) {
        return res.status(403).json({ error: "No permission to edit hospitals" });
      }
      
      const hospital = await storage.updateHospital(req.params.id, req.body);
      if (!hospital) {
        return res.status(404).json({ error: "Hospital not found" });
      }
      
      res.json(hospital);
    } catch (error) {
      res.status(500).json({ error: "Failed to update hospital" });
    }
  });

  // Get visit events for mobile app
  app.get("/api/mobile/visit-events", async (req, res) => {
    try {
      const tokenData = await getMobileCollaboratorFromToken(req);
      if (!tokenData) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      const collaborator = await storage.getCollaborator(tokenData.collaboratorId);
      if (!collaborator || !collaborator.mobileAppEnabled) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const events = await storage.getVisitEventsByCollaborator(tokenData.collaboratorId);
      
      // Batch fetch all hospitals for the collaborator's country to avoid N+1 queries
      const allHospitals = await storage.getHospitalsByCountry(collaborator.countryCode ? [collaborator.countryCode] : []);
      const hospitalMap = new Map(allHospitals.map(h => [h.id, h.name]));
      
      // Enrich events with hospital names from the map
      const enrichedEvents = events.map((event) => ({
        ...event,
        hospitalName: event.hospitalId ? hospitalMap.get(event.hospitalId) || null : null,
      }));
      
      res.json(enrichedEvents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch visit events" });
    }
  });

  // Create visit event from mobile app
  app.post("/api/mobile/visit-events", async (req, res) => {
    try {
      const tokenData = await getMobileCollaboratorFromToken(req);
      if (!tokenData) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      const collaborator = await storage.getCollaborator(tokenData.collaboratorId);
      if (!collaborator || !collaborator.mobileAppEnabled) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const parsed = insertVisitEventSchema.safeParse({
        ...req.body,
        collaboratorId: tokenData.collaboratorId,
        countryCode: collaborator.countryCode,
        syncedFromMobile: true
      });
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
      }
      
      const event = await storage.createVisitEvent(parsed.data);
      res.status(201).json(event);
    } catch (error) {
      console.error("Create visit event error:", error);
      res.status(500).json({ error: "Failed to create visit event" });
    }
  });

  // Update visit event from mobile app
  app.put("/api/mobile/visit-events/:id", async (req, res) => {
    try {
      const tokenData = await getMobileCollaboratorFromToken(req);
      if (!tokenData) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      const collaborator = await storage.getCollaborator(tokenData.collaboratorId);
      if (!collaborator || !collaborator.mobileAppEnabled) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Verify the event belongs to this collaborator
      const existingEvent = await storage.getVisitEvent(req.params.id);
      if (!existingEvent || existingEvent.collaboratorId !== tokenData.collaboratorId) {
        return res.status(403).json({ error: "Not authorized to update this event" });
      }
      
      const previousStatus = existingEvent.status;
      const newStatus = req.body.status;
      
      const event = await storage.updateVisitEvent(req.params.id, {
        ...req.body,
        syncedFromMobile: true,
      });
      if (!event) {
        return res.status(404).json({ error: "Visit event not found" });
      }
      
      // Log activity based on status change
      const collaboratorName = `${collaborator.firstName} ${collaborator.lastName}`;
      const hospital = event.hospitalId ? await storage.getHospital(event.hospitalId) : null;
      const hospitalName = hospital?.name || "Unknown";
      
      if (newStatus && newStatus !== previousStatus) {
        if (newStatus === 'in_progress') {
          await logActivity(
            null,
            "visit_started",
            "visit_event",
            event.id,
            `${hospitalName} - ${collaboratorName}`,
            { 
              collaboratorId: collaborator.id,
              collaboratorName,
              hospitalName,
              visitType: event.subject,
              startLatitude: req.body.startLatitude,
              startLongitude: req.body.startLongitude,
              actualStart: req.body.actualStart,
              syncedFromMobile: true
            },
            req.ip
          );
        } else if (newStatus === 'completed') {
          await logActivity(
            null,
            "visit_completed",
            "visit_event",
            event.id,
            `${hospitalName} - ${collaboratorName}`,
            { 
              collaboratorId: collaborator.id,
              collaboratorName,
              hospitalName,
              visitType: event.subject,
              endLatitude: req.body.endLatitude,
              endLongitude: req.body.endLongitude,
              actualEnd: req.body.actualEnd,
              syncedFromMobile: true
            },
            req.ip
          );
        } else if (newStatus === 'cancelled') {
          await logActivity(
            null,
            "visit_cancelled",
            "visit_event",
            event.id,
            `${hospitalName} - ${collaboratorName}`,
            { 
              collaboratorId: collaborator.id,
              collaboratorName,
              hospitalName,
              visitType: event.subject,
              syncedFromMobile: true
            },
            req.ip
          );
        } else if (newStatus === 'not_realized') {
          await logActivity(
            null,
            "visit_not_realized",
            "visit_event",
            event.id,
            `${hospitalName} - ${collaboratorName}`,
            { 
              collaboratorId: collaborator.id,
              collaboratorName,
              hospitalName,
              visitType: event.subject,
              syncedFromMobile: true
            },
            req.ip
          );
        }
      }
      
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to update visit event" });
    }
  });

  // Delete visit event from mobile app
  app.delete("/api/mobile/visit-events/:id", async (req, res) => {
    try {
      const tokenData = await getMobileCollaboratorFromToken(req);
      if (!tokenData) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      const collaborator = await storage.getCollaborator(tokenData.collaboratorId);
      if (!collaborator || !collaborator.mobileAppEnabled) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Verify the event belongs to this collaborator
      const existingEvent = await storage.getVisitEvent(req.params.id);
      if (!existingEvent || existingEvent.collaboratorId !== tokenData.collaboratorId) {
        return res.status(403).json({ error: "Not authorized to delete this event" });
      }
      
      const success = await storage.deleteVisitEvent(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Visit event not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete visit event" });
    }
  });

  // Get visit subject/type options (localized) - public endpoint for mobile app
  app.get("/api/mobile/visit-options", async (req, res) => {
    try {
      // Import the localized options from schema
      const { VISIT_SUBJECTS, REMARK_DETAIL_OPTIONS, VISIT_PLACE_OPTIONS } = await import("@shared/schema");
      res.json({
        subjects: VISIT_SUBJECTS,
        remarkDetails: REMARK_DETAIL_OPTIONS,
        places: VISIT_PLACE_OPTIONS
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch visit options" });
    }
  });

  // Mobile voice notes upload with transcription
  app.post("/api/mobile/voice-notes", uploadDocxMemory.single("audio"), async (req, res) => {
    try {
      const tokenData = await getMobileCollaboratorFromToken(req);
      if (!tokenData) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { visitEventId, durationSeconds, fileName } = req.body;
      const audioFile = req.file;
      
      if (!audioFile || !visitEventId) {
        return res.status(400).json({ error: "Audio file and visit event ID are required" });
      }
      
      // Verify the visit belongs to this collaborator
      const visit = await storage.getVisitEvent(visitEventId);
      if (!visit || visit.collaboratorId !== tokenData.collaboratorId) {
        return res.status(403).json({ error: "Visit event not found or access denied" });
      }
      
      // Save file to voice notes directory
      const { getStorageDir, ensureStorageExists } = await import("./config/storage-paths");
      const voiceNotesDir = getStorageDir("voice-notes");
      await ensureStorageExists("voice-notes");
      
      const fileExt = audioFile.originalname.split(".").pop() || "m4a";
      const savedFileName = `voice_${visitEventId}_${Date.now()}.${fileExt}`;
      const filePath = `${voiceNotesDir}/${savedFileName}`;
      
      const fs = await import("fs/promises");
      await fs.writeFile(filePath, audioFile.buffer);
      
      // Transcribe using OpenAI Whisper if available
      let transcription = null;
      let isTranscribed = false;
      
      if (process.env.OPENAI_API_KEY) {
        try {
          const OpenAI = (await import("openai")).default;
          const openai = new OpenAI();
          const fsSync = await import("fs");
          
          const transcriptionResult = await openai.audio.transcriptions.create({
            file: fsSync.createReadStream(filePath),
            model: "whisper-1",
            language: "sk",
            response_format: "text",
          });
          
          transcription = transcriptionResult as unknown as string;
          isTranscribed = true;
        } catch (transcribeError) {
          console.error("Transcription failed:", transcribeError);
        }
      }
      
      // Store voice note record
      const voiceNote = await storage.createVoiceNote({
        visitEventId,
        collaboratorId: tokenData.collaboratorId,
        filePath: filePath,
        fileName: fileName || savedFileName,
        durationSeconds: parseInt(durationSeconds) || 0,
        fileSize: audioFile.size,
        transcription,
        isTranscribed,
        transcriptionLanguage: isTranscribed ? "sk" : null,
      });
      
      res.status(201).json({ success: true, voiceNote });
    } catch (error) {
      console.error("Voice note upload error:", error);
      res.status(500).json({ error: "Failed to upload voice note" });
    }
  });

  // Get voice notes for a visit event
  app.get("/api/mobile/voice-notes/:visitEventId", async (req, res) => {
    try {
      const tokenData = await getMobileCollaboratorFromToken(req);
      if (!tokenData) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Verify the visit belongs to this collaborator
      const visit = await storage.getVisitEvent(req.params.visitEventId);
      if (!visit || visit.collaboratorId !== tokenData.collaboratorId) {
        return res.status(403).json({ error: "Visit event not found or access denied" });
      }
      
      const voiceNotes = await storage.getVoiceNotesByVisitEvent(req.params.visitEventId);
      res.json(voiceNotes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch voice notes" });
    }
  });

  // Register push notification token
  app.post("/api/mobile/push-token", async (req, res) => {
    try {
      const tokenData = await getMobileCollaboratorFromToken(req);
      if (!tokenData) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { token, platform, deviceId, deviceName } = req.body;
      if (!token || !platform) {
        return res.status(400).json({ error: "Token and platform are required" });
      }
      
      // Upsert the push token (update if same device, create if new)
      const pushToken = await storage.upsertMobilePushToken({
        collaboratorId: tokenData.collaboratorId,
        token,
        platform,
        deviceId,
        deviceName,
        isActive: true,
        lastUsedAt: new Date(),
      });
      
      res.json({ success: true, pushToken });
    } catch (error) {
      console.error("Push token registration error:", error);
      res.status(500).json({ error: "Failed to register push token" });
    }
  });

  // Deactivate push token (on logout)
  app.delete("/api/mobile/push-token", async (req, res) => {
    try {
      const tokenData = await getMobileCollaboratorFromToken(req);
      if (!tokenData) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { deviceId } = req.body;
      if (deviceId) {
        await storage.deactivateMobilePushToken(tokenData.collaboratorId, deviceId);
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to deactivate push token" });
    }
  });

  // ============================================================================
  // Mobile Reports API - Generate CSV reports for collaborators
  // ============================================================================

  app.get("/api/mobile/reports/:reportType", async (req, res) => {
    try {
      const tokenData = await getMobileCollaboratorFromToken(req);
      if (!tokenData) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { reportType } = req.params;
      const { period } = req.query;

      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;
      let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      switch (period) {
        case 'last_month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
          break;
        case 'last_3_months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
        case 'this_month':
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }

      // Fetch visit events for this collaborator
      const visitEvents = await storage.getVisitEventsByCollaborator(tokenData.collaboratorId);
      const filteredEvents = visitEvents.filter(e => {
        // Use actualStart for completed visits, startTime otherwise
        const eventDate = e.actualStart 
          ? new Date(e.actualStart) 
          : (e.startTime ? new Date(e.startTime) : null);
        return eventDate && eventDate >= startDate && eventDate <= endDate;
      });

      // Fetch hospitals for mapping
      const hospitals = await storage.getAllHospitals();
      const hospitalMap = new Map(hospitals.map((h: any) => [h.id, h]));

      let csvContent = '';
      
      if (reportType === 'monthly_summary') {
        // Monthly Visit Summary Report
        csvContent = 'Date,Hospital,Visit Type,Status,Duration (min),Notes\n';
        
        for (const event of filteredEvents) {
          const hospital = hospitalMap.get(event.hospitalId || '') || { name: 'Unknown' };
          // Use ISO date format for consistency
          const eventDate = event.actualStart || event.startTime;
          const date = eventDate ? new Date(eventDate).toISOString().split('T')[0] : '';
          const status = event.status || (event.isCancelled ? 'cancelled' : event.isNotRealized ? 'not_realized' : 'scheduled');
          
          let duration = 0;
          if (event.actualStart && event.actualEnd) {
            duration = Math.round((new Date(event.actualEnd).getTime() - new Date(event.actualStart).getTime()) / 60000);
          }
          
          const eventSubject = (event.subject || '').replace(/"/g, '""').replace(/\n/g, ' ');
          csvContent += `"${date}","${hospital.name}","${event.visitType || ''}","${status}",${duration},"${eventSubject}"\n`;
        }
      } else if (reportType === 'hospital_activity') {
        // Hospital Activity Report
        const hospitalStats = new Map<string, { name: string; count: number; completed: number; cancelled: number }>();
        
        for (const event of filteredEvents) {
          const hospital = hospitalMap.get(event.hospitalId || '');
          const hospitalName = hospital?.name || 'Unknown';
          const hospitalId = event.hospitalId || 'unknown';
          
          if (!hospitalStats.has(hospitalId)) {
            hospitalStats.set(hospitalId, { name: hospitalName, count: 0, completed: 0, cancelled: 0 });
          }
          
          const stats = hospitalStats.get(hospitalId)!;
          stats.count++;
          if (event.status === 'completed') stats.completed++;
          if (event.isCancelled || event.status === 'cancelled') stats.cancelled++;
        }
        
        csvContent = 'Hospital,Total Visits,Completed,Cancelled\n';
        for (const [, stats] of hospitalStats) {
          csvContent += `"${stats.name}",${stats.count},${stats.completed},${stats.cancelled}\n`;
        }
      } else if (reportType === 'visit_hours') {
        // Visit Hours Report
        const dailyHours = new Map<string, number>();
        
        for (const event of filteredEvents) {
          if (event.actualStart && event.actualEnd) {
            // Use ISO date format for consistency
            const date = new Date(event.actualStart).toISOString().split('T')[0];
            const duration = (new Date(event.actualEnd).getTime() - new Date(event.actualStart).getTime()) / 3600000;
            dailyHours.set(date, (dailyHours.get(date) || 0) + duration);
          }
        }
        
        let totalHours = 0;
        csvContent = 'Date,Hours Worked\n';
        const sortedDates = Array.from(dailyHours.keys()).sort();
        for (const date of sortedDates) {
          const hours = dailyHours.get(date) || 0;
          totalHours += hours;
          csvContent += `"${date}",${hours.toFixed(2)}\n`;
        }
        csvContent += `"TOTAL",${totalHours.toFixed(2)}\n`;
      } else {
        return res.status(400).json({ error: "Invalid report type" });
      }

      // Send CSV response
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}_${period}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error("Report generation error:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // ============================================================================
  // INDEXUS Web - Collaborator Reports (CSV Export)
  // ============================================================================

  app.get("/api/collaborator-reports/:reportType", requireAuth, async (req, res) => {
    try {
      const { reportType } = req.params;
      const { period, collaboratorId, countries } = req.query;

      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;
      let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      switch (period) {
        case 'last_month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
          break;
        case 'last_3_months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
        case 'this_year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'this_month':
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }

      // Fetch data
      const collaborators = await storage.getAllCollaborators();
      const countryCodes = countries ? (countries as string).split(',').filter(Boolean) : [];
      
      const filteredCollaborators = countryCodes.length > 0
        ? collaborators.filter((c: any) => countryCodes.includes(c.countryCode))
        : collaborators;

      const visitEvents = await storage.getVisitEventsByDateRange(startDate, endDate, countryCodes.length > 0 ? countryCodes : undefined);
      const hospitals = await storage.getAllHospitals();
      const hospitalMap = new Map(hospitals.map((h: any) => [h.id, h]));
      const collaboratorMap = new Map(filteredCollaborators.map((c: any) => [c.id, c]));

      // Filter by specific collaborator if requested
      const filteredEvents = collaboratorId && collaboratorId !== 'all'
        ? visitEvents.filter(e => e.collaboratorId === collaboratorId)
        : visitEvents.filter(e => collaboratorMap.has(e.collaboratorId || ''));

      let csvContent = '';

      if (reportType === 'activity_summary') {
        csvContent = 'Collaborator,Country,Total Visits,Completed,Cancelled,Hours Worked\n';
        
        const collabStats = new Map<string, { name: string; country: string; total: number; completed: number; cancelled: number; hours: number }>();
        
        for (const event of filteredEvents) {
          const collab = collaboratorMap.get(event.collaboratorId || '');
          if (!collab) continue;
          
          if (!collabStats.has(collab.id)) {
            collabStats.set(collab.id, {
              name: `${collab.firstName} ${collab.lastName}`,
              country: collab.countryCode,
              total: 0,
              completed: 0,
              cancelled: 0,
              hours: 0,
            });
          }
          
          const stats = collabStats.get(collab.id)!;
          stats.total++;
          if (event.status === 'completed') {
            stats.completed++;
            if (event.actualStart && event.actualEnd) {
              stats.hours += (new Date(event.actualEnd).getTime() - new Date(event.actualStart).getTime()) / 3600000;
            }
          }
          if (event.isCancelled || event.status === 'cancelled') stats.cancelled++;
        }

        for (const [, stats] of collabStats) {
          csvContent += `"${stats.name}","${stats.country}",${stats.total},${stats.completed},${stats.cancelled},${stats.hours.toFixed(2)}\n`;
        }
      } else if (reportType === 'visit_statistics') {
        csvContent = 'Date,Collaborator,Hospital,Visit Type,Status,Duration (min),Notes\n';
        
        for (const event of filteredEvents) {
          const collab = collaboratorMap.get(event.collaboratorId || '');
          const hospital = hospitalMap.get(event.hospitalId || '');
          const eventDate = event.actualStart || event.startTime;
          const date = eventDate ? new Date(eventDate).toISOString().split('T')[0] : '';
          const status = event.status || (event.isCancelled ? 'cancelled' : event.isNotRealized ? 'not_realized' : 'scheduled');
          
          let duration = 0;
          if (event.actualStart && event.actualEnd) {
            duration = Math.round((new Date(event.actualEnd).getTime() - new Date(event.actualStart).getTime()) / 60000);
          }
          
          const eventSubject = (event.subject || '').replace(/"/g, '""').replace(/\n/g, ' ');
          csvContent += `"${date}","${collab?.firstName || ''} ${collab?.lastName || ''}","${hospital?.name || ''}","${event.visitType || ''}","${status}",${duration},"${eventSubject}"\n`;
        }
      } else if (reportType === 'performance_metrics') {
        csvContent = 'Collaborator,Country,Visits This Period,Completion Rate (%),Avg Visit Duration (min),Hospitals Covered\n';
        
        const collabPerf = new Map<string, { name: string; country: string; total: number; completed: number; totalDuration: number; hospitals: Set<string> }>();
        
        for (const event of filteredEvents) {
          const collab = collaboratorMap.get(event.collaboratorId || '');
          if (!collab) continue;
          
          if (!collabPerf.has(collab.id)) {
            collabPerf.set(collab.id, {
              name: `${collab.firstName} ${collab.lastName}`,
              country: collab.countryCode,
              total: 0,
              completed: 0,
              totalDuration: 0,
              hospitals: new Set(),
            });
          }
          
          const perf = collabPerf.get(collab.id)!;
          perf.total++;
          if (event.hospitalId) perf.hospitals.add(event.hospitalId);
          
          if (event.status === 'completed') {
            perf.completed++;
            if (event.actualStart && event.actualEnd) {
              perf.totalDuration += (new Date(event.actualEnd).getTime() - new Date(event.actualStart).getTime()) / 60000;
            }
          }
        }

        for (const [, perf] of collabPerf) {
          const completionRate = perf.total > 0 ? Math.round((perf.completed / perf.total) * 100) : 0;
          const avgDuration = perf.completed > 0 ? Math.round(perf.totalDuration / perf.completed) : 0;
          csvContent += `"${perf.name}","${perf.country}",${perf.total},${completionRate},${avgDuration},${perf.hospitals.size}\n`;
        }
      } else if (reportType === 'hospital_coverage') {
        csvContent = 'Hospital,Country,Total Visits,Unique Collaborators,Completed Visits\n';
        
        const hospitalStats = new Map<string, { name: string; country: string; total: number; collaborators: Set<string>; completed: number }>();
        
        for (const event of filteredEvents) {
          const hospital = hospitalMap.get(event.hospitalId || '');
          if (!hospital) continue;
          
          if (!hospitalStats.has(hospital.id)) {
            hospitalStats.set(hospital.id, {
              name: hospital.name,
              country: hospital.countryCode,
              total: 0,
              collaborators: new Set(),
              completed: 0,
            });
          }
          
          const stats = hospitalStats.get(hospital.id)!;
          stats.total++;
          if (event.collaboratorId) stats.collaborators.add(event.collaboratorId);
          if (event.status === 'completed') stats.completed++;
        }

        for (const [, stats] of hospitalStats) {
          csvContent += `"${stats.name}","${stats.country}",${stats.total},${stats.collaborators.size},${stats.completed}\n`;
        }
      } else {
        return res.status(400).json({ error: "Invalid report type" });
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}_${period}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error("Collaborator report generation error:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Excel export for collaborator reports
  app.get("/api/collaborator-reports/:reportType/excel", requireAuth, async (req, res) => {
    try {
      const { reportType } = req.params;
      const { period, collaboratorId, countries } = req.query;

      const now = new Date();
      let startDate: Date;
      let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      switch (period) {
        case 'last_month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
          break;
        case 'last_3_months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
        case 'this_year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'this_month':
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }

      const collaborators = await storage.getAllCollaborators();
      const countryCodes = countries ? (countries as string).split(',').filter(Boolean) : [];
      
      const filteredCollaborators = countryCodes.length > 0
        ? collaborators.filter((c: any) => countryCodes.includes(c.countryCode))
        : collaborators;

      const visitEvents = await storage.getVisitEventsByDateRange(startDate, endDate, countryCodes.length > 0 ? countryCodes : undefined);
      const hospitals = await storage.getAllHospitals();
      const hospitalMap = new Map(hospitals.map((h: any) => [h.id, h]));
      const collaboratorMap = new Map(filteredCollaborators.map((c: any) => [c.id, c]));

      const filteredEvents = collaboratorId && collaboratorId !== 'all'
        ? visitEvents.filter(e => e.collaboratorId === collaboratorId)
        : visitEvents.filter(e => collaboratorMap.has(e.collaboratorId || ''));

      let data: any[] = [];
      let sheetName = 'Report';

      if (reportType === 'activity_summary') {
        sheetName = 'Activity Summary';
        const collabStats = new Map<string, { name: string; country: string; total: number; completed: number; cancelled: number; hours: number }>();
        
        for (const event of filteredEvents) {
          const collab: any = collaboratorMap.get(event.collaboratorId || '');
          if (!collab) continue;
          
          if (!collabStats.has(collab.id)) {
            collabStats.set(collab.id, {
              name: `${collab.firstName} ${collab.lastName}`,
              country: collab.countryCode,
              total: 0,
              completed: 0,
              cancelled: 0,
              hours: 0,
            });
          }
          
          const stats = collabStats.get(collab.id)!;
          stats.total++;
          if (event.status === 'completed') {
            stats.completed++;
            if (event.actualStart && event.actualEnd) {
              stats.hours += (new Date(event.actualEnd).getTime() - new Date(event.actualStart).getTime()) / 3600000;
            }
          }
          if (event.isCancelled || event.status === 'cancelled') stats.cancelled++;
        }

        data = Array.from(collabStats.values()).map(s => ({
          'Collaborator': s.name,
          'Country': s.country,
          'Total Visits': s.total,
          'Completed': s.completed,
          'Cancelled': s.cancelled,
          'Hours Worked': Number(s.hours.toFixed(2)),
        }));
      } else if (reportType === 'visit_statistics') {
        sheetName = 'Visit Statistics';
        data = filteredEvents.map(event => {
          const collab: any = collaboratorMap.get(event.collaboratorId || '');
          const hospital: any = hospitalMap.get(event.hospitalId || '');
          const eventDate = event.actualStart || event.startTime;
          const date = eventDate ? new Date(eventDate).toISOString().split('T')[0] : '';
          const status = event.status || (event.isCancelled ? 'cancelled' : event.isNotRealized ? 'not_realized' : 'scheduled');
          
          let duration = 0;
          if (event.actualStart && event.actualEnd) {
            duration = Math.round((new Date(event.actualEnd).getTime() - new Date(event.actualStart).getTime()) / 60000);
          }
          
          return {
            'Date': date,
            'Collaborator': collab ? `${collab.firstName} ${collab.lastName}` : '',
            'Hospital': hospital?.name || '',
            'Visit Type': event.visitType || '',
            'Status': status,
            'Duration (min)': duration,
            'Notes': event.subject || '',
          };
        });
      } else if (reportType === 'performance_metrics') {
        sheetName = 'Performance Metrics';
        const collabPerf = new Map<string, { name: string; country: string; total: number; completed: number; totalDuration: number; hospitals: Set<string> }>();
        
        for (const event of filteredEvents) {
          const collab: any = collaboratorMap.get(event.collaboratorId || '');
          if (!collab) continue;
          
          if (!collabPerf.has(collab.id)) {
            collabPerf.set(collab.id, {
              name: `${collab.firstName} ${collab.lastName}`,
              country: collab.countryCode,
              total: 0,
              completed: 0,
              totalDuration: 0,
              hospitals: new Set(),
            });
          }
          
          const perf = collabPerf.get(collab.id)!;
          perf.total++;
          if (event.hospitalId) perf.hospitals.add(event.hospitalId);
          
          if (event.status === 'completed') {
            perf.completed++;
            if (event.actualStart && event.actualEnd) {
              perf.totalDuration += (new Date(event.actualEnd).getTime() - new Date(event.actualStart).getTime()) / 60000;
            }
          }
        }

        data = Array.from(collabPerf.values()).map(p => ({
          'Collaborator': p.name,
          'Country': p.country,
          'Visits This Period': p.total,
          'Completion Rate (%)': p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0,
          'Avg Visit Duration (min)': p.completed > 0 ? Math.round(p.totalDuration / p.completed) : 0,
          'Hospitals Covered': p.hospitals.size,
        }));
      } else if (reportType === 'hospital_coverage') {
        sheetName = 'Hospital Coverage';
        const hospitalStats = new Map<string, { name: string; country: string; total: number; collaborators: Set<string>; completed: number }>();
        
        for (const event of filteredEvents) {
          const hospital: any = hospitalMap.get(event.hospitalId || '');
          if (!hospital) continue;
          
          if (!hospitalStats.has(hospital.id)) {
            hospitalStats.set(hospital.id, {
              name: hospital.name,
              country: hospital.countryCode,
              total: 0,
              collaborators: new Set(),
              completed: 0,
            });
          }
          
          const stats = hospitalStats.get(hospital.id)!;
          stats.total++;
          if (event.collaboratorId) stats.collaborators.add(event.collaboratorId);
          if (event.status === 'completed') stats.completed++;
        }

        data = Array.from(hospitalStats.values()).map(s => ({
          'Hospital': s.name,
          'Country': s.country,
          'Total Visits': s.total,
          'Unique Collaborators': s.collaborators.size,
          'Completed Visits': s.completed,
        }));
      } else {
        return res.status(400).json({ error: "Invalid report type" });
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}_${period}.xlsx"`);
      res.send(excelBuffer);
    } catch (error) {
      console.error("Collaborator Excel report generation error:", error);
      res.status(500).json({ error: "Failed to generate Excel report" });
    }
  });

  // ============================================================================
  // INDEXUS Web - Visit Events Calendar (for admins/managers)
  // ============================================================================
  
  app.get("/api/visit-events", requireAuth, async (req, res) => {
    try {
      const { countries, startDate, endDate, collaboratorId } = req.query;
      
      if (collaboratorId) {
        const events = await storage.getVisitEventsByCollaborator(collaboratorId as string);
        return res.json(events);
      }
      
      if (startDate && endDate) {
        const countryCodes = countries ? (countries as string).split(",") : undefined;
        const events = await storage.getVisitEventsByDateRange(
          new Date(startDate as string),
          new Date(endDate as string),
          countryCodes
        );
        return res.json(events);
      }
      
      const countryCodes = countries ? (countries as string).split(",") : undefined;
      const events = countryCodes
        ? await storage.getVisitEventsByCountry(countryCodes)
        : await storage.getAllVisitEvents();
      
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch visit events" });
    }
  });

  app.get("/api/visit-events/:id", requireAuth, async (req, res) => {
    try {
      const event = await storage.getVisitEvent(req.params.id);
      if (!event) return res.status(404).json({ error: "Visit event not found" });
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch visit event" });
    }
  });

  app.post("/api/visit-events", requireAuth, async (req, res) => {
    try {
      const event = await storage.createVisitEvent(req.body);
      await logActivity(req.session.user!.id, "create", "visit_event", event.id, `Visit: ${event.subject}`);
      res.status(201).json(event);
    } catch (error) {
      console.error("Create visit event error:", error);
      res.status(500).json({ error: "Failed to create visit event" });
    }
  });

  app.put("/api/visit-events/:id", requireAuth, async (req, res) => {
    try {
      const event = await storage.updateVisitEvent(req.params.id, req.body);
      if (!event) return res.status(404).json({ error: "Visit event not found" });
      await logActivity(req.session.user!.id, "update", "visit_event", event.id, `Visit: ${event.subject}`);
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to update visit event" });
    }
  });

  app.delete("/api/visit-events/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteVisitEvent(req.params.id);
      if (!success) return res.status(404).json({ error: "Visit event not found" });
      await logActivity(req.session.user!.id, "delete", "visit_event", req.params.id, "");
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete visit event" });
    }
  });

  // File upload for agreements
  app.post("/api/collaborators/:id/agreements/:agreementId/upload", requireAuth, uploadAgreement.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filePath = req.file.path;
      const fileName = req.file.originalname;
      const fileSize = req.file.size;
      const fileContentType = req.file.mimetype;

      // Extract text from PDF if applicable
      let extractedText = "";
      if (fileContentType === "application/pdf") {
        extractedText = await extractPdfText(filePath);
      }

      // Update agreement with file info
      const agreement = await storage.updateCollaboratorAgreement(req.params.agreementId, {
        fileName,
        filePath,
        fileSize,
        fileContentType,
        extractedText,
      });

      if (!agreement) {
        // Clean up uploaded file if agreement not found
        fs.unlinkSync(filePath);
        return res.status(404).json({ error: "Agreement not found" });
      }

      const collaborator = await storage.getCollaborator(req.params.id);
      await logActivity(
        req.session.user!.id, 
        "upload_file", 
        "collaborator", 
        req.params.id, 
        collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : "",
        { fileName, agreementId: req.params.agreementId }
      );

      res.json(agreement);
    } catch (error) {
      console.error("File upload failed:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Invoice image upload endpoint
  app.post("/api/upload/invoice-image", requireAuth, uploadInvoiceImage.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      const imageUrl = `/uploads/invoice-images/${req.file.filename}`;
      
      await logActivity(
        req.session.user!.id,
        "upload_invoice_image",
        "invoice",
        undefined,
        req.file.originalname
      );

      res.json({ 
        imageUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      });
    } catch (error) {
      console.error("Invoice image upload failed:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Download/view agreement file
  app.get("/api/collaborators/:id/agreements/:agreementId/file", requireAuth, async (req, res) => {
    try {
      const agreements = await storage.getCollaboratorAgreements(req.params.id);
      const agreement = agreements.find(a => a.id === req.params.agreementId);
      
      if (!agreement || !agreement.filePath) {
        return res.status(404).json({ error: "File not found" });
      }

      if (!fs.existsSync(agreement.filePath)) {
        return res.status(404).json({ error: "File not found on disk" });
      }

      const contentType = agreement.fileContentType || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${agreement.fileName}"`);
      
      const fileStream = fs.createReadStream(agreement.filePath);
      fileStream.pipe(res);
    } catch (error) {
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Download agreement file (force download)
  app.get("/api/collaborators/:id/agreements/:agreementId/download", requireAuth, async (req, res) => {
    try {
      const agreements = await storage.getCollaboratorAgreements(req.params.id);
      const agreement = agreements.find(a => a.id === req.params.agreementId);
      
      if (!agreement || !agreement.filePath) {
        return res.status(404).json({ error: "File not found" });
      }

      if (!fs.existsSync(agreement.filePath)) {
        return res.status(404).json({ error: "File not found on disk" });
      }

      res.download(agreement.filePath, agreement.fileName || "agreement.pdf");
    } catch (error) {
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Customer Potential Cases
  app.get("/api/customers/:id/potential-case", requireAuth, async (req, res) => {
    try {
      const data = await storage.getCustomerPotentialCase(req.params.id);
      res.json(data || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch potential case" });
    }
  });

  app.post("/api/customers/:id/potential-case", requireAuth, async (req, res) => {
    try {
      const customerId = req.params.id;
      const caseData = {
        ...req.body,
        customerId,
      };
      
      const data = await storage.upsertCustomerPotentialCase(caseData);
      
      // If case status is set (not empty), automatically update customer's clientStatus to "acquired" and status to "active"
      if (caseData.caseStatus && caseData.caseStatus.trim() !== "") {
        await storage.updateCustomer(customerId, { clientStatus: "acquired", status: "active" });
      }
      
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to save potential case" });
    }
  });

  // Global search endpoint - searches across all modules and files
  app.get("/api/search", requireAuth, async (req, res) => {
    try {
      const query = String(req.query.q || "").toLowerCase().trim();
      if (!query || query.length < 2) {
        return res.json({ results: [] });
      }

      const results: { type: string; id: string; title: string; subtitle: string; url: string }[] = [];

      // Search customers
      const customers = await storage.getAllCustomers();
      for (const c of customers) {
        const searchText = `${c.firstName} ${c.lastName} ${c.email || ""} ${c.phone || ""} ${c.mobile || ""} ${c.internalId || ""}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "customer",
            id: c.id,
            title: `${c.firstName} ${c.lastName}`,
            subtitle: c.internalId ? `${c.internalId} - ${c.email || c.phone || ""}` : (c.email || c.phone || ""),
            url: `/customers?id=${c.id}`,
          });
        }
      }

      // Search collaborators
      const collaborators = await storage.getAllCollaborators();
      for (const c of collaborators) {
        const searchText = `${c.firstName} ${c.lastName} ${c.email || ""} ${c.phone || ""} ${c.mobile || ""} ${c.legacyId || ""}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "collaborator",
            id: c.id,
            title: `${c.firstName} ${c.lastName}`,
            subtitle: c.legacyId ? `${c.legacyId} - ${c.email || c.phone || ""}` : (c.email || c.phone || ""),
            url: `/collaborators?id=${c.id}`,
          });
        }
      }

      // Search users
      const users = await storage.getAllUsers();
      for (const u of users) {
        const searchText = `${u.fullName} ${u.email || ""} ${u.username}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "user",
            id: u.id,
            title: u.fullName,
            subtitle: u.email || u.username,
            url: `/users?id=${u.id}`,
          });
        }
      }

      // Search products
      const products = await storage.getAllProducts();
      for (const p of products) {
        const searchText = `${p.name} ${p.description || ""}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "product",
            id: p.id,
            title: p.name,
            subtitle: p.description || "",
            url: `/products?id=${p.id}`,
          });
        }
      }

      // Search invoices
      const invoices = await storage.getAllInvoices();
      for (const inv of invoices) {
        const searchText = `${inv.invoiceNumber} ${inv.billingCompanyName || ""}`.toLowerCase();
        if (searchText.includes(query)) {
          const customer = customers.find(c => c.id === inv.customerId);
          results.push({
            type: "invoice",
            id: inv.id,
            title: inv.invoiceNumber,
            subtitle: customer ? `${customer.firstName} ${customer.lastName}` : "",
            url: `/invoices?id=${inv.id}`,
          });
        }
      }

      // Search agreement files (extracted text)
      const agreements = await storage.getAllCollaboratorAgreements();
      for (const a of agreements) {
        if (a.extractedText && a.extractedText.toLowerCase().includes(query)) {
          const collaborator = collaborators.find(c => c.id === a.collaboratorId);
          results.push({
            type: "agreement",
            id: a.id,
            title: a.fileName || "Agreement",
            subtitle: collaborator ? `${collaborator.firstName} ${collaborator.lastName}` : "",
            url: `/collaborators?id=${a.collaboratorId}&tab=agreements`,
          });
        }
      }

      // Search hospitals
      const hospitals = await storage.getAllHospitals();
      for (const h of hospitals) {
        const searchText = `${h.name} ${h.fullName || ""} ${h.city || ""} ${h.streetNumber || ""} ${h.legacyId || ""}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "hospital",
            id: h.id,
            title: h.name,
            subtitle: h.city || h.countryCode || "",
            url: `/hospitals?id=${h.id}`,
          });
        }
      }

      // Search health insurance companies
      const healthInsurances = await storage.getAllHealthInsuranceCompanies();
      for (const hi of healthInsurances) {
        const searchText = `${hi.name}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "healthInsurance",
            id: hi.id,
            title: hi.name,
            subtitle: hi.countryCode || "",
            url: `/settings`,
          });
        }
      }

      // Search laboratories
      const laboratories = await storage.getAllLaboratories();
      for (const lab of laboratories) {
        const searchText = `${lab.name}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "laboratory",
            id: lab.id,
            title: lab.name,
            subtitle: lab.countryCode || "",
            url: `/settings`,
          });
        }
      }

      // Search billing companies
      const billingDetails = await storage.getAllBillingDetails();
      for (const bd of billingDetails) {
        const searchText = `${bd.companyName} ${bd.address || ""} ${bd.taxId || ""} ${bd.bankIban || ""}`.toLowerCase();
        if (searchText.includes(query)) {
          results.push({
            type: "billingCompany",
            id: bd.id,
            title: bd.companyName,
            subtitle: bd.countryCode || "",
            url: `/settings`,
          });
        }
      }

      // Search customer notes
      const notes = await storage.getAllCustomerNotes();
      for (const n of notes) {
        if (n.content && n.content.toLowerCase().includes(query)) {
          const customer = customers.find(c => c.id === n.customerId);
          results.push({
            type: "note",
            id: n.id,
            title: n.content.substring(0, 50) + (n.content.length > 50 ? "..." : ""),
            subtitle: customer ? `${customer.firstName} ${customer.lastName}` : "",
            url: `/customers?id=${n.customerId}`,
          });
        }
      }

      res.json({ results: results.slice(0, 50) }); // Limit to 50 results
    } catch (error) {
      console.error("Global search failed:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // ============= Saved Searches Routes =============
  
  app.get("/api/saved-searches", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const module = req.query.module as string | undefined;
      const searches = await storage.getSavedSearchesByUser(userId, module);
      res.json(searches);
    } catch (error) {
      console.error("Failed to fetch saved searches:", error);
      res.status(500).json({ error: "Failed to fetch saved searches" });
    }
  });

  app.post("/api/saved-searches", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const validatedData = insertSavedSearchSchema.parse({
        ...req.body,
        userId,
      });
      
      const search = await storage.createSavedSearch(validatedData);
      res.status(201).json(search);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Failed to create saved search:", error);
      res.status(500).json({ error: "Failed to create saved search" });
    }
  });

  app.delete("/api/saved-searches/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user!.id;
      
      // Verify ownership before deleting
      const deleted = await storage.deleteSavedSearchForUser(id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Saved search not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete saved search:", error);
      res.status(500).json({ error: "Failed to delete saved search" });
    }
  });

  // ============= Lead Scoring Criteria Routes =============
  
  // Get all lead scoring criteria
  app.get("/api/lead-scoring-criteria", requireAuth, async (req, res) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      let criteria: LeadScoringCriteria[];
      
      if (countryCode) {
        criteria = await storage.getLeadScoringCriteriaByCountry(countryCode);
      } else {
        criteria = await storage.getAllLeadScoringCriteria();
      }
      
      res.json(criteria);
    } catch (error) {
      console.error("Failed to fetch lead scoring criteria:", error);
      res.status(500).json({ error: "Failed to fetch lead scoring criteria" });
    }
  });

  // Create lead scoring criteria
  app.post("/api/lead-scoring-criteria", requireAuth, async (req, res) => {
    try {
      const validatedData = insertLeadScoringCriteriaSchema.parse(req.body);
      const criteria = await storage.createLeadScoringCriteria(validatedData);
      
      await logActivity(
        req.session.user!.id,
        "created",
        "leadScoringCriteria",
        criteria.id,
        criteria.name,
        { category: criteria.category, points: criteria.points },
        req.ip
      );
      
      res.status(201).json(criteria);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Failed to create lead scoring criteria:", error);
      res.status(500).json({ error: "Failed to create lead scoring criteria" });
    }
  });

  // Update lead scoring criteria
  app.patch("/api/lead-scoring-criteria/:id", requireAuth, async (req, res) => {
    try {
      const criteria = await storage.updateLeadScoringCriteria(req.params.id, req.body);
      if (!criteria) {
        return res.status(404).json({ error: "Criteria not found" });
      }
      
      await logActivity(
        req.session.user!.id,
        "updated",
        "leadScoringCriteria",
        criteria.id,
        criteria.name,
        undefined,
        req.ip
      );
      
      res.json(criteria);
    } catch (error) {
      console.error("Failed to update lead scoring criteria:", error);
      res.status(500).json({ error: "Failed to update lead scoring criteria" });
    }
  });

  // Delete lead scoring criteria
  app.delete("/api/lead-scoring-criteria/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteLeadScoringCriteria(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Criteria not found" });
      }
      
      await logActivity(
        req.session.user!.id,
        "deleted",
        "leadScoringCriteria",
        req.params.id,
        undefined,
        undefined,
        req.ip
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete lead scoring criteria:", error);
      res.status(500).json({ error: "Failed to delete lead scoring criteria" });
    }
  });

  // Calculate lead score for a customer
  app.post("/api/customers/:id/calculate-lead-score", requireAuth, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Get potential case for this customer
      const potentialCase = await storage.getCustomerPotentialCase(req.params.id);
      
      // Get applicable criteria (global + country-specific)
      const criteria = await storage.getLeadScoringCriteriaByCountry(customer.country);
      const activeCriteria = criteria.filter(c => c.isActive);

      let totalScore = 0;
      const appliedCriteria: { name: string; points: number }[] = [];

      for (const criterion of activeCriteria) {
        let conditionMet = false;
        let fieldValue: any = null;

        // Evaluate the field value based on criterion.field
        switch (criterion.field) {
          case "hasPhone":
            fieldValue = !!(customer.phone || customer.mobile || customer.mobile2);
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "hasEmail":
            fieldValue = !!customer.email;
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "hasAddress":
            fieldValue = !!(customer.address && customer.city);
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "hasCase":
            fieldValue = !!potentialCase;
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "newsletterOptIn":
            fieldValue = potentialCase?.newsletterOptIn || customer.newsletter;
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "caseStatus":
            if (potentialCase) {
              fieldValue = potentialCase.caseStatus;
              conditionMet = criterion.condition === "equals" && fieldValue === criterion.value;
            }
            break;
          case "hasExpectedDate":
            fieldValue = !!(potentialCase?.expectedDateMonth && potentialCase?.expectedDateYear);
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "hasFatherInfo":
            fieldValue = !!(potentialCase?.fatherFirstName && potentialCase?.fatherLastName);
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "hasProduct":
            fieldValue = !!potentialCase?.productId;
            conditionMet = criterion.condition === "equals" && fieldValue === (criterion.value === "true");
            break;
          case "clientStatus":
            fieldValue = customer.clientStatus;
            conditionMet = criterion.condition === "equals" && fieldValue === criterion.value;
            break;
          case "daysFromCreation":
            if (customer.createdAt) {
              const daysSinceCreation = Math.floor((Date.now() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24));
              fieldValue = daysSinceCreation;
              if (criterion.condition === "less_than") {
                conditionMet = daysSinceCreation < parseInt(criterion.value || "0");
              } else if (criterion.condition === "greater_than") {
                conditionMet = daysSinceCreation > parseInt(criterion.value || "0");
              }
            }
            break;
          default:
            // Check if it's a direct customer field
            if (criterion.field in customer) {
              fieldValue = (customer as any)[criterion.field];
              if (criterion.condition === "not_empty") {
                conditionMet = !!fieldValue;
              } else if (criterion.condition === "equals") {
                conditionMet = fieldValue === criterion.value;
              } else if (criterion.condition === "contains" && typeof fieldValue === "string") {
                conditionMet = fieldValue.toLowerCase().includes((criterion.value || "").toLowerCase());
              }
            }
        }

        if (conditionMet) {
          totalScore += criterion.points;
          appliedCriteria.push({ name: criterion.name, points: criterion.points });
        }
      }

      // Normalize score to 0-100 range
      totalScore = Math.max(0, Math.min(100, totalScore));

      // Determine lead status based on score
      let leadStatus = "cold";
      if (totalScore >= 75) {
        leadStatus = "qualified";
      } else if (totalScore >= 50) {
        leadStatus = "hot";
      } else if (totalScore >= 25) {
        leadStatus = "warm";
      }

      // Update customer with new lead score
      const updatedCustomer = await storage.updateCustomerLeadScore(customer.id, totalScore, leadStatus);

      await logActivity(
        req.session.user!.id,
        "calculated_lead_score",
        "customer",
        customer.id,
        `${customer.firstName} ${customer.lastName}`,
        { score: totalScore, status: leadStatus, appliedCriteria },
        req.ip
      );

      res.json({
        score: totalScore,
        status: leadStatus,
        appliedCriteria,
        customer: updatedCustomer
      });
    } catch (error) {
      console.error("Failed to calculate lead score:", error);
      res.status(500).json({ error: "Failed to calculate lead score" });
    }
  });

  // Bulk recalculate lead scores for all customers
  app.post("/api/lead-scoring/recalculate-all", requireAuth, async (req, res) => {
    try {
      const allCustomers = await storage.getAllCustomers();
      const potentialCustomers = allCustomers.filter(c => c.clientStatus === "potential");
      
      let updated = 0;
      const criteria = await storage.getAllLeadScoringCriteria();
      const activeCriteria = criteria.filter(c => c.isActive);

      for (const customer of potentialCustomers) {
        const potentialCase = await storage.getCustomerPotentialCase(customer.id);
        const applicableCriteria = activeCriteria.filter(
          c => !c.countryCode || c.countryCode === customer.country
        );

        let totalScore = 0;

        for (const criterion of applicableCriteria) {
          let conditionMet = false;

          switch (criterion.field) {
            case "hasPhone":
              conditionMet = !!(customer.phone || customer.mobile || customer.mobile2) === (criterion.value === "true");
              break;
            case "hasEmail":
              conditionMet = !!customer.email === (criterion.value === "true");
              break;
            case "hasAddress":
              conditionMet = !!(customer.address && customer.city) === (criterion.value === "true");
              break;
            case "hasCase":
              conditionMet = !!potentialCase === (criterion.value === "true");
              break;
            case "newsletterOptIn":
              conditionMet = (potentialCase?.newsletterOptIn || customer.newsletter) === (criterion.value === "true");
              break;
            case "caseStatus":
              if (potentialCase && criterion.condition === "equals") {
                conditionMet = potentialCase.caseStatus === criterion.value;
              }
              break;
            case "hasExpectedDate":
              conditionMet = !!(potentialCase?.expectedDateMonth && potentialCase?.expectedDateYear) === (criterion.value === "true");
              break;
            case "hasFatherInfo":
              conditionMet = !!(potentialCase?.fatherFirstName && potentialCase?.fatherLastName) === (criterion.value === "true");
              break;
            case "hasProduct":
              conditionMet = !!potentialCase?.productId === (criterion.value === "true");
              break;
            default:
              if (criterion.field in customer && criterion.condition === "not_empty") {
                conditionMet = !!(customer as any)[criterion.field];
              }
          }

          if (conditionMet) {
            totalScore += criterion.points;
          }
        }

        totalScore = Math.max(0, Math.min(100, totalScore));
        let leadStatus = "cold";
        if (totalScore >= 75) leadStatus = "qualified";
        else if (totalScore >= 50) leadStatus = "hot";
        else if (totalScore >= 25) leadStatus = "warm";

        await storage.updateCustomerLeadScore(customer.id, totalScore, leadStatus);
        updated++;
      }

      await logActivity(
        req.session.user!.id,
        "bulk_recalculated_lead_scores",
        "system",
        undefined,
        undefined,
        { customersUpdated: updated },
        req.ip
      );

      res.json({ success: true, customersUpdated: updated });
    } catch (error) {
      console.error("Failed to recalculate lead scores:", error);
      res.status(500).json({ error: "Failed to recalculate lead scores" });
    }
  });

  // Seed default lead scoring criteria
  app.post("/api/lead-scoring-criteria/seed-defaults", requireAuth, async (req, res) => {
    try {
      const existingCriteria = await storage.getAllLeadScoringCriteria();
      
      if (existingCriteria.length > 0) {
        return res.status(400).json({ error: "Criteria already exist. Delete existing criteria first." });
      }

      const defaultCriteria = [
        // Profile completeness
        { name: "Has phone number", category: "profile", field: "hasPhone", condition: "equals", value: "true", points: 10 },
        { name: "Has email", category: "profile", field: "hasEmail", condition: "equals", value: "true", points: 10 },
        { name: "Has address", category: "profile", field: "hasAddress", condition: "equals", value: "true", points: 10 },
        
        // Case information
        { name: "Has potential case", category: "engagement", field: "hasCase", condition: "equals", value: "true", points: 15 },
        { name: "Has expected date", category: "engagement", field: "hasExpectedDate", condition: "equals", value: "true", points: 15 },
        { name: "Has father info", category: "engagement", field: "hasFatherInfo", condition: "equals", value: "true", points: 10 },
        { name: "Has product selected", category: "engagement", field: "hasProduct", condition: "equals", value: "true", points: 20 },
        
        // Marketing
        { name: "Newsletter opt-in", category: "engagement", field: "newsletterOptIn", condition: "equals", value: "true", points: 5 },
        
        // Case status
        { name: "Case in progress", category: "behavior", field: "caseStatus", condition: "equals", value: "in_progress", points: 15 },
        { name: "Case realized", category: "behavior", field: "caseStatus", condition: "equals", value: "realized", points: 25 },
      ];

      const created = [];
      for (const c of defaultCriteria) {
        const criterion = await storage.createLeadScoringCriteria({
          name: c.name,
          category: c.category,
          field: c.field,
          condition: c.condition,
          value: c.value,
          points: c.points,
          isActive: true,
          countryCode: null,
        });
        created.push(criterion);
      }

      await logActivity(
        req.session.user!.id,
        "seeded_default_lead_scoring_criteria",
        "system",
        undefined,
        undefined,
        { count: created.length },
        req.ip
      );

      res.status(201).json({ success: true, criteria: created });
    } catch (error) {
      console.error("Failed to seed default criteria:", error);
      res.status(500).json({ error: "Failed to seed default criteria" });
    }
  });

  // ============ CONFIGURATOR ENDPOINTS ============

  // Service Configurations
  app.get("/api/configurator/services", requireAuth, async (req, res) => {
    try {
      const countries = req.query.countries as string | undefined;
      const countryCodes = countries ? countries.split(",") : [];
      const services = await storage.getServiceConfigurationsByCountry(countryCodes);
      res.json(services);
    } catch (error) {
      console.error("Failed to get service configurations:", error);
      res.status(500).json({ error: "Failed to get service configurations" });
    }
  });

  app.post("/api/configurator/services", requireAuth, async (req, res) => {
    try {
      // Convert empty strings to null for numeric fields
      const cleanedBody = {
        ...req.body,
        basePrice: req.body.basePrice === "" ? null : req.body.basePrice,
        vatRate: req.body.vatRate === "" ? null : req.body.vatRate,
        processingDays: req.body.processingDays === "" ? null : req.body.processingDays,
        storageYears: req.body.storageYears === "" ? null : req.body.storageYears,
      };
      const validatedData = insertServiceConfigurationSchema.parse(cleanedBody);
      const service = await storage.createServiceConfiguration(validatedData);
      
      await logActivity(
        req.session.user!.id,
        "created_service_configuration",
        "service_configuration",
        service.id,
        service.serviceName,
        { serviceCode: service.serviceCode },
        req.ip
      );
      
      res.status(201).json(service);
    } catch (error) {
      console.error("Failed to create service configuration:", error);
      res.status(500).json({ error: "Failed to create service configuration" });
    }
  });

  app.patch("/api/configurator/services/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      // Convert empty strings to null for numeric fields
      const cleanedBody = {
        ...req.body,
        basePrice: req.body.basePrice === "" ? null : req.body.basePrice,
        vatRate: req.body.vatRate === "" ? null : req.body.vatRate,
        processingDays: req.body.processingDays === "" ? null : req.body.processingDays,
        storageYears: req.body.storageYears === "" ? null : req.body.storageYears,
      };
      const service = await storage.updateServiceConfiguration(id, cleanedBody);
      
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      await logActivity(
        req.session.user!.id,
        "updated_service_configuration",
        "service_configuration",
        service.id,
        service.serviceName,
        undefined,
        req.ip
      );
      
      res.json(service);
    } catch (error) {
      console.error("Failed to update service configuration:", error);
      res.status(500).json({ error: "Failed to update service configuration" });
    }
  });

  app.delete("/api/configurator/services/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteServiceConfiguration(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Service not found" });
      }

      await logActivity(
        req.session.user!.id,
        "deleted_service_configuration",
        "service_configuration",
        id,
        undefined,
        undefined,
        req.ip
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete service configuration:", error);
      res.status(500).json({ error: "Failed to delete service configuration" });
    }
  });

  // Service Instances
  app.get("/api/configurator/services/:serviceId/instances", requireAuth, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const instances = await storage.getServiceInstances(serviceId);
      res.json(instances);
    } catch (error) {
      console.error("Failed to get service instances:", error);
      res.status(500).json({ error: "Failed to get service instances" });
    }
  });

  app.get("/api/configurator/service-instances", requireAuth, async (req, res) => {
    try {
      const instances = await storage.getAllServiceInstances();
      res.json(instances);
    } catch (error) {
      console.error("Failed to get all service instances:", error);
      res.status(500).json({ error: "Failed to get all service instances" });
    }
  });

  app.post("/api/configurator/service-instances", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.fromDate === "") data.fromDate = null;
      if (data.toDate === "") data.toDate = null;
      if (data.invoicingPeriodYears === "") data.invoicingPeriodYears = null;
      if (data.billingDetailsId === "") data.billingDetailsId = null;
      
      const validatedData = insertServiceInstanceSchema.parse(data);
      const instance = await storage.createServiceInstance(validatedData);
      
      await logActivity(
        req.session.user!.id,
        "created_service_instance",
        "service_instance",
        instance.id,
        instance.name,
        { serviceId: instance.serviceId },
        req.ip
      );
      
      res.status(201).json(instance);
    } catch (error) {
      console.error("Failed to create service instance:", error);
      res.status(500).json({ error: "Failed to create service instance" });
    }
  });

  app.patch("/api/configurator/service-instances/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const data = { ...req.body };
      if (data.fromDate === "") data.fromDate = null;
      if (data.toDate === "") data.toDate = null;
      if (data.invoicingPeriodYears === "") data.invoicingPeriodYears = null;
      if (data.billingDetailsId === "") data.billingDetailsId = null;
      
      const instance = await storage.updateServiceInstance(id, data);
      
      if (!instance) {
        return res.status(404).json({ error: "Service instance not found" });
      }

      await logActivity(
        req.session.user!.id,
        "updated_service_instance",
        "service_instance",
        instance.id,
        instance.name,
        undefined,
        req.ip
      );
      
      res.json(instance);
    } catch (error) {
      console.error("Failed to update service instance:", error);
      res.status(500).json({ error: "Failed to update service instance" });
    }
  });

  app.delete("/api/configurator/service-instances/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteServiceInstance(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Service instance not found" });
      }

      await logActivity(
        req.session.user!.id,
        "deleted_service_instance",
        "service_instance",
        id,
        undefined,
        undefined,
        req.ip
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete service instance:", error);
      res.status(500).json({ error: "Failed to delete service instance" });
    }
  });

  // Number Ranges
  app.get("/api/configurator/number-ranges", requireAuth, async (req, res) => {
    try {
      const countries = req.query.countries as string | undefined;
      const countryCodes = countries ? countries.split(",") : [];
      const ranges = await storage.getNumberRangesByCountry(countryCodes);
      res.json(ranges);
    } catch (error) {
      console.error("Failed to get number ranges:", error);
      res.status(500).json({ error: "Failed to get number ranges" });
    }
  });

  app.post("/api/configurator/number-ranges", requireAuth, async (req, res) => {
    try {
      const range = await storage.createNumberRange(req.body);
      
      await logActivity(
        req.session.user!.id,
        "created_number_range",
        "number_range",
        range.id,
        range.name,
        undefined,
        req.ip
      );
      
      res.status(201).json(range);
    } catch (error) {
      console.error("Failed to create number range:", error);
      res.status(500).json({ error: "Failed to create number range" });
    }
  });

  app.patch("/api/configurator/number-ranges/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const range = await storage.updateNumberRange(id, req.body);
      
      if (!range) {
        return res.status(404).json({ error: "Number range not found" });
      }

      await logActivity(
        req.session.user!.id,
        "updated_number_range",
        "number_range",
        range.id,
        range.name,
        undefined,
        req.ip
      );
      
      res.json(range);
    } catch (error) {
      console.error("Failed to update number range:", error);
      res.status(500).json({ error: "Failed to update number range" });
    }
  });

  app.delete("/api/configurator/number-ranges/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteNumberRange(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Number range not found" });
      }

      await logActivity(
        req.session.user!.id,
        "deleted_number_range",
        "number_range",
        id,
        undefined,
        undefined,
        req.ip
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete number range:", error);
      res.status(500).json({ error: "Failed to delete number range" });
    }
  });

  // Invoice Templates
  app.get("/api/configurator/invoice-templates", requireAuth, async (req, res) => {
    try {
      const countries = req.query.countries as string | undefined;
      const countryCodes = countries ? countries.split(",") : [];
      const templates = await storage.getInvoiceTemplatesByCountry(countryCodes);
      res.json(templates);
    } catch (error) {
      console.error("Failed to get invoice templates:", error);
      res.status(500).json({ error: "Failed to get invoice templates" });
    }
  });

  app.post("/api/configurator/invoice-templates", requireAuth, async (req, res) => {
    try {
      const validatedData = insertInvoiceTemplateSchema.parse(req.body);
      const template = await storage.createInvoiceTemplate(validatedData);
      
      await logActivity(
        req.session.user!.id,
        "created_invoice_template",
        "invoice_template",
        template.id,
        template.name,
        undefined,
        req.ip
      );
      
      res.status(201).json(template);
    } catch (error) {
      console.error("Failed to create invoice template:", error);
      res.status(500).json({ error: "Failed to create invoice template" });
    }
  });

  app.patch("/api/configurator/invoice-templates/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const template = await storage.updateInvoiceTemplate(id, req.body);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      await logActivity(
        req.session.user!.id,
        "updated_invoice_template",
        "invoice_template",
        template.id,
        template.name,
        undefined,
        req.ip
      );
      
      res.json(template);
    } catch (error) {
      console.error("Failed to update invoice template:", error);
      res.status(500).json({ error: "Failed to update invoice template" });
    }
  });

  app.delete("/api/configurator/invoice-templates/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteInvoiceTemplate(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }

      await logActivity(
        req.session.user!.id,
        "deleted_invoice_template",
        "invoice_template",
        id,
        undefined,
        undefined,
        req.ip
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete invoice template:", error);
      res.status(500).json({ error: "Failed to delete invoice template" });
    }
  });

  // Invoice Layouts
  app.get("/api/configurator/invoice-layouts", requireAuth, async (req, res) => {
    try {
      const countries = req.query.countries as string | undefined;
      const countryCodes = countries ? countries.split(",") : [];
      const layouts = await storage.getInvoiceLayoutsByCountry(countryCodes);
      res.json(layouts);
    } catch (error) {
      console.error("Failed to get invoice layouts:", error);
      res.status(500).json({ error: "Failed to get invoice layouts" });
    }
  });

  app.post("/api/configurator/invoice-layouts", requireAuth, async (req, res) => {
    try {
      const validatedData = insertInvoiceLayoutSchema.parse(req.body);
      const layout = await storage.createInvoiceLayout(validatedData);
      
      await logActivity(
        req.session.user!.id,
        "created_invoice_layout",
        "invoice_layout",
        layout.id,
        layout.name,
        undefined,
        req.ip
      );
      
      res.status(201).json(layout);
    } catch (error) {
      console.error("Failed to create invoice layout:", error);
      res.status(500).json({ error: "Failed to create invoice layout" });
    }
  });

  app.patch("/api/configurator/invoice-layouts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const layout = await storage.updateInvoiceLayout(id, req.body);
      
      if (!layout) {
        return res.status(404).json({ error: "Layout not found" });
      }

      await logActivity(
        req.session.user!.id,
        "updated_invoice_layout",
        "invoice_layout",
        layout.id,
        layout.name,
        undefined,
        req.ip
      );
      
      res.json(layout);
    } catch (error) {
      console.error("Failed to update invoice layout:", error);
      res.status(500).json({ error: "Failed to update invoice layout" });
    }
  });

  app.delete("/api/configurator/invoice-layouts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteInvoiceLayout(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Layout not found" });
      }

      await logActivity(
        req.session.user!.id,
        "deleted_invoice_layout",
        "invoice_layout",
        id,
        undefined,
        undefined,
        req.ip
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete invoice layout:", error);
      res.status(500).json({ error: "Failed to delete invoice layout" });
    }
  });

  // ===== Roles & Permissions Routes =====

  app.get("/api/roles", requireAuth, async (req, res) => {
    try {
      const roles = await storage.getAllRoles();
      res.json(roles);
    } catch (error) {
      console.error("Failed to fetch roles:", error);
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.get("/api/roles/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const role = await storage.getRole(id);
      
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      
      const modulePermissions = await storage.getRoleModulePermissions(id);
      const fieldPermissions = await storage.getRoleFieldPermissions(id);
      
      res.json({
        ...role,
        modulePermissions,
        fieldPermissions,
      });
    } catch (error) {
      console.error("Failed to fetch role:", error);
      res.status(500).json({ error: "Failed to fetch role" });
    }
  });

  app.post("/api/roles", requireAuth, async (req, res) => {
    try {
      const { modulePermissions, fieldPermissions, ...roleData } = req.body;
      
      const validatedRole = insertRoleSchema.parse({
        ...roleData,
        createdBy: req.session.user!.id,
      });
      
      const role = await storage.createRole(validatedRole);
      
      if (modulePermissions && modulePermissions.length > 0) {
        const validModulePerms = modulePermissions.map((p: any) => ({
          roleId: role.id,
          moduleKey: p.moduleKey,
          access: p.access,
          canAdd: p.canAdd ?? true,
          canEdit: p.canEdit ?? true,
        }));
        await storage.setRoleModulePermissions(role.id, validModulePerms);
      }
      
      if (fieldPermissions && fieldPermissions.length > 0) {
        const validFieldPerms = fieldPermissions.map((p: any) => ({
          roleId: role.id,
          moduleKey: p.moduleKey,
          fieldKey: p.fieldKey,
          permission: p.permission,
        }));
        await storage.setRoleFieldPermissions(role.id, validFieldPerms);
      }

      await logActivity(
        req.session.user!.id,
        "created_role",
        "role",
        role.id,
        role.name,
        undefined,
        req.ip
      );
      
      res.status(201).json(role);
    } catch (error) {
      console.error("Failed to create role:", error);
      res.status(500).json({ error: "Failed to create role" });
    }
  });

  app.patch("/api/roles/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { modulePermissions, fieldPermissions, ...roleData } = req.body;
      
      const role = await storage.updateRole(id, roleData);
      
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      
      if (modulePermissions !== undefined) {
        const validModulePerms = modulePermissions.map((p: any) => ({
          roleId: id,
          moduleKey: p.moduleKey,
          access: p.access,
          canAdd: p.canAdd ?? true,
          canEdit: p.canEdit ?? true,
        }));
        await storage.setRoleModulePermissions(id, validModulePerms);
      }
      
      if (fieldPermissions !== undefined) {
        const validFieldPerms = fieldPermissions.map((p: any) => ({
          roleId: id,
          moduleKey: p.moduleKey,
          fieldKey: p.fieldKey,
          permission: p.permission,
        }));
        await storage.setRoleFieldPermissions(id, validFieldPerms);
      }

      await logActivity(
        req.session.user!.id,
        "updated_role",
        "role",
        role.id,
        role.name,
        undefined,
        req.ip
      );
      
      res.json(role);
    } catch (error) {
      console.error("Failed to update role:", error);
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  app.delete("/api/roles/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const role = await storage.getRole(id);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      
      if (role.isSystem) {
        return res.status(403).json({ error: "Cannot delete system role" });
      }
      
      const deleted = await storage.deleteRole(id);

      await logActivity(
        req.session.user!.id,
        "deleted_role",
        "role",
        id,
        role.name,
        undefined,
        req.ip
      );
      
      res.json({ success: deleted });
    } catch (error) {
      console.error("Failed to delete role:", error);
      res.status(500).json({ error: "Failed to delete role" });
    }
  });

  app.post("/api/roles/:id/copy", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "New role name is required" });
      }
      
      const newRole = await storage.copyRole(id, name, req.session.user!.id);

      await logActivity(
        req.session.user!.id,
        "copied_role",
        "role",
        newRole.id,
        `Copied from role ${id} as ${name}`,
        undefined,
        req.ip
      );
      
      res.status(201).json(newRole);
    } catch (error) {
      console.error("Failed to copy role:", error);
      res.status(500).json({ error: "Failed to copy role" });
    }
  });

  // Update single module permission
  app.put("/api/roles/:roleId/modules/:moduleKey", requireAuth, async (req, res) => {
    try {
      const { roleId, moduleKey } = req.params;
      const { access, canAdd, canEdit } = req.body;
      
      if (access && !["visible", "hidden"].includes(access)) {
        return res.status(400).json({ error: "Invalid access value" });
      }
      
      const role = await storage.getRole(roleId);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      
      // Get current module permissions
      const currentPerms = await storage.getRoleModulePermissions(roleId);
      
      // Update or add the specific module permission
      const existingPerm = currentPerms.find(p => p.moduleKey === moduleKey);
      if (existingPerm) {
        // Update existing - merge with current values
        const updatedPerms = currentPerms.map(p => 
          p.moduleKey === moduleKey 
            ? { 
                roleId, 
                moduleKey, 
                access: access ?? p.access, 
                canAdd: canAdd ?? p.canAdd, 
                canEdit: canEdit ?? p.canEdit 
              } 
            : { roleId: p.roleId, moduleKey: p.moduleKey, access: p.access, canAdd: p.canAdd, canEdit: p.canEdit }
        );
        await storage.setRoleModulePermissions(roleId, updatedPerms);
      } else {
        // Add new
        const newPerms = [...currentPerms.map(p => ({ 
          roleId: p.roleId, 
          moduleKey: p.moduleKey, 
          access: p.access,
          canAdd: p.canAdd,
          canEdit: p.canEdit
        })), { roleId, moduleKey, access: access ?? "visible", canAdd: canAdd ?? true, canEdit: canEdit ?? true }];
        await storage.setRoleModulePermissions(roleId, newPerms);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to update module permission:", error);
      res.status(500).json({ error: "Failed to update module permission" });
    }
  });

  // Update single field permission
  app.put("/api/roles/:roleId/modules/:moduleKey/fields/:fieldKey", requireAuth, async (req, res) => {
    try {
      const { roleId, moduleKey, fieldKey } = req.params;
      const { permission } = req.body;
      
      if (!permission || !["editable", "readonly", "hidden"].includes(permission)) {
        return res.status(400).json({ error: "Invalid permission value" });
      }
      
      const role = await storage.getRole(roleId);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      
      // Get current field permissions
      const currentPerms = await storage.getRoleFieldPermissions(roleId);
      
      // Update or add the specific field permission
      const existingPerm = currentPerms.find(p => p.moduleKey === moduleKey && p.fieldKey === fieldKey);
      if (existingPerm) {
        // Update existing
        const updatedPerms = currentPerms.map(p => 
          (p.moduleKey === moduleKey && p.fieldKey === fieldKey)
            ? { roleId, moduleKey, fieldKey, permission } 
            : { roleId: p.roleId, moduleKey: p.moduleKey, fieldKey: p.fieldKey, permission: p.permission }
        );
        await storage.setRoleFieldPermissions(roleId, updatedPerms);
      } else {
        // Add new
        const newPerms = [...currentPerms.map(p => ({ 
          roleId: p.roleId, 
          moduleKey: p.moduleKey, 
          fieldKey: p.fieldKey, 
          permission: p.permission 
        })), { roleId, moduleKey, fieldKey, permission }];
        await storage.setRoleFieldPermissions(roleId, newPerms);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to update field permission:", error);
      res.status(500).json({ error: "Failed to update field permission" });
    }
  });

  // Seed default roles
  app.post("/api/roles/seed", requireAuth, async (req, res) => {
    try {
      const existingRoles = await storage.getAllRoles();
      
      // Define the 3 system roles with legacyRole for backward compatibility
      const systemRoles = [
        {
          name: "Administrator",
          description: "Full access to all modules and features",
          department: "management",
          legacyRole: "admin",
          isSystem: true,
          moduleAccess: {
            dashboard: "visible",
            customers: "visible",
            hospitals: "visible",
            collaborators: "visible",
            invoices: "visible",
            users: "visible",
            settings: "visible",
            configurator: "visible",
          },
        },
        {
          name: "User",
          description: "Access to operational modules",
          department: "operations",
          legacyRole: "user",
          isSystem: true,
          moduleAccess: {
            dashboard: "visible",
            customers: "visible",
            hospitals: "visible",
            collaborators: "visible",
            invoices: "visible",
            users: "hidden",
            settings: "hidden",
            configurator: "hidden",
          },
        },
        {
          name: "Manager",
          description: "Dashboard access only",
          department: "management",
          legacyRole: "manager",
          isSystem: true,
          moduleAccess: {
            dashboard: "visible",
            customers: "hidden",
            hospitals: "hidden",
            collaborators: "hidden",
            invoices: "hidden",
            users: "hidden",
            settings: "hidden",
            configurator: "hidden",
          },
        },
      ];

      const createdRoles: Role[] = [];

      for (const roleData of systemRoles) {
        // Skip if role already exists
        const existingRole = existingRoles.find(r => r.name === roleData.name);
        if (existingRole) {
          createdRoles.push(existingRole);
          continue;
        }

        // Create the role
        const role = await storage.createRole({
          name: roleData.name,
          description: roleData.description,
          department: roleData.department,
          legacyRole: roleData.legacyRole,
          isSystem: roleData.isSystem,
          isActive: true,
          createdBy: req.session.user!.id,
        });

        // Set module permissions
        const modulePerms = Object.entries(roleData.moduleAccess).map(([moduleKey, access]) => ({
          roleId: role.id,
          moduleKey,
          access,
        }));
        await storage.setRoleModulePermissions(role.id, modulePerms);

        createdRoles.push(role);
      }

      res.json({ 
        success: true, 
        message: "System roles created successfully",
        roles: createdRoles 
      });
    } catch (error) {
      console.error("Failed to seed roles:", error);
      res.status(500).json({ error: "Failed to seed roles" });
    }
  });

  // ===== Departments API =====
  app.get("/api/departments", requireAuth, async (req, res) => {
    try {
      const allDepartments = await storage.getAllDepartments();
      res.json(allDepartments);
    } catch (error) {
      console.error("Failed to get departments:", error);
      res.status(500).json({ error: "Failed to get departments" });
    }
  });

  app.post("/api/departments", requireAuth, async (req, res) => {
    try {
      const department = await storage.createDepartment(req.body);
      await logActivity(
        req.session.user!.id,
        "created_department",
        "department",
        department.id,
        department.name,
        undefined,
        req.ip
      );
      res.status(201).json(department);
    } catch (error) {
      console.error("Failed to create department:", error);
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  app.patch("/api/departments/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const department = await storage.updateDepartment(id, req.body);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }
      await logActivity(
        req.session.user!.id,
        "updated_department",
        "department",
        department.id,
        department.name,
        undefined,
        req.ip
      );
      res.json(department);
    } catch (error) {
      console.error("Failed to update department:", error);
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const department = await storage.getDepartment(id);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }
      const deleted = await storage.deleteDepartment(id);
      await logActivity(
        req.session.user!.id,
        "deleted_department",
        "department",
        id,
        department.name,
        undefined,
        req.ip
      );
      res.json({ success: deleted });
    } catch (error) {
      console.error("Failed to delete department:", error);
      res.status(500).json({ error: "Failed to delete department" });
    }
  });

  // ============= Campaigns Routes =============

  app.get("/api/campaigns", requireAuth, async (req, res) => {
    try {
      const campaigns = await storage.getAllCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/:id", requireAuth, async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Failed to fetch campaign:", error);
      res.status(500).json({ error: "Failed to fetch campaign" });
    }
  });

  app.post("/api/campaigns", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCampaignSchema.parse({
        ...req.body,
        createdBy: req.session.user!.id,
      });
      const campaign = await storage.createCampaign(validatedData);
      await logActivity(
        req.session.user!.id,
        "created_campaign",
        "campaign",
        campaign.id,
        campaign.name,
        undefined,
        req.ip
      );
      res.status(201).json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Failed to create campaign:", error);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  app.patch("/api/campaigns/:id", requireAuth, async (req, res) => {
    try {
      const campaign = await storage.updateCampaign(req.params.id, req.body);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      await logActivity(
        req.session.user!.id,
        "updated_campaign",
        "campaign",
        campaign.id,
        campaign.name,
        undefined,
        req.ip
      );
      res.json(campaign);
    } catch (error) {
      console.error("Failed to update campaign:", error);
      res.status(500).json({ error: "Failed to update campaign" });
    }
  });

  app.delete("/api/campaigns/:id", requireAuth, async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const deleted = await storage.deleteCampaign(req.params.id);
      await logActivity(
        req.session.user!.id,
        "deleted_campaign",
        "campaign",
        req.params.id,
        campaign.name,
        undefined,
        req.ip
      );
      res.json({ success: deleted });
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });

  // Preview customers matching campaign criteria
  app.post("/api/campaigns/:id/preview", requireAuth, async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      let customers = await storage.getAllCustomers();
      
      // Filter by campaign country codes
      if (campaign.countryCodes && campaign.countryCodes.length > 0) {
        customers = customers.filter(c => campaign.countryCodes.includes(c.country));
      }
      
      // Apply criteria filtering if exists
      if (campaign.criteria) {
        try {
          const criteria = JSON.parse(campaign.criteria);
          customers = applyCustomerCriteria(customers, criteria);
        } catch (e) {
          // Invalid criteria JSON, return all customers
        }
      }
      
      res.json({ count: customers.length, customers: customers.slice(0, 100) });
    } catch (error) {
      console.error("Failed to preview campaign:", error);
      res.status(500).json({ error: "Failed to preview campaign" });
    }
  });

  // Generate contacts from criteria
  app.post("/api/campaigns/:id/generate-contacts", requireAuth, async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      // Delete existing contacts
      await storage.deleteCampaignContactsByCampaign(req.params.id);
      
      let customers = await storage.getAllCustomers();
      
      // Filter by campaign country codes
      if (campaign.countryCodes && campaign.countryCodes.length > 0) {
        customers = customers.filter(c => campaign.countryCodes.includes(c.country));
      }
      
      // Apply criteria filtering if exists
      if (campaign.criteria) {
        try {
          const criteria = JSON.parse(campaign.criteria);
          customers = applyCustomerCriteria(customers, criteria);
        } catch (e) {
          // Invalid criteria JSON
        }
      }
      
      // Create contacts with default values for required fields
      const contactsData = customers.map(c => ({
        campaignId: req.params.id,
        customerId: c.id,
        status: "pending" as const,
        attemptCount: 0,
        priorityScore: 50, // Default priority
      }));
      
      const contacts = await storage.createCampaignContacts(contactsData);
      
      await logActivity(
        req.session.user!.id,
        "generated_campaign_contacts",
        "campaign",
        campaign.id,
        campaign.name,
        { count: contacts.length },
        req.ip
      );
      
      // Log campaign_joined for each customer
      for (const customer of customers) {
        await logActivity(
          req.session.user!.id,
          "campaign_joined",
          "customer",
          customer.id,
          `${customer.firstName} ${customer.lastName}`,
          { campaignId: campaign.id, campaignName: campaign.name }
        );
      }
      
      res.json({ count: contacts.length });
    } catch (error) {
      console.error("Failed to generate campaign contacts:", error);
      res.status(500).json({ error: "Failed to generate campaign contacts" });
    }
  });

  // Campaign Contacts
  app.get("/api/campaigns/:id/contacts", requireAuth, async (req, res) => {
    try {
      const contacts = await storage.getCampaignContacts(req.params.id);
      
      // Enrich with customer data
      const enrichedContacts = await Promise.all(
        contacts.map(async (contact) => {
          const customer = await storage.getCustomer(contact.customerId);
          return { ...contact, customer };
        })
      );
      
      res.json(enrichedContacts);
    } catch (error) {
      console.error("Failed to fetch campaign contacts:", error);
      res.status(500).json({ error: "Failed to fetch campaign contacts" });
    }
  });

  app.patch("/api/campaigns/:campaignId/contacts/:contactId", requireAuth, async (req, res) => {
    try {
      const existingContact = await storage.getCampaignContact(req.params.contactId);
      if (!existingContact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
      const previousStatus = existingContact.status;
      const contact = await storage.updateCampaignContact(req.params.contactId, req.body);
      
      // Get customer and campaign info for logging
      const customer = await storage.getCustomer(existingContact.customerId);
      const campaign = await storage.getCampaign(existingContact.campaignId);
      
      // Log history if status changed
      if (req.body.status && req.body.status !== previousStatus) {
        await storage.createCampaignContactHistory({
          campaignContactId: req.params.contactId,
          userId: req.session.user!.id,
          action: "status_change",
          previousStatus,
          newStatus: req.body.status,
          notes: req.body.notes || null,
        });
        
        // Log to customer activity
        if (customer) {
          await logActivity(
            req.session.user!.id,
            "campaign_status_changed",
            "customer",
            customer.id,
            `${customer.firstName} ${customer.lastName}`,
            { 
              campaignId: campaign?.id,
              campaignName: campaign?.name || "Kampaň",
              previousStatus,
              newStatus: req.body.status,
              notes: req.body.notes || null
            },
            req.ip
          );
        }
      } else if (req.body.notes) {
        await storage.createCampaignContactHistory({
          campaignContactId: req.params.contactId,
          userId: req.session.user!.id,
          action: "note_added",
          notes: req.body.notes,
        });
        
        // Log note to customer activity
        if (customer) {
          await logActivity(
            req.session.user!.id,
            "campaign_note_added",
            "customer",
            customer.id,
            `${customer.firstName} ${customer.lastName}`,
            { 
              campaignId: campaign?.id,
              campaignName: campaign?.name || "Kampaň",
              content: req.body.notes
            },
            req.ip
          );
        }
      }
      
      res.json(contact);
    } catch (error) {
      console.error("Failed to update campaign contact:", error);
      res.status(500).json({ error: "Failed to update campaign contact" });
    }
  });

  app.get("/api/campaigns/:campaignId/contacts/:contactId/history", requireAuth, async (req, res) => {
    try {
      const history = await storage.getCampaignContactHistory(req.params.contactId);
      res.json(history);
    } catch (error) {
      console.error("Failed to fetch contact history:", error);
      res.status(500).json({ error: "Failed to fetch contact history" });
    }
  });

  // Bulk update campaign contacts
  app.post("/api/campaigns/:id/contacts/bulk-update", requireAuth, async (req, res) => {
    try {
      const { contactIds, status, priority, assignedTo } = req.body;
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "contactIds is required and must be a non-empty array" });
      }

      const updateData: any = {};
      if (status) updateData.status = status;
      if (priority !== undefined) updateData.priority = priority;
      if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

      let updatedCount = 0;
      for (const contactId of contactIds) {
        try {
          const existingContact = await storage.getCampaignContact(contactId);
          if (existingContact && existingContact.campaignId === req.params.id) {
            await storage.updateCampaignContact(contactId, updateData);
            
            if (status && status !== existingContact.status) {
              await storage.createCampaignContactHistory({
                campaignContactId: contactId,
                userId: req.session.user!.id,
                action: "status_change",
                previousStatus: existingContact.status,
                newStatus: status,
                notes: "Bulk update",
              });
            }
            updatedCount++;
          }
        } catch (err) {
          console.error(`Failed to update contact ${contactId}:`, err);
        }
      }

      res.json({ count: updatedCount });
    } catch (error) {
      console.error("Failed to bulk update contacts:", error);
      res.status(500).json({ error: "Failed to bulk update contacts" });
    }
  });

  // Campaign Templates endpoints
  app.get("/api/campaign-templates", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getAllCampaignTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Failed to fetch campaign templates:", error);
      res.status(500).json({ error: "Failed to fetch campaign templates" });
    }
  });

  app.get("/api/campaign-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getCampaignTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Failed to fetch campaign template:", error);
      res.status(500).json({ error: "Failed to fetch campaign template" });
    }
  });

  app.post("/api/campaign-templates", requireAuth, async (req, res) => {
    try {
      const template = await storage.createCampaignTemplate({
        ...req.body,
        createdBy: req.session.user!.id,
      });
      res.status(201).json(template);
    } catch (error) {
      console.error("Failed to create campaign template:", error);
      res.status(500).json({ error: "Failed to create campaign template" });
    }
  });

  app.patch("/api/campaign-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.updateCampaignTemplate(req.params.id, req.body);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Failed to update campaign template:", error);
      res.status(500).json({ error: "Failed to update campaign template" });
    }
  });

  app.delete("/api/campaign-templates/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteCampaignTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete campaign template:", error);
      res.status(500).json({ error: "Failed to delete campaign template" });
    }
  });

  // Clone campaign endpoint
  app.post("/api/campaigns/:id/clone", requireAuth, async (req, res) => {
    try {
      const sourceCampaign = await storage.getCampaign(req.params.id);
      if (!sourceCampaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const { name } = req.body;
      const clonedCampaign = await storage.createCampaign({
        name: name || `${sourceCampaign.name} (kópia)`,
        description: sourceCampaign.description,
        type: sourceCampaign.type as any,
        status: "draft",
        countryCodes: sourceCampaign.countryCodes || [],
        criteria: sourceCampaign.criteria,
        settings: sourceCampaign.settings,
        createdBy: req.session.user!.id,
      });

      res.status(201).json(clonedCampaign);
    } catch (error) {
      console.error("Failed to clone campaign:", error);
      res.status(500).json({ error: "Failed to clone campaign" });
    }
  });

  // Save campaign as template
  app.post("/api/campaigns/:id/save-as-template", requireAuth, async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const { name, description } = req.body;
      const template = await storage.createCampaignTemplate({
        name: name || `${campaign.name} - Šablóna`,
        description: description || campaign.description,
        type: campaign.type as any,
        countryCodes: campaign.countryCodes || [],
        criteria: campaign.criteria,
        settings: campaign.settings,
        createdBy: req.session.user!.id,
      });

      res.status(201).json(template);
    } catch (error) {
      console.error("Failed to save campaign as template:", error);
      res.status(500).json({ error: "Failed to save campaign as template" });
    }
  });

  // Create campaign from template
  app.post("/api/campaign-templates/:id/create-campaign", requireAuth, async (req, res) => {
    try {
      const template = await storage.getCampaignTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const { name } = req.body;
      const campaign = await storage.createCampaign({
        name: name || `${template.name} - Kampaň`,
        description: template.description,
        type: template.type as any,
        status: "draft",
        countryCodes: template.countryCodes || [],
        criteria: template.criteria,
        settings: template.settings,
        createdBy: req.session.user!.id,
      });

      res.status(201).json(campaign);
    } catch (error) {
      console.error("Failed to create campaign from template:", error);
      res.status(500).json({ error: "Failed to create campaign from template" });
    }
  });

  // Campaign Schedule endpoints
  app.get("/api/campaigns/:id/schedule", requireAuth, async (req, res) => {
    try {
      const schedule = await storage.getCampaignSchedule(req.params.id);
      res.json(schedule || null);
    } catch (error) {
      console.error("Failed to fetch campaign schedule:", error);
      res.status(500).json({ error: "Failed to fetch campaign schedule" });
    }
  });

  app.post("/api/campaigns/:id/schedule", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getCampaignSchedule(req.params.id);
      if (existing) {
        const updated = await storage.updateCampaignSchedule(req.params.id, req.body);
        res.json(updated);
      } else {
        const schedule = await storage.createCampaignSchedule({
          campaignId: req.params.id,
          ...req.body,
        });
        res.json(schedule);
      }
    } catch (error) {
      console.error("Failed to save campaign schedule:", error);
      res.status(500).json({ error: "Failed to save campaign schedule" });
    }
  });

  // Campaign Operator Settings endpoints
  app.get("/api/campaigns/:id/operators", requireAuth, async (req, res) => {
    try {
      const operators = await storage.getCampaignOperators(req.params.id);
      res.json(operators);
    } catch (error) {
      console.error("Failed to fetch campaign operators:", error);
      res.status(500).json({ error: "Failed to fetch campaign operators" });
    }
  });

  app.post("/api/campaigns/:id/operators", requireAuth, async (req, res) => {
    try {
      const operator = await storage.createCampaignOperatorSetting({
        campaignId: req.params.id,
        ...req.body,
      });
      res.json(operator);
    } catch (error) {
      console.error("Failed to add campaign operator:", error);
      res.status(500).json({ error: "Failed to add campaign operator" });
    }
  });

  app.patch("/api/campaigns/:campaignId/operators/:operatorId", requireAuth, async (req, res) => {
    try {
      const operator = await storage.updateCampaignOperatorSetting(req.params.operatorId, req.body);
      if (!operator) {
        return res.status(404).json({ error: "Operator setting not found" });
      }
      res.json(operator);
    } catch (error) {
      console.error("Failed to update campaign operator:", error);
      res.status(500).json({ error: "Failed to update campaign operator" });
    }
  });

  app.delete("/api/campaigns/:campaignId/operators/:operatorId", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteCampaignOperatorSetting(req.params.operatorId);
      if (!deleted) {
        return res.status(404).json({ error: "Operator setting not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove campaign operator:", error);
      res.status(500).json({ error: "Failed to remove campaign operator" });
    }
  });

  // Contact Sessions endpoints
  app.get("/api/campaigns/:campaignId/contacts/:contactId/sessions", requireAuth, async (req, res) => {
    try {
      const sessions = await storage.getContactSessions(req.params.contactId);
      res.json(sessions);
    } catch (error) {
      console.error("Failed to fetch contact sessions:", error);
      res.status(500).json({ error: "Failed to fetch contact sessions" });
    }
  });

  app.post("/api/campaigns/:campaignId/contacts/:contactId/sessions", requireAuth, async (req, res) => {
    try {
      const session = await storage.createContactSession({
        campaignContactId: req.params.contactId,
        operatorId: req.session.user!.id,
        ...req.body,
      });
      res.json(session);
    } catch (error) {
      console.error("Failed to create contact session:", error);
      res.status(500).json({ error: "Failed to create contact session" });
    }
  });

  app.patch("/api/campaigns/:campaignId/contacts/:contactId/sessions/:sessionId", requireAuth, async (req, res) => {
    try {
      const session = await storage.updateContactSession(req.params.sessionId, req.body);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Failed to update contact session:", error);
      res.status(500).json({ error: "Failed to update contact session" });
    }
  });

  // Campaign Stats endpoint
  app.get("/api/campaigns/:id/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getCampaignStats(req.params.id);
      res.json(stats);
    } catch (error) {
      console.error("Failed to fetch campaign stats:", error);
      res.status(500).json({ error: "Failed to fetch campaign stats" });
    }
  });

  // Campaign Metrics Snapshots
  app.get("/api/campaigns/:id/metrics", requireAuth, async (req, res) => {
    try {
      const metrics = await storage.getCampaignMetrics(req.params.id);
      res.json(metrics);
    } catch (error) {
      console.error("Failed to fetch campaign metrics:", error);
      res.status(500).json({ error: "Failed to fetch campaign metrics" });
    }
  });

  // ===== SIP Settings Routes =====
  
  // Get SIP settings (global server configuration)
  app.get("/api/sip-settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getSipSettings();
      res.json(settings || null);
    } catch (error) {
      console.error("Failed to fetch SIP settings:", error);
      res.status(500).json({ error: "Failed to fetch SIP settings" });
    }
  });

  // Update SIP settings (admin only)
  app.post("/api/sip-settings", requireAuth, async (req, res) => {
    try {
      // Check if user is admin
      if (req.session.user?.role !== "admin") {
        return res.status(403).json({ error: "Only admins can modify SIP settings" });
      }
      
      const validated = insertSipSettingsSchema.parse(req.body);
      const settings = await storage.upsertSipSettings(validated);
      
      await logActivity(
        req.session.user.id,
        "sip_settings_updated",
        "sip_settings",
        settings.id,
        "SIP Settings",
        { serverAddress: settings.serverAddress },
        req.ip
      );
      
      res.json(settings);
    } catch (error: any) {
      console.error("Failed to update SIP settings:", error);
      res.status(400).json({ error: error.message || "Failed to update SIP settings" });
    }
  });

  // ===== Call Logs Routes =====
  
  // Get all call logs (with optional filters)
  app.get("/api/call-logs", requireAuth, async (req, res) => {
    try {
      const { userId, customerId, campaignId, limit } = req.query;
      
      let logs;
      if (userId) {
        logs = await storage.getCallLogsByUser(userId as string, limit ? parseInt(limit as string) : undefined);
      } else if (customerId) {
        logs = await storage.getCallLogsByCustomer(customerId as string);
      } else if (campaignId) {
        logs = await storage.getCallLogsByCampaign(campaignId as string);
      } else {
        logs = await storage.getAllCallLogs(limit ? parseInt(limit as string) : undefined);
      }
      
      res.json(logs);
    } catch (error) {
      console.error("Failed to fetch call logs:", error);
      res.status(500).json({ error: "Failed to fetch call logs" });
    }
  });

  // Get call log by ID
  app.get("/api/call-logs/:id", requireAuth, async (req, res) => {
    try {
      const log = await storage.getCallLog(req.params.id);
      if (!log) {
        return res.status(404).json({ error: "Call log not found" });
      }
      res.json(log);
    } catch (error) {
      console.error("Failed to fetch call log:", error);
      res.status(500).json({ error: "Failed to fetch call log" });
    }
  });

  // Create a new call log (when call starts)
  app.post("/api/call-logs", requireAuth, async (req, res) => {
    try {
      const validated = insertCallLogSchema.parse({
        ...req.body,
        userId: req.session.user?.id
      });
      const log = await storage.createCallLog(validated);
      res.status(201).json(log);
    } catch (error: any) {
      console.error("Failed to create call log:", error);
      res.status(400).json({ error: error.message || "Failed to create call log" });
    }
  });

  // Update a call log (when call ends or status changes)
  app.patch("/api/call-logs/:id", requireAuth, async (req, res) => {
    try {
      const log = await storage.updateCallLog(req.params.id, req.body);
      if (!log) {
        return res.status(404).json({ error: "Call log not found" });
      }
      res.json(log);
    } catch (error: any) {
      console.error("Failed to update call log:", error);
      res.status(400).json({ error: error.message || "Failed to update call log" });
    }
  });

  // Get call logs for current user
  app.get("/api/my-call-logs", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getCallLogsByUser(userId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Failed to fetch user call logs:", error);
      res.status(500).json({ error: "Failed to fetch call logs" });
    }
  });

  // ========== PRODUCT SETS (ZOSTAVY) ==========

  // Get products that have billsets for a specific country (for contract product selection)
  app.get("/api/products-with-sets", requireAuth, async (req, res) => {
    try {
      const countryFilter = req.query.country as string | undefined;
      const products = await storage.getAllProducts();
      const productsWithSets: any[] = [];
      
      for (const product of products) {
        const sets = await storage.getProductSets(product.id);
        // Filter sets by country - include if matches OR if set has no country (global)
        const matchingSets = countryFilter 
          ? sets.filter(s => !s.countryCode || s.countryCode.toUpperCase() === countryFilter.toUpperCase())
          : sets;
        
        if (matchingSets.length > 0) {
          productsWithSets.push({
            id: product.id,
            name: product.name,
            setsCount: matchingSets.length
          });
        }
      }
      
      res.json(productsWithSets);
    } catch (error) {
      console.error("Failed to fetch products with sets:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Get all product sets (for contract product selection)
  app.get("/api/product-sets", requireAuth, async (req, res) => {
    try {
      const countryFilter = req.query.country as string | undefined;
      const productIdFilter = req.query.productId as string | undefined;
      
      // If productId is provided, get sets for that product only
      if (productIdFilter) {
        let sets = await storage.getProductSets(productIdFilter);
        if (countryFilter) {
          sets = sets.filter(s => !s.countryCode || s.countryCode.toUpperCase() === countryFilter.toUpperCase());
        }
        const product = await storage.getProduct(productIdFilter);
        const enrichedSets = sets.map(s => ({
          ...s,
          productName: product?.name || ""
        }));
        return res.json(enrichedSets);
      }
      
      // Otherwise get all sets
      const products = await storage.getAllProducts();
      const allSets: any[] = [];
      
      for (const product of products) {
        const sets = await storage.getProductSets(product.id);
        for (const set of sets) {
          if (!countryFilter || !set.countryCode || set.countryCode.toUpperCase() === countryFilter.toUpperCase()) {
            allSets.push({
              ...set,
              productName: product.name
            });
          }
        }
      }
      
      res.json(allSets);
    } catch (error) {
      console.error("Failed to fetch all product sets:", error);
      res.status(500).json({ error: "Failed to fetch product sets" });
    }
  });

  // Get all product sets for a product (optionally filtered by country)
  app.get("/api/products/:productId/sets", requireAuth, async (req, res) => {
    try {
      const countryFilter = req.query.country as string | undefined;
      let sets = await storage.getProductSets(req.params.productId);
      
      // Filter by country if provided - show sets that match the country OR have no country (global)
      if (countryFilter) {
        sets = sets.filter(s => !s.countryCode || s.countryCode === countryFilter);
      }
      
      res.json(sets);
    } catch (error) {
      console.error("Failed to fetch product sets:", error);
      res.status(500).json({ error: "Failed to fetch product sets" });
    }
  });

  // Get single product set with collections and storage
  app.get("/api/product-sets/:id", requireAuth, async (req, res) => {
    try {
      const set = await storage.getProductSet(req.params.id);
      if (!set) {
        return res.status(404).json({ error: "Product set not found" });
      }
      const collections = await storage.getProductSetCollections(req.params.id);
      const storageItems = await storage.getProductSetStorage(req.params.id);
      
      // Enrich collections with instance names and price details
      const enrichedCollections = await Promise.all(collections.map(async (col: any) => {
        let enriched = { ...col };
        if (col.instanceId) {
          const instance = await storage.getMarketProductInstance(col.instanceId);
          enriched.instanceName = instance?.name || null;
        }
        if (col.priceId) {
          const price = await storage.getInstancePrice(col.priceId);
          enriched.priceName = price?.name || null;
          enriched.priceAmount = price?.price || null;
        }
        if (col.discountId) {
          const discount = await storage.getInstanceDiscount(col.discountId);
          enriched.discountName = discount?.name || null;
          enriched.discountPercent = discount?.percentageValue || null;
          enriched.discountFixed = discount?.fixedValue || null;
        }
        if (col.vatRateId) {
          const vat = await storage.getInstanceVatRate(col.vatRateId);
          enriched.vatName = vat?.name || null;
          enriched.vatPercent = vat?.ratePercentage || null;
        }
        return enriched;
      }));
      
      // Enrich storage with service names and price details
      const enrichedStorage = await Promise.all(storageItems.map(async (stor: any) => {
        let enriched = { ...stor };
        if (stor.serviceId) {
          const service = await storage.getMarketProductService(stor.serviceId);
          enriched.serviceName = service?.name || null;
        }
        if (stor.priceId) {
          const price = await storage.getInstancePrice(stor.priceId);
          enriched.priceName = price?.name || null;
          enriched.priceAmount = price?.price || null;
        }
        return enriched;
      }));
      
      // Calculate totals from collections and storage
      let totalNet = 0;
      let totalVat = 0;
      let totalGross = 0;
      let totalDiscount = 0;
      
      for (const col of enrichedCollections) {
        totalNet += parseFloat(col.lineNetAmount || "0");
        totalVat += parseFloat(col.lineVatAmount || "0");
        totalGross += parseFloat(col.lineGrossAmount || "0");
        totalDiscount += parseFloat(col.lineDiscountAmount || "0");
      }
      
      for (const stor of enrichedStorage) {
        totalNet += parseFloat(stor.lineNetAmount || "0");
        totalVat += parseFloat(stor.lineVatAmount || "0");
        totalGross += parseFloat(stor.lineGrossAmount || "0");
        totalDiscount += parseFloat(stor.lineDiscountAmount || "0");
      }
      
      // Get product name
      const product = await storage.getProduct(set.productId);
      
      res.json({ 
        ...set, 
        productName: product?.name || null,
        collections: enrichedCollections, 
        storage: enrichedStorage,
        calculatedTotals: {
          totalNetAmount: totalNet.toFixed(2),
          totalDiscountAmount: totalDiscount.toFixed(2),
          totalVatAmount: totalVat.toFixed(2),
          totalGrossAmount: totalGross.toFixed(2)
        }
      });
    } catch (error) {
      console.error("Failed to fetch product set:", error);
      res.status(500).json({ error: "Failed to fetch product set" });
    }
  });

  // Create product set
  app.post("/api/products/:productId/sets", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields({ ...req.body, productId: req.params.productId });
      const set = await storage.createProductSet(data);
      res.status(201).json(set);
    } catch (error: any) {
      console.error("Failed to create product set:", error);
      res.status(400).json({ error: error.message || "Failed to create product set" });
    }
  });

  // Update product set
  app.patch("/api/product-sets/:id", requireAuth, async (req, res) => {
    try {
      const data = parseDateFields(req.body);
      const set = await storage.updateProductSet(req.params.id, data);
      if (!set) {
        return res.status(404).json({ error: "Product set not found" });
      }
      res.json(set);
    } catch (error: any) {
      console.error("Failed to update product set:", error);
      res.status(400).json({ error: error.message || "Failed to update product set" });
    }
  });

  // Delete product set
  app.delete("/api/product-sets/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteProductSet(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete product set:", error);
      res.status(500).json({ error: "Failed to delete product set" });
    }
  });

  // Get collections for a product set
  app.get("/api/product-sets/:setId/collections", requireAuth, async (req, res) => {
    try {
      const collections = await storage.getProductSetCollections(req.params.setId);
      res.json(collections);
    } catch (error) {
      console.error("Failed to fetch set collections:", error);
      res.status(500).json({ error: "Failed to fetch set collections" });
    }
  });

  // Add collection to product set
  app.post("/api/product-sets/:setId/collections", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, productSetId: req.params.setId };
      const collection = await storage.createProductSetCollection(data);
      res.status(201).json(collection);
    } catch (error: any) {
      console.error("Failed to add collection to set:", error);
      res.status(400).json({ error: error.message || "Failed to add collection" });
    }
  });

  // Update set collection
  app.patch("/api/product-set-collections/:id", requireAuth, async (req, res) => {
    try {
      const collection = await storage.updateProductSetCollection(req.params.id, req.body);
      if (!collection) {
        return res.status(404).json({ error: "Set collection not found" });
      }
      res.json(collection);
    } catch (error: any) {
      console.error("Failed to update set collection:", error);
      res.status(400).json({ error: error.message || "Failed to update set collection" });
    }
  });

  // Delete set collection
  app.delete("/api/product-set-collections/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteProductSetCollection(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete set collection:", error);
      res.status(500).json({ error: "Failed to delete set collection" });
    }
  });

  // Get storage items for a product set
  app.get("/api/product-sets/:setId/storage", requireAuth, async (req, res) => {
    try {
      const storageItems = await storage.getProductSetStorage(req.params.setId);
      res.json(storageItems);
    } catch (error) {
      console.error("Failed to fetch set storage:", error);
      res.status(500).json({ error: "Failed to fetch set storage" });
    }
  });

  // Add storage to product set
  app.post("/api/product-sets/:setId/storage", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, productSetId: req.params.setId };
      const storageItem = await storage.createProductSetStorage(data);
      res.status(201).json(storageItem);
    } catch (error: any) {
      console.error("Failed to add storage to set:", error);
      res.status(400).json({ error: error.message || "Failed to add storage" });
    }
  });

  // Update set storage
  app.patch("/api/product-set-storage/:id", requireAuth, async (req, res) => {
    try {
      const storageItem = await storage.updateProductSetStorage(req.params.id, req.body);
      if (!storageItem) {
        return res.status(404).json({ error: "Set storage not found" });
      }
      res.json(storageItem);
    } catch (error: any) {
      console.error("Failed to update set storage:", error);
      res.status(400).json({ error: error.message || "Failed to update set storage" });
    }
  });

  // Delete set storage
  app.delete("/api/product-set-storage/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteProductSetStorage(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete set storage:", error);
      res.status(500).json({ error: "Failed to delete set storage" });
    }
  });

  // ==== Chat System with WebSocket ====
  
  // Track online users and their WebSocket connections
  const onlineUsers = new Map<string, { ws: WebSocket; user: SafeUser }>();
  
  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/chat" });
  console.log("[Chat] WebSocket server initialized on path /ws/chat");
  
  wss.on("connection", (ws, req) => {
    console.log("[Chat] New WebSocket connection from:", req.socket.remoteAddress);
    let userId: string | null = null;
    let user: SafeUser | null = null;
    
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case "auth":
            // Authenticate user by session or user info passed from client
            userId = message.userId;
            if (userId) {
              console.log("[Chat] Auth attempt for user:", userId);
              const fullUser = await storage.getUser(userId);
              if (fullUser) {
                const { passwordHash, ...safeUser } = fullUser;
                user = safeUser;
                onlineUsers.set(userId, { ws, user });
                console.log("[Chat] User authenticated:", fullUser.fullName, "| Total online:", onlineUsers.size);
                
                // Broadcast user online status to all connected clients
                broadcastPresence();
                
                ws.send(JSON.stringify({ type: "auth_success", userId }));
              } else {
                console.log("[Chat] User not found:", userId);
              }
            }
            break;
            
          case "chat_message":
            if (!userId || !user) {
              ws.send(JSON.stringify({ type: "error", error: "Not authenticated" }));
              return;
            }
            
            const { receiverId, content } = message;
            
            // Store message in database
            const chatMsg = await storage.createChatMessage({
              senderId: userId,
              receiverId,
              content,
              isRead: false,
            });
            
            // Send confirmation to sender
            ws.send(JSON.stringify({ 
              type: "message_sent", 
              message: chatMsg 
            }));
            
            // Deliver to recipient if online
            const recipient = onlineUsers.get(receiverId);
            if (recipient) {
              recipient.ws.send(JSON.stringify({
                type: "new_message",
                message: chatMsg,
                sender: user
              }));
            }
            break;
            
          case "mark_read":
            if (!userId) return;
            const { senderId } = message;
            await storage.markMessagesAsRead(senderId, userId);
            
            // Notify sender that messages were read
            const sender = onlineUsers.get(senderId);
            if (sender) {
              sender.ws.send(JSON.stringify({
                type: "messages_read",
                readBy: userId
              }));
            }
            break;
            
          case "typing":
            if (!userId) return;
            const typingRecipient = onlineUsers.get(message.receiverId);
            if (typingRecipient) {
              typingRecipient.ws.send(JSON.stringify({
                type: "user_typing",
                userId: userId,
                isTyping: message.isTyping
              }));
            }
            break;
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(JSON.stringify({ type: "error", error: "Invalid message format" }));
      }
    });
    
    ws.on("close", () => {
      if (userId) {
        onlineUsers.delete(userId);
        broadcastPresence();
      }
    });
    
    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      if (userId) {
        onlineUsers.delete(userId);
      }
    });
  });
  
  function broadcastPresence() {
    const onlineUserList = Array.from(onlineUsers.values()).map(u => ({
      id: u.user.id,
      fullName: u.user.fullName,
      username: u.user.username,
      avatarUrl: u.user.avatarUrl
    }));
    
    const presenceMessage = JSON.stringify({
      type: "presence_update",
      onlineUsers: onlineUserList
    });
    
    for (const { ws } of onlineUsers.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(presenceMessage);
      }
    }
  }
  
  // REST API for chat history
  app.get("/api/chat/conversations", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const conversations = await storage.getChatConversations(userId);
      
      // Enrich with user data
      const enrichedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const partner = await storage.getUser(conv.partnerId);
          return {
            ...conv,
            partner: partner ? { 
              id: partner.id, 
              fullName: partner.fullName, 
              username: partner.username,
              avatarUrl: partner.avatarUrl 
            } : null
          };
        })
      );
      
      res.json(enrichedConversations);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });
  
  app.get("/api/chat/messages/:partnerId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const { partnerId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const messages = await storage.getChatMessages(userId, partnerId, limit);
      
      // Mark messages as read
      await storage.markMessagesAsRead(partnerId, userId);
      
      res.json(messages.reverse()); // Return in chronological order
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });
  
  app.get("/api/chat/online-users", requireAuth, async (req, res) => {
    try {
      const onlineUserList = Array.from(onlineUsers.values()).map(u => ({
        id: u.user.id,
        fullName: u.user.fullName,
        username: u.user.username,
        avatarUrl: u.user.avatarUrl
      }));
      res.json(onlineUserList);
    } catch (error) {
      console.error("Failed to fetch online users:", error);
      res.status(500).json({ error: "Failed to fetch online users" });
    }
  });

  // ============= Exchange Rates Routes =============

  // Get all current exchange rates
  app.get("/api/exchange-rates", requireAuth, async (req, res) => {
    try {
      const rates = await storage.getLatestExchangeRates();
      const lastUpdate = await storage.getExchangeRatesLastUpdate();
      res.json({ rates, lastUpdate });
    } catch (error) {
      console.error("Failed to fetch exchange rates:", error);
      res.status(500).json({ error: "Failed to fetch exchange rates" });
    }
  });

  // Manually refresh exchange rates from NBS
  app.post("/api/exchange-rates/refresh", requireAuth, async (req, res) => {
    try {
      const rates = await fetchNBSExchangeRates();
      
      if (rates.length === 0) {
        return res.status(500).json({ error: "No rates received from NBS" });
      }
      
      const savedRates = await storage.upsertExchangeRates(rates);
      
      await logActivity(
        req.session.user!.id,
        "updated",
        "exchangeRates",
        "bulk",
        `Refreshed ${savedRates.length} exchange rates`,
        { ratesCount: savedRates.length },
        req.ip
      );
      
      res.json({ success: true, ratesCount: savedRates.length, rates: savedRates });
    } catch (error) {
      console.error("Failed to refresh exchange rates:", error);
      res.status(500).json({ error: "Failed to refresh exchange rates from NBS" });
    }
  });

  // Get specific exchange rate by currency code
  app.get("/api/exchange-rates/:code", requireAuth, async (req, res) => {
    try {
      const { code } = req.params;
      const rate = await storage.getExchangeRateByCode(code.toUpperCase());
      
      if (!rate) {
        return res.status(404).json({ error: "Exchange rate not found" });
      }
      
      res.json(rate);
    } catch (error) {
      console.error("Failed to fetch exchange rate:", error);
      res.status(500).json({ error: "Failed to fetch exchange rate" });
    }
  });

  // Set up automatic daily refresh at midnight (server timezone)
  scheduleExchangeRateUpdate();

  // ===== INFLATION RATES =====
  
  // Get all inflation rates
  app.get("/api/inflation-rates", requireAuth, async (req, res) => {
    try {
      const country = req.query.country as string | undefined;
      const rates = await storage.getInflationRates(country);
      const lastUpdate = await storage.getInflationRatesLastUpdate(country);
      res.json({ rates, lastUpdate });
    } catch (error) {
      console.error("Failed to fetch inflation rates:", error);
      res.status(500).json({ error: "Failed to fetch inflation rates" });
    }
  });

  // Update/create inflation rate
  app.post("/api/inflation-rates", requireAuth, async (req, res) => {
    try {
      const { year, rate, source, country } = req.body;
      
      if (!year || rate === undefined) {
        return res.status(400).json({ error: "Year and rate are required" });
      }
      
      const savedRate = await storage.upsertInflationRate({
        year: parseInt(year),
        rate: rate.toString(),
        source: source || null,
        country: country || "SK"
      });
      
      await logActivity(
        req.session.user!.id,
        "updated",
        "inflationRates",
        savedRate.id,
        `Updated inflation rate for ${country || "SK"} ${year}: ${rate}%`,
        { year, rate, country },
        req.ip
      );
      
      res.json(savedRate);
    } catch (error) {
      console.error("Failed to update inflation rate:", error);
      res.status(500).json({ error: "Failed to update inflation rate" });
    }
  });

  // Jira Integration API
  app.get("/api/jira/status", requireAuth, async (req, res) => {
    try {
      const { checkJiraConnection } = await import("./jira");
      const status = await checkJiraConnection();
      res.json(status);
    } catch (error: any) {
      res.json({ connected: false, error: error.message });
    }
  });

  app.get("/api/jira/projects", requireAuth, async (req, res) => {
    try {
      const { getJiraProjects } = await import("./jira");
      const projects = await getJiraProjects();
      res.json(projects);
    } catch (error: any) {
      console.error("Error fetching Jira projects:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Jira projects" });
    }
  });

  app.get("/api/jira/users", requireAuth, async (req, res) => {
    try {
      const { getJiraUsers } = await import("./jira");
      const users = await getJiraUsers();
      res.json(users);
    } catch (error: any) {
      console.error("Error fetching Jira users:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Jira users" });
    }
  });

  app.get("/api/jira/issues/:projectKey", requireAuth, async (req, res) => {
    try {
      const { getJiraIssues } = await import("./jira");
      const issues = await getJiraIssues(req.params.projectKey);
      res.json(issues);
    } catch (error: any) {
      console.error("Error fetching Jira issues:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Jira issues" });
    }
  });

  app.post("/api/jira/issues", requireAuth, async (req, res) => {
    try {
      const { createJiraIssue } = await import("./jira");
      const issue = await createJiraIssue(req.body);
      res.status(201).json(issue);
    } catch (error: any) {
      console.error("Error creating Jira issue:", error);
      res.status(500).json({ error: error.message || "Failed to create Jira issue" });
    }
  });

  app.post("/api/tasks/:id/sync-jira", requireAuth, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const { projectKey } = req.body;
      if (!projectKey) {
        return res.status(400).json({ error: "Project key is required" });
      }

      const { syncTaskToJira } = await import("./jira");
      const jiraUser = await storage.getUser(task.assignedUserId);
      
      const issue = await syncTaskToJira({
        title: task.title,
        description: task.description || undefined,
        projectKey,
        assigneeAccountId: jiraUser?.jiraAccountId || undefined
      });

      await logActivity(
        req.session.user!.id,
        "sync",
        "task",
        task.id,
        task.title,
        { jiraIssueKey: issue.key, projectKey },
        req.ip
      );

      res.json({ success: true, issue });
    } catch (error: any) {
      console.error("Error syncing task to Jira:", error);
      res.status(500).json({ error: error.message || "Failed to sync task to Jira" });
    }
  });

  app.patch("/api/users/:id/jira", requireAuth, async (req, res) => {
    try {
      const { jiraAccountId, jiraDisplayName } = req.body;
      const user = await storage.updateUser(req.params.id, { 
        jiraAccountId, 
        jiraDisplayName 
      });
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await logActivity(
        req.session.user!.id,
        "update",
        "user",
        user.id,
        user.fullName,
        { jiraAccountId, jiraDisplayName },
        req.ip
      );

      res.json(user);
    } catch (error) {
      console.error("Error updating user Jira info:", error);
      res.status(500).json({ error: "Failed to update user Jira info" });
    }
  });

  // ============================================
  // CONTRACT MANAGEMENT ENDPOINTS
  // ============================================

  // Contract Categories
  app.get("/api/contracts/categories", requireAuth, async (req, res) => {
    try {
      const categories = await storage.getAllContractCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching contract categories:", error);
      res.status(500).json({ error: "Failed to fetch contract categories" });
    }
  });

  app.get("/api/contracts/categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getContractCategory(id);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error fetching contract category:", error);
      res.status(500).json({ error: "Failed to fetch contract category" });
    }
  });

  app.post("/api/contracts/categories", requireAuth, async (req, res) => {
    try {
      const { value, label, description, sortOrder, labelSk, labelCz, labelHu, labelRo, labelIt, labelDe, labelUs } = req.body;
      
      // Check if value already exists
      const existing = await storage.getContractCategoryByValue(value);
      if (existing) {
        return res.status(400).json({ error: "Category with this value already exists" });
      }
      
      const category = await storage.createContractCategory({
        value,
        label,
        description: description || null,
        sortOrder: sortOrder || 0,
        labelSk: labelSk || null,
        labelCz: labelCz || null,
        labelHu: labelHu || null,
        labelRo: labelRo || null,
        labelIt: labelIt || null,
        labelDe: labelDe || null,
        labelUs: labelUs || null,
      });
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating contract category:", error);
      res.status(500).json({ error: "Failed to create contract category" });
    }
  });

  app.patch("/api/contracts/categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { value, label, description, sortOrder, labelSk, labelCz, labelHu, labelRo, labelIt, labelDe, labelUs } = req.body;
      
      // Check if value already exists for another category
      if (value) {
        const existing = await storage.getContractCategoryByValue(value);
        if (existing && existing.id !== id) {
          return res.status(400).json({ error: "Category with this value already exists" });
        }
      }
      
      const category = await storage.updateContractCategory(id, {
        ...(value && { value }),
        ...(label && { label }),
        ...(description !== undefined && { description }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(labelSk !== undefined && { labelSk: labelSk || null }),
        ...(labelCz !== undefined && { labelCz: labelCz || null }),
        ...(labelHu !== undefined && { labelHu: labelHu || null }),
        ...(labelRo !== undefined && { labelRo: labelRo || null }),
        ...(labelIt !== undefined && { labelIt: labelIt || null }),
        ...(labelDe !== undefined && { labelDe: labelDe || null }),
        ...(labelUs !== undefined && { labelUs: labelUs || null }),
      });
      
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error updating contract category:", error);
      res.status(500).json({ error: "Failed to update contract category" });
    }
  });

  app.delete("/api/contracts/categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteContractCategory(id);
      if (!deleted) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contract category:", error);
      res.status(500).json({ error: "Failed to delete contract category" });
    }
  });

  // Reorder contract categories
  app.post("/api/contracts/categories/reorder", requireAuth, async (req, res) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds must be an array" });
      }
      await storage.reorderContractCategories(orderedIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering contract categories:", error);
      res.status(500).json({ error: "Failed to reorder contract categories" });
    }
  });

  // Contract Category Default Templates
  app.get("/api/contracts/categories/:categoryId/default-templates", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const templates = await storage.getCategoryDefaultTemplates(categoryId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching category default templates:", error);
      res.status(500).json({ error: "Failed to fetch category default templates" });
    }
  });

  app.get("/api/contracts/categories/:categoryId/default-templates/:countryCode", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const template = await storage.getCategoryDefaultTemplate(categoryId, req.params.countryCode);
      if (!template) {
        return res.status(404).json({ error: "Default template not found" });
      }
      
      // Parse conversionMetadata to extract pageImages and other conversion data
      let pageImages: any[] = [];
      let embeddedImages: any[] = [];
      let conversionMethod: string | null = null;
      
      if (template.conversionMetadata) {
        try {
          const metadata = JSON.parse(template.conversionMetadata);
          pageImages = metadata.pageImages || [];
          embeddedImages = metadata.embeddedImages || [];
          conversionMethod = metadata.conversionMethod || null;
        } catch (parseErr) {
          console.warn("Failed to parse conversionMetadata:", parseErr);
        }
      }
      
      let extractedFields = template.extractedFields;
      if (typeof extractedFields === 'string') {
        try {
          extractedFields = JSON.parse(extractedFields);
        } catch (e) {
          extractedFields = [];
        }
      }
      
      if ((!extractedFields || (Array.isArray(extractedFields) && extractedFields.length === 0)) && template.htmlContent) {
        const htmlFields = extractHtmlPlaceholders(template.htmlContent);
        if (htmlFields.length > 0) {
          extractedFields = JSON.stringify(htmlFields.map(f => f.name));
        }
      }
      
      res.json({
        ...template,
        extractedFields,
        pageImages,
        embeddedImages,
        conversionMethod
      });
    } catch (error) {
      console.error("Error fetching category default template:", error);
      res.status(500).json({ error: "Failed to fetch category default template" });
    }
  });

  // Upload PDF form or DOCX template and extract fields/placeholders
  app.post("/api/contracts/categories/:categoryId/default-templates/upload", requireAuth, uploadContractPdf.single("file"), async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const { countryCode } = req.body;
      
      if (!countryCode) {
        return res.status(400).json({ error: "Country code is required" });
      }
      
      const validCountryCodes = ["SK", "CZ", "HU", "RO", "IT", "DE", "US"];
      const normalizedCountryCode = String(countryCode).toUpperCase().trim();
      if (!validCountryCodes.includes(normalizedCountryCode) || !/^[A-Z]{2}$/.test(normalizedCountryCode)) {
        return res.status(400).json({ error: "Invalid country code" });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: "File is required (PDF or DOCX)" });
      }

      const isPdf = req.file.mimetype === "application/pdf";
      const isDocx = req.file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      
      // Only accept DOCX files - PDF must be converted manually in MS Word
      if (isPdf) {
        return res.status(400).json({ 
          error: "Nahrajte DOCX súbor. Ak máte PDF, otvorte ho v MS Word a uložte ako DOCX.",
          suggestion: "Otvorte PDF v MS Word → Súbor → Uložiť ako → DOCX",
          requiresDocx: true
        });
      }
      
      if (!isDocx) {
        return res.status(400).json({ error: "Súbor musí byť vo formáte DOCX (Word dokument)" });
      }

      console.log(`[Template Upload] Processing DOCX file: ${req.file.path}`);
      
      let extractedFields: any[] = [];
      let conversionError: string | null = null;
      // Store relative path, not absolute
      const docxPath = req.file.path.replace(process.cwd() + "/", "");
      let previewPdfPath: string | null = null;
      const templateType = "docx";
      
      // Extract placeholders from DOCX
      try {
        extractedFields = await extractDocxPlaceholders(req.file.path);
        console.log(`[Template Upload] Extracted ${extractedFields.length} placeholders from DOCX`);
      } catch (extractError: any) {
        console.warn("[Template Upload] Placeholder extraction warning:", extractError.message);
        conversionError = extractError.message;
      }
      
      // Generate PDF preview from DOCX and store in permanent location
      try {
        console.log(`[Template Upload] Converting DOCX to PDF for preview...`);
        // Create permanent preview directory
        const previewDir = path.join(process.cwd(), "uploads", "contract-previews", `${categoryId}`, normalizedCountryCode);
        await fs.promises.mkdir(previewDir, { recursive: true });
        
        // Generate PDF in temp location first
        const tempPdfPath = await convertDocxToPdf(req.file.path, path.dirname(req.file.path));
        
        if (tempPdfPath && fs.existsSync(tempPdfPath)) {
          // Move to permanent location
          const permanentPdfPath = path.join(previewDir, `preview-${Date.now()}.pdf`);
          await fs.promises.copyFile(tempPdfPath, permanentPdfPath);
          // Clean up temp file
          try { await fs.promises.unlink(tempPdfPath); } catch (e) {}
          previewPdfPath = permanentPdfPath.replace(process.cwd() + "/", "");
          console.log(`[Template Upload] DOCX converted to PDF preview: ${previewPdfPath}`);
        }
      } catch (convErr: any) {
        console.warn(`[Template Upload] DOCX to PDF preview conversion failed: ${convErr.message}`);
      }

      const conversionMetadata = JSON.stringify({
        originalFilename: req.file.originalname,
        fileSize: req.file.size,
        extractedAt: new Date().toISOString(),
        fieldCount: extractedFields.length,
      });

      const existing = await storage.getCategoryDefaultTemplate(categoryId, normalizedCountryCode);
      
      const templateData: any = {
        templateType,
        extractedFields: JSON.stringify(extractedFields),
        conversionStatus: previewPdfPath ? "completed" : "pending",
        conversionError,
        conversionMetadata,
        sourceDocxPath: docxPath,
        originalDocxPath: docxPath,
        previewPdfPath: previewPdfPath,
        sourcePdfPath: null, // Not used in DOCX-only workflow
        htmlContent: null, // Legacy field - not used
        placeholderMappings: null,
      };

      let result;
      if (existing) {
        result = await storage.updateCategoryDefaultTemplate(existing.id, templateData);
      } else {
        result = await storage.createCategoryDefaultTemplate({
          categoryId,
          countryCode: normalizedCountryCode,
          ...templateData,
          createdBy: req.session.user!.id,
        });
      }
      
      res.json({
        ...result,
        extractedFields,
        templateType,
        crmDataFields: CRM_DATA_FIELDS,
      });
    } catch (error) {
      console.error("Error uploading template:", error);
      res.status(500).json({ error: "Failed to upload template" });
    }
  });
  
  // Get available CRM data fields for mapping
  app.get("/api/contracts/crm-fields", requireAuth, async (req, res) => {
    res.json(CRM_DATA_FIELDS);
  });
  
  // AI-powered field mapping (legacy - maps existing placeholders)
  app.post("/api/contracts/ai-mapping", requireAuth, async (req, res) => {
    try {
      const { extractedFields, availableFields } = req.body;
      
      if (!extractedFields || !Array.isArray(extractedFields) || extractedFields.length === 0) {
        return res.status(400).json({ error: "extractedFields is required" });
      }
      
      const fieldNames = extractedFields.map((f: any) => typeof f === 'string' ? f : f.name);
      const availableFieldNames = availableFields ? Object.keys(availableFields) : Object.keys(CRM_DATA_FIELDS);
      
      const prompt = `Mapuj premenné zo šablóny zmluvy na dostupné CRM polia.

Premenné zo šablóny ({{placeholder}}):
${fieldNames.join(", ")}

Dostupné CRM polia:
${availableFieldNames.map(f => `${f}: ${CRM_DATA_FIELDS[f] || "popis nedostupný"}`).join("\n")}

Pre každú premennú zo šablóny urči najlepšie zodpovedajúce CRM pole. Ak nie je zhoda, vynechaj.

Odpovedz v JSON formáte:
{
  "mappings": {
    "meno": "firstName",
    "priezvisko": "lastName",
    ...
  }
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Si asistent pre mapovanie polí v CRM systéme. Odpovedaj len v JSON formáte." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      });
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }
      
      const result = JSON.parse(content);
      res.json(result);
    } catch (error) {
      console.error("AI mapping error:", error);
      res.status(500).json({ error: "AI mapping failed" });
    }
  });
  
  // AI contract recommendation - provides legal and business recommendations for contract creation
  app.post("/api/ai/contract-recommendation", requireAuth, async (req, res) => {
    try {
      const { categoryName, customerName, customerCountry, billingCompany, currency } = req.body;
      
      const prompt = `Si právny asistent pre CRM systém krvnej banky. Analyzuj nasledujúcu zmluvu a poskytni stručné odporúčania.

Typ zmluvy: ${categoryName || "Neurčený"}
Zákazník: ${customerName || "Neuvedený"}
Krajina zákazníka: ${customerCountry || "Neuvedená"}
Fakturačná spoločnosť: ${billingCompany || "Neuvedená"}
Mena: ${currency || "EUR"}

Poskytni stručné (max 150 slov) odporúčanie ohľadom:
1. Právnych aspektov zmluvy pre danú krajinu
2. GDPR a ochrany osobných údajov
3. Prípadných rizík

Odpovedz v slovenčine, profesionálne a stručne.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Si právny asistent pre oblasť biobankovníctva a uchovávania kmeňových buniek. Poskytuj stručné, praktické rady." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      });
      
      const recommendation = response.choices[0]?.message?.content;
      if (!recommendation) {
        throw new Error("No response from AI");
      }
      
      res.json({ recommendation });
    } catch (error) {
      console.error("AI contract recommendation error:", error);
      res.status(500).json({ error: "Nepodarilo sa získať AI odporúčanie" });
    }
  });
  
  // AI-powered placeholder insertion - analyzes DOCX and inserts {{placeholders}} into the document
  app.post("/api/contracts/ai-insert-placeholders", requireAuth, async (req, res) => {
    try {
      const { categoryId, countryCode } = req.body;
      
      if (!categoryId || !countryCode) {
        return res.status(400).json({ error: "categoryId and countryCode are required" });
      }
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode.toUpperCase());
      if (!template || !template.sourceDocxPath) {
        return res.status(404).json({ error: "DOCX template not found" });
      }
      
      const docxPath = path.join(process.cwd(), template.sourceDocxPath);
      if (!fs.existsSync(docxPath)) {
        return res.status(404).json({ error: "DOCX file not found on disk" });
      }
      
      const { 
        extractDocxFullText, 
        insertPlaceholdersIntoDocx, 
        convertDocxToPdf, 
        detectFillFieldReplacements,
        extractDocxStructuredContent,
        SAMPLE_DATA
      } = await import("./template-processor");
      
      const structuredContent = await extractDocxStructuredContent(docxPath);
      const fullText = structuredContent.text;
      
      console.log(`[AI] Document extracted: ${fullText.length} chars, ${structuredContent.sections.length} sections`);
      
      if (fullText.length < 50) {
        return res.status(400).json({ error: "Document is too short for analysis" });
      }
      
      // Import section detection for context-aware mapping (NO AI - pure deterministic)
      const { detectDocumentSections, getEntityForLine } = await import("./template-processor");
      
      // Get fill-field detection for pattern-based matches
      const fillFieldReplacements = detectFillFieldReplacements(fullText);
      console.log(`[Deterministický] Detekcia našla ${fillFieldReplacements.length} markerov`);
      
      // Detect document sections for context
      const detectedSections = detectDocumentSections(fullText);
      console.log(`[Sekcie] Detekovaných ${detectedSections.length} sekcií:`);
      for (const s of detectedSections) {
        console.log(`  - ${s.entity.toUpperCase()}: riadky ${s.startLine + 1}-${s.endLine + 1} ("${s.headingText.substring(0, 40)}...")`);
      }
      
      // ============================================================================
      // DETERMINISTICKÉ MAPOVANIE - BEZ AI, ČISTO NA ZÁKLADE PRAVIDIEL
      // ============================================================================
      
      // Polia, ktoré sa menia podľa sekcie (entity-dependent)
      const ENTITY_DEPENDENT_FIELDS = [
        'fullName', 'firstName', 'lastName', 'maidenName',
        'birthDate', 'personalId', 'idCardNumber',
        'permanentAddress', 'correspondenceAddress',
        'phone', 'email', 'IBAN', 'birthPlace'
      ];
      
      // Mapovanie label → field type (SK, CZ, HU, RO, IT, DE, EN)
      const LABEL_TO_FIELD_TYPE: Record<string, string> = {
        // === MENO / NAME ===
        // SK
        'pani': 'fullName', 'pán': 'fullName', 'meno': 'fullName',
        'meno a priezvisko': 'fullName', 'priezvisko': 'lastName',
        'krstné meno': 'firstName', 'rodné meno': 'maidenName', 'rodné priezvisko': 'maidenName',
        // CZ
        'jméno': 'fullName', 'jméno a příjmení': 'fullName', 'příjmení': 'lastName',
        'křestní jméno': 'firstName', 'rodné jméno': 'maidenName',
        // HU
        'név': 'fullName', 'teljes név': 'fullName', 'családi név': 'lastName',
        'keresztnév': 'firstName', 'születési név': 'maidenName',
        // RO
        'nume': 'fullName', 'nume și prenume': 'fullName', 'prenume': 'firstName',
        'nume de familie': 'lastName', 'nume de naștere': 'maidenName',
        // IT
        'nome': 'fullName', 'nome e cognome': 'fullName', 'cognome': 'lastName',
        'nome di battesimo': 'firstName', 'nome da nubile': 'maidenName',
        // DE
        'name': 'fullName', 'vor- und nachname': 'fullName', 'nachname': 'lastName',
        'vorname': 'firstName', 'geburtsname': 'maidenName',
        // EN
        'full name': 'fullName', 'surname': 'lastName', 'last name': 'lastName',
        'first name': 'firstName', 'maiden name': 'maidenName',
        
        // === DÁTUM NARODENIA / BIRTH DATE ===
        // SK
        'dátum narodenia': 'birthDate', 'narodená': 'birthDate', 'narodený': 'birthDate',
        'nar': 'birthDate', 'nar.': 'birthDate',
        // CZ
        'datum narození': 'birthDate', 'narozena': 'birthDate', 'narozen': 'birthDate',
        // HU
        'születési dátum': 'birthDate', 'született': 'birthDate',
        // RO
        'data nașterii': 'birthDate', 'născut': 'birthDate', 'născută': 'birthDate',
        // IT
        'data di nascita': 'birthDate', 'nato il': 'birthDate', 'nata il': 'birthDate',
        // DE
        'geburtsdatum': 'birthDate', 'geboren am': 'birthDate',
        // EN
        'date of birth': 'birthDate', 'dob': 'birthDate', 'born on': 'birthDate',
        
        // === RODNÉ ČÍSLO / PERSONAL ID ===
        // SK
        'rodné číslo': 'personalId', 'rč': 'personalId', 'r.č': 'personalId', 'r.č.': 'personalId',
        // CZ
        'rodné číslo': 'personalId',
        // HU
        'személyi szám': 'personalId', 'személyazonosító': 'personalId',
        // RO
        'cnp': 'personalId', 'cod numeric personal': 'personalId',
        // IT
        'codice fiscale': 'personalId', 'cf': 'personalId',
        // DE
        'personenkennzeichen': 'personalId', 'steuer-id': 'personalId',
        // EN
        'personal id': 'personalId', 'national id': 'personalId', 'ssn': 'personalId',
        
        // === ADRESA / ADDRESS ===
        // SK
        'trvalé bydlisko': 'permanentAddress', 'trvale bytom': 'permanentAddress',
        'trvalý pobyt': 'permanentAddress', 'bytom': 'permanentAddress',
        'adresa': 'permanentAddress', 's trvalým pobytom': 'permanentAddress', 'bydlisko': 'permanentAddress',
        'korešpondenčná adresa': 'correspondenceAddress', 'doručovacia adresa': 'correspondenceAddress',
        // CZ
        'trvalé bydliště': 'permanentAddress', 'trvale bytem': 'permanentAddress',
        'trvalý pobyt': 'permanentAddress', 'bytem': 'permanentAddress', 'korespondenční adresa': 'correspondenceAddress',
        // HU
        'állandó lakcím': 'permanentAddress', 'lakcím': 'permanentAddress',
        'levelezési cím': 'correspondenceAddress',
        // RO
        'adresă': 'permanentAddress', 'domiciliu': 'permanentAddress',
        'adresă de corespondență': 'correspondenceAddress',
        // IT
        'indirizzo': 'permanentAddress', 'residenza': 'permanentAddress',
        'indirizzo di corrispondenza': 'correspondenceAddress',
        // DE
        'adresse': 'permanentAddress', 'wohnort': 'permanentAddress', 'wohnsitz': 'permanentAddress',
        'postanschrift': 'correspondenceAddress',
        // EN
        'address': 'permanentAddress', 'permanent address': 'permanentAddress',
        'mailing address': 'correspondenceAddress', 'correspondence address': 'correspondenceAddress',
        
        // === KONTAKT / CONTACT ===
        // SK/CZ
        'telefón': 'phone', 'tel': 'phone', 'tel.': 'phone', 'mobil': 'phone',
        'email': 'email', 'e-mail': 'email',
        // HU
        'telefonszám': 'phone', 'telefon': 'phone',
        // RO
        'telefon': 'phone', 'nr. telefon': 'phone',
        // IT
        'telefono': 'phone', 'cellulare': 'phone',
        // DE
        'telefon': 'phone', 'handy': 'phone', 'mobilnummer': 'phone',
        // EN
        'phone': 'phone', 'mobile': 'phone', 'phone number': 'phone',
        
        // === BANKOVÉ ÚDAJE / BANK ===
        'iban': 'IBAN', 'číslo účtu': 'IBAN', 'bankový účet': 'IBAN',
        'číslo účtu': 'IBAN', 'bankovní účet': 'IBAN', // CZ
        'bankszámlaszám': 'IBAN', 'számlaszám': 'IBAN', // HU
        'cont bancar': 'IBAN', 'cont iban': 'IBAN', // RO
        'conto bancario': 'IBAN', 'conto corrente': 'IBAN', // IT
        'kontonummer': 'IBAN', 'bankverbindung': 'IBAN', // DE
        'bank account': 'IBAN', 'account number': 'IBAN', // EN
        
        // === OBČIANSKY PREUKAZ / ID CARD ===
        // SK
        'číslo op': 'idCardNumber', 'číslo občianskeho preukazu': 'idCardNumber', 'číslo dokladu': 'idCardNumber',
        // CZ
        'číslo op': 'idCardNumber', 'číslo občanského průkazu': 'idCardNumber',
        // HU
        'személyi igazolvány szám': 'idCardNumber', 'ig. szám': 'idCardNumber',
        // RO
        'seria și numărul ci': 'idCardNumber', 'buletin': 'idCardNumber',
        // IT
        'carta d\'identità': 'idCardNumber', 'numero documento': 'idCardNumber',
        // DE
        'personalausweis-nr': 'idCardNumber', 'ausweisnummer': 'idCardNumber',
        // EN
        'id card number': 'idCardNumber', 'document number': 'idCardNumber',
        
        // === MIESTO NARODENIA / BIRTH PLACE ===
        'miesto narodenia': 'birthPlace', 'místo narození': 'birthPlace', // SK/CZ
        'születési hely': 'birthPlace', // HU
        'locul nașterii': 'birthPlace', // RO
        'luogo di nascita': 'birthPlace', // IT
        'geburtsort': 'birthPlace', // DE
        'place of birth': 'birthPlace', // EN
      };
      
      // Špeciálne polia (nie entity-dependent) - multilingual
      const SPECIAL_LABELS: Record<string, string> = {
        // === ZMLUVA / CONTRACT ===
        // SK
        'číslo zmluvy': 'contract.number', 'zmluva č': 'contract.number', 'zmluva č.': 'contract.number',
        'dátum zmluvy': 'contract.date', 'dátum uzavretia': 'contract.date', 'dňa': 'contract.date',
        'miesto uzavretia': 'contract.signaturePlace', 'miesto podpisu': 'contract.signaturePlace',
        'celková suma': 'contract.totalAmount', 'suma': 'contract.totalAmount',
        // CZ
        'číslo smlouvy': 'contract.number', 'smlouva č': 'contract.number', 'smlouva č.': 'contract.number',
        'datum smlouvy': 'contract.date', 'datum uzavření': 'contract.date',
        'místo podpisu': 'contract.signaturePlace',
        // HU
        'szerződésszám': 'contract.number', 'szerződés száma': 'contract.number',
        'szerződés dátuma': 'contract.date', 'aláírás helye': 'contract.signaturePlace',
        // RO
        'număr contract': 'contract.number', 'contract nr': 'contract.number',
        'data contractului': 'contract.date', 'locul semnării': 'contract.signaturePlace',
        // IT
        'numero contratto': 'contract.number', 'contratto n': 'contract.number',
        'data contratto': 'contract.date', 'luogo di firma': 'contract.signaturePlace',
        // DE
        'vertragsnummer': 'contract.number', 'vertrag nr': 'contract.number',
        'vertragsdatum': 'contract.date', 'unterschriftsort': 'contract.signaturePlace',
        // EN
        'contract number': 'contract.number', 'contract no': 'contract.number',
        'contract date': 'contract.date', 'signature place': 'contract.signaturePlace',
        
        // === SPOLOČNOSŤ / COMPANY ===
        // SK
        'ičo': 'company.identificationNumber', 'identifikačné číslo': 'company.identificationNumber',
        'dič': 'company.taxIdentificationNumber', 'ič dph': 'company.vatNumber',
        'názov spoločnosti': 'company.name', 'obchodné meno': 'company.name',
        'sídlo': 'company.address', 'sídlo spoločnosti': 'company.address',
        'konateľ': 'company.representativeName', 'zástupca': 'company.representativeName',
        'register': 'company.registrationNumber', 'obchodný register': 'company.registrationNumber',
        // CZ
        'ič': 'company.identificationNumber', 'identifikační číslo': 'company.identificationNumber',
        'dič': 'company.taxIdentificationNumber', 'název společnosti': 'company.name',
        'jednatel': 'company.representativeName',
        // HU
        'cégjegyzékszám': 'company.identificationNumber', 'adószám': 'company.taxIdentificationNumber',
        'cégnév': 'company.name', 'székhely': 'company.address', 'képviselő': 'company.representativeName',
        // RO
        'cui': 'company.identificationNumber', 'cif': 'company.taxIdentificationNumber',
        'denumire societate': 'company.name', 'sediu': 'company.address',
        'reprezentant': 'company.representativeName',
        // IT
        'p.iva': 'company.taxIdentificationNumber', 'partita iva': 'company.taxIdentificationNumber',
        'ragione sociale': 'company.name', 'sede legale': 'company.address',
        'rappresentante': 'company.representativeName',
        // DE
        'handelsregisternummer': 'company.identificationNumber', 'steuernummer': 'company.taxIdentificationNumber',
        'firmenname': 'company.name', 'geschäftssitz': 'company.address',
        'geschäftsführer': 'company.representativeName',
        // EN
        'company id': 'company.identificationNumber', 'tax id': 'company.taxIdentificationNumber',
        'vat number': 'company.vatNumber', 'company name': 'company.name',
        'registered office': 'company.address', 'representative': 'company.representativeName',
      };
      
      // Spracuj pattern-detected polia s kontextom sekcie
      const finalReplacements: Array<{
        original: string;
        placeholder: string;
        label: string;
        reason: string;
        crmField: string;
        confidence: number;
        sectionEntity?: string;
        lineIndex?: number;
      }> = [];
      
      for (const field of fillFieldReplacements) {
        const normalizedLabel = field.label.toLowerCase().replace(/[:\-–\s]+$/, "").trim();
        
        // Skús nájsť sekciu pre tento riadok
        const sectionEntity = getEntityForLine(detectedSections, field.lineIndex);
        
        // Určí placeholder
        let placeholder = field.placeholder;
        let confidence = 0.9;
        let reason = "";
        
        // Najprv skontroluj špeciálne polia (nie entity-dependent)
        if (SPECIAL_LABELS[normalizedLabel]) {
          placeholder = SPECIAL_LABELS[normalizedLabel];
          reason = `Špeciálne pole: "${field.label}"`;
          console.log(`[Rule] "${field.label}" → ${placeholder} (špeciálne pole)`);
        }
        // Potom skontroluj entity-dependent polia podľa labelu
        else if (LABEL_TO_FIELD_TYPE[normalizedLabel]) {
          const fieldType = LABEL_TO_FIELD_TYPE[normalizedLabel];
          
          if (sectionEntity && ENTITY_DEPENDENT_FIELDS.includes(fieldType)) {
            // Máme sekciu - použijeme entitu sekcie
            placeholder = `${sectionEntity}.${fieldType}`;
            reason = `Sekcia ${sectionEntity}: "${field.label}"`;
            console.log(`[Rule] "${field.label}" (line ${field.lineIndex + 1}) → ${placeholder} (sekcia: ${sectionEntity})`);
          } else {
            // Nemáme sekciu - defaultne customer
            placeholder = `customer.${fieldType}`;
            reason = `Predvolený zákazník: "${field.label}"`;
            console.log(`[Rule] "${field.label}" (line ${field.lineIndex + 1}) → ${placeholder} (bez sekcie, default customer)`);
          }
        }
        // Skúsme extrahovať field type z pôvodného placeholdera (customer.permanentAddress → permanentAddress)
        else if (field.placeholder && field.placeholder.includes('.')) {
          const parts = field.placeholder.split('.');
          const detectedEntity = parts[0];
          const fieldType = parts.slice(1).join('.');
          
          // Ak máme sekciu a ide o entity-dependent pole, prepíšeme entitu
          if (sectionEntity && ENTITY_DEPENDENT_FIELDS.includes(fieldType)) {
            placeholder = `${sectionEntity}.${fieldType}`;
            reason = `Sekcia ${sectionEntity}: "${field.label}" (prepísané z ${detectedEntity})`;
            console.log(`[Rule] "${field.label}" (line ${field.lineIndex + 1}) → ${placeholder} (prepísané z ${field.placeholder})`);
          } else if (sectionEntity) {
            // Máme sekciu ale pole nie je v ENTITY_DEPENDENT_FIELDS - skúsme ho aj tak prepísať
            placeholder = `${sectionEntity}.${fieldType}`;
            reason = `Sekcia ${sectionEntity}: "${field.label}"`;
            console.log(`[Rule] "${field.label}" (line ${field.lineIndex + 1}) → ${placeholder} (sekcia: ${sectionEntity})`);
          } else {
            reason = `Vzorová detekcia: "${field.label}"`;
            console.log(`[Rule] "${field.label}" (line ${field.lineIndex + 1}) → ${placeholder} (pôvodný, bez sekcie)`);
          }
        }
        // Ak nemáme presné mapovanie a placeholder nemá bodku
        else {
          reason = `Vzorová detekcia: "${field.label}"`;
          console.log(`[Rule] "${field.label}" (line ${field.lineIndex + 1}) → ${placeholder} (pôvodný)`);
        }
        
        finalReplacements.push({
          original: field.original,
          placeholder: placeholder,
          label: field.label,
          reason: reason,
          crmField: placeholder,
          confidence: confidence,
          sectionEntity: sectionEntity || undefined,
          lineIndex: field.lineIndex
        });
      }
      
      console.log(`[Deterministický] Výsledok: ${finalReplacements.length} náhrad`);
      
      if (finalReplacements.length === 0) {
        return res.json({
          success: true,
          message: "Neboli nájdené žiadne polia na vyplnenie",
          replacements: [],
          modifiedDocxPath: null,
          suggestedMappings: {}
        });
      }
      
      const outputFilename = `template-ai-${Date.now()}.docx`;
      const outputPath = path.join(process.cwd(), "uploads/contract-pdfs", outputFilename);
      
      await insertPlaceholdersIntoDocx(docxPath, finalReplacements, outputPath);
      
      const previewDir = path.join(process.cwd(), `uploads/contract-previews/${categoryId}/${countryCode.toUpperCase()}`);
      if (!fs.existsSync(previewDir)) {
        fs.mkdirSync(previewDir, { recursive: true });
      }
      
      let previewPdfPath: string | null = null;
      try {
        previewPdfPath = await convertDocxToPdf(outputPath, previewDir);
      } catch (pdfError) {
        console.warn("[Fill-Field] PDF preview generation failed:", pdfError);
      }
      
      const relativeDocxPath = `uploads/contract-pdfs/${outputFilename}`;
      const relativePreviewPath = previewPdfPath 
        ? `uploads/contract-previews/${categoryId}/${countryCode.toUpperCase()}/${path.basename(previewPdfPath)}`
        : null;
      
      const suggestedMappings: Record<string, string> = {};
      for (const r of finalReplacements) {
        suggestedMappings[`{{${r.placeholder}}}`] = r.crmField;
      }
      
      // Počítaj sekciové vs. predvolené mapovanie
      const sectionMappedCount = finalReplacements.filter(r => r.sectionEntity).length;
      const defaultMappedCount = finalReplacements.length - sectionMappedCount;
      
      await storage.updateCategoryDefaultTemplate(template.id, {
        sourceDocxPath: relativeDocxPath,
        previewPdfPath: previewPdfPath ? relativePreviewPath : template.previewPdfPath,
        extractedFields: JSON.stringify(finalReplacements.map(r => r.placeholder)),
        placeholderMappings: JSON.stringify(suggestedMappings),
        conversionMetadata: JSON.stringify({
          processedAt: new Date().toISOString(),
          replacementsCount: finalReplacements.length,
          sectionMapped: sectionMappedCount,
          defaultMapped: defaultMappedCount,
          summary: `Nájdených ${finalReplacements.length} polí (${sectionMappedCount} podľa sekcie)`
        })
      });
      
      res.json({
        success: true,
        message: `Nájdených ${finalReplacements.length} polí (${sectionMappedCount} podľa sekcie, ${defaultMappedCount} predvolené)`,
        replacements: finalReplacements,
        suggestedMappings,
        modifiedDocxPath: relativeDocxPath,
        previewPdfPath: relativePreviewPath,
        extractedFields: finalReplacements.map(r => r.placeholder),
        sampleData: SAMPLE_DATA
      });
    } catch (error) {
      console.error("Placeholder insertion error:", error);
      res.status(500).json({ error: "Vkladanie placeholderov zlyhalo: " + (error as Error).message });
    }
  });
  
  // Reset template to original state (before modifications)
  app.post("/api/contracts/categories/:categoryId/default-templates/:countryCode/reset", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      if (!template.originalDocxPath) {
        return res.status(400).json({ error: "Pôvodný súbor nie je k dispozícii. Nahrajte šablónu znova." });
      }
      
      const originalFullPath = path.join(process.cwd(), template.originalDocxPath);
      if (!fs.existsSync(originalFullPath)) {
        return res.status(400).json({ error: "Pôvodný súbor neexistuje. Nahrajte šablónu znova." });
      }
      
      // Copy original back to source path (create new timestamped file)
      const resetDir = path.join(process.cwd(), "uploads", "contract-templates", `${categoryId}`, countryCode);
      await fs.promises.mkdir(resetDir, { recursive: true });
      const resetDocxPath = path.join(resetDir, `reset-${Date.now()}.docx`);
      await fs.promises.copyFile(originalFullPath, resetDocxPath);
      const relativeResetPath = resetDocxPath.replace(process.cwd() + "/", "");
      
      // Re-extract placeholders from original (should be empty or minimal)
      let extractedFields: any[] = [];
      try {
        extractedFields = await extractDocxPlaceholders(originalFullPath);
      } catch (e) {
        extractedFields = [];
      }
      
      // Regenerate PDF preview from original
      let previewPdfPath: string | null = null;
      try {
        const previewDir = path.join(process.cwd(), "uploads", "contract-previews", `${categoryId}`, countryCode);
        await fs.promises.mkdir(previewDir, { recursive: true });
        const tempPdfPath = await convertDocxToPdf(originalFullPath, path.dirname(originalFullPath));
        if (tempPdfPath && fs.existsSync(tempPdfPath)) {
          const permanentPdfPath = path.join(previewDir, `preview-reset-${Date.now()}.pdf`);
          await fs.promises.copyFile(tempPdfPath, permanentPdfPath);
          try { await fs.promises.unlink(tempPdfPath); } catch (e) {}
          previewPdfPath = permanentPdfPath.replace(process.cwd() + "/", "");
        }
      } catch (e) {
        console.warn("Reset preview generation failed:", e);
      }
      
      // Update template - clear AI modifications
      await storage.updateCategoryDefaultTemplate(template.id, {
        sourceDocxPath: relativeResetPath,
        previewPdfPath: previewPdfPath || template.previewPdfPath,
        extractedFields: JSON.stringify(extractedFields),
        placeholderMappings: null,
        conversionMetadata: JSON.stringify({
          resetAt: new Date().toISOString(),
          resetFrom: template.sourceDocxPath,
          originalFile: template.originalDocxPath
        })
      });
      
      res.json({
        success: true,
        message: "Šablóna bola resetovaná na pôvodný stav",
        sourceDocxPath: relativeResetPath,
        previewPdfPath,
        extractedFields
      });
    } catch (error) {
      console.error("Template reset error:", error);
      res.status(500).json({ error: "Reset failed: " + (error as Error).message });
    }
  });
  
  // Delete category default template
  app.delete("/api/contracts/categories/:categoryId/default-templates/:countryCode", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Delete associated files
      const filesToDelete = [
        template.sourceDocxPath,
        template.originalDocxPath,
        template.previewPdfPath,
        template.sourcePdfPath
      ].filter(Boolean);
      
      for (const filePath of filesToDelete) {
        try {
          const fullPath = path.join(process.cwd(), filePath as string);
          if (fs.existsSync(fullPath)) {
            await fs.promises.unlink(fullPath);
          }
        } catch (e) {
          console.warn(`Failed to delete file: ${filePath}`, e);
        }
      }
      
      // Delete template record
      await storage.deleteCategoryDefaultTemplate(template.id);
      
      res.json({ success: true, message: "Šablóna bola vymazaná" });
    } catch (error) {
      console.error("Template delete error:", error);
      res.status(500).json({ error: "Delete failed: " + (error as Error).message });
    }
  });
  
  // Download template file (DOCX or PDF)
  app.get("/api/contracts/template-file/:filePath(*)", requireAuth, async (req, res) => {
    try {
      let filePath = decodeURIComponent(req.params.filePath);
      
      // Handle both absolute paths (legacy) and relative paths
      if (filePath.startsWith("/home/runner/workspace/")) {
        filePath = filePath.replace("/home/runner/workspace/", "");
      }
      if (filePath.startsWith(process.cwd() + "/")) {
        filePath = filePath.replace(process.cwd() + "/", "");
      }
      
      if (!filePath.startsWith("uploads/") || filePath.includes("..")) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const fullPath = path.join(process.cwd(), filePath);
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "File not found" });
      }
      
      const ext = path.extname(fullPath).toLowerCase();
      const filename = path.basename(fullPath);
      
      let contentType = "application/octet-stream";
      if (ext === ".docx") {
        contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else if (ext === ".pdf") {
        contentType = "application/pdf";
      }
      
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      
      const fileStream = fs.createReadStream(fullPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error serving template file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });
  
  // Download DOCX template by category and country
  app.get("/api/contracts/categories/:categoryId/templates/:countryCode/download", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      
      if (!template || !template.sourceDocxPath) {
        return res.status(404).json({ error: "DOCX template not found" });
      }
      
      // Handle both absolute and relative paths
      let docxPath = template.sourceDocxPath;
      if (docxPath.startsWith("/home/runner/workspace/")) {
        docxPath = docxPath.replace("/home/runner/workspace/", "");
      }
      if (docxPath.startsWith(process.cwd() + "/")) {
        docxPath = docxPath.replace(process.cwd() + "/", "");
      }
      
      const fullPath = path.join(process.cwd(), docxPath);
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "DOCX file not found" });
      }
      
      const filename = `template-${countryCode}.docx`;
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      
      const fileStream = fs.createReadStream(fullPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading DOCX template:", error);
      res.status(500).json({ error: "Failed to download template" });
    }
  });
  
  // Preview template as PDF (serves the generated PDF preview from DOCX)
  app.get("/api/contracts/categories/:categoryId/templates/:countryCode/preview", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Try previewPdfPath first (generated from DOCX), then fall back to sourcePdfPath
      const pdfPath = template.previewPdfPath || template.sourcePdfPath;
      
      if (!pdfPath) {
        return res.status(404).json({ error: "PDF preview not available. Please re-upload the DOCX template." });
      }
      
      const fullPath = path.join(process.cwd(), pdfPath);
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "PDF preview file not found" });
      }
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="preview-${countryCode}.pdf"`);
      
      const fileStream = fs.createReadStream(fullPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error serving template preview:", error);
      res.status(500).json({ error: "Failed to serve preview" });
    }
  });
  
  // Preview template as PDF - alternate route (for new template creation flow)
  app.get("/api/contracts/categories/:categoryId/default-templates/:countryCode/preview", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      const pdfPath = template.previewPdfPath || template.sourcePdfPath;
      
      if (!pdfPath) {
        return res.status(404).json({ error: "PDF preview not available" });
      }
      
      const fullPath = path.join(process.cwd(), pdfPath);
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "PDF preview file not found" });
      }
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="preview-${countryCode}.pdf"`);
      
      const fileStream = fs.createReadStream(fullPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error serving template preview:", error);
      res.status(500).json({ error: "Failed to serve preview" });
    }
  });
  
  // Get DOCX text content for preview (with placeholders visible or replaced with sample data)
  app.get("/api/contracts/categories/:categoryId/default-templates/:countryCode/docx-preview", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      const withSampleData = req.query.withSampleData === "true";
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      if (!template.sourceDocxPath) {
        return res.status(404).json({ error: "DOCX template not found" });
      }
      
      const fullPath = path.join(process.cwd(), template.sourceDocxPath);
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "DOCX file not found" });
      }
      
      const { extractDocxStructuredContent, SAMPLE_DATA } = await import("./template-processor");
      const structuredContent = await extractDocxStructuredContent(fullPath);
      let text = structuredContent.text;
      
      let extractedFields: string[] = [];
      if (template.extractedFields) {
        try {
          extractedFields = typeof template.extractedFields === 'string' 
            ? JSON.parse(template.extractedFields) 
            : template.extractedFields;
        } catch {}
      }
      
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const foundPlaceholders: string[] = [];
      let match;
      while ((match = placeholderRegex.exec(text)) !== null) {
        if (!foundPlaceholders.includes(match[1])) {
          foundPlaceholders.push(match[1]);
        }
      }
      
      if (withSampleData) {
        for (const placeholder of foundPlaceholders) {
          const regex = new RegExp(`\\{\\{${placeholder.replace(/\./g, '\\.')}\\}\\}`, 'g');
          const value = SAMPLE_DATA[placeholder] || `[${placeholder}]`;
          text = text.replace(regex, `«${value}»`);
        }
      }
      
      const htmlContent = text
        .split('\n')
        .map(line => {
          let htmlLine = line
            .replace(/\{\{([^}]+)\}\}/g, '<span class="placeholder">{{$1}}</span>')
            .replace(/«([^»]+)»/g, '<span class="sample-value">$1</span>');
          return `<p>${htmlLine || '&nbsp;'}</p>`;
        })
        .join('');
      
      res.json({
        text,
        htmlContent,
        extractedFields: foundPlaceholders.length > 0 ? foundPlaceholders : extractedFields,
        sections: structuredContent.sections,
        placeholderMappings: template.placeholderMappings 
          ? (typeof template.placeholderMappings === 'string' ? JSON.parse(template.placeholderMappings) : template.placeholderMappings)
          : {},
        sampleData: SAMPLE_DATA
      });
    } catch (error) {
      console.error("Error serving DOCX preview:", error);
      res.status(500).json({ error: "Failed to get DOCX preview" });
    }
  });
  
  // Get raw text content from DOCX for editing
  app.get("/api/contracts/categories/:categoryId/default-templates/:countryCode/text", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      
      if (!template || !template.sourceDocxPath) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      const fullPath = path.join(process.cwd(), template.sourceDocxPath);
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "DOCX file not found" });
      }
      
      // Extract text using mammoth
      const result = await mammoth.extractRawText({ path: fullPath });
      
      // Find placeholders
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const foundPlaceholders: string[] = [];
      let match;
      while ((match = placeholderRegex.exec(result.value)) !== null) {
        if (!foundPlaceholders.includes(match[1])) {
          foundPlaceholders.push(match[1]);
        }
      }
      
      res.json({
        text: result.value,
        extractedFields: foundPlaceholders
      });
    } catch (error) {
      console.error("Error extracting DOCX text:", error);
      res.status(500).json({ error: "Failed to extract text" });
    }
  });
  
  // Update DOCX with modified text (save back to file)
  app.post("/api/contracts/categories/:categoryId/default-templates/:countryCode/update-text", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      
      if (!template || !template.sourceDocxPath) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      const fullPath = path.join(process.cwd(), template.sourceDocxPath);
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "DOCX file not found" });
      }
      
      // Read original DOCX
      const PizZip = (await import("pizzip")).default;
      const content = fs.readFileSync(fullPath);
      const zip = new PizZip(content);
      
      // Get document.xml
      const docXml = zip.files["word/document.xml"].asText();
      
      // Create simple replacement - find text between <w:t> tags and replace
      // This is a simple approach - replaces the body content with the new text
      // Split text into paragraphs
      const paragraphs = text.split('\n');
      
      // Build new document XML with paragraphs
      let newBodyContent = '';
      for (const para of paragraphs) {
        if (para.trim()) {
          newBodyContent += `<w:p><w:r><w:t>${para.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t></w:r></w:p>`;
        } else {
          newBodyContent += '<w:p><w:r><w:t></w:t></w:r></w:p>';
        }
      }
      
      // Replace body content
      const bodyStartMatch = docXml.match(/<w:body[^>]*>/);
      const bodyEndMatch = docXml.match(/<\/w:body>/);
      
      if (bodyStartMatch && bodyEndMatch) {
        const bodyStart = docXml.indexOf(bodyStartMatch[0]) + bodyStartMatch[0].length;
        const bodyEnd = docXml.indexOf(bodyEndMatch[0]);
        const newDocXml = docXml.substring(0, bodyStart) + newBodyContent + docXml.substring(bodyEnd);
        
        // Save back to zip
        zip.file("word/document.xml", newDocXml);
        
        // Write to file
        const outputBuffer = zip.generate({ type: "nodebuffer" });
        fs.writeFileSync(fullPath, outputBuffer);
        
        // Find placeholders in new text
        const placeholderRegex = /\{\{([^}]+)\}\}/g;
        const foundPlaceholders: string[] = [];
        let match;
        while ((match = placeholderRegex.exec(text)) !== null) {
          if (!foundPlaceholders.includes(match[1])) {
            foundPlaceholders.push(match[1]);
          }
        }
        
        res.json({
          success: true,
          extractedFields: foundPlaceholders,
          sourceDocxPath: template.sourceDocxPath
        });
      } else {
        res.status(500).json({ error: "Could not parse DOCX structure" });
      }
    } catch (error) {
      console.error("Error updating DOCX text:", error);
      res.status(500).json({ error: "Failed to update text" });
    }
  });
  
  // Update DOCX from HTML content (converts HTML to DOCX format)
  app.post("/api/contracts/categories/:categoryId/default-templates/:countryCode/update-html", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      const { html } = req.body;
      
      if (!html) {
        return res.status(400).json({ error: "HTML is required" });
      }
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      
      if (!template || !template.sourceDocxPath) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      const fullPath = path.join(process.cwd(), template.sourceDocxPath);
      
      // Use html-to-docx library for proper conversion
      const htmlToDocx = (await import("html-to-docx")).default;
      
      // Wrap HTML in proper document structure
      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; }
            p { margin: 0.5em 0; }
            h1 { font-size: 18pt; font-weight: bold; }
            h2 { font-size: 16pt; font-weight: bold; }
            h3 { font-size: 14pt; font-weight: bold; }
          </style>
        </head>
        <body>${html}</body>
        </html>
      `;
      
      // Convert HTML to DOCX buffer
      const docxBuffer = await htmlToDocx(fullHtml, null, {
        table: { row: { cantSplit: true } },
        footer: false,
        pageNumber: false
      });
      
      // Write the DOCX file
      fs.writeFileSync(fullPath, Buffer.from(docxBuffer));
      
      // Find placeholders in HTML
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const foundPlaceholders: string[] = [];
      let match;
      while ((match = placeholderRegex.exec(html)) !== null) {
        if (!foundPlaceholders.includes(match[1])) {
          foundPlaceholders.push(match[1]);
        }
      }
      
      res.json({
        success: true,
        extractedFields: foundPlaceholders,
        sourceDocxPath: template.sourceDocxPath
      });
    } catch (error) {
      console.error("Error updating DOCX from HTML:", error);
      res.status(500).json({ error: "Failed to update from HTML" });
    }
  });
  
  // Get DOCX as formatted HTML using mammoth (preserves styling)
  app.get("/api/contracts/categories/:categoryId/default-templates/:countryCode/docx-html", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      const withSampleData = req.query.withSampleData === "true";
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      if (!template.sourceDocxPath) {
        return res.status(404).json({ error: "DOCX template not found" });
      }
      
      const fullPath = path.join(process.cwd(), template.sourceDocxPath);
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "DOCX file not found" });
      }
      
      // Convert DOCX to HTML using mammoth
      const result = await mammoth.convertToHtml({ path: fullPath }, {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "b => strong",
          "i => em",
          "u => u"
        ]
      });
      
      let html = result.value;
      
      // Get sample data and placeholders
      const { SAMPLE_DATA } = await import("./template-processor");
      
      // Find all placeholders in the HTML
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const foundPlaceholders: string[] = [];
      let match;
      while ((match = placeholderRegex.exec(html)) !== null) {
        if (!foundPlaceholders.includes(match[1])) {
          foundPlaceholders.push(match[1]);
        }
      }
      
      if (withSampleData) {
        // Replace placeholders with sample data
        for (const placeholder of foundPlaceholders) {
          const regex = new RegExp(`\\{\\{${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}\\}`, 'g');
          const value = SAMPLE_DATA[placeholder] || `[${placeholder}]`;
          html = html.replace(regex, `<span class="sample-value" style="background: #d4edda; padding: 2px 4px; border-radius: 3px;">${value}</span>`);
        }
      } else {
        // Highlight placeholders
        html = html.replace(/\{\{([^}]+)\}\}/g, '<span class="placeholder" style="background: #fff3cd; padding: 2px 4px; border-radius: 3px; font-weight: bold; color: #856404;">{{$1}}</span>');
      }
      
      // Add CSS for styling
      const styledHtml = `
        <style>
          .docx-content { font-family: 'Times New Roman', serif; line-height: 1.5; }
          .docx-content p { margin: 0.5em 0; }
          .docx-content table { border-collapse: collapse; width: 100%; margin: 1em 0; }
          .docx-content td, .docx-content th { border: 1px solid #ddd; padding: 8px; }
          .docx-content h1 { font-size: 1.5em; font-weight: bold; margin: 1em 0 0.5em; }
          .docx-content h2 { font-size: 1.3em; font-weight: bold; margin: 1em 0 0.5em; }
          .docx-content h3 { font-size: 1.1em; font-weight: bold; margin: 1em 0 0.5em; }
          .placeholder { cursor: pointer; }
          .placeholder:hover { background: #ffc107 !important; }
        </style>
        <div class="docx-content">${html}</div>
      `;
      
      res.json({
        html: styledHtml,
        rawHtml: html,
        extractedFields: foundPlaceholders,
        messages: result.messages,
        sampleData: SAMPLE_DATA,
        placeholderMappings: template.placeholderMappings 
          ? (typeof template.placeholderMappings === 'string' ? JSON.parse(template.placeholderMappings) : template.placeholderMappings)
          : {}
      });
    } catch (error) {
      console.error("Error converting DOCX to HTML:", error);
      res.status(500).json({ error: "Failed to convert DOCX to HTML" });
    }
  });
  
  // Get DOCX preview as PDF using LibreOffice conversion
  app.get("/api/contracts/categories/:categoryId/default-templates/:countryCode/preview-pdf", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      
      if (!template) {
        return res.status(404).json({ error: "Šablóna nebola nájdená" });
      }
      
      if (!template.sourceDocxPath) {
        return res.status(404).json({ error: "DOCX šablóna nebola nájdená" });
      }
      
      const fullPath = path.join(process.cwd(), template.sourceDocxPath);
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "DOCX súbor nebol nájdený" });
      }
      
      // Create preview directory if it doesn't exist
      const previewDir = path.join(process.cwd(), "uploads", "template-previews", String(categoryId));
      if (!fs.existsSync(previewDir)) {
        fs.mkdirSync(previewDir, { recursive: true });
      }
      
      // Convert DOCX to PDF using LibreOffice
      const { convertDocxToPdf } = await import("./template-processor");
      const pdfPath = await convertDocxToPdf(fullPath, previewDir);
      
      // Send the PDF file
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
      res.sendFile(pdfPath);
    } catch (error: any) {
      console.error("Error generating PDF preview:", error);
      res.status(500).json({ error: error.message || "Chyba pri generovaní náhľadu PDF" });
    }
  });
  
  // Upload new DOCX file directly to template (for step 3 workflow)
  app.post("/api/contracts/categories/:categoryId/default-templates/:countryCode", requireAuth, uploadDocxMemory.single("docxFile"), async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Get existing template
      let template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      
      // Create directory for the template
      const templateDir = path.join(process.cwd(), "uploads", "contract-templates", String(categoryId), countryCode);
      if (!fs.existsSync(templateDir)) {
        fs.mkdirSync(templateDir, { recursive: true });
      }
      
      // Save the uploaded DOCX file
      const timestamp = Date.now();
      const docxFilename = `template-${timestamp}.docx`;
      const docxPath = path.join(templateDir, docxFilename);
      fs.writeFileSync(docxPath, req.file.buffer);
      const relativeDocxPath = docxPath.replace(process.cwd() + "/", "");
      
      // Extract placeholders from the new DOCX
      let extractedFields: string[] = [];
      try {
        const { extractDocxPlaceholders } = await import("./template-processor");
        extractedFields = await extractDocxPlaceholders(docxPath);
      } catch (e) {
        console.warn("Failed to extract placeholders:", e);
      }
      
      if (template) {
        // Update existing template
        await storage.updateCategoryDefaultTemplate(template.id, {
          sourceDocxPath: relativeDocxPath,
          extractedFields: JSON.stringify(extractedFields),
        });
      } else {
        // Create new template
        template = await storage.createCategoryDefaultTemplate({
          categoryId,
          countryCode,
          templateType: "docx",
          sourceDocxPath: relativeDocxPath,
          originalDocxPath: relativeDocxPath,
          extractedFields: JSON.stringify(extractedFields),
        });
      }
      
      res.json({ 
        success: true, 
        message: "Šablóna bola úspešne nahraná",
        sourceDocxPath: relativeDocxPath,
        extractedFields
      });
    } catch (error: any) {
      console.error("Error uploading DOCX template:", error);
      res.status(500).json({ error: error.message || "Chyba pri nahrávaní šablóny" });
    }
  });
  
  // Get raw DOCX file for SuperDoc editor
  app.get("/api/contracts/categories/:categoryId/default-templates/:countryCode/docx", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      if (!template.sourceDocxPath) {
        return res.status(404).json({ error: "DOCX template not found" });
      }
      
      const fullPath = path.join(process.cwd(), template.sourceDocxPath);
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "DOCX file not found" });
      }
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="template_${countryCode}.docx"`);
      res.sendFile(fullPath);
    } catch (error) {
      console.error("Error serving DOCX:", error);
      res.status(500).json({ error: "Failed to serve DOCX file" });
    }
  });
  
  // Save DOCX file from SuperDoc editor
  app.post("/api/contracts/categories/:categoryId/default-templates/:countryCode/save-docx", requireAuth, uploadDocxMemory.single("file"), async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Create backup of existing file
      if (template.sourceDocxPath) {
        const oldPath = path.join(process.cwd(), template.sourceDocxPath);
        if (fs.existsSync(oldPath)) {
          const backupDir = path.join(process.cwd(), "uploads", "contract-templates", `${categoryId}`, countryCode, "backups");
          await fs.promises.mkdir(backupDir, { recursive: true });
          const backupPath = path.join(backupDir, `backup-${Date.now()}.docx`);
          fs.copyFileSync(oldPath, backupPath);
        }
      }
      
      // Save DOCX from memory buffer to disk
      const saveDir = path.join(process.cwd(), "uploads", "contract-templates", `${categoryId}`, countryCode);
      await fs.promises.mkdir(saveDir, { recursive: true });
      const savePath = path.join(saveDir, `template-${Date.now()}.docx`);
      
      // Write buffer directly to file
      fs.writeFileSync(savePath, req.file.buffer);
      
      const relativePath = savePath.replace(process.cwd() + "/", "");
      
      // Extract placeholders - try multiple methods for SuperDoc compatibility
      let foundPlaceholders: string[] = [];
      const existingPlaceholders = template.extractedFields 
        ? (typeof template.extractedFields === 'string' 
            ? JSON.parse(template.extractedFields) 
            : template.extractedFields)
        : [];
      
      try {
        // Method 1: mammoth extractRawText
        const mammothResult = await mammoth.extractRawText({ path: savePath });
        const text = mammothResult.value || "";
        
        const placeholderRegex = /\{\{([^}]+)\}\}/g;
        let match;
        while ((match = placeholderRegex.exec(text)) !== null) {
          if (!foundPlaceholders.includes(match[1])) {
            foundPlaceholders.push(match[1]);
          }
        }
        
        // Method 2: If mammoth found nothing, try direct XML parsing
        if (foundPlaceholders.length === 0) {
          console.log("[DOCX Save] Mammoth found no placeholders, trying XML parsing");
          try {
            const PizZip = (await import("pizzip")).default;
            const content = fs.readFileSync(savePath);
            const zip = new PizZip(content);
            const docXml = zip.files["word/document.xml"]?.asText() || "";
            
            let xmlMatch;
            while ((xmlMatch = placeholderRegex.exec(docXml)) !== null) {
              if (!foundPlaceholders.includes(xmlMatch[1])) {
                foundPlaceholders.push(xmlMatch[1]);
              }
            }
          } catch (xmlError) {
            console.warn("[DOCX Save] XML parsing also failed:", xmlError);
          }
        }
        
        // Method 3: If still no placeholders found, preserve existing ones
        if (foundPlaceholders.length === 0 && existingPlaceholders.length > 0) {
          console.log("[DOCX Save] No placeholders found, preserving existing:", existingPlaceholders.length);
          foundPlaceholders = existingPlaceholders;
        }
        
      } catch (extractError) {
        console.warn("[DOCX Save] Extraction failed, preserving existing:", extractError);
        foundPlaceholders = existingPlaceholders;
      }
      
      // Update template with new path and extracted fields
      await storage.updateCategoryDefaultTemplate(categoryId, countryCode, {
        sourceDocxPath: relativePath,
        extractedFields: foundPlaceholders
      });
      
      res.json({
        success: true,
        sourceDocxPath: relativePath,
        extractedFields: foundPlaceholders
      });
    } catch (error) {
      console.error("Error saving DOCX:", error);
      res.status(500).json({ error: "Failed to save DOCX file" });
    }
  });
  
  // Extract variables from DOCX template
  app.get("/api/contracts/categories/:categoryId/default-templates/:countryCode/extract-variables", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      if (!template.sourceDocxPath) {
        return res.json({ variables: [] });
      }
      
      const fullPath = path.join(process.cwd(), template.sourceDocxPath);
      
      if (!fs.existsSync(fullPath)) {
        return res.json({ variables: [] });
      }
      
      // Extract placeholders from DOCX
      const PizZip = (await import("pizzip")).default;
      const content = fs.readFileSync(fullPath);
      const zip = new PizZip(content);
      const docXml = zip.files["word/document.xml"]?.asText() || "";
      
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const foundVariables: string[] = [];
      let match;
      while ((match = placeholderRegex.exec(docXml)) !== null) {
        if (!foundVariables.includes(match[1])) {
          foundVariables.push(match[1]);
        }
      }
      
      res.json({ variables: foundVariables });
    } catch (error) {
      console.error("Error extracting variables:", error);
      res.status(500).json({ error: "Failed to extract variables" });
    }
  });
  
  // Insert placeholder manually at a specific text position in DOCX
  app.post("/api/contracts/categories/:categoryId/default-templates/:countryCode/insert-placeholder", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode.toUpperCase();
      const { searchText, placeholder, crmField } = req.body;
      
      if (!searchText || !placeholder) {
        return res.status(400).json({ error: "searchText and placeholder are required" });
      }
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      
      if (!template || !template.sourceDocxPath) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      const fullPath = path.join(process.cwd(), template.sourceDocxPath);
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "DOCX file not found" });
      }
      
      // Read and modify DOCX
      const PizZip = (await import("pizzip")).default;
      const Docxtemplater = (await import("docxtemplater")).default;
      
      const content = fs.readFileSync(fullPath);
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: "{{", end: "}}" }
      });
      
      // Get document XML
      const docXml = zip.files["word/document.xml"].asText();
      
      // Replace search text with placeholder
      const placeholderText = `{{${placeholder}}}`;
      const newDocXml = docXml.replace(new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), placeholderText);
      
      if (newDocXml === docXml) {
        return res.status(400).json({ error: `Text "${searchText}" nebol nájdený v dokumente` });
      }
      
      // Update the document
      zip.file("word/document.xml", newDocXml);
      
      // Save modified DOCX
      const modifiedDir = path.join(process.cwd(), "uploads", "contract-templates", `${categoryId}`, countryCode);
      await fs.promises.mkdir(modifiedDir, { recursive: true });
      const modifiedPath = path.join(modifiedDir, `modified-${Date.now()}.docx`);
      
      const out = zip.generate({ type: "nodebuffer" });
      fs.writeFileSync(modifiedPath, out);
      
      const relativePath = modifiedPath.replace(process.cwd() + "/", "");
      
      // Update mappings
      let mappings = template.placeholderMappings 
        ? (typeof template.placeholderMappings === 'string' ? JSON.parse(template.placeholderMappings) : template.placeholderMappings)
        : {};
      if (crmField) {
        mappings[`{{${placeholder}}}`] = crmField;
      }
      
      // Extract new placeholders
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const foundPlaceholders: string[] = [];
      let match;
      while ((match = placeholderRegex.exec(newDocXml)) !== null) {
        const ph = match[1].trim();
        if (!foundPlaceholders.includes(ph) && !ph.includes('<') && !ph.includes('>')) {
          foundPlaceholders.push(ph);
        }
      }
      
      // Update template - set conversionMetadata so reset button appears
      await storage.updateCategoryDefaultTemplate(template.id, {
        sourceDocxPath: relativePath,
        extractedFields: JSON.stringify(foundPlaceholders),
        placeholderMappings: JSON.stringify(mappings),
        conversionMetadata: JSON.stringify({
          aiProcessedAt: new Date().toISOString(),
          manualInsertedPlaceholder: placeholder
        })
      });
      
      res.json({
        success: true,
        message: `Premenná {{${placeholder}}} bola vložená`,
        placeholder,
        extractedFields: foundPlaceholders,
        placeholderMappings: mappings,
        aiProcessed: true
      });
    } catch (error) {
      console.error("Error inserting placeholder:", error);
      res.status(500).json({ error: "Failed to insert placeholder: " + (error as Error).message });
    }
  });

  // Generate contract from template for a customer
  app.post("/api/contracts/generate", requireAuth, async (req, res) => {
    try {
      const { categoryId, countryCode, customerId, contractId } = req.body;
      
      if (!categoryId || !countryCode || !customerId) {
        return res.status(400).json({ error: "categoryId, countryCode, and customerId are required" });
      }

      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const sourcePath = template.templateType === "pdf_form" 
        ? template.sourcePdfPath 
        : template.sourceDocxPath;
        
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        return res.status(400).json({ error: "Template source file not found" });
      }

      const placeholderMappings = template.placeholderMappings 
        ? JSON.parse(template.placeholderMappings) 
        : {};

      const customerData = getCustomerDataForContract(customer);
      
      const data: Record<string, string> = {};
      const extractedFields = template.extractedFields ? JSON.parse(template.extractedFields) : [];
      
      for (const field of extractedFields) {
        const mapping = placeholderMappings[field.name];
        if (mapping && customerData[mapping]) {
          data[field.name] = customerData[mapping];
        } else if (customerData[field.name]) {
          data[field.name] = customerData[field.name];
        } else {
          data[field.name] = "";
        }
      }

      const outputDir = path.join(process.cwd(), "uploads", "generated-contracts");
      const generatedContractId = contractId || `${customerId}-${Date.now()}`;
      
      const result = await generateContractFromTemplate(
        template.templateType as "pdf_form" | "docx",
        sourcePath,
        data,
        outputDir,
        generatedContractId
      );

      res.json({
        success: true,
        pdfPath: result.pdfPath,
        pdfUrl: `/uploads/generated-contracts/${path.basename(result.pdfPath)}`,
        customerId,
        contractId: generatedContractId,
      });
    } catch (error) {
      console.error("Error generating contract:", error);
      res.status(500).json({ error: "Failed to generate contract" });
    }
  });
  
  // Update placeholder mappings for a template
  app.patch("/api/contracts/categories/:categoryId/default-templates/:countryCode/mappings", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const { countryCode } = req.params;
      const { mappings } = req.body;
      
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const result = await storage.updateCategoryDefaultTemplate(template.id, {
        placeholderMappings: JSON.stringify(mappings),
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error updating mappings:", error);
      res.status(500).json({ error: "Failed to update mappings" });
    }
  });


  // Contract Templates
  app.get("/api/contracts/templates", requireAuth, async (req, res) => {
    try {
      const { countryCode } = req.query;
      const templates = countryCode 
        ? await storage.getContractTemplatesByCountry(countryCode as string)
        : await storage.getAllContractTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching contract templates:", error);
      res.status(500).json({ error: "Failed to fetch contract templates" });
    }
  });

  app.get("/api/contracts/templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getContractTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching contract template:", error);
      res.status(500).json({ error: "Failed to fetch contract template" });
    }
  });

  app.post("/api/contracts/templates", requireAuth, async (req, res) => {
    try {
      // Extract only the fields that belong to contractTemplates schema
      const { 
        name, 
        description, 
        countryCode, 
        languageCode, 
        category, 
        contentHtml,
        // These are new fields from the DOCX workflow - store them in placeholders JSON
        loadedFromCategory,
        loadedCategoryId,
        sourceDocxPath,
        extractedFields,
        placeholderMappings
      } = req.body;
      
      // Store DOCX workflow metadata in placeholders field as JSON
      const placeholdersData = loadedFromCategory ? JSON.stringify({
        loadedFromCategory,
        loadedCategoryId,
        sourceDocxPath,
        extractedFields: extractedFields || [],
        placeholderMappings: placeholderMappings || {}
      }) : null;
      
      const data = insertContractTemplateSchema.parse({
        name,
        description: description || "",
        countryCode,
        languageCode: languageCode || countryCode?.toLowerCase() || "sk",
        category: category || "general",
        contentHtml: contentHtml || "",
        placeholders: placeholdersData,
        createdBy: req.session.user!.id
      });
      
      const template = await storage.createContractTemplate(data);
      
      await logActivity(req.session.user!.id, "create", "contract_template", template.id, template.name, null, req.ip);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating contract template:", error);
      res.status(500).json({ error: "Failed to create contract template" });
    }
  });

  app.patch("/api/contracts/templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.updateContractTemplate(req.params.id, req.body);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      await logActivity(req.session.user!.id, "update", "contract_template", template.id, template.name, null, req.ip);
      res.json(template);
    } catch (error) {
      console.error("Error updating contract template:", error);
      res.status(500).json({ error: "Failed to update contract template" });
    }
  });

  app.delete("/api/contracts/templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getContractTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      await storage.deleteContractTemplate(req.params.id);
      await logActivity(req.session.user!.id, "delete", "contract_template", template.id, template.name, null, req.ip);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contract template:", error);
      res.status(500).json({ error: "Failed to delete contract template" });
    }
  });

  // Contract Template Versions (per category/country)
  app.get("/api/contract-categories/:categoryId/countries/:countryCode/versions", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const { countryCode } = req.params;
      const versions = await storage.getTemplateVersions(categoryId, countryCode);
      console.log("[Versions API] categoryId:", categoryId, "countryCode:", countryCode);
      console.log("[Versions API] Found versions:", versions.length, "with isDefault:", versions.map(v => ({ id: v.id, vn: v.versionNumber, isDefault: v.isDefault })));
      res.json(versions);
    } catch (error) {
      console.error("Error fetching template versions:", error);
      res.status(500).json({ error: "Failed to fetch template versions" });
    }
  });

  app.get("/api/contract-categories/:categoryId/countries/:countryCode/versions/:versionNumber", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const { countryCode } = req.params;
      const versionNumber = parseInt(req.params.versionNumber);
      const version = await storage.getTemplateVersionByNumber(categoryId, countryCode, versionNumber);
      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }
      res.json(version);
    } catch (error) {
      console.error("Error fetching template version:", error);
      res.status(500).json({ error: "Failed to fetch template version" });
    }
  });

  app.post("/api/contract-categories/:categoryId/countries/:countryCode/versions", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const { countryCode } = req.params;
      const user = req.session.user!;
      
      // Get the current template to find the source DOCX path
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      if (!template || !template.sourceDocxPath) {
        return res.status(404).json({ error: "Template or source DOCX not found" });
      }
      
      // Create immutable version copy of the DOCX file
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      
      const sourceDocxPath = path.join(process.cwd(), template.sourceDocxPath);
      const nextVersionNumber = await storage.getLatestVersionNumber(categoryId, countryCode) + 1;
      
      // Create versioned file path: uploads/contract_versions/category_country_v1.docx
      const versionsDir = path.join(process.cwd(), 'uploads', 'contract_versions');
      await fs.mkdir(versionsDir, { recursive: true });
      
      const versionedFileName = `category_${categoryId}_${countryCode}_v${nextVersionNumber}.docx`;
      const versionedFilePath = path.join(versionsDir, versionedFileName);
      const relativeVersionPath = `uploads/contract_versions/${versionedFileName}`;
      
      // Copy the current DOCX to the versioned location
      await fs.copyFile(sourceDocxPath, versionedFilePath);
      
      const data = insertContractTemplateVersionSchema.parse({
        ...req.body,
        docxFilePath: relativeVersionPath,
        categoryId,
        countryCode,
        createdBy: user.id,
        createdByName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username
      });
      const version = await storage.createTemplateVersion(data);
      res.status(201).json(version);
    } catch (error) {
      console.error("Error creating template version:", error);
      res.status(500).json({ error: "Failed to create template version" });
    }
  });

  // Set a version as the default for a category/country
  app.post("/api/contract-categories/:categoryId/countries/:countryCode/versions/:versionId/set-default", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const countryCode = req.params.countryCode;
      const versionId = parseInt(req.params.versionId);
      
      const version = await storage.getTemplateVersion(versionId);
      if (!version) {
        return res.status(404).json({ error: "Verzia nebola nájdená" });
      }
      
      // Clear all other defaults for this category/country
      await storage.clearDefaultVersions(categoryId, countryCode);
      
      // Set this version as default
      await storage.setVersionAsDefault(versionId);
      
      // Also update the category default template with this version's content
      const template = await storage.getCategoryDefaultTemplate(categoryId, countryCode);
      if (template && version.htmlContent) {
        await storage.updateCategoryDefaultTemplate(template.id, {
          htmlContent: version.htmlContent
        });
      }
      
      // If version has DOCX, copy it to the current template location
      if (template && version.docxFilePath) {
        const fs = await import('fs').then(m => m.promises);
        const path = await import('path');
        
        const versionedFilePath = path.join(process.cwd(), version.docxFilePath);
        const fileExists = await fs.access(versionedFilePath).then(() => true).catch(() => false);
        
        if (fileExists && template.sourceDocxPath) {
          const destPath = path.join(process.cwd(), template.sourceDocxPath);
          await fs.copyFile(versionedFilePath, destPath);
        }
      }
      
      res.json({ success: true, message: "Verzia nastavená ako predvolená", version });
    } catch (error) {
      console.error("Error setting default version:", error);
      res.status(500).json({ error: "Nepodarilo sa nastaviť predvolenú verziu" });
    }
  });

  app.post("/api/contract-categories/:categoryId/countries/:countryCode/versions/:versionId/revert", requireAuth, async (req, res) => {
    try {
      const versionId = parseInt(req.params.versionId);
      const version = await storage.getTemplateVersion(versionId);
      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }
      
      // Get the category template and update it with the version's content
      const template = await storage.getCategoryDefaultTemplate(version.categoryId, version.countryCode);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Copy the versioned DOCX file to be the active template
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      
      // Check if the versioned file exists
      if (version.docxFilePath) {
        const versionedFilePath = path.join(process.cwd(), version.docxFilePath);
        if (await fs.access(versionedFilePath).then(() => true).catch(() => false)) {
          // Copy to the current template location
          const currentDocxPath = template.sourceDocxPath;
          if (currentDocxPath) {
            const destPath = path.join(process.cwd(), currentDocxPath);
            await fs.copyFile(versionedFilePath, destPath);
          }
        }
      }
      
      // Update template htmlContent if version has it
      if (version.htmlContent) {
        await storage.updateCategoryDefaultTemplate(template.id, {
          htmlContent: version.htmlContent
        });
      }
      
      res.json({ success: true, message: "Reverted to version " + version.versionNumber, version });
    } catch (error) {
      console.error("Error reverting template version:", error);
      res.status(500).json({ error: "Failed to revert template version" });
    }
  });

  // Contract Instances
  app.get("/api/contracts", requireAuth, async (req, res) => {
    try {
      const { customerId, status } = req.query;
      let contracts;
      if (customerId) {
        contracts = await storage.getContractInstancesByCustomer(customerId as string);
      } else if (status) {
        contracts = await storage.getContractInstancesByStatus(status as string);
      } else {
        contracts = await storage.getAllContractInstances();
      }
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ error: "Failed to fetch contracts" });
    }
  });

  app.get("/api/contracts/next-number", requireAuth, async (req, res) => {
    try {
      const prefix = (req.query.prefix as string) || "ZML";
      const number = await storage.getNextContractNumber(prefix);
      res.json({ contractNumber: number });
    } catch (error) {
      console.error("Error generating contract number:", error);
      res.status(500).json({ error: "Failed to generate contract number" });
    }
  });

  app.get("/api/contracts/:id", requireAuth, async (req, res) => {
    try {
      const contract = await storage.getContractInstance(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      
      const [products, participants, signatureRequests, auditLog] = await Promise.all([
        storage.getContractInstanceProducts(contract.id),
        storage.getContractParticipants(contract.id),
        storage.getContractSignatureRequests(contract.id),
        storage.getContractAuditLog(contract.id)
      ]);
      
      res.json({ ...contract, products, participants, signatureRequests, auditLog });
    } catch (error) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ error: "Failed to fetch contract" });
    }
  });

  app.post("/api/contracts", requireAuth, async (req, res) => {
    try {
      const { categoryId, customerId, billingDetailsId, currency, notes, templateVersionId } = req.body;
      
      if (!categoryId) {
        return res.status(400).json({ error: "Vyberte typ zmluvy (kategóriu)" });
      }
      
      if (!customerId) {
        return res.status(400).json({ error: "Vyberte zákazníka" });
      }
      
      if (!billingDetailsId) {
        return res.status(400).json({ error: "Vyberte fakturačnú spoločnosť" });
      }
      
      // Get customer to determine country
      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(400).json({ error: "Zákazník nebol nájdený" });
      }
      
      const countryCode = customer.country || "SK";
      
      // Find template for category and country
      const categoryDefaultTemplate = await storage.getCategoryDefaultTemplate(parseInt(categoryId), countryCode);
      if (!categoryDefaultTemplate) {
        // Get category name for better error message
        const category = await storage.getContractCategory(parseInt(categoryId));
        const categoryName = category?.label || categoryId;
        return res.status(400).json({ 
          error: `Pre kategóriu "${categoryName}" a krajinu "${countryCode}" neexistuje šablóna zmluvy. Najprv vytvorte šablónu v nastaveniach zmlúv.` 
        });
      }
      
      // Use the category default template ID as the template reference
      const templateId = String(categoryDefaultTemplate.id);
      
      const contractNumber = await storage.getNextContractNumber(req.body.prefix || "ZML");
      
      const data = insertContractInstanceSchema.parse({
        templateId,
        templateVersionId: templateVersionId || null,
        customerId,
        billingDetailsId,
        currency: currency || "EUR",
        notes: notes || null,
        contractNumber,
        createdBy: req.session.user!.id
      });
      
      const contract = await storage.createContractInstance(data);
      
      await storage.createContractAuditLog({
        contractId: contract.id,
        action: "created",
        actorId: req.session.user!.id,
        actorType: "user",
        actorName: req.session.user!.fullName,
        actorEmail: req.session.user!.email,
        ipAddress: req.ip,
        details: JSON.stringify({ status: "draft", categoryId: parseInt(categoryId), countryCode })
      });
      
      await logActivity(req.session.user!.id, "create", "contract", contract.id, contract.contractNumber, null, req.ip);
      res.status(201).json(contract);
    } catch (error) {
      console.error("Error creating contract:", error);
      res.status(500).json({ error: "Failed to create contract" });
    }
  });

  app.patch("/api/contracts/:id", requireAuth, async (req, res) => {
    try {
      const existingContract = await storage.getContractInstance(req.params.id);
      if (!existingContract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      
      const contract = await storage.updateContractInstance(req.params.id, req.body);
      
      await storage.createContractAuditLog({
        contractId: contract!.id,
        action: "updated",
        actorId: req.session.user!.id,
        actorType: "user",
        actorName: req.session.user!.fullName,
        actorEmail: req.session.user!.email,
        ipAddress: req.ip,
        previousValue: JSON.stringify(existingContract),
        newValue: JSON.stringify(contract)
      });
      
      res.json(contract);
    } catch (error) {
      console.error("Error updating contract:", error);
      res.status(500).json({ error: "Failed to update contract" });
    }
  });

  app.delete("/api/contracts/:id", requireAuth, async (req, res) => {
    try {
      const contract = await storage.getContractInstance(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      
      await storage.deleteContractInstanceProducts(contract.id);
      await storage.deleteContractInstance(req.params.id);
      
      await logActivity(req.session.user!.id, "delete", "contract", contract.id, contract.contractNumber, null, req.ip);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contract:", error);
      res.status(500).json({ error: "Failed to delete contract" });
    }
  });

  // Contract Instance Products
  app.post("/api/contracts/:id/products", requireAuth, async (req, res) => {
    try {
      const data = insertContractInstanceProductSchema.parse({
        ...req.body,
        contractId: req.params.id
      });
      const product = await storage.createContractInstanceProduct(data);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error adding contract product:", error);
      res.status(500).json({ error: "Failed to add contract product" });
    }
  });

  app.delete("/api/contracts/:contractId/products/:productId", requireAuth, async (req, res) => {
    try {
      await storage.deleteContractInstanceProduct(req.params.productId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing contract product:", error);
      res.status(500).json({ error: "Failed to remove contract product" });
    }
  });

  // Contract Participants
  app.post("/api/contracts/:id/participants", requireAuth, async (req, res) => {
    try {
      const data = insertContractParticipantSchema.parse({
        ...req.body,
        contractId: req.params.id
      });
      const participant = await storage.createContractParticipant(data);
      res.status(201).json(participant);
    } catch (error) {
      console.error("Error adding contract participant:", error);
      res.status(500).json({ error: "Failed to add contract participant" });
    }
  });

  app.patch("/api/contracts/:contractId/participants/:participantId", requireAuth, async (req, res) => {
    try {
      const participant = await storage.updateContractParticipant(req.params.participantId, req.body);
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }
      res.json(participant);
    } catch (error) {
      console.error("Error updating contract participant:", error);
      res.status(500).json({ error: "Failed to update contract participant" });
    }
  });

  app.delete("/api/contracts/:contractId/participants/:participantId", requireAuth, async (req, res) => {
    try {
      await storage.deleteContractParticipant(req.params.participantId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contract participant:", error);
      res.status(500).json({ error: "Failed to delete contract participant" });
    }
  });

  // Contract Rendering - supports DOCX templates with variable substitution
  app.post("/api/contracts/:id/render", requireAuth, async (req, res) => {
    try {
      const contract = await storage.getContractInstance(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      
      // Get template from category_default_templates (templateId now stores the default template ID)
      const categoryDefaultTemplate = await storage.getCategoryDefaultTemplateById(parseInt(contract.templateId));
      if (!categoryDefaultTemplate) {
        return res.status(404).json({ error: "Contract template not found" });
      }
      
      // Check if we have DOCX template for DOCX-based rendering
      const hasDocxTemplate = categoryDefaultTemplate.sourceDocxPath && 
        fs.existsSync(path.join(process.cwd(), categoryDefaultTemplate.sourceDocxPath));
      
      // Check for HTML content (legacy)
      const hasHtmlContent = !!categoryDefaultTemplate.htmlContent;
      
      if (!hasDocxTemplate && !hasHtmlContent) {
        return res.status(400).json({ 
          error: "Šablóna nie je k dispozícii. Najprv nahrajte DOCX šablónu.",
          requiresUpload: true
        });
      }
      
      // Use categoryDefaultTemplate for rendering - map htmlContent to contentHtml for compatibility
      const contractTemplate = { ...categoryDefaultTemplate, contentHtml: categoryDefaultTemplate.htmlContent || "" };
      
      const [customer, products] = await Promise.all([
        storage.getCustomer(contract.customerId),
        storage.getContractInstanceProducts(contract.id)
      ]);
      
      // Get customer's potential case for father data
      const potentialCase = customer ? await storage.getCustomerPotentialCase(customer.id) : null;
      
      // Get billing details - first try by ID, then fallback to customer's country
      let billingDetails = contract.billingDetailsId 
        ? await storage.getBillingDetailsById(contract.billingDetailsId)
        : null;
      
      // If no billing details by ID, try to find by customer's country
      if (!billingDetails && customer?.country) {
        billingDetails = await storage.getBillingDetails(customer.country);
      }
      
      // If still no billing details, try to get the first available one
      if (!billingDetails) {
        const allBillingDetails = await storage.getAllBillingDetails();
        billingDetails = allBillingDetails[0] || null;
      }
      
      // If we only have DOCX template (no HTML), indicate PDF-based preview
      if (hasDocxTemplate && !hasHtmlContent) {
        return res.json({
          html: null,
          docxBased: true,
          message: "Táto šablóna je DOCX. Zobrazte náhľad PDF kliknutím na tlačidlo PDF.",
          pdfUrl: `/api/contracts/${contract.id}/pdf`
        });
      }
      
      const template = Handlebars.compile(contractTemplate.contentHtml);
      
      // Format date helper
      const formatDate = (date: Date | string | null | undefined): string => {
        if (!date) return "";
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleDateString("sk-SK");
      };
      
      // Build father name from potential case
      const fatherFullName = potentialCase?.fatherFirstName && potentialCase?.fatherLastName
        ? `${potentialCase.fatherFirstName} ${potentialCase.fatherLastName}`.trim()
        : "";
      
      const context = {
        customer: {
          fullName: `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim(),
          firstName: customer?.firstName || "",
          lastName: customer?.lastName || "",
          email: customer?.email || "",
          phone: customer?.phone || "",
          address: customer?.address || "",
          city: customer?.city || "",
          postalCode: customer?.postalCode || "",
          fullAddress: [customer?.address, customer?.city, customer?.postalCode].filter(Boolean).join(", "),
          dateOfBirth: formatDate(customer?.dateOfBirth),
          birthDate: formatDate(customer?.dateOfBirth),
          personalId: customer?.nationalId || "",
          birthNumber: customer?.nationalId || ""
        },
        father: {
          fullName: fatherFullName,
          firstName: potentialCase?.fatherFirstName || "",
          lastName: potentialCase?.fatherLastName || "",
          email: potentialCase?.fatherEmail || "",
          phone: potentialCase?.fatherPhone || potentialCase?.fatherMobile || "",
          address: potentialCase?.fatherStreet || "",
          city: potentialCase?.fatherCity || "",
          postalCode: potentialCase?.fatherPostalCode || ""
        },
        billing: {
          companyName: billingDetails?.companyName || "Cord Blood Center AG",
          fullName: billingDetails?.fullName || billingDetails?.companyName || "",
          ico: billingDetails?.ico || "",
          taxId: billingDetails?.taxId || billingDetails?.ico || "",
          dic: billingDetails?.dic || "",
          vatId: billingDetails?.vatNumber || "",
          vatNumber: billingDetails?.vatNumber || "",
          address: billingDetails?.address || billingDetails?.residencyStreet || "",
          city: billingDetails?.city || billingDetails?.residencyCity || "",
          postalCode: billingDetails?.postalCode || billingDetails?.residencyPostalCode || "",
          fullAddress: [billingDetails?.address || billingDetails?.residencyStreet, billingDetails?.city || billingDetails?.residencyCity, billingDetails?.postalCode || billingDetails?.residencyPostalCode].filter(Boolean).join(", "),
          iban: billingDetails?.bankIban || "",
          swift: billingDetails?.bankSwift || "",
          bankName: billingDetails?.bankName || "",
          phone: billingDetails?.phone || "",
          email: billingDetails?.email || "",
          representative: "Ján Šidlík, MBA"
        },
        contract: {
          number: contract.contractNumber,
          date: new Date().toLocaleDateString("sk-SK"),
          validFrom: contract.validFrom || "",
          validTo: contract.validTo || "",
          totalNet: contract.totalNetAmount || "0",
          totalVat: contract.totalVatAmount || "0",
          totalGross: contract.totalGrossAmount || "0",
          currency: contract.currency
        },
        products: products.map(p => {
          const snapshot = p.productSnapshot ? JSON.parse(p.productSnapshot) : {};
          return {
            name: snapshot.name || "",
            price: p.unitPrice || "0",
            vat: p.lineVatAmount || "0",
            total: p.lineGrossAmount || "0",
            description: snapshot.description || ""
          };
        })
      };
      
      let renderedHtml = template(context);
      
      // Mark selected product in the pricing table using data-product-id attribute
      if (contract.selectedProductId) {
        const filledRadio = `<span class="product-radio product-selected" style="display: inline-block; width: 14px; height: 14px; border: 2px solid #2c3e50; border-radius: 50%; background-color: #2c3e50; position: relative;"><span style="position: absolute; top: 2px; left: 2px; width: 6px; height: 6px; border-radius: 50%; background-color: white;"></span></span>`;
        
        // Find the tr with matching data-product-id and replace span.product-radio within it
        const rowRegex = new RegExp(
          `(<tr[^>]*data-product-id="${contract.selectedProductId}"[^>]*>)([\\s\\S]*?)(<\\/tr>)`,
          'g'
        );
        renderedHtml = renderedHtml.replace(rowRegex, (match, trStart, content, trEnd) => {
          // Replace the empty radio span with the filled one, preserving all other content
          const updatedContent = content.replace(
            /<span class="product-radio"[^>]*>[^<]*(<span[^>]*>[^<]*<\/span>)?<\/span>/,
            filledRadio
          );
          return trStart + updatedContent + trEnd;
        });
      }
      
      await storage.updateContractInstance(contract.id, { renderedHtml });
      
      res.json({ html: renderedHtml, context });
    } catch (error) {
      console.error("Error rendering contract:", error);
      res.status(500).json({ error: "Failed to render contract" });
    }
  });

  // Generate PDF for a contract - uses DOCX template with variable substitution
  app.get("/api/contracts/:id/pdf", requireAuth, async (req, res) => {
    try {
      const contract = await storage.getContractInstance(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      
      // Get template from category_default_templates (templateId now stores the default template ID)
      const categoryDefaultTemplate = await storage.getCategoryDefaultTemplateById(parseInt(contract.templateId));
      if (!categoryDefaultTemplate) {
        return res.status(404).json({ error: "Contract template not found" });
      }
      
      // Check if we have DOCX template for DOCX-based PDF generation
      const hasDocxTemplate = categoryDefaultTemplate.sourceDocxPath && 
        fs.existsSync(path.join(process.cwd(), categoryDefaultTemplate.sourceDocxPath));
      
      // Check for HTML content (legacy)
      const hasHtmlContent = !!categoryDefaultTemplate.htmlContent;
      
      if (!hasDocxTemplate && !hasHtmlContent) {
        return res.status(400).json({ 
          error: "Šablóna nie je k dispozícii. Najprv nahrajte DOCX šablónu.",
          requiresUpload: true
        });
      }
      
      // Use categoryDefaultTemplate for rendering - map htmlContent to contentHtml for compatibility
      const contractTemplate = { ...categoryDefaultTemplate, contentHtml: categoryDefaultTemplate.htmlContent || "" };
      
      const [customer, products, participants] = await Promise.all([
        storage.getCustomer(contract.customerId),
        storage.getContractInstanceProducts(contract.id),
        storage.getContractParticipants(contract.id)
      ]);
      
      // Get customer's potential case for father data
      const potentialCase = customer ? await storage.getCustomerPotentialCase(customer.id) : null;
      
      // Get billing details - first try by ID, then fallback to customer's country
      let billingDetails = contract.billingDetailsId 
        ? await storage.getBillingDetailsById(contract.billingDetailsId)
        : null;
      
      if (!billingDetails && customer?.country) {
        billingDetails = await storage.getBillingDetails(customer.country);
      }
      
      if (!billingDetails) {
        const allBillingDetails = await storage.getAllBillingDetails();
        billingDetails = allBillingDetails[0] || null;
      }
      
      // Find father participant or use data from potential case
      const fatherParticipant = participants.find(p => p.participantType === "guarantor" || p.role === "father");
      
      // If we have DOCX template, use DOCX-based PDF generation (preferred)
      if (hasDocxTemplate && categoryDefaultTemplate.sourceDocxPath) {
        const docxPath = path.join(process.cwd(), categoryDefaultTemplate.sourceDocxPath);
        
        // Format date helper
        const formatDate = (date: Date | string | null | undefined): string => {
          if (!date) return "";
          const d = new Date(date);
          if (isNaN(d.getTime())) return "";
          return d.toLocaleDateString("sk-SK");
        };
        
        // Build FLAT context for docxtemplater (uses dot-notation keys like "customer.fullName")
        // Note: docxtemplater treats {{customer.fullName}} as looking for key "customer.fullName", NOT nested object access
        console.log("[PDF] Building DOCX data context (flat keys)...");
        console.log("[PDF] Customer:", customer?.firstName, customer?.lastName);
        console.log("[PDF] Father from potentialCase:", potentialCase?.fatherFirstName, potentialCase?.fatherLastName);
        
        const fatherFullName = potentialCase?.fatherFirstName && potentialCase?.fatherLastName
          ? `${potentialCase.fatherFirstName} ${potentialCase.fatherLastName}`.trim()
          : fatherParticipant?.fullName || "";
        
        const docxData: Record<string, string> = {
          // Customer fields
          "customer.fullName": `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim(),
          "customer.firstName": customer?.firstName || "",
          "customer.lastName": customer?.lastName || "",
          "customer.email": customer?.email || "",
          "customer.phone": customer?.phone || "",
          "customer.address": customer?.address || "",
          "customer.city": customer?.city || "",
          "customer.postalCode": customer?.postalCode || "",
          "customer.dateOfBirth": formatDate(customer?.dateOfBirth),
          "customer.birthNumber": customer?.nationalId || "",
          "customer.correspondenceAddress": customer?.address || "",
          // Mother fields (often same as customer for maternity contracts)
          "mother.permanentAddress": customer?.address || "",
          "mother.birthDate": formatDate(customer?.dateOfBirth),
          "mother.fullName": `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim(),
          // Father fields
          "father.fullName": fatherFullName,
          "father.firstName": potentialCase?.fatherFirstName || "",
          "father.lastName": potentialCase?.fatherLastName || "",
          "father.email": potentialCase?.fatherEmail || "",
          "father.phone": potentialCase?.fatherPhone || potentialCase?.fatherMobile || "",
          "father.permanentAddress": potentialCase?.fatherStreet || "",
          // Billing/Company fields
          "billing.companyName": billingDetails?.companyName || "Cord Blood Center AG",
          "billing.ico": billingDetails?.ico || "",
          "billing.dic": billingDetails?.dic || "",
          "billing.vatNumber": billingDetails?.vatNumber || "",
          "billing.address": billingDetails?.address || billingDetails?.residencyStreet || "",
          "billing.city": billingDetails?.city || billingDetails?.residencyCity || "",
          "billing.postalCode": billingDetails?.postalCode || billingDetails?.residencyPostalCode || "",
          "billing.iban": billingDetails?.bankIban || "",
          "billing.swift": billingDetails?.bankSwift || "",
          "billing.bankName": billingDetails?.bankName || "",
          "billing.email": billingDetails?.email || "",
          "billing.phone": billingDetails?.phone || "",
          // Contract fields
          "contract.number": contract.contractNumber,
          "contract.date": new Date().toLocaleDateString("sk-SK"),
          "contract.currency": contract.currency || "EUR",
        };
        
        console.log("[PDF] Data keys:", Object.keys(docxData).length);
        
        try {
          const outputDir = path.join(process.cwd(), "uploads", "generated-contracts");
          await fs.promises.mkdir(outputDir, { recursive: true });
          
          const result = await generateContractFromTemplate(
            "docx",
            docxPath,
            docxData,
            outputDir,
            contract.id
          );
          
          // Update contract with PDF path
          const relativePdfPath = result.pdfPath.replace(process.cwd() + "/", "");
          await storage.updateContractInstance(contract.id, { pdfPath: relativePdfPath });
          
          // Send PDF file - add watermark if cancelled
          let pdfBuffer = await fs.promises.readFile(result.pdfPath);
          
          if (contract.status === "cancelled") {
            const userLocale = getUserLocale(req.session.user?.assignedCountries || []);
            pdfBuffer = await addCancellationWatermark(pdfBuffer, contract.cancellationReason, userLocale);
          }
          
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="zmluva-${contract.contractNumber}.pdf"`);
          res.setHeader("Content-Length", pdfBuffer.length);
          return res.send(pdfBuffer);
        } catch (docxError: any) {
          console.error("[PDF] DOCX-based generation failed:", docxError);
          // If DOCX generation fails but we have HTML, try HTML fallback
          if (!hasHtmlContent) {
            return res.status(500).json({ 
              error: "Generovanie PDF zlyhalo: " + (docxError.message || "Neznáma chyba")
            });
          }
          // Fall through to HTML-based generation
          console.log("[PDF] Falling back to HTML-based generation");
        }
      }
      
      // Calculate totals from products
      let totalNet = 0;
      let totalVat = 0;
      let totalGross = 0;
      let firstProduct = null;
      
      for (const p of products) {
        totalNet += parseFloat(p.lineNetAmount || "0");
        totalVat += parseFloat(p.lineVatAmount || "0");
        totalGross += parseFloat(p.lineGrossAmount || "0");
        if (!firstProduct && p.productSnapshot) {
          firstProduct = JSON.parse(p.productSnapshot);
        }
      }
      
      // Build context for template rendering
      const template = Handlebars.compile(contractTemplate.contentHtml || "");
      
      // Format date of birth properly
      const formatDate = (date: Date | string | null | undefined): string => {
        if (!date) return "";
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleDateString("sk-SK");
      };
      
      // Build father name from potential case
      const fatherFullName = potentialCase?.fatherFirstName && potentialCase?.fatherLastName
        ? `${potentialCase.fatherFirstName} ${potentialCase.fatherLastName}`.trim()
        : fatherParticipant?.fullName || "";
      
      const context = {
        customer: {
          fullName: `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim(),
          firstName: customer?.firstName || "",
          lastName: customer?.lastName || "",
          email: customer?.email || "",
          phone: customer?.phone || "",
          address: customer?.address || "",
          city: customer?.city || "",
          postalCode: customer?.postalCode || "",
          dateOfBirth: formatDate(customer?.dateOfBirth),
          birthNumber: customer?.nationalId || ""
        },
        father: {
          fullName: fatherFullName,
          firstName: potentialCase?.fatherFirstName || fatherParticipant?.fullName?.split(" ")[0] || "",
          lastName: potentialCase?.fatherLastName || fatherParticipant?.fullName?.split(" ").slice(1).join(" ") || "",
          email: potentialCase?.fatherEmail || fatherParticipant?.email || "",
          phone: potentialCase?.fatherPhone || potentialCase?.fatherMobile || fatherParticipant?.phone || "",
          address: potentialCase?.fatherStreet || "",
          city: potentialCase?.fatherCity || "",
          postalCode: potentialCase?.fatherPostalCode || "",
          dateOfBirth: "",
          birthNumber: ""
        },
        billing: {
          companyName: billingDetails?.companyName || "Cord Blood Center AG",
          fullName: billingDetails?.fullName || billingDetails?.companyName || "",
          ico: billingDetails?.ico || "",
          taxId: billingDetails?.taxId || billingDetails?.ico || "",
          dic: billingDetails?.dic || "",
          vatId: billingDetails?.vatNumber || "",
          vatNumber: billingDetails?.vatNumber || "",
          address: billingDetails?.address || billingDetails?.residencyStreet || "",
          city: billingDetails?.city || billingDetails?.residencyCity || "",
          postalCode: billingDetails?.postalCode || billingDetails?.residencyPostalCode || "",
          country: billingDetails?.countryCode || "",
          iban: billingDetails?.bankIban || "",
          swift: billingDetails?.bankSwift || "",
          bankName: billingDetails?.bankName || "",
          phone: billingDetails?.phone || "",
          email: billingDetails?.email || "",
          representative: "Ján Šidlík, MBA"
        },
        contract: {
          number: contract.contractNumber,
          date: new Date().toLocaleDateString("sk-SK"),
          signaturePlace: billingDetails?.city || "Bratislava",
          validFrom: contract.validFrom || "",
          validTo: contract.validTo || ""
        },
        product: {
          name: firstProduct?.name || firstProduct?.productName || "Štandard",
          description: firstProduct?.description || ""
        },
        billset: {
          totalNetAmount: totalNet.toFixed(2),
          totalVatAmount: totalVat.toFixed(2),
          totalGrossAmount: totalGross.toFixed(2),
          currency: contract.currency || "EUR"
        },
        payment: {
          installments: 2,
          depositAmount: "150",
          remainingAmount: (totalGross - 150).toFixed(2)
        }
      };
      
      let renderedHtml = template(context);
      
      // Mark selected product in the pricing table using data-product-id attribute
      if (contract.selectedProductId) {
        const filledRadio = `<span class="product-radio product-selected" style="display: inline-block; width: 14px; height: 14px; border: 2px solid #2c3e50; border-radius: 50%; background-color: #2c3e50; position: relative;"><span style="position: absolute; top: 2px; left: 2px; width: 6px; height: 6px; border-radius: 50%; background-color: white;"></span></span>`;
        
        // Find the tr with matching data-product-id and replace span.product-radio within it
        const rowRegex = new RegExp(
          `(<tr[^>]*data-product-id="${contract.selectedProductId}"[^>]*>)([\\s\\S]*?)(<\\/tr>)`,
          'g'
        );
        renderedHtml = renderedHtml.replace(rowRegex, (match, trStart, content, trEnd) => {
          // Replace the empty radio span with the filled one, preserving all other content
          const updatedContent = content.replace(
            /<span class="product-radio"[^>]*>[^<]*(<span[^>]*>[^<]*<\/span>)?<\/span>/,
            filledRadio
          );
          return trStart + updatedContent + trEnd;
        });
      }
      
      // Update rendered HTML in the database before streaming PDF
      try {
        await storage.updateContractInstance(contract.id, { renderedHtml });
      } catch (dbError) {
        console.error("Error updating contract HTML:", dbError);
        // Continue with PDF generation even if DB update fails
      }
      
      // Validate we have data before streaming
      if (!context.customer.fullName && !context.billing.companyName) {
        return res.status(400).json({ error: "Insufficient data for PDF generation" });
      }
      
      // Create PDF document with buffer collection
      const doc = new PDFDocument({ 
        margin: 40,
        size: "A4",
        bufferPages: true
      });
      
      // Collect PDF chunks in memory first
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', async () => {
        let pdfBuffer = Buffer.concat(chunks);
        
        // Add watermark if contract is cancelled
        if (contract.status === "cancelled") {
          const userLocale = getUserLocale(req.session.user?.assignedCountries || []);
          pdfBuffer = await addCancellationWatermark(pdfBuffer, contract.cancellationReason, userLocale);
        }
        
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="zmluva-${contract.contractNumber}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        res.send(pdfBuffer);
      });
      doc.on('error', (err: Error) => {
        console.error("PDF generation error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "PDF generation failed" });
        }
      });
      
      // PDF Header - use ASCII-compatible text where possible
      doc.fontSize(16).font("Helvetica-Bold").text("Zmluva o odbere", { align: "center" });
      doc.fontSize(10).font("Helvetica").text(`číslo zmluvy: ${contract.contractNumber}`, { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(8).text(
        "uzavretá podľa § 262 ods. 1 a § 269 ods. 2 zákona č. 513/1991 Zb. Obchodný zákonník",
        { align: "center" }
      );
      doc.moveDown();
      
      // Contracting parties
      doc.fontSize(10).font("Helvetica-Bold").text("medzi");
      doc.font("Helvetica").fontSize(9);
      doc.text(`${context.billing.companyName}`);
      doc.text(`so sídlom: ${context.billing.address}, ${context.billing.postalCode} ${context.billing.city}`);
      doc.text(`IČO: ${context.billing.taxId}, DIČ: ${context.billing.dic}`);
      doc.text(`IBAN: ${context.billing.iban}, SWIFT: ${context.billing.swift}`);
      doc.text('(ďalej ako spoločnosť „CBC AG")');
      doc.moveDown(0.5);
      
      doc.font("Helvetica-Bold").text("a");
      doc.font("Helvetica");
      doc.text(`pani: ${context.customer.fullName} (ďalej len „RODIČKA")`);
      doc.text(`trvale bytom: ${context.customer.address}, ${context.customer.postalCode} ${context.customer.city}`);
      doc.text(`dátum narodenia: ${context.customer.dateOfBirth}`);
      doc.text(`e-mail: ${context.customer.email}, telefón: ${context.customer.phone}`);
      
      if (context.father.fullName) {
        doc.moveDown(0.3);
        doc.text(`pán: ${context.father.fullName} (ďalej len „Otec")`);
      }
      doc.moveDown();
      
      // Article I - Preamble
      doc.font("Helvetica-Bold").fontSize(11).text("Článok I - Preambula", { align: "center" });
      doc.font("Helvetica").fontSize(9);
      doc.text("I.1 Zmluvné strany sa dohodli, že túto Zmluvu uzatvárajú podľa § 262 ods. 1 Obchodného zákonníka.", { align: "justify" });
      doc.moveDown(0.3);
      doc.text("I.2 Zmluvné strany vyhlasujú, že túto Zmluvu uzatvárajú slobodne, vážne a bez omylu.", { align: "justify" });
      doc.moveDown();
      
      // Article II - Subject
      doc.font("Helvetica-Bold").fontSize(11).text("Článok II - Predmet Zmluvy", { align: "center" });
      doc.font("Helvetica").fontSize(9);
      doc.text("II.1 Predmetom záväzku CBC AG podľa tejto Zmluvy pre RODIČKU je zabezpečenie odberu pupočníkovej a/alebo placentárnej krvi a/alebo tkaniva.", { align: "justify" });
      doc.moveDown();
      
      // Article V - Payment (abbreviated)
      doc.font("Helvetica-Bold").fontSize(11).text("Článok V - Odplata", { align: "center" });
      doc.font("Helvetica").fontSize(9);
      doc.text(`V.1 Zmluvné strany sa dohodli na nasledovnej odplate:`, { align: "justify" });
      doc.moveDown(0.3);
      
      // Price table
      const tableTop = doc.y;
      doc.font("Helvetica-Bold").fontSize(8);
      doc.text("Typ produktu", 40, tableTop, { width: 150 });
      doc.text("Celková suma", 200, tableTop, { width: 80, align: "right" });
      doc.text("Záloha", 290, tableTop, { width: 70, align: "right" });
      doc.text("Zostatok", 370, tableTop, { width: 80, align: "right" });
      
      doc.moveTo(40, tableTop + 12).lineTo(500, tableTop + 12).stroke();
      
      doc.font("Helvetica").fontSize(8);
      doc.text(context.product.name, 40, tableTop + 16, { width: 150 });
      doc.text(`${context.billset.totalGrossAmount} ${context.billset.currency}`, 200, tableTop + 16, { width: 80, align: "right" });
      doc.text(`${context.payment.depositAmount} ${context.billset.currency}`, 290, tableTop + 16, { width: 70, align: "right" });
      doc.text(`${context.payment.remainingAmount} ${context.billset.currency}`, 370, tableTop + 16, { width: 80, align: "right" });
      
      doc.y = tableTop + 40;
      doc.moveDown();
      
      // Signatures section
      doc.addPage();
      doc.font("Helvetica-Bold").fontSize(11).text("Podpisy", { align: "center" });
      doc.moveDown(2);
      
      // CBC AG signature
      doc.font("Helvetica").fontSize(9);
      doc.text(`V ${context.contract.signaturePlace} dňa ${context.contract.date}`, 40);
      doc.moveDown(3);
      doc.text("_________________________________", 40);
      doc.text("za CBC AG", 40);
      doc.text(context.billing.representative, 40);
      doc.text("(splnomocnenec)", 40);
      
      // Customer signature
      doc.text(`V _________________ dňa ${context.contract.date}`, 300, doc.y - 80);
      doc.moveDown(3);
      doc.text("_________________________________", 300);
      doc.text(context.customer.fullName, 300);
      doc.text("(RODIČKA)", 300);
      
      if (context.father.fullName) {
        doc.moveDown(2);
        doc.text("_________________________________", 300);
        doc.text(context.father.fullName, 300);
        doc.text("(Otec)", 300);
      }
      
      // Footer
      doc.fontSize(7).text("CBCAG-ZDLMO-V003", 450, 780);
      
      doc.end();
      
    } catch (error) {
      console.error("Error generating contract PDF:", error);
      res.status(500).json({ error: "Failed to generate contract PDF" });
    }
  });

  // Regenerate contract (re-render with current data)
  app.post("/api/contracts/:id/regenerate", requireAuth, async (req, res) => {
    try {
      const contract = await storage.getContractInstance(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      
      const contractTemplate = await storage.getContractTemplate(contract.templateId);
      if (!contractTemplate || !contractTemplate.contentHtml) {
        return res.status(400).json({ error: "Template has no content" });
      }
      
      const [customer, products, participants] = await Promise.all([
        storage.getCustomer(contract.customerId),
        storage.getContractInstanceProducts(contract.id),
        storage.getContractParticipants(contract.id)
      ]);
      
      // Get customer's potential case for father data
      const potentialCase = customer ? await storage.getCustomerPotentialCase(customer.id) : null;
      
      // Get billing details - first try by ID, then fallback to customer's country
      let billingDetails = contract.billingDetailsId 
        ? await storage.getBillingDetailsById(contract.billingDetailsId)
        : null;
      
      if (!billingDetails && customer?.country) {
        billingDetails = await storage.getBillingDetails(customer.country);
      }
      
      if (!billingDetails) {
        const allBillingDetails = await storage.getAllBillingDetails();
        billingDetails = allBillingDetails[0] || null;
      }
      
      const fatherParticipant = participants.find(p => p.participantType === "guarantor" || p.role === "father");
      
      let totalNet = 0, totalVat = 0, totalGross = 0;
      let firstProduct = null;
      
      for (const p of products) {
        totalNet += parseFloat(p.lineNetAmount || "0");
        totalVat += parseFloat(p.lineVatAmount || "0");
        totalGross += parseFloat(p.lineGrossAmount || "0");
        if (!firstProduct && p.productSnapshot) {
          firstProduct = JSON.parse(p.productSnapshot);
        }
      }
      
      const template = Handlebars.compile(contractTemplate.contentHtml);
      
      // Format date helper
      const formatDate = (date: Date | string | null | undefined): string => {
        if (!date) return "";
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleDateString("sk-SK");
      };
      
      // Build father name from potential case
      const fatherFullName = potentialCase?.fatherFirstName && potentialCase?.fatherLastName
        ? `${potentialCase.fatherFirstName} ${potentialCase.fatherLastName}`.trim()
        : fatherParticipant?.fullName || "";
      
      const context = {
        customer: {
          fullName: `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim(),
          firstName: customer?.firstName || "",
          lastName: customer?.lastName || "",
          email: customer?.email || "",
          phone: customer?.phone || "",
          address: customer?.address || "",
          city: customer?.city || "",
          postalCode: customer?.postalCode || "",
          dateOfBirth: formatDate(customer?.dateOfBirth),
          birthNumber: customer?.nationalId || ""
        },
        father: {
          fullName: fatherFullName,
          firstName: potentialCase?.fatherFirstName || fatherParticipant?.fullName?.split(" ")[0] || "",
          lastName: potentialCase?.fatherLastName || fatherParticipant?.fullName?.split(" ").slice(1).join(" ") || "",
          email: potentialCase?.fatherEmail || fatherParticipant?.email || "",
          phone: potentialCase?.fatherPhone || potentialCase?.fatherMobile || fatherParticipant?.phone || "",
          address: potentialCase?.fatherStreet || "",
          city: potentialCase?.fatherCity || "",
          postalCode: potentialCase?.fatherPostalCode || "",
          dateOfBirth: "",
          birthNumber: ""
        },
        billing: {
          companyName: billingDetails?.companyName || "Cord Blood Center AG",
          fullName: billingDetails?.fullName || billingDetails?.companyName || "",
          ico: billingDetails?.ico || "",
          taxId: billingDetails?.taxId || billingDetails?.ico || "",
          dic: billingDetails?.dic || "",
          vatId: billingDetails?.vatNumber || "",
          vatNumber: billingDetails?.vatNumber || "",
          address: billingDetails?.address || billingDetails?.residencyStreet || "",
          city: billingDetails?.city || billingDetails?.residencyCity || "",
          postalCode: billingDetails?.postalCode || billingDetails?.residencyPostalCode || "",
          country: billingDetails?.countryCode || "",
          fullAddress: [billingDetails?.address || billingDetails?.residencyStreet, billingDetails?.city || billingDetails?.residencyCity, billingDetails?.postalCode || billingDetails?.residencyPostalCode].filter(Boolean).join(", "),
          iban: billingDetails?.bankIban || "",
          swift: billingDetails?.bankSwift || "",
          bankName: billingDetails?.bankName || "",
          phone: billingDetails?.phone || "",
          email: billingDetails?.email || "",
          representative: "Ján Šidlík, MBA"
        },
        contract: {
          number: contract.contractNumber,
          date: new Date().toLocaleDateString("sk-SK"),
          signaturePlace: billingDetails?.city || "Bratislava"
        },
        product: {
          name: firstProduct?.name || firstProduct?.productName || "Štandard"
        },
        billset: {
          totalNetAmount: totalNet.toFixed(2),
          totalVatAmount: totalVat.toFixed(2),
          totalGrossAmount: totalGross.toFixed(2),
          currency: contract.currency || "EUR"
        },
        payment: {
          installments: 2,
          depositAmount: "150",
          remainingAmount: (totalGross - 150).toFixed(2)
        }
      };
      
      const renderedHtml = template(context);
      await storage.updateContractInstance(contract.id, { renderedHtml });
      
      res.json({ success: true, html: renderedHtml });
    } catch (error) {
      console.error("Error regenerating contract:", error);
      res.status(500).json({ error: "Failed to regenerate contract" });
    }
  });

  // Send contract for signature
  app.post("/api/contracts/:id/send", requireAuth, async (req, res) => {
    try {
      const contract = await storage.getContractInstance(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      
      const participants = await storage.getContractParticipants(contract.id);
      const signers = participants.filter(p => p.signatureRequired);
      
      if (signers.length === 0) {
        return res.status(400).json({ error: "No signers defined for this contract" });
      }
      
      const createdSignatureRequests = [];
      for (const signer of signers) {
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        const signatureRequest = await storage.createContractSignatureRequest({
          contractId: contract.id,
          participantId: signer.id,
          signerName: signer.fullName,
          signerEmail: signer.email,
          signerPhone: signer.phone,
          verificationMethod: signer.email ? "email_otp" : "sms_otp",
          otpCode,
          otpExpiresAt: expiresAt,
          status: "sent",
          requestSentAt: new Date(),
          expiresAt
        });
        createdSignatureRequests.push(signatureRequest);
        
        if (signer.email) {
          const { sendEmail } = await import("./email");
          await sendEmail({
            to: signer.email,
            subject: `Zmluva č. ${contract.contractNumber} - Žiadosť o podpis`,
            html: `
              <h2>Dobrý deň ${signer.fullName},</h2>
              <p>Bola Vám odoslaná zmluva č. <strong>${contract.contractNumber}</strong> na podpis.</p>
              <p>Váš overovací kód je: <strong style="font-size: 24px;">${otpCode}</strong></p>
              <p>Kód je platný 24 hodín.</p>
              <p>Pre podpísanie zmluvy prosím použite tento kód v systéme INDEXUS.</p>
              <br>
              <p>S pozdravom,<br>INDEXUS CRM</p>
            `
          });
        }
      }
      
      await storage.updateContractInstance(contract.id, {
        status: "sent",
        sentAt: new Date(),
        sentBy: req.session.user!.id
      });
      
      await storage.createContractAuditLog({
        contractId: contract.id,
        action: "sent",
        actorId: req.session.user!.id,
        actorType: "user",
        actorName: req.session.user!.fullName,
        actorEmail: req.session.user!.email,
        ipAddress: req.ip,
        details: JSON.stringify({ signersCount: signers.length })
      });
      
      res.json({ 
        success: true, 
        signersCount: signers.length,
        signatureRequests: createdSignatureRequests.map(sr => ({
          id: sr.id,
          signerName: sr.signerName,
          signerEmail: sr.signerEmail,
          status: sr.status
        }))
      });
    } catch (error) {
      console.error("Error sending contract:", error);
      res.status(500).json({ error: "Failed to send contract" });
    }
  });

  // Get signature requests for a contract
  app.get("/api/contracts/:id/signature-requests", requireAuth, async (req, res) => {
    try {
      const signatureRequests = await storage.getContractSignatureRequests(req.params.id);
      res.json(signatureRequests);
    } catch (error) {
      console.error("Error fetching signature requests:", error);
      res.status(500).json({ error: "Failed to fetch signature requests" });
    }
  });

  // Verify OTP for signature
  app.post("/api/contracts/:id/verify-otp", async (req, res) => {
    try {
      const { otpCode, signatureRequestId } = req.body;
      
      let signatureRequest;
      if (signatureRequestId) {
        signatureRequest = await storage.getContractSignatureRequest(signatureRequestId);
      } else {
        const requests = await storage.getContractSignatureRequests(req.params.id);
        signatureRequest = requests.find(r => r.status === "sent");
      }
      
      if (!signatureRequest) {
        return res.status(404).json({ error: "Signature request not found" });
      }
      
      if (signatureRequest.otpCode !== otpCode) {
        await storage.updateContractSignatureRequest(signatureRequest.id, {
          otpAttempts: signatureRequest.otpAttempts + 1
        });
        return res.status(400).json({ error: "Invalid OTP code" });
      }
      
      if (signatureRequest.otpExpiresAt && new Date() > signatureRequest.otpExpiresAt) {
        return res.status(400).json({ error: "OTP code has expired" });
      }
      
      await storage.updateContractSignatureRequest(signatureRequest.id, {
        status: "otp_verified",
        otpVerifiedAt: new Date()
      });
      
      await storage.createContractAuditLog({
        contractId: signatureRequest.contractId,
        action: "otp_verified",
        actorType: "customer",
        actorName: signatureRequest.signerName,
        actorEmail: signatureRequest.signerEmail,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      });
      
      res.json({ success: true, verified: true, signatureRequestId: signatureRequest.id });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  // Submit signature
  app.post("/api/contracts/:id/sign", async (req, res) => {
    try {
      const { signatureRequestId, signatureData, signatureType } = req.body;
      
      let signatureRequest;
      if (signatureRequestId) {
        signatureRequest = await storage.getContractSignatureRequest(signatureRequestId);
      } else {
        const requests = await storage.getContractSignatureRequests(req.params.id);
        signatureRequest = requests.find(r => r.status === "otp_verified");
      }
      
      if (!signatureRequest) {
        return res.status(404).json({ error: "Signature request not found" });
      }
      
      if (signatureRequest.status !== "otp_verified") {
        return res.status(400).json({ error: "OTP verification required before signing" });
      }
      
      const crypto = await import("crypto");
      const signatureHash = crypto.createHash("sha256").update(signatureData).digest("hex");
      
      await storage.updateContractSignatureRequest(signatureRequest.id, {
        status: "signed",
        signedAt: new Date(),
        signatureType: signatureType || "drawn",
        signatureData,
        signatureHash,
        signerIpAddress: req.ip,
        signerUserAgent: req.get("User-Agent")
      });
      
      await storage.updateContractParticipant(signatureRequest.participantId, {
        signedAt: new Date()
      });
      
      const allRequests = await storage.getContractSignatureRequests(signatureRequest.contractId);
      const allSigned = allRequests.every(r => r.status === "signed");
      
      if (allSigned) {
        await storage.updateContractInstance(signatureRequest.contractId, {
          status: "signed",
          signedAt: new Date()
        });
      } else {
        await storage.updateContractInstance(signatureRequest.contractId, {
          status: "pending_signature"
        });
      }
      
      await storage.createContractAuditLog({
        contractId: signatureRequest.contractId,
        action: "signed",
        actorType: "customer",
        actorName: signatureRequest.signerName,
        actorEmail: signatureRequest.signerEmail,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        details: JSON.stringify({ signatureHash, allSigned })
      });
      
      res.json({ success: true, allSigned });
    } catch (error) {
      console.error("Error submitting signature:", error);
      res.status(500).json({ error: "Failed to submit signature" });
    }
  });

  // Complete contract
  app.post("/api/contracts/:id/complete", requireAuth, async (req, res) => {
    try {
      const contract = await storage.getContractInstance(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      
      if (contract.status !== "signed") {
        return res.status(400).json({ error: "Contract must be signed before completing" });
      }
      
      await storage.updateContractInstance(contract.id, {
        status: "completed",
        completedAt: new Date()
      });
      
      await storage.createContractAuditLog({
        contractId: contract.id,
        action: "completed",
        actorId: req.session.user!.id,
        actorType: "user",
        actorName: req.session.user!.fullName,
        actorEmail: req.session.user!.email,
        ipAddress: req.ip
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error completing contract:", error);
      res.status(500).json({ error: "Failed to complete contract" });
    }
  });

  // Cancel contract
  app.post("/api/contracts/:id/cancel", requireAuth, async (req, res) => {
    try {
      const contract = await storage.getContractInstance(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      
      const { reason } = req.body;
      
      await storage.updateContractInstance(contract.id, {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: req.session.user!.id,
        cancellationReason: reason
      });
      
      await storage.createContractAuditLog({
        contractId: contract.id,
        action: "cancelled",
        actorId: req.session.user!.id,
        actorType: "user",
        actorName: req.session.user!.fullName,
        actorEmail: req.session.user!.email,
        ipAddress: req.ip,
        details: JSON.stringify({ reason })
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error cancelling contract:", error);
      res.status(500).json({ error: "Failed to cancel contract" });
    }
  });

  // Get contract audit log
  app.get("/api/contracts/:id/audit-log", requireAuth, async (req, res) => {
    try {
      const auditLog = await storage.getContractAuditLog(req.params.id);
      res.json(auditLog);
    } catch (error) {
      console.error("Error fetching contract audit log:", error);
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  // ============================================
  // VARIABLE REGISTRY ENDPOINTS
  // ============================================

  // Get full variable registry (blocks with variables and keywords)
  app.get("/api/variables/registry", requireAuth, async (req, res) => {
    try {
      const registry = await storage.getFullVariableRegistry();
      res.json(registry);
    } catch (error) {
      console.error("Error fetching variable registry:", error);
      res.status(500).json({ error: "Failed to fetch variable registry" });
    }
  });

  // Get all variable blocks
  app.get("/api/variables/blocks", requireAuth, async (req, res) => {
    try {
      const blocks = await storage.getAllVariableBlocks();
      res.json(blocks);
    } catch (error) {
      console.error("Error fetching variable blocks:", error);
      res.status(500).json({ error: "Failed to fetch variable blocks" });
    }
  });

  // Create variable block
  app.post("/api/variables/blocks", requireAuth, async (req, res) => {
    try {
      const block = await storage.createVariableBlock(req.body);
      res.json(block);
    } catch (error) {
      console.error("Error creating variable block:", error);
      res.status(500).json({ error: "Failed to create variable block" });
    }
  });

  // Update variable block
  app.patch("/api/variables/blocks/:id", requireAuth, async (req, res) => {
    try {
      const block = await storage.updateVariableBlock(req.params.id, req.body);
      if (!block) {
        return res.status(404).json({ error: "Variable block not found" });
      }
      res.json(block);
    } catch (error) {
      console.error("Error updating variable block:", error);
      res.status(500).json({ error: "Failed to update variable block" });
    }
  });

  // Get all variables
  app.get("/api/variables", requireAuth, async (req, res) => {
    try {
      const { blockId } = req.query;
      if (blockId) {
        const variables = await storage.getVariablesByBlock(blockId as string);
        res.json(variables);
      } else {
        const variables = await storage.getAllVariables();
        res.json(variables);
      }
    } catch (error) {
      console.error("Error fetching variables:", error);
      res.status(500).json({ error: "Failed to fetch variables" });
    }
  });

  // Create variable
  app.post("/api/variables", requireAuth, async (req, res) => {
    try {
      const variable = await storage.createVariable(req.body);
      res.json(variable);
    } catch (error) {
      console.error("Error creating variable:", error);
      res.status(500).json({ error: "Failed to create variable" });
    }
  });

  // Update variable
  app.patch("/api/variables/:id", requireAuth, async (req, res) => {
    try {
      const variable = await storage.updateVariable(req.params.id, req.body);
      if (!variable) {
        return res.status(404).json({ error: "Variable not found" });
      }
      res.json(variable);
    } catch (error) {
      console.error("Error updating variable:", error);
      res.status(500).json({ error: "Failed to update variable" });
    }
  });

  // Delete variable
  app.delete("/api/variables/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteVariable(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Variable not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting variable:", error);
      res.status(500).json({ error: "Failed to delete variable" });
    }
  });

  // Get keywords for a block
  app.get("/api/variables/blocks/:blockId/keywords", requireAuth, async (req, res) => {
    try {
      const keywords = await storage.getVariableKeywordsByBlock(req.params.blockId);
      res.json(keywords);
    } catch (error) {
      console.error("Error fetching keywords:", error);
      res.status(500).json({ error: "Failed to fetch keywords" });
    }
  });

  // Create keyword
  app.post("/api/variables/keywords", requireAuth, async (req, res) => {
    try {
      const keyword = await storage.createVariableKeyword(req.body);
      res.json(keyword);
    } catch (error) {
      console.error("Error creating keyword:", error);
      res.status(500).json({ error: "Failed to create keyword" });
    }
  });

  // Delete keyword
  app.delete("/api/variables/keywords/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteVariableKeyword(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Keyword not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting keyword:", error);
      res.status(500).json({ error: "Failed to delete keyword" });
    }
  });

  // Seed variable registry (for initialization)
  app.post("/api/variables/seed", requireAuth, async (req, res) => {
    try {
      const { seedVariableRegistry } = await import("./variable-registry-seed");
      await seedVariableRegistry();
      res.json({ success: true, message: "Variable registry seeded successfully" });
    } catch (error) {
      console.error("Error seeding variable registry:", error);
      res.status(500).json({ error: "Failed to seed variable registry" });
    }
  });

  // Analyze text for variable suggestions
  app.post("/api/variables/analyze", requireAuth, async (req, res) => {
    try {
      const { text, placeholder } = req.body;
      
      if (!text && !placeholder) {
        return res.status(400).json({ error: "Either text or placeholder is required" });
      }
      
      if (text && typeof text !== "string") {
        return res.status(400).json({ error: "text must be a string" });
      }
      
      if (placeholder && typeof placeholder !== "string") {
        return res.status(400).json({ error: "placeholder must be a string" });
      }
      
      const { variableRegistry } = await import("./variable-registry-service");
      
      if (text && text.trim()) {
        const analysis = await variableRegistry.analyzeText(text);
        res.json(analysis);
      } else if (placeholder && placeholder.trim()) {
        const mapping = await variableRegistry.mapPlaceholderToVariable(placeholder, "");
        res.json({
          variable: mapping.variable,
          confidence: mapping.confidence,
          method: mapping.method
        });
      } else {
        res.status(400).json({ error: "Text or placeholder cannot be empty" });
      }
    } catch (error) {
      console.error("Error analyzing text:", error);
      res.status(500).json({ error: "Failed to analyze text" });
    }
  });

  // Get variable suggestions for context
  app.post("/api/variables/suggest", requireAuth, async (req, res) => {
    try {
      const { contextText, limit = 10 } = req.body;
      
      if (contextText !== undefined && typeof contextText !== "string") {
        return res.status(400).json({ error: "contextText must be a string" });
      }
      
      const parsedLimit = typeof limit === "number" ? Math.min(Math.max(1, limit), 50) : 10;
      
      const { variableRegistry } = await import("./variable-registry-service");
      const suggestions = await variableRegistry.suggestVariablesForContext(contextText || "", parsedLimit);
      res.json(suggestions);
    } catch (error) {
      console.error("Error getting variable suggestions:", error);
      res.status(500).json({ error: "Failed to get suggestions" });
    }
  });

  // ============================================
  // SALES PIPELINE API (Pipedrive-like)
  // ============================================

  // Pipelines CRUD
  app.get("/api/pipelines", requireAuth, async (req, res) => {
    try {
      const pipelines = await storage.getAllPipelines();
      res.json(pipelines);
    } catch (error) {
      console.error("Error fetching pipelines:", error);
      res.status(500).json({ error: "Failed to fetch pipelines" });
    }
  });

  // Get all pipeline stages with their pipeline info (for AI automation configurator)
  app.get("/api/pipeline-stages", requireAuth, async (req, res) => {
    try {
      const stages = await storage.getAllPipelineStagesWithPipeline();
      res.json(stages);
    } catch (error) {
      console.error("Error fetching all pipeline stages:", error);
      res.status(500).json({ error: "Failed to fetch pipeline stages" });
    }
  });

  app.get("/api/pipelines/:id", requireAuth, async (req, res) => {
    try {
      const pipeline = await storage.getPipeline(req.params.id);
      if (!pipeline) {
        return res.status(404).json({ error: "Pipeline not found" });
      }
      res.json(pipeline);
    } catch (error) {
      console.error("Error fetching pipeline:", error);
      res.status(500).json({ error: "Failed to fetch pipeline" });
    }
  });

  app.post("/api/pipelines", requireAuth, async (req, res) => {
    try {
      const id = `pipeline_${Date.now()}`;
      const pipeline = await storage.createPipeline({ ...req.body, id });
      res.status(201).json(pipeline);
    } catch (error) {
      console.error("Error creating pipeline:", error);
      res.status(500).json({ error: "Failed to create pipeline" });
    }
  });

  app.patch("/api/pipelines/:id", requireAuth, async (req, res) => {
    try {
      const pipeline = await storage.updatePipeline(req.params.id, req.body);
      if (!pipeline) {
        return res.status(404).json({ error: "Pipeline not found" });
      }
      res.json(pipeline);
    } catch (error) {
      console.error("Error updating pipeline:", error);
      res.status(500).json({ error: "Failed to update pipeline" });
    }
  });

  app.delete("/api/pipelines/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deletePipeline(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Pipeline not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting pipeline:", error);
      res.status(500).json({ error: "Failed to delete pipeline" });
    }
  });

  // Pipeline Stages CRUD
  app.get("/api/pipelines/:pipelineId/stages", requireAuth, async (req, res) => {
    try {
      const stages = await storage.getPipelineStages(req.params.pipelineId);
      res.json(stages);
    } catch (error) {
      console.error("Error fetching pipeline stages:", error);
      res.status(500).json({ error: "Failed to fetch stages" });
    }
  });

  app.post("/api/pipelines/:pipelineId/stages", requireAuth, async (req, res) => {
    try {
      const id = `stage_${Date.now()}`;
      const stage = await storage.createPipelineStage({
        ...req.body,
        id,
        pipelineId: req.params.pipelineId,
      });
      res.status(201).json(stage);
    } catch (error) {
      console.error("Error creating stage:", error);
      res.status(500).json({ error: "Failed to create stage" });
    }
  });

  app.patch("/api/stages/:id", requireAuth, async (req, res) => {
    try {
      const stage = await storage.updatePipelineStage(req.params.id, req.body);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }
      res.json(stage);
    } catch (error) {
      console.error("Error updating stage:", error);
      res.status(500).json({ error: "Failed to update stage" });
    }
  });

  app.delete("/api/stages/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deletePipelineStage(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Stage not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting stage:", error);
      res.status(500).json({ error: "Failed to delete stage" });
    }
  });

  app.post("/api/pipelines/:pipelineId/stages/reorder", requireAuth, async (req, res) => {
    try {
      const { orderedIds } = req.body;
      await storage.reorderPipelineStages(req.params.pipelineId, orderedIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering stages:", error);
      res.status(500).json({ error: "Failed to reorder stages" });
    }
  });

  // Deals CRUD
  app.get("/api/deals", requireAuth, async (req, res) => {
    try {
      const { pipelineId, stageId } = req.query;
      let deals;
      if (pipelineId) {
        deals = await storage.getDealsByPipeline(pipelineId as string);
      } else if (stageId) {
        deals = await storage.getDealsByStage(stageId as string);
      } else {
        deals = await storage.getAllDeals();
      }
      res.json(deals);
    } catch (error) {
      console.error("Error fetching deals:", error);
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });

  app.get("/api/deals/:id", requireAuth, async (req, res) => {
    try {
      const deal = await storage.getDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error) {
      console.error("Error fetching deal:", error);
      res.status(500).json({ error: "Failed to fetch deal" });
    }
  });

  app.post("/api/deals", requireAuth, async (req, res) => {
    try {
      const id = `deal_${Date.now()}`;
      const deal = await storage.createDeal({ ...req.body, id });
      
      // Trigger automations for deal_created
      triggerAutomations("deal_created", deal, req.session?.user?.id).catch(err => 
        console.error("Automation trigger error:", err)
      );
      
      res.status(201).json(deal);
    } catch (error) {
      console.error("Error creating deal:", error);
      res.status(500).json({ error: "Failed to create deal" });
    }
  });

  app.patch("/api/deals/:id", requireAuth, async (req, res) => {
    try {
      const deal = await storage.updateDeal(req.params.id, req.body);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error) {
      console.error("Error updating deal:", error);
      res.status(500).json({ error: "Failed to update deal" });
    }
  });

  app.patch("/api/deals/:id/stage", requireAuth, async (req, res) => {
    try {
      const { stageId } = req.body;
      const oldDeal = await storage.getDeal(req.params.id);
      const deal = await storage.moveDealToStage(req.params.id, stageId);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      
      // Log activity for pipeline stage change (linked to customer)
      if (deal.customerId) {
        // Get stage names for readable logging
        const fromStage = oldDeal?.stageId ? await storage.getPipelineStage(oldDeal.stageId) : null;
        const toStage = await storage.getPipelineStage(stageId);
        
        await logActivity(
          req.session?.user?.id || "system",
          "pipeline_move",
          "customer",
          deal.customerId,
          deal.title,
          {
            dealId: deal.id,
            dealTitle: deal.title,
            fromStageId: oldDeal?.stageId,
            fromStageName: fromStage?.name || "Neznámy",
            toStageId: stageId,
            toStageName: toStage?.name || "Neznámy",
            pipelineId: deal.pipelineId,
          }
        );
      }
      
      // Trigger automations for stage_changed
      triggerAutomations("stage_changed", deal, req.session?.user?.id, {
        fromStageId: oldDeal?.stageId,
        toStageId: stageId
      }).catch(err => console.error("Automation trigger error:", err));
      
      res.json(deal);
    } catch (error) {
      console.error("Error moving deal:", error);
      res.status(500).json({ error: "Failed to move deal" });
    }
  });

  app.delete("/api/deals/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteDeal(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting deal:", error);
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });

  // Deal Activities CRUD
  app.get("/api/deals/:dealId/activities", requireAuth, async (req, res) => {
    try {
      const activities = await storage.getDealActivities(req.params.dealId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching deal activities:", error);
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  app.post("/api/deals/:dealId/activities", requireAuth, async (req, res) => {
    try {
      const id = `activity_${Date.now()}`;
      const { dueAt, reminderAt, ...rest } = req.body;
      const activity = await storage.createDealActivity({
        ...rest,
        id,
        dealId: req.params.dealId,
        dueAt: dueAt ? new Date(dueAt) : null,
        reminderAt: reminderAt ? new Date(reminderAt) : null,
      });
      res.status(201).json(activity);
    } catch (error) {
      console.error("Error creating activity:", error);
      res.status(500).json({ error: "Failed to create activity" });
    }
  });

  app.patch("/api/activities/:id", requireAuth, async (req, res) => {
    try {
      const activity = await storage.updateDealActivity(req.params.id, req.body);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.json(activity);
    } catch (error) {
      console.error("Error updating activity:", error);
      res.status(500).json({ error: "Failed to update activity" });
    }
  });

  app.patch("/api/activities/:id/complete", requireAuth, async (req, res) => {
    try {
      const activity = await storage.completeDealActivity(req.params.id);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.json(activity);
    } catch (error) {
      console.error("Error completing activity:", error);
      res.status(500).json({ error: "Failed to complete activity" });
    }
  });

  app.delete("/api/activities/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteDealActivity(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting activity:", error);
      res.status(500).json({ error: "Failed to delete activity" });
    }
  });

  // Get full pipeline with stages and deals (for Kanban view)
  app.get("/api/pipelines/:id/kanban", requireAuth, async (req, res) => {
    try {
      const pipeline = await storage.getPipeline(req.params.id);
      if (!pipeline) {
        return res.status(404).json({ error: "Pipeline not found" });
      }
      const stages = await storage.getPipelineStages(req.params.id);
      const deals = await storage.getDealsByPipeline(req.params.id);
      
      // Group deals by stage
      const stagesWithDeals = stages.map(stage => ({
        ...stage,
        deals: deals.filter(d => d.stageId === stage.id),
      }));
      
      res.json({
        pipeline,
        stages: stagesWithDeals,
      });
    } catch (error) {
      console.error("Error fetching kanban data:", error);
      res.status(500).json({ error: "Failed to fetch kanban data" });
    }
  });

  // Initialize default pipeline with stages (for first run)
  app.post("/api/pipelines/seed-default", requireAuth, async (req, res) => {
    try {
      const existingPipelines = await storage.getAllPipelines();
      if (existingPipelines.length > 0) {
        return res.json({ message: "Pipelines already exist", pipelines: existingPipelines });
      }

      const pipelineId = `pipeline_${Date.now()}`;
      const pipeline = await storage.createPipeline({
        id: pipelineId,
        name: "Hlavný predajný proces",
        description: "Štandardný predajný proces pre cord blood služby",
        countryCodes: ["SK", "CZ", "HU"],
        isDefault: true,
        isActive: true,
      });

      const defaultStages = [
        { name: "Lead", color: "#6b7280", probability: 10 },
        { name: "Kvalifikovaný", color: "#3b82f6", probability: 25 },
        { name: "Návrh", color: "#8b5cf6", probability: 50 },
        { name: "Vyjednávanie", color: "#f59e0b", probability: 75 },
        { name: "Vyhraný", color: "#22c55e", probability: 100, isWonStage: true },
        { name: "Stratený", color: "#ef4444", probability: 0, isLostStage: true },
      ];

      const createdStages = [];
      for (let i = 0; i < defaultStages.length; i++) {
        const stage = await storage.createPipelineStage({
          id: `stage_${Date.now()}_${i}`,
          pipelineId,
          name: defaultStages[i].name,
          color: defaultStages[i].color,
          order: i,
          probability: defaultStages[i].probability,
          isWonStage: defaultStages[i].isWonStage || false,
          isLostStage: defaultStages[i].isLostStage || false,
        });
        createdStages.push(stage);
      }

      res.status(201).json({ pipeline, stages: createdStages });
    } catch (error) {
      console.error("Error seeding default pipeline:", error);
      res.status(500).json({ error: "Failed to seed default pipeline" });
    }
  });

  // Deal Products
  app.get("/api/deals/:dealId/products", requireAuth, async (req, res) => {
    try {
      const products = await storage.getDealProducts(req.params.dealId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching deal products:", error);
      res.status(500).json({ error: "Failed to fetch deal products" });
    }
  });

  app.post("/api/deals/:dealId/products", requireAuth, async (req, res) => {
    try {
      const product = await storage.addDealProduct({
        ...req.body,
        dealId: req.params.dealId,
      });
      res.status(201).json(product);
    } catch (error) {
      console.error("Error adding deal product:", error);
      res.status(500).json({ error: "Failed to add deal product" });
    }
  });

  app.delete("/api/deal-products/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.removeDealProduct(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Deal product not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error removing deal product:", error);
      res.status(500).json({ error: "Failed to remove deal product" });
    }
  });

  // Automation: Create deal from campaign
  app.post("/api/campaigns/:campaignId/create-deal", requireAuth, async (req, res) => {
    try {
      const { contactId, customerId } = req.body;
      if (!customerId) {
        return res.status(400).json({ error: "Customer ID is required" });
      }
      const deal = await storage.createDealFromCampaign(req.params.campaignId, contactId, customerId);
      if (!deal) {
        return res.status(400).json({ error: "Failed to create deal - missing pipeline or stages" });
      }
      res.status(201).json(deal);
    } catch (error) {
      console.error("Error creating deal from campaign:", error);
      res.status(500).json({ error: "Failed to create deal from campaign" });
    }
  });

  // Automation: Handle deal won (create contract + invoice)
  app.post("/api/deals/:dealId/process-won", requireAuth, async (req, res) => {
    try {
      const result = await storage.handleDealWon(req.params.dealId);
      if (!result) {
        return res.status(400).json({ error: "Deal not found or not in won status" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error processing won deal:", error);
      res.status(500).json({ error: "Failed to process won deal" });
    }
  });

  // Automation Rules
  app.get("/api/pipelines/:pipelineId/automations", requireAuth, async (req, res) => {
    try {
      const rules = await storage.getAutomationRules(req.params.pipelineId);
      res.json(rules);
    } catch (error) {
      console.error("Error fetching automation rules:", error);
      res.status(500).json({ error: "Failed to fetch automation rules" });
    }
  });

  app.get("/api/automations/:id", requireAuth, async (req, res) => {
    try {
      const rule = await storage.getAutomationRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Automation rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Error fetching automation rule:", error);
      res.status(500).json({ error: "Failed to fetch automation rule" });
    }
  });

  app.post("/api/pipelines/:pipelineId/automations", requireAuth, async (req, res) => {
    try {
      const rule = await storage.createAutomationRule({
        ...req.body,
        id: `auto_${Date.now()}`,
        pipelineId: req.params.pipelineId,
        createdBy: (req.user as any)?.id,
      });
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating automation rule:", error);
      res.status(500).json({ error: "Failed to create automation rule" });
    }
  });

  app.patch("/api/automations/:id", requireAuth, async (req, res) => {
    try {
      const rule = await storage.updateAutomationRule(req.params.id, req.body);
      if (!rule) {
        return res.status(404).json({ error: "Automation rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Error updating automation rule:", error);
      res.status(500).json({ error: "Failed to update automation rule" });
    }
  });

  app.patch("/api/automations/:id/toggle", requireAuth, async (req, res) => {
    try {
      const { isActive } = req.body;
      const rule = await storage.toggleAutomationRule(req.params.id, isActive);
      if (!rule) {
        return res.status(404).json({ error: "Automation rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Error toggling automation rule:", error);
      res.status(500).json({ error: "Failed to toggle automation rule" });
    }
  });

  app.delete("/api/automations/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteAutomationRule(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Automation rule not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting automation rule:", error);
      res.status(500).json({ error: "Failed to delete automation rule" });
    }
  });

  // Execute automation rule manually (test run)
  app.post("/api/automations/:id/execute", requireAuth, async (req, res) => {
    try {
      const { dealId } = req.body;
      if (!dealId) {
        return res.status(400).json({ error: "dealId is required" });
      }

      const rule = await storage.getAutomationRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Automation rule not found" });
      }

      const deal = await storage.getDeal(dealId);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }

      // Execute the action
      const result = await executeAutomationAction(rule, deal, req.session?.user?.id);
      
      // Update execution count
      await storage.updateAutomationRule(rule.id, {
        executionCount: (rule.executionCount || 0) + 1,
        lastExecutedAt: new Date(),
      });

      res.json({ success: true, result });
    } catch (error) {
      console.error("Error executing automation rule:", error);
      res.status(500).json({ error: "Failed to execute automation rule" });
    }
  });

  // NEXUS AI Assistant endpoint
  app.post("/api/nexus/query", requireAuth, async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== "string" || query.length > 2000) {
        return res.status(400).json({ error: "Query is required (max 2000 characters)" });
      }

      const user = req.session?.user;
      if (!user?.nexusEnabled) {
        return res.status(403).json({ error: "NEXUS is not enabled for this user" });
      }

      // Check for OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({ error: "AI service is not configured" });
      }

      // Role-based data access control
      const isAdmin = user.role === "admin";
      const isManager = user.role === "manager" || isAdmin;
      const userCountries = user.assignedCountries || [];

      // Gather system context from database with role-based filtering
      const [
        allUsers,
        allCustomers,
        activityLogs,
        campaigns,
        notifications
      ] = await Promise.all([
        isAdmin ? storage.getAllUsers() : Promise.resolve([]),
        storage.getAllCustomers(),
        isManager ? storage.getAllActivityLogs(50) : Promise.resolve([]),
        storage.getAllCampaigns(),
        storage.getNotifications(user.id, { limit: 20 })
      ]);

      // Filter customers by user's assigned countries (unless admin)
      const accessibleCustomers = isAdmin 
        ? allCustomers 
        : allCustomers.filter((c: any) => userCountries.includes(c.country));

      // Filter campaigns by user's assigned countries (unless admin)
      const accessibleCampaigns = isAdmin
        ? campaigns
        : campaigns.filter((c: any) => !c.countryCode || userCountries.includes(c.countryCode));

      // Build context summary (anonymized/aggregated data only)
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      
      const todayLogins = activityLogs.filter((log: any) => 
        log.action === "user_login" && 
        log.createdAt && 
        new Date(log.createdAt).toISOString().split("T")[0] === today
      );

      // Build role-appropriate context
      let userContext = "";
      if (isAdmin) {
        userContext = `\nUSERS (${allUsers.length} total):
${allUsers.map((u: any) => `- ${u.fullName} (${u.role}, ${u.isActive ? "active" : "inactive"})`).join("\n")}`;
      }

      let activityContext = "";
      if (isManager) {
        activityContext = `\nTODAY'S LOGINS: ${todayLogins.length}
RECENT ACTIVITY (last 50 events):
${activityLogs.slice(0, 15).map((log: any) => `- [${log.action}] ${log.details || ""} (${new Date(log.createdAt).toLocaleString()})`).join("\n")}`;
      }

      const systemContext = `
INDEXUS CRM Data Summary (as of ${now.toLocaleString()}):
Your role: ${user.role}
Your assigned countries: ${userCountries.join(", ") || "all"}
${userContext}
${activityContext}
CUSTOMERS (${accessibleCustomers.length} accessible):
- By country: ${Object.entries(accessibleCustomers.reduce((acc: any, c: any) => { acc[c.country] = (acc[c.country] || 0) + 1; return acc; }, {})).map(([k, v]) => `${k}: ${v}`).join(", ") || "none"}
- By status: ${Object.entries(accessibleCustomers.reduce((acc: any, c: any) => { acc[c.status || "unknown"] = (acc[c.status || "unknown"] || 0) + 1; return acc; }, {})).map(([k, v]) => `${k}: ${v}`).join(", ") || "none"}

CAMPAIGNS (${accessibleCampaigns.length} accessible):
${accessibleCampaigns.slice(0, 10).map((c: any) => `- ${c.name} (${c.status || "draft"})`).join("\n") || "No campaigns"}

YOUR NOTIFICATIONS (${notifications.length}):
${notifications.slice(0, 5).map((n: any) => `- ${n.title}`).join("\n") || "No notifications"}

Note: Data access is limited based on your role and assigned countries.
`;

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are NEXUS, an intelligent AI assistant for the INDEXUS CRM system. You help users understand their data based on their role and permissions.

Your capabilities:
- Answer questions about system data in any language
- Provide summaries and statistics
- Analyze trends and patterns
- Respond in the same language the user asks in

Current system context:
${systemContext}

Guidelines:
- Be helpful, accurate, and concise
- Format data clearly
- If you don't have enough information, say so
- Never reveal sensitive personal data (emails, phone numbers, addresses)
- For statistical questions, calculate from the provided aggregated data
- If asked about data outside user's access scope, politely explain the limitation`
          },
          {
            role: "user",
            content: query
          }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || "I could not generate a response.";
      
      // Log NEXUS usage for audit
      console.log(`[NEXUS] Query from user ${user.username}: "${query.substring(0, 100)}..."`);
      
      res.json({ response });
    } catch (error: any) {
      console.error("NEXUS query error:", error?.message || error);
      if (error?.status === 401) {
        return res.status(503).json({ error: "AI service authentication failed. Please check API key." });
      }
      if (error?.status === 429) {
        return res.status(503).json({ error: "AI service rate limit exceeded. Please try again later." });
      }
      res.status(500).json({ error: "Failed to process query. Please try again." });
    }
  });

  return httpServer;
}

// Helper function to apply customer criteria
interface CriteriaCondition {
  id: string;
  field: string;
  operator: string;
  value: string | string[];
}

interface CriteriaGroup {
  id: string;
  logic: "AND" | "OR";
  conditions: CriteriaCondition[];
}

function evaluateCondition(customer: Customer, condition: CriteriaCondition): boolean {
  const value = customer[condition.field as keyof Customer];
  const condValue = condition.value;
  
  switch (condition.operator) {
    case "equals":
      return String(value || "") === String(condValue);
    case "notEquals":
      return String(value || "") !== String(condValue);
    case "contains":
      return String(value || "").toLowerCase().includes(String(condValue).toLowerCase());
    case "startsWith":
      return String(value || "").toLowerCase().startsWith(String(condValue).toLowerCase());
    case "endsWith":
      return String(value || "").toLowerCase().endsWith(String(condValue).toLowerCase());
    case "in":
      const inValues = Array.isArray(condValue) ? condValue : String(condValue).split(",").map(s => s.trim());
      return inValues.includes(String(value || ""));
    case "notIn":
      const notInValues = Array.isArray(condValue) ? condValue : String(condValue).split(",").map(s => s.trim());
      return !notInValues.includes(String(value || ""));
    default:
      return true;
  }
}

function evaluateGroup(customer: Customer, group: CriteriaGroup): boolean {
  if (group.conditions.length === 0) return true;
  
  if (group.logic === "AND") {
    return group.conditions.every(cond => evaluateCondition(customer, cond));
  } else {
    return group.conditions.some(cond => evaluateCondition(customer, cond));
  }
}

function applyCustomerCriteria(customers: Customer[], criteria: CriteriaGroup[]): Customer[] {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    return customers;
  }
  
  return customers.filter(customer => {
    return criteria.every(group => evaluateGroup(customer, group));
  });
}

// Automation execution engine
async function executeAutomationAction(
  rule: any,
  deal: any,
  userId?: string
): Promise<{ action: string; details: string }> {
  const actionConfig = rule.actionConfig || {};
  
  switch (rule.actionType) {
    case "create_activity": {
      const activityType = actionConfig.activityType || "task";
      const subject = actionConfig.activitySubject || "Automatická úloha";
      const dueInDays = actionConfig.dueDays || 1;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueInDays);
      
      await storage.createDealActivity({
        dealId: deal.id,
        type: activityType,
        subject,
        dueDate,
        completed: false,
        createdBy: userId,
      });
      return { action: "create_activity", details: `Vytvorená aktivita: ${subject}` };
    }

    case "send_email": {
      const emailSubject = actionConfig.emailSubject || "Automatický email";
      const emailBody = actionConfig.emailBody || "";
      // In production, this would send actual email via SendGrid/etc
      console.log(`[Automation] Would send email to deal ${deal.id}: ${emailSubject}`);
      return { action: "send_email", details: `Email pripravený: ${emailSubject}` };
    }

    case "assign_owner": {
      const assignUserId = actionConfig.assignUserId;
      if (assignUserId) {
        await storage.updateDeal(deal.id, { ownerId: assignUserId });
        return { action: "assign_owner", details: `Deal priradený používateľovi ${assignUserId}` };
      }
      return { action: "assign_owner", details: "Nebolo možné priradiť - chýba používateľ" };
    }

    case "update_deal": {
      const updateField = actionConfig.updateField;
      const updateValue = actionConfig.updateValue;
      if (updateField && updateValue) {
        const updateData: Record<string, any> = {};
        if (updateField === "probability") {
          updateData[updateField] = parseInt(updateValue);
        } else {
          updateData[updateField] = updateValue;
        }
        await storage.updateDeal(deal.id, updateData);
        return { action: "update_deal", details: `Aktualizované pole ${updateField} na ${updateValue}` };
      }
      return { action: "update_deal", details: "Nebolo možné aktualizovať - chýba konfigurácia" };
    }

    case "move_stage": {
      const targetStageId = actionConfig.targetStageId;
      if (targetStageId) {
        await storage.updateDeal(deal.id, { stageId: targetStageId });
        return { action: "move_stage", details: `Deal presunutý do fázy ${targetStageId}` };
      }
      return { action: "move_stage", details: "Nebolo možné presunúť - chýba cieľová fáza" };
    }

    case "add_note": {
      const noteText = actionConfig.noteText || "Automatická poznámka";
      await storage.createDealNote({
        dealId: deal.id,
        content: noteText,
        createdBy: userId,
      });
      return { action: "add_note", details: `Pridaná poznámka: ${noteText.substring(0, 50)}...` };
    }

    default:
      return { action: rule.actionType, details: "Neznámy typ akcie" };
  }
}

// Trigger automations based on event type
async function triggerAutomations(
  triggerType: string,
  deal: any,
  userId?: string,
  context?: { fromStageId?: string; toStageId?: string }
): Promise<void> {
  try {
    // Get pipeline from deal's stage
    const stage = await storage.getPipelineStage(deal.stageId);
    if (!stage) return;

    // Get all active automation rules for this pipeline
    const rules = await storage.getAutomationRules(stage.pipelineId);
    const activeRules = rules.filter(r => r.isActive && r.triggerType === triggerType);

    for (const rule of activeRules) {
      let shouldTrigger = true;

      // Check trigger conditions for stage_changed
      if (triggerType === "stage_changed" && context) {
        const triggerConfig = rule.triggerConfig || {};
        if (triggerConfig.fromStageId && triggerConfig.fromStageId !== context.fromStageId) {
          shouldTrigger = false;
        }
        if (triggerConfig.toStageId && triggerConfig.toStageId !== context.toStageId) {
          shouldTrigger = false;
        }
      }

      if (shouldTrigger) {
        console.log(`[Automation] Triggering rule "${rule.name}" for deal ${deal.id}`);
        await executeAutomationAction(rule, deal, userId);
        await storage.updateAutomationRule(rule.id, {
          executionCount: (rule.executionCount || 0) + 1,
          lastExecutedAt: new Date(),
        });
      }
    }
  } catch (error) {
    console.error("Error triggering automations:", error);
  }
}

// Trigger automations for customer updates
async function triggerCustomerAutomations(
  customer: any,
  changedFields: string[],
  oldCustomer: any,
  userId?: string
): Promise<void> {
  try {
    // Get all pipelines and their automation rules
    const pipelines = await storage.getAllPipelines();
    
    for (const pipeline of pipelines) {
      const rules = await storage.getAutomationRules(pipeline.id);
      const customerRules = rules.filter(r => r.isActive && r.triggerType === "customer_updated");
      
      for (const rule of customerRules) {
        const triggerConfig = rule.triggerConfig || {} as any;
        const trackedFields = triggerConfig.trackedFields || [];
        
        // Check if any tracked field was changed
        const matchingFields = changedFields.filter(f => trackedFields.includes(f));
        
        if (matchingFields.length > 0) {
          // Check specific value conditions if configured
          let valueConditionsMet = true;
          
          // Check status value condition
          if (matchingFields.includes("status") && triggerConfig.statusValue && triggerConfig.statusValue !== "any") {
            if (customer.status !== triggerConfig.statusValue) {
              valueConditionsMet = false;
              console.log(`[Automation] Rule "${rule.name}" skipped: status "${customer.status}" does not match required "${triggerConfig.statusValue}"`);
            }
          }
          
          // Check clientStatus value condition
          if (matchingFields.includes("clientStatus") && triggerConfig.clientStatusValue && triggerConfig.clientStatusValue !== "any") {
            if (customer.clientStatus !== triggerConfig.clientStatusValue) {
              valueConditionsMet = false;
              console.log(`[Automation] Rule "${rule.name}" skipped: clientStatus "${customer.clientStatus}" does not match required "${triggerConfig.clientStatusValue}"`);
            }
          }
          
          // Check leadScore range condition
          if (matchingFields.includes("leadScore") && triggerConfig.leadScoreRange && triggerConfig.leadScoreRange !== "any") {
            const score = customer.leadScore || 0;
            const [minStr, maxStr] = triggerConfig.leadScoreRange.split("-");
            const min = parseInt(minStr, 10);
            const max = parseInt(maxStr, 10);
            if (score < min || score > max) {
              valueConditionsMet = false;
              console.log(`[Automation] Rule "${rule.name}" skipped: leadScore ${score} not in range ${min}-${max}`);
            }
          }
          
          if (valueConditionsMet) {
            console.log(`[Automation] Customer rule "${rule.name}" triggered by fields: ${matchingFields.join(", ")}`);
            
            // Execute the action with customer context
            await executeCustomerAutomationAction(rule, customer, pipeline, userId);
            await storage.updateAutomationRule(rule.id, {
              executionCount: (rule.executionCount || 0) + 1,
              lastExecutedAt: new Date(),
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Error triggering customer automations:", error);
  }
}

// Execute automation action for customer-triggered automations
async function executeCustomerAutomationAction(
  rule: any,
  customer: any,
  pipeline: any,
  userId?: string
): Promise<{ action: string; details: string }> {
  const actionConfig = rule.actionConfig || {};
  
  switch (rule.actionType) {
    case "create_deal": {
      const stageId = actionConfig.dealStageId;
      if (!stageId) {
        return { action: "create_deal", details: "Chýba cieľová fáza pre deal" };
      }
      
      // Get stage to find pipelineId
      const stage = await storage.getPipelineStage(stageId);
      if (!stage) {
        return { action: "create_deal", details: "Fáza nebola nájdená" };
      }
      
      // Create deal title from template
      let dealTitle = actionConfig.dealTitle || "{customer_name} - Konverzia";
      dealTitle = dealTitle.replace("{customer_name}", `${customer.firstName} ${customer.lastName}`);
      
      const dealId = `deal_${Date.now()}`;
      await storage.createDeal({
        id: dealId,
        title: dealTitle,
        pipelineId: stage.pipelineId,
        stageId: stageId,
        customerId: customer.id,
        countryCode: customer.country || "SK",
        source: "automation",
        assignedUserId: userId,
      });
      
      return { 
        action: "create_deal", 
        details: `Vytvorený deal "${dealTitle}" pre zákazníka ${customer.firstName} ${customer.lastName}` 
      };
    }
    
    case "add_note": {
      return { action: "add_note", details: "Poznámka pridaná (vyžaduje existujúci deal)" };
    }
    
    default:
      return { action: rule.actionType, details: "Akcia nie je podporovaná pre zákazníkov" };
  }
}
