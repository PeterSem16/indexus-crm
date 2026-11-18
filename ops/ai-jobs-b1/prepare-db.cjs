"use strict";
// Explicit operator operation. Does not create a database/role, copy CRM data,
// load Gateway credentials, start a server, or modify the live app environment.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const crypto = require("node:crypto"), cp = require("node:child_process");
const { createRequire } = require("node:module");
const policy = require("./policy.cjs");
const { assert, DATABASE, APPLICATION } = policy;
function adminSQL(port, database, sql, execute = cp.spawnSync) {
  const result = execute("sudo", ["-n", "-u", "postgres", "psql", "-X", "-qAt",
    "-h", "/var/run/postgresql", "-p", String(port), "-d", database,
    "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate"], {
    input: "SET statement_timeout='10s';\n" + sql, encoding: "utf8", timeout: 15000,
    maxBuffer: 32768, env: { PATH: process.env.PATH, LANG: "C" },
  });
  // Never forward raw SQL/provider errors; they can echo a credential statement.
  if (result.error || result.status !== 0) {
    const stderr = String(result.stderr || "");
    const error = Error("B1_ADMIN_OPERATION_FAILED");
    error.diagnostic = {
      kind: /password is required|terminal is required|no tty present/i.test(stderr) ? "sudo_authentication_required"
        : /not allowed to execute|not in the sudoers/i.test(stderr) ? "sudo_permission_denied"
        : /connection to server|could not connect to server|is the server running/i.test(stderr) ? "database_connection_failed"
        : result.error ? "command_execution_failed" : "sql_failed",
      status: Number.isInteger(result.status) ? result.status : null,
      sqlstate: stderr.match(/\bERROR:\s+([0-9A-Z]{5})\b/)?.[1] ?? null,
    };
    throw error;
  }
  return String(result.stdout).trim();
}
const PRODUCTION_PRIVILEGES = `BEGIN READ ONLY;
SELECT json_build_object(
 'dataAccess', EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
   AND c.relkind IN ('r','p','v','m','f') AND
     (has_table_privilege('indexus_ai_b1',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege('indexus_ai_b1',c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))),
 'sequenceAccess', EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
   AND c.relkind='S' AND has_sequence_privilege('indexus_ai_b1',c.oid,'USAGE,SELECT,UPDATE')),
 'definerAccess', EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
   AND p.prosecdef AND has_function_privilege('indexus_ai_b1',p.oid,'EXECUTE')));
ROLLBACK;`;
const ROLE_IDENTITY = `BEGIN READ ONLY;
SELECT json_build_object('owner',pg_get_userbyid(d.datdba),
  'login',r.rolcanlogin,'superuser',r.rolsuper,'createdb',r.rolcreatedb,
  'createrole',r.rolcreaterole,'replication',r.rolreplication,'bypass',r.rolbypassrls,
  'inherit',r.rolinherit,'memberships',(SELECT count(*) FROM pg_auth_members WHERE member=r.oid),
  'passwordSet',a.rolpassword IS NOT NULL)
FROM pg_database d JOIN pg_roles r ON r.rolname='indexus_ai_b1'
  JOIN pg_authid a ON a.oid=r.oid WHERE d.datname='indexus_ai_b1';
ROLLBACK;`;
const EMPTY_DATABASE = `BEGIN READ ONLY;
SELECT json_build_object('objects',count(*)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema';
ROLLBACK;`;
function diagnose({ root, envText, admin = adminSQL }) {
  const target = policy.applicationTarget(envText);
  const result = { privateConfigExists: fs.existsSync(path.join(root, "private.json")), phases: [] };
  const probes = [
    ["admin", "postgres", `BEGIN READ ONLY;
      SELECT json_build_object('admin',current_setting('is_superuser')::boolean,
        'port',current_setting('port')::integer); ROLLBACK;`],
    ["testRole", "postgres", ROLE_IDENTITY],
    ["productionPrivileges", "indexus_crm", PRODUCTION_PRIVILEGES],
    ["emptyDatabase", DATABASE, EMPTY_DATABASE],
  ];
  for (const [phase, database, sql] of probes) {
    try {
      result.phases.push({ phase, ok: true, value: JSON.parse(admin(target.port, database, sql)) });
    } catch (error) {
      // Only fixed categories/codes leave the process. Never include raw stderr,
      // SQL, exception messages, environment values or connection parameters.
      result.phases.push({ phase, ok: false, ...(error.diagnostic || { kind: "diagnostic_failed" }) });
      return { ...result, ok: false };
    }
  }
  return { ...result, ok: true };
}
async function prepare({ root, envText, Client, admin = adminSQL }) {
  const target = policy.applicationTarget(envText);
  policy.privateDirectory(root);
  const file = path.join(root, "private.json");
  assert(!fs.existsSync(file), "B1_CONFIG_EXISTS_STOP_WITHOUT_ROTATION");
  const identity = JSON.parse(admin(target.port, "postgres", ROLE_IDENTITY));
  assert(identity.owner === DATABASE && identity.memberships === 0 &&
    ["login","superuser","createdb","createrole","replication","bypass","inherit","passwordSet"]
      .every(k => identity[k] === false), "B1_FRESH_NOLOGIN_ROLE_REQUIRED");
  const grants = JSON.parse(admin(target.port, "indexus_crm", PRODUCTION_PRIVILEGES));
  assert(["dataAccess","sequenceAccess","definerAccess"].every(k => grants[k] === false),
    "B1_PRODUCTION_PRIVILEGES_PRESENT_STOP");
  const empty = JSON.parse(admin(target.port, DATABASE, EMPTY_DATABASE));
  assert(empty.objects === 0, "B1_EMPTY_TEST_DATABASE_REQUIRED");
  const random = () => crypto.randomBytes(32).toString("hex");
  const config = { version: 1, ...target, database: DATABASE, user: DATABASE,
    password: random(), nonce: random(), sessionSecret: random(), uiPassword: random() };
  // Retain credentials even if a later operation fails. Reruns never rotate them.
  fs.writeFileSync(file, JSON.stringify(config) + "\n", { flag: "wx", mode: 0o600 });
  admin(target.port, "postgres", `ALTER ROLE indexus_ai_b1
    PASSWORD '${policy.scram(config.password)}' LOGIN;`);
  const client = new Client({ host: config.host, port: config.port, database: DATABASE,
    user: DATABASE, password: config.password, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  client.on("error", () => {});
  try {
    await client.connect();
    await client.query(`CREATE TABLE public.b1_environment(
      singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), nonce text NOT NULL)`);
    await client.query("INSERT INTO public.b1_environment(singleton,nonce) VALUES(true,$1)", [config.nonce]);
    await policy.assertDatabase(client, config);
  } finally { await client.end(); }
  return { database: DATABASE, productionDataAccess: false, privateConfigWritten: true, workerStarted: false };
}
async function main() {
  assert(["--prepare", "--diagnose"].includes(process.argv[2]), "B1_EXPLICIT_MODE_REQUIRED");
  assert(os.hostname().split(".")[0].toUpperCase() === "CORPCRM01" && process.getuid() === 1001,
    "B1_AUTHORIZED_OPERATOR_REQUIRED");
  const input = { root: path.join(os.homedir(), "INDEXUS-AI-B1"),
    envText: fs.readFileSync(path.join(APPLICATION, ".env"), "utf8") };
  if (process.argv[2] === "--diagnose") {
    const result = diagnose(input);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  const pg = createRequire(path.join(APPLICATION, "package.json"))("pg");
  const result = await prepare({ ...input, Client: pg.Client });
  console.log(JSON.stringify(result));
}
module.exports = { adminSQL, prepare, diagnose, PRODUCTION_PRIVILEGES };
if (require.main === module) main().catch(error => { console.error(policy.safeError(error)); process.exitCode = 1; });
