/** Execute the original source boundaries without importing polling, routes or DB writers. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";
import { z } from "zod";
import type { ThreeService } from "../../server/lib/ai/three-services-profile";

export const sha256 = (text: string) => crypto.createHash("sha256").update(text).digest("hex");
export function originalBoundaries(root: string) {
  const hashes: Record<string, string> = {};
  function read(file: string) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    hashes[file] = sha256(text);
    return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  }
  function selected(ast: ts.SourceFile, names: string[]) {
    const found = new Set<string>();
    const nodes = ast.statements.filter(node => {
      const name = (node as ts.FunctionDeclaration).name;
      const nodeNames = ts.isVariableStatement(node)
        ? node.declarationList.declarations.map(d => d.name.getText(ast))
        : name && ts.isIdentifier(name) ? [name.text] : [];
      const matches = nodeNames.filter(name => names.includes(name));
      matches.forEach(name => found.add(name));
      return matches.length > 0;
    });
    if (names.some(name => !found.has(name))) throw Error("THREE_ORIGINAL_BOUNDARY_CHANGED");
    return nodes.map(node => node.getText(ast)).join("\n");
  }
  const checklist = read("server/lib/task-ai-checklist.ts");
  const checklistCode = selected(checklist, ["AI_TIMEOUT_MS", "outputSchema", "genericEntityKind",
    "taskChecklistLanguage", "validateAiChecklistOutput", "ChecklistGenerationError",
    "generateTaskChecklistWithCompletion", "callOpenAi"]);
  const resolution = read("server/lib/task-resolution-draft.ts");
  const resolutionCode = resolution.statements.filter(node =>
    !ts.isImportDeclaration(node)).map(node => node.getText(resolution)).join("\n");
  const routes = read("server/routes.ts");
  const handlers: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(routes) === "app.post" &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === "/api/users/:userId/ms365-ai-summary") {
      handlers.push(node.arguments[node.arguments.length - 1].getText(routes));
    }
    ts.forEachChild(node, visit);
  }
  visit(routes);
  if (handlers.length !== 1) throw Error("THREE_SUMMARY_HANDLER_CHANGED");
  function bind(code: string, entry: string, aiClient: any) {
    const context = vm.createContext({
      exports: {}, z, aiClient, isAIAvailable: () => true,
      console: { error() {} },
    }, { codeGeneration: { strings: false, wasm: false } });
    new vm.Script(ts.transpileModule(code + `\nglobalThis.entry = ${entry};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText).runInContext(context, { timeout: 1000 });
    return context.entry as (...args: any[]) => Promise<any>;
  }
  return {
    hashes,
    async execute(service: ThreeService, input: any, aiClient: any) {
      if (service === "task.checklist") {
        const steps = await bind(checklistCode, "callOpenAi", aiClient)(input);
        return { status: "generated", steps };
      }
      if (service === "task.resolution")
        return bind(resolutionCode, "generateTaskResolutionDraft", aiClient)(input);
      let output: any, status = 200;
      const res = { status(code: number) { status = code; return res; },
        json(value: unknown) { output = value; return res; } };
      await bind("const summaryHandler = " + handlers[0], "summaryHandler", aiClient)(
        { params: { userId: "SYNTHETIC" }, body: input }, res);
      if (status !== 200) throw Error("THREE_SUMMARY_HANDLER_FAILED");
      return { status: "generated", ...output };
    },
  };
}
