"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), cp = require("node:child_process");
const script = fs.readFileSync(path.join(__dirname, "fix-gateway-proxy-timeout.sh"), "utf8");
const python = script.split("<<'PY'\n")[1].split("\nPY\n")[0];
const config = `server {
    location ^~ /gateway/ {
        proxy_connect_timeout 10s;
        proxy_read_timeout 150s;
        proxy_send_timeout 150s;
    }
    location / {
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
`;
function patch(text, backup = text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nginx-timeout-test-"));
  try {
    fs.writeFileSync(dir + "/site", text, { mode: 0o640 });
    fs.writeFileSync(dir + "/original", backup);
    const result = cp.spawnSync("python3", ["-c", python, dir + "/site", dir + "/original"],
      { encoding: "utf8", timeout: 15000 });
    return { ...result, saved: fs.readFileSync(dir + "/site", "utf8"), mode: fs.statSync(dir + "/site").mode & 0o777 };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
test("only the exact Gateway read timeout changes, preserving file permissions", () => {
  const result = patch(config);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.saved, config.replace("proxy_read_timeout 150s", "proxy_read_timeout 270s"));
  assert.equal(result.mode, 0o640);
});
test("comments, CRLF and other proxy directives are preserved byte-for-byte", () => {
  const text = config.replace("150s;", "150s; # preserve comment").replace(/\n/g, "\r\n");
  assert.equal(patch(text).saved, text.replace("proxy_read_timeout 150s", "proxy_read_timeout 270s"));
});
test("repeat application, duplicate locations, other budgets and source drift never write", () => {
  for (const [text, backup] of [
    [config.replace("proxy_read_timeout 150s", "proxy_read_timeout 270s")],
    [config + config],
    [config.replace("proxy_read_timeout 150s", "proxy_read_timeout 180s")],
    [config, config + "# concurrent change"],
  ]) {
    const result = patch(text, backup);
    assert.notEqual(result.status, 0); assert.equal(result.saved, text);
  }
});
test("shell reload failure restores the exact original config without restarting any service", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nginx-rollback-test-"));
  try {
    const bin = dir + "/bin"; fs.mkdirSync(bin); fs.mkdirSync(dir + "/backups");
    fs.writeFileSync(dir + "/site", config);
    const executable = (name, text) => fs.writeFileSync(bin + "/" + name, "#!/bin/sh\n" + text, { mode: 0o700 });
    executable("nginx", 'echo "nginx $*" >> "$TEST_LOG"\nexit 0\n');
    executable("systemctl", 'echo "systemctl $*" >> "$TEST_LOG"\n' +
      'test "$1 $2" = "reload nginx" || exit 98\n' +
      'if [ ! -e "$TEST_FLAG" ]; then touch "$TEST_FLAG"; exit 1; fi\n');
    const fixture = script.replace('test "$(id -u)" -eq 0', "true")
      .replace('test "$(hostname -s | tr \'[:upper:]\' \'[:lower:]\')" = ai', "true")
      .replace("/etc/nginx/sites-enabled/indexus-ai", dir + "/site")
      .replace('test "$(stat -c %u "$conf")" -eq 0', "true")
      .replace('test "$(stat -c %u "$parent")" -eq 0', "true")
      .replace("parent=/opt/indexus-ai-backups", "parent=" + dir + "/backups");
    const result = cp.spawnSync("bash", ["-c", fixture], { encoding: "utf8", timeout: 10000,
      env: { ...process.env, PATH: bin + ":" + process.env.PATH, TEST_LOG: dir + "/log", TEST_FLAG: dir + "/flag" } });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /ORIGINAL_CONFIG_RESTORED/);
    assert.equal(fs.readFileSync(dir + "/site", "utf8"), config);
    assert.equal(fs.readFileSync(dir + "/log", "utf8").split("systemctl reload nginx").length - 1, 2);
    const backup = dir + "/backups/" + fs.readdirSync(dir + "/backups")[0];
    assert.equal(fs.statSync(backup).mode & 0o777, 0o700);
    assert.equal(fs.statSync(backup + "/original.conf").mode & 0o777, 0o600);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test("native syntax is valid and the helper cannot restart Gateway, WebUI or infer", () => {
  assert.equal(cp.spawnSync("bash", ["-n"], { input: script }).status, 0);
  assert(!/systemctl\s+restart|\bcurl\b|\bwget\b/.test(script));
});
