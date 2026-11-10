import type { ContactLoadCopy } from "./contact-load-translations";

export type LoadCounts = { new: number; existing: number; invalid: number };
export type LoadBatch = {
  id: string; source: "crm" | "file"; status: string; createdAt: string; appliedAt?: string;
  counts: LoadCounts; added?: number; undo?: { removed: number; protected: number };
};
export type LoadPreview = LoadBatch & {
  status: "preview"; expiresAt: string;
  items: { row: number; name: string; country: string; disposition: "new" | "existing" | "invalid"; reason?: string }[];
};
export type UndoPreview = { removable: number; protected: number; missing: number };
export class ContactLoadError extends Error {
  constructor(public code: string, public status?: number) { super(code); }
}
export function contactLoadErrorCopy(error: unknown, copy: ContactLoadCopy): string {
  const code = error instanceof Error ? error.message : "";
  if (["stale_preview", "preview_expired", "contact_load_preview_required"].includes(code)) return copy.stale;
  if (code === "invalid_rows") return copy.invalidError;
  if (code === "phase_policy_required") return copy.policy;
  if (code === "forbidden" || (error instanceof ContactLoadError && [401, 403].includes(error.status || 0))) return copy.forbidden;
  if (code === "invalid_input" || (error instanceof ContactLoadError && error.status === 413)) return copy.input;
  return copy.error;
}
export function canApplyContactLoad(preview: LoadPreview, now = Date.now()): boolean {
  return preview.counts.invalid === 0 && Number.isFinite(Date.parse(preview.expiresAt)) && Date.parse(preview.expiresAt) > now;
}
export const CONTACT_LOAD_PAGE_SIZE = 50;
export function contactLoadPage(preview: LoadPreview, page: number) {
  return preview.items.slice(0, 5000).slice(page * CONTACT_LOAD_PAGE_SIZE, (page + 1) * CONTACT_LOAD_PAGE_SIZE);
}
