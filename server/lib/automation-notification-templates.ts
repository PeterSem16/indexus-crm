import { NOTIFICATION_TEMPLATE_LANGUAGES, notificationTemplateDefaults } from "../../shared/automation-notification-templates";
import { validTaskMessageTemplate } from "./task-message-templates";

export async function ensureAutomationNotificationTemplates(pool: { query: (sql: string) => Promise<unknown> }) {
  const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
  for (const language of NOTIFICATION_TEMPLATE_LANGUAGES) {
    const values = notificationTemplateDefaults(language).map(template =>
      `(${literal(template.id)},${literal(template.name)},${literal(template.subject)},${literal(template.content)})`).join(",\n");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS automation_template_seeds (
        id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now()
      );
      WITH seed AS (
        INSERT INTO automation_template_seeds (id) VALUES (${literal(`notification-defaults-${language}`)})
        ON CONFLICT (id) DO NOTHING RETURNING id
      ), defaults (id,name,title,message) AS (VALUES ${values})
      INSERT INTO message_templates (id,name,type,format,subject,content,language,is_active,country_codes)
        SELECT defaults.id,defaults.name,'notification','text',defaults.title,defaults.message,${literal(language)},true,ARRAY[]::text[]
        FROM defaults CROSS JOIN seed
      ON CONFLICT (id) DO NOTHING;`);
  }
}

export function validNotificationMessageTemplate(body: any): boolean {
  return validTaskMessageTemplate(body) &&
    typeof body.subject === "string" && Boolean(body.subject.trim());
}
