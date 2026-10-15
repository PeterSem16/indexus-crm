import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ACTIVITY_TEMPLATE_LANGUAGES, activityTemplateLabel, type ActivityTemplateLanguage } from "../../shared/automation-activity-template-copy";
import { loadAutomationTemplateLocales, localizeAutomationEmail, type AutomationEmailDefault } from "./automation-template-locales";
import { normalizeEmailTemplateLayout } from "../../shared/email-template-layout";
import { MODULE_EVENTS, fieldsForEvent } from "./automation-capabilities";
import { TEMPLATE_VISUAL_PALETTES, templateVisualTone } from "../../shared/automation-template-visual";

type Line = [label: string, variable: string];
type Brief = { key: string; label: string; lines: Line[]; voice?: boolean; criterion?: string; event?: string };
export const VOICE_FINDING_CRITERIA = ["sentiment-neutral", "sentiment-angry", "tone-calm", "tone-concerned", "tone-angry", "tone-rude"] as const;
const eventLabels: Record<string, string> = {
  created: "eventCreated", updated: "eventUpdated", status_changed: "eventStatus",
  assigned: "eventAssigned", completed: "eventCompleted", overdue: "eventOverdue",
  cancelled: "eventCancelled", started: "eventStarted", answered: "eventAnswered",
  unanswered: "eventUnanswered", timeout: "eventTimeout", abandoned: "eventAbandoned", threshold: "eventThreshold",
};
const communicationLines = (channel: string): Line[] => {
  const common: Line[] = [["from", "communication.senderName"], ["to", "communication.recipientName"]];
  if (channel === "email") common.push(["from", "communication.senderEmail"], ["to", "communication.recipientEmail"], ["subject", "communication.subject"]);
  if (channel === "sms" || channel === "voice") common.push(["from", "communication.senderPhone"], ["to", "communication.recipientPhone"]);
  if (channel === "task") common.push(["subject", "communication.taskTitle"], ["status", "communication.taskStatus"], ["priority", "communication.taskPriority"], ["due", "communication.dueDate"]);
  if (channel === "voice") common.push(["direction", "communication.direction"], ["mission", "communication.campaignName"],
    ["start", "communication.startedAt"], ["answer", "communication.answeredAt"], ["end", "communication.endedAt"], ["duration", "communication.durationSeconds"]);
  else common.push(["created", "communication.createdAt"], ["received", "communication.receivedAt"]);
  if (channel === "email" || channel === "sms") common.push(["sent", "communication.sentAt"], ["delivered", "communication.deliveredAt"]);
  return [...common, ["id", channel === "voice" ? "communication.callId" : "communication.id"],
    ["summary", "analysis.summary"], ["sentiment", "analysis.sentiment"], ["tone", "analysis.tone"]];
};

export function activityTemplateBriefs(): Brief[] {
  const briefs: Brief[] = [];
  // Separate direction-specific call briefs, plus an explicit both-directions family.
  for (const channel of ["email", "sms", "chat", "task", "inbound", "outbound", "voice"]) {
    const voice = ["inbound", "outbound", "voice"].includes(channel);
    for (const criterion of ["summary", "positive", "negative", "urgent", ...(voice ? VOICE_FINDING_CRITERIA : [])])
      briefs.push({ key: `analysis-${channel}-${criterion}`, label: channel, criterion, voice,
        lines: communicationLines(voice ? "voice" : channel) });
  }
  // LEAD SEARCH owns a separate notification-only family. Do not invent generic
  // email/SMS/Task defaults or change previously approved activity templates.
  for (const module of Object.keys(MODULE_EVENTS).filter(module => !["communication", "call", "lead_search"].includes(module))) {
    for (const event of MODULE_EVENTS[module]) {
      const lines: Line[] = [["subject", "activity.title"], ["id", "activity.id"],
        ["from", "activity.actorUserId"], ["time", "activity.occurredAt"]];
      if (module === "task") lines.push(["to", "activity.assignedUserId"], ["to", "activity.assignedDepartmentId"],
        ["to", "activity.taskGroupIds"], ["status", "activity.status"], ["priority", "activity.priority"],
        ["created", "activity.createdAt"], ["updated", "activity.updatedAt"], ["due", "activity.dueDate"]);
      else if (module === "metric") lines.push(["subject", "activity.metricType"], ["value", "activity.value"]);
      else {
        lines.push(["status", "activity.status"], ["created", "activity.createdAt"], ["updated", "activity.updatedAt"]);
        if (["customer", "hospital"].includes(module)) lines.push(["to", "activity.assignedUserId"]);
        if (["contract", "invoice", "collection"].includes(module)) lines.push(["to", "activity.customerId"]);
        if (module === "contract") lines.push(["subject", "activity.contractNumber"]);
        if (module === "invoice") lines.push(["subject", "activity.invoiceNumber"]);
      }
      briefs.push({ key: `${module}-${event.replaceAll(".", "-")}`, label: module, event, lines });
    }
  }
  // Call lifecycle events do not imply an AI analysis has happened.
  for (const event of MODULE_EVENTS.call) {
    const outbound = event.startsWith("outbound.");
    const lines: Line[] = [["id", "entityId"], ["from", "activity.actorUserId"],
      ["time", "activity.occurredAt"]];
    // Only choose fields the trusted event capability exposes.
    const available = new Set(fieldsForEvent("call", event).map(field => field.value));
    for (const [label, path] of [
      ["to", "newValues.agentId"], ["to", "newValues.assignedAgentId"],
      ["mission", "newValues.campaignId"], ["status", "newValues.status"],
      ["start", "newValues.startedAt"], ["answer", "newValues.answeredAt"],
      ["end", "newValues.endedAt"], ["duration", "newValues.durationSeconds"],
    ] as Line[]) if (available.has(path)) lines.push([label, path]);
    briefs.push({ key: `call-${event.replaceAll(".", "-")}`, label: outbound ? "outbound" : "inbound", event,
      voice: true, lines });
  }
  return briefs;
}

const escape = (text: string) => text.replace(/[&<>"']/g, value =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[value]!));
const token = (path: string) => `{{${path}}}`;
export async function loadAutomationActivityTemplates(visualStyle: "semantic" | "original" = "semantic") {
  const sources: AutomationEmailDefault[] = JSON.parse(await readFile(resolve(process.cwd(), "server/assets/automation-email/templates.json"), "utf8"));
  const frame = sources.find(item => item.id === "indexus-automation-email-data-change");
  if (!frame) throw new Error("Approved automation template frame missing");
  const locales = await loadAutomationTemplateLocales();
  return ACTIVITY_TEMPLATE_LANGUAGES.flatMap(language => {
    const label = (key: string) => activityTemplateLabel(language, key);
    const standard = locales.find(item => item.language === language);
    return activityTemplateBriefs().flatMap(brief => {
      const name = `${label(brief.label)} · ${label(brief.criterion || "detail")}${brief.event ? ` · ${label(eventLabels[brief.event.split(".").pop()!] || "event")}` : ""}`;
      const text = brief.lines.map(([key, path]) => `${label(key)}: ${token(path)}`).join("\n");
      const links = brief.voice && brief.criterion
        ? `\n${label("open")}: {{communication.detailUrl}}\n${label("playback")}: {{communication.playbackUrl}}` : "";
      const content = `${name}\n\n${text}${links}\n\n${label("next")}`;
      const identity = brief.criterion ? brief.label === "email" ? "communication.subject"
        : brief.label === "task" ? "communication.taskTitle" : "communication.senderName" : "activity.title";
      const subject = `${name} · ${token(identity)}`;
      const localized = localizeAutomationEmail(frame, { language,
        automationLabel: standard?.automationLabel || "AUTOMATIZÁCIA", linkTitle: label("open"), task: {},
        email: { "data-change": { name, subject: name, artworkAlt: label(brief.label),
          texts: [name, label("privacy"), label(brief.label), label("detail"), name, label("next"), label("detail"), label("privacy"), label("open")] } } });
      const rows = brief.lines.map(([key, path]) => `<tr><td style="padding:9px 12px;border-bottom:1px solid #e1eaf0;font-size:12px;color:#57768d;vertical-align:top;width:35%;">${escape(label(key))}</td><td style="padding:9px 12px;border-bottom:1px solid #e1eaf0;font-size:14px;color:#21384c;word-break:break-word;">${token(path)}</td></tr>`).join("");
      const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e1eaf0;border-radius:12px;overflow:hidden;border-collapse:separate;border-spacing:0;">${rows}</table>`;
      let html = localized.contentHtml.replace(/<p style="margin:18px 0 0;">[\s\S]*?<\/p>/, table);
      const tone = templateVisualTone(brief.key);
      if (brief.voice) html = html.replace(/<img src="cid:indexus-automation-task"[^>]*>/,
        visualStyle === "original"
          ? `<img src="cid:indexus-automation-phone" width="64" height="64" alt="${escape(label(brief.label))}" style="display:block;width:64px;height:64px;border:0;">`
          : `<img src="cid:indexus-automation-phone-${tone}" width="128" height="128" alt="${escape(label(brief.label))}" style="display:block;width:128px;max-width:100%;height:auto;border:0;">`);
      if (links) html = html.replace(table, `${table}<p style="margin:18px 0 0;"><a href="{{communication.playbackUrl}}" style="display:inline-block;padding:12px 19px;background:#316bd8;border-radius:9px;color:#ffffff;font-weight:bold;text-decoration:none;">${escape(label("playback"))}</a></p><p><a href="{{communication.detailUrl}}">${escape(label("open"))}</a></p>`);
      if (visualStyle === "semantic") {
        const palette = TEMPLATE_VISUAL_PALETTES[tone];
        html = html.replace(/#316bd8/gi, palette.accent)
          .replace(/#edf3f8|#edf4ff|#f3f7fa/gi, palette.background)
          .replace(/#d9e4ed|#e1eaf0|#e8eef3/gi, palette.border)
          .replace(/#173852|#3779a6|#426c8d|#57768d/gi, palette.foreground);
      }
      return (["email", "task", "notification", "sms"] as const).map(type => ({
        id: `indexus-activity-${type}-${brief.key}-${language}`, name, subject, type,
        format: type === "email" ? "html" : "text", language,
        content: type === "sms" ? `${name}\n${text}${links}` : content,
        contentHtml: type === "email" ? normalizeEmailTemplateLayout(html) : null,
      }));
    });
  });
}

/** New additive catalog; never overwrite edits, restore deletions, or mutate rule snapshots. */
export async function ensureAutomationActivityTemplates(pool: { query: (sql: string) => Promise<unknown> }) {
  const templates = await loadAutomationActivityTemplates();
  const sqlValue = (value: string | null) => value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`;
  for (const language of ACTIVITY_TEMPLATE_LANGUAGES) {
    const rows = templates.filter(item => item.language === language).map(item =>
      `(${[item.id, item.name, item.subject, item.type, item.format, item.content, item.contentHtml].map(sqlValue).join(",")})`).join(",\n");
    await pool.query(`WITH seed AS (
      INSERT INTO automation_template_seeds(id) VALUES (${sqlValue(`activity-briefs-${language}`)})
      ON CONFLICT(id) DO NOTHING RETURNING id
    ), defaults(id,name,subject,type,format,content,html) AS (VALUES ${rows})
    INSERT INTO message_templates(id,name,subject,type,format,content,content_html,language,category_id,is_active,country_codes)
    SELECT defaults.id,name,subject,type,format,content,html,${sqlValue(language)},
      CASE WHEN type='email' THEN 'indexus-automation-email-category' ELSE NULL END,true,ARRAY[]::text[]
    FROM defaults CROSS JOIN seed ON CONFLICT(id) DO NOTHING;`);
    // Separate marker: existing installations already seeded activity-briefs.
    // Adding voice findings must not resurrect any previously deleted default.
    const voiceRows = templates.filter(item => item.language === language &&
      VOICE_FINDING_CRITERIA.some(criterion => item.id.includes(`-${criterion}-${language}`)))
      .map(item => `(${[item.id, item.name, item.subject, item.type, item.format, item.content, item.contentHtml].map(sqlValue).join(",")})`).join(",\n");
    await pool.query(`WITH seed AS (
      INSERT INTO automation_template_seeds(id) VALUES (${sqlValue(`activity-voice-findings-${language}`)})
      ON CONFLICT(id) DO NOTHING RETURNING id
    ), defaults(id,name,subject,type,format,content,html) AS (VALUES ${voiceRows})
    INSERT INTO message_templates(id,name,subject,type,format,content,content_html,language,category_id,is_active,country_codes)
    SELECT defaults.id,name,subject,type,format,content,html,${sqlValue(language)},
      CASE WHEN type='email' THEN 'indexus-automation-email-category' ELSE NULL END,true,ARRAY[]::text[]
    FROM defaults CROSS JOIN seed ON CONFLICT(id) DO NOTHING;`);
  }
  // Only pristine defaults receive the requested visual correction. Edited,
  // deleted, disabled templates and saved rule snapshots are never overwritten.
  const originals = await loadAutomationActivityTemplates("original");
  const oldById = new Map(originals.map(item => [item.id, item]));
  for (const language of ACTIVITY_TEMPLATE_LANGUAGES) {
    const visualRows = templates.filter(item => item.language === language && item.type === "email").map(item => {
      const old = oldById.get(item.id)!;
      return `(${[item.id, old.name, old.subject, old.content, old.contentHtml, item.contentHtml].map(sqlValue).join(",")})`;
    }).join(",\n");
    await pool.query(`WITH visuals(id,name,subject,content,old_html,new_html) AS (VALUES ${visualRows})
      UPDATE message_templates AS template SET content_html=visuals.new_html
      FROM visuals WHERE template.id=visuals.id AND template.type='email' AND template.format='html'
        AND template.language=${sqlValue(language)} AND template.is_active=true
        AND template.name=visuals.name AND template.subject=visuals.subject
        AND template.content=visuals.content AND template.content_html=visuals.old_html
        AND cardinality(template.country_codes)=0;`);
  }
}
