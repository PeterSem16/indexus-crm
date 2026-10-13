import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pool } from "../db";
import { DATA_ROOT } from "../config/storage-paths";
import { prepareSourceMailbox, type AnalysisSource } from "./automation-analysis-source";
import type { TaskAttachment } from "../../shared/task-attachments";

export const MAX_FORWARDED_BYTES = 25 * 1024 * 1024;
export async function originalEmailBytes(source: AnalysisSource): Promise<Buffer> {
  if (source.channel !== "email" || !source.message?.externalId) throw new Error("forward_original_unavailable");
  await prepareSourceMailbox(source);
  const mailbox = source.systemMailboxCountry ? `/users/${encodeURIComponent(source.mailboxEmail!)}` : "/me";
  const response = await fetch(`https://graph.microsoft.com/v1.0${mailbox}/messages/${encodeURIComponent(source.message.externalId)}/$value`,
    { headers: { Authorization: `Bearer ${source.mailboxToken}` }, signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.body) throw new Error("forward_original_unavailable");
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_FORWARDED_BYTES) throw new Error("forward_attachment_limit");
      chunks.push(Buffer.from(part.value));
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (!size) throw new Error("forward_original_unavailable");
  return Buffer.concat(chunks);
}

export async function saveForwardedFile(owner: string, file: { name: string; type: string; bytes: Buffer }): Promise<TaskAttachment> {
  if (!owner || !file.bytes.length || file.bytes.length > MAX_FORWARDED_BYTES) throw new Error("forward_attachment_limit");
  const directory = join(dirname(DATA_ROOT), "private-task-attachments");
  await mkdir(directory, { recursive: true });
  // Downloads are private attachments, never publicly served client-controlled extensions.
  const key = `${randomUUID()}.bin`;
  const path = join(directory, key);
  await writeFile(path, file.bytes, { flag: "wx", mode: 0o600 });
  try {
    const name = file.name.replace(/[\/\\\r\n]/g, "_").slice(0, 200);
    const result = await pool.query(`INSERT INTO task_attachment_uploads(uploader_user_id,storage_key,name,type,size)
      VALUES($1,$2,$3,$4,$5) RETURNING id`, [owner, key, name, file.type, file.bytes.length]);
    const id = result.rows[0]?.id;
    if (!id) throw new Error("forward_attachment_store_failed");
    return { id, name, type: file.type, size: file.bytes.length, url: `/api/tasks/attachments/${encodeURIComponent(id)}` };
  } catch (error) { await unlink(path).catch(() => {}); throw error; }
}
