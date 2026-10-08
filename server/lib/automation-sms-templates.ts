import { NOTIFICATION_TEMPLATE_LANGUAGES, notificationTemplateDefaults } from "../../shared/automation-notification-templates";

export function automationSmsDefaults(language: typeof NOTIFICATION_TEMPLATE_LANGUAGES[number]) {
  return notificationTemplateDefaults(language).map(template => ({
    ...template, id: template.id.replace("indexus-notification-template-", "indexus-sms-template-"),
    type: "sms" as const, subject: undefined,
  }));
}

export async function ensureAutomationSmsTemplates(pool: { query: (sql: string) => Promise<unknown> }) {
  const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
  for (const language of NOTIFICATION_TEMPLATE_LANGUAGES) {
    const values = automationSmsDefaults(language).map(template =>
      `(${literal(template.id)},${literal(template.name)},${literal(template.content)})`).join(",\n");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS automation_template_seeds (
        id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now()
      );
      WITH seed AS (
        INSERT INTO automation_template_seeds (id) VALUES (${literal(`automation-sms-defaults-${language}`)})
        ON CONFLICT (id) DO NOTHING RETURNING id
      ), defaults (id,name,message) AS (VALUES ${values})
      INSERT INTO message_templates (id,name,type,format,content,language,is_active,country_codes)
        SELECT defaults.id,defaults.name,'sms','text',defaults.message,${literal(language)},true,ARRAY[]::text[]
        FROM defaults CROSS JOIN seed
      ON CONFLICT (id) DO NOTHING;`);
  }
}
