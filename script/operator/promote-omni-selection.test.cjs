const test = require("node:test");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const release = require("./promote-omni-selection.cjs");
const complete = require("./promote-complete-replit.cjs");
const frontend = require("./promote-status-list-ergonomics.cjs");
const template = fs.readFileSync(path.join(__dirname, "promote-inbound-status-list.sh"), "utf8");
function fixture(head = release.BASE, override = () => undefined) {
  return args => {
    const changed = override(args.join(" "));
    if (changed !== undefined) return changed;
    if (args.join(" ") === "rev-parse HEAD") return head;
    if (args.join(" ") === `rev-parse ${release.TARGET}^{tree}`) return release.TREE;
    if (args.join(" ") === `rev-parse ${release.TARGET}^`) return release.PARENT;
    if (args.join(" ") === `rev-parse ${release.PARENT}^`) return release.BASE;
    if (args[0] === "diff") return (args[2] === release.BASE ? release.TOOL_FILES : release.UI_FILES).join("\n");
    if (args[0] === "rev-parse" && args[1].includes(":")) return "unchanged";
    throw Error("Unexpected fixture: " + args.join(" "));
  };
}
const render = base => release.render(template, complete, frontend, release.validate(fixture(base), release.TARGET));
test("exact target and both reviewed production source baselines validate", () => {
  for (const base of [release.BASE, release.PARENT]) {
    const plan = release.validate(fixture(base), release.TARGET);
    assert.equal(plan.base, base);
    assert.equal(plan.paths.length, base === release.BASE ? 8 : 6);
  }
  assert.throws(() => release.validate(fixture("a".repeat(40)), release.TARGET), /HEAD/);
  assert.throws(() => release.validate(fixture(), "main"), /release/);
  for (const [query, result] of [
    [`rev-parse ${release.TARGET}^{tree}`, "wrong-tree"],
    [`rev-parse ${release.TARGET}^`, "wrong-parent"],
    [`rev-parse ${release.PARENT}^`, "wrong-base"],
    [`diff --name-only ${release.PARENT} ${release.TARGET}`, release.UI_FILES.concat("server/index.ts").join("\n")],
    [`rev-parse ${release.TARGET}:server`, "different-backend"],
    [`rev-parse ${release.TARGET}:package.json`, "different-dependencies"],
  ]) assert.throws(() => release.validate(fixture(release.BASE, key => key === query ? result : undefined), release.TARGET));
});
test("generated shell backs up privately, preserves assets and backend, and includes the complete frontend pipeline", () => {
  for (const base of [release.BASE, release.PARENT]) {
    const body = render(base);
    assert.equal(cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status, 0);
    for (const marker of ["/dev/sdb1", "0:0:700", 'sudo -u "$account"', 'e.code!=="EACCES"',
      'sudo mount --bind "$STORE/build" "$VIEW"', 'sudo umount -- "$VIEW"', "VERIFY_APPLICATION_SOURCES",
      "VALIDATE_ASSETS", 'check_source "$BASE"', 'check_source "$TARGET"', 'git merge --ff-only "$TARGET"',
      'git -C "$APP" reset --keep "$BASE"', "phase-result.txt", release.OLD_INDEX,
      "microsoft.graph.fileAttachment/contentId", "tailwind.config.ts postcss.config.js",
      'sudo install -m 600 "$APP/dist/public/index.html" "$STORE/backup/index.html"',
      'sudo sha256sum "$STORE/backup/index.html"', 'OLD_HTML=$(base64 -w0 dist/public/index.html)',
      "NODE_ENV=production npx --no-install vite build", "cp -a --update=none",
      '[[ "$(process_pid)" == "$PID" ]]', "BACKEND_BEZ_RESTARTU=$PID", "NASADENIE_OK="])
      assert.ok(body.includes(marker), marker);
    for (const filename of release.TESTS) assert.ok(body.includes(filename));
    assert.ok(body.indexOf("PHASE=zaloha_frontendu") < body.indexOf("PHASE=zostavenie"));
    assert.ok(body.indexOf("tests.log") < body.indexOf("PHASE=zdroje"));
    assert.doesNotMatch(body, /pg_dump|pg_restore|DATABASE_BACKUP|pm2 restart|npm run build|npm install|npm ci|db:push|reset --hard|git clean|PHASE=backend/);
    assert.doesNotMatch(body, /sudo (?:install|mv|cp)[^\n]*"\$APP\/dist\/(?:\.?index[^/"]*)"[ \t]*$/m);
  }
});
test("reusable renderers are fingerprinted and changed templates fail closed", () => {
  for (const [name, expected] of Object.entries(release.RENDERERS)) {
    const bytes = fs.readFileSync(path.join(__dirname, name + ".cjs"));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), expected);
  }
  assert.throws(() => release.render(template + "# changed\n", complete, frontend, release.validate(fixture(), release.TARGET)));
});
test("failed HTML promotion restores the old page without restarting or rewriting the backend", () => {
  const body = render(release.BASE);
  const cleanup = body.slice(body.indexOf("cleanup() {"), body.indexOf("\ntrap cleanup EXIT"));
  for (const swapped of [0, 1]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-selection-return-"));
    const app = path.join(dir, "app"), store = path.join(dir, "private");
    fs.mkdirSync(path.join(app, "dist/public"), { recursive: true });
    fs.mkdirSync(store);
    fs.writeFileSync(path.join(app, "dist/public/index.html"), swapped ? "new HTML" : "old HTML");
    fs.writeFileSync(path.join(app, "dist/index.cjs"), "unchanged backend");
    const hash = text => crypto.createHash("sha256").update(text).digest("hex");
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
OLD_HTML=$(printf '%s' 'old HTML' | base64 -w0)
OLD_INDEX=${hash("old HTML")}
OLD_BACKEND=${hash("unchanged backend")}
PID=12345
RUNTIME_CHANGED=$3
SOURCE_CHANGED=$3
sudo() { "$@"; }
git() {
  if [[ "$*" == *"rev-parse HEAD" ]]; then echo "$TARGET";
  elif [[ "$*" == *"reset --keep $BASE" ]]; then echo source_return >> "$APP/actions";
  else return 91; fi
}
pm2() { echo forbidden_restart >> "$APP/actions"; return 92; }
process_pid() { echo "$PID"; }
health() { return 0; }
${cleanup}
(exit 7)
cleanup
`;
    try {
      const result = cp.spawnSync("bash", ["-s", "--", app, store, String(swapped)], { input: script, encoding: "utf8" });
      assert.equal(result.status, 7, result.stderr);
      assert.equal(fs.readFileSync(path.join(app, "dist/public/index.html"), "utf8"), "old HTML");
      assert.equal(fs.readFileSync(path.join(app, "dist/index.cjs"), "utf8"), "unchanged backend");
      assert.match(fs.readFileSync(path.join(store, "phase-result.txt"), "utf8"), /PHASE=fixture_failure\nEXIT=7/);
      if (swapped) {
        assert.match(result.stderr, /POVODNA_VERZIA_OBNOVENA=/);
        assert.equal(fs.readFileSync(path.join(app, "actions"), "utf8"), "source_return\n");
      } else assert.ok(!fs.existsSync(path.join(app, "actions")));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
test("file and stdin entry points execute or fail explicitly instead of silently succeeding", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-selection-entry-"));
  try {
    const block = path.join(dir, "block.cjs");
    fs.writeFileSync(block, 'require("node:child_process").execFileSync=()=>{throw Error("BLOCKED_GIT");};\n');
    const runner = path.join(__dirname, "promote-omni-selection.cjs");
    for (const stdin of [false, true]) {
      const result = cp.spawnSync(process.execPath, ["--require", block, stdin ? "-" : runner, "--apply", release.TARGET], {
        ...(stdin ? { input: fs.readFileSync(runner, "utf8") } : {}), encoding: "utf8",
      });
      assert.equal(result.status, 1); assert.match(result.stderr, /BLOCKED_GIT/);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
