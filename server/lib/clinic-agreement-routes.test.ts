import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { pool } from "../db";
import { DATA_ROOT } from "../config/storage-paths";
import { registerClinicAgreementRoutes } from "./clinic-agreement-routes";
import { CLINIC_AGREEMENTS_MIGRATION, AGREEMENT_MAX_BYTES } from "./clinic-agreement-contract";

test("real clinic agreement APIs preserve clinic workflows and enforce private document access", async t => {
  await pool.query(CLINIC_AGREEMENTS_MIGRATION);
  const ids = { admin: randomUUID(), manager: randomUUID(), agent: randomUUID(), other: randomUUID(), clinic: randomUUID(), second: randomUUID(), campaign: randomUUID(), role: randomUUID(), custom: randomUUID() };
  const files: string[] = [];
  const app = express();
  app.use(express.json());
  // Isolated test server only: no production application authentication is bypassed.
  app.use((req, _res, next) => {
    const id = req.get("x-fixture-user");
    (req as any).session = id ? { user: { id } } : {};
    next();
  });
  registerClinicAgreementRoutes(app, (req: any, res: any, next: any) => req.session.user ? next() : res.status(401).end());
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/clinics`;
  const request = (url: string, user = ids.admin, init: RequestInit = {}) => fetch(base + url, { ...init, headers: { "x-fixture-user": user, ...init.headers } });
  const patch = (id: string, value: object, user = ids.admin, campaignId?: string) => request(`/${ids.clinic}/agreements/${id}${campaignId ? `?campaignId=${campaignId}` : ""}`, user, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value),
  });
  const upload = async (user = ids.admin, fields: Record<string, string> = {}, bytes = Buffer.from("%PDF-1.4\nfixture-only\n"), type = "application/pdf", campaignId?: string) => {
    const body = new FormData();
    body.set("file", new Blob([new Uint8Array(bytes)], { type }), "fixture.pdf");
    body.set("title", "Clinic agreement");
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
    return request(`/${ids.clinic}/agreements${campaignId ? `?campaignId=${campaignId}` : ""}`, user, { method: "POST", body });
  };
  try {
    await pool.query("INSERT INTO roles(id,name) VALUES($1,$2)", [ids.role, "Agreement fixture " + ids.role]);
    for (const [id, role, countries, roleId] of [
      [ids.admin, "admin", [], null], [ids.manager, "manager", ["SK"], null],
      [ids.agent, "user", ["SK"], null], [ids.other, "manager", ["CZ"], null],
      [ids.custom, "user", ["SK"], ids.role],
    ]) await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,assigned_countries,role_id)
      VALUES($1::varchar,$1::text,$2,'Agreement fixture','not-a-login-password',$3,$4,$5)`, [id, `${id}@fixture.invalid`, role, countries, roleId]);
    await pool.query("INSERT INTO clinics(id,name,country_code) VALUES($1,'Agreement fixture','SK'),($2,'Second fixture','SK')", [ids.clinic, ids.second]);
    await pool.query("INSERT INTO campaigns(id,name) VALUES($1,'Agreement fixture')", [ids.campaign]);
    await pool.query("INSERT INTO campaign_agents(campaign_id,user_id) VALUES($1,$2)", [ids.campaign, ids.agent]);
    await pool.query("INSERT INTO campaign_contacts(campaign_id,clinic_id,contact_type) VALUES($1,$2,'clinic')", [ids.campaign, ids.clinic]);
    const before = (await pool.query("SELECT * FROM clinics WHERE id=$1", [ids.clinic])).rows[0];
    let first: any;
    await t.test("unauthenticated and cross-country access rejected", async () => {
      assert.equal((await fetch(base + `/${ids.clinic}/agreements`)).status, 401);
      assert.equal((await request(`/${ids.clinic}/agreements`, ids.other)).status, 403);
      assert.equal((await upload(ids.other)).status, 403);
    });
    await t.test("create multiple agreements and round-trip protected files", async () => {
      const response = await upload(ids.admin, { validFrom: "2026-10-04", validTo: "2027-10-04", contractNumber: "A-1" });
      assert.equal(response.status, 201);
      first = await response.json();
      assert.equal(first.validFrom, "2026-10-04");
      assert.equal(first.active, true);
      assert.equal(first.storageKey, undefined);
      assert.equal((await upload()).status, 201);
      const listing = await (await request(`/${ids.clinic}/agreements`)).json();
      assert.equal(listing.agreements.length, 2);
      const downloaded = await request(`/${ids.clinic}/agreements/${first.id}/download`);
      assert.equal(downloaded.status, 200);
      assert.match(downloaded.headers.get("content-disposition")!, /^attachment;/);
      assert.equal(downloaded.headers.get("x-content-type-options"), "nosniff");
      assert.equal(await downloaded.text(), "%PDF-1.4\nfixture-only\n");
    });
    await t.test("Pulse-assigned agent can read/download but cannot manage", async () => {
      const listing = await (await request(`/${ids.clinic}/agreements`, ids.agent)).json();
      assert.equal(listing.canManage, false);
      assert.equal(listing.agreements.length, 2);
      assert.equal((await request(`/${ids.clinic}/agreements/${first.id}/download`, ids.agent)).status, 200);
      assert.equal((await patch(first.id, { active: false }, ids.agent)).status, 403);
      assert.equal((await upload(ids.agent)).status, 403);
      assert.equal((await request(`/${ids.second}/agreements`, ids.agent)).status, 403);
    });
    await t.test("read-only Mission agreement exception grants only the exact assigned clinic/Mission", async () => {
      const settings = { readOnlyContactCards: true, readOnlyExceptions: { agreements: true } };
      await pool.query("UPDATE campaigns SET settings=$2 WHERE id=$1", [ids.campaign, JSON.stringify(settings)]);
      const listing = await (await request(`/${ids.clinic}/agreements?campaignId=${ids.campaign}`, ids.agent)).json();
      assert.equal(listing.canManage, true);
      assert.equal((await patch(first.id, { title: "Agent agreement" }, ids.agent, ids.campaign)).status, 200);
      assert.equal((await upload(ids.agent, {}, undefined, undefined, ids.campaign)).status, 201);
      assert.equal((await patch(first.id, { title: "No context" }, ids.agent)).status, 403);
      assert.equal((await patch(first.id, { title: "Wrong context" }, ids.agent, randomUUID())).status, 403);
      assert.equal((await patch(first.id, { title: "Unassigned user" }, ids.custom, ids.campaign)).status, 403);
      assert.equal((await request(`/${ids.second}/agreements?campaignId=${ids.campaign}`, ids.agent)).status, 403);
      assert.equal((await upload(ids.other, {}, undefined, undefined, ids.campaign)).status, 403);
      assert.equal((await request(`/${ids.clinic}/agreements?campaignId[]=bad`, ids.agent)).status, 400);
      for (const value of [
        { ...settings, readOnlyExceptions: { agreements: false } },
        { ...settings, readOnlyContactCards: false },
        { ...settings, readOnlyExceptions: { agreements: "true" } },
        {},
        "{",
        "null",
      ]) {
        await pool.query("UPDATE campaigns SET settings=$2 WHERE id=$1", [ids.campaign, typeof value === "string" ? value : JSON.stringify(value)]);
        assert.equal((await patch(first.id, { title: "Denied" }, ids.agent, ids.campaign)).status, 403);
        assert.equal((await upload(ids.agent, {}, undefined, undefined, ids.campaign)).status, 403);
      }
      await pool.query("UPDATE campaigns SET settings=$2 WHERE id=$1", [ids.campaign, JSON.stringify(settings)]);
      await pool.query("DELETE FROM campaign_agents WHERE campaign_id=$1 AND user_id=$2", [ids.campaign, ids.agent]);
      assert.equal((await patch(first.id, { title: "Assignment revoked" }, ids.agent, ids.campaign)).status, 403);
      await pool.query("INSERT INTO campaign_agents(campaign_id,user_id) VALUES($1,$2)", [ids.campaign, ids.agent]);
      await pool.query("UPDATE campaigns SET settings=NULL WHERE id=$1", [ids.campaign]);
    });
    await t.test("custom roles require explicit visible hospitals permissions and edit grant", async () => {
      assert.equal((await upload(ids.custom)).status, 403);
      await pool.query("INSERT INTO role_module_permissions(role_id,module_key,access,can_edit) VALUES($1,'hospitals','visible',false)", [ids.role]);
      assert.equal((await request(`/${ids.clinic}/agreements`, ids.custom)).status, 200);
      assert.equal((await upload(ids.custom)).status, 403);
      await pool.query("UPDATE role_module_permissions SET can_edit=true WHERE role_id=$1", [ids.role]);
      assert.equal((await patch(first.id, { title: "Updated" }, ids.custom)).status, 200);
    });
    await t.test("ending/repeating/reactivating validity uses server-owned timestamps", async () => {
      const ended = await (await patch(first.id, { active: false })).json();
      assert.equal(ended.active, false); assert.ok(ended.endedAt);
      const repeat = await (await patch(first.id, { active: false })).json();
      assert.equal(repeat.endedAt, ended.endedAt);
      const active = await (await patch(first.id, { active: true })).json();
      assert.equal(active.active, true); assert.equal(active.endedAt, null);
      assert.equal((await patch(first.id, { endedAt: "1900-01-01" })).status, 400);
    });
    await t.test("date validation considers persisted interval and allows explicit clearing", async () => {
      assert.equal((await patch(first.id, { validTo: "2026-01-01" })).status, 400);
      assert.equal((await patch(first.id, { validFrom: "2026-02-30" })).status, 400);
      const clear = await (await patch(first.id, { validTo: null, contractNumber: null })).json();
      assert.equal(clear.validTo, null); assert.equal(clear.contractNumber, null);
    });
    await t.test("cross-clinic IDOR and unsupported file bodies rejected", async () => {
      assert.equal((await request(`/${ids.second}/agreements/${first.id}/download`)).status, 404);
      assert.equal((await request(`/${ids.second}/agreements/${first.id}`, ids.admin, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: '{"active":false}',
      })).status, 404);
      assert.equal((await upload(ids.admin, {}, Buffer.from("<html>not a PDF</html>"))).status, 400);
      assert.equal((await upload(ids.admin, { validFrom: "2026-02-30" })).status, 400);
      assert.equal((await upload(ids.admin, {}, Buffer.alloc(AGREEMENT_MAX_BYTES + 1)) ).status, 400);
    });
    await t.test("session does not retain access after country or account revocation", async () => {
      await pool.query("UPDATE users SET assigned_countries=ARRAY['CZ']::text[] WHERE id=$1", [ids.agent]);
      assert.equal((await request(`/${ids.clinic}/agreements`, ids.agent)).status, 403);
      await pool.query("UPDATE users SET is_active=false WHERE id=$1", [ids.manager]);
      assert.equal((await upload(ids.manager)).status, 403);
    });
    await t.test("clinic legacy fields, statuses and existing workflows remain unchanged", async () => {
      const after = (await pool.query("SELECT * FROM clinics WHERE id=$1", [ids.clinic])).rows[0];
      assert.deepEqual(after, before);
      assert.equal((await pool.query("SELECT count(*)::int n FROM clinic_events WHERE clinic_id=$1", [ids.clinic])).rows[0].n, 0);
    });
  } finally {
    const stored = await pool.query("SELECT storage_key FROM clinic_agreements WHERE clinic_id=ANY($1)", [[ids.clinic, ids.second]]);
    files.push(...stored.rows.map(row => path.join(path.dirname(DATA_ROOT), "private-clinic-agreements", row.storage_key)));
    await pool.query("DELETE FROM clinics WHERE id=ANY($1)", [[ids.clinic, ids.second]]);
    await pool.query("DELETE FROM campaign_contacts WHERE campaign_id=$1", [ids.campaign]);
    await pool.query("DELETE FROM campaign_agents WHERE campaign_id=$1", [ids.campaign]);
    await pool.query("DELETE FROM campaigns WHERE id=$1", [ids.campaign]);
    await pool.query("DELETE FROM role_module_permissions WHERE role_id=$1", [ids.role]);
    await pool.query("DELETE FROM users WHERE id=ANY($1)", [[ids.admin, ids.manager, ids.agent, ids.other, ids.custom]]);
    await pool.query("DELETE FROM roles WHERE id=$1", [ids.role]);
    for (const file of files) await fs.unlink(file).catch(() => {});
    await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.end();
  }
});