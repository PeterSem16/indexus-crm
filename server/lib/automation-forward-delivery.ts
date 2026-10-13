import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { taskGroups, users } from "../../shared/schema";
import { forwardActionIssues, type ForwardConfig } from "../../shared/automation-forward-action";
import { loadAnalysisSource, listSourceAttachments, mailboxRequest, type AnalysisSource } from "./automation-analysis-source";
import { originalEmailBytes, saveForwardedFile, MAX_FORWARDED_BYTES } from "./automation-forward-source";
import { deliverAutomationEmail } from "./automation-email-delivery";
import { forwardedMessageContent, literalForwardHtml } from "./automation-forward-content";

type ActionResult = { ok: boolean; output?: any; error?: string };
type TaskDelivery = (config: any, ctx: any, runId: string) => Promise<ActionResult>;
type ForwardServices = {
  source: typeof loadAnalysisSource; original: typeof originalEmailBytes; attachments: typeof listSourceAttachments;
  attachment: typeof mailboxRequest; save: typeof saveForwardedFile; email: typeof deliverAutomationEmail;
  verifyUser: (id: string) => Promise<void>; verifyGroup: (id: string) => Promise<void>;
};
const services: ForwardServices = {
  source: loadAnalysisSource, original: originalEmailBytes, attachments: listSourceAttachments,
  attachment: mailboxRequest, save: saveForwardedFile, email: deliverAutomationEmail,
  verifyUser: async id => {
    const [user] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, id), eq(users.isActive, true)));
    if (!user) throw new Error("forward_recipient_unavailable");
  },
  verifyGroup: async id => {
    const [group] = await db.select({ id: taskGroups.id }).from(taskGroups)
      .where(and(eq(taskGroups.id, id), eq(taskGroups.isBackOffice, true)));
    if (!group) throw new Error("forward_back_office_unavailable");
  },
};
export async function deliverForwardCommunication(config: ForwardConfig, ctx: any, runId: string, taskDelivery: TaskDelivery,
  dependencies: ForwardServices = services): Promise<ActionResult> {
  try {
    if (forwardActionIssues(config).length) throw new Error("forward_invalid_configuration");
    const source = await dependencies.source(ctx.rule, ctx.event);
    if (!source || !["email", "sms"].includes(source.channel) || source.communication.id !== ctx.communication?.id)
      throw new Error("forward_source_not_eligible");
    if (config.mode === "attachments" && source.channel !== "email") throw new Error("forward_sms_has_no_attachments");
    if (config.destination === "user") {
      await dependencies.verifyUser(config.userId!);
    }
    if (config.destination === "back_office") {
      await dependencies.verifyGroup(config.taskGroupId!);
    }
    const files: { name: string; type: string; bytes: Buffer }[] = [];
    if (source.channel === "email") {
      if (config.mode === "whole") {
        // RFC822 retains the complete original message, headers and ALL its attachments.
        files.push({ name: "original-email.eml", type: "message/rfc822", bytes: await dependencies.original(source) });
      }
      {
        const available = await dependencies.attachments(source);
        const invoiceIds = new Set((ctx.analysis?.attachments || [])
          .filter((item: any) => item.classification === "invoice" && typeof item.sourceAttachmentId === "string")
          .map((item: any) => item.sourceAttachmentId));
        // Whole-message mode always includes every regular attachment separately
        // as well as the untouched archive, irrespective of attachment selection.
        const selected = config.mode === "attachments" && config.selection === "invoice"
          ? available.filter(item => invoiceIds.has(item.id)) : available;
        if (!selected.length && config.mode === "attachments") throw new Error("forward_no_matching_attachments");
        if (selected.length + files.length > 5) throw new Error("forward_attachment_limit");
        let total = files.reduce((sum, file) => sum + file.bytes.length, 0);
        if (total > MAX_FORWARDED_BYTES || files.some(file => file.bytes.length > 10 * 1024 * 1024))
          throw new Error("forward_attachment_limit");
        for (const item of selected) {
          const attachment = item.contentBytes ? item : await dependencies.attachment(source, `/attachments/${encodeURIComponent(item.id)}`);
          const encoded = attachment.contentBytes;
          if (typeof encoded !== "string" || encoded.length > MAX_FORWARDED_BYTES * 1.4) throw new Error("forward_attachment_unavailable");
          const bytes = Buffer.from(encoded, "base64");
          total += bytes.length;
          if (!bytes.length || total > MAX_FORWARDED_BYTES || bytes.length > 10 * 1024 * 1024) throw new Error("forward_attachment_limit");
          files.push({ name: String(item.name || "attachment"), type: String(item.contentType || "application/octet-stream"), bytes });
        }
      }
    } else if (config.destination !== "email") {
      files.push({ name: "original-sms.txt", type: "text/plain", bytes: Buffer.from(source.text, "utf8") });
    }
    const subject = source.channel === "email" ? String(source.communication.subject || "Email") : "SMS";
    const title = config.title?.trim() || `Fwd: ${subject}`;
    const content = forwardedMessageContent(String(config.mode === "whole" ? source.text : subject), source.channel);
    if (config.destination === "email") {
      const result = await dependencies.email({ emailActionVersion: 2, senderMode: "personal",
        to: config.to, subject: "{{forwarded.subject}}", body: literalForwardHtml(content.html),
        attachments: files.map(file => ({ name: file.name, contentType: file.type, contentBase64: file.bytes.toString("base64") })) },
        { ...ctx, forwarded: { subject: title } });
      return result.ok ? { ...result, output: { ...result.output, forwardedChannel: source.channel,
        mode: config.mode, attachmentCount: files.length } } : result;
    }
    const owner = ctx.rule.createdByUserId;
    const attachments = await Promise.all(files.map(file => dependencies.save(owner, file)));
    const forwardedContext = { ...ctx, analysis: { ...ctx.analysis,
      attachments: attachments.map(attachment => ({ ...attachment, classification: "other" })) } };
    // Reuse the complete existing Task authorization, country, group and private attachment transaction.
    // Do not interpret template tokens from untrusted source text as automation instructions.
    const literalText = content.text.replace(/\{\{/g, "{\u200b{");
    const result = await taskDelivery({ title: title.replace(/\{\{/g, "{\u200b{"), description: literalText,
      analysisAttachments: "all", priority: ctx.analysis?.isUrgent === true ? "high" : "medium",
      ...(config.destination === "user" ? { assignedUserId: config.userId } : { taskGroupId: config.taskGroupId }) }, forwardedContext, runId);
    return result.ok ? { ...result, output: { ...result.output, forwardedChannel: source.channel,
      mode: config.mode, attachmentCount: attachments.length, destination: config.destination } } : result;
  } catch (error) {
    const code = error instanceof Error && /^forward_[a-z_]+$/.test(error.message) ? error.message : "forward_failed";
    return { ok: false, error: code };
  }
}
