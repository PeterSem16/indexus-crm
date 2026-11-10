import type { Express, RequestHandler } from "express";
import multer from "multer";
import { pool } from "../db";
import { fileCandidates } from "./mission-contact-load-file";
import { applyLoad, ContactLoadError, loadAccess, previewLoad, publicBatch, undoLoad, type CriteriaFilter } from "./mission-contact-loads";

export function registerContactLoadRoutes(app: Express, requireAuth: RequestHandler, filter: CriteriaFilter) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 8 } }).single("file");
  const wrap = (run: (req: any) => Promise<unknown>): RequestHandler => async (req,res) => {
    try { res.json(await run(req)); }
    catch (error) {
      const known = error instanceof ContactLoadError;
      const input = error instanceof Error && error.message === "invalid_input";
      res.status(known ? error.status : input ? 400 : 500).json({ error: known ? error.code : input ? "invalid_input" : "load_failed" });
      if (!known && !input) console.error("[ContactLoad] request failed", { code: (error as any)?.code || "internal" });
    }
  };
  const root = "/api/campaigns/:id/contact-loads";
  app.get(root, requireAuth, wrap(async req => {
    await loadAccess(pool,req.session.user.id,req.params.id);
    const result = await pool.query(`SELECT id,source,status,created_at,expires_at,applied_at,counts,added,undo
      FROM mission_contact_loads WHERE campaign_id=$1 AND (status<>'preview' OR actor_id=$2)
      ORDER BY created_at DESC LIMIT 100`, [req.params.id,req.session.user.id]);
    return { batches: result.rows.map(r => publicBatch(r)) };
  }));
  app.post(`${root}/preview`, requireAuth, (req,res,next) => {
    if (!req.is("multipart/form-data")) return next();
    upload(req,res,error => error ? res.status(400).json({ error: "invalid_input" }) : next());
  }, wrap(async req => {
    if (req.file) return previewLoad(pool,req.session.user.id,req.params.id,"file",req.body,filter,
      country => fileCandidates(req.file,req.body.contactType,country));
    if (req.body?.source !== "crm") throw new ContactLoadError("invalid_input",400);
    return previewLoad(pool,req.session.user.id,req.params.id,"crm",req.body,filter);
  }));
  app.post(`${root}/:batchId/apply`, requireAuth, wrap(req => applyLoad(pool,req.session.user.id,req.params.id,req.params.batchId)));
  app.post(`${root}/:batchId/undo-preview`, requireAuth, wrap(req => undoLoad(pool,req.session.user.id,req.params.id,req.params.batchId,false)));
  app.post(`${root}/:batchId/undo`, requireAuth, wrap(req => undoLoad(pool,req.session.user.id,req.params.id,req.params.batchId,true)));
}
