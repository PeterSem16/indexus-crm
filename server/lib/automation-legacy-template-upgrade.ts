import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { activityTemplateLabel, ACTIVITY_TEMPLATE_LANGUAGES, type ActivityTemplateLanguage } from "../../shared/automation-activity-template-copy";
import { normalizeEmailTemplateLayout } from "../../shared/email-template-layout";
import { loadAutomationTemplateLocales, localizeAutomationEmail, localizedTaskDefaults, type AutomationEmailDefault } from "./automation-template-locales";
import { DEFAULT_TASK_MESSAGE_TEMPLATES } from "./task-message-templates";
import { loadAutomationCallTemplates } from "./automation-call-templates";
import { loadAutomationAnalysisEmailTemplates, automationAnalysisNotificationDefaults, automationAnalysisSmsDefaults } from "./automation-analysis-templates";
import { notificationTemplateDefaults } from "../../shared/automation-notification-templates";
import { automationSmsDefaults } from "./automation-sms-templates";
import { automationTemplateVisuals } from "./automation-template-visuals";
import { loadAutomationTaskEventTemplates } from "./automation-task-event-templates";

export type LegacyDefault = {
  id: string; name: string; type: string; language: string;
  subject?: string | null; content: string; contentHtml?: string | null;
};
type Line = [label: string, variable: string];

/** All keys are from existing event/analysis template allowlists, not new access. */
export function legacyTemplateContextLines(template: LegacyDefault): Line[] {
  if (template.id.includes("-analysis-")) return [
    ["from", "communication.senderName"], ["to", "communication.recipientName"],
    ["id", "communication.id"], ["received", "communication.receivedAt"],
    ["summary", "analysis.summary"], ["sentiment", "analysis.sentiment"], ["tone", "analysis.tone"],
  ];
  if (template.id.includes("-call-")) return [
    ["id", "entityId"], ["time", "activity.occurredAt"], ["status", "activity.status"],
    ["from", "activity.actorUserId"],
  ];
  const common: Line[] = [["subject", "activity.title"], ["id", "activity.id"], ["event", "activity.eventType"], ["time", "activity.occurredAt"]];
  if (template.type === "task" || /new-task|action-needed|completed|deadline|overdue|assigned|handover/.test(template.id))
    common.push(["to", "activity.assignedUserId"], ["to", "activity.taskGroupIds"],
      ["status", "activity.status"], ["priority", "activity.priority"], ["due", "activity.dueDate"]);
  return common;
}

function previousLegacyDefaultUpgrade(template: LegacyDefault): LegacyDefault | null {
  const language = template.language as ActivityTemplateLanguage;
  const fields = legacyTemplateContextLines(template).filter(([, key]) =>
    !`${template.content}\n${template.contentHtml || ""}`.includes(`{{${key}}}`));
  const text = fields.map(([key, variable]) => `${activityTemplateLabel(language, key)}: {{${variable}}}`).join("\n");
  let html = template.contentHtml;
  if (html && fields.length) {
    const rows = fields.map(([key, variable]) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e1eaf0;color:#57768d;font-size:12px;vertical-align:top;">${activityTemplateLabel(language, key)}</td><td style="padding:8px 12px;border-bottom:1px solid #e1eaf0;color:#21384c;font-size:14px;word-break:break-word;">{{${variable}}}</td></tr>`).join("");
    const detail = `<tr><td style="padding:0 28px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e1eaf0;border-radius:12px;border-collapse:separate;border-spacing:0;">${rows}</table></td></tr>`;
    // Insert within the approved 560px frame, never an unbounded afterthought.
    const closing = /(<\/tbody>\s*<\/table>\s*<\/td>\s*<\/tr>\s*<\/tbody>\s*<\/table>\s*<\/body>)/;
    // This historical representation was never upgradable by the previous
    // algorithm. Do not invent a prior persisted shape for it.
    if (!closing.test(html)) return null;
    html = normalizeEmailTemplateLayout(automationTemplateVisuals(template.id, html.replace(closing, `${detail}$1`)));
  }
  return { ...template, content: text ? `${template.content}\n\n${text}` : template.content, contentHtml: html };
}

export function upgradeLegacyDefault(template: LegacyDefault): LegacyDefault {
  const language = template.language as ActivityTemplateLanguage;
  const fields = legacyTemplateContextLines(template);
  const title = template.id.includes("-analysis-") ? "communication.subject" : template.id.includes("-call-") ? "entityId" : "activity.title";
  const identity = template.id.includes("-analysis-") ? "communication.id" : template.id.includes("-call-") ? "entityId" : "activity.id";
  const heading = `${activityTemplateLabel(language, "subject")}: {{${title}}}\n${activityTemplateLabel(language, "id")}: {{${identity}}}`;
  const context = fields.map(([label, key]) => `${activityTemplateLabel(language, label)}: {{${key}}}`).join("\n");
  let html = template.contentHtml;
  if (html) {
    const rows = fields.map(([label, key]) => `<tr><td style="padding:8px 12px;font-size:12px;color:#57768d;">${activityTemplateLabel(language, label)}</td><td style="padding:8px 12px;font-size:14px;color:#21384c;">{{${key}}}</td></tr>`).join("");
    // Show identification before the generic artwork/prose, not below the whole email.
    const contextBlock = `<tr><td style="padding:20px 28px 12px;"><div style="font-size:19px;font-weight:bold;color:#21384c;">{{${title}}}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border:1px solid #e1eaf0;">${rows}</table></td></tr>`;
    const frame = /(<table\b[^>]*width="[456]\d{2}"[^>]*>\s*(?:<tbody>)?)/;
    if (!frame.test(html)) throw new Error(`Legacy automation frame missing: ${template.id}`);
    html = normalizeEmailTemplateLayout(automationTemplateVisuals(template.id, html.replace(frame, `$1${contextBlock}`)));
    if (/deadline/.test(template.id)) html = html.replace(/>—</, ">{{activity.dueDate}}<");
  }
  return { ...template,
    subject: `${template.subject || template.name} · {{${title}}} [{{${identity}}}]`,
    content: `${heading}\n${context}\n\n${template.content}`, contentHtml: html };
}

/** Reconstruct approved originals to distinguish untouched defaults from edits. */
export async function legacyAutomationDefaults(): Promise<LegacyDefault[]> {
  const raw: AutomationEmailDefault[] = JSON.parse(await readFile(resolve(process.cwd(), "server/assets/automation-email/templates.json"), "utf8"));
  const originals = raw.map(item => ({ ...item, contentHtml: normalizeEmailTemplateLayout(item.contentHtml) }));
  const locales = await loadAutomationTemplateLocales();
  const result: LegacyDefault[] = originals.map(item => ({ ...item, type: "email", language: "sk", contentHtml: normalizeEmailTemplateLayout(item.contentHtml) }));
  result.push(...locales.flatMap(locale => originals.map(item => ({
    ...localizeAutomationEmail(item, locale), type: "email", language: locale.language,
  }))));
  // Earlier seeds localized the RAW approved frame. Normalizing it first loses
  // byte equality and silently skips all untouched generic email defaults.
  result.push(...raw.map(item => ({ ...item, type: "email", language: "sk" })),
    ...locales.flatMap(locale => raw.map(item => ({ ...localizeAutomationEmail(item, locale), type: "email", language: locale.language }))));
  for (const language of ACTIVITY_TEMPLATE_LANGUAGES) {
    const locale = locales.find(item => item.language === language);
    const tasks = locale ? localizedTaskDefaults(DEFAULT_TASK_MESSAGE_TEMPLATES, locale) : DEFAULT_TASK_MESSAGE_TEMPLATES;
    result.push(...tasks.map(([key, name, content]) => ({
      id: `indexus-task-template-${key}${language === "sk" ? "" : `-${language}`}`, name,
      subject: name, content, type: "task", language,
    })));
    result.push(...notificationTemplateDefaults(language), ...automationSmsDefaults(language),
      ...automationAnalysisNotificationDefaults(language), ...automationAnalysisSmsDefaults(language));
  }
  // Older installations can contain the original frame OR its color correction.
  for (const style of ["original", "semantic", "historical"] as const) {
    for (const batch of await loadAutomationCallTemplates(style))
      for (const item of batch.templates) result.push(
        { ...item.email, type: "email", language: batch.language },
        { ...item.task, type: "task", language: batch.language });
    for (const batch of await loadAutomationAnalysisEmailTemplates(style))
      result.push(...batch.templates.map(item => ({ ...item, type: "email", language: batch.language })));
  }
  for (const batch of await loadAutomationTaskEventTemplates())
    for (const item of batch.templates) result.push(
      { ...item.email, type: "email", language: batch.language },
      { ...item.task, type: "task", language: batch.language });
  return result;
}

/** Guarded, atomic updates; preserve custom copies, edits, country scope and deletion. */
export async function ensureLegacyAutomationTemplateVariables(pool: { query: (sql: string) => Promise<unknown> }) {
  const defaults = await legacyAutomationDefaults();
  const quote = (value: string | null | undefined) => value == null ? "NULL" : `'${value.replaceAll("'", "''")}'`;
  for (const language of ACTIVITY_TEMPLATE_LANGUAGES) {
    const rows = defaults.filter(item => item.language === language).flatMap(old => {
      const next = upgradeLegacyDefault(old);
      return [old, previousLegacyDefaultUpgrade(old)].filter((item): item is LegacyDefault => item !== null).map(previous =>
        `(${[old.id, old.name, old.type, previous.subject, previous.content, previous.contentHtml,
          next.subject, next.content, next.contentHtml].map(quote).join(",")})`);
    }).join(",\n");
    await pool.query(`WITH upgrades(id,name,type,old_subject,old_content,old_html,new_subject,new_content,new_html) AS (VALUES ${rows})
      UPDATE message_templates AS template SET subject=upgrades.new_subject, content=upgrades.new_content, content_html=upgrades.new_html
      FROM upgrades WHERE template.id=upgrades.id AND template.name=upgrades.name AND template.type=upgrades.type
        AND template.language=${quote(language)} AND template.is_active=true
        AND template.subject IS NOT DISTINCT FROM upgrades.old_subject
        AND template.content=upgrades.old_content AND template.content_html IS NOT DISTINCT FROM upgrades.old_html
        AND cardinality(template.country_codes)=0;`);
  }
}
