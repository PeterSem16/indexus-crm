const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const cp = require("node:child_process");
const { createRequire } = require("node:module");
const { MISSION, NAME, BASELINE, loadEngines, policySources, parseArgs, summarize, inspect } = require("./audit-mission-funnel-impact.cjs");
const { packageEvidence } = require("./mission-package-evidence.cjs");
const fs = require("node:fs");
// Reconstruct only the pure pinned production sources in a temporary fixture.
// Tests must not depend on ignored release artifacts or unfinished app code.
const app = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "funnel-impact-test-"));
after(() => fs.rmSync(app, { recursive: true, force: true }));
for (const filename of ["server/lib/mission-funnel.ts", "server/lib/mission-funnel-actors.ts",
  "shared/mission-funnel.ts", "shared/mission-cooperation-policy.ts", "shared/email-purpose.ts"]) {
  const target = path.join(app, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, cp.execFileSync("git", ["show", BASELINE + ":" + filename]));
}
const native = cp.execFileSync("git", ["show", BASELINE + ":server/lib/mission-funnel.ts"], { encoding: "utf8" });
assert.equal(fs.readFileSync(path.join(app, "server/lib/mission-funnel.ts"), "utf8"), native);
const engines = loadEngines(app, createRequire(path.resolve("package.json")));
const dates = { from: "2026-11-01", to: "2026-11-03" };
const now = new Date("2026-11-03T10:00:00Z");
const codes = ["MPN-04b", "MPN-05c", "MPN-06a", "MPN-06b", "MPN-06c", "MPN-06d", "MPN-06e", "MPN-12e", "MPN-13d"];
function fixture() {
  const config = { version: 1, materials: { packageSent: ["MPN-13d"], excluded: { materials17: [], materials18: [], materials19: [] } },
    sources: Object.fromEntries(["qualified","agreed","proposalAccepted","proposalUnaccepted","proposalOther","email","sent","received","returned","validated","activeWith","activeWithout","materials17","materials18","materials19","unqualified","refused","absent","wrongNumber","notWorking"].map(k => [k, []])) };
  Object.assign(config.sources, { qualified: ["MPN-04b"], agreed: ["MPN-05c"], proposalAccepted: ["MPN-06d"],
    proposalUnaccepted: ["MPN-06e"], proposalOther: ["MPN-06a","MPN-06b","MPN-06c"], validated: ["MPN-12e"], materials17: ["MPN-13d"] });
  return { config, items: codes.map(stepId => ({ id: stepId, stepId, label: "", parentId: null })),
    clinics: [], enrollments: [], events: [], states: [], calls: [] };
}
function clinic(input, id, answers, dialed = "2026-11-01T09:00:00Z", answered = false) {
  input.clinics.push({ id, name: "PRIVATE_PERSON_NAME", representativeId: null, referred: false });
  input.enrollments.push({ id: "contact-"+id, clinicId: id });
  for (const [i, itemId] of answers.entries()) {
    input.events.push({ id: `${id}-${i}`, contactId: "contact-"+id, itemId, confirmed: true, at: "2026-11-02T09:00:00Z" });
    input.states.push({ contactId: "contact-"+id, itemId, at: "2026-11-02T09:00:00Z" });
  }
  if (dialed) input.calls.push({ id: "call-"+id, clinicId: id, contactId: "contact-"+id, at: dialed,
    direction: "outbound", status: answered ? "completed" : "no_answer",
    answeredAt: answered ? dialed : null, duration: answered ? 20 : 0 });
}
test("only valid read-only CLI and real calendar dates are accepted", () => {
  assert.deepEqual(parseArgs(["--check","--from","2026-11-01","--to","2026-11-03"]), dates);
  assert.deepEqual(parseArgs(["--check","--package-details"]), { packageDetails: true });
  for (const args of [["--apply"], ["--check"], ["--check","--from","2026-02-30","--to","2026-11-03"],
    ["--check","--from","2026-11-04","--to","2026-11-03"]]) assert.throws(() => parseArgs(args));
});
function detail(input) {
  for (const e of input.events) e.atExact ??= e.at.slice(0,19)+".000000";
  return packageEvidence(input, engines.baseline, now);
}
test("package detail distinguishes missing consent from missing validation", () => {
  const input = fixture();
  clinic(input, "private-a", ["MPN-06d","MPN-13d"]);
  clinic(input, "private-b", ["MPN-05c","MPN-06d","MPN-13d"]);
  const result = detail(input);
  assert.equal(result.pocetAmbulanciiSDokazomBalika,2);
  const [a,b] = result.ambulancie.map(c => c.zapisy[0]);
  assert.deepEqual(a.aktualne.chybaPreZmluvnuVetvu,["súhlas","overená zmluva"]);
  assert.deepEqual(b.aktualne.chybaPreZmluvnuVetvu,["overená zmluva"]);
  assert.equal(a.prveHistorickeSubehyUTCdb.spolupraca,null);
  assert.equal(b.vysledokNasadenehoVypoctu.cooperating,false);
  assert.doesNotMatch(JSON.stringify(result), /private-a|private-b|PRIVATE_|contact-/);
});
test("historical validation and consent must overlap; withdrawal remains visible", () => {
  const input = fixture(); clinic(input,"private-a",[]);
  const contactId="contact-private-a";
  for (const [i,itemId,confirmed] of [[1,"MPN-05c",true],[2,"MPN-05c",false],
    [3,"MPN-06d",true],[4,"MPN-12e",true],[5,"MPN-13d",true]]) {
    input.events.push({id:String(i),contactId,itemId,confirmed,at:`2026-11-02T09:00:0${i}Z`,
      atExact:`2026-11-02T09:00:0${i}.000001`});
  }
  const result=detail(input).ambulancie[0].zapisy[0];
  assert.equal(result.dokazyPodlaUlozenehoMapovania.agreed.potvrdeneVHistorii,true);
  assert.equal(result.dokazyPodlaUlozenehoMapovania.agreed.odobrateVHistorii,true);
  assert.equal(result.prveHistorickeSubehyUTCdb.zmluvnaSpolupraca,null);
  assert.equal(result.vysledokNasadenehoVypoctu.cooperating,false);
});
test("valid historical cooperation survives withdrawal without inventing a state date", () => {
  const input=fixture();clinic(input,"private-a",["MPN-05c","MPN-06d","MPN-12e","MPN-13d"]);
  input.events.push({id:"remove",contactId:"contact-private-a",itemId:"MPN-05c",confirmed:false,
    at:"2026-11-03T09:00:00Z",atExact:"2026-11-03T09:00:00.000000"});
  input.states=input.states.filter(s=>s.itemId!=="MPN-05c");
  const result=detail(input).ambulancie[0].zapisy[0];
  assert.equal(result.aktualne.spolupraca,false);
  assert.equal(result.vysledokNasadenehoVypoctu.cooperating,true);
  assert.equal(result.prveHistorickeSubehyUTCdb.zmluvnaSpolupraca,"2026-11-02T09:00:00.000000");
  assert.equal(result.prveHistorickeSubehyUTCdb.materialyPodlaPovodnehoPravidla,"2026-11-02T09:00:00.000000");
});
test("current-only validation reports no historical date and native state fallback", () => {
  const input=fixture();clinic(input,"private-a",["MPN-05c","MPN-06d","MPN-13d"]);
  input.states.push({contactId:"contact-private-a",itemId:"MPN-12e",at:"2026-11-03T09:00:00Z"});
  const result=detail(input).ambulancie[0].zapisy[0];
  assert.equal(result.dokazyPodlaUlozenehoMapovania.validated.stavBezAkejKolvekHistorie,true);
  assert.equal(result.prveHistorickeSubehyUTCdb.zmluvnaSpolupraca,null);
  assert.equal(result.vysledokNasadenehoVypoctu.cooperating,true);
  assert.equal(result.nativnyVypocetPouzivaAjStavBezHistorie,true);
});
test("detail preserves exact microseconds and never joins different enrollments", () => {
  const input=fixture();clinic(input,"private-a",["MPN-06d","MPN-12e","MPN-13d"]);
  input.events.push(
    {id:"x1",contactId:"contact-private-a",itemId:"MPN-05c",confirmed:true,at:"2026-11-02T08:00:00Z",atExact:"2026-11-02T08:00:00.000001"},
    {id:"x2",contactId:"contact-private-a",itemId:"MPN-05c",confirmed:false,at:"2026-11-02T08:00:00Z",atExact:"2026-11-02T08:00:00.000002"});
  input.enrollments.push({id:"other-enrollment",clinicId:"private-a"});
  input.states.push({contactId:"other-enrollment",itemId:"MPN-05c",at:"2026-11-02T08:00:00Z"});
  const result=detail(input).ambulancie[0];
  assert.equal(result.pocetZapisov,2);
  assert.ok(result.zapisy.every(r=>!r.vysledokNasadenehoVypoctu.cooperating));
  const primary=result.zapisy.find(r=>r.aktualne.balik);
  assert.equal(primary.suhlasExistujeIbaNaInomZapise,true);
  assert.equal(primary.prveHistorickeSubehyUTCdb.zmluvnaSpolupraca,null);
  assert.equal(primary.pocetHistorickychDavok,3);
});
test("exact-timestamp contradictory consent is diagnosed, not chosen by event ID", () => {
  const input=fixture();clinic(input,"private-a",["MPN-05c","MPN-06d","MPN-12e","MPN-13d"]);
  input.events.push({id:"zzz",contactId:"contact-private-a",itemId:"MPN-05c",confirmed:false,at:"2026-11-02T09:00:00Z"});
  const result=detail(input).ambulancie[0].zapisy[0];
  assert.equal(result.rozporVPresnomCase,true);
  assert.equal(result.prveHistorickeSubehyUTCdb.zmluvnaSpolupraca,null);
});
test("policy simulations fail closed when a native anchor changes", () => {
  assert.equal(Object.keys(policySources(native)).length, 3);
  assert.throws(() => policySources(native.replace("if (legacyCooperationReached.has(target)", "if (changed.has(target)")), /ANCHOR_CHANGED/);
});
test("materials model quantifies the broadened cooperation without mutating input", () => {
  const input = fixture(); clinic(input, "private-a", ["MPN-06a","MPN-13d"]);
  const before = JSON.stringify(input);
  const result = summarize(input, engines, dates, now).porovnania[2];
  assert.equal(result.aktualnyFunnel.cooperating.celkom, 1);
  assert.equal(result.aktualnyFunnel.materials.celkom, 0);
  assert.equal(result.modelMaterialyPodlaZobrazenejSpoluprace.celkom, 1);
  assert.equal(result.modelMaterialyPodlaZobrazenejSpoluprace.percentoPredchadzajuceho, 100);
  assert.equal(result.modelMaterialyPodlaZobrazenejSpoluprace.pribudliBy.pocet, 1);
  assert.equal(JSON.stringify(input), before);
});
test("accepted-only contract model retains accepted and independently excludes other proposals", () => {
  const input = fixture();
  for (const [id, code] of [["a","MPN-06a"],["b","MPN-06b"],["c","MPN-06c"],["d","MPN-06d"]])
    clinic(input, "private-"+id, ["MPN-05c", code]);
  const result = summarize(input, engines, dates, now).porovnania[2];
  assert.equal(result.aktualnyFunnel.wantsContract.celkom, 4);
  assert.equal(result.modelChceZmluvuIbaSuhlasAPrijataPonuka.celkom, 1);
  assert.equal(result.modelChceZmluvuIbaSuhlasAPrijataPonuka.ubudliBy.pocet, 3);
});
test("direct calls, inferred contact and unknown physician identity stay separate", () => {
  const input = fixture(); clinic(input, "private-a", ["MPN-05c"]);
  clinic(input, "private-b", [], undefined, true);
  const result = summarize(input, engines, dates, now).porovnania[2].zastihnutie;
  assert.equal(result.celkom, 2); assert.equal(result.priamyDokazSpojenehoHovoru, 1);
  assert.equal(result.ibaOdvodene, 1); assert.equal(result.preukazanyRozhovorSLekarom, null);
});
test("inventory, all-time first-call cohort and selected cohort are explicitly distinct", () => {
  const input = fixture(); clinic(input, "private-a", ["MPN-06a"], null);
  clinic(input, "private-b", ["MPN-06a"], "2026-10-10T09:00:00Z");
  clinic(input, "private-c", ["MPN-06a"], "2026-11-01T09:00:00Z");
  const counts = summarize(input, engines, dates, now).porovnania.map(s => s.aktualnyFunnel.cooperating.celkom);
  assert.deepEqual(counts, [3,2,1]);
});
test("non-overlapping historical package proof and cooperation never invent a new materials attainment", () => {
  const input = fixture(); clinic(input, "private-a", []);
  input.events.push(
    {id:"1",contactId:"contact-private-a",itemId:"MPN-13d",confirmed:true,at:"2026-11-01T10:00:00Z"},
    {id:"2",contactId:"contact-private-a",itemId:"MPN-13d",confirmed:false,at:"2026-11-01T11:00:00Z"},
    {id:"3",contactId:"contact-private-a",itemId:"MPN-06a",confirmed:true,at:"2026-11-02T10:00:00Z"});
  input.states.push({contactId:"contact-private-a",itemId:"MPN-06a",at:"2026-11-02T10:00:00Z"});
  const result = summarize(input, engines, dates, now).porovnania[2];
  assert.equal(result.dokazBalikaAspoRazAleboAktualne.pocet, 1);
  assert.equal(result.modelMaterialyPodlaZobrazenejSpoluprace.celkom, 0);
});
test("different enrollments of one clinic never manufacture a joint proof", () => {
  const input = fixture(); clinic(input, "private-a", ["MPN-06a"]);
  input.enrollments.push({id:"second-private",clinicId:"private-a"});
  input.states.push({contactId:"second-private",itemId:"MPN-13d",at:"2026-11-02T09:00:00Z"});
  const result = summarize(input, engines, dates, now).porovnania[2];
  assert.equal(result.modelMaterialyPodlaZobrazenejSpoluprace.celkom, 0);
});
test("all scopes use consistent anonymous tokens and never disclose source identities", () => {
  const input = fixture(); clinic(input, "PRIVATE_CLINIC_ID", ["MPN-06a","MPN-13d"]);
  const result = summarize(input, engines, dates, now);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|contact-|call-/);
  assert.ok(result.porovnania.every(s => s.dokazBalikaAspoRazAleboAktualne.ambulancie[0].kod === "K0001"));
});
test("snapshot is enforced read-only and always rolled back, including failure", async () => {
  for (const wrong of [false, true]) {
    const queries = [];
    const client = { async query(sql, params) {
      queries.push({sql,params});
      if (sql.startsWith("SELECT current_setting")) return {rows:[{readOnly:"on",databaseTimeZone:"UTC",now}]};
      if (sql.startsWith("SELECT name,settings")) return {rows:[{name:wrong?"Other":NAME,settings:JSON.stringify({missionFunnel:fixture().config})}]};
      return {rows:[]};
    }};
    if (wrong) await assert.rejects(inspect(client, engines, dates), /MISSION_IDENTITY_CHANGED/);
    else assert.equal((await inspect(client, engines, dates)).inventura.ambulancie, 0);
    assert.match(queries[0].sql, /REPEATABLE READ READ ONLY/);
    assert.equal(queries.at(-1).sql, "ROLLBACK");
    for (const q of queries) assert.doesNotMatch(q.sql, /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|COMMIT)\b/i);
    assert.ok(queries.some(q => q.params?.[0] === MISSION));
  }
});
test("real PostgreSQL reads only temporary fixture tables and preserves their bytes",
  {skip:!process.env.DATABASE_URL}, async () => {
  const client = new (require("pg").Client)({connectionString:process.env.DATABASE_URL});
  try {
    await client.connect();
    await client.query(`
      CREATE TEMP TABLE campaigns(id text PRIMARY KEY,name text,settings text);
      CREATE TEMP TABLE clinics(id text PRIMARY KEY,representative_id text,is_referred_by_doctor boolean);
      CREATE TEMP TABLE campaign_contacts(id text PRIMARY KEY,clinic_id text,campaign_id text,contact_type text);
      CREATE TEMP TABLE campaign_status_list_items(id text PRIMARY KEY,campaign_id text,step_id text,parent_id text,sort_order integer);
      CREATE TEMP TABLE campaign_contact_history(id text PRIMARY KEY,campaign_contact_id text,metadata jsonb,action text,created_at timestamp);
      CREATE TEMP TABLE campaign_contact_status_list_state(campaign_contact_id text,status_list_item_id text,confirmed_at timestamp);
      CREATE TEMP TABLE call_logs(id text PRIMARY KEY,campaign_contact_id text,customer_id text,campaign_id text,direction text,status text,
        started_at timestamp,answered_at timestamp,duration_seconds integer,sip_call_id text,metadata text);
    `);
    const raw = JSON.stringify({missionFunnel:fixture().config});
    await client.query("INSERT INTO campaigns VALUES($1,$2,$3)", [MISSION,NAME,raw]);
    for (const code of codes) await client.query("INSERT INTO campaign_status_list_items VALUES($1,$2,$1,NULL,0)",[code,MISSION]);
    await client.query("INSERT INTO clinics VALUES('private-clinic',NULL,false)");
    await client.query("INSERT INTO campaign_contacts VALUES('private-contact','private-clinic',$1,'clinic')",[MISSION]);
    await client.query(`INSERT INTO campaign_contact_history VALUES
      ('h1','private-contact','{\"statusListItemId\":\"MPN-06a\",\"confirmed\":true}','status_list_confirmation','2026-11-02 10:00:00'),
      ('h2','private-contact','{\"statusListItemId\":\"MPN-13d\",\"confirmed\":true}','status_list_confirmation','2026-11-02 11:00:00')`);
    await client.query(`INSERT INTO campaign_contact_status_list_state VALUES
      ('private-contact','MPN-06a','2026-11-02 10:00:00'),('private-contact','MPN-13d','2026-11-02 11:00:00')`);
    await client.query(`INSERT INTO call_logs VALUES('call','private-contact','private-clinic',$1,'outbound','no_answer',
      '2026-11-01 09:00:00',NULL,0,'sip','legacy-not-json')`,[MISSION]);
    // A conflicting live contact link must never move the selected clinic's
    // first call into an earlier cohort merely because customer_id matches.
    await client.query("INSERT INTO campaign_contacts VALUES('foreign-contact','foreign-clinic','other-mission','clinic')");
    await client.query(`INSERT INTO call_logs VALUES('conflicting','foreign-contact','private-clinic',$1,'outbound','completed',
      '2026-09-01 09:00:00','2026-09-01 09:00:10',20,'foreign-sip','{}')`,[MISSION]);
    const before = (await client.query("SELECT md5(row_to_json(c)::text) AS hash FROM campaigns c")).rows[0].hash;
    const result = await inspect(client, engines, dates);
    assert.equal(result.porovnania[2].aktualnyFunnel.cooperating.celkom,1);
    assert.equal(result.porovnania[2].zastihnutie.priamyDokazSpojenehoHovoru,0);
    assert.equal(result.porovnania[2].modelMaterialyPodlaZobrazenejSpoluprace.pribudliBy.pocet,1);
    assert.doesNotMatch(JSON.stringify(result), /private-clinic|private-contact/);
    assert.equal((await client.query("SELECT md5(row_to_json(c)::text) AS hash FROM campaigns c")).rows[0].hash,before);
    assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM campaign_contact_history")).rows[0].n,2);
    const packageReport = await inspect(client, engines, {packageDetails:true});
    assert.equal(packageReport.pocetAmbulanciiSDokazomBalika,1);
    assert.equal(packageReport.ambulancie[0].zapisy[0].dokazyPodlaUlozenehoMapovania.packageSent.prvePotvrdenieUTCdb,
      "2026-11-02T11:00:00.000000");
    assert.equal((await client.query("SELECT md5(row_to_json(c)::text) AS hash FROM campaigns c")).rows[0].hash,before);
  } finally { await client.end(); }
});
