import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import path from "node:path";

test("every priorityCopy reference resolves in its own component scope", () => {
  const file = path.resolve("client/src/pages/agent-workspace.tsx");
  // Binding is sufficient here: no dependency traversal or full-repo typecheck.
  // Vite/esbuild alone accepts undefined identifiers as potential globals.
  const program = ts.createProgram([file], {
    noResolve: true, noLib: true, noEmit: true, jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.ESNext,
  });
  const source = program.getSourceFile(file)!;
  const checker = program.getTypeChecker();
  let references = 0;
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && node.text === "priorityCopy") {
      references++;
      const position = source.getLineAndCharacterOfPosition(node.getStart(source));
      const symbol = checker.getSymbolAtLocation(node);
      assert.ok(symbol?.declarations?.length, `Unbound priorityCopy at line ${position.line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(references > 2, "Must inspect definitions and render references");
});