// Replay ONLY selected pure application boundaries, extracted from hash-pinned source.
// No CRM module import, DB, event publishing, email, SIP or storage access.
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "../..");
const { boundaryCode, BOUNDARIES } = require("./boundary-replay.cjs");
const crypto = require("node:crypto");
const RECIPES = {
  "email.sentiment": { file: "server/routes.ts", names: ["analyzeEmailContent"],
    invoke: "analyzeEmailContent(seed.content, seed.subject)" },
  "sms.sentiment": { file: "server/routes.ts", names: ["analyzeSmsContent"],
    invoke: "analyzeSmsContent(seed.content)" },
  "task.checklist": { file: "server/lib/task-ai-checklist.ts",
    names: ["outputSchema", "genericEntityKind", "taskChecklistLanguage", "validateAiChecklistOutput",
      "generateTaskChecklistWithCompletion", "ChecklistGenerationError"],
    invoke: "generateTaskChecklistWithCompletion(seed.task, complete)" },
  "task.resolution": { file: "server/lib/task-resolution-draft.ts",
    names: ["AI_TIMEOUT_MS", "MODEL", "MAX_TITLE_CHARS", "MAX_COUNTRY_CHARS", "MAX_REQUEST_CHARS",
      "MAX_COMPLETED_ITEMS", "MAX_SOURCE_ITEMS_TO_SCAN", "MAX_ITEM_TEXT_CHARS", "MAX_DRAFT_CHARS",
      "TASK_RESOLUTION_DRAFT_LANGUAGES", "safeText", "safeInput", "taskResolutionDraftLanguageForCountry",
      "supportedTaskResolutionDraftLanguage", "validateDraftOutput",
      "generateTaskResolutionDraftWithCompletion", "safeProviderError"],
    invoke: "generateTaskResolutionDraftWithCompletion(seed.input, complete)" },
};
function extract(recipe, root = ROOT) {
  const text = fs.readFileSync(path.join(root, recipe.file), "utf8");
  const ast = ts.createSourceFile(recipe.file, text, ts.ScriptTarget.Latest, true);
  const selected = [];
  const found = new Set();
  for (const node of ast.statements) {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations)
        if (ts.isIdentifier(decl.name) && recipe.names.includes(decl.name.text)) {
          selected.push("const " + decl.getText(ast) + ";");
          found.add(decl.name.text);
        }
    } else if (node.name && recipe.names.includes(node.name.text)) {
      selected.push(node.getText(ast).replace(/^export\s+/, ""));
      found.add(node.name.text);
    }
  }
  if (recipe.names.some(name => !found.has(name))) throw Error("C1_PARSER_SOURCE_CHANGED");
  return selected.join("\n");
}
function tailRecipe(variant, root = ROOT) {
  const file = path.resolve(root, variant.source.file);
  if (!file.startsWith(root + path.sep)) throw Error("C1_PARSER_SOURCE_INVALID");
  const text = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  let call;
  function visit(node) {
    if (ts.isCallExpression(node) && node.arguments[0]?.getText(ast) === variant.originalExpression &&
        ast.getLineAndCharacterOfPosition(node.getStart(ast)).line === variant.source.line - 1) call = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  let declaration = call;
  while (declaration && !ts.isVariableDeclaration(declaration)) declaration = declaration.parent;
  if (!declaration || !ts.isIdentifier(declaration.name)) return null;
  const statement = declaration.parent?.parent;
  if (!statement || !ts.isVariableStatement(statement) || !ts.isBlock(statement.parent)) return null;
  const siblings = statement.parent.statements;
  const tail = siblings.slice(siblings.indexOf(statement) + 1);
  if (!tail.length) return null;
  return { responseName: declaration.name.text,
    code: tail.map(n => n.getText(ast)).join("\n") };
}
async function replayTail(raw, seed, variant, options = {}) {
  let recipe;
  try { recipe = tailRecipe(variant, options.sourceRoot || ROOT); } catch {}
  if (!recipe) return { state: "NOT_REPLAYED", value: null,
    validationError: "C1_APPLICATION_PARSER_REPLAY_REQUIRED" };
  let httpStatus = 200, captured = false, responseBody;
  const res = {
    status(code) { httpStatus = code; return res; },
    json(value) { captured = true; responseBody = value; return value; },
    send(value) { captured = true; responseBody = value; return value; },
  };
  const envelope = { choices: [{ message: { content: raw } }], output_text: raw };
  const blockedEffects = [];
  const blocked = label => new Proxy(function () { blockedEffects.push(label); throw Error("C11_SIDE_EFFECT_BLOCKED"); }, {
    get(_target, key) { if (key === "then") return undefined; return blocked(label + "." + String(key)); },
  });
  let selected;
  try { selected = options.bounded ? boundaryCode(options.id, recipe.code, variant) : null; }
  catch { return { state: "REPLAY_ERROR", value: null, validationError: "C11_BOUNDARY_SOURCE_CHANGED" }; }
  const code = selected?.code || recipe.code;
  let dependencies = "";
  if (selected?.recipe.dependencies) dependencies = extract({
    file: selected.recipe.dependencyFile || variant.source.file,
    names: selected.recipe.dependencies,
  }, options.sourceRoot || ROOT);
  const context = vm.createContext({
    ...JSON.parse(JSON.stringify(seed)), [recipe.responseName]: envelope, res, z: require("zod").z,
    console: { log() {}, warn() {}, error() {} },
    db: blocked("db"), pool: blocked("pool"), storage: blocked("storage"),
    fetch: blocked("fetch"), require: blocked("require"), process: undefined,
    emitEventOnceForIdentity: blocked("event"), sendEmail: blocked("email"), sendSms: blocked("sms"),
  }, { codeGeneration: { strings: false, wasm: false } });
  let stage = "COMPILE";
  try {
    // Only original statements AFTER inference are replayed. IO capabilities are absent.
    const js = ts.transpileModule(`${dependencies}\nasync function __parse() { ${code}
      return { __c1_no_return: true }; } globalThis.__completion = __parse();`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
    // Compilation failures belong to the harness, not to the model's JSON parser.
    const script = new vm.Script(js);
    stage = "APPLICATION";
    script.runInContext(context, { timeout: 250 });
    let value = await context.__completion;
    if (blockedEffects.length) throw Error("C11_SIDE_EFFECT_BLOCKED");
    if (value?.__c11_capture) value = value.value;
    if (value?.__c1_no_return && !captured) throw Error("C1_NO_PARSER_RESULT");
    stage = "SERIALIZE";
    return { state: httpStatus >= 400 || value === null ? "REJECTED" : "ACCEPTED",
      boundary: selected?.scope || "ORIGINAL_POST_INFERENCE_STATEMENTS",
      integrationVerified: false,
      sourceBoundarySha256: crypto.createHash("sha256").update(dependencies + code).digest("hex"),
      omittedDownstream: !!selected && !selected.recipe.full,
      returnKind: (captured ? responseBody : value) === undefined ? "undefined" : "json",
      value: (captured ? responseBody : value) === undefined ? null : JSON.parse(JSON.stringify(captured ? responseBody : value)),
      blockedEffects,
      httpResponseStatus: captured ? httpStatus : null,
      validationError: httpStatus >= 400 || value === null ? "C1_APPLICATION_REJECTED_OUTPUT" : null };
  } catch (error) {
    const validation = stage === "APPLICATION" && ["SyntaxError", "ZodError"].includes(error?.name);
    return { state: validation ? "REJECTED" : stage === "SERIALIZE" ? "REPLAY_ERROR" : "NOT_REPLAYED", value: null,
      boundary: "ORIGINAL_POST_INFERENCE_STATEMENTS",
      blockedEffects,
      validationError: stage === "SERIALIZE" ? "C11_WRAPPER_SERIALIZATION_FAILED" :
        validation ? "C1_APPLICATION_" + error.name.toUpperCase() :
        "C1_APPLICATION_DEPENDENCY_OR_SIDE_EFFECT_BLOCKED" };
  }
}
async function replay(id, raw, seed, originalRequest, variant, options = {}) {
  if (!RECIPES[id]) return variant ? replayTail(raw, seed, variant, { ...options, id }) :
    { state: "NOT_REPLAYED", value: null, validationError: "C1_APPLICATION_PARSER_REPLAY_REQUIRED" };
  let captured;
  const complete = async messages => { captured = messages; return raw; };
  const context = vm.createContext({
    seed, complete, z: require("zod").z,
    console: { log() {}, warn() {}, error() {} }, isAIAvailable: () => true,
    aiClient: () => ({ chat: { completions: { create: async request => {
      captured = request.messages;
      return { choices: [{ message: { content: raw } }] };
    } } } }),
  }, { codeGeneration: { strings: false, wasm: false } });
  try {
    const js = ts.transpileModule(extract(RECIPES[id], options.sourceRoot || ROOT) +
      "\nglobalThis.__completion = " + RECIPES[id].invoke + ";",
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
    vm.runInContext(js, context, { timeout: 250 });
    const value = await context.__completion;
    if (JSON.stringify(captured) !== JSON.stringify(originalRequest.messages))
      return { state: "HARNESS_ERROR", value: null, validationError: "C1_REPLAY_REQUEST_MISMATCH" };
    const rejected = value === null || value?.status === "failed" || value?.status === "unavailable";
    return { state: rejected ? "REJECTED" : "ACCEPTED",
      value: JSON.parse(JSON.stringify(value)),
      validationError: rejected ? value?.errorCode || "C1_APPLICATION_REJECTED_OUTPUT" : null };
  } catch (error) {
    // Application validators can intentionally throw rather than return null.
    // Do not leak raw payloads through exception messages.
    const rejected = typeof error?.safeCode === "string" && /^[a-z_]+$/.test(error.safeCode);
    return { state: rejected ? "REJECTED" : "REPLAY_ERROR", value: null,
      validationError: rejected ? error.safeCode : "C1_PARSER_REPLAY_FAILED" };
  }
}
module.exports = { replay, RECIPES, extract, tailRecipe, BOUNDARIES };
