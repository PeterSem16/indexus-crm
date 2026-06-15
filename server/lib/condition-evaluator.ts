import { db } from "../db";
import { customers, campaigns, tasks as tasksTable } from "../../shared/schema";
import { eq, and, count, sql } from "drizzle-orm";

export interface ConditionRule {
  field: string;
  op: string;
  value: string;
}

export interface ConditionGroup {
  logic: "AND" | "OR";
  rules: ConditionRule[];
}

export interface AutomationConditionContext {
  contactId?: string | null;
  campaignId?: string | null;
  agentId?: string | null;
  contactCountry?: string | null;
}

function numOp(actual: number, op: string, threshold: number): boolean {
  switch (op) {
    case "eq":  return actual === threshold;
    case "neq": return actual !== threshold;
    case "gt":  return actual > threshold;
    case "gte": return actual >= threshold;
    case "lt":  return actual < threshold;
    case "lte": return actual <= threshold;
    default:    return false;
  }
}

function strOp(actual: string | null | undefined, op: string, val: string): boolean {
  const a = (actual ?? "").toLowerCase();
  const v = val.toLowerCase();
  switch (op) {
    case "eq":       return a === v;
    case "neq":      return a !== v;
    case "contains": return a.includes(v);
    case "starts":   return a.startsWith(v);
    case "empty":    return a === "";
    case "notempty": return a !== "";
    default:         return false;
  }
}

function boolOp(actual: boolean, op: string, val: string): boolean {
  const want = val === "true" || val === "1" || val === "yes";
  return op === "neq" ? actual !== want : actual === want;
}

export async function evaluateConditionGroup(
  group: ConditionGroup,
  ctx: AutomationConditionContext
): Promise<boolean> {
  const results: boolean[] = await Promise.all(
    group.rules.map(rule => evaluateSingleRule(rule, ctx))
  );
  return group.logic === "AND" ? results.every(Boolean) : results.some(Boolean);
}

async function evaluateSingleRule(
  rule: ConditionRule,
  ctx: AutomationConditionContext
): Promise<boolean> {
  const { field, op, value } = rule;
  const { contactId, campaignId, contactCountry } = ctx;

  // ── Category A: Call activity ──────────────────────────────────────────
  if (field === "call_count") {
    if (!contactId) return false;
    const [row] = await db.execute<{ cnt: string }>(
      sql`SELECT COUNT(*) AS cnt FROM call_logs WHERE contact_id = ${contactId}`
    );
    return numOp(parseInt((row as any)?.cnt ?? "0"), op, parseInt(value));
  }
  if (field === "calls_today") {
    if (!contactId) return false;
    const [row] = await db.execute<{ cnt: string }>(
      sql`SELECT COUNT(*) AS cnt FROM call_logs WHERE contact_id = ${contactId} AND DATE(started_at) = CURRENT_DATE`
    );
    return numOp(parseInt((row as any)?.cnt ?? "0"), op, parseInt(value));
  }
  if (field === "last_disposition") {
    if (!contactId) return false;
    const [row] = await db.execute<{ disp: string }>(
      sql`SELECT disposition AS disp FROM call_logs WHERE contact_id = ${contactId} ORDER BY started_at DESC LIMIT 1`
    );
    return strOp((row as any)?.disp, op, value);
  }
  if (field === "last_call_duration") {
    if (!contactId) return false;
    const [row] = await db.execute<{ dur: string }>(
      sql`SELECT duration AS dur FROM call_logs WHERE contact_id = ${contactId} ORDER BY started_at DESC LIMIT 1`
    );
    return numOp(parseInt((row as any)?.dur ?? "0"), op, parseInt(value));
  }

  // ── Category B: Disposition / status history ───────────────────────────
  if (field === "current_status") {
    if (!contactId || !campaignId) return false;
    const [row] = await db.execute<{ status: string }>(
      sql`SELECT disposition AS status FROM campaign_contacts WHERE customer_id = ${contactId} AND campaign_id = ${campaignId} LIMIT 1`
    );
    return strOp((row as any)?.status, op, value);
  }
  if (field === "disp_used_count") {
    if (!contactId) return false;
    const parts = value.split("|");
    const dispName = parts[0] ?? "";
    const threshold = parseInt(parts[1] ?? "1");
    const [row] = await db.execute<{ cnt: string }>(
      sql`SELECT COUNT(*) AS cnt FROM call_logs WHERE contact_id = ${contactId} AND disposition = ${dispName}`
    );
    return numOp(parseInt((row as any)?.cnt ?? "0"), op, threshold);
  }
  if (field === "disp_ever_used") {
    if (!contactId) return false;
    const [row] = await db.execute<{ cnt: string }>(
      sql`SELECT COUNT(*) AS cnt FROM call_logs WHERE contact_id = ${contactId} AND disposition = ${value} LIMIT 1`
    );
    return boolOp(parseInt((row as any)?.cnt ?? "0") > 0, op, value.split("|")[1] ?? "true");
  }
  if (field === "status_changes") {
    if (!contactId || !campaignId) return false;
    const [row] = await db.execute<{ cnt: string }>(
      sql`SELECT COUNT(*) AS cnt FROM call_logs WHERE contact_id = ${contactId}`
    );
    return numOp(parseInt((row as any)?.cnt ?? "0"), op, parseInt(value));
  }

  // ── Category C: Contact card fields ────────────────────────────────────
  if (field === "contact_country") {
    return strOp(contactCountry, op, value);
  }
  if (field === "has_email") {
    if (!contactId) return false;
    const [cust] = await db.select({ email: customers.email }).from(customers).where(eq(customers.id, contactId)).limit(1);
    return boolOp(!!cust?.email, op, value);
  }
  if (field === "has_phone") {
    if (!contactId) return false;
    const [cust] = await db.select({ phone: (customers as any).phone }).from(customers).where(eq(customers.id, contactId)).limit(1);
    return boolOp(!!(cust as any)?.phone, op, value);
  }
  if (field === "contract_status") {
    if (!contactId) return false;
    const [row] = await db.execute<{ s: string }>(
      sql`SELECT case_status AS s FROM potential_cases WHERE customer_id = ${contactId} ORDER BY created_at DESC LIMIT 1`
    );
    return strOp((row as any)?.s, op, value);
  }
  if (field === "due_date_days") {
    if (!contactId) return false;
    const [row] = await db.execute<{ days: string }>(
      sql`SELECT EXTRACT(DAY FROM (expected_date - NOW())) AS days FROM potential_cases WHERE customer_id = ${contactId} ORDER BY created_at DESC LIMIT 1`
    );
    const days = parseFloat((row as any)?.days ?? "9999");
    return numOp(days, op, parseFloat(value));
  }
  if (field === "days_since_created") {
    if (!contactId) return false;
    const [cust] = await db.select({ createdAt: customers.createdAt }).from(customers).where(eq(customers.id, contactId)).limit(1);
    if (!cust?.createdAt) return false;
    const days = (Date.now() - new Date(cust.createdAt).getTime()) / 86400000;
    return numOp(days, op, parseFloat(value));
  }

  // ── Category D: Agent/record modifications ─────────────────────────────
  if (field === "record_modified") {
    if (!contactId) return false;
    const [row] = await db.execute<{ cnt: string }>(
      sql`SELECT COUNT(*) AS cnt FROM activity_logs WHERE entity_type = 'customer' AND entity_id = ${contactId} AND action_type IN ('update','edit','modify')`
    );
    return boolOp(parseInt((row as any)?.cnt ?? "0") > 0, op, value);
  }
  if (field === "modification_count") {
    if (!contactId) return false;
    const [row] = await db.execute<{ cnt: string }>(
      sql`SELECT COUNT(*) AS cnt FROM activity_logs WHERE entity_type = 'customer' AND entity_id = ${contactId} AND action_type IN ('update','edit','modify')`
    );
    return numOp(parseInt((row as any)?.cnt ?? "0"), op, parseInt(value));
  }
  if (field === "days_since_activity") {
    if (!contactId) return false;
    const [row] = await db.execute<{ last: string }>(
      sql`SELECT MAX(created_at) AS last FROM activity_logs WHERE entity_type = 'customer' AND entity_id = ${contactId}`
    );
    if (!(row as any)?.last) return op === "gt";
    const days = (Date.now() - new Date((row as any).last).getTime()) / 86400000;
    return numOp(days, op, parseFloat(value));
  }
  if (field === "modified_by_role") {
    if (!contactId) return false;
    const [row] = await db.execute<{ cnt: string }>(
      sql`SELECT COUNT(*) AS cnt FROM activity_logs al JOIN users u ON u.id::text = al.user_id WHERE al.entity_type = 'customer' AND al.entity_id = ${contactId} AND u.role = ${value}`
    );
    return boolOp(parseInt((row as any)?.cnt ?? "0") > 0, op, "true");
  }

  // ── Category E: Linked entities ────────────────────────────────────────
  if (field === "has_hospital") {
    if (!contactId) return false;
    const [row] = await db.execute<{ cnt: string }>(
      sql`SELECT COUNT(*) AS cnt FROM potential_cases WHERE customer_id = ${contactId} AND hospital_id IS NOT NULL`
    );
    return boolOp(parseInt((row as any)?.cnt ?? "0") > 0, op, value);
  }
  if (field === "hospital_name") {
    if (!contactId) return false;
    const [row] = await db.execute<{ name: string }>(
      sql`SELECT h.name FROM potential_cases pc JOIN hospitals h ON h.id = pc.hospital_id WHERE pc.customer_id = ${contactId} ORDER BY pc.created_at DESC LIMIT 1`
    );
    return strOp((row as any)?.name, op, value);
  }
  if (field === "has_collaborator") {
    if (!contactId) return false;
    const [row] = await db.execute<{ cnt: string }>(
      sql`SELECT COUNT(*) AS cnt FROM potential_cases WHERE customer_id = ${contactId} AND collaborator_id IS NOT NULL`
    );
    return boolOp(parseInt((row as any)?.cnt ?? "0") > 0, op, value);
  }
  if (field === "collaborator_category") {
    if (!contactId) return false;
    const [row] = await db.execute<{ cat: string }>(
      sql`SELECT co.category AS cat FROM potential_cases pc JOIN collaborators co ON co.id = pc.collaborator_id WHERE pc.customer_id = ${contactId} ORDER BY pc.created_at DESC LIMIT 1`
    );
    return strOp((row as any)?.cat, op, value);
  }
  if (field === "has_clinic") {
    if (!contactId) return false;
    const [row] = await db.execute<{ cnt: string }>(
      sql`SELECT COUNT(*) AS cnt FROM potential_cases WHERE customer_id = ${contactId} AND clinic_id IS NOT NULL`
    );
    return boolOp(parseInt((row as any)?.cnt ?? "0") > 0, op, value);
  }

  // ── Category F: Campaign activity ──────────────────────────────────────
  if (field === "campaign_contact_count") {
    if (!contactId || !campaignId) return false;
    const [row] = await db.execute<{ cnt: string }>(
      sql`SELECT call_count AS cnt FROM campaign_contacts WHERE customer_id = ${contactId} AND campaign_id = ${campaignId} LIMIT 1`
    );
    return numOp(parseInt((row as any)?.cnt ?? "0"), op, parseInt(value));
  }
  if (field === "days_since_campaign_contact") {
    if (!contactId || !campaignId) return false;
    const [row] = await db.execute<{ last: string }>(
      sql`SELECT last_contacted_at AS last FROM campaign_contacts WHERE customer_id = ${contactId} AND campaign_id = ${campaignId} LIMIT 1`
    );
    if (!(row as any)?.last) return op === "gt";
    const days = (Date.now() - new Date((row as any).last).getTime()) / 86400000;
    return numOp(days, op, parseFloat(value));
  }

  // ── Category G: Contact card (extended) ───────────────────────────────
  if (field === "contact.segment" || field === "client_segment") {
    if (!contactId) return false;
    const [row] = await db.execute<{ seg: string }>(
      sql`SELECT client_status AS seg FROM customers WHERE id = ${contactId} LIMIT 1`
    );
    return strOp((row as any)?.seg, op, value);
  }
  if (field === "contact.status_code" || field === "status_code") {
    if (!contactId) return false;
    const [row] = await db.execute<{ sc: string }>(
      sql`SELECT client_status AS sc FROM customers WHERE id = ${contactId} LIMIT 1`
    );
    return strOp((row as any)?.sc, op, value);
  }
  if (field === "contact.hospital_id") {
    if (!contactId) return false;
    const [row] = await db.execute<{ hid: string }>(
      sql`SELECT hospital_id AS hid FROM potential_cases WHERE customer_id = ${contactId} ORDER BY created_at DESC LIMIT 1`
    );
    return strOp((row as any)?.hid, op, value);
  }
  if (field === "contact.clinic_id") {
    if (!contactId) return false;
    const [row] = await db.execute<{ cid: string }>(
      sql`SELECT clinic_id AS cid FROM potential_cases WHERE customer_id = ${contactId} ORDER BY created_at DESC LIMIT 1`
    );
    return strOp((row as any)?.cid, op, value);
  }
  if (field === "contact.contract_signed") {
    if (!contactId) return false;
    const [row] = await db.execute<{ cnt: string }>(
      sql`SELECT COUNT(*) AS cnt FROM potential_cases WHERE customer_id = ${contactId} AND case_status = 'signed' LIMIT 1`
    );
    return boolOp(parseInt((row as any)?.cnt ?? "0") > 0, op, value);
  }
  if (field === "contact.days_since_last_change") {
    if (!contactId) return false;
    const [row] = await db.execute<{ last: string }>(
      sql`SELECT MAX(created_at) AS last FROM activity_logs WHERE entity_type = 'customer' AND entity_id = ${contactId}`
    );
    if (!(row as any)?.last) return op === "gt";
    const days = (Date.now() - new Date((row as any).last).getTime()) / 86400000;
    return numOp(days, op, parseFloat(value));
  }

  // fallback
  return true;
}

export async function evaluateAutomationCondition(
  automation: {
    conditionField?: string | null;
    conditionOperator?: string | null;
    conditionValue?: string | null;
    conditionJson?: string | null;
  },
  ctx: AutomationConditionContext
): Promise<boolean> {
  // New compound condition
  if (automation.conditionJson) {
    try {
      const group: ConditionGroup = JSON.parse(automation.conditionJson);
      return await evaluateConditionGroup(group, ctx);
    } catch {
      return true;
    }
  }
  // Legacy simple condition
  if (!automation.conditionField || automation.conditionField === "always") {
    return true;
  }
  if (automation.conditionField === "country") {
    return (ctx.contactCountry ?? "") === (automation.conditionValue ?? "");
  }
  if (automation.conditionField === "answer") {
    return true; // answer conditions are UI-only
  }
  return true;
}
