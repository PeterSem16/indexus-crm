import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startAlertEvaluator } from "./alert-evaluator";
import { startSessionCleanup } from "./session-cleanup";
import { startScheduledReportRunner } from "./scheduled-report-runner";
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
      ALTER TABLE campaign_status_list_automations
        ADD COLUMN IF NOT EXISTS condition_json text,
        ADD COLUMN IF NOT EXISTS webhook_target text;
    `);
    console.log('[migration] condition_json/webhook_target ensured on automations');

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
    `);
    console.log('[migration] task_groups / task_group_members / task_group_id ensured');
  } catch (e: any) {
    console.error('[migration] Error:', e.message);
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

      import("./variable-registry-seed").then(({ seedVariableRegistry }) => {
        seedVariableRegistry().catch(err => console.error("[Variable Registry] Seed error:", err));
      });

      import("./partner-categories-seed").then(({ seedPartnerCategories }) => {
        seedPartnerCategories().catch(err => console.error("[PartnerCategories] Seed error:", err));
      });
    },
  );
})();
