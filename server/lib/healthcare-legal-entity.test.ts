import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, randomInt } from "node:crypto";
import express from "express";
import { pool } from "../db";
import { ensureHealthcareLegalEntitySchema } from "./healthcare-legal-entity-schema";
import { registerHealthcareLegalEntityRoutes } from "./healthcare-legal-entity-routes";
import { loadOrsrCompany, normalizeIco, normalizeOrsrExtract, registryPeopleFromExtract, type RegistryLoader } from "./orsr-client";
import { legalEntityActor } from "./healthcare-legal-entity-access";
import { saveLegalVerification } from "./healthcare-legal-entity-store";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT)
  throw new Error("Healthcare Legal Entity fixtures must not run in production");

function extract(ico: string) {
  return {
    dataSyncDate: "2026-10-13T19:10:15", legalForm: 3,
    legalPerson: {
      id: [{ current: true, identifierValue: ico }],
      physicalAddress: [{ current: true, streetName: "Registered street", buildingNumber: "8",
        municipality: { item: "Bratislava" }, deliveryAddress: { postalCode: "81101" } }],
      corporateBody: {
        corporateBodyFullName: [{ current: false, value: "Historical name" }, { current: true, value: "Synthetic operator s.r.o." }],
        legalForm: [{ current: true, item: "s.r.o." }], establishment: "2020-01-01",
        statutoryBody: [{ current: true, function: "Konateľ", effectiveFrom: "2020-01-01",
          personData: { physicalPerson: { personName: { formattedName: "Synthetic Officer" }, birth: { PRIVATE_TEST: "restricted" } } } }],
        stakeholder: [{ current: false, function: "Spoločník", effectiveFrom: "2010-01-01",
          personData: { physicalPerson: { personName: { formattedName: "Historic Officer" } } } }],
        futureApiField: { arbitrary: ["all", "retained"] },
      },
    },
  };
}
test("IČO matching preserves leading zeros and rejects invalid or guessed identifiers", () => {
  assert.equal(normalizeIco(" 00 151 653 "), "00151653");
  for (const input of ["151653", "SK00151653", "0015165A", "", null, 151653]) assert.throws(() => normalizeIco(input));
});
test("registry normalization separates current data, historical roles and complete source", () => {
  const raw = extract("00151653");
  const match = { corporateBodyFullName: "Fallback", fileReference: { section: "Sro", court: "B", insertNumber: 1 } };
  const company = normalizeOrsrExtract("00151653", match, raw);
  assert.equal(company.name, "Synthetic operator s.r.o.");
  assert.equal(company.city, "Bratislava");
  assert.equal(company.postalCode, "81101");
  const people = registryPeopleFromExtract(raw);
  assert.equal(people.length, 2);
  assert.ok(people.find(person => person.name === "Synthetic Officer")?.current);
  assert.equal(people.find(person => person.name === "Historic Officer")?.current, false);
  assert.ok(!JSON.stringify(people).includes("PRIVATE_TEST"));
  assert.deepEqual(registryPeopleFromExtract(structuredClone(raw)), people);
  assert.throws(() => normalizeOrsrExtract("12345678", match, raw));
});
test("official lookup prefers the unique current court file and only falls back to terminated records", async () => {
  const ico = "00151653";
  const match = { registrationNumber: ico, fileReference: { section: "Sro", court: "B", insertNumber: 1 } };
  const calls: string[] = [];
  const read = async (path: string, params: Record<string, string>) => {
    calls.push(`${path}:${params["Filter.IncludeTerminated"] || ""}`);
    return path === "/api/legal-person" ? { filteredCount: 1, data: [match] } :
      path.endsWith("/documents") ? [] : extract(ico);
  };
  const result = await loadOrsrCompany(ico, read);
  assert.equal(result.company.ico, ico);
  assert.equal(calls.filter(call => call.startsWith("/api/legal-person:")).length, 1);
  assert.ok(calls[0].endsWith(":false"));
  await assert.rejects(() => loadOrsrCompany(ico, async path =>
    path === "/api/legal-person" ? { filteredCount: 2, data: [match, match] } : extract(ico)), /ambiguous_match/);
  const fallback = await loadOrsrCompany(ico, async (path, params) => path === "/api/legal-person"
    ? { filteredCount: params["Filter.IncludeTerminated"] === "false" ? 0 : 1,
      data: params["Filter.IncludeTerminated"] === "false" ? [] : [match] }
    : path.endsWith("/documents") ? [] : extract(ico));
  assert.equal(fallback.company.ico, ico);
});

test("Healthcare Legal Entity real database/API: identity, privacy, links, history and transaction safety", async t => {
  await ensureHealthcareLegalEntitySchema(pool);
  await ensureHealthcareLegalEntitySchema(pool);
  const prefix = `hle-fixture-${randomUUID()}`;
  const admin = randomUUID(), viewer = randomUUID(), foreign = randomUUID(), hidden = randomUUID(), hiddenRole = randomUUID();
  const clinic = randomUUID(), secondClinic = randomUUID(), hospital = randomUUID(), foreignSite = randomUUID();
  const person = randomUUID(), foreignPerson = randomUUID();
  const ico = String(randomInt(90_000_000, 99_999_999));
  const otherIco = String(randomInt(80_000_000, 89_999_999));
  let verification: any, entityId: string, secondEntityId: string, linkId: string;
  let version = 0;
  let failLoader = false;
  const loader: RegistryLoader = async selectedIco => {
    if (failLoader) throw new (await import("./orsr-client")).LegalEntityError("registry_unavailable", 502);
    const raw = extract(selectedIco);
    const match = { corporateBodyFullName: "Synthetic operator", fileReference: { section: "Sro", court: "B", insertNumber: 1 } };
    return { company: normalizeOrsrExtract(selectedIco, match, raw), registryPeople: registryPeopleFromExtract(raw),
      rawData: { extract: raw, fullExtract: raw, documents: [{ name: "Document metadata" }], futureField: { retain: true } },
      documents: [{ name: "Document metadata" }], checkedAt: new Date(Date.now() + version++).toISOString(), sourceUpdatedAt: raw.dataSyncDate };
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const user = req.headers["x-hle-fixture-user"];
    if ([admin, viewer, foreign, hidden].includes(String(user))) (req as any).session = { user: { id: user } };
    next();
  });
  registerHealthcareLegalEntityRoutes(app, (req: any, res: any, next: any) =>
    req.session?.user ? next() : res.status(401).json({ error: "unauthorized" }), loader);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/healthcare-legal-entities`;
  const request = (path = "", method = "GET", body?: unknown, actor = admin) => fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json", "x-hle-fixture-user": actor },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  try {
    await pool.query(`INSERT INTO roles(id,name) VALUES($1,$2)`, [hiddenRole, prefix]);
    await pool.query(`INSERT INTO role_module_permissions(role_id,module_key,access,can_add,can_edit)
      VALUES($1,'healthcare_legal_entities','hidden',false,false)`, [hiddenRole]);
    for (const [uid, role, countries, roleId] of [
      [admin, "admin", ["SK"], null], [viewer, "user", ["SK"], null],
      [foreign, "user", ["CZ"], null], [hidden, "user", ["SK"], hiddenRole],
    ] as const) {
      await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,assigned_countries,role_id,is_active)
        VALUES($1,$2,$3,'Synthetic operator',$4,$5,$6,$7,true)`, [uid, `${prefix}-${uid}`, `${uid}@example.invalid`, randomUUID(), role, countries, roleId]);
    }
    await pool.query(`INSERT INTO clinics(id,name,ico,country_code,address,city,postal_code)
      VALUES($1,'Synthetic clinic',$2,'SK','Actual clinic address','Košice','04001'),
      ($3,'Second synthetic clinic',NULL,'SK',NULL,NULL,NULL)`, [clinic, ico, secondClinic]);
    await pool.query(`INSERT INTO hospitals(id,name,country_code,ico) VALUES($1,'Synthetic hospital','SK',$2),($3,'Foreign hospital','CZ',$2)`,
      [hospital, ico, foreignSite]);
    await pool.query(`INSERT INTO collaborators(id,first_name,last_name,country_code,country_codes) VALUES
      ($1,'Synthetic','Person','SK',ARRAY['SK']),($2,'Synthetic','Person','CZ',ARRAY['CZ'])`, [person, foreignPerson]);
    await pool.query(`INSERT INTO contact_assignments(person_id,entity_type,entity_id,role) VALUES($1,'clinic',$2,'Doctor')`, [person, clinic]);

    await t.test("country, module and write permissions enforced from current database user", async () => {
      assert.equal((await request("", "GET", undefined, foreign)).status, 403);
      assert.equal((await request("", "GET", undefined, hidden)).status, 403);
      assert.equal((await request("/verify", "POST", { ico }, viewer)).status, 403);
      assert.equal((await request("/verify", "POST", { ico, facilityType: "hospital", facilityId: foreignSite })).status, 403);
      assert.equal((await request("/verify", "POST", { ico: "12" })).status, 400);
    });
    await t.test("verify is read-only for facility fields and creates a user-owned preview", async () => {
      const result = await request("/verify", "POST", { ico, facilityType: "clinic", facilityId: clinic });
      assert.equal(result.status, 200, await result.clone().text());
      verification = await result.json();
      assert.equal(verification.company.ico, ico);
      assert.equal(verification.facility.name, "Synthetic clinic");
      assert.ok(!JSON.stringify(verification).includes("PRIVATE_TEST"));
      assert.equal((await request("/save", "POST", { verificationId: verification.verificationId, facilityType: "clinic", facilityId: clinic })).status, 400);
      assert.equal((await pool.query(`SELECT count(*)::int AS count FROM healthcare_legal_entities WHERE ico=$1`, [ico])).rows[0].count, 0);
    });
    await t.test("save atomically stores all API fields and confirmed relationship, without overwriting the site", async () => {
      const result = await request("/save", "POST", { verificationId: verification.verificationId, facilityType: "clinic",
        facilityId: clinic, confirmOperator: true });
      assert.equal(result.status, 200, await result.clone().text());
      const saved = await result.json(); entityId = saved.entityId; linkId = saved.linkId;
      const detail = await (await request(`/${entityId}`)).json();
      assert.deepEqual(detail.rawData.futureField, { retain: true });
      assert.deepEqual(detail.rawData.fullExtract.legalPerson.corporateBody.futureApiField, { arbitrary: ["all", "retained"] });
      assert.equal(detail.facilities.length, 1);
      assert.equal(detail.people[0].personId, person);
      assert.equal(detail.personLinks.length, 0, "assigned personnel are not silently corporate officers");
      assert.equal(detail.registryPeople.length, 2);
      assert.equal((await pool.query(`SELECT name,address FROM clinics WHERE id=$1`, [clinic])).rows[0].address, "Actual clinic address");
      assert.equal((await request("/save", "POST", { verificationId: verification.verificationId, facilityType: "clinic", facilityId: clinic, confirmOperator: true })).status, 409);
    });
    await t.test("ordinary authorized readers never receive private registry snapshot payload", async () => {
      const detail = await (await request(`/${entityId}`, "GET", undefined, viewer)).json();
      assert.equal(detail.canViewSensitive, false);
      assert.ok(!("rawData" in detail));
      assert.ok(!JSON.stringify(detail).includes("PRIVATE_TEST"));
      const snap = await (await request(`/${entityId}/snapshots/${detail.history[0].id}`, "GET", undefined, viewer)).json();
      assert.ok(!("rawData" in snap));
    });
    await t.test("same IČO is shared across facilities and re-verification preserves notes/history", async () => {
      assert.equal((await request(`/${entityId}`, "PATCH", { notes: "Preserved operational note" })).status, 200);
      const fresh = await (await request(`/${entityId}/verify`, "POST", {})).json();
      const saved = await (await request("/save", "POST", { verificationId: fresh.verificationId })).json();
      assert.equal(saved.entityId, entityId);
      const result = await request(`/${entityId}/facilities`, "POST", { facilityType: "hospital", facilityId: hospital, confirmOperator: true });
      assert.equal(result.status, 200, await result.clone().text());
      const detail = await (await request(`/${entityId}`)).json();
      assert.equal(detail.entity.notes, "Preserved operational note");
      assert.equal(detail.history.length, 2);
      assert.equal(detail.facilities.length, 2);
    });
    await t.test("Person relationship is derived through facility, no guessed employer and no cross-country matches", async () => {
      const relations = await (await request(`/persons/${person}`)).json();
      assert.equal(relations.facilities[0].legalEntityId, entityId);
      assert.equal(relations.direct.length, 0);
      assert.equal((await request(`/persons/${foreignPerson}`)).status, 404);
      const registry = await (await request(`/${entityId}`)).json();
      const officer = registry.registryPeople.find((p: any) => p.current);
      assert.equal((await request(`/${entityId}/person-links`, "POST", { registryPersonKey: officer.key, personId: foreignPerson, confirm: true })).status, 403);
      const linked = await request(`/${entityId}/person-links`, "POST", { registryPersonKey: officer.key, personId: person, confirm: true });
      assert.equal(linked.status, 200, await linked.clone().text());
      assert.equal((await (await request(`/persons/${person}`)).json()).direct[0].personId, person);
    });
    await t.test("operator replacement requires confirmation and retains ended history", async () => {
      const preview = await (await request("/verify", "POST", { ico: otherIco })).json();
      const saved = await (await request("/save", "POST", { verificationId: preview.verificationId })).json(); secondEntityId = saved.entityId;
      assert.equal((await request(`/${entityId}/facilities`, "POST", { facilityType: "clinic", facilityId: secondClinic, confirmOperator: true })).status, 200);
      assert.equal((await request(`/${secondEntityId}/facilities`, "POST", { facilityType: "clinic", facilityId: secondClinic, confirmOperator: true })).status, 409);
      assert.equal((await request(`/${secondEntityId}/facilities`, "POST", { facilityType: "clinic", facilityId: secondClinic, confirmOperator: true, replaceExisting: true })).status, 200);
      const old = await (await request(`/${entityId}`)).json();
      assert.ok(old.facilities.find((f: any) => f.facilityId === secondClinic).validTo);
      assert.equal((await pool.query(`SELECT count(*)::int AS count FROM healthcare_legal_entity_facilities WHERE facility_id=$1 AND valid_to IS NULL`, [secondClinic])).rows[0].count, 1);
    });
    await t.test("selective updates apply only chosen server-verified fields", async () => {
      const preview = await (await request("/verify", "POST", { ico, facilityType: "clinic", facilityId: clinic })).json();
      assert.equal((await request("/save", "POST", { verificationId: preview.verificationId, facilityType: "clinic", facilityId: hospital, confirmOperator: true })).status, 409);
      const updated = await request("/save", "POST", { verificationId: preview.verificationId, facilityType: "clinic", facilityId: clinic, confirmOperator: true, applyFields: ["city"] });
      assert.equal(updated.status, 200, await updated.clone().text());
      const site = (await pool.query(`SELECT name,address,city FROM clinics WHERE id=$1`, [clinic])).rows[0];
      assert.equal(site.city, "Bratislava");
      assert.equal(site.name, "Synthetic clinic");
      assert.equal(site.address, "Actual clinic address");
    });
    await t.test("ending a relationship retains history and removes the current indirect chain", async () => {
      assert.equal((await request(`/${entityId}/facilities/${linkId}/end`, "POST", {})).status, 200);
      const personView = await (await request(`/persons/${person}`)).json();
      assert.equal(personView.facilities.length, 0);
      assert.equal(personView.direct.length, 1, "ending a facility link is not ending a separately confirmed corporate role");
      const detail = await (await request(`/${entityId}`)).json();
      assert.ok(detail.facilities.find((f: any) => f.id === linkId).validTo);
    });
    await t.test("unbound directory preview can attach an explicitly chosen facility; bound preview cannot change target", async () => {
      const result = await loader(ico);
      const { rows } = await pool.query(`INSERT INTO healthcare_legal_entity_verifications(created_by,normalized,registry_people,raw_data,
        checked_at,source_updated_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '10 minutes') RETURNING id`,
      [admin, JSON.stringify(result.company), JSON.stringify(result.registryPeople), JSON.stringify(result.rawData), result.checkedAt, result.sourceUpdatedAt]);
      const saved = await saveLegalVerification(await legalEntityActor(admin), {
        verificationId: rows[0].id, facilityType: "clinic", facilityId: clinic, confirmOperator: true,
      });
      assert.equal(saved.entityId, entityId);
      assert.ok(saved.linkId);
    });
    await t.test("expired, wrong-owner and older previews cannot overwrite the latest source", async () => {
      const actor = await legalEntityActor(admin);
      const result = await loader(ico);
      const make = async (checked: string, expires: string) => (await pool.query(`INSERT INTO healthcare_legal_entity_verifications
        (created_by,normalized,registry_people,raw_data,checked_at,expires_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [admin, JSON.stringify(result.company), JSON.stringify(result.registryPeople), JSON.stringify(result.rawData), checked, expires])).rows[0].id;
      const expired = await make(result.checkedAt, new Date(Date.now() - 1000).toISOString());
      await assert.rejects(() => saveLegalVerification(actor, { verificationId: expired }), /verification_expired/);
      const old = await make("2000-01-01T00:00:00Z", new Date(Date.now() + 60_000).toISOString());
      await assert.rejects(() => saveLegalVerification(actor, { verificationId: old }), /stale_verification/);
      const foreignOwned = await make(result.checkedAt, new Date(Date.now() + 60_000).toISOString());
      await assert.rejects(() => saveLegalVerification({ ...actor, id: viewer }, { verificationId: foreignOwned }), /verification_expired/);
    });
    await t.test("simultaneous saves keep one company per country/IČO and one snapshot per successful preview", async () => {
      const actor = await legalEntityActor(admin);
      const result = await loader(otherIco);
      const make = async () => (await pool.query(`INSERT INTO healthcare_legal_entity_verifications(created_by,normalized,registry_people,
        raw_data,checked_at,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes') RETURNING id`,
      [admin, JSON.stringify(result.company), JSON.stringify(result.registryPeople), JSON.stringify(result.rawData), result.checkedAt])).rows[0].id;
      const ids = await Promise.all([make(), make()]);
      const saved = await Promise.all(ids.map(verificationId => saveLegalVerification(actor, { verificationId })));
      assert.equal(saved[0].entityId, saved[1].entityId);
      assert.equal(saved[0].entityId, secondEntityId);
      assert.equal((await pool.query(`SELECT count(*)::int AS count FROM healthcare_legal_entities WHERE ico=$1`, [otherIco])).rows[0].count, 1);
    });
    await t.test("drawer edits persist separately from the official source and reject identity changes", async () => {
      assert.equal((await request(`/${entityId}`, "PATCH", {
        notes: "Drawer note", details: { name: "Local display name", city: "Local city" },
      })).status, 200);
      let detail = await (await request(`/${entityId}`)).json();
      assert.equal(detail.entity.name, "Local display name");
      assert.equal(detail.entity.city, "Local city");
      assert.equal(detail.entity.registryCompany.name, "Synthetic operator s.r.o.");
      assert.equal(detail.entity.registryCompany.city, "Bratislava");
      assert.equal(detail.entity.notes, "Drawer note");
      assert.equal(detail.rawData.extract.legalPerson.corporateBody.corporateBodyFullName[1].value, "Synthetic operator s.r.o.");
      assert.equal((await request(`/${entityId}`, "PATCH", { details: { ico: "99999999" } })).status, 400);
      assert.equal((await request(`/${entityId}`, "PATCH", { details: { name: "" } })).status, 400);
      assert.equal((await request(`/${entityId}`, "PATCH", {})).status, 400);
      assert.equal((await request(`/${entityId}`, "PATCH", { details: { name: "Unauthorized" } }, viewer)).status, 403);
      const verification = await loader(ico);
      const pending = await pool.query(`INSERT INTO healthcare_legal_entity_verifications(created_by,normalized,registry_people,
        raw_data,checked_at,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes') RETURNING id`,
      [admin, JSON.stringify(verification.company), JSON.stringify(verification.registryPeople),
        JSON.stringify(verification.rawData), verification.checkedAt]);
      await saveLegalVerification(await legalEntityActor(admin), { verificationId: pending.rows[0].id });
      detail = await (await request(`/${entityId}`)).json();
      assert.equal(detail.entity.name, "Local display name", "verification must not silently erase an operator edit");
      assert.equal(detail.entity.notes, "Drawer note");
      assert.equal((await request(`/${entityId}`, "PATCH", { details: { name: null } })).status, 200);
      detail = await (await request(`/${entityId}`)).json();
      assert.equal(detail.entity.name, "Synthetic operator s.r.o.");
      assert.equal(detail.entity.city, "Local city");
      await request(`/${entityId}`, "PATCH", { notes: "Preserved operational note", details: { city: null } });
    });
    await t.test("complete saved export is a private attachment and preserves every API field", async () => {
      const response = await request(`/${entityId}/export`);
      assert.equal(response.status, 200, await response.clone().text());
      assert.match(response.headers.get("content-type") || "", /^application\/json/);
      assert.match(response.headers.get("content-disposition") || "", new RegExp(`attachment; filename="healthcare-legal-entity-${ico}`));
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      const exported = await response.json();
      assert.equal(exported.entity.id, entityId);
      assert.equal(exported.entity.ico, ico);
      assert.deepEqual(exported.snapshot.rawData.futureField, { retain: true });
      assert.deepEqual(exported.snapshot.rawData.fullExtract.legalPerson.corporateBody.futureApiField, { arbitrary: ["all", "retained"] });
      assert.equal(exported.snapshot.rawData.documents.length, 1);
      assert.equal(exported.snapshot.registryPeople.length, 2);
      assert.equal(exported.source.documentFilesIncluded, false);
      assert.ok(exported.history.length > 1);
      assert.ok(exported.audit.length > 0);
      assert.ok(exported.relationships.facilities.length > 0);
      const sourceId = exported.history[exported.history.length - 1].id;
      const older = await (await request(`/${entityId}/export?snapshotId=${sourceId}`)).json();
      assert.equal(older.snapshot.id, sourceId);
      assert.equal((await request(`/${secondEntityId}/export?snapshotId=${sourceId}`)).status, 404);
      for (const actor of [viewer, foreign, hidden]) {
        const denied = await request(`/${entityId}/export`, "GET", undefined, actor);
        assert.equal(denied.status, 403);
        assert.ok(!(await denied.text()).includes("PRIVATE_TEST"));
        assert.equal(denied.headers.get("content-disposition"), null);
      }
    });
    await t.test("explicit read-only source permission allows download without allowing drawer edits", async () => {
      try {
        await pool.query(`UPDATE role_module_permissions SET access='visible' WHERE role_id=$1 AND module_key='healthcare_legal_entities'`, [hiddenRole]);
        await pool.query(`INSERT INTO role_field_permissions(role_id,module_key,field_key,permission)
          VALUES($1,'healthcare_legal_entities','registry_raw','readonly')`, [hiddenRole]);
        assert.equal((await request(`/${entityId}/export`, "GET", undefined, hidden)).status, 200);
        assert.equal((await request(`/${entityId}`, "PATCH", { notes: "Not permitted" }, hidden)).status, 403);
        assert.equal((await request(`/${entityId}/verify`, "POST", {}, hidden)).status, 403);
      } finally {
        await pool.query(`DELETE FROM role_field_permissions WHERE role_id=$1`, [hiddenRole]);
        await pool.query(`UPDATE role_module_permissions SET access='hidden' WHERE role_id=$1 AND module_key='healthcare_legal_entities'`, [hiddenRole]);
      }
    });
    await t.test("upstream failure never changes persisted source or facility records", async () => {
      failLoader = true;
      assert.equal((await request(`/${entityId}/verify`, "POST", {})).status, 502);
      assert.equal((await (await request(`/${entityId}`)).json()).entity.notes, "Preserved operational note");
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    const entityIds = (await pool.query(`SELECT id FROM healthcare_legal_entities WHERE created_by=$1`, [admin])).rows.map(row => row.id);
    for (const table of ["healthcare_legal_entity_audit", "healthcare_legal_entity_person_links", "healthcare_legal_entity_facilities", "healthcare_legal_entity_snapshots"])
      await pool.query(`DELETE FROM ${table} WHERE legal_entity_id=ANY($1::varchar[])`, [entityIds]);
    await pool.query(`DELETE FROM healthcare_legal_entity_verifications WHERE created_by=ANY($1::varchar[])`, [[admin, viewer, foreign, hidden]]);
    await pool.query(`DELETE FROM healthcare_legal_entities WHERE id=ANY($1::varchar[])`, [entityIds]);
    await pool.query(`DELETE FROM contact_assignments WHERE person_id=ANY($1::varchar[])`, [[person, foreignPerson]]);
    await pool.query(`DELETE FROM collaborators WHERE id=ANY($1::varchar[])`, [[person, foreignPerson]]);
    await pool.query(`DELETE FROM clinics WHERE id=ANY($1::varchar[])`, [[clinic, secondClinic]]);
    await pool.query(`DELETE FROM hospitals WHERE id=ANY($1::varchar[])`, [[hospital, foreignSite]]);
    await pool.query(`DELETE FROM users WHERE id=ANY($1::varchar[])`, [[admin, viewer, foreign, hidden]]);
    await pool.query(`DELETE FROM role_module_permissions WHERE role_id=$1`, [hiddenRole]);
    await pool.query(`DELETE FROM roles WHERE id=$1`, [hiddenRole]);
  }
});
test.after(async () => { await pool.end(); });
