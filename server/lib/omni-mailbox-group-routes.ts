import type { Express, RequestHandler } from "express";
import { validateMailboxGroups, type OmniGroupSettings, type OmniMailboxGroup } from "../../shared/omni-mailbox-groups";

interface InventoryStorage {
  getUserMs365Connection(id: string): Promise<any>;
  getUserMs365SharedMailboxes(id: string): Promise<any[]>;
}
export async function availableOmniEmails(storage: InventoryStorage, userId: string): Promise<Set<string>> {
  const [connection, shared] = await Promise.all([
    storage.getUserMs365Connection(userId), storage.getUserMs365SharedMailboxes(userId),
  ]);
  return new Set([
    ...(connection?.isConnected && connection.email ? [connection.email] : []),
    ...shared.filter(m => m.isActive).map(m => m.email),
  ].filter(Boolean).map(email => email.toLowerCase()));
}
export function registerOmniMailboxGroupRoutes(
  app: Express, auth: RequestHandler, storage: InventoryStorage,
  pool: { query: (text: string, values?: any[]) => Promise<any> },
) {
  app.get("/api/nexus/mailbox-groups", auth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const allowed = await availableOmniEmails(storage, userId);
      const result = await pool.query("SELECT groups, revision FROM nexus_omni_mailbox_groups WHERE user_id=$1", [userId]);
      const row: OmniGroupSettings = result.rows[0] || { groups: [], revision: 0 };
      // Revoked accounts are never projected back into navigation/search.
      res.json({ ...row, groups: row.groups.map((g: OmniMailboxGroup) => ({ ...g, emails: g.emails.filter(e => allowed.has(e.toLowerCase())) })) });
    } catch { res.status(500).json({ error: "groups_unavailable" }); }
  });
  app.put("/api/nexus/mailbox-groups", auth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const revision = req.body?.revision;
      if (!Number.isSafeInteger(revision) || revision < 0) return res.status(400).json({ error: "invalid_revision" });
      const allowed = await availableOmniEmails(storage, userId);
      let groups: OmniMailboxGroup[];
      try { groups = validateMailboxGroups(req.body.groups, allowed); }
      catch (error) { return res.status((error as Error).message === "mailbox_forbidden" ? 403 : 400).json({ error: (error as Error).message }); }
      // One atomic compare-and-swap, including first save. Stale tabs cannot overwrite newer groups.
      const result = revision === 0
        ? await pool.query(`INSERT INTO nexus_omni_mailbox_groups(user_id, groups, revision) VALUES($1,$2::jsonb,1)
            ON CONFLICT(user_id) DO NOTHING RETURNING groups, revision`, [userId, JSON.stringify(groups)])
        : await pool.query(`UPDATE nexus_omni_mailbox_groups SET groups=$2::jsonb, revision=revision+1, updated_at=now()
            WHERE user_id=$1 AND revision=$3 RETURNING groups, revision`, [userId, JSON.stringify(groups), revision]);
      if (!result.rows.length) return res.status(409).json({ error: "groups_changed" });
      res.json(result.rows[0]);
    } catch { res.status(500).json({ error: "groups_save_failed" }); }
  });
}
