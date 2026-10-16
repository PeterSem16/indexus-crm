import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { pool } from "../db";
import { ensureProviderFinderSchema } from "./provider-finder-schema";
import { registerProviderFinderRoutes, normalizePublicFinderSelection } from "./provider-finder-routes";
import { DEFAULT_FINDER_POLICY } from "../../shared/provider-finder";

test("country-wide finder: scope, evidence, weights, optional public forms and persistence", async t => {
  await ensureProviderFinderSchema(pool);
  // Synthetic countries avoid touching real country policies or form bindings.
  const country = "ZX", foreignCountry = "ZY", suffix = randomUUID();
  const admin = randomUUID(), viewer = randomUUID(), foreign = randomUUID(), role = randomUUID();
  const company = randomUUID(), otherCompany = randomUUID(), clinic = randomUUID(), near = randomUUID();
  const hospital = randomUUID(), foreignClinic = randomUUID(), person = randomUUID(), foreignPerson = randomUUID();
  const customer = randomUUID(), form = randomUUID(), otherForm = randomUUID(), foreignForm = randomUUID();
  const slug = `finder-test-${suffix}`, status = randomUUID(), assignment = randomUUID(), agreement = randomUUID();
  const app = express(); app.use(express.json());
  app.use((req: any, _res, next) => {
    const id = req.headers["x-finder-test-user"];
    if ([admin, viewer, foreign].includes(String(id))) req.session = { user: { id } };
    next();
  });
  registerProviderFinderRoutes(app, (req: any, res, next) => req.session?.user ? next() : res.sendStatus(401));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(r => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  const request = (path: string, method = "GET", body?: unknown, actor = admin) =>
    fetch(base + path, { method, headers: { "Content-Type": "application/json", "x-finder-test-user": actor },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const configPath = `/provider-finder/country-config/${country}`, prefix = `/provider-finder/context/country/${country}`;
  const publicPath = `/public/web-form/${slug}/providers`;
  const search = { point: { lat: 48.15, lng: 17.11 }, radiusKm: 25 };
  const policy = { ...DEFAULT_FINDER_POLICY, enabled: true, publicEnabled: true, preferContract: false };
  const selection = { id: clinic, type: "clinic", billingCompanyId: "country", country, personId: person };
  const save = (overrides = {}, formIds = [form]) => request(configPath, "PUT", { policy: { ...policy, ...overrides }, formIds });
  const savedServerKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  const savedBrowserKey = process.env.GOOGLE_MAPS_BROWSER_API_KEY;
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "synthetic-server-test-only";
  process.env.GOOGLE_MAPS_BROWSER_API_KEY = "synthetic-browser-test-only";
  try {
    await pool.query("INSERT INTO roles(id,name) VALUES($1,$2)", [role, slug]);
    await pool.query(`INSERT INTO role_module_permissions(role_id,module_key,access,can_edit) VALUES
      ($1,'customers','read',false),($1,'collaborators','hidden',false),($1,'configurator','hidden',false)`, [role]);
    for (const [id, code, userRole, roleId] of [[admin, country, "admin", null], [viewer, country, "user", role], [foreign, foreignCountry, "manager", null]])
      await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,role_id,assigned_countries)
        VALUES($1,$2,$3,'Synthetic finder test','not-a-login',$4,$5,ARRAY[$6]::text[])`,
      [id, `${suffix}-${id}`, `${id}@example.invalid`, userRole, roleId, code]);
    for (const id of [company, otherCompany])
      await pool.query(`INSERT INTO billing_details(id,country_code,company_name,address,city) VALUES($1,$2,'Synthetic','test','test')`, [id, country]);
    for (const [id, code, lng] of [[clinic, country, 17.2], [near, country, 17.12], [foreignClinic, foreignCountry, 17.11]])
      await pool.query(`INSERT INTO clinics(id,name,country_code,latitude,longitude) VALUES($1,'Synthetic',$2,48.15,$3)`, [id, code, lng]);
    await pool.query(`INSERT INTO hospitals(id,name,country_code,latitude,longitude) VALUES($1,'Synthetic hospital',$2,48.15,17.13)`, [hospital, country]);
    for (const [id, code] of [[person, country], [foreignPerson, foreignCountry]]) {
      await pool.query(`INSERT INTO collaborators(id,first_name,last_name,country_code,country_codes) VALUES($1,'Doctor','Synthetic',$2,ARRAY[$2]::text[])`, [id, code]);
      await pool.query(`INSERT INTO contact_assignments(person_id,entity_type,entity_id) VALUES($1,'clinic',$2)`, [id, clinic]);
    }
    await pool.query(`INSERT INTO customers(id,first_name,last_name,email,country,address) VALUES($1,'Synthetic','Finder',$2,$3,'UNCHANGED')`, [customer, `${customer}@example.invalid`, country]);
    for (const [id, code, formSlug] of [[form, country, slug], [otherForm, country, `${slug}-off`], [foreignForm, foreignCountry, `${slug}-foreign`]])
      await pool.query(`INSERT INTO web_forms(id,name,slug,country_code) VALUES($1,'Synthetic form',$2,$3)`, [id, formSlug, code]);
    await t.test("auth and country checks protect settings; cross-country forms cannot be bound", async () => {
      assert.equal((await fetch(base + configPath)).status, 401);
      assert.equal((await request(configPath, "GET", undefined, foreign)).status, 403);
      assert.equal((await request(configPath, "PUT", { policy, formIds: [] }, viewer)).status, 403);
      assert.equal((await save({}, [foreignForm])).status, 400);
      assert.equal((await request(publicPath + "/config")).status, 404);
    });
    await t.test("one policy covers every company; no site profiles are needed", async () => {
      assert.equal((await save()).status, 200);
      const config = await (await request(configPath)).json();
      assert.equal(config.billingCompanyId, "country"); assert.deepEqual(config.formIds, [form]);
      assert.equal(config.mapsReady, true);
      for (const path of [prefix, publicPath]) {
        const map = await request(path + "/map-config");
        assert.equal(map.status, 200);
        const mapConfig = await map.json();
        assert.equal(mapConfig.provider, "google");
        assert.equal(mapConfig.browserKey, "synthetic-browser-test-only");
        assert.ok(!JSON.stringify(mapConfig).includes("synthetic-server-test-only"));
      }
      assert.equal((await request(prefix + "/map-config", "GET", undefined, "")).status, 401);
      assert.equal((await request(`/public/web-form/${slug}-off/providers/map-config`)).status, 404);
      for (const id of [company, otherCompany]) {
        const ctx = await (await request(`/provider-finder/context/${id}/${country}`)).json();
        assert.equal(ctx.billingCompanyId, "country"); assert.deepEqual(ctx.policy, config.policy);
      }
      const rows = await (await request(publicPath + "/search", "POST", search)).json();
      assert.deepEqual(new Set(rows.results.map((r: any) => r.id)), new Set([clinic, near, hospital]));
      assert.deepEqual(rows.results.find((r: any) => r.id === clinic).people.map((p: any) => p.id), [person]);
      for (const key of ["cooperating", "uploadedContract", "hasRepresentative", "priorityScore", "contracted"])
        assert.ok(rows.results.every((r: any) => !(key in r)), key);
      assert.equal((await request(`/public/web-form/${slug}-off/providers/config`)).status, 404);
      const hidden = await (await request(prefix + "/search", "POST", search, viewer)).json();
      assert.ok(hidden.results.every((r: any) => r.people.length === 0));
    });
    await t.test("missing or reused keys fail closed but GPS/coordinate ranking still works", async () => {
      try {
        delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
        delete process.env.GOOGLE_MAPS_BROWSER_API_KEY;
        for (const path of [prefix, publicPath]) {
          const context = await (await request(path === prefix ? path : path + "/config")).json();
          assert.equal(context.mapReady, false);
          assert.equal(context.geocodingReady, false);
          assert.equal((await request(path + "/map-config")).status, 503);
          const geocode = await request(path + "/geocode", "POST", { address: "Synthetic missing credentials", language: "sk" });
          assert.equal(geocode.status, 503);
          assert.equal((await geocode.json()).error, "maps_not_configured");
          assert.equal((await request(path + "/search", "POST", search)).status, 200);
        }
        process.env.GOOGLE_MAPS_SERVER_API_KEY = "synthetic-must-not-be-public";
        process.env.GOOGLE_MAPS_BROWSER_API_KEY = "synthetic-must-not-be-public";
        const reused = await request(prefix + "/map-config");
        assert.equal(reused.status, 503);
        assert.ok(!(await reused.text()).includes("synthetic-must-not-be-public"));
      } finally {
        process.env.GOOGLE_MAPS_SERVER_API_KEY = "synthetic-server-test-only";
        process.env.GOOGLE_MAPS_BROWSER_API_KEY = "synthetic-browser-test-only";
      }
    });
    await t.test("Google geocodes work concurrently without the public Photon's shared database gate", async () => {
      const originalFetch = globalThis.fetch;
      const blocker = await pool.connect();
      let released = false;
      const starts: number[] = [];
      globalThis.fetch = (async (input: any, init: any) => {
        const url = new URL(String(input));
        if (url.hostname !== "maps.googleapis.com") return originalFetch(input, init);
        starts.push(Date.now());
        return Response.json({ status: "OK", results: [{
          formatted_address: "Synthetic lookup",
          address_components: [{ short_name: country, types: ["country"] }],
          geometry: { location: { lat: 48.15, lng: 17.11 }, location_type: "ROOFTOP" },
        }] });
      }) as typeof fetch;
      try {
        await blocker.query("SELECT pg_advisory_lock(714290311)");
        const one = request(prefix + "/geocode", "POST", { address: "Synthetic queue one", language: "en" });
        const two = request(publicPath + "/geocode", "POST", { address: "Synthetic queue two", language: "en" });
        await new Promise(resolve => setTimeout(resolve, 200));
        assert.equal(starts.length, 2, "an old Photon slot cannot block Google lookups");
        await blocker.query("SELECT pg_advisory_unlock(714290311)");
        released = true;
        const responses = await Promise.all([one, two]);
        assert.deepEqual(responses.map(r => r.status), [200, 200]);
        assert.equal(starts.length, 2);
        assert.ok(Math.abs(starts[1] - starts[0]) < 1000, "no artificial one-per-second Google bottleneck");
        for (const response of responses) assert.equal((await response.json()).candidates.length, 1);
      } finally {
        if (!released) await blocker.query("SELECT pg_advisory_unlock(714290311)");
        blocker.release();
        globalThis.fetch = originalFetch;
      }
    });
    await t.test("real CRM evidence affects ranking, filters and selection revalidation", async () => {
      await pool.query(`INSERT INTO clinic_cooperation_statuses(id,clinic_id,status_key,phase) VALUES($1,$2,'retention_active','retention')`, [status, clinic]);
      await pool.query(`INSERT INTO clinic_representative_assignments(id,clinic_id,user_id) VALUES($1,$2,$3)`, [assignment, clinic, admin]);
      await pool.query(`INSERT INTO clinic_agreements(id,clinic_id,title,file_name,storage_key,content_type,file_size,created_by)
        VALUES($1,$2,'Synthetic','test.pdf',$3,'application/pdf',1,$4)`, [agreement, clinic, slug, admin]);
      const rows = await (await request(prefix + "/search", "POST", search)).json();
      assert.equal(rows.results[0].id, clinic); assert.equal(rows.results[0].cooperating, true);
      assert.equal(rows.results[0].uploadedContract, true); assert.equal(rows.results[0].hasRepresentative, true);
      await save({ requireCooperation: true, requireUploadedContract: true, requireRepresentative: true });
      assert.deepEqual((await (await request(publicPath + "/search", "POST", search)).json()).results.map((r: any) => r.id), [clinic]);
      await pool.query("UPDATE clinic_agreements SET active=false WHERE id=$1", [agreement]);
      await assert.rejects(() => normalizePublicFinderSelection(slug, selection));
      await pool.query("UPDATE clinic_agreements SET active=true WHERE id=$1", [agreement]);
      await save({ priorityWeights: { distance: 100, cooperation: 0, uploadedContract: 0, representative: 0, recentContact: 0 } });
      assert.equal((await (await request(prefix + "/search", "POST", search)).json()).results[0].id, near);
    });
    await t.test("selection persists without changing the address; foreign people/sites fail closed", async () => {
      assert.equal((await request(`/provider-finder/customers/${customer}`, "PUT", selection)).status, 200);
      assert.equal((await (await request(`/provider-finder/customers/${customer}`)).json()).id, clinic);
      assert.equal((await pool.query("SELECT address FROM customers WHERE id=$1", [customer])).rows[0].address, "UNCHANGED");
      await assert.rejects(() => normalizePublicFinderSelection(slug, { ...selection, id: foreignClinic }));
      await assert.rejects(() => normalizePublicFinderSelection(slug, { ...selection, personId: foreignPerson }));
      await assert.rejects(() => normalizePublicFinderSelection(slug, { ...selection, country: foreignCountry }));
      assert.equal((await normalizePublicFinderSelection(slug, selection)).personName, "Doctor Synthetic");
    });
    await t.test("public/internal switches and per-form optional enablement remain independent", async () => {
      await save({ enabled: false });
      assert.equal((await request(publicPath + "/config")).status, 200);
      assert.equal((await request(prefix + "/search", "POST", search)).status, 409);
      await save({ publicEnabled: false });
      assert.equal((await request(publicPath + "/config")).status, 404);
      await save({}, []);
      assert.equal((await request(publicPath + "/config")).status, 404);
      await save();
      assert.equal((await request(publicPath + "/search", "POST", { ...search, radiusKm: 201 })).status, 400);
    });
  } finally {
    if (savedServerKey === undefined) delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
    else process.env.GOOGLE_MAPS_SERVER_API_KEY = savedServerKey;
    if (savedBrowserKey === undefined) delete process.env.GOOGLE_MAPS_BROWSER_API_KEY;
    else process.env.GOOGLE_MAPS_BROWSER_API_KEY = savedBrowserKey;
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    await pool.query("DELETE FROM provider_finder_country_policies WHERE country=$1", [country]);
    await pool.query("DELETE FROM clinic_cooperation_statuses WHERE id=$1", [status]);
    await pool.query("DELETE FROM clinic_representative_assignments WHERE id=$1", [assignment]);
    await pool.query("DELETE FROM customers WHERE id=$1", [customer]);
    await pool.query("DELETE FROM web_forms WHERE id=ANY($1::varchar[])", [[form, otherForm, foreignForm]]);
    await pool.query("DELETE FROM billing_details WHERE id=ANY($1::varchar[])", [[company, otherCompany]]);
    await pool.query("DELETE FROM contact_assignments WHERE person_id=ANY($1::varchar[])", [[person, foreignPerson]]);
    await pool.query("DELETE FROM collaborators WHERE id=ANY($1::varchar[])", [[person, foreignPerson]]);
    await pool.query("DELETE FROM clinics WHERE id=ANY($1::varchar[])", [[clinic, near, foreignClinic]]);
    await pool.query("DELETE FROM hospitals WHERE id=$1", [hospital]);
    await pool.query("DELETE FROM users WHERE id=ANY($1::varchar[])", [[admin, viewer, foreign]]);
    await pool.query("DELETE FROM role_module_permissions WHERE role_id=$1", [role]);
    await pool.query("DELETE FROM roles WHERE id=$1", [role]);
    await pool.end();
  }
});
