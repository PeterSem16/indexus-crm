const test = require("node:test");
const assert = require("node:assert/strict");
const { applyReviewed, approved, validPhone } = require("./add-approved-medical-partner-clinics.cjs");

function database(options = {}) {
  let contacts = new Map(options.existing ? approved.map(([id]) => [id, 1]) : []);
  let before;
  const calls = [];
  let inserts = 0;
  let timelines = 0;
  return {
    calls,
    get contacts() { return contacts; },
    get timelines() { return timelines; },
    async query(sql, args = []) {
      const q = sql.replace(/\s+/g, " ").trim();
      calls.push(q);
      if (q.startsWith("BEGIN")) before = new Map(contacts);
      if (q === "ROLLBACK") { contacts = new Map(before); timelines = 0; }
      const result = rows => ({ rows, rowCount: rows.length });
      if (q.startsWith("SELECT id, name, country_codes")) return result([{
        id: "a65e7775-885c-4413-b2be-e63c92decd3d",
        name: options.wrongMission ? "Other Mission" : "Medical Partner Cooperation",
        status: "active", country_codes: ["SK"],
      }]);
      if (q.startsWith("SELECT id FROM campaign_phases")) return result(options.phase ? [{ id: "phase" }] : []);
      if (q.startsWith("WITH RECURSIVE")) return result(
        approved.filter((_, i) => !options.missingPerson || i !== 5).map(([id]) => ({ clinic_id: id }))
      );
      if (q.startsWith("SELECT id, name, country_code")) {
        const [id, name] = approved.find(([id]) => id === args[0]);
        return result([{
          id, name, country_code: options.wrongCountry ? "CZ" : "SK",
          is_active: true, pzs_code: "", phone: "+421901234567",
        }]);
      }
      if (q.startsWith("SELECT 1 FROM dedupe_entity_aliases")) return result(options.redirect ? [{ one: 1 }] : []);
      if (q.startsWith("SELECT id, contact_type")) return result(
        Array.from({ length: options.duplicate ? 2 : contacts.get(args[1]) || 0 },
          (_, i) => ({ id: `contact-${i}`, contact_type: "clinic" }))
      );
      if (q.startsWith("INSERT INTO campaign_contacts")) {
        if (options.failAt === ++inserts) throw Object.assign(new Error("simulated insert failure"), { code: "23514" });
        contacts.set(args[2], (contacts.get(args[2]) || 0) + 1);
      }
      if (q.startsWith("INSERT INTO entity_campaign_timeline")) timelines++;
      if (q.startsWith("SELECT clinic_id, count")) return result(
        [...contacts].map(([clinic_id, count]) => ({ clinic_id, count }))
      );
      if (q.startsWith("SELECT count(*)")) return result([{ total: 753 + contacts.size }]);
      return result([]);
    },
  };
}

test("reviewed cohort has exactly thirteen distinct clinic IDs", () => {
  assert.equal(approved.length, 13);
  assert.equal(new Set(approved.map(([id]) => id)).size, 13);
});
test("normalizes SK phones and rejects obviously invalid/foreign numbers", () => {
  for (const value of ["+421 901 234 567", "00421901234567", "0901234567", "901234567"]) assert.ok(validPhone(value));
  for (const value of ["", "0900000000", "+420901234567", "03769329855812"]) assert.ok(!validPhone(value));
});
test("adds thirteen contacts with thirteen timeline events and commits", async () => {
  const db = database();
  const result = await applyReviewed(db, true);
  assert.equal(result.total, 766);
  assert.equal(db.contacts.size, 13);
  assert.equal(db.timelines, 13);
  assert.equal(db.calls.at(-1), "COMMIT");
  assert.ok(db.calls.find(q => q.startsWith("LOCK TABLE")));
  assert.ok(!db.calls.some(q => /^(DELETE|UPDATE|TRUNCATE)/.test(q)));
});
test("repeat application skips existing members and does not add audit duplicates", async () => {
  const db = database({ existing: true });
  await applyReviewed(db, true);
  assert.equal(db.contacts.size, 13);
  assert.equal(db.timelines, 0);
  assert.ok(!db.calls.some(q => q.startsWith("INSERT")));
});
test("read-only preview never writes or locks", async () => {
  const db = database();
  await applyReviewed(db, false);
  assert.equal(db.contacts.size, 0);
  assert.equal(db.calls.at(-1), "ROLLBACK");
  assert.ok(!db.calls.some(q => /^(INSERT|UPDATE|DELETE|LOCK)/.test(q)));
});
test("partial insert failure rolls back all inserted rows", async () => {
  const db = database({ failAt: 6 });
  await assert.rejects(applyReviewed(db, true));
  assert.equal(db.contacts.size, 0);
  assert.equal(db.timelines, 0);
  assert.equal(db.calls.at(-1), "ROLLBACK");
});
for (const guard of ["wrongMission", "phase", "wrongCountry", "missingPerson", "redirect", "duplicate"]) {
  test(`fails closed for ${guard}`, async () => {
    const db = database({ [guard]: true });
    await assert.rejects(applyReviewed(db, true));
    assert.equal(db.contacts.size, 0);
    assert.equal(db.calls.at(-1), "ROLLBACK");
  });
}