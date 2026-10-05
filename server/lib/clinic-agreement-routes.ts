import type { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { DATA_ROOT } from "../config/storage-paths";
import { missionAllowsClinicAgreementEditing } from "../../shared/clinic-agreement-permissions";
import {
  AGREEMENT_MAX_BYTES, agreementCreateSchema, agreementPatchSchema,
  agreementDatesValid, agreementFileExtension, agreementFilename,
} from "./clinic-agreement-contract";

const PRIVATE_DIR = path.join(path.dirname(DATA_ROOT), "private-clinic-agreements");
const projection = `id, clinic_id AS "clinicId", title, contract_number AS "contractNumber",
  to_char(valid_from,'YYYY-MM-DD') AS "validFrom", to_char(valid_to,'YYYY-MM-DD') AS "validTo",
  active, ended_at AS "endedAt", file_name AS "fileName", content_type AS "contentType",
  file_size AS "fileSize", created_at AS "createdAt", updated_at AS "updatedAt"`;

/** Private documents: country + module/assigned Mission authorization, before parsing files. */
export async function clinicAgreementAccess(userId: string, clinicId: string, campaignId?: string) {
  const { rows } = await pool.query(`
    SELECT u.role, u.role_id, u.assigned_countries, c.country_code,
      EXISTS (SELECT 1 FROM role_module_permissions p WHERE p.role_id=u.role_id
        AND p.module_key='hospitals' AND p.access='visible') AS module_read,
      EXISTS (SELECT 1 FROM role_module_permissions p WHERE p.role_id=u.role_id
        AND p.module_key='hospitals' AND p.access='visible' AND p.can_edit) AS module_edit,
      EXISTS (SELECT 1 FROM campaign_contacts cc JOIN campaign_agents ca ON ca.campaign_id=cc.campaign_id
         WHERE cc.clinic_id=c.id AND ca.user_id=u.id) AS mission_read,
      (SELECT m.settings FROM campaigns m
        JOIN campaign_agents ca ON ca.campaign_id=m.id AND ca.user_id=u.id
        WHERE m.id=$3 AND EXISTS (SELECT 1 FROM campaign_contacts cc
          WHERE cc.campaign_id=m.id AND cc.clinic_id=c.id)
        LIMIT 1) AS mission_settings
    FROM users u CROSS JOIN clinics c WHERE u.id=$1 AND u.is_active AND c.id=$2
  `, [userId, clinicId, campaignId || null]);
  if (!rows.length) return { canRead: false, canManage: false };
  const row = rows[0];
  const admin = row.role === "admin";
  const country = admin || Boolean(row.country_code && row.assigned_countries?.includes(row.country_code));
  const legacyManager = row.role === "manager" && !row.role_id;
  return {
    canRead: country && (admin || legacyManager || row.module_read || row.mission_read),
    canManage: country && (admin || legacyManager || row.module_edit ||
      missionAllowsClinicAgreementEditing(row.mission_settings)),
  };
}

export function registerClinicAgreementRoutes(app: Express, requireAuth: any) {
  const collection = "/api/clinics/:id/agreements";
  const access = (manage: boolean) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaignId = req.query.campaignId;
      if (campaignId !== undefined && (typeof campaignId !== "string" || !campaignId.trim() || campaignId.length > 128))
        return res.status(400).json({ error: "Invalid Mission context" });
      const permission = await clinicAgreementAccess(req.session.user!.id, req.params.id, campaignId as string | undefined);
      if (!(manage ? permission.canManage : permission.canRead))
        return res.status(403).json({ error: "Forbidden" });
      res.locals.clinicAgreementPermission = permission;
      next();
    } catch { res.status(500).json({ error: "Agreement access check failed" }); }
  };
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: AGREEMENT_MAX_BYTES, files: 1, fields: 6, fieldSize: 2048, parts: 8 },
  }).single("file");
  app.get(collection, requireAuth, access(false), async (req, res) => {
    try {
      res.setHeader("Cache-Control", "private, no-store");
      const { rows } = await pool.query(`SELECT ${projection} FROM clinic_agreements WHERE clinic_id=$1 ORDER BY created_at DESC,id`, [req.params.id]);
      res.json({ agreements: rows, canManage: res.locals.clinicAgreementPermission.canManage });
    } catch { res.status(500).json({ error: "Agreement list failed" }); }
  });
  app.post(collection, requireAuth, access(true), (req, res) => {
    upload(req, res, async error => {
      if (error) return res.status(400).json({ error: "Invalid agreement upload", code: error instanceof multer.MulterError ? error.code : "INVALID_FILE" });
      const active = req.body?.active;
      if (active !== undefined && active !== "true" && active !== "false")
        return res.status(400).json({ error: "Invalid agreement data" });
      const parsed = agreementCreateSchema.safeParse({ ...req.body, active: active === undefined ? true : active === "true" });
      if (!parsed.success || !agreementDatesValid(parsed.data?.validFrom, parsed.data?.validTo))
        return res.status(400).json({ error: "Invalid agreement data" });
      const file = req.file;
      const extension = file && agreementFileExtension(file.mimetype, file.buffer);
      if (!file || !extension) return res.status(400).json({ error: "Unsupported agreement file" });
      const key = randomUUID() + extension;
      const target = path.join(PRIVATE_DIR, key);
      let written = false;
      try {
        await fs.mkdir(PRIVATE_DIR, { recursive: true, mode: 0o700 });
        await fs.writeFile(target, file.buffer, { flag: "wx", mode: 0o600 });
        written = true;
        const value = parsed.data;
        const { rows } = await pool.query(`INSERT INTO clinic_agreements
          (clinic_id,title,contract_number,valid_from,valid_to,active,ended_at,file_name,storage_key,content_type,file_size,created_by)
          VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $6 THEN NULL ELSE now() END,$7,$8,$9,$10,$11) RETURNING ${projection}`,
          [req.params.id, value.title, value.contractNumber ?? null, value.validFrom ?? null, value.validTo ?? null,
            value.active ?? true, agreementFilename(file.originalname), key, file.mimetype, file.size, req.session.user!.id]);
        written = false; // DB now owns this file; a response failure must not remove committed data.
        res.status(201).json(rows[0]);
      } catch {
        if (written) await fs.unlink(target).catch(() => console.error("[Clinic agreements] orphan cleanup failed"));
        res.status(500).json({ error: "Agreement save failed" });
      }
    });
  });
  app.patch(collection + "/:agreementId", requireAuth, access(true), async (req, res) => {
    const parsed = agreementPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid agreement data" });
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const { rows } = await client.query(`SELECT * FROM clinic_agreements WHERE id=$1 AND clinic_id=$2 FOR UPDATE`, [req.params.agreementId, req.params.id]);
      if (!rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Agreement not found" });
      }
      const current = rows[0], value = parsed.data;
      // DATE columns are formatted explicitly; node-postgres may otherwise turn them into local Dates.
      const dates = await client.query(`SELECT to_char(valid_from,'YYYY-MM-DD') AS f,to_char(valid_to,'YYYY-MM-DD') AS t FROM clinic_agreements WHERE id=$1`, [current.id]);
      const from = value.validFrom !== undefined ? value.validFrom : dates.rows[0].f;
      const to = value.validTo !== undefined ? value.validTo : dates.rows[0].t;
      if (!agreementDatesValid(from, to)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid agreement dates" });
      }
      const active = value.active ?? current.active;
      const updated = await client.query(`UPDATE clinic_agreements SET title=$3,contract_number=$4,valid_from=$5,valid_to=$6,
        active=$7,ended_at=CASE WHEN $7 THEN NULL ELSE COALESCE(ended_at,now()) END,updated_at=now()
        WHERE id=$1 AND clinic_id=$2 RETURNING ${projection}`, [
        current.id, req.params.id, value.title ?? current.title,
        value.contractNumber !== undefined ? value.contractNumber : current.contract_number, from, to, active,
      ]);
      await client.query("COMMIT");
      res.json(updated.rows[0]);
    } catch {
      await client?.query("ROLLBACK").catch(() => {});
      res.status(500).json({ error: "Agreement update failed" });
    } finally { client?.release(); }
  });
  app.get(collection + "/:agreementId/download", requireAuth, access(false), async (req, res) => {
    try {
      const { rows } = await pool.query(`SELECT storage_key,file_name,content_type FROM clinic_agreements WHERE clinic_id=$1 AND id=$2`, [req.params.id, req.params.agreementId]);
      if (!rows.length) return res.status(404).json({ error: "Agreement not found" });
      const row = rows[0];
      if (!/^[a-f0-9-]{36}\.(pdf|doc|docx|png|jpg)$/.test(row.storage_key))
        return res.status(404).json({ error: "Agreement file unavailable" });
      const target = path.join(PRIVATE_DIR, row.storage_key);
      const stat = await fs.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink()) return res.status(404).json({ error: "Agreement file unavailable" });
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.download(target, agreementFilename(row.file_name), { headers: { "Content-Type": row.content_type } }, error => {
        if (error && !res.headersSent) res.status(404).json({ error: "Agreement file unavailable" });
      });
    } catch { if (!res.headersSent) res.status(404).json({ error: "Agreement file unavailable" }); }
  });
}