#!/usr/bin/env node
/**
 * Prepare and commit a LOCAL release worktree. Never pushes or deploys.
 * Production runtime files, uploaded backups, and design sandboxes are excluded.
 */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOTS = ["client", "server", "shared", "script", "scripts", "e2e"];
const ROOT_FILES = [
  ".gitignore", "package.json", "package-lock.json", "tsconfig.json", "vite.config.ts",
  "tailwind.config.ts", "postcss.config.js", "components.json", "drizzle.config.ts",
];
const RELEASE_DOC = "docs/releases/indexus-consolidation.md";
const EXCLUDED = /(?:^|\/)(?:node_modules|dist|\.env(?:\.[^/]*)?)(?:\/|$)|^(?:data|uploads|attached_assets|artifacts|server\/(?:data|uploads))(?:\/|$)/;
const SOURCE_EXTENSION = /\.(?:ts|tsx|js|jsx|cjs|mjs|css|scss|json|svg|sh|md)$/;

function git(args, cwd = ROOT) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
}

function approvedPath(relative) {
  if (relative.includes("\\") || relative.startsWith("/") || relative.split("/").includes("..")) return false;
  if (ROOT_FILES.includes(relative) || relative === RELEASE_DOC) return true;
  return SOURCE_ROOTS.some(root => relative.startsWith(`${root}/`))
    && SOURCE_EXTENSION.test(relative) && !EXCLUDED.test(relative);
}

function sourcePaths(base) {
  const scope = [...SOURCE_ROOTS, ...ROOT_FILES, RELEASE_DOC];
  const changed = git(["diff", "--name-only", "-z", base, "--", ...scope]).split("\0").filter(Boolean);
  const added = git(["ls-files", "--others", "--exclude-standard", "-z", "--", ...scope]).split("\0").filter(Boolean);
  return [...new Set([...changed, ...added])].filter(approvedPath).sort();
}

function fileHash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function prepare(options) {
  const base = git(["rev-parse", `${options.base}^{commit}`]);
  const expectedBase = options.expectedBase;
  if (expectedBase && base !== expectedBase) throw new Error("Release base changed; review it before preparing again");
  const branch = options.branch;
  if (git(["branch", "--list", branch])) throw new Error(`Local branch already exists: ${branch}`);
  const target = path.resolve(options.target);
  if (fs.existsSync(target)) throw new Error("Target directory already exists");

  const paths = sourcePaths(base);
  if (!paths.length) throw new Error("No reviewed source changes to prepare");
  const records = paths.map(relative => {
    const source = path.join(ROOT, relative);
    if (!fs.existsSync(source)) return { path: relative, action: "delete" };
    if (!fs.lstatSync(source).isFile()) throw new Error(`Unsupported source entry: ${relative}`);
    return { path: relative, action: "copy", sha256: fileHash(source) };
  });
  git(["worktree", "add", "-b", branch, target, base]);
  for (const record of records) {
    const destination = path.join(target, record.path);
    if (record.action === "delete") {
      fs.rmSync(destination, { force: true });
    } else {
      if (fileHash(path.join(ROOT, record.path)) !== record.sha256) {
        throw new Error(`Source changed during preparation: ${record.path}`);
      }
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(ROOT, record.path), destination);
      if (fileHash(destination) !== record.sha256) throw new Error(`Copy verification failed: ${record.path}`);
    }
  }
  for (const record of records) {
    if (record.action === "copy" && fileHash(path.join(ROOT, record.path)) !== record.sha256) {
      throw new Error(`Source changed before commit: ${record.path}`);
    }
  }

  // Existing local dependencies are used only for verification, never committed.
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(target, "node_modules"), "dir");
  git(["add", "--", ...paths], target);
  const stagedPaths = git(["diff", "--cached", "--name-only", "-z"], target).split("\0").filter(Boolean);
  if (!stagedPaths.every(approvedPath)) throw new Error("Unexpected release file was staged");
  git(["diff", "--cached", "--check"], target);
  const message = "Consolidate completed INDEXUS and standalone Automation with native styling";
  git(["commit", "-m", message], target);
  const commit = git(["rev-parse", "HEAD"], target);
  const manifest = { base, commit, branch, target, published: false, paths: records };
  const manifestPath = path.join(os.tmpdir(), `indexus-consolidation-${commit.slice(0, 12)}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  return { base, commit, branch, target, manifestPath, changedFiles: stagedPaths.length, published: false };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--base", "--expected-base", "--branch", "--target"].includes(args[i]) || !args[i + 1]) {
      throw new Error("Usage: --base <ref> --expected-base <sha> --branch <local-branch> --target <new-directory>");
    }
    values[args[i].slice(2)] = args[i + 1];
  }
  const result = prepare({
    base: values.base || "origin/main",
    expectedBase: values["expected-base"],
    branch: values.branch || "release/indexus-consolidated",
    target: values.target || path.join(os.tmpdir(), "indexus-consolidated-release"),
  });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { approvedPath, prepare, sourcePaths };