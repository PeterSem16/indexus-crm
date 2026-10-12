"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { BASE, RELEASE, FILES, replaceEnv, runtimeEnv } = require("./repair-bulkgate-production.cjs");

const source = fs.readFileSync(path.join(__dirname, "repair-bulkgate-production.cjs"), "utf8");
const originalFiles = FILES.filter(file => ["server/routes.ts", "server/lib/bulkgate.ts", "server/lib/bulkgate-webhook.test.ts"].includes(file));
function write(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); }
async function scenario(kind) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bulk-repair-test-"));
  const root = path.join(temp, "app"), home = path.join(temp, "home");
  const logs = [], invocations = [];
  let head = BASE, restartCount = 0;
  const envBefore = 'SESSION_SECRET="fixture-session-not-for-output"\nBULKGATE_SENDER_ID="CBC"\n';
  const row = { name: "indexus-crm", pm2_env: {
    status: "online", NODE_ENV: "production", pm_exec_path: `${root}/dist/index.cjs`,
    pm_cwd: root, BULKGATE_APPLICATION_TOKEN: "fixture-api-not-for-output", env: {},
  } };
  const original = file => Buffer.from(`original source ${file}\n`);
  const released = file => Buffer.from(`released source ${file}\n`);
  write(`${root}/dist/index.cjs`, "module.exports='original backend';\n");
  write(`${root}/dist/public/index.html`, "<html>unchanged frontend</html>");
  write(`${root}/dist/public/assets/original.js`, "untouched asset");
  write(`${root}/.env`, envBefore);
  write(`${root}/uploads/keep.txt`, "live uploaded data");
  fs.mkdirSync(`${root}/node_modules`, { recursive: true });
  for (const file of originalFiles) write(`${root}/${file}`, original(file));
  if (kind === "source-conflict") write(`${root}/server/routes.ts`, "operator-edited source");
  function fakeCommand(name, args, options = {}) {
    invocations.push({ name, args });
    let result = "";
    if (name === "git") {
      if (args[0] === "symbolic-ref") result = "main\n";
      else if (args[0] === "rev-parse") result = `${head}\n`;
      else if (args[0] === "diff") result = args[1] === "--cached" || args.includes("--") ? "" : `${FILES.join("\n")}\n`;
      else if (args[0] === "ls-tree") result = args.includes("--long") ? "100644 blob fixture 1024 server/index.ts\n"
        : args[1] === RELEASE || originalFiles.includes(args.at(-1)) ? "100644 blob fixture\n" : "";
      else if (args[0] === "show") {
        const [commit, file] = args[1].split(":");
        return commit === BASE ? original(file) : released(file);
      } else if (args[0] === "archive") write(args.find(arg => arg.startsWith("--output=")).slice(9), "disk archive fixture");
      else if (args[0] === "merge") {
        assert.equal(head, BASE);
        head = RELEASE;
        for (const file of FILES) write(`${root}/${file}`, released(file));
      } else if (args[0] === "update-ref") { assert.equal(head, RELEASE); head = BASE; }
      else if (args[0] !== "read-tree") throw Error(`Unexpected Git command ${args[0]}`);
    } else if (name === "tar") {
      const stage = args[args.indexOf("-C") + 1];
      write(`${stage}/package.json`, JSON.stringify({ dependencies: { express: "*" } }));
      write(`${stage}/script/build.ts`, 'const allowlist = ["express"];');
    } else if (name === "pm2") {
      if (args[0] === "jlist") result = JSON.stringify([row]);
      else if (args[0] === "restart") {
        restartCount++;
        row.pm2_env.BULKGATE_WEBHOOK_TOKEN = options.env.BULKGATE_WEBHOOK_TOKEN;
        row.pm2_env.BULKGATE_WEBHOOK_URL = options.env.BULKGATE_WEBHOOK_URL;
      } else if (args[0] === "save") write(`${home}/.pm2/dump.pm2`, JSON.stringify(row));
      else throw Error("Unexpected PM2 command");
    } else if (name === process.execPath) return execFileSync(name, args, { encoding: "utf8" });
    else throw Error(`Unexpected command ${name}`);
    return options.encoding === null ? Buffer.from(result) : result;
  }
  const fakeBuild = async options => {
    assert(options.outfile.startsWith(`${home}/indexus-backups/`));
    assert.equal(fs.readFileSync(`${root}/dist/index.cjs`, "utf8"), "module.exports='original backend';\n", "build never deletes live backend");
    if (kind === "build-failure") throw Error("fixture-api-not-for-output");
    write(options.outfile, "module.exports='bulkgate_callback_processing_failed';\n");
    if (kind === "source-race") write(`${root}/server/routes.ts`, "concurrent operator change");
  };
  const fakeRequire = name => {
    if (name === "node:child_process") return { execFileSync: fakeCommand };
    if (name === "node:os") return { hostname: () => "CORPCRM01", userInfo: () => ({ username: "seman" }) };
    if (name === "node:module") return { createRequire: () => () => ({ build: fakeBuild }) };
    return require(name);
  };
  const fakeProcess = { argv: [], env: {}, execPath: process.execPath, cwd: () => root, umask: () => {}, exitCode: 0 };
  const module = { exports: {} };
  const context = vm.createContext({
    require: fakeRequire, module, Buffer, URL, AbortSignal, setTimeout, process: fakeProcess,
    console: { log: (...args) => logs.push(args.join(" ")), error: (...args) => logs.push(args.join(" ")) },
    fetch: async (url, options) => {
      if (new URL(url).pathname === "/") return { status: 200, text: async () => "<html>unchanged frontend</html>" };
      const body = JSON.parse(options.body);
      assert.equal(body.status, "2", "probe must not create an incoming SMS");
      assert(body.smsID.startsWith("indexus-auth-probe-"));
      const status = !body.token ? 403 : kind === "probe-failure" ? 503 : 200;
      return { status, json: async () => ({ received: status === 200, processed: status === 200 ? 1 : undefined }) };
    },
  });
  const sandboxSource = source.replace('const ROOT = "/var/www/indexus-crm";', `const ROOT = ${JSON.stringify(root)};`)
    .replace('const HOME = "/home/seman";', `const HOME = ${JSON.stringify(home)};`);
  try {
    new vm.Script(sandboxSource).runInContext(context);
    await module.exports.main(["--apply"]);
    assert.equal(fs.readFileSync(`${root}/dist/public/index.html`, "utf8"), "<html>unchanged frontend</html>");
    assert.equal(fs.readFileSync(`${root}/dist/public/assets/original.js`, "utf8"), "untouched asset");
    assert.equal(fs.readFileSync(`${root}/uploads/keep.txt`, "utf8"), "live uploaded data");
    assert(!logs.join("\n").includes("fixture-api-not-for-output"));
    assert(!logs.join("\n").includes("fixture-session-not-for-output"));
    if (row.pm2_env.BULKGATE_WEBHOOK_TOKEN) assert(!logs.join("\n").includes(row.pm2_env.BULKGATE_WEBHOOK_TOKEN));
    if (kind === "success") {
      assert.equal(fakeProcess.exitCode, 0);
      assert.equal(head, RELEASE);
      assert.equal(restartCount, 1);
      assert(logs.some(line => line.startsWith("REPAIR_OK")));
      const configured = fs.readFileSync(`${home}/.config/indexus/bulkgate-webhook-url.txt`, "utf8").trim();
      assert.equal(new URL(configured).searchParams.get("token"), row.pm2_env.BULKGATE_WEBHOOK_TOKEN);
      assert.equal(fs.statSync(`${home}/.config/indexus/bulkgate-webhook-url.txt`).mode & 0o777, 0o600);
      assert.equal(fs.statSync(`${home}/.pm2/dump.pm2`).mode & 0o777, 0o600);
      assert(fs.readFileSync(`${root}/.env`, "utf8").startsWith(envBefore.trim()));
    } else {
      assert.equal(fakeProcess.exitCode, 1);
      assert.equal(head, BASE);
      assert.equal(fs.readFileSync(`${root}/.env`, "utf8"), envBefore);
      assert.equal(fs.readFileSync(`${root}/dist/index.cjs`, "utf8"), "module.exports='original backend';\n");
      assert.equal(restartCount, kind === "probe-failure" ? 2 : 0);
      if (kind === "probe-failure") {
        for (const file of originalFiles) assert.deepEqual(fs.readFileSync(`${root}/${file}`), original(file));
        for (const file of FILES.filter(file => !originalFiles.includes(file))) assert(!fs.existsSync(`${root}/${file}`));
        assert(logs.some(line => line.startsWith("GUARDED_ROLLBACK_OK")));
      }
    }
    assert(!invocations.some(call => call.name === "npm" || call.args.includes("reset")));
    assert(!invocations.some(call => call.args.some(arg => typeof arg === "string" && arg.includes("?token="))), "token never appears in command arguments");
    console.log(`Production BulkGate repair: ${kind} PASSED`);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
(async () => {
  const replaced = replaceEnv("KEEP=value\nBULKGATE_WEBHOOK_TOKEN=old\n", { BULKGATE_WEBHOOK_TOKEN: "new$&" });
  assert(replaced.includes('BULKGATE_WEBHOOK_TOKEN="new$&"'));
  assert.throws(() => replaceEnv("BULKGATE_WEBHOOK_TOKEN=a\nBULKGATE_WEBHOOK_TOKEN=b", { BULKGATE_WEBHOOK_TOKEN: "new" }));
  assert.equal(runtimeEnv({ pm2_env: { env: { BULKGATE_WEBHOOK_TOKEN: "nested" }, BULKGATE_WEBHOOK_TOKEN: "actual" } }).BULKGATE_WEBHOOK_TOKEN, "actual");
  for (const kind of ["success", "build-failure", "source-race", "source-conflict", "probe-failure"]) await scenario(kind);
})().catch(error => { console.error(error); process.exitCode = 1; });
