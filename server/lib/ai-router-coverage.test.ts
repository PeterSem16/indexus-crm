import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import * as ts from "typescript";
import { AI_SERVICES, type AIService } from "./ai/service-catalog";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const baseline: Record<string, { count: number; sha256: string }> =
  JSON.parse(readFileSync("server/lib/ai/legacy-request-fingerprints.json", "utf8"));
const files = (readdirSync("server", { recursive: true }) as string[])
  .filter(file => file.endsWith(".ts") && !file.includes(".test.") && !file.startsWith("lib/ai/") &&
    file !== "lib/ai-router.ts").map(file => `server/${file}`);

function root(node: ts.Expression): ts.Expression {
  return ts.isPropertyAccessExpression(node) ? root(node.expression) : node;
}
function chain(node: ts.Expression): string {
  if (ts.isPropertyAccessExpression(node)) return `${chain(node.expression)}.${node.name.text}`;
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isCallExpression(node) && node.expression.getText() === "aiClient") return "aiClient";
  return "";
}

test("migration preserves all 71 original SDK request arguments and binds every operation to a valid service", () => {
  const current: Record<string, { count: number; sha256: string }> = {};
  const seen = new Set<AIService>();
  for (const file of files) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const declarations: ts.VariableDeclaration[] = [];
    const calls: ts.CallExpression[] = [];
    function visit(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) &&
          node.initializer.expression.getText(source) === "aiClient") declarations.push(node);
      if (ts.isCallExpression(node) &&
          /^(openai|client|openaiInstance|aiClient)\.(chat\.completions|responses|audio\.(transcriptions|speech))\.create$/.test(chain(node.expression)))
        calls.push(node);
      ts.forEachChild(node, visit);
    }
    visit(source);
    const entries = calls.map(call => {
      const receiver = root(call.expression);
      const factory = ts.isCallExpression(receiver) ? receiver :
        declarations.filter(declaration => declaration.name.getText(source) === receiver.getText(source) &&
          declaration.getStart(source) < call.getStart(source)).at(-1)?.initializer;
      assert.ok(factory && ts.isCallExpression(factory), `${file}: unrouted operation`);
      const argument = factory.arguments[0];
      assert.ok(argument && ts.isStringLiteral(argument), `${file}: service must be a static catalog key`);
      const service = argument.text as AIService;
      assert.ok(Object.hasOwn(AI_SERVICES, service), `${file}: unknown service ${service}`);
      seen.add(service);
      const path = chain(call.expression);
      const operation = path.slice(path.indexOf(".") + 1);
      const expected = operation.startsWith("chat.") ? "chat" : operation.startsWith("responses.") ? "responses" :
        operation.includes("transcriptions") ? "transcription" : "speech";
      assert.equal(AI_SERVICES[service], expected, `${file}: wrong capability for ${service}`);
      return { operation, hash: hash(call.arguments.map(arg => arg.getText(source)).join("\n")) };
    });
    if (entries.length) current[file] = { count: entries.length, sha256: hash(JSON.stringify(entries)) };
  }
  assert.deepEqual(current, baseline, "intentional request/prompt/model changes require a separately reviewed baseline update");
  assert.equal(Object.values(current).reduce((total, item) => total + item.count, 0), 71);
  seen.add("beratung.health"); // This deliberately retains raw HTTP rather than SDK retry/error semantics.
  assert.deepEqual([...seen].sort(), Object.keys(AI_SERVICES).sort(), "no unbound or undocumented services");
});

test("provider construction, credential checks and direct AI HTTP calls stay inside the adapter", () => {
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.equal(/new\s+(OpenAI|openai|openaiModule)/.test(text), false, `${file}: direct SDK constructor`);
    assert.equal(text.includes("process.env.OPENAI_API_KEY"), false, `${file}: provider-specific readiness check`);
    assert.equal(text.includes("https://api.openai.com/v1"), false, `${file}: direct provider request`);
  }
  const health = readFileSync("server/beratung-routes.ts", "utf8");
  assert.match(health, /aiChatProbe\("beratung\.health"/);
  assert.match(health, /model: "gpt-4o-mini",\s*messages: \[\{ role: "user", content: "ok" \}\],\s*max_tokens: 1/);
});
