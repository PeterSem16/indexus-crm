const { test } = require("node:test");
const assert = require("node:assert/strict");
const { analyzeEnrollment, summarize, inspect, MISSION, NAME } = require("./analyze-mission-cooperation-history.cjs");
const options = { "MPN-06a": ["unnecessary"], "MPN-06e": ["unaccepted"] };
const at = n => `2026-10-01T09:00:00.${String(n).padStart(6, "0")}`;
const event = (n, itemId, confirmed = true, contactId = "contact") =>
  ({ id: `${n}-${itemId}-${confirmed}`, contactId, itemId, confirmed, at: at(n) });
const analyze = (events, states = []) => analyzeEnrollment(events, states, ["agreed"], options);

test("missing confirmation is not consent; state-only consent has no invented date", () => {
  const none = analyze([event(1, "unnecessary")], ["unnecessary"]);
  assert.equal(none.potvrdenieSuhlasuVHistorii, false);
  assert.equal(none.prvyPreukazanySubehCasDB["MPN-06a"], null);
  const state = analyze([], ["agreed", "unnecessary"]);
  assert.equal(state.suhlasAktualne, true);
  assert.equal(state.prvyPreukazanySubehCasDB["MPN-06a"], null);
});
test("real concurrent confirmation is retained after a later consent withdrawal", () => {
  const row = analyze([event(1, "agreed"), event(2, "unnecessary"), event(3, "agreed", false)], ["unnecessary"]);
  assert.equal(row.prvyPreukazanySubehCasDB["MPN-06a"], at(2));
  assert.equal(row.preukazaneOdobratiePoPotvrdeni, true);
  assert.equal(row.suhlasNaKonciHistorie, false);
});
test("separate historic occurrences do not prove concurrent agreement", () => {
  const row = analyze([event(1, "agreed"), event(2, "agreed", false), event(3, "unaccepted")], ["unaccepted"]);
  assert.equal(row.potvrdenieSuhlasuVHistorii, true);
  assert.equal(row.prvyPreukazanySubehCasDB["MPN-06e"], null);
});
test("microsecond-distinct changes stay sequential, not one millisecond batch", () => {
  const row = analyze([event(1, "agreed"), event(2, "agreed", false), event(3, "unnecessary")]);
  assert.equal(row.prvyPreukazanySubehCasDB["MPN-06a"], null);
});
test("same-time replacement and contradictory events do not create phantom overlap", () => {
  const replaced = analyze([event(1, "agreed"), event(2, "agreed", false), event(2, "unaccepted")]);
  assert.equal(replaced.prvyPreukazanySubehCasDB["MPN-06e"], null);
  const conflict = analyze([event(1, "unnecessary"), event(2, "agreed"), event(2, "agreed", false)]);
  assert.equal(conflict.rozporneUdalostiVRovnakomCase, true);
  assert.equal(conflict.prvyPreukazanySubehCasDB["MPN-06a"], null);
});
test("reconfirmation and multiple mapped consent choices are evaluated as OR", () => {
  const row = analyzeEnrollment([event(1, "agreed"), event(1, "other-agreed"),
    event(2, "agreed", false), event(3, "unnecessary")], [], ["agreed", "other-agreed"], options);
  assert.equal(row.preukazaneOdobratiePoPotvrdeni, false);
  assert.equal(row.prvyPreukazanySubehCasDB["MPN-06a"], at(3));
});
test("a removal without earlier confirmation is not a proven withdrawal after agreement", () => {
  const row = analyze([event(1, "agreed", false), event(2, "unaccepted")]);
  assert.equal(row.odobratieSuhlasuVHistorii, true);
  assert.equal(row.potvrdenieSuhlasuVHistorii, false);
  assert.equal(row.preukazaneOdobratiePoPotvrdeni, false);
});
test("same clinic's different enrollments never combine; output excludes raw identities", () => {
  const report = summarize([{ id: "first-private", clinicId: "private-clinic" },
    { id: "second-private", clinicId: "private-clinic" }],
  [{ contactId: "first-private", itemId: "unnecessary" }, { contactId: "second-private", itemId: "agreed" }],
  [event(1, "unnecessary", true, "first-private"), event(2, "agreed", true, "second-private")],
  ["agreed"], options);
  assert.equal(report.pocetAmbulancii, 1);
  assert.equal(report.pocetZapisov, 2);
  assert.equal(report.ambulancie[0].zapisy[0].suhlasIbaNaInomZapise, true);
  assert.equal(report.ambulancie[0].zapisy[0].prvyPreukazanySubehCasDB["MPN-06a"], null);
  assert.doesNotMatch(JSON.stringify(report), /private-clinic|first-private|second-private/);
});
test("snapshot is explicitly read-only, Mission-bound and always rolled back", async () => {
  const queries = [];
  const db = { async query(sql, params) {
    queries.push({ sql, params });
    if (sql.startsWith("SELECT name,settings")) return { rows: [{
      name: NAME, settings: { missionFunnel: { sources: { agreed: ["agreed"] } } },
    }] };
    if (sql.startsWith("SELECT id,step_id")) return { rows: [
      { id: "agreed", step: "MPN-05c", label: "Agreed" },
      { id: "unnecessary", step: "MPN-06a", label: "Contract not necessary" },
      { id: "unaccepted", step: "MPN-06e", label: "Unaccepted" },
    ] };
    return { rows: [] };
  } };
  const report = await inspect(db);
  assert.equal(report.pocetAmbulancii, 0);
  assert.match(queries[0].sql, /REPEATABLE READ READ ONLY/);
  assert.equal(queries.at(-1).sql, "ROLLBACK");
  assert.ok(queries.some(q => q.params?.[0] === MISSION));
  for (const { sql } of queries) assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT)\b/i);
  assert.doesNotMatch(queries.map(q => q.sql).join("\n"), /\b(?:email|phone|mobile|password)\b/i);
});
test("wrong Mission is rejected and the snapshot is rolled back", async () => {
  const queries = [];
  await assert.rejects(inspect({ async query(sql) {
    queries.push(sql);
    return { rows: [{ name: "Wrong Mission" }] };
  } }), /Mission identity differs/);
  assert.equal(queries.at(-1), "ROLLBACK");
});
test("real PostgreSQL audit reads only temporary fixtures and keeps same-clinic enrollments separate",
  { skip: !process.env.DATABASE_URL }, async () => {
  const client = new (require("pg").Client)({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query(`
      CREATE TEMP TABLE campaigns(id text PRIMARY KEY,name text,settings jsonb);
      CREATE TEMP TABLE clinics(id text PRIMARY KEY);
      CREATE TEMP TABLE campaign_status_list_items(id text PRIMARY KEY,campaign_id text,step_id text,label text);
      CREATE TEMP TABLE campaign_contacts(id text PRIMARY KEY,clinic_id text,campaign_id text,contact_type text);
      CREATE TEMP TABLE campaign_contact_status_list_state(campaign_contact_id text,status_list_item_id text);
      CREATE TEMP TABLE campaign_contact_history(id text PRIMARY KEY,campaign_contact_id text,metadata jsonb,action text,created_at timestamp);
    `);
    await client.query("INSERT INTO campaigns VALUES($1,$2,$3::jsonb)",
      [MISSION, NAME, JSON.stringify({ missionFunnel: { sources: { agreed: ["agreed"] } } })]);
    await client.query(`INSERT INTO clinics VALUES('clinic-one'),('clinic-two');
      INSERT INTO campaign_status_list_items VALUES
        ('agreed',$1,'MPN-05c','Agreed'),('unnecessary',$1,'MPN-06a','Not necessary'),
        ('unaccepted',$1,'MPN-06e','Unaccepted');
      ` .replaceAll("$1", "'" + MISSION + "'"));
    await client.query(`INSERT INTO campaign_contacts VALUES
      ('first','clinic-one',$1,'clinic'),('second','clinic-one',$1,'clinic'),
      ('third','clinic-two',$1,'clinic')`, [MISSION]);
    await client.query(`INSERT INTO campaign_contact_status_list_state VALUES
      ('first','unnecessary'),('second','agreed'),('third','unaccepted');
      INSERT INTO campaign_contact_history VALUES
      ('h1','first','{"statusListItemId":"agreed","confirmed":true}','status_list_confirmation','2026-10-01 09:00:00.000001'),
      ('h2','first','{"statusListItemId":"unnecessary","confirmed":true}','status_list_confirmation','2026-10-01 09:00:00.000002'),
      ('h3','first','{"statusListItemId":"agreed","confirmed":false}','status_list_confirmation','2026-10-01 09:00:00.000003'),
      ('h4','third','{"statusListItemId":"agreed","confirmed":false}','status_list_confirmation','2026-10-01 09:00:00.000004');
    `);
    const report = await inspect(client);
    assert.equal(report.pocetAmbulancii, 2);
    assert.equal(report.pocetZapisov, 3);
    const first = report.ambulancie[0].zapisy[0];
    assert.equal(first.preukazaneOdobratiePoPotvrdeni, true);
    assert.equal(first.suhlasIbaNaInomZapise, true);
    assert.equal(first.prvyPreukazanySubehCasDB["MPN-06a"], at(2));
    const third = report.ambulancie[1].zapisy[0];
    assert.equal(third.potvrdenieSuhlasuVHistorii, false);
    assert.equal(third.odobratieSuhlasuVHistorii, true);
    assert.equal(third.prvyPreukazanySubehCasDB["MPN-06e"], null);
    assert.equal((await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only, "off");
  } finally { await client.end(); }
});
