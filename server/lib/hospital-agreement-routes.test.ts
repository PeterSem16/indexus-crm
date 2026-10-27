import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../db";
import { DATA_ROOT } from "../config/storage-paths";
import { registerHospitalAgreementRoutes } from "./clinic-agreement-routes";
import { HOSPITAL_AGREEMENTS_MIGRATION } from "./hospital-agreement-contract";
import { finderProviders, validateFinderSelection } from "./provider-finder-store";
import { ensureProviderFinderSchema } from "./provider-finder-schema";
import { DEFAULT_FINDER_POLICY, finderQualitySchema, finderQualityCandidates } from "../../shared/provider-finder";
import { AGREEMENT_MAX_BYTES } from "./clinic-agreement-contract";

test("hospital-owned agreements: real CRUD, country/document authorization and independent finder evidence", async t => {
  await pool.query(HOSPITAL_AGREEMENTS_MIGRATION);
  await pool.query(HOSPITAL_AGREEMENTS_MIGRATION); // Startup is repeatable.
  await ensureProviderFinderSchema(pool);
  const ids = Object.fromEntries(["admin", "manager", "agent", "foreign", "custom", "role", "hospital", "second", "foreignHospital", "person", "personAgreement", "campaign"].map(k => [k, randomUUID()]));
  const country = "HX", foreignCountry = "HY";
  const files = new Set<string>();
  const privateDir = path.join(path.dirname(DATA_ROOT), "private-hospital-agreements");
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const id = req.get("x-fixture-user");
    if ([ids.admin, ids.manager, ids.agent, ids.foreign, ids.custom].includes(id)) req.session = { user: { id } };
    next();
  });
  registerHospitalAgreementRoutes(app, (req: any, res: any, next: any) => req.session?.user ? next() : res.sendStatus(401));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/hospitals`;
  const request = (suffix = "", user = ids.admin, init: RequestInit = {}, owner = ids.hospital) =>
    fetch(`${base}/${owner}/agreements${suffix}`, { ...init, headers: { "x-fixture-user": user, ...init.headers } });
  const patch = (id: string, values: object, user = ids.admin, query = "") => request(`/${id}${query}`, user, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
  });
  const upload = (user = ids.admin, fields: Record<string, string> = {}, bytes = Buffer.from("%PDF-1.4\nhospital fixture\n"), query = "") => {
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), "hospital.pdf");
    form.set("title", "Hospital fixture");
    Object.entries(fields).forEach(([key, value]) => form.set(key, value));
    return request(query, user, { method: "POST", body: form });
  };
  const evidence = async () => (await finderProviders("country", country, true)).find(p => p.id === ids.hospital)!;
  let agreement: any;
  try {
    await pool.query("INSERT INTO roles(id,name) VALUES($1,$2)", [ids.role, "Hospital agreement fixture " + ids.role]);
    for (const [id, role, countries, roleId] of [
      [ids.admin, "admin", [], null], [ids.manager, "manager", [country], null],
      [ids.agent, "user", [country], null], [ids.foreign, "manager", [foreignCountry], null],
      [ids.custom, "user", [country], ids.role],
    ]) await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,assigned_countries,role_id)
      VALUES($1::varchar,$1::text,$2,'Hospital fixture','not-a-password',$3,$4,$5)`, [id, `${id}@fixture.invalid`, role, countries, roleId]);
    for (const [id, code] of [[ids.hospital, country], [ids.second, country], [ids.foreignHospital, foreignCountry]])
      await pool.query(`INSERT INTO hospitals(id,name,country_code,latitude,longitude) VALUES($1,'Hospital fixture',$2,48.15,17.12)`, [id, code]);
    await pool.query("INSERT INTO campaigns(id,name) VALUES($1,'Hospital fixture')", [ids.campaign]);
    await pool.query("INSERT INTO campaign_agents(campaign_id,user_id) VALUES($1,$2)", [ids.campaign, ids.agent]);
    await pool.query("INSERT INTO campaign_contacts(campaign_id,hospital_id,contact_type) VALUES($1,$2,'hospital')", [ids.campaign, ids.hospital]);
    const original = (await pool.query("SELECT * FROM hospitals WHERE id=$1", [ids.hospital])).rows[0];
    const today = (await pool.query("SELECT to_char((now() AT TIME ZONE 'Europe/Bratislava')::date,'YYYY-MM-DD') today")).rows[0].today;

    await t.test("absence is known false; country and authentication fail closed", async () => {
      assert.equal((await fetch(`${base}/${ids.hospital}/agreements`)).status, 401);
      for (const user of [ids.foreign, ids.custom]) {
        assert.equal((await request("", user)).status, 403);
        assert.equal((await upload(user)).status, 403);
      }
      assert.equal((await evidence()).evidence?.currentAgreement, false);
      assert.equal((await evidence()).evidence?.uploadedContract, false);
      assert.equal((await evidence()).evidence?.cooperation, undefined);
      assert.ok(!(await finderProviders("country", country, true)).some(p => p.id === ids.foreignHospital));
    });
    await t.test("upload, list and authenticated attachment download", async () => {
      const response = await upload(ids.manager, { validFrom: today, validTo: today, contractNumber: "H-1" });
      assert.equal(response.status, 201);
      agreement = await response.json();
      assert.equal(agreement.hospitalId, ids.hospital);
      assert.equal(agreement.validFrom, today);
      assert.equal(agreement.storageKey, undefined);
      const stored = (await pool.query("SELECT storage_key FROM hospital_agreements WHERE id=$1", [agreement.id])).rows[0];
      files.add(stored.storage_key);
      const listing = await (await request()).json();
      assert.equal(listing.agreements.length, 1);
      assert.equal(listing.canManage, true);
      const downloaded = await request(`/${agreement.id}/download`);
      assert.equal(downloaded.status, 200);
      assert.equal(downloaded.headers.get("cache-control"), "private, no-store");
      assert.equal(downloaded.headers.get("x-content-type-options"), "nosniff");
      assert.match(downloaded.headers.get("content-disposition")!, /^attachment;/);
      assert.equal(await downloaded.text(), "%PDF-1.4\nhospital fixture\n");
      assert.equal((await request(`/${agreement.id}/download`, ids.foreign)).status, 403);
    });
    await t.test("inclusive validity, expiry, future, inactive and termination semantics", async () => {
      let p = await evidence();
      assert.equal(p.evidence?.currentAgreement, true);
      assert.equal(p.evidence?.uploadedContract, true);
      assert.equal(p.evidence?.previousAgreement, false);
      assert.equal(p.contracted, true);
      assert.equal(p.evidence?.cooperation, undefined);
      assert.equal((await patch(agreement.id, { validFrom: "2099-01-01", validTo: "2099-12-31" })).status, 200);
      p = await evidence();
      assert.equal(p.evidence?.currentAgreement, false);
      assert.equal(p.evidence?.previousAgreement, false);
      await patch(agreement.id, { active: false });
      assert.equal((await evidence()).evidence?.previousAgreement, false, "future contract ended before its start is not historical");
      await patch(agreement.id, { active: true, validFrom: "2020-01-01", validTo: "2020-12-31" });
      p = await evidence();
      assert.equal(p.evidence?.currentAgreement, false);
      assert.equal(p.evidence?.uploadedContract, false);
      assert.equal(p.evidence?.previousAgreement, true);
      await patch(agreement.id, { validTo: null });
      const ended = await (await patch(agreement.id, { active: false })).json();
      assert.ok(ended.endedAt);
      const repeated = await (await patch(agreement.id, { active: false })).json();
      assert.equal(repeated.endedAt, ended.endedAt);
      assert.equal((await evidence()).evidence?.currentAgreement, false);
      assert.equal((await evidence()).evidence?.previousAgreement, true);
      const active = await (await patch(agreement.id, { active: true, title: "Updated", contractNumber: null })).json();
      assert.equal(active.endedAt, null);
      assert.equal(active.title, "Updated");
      assert.equal(active.contractNumber, null);
      assert.equal((await evidence()).evidence?.currentAgreement, true);
      // Distinguish a legacy inactive flag from an actual termination.
      await pool.query("UPDATE hospital_agreements SET active=false,ended_at=NULL WHERE id=$1", [agreement.id]);
      assert.equal((await evidence()).evidence?.previousAgreement, false);
      await patch(agreement.id, { active: true });
    });
    await t.test("invalid data, cross-hospital identifiers and file spoofing rejected", async () => {
      for (const value of [{ validTo: "2010-01-01" }, { validFrom: "2026-02-30" }, { endedAt: "1900-01-01" }, { hospitalId: ids.second }])
        assert.equal((await patch(agreement.id, value)).status, 400);
      assert.equal((await request(`/${agreement.id}/download`, ids.admin, {}, ids.second)).status, 404);
      for (const method of ["PATCH", "DELETE"])
        assert.equal((await request(`/${agreement.id}`, ids.admin, { method, headers: { "Content-Type": "application/json" }, body: '{"active":false}' }, ids.second)).status, 404);
      assert.equal((await upload(ids.admin, {}, Buffer.from("<html>spoof</html>"))).status, 400);
      assert.equal((await upload(ids.admin, {}, Buffer.alloc(AGREEMENT_MAX_BYTES + 1))).status, 400);
      assert.equal((await upload(ids.admin, { validFrom: "2026-04-31" })).status, 400);
    });
    await t.test("assigned Mission readers need explicit editing exception and exact context", async () => {
      assert.equal((await (await request("", ids.agent)).json()).canManage, false);
      assert.equal((await request(`/${agreement.id}/download`, ids.agent)).status, 200);
      assert.equal((await patch(agreement.id, { active: false }, ids.agent)).status, 403);
      assert.equal((await request(`/${agreement.id}`, ids.agent, { method: "DELETE" })).status, 403);
      await pool.query("UPDATE campaigns SET settings=$2 WHERE id=$1", [ids.campaign, JSON.stringify({ readOnlyContactCards: true, readOnlyExceptions: { agreements: true } })]);
      const query = `?campaignId=${ids.campaign}`;
      assert.equal((await patch(agreement.id, { title: "Mission edit" }, ids.agent, query)).status, 200);
      assert.equal((await patch(agreement.id, { title: "Wrong Mission" }, ids.agent, `?campaignId=${randomUUID()}`)).status, 403);
      assert.equal((await request(query, ids.agent, {}, ids.second)).status, 403);
      assert.equal((await request("?campaignId[]=invalid", ids.agent)).status, 400);
      await pool.query("DELETE FROM campaign_agents WHERE campaign_id=$1 AND user_id=$2", [ids.campaign, ids.agent]);
      assert.equal((await patch(agreement.id, { title: "Revoked" }, ids.agent, query)).status, 403);
    });
    await t.test("custom module grants and current account/country restrictions", async () => {
      await pool.query("INSERT INTO role_module_permissions(role_id,module_key,access,can_edit) VALUES($1,'hospitals','visible',false)", [ids.role]);
      assert.equal((await request("", ids.custom)).status, 200);
      assert.equal((await patch(agreement.id, { title: "Denied" }, ids.custom)).status, 403);
      await pool.query("UPDATE role_module_permissions SET can_edit=true WHERE role_id=$1", [ids.role]);
      assert.equal((await patch(agreement.id, { title: "Role edit" }, ids.custom)).status, 200);
      await pool.query("UPDATE users SET assigned_countries=ARRAY[$2]::text[] WHERE id=$1", [ids.custom, foreignCountry]);
      assert.equal((await request(`/${agreement.id}/download`, ids.custom)).status, 403);
      await pool.query("UPDATE users SET is_active=false WHERE id=$1", [ids.manager]);
      assert.equal((await upload(ids.manager)).status, 403);
    });
    await t.test("finder requirements and save revalidation use hospital evidence only", async () => {
      const quality = finderQualitySchema.parse({ enabled: true, rules: { currentAgreement: { mode: "require", weight: 40 } } });
      const policy = { ...DEFAULT_FINDER_POLICY, enabled: true, quality };
      await pool.query("INSERT INTO provider_finder_country_policies(country,settings) VALUES($1,$2)", [country, JSON.stringify(policy)]);
      const selection = { id: ids.hospital, type: "hospital" as const, billingCompanyId: "country", country };
      assert.equal((await validateFinderSelection(selection)).id, ids.hospital);
      await patch(agreement.id, { active: false });
      await assert.rejects(() => validateFinderSelection(selection));
      await pool.query(`INSERT INTO collaborators(id,first_name,last_name,country_code,country_codes) VALUES($1,'Doctor','Fixture',$2,ARRAY[$2]::text[])`, [ids.person, country]);
      await pool.query("INSERT INTO contact_assignments(person_id,entity_type,entity_id) VALUES($1,'hospital',$2)", [ids.person, ids.hospital]);
      await pool.query(`INSERT INTO collaborator_agreements(id,collaborator_id,is_valid,file_path,valid_from_day,valid_from_month,valid_from_year)
        VALUES($1,$2,true,'person-fixture.pdf',1,1,2020)`, [ids.personAgreement, ids.person]);
      const p = await evidence();
      assert.equal(p.evidence?.currentAgreement, false);
      assert.equal(p.people[0].evidence?.currentAgreement, true);
      assert.equal(p.contracted, false);
      await assert.rejects(() => validateFinderSelection(selection));
      assert.equal((await validateFinderSelection({ ...selection, personId: ids.person })).personId, ids.person);
      assert.equal((await finderProviders("country", country, false)).find(x => x.id === ids.hospital)!.people.length, 0);
      assert.equal(finderQualityCandidates(p, policy, 1, 25)[0]?.person?.id, ids.person);
      assert.equal((await finderProviders("country", country, true)).find(x => x.id === ids.second)!.evidence?.currentAgreement, false);
    });
    await t.test("delete removes record/document, never changes hospital or Person agreement", async () => {
      assert.equal((await request(`/${agreement.id}`, ids.admin, { method: "DELETE" })).status, 204);
      assert.equal((await request(`/${agreement.id}/download`)).status, 404);
      assert.equal((await request(`/${agreement.id}`, ids.admin, { method: "DELETE" })).status, 404);
      assert.equal((await (await request()).json()).agreements.length, 0);
      for (const key of files) await assert.rejects(() => fs.stat(path.join(privateDir, key)));
      assert.deepEqual((await pool.query("SELECT * FROM hospitals WHERE id=$1", [ids.hospital])).rows[0], original);
      assert.equal((await pool.query("SELECT count(*)::int n FROM collaborator_agreements WHERE id=$1", [ids.personAgreement])).rows[0].n, 1);
    });
  } finally {
    const stored = await pool.query("SELECT storage_key FROM hospital_agreements WHERE hospital_id=ANY($1)", [[ids.hospital, ids.second, ids.foreignHospital]]);
    stored.rows.forEach(r => files.add(r.storage_key));
    await pool.query("DELETE FROM provider_finder_country_policies WHERE country=$1", [country]);
    await pool.query("DELETE FROM collaborator_agreements WHERE id=$1", [ids.personAgreement]);
    await pool.query("DELETE FROM contact_assignments WHERE person_id=$1", [ids.person]);
    await pool.query("DELETE FROM collaborators WHERE id=$1", [ids.person]);
    await pool.query("DELETE FROM campaign_contacts WHERE campaign_id=$1", [ids.campaign]);
    await pool.query("DELETE FROM campaign_agents WHERE campaign_id=$1", [ids.campaign]);
    await pool.query("DELETE FROM campaigns WHERE id=$1", [ids.campaign]);
    await pool.query("DELETE FROM hospitals WHERE id=ANY($1)", [[ids.hospital, ids.second, ids.foreignHospital]]);
    await pool.query("DELETE FROM role_module_permissions WHERE role_id=$1", [ids.role]);
    await pool.query("DELETE FROM users WHERE id=ANY($1)", [[ids.admin, ids.manager, ids.agent, ids.foreign, ids.custom]]);
    await pool.query("DELETE FROM roles WHERE id=$1", [ids.role]);
    for (const key of files) await fs.unlink(path.join(privateDir, key)).catch(() => {});
    await new Promise<void>(r => server.close(() => r()));
    await pool.end();
  }
});
