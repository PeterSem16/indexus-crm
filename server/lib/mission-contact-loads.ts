import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { contactKinds, entityTables, entityColumns, entityName, digest, membershipHash, planContacts, planCounts, type Candidate, type ContactKind, type PlanItem } from "./mission-contact-load-plan";

export class ContactLoadError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}
export async function ensureContactLoadSchema(database: Pick<Pool, "query">) {
  await database.query(`CREATE TABLE IF NOT EXISTS mission_contact_loads (
    id varchar PRIMARY KEY, campaign_id varchar NOT NULL, actor_id varchar NOT NULL,
    source text NOT NULL CHECK (source IN ('crm','file')), status text NOT NULL DEFAULT 'preview',
    created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes',
    applied_at timestamptz, undone_at timestamptz, scope_hash text NOT NULL,
    membership_hash text NOT NULL, candidates jsonb NOT NULL, items jsonb NOT NULL,
    counts jsonb NOT NULL, added integer NOT NULL DEFAULT 0,
    snapshots jsonb NOT NULL DEFAULT '[]', undo jsonb
  );
  CREATE INDEX IF NOT EXISTS mission_contact_loads_campaign_created ON mission_contact_loads(campaign_id,created_at DESC);`);
}
type DB = Pick<PoolClient, "query">;
const fail = (code: string, status = 409): never => { throw new ContactLoadError(code, status); };
export async function loadAccess(tx: DB, actor: string, campaignId: string) {
  const { rows } = await tx.query(`SELECT c.*,u.role,u.assigned_countries,u.role_id,
    EXISTS(SELECT 1 FROM role_module_permissions p WHERE p.role_id=u.role_id
      AND p.module_key='campaigns' AND p.access='visible' AND p.can_edit) AS module_edit
    FROM campaigns c CROSS JOIN users u WHERE c.id=$1 AND u.id=$2 AND u.is_active`, [campaignId, actor]);
  const c = rows[0];
  if (!c) return fail("forbidden", 403);
  const admin = c.role === "admin";
  if (!admin && (!(c.role === "manager" && !c.role_id || c.module_edit) ||
    !c.country_codes?.length || !c.country_codes.every((v: string) => c.assigned_countries?.includes(v)))) return fail("forbidden", 403);
  if (!c.country_codes?.length) return fail("invalid_input", 400);
  return c;
}
async function transaction<T>(pool: Pool, work: (tx: PoolClient) => Promise<T>): Promise<T> {
  const tx = await pool.connect();
  try {
    await tx.query("BEGIN");
    await tx.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='45s'");
    const result = await work(tx);
    await tx.query("COMMIT");
    return result;
  } catch (error) { await tx.query("ROLLBACK"); throw error; }
  finally { tx.release(); }
}
const scopeHash = (c: any) => digest([c.country_codes, c.criteria]);
const camel = (row: any): Record<string, any> => Object.fromEntries(Object.entries(row).map(([k,v]) => [k.replace(/_([a-z])/g, (_: string,c: string) => c.toUpperCase()), v]));
async function directory(tx: DB, countries: string[]) {
  const result = {} as Record<ContactKind, any[]>;
  for (const type of contactKinds) result[type] = (await tx.query(
    `SELECT * FROM ${entityTables[type]} WHERE ${type === "customer" ? "country" : "country_code"}=ANY($1::text[])`, [countries])).rows;
  return result;
}
export function publicBatch(row: any, includeItems = false) {
  return { id: row.id, source: row.source, status: row.status, createdAt: row.created_at,
    expiresAt: row.expires_at, appliedAt: row.applied_at, counts: row.counts, added: row.added, undo: row.undo,
    ...(includeItems ? { items: row.items.map((v: PlanItem) => ({ row: v.row, name: v.name, country: v.country, disposition: v.disposition, reason: v.reason })) } : {}) };
}
export type CriteriaFilter = (items: any[], criteria: any[]) => any[];
export async function previewLoad(pool: Pool, actor: string, campaignId: string, source: "crm" | "file",
  input: any, filter: CriteriaFilter, file?: (country: string) => Candidate[]) {
  return transaction(pool, async tx => {
    const campaign = await loadAccess(tx, actor, campaignId);
    const entities = await directory(tx, campaign.country_codes);
    let candidates: Candidate[] = [];
    if (source === "file") candidates = file!(campaign.country_codes.length === 1 ? campaign.country_codes[0] : "");
    else {
      const kinds = input.contactSources;
      if (!Array.isArray(kinds) || !kinds.length || kinds.some(v => !contactKinds.includes(v)) || kinds.length > 4) return fail("invalid_input", 400);
      for (const kind of [...new Set(kinds)] as ContactKind[]) {
        let rows = entities[kind].map(camel);
        if (kind === "customer" && campaign.criteria) {
          let criteria;
          try { criteria = typeof campaign.criteria === "string" ? JSON.parse(campaign.criteria) : campaign.criteria; }
          catch { return fail("invalid_input", 400); }
          rows = filter(rows, criteria);
        }
        if (input[`${kind}Criteria`] !== undefined) {
          if (!Array.isArray(input[`${kind}Criteria`])) return fail("invalid_input", 400);
          rows = filter(rows, input[`${kind}Criteria`]);
        }
        for (const row of rows) candidates.push({ type: kind, id: row.id,
          name: kind === "customer" || kind === "collaborator" ? `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() : row.name,
          country: row.countryCode ?? row.country, row: candidates.length + 1 });
      }
    }
    if (candidates.length > 5000) return fail("invalid_input", 413);
    const members = (await tx.query("SELECT * FROM campaign_contacts WHERE campaign_id=$1", [campaignId])).rows;
    const items = planContacts(candidates, members, entities, campaign.country_codes);
    const { rows } = await tx.query(`INSERT INTO mission_contact_loads
      (id,campaign_id,actor_id,source,scope_hash,membership_hash,candidates,items,counts)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [randomUUID(), campaignId, actor, source, scopeHash(campaign), membershipHash(members), JSON.stringify(candidates), JSON.stringify(items), JSON.stringify(planCounts(items))]);
    return publicBatch(rows[0], true);
  });
}
async function lockCampaign(tx: DB, id: string) {
  // Legacy writers do not share an advisory lock. Table locks serialize them too.
  await tx.query("LOCK TABLE customers,clinics,hospitals,collaborators,campaign_contacts IN SHARE ROW EXCLUSIVE MODE");
  await tx.query("SELECT id FROM campaigns WHERE id=$1 FOR UPDATE", [id]);
}
async function getBatch(tx: DB, campaignId: string, batchId: string) {
  const { rows } = await tx.query("SELECT * FROM mission_contact_loads WHERE campaign_id=$1 AND id=$2 FOR UPDATE", [campaignId, batchId]);
  if (!rows[0]) return fail("forbidden", 403);
  return rows[0];
}
async function audit(tx: DB, actor: string, campaign: any, action: string, details: unknown) {
  await tx.query(`INSERT INTO activity_logs(user_id,action,entity_type,entity_id,entity_name,details)
    VALUES($1,$2,'campaign',$3,$4,$5)`, [actor, action, campaign.id, campaign.name, JSON.stringify(details)]);
}
export async function applyLoad(pool: Pool, actor: string, campaignId: string, batchId: string) {
  return transaction(pool, async tx => {
    await loadAccess(tx, actor, campaignId);
    await lockCampaign(tx, campaignId);
    const campaign = await loadAccess(tx, actor, campaignId);
    const batch = await getBatch(tx, campaignId, batchId);
    if (batch.actor_id !== actor) return fail("forbidden", 403);
    if (batch.status === "applied") return { ...publicBatch(batch), existing: batch.counts.existing };
    if (batch.status !== "preview") return fail("stale_preview");
    if (new Date(batch.expires_at).getTime() <= Date.now()) return fail("preview_expired");
    if (scopeHash(campaign) !== batch.scope_hash) return fail("stale_preview");
    const members = (await tx.query("SELECT * FROM campaign_contacts WHERE campaign_id=$1", [campaignId])).rows;
    if (membershipHash(members) !== batch.membership_hash) return fail("stale_preview");
    const items = planContacts(batch.candidates, members, await directory(tx, campaign.country_codes), campaign.country_codes);
    if (digest(items) !== digest(batch.items)) return fail("stale_preview");
    if (items.some(v => v.disposition === "invalid")) return fail("invalid_rows", 400);
    const newItems = items.filter(v => v.disposition === "new");
    if (newItems.length) {
      const phase = await tx.query(`SELECT 1 FROM campaign_contact_phases p JOIN campaign_contacts cc
        ON cc.id=p.contact_id AND cc.campaign_id=p.campaign_id WHERE p.campaign_id=$1 LIMIT 1`, [campaignId]);
      if (phase.rows.length) return fail("phase_policy_required");
    }
    const profiles = new Map<string, {type: ContactKind; keys: string[]; values: unknown[][]}>();
    const enrollments: any[] = [], timeline: any[] = [];
    for (const item of newItems) {
      let entityId = item.id;
      if (!entityId) {
        entityId = randomUUID();
        const data = { ...item.data, id: entityId } as Record<string, unknown>;
        if (item.type === "customer" && !data.email) data.email = `import-${randomUUID()}@noemail.local`;
        // Keys originate only from the server-side parser, never a posted plan.
        const keys = Object.keys(data).sort();
        if (!keys.every(k => /^[a-z_][a-z0-9_]*$/.test(k))) return fail("invalid_input", 400);
        const groupKey = `${item.type}:${keys.join(",")}`;
        const group = profiles.get(groupKey) ?? {type:item.type,keys,values:[]};
        group.values.push(keys.map(k => data[k]));
        profiles.set(groupKey,group);
      }
      const id = randomUUID();
      enrollments.push({id,campaign_id:campaignId,contact_type:item.type,[entityColumns[item.type]]:entityId});
      timeline.push({entity_type:item.type,entity_id:entityId,entity_name:item.name,campaign_id:campaignId,
        campaign_name:campaign.name,campaign_contact_id:id,channel:campaign.channel || "phone",user_id:actor,
        metadata:{source:batch.source,loadBatchId:batchId}});
    }
    for (const group of profiles.values()) {
      for (let offset=0;offset<group.values.length;offset+=250) {
        const chunk=group.values.slice(offset,offset+250);
        await tx.query(`INSERT INTO ${entityTables[group.type]} (${group.keys.map(k=>`"${k}"`).join(",")})
          VALUES ${chunk.map((_,i)=>`(${group.keys.map((_,j)=>`$${i*group.keys.length+j+1}`).join(",")})`).join(",")}`,chunk.flat());
      }
    }
    const snapshots = enrollments.length ? (await tx.query(`INSERT INTO campaign_contacts
      (id,campaign_id,contact_type,customer_id,clinic_id,hospital_id,collaborator_id)
      SELECT id,campaign_id,contact_type,customer_id,clinic_id,hospital_id,collaborator_id
      FROM jsonb_to_recordset($1::jsonb) AS x(id varchar,campaign_id varchar,contact_type text,
        customer_id varchar,clinic_id varchar,hospital_id varchar,collaborator_id varchar)
      RETURNING to_jsonb(campaign_contacts) AS snapshot`,[JSON.stringify(enrollments)])).rows.map(r=>r.snapshot) : [];
    if (timeline.length) await tx.query(`INSERT INTO entity_campaign_timeline
      (entity_type,entity_id,entity_name,campaign_id,campaign_name,campaign_contact_id,channel,action,status,user_id,metadata)
      SELECT entity_type,entity_id,entity_name,campaign_id,campaign_name,campaign_contact_id,channel,'contact_added','pending',user_id,metadata
      FROM jsonb_to_recordset($1::jsonb) AS x(entity_type text,entity_id varchar,entity_name text,
        campaign_id varchar,campaign_name text,campaign_contact_id varchar,channel text,user_id varchar,metadata jsonb)`,
      [JSON.stringify(timeline)]);
    const { rows } = await tx.query(`UPDATE mission_contact_loads SET status='applied',applied_at=now(),added=$2,snapshots=$3
      WHERE id=$1 RETURNING *`, [batchId,snapshots.length,JSON.stringify(snapshots)]);
    await audit(tx,actor,campaign,"mission_contacts_added",{batchId,added:snapshots.length,existing:batch.counts.existing});
    return { ...publicBatch(rows[0]), existing: batch.counts.existing };
  });
}

async function undoCandidates(tx: DB, batch: any, lock: boolean) {
  const ids: string[] = batch.snapshots.map((v: any) => v.id);
  const references = (await tx.query(`SELECT table_name,column_name FROM information_schema.columns
    WHERE table_schema='public' AND (column_name='campaign_contact_id'
      OR table_name='campaign_contact_phases' AND column_name='contact_id')
    ORDER BY table_name,column_name`)).rows;
  // Include sessions, calls, answer state, callback policy and future referencing tables.
  // Readers are not blocked; concurrent writes wait until classification/deletion ends.
  if (references.some(r => !/^[a-z_][a-z0-9_]*$/.test(r.table_name) || !/^[a-z_][a-z0-9_]*$/.test(r.column_name))) return fail("load_failed");
  if (lock && references.length) await tx.query(`LOCK TABLE ${[...new Set(references.map(r => `"${r.table_name}"`))].join(",")} IN SHARE ROW EXCLUSIVE MODE`);
  const referenced = new Set<string>();
  for (const r of references) {
    if (!/^[a-z_][a-z0-9_]*$/.test(r.table_name) || !/^[a-z_][a-z0-9_]*$/.test(r.column_name)) return fail("load_failed");
    const condition = r.table_name === "entity_campaign_timeline"
      ? " AND (action IS DISTINCT FROM 'contact_added' OR metadata->>'loadBatchId' IS DISTINCT FROM $2)" : "";
    const rows = (await tx.query(`SELECT DISTINCT "${r.column_name}" AS id FROM "${r.table_name}"
      WHERE "${r.column_name}"=ANY($1::varchar[])${condition}`, condition ? [ids,batch.id] : [ids])).rows;
    for (const row of rows) referenced.add(row.id);
  }
  const current = (await tx.query("SELECT id,to_jsonb(campaign_contacts) AS snapshot FROM campaign_contacts WHERE campaign_id=$1 AND id=ANY($2::varchar[])", [batch.campaign_id,ids])).rows;
  const originals = new Map<string, any>(batch.snapshots.map((v: any) => [v.id,v]));
  const removable = current.filter(r => !referenced.has(r.id) && digest(r.snapshot) === digest(originals.get(r.id)));
  return { ids: removable.map(r => r.id), removable: removable.length,
    protected: current.length - removable.length, missing: ids.length - current.length };
}
export async function undoLoad(pool: Pool, actor: string, campaignId: string, batchId: string, apply: boolean) {
  return transaction(pool, async tx => {
    await loadAccess(tx, actor, campaignId);
    if (apply) await lockCampaign(tx, campaignId);
    const campaign = await loadAccess(tx, actor, campaignId);
    const batch = await getBatch(tx,campaignId,batchId);
    if (batch.status === "undone") return { ...batch.undo, status: "undone" };
    if (batch.status !== "applied") return fail("stale_preview");
    const result = await undoCandidates(tx,batch,apply);
    if (!apply) return { removable: result.removable, protected: result.protected, missing: result.missing };
    // No history deletion, CRM profile deletion, or restoration of stale agent state.
    await tx.query("DELETE FROM campaign_contacts WHERE campaign_id=$1 AND id=ANY($2::varchar[])", [campaignId,result.ids]);
    const summary = { removed: result.removable, protected: result.protected, missing: result.missing };
    await tx.query("UPDATE mission_contact_loads SET status='undone',undone_at=now(),undo=$2 WHERE id=$1", [batchId,JSON.stringify(summary)]);
    await audit(tx,actor,campaign,"mission_contact_load_undone",{batchId,...summary});
    return { ...summary, status: "undone" };
  });
}
