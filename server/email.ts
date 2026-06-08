import nodemailer from "nodemailer";

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
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const SMTP_SECURE = process.env.SMTP_SECURE === "true";

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
    }
  }

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        tls: { rejectUnauthorized: false },
      });

      await transporter.sendMail({
        from: `INDEXUS CRM <${EMAIL_FROM}>`,
        to,
        subject,
        html,
      });

      console.log(`[Email] Sent via SMTP to ${to}: ${subject}`);
      return true;
    } catch (error) {
      console.error("[Email] SMTP exception:", error instanceof Error ? error.message : error);
      return false;
    }
  }

  console.warn("[Email] No transport configured — set SMTP_HOST+SMTP_USER+SMTP_PASS or SENDGRID_API_KEY");
  console.log(`[Email Simulation] To: ${to} | Subject: ${subject}`);
  return false;
}
