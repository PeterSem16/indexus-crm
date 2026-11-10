const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const cp = require("node:child_process");
const vm = require("node:vm");
const path = require("node:path");
const release = require("./promote-daily-callback-release.cjs");
const target = "a".repeat(40);
const project = path.resolve(__dirname, "../..");
// Both fixtures are pinned and hashed by the production renderer. No production
// database, live Git ref, PM2 process or privileged operation is used by tests.
const renderer = fs.readFileSync(path.join(project, "script/operator/promote-complete-replit.cjs"), "utf8");
const template = fs.readFileSync(path.join(project, "script/operator/promote-inbound-status-list.sh"), "utf8");
const applicationPaths = [
  "client/src/components/bank-account-section.test.tsx",
  "client/src/components/bank-account-section.tsx",
  "client/src/components/campaigns/ContactLoadReview.tsx",
  "client/src/components/campaigns/contact-load-model.test.ts",
  "client/src/components/campaigns/contact-load-model.ts",
  "client/src/components/campaigns/contact-load-translations.ts",
  "client/src/components/campaigns/use-contact-loads.test.ts",
  "client/src/components/campaigns/use-contact-loads.ts",
  "client/src/components/clinic-create-agreements.tsx",
  "client/src/components/clinic-form-wizard.tsx",
  "client/src/components/clinic-representative-panel.tsx",
  "client/src/components/collaborator-form-wizard.tsx",
  "client/src/components/institution-personnel-panel.tsx",
  "client/src/components/nexus/omni-task-queue-header.css",
  "client/src/components/representative-distribution-panel.tsx",
  "client/src/components/representative-region-suggestions.tsx",
  "client/src/components/suggest-region-button.tsx",
  "client/src/i18n/clinic-banking-copy.ts",
  "client/src/i18n/clinic-creation-copy.ts",
  "client/src/i18n/representative-assist-copy.ts",
  "client/src/i18n/representative-distribution-copy.ts",
  "client/src/i18n/translations.ts",
  "client/src/pages/bulk-assign.tsx",
  "client/src/pages/campaign-detail.tsx",
  "client/src/pages/email-client.tsx",
  "e2e/clinic-banking.browser.test.mjs",
  "e2e/clinic-create.browser.test.mjs",
  "e2e/mission-contact-load-fixture.mjs",
  "e2e/mission-contact-loads.browser.test.mjs",
  "e2e/omni-task-header.browser.test.mjs",
  "e2e/representative-distribution.browser.test.mjs",
  "script/operator/diagnose-clinic-callback.cjs",
  "script/operator/diagnose-clinic-callback.test.cjs",
  "script/operator/promote-omni-selection.cjs",
  "script/operator/promote-omni-selection.test.cjs",
  "server/index.ts",
  "server/lib/clinic-banking.db.test.ts",
  "server/lib/mission-contact-load-file.ts",
  "server/lib/mission-contact-load-plan.ts",
  "server/lib/mission-contact-load-routes.ts",
  "server/lib/mission-contact-loads.db.test.ts",
  "server/lib/mission-contact-loads.test.ts",
  "server/lib/mission-contact-loads.ts",
  "server/lib/region-suggestion.test.ts",
  "server/lib/region-suggestion.ts",
  "server/lib/representative-distribution.db.test.ts",
  "server/lib/representative-distribution.ts",
  "server/lib/representative-plan-schema.ts",
  "server/lib/representative-region-suggestions.test.ts",
  "server/lib/representative-region-suggestions.ts",
  "server/lib/status-list-callback-transition.db.test.ts",
  "server/lib/status-list-callback-transition.ts",
  "server/representative-distribution-routes.ts",
  "server/representative-routes.ts",
  "server/representative-suggestion-routes.test.ts",
  "server/routes.ts",
  "shared/bank-account.test.ts",
  "shared/bank-account.ts",
  "shared/medical-partner-filter.ts",
  "shared/representative-region-filter.ts",
  "shared/schema.ts",
].sort();
function git(args, raw) {
  const key = args.join(" ");
  if (key === "rev-parse HEAD") return release.BASE;
  if (key === `rev-parse ${target}^`) return release.APPLICATION;
  if (key === `rev-parse ${release.APPLICATION}^{tree}`) return release.APPLICATION_TREE;
  if (args[0] === "merge-base") return "";
  if (args[0] === "rev-parse") return "unchanged-dependency-blob";
  if (args.includes("--diff-filter=D")) return "";
  if (key === `diff --name-only ${release.BASE} ${release.APPLICATION}`) return applicationPaths.join("\n");
  if (key === `diff --name-only ${release.APPLICATION} ${target}`) return release.TOOLS.join("\n");
  if (key === `diff --name-only ${release.BASE} ${target}`) return [...applicationPaths, ...release.TOOLS].sort().join("\n");
  if (args[0] === "show" && args[1].endsWith("promote-complete-replit.cjs")) return renderer;
  if (args[0] === "show" && args[1].endsWith("promote-inbound-status-list.sh")) return template;
  throw Error("Unexpected test Git call: " + key);
}
test("exact daily whitelist and helper-only child are admitted; unknown source changes are rejected", () => {
  assert.equal(release.validate(git, target).paths.length, 63);
  for (const [needle, replacement] of [
    ["rev-parse HEAD", "changed"],
    [`rev-parse ${target}^`, "changed"],
    [`rev-parse ${release.APPLICATION}^{tree}`, "changed"],
    [`diff --name-only ${release.BASE} ${release.APPLICATION}`, applicationPaths.join("\n") + "\n.env"],
    [`diff --name-only ${release.APPLICATION} ${target}`, release.TOOLS.join("\n") + "\nserver/routes.ts"],
    [`rev-parse ${target}:package.json`, "changed"],
    [`rev-parse ${target}:script/build.ts`, "changed"],
    [`diff --name-only --diff-filter=D ${release.BASE} ${target}`, "shared/schema.ts"],
  ]) {
    assert.throws(() => release.validate((args, raw) => args.join(" ") === needle ? replacement : git(args, raw), target), needle);
  }
});
test("generated shell and embedded Node parse with private DB backup, source and runtime protection", () => {
  const body = release.render(git, release.validate(git, target));
  const syntax = cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);
  for (const marker of ["DATABASE_BACKUP", "VERIFY_APPLICATION_SOURCES", "DAILY_APPROVAL"]) {
    const payload = body.split(`<<'${marker}'\n`)[1]?.split(`\n${marker}`)[0];
    assert.ok(payload, marker);
    assert.doesNotThrow(() => new vm.Script(payload), marker);
  }
  for (const marker of ["/dev/sdb1", "0:0:700", "EACCES", "pg_dump", "pg_restore", "database.dump",
    "callback-approvals.json", 'approval_check "$PID" capture', 'approval_check "$NEW_PID" verify',
    "CALLBACK_SCHVALENIA_NEZMENENE", "DOPLNKOVA_SCHEMA_OK", "VERIFY_APPLICATION_SOURCES",
    "e.watch", "failure.txt", "flock -n 9", "git merge --ff-only", "git -C",
    "reset --keep", release.RUNTIME.backend, release.RUNTIME.index]) {
    assert.ok(body.includes(marker), marker);
  }
  assert.ok(body.indexOf("pg_dump") < body.indexOf('approval_check "$PID" capture'));
  assert.ok(body.indexOf('approval_check "$PID" capture') < body.indexOf("npm run build"));
  assert.ok(body.indexOf("npm run build") < body.indexOf("PHASE=zdroje"));
  assert.ok(body.indexOf('approval_check "$NEW_PID" verify') < body.indexOf("COMPLETED=1"));
  assert.match(body, /READ ONLY/);
  assert.match(body, /DATABASE_URL=postgresql:\/\/127\.0\.0\.1:1\/daily_release_unit/);
  assert.doesNotMatch(body, /npm install|npm ci|db:push|DROP TABLE|reset --hard|git clean|pg_restore[^\n]*--clean/);
  assert.doesNotMatch(body.match(/npx --no-install tsx --test ([^\n]+)/)[1], /\.db\.test/);
  assert.equal(body.split("set -Eeuo pipefail").length, 2);
  assert.throws(() => release.render((args, raw) => args[0] === "show" ? "changed" : git(args, raw),
    release.validate(git, target)), /renderer changed/);
});
test("real Node file and stdin entry points never silently succeed with missing arguments", () => {
  for (const args of [[], ["--apply", "wrong"]]) {
    const run = cp.spawnSync(process.execPath, [require.resolve("./promote-daily-callback-release.cjs"), ...args], { encoding: "utf8" });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /STOP: Use --apply/);
  }
  const run = cp.spawnSync(process.execPath, ["-"], {
    input: fs.readFileSync(require.resolve("./promote-daily-callback-release.cjs")), encoding: "utf8",
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /STOP: Use --apply/);
});

test("approval capture/verification is read-only and rejects changed approvals or missing schema", async () => {
  const body = release.render(git, release.validate(git, target));
  const payload = body.split("<<'DAILY_APPROVAL'\n")[1].split("\nDAILY_APPROVAL")[0];
  const saved = new Map(), queries = [], messages = [];
  let fingerprint = "reviewed", missingSchema = false, ended = 0;
  async function execute(mode) {
    const processState = { argv: ["node", "-", "/app", "/backup", "123", mode], exitCode: 0 };
    const fixtureFs = {
      readFileSync(name) {
        if (name === "/proc/123/environ") return "DATABASE_URL=postgresql://127.0.0.1:1/fixture\0";
        if (!saved.has(name)) throw Error("Unexpected read");
        return saved.get(name);
      },
      writeFileSync(name, bytes, options) {
        assert.equal(options.mode, 0o600);
        assert.equal(options.flag, "wx");
        assert.equal(saved.has(name), false);
        saved.set(name, bytes);
      },
    };
    class Client {
      async connect() {}
      async end() { ended++; }
      async query(sql) {
        queries.push(sql);
        assert.match(sql, /^(BEGIN|SET LOCAL|SELECT|COMMIT)/);
        if (sql.includes("SELECT * FROM mission_callback_ownership"))
          return { rows: [{ owner: "compatible", fingerprint }] };
        if (sql.includes("SELECT * FROM mission_callback_candidates"))
          return { rows: [{ source_fingerprint: fingerprint, definition: { action: { id: "approved" } } }] };
        if (missingSchema && sql.includes("FROM clinics")) throw Error("Fixture column missing");
        return { rows: [] };
      }
    }
    const context = vm.createContext({
      process: processState,
      console: { log: message => messages.push(message), error: message => messages.push(message) },
      require(name) {
        if (name === "node:fs") return fixtureFs;
        if (name === "node:path") return path;
        if (name === "node:crypto") return require("node:crypto");
        if (name === "/app/node_modules/pg") return { Client };
        throw Error("Unexpected dependency: " + name);
      },
    });
    await new vm.Script(payload).runInContext(context);
    return processState.exitCode;
  }
  assert.equal(await execute("capture"), 0);
  assert.equal(queries.some(sql => sql.includes("FROM clinics")), false);
  assert.equal(await execute("verify"), 0);
  assert.ok(messages.includes("DOPLNKOVA_SCHEMA_OK"));
  assert.ok(queries.some(sql => sql.includes("FROM representative_distribution_items")));
  fingerprint = "changed";
  assert.equal(await execute("verify"), 1);
  fingerprint = "reviewed";
  missingSchema = true;
  assert.equal(await execute("verify"), 1);
  assert.equal(ended, 4, "all check connections are closed, including failures");
  assert.doesNotMatch(queries.join("\n"), /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/);
});
