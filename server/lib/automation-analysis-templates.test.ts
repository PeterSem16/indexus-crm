import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  AUTOMATION_ANALYSIS_TEMPLATE_KEYS,
  AUTOMATION_ANALYSIS_TEMPLATE_LANGUAGES,
  automationAnalysisTemplateCopy,
} from "@shared/automation-analysis-template-copy";
import {
  automationAnalysisNotificationDefaults,
  automationAnalysisSmsDefaults,
  ensureAutomationAnalysisChannelTemplates,
  ensureAutomationAnalysisEmailTemplates,
  loadAutomationAnalysisEmailTemplates,
} from "./automation-analysis-templates";
import { normalizeEmailTemplateLayout } from "@shared/email-template-layout";

const skeleton = (html: string) => html
  .replace(/>([^<>]*)</g, "><")
  .replace(/lang="[^"]*"/g, 'lang="LANG"')
  .replace(/alt="[^"]*"/g, 'alt="ALT"')
  .replace(/title="[^"]*"/g, 'title="TITLE"');

test("analysis email, SMS and internal notification catalogs cover seven languages and eight criteria", async () => {
  const emails = await loadAutomationAnalysisEmailTemplates();
  const sourceTemplates = JSON.parse(await readFile("server/assets/automation-email/templates.json", "utf8"));
  const approvedFrame = sourceTemplates.find((item: { id: string }) => item.id === "indexus-automation-email-data-change");
  const ids = new Set<string>();
  assert.equal(emails.length, 7);
  for (const { language, templates } of emails) {
    assert.equal(templates.length, AUTOMATION_ANALYSIS_TEMPLATE_KEYS.length);
    assert.deepEqual(templates.map(template => template.id.split("-").slice(-1)[0]), Array(8).fill(language));
    const copy = automationAnalysisTemplateCopy(language);
    for (const [index, template] of templates.entries()) {
      const key = AUTOMATION_ANALYSIS_TEMPLATE_KEYS[index];
      const variant = copy.variants[key];
      assert.ok(!ids.has(template.id)); ids.add(template.id);
      assert.equal(template.name, variant.name);
      assert.equal(template.subject, variant.name);
      assert.equal(skeleton(template.contentHtml), skeleton(normalizeEmailTemplateLayout(approvedFrame.contentHtml)));
      assert.match(template.contentHtml, /border-radius:12px/);
      assert.ok(template.contentHtml.includes(variant.summary));
      assert.doesNotMatch(template.contentHtml + template.content, /{{|@example|phone|email address|contact name/i);
      assert.doesNotMatch(template.contentHtml, /<script|\/__mockup/);
    }
    const sms = automationAnalysisSmsDefaults(language);
    const notifications = automationAnalysisNotificationDefaults(language);
    assert.equal(sms.length, 8);
    assert.equal(notifications.length, 8);
    assert.ok(sms.every(template => template.type === "sms" && template.content.trim() && !template.content.includes("{{")));
    assert.ok(notifications.every(template => template.type === "notification" &&
      (template.content.includes("{{analysis.summary}}") || template.content.includes("{{analysis.invoiceCount}}")) && template.subject.trim()));
    assert.doesNotMatch(sms.map(template => template.content).join(" "), /{{|@example|\+421|phone number/i);
  }
  assert.equal(ids.size, 56);
});

test("analysis catalog seeds use separate durable markers and insert-only defaults", async () => {
  const emailSql: string[] = [];
  await ensureAutomationAnalysisEmailTemplates({ query: async sql => { emailSql.push(sql); } });
  assert.equal(emailSql.length, 7);
  for (const [index, language] of AUTOMATION_ANALYSIS_TEMPLATE_LANGUAGES.entries()) {
    const query = emailSql[index];
    assert.match(query, new RegExp(`approved-automation-analysis-email-${language}`));
    assert.match(query, /ON CONFLICT \(id\) DO NOTHING RETURNING id/);
    assert.match(query, /FROM defaults CROSS JOIN category/);
    assert.match(query, /ON CONFLICT \(id\) DO NOTHING;/);
  }

  for (const channel of ["sms", "notification"] as const) {
    const queries: string[] = [];
    await ensureAutomationAnalysisChannelTemplates({ query: async sql => { queries.push(sql); } }, channel);
    assert.equal(queries.length, 7);
    for (const [index, language] of AUTOMATION_ANALYSIS_TEMPLATE_LANGUAGES.entries()) {
      const query = queries[index];
      assert.match(query, new RegExp(`automation-analysis-${channel}-defaults-${language}`));
      assert.match(query, /ON CONFLICT \(id\) DO NOTHING RETURNING id/);
      assert.match(query, /FROM defaults CROSS JOIN seed/);
      assert.match(query, /ON CONFLICT \(id\) DO NOTHING;/);
      assert.match(query, new RegExp(`'${channel}'`));
    }
  }
});
