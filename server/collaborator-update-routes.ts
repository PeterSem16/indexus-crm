import { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, inArray, isNotNull, ne, sql as dsql } from "drizzle-orm";
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

  let tokenInfo = await getValidAccessToken(conn.accessToken, conn.tokenExpiresAt, conn.refreshToken);
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

  let sent = 0, failed = 0;
  for (const reqRow of requests) {
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
      const ti = await getValidAccessToken(fresh.accessToken, fresh.tokenExpiresAt, fresh.refreshToken);
      if (ti?.accessToken) tokenInfo = ti;
    }
  }

  await db.update(collaboratorUpdateCampaigns)
    .set({ status: "sent", updatedAt: new Date() })
    .where(eq(collaboratorUpdateCampaigns.id, campaignId));
  console.log(`[CollabUpdate] Campaign ${campaignId}: ${sent} sent, ${failed} failed (reminder=${onlyReminder})`);
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
        collaboratorId: r.request.collaboratorId,
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
        collaboratorName: [r.titleBefore, r.firstName, r.lastName].filter(Boolean).join(" "),
        countryCode: r.countryCode,
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
      await db.update(collaboratorUpdateCampaigns)
        .set({ status: "sending", updatedAt: new Date() })
        .where(eq(collaboratorUpdateCampaigns.id, campaign.id));
      const baseUrl = getBaseUrl(req);
      sendCampaignEmails(campaign.id, baseUrl, false).catch(err =>
        console.error("[CollabUpdate] send error:", err?.message));
      res.json({ ok: true, message: "Sending started" });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to start sending" });
    }
  });

  app.post("/api/collaborator-update-campaigns/:id/remind", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const [campaign] = await db.select().from(collaboratorUpdateCampaigns)
        .where(eq(collaboratorUpdateCampaigns.id, req.params.id));
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      if (campaign.status === "sending") return res.status(409).json({ message: "Already sending" });
      await db.update(collaboratorUpdateCampaigns)
        .set({ status: "sending", updatedAt: new Date() })
        .where(eq(collaboratorUpdateCampaigns.id, campaign.id));
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

      // use the first recipient of the campaign as the sample collaborator
      const [sampleReq] = await db.select().from(collaboratorUpdateRequests)
        .where(eq(collaboratorUpdateRequests.campaignId, campaign.id))
        .limit(1);
      if (!sampleReq) return res.status(400).json({ message: "Campaign has no recipients" });
      const [c] = await db.select().from(collaborators)
        .where(eq(collaborators.id, sampleReq.collaboratorId));
      if (!c) return res.status(400).json({ message: "Sample collaborator not found" });

      // dedicated test request so the real recipient's link stays untouched
      const [testReq] = await db.insert(collaboratorUpdateRequests).values({
        campaignId: campaign.id,
        collaboratorId: c.id,
        token: "test-" + crypto.randomBytes(18).toString("base64url"),
        email: testEmail,
        language: sampleReq.language,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      }).returning();

      const baseUrl = getBaseUrl(req);
      const link = `${baseUrl}/update/${testReq.token}`;
      const vars: Record<string, string> = {
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        fullName: [c.titleBefore, c.firstName, c.lastName].filter(Boolean).join(" "),
        titleBefore: c.titleBefore || "",
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
      const tokenInfo = await getValidAccessToken(conn.accessToken, conn.tokenExpiresAt, conn.refreshToken);
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
      if (new Date(reqRow.expiresAt) < new Date()) return res.status(410).json({ message: "expired" });
      if (["submitted", "approved", "rejected"].includes(reqRow.status)) {
        return res.status(409).json({ message: "already_submitted", language: reqRow.language });
      }
      const [c] = await db.select().from(collaborators)
        .where(eq(collaborators.id, reqRow.collaboratorId));
      if (!c) return res.status(404).json({ message: "not_found" });

      if (reqRow.status === "sent" || reqRow.status === "pending") {
        await db.update(collaboratorUpdateRequests)
          .set({ status: "opened", openedAt: reqRow.openedAt || new Date() })
          .where(eq(collaboratorUpdateRequests.id, reqRow.id));
      }

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
      const [c] = await db.select().from(collaborators)
        .where(eq(collaborators.id, reqRow.collaboratorId));
      if (!c) return res.status(404).json({ message: "not_found" });

      const submitted = (req.body?.data || {}) as Record<string, any>;
      const addresses = await db.select().from(collaboratorAddresses)
        .where(eq(collaboratorAddresses.collaboratorId, c.id));
      const addrByType: Record<string, any> = {};
      for (const a of addresses) addrByType[a.addressType] = a;

      const norm = (v: any) => {
        const s = v === null || v === undefined ? "" : String(v).trim();
        return s;
      };
      const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
      const cleanData: Record<string, string> = {};

      for (const f of EDITABLE_FIELDS) {
        if (!(f in submitted)) continue;
        const newV = norm(submitted[f]).slice(0, 500);
        const oldV = norm((c as any)[f]);
        cleanData[f] = newV;
        if (newV !== oldV) changes.push({ field: f, oldValue: oldV || null, newValue: newV || null });
      }
      for (const t of ADDRESS_TYPES) {
        for (const sf of ADDRESS_SUBFIELDS) {
          const key = `addr_${t}_${sf}`;
          if (!(key in submitted)) continue;
          const newV = norm(submitted[key]).slice(0, 500);
          const oldV = norm(addrByType[t]?.[sf]);
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
