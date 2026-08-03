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

export async function forwardBeratungEmail(emailId: string): Promise<boolean> {
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
  const voicemailSection = audioAtts.length > 0
    ? `
  <!-- VOICEMAIL -->
  <tr><td style="background:#ffffff;padding:0 36px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr><td style="background:#fffbeb;border:2px solid #f59e0b;border-radius:12px;padding:20px 24px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#92400e;margin-bottom:12px;">🎙️ Hlasová správa — prepis</div>
      ${audioAtts.map(a => `
        ${a.aiSummary ? `<div style="background:#fef3c7;border-radius:8px;padding:12px 16px;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:#b45309;margin-bottom:6px;">💡 Zhrnutie (AI)</div>
          <div style="font-size:13px;line-height:1.6;color:#78350f;">${escapeHtml(a.aiSummary).replace(/\n/g, "<br>")}</div>
        </div>` : ""}
        ${a.transcription ? `<div style="margin-top:8px;">
          <div style="font-size:11px;font-weight:700;color:#92400e;margin-bottom:6px;">📝 Kompletný prepis — ${escapeHtml(a.name)}</div>
          <div style="font-size:13px;line-height:1.7;color:#78350f;white-space:pre-wrap;">${escapeHtml(a.transcription).replace(/\n/g, "<br>")}</div>
        </div>` : ""}
      `).join('<div style="height:12px;"></div>')}
    </td></tr>
    </table>
  </td></tr>
  <tr><td style="height:20px;background:#ffffff;"></td></tr>`
    : "";

  const emailBody = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
<tr><td align="center" style="padding:32px 16px;">
<table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);padding:28px 36px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-1px;line-height:1;">indexus</div>
        <div style="font-size:12px;color:#93c5fd;margin-top:5px;font-weight:500;">Beratung E-mail Monitor</div>
      </td>
      <td align="right" valign="top">
        <span style="display:inline-block;background:rgba(255,255,255,0.15);color:#dbeafe;font-size:11px;font-weight:600;padding:6px 14px;border-radius:20px;border:1px solid rgba(255,255,255,0.2);">📧 Preposlané</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- META CARD -->
  <tr><td style="background:#ffffff;padding:24px 36px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="80" style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:5px 16px 5px 0;vertical-align:top;">Od</td>
        <td style="color:#1e293b;font-size:14px;font-weight:600;padding:5px 0;">${escapeHtml(row.from_name || row.from_address)}</td>
      </tr>
      <tr>
        <td style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:5px 16px 5px 0;">Adresa</td>
        <td style="color:#3b82f6;font-size:13px;padding:5px 0;">${escapeHtml(row.from_address)}</td>
      </tr>
      <tr>
        <td style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:5px 16px 5px 0;">Dátum</td>
        <td style="color:#475569;font-size:13px;padding:5px 0;">${receivedStr}</td>
      </tr>
      <tr>
        <td style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:5px 16px 5px 0;">Predmet</td>
        <td style="color:#1e293b;font-size:15px;font-weight:700;padding:5px 0;">${escapeHtml(row.subject || "(bez predmetu)")}</td>
      </tr>
    </table>
  </td></tr>

  <!-- DIVIDER -->
  <tr><td style="background:#ffffff;padding:0 36px;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>

  ${voicemailSection}

  <!-- ORIGINAL -->
  <tr><td style="background:#f8fafc;padding:24px 36px;border-top:3px solid #e2e8f0;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;margin-bottom:12px;">🇩🇪 Originálny text</div>
    <div style="font-size:13px;line-height:1.75;color:#374151;white-space:pre-wrap;">${escapeHtml(rawBody).replace(/\n/g, "<br>")}</div>
  </td></tr>

  <!-- SK TRANSLATION -->
  <tr><td style="background:#eff6ff;padding:24px 36px;border-top:3px solid #3b82f6;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#1d4ed8;margin-bottom:12px;">🇸🇰 Preklad — slovenčina</div>
    <div style="font-size:13px;line-height:1.75;color:#1e3a8a;white-space:pre-wrap;">${escapeHtml(row.translated_sk || "").replace(/\n/g, "<br>")}</div>
  </td></tr>

  <!-- CS TRANSLATION -->
  <tr><td style="background:#fff1f2;padding:24px 36px;border-top:3px solid #dc2626;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#b91c1c;margin-bottom:12px;">🇨🇿 Preklad — čeština</div>
    <div style="font-size:13px;line-height:1.75;color:#7f1d1d;white-space:pre-wrap;">${escapeHtml(row.translated_cs || "").replace(/\n/g, "<br>")}</div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#1e3a8a;padding:18px 36px;text-align:center;">
    <div style="color:#93c5fd;font-size:11px;line-height:1.6;">
      Automaticky preposlané systémom <strong style="color:#dbeafe;">indexus</strong> · beratung@cordbloodcenter.com
    </div>
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
    if (!settings?.auto_process) return;

    await fetchNewBeratungEmails();

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
        await forwardBeratungEmail(row.id);
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
