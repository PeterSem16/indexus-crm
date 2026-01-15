import * as path from "path";
import * as fs from "fs";

function detectDataRoot(): string {
  if (fs.existsSync("/var/www/indexus-crm/data")) {
    return "/var/www/indexus-crm/data";
  }
  if (process.env.DATA_ROOT) {
    return process.env.DATA_ROOT;
  }
  return path.join(process.cwd(), "uploads");
}

export const DATA_ROOT = detectDataRoot();
export const IS_UBUNTU = DATA_ROOT.startsWith("/var/www");

export const STORAGE_PATHS = {
  uploads: DATA_ROOT,
  agreements: path.join(DATA_ROOT, "agreements"),
  avatars: path.join(DATA_ROOT, "avatars"),
  contractPdfs: path.join(DATA_ROOT, "contract-pdfs"),
  contractPreviews: path.join(DATA_ROOT, "contract-previews"),
  contractTemplates: path.join(DATA_ROOT, "contract-templates"),
  contractVersions: path.join(DATA_ROOT, "contract_versions"),
  emailImages: path.join(DATA_ROOT, "email-images"),
  generatedContracts: path.join(DATA_ROOT, "generated-contracts"),
  invoiceImages: path.join(DATA_ROOT, "invoice-images"),
  templatePreviews: path.join(DATA_ROOT, "template-previews"),
  exports: path.join(DATA_ROOT, "exports"),
};

export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function ensureAllDirectoriesExist(): void {
  Object.values(STORAGE_PATHS).forEach((dir) => {
    ensureDirectoryExists(dir);
  });
  console.log(`[Storage] Data root: ${DATA_ROOT}`);
  console.log(`[Storage] All directories initialized`);
}

export function getRelativePath(absolutePath: string): string {
  if (IS_UBUNTU) {
    return absolutePath.replace("/var/www/indexus-crm/data", "/data");
  }
  return absolutePath.replace(process.cwd(), "").replace(/^\//, "");
}

export function getAbsolutePath(relativePath: string): string {
  if (relativePath.startsWith("/data/")) {
    if (IS_UBUNTU) {
      return relativePath.replace("/data", "/var/www/indexus-crm/data");
    }
    return path.join(process.cwd(), "uploads", relativePath.replace("/data/", ""));
  }
  if (relativePath.startsWith("uploads/")) {
    if (IS_UBUNTU) {
      return path.join("/var/www/indexus-crm/data", relativePath.replace("uploads/", ""));
    }
    return path.join(process.cwd(), relativePath);
  }
  return path.join(DATA_ROOT, relativePath);
}

export function getPublicUrl(absolutePath: string): string {
  if (IS_UBUNTU) {
    return absolutePath.replace("/var/www/indexus-crm/data", "/data");
  }
  return absolutePath.replace(process.cwd(), "").replace(/^\//, "/");
}
