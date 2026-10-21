import { activityTemplateLabel, ACTIVITY_TEMPLATE_LANGUAGES, type ActivityTemplateLanguage } from "../../shared/automation-activity-template-copy";
import { templateVisualTone } from "../../shared/automation-template-visual";
import { legacyAutomationDefaults, upgradeLegacyDefault, previousLegacyDefaultUpgrade, legacyTemplateContextLines, type LegacyDefault } from "./automation-legacy-template-upgrade";
import { activityTemplateBriefs, loadAutomationActivityTemplates } from "./automation-activity-templates";
import { humanTemplateCopy } from "./automation-human-copy";
import { expressiveHumanEmail } from "./automation-expressive-email";

type Line = [string, string];
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const token = (path: string) => `{{${path}}}`;
const technical = (path: string) => path === "entityId" || /(?:^|\.)(?:id|callId|recordingId|eventType)$/.test(path);
const colors = { positive: "#176b5d", negative: "#b34e40", urgent: "#916117", deadline: "#7656a1", info: "#176b5d" };

/** Variant B, expressed as portable email HTML, not a browser-only mockup. */
export function humanizeAutomationTemplate(template: LegacyDefault, sourceLines: Line[], appearance: "classic" | "expressive" = "expressive"): LegacyDefault {
  const language = template.language as ActivityTemplateLanguage;
  const c = (key: string) => humanTemplateCopy(language, key);
  const label = (key: string) => key === "count" ? c("count") : activityTemplateLabel(language, key);
  const lines = sourceLines.filter(([key, path]) => key !== "id" && key !== "event" && !technical(path));
  const analysis = lines.some(([, path]) => path.startsWith("analysis."));
  const call = /call-|analysis-(?:inbound|outbound|voice)-/.test(template.id);
  const task = template.type === "task" || /new-task|task-event|task-template-(?!call)|deadline|overdue|assigned|handover/.test(template.id);
  const communication = analysis || lines.some(([, path]) => path.startsWith("communication."));
  const statusList = template.id.startsWith(`indexus-activity-${template.type}-status_list-`);
  if (!statusList && !communication && !call && !lines.some(([, path]) => path === "activity.actorUserId"))
    lines.push(["from", "activity.actorUserId"]);
  if (template.id.includes("invoice-found")) lines.push(["count", "analysis.invoiceCount"]);
  const title = communication
    ? lines.find(([, path]) => path === "communication.subject" || path === "communication.taskTitle")?.[1] || "communication.senderName"
    : call ? null : statusList ? "contact.name" : "activity.title";
  const subject = `${template.name}${title ? ` · ${token(title)}` : ""}`;
  const lead = statusList ? c(task ? "task" : "record").replaceAll("{{activity.title}}", token("contact.name"))
    : template.type === "task" && !template.id.startsWith("indexus-activity-")
    ? template.content.replace(/\{\{\s*(?:entityId|activity\.id|communication\.id|communication\.callId|newValues\.id)\s*\}\}/g, "{{activity.title}}").replace(/\bID\s*[:·]\s*/gi, "")
    : c(communication ? "source" : call ? "call" : task ? "task" : "record");
  const unique = [...new Map(lines.filter(([key, path]) =>
    !["subject", "summary", "sentiment", "tone"].includes(key) && path !== title).map(line => [line[1], line])).values()];
  const visible = unique;
  const details = visible.map(([key, path]) => `${label(key)}: ${token(path)}`);
  const summary = analysis ? `${label("summary")}: {{analysis.summary}}\n${label("sentiment")}: {{analysis.sentiment}} · ${label("tone")}: {{analysis.tone}}` : "";
  const links = call && analysis ? `${label("open")}: {{communication.detailUrl}}\n${label("playback")}: {{communication.playbackUrl}}` : "";
  const channelDetails = template.type === "sms" || template.type === "notification"
    ? visible.filter(([key]) => ["from", "to", "time", "due", "priority", "mission", "duration", "count"].includes(key)).map(([key, path]) => `${label(key)}: ${token(path)}`).join(" · ")
    : details.join("\n");
  const content = [subject, template.type === "sms" ? "" : lead, channelDetails, summary, links,
    template.type === "sms" ? "" : label("next")].filter(Boolean).join("\n\n");
  if (template.type !== "email") return { ...template, subject, content, contentHtml: null };

  const accent = colors[templateVisualTone(template.id)];
  // The origin is the same configured canonical origin used by authenticated call links.
  const origin = new URL(process.env.APP_BASE_URL || "https://indexus.cordbloodcenter.com");
  if (origin.protocol !== "https:" || origin.username || origin.password) throw new Error("Invalid INDEXUS email workspace origin");
  const sourcePeople = visible.filter(([key]) => key === "from" || key === "to");
  const prose = sourcePeople.map(([key, path]) => `<p data-indexus-optional="${path}" style="margin:8px 0;font-size:14px;line-height:1.65;color:#587371;">${c(key === "from" ? communication ? "sourcePerson" : "author" : communication ? "recipient" : "assigned").replace("{{person}}", token(path))}</p>`).join("");
  const detailBlocks = visible.filter(([key]) => key !== "from" && key !== "to").map(([key, path]) => `<div data-indexus-optional="${path}" style="display:inline-block;vertical-align:top;min-width:145px;max-width:100%;padding:10px 18px 10px 0;"><small style="display:block;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#587371;">${escape(label(key))}</small><strong style="display:block;margin-top:5px;font-size:13px;line-height:1.5;overflow-wrap:anywhere;">${token(path)}</strong></div>`).join("");
  const badges = analysis ? `<div style="margin-top:16px;">${["sentiment", "tone"].map(field =>
    `<span data-indexus-optional="analysis.${field}" data-indexus-result="${field}" style="display:inline-block;margin:0 8px 8px 0;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:700;background:#e9f3ef;color:#176b5d;border:1px solid #c9ded7;"><small style="font-size:10px;">${escape(label(field))} · </small>{{analysis.${field}}}</span>`).join("")}</div>` : "";
  const finding = analysis ? `<div data-indexus-optional="analysis.summary" style="margin-top:20px;padding:18px 20px;background:#fffaf0;border-left:3px solid ${accent};border-radius:0 14px 14px 0;"><small style="color:#587371;text-transform:uppercase;letter-spacing:.05em;">${escape(c("analysis"))}</small><p style="margin:10px 0 0;font-size:15px;line-height:1.65;">{{analysis.summary}}</p></div>${badges}` : "";
  const buttons = call && analysis
    ? `<a href="{{communication.detailUrl}}" style="display:inline-block;margin:0 12px 10px 0;padding:14px 20px;background:#176b5d;color:#fffefb;text-decoration:none;border-radius:10px;font-weight:700;">${escape(label("open"))}</a><a href="{{communication.playbackUrl}}" style="display:inline-block;padding:12px 0;color:#176b5d;font-weight:700;">${escape(label("playback"))}</a>`
    : `<a href="${escape(origin.origin)}" style="display:inline-block;padding:14px 20px;background:#176b5d;color:#fffefb;text-decoration:none;border-radius:10px;font-weight:700;">${escape(c("open"))}</a>`;
  const illustration = call ? "call" : /deadline|overdue/.test(template.id) ? "deadline" : "task";
  const html = `<!doctype html><html lang="${language}"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:0;background:#eef5ef;color:#173c3a;font-family:'DM Sans',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fffefb;border:1px solid #dce9df;border-radius:22px;border-collapse:separate;overflow:hidden;">
<tr><td style="padding:27px 28px 0;"><b style="letter-spacing:.13em;font-size:15px;color:#176b5d;">INDEXUS</b><div style="height:3px;width:40px;background:${accent};margin-top:18px;border-radius:3px;"></div></td></tr>
<tr><td style="padding:24px 28px 30px;"><small style="color:${accent};font-size:10px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;">${escape(template.name)}</small>
<img src="cid:indexus-automation-human-${illustration}" width="90" height="72" alt="" style="float:right;display:block;width:90px;height:72px;margin:12px 0 12px 16px;border:0;border-radius:18px;">
<h1 style="margin:12px 0 18px;font-family:'Manrope',Arial,sans-serif;font-size:28px;line-height:1.2;letter-spacing:-.025em;color:#173c3a;">${title ? token(title) : escape(template.name)}</h1>
<p style="font-size:15px;line-height:1.7;color:#587371;margin:0 0 20px;">${lead}</p>
${prose}
<div style="padding:12px 0;border-top:1px solid #dce9df;border-bottom:1px solid #dce9df;">${detailBlocks}</div>${finding}
<div style="margin-top:22px;padding:16px 18px;background:#f3f7f0;border-radius:12px;font-size:14px;line-height:1.6;"><b>${escape(c("next"))}: </b>${escape(label("next").split(" · ").slice(1).join(" · ") || label("next"))}</div>
<div style="margin-top:24px;">${buttons}</div></td></tr>
<tr><td style="padding:19px 28px;border-top:1px solid #dce9df;color:#587371;font-size:11px;line-height:1.7;">INDEXUS · ${escape(c("tagline"))}<br>${escape(c("footer"))}</td></tr>
</table></td></tr></table></body></html>`;
  return { ...template, subject, content, contentHtml: appearance === "classic" ? html : expressiveHumanEmail(html, template.id) };
}

export async function humanAutomationCatalog() {
  const legacy = await legacyAutomationDefaults();
  const activity = [...await loadAutomationActivityTemplates("original"), ...await loadAutomationActivityTemplates()];
  const briefs = activityTemplateBriefs();
  // The first invoice-found notification batch used summary rather than count.
  const historicalInvoices = legacy.filter(t => t.type === "notification" && t.id.includes("analysis-invoice-found"))
    .map(t => ({ ...t, content: t.content.replace("{{analysis.invoiceCount}}", "{{analysis.summary}}") }));
  const sources = [...[...legacy, ...historicalInvoices].map(old => ({ old, lines: legacyTemplateContextLines(old) })),
    ...activity.map(old => ({ old, lines: briefs.find(b => old.id === `indexus-activity-${old.type}-${b.key}-${old.language}`)!.lines }))];
  const templates = new Map<string, LegacyDefault>();
  for (const { old, lines } of sources) templates.set(old.id, humanizeAutomationTemplate(old, lines));
  return { sources, templates: [...templates.values()] };
}

/** Exact persisted-byte CAS. No inserts, reactivation, recipient changes or rule rewrites. */
export async function ensureHumanAutomationTemplates(pool: { query: (sql: string) => Promise<unknown> }) {
  const { sources, templates } = await humanAutomationCatalog();
  const next = new Map(templates.map(template => [template.id, template]));
  const quote = (value?: string | null) => value == null ? "NULL" : `'${value.replaceAll("'", "''")}'`;
  for (const language of ACTIVITY_TEMPLATE_LANGUAGES) {
    const values = sources.filter(({ old }) => old.language === language).flatMap(({ old, lines }) => {
      const modern = next.get(old.id)!;
      const classic = humanizeAutomationTemplate(old, lines, "classic");
      const predecessors = [
        ...(old.id.startsWith("indexus-activity-") ? [old] : [old, upgradeLegacyDefault(old), previousLegacyDefaultUpgrade(old)]),
        ...(old.type === "email" ? [classic] : []),
      ];
      return predecessors.filter((v): v is LegacyDefault => Boolean(v)).map(previous =>
        `(${[old.id, old.name, old.type, previous.subject, previous.content, previous.contentHtml,
          modern.subject, modern.content, modern.contentHtml].map(quote).join(",")})`);
    });
    if (!values.length) continue;
    await pool.query(`WITH revisions(id,name,type,old_subject,old_content,old_html,subject,content,html) AS (VALUES ${[...new Set(values)].join(",\n")})
      UPDATE message_templates AS t SET subject=r.subject,content=r.content,content_html=r.html
      FROM revisions AS r WHERE t.id=r.id AND t.name=r.name AND t.type=r.type AND t.language=${quote(language)}
        AND t.format=CASE WHEN r.type='email' THEN 'html' ELSE 'text' END
        AND t.is_active=true AND cardinality(t.country_codes)=0
        AND t.subject IS NOT DISTINCT FROM r.old_subject AND t.content=r.old_content AND t.content_html IS NOT DISTINCT FROM r.old_html
        AND (t.subject IS DISTINCT FROM r.subject OR t.content IS DISTINCT FROM r.content OR t.content_html IS DISTINCT FROM r.html);`);
  }
}
