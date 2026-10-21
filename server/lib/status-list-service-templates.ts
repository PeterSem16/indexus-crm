import { ACTIVITY_TEMPLATE_LANGUAGES, activityTemplateLabel } from "../../shared/automation-activity-template-copy";
import { humanizeAutomationTemplate } from "./automation-human-templates";

const variants = [
  ["information", "detail"],
  ["action-needed", "statusListActionNeeded"],
  ["completed", "eventCompleted"],
  ["data-change", "eventUpdated"],
  ["reminder", "statusListReminder"],
] as const;

/** Historical rejected substitutes, reconstructed ONLY for exact-byte retirement.
 * Never offer or seed these; the editor must use the original shared catalog. */
export function retiredStatusListServiceTemplates() {
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

/** Use the original shared catalog. Retire only our rejected, unchanged substitutes;
 * manager edits, deletions and already saved action snapshots are not touched. */
export async function ensureStatusListServiceTemplates(pool: { query: (sql: string) => Promise<unknown> }) {
  const templates = retiredStatusListServiceTemplates();
  const quote = (value: string | null | undefined) => value == null ? "NULL" : `'${value.replaceAll("'", "''")}'`;
  for (const language of ACTIVITY_TEMPLATE_LANGUAGES) {
    const rows = templates.filter(template => template.language === language).map(template =>
      `(${[template.id, template.name, template.subject, template.type, template.format, template.content, template.contentHtml].map(quote).join(",")})`).join(",\n");
    await pool.query(`WITH rejected(id,name,subject,type,format,content,html) AS (VALUES ${rows})
      UPDATE message_templates AS t SET is_active=false FROM rejected AS r
      WHERE t.id=r.id AND t.name=r.name AND t.type=r.type AND t.format=r.format
        AND t.language=${quote(language)} AND t.is_active=true AND cardinality(t.country_codes)=0
        AND t.subject IS NOT DISTINCT FROM r.subject AND t.content=r.content
        AND t.content_html IS NOT DISTINCT FROM r.html;`);
  }
}
