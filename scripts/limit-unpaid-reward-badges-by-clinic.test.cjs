const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { TARGETS } = require("./diagnose-image-reward-badge-targets.cjs");
const { resolveTargetPairs, options, approvedPairsFromEarlierReview, deriveApprovedPairsFromSnapshot } = require("./limit-unpaid-reward-badges-by-clinic.cjs");

function fixture() {
  const clinics = TARGETS.map(([, organisation], index) => ({
    id: `clinic-${index + 1}`, name: organisation, pzs_name: null,
  }));
  const people = TARGETS.map(([name], index) => {
    const [firstName, ...lastName] = name.replace(/\s+(MPH|ml\.)$/, "").split(" ");
    return {
      id: `person-${index + 1}`, first_name: firstName, last_name: lastName.join(" "),
      company_name: null, workplace_name: null, clinic_id: `clinic-${index + 1}`, clinic_ids: [],
    };
  });
  return { people, clinics };
}

test("exact name and clinic link select only the pictured pair", () => {
  const { people, clinics } = fixture();
  const result = resolveTargetPairs(people, clinics, []);
  assert.equal(result.matchedTargets, 34);
  assert.equal(result.personIds.size, 34);
  assert.ok(result.pairs.every(([, , , ids]) => ids.length === 1));
  assert.deepEqual(result.unresolvedRows, []);
});

test("reviewed clinic aliases require a real person-clinic link", () => {
  const { people, clinics } = fixture();
  const names = new Map([
    [8, "Gynekologická ambulancia Trenčín s.r.o."],
    [10, "Gynekologická ambulancia,OK GYN,s.r.o."],
    [18, "TRIGYN-L, s.r.o."],
    [34, "Gynekologická ambulancia, Gynomed, s.r.o."],
  ]);
  for (const [row, name] of names) clinics[row - 1].name = name;
  for (const row of [1, 5, 15, 16, 28, 33]) people[row - 1].clinic_id = null;
  const result = resolveTargetPairs(people, clinics, []);
  assert.equal(result.matchedTargets, 28);
  assert.equal(result.matchedViaClinicAlias, 4);
  assert.deepEqual(result.unresolvedRows, [1, 5, 15, 16, 28, 33]);
  assert.equal(result.personIds.size, 28);
});

test("a duplicate linked to the right clinic qualifies, not the same name elsewhere", () => {
  const { people, clinics } = fixture();
  people.push({ ...people[0], id: "other-clinic", clinic_id: clinics[1].id });
  people.push({ ...people[0], id: "same-clinic", clinic_id: null });
  const result = resolveTargetPairs(people, clinics, [
    { person_id: "same-clinic", entity_id: clinics[0].id },
  ]);
  assert.equal(result.personIds.size, 35);
  assert.equal(result.personIds.has("other-clinic"), false);
  assert.equal(result.personIds.has("same-clinic"), true);
  const pair = result.pairs.find(([, , id]) => id === "same-clinic");
  assert.deepEqual(pair[3], [clinics[0].id]);
});

test("commit needs an explicit expectation for unresolved targets", () => {
  assert.throws(() => options(["--commit", "--expect-database", "indexus_crm"]), /Commit requires/);
  assert.throws(() => options(["--expect-unresolved", "6"]), /Confirmation options require/);
});

test("earlier private snapshot independently pins all approved person-clinic IDs", () => {
  const { people, clinics } = fixture();
  const aliases = new Map([
    [8, "Gynekologická ambulancia Trenčín s.r.o."],
    [10, "Gynekologická ambulancia,OK GYN,s.r.o."],
    [18, "TRIGYN-L, s.r.o."],
    [34, "Gynekologická ambulancia, Gynomed, s.r.o."],
  ]);
  for (const [row, name] of aliases) clinics[row - 1].name = name;
  for (const row of [1, 5, 15, 16, 28, 33]) people[row - 1].clinic_id = null;
  const current = resolveTargetPairs(people, clinics, []);
  const earlierTargets = current.details.map((target, index) =>
    aliases.has(index + 1)
      ? { ...target, selection: "unresolved", candidates: target.candidates.map(c => ({ ...c, selected: false })) }
      : target);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reward-badge-review-"));
  const file = path.join(dir, "review.json");
  try {
    const report = {
      database: "indexus_crm",
      planHash: "a4928b54a6f70fab8032c6c38aaada240f268c0822f90e110ca5dbd21319a90e",
      targets: earlierTargets,
    };
    fs.writeFileSync(file, JSON.stringify(report), { mode: 0o600 });
    assert.throws(() => approvedPairsFromEarlierReview(file), /bytes differ/);
    const approved = deriveApprovedPairsFromSnapshot(report);
    assert.equal(approved.length, 28);
    assert.deepEqual(approved.map(([person, clinic]) => [person, clinic]),
      current.pairs.map(([, , person, clinics]) => [person, clinics[0]])
        .sort((a, b) => a[0].localeCompare(b[0])));
    earlierTargets[1].candidates.push({
      id: "unexpected", selected: true,
      linkedClinics: [{ id: "clinic-2", name: TARGETS[1][1], providerName: null }],
    });
    assert.equal(deriveApprovedPairsFromSnapshot(report).length, 29);
    earlierTargets[1].name = "Wrong target";
    assert.throws(() => deriveApprovedPairsFromSnapshot(report), /unexpected target order/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});