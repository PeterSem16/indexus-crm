import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readStatusListMode, StatusListAgentPreview } from "./status-list-agent-preview";
import { translations } from "@/i18n/translations";

const items = [
  {
    id: "step-1", stepId: "STEP-01", label: "Partner contacted", description: "First contact",
    tab: "acquisition", required: true, confirmationType: "checkbox",
    automations: [{ id: "automation-1", actionType: "send_email_group" }],
    questions: [
      { id: "q-yes-no", questionText: "Reached the decision maker?", fieldType: "yesno", groupName: "Contact" },
      { id: "q-choice", questionText: "Call back later", fieldType: "checkbox", automations: [{ actionType: "set_callback" }] },
    ],
  },
  { id: "opt-1", stepId: "OPT-01", itemType: "option", label: "Do not call", color: "#775b74", icon: "Phone", tab: null, confirmationType: "option", questions: [] },
];

describe("Status List agent preview", () => {
  it("uses the saved Mission status list mode and safely defaults invalid settings", () => {
    assert.equal(readStatusListMode(JSON.stringify({ statusListMode: "batch" })), "batch");
    assert.equal(readStatusListMode(JSON.stringify({ statusListMode: "immediate" })), "immediate");
    assert.equal(readStatusListMode("{bad json"), "immediate");
    assert.equal(readStatusListMode(null), "immediate");
  });

  it("renders the shared agent phase, step and question UI with local-only actions", () => {
    const html = renderToStaticMarkup(createElement(StatusListAgentPreview, { items, locale: "en", statusListMode: "batch" }));
    assert.ok(html.includes('data-testid="sl-phase-acquisition"'));
    assert.ok(html.includes('data-testid="status-list-options-panel"'));
    assert.ok(html.includes('id="sl-step-STEP-01"'));
    assert.ok(html.includes('data-testid="sl-questions-step-1"'));
    assert.ok(html.includes('data-testid="btn-sl-q-yes-q-yes-no"'));
    assert.ok(html.includes('data-testid="preview-safe-question-action-q-choice"'));
    assert.ok(html.includes('data-testid="preview-safe-action-automation-1"'));
    assert.ok(html.includes('data-testid="sl-batch-mode-banner"'));
    assert.ok(html.includes('data-testid="btn-sl-batch-save"'));
    assert.ok(html.includes("answers are not saved"));
    assert.ok(html.includes("h-7 px-2 text-[11px] gap-1"));
  });

  it("localizes visible phase, answer, batch and safety copy in all supported locales", () => {
    const locales = ["sk", "en", "cs", "hu", "ro", "it", "de"];
    for (const locale of locales) {
      const html = renderToStaticMarkup(createElement(StatusListAgentPreview, { items, locale, statusListMode: "batch" }));
      assert.ok(html.includes('data-testid="sl-phase-acquisition"'));
      assert.ok(html.includes('data-testid="sl-batch-mode-banner"'));
      assert.ok(html.includes('data-testid="btn-sl-batch-save"'));
      assert.ok(html.includes('data-testid="status-list-preview-safety"'));
    }
    const immediate = renderToStaticMarkup(createElement(StatusListAgentPreview, { items, locale: "de", statusListMode: "immediate" }));
    assert.ok(!immediate.includes('data-testid="sl-batch-mode-banner"'));
    assert.ok(!immediate.includes('data-testid="btn-sl-batch-save"'));
  });

  it("uses registered Nexus Pulse labels and note copy for all seven locales", () => {
    const locales = ["sk", "en", "cs", "hu", "ro", "it", "de"] as const;
    for (const locale of locales) {
      const copy = translations[locale].statusListAgentPreview;
      assert.ok(copy.runEmail);
      assert.ok(copy.save);
      assert.ok(copy.phaseAcquisition);
      assert.ok(copy.note);
      assert.ok(!copy.note.includes("note"));
    }
    assert.equal(translations.sk.statusListAgentPreview.runEmail, "Poslať e-mail");
    assert.equal(translations.sk.statusListAgentPreview.save, "Uložiť status list");
    assert.equal(translations.sk.statusListAgentPreview.note, "Poznámka k tomuto kroku...");
    assert.ok(translations.en.statusListAgentPreview.batchMessage.includes("preview only"));
  });
});
