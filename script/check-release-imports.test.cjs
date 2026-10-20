const assert = require("node:assert/strict");
const { unresolvedImports, checkGitTree } = require("./check-release-imports.cjs");

const files = new Set([
  "client/src/main.tsx", "client/src/i18n/copy.ts", "client/src/ui/index.tsx",
  "shared/model.ts", "attached_assets/logo.png", "server/module.ts",
]);
const source = content => [{ file: "client/src/main.tsx", content }];
assert.deepEqual(unresolvedImports(files, source(`
  import copy from "./i18n/copy";
  import UI from "@/ui";
  import model from "@shared/model";
  import logo from "@assets/logo.png?url";
  import React from "react";
  import fs from "node:fs";
  import("@shared/model");
`)), []);
assert.deepEqual(unresolvedImports(files, source(`
  import { missing } from "./draft-only";
  import("./draft-only");
  require("@/missing");
`)), [
  "client/src/main.tsx -> ./draft-only",
  "client/src/main.tsx -> @/missing",
]);
assert.deepEqual(unresolvedImports(files, [
  { file: "server/main.ts", content: 'import "./module.js";' },
  { file: "server/fixture.test.ts", content: 'import "./intentional-test-missing";' },
]), []);

// Regression: the old selective release resolves in a dirty workspace, but
// its own Git tree lacks these five dependencies. Local draft files cannot help.
const broken = checkGitTree("785f07ec42db831fc542fddf9d537c8f44c08c21");
assert.equal(broken.missing.length, 5);
assert.ok(broken.missing.some(line => line.endsWith(" -> ./automation-eligibility-translations")));
assert.ok(broken.missing.some(line => line.endsWith(" -> ./lib/chat-analysis-outbox")));
assert.equal(checkGitTree("0b1bc1c12ea690cd3db2fb01369a7f7dbe370a5e").missing.length, 0);
console.log("Release import checks passed: aliases, dynamic imports, original production baseline and incomplete-release regression.");
