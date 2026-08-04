/**
 * Beratung Email Monitor Service
 * Reads beratung@cordbloodcenter.com inbox via Microsoft Graph API,
 * translates emails + PDF attachments to CS+SK via OpenAI,
 * and forwards them to configured recipients.
 */

import { pool } from "../db";
import { encryptTokenWithMarker, decryptTokenSafe } from "./token-crypto";
import { createGraphClient, getValidAccessToken } from "./ms365";

const BERATUNG_EMAIL = process.env.BERATUNG_EMAIL || "beratung@cordbloodcenter.com";
const CHECK_INTERVAL_MS = 3 * 60_000; // 3 minutes

// ─── Activity logging ────────────────────────────────────────────────────────

export async function logBeratungActivity(
  action: "forwarded" | "analyzed" | "reanalyzed" | "fetched",
  opts: { emailId?: string; subject?: string; mode?: "manual" | "auto"; userId?: string; detail?: string }
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO beratung_activity_log (action, mode, email_id, email_subject, actor_user_id, detail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [action, opts.mode || "manual", opts.emailId || null, opts.subject || null, opts.userId || null, opts.detail || null]
    );
  } catch { /* non-critical */ }
}

// ─── Token acquisition (ROPC flow) ──────────────────────────────────────────

export async function acquireBeratungTokenROPC(overridePassword?: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresOn: Date;
} | null> {
  const tenantId = process.env.MS365_TENANT_ID;
  const clientId = process.env.MS365_CLIENT_ID;
  const clientSecret = process.env.MS365_CLIENT_SECRET;

  // Password priority: 1) override from request, 2) DB stored, 3) env var
  let password = overridePassword;
  if (!password) {
    try {
      const row = await pool.query(`SELECT beratung_password FROM beratung_monitor_settings WHERE id = 1`);
      const encrypted = row.rows[0]?.beratung_password;
      if (encrypted) password = decryptTokenSafe(encrypted);
    } catch { /* fall through to env var */ }
  }
  if (!password) password = process.env.BERATUNG_PASSWORD;

  if (!tenantId || !clientId || !clientSecret || !password) {
    console.warn("[Beratung] ROPC: missing credentials (MS365_TENANT_ID, MS365_CLIENT_ID, MS365_CLIENT_SECRET + password via UI/env)");
    return null;
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "password",
    username: BERATUNG_EMAIL,
    password,
    scope: "https://graph.microsoft.com/.default offline_access",
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("[Beratung] ROPC token acquisition failed:", err.error_description || err.error);
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresOn: new Date(Date.now() + data.expires_in * 1000),
    };
  } catch (err) {
    console.error("[Beratung] ROPC error:", err);
    return null;
  }
}

// ─── Settings helpers ────────────────────────────────────────────────────────

async function getSettings() {
  const { rows } = await pool.query(`
    SELECT id, forward_to, auto_process, last_checked_at,
           token_access, token_refresh, token_expires_at,
           sender_filters
    FROM beratung_monitor_settings LIMIT 1
  `);
  return rows[0] || null;
}

async function saveSettings(patch: {
  forward_to?: string[];
  auto_process?: boolean;
  sender_filters?: string[];
  last_checked_at?: Date;
  token_access?: string;
  token_refresh?: string;
  token_expires_at?: Date | null;
}) {
  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (patch.forward_to !== undefined) { sets.push(`forward_to = $${idx++}`); vals.push(patch.forward_to); }
  if (patch.auto_process !== undefined) { sets.push(`auto_process = $${idx++}`); vals.push(patch.auto_process); }
  if (patch.sender_filters !== undefined) { sets.push(`sender_filters = $${idx++}`); vals.push(patch.sender_filters); }
  if (patch.last_checked_at !== undefined) { sets.push(`last_checked_at = $${idx++}`); vals.push(patch.last_checked_at); }
  if (patch.token_access !== undefined) { sets.push(`token_access = $${idx++}`); vals.push(patch.token_access); }
  if (patch.token_refresh !== undefined) { sets.push(`token_refresh = $${idx++}`); vals.push(patch.token_refresh); }
  if ("token_expires_at" in patch) { sets.push(`token_expires_at = $${idx++}`); vals.push(patch.token_expires_at ?? null); }

  if (sets.length === 0) return;
  sets.push(`updated_at = now()`);

  await pool.query(
    `INSERT INTO beratung_monitor_settings (id, forward_to, auto_process, updated_at)
       VALUES (1, ARRAY[]::text[], false, now())
     ON CONFLICT (id) DO UPDATE SET ${sets.join(", ")}`,
    vals
  );
}

// ─── Access token management ─────────────────────────────────────────────────

export async function getBeratungAccessToken(): Promise<string | null> {
  const settings = await getSettings();

  if (settings?.token_access && settings?.token_expires_at) {
    let decrypted: string;
    let decryptedRefresh: string | null = null;
    try {
      decrypted = decryptTokenSafe(settings.token_access);
      decryptedRefresh = settings.token_refresh ? decryptTokenSafe(settings.token_refresh) : null;
    } catch {
      // tokens corrupted – re-acquire
      return await reacquireAndStore();
    }

    const result = await getValidAccessToken(decrypted, settings.token_expires_at, decryptedRefresh);
    if (result?.accessToken) {
      if (result.refreshed) {
        await saveSettings({
          token_access: encryptTokenWithMarker(result.accessToken),
          token_refresh: result.refreshToken ? encryptTokenWithMarker(result.refreshToken) : undefined,
          token_expires_at: result.expiresOn,
        });
      }
      return result.accessToken;
    }
  }

  return await reacquireAndStore();
}

async function reacquireAndStore(): Promise<string | null> {
  const fresh = await acquireBeratungTokenROPC();
  if (!fresh) return null;

  await saveSettings({
    token_access: encryptTokenWithMarker(fresh.accessToken),
    token_refresh: encryptTokenWithMarker(fresh.refreshToken),
    token_expires_at: fresh.expiresOn,
  });

  return fresh.accessToken;
}

// ─── Fetch new emails ────────────────────────────────────────────────────────

export async function fetchNewBeratungEmails(): Promise<number> {
  const accessToken = await getBeratungAccessToken();
  if (!accessToken) {
    console.warn("[Beratung] Cannot fetch emails — no valid access token");
    return 0;
  }

  const client = createGraphClient(accessToken);
  let messages: any[] = [];

  try {
    const result = await client
      .api(`/users/${BERATUNG_EMAIL}/mailFolders/inbox/messages`)
      .select("id,subject,from,receivedDateTime,isRead,bodyPreview,body,conversationId,hasAttachments")
      .orderby("receivedDateTime desc")
      .top(50)
      .get();
    messages = result?.value || [];
  } catch (err: any) {
    console.error("[Beratung] Failed to fetch messages:", err?.message);
    return 0;
  }

  let inserted = 0;
  for (const msg of messages) {
    const graphId = msg.id;
    if (!graphId) continue;

    // Deduplicate
    const { rows: existing } = await pool.query(
      `SELECT id FROM beratung_inbox_emails WHERE graph_message_id = $1 LIMIT 1`,
      [graphId]
    );
    if (existing.length > 0) continue;

    const fromAddr = msg.from?.emailAddress?.address || "";
    const fromName = msg.from?.emailAddress?.name || fromAddr;
    const receivedAt = msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date();
    const bodyHtml = msg.body?.contentType?.toLowerCase().includes("html") ? msg.body?.content || "" : null;
    const bodyText = msg.body?.contentType?.toLowerCase() === "text" ? msg.body?.content || "" : (msg.bodyPreview || "");
    const hasAttachments = msg.hasAttachments || false;

    await pool.query(
      `INSERT INTO beratung_inbox_emails
         (graph_message_id, subject, from_address, from_name, received_at, body_html, body_text, has_attachments, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new')
       ON CONFLICT (graph_message_id) DO NOTHING`,
      [graphId, msg.subject || "(bez predmetu)", fromAddr, fromName, receivedAt, bodyHtml, bodyText, hasAttachments]
    );
    inserted++;
  }

  await saveSettings({ last_checked_at: new Date() });
  if (inserted > 0) console.log(`[Beratung] Inserted ${inserted} new emails`);
  return inserted;
}

// ─── Audio MIME types (voicemail / A1 Mobilbox) ──────────────────────────────

const AUDIO_EXTENSIONS = new Set([".mp3", ".mp4", ".m4a", ".wav", ".ogg", ".opus", ".amr", ".aac", ".flac", ".webm"]);

function isAudioAttachment(contentType: string, name: string): boolean {
  if (contentType.startsWith("audio/")) return true;
  if (contentType === "video/mp4" && name.toLowerCase().endsWith(".m4a")) return true;
  const ext = name.toLowerCase().substring(name.lastIndexOf("."));
  return AUDIO_EXTENSIONS.has(ext);
}

async function transcribeAudio(buf: Buffer, filename: string): Promise<string> {
  try {
    const openai = await import("openai");
    const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY });

    // Determine extension for the File object
    const ext = filename.toLowerCase().substring(filename.lastIndexOf(".") + 1) || "mp3";
    const mimeMap: Record<string, string> = {
      mp3: "audio/mpeg", mp4: "audio/mp4", m4a: "audio/mp4",
      wav: "audio/wav", ogg: "audio/ogg", opus: "audio/opus",
      amr: "audio/amr", aac: "audio/aac", flac: "audio/flac", webm: "audio/webm",
    };
    const mime = mimeMap[ext] || "audio/mpeg";

    const { toFile } = await import("openai");
    const file = await toFile(buf, filename, { type: mime });

    const resp = await client.audio.transcriptions.create({
      model: "whisper-1",
      file,
      response_format: "text",
    });
    return typeof resp === "string" ? resp : (resp as any).text || "";
  } catch (err: any) {
    console.warn("[Beratung] Whisper transcription error:", err?.message);
    return "";
  }
}

/** AI short summary of a voicemail transcript (Slovak, 2-3 sentences) */
async function analyzeVoicemail(transcript: string): Promise<string> {
  if (!transcript || transcript.length < 10) return "";
  try {
    const openai = await import("openai");
    const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Si asistent, ktorý analyzuje prepisy hlasových správ. Napíš krátke zhrnutie (2-3 vety) v slovenčine: kto volá, čo chce alebo oznamuje, aká je požadovaná akcia. Buď stručný a konkrétny.",
        },
        { role: "user", content: transcript.substring(0, 4000) },
      ],
      max_tokens: 250,
      temperature: 0.3,
    });
    return resp.choices[0]?.message?.content?.trim() || "";
  } catch (err: any) {
    console.warn("[Beratung] Voicemail AI analysis error:", err?.message);
    return "";
  }
}

// ─── Attachment extraction (PDF text + audio transcription) ──────────────────

type AttachmentResult = {
  name: string;
  contentBase64: string;
  contentType: string;
  textContent: string;
  isAudio: boolean;
  transcription: string;
  aiSummary: string;
};

async function fetchAndExtractAttachments(
  accessToken: string,
  graphMessageId: string
): Promise<AttachmentResult[]> {
  const client = createGraphClient(accessToken);
  let rawAttachments: any[] = [];

  try {
    const res = await client
      .api(`/users/${BERATUNG_EMAIL}/messages/${graphMessageId}/attachments`)
      .get();
    rawAttachments = res?.value || [];
  } catch (err: any) {
    console.warn("[Beratung] Could not fetch attachments:", err?.message);
    return [];
  }

  const result: AttachmentResult[] = [];

  for (const att of rawAttachments) {
    if (!att.contentBytes) continue;
    const contentType: string = att.contentType || "application/octet-stream";
    const name: string = att.name || "attachment";
    let textContent = "";
    let transcription = "";
    let aiSummary = "";
    const audio = isAudioAttachment(contentType, name);

    if (audio) {
      const buf = Buffer.from(att.contentBytes, "base64");
      transcription = await transcribeAudio(buf, name);
      // Run AI analysis right after Whisper transcription
      if (transcription) {
        aiSummary = await analyzeVoicemail(transcription);
      }
      textContent = transcription
        ? `[Hlasová správa — prepis]:\n${transcription}${aiSummary ? `\n\n[Zhrnutie AI]:\n${aiSummary}` : ""}`
        : "";
      console.log(`[Beratung] Audio transcribed: ${name} (${buf.length} bytes, ${transcription.length} chars), AI summary: ${aiSummary.length} chars`);
    } else if (contentType === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
      try {
        const pdfParse = await import("pdf-parse");
        const buf = Buffer.from(att.contentBytes, "base64");
        const parsed = await pdfParse.default(buf);
        textContent = parsed.text || "";
      } catch (pdfErr) {
        console.warn("[Beratung] PDF parse error:", pdfErr);
      }
    }

    result.push({ name, contentBase64: att.contentBytes, contentType, textContent, isAudio: audio, transcription, aiSummary });
  }

  return result;
}

// ─── Translation via OpenAI ───────────────────────────────────────────────────

async function translateToLanguage(text: string, targetLang: "SK" | "CS"): Promise<string> {
  const openai = await import("openai");
  const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY });

  const langName = targetLang === "SK" ? "Slovak" : "Czech";
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a professional translator. Translate the following text to ${langName}. Preserve formatting (paragraphs, line breaks). Return only the translated text, no explanations.`,
      },
      { role: "user", content: text.substring(0, 8000) },
    ],
    max_tokens: 2000,
    temperature: 0.2,
  });

  return response.choices[0]?.message?.content || "";
}

export async function translateBeratungEmail(emailId: string, force = false): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT id, graph_message_id, body_html, body_text, has_attachments, status
     FROM beratung_inbox_emails WHERE id = $1 LIMIT 1`,
    [emailId]
  );
  const row = rows[0];
  if (!row) return false;
  if (!force && (row.status === "translated" || row.status === "forwarded")) return true;

  const accessToken = await getBeratungAccessToken();
  if (!accessToken) {
    console.error(`[Beratung] Email ${emailId}: cannot translate — no access token (try Settings → Reconnect)`);
    return false;
  }

  // Extract readable text (strip HTML tags for translation)
  const rawText = row.body_text || (row.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!rawText || rawText.length < 5) {
    console.warn(`[Beratung] Email ${emailId}: body text too short (${rawText?.length ?? 0} chars), skipping`);
    return false;
  }

  // Fetch attachments if any
  let attachments: AttachmentResult[] = [];
  if (row.has_attachments) {
    try {
      attachments = await fetchAndExtractAttachments(accessToken, row.graph_message_id);
      console.log(`[Beratung] Email ${emailId}: fetched ${attachments.length} attachments (audio: ${attachments.filter(a => a.isAudio).length})`);
    } catch (attErr: any) {
      console.warn(`[Beratung] Email ${emailId}: attachment fetch error:`, attErr?.message);
    }
  }

  // Build full text to translate (body + attachment texts)
  const attachmentTexts = attachments
    .filter(a => a.textContent)
    .map(a => `\n\n--- Príloha: ${a.name} ---\n${a.textContent}`)
    .join("");
  const fullText = rawText + attachmentTexts;

  let translatedCs = "";
  let translatedSk = "";
  const attachmentSummaries: Array<{ name: string; contentType: string; hasText: boolean }> = [];

  try {
    [translatedSk, translatedCs] = await Promise.all([
      translateToLanguage(fullText, "SK"),
      translateToLanguage(fullText, "CS"),
    ]);
  } catch (err) {
    console.error("[Beratung] Translation error:", err);
    return false;
  }

  for (const att of attachments) {
    attachmentSummaries.push({
      name: att.name,
      contentType: att.contentType,
      hasText: !!att.textContent,
      isAudio: att.isAudio,
      transcription: att.transcription || null,
      aiSummary: att.aiSummary || null,
    });
  }

  // Store attachment data for forwarding (base64 in JSONB)
  const attachmentData = attachments.map(a => ({
    name: a.name,
    contentType: a.contentType,
    contentBase64: a.contentBase64,
    hasText: !!a.textContent,
    isAudio: a.isAudio,
  }));

  // Collect all audio transcriptions into one field for easy display
  const audioTranscription = attachments
    .filter(a => a.isAudio && a.transcription)
    .map(a => `[${a.name}]:\n${a.transcription}`)
    .join("\n\n") || null;

  await pool.query(
    `UPDATE beratung_inbox_emails
       SET translated_cs = $2, translated_sk = $3,
           attachment_count = $4, attachment_summaries = $5::jsonb,
           attachment_data = $6::jsonb, audio_transcription = $7,
           status = 'translated', updated_at = now()
     WHERE id = $1`,
    [emailId, translatedCs, translatedSk, attachments.length,
      JSON.stringify(attachmentSummaries), JSON.stringify(attachmentData),
      audioTranscription]
  );

  console.log(`[Beratung] Email ${emailId} translated (CS+SK)`);
  return true;
}

// ─── Re-analyze (force) ───────────────────────────────────────────────────────

/** Force-reprocess an email: reset to 'new' then fully re-translate + re-transcribe attachments */
export async function reanalyzeBeratungEmail(emailId: string): Promise<boolean> {
  // Reset so translateBeratungEmail re-runs even for already-processed emails
  await pool.query(
    `UPDATE beratung_inbox_emails
       SET status = 'new', translated_sk = NULL, translated_cs = NULL,
           audio_transcription = NULL, attachment_summaries = NULL,
           attachment_data = NULL, updated_at = now()
     WHERE id = $1`,
    [emailId]
  );
  console.log(`[Beratung] Reanalyzing email ${emailId} (force reset to new)`);
  return translateBeratungEmail(emailId, true);
}

// ─── Forward email ───────────────────────────────────────────────────────────

export async function forwardBeratungEmail(
  emailId: string,
  opts?: { mode?: "manual" | "auto"; userId?: string }
): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT id, subject, from_address, from_name, received_at,
            body_html, body_text, translated_cs, translated_sk,
            attachment_data, attachment_summaries, audio_transcription, status
     FROM beratung_inbox_emails WHERE id = $1 LIMIT 1`,
    [emailId]
  );
  const row = rows[0];
  if (!row) return false;
  if (row.status === "forwarded") return true;

  if (!row.translated_cs || !row.translated_sk) {
    const ok = await translateBeratungEmail(emailId);
    if (!ok) return false;
    return forwardBeratungEmail(emailId); // retry after translation
  }

  const settings = await getSettings();
  const forwardTo: string[] = settings?.forward_to || [];
  if (forwardTo.length === 0) {
    console.warn("[Beratung] No forward_to recipients configured");
    return false;
  }

  const accessToken = await getBeratungAccessToken();
  if (!accessToken) return false;

  const { sendEmail } = await import("./ms365");

  const rawBody = row.body_text || (row.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const receivedStr = row.received_at
    ? new Date(row.received_at).toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" })
    : "";

  // Build voicemail section if audio transcription exists
  const attSummaries: Array<{ name: string; isAudio?: boolean; transcription?: string; aiSummary?: string }> =
    row.attachment_summaries
      ? (typeof row.attachment_summaries === "string" ? JSON.parse(row.attachment_summaries) : row.attachment_summaries)
      : [];

  const audioAtts = attSummaries.filter(a => a.isAudio && (a.transcription || a.aiSummary));

  // Collapse 3+ consecutive blank lines → single blank line (A1/carrier emails have lots of whitespace)
  const compactText = (t: string) => t.replace(/(\r?\n){3,}/g, "\n\n").trim();
  const renderText = (t: string) => escapeHtml(compactText(t)).replace(/\n/g, "<br>");

  // ── Variant B — Clinical ────────────────────────────────────────────────────

  // AI analysis block — teal card with ix badge
  const aiSummaryBlock = audioAtts.some(a => a.aiSummary)
    ? audioAtts.filter(a => a.aiSummary).map(a => `
  <!-- AI ANALYSIS -->
  <tr><td style="padding:16px 24px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdfa;border:1.5px solid #5eead4;border-radius:10px;overflow:hidden;">
      <tr><td style="padding:10px 16px;border-bottom:1px solid #ccfbf1;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;padding-right:8px;">
            <div style="width:22px;height:22px;background:linear-gradient(135deg,#0d9488,#0891b2);border-radius:5px;text-align:center;line-height:22px;font-size:8px;font-weight:900;color:#fff;letter-spacing:-0.3px;">ix</div>
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:9.5px;font-weight:800;color:#0d9488;text-transform:uppercase;letter-spacing:0.8px;">Anal&yacute;za hlasovej spr&aacute;vy</span>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:12px 16px;font-size:13px;line-height:1.65;color:#134e4a;">${escapeHtml(a.aiSummary!).replace(/\n/g, "<br>")}</td></tr>
    </table>
  </td></tr>`).join("")
    : "";

  // Transcript block — amber card
  const transcriptBlock = audioAtts.some(a => a.transcription)
    ? audioAtts.filter(a => a.transcription).map(a => `
  <!-- TRANSCRIPT -->
  <tr><td style="padding:12px 24px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fde68a;border-radius:10px;overflow:hidden;">
      <tr><td style="background:#fefce8;padding:8px 14px;border-bottom:1px solid #fde68a;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;padding-right:8px;">
            <div style="width:6px;height:6px;background:#f59e0b;border-radius:50%;"></div>
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:9.5px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.7px;">Prepis hlasovej spr&aacute;vy</span>
            <span style="font-size:9px;color:#d97706;margin-left:8px;">${escapeHtml(a.name)}</span>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:12px 16px;font-size:12.5px;line-height:1.65;color:#78350f;">${renderText(a.transcription!)}</td></tr>
    </table>
  </td></tr>`).join("")
    : "";

  // Audio file row for meta grid (shown only when voicemail attachments present)
  const audioFileRows = audioAtts.length > 0
    ? audioAtts.map(a => `
      <tr><td style="padding:9px 16px 9px 0;border-bottom:1px solid #f0faf9;width:70px;vertical-align:top;">
        <span style="font-size:9.5px;font-weight:700;color:#5eead4;text-transform:uppercase;letter-spacing:0.6px;white-space:nowrap;">S&uacute;bor</span>
      </td>
      <td style="padding:9px 0;border-bottom:1px solid #f0faf9;font-size:12px;font-weight:600;color:#0f172a;">${escapeHtml(a.name)}</td></tr>`).join("")
    : "";

  const forwardedAt = new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const emailBody = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#ecfdf5;font-family:'Segoe UI',system-ui,-apple-system,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ecfdf5;">
<tr><td align="center" style="padding:28px 12px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 20px rgba(0,180,120,0.10);">

  <!-- HEADER — teal gradient -->
  <tr><td style="background:linear-gradient(135deg,#0d9488 0%,#0891b2 100%);padding:22px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;padding-right:12px;">
            <div style="width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:10px;border:1.5px solid rgba(255,255,255,0.3);text-align:center;line-height:40px;font-size:11px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">ix</div>
          </td>
          <td style="vertical-align:middle;">
            <div style="font-size:16px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">indexus</div>
            <div style="font-size:10px;font-weight:500;color:rgba(255,255,255,0.65);letter-spacing:0.4px;margin-top:1px;">BERATUNG MONITOR</div>
          </td>
        </tr></table>
      </td>
      <td align="right" style="vertical-align:middle;">
        <div style="font-size:9.5px;font-weight:700;color:#a7f3d0;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:3px;">Status</div>
        <div style="display:inline-block;font-size:11px;font-weight:700;color:#ffffff;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);padding:3px 12px;border-radius:20px;">&#10003; Preposlané</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- SUBJECT BANNER -->
  <tr><td style="background:#f0fdfa;border-bottom:1px solid #ccfbf1;padding:14px 28px;">
    <div style="font-size:9.5px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:5px;">Predmet správy</div>
    <div style="font-size:16px;font-weight:700;color:#0f172a;line-height:1.35;">${escapeHtml(row.subject || "(bez predmetu)")}</div>
  </td></tr>

  <!-- META GRID -->
  <tr><td style="padding:4px 28px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:9px 16px 9px 0;border-bottom:1px solid #f0faf9;width:70px;vertical-align:top;">
          <span style="font-size:9.5px;font-weight:700;color:#5eead4;text-transform:uppercase;letter-spacing:0.6px;white-space:nowrap;">Od</span>
        </td>
        <td style="padding:9px 0;border-bottom:1px solid #f0faf9;">
          <span style="font-size:13px;font-weight:700;color:#0f172a;">${escapeHtml(row.from_name || row.from_address)}</span>
          ${row.from_name ? `<span style="font-size:11px;font-weight:400;color:#64748b;margin-left:8px;">${escapeHtml(row.from_address)}</span>` : ""}
        </td>
      </tr>
      <tr>
        <td style="padding:9px 16px 9px 0;border-bottom:1px solid #f0faf9;vertical-align:top;">
          <span style="font-size:9.5px;font-weight:700;color:#5eead4;text-transform:uppercase;letter-spacing:0.6px;white-space:nowrap;">Prijaté</span>
        </td>
        <td style="padding:9px 0;border-bottom:1px solid #f0faf9;font-size:12.5px;font-weight:600;color:#0f172a;">${receivedStr}</td>
      </tr>
      ${audioFileRows}
    </table>
  </td></tr>

  ${aiSummaryBlock}
  ${transcriptBlock}

  <!-- TRANSLATIONS LABEL -->
  <tr><td style="padding:20px 28px 8px;">
    <span style="font-size:9.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;">Preklady</span>
  </td></tr>

  <!-- TRANSLATIONS — unified bordered card -->
  <tr><td style="padding:0 28px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">

      <!-- DE row -->
      <tr><td style="background:#f8fafc;padding:8px 16px;border-bottom:1px solid #e2e8f0;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;padding-right:8px;font-size:15px;">&#127465;&#127466;</td>
          <td style="vertical-align:middle;padding-right:6px;">
            <span style="font-size:10.5px;font-weight:700;color:#475569;">DE</span>
          </td>
          <td style="vertical-align:middle;padding-right:6px;">
            <span style="font-size:10px;color:#94a3b8;">&middot;</span>
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:10.5px;color:#64748b;">Originál &middot; Nemčina</span>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:10px 16px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;line-height:1.65;color:#475569;font-style:italic;">${renderText(rawBody)}</td></tr>

      <!-- SK row -->
      <tr><td style="background:#faf5ff;padding:8px 16px;border-bottom:1px solid #e2e8f0;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;padding-right:8px;font-size:15px;">&#127480;&#127472;</td>
          <td style="vertical-align:middle;padding-right:6px;">
            <span style="font-size:10.5px;font-weight:700;color:#7c3aed;">SK</span>
          </td>
          <td style="vertical-align:middle;padding-right:6px;">
            <span style="font-size:10px;color:#94a3b8;">&middot;</span>
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:10.5px;color:#64748b;">Slovenčina</span>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:10px 16px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;line-height:1.65;color:#334155;">${renderText(row.translated_sk || "")}</td></tr>

      <!-- CS row -->
      <tr><td style="background:#eff6ff;padding:8px 16px;border-bottom:1px solid #e2e8f0;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;padding-right:8px;font-size:15px;">&#127464;&#127487;</td>
          <td style="vertical-align:middle;padding-right:6px;">
            <span style="font-size:10.5px;font-weight:700;color:#0369a1;">CS</span>
          </td>
          <td style="vertical-align:middle;padding-right:6px;">
            <span style="font-size:10px;color:#94a3b8;">&middot;</span>
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:10.5px;color:#64748b;">Čeština</span>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:10px 16px 12px;font-size:12px;line-height:1.65;color:#334155;">${renderText(row.translated_cs || "")}</td></tr>

    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:12px 28px 16px;border-top:2px solid #f0fdfa;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:10px;color:#94a3b8;">
        <span style="font-weight:700;color:#64748b;">indexus</span> &middot; ${BERATUNG_EMAIL}
      </td>
      <td align="right" style="font-size:10px;color:#cbd5e1;white-space:nowrap;">${forwardedAt}</td>
    </tr></table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  // Prepare attachments
  const attachments: Array<{ name: string; contentType: string; contentBase64: string }> = [];
  if (row.attachment_data) {
    const attData = typeof row.attachment_data === "string"
      ? JSON.parse(row.attachment_data)
      : row.attachment_data;
    for (const att of attData) {
      if (att.contentBase64) {
        attachments.push({ name: att.name, contentType: att.contentType, contentBase64: att.contentBase64 });
      }
    }
  }

  const subject = `[Beratung] ${row.subject || "(bez predmetu)"}`;

  try {
    await sendEmail(accessToken, forwardTo, subject, emailBody, true, undefined, attachments);
  } catch (err) {
    console.error("[Beratung] Failed to forward email:", err);
    return false;
  }

  await pool.query(
    `UPDATE beratung_inbox_emails
       SET status = 'forwarded', forwarded_at = now(), updated_at = now()
     WHERE id = $1`,
    [emailId]
  );

  console.log(`[Beratung] Email ${emailId} forwarded to ${forwardTo.join(", ")}`);
  await logBeratungActivity("forwarded", {
    emailId, subject: row.subject || undefined,
    mode: opts?.mode || "manual", userId: opts?.userId,
  });
  return true;
}

// ─── Auto-process loop ────────────────────────────────────────────────────────

/** Returns true if the email passes the configured sender filter.
 *  If sender_filters is empty → all emails pass (no restriction).
 *  If non-empty → email must match at least one filter (substring, case-insensitive on name OR address). */
function matchesSenderFilter(filters: string[], fromAddress: string, fromName: string): boolean {
  if (!filters || filters.length === 0) return true;
  const haystack = `${fromName} ${fromAddress}`.toLowerCase();
  return filters.some(f => haystack.includes(f.toLowerCase().trim()));
}

export async function runBeratungAutoProcess(): Promise<void> {
  try {
    const settings = await getSettings();

    // Always fetch + stamp last_checked_at, even when auto_process is off
    await fetchNewBeratungEmails();

    if (!settings?.auto_process) return;

    const senderFilters: string[] = settings.sender_filters || [];

    // Find all untranslated/unforwarded emails
    const { rows } = await pool.query(
      `SELECT id, from_address, from_name FROM beratung_inbox_emails
       WHERE status IN ('new', 'translated')
       ORDER BY received_at DESC LIMIT 20`
    );

    for (const row of rows) {
      // Apply sender filter — skip emails that don't match
      if (!matchesSenderFilter(senderFilters, row.from_address || "", row.from_name || "")) {
        continue;
      }
      try {
        await forwardBeratungEmail(row.id, { mode: "auto" });
      } catch (err) {
        console.error(`[Beratung] Auto-process error for ${row.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[Beratung] Auto-process cycle error:", err);
  }
}

// ─── Polling integration ──────────────────────────────────────────────────────

let beratungInterval: NodeJS.Timeout | null = null;

export function startBeratungMonitoring() {
  if (beratungInterval) return;
  console.log("[Beratung] Starting email monitoring (3min interval)...");
  // Run first check after 45s (let server warm up)
  setTimeout(() => {
    if (!beratungInterval) return;
    runBeratungAutoProcess().catch(console.error);
  }, 45_000);
  beratungInterval = setInterval(() => {
    runBeratungAutoProcess().catch(console.error);
  }, CHECK_INTERVAL_MS);
}

export function stopBeratungMonitoring() {
  if (beratungInterval) {
    clearInterval(beratungInterval);
    beratungInterval = null;
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
