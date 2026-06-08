interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { to, subject, html, from } = options;

  const EMAIL_FROM = from || process.env.EMAIL_FROM || "noreply@indexus.sk";

  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

  if (SENDGRID_API_KEY) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: EMAIL_FROM },
          subject,
          content: [{ type: "text/html", value: html }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Email] SendGrid error:", errorText);
        return false;
      }

      console.log(`[Email] Sent via SendGrid to ${to}: ${subject}`);
      return true;
    } catch (error) {
      console.error("[Email] SendGrid exception:", error instanceof Error ? error.message : error);
      return false;
    }
  }

  console.warn("[Email] No email transport configured — use M365 system connection or set SENDGRID_API_KEY");
  console.log(`[Email Simulation] To: ${to} | Subject: ${subject}`);
  console.log(`[Email Simulation] Body preview: ${html.substring(0, 200)}...`);
  return false;
}
