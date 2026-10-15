import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { leadCampaigns, searchJobs, searchResults, users } from "../../shared/schema";
import { emitEventOnce } from "./event-bus";
import { leadCampaignSelectionValid, LEAD_SEARCH_EVENTS, getLeadSearchCopy, LEAD_SEARCH_LANGUAGES } from "../../shared/automation-lead-search";

type Outcome = "completed" | "failed" | "cancelled";
type Campaign = { id: number; name: string; country: string | null };
type Job = { id: number; name: string; campaignId: number | null; country: string | null; targetModule: string };

/** Only campaign metadata and saved counts: never prospect identities or raw errors. */
export function leadSearchOutcomeEvents(job: Job, campaign: Campaign | undefined, status: Outcome,
  counts: { newLeads: number; totalResults: number }, finishedAt: Date) {
  if (!campaign || job.campaignId !== campaign.id) return [];
  const newValues = {
    campaignId: campaign.id, campaignName: campaign.name,
    jobId: job.id, jobName: job.name, targetModule: job.targetModule,
    country: campaign.country || job.country || "",
    status, newLeads: counts.newLeads, totalResults: counts.totalResults,
    completedAt: finishedAt.toISOString(),
  };
  const events = status === "completed" && counts.newLeads > 0
    ? ["lead_search.results_found", "lead_search.completed"] : [`lead_search.${status}`];
  return events.map(eventType => ({
    source: "storage" as const, module: "lead_search", entityType: "lead_search",
    entityId: String(job.id), countryCode: campaign.country || job.country,
    eventType, newValues,
  }));
}

/** Called only after the job's final state has been persisted. Does not send anything. */
export async function emitLeadSearchOutcome(jobId: number, status: Outcome, newLeads = 0) {
  const [job] = await db.select().from(searchJobs).where(eq(searchJobs.id, jobId));
  if (!job?.campaignId || job.status !== status) return;
  const [campaign] = await db.select().from(leadCampaigns).where(eq(leadCampaigns.id, job.campaignId));
  const [counts] = await db.select({ total: sql<number>`count(*)::int` }).from(searchResults).where(eq(searchResults.jobId, jobId));
  for (const event of leadSearchOutcomeEvents(job, campaign, status,
    { newLeads: status === "completed" ? newLeads : 0, totalResults: counts.total }, job.completedAt || new Date())) {
    // The job ID plus event kind is unique, even if a completion hook is retried.
    await emitEventOnce(event, `lead-search:${job.id}:${event.eventType}`);
  }
}

type Owner = { role?: string; assignedCountries?: string[] | null };
export function leadCampaignVisible(campaign: { country: string | null }, owner: Owner) {
  return ["admin", "superadmin", "owner"].includes((owner.role || "").toLowerCase()) ||
    Boolean(campaign.country && owner.assignedCountries?.includes(campaign.country));
}

export async function validateLeadCampaignSelection(rule: { module: string; trigger: any; countryCodes?: string[] | null; countryCode?: string | null }, owner: Owner) {
  if (rule.module !== "lead_search") return true;
  const ids = rule.trigger?.leadCampaignIds;
  if (!leadCampaignSelectionValid(ids)) return false;
  const campaigns = await db.select().from(leadCampaigns).where(inArray(leadCampaigns.id, ids));
  const countries = rule.countryCodes ?? (rule.countryCode ? [rule.countryCode] : []);
  return campaigns.length === ids.length && campaigns.every(campaign =>
    leadCampaignVisible(campaign, owner) && (!countries.length || Boolean(campaign.country && countries.includes(campaign.country))));
}

export async function leadSearchExecutionAllowed(rule: { module: string; trigger: any; createdByUserId?: string | null; countryCodes?: string[] | null; countryCode?: string | null }) {
  if (rule.module !== "lead_search") return true;
  if (!rule.createdByUserId) return false;
  const [owner] = await db.select({ role: users.role, assignedCountries: users.assignedCountries, isActive: users.isActive })
    .from(users).where(eq(users.id, rule.createdByUserId));
  return Boolean(owner?.isActive && await validateLeadCampaignSelection(rule, owner));
}

export function registerLeadSearchAutomationRoutes(app: any, requireDesigner: any) {
  app.get("/api/automation/lead-campaigns", requireDesigner, async (req: any, res: any) => {
    try {
      const owner = req.session.user;
      const rows = await db.select({ id: leadCampaigns.id, name: leadCampaigns.name,
        country: leadCampaigns.country, isActive: leadCampaigns.isActive }).from(leadCampaigns).orderBy(leadCampaigns.name);
      res.json(rows.filter(row => leadCampaignVisible(row, owner)));
    } catch {
      res.status(500).json({ error: "lead_campaigns_unavailable" });
    }
  });
}

export function leadSearchNotificationDefaults() {
  return LEAD_SEARCH_LANGUAGES.flatMap(language => {
    const copy = getLeadSearchCopy(language);
    return LEAD_SEARCH_EVENTS.map(event => {
      const key = event.slice("lead_search.".length) as "results_found" | Outcome;
      return { id: `indexus-lead-search-notification-${key}-${language}`,
        name: `LEAD SEARCH · ${copy[key]}`, type: "notification", format: "text",
        subject: `${copy[key]} · {{newValues.campaignName}}`,
        content: copy[key === "results_found" ? "resultsMessage" : `${key}Message`],
        language };
    });
  });
}

/** One-time seeds preserve edits, disabled defaults, deletions and rule snapshots. */
export async function ensureLeadSearchNotificationTemplates(pool: { query: (sql: string) => Promise<unknown> }) {
  const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
  for (const language of LEAD_SEARCH_LANGUAGES) {
    const values = leadSearchNotificationDefaults().filter(item => item.language === language)
      .map(item => `(${[item.id, item.name, item.subject, item.content].map(literal).join(",")})`).join(",");
    await pool.query(`CREATE TABLE IF NOT EXISTS automation_template_seeds(id text PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now());
      WITH seed AS (INSERT INTO automation_template_seeds(id) VALUES (${literal(`lead-search-notifications-${language}`)})
        ON CONFLICT(id) DO NOTHING RETURNING id),
      defaults(id,name,title,message) AS (VALUES ${values})
      INSERT INTO message_templates(id,name,type,format,subject,content,language,is_active,country_codes)
      SELECT defaults.id,name,'notification','text',title,message,${literal(language)},true,ARRAY[]::text[]
      FROM defaults CROSS JOIN seed ON CONFLICT(id) DO NOTHING;`);
  }
}
