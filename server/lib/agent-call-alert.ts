// Incoming-call alert for standing-forward agents.
//
// Background: Slovak (+421) callers forwarded over the wholesale SK trunk get blocked
// by the terminating operator's anti-spoofing filter when we present their national
// caller-ID (confirmed via a live SIP trace: 180/183 ringback then a false 486 BUSY).
// The fix is to present the company's own authorised DID as the CLI for SK callers so
// the call connects — which means the agent's phone no longer shows who is really
// calling. This module delivers the REAL caller (number + name) to the agent out of
// band, the moment their mobile starts ringing, via THREE best-effort channels:
//   1. an in-app notification (INDEXUS web notification bell / WebSocket),
//   2. an Expo push to the INDEXUS Connect mobile app,
//   3. an SMS to the agent's mobile.
// Every channel is best-effort and never throws into the call-handling path.

import { db } from "../db";
import { sql } from "drizzle-orm";
import { notificationService } from "./notification-service";
import { sendTransactionalSms } from "./bulkgate";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function digitsOnly(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

// Turn whatever form the trunk delivered (0+international, 00CC, +CC, or bare
// international) into a readable +CC number for humans. National / short numbers are
// left as-is.
export function formatCallerForDisplay(raw: string | null | undefined): string {
  const s = (raw || "").trim();
  if (!s) return "";
  const d = digitsOnly(s);
  if (!d) return s;
  if (s.startsWith("+")) return "+" + d;
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (d.startsWith("0") && d.length >= 12) return "+" + d.slice(1); // trunk form: 0 + international
  if (d.length >= 11) return "+" + d; // bare international
  return s.replace(/\s+/g, " ").trim();
}

// Best-effort country hint for the SMS gateway, derived from the agent's own number.
function guessCountry(num: string): string {
  const s = (num || "").trim();
  const d = digitsOnly(s);
  let intl = d;
  if (s.startsWith("+")) intl = d;
  else if (d.startsWith("00")) intl = d.slice(2);
  else if (d.startsWith("0") && d.length >= 12) intl = d.slice(1);
  if (intl.startsWith("421")) return "sk";
  if (intl.startsWith("420")) return "cz";
  if (intl.startsWith("36")) return "hu";
  if (intl.startsWith("40")) return "ro";
  if (intl.startsWith("49")) return "de";
  if (intl.startsWith("39")) return "it";
  return "sk";
}

// Find active INDEXUS Connect push tokens for the agent by matching their mobile
// (users.callForwardingNumber) against a collaborator's phone numbers. There is no FK
// between users and collaborators, so we bridge on the last 9 digits of the number.
async function pushTokensForAgentMobile(agentMobile: string): Promise<string[]> {
  const l9 = digitsOnly(agentMobile).slice(-9);
  if (l9.length < 9) return [];
  try {
    const result: any = await db.execute(sql`
      SELECT DISTINCT mpt.token AS token
      FROM mobile_push_tokens mpt
      JOIN collaborators c ON c.id = mpt.collaborator_id
      WHERE mpt.is_active = true
        AND (
          right(regexp_replace(coalesce(c.mobile, ''), '[^0-9]', '', 'g'), 9) = ${l9}
          OR right(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'), 9) = ${l9}
          OR right(regexp_replace(coalesce(c.call_forwarding_number, ''), '[^0-9]', '', 'g'), 9) = ${l9}
        )
    `);
    const rows = result?.rows || [];
    return rows.map((r: any) => r.token).filter((t: any) => typeof t === "string" && t.length > 0);
  } catch (err: any) {
    console.warn(`[AgentCallAlert] push token lookup failed:`, err?.message || err);
    return [];
  }
}

async function sendExpoPush(tokens: string[], title: string, body: string, data: Record<string, any>): Promise<void> {
  const valid = tokens.filter(t => t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["));
  if (valid.length === 0) return;
  const messages = valid.map(to => ({
    to,
    title,
    body,
    data,
    sound: "default",
    priority: "high",
    channelId: "default",
  }));
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        console.warn(`[AgentCallAlert] Expo push HTTP ${res.status}`);
      }
    } catch (err: any) {
      console.warn(`[AgentCallAlert] Expo push send failed:`, err?.message || err);
    }
  }
}

export interface AgentIncomingCallAlert {
  userId: string;            // standing-forward agent (users.id)
  agentMobile: string;       // number we ring (users.callForwardingNumber)
  realCallerNumber: string;  // the caller's REAL number (not the DID we present)
  callerName?: string | null;
  customerId?: string | null;
  queueName?: string;
}

// Fire all three alert channels. Never throws; safe to call fire-and-forget.
export async function alertAgentIncomingCall(opts: AgentIncomingCallAlert): Promise<void> {
  const { userId, agentMobile, realCallerNumber, callerName, customerId, queueName } = opts;
  const displayNumber = formatCallerForDisplay(realCallerNumber) || (realCallerNumber || "").trim() || "neznáme číslo";
  const nameClean = (callerName || "").trim();
  const who = nameClean && digitsOnly(nameClean) !== digitsOnly(realCallerNumber) ? nameClean : "";
  const title = "Prichádzajúci hovor";
  const body = who ? `${who} — ${displayNumber}` : displayNumber;
  const smsText = `INDEXUS – prichádzajúci hovor: ${displayNumber}${who ? ` (${who})` : ""}${queueName ? ` [${queueName}]` : ""}`;

  // 1) In-app notification for the agent (web notification bell).
  try {
    await notificationService.sendNotificationToUsers([userId], {
      type: "incoming_forward_call",
      title,
      message: body,
      priority: "high",
      entityType: customerId ? "customer" : undefined,
      entityId: customerId || undefined,
      metadata: {
        callerNumber: realCallerNumber,
        displayNumber,
        callerName: who || null,
        queueName: queueName || null,
      },
    });
  } catch (err: any) {
    console.warn(`[AgentCallAlert] web notification failed for user ${userId}:`, err?.message || err);
  }

  // 2) Push to INDEXUS Connect mobile app.
  try {
    const tokens = await pushTokensForAgentMobile(agentMobile);
    if (tokens.length > 0) {
      await sendExpoPush(tokens, title, body, {
        type: "incoming_forward_call",
        callerNumber: realCallerNumber,
        displayNumber,
        callerName: who || null,
        customerId: customerId || null,
        queueName: queueName || null,
      });
    }
  } catch (err: any) {
    console.warn(`[AgentCallAlert] push failed:`, err?.message || err);
  }

  // 3) SMS to the agent's mobile.
  try {
    if (agentMobile && agentMobile.trim().length > 0) {
      await sendTransactionalSms({
        number: agentMobile,
        text: smsText,
        country: guessCountry(agentMobile),
        tag: "agent-incoming-call",
      });
    }
  } catch (err: any) {
    console.warn(`[AgentCallAlert] SMS failed:`, err?.message || err);
  }
}
