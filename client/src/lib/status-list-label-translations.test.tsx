import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { statusListLabelLanguages, statusListOptionLabel, statusListLabelTranslationsSchema } from "../../../shared/status-list-label-translations";
import { StatusListQuickOptionsPanel } from "../components/status-list-agent-preview";
import { translations } from "../i18n/translations";

const names = { en: "Reschedule call", sk: "Preplánovať hovor", cs: "Přeplánovat hovor", hu: "Hívás átütemezése", ro: "Reprogramează apelul", it: "Riprogramma chiamata", de: "Anruf verschieben" };
test("the real shared Pulse buttons render the operator's language in all seven locales", () => {
  for (const locale of statusListLabelLanguages) {
    const html = renderToStaticMarkup(createElement(StatusListQuickOptionsPanel, {
      options: [{ id: "quick", label: "original", labelTranslations: names }],
      locale, label: "Quick", onSelect: () => {},
    }));
    assert.ok(html.includes(names[locale]));
    assert.ok(!html.includes(">original</button>"));
    const copy = translations[locale].statusListButtonTranslations;
    for (const value of Object.values(copy)) assert.ok(typeof value === "string" && value.length > 0);
  }
});
test("legacy, missing, empty or invalid translations use the saved original label", () => {
  for (const labelTranslations of [null, undefined, {}, { sk: "" }, { sk: {} }]) {
    assert.equal(statusListOptionLabel({ label: "Original", labelTranslations }, "sk"), "Original");
  }
  assert.equal(statusListOptionLabel({ label: "Original", labelTranslations: names }, "fr"), "Original");
});
test("saving only supported short text labels is allowed", () => {
  assert.ok(statusListLabelTranslationsSchema.safeParse(names).success);
  assert.ok(statusListLabelTranslationsSchema.safeParse({}).success);
  for (const input of [{ fr: "Unsupported" }, { en: 5 }, { en: "x".repeat(241) }]) {
    assert.equal(statusListLabelTranslationsSchema.safeParse(input).success, false);
  }
});
