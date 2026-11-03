import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../pages/agent-workspace.tsx", import.meta.url), "utf8");
const templateSource = readFileSync(new URL("../pages/configurator.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("agent-workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function callsTo(name: string) {
  const found: ts.CallExpression[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === name) found.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}
test("actual personalized send callback and outer request both forward captured template ID", () => {
  const copies = callsTo("sendFromOriginalContact");
  assert.equal(copies.length, 1);
  assert.match(copies[0].arguments[0].getText(ast), /\bemailTemplateId\b/);
  const requests = callsTo("apiRequest").filter(call => call.arguments[1]?.getText(ast) === '"/api/ms365/send-email-from-mailbox"');
  assert.equal(requests.length, 1);
  assert.match(requests[0].arguments[2].getText(ast), /emailTemplateId:\s*data\.emailTemplateId/);
  assert.doesNotMatch(requests[0].arguments[2].getText(ast), /emailPurpose|templateName/);
  const start = source.indexOf("const emailTemplateId = selectedEmailTemplateIdRef.current");
  const attachmentAwait = source.indexOf("await fetch(", start);
  assert.ok(start >= 0 && attachmentAwait > start, "capture before asynchronous attachment work");
  const mutations = callsTo("sendEmailMutation.mutateAsync");
  assert.ok(mutations.some(call => /emailTemplateId:\s*data\.emailTemplateId/.test(call.arguments[0].getText(ast))));
  assert.match(source, /variables\.campaignId,\s*"mission-funnel"/);
});
test("changing Mission or contact clears selected ID, and attachment completion checks selected identity", () => {
  assert.match(source, /selectedEmailTemplateIdRef\.current = null;[\s\S]{0,1800}?\}, \[contact\?\.id\]\)/);
  assert.match(source, /useEffect\(\(\) => \{[\s\S]{0,230}?selectedEmailTemplateIdRef\.current = null;[\s\S]{0,100}?\}, \[campaign\?\.id\]\)/);
  assert.match(source, /if \(selectedEmailTemplateIdRef\.current !== templateId\) return/);
});
test("template create/edit form roundtrips purpose and exposes an email-only selector", () => {
  assert.match(templateSource, /setTemplateEmailPurpose\(template\.type === "email"/);
  assert.match(templateSource, /emailPurpose: templateType === "email" \? templateEmailPurpose : "unspecified"/);
  assert.match(templateSource, /templateType === "email" && \([\s\S]{0,800}?data-testid="select-template-email-purpose"/);
});
