import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { users, userMs365Connections, systemMs365Connections, workflowRules, customers, clinics, hospitals, collaborators } from "../../shared/schema";
import { analysisSourceMatches } from "../../shared/automation-analysis";
import { prepareSourceMailbox, type AnalysisSource } from "./automation-analysis-source";
import { storeInboundEmailOnce } from "./inbound-email";
import { emitPersistedInboundEvent } from "./inbound-communication-events";

let checking = false;
/** New services also receive unassigned email and do not depend on legacy notification preferences. */
export async function pollAnalysisMailboxes() {
  if (checking) return;
  checking = true;
  try {
    const rules = (await db.select().from(workflowRules).where(and(eq(workflowRules.enabled, true), eq(workflowRules.module, "communication"))))
      .filter(rule => (rule.trigger as any)?.analysis?.channels?.includes("email"));
    if (!rules.length) return;
    const personal = await db.select({ connection: userMs365Connections, owner: users }).from(userMs365Connections)
      .innerJoin(users, eq(userMs365Connections.userId, users.id))
      .where(and(eq(userMs365Connections.isConnected, true), eq(users.isActive, true)));
    const shared = await db.select().from(systemMs365Connections).where(eq(systemMs365Connections.isConnected, true));
    const creators = new Map(personal.map(row => [row.owner.id, row.owner]));
    for (const rule of rules) {
      if (rule.createdByUserId && !creators.has(rule.createdByUserId)) {
        const [creator] = await db.select().from(users).where(eq(users.id, rule.createdByUserId));
        if (creator) creators.set(creator.id, creator);
      }
    }
    const mailboxes = [
      ...personal.map(row => ({ ownerId: row.owner.id, userId: row.owner.id, country: row.owner.assignedCountries?.length === 1 ? row.owner.assignedCountries[0] : null,
        systemCountry: undefined as string | undefined, email: undefined as string | undefined })),
      ...shared.map(connection => ({ ownerId: `system:${connection.countryCode}`, userId: connection.connectedByUserId,
        country: connection.countryCode, systemCountry: connection.countryCode, email: connection.email })),
    ];
    const legacySenders = new Map<string, boolean>();
    for (const mailbox of mailboxes) {
      const eligible = rules.filter(rule => {
        const creator = rule.createdByUserId ? creators.get(rule.createdByUserId) : null;
        const config: any = (rule.trigger as any).analysis;
        return creator?.isActive && (creator.id === mailbox.ownerId || ["admin", "superadmin", "owner"].includes(creator.role)) &&
          !(config.mailboxMode === "selected" && !config.mailboxUserIds?.length) &&
          (!config.mailboxUserIds?.length || config.mailboxUserIds.includes(mailbox.ownerId));
      });
      if (!eligible.length) continue;
      try {
        const since = new Date(Math.min(...eligible.map(rule =>
          new Date((rule.trigger as any).listenAfter || rule.createdAt).getTime()))).toISOString();
        const source = { channel: "email", ownerUserId: mailbox.ownerId, text: "",
          message: { externalId: "inbox-scan" }, systemMailboxCountry: mailbox.systemCountry, mailboxEmail: mailbox.email } as AnalysisSource;
        await prepareSourceMailbox(source);
        const path = mailbox.systemCountry ? `/users/${encodeURIComponent(mailbox.email!)}` : "/me";
        let next: string | null = `https://graph.microsoft.com/v1.0${path}/mailFolders/inbox/messages?${new URLSearchParams({
          "$filter": `receivedDateTime ge ${since}`, "$select": "id,subject,from,body,receivedDateTime,conversationId", "$top": "100", "$orderby": "receivedDateTime desc",
        })}`;
        let pages = 0;
        while (next) {
          if (++pages > 10) throw new Error("analysis_mailbox_scan_limit");
          const url: URL = new URL(next);
          if (url.origin !== "https://graph.microsoft.com" || !url.pathname.startsWith(`/v1.0${path}/`)) throw new Error("analysis_mailbox_pagination_invalid");
          const response: Response = await fetch(url, { headers: { Authorization: `Bearer ${source.mailboxToken}` }, signal: AbortSignal.timeout(30000) });
          if (!response.ok) throw new Error("analysis_mailbox_scan_failed");
          const page: any = await response.json();
          if (!Array.isArray(page.value)) throw new Error("analysis_mailbox_response_invalid");
          for (const mail of page.value) {
            const senderEmail = mail.from?.emailAddress?.address;
            if (!mail.id || typeof senderEmail !== "string" || typeof mail.body?.content !== "string") continue;
            if (!eligible.some(rule => analysisSourceMatches((rule.trigger as any).analysis,
              { channel: "email", ownerUserId: mailbox.ownerId, senderEmail }))) continue;
            const normalizedSender = senderEmail.toLowerCase().trim();
            if (!legacySenders.has(normalizedSender)) {
              const matches = await Promise.all([customers, clinics, hospitals, collaborators].map(table =>
                db.select({ id: table.id }).from(table).where(sql`LOWER(${table.email}) = ${normalizedSender}`).limit(1)));
              legacySenders.set(normalizedSender, matches.some(rows => rows.length > 0));
            }
            // The existing monitor owns linked mail, including its original AI/alerts.
            // Winning its insertion race would prevent its contact linking and system-mail analysis.
            if (legacySenders.get(normalizedSender)) continue;
            const saved = await storeInboundEmailOnce(mail.id, { type: "email", direction: "inbound", externalId: mail.id,
              userId: mailbox.userId, countryCode: mailbox.country, status: "received",
              subject: mail.subject || "", content: mail.body.content,
              metadata: JSON.stringify({ from: senderEmail, senderName: mail.from?.emailAddress?.name || "",
                receivedAt: mail.receivedDateTime || null,
                conversationId: mail.conversationId || null, isHtml: mail.body.contentType?.toLowerCase() === "html",
                mailboxSource: mailbox.systemCountry ? { kind: "system", countryCode: mailbox.systemCountry, mailboxEmail: mailbox.email }
                  : { kind: "personal", ownerUserId: mailbox.ownerId, mailboxEmail: mailbox.email } }),
            });
            if (saved) await emitPersistedInboundEvent(saved.id, "email.received");
          }
          next = page["@odata.nextLink"] || null;
        }
      } catch {
        console.error("[Automation] analysis mailbox scan unavailable");
      }
    }
  } finally { checking = false; }
}
