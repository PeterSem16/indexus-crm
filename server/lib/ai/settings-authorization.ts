import type { RequestHandler } from "express";
import type { Pool } from "pg";
export function aiSettingsAdminGuard(pool: Pick<Pool, "query">, requireAuth: RequestHandler): RequestHandler {
  return (req, res, next) => requireAuth(req, res, () => {
    const actor = (req.session as { user?: { id: string } }).user?.id;
    if (!actor) { res.status(401).json({ error: "unauthorized", code: "unauthorized" }); return; }
    // Fresh user and role records: revocation does not wait for session expiration.
    pool.query(`SELECT u.id FROM users u LEFT JOIN roles r ON r.id=u.role_id
      WHERE u.id=$1 AND u.is_active=true AND (u.role='admin' OR r.legacy_role='admin')`,
    [actor]).then(result => {
      res.setHeader("Cache-Control", "no-store");
      if (!result.rows.length) return res.status(403).json({ error: "forbidden", code: "forbidden" });
      next();
    }).catch(() => res.status(503).json({ error: "settings_unavailable", code: "settings_unavailable" }));
  });
}
