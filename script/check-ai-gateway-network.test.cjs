const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const script = path.resolve(__dirname, "check-ai-gateway-network.sh");

function run({ host = "CORPCRM01", curlExit = 0 } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "indexus-network-unit-"));
  const log = path.join(tmp, "curl-args.json");
  const write = (name, text) => fs.writeFileSync(path.join(tmp, name),
    "#!/usr/bin/env bash\n" + text, { mode: 0o700 });
  try {
    write("hostname", `if [[ "$1" == "-s" ]]; then echo '${host}'; else echo '192.0.2.20'; fi\n`);
    write("getent", "printf '192.0.2.10 STREAM ai.cordbloodcenter.com\\n'\n");
    write("ip", "echo '192.0.2.10 dev unit0 src 192.0.2.20'\n");
    write("curl", `printf '%s\\n' "$@" > '${log}'\nprintf 'HTTP_STATUS=404\\nTLS_VERIFY_RESULT=${curlExit ? 20 : 0}\\n'\nexit ${curlExit}\n`);
    const consoleCommand = "bash <<'INDEXUS_NETWORK_CHECK'\n" +
      fs.readFileSync(script, "utf8") + "\nINDEXUS_NETWORK_CHECK";
    const result = spawnSync("bash", ["-c", consoleCommand], {
      env: { PATH: tmp + path.delimiter + process.env.PATH, LANG: "C" }, encoding: "utf8",
    });
    return { ...result, args: fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : [] };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

test("wrong host fails before any network command", () => {
  const result = run({ host: "REPLIT" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /CORPCRM01 console/);
  assert.deepEqual(result.args, []);
});
test("read-only root probe validates TLS without credentials, proxy, redirects or Gateway calls", () => {
  const result = run();
  assert.equal(result.status, 0);
  assert.equal(result.args[0], "-q");
  for (const arg of ["--head", "--noproxy", "*", "--ipv4", "--max-time"]) assert.ok(result.args.includes(arg));
  for (const arg of ["-k", "--insecure", "-L", "--location", "-H", "--header", "-u", "--user", "--data"])
    assert.equal(result.args.includes(arg), false);
  assert.match(result.args.at(-1), /^https:\/\/ai\.cordbloodcenter\.com\/\?indexus_network_probe=indexus-network-/);
  assert.equal(result.args.some(arg => arg.includes("/gateway/") || arg.includes("Bearer")), false);
  assert.match(result.stdout, /TLS_CHECK=verified_by_curl/);
  assert.match(result.stdout, /GATEWAY_API=not_called/);
  assert.match(result.stdout, /RECEIVER_OBSERVED_SOURCE_IP=awaiting/);
});
test("TLS error is reported as failure, never as verified", () => {
  const result = run({ curlExit: 60 });
  assert.equal(result.status, 60);
  assert.match(result.stdout, /TLS_CHECK=not_verified/);
  assert.doesNotMatch(result.stdout, /TLS_CHECK=verified_by_curl/);
});
