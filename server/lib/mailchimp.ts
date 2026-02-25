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

export async function createCampaign(
  settings: { apiKey: string; serverPrefix: string },
  name: string,
  subject: string,
  listId: string
): Promise<MailchimpCampaignInfo> {
  const data = await mailchimpFetch(settings, "/campaigns", {
    method: "POST",
    body: JSON.stringify({
      type: "regular",
      recipients: { list_id: listId },
      settings: {
        subject_line: subject,
        title: name,
        from_name: name,
        reply_to: "",
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

export async function addContactsToList(
  settings: { apiKey: string; serverPrefix: string },
  listId: string,
  contacts: MailchimpContact[],
  tags?: string[]
): Promise<{ added: number; updated: number; errors: number }> {
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
