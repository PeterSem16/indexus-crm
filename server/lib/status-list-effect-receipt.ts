type Query = (sql: string, values?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
/** At-most-once external delivery. A crash after claiming is UNKNOWN, never a safe automatic resend. */
export async function statusListEffectOnce(
  query: Query,
  key: { contactId: string; automationId: string; eventKey: string; actorId: string },
  execute: () => Promise<any>,
) {
  const args = [key.contactId, key.automationId, key.eventKey, key.actorId];
  const claimed = await query(`INSERT INTO status_list_effect_receipts
    (campaign_contact_id,automation_id,event_key,actor_id,status) VALUES($1,$2,$3,$4,'running')
    ON CONFLICT DO NOTHING RETURNING event_key`, args);
  if (!claimed.rows.length) {
    const prior = (await query(`SELECT status,result,actor_id FROM status_list_effect_receipts
      WHERE campaign_contact_id=$1 AND automation_id=$2 AND event_key=$3`, args.slice(0, 3))).rows[0];
    if (prior?.actor_id !== key.actorId) throw new Error("execution_actor_conflict");
    return { ...prior?.result, ok: prior?.status === "succeeded", duplicate: true,
      status: prior?.status === "running" ? "uncertain" : prior?.status || "uncertain" };
  }
  let result: any;
  try {
    result = await execute();
    if (result?.ok === false) result = { ok: false, error: "action_failed" };
    else result = { ...(result || {}), ok: true };
  } catch {
    result = { ok: false, error: "action_failed" };
  }
  // Store only controlled outcome fields, never message bodies, recipients or provider errors.
  const safe: any = { ok: result.ok };
  for (const field of ["error", "skipped", "callbackDate", "keptExisting", "actionType", "sent", "provider"])
    if (result[field] !== undefined) safe[field] = result[field];
  await query(`UPDATE status_list_effect_receipts SET status=$5,result=$6::jsonb,finished_at=now()
    WHERE campaign_contact_id=$1 AND automation_id=$2 AND event_key=$3 AND actor_id=$4`,
  [...args, safe.ok ? "succeeded" : "failed", JSON.stringify(safe)]);
  return safe;
}
