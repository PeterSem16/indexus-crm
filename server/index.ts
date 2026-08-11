import express, { type Request, Response, NextFunction } from "express";
import { gzip } from "zlib";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startAlertEvaluator } from "./alert-evaluator";
import { startSessionCleanup } from "./session-cleanup";
import { startScheduledReportRunner } from "./scheduled-report-runner";
import { startKpiSnapshotCron } from "./kpi-snapshot-cron";
import { ensureIndexes } from "./ensure-indexes";
import { pool } from "./db";

process.on('SIGHUP', () => {
  console.log('[server] Received SIGHUP, shutting down...');
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('[server] Received SIGTERM, shutting down...');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('[server] Received SIGINT, shutting down...');
  process.exit(0);
});

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});

// Transparently gzip large JSON API responses using Node's built-in zlib (no
// extra dependency, so the documented prod deploy that skips `npm install` keeps
// working). Same data, smaller payload on the wire = faster responses for big
// list endpoints. Scoped to res.json only, so file downloads, static assets,
// SSE and WebSocket upgrades are never touched. Registered BEFORE the request
// logger below so its body capture keeps working (logger wraps this wrapper).
const GZIP_MIN_BYTES = 1024;
function clientAcceptsGzip(acceptEncoding: string): boolean {
  // Respect an explicit refusal like "gzip;q=0"; accept "gzip" or "gzip;q=0.x".
  const m = acceptEncoding
    .toLowerCase()
    .match(/(?:^|,)\s*gzip\s*(?:;\s*q\s*=\s*([0-9.]+))?/);
  if (!m) return false;
  return m[1] === undefined || parseFloat(m[1]) > 0;
}
app.use((req, res, next) => {
  const original = res.json.bind(res);
  res.json = function (body?: any) {
    const acceptEncoding = String(req.headers["accept-encoding"] || "");
    if (
      req.method === "HEAD" ||
      body == null ||
      res.headersSent ||
      !clientAcceptsGzip(acceptEncoding)
    ) {
      return original(body);
    }
    let json: string;
    try {
      json = JSON.stringify(body);
    } catch {
      return original(body);
    }
    if (!json || Buffer.byteLength(json) < GZIP_MIN_BYTES) {
      return original(body);
    }
    gzip(json, (err, buf) => {
      if (err || res.headersSent) {
        try {
          original(body);
        } catch {
          /* response already gone */
        }
        return;
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Vary", "Accept-Encoding");
      res.setHeader("Content-Length", String(buf.length));
      res.end(buf);
    });
    return res;
  };
  next();
});

app.use("/udid/callback", express.raw({ type: "*/*", limit: "1mb" }));

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    await pool.query(`
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS gynecologist_name TEXT;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS gynecologist_phone TEXT;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS gynecologist_email TEXT;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS expected_delivery_date TIMESTAMP;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS registration_source TEXT;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS registration_date TIMESTAMP;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS hospital_name TEXT;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
      ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
      ALTER TABLE clinics ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
      ALTER TABLE users ADD COLUMN IF NOT EXISTS missed_call_email_notification boolean NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS position text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS standing_forward_enabled boolean NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS standing_forward_ring_seconds integer NOT NULL DEFAULT 25;
      ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS callback_status_list_item_id varchar;
      ALTER TABLE campaign_contact_status_list_state ADD COLUMN IF NOT EXISTS item_note TEXT;
      ALTER TABLE campaign_contact_status_list_state ADD COLUMN IF NOT EXISTS note_updated_at TIMESTAMP;
      CREATE TABLE IF NOT EXISTS agent_standing_forwards (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        inbound_queue_id varchar NOT NULL REFERENCES inbound_queues(id) ON DELETE CASCADE,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    console.log('[migration] Customer columns ensured');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaign_status_list_questions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id varchar NOT NULL,
        group_name text,
        question_text text NOT NULL,
        sort_order integer NOT NULL DEFAULT 0,
        logic_operator text NOT NULL DEFAULT 'OR',
        goto_question_id varchar,
        required boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);
    console.log('[migration] campaign_status_list_questions ensured');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS collaborator_update_campaigns (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        sender_country_code text NOT NULL,
        email_subject text NOT NULL,
        email_body text NOT NULL,
        language text NOT NULL DEFAULT 'auto',
        token_valid_days integer NOT NULL DEFAULT 30,
        filter_criteria jsonb DEFAULT '{}'::jsonb,
        status text NOT NULL DEFAULT 'draft',
        created_by varchar,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS collaborator_update_requests (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id varchar NOT NULL,
        collaborator_id varchar NOT NULL,
        token varchar NOT NULL UNIQUE,
        email text NOT NULL,
        language text NOT NULL DEFAULT 'sk',
        status text NOT NULL DEFAULT 'pending',
        send_error text,
        sent_at timestamp,
        reminded_at timestamp,
        opened_at timestamp,
        submitted_at timestamp,
        expires_at timestamp NOT NULL,
        submitted_data jsonb,
        changes jsonb,
        reviewed_by varchar,
        reviewed_at timestamp,
        review_note text,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_cureq_campaign ON collaborator_update_requests(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_cureq_collaborator ON collaborator_update_requests(collaborator_id);
      CREATE INDEX IF NOT EXISTS idx_cureq_status ON collaborator_update_requests(status);
      ALTER TABLE collaborator_update_campaigns
        ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'auto';
      ALTER TABLE collaborator_update_campaigns
        ADD COLUMN IF NOT EXISTS form_type text NOT NULL DEFAULT 'update';
      ALTER TABLE collaborator_update_campaigns
        ADD COLUMN IF NOT EXISTS send_started_at timestamp;
      ALTER TABLE collaborator_update_campaigns
        ADD COLUMN IF NOT EXISTS send_paused_at timestamp;
      ALTER TABLE collaborator_update_campaigns
        ADD COLUMN IF NOT EXISTS send_finished_at timestamp;
      ALTER TABLE collaborator_update_campaigns
        ADD COLUMN IF NOT EXISTS sender_type text NOT NULL DEFAULT 'system';
      ALTER TABLE collaborator_update_campaigns
        ADD COLUMN IF NOT EXISTS sender_user_id varchar;
      ALTER TABLE collaborator_update_campaigns
        ADD COLUMN IF NOT EXISTS sender_custom_email text;
      ALTER TABLE collaborator_update_campaigns
        ADD COLUMN IF NOT EXISTS sender_custom_display_name text;
      ALTER TABLE collaborator_update_campaigns
        ADD COLUMN IF NOT EXISTS sender_custom_access_token text;
      ALTER TABLE collaborator_update_campaigns
        ADD COLUMN IF NOT EXISTS sender_custom_refresh_token text;
      ALTER TABLE collaborator_update_campaigns
        ADD COLUMN IF NOT EXISTS sender_custom_token_expires_at timestamp;
      ALTER TABLE ms365_pkce_store
        ALTER COLUMN country_code TYPE varchar(64);
    `);
    console.log('[migration] collaborator_update tables ensured');

    await pool.query(`
      ALTER TABLE campaign_status_list_automations
        ADD COLUMN IF NOT EXISTS question_id varchar;
    `);
    console.log('[migration] question_id column ensured on automations');

    await pool.query(`
      ALTER TABLE campaign_status_list_questions
        ADD COLUMN IF NOT EXISTS icon text,
        ADD COLUMN IF NOT EXISTS color text;
    `);
    console.log('[migration] icon/color columns ensured on questions');

    await pool.query(`
      ALTER TABLE campaign_status_list_questions
        ADD COLUMN IF NOT EXISTS description text;
    `);
    console.log('[migration] description column ensured on questions');

    await pool.query(`
      ALTER TABLE campaign_status_list_questions
        ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS field_type text NOT NULL DEFAULT 'checkbox';
    `);
    console.log('[migration] is_hidden/field_type columns ensured on questions');

    await pool.query(`
      ALTER TABLE campaign_status_list_items
        ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
    `);
    console.log('[migration] is_hidden column ensured on status list items');

    await pool.query(`
      ALTER TABLE campaign_status_list_items
        ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'step',
        ADD COLUMN IF NOT EXISTS color TEXT;
    `);
    console.log('[migration] item_type/color columns ensured on status list items');

    await pool.query(`
      ALTER TABLE campaign_status_list_automations
        ADD COLUMN IF NOT EXISTS condition_json text,
        ADD COLUMN IF NOT EXISTS webhook_target text,
        ADD COLUMN IF NOT EXISTS assign_notify boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS assign_notify_channels text[] NOT NULL DEFAULT ARRAY[]::text[];
    `);
    console.log('[migration] condition_json/webhook_target/assign_notify ensured on automations');

    await pool.query(`
      ALTER TABLE campaign_status_list_automations
        ADD COLUMN IF NOT EXISTS email_recipients text[] NOT NULL DEFAULT ARRAY[]::text[],
        ADD COLUMN IF NOT EXISTS callback_offset_days integer;
    `);
    console.log('[migration] email_recipients/callback_offset_days ensured on automations');

    await pool.query(`
      ALTER TABLE campaign_status_list_automations
        ADD COLUMN IF NOT EXISTS callback_time text,
        ADD COLUMN IF NOT EXISTS notify_agent_pulse boolean NOT NULL DEFAULT false;
    `);
    console.log('[migration] callback_time/notify_agent_pulse ensured on automations');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS entity_notes (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type text NOT NULL,
        entity_id varchar NOT NULL,
        user_id varchar NOT NULL,
        content text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_entity_notes_entity ON entity_notes (entity_type, entity_id);
    `);
    console.log('[migration] entity_notes table ensured');

    await pool.query(`
      ALTER TABLE customer_notes ADD COLUMN IF NOT EXISTS badge text;
      ALTER TABLE entity_notes ADD COLUMN IF NOT EXISTS badge text;
    `);
    console.log('[migration] note badge columns ensured');

    // One-time repair for "zombie" callbacks: a previous bug could set
    // status='callback_scheduled' without a callback_date, which the agent queue
    // silently excludes (it requires callback_date IS NOT NULL). Fill the missing
    // date with when it was scheduled (updated_at) so these already-pending
    // callbacks reappear in the queue. Idempotent: once filled there are no NULL
    // rows left, so reruns touch nothing.
    const zombieFix = await pool.query(`
      UPDATE campaign_contacts
        SET callback_date = updated_at
      WHERE status = 'callback_scheduled' AND callback_date IS NULL;
    `);
    console.log(`[migration] callback_scheduled zombie dates backfilled: ${zombieFix.rowCount ?? 0}`);

    await pool.query(`
      UPDATE hospitals SET full_name = name WHERE (full_name IS NULL OR full_name = '' OR full_name = '-') AND name IS NOT NULL AND name != '' AND name != '-';
      UPDATE hospitals SET name = full_name WHERE (name IS NULL OR name = '' OR name = '-') AND full_name IS NOT NULL AND full_name != '' AND full_name != '-';
    `);
    console.log('[migration] Hospital full_name synced');

    await pool.query(`
      UPDATE customers 
      SET client_status = 'in_process', 
          registration_source = 'web_form',
          registration_date = COALESCE(
            (SELECT MIN(s.created_at) FROM web_form_submissions s WHERE s.customer_id = customers.id),
            NOW()
          )
      WHERE id IN (SELECT DISTINCT customer_id FROM web_form_submissions WHERE customer_id IS NOT NULL)
        AND client_status = 'potential'
        AND (registration_source IS NULL OR registration_source = '');
    `);
    console.log('[migration] Updated web form customers to in_process');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_groups (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        description text,
        color text DEFAULT '#3b82f6',
        icon text DEFAULT 'Users',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS task_group_members (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id varchar NOT NULL,
        user_id varchar NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
      ALTER TABLE campaign_status_list_automations
        ADD COLUMN IF NOT EXISTS task_group_id varchar;
      ALTER TABLE task_groups
        ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
      ALTER TABLE task_groups
        ADD COLUMN IF NOT EXISTS display_alias text;
      ALTER TABLE task_groups
        ADD COLUMN IF NOT EXISTS is_back_office boolean DEFAULT false;
    `);
    console.log('[migration] task_groups / task_group_members / task_group_id ensured');

    await pool.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS bo_state text NOT NULL DEFAULT 'received';
      ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'comment';
      ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
    `);
    console.log('[migration] bo_state + task_comments kind/metadata ensured');
  } catch (e: any) {
    console.error('[migration] Error:', e.message);
  }

  // contact_field_snapshots — delta tracking for field_changed_to automation conditions
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contact_field_snapshots (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id VARCHAR NOT NULL,
        campaign_id VARCHAR,
        field_name TEXT NOT NULL,
        last_value TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_contact_field_snapshots_lookup
        ON contact_field_snapshots (contact_id, field_name, campaign_id);
      DO $$ BEGIN
        ALTER TABLE contact_field_snapshots
          ADD CONSTRAINT contact_field_snapshots_unique
          UNIQUE NULLS NOT DISTINCT (contact_id, campaign_id, field_name);
      EXCEPTION WHEN duplicate_table THEN NULL;
               WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log('[migration] contact_field_snapshots ensured');
  } catch (e: any) {
    console.error('[migration] contact_field_snapshots error:', e.message);
  }

  try {
    await pool.query(`
      ALTER TABLE campaign_status_list_items
        ADD COLUMN IF NOT EXISTS auto_confirm_on_sub_question BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    console.log('[migration] campaign_status_list_items auto_confirm_on_sub_question ensured');
  } catch (e: any) {
    console.error('[migration] campaign_status_list_items auto_confirm col error:', e.message);
  }

  try {
    await pool.query(`
      ALTER TABLE campaign_status_list_items
        ADD COLUMN IF NOT EXISTS tab TEXT;
    `);
    console.log('[migration] campaign_status_list_items tab column ensured');
  } catch (e: any) {
    console.error('[migration] campaign_status_list_items tab col error:', e.message);
  }

  try {
    await pool.query(`
      ALTER TABLE campaign_status_list_items
        ADD COLUMN IF NOT EXISTS question_selection_mode TEXT NOT NULL DEFAULT 'multiple';
    `);
    console.log('[migration] campaign_status_list_items question_selection_mode ensured');
  } catch (e: any) {
    console.error('[migration] campaign_status_list_items question_selection_mode error:', e.message);
  }

  try {
    await pool.query(`
      ALTER TABLE campaign_status_list_items
        ADD COLUMN IF NOT EXISTS canonical_clinic_status_key TEXT;
    `);
    console.log('[migration] campaign_status_list_items canonical_clinic_status_key ensured');
  } catch (e: any) {
    console.error('[migration] campaign_status_list_items canonical_clinic_status_key error:', e.message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clinic_cooperation_statuses (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id VARCHAR NOT NULL,
        status_key TEXT NOT NULL,
        phase TEXT NOT NULL,
        campaign_contact_id VARCHAR,
        status_list_item_id VARCHAR,
        confirmed_by_user_id VARCHAR,
        confirmed_at TIMESTAMP NOT NULL DEFAULT now(),
        note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_clinic_coop_clinic ON clinic_cooperation_statuses(clinic_id);
      CREATE INDEX IF NOT EXISTS idx_clinic_coop_key ON clinic_cooperation_statuses(clinic_id, status_key);
      CREATE INDEX IF NOT EXISTS idx_clinic_coop_phase ON clinic_cooperation_statuses(clinic_id, phase);
    `);
    console.log('[migration] clinic_cooperation_statuses table ensured');
  } catch (e: any) {
    console.error('[migration] clinic_cooperation_statuses error:', e.message);
  }

  try {
    await pool.query(`
      ALTER TABLE ivr_messages
        ADD COLUMN IF NOT EXISTS prepend_ringtone BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS ring_count INTEGER NOT NULL DEFAULT 3,
        ADD COLUMN IF NOT EXISTS ringtone_only BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    console.log('[migration] ivr_messages ringtone columns ensured');
  } catch (e: any) {
    console.error('[migration] ivr_messages ringtone columns error:', e.message);
  }

  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_sender_id TEXT;
    `);
    console.log('[migration] users sms_sender_id column ensured');
  } catch (e: any) {
    console.error('[migration] users sms_sender_id error:', e.message);
  }

  try {
    await pool.query(`
      ALTER TABLE communication_messages
        ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound',
        ADD COLUMN IF NOT EXISTS sender_phone TEXT,
        ADD COLUMN IF NOT EXISTS contract_id VARCHAR,
        ADD COLUMN IF NOT EXISTS ai_analyzed BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS ai_sentiment TEXT,
        ADD COLUMN IF NOT EXISTS ai_alert_level TEXT,
        ADD COLUMN IF NOT EXISTS ai_has_angry_tone BOOLEAN,
        ADD COLUMN IF NOT EXISTS ai_has_rude_expressions BOOLEAN,
        ADD COLUMN IF NOT EXISTS ai_wants_to_cancel BOOLEAN,
        ADD COLUMN IF NOT EXISTS ai_wants_consent BOOLEAN,
        ADD COLUMN IF NOT EXISTS ai_does_not_accept_contract BOOLEAN,
        ADD COLUMN IF NOT EXISTS ai_analysis_note TEXT,
        ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMP;
    `);
    console.log('[migration] communication_messages direction + sender_phone + AI columns ensured');
  } catch (e: any) {
    console.error('[migration] communication_messages columns error:', e.message);
  }

  try {
    await pool.query(`
      ALTER TABLE campaign_status_list_automations
        ADD COLUMN IF NOT EXISTS task_deadline_offset text,
        ADD COLUMN IF NOT EXISTS task_priority text NOT NULL DEFAULT 'medium',
        ADD COLUMN IF NOT EXISTS disposition_id varchar;
    `);
    console.log('[migration] campaign_status_list_automations task_deadline_offset/task_priority/disposition_id ensured');
  } catch (e: any) {
    console.error('[migration] campaign_status_list_automations new cols error:', e.message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaign_contact_status_list_state (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_contact_id varchar NOT NULL,
        status_list_item_id varchar NOT NULL,
        confirmed_at timestamp NOT NULL DEFAULT now(),
        confirmed_by_user_id text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    console.log('[migration] campaign_contact_status_list_state table ensured');
  } catch (e: any) {
    console.error('[migration] campaign_contact_status_list_state table error:', e.message);
  }
  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cc_status_state_contact ON campaign_contact_status_list_state (campaign_contact_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cc_status_state_item ON campaign_contact_status_list_state (campaign_contact_id, status_list_item_id)`);
    console.log('[migration] campaign_contact_status_list_state indexes ensured');
  } catch (e: any) {
    console.error('[migration] campaign_contact_status_list_state index error:', e.message);
  }

  try {
    await pool.query(`
      ALTER TABLE task_back_office_confirmations
        ADD COLUMN IF NOT EXISTS status_list_item_id varchar,
        ADD COLUMN IF NOT EXISTS campaign_contact_id varchar;
    `);
    console.log('[migration] task_back_office_confirmations sl columns ensured');
  } catch (e: any) {
    console.error('[migration] task_back_office_confirmations sl columns error:', e.message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pricing_components (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL UNIQUE,
        name text NOT NULL,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS pricing_products (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL UNIQUE,
        name text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS pricing_product_components (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id varchar NOT NULL,
        component_id varchar NOT NULL,
        CONSTRAINT uq_pricing_product_component UNIQUE (product_id, component_id)
      );
      CREATE TABLE IF NOT EXISTS pricing_price_lists (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        country_code text NOT NULL,
        currency text NOT NULL,
        name text NOT NULL,
        valid_from date NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        inflation_rate_pct numeric(6,3),
        inflation_condition text,
        fx_rate_to_eur numeric(12,4),
        storage_year_options jsonb,
        note text,
        approved_by varchar,
        approved_at timestamp,
        created_by varchar,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_ppl_country_status ON pricing_price_lists (country_code, status);
      CREATE TABLE IF NOT EXISTS pricing_collection_prices (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        price_list_id varchar NOT NULL,
        product_id varchar,
        component_id varchar,
        price numeric(14,2) NOT NULL,
        note text
      );
      CREATE INDEX IF NOT EXISTS idx_pcp_list ON pricing_collection_prices (price_list_id);
      CREATE TABLE IF NOT EXISTS pricing_storage_prices (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        price_list_id varchar NOT NULL,
        product_id varchar,
        component_id varchar,
        years integer NOT NULL,
        price numeric(14,2) NOT NULL,
        note text
      );
      CREATE INDEX IF NOT EXISTS idx_psp_list ON pricing_storage_prices (price_list_id);
      CREATE TABLE IF NOT EXISTS pricing_storage_discounts (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        price_list_id varchar NOT NULL,
        years integer NOT NULL,
        discount_pct numeric(6,3) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pricing_installment_plans (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        price_list_id varchar NOT NULL,
        installments integer NOT NULL,
        surcharge_pct numeric(6,3) NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS pricing_incomplete_rules (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        price_list_id varchar NOT NULL,
        ordered_product_id varchar NOT NULL,
        collected_mask text NOT NULL,
        result_label text NOT NULL,
        collection_price numeric(14,2) NOT NULL,
        storage_prices jsonb,
        is_override boolean NOT NULL DEFAULT false,
        note text,
        CONSTRAINT uq_pir_list_product_mask UNIQUE (price_list_id, ordered_product_id, collected_mask)
      );
      CREATE INDEX IF NOT EXISTS idx_pir_list ON pricing_incomplete_rules (price_list_id);
      CREATE TABLE IF NOT EXISTS pricing_adjustment_rules (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        price_list_id varchar NOT NULL,
        rule_type text NOT NULL,
        amount numeric(14,2),
        pct numeric(6,3),
        note text
      );
      CREATE TABLE IF NOT EXISTS pricing_product_costs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        country_code text NOT NULL,
        product_label text NOT NULL,
        gross_revenue_eur numeric(14,2),
        total_cost_eur numeric(14,2),
        note text,
        CONSTRAINT uq_ppc_country_label UNIQUE (country_code, product_label)
      );
      CREATE TABLE IF NOT EXISTS pricing_customer_price_lists (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id varchar NOT NULL,
        price_list_id varchar NOT NULL,
        assigned_at timestamp NOT NULL DEFAULT now(),
        assigned_by varchar,
        note text
      );
      CREATE INDEX IF NOT EXISTS idx_pcpl_customer ON pricing_customer_price_lists (customer_id);
      ALTER TABLE pricing_adjustment_rules ADD COLUMN IF NOT EXISTS applies_to text;
      ALTER TABLE pricing_adjustment_rules ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
      ALTER TABLE pricing_adjustment_rules ADD COLUMN IF NOT EXISTS volume_operator text;
      ALTER TABLE pricing_adjustment_rules ADD COLUMN IF NOT EXISTS volume_min_ml numeric(8,2);
      ALTER TABLE pricing_adjustment_rules ADD COLUMN IF NOT EXISTS volume_max_ml numeric(8,2);
      UPDATE pricing_adjustment_rules SET volume_operator = 'lt', volume_max_ml = 20 WHERE rule_type = 'LOW_VOLUME' AND volume_operator IS NULL;
      DELETE FROM pricing_storage_discounts a USING pricing_storage_discounts b WHERE a.id > b.id AND a.price_list_id = b.price_list_id AND a.years = b.years;
      DELETE FROM pricing_installment_plans a USING pricing_installment_plans b WHERE a.id > b.id AND a.price_list_id = b.price_list_id AND a.installments = b.installments;
      ALTER TABLE pricing_collection_prices ADD COLUMN IF NOT EXISTS max_collection_discount_pct decimal(5,2);
      ALTER TABLE pricing_price_lists ADD COLUMN IF NOT EXISTS fx_rate_mode text DEFAULT 'fixed';
      ALTER TABLE pricing_price_lists ADD COLUMN IF NOT EXISTS inflation_year integer;
      ALTER TABLE pricing_price_lists ADD COLUMN IF NOT EXISTS inflation_apply boolean DEFAULT false;
      CREATE UNIQUE INDEX IF NOT EXISTS pricing_storage_discounts_list_years_uq ON pricing_storage_discounts (price_list_id, years);
      CREATE UNIQUE INDEX IF NOT EXISTS pricing_installment_plans_list_count_uq ON pricing_installment_plans (price_list_id, installments);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_pcp_list_target
        ON pricing_collection_prices (price_list_id, coalesce(product_id,''), coalesce(component_id,''));
      CREATE UNIQUE INDEX IF NOT EXISTS uq_psp_list_target_years
        ON pricing_storage_prices (price_list_id, coalesce(product_id,''), coalesce(component_id,''), years);
      ALTER TABLE pricing_product_costs ADD COLUMN IF NOT EXISTS rezia_eur numeric(14,2);
      ALTER TABLE pricing_product_costs ADD COLUMN IF NOT EXISTS price_list_id varchar;
      DO $$ BEGIN
        BEGIN
          ALTER TABLE pricing_product_costs DROP CONSTRAINT uq_ppc_country_label;
        EXCEPTION WHEN undefined_object THEN NULL;
        END;
      END $$;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ppc_country_label_pricelist
        ON pricing_product_costs (country_code, product_label, COALESCE(price_list_id,''));
      CREATE TABLE IF NOT EXISTS pricing_margin_otps (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        otp_code text NOT NULL,
        expires_at timestamp NOT NULL,
        used_at timestamp
      );
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='pricing_margin_otps' AND column_name='user_id' AND data_type='integer'
        ) THEN
          TRUNCATE pricing_margin_otps;
          ALTER TABLE pricing_margin_otps ALTER COLUMN user_id TYPE varchar USING user_id::varchar;
        END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS pricing_cost_items (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        cost_row_id varchar NOT NULL,
        label text NOT NULL DEFAULT '',
        amount_eur numeric(14,2) NOT NULL,
        sort_order integer NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS pricing_margin_snapshots (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        cost_row_id varchar NOT NULL,
        product_label varchar(255) NOT NULL,
        country_code varchar(10) NOT NULL,
        gross_revenue_eur numeric(14,2),
        total_cost_eur numeric(14,2),
        rezia_eur numeric(14,2),
        snapshot_date timestamptz NOT NULL DEFAULT now(),
        note text
      );
    `);
    console.log('[migration] pricing v2 tables ensured');
  } catch (e: any) {
    console.error('[migration] pricing v2 tables error:', e.message);
  }

  // ── Beratung Email Monitor tables ─────────────────────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS beratung_inbox_emails (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        graph_message_id text NOT NULL,
        subject text,
        from_address text NOT NULL DEFAULT '',
        from_name text,
        received_at timestamp NOT NULL DEFAULT now(),
        body_html text,
        body_text text,
        translated_cs text,
        translated_sk text,
        has_attachments boolean NOT NULL DEFAULT false,
        attachment_count integer NOT NULL DEFAULT 0,
        attachment_summaries jsonb DEFAULT '[]'::jsonb,
        attachment_data jsonb DEFAULT '[]'::jsonb,
        status text NOT NULL DEFAULT 'new',
        forwarded_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT uq_beratung_graph_msg UNIQUE (graph_message_id)
      );
      CREATE INDEX IF NOT EXISTS idx_beratung_emails_status ON beratung_inbox_emails (status);
      CREATE INDEX IF NOT EXISTS idx_beratung_emails_received ON beratung_inbox_emails (received_at DESC);

      CREATE TABLE IF NOT EXISTS beratung_monitor_settings (
        id integer PRIMARY KEY DEFAULT 1,
        forward_to text[] NOT NULL DEFAULT ARRAY[]::text[],
        auto_process boolean NOT NULL DEFAULT false,
        last_checked_at timestamp,
        token_access text,
        token_refresh text,
        token_expires_at timestamp,
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);
    // Add columns added in later iterations
    await pool.query(`
      ALTER TABLE beratung_monitor_settings
        ADD COLUMN IF NOT EXISTS sender_filters text[] NOT NULL DEFAULT ARRAY[]::text[];
      ALTER TABLE beratung_monitor_settings
        ADD COLUMN IF NOT EXISTS beratung_password text;
      ALTER TABLE beratung_inbox_emails
        ADD COLUMN IF NOT EXISTS audio_transcription text;
      CREATE TABLE IF NOT EXISTS beratung_activity_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        action text NOT NULL,
        mode text NOT NULL DEFAULT 'manual',
        email_id text,
        email_subject text,
        actor_user_id text,
        detail text,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_beratung_activity_created
        ON beratung_activity_log (created_at DESC);
    `);
    console.log('[migration] beratung tables ensured');
  } catch (e: any) {
    console.error('[migration] beratung tables error:', e.message);
  }

  // ── Clinic Representative Assignments ─────────────────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clinic_representative_assignments (
        id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id       varchar NOT NULL,
        user_id         varchar NOT NULL,
        valid_from      timestamptz NOT NULL DEFAULT now(),
        valid_to        timestamptz,
        assigned_by     varchar,
        assigned_at     timestamptz NOT NULL DEFAULT now(),
        assignment_type text NOT NULL DEFAULT 'manual',
        note            text
      );

      -- max. 1 aktívne priradenie na kliniku (valid_to IS NULL)
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cra_clinic_active
        ON clinic_representative_assignments (clinic_id)
        WHERE valid_to IS NULL;

      CREATE INDEX IF NOT EXISTS idx_cra_clinic
        ON clinic_representative_assignments (clinic_id);
      CREATE INDEX IF NOT EXISTS idx_cra_user
        ON clinic_representative_assignments (user_id);
      CREATE INDEX IF NOT EXISTS idx_cra_at_time
        ON clinic_representative_assignments (clinic_id, valid_from, valid_to);
    `);
    console.log('[migration] clinic_representative_assignments ensured');
  } catch (e: any) {
    console.error('[migration] clinic_representative_assignments error:', e.message);
  }

  // ── Seed rola Representant (pre Replit dev; prod ju má manuálne vytvorenú) ─
  try {
    await pool.query(`
      INSERT INTO roles (id, name, description, department, legacy_role, default_landing_page, is_active, is_system)
      VALUES (
        'role-representant',
        'Representant',
        'Profile for users who are representatives and have influence over the work of collaborators',
        'Sales',
        'user',
        '/nexus-pulse',
        true,
        false
      )
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('[migration] Representant role ensured');
  } catch (e: any) {
    console.error('[migration] Representant role seed error:', e.message);
  }

  // ── Hospital representative assignments table ─────────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hospital_representative_assignments (
        id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        hospital_id     VARCHAR NOT NULL,
        user_id         VARCHAR NOT NULL,
        valid_from      TIMESTAMP NOT NULL DEFAULT now(),
        valid_to        TIMESTAMP,
        assigned_by     VARCHAR,
        assigned_at     TIMESTAMP NOT NULL DEFAULT now(),
        assignment_type TEXT NOT NULL DEFAULT 'manual',
        note            TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_hospital_rep_active
        ON hospital_representative_assignments (hospital_id)
        WHERE valid_to IS NULL;
      CREATE INDEX IF NOT EXISTS idx_hospital_rep_hospital
        ON hospital_representative_assignments (hospital_id);
      CREATE INDEX IF NOT EXISTS idx_hospital_rep_user
        ON hospital_representative_assignments (user_id);
      CREATE INDEX IF NOT EXISTS idx_hospital_rep_validity
        ON hospital_representative_assignments (hospital_id, valid_from, valid_to);
    `);
    console.log('[migration] hospital_representative_assignments ensured');
  } catch (e: any) {
    console.error('[migration] hospital_representative_assignments error:', e.message);
  }

  // Ensure representative_id column exists on clinics + hospitals, then backfill from assignments
  try {
    await pool.query(`ALTER TABLE clinics ADD COLUMN IF NOT EXISTS representative_id varchar`);
    await pool.query(`ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS representative_id varchar`);
    await pool.query(`
      UPDATE clinics c
      SET representative_id = a.user_id
      FROM clinic_representative_assignments a
      WHERE a.clinic_id = c.id
        AND a.valid_to IS NULL
        AND (c.representative_id IS NULL OR c.representative_id != a.user_id)
    `);
    await pool.query(`
      UPDATE hospitals h
      SET representative_id = a.user_id
      FROM hospital_representative_assignments a
      WHERE a.hospital_id = h.id
        AND a.valid_to IS NULL
        AND (h.representative_id IS NULL OR h.representative_id != a.user_id)
    `);
    console.log('[migration] representative_id column + backfill done');
  } catch (e: any) {
    console.error('[migration] representative_id backfill error:', e.message);
  }

  // Ensure clinic_id + collaborator_id on collections and customers (ambulancia/gynekológ link)
  try {
    await pool.query(`ALTER TABLE collections ADD COLUMN IF NOT EXISTS clinic_id varchar`);
    await pool.query(`ALTER TABLE collections ADD COLUMN IF NOT EXISTS collaborator_id varchar`);
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS clinic_id varchar`);
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS collaborator_id varchar`);
    // Backfill representative_id for collections that already have a clinic_id set
    await pool.query(`
      UPDATE collections c
      SET representative_id = sub.user_id
      FROM (
        SELECT DISTINCT ON (a.clinic_id) a.clinic_id, a.user_id, a.valid_from
        FROM clinic_representative_assignments a
        ORDER BY a.clinic_id, a.valid_from DESC
      ) sub
      WHERE c.clinic_id = sub.clinic_id
        AND c.collection_date IS NOT NULL
        AND c.representative_id IS NULL
    `);
    console.log('[migration] collections/customers clinic_id + collaborator_id ensured');
  } catch (e: any) {
    console.error('[migration] collections clinic_id error:', e.message);
  }

  // representative_kpi_snapshots — frozen monthly KPI snapshots for trend chart
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS representative_kpi_snapshots (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        representative_id varchar NOT NULL,
        campaign_id varchar,
        year integer NOT NULL,
        month integer NOT NULL,
        country_code text,
        kpi_key text NOT NULL,
        value numeric,
        numerator integer,
        denominator integer,
        locked_at timestamp NOT NULL DEFAULT now(),
        created_by varchar,
        UNIQUE(representative_id, campaign_id, year, month, kpi_key)
      );
      CREATE INDEX IF NOT EXISTS idx_rep_kpi_snapshots_lookup
        ON representative_kpi_snapshots(representative_id, campaign_id, year, month);
      -- Partial unique index for global (NULL campaign_id) snapshots so ON CONFLICT works
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rep_kpi_snapshots_global_unique
        ON representative_kpi_snapshots(representative_id, year, month, kpi_key)
        WHERE campaign_id IS NULL;
    `);
    console.log('[migration] representative_kpi_snapshots ensured');
  } catch (e: any) {
    console.error('[migration] representative_kpi_snapshots error:', e.message);
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      startAlertEvaluator(60 * 1000);
      startSessionCleanup();
      startScheduledReportRunner();
      startKpiSnapshotCron();

      // Build performance indexes in the background (non-blocking, CONCURRENTLY).
      ensureIndexes().catch((err) =>
        console.error("[index] ensure error:", err?.message || err),
      );

      import("./variable-registry-seed").then(({ seedVariableRegistry }) => {
        seedVariableRegistry().catch(err => console.error("[Variable Registry] Seed error:", err));
      });

      import("./partner-categories-seed").then(({ seedPartnerCategories }) => {
        seedPartnerCategories().catch(err => console.error("[PartnerCategories] Seed error:", err));
      });

      import("./lib/beratung-email-service").then(({ startBeratungMonitoring }) => {
        startBeratungMonitoring();
      }).catch(err => console.error("[Beratung] Startup error:", err));
    },
  );
})();
