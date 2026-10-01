import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import { translations, type Locale } from "../i18n/translations";

const groupSettingsKeys = [
  "dialogTitle", "activeUsers", "inactiveMemberWarning", "inactive",
  "changesTitle", "changesDescription", "discardChanges", "moveUp", "moveDown",
  "readOnly", "nameRequired",
  "usersLoadFailed", "groupsLoadFailed", "advanced", "serverError",
] as const;

const taskWorkspaceKeys = [
  "settings", "filtersTitle", "searchPeoplePlaceholder",
  "dateAll", "dateToday", "dateWeek", "dateMonth", "dateCustom",
  "basisCreated", "basisDue", "basisResolved",
  "sortCreated", "sortDue", "sortResolved", "sortPriority", "sortTitle",
  "ascending", "descending", "anyCreator", "anyResolver",
  "dateFrom", "dateTo", "rangeSeparator", "clearFilters",
  "group", "noGroup", "notifyAgent", "notifyAgentHint",
  "noMatchingTasks", "titleRequired", "unassigned", "sortOrder", "changeSortOrder",
] as const;

const completionNoticeKeys = [
  "taskCompletionHeading", "taskCompletionOpenAction", "taskCompletionDismissAction",
  "taskCompletionStatus", "taskCompletionActionError",
] as const;

const locales: Locale[] = ["en", "sk", "cs", "hu", "ro", "it", "de"];
for (const locale of locales) {
  for (const key of groupSettingsKeys) {
    const text = translations[locale].tasks.taskGroups[key];
    assert.equal(typeof text, "string", `${locale}: missing tasks.taskGroups.${key}`);
    assert.ok(text.trim().length, `${locale}: blank tasks.taskGroups.${key}`);
    if (key === "moveUp" || key === "moveDown") {
      assert.ok(text.includes("{name}"), `${locale}: missing {name} in tasks.taskGroups.${key}`);
    }
  }
  for (const key of taskWorkspaceKeys) {
    const text = translations[locale].tasks.workspace[key];
    assert.equal(typeof text, "string", `${locale}: missing tasks.workspace.${key}`);
    assert.ok(text.trim().length, `${locale}: blank tasks.workspace.${key}`);
  }
  for (const key of completionNoticeKeys) {
    const text = translations[locale].backOffice[key];
    assert.equal(typeof text, "string", `${locale}: missing backOffice.${key}`);
    assert.ok(text.trim().length, `${locale}: blank backOffice.${key}`);
    if (key === "taskCompletionStatus") {
      assert.ok(text.includes("{title}"), `${locale}: missing {title} in backOffice.${key}`);
    }
  }
}

const translationSourcePath = fileURLToPath(new URL("../i18n/translations.ts", import.meta.url));
const translationSource = readFileSync(translationSourcePath, "utf8");
const translationAst = ts.createSourceFile(
  translationSourcePath,
  translationSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

interface TranslationLeaf {
  keys: string[];
  path: string;
}

function formatLeafPath(keys: string[]): string {
  return keys.reduce((result, key, index) => {
    if (index === 0) return key;
    return /^[\p{L}_][\p{L}\p{N}_-]*$/u.test(key)
      ? `${result}.${key}`
      : `${result}[${JSON.stringify(key)}]`;
  }, "");
}

function collectLeafPaths(value: unknown, keys: string[] = []): TranslationLeaf[] {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value)
      .flatMap(([key, child]) => collectLeafPaths(child, [...keys, key]))
      .sort((left, right) => left.path.localeCompare(right.path));
  }
  return keys.length ? [{ keys, path: formatLeafPath(keys) }] : [];
}

function valueAtPath(value: unknown, keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (current === null || typeof current !== "object" || !(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function placeholderTokens(text: string): string[] {
  // The colon/quote exclusions are intentional: CSS declarations and JSON members
  // are not interpolation tokens. Unicode letters are valid token-name characters.
  const tokenPattern = /\{\{\s*([\p{L}_][\p{L}\p{N}_.-]*)\s*\}\}|\{\s*([\p{L}_][\p{L}\p{N}_.-]*)\s*\}/gu;
  return [...text.matchAll(tokenPattern)]
    .map((match) => match[1] ?? match[2])
    .sort();
}

function placeholderMismatch(pathName: string, expected: string, actual: string): string | undefined {
  const expectedTokens = placeholderTokens(expected);
  const actualTokens = placeholderTokens(actual);
  return JSON.stringify(expectedTokens) === JSON.stringify(actualTokens)
    ? undefined
    : `${pathName}: expected ${JSON.stringify(expectedTokens)}, got ${JSON.stringify(actualTokens)}`;
}

function staticPropertyName(name: ts.PropertyName | undefined): string | undefined {
  if (!name) return undefined;
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name)
  ) {
    return name.text;
  }
  if (
    ts.isComputedPropertyName(name) &&
    (ts.isStringLiteral(name.expression) ||
      ts.isNumericLiteral(name.expression) ||
      ts.isNoSubstitutionTemplateLiteral(name.expression))
  ) {
    return name.expression.text;
  }
  return undefined;
}

function namedMemberKey(member: ts.Node): string | undefined {
  if (
    !ts.isPropertyAssignment(member) &&
    !ts.isShorthandPropertyAssignment(member) &&
    !ts.isMethodDeclaration(member) &&
    !ts.isGetAccessorDeclaration(member) &&
    !ts.isSetAccessorDeclaration(member) &&
    !ts.isPropertySignature(member) &&
    !ts.isMethodSignature(member)
  ) {
    return undefined;
  }
  return staticPropertyName(member.name);
}

function astPath(node: ts.Node): string {
  const segments: string[] = [];
  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
    segments.push(node.name.text);
  }
  let current: ts.Node = node;
  while (current.parent) {
    const parent = current.parent;
    if (ts.isPropertyAssignment(parent) && parent.initializer === current) {
      const name = staticPropertyName(parent.name);
      if (name) segments.push(name);
    } else if (ts.isPropertyDeclaration(parent) && parent.initializer === current) {
      const name = staticPropertyName(parent.name);
      if (name) segments.push(name);
    } else if (
      ts.isVariableDeclaration(parent) &&
      parent.initializer === current &&
      ts.isIdentifier(parent.name)
    ) {
      segments.push(parent.name.text);
    } else if (ts.isTypeAliasDeclaration(parent) && parent.type === current) {
      segments.push(parent.name.text);
    } else if (
      (ts.isPropertySignature(parent) || ts.isMethodSignature(parent) || ts.isMethodDeclaration(parent)) &&
      parent.type === current
    ) {
      const name = staticPropertyName(parent.name);
      if (name) segments.push(name);
    } else if (ts.isInterfaceDeclaration(parent) && parent.members.some((member) => member === current)) {
      segments.push(parent.name.text);
    }
    current = parent;
  }
  return segments.reverse().join(".") || "<root>";
}

function duplicateAstKeys(sourceFile: ts.SourceFile): string[] {
  const duplicates: string[] = [];

  function inspectMembers(members: readonly ts.Node[], owner: ts.Node): void {
    const seen = new Map<string, ts.Node>();
    for (const member of members) {
      const key = namedMemberKey(member);
      if (key === undefined) continue;
      const previous = seen.get(key);
      if (previous) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile));
        duplicates.push(`${astPath(owner)}.${key} (line ${line + 1})`);
      } else {
        seen.set(key, member);
      }
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isObjectLiteralExpression(node)) inspectMembers(node.properties, node);
    if (ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node)) {
      inspectMembers(node.members, node);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return duplicates;
}

const auditErrors: string[] = [];

const baselineLeafPaths = collectLeafPaths(translations.en);
for (const locale of locales) {
  const actualLeafPaths = collectLeafPaths(translations[locale]);
  const baselineSet = new Set(baselineLeafPaths.map((leaf) => JSON.stringify(leaf.keys)));
  const actualSet = new Set(actualLeafPaths.map((leaf) => JSON.stringify(leaf.keys)));
  const missing = baselineLeafPaths
    .filter((leaf) => !actualSet.has(JSON.stringify(leaf.keys)))
    .map((leaf) => leaf.path);
  const extra = actualLeafPaths
    .filter((leaf) => !baselineSet.has(JSON.stringify(leaf.keys)))
    .map((leaf) => leaf.path);
  if (missing.length || extra.length) {
    const showPaths = (paths: string[]) =>
      paths.length > 30 ? `${paths.slice(0, 30).join(", ")}, … (${paths.length - 30} more)` : paths.join(", ");
    auditErrors.push(
      `${locale}: leaf-key parity mismatch; missing [${showPaths(missing)}], extra [${showPaths(extra)}]`,
    );
  }
}

// This one leaf teaches users localized literal brace syntax; its braces are examples,
// not runtime interpolation. Keep the exception scoped to this exact path only.
const placeholderParityExemptions = new Set(["konfigurator.variableInsertFooter"]);
for (const locale of locales) {
  const localizedSyntaxExample = valueAtPath(translations[locale], ["konfigurator", "variableInsertFooter"]);
  assert.equal(
    typeof localizedSyntaxExample,
    "string",
    `${locale}: missing string translations.konfigurator.variableInsertFooter`,
  );
  assert.ok(
    typeof localizedSyntaxExample === "string" && localizedSyntaxExample.trim().length > 0,
    `${locale}: blank translations.konfigurator.variableInsertFooter`,
  );
}
for (const locale of locales) {
  if (locale === "en") continue;
  for (const leaf of baselineLeafPaths) {
    if (placeholderParityExemptions.has(leaf.path)) continue;
    const expected = valueAtPath(translations.en, leaf.keys);
    const actual = valueAtPath(translations[locale], leaf.keys);
    if (typeof expected === "string" && typeof actual === "string") {
      const mismatch = placeholderMismatch(leaf.path, expected, actual);
      if (mismatch) auditErrors.push(`${locale}: placeholder mismatch at ${mismatch}`);
    }
  }
}

const duplicateKeys = duplicateAstKeys(translationAst);
if (duplicateKeys.length) {
  const displayedDuplicates = duplicateKeys.slice(0, 50);
  auditErrors.push(
    `translations.ts has duplicate object/type members: ${displayedDuplicates.join(", ")}` +
      (duplicateKeys.length > displayedDuplicates.length
        ? `, … (${duplicateKeys.length - displayedDuplicates.length} more)`
        : ""),
  );
}

// Guard fixtures exercise both interpolation forms (including Unicode names) while
// proving CSS declarations and JSON members are not mistaken for placeholders.
assert.deepEqual(
  placeholderTokens("{{name}} {count} {változó} { color: red; } {\"field\": \"value\"}"),
  ["count", "name", "változó"],
);
assert.ok(
  placeholderMismatch("fixture.message", "Hello {name}", "Hallo {person}"),
  "placeholder parity must reject a mismatched named token",
);
const duplicateKeyFixture = ts.createSourceFile(
  "duplicate-fixture.ts",
  `interface Fixture {
     field: string; field: string;
     child: { nested: string; nested: number };
   }
   type Shape = { value: string; value: number };
   const fixture = { en: { nested: "first", nested: "second" } };`,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const fixtureDuplicates = duplicateAstKeys(duplicateKeyFixture);
assert.equal(fixtureDuplicates.length, 4, "duplicate guard must inspect interfaces, type literals, and nested objects");
assert.ok(fixtureDuplicates.some((duplicate) => duplicate.includes("fixture.en.nested")));
assert.ok(fixtureDuplicates.some((duplicate) => duplicate.includes("Fixture.child.nested")));

const compilerOptions: ts.CompilerOptions = {
  strict: true,
  noEmit: true,
  noResolve: true,
  skipLibCheck: true,
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  types: [],
};
assert.ok(
  !translationAst.statements.some(ts.isImportDeclaration),
  "translations.ts typecheck must stay isolated from project imports",
);
const compilerHost = ts.createCompilerHost(compilerOptions);
const originalGetSourceFile = compilerHost.getSourceFile.bind(compilerHost);
compilerHost.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
  path.resolve(fileName) === path.resolve(translationSourcePath)
    ? translationAst
    : originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
const translationProgram = ts.createProgram({
  rootNames: [translationSourcePath],
  options: compilerOptions,
  host: compilerHost,
});
const typecheckDiagnostics = ts.getPreEmitDiagnostics(translationProgram);
if (typecheckDiagnostics.length) {
  const diagnosticSummary = typecheckDiagnostics
    .slice(0, 30)
    .map((diagnostic) => {
      const location =
        diagnostic.file && diagnostic.start !== undefined
          ? `${diagnostic.file.fileName}:${diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1}: `
          : "";
      return `${location}TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
    })
    .join("\n");
  auditErrors.push(
    `translations.ts strict isolated typecheck failed:\n${diagnosticSummary}` +
      (typecheckDiagnostics.length > 30 ? `\n… (${typecheckDiagnostics.length - 30} more diagnostics)` : ""),
  );
}

assert.equal(auditErrors.length, 0, `Translation regression audit failed:\n${auditErrors.join("\n")}`);

console.log("Omni Tasks strings and whole-translation locale parity checks passed for all seven languages.");