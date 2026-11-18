"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {sourcePathAllowed,linkDependencies}=require("./stage.cjs");
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
