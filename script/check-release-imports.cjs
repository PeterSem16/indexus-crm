#!/usr/bin/env node
"use strict";

// Check the selected Git tree, never the surrounding workspace: unpublished
// files must not make an incomplete selective release appear buildable.
const { execFileSync } = require("node:child_process");
const path = require("node:path").posix;

function isRuntimeSource(file) {
  return /^(client\/src|server|shared)\//.test(file) &&
    /\.[cm]?[jt]sx?$/.test(file) &&
    !/(\.test\.|\.spec\.|\/__tests__\/)/.test(file);
}

function unresolvedImports(files, sources) {
  const missing = new Set();
  for (const { file, content } of sources) {
    if (!isRuntimeSource(file)) continue;
    const pattern = /(?:\bfrom\s*|\bimport\s*|\b(?:import|require)\s*\()\s*["']([^"']+)["']/g;
    let match;
    while ((match = pattern.exec(content))) {
      const specifier = match[1].split("?")[0];
      let base;
      if (specifier.startsWith(".")) base = path.normalize(path.join(path.dirname(file), specifier));
      else if (specifier.startsWith("@/")) base = `client/src/${specifier.slice(2)}`;
      else if (specifier.startsWith("@shared/")) base = `shared/${specifier.slice(8)}`;
      else if (specifier.startsWith("@assets/")) base = `attached_assets/${specifier.slice(8)}`;
      else continue; // Packages and Node built-ins are not Git-tree files.
      const candidates = [base,
        ...[".ts", ".tsx", ".js", ".jsx", ".json", ".mjs", ".cjs", ".mts", ".cts"].map(ext => base + ext),
        ...[".ts", ".tsx", ".js", ".jsx"].map(ext => `${base}/index${ext}`)];
      if (base.endsWith(".js")) candidates.push(base.slice(0, -3) + ".ts");
      if (!candidates.some(candidate => files.has(candidate))) missing.add(`${file} -> ${specifier}`);
    }
  }
  return [...missing].sort();
}

function checkGitTree(ref, cwd = process.cwd()) {
  const git = (args, options = {}) => execFileSync("git", args, {
    cwd, maxBuffer: 128 * 1024 * 1024, ...options,
  });
  const entries = git(["ls-tree", "-r", "-z", ref]).toString().split("\0").filter(Boolean).map(row => {
    const tab = row.indexOf("\t");
    return { sha: row.slice(0, tab).split(" ")[2], file: row.slice(tab + 1) };
  });
  const runtime = entries.filter(entry => isRuntimeSource(entry.file));
  const batch = git(["cat-file", "--batch"], { input: runtime.map(entry => `${entry.sha}\n`).join("") });
  let offset = 0;
  const sources = runtime.map(entry => {
    const end = batch.indexOf(10, offset);
    if (end < 0) throw new Error("Incomplete Git batch header");
    const header = batch.subarray(offset, end).toString().split(" ");
    if (header[1] !== "blob" || !/^\d+$/.test(header[2])) throw new Error("Unreadable Git source blob");
    const size = Number(header[2]);
    if (end + size + 1 >= batch.length) throw new Error("Incomplete Git source blob");
    const content = batch.subarray(end + 1, end + 1 + size).toString();
    offset = end + size + 2;
    return { file: entry.file, content };
  });
  return { sourceCount: sources.length, missing: unresolvedImports(new Set(entries.map(entry => entry.file)), sources) };
}

if (require.main === module) {
  try {
    const ref = process.argv[2];
    if (!ref || ref.startsWith("-")) throw new Error("Usage: node script/check-release-imports.cjs <commit-or-tree>");
    const result = checkGitTree(ref);
    for (const missing of result.missing) console.error(`MISSING ${missing}`);
    console.log(`Release import check: ${result.sourceCount} runtime source files; ${result.missing.length} unresolved local imports.`);
    if (result.missing.length) process.exitCode = 1;
  } catch (error) {
    console.error(`Release import check failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { unresolvedImports, checkGitTree };
