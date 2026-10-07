import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const AUTOMATION_TRANSLATION_LANGUAGES = ["en", "cs", "hu", "ro", "it", "de"] as const;
export type AutomationTranslationLanguage = typeof AUTOMATION_TRANSLATION_LANGUAGES[number];
export type AutomationEmailDefault = {
  id: string;
  name: string;
  subject: string;
  content: string;
  contentHtml: string;
  language?: string;
};
type EmailCopy = { name: string; subject: string; artworkAlt: string; texts: string[] };
export type AutomationTemplateLocale = {
  language: AutomationTranslationLanguage | "sk";
  automationLabel: string;
  linkTitle: string;
  email: Record<string, EmailCopy>;
  task: Record<string, [string, string]>;
};

export async function loadAutomationTemplateLocales(): Promise<AutomationTemplateLocale[]> {
  return Promise.all(AUTOMATION_TRANSLATION_LANGUAGES.map(async language => ({
    ...JSON.parse(await readFile(resolve(process.cwd(), `server/assets/automation-email/locales/${language}.json`), "utf8")),
    language,
  })));
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\u00a0/g, "&nbsp;");
const requiredText = (value: unknown, context: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing automation template translation: ${context}`);
  return value;
};
const tokens = (text: string) => [...text.matchAll(/{{[^{}]+}}/g)].map(match => match[0]).sort();

/** Translate only copy: the approved SK markup, styles, CID artwork and variables stay authoritative. */
export function localizeAutomationEmail(source: AutomationEmailDefault, locale: AutomationTemplateLocale): AutomationEmailDefault {
  const key = source.id.replace(/^indexus-automation-email-/, "");
  const copy = locale.email[key];
  if (!copy || !Array.isArray(copy.texts)) throw new Error(`Missing automation email: ${locale.language}/${key}`);
  let cursor = 0;
  const html = source.contentHtml
    .replace(/<html lang="sk">/, `<html lang="${locale.language}">`)
    .replace(/>([^<>]*)</g, (whole, text: string) => {
      if (!/\p{L}/u.test(text)) return whole; // whitespace, step numbers, punctuation
      if (text.includes("AUTOMATIZÁCIA")) {
        return `>${text.replace("AUTOMATIZÁCIA", escapeHtml(requiredText(locale.automationLabel, locale.language)))}<`;
      }
      const translated = requiredText(copy.texts[cursor++], `${locale.language}/${key}/text`);
      return `>${text.match(/^\s*/)?.[0] || ""}${escapeHtml(translated)}${text.match(/\s*$/)?.[0] || ""}<`;
    })
    .replace(/alt="[^"]*"/g, () => `alt="${escapeHtml(requiredText(copy.artworkAlt, `${locale.language}/${key}/alt`))}"`)
    .replace(/title="Otvorte príslušný záznam v INDEXUS"/g,
      () => `title="${escapeHtml(requiredText(locale.linkTitle, `${locale.language}/linkTitle`))}"`);
  if (cursor !== copy.texts.length) throw new Error(`Automation email copy does not match SK layout: ${locale.language}/${key}`);
  const subject = requiredText(copy.subject, `${locale.language}/${key}/subject`);
  if (JSON.stringify(tokens(source.contentHtml)) !== JSON.stringify(tokens(html)) ||
      JSON.stringify(tokens(source.subject)) !== JSON.stringify(tokens(subject))) {
    throw new Error(`Automation email variables changed: ${locale.language}/${key}`);
  }
  return {
    id: `${source.id}-${locale.language}`,
    name: requiredText(copy.name, `${locale.language}/${key}/name`),
    subject,
    contentHtml: html,
    content: html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
      .replace(/\s+/g, " ").trim(),
    language: locale.language,
  };
}

export function localizedTaskDefaults(
  sources: readonly (readonly [string, string, string])[],
  locale: AutomationTemplateLocale,
): Array<readonly [string, string, string]> {
  return sources.map(([key, sourceTitle, sourceBody]) => {
    const copy = locale.task[key];
    if (!Array.isArray(copy) || copy.length !== 2) throw new Error(`Missing Task template: ${locale.language}/${key}`);
    const title = requiredText(copy[0], `${locale.language}/${key}/title`);
    const body = requiredText(copy[1], `${locale.language}/${key}/body`);
    if (JSON.stringify(tokens(sourceTitle + sourceBody)) !== JSON.stringify(tokens(title + body))) {
      throw new Error(`Task template variables changed: ${locale.language}/${key}`);
    }
    return [key, title, body] as const;
  });
}
