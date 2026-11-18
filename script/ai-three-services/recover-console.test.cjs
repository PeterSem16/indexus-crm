"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const cp = require("node:child_process");
const { prepareRecovery, INPUTS } = require("./recover-console.cjs");
test("isolated recovery launches the original report with the exact existing preload and no service reconfiguration", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "three-console-test-"));
  try {
    const files = path.join(directory, "fixture"), app = path.join(directory, "app");
    const home = path.join(directory, "home");
    fs.mkdirSync(path.join(files, "script/ai-three-services"), { recursive: true });
    fs.mkdirSync(path.join(app, "node_modules"), { recursive: true });
    fs.mkdirSync(home);
    for (const file of ["run.ts", "run-safety.ts"])
      fs.writeFileSync(path.join(files, "script/ai-three-services", file), "// synthetic test file");
    const archive = cp.execFileSync("tar", ["-c", "-C", files, "script"]);
    const originalReport = path.join(home, "old-report.json");
    fs.writeFileSync(originalReport, "");
    let invoked = false;
    const result = prepareRecovery({ app, home, archive, originalReport,
      env: { INDEXUS_AI_GATEWAY_TOKEN: "SYNTHETIC_NEVER_LOG", NODE_ENV: "development" },
      execute: (node, args, options) => {
        invoked = true; assert.equal(node, process.execPath);
        assert.deepEqual(args.slice(0, 4), ["--require", "/etc/indexus-ai-runtime/preload.cjs", "--import", "tsx"]);
        assert.deepEqual(args.slice(-2), ["--recover-before-first-case", originalReport]);
        assert.equal(options.env.NODE_ENV, "production");
        assert.equal(options.env.INDEXUS_AI_GATEWAY_TOKEN, "SYNTHETIC_NEVER_LOG");
        assert.equal(fs.realpathSync(path.join(options.cwd, "node_modules")), path.join(app, "node_modules"));
        assert.ok(options.cwd.startsWith(home + "/INDEXUS-AI-Three-Services-Recovery-"));
        assert.equal(fs.statSync(path.dirname(options.cwd)).mode & 0o777, 0o700);
        return { status: 0 };
      } });
    assert.equal(invoked, true); assert.equal(result.status, 0);
    let smokeReport;
    prepareRecovery({ app, home, archive, mode: "--smoke-three",
      execute: (_node, args, options) => {
        assert.equal(args.at(-2), "--smoke-three");
        smokeReport = args.at(-1);
        assert.equal(smokeReport, path.join(path.dirname(options.cwd), "three-services-smoke.json"));
        assert.notEqual(smokeReport, originalReport);
        assert.equal(fs.existsSync(smokeReport), false);
        return { status: 0 };
      } });
    assert.ok(smokeReport);
    prepareRecovery({ app, home, archive, mode: "--checklist-sk-retest",
      execute: (_node, args, options) => {
        assert.equal(args.at(-2), "--checklist-sk-retest");
        assert.equal(args.at(-1), path.join(path.dirname(options.cwd), "task-checklist-sk-retest.json"));
        assert.equal(args.includes("--smoke-three"), false);
        assert.equal(fs.existsSync(args.at(-1)), false);
        return { status: 0 };
      } });
    assert.throws(() => prepareRecovery({ app, home, archive, mode: "--run-81", execute() {} }),
      /THREE_CONSOLE_MODE_INVALID/);
    assert.equal(fs.statSync(originalReport).size, 0);
    assert.ok(INPUTS.includes("script/ai-email-monitoring-b1/runtime.cjs"));
    assert.equal(INPUTS.includes("script/ai-email-monitoring-b1/b11-check.cjs"), false);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
