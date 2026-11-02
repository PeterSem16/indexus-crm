import { test } from "node:test";
import assert from "node:assert/strict";
import { configurableFunnelSources, funnelSources, funnelSteps, funnelExceptions } from "../../../../shared/mission-funnel";
import {
  missionFunnelHelpChapterIds,
  missionFunnelHelpTranslations,
  missionFunnelQualityKeys,
} from "./mission-funnel-help-translations";

test("the complete manual covers every chapter, stage, source, exception and quality metric in seven languages", () => {
  assert.equal(missionFunnelHelpChapterIds.length, 9);
  assert.equal(configurableFunnelSources.length, 19);
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    const guide = missionFunnelHelpTranslations[locale];
    for (const key of ["title", "intro", "close", "button", "contents", "next", "previous"] as const) {
      assert.ok(guide[key]?.trim(), `${locale}.${key}`);
    }
    assert.deepEqual(Object.keys(guide.chapters).sort(), [...missionFunnelHelpChapterIds].sort(), locale);
    for (const chapter of missionFunnelHelpChapterIds) {
      assert.ok(guide.chapters[chapter].trim(), `${locale}.${chapter}`);
      assert.ok(guide.content[chapter].length >= 2, `${locale}.${chapter}: meaningful explanation`);
      assert.ok(guide.content[chapter].every(value => value.trim().length > 20), `${locale}.${chapter}`);
    }
    for (const [label, keys, values] of [
      ["stages", funnelSteps, guide.stages],
      ["sources", funnelSources, guide.sources],
      ["exceptions", funnelExceptions, guide.exceptions],
      ["quality", missionFunnelQualityKeys, guide.quality],
      ["basis", ["call", "history", "state", "derived", "current"], guide.basis],
    ] as const) {
      for (const key of keys) {
        const text = (values as Record<string, string>)[key];
        assert.ok(text?.trim().length > 20, `${locale}.${label}.${key}`);
        if (locale !== "en") assert.notEqual(text, (missionFunnelHelpTranslations.en[label] as Record<string, string>)[key], `${locale}.${label}.${key} must be translated`);
      }
    }
    assert.ok(new Set(Object.values(guide.quality)).size === 8, `${locale}: each quality metric explained individually`);
    assert.ok(new Set(Object.values(guide.basis)).size === 5, `${locale}: each evidence basis explained individually`);
    assert.ok(new Set(Object.values(guide.stages)).size >= 14, `${locale}: step-specific definitions`);
  }
});

test("manual preserves key analytical caveats instead of promising operational effects", () => {
  const guide = missionFunnelHelpTranslations.en;
  assert.match(guide.content.scope.join(" "), /Europe\/Bratislava/);
  assert.match(guide.content.scope.join(" "), /not a snapshot|not.*period end/i);
  assert.match(guide.content.combined.join(" "), /same enrollment/);
  assert.match(guide.content.combined.join(" "), /poster.*optional|optional.*poster/i);
  assert.match(guide.content.configuration.join(" "), /\bOR\b/);
  assert.match(guide.content.configuration.join(" "), /\bAND\b/);
  assert.match(guide.content.evidence.join(" "), /not.*create|never.*create|does not.*create/i);
  assert.match(guide.content["interpret-export"].join(" "), /hypothetical/);
  assert.match(guide.content["interpret-export"].join(" "), /100/);
});
