// Explicit original-source boundaries. No replacement parsers and no CRM IO.
const ts = require("typescript");
const BOUNDARIES = {
  "email.translation_check": { variable: "parsed", capture: "parsed" },
  "call_recording.analysis": { variable: "analysis", capture: "analysis" },
  "contracts.mapping": { variable: "result", capture: "result" },
  "gender.detection": { capture: "gender", declarations: "let gender;" },
  "lead_search.suggestion": { variable: "suggestions", capture: "suggestions" },
  "lead_intelligence.goal": { variable: "parsed", capture: "parsed" },
  "lead_search.queries": { afterTry: "first", capture: "searchQueries" },
  "voicemail.analysis": { variable: "analysis", capture: "analysis",
    detachedFromPersistenceGuard: true, prefixVariables: ["analysisText"] },
  "web_form.social": { capture: "aiAnalysis", declarations: "let aiAnalysis;" },
  "web_form.validation": { afterTry: true, capture: "suggestions" },
  "geography.bulk": { variable: "results", capture: "results" },
  "template.pdf_extraction": { variable: "result", capture: "result" },
  "cbu_report.analysis": { variable: "analysis", capture: "analysis" },
  "training.translation": { variable: "translatedText", capture: "translatedText",
    fallbackCapture: true, declarations: "let translatedText;" },
  "virtual_agent.summary": { capture: "({summary,sentiment,urgency,keyTopics,callbackRequested,callbackNumber})",
    declarations: "let summary,sentiment,urgency,keyTopics,callbackRequested,callbackNumber;" },
  "scraper.contacts": { full: true, dependencies: ["ContactSchema", "ResponseSchema"] },
  "automation.draft": { full: true, dependencyFile: "server/lib/automation-event-draft.ts",
    dependencies: ["EVENT_DRAFT_INTENTS", "eventDraftOutput", "validateEventDraftOutput"] },
};
function boundaryCode(id, code, variant) {
  const recipe = id === "lead_search.queries" && variant?.id.endsWith(":2")
    ? { variable: "retryQueries", capture: "retryQueries" } : BOUNDARIES[id];
  if (!recipe) return null;
  if (recipe.full) return { code, recipe, scope: "ORIGINAL_PURE_TAIL" };
  // A single surrounding original iteration permits an original `continue`
  // before the captured parser boundary; no batch updates are executed.
  const sf = ts.createSourceFile("boundary.ts",
    `async function __c11() { for (const __iteration of [0]) { ${code} } }`,
    ts.ScriptTarget.Latest, true);
  let target;
  function find(node) {
    if (!target && recipe.variable && ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) && node.name.text === recipe.variable)
      target = node.parent.parent;
    ts.forEachChild(node, find);
  }
  find(sf);
  const body = sf.statements[0].body.statements[0].statement;
  if (recipe.afterTry) target = (recipe.afterTry === "first" ? [...body.statements] :
    [...body.statements].reverse()).find(ts.isTryStatement);
  if (recipe.variable && !target && !recipe.fallbackCapture) throw Error("C11_BOUNDARY_SOURCE_CHANGED");
  const returnText = `return {__c11_capture:true,value:(${recipe.capture})};`;
  if (recipe.detachedFromPersistenceGuard) {
    const prefix = body.statements.filter(s => ts.isVariableStatement(s) &&
      s.declarationList.declarations.some(d => recipe.prefixVariables.includes(d.name.getText(sf))));
    if (prefix.length !== recipe.prefixVariables.length) throw Error("C11_BOUNDARY_SOURCE_CHANGED");
    return { code: [...prefix, target].map(s => s.getText(sf)).join("\n") + "\n" + returnText,
      recipe, scope: "ORIGINAL_PARSE_ONLY_PERSISTENCE_GUARD_OMITTED" };
  }
  if (!target) return { code: `${recipe.declarations || ""}\n${code}\n${returnText}`, recipe,
    scope: "ORIGINAL_ASSIGNMENTS_ONLY" };
  const returnStatement = ts.createSourceFile("return.ts", returnText, ts.ScriptTarget.Latest, true).statements[0];
  const transformed = ts.transform(sf, [context => {
    function visit(node) {
      if (ts.isBlock(node)) {
        const index = node.statements.findIndex(s => s.pos <= target.pos && s.end >= target.end);
        if (index >= 0) return ts.factory.updateBlock(node, [
          ...node.statements.slice(0, index),
          ts.visitNode(node.statements[index], node.statements[index] === target ? n => n : visit),
          ...(node.statements[index] === target ? [returnStatement] : []),
        ]);
      }
      return ts.visitEachChild(node, visit, context);
    }
    return node => ts.visitNode(node, visit);
  }]);
  const printer = ts.createPrinter();
  const printed = printer.printFile(transformed.transformed[0]);
  transformed.dispose();
  if (!printed.includes("__c11_capture")) throw Error("C11_BOUNDARY_EXTRACTION_FAILED");
  return { code: printed + "\nreturn await __c11();", recipe, scope: "ORIGINAL_PREFIX_BEFORE_SIDE_EFFECTS" };
}
module.exports = { BOUNDARIES, boundaryCode };
