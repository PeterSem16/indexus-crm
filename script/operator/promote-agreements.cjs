#!/usr/bin/env node
"use strict";
// Pinned Agreements release. Reuses the reviewed private backup/build/promote
// procedure, including verified DB dump and runtime-only automatic rollback.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const Module = require("node:module");
const APP = "/var/www/indexus-crm";
const BASE = "670e010a2f4e27f62ce8717b484ce41949e9602a";
const PRODUCT = "396204ae27f9bcca1b7a1f0118eca0e1a8f6898e";
const PRODUCT_FILES = [
  "client/src/components/clinic-agreements-panel.tsx",
  "client/src/components/clinic-form-wizard.tsx",
  "client/src/components/hospital-form-wizard.tsx",
  "client/src/components/record-activity-button.tsx",
  "client/src/i18n/agreement-workspace-translations.test.ts",
  "client/src/i18n/agreement-workspace-translations.ts",
  "client/src/i18n/translations.ts",
  "client/test-fixtures/clinic-agreements.tsx",
  "e2e/clinic-agreements.spec.ts",
  "server/index.ts",
  "server/lib/agreement-office-preview.test.ts",
  "server/lib/agreement-workspace.test.ts",
  "server/lib/agreement-workspace.ts",
  "server/lib/clinic-agreement-routes.test.ts",
  "server/lib/clinic-agreement-routes.ts",
  "server/lib/hospital-agreement-routes.test.ts",
  "server/lib/provider-finder-store.ts",
  "server/routes.ts",
].sort();
const TOOL_FILES = ["script/operator/promote-agreements.cjs", "script/operator/promote-agreements.test.cjs"];
const FILES = [...PRODUCT_FILES, ...TOOL_FILES].sort();
const HELPERS = {
  "script/operator/promote-complete-replit.cjs": "bb29fd69d71cee151cfcb60be282c3b6e952e71a95856f35b1125657b97187c4",
  "script/operator/promote-inbound-status-list.sh": "4673575d937530143f0a16fa65537b271b471c687c4feda6f0dbf100efd46b20",
};
const WORD_CHECK=String.raw`
PHASE=overenie_word_konvertora
node - "$APP" "$VIEW" <<'VERIFY_WORD_PREVIEW'
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const [app,view]=process.argv.slice(2);
const work=fs.mkdtempSync(path.join(view,".office-check-"));
async function run(){
  const {Document,Packer,Paragraph}=require(path.join(app,"node_modules/docx"));
  const source=path.join(work,"verification.docx");
  fs.writeFileSync(source,await Packer.toBuffer(new Document({
    sections:[{children:[new Paragraph("INDEXUS private document conversion check")]}]
  })));
  function convert(input,format,out){
    fs.mkdirSync(out,{recursive:true});
    cp.execFileSync("libreoffice",["-env:UserInstallation=file://"+path.join(work,"profile"),
      "--headless","--nologo","--nodefault","--norestore","--convert-to",format,"--outdir",out,input],
      {timeout:45000,stdio:["ignore","ignore","ignore"]});
  }
  const x=path.join(work,"docx-pdf"),d=path.join(work,"doc"),p=path.join(work,"doc-pdf");
  convert(source,"pdf",x);
  convert(source,"doc:MS Word 97",d);
  convert(path.join(d,"verification.doc"),"pdf",p);
  for(const out of [x,p]){
    const bytes=fs.readFileSync(path.join(out,"verification.pdf"));
    if(bytes.length<100 || bytes.subarray(0,5).toString()!=="%PDF-")throw Error("Invalid PDF");
  }
  console.log("WORD_PREVIEW_OK");
}
run().catch(()=>{console.error("STOP: Word conversion failed before deployment.");process.exitCode=1;})
  .finally(()=>fs.rmSync(work,{recursive:true,force:true}));
VERIFY_WORD_PREVIEW
`;
function validate(git, target) {
  if (!/^[a-f0-9]{40}$/.test(target)) throw Error("Pinned release SHA required");
  if (git(["rev-parse", "HEAD"]) !== BASE) throw Error("Production HEAD changed; stop");
  if (git(["rev-parse", `${target}^`]) !== PRODUCT ||
      git(["rev-parse", `${PRODUCT}^`]) !== BASE) throw Error("Release ancestry changed");
  for (const [from,to,expected] of [[BASE,PRODUCT,PRODUCT_FILES],[PRODUCT,target,TOOL_FILES],[BASE,target,FILES]]) {
    const actual = git(["diff","--name-only",from,to]).split("\n").filter(Boolean).sort();
    if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) throw Error("Unreviewed release files");
  }
}
function checkedHelper(name, bytes) {
  if (!HELPERS[name] || crypto.createHash("sha256").update(bytes).digest("hex") !== HELPERS[name])
    throw Error("Reviewed deployment helper changed");
  return bytes;
}
function render(template, complete, target) {
  let body=complete.render(template,{base:BASE,target,paths:FILES},[BASE]);
  const anchor="server/lib/status-list-history-display.test.ts client/src/components/hospital-agreement-copy.test.ts";
  if(body.split(anchor).length!==2)throw Error("Read-only test anchor changed");
  body=body.replace(anchor,anchor+" client/src/i18n/agreement-workspace-translations.test.ts");
  // The existing dump uses app config locally. Ignore console PG overrides,
  // reject unsupported URL parameters rather than silently backing up another DB.
  const envAnchor="const env={...process.env,PGHOST:u.hostname,PGPORT:u.port||\"5432\",";
  if(body.split(envAnchor).length!==2)throw Error("Database backup environment anchor changed");
  body=body.replace(envAnchor,`const clean=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith("PG")&&key!=="DATABASE_URL"));
  const env={...clean,PGCONNECT_TIMEOUT:"10",PGHOST:u.hostname.replace(/^\\[|\\]$/g,""),PGPORT:u.port||"5432",`);
  const parameterAnchor="for(const [k,v] of u.searchParams)if(parameters[k])env[parameters[k]]=v;";
  if(body.split(parameterAnchor).length!==2)throw Error("Database parameter anchor changed");
  body=body.replace(parameterAnchor,'for(const [k,v] of u.searchParams){if(!parameters[k])throw Error("Unsupported database URL parameter");env[parameters[k]]=v;}');
  if(body.split("\nPHASE=zaloha\n").length!==2)throw Error("Private staging anchor changed");
  body=body.replace("\nPHASE=zaloha\n","\n"+WORD_CHECK+"\nPHASE=zaloha\n");
  return body;
}
function main(args, dependencies={}) {
  if(args.length===1 && args[0]==="--help") {
    console.log("Run as seman on CORPCRM01: node <verified-file> --apply <pinned-release-sha>. Creates private DB/runtime backup; restarts PM2; never restores the database.");
    return;
  }
  if(args.length!==2 || args[0]!=="--apply")throw Error("Use --apply PINNED_RELEASE_SHA");
  const git=dependencies.git || (a=>cp.execFileSync("git",["-C",APP,...a],{
    encoding:"utf8",maxBuffer:4*1024*1024,stdio:["ignore","pipe","pipe"],
  }).trimEnd());
  const target=args[1];validate(git,target);
  const template=checkedHelper("script/operator/promote-inbound-status-list.sh",
    git(["show",`${target}:script/operator/promote-inbound-status-list.sh`])+"\n");
  const helper=checkedHelper("script/operator/promote-complete-replit.cjs",
    git(["show",`${target}:script/operator/promote-complete-replit.cjs`])+"\n");
  const filename=APP+"/script/operator/promote-complete-replit.cjs";
  const mod=new Module(filename,module);mod.filename=filename;
  mod.paths=Module._nodeModulePaths(APP+"/script/operator");mod._compile(helper,filename);
  const body=render(template,mod.exports,target);
  const execute=dependencies.spawnSync || cp.spawnSync;
  const syntax=execute("bash",["-n"],{input:body,encoding:"utf8"});
  if(syntax.error || syntax.status!==0)throw Error("Invalid promotion procedure");
  const outcome=execute("bash",["-s","--","--apply"],{cwd:APP,input:body,stdio:["pipe","inherit","inherit"]});
  if(outcome.error || outcome.status!==0)throw Error("Promotion stopped; inspect the reported phase and private backup");
}
if(require.main===module) {
  try{main(process.argv.slice(2));}
  catch(error){console.error("AGREEMENTS_DEPLOY_STOP:",String(error.message).split("\n")[0]);process.exitCode=1;}
}
module.exports={BASE,PRODUCT,PRODUCT_FILES,TOOL_FILES,FILES,HELPERS,validate,checkedHelper,render,main};
