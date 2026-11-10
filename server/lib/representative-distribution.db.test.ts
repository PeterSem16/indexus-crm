import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "../db";
import { resolveBulkSelection } from "../representative-routes";
import { assignMedicalPartnerRepresentative } from "./representative-assignment";
import { buildDistribution, saveDistribution, processDistribution, selectionRows, regionGroups, parseDistributionInput } from "./representative-distribution";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tx = drizzle(client), now = new Date(), prefix = "distribution-fixture-" + randomUUID();
    let { rows: [role] } = await client.query(`SELECT id FROM roles WHERE lower(name) IN ('representative','representant') LIMIT 1`);
    if (!role) ({ rows: [role] } = await client.query(`INSERT INTO roles(name) VALUES('Representative') RETURNING id`));
    const people: string[] = [];
    for (let index = 0; index < 4; index++) {
      const id = randomUUID(); people.push(id);
      await client.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,role_id,assigned_countries)
        VALUES($1,$2,$3,$4,'invalid-test-hash',$5,$6,ARRAY['SK','CZ'])`,
      [id, `${prefix}-${index}`, `${prefix}-${index}@example.invalid`, `Distribution fixture ${index}`, index ? "user" : "admin", index ? role.id : null]);
    }
    const [actor, original, second, third] = people;
    async function create(entity: "clinic" | "hospital", region: string | null, country = "SK") {
      const id = randomUUID();
      await client.query(`INSERT INTO ${entity === "clinic" ? "clinics" : "hospitals"}(id,name,country_code,region)
        VALUES($1,$2,$3,$4)`, [id, prefix, country, region]);
      await assignMedicalPartnerRepresentative(tx, { entityType: entity, entityId: id, userId: original, assignedBy: actor, assignmentType: "manual", validFrom: new Date(now.getTime() - 60000) });
      return id;
    }
    const clinicIds = [await create("clinic", "A"), await create("clinic", "B"), await create("clinic", null), await create("clinic", "A", "CZ")];
    const selection = await resolveBulkSelection({ entity: "clinic", criteria: { search: prefix, countryScope: ["SK", "CZ"] },
      req: { session: { user: { role: "manager", assignedCountries: ["SK"] } } } as any, executor: tx });
    assert.equal(selection.ids.length, 3, "Manager country grant is authoritative");
    assert(!selection.ids.includes(clinicIds[3]));
    const rows = await selectionRows(client, "clinic", selection.ids);
    assert.equal(regionGroups(rows).length, 3, "Missing regions form an explicit group");
    const regional = parseDistributionInput({ entity: "clinic", kind: "assign", regions: [
      { countryCode: "SK", region: "A", userId: second }, { countryCode: "SK", region: "B", userId: third },
    ] });
    const built = await buildDistribution(client, regional, rows, actor, now);
    assert.equal(built.affected, 2); assert.equal(built.unchanged, 1);
    const plan = await saveDistribution(client, regional, built, actor);
    await processDistribution(client, plan, now);
    const current = async (entity: string, id: string) => (await client.query(`SELECT representative_id FROM ${entity} WHERE id=$1`, [id])).rows[0].representative_id;
    assert.equal(await current("clinics", clinicIds[0]), second);
    assert.equal(await current("clinics", clinicIds[1]), third);
    assert.equal(await current("clinics", clinicIds[2]), original);
    console.log("PASS: regional split, unknown regions, unselected records and country restrictions");

    const staleId = await create("clinic", "Stale");
    const staleInput = parseDistributionInput({ entity: "clinic", kind: "assign",
      regions: [{ countryCode: "SK", region: "Stale", userId: second }] });
    const firstPreview = await buildDistribution(client, staleInput, await selectionRows(client, "clinic", [staleId]), actor, now);
    await assignMedicalPartnerRepresentative(tx, { entityType: "clinic", entityId: staleId, userId: third,
      assignedBy: actor, assignmentType: "manual", validFrom: now });
    const nextPreview = await buildDistribution(client, staleInput, await selectionRows(client, "clinic", [staleId]), actor, now);
    assert.notEqual(firstPreview.fingerprint, nextPreview.fingerprint, "A reassignment invalidates the complete confirmation snapshot");
    console.log("PASS: changed assignment identity invalidates preview even with the same selected IDs");

    const hospitalIds = [await create("hospital", "H"), await create("hospital", "H")];
    const starts = new Date(now.getTime() + 120000), ends = new Date(now.getTime() + 300000);
    const temp = parseDistributionInput({ entity: "hospital", kind: "temporary", fromUserId: original,
      startsAt: starts.toISOString(), endsAt: ends.toISOString(), regions: [{ countryCode: "SK", region: "H", userId: second }] });
    const hr = await selectionRows(client, "hospital", hospitalIds, original);
    const hb = await buildDistribution(client, temp, hr, actor, now);
    const hp = await saveDistribution(client, temp, hb, actor);
    await assert.rejects(() => buildDistribution(client, temp, hr, actor, now), /overlap/);
    await processDistribution(client, hp, now);
    assert.equal(await current("hospitals", hospitalIds[0]), original);
    await processDistribution(client, hp, starts);
    assert.equal(await current("hospitals", hospitalIds[0]), second);
    await assignMedicalPartnerRepresentative(tx, { entityType: "hospital", entityId: hospitalIds[0], userId: third, assignedBy: actor,
      assignmentType: "manual", validFrom: new Date(starts.getTime() + 1000) });
    await processDistribution(client, hp, ends);
    assert.equal(await current("hospitals", hospitalIds[0]), third);
    assert.equal(await current("hospitals", hospitalIds[1]), original);
    console.log("PASS: scheduled start, overlap rejection, automatic return and later manual changes");

    const guardedId = await create("clinic", "Guard");
    const temp2 = parseDistributionInput({ entity: "clinic", kind: "temporary", fromUserId: original,
      endsAt: ends.toISOString(), regions: [{ countryCode: "SK", region: "Guard", userId: second }] });
    const gb = await buildDistribution(client, temp2, await selectionRows(client, "clinic", [guardedId], original), actor, now);
    const gp = await saveDistribution(client, temp2, gb, actor);
    await processDistribution(client, gp, now);
    await client.query(`UPDATE users SET is_active=false WHERE id=$1`, [original]);
    await processDistribution(client, gp, ends);
    assert.equal(await current("clinics", guardedId), second);
    assert.equal((await client.query(`SELECT status FROM representative_distribution_items WHERE plan_id=$1`, [gp])).rows[0].status, "conflict");
    const departure = parseDistributionInput({ entity: "clinic", kind: "departure", fromUserId: original,
      regions: [{ countryCode: "SK", region: "Guard", userId: third }] });
    const dr = await selectionRows(client, "clinic", [guardedId], original);
    assert.equal(dr.length, 1, "Original owner remains discoverable while cover needs review");
    const dp = await saveDistribution(client, departure, await buildDistribution(client, departure, dr, actor, ends), actor);
    await processDistribution(client, dp, ends);
    assert.equal(await current("clinics", guardedId), third);
    assert.equal((await client.query(`SELECT status FROM representative_distribution_items WHERE plan_id=$1`, [gp])).rows[0].status, "skipped");
    console.log("PASS: inactive original is never restored; departed covered representative can be replaced permanently");

    await client.query(`UPDATE users SET assigned_countries=ARRAY['CZ'] WHERE id=$1`, [second]);
    await assert.rejects(() => buildDistribution(client, regional, rows, actor, now), /target/);
    assert.throws(() => parseDistributionInput({ ...regional, regions: [...regional.regions, regional.regions[0]] }), /duplicate/);
    assert.throws(() => parseDistributionInput({ ...regional, entity: "person" }), /invalid/);
    await assert.rejects(() => buildDistribution(client, { ...temp, endsAt: now.toISOString() }, hr, actor, now), /period/);
    console.log("PASS: target-country eligibility, duplicate regions, invalid periods and Persons exclusion");

    await client.query(`UPDATE users SET is_active=true WHERE id=$1`, [original]);
    await client.query(`UPDATE users SET assigned_countries=ARRAY['SK','CZ'] WHERE id=$1`, [second]);
    const scheduledId = await create("clinic", "Scheduled");
    const scheduled = parseDistributionInput({ entity: "clinic", kind: "temporary", fromUserId: original,
      startsAt: starts.toISOString(), endsAt: ends.toISOString(), regions: [{ countryCode: "SK", region: "Scheduled", userId: second }] });
    const sp = await saveDistribution(client, scheduled,
      await buildDistribution(client, scheduled, await selectionRows(client, "clinic", [scheduledId]), actor, now), actor);
    await client.query(`UPDATE users SET role='manager',assigned_countries=ARRAY['CZ'] WHERE id=$1`, [actor]);
    await processDistribution(client, sp, starts);
    assert.equal(await current("clinics", scheduledId), original);
    assert.equal((await client.query(`SELECT reason FROM representative_distribution_items WHERE plan_id=$1`, [sp])).rows[0].reason, "permission");
    console.log("PASS: scheduled processing re-authorizes the creator's current country grants");
  } finally {
    await client.query("ROLLBACK"); client.release(); await pool.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
