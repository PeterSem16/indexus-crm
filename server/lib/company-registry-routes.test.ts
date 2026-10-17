import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, randomInt } from "node:crypto";
import express from "express";
import { pool } from "../db";
import { ensureHealthcareLegalEntitySchema } from "./healthcare-legal-entity-schema";
import { registerHealthcareLegalEntityRoutes } from "./healthcare-legal-entity-routes";
import { loadAresCompany, loadAnafCompany, withAnafAdmission, type CountryRegistryLoader } from "./company-registry-client";
import { loadOrsrCompany, type RegistryVerification } from "./orsr-client";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT)
  throw new Error("Registry fixtures must not run in production");

test("country registry APIs: persistence, country authorization, unchanged facilities, exports and shared ANAF admission", async t => {
  await ensureHealthcareLegalEntitySchema(pool);
  await ensureHealthcareLegalEntitySchema(pool);
  const countries = ["SK", "CZ", "RO"] as const;
  const actors = { admin: randomUUID(), SK: randomUUID(), CZ: randomUUID(), RO: randomUUID(), foreign: randomUUID() };
  const clinics = Object.fromEntries(countries.map(c => [c, randomUUID()]));
  const hospitals = Object.fromEntries(countries.map(c => [c, randomUUID()]));
  const people = Object.fromEntries(countries.map(c => [c, randomUUID()]));
  const entities: Record<string, string> = {};
  const snapshots: Record<string, string> = {};
  const ico = String(randomInt(90_000_000, 99_000_000));
  const prefix = `registry-country-${randomUUID()}`;
  const routed: string[] = [];
  const verification = async (id: string, country: typeof countries[number]): Promise<RegistryVerification> => {
    if (country === "CZ") return loadAresCompany(id, async () => ({ ico: id, obchodniJmeno: `${prefix}-CZ`,
      sidlo: { textovaAdresa: "Registered Czech seat", nazevObce: "Praha", psc: 11000 }, pravniForma: "112" }));
    if (country === "RO") return loadAnafCompany(id, async () => ({ found: [{
      date_generale: { cui: Number(id), denumire: `${prefix}-RO`, adresa: "Registered Romanian seat" },
      inregistrare_scop_Tva: { scpTVA: true }, stare_inactiv: { statusInactivi: false },
    }], notFound: [] }));
    return loadOrsrCompany(id, async path => path === "/api/legal-person"
      ? { data: [{ registrationNumber: id, fileReference: { section: "Sro", court: "B", insertNumber: 1 } }], filteredCount: 1 }
      : path.endsWith("/documents") ? [] : { legalPerson: { id: [{ current: true, identifierValue: id }],
        corporateBody: { corporateBodyFullName: [{ current: true, value: `${prefix}-SK` }] } } });
  };
  const loader: CountryRegistryLoader = async (id, country) => { routed.push(country); return verification(id, country); };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const user = req.headers["x-registry-user"];
    if (Object.values(actors).includes(String(user))) (req as any).session = { user: { id: user } };
    next();
  });
  registerHealthcareLegalEntityRoutes(app, (req: any, res: any, next: any) =>
    req.session?.user ? next() : res.status(401).json({ error: "unauthorized" }), loader);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/healthcare-legal-entities`;
  const request = (path = "", method = "GET", body?: unknown, actor = actors.admin) => fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json", "x-registry-user": actor },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = async (response: Response, expected = 200) => {
    assert.equal(response.status, expected, await response.clone().text());
    return response.json();
  };
  try {
    for (const [key, user] of Object.entries(actors)) {
      await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,assigned_countries,is_active)
        VALUES($1,$2,$3,'Synthetic registry user',$4,$5,$6,true)`, [
        user, `${prefix}-${key}`, `${user}@example.invalid`, randomUUID(), key === "admin" ? "admin" : "manager",
        key === "admin" ? ["SK"] : [key === "foreign" ? "HU" : key],
      ]);
    }
    for (const country of countries) {
      await pool.query(`INSERT INTO clinics(id,name,country_code,ico,address,city,postal_code)
        VALUES($1,$2,$3,$4,'Operational clinic street','Operational city','00000')`,
      [clinics[country], `${prefix}-clinic-${country}`, country, country === "RO" ? `RO${ico}` : ico]);
      await pool.query(`INSERT INTO hospitals(id,name,country_code,ico,street_number,city)
        VALUES($1,$2,$3,$4,'Operational hospital street','Operational hospital city')`,
      [hospitals[country], `${prefix}-hospital-${country}`, country, ico]);
      await pool.query(`INSERT INTO collaborators(id,first_name,last_name,country_code,country_codes)
        VALUES($1,$2,$3,$4,ARRAY[$4]::text[])`, [people[country], prefix, country, country]);
      await pool.query(`INSERT INTO contact_assignments(person_id,entity_type,entity_id,role)
        VALUES($1,'clinic',$2,'Doctor')`, [people[country], clinics[country]]);
    }
    await t.test("verification follows server-owned facility country and does not overwrite operational data", async () => {
      for (const country of countries) {
        const preview = await json(await request("/verify", "POST", {
          ico: country === "RO" ? `RO ${ico}` : ico, facilityType: "clinic", facilityId: clinics[country],
        }, actors[country]));
        assert.equal(preview.company.countryCode, country);
        const saved = await json(await request("/save", "POST", {
          verificationId: preview.verificationId, facilityType: "clinic", facilityId: clinics[country], confirmOperator: true,
        }, actors[country]));
        entities[country] = saved.entityId;
        snapshots[country] = saved.comparison.current.id;
        const row = (await pool.query("SELECT name,address,city,postal_code,ico FROM clinics WHERE id=$1", [clinics[country]])).rows[0];
        assert.deepEqual(row, { name: `${prefix}-clinic-${country}`, address: "Operational clinic street",
          city: "Operational city", postal_code: "00000", ico: country === "RO" ? `RO${ico}` : ico });
        const detail = await json(await request(`/${saved.entityId}`, "GET", undefined, actors[country]));
        assert.equal(detail.entity.countryCode, country);
        assert.equal(detail.facilities[0].facilityId, clinics[country]);
        assert.equal(detail.people[0].personId, people[country]);
      }
      assert.equal(new Set(Object.values(entities)).size, 3, "Same identifier in different countries is never merged");
      assert.deepEqual(routed, ["SK", "CZ", "RO"]);
    });
    await t.test("list, options, people, detail, raw export, history and mutations all honor assigned countries", async () => {
      for (const country of countries) {
        const actor = actors[country];
        const overview = await json(await request("", "GET", undefined, actor));
        assert.deepEqual(overview.countries, [country]);
        assert.ok(overview.items.every((e: any) => e.countryCode === country));
        const facilityOptions = await json(await request(`/facility-options?countryCode=${country}&search=${prefix}`, "GET", undefined, actor));
        assert.equal(facilityOptions.items.length, 2);
        assert.ok(facilityOptions.items.every((f: any) => f.countryCode === country));
        const personOptions = await json(await request(`/person-options?countryCode=${country}&search=${prefix}`, "GET", undefined, actor));
        assert.deepEqual(personOptions.items.map((p: any) => p.id), [people[country]]);
        for (const other of countries.filter(c => c !== country)) {
          for (const path of [`/${entities[other]}`, `/${entities[other]}/export`,
            `/${entities[other]}/snapshots/${snapshots[other]}`,
            `/${entities[other]}/snapshots/${snapshots[other]}/comparison-export`,
            `/facilities/clinic/${clinics[other]}`, `/persons/${people[other]}`,
            `/facility-options?countryCode=${other}`, `/person-options?countryCode=${other}`])
            assert.equal((await request(path, "GET", undefined, actor)).status, path.startsWith("/persons/") ? 404 : 403, path);
          assert.equal((await request(`/${entities[other]}`, "PATCH", { notes: "Unauthorized" }, actor)).status, 403);
          assert.equal((await request(`/${entities[other]}/verify`, "POST", {}, actor)).status, 403);
          assert.equal((await request(`/${entities[other]}/snapshots/${snapshots[other]}/review`, "POST", { confirm: true }, actor)).status, 403);
          assert.equal((await request(`/${entities[other]}/facilities`, "POST", {
            facilityType: "hospital", facilityId: hospitals[other], confirmOperator: true,
          }, actor)).status, 403);
        }
      }
      assert.equal((await request("", "GET", undefined, actors.foreign)).status, 403);
      assert.equal((await fetch(base)).status, 401);
    });
    await t.test("cross-country linking, stale previews after country revocation, and country spoofing fail closed", async () => {
      assert.equal((await request(`/${entities.CZ}/facilities`, "POST", {
        facilityType: "hospital", facilityId: hospitals.RO, confirmOperator: true,
      })).status, 409);
      assert.equal((await request("/verify", "POST", {
        ico, countryCode: "SK", facilityType: "clinic", facilityId: clinics.CZ,
      })).status, 409);
      assert.equal((await request("/verify", "POST", { ico, countryCode: "DE" })).status, 400);
      const preview = await json(await request("/verify", "POST", { ico, countryCode: "CZ" }, actors.CZ));
      await pool.query("UPDATE users SET assigned_countries=ARRAY['RO'] WHERE id=$1", [actors.CZ]);
      assert.equal((await request("/save", "POST", { verificationId: preview.verificationId }, actors.CZ)).status, 403);
      await pool.query("UPDATE users SET assigned_countries=ARRAY['CZ'] WHERE id=$1", [actors.CZ]);
    });
    await t.test("same-country hospital links and re-verification retain provider and full source in exports", async () => {
      for (const country of ["CZ", "RO"] as const) {
        await json(await request(`/${entities[country]}/facilities`, "POST", {
          facilityType: "hospital", facilityId: hospitals[country], confirmOperator: true,
        }, actors[country]));
        const preview = await json(await request(`/${entities[country]}/verify`, "POST", {}, actors[country]));
        assert.equal(preview.company.countryCode, country);
        await json(await request("/save", "POST", { verificationId: preview.verificationId }, actors[country]));
        const source = country === "CZ" ? "ARES" : "ANAF";
        const bundle = await json(await request(`/${entities[country]}/export`, "GET", undefined, actors[country]));
        assert.equal(bundle.source.provider, source);
        assert.ok(bundle.snapshot.rawData.response);
        const document = await request(`/${entities[country]}/snapshots/${snapshots[country]}/comparison-export?locale=sk`, "GET", undefined, actors[country]);
        assert.equal(document.status, 200);
        const html = await document.text();
        assert.ok(html.includes(`INDEXUS · ${source}`));
        assert.ok(!html.includes("OR SR"));
        assert.equal((await json(await request(`/facilities/hospital/${hospitals[country]}`, "GET", undefined, actors[country]))).registryCompany.countryCode, country);
      }
    });
    await t.test("ANAF admission is shared, rejects concurrent requests without calling upstream and releases on failure", async () => {
      let release!: () => void;
      let admitted!: () => void;
      const started = new Promise<void>(resolve => { admitted = resolve; });
      const first = withAnafAdmission(async () => {
        admitted();
        await new Promise<void>(r => { release = r; });
      });
      await started;
      let called = false;
      await assert.rejects(withAnafAdmission(async () => { called = true; }), /rate_limited/);
      assert.equal(called, false);
      release(); await first;
      await assert.rejects(withAnafAdmission(async () => { throw new Error("Synthetic failure"); }), /Synthetic failure/);
      assert.equal(await withAnafAdmission(async () => "released"), "released");
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    const entityIds = (await pool.query("SELECT id FROM healthcare_legal_entities WHERE created_by=ANY($1::varchar[])", [Object.values(actors)])).rows.map(row => row.id);
    await pool.query("DELETE FROM healthcare_legal_entity_verifications WHERE created_by=ANY($1::varchar[])", [Object.values(actors)]);
    await pool.query("DELETE FROM healthcare_legal_entity_audit WHERE legal_entity_id=ANY($1::varchar[])", [entityIds]);
    await pool.query("DELETE FROM healthcare_legal_entity_facilities WHERE legal_entity_id=ANY($1::varchar[])", [entityIds]);
    await pool.query("DELETE FROM healthcare_legal_entity_person_links WHERE legal_entity_id=ANY($1::varchar[])", [entityIds]);
    await pool.query(`DELETE FROM healthcare_legal_entity_snapshot_reviews WHERE snapshot_id IN
      (SELECT id FROM healthcare_legal_entity_snapshots WHERE legal_entity_id=ANY($1::varchar[]))`, [entityIds]);
    await pool.query("DELETE FROM healthcare_legal_entity_snapshots WHERE legal_entity_id=ANY($1::varchar[])", [entityIds]);
    await pool.query("DELETE FROM healthcare_legal_entities WHERE id=ANY($1::varchar[])", [entityIds]);
    await pool.query("DELETE FROM contact_assignments WHERE person_id=ANY($1::varchar[])", [Object.values(people)]);
    await pool.query("DELETE FROM collaborators WHERE id=ANY($1::varchar[])", [Object.values(people)]);
    await pool.query("DELETE FROM clinics WHERE id=ANY($1::varchar[])", [Object.values(clinics)]);
    await pool.query("DELETE FROM hospitals WHERE id=ANY($1::varchar[])", [Object.values(hospitals)]);
    await pool.query("DELETE FROM users WHERE id=ANY($1::varchar[])", [Object.values(actors)]);
    await pool.end();
  }
});
