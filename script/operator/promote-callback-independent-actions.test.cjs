const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync, execFileSync } = require("node:child_process");
const script = fs.readFileSync(path.join(__dirname, "promote-callback-independent-actions.sh"), "utf8");
const base = "819909e2bf9fab80a6695df80a82a0849ac35092";
const target = "40d636fff452f6f493c0c197141cfcb4157f0419";
const files = ["status-list-background.ts", "status-list-callback-boundary.test.ts", "status-list-callback-boundary.ts",
  "status-list-callback-transition.db.test.ts", "status-list-callback-transition.ts", "status-list-option-source.ts",
  "status-list-workflow-routes.ts"].map(name => `server/lib/${name}`).join("\n");
const old = "module.exports='old';\n";
const next = "module.exports='new';\n";

const driver = `#!/usr/bin/env node
const fs=require("fs"),path=require("path"),{spawnSync}=require("node:child_process");
const env=process.env,r=env.TEST_ROOT,mode=env.TEST_MODE,cmd=path.basename(process.argv[1]),args=process.argv.slice(2);
const die=(n=1)=>process.exit(n),out=s=>process.stdout.write(s);
const backend=()=>fs.readFileSync(path.join(r,"app/dist/index.cjs"),"utf8");
const approved=()=>JSON.stringify({ownership:{owner:"compatible"},candidates:Array.from({length:8},(_,i)=>({id:i}))})+"\\n";
function run(command,argv){const p=spawnSync(command,argv,{stdio:"inherit",env});die(p.status??1);}
if(cmd==="id"){out(mode==="user"?"other":"seman");die(0);}
if(cmd==="findmnt"){out(mode==="disk"?"/dev/other":"/dev/sdb1");die(0);}
if(cmd==="sleep")die(0);
if(cmd==="pg_restore")die(0);
if(cmd==="sudo"){
 let a=[...args];if(a[0]==="-v")die(0);if(a[0]==="-u")a=a.slice(2);
 const c=a.shift();
 if(c==="psql"){if(a.includes("-c"))out("1024\\n");else out(approved());die(0);}
 if(c==="pg_dump"){if(mode==="backup")die(41);out("PGDMP fixture");die(0);}
 if(c==="pg_restore")die(0);
 if(c==="install"){a=a.filter((v,i)=>!(["-o","-g"].includes(v)||["-o","-g"].includes(a[i-1])));}
 run(c,a);
}
if(cmd==="git"){
 if(args[0]==="rev-parse"){
   out(args[1]==="HEAD"?fs.readFileSync(path.join(r,"head"),"utf8"):args[1]==="origin/main"?env.TEST_TARGET:env.TEST_BASE);die(0);
 }
 if(args[0]==="diff"){if(args.includes("--name-only"))out(env.TEST_FILES+"\\n");die(mode==="dirty"?42:0);}
 if(args[0]==="fetch")die(0);
 if(args[0]==="archive"){out(fs.readFileSync(path.join(r,"source.tar")));die(0);}
 if(args[0]==="merge"){if(mode==="merge")die(43);fs.writeFileSync(path.join(r,"head"),env.TEST_TARGET);die(0);}
 die(44);
}
if(cmd==="pm2"){
 if(args[0]==="jlist"){out(JSON.stringify([{name:"indexus-crm",pid:backend().includes("'old'")?123:456,
 pm2_env:{status:"online",exec_mode:"fork_mode",pm_cwd:path.join(r,"app"),pm_exec_path:path.join(r,"app/dist/index.cjs")}}]));die(0);}
 if(args[0]==="restart"){
  const f=path.join(r,"restarts"),count=fs.existsSync(f)?Number(fs.readFileSync(f,"utf8")):0;
  fs.writeFileSync(f,String(count+1));die(mode==="restart"&&count===0?45:0);
 }die(46);
}
if(cmd==="curl"){
 const dest=args[args.indexOf("-o")+1],api=args[args.length-1].endsWith("/api/users");
 fs.writeFileSync(dest,api?JSON.stringify({error:mode==="health"&&backend().includes("'new'")?"unhealthy":"Unauthorized"}):"fixture frontend");
 if(args.includes("-w"))out("401");die(0);
}
die(47);
`;

function fixture(mode) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "callback-promotion-test-"));
  const app = path.join(root, "app"), home = path.join(root, "home"), bin = path.join(root, "bin");
  for (const dir of ["app/dist/public", "app/data", "app/node_modules/.bin", "home", "bin", "archive/script"])
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.writeFileSync(path.join(app, "dist/index.cjs"), old);
  fs.writeFileSync(path.join(app, "dist/public/index.html"), "fixture frontend");
  fs.writeFileSync(path.join(app, ".env"), "fixture");
  fs.writeFileSync(path.join(root, "head"), base);
  fs.writeFileSync(path.join(root, "archive/script/build.ts"),
    fs.readFileSync(path.join(__dirname, "../build.ts"), "utf8"));
  execFileSync("tar", ["-cf", path.join(root, "source.tar"), "-C", path.join(root, "archive"), "."]);
  const driverFile = path.join(root, "driver.cjs");
  fs.writeFileSync(driverFile, driver, { mode: 0o755 });
  for (const name of ["id", "sudo", "git", "findmnt", "pm2", "curl", "pg_restore", "sleep"])
    fs.symlinkSync(driverFile, path.join(bin, name));
  fs.writeFileSync(path.join(app, "node_modules/.bin/tsx"), `#!/usr/bin/env node
const fs=require("fs");if(process.env.TEST_MODE==="build")process.exit(48);
fs.mkdirSync("dist",{recursive:true});fs.writeFileSync("dist/index.cjs",${JSON.stringify(next)});
`, { mode: 0o755 });
  const helper = path.join(root, "promote.sh");
  fs.writeFileSync(helper, script.replaceAll("/var/www/indexus-crm", app));
  const result = spawnSync("bash", [helper], { encoding: "utf8", timeout: 60000,
    env: { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}`,
      TEST_ROOT: root, TEST_MODE: mode, TEST_BASE: base, TEST_TARGET: target, TEST_FILES: files } });
  return { root, app, result };
}

test("operator helper has valid Bash syntax", () => {
  const result = spawnSync("bash", ["-n"], { input: script, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
for (const mode of ["user", "disk", "dirty", "build", "backup", "restart", "health", "merge", "success"]) {
  test(`isolated promotion: ${mode}`, () => {
    const { root, app, result } = fixture(mode);
    try {
      const success = mode === "success";
      assert.equal(result.status === 0, success, result.stdout + result.stderr);
      assert.equal(fs.readFileSync(path.join(app, "dist/index.cjs"), "utf8"), success ? next : old);
      assert.equal(fs.readFileSync(path.join(app, "dist/public/index.html"), "utf8"), "fixture frontend");
      assert.equal(fs.readFileSync(path.join(root, "head"), "utf8"), success ? target : base);
      if (["restart", "health", "merge"].includes(mode))
        assert.match(result.stdout, /Povodny backend obnoveny a HTTP overene/);
      if (success) {
        assert.match(result.stdout, /Schvalene callbacky a vlastnictvo nezmenene/);
        assert.equal(fs.readFileSync(path.join(root, "restarts"), "utf8"), "1");
      }
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}
