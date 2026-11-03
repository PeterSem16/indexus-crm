import { test } from "node:test";
import assert from "node:assert/strict";
import { missionFunnelHelpTranslations } from "./mission-funnel-help-translations";

test("package-sent and materials explanations stay distinct and localized across all funnel manuals", () => {
  const locales = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;
  const noCooperationPrerequisite = {
    en: "no cooperation prerequisite",
    sk: "nevyžaduje spoluprácu",
    cs: "nevyžaduje spolupráci",
    hu: "nem feltétele az együttműködés",
    ro: "nu necesită colaborare",
    it: "non richiede collaborazione",
    de: "Kooperation ist keine Voraussetzung",
  };
  const denominatorUnchanged = {
    en: "previous-percent denominator is unchanged",
    sk: "menovateľ percenta voči predchádzajúcemu zostáva nezmenený",
    cs: "jmenovatel předchozího procenta zůstává beze změny",
    hu: "korábbi százalék nevezője változatlan",
    ro: "numitorul existent al procentului anterior rămâne neschimbat",
    it: "denominatore esistente della percentuale precedente resta invariato",
    de: "bisherige Nenner des Vorher-Prozentsatzes bleibt unverändert",
  };

  for (const locale of locales) {
    const help = missionFunnelHelpTranslations[locale];
    assert.ok(help.stages.packageSent.toLocaleLowerCase().includes(noCooperationPrerequisite[locale].toLocaleLowerCase()), `${locale}.packageSent`);
    assert.ok(help.stages.materials.toLocaleLowerCase().includes(denominatorUnchanged[locale].toLocaleLowerCase()), `${locale}.materials denominator`);
    assert.ok(help.content.combined.some(text => text.toLocaleLowerCase().includes(noCooperationPrerequisite[locale].toLocaleLowerCase())), `${locale}.combined package definition`);
    assert.ok(help.content.combined.some(text => text.toLocaleLowerCase().includes(denominatorUnchanged[locale].toLocaleLowerCase())), `${locale}.combined materials definition`);
  }
});
