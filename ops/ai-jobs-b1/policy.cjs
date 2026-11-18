"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const DATABASE = "indexus_ai_b1";
const APPLICATION = "/var/www/indexus-crm";
function assert(value, code) { if (!value) throw Error(code); }
function applicationTarget(text) {
  const line = text.split(/\r?\n/).find(x => x.startsWith("DATABASE_URL="));
  assert(line, "B1_DB_CONFIG_MISSING");
  let url;
  try { url = new URL(line.slice(13).trim().replace(/^(['"])(.*)\1$/, "$2")); }
  catch { throw Error("B1_DB_CONFIG_INVALID"); }
  assert(["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    url.pathname === "/indexus_crm", "B1_LOCAL_PRODUCTION_IDENTITY_REQUIRED");
  const port = Number(url.port || 5432);
  assert(Number.isInteger(port) && port > 0 && port <= 65535, "B1_DB_PORT_INVALID");
  return { host: url.hostname.replace(/^\[|\]$/g, ""), port };
}
function scram(password, salt = crypto.randomBytes(16)) {
  const salted = crypto.pbkdf2Sync(password, salt, 4096, 32, "sha256");
  const key = name => crypto.createHmac("sha256", salted).update(name).digest();
  return `SCRAM-SHA-256$4096:${salt.toString("base64")}$` +
    crypto.createHash("sha256").update(key("Client Key")).digest("base64") + ":" +
    key("Server Key").toString("base64");
}
function privateDirectory(root, create = true) {
  assert(path.isAbsolute(root), "B1_ABSOLUTE_DIRECTORY_REQUIRED");
  try { if (create) fs.mkdirSync(root, { mode: 0o700 }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  const st = fs.lstatSync(root);
  assert(st.isDirectory() && !st.isSymbolicLink() && st.uid === process.getuid() &&
    (st.mode & 0o077) === 0 && fs.realpathSync(root) === root, "B1_PRIVATE_DIRECTORY_REQUIRED");
}
function readPrivate(root) {
  privateDirectory(root, false);
  const file = path.join(root, "private.json"), st = fs.lstatSync(file);
  assert(st.isFile() && !st.isSymbolicLink() && st.uid === process.getuid() &&
    (st.mode & 0o077) === 0 && st.size < 16384, "B1_PRIVATE_CONFIG_REQUIRED");
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  assert(config.version === 1 && config.database === DATABASE && config.user === DATABASE &&
    ["localhost", "127.0.0.1", "::1"].includes(config.host) &&
    Number.isInteger(config.port) && config.port > 0 && config.port <= 65535 &&
    /^[a-f0-9]{64}$/.test(config.password) && /^[a-f0-9]{64}$/.test(config.nonce) &&
    /^[a-f0-9]{64}$/.test(config.sessionSecret) && /^[a-f0-9]{64}$/.test(config.uiPassword),
    "B1_CONFIG_IDENTITY_INVALID");
  return config;
}
async function assertDatabase(client, config) {
  const result = await client.query(`SELECT current_database() AS database, current_user AS "user",
    r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls, r.rolinherit,
    EXISTS(SELECT FROM pg_auth_members WHERE member=r.oid) AS membership
    FROM pg_roles r WHERE r.rolname=current_user`);
  const row = result.rows[0];
  assert(row && row.database === DATABASE && row.user === DATABASE &&
    !["rolsuper", "rolcreatedb", "rolcreaterole", "rolreplication", "rolbypassrls", "rolinherit", "membership"]
      .some(k => row[k] !== false), "B1_RESTRICTED_DATABASE_REQUIRED");
  const marker = await client.query("SELECT nonce FROM public.b1_environment WHERE singleton=true");
  assert(marker.rows.length === 1 && marker.rows[0].nonce === config.nonce, "B1_DATABASE_MARKER_REQUIRED");
}
function safeError(error) {
  return /^B1_[A-Z0-9_]+$/.test(error?.message) ? error.message : "B1_OPERATION_FAILED";
}
module.exports = { DATABASE, APPLICATION, assert, applicationTarget, scram,
  privateDirectory, readPrivate, assertDatabase, safeError };
