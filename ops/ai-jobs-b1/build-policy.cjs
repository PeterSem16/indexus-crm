"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {assert}=require("./policy.cjs");
function verifyBuild(source) {
  const entry=path.join(source,"dist/ai-b1.cjs");
  assert(fs.realpathSync(entry)===entry,"B1_PRIVATE_BUILD_REQUIRED");
  const release=JSON.parse(fs.readFileSync(path.join(source,"B1-SOURCE.json"),"utf8"));
  const build=JSON.parse(fs.readFileSync(path.join(source,"dist/B1-BUILD.json"),"utf8"));
  const hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  assert(/^[a-f0-9]{40}$/.test(release.commit)&&build.version===1&&build.source===release.commit&&
    build.originalTasksRoute===true&&build.backend===hash(entry)&&
    build.client===hash(path.join(source,"dist/public/index.html")),"B1_BUILD_SOURCE_MISMATCH");
  return {entry,release};
}
module.exports={verifyBuild};
