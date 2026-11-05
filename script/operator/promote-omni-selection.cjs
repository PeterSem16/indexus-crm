#!/usr/bin/env node
// Operator-run, pinned frontend release. Never restarts or replaces the backend.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const { Module } = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "412771e256501be47d8b8301fc3b0829eeec257c";
const PARENT = "fb92f5a62941bef6183c5c90bfd9ddd701058337";
const TARGET = "126e2119235da6e10ce005a2b5e58cbc8469938d";
const TREE = "c2adaa80e73e198a1c2596eff462893df7d0faec";
const OLD_INDEX = "16d4a28feb16aaf0e846c2975adcc062048ee4abf660d22517faaae52eb1bc13";
const RENDERERS = {
  "promote-complete-replit": "bb29fd69d71cee151cfcb60be282c3b6e952e71a95856f35b1125657b97187c4",
  "promote-status-list-ergonomics": "7c51bda1ead4fe7ca59f4fc8adaaacc3f08994916343c590bf632236abf7160c",
};
const TOOL_FILES = ["script/operator/promote-omni-msg.cjs", "script/operator/promote-omni-msg.test.cjs"];
const UI_FILES = [
  "client/src/components/nexus/omni-search-results-header.tsx",
  "client/src/i18n/omni-group-translations.ts",
  "client/src/lib/omni-search-selection.test.ts",
  "client/src/lib/omni-search-selection.ts",
  "client/src/pages/email-client.tsx",
  "e2e/omni-group-search.browser.test.mjs",
].sort();
const TESTS = ["client/src/lib/omni-search-selection.test.ts", "client/src/lib/omni-export-search-context.test.ts"];
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
function once(text, before, after) {
  if (text.split(before).length !== 2) throw Error("Reviewed frontend deployment anchor changed");
  return text.replace(before, () => after);
}
function validate(git, target) {
  if (target !== TARGET || git(["rev-parse", `${TARGET}^{tree}`]) !== TREE ||
      git(["rev-parse", `${TARGET}^`]) !== PARENT ||
      git(["rev-parse", `${PARENT}^`]) !== BASE) throw Error("Unreviewed selection release");
  const base = git(["rev-parse", "HEAD"]);
  if (![BASE, PARENT].includes(base)) throw Error("Production HEAD changed; return current state");
  for (const [from, to, expected] of [[BASE, PARENT, TOOL_FILES], [PARENT, TARGET, UI_FILES]]) {
    const paths = git(["diff", "--name-only", from, to]).split("\n").filter(Boolean).sort();
    if (JSON.stringify(paths) !== JSON.stringify([...expected].sort())) throw Error("Release whitelist differs");
  }
  // No backend, schema, package or styling-pipeline changes in this promotion.
  for (const path of ["server", "shared", "package.json", "package-lock.json", "vite.config.ts",
    "tailwind.config.ts", "postcss.config.js", "script/build.ts", "script/build-server.ts",
    "script/operator/promote-inbound-status-list.sh",
    ...Object.keys(RENDERERS).map(name => `script/operator/${name}.cjs`)])
    if (git(["rev-parse", `${BASE}:${path}`]) !== git(["rev-parse", `${TARGET}:${path}`]))
      throw Error("Backend, dependencies or build configuration changed");
  return { base, target, paths: base === BASE ? [...TOOL_FILES, ...UI_FILES].sort() : UI_FILES };
}
function render(template, complete, frontend, plan) {
  let body = frontend.render(template, () => complete.render(template, plan, [plan.base]));
  // The MSG backend has a new fingerprint since this older reusable renderer.
  // Capture it live, require the confirmed fix, and preserve its PID and bytes.
  body = once(body,
    `[[ "$OLD_BACKEND" == ${frontend.RUNTIME.backend} ]] || stop "Zivy backend sa od kontroly zmenil"`,
    `grep -Fq 'microsoft.graph.fileAttachment/contentId' dist/index.cjs || stop "Backend nema potvrdenu MSG opravu"`);
  body = once(body,
    `[[ "$OLD_INDEX" == ${frontend.RUNTIME.index} ]] || stop "Zivy frontend sa od kontroly zmenil"`,
    `[[ "$OLD_INDEX" == ${OLD_INDEX} ]] || stop "Zivy frontend sa zmenil; vrat aktualny stav"`);
  body = once(body, ".status-list-ui-stage-", ".omni-selection-");
  body = once(body, "PHASE=zostavenie\n", `PHASE=zaloha_frontendu
sudo install -d -o root -g root -m 700 "$STORE/backup"
sudo install -m 600 "$APP/dist/public/index.html" "$STORE/backup/index.html"
[[ "$(sudo sha256sum "$STORE/backup/index.html" | awk '{print $1}')" == "$OLD_INDEX" ]] || stop "Neuplna zaloha HTML"
printf '%s\\n' "$BASE" "$TARGET" "$PID" "$OLD_BACKEND" "$OLD_INDEX" | sudo tee "$STORE/release.txt" >/dev/null
sudo chmod 600 "$STORE/release.txt"
PHASE=zostavenie
`);
  body = once(body, 'git archive --format=tar --output="$VIEW/source.tar" "$TARGET"',
    'git archive --format=tar --output="$VIEW/source.tar" "$TARGET" client shared package.json package-lock.json tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js');
  body = once(body, "npx --no-install tsx --test client/src/i18n/automation-attachment-translations.test.ts",
    "npx --no-install tsx --test " + TESTS.join(" "));
  body = once(body, 'echo "Zostavujem frontend $TARGET mimo ziveho dist. Bez zalohy databazy a buildu."',
    'echo "Zostavujem frontend $TARGET mimo ziveho dist. Sukromna zaloha HTML: $STORE/backup/index.html"');
  body = once(body, 'echo "SUKROMNY_BUILD=$STORE"', 'echo "SUKROMNA_ZALOHA_A_BUILD=$STORE"');
  body = once(body, "  trap - EXIT ERR\n  set +e", `  trap - EXIT ERR
  set +e
  if [[ -n "$STORE" ]]; then
    printf 'PHASE=%s\\nEXIT=%s\\n' "$PHASE" "$rc" | sudo tee "$STORE/phase-result.txt" >/dev/null
    sudo chmod 600 "$STORE/phase-result.txt"
  fi`);
  body = once(body, 'stop "Pouzi --apply; iba frontend bez zalohy a restartu."',
    'stop "Pouzi --apply; iba frontend so zalohou HTML, bez restartu."');
  for (const forbidden of ["pg_dump", "pg_restore", "DATABASE_BACKUP", "pm2 restart", "npm run build",
    "npm install", "npm ci", "db:push", "reset --hard", "git clean", "PHASE=backend"])
    if (body.includes(forbidden)) throw Error("Forbidden backend or database operation");
  return body;
}
function main(args) {
  if (args.length !== 2 || args[0] !== "--apply" || args[1] !== TARGET)
    throw Error("Use --apply " + TARGET + " as seman on CORPCRM01");
  const git = (args, raw = false) => {
    const text = cp.execFileSync("git", ["-C", APP, ...args], {
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    });
    return raw ? text : text.trimEnd();
  };
  const plan = validate(git, TARGET);
  function load(name) {
    const path = `script/operator/${name}.cjs`;
    const source = git(["show", `${TARGET}:${path}`], true);
    if (hash(source) !== RENDERERS[name]) throw Error("Pinned renderer changed");
    const loaded = new Module(APP + "/" + path, module);
    loaded.filename = APP + "/" + path;
    loaded.paths = Module._nodeModulePaths(APP + "/script/operator");
    loaded._compile(source, loaded.filename);
    return loaded.exports;
  }
  const body = render(git(["show", `${TARGET}:script/operator/promote-inbound-status-list.sh`], true),
    load("promote-complete-replit"), load("promote-status-list-ergonomics"), plan);
  if (cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status !== 0)
    throw Error("Invalid generated command");
  console.log("OMNI_SELECTION_TARGET=" + TARGET);
  console.log("REZIM=IBA_FRONTEND_SO_ZALOHOU_HTML_BEZ_RESTARTU");
  const run = cp.spawnSync("bash", ["-s", "--", "--apply"], { input: body, stdio: ["pipe", "inherit", "inherit"] });
  if (run.error) throw Error("Cannot start deployment");
  process.exitCode = run.status ?? 1;
}
module.exports = { BASE, PARENT, TARGET, TREE, OLD_INDEX, RENDERERS, TOOL_FILES, UI_FILES, TESTS, validate, render };
if (require.main === module || !module.parent) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error("STOP: " + error.message.split("\n")[0]); process.exitCode = 1; }
}
