#!/usr/bin/env node
// Explicitly no new backup. Prepare outside live dist; never restore business data.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const TARGET = "c0e76a677dc3e497f358c2573b4ff09b0adca200";
const RENDERER_HASH = "bb29fd69d71cee151cfcb60be282c3b6e952e71a95856f35b1125657b97187c4";
const REVIEWED_PATHS = [
  "client/src/components/campaigns/CampaignAgentProductivity.tsx",
  "client/src/components/campaigns/MissionAgentFunnel.tsx",
  "client/src/components/campaigns/MissionFunnelChart.tsx",
  "client/src/components/campaigns/MissionFunnelHelp.tsx",
  "client/src/components/campaigns/MissionFunnelMapping.tsx",
  "client/src/components/campaigns/MissionFunnelReport.tsx",
  "client/src/components/campaigns/export-scope-translations.ts",
  "client/src/components/campaigns/mission-agent-funnel-export.test.ts",
  "client/src/components/campaigns/mission-agent-funnel-export.ts",
  "client/src/components/campaigns/mission-agent-funnel-translations.ts",
  "client/src/components/campaigns/mission-export-value.ts",
  "client/src/components/campaigns/mission-funnel-export.test.ts",
  "client/src/components/campaigns/mission-funnel-export.ts",
  "client/src/components/campaigns/mission-funnel-help-translations.ts",
  "client/src/components/campaigns/mission-funnel-help.test.ts",
  "client/src/i18n/mission-funnel-translations.test.ts",
  "client/src/i18n/mission-funnel-translations.ts",
  "client/test-fixtures/mission-funnel.tsx",
  "e2e/mission-agent-funnel.spec.ts",
  "e2e/mission-funnel.spec.ts",
  "e2e/mission-productivity-export.spec.ts",
  "script/operator/diagnose-medical-partner-funnel.sql",
  "script/operator/diagnose-medical-partner-funnel.test.cjs",
  "script/operator/promote-mission-agent-funnel.cjs",
  "script/operator/promote-mission-agent-funnel.test.cjs",
  "script/operator/promote-mission-funnel-update.cjs",
  "script/operator/promote-mission-funnel-update.test.cjs",
  "script/operator/promote-mission-reporting.cjs",
  "script/operator/promote-mission-reporting.test.cjs",
  "server/lib/mission-agent-funnel.test.ts",
  "server/lib/mission-agent-funnel.ts",
  "server/lib/mission-funnel-actors.ts",
  "server/lib/mission-funnel-routes.test.ts",
  "server/lib/mission-funnel-routes.ts",
  "server/lib/mission-funnel.test.ts",
  "server/lib/mission-funnel.ts",
  "shared/mission-funnel.ts",
];
const PLANS = [
  { base: "82e76f45fbae8482f4c047787859b6f963e14c80", commits: 10, fileCount: 37,
    patchHash: "60f2aecf88d61ae697568e6c0202a1a4169fc5a971bd9cf4a402e28cc129b320" },
  { base: "0c6aed47d54c763159d3beaf1974d65212500119", commits: 5, fileCount: 30,
    patchHash: "9d33dfc96ad4f53e9606cbc9fc6eb4ab4de550bc9f74de0827f8c0b1ddfafb02" },
  { base: "35d3a76cafd5e4dab9fae917267ce0d9d5ab7cec", commits: 4, fileCount: 28,
    patchHash: "39f754aaca906d70d431833d423738e1060e95f3bba601f687c984378201889b" },
  { base: "ead18c105547d26f4ec1a0c389811311f6e8903b", commits: 3, fileCount: 26,
    patchHash: "0a4634012677d642172c48957482a633ec391eaee75f1c09f46d133e096a5293" },
  { base: "eaa97de0b0b5c7a4791af62ef98c711f258020b8", commits: 2, fileCount: 16,
    patchHash: "366df7ed827365960f2b9002ae4777fb8afcec9757eadee559dd77038cfe4fa3" },
  { base: "2725b550929240b7c1449e681184c8dde0b954b7", commits: 1, fileCount: 14,
    patchHash: "fd02a7fc7cd42fccb00d2e1fd2231a9709ea876445bd26786cd16af1a043435c" },
];
const TESTS = [
  "shared/status-list-history-display.test.ts",
  "server/lib/status-list-history-display.test.ts",
  "shared/reporting-period.test.ts",
  "server/lib/mission-funnel.test.ts",
  "server/lib/mission-agent-funnel.test.ts",
  "server/lib/mission-funnel-routes.test.ts",
  "server/lib/reporting-period-routes.test.ts",
  "client/src/components/campaigns/mission-funnel-export.test.ts",
  "client/src/components/campaigns/mission-funnel-help.test.ts",
  "client/src/components/campaigns/mission-agent-funnel-export.test.ts",
  "client/src/i18n/mission-funnel-translations.test.ts",
  "client/src/i18n/reporting-translations.test.ts",
  "script/operator/diagnose-medical-partner-funnel.test.cjs",
];
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const checkedPlans = new WeakSet();
function validate(git, target) {
  if (target !== TARGET) throw Error("Unreviewed release target");
  const base = git(["rev-parse", "HEAD"]);
  const reviewed = PLANS.find(plan => plan.base === base);
  if (!reviewed) throw Error(base === TARGET ? "Target already present; no restart" : "Unapproved production HEAD; stop and inspect");
  git(["merge-base", "--is-ancestor", base, TARGET]);
  if (git(["rev-list", "--count", `${base}..${TARGET}`]) !== String(reviewed.commits))
    throw Error("Release ancestry changed");
  const files = git(["diff", "--name-only", base, TARGET]).split("\n").filter(Boolean).sort();
  if (files.length !== reviewed.fileCount || new Set(files).size !== files.length || files.some(file => !REVIEWED_PATHS.includes(file)))
    throw Error("Release scope differs");
  for (const file of ["package.json", "package-lock.json", "shared/schema.ts"]) {
    if (git(["rev-parse", `${base}:${file}`]) !== git(["rev-parse", `${TARGET}:${file}`]))
      throw Error("Dependencies/schema changed: " + file);
  }
  if (hash(git(["diff", "--binary", "--full-index", "--no-ext-diff", "--no-renames", base, TARGET], true)) !== reviewed.patchHash)
    throw Error("Reviewed release patch differs");
  const plan = { ...reviewed, files };
  checkedPlans.add(plan);
  return plan;
}
function once(text, before, after) {
  if (text.split(before).length !== 2) throw Error("Reviewed no-backup anchor changed");
  return text.replace(before, () => after);
}
function render(template, renderer, plan) {
  if (!checkedPlans.has(plan)) throw Error("Unvalidated promotion plan");
  let body = renderer(template, { base: plan.base, target: TARGET, paths: plan.files }, [plan.base]);
  const cleanupStart = body.indexOf("restore_file() {");
  const cleanupEnd = body.indexOf("trap cleanup EXIT");
  if (cleanupStart < 0 || cleanupEnd <= cleanupStart) throw Error("Reviewed cleanup anchor changed");
  body = body.slice(0, cleanupStart) + `cleanup() {
  local rc=$?
  trap - EXIT ERR
  set +e
  if (( rc != 0 && ! COMPLETED )); then
    echo "STOP: faza=$PHASE; sukromny build=\${STORE:-nevytvoreny}" >&2
    if (( RUNTIME_CHANGED )); then
      echo "BEZ_ZALOHY: Runtime bol prepnuty. Automaticky navrat nie je mozny; zachovavam cielove zdroje a build na rucne riesenie." >&2
    elif (( SOURCE_CHANGED )); then
      if [[ "$(git -C "$APP" rev-parse HEAD)" == "$TARGET" ]]; then
        git -C "$APP" reset --keep "$BASE" || echo "STOP: Povodne zdroje sa nepodarilo vratit." >&2
      else echo "STOP: HEAD sa zmenil; neprepisujem zdroje." >&2; fi
    fi
  fi
  if (( MOUNTED )); then
    sudo umount -- "$VIEW" || { echo "STOP: Neodpojeny build pohlad: $VIEW" >&2; rc=1; }
  fi
  if [[ -n "$VIEW" ]] && ! mountpoint -q "$VIEW"; then rmdir -- "$VIEW" || rc=1; fi
  exit "$rc"
}
` + body.slice(cleanupEnd);
  const backupStart = body.indexOf("PHASE=zaloha\n");
  const backupEnd = body.indexOf("PHASE=zostavenie\n", backupStart);
  if (backupStart < 0 || backupEnd <= backupStart) throw Error("Reviewed backup anchor changed");
  body = body.slice(0, backupStart) + body.slice(backupEnd);
  body = once(body, 'sudo install -d -o root -g root -m 700 "$STORE/backup"\n', "");
  body = once(body, "# restores a database. A failed promotion returns the previous runtime.",
    "# creates a backup. Automatic runtime rollback is not available after activation.");
  body = once(body, 'echo "Zostavujem presny ciel $TARGET mimo ziveho dist. Zaloha: $STORE"',
    'echo "BEZ_NOVEJ_ZALOHY: Po prepnuti runtime nie je automaticky navrat."\necho "Zostavujem presny ciel $TARGET mimo ziveho dist. Sukromny build: $STORE"');
  body = once(body, 'echo "SUKROMNA_ZALOHA_A_BUILD=$STORE"', 'echo "SUKROMNY_BUILD_BEZ_ZALOHY=$STORE"');
  body = once(body, ".complete-replit-", ".mission-exports-build-");
  const before = "npx --no-install tsx --test shared/status-list-history-display.test.ts server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts";
  body = once(body, before, `DATABASE_URL=postgresql://127.0.0.1:1/mission_funnel_unit npx --no-install tsx --test ${TESTS.join(" ")}`);
  if (/pg_dump|pg_restore|DATABASE_BACKUP|STORE\/backup|backup\/|tar -cpf|previous-source/.test(body))
    throw Error("Unexpected backup operation remains");
  return body;
}
function main(args) {
  if (args.length !== 2 || args[0] !== "--apply-no-backup" || args[1] !== TARGET)
    throw Error(`Use --apply-no-backup ${TARGET} as seman on CORPCRM01; restart included; no runtime backup or automatic return`);
  const git = (args, raw = false) => {
    const bytes = cp.execFileSync("git", ["-C", APP, ...args], {
      encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    });
    return raw ? bytes : bytes.trimEnd();
  };
  const plan = validate(git, args[1]);
  const source = git(["show", `${TARGET}:script/operator/promote-complete-replit.cjs`], true);
  if (hash(source) !== RENDERER_HASH) throw Error("Pinned renderer differs");
  const filename = APP + "/script/operator/promote-complete-replit.cjs";
  const renderer = new Module(filename, module);
  renderer.filename = filename;
  renderer.paths = Module._nodeModulePaths(APP + "/script/operator");
  renderer._compile(source, filename);
  const body = render(git(["show", `${TARGET}:script/operator/promote-inbound-status-list.sh`], true), renderer.exports.render, plan);
  if (cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status !== 0) throw Error("Invalid procedure");
  console.log("BEZ_NOVEJ_ZALOHY_BEZ_AUTOMATICKEHO_NAVRATU_RUNTIME");
  console.log("PRIPRAVENE_VYDANIE=" + TARGET);
  console.log("POVODNA_VERZIA=" + plan.base);
  console.log("KONTROLA_POSTUPU_SHA256=" + hash(body));
  const result = cp.spawnSync("bash", ["-s", "--", "--apply"], { input: body, stdio: ["pipe", "inherit", "inherit"] });
  if (result.error) throw Error("Cannot start procedure");
  process.exitCode = result.status ?? 1;
}
if (require.main === module || !module.parent) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error("STOP: " + error.message.split("\n")[0]); process.exitCode = 1; }
}
module.exports = { TARGET, PLANS, REVIEWED_PATHS, RENDERER_HASH, TESTS, validate, render };
