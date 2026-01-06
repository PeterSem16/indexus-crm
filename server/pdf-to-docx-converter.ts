import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

export interface ConversionResult {
  success: boolean;
  docxPath?: string;
  error?: string;
  originalPdfPath: string;
  converter?: string;
}

export async function convertPdfToDocx(pdfPath: string, outputDir: string): Promise<ConversionResult> {
  try {
    console.log(`[pdf2docx] Starting PDF to DOCX conversion: ${pdfPath}`);

    if (!fs.existsSync(pdfPath)) {
      return {
        success: false,
        error: `Zdrojový PDF súbor neexistuje: ${pdfPath}`,
        originalPdfPath: pdfPath
      };
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const pdfBasename = path.basename(pdfPath, path.extname(pdfPath));
    const docxPath = path.join(outputDir, `${pdfBasename}_converted.docx`);

    const scriptPath = path.join(process.cwd(), "server", "convert-pdf-to-docx.py");
    
    if (!fs.existsSync(scriptPath)) {
      return {
        success: false,
        error: "Konverzný skript nebol nájdený",
        originalPdfPath: pdfPath
      };
    }

    const command = `python3 "${scriptPath}" "${pdfPath}" "${docxPath}"`;
    
    console.log(`[pdf2docx] Running command: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 180000,
        env: process.env
      });
      
      if (stdout) console.log(`[pdf2docx] stdout: ${stdout}`);
      if (stderr) console.log(`[pdf2docx] stderr: ${stderr}`);
      
      if (stdout.includes("ERROR:")) {
        const errorMatch = stdout.match(/ERROR: (.+)/);
        return {
          success: false,
          error: errorMatch ? errorMatch[1] : "Neznáma chyba pri konverzii",
          originalPdfPath: pdfPath
        };
      }
      
    } catch (execError: any) {
      console.error(`[pdf2docx] Exec error:`, execError);
      
      return {
        success: false,
        error: `Chyba pri konverzii: ${execError.message || "Neznáma chyba"}`,
        originalPdfPath: pdfPath
      };
    }

    if (!fs.existsSync(docxPath)) {
      return {
        success: false,
        error: "Konverzia zlyhala - výstupný DOCX súbor nebol vytvorený",
        originalPdfPath: pdfPath
      };
    }

    console.log(`[pdf2docx] Conversion successful: ${docxPath}`);

    return {
      success: true,
      docxPath,
      originalPdfPath: pdfPath,
      converter: "pdf2docx"
    };

  } catch (err: any) {
    console.error("[pdf2docx] Conversion error:", err);

    return {
      success: false,
      error: err.message || "Neznáma chyba pri konverzii PDF na DOCX",
      originalPdfPath: pdfPath
    };
  }
}

export async function isConverterAvailable(): Promise<{ available: boolean; converter?: string }> {
  try {
    await execAsync("python3 -c 'from pdf2docx import Converter; print(\"OK\")'", { timeout: 10000 });
    return { available: true, converter: "pdf2docx" };
  } catch {
    return { available: false };
  }
}
