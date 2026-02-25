import type { MailchimpSettings } from "@shared/schema";

interface MailchimpListInfo {
  id: string;
  name: string;
  memberCount: number;
}

interface MailchimpCampaignInfo {
  id: string;
  webId: number;
  status: string;
  emailsSent: number;
  sendTime: string | null;
  title: string;
}

interface MailchimpCampaignStats {
  opens: number;
  uniqueOpens: number;
  openRate: number;
  clicks: number;
  uniqueClicks: number;
  clickRate: number;
  bounces: number;
  unsubscribes: number;
  abuseReports: number;
  emailsSent: number;
}

interface MailchimpContact {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  city?: string;
  address?: string;
  tags?: string[];
}

function getBaseUrl(serverPrefix: string): string {
  return `https://${serverPrefix}.api.mailchimp.com/3.0`;
}

function getAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`;
}

async function mailchimpFetch(
  settings: { apiKey: string; serverPrefix: string },
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${getBaseUrl(settings.serverPrefix)}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: getAuthHeader(settings.apiKey),
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Mailchimp API error (${response.status}): ${error.detail || error.title || response.statusText}`);
  }

  return response.json();
}

export async function testConnection(apiKey: string, serverPrefix: string): Promise<{ success: boolean; accountName?: string; error?: string }> {
  try {
    const data = await mailchimpFetch({ apiKey, serverPrefix }, "/");
    return { success: true, accountName: data.account_name };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getLists(settings: { apiKey: string; serverPrefix: string }): Promise<MailchimpListInfo[]> {
  const data = await mailchimpFetch(settings, "/lists?count=100&fields=lists.id,lists.name,lists.stats.member_count");
  return (data.lists || []).map((l: any) => ({
    id: l.id,
    name: l.name,
    memberCount: l.stats?.member_count || 0,
  }));
}

export async function getListInfo(
  settings: { apiKey: string; serverPrefix: string },
  listId: string
): Promise<{ fromName: string; fromEmail: string }> {
  try {
    const data = await mailchimpFetch(settings, `/lists/${listId}?fields=campaign_defaults`);
    return {
      fromName: data.campaign_defaults?.from_name || "",
      fromEmail: data.campaign_defaults?.from_email || "",
    };
  } catch {
    return { fromName: "", fromEmail: "" };
  }
}

export async function createCampaign(
  settings: { apiKey: string; serverPrefix: string },
  name: string,
  subject: string,
  listId: string,
  opts?: {
    replyTo?: string;
    fromName?: string;
    segmentId?: number;
    tags?: string[];
  }
): Promise<MailchimpCampaignInfo> {
  let effectiveReplyTo = opts?.replyTo || "";
  let effectiveFromName = opts?.fromName || name;
  if (!effectiveReplyTo) {
    const listInfo = await getListInfo(settings, listId);
    effectiveReplyTo = listInfo.fromEmail || "noreply@example.com";
    if (!opts?.fromName && listInfo.fromName) effectiveFromName = listInfo.fromName;
  }
  const recipients: any = { list_id: listId };
  if (opts?.segmentId) {
    recipients.segment_opts = { saved_segment_id: opts.segmentId };
  } else if (opts?.tags && opts.tags.length > 0) {
    recipients.segment_opts = {
      match: "all",
      conditions: [{
        condition_type: "StaticSegment",
        field: "static_segment",
        op: "static_is",
        value: opts.tags,
      }],
    };
  }
  const data = await mailchimpFetch(settings, "/campaigns", {
    method: "POST",
    body: JSON.stringify({
      type: "regular",
      recipients,
      settings: {
        subject_line: subject,
        title: name,
        from_name: effectiveFromName,
        reply_to: effectiveReplyTo,
      },
    }),
  });
  return {
    id: data.id,
    webId: data.web_id,
    status: data.status,
    emailsSent: data.emails_sent || 0,
    sendTime: data.send_time,
    title: data.settings?.title || name,
  };
}

export async function getCampaignReport(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<MailchimpCampaignStats> {
  const data = await mailchimpFetch(settings, `/reports/${mailchimpCampaignId}`);
  return {
    opens: data.opens?.opens_total || 0,
    uniqueOpens: data.opens?.unique_opens || 0,
    openRate: data.opens?.open_rate || 0,
    clicks: data.clicks?.clicks_total || 0,
    uniqueClicks: data.clicks?.unique_clicks || 0,
    clickRate: data.clicks?.click_rate || 0,
    bounces: (data.bounces?.hard_bounces || 0) + (data.bounces?.soft_bounces || 0),
    unsubscribes: data.unsubscribes || 0,
    abuseReports: data.abuse_reports || 0,
    emailsSent: data.emails_sent || 0,
  };
}

async function ensureMergeFields(
  settings: { apiKey: string; serverPrefix: string },
  listId: string
): Promise<void> {
  try {
    const data = await mailchimpFetch(settings, `/lists/${listId}/merge-fields?count=50`);
    const existingTags = (data.merge_fields || []).map((f: any) => f.tag);
    const requiredFields = [
      { tag: "PHONE", name: "Phone", type: "phone" },
      { tag: "COMPANY", name: "Company", type: "text" },
      { tag: "CITY", name: "City", type: "text" },
      { tag: "ADDRESS", name: "Address", type: "text" },
    ];
    for (const field of requiredFields) {
      if (!existingTags.includes(field.tag)) {
        try {
          await mailchimpFetch(settings, `/lists/${listId}/merge-fields`, {
            method: "POST",
            body: JSON.stringify({ tag: field.tag, name: field.name, type: field.type }),
          });
        } catch (e) {
        }
      }
    }
  } catch (e) {
  }
}

export async function addContactsToList(
  settings: { apiKey: string; serverPrefix: string },
  listId: string,
  contacts: MailchimpContact[],
  tags?: string[]
): Promise<{ added: number; updated: number; errors: number }> {
  await ensureMergeFields(settings, listId);

  const members = contacts
    .filter(c => c.email)
    .map(c => ({
      email_address: c.email,
      status: "subscribed" as const,
      merge_fields: {
        FNAME: c.firstName || "",
        LNAME: c.lastName || "",
        PHONE: c.phone || "",
        COMPANY: c.company || "",
        CITY: c.city || "",
        ADDRESS: c.address || "",
      },
      ...(tags && tags.length > 0 ? { tags } : {}),
    }));

  if (members.length === 0) {
    return { added: 0, updated: 0, errors: 0 };
  }

  const batchSize = 500;
  let totalAdded = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (let i = 0; i < members.length; i += batchSize) {
    const batch = members.slice(i, i + batchSize);
    const data = await mailchimpFetch(settings, `/lists/${listId}`, {
      method: "POST",
      body: JSON.stringify({
        members: batch,
        update_existing: true,
      }),
    });
    totalAdded += data.new_members?.length || 0;
    totalUpdated += data.updated_members?.length || 0;
    totalErrors += data.errors?.length || 0;
  }

  return { added: totalAdded, updated: totalUpdated, errors: totalErrors };
}

export async function getListTags(
  settings: { apiKey: string; serverPrefix: string },
  listId: string
): Promise<{ id: number; name: string }[]> {
  const data = await mailchimpFetch(settings, `/lists/${listId}/tag-search?count=100`);
  return (data.tags || []).map((t: any) => ({ id: t.id, name: t.name }));
}

export async function getListSegments(
  settings: { apiKey: string; serverPrefix: string },
  listId: string
): Promise<{ id: number; name: string; memberCount: number; type: string }[]> {
  const data = await mailchimpFetch(settings, `/lists/${listId}/segments?count=100`);
  return (data.segments || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    memberCount: s.member_count || 0,
    type: s.type || "static",
  }));
}

export async function createSegment(
  settings: { apiKey: string; serverPrefix: string },
  listId: string,
  name: string,
  emails?: string[]
): Promise<{ id: number; name: string; memberCount: number }> {
  const body: any = { name };
  if (emails && emails.length > 0) {
    body.static_segment = emails;
  }
  const data = await mailchimpFetch(settings, `/lists/${listId}/segments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { id: data.id, name: data.name, memberCount: data.member_count || 0 };
}

export async function getListWebhooks(
  settings: { apiKey: string; serverPrefix: string },
  listId: string
): Promise<{ id: string; url: string; events: Record<string, boolean>; sources: Record<string, boolean> }[]> {
  const data = await mailchimpFetch(settings, `/lists/${listId}/webhooks`);
  return (data.webhooks || []).map((w: any) => ({
    id: w.id,
    url: w.url,
    events: w.events || {},
    sources: w.sources || {},
  }));
}

export async function createWebhook(
  settings: { apiKey: string; serverPrefix: string },
  listId: string,
  url: string,
  events: Record<string, boolean>
): Promise<{ id: string; url: string }> {
  const data = await mailchimpFetch(settings, `/lists/${listId}/webhooks`, {
    method: "POST",
    body: JSON.stringify({
      url,
      events,
      sources: { user: true, admin: true, api: true },
    }),
  });
  return { id: data.id, url: data.url };
}

export async function deleteWebhook(
  settings: { apiKey: string; serverPrefix: string },
  listId: string,
  webhookId: string
): Promise<void> {
  await mailchimpFetch(settings, `/lists/${listId}/webhooks/${webhookId}`, {
    method: "DELETE",
  });
}

export async function getCampaignInfo(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<MailchimpCampaignInfo> {
  const data = await mailchimpFetch(settings, `/campaigns/${mailchimpCampaignId}`);
  return {
    id: data.id,
    webId: data.web_id,
    status: data.status,
    emailsSent: data.emails_sent || 0,
    sendTime: data.send_time,
    title: data.settings?.title || "",
  };
}

export async function createList(
  settings: { apiKey: string; serverPrefix: string },
  opts: {
    name: string;
    company?: string;
    fromEmail: string;
    fromName: string;
    address1?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  }
): Promise<MailchimpListInfo> {
  const data = await mailchimpFetch(settings, "/lists", {
    method: "POST",
    body: JSON.stringify({
      name: opts.name,
      contact: {
        company: opts.company || opts.fromName || opts.name,
        address1: opts.address1 || "N/A",
        city: opts.city || "Bratislava",
        state: opts.state || "SK",
        zip: opts.zip || "00000",
        country: opts.country || "SK",
      },
      permission_reminder: "You signed up for updates from us.",
      campaign_defaults: {
        from_name: opts.fromName,
        from_email: opts.fromEmail,
        subject: "",
        language: (opts.country || "SK").toLowerCase() === "sk" ? "sk" : "en",
      },
      email_type_option: false,
    }),
  });
  return {
    id: data.id,
    name: data.name,
    memberCount: data.stats?.member_count || 0,
  };
}

export async function setCampaignContent(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string,
  html: string
): Promise<void> {
  await mailchimpFetch(settings, `/campaigns/${mailchimpCampaignId}/content`, {
    method: "PUT",
    body: JSON.stringify({ html }),
  });
}

export async function getCampaignContent(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<{ html: string; plainText: string }> {
  const data = await mailchimpFetch(settings, `/campaigns/${mailchimpCampaignId}/content`);
  return {
    html: data.html || "",
    plainText: data.plain_text || "",
  };
}

export async function sendCampaign(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<void> {
  const url = `${getBaseUrl(settings.serverPrefix)}/campaigns/${mailchimpCampaignId}/actions/send`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(settings.apiKey),
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Mailchimp API error (${response.status}): ${error.detail || error.title || response.statusText}`);
  }
}

export async function sendTestEmail(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string,
  testEmails: string[],
  sendType: "html" | "plaintext" = "html"
): Promise<void> {
  const url = `${getBaseUrl(settings.serverPrefix)}/campaigns/${mailchimpCampaignId}/actions/test`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(settings.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      test_emails: testEmails,
      send_type: sendType,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Mailchimp API error (${response.status}): ${error.detail || error.title || response.statusText}`);
  }
}

export async function updateCampaignSettings(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string,
  campaignSettings: { subject_line?: string; from_name?: string; reply_to?: string }
): Promise<void> {
  await mailchimpFetch(settings, `/campaigns/${mailchimpCampaignId}`, {
    method: "PATCH",
    body: JSON.stringify({ settings: campaignSettings }),
  });
}
