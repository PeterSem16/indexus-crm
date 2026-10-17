import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, randomInt } from "node:crypto";
import express from "express";
import { pool } from "../db";
import { ensureHealthcareLegalEntitySchema } from "./healthcare-legal-entity-schema";
import { registerHealthcareLegalEntityRoutes } from "./healthcare-legal-entity-routes";
import { loadOrsrCompany, normalizeIco, normalizeOrsrExtract, registryPeopleFromExtract, type RegistryLoader } from "./orsr-client";
import { legalEntityActor } from "./healthcare-legal-entity-access";
import { saveLegalVerification, savedRegistryHistory, ensureRegistryComparisonKeys, inLegalTransaction,
  REGISTRY_KEY_BATCH_SIZE } from "./healthcare-legal-entity-store";
import { REGISTRY_COMPARISON_KEY_VERSION } from "../../shared/healthcare-legal-entity-diff";

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
  let changedExtract = false;
  const loader: RegistryLoader = async selectedIco => {
    if (failLoader) throw new (await import("./orsr-client")).LegalEntityError("registry_unavailable", 502);
    const raw = extract(selectedIco);
    if (changedExtract) {
      raw.legalPerson.corporateBody.corporateBodyFullName[1].value = "Updated synthetic operator a.s.";
      raw.legalPerson.corporateBody.legalForm[0].item = "a.s.";
      raw.legalPerson.physicalAddress[0].streetName = "New registered seat";
      raw.legalPerson.corporateBody.statutoryBody[0].personData.physicalPerson.personName.formattedName = "New Synthetic Officer";
    }
    const match = { corporateBodyFullName: "Synthetic operator", fileReference: { section: "Sro", court: "B", insertNumber: 1 } };
    return { company: normalizeOrsrExtract(selectedIco, match, raw), registryPeople: registryPeopleFromExtract(raw),
      rawData: { extract: raw, fullExtract: raw, documents: [{ name: "Document metadata" }], futureField: { retain: true } },
      documents: [{ name: "Document metadata" }], checkedAt: new Date(Date.now() + version++).toISOString(), sourceUpdatedAt: raw.dataSyncDate };
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const user = req.headers["x-hle-fixture-user"];
    if (([admin, viewer, foreign, hidden] as string[]).includes(String(user))) (req as any).session = { user: { id: user } };
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
      [foreign, "user", ["HU"], null], [hidden, "user", ["SK"], hiddenRole],
    ] as const) {
      await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,assigned_countries,role_id,is_active)
        VALUES($1,$2,$3,'Synthetic operator',$4,$5,$6,$7,true)`, [uid, `${prefix}-${uid}`, `${uid}@example.invalid`, randomUUID(), role, countries, roleId]);
    }
    await pool.query(`INSERT INTO clinics(id,name,ico,country_code,address,city,postal_code)
      VALUES($1,'Synthetic clinic',$2,'SK','Actual clinic address','Košice','04001'),
      ($3,'Second synthetic clinic',NULL,'SK',NULL,NULL,NULL)`, [clinic, ico, secondClinic]);
    await pool.query(`INSERT INTO hospitals(id,name,country_code,ico) VALUES($1,'Synthetic hospital','SK',$2),($3,'Foreign hospital','HU',$2)`,
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
      assert.equal(saved.comparison.previous, null);
      assert.deepEqual(saved.comparison.fields, []);
      assert.equal((await pool.query(`SELECT key_version FROM healthcare_legal_entity_snapshot_comparison_keys
        WHERE snapshot_id=$1`, [saved.comparison.current.id])).rows[0].key_version, REGISTRY_COMPARISON_KEY_VERSION,
      "new saves persist their derived facts in the same transaction, before any list backfill");
      const detail = await (await request(`/${entityId}`)).json();
      assert.deepEqual(detail.rawData.futureField, { retain: true });
      assert.deepEqual(detail.rawData.fullExtract.legalPerson.corporateBody.futureApiField, { arbitrary: ["all", "retained"] });
      assert.equal(detail.facilities.length, 1);
      assert.equal(detail.facilities[0].confirmedByName, "Synthetic operator");
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
      assert.ok(saved.comparison.previous);
      assert.deepEqual(saved.comparison.fields, []);
      assert.deepEqual(saved.comparison.roles, { removed: [], added: [] });
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
      assert.equal((await request(`/persons/${foreignPerson}`)).status, 200, "admin can read CZ Persons; cannot link one to an SK entity");
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
    await t.test("verification only links the clinic or hospital and never copies registry values into its fields", async () => {
      const verified = await (await request("/verify", "POST", { ico, facilityType: "clinic", facilityId: clinic })).json();
      for (const [facilityType, facilityId, table] of [
        ["clinic", clinic, "clinics"], ["hospital", hospital, "hospitals"],
      ] as const) {
        const before = (await pool.query(`SELECT row_to_json(site) AS data FROM ${table} site WHERE id=$1`, [facilityId])).rows[0].data;
        // Reuse the verified source for the second site without spending an
        // additional official-lookup rate-limit slot in this combined suite.
        const preview = facilityType === "clinic" ? verified : {
          verificationId: (await pool.query(`INSERT INTO healthcare_legal_entity_verifications
            (created_by,normalized,registry_people,raw_data,checked_at,source_updated_at,expires_at,facility_type,facility_id)
            SELECT created_by,normalized,registry_people,raw_data,checked_at+interval '1 millisecond',
              source_updated_at,expires_at,'hospital',$2 FROM healthcare_legal_entity_verifications WHERE id=$1 RETURNING id`,
            [verified.verificationId, facilityId])).rows[0].id,
        };
        const payload = { verificationId: preview.verificationId, facilityType, facilityId, confirmOperator: true };
        for (const field of ["name", "address", "city", "postalCode", "ico"]) {
          assert.equal((await request("/save", "POST", { ...payload, applyFields: [field] })).status, 400);
        }
        const saved = await request("/save", "POST", payload);
        assert.equal(saved.status, 200, await saved.clone().text());
        const after = (await pool.query(`SELECT row_to_json(site) AS data FROM ${table} site WHERE id=$1`, [facilityId])).rows[0].data;
        assert.deepEqual(after, before, "not a single facility field may change");
        const linked = await (await request(`/facilities/${facilityType}/${facilityId}`)).json();
        assert.equal(linked.links.find((link: any) => !link.validTo)?.legalEntityId, entityId);
        assert.equal(linked.registryCompany.name, "Synthetic operator s.r.o.");
        assert.equal(linked.facility.name, before.name);
      }
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
    await t.test("readable historical comparisons share the UI diff, are authenticated, private and read-only", async () => {
      const history = (await (await request(`/${entityId}`)).json()).history;
      const sourceId = history[history.length - 1].id;
      const snapshotId = history[0].id;
      const path = `/${entityId}/snapshots/${snapshotId}/comparison-export`;
      const before = await pool.query(`SELECT
        (SELECT row_to_json(e) FROM healthcare_legal_entities e WHERE id=$1) AS entity,
        (SELECT json_agg(s ORDER BY s.id) FROM healthcare_legal_entity_snapshots s WHERE legal_entity_id=$1) AS snapshots,
        (SELECT json_agg(a ORDER BY a.id) FROM healthcare_legal_entity_audit a WHERE legal_entity_id=$1) AS audit`, [entityId]);
      const ui = await (await request(`/${entityId}/snapshots/${snapshotId}`)).json();
      const { registryComparisonDocument } = await import("../../shared/healthcare-legal-entity-comparison-document");
      const { healthcareLegalEntityTranslations: copies } = await import("../../client/src/i18n/healthcare-legal-entity-translations");
      const selected = await pool.query(`SELECT normalized FROM healthcare_legal_entity_snapshots WHERE id=$1`, [snapshotId]);
      for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
        // A reader without permission to view private source data can export the public comparison.
        const response = await request(`${path}?locale=${locale}`, "GET", undefined, viewer);
        assert.equal(response.status, 200, await response.clone().text());
        assert.match(response.headers.get("content-type") || "", /^text\/html; charset=utf-8/);
        assert.match(response.headers.get("content-disposition") || "", /attachment; filename="orsr-comparison-.*\.html"/);
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        assert.equal(response.headers.get("x-content-type-options"), "nosniff");
        const html = await response.text();
        assert.equal(html, registryComparisonDocument(ui.comparison, selected.rows[0].normalized, copies[locale], locale));
        for (const secret of ["PRIVATE_TEST", "futureApiField", "rawData", "Local display name", "Preserved operational note"])
          assert.ok(!html.includes(secret), secret);
      }
      const baseline = await request(`/${entityId}/snapshots/${sourceId}/comparison-export?locale=sk`);
      assert.equal(baseline.status, 200);
      assert.ok((await baseline.text()).includes(copies.sk.firstVerification));
      for (const actor of [foreign, hidden, "unauthenticated"]) {
        const response = await request(path, "GET", undefined, actor);
        assert.equal(response.status, actor === "unauthenticated" ? 401 : 403);
        assert.equal(response.headers.get("content-disposition"), null);
      }
      assert.equal((await request(`${path}?locale=invalid`)).status, 400);
      assert.equal((await request(`/${secondEntityId}/snapshots/${snapshotId}/comparison-export`)).status, 404);
      assert.equal((await request(`/${entityId}/snapshots/missing/comparison-export`)).status, 404);
      const after = await pool.query(`SELECT
        (SELECT row_to_json(e) FROM healthcare_legal_entities e WHERE id=$1) AS entity,
        (SELECT json_agg(s ORDER BY s.id) FROM healthcare_legal_entity_snapshots s WHERE legal_entity_id=$1) AS snapshots,
        (SELECT json_agg(a ORDER BY a.id) FROM healthcare_legal_entity_audit a WHERE legal_entity_id=$1) AS audit`, [entityId]);
      assert.deepEqual(after.rows, before.rows, "downloads must not modify any saved data or audit");
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
    await t.test("manual re-verification reports saved differences, preserves immutable history and never alters operational links", async () => {
      const before = await (await request(`/${entityId}`)).json();
      const previousId = before.history[0].id;
      const previousRaw = (await (await request(`/${entityId}/snapshots/${previousId}`)).json()).rawData;
      const facilityBefore = (await pool.query(`SELECT name,address,city,postal_code FROM clinics WHERE id=$1`, [clinic])).rows;
      const peopleBefore = (await pool.query(`SELECT * FROM healthcare_legal_entity_person_links WHERE legal_entity_id=$1 ORDER BY id`, [entityId])).rows;
      const linksBefore = (await pool.query(`SELECT * FROM healthcare_legal_entity_facilities WHERE legal_entity_id=$1 ORDER BY id`, [entityId])).rows;
      changedExtract = true;
      const verified = await request(`/${entityId}/verify`, "POST", {});
      assert.equal(verified.status, 200);
      const preview = await verified.json();
      assert.equal(preview.sourceUpdatedAt, "2026-10-13T19:10:15");
      assert.notEqual(preview.checkedAt, preview.sourceUpdatedAt);
      const save = await request("/save", "POST", { verificationId: preview.verificationId });
      assert.equal(save.status, 200);
      const { comparison } = await save.json();
      assert.equal(comparison.previous.id, previousId);
      assert.deepEqual(comparison.fields.map((f: any) => f.field), ["name", "registeredAddress", "legalForm"]);
      assert.equal(comparison.roles.removed[0].name, "Synthetic Officer");
      assert.equal(comparison.roles.added[0].name, "New Synthetic Officer");
      assert.equal(comparison.current.sourceUpdatedAt, preview.sourceUpdatedAt);
      assert.equal(comparison.current.checkedAt, preview.checkedAt);
      const historical = await (await request(`/${entityId}/snapshots/${comparison.current.id}`, "GET", undefined, viewer)).json();
      const document = await request(`/${entityId}/snapshots/${comparison.current.id}/comparison-export?locale=sk`, "GET", undefined, viewer);
      assert.equal(document.status, 200);
      const html = await document.text();
      for (const text of ["Synthetic operator s.r.o.", "Updated synthetic operator a.s.", "Synthetic Officer",
        "New Synthetic Officer", "Registered street", "New registered seat"])
        assert.ok(html.includes(text), text);
      assert.ok(!html.includes("PRIVATE_TEST"));
      assert.deepEqual(historical.comparison, comparison);
      assert.ok(!("rawData" in historical));
      assert.ok(!JSON.stringify(historical).includes("PRIVATE_TEST"));
      assert.deepEqual((await (await request(`/${entityId}/snapshots/${previousId}`)).json()).rawData, previousRaw);
      assert.deepEqual((await pool.query(`SELECT name,address,city,postal_code FROM clinics WHERE id=$1`, [clinic])).rows, facilityBefore);
      assert.deepEqual((await pool.query(`SELECT * FROM healthcare_legal_entity_person_links WHERE legal_entity_id=$1 ORDER BY id`, [entityId])).rows, peopleBefore);
      assert.deepEqual((await pool.query(`SELECT * FROM healthcare_legal_entity_facilities WHERE legal_entity_id=$1 ORDER BY id`, [entityId])).rows, linksBefore);
      assert.equal((await request(`/${secondEntityId}/snapshots/${comparison.current.id}`)).status, 404);
      changedExtract = false;
    });
    await t.test("explicit snapshot review is authorized, immutable, idempotent and never inherited", async () => {
      const detail = await (await request(`/${entityId}`)).json();
      const snapshotId = detail.history[0].id;
      const path = `/${entityId}/snapshots/${snapshotId}/review`;
      const unchangedId = detail.history.find((s: any) => s.changeStatus === "unchanged").id;
      const baselineId = detail.history.at(-1).id;
      const persisted = async () => {
        const result: unknown[] = [];
        for (const table of ["healthcare_legal_entities", "healthcare_legal_entity_snapshots",
          "healthcare_legal_entity_facilities", "healthcare_legal_entity_person_links"])
          result.push((await pool.query(`SELECT * FROM ${table} WHERE ${table === "healthcare_legal_entities" ? "id" : "legal_entity_id"}=$1 ORDER BY id`, [entityId])).rows);
        result.push((await pool.query(`SELECT * FROM clinics WHERE id=$1`, [clinic])).rows);
        result.push((await pool.query(`SELECT * FROM collaborators WHERE id=$1`, [person])).rows);
        return result;
      };
      const before = await persisted();
      assert.equal(detail.history[0].changeStatus, "pending");
      for (const actor of [viewer, foreign, hidden]) {
        assert.equal((await request(path, "POST", { confirm: true, note: "Unauthorized rationale" }, actor)).status, 403);
      }
      assert.equal((await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, note: "Anonymous" }) })).status, 401);
      assert.equal((await request(path, "POST", { confirm: false })).status, 400);
      for (const note of [null, 42, {}, ["note"], "a".repeat(2001)])
        assert.equal((await request(path, "POST", { confirm: true, note })).status, 400);
      assert.equal((await request(path, "POST", { confirm: true, reviewedBy: viewer })).status, 400);
      assert.equal((await request(`/${secondEntityId}/snapshots/${snapshotId}/review`, "POST", { confirm: true })).status, 404);
      assert.equal((await request(`/${entityId}/snapshots/missing/review`, "POST", { confirm: true })).status, 404);
      for (const id of [baselineId, unchangedId])
        assert.equal((await request(`/${entityId}/snapshots/${id}/review`, "POST", { confirm: true })).status, 409);
      const note = '<script>alert("reason")</script>\nPosúdené & odôvodnené';
      const responses = await Promise.all([request(path, "POST", { confirm: true, note: `  ${note}  ` }),
        request(path, "POST", { confirm: true, note: "Concurrent competing reason" })]);
      assert.ok(responses.every(response => response.status === 200));
      const [first, retry] = await Promise.all(responses.map(response => response.json()));
      assert.deepEqual(first, retry);
      assert.equal(first.current.review.reviewedBy, admin);
      assert.ok(first.current.review.reviewedByName);
      assert.ok(Number.isFinite(Date.parse(first.current.review.reviewedAt)));
      assert.ok([note, "Concurrent competing reason"].includes(first.current.review.note));
      for (const payload of [{ confirm: true }, { confirm: true, note: "" }, { confirm: true, note: "Changed reason" }]) {
        const repeated = await (await request(path, "POST", payload)).json();
        assert.deepEqual(repeated.current.review, first.current.review, "retry must preserve the entire first review");
      }
      assert.equal(first.current.checkedAt, detail.history[0].checkedAt);
      assert.equal(first.current.sourceUpdatedAt, detail.history[0].sourceUpdatedAt);
      assert.deepEqual(await persisted(), before);
      const reviewedDetail = await (await request(`/${entityId}`, "GET", undefined, viewer)).json();
      assert.equal(reviewedDetail.history[0].changeStatus, "reviewed");
      assert.deepEqual(reviewedDetail.history[0].review, first.current.review);
      assert.deepEqual(reviewedDetail.comparison.current.review, first.current.review);
      const historical = await (await request(`/${entityId}/snapshots/${snapshotId}`, "GET", undefined, viewer)).json();
      assert.deepEqual(historical.comparison.current.review, first.current.review);
      const audit = reviewedDetail.audit.filter((event: any) => event.kind === "registry_changes_reviewed");
      assert.equal(audit.length, 1);
      assert.equal(audit[0].details.snapshotId, snapshotId);
      const list = await (await request()).json();
      assert.equal(list.items.find((e: any) => e.id === entityId).changeStatus, "reviewed");
      // The loader now supplies the original facts again: another real change.
      const result = await loader(ico);
      const verification = await pool.query(`INSERT INTO healthcare_legal_entity_verifications
        (created_by,normalized,registry_people,raw_data,checked_at,source_updated_at,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,now()+interval '10 minutes') RETURNING id`,
      [admin, JSON.stringify(result.company), JSON.stringify(result.registryPeople), JSON.stringify(result.rawData), result.checkedAt, result.sourceUpdatedAt]);
      const saved = await saveLegalVerification(await legalEntityActor(admin), { verificationId: verification.rows[0].id });
      assert.equal(saved.comparison.current.review, null);
      const newDetail = await (await request(`/${entityId}`)).json();
      assert.equal(newDetail.history[0].changeStatus, "pending");
      assert.equal(newDetail.history[1].changeStatus, "reviewed");
      assert.deepEqual(newDetail.history[1].review, first.current.review);
      assert.equal((await (await request()).json()).items.find((e: any) => e.id === entityId).changeStatus, "pending");
      const newSnapshotId = saved.comparison.current.id;
      const blankReview = await (await request(`/${entityId}/snapshots/${newSnapshotId}/review`, "POST",
        { confirm: true, note: " \n  " })).json();
      assert.equal(blankReview.current.review.note, null, "blank optional notes are stored without text");
    });
    await t.test("pending counts retain every historical changed snapshot after unchanged verification and reviews stay snapshot-specific", async () => {
      const readListEntity = async () => {
        const response = await request("", "GET", undefined, viewer);
        assert.equal(response.status, 200);
        return (await response.json()).items.find((item: any) => item.id === entityId);
      };
      const appendVerification = async () => {
        const result = await loader(ico);
        const { rows } = await pool.query(`INSERT INTO healthcare_legal_entity_verifications
          (created_by,normalized,registry_people,raw_data,checked_at,source_updated_at,expires_at)
          VALUES($1,$2,$3,$4,$5,$6,now()+interval '10 minutes') RETURNING id`,
        [admin, JSON.stringify(result.company), JSON.stringify(result.registryPeople),
          JSON.stringify(result.rawData), result.checkedAt, result.sourceUpdatedAt]);
        return saveLegalVerification(await legalEntityActor(admin), { verificationId: rows[0].id });
      };
      const initial = await readListEntity();
      assert.equal(initial.pendingSnapshotCount, 0);
      changedExtract = true;
      const olderChanged = await appendVerification();
      assert.equal((await readListEntity()).pendingSnapshotCount, 1);
      changedExtract = false;
      await appendVerification();
      assert.equal((await readListEntity()).pendingSnapshotCount, 2);
      changedExtract = true;
      await appendVerification();
      const lastChanged = await readListEntity();
      assert.equal(lastChanged.changeStatus, "pending");
      assert.equal(lastChanged.pendingSnapshotCount, 3);
      const unchanged = await appendVerification();
      const current = await readListEntity();
      assert.equal(current.changeStatus, "unchanged");
      assert.equal(current.pendingSnapshotCount, 3, "unchanged verification never hides old pending changes");
      assert.equal(current.saved_snapshots, undefined, "list never exposes source snapshots");
      const history = (await (await request(`/${entityId}`, "GET", undefined, viewer)).json()).history;
      assert.equal(history[0].id, unchanged.comparison.current.id);
      assert.equal(history[0].changeStatus, "unchanged");
      const pending = history.filter((item: any) => item.changeStatus === "pending");
      assert.equal(pending.length, current.pendingSnapshotCount);
      const path = `/${entityId}/snapshots/${olderChanged.comparison.current.id}/review`;
      assert.equal((await request(path, "POST", { confirm: true }, viewer)).status, 403);
      assert.equal((await readListEntity()).pendingSnapshotCount, 3);
      assert.equal((await request(path, "POST", { confirm: true })).status, 200);
      assert.equal((await readListEntity()).pendingSnapshotCount, 2);
      assert.equal((await request(path, "POST", { confirm: true })).status, 200);
      assert.equal((await readListEntity()).pendingSnapshotCount, 2, "retry cannot remove another pending review");
      for (const item of pending.filter((item: any) => item.id !== olderChanged.comparison.current.id))
        assert.equal((await request(`/${entityId}/snapshots/${item.id}/review`, "POST", { confirm: true })).status, 200);
      const reviewed = await readListEntity();
      assert.equal(reviewed.pendingSnapshotCount, 0);
      assert.equal(reviewed.changeStatus, "unchanged");
      const other = (await (await request()).json()).items.find((item: any) => item.id === secondEntityId);
      assert.equal(other.pendingSnapshotCount, 0, "baseline-only entity has no pending changes");
      for (const actor of [foreign, hidden])
        assert.equal((await request("", "GET", undefined, actor)).status, 403);
    });
    await t.test("large OR SR history: bounded cold backfill, warm diff parity and immediate snapshot-specific review", async () => {
      const stressId = randomUUID(), size = 6000;
      const company = (await loader(ico)).company;
      await pool.query(`INSERT INTO healthcare_legal_entities(id,ico,normalized,checked_at,created_by)
        VALUES($1,$2,$3,now(),$4)`, [stressId, String(randomInt(70_000_000, 79_999_999)), JSON.stringify(company), admin]);
      // Legacy rows intentionally lack derived keys; tied timestamps exercise both tie breakers.
      await pool.query(`INSERT INTO healthcare_legal_entity_snapshots
        (id,legal_entity_id,normalized,registry_people,raw_data,checked_at,created_at)
        SELECT $1||'-'||lpad(i::text,6,'0'),$1,
          $3::jsonb||jsonb_build_object('name',CASE WHEN (i/3)%2=0 THEN 'é' ELSE 'Other' END,
            'sourceOnly',repeat('x',4096)),
          CASE WHEN i%7=0 THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object(
            'key',i::text,'name','Synthetic Officer','role','Director','kind','statutoryBody','current',true),
            jsonb_build_object('key','private-'||i,'name','Synthetic Officer','role','Director',
              'kind','statutoryBody','current',true)) END,
          '{"private":"never transferred to overview"}'::jsonb,
          '2026-01-01'::timestamptz+(i/4)*interval '1 second',
          '2026-01-01'::timestamptz+(i/2)*interval '1 second'
        FROM generate_series(1,$2::int) i`, [stressId, size, JSON.stringify(company)]);
      const legacyStart = performance.now();
      const legacy = await pool.query(`SELECT jsonb_agg(s ORDER BY checked_at DESC,created_at DESC,id DESC) AS snapshots
        FROM (SELECT id,normalized,registry_people,checked_at,created_at,source_updated_at
          FROM healthcare_legal_entity_snapshots WHERE legal_entity_id=$1) s`, [stressId]);
      const history = savedRegistryHistory(legacy.rows[0].snapshots);
      const legacyMs = performance.now() - legacyStart;
      const legacyBytes = Buffer.byteLength(JSON.stringify(legacy.rows[0].snapshots));
      let maxBatchRows = 0, maxBatchBytes = 0, fetchedRows = 0;
      const coldStart = performance.now();
      await inLegalTransaction(async client => {
        await ensureRegistryComparisonKeys({ query: (async (...args: any[]) => {
          const result = await (client.query as any)(...args);
          if (String(args[0]).startsWith("FETCH")) {
            maxBatchRows = Math.max(maxBatchRows, result.rows.length);
            maxBatchBytes = Math.max(maxBatchBytes, Buffer.byteLength(JSON.stringify(result.rows)));
            fetchedRows += result.rows.length;
          }
          return result;
        }) as typeof client.query });
      });
      const coldMs = performance.now() - coldStart;
      assert.ok(fetchedRows >= size);
      assert.equal(maxBatchRows, REGISTRY_KEY_BATCH_SIZE);
      assert.ok(maxBatchBytes < legacyBytes / 10, "no complete normalized history is retained in the backfill");
      const readOverview = async () => {
        const response = await request("", "GET", undefined, viewer);
        assert.equal(response.status, 200);
        const items = (await response.json()).items;
        return items.find((item: any) => item.id === stressId);
      };
      const warmStart = performance.now();
      const overview = await readOverview();
      const warmMs = performance.now() - warmStart;
      let warmFetchedRows = 0;
      await inLegalTransaction(async client => {
        await ensureRegistryComparisonKeys({ query: (async (...args: any[]) => {
          const result = await (client.query as any)(...args);
          if (String(args[0]).startsWith("FETCH")) warmFetchedRows += result.rows.length;
          return result;
        }) as typeof client.query });
      });
      assert.equal(warmFetchedRows, 0, "warm reads must not transfer any normalized snapshots to Node");
      const expectedPending = history.filter(item => item.changeStatus === "pending");
      assert.equal(overview.pendingSnapshotCount, expectedPending.length);
      assert.equal(overview.changeStatus, history[0].changeStatus);
      assert.ok(!JSON.stringify(overview).includes("sourceOnly"));
      assert.ok(!JSON.stringify(overview).includes("private"));
      const oldPending = expectedPending.at(-2)!;
      const reviewPath = `/${stressId}/snapshots/${oldPending.id}/review`;
      assert.equal((await request(reviewPath, "POST", { confirm: true }, viewer)).status, 403);
      assert.equal((await request(reviewPath, "POST", { confirm: true })).status, 200);
      assert.equal((await readOverview()).pendingSnapshotCount, expectedPending.length - 1);
      assert.equal((await request(reviewPath, "POST", { confirm: true })).status, 200);
      assert.equal((await readOverview()).pendingSnapshotCount, expectedPending.length - 1);
      // Stale semantic versions are rebuilt, without altering the official source or reviews.
      await pool.query(`UPDATE healthcare_legal_entity_snapshot_comparison_keys SET key_version=0,comparison_key='stale'
        WHERE snapshot_id=$1`, [oldPending.id]);
      assert.equal((await readOverview()).pendingSnapshotCount, expectedPending.length - 1);
      assert.equal((await pool.query(`SELECT key_version FROM healthcare_legal_entity_snapshot_comparison_keys
        WHERE snapshot_id=$1`, [oldPending.id])).rows[0].key_version, REGISTRY_COMPARISON_KEY_VERSION);
      await pool.query(`DELETE FROM healthcare_legal_entity_snapshot_comparison_keys
        WHERE snapshot_id=ANY($1::varchar[])`, [[history[0].id, history[1].id]]);
      const concurrent = await Promise.all([readOverview(), readOverview()]);
      assert.ok(concurrent.every(item => item.pendingSnapshotCount === expectedPending.length - 1),
        "concurrent legacy backfills produce identical counts");
      // Late historical insertion changes the predecessor, not the per-snapshot facts.
      await pool.query(`INSERT INTO healthcare_legal_entity_snapshots
        (id,legal_entity_id,normalized,registry_people,raw_data,checked_at,created_at)
        VALUES($1,$2,$3,'[]','{}','2025-01-01','2025-01-01')`,
      [randomUUID(), stressId, JSON.stringify({ ...company, name: "Earlier baseline" })]);
      assert.equal((await readOverview()).pendingSnapshotCount, expectedPending.length,
        "inserting an older baseline reclassifies its successor without stale adjacency caches");
      for (const actor of [foreign, hidden])
        assert.equal((await request("", "GET", undefined, actor)).status, 403);
      t.diagnostic(JSON.stringify({ snapshots: size, legacyMs: Math.round(legacyMs), coldBackfillMs: Math.round(coldMs),
        warmOverviewMs: Math.round(warmMs), legacyNormalizedBytes: legacyBytes, maxBatchRows, maxBatchBytes }));
    });
    await t.test("upstream failure never changes persisted source or facility records", async () => {
      failLoader = true;
      assert.equal((await request(`/${entityId}/verify`, "POST", {})).status, 502);
      assert.equal((await (await request(`/${entityId}`)).json()).entity.notes, "Preserved operational note");
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    const entityIds = (await pool.query(`SELECT id FROM healthcare_legal_entities WHERE created_by=$1`, [admin])).rows.map(row => row.id);
    await pool.query(`DELETE FROM healthcare_legal_entity_snapshot_reviews WHERE snapshot_id IN
      (SELECT id FROM healthcare_legal_entity_snapshots WHERE legal_entity_id=ANY($1::varchar[]))`, [entityIds]);
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
