"use strict";
const fs=require("node:fs"),path=require("node:path");
const {assert,APPLICATION}=require("./policy.cjs");
const DATA=path.join(APPLICATION,"data");
function validSpace(root,state) {
  return state?.version===1&&state.source===path.join(root,"source")&&
    typeof state.parent==="string"&&new RegExp("^"+DATA+"/INDEXUS-AI-B1-Build-[a-f0-9-]{36}$").test(state.parent);
}
function assertPrivateSpace(root) {
  const file=path.join(root,"build-space.json"),st=fs.lstatSync(file);
  assert(st.isFile()&&!st.isSymbolicLink()&&st.uid===process.getuid()&&(st.mode&0o077)===0,
    "B1_PRIVATE_SPACE_RECORD_REQUIRED");
  const state=JSON.parse(fs.readFileSync(file,"utf8"));
  assert(validSpace(root,state)&&state.mounted===true&&state.privacyVerified===true,
    "B1_VERIFIED_PRIVATE_SPACE_REQUIRED");
  const parent=fs.lstatSync(state.parent),source=fs.statSync(state.source),data=fs.statSync(DATA);
  assert(parent.isDirectory()&&!parent.isSymbolicLink()&&parent.uid===0&&(parent.mode&0o777)===0o700&&
    source.uid===process.getuid()&&(source.mode&0o777)===0o700&&
    source.dev===data.dev&&source.dev===state.sourceDevice&&source.ino===state.sourceInode&&
    fs.realpathSync(state.source)===state.source,"B1_PRIVATE_DATA_VIEW_REQUIRED");
  return state;
}
module.exports={DATA,validSpace,assertPrivateSpace};
