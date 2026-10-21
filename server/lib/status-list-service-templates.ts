import { ACTIVITY_TEMPLATE_LANGUAGES, activityTemplateLabel } from "../../shared/automation-activity-template-copy";
import { humanizeAutomationTemplate } from "./automation-human-templates";

const variants = [
  ["information", "detail"],
  ["action-needed", "statusListActionNeeded"],
  ["completed", "eventCompleted"],
  ["data-change", "eventUpdated"],
  ["reminder", "statusListReminder"],
] as const;

/** Same approved visual family, but only variables supplied by native Status List execution.
 * No fictitious task deadlines, call outcomes, or AI findings are copied from other sources. */
export function loadStatusListServiceTemplates() {
  return ACTIVITY_TEMPLATE_LANGUAGES.flatMap(language =>
    (["email", "sms", "notification", "task"] as const).flatMap(type =>
      variants.map(([variant, label]) => {
        const name = `${activityTemplateLabel(language, "status_list")} · ${activityTemplateLabel(language, label)}`;
        const base = {
          id: `indexus-activity-${type}-status_list-${variant}-${language}`,
          name, subject: name, type, language, format: type === "email" ? "html" : "text",
          content: name, contentHtml: null,
        };
        return { ...base, ...humanizeAutomationTemplate(base, [
          ["to", "contact.name"], ["mission", "campaign.name"],
        ]) };
      })));
}

/** Language-scoped one-time seeds preserve edited, disabled and deleted defaults and rule copies. */
export async function ensureStatusListServiceTemplates(pool: { query: (sql: string) => Promise<unknown> }) {
  const templates = loadStatusListServiceTemplates();
  const quote = (value: string | null | undefined) => value == null ? "NULL" : `'${value.replaceAll("'", "''")}'`;
  for (const language of ACTIVITY_TEMPLATE_LANGUAGES) {
    const rows = templates.filter(template => template.language === language).map(template =>
      `(${[template.id, template.name, template.subject, template.type, template.format, template.content, template.contentHtml].map(quote).join(",")})`).join(",\n");
    await pool.query(`WITH seed AS (
      INSERT INTO automation_template_seeds(id) VALUES (${quote(`status-list-service-templates-${language}`)})
      ON CONFLICT(id) DO NOTHING RETURNING id
    ), defaults(id,name,subject,type,format,content,html) AS (VALUES ${rows})
    INSERT INTO message_templates(id,name,subject,type,format,content,content_html,language,category_id,is_active,country_codes)
    SELECT defaults.id,name,subject,type,format,content,html,${quote(language)},
      CASE WHEN type='email' THEN 'indexus-automation-email-category' ELSE NULL END,true,ARRAY[]::text[]
    FROM defaults CROSS JOIN seed ON CONFLICT(id) DO NOTHING;`);
  }
}
