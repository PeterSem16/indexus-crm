import { EventEmitter } from "events";
import { db } from "../db";
import { eq, and, inArray, asc, desc, sql } from "drizzle-orm";
import {
  inboundQueues,
  queueMembers,
  agentQueueStatus,
  inboundCallLogs,
  ivrMessages,
  type InboundQueue,
  type QueueMember,
  type InboundCallLog,
} from "@shared/schema";
import { AriClient, type AriEvent, type AriChannel } from "./ari-client";

export interface QueuedCall {
  id: string;
  channelId: string;
  callerNumber: string;
  callerName: string;
  queueId: string;
  customerId: string | null;
  enteredAt: Date;
  position: number;
  bridgeId?: string;
}

export interface AgentState {
  userId: string;
  status: "available" | "busy" | "break" | "wrap_up" | "offline";
  currentCallId: string | null;
  lastCallEndedAt: Date | null;
  callsHandled: number;
  queueIds: string[];
  sipExtension: string | null;
  penalty: number;
}

export class QueueEngine extends EventEmitter {
  private ariClient: AriClient;
  private waitingCalls: Map<string, QueuedCall> = new Map();
  private agentStates: Map<string, AgentState> = new Map();
  private roundRobinIndex: Map<string, number> = new Map();
  private wrapUpTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private pendingWelcome: Map<string, { channelId: string; queueId: string }> = new Map();
  private mohPlaybacks: Map<string, string> = new Map();

  constructor(ariClient: AriClient) {
    super();
    this.ariClient = ariClient;
    this.setupAriHandlers();
  }

  private setupAriHandlers(): void {
    this.ariClient.on("stasis-start", (event: AriEvent) => {
      this.handleIncomingCall(event);
    });

    this.ariClient.on("channel-destroyed", (event: AriEvent) => {
      if (event.channel) {
        this.handleChannelDestroyed(event.channel.id);
      }
    });

    this.ariClient.on("channel-hangup-request", (event: AriEvent) => {
      if (event.channel) {
        this.handleCallerHangup(event.channel.id);
      }
    });

    this.ariClient.on("playback-finished", (event: AriEvent) => {
      this.handlePlaybackFinished(event);
    });
  }

  private async handlePlaybackFinished(event: AriEvent): Promise<void> {
    const playbackId = event.playback?.id;
    if (!playbackId) return;

    const welcome = this.pendingWelcome.get(playbackId);
    if (welcome) {
      this.pendingWelcome.delete(playbackId);
      console.log(`[QueueEngine] Welcome playback finished for channel ${welcome.channelId}, starting MOH`);
      await this.startMohForChannel(welcome.channelId, welcome.queueId);
      return;
    }

    for (const [channelId, mohPbId] of this.mohPlaybacks.entries()) {
      if (mohPbId === playbackId) {
        if (this.waitingCalls.has(channelId)) {
          console.log(`[QueueEngine] MOH playback finished, restarting for channel ${channelId}`);
          await this.startMohForChannel(channelId, this.waitingCalls.get(channelId)!.queueId);
        }
        break;
      }
    }
  }

  private async startMohForChannel(channelId: string, queueId: string): Promise<void> {
    try {
      const existingPbId = this.mohPlaybacks.get(channelId);
      if (existingPbId && existingPbId !== "default-moh") {
        try { await this.ariClient.stopPlayback(existingPbId); } catch {}
      }

      const queue = (await db.select().from(inboundQueues).where(eq(inboundQueues.id, queueId)).limit(1))[0];
      if (queue?.holdMusicId) {
        const [holdMsg] = await db.select().from(ivrMessages).where(eq(ivrMessages.id, queue.holdMusicId)).limit(1);
        if (holdMsg) {
          const holdSoundName = holdMsg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const pbId = `moh-${channelId}-${Date.now()}`;
          console.log(`[QueueEngine] Playing custom MOH: sound:custom/${holdSoundName} (pbId: ${pbId})`);
          this.mohPlaybacks.set(channelId, pbId);
          await this.ariClient.playMedia(channelId, `sound:custom/${holdSoundName}`, pbId);
          return;
        }
      }
      console.log(`[QueueEngine] Starting default MOH for channel ${channelId}`);
      this.mohPlaybacks.set(channelId, "default-moh");
      await this.ariClient.startMoh(channelId);
    } catch (err) {
      console.warn(`[QueueEngine] MOH start failed for ${channelId}:`, err instanceof Error ? err.message : err);
    }
  }

  private async stopMohForChannel(channelId: string): Promise<void> {
    const mohPbId = this.mohPlaybacks.get(channelId);
    if (!mohPbId) return;
    this.mohPlaybacks.delete(channelId);
    try {
      if (mohPbId === "default-moh") {
        await this.ariClient.stopMoh(channelId);
      } else {
        await this.ariClient.stopPlayback(mohPbId);
      }
      console.log(`[QueueEngine] Stopped MOH for channel ${channelId}`);
    } catch (err) {
      console.warn(`[QueueEngine] Failed to stop MOH for ${channelId}:`, err instanceof Error ? err.message : err);
    }
  }

  async start(): Promise<void> {
    await this.loadAgentStates();
    this.checkInterval = setInterval(() => {
      this.processQueues();
      this.checkTimeouts();
    }, 2000);
    console.log("[QueueEngine] Started");
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    for (const timer of this.wrapUpTimers.values()) {
      clearTimeout(timer);
    }
    this.wrapUpTimers.clear();
    console.log("[QueueEngine] Stopped");
  }

  private async loadAgentStates(): Promise<void> {
    try {
      const states = await db.select().from(agentQueueStatus);
      const members = await db.select().from(queueMembers).where(eq(queueMembers.isActive, true));

      const membersByUser = new Map<string, { queueIds: string[]; minPenalty: number }>();
      for (const m of members) {
        const existing = membersByUser.get(m.userId) || { queueIds: [], minPenalty: 999 };
        existing.queueIds.push(m.queueId);
        existing.minPenalty = Math.min(existing.minPenalty, m.penalty);
        membersByUser.set(m.userId, existing);
      }

      for (const state of states) {
        const memberInfo = membersByUser.get(state.userId);
        this.agentStates.set(state.userId, {
          userId: state.userId,
          status: state.status as AgentState["status"],
          currentCallId: state.currentCallId,
          lastCallEndedAt: state.lastCallEndedAt,
          callsHandled: state.callsHandled,
          queueIds: memberInfo?.queueIds || [],
          sipExtension: null,
          penalty: memberInfo?.minPenalty || 0,
        });
      }
    } catch (err) {
      console.error("[QueueEngine] Failed to load agent states:", err);
    }
  }

  async handleIncomingCall(event: AriEvent): Promise<void> {
    if (!event.channel) {
      console.log(`[QueueEngine] StasisStart event received but no channel data`);
      return;
    }

    const channel = event.channel;
    const callerNumber = channel.caller?.number || event.args?.[2] || "unknown";
    const callerName = channel.caller?.name || "";
    const dialedNumber = channel.dialplan?.exten || event.args?.[1] || "";
    const stasisArgs = event.args || [];

    console.log(`[QueueEngine] === INCOMING CALL ===`);
    console.log(`[QueueEngine]   Caller: ${callerNumber} (${callerName})`);
    console.log(`[QueueEngine]   Dialed: ${dialedNumber}`);
    console.log(`[QueueEngine]   Channel: ${channel.id}`);
    console.log(`[QueueEngine]   Channel state: ${channel.state}`);
    console.log(`[QueueEngine]   Stasis args: ${JSON.stringify(stasisArgs)}`);
    console.log(`[QueueEngine]   Dialplan: ${JSON.stringify(channel.dialplan)}`);

    const queue = await this.findQueueForNumber(dialedNumber);
    if (!queue) {
      console.log(`[QueueEngine] No queue found for DID "${dialedNumber}". Available queues:`);
      const allQueues = await db.select().from(inboundQueues);
      allQueues.forEach(q => console.log(`[QueueEngine]   Queue "${q.name}" → DID: "${q.didNumber}" (active: ${q.isActive})`));
      console.log(`[QueueEngine] Hanging up channel ${channel.id}`);
      try {
        await this.ariClient.hangupChannel(channel.id, "normal");
      } catch {}
      return;
    }

    console.log(`[QueueEngine] Matched queue: "${queue.name}" (id: ${queue.id}, strategy: ${queue.strategy})`);

    if (!this.isWithinBusinessHours(queue)) {
      console.log(`[QueueEngine] Queue "${queue.name}" is outside business hours (${queue.activeFrom}-${queue.activeTo}, tz: ${queue.timezone})`);
      await this.handleAfterHours(channel.id, queue);
      return;
    }

    if (this.getQueueSize(queue.id) >= queue.maxQueueSize) {
      console.log(`[QueueEngine] Queue ${queue.name} is full, handling overflow`);
      await this.handleOverflow(channel.id, queue);
      return;
    }

    try {
      await this.ariClient.answerChannel(channel.id);
    } catch (err) {
      console.error(`[QueueEngine] Failed to answer channel ${channel.id}:`, err);
      return;
    }

    let welcomePlayed = false;
    if (queue.welcomeMessageId) {
      try {
        const [msg] = await db.select().from(ivrMessages).where(eq(ivrMessages.id, queue.welcomeMessageId)).limit(1);
        if (msg) {
          const soundName = msg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const welcomePbId = `welcome-${channel.id}-${Date.now()}`;
          console.log(`[QueueEngine] Playing welcome: sound:custom/${soundName} (pbId: ${welcomePbId})`);
          this.pendingWelcome.set(welcomePbId, { channelId: channel.id, queueId: queue.id });
          await this.ariClient.playMedia(channel.id, `sound:custom/${soundName}`, welcomePbId);
          welcomePlayed = true;
        }
      } catch (err) {
        console.warn(`[QueueEngine] Welcome message playback failed, continuing:`, err instanceof Error ? err.message : err);
      }
    }

    if (!welcomePlayed) {
      await this.startMohForChannel(channel.id, queue.id);
    }

    const customerId = await this.lookupCustomer(callerNumber);

    const callLog = await db.insert(inboundCallLogs).values({
      queueId: queue.id,
      callerNumber,
      callerName,
      customerId,
      ariChannelId: channel.id,
      status: "queued",
      queuePosition: this.getQueueSize(queue.id) + 1,
    }).returning();

    const queuedCall: QueuedCall = {
      id: callLog[0].id,
      channelId: channel.id,
      callerNumber,
      callerName,
      queueId: queue.id,
      customerId,
      enteredAt: new Date(),
      position: this.getQueueSize(queue.id) + 1,
    };

    this.waitingCalls.set(channel.id, queuedCall);

    this.emit("call-queued", {
      callId: queuedCall.id,
      queueId: queue.id,
      queueName: queue.name,
      callerNumber,
      callerName,
      customerId,
      position: queuedCall.position,
      channelId: channel.id,
    });

    this.processQueues();
  }

  private async findQueueForNumber(didNumber: string): Promise<InboundQueue | null> {
    if (!didNumber) return null;
    const queues = await db.select().from(inboundQueues)
      .where(and(eq(inboundQueues.isActive, true), eq(inboundQueues.didNumber, didNumber)))
      .limit(1);
    return queues[0] || null;
  }

  private async lookupCustomer(phoneNumber: string): Promise<string | null> {
    try {
      const cleanNumber = phoneNumber.replace(/[^0-9+]/g, "");
      const result = await db.execute(
        sql`SELECT id FROM customers WHERE REPLACE(REPLACE(phone, ' ', ''), '-', '') LIKE ${'%' + cleanNumber.slice(-9)} LIMIT 1`
      );
      if (result.rows && result.rows.length > 0) {
        return (result.rows[0] as any).id;
      }
    } catch {}
    return null;
  }

  private getQueueSize(queueId: string): number {
    let count = 0;
    for (const call of this.waitingCalls.values()) {
      if (call.queueId === queueId) count++;
    }
    return count;
  }

  async processQueues(): Promise<void> {
    const queues = await db.select().from(inboundQueues)
      .where(eq(inboundQueues.isActive, true))
      .orderBy(desc(inboundQueues.priority));

    for (const queue of queues) {
      const waitingCalls = this.getWaitingCallsForQueue(queue.id);
      if (waitingCalls.length === 0) continue;

      for (const call of waitingCalls) {
        const agent = await this.selectAgent(queue);
        if (!agent) break;

        await this.connectCallToAgent(call, agent, queue);
      }
    }
  }

  private getWaitingCallsForQueue(queueId: string): QueuedCall[] {
    const calls: QueuedCall[] = [];
    for (const call of this.waitingCalls.values()) {
      if (call.queueId === queueId) calls.push(call);
    }
    return calls.sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());
  }

  private async selectAgent(queue: InboundQueue): Promise<AgentState | null> {
    const members = await db.select().from(queueMembers)
      .where(and(eq(queueMembers.queueId, queue.id), eq(queueMembers.isActive, true)));

    console.log(`[QueueEngine] Selecting agent for queue "${queue.name}": ${members.length} active members`);

    const memberUserIds = members.map(m => m.userId);
    const dbStates = memberUserIds.length > 0
      ? await db.select().from(agentQueueStatus).where(inArray(agentQueueStatus.userId, memberUserIds))
      : [];

    for (const dbState of dbStates) {
      const existing = this.agentStates.get(dbState.userId);
      const memberInfo = members.find(m => m.userId === dbState.userId);
      const memberQueueIds = members.filter(m => m.userId === dbState.userId).map(m => m.queueId);
      const wasChanged = !existing || existing.status !== dbState.status;
      this.agentStates.set(dbState.userId, {
        userId: dbState.userId,
        status: dbState.status as AgentState["status"],
        currentCallId: dbState.currentCallId,
        lastCallEndedAt: dbState.lastCallEndedAt,
        callsHandled: dbState.callsHandled,
        queueIds: memberQueueIds.length > 0 ? memberQueueIds : (existing?.queueIds || []),
        sipExtension: existing?.sipExtension || null,
        penalty: memberInfo?.penalty ?? existing?.penalty ?? 0,
      });
      if (wasChanged) {
        console.log(`[QueueEngine]   Synced agent ${dbState.userId} from DB: ${dbState.status}`);
      }
    }

    const availableAgents: AgentState[] = [];
    for (const member of members) {
      const state = this.agentStates.get(member.userId);
      console.log(`[QueueEngine]   Member ${member.userId}: state=${state?.status || 'NOT_IN_MEMORY'} (penalty: ${member.penalty})`);
      if (state && state.status === "available") {
        availableAgents.push({ ...state, penalty: member.penalty });
      }
    }

    console.log(`[QueueEngine] Available agents: ${availableAgents.length}`);
    if (availableAgents.length === 0) {
      console.log(`[QueueEngine] No available agents! All agents in memory: ${Array.from(this.agentStates.entries()).map(([id, s]) => `${id}=${s.status}`).join(', ') || 'NONE'}`);
      return null;
    }

    switch (queue.strategy) {
      case "round-robin":
        return this.selectRoundRobin(queue.id, availableAgents);
      case "least-calls":
        return this.selectLeastCalls(availableAgents);
      case "longest-idle":
        return this.selectLongestIdle(availableAgents);
      case "random":
        return this.selectRandom(availableAgents);
      case "skills-based":
        return this.selectSkillsBased(availableAgents);
      default:
        return this.selectRoundRobin(queue.id, availableAgents);
    }
  }

  private selectRoundRobin(queueId: string, agents: AgentState[]): AgentState | null {
    if (agents.length === 0) return null;
    const sorted = agents.sort((a, b) => a.penalty - b.penalty);
    const index = (this.roundRobinIndex.get(queueId) || 0) % sorted.length;
    this.roundRobinIndex.set(queueId, index + 1);
    return sorted[index];
  }

  private selectLeastCalls(agents: AgentState[]): AgentState | null {
    if (agents.length === 0) return null;
    return agents.sort((a, b) => {
      if (a.penalty !== b.penalty) return a.penalty - b.penalty;
      return a.callsHandled - b.callsHandled;
    })[0];
  }

  private selectLongestIdle(agents: AgentState[]): AgentState | null {
    if (agents.length === 0) return null;
    return agents.sort((a, b) => {
      if (a.penalty !== b.penalty) return a.penalty - b.penalty;
      const aIdle = a.lastCallEndedAt?.getTime() || 0;
      const bIdle = b.lastCallEndedAt?.getTime() || 0;
      return aIdle - bIdle;
    })[0];
  }

  private selectRandom(agents: AgentState[]): AgentState | null {
    if (agents.length === 0) return null;
    const lowestPenalty = Math.min(...agents.map(a => a.penalty));
    const filtered = agents.filter(a => a.penalty === lowestPenalty);
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  private selectSkillsBased(agents: AgentState[]): AgentState | null {
    if (agents.length === 0) return null;
    return agents.sort((a, b) => a.penalty - b.penalty)[0];
  }

  private async connectCallToAgent(call: QueuedCall, agent: AgentState, queue: InboundQueue): Promise<void> {
    console.log(`[QueueEngine] Connecting call ${call.id} to agent ${agent.userId}`);

    await this.stopMohForChannel(call.channelId);

    this.updateAgentStatus(agent.userId, "busy", call.id);

    this.waitingCalls.delete(call.channelId);

    const waitDuration = Math.floor((Date.now() - call.enteredAt.getTime()) / 1000);

    await db.update(inboundCallLogs)
      .set({
        status: "ringing",
        assignedAgentId: agent.userId,
        waitDurationSeconds: waitDuration,
      })
      .where(eq(inboundCallLogs.id, call.id));

    this.emit("call-assigned", {
      callId: call.id,
      channelId: call.channelId,
      queueId: queue.id,
      queueName: queue.name,
      agentId: agent.userId,
      callerNumber: call.callerNumber,
      callerName: call.callerName,
      customerId: call.customerId,
      waitDuration,
    });
  }

  async agentAnsweredCall(callId: string, agentId: string, agentChannelId?: string): Promise<void> {
    const callLog = await db.select().from(inboundCallLogs).where(eq(inboundCallLogs.id, callId)).limit(1);
    if (!callLog[0]) return;

    const callerChannelId = callLog[0].ariChannelId;

    if (callerChannelId && agentChannelId) {
      try {
        const bridge = await this.ariClient.createBridge("mixing");
        await this.ariClient.addChannelToBridge(bridge.id, callerChannelId);
        await this.ariClient.addChannelToBridge(bridge.id, agentChannelId);

        const waitingCall = this.waitingCalls.get(callerChannelId);
        if (waitingCall) {
          waitingCall.bridgeId = bridge.id;
        }
      } catch (err) {
        console.error("[QueueEngine] Failed to bridge channels:", err);
      }
    }

    await db.update(inboundCallLogs)
      .set({
        status: "answered",
        answeredAt: new Date(),
      })
      .where(eq(inboundCallLogs.id, callId));

    this.emit("call-answered", {
      callId,
      agentId,
      callerNumber: callLog[0].callerNumber,
    });
  }

  async agentCompletedCall(callId: string, agentId: string): Promise<void> {
    const callLog = await db.select().from(inboundCallLogs).where(eq(inboundCallLogs.id, callId)).limit(1);
    if (!callLog[0]) return;

    const talkDuration = callLog[0].answeredAt
      ? Math.floor((Date.now() - callLog[0].answeredAt.getTime()) / 1000)
      : 0;

    await db.update(inboundCallLogs)
      .set({
        status: "completed",
        completedAt: new Date(),
        talkDurationSeconds: talkDuration,
      })
      .where(eq(inboundCallLogs.id, callId));

    const queue = callLog[0].queueId
      ? (await db.select().from(inboundQueues).where(eq(inboundQueues.id, callLog[0].queueId)).limit(1))[0]
      : null;

    const wrapUpTime = queue?.wrapUpTime || 30;

    this.updateAgentStatus(agentId, "wrap_up", null);

    const timer = setTimeout(() => {
      this.wrapUpTimers.delete(agentId);
      this.updateAgentStatus(agentId, "available", null);
      this.emit("agent-available", { agentId });
      this.processQueues();
    }, wrapUpTime * 1000);
    this.wrapUpTimers.set(agentId, timer);

    const agentState = this.agentStates.get(agentId);
    if (agentState) {
      agentState.callsHandled++;
      agentState.lastCallEndedAt = new Date();
      await db.update(agentQueueStatus)
        .set({
          callsHandled: agentState.callsHandled,
          lastCallEndedAt: agentState.lastCallEndedAt,
          totalTalkTime: sql`total_talk_time + ${talkDuration}`,
        })
        .where(eq(agentQueueStatus.userId, agentId));
    }

    this.emit("call-completed", {
      callId,
      agentId,
      talkDuration,
    });
  }

  private handleChannelDestroyed(channelId: string): void {
    this.mohPlaybacks.delete(channelId);
    for (const [pbId, info] of this.pendingWelcome.entries()) {
      if (info.channelId === channelId) {
        this.pendingWelcome.delete(pbId);
      }
    }
    const call = this.waitingCalls.get(channelId);
    if (call) {
      this.handleCallerHangup(channelId);
    }
  }

  private async handleCallerHangup(channelId: string): Promise<void> {
    const call = this.waitingCalls.get(channelId);
    if (!call) return;

    this.mohPlaybacks.delete(channelId);
    this.waitingCalls.delete(channelId);

    await db.update(inboundCallLogs)
      .set({
        status: "abandoned",
        completedAt: new Date(),
        abandonReason: "caller_hangup",
        waitDurationSeconds: Math.floor((Date.now() - call.enteredAt.getTime()) / 1000),
      })
      .where(eq(inboundCallLogs.id, call.id));

    this.emit("call-abandoned", {
      callId: call.id,
      queueId: call.queueId,
      callerNumber: call.callerNumber,
      reason: "caller_hangup",
    });
  }

  private isWithinBusinessHours(queue: InboundQueue): boolean {
    if (!queue.activeFrom || !queue.activeTo) return true;

    const tz = queue.timezone || "Europe/Bratislava";
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
    const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0");

    const dayMap: Record<string, string> = { Sun: "0", Mon: "1", Tue: "2", Wed: "3", Thu: "4", Fri: "5", Sat: "6" };
    const currentDay = dayMap[parts.find(p => p.type === "weekday")?.value || "Mon"] || "1";

    const activeDays = queue.activeDays || ["1", "2", "3", "4", "5"];
    if (!activeDays.includes(currentDay)) {
      console.log(`[QueueEngine] Day ${currentDay} not in active days ${activeDays.join(",")}`);
      return false;
    }

    const currentMinutes = hour * 60 + minute;
    const [fromH, fromM] = queue.activeFrom.split(":").map(Number);
    const [toH, toM] = queue.activeTo.split(":").map(Number);
    const fromMinutes = fromH * 60 + fromM;
    const toMinutes = toH * 60 + toM;

    const withinHours = currentMinutes >= fromMinutes && currentMinutes < toMinutes;
    if (!withinHours) {
      console.log(`[QueueEngine] Current time ${hour}:${minute.toString().padStart(2, "0")} outside ${queue.activeFrom}-${queue.activeTo}`);
    }
    return withinHours;
  }

  private async handleAfterHours(channelId: string, queue: InboundQueue): Promise<void> {
    try {
      await this.ariClient.answerChannel(channelId);

      if (queue.afterHoursMessageId) {
        const [msg] = await db.select().from(ivrMessages).where(eq(ivrMessages.id, queue.afterHoursMessageId)).limit(1);
        if (msg) {
          const soundName = msg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const pbId = `afterhours-${channelId}-${Date.now()}`;
          console.log(`[QueueEngine] Playing after-hours message: custom/${soundName}`);
          await this.ariClient.playMedia(channelId, `sound:custom/${soundName}`, pbId);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      const action = queue.afterHoursAction || "voicemail";
      console.log(`[QueueEngine] After-hours action: ${action}`);

      switch (action) {
        case "hangup":
          await this.ariClient.hangupChannel(channelId, "normal");
          break;
        case "transfer":
          if (queue.afterHoursTarget) {
            await this.ariClient.redirectChannel(channelId, `SIP/${queue.afterHoursTarget}`);
          } else {
            await this.ariClient.hangupChannel(channelId, "normal");
          }
          break;
        case "queue":
          if (queue.afterHoursTarget) {
            const targetQueue = await db.select().from(inboundQueues)
              .where(and(eq(inboundQueues.id, queue.afterHoursTarget), eq(inboundQueues.isActive, true)))
              .limit(1);
            if (targetQueue[0]) {
              console.log(`[QueueEngine] Routing after-hours call to queue "${targetQueue[0].name}"`);
              const fakeEvent: AriEvent = {
                type: "StasisStart",
                channel: { id: channelId, state: "Up", caller: { number: "afterhours", name: "" }, dialplan: { exten: targetQueue[0].didNumber || "" } } as any,
                args: [],
              };
              await this.handleIncomingCall(fakeEvent);
              return;
            }
          }
          await this.ariClient.hangupChannel(channelId, "normal");
          break;
        case "voicemail":
        default:
          await this.ariClient.hangupChannel(channelId, "normal");
          break;
      }
    } catch (err) {
      console.error("[QueueEngine] After-hours handling failed:", err);
      try { await this.ariClient.hangupChannel(channelId, "normal"); } catch {}
    }
  }

  private async handleOverflow(channelId: string, queue: InboundQueue): Promise<void> {
    try {
      switch (queue.overflowAction) {
        case "hangup":
          await this.ariClient.hangupChannel(channelId, "normal");
          break;
        case "transfer":
          if (queue.overflowTarget) {
            await this.ariClient.redirectChannel(channelId, `SIP/${queue.overflowTarget}`);
          } else {
            await this.ariClient.hangupChannel(channelId, "normal");
          }
          break;
        default:
          await this.ariClient.hangupChannel(channelId, "normal");
      }
    } catch (err) {
      console.error("[QueueEngine] Overflow handling failed:", err);
    }
  }

  private async checkTimeouts(): Promise<void> {
    const now = Date.now();
    const queuesCache = new Map<string, InboundQueue>();

    for (const [channelId, call] of this.waitingCalls.entries()) {
      if (!queuesCache.has(call.queueId)) {
        const q = await db.select().from(inboundQueues).where(eq(inboundQueues.id, call.queueId)).limit(1);
        if (q[0]) queuesCache.set(call.queueId, q[0]);
      }

      const queue = queuesCache.get(call.queueId);
      if (!queue) continue;

      const waitTime = (now - call.enteredAt.getTime()) / 1000;
      if (waitTime > queue.maxWaitTime) {
        console.log(`[QueueEngine] Call ${call.id} timed out after ${Math.floor(waitTime)}s`);
        this.waitingCalls.delete(channelId);

        await db.update(inboundCallLogs)
          .set({
            status: "timeout",
            completedAt: new Date(),
            abandonReason: "timeout",
            waitDurationSeconds: Math.floor(waitTime),
          })
          .where(eq(inboundCallLogs.id, call.id));

        await this.handleOverflow(channelId, queue);

        this.emit("call-timeout", {
          callId: call.id,
          queueId: queue.id,
          callerNumber: call.callerNumber,
        });
      }
    }
  }

  async updateAgentStatus(userId: string, status: AgentState["status"], currentCallId: string | null, inboundQueueIds?: string[]): Promise<void> {
    let state = this.agentStates.get(userId);
    const members = await db.select().from(queueMembers)
      .where(and(eq(queueMembers.userId, userId), eq(queueMembers.isActive, true)));
    const memberQueueIds = members.map(m => m.queueId);

    const effectiveQueueIds = inboundQueueIds && inboundQueueIds.length > 0
      ? [...new Set([...memberQueueIds, ...inboundQueueIds])]
      : memberQueueIds;

    if (!state) {
      state = {
        userId,
        status: "offline",
        currentCallId: null,
        lastCallEndedAt: null,
        callsHandled: 0,
        queueIds: effectiveQueueIds,
        sipExtension: null,
        penalty: members.length > 0 ? Math.min(...members.map(m => m.penalty)) : 0,
      };
      this.agentStates.set(userId, state);
    } else {
      state.queueIds = effectiveQueueIds;
    }

    state.status = status;
    state.currentCallId = currentCallId;
    if (status === "available" || status === "offline") {
      state.currentCallId = null;
    }

    console.log(`[QueueEngine] Agent ${userId} status → ${status}, queueIds: [${state.queueIds.join(', ')}]`);

    const existing = await db.select().from(agentQueueStatus).where(eq(agentQueueStatus.userId, userId));
    if (existing.length > 0) {
      await db.update(agentQueueStatus)
        .set({
          status,
          currentCallId,
          updatedAt: new Date(),
          ...(status === "available" ? { loginAt: existing[0].loginAt || new Date() } : {}),
          ...(status === "offline" ? { loginAt: null } : {}),
        })
        .where(eq(agentQueueStatus.userId, userId));
    } else {
      await db.insert(agentQueueStatus).values({
        userId,
        status,
        currentCallId,
        loginAt: status !== "offline" ? new Date() : null,
      });
    }

    this.emit("agent-status-changed", {
      userId,
      status,
      currentCallId,
    });

    if (status === "available") {
      this.processQueues();
    }
  }

  async agentEndedWrapUp(agentId: string): Promise<void> {
    const timer = this.wrapUpTimers.get(agentId);
    if (timer) {
      clearTimeout(timer);
      this.wrapUpTimers.delete(agentId);
    }
    await this.updateAgentStatus(agentId, "available", null);
    this.emit("agent-available", { agentId });
    this.processQueues();
  }

  getQueueStats(queueId: string): { waiting: number; active: number; agents: number } {
    let waiting = 0;
    let active = 0;
    let agents = 0;

    for (const call of this.waitingCalls.values()) {
      if (call.queueId === queueId) waiting++;
    }

    for (const state of this.agentStates.values()) {
      if (state.queueIds.includes(queueId) && state.status !== "offline") {
        agents++;
        if (state.status === "busy") active++;
      }
    }

    return { waiting, active, agents };
  }

  getAllQueueStats(): Map<string, { waiting: number; active: number; agents: number }> {
    const stats = new Map<string, { waiting: number; active: number; agents: number }>();

    for (const call of this.waitingCalls.values()) {
      if (!stats.has(call.queueId)) {
        stats.set(call.queueId, { waiting: 0, active: 0, agents: 0 });
      }
      stats.get(call.queueId)!.waiting++;
    }

    for (const state of this.agentStates.values()) {
      if (state.status === "offline") continue;
      for (const qId of state.queueIds) {
        if (!stats.has(qId)) {
          stats.set(qId, { waiting: 0, active: 0, agents: 0 });
        }
        const s = stats.get(qId)!;
        s.agents++;
        if (state.status === "busy") s.active++;
      }
    }

    return stats;
  }

  getWaitingCalls(): QueuedCall[] {
    return Array.from(this.waitingCalls.values());
  }

  getAgentState(userId: string): AgentState | undefined {
    return this.agentStates.get(userId);
  }

  getAllAgentStates(): AgentState[] {
    return Array.from(this.agentStates.values());
  }
}

let queueEngineInstance: QueueEngine | null = null;

export function getQueueEngine(): QueueEngine | null {
  return queueEngineInstance;
}

export function initializeQueueEngine(ariClient: AriClient): QueueEngine {
  if (queueEngineInstance) {
    queueEngineInstance.stop();
  }
  queueEngineInstance = new QueueEngine(ariClient);
  return queueEngineInstance;
}

export function destroyQueueEngine(): void {
  if (queueEngineInstance) {
    queueEngineInstance.stop();
    queueEngineInstance = null;
  }
}
