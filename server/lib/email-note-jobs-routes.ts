import type { Express, Request, RequestHandler } from "express";
import type {} from "express-session";
import { EmailNoteError } from "./email-note-jobs-client";
import type { createEmailNoteService, NoteScope } from "./email-note-jobs-service";

export function registerEmailNoteRoutes(app: Express, auth: RequestHandler, deps: {
  service: ReturnType<typeof createEmailNoteService>;
  authorize: (req: Request, readText: boolean) => Promise<{ scope: NoteScope; text?: string }>;
}) {
  const path = "/api/users/:userId/ms365-email/:emailId/ai-note";
  const handler = (action: "get" | "submit" | "approve"): RequestHandler => async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      // Identity checked even when disabled. Do not expose another user's state.
      if (req.params.userId !== (req.session as any)?.user?.id)
        throw new EmailNoteError("forbidden", 403);
      if (!deps.service.enabled()) {
        if (action === "get") { res.json({ enabled: false, record: null }); return; }
        throw new EmailNoteError("feature_disabled", 503);
      }
      const { scope, text } = await deps.authorize(req, action === "submit");
      const record = action === "get" ? await deps.service.get(scope) :
        action === "submit" ? await deps.service.submit(scope, text!) :
          await deps.service.approve(scope, req.body?.note, req.body?.version);
      res.status(action === "submit" ? 202 : 200).json({ enabled: true, record });
    } catch (error) {
      const known = error instanceof EmailNoteError;
      res.status(known ? error.status : 500).json({ error: known ? error.code : "email_note_failed" });
    }
  };
  app.get(path, auth, handler("get"));
  app.post(path, auth, handler("submit"));
  app.patch(path, auth, handler("approve"));
}
