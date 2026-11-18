"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const cp=require("node:child_process");
const {sourcePathAllowed,linkDependencies,archiveToDisk}=require("./stage.cjs");
test("source staging excludes secrets, database dumps, customer uploads and unrelated files",()=>{
  for(const p of ["server/ai-b1.ts","client/src/pages/tasks.tsx","client/public/logo.svg",
    "script/ai-jobs-b1/build.ts","script/ai-three-services/corpus.ts","ops/ai-jobs-b1/launch.cjs"])
    assert.equal(sourcePathAllowed(p),true,p);
  for(const p of [".env","server/.env.production","server/uploads/contract.pdf","script/full-migration.sql",
    "data/customers.json","../package.json","/package.json","ops/gateway.json","script/unrelated.ts"])
    assert.equal(sourcePathAllowed(p),false,p);
});
test("dependency links keep build cache directories private instead of symlinking live node_modules",()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"b1-deps-"));
  try {
    const modules=path.join(root,"live"),source=path.join(root,"source");
    fs.mkdirSync(modules);fs.mkdirSync(source);
    fs.mkdirSync(path.join(modules,"pg"));fs.mkdirSync(path.join(modules,".vite-temp"));
    linkDependencies(source,modules);
    assert(!fs.lstatSync(path.join(source,"node_modules")).isSymbolicLink());
    assert(fs.lstatSync(path.join(source,"node_modules/pg")).isSymbolicLink());
    assert(!fs.existsSync(path.join(source,"node_modules/.vite-temp")));
    assert.throws(()=>linkDependencies(source,modules),/B1_DEPENDENCY_DIRECTORY_EXISTS/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("Git archives go directly to private disk and tar never receives a buffered archive",()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"b1-archive-")),calls=[];
  try {
    archiveToDisk("/synthetic/source","a".repeat(40),["client/index.html"],root,(command,args,options)=>{
      calls.push({command,args,options});
      assert(!("input" in options));assert(!("maxBuffer" in options));
    });
    assert.equal(calls[0].command,"git");
    assert(calls[0].args.includes("--output="+path.join(root,"B1-source.tar")));
    assert.deepEqual(calls[1].args,["-xf",path.join(root,"B1-source.tar"),"-C",root]);
    assert.equal(fs.statSync(path.join(root,"B1-source.tar")).mode&0o777,0o600);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("a real archive above the former 128 MiB buffer limit extracts from disk",
  {skip:!(process.env.REPLIT_DEV_DOMAIN||process.env.REPL_ID)},t=>{
    const base=path.resolve("generated-artifacts");
    fs.mkdirSync(base,{recursive:true});
    const space=fs.statfsSync(base);
    if(space.bavail*space.bsize<512*1024**2){t.skip("Insufficient disposable development capacity");return;}
    const root=fs.mkdtempSync(path.join(base,"b1-large-archive-"));
    try {
      const source=path.join(root,"source");fs.mkdirSync(source);
      const file=fs.openSync(path.join(root,"payload.bin"),"wx",0o600);
      fs.ftruncateSync(file,140*1024**2);fs.closeSync(file);
      archiveToDisk("/synthetic/source","a".repeat(40),["payload.bin"],source,(command,args,options)=>{
        if(command==="git") {
          const output=args.find(x=>x.startsWith("--output=")).slice(9);
          cp.execFileSync("tar",["-cf",output,"-C",root,"payload.bin"],options);
        }else cp.execFileSync(command,args,options);
      });
      assert(fs.statSync(path.join(source,"B1-source.tar")).size>128*1024**2);
      assert.equal(fs.statSync(path.join(source,"payload.bin")).size,140*1024**2);
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });
