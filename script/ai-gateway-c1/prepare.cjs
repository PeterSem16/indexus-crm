// Offline preparation only. Evaluates pinned, local TypeScript expressions, never CRM modules.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const ts = require("typescript");
const { bindingsFor } = require("./synthetic.cjs");
const hash = value => crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest("hex");
const ROOT = path.resolve(__dirname, "../..");

function verifySources(catalog, root = ROOT) {
  const hashes = { ...catalog.metadata.sourceHashes, ...catalog.metadata.supportHashes };
  if (catalog.services.length !== 65 || new Set(catalog.services.map(s => s.id)).size !== 65)
    throw Error("C1_CATALOG_MISMATCH");
  for (const [file, expected] of Object.entries(hashes)) {
    if (path.resolve(root, file).startsWith(root + path.sep) === false ||
        hash(fs.readFileSync(path.join(root, file))) !== expected)
      throw Error("C1_SOURCE_HASH_MISMATCH:" + file);
  }
  return hashes;
}

function evaluate(code, context) {
  const js = ts.transpileModule(`globalThis.__result = (${code});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  vm.runInContext(js, context, { timeout: 200 });
  return context.__result;
}

function materialize(service, request, root = ROOT) {
  if (!request.arguments?.[0]) return { error: "C1_PROBE_REQUIRES_DEDICATED_MAPPING" };
  const source = fs.readFileSync(path.join(root, request.file), "utf8");
  const ast = ts.createSourceFile(request.file, source, ts.ScriptTarget.Latest, true);
  const offset = ast.getPositionOfLineAndCharacter(request.line - 1, 0);
  let call;
  function locate(node) {
    if (ts.isCallExpression(node) && node.getStart(ast) >= offset &&
        ast.getLineAndCharacterOfPosition(node.getStart(ast)).line === request.line - 1 &&
        node.arguments[0]?.getText(ast) === request.arguments[0]) call = node;
    ts.forEachChild(node, locate);
  }
  locate(ast);
  // Resolve only lexical declarations preceding the actual call; no module imports.
  const declarations = new Map();
  function collect(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
        node.getStart(ast) < (call?.getStart(ast) ?? offset)) {
      // A declaration is visible only if its containing block is an ancestor of this call.
      let scope = node.parent;
      while (scope && !ts.isBlock(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
      let ancestor = call;
      while (ancestor && ancestor !== scope) ancestor = ancestor.parent;
      if (ancestor) declarations.set(node.name.text, node.initializer.getText(ast));
    }
    if (ts.isFunctionDeclaration(node) && node.name && node.body)
      declarations.set(node.name.text, node.getText(ast).replace(/^export\s+/, ""));
    ts.forEachChild(node, collect);
  }
  collect(ast);
  // These services deliberately pass messages through a completion callback.
  const builder = { "task.checklist": "generateTaskChecklistWithCompletion",
    "task.resolution": "generateTaskResolutionDraftWithCompletion" }[service.id];
  if (builder) {
    const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === builder);
    function locals(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
        declarations.set(node.name.text, node.initializer.getText(ast));
      ts.forEachChild(node, locals);
    }
    if (fn) locals(fn);
  }
  if (service.id === "automation.draft") {
    const f = "server/lib/automation-event-draft.ts";
    const a = ts.createSourceFile(f, fs.readFileSync(path.join(root, f), "utf8"), ts.ScriptTarget.Latest, true);
    for (const stmt of a.statements) if (ts.isVariableStatement(stmt))
      for (const d of stmt.declarationList.declarations) if (d.initializer && ts.isIdentifier(d.name))
        declarations.set(d.name.text, d.initializer.getText(a));
  }
  for (const d of request.definitions || []) {
    const sf = ts.createSourceFile("definition.ts", "const " + d.code, ts.ScriptTarget.Latest, true);
    const decl = sf.statements[0]?.declarationList?.declarations[0];
    if (decl?.initializer && ts.isIdentifier(decl.name)) declarations.set(decl.name.text, decl.initializer.getText(sf));
  }
  const seed = bindingsFor(service.id);
  const context = vm.createContext({
    ...seed,
    // Deterministic date interpolation, not a change to any source prompt.
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : ["2026-11-15T12:00:00Z"])); }
      static now() { return Date.parse("2026-11-15T12:00:00Z"); }
    },
  }, { codeGeneration: { strings: false, wasm: false } });
  const resolving = new Set();
  function attempt(code) {
    for (let i = 0; i < 100; i++) {
      try { return evaluate(code, context); } catch (error) {
        const name = /^([A-Za-z_$][\w$]*) is not defined$/.exec(error.message)?.[1];
        if (!name || !declarations.has(name) || resolving.has(name)) throw error;
        // Never resolve IO, ambient process state or imported application singletons.
        if (["process", "require", "fetch", "db", "storage", "fs", "fsSync"].includes(name)) throw Error("C1_IO_FORBIDDEN");
        resolving.add(name);
        try {
        const expression = declarations.get(name);
          context[name] = attempt(expression.startsWith("function ") || expression.startsWith("async function ")
            ? `(${expression})` : expression);
        } finally { resolving.delete(name); }
      }
    }
    throw Error("C1_RESOLUTION_LIMIT");
  }
  try {
    const value = JSON.parse(JSON.stringify(attempt(request.arguments[0])));
    if (service.id === "virtual_agent.response") {
      // Replay the exact history-assembly statements, not just the array initializer.
      const start = source.indexOf("for (const turn of session.turns)", offset - 3000);
      const end = source.indexOf("const gptModel", start);
      if (start < 0 || end < 0 || end > offset) throw Error("C1_HISTORY_BUILDER_CHANGED");
      context.messages = value.messages;
      const js = ts.transpileModule(source.slice(start, end), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
      }).outputText;
      vm.runInContext(js, context, { timeout: 200 });
      value.messages = JSON.parse(JSON.stringify(context.messages));
    }
    if (JSON.stringify(value).includes("[object Object]") || JSON.stringify(value).includes("undefined"))
      throw Error("C1_INCOMPLETE_SYNTHETIC_BINDING");
    return { request: value, bindings: seed };
  } catch (error) {
    return { error: "C1_FIXTURE_BUILD_FAILED", detail: String(error.message).slice(0, 180), bindings: seed };
  }
}

function prepare(catalog, root = ROOT) {
  const sourceHashes = verifySources(catalog, root);
  const services = catalog.services.map(service => ({
    id: service.id, name: service.name, operation: service.operation,
    parserEvidence: service.evidenceReferences,
    documentationSchema: service.jsonSchema,
    documentationSchemaIsRuntimeValidator: false,
    variants: service.requests.map((request, index) => ({
      id: `${service.id}:${index + 1}`, source: { file: request.file, line: request.line },
      originalExpression: request.arguments?.[0] ?? null,
      originalExpressionHash: hash(request.arguments?.[0] ?? ""),
      ...(["chat", "responses", "speech"].includes(service.operation)
        ? materialize(service, request, root) : { error: service.operation === "chat_probe"
          ? "C1_PROBE_REQUIRES_DEDICATED_MAPPING" : "C1_SYNTHETIC_AUDIO_FIXTURE_REQUIRED" }),
    })),
  }));
  return { phase: "C1", kind: "OFFLINE_PREPARATION_NOT_LIVE_EVIDENCE",
    policy: { gatewayEnabled: false, productionProvider: "openai", fallback: false,
      automaticMigration: false, syntheticOnly: true },
    sourceCommit: catalog.metadata.sourceCommit, sourceHashes,
    sourceReconciliation: catalog.metadata.c1Reconciliation ?? null, services };
}

function main() {
  const [catalogFile, output] = process.argv.slice(2);
  if (!catalogFile || !output) throw Error("Usage: node script/ai-gateway-c1/prepare.cjs CATALOG.json OUTPUT.json");
  const plan = prepare(JSON.parse(fs.readFileSync(catalogFile, "utf8")));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(plan, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ services: plan.services.length,
    variants: plan.services.flatMap(s => s.variants).length,
    materialized: plan.services.flatMap(s => s.variants).filter(v => v.request).length }));
}
module.exports = { prepare, materialize, verifySources, hash };
if (require.main === module) main();
