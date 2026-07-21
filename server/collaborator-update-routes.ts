import { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, inArray, notInArray, isNotNull, ne, sql as dsql } from "drizzle-orm";
import * as crypto from "crypto";
import {
  collaborators,
  collaboratorAddresses,
  collaboratorUpdateCampaigns,
  collaboratorUpdateRequests,
  insertCollaboratorUpdateCampaignSchema,
} from "@shared/schema";
import { storage } from "./storage";
import { sendEmail as ms365SendEmail, getValidAccessToken } from "./lib/ms365";
import { decryptTokenSafe } from "./lib/token-crypto";

// Collaborator columns editable through the public form
const EDITABLE_FIELDS = [
  "titleBefore", "firstName", "lastName", "titleAfter", "maidenName",
  "email", "mobile", "phone",
  "bankAccountIban", "swiftCode",
  "companyName", "ico", "dic", "icDph",
] as const;

const ADDRESS_TYPES = ["permanent", "correspondence"] as const;
const ADDRESS_SUBFIELDS = ["streetNumber", "city", "postalCode"] as const;

function countryToLanguage(cc: string | null | undefined): string {
  switch ((cc || "").toUpperCase()) {
    case "SK": return "sk";
    case "CZ": return "cs";
    case "HU": return "hu";
    case "RO": return "ro";
    case "IT": case "CH": return "it";
    case "DE": case "AT": return "de";
    default: return "en";
  }
}

function maskBirthNumber(bn: string | null | undefined): string | null {
  if (!bn) return null;
  const clean = String(bn);
  if (clean.length <= 4) return "****";
  return clean.slice(0, 4) + "*".repeat(Math.max(clean.length - 4, 2));
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}

function getBaseUrl(req: Request): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

// Fictional sample data used for test sends — real collaborator data is never
// shown in test emails or the test form.
const TEST_SAMPLE: Record<string, string> = {
  titleBefore: "Ing.", firstName: "Test", lastName: "Testovací", titleAfter: "",
  maidenName: "", email: "test@example.com", mobile: "+421 900 000 000", phone: "",
  bankAccountIban: "SK00 0000 0000 0000 0000 0000", swiftCode: "TESTSKBX",
  companyName: "Testovacia s.r.o.", ico: "00000000", dic: "0000000000", icDph: "",
};
const TEST_SAMPLE_ADDR: Record<string, Record<string, string>> = {
  permanent: { streetNumber: "Testovacia 1", city: "Bratislava", postalCode: "811 01" },
  correspondence: { streetNumber: "", city: "", postalCode: "" },
};

// JMHZ form (CZ zákon č. 323/2025 Sb. — jednotné měsíční hlášení zaměstnavatele).
// These fields are collected via the public form and stored ONLY on the request
// (submittedData/changes) — they have no matching collaborator columns, so the
// approve step never writes them to the collaborators table.
const JMHZ_EDUCATION_LEVELS = [
  "Bez vzdělání",
  "Neúplné základní vzdělání",
  "Základní vzdělání",
  "Nižší střední vzdělání",
  "Nižší střední odborné vzdělání",
  "Střední odborné vzdělání s výučním listem",
  "Střední nebo střední odborné vzdělání bez maturity a výučního listu",
  "Úplné střední všeobecné vzdělání",
  "Úplné střední odborné vzdělání s vyučením i maturitou",
  "Úplné střední odborné vzdělání s maturitou (bez vyučení)",
  "Vyšší odborné vzdělání",
  "Vyšší odborné vzdělání v konzervatoři",
  "Vysokoškolské bakalářské vzdělání",
  "Vysokoškolské magisterské vzdělání",
  "Vysokoškolské doktorské vzdělání",
] as const;
const JMHZ_PROFESSIONS = [
  "Lékaři v gynekologii a porodnictví (specialisté)",
  "Všeobecní lékaři (lékaři v přípravě/absolventi)",
  "Primáři v oblasti zdravotnictví",
  "Vedoucí lékaři a ředitelé zdravotnických zařízení",
  "Porodní asistentky se specializací",
  "Staniční sestry (porodní asistentky)",
  "Porodní asistentky bez specializace",
  "Vrchní a staniční sestry (všeobecné sestry)",
  "Sestry pro péči v chirurgických oborech",
  "Všeobecné sestry bez specializace",
  "Sestry pro péči v interních oborech",
  "Praktické sestry (dříve zdravotničtí asistenti)",
  "Ošetřovatelé ve zdravotnických zařízeních",
] as const;
// Optional contact-data updates submitted with the JMHZ form. Field names
// match EDITABLE_FIELDS / addr_* so the approve step applies them normally.
const JMHZ_CONTACT_FIELDS = [
  "email", "phone", "bankAccountIban",
  "addr_permanent_streetNumber", "addr_permanent_city", "addr_permanent_postalCode",
] as const;
const JMHZ_FIELDS = [
  "educationHighest", "birthPlace", "birthCountry", "birthSurname",
  "profession", "educationRequired", "workPlace", "isLeadingEmployee",
] as const;
function validateJmhzSubmission(data: Record<string, any>): string | null {
  for (const f of JMHZ_FIELDS) {
    const v = data[f] === null || data[f] === undefined ? "" : String(data[f]).trim();
    if (!v) return f;
  }
  if (!(JMHZ_EDUCATION_LEVELS as readonly string[]).includes(String(data.educationHighest).trim())) return "educationHighest";
  if (!(JMHZ_EDUCATION_LEVELS as readonly string[]).includes(String(data.educationRequired).trim())) return "educationRequired";
  if (!["Ano", "Ne"].includes(String(data.isLeadingEmployee).trim())) return "isLeadingEmployee";
  return null;
}

type FilterCriteria = {
  countryCodes?: string[];
  collaboratorType?: string;
  agreementType?: string;
  partnerCategory?: string;
  rewardType?: string;
  isManager?: boolean;
  monthRewards?: boolean;
  isActive?: boolean;
  dataSource?: string;
  legacyIds?: string; // pasted list, separated by whitespace/commas/semicolons
  agreementActiveOn?: string; // YYYY-MM-DD: has a valid agreement active on this date
};

async function findRecipients(filter: FilterCriteria) {
  const conds: any[] = [isNotNull(collaborators.email), ne(collaborators.email, "")];
  if (filter.countryCodes && filter.countryCodes.length > 0) {
    conds.push(inArray(collaborators.countryCode, filter.countryCodes));
  }
  if (filter.collaboratorType) conds.push(eq(collaborators.collaboratorType, filter.collaboratorType));
  if (filter.agreementType) conds.push(eq(collaborators.agreementType, filter.agreementType));
  if (filter.partnerCategory) conds.push(eq(collaborators.partnerCategory, filter.partnerCategory));
  if (filter.rewardType) conds.push(eq(collaborators.rewardType, filter.rewardType));
  if (typeof filter.isManager === "boolean") conds.push(eq(collaborators.isManager, filter.isManager));
  if (typeof filter.monthRewards === "boolean") conds.push(eq(collaborators.monthRewards, filter.monthRewards));
  if (typeof filter.isActive === "boolean") conds.push(eq(collaborators.isActive, filter.isActive));
  if (filter.dataSource) conds.push(eq(collaborators.dataSource, filter.dataSource));
  if (filter.legacyIds && filter.legacyIds.trim()) {
    const ids = filter.legacyIds.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
    if (ids.length > 0) conds.push(inArray(collaborators.legacyId, ids));
  }
  if (filter.agreementActiveOn && /^\d{4}-\d{2}-\d{2}$/.test(filter.agreementActiveOn)
      && !isNaN(new Date(filter.agreementActiveOn + "T00:00:00Z").getTime())
      && new Date(filter.agreementActiveOn + "T00:00:00Z").toISOString().slice(0, 10) === filter.agreementActiveOn) {
    const d = filter.agreementActiveOn;
    // month clamped to 1-12 and the date built as first-of-month + (day-1) days,
    // so out-of-range imported day/month values can never crash make_date()
    conds.push(dsql`EXISTS (
      SELECT 1 FROM collaborator_agreements ca
      WHERE ca.collaborator_id = ${collaborators.id}
        AND ca.is_valid = true
        AND (ca.valid_from_year IS NULL
          OR (make_date(ca.valid_from_year, GREATEST(1, LEAST(12, COALESCE(ca.valid_from_month, 1))), 1)
              + (GREATEST(1, LEAST(31, COALESCE(ca.valid_from_day, 1))) - 1) * interval '1 day')::date <= ${d}::date)
        AND (ca.valid_to_year IS NULL
          OR (CASE
                WHEN ca.valid_to_day IS NOT NULL AND ca.valid_to_month IS NOT NULL
                  THEN (make_date(ca.valid_to_year, GREATEST(1, LEAST(12, ca.valid_to_month)), 1)
                        + (GREATEST(1, LEAST(31, ca.valid_to_day)) - 1) * interval '1 day')::date
                ELSE (make_date(ca.valid_to_year, GREATEST(1, LEAST(12, COALESCE(ca.valid_to_month, 12))), 1)
                      + interval '1 month' - interval '1 day')::date
              END) >= ${d}::date)
    )`);
  }
  return db.select({
    id: collaborators.id,
    firstName: collaborators.firstName,
    lastName: collaborators.lastName,
    email: collaborators.email,
    countryCode: collaborators.countryCode,
    collaboratorType: collaborators.collaboratorType,
    legacyId: collaborators.legacyId,
  }).from(collaborators).where(and(...conds)).orderBy(collaborators.lastName);
}

async function sendCampaignEmails(campaignId: string, baseUrl: string, onlyReminder: boolean) {
  const [campaign] = await db.select().from(collaboratorUpdateCampaigns)
    .where(eq(collaboratorUpdateCampaigns.id, campaignId));
  if (!campaign) return;

  const conn: any = await storage.getSystemMs365Connection(campaign.senderCountryCode);
  if (!conn?.accessToken) {
    console.error(`[CollabUpdate] No MS365 system connection for ${campaign.senderCountryCode}`);
    await db.update(collaboratorUpdateCampaigns)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(collaboratorUpdateCampaigns.id, campaignId));
    return;
  }

  const statuses = onlyReminder ? ["sent", "opened"] : ["pending", "send_failed"];
  const requests = await db.select().from(collaboratorUpdateRequests)
    .where(and(
      eq(collaboratorUpdateRequests.campaignId, campaignId),
      inArray(collaboratorUpdateRequests.status, statuses),
    ));

  let tokenInfo = await getValidAccessToken(
    decryptTokenSafe(conn.accessToken),
    conn.tokenExpiresAt,
    conn.refreshToken ? decryptTokenSafe(conn.refreshToken) : null,
  );
  if (!tokenInfo?.accessToken) {
    console.error(`[CollabUpdate] MS365 token refresh failed for ${campaign.senderCountryCode}`);
    await db.update(collaboratorUpdateCampaigns)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(collaboratorUpdateCampaigns.id, campaignId));
    return;
  }
  if (tokenInfo.refreshed) {
    try {
      await storage.updateSystemMs365Connection(campaign.senderCountryCode, {
        accessToken: tokenInfo.accessToken,
        refreshToken: tokenInfo.refreshToken || conn.refreshToken,
        tokenExpiresAt: tokenInfo.expiresOn || undefined,
      } as any);
    } catch {}
  }

  const collabIds = requests.map(r => r.collaboratorId);
  const collabRows = collabIds.length > 0
    ? await db.select().from(collaborators).where(inArray(collaborators.id, collabIds))
    : [];
  const collabById = new Map(collabRows.map(c => [c.id, c]));

  let sent = 0, failed = 0, paused = false;
  for (const reqRow of requests) {
    // check for pause request before every email (cheap status probe)
    {
      const [cur] = await db.select({ status: collaboratorUpdateCampaigns.status })
        .from(collaboratorUpdateCampaigns)
        .where(eq(collaboratorUpdateCampaigns.id, campaignId));
      if (!cur || cur.status === "paused") {
        paused = true;
        break;
      }
    }
    const c = collabById.get(reqRow.collaboratorId);
    if (!c) continue;
    const link = `${baseUrl}/update/${reqRow.token}`;
    const vars: Record<string, string> = {
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      fullName: [c.titleBefore, c.firstName, c.lastName].filter(Boolean).join(" "),
      titleBefore: c.titleBefore || "",
      link,
    };
    const subject = renderTemplate(campaign.emailSubject, vars);
    let body = renderTemplate(campaign.emailBody, vars);
    if (!campaign.emailBody.includes("{{link}}")) {
      body += `<p><a href="${link}">${link}</a></p>`;
    }
    try {
      await ms365SendEmail(tokenInfo.accessToken, [reqRow.email], subject, body, true);
      await db.update(collaboratorUpdateRequests)
        .set(onlyReminder
          ? { remindedAt: new Date(), sendError: null }
          : { status: "sent", sentAt: new Date(), sendError: null })
        .where(eq(collaboratorUpdateRequests.id, reqRow.id));
      sent++;
    } catch (err: any) {
      await db.update(collaboratorUpdateRequests)
        .set(onlyReminder
          ? { sendError: err?.message || "send failed" }
          : { status: "send_failed", sendError: err?.message || "send failed" })
        .where(eq(collaboratorUpdateRequests.id, reqRow.id));
      failed++;
    }
    // gentle throttle for Graph API
    await new Promise(r => setTimeout(r, 250));
    // refresh token if long batch expired it
    if ((sent + failed) % 200 === 0) {
      const fresh: any = await storage.getSystemMs365Connection(campaign.senderCountryCode);
      const ti = await getValidAccessToken(
        decryptTokenSafe(fresh.accessToken),
        fresh.tokenExpiresAt,
        fresh.refreshToken ? decryptTokenSafe(fresh.refreshToken) : null,
      );
      if (ti?.accessToken) tokenInfo = ti;
    }
  }

  if (!paused) {
    // only flip to "sent" if nobody paused it meanwhile (CAS on status)
    await db.update(collaboratorUpdateCampaigns)
      .set({ status: "sent", updatedAt: new Date() })
      .where(and(
        eq(collaboratorUpdateCampaigns.id, campaignId),
        eq(collaboratorUpdateCampaigns.status, "sending"),
      ));
  }
  console.log(`[CollabUpdate] Campaign ${campaignId}: ${sent} sent, ${failed} failed (reminder=${onlyReminder}, paused=${paused})`);
}

export function registerCollaboratorUpdateRoutes(app: Express, requireAuth: any) {
  // ---------- ADMIN ----------

  const requireAdmin = async (req: Request, res: Response, next: () => void) => {
    try {
      const sessionUser = (req.session as any)?.user;
      let role = sessionUser?.role;
      if (!role) {
        const userId = (req.session as any)?.userId || sessionUser?.id;
        if (userId) {
          const user = await storage.getUser(userId);
          role = user?.role;
        }
      }
      if (role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      next();
    } catch {
      res.status(403).json({ message: "Forbidden" });
    }
  };

  // Distinct values of filterable collaborator fields, for the create-campaign filter UI
  app.get("/api/collaborator-update-campaigns/filter-options", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const distinct = async (col: any) => {
        const rows = await db.selectDistinct({ v: col }).from(collaborators)
          .where(and(isNotNull(col), ne(col, "")));
        return rows.map(r => r.v as string).sort((a, b) => a.localeCompare(b));
      };
      res.json({
        collaboratorTypes: await distinct(collaborators.collaboratorType),
        agreementTypes: await distinct(collaborators.agreementType),
        partnerCategories: await distinct(collaborators.partnerCategory),
        rewardTypes: await distinct(collaborators.rewardType),
        dataSources: await distinct(collaborators.dataSource),
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to load filter options" });
    }
  });

  app.post("/api/collaborator-update-campaigns/preview", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const recipients = await findRecipients(req.body?.filterCriteria || {});
      res.json({ count: recipients.length, recipients: recipients.slice(0, 200) });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Preview failed" });
    }
  });

  app.get("/api/collaborator-update-campaigns", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const campaigns = await db.select().from(collaboratorUpdateCampaigns)
        .orderBy(desc(collaboratorUpdateCampaigns.createdAt));
      const stats = await db.select({
        campaignId: collaboratorUpdateRequests.campaignId,
        status: collaboratorUpdateRequests.status,
        count: dsql<number>`count(*)::int`,
      }).from(collaboratorUpdateRequests)
        .groupBy(collaboratorUpdateRequests.campaignId, collaboratorUpdateRequests.status);
      const byId: Record<string, Record<string, number>> = {};
      for (const s of stats) {
        byId[s.campaignId] = byId[s.campaignId] || {};
        byId[s.campaignId][s.status] = s.count;
      }
      res.json(campaigns.map(c => ({ ...c, stats: byId[c.id] || {} })));
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to load campaigns" });
    }
  });

  app.post("/api/collaborator-update-campaigns", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertCollaboratorUpdateCampaignSchema.parse(req.body);
      const ALLOWED_LANGS = ["auto", "sk", "cs", "hu", "ro", "it", "de", "en"];
      if (parsed.language && !ALLOWED_LANGS.includes(parsed.language)) {
        return res.status(400).json({ message: "Invalid language" });
      }
      if (parsed.formType && !["update", "jmhz"].includes(parsed.formType)) {
        return res.status(400).json({ message: "Invalid form type" });
      }
      const recipients = await findRecipients((parsed.filterCriteria || {}) as FilterCriteria);
      if (recipients.length === 0) {
        return res.status(400).json({ message: "No recipients match the filter" });
      }
      const [campaign] = await db.insert(collaboratorUpdateCampaigns).values({
        ...parsed,
        createdBy: (req.session as any)?.userId || null,
      }).returning();

      const expiresAt = new Date(Date.now() + (parsed.tokenValidDays || 30) * 24 * 3600 * 1000);
      const rows = recipients.map(r => ({
        campaignId: campaign.id,
        collaboratorId: r.id,
        token: crypto.randomBytes(24).toString("base64url"),
        email: r.email!,
        language: campaign.language && campaign.language !== "auto"
          ? campaign.language
          : countryToLanguage(r.countryCode),
        expiresAt,
      }));
      for (let i = 0; i < rows.length; i += 500) {
        await db.insert(collaboratorUpdateRequests).values(rows.slice(i, i + 500));
      }
      res.json({ ...campaign, recipientCount: rows.length });
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Failed to create campaign" });
    }
  });

  // Delete a campaign together with all its requests (links stop working)
  app.delete("/api/collaborator-update-campaigns/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const [campaign] = await db.select().from(collaboratorUpdateCampaigns)
        .where(eq(collaboratorUpdateCampaigns.id, req.params.id));
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      if (campaign.status === "sending") return res.status(409).json({ message: "Campaign is currently sending" });
      await db.transaction(async (tx) => {
        await tx.delete(collaboratorUpdateRequests)
          .where(eq(collaboratorUpdateRequests.campaignId, campaign.id));
        await tx.delete(collaboratorUpdateCampaigns)
          .where(eq(collaboratorUpdateCampaigns.id, campaign.id));
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to delete campaign" });
    }
  });

  // Edit filter criteria — only for draft campaigns (nothing sent yet).
  // Existing (unsent) requests are dropped and regenerated from the new filter.
  app.patch("/api/collaborator-update-campaigns/:id/filter", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const [campaign] = await db.select().from(collaboratorUpdateCampaigns)
        .where(eq(collaboratorUpdateCampaigns.id, req.params.id));
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      if (campaign.status !== "draft") {
        return res.status(409).json({ message: "Only draft campaigns can be edited" });
      }
      const anySent = await db.select({ id: collaboratorUpdateRequests.id })
        .from(collaboratorUpdateRequests)
        .where(and(
          eq(collaboratorUpdateRequests.campaignId, campaign.id),
          notInArray(collaboratorUpdateRequests.status, ["pending"]),
        )).limit(1);
      if (anySent.length > 0) {
        return res.status(409).json({ message: "Some emails were already sent — filter can no longer be changed" });
      }
      const filterCriteria = (req.body?.filterCriteria || {}) as FilterCriteria;
      const recipients = await findRecipients(filterCriteria);
      if (recipients.length === 0) {
        return res.status(400).json({ message: "No recipients match the filter" });
      }
      // Atomic: lock the campaign row, re-check status + request states inside
      // the transaction so a concurrent /send cannot interleave with the rebuild
      const rowCount = await db.transaction(async (tx) => {
        const [locked] = await tx.select().from(collaboratorUpdateCampaigns)
          .where(eq(collaboratorUpdateCampaigns.id, campaign.id))
          .for("update");
        if (!locked || locked.status !== "draft") {
          throw Object.assign(new Error("Only draft campaigns can be edited"), { statusCode: 409 });
        }
        const sentInTx = await tx.select({ id: collaboratorUpdateRequests.id })
          .from(collaboratorUpdateRequests)
          .where(and(
            eq(collaboratorUpdateRequests.campaignId, campaign.id),
            notInArray(collaboratorUpdateRequests.status, ["pending"]),
          )).limit(1);
        if (sentInTx.length > 0) {
          throw Object.assign(new Error("Some emails were already sent — filter can no longer be changed"), { statusCode: 409 });
        }
        await tx.update(collaboratorUpdateCampaigns)
          .set({ filterCriteria, updatedAt: new Date() })
          .where(eq(collaboratorUpdateCampaigns.id, campaign.id));
        await tx.delete(collaboratorUpdateRequests)
          .where(eq(collaboratorUpdateRequests.campaignId, campaign.id));
        const expiresAt = new Date(Date.now() + (locked.tokenValidDays || 30) * 24 * 3600 * 1000);
        const rows = recipients.map(r => ({
          campaignId: campaign.id,
          collaboratorId: r.id,
          token: crypto.randomBytes(24).toString("base64url"),
          email: r.email!,
          language: locked.language && locked.language !== "auto"
            ? locked.language
            : countryToLanguage(r.countryCode),
          expiresAt,
        }));
        for (let i = 0; i < rows.length; i += 500) {
          await tx.insert(collaboratorUpdateRequests).values(rows.slice(i, i + 500));
        }
        return rows.length;
      });
      res.json({ ok: true, recipientCount: rowCount });
    } catch (err: any) {
      res.status(err?.statusCode || 500).json({ message: err?.message || "Failed to update filter" });
    }
  });

  app.get("/api/collaborator-update-campaigns/:id/requests", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const rows = await db.select({
        request: collaboratorUpdateRequests,
        firstName: collaborators.firstName,
        lastName: collaborators.lastName,
        titleBefore: collaborators.titleBefore,
        countryCode: collaborators.countryCode,
      }).from(collaboratorUpdateRequests)
        .leftJoin(collaborators, eq(collaborators.id, collaboratorUpdateRequests.collaboratorId))
        .where(eq(collaboratorUpdateRequests.campaignId, req.params.id))
        .orderBy(desc(collaboratorUpdateRequests.submittedAt), collaborators.lastName);
      res.json(rows.map(r => ({
        id: r.request.id,
        campaignId: r.request.campaignId,
        isTest: r.request.token.startsWith("test-"),
        collaboratorId: r.request.token.startsWith("test-") ? null : r.request.collaboratorId,
        email: r.request.email,
        language: r.request.language,
        status: r.request.status,
        sendError: r.request.sendError,
        sentAt: r.request.sentAt,
        remindedAt: r.request.remindedAt,
        openedAt: r.request.openedAt,
        submittedAt: r.request.submittedAt,
        expiresAt: r.request.expiresAt,
        changes: r.request.changes,
        reviewedBy: r.request.reviewedBy,
        reviewedAt: r.request.reviewedAt,
        collaboratorName: r.request.token.startsWith("test-")
          ? "[TEST] " + [TEST_SAMPLE.titleBefore, TEST_SAMPLE.firstName, TEST_SAMPLE.lastName].filter(Boolean).join(" ")
          : [r.titleBefore, r.firstName, r.lastName].filter(Boolean).join(" "),
        countryCode: r.request.token.startsWith("test-") ? null : r.countryCode,
      })));
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to load requests" });
    }
  });

  app.post("/api/collaborator-update-campaigns/:id/send", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const [campaign] = await db.select().from(collaboratorUpdateCampaigns)
        .where(eq(collaboratorUpdateCampaigns.id, req.params.id));
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      if (campaign.status === "sending") return res.status(409).json({ message: "Already sending" });
      // Compare-and-set: only flip to sending if nobody else did meanwhile
      const flipped = await db.update(collaboratorUpdateCampaigns)
        .set({ status: "sending", updatedAt: new Date() })
        .where(and(
          eq(collaboratorUpdateCampaigns.id, campaign.id),
          ne(collaboratorUpdateCampaigns.status, "sending"),
        )).returning({ id: collaboratorUpdateCampaigns.id });
      if (flipped.length === 0) return res.status(409).json({ message: "Already sending" });
      const baseUrl = getBaseUrl(req);
      sendCampaignEmails(campaign.id, baseUrl, false).catch(err =>
        console.error("[CollabUpdate] send error:", err?.message));
      res.json({ ok: true, message: "Sending started" });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to start sending" });
    }
  });

  // Pause an in-progress send: CAS sending → paused; the send loop notices and stops.
  app.post("/api/collaborator-update-campaigns/:id/pause", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const flipped = await db.update(collaboratorUpdateCampaigns)
        .set({ status: "paused", updatedAt: new Date() })
        .where(and(
          eq(collaboratorUpdateCampaigns.id, req.params.id),
          eq(collaboratorUpdateCampaigns.status, "sending"),
        )).returning({ id: collaboratorUpdateCampaigns.id });
      if (flipped.length === 0) return res.status(409).json({ message: "Campaign is not sending" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to pause" });
    }
  });

  app.post("/api/collaborator-update-campaigns/:id/remind", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const [campaign] = await db.select().from(collaboratorUpdateCampaigns)
        .where(eq(collaboratorUpdateCampaigns.id, req.params.id));
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      if (campaign.status === "sending") return res.status(409).json({ message: "Already sending" });
      const flipped = await db.update(collaboratorUpdateCampaigns)
        .set({ status: "sending", updatedAt: new Date() })
        .where(and(
          eq(collaboratorUpdateCampaigns.id, campaign.id),
          ne(collaboratorUpdateCampaigns.status, "sending"),
        )).returning({ id: collaboratorUpdateCampaigns.id });
      if (flipped.length === 0) return res.status(409).json({ message: "Already sending" });
      const baseUrl = getBaseUrl(req);
      sendCampaignEmails(campaign.id, baseUrl, true).catch(err =>
        console.error("[CollabUpdate] remind error:", err?.message));
      res.json({ ok: true, message: "Reminders started" });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to start reminders" });
    }
  });

  // Test send: creates a test request for the first matched recipient and emails
  // the campaign email to the given test address. The link is fully functional,
  // so the whole flow (form -> submit -> approval queue) can be tested safely.
  app.post("/api/collaborator-update-campaigns/:id/test", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const testEmail = String(req.body?.email || "").trim();
      if (!testEmail || !testEmail.includes("@")) {
        return res.status(400).json({ message: "Valid test email required" });
      }
      const [campaign] = await db.select().from(collaboratorUpdateCampaigns)
        .where(eq(collaboratorUpdateCampaigns.id, req.params.id));
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });

      // language of the first recipient (or campaign language) — only for the
      // form language; NO real collaborator data is used in test sends
      const [sampleReq] = await db.select().from(collaboratorUpdateRequests)
        .where(eq(collaboratorUpdateRequests.campaignId, campaign.id))
        .limit(1);
      if (!sampleReq) return res.status(400).json({ message: "Campaign has no recipients" });

      // dedicated test request so the real recipient's link stays untouched;
      // the form will show fictional sample data, never the collaborator's data
      const [testReq] = await db.insert(collaboratorUpdateRequests).values({
        campaignId: campaign.id,
        collaboratorId: sampleReq.collaboratorId,
        token: "test-" + crypto.randomBytes(18).toString("base64url"),
        email: testEmail,
        language: sampleReq.language,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      }).returning();

      const baseUrl = getBaseUrl(req);
      const link = `${baseUrl}/update/${testReq.token}`;
      const vars: Record<string, string> = {
        firstName: TEST_SAMPLE.firstName,
        lastName: TEST_SAMPLE.lastName,
        fullName: [TEST_SAMPLE.titleBefore, TEST_SAMPLE.firstName, TEST_SAMPLE.lastName].filter(Boolean).join(" "),
        titleBefore: TEST_SAMPLE.titleBefore,
        link,
      };
      const subject = "[TEST] " + renderTemplate(campaign.emailSubject, vars);
      let body = renderTemplate(campaign.emailBody, vars);
      if (!campaign.emailBody.includes("{{link}}")) {
        body += `<p><a href="${link}">${link}</a></p>`;
      }

      const markFailed = async (msg: string) => {
        await db.update(collaboratorUpdateRequests)
          .set({ status: "send_failed", sendError: msg })
          .where(eq(collaboratorUpdateRequests.id, testReq.id));
        // return the link anyway so the admin can still test the form directly
        return res.json({ ok: false, link, message: msg });
      };

      const conn: any = await storage.getSystemMs365Connection(campaign.senderCountryCode);
      if (!conn?.accessToken) return markFailed("MS365 mailbox not connected");
      const tokenInfo = await getValidAccessToken(
        decryptTokenSafe(conn.accessToken),
        conn.tokenExpiresAt,
        conn.refreshToken ? decryptTokenSafe(conn.refreshToken) : null,
      );
      if (!tokenInfo?.accessToken) return markFailed("MS365 token refresh failed");
      if (tokenInfo.refreshed) {
        try {
          await storage.updateSystemMs365Connection(campaign.senderCountryCode, {
            accessToken: tokenInfo.accessToken,
            refreshToken: tokenInfo.refreshToken || conn.refreshToken,
            tokenExpiresAt: tokenInfo.expiresOn || undefined,
          } as any);
        } catch {}
      }
      try {
        await ms365SendEmail(tokenInfo.accessToken, [testEmail], subject, body, true);
      } catch (err: any) {
        return markFailed(err?.message || "send failed");
      }
      await db.update(collaboratorUpdateRequests)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(collaboratorUpdateRequests.id, testReq.id));
      res.json({ ok: true, link });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Test send failed" });
    }
  });

  app.post("/api/collaborator-update-requests/:id/approve", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const [reqRow] = await db.select().from(collaboratorUpdateRequests)
        .where(eq(collaboratorUpdateRequests.id, req.params.id));
      if (!reqRow) return res.status(404).json({ message: "Request not found" });
      if (reqRow.status !== "submitted") return res.status(409).json({ message: "Not in submitted state" });

      // Test submissions (token prefixed "test-") never touch real collaborator data:
      // approving them only marks the request approved, without applying changes.
      const isTest = reqRow.token.startsWith("test-");

      const changes = isTest ? [] : (reqRow.changes || []);
      const collabUpdate: Record<string, any> = {};
      const addressUpdates: Record<string, Record<string, string | null>> = {};

      for (const ch of changes) {
        if (ch.field.startsWith("addr_")) {
          // addr_<type>_<subfield>
          const m = ch.field.match(/^addr_(\w+?)_(streetNumber|city|postalCode)$/);
          if (m && (ADDRESS_TYPES as readonly string[]).includes(m[1])) {
            addressUpdates[m[1]] = addressUpdates[m[1]] || {};
            addressUpdates[m[1]][m[2]] = ch.newValue;
          }
        } else if ((EDITABLE_FIELDS as readonly string[]).includes(ch.field)) {
          collabUpdate[ch.field] = ch.newValue;
        }
      }

      if (Object.keys(collabUpdate).length > 0) {
        collabUpdate.updatedAt = new Date();
        await db.update(collaborators).set(collabUpdate)
          .where(eq(collaborators.id, reqRow.collaboratorId));
      }
      for (const [addrType, fields] of Object.entries(addressUpdates)) {
        const [existing] = await db.select().from(collaboratorAddresses)
          .where(and(
            eq(collaboratorAddresses.collaboratorId, reqRow.collaboratorId),
            eq(collaboratorAddresses.addressType, addrType),
          ));
        if (existing) {
          await db.update(collaboratorAddresses).set(fields)
            .where(eq(collaboratorAddresses.id, existing.id));
        } else {
          const [collab] = await db.select({ countryCode: collaborators.countryCode })
            .from(collaborators).where(eq(collaborators.id, reqRow.collaboratorId));
          await db.insert(collaboratorAddresses).values({
            collaboratorId: reqRow.collaboratorId,
            addressType: addrType,
            countryCode: collab?.countryCode || null,
            ...fields,
          });
        }
      }

      const [updated] = await db.update(collaboratorUpdateRequests).set({
        status: "approved",
        reviewedBy: (req.session as any)?.userId || null,
        reviewedAt: new Date(),
        reviewNote: req.body?.note || null,
      }).where(eq(collaboratorUpdateRequests.id, reqRow.id)).returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to approve" });
    }
  });

  app.post("/api/collaborator-update-requests/:id/reject", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const [updated] = await db.update(collaboratorUpdateRequests).set({
        status: "rejected",
        reviewedBy: (req.session as any)?.userId || null,
        reviewedAt: new Date(),
        reviewNote: req.body?.note || null,
      }).where(and(
        eq(collaboratorUpdateRequests.id, req.params.id),
        eq(collaboratorUpdateRequests.status, "submitted"),
      )).returning();
      if (!updated) return res.status(409).json({ message: "Not in submitted state" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to reject" });
    }
  });

  // ---------- PUBLIC ----------

  app.get("/api/public/collaborator-update/:token", async (req: Request, res: Response) => {
    try {
      const [reqRow] = await db.select().from(collaboratorUpdateRequests)
        .where(eq(collaboratorUpdateRequests.token, req.params.token));
      if (!reqRow) return res.status(404).json({ message: "not_found" });
      if (new Date(reqRow.expiresAt) < new Date()) return res.status(410).json({ message: "expired", language: reqRow.language });
      if (["submitted", "approved", "rejected"].includes(reqRow.status)) {
        return res.status(409).json({ message: "already_submitted", language: reqRow.language });
      }

      if (reqRow.status === "sent" || reqRow.status === "pending") {
        await db.update(collaboratorUpdateRequests)
          .set({ status: "opened", openedAt: reqRow.openedAt || new Date() })
          .where(eq(collaboratorUpdateRequests.id, reqRow.id));
      }

      const [camp] = await db.select().from(collaboratorUpdateCampaigns)
        .where(eq(collaboratorUpdateCampaigns.id, reqRow.campaignId));
      const formType = camp?.formType || "update";

      // JMHZ form collects NEW data — only the collaborator's name, profession
      // and stored maiden name are exposed so the person can verify identity
      if (formType === "jmhz") {
        if (reqRow.token.startsWith("test-")) {
          return res.json({
            language: reqRow.language,
            formType,
            birthNumberMasked: null,
            collaboratorName: [TEST_SAMPLE.titleBefore, TEST_SAMPLE.firstName, TEST_SAMPLE.lastName].filter(Boolean).join(" "),
            collaboratorInfo: {
              profession: "Lékař",
              workplace: "Nemocnice Brno",
              email: "jan.novak@example.cz",
              maidenName: "Nováková",
              contact: {
                email: "jan.novak@example.cz",
                phone: "+420 777 123 456",
                bankAccountIban: "CZ65 0800 0000 1920 0014 5399",
                addr_permanent_streetNumber: "Hlavní 12",
                addr_permanent_city: "Brno",
                addr_permanent_postalCode: "602 00",
              },
            },
            isTest: true,
            data: {},
          });
        }
        const [cj] = await db.select().from(collaborators)
          .where(eq(collaborators.id, reqRow.collaboratorId));
        if (!cj) return res.status(404).json({ message: "not_found" });
        const [permAddr] = await db.select().from(collaboratorAddresses)
          .where(and(
            eq(collaboratorAddresses.collaboratorId, cj.id),
            eq(collaboratorAddresses.addressType, "permanent"),
          ));
        return res.json({
          language: reqRow.language,
          formType,
          birthNumberMasked: null,
          collaboratorName: [cj.titleBefore, cj.firstName, cj.lastName].filter(Boolean).join(" "),
          collaboratorInfo: {
            profession: cj.professionalClassification || "",
            workplace: cj.workplaceName || "",
            email: cj.email || "",
            maidenName: cj.maidenName || "",
            contact: {
              email: cj.email || "",
              phone: cj.phone || cj.mobile || "",
              bankAccountIban: cj.bankAccountIban || "",
              addr_permanent_streetNumber: permAddr?.streetNumber || "",
              addr_permanent_city: permAddr?.city || "",
              addr_permanent_postalCode: permAddr?.postalCode || "",
            },
          },
          data: {},
        });
      }

      // Test tokens: show fictional sample data — never a real collaborator's data
      if (reqRow.token.startsWith("test-")) {
        const data: Record<string, any> = { ...TEST_SAMPLE };
        for (const t of ADDRESS_TYPES) {
          for (const sf of ADDRESS_SUBFIELDS) {
            data[`addr_${t}_${sf}`] = TEST_SAMPLE_ADDR[t]?.[sf] ?? "";
          }
        }
        return res.json({
          language: reqRow.language,
          formType,
          birthNumberMasked: "0000******",
          collaboratorName: [TEST_SAMPLE.titleBefore, TEST_SAMPLE.firstName, TEST_SAMPLE.lastName].filter(Boolean).join(" "),
          isTest: true,
          data,
        });
      }

      const [c] = await db.select().from(collaborators)
        .where(eq(collaborators.id, reqRow.collaboratorId));
      if (!c) return res.status(404).json({ message: "not_found" });

      const addresses = await db.select().from(collaboratorAddresses)
        .where(eq(collaboratorAddresses.collaboratorId, c.id));
      const addrByType: Record<string, any> = {};
      for (const a of addresses) addrByType[a.addressType] = a;

      const data: Record<string, any> = {};
      for (const f of EDITABLE_FIELDS) data[f] = (c as any)[f] ?? "";
      for (const t of ADDRESS_TYPES) {
        for (const sf of ADDRESS_SUBFIELDS) {
          data[`addr_${t}_${sf}`] = addrByType[t]?.[sf] ?? "";
        }
      }

      res.json({
        language: reqRow.language,
        formType,
        birthNumberMasked: maskBirthNumber(c.birthNumber),
        collaboratorName: [c.titleBefore, c.firstName, c.lastName].filter(Boolean).join(" "),
        data,
      });
    } catch (err: any) {
      res.status(500).json({ message: "server_error" });
    }
  });

  app.post("/api/public/collaborator-update/:token", async (req: Request, res: Response) => {
    try {
      const [reqRow] = await db.select().from(collaboratorUpdateRequests)
        .where(eq(collaboratorUpdateRequests.token, req.params.token));
      if (!reqRow) return res.status(404).json({ message: "not_found" });
      if (new Date(reqRow.expiresAt) < new Date()) return res.status(410).json({ message: "expired" });
      if (["submitted", "approved", "rejected"].includes(reqRow.status)) {
        return res.status(409).json({ message: "already_submitted" });
      }
      const isTest = reqRow.token.startsWith("test-");

      const [camp] = await db.select().from(collaboratorUpdateCampaigns)
        .where(eq(collaboratorUpdateCampaigns.id, reqRow.campaignId));

      // JMHZ form: all 8 fields required + explicit consent; data is stored on
      // the request only (no collaborator columns exist for these fields)
      if ((camp?.formType || "update") === "jmhz") {
        const submittedJ = (req.body?.data || {}) as Record<string, any>;
        if (req.body?.consent !== true) {
          return res.status(400).json({ message: "consent_required" });
        }
        const missing = validateJmhzSubmission(submittedJ);
        if (missing) {
          return res.status(400).json({ message: "invalid_data", field: missing });
        }
        const cleanJ: Record<string, string> = { consent: "Ano" };
        const changesJ: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
        for (const f of JMHZ_FIELDS) {
          const v = String(submittedJ[f]).trim().slice(0, 500);
          cleanJ[f] = v;
          changesJ.push({ field: `jmhz_${f}`, oldValue: null, newValue: v });
        }

        // Optional contact-data updates (address, bank account, email, phone).
        // Field names match EDITABLE_FIELDS / addr_* so approve applies them.
        const contactUpdates = (req.body?.contactUpdates || {}) as Record<string, any>;
        if (contactUpdates && typeof contactUpdates === "object") {
          let oldJ: (f: string) => string = () => "";
          if (!isTest) {
            const [cOld] = await db.select().from(collaborators)
              .where(eq(collaborators.id, reqRow.collaboratorId));
            const [aOld] = await db.select().from(collaboratorAddresses)
              .where(and(
                eq(collaboratorAddresses.collaboratorId, reqRow.collaboratorId),
                eq(collaboratorAddresses.addressType, "permanent"),
              ));
            oldJ = (f) => {
              const m = f.match(/^addr_permanent_(streetNumber|city|postalCode)$/);
              if (m) return String((aOld as any)?.[m[1]] ?? "");
              return String((cOld as any)?.[f] ?? "");
            };
          }
          for (const f of JMHZ_CONTACT_FIELDS) {
            if (!(f in contactUpdates)) continue;
            const nv = String(contactUpdates[f] ?? "").trim().slice(0, 500);
            const ov = oldJ(f).trim();
            if (!nv || nv === ov) continue;
            cleanJ[`contact_${f}`] = nv;
            changesJ.push({ field: f, oldValue: ov || null, newValue: nv });
          }
        }
        const [updatedJ] = await db.update(collaboratorUpdateRequests).set({
          status: "submitted",
          submittedAt: new Date(),
          submittedData: cleanJ,
          changes: changesJ,
        }).where(and(
          eq(collaboratorUpdateRequests.id, reqRow.id),
          inArray(collaboratorUpdateRequests.status, ["pending", "sent", "opened"]),
        )).returning();
        if (!updatedJ) return res.status(409).json({ message: "already_submitted" });
        return res.json({ ok: true, changesCount: changesJ.length });
      }

      let oldFieldValue: (f: string) => any;
      let oldAddrValue: (t: string, sf: string) => any;
      if (isTest) {
        // Test submissions diff against the fictional sample data — real
        // collaborator data is never read or stored for test tokens
        oldFieldValue = (f) => TEST_SAMPLE[f];
        oldAddrValue = (t, sf) => TEST_SAMPLE_ADDR[t]?.[sf];
      } else {
        const [c] = await db.select().from(collaborators)
          .where(eq(collaborators.id, reqRow.collaboratorId));
        if (!c) return res.status(404).json({ message: "not_found" });
        const addresses = await db.select().from(collaboratorAddresses)
          .where(eq(collaboratorAddresses.collaboratorId, c.id));
        const addrByType: Record<string, any> = {};
        for (const a of addresses) addrByType[a.addressType] = a;
        oldFieldValue = (f) => (c as any)[f];
        oldAddrValue = (t, sf) => addrByType[t]?.[sf];
      }

      const submitted = (req.body?.data || {}) as Record<string, any>;

      const norm = (v: any) => {
        const s = v === null || v === undefined ? "" : String(v).trim();
        return s;
      };
      const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
      const cleanData: Record<string, string> = {};

      for (const f of EDITABLE_FIELDS) {
        if (!(f in submitted)) continue;
        const newV = norm(submitted[f]).slice(0, 500);
        const oldV = norm(oldFieldValue(f));
        cleanData[f] = newV;
        if (newV !== oldV) changes.push({ field: f, oldValue: oldV || null, newValue: newV || null });
      }
      for (const t of ADDRESS_TYPES) {
        for (const sf of ADDRESS_SUBFIELDS) {
          const key = `addr_${t}_${sf}`;
          if (!(key in submitted)) continue;
          const newV = norm(submitted[key]).slice(0, 500);
          const oldV = norm(oldAddrValue(t, sf));
          cleanData[key] = newV;
          if (newV !== oldV) changes.push({ field: key, oldValue: oldV || null, newValue: newV || null });
        }
      }

      // basic validation: firstName/lastName must not be emptied
      if ("firstName" in cleanData && !cleanData.firstName) {
        return res.status(400).json({ message: "invalid_data" });
      }
      if ("lastName" in cleanData && !cleanData.lastName) {
        return res.status(400).json({ message: "invalid_data" });
      }

      // single-use guard against concurrent submits
      const [updated] = await db.update(collaboratorUpdateRequests).set({
        status: "submitted",
        submittedAt: new Date(),
        submittedData: cleanData,
        changes,
      }).where(and(
        eq(collaboratorUpdateRequests.id, reqRow.id),
        inArray(collaboratorUpdateRequests.status, ["pending", "sent", "opened"]),
      )).returning();
      if (!updated) return res.status(409).json({ message: "already_submitted" });

      res.json({ ok: true, changesCount: changes.length });
    } catch (err: any) {
      res.status(500).json({ message: "server_error" });
    }
  });
}
