import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import express from "express";
import { serveStatic } from "../server/static";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "deploy-status-list-batch-frontend.sh");
const q = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function shell(body: string) {
  return spawnSync("bash", ["-c", `source ${q(script)}\nsudo() { "$@"; }\nOWNER=${process.getuid!()}; GROUP=${process.getgid!()};\n${body}`], { encoding: "utf8" });
}

test("operator requires explicit apply, valid syntax, and cannot restart or migrate the backend", () => {
  assert.equal(spawnSync("bash", ["-n", script]).status, 0);
  for (const args of [[], ["--prepare"], ["--apply", "--restart"]]) {
    assert.equal(spawnSync("bash", [script, ...args]).status, 2);
  }
  const source = fs.readFileSync(script, "utf8");
  assert.doesNotMatch(source, /\bpm2\s+(?:restart|reload|stop|start)\b|\bpg_dump\b|\bpg_restore\b|\bpsql\b|\bdb:push\b/);
  assert.match(source, /\/dev\/sdb1/);
  assert.match(source, /mktemp -d "\$ROOT\/data\/\.batch-ui-stage-/);
  assert.doesNotMatch(source, /mktemp -d \/tmp/);
  assert.match(source, /available_bytes.*needed_bytes/);
  assert.match(source, /test "\$\(live_pid\)" = "\$OLD_PID"/);
  assert.match(source, /test "\$\(file_hash dist\/index\.cjs\)" = "\$OLD_BACKEND"/);
});

test("different existing assets and symlinks are rejected before publication", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "batch-ui-collision-"));
  try {
    const live = path.join(dir, "live"), incoming = path.join(dir, "incoming");
    fs.mkdirSync(live); fs.mkdirSync(incoming);
    fs.writeFileSync(path.join(live, "logo.svg"), "original");
    fs.writeFileSync(path.join(incoming, "logo.svg"), "different");
    const result = shell(`validate_assets ${q(live)} ${q(incoming)}`);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /iny obsah/);
    assert.equal(fs.readFileSync(path.join(live, "logo.svg"), "utf8"), "original");
    fs.unlinkSync(path.join(incoming, "logo.svg"));
    fs.symlinkSync(path.join(live, "logo.svg"), path.join(incoming, "alias.svg"));
    assert.notEqual(shell(`validate_assets ${q(live)} ${q(incoming)}`).status, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("actual static server adopts new HTML without restart; old and new assets survive index rollback", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "batch-ui-static-"));
  const previousCwd = process.cwd();
  const live = path.join(dir, "dist", "public"), incoming = path.join(dir, "incoming");
  const backup = path.join(dir, "backup");
  fs.mkdirSync(path.join(live, "assets"), { recursive: true });
  fs.mkdirSync(path.join(incoming, "assets"), { recursive: true });
  fs.mkdirSync(backup);
  const oldIndex = '<html><script src="/assets/old.js"></script></html>';
  const newIndex = '<html><script src="/assets/new.js"></script></html>';
  fs.writeFileSync(path.join(live, "index.html"), oldIndex);
  fs.writeFileSync(path.join(live, "assets", "old.js"), "old bytes");
  fs.writeFileSync(path.join(incoming, "index.html"), newIndex);
  fs.writeFileSync(path.join(incoming, "assets", "new.js"), "new bytes");
  fs.writeFileSync(path.join(backup, "index.html"), oldIndex);
  process.chdir(dir);
  const app = express();
  serveStatic(app);
  const server = app.listen(0, "127.0.0.1");
  try {
    if (!server.listening) await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const pid = process.pid;
    assert.equal(await (await fetch(base)).text(), oldIndex);
    const publication = shell(`validate_assets ${q(live)} ${q(incoming)}; publish_assets ${q(live)} ${q(incoming)}`);
    assert.equal(publication.status, 0, publication.stderr);
    assert.equal(await (await fetch(base)).text(), oldIndex, "publishing assets does not activate new HTML");
    assert.equal(await (await fetch(`${base}/assets/old.js`)).text(), "old bytes");
    assert.equal(await (await fetch(`${base}/assets/new.js`)).text(), "new bytes");
    const next = path.join(live, ".index-next");
    fs.copyFileSync(path.join(incoming, "index.html"), next);
    fs.renameSync(next, path.join(live, "index.html"));
    const response = await fetch(base);
    assert.equal(await response.text(), newIndex);
    assert.match(response.headers.get("cache-control") || "", /no-cache/);
    assert.equal(process.pid, pid, "the same backend process serves the new document");
    const rollback = shell(`PUBLIC=${q(live)}; BACKUP=${q(backup)}; MODE=644; OLD_INDEX=${digest(oldIndex)}; restore_index`);
    assert.equal(rollback.status, 0, rollback.stderr);
    assert.equal(await (await fetch(base)).text(), oldIndex);
    assert.equal(await (await fetch(`${base}/assets/new.js`)).text(), "new bytes", "already opened new clients retain their dependencies");
    assert.equal(await (await fetch(`${base}/assets/old.js`)).text(), "old bytes");
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    process.chdir(previousCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
