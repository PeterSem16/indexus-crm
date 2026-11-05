const test = require("node:test");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const release = require("./promote-omni-accounts.cjs");
function fixture(args, raw = false) {
  if (args.join(" ") === "rev-parse HEAD") return release.BASE;
  const output = cp.execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return raw ? output : output.trimEnd();
}
test("exact production baseline and complete finished Omni release validate", () => {
  const plan = release.validate(fixture, release.TARGET);
  assert.equal(plan.paths.length, 46);
  for (const filename of ["shared/schema.ts", "server/index.ts", "server/lib/omni-export-graph.ts",
    "client/src/pages/email-client.tsx", "e2e/omni-account-visibility.browser.test.mjs"])
    assert.ok(plan.paths.includes(filename));
  assert.ok(!plan.paths.some(filename => /automation/.test(filename)));
});
test("rendered operator preserves private staging, backups, guards and rollback", () => {
  const body = release.render(fixture, release.validate(fixture, release.TARGET));
  assert.equal(cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status, 0);
  for (const value of ["/dev/sdb1", release.OLD_BACKEND, release.OLD_INDEX, String(release.OLD_PID),
    'git merge --ff-only "$TARGET"', 'check_source "$BASE"', 'check_source "$TARGET"',
    'git archive --format=tar --output="$VIEW/source.tar"', 'cd "$VIEW" && NODE_OPTIONS=',
    'sudo chmod 600 "$STORE/release.txt" "$STORE/backup/dist.tar"',
    'pg_dump",["--format=custom"', 'pg_restore",["--list"',
    "sudo -u", 'e.code!=="EACCES"', "DATABASE_URL=postgresql://127.0.0.1:1/omni_deploy_test",
    "BEGIN READ ONLY", "LIMIT 0", "OMNI_DATABAZA_OK", "NASADENIE_OK=",
    'grep -n -B 3 -A 30 \'^not ok\' "$VIEW/tests.log"', "TESTY_LOG=$STORE/build/tests.log"])
    assert.ok(body.includes(value), value);
  for (const filename of release.TESTS) assert.ok(body.includes(filename));
  assert.ok(body.indexOf("OMNI_DATABAZA_OK") < body.indexOf("PHASE=vstupna_stranka"));
  assert.ok(body.indexOf("ZALOHA_DATABAZY_OK") < body.indexOf("PHASE=zostavenie"));
  assert.match(body, /git -C "\$APP" reset --keep "\$BASE"/);
  assert.match(body, /databazu neobnovujem/);
  assert.doesNotMatch(body, /reset --hard|git clean|npm install|npm ci|db:push|--clean/);
});
test("a failing test remains visible even when later passing tests fill the log tail", () => {
  const body = release.render(fixture, release.validate(fixture, release.TARGET));
  const handler = body.split("\n").find(line => line.includes("grep -n -B 3 -A 30 '^not ok'"));
  assert.ok(handler);
  const directory = fs.mkdtempSync(require("node:path").join(require("node:os").tmpdir(), "omni-test-report-"));
  try {
    fs.writeFileSync(directory + "/tests.log",
      "not ok 1 - delayed cleanup fixture\n  error: fixture cleanup deadline\n" + "ok - later fixture\n".repeat(80));
    const result = cp.spawnSync("bash", ["-c",
      'set -u\nVIEW=$1; STORE=$2\nstop() { echo "STOP: $*" >&2; exit 7; }\n' + handler,
      "test-report", directory, "/private/recovery"], { encoding: "utf8" });
    assert.equal(result.status, 7);
    assert.match(result.stdout, /not ok 1 - delayed cleanup fixture/);
    assert.match(result.stdout, /fixture cleanup deadline/);
    assert.match(result.stderr, /TESTY_LOG=\/private\/recovery\/build\/tests.log/);
    assert.match(result.stderr, /STOP: Testy zlyhali; nasadenie zastavene/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test("wrong HEAD, target, parent, tree, dependencies, whitelist, patch or renderer stop", () => {
  assert.throws(() => release.validate(fixture, "wrong-target"));
  for (const [command, output] of [
    ["rev-parse HEAD", "unexpected-head"],
    [`rev-parse ${release.TARGET}^`, "wrong-parent"],
    [`rev-parse ${release.TARGET}^{tree}`, "wrong-tree"],
    [`rev-parse ${release.TARGET}:package.json`, "changed-dependencies"],
    [`rev-parse ${release.TARGET}:package-lock.json`, "changed-lock"],
    [`diff --name-only ${release.BASE} ${release.TARGET}`, "server/automation.ts"],
  ]) assert.throws(() => release.validate((args, raw) =>
    args.join(" ") === command ? output : fixture(args, raw), release.TARGET));
  assert.throws(() => release.validate((args, raw) =>
    args[0] === "diff" && args.includes("--binary") ? "altered-patch" : fixture(args, raw), release.TARGET));
  const plan = release.validate(fixture, release.TARGET);
  assert.throws(() => release.render(() => "altered-renderer", plan));
  assert.throws(() => release.render(fixture, { ...plan, paths: ["server/automation.ts"] }));
});
test("real file and stdin entry points refuse missing arguments without running deployment", () => {
  const filename = "script/operator/promote-omni-accounts.cjs";
  for (const [args, input] of [[[filename], undefined], [["-"], fs.readFileSync(filename, "utf8")]]) {
    const result = cp.spawnSync(process.execPath, args, { input, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`Use --apply ${release.TARGET}`));
    assert.equal(result.stdout, "");
  }
});
test("database readiness is read-only, checks actual types, closes connections and redacts errors", async () => {
  const vm = require("node:vm");
  const body = release.render(fixture, release.validate(fixture, release.TARGET));
  const source = body.match(/<<'VERIFY_OMNI_DATABASE'\n([\s\S]*?)\nVERIFY_OMNI_DATABASE/)[1];
  const expected = [["user_id", 1043], ["groups", 3802], ["revision", 23], ["updated_at", 1184]];
  for (const mode of ["ready", "wrong-types", "missing-table"]) {
    const queries = [], output = [], processStub = { argv: ["node", "-", "/fake/app", "123"], exitCode: 0 };
    let closed = false;
    class Client {
      constructor(options) {
        assert.equal(options.connectionString, "postgresql://127.0.0.1:1/unit");
        assert.equal(options.statement_timeout, 5000);
      }
      async connect() {}
      async query(sql) {
        queries.push(sql);
        if (sql.startsWith("SELECT")) {
          if (mode === "missing-table") throw Error("private-provider-detail");
          return { fields: expected.map(([name, dataTypeID]) => ({
            name, dataTypeID: mode === "wrong-types" ? 25 : dataTypeID,
          })), rows: [] };
        }
        return {};
      }
      async end() { closed = true; }
    }
    await vm.runInNewContext(source, {
      process: processStub,
      console: { log: value => output.push(value), error: value => output.push(value) },
      require: name => {
        if (name === "node:fs") return {
          existsSync: () => false,
          readFileSync: filename => {
            assert.equal(filename, "/proc/123/environ");
            return "DATABASE_URL=postgresql://127.0.0.1:1/unit\0";
          },
        };
        if (name === "/fake/app/node_modules/pg") return { Client };
        if (name === "node:path") return require(name);
        throw Error("Unexpected module");
      },
    });
    assert.ok(closed);
    assert.equal(queries[0], "BEGIN READ ONLY");
    assert.match(queries[1], /^SELECT .* LIMIT 0$/);
    assert.ok(queries.every(sql => /^(BEGIN READ ONLY|SELECT|ROLLBACK)/.test(sql)));
    assert.equal(processStub.exitCode, mode === "ready" ? 0 : 1);
    assert.equal(output.length, 1);
    assert.doesNotMatch(output.join(""), /private-provider-detail|postgresql/);
    if (mode === "ready") assert.equal(queries.at(-1), "ROLLBACK");
  }
});
