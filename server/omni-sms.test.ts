import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { pool } from "./db";
import { storage } from "./storage";
import { OMNI_SMS_MIGRATION } from "./lib/omni-sms-migration";
import { mayViewOmniSms, validateOmniSmsGrant } from "./lib/omni-sms-policy";
import { authoritativeOmniSmsReply } from "./lib/omni-sms-reply";
import { registerOmniSmsRoutes } from "./omni-sms-routes";
import { findOmniSmsMessage, listOmniSms, filterOmniSmsFromMixedHistory, getOmniSmsNotificationAudience, OmniSmsError } from "./omni-sms-service";
import { notifyIncomingOmniSms } from "./lib/omni-sms-notifications";
import { notificationService } from "./lib/notification-service";

const key = `omni-sms-test-${randomUUID()}`;
const ids: string[] = [];
let roleId: string | undefined;
let fixtureCampaign: string | undefined;
let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
try {
  await pool.query(OMNI_SMS_MIGRATION);
  const createUser = async (role: string, countries: string[], isActive = true, customRole?: string) => {
    const id = randomUUID();
    await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,assigned_countries,is_active,role_id)
      VALUES($1,$2,$3,$4,'not-a-valid-password-hash',$5,$6,$7,$8)`,
    [id, `${key}-${role}-${ids.length}`, `${id}@sms-test.invalid`, key, role, countries, isActive, customRole || null]);
    ids.push(id);
    return id;
  };
  const admin = await createUser("admin", []);
  const reader = await createUser("user", ["SK"]);
  const multi = await createUser("user", ["SK", "CZ"]);
  const manager = await createUser("manager", ["SK"]);
  const inactive = await createUser("admin", ["SK"], false);
  roleId = randomUUID();
  await pool.query("INSERT INTO roles(id,name,legacy_role) VALUES($1,$2,'admin')", [roleId, key]);
  const customAdmin = await createUser("user", [], true, roleId);
  const fixtureIds: string[] = [];
  for (let i = 0; i < 108; i++) {
    const row = await storage.createCommunicationMessage({
      userId: admin, type: "sms", provider: "smstools", direction: i % 2 ? "outbound" : "inbound",
      countryCode: "SK", content: `${key} message ${i}`, status: "received",
      senderPhone: "+421000000001", recipientPhone: "+421000000002",
    });
    fixtureIds.push(row.id);
  }
  const bulk = await storage.createCommunicationMessage({ userId: admin, type: "sms", countryCode: "SK",
    provider: "bulkgate", direction: "inbound", content: `${key} bulk`, status: "received" });
  const cz = await storage.createCommunicationMessage({ userId: admin, type: "sms", countryCode: "CZ",
    provider: "bulkgate", direction: "inbound", content: `${key} cz`, status: "received" });
  const unknown = await storage.createCommunicationMessage({ userId: admin, type: "sms",
    countryCode: "SK", direction: "inbound", content: `${key} unknown-provider`, status: "received" });
  const unassigned = await storage.createCommunicationMessage({ userId: admin, type: "sms",
    provider: "bulkgate", direction: "inbound", content: `${key} unknown-country`, status: "received" });
  fixtureCampaign = randomUUID();
  await pool.query("INSERT INTO campaigns(id,name,country_codes) VALUES($1,$2,$3)", [fixtureCampaign, `${key} named Mission`, ["SK"]]);
  await storage.updateCommunicationMessage(bulk.id, { campaignId: fixtureCampaign });
  // Recent emails must not consume a single SMS result or pagination slot.
  await pool.query(`INSERT INTO communication_messages(user_id,type,content,status)
    SELECT $1,'email',$2,'sent' FROM generate_series(1,140)`, [admin, key]);
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    // Deliberately stale/forged session roles. Only persisted authority is valid.
    req.session = { user: { id: req.headers["x-actor"], role: "admin" } };
    next();
  });
  registerOmniSmsRoutes(app, (req: any, res, next) => req.session.user.id ? next() : res.sendStatus(401));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server!.once("listening", resolve));
  const port = (server.address() as { port: number }).port;
  const request = async (actor: string | undefined, path: string, method = "GET", body?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/omni-sms${path}`, {
      method, headers: { ...(actor ? { "x-actor": actor } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json().catch(() => null) };
  };
  assert.equal((await request(undefined, "/access")).status, 401);
  assert.equal((await request(inactive, "/access")).status, 403);
  assert.equal((await request(manager, "/access")).data.isAdmin, false);
  assert.equal((await request(customAdmin, "/access")).data.isAdmin, true);
  assert.equal((await request(reader, `/messages?country=SK&q=${key}`)).data.total, 0);
  assert.equal((await request(reader, "/unread")).data.unread, 0);
  assert.equal((await request(reader, `/messages/${fixtureIds[0]}/read`, "POST")).status, 404);
  const mixed = [{ id: fixtureIds[0], type: "sms" }, { id: bulk.id, type: "sms" }, { id: "email-fixture", type: "email" }];
  assert.deepEqual(await filterOmniSmsFromMixedHistory(reader, mixed), [{ id: "email-fixture", type: "email" }]);
  assert.equal((await request(admin, `/messages?country=SK&q=${key}`)).data.total, 110);
  assert.equal((await request(admin, `/messages?country=UNASSIGNED&q=${key}`)).data.messages[0].id, unassigned.id);
  const allCountries = (await request(admin, `/messages?country=ALL&q=${key}&pageSize=100`)).data;
  assert.equal(allCountries.total, 112);
  assert(allCountries.messages.some((m: any) => m.id === unassigned.id));
  assert.equal((await findOmniSmsMessage(admin, bulk.id)).campaignName, `${key} named Mission`);
  assert.equal((await request(reader, `/messages?country=ALL&q=${key}`)).status, 403);
  assert.equal((await request(admin, `/messages?country=ALL&readState=invalid`)).status, 400);
  const unassignedAudience = await getOmniSmsNotificationAudience(unassigned.id);
  assert(unassignedAudience.some(u => u.id === admin));
  assert(unassignedAudience.some(u => u.id === customAdmin));
  for (const denied of [reader, multi, manager, inactive]) assert(!unassignedAudience.some(u => u.id === denied));
  for (const actor of [reader, manager, inactive]) {
    assert.equal((await request(actor, "/permissions?country=SK")).status, 403);
    assert.equal((await request(actor, `/permissions/${reader}`, "PUT", { countryCode: "SK", providers: ["smstools"] })).status, 403);
  }
  const permissionUsers = (await request(customAdmin, "/permissions?country=SK")).data.users;
  assert(permissionUsers.some((u: any) => u.id === reader));
  assert(!permissionUsers.some((u: any) => ids.includes(u.id) && [admin, customAdmin, inactive].includes(u.id)));
  assert.equal((await request(admin, `/permissions/${reader}`, "PUT", { countryCode: "CZ", providers: ["bulkgate"] })).status, 400);
  assert.equal((await request(admin, `/permissions/${multi}`, "PUT", { countryCode: "CZ", providers: ["smstools"] })).status, 400);
  assert.equal((await request(admin, `/permissions/${reader}`, "PUT", { countryCode: "SK", providers: ["unknown"] })).status, 400);
  assert.equal((await request(customAdmin, `/permissions/${reader}`, "PUT", { countryCode: "SK", providers: ["smstools"] })).status, 200);
  const smsToolsAudience = await getOmniSmsNotificationAudience(fixtureIds[0]);
  assert(smsToolsAudience.some(u => u.id === reader), "a grant, not Mission correlation, authorizes an inbox notice");
  assert(!smsToolsAudience.some(u => u.id === inactive));
  assert(!(await getOmniSmsNotificationAudience(bulk.id)).some(u => u.id === reader));
  const capturedNotices: any[] = [];
  await notifyIncomingOmniSms(fixtureIds[0], async (recipients, notice) => { capturedNotices.push({ recipients, notice }); });
  const readerNotice = capturedNotices.find(n => n.recipients.includes(reader)).notice;
  assert.equal(readerNotice.entityId, fixtureIds[0]);
  assert.equal(readerNotice.type, "new_sms");
  assert.match(readerNotice.title, /SMSTOOLS/);
  assert(!JSON.stringify(readerNotice).includes("+421000000001"));
  assert(!JSON.stringify(readerNotice).includes(key), "no SMS content in external notification copies");
  await notificationService.sendNotificationToUsers([reader], readerNotice);
  const persistedNotice = (await pool.query("SELECT entity_id,type FROM notifications WHERE user_id=$1", [reader])).rows;
  assert(persistedNotice.some(n => n.entity_id === fixtureIds[0] && n.type === "new_sms"), "a notice is persisted, not only toasted");
  assert.equal((await request(reader, `/messages?country=SK&q=${key}&readState=unread`)).data.total, 54);
  assert.equal((await request(reader, `/messages?country=SK&q=${key}&readState=read`)).data.total, 0);
  const first = await request(reader, `/messages?country=SK&q=${key}&pageSize=100`);
  assert.equal(first.data.total, 108);
  assert.equal(first.data.messages.length, 100);
  assert(first.data.messages.every((m: any) => m.provider === "smstools" && m.countryCode === "SK"));
  const next = (await request(reader, `/messages?country=SK&q=${key}&pageSize=100&page=1`)).data;
  assert.equal(next.messages.length, 8);
  assert.equal(new Set([...first.data.messages, ...next.messages].map(m => m.id)).size, 108);
  assert.equal((await request(reader, `/messages?country=CZ&q=${key}`)).status, 403);
  assert.equal((await request(reader, `/messages/${cz.id}`)).status, 404);
  assert.equal((await request(reader, `/messages/${bulk.id}`)).status, 404);
  assert.equal((await request(reader, `/messages/${unknown.id}`)).status, 404);
  assert.equal((await request(reader, `/messages/${unassigned.id}`)).status, 404);
  assert.equal((await request(reader, `/messages/${fixtureIds[0]}`)).status, 200);
  const unreadBefore = (await request(reader, "/unread")).data.unread;
  const adminUnreadBefore = (await request(admin, "/unread")).data.unread;
  assert(unreadBefore >= 54, "all unread inbound SMS are counted, not just one page");
  assert.equal((await request(reader, `/messages/${bulk.id}/read`, "POST")).status, 404);
  assert.equal((await request(reader, `/messages/${fixtureIds[0]}/read`, "POST")).status, 200);
  assert.equal((await request(reader, "/unread")).data.unread, unreadBefore - 1);
  assert.equal((await request(admin, "/unread")).data.unread, adminUnreadBefore, "read state is agent-private");
  assert.equal((await request(reader, `/messages/${fixtureIds[0]}/read`, "POST")).status, 200);
  assert.equal((await request(reader, "/unread")).data.unread, unreadBefore - 1, "mark-read is idempotent");
  assert.equal((await request(reader, `/messages/${fixtureIds[0]}`)).data.isRead, true);
  assert.equal((await request(reader, `/messages?country=SK&q=${key}&readState=read`)).data.total, 1);
  assert.equal((await request(reader, `/messages?country=SK&q=${key}&readState=unread`)).data.total, 53);
  assert.equal((await request(admin, `/messages/${fixtureIds[0]}`)).data.isRead, false, "another user's receipt is private");
  await storage.updateCommunicationMessage(fixtureIds[2], { deliveryStatus: "read" });
  assert.equal((await request(reader, `/messages/${fixtureIds[2]}`)).data.isRead, false, "provider receipt is not an inbox read");
  assert.equal((await request(reader, `/messages?country=SK&q=${key}&readState=unread`)).data.total, 53);
  assert.equal((await request(reader, `/messages?country=SK&q=${key}&readState=read&direction=outbound`)).data.total, 0);
  assert.deepEqual(await filterOmniSmsFromMixedHistory(reader, mixed), [mixed[0], mixed[2]]);
  const replySource = await findOmniSmsMessage(reader, fixtureIds[0]);
  const reply = authoritativeOmniSmsReply(replySource)!;
  assert.equal(reply.to, "+421000000001");
  assert.equal(reply.provider, "smstools");
  assert.equal(reply.country, "SK");
  const savedReply = await storage.createCommunicationMessage({
    userId: reader, type: "sms", provider: "smstools", countryCode: "SK", direction: "outbound",
    content: `${key} reply`, status: "sent", replyToSmsId: fixtureIds[0],
  });
  assert.equal((await request(reader, `/messages/${fixtureIds[0]}`)).data.replies[0].id, savedReply.id);
  const forbiddenReply = await storage.createCommunicationMessage({
    userId: admin, type: "sms", provider: "bulkgate", countryCode: "CZ", direction: "outbound",
    content: `${key} forbidden reply`, status: "sent", replyToSmsId: fixtureIds[0],
  });
  assert.equal((await request(reader, `/messages/${fixtureIds[0]}`)).data.replies.length, 1);
  assert((await request(admin, `/messages/${fixtureIds[0]}`)).data.replies.some((r: any) => r.id === forbiddenReply.id));
  assert.equal(authoritativeOmniSmsReply({ ...replySource, provider: null }), null);
  assert.equal(authoritativeOmniSmsReply({ ...replySource, countryCode: null }), null);
  assert.equal(authoritativeOmniSmsReply({ ...replySource, countryCode: "CZ" }), null);
  assert.equal(authoritativeOmniSmsReply({ ...replySource, direction: "outbound" })!.to, "+421000000002");
  assert.equal((await request(reader, `/messages?country=SK&provider=bulkgate&q=${key}`)).data.total, 0);
  assert.equal((await request(reader, `/messages?country=SK&direction=inbound&q=${key}`)).data.total, 54);
  assert.equal((await request(reader, `/messages?country=SK&pageSize=101`)).status, 400);
  assert.equal((await request(reader, `/messages?country=SK&q=${encodeURIComponent("' OR true --")}`)).data.total, 0);
  assert.equal((await request(admin, `/permissions/${multi}`, "PUT", { countryCode: "SK", providers: ["bulkgate"] })).status, 200);
  assert.equal((await request(admin, `/permissions/${multi}`, "PUT", { countryCode: "CZ", providers: ["bulkgate"] })).status, 200);
  assert.equal((await request(multi, `/messages?country=CZ&q=${key}`)).data.total, 2);
  await request(admin, `/permissions/${reader}`, "PUT", { countryCode: "SK", providers: ["bulkgate"] });
  assert.equal((await request(reader, `/messages?country=SK&q=${key}`)).data.total, 1);
  assert.equal((await request(reader, `/messages/${fixtureIds[0]}`)).status, 404);
  await request(admin, `/permissions/${reader}`, "PUT", { countryCode: "SK", providers: [] });
  assert.equal((await request(reader, `/messages?country=SK&q=${key}`)).data.total, 0);
  await assert.rejects(findOmniSmsMessage(reader, bulk.id), e => e instanceof OmniSmsError && e.status === 404);
  // Legacy caller route uses the same filtered query even when country is omitted.
  assert.equal((await listOmniSms(reader, { q: key, pageSize: 100 }, true)).total, 0);
  await pool.query("UPDATE users SET role='user' WHERE id=$1", [admin]);
  assert.equal((await request(admin, "/permissions?country=SK")).status, 403);
  assert.equal((await request(admin, `/messages?country=SK&q=${key}`)).status, 403);
  assert.throws(() => validateOmniSmsGrant("SK", ["smstools", "smstools"], ["SK"]));
  assert(!mayViewOmniSms({ isAdmin: false, countries: ["SK"], grants: [] }, "SK", "bulkgate"));
  assert(!mayViewOmniSms({ isAdmin: false, countries: ["SK"], grants: [{ countryCode: "SK", provider: "bulkgate" }] }, null, "bulkgate"));
  console.log("Omni SMS PostgreSQL + HTTP: default deny, admin/custom-admin, country/gateway scope, full pagination, unknown provenance, stale authority, replacement/revocation PASSED");
} finally {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  await pool.query("DELETE FROM communication_messages WHERE user_id=ANY($1::varchar[])", [ids]);
  if (fixtureCampaign) await pool.query("DELETE FROM campaigns WHERE id=$1", [fixtureCampaign]);
  await pool.query("DELETE FROM notifications WHERE user_id=ANY($1::varchar[])", [ids]);
  await pool.query("DELETE FROM users WHERE id=ANY($1::varchar[])", [ids]);
  if (roleId) await pool.query("DELETE FROM roles WHERE id=$1", [roleId]);
  await pool.end();
}
