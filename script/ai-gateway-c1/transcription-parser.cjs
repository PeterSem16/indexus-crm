// Replay original STT extraction/guards only. Never run CRM writes, calls, analysis or translations.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { IDS } = require("./transcription-mapping.cjs");
const ROOT = path.resolve(__dirname, "../..");
function recipe(id, variant) {
  if (!IDS.includes(id)) throw Error("C1_TRANSCRIPTION_SERVICE_NOT_ALLOWED");
  const file = path.resolve(ROOT, variant.source.file);
  if (!file.startsWith(ROOT + path.sep)) throw Error("C1_PARSER_SOURCE_INVALID");
  const ast = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  let call;
  function find(node) {
    if (ts.isCallExpression(node) && node.arguments[0]?.getText(ast) === variant.originalExpression &&
        ast.getLineAndCharacterOfPosition(node.getStart(ast)).line === variant.source.line - 1) call = node;
    ts.forEachChild(node, find);
  }
  find(ast);
  let declaration = call;
  while (declaration && !ts.isVariableDeclaration(declaration)) declaration = declaration.parent;
  if (!declaration || !ts.isIdentifier(declaration.name)) throw Error("C1_PARSER_SOURCE_CHANGED");
  const responseName = declaration.name.text, statement = declaration.parent.parent;
  if (!ts.isBlock(statement.parent)) throw Error("C1_PARSER_SOURCE_CHANGED");
  const tail = statement.parent.statements.slice(statement.parent.statements.indexOf(statement) + 1);
  const refers = node => {
    let found = false;
    function visit(n) { if (ts.isIdentifier(n) && n.text === responseName) found = true; ts.forEachChild(n, visit); }
    visit(node); return found;
  };
  let expression;
  for (const s of tail) {
    if (ts.isReturnStatement(s) && s.expression && refers(s.expression)) { expression = s.expression.getText(ast); break; }
    if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations)
      if (d.initializer && refers(d.initializer)) { expression = d.initializer.getText(ast); break; }
    if (ts.isExpressionStatement(s) && ts.isBinaryExpression(s.expression) &&
        s.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken && refers(s.expression.right))
      expression = s.expression.right.getText(ast);
    if (expression) break;
  }
  if (!expression) throw Error("C1_PARSER_EXTRACTION_NOT_FOUND");
  const parts = { responseName, expression, guard: null, final: null, hallucinations: null, lower: null };
  if (id === "virtual_agent.transcription" || id === "training.transcription") {
    const variable = id === "training.transcription" ? "originalText" : "text";
    const guard = tail.find(s => ts.isIfStatement(s) && s.expression.getText(ast).startsWith("!" + variable));
    if (!guard) throw Error("C1_PARSER_GUARD_CHANGED");
    parts.guard = guard.expression.getText(ast);
    if (id === "virtual_agent.transcription") {
      const ret = tail.find(s => ts.isReturnStatement(s) && s.expression?.getText(ast) === "text.trim()");
      if (!ret) throw Error("C1_PARSER_GUARD_CHANGED");
      parts.final = ret.expression.getText(ast);
    } else {
      const declarations = tail.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations]);
      parts.hallucinations = declarations.find(d => d.name.getText(ast) === "WHISPER_HALLUCINATIONS")?.initializer?.getText(ast);
      parts.lower = declarations.find(d => d.name.getText(ast) === "lowerText")?.initializer?.getText(ast);
      if (!parts.hallucinations || !parts.lower) throw Error("C1_PARSER_GUARD_CHANGED");
      const filter = tail.find(s => ts.isIfStatement(s) &&
        s.expression.getText(ast) === "WHISPER_HALLUCINATIONS.includes(lowerText)");
      if (!filter) throw Error("C1_PARSER_GUARD_CHANGED");
      parts.filter = filter.expression.getText(ast);
    }
    parts.variable = variable;
  }
  return parts;
}
function replayTranscription(id, nativeOutput, variant) {
  try {
    const r = recipe(id, variant);
    const context = vm.createContext({ [r.responseName]: nativeOutput },
      { codeGeneration: { strings: false, wasm: false } });
    function evaluate(expression) {
      const js = ts.transpileModule("globalThis.__value = (" + expression + ");",
        { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      vm.runInContext(js, context, { timeout: 150 }); return context.__value;
    }
    let value = evaluate(r.expression);
    if (r.variable) context[r.variable] = value;
    let rejected = r.guard ? !!evaluate(r.guard) : false;
    if (!rejected && r.hallucinations) {
      context.WHISPER_HALLUCINATIONS = evaluate(r.hallucinations);
      context.lowerText = evaluate(r.lower);
      rejected = !!evaluate(r.filter);
    }
    if (!rejected && r.final) value = evaluate(r.final);
    return { state: rejected ? "REJECTED" : "ACCEPTED",
      boundary: "ORIGINAL_TRANSCRIPTION_EXTRACTION_AND_GUARDS",
      value: value ?? null, sourceRecipe: r,
      validationError: rejected ? "C1_ORIGINAL_TRANSCRIPTION_GUARD_REJECTED" : null };
  } catch {
    return { state: "REPLAY_ERROR", value: null,
      validationError: "C1_TRANSCRIPTION_PARSER_SOURCE_OR_REPLAY_FAILED" };
  }
}
module.exports = { replayTranscription, recipe };
