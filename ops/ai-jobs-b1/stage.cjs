"use strict";
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process");
const policy=require("./policy.cjs");
const {assertPrivateSpace}=require("./space-policy.cjs");
function archiveToDisk(app,pin,files,source,run=cp.execFileSync) {
  const archive=path.join(source,"B1-source.tar");
  fs.writeFileSync(archive,"",{flag:"wx",mode:0o600});
  run("git",["-C",app,"archive","--format=tar","--output="+archive,pin,"--",...files],
    {timeout:60000,stdio:["ignore","ignore","pipe"]});
  fs.chmodSync(archive,0o600);
  run("tar",["-xf",archive,"-C",source],{timeout:60000,stdio:["ignore","ignore","pipe"]});
}
function sourcePathAllowed(name) {
  if(name.startsWith("/")||name.split("/").some(p=>p===".."||p.startsWith(".env"))||
    /(^|\/)(uploads?|backups?|dumps?)(\/|$)/i.test(name))return false;
  if(["package.json","package-lock.json","tsconfig.json","vite.config.ts","postcss.config.js",
    "tailwind.config.ts","components.json"].includes(name))return true;
  if(/^client\//.test(name))return /\.(?:tsx?|jsx?|[cm]js|css|scss|html|json|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf)$/i.test(name);
  if(/^(server|shared)\//.test(name))return /\.(?:tsx?|jsx?|[cm]js)$/.test(name);
  if(/^script\/ai-jobs-b1\//.test(name))return /\.(?:ts|json)$/.test(name);
  if(name==="script/ai-three-services/corpus.ts")return true;
  return /^ops\/ai-jobs-b1\/[^/]+\.cjs$/.test(name);
}
function linkDependencies(source,modules) {
  const destination=path.join(source,"node_modules");
  policy.assert(!fs.existsSync(destination),"B1_DEPENDENCY_DIRECTORY_EXISTS");
  fs.mkdirSync(destination,{mode:0o700});
  for(const name of fs.readdirSync(modules)) {
    // A private container keeps Vite's caches/temp files out of live node_modules.
    if(name.startsWith("."))continue;
    fs.symlinkSync(path.join(modules,name),path.join(destination,name));
  }
}
function main() {
  policy.assert(os.hostname().split(".")[0].toUpperCase()==="CORPCRM01"&&process.getuid()===1001,
    "B1_AUTHORIZED_OPERATOR_REQUIRED");
  const pin=process.argv[3];
  policy.assert(process.argv[2]==="--stage"&&/^[a-f0-9]{40}$/.test(pin),"B1_PINNED_SOURCE_REQUIRED");
  const root=path.join(os.homedir(),"INDEXUS-AI-B1");
  policy.readPrivate(root);
  const source=assertPrivateSpace(root).source;
  policy.assert(fs.readdirSync(source).every(name=>name==="B1-HTTP-CANARY.txt"),"B1_SOURCE_EXISTS_STOP");
  const git=args=>cp.execFileSync("git",["-C",policy.APPLICATION,...args],
    {encoding:"utf8",maxBuffer:4*1024*1024,timeout:15000});
  policy.assert(git(["rev-parse",`${pin}^{commit}`]).trim()===pin,"B1_COMMIT_NOT_AVAILABLE");
  const entries=git(["ls-tree","-rzl",pin]).split("\0").filter(Boolean).map(line=>{
    const tab=line.indexOf("\t"),info=line.slice(0,tab).trim().split(/\s+/);
    return {name:line.slice(tab+1),mode:info[0],size:Number(info[3])};
  }).filter(entry=>sourcePathAllowed(entry.name));
  policy.assert(entries.every(e=>["100644","100755"].includes(e.mode)&&Number.isSafeInteger(e.size)&&e.size>=0),
    "B1_REGULAR_SOURCE_FILES_REQUIRED");
  const files=entries.map(e=>e.name),capacity=fs.statfsSync(source);
  policy.assert(capacity.bavail*capacity.bsize>2*1024**3+6*entries.reduce((sum,e)=>sum+e.size,0),
    "B1_DATA_CAPACITY_REQUIRED");
  for(const required of ["server/ai-b1.ts","script/ai-jobs-b1/build.ts","ops/ai-jobs-b1/launch.cjs","client/src/pages/tasks.tsx"])
    policy.assert(files.includes(required),"B1_SOURCE_INCOMPLETE");
  archiveToDisk(policy.APPLICATION,pin,files,source);
  for(const file of files) {
    const st=fs.lstatSync(path.join(source,file));
    policy.assert(st.isFile()&&!st.isSymbolicLink(),"B1_REGULAR_SOURCE_FILES_REQUIRED");
  }
  linkDependencies(source,path.join(policy.APPLICATION,"node_modules"));
  fs.writeFileSync(path.join(source,"B1-SOURCE.json"),JSON.stringify({commit:pin,files:files.length})+"\n",
    {flag:"wx",mode:0o600});
  console.log(JSON.stringify({staged:true,sourceCommit:pin,sourceFiles:files.length,workerStarted:false}));
}
module.exports={sourcePathAllowed,linkDependencies,archiveToDisk};
if(require.main===module)try{main();}catch(error){console.error(policy.safeError(error));process.exitCode=1;}
