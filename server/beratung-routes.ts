/**
 * Beratung Email Monitor — API Routes
 * Mounted under /api/beratung/* by registerRoutes in routes.ts
 */

import type { Express, Request, Response } from "express";
import { pool } from "./db";
import {
  fetchNewBeratungEmails,
  translateBeratungEmail,
  forwardBeratungEmail,
  acquireBeratungTokenROPC,
} from "./lib/beratung-email-service";
import { encryptTokenWithMarker } from "./lib/token-crypto";

export function registerBeratungRoutes(app: Express, requireAuth: (req: Request, res: Response, next: any) => void) {

  // ── Admin/manager gate for all Beratung routes ────────────────────────────
  const requireBeratungAccess = (req: Request, res: Response, next: any) => {
    const user = (req as any).session?.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (user.role !== "admin" && user.role !== "manager") {
      return res.status(403).json({ error: "Admin or manager role required" });
    }
    next();
  };

  const guard = [requireAuth, requireBeratungAccess];

  // ── GET /api/beratung/emails ──────────────────────────────────────────────
  app.get("/api/beratung/emails", ...guard, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1")));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "25"))));
      const offset = (page - 1) * limit;
      const status = req.query.status as string | undefined;

      let where = "1=1";
      const params: any[] = [];
      if (status) {
        where += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      const { rows: emails } = await pool.query(
        `SELECT id, graph_message_id, subject, from_address, from_name,
                received_at, has_attachments, attachment_count,
                attachment_summaries, status, forwarded_at, created_at
         FROM beratung_inbox_emails
         WHERE ${where}
         ORDER BY received_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM beratung_inbox_emails WHERE ${where}`,
        params
      );

      res.json({
        emails,
        total: countRows[0]?.total || 0,
        page,
        limit,
      });
    } catch (err: any) {
      console.error("[Beratung] GET /emails error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/beratung/emails/:id ──────────────────────────────────────────
  app.get("/api/beratung/emails/:id", ...guard, async (req: Request, res: Response) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, graph_message_id, subject, from_address, from_name,
                received_at, body_html, body_text, translated_cs, translated_sk,
                has_attachments, attachment_count, attachment_summaries,
                status, forwarded_at, created_at
         FROM beratung_inbox_emails WHERE id = $1 LIMIT 1`,
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/beratung/emails/:id/translate ───────────────────────────────
  app.post("/api/beratung/emails/:id/translate", ...guard, async (req: Request, res: Response) => {
    try {
      const ok = await translateBeratungEmail(req.params.id);
      if (!ok) return res.status(422).json({ error: "Translation failed" });
      const { rows } = await pool.query(
        `SELECT id, status, translated_sk, translated_cs FROM beratung_inbox_emails WHERE id = $1`,
        [req.params.id]
      );
      res.json(rows[0] || { id: req.params.id, status: "translated" });
    } catch (err: any) {
      console.error("[Beratung] translate error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/beratung/emails/:id/forward ─────────────────────────────────
  app.post("/api/beratung/emails/:id/forward", ...guard, async (req: Request, res: Response) => {
    try {
      const ok = await forwardBeratungEmail(req.params.id);
      if (!ok) return res.status(422).json({ error: "Forward failed — check settings and token" });
      const { rows } = await pool.query(
        `SELECT id, status, forwarded_at FROM beratung_inbox_emails WHERE id = $1`,
        [req.params.id]
      );
      res.json(rows[0] || { id: req.params.id, status: "forwarded" });
    } catch (err: any) {
      console.error("[Beratung] forward error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/beratung/fetch ──────────────────────────────────────────────
  app.post("/api/beratung/fetch", ...guard, async (req: Request, res: Response) => {
    try {
      const inserted = await fetchNewBeratungEmails();
      res.json({ inserted });
    } catch (err: any) {
      console.error("[Beratung] fetch error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/beratung/settings ────────────────────────────────────────────
  app.get("/api/beratung/settings", ...guard, async (req: Request, res: Response) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, forward_to, auto_process, last_checked_at, updated_at,
                (token_access IS NOT NULL AND token_access != '') AS has_token
         FROM beratung_monitor_settings LIMIT 1`
      );
      if (!rows[0]) {
        return res.json({
          forward_to: [],
          auto_process: false,
          last_checked_at: null,
          has_token: false,
        });
      }
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/beratung/settings ──────────────────────────────────────────
  app.patch("/api/beratung/settings", ...guard, async (req: Request, res: Response) => {
    try {
      const { forward_to, auto_process } = req.body as {
        forward_to?: string[];
        auto_process?: boolean;
      };

      await pool.query(
        `INSERT INTO beratung_monitor_settings (id, forward_to, auto_process, updated_at)
           VALUES (1, $1, $2, now())
         ON CONFLICT (id) DO UPDATE
           SET forward_to   = COALESCE(EXCLUDED.forward_to, beratung_monitor_settings.forward_to),
               auto_process = COALESCE(EXCLUDED.auto_process, beratung_monitor_settings.auto_process),
               updated_at   = now()`,
        [
          forward_to !== undefined ? forward_to : null,
          auto_process !== undefined ? auto_process : null,
        ]
      );

      const { rows } = await pool.query(
        `SELECT id, forward_to, auto_process, last_checked_at,
                (token_access IS NOT NULL AND token_access != '') AS has_token
         FROM beratung_monitor_settings LIMIT 1`
      );
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/beratung/settings/connect ───────────────────────────────────
  // Re-acquires ROPC token using current BERATUNG_PASSWORD secret.
  // Does NOT accept password in the request body (secret stays server-side).
  app.post("/api/beratung/settings/connect", requireAuth, async (req: Request, res: Response) => {
    try {
      // Only admins can reconnect
      const user = (req as any).session?.user;
      if (!user || (user.role !== "admin" && user.role !== "manager")) {
        return res.status(403).json({ error: "Admin/manager required" });
      }

      const fresh = await acquireBeratungTokenROPC();
      if (!fresh) {
        return res.status(422).json({ error: "ROPC token acquisition failed — check BERATUNG_PASSWORD and MS365 credentials" });
      }

      await pool.query(
        `INSERT INTO beratung_monitor_settings (id, forward_to, auto_process, token_access, token_refresh, token_expires_at, updated_at)
           VALUES (1, ARRAY[]::text[], false, $1, $2, $3, now())
         ON CONFLICT (id) DO UPDATE
           SET token_access = EXCLUDED.token_access,
               token_refresh = EXCLUDED.token_refresh,
               token_expires_at = EXCLUDED.token_expires_at,
               updated_at = now()`,
        [
          encryptTokenWithMarker(fresh.accessToken),
          encryptTokenWithMarker(fresh.refreshToken),
          fresh.expiresOn,
        ]
      );

      res.json({ connected: true, expiresOn: fresh.expiresOn });
    } catch (err: any) {
      console.error("[Beratung] connect error:", err);
      res.status(500).json({ error: err.message });
    }
  });
}
