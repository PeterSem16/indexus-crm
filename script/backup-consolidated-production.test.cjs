const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");
const helper = require("./backup-consolidated-production.cjs");
const { approvedPath, urlToPgEnv, fingerprint, createBackup, main } = helper;
const HEAD = "b59f6e006cc2073cbb5ae909555c304cf0030903";
const API = ["approvedPath", "urlToPgEnv", "fingerprint", "cliOptions", "currentEnv", "createBackup", "main",
  "hashFile", "appDatabaseEnv", "parseEnvFile"];
function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "consolidated-backup-test-"));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, "app"), home = path.join(base, "home");
  fs.mkdirSync(path.join(root, "script"), { recursive: true });
  fs.mkdirSync(path.join(root, "client/src/data"), { recursive: true });
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.mkdirSync(path.join(root, "dist"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
  fs.mkdirSync(path.join(root, "server/data"), { recursive: true });
  fs.mkdirSync(path.join(root, "server/uploads"), { recursive: true });
  fs.mkdirSync(path.join(root, "uploads"), { recursive: true });
  fs.mkdirSync(path.join(root, "attached_assets"), { recursive: true });
  fs.mkdirSync(path.join(root, "runtime"), { recursive: true });
  fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
  fs.mkdirSync(path.join(root, "design"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules/pkg"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules/dotenv"), { recursive: true });
  fs.mkdirSync(path.join(root, ".git"), { recursive: true });
  fs.mkdirSync(home, { mode: 0o700 });
  fs.writeFileSync(path.join(root, "script/helper.cjs"), "original\n", { mode: 0o640 });
  fs.writeFileSync(path.join(root, "package.json"), '{"name":"fixture"}\n');
  fs.writeFileSync(path.join(root, "dist/index.cjs"), "built app\n");
  fs.writeFileSync(path.join(root, "node_modules/pkg/index.js"), "dependency\n");
  fs.writeFileSync(path.join(root, "node_modules/dotenv/index.js"),
    "exports.parse = source => Object.fromEntries(source.toString().split(/\\n/).filter(Boolean).map(line => line.split(/=(.*)/s).slice(0, 2)));\n");
  fs.writeFileSync(path.join(root, ".git/HEAD"), "ref: refs/heads/production\n");
  fs.writeFileSync(path.join(root, "server/.env.production"), "NESTED_SECRET=private\n");
  for (const p of ["server/data/runtime.json", "server/uploads/runtime.txt", "uploads/runtime.txt",
    "attached_assets/runtime.txt", "runtime/runtime.txt", "artifacts/design.txt", "design/mock.txt"]) {
    fs.writeFileSync(path.join(root, p), "excluded runtime/design\n");
  }
  fs.writeFileSync(path.join(root, "client/src/data/keep.ts"), "source data\n");
  for (const dir of ["mobile-app/node_modules/pkg", "private-task-attachments", "custom/private-task-attachments",
    "private-clinic-agreements", "custom/private-clinic-agreements"]) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.writeFileSync(path.join(root, dir, "keep.txt"), "independent current content\n");
  }
  fs.writeFileSync(path.join(root, "data/runtime.json"), "private runtime\n");
  fs.writeFileSync(path.join(root, ".env"), "DATABASE_URL=postgres://appuser:app-secret@db.example/appdb?sslmode=require\nSECRET=should-not-print\n", { mode: 0o600 });
  const pm2 = JSON.stringify([{ name: "indexus-crm", pid: 123, pm2_env: {
    status: "online", pm_cwd: root, pm_exec_path: path.join(root, "dist/index.cjs"),
    env: { DATABASE_URL: "postgres://u:p%40ss@db.example/app?sslmode=require" },
  } }]);
  const state = { pm2, changed: false, stale: false, args: [], fail: "", trackConfig: false,
    mutatePm2AtRestore: false, mutateConfigAtRestore: false, mutatePidAtDump: false, mutateBuildAtDump: false };
  const dependencies = {
    options: { root, home, expectedHead: HEAD, testMode: true, now: "2025-01-02T03:04:05.000Z" },
    databaseSize: () => 1024,
    command(name, args, opts = {}) {
      state.args.push([name, args]);
      if (name === "which") return { status: 0, stdout: "/usr/bin/tool\n" };
      if (name === "git") {
        if (args[0] === "rev-parse") return { status: 0, stdout: args[1] === "--show-toplevel" ? `${root}\n` : `${HEAD}\n` };
        if (args[0] === "diff") return { status: 0, stdout: `script/helper.cjs\0${state.trackConfig ? "package.json\0" : ""}` };
        if (args[0] === "ls-files") return { status: 0, stdout: "script/new.ts\0script/deleted.js\0" };
      }
      if (name === "pm2") return { status: 0, stdout: state.pm2 };
      if (name === "du") return { status: 0, stdout: execFileSync("du", args, { encoding: "utf8" }) };
      if (name === "tar" || name === "gzip") {
        if (name === "gzip" && state.fail === "gzip") return { status: 1, stdout: "", stderr: "invalid gzip" };
        const stdout = execFileSync(name, args, { encoding: "utf8" });
        if (state.stale) fs.writeFileSync(path.join(root, "script/helper.cjs"), "changed during backup\n");
        return { status: 0, stdout, stderr: "" };
      }
      if (name === "gzip") return { status: 0, stdout: "", stderr: "" };
      if (name === "pg_dump") {
        state.pgEnv = opts.env;
        fs.writeFileSync(args[args.indexOf("--file") + 1], "database bytes");
        if (state.mutatePidAtDump) {
          state.pm2 = JSON.stringify([{ name: "indexus-crm", pid: 124, pm2_env: {
            status: "online", pm_cwd: root, pm_exec_path: path.join(root, "dist/index.cjs"),
            env: { DATABASE_URL: "postgres://u:p%40ss@db.example/app?sslmode=require" },
          } }]);
        }
        if (state.mutateBuildAtDump) fs.writeFileSync(path.join(root, "dist/index.cjs"), "changed built app\n");
        return { status: 0, stdout: "", stderr: "" };
      }
      if (name === "pg_restore") {
        if (state.fail === "pg_restore") return { status: 1, stdout: "", stderr: "restore validation failed" };
        if (state.mutatePm2AtRestore) state.pm2 = JSON.stringify([{ name: "indexus-crm", pm2_env: { status: "stopped" } }]);
        if (state.mutateConfigAtRestore) fs.writeFileSync(path.join(root, "package.json"), '{"name":"changed"}\n');
        return { status: 0, stdout: "Dumped from database version 15\n", stderr: "" };
      }
      throw new Error(`unexpected command: ${name}`);
    },
  };
  return { root, home, state, dependencies };
}
function archiveNames(file) {
  return execFileSync("tar", ["-tzf", file], { encoding: "utf8" }).trim().split("\n").map(x => x.replace(/^\.\//, ""));
}
function streamHash(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(file);
    stream.on("error", reject);
    stream.on("data", chunk => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
async function assertIncomplete(f) {
  await assert.rejects(createBackup({ ...f.dependencies.options, dependencies: f.dependencies }));
  const dir = path.join(f.home, "indexus-backups", "20250102T030405Z");
  assert.equal(fs.existsSync(path.join(dir, "INCOMPLETE")), true);
  assert.equal(fs.existsSync(path.join(dir, "SUCCESS")), false);
  return dir;
}
async function withEnv(values, callback) {
  const saved = {};
  for (const [key, value] of Object.entries(values)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { return await callback(); }
  finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
test("existing and new helper exports remain available", () => {
  for (const name of API) assert.equal(typeof helper[name], "function", name);
});
test("source allowlist excludes runtime but retains nested client/src/data", () => {
  assert.equal(approvedPath("client/src/data/keep.ts"), true);
  for (const file of ["data/a.json", "uploads/a.pdf", "attached_assets/a", "runtime/a", "server/data/a.ts",
    "server/uploads/a", "artifacts/design/a.ts", "client/.env", "server/key.pem", "client/dist/a.js", "foo.ts"]) {
    assert.equal(approvedPath(file), false, file);
  }
});
test("DATABASE_URL decodes credentials and maps PostgreSQL SSL query settings", () => {
  assert.deepEqual(urlToPgEnv("postgres://u%40x:p%3Ass@db:5544/app%20db?sslmode=verify-full&sslrootcert=%2Fsecure%2Fca.pem"), {
    PGHOST: "db", PGPORT: "5544", PGDATABASE: "app db", PGUSER: "u@x", PGPASSWORD: "p:ss",
    PGSSLMODE: "verify-full", PGSSLROOTCERT: "/secure/ca.pem",
  });
  assert.throws(() => urlToPgEnv("https://example.com"), /PostgreSQL/);
});
test("fingerprint includes modifications, untracked and missing files in stable rows", t => {
  const f = fixture(t);
  const result = fingerprint(f.root, f.dependencies);
  assert.deepEqual(result.rows.map(x => x.path), ["script/deleted.js", "script/helper.cjs", "script/new.ts"]);
  assert.equal(result.rows[0].sha256, "missing");
  assert.match(result.aggregate, /^[a-f0-9]{64}$/);
});
test("happy path creates private validated backup with only safe console output", async t => {
  const f = fixture(t), out = [], old = console.log, oldRead = fs.readFileSync;
  console.log = value => out.push(String(value));
  const backupPrefix = path.join(f.home, "indexus-backups");
  fs.readFileSync = function (file, ...args) {
    if (String(file).startsWith(backupPrefix)
      && ["application.tar.gz", "database.dump"].includes(path.basename(String(file)))) {
      throw new Error("backup binary must be checksummed as a stream");
    }
    return oldRead.call(this, file, ...args);
  };
  try {
    const result = await main(["--backup"], f.dependencies);
    assert.equal(result.success, true);
    assert.equal(result.head, HEAD);
    assert.equal(fs.existsSync(path.join(result.directory, "SUCCESS")), true);
    assert.equal(fs.existsSync(path.join(result.directory, "SHA256SUMS")), true);
    assert.equal(fs.existsSync(path.join(result.directory, "runtime-fingerprint.json")), true);
    const runtimeSnapshot = JSON.parse(fs.readFileSync(path.join(result.directory, "runtime-fingerprint.json"), "utf8"));
    assert.equal(runtimeSnapshot.pid, 123);
    assert.match(runtimeSnapshot.buildHash, /^[a-f0-9]{64}$/);
    assert.equal(fs.existsSync(path.join(result.directory, ".env.copy")), true);
    assert.equal(fs.statSync(path.join(result.directory, ".env.copy")).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.join(result.directory, "pm2-jlist.json")).mode & 0o777, 0o600);
    assert.equal(fs.statSync(result.directory).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.join(result.directory, "application.tar.gz")).mode & 0o777, 0o600);
    assert(out.join("\n").includes("NOT_INCLUDED=data, uploads"));
    assert(!out.join("\n").includes("p@ss"));
    assert(!out.join("\n").includes("should-not-print"));
    assert(!out.join("\n").includes("app-secret"));
    assert(!out.join("\n").includes("fallback-secret"));
    assert(!out.join("\n").includes("DATABASE_URL"));
    assert(!out.join("\n").includes("db.example"));
    const names = archiveNames(path.join(result.directory, "application.tar.gz"));
    for (const included of [".env", "server/.env.production", ".git/HEAD", "package.json", "dist/index.cjs",
      "node_modules/pkg/index.js", "client/src/data/keep.ts", "script/helper.cjs"]) assert(names.includes(included), included);
    for (const excluded of ["data/runtime.json", "server/data/runtime.json", "server/uploads/runtime.txt",
      "uploads/runtime.txt", "attached_assets/runtime.txt", "runtime/runtime.txt", "artifacts/design.txt", "design/mock.txt"]) {
      assert(!names.includes(excluded), excluded);
    }
    const verbose = execFileSync("tar", ["-tvzf", path.join(result.directory, "application.tar.gz")], { encoding: "utf8" });
    assert.match(verbose, /-rw-r-----.*\.\/script\/helper\.cjs/);
    const sums = fs.readFileSync(path.join(result.directory, "SHA256SUMS"), "utf8");
    assert(sums.includes("  runtime-fingerprint.json\n"));
    for (const line of sums.trim().split("\n")) {
      const [sum, file] = line.split(/\s{2}/);
      assert.equal(await streamHash(path.join(result.directory, file)), sum, file);
    }
    const tar = f.state.args.find(x => x[0] === "tar")[1].join(" ");
    assert(tar.includes("--exclude=./data") && tar.includes("--exclude=./server/data"));
    assert(tar.includes("--exclude=./mobile-app") && tar.includes("--exclude=private-task-attachments")
      && tar.includes("--exclude=private-clinic-agreements"));
    assert(!names.some(n => n === "mobile-app" || n.startsWith("mobile-app/") ||
      n.includes("private-task-attachments") || n.includes("private-clinic-agreements")));
    assert(tar.includes("-C"));
    const du = f.state.args.find(x => x[0] === "du")[1];
    assert(du.includes(`--exclude=${path.join(f.root, "data")}`), "du should exclude only root runtime data");
    assert(!du.includes("--exclude=data"), "bare excludes could wrongly omit client/src/data");
    const dump = f.state.args.find(x => x[0] === "pg_dump");
    assert(dump[1].includes("--no-owner") && dump[1].includes("--no-acl"));
    assert(!dump[1].includes("p@ss"));
    assert.equal(f.state.pgEnv.PGDATABASE, "app");
    assert.equal(f.state.pgEnv.PGPASSWORD, "p@ss");
    assert.equal(f.state.pgEnv.PGSSLMODE, "require");
    assert.equal(fs.readFileSync(path.join(result.directory, "pm2-jlist.json"), "utf8"), f.state.pm2);
  } finally { console.log = old; fs.readFileSync = oldRead; }
});
test("missing PM2 and app .env URLs fail closed despite unrelated operator DB variables", async t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.root, ".env"));
  f.state.pm2 = JSON.stringify([{ name: "indexus-crm", pm2_env: {
    status: "online", pm_cwd: f.root, pm_exec_path: path.join(f.root, "dist/index.cjs"), env: {},
  } }]);
  let sizeLookups = 0;
  f.dependencies.databaseSize = () => { sizeLookups += 1; return 1024; };
  await withEnv({
    DATABASE_URL: "postgres://operator:operator-secret@not-app.invalid/operator",
    PGHOST: "operator-host", PGDATABASE: "operator-db", PGUSER: "operator-user", PGPASSWORD: "operator-secret",
  }, async () => {
    await assertIncomplete(f);
    assert.equal(sizeLookups, 0);
    assert.equal(f.state.args.some(x => x[0] === "pg_dump"), false);
  });
});
test("app .env is parsed as the fallback and takes precedence over operator PG settings", async t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, ".env"), "DATABASE_URL=postgres://fallback-user:fallback-secret@fallback-db/app-fallback?sslmode=verify-full\n");
  f.state.pm2 = JSON.stringify([{ name: "indexus-crm", pm2_env: {
    status: "online", pm_cwd: f.root, pm_exec_path: path.join(f.root, "dist/index.cjs"), env: {},
  } }]);
  await withEnv({ DATABASE_URL: "postgres://operator:wrong@operator.invalid/wrong", PGDATABASE: "wrong" }, async () => {
    const result = await createBackup({ ...f.dependencies.options, dependencies: f.dependencies });
    assert.equal(result.success, true);
    assert.equal(f.state.pgEnv.PGDATABASE, "app-fallback");
    assert.equal(f.state.pgEnv.PGUSER, "fallback-user");
    assert.equal(f.state.pgEnv.PGPASSWORD, "fallback-secret");
  });
});
test("dotenv fallback resolves from the supplied application root", t => {
  const f = fixture(t), util = require("node:util"), previous = util.parseEnv;
  try {
    util.parseEnv = undefined;
    const parsed = helper.parseEnvFile(path.join(f.root, ".env"), f.root);
    assert.equal(parsed.DATABASE_URL, "postgres://appuser:app-secret@db.example/appdb?sslmode=require");
    assert.equal(parsed.SECRET, "should-not-print");
  } finally { util.parseEnv = previous; }
});
test("concurrent source modification leaves an incomplete private backup, never success", async t => {
  const f = fixture(t);
  f.state.stale = true;
  await assert.rejects(createBackup({ ...f.dependencies.options, dependencies: f.dependencies }), /incomplete folder retained/);
  const folder = path.join(f.home, "indexus-backups", "20250102T030405Z");
  assert.equal(fs.existsSync(path.join(folder, "INCOMPLETE")), true);
  assert.equal(fs.existsSync(path.join(folder, "SUCCESS")), false);
});
test("stale HEAD and PM2 mismatch fail before sensitive dump", async t => {
  const f = fixture(t);
  await assert.rejects(createBackup({ ...f.dependencies.options, expectedHead: "bad", dependencies: f.dependencies }));
  assert.equal(fs.existsSync(path.join(f.home, "indexus-backups")), false);
  const g = fixture(t);
  g.state.pm2 = JSON.stringify([{ name: "indexus-crm", pm2_env: { status: "stopped" } }]);
  await assert.rejects(createBackup({ ...g.dependencies.options, dependencies: g.dependencies }), /incomplete folder retained/);
  assert.equal(g.state.args.some(x => x[0] === "pg_dump"), false);
});
test("gzip, pg_restore, source/config drift, PM2 drift and low space all leave no SUCCESS", async t => {
  const gzip = fixture(t);
  gzip.state.fail = "gzip";
  await assertIncomplete(gzip);

  const restore = fixture(t);
  restore.state.fail = "pg_restore";
  await assertIncomplete(restore);

  const source = fixture(t);
  source.state.stale = true;
  await assertIncomplete(source);

  const config = fixture(t);
  config.state.trackConfig = true;
  config.state.mutateConfigAtRestore = true;
  await assertIncomplete(config);

  const pm2 = fixture(t);
  pm2.state.mutatePm2AtRestore = true;
  await assertIncomplete(pm2);

  const pid = fixture(t);
  pid.state.mutatePidAtDump = true;
  await assertIncomplete(pid);

  const build = fixture(t);
  build.state.mutateBuildAtDump = true;
  await assertIncomplete(build);

  const space = fixture(t);
  space.dependencies.availableSpace = () => 0;
  await assertIncomplete(space);
  assert.equal(space.state.args.some(x => x[0] === "tar"), false);
});

test("database failures keep private logs while console output remains generic", async t => {
  const f = fixture(t), output = [], oldError = console.error;
  const original = f.dependencies.command;
  f.dependencies.command = (name, args, opts) => {
    if (name === "pg_dump") return { status: 1, stdout: "", stderr: "connection failed password=p@ss" };
    return original(name, args, opts);
  };
  console.error = value => output.push(String(value));
  try {
    await assert.rejects(main(["--backup"], f.dependencies), /backup failed/);
    assert.equal(output.join("").includes("p@ss"), false);
    const dir = path.join(f.home, "indexus-backups", "20250102T030405Z");
    assert.match(fs.readFileSync(path.join(dir, "pg_dump.log"), "utf8"), /p@ss/);
    assert.equal(fs.existsSync(path.join(dir, "SUCCESS")), false);
    assert.equal(fs.existsSync(path.join(dir, "INCOMPLETE")), true);
  } finally { console.error = oldError; }
});