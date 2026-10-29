import type { PoolClient } from "pg";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pool } from "../db";

export const AGREEMENT_WORKSPACE_MIGRATION = `
CREATE OR REPLACE FUNCTION indexus_record_activity_details(value text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN CASE WHEN jsonb_typeof(value::jsonb)='object' THEN value::jsonb ELSE '{}'::jsonb END;
EXCEPTION WHEN invalid_text_representation THEN RETURN '{}'::jsonb;
END $$;
` + ["clinic", "hospital"].map(entity => `
ALTER TABLE ${entity}_agreements ADD COLUMN IF NOT EXISTS group_id varchar;
ALTER TABLE ${entity}_agreements ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE ${entity}_agreements ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE ${entity}_agreements ADD COLUMN IF NOT EXISTS archived_at timestamp;
ALTER TABLE ${entity}_agreements ADD COLUMN IF NOT EXISTS file_deleted_at timestamp;
ALTER TABLE ${entity}_agreements ADD COLUMN IF NOT EXISTS file_deleted_by varchar;
ALTER TABLE ${entity}_agreements ADD COLUMN IF NOT EXISTS file_delete_reason text;
ALTER TABLE ${entity}_agreements ADD COLUMN IF NOT EXISTS file_purged_at timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS ${entity}_agreement_versions ON ${entity}_agreements
 (COALESCE(group_id,id),version);
`).join("\n");

export const workspaceProjection = `, COALESCE(group_id,id) AS "groupId", version, reason,
 archived_at AS "archivedAt", file_deleted_at AS "fileDeletedAt",
 file_deleted_by AS "fileDeletedBy", file_delete_reason AS "fileDeleteReason",
 file_purged_at AS "filePurgedAt",
 (SELECT COALESCE(u.full_name,u.username) FROM users u WHERE u.id=created_by) AS "createdByName"`;

export function validAgreementKey(key: unknown): key is string {
  return typeof key === "string" && /^[a-f0-9-]{36}\.(pdf|doc|docx|png|jpg)$/.test(key);
}
export function agreementReason(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 2000 ? value.trim() : null;
}
export async function agreementAudit(client: PoolClient, entity: string, entityId: string, userId: string, action: string, details: Record<string, unknown>, campaignId?: string) {
  await client.query(`INSERT INTO activity_logs(user_id,action,entity_type,entity_id,details)
    VALUES ($1,$2,$3,$4,$5)`, [userId, action, entity, entityId,
    JSON.stringify({ module: campaignId ? "Nexus Pulse" : "Healthcare Network", ...details, ...(campaignId ? { campaignId } : {}) })]);
}

/** No remote Office viewer: private originals never leave this server. Fresh, private profile per conversion. */
export async function agreementPreviewPdf(target: string, contentType: string, privateDir: string): Promise<Buffer> {
  if (!["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(contentType))
    return fs.readFile(target);
  const execute = promisify(execFile);
  const work = await fs.mkdtemp(path.join(privateDir, ".preview-"));
  await fs.chmod(work, 0o700);
  try {
    const profile = path.join(work, "profile");
    await fs.mkdir(path.join(profile, "user"), { recursive: true, mode: 0o700 });
    // Disable all macros and external-link updates for this disposable profile.
    await fs.writeFile(path.join(profile, "user", "registrymodifications.xcu"),
      `<?xml version="1.0" encoding="UTF-8"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Writer/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>2</value></prop></item></oor:items>`,
      { mode: 0o600 });
    await execute("libreoffice", [`-env:UserInstallation=${new URL(`file://${profile}`).href}`, "--headless",
      "--nologo", "--nodefault", "--norestore", "--convert-to", "pdf", "--outdir", work, target],
    { timeout: 45000, maxBuffer: 65536 });
    const output = path.join(work, path.basename(target, path.extname(target)) + ".pdf");
    const stat = await fs.stat(output);
    if (stat.size > 40 * 1024 * 1024) throw new Error("preview_too_large");
    const bytes = await fs.readFile(output);
    if (bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("invalid_preview");
    return bytes;
  } finally { await fs.rm(work, { recursive: true, force: true }); }
}

export type RecordActivityCursor = { time: string; id: string };
export function parseActivityCursor(value: unknown): RecordActivityCursor | null {
  if (value == null) return null;
  if (typeof value !== "string" || value.length > 512) throw new Error("invalid_cursor");
  let v: RecordActivityCursor;
  try { v = JSON.parse(Buffer.from(value, "base64url").toString()); }
  catch { throw new Error("invalid_cursor"); }
  if (!v || typeof v !== "object") throw new Error("invalid_cursor");
  if (typeof v.time !== "string" || !Number.isFinite(Date.parse(v.time)) || typeof v.id !== "string" || v.id.length > 150) throw new Error("invalid_cursor");
  return v;
}
function safeDetails(raw: unknown) {
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { return {}; } }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const input = raw as Record<string, unknown>, result: Record<string, unknown> = {};
  for (const key of ["before","after"]) {
    let snapshot = input[key];
    if (typeof snapshot === "string") { try { snapshot=JSON.parse(snapshot); } catch { snapshot=null; } }
    if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
      const safe: Record<string,unknown> = {};
      for (const field of ["title","contractNumber","validFrom","validTo","active"]) {
        const value=(snapshot as Record<string,unknown>)[field];
        if(value===null || typeof value==="boolean" || typeof value==="number" || typeof value==="string")safe[field]=typeof value==="string"?value.slice(0,4000):value;
      }
      if(Object.keys(safe).length)result[key]=JSON.stringify(safe);
    }
  }
  // Do not expose arbitrary historical payloads (credentials, external message bodies, storage keys).
  for (const key of ["title","fileName","version","reason","previousStatus","newStatus",
    "statusListItemLabel","itemLabel","questionLabel","optionLabel","callbackDate","previousCallbackDate",
    "callbackNote","taskTitle","assignedToName","campaignId","campaignName","outcome"]) {
    const value = input[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null)
      result[key] = typeof value === "string" ? value.slice(0, 4000) : value;
  }
  return result;
}
/** Merge real saved events; source Mission authorization is independent from entity access. */
export async function loadRecordActivity(entity: "clinic" | "hospital", entityId: string, userId: string, campaignId: string | undefined, cursor: RecordActivityCursor | null) {
  const fk = entity === "clinic" ? "clinic_id" : "hospital_id";
  const clinicSource = entity === "clinic" ? `
    UNION ALL SELECT 'clinic:'||e.id,e.event_type,e.created_by,e.created_at,
      jsonb_build_object('title',e.title,'reason',e.description),'Healthcare Network'
    FROM clinic_events e WHERE e.clinic_id=$1 AND $5::boolean` : "";
  const { rows } = await pool.query(`
    WITH viewer AS (SELECT role,role_id FROM users WHERE id=$2),
    authorized_missions AS (
      SELECT c.id FROM campaigns c CROSS JOIN viewer v
      WHERE ($3::varchar IS NULL OR c.id=$3) AND
       (v.role='admin' OR (v.role='manager' AND v.role_id IS NULL) OR
        EXISTS(SELECT 1 FROM campaign_agents ca WHERE ca.campaign_id=c.id AND ca.user_id=$2))
    ), source_events AS (
      SELECT 'audit:'||a.id AS id,a.action,a.user_id,a.created_at,
        COALESCE(indexus_record_activity_details(a.details),'{}'::jsonb) AS details,
        'Healthcare Network'::text AS module
      FROM activity_logs a WHERE a.entity_type=$4 AND a.entity_id=$1 AND ($5::boolean OR a.action LIKE 'agreement_%')
      ${clinicSource}
      UNION ALL SELECT 'mission:'||h.id,h.action,h.user_id,h.created_at,
        COALESCE(h.metadata,'{}'::jsonb) || jsonb_build_object('previousStatus',h.previous_status,
          'newStatus',h.new_status,'reason',h.notes,'campaignId',c.campaign_id),
        'Nexus Pulse'
      FROM campaign_contact_history h JOIN campaign_contacts c ON c.id=h.campaign_contact_id
      WHERE c.${fk}=$1 AND c.campaign_id IN (SELECT id FROM authorized_missions)
    )
    SELECT s.id,s.action,COALESCE(u.full_name,u.username) AS actor,s.created_at AS "createdAt",s.created_at::text AS "_cursorTime",
      s.details,CASE WHEN s.details->>'module'='Nexus Pulse' THEN 'Nexus Pulse' ELSE s.module END AS module
    FROM source_events s LEFT JOIN users u ON u.id=s.user_id
    WHERE (NOT (s.details ? 'campaignId') OR s.details->>'campaignId' IN (SELECT id FROM authorized_missions))
      AND ($3::varchar IS NULL OR NOT (s.details ? 'campaignId') OR s.details->>'campaignId'=$3)
      AND ($6::timestamp IS NULL OR (s.created_at,s.id)<($6::timestamp,$7::text))
    ORDER BY s.created_at DESC,s.id DESC LIMIT 51`,
  [entityId,userId,campaignId || null,entity,!campaignId,cursor?.time || null,cursor?.id || null]);
  const page = rows.slice(0,50);
  const events = page.map(({_cursorTime,...row}) => ({ ...row, details: safeDetails(row.details) }));
  const last = page.at(-1);
  return { events, nextCursor: rows.length > 50 && last ? Buffer.from(JSON.stringify({time:last._cursorTime,id:last.id})).toString("base64url") : null };
}
