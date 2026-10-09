#!/usr/bin/env node
"use strict";

/* Reviewable, source-only Task overdue release. Run from a private operator directory. */
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function assertHash(file, expected) {
  if (crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") !== expected)
    throw new Error(`Unexpected deployment helper: ${path.basename(file)}`);
}
assertHash(path.join(__dirname, "deploy-notifications-pulse.cjs"),
  "e08b9db17583560330c7d0b84c534d559239fc557623869e7a112e764366cf7a");
assertHash(path.join(__dirname, "deploy-omni-task-hotfix.cjs"),
  "c42fbc665723ce7ea16460093c30b052c1ffd4095b88e538c925a3b1f52c1e34");
const deployer = require("./deploy-omni-task-hotfix.cjs");

const release = Object.freeze({
  base: "679bf1150e8f13182a1bf1bc7f934c4faddaad3c",
  parent: "6d4d30f0085bb2f1d8a1e046e6e81424594e8706",
  patchBase: "6d4d30f0085bb2f1d8a1e046e6e81424594e8706",
  commit: "ebd32c32eded042a1852e53fdc33334ea2e08d29",
  tree: "6b2760b0b81492911d142b487379d495a9e6872e",
  patchSha256: "8256a2f25ad8e8eee6a945b19ba0d855918ca1926ca7170f9a2f8f5740e5df11",
  paths: [
    "client/src/components/tasks/task-timing.tsx",
    "server/alert-evaluator.ts",
    "server/lib/automation-trigger-runtime.test.ts",
    "server/lib/event-bus.ts",
    "server/lib/task-overdue.test.ts",
    "server/lib/task-overdue.ts",
    "shared/task-deadline.ts",
  ],
  expectedHashes: {
    "client/src/components/tasks/task-timing.tsx": "c8386847daef8bb05e3a7e47f3a35c4e516f37276535ecca03459af2dc6b49e0",
    "server/alert-evaluator.ts": "d7641afdd101d959250362391ca5b9d9fcbf6992e4840b2b59da9c81981f789c",
    "server/lib/automation-trigger-runtime.test.ts": "1f4775a640288a454b908900aa67b44c0c972b1aa550b527f965fbdb1037b9b4",
    "server/lib/event-bus.ts": "87c06bf964aae16e57966b4aed9d598c586051969ca55cb82962898d75f70547",
    "server/lib/task-overdue.test.ts": "missing",
    "server/lib/task-overdue.ts": "missing",
    "shared/task-deadline.ts": "missing",
  },
});

async function main() {
  const options = deployer.parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Run --prepare first. After reviewing the report, run --apply --allow-restart.");
    return;
  }
  if (os.userInfo().username !== "seman" || os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" ||
      options.root !== "/var/www/indexus-crm") throw new Error("Run only as seman on CORPCRM01 in the production root");
  console.log(`Task overdue release: ${options.apply ? "APPLY (restarts PM2)" : "PREPARE only (no restart)"}`);
  console.log("No schema changes, database restore, git pull/reset, package installation or unrelated source promotion.");
  await deployer.deploy(options, { release, proof: { expectedHashes: release.expectedHashes } });
}

main().catch(error => {
  // Never print a child-process error object: it may include environment or message bodies.
  console.error("TASK_OVERDUE_DEPLOY_FAILED:", String(error.message || "unknown").slice(0, 250)
    .replace(/(https?:\/\/)[^/@\s]+@/gi, "$1[redacted]@")
    .replace(/((?:token|password|secret|authorization)[=:]\s*)[^\s&]+/gi, "$1[redacted]"));
  process.exitCode = 1;
});
