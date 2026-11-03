import type { Request, Response } from "express";
import {
  sendEmailSchema, type Customer, type CommunicationMessage, type InsertCommunicationMessage,
} from "../../shared/schema";

type Dependencies = {
  storage: {
    getCustomer(id: string): Promise<Pick<Customer, "email" | "firstName" | "lastName"> | undefined>;
    createCommunicationMessage(data: InsertCommunicationMessage): Promise<CommunicationMessage>;
    updateCommunicationMessage(id: string, data: Partial<CommunicationMessage>): Promise<CommunicationMessage | undefined>;
  };
  config: () => { apiKey?: string; fromEmail?: string };
  resolveContext?: (req: Request) => Promise<Partial<InsertCommunicationMessage>>;
  fetch: typeof fetch;
  logActivity: (
    userId: string, action: string, entityType: string, entityId: string,
    entityName: string, details: object,
  ) => Promise<void>;
};

/** No demo transport: only provider acceptance may produce a new sent record. */
export function createCustomerEmailHandler(deps: Dependencies) {
  return async (req: Request, res: Response) => {
    try {
      let context: Partial<InsertCommunicationMessage> = { campaignId: null };
      if (deps.resolveContext) {
        try { context = await deps.resolveContext(req); }
        catch { return res.status(403).json({ error: "invalid_mission_email_context" }); }
      }
      const parsed = sendEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }
      const { subject, content } = parsed.data;
      const customer = await deps.storage.getCustomer(req.params.customerId);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      if (!customer.email) return res.status(400).json({ error: "Customer has no email address" });

      const { apiKey, fromEmail } = deps.config();
      if (!apiKey?.trim()) {
        // Refuse before creating a message: there was no transport attempt.
        return res.status(503).json({
          code: "EMAIL_PROVIDER_NOT_CONFIGURED",
          error: "Email was not sent: email provider is not configured.",
        });
      }

      const user = req.session.user!;
      const message = await deps.storage.createCommunicationMessage({
        ...context,
        provider: "sendgrid",
        customerId: req.params.customerId,
        userId: user.id,
        type: "email",
        subject,
        content,
        recipientEmail: customer.email,
        status: "pending",
      });

      let response: globalThis.Response;
      try {
        response = await deps.fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: customer.email }] }],
            from: { email: fromEmail || "noreply@nexusbiolink.com" },
            subject,
            content: [{ type: "text/plain", value: content }],
          }),
        });
      } catch {
        // Raw transport errors may contain credentials or recipient information.
        await deps.storage.updateCommunicationMessage(message.id, {
          status: "failed",
          errorMessage: "Email provider network request failed; acceptance was not confirmed.",
        });
        return res.status(502).json({
          code: "EMAIL_PROVIDER_NETWORK_ERROR",
          error: "Email sending could not be confirmed: email provider could not be reached.",
        });
      }

      if (!response.ok) {
        await deps.storage.updateCommunicationMessage(message.id, {
          status: "failed",
          errorMessage: `Email provider rejected the request (HTTP ${response.status}).`,
        });
        return res.status(502).json({
          code: "EMAIL_PROVIDER_REJECTED",
          error: "Email was not sent: email provider rejected the request.",
        });
      }

      const sentAt = new Date();
      await deps.storage.updateCommunicationMessage(message.id, { status: "sent", sentAt });
      await deps.logActivity(
        user.id, "send_email", "communication", message.id,
        `Email to ${customer.firstName} ${customer.lastName}`, { subject },
      );
      return res.json({ ...message, status: "sent", sentAt });
    } catch {
      console.error("Customer email sending failed");
      return res.status(500).json({ error: "Failed to send email" });
    }
  };
}
