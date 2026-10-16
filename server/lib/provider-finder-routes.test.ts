import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { pool } from "../db";
import { ensureProviderFinderSchema } from "./provider-finder-schema";
import { registerProviderFinderRoutes, normalizePublicFinderSelection } from "./provider-finder-routes";
import { DEFAULT_FINDER_POLICY } from "../../shared/provider-finder";

test("provider finder integration, permissions, public opt-in and persisted selection", async t => {
  await ensureProviderFinderSchema(pool);
  const admin = randomUUID(), viewer = randomUUID(), foreign = randomUUID(), role = randomUUID();
  const company = randomUUID(), otherCompany = randomUUID(), foreignCompany = randomUUID();
  const clinic = randomUUID(), privateClinic = randomUUID(), missingClinic = randomUUID(), foreignClinic = randomUUID(), hospital = randomUUID();
  const person = randomUUID(), privatePerson = randomUUID(), customer = randomUUID(), foreignCustomer = randomUUID();
  const form = randomUUID(), foreignForm = randomUUID(), slug = `finder-test-${randomUUID()}`;
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => {
    const actor = req.headers["x-finder-test-user"];
    if ([admin, viewer, foreign].includes(String(actor))) (req as any).session = { user: { id: actor } };
    next();
  });
  registerProviderFinderRoutes(app, (req: any, res, next) => req.session?.user ? next() : res.sendStatus(401));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(r => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  const request = (path: string, method = "GET", body?: unknown, actor = admin) =>
    fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", "x-finder-test-user": actor },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const configPath = `/provider-finder/config/${company}/SK`;
  const profilePath = `/provider-finder/profile/${company}/SK`;
  const publicPath = `/public/web-form/${slug}/providers`;
  const search = { point: { lat: 48.15, lng: 17.11 }, radiusKm: 25 };
  const selection = { id: clinic, type: "clinic", billingCompanyId: company, country: "SK", personId: person };
  const policy = { ...DEFAULT_FINDER_POLICY, enabled: true, publicEnabled: true, services: ["testing"] };
  try {
    await pool.query("INSERT INTO roles(id,name) VALUES($1,$2)", [role, slug]);
    await pool.query(`INSERT INTO role_module_permissions(role_id,module_key,access,can_add,can_edit) VALUES
      ($1,'customers','read',false,false),($1,'collaborators','hidden',false,false),($1,'configurator','hidden',false,false)`, [role]);
    for (const [id, country, userRole, roleId] of [[admin, "SK", "admin", null], [viewer, "SK", "user", role], [foreign, "CZ", "manager", null]]) {
      await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,role_id,assigned_countries)
        VALUES($1,$2,$3,'Synthetic finder user','not-a-real-login',$4,$5,ARRAY[$6]::text[])`, [id, `${slug}-${id}`, `${id}@example.invalid`, userRole, roleId, country]);
    }
    for (const [id, country] of [[company, "SK"], [otherCompany, "SK"], [foreignCompany, "CZ"]])
      await pool.query(`INSERT INTO billing_details(id,country_code,company_name,address,city) VALUES($1,$2,'Synthetic finder company','test','test')`, [id, country]);
    await pool.query(`INSERT INTO clinics(id,name,country_code,address,city,latitude,longitude) VALUES
      ($1,'Public synthetic clinic','SK','test','test',48.15,17.12),($2,'Private synthetic clinic','SK','test','test',48.15,17.13),
      ($3,'Unlocated synthetic clinic','SK','test','test',NULL,NULL),($4,'Foreign synthetic clinic','CZ','test','test',48.15,17.12)`,
    [clinic, privateClinic, missingClinic, foreignClinic]);
    await pool.query(`INSERT INTO hospitals(id,name,country_code,street_number,city,latitude,longitude) VALUES($1,'Synthetic hospital','SK','test','test',48.15,17.14)`, [hospital]);
    await pool.query(`INSERT INTO collaborators(id,first_name,last_name,country_code,country_codes) VALUES
      ($1,'Public','Synthetic','SK',ARRAY['SK']),($2,'Private','Synthetic','SK',ARRAY['SK'])`, [person, privatePerson]);
    await pool.query(`INSERT INTO contact_assignments(person_id,entity_type,entity_id,role) VALUES
      ($1,'clinic',$3,'Doctor'),($2,'clinic',$3,'Doctor')`, [person, privatePerson, clinic]);
    for (const [id, country] of [[customer, "SK"], [foreignCustomer, "CZ"]])
      await pool.query(`INSERT INTO customers(id,first_name,last_name,email,country,address) VALUES($1,'Synthetic','Finder',$2,$3,'UNCHANGED ADDRESS')`, [id, `${id}@example.invalid`, country]);
    await pool.query(`INSERT INTO web_forms(id,name,slug,country_code) VALUES
      ($1,'Synthetic finder form',$2,'SK'),($3,'Synthetic foreign form',$4,'CZ')`, [form, slug, foreignForm, `${slug}-cz`]);
    await t.test("unauthenticated access and country/configurator writes are blocked", async () => {
      assert.equal((await fetch(`${base}${configPath}`)).status, 401);
      assert.equal((await request(configPath, "GET", undefined, foreign)).status, 403);
      assert.equal((await request(configPath, "PUT", { policy, formIds: [form] }, viewer)).status, 403);
      assert.equal((await request(`/provider-finder/config/${foreignCompany}/SK`)).status, 404);
      assert.equal((await request(configPath, "PUT", { policy, formIds: [foreignForm] })).status, 400);
    });
    await t.test("country configuration is persisted and form bindings cannot be stolen", async () => {
      assert.equal((await request(configPath, "PUT", { policy, formIds: [form] })).status, 200);
      const saved = await (await request(configPath)).json(); assert.deepEqual(saved.policy, policy);
      assert.equal((await request(`/provider-finder/config/${otherCompany}/SK`, "PUT", { policy, formIds: [form] })).status, 409);
      assert.equal((await request(profilePath, "PUT", { id: foreignClinic, type: "clinic", publicVisible: true })).status, 404);
    });
    await t.test("public visibility and Persons default private; internal people permissions are enforced", async () => {
      assert.equal((await request(profilePath, "PUT", { id: clinic, type: "clinic", publicVisible: true, services: ["testing"] })).status, 200);
      const rows = await (await request(publicPath + "/search", "POST", search)).json();
      assert.deepEqual(rows.results.map((r: any) => r.id), [clinic]); assert.deepEqual(rows.results[0].people, []);
      assert.ok(!("contracted" in rows.results[0])); assert.ok(!("lastContactAt" in rows.results[0]));
      const internal = await (await request(`/provider-finder/context/${company}/SK/search`, "POST", search, viewer)).json();
      assert.ok(internal.results.length >= 3); assert.ok(internal.results.every((r: any) => r.people.length === 0));
      assert.ok(!internal.results.some((r: any) => [missingClinic, foreignClinic].includes(r.id)));
      assert.equal((await request(`/provider-finder/customers/${customer}`, "PUT", selection, viewer)).status, 403);
    });
    await t.test("explicit public Persons are current workplace assignments, never all Persons", async () => {
      assert.equal((await request(profilePath, "PUT", { id: clinic, type: "clinic", publicVisible: true, publicPersonIds: [person], services: ["testing"] })).status, 200);
      const rows = await (await request(publicPath + "/search", "POST", { ...search, peopleOnly: true })).json();
      assert.deepEqual(rows.results[0].people.map((p: any) => p.id), [person]);
      assert.equal((await request(profilePath, "PUT", { id: hospital, type: "hospital", publicPersonIds: [person] })).status, 400);
      await assert.rejects(() => normalizePublicFinderSelection(slug, { ...selection, personId: privatePerson }));
      assert.equal((await normalizePublicFinderSelection(slug, selection)).personName, "Public Synthetic");
      await assert.rejects(() => normalizePublicFinderSelection(slug, { ...selection, billingCompanyId: otherCompany }));
      await assert.rejects(() => normalizePublicFinderSelection(slug, { ...selection, id: privateClinic, personId: undefined }));
    });
    await t.test("customer selection survives reload, preserves address and refuses foreign country", async () => {
      assert.equal((await request(`/provider-finder/customers/${customer}`, "PUT", selection)).status, 200);
      const result = await (await request(`/provider-finder/customers/${customer}`)).json(); assert.equal(result.id, clinic);
      assert.equal((await pool.query("SELECT address FROM customers WHERE id=$1", [customer])).rows[0].address, "UNCHANGED ADDRESS");
      assert.equal((await request(`/provider-finder/customers/${foreignCustomer}`, "PUT", selection)).status, 403);
      assert.equal((await request(`/provider-finder/customers/${customer}`, "PUT", selection, foreign)).status, 403);
      await pool.query("UPDATE clinics SET is_active=false WHERE id=$1", [clinic]);
      const unavailable = await (await request(`/provider-finder/customers/${customer}`)).json(); assert.equal(unavailable.unavailable, true);
      await assert.rejects(() => normalizePublicFinderSelection(slug, selection));
      assert.equal((await request(`/provider-finder/customers/${customer}`, "DELETE")).status, 200);
      assert.equal(await (await request(`/provider-finder/customers/${customer}`)).json(), null);
      await pool.query("UPDATE clinics SET is_active=true WHERE id=$1", [clinic]);
    });
    await t.test("public channel remains independent of internal channel", async () => {
      await request(configPath, "PUT", { policy: { ...policy, enabled: false }, formIds: [form] });
      assert.equal((await request(publicPath + "/config")).status, 200);
      assert.equal((await request(`/provider-finder/context/${company}/SK/search`, "POST", search)).status, 409);
      await request(configPath, "PUT", { policy, formIds: [form] });
    });
    await t.test("radius and service tampering fail explicitly; mapping is not falsely ready", async () => {
      assert.equal((await request(publicPath + "/search", "POST", { ...search, radiusKm: 201 })).status, 400);
      assert.equal((await request(publicPath + "/search", "POST", { ...search, service: "not-allowed" })).status, 400);
      const config = await (await request(publicPath + "/config")).json();
      if (!config.mapsReady) assert.equal((await request(publicPath + "/geocode", "POST", { address: "Synthetic test address" })).status, 503);
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    await pool.query("DELETE FROM customers WHERE id=ANY($1::varchar[])", [[customer, foreignCustomer]]);
    await pool.query("DELETE FROM web_forms WHERE id=ANY($1::varchar[])", [[form, foreignForm]]);
    await pool.query("DELETE FROM billing_details WHERE id=ANY($1::varchar[])", [[company, otherCompany, foreignCompany]]);
    await pool.query("DELETE FROM contact_assignments WHERE person_id=ANY($1::varchar[])", [[person, privatePerson]]);
    await pool.query("DELETE FROM collaborators WHERE id=ANY($1::varchar[])", [[person, privatePerson]]);
    await pool.query("DELETE FROM clinics WHERE id=ANY($1::varchar[])", [[clinic, privateClinic, missingClinic, foreignClinic]]);
    await pool.query("DELETE FROM hospitals WHERE id=$1", [hospital]);
    await pool.query("DELETE FROM users WHERE id=ANY($1::varchar[])", [[admin, viewer, foreign]]);
    await pool.query("DELETE FROM role_module_permissions WHERE role_id=$1", [role]);
    await pool.query("DELETE FROM roles WHERE id=$1", [role]);
    await pool.end();
  }
});
