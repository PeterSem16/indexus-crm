import { EventEmitter } from "events";
import { db } from "../db";
import { eq, and, inArray, asc, desc, sql } from "drizzle-orm";
import {
  inboundQueues,
  queueMembers,
  agentQueueStatus,
  inboundCallLogs,
  ivrMessages,
  agentSessions,
  users,
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

interface PendingAgentCall {
  callerChannelId: string;
  callId: string;
  agentId: string;
  queueId: string;
  callerNumber: string;
  callerName: string;
  customerId: string | null;
  waitDuration: number;
  queueName: string;
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
  private pendingAgentCalls: Map<string, PendingAgentCall> = new Map();
  private activeBridges: Map<string, { bridgeId: string; callerChannelId: string; agentChannelId: string; callId: string; agentId: string }> = new Map();

  constructor(ariClient: AriClient) {
    super();
    this.ariClient = ariClient;
    this.setupAriHandlers();
  }

  private setupAriHandlers(): void {
    this.ariClient.on("stasis-start", (event: AriEvent) => {
      if (event.channel) {
        const args = event.args || [];
        if (args[0] === "agent-call" || args[0] === "transfer") {
          console.log(`[QueueEngine] StasisStart for originated channel ${event.channel.id} (args: ${args.join(',')})`);
          const agentCall = this.pendingAgentCalls.get(event.channel.id);
          if (agentCall) {
            console.log(`[QueueEngine] Originated channel ${event.channel.id} entered Stasis, state: ${event.channel.state}`);
            if (event.channel.state === "Up") {
              this.handleAgentChannelAnswer(event.channel.id, agentCall);
            }
          } else {
            console.warn(`[QueueEngine] Originated channel ${event.channel.id} StasisStart but no pending call found (race?)`);
          }
          return;
        }
        const pendingCheck = this.pendingAgentCalls.get(event.channel.id);
        if (pendingCheck) {
          console.log(`[QueueEngine] StasisStart matched pending agent call by channel ID: ${event.channel.id}`);
          if (event.channel.state === "Up") {
            this.handleAgentChannelAnswer(event.channel.id, pendingCheck);
          }
          return;
        }
      }
      this.handleIncomingCall(event);
    });

    this.ariClient.on("channel-state-change", (event: AriEvent) => {
      if (event.channel && event.channel.state === "Up") {
        const agentCall = this.pendingAgentCalls.get(event.channel.id);
        if (agentCall) {
          this.handleAgentChannelAnswer(event.channel.id, agentCall);
        }
      }
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
      const sessions = await db.select().from(agentSessions)
        .where(inArray(agentSessions.status, ["available", "break", "busy"]));

      const membersByUser = new Map<string, { queueIds: string[]; minPenalty: number }>();
      for (const m of members) {
        const existing = membersByUser.get(m.userId) || { queueIds: [], minPenalty: 999 };
        existing.queueIds.push(m.queueId);
        existing.minPenalty = Math.min(existing.minPenalty, m.penalty);
        membersByUser.set(m.userId, existing);
      }

      const sessionsByUser = new Map<string, string[]>();
      for (const s of sessions) {
        const qIds: string[] = (s as any).inboundQueueIds || [];
        if (qIds.length > 0) {
          sessionsByUser.set(s.userId, qIds);
        }
      }

      for (const state of states) {
        const memberInfo = membersByUser.get(state.userId);
        const sessionQueueIds = sessionsByUser.get(state.userId) || [];
        const allQueueIds = [...new Set([...(memberInfo?.queueIds || []), ...sessionQueueIds])];
        this.agentStates.set(state.userId, {
          userId: state.userId,
          status: state.status as AgentState["status"],
          currentCallId: state.currentCallId,
          lastCallEndedAt: state.lastCallEndedAt,
          callsHandled: state.callsHandled,
          queueIds: allQueueIds,
          sipExtension: null,
          penalty: memberInfo?.minPenalty || 0,
        });
        console.log(`[QueueEngine] Loaded agent ${state.userId}: ${state.status}, queues: [${allQueueIds.join(',')}]`);
      }

      for (const [userId, queueIds] of sessionsByUser.entries()) {
        if (!this.agentStates.has(userId)) {
          const session = sessions.find(s => s.userId === userId);
          if (session) {
            const sessionStatus = session.status === "available" ? "available" : session.status === "busy" ? "busy" : "break";
            console.log(`[QueueEngine] Loaded session agent ${userId}: ${sessionStatus}, queues: [${queueIds.join(',')}]`);
            this.agentStates.set(userId, {
              userId,
              status: sessionStatus as AgentState["status"],
              currentCallId: null,
              lastCallEndedAt: null,
              callsHandled: 0,
              queueIds,
              sipExtension: null,
              penalty: 0,
            });
          }
        }
      }

      console.log(`[QueueEngine] Loaded ${this.agentStates.size} agent states total`);
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
    const stasisArgs = event.args || [];
    const callerNumber = channel.caller?.number || stasisArgs[1] || "unknown";
    const callerName = channel.caller?.name || "";
    const dialedNumber = channel.dialplan?.exten || stasisArgs[0] || "";

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

    console.log(`[QueueEngine] Selecting agent for queue "${queue.name}" (${queue.id}): ${members.length} DB members`);

    const activeSessions = await db.select().from(agentSessions)
      .where(inArray(agentSessions.status, ["available", "break", "busy"]));

    const sessionAgentIds: string[] = [];
    for (const session of activeSessions) {
      const sessionQueueIds: string[] = (session as any).inboundQueueIds || [];
      if (sessionQueueIds.includes(queue.id)) {
        sessionAgentIds.push(session.userId);
      }
    }

    console.log(`[QueueEngine]   Session agents for this queue: ${sessionAgentIds.length} (${sessionAgentIds.join(', ') || 'none'})`);

    const memberUserIds = members.map(m => m.userId);
    const allAgentIds = [...new Set([...memberUserIds, ...sessionAgentIds])];

    console.log(`[QueueEngine]   Total candidate agents: ${allAgentIds.length}`);

    if (allAgentIds.length === 0) {
      console.log(`[QueueEngine] No agents assigned to queue "${queue.name}" via members or sessions`);
      return null;
    }

    const dbStates = await db.select().from(agentQueueStatus)
      .where(inArray(agentQueueStatus.userId, allAgentIds));

    for (const dbState of dbStates) {
      const existing = this.agentStates.get(dbState.userId);
      const memberInfo = members.find(m => m.userId === dbState.userId);
      const memberQueueIds = members.filter(m => m.userId === dbState.userId).map(m => m.queueId);
      const sessionQueueIds = activeSessions
        .filter(s => s.userId === dbState.userId)
        .flatMap(s => (s as any).inboundQueueIds || []);
      const allQueueIds = [...new Set([...memberQueueIds, ...sessionQueueIds])];

      const wasChanged = !existing || existing.status !== dbState.status;
      this.agentStates.set(dbState.userId, {
        userId: dbState.userId,
        status: dbState.status as AgentState["status"],
        currentCallId: dbState.currentCallId,
        lastCallEndedAt: dbState.lastCallEndedAt,
        callsHandled: dbState.callsHandled,
        queueIds: allQueueIds.length > 0 ? allQueueIds : (existing?.queueIds || []),
        sipExtension: existing?.sipExtension || null,
        penalty: memberInfo?.penalty ?? existing?.penalty ?? 0,
      });
      if (wasChanged) {
        console.log(`[QueueEngine]   Synced agent ${dbState.userId} from DB: ${dbState.status} (queues: ${allQueueIds.join(',')})`);
      }
    }

    for (const agentId of allAgentIds) {
      if (!this.agentStates.has(agentId)) {
        const session = activeSessions.find(s => s.userId === agentId);
        if (session) {
          const sessionStatus = session.status === "available" ? "available" : session.status === "busy" ? "busy" : "break";
          const sessionQIds: string[] = (session as any).inboundQueueIds || [];
          const mQIds = members.filter(m => m.userId === agentId).map(m => m.queueId);
          console.log(`[QueueEngine]   Creating state from session for agent ${agentId}: ${sessionStatus}`);
          this.agentStates.set(agentId, {
            userId: agentId,
            status: sessionStatus as AgentState["status"],
            currentCallId: null,
            lastCallEndedAt: null,
            callsHandled: 0,
            queueIds: [...new Set([...mQIds, ...sessionQIds])],
            sipExtension: null,
            penalty: 0,
          });
        }
      }
    }

    const availableAgents: AgentState[] = [];
    for (const agentId of allAgentIds) {
      const state = this.agentStates.get(agentId);
      const memberInfo = members.find(m => m.userId === agentId);
      const penalty = memberInfo?.penalty ?? state?.penalty ?? 0;
      console.log(`[QueueEngine]   Agent ${agentId}: state=${state?.status || 'NOT_IN_MEMORY'} (penalty: ${penalty})`);
      if (state && state.status === "available") {
        availableAgents.push({ ...state, penalty });
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

    const [agentUser] = await db.select({
      sipExtension: users.sipExtension,
      sipEnabled: users.sipEnabled,
      fullName: users.fullName,
    }).from(users).where(eq(users.id, agent.userId)).limit(1);

    if (!agentUser || !agentUser.sipEnabled || !agentUser.sipExtension) {
      console.log(`[QueueEngine] Agent ${agent.userId} has no SIP extension configured (sipEnabled=${agentUser?.sipEnabled}, ext=${agentUser?.sipExtension})`);
      console.log(`[QueueEngine] Call ${call.id} waiting for agent to answer via WebRTC/workspace`);
      return;
    }

    const sipEndpoint = `PJSIP/${agentUser.sipExtension}`;
    console.log(`[QueueEngine] === ORIGINATING CALL TO AGENT ===`);
    console.log(`[QueueEngine]   Agent: ${agentUser.fullName} (ext: ${agentUser.sipExtension})`);
    console.log(`[QueueEngine]   Endpoint: ${sipEndpoint}`);
    console.log(`[QueueEngine]   Caller channel: ${call.channelId}`);
    console.log(`[QueueEngine]   Call ID: ${call.id}`);

    try {
      const agentChannel = await this.ariClient.originateChannel(
        sipEndpoint,
        agentUser.sipExtension,
        "default",
        call.callerNumber,
        `agent-call,${agent.userId},${call.channelId}`
      );

      console.log(`[QueueEngine] Agent channel created: ${agentChannel.id} for agent ${agent.userId}`);

      this.pendingAgentCalls.set(agentChannel.id, {
        callerChannelId: call.channelId,
        callId: call.id,
        agentId: agent.userId,
        queueId: queue.id,
        callerNumber: call.callerNumber,
        callerName: call.callerName,
        customerId: call.customerId,
        waitDuration,
        queueName: queue.name,
      });

      setTimeout(async () => {
        const pendingTimeout = this.pendingAgentCalls.get(agentChannel.id);
        if (pendingTimeout) {
          console.log(`[QueueEngine] Agent ${agent.userId} did not answer within 30s, cancelling`);
          this.pendingAgentCalls.delete(agentChannel.id);
          try { this.ariClient.hangupChannel(agentChannel.id, "normal"); } catch {}
          this.updateAgentStatus(agent.userId, "available", null);
          this.waitingCalls.set(call.channelId, call);
          await db.update(inboundCallLogs)
            .set({ status: "queued", assignedAgentId: null })
            .where(eq(inboundCallLogs.id, call.id));
          this.startMohForChannel(call.channelId, queue.id);
          this.processQueues();
        }
      }, 30000);
    } catch (err: any) {
      console.error(`[QueueEngine] Failed to originate call to agent ${agent.userId}:`, err.message);
      this.updateAgentStatus(agent.userId, "available", null);
      this.waitingCalls.set(call.channelId, call);
      await this.startMohForChannel(call.channelId, queue.id);
      await db.update(inboundCallLogs)
        .set({ status: "queued", assignedAgentId: null })
        .where(eq(inboundCallLogs.id, call.id));
      console.log(`[QueueEngine] Requeued call ${call.id} after originate failure`);
      this.processQueues();
    }
  }

  private async handleAgentChannelAnswer(agentChannelId: string, pending: PendingAgentCall): Promise<void> {
    this.pendingAgentCalls.delete(agentChannelId);
    const isTransfer = pending.agentId === "transfer-target";
    console.log(`[QueueEngine] ${isTransfer ? "Transfer target" : "Agent"} answered! Bridging caller ${pending.callerChannelId} with channel ${agentChannelId}`);

    try {
      await this.stopMohForChannel(pending.callerChannelId);

      const bridge = await this.ariClient.createBridge("mixing");
      console.log(`[QueueEngine] Bridge created: ${bridge.id}`);

      await this.ariClient.addChannelToBridge(bridge.id, pending.callerChannelId);
      await this.ariClient.addChannelToBridge(bridge.id, agentChannelId);

      console.log(`[QueueEngine] Both channels added to bridge ${bridge.id}`);

      this.activeBridges.set(pending.callerChannelId, {
        bridgeId: bridge.id,
        callerChannelId: pending.callerChannelId,
        agentChannelId,
        callId: pending.callId,
        agentId: pending.agentId,
      });
      this.activeBridges.set(agentChannelId, {
        bridgeId: bridge.id,
        callerChannelId: pending.callerChannelId,
        agentChannelId,
        callId: pending.callId,
        agentId: pending.agentId,
      });

      if (!isTransfer && !pending.callId.startsWith("transfer-")) {
        await db.update(inboundCallLogs)
          .set({
            status: "answered",
            answeredAt: new Date(),
          })
          .where(eq(inboundCallLogs.id, pending.callId));
      }

      this.emit("call-answered", {
        callId: pending.callId,
        agentId: pending.agentId,
        callerNumber: pending.callerNumber,
      });
    } catch (err: any) {
      console.error(`[QueueEngine] Failed to bridge channels:`, err.message);
      try { await this.ariClient.hangupChannel(agentChannelId, "normal"); } catch {}
      if (!isTransfer) {
        this.updateAgentStatus(pending.agentId, "available", null);
      }
    }
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

    const pending = this.pendingAgentCalls.get(channelId);
    if (pending) {
      console.log(`[QueueEngine] Agent channel ${channelId} destroyed before answer (agent rejected/unavailable)`);
      this.pendingAgentCalls.delete(channelId);
      this.updateAgentStatus(pending.agentId, "available", null);
      const call: QueuedCall = {
        id: pending.callId,
        channelId: pending.callerChannelId,
        callerNumber: pending.callerNumber,
        callerName: pending.callerName,
        queueId: pending.queueId,
        customerId: pending.customerId,
        enteredAt: new Date(),
        position: 1,
      };
      this.waitingCalls.set(pending.callerChannelId, call);
      this.startMohForChannel(pending.callerChannelId, pending.queueId);
      this.processQueues();
      return;
    }

    const bridge = this.activeBridges.get(channelId);
    if (bridge) {
      console.log(`[QueueEngine] Channel ${channelId} in active bridge destroyed, completing call ${bridge.callId}`);
      this.activeBridges.delete(bridge.callerChannelId);
      this.activeBridges.delete(bridge.agentChannelId);

      const otherChannelId = channelId === bridge.callerChannelId ? bridge.agentChannelId : bridge.callerChannelId;
      try { this.ariClient.hangupChannel(otherChannelId, "normal"); } catch {}
      try { this.ariClient.destroyBridge(bridge.bridgeId); } catch {}

      this.agentCompletedCall(bridge.callId, bridge.agentId);
      return;
    }

    for (const [agentChId, pending] of this.pendingAgentCalls.entries()) {
      if (pending.callerChannelId === channelId) {
        console.log(`[QueueEngine] Caller channel ${channelId} destroyed while agent ${agentChId} is ringing`);
        this.pendingAgentCalls.delete(agentChId);
        try { this.ariClient.hangupChannel(agentChId, "normal"); } catch {}
        this.updateAgentStatus(pending.agentId, "available", null);
        db.update(inboundCallLogs)
          .set({ status: "abandoned", completedAt: new Date(), abandonReason: "caller_hangup" })
          .where(eq(inboundCallLogs.id, pending.callId))
          .catch(() => {});
        this.emit("call-abandoned", {
          callId: pending.callId,
          queueId: pending.queueId,
          callerNumber: pending.callerNumber,
          reason: "caller_hangup",
          assignedAgentId: pending.agentId,
        });
        return;
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

    for (const [agentChId, pending] of this.pendingAgentCalls.entries()) {
      if (pending.callerChannelId === channelId) {
        console.log(`[QueueEngine] Caller hung up, cancelling pending agent call ${agentChId}`);
        this.pendingAgentCalls.delete(agentChId);
        try { await this.ariClient.hangupChannel(agentChId, "normal"); } catch {}
        this.updateAgentStatus(pending.agentId, "available", null);
      }
    }

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
            const target = queue.afterHoursTarget;
            const dialEndpoint = target.includes("/") ? target : `PJSIP/${target}`;
            console.log(`[QueueEngine] After-hours transfer to ${dialEndpoint}`);
            const okTransfer = await this.transferCallToEndpoint(channelId, dialEndpoint, queue);
            if (!okTransfer) {
              await this.ariClient.hangupChannel(channelId, "normal");
            }
          } else {
            await this.ariClient.hangupChannel(channelId, "normal");
          }
          break;
        case "user_pjsip":
          if (queue.afterHoursTarget) {
            const [targetUser] = await db.select({ sipExtension: users.sipExtension, sipEnabled: users.sipEnabled, fullName: users.fullName })
              .from(users).where(eq(users.id, queue.afterHoursTarget)).limit(1);
            if (targetUser?.sipEnabled && targetUser.sipExtension) {
              console.log(`[QueueEngine] After-hours: originating call to user PJSIP/${targetUser.sipExtension} (${targetUser.fullName})`);
              const okPjsip = await this.transferCallToEndpoint(channelId, `PJSIP/${targetUser.sipExtension}`, queue);
              if (!okPjsip) {
                await this.ariClient.hangupChannel(channelId, "normal");
              }
            } else {
              console.warn(`[QueueEngine] After-hours user ${queue.afterHoursTarget} has no SIP extension, hanging up`);
              await this.ariClient.hangupChannel(channelId, "normal");
            }
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

  private async transferCallToEndpoint(callerChannelId: string, endpoint: string, queue: InboundQueue): Promise<boolean> {
    try {
      const waitingCall = this.waitingCalls.get(callerChannelId);
      const callerNumber = waitingCall?.callerNumber || "unknown";
      const callerName = waitingCall?.callerName || "";

      console.log(`[QueueEngine] === TRANSFER TO ENDPOINT ===`);
      console.log(`[QueueEngine]   Caller channel: ${callerChannelId}`);
      console.log(`[QueueEngine]   Target endpoint: ${endpoint}`);
      console.log(`[QueueEngine]   Caller: ${callerNumber}`);

      await this.stopMohForChannel(callerChannelId);
      this.waitingCalls.delete(callerChannelId);

      const agentChannel = await this.ariClient.originateChannel(
        endpoint,
        endpoint.replace(/^PJSIP\//, ""),
        "default",
        callerNumber !== "unknown" ? callerNumber : undefined,
        `transfer,${callerChannelId}`
      );

      console.log(`[QueueEngine] Transfer channel created: ${agentChannel.id}, waiting for answer...`);

      this.pendingAgentCalls.set(agentChannel.id, {
        callerChannelId,
        agentId: "transfer-target",
        callId: waitingCall?.id || `transfer-${Date.now()}`,
        queueId: queue.id,
        callerNumber,
        callerName,
        customerId: null,
        waitDuration: waitingCall ? (Date.now() - waitingCall.enteredAt.getTime()) / 1000 : 0,
        queueName: queue.name,
      });

      return true;
    } catch (err: any) {
      console.error(`[QueueEngine] Transfer to ${endpoint} failed:`, err.message);
      return false;
    }
  }

  private async handleOverflow(channelId: string, queue: InboundQueue): Promise<void> {
    try {
      console.log(`[QueueEngine] Handling overflow for channel ${channelId}: action=${queue.overflowAction}`);
      switch (queue.overflowAction) {
        case "hangup":
          await this.ariClient.hangupChannel(channelId, "normal");
          break;
        case "transfer":
          if (queue.overflowTarget) {
            const target = queue.overflowTarget;
            const dialEndpoint = target.includes("/") ? target : `PJSIP/${target}`;
            console.log(`[QueueEngine] Overflow transfer to ${dialEndpoint}`);
            const ok = await this.transferCallToEndpoint(channelId, dialEndpoint, queue);
            if (!ok) {
              await this.ariClient.hangupChannel(channelId, "normal");
            }
          } else {
            await this.ariClient.hangupChannel(channelId, "normal");
          }
          break;
        case "user_pjsip":
          if (queue.overflowUserId) {
            const [targetUser] = await db.select({ sipExtension: users.sipExtension, sipEnabled: users.sipEnabled, fullName: users.fullName })
              .from(users).where(eq(users.id, queue.overflowUserId)).limit(1);
            if (targetUser?.sipEnabled && targetUser.sipExtension) {
              console.log(`[QueueEngine] Overflow: originating call to user PJSIP/${targetUser.sipExtension} (${targetUser.fullName})`);
              const ok = await this.transferCallToEndpoint(channelId, `PJSIP/${targetUser.sipExtension}`, queue);
              if (!ok) {
                await this.ariClient.hangupChannel(channelId, "normal");
              }
            } else {
              console.warn(`[QueueEngine] Overflow user ${queue.overflowUserId} has no SIP extension, hanging up`);
              await this.ariClient.hangupChannel(channelId, "normal");
            }
          } else {
            await this.ariClient.hangupChannel(channelId, "normal");
          }
          break;
        case "queue":
          if (queue.overflowTarget) {
            console.log(`[QueueEngine] Overflow: routing to queue ${queue.overflowTarget}`);
            const call = this.waitingCalls.get(channelId);
            if (call) {
              this.waitingCalls.delete(channelId);
              call.queueId = queue.overflowTarget;
              this.waitingCalls.set(channelId, call);
              await this.startMohForChannel(channelId, queue.overflowTarget);
            }
          } else {
            await this.ariClient.hangupChannel(channelId, "normal");
          }
          break;
        default:
          await this.ariClient.hangupChannel(channelId, "normal");
      }
    } catch (err) {
      console.error("[QueueEngine] Overflow handling failed:", err);
      try { await this.ariClient.hangupChannel(channelId, "normal"); } catch {}
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
