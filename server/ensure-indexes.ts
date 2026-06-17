import { pool } from "./db";
import type { PoolClient } from "pg";

/**
 * Performance indexes for hot read paths.
 *
 * Production deploy = git pull + build + pm2 restart and does NOT run db:push,
 * so these are created at runtime via CREATE INDEX IF NOT EXISTS (same pattern
 * as idx_contact_field_snapshots_lookup). They run CONCURRENTLY in the
 * background AFTER the server is already listening, so a deploy never blocks on
 * index builds and live writes are never locked.
 *
 * Idempotent: IF NOT EXISTS skips already-built indexes on every restart. If a
 * previous concurrent build was interrupted it can leave an INVALID index; we
 * drop those first so they get rebuilt (IF NOT EXISTS alone would skip them).
 */

type IndexDef = { name: string; table: string; columns: string };

const INDEXES: IndexDef[] = [
  // campaign_contacts — agent queues, campaign detail lists, entity timelines
  { name: "idx_campaign_contacts_campaign_status", table: "campaign_contacts", columns: "campaign_id, status" },
  { name: "idx_campaign_contacts_customer", table: "campaign_contacts", columns: "customer_id" },
  { name: "idx_campaign_contacts_assigned_to", table: "campaign_contacts", columns: "assigned_to" },
  { name: "idx_campaign_contacts_callback_date", table: "campaign_contacts", columns: "callback_date" },
  { name: "idx_campaign_contacts_hospital", table: "campaign_contacts", columns: "hospital_id" },
  { name: "idx_campaign_contacts_clinic", table: "campaign_contacts", columns: "clinic_id" },
  { name: "idx_campaign_contacts_collaborator", table: "campaign_contacts", columns: "collaborator_id" },

  // call_logs — call history, reports, customer detail
  { name: "idx_call_logs_customer", table: "call_logs", columns: "customer_id" },
  { name: "idx_call_logs_campaign", table: "call_logs", columns: "campaign_id" },
  { name: "idx_call_logs_contact", table: "call_logs", columns: "campaign_contact_id" },
  { name: "idx_call_logs_user", table: "call_logs", columns: "user_id" },
  { name: "idx_call_logs_created_at", table: "call_logs", columns: "created_at" },
  { name: "idx_call_logs_inbound", table: "call_logs", columns: "inbound_call_log_id" },

  // communication_messages — email/sms history
  { name: "idx_comm_messages_customer", table: "communication_messages", columns: "customer_id" },
  { name: "idx_comm_messages_contract", table: "communication_messages", columns: "contract_id" },
  { name: "idx_comm_messages_external", table: "communication_messages", columns: "external_id" },
  { name: "idx_comm_messages_created_at", table: "communication_messages", columns: "created_at" },

  // tasks — tasks page, back-office board
  { name: "idx_tasks_assigned_user", table: "tasks", columns: "assigned_user_id" },
  { name: "idx_tasks_status", table: "tasks", columns: "status" },
  { name: "idx_tasks_bo_state", table: "tasks", columns: "bo_state" },
  { name: "idx_tasks_customer", table: "tasks", columns: "customer_id" },
  { name: "idx_tasks_related_entity", table: "tasks", columns: "related_entity_type, related_entity_id" },
  { name: "idx_tasks_source_run", table: "tasks", columns: "source_run_id" },
  { name: "idx_tasks_country", table: "tasks", columns: "country" },

  // task_comments / task_group_members
  { name: "idx_task_comments_task", table: "task_comments", columns: "task_id" },
  { name: "idx_task_group_members_group", table: "task_group_members", columns: "group_id" },
  { name: "idx_task_group_members_user", table: "task_group_members", columns: "user_id" },

  // activity_logs — audit/timeline
  { name: "idx_activity_logs_entity", table: "activity_logs", columns: "entity_type, entity_id" },
  { name: "idx_activity_logs_user", table: "activity_logs", columns: "user_id" },
  { name: "idx_activity_logs_created_at", table: "activity_logs", columns: "created_at" },

  // customer_notes / customer_documents
  { name: "idx_customer_notes_customer", table: "customer_notes", columns: "customer_id" },
  { name: "idx_customer_documents_customer", table: "customer_documents", columns: "customer_id" },

  // invoices / invoice_items
  { name: "idx_invoices_customer", table: "invoices", columns: "customer_id" },
  { name: "idx_invoices_status", table: "invoices", columns: "status" },
  { name: "idx_invoice_items_invoice", table: "invoice_items", columns: "invoice_id" },

  // collections
  { name: "idx_collections_customer", table: "collections", columns: "customer_id" },
  { name: "idx_collections_hospital", table: "collections", columns: "hospital_id" },
  { name: "idx_collections_country", table: "collections", columns: "country_code" },
  { name: "idx_collections_cbu", table: "collections", columns: "cbu_number" },

  // clinics / hospitals / collaborators — country & relationship filters
  { name: "idx_clinics_country", table: "clinics", columns: "country_code" },
  { name: "idx_hospitals_country", table: "hospitals", columns: "country_code" },
  { name: "idx_hospitals_representative", table: "hospitals", columns: "representative_id" },
  { name: "idx_collaborators_country", table: "collaborators", columns: "country_code" },
  { name: "idx_collaborators_hospital", table: "collaborators", columns: "hospital_id" },
  { name: "idx_collaborators_clinic", table: "collaborators", columns: "clinic_id" },
  { name: "idx_collaborators_mobile_username", table: "collaborators", columns: "mobile_username" },

  // customers — list, search, filters
  { name: "idx_customers_country_status", table: "customers", columns: "country, client_status" },
  { name: "idx_customers_assigned_user", table: "customers", columns: "assigned_user_id" },
  { name: "idx_customers_internal_id", table: "customers", columns: "internal_id" },
  { name: "idx_customers_email", table: "customers", columns: "email" },
  { name: "idx_customers_national_id", table: "customers", columns: "national_id" },

  // notifications — bell
  { name: "idx_notifications_user_read", table: "notifications", columns: "user_id, is_read" },
  { name: "idx_notifications_user_created", table: "notifications", columns: "user_id, created_at" },

  // sessions
  { name: "idx_user_sessions_user_active", table: "user_sessions", columns: "user_id, is_active" },
  { name: "idx_agent_sessions_user", table: "agent_sessions", columns: "user_id" },
  { name: "idx_agent_sessions_status", table: "agent_sessions", columns: "status" },

  // campaign contact related — history, sessions, status-list state, agents
  { name: "idx_cc_history_contact", table: "campaign_contact_history", columns: "campaign_contact_id" },
  { name: "idx_cc_sessions_contact", table: "campaign_contact_sessions", columns: "campaign_contact_id" },
  { name: "idx_cc_status_state_contact", table: "campaign_contact_status_list_state", columns: "campaign_contact_id" },
  { name: "idx_cc_status_state_item", table: "campaign_contact_status_list_state", columns: "campaign_contact_id, status_list_item_id" },
  { name: "idx_campaign_agents_campaign", table: "campaign_agents", columns: "campaign_id" },
  { name: "idx_campaign_agents_user", table: "campaign_agents", columns: "user_id" },

  // inbound_call_logs
  { name: "idx_inbound_call_logs_customer", table: "inbound_call_logs", columns: "customer_id" },
  { name: "idx_inbound_call_logs_queue", table: "inbound_call_logs", columns: "queue_id" },
  { name: "idx_inbound_call_logs_status", table: "inbound_call_logs", columns: "status" },

  // web_form_submissions
  { name: "idx_web_form_submissions_form", table: "web_form_submissions", columns: "form_id" },
  { name: "idx_web_form_submissions_customer", table: "web_form_submissions", columns: "customer_id" },

  // contact_assignments — polymorphic entity lookups
  { name: "idx_contact_assignments_entity", table: "contact_assignments", columns: "entity_type, entity_id" },
  { name: "idx_contact_assignments_person", table: "contact_assignments", columns: "person_id" },
];

// All index names/tables/columns above are hardcoded constants (never user
// input), so the SQL interpolation below has no injection surface.
async function ensureOne(client: PoolClient, def: IndexDef): Promise<void> {
  try {
    // Drop an invalid leftover from a previously interrupted concurrent build,
    // otherwise CREATE INDEX ... IF NOT EXISTS would skip it forever.
    await client.query(`
      DO $$
      DECLARE v_valid boolean;
      BEGIN
        SELECT i.indisvalid INTO v_valid
        FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
        WHERE c.relname = '${def.name}';
        IF v_valid = false THEN
          EXECUTE 'DROP INDEX IF EXISTS ${def.name}';
        END IF;
      END $$;
    `);
    await client.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${def.name} ON ${def.table} (${def.columns})`,
    );
  } catch (e: any) {
    console.error(`[index] ${def.name} failed: ${e.message}`);
  }
}

let started = false;

// Arbitrary constant identifying the index-maintenance advisory lock.
const INDEX_LOCK_KEY = 427180173;

/**
 * Build all performance indexes sequentially in the background. Safe to call on
 * every startup; already-built indexes are skipped via IF NOT EXISTS. Runs one
 * index at a time so a deploy never floods the DB with concurrent builds.
 *
 * A session-level advisory lock guarantees only one app process runs the index
 * maintenance at a time (e.g. during overlapping pm2 restarts). The lock is
 * held on a single dedicated client for the whole run — required because both
 * advisory locks and CREATE INDEX CONCURRENTLY are session-scoped (and the
 * latter cannot run inside a transaction), and pooled queries may otherwise
 * land on different connections.
 */
export async function ensureIndexes(): Promise<void> {
  if (started) return;
  started = true;

  const client = await pool.connect();
  let locked = false;
  try {
    const r = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [
      INDEX_LOCK_KEY,
    ]);
    locked = r.rows?.[0]?.locked === true;
    if (!locked) {
      console.log("[index] another process holds the index lock, skipping");
      return;
    }
    const t0 = Date.now();
    for (const def of INDEXES) {
      await ensureOne(client, def);
    }
    console.log(
      `[index] ensure complete: ${INDEXES.length} indexes checked in ${Date.now() - t0}ms`,
    );
  } catch (e: any) {
    console.error(`[index] ensure error: ${e?.message || e}`);
  } finally {
    if (locked) {
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [INDEX_LOCK_KEY]);
      } catch {
        /* ignore unlock errors */
      }
    }
    client.release();
  }
}
