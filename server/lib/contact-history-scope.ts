import type { Pool } from "pg";
import { access } from "./mission-funnel-routes";
import { loadStatusListHistoryDisplay } from "./status-list-history-display";
import { formatStatusListHistory } from "../../shared/status-list-history-display";

type HistoryEntry = {
  id: string; action?: string; campaignId?: string | null; campaignName?: string | null;
  metadata?: unknown; content?: string; details?: string | null; callbackDate?: unknown;
  [key: string]: unknown;
};
const object = (value: unknown): Record<string, any> => {
  if (typeof value === "string") {
    try { return object(JSON.parse(value)); } catch { return {}; }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
};

/** "All Missions" means all readable Missions, never all Missions in the DB.
 * Unattributed communication stays unattributed; selecting a Mission is not
 * evidence that an older email or call belongs to it. */
export async function prepareContactHistory(
  database: Pick<Pool, "query" | "connect">, userId: string, entries: HistoryEntry[],
) {
  const normalized = entries.map(entry => {
    const metadata = object(entry.metadata);
    return { ...entry, metadata,
      campaignId: typeof entry.campaignId === "string" && entry.campaignId ? entry.campaignId : null };
  });
  const ids = [...new Set(normalized.map(entry => entry.campaignId).filter((id): id is string => !!id))];
  const visible = new Map<string, string>();
  for (const id of ids) {
    const permission = await access(userId, id, database);
    if (permission?.canRead) visible.set(id, permission.name);
  }
  const allowed = normalized.filter(entry => !entry.campaignId || visible.has(entry.campaignId));
  const unresolved = allowed.filter(entry => entry.action?.startsWith("status_list_") &&
    !Object.keys(object(entry.metadata.statusListHistory)).length);
  const labels = await loadStatusListHistoryDisplay(database, unresolved.map(entry => ({
    id: entry.id, action: entry.action!, campaignId: entry.campaignId, metadata: entry.metadata,
  })));
  return allowed.map(entry => {
    const metadata = { ...entry.metadata };
    if (labels.has(entry.id)) metadata.statusListHistory = labels.get(entry.id);
    // Legacy inbound callbacks kept their date on the outer history row.
    if (entry.action === "callback_set" && !("callbackDate" in metadata) && entry.callbackDate != null)
      metadata.callbackDate = entry.callbackDate;
    const display = formatStatusListHistory({ action: entry.action, metadata });
    return { ...entry, metadata,
      campaignName: entry.campaignId ? visible.get(entry.campaignId) || entry.campaignName || null : null,
      ...(display ? { content: display.title, details: display.details } : {}),
    };
  });
}
