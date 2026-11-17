import type { Express, Request, RequestHandler } from "express";
import { storage } from "../storage";
import { pool } from "../db";
import { availableOmniEmails } from "./omni-mailbox-group-routes";
import { decryptTokenSafe } from "./token-crypto";
import { createGraphClient, getValidAccessToken } from "./ms365";
import { createEmailNoteService } from "./email-note-jobs-service";
import { registerEmailNoteRoutes } from "./email-note-jobs-routes";
import { EmailNoteError } from "./email-note-jobs-client";

async function authorize(req: Request, readText: boolean) {
  const userId = (req.session as any)?.user?.id;
  if (!userId || req.params.userId !== userId) throw new EmailNoteError("forbidden", 403);
  const input = req.query.mailbox;
  if (input !== undefined && typeof input !== "string")
    throw new EmailNoteError("invalid_mailbox", 400);
  const connection = await storage.getUserMs365Connection(userId);
  if (!connection?.isConnected) throw new EmailNoteError("mailbox_not_connected", 403);
  const mailbox = String(!input || input === "personal" ? connection.email : input).trim().toLowerCase();
  if (!(await availableOmniEmails(storage, userId)).has(mailbox))
    throw new EmailNoteError("forbidden", 403);
  const messageId = String(req.params.emailId);
  if (!messageId || messageId.length > 4096) throw new EmailNoteError("invalid_email", 400);
  // Authorize the exact live Graph resource on every read/write. A copied local
  // message ID or a stale mailbox grant must never grant access to private notes.
  const token = await getValidAccessToken(decryptTokenSafe(connection.accessToken),
    connection.tokenExpiresAt, connection.refreshToken ? decryptTokenSafe(connection.refreshToken) : null);
  if (!token?.accessToken) throw new EmailNoteError("mailbox_not_connected", 403);
  const personal = mailbox === connection.email.trim().toLowerCase();
  const base = personal ? "/me" : `/users/${encodeURIComponent(mailbox)}`;
  let email: any;
  try {
    email = await createGraphClient(token.accessToken)
      .api(`${base}/messages/${encodeURIComponent(messageId)}`)
      .header("Prefer", 'outlook.body-content-type="text"')
      .select(readText ? "id,subject,body" : "id").get();
  } catch (error: any) {
    throw new EmailNoteError(error?.statusCode === 404 ? "email_not_found" :
      error?.statusCode === 403 ? "forbidden" : "mailbox_unavailable",
    error?.statusCode === 404 ? 404 : error?.statusCode === 403 ? 403 : 503);
  }
  if (!email || email.id !== messageId) throw new EmailNoteError("email_not_found", 404);
  let text: string | undefined;
  if (readText) {
    if (String(email.body?.contentType).toLowerCase() !== "text" || typeof email.body?.content !== "string")
      throw new EmailNoteError("invalid_email_text", 400);
    text = [email.subject, email.body.content].filter(Boolean).join("\n\n");
  }
  return { scope: { userId, mailbox, messageId }, text };
}

export function startEmailNoteJobs(app: Express, auth: RequestHandler) {
  const service = createEmailNoteService(pool);
  registerEmailNoteRoutes(app, auth, { service, authorize });
  // No scheduling or Gateway contact in the default disabled state. A restart
  // after explicit activation starts polling persisted jobs, not duplicate POSTs.
  if (service.enabled()) {
    const timer = setInterval(() => {
      void service.tick().catch(() => console.error("[email-notes] Background processing failed"));
    }, 5000);
    timer.unref();
  }
}
