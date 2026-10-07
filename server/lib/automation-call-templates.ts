import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AUTOMATION_TRANSLATION_LANGUAGES, loadAutomationTemplateLocales, localizeAutomationEmail, type AutomationEmailDefault } from "./automation-template-locales";

type CallVariant = { key: string; name: string; emailBody: string; taskName: string; taskBody: string };
type CallCopy = { badge: string; detailHeading: string; detailText: string; openCall: string; linkTitle: string; artworkAlt: string; variants: CallVariant[] };
export const CALL_TEMPLATE_KEYS = ["inbound", "inbound-missed", "outbound", "outbound-unanswered"] as const;

/** Reuses the approved record-notification design; no numbers, identities or new artwork. */
export async function loadAutomationCallTemplates() {
  const originals: AutomationEmailDefault[] = JSON.parse(await readFile(resolve(process.cwd(), "server/assets/automation-email/templates.json"), "utf8"));
  const source = originals.find(template => template.id === "indexus-automation-email-data-change");
  if (!source) throw new Error("Approved automation record-notification design missing");
  const copies: Record<string, CallCopy> = JSON.parse(await readFile(resolve(process.cwd(), "server/assets/automation-email/call-templates.json"), "utf8"));
  const locales = await loadAutomationTemplateLocales();
  return ["sk" as const, ...AUTOMATION_TRANSLATION_LANGUAGES].map(language => {
    const copy = copies[language];
    if (!copy || JSON.stringify(copy.variants?.map(item => item.key)) !== JSON.stringify(CALL_TEMPLATE_KEYS)) {
      throw new Error(`Incomplete call template catalog: ${language}`);
    }
    const automationLabel = language === "sk" ? "AUTOMATIZÁCIA" : locales.find(locale => locale.language === language)!.automationLabel;
    const templates = copy.variants.map(variant => {
      const email = localizeAutomationEmail(source, {
        language, automationLabel, linkTitle: copy.linkTitle, task: {},
        email: { "data-change": {
          name: variant.name, subject: variant.name, artworkAlt: copy.artworkAlt,
          texts: [variant.name, variant.emailBody, copy.badge, variant.name, variant.name, variant.emailBody,
            copy.detailHeading, copy.detailText, copy.openCall],
        } },
      });
      if (!variant.taskName?.trim() || !variant.taskBody?.trim()) throw new Error(`Missing call Task copy: ${language}/${variant.key}`);
      const suffix = `${variant.key}${language === "sk" ? "" : `-${language}`}`;
      return {
        email: { ...email, id: `indexus-automation-email-call-${suffix}` },
        task: { id: `indexus-task-template-call-${suffix}`, name: variant.taskName, subject: variant.taskName, content: variant.taskBody, language },
      };
    });
    return { language, templates };
  });
}

export async function ensureAutomationCallTemplates(pool: { query: (sql: string) => Promise<unknown> }) {
  const batches = await loadAutomationCallTemplates();
  const literal = (value: string | null) => value === null ? "NULL" : `'${value.replace(/'/g, "''")}'`;
  for (const { language, templates } of batches) {
    const rows = templates.flatMap(({ email, task }) => [
      [email.id, email.name, "email", "html", email.subject, email.content, email.contentHtml],
      [task.id, task.name, "task", "text", task.subject, task.content, null],
    ]).map(values => `(${values.map(literal).join(",")})`).join(",\n");
    await pool.query(`
      WITH seed AS (
        INSERT INTO automation_template_seeds (id) VALUES (${literal(`approved-automation-call-templates-${language}`)})
        ON CONFLICT (id) DO NOTHING RETURNING id
      ), category AS (
        INSERT INTO template_categories (id,name,description,icon,color,is_active)
        SELECT 'indexus-automation-email-category','Automatizácia','Emailové šablóny automatizácií','Zap','#316bd8',true FROM seed
        ON CONFLICT (id) DO UPDATE SET id=EXCLUDED.id RETURNING id
      ), defaults (id,name,type,format,subject,content,html) AS (VALUES ${rows})
      INSERT INTO message_templates (id,name,type,format,subject,content,content_html,language,category_id,is_active,country_codes)
        SELECT defaults.id,defaults.name,defaults.type,defaults.format,defaults.subject,defaults.content,defaults.html,
          ${literal(language)},CASE WHEN defaults.type='email' THEN category.id ELSE NULL END,true,ARRAY[]::text[]
        FROM defaults CROSS JOIN category
      ON CONFLICT (id) DO NOTHING;
    `);
  }
}
