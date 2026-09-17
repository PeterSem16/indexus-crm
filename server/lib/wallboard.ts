import { and, eq, gte, inArray, isNull, lte, max, or, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  agentBreaks,
  agentSessions,
  agentWorkspaceAccess,
  campaigns,
  callLogs,
  campaignAgents,
  inboundCallLogs,
  inboundQueues,
  users,
} from "@shared/schema";
import {
  canReadWallboardCampaign,
  deriveWallboardAgentState,
  matchesWallboardPresence,
  selectAuthorizedWallboardQueueCalls,
} from "./wallboard-policy";
import { getQueueEngine } from "./queue-engine";
import { inboundCallWs } from "./inbound-call-ws";
import { getWallboardPresence } from "./wallboard-presence";
import type { WallboardSnapshot } from "@shared/wallboard";
import type { WallboardQueueCall } from "./wallboard-queue";
import {
  startOfBratislavaDay,
  selectNewestWallboardSession,
  wallboardSessionMissionIds,
  unionWallboardSessionSeconds,
} from "./wallboard-time";

type Viewer = { id: string; role?: string | null; roleId?: string | null };
type CampaignRow = typeof campaigns.$inferSelect;

/**
 * Wallboard deliberately uses only authoritative live signals:
 * - ended sessions and ended calls are never considered active;
 * - active card work requires a fresh session-bound browser lease (there is no
 *   fallback to a mutable contact status);
 * - presence is the live inbound-call WebSocket, not a timestamp heuristic.
 */
export async function canViewWallboard(viewer: Viewer): Promise<boolean> {
  if (viewer.role === "admin") return true;
  if (viewer.role !== "manager" && !viewer.roleId) return false;
  if (viewer.roleId) {
    const permissions = await storage.getRoleModulePermissions(viewer.roleId);
    if (viewer.role !== "manager" && !permissions.some((permission) =>
    permission.moduleKey === "campaigns" &&
    ["visible", "readonly", "editable"].includes(permission.access),
    )) return false;
  }
  const [user] = await db.select({ assignedCountries: users.assignedCountries })
    .from(users).where(eq(users.id, viewer.id)).limit(1);
  const workspace = await db.select({ countryCode: agentWorkspaceAccess.countryCode })
    .from(agentWorkspaceAccess).where(eq(agentWorkspaceAccess.userId, viewer.id));
  const memberships = await db.select({ campaignId: campaignAgents.campaignId })
    .from(campaignAgents).where(eq(campaignAgents.userId, viewer.id));
  return memberships.length > 0 ||
    !!(user?.assignedCountries?.length || workspace.length > 0);
}

async function readableCampaigns(viewer: Viewer, requestedCampaignId?: string | null): Promise<CampaignRow[]> {
  const rows = await db.select().from(campaigns).where(requestedCampaignId
    ? or(eq(campaigns.status, "active"), eq(campaigns.id, requestedCampaignId))
    : eq(campaigns.status, "active"));
  if (viewer.role === "admin") return rows;
  const [user] = await db.select({ assignedCountries: users.assignedCountries })
    .from(users).where(eq(users.id, viewer.id)).limit(1);
  const workspace = await db.select({ countryCode: agentWorkspaceAccess.countryCode })
    .from(agentWorkspaceAccess)
    .where(eq(agentWorkspaceAccess.userId, viewer.id));
  const memberships = await db.select({ campaignId: campaignAgents.campaignId })
    .from(campaignAgents).where(eq(campaignAgents.userId, viewer.id));
  const membershipIds = new Set(memberships.map((row) => row.campaignId));
  return rows.filter((campaign) => canReadWallboardCampaign({
    role: viewer.role,
    assignedCountries: user?.assignedCountries || [],
    workspaceCountries: workspace.map((row) => row.countryCode),
    campaignCountries: campaign.countryCodes,
    isCampaignMember: membershipIds.has(campaign.id),
  }));
}

function dateValue(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function callIsLive(call: { status: string; endedAt: Date | null }): boolean {
  return !call.endedAt && ["initiated", "ringing", "answered"].includes(call.status);
}

/**
 * Build a snapshot from bounded, access-filtered queries. `now` is injectable
 * for deterministic tests and is used only for elapsed wait calculations.
 */
export async function buildWallboardSnapshot(
  viewer: Viewer,
  requestedCampaignId?: string | null,
  now = new Date(),
): Promise<WallboardSnapshot> {
  const permitted = await readableCampaigns(viewer, requestedCampaignId);
  const byId = new Map(permitted.map((campaign) => [campaign.id, campaign]));
  const campaignId = requestedCampaignId || null;
  const selected = campaignId ? byId.get(campaignId) : undefined;
  if (campaignId && !selected) throw new Error("WALLBOARD_CAMPAIGN_FORBIDDEN");
  const visible = selected ? [selected] : permitted;
  // Inactive Missions can be opened by an authorized viewer, but must not
  // resurrect abandoned sessions or calls as a running Mission.
  const visibleIds = new Set(visible.filter((campaign) => campaign.status === "active").map((campaign) => campaign.id));
  // Historical projection may still be useful for an authorized completed or
  // paused Mission, but its open sessions must never become live state.
  const historicalIds = new Set(visible.map((campaign) => campaign.id));

  const historicalMissionIds = Array.from(historicalIds);
  const scopedSessionCondition = historicalMissionIds.length
    ? or(
      inArray(agentSessions.campaignId, historicalMissionIds),
      sql`${agentSessions.campaignIds} && ARRAY[${sql.join(
        historicalMissionIds.map((id) => sql`${id}`), sql`, `,
      )}]::text[]`,
    )
    : undefined;
  // Historical cards use the current Mission roster.  This prevents an agent
  // removed from a Mission from lingering forever while still allowing the
  // live-session path below to preserve its explicit current-session scope.
  const rosterRows = historicalMissionIds.length
    ? await db.select({ userId: campaignAgents.userId })
      .from(campaignAgents).where(inArray(campaignAgents.campaignId, historicalMissionIds))
    : [];
  const rosterUserIds = Array.from(new Set(rosterRows.map((row) => row.userId)));

  const activeScope = scopedSessionCondition || sql`false`;
  const activeUserCondition = rosterUserIds.length
    ? or(activeScope, inArray(agentSessions.userId, rosterUserIds))
    : activeScope;
  const activeSessionRows = await db.select().from(agentSessions)
    .where(and(isNull(agentSessions.endedAt), activeUserCondition));
  // There can be stale duplicate rows after a browser reconnect. Only the
  // newest still-open session with an authorized active Mission is
  // authoritative for a user.
  const sessionHasVisibleMission = (session: typeof activeSessionRows[number]): boolean => {
    const ids = wallboardSessionMissionIds(session);
    return ids.some((id) => visibleIds.has(id));
  };
  const newestByUser = new Map<string, typeof activeSessionRows[number]>();
  for (const session of activeSessionRows) {
    const previous = newestByUser.get(session.userId);
    const newest = selectNewestWallboardSession(previous ? [previous, session] : [session]);
    if (newest) newestByUser.set(session.userId, newest);
  }
  const latestLiveRows = Array.from(newestByUser.values()).filter(sessionHasVisibleMission);
  const liveUserIds = Array.from(new Set(latestLiveRows.map((session) => session.userId)));

  // One latest scoped row per current roster user is enough for the
  // historical projection.  The max() subquery keeps this from dumping a
  // user's complete session history into Node.
  const latestScopedRows = rosterUserIds.length && scopedSessionCondition
    ? (await (async () => {
      const latestStarted = db.select({
        userId: agentSessions.userId,
        startedAt: max(agentSessions.startedAt).as("latest_started_at"),
      }).from(agentSessions)
        .where(and(inArray(agentSessions.userId, rosterUserIds), scopedSessionCondition))
        .groupBy(agentSessions.userId)
        .as("wallboard_latest_scoped_session");
      return db.select({ session: agentSessions })
        .from(agentSessions)
        .innerJoin(latestStarted, and(
          eq(agentSessions.userId, latestStarted.userId),
          eq(agentSessions.startedAt, latestStarted.startedAt),
        ))
        .where(and(inArray(agentSessions.userId, rosterUserIds), scopedSessionCondition));
    })())
    : [];
  const historicalByUser = new Map<string, typeof agentSessions.$inferSelect>();
  for (const row of latestScopedRows) {
    const session = "session" in row ? row.session : row;
    if (session) {
      const previous = historicalByUser.get(session.userId);
      const newest = selectNewestWallboardSession(previous ? [previous, session] : [session]);
      if (newest) historicalByUser.set(session.userId, newest);
    }
  }
  const candidateUserIds = Array.from(new Set([...liveUserIds, ...Array.from(historicalByUser.keys())]));
  const userRows = candidateUserIds.length
    ? await db.select({ id: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl })
      .from(users).where(and(inArray(users.id, candidateUserIds), eq(users.isActive, true)))
    : [];
  const userById = new Map(userRows.map((user) => [user.id, user]));
  // A scoped live session is authoritative only if it is the user's newest
  // open session globally.  An old scoped row may still render as offline,
  // but can never resurrect live state.
  const liveSessionByUser = new Map(
    latestLiveRows
      .filter((session) => userById.has(session.userId))
      .map((session) => [session.userId, session]),
  );
  const historicalSessions = Array.from(historicalByUser.values())
    .filter((session) => userById.has(session.userId));
  const sessionIds = Array.from(new Set([
    ...Array.from(liveSessionByUser.values()).map((session) => session.id),
    ...historicalSessions.map((session) => session.id),
  ]));

  const breaks = sessionIds.length
    ? await db.select().from(agentBreaks)
      .where(and(inArray(agentBreaks.sessionId, sessionIds), isNull(agentBreaks.endedAt)))
    : [];

  // Only fetch intervals intersecting this app day.  The query is scoped to
  // current roster users and explicit Mission membership; all-time history is
  // never materialized in JavaScript.
  const today = startOfBratislavaDay(now);
  const nextDay = startOfBratislavaDay(new Date(today.getTime() + 36 * 60 * 60 * 1000));
  const intervalUserIds = Array.from(new Set([
    ...rosterUserIds,
    ...liveUserIds,
  ]));
  const todaySessionRows = intervalUserIds.length && scopedSessionCondition
    ? await db.select().from(agentSessions).where(and(
      inArray(agentSessions.userId, intervalUserIds),
      scopedSessionCondition,
      lte(agentSessions.startedAt, nextDay),
      or(isNull(agentSessions.endedAt), gte(agentSessions.endedAt, today)),
    ))
    : [];
  const userIds = userRows.map((user) => user.id);
  const sessions = userIds
    .map((userId) => liveSessionByUser.get(userId) || historicalByUser.get(userId))
    .filter((session): session is typeof agentSessions.$inferSelect => !!session);

  // Open calls are restricted to active-session users and are bounded by the
  // indexed user/status predicates. Historical logs cannot create live cards.
  const openCalls = userIds.length
    ? await db.select({
      id: callLogs.id,
      userId: callLogs.userId,
      campaignId: callLogs.campaignId,
      direction: callLogs.direction,
      status: callLogs.status,
      startedAt: callLogs.startedAt,
      answeredAt: callLogs.answeredAt,
      endedAt: callLogs.endedAt,
    }).from(callLogs).where(and(
      inArray(callLogs.userId, userIds),
      isNull(callLogs.endedAt),
      inArray(callLogs.status, ["initiated", "ringing", "answered"]),
    ))
    : [];
  const queueRows = await db.select({ id: inboundQueues.id, name: inboundQueues.name })
    .from(inboundQueues).where(eq(inboundQueues.isActive, true));
  const queueNames = new Map(queueRows.map((queue) => [queue.id, queue.name]));

  const engine = getQueueEngine();
  const queueConnected = !!engine?.getAriClient().isConnected;
  const queueCalls: WallboardQueueCall[] = engine?.getWallboardCalls() || [];
  const activeInboundRows = await db.select({
    id: inboundCallLogs.id,
    queueId: inboundCallLogs.queueId,
    assignedAgentId: inboundCallLogs.assignedAgentId,
    status: inboundCallLogs.status,
    enteredQueueAt: inboundCallLogs.enteredQueueAt,
    answeredAt: inboundCallLogs.answeredAt,
    campaignId: callLogs.campaignId,
  }).from(inboundCallLogs)
    .leftJoin(callLogs, eq(inboundCallLogs.callLogId, callLogs.id))
    .where(inArray(inboundCallLogs.status, ["queued", "ringing", "answered"]));
  const dbInboundById = new Map(activeInboundRows.map((call) => [call.id, call]));
  const activeInbound = selectAuthorizedWallboardQueueCalls(queueCalls, visibleIds, campaignId)
    .filter((call) => queueNames.has(call.queueId));

  const sessionCampaignIds = (userId: string): string[] => {
    const ids = new Set<string>();
    for (const session of sessions.filter((row) => row.userId === userId)) {
      for (const id of wallboardSessionMissionIds(session)) ids.add(id);
    }
    return Array.from(ids).filter((id) => historicalIds.has(id)).sort();
  };
  // Every selected session has an explicit authorized Mission.
  const scopedSessions = sessions.filter((session) => sessionCampaignIds(session.userId).length > 0);
  const visibleOpenCalls = openCalls.filter((call) =>
    !!call.campaignId && visibleIds.has(call.campaignId) &&
    (!campaignId || call.campaignId === campaignId));
  const agents: WallboardSnapshot["agents"] = [];
  const seenUsers = new Set<string>();
  const todayEnd = new Date(Math.min(now.getTime(), nextDay.getTime()));
  for (const session of scopedSessions.sort((a, b) => a.userId.localeCompare(b.userId))) {
    if (seenUsers.has(session.userId)) continue;
    seenUsers.add(session.userId);
    const user = userById.get(session.userId)!;
    const campaignIds = sessionCampaignIds(session.userId);
    if (campaignId && !campaignIds.includes(campaignId)) {
      // An unscoped session cannot safely be attributed to a Mission.
      continue;
    }
    const currentScopedOpen = liveSessionByUser.get(session.userId);
    const connected = !!currentScopedOpen && inboundCallWs.isAgentConnected(session.userId);
    const calls = visibleOpenCalls.filter((call) =>
      call.userId === session.userId && callIsLive(call) &&
      call.startedAt >= session.startedAt
    ).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const ringing = calls.find((call) => ["initiated", "ringing"].includes(call.status));
    const talking = calls.find((call) => call.status === "answered");
    const userBreak = breaks.find((item) => item.userId === session.userId);
    const inboundCall = activeInbound.find((call) =>
      (call.agentId === session.userId || call.agentIds?.includes(session.userId)) &&
      sessionCampaignIds(session.userId).includes(call.campaignId!));
    const directInbound = calls.find((call) => call.direction === "inbound" && ["initiated", "ringing"].includes(call.status));
    const directTalkingInbound = calls.find((call) => call.direction === "inbound" && call.status === "answered");
    const presence = getWallboardPresence(session.userId);
    const validPresence = matchesWallboardPresence(
      presence,
      session.id,
      sessionCampaignIds(session.userId),
      visibleIds,
    ) ? presence : undefined;
    const derived = deriveWallboardAgentState({
      connected,
      inboundCallingSince: inboundCall?.status === "talking"
        ? dateValue(inboundCall.since || dbInboundById.get(inboundCall.id)?.answeredAt)
        : dateValue(directTalkingInbound?.answeredAt || null),
      inboundRingingSince: inboundCall?.status === "ringing"
        ? dateValue(inboundCall.since || dbInboundById.get(inboundCall.id)?.enteredQueueAt)
        : dateValue(directInbound?.startedAt || null),
      outboundCallingSince: talking?.direction === "inbound" ? null : dateValue(talking?.answeredAt || null),
      outboundRingingSince: ringing?.direction === "inbound" ? null : dateValue(ringing?.startedAt || null),
      breakSince: dateValue(userBreak?.startedAt),
      // Open database activities can survive a crashed tab. Only the
      // short-lived, matching card lease is authoritative for this state.
      workingSince: validPresence?.working ? validPresence.changedAt : null,
      // A session age is not an available-state duration. Without a matching
      // presence transition (or a live call/break timestamp above), this is
      // intentionally null rather than misleading.
      availableSince: validPresence && !validPresence.working ? validPresence.changedAt : null,
    });
    agents.push({
      id: user.id,
      name: user.fullName,
      avatarUrl: user.avatarUrl,
      campaignIds,
      campaignNames: campaignIds.map((id) => byId.get(id)?.name).filter((name): name is string => !!name),
      state: derived.state,
      stateSince: derived.stateSince,
      direction: derived.direction,
      connected,
      sessionStartedAt: connected ? dateValue(currentScopedOpen?.startedAt) : null,
      lastMissionAt: connected
        ? null
        : dateValue(session.endedAt || session.lastActiveAt),
      todayMissionSeconds: unionWallboardSessionSeconds(
        todaySessionRows
          .filter((row) => row.userId === session.userId)
          .filter((row) => {
            const rowCampaignIds = wallboardSessionMissionIds(row);
            return !campaignId || rowCampaignIds.includes(campaignId);
          })
          .map((row) => ({
            startedAt: row.startedAt,
            endedAt: row.endedAt,
            lastActiveAt: row.lastActiveAt,
            accruing: connected && row.id === currentScopedOpen?.id,
          })),
        today,
        todayEnd,
        now,
      ),
      todayAccruing: connected,
    });
  }

  const inbound: WallboardSnapshot["inbound"] = [];
  for (const call of activeInbound) {
    if (!call.queueId) continue;
    const queueName = queueNames.get(call.queueId)!;
    const exactCampaignId = call.campaignId;
    if (!exactCampaignId || !visibleIds.has(exactCampaignId)) continue;
    if (campaignId && exactCampaignId !== campaignId) continue;
    const dbCall = dbInboundById.get(call.id);
    if (!call.since && !dbCall?.enteredQueueAt && !dbCall?.answeredAt) continue;
    const since = dateValue(call.since || (call.status === "talking" ? dbCall?.answeredAt : dbCall?.enteredQueueAt));
    if (!since) continue;
    inbound.push({
      id: call.id,
      campaignId: exactCampaignId,
      queueName,
      agentName: Array.from(new Set([...(call.agentIds || []), ...(call.agentId ? [call.agentId] : [])]))
        .map((id) => userById.get(id)?.fullName).filter(Boolean).join(", ") || null,
      status: call.status,
      since,
      callerLabel: null,
    });
  }

  const answeredTodayRows = await db.select({
    answeredAt: inboundCallLogs.answeredAt,
    waitDurationSeconds: inboundCallLogs.waitDurationSeconds,
    campaignId: callLogs.campaignId,
  }).from(inboundCallLogs)
    .leftJoin(callLogs, eq(inboundCallLogs.callLogId, callLogs.id))
    .where(and(
    gte(inboundCallLogs.answeredAt, today),
    inArray(inboundCallLogs.status, ["answered", "completed"]),
    // A metric is only valid when the call log explicitly identifies a
    // permitted running Mission. Shared/null-campaign queues never broaden
    // the viewer's country scope.
    inArray(callLogs.campaignId, campaignId ? [campaignId] : Array.from(visibleIds)),
  ));
  const waits = answeredTodayRows
    .map((row) => row.waitDurationSeconds)
    .filter((value): value is number => typeof value === "number");
  const sourceLive = true; // DB call/activity telemetry remains live without ARI.
  const ambiguousQueueCalls = queueCalls.some((call) => !call.campaignId);
  return {
    generatedAt: now.toISOString(),
    scope: { campaignId, campaignName: selected?.name || null },
    campaigns: visible.map((campaign) => ({ id: campaign.id, name: campaign.name })),
    agents,
    inbound: inbound.sort((a, b) => a.since.localeCompare(b.since) || a.id.localeCompare(b.id)),
    queue: {
      waiting: inbound.filter((call) => call.status === "waiting").length,
      longestWaitSeconds: inbound.filter((call) => call.status === "waiting")
        .reduce((max, call) => Math.max(max, Math.max(0, Math.floor((now.getTime() - new Date(call.since).getTime()) / 1000))), 0),
      answeredToday: answeredTodayRows.length,
      averageWaitSeconds: waits.length ? Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length) : null,
    },
    source: {
      live: sourceLive,
      warning: !queueConnected
        ? "QUEUE_ENGINE_UNAVAILABLE"
        : ambiguousQueueCalls
          ? "INBOUND_AMBIGUOUS_ATTRIBUTION_OMITTED"
          : null,
    },
  };
}