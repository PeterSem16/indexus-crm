import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadAutomationTemplateLocales, localizeAutomationEmail, type AutomationEmailDefault, type AutomationTemplateLocale } from "./automation-template-locales";

/** Completed deliberately belongs to its own WHEN, never status_changed. */
export const TASK_EVENT_TEMPLATE_DEFINITIONS = [
  { key: "created", eventType: "created" },
  { key: "updated", eventType: "updated" },
  { key: "status-changed", eventType: "status_changed" },
  { key: "assigned", eventType: "task.assigned" },
  { key: "completed", eventType: "task.completed" },
  { key: "overdue", eventType: "task.overdue" },
  { key: "pending", eventType: "status_changed", status: "pending" },
  { key: "in-progress", eventType: "status_changed", status: "in_progress" },
  { key: "cancelled", eventType: "status_changed", status: "cancelled" },
] as const;

type Copy = { names: string[]; leads: string[]; intro: string; detail: string; next: string };
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const textRuns = (html: string) => [...html.matchAll(/>([^<>]*)</g)]
  .map(match => match[1]).filter(text => /\p{L}/u.test(text) && !text.includes("AUTOMATIZÁCIA"))
  .map(text => text.trim());
const plainText = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ")
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

export async function loadAutomationTaskEventTemplates() {
  const sources: AutomationEmailDefault[] = JSON.parse(await readFile(resolve(process.cwd(), "server/assets/automation-email/templates.json"), "utf8"));
  const reference = sources.find(template => template.id === "indexus-automation-email-new-task");
  if (!reference) throw new Error("Approved new-task email design is missing");
  const copy: Record<string, Copy> = JSON.parse(await readFile(resolve(process.cwd(), "server/assets/automation-email/task-event-templates.json"), "utf8"));
  const locales = await loadAutomationTemplateLocales();
  const baseTexts = textRuns(reference.contentHtml);
  if (baseTexts.length !== 12) throw new Error("Approved new-task layout changed; recheck Task event copy");
  const textsFor = (language: string, index: number): string[] => {
    const languageCopy = copy[language];
    if (!languageCopy || languageCopy.names.length !== 9 || languageCopy.leads.length !== 6 ||
      [...languageCopy.names, ...languageCopy.leads, languageCopy.intro, languageCopy.detail, languageCopy.next].some(text => !text?.trim())) {
      throw new Error(`Missing Task event template translation: ${language}`);
    }
    const texts = [...(language === "sk" ? baseTexts : locales.find(locale => locale.language === language)!.email["new-task"].texts)];
    const lead = languageCopy.leads[index < 6 ? index : 2];
    texts[0] = texts[1] = texts[4] = lead;
    texts[3] = languageCopy.names[index];
    texts[5] = languageCopy.intro;
    texts[10] = languageCopy.next;
    return texts;
  };
  return ["sk", ...locales.map(locale => locale.language)].map(language => ({
    language,
    templates: TASK_EVENT_TEMPLATE_DEFINITIONS.map((definition, index) => {
      const skTexts = textsFor("sk", index);
      let cursor = 0;
      const html = reference.contentHtml.replace(/>([^<>]*)</g, (whole, text: string) =>
        !/\p{L}/u.test(text) || text.includes("AUTOMATIZÁCIA") ? whole : `>${escapeHtml(skTexts[cursor++])}<`);
      const id = `indexus-automation-email-task-event-${definition.key}`;
      const source: AutomationEmailDefault = { id, name: copy.sk.names[index], subject: skTexts[0],
        contentHtml: html, content: plainText(html), language: "sk" };
      const locale = locales.find(item => item.language === language);
      const email = locale ? localizeAutomationEmail(source, {
        ...locale, email: { ...locale.email, [`task-event-${definition.key}`]: {
          name: copy[language].names[index], subject: textsFor(language, index)[0],
          artworkAlt: locale.email["new-task"].artworkAlt, texts: textsFor(language, index),
        } },
      } as AutomationTemplateLocale) : source;
      const suffix = language === "sk" ? "" : `-${language}`;
      const task = { id: `indexus-task-template-event-${definition.key}${suffix}`, name: copy[language].names[index],
        subject: textsFor(language, index)[0],
        content: `${textsFor(language, index)[0]}\n${copy[language].detail}: {{newValues.title}}\n${copy[language].next}`,
        language };
      return { ...definition, email, task };
    }),
  }));
}

/** A new batch marker per language; never restore deleted or edited defaults. */
export async function ensureAutomationTaskEventTemplates(pool: { query: (sql: string) => Promise<unknown> }) {
  const literal = (value: string | null) => value === null ? "NULL" : `'${value.replace(/'/g, "''")}'`;
  for (const { language, templates } of await loadAutomationTaskEventTemplates()) {
    const rows = templates.flatMap(({ email, task }) => [
      [email.id, email.name, "email", "html", email.subject, email.content, email.contentHtml],
      [task.id, task.name, "task", "text", task.subject, task.content, null],
    ]).map(values => `(${values.map(literal).join(",")})`).join(",\n");
    await pool.query(`
      WITH seed AS (
        INSERT INTO automation_template_seeds (id) VALUES (${literal(`approved-task-event-templates-${language}`)})
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
      ON CONFLICT (id) DO NOTHING;`);
  }
}
