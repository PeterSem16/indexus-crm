import { and, eq, gte, inArray, isNull, lte, max, or, sql, desc } from "drizzle-orm";
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
  wallboardAlarmHistory,
  wallboardAlarmSettings,
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
import {
  defaultWallboardAlarmSettings,
  wallboardAlarmSettingsSchema,
  type WallboardAlarmSettings,
} from "@shared/wallboard-alarms";
import {
  WALLBOARD_ALARM_HISTORY_RETENTION_DAYS,
  wallboardAlarmHistoryEntrySchema,
  type WallboardAlarmHistoryEntry,
} from "@shared/wallboard-alarm-history";
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

/**
 * Return the exact campaign set a viewer may use for wallboard data or
 * configuration.  Keep this separate from snapshot construction: alarm
 * endpoints need the same authorization without building a live snapshot.
 */
export async function readableCampaigns(viewer: Viewer, requestedCampaignId?: string | null): Promise<CampaignRow[]> {
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

export function wallboardAlarmScope(campaignId: string | null): string {
  return campaignId ? `campaign:${campaignId}` : "all";
}

const WALLBOARD_ALARM_HISTORY_FUTURE_SKEW_MS = 5 * 60 * 1000;

/**
 * Read a viewer's private settings. A malformed persisted JSON document is a
 * server error, never a reason to silently reset that viewer's alarms.
 */
export async function getWallboardAlarmSettings(
  userId: string,
  campaignId: string | null,
  queryDb: any = db,
): Promise<WallboardAlarmSettings> {
  const [row] = await queryDb.select({ settings: wallboardAlarmSettings.settings })
    .from(wallboardAlarmSettings)
    .where(and(
      eq(wallboardAlarmSettings.userId, userId),
      eq(wallboardAlarmSettings.scope, wallboardAlarmScope(campaignId)),
    ))
    .orderBy(desc(wallboardAlarmSettings.updatedAt))
    .limit(1);
  if (!row) return defaultWallboardAlarmSettings();
  const parsed = wallboardAlarmSettingsSchema.safeParse(row.settings);
  if (!parsed.success) {
    throw new Error("WALLBOARD_ALARM_SETTINGS_INVALID");
  }
  return parsed.data;
}

export async function saveWallboardAlarmSettings(
  userId: string,
  campaignId: string | null,
  settings: WallboardAlarmSettings,
  queryDb: any = db,
): Promise<WallboardAlarmSettings> {
  // Callers should validate too, but validating at the persistence boundary
  // prevents an unsafe helper call from storing an invalid alarm document.
  const parsed = wallboardAlarmSettingsSchema.safeParse(settings);
  if (!parsed.success) throw new Error("WALLBOARD_ALARM_SETTINGS_INVALID");
  const [row] = await queryDb.insert(wallboardAlarmSettings).values({
    userId,
    scope: wallboardAlarmScope(campaignId),
    settings: parsed.data,
  }).onConflictDoUpdate({
    target: [wallboardAlarmSettings.userId, wallboardAlarmSettings.scope],
    set: { settings: parsed.data, updatedAt: sql`now()` },
  }).returning({ settings: wallboardAlarmSettings.settings });
  if (!row) throw new Error("WALLBOARD_ALARM_SETTINGS_UNAVAILABLE");
  const stored = wallboardAlarmSettingsSchema.safeParse(row.settings);
  if (!stored.success) throw new Error("WALLBOARD_ALARM_SETTINGS_INVALID");
  return stored.data;
}

function dateValue(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function activityDate(value: Date | string | null | undefined, now: Date): string | null {
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime()) || date.getTime() > now.getTime()) return null;
  return date.toISOString();
}

function newestActivityTimestamp(
  current: string | null,
  candidate: Date | string | null | undefined,
  now: Date,
): string | null {
  const next = activityDate(candidate, now);
  if (!next) return current;
  return !current || next > current ? next : current;
}

/**
 * Read the last event clocks without materializing call history in Node.
 * Campaign scope is the only attribution authority: queue rows are joined
 * through their explicit call_logs FK, and shared/null-campaign calls never
 * enter these aggregates. `queryDb` is injectable for rollback-only tests.
 */
export async function aggregateWallboardCallActivity(
  visibleCampaignIds: readonly string[],
  now = new Date(),
  queryDb: any = db,
): Promise<WallboardSnapshot["callActivity"]> {
  const empty: WallboardSnapshot["callActivity"] = {
    inbound: { startedAt: null, connectedAt: null },
    outbound: { startedAt: null, connectedAt: null },
  };
  if (!visibleCampaignIds.length) return empty;

  const [direct] = await queryDb.select({
    inboundStartedAt: sql<Date | null>`max(${callLogs.startedAt}) FILTER (
      WHERE ${callLogs.direction} = 'inbound' AND ${callLogs.startedAt} <= ${now}
    )`,
    inboundConnectedAt: sql<Date | null>`max(${callLogs.answeredAt}) FILTER (
      WHERE ${callLogs.direction} = 'inbound'
        AND ${callLogs.answeredAt} IS NOT NULL
        AND ${callLogs.answeredAt} <= ${now}
    )`,
    outboundStartedAt: sql<Date | null>`max(${callLogs.startedAt}) FILTER (
      WHERE ${callLogs.direction} = 'outbound' AND ${callLogs.startedAt} <= ${now}
    )`,
    outboundConnectedAt: sql<Date | null>`max(${callLogs.answeredAt}) FILTER (
      WHERE ${callLogs.direction} = 'outbound'
        AND ${callLogs.answeredAt} IS NOT NULL
        AND ${callLogs.answeredAt} <= ${now}
    )`,
  }).from(callLogs).where(inArray(callLogs.campaignId, Array.from(visibleCampaignIds)));

  // Queue timing is separate from direct call timing: enteredQueueAt is the
  // inbound "started" event, and answeredAt is the inbound "connected" event.
  // The explicit FK campaign join is required even when the queue itself is
  // shared by multiple Missions.
  const [queue] = await queryDb.select({
    startedAt: sql<Date | null>`max(${inboundCallLogs.enteredQueueAt}) FILTER (
      WHERE ${inboundCallLogs.enteredQueueAt} <= ${now}
    )`,
    connectedAt: sql<Date | null>`max(${inboundCallLogs.answeredAt}) FILTER (
      WHERE ${inboundCallLogs.answeredAt} IS NOT NULL
        AND ${inboundCallLogs.answeredAt} <= ${now}
    )`,
  }).from(inboundCallLogs)
    .innerJoin(callLogs, eq(inboundCallLogs.callLogId, callLogs.id))
    .where(and(
      eq(callLogs.direction, "inbound"),
      inArray(callLogs.campaignId, Array.from(visibleCampaignIds)),
    ));

  for (const [direction, startedAt, connectedAt] of [
    ["inbound", direct?.inboundStartedAt, direct?.inboundConnectedAt],
    ["outbound", direct?.outboundStartedAt, direct?.outboundConnectedAt],
  ] as const) {
    empty[direction].startedAt = newestActivityTimestamp(empty[direction].startedAt, startedAt, now);
    empty[direction].connectedAt = newestActivityTimestamp(empty[direction].connectedAt, connectedAt, now);
  }
  empty.inbound.startedAt = newestActivityTimestamp(empty.inbound.startedAt, queue?.startedAt, now);
  empty.inbound.connectedAt = newestActivityTimestamp(empty.inbound.connectedAt, queue?.connectedAt, now);
  return empty;
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
    .where(and(
      inArray(inboundCallLogs.status, ["queued", "ringing", "answered"]),
      isNull(callLogs.endedAt),
      inArray(callLogs.status, ["initiated", "ringing", "answered"]),
      eq(callLogs.direction, "inbound"),
      ...(visibleIds.size ? [inArray(callLogs.campaignId, Array.from(visibleIds))] : [sql`false`]),
    ));
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
  // Historical DB clocks deliberately include ended/completed calls so
  // no-calls rules can measure time since the last event. Live queue telemetry
  // fills the short persistence gap while a current call is not yet in DB.
  const callActivity = await aggregateWallboardCallActivity(
    Array.from(visibleIds),
    now,
  );
  for (const call of activeInbound) {
    if (!call.campaignId || !visibleIds.has(call.campaignId)) continue;
    if (call.status === "talking") {
      callActivity.inbound.connectedAt = newestActivityTimestamp(
        callActivity.inbound.connectedAt,
        call.since,
        now,
      );
    } else {
      callActivity.inbound.startedAt = newestActivityTimestamp(
        callActivity.inbound.startedAt,
        call.since,
        now,
      );
    }
  }
  return {
    generatedAt: now.toISOString(),
    callActivity,
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

function hasCumulativeHistoryRegression(
  current: WallboardAlarmHistoryEntry,
  incoming: WallboardAlarmHistoryEntry,
): boolean {
  if (Date.parse(incoming.lastObservedAt) < Date.parse(current.lastObservedAt)) return true;
  if (current.acknowledgedAt !== null && (
    incoming.acknowledgedAt === null ||
    Date.parse(incoming.acknowledgedAt) < Date.parse(current.acknowledgedAt)
  )) return true;
  if (current.mutedAt !== null && (
    incoming.mutedAt === null ||
    Date.parse(incoming.mutedAt) < Date.parse(current.mutedAt)
  )) return true;
  if (current.mutedUntil !== null && (
    incoming.mutedUntil === null ||
    Date.parse(incoming.mutedUntil) < Date.parse(current.mutedUntil)
  )) return true;
  // A closed incident remains closed. Revision updates may retain, but never
  // clear or change, the terminal event.
  return current.endedAt !== null && (
    incoming.endedAt !== current.endedAt || incoming.endReason !== current.endReason
  );
}

/**
 * Validate and canonicalize a client entry at the persistence boundary.
 * Observation timestamps have a very small future allowance.  mute expiry is
 * an intentional future value, but remains bounded to one day.
 */
export function validateWallboardAlarmHistoryEntry(
  value: unknown,
  now = new Date(),
): WallboardAlarmHistoryEntry {
  const parsed = wallboardAlarmHistoryEntrySchema.safeParse(value);
  if (!parsed.success) throw new Error("WALLBOARD_ALARM_HISTORY_INVALID");
  const entry = parsed.data;
  const nowMs = now.getTime();
  const oldestAllowed = nowMs - WALLBOARD_ALARM_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const observedDates = [
    entry.startedAt,
    entry.lastObservedAt,
    entry.endedAt,
    entry.acknowledgedAt,
    entry.mutedAt,
  ].filter((value): value is string => value !== null);
  if (observedDates.some((value) => {
    const ms = Date.parse(value);
    return ms < oldestAllowed || ms > nowMs + WALLBOARD_ALARM_HISTORY_FUTURE_SKEW_MS;
  })) {
    throw new Error("WALLBOARD_ALARM_HISTORY_INVALID");
  }
  if (
    entry.mutedUntil !== null &&
    (Date.parse(entry.mutedUntil) < oldestAllowed ||
      Date.parse(entry.mutedUntil) > nowMs + WALLBOARD_ALARM_HISTORY_MAX_MUTED_UNTIL_MS)
  ) {
    throw new Error("WALLBOARD_ALARM_HISTORY_INVALID");
  }
  return {
    ...entry,
    startedAt: historyDate(entry.startedAt),
    lastObservedAt: historyDate(entry.lastObservedAt),
    endedAt: entry.endedAt === null ? null : historyDate(entry.endedAt),
    acknowledgedAt: entry.acknowledgedAt === null ? null : historyDate(entry.acknowledgedAt),
    mutedAt: entry.mutedAt === null ? null : historyDate(entry.mutedAt),
    mutedUntil: entry.mutedUntil === null ? null : historyDate(entry.mutedUntil),
  };
}

function sameMissionSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const expected = new Set(left);
  return right.every((missionId) => expected.has(missionId));
}

const WALLBOARD_ALARM_HISTORY_MAX_MUTED_UNTIL_MS = 24 * 60 * 60 * 1000;

/**
 * Store a batch atomically.  Rows are owner/scope-bound by every query; an
 * existing incident accepts only a strictly newer revision.  Exact retries are
 * no-ops and changed immutable identity fields are rejected.
 */
export async function saveWallboardAlarmHistory(
  userId: string,
  campaignId: string | null,
  entries: readonly unknown[],
  readableMissionIds: readonly string[],
  now = new Date(),
  queryDb: any = db,
): Promise<void> {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 100) {
    throw new Error("WALLBOARD_ALARM_HISTORY_INVALID");
  }
  const normalized = entries.map((entry) => validateWallboardAlarmHistoryEntry(entry, now))
    .sort((left, right) => left.incidentId.localeCompare(right.incidentId));
  if (new Set(normalized.map((entry) => entry.incidentId)).size !== normalized.length) {
    throw new Error("WALLBOARD_ALARM_HISTORY_INVALID");
  }
  const authorizedMissionIds = wallboardAlarmHistoryMissionIds(campaignId, readableMissionIds);
  const scope = wallboardAlarmScope(campaignId);
  const work = async (tx: any) => {
    for (const entry of normalized) {
      // SELECT FOR UPDATE locks an existing row only. This transaction-scoped
      // advisory lock also serializes competing first inserts for this exact
      // owner/scope/incident key. Sorted entries above prevent batch deadlocks.
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtext(${userId}),
          hashtext(${JSON.stringify([scope, entry.incidentId])})
        )
      `);
      const locked = await tx.execute(sql`
        SELECT incident_id AS "incidentId", revision, type, threshold,
          started_at AS "startedAt", last_observed_at AS "lastObservedAt",
          ended_at AS "endedAt", end_reason AS "endReason",
          acknowledged_at AS "acknowledgedAt", muted_at AS "mutedAt",
          muted_until AS "mutedUntil",
          authorized_mission_ids AS "authorizedMissionIds"
        FROM wallboard_alarm_history
        WHERE user_id = ${userId} AND scope = ${scope} AND incident_id = ${entry.incidentId}
        FOR UPDATE
      `);
      const existing = locked.rows[0] ? historyEntryFromRow(locked.rows[0]) : undefined;
      if (existing) {
        // The client never supplies this set. For an aggregate incident, a
        // changed current Mission set means a stale board snapshot cannot
        // extend the incident with observations from newly gained/lost scope.
        const storedScope = locked.rows[0].authorizedMissionIds;
        if (campaignId === null &&
          (!Array.isArray(storedScope) || !sameMissionSet(storedScope, authorizedMissionIds))) {
          throw new Error("WALLBOARD_ALARM_HISTORY_SCOPE_CONFLICT");
        }
        if (!sameHistoryIdentity(existing, entry)) {
          throw new Error("WALLBOARD_ALARM_HISTORY_IDENTITY_CONFLICT");
        }
        if (entry.revision > existing.revision && hasCumulativeHistoryRegression(existing, entry)) {
          throw new Error("WALLBOARD_ALARM_HISTORY_STATE_CONFLICT");
        }
        if (entry.revision < existing.revision) continue;
        if (entry.revision === existing.revision) {
          if (!sameHistoryEntry(existing, entry)) {
            throw new Error("WALLBOARD_ALARM_HISTORY_REVISION_CONFLICT");
          }
          continue;
        }
        await tx.update(wallboardAlarmHistory).set({
          revision: entry.revision,
          lastObservedAt: new Date(entry.lastObservedAt),
          endedAt: entry.endedAt === null ? null : new Date(entry.endedAt),
          endReason: entry.endReason,
          acknowledgedAt: entry.acknowledgedAt === null ? null : new Date(entry.acknowledgedAt),
          mutedAt: entry.mutedAt === null ? null : new Date(entry.mutedAt),
          mutedUntil: entry.mutedUntil === null ? null : new Date(entry.mutedUntil),
          updatedAt: new Date(),
        }).where(and(
          eq(wallboardAlarmHistory.userId, userId),
          eq(wallboardAlarmHistory.scope, scope),
          eq(wallboardAlarmHistory.incidentId, entry.incidentId),
          eq(wallboardAlarmHistory.revision, existing.revision),
        ));
      } else {
        await tx.insert(wallboardAlarmHistory).values({
          userId,
          scope,
          incidentId: entry.incidentId,
          revision: entry.revision,
          type: entry.type,
          threshold: String(entry.threshold),
          startedAt: new Date(entry.startedAt),
          lastObservedAt: new Date(entry.lastObservedAt),
          endedAt: entry.endedAt === null ? null : new Date(entry.endedAt),
          endReason: entry.endReason,
          acknowledgedAt: entry.acknowledgedAt === null ? null : new Date(entry.acknowledgedAt),
          mutedAt: entry.mutedAt === null ? null : new Date(entry.mutedAt),
          mutedUntil: entry.mutedUntil === null ? null : new Date(entry.mutedUntil),
          authorizedMissionIds,
        });
      }
    }
  };
  if (typeof queryDb.transaction === "function") {
    await queryDb.transaction(work);
  } else {
    await work(queryDb);
  }
}

function sameHistoryEntry(
  current: WallboardAlarmHistoryEntry,
  incoming: WallboardAlarmHistoryEntry,
): boolean {
  return current.revision === incoming.revision &&
    current.lastObservedAt === incoming.lastObservedAt &&
    current.endedAt === incoming.endedAt &&
    current.endReason === incoming.endReason &&
    current.acknowledgedAt === incoming.acknowledgedAt &&
    current.mutedAt === incoming.mutedAt &&
    current.mutedUntil === incoming.mutedUntil &&
    sameHistoryIdentity(current, incoming);
}

function historyDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("WALLBOARD_ALARM_HISTORY_INVALID");
  return date.toISOString();
}

export function wallboardAlarmHistoryMissionIds(
  campaignId: string | null,
  readableMissionIds: readonly string[],
): string[] {
  return campaignId === null
    ? Array.from(new Set(readableMissionIds)).sort()
    : [campaignId];
}

function wallboardAlarmHistoryVisibilityCondition(
  campaignId: string | null,
  readableMissionIds: readonly string[],
) {
  if (campaignId !== null) return undefined;
  // PostgreSQL's <@ requires every historical Mission ID to still be in the
  // current server-derived readable set. This filters inaccessible rows in the
  // database rather than allowing one old row to block newer safe history.
  const readable = Array.from(new Set(readableMissionIds));
  return readable.length
    ? sql`${wallboardAlarmHistory.authorizedMissionIds} <@ ARRAY[${sql.join(
      readable.map((missionId) => sql`${missionId}`),
      sql`, `,
    )}]::text[]`
    : sql`${wallboardAlarmHistory.authorizedMissionIds} <@ ARRAY[]::text[]`;
}

function sameHistoryIdentity(
  current: WallboardAlarmHistoryEntry,
  incoming: WallboardAlarmHistoryEntry,
): boolean {
  return current.incidentId === incoming.incidentId &&
    current.type === incoming.type &&
    current.threshold === incoming.threshold &&
    current.startedAt === incoming.startedAt;
}

function historyEntryFromRow(row: any): WallboardAlarmHistoryEntry {
  return {
    incidentId: row.incidentId,
    revision: row.revision,
    type: row.type,
    threshold: Number(row.threshold),
    startedAt: historyDate(row.startedAt),
    lastObservedAt: historyDate(row.lastObservedAt),
    endedAt: row.endedAt === null ? null : historyDate(row.endedAt),
    endReason: row.endReason,
    acknowledgedAt: row.acknowledgedAt === null ? null : historyDate(row.acknowledgedAt),
    mutedAt: row.mutedAt === null ? null : historyDate(row.mutedAt),
    mutedUntil: row.mutedUntil === null ? null : historyDate(row.mutedUntil),
  };
}

export async function getWallboardAlarmHistory(
  userId: string,
  campaignId: string | null,
  days: 1 | 7 | 30,
  readableMissionIds: readonly string[],
  now = new Date(),
  queryDb: any = db,
): Promise<{
  items: WallboardAlarmHistoryEntry[];
  retentionDays: typeof WALLBOARD_ALARM_HISTORY_RETENTION_DAYS;
  truncated: boolean;
}> {
  const retentionCutoff = new Date(
    now.getTime() - WALLBOARD_ALARM_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const requestedCutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const scope = wallboardAlarmScope(campaignId);
  const where = and(
    eq(wallboardAlarmHistory.userId, userId),
    eq(wallboardAlarmHistory.scope, scope),
    gte(wallboardAlarmHistory.lastObservedAt, requestedCutoff),
    gte(wallboardAlarmHistory.lastObservedAt, retentionCutoff),
    wallboardAlarmHistoryVisibilityCondition(campaignId, readableMissionIds),
  );
  const rows = await queryDb.select().from(wallboardAlarmHistory)
    .where(where)
    .orderBy(desc(wallboardAlarmHistory.lastObservedAt), desc(wallboardAlarmHistory.revision))
    .limit(1_001);
  return {
    items: rows.slice(0, 1_000).map(historyEntryFromRow),
    retentionDays: WALLBOARD_ALARM_HISTORY_RETENTION_DAYS,
    truncated: rows.length > 1_000,
  };
}
