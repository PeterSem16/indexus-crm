#!/usr/bin/env node
"use strict";

// This checks the selected Git tree with an isolated TypeScript module graph.
// It never resolves local imports against files left in the dirty workspace.
// Unlike a bundle build, it checks destructured dynamic-import export names.
const ts = require("typescript");
const path = require("node:path").posix;
const { loadGitTree } = require("./check-release-imports.cjs");
const ROOT = "/__indexus_release__";

function checkExports({ sources }) {
  const contents = new Map(sources.map(source => [`${ROOT}/${source.file}`, source.content]));
  const parsed = new Map();
  const resolve = (specifier, containing) => {
    const clean = specifier.split("?")[0];
    let base;
    if (clean.startsWith(".")) base = path.normalize(path.join(path.dirname(containing), clean));
    else if (clean.startsWith("@/")) base = `${ROOT}/client/src/${clean.slice(2)}`;
    else if (clean.startsWith("@shared/")) base = `${ROOT}/shared/${clean.slice(8)}`;
    else return undefined; // External packages and non-code Vite assets.
    const candidates = [base, ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"].map(ext => base + ext),
      ...[".ts", ".tsx", ".js", ".jsx"].map(ext => `${base}/index${ext}`)];
    if (base.endsWith(".js")) candidates.push(base.slice(0, -3) + ".ts", base.slice(0, -3) + ".tsx");
    if (base.endsWith(".mjs")) candidates.push(base.slice(0, -4) + ".mts");
    if (base.endsWith(".cjs")) candidates.push(base.slice(0, -4) + ".cts");
    return candidates.find(candidate => contents.has(candidate));
  };
  const host = {
    getSourceFile(file) {
      if (!contents.has(file)) return undefined;
      if (!parsed.has(file)) parsed.set(file, ts.createSourceFile(file, contents.get(file), ts.ScriptTarget.Latest, true));
      return parsed.get(file);
    },
    writeFile() {}, getCurrentDirectory: () => ROOT, getDirectories: () => [],
    fileExists: file => contents.has(file), readFile: file => contents.get(file),
    useCaseSensitiveFileNames: () => true, getCanonicalFileName: file => file,
    getNewLine: () => "\n", getDefaultLibFileName: () => `${ROOT}/no-default-lib.d.ts`,
    resolveModuleNames(names, containing) {
      return names.map(name => {
        const file = resolve(name, containing);
        return file ? { resolvedFileName: file, isExternalLibraryImport: false } : undefined;
      });
    },
  };
  // No npm/DOM/Node type graph: only the Git-owned module/export contracts.
  const program = ts.createProgram([...contents.keys()], {
    noLib: true, types: [], allowJs: true, checkJs: false, skipLibCheck: true,
    target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve,
  }, host);
  const checker = program.getTypeChecker();
  const failures = new Set(), aliases = new Map();
  let checked = 0, dynamicBindings = 0, computedImports = 0;
  const literal = node => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
  const moduleFor = (specifier, sf) => {
    const file = resolve(specifier, sf.fileName);
    return file ? program.getSourceFile(file) : undefined;
  };
  const check = (module, name, node, sf, runtime) => {
    if (!module) return;
    checked++;
    const symbol = checker.getSymbolAtLocation(module);
    const exported = symbol && checker.getExportsOfModule(symbol).find(item => item.name === name);
    let value = exported;
    if (value && value.flags & ts.SymbolFlags.Alias) value = checker.getAliasedSymbol(value);
    if (!exported || (runtime && !(value.flags & ts.SymbolFlags.Value))) {
      const location = sf.getLineAndCharacterOfPosition(node.getStart());
      failures.add(`${sf.fileName.slice(ROOT.length + 1)}:${location.line + 1} -> ${module.fileName.slice(ROOT.length + 1)} has no ${runtime ? "runtime " : ""}export "${name}"`);
    }
  };
  const bind = (binding, module, sf) => {
    if (!module) return;
    if (ts.isObjectBindingPattern(binding)) {
      for (const element of binding.elements) {
        if (element.dotDotDotToken) continue;
        const name = element.propertyName || element.name;
        if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
          dynamicBindings++;
          check(module, name.text, element, sf, true);
        }
      }
    } else if (ts.isIdentifier(binding)) {
      const symbol = checker.getSymbolAtLocation(binding);
      if (symbol) aliases.set(symbol, module);
    }
  };
  const files = program.getSourceFiles();
  for (const sf of files) {
    const visit = node => {
      if (ts.isImportDeclaration(node) && literal(node.moduleSpecifier) !== undefined) {
        const module = moduleFor(literal(node.moduleSpecifier), sf), clause = node.importClause;
        if (clause?.name && !clause.isTypeOnly) check(module, "default", clause.name, sf, false);
        const named = clause?.namedBindings;
        if (named && ts.isNamedImports(named)) {
          for (const element of named.elements) {
            if (!clause.isTypeOnly && !element.isTypeOnly) check(module, (element.propertyName || element.name).text, element, sf, false);
          }
        } else if (named && ts.isNamespaceImport(named) && module) {
          const symbol = checker.getSymbolAtLocation(named.name);
          if (symbol) aliases.set(symbol, module);
        }
      }
      if (ts.isExportDeclaration(node) && literal(node.moduleSpecifier) !== undefined && node.exportClause && ts.isNamedExports(node.exportClause)) {
        const module = moduleFor(literal(node.moduleSpecifier), sf);
        for (const element of node.exportClause.elements) {
          if (!node.isTypeOnly && !element.isTypeOnly) check(module, (element.propertyName || element.name).text, element, sf, false);
        }
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const specifier = literal(node.arguments[0]);
        if (specifier === undefined) computedImports++;
        else {
          const module = moduleFor(specifier, sf);
          let wrapped = node, awaited = false;
          while (wrapped.parent && (ts.isAwaitExpression(wrapped.parent) || ts.isParenthesizedExpression(wrapped.parent) || ts.isAsExpression(wrapped.parent) || ts.isNonNullExpression(wrapped.parent))) {
            wrapped = wrapped.parent;
            if (ts.isAwaitExpression(wrapped)) awaited = true;
          }
          if (awaited && ts.isVariableDeclaration(wrapped.parent)) bind(wrapped.parent.name, module, sf);
          if (awaited && ts.isPropertyAccessExpression(wrapped.parent)) check(module, wrapped.parent.name.text, wrapped.parent, sf, true);
          const property = node.parent;
          if (ts.isPropertyAccessExpression(property) && property.name.text === "then" && ts.isCallExpression(property.parent)) {
            const callback = property.parent.arguments[0];
            if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) && callback.parameters[0]) bind(callback.parameters[0].name, module, sf);
          }
          if (ts.isArrowFunction(wrapped.parent) && ts.isCallExpression(wrapped.parent.parent)) {
            const callee = wrapped.parent.parent.expression;
            if ((ts.isIdentifier(callee) && callee.text === "lazy") || (ts.isPropertyAccessExpression(callee) && callee.name.text === "lazy")) check(module, "default", node, sf, true);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  // Separate pass so namespace bindings are known even before their first use.
  for (const sf of files) {
    const visit = node => {
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
        const module = aliases.get(checker.getSymbolAtLocation(node.expression));
        if (module) check(module, node.name.text, node, sf, true);
      } else if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression)) {
        const module = aliases.get(checker.getSymbolAtLocation(node.expression)), name = literal(node.argumentExpression);
        if (module && name !== undefined) check(module, name, node, sf, true);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { checked, dynamicBindings, computedImports, missing: [...failures].sort() };
}

function compareBaseline(missing, baseline) {
  const key = message => message.replace(/^(.+?):\d+ -> /, "$1 -> ");
  const counts = new Map();
  for (const message of baseline) counts.set(key(message), (counts.get(key(message)) || 0) + 1);
  const existing = [], regressions = [];
  for (const message of missing) {
    const name = key(message), count = counts.get(name) || 0;
    if (count) { existing.push(message); counts.set(name, count - 1); }
    else regressions.push(message);
  }
  return { existing, regressions };
}

if (require.main === module) {
  try {
    const ref = process.argv[2];
    const baseline = process.argv[3] === "--baseline" && process.argv[4];
    if (!ref || ref.startsWith("-") || (process.argv.length > 3 && (!baseline || process.argv.length !== 5))) {
      throw new Error("Usage: node script/check-release-exports.cjs <commit-or-tree> [--baseline <production-commit>]");
    }
    const result = checkExports(loadGitTree(ref));
    const compared = baseline
      ? compareBaseline(result.missing, checkExports(loadGitTree(baseline)).missing)
      : { regressions: result.missing, existing: [] };
    for (const missing of compared.regressions) console.error(`MISSING_EXPORT ${missing}`);
    for (const existing of compared.existing) console.warn(`PRE_EXISTING_EXPORT_DEFECT ${existing}`);
    console.log(`Release export check: ${result.checked} named contracts, ${result.dynamicBindings} dynamic bindings; ${compared.regressions.length} new missing exports; ${compared.existing.length} pre-existing export defects; ${result.computedImports} computed import sites not statically inspectable.`);
    if (compared.regressions.length) process.exitCode = 1;
  } catch (error) {
    console.error(`Release export check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
module.exports = { checkExports, compareBaseline };
