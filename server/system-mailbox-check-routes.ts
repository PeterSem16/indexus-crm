import type { Express, Request, RequestHandler } from "express";
import { COUNTRIES } from "@shared/schema";
import { storage } from "./storage";
import { MailboxCheckError } from "./lib/system-mailbox-check";
import { systemMailboxChecks } from "./lib/system-mailbox-check-runtime";

export async function canManageSystemMailbox(userId: string, country: string): Promise<boolean> {
  const user = await storage.getUser(userId);
  if (!user?.isActive) return false;
  const role = user.roleId ? await storage.getRole(user.roleId) : undefined;
  const admin = user.role === "admin" || role?.name === "Admin";
  const manager = user.role === "manager" || role?.name === "Manager";
  if (admin) return true;
  const permission = user.roleId
    ? (await storage.getRoleModulePermissions(user.roleId)).find(p => p.moduleKey === "configurator")
    : undefined;
  return !!(manager || (permission?.access === "visible" && permission.canEdit)) &&
    Array.isArray(user.assignedCountries) && user.assignedCountries.includes(country);
}

export function startSystemMailboxCheckAfterReconnect(country: string, userId: string): void {
  void (async () => {
    if (await canManageSystemMailbox(userId, country)) await systemMailboxChecks.start(country);
  })().catch(() => {
    // Connection remains usable if the diagnostic cannot start. Its manual action
    // stays available; never log OAuth/provider exceptions.
  });
}

export function registerSystemMailboxCheckRoutes(app: Express, requireAuth: RequestHandler) {
  const authorize: RequestHandler = async (req, res, next) => {
    try {
      const country = String(req.params.countryCode);
      if (!COUNTRIES.some(c => c.code === country))
        return void res.status(400).json({ error: "invalid_country" });
      const user = (req as Request & { session?: { user?: { id: string } } }).session?.user;
      if (!user || !await canManageSystemMailbox(user.id, country))
        return void res.status(403).json({ error: "permission_denied" });
      next();
    } catch { res.status(503).json({ error: "check_unavailable" }); }
  };
  const path = "/api/config/system-ms365-connections/:countryCode/check";
  app.get(path, requireAuth, authorize, async (req, res) => {
    try { res.json(await systemMailboxChecks.status(String(req.params.countryCode))); }
    catch { res.status(503).json({ error: "check_unavailable" }); }
  });
  app.post(path, requireAuth, authorize, async (req, res) => {
    try { res.status(202).json(await systemMailboxChecks.start(String(req.params.countryCode))); }
    catch (e) {
      res.status(e instanceof MailboxCheckError ? e.status : 503)
        .json({ error: e instanceof MailboxCheckError ? e.code : "check_unavailable" });
    }
  });
}
