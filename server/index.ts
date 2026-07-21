import express, { type Request, Response, NextFunction } from "express";
import { gzip } from "zlib";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startAlertEvaluator } from "./alert-evaluator";
import { startSessionCleanup } from "./session-cleanup";
import { startScheduledReportRunner } from "./scheduled-report-runner";
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
    },
  );
})();
