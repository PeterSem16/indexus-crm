import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_TEMPLATE_LANGUAGES } from "../../shared/automation-activity-template-copy";
import { loadStatusListServiceTemplates, ensureStatusListServiceTemplates } from "./status-list-service-templates";
import { templateEligibility } from "../../client/src/components/automation-template-eligibility";
import { activityTemplateUsedVariables } from "../../client/src/components/automation-activity-template-utils";

test("all four native actions have usable Status List defaults in all seven languages", () => {
  const templates = loadStatusListServiceTemplates();
  assert.equal(templates.length, 140);
  assert.equal(new Set(templates.map(template => template.id)).size, templates.length);
  const available = ["contact.name", "campaign.name"].map(value => ({ value, label: value }));
  for (const language of ACTIVITY_TEMPLATE_LANGUAGES) {
    for (const type of ["email", "sms", "notification", "task"]) {
      const matches = templates.filter(template => template.language === language && template.type === type);
      assert.equal(matches.length, 5);
      for (const template of matches) {
        assert.equal(templateEligibility(template, available, "status_list").usable, true, template.id);
        assert.equal(templateEligibility(template, available, "task").usable, false, template.id);
        assert.equal(templateEligibility({ ...template, isActive: false }, available, "status_list").usable, false);
        assert.deepEqual(activityTemplateUsedVariables(template).sort(), ["campaign.name", "contact.name"]);
        assert.match(template.subject, /{{contact\.name}}/);
        if (type === "email") assert.match(template.contentHtml!, /<html/);
        else assert.equal(template.contentHtml, null);
      }
    }
  }
  const ordinaryTask = { id: "indexus-activity-email-task-task-completed-en", name: "Completed", content: "{{activity.title}}" };
  assert.equal(templateEligibility(ordinaryTask, available, "status_list").usable, false);
});

test("native catalog seeding never overwrites edits, reactivates defaults or restores deletions", async () => {
  const sql: string[] = [];
  await ensureStatusListServiceTemplates({ query: async query => { sql.push(query); } });
  assert.equal(sql.length, 7);
  for (const query of sql) {
    assert.match(query, /INSERT INTO automation_template_seeds/);
    assert.match(query, /ON CONFLICT\(id\) DO NOTHING RETURNING id/);
    assert.match(query, /FROM defaults CROSS JOIN seed ON CONFLICT\(id\) DO NOTHING/);
    assert.doesNotMatch(query, /DO UPDATE|DELETE|UPDATE .*templates|workflow_rules/);
  }
});
