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
import {
  workspaceProjection, agreementAudit, agreementReason, validAgreementKey,
  agreementPreviewPdf, loadRecordActivity, parseActivityCursor,
} from "./agreement-workspace";

type AgreementEntity = "clinic" | "hospital";
function agreementConfig(entity: AgreementEntity) {
  return {
    entityTable: entity === "clinic" ? "clinics" : "hospitals",
    table: entity === "clinic" ? "clinic_agreements" : "hospital_agreements",
    foreignKey: entity === "clinic" ? "clinic_id" : "hospital_id",
    ownerKey: entity === "clinic" ? "clinicId" : "hospitalId",
    privateDir: path.join(path.dirname(DATA_ROOT), `private-${entity}-agreements`),
  };
}
const projectionFor = (entity: AgreementEntity) => {
  const { foreignKey, ownerKey } = agreementConfig(entity);
  return `id, ${foreignKey} AS "${ownerKey}", title, contract_number AS "contractNumber",
  to_char(valid_from,'YYYY-MM-DD') AS "validFrom", to_char(valid_to,'YYYY-MM-DD') AS "validTo",
  active, ended_at AS "endedAt", file_name AS "fileName", content_type AS "contentType",
  file_size AS "fileSize", created_at AS "createdAt", updated_at AS "updatedAt"${workspaceProjection}`;
};

/** Private documents: country + module/assigned Mission authorization, before parsing files. */
export async function clinicAgreementAccess(userId: string, clinicId: string, campaignId?: string) {
  return entityAgreementAccess("clinic", userId, clinicId, campaignId);
}
export async function entityAgreementAccess(entity: AgreementEntity, userId: string, entityId: string, campaignId?: string) {
  const { entityTable, foreignKey } = agreementConfig(entity);
  const { rows } = await pool.query(`
    SELECT u.role, u.role_id, u.assigned_countries, c.country_code,
      EXISTS (SELECT 1 FROM role_module_permissions p WHERE p.role_id=u.role_id
        AND p.module_key='hospitals' AND p.access='visible') AS module_read,
      EXISTS (SELECT 1 FROM role_module_permissions p WHERE p.role_id=u.role_id
        AND p.module_key='hospitals' AND p.access='visible' AND p.can_edit) AS module_edit,
      EXISTS (SELECT 1 FROM campaign_contacts cc JOIN campaign_agents ca ON ca.campaign_id=cc.campaign_id
         WHERE cc.${foreignKey}=c.id AND ca.user_id=u.id) AS mission_read,
      (SELECT m.settings FROM campaigns m
        JOIN campaign_agents ca ON ca.campaign_id=m.id AND ca.user_id=u.id
        WHERE m.id=$3 AND EXISTS (SELECT 1 FROM campaign_contacts cc
          WHERE cc.campaign_id=m.id AND cc.${foreignKey}=c.id)
        LIMIT 1) AS mission_settings
    FROM users u CROSS JOIN ${entityTable} c WHERE u.id=$1 AND u.is_active AND c.id=$2
  `, [userId, entityId, campaignId || null]);
  if (!rows.length) return { canRead: false, canManage: false, canDelete: false };
  const row = rows[0];
  const admin = row.role === "admin";
  const country = admin || Boolean(row.country_code && row.assigned_countries?.includes(row.country_code));
  const legacyManager = row.role === "manager" && !row.role_id;
  return {
    canRead: country && (admin || legacyManager || row.module_read || row.mission_read),
    canDelete: admin,
    canManage: country && (admin || legacyManager || row.module_edit ||
      missionAllowsClinicAgreementEditing(row.mission_settings)),
  };
}

export function registerClinicAgreementRoutes(app: Express, requireAuth: any) {
  registerEntityAgreementRoutes(app, requireAuth, "clinic");
}
export function registerHospitalAgreementRoutes(app: Express, requireAuth: any) {
  registerEntityAgreementRoutes(app, requireAuth, "hospital");
}
function registerEntityAgreementRoutes(app: Express, requireAuth: any, entity: AgreementEntity) {
  // All SQL identifiers come from this closed server-owned configuration, never request data.
  const { entityTable, table, foreignKey, privateDir: PRIVATE_DIR } = agreementConfig(entity);
  const projection = projectionFor(entity);
  const collection = `/api/${entityTable}/:id/agreements`;
  const access = (manage: boolean) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaignId = req.query.campaignId;
      if (campaignId !== undefined && (typeof campaignId !== "string" || !campaignId.trim() || campaignId.length > 128))
        return res.status(400).json({ error: "Invalid Mission context" });
      const permission = await entityAgreementAccess(entity, req.session.user!.id, req.params.id, campaignId as string | undefined);
      if (!(manage ? permission.canManage : permission.canRead))
        return res.status(403).json({ error: "Forbidden" });
      res.locals.clinicAgreementPermission = permission;
      next();
    } catch { res.status(500).json({ error: "Agreement access check failed" }); }
  };
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: AGREEMENT_MAX_BYTES, files: 1, fields: 8, fieldSize: 4096, parts: 10 },
  }).single("file");
  app.get(collection, requireAuth, access(false), async (req, res) => {
    try {
      res.setHeader("Cache-Control", "private, no-store");
      const { rows } = await pool.query(`SELECT ${projection} FROM ${table} WHERE ${foreignKey}=$1 ORDER BY created_at DESC,id`, [req.params.id]);
      res.json({ agreements: rows, canManage: res.locals.clinicAgreementPermission.canManage, canDelete: res.locals.clinicAgreementPermission.canDelete });
    } catch { res.status(500).json({ error: "Agreement list failed" }); }
  });
  app.post(collection, requireAuth, access(true), (req, res) => {
    upload(req, res, async error => {
      if (error) return res.status(400).json({ error: "Invalid agreement upload", code: error instanceof multer.MulterError ? error.code : "INVALID_FILE" });
      const active = req.body?.active;
      if (active !== undefined && active !== "true" && active !== "false")
        return res.status(400).json({ error: "Invalid agreement data" });
      const { parentId, reason: reasonInput, ...fields } = req.body || {};
      const reason = agreementReason(reasonInput);
      if (parentId !== undefined && (typeof parentId !== "string" || !parentId || parentId.length > 128 || !reason))
        return res.status(400).json({ error: "Version parent and reason required" });
      if (reasonInput !== undefined && !reason) return res.status(400).json({ error: "Invalid reason" });
      const parsed = agreementCreateSchema.safeParse({ ...fields, active: active === undefined ? true : active === "true" });
      if (!parsed.success || !agreementDatesValid(parsed.data?.validFrom, parsed.data?.validTo))
        return res.status(400).json({ error: "Invalid agreement data" });
      const file = req.file;
      const extension = file && agreementFileExtension(file.mimetype, file.buffer);
      if (!file || !extension) return res.status(400).json({ error: "Unsupported agreement file" });
      const key = randomUUID() + extension;
      const target = path.join(PRIVATE_DIR, key);
      let written = false;
      let client: PoolClient | undefined;
      try {
        client = await pool.connect();
        await client.query("BEGIN");
        let groupId: string | null = null, version = 1;
        if (parentId) {
          // Serialize the entire version chain, including archive operations.
          const parent = await client.query(`SELECT COALESCE(group_id,id) AS root FROM ${table} WHERE id=$1 AND ${foreignKey}=$2`, [parentId,req.params.id]);
          if (!parent.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Agreement not found" }); }
          groupId = parent.rows[0].root;
          await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`${table}:${groupId}`]);
          const chain = await client.query(`SELECT max(version)::integer AS version, bool_or(archived_at IS NOT NULL) AS archived
            FROM ${table} WHERE COALESCE(group_id,id)=$1 AND ${foreignKey}=$2`, [groupId,req.params.id]);
          if (chain.rows[0].archived) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Agreement archived" }); }
          version = chain.rows[0].version + 1;
        }
        await fs.mkdir(PRIVATE_DIR, { recursive: true, mode: 0o700 });
        await fs.writeFile(target, file.buffer, { flag: "wx", mode: 0o600 });
        written = true;
        const value = parsed.data;
        const { rows } = await client.query(`INSERT INTO ${table}
          (${foreignKey},title,contract_number,valid_from,valid_to,active,ended_at,file_name,storage_key,content_type,file_size,created_by,group_id,version,reason)
          VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $6 THEN NULL ELSE now() END,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING ${projection}`,
          [req.params.id, value.title, value.contractNumber ?? null, value.validFrom ?? null, value.validTo ?? null,
            value.active ?? true, agreementFilename(file.originalname), key, file.mimetype, file.size, req.session.user!.id, groupId,version,reason]);
        await agreementAudit(client,entity,req.params.id,req.session.user!.id,parentId ? "agreement_version_added" : "agreement_added",
          { title: value.title, fileName: rows[0].fileName, version, reason, agreementId:rows[0].id }, req.query.campaignId as string | undefined);
        await client.query("COMMIT");
        written = false; // DB now owns this file; a response failure must not remove committed data.
        res.status(201).json(rows[0]);
      } catch {
        await client?.query("ROLLBACK").catch(() => {});
        if (written) await fs.unlink(target).catch(() => console.error("[Clinic agreements] orphan cleanup failed"));
        res.status(500).json({ error: "Agreement save failed" });
      } finally { client?.release(); }
    });
  });
  app.patch(collection + "/:agreementId", requireAuth, access(true), async (req, res) => {
    const parsed = agreementPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid agreement data" });
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const { rows } = await client.query(`SELECT * FROM ${table} WHERE id=$1 AND ${foreignKey}=$2 FOR UPDATE`, [req.params.agreementId, req.params.id]);
      if (!rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Agreement not found" });
      }
      const current = rows[0], value = parsed.data;
      if (current.archived_at) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Agreement archived" }); }
      // DATE columns are formatted explicitly; node-postgres may otherwise turn them into local Dates.
      const dates = await client.query(`SELECT to_char(valid_from,'YYYY-MM-DD') AS f,to_char(valid_to,'YYYY-MM-DD') AS t FROM ${table} WHERE id=$1`, [current.id]);
      const from = value.validFrom !== undefined ? value.validFrom : dates.rows[0].f;
      const to = value.validTo !== undefined ? value.validTo : dates.rows[0].t;
      if (!agreementDatesValid(from, to)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid agreement dates" });
      }
      const active = value.active ?? current.active;
      const updated = await client.query(`UPDATE ${table} SET title=$3,contract_number=$4,valid_from=$5,valid_to=$6,
        active=$7,ended_at=CASE WHEN $7 THEN NULL ELSE COALESCE(ended_at,now()) END,updated_at=now()
        WHERE id=$1 AND ${foreignKey}=$2 RETURNING ${projection}`, [
        current.id, req.params.id, value.title ?? current.title,
        value.contractNumber !== undefined ? value.contractNumber : current.contract_number, from, to, active,
      ]);
      await agreementAudit(client,entity,req.params.id,req.session.user!.id,"agreement_updated", {
        title: updated.rows[0].title, version: updated.rows[0].version,
        before: JSON.stringify({ title:current.title,contractNumber:current.contract_number,validFrom:dates.rows[0].f,validTo:dates.rows[0].t,active:current.active }),
        after: JSON.stringify({ title:updated.rows[0].title,contractNumber:updated.rows[0].contractNumber,validFrom:from,validTo:to,active }),
      },req.query.campaignId as string | undefined);
      await client.query("COMMIT");
      res.json(updated.rows[0]);
    } catch {
      await client?.query("ROLLBACK").catch(() => {});
      res.status(500).json({ error: "Agreement update failed" });
    } finally { client?.release(); }
  });
  app.get(collection + "/:agreementId/download", requireAuth, access(false), async (req, res) => {
    try {
      const { rows } = await pool.query(`SELECT storage_key,file_name,content_type,file_deleted_at FROM ${table} WHERE ${foreignKey}=$1 AND id=$2`, [req.params.id, req.params.agreementId]);
      if (!rows.length) return res.status(404).json({ error: "Agreement not found" });
      const row = rows[0];
      if (row.file_deleted_at) return res.status(410).json({ error: "Agreement attachment removed" });
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
  const adminAccess = (req: Request,res: Response,next: NextFunction) => {
    if (!res.locals.clinicAgreementPermission.canDelete) return res.status(403).json({error:"Administrator required"});
    next();
  };
  app.get(`/api/${entityTable}/:id/record-activity`,requireAuth,access(false),async(req,res)=>{
    try {
      const cursor = parseActivityCursor(req.query.before);
      res.setHeader("Cache-Control","private, no-store");
      res.json(await loadRecordActivity(entity,req.params.id,req.session.user!.id,req.query.campaignId as string | undefined,cursor));
    } catch(error) { res.status(error instanceof Error && error.message === "invalid_cursor" ? 400 : 500).json({error:"Activity unavailable"}); }
  });
  // Conversions are expensive: bound global concurrency; no queued private document copies.
  let converting = 0;
  app.get(collection + "/:agreementId/preview", requireAuth, access(false), async (req,res)=>{
    let ownsConversion = false;
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      // Share lock excludes a simultaneous irreversible deletion during conversion/read.
      const {rows} = await client.query(`SELECT storage_key,content_type,file_deleted_at FROM ${table} WHERE ${foreignKey}=$1 AND id=$2 FOR SHARE`,[req.params.id,req.params.agreementId]);
      const row = rows[0];
      if (!row) { await client.query("ROLLBACK"); return res.status(404).end(); }
      if (row.file_deleted_at) { await client.query("ROLLBACK"); return res.status(410).end(); }
      if (!validAgreementKey(row.storage_key)) { await client.query("ROLLBACK"); return res.status(404).end(); }
      const target = path.join(PRIVATE_DIR,row.storage_key), stat=await fs.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("invalid_file");
      const office = ["application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(row.content_type);
      if (office) {
        if (converting >= 2) { await client.query("ROLLBACK"); return res.status(429).json({error:"Preview busy"}); }
        converting++; ownsConversion=true;
      }
      const bytes=await agreementPreviewPdf(target,row.content_type,PRIVATE_DIR);
      await client.query("COMMIT");
      res.set({"Content-Type":office ? "application/pdf" : row.content_type,"Cache-Control":"private, no-store",
        "X-Content-Type-Options":"nosniff","Content-Disposition":"inline"});
      res.send(bytes);
    } catch { await client?.query("ROLLBACK").catch(()=>{}); if (!res.headersSent) res.status(503).json({error:"Document preview unavailable"}); }
    finally { if(ownsConversion) converting--; client?.release(); }
  });
  app.post(collection+"/:agreementId/archive",requireAuth,access(true),adminAccess,async(req,res)=>{
    const reason = agreementReason(req.body?.reason);
    if (!reason) return res.status(400).json({error:"Reason required"});
    let client: PoolClient | undefined;
    try {
      client=await pool.connect();
      await client.query("BEGIN");
      const target=await client.query(`SELECT COALESCE(group_id,id) AS root FROM ${table} WHERE ${foreignKey}=$1 AND id=$2`,[req.params.id,req.params.agreementId]);
      if (!target.rows.length) {await client.query("ROLLBACK");return res.status(404).end();}
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`${table}:${target.rows[0].root}`]);
      const result=await client.query(`UPDATE ${table} SET archived_at=now(),active=false,ended_at=COALESCE(ended_at,now()),updated_at=now()
        WHERE ${foreignKey}=$1 AND COALESCE(group_id,id)=$2 AND archived_at IS NULL RETURNING title`,
      [req.params.id,target.rows[0].root]);
      if(result.rows.length) await agreementAudit(client,entity,req.params.id,req.session.user!.id,"agreement_archived",
        {title:result.rows[0].title,reason},req.query.campaignId as string | undefined);
      await client.query("COMMIT");res.status(204).end();
    }catch{await client?.query("ROLLBACK").catch(()=>{});res.status(500).json({error:"Archive failed"});}
    finally{client?.release();}
  });
  app.delete(collection+"/:agreementId/file",requireAuth,access(true),adminAccess,async(req,res)=>{
    const reason=agreementReason(req.body?.reason);
    if(!reason) return res.status(400).json({error:"Reason required"});
    let client: PoolClient | undefined;
    let began=false;
    try{
      client=await pool.connect();
      await client.query("BEGIN");began=true;
      const result=await client.query(`SELECT * FROM ${table} WHERE ${foreignKey}=$1 AND id=$2 FOR UPDATE`,[req.params.id,req.params.agreementId]);
      const row=result.rows[0];
      if(!row){await client.query("ROLLBACK");return res.status(404).end();}
      if(row.file_purged_at){await client.query("COMMIT");return res.status(204).end();}
      if(!validAgreementKey(row.storage_key)) throw new Error("invalid_key");
      // Commit a tombstone before touching the filesystem: DB rollback must never resurrect access.
      if(!row.file_deleted_at){
        await client.query(`UPDATE ${table} SET file_deleted_at=now(),file_deleted_by=$3,file_delete_reason=$4,updated_at=now()
          WHERE ${foreignKey}=$1 AND id=$2`,[req.params.id,row.id,req.session.user!.id,reason]);
        await agreementAudit(client,entity,req.params.id,req.session.user!.id,"agreement_file_deletion_requested",
          {title:row.title,fileName:row.file_name,version:row.version,reason},req.query.campaignId as string | undefined);
      }
      await client.query("COMMIT");began=false;
      // Retrying is supported after a filesystem failure. ENOENT means the requested purge is complete.
      await fs.unlink(path.join(PRIVATE_DIR,row.storage_key)).catch(e=>{if(e.code!=="ENOENT")throw e;});
      await client.query("BEGIN");began=true;
      const purged=await client.query(`UPDATE ${table} SET file_purged_at=now() WHERE ${foreignKey}=$1 AND id=$2 AND file_purged_at IS NULL RETURNING id`,[req.params.id,row.id]);
      if(purged.rows.length) await agreementAudit(client,entity,req.params.id,req.session.user!.id,"agreement_file_deleted",
        {title:row.title,fileName:row.file_name,version:row.version,reason:row.file_delete_reason || reason},req.query.campaignId as string | undefined);
      await client.query("COMMIT");began=false;res.status(204).end();
    }catch{if(began)await client?.query("ROLLBACK").catch(()=>{});res.status(500).json({error:"Attachment purge failed; deletion remains recorded",code:"PURGE_RETRY_REQUIRED"});}
    finally{client?.release();}
  });
}