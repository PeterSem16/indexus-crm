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

export async function createTag(
  settings: { apiKey: string; serverPrefix: string },
  listId: string,
  tagName: string
): Promise<{ id: number; name: string }> {
  const data = await mailchimpFetch(settings, `/lists/${listId}/segments`, {
    method: "POST",
    body: JSON.stringify({ name: tagName, static_segment: [] }),
  });
  return { id: data.id, name: data.name };
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
  campaignSettings: { subject_line?: string; from_name?: string; reply_to?: string; preview_text?: string }
): Promise<void> {
  await mailchimpFetch(settings, `/campaigns/${mailchimpCampaignId}`, {
    method: "PATCH",
    body: JSON.stringify({ settings: campaignSettings }),
  });
}

export async function scheduleCampaign(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string,
  scheduleTime: string,
  timewarp?: boolean,
  batchDelivery?: { batchCount: number; batchDelay: number }
): Promise<void> {
  const body: any = { schedule_time: scheduleTime };
  if (timewarp) body.timewarp = true;
  if (batchDelivery) {
    body.batch_delivery = {
      batch_count: batchDelivery.batchCount,
      batch_delay: batchDelivery.batchDelay,
    };
  }
  const url = `${getBaseUrl(settings.serverPrefix)}/campaigns/${mailchimpCampaignId}/actions/schedule`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(settings.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Mailchimp API error (${response.status}): ${error.detail || error.title || response.statusText}`);
  }
}

export async function unscheduleCampaign(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<void> {
  const url = `${getBaseUrl(settings.serverPrefix)}/campaigns/${mailchimpCampaignId}/actions/unschedule`;
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

export async function pauseCampaign(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<void> {
  const url = `${getBaseUrl(settings.serverPrefix)}/campaigns/${mailchimpCampaignId}/actions/pause`;
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

export async function resumeCampaign(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<void> {
  const url = `${getBaseUrl(settings.serverPrefix)}/campaigns/${mailchimpCampaignId}/actions/resume`;
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

export async function replicateCampaign(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<MailchimpCampaignInfo> {
  const url = `${getBaseUrl(settings.serverPrefix)}/campaigns/${mailchimpCampaignId}/actions/replicate`;
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
  const data = await response.json();
  return {
    id: data.id,
    webId: data.web_id,
    status: data.status,
    emailsSent: data.emails_sent || 0,
    sendTime: data.send_time,
    title: data.settings?.title || "",
  };
}

export async function cancelCampaign(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<void> {
  const url = `${getBaseUrl(settings.serverPrefix)}/campaigns/${mailchimpCampaignId}/actions/cancel-send`;
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

export async function deleteCampaign(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<void> {
  await mailchimpFetch(settings, `/campaigns/${mailchimpCampaignId}`, {
    method: "DELETE",
  });
}

export async function getCampaignChecklist(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<{ isReady: boolean; items: { type: string; id: number; heading: string; details: string }[] }> {
  const data = await mailchimpFetch(settings, `/campaigns/${mailchimpCampaignId}/send-checklist`);
  return {
    isReady: data.is_ready || false,
    items: (data.items || []).map((i: any) => ({
      type: i.type,
      id: i.id,
      heading: i.heading,
      details: i.details,
    })),
  };
}

export async function getEmailActivity(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string,
  count: number = 25,
  offset: number = 0
): Promise<{ emails: { emailAddress: string; activity: { action: string; timestamp: string; ip?: string; url?: string }[] }[]; totalItems: number }> {
  const data = await mailchimpFetch(settings, `/reports/${mailchimpCampaignId}/email-activity?count=${count}&offset=${offset}`);
  return {
    emails: (data.emails || []).map((e: any) => ({
      emailAddress: e.email_address,
      activity: (e.activity || []).map((a: any) => ({
        action: a.action,
        timestamp: a.timestamp,
        ip: a.ip,
        url: a.url,
      })),
    })),
    totalItems: data.total_items || 0,
  };
}

export async function getClickDetails(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<{ urlsClicked: { id: string; url: string; totalClicks: number; uniqueClicks: number; clickPercentage: number; lastClickDate: string }[] }> {
  const data = await mailchimpFetch(settings, `/reports/${mailchimpCampaignId}/click-details`);
  return {
    urlsClicked: (data.urls_clicked || []).map((u: any) => ({
      id: u.id,
      url: u.url,
      totalClicks: u.total_clicks || 0,
      uniqueClicks: u.unique_clicks || 0,
      clickPercentage: u.click_percentage || 0,
      lastClickDate: u.last_click || "",
    })),
  };
}

export async function getUnsubscribes(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<{ unsubscribes: { emailAddress: string; timestamp: string; reason?: string }[]; totalItems: number }> {
  const data = await mailchimpFetch(settings, `/reports/${mailchimpCampaignId}/unsubscribed?count=100`);
  return {
    unsubscribes: (data.unsubscribes || []).map((u: any) => ({
      emailAddress: u.email_address,
      timestamp: u.timestamp,
      reason: u.reason,
    })),
    totalItems: data.total_items || 0,
  };
}

export async function getDomainPerformance(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<{ domains: { domain: string; emailsSent: number; bounces: number; opens: number; clicks: number; unsubs: number; delivered: number; emailsPct: number; bouncesPct: number; opensPct: number; clicksPct: number }[] }> {
  const data = await mailchimpFetch(settings, `/reports/${mailchimpCampaignId}/domain-performance`);
  return {
    domains: (data.domains || []).map((d: any) => ({
      domain: d.domain,
      emailsSent: d.emails_sent || 0,
      bounces: d.bounces || 0,
      opens: d.opens || 0,
      clicks: d.clicks || 0,
      unsubs: d.unsubs || 0,
      delivered: d.delivered || 0,
      emailsPct: d.emails_pct || 0,
      bouncesPct: d.bounces_pct || 0,
      opensPct: d.opens_pct || 0,
      clicksPct: d.clicks_pct || 0,
    })),
  };
}

export async function getAudienceGrowthHistory(
  settings: { apiKey: string; serverPrefix: string },
  listId: string,
  count: number = 12
): Promise<{ history: { month: string; existing: number; imports: number; optins: number }[] }> {
  const data = await mailchimpFetch(settings, `/lists/${listId}/growth-history?count=${count}&sort_field=month&sort_dir=DESC`);
  return {
    history: (data.history || []).map((h: any) => ({
      month: h.month,
      existing: h.existing || 0,
      imports: h.imports || 0,
      optins: h.optins || 0,
    })),
  };
}

export async function getListMembers(
  settings: { apiKey: string; serverPrefix: string },
  listId: string,
  opts?: { count?: number; offset?: number; status?: string; sortField?: string; sortDir?: string }
): Promise<{ members: { id: string; emailAddress: string; status: string; mergeFields: any; tags: { id: number; name: string }[]; lastChanged: string }[]; totalItems: number }> {
  const params = new URLSearchParams();
  params.set("count", String(opts?.count || 25));
  params.set("offset", String(opts?.offset || 0));
  if (opts?.status) params.set("status", opts.status);
  if (opts?.sortField) params.set("sort_field", opts.sortField);
  if (opts?.sortDir) params.set("sort_dir", opts.sortDir);
  const data = await mailchimpFetch(settings, `/lists/${listId}/members?${params.toString()}`);
  return {
    members: (data.members || []).map((m: any) => ({
      id: m.id,
      emailAddress: m.email_address,
      status: m.status,
      mergeFields: m.merge_fields || {},
      tags: (m.tags || []).map((t: any) => ({ id: t.id, name: t.name })),
      lastChanged: m.last_changed || "",
    })),
    totalItems: data.total_items || 0,
  };
}

export async function updateMemberTags(
  settings: { apiKey: string; serverPrefix: string },
  listId: string,
  subscriberHash: string,
  tags: { name: string; status: "active" | "inactive" }[]
): Promise<void> {
  await mailchimpFetch(settings, `/lists/${listId}/members/${subscriberHash}/tags`, {
    method: "POST",
    body: JSON.stringify({ tags }),
  });
}

export async function archiveMember(
  settings: { apiKey: string; serverPrefix: string },
  listId: string,
  subscriberHash: string
): Promise<void> {
  await mailchimpFetch(settings, `/lists/${listId}/members/${subscriberHash}`, {
    method: "DELETE",
  });
}

export async function getTemplates(
  settings: { apiKey: string; serverPrefix: string },
  count: number = 50
): Promise<{ templates: { id: number; name: string; type: string; category: string; dateCreated: string; thumbnail: string }[] }> {
  const data = await mailchimpFetch(settings, `/templates?count=${count}&type=user`);
  return {
    templates: (data.templates || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      category: t.category || "",
      dateCreated: t.date_created || "",
      thumbnail: t.thumbnail || "",
    })),
  };
}

export async function getTemplateContent(
  settings: { apiKey: string; serverPrefix: string },
  templateId: number
): Promise<string> {
  const data = await mailchimpFetch(settings, `/templates/${templateId}/default-content`);
  return data.html || "";
}

export async function getAutomations(
  settings: { apiKey: string; serverPrefix: string }
): Promise<{ automations: { id: string; title: string; status: string; emailsSent: number; startTime: string; createTime: string; listId: string }[] }> {
  const data = await mailchimpFetch(settings, "/automations?count=100");
  return {
    automations: (data.automations || []).map((a: any) => ({
      id: a.id,
      title: a.settings?.title || "",
      status: a.status,
      emailsSent: a.emails_sent || 0,
      startTime: a.start_time || "",
      createTime: a.create_time || "",
      listId: a.recipients?.list_id || "",
    })),
  };
}

export async function getCampaignOpenDetails(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string,
  count: number = 100
): Promise<{ members: { emailAddress: string; opensCount: number; firstOpen: string; lastOpen: string }[]; totalItems: number; totalOpens: number }> {
  const data = await mailchimpFetch(settings, `/reports/${mailchimpCampaignId}/open-details?count=${count}`);
  return {
    members: (data.members || []).map((m: any) => ({
      emailAddress: m.email_address,
      opensCount: m.opens_count || 0,
      firstOpen: m.first_open || "",
      lastOpen: m.last_open || "",
    })),
    totalItems: data.total_items || 0,
    totalOpens: data.total_opens || 0,
  };
}

export async function getBounceDetails(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<{ hardBounces: number; softBounces: number; syntaxErrors: number; members: { emailAddress: string; type: string }[] }> {
  const data = await mailchimpFetch(settings, `/reports/${mailchimpCampaignId}/bounce`);
  return {
    hardBounces: data.hard_bounces?.length || 0,
    softBounces: data.soft_bounces?.length || 0,
    syntaxErrors: data.syntax_errors?.length || 0,
    members: [
      ...(data.hard_bounces || []).map((b: any) => ({ emailAddress: b.email_address, type: "hard" })),
      ...(data.soft_bounces || []).map((b: any) => ({ emailAddress: b.email_address, type: "soft" })),
      ...(data.syntax_errors || []).map((b: any) => ({ emailAddress: b.email_address, type: "syntax" })),
    ],
  };
}

export async function getSentTo(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string,
  count: number = 100,
  offset: number = 0
): Promise<{ sentTo: { emailAddress: string; status: string; openCount: number; lastOpen: string }[]; totalItems: number }> {
  const data = await mailchimpFetch(settings, `/reports/${mailchimpCampaignId}/sent-to?count=${count}&offset=${offset}`);
  return {
    sentTo: (data.sent_to || []).map((s: any) => ({
      emailAddress: s.email_address,
      status: s.status,
      openCount: s.open_count || 0,
      lastOpen: s.last_open || "",
    })),
    totalItems: data.total_items || 0,
  };
}

export async function getEcommerceProductActivity(
  settings: { apiKey: string; serverPrefix: string },
  mailchimpCampaignId: string
): Promise<any> {
  try {
    const data = await mailchimpFetch(settings, `/reports/${mailchimpCampaignId}/ecommerce-product-activity`);
    return data;
  } catch {
    return null;
  }
}

export async function getListActivity(
  settings: { apiKey: string; serverPrefix: string },
  listId: string,
  count: number = 30
): Promise<{ activity: { day: string; emailsSent: number; uniqueOpens: number; recipientClicks: number; hardBounce: number; softBounce: number; subs: number; unsubs: number; otherAdds: number; otherRemoves: number }[] }> {
  const data = await mailchimpFetch(settings, `/lists/${listId}/activity?count=${count}`);
  return {
    activity: (data.activity || []).map((a: any) => ({
      day: a.day,
      emailsSent: a.emails_sent || 0,
      uniqueOpens: a.unique_opens || 0,
      recipientClicks: a.recipient_clicks || 0,
      hardBounce: a.hard_bounce || 0,
      softBounce: a.soft_bounce || 0,
      subs: a.subs || 0,
      unsubs: a.unsubs || 0,
      otherAdds: a.other_adds || 0,
      otherRemoves: a.other_removes || 0,
    })),
  };
}
