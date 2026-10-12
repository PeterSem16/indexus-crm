import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { pool } from "../db";
import { createBulkGateCallback } from "./bulkgate-callback";
import { storeInboundSmsOnce } from "./inbound-sms";
import { notifyIncomingOmniSms } from "./omni-sms-notifications";
import { notificationService } from "./notification-service";
import { listOmniSms } from "../omni-sms-service";
import { OMNI_SMS_MIGRATION } from "./omni-sms-migration";

const key = `bulk-callback-${randomUUID()}`;
const admin = randomUUID();
let server: Server | undefined;
const receipts: string[] = [];
try {
  await pool.query(OMNI_SMS_MIGRATION);
  await pool.query(`INSERT INTO users(id,username,full_name,email,password_hash,role,assigned_countries,is_active)
    VALUES($1,$2,$2,$3,'invalid-test-hash','admin','{}',true)`, [admin, key, `${admin}@sms-test.invalid`]);
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.all("/callback", createBulkGateCallback({
    verifyToken: token => token === "fixture-only-token",
    processRecord: async record => {
      if (record.type === "delivery_report") { receipts.push(record.smsId!); return; }
      if (record.text === `${key}:fail`) throw new Error("simulated persistence failure");
      const message = await storeInboundSmsOnce("bulkgate", {
        userId: admin, type: "sms", content: record.text!, senderPhone: record.number,
        recipientPhone: record.recipientPhone, externalId: record.smsId, status: "received",
      });
      if (!message) return;
      await notifyIncomingOmniSms(message.id, async (ids, notice) => {
        // Real persistence for our fixture only; never notify actual development users.
        if (ids.includes(admin)) await notificationService.sendNotificationToUsers([admin], notice);
      });
    },
  }));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server!.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/callback`;
  const post = (data: unknown, token = "fixture-only-token") => fetch(`${base}?token=${token}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  const batch = [
    { status: "1", smsID: `${key}:dlr` },
    { status: "10", smsID: `${key}:first`, from: "421000000001", to: "421000000002", message: `${key}:first` },
    { status: "10", sms_id: `${key}:second`, from: "421000000003", message: `${key}:second` },
  ];
  assert.equal((await post(batch, "wrong")).status, 403);
  assert.equal((await listOmniSms(admin, { country: "ALL", q: key })).total, 0);
  assert.equal((await post([batch[1], { status: "10" }])).status, 400);
  assert.equal((await listOmniSms(admin, { country: "ALL", q: key })).total, 0);
  const result = await post(batch);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).processed, 3);
  const page = await listOmniSms(admin, { country: "ALL", q: key });
  assert.equal(page.total, 2);
  assert(page.messages.every(m => m.provider === "bulkgate" && m.direction === "inbound" && m.content?.includes(key)));
  assert.equal(page.messages.find(m => m.content === `${key}:first`)?.recipientPhone, "421000000002");
  assert.deepEqual(receipts, [`${key}:dlr`]);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND type='new_sms'", [admin])).rows[0].n, 2);
  assert.equal((await post(batch)).status, 200);
  assert.equal((await listOmniSms(admin, { country: "ALL", q: key })).total, 2);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND type='new_sms'", [admin])).rows[0].n, 2);
  assert.equal((await post({ status: "10", from: "421000000001", message: `${key}:fail` })).status, 503);
  const query = new URLSearchParams({ token: "fixture-only-token", status: "10", from: "421000000001", message: `${key}:get`, smsID: `${key}:get` });
  assert.equal((await fetch(`${base}?${query}`)).status, 200);
  assert.equal((await listOmniSms(admin, { country: "ALL", q: key })).total, 3);
  console.log("BulkGate actual HTTP -> PostgreSQL SMS inbox + persisted notifications: mixed batch, GET, token, validation, deduplication and retry status PASSED");
} finally {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  await pool.query("DELETE FROM notifications WHERE user_id=$1", [admin]);
  await pool.query("DELETE FROM communication_messages WHERE user_id=$1", [admin]);
  await pool.query("DELETE FROM users WHERE id=$1", [admin]);
  await pool.end();
}
