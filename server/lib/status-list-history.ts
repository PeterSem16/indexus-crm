import { statusListHistoryFields, type StatusListHistoryFacts } from "../../shared/status-list-history";

type Queryable = { query(text: string, values?: any[]): Promise<{ rows: any[] }> };
type Contact = { id: string; campaign_id: string; contact_type: string; [key: string]: any };

/** Never use address matching, an agent session, or a mutable current queue. */
export async function readStatusListCommunicationHistory(client: Queryable, contact: Contact) {
  const entityId = contact[`${contact.contact_type}_id`];
  if (!["customer", "clinic", "hospital", "collaborator"].includes(contact.contact_type) || !entityId) return null;
  const calls = (await client.query(`SELECT id,sip_call_id,direction,status,answered_at,started_at,ended_at,duration_seconds,is_forwarded
    FROM call_logs WHERE campaign_id=$1 AND campaign_contact_id=$2`, [contact.campaign_id, contact.id])).rows;
  const messages = (await client.query(`SELECT m.id,m.type,m.direction,m.status,m.sent_at,m.created_at
    FROM communication_messages m WHERE m.type IN ('email','sms') AND (
      (m.campaign_id=$1 AND ((m.entity_type=$2 AND m.entity_id=$3) OR
        ($2='customer' AND m.customer_id=$3 AND m.entity_type IS NULL)))
      OR (m.campaign_id IS NULL AND m.direction='inbound' AND EXISTS(
        SELECT 1 FROM communication_messages original WHERE original.id=m.reply_to_sms_id
        AND original.campaign_id=$1 AND original.direction='outbound'
        AND original.entity_type=$2 AND original.entity_id=$3)))`,
  [contact.campaign_id, contact.contact_type, entityId])).rows;
  return { calls, messages };
}

export function statusListHistoryFacts(history: { calls: any[]; messages: any[] }): StatusListHistoryFacts {
  const facts = Object.fromEntries(statusListHistoryFields.map(field => [field, false])) as StatusListHistoryFacts;
  for (const call of history.calls) {
    if (call.direction === "outbound" && call.started_at) facts["history.call_attempted"] = true;
    // Forwarded caller-channel Up is NOT proof that the destination answered.
    if (!call.is_forwarded && call.answered_at && ["answered", "completed"].includes(call.status) &&
        Number(call.duration_seconds) >= 1) facts["history.call_answered"] = true;
    if (call.direction === "outbound" && (["failed", "no_answer", "busy", "cancelled"].includes(call.status) ||
        (call.status === "completed" && !call.answered_at))) facts["history.call_failed"] = true;
  }
  for (const message of history.messages) {
    if (!["email", "sms"].includes(message.type)) continue;
    if (message.direction === "inbound" && ["received", "delivered", "read"].includes(message.status))
      facts[message.type === "email" ? "history.email_reply" : "history.sms_reply"] = true;
    if (message.direction !== "outbound") continue;
    if (["sent", "delivered", "failed"].includes(message.status)) facts["history.outreach_attempted"] = true;
    if (["sent", "delivered"].includes(message.status))
      facts[message.type === "email" ? "history.email_sent" : "history.sms_sent"] = true;
    if (message.status === "delivered") facts["history.message_delivered"] = true;
  }
  facts["history.outreach_attempted"] ||= facts["history.call_attempted"];
  facts["history.reached"] = facts["history.call_answered"] || facts["history.email_reply"] || facts["history.sms_reply"];
  return facts;
}

export async function loadStatusListHistoryFacts(client: Queryable, campaignId?: string | null, campaignContactId?: string | null) {
  if (!campaignId || !campaignContactId) return null;
  const contact = (await client.query(`SELECT * FROM campaign_contacts WHERE id=$1 AND campaign_id=$2`,
    [campaignContactId, campaignId])).rows[0];
  if (!contact) return null;
  const history = await readStatusListCommunicationHistory(client, contact);
  return history ? statusListHistoryFacts(history) : null;
}
