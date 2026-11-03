const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MISSION, NAME, PATH, mapPackage } = require("./map-mission-materials-package.cjs");
function settings() {
  return { unrelated: { enabled: true, array: ["keep"], numeric: 14.5 },
    missionFunnel: { version: 1, emailPurposes: ["cooperation_proposal"],
      sources: { materials17: ["sent"], materials18: ["flyers"], materials19: ["books"], agreed: ["consent"] },
      materials: { packageSent: [], excluded: { materials17: [], materials18: ["declined"], materials19: [] } } } };
}
function fixture(change = () => {}, options = {}) {
  const before = settings(); change(before);
  const calls = [];
  const db = { calls, async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith("SELECT name,settings")) return { rows: [{ name: options.name ?? NAME, settings: JSON.stringify(before) }] };
    if (sql.startsWith("SELECT id,item_type")) return { rows: options.items ?? [{ id: "sent", item_type: "option" }] };
    if (sql.startsWith("UPDATE campaigns")) {
      const after = structuredClone(before);
      after.missionFunnel.materials.packageSent = ["sent"];
      return { rows: [{ settings: JSON.stringify(after) }] };
    }
    if (sql.startsWith("SELECT ($1")) return { rows: [{ unchanged: !options.otherChanged }] };
    return { rows: [] };
  } };
  return db;
}
test("check is read-only and never updates settings or operational records", async () => {
  const db = fixture(); const result = await mapPackage(db);
  assert.match(db.calls[0].sql, /READ ONLY/);
  assert.equal(result.zmenaVykonana, false);
  assert.equal(result.zmenaPotrebna, true);
  assert.equal(db.calls.at(-1).sql, "ROLLBACK");
  assert.ok(!db.calls.some(q => /\b(UPDATE|INSERT|DELETE|FOR SHARE)\b/.test(q.sql)));
});
test("approved apply locks the exact Mission and changes only the JSON leaf", async () => {
  const db = fixture(); const result = await mapPackage(db, true);
  assert.equal(result.zmenaVykonana, true);
  assert.ok(db.calls.some(q => /FOR UPDATE$/.test(q.sql)));
  assert.ok(db.calls.some(q => /FOR SHARE$/.test(q.sql)));
  const updates = db.calls.filter(q => q.sql.startsWith("UPDATE"));
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].params, [MISSION, PATH, ["sent"]]);
  assert.match(updates[0].sql, /jsonb_set\(settings::jsonb/);
  assert.ok(!db.calls.some(q => /\b(INSERT|DELETE|ALTER|DROP|CREATE)\b/.test(q.sql)));
  assert.equal(db.calls.at(-1).sql, "COMMIT");
});
test("re-running an already applied mapping is a successful no-op", async () => {
  const db = fixture(s => s.missionFunnel.materials.packageSent = ["sent"]);
  const result = await mapPackage(db, true);
  assert.equal(result.zmenaPotrebna, false);
  assert.equal(result.zmenaVykonana, false);
  assert.ok(!db.calls.some(q => q.sql.startsWith("UPDATE")));
});
test("the reviewed imported positive choice may be stored as a step", async () => {
  const db = fixture(() => {}, { items: [{ id: "sent", item_type: "step" }] });
  assert.equal((await mapPackage(db, true)).zmenaVykonana, true);
});
test("unexpected Mission, ambiguous item, mapping or settings abort before writing", async () => {
  const variants = [
    fixture(() => {}, { name: "Other Mission" }),
    fixture(() => {}, { items: [] }),
    fixture(() => {}, { items: [{ id: "sent", item_type: "option" }, { id: "duplicate", item_type: "option" }] }),
    fixture(() => {}, { items: [{ id: "sent", item_type: "group" }] }),
    fixture(s => s.missionFunnel.sources.materials17 = []),
    fixture(s => s.missionFunnel.materials.packageSent = ["other"]),
    fixture(s => delete s.missionFunnel.materials),
  ];
  for (const db of variants) {
    await assert.rejects(mapPackage(db, true));
    assert.equal(db.calls.at(-1).sql, "ROLLBACK");
    assert.ok(!db.calls.some(q => q.sql.startsWith("UPDATE")));
  }
});
test("an unexpected change outside the approved field rolls back", async () => {
  const db = fixture(() => {}, { otherChanged: true });
  await assert.rejects(mapPackage(db, true), /OTHER_SETTINGS_CHANGED/);
  assert.equal(db.calls.at(-1).sql, "ROLLBACK");
  assert.ok(!db.calls.some(q => q.sql === "COMMIT"));
});
test("real PostgreSQL text settings preserve exact other JSON and support idempotency",
  { skip: !process.env.DATABASE_URL }, async () => {
  const client = new (require("pg").Client)({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query("CREATE TEMP TABLE campaigns(id text PRIMARY KEY,name text,settings text)");
    await client.query("CREATE TEMP TABLE campaign_status_list_items(id text PRIMARY KEY,campaign_id text,step_id text,item_type text)");
    const original = JSON.stringify(settings()).replace('"numeric":14.5', '"numeric":900719925474099312345');
    await client.query("INSERT INTO campaigns VALUES($1,$2,$3)", [MISSION, NAME, original]);
    await client.query("INSERT INTO campaign_status_list_items VALUES('sent',$1,'MPN-13d','option')", [MISSION]);
    assert.equal((await mapPackage(client)).zmenaVykonana, false);
    assert.equal((await client.query("SELECT settings FROM campaigns")).rows[0].settings, original);
    assert.equal((await mapPackage(client, true)).zmenaVykonana, true);
    const result = (await client.query("SELECT settings FROM campaigns")).rows[0].settings;
    assert.match(result, /900719925474099312345/);
    assert.deepEqual(JSON.parse(result).missionFunnel.materials.packageSent, ["sent"]);
    assert.equal((await mapPackage(client, true)).zmenaVykonana, false);
  } finally { await client.end(); }
});
