import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import path from "node:path";
import { readFileSync } from "node:fs";

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

test("initial priority ranking does not restart when its own pending state changes", () => {
  const file = path.resolve("client/src/pages/agent-workspace.tsx");
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
  let found = false;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "useEffect"
      && node.arguments[0]?.getText(source).includes("prioritySeedAttemptRef.current = attemptKey")) {
      found = true;
      const dependencies = node.arguments[1];
      assert.ok(dependencies && ts.isArrayLiteralExpression(dependencies));
      const names = dependencies.elements.map(item => item.getText(source));
      // setPrioritySeedState("pending") must not immediately trigger cleanup,
      // abort its own fetch, and leave Contacts/Auto/Next locked forever.
      assert.ok(!names.includes("prioritySeedState"));
      assert.ok(names.includes("prioritySeedRetryNonce"));
      assert.ok(names.includes("priorityInitialCitySignature"));
      assert.ok(!names.includes("priorityInitialCities"), "Polling creates new arrays with identical city contents");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(found, "Must inspect the production initialization effect");
});