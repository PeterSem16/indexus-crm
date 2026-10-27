const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const cp = require("node:child_process");
const vm = require("node:vm");
const { render, FILES, BASES } = require("./promote-complete-replit.cjs");
const template = fs.readFileSync("script/operator/promote-inbound-status-list.sh", "utf8");
test("complete release retains promotion gates, adds private DB backup, and never runs live DB tests", () => {
  for (const base of BASES) {
    const output = render(template, { base, target: "a".repeat(40), paths: FILES });
    const syntax = cp.spawnSync("bash", ["-n"], { input: output, encoding: "utf8" });
    assert.equal(syntax.status, 0, syntax.stderr);
    for (const marker of ["DATABASE_BACKUP", "VERIFY_APPLICATION_SOURCES"]) {
      const payload = output.split(`<<'${marker}'\n`)[1]?.split(`\n${marker}`)[0];
      assert.ok(payload, `embedded ${marker} exists`);
      assert.doesNotThrow(() => new vm.Script(payload), `embedded ${marker} parses`);
    }
    assert.match(output, /ZALOHA_DATABAZY_OK/);
    assert.match(output, /pg_dump/);
    assert.match(output, /pg_restore/);
    assert.match(output, /findmnt.*\/dev\/sdb1/);
    assert.match(output, /EACCES/);
    assert.match(output, /VERIFY_APPLICATION_SOURCES/);
    assert.equal(output.split("set -Eeuo pipefail").length, 2, "template is not duplicated by replacement metacharacters");
    assert.match(output, /\.indexus-inbound-release.lock/, "share the existing operator lock");
    assert.match(output, /git merge --ff-only/);
    assert.match(output, /wait_health/);
    assert.match(output, /git.*reset --keep/);
    assert.ok(output.indexOf("PHASE=zaloha_databazy_a_konfiguracie") < output.indexOf("PHASE=zostavenie"));
    const execution = output.match(/npx --no-install tsx --test ([^\n]+)/)[1];
    assert.doesNotMatch(execution, /hospital-agreement-routes/);
    assert.match(execution, /hospital-agreement-copy.test.ts/);
    assert.doesNotMatch(output, /db:push|DROP TABLE|pg_restore.*--clean|rm -rf/);
  }
});
test("unknown template, base and unsafe paths fail before execution", () => {
  const options = { base: BASES[0], target: "a".repeat(40), paths: FILES };
  assert.throws(() => render(template + "\n", options), /template changed/);
  assert.throws(() => render(template, { ...options, base: "b".repeat(40) }), /Unreviewed/);
  assert.throws(() => render(template, { ...options, paths: ["x'; rm"] }), /Invalid/);
});
