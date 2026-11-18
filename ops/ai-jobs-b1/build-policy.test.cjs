"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto");
const {verifyBuild}=require("./build-policy.cjs");
test("build identity rejects mixed frontend/backend versions and a live-path symlink",()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"b1-build-"));
  const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
  try {
    fs.mkdirSync(path.join(root,"dist/public"),{recursive:true});
    fs.writeFileSync(path.join(root,"B1-SOURCE.json"),JSON.stringify({commit:"a".repeat(40)}));
    fs.writeFileSync(path.join(root,"dist/ai-b1.cjs"),"fixture-backend");
    fs.writeFileSync(path.join(root,"dist/public/index.html"),"fixture-client");
    fs.writeFileSync(path.join(root,"dist/B1-BUILD.json"),JSON.stringify({
      version:1,source:"a".repeat(40),originalTasksRoute:true,
      backend:hash("fixture-backend"),client:hash("fixture-client"),
    }));
    assert.equal(verifyBuild(root).release.commit,"a".repeat(40));
    fs.writeFileSync(path.join(root,"dist/public/index.html"),"changed");
    assert.throws(()=>verifyBuild(root),/B1_BUILD_SOURCE_MISMATCH/);
    fs.unlinkSync(path.join(root,"dist/ai-b1.cjs"));
    fs.writeFileSync(path.join(root,"outside.cjs"),"fixture-backend");
    fs.symlinkSync(path.join(root,"outside.cjs"),path.join(root,"dist/ai-b1.cjs"));
    assert.throws(()=>verifyBuild(root),/B1_PRIVATE_BUILD_REQUIRED/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
