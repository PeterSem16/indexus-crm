// Read original application code as data. Never import the monitoring service.
const fs = require("node:fs");
const crypto = require("node:crypto");
const vm = require("node:vm");
const ts = require("typescript");
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
function analyzeSource(file) {
  const text = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === "analyzeEmailContent");
  if (functions.length !== 1) throw Error("B1_ANALYZER_SOURCE_INVALID");
  const node = functions[0];
  let request;
  function visit(n) {
    if (ts.isCallExpression(n) && n.expression.getText(ast) === "client.chat.completions.create") {
      if (request) throw Error("B1_ANALYZER_SOURCE_INVALID");
      request = n.arguments[0].getText(ast);
    }
    ts.forEachChild(n, visit);
  }
  visit(node);
  if (!request) throw Error("B1_ANALYZER_SOURCE_INVALID");
  return {
    requestSha256: hash(request), sourceSha256: hash(node.getText(ast)),
    javascript: ts.transpileModule(node.getText(ast) + "\nglobalThis.analyzer = analyzeEmailContent;", {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText,
  };
}
function bindAnalyzer(source, aiClient, parseEmailMonitoringAnalysis) {
  const context = vm.createContext({ aiClient, parseEmailMonitoringAnalysis }, {
    codeGeneration: { strings: false, wasm: false },
  });
  new vm.Script(source.javascript).runInContext(context, { timeout: 250 });
  return context.analyzer;
}
module.exports = { analyzeSource, bindAnalyzer };
