import { and, eq } from "drizzle-orm";
import { COUNTRIES, users } from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import { resolveAutomationRecipientTarget } from "./automation-recipient-target";
import { getValidAccessToken } from "./ms365";
import { decryptTokenSafe, encryptTokenWithMarker } from "./token-crypto";
import { taskTemplateContext } from "./task-template-variables";
import { emailActionIssues } from "../../shared/automation-email-action";
import { addCountrySignature, escapeEmailText, renderEmailValue, renderEmailAddressConfig, resolveEmailRecipients, sanitizeAutomationEmail, selectAutomationEmailSender } from "./automation-email-policy";
import { sendAutomationGraphEmail } from "./automation-email-graph";
import { automationEmailInlineAttachments } from "./automation-email-assets";

export async function planAutomationEmailRecipients(config: any) {
  return resolveEmailRecipients(config, {
    group: async target => (await resolveAutomationRecipientTarget(target.kind === "group"
      ? { taskGroupId: target.id } : { targetRole: target.id }, { purpose: "email" })).userIds,
    userEmail: async id => {
      const [user] = await db.select({ email: users.email }).from(users)
        .where(and(eq(users.id, id), eq(users.isActive, true))).limit(1);
      if (!user?.email?.trim()) throw new Error("A recipient has no active email address");
      return user.email;
    },
  });
}

export async function deliverAutomationEmail(config: any, context: any) {
  try {
    const issues = emailActionIssues(config);
    if (issues.length) throw new Error(issues.join("; "));
    if (context.event?.module === "call" &&
        (!context.newValues?.campaignId || !context.event?.countryCode))
      throw new Error("Inbound email requires verified Mission and queue country");
    const ctx = taskTemplateContext(context, config.templateLanguage);
    const addresses = renderEmailAddressConfig(config, ctx);
    const recipients = await planAutomationEmailRecipients(addresses);
    const sender = selectAutomationEmailSender(config, context);
    const personal = sender.mode === "personal";
    const country = sender.country;
    if (!personal && !COUNTRIES.some(item => item.code === country))
      throw new Error("System email requires the actual event country");
    const authorId = sender.authorId;
    if (personal && !authorId) throw new Error("Personal email requires a known rule author");
    if (personal) {
      const author = await storage.getUser(authorId!);
      if (!author?.isActive) throw new Error("The rule author is inactive");
    }
    const mailbox = personal ? await storage.getUserMs365Connection(authorId!)
      : await storage.getSystemMs365Connection(country!);
    if (!mailbox?.isConnected || !mailbox.accessToken || !mailbox.email)
      throw new Error("Connect the configured Microsoft 365 mailbox before sending");
    const settings = !personal ? await storage.getCountrySystemSettingsByCountry(country!) : undefined;
    // Never borrow the first rule country or spoof a different sender address.
    if (settings?.systemEmailAddress &&
        settings.systemEmailAddress.trim().toLowerCase() !== mailbox.email.trim().toLowerCase())
      throw new Error("The country's configured sender does not match its connected mailbox");
    let tokens;
    try {
      tokens = await getValidAccessToken(decryptTokenSafe(mailbox.accessToken),
        mailbox.tokenExpiresAt, mailbox.refreshToken ? decryptTokenSafe(mailbox.refreshToken) : null,
        { quiet: true });
    } catch { throw new Error("Reconnect the configured Microsoft 365 mailbox"); }
    if (!tokens) throw new Error("Reconnect the configured Microsoft 365 mailbox");
    if (tokens.refreshed) {
      const update = {
        accessToken: encryptTokenWithMarker(tokens.accessToken),
        ...(tokens.refreshToken ? { refreshToken: encryptTokenWithMarker(tokens.refreshToken) } : {}),
        tokenExpiresAt: tokens.expiresOn,
      };
      if (personal) await storage.updateUserMs365Connection(authorId!, update);
      else await storage.updateSystemMs365Connection(country!, update);
    }
    const subject = renderEmailValue(config.subject, ctx).trim();
    if (!subject || /[\r\n]/.test(subject)) throw new Error("Invalid email subject");
    const isHtml = /<[a-z][\s\S]*>/i.test(config.body);
    let html = isHtml ? renderEmailValue(config.body, ctx, true)
      : escapeEmailText(renderEmailValue(config.body, ctx)).replace(/\r?\n/g, "<br>");
    if (!personal && config.includeSystemSignature)
      html = addCountrySignature(html, settings?.systemEmailSignature || "");
    html = sanitizeAutomationEmail(html);
    const attachments = await automationEmailInlineAttachments(html);
    let totalBytes = 0;
    if (config.attachments && (!Array.isArray(config.attachments) || config.attachments.length > 5))
      throw new Error("Email accepts at most five attachments");
    for (const item of config.attachments || []) {
      if (typeof item?.contentBase64 !== "string" || item.url)
        throw new Error("Email attachments must contain copied file content");
      const bytes = Buffer.from(item.contentBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
      totalBytes += bytes.length;
      if (bytes.length > 10 * 1024 * 1024 || totalBytes > 25 * 1024 * 1024)
        throw new Error("Email attachments exceed the permitted size");
      attachments.push({ "@odata.type": "#microsoft.graph.fileAttachment",
        name: String(item.name || "attachment").slice(0, 200),
        contentType: String(item.contentType || "application/octet-stream"),
        contentBytes: bytes.toString("base64") });
    }
    const displayName = String(config.senderDisplayName ||
      (!personal && settings?.systemEmailDisplayName) || mailbox.displayName || "").trim();
    const recipient = (address: string) => ({ emailAddress: { address } });
    await sendAutomationGraphEmail(tokens.accessToken, {
      message: { subject, body: { contentType: "HTML", content: html },
        from: { emailAddress: { address: mailbox.email, ...(displayName ? { name: displayName } : {}) } },
        toRecipients: recipients.to.map(recipient), ccRecipients: recipients.cc.map(recipient),
        bccRecipients: recipients.bcc.map(recipient), attachments },
      saveToSentItems: true,
    });
    return { ok: true, output: { provider: "ms365", senderMode: personal ? "personal" : "system",
      countryCode: country || null, toCount: recipients.to.length, ccCount: recipients.cc.length,
      bccCount: recipients.bcc.length, sentCount: recipients.count } };
  } catch (error) {
    // Never include provider response bodies, tokens or recipient identities.
    const message = error instanceof Error ? error.message : "";
    const safe = /^(Invalid |Unknown |Email |System |Personal |Inbound |The |A recipient |At least |Connect |Reconnect |Configured |Some |Task group |Role )/.test(message);
    return { ok: false, error: safe ? message : "Configured email could not be sent" };
  }
}
