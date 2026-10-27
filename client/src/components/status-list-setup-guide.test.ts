import assert from "node:assert/strict";
import { test } from "node:test";
import { getStatusListHelpCopy, statusListHelpSectionIds } from "./status-list-help-copy";
import { getStatusListSetupGuide, setupGuideSectionIds } from "./status-list-setup-guide-copy";
import { translations } from "../i18n/translations";

test("all seven INDEXUS languages expose the four deep-dive chapters in the actual manual", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    const manual = getStatusListHelpCopy(locale), guide = getStatusListSetupGuide(locale);
    assert.equal(statusListHelpSectionIds.length, 15);
    for (const section of setupGuideSectionIds) {
      assert.equal(manual.sections[section].title, guide[section].title);
      assert.ok(guide[section].paragraphs.length >= 7);
      assert.ok(guide[section].paragraphs.every(paragraph => paragraph.trim().length > 60));
      assert.deepEqual(translations[locale].statusListSetupGuide[section], guide[section]);
    }
    assert.ok(guide.answerBranches.paragraphs.join(" ").includes("09:00"));
    assert.ok(guide.answerSources.paragraphs.join(" ").includes("48"));
    assert.ok(guide.answerBehavior.paragraphs.join(" ").includes("Batch"));
    const relationships = manual.sections.relationships;
    assert.equal(relationships.paragraphs.length, 12);
    assert.deepEqual(relationships, translations[locale].statusListRelationshipsHelp);
    assert.ok(relationships.paragraphs.join(" ").includes("ONE"));
    assert.ok(Object.values(translations[locale].statusListSourceValidation).every(value => value.length > 5));
  }
});
test("manual explicitly separates navigation, confirmation, real clinic writes and system ownership", () => {
  const guide = getStatusListSetupGuide("en");
  assert.match(guide.answerBranches.paragraphs[0], /does not answer for the agent/i);
  assert.match(guide.answerBehavior.paragraphs.join(" "), /parent may have its own actions/i);
  assert.match(guide.clinicOutcome.paragraphs.join(" "), /contract status Sent/i);
  assert.match(guide.clinicOutcome.paragraphs.join(" "), /not automatic rollback/i);
  assert.match(guide.answerSources.paragraphs.join(" "), /system-managed rather than agent-confirmed/i);
  assert.match(guide.answerSources.paragraphs.join(" "), /not an executed action/i);
  assert.match(guide.answerSources.paragraphs.join(" "), /backfill needs a separate preview and confirmation/i);
});
