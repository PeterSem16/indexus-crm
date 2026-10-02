const assert = require("node:assert/strict");
const { test } = require("node:test");
const { approvedPath } = require("./prepare-consolidated-release.cjs");

test("release allowlist includes application source and verification", () => {
  for (const file of [
    "client/src/pages/automations.tsx", "server/routes.ts", "shared/schema.ts",
    "script/test-automation-indexus-browser.cjs", "package.json",
    "client/src/data/cla-template.ts",
    "docs/releases/indexus-consolidation.md",
  ]) assert.equal(approvedPath(file), true, file);
});

test("release allowlist excludes credentials, live data, archives and experimental artifacts", () => {
  for (const file of [
    ".env", ".env.production", "server/.env", "server/.env.production",
    "data/customers.json", "uploads/contract.pdf", "attached_assets/production-source.tar.gz",
    "artifacts/mockup-sandbox/src/automation.tsx", "client/node_modules/pkg/index.js",
    "server/data/private.json", "client/dist/index.js", "../server/routes.ts",
    "/server/routes.ts", ".agents/memory/MEMORY.md", "screenshots/proposal.png",
  ]) assert.equal(approvedPath(file), false, file);
});