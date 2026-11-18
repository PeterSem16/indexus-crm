// Local UI compatibility evidence only. No Gateway call and no production access.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import type { Page } from "@playwright/test";
import pg from "pg";
import { createB1App } from "../../server/lib/ai-b1/app";
import { B1_SCHEMA } from "../../server/lib/ai-b1/schema";
import { AI_JOBS_SCHEMA } from "../../server/lib/ai-jobs/schema-migration";
import { serveStatic } from "../../server/static";
import { LANGUAGES } from "../ai-three-services/corpus";
import { pool as defaultPool } from "../../server/db";

assert(process.env.REPLIT_DEV_DOMAIN || process.env.REPL_ID, "Local fixtures only");
process.env.AI_JOBS_TASK_CHECKLIST_ENABLED = "true";
const schema = "b1_ui_" + randomUUID().replaceAll("-", "");
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema},public` });
let server: ReturnType<ReturnType<typeof createB1App>["listen"]> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let page: Page | undefined;
const fatal: string[] = [], apiErrors: string[] = [];
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await db.query(B1_SCHEMA + AI_JOBS_SCHEMA);
  const app = createB1App(db, { uiPassword: "local-ui-fixture", sessionSecret: randomUUID() }, "checklist");
  serveStatic(app);
  server = app.listen(15491, "127.0.0.1");
  await new Promise<void>(resolve => server!.once("listening", resolve));
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
    headless: true, args: ["--no-sandbox"] });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", error => fatal.push(error.message));
  page.on("response", response => { if (response.url().includes("/api/") && response.status() >= 400)
    apiErrors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  await page.goto("http://127.0.0.1:15491/tasks");
  await page.getByTestId("input-login-username").fill("b1-operator");
  await page.getByTestId("button-continue").click();
  await page.getByTestId("input-login-password").fill("local-ui-fixture");
  await page.getByTestId("button-login").click();
  await page.getByTestId("button-quick-create").waitFor();
  await page.goto("http://127.0.0.1:15491/tasks");
  await page.getByTestId("button-quick-create").click();
  await page.getByTestId("menu-item-quick-task").click();
  await page.getByTestId("input-quick-task-title").waitFor({ timeout: 5000 }).catch(async error => {
    await fs.mkdir("../b1-browser", { recursive: true });
    await page.screenshot({ path: "../b1-browser/dialog-error.jpg" });
    console.info(JSON.stringify({ fatal, apiErrors, screen: (await page.locator("body").innerText()).slice(0, 1800) }));
    throw error;
  });
  await page.getByTestId("input-quick-task-title").fill(LANGUAGES[0].titles[0]);
  await page.getByTestId("input-quick-task-description").fill(LANGUAGES[0].requests[0]);
  const accepted = page.waitForResponse(r => new URL(r.url()).pathname === "/api/tasks" && r.request().method() === "POST");
  await page.getByRole("dialog").locator('button[type="submit"]').click();
  const response = await accepted;
  assert.equal(response.status(), 202);
  await page.getByText(LANGUAGES[0].titles[0], { exact: true }).first().waitFor();
  await fs.mkdir("../b1-browser", { recursive: true });
  await page.screenshot({ path: "../b1-browser/tasks-pending.jpg", fullPage: false });
  assert.equal((await db.query("SELECT count(*)::integer AS n FROM ai_jobs")).rows[0].n, 1);
  assert.deepEqual(fatal, []);
  console.info(JSON.stringify({ fixture: true, liveAI: false, taskHTTP: 202, originalUI: true,
    jobs: 1, fatalErrors: fatal, apiErrors }, null, 2));
  if (process.argv.includes("--capture-preview")) {
    console.info("B1_FIXTURE_PREVIEW_READY");
    await new Promise(resolve => setTimeout(resolve, 45000));
  }
} catch (error) {
  await fs.mkdir("../b1-browser", { recursive: true });
  if (page) {
    await page.screenshot({ path: "../b1-browser/failure.jpg" });
    console.info(JSON.stringify({ fatal, apiErrors, screen: (await page.locator("body").innerText()).slice(0, 2400) }));
  }
  throw error;
} finally {
  await browser?.close();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server!.close(resolve)); }
  await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); await defaultPool.end();
}
