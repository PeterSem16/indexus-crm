import { canAccessTaskByPolicy } from "../task-contract";
import { assertPulseTaskChecklistComplete } from "../task-completion";
import { supportedTaskResolutionDraftLanguage } from "../task-resolution-draft";
import { taskChecklistFingerprint } from "../task-ai-checklist";
import { fingerprint, type JobSQL, type JobRow } from "./store";
import { JobError } from "./policy";
import type { AIJobService } from "../../../shared/ai-jobs";
import { resolveJobMailbox } from "./mailbox";

export async function taskContext(sql: JobSQL, taskId: string, userId?: string, lock = false) {
  const task = (await sql.query(`SELECT id,title,description,status,country,tags,
    related_entity_type AS "relatedEntityType",created_by_user_id AS "createdByUserId",
    assigned_user_id AS "assignedUserId",request_recipients AS "requestRecipients"
    FROM tasks WHERE id=$1${lock ? " FOR UPDATE" : ""}`, [taskId])).rows[0];
  if (!task) throw new JobError("task_not_found", 404);
  const ownerId = userId ?? task.createdByUserId ?? task.assignedUserId;
  if (!ownerId) throw new JobError("task_principal_unavailable", 403);
  const user = (await sql.query(`SELECT id,role,is_active AS "isActive",assigned_countries AS "assignedCountries"
    FROM users WHERE id=$1`, [ownerId])).rows[0];
  if (!user?.isActive) throw new JobError("forbidden", 403);
  const groups = (await sql.query("SELECT group_id FROM task_group_members WHERE user_id=$1", [ownerId])).rows;
  if (!canAccessTaskByPolicy(user, task, new Set(groups.map(r => r.group_id))))
    throw new JobError("forbidden", 403);
  return { task, ownerId };
}
export async function taskPayload(sql: JobSQL, service: AIJobService, taskId: string, userId?: string, locale?: string, lock = false) {
  const { task, ownerId } = await taskContext(sql, taskId, userId, lock);
  if (!["pending", "in_progress"].includes(task.status)) throw new JobError("task_inactive");
  if (service === "task.checklist") return {
    ownerId, task, payload: { task: {
      title: task.title, description: task.description, country: task.country,
      relatedEntityType: task.relatedEntityType, tags: task.tags,
    } }, hash: taskChecklistFingerprint(task),
  };
  if (locale !== undefined && !supportedTaskResolutionDraftLanguage(locale)) throw new JobError("invalid_locale", 400);
  const items = (await sql.query(`SELECT label,note,done_at AS "doneAt" FROM task_checklist_items
    WHERE task_id=$1 ORDER BY position,id`, [taskId])).rows;
  try { assertPulseTaskChecklistComplete(task, items); }
  catch { throw new JobError("task_checklist_incomplete"); }
  const input = {
    title: task.title, country: task.country ?? null, request: task.description ?? null,
    completedItems: items.filter(item => !!item.doneAt), readyForClosure: items.length > 0 && items.every(item => !!item.doneAt),
    userLocale: locale ?? null,
  };
  if (!input.completedItems.length) throw new JobError("no_completed_items");
  return { ownerId, task, payload: { input }, hash: fingerprint(input) };
}

export async function emailPayload(userId: string, messageId: string, requestedMailbox: unknown, language: unknown) {
  if (typeof messageId !== "string" || !messageId || messageId.length > 4096 ||
    (requestedMailbox !== undefined && typeof requestedMailbox !== "string") ||
    typeof language !== "string" || !["sk", "cs", "en", "de", "it", "hu", "ro", "auto", "pl", "fr", "es"].includes(language))
    throw new JobError("invalid_email_request", 400);
  const { storage } = await import("../../storage");
  const { decryptTokenSafe, encryptTokenWithMarker } = await import("../token-crypto");
  const { getValidAccessToken, createGraphClient } = await import("../ms365");
  const { connection, mailbox, mailboxRef, systemCountry, base } = await resolveJobMailbox(userId, requestedMailbox);
  const token = await getValidAccessToken(decryptTokenSafe(connection.accessToken), connection.tokenExpiresAt,
    connection.refreshToken ? decryptTokenSafe(connection.refreshToken) : null);
  if (!token?.accessToken) throw new JobError("mailbox_not_connected", 403);
  if (token.refreshed) {
    const update = { accessToken: encryptTokenWithMarker(token.accessToken), tokenExpiresAt: token.expiresOn,
      ...(token.refreshToken ? { refreshToken: encryptTokenWithMarker(token.refreshToken) } : {}) };
    if (systemCountry) await storage.updateSystemMs365Connection(systemCountry, update);
    else await storage.updateUserMs365Connection(userId, update);
  }
  let email: any;
  try {
    email = await createGraphClient(token.accessToken).api(`${base}/messages/${encodeURIComponent(messageId)}`)
      .select("id,subject,body,bodyPreview,from").get();
  } catch (error: any) {
    throw new JobError(error?.statusCode === 404 ? "email_not_found" : error?.statusCode === 403 ? "forbidden" : "mailbox_unavailable",
      error?.statusCode === 404 ? 404 : error?.statusCode === 403 ? 403 : 503);
  }
  if (email?.id !== messageId) throw new JobError("email_not_found", 404);
  const input = {
    emailSubject: email.subject || "", emailBody: email.body?.content || email.bodyPreview || "",
    emailFrom: email.from?.emailAddress?.name || email.from?.emailAddress?.address || "", language,
  };
  // Persist only the original bounded model input, not unrelated headers, recipients or tokens.
  input.emailBody = input.emailBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().substring(0, 5000);
  const payload = { input, mailbox, mailboxRef };
  return { payload, hash: fingerprint(payload), ownerId: userId };
}
export async function validateJobSource(sql: JobSQL, job: JobRow, userId = job.owner_user_id, loadEmail = emailPayload) {
  if (job.service !== "task.checklist" && userId !== job.owner_user_id) throw new JobError("forbidden", 403);
  const source = job.service === "email.summary"
    ? await loadEmail(userId, job.entity_id, job.payload.mailboxRef ?? job.payload.mailbox, job.payload.input.language)
    : await taskPayload(sql, job.service, job.entity_id, userId, job.payload.input?.userLocale ?? undefined);
  if (source.hash !== job.input_fingerprint) throw new JobError("source_changed");
  return source;
}
