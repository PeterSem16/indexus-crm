import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { hostname } from "node:os";
import type { PoolClient } from "pg";
import {
  canonicalTransitionJson, transitionExportPayload, transitionExportSchema, type TransitionExport,
} from "../../shared/status-list-transition-export";
import { statusListWorkflowSchema } from "../../shared/status-list-workflow";
import { optionSourceConfigSchema } from "../../shared/status-list-option-source";

type Client = Pick<PoolClient, "query">;
const sha = (value: unknown) => createHash("sha256").update(canonicalTransitionJson(value)).digest("hex");
const safeReference = (value: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) ? value : sha(value);
// Fixed allowlist. No contact, execution, membership, mailbox credential or message tables.
const tables = [
  ["campaign", "campaigns", "id", "id=$1"],
  ["item", "campaign_status_list_items", "id", "campaign_id=$1"],
  ["question", "campaign_status_list_questions", "id", "item_id IN (SELECT id FROM campaign_status_list_items WHERE campaign_id=$1)"],
  ["automation", "campaign_status_list_automations", "id", "status_list_item_id IN (SELECT id FROM campaign_status_list_items WHERE campaign_id=$1)"],
  ["disposition", "campaign_dispositions", "id", "campaign_id=$1"],
  ["rule", "mission_status_list_rules", "id", "campaign_id=$1"],
  ["source", "mission_status_list_sources", "question_id", "campaign_id=$1"],
  ["option_source", "mission_status_list_option_sources", "group_id", "campaign_id=$1"],
] as const;
const references = [
  ["email_template_id", "email_template", "message_templates"],
  ["sms_template_id", "sms_template", "message_templates"],
  ["task_group_id", "task_group", "task_groups"],
] as const;

/** User-initiated, consistent, read-only evidence export, never a production authentication claim.
 * Raw configuration stays on this server. Only opaque identities/digests leave it.
 * Unsupported/indirect/external dependencies are explicit unknowns, not an empty successful set.
 */
export async function readTransitionExport(client: Client, campaignId: string): Promise<TransitionExport> {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    const { rows: [meta] } = await client.query(`SELECT transaction_timestamp() AS captured_at,
      current_database() AS database_identity, inet_server_addr()::text AS server_identity,
      inet_server_port() AS server_port`);
    const records: TransitionExport["records"] = [];
    const dependencies: TransitionExport["dependencies"] = [];
    const unknowns: TransitionExport["unknowns"] = ["source_identity"];
    const loaded = new Map<string, Map<string, Record<string, any>>>();
    const schema = (await client.query(`SELECT table_name,column_name,data_type,is_nullable,column_default
      FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[])
      ORDER BY table_name,ordinal_position`, [[...tables.map(row => row[1]), ...references.map(row => row[2])]])).rows;
    for (const [kind, table, key, predicate] of tables) {
      const exists = (await client.query("SELECT to_regclass($1) AS relation", [`public.${table}`])).rows[0]?.relation;
      if (!exists) {
        unknowns.push("schema");
        continue;
      }
      const { rows } = await client.query(`SELECT to_jsonb(t) AS config FROM public.${table} t WHERE ${predicate} ORDER BY ${key} LIMIT 30001`, [campaignId]);
      if (rows.length > 30000) throw new Error("inventory_too_large");
      const map = new Map<string, Record<string, any>>();
      for (const { config } of rows) {
        map.set(config[key], config);
        records.push({ kind, id: config[key], digest: sha(config) });
      }
      loaded.set(kind, map);
    }
    if (!loaded.get("campaign")?.has(campaignId)) throw new Error("mission_not_found");
    const link = (owner: string, kind: "item" | "question" | "disposition", target: string) => {
      const config = loaded.get(kind)?.get(target);
      dependencies.push({ owner, kind, target: safeReference(target), state: config ? "present" : loaded.has(kind) ? "missing" : "unknown",
        digest: config ? sha(config) : null });
    };
    for (const [owner, row] of Array.from(loaded.get("item") || [])) {
      if (row.parent_id) link(owner, "item", row.parent_id);
      if (row.next_step_id) {
        const matches = Array.from(loaded.get("item")?.values() || []).filter(target => target.id === row.next_step_id || target.step_id === row.next_step_id);
        if (matches.length === 1) link(owner, "item", matches[0].id);
        else dependencies.push({ owner, kind: "item", target: safeReference(row.next_step_id), state: matches.length ? "unknown" : "missing", digest: null });
      }
    }
    for (const [owner, row] of Array.from(loaded.get("question") || [])) {
      link(owner, "item", row.item_id);
      if (row.goto_question_id) link(owner, "question", row.goto_question_id);
    }
    for (const [owner, row] of Array.from(loaded.get("disposition") || [])) if (row.parent_id) link(owner, "disposition", row.parent_id);
    for (const [owner, row] of Array.from(loaded.get("automation") || [])) {
      link(owner, "item", row.status_list_item_id);
      if (row.question_id) {
        link(owner, "question", row.question_id);
        if (loaded.get("question")?.get(row.question_id)?.item_id !== row.status_list_item_id)
          dependencies[dependencies.length - 1].state = "missing";
      }
      if (row.disposition_id) link(owner, "disposition", row.disposition_id);
      else if (row.action_type === "set_contact_status")
        dependencies.push({ owner, kind: "disposition", target: null, state: "missing", digest: null });
      for (const [field, kind, table] of references) if (row[field]) {
        const exists = (await client.query("SELECT to_regclass($1) AS relation", [`public.${table}`])).rows[0]?.relation;
        const config = exists ? (await client.query(`SELECT to_jsonb(t) AS config FROM public.${table} t WHERE id=$1`, [row[field]])).rows[0]?.config : null;
        const hash = config ? sha(config) : null;
        dependencies.push({ owner, kind, target: safeReference(row[field]), state: !exists ? "unknown" : config ? "present" : "missing", digest: hash });
        if (config && !records.some(record => record.kind === kind && record.id === row[field]))
          records.push({ kind, id: row[field], digest: hash! });
      }
      const external: TransitionExport["dependencies"][number]["kind"][] = [];
      if (row.action_type?.includes("email")) external.push("mailbox");
      if (row.action_type?.includes("sms")) external.push("gateway");
      if (row.target_role || row.action_type === "notify_role") external.push("role_membership");
      if (row.task_group_id) external.push("role_membership");
      if (row.webhook_target || row.action_type === "sys_webhook") external.push("webhook");
      if (!["set_callback", "set_contact_status", "send_email_group", "notify_email", "send_contact_email", "send_sms", "assign_task", "notify_role", "sys_webhook"].includes(row.action_type))
        external.push("workflow_references");
      for (const kind of external) {
        unknowns.push("external_dependencies");
        dependencies.push({ owner, kind, target: null, state: "unknown", digest: null });
      }
    }
    dependencies.push({ owner: campaignId, kind: "schema", target: null,
      state: unknowns.includes("schema") || !schema.length ? "unknown" : "present", digest: sha(schema) });
    // Resolve supported JSON references as well as hashing the complete persisted definitions.
    // Unsupported formats, actor memberships and runtime/chain semantics remain explicit unknowns.
    for (const kind of ["rule", "source", "option_source"] as const) {
      for (const [owner, config] of Array.from(loaded.get(kind) || [])) {
        if (kind === "source") link(owner, "question", owner);
        if (kind === "rule") {
          const parsed = statusListWorkflowSchema.safeParse(config.definition);
          if (parsed.success) {
            const rule = parsed.data;
            link(owner, rule.source.kind, rule.source.id);
            for (const condition of rule.conditions) if (condition.ref) link(owner, condition.ref.kind, condition.ref.id);
            for (const action of [...rule.thenActions, ...rule.elseActions]) link(owner, action.target.kind, action.target.id);
          }
        }
        if (kind === "option_source") {
          link(owner, "item", owner);
          const parsed = optionSourceConfigSchema.safeParse(config.config);
          if (parsed.success) {
            const source = parsed.data;
            const targets = [...Object.values(source.mapping), ...(source.source === "coordinator" ? source.users.map(user => user.optionId) : [])];
            for (const target of targets) {
              link(owner, "item", target);
              if (loaded.get("item")?.get(target)?.parent_id !== owner) dependencies[dependencies.length - 1].state = "missing";
            }
            if (source.source === "coordinator")
              dependencies.push({ owner, kind: "role_membership", target: null, state: "unknown", digest: null });
          }
        }
        const dependencyKind = kind === "rule" ? "workflow_references" : "source_references";
        unknowns.push(dependencyKind);
        dependencies.push({ owner, kind: dependencyKind, target: null, state: "unknown", digest: sha(config) });
      }
    }
    dependencies.push({ owner: campaignId, kind: "executor", target: null, state: "unknown", digest: null });
    let commit: string | null = null;
    try {
      const value = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"] }).trim();
      // A dirty tree is not the code identified by HEAD.
      const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"] }).trim();
      if (/^[a-f0-9]{40}$/.test(value) && !dirty) commit = value;
    } catch { /* Explicit unknown below, no substitute revision. */ }
    if (!commit) unknowns.push("source_commit");
    const runtime = process.env.NODE_ENV === "production" ? "production" :
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" ? "non_production" : "unknown";
    if (runtime === "unknown") unknowns.push("runtime");
    const exportValue: TransitionExport = {
      format: "indexus-transition-inventory-v1", campaignId,
      capturedAt: new Date(meta.captured_at).toISOString(),
      source: {
        instance: sha({ host: hostname(), database: meta.database_identity, server: meta.server_identity, port: meta.server_port }),
        commit, runtime, productionIdentityVerified: false,
      },
      records: records.sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`, "en")),
      dependencies: Array.from(new Map(dependencies.map(row => [`${row.owner}:${row.kind}:${row.target}`, row])).values())
        .sort((a, b) => canonicalTransitionJson(a).localeCompare(canonicalTransitionJson(b), "en")),
      unknowns: Array.from(new Set(unknowns)).sort(), fingerprint: "0".repeat(64), activationAllowed: false,
    };
    exportValue.fingerprint = createHash("sha256").update(transitionExportPayload(exportValue)).digest("hex");
    return transitionExportSchema.parse(exportValue);
  } finally {
    await client.query("ROLLBACK");
  }
}
