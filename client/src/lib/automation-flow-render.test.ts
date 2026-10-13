import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFlowchartCopy } from "../i18n/automation-flowchart-copy";
import { isHtmlMessage, sanitizeFlowMessageHtml } from "./automation-flow-message-preview";
import type { AutomationFlowModel } from "./automation-flow-model";

// Render the production component, omitting only CSS loading in Node.
const bundled = buildSync({
  entryPoints: ["client/src/components/automation-rule-flowchart.tsx"],
  bundle: true, write: false, platform: "node", format: "cjs",
  packages: "external", jsx: "automatic", loader: { ".css": "empty" },
});
const module = { exports: {} as { AutomationRuleFlowchart: ComponentType<any> } };
new Function("require", "module", "exports", bundled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const model: AutomationFlowModel = {
  title: "Routing test", enabled: false, scope: [],
  trigger: { title: "Incoming communication", details: [
    { label: "Listen after", value: "2025-12-31T12:00:00.000Z" },
  ] },
  conditions: { kind: "all", children: [
    { kind: "leaf", field: "Sentiment", operator: "Equal", value: "Negative" },
    { kind: "any", children: [
      { kind: "leaf", field: "Invoice", operator: "Equal", value: "Yes" },
      { kind: "not", children: [{ kind: "leaf", field: "Failed attachments", operator: "Greater than", value: "0" }] },
    ] },
  ] },
  actions: [
    { title: "First action", details: [{ label: "Message", value: "<div style=\"font-weight:700\">A long authored message</div><script>must not execute</script>" }] },
    { title: "Second action", details: [] },
  ],
};
const original = structuredClone(model);
const render = (value: AutomationFlowModel, locale = "en", compact = false) =>
  renderToStaticMarkup(createElement(module.exports.AutomationRuleFlowchart, { model: value, locale, compact }));
for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
  const html = render(model, locale);
  const copy = getFlowchartCopy(locale);
  assert.ok(copy.stop && copy.reference && copy.decisionSummary);
  assert.equal((html.match(/data-flow-decision="root"/g) || []).length, 1, "One decision evaluates the entire tree");
  assert.equal((html.match(/class="indexus-flowchart__logic-badge /g) || []).length, 3);
  assert.equal((html.match(/data-flow-branch=/g) || []).length, 2);
  assert.ok(html.includes('data-flow-connection="action-1-to-2"'));
  assert.ok(html.indexOf("First action") < html.indexOf("Second action"));
  const no = html.split('data-flow-branch="no"')[1]?.split("</section>")[0];
  assert.ok(no?.includes(copy.stop));
  assert.ok(!no?.includes("indexus-flowchart__action"));
  assert.ok(!html.includes("A long authored message"), "Message bodies stay out of the compact node");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes(copy.openMessage), "Message preview control is localized");
  assert.ok(!html.includes("2025-12-31T12:00"), "Configured timestamps are localized, not shown as raw ISO");
  if (locale === "en") assert.ok(html.includes("1:00"), "Timestamp is formatted in Bratislava time");
  const ignored = render({ ...model, conditionsIgnored: true }, locale);
  assert.ok(ignored.includes('data-flow-reference="ignored-conditions"'));
  assert.ok(ignored.includes('data-flow-connection="trigger-actions"'));
  assert.ok(!ignored.includes("data-flow-decision="));
  assert.ok(!ignored.includes("data-flow-branch="));
  const unconditional = render({ ...model, conditions: null }, locale, true);
  assert.ok(unconditional.includes("indexus-flowchart--compact"));
  assert.ok(!unconditional.includes("data-flow-decision="));
  assert.ok(!unconditional.includes("data-flow-branch="));
  assert.ok(unconditional.includes('data-flow-node="actions"'));
  const unary = render({ ...model, conditions: { kind: "leaf", field: "Email", operator: "is empty" } }, locale);
  assert.ok(!unary.includes('class="indexus-flowchart__leaf-value"'), "No fake missing-value label for arity-zero operators");
  for (const kind of ["all", "any", "not"] as const) {
    assert.ok(render({ ...model, conditions: { kind, children: [] } }, locale).includes(
      kind === "all" ? copy.emptyAll : kind === "any" ? copy.emptyAny : copy.emptyNot));
  }
}
assert.deepEqual(model, original, "Rendering never mutates the rule projection");
assert.ok(isHtmlMessage("<table><tr><td>Template</td></tr></table>"));
assert.ok(!isHtmlMessage("Plain SMS text with {{contactName}}"));
assert.ok(sanitizeFlowMessageHtml("<script>unsafe()</script>").includes("&lt;script&gt;"), "SSR fallback escapes HTML rather than rendering it");
console.log("Production flow rendering passed: nested logic, single gate, NO terminal, sequential actions, schedule bypass, empty groups, localized timestamps, compact message previews, safe SSR escaping, immutability and seven locales.");
