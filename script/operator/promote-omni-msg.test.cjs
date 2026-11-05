const test = require("node:test");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const release = require("./promote-omni-msg.cjs");
const complete = require("./promote-complete-replit.cjs");
const template = fs.readFileSync(path.join(__dirname, "promote-inbound-status-list.sh"), "utf8");
function fixture(head = release.BASE, change = () => undefined) {
  return args => {
    const override = change(args.join(" "));
    if (override !== undefined) return override;
    if (args.join(" ") === "rev-parse HEAD") return head;
    if (args.join(" ") === `rev-parse ${release.TARGET}^{tree}`) return release.TREE;
    if (args.join(" ") === `rev-parse ${release.TARGET}^`) return release.PARENT;
    if (args[0] === "merge-base") return "";
    if (args[0] === "diff") return (args[2] === release.BASE ? release.PREVIOUS_TOOL_FILES : release.FIX_FILES).join("\n");
    if (args[0] === "rev-parse" && args[1].includes(":")) return "unchanged-blob";
    throw Error("Unexpected fixture call: " + args.join(" "));
  };
}
test("only the two reviewed source baselines and exact MSG scope are accepted", () => {
  for (const base of [release.BASE, release.PARENT]) {
    const plan = release.validate(fixture(base), release.TARGET);
    assert.equal(plan.base, base);
    assert.equal(plan.paths.length, base === release.BASE ? 9 : 3);
  }
  assert.throws(() => release.validate(fixture("a".repeat(40)), release.TARGET), /HEAD changed/);
  assert.throws(() => release.validate(fixture(), "a".repeat(40)), /target/);
  for (const [query, value] of [
    [`rev-parse ${release.TARGET}^{tree}`, "wrong-tree"],
    [`rev-parse ${release.TARGET}^`, "wrong-parent"],
    [`diff --name-only ${release.PARENT} ${release.TARGET}`, release.FIX_FILES.concat("server/index.ts").join("\n")],
    [`rev-parse ${release.TARGET}:package.json`, "changed-dependency"],
    [`rev-parse ${release.TARGET}:shared/schema.ts`, "changed-schema"],
  ]) assert.throws(() => release.validate(fixture(release.BASE, key => key === query ? value : undefined), release.TARGET));
});
test("render preserves private disk staging, source guards, atomic backend swap and rollback, without frontend or database writes", () => {
  for (const base of [release.BASE, release.PARENT]) {
    const body = release.render(template, complete.render, release.validate(fixture(base), release.TARGET));
    assert.equal(cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status, 0);
    for (const required of ["/dev/sdb1", "0:0:700", 'sudo -u "$account"', 'e.code!=="EACCES"',
      'sudo mount --bind "$STORE/build" "$VIEW"', 'sudo umount -- "$VIEW"', 'sudo tar -cpf "$STORE/backup/dist.tar"',
      'npx --no-install tsx script/build-server.ts > build.log', "DATABASE_URL=postgresql://127.0.0.1:1/omni_deploy_test",
      'check_source "$BASE"', "VERIFY_APPLICATION_SOURCES", 'check_source "$TARGET"', "phase-result.txt",
      'git merge --ff-only "$TARGET"', 'git -C "$APP" reset --keep "$BASE"',
      'restore_file "$STORE/backup/index.cjs"', 'sudo mv -fT -- "$APP/dist/.index.cjs.next" "$APP/dist/index.cjs"',
      "pm2 restart indexus-crm", "wait_health", 'cmp "$APP/dist/public/index.html" "$VIEW/served.html"',
      release.RUNTIME.backend, release.RUNTIME.index, "NASADENIE_OK="])
      assert.ok(body.includes(required), required);
    for (const filename of release.TESTS) assert.ok(body.includes(filename));
    assert.ok(body.indexOf("tests.log") < body.indexOf("PHASE=zdroje"));
    assert.doesNotMatch(body, /pg_dump|pg_restore|DATABASE_BACKUP|npm run build|npm install|npm ci|db:push|reset --hard|git clean|VALIDATE_ASSETS|PHASE=staticke_subory|PHASE=vstupna_stranka/);
    // A backup may read the live index. Reject it as a write destination,
    // not merely as a source argument to install.
    assert.doesNotMatch(body, /(?:restore_file|sudo install|sudo mv|sudo cp)[^\n]*"\$APP\/dist\/public\/[^"]*"[ \t]*$/m);
    assert.ok(!body.includes('ln -s "$APP/.env"'));
  }
});
test("changed renderer sections fail closed rather than silently dropping protections", () => {
  const plan = release.validate(fixture(), release.TARGET);
  assert.throws(() => release.render(template + "# changed\n", complete.render, plan));
  assert.throws(() => release.once("a a", "a", "b"));
  assert.throws(() => release.removeSection("finish start", "start", "finish"));
});
test("a post-swap failure restores only the previous backend and source, while a pre-swap failure changes neither", () => {
  const body = release.render(template, complete.render, release.validate(fixture(), release.TARGET));
  const cleanup = body.slice(body.indexOf("cleanup() {"), body.indexOf("\ntrap cleanup EXIT"));
  const restore = body.slice(body.indexOf("restore_file() {"), body.indexOf("\ncleanup() {"));
  for (const changed of [0, 1]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-msg-rollback-"));
    const app = path.join(dir, "app"), store = path.join(dir, "private");
    fs.mkdirSync(path.join(app, "dist/public"), { recursive: true });
    fs.mkdirSync(path.join(store, "backup"), { recursive: true });
    fs.writeFileSync(path.join(app, "dist/index.cjs"), changed ? "new backend" : "old backend");
    fs.writeFileSync(path.join(app, "dist/public/index.html"), "unchanged frontend");
    fs.writeFileSync(path.join(store, "backup/index.cjs"), "old backend");
    const digest = value => require("node:crypto").createHash("sha256").update(value).digest("hex");
    const script = `
APP=$1
STORE=$2
VIEW=
MOUNTED=0
COMPLETED=0
PHASE=fixture_failure
BASE=${release.BASE}
TARGET=${release.TARGET}
APP_UID=$(id -u)
APP_GID=$(id -g)
OLD_BACKEND=${digest("old backend")}
OLD_INDEX=${digest("unchanged frontend")}
RUNTIME_CHANGED=$3
SOURCE_CHANGED=$3
sudo() { "$@"; }
git() {
  if [[ "$*" == *"rev-parse HEAD" ]]; then echo "$TARGET";
  elif [[ "$*" == *"reset --keep $BASE" ]]; then echo source_return >> "$APP/actions";
  else return 91; fi
}
pm2() { echo restart >> "$APP/actions"; }
wait_health() { echo health >> "$APP/actions"; }
${restore}
${cleanup}
(exit 7)
cleanup
`;
    try {
      const result = cp.spawnSync("bash", ["-s", "--", app, store, String(changed)], { input: script, encoding: "utf8" });
      assert.equal(result.status, 7, result.stderr);
      assert.equal(fs.readFileSync(path.join(app, "dist/index.cjs"), "utf8"), "old backend");
      assert.equal(fs.readFileSync(path.join(app, "dist/public/index.html"), "utf8"), "unchanged frontend");
      assert.match(fs.readFileSync(path.join(store, "phase-result.txt"), "utf8"), /PHASE=fixture_failure\nEXIT=7/);
      if (changed) {
        assert.match(result.stderr, /POVODNA_VERZIA_OBNOVENA=/);
        assert.equal(fs.readFileSync(path.join(app, "actions"), "utf8"), "source_return\nrestart\nhealth\n");
      } else assert.ok(!fs.existsSync(path.join(app, "actions")));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
test("real file and stdin invocations cannot silently claim deployment success", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-msg-entry-"));
  try {
    const blocked = path.join(dir, "block.cjs");
    fs.writeFileSync(blocked, 'require("node:child_process").execFileSync=()=>{throw Error("BLOCKED_GIT");};\n');
    const runner = path.join(__dirname, "promote-omni-msg.cjs");
    const invocation = cp.spawnSync(process.execPath, ["--require", blocked, runner, "--apply", release.TARGET], { encoding: "utf8" });
    assert.equal(invocation.status, 1); assert.match(invocation.stderr, /BLOCKED_GIT/);
    const wrong = cp.spawnSync(process.execPath, [runner], { encoding: "utf8" });
    assert.equal(wrong.status, 1); assert.match(wrong.stderr, /Use --apply/);
    const stdin = cp.spawnSync(process.execPath, ["--require", blocked, "-", "--apply", release.TARGET], {
      input: fs.readFileSync(runner, "utf8"), encoding: "utf8",
    });
    assert.equal(stdin.status, 1); assert.match(stdin.stderr, /BLOCKED_GIT/);
    assert.doesNotMatch(stdin.stdout, /OMNI_MSG_TARGET|NASADENIE_OK/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
