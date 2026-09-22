#!/usr/bin/env node
/**
 * Build a self-contained, read-only HTML review workspace from a dedupe audit.
 *
 * The output contains review data, so both input and output must remain private.
 * Decisions are exported as operationId + decision only and never apply changes.
 */
const fs = require("node:fs");
const path = require("node:path");

const DECISIONS = new Set(["approve", "reconcile", "reject"]);

function assertPrivateRegularFile(filePath, label) {
  if (!path.isAbsolute(filePath)) throw new Error(`${label} must be an absolute path`);
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error(`${label} must be a regular file`);
  if ((stat.mode & 0o077) !== 0) throw new Error(`${label} must have mode 0600`);
}

function jsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function reviewModel(report, auditPath) {
  const candidates = (report.manualReview || []).map((operation) => ({
    operationId: operation.operationId,
    kind: operation.kind,
    entityKind: operation.entityKind || null,
    winnerId: String(operation.winnerId),
    loserIds: (operation.loserIds || []).map(String),
    reason: operation.reason || "unknown",
    confidence: operation.confidence,
    matchEvidence: operation.matchEvidence || [],
    reviewRows: operation.reviewRows || [],
    conflicts: operation.fieldConflicts || [],
    blockers: operation.autoReviewBlockers || [],
    plannedPatch: operation.plannedPatch || {},
    references: operation.references || [],
    hasAssignmentHandling: (operation.references || []).some(
      (reference) => reference.policy === "contact_assignment_special"
    ),
    hasUnsupportedReference: (operation.references || []).some(
      (reference) => reference.policy === "unsupported_block"
    ),
  }));
  return {
    format: 1,
    generatedAt: new Date().toISOString(),
    sourceAudit: auditPath,
    sourcePlanHash: report.planHash || null,
    sourceExecutionPlanHash: report.executionPlanHash || null,
    globalAssignmentMergeCount: (report.assignmentMerges || []).length,
    candidates,
  };
}

function renderHtml(model) {
  const data = jsonForHtml(model);
  return `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Manuálna kontrola duplicít</title>
<style>
  :root{font:15px/1.45 system-ui,sans-serif;color:#172033;background:#f3f5f8}
  *{box-sizing:border-box} body{margin:0} button,input,select{font:inherit}
  header{position:sticky;top:0;z-index:2;background:#172033;color:#fff;padding:16px 22px;box-shadow:0 2px 8px #0003}
  header h1{font-size:20px;margin:0 0 10px}.toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  input,select,button{border:1px solid #aeb7c5;border-radius:7px;padding:8px 10px;background:#fff;color:#172033}
  input{min-width:260px}button{cursor:pointer;font-weight:650}button.primary{background:#2762d2;color:#fff;border-color:#2762d2}
  .stats{margin-left:auto;font-variant-numeric:tabular-nums}
  main{max-width:1280px;margin:auto;padding:20px}.notice{background:#fff7d6;border:1px solid #e8ca54;padding:12px 14px;border-radius:9px;margin-bottom:16px}
  .card{background:#fff;border:1px solid #d9dfe8;border-radius:12px;margin:0 0 14px;overflow:hidden;box-shadow:0 1px 3px #19243b12}
  .card-head{display:flex;gap:12px;align-items:center;padding:13px 15px;background:#f9fafc;border-bottom:1px solid #e3e7ed}
  .card-head strong{font-size:16px}.id{font:12px ui-monospace,monospace;color:#5d687a;word-break:break-all}.tag{font-size:12px;padding:3px 7px;border-radius:999px;background:#e8eef9}
  .risk{background:#ffe2dc;color:#8f2615}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px}
  .panel{border:1px solid #e0e5ec;border-radius:9px;padding:12px;min-width:0}.panel h3{margin:0 0 9px;font-size:14px}
  .wide{grid-column:1/-1}.field-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:10px}
  dl{display:grid;grid-template-columns:minmax(110px,auto) 1fr;gap:5px 10px;margin:0}dt{color:#667186}dd{margin:0;overflow-wrap:anywhere}
  table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #e6e9ef;padding:7px}
  .decisions{display:flex;gap:8px;padding:0 14px 14px;flex-wrap:wrap}.decision{border-width:2px}.decision.active{outline:3px solid #172033}
  .approve{border-color:#18854b}.reconcile{border-color:#c27800}.reject{border-color:#ba2d2d}
  .empty{color:#697386;font-style:italic}.hidden{display:none}.sensitive{color:#7b3f00}
  @media(max-width:760px){.grid{grid-template-columns:1fr}.stats{width:100%;margin:0}input{min-width:100%}}
</style>
</head>
<body>
<header>
  <h1>Manuálna kontrola duplicít</h1>
  <div class="toolbar">
    <input id="search" type="search" placeholder="Hľadať meno, ID, dôvod alebo konflikt">
    <select id="reason"><option value="">Všetky dôvody</option></select>
    <select id="country">
      <option value="SK">Winner krajina SK</option>
      <option value="ALL_SK">Všetky záznamy krajina SK</option>
      <option value="">Všetky krajiny</option>
    </select>
    <select id="status">
      <option value="">Všetky rozhodnutia</option>
      <option value="unreviewed">Neskontrolované</option>
      <option value="approve">Zlúčiť</option>
      <option value="reconcile">Najprv upraviť</option>
      <option value="reject">Nezlúčiť</option>
    </select>
    <button id="export" class="primary">Exportovať rozhodnutia</button>
    <button id="import">Importovať rozhodnutia</button>
    <input id="import-file" type="file" accept=".json,application/json" hidden>
    <span id="stats" class="stats"></span>
  </div>
</header>
<main>
  <div class="notice"><strong>Tento report nič nemení v databáze.</strong> Voľby zostávajú iba v tomto prehliadači. Export obsahuje len operation ID a rozhodnutie, nie osobné údaje.</div>
  <div id="cards"></div>
</main>
<script>
const MODEL=${data};
const KEY="dedupe-review:"+MODEL.sourceExecutionPlanHash;
let persistenceAvailable=true;
let decisions={};
try{decisions=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(error){persistenceAvailable=false}
const cards=document.getElementById("cards");
const search=document.getElementById("search"), reason=document.getElementById("reason"), country=document.getElementById("country"), status=document.getElementById("status");
const text=(value)=>value===null||value===undefined||value===""?"—":Array.isArray(value)?value.join(", "):typeof value==="object"?(value.redacted?"[citlivá hodnota; hash "+value.hash+"]":JSON.stringify(value)):String(value);
const el=(name,cls,content)=>{const node=document.createElement(name);if(cls)node.className=cls;if(content!==undefined)node.textContent=content;return node};
const saveDecisions=()=>{
  if(!persistenceAvailable)return;
  try{localStorage.setItem(KEY,JSON.stringify(decisions))}catch(error){persistenceAvailable=false}
};
const evidenceFor=(candidate,id)=>candidate.matchEvidence.find(item=>String(item.id)===String(id))||{id};
const rowFor=(candidate,id)=>candidate.reviewRows.find(item=>String(item.id)===String(id))||{id};
const detailList=(evidence)=>{
  const dl=el("dl");
  const entries=Object.entries(evidence).filter(([key])=>key!=="id"&&key!=="normalizedName");
  for(const [key,value] of entries){dl.append(el("dt","",key),el("dd",value&&value.redacted?"sensitive":"",text(value)))}
  return dl;
};
const conflictTable=(candidate)=>{
  if(!candidate.conflicts.length)return el("p","empty","Žiadne zaznamenané konflikty");
  const table=el("table"), head=el("tr");
  ["Pole","Záznam","Hodnota"].forEach(v=>head.append(el("th","",v)));table.append(head);
  for(const conflict of candidate.conflicts)for(const item of conflict.values||[]){
    const row=el("tr");row.append(el("td","",conflict.field),el("td","id",item.id),el("td",item.value&&item.value.redacted?"sensitive":"",text(item.value)));table.append(row)
  }
  return table;
};
const allFieldsTable=(candidate)=>{
  const ids=[candidate.winnerId,...candidate.loserIds];
  const rows=ids.map(id=>rowFor(candidate,id));
  const fields=[...new Set(rows.flatMap(row=>Object.keys(row)))].sort((a,b)=>a==="id"?-1:b==="id"?1:a.localeCompare(b));
  const table=el("table"), head=el("tr");head.append(el("th","","Pole"));
  ids.forEach((id,index)=>head.append(el("th","",index===0?"WINNER":"LOSER "+index)));table.append(head);
  for(const field of fields){
    const row=el("tr");row.append(el("td","",field));
    for(const record of rows){const value=record[field];row.append(el("td",value&&value.redacted?"sensitive":"",text(value)))}
    table.append(row)
  }
  return table;
};
const patchTable=(candidate)=>{
  const entries=Object.entries(candidate.plannedPatch||{});
  if(!entries.length)return el("p","empty","Winner sa nebude dopĺňať žiadnym novým poľom");
  const table=el("table");for(const [field,value] of entries){const row=el("tr");row.append(el("td","",field),el("td",value&&value.redacted?"sensitive":"",text(value)));table.append(row)}return table;
};
function render(){
  cards.textContent="";
  const query=search.value.trim().toLowerCase();let visible=0;
  for(const candidate of MODEL.candidates){
    const decision=decisions[candidate.operationId]||"unreviewed";
    const haystack=JSON.stringify([candidate.operationId,candidate.reason,candidate.blockers,candidate.matchEvidence,candidate.reviewRows]).toLowerCase();
    const evidenceCountries=candidate.matchEvidence.map(item=>String(item.countryCode||"").toUpperCase()).filter(Boolean);
    const winnerCountry=String(evidenceFor(candidate,candidate.winnerId).countryCode||"").toUpperCase();
    const countryMismatch=country.value==="SK"&&winnerCountry!=="SK"||country.value==="ALL_SK"&&(!evidenceCountries.length||evidenceCountries.some(value=>value!=="SK"));
    if(query&&!haystack.includes(query)||reason.value&&candidate.reason!==reason.value||countryMismatch||status.value&&decision!==status.value)continue;
    visible++;const card=el("section","card");
    const head=el("div","card-head");head.append(el("strong","",candidate.matchEvidence[0]?.name||candidate.operationId),el("span","tag",candidate.reason),el("span","id",candidate.operationId));
    if(candidate.hasAssignmentHandling)head.append(el("span","tag risk","assignment kontrola"));
    if(candidate.hasUnsupportedReference)head.append(el("span","tag risk","NEPODPOROVANÁ REFERENCIA"));
    card.append(head);
    const grid=el("div","grid");
    const winner=el("div","panel");winner.append(el("h3","","WINNER – zostane aktívny"),detailList(evidenceFor(candidate,candidate.winnerId)));
    const losers=el("div","panel");losers.append(el("h3","","LOSER – bude deaktivovaný"));for(const id of candidate.loserIds)losers.append(detailList(evidenceFor(candidate,id)));
    const conflicts=el("div","panel");conflicts.append(el("h3","","Konfliktné hodnoty"),conflictTable(candidate));
    const refs=el("div","panel");refs.append(el("h3","","Referencie"));
    const refTable=el("table");for(const ref of candidate.references){const row=el("tr");row.append(el("td","",ref.table+"."+ref.column),el("td","",String(ref.count)),el("td",ref.policy==="unsupported_block"?"risk":"",ref.policy));refTable.append(row)}refs.append(refTable);
    const allFields=el("div","panel wide");allFields.append(el("h3","","Všetky polia winnera a loserov"),allFieldsTable(candidate));
    const patch=el("div","panel wide");patch.append(el("h3","","Polia, ktoré sa doplnia do winnera"),patchTable(candidate));
    grid.append(winner,losers,conflicts,refs,allFields,patch);card.append(grid);
    const actions=el("div","decisions");
    [["approve","Zlúčiť"],["reconcile","Najprv upraviť"],["reject","Nezlúčiť"]].forEach(([value,label])=>{
      const button=el("button","decision "+value+(decision===value?" active":""),label);
      button.onclick=()=>{decisions[candidate.operationId]=value;saveDecisions();render()};actions.append(button)
    });
    card.append(actions);cards.append(card)
  }
  const done=Object.values(decisions).filter(v=>["approve","reconcile","reject"].includes(v)).length;
  document.getElementById("stats").textContent=visible+" z "+MODEL.candidates.length+" · rozhodnuté "+done;
  if(!visible)cards.append(el("div","notice","Aktuálne filtre nenašli žiadne prípady. Zvoľte Všetky krajiny a Všetky rozhodnutia."));
}
for(const value of [...new Set(MODEL.candidates.map(c=>c.reason))].sort()){const option=el("option","",value);option.value=value;reason.append(option)}
[search,reason,country,status].forEach(node=>node.addEventListener("input",render));
document.getElementById("export").onclick=()=>{
  const approved=Object.entries(decisions).filter(([,decision])=>["approve","reconcile","reject"].includes(decision)).map(([operationId,decision])=>({operationId,decision}));
  const payload={format:1,sourceExecutionPlanHash:MODEL.sourceExecutionPlanHash,decisions:approved};
  const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)+"\\n"],{type:"application/json"}));link.download="dedupe-review-decisions.json";link.click();URL.revokeObjectURL(link.href)
};
document.getElementById("import").onclick=()=>document.getElementById("import-file").click();
document.getElementById("import-file").onchange=async(event)=>{
  const payload=JSON.parse(await event.target.files[0].text());
  if(payload.sourceExecutionPlanHash!==MODEL.sourceExecutionPlanHash)throw new Error("Rozhodnutia patria k inému auditu");
  for(const item of payload.decisions||[])if(MODEL.candidates.some(c=>c.operationId===item.operationId)&&["approve","reconcile","reject"].includes(item.decision))decisions[item.operationId]=item.decision;
  saveDecisions();render()
};
if(!persistenceAvailable){
  const warning=el("div","notice","Safari zablokoval lokálne uloženie. Report funguje, ale pred zatvorením stránky exportujte rozhodnutia.");
  document.querySelector("main").prepend(warning);
}
render();
</script>
</body>
</html>
`;
}

function generateReview({ auditPath, outputPath }) {
  assertPrivateRegularFile(auditPath, "--audit");
  if (!path.isAbsolute(outputPath)) throw new Error("--output must be an absolute path");
  if (fs.existsSync(outputPath)) throw new Error("--output already exists");
  const report = JSON.parse(fs.readFileSync(auditPath, "utf8"));
  const model = reviewModel(report, auditPath);
  if (!model.candidates.length) throw new Error("Audit contains no manual-review candidates");
  fs.writeFileSync(outputPath, renderHtml(model), { mode: 0o600, flag: "wx" });
  fs.chmodSync(outputPath, 0o600);
  return { outputPath, candidateCount: model.candidates.length };
}

function cli(argv) {
  const options = {};
  for (const arg of argv) {
    const match = arg.match(/^--(audit|output)=(.+)$/);
    if (!match) throw new Error(`Unknown argument: ${arg}`);
    options[match[1] === "audit" ? "auditPath" : "outputPath"] = match[2];
  }
  if (!options.auditPath || !options.outputPath) throw new Error("Usage: --audit=/absolute/audit.json --output=/absolute/review.html");
  return options;
}

module.exports = { DECISIONS, jsonForHtml, reviewModel, renderHtml, generateReview, cli };

if (require.main === module) {
  try {
    console.log(JSON.stringify(generateReview(cli(process.argv.slice(2))), null, 2));
  } catch (error) {
    console.error(`FATAL: ${error.message}`);
    process.exitCode = 1;
  }
}