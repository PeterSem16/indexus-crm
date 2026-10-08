import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadAutomationTemplateLocales, localizeAutomationEmail, type AutomationEmailDefault } from "./automation-template-locales";
import { normalizeEmailTemplateLayout } from "../../shared/email-template-layout";

/** Seed once; edits, deletions and rule snapshots are never overwritten. */
export async function ensureAutomationEmailTemplates(pool: { query: (sql: string) => Promise<unknown> }) {
  const templates: AutomationEmailDefault[] = JSON.parse(await readFile(resolve(process.cwd(), "server/assets/automation-email/templates.json"), "utf8"))
    .map((template: AutomationEmailDefault) => ({ ...template, contentHtml: normalizeEmailTemplateLayout(template.contentHtml) }));
  const locales = await loadAutomationTemplateLocales();
  const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
  // Each approval batch has its own marker: adding new defaults must not
  // resurrect old defaults the manager has edited or deleted.
  const batches = [
    { id: "approved-automation-emails", templates: templates.filter(template =>
      !["indexus-automation-email-data-change", "indexus-automation-email-information"].includes(template.id)) },
    { id: "approved-automation-emails-non-task", templates: templates.filter(template =>
      ["indexus-automation-email-data-change", "indexus-automation-email-information"].includes(template.id)) },
    ...locales.map(locale => ({
      id: `approved-automation-email-translations-${locale.language}`,
      templates: templates.map(template => localizeAutomationEmail(template, locale)),
    })),
  ];
  for (const batch of batches) {
    if (!batch.templates.length) continue;
    const rows = batch.templates.map(template =>
      `(${[template.id, template.name, template.subject, template.content, template.contentHtml, template.language || "sk"].map(literal).join(",")})`).join(",\n");
    await pool.query(`
    ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS country_codes text[] NOT NULL DEFAULT ARRAY[]::text[];
    CREATE TABLE IF NOT EXISTS automation_template_seeds (
      id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now()
    );
    WITH seed AS (
      INSERT INTO automation_template_seeds (id) VALUES (${literal(batch.id)})
      ON CONFLICT (id) DO NOTHING RETURNING id
    ), category AS (
      INSERT INTO template_categories (id,name,description,icon,color,is_active)
      SELECT 'indexus-automation-email-category','Automatizácia','Emailové šablóny automatizácií','Zap','#316bd8',true FROM seed
      ON CONFLICT (id) DO UPDATE SET id=EXCLUDED.id RETURNING id
    ), defaults (id,name,subject,content,html,language) AS (VALUES ${rows})
    INSERT INTO message_templates (id,name,type,format,subject,content,content_html,language,category_id,is_active,country_codes)
      SELECT defaults.id,defaults.name,'email','html',defaults.subject,defaults.content,defaults.html,defaults.language,category.id,true,ARRAY[]::text[]
      FROM defaults CROSS JOIN category
    ON CONFLICT (id) DO NOTHING;
  `);
  }
}
