import crypto from "crypto";
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  campaignContactStatusListState,
  campaigns,
  campaignStatusListAutomations,
  campaignStatusListItems,
  campaignStatusListQuestions,
  nexusPulseModuleRevisions,
} from "@shared/schema";

type Snapshot = {
  schemaVersion: 1;
  campaign: {
    settings: unknown;
    defaultActiveTab: string | null;
  };
  statusListItems: Array<Record<string, unknown>>;
  questions: Array<Record<string, unknown>>;
  automations: Array<Record<string, unknown>>;
};

type SnapshotChange = {
  path: string;
  type: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
};

const NEXUS_PULSE_SETTING_KEYS = [
  "keepContactOpenAfterDisposition",
  "skipEmailSmsDisposition",
  "nexusPulseEmailMode",
  "nexusPulseEmailAddress",
  "queueDisplayMode",
] as const;

const stripTimestamps = <T extends Record<string, unknown>>(row: T) => {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = row;
  return rest;
};

const parseSettings = (settings: string | null): unknown => {
  if (!settings) return {};
  try {
    return JSON.parse(settings);
  } catch {
    return settings;
  }
};

const stringifySettings = (settings: unknown): string =>
  typeof settings === "string" ? settings : JSON.stringify(settings ?? {});

function pickNexusPulseSettings(settings: string | null): Record<string, unknown> {
  const parsed = parseSettings(settings);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const source = parsed as Record<string, unknown>;
  return Object.fromEntries(
    NEXUS_PULSE_SETTING_KEYS
      .filter((key) => Object.prototype.hasOwnProperty.call(source, key))
      .map((key) => [key, source[key]]),
  );
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonicalize((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

const hashSnapshot = (snapshot: Snapshot): string =>
  crypto.createHash("sha256").update(JSON.stringify(canonicalize(snapshot))).digest("hex");

function compactValue(value: unknown): unknown {
  if (value === undefined || value === null || typeof value !== "object") return value;
  const serialized = JSON.stringify(value);
  return serialized.length <= 800 ? value : `${serialized.slice(0, 797)}...`;
}

function diffValues(before: unknown, after: unknown, path = "", changes: SnapshotChange[] = []): SnapshotChange[] {
  if (changes.length >= 1000) return changes;
  if (Object.is(before, after)) return changes;

  if (Array.isArray(before) && Array.isArray(after)) {
    const areEntityLists = [...before, ...after].every(
      (entry) => entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).id === "string",
    );
    if (areEntityLists) {
      const beforeById = new Map(before.map((entry) => [String((entry as Record<string, unknown>).id), entry]));
      const afterById = new Map(after.map((entry) => [String((entry as Record<string, unknown>).id), entry]));
      const ids = Array.from(new Set([...beforeById.keys(), ...afterById.keys()])).sort();
      for (const id of ids) {
        diffValues(beforeById.get(id), afterById.get(id), `${path}[${id}]`, changes);
      }
      return changes;
    }
  }

  if (
    before && after &&
    typeof before === "object" && typeof after === "object" &&
    !Array.isArray(before) && !Array.isArray(after)
  ) {
    const beforeObject = before as Record<string, unknown>;
    const afterObject = after as Record<string, unknown>;
    const keys = Array.from(new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)])).sort();
    for (const key of keys) {
      diffValues(beforeObject[key], afterObject[key], path ? `${path}.${key}` : key, changes);
    }
    return changes;
  }

  if (before === undefined) {
    changes.push({ path, type: "added", after: compactValue(after) });
  } else if (after === undefined) {
    changes.push({ path, type: "removed", before: compactValue(before) });
  } else {
    changes.push({ path, type: "changed", before: compactValue(before), after: compactValue(after) });
  }
  return changes;
}

async function buildSnapshot(executor: any, campaignId: string): Promise<Snapshot | null> {
  const [campaign] = await executor
    .select({
      id: campaigns.id,
      settings: campaigns.settings,
      defaultActiveTab: campaigns.defaultActiveTab,
    })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!campaign) return null;

  const items = await executor
    .select()
    .from(campaignStatusListItems)
    .where(eq(campaignStatusListItems.campaignId, campaignId))
    .orderBy(asc(campaignStatusListItems.sortOrder), asc(campaignStatusListItems.id));
  const itemIds = items.map((item: { id: string }) => item.id);
  const questions = itemIds.length
    ? await executor
      .select()
      .from(campaignStatusListQuestions)
      .where(inArray(campaignStatusListQuestions.itemId, itemIds))
      .orderBy(asc(campaignStatusListQuestions.sortOrder), asc(campaignStatusListQuestions.id))
    : [];
  const questionIds = questions.map((question: { id: string }) => question.id);
  const itemAutomations = itemIds.length
    ? await executor
      .select()
      .from(campaignStatusListAutomations)
      .where(inArray(campaignStatusListAutomations.statusListItemId, itemIds))
      .orderBy(asc(campaignStatusListAutomations.sortOrder), asc(campaignStatusListAutomations.id))
    : [];
  const questionAutomations = questionIds.length
    ? await executor
      .select()
      .from(campaignStatusListAutomations)
      .where(inArray(campaignStatusListAutomations.questionId, questionIds))
      .orderBy(asc(campaignStatusListAutomations.sortOrder), asc(campaignStatusListAutomations.id))
    : [];
  const automationsById = new Map<string, Record<string, unknown>>();
  for (const automation of [...itemAutomations, ...questionAutomations]) {
    automationsById.set(automation.id, stripTimestamps(automation));
  }

  return {
    schemaVersion: 1,
    campaign: {
      settings: pickNexusPulseSettings(campaign.settings),
      defaultActiveTab: campaign.defaultActiveTab,
    },
    statusListItems: items.map(stripTimestamps),
    questions: questions.map(stripTimestamps),
    automations: Array.from(automationsById.values()).sort(
      (left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) || String(left.id).localeCompare(String(right.id)),
    ),
  };
}

async function createRevision(
  executor: any,
  campaignId: string,
  snapshot: Snapshot,
  userId: string,
  changeNote: string | null,
  restoredFromRevisionId: string | null = null,
) {
  const [latest] = await executor
    .select()
    .from(nexusPulseModuleRevisions)
    .where(eq(nexusPulseModuleRevisions.campaignId, campaignId))
    .orderBy(desc(nexusPulseModuleRevisions.versionNumber))
    .limit(1);
  const contentHash = hashSnapshot(snapshot);
  if (!restoredFromRevisionId && latest?.contentHash === contentHash) {
    return { revision: latest, created: false };
  }

  const now = new Date();
  if (latest) {
    await executor
      .update(nexusPulseModuleRevisions)
      .set({ status: "superseded" })
      .where(and(
        eq(nexusPulseModuleRevisions.campaignId, campaignId),
        eq(nexusPulseModuleRevisions.status, "active"),
      ));
  }
  const [revision] = await executor
    .insert(nexusPulseModuleRevisions)
    .values({
      campaignId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      status: "active",
      parentRevisionId: latest?.id ?? null,
      restoredFromRevisionId,
      snapshot,
      changes: latest ? diffValues(latest.snapshot, snapshot) : [],
      contentHash,
      changeNote,
      createdBy: userId,
      verifiedAt: now,
      activatedAt: now,
    })
    .returning();
  return { revision, created: true };
}

function omitRevisionSnapshot(revision: any) {
  const { snapshot: _snapshot, ...metadata } = revision;
  return metadata;
}

async function restoreSnapshot(executor: any, campaignId: string, snapshot: Snapshot) {
  const [currentCampaign] = await executor
    .select({ settings: campaigns.settings })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  const parsedCurrentSettings = parseSettings(currentCampaign?.settings ?? null);
  const mergedSettings = parsedCurrentSettings && typeof parsedCurrentSettings === "object" && !Array.isArray(parsedCurrentSettings)
    ? { ...(parsedCurrentSettings as Record<string, unknown>) }
    : {};
  for (const key of NEXUS_PULSE_SETTING_KEYS) delete mergedSettings[key];
  const restoredNexusSettings = snapshot.campaign.settings;
  if (restoredNexusSettings && typeof restoredNexusSettings === "object" && !Array.isArray(restoredNexusSettings)) {
    Object.assign(mergedSettings, restoredNexusSettings);
  }

  await executor
    .update(campaigns)
    .set({
      settings: stringifySettings(mergedSettings),
      defaultActiveTab: snapshot.campaign.defaultActiveTab,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId));

  const currentItems = await executor
    .select({ id: campaignStatusListItems.id })
    .from(campaignStatusListItems)
    .where(eq(campaignStatusListItems.campaignId, campaignId));
  const desiredItemIds = new Set(snapshot.statusListItems.map((item) => String(item.id)));
  const extraItemIds = currentItems.map((item: { id: string }) => item.id).filter((id: string) => !desiredItemIds.has(id));

  const currentQuestions = currentItems.length
    ? await executor.select({ id: campaignStatusListQuestions.id }).from(campaignStatusListQuestions)
      .where(inArray(campaignStatusListQuestions.itemId, currentItems.map((item: { id: string }) => item.id)))
    : [];
  const desiredQuestionIds = new Set(snapshot.questions.map((question) => String(question.id)));
  const extraQuestionIds = currentQuestions.map((question: { id: string }) => question.id)
    .filter((id: string) => !desiredQuestionIds.has(id));
  if (extraQuestionIds.length) {
    await executor.delete(campaignStatusListAutomations)
      .where(inArray(campaignStatusListAutomations.questionId, extraQuestionIds));
    await executor.delete(campaignStatusListQuestions)
      .where(inArray(campaignStatusListQuestions.id, extraQuestionIds));
  }

  const currentAutomations = currentItems.length
    ? await executor.select({ id: campaignStatusListAutomations.id }).from(campaignStatusListAutomations)
      .where(inArray(campaignStatusListAutomations.statusListItemId, currentItems.map((item: { id: string }) => item.id)))
    : [];
  const desiredAutomationIds = new Set(snapshot.automations.map((automation) => String(automation.id)));
  const extraAutomationIds = currentAutomations.map((automation: { id: string }) => automation.id)
    .filter((id: string) => !desiredAutomationIds.has(id));
  if (extraAutomationIds.length) {
    await executor.delete(campaignStatusListAutomations)
      .where(inArray(campaignStatusListAutomations.id, extraAutomationIds));
  }

  if (extraItemIds.length) {
    const usedRows = await executor
      .select({ statusListItemId: campaignContactStatusListState.statusListItemId })
      .from(campaignContactStatusListState)
      .where(inArray(campaignContactStatusListState.statusListItemId, extraItemIds));
    const usedIds = new Set(usedRows.map((row: { statusListItemId: string }) => row.statusListItemId));
    const deletableIds = extraItemIds.filter((id: string) => !usedIds.has(id));
    const retainedIds = extraItemIds.filter((id: string) => usedIds.has(id));
    if (deletableIds.length) {
      await executor.delete(campaignStatusListItems).where(inArray(campaignStatusListItems.id, deletableIds));
    }
    if (retainedIds.length) {
      await executor.update(campaignStatusListItems)
        .set({ isHidden: true, updatedAt: new Date() })
        .where(inArray(campaignStatusListItems.id, retainedIds));
    }
  }

  for (const item of snapshot.statusListItems) {
    const value = { ...item, campaignId };
    await executor.insert(campaignStatusListItems).values(value)
      .onConflictDoUpdate({ target: campaignStatusListItems.id, set: { ...value, updatedAt: new Date() } });
  }
  for (const question of snapshot.questions) {
    await executor.insert(campaignStatusListQuestions).values(question)
      .onConflictDoUpdate({ target: campaignStatusListQuestions.id, set: { ...question, updatedAt: new Date() } });
  }
  for (const automation of snapshot.automations) {
    await executor.insert(campaignStatusListAutomations).values(automation)
      .onConflictDoUpdate({ target: campaignStatusListAutomations.id, set: { ...automation, updatedAt: new Date() } });
  }
}

export function registerNexusPulseVersionRoutes(app: Express, requireAuth: RequestHandler) {
  const requireManager = (req: Request, res: Response, next: NextFunction) => {
    const user = req.session.user;
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return res.status(403).json({ error: "Admin or manager required" });
    }
    next();
  };

  app.get(
    "/api/campaigns/:campaignId/nexus-pulse/versions",
    requireAuth,
    requireManager,
    async (req, res) => {
      try {
        const revisions = await db
          .select()
          .from(nexusPulseModuleRevisions)
          .where(eq(nexusPulseModuleRevisions.campaignId, req.params.campaignId))
          .orderBy(desc(nexusPulseModuleRevisions.versionNumber));
        res.json({ versions: revisions.map(omitRevisionSnapshot) });
      } catch (error) {
        console.error("Failed to list Nexus Pulse versions:", error);
        res.status(500).json({ error: "Failed to list Nexus Pulse versions" });
      }
    },
  );

  app.get(
    "/api/campaigns/:campaignId/nexus-pulse/versions/:versionNumber",
    requireAuth,
    requireManager,
    async (req, res) => {
      try {
        const versionNumber = Number(req.params.versionNumber);
        if (!Number.isInteger(versionNumber) || versionNumber < 1) {
          return res.status(400).json({ error: "Invalid version number" });
        }
        const [revision] = await db
          .select()
          .from(nexusPulseModuleRevisions)
          .where(and(
            eq(nexusPulseModuleRevisions.campaignId, req.params.campaignId),
            eq(nexusPulseModuleRevisions.versionNumber, versionNumber),
          ))
          .limit(1);
        if (!revision) return res.status(404).json({ error: "Version not found" });
        res.json(revision);
      } catch (error) {
        console.error("Failed to load Nexus Pulse version:", error);
        res.status(500).json({ error: "Failed to load Nexus Pulse version" });
      }
    },
  );

  app.get(
    "/api/campaigns/:campaignId/nexus-pulse/versions-compare",
    requireAuth,
    requireManager,
    async (req, res) => {
      try {
        const from = Number(req.query.from);
        const to = Number(req.query.to);
        if (!Number.isInteger(from) || !Number.isInteger(to)) {
          return res.status(400).json({ error: "Invalid version numbers" });
        }
        const revisions = await db
          .select()
          .from(nexusPulseModuleRevisions)
          .where(eq(nexusPulseModuleRevisions.campaignId, req.params.campaignId));
        const fromRevision = revisions.find((revision) => revision.versionNumber === from);
        const toRevision = revisions.find((revision) => revision.versionNumber === to);
        if (!fromRevision || !toRevision) return res.status(404).json({ error: "Version not found" });
        res.json({ from, to, changes: diffValues(fromRevision.snapshot, toRevision.snapshot) });
      } catch (error) {
        console.error("Failed to compare Nexus Pulse versions:", error);
        res.status(500).json({ error: "Failed to compare Nexus Pulse versions" });
      }
    },
  );

  app.post(
    "/api/campaigns/:campaignId/nexus-pulse/versions",
    requireAuth,
    requireManager,
    async (req, res) => {
      try {
        const changeNote = typeof req.body?.changeNote === "string"
          ? req.body.changeNote.trim().slice(0, 1000) || null
          : null;
        const result = await db.transaction(async (tx) => {
          const snapshot = await buildSnapshot(tx, req.params.campaignId);
          if (!snapshot) return null;
          return createRevision(tx, req.params.campaignId, snapshot, req.session.user!.id, changeNote);
        });
        if (!result) return res.status(404).json({ error: "Campaign not found" });
        res.status(result.created ? 201 : 200).json({
          created: result.created,
          version: omitRevisionSnapshot(result.revision),
        });
      } catch (error) {
        console.error("Failed to create Nexus Pulse version:", error);
        res.status(500).json({ error: "Failed to create Nexus Pulse version" });
      }
    },
  );

  app.post(
    "/api/campaigns/:campaignId/nexus-pulse/versions/:versionNumber/restore",
    requireAuth,
    requireManager,
    async (req, res) => {
      try {
        if (req.body?.confirm !== true) {
          return res.status(400).json({ error: "Restore confirmation is required" });
        }
        const versionNumber = Number(req.params.versionNumber);
        if (!Number.isInteger(versionNumber) || versionNumber < 1) {
          return res.status(400).json({ error: "Invalid version number" });
        }
        const result = await db.transaction(async (tx) => {
          const [campaign] = await tx
            .select({ id: campaigns.id, status: campaigns.status })
            .from(campaigns)
            .where(eq(campaigns.id, req.params.campaignId))
            .limit(1);
          if (!campaign) return { kind: "missing" as const };
          if (campaign.status === "active") return { kind: "active" as const };

          const [target] = await tx
            .select()
            .from(nexusPulseModuleRevisions)
            .where(and(
              eq(nexusPulseModuleRevisions.campaignId, req.params.campaignId),
              eq(nexusPulseModuleRevisions.versionNumber, versionNumber),
            ))
            .limit(1);
          if (!target) return { kind: "version-missing" as const };

          await restoreSnapshot(tx, req.params.campaignId, target.snapshot as Snapshot);
          const restoredSnapshot = await buildSnapshot(tx, req.params.campaignId);
          if (!restoredSnapshot) return { kind: "missing" as const };
          const note = typeof req.body?.changeNote === "string" && req.body.changeNote.trim()
            ? req.body.changeNote.trim().slice(0, 1000)
            : `Restored from version ${versionNumber}`;
          const created = await createRevision(
            tx,
            req.params.campaignId,
            restoredSnapshot,
            req.session.user!.id,
            note,
            target.id,
          );
          return { kind: "ok" as const, created, restoredFrom: versionNumber };
        });

        if (result.kind === "missing") return res.status(404).json({ error: "Campaign not found" });
        if (result.kind === "version-missing") return res.status(404).json({ error: "Version not found" });
        if (result.kind === "active") {
          return res.status(409).json({ error: "Pause the active campaign before restoring a Nexus Pulse version" });
        }
        res.status(201).json({
          restoredFrom: result.restoredFrom,
          version: omitRevisionSnapshot(result.created.revision),
        });
      } catch (error) {
        console.error("Failed to restore Nexus Pulse version:", error);
        res.status(500).json({ error: "Failed to restore Nexus Pulse version" });
      }
    },
  );
}