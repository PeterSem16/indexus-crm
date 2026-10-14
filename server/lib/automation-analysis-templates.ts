import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AUTOMATION_ANALYSIS_TEMPLATE_LANGUAGES,
  AUTOMATION_ANALYSIS_TEMPLATE_KEYS,
  automationAnalysisTemplateCopy,
  type AutomationAnalysisTemplateLanguage,
} from "@shared/automation-analysis-template-copy";
import { normalizeEmailTemplateLayout } from "@shared/email-template-layout";
import { loadAutomationTemplateLocales, localizeAutomationEmail, type AutomationEmailDefault } from "./automation-template-locales";
import { automationTemplateVisuals, refreshPristineTemplateVisuals } from "./automation-template-visuals";

export async function loadAutomationAnalysisEmailTemplates(visualStyle: "semantic" | "original" = "semantic") {
  const sources: AutomationEmailDefault[] = JSON.parse(
    await readFile(resolve(process.cwd(), "server/assets/automation-email/templates.json"), "utf8"),
  );
  const approvedFrame = sources.find(template => template.id === "indexus-automation-email-data-change");
  if (!approvedFrame) throw new Error("Approved rounded Automatizácia email frame missing");
  const localeRows = await loadAutomationTemplateLocales();
  return AUTOMATION_ANALYSIS_TEMPLATE_LANGUAGES.map(language => {
    const copy = automationAnalysisTemplateCopy(language);
    const standard = localeRows.find(locale => locale.language === language);
    const localized = {
      language,
      automationLabel: standard?.automationLabel ?? "AUTOMATIZÁCIA",
      linkTitle: copy.linkTitle,
      task: {},
      email: {},
    };
    const templates = AUTOMATION_ANALYSIS_TEMPLATE_KEYS.map(key => {
      const variant = copy.variants[key];
      const generated = localizeAutomationEmail(approvedFrame, {
        ...localized,
        email: {
          "data-change": {
            name: variant.name,
            subject: variant.name,
            artworkAlt: copy.artworkAlt,
            texts: [
              variant.name, copy.preheader, copy.badge, variant.name, variant.name,
              variant.summary, copy.sectionHeading, copy.sectionBody, copy.cta,
            ],
          },
        },
      });
      return {
        ...generated,
        id: `indexus-automation-email-analysis-${key}-${language}`,
        name: variant.name,
        subject: variant.name,
        contentHtml: normalizeEmailTemplateLayout(visualStyle === "semantic" ? automationTemplateVisuals(`analysis-${key}`, generated.contentHtml) : generated.contentHtml),
      };
    });
    return { language, templates };
  });
}

export function automationAnalysisNotificationDefaults(language: AutomationAnalysisTemplateLanguage) {
  const copy = automationAnalysisTemplateCopy(language);
  return AUTOMATION_ANALYSIS_TEMPLATE_KEYS.map(key => {
    const variant = copy.variants[key];
    return {
      id: `indexus-notification-template-analysis-${key}-${language}`,
      name: variant.name,
      type: "notification" as const,
      format: "text" as const,
      subject: variant.name,
      content: `${variant.summary} ${copy.notificationSummaryPrefix} ${key === "invoice-found" ? "{{analysis.invoiceCount}}" : "{{analysis.summary}}"}`,
      language,
      isActive: true,
    };
  });
}

export function automationAnalysisSmsDefaults(language: AutomationAnalysisTemplateLanguage) {
  const copy = automationAnalysisTemplateCopy(language);
  return AUTOMATION_ANALYSIS_TEMPLATE_KEYS.map(key => {
    const variant = copy.variants[key];
    return {
      id: `indexus-sms-template-analysis-${key}-${language}`,
      name: variant.name,
      type: "sms" as const,
      format: "text" as const,
      content: variant.sms,
      language,
      isActive: true,
    };
  });
}

const sqlLiteral = (value: string | null) =>
  value === null ? "NULL" : `'${value.replace(/'/g, "''")}'`;

export async function ensureAutomationAnalysisEmailTemplates(pool: { query: (sql: string) => Promise<unknown> }) {
  for (const { language, templates } of await loadAutomationAnalysisEmailTemplates()) {
    const rows = templates.map(template =>
      `(${[
        template.id, template.name, template.subject, template.content, template.contentHtml, language,
      ].map(sqlLiteral).join(",")})`,
    ).join(",\n");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS automation_template_seeds (
        id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now()
      );
      WITH seed AS (
        INSERT INTO automation_template_seeds (id)
        VALUES (${sqlLiteral(`approved-automation-analysis-email-${language}`)})
        ON CONFLICT (id) DO NOTHING RETURNING id
      ), category AS (
        INSERT INTO template_categories (id,name,description,icon,color,is_active)
        SELECT 'indexus-automation-email-category','Automatizácia','Emailové šablóny automatizácií','Zap','#316bd8',true
        FROM seed
        ON CONFLICT (id) DO UPDATE SET id=EXCLUDED.id RETURNING id
      ), defaults (id,name,subject,content,html,language) AS (VALUES ${rows})
      INSERT INTO message_templates (id,name,type,format,subject,content,content_html,language,category_id,is_active,country_codes)
      SELECT defaults.id,defaults.name,'email','html',defaults.subject,defaults.content,defaults.html,
        defaults.language,category.id,true,ARRAY[]::text[]
      FROM defaults CROSS JOIN category
      ON CONFLICT (id) DO NOTHING;
    `);
  }
  await refreshPristineTemplateVisuals(pool,
    (await loadAutomationAnalysisEmailTemplates("original")).flatMap(batch => batch.templates),
    (await loadAutomationAnalysisEmailTemplates()).flatMap(batch => batch.templates));
}

export async function ensureAutomationAnalysisChannelTemplates(
  pool: { query: (sql: string) => Promise<unknown> },
  channel: "sms" | "notification",
) {
  for (const language of AUTOMATION_ANALYSIS_TEMPLATE_LANGUAGES) {
    const rows = channel === "sms"
      ? automationAnalysisSmsDefaults(language).map(template => `(${[
        template.id, template.name, template.content, language,
      ].map(sqlLiteral).join(",")})`).join(",\n")
      : automationAnalysisNotificationDefaults(language).map(template => `(${[
        template.id, template.name, template.subject, template.content, language,
      ].map(sqlLiteral).join(",")})`).join(",\n");
    const query = channel === "sms" ? `
      CREATE TABLE IF NOT EXISTS automation_template_seeds (
        id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now()
      );
      WITH seed AS (
        INSERT INTO automation_template_seeds (id)
        VALUES (${sqlLiteral(`automation-analysis-${channel}-defaults-${language}`)})
        ON CONFLICT (id) DO NOTHING RETURNING id
      ), defaults (id,name,message,language) AS (VALUES ${rows})
      INSERT INTO message_templates (id,name,type,format,content,language,is_active,country_codes)
      SELECT defaults.id,defaults.name,'sms','text',defaults.message,defaults.language,true,ARRAY[]::text[]
      FROM defaults CROSS JOIN seed
      ON CONFLICT (id) DO NOTHING;
    ` : `
      CREATE TABLE IF NOT EXISTS automation_template_seeds (
        id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now()
      );
      WITH seed AS (
        INSERT INTO automation_template_seeds (id)
        VALUES (${sqlLiteral(`automation-analysis-${channel}-defaults-${language}`)})
        ON CONFLICT (id) DO NOTHING RETURNING id
      ), defaults (id,name,title,message,language) AS (VALUES ${rows})
      INSERT INTO message_templates (id,name,type,format,subject,content,language,is_active,country_codes)
      SELECT defaults.id,defaults.name,'notification','text',defaults.title,defaults.message,
        defaults.language,true,ARRAY[]::text[]
      FROM defaults CROSS JOIN seed
      ON CONFLICT (id) DO NOTHING;
    `;
    await pool.query(query);
  }
}
