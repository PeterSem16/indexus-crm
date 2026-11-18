"use strict";
// A separate operator process, never sourced by the live app or shell.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const {verifyBuild}=require("./build-policy.cjs");
const {assertPrivateSpace}=require("./space-policy.cjs");
const policy=require("./policy.cjs");
try {
  policy.assert(os.hostname().split(".")[0].toUpperCase()==="CORPCRM01" &&
    process.getuid()===1001 && !process.env.REPL_ID && !process.env.REPLIT_DEV_DOMAIN,
  "B1_AUTHORIZED_OPERATOR_REQUIRED");
  policy.assert(["init","check","web","worker","report","accept-checklist"].includes(process.argv[2]),
    "B1_EXPLICIT_MODE_REQUIRED");
  const root=path.join(os.homedir(),"INDEXUS-AI-B1"),config=policy.readPrivate(root);
  const source=path.join(root,"source");
  policy.assert(fs.realpathSync(process.cwd())===source &&
    fs.realpathSync(source)===source && source!==policy.APPLICATION,
  "B1_ISOLATED_SOURCE_REQUIRED");
  assertPrivateSpace(root);
  const {entry,release}=verifyBuild(source);
  const baseline=fs.lstatSync(path.join(root,"production-baseline.json"));
  policy.assert(baseline.isFile()&&!baseline.isSymbolicLink()&&baseline.uid===process.getuid()&&
    (baseline.mode&0o077)===0,"B1_PRIVATE_BASELINE_REQUIRED");
  // Never inherit production credentials, cloud providers, debug/preload flags,
  // process-manager configuration or production service admission flags.
  const keep={HOME:os.homedir(),PATH:process.env.PATH,LANG:"C.UTF-8",TZ:"Europe/Bratislava"};
  for(const key of Object.keys(process.env))delete process.env[key];
  Object.assign(process.env,keep,{NODE_ENV:"production",INDEXUS_B1_ROOT:root,
    INDEXUS_B1_COMMIT:release.commit,
    AI_JOBS_GATEWAY_TIMEOUT_MS:"120000"});
  const url=new URL("postgresql://localhost/");
  url.hostname=config.host.includes(":")?`[${config.host}]`:config.host;
  url.port=String(config.port);url.username=config.user;url.password=config.password;
  url.pathname="/"+config.database;
  process.env.DATABASE_URL=url.href;
  // The unchanged, root-controlled loader is the only Gateway credential source.
  require("/etc/indexus-ai-runtime/preload.cjs");
  policy.assert(process.env.INDEXUS_AI_GATEWAY_ENABLED==="true" &&
    process.env.INDEXUS_AI_ROUTER_MODE==="routed","B1_EXISTING_GATEWAY_LOADER_REQUIRED");
  require(entry);
}catch(error){console.error(policy.safeError(error));process.exitCode=1;}
