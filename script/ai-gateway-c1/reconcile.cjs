// Re-pin ONLY an unrelated published routes.ts change after exact evidence-block comparison.
// Never updates application files. Outputs an ignored, build-only reference directory.
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { verifySources, hash } = require("./prepare.cjs");
const ROOT = path.resolve(__dirname, "../..");
function reconcile(catalog, publishedSource, commit, root) {
  verifySources(catalog);
  if (!/^[a-f0-9]{40}$/.test(commit)) throw Error("C1_PUBLISHED_COMMIT_REQUIRED");
  root = path.resolve(root);
  if (!root.startsWith(path.join(ROOT, "generated-artifacts") + path.sep))
    throw Error("C1_REFERENCE_MUST_BE_GENERATED");
  fs.mkdirSync(root, { recursive: false, mode: 0o700 });
  const original = fs.readFileSync(path.join(ROOT, "server/routes.ts"), "utf8").split("\n");
  const result = structuredClone(catalog);
  let blocks = 0;
  const ast = ts.createSourceFile("server/routes.ts", publishedSource, ts.ScriptTarget.Latest, true);
  const calls = [];
  function visit(node) { if (ts.isCallExpression(node)) calls.push(node); ts.forEachChild(node, visit); }
  visit(ast);
  for (const service of result.services) {
    for (const evidence of service.evidenceReferences || []) {
      if (evidence.file !== "server/routes.ts") continue;
      const block = original.slice(evidence.startLine - 1, evidence.endLine).join("\n");
      const position = publishedSource.indexOf(block);
      if (position < 0) throw Error("C1_RELEVANT_PUBLISHED_SOURCE_CHANGED:" + service.id);
      const newStart = publishedSource.slice(0, position).split("\n").length;
      const delta = newStart - evidence.startLine;
      evidence.startLine += delta; evidence.endLine += delta;
      if (evidence.bindingLine) evidence.bindingLine += delta;
      blocks++;
    }
    for (const request of service.requests) {
      if (request.file !== "server/routes.ts") continue;
      const candidates = calls.filter(node => node.arguments[0]?.getText(ast) === request.arguments?.[0] &&
        node.expression.getText(ast).includes('"' + service.id + '"'));
      if (candidates.length !== 1) throw Error("C1_PUBLISHED_CALL_NOT_UNIQUE:" + service.id);
      request.line = ast.getLineAndCharacterOfPosition(candidates[0].getStart(ast)).line + 1;
    }
  }
  result.metadata.c1Reconciliation = { originalCatalogSha256: hash(catalog),
    originalSourceCommit: catalog.metadata.sourceCommit, publishedCommit: commit,
    verifiedUnchangedEvidenceBlocks: blocks,
    note: "Only routes.ts differed. All service evidence blocks matched byte-for-byte; prompts and request expressions were not changed." };
  result.metadata.sourceCommit = commit;
  result.metadata.sourceHashes["server/routes.ts"] = hash(publishedSource);
  for (const file of Object.keys({ ...result.metadata.sourceHashes, ...result.metadata.supportHashes })) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), file === "server/routes.ts" ? publishedSource :
      fs.readFileSync(path.join(ROOT, file)));
  }
  const output = path.join(root, "catalog.json");
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
  return { output, root, verifiedEvidenceBlocks: blocks };
}
if (require.main === module) {
  const [catalog, routes, commit, root] = process.argv.slice(2);
  console.log(reconcile(JSON.parse(fs.readFileSync(catalog, "utf8")), fs.readFileSync(routes, "utf8"), commit, root));
}
module.exports = { reconcile };
