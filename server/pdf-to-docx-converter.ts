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

async function findLibreOffice(): Promise<string | null> {
  const possiblePaths = [
    "soffice",
    "libreoffice",
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "/usr/local/bin/soffice",
    "/usr/local/bin/libreoffice",
    "/nix/store/*/bin/soffice",
  ];

  for (const cmdPath of possiblePaths) {
    try {
      await execAsync(`which ${cmdPath.split("/").pop()}`);
      return cmdPath.split("/").pop()!;
    } catch {
      if (cmdPath.startsWith("/") && fs.existsSync(cmdPath)) {
        return cmdPath;
      }
    }
  }

  try {
    await execAsync("soffice --version");
    return "soffice";
  } catch {
    try {
      await execAsync("libreoffice --version");
      return "libreoffice";
    } catch {
      return null;
    }
  }
}

export async function convertPdfToDocx(pdfPath: string, outputDir: string): Promise<ConversionResult> {
  try {
    console.log(`[LibreOffice] Starting PDF to DOCX conversion: ${pdfPath}`);

    const libreOfficePath = await findLibreOffice();
    if (!libreOfficePath) {
      return {
        success: false,
        error: "LibreOffice nie je nainštalovaný. Konverzia PDF na DOCX nie je dostupná.",
        originalPdfPath: pdfPath
      };
    }

    console.log(`[LibreOffice] Found at: ${libreOfficePath}`);

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

    const tempDir = path.join(outputDir, `temp_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const command = `${libreOfficePath} --headless --convert-to docx --outdir "${tempDir}" "${pdfPath}"`;
    
    console.log(`[LibreOffice] Running command: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 120000,
        env: {
          ...process.env,
          HOME: tempDir
        }
      });
      
      if (stdout) console.log(`[LibreOffice] stdout: ${stdout}`);
      if (stderr) console.log(`[LibreOffice] stderr: ${stderr}`);
    } catch (execError: any) {
      console.error(`[LibreOffice] Exec error:`, execError);
      
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      
      return {
        success: false,
        error: `Chyba pri konverzii: ${execError.message || "Neznáma chyba"}`,
        originalPdfPath: pdfPath
      };
    }

    const pdfBasename = path.basename(pdfPath, path.extname(pdfPath));
    const tempDocxPath = path.join(tempDir, `${pdfBasename}.docx`);
    
    if (!fs.existsSync(tempDocxPath)) {
      const files = fs.readdirSync(tempDir);
      console.log(`[LibreOffice] Files in temp dir: ${files.join(", ")}`);
      
      const docxFile = files.find(f => f.endsWith(".docx"));
      if (docxFile) {
        const actualTempPath = path.join(tempDir, docxFile);
        const finalDocxPath = path.join(outputDir, `${pdfBasename}_converted.docx`);
        fs.renameSync(actualTempPath, finalDocxPath);
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        console.log(`[LibreOffice] Conversion successful: ${finalDocxPath}`);
        
        return {
          success: true,
          docxPath: finalDocxPath,
          originalPdfPath: pdfPath,
          converter: "libreoffice"
        };
      }
      
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return {
        success: false,
        error: "Konverzia zlyhala - výstupný DOCX súbor nebol vytvorený",
        originalPdfPath: pdfPath
      };
    }

    const finalDocxPath = path.join(outputDir, `${pdfBasename}_converted.docx`);
    fs.renameSync(tempDocxPath, finalDocxPath);
    fs.rmSync(tempDir, { recursive: true, force: true });

    console.log(`[LibreOffice] Conversion successful: ${finalDocxPath}`);

    return {
      success: true,
      docxPath: finalDocxPath,
      originalPdfPath: pdfPath,
      converter: "libreoffice"
    };

  } catch (err: any) {
    console.error("[LibreOffice] Conversion error:", err);

    return {
      success: false,
      error: err.message || "Neznáma chyba pri konverzii PDF na DOCX",
      originalPdfPath: pdfPath
    };
  }
}

export async function isConverterAvailable(): Promise<{ available: boolean; converter?: string }> {
  const libreOfficePath = await findLibreOffice();
  if (libreOfficePath) {
    return { available: true, converter: "libreoffice" };
  }
  return { available: false };
}
