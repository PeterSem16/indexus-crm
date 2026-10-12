import assert from "node:assert/strict";
import express from "express";
import { storage } from "./storage";
import { pool } from "./db";
import { systemMailboxChecks } from "./lib/system-mailbox-check-runtime";
import { registerSystemMailboxCheckRoutes } from "./system-mailbox-check-routes";

async function main() {
  const original = { user: storage.getUser, role: storage.getRole,
    permissions: storage.getRoleModulePermissions, start: systemMailboxChecks.start, status: systemMailboxChecks.status };
  const starts: string[] = [];
  const result = { phase: "checking", auth: "pending", send: "pending", receive: "pending",
    startedAt: null, finishedAt: null, errorCode: null, providerCode: null, senderAligned: true } as const;
  storage.getUser = async (id: string) => ({
    id, isActive: id !== "inactive", role: id === "admin" ? "admin" : id === "manager" ? "manager" : "user",
    assignedCountries: ["SK"], roleId: id === "custom" ? "custom-role" : null,
  }) as any;
  storage.getRole = async () => ({ name: "Custom" }) as any;
  storage.getRoleModulePermissions = async () => [{ moduleKey: "configurator", access: "visible", canEdit: true }] as any;
  systemMailboxChecks.start = async country => { starts.push(country); return result; };
  systemMailboxChecks.status = async () => result;
  const app = express();
  app.use(express.json());
  registerSystemMailboxCheckRoutes(app, (req, res, next) => {
    const id = req.header("x-test-user");
    if (!id) return void res.status(401).json({ error: "unauthorized" });
    (req as any).session = { user: { id } }; next();
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const port = (server.address() as any).port;
    const request = async (country: string, user?: string, method = "GET") => fetch(
      `http://127.0.0.1:${port}/api/config/system-ms365-connections/${country}/check`, {
        method, headers: { ...(user ? { "x-test-user": user } : {}), "Content-Type": "application/json" },
        ...(method === "POST" ? { body: JSON.stringify({ to: "must-never-be-used@example.invalid" }) } : {}),
      });
    assert.equal((await request("SK")).status, 401);
    assert.equal((await request("SK", "user", "POST")).status, 403);
    assert.equal((await request("SK", "inactive", "POST")).status, 403);
    assert.equal((await request("HU", "manager", "POST")).status, 403);
    assert.equal((await request("INVALID", "admin", "POST")).status, 400);
    assert.equal((await request("SK", "admin")).status, 200);
    assert.equal((await request("SK", "manager", "POST")).status, 202);
    assert.equal((await request("SK", "custom", "POST")).status, 202);
    assert.deepEqual(starts, ["SK", "SK"]);
    console.log("Mailbox check HTTP routes: auth, active account, role/country scope, fixed country-only invocation PASSED");
  } finally {
    storage.getUser = original.user; storage.getRole = original.role;
    storage.getRoleModulePermissions = original.permissions;
    systemMailboxChecks.start = original.start; systemMailboxChecks.status = original.status;
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    await pool.end();
  }
}
void main().catch(e => { console.error(e); process.exitCode = 1; });
