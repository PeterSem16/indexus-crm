import { storage } from "../storage";
import { notificationService } from "./notification-service";
import { db } from "../db";
import { communicationMessages, clinics, hospitals, collaborators, systemMs365Connections } from "../../shared/schema";
import { sql, and, eq, desc } from "drizzle-orm";

interface ProcessedEmail {
  emailId: string;
  processedAt: Date;
}

const processedEmailsMap: Record<string, ProcessedEmail> = {};
const PROCESSED_CACHE_TTL = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL = 60000;

async function analyzeEmailContent(content: string): Promise<{
  sentiment: "positive" | "neutral" | "negative" | "angry";
  hasInappropriateContent: boolean;
  hasAngryTone: boolean;
  hasRudeExpressions: boolean;
  wantsToCancel: boolean;
  wantsConsent: boolean;
  doesNotAcceptContract: boolean;
  alertLevel: "none" | "warning" | "critical";
  note: string;
}> {
  const openai = await import("openai");
  const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY });
  
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an email analyzer for a cord blood banking CRM system. Analyze customer emails for sentiment and intent.
                
Analyze the email and return JSON with:
1. sentiment: "positive", "neutral", "negative", or "angry" (frustrated/upset customer)
2. hasInappropriateContent: boolean (vulgar, offensive language)
3. hasAngryTone: boolean (expressing frustration, anger)
4. hasRudeExpressions: boolean (disrespectful, demanding)
5. wantsToCancel: boolean (wants to cancel service/contract)
6. wantsConsent: boolean (agreeing, giving consent to something)
7. doesNotAcceptContract: boolean (rejecting terms, contract)
8. alertLevel: "none", "warning" (needs attention), or "critical" (urgent - angry customer, cancellation, complaints)
9. note: Brief explanation in Slovak (max 100 chars)

Return ONLY valid JSON, no markdown.
Example: {"sentiment":"neutral","hasInappropriateContent":false,"hasAngryTone":false,"hasRudeExpressions":false,"wantsToCancel":false,"wantsConsent":false,"doesNotAcceptContract":false,"alertLevel":"none","note":"Stručné vysvetlenie"}`
      },
      {
        role: "user",
        content: content.substring(0, 2000)
      }
    ],
    max_tokens: 200,
    temperature: 0.1,
  });
  
  const responseText = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(responseText.replace(/```json\n?|\n?```/g, "").trim());
  
  return {
    sentiment: parsed.sentiment || "neutral",
    hasInappropriateContent: parsed.hasInappropriateContent || false,
    hasAngryTone: parsed.hasAngryTone || false,
    hasRudeExpressions: parsed.hasRudeExpressions || false,
    wantsToCancel: parsed.wantsToCancel || false,
    wantsConsent: parsed.wantsConsent || false,
    doesNotAcceptContract: parsed.doesNotAcceptContract || false,
    alertLevel: parsed.alertLevel || "none",
    note: parsed.note || "",
  };
}

async function checkUserEmails(userId: string, connection: any) {
  try {
    const { decryptTokenSafe } = await import("./token-crypto");
    const { getValidAccessToken, getRecentEmails } = await import("./ms365");
    
    let accessToken: string;
    let refreshToken: string | null;
    
    try {
      accessToken = decryptTokenSafe(connection.accessToken);
      refreshToken = connection.refreshToken ? decryptTokenSafe(connection.refreshToken) : null;
    } catch {
      console.log(`[EmailMonitor] Failed to decrypt tokens for user ${userId}`);
      return;
    }
    
    const tokenResult = await getValidAccessToken(accessToken, connection.tokenExpiresAt, refreshToken);
    if (!tokenResult?.accessToken) {
      return;
    }
    
    if (tokenResult.refreshed) {
      const { encryptTokenWithMarker } = await import("./token-crypto");
      const updateData: any = {
        accessToken: encryptTokenWithMarker(tokenResult.accessToken),
        tokenExpiresAt: tokenResult.expiresOn,
        lastSyncAt: new Date(),
      };
      if (tokenResult.refreshToken) {
        updateData.refreshToken = encryptTokenWithMarker(tokenResult.refreshToken);
      }
      await storage.updateUserMs365Connection(userId, updateData);
    }
    
    const emails = await getRecentEmails(tokenResult.accessToken, undefined, 20, false);
    
    for (const email of emails) {
      const emailId = email.id;
      
      if (processedEmailsMap[emailId]) {
        continue;
      }
      
      processedEmailsMap[emailId] = { emailId, processedAt: new Date() };
      
      const content = email.bodyPreview || email.body?.content || "";
      if (!content || content.length < 10) {
        continue;
      }
      
      console.log(`[EmailMonitor] Analyzing new email ${emailId} for user ${userId}`);
      
      const senderEmail = (email.from?.emailAddress?.address || "").toLowerCase().trim();
      const senderName = email.from?.emailAddress?.name || senderEmail;
      const emailSubject = email.subject || "(bez predmetu)";
      const conversationId = (email as any).conversationId || null;

      // ── Sentiment analysis ──────────────────────────────────────────
      try {
        const analysis = await analyzeEmailContent(content);
        
        console.log(`[EmailMonitor] Email ${emailId}: sentiment=${analysis.sentiment}, alert=${analysis.alertLevel}`);
        
        if (analysis.sentiment === "negative" || analysis.sentiment === "angry" || analysis.hasAngryTone) {
          console.log(`[EmailMonitor] Creating notification for negative email from ${senderEmail}`);
          
          const notification = await storage.createNotification({
            userId,
            type: "sentiment_negative",
            title: `Negatívna reakcia v emaili`,
            message: analysis.note || `Email od ${senderName} obsahuje negatívny sentiment`,
            priority: analysis.alertLevel === "critical" ? "high" : "normal",
            entityType: "email",
            entityId: emailId,
            metadata: {
              sentiment: analysis.sentiment,
              alertLevel: analysis.alertLevel,
              senderEmail,
              customerName: senderName,
              hasAngryTone: analysis.hasAngryTone,
              wantsToCancel: analysis.wantsToCancel,
            },
          });
          
          await notificationService.sendNotification(notification);
          console.log(`[EmailMonitor] Notification sent for negative email ${emailId}`);
        }
      } catch (analysisError) {
        console.error(`[EmailMonitor] Failed to analyze email ${emailId}:`, analysisError);
      }

      // ── Link inbound email to CRM contact ───────────────────────────
      // Skip system/unknown senders
      if (senderEmail && senderEmail !== "unknown") {
        try {
          // Check for duplicate (already stored as inbound)
          const existing = await db.select({ id: communicationMessages.id })
            .from(communicationMessages)
            .where(and(
              eq(communicationMessages.externalId, emailId),
              eq(communicationMessages.direction, "inbound")
            ))
            .limit(1);

          if (existing.length === 0) {
            let linkedId: string | null = null;
            let linkedType = "customer";

            // 1. Try conversationId → find outbound email with matching recipientEmails
            if (conversationId) {
              const [prev] = await db.select({
                customerId: communicationMessages.customerId,
                metadata: communicationMessages.metadata,
              })
                .from(communicationMessages)
                .where(and(
                  eq(communicationMessages.direction, "outbound"),
                  eq(communicationMessages.type, "email"),
                  sql`${communicationMessages.metadata}::jsonb ->> 'conversationId' = ${conversationId}`
                ))
                .limit(1);
              if (prev?.customerId) {
                linkedId = prev.customerId;
                try { linkedType = JSON.parse(prev.metadata || "{}").contactType || "customer"; } catch {}
              }
            }

            // 2. Search customers by email
            if (!linkedId) {
              const matched = await storage.findCustomersByEmail(senderEmail);
              if (matched.length > 0) { linkedId = matched[0].id; linkedType = "customer"; }
            }

            // 3. Search clinics by email
            if (!linkedId) {
              const [clinic] = await db.select({ id: clinics.id }).from(clinics)
                .where(sql`LOWER(${clinics.email}) = ${senderEmail} OR LOWER(${clinics.email2}) = ${senderEmail}`)
                .limit(1);
              if (clinic) { linkedId = clinic.id; linkedType = "clinic"; }
            }

            // 4. Search hospitals by email
            if (!linkedId) {
              const [hospital] = await db.select({ id: hospitals.id }).from(hospitals)
                .where(sql`LOWER(${hospitals.email}) = ${senderEmail}`)
                .limit(1);
              if (hospital) { linkedId = hospital.id; linkedType = "hospital"; }
            }

            // 5. Search collaborators by email
            if (!linkedId) {
              const [collab] = await db.select({ id: collaborators.id }).from(collaborators)
                .where(sql`LOWER(${collaborators.email}) = ${senderEmail}`)
                .limit(1);
              if (collab) { linkedId = collab.id; linkedType = "collaborator"; }
            }

            if (linkedId) {
              await storage.createCommunicationMessage({
                customerId: linkedId,
                userId,
                type: "email",
                direction: "inbound",
                subject: emailSubject,
                content: (email.body?.content || email.bodyPreview || content).substring(0, 100000),
                status: "received",
                externalId: emailId,
                metadata: JSON.stringify({
                  from: senderEmail,
                  senderName,
                  conversationId: conversationId || null,
                  contactType: linkedType,
                  isHtml: email.body?.contentType?.toLowerCase().includes("html") ?? false,
                }),
              });
              console.log(`[EmailMonitor] Linked inbound email ${emailId} to ${linkedType} ${linkedId}`);
            }
          }
        } catch (linkError) {
          console.error(`[EmailMonitor] Failed to link inbound email ${emailId}:`, linkError);
        }
      }
    }
  } catch (error) {
    console.error(`[EmailMonitor] Error checking emails for user ${userId}:`, error);
  }
}

// Helper: same link-to-contact logic reused for system mailbox monitoring
async function linkInboundEmailToContact(
  emailId: string,
  senderEmail: string,
  senderName: string,
  emailSubject: string,
  content: string,
  conversationId: string | null,
  bodyIsHtml: boolean,
  notifyUserId: string | null
) {
  const existing = await db.select({ id: communicationMessages.id })
    .from(communicationMessages)
    .where(and(eq(communicationMessages.externalId, emailId), eq(communicationMessages.direction, "inbound")))
    .limit(1);
  if (existing.length > 0) return null;

  let linkedId: string | null = null;
  let linkedType = "customer";
  let responsibleUserId = notifyUserId;

  if (conversationId) {
    const [prev] = await db.select({ customerId: communicationMessages.customerId, userId: communicationMessages.userId, metadata: communicationMessages.metadata })
      .from(communicationMessages)
      .where(and(eq(communicationMessages.direction, "outbound"), eq(communicationMessages.type, "email"),
        sql`${communicationMessages.metadata}::jsonb ->> 'conversationId' = ${conversationId}`))
      .limit(1);
    if (prev?.customerId) {
      linkedId = prev.customerId;
      responsibleUserId = prev.userId || notifyUserId;
      try { linkedType = JSON.parse(prev.metadata || "{}").contactType || "customer"; } catch {}
    }
  }
  if (!linkedId) {
    const matched = await storage.findCustomersByEmail(senderEmail);
    if (matched.length > 0) {
      linkedId = matched[0].id;
      linkedType = "customer";
      const [lastOut] = await db.select({ userId: communicationMessages.userId }).from(communicationMessages)
        .where(and(eq(communicationMessages.customerId, linkedId), eq(communicationMessages.direction, "outbound"), eq(communicationMessages.type, "email")))
        .orderBy(desc(communicationMessages.createdAt)).limit(1);
      if (lastOut?.userId) responsibleUserId = lastOut.userId;
    }
  }
  if (!linkedId) {
    const [clinic] = await db.select({ id: clinics.id }).from(clinics)
      .where(sql`LOWER(${clinics.email}) = ${senderEmail} OR LOWER(${clinics.email2}) = ${senderEmail}`).limit(1);
    if (clinic) { linkedId = clinic.id; linkedType = "clinic"; }
  }
  if (!linkedId) {
    const [hospital] = await db.select({ id: hospitals.id }).from(hospitals)
      .where(sql`LOWER(${hospitals.email}) = ${senderEmail}`).limit(1);
    if (hospital) { linkedId = hospital.id; linkedType = "hospital"; }
  }
  if (!linkedId) {
    const [collab] = await db.select({ id: collaborators.id }).from(collaborators)
      .where(sql`LOWER(${collaborators.email}) = ${senderEmail}`).limit(1);
    if (collab) { linkedId = collab.id; linkedType = "collaborator"; }
  }

  if (!linkedId) return null;

  // If we still don't know who should be notified, find the last agent who emailed this contact
  if (!responsibleUserId) {
    const [lastOut] = await db.select({ userId: communicationMessages.userId }).from(communicationMessages)
      .where(and(eq(communicationMessages.customerId, linkedId), eq(communicationMessages.direction, "outbound"), eq(communicationMessages.type, "email")))
      .orderBy(desc(communicationMessages.createdAt)).limit(1);
    if (lastOut?.userId) responsibleUserId = lastOut.userId;
  }

  await storage.createCommunicationMessage({
    customerId: linkedId,
    userId: responsibleUserId,
    type: "email",
    direction: "inbound",
    subject: emailSubject,
    content: content.substring(0, 100000),
    status: "received",
    externalId: emailId,
    metadata: JSON.stringify({ from: senderEmail, senderName, conversationId: conversationId || null, contactType: linkedType, isHtml: bodyIsHtml }),
  });
  console.log(`[EmailMonitor] Linked inbound email ${emailId} to ${linkedType} ${linkedId}`);
  return { linkedId, linkedType, responsibleUserId };
}

async function checkSystemMailboxEmails() {
  try {
    const { decryptTokenSafe } = await import("./token-crypto");
    const { getValidAccessToken, getRecentEmails } = await import("./ms365");
    const systemConnections = await db.select().from(systemMs365Connections).where(eq(systemMs365Connections.isConnected, true));

    for (const conn of systemConnections) {
      try {
        let accessToken: string;
        let refreshToken: string | null;
        try {
          accessToken = decryptTokenSafe(conn.accessToken);
          refreshToken = conn.refreshToken ? decryptTokenSafe(conn.refreshToken) : null;
        } catch { continue; }

        const tokenResult = await getValidAccessToken(accessToken, conn.tokenExpiresAt, refreshToken);
        if (!tokenResult?.accessToken) continue;

        if (tokenResult.refreshed) {
          const { encryptTokenWithMarker } = await import("./token-crypto");
          const updateData: any = { accessToken: encryptTokenWithMarker(tokenResult.accessToken), tokenExpiresAt: tokenResult.expiresOn, lastSyncAt: new Date() };
          if (tokenResult.refreshToken) updateData.refreshToken = encryptTokenWithMarker(tokenResult.refreshToken);
          await storage.updateSystemMs365Connection(conn.countryCode, updateData);
        }

        // Fetch recent inbox emails for this system mailbox
        const emails = await getRecentEmails(tokenResult.accessToken, conn.email, 20, false);

        for (const email of emails) {
          const emailId = email.id;
          if (processedEmailsMap[emailId]) continue;
          processedEmailsMap[emailId] = { emailId, processedAt: new Date() };

          const content = email.body?.content || email.bodyPreview || "";
          if (!content || content.length < 5) continue;

          const senderEmail = (email.from?.emailAddress?.address || "").toLowerCase().trim();
          const senderName = email.from?.emailAddress?.name || senderEmail;
          if (!senderEmail || senderEmail === "unknown" || senderEmail === conn.email.toLowerCase()) continue;

          const emailSubject = email.subject || "(bez predmetu)";
          const conversationId = email.conversationId || null;
          const bodyIsHtml = email.body?.contentType?.toLowerCase().includes("html") ?? false;
          const notifyUserId = conn.connectedByUserId || null;

          const linked = await linkInboundEmailToContact(emailId, senderEmail, senderName, emailSubject, content, conversationId, bodyIsHtml, notifyUserId);
          if (linked?.responsibleUserId) {
            try {
              const analysis = await analyzeEmailContent(content);
              if (analysis.sentiment === "negative" || analysis.sentiment === "angry" || analysis.hasAngryTone) {
                const notification = await storage.createNotification({
                  userId: linked.responsibleUserId,
                  type: "sentiment_negative",
                  title: `Negatívna reakcia v emaili`,
                  message: analysis.note || `Email od ${senderName} obsahuje negatívny sentiment`,
                  priority: analysis.alertLevel === "critical" ? "high" : "normal",
                  entityType: "email", entityId: emailId,
                  metadata: { sentiment: analysis.sentiment, alertLevel: analysis.alertLevel, senderEmail, customerName: senderName },
                });
                await notificationService.sendNotification(notification);
              }
            } catch {}
          }
        }
      } catch (err) {
        console.error(`[EmailMonitor] Error checking system mailbox ${conn.email}:`, err);
      }
    }
  } catch (err) {
    console.error("[EmailMonitor] Error in system mailbox monitoring:", err);
  }
}

async function monitorEmails() {
  try {
    const users = await storage.getAllUsers();
    
    for (const user of users) {
      if (!user.isActive) continue;
      
      const connection = await storage.getUserMs365Connection(user.id);
      if (!connection?.isConnected) continue;
      
      await checkUserEmails(user.id, connection);
    }

    // Also monitor system mailboxes — replies to system-sent emails arrive here
    await checkSystemMailboxEmails();
    
    const now = Date.now();
    for (const emailId of Object.keys(processedEmailsMap)) {
      const data = processedEmailsMap[emailId];
      if (now - data.processedAt.getTime() > PROCESSED_CACHE_TTL) {
        delete processedEmailsMap[emailId];
      }
    }
  } catch (error) {
    console.error("[EmailMonitor] Error in monitoring cycle:", error);
  }
}

let monitoringInterval: NodeJS.Timeout | null = null;

export function startEmailMonitoring() {
  if (monitoringInterval) return;
  
  const STARTUP_DELAY = 30000;
  console.log(`[EmailMonitor] Will start email monitoring in ${STARTUP_DELAY / 1000}s (waiting for server warmup)...`);
  
  setTimeout(() => {
    if (monitoringInterval) return;
    console.log("[EmailMonitor] Starting email monitoring service...");
    monitoringInterval = setInterval(monitorEmails, CHECK_INTERVAL);
    setTimeout(monitorEmails, 5000);
  }, STARTUP_DELAY);
}

export function stopEmailMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log("[EmailMonitor] Email monitoring stopped");
  }
}
