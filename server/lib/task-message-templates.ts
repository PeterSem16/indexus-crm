import { loadAutomationTemplateLocales, localizedTaskDefaults } from "./automation-template-locales";

export const DEFAULT_TASK_MESSAGE_TEMPLATES = [
  ["check-data", "Skontrolovať údaje", "Over správnosť a úplnosť údajov. Chýbajúce informácie doplň."],
  ["contact-verify", "Kontaktovať a overiť", "Kontaktuj príslušnú osobu, over aktuálny stav a zapíš výsledok."],
  ["complete-documents", "Doplniť podklady", "Vyžiadaj chýbajúce podklady a prilož ich k záznamu."],
  ["response-needed", "Potrebná reakcia", "Záznam čaká na reakciu. Skontroluj poslednú komunikáciu a zabezpeč ďalší krok."],
  ["overdue", "Termín prekročený", "Termín bol prekročený. Over príčinu a zabezpeč nápravu."],
  ["urgent-review", "Urgentné preverenie", "Situácia vyžaduje prednostné preverenie. Zapíš zistenia a prijaté opatrenia."],
  ["handover", "Odovzdať na riešenie", "Doplň stručný kontext a odovzdaj prípad zodpovednému tímu. Over jeho prevzatie."],
] as const;

export async function ensureTaskMessageTemplates(pool: { query: (sql: string) => Promise<unknown> }) {
  const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
  const locales = await loadAutomationTemplateLocales();
  const batches = [
    { id: "task-templates", language: "sk", templates: DEFAULT_TASK_MESSAGE_TEMPLATES },
    ...locales.map(locale => ({
      id: `task-templates-${locale.language}`, language: locale.language,
      templates: localizedTaskDefaults(DEFAULT_TASK_MESSAGE_TEMPLATES, locale),
    })),
  ];
  for (const batch of batches) {
    const values = batch.templates.map(([key, title, body]) =>
      `(${literal(`indexus-task-template-${key}${batch.language === "sk" ? "" : `-${batch.language}`}`)}, ${literal(title)}, ${literal(body)})`).join(",\n");
    // Each language has its own persistent marker. Never restore edited or
    // deleted defaults, including SK, when adding another language.
    await pool.query(`
    CREATE TABLE IF NOT EXISTS automation_template_seeds (
      id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now()
    );
    WITH seed AS (
      INSERT INTO automation_template_seeds (id) VALUES (${literal(batch.id)})
      ON CONFLICT (id) DO NOTHING RETURNING id
    ), defaults (id, title, body) AS (VALUES ${values})
    INSERT INTO message_templates (id, name, type, format, subject, content, language, is_active)
      SELECT defaults.id, defaults.title, 'task', 'text', defaults.title, defaults.body, ${literal(batch.language)}, true
      FROM defaults CROSS JOIN seed
    ON CONFLICT (id) DO NOTHING;
  `);
  }
}

/** Task templates contain plain text and a task title, never sendable HTML. */
export function validTaskMessageTemplate(body: any, partial = false): boolean {
  if (!body || typeof body !== "object") return false;
  if (!partial && (typeof body.name !== "string" || !body.name.trim() ||
      typeof body.content !== "string" || !body.content.trim())) return false;
  if (body.format !== undefined && body.format !== "text") return false;
  if (body.contentHtml != null && body.contentHtml !== "") return false;
  if (body.subject != null && typeof body.subject !== "string") return false;
  if (body.content !== undefined && (typeof body.content !== "string" || !body.content.trim())) return false;
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) return false;
  return true;
}
