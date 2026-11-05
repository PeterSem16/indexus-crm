#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const APP = "/var/www/indexus-crm";
const DATA = APP + "/data";
const PROC = "/proc";
const TARGET = "249355adb1ece88e30717fdbe4bd42b2a76b6f4e";
const BASE = "1f24432815b6c6f6100ea48941750b0fa8636483";
const OLD_BACKEND = "4d8eb3185ccbd35804766fadd5c2c8e99f2a8603ade87e5994ef72319ef7eebb";
const OLD_INDEX = "eb2958a06270aad239559c103725bf0ee91259f64aaf60f9734c7a5ba38973ce";
// Exactly the 18 paths explicitly approved by the user. No age/glob deletion.
const APPROVED = Object.freeze([
  ".failed-batch-build-Mg6Y35",
  ".batch-ui-stage-20261027T125239Z-jV4h6W",
  ".batch-ui-private-20261027T132456Z-HmXvGb",
  ".batch-ui-private-20261027T133007Z-O0dpMr",
  ".batch-ui-private-20261027T140551Z-7iULoK",
  ".batch-ui-private-20261027T144013Z-5enr5H",
  ".batch-ui-backup-20261027T133041Z-coIA6Z",
  ".batch-ui-backup-20261027T140624Z-5VqZh1",
  ".batch-ui-backup-20261027T144047Z-1c71JV",
  ".inbound-browse-20261027T191004Z-ZuveNH",
  ".inbound-status-list-20261027T193805Z-FDa7OZ",
  ".complete-replit-20261027T201240Z-OWKX62",
  ".standing-analysis-20261028T080724Z-gFbhJO",
  ".standing-analysis-20261028T082055Z-MW8SWg",
  ".medical-partner-status-list-20261028T124038Z-fde654",
  ".medical-partner-status-list-20261028T130240Z-6CMu4K",
  ".status-list-ui-stage-20261028T183353Z-XOZmCB",
  ".status-list-ui-stage-20261028T190122Z-4evYEI",
]);
function ensure(ok, message) { if (!ok) throw Error(message); }
function run(bin, args, options = {}) {
  try {
    const output = cp.execFileSync(bin, args, { encoding: "utf8", maxBuffer: 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"], ...options });
    return String(output ?? "").trim();
  } catch { throw Error(`Kontrola alebo operacia ${bin} zlyhala`); }
}
const within = (name, root) => name === root || name.startsWith(root + "/");
const stripDeleted = value => value.replace(/ \(deleted\)$/, "");
function ordinary(filename, directory = false) {
  const s = fs.lstatSync(filename);
  ensure(!s.isSymbolicLink() && (directory ? s.isDirectory() : s.isFile()),
    "Neocakavany typ: " + filename);
  return s;
}
function noSymlinks(filename) {
  let current = path.parse(filename).root;
  for (const part of filename.slice(current.length).split("/").filter(Boolean)) {
    current = path.join(current, part);
    ensure(!fs.lstatSync(current).isSymbolicLink(), "Symlink v overovanej ceste");
  }
}
function hash(filename) {
  ordinary(filename);
  return crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
}
function live(pid) {
  ensure(/^[1-9]\d*$/.test(pid) && pid !== "676516", "Neovereny novy proces");
  ensure(run("git", ["-C", APP, "rev-parse", "HEAD"]) === TARGET, "Nasadenie Omni nie je dokoncene");
  run("git", ["-C", APP, "diff", "--quiet", "HEAD", "--", "client", "server", "shared", "package.json", "package-lock.json"]);
  ensure(fs.readlinkSync(`${PROC}/${pid}/cwd`) === APP, "Neocakavany pracovny adresar procesu");
  ensure(fs.statSync(`${PROC}/${pid}`).uid !== 0, "Aplikacia nesmie bezat ako root");
  ensure(fs.readFileSync(`${PROC}/${pid}/cmdline`, "utf8").includes(APP + "/dist/index.cjs"),
    "Neocakavany spusteny backend");
  for (const [route, status] of [["/", "200"], ["/api/nexus/mailbox-groups", "401"]])
    ensure(run("curl", ["-sS", "--max-time", "8", "-o", "/dev/null", "-w", "%{http_code}",
      "http://127.0.0.1:5000" + route]) === status, "Aplikacia alebo autentifikacia nie je zdrava");
}
function recoveryProof() {
  const currentBackend = hash(APP + "/dist/index.cjs"), currentIndex = hash(APP + "/dist/public/index.html");
  ensure(currentBackend !== OLD_BACKEND && currentIndex !== OLD_INDEX, "Stary runtime zostal aktivny");
  for (const name of fs.readdirSync(DATA).filter(n => /^\.omni-accounts-\d{8}T\d{6}Z-[A-Za-z0-9]{6}$/.test(n)).sort().reverse()) {
    const store = path.join(DATA, name);
    const s = ordinary(store, true);
    ensure(s.uid === 0 && (s.mode & 0o077) === 0, "Nova zaloha nie je sukromna");
    if (!fs.existsSync(store + "/release.txt")) continue;
    noSymlinks(store + "/release.txt");
    const proof = fs.readFileSync(store + "/release.txt", "utf8").trim().split(/\r?\n/);
    if (JSON.stringify(proof) !== JSON.stringify([BASE, TARGET, "676516", OLD_BACKEND, OLD_INDEX])) continue;
    for (const part of ["backup/index.cjs", "backup/index.html", "backup/dist.tar",
      "backup/source.tar", "backup/database.dump", "build/dist/index.cjs", "build/dist/public/index.html"]) {
      noSymlinks(store + "/" + part);
      ensure(ordinary(store + "/" + part).size > 0, "Neuplna nova zaloha alebo build");
    }
    ensure(hash(store + "/backup/index.cjs") === OLD_BACKEND &&
      hash(store + "/backup/index.html") === OLD_INDEX, "Zaloha nezodpoveda povodnemu buildu");
    ensure(hash(store + "/build/dist/index.cjs") === currentBackend &&
      hash(store + "/build/dist/public/index.html") === currentIndex, "Zivy build nezodpoveda pripravenemu vydaniu");
    run("pg_restore", ["--list", store + "/backup/database.dump"], { stdio: ["ignore", "ignore", "pipe"] });
    return store;
  }
  throw Error("Chyba overena nova zaloha pred nasadenim Omni");
}
function mountsClear(roots) {
  const decode = value => value.replace(/\\([0-7]{3})/g, (_, n) => String.fromCharCode(parseInt(n, 8)));
  for (const line of fs.readFileSync(PROC + "/self/mountinfo", "utf8").trim().split("\n").filter(Boolean)) {
    const fields = line.split(" ");
    ensure(fields.length >= 10, "Neuplny prehlad pripojenych diskov");
    const mountRoot = decode(fields[3]), target = decode(fields[4]);
    for (const root of roots) {
      const relative = "/" + path.relative(DATA, root);
      ensure(!within(target, root) && !within(mountRoot, root) && !within(mountRoot, relative),
        "Adresar je pripojeny, aj cez iny pracovny pohlad: " + root);
    }
  }
}
function unused(roots) {
  const check = value => {
    const clean = stripDeleted(value);
    for (const root of roots) ensure(!within(clean, root), "Adresar pouziva proces: " + root);
  };
  const transient = error => error.code === "ENOENT" || error.code === "ESRCH";
  for (const pid of fs.readdirSync(PROC).filter(name => /^\d+$/.test(name))) {
    for (const name of ["cwd", "root", "exe"]) {
      try { check(fs.readlinkSync(`${PROC}/${pid}/${name}`)); }
      catch (error) { if (!transient(error)) throw error; }
    }
    for (const name of ["cmdline", "maps"]) {
      try {
        const contents = fs.readFileSync(`${PROC}/${pid}/${name}`, "utf8");
        if (name === "cmdline") {
          for (const root of roots) ensure(!contents.includes(root), "Adresar odkazuje spusteny prikaz: " + root);
        } else {
          for (const line of contents.split("\n")) {
            const match = line.match(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+(\/.*)$/);
            if (match) check(match[1]);
          }
        }
      } catch (error) { if (!transient(error)) throw error; }
    }
    let descriptors;
    try { descriptors = fs.readdirSync(`${PROC}/${pid}/fd`); }
    catch (error) { if (transient(error)) continue; throw error; }
    for (const fd of descriptors) {
      try { check(fs.readlinkSync(`${PROC}/${pid}/fd/${fd}`)); }
      catch (error) { if (!transient(error)) throw error; }
    }
  }
}
function cleanup(pid) {
  noSymlinks(DATA);
  ensure(run("findmnt", ["-n", "-o", "SOURCE", "-T", DATA]) === "/dev/sdb1", "Chyba datovy disk /dev/sdb1");
  ensure(run("findmnt", ["-n", "-o", "FSROOT", "-T", DATA]) === "/", "Neocakavany koren datoveho disku");
  live(pid);
  const protectedStore = recoveryProof(), device = ordinary(DATA, true).dev;
  ensure(!fs.readdirSync(DATA).some(name => name.startsWith(".approved-backup-cleanup-")),
    "Existuje nedokoncene sukromne cistenie; najprv treba overit jeho obsah");
  const selected = [];
  for (const name of APPROVED) {
    const filename = path.join(DATA, name);
    let s;
    try { s = ordinary(filename, true); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    ensure(s.dev === device, "Adresar patri na iny disk");
    selected.push({ name, filename, dev: s.dev, ino: s.ino });
  }
  const roots = selected.map(row => row.filename);
  mountsClear(roots); unused(roots);
  if (!selected.length) { console.log("CISTENIE_OK=0; schvalene adresare uz neexistuju"); return; }
  const before = fs.statfsSync(DATA);
  const holding = fs.mkdtempSync(DATA + "/.approved-backup-cleanup-");
  fs.chmodSync(holding, 0o700);
  let deleting = false, removed = 0;
  const moved = [];
  try {
    for (const row of selected) {
      const s = ordinary(row.filename, true);
      ensure(s.dev === row.dev && s.ino === row.ino, "Adresar sa pocas kontroly zmenil");
      const destination = path.join(holding, row.name);
      fs.renameSync(row.filename, destination);
      moved.push({ ...row, destination });
    }
    // No new process can enter the old paths after this atomic rename.
    const held = moved.map(row => row.destination);
    mountsClear(held); unused(held);
    live(pid);
    ensure(recoveryProof() === protectedStore, "Zaloha sa pocas kontroly zmenila");
    deleting = true;
    for (const row of moved) {
      const s = ordinary(row.destination, true);
      ensure(s.dev === row.dev && s.ino === row.ino, "Zmenena identita adresara");
      run("rm", ["-rf", "--one-file-system", "--preserve-root=all", "--", row.destination]);
      ensure(!fs.existsSync(row.destination), "Adresar nebol uplne odstraneny");
      removed++;
      console.log("ODSTRANENE=" + row.name);
    }
    fs.rmdirSync(holding);
  } catch (error) {
    if (!deleting) {
      for (const row of moved.reverse()) {
        try {
          if (!fs.existsSync(row.filename)) fs.renameSync(row.destination, row.filename);
        } catch { /* Preserve all remaining directories privately, never overwrite a conflict. */ }
      }
      if (!fs.readdirSync(holding).length) fs.rmdirSync(holding);
      else console.error("STOP: Neodstranene adresare zostali sukromne v " + holding);
    } else console.error("STOP: Nedokoncene cistenie; skontroluj sukromny adresar " + holding);
    throw error;
  }
  live(pid);
  const after = fs.statfsSync(DATA);
  console.log("CISTENIE_OK=" + removed);
  console.log("VOLNE_PRED_GIB=" + (before.bavail * before.bsize / 1024 ** 3).toFixed(2));
  console.log("VOLNE_PO_GIB=" + (after.bavail * after.bsize / 1024 ** 3).toFixed(2));
  console.log("PONECHANA_NOVA_ZALOHA=" + protectedStore);
}
function main(args) {
  ensure(args.length === 4 && ["--apply", "--locked"].includes(args[0]) &&
    args[1] === TARGET && args[2] === "--pid" && /^[1-9]\d*$/.test(args[3]),
    `Pouzi sudo node tento_subor --apply ${TARGET} --pid NOVY_PID`);
  ensure(process.getuid() === 0 && require("node:os").hostname().split(".")[0].toUpperCase() === "CORPCRM01",
    "Spusti iba cez sudo na CORPCRM01");
  if (args[0] === "--locked") return cleanup(args[3]);
  const result = cp.spawnSync("flock", ["-n", "/home/seman/.indexus-inbound-release.lock",
    process.execPath, __filename, "--locked", TARGET, "--pid", args[3]], { stdio: "inherit" });
  ensure(!result.error && result.status === 0, "Cistenie zlyhalo alebo prebieha ine nasadenie");
}
module.exports = { APPROVED, TARGET, cleanup, mountsClear, unused };
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error("STOP: " + error.message.split("\n")[0]); process.exitCode = 1; }
}
