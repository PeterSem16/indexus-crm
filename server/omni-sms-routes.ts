import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import { createRequirePersistedAdmin } from "./lib/admin-authorization";
import { OmniSmsError, getOmniSmsAccess, listOmniSms, findOmniSmsMessage,
  getOmniSmsPermissionUsers, saveOmniSmsPermissions } from "./omni-sms-service";
import { getOmniSmsUnread, markOmniSmsRead } from "./omni-sms-service";

export function registerOmniSmsRoutes(app: Express, requireAuth: RequestHandler) {
  const admin = createRequirePersistedAdmin(storage);
  const handler = (run: (req: any) => Promise<unknown>): RequestHandler => async (req, res) => {
    try { res.json(await run(req)); }
    catch (error) {
      res.status(error instanceof OmniSmsError ? error.status : 503)
        .json({ error: error instanceof OmniSmsError ? error.message : "sms_unavailable" });
    }
  };
  app.get("/api/omni-sms/access", requireAuth, handler(req => getOmniSmsAccess(req.session.user.id)));
  app.get("/api/omni-sms/unread", requireAuth, handler(req => getOmniSmsUnread(req.session.user.id)));
  app.post("/api/omni-sms/messages/:id/read", requireAuth, handler(req => markOmniSmsRead(req.session.user.id, req.params.id)));
  app.get("/api/omni-sms/messages", requireAuth, handler(req => listOmniSms(req.session.user.id, req.query)));
  app.get("/api/omni-sms/messages/:id", requireAuth, handler(req => findOmniSmsMessage(req.session.user.id, req.params.id)));
  app.get("/api/omni-sms/permissions", requireAuth, admin, handler(req => getOmniSmsPermissionUsers(req.query.country)));
  app.put("/api/omni-sms/permissions/:userId", requireAuth, admin,
    handler(req => saveOmniSmsPermissions(req.params.userId, req.body?.countryCode, req.body?.providers)));
}
