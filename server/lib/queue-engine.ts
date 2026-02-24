import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";
import { db } from "../db";
import { eq, and, inArray, isNotNull, asc, desc, sql } from "drizzle-orm";
import {
  inboundQueues,
  queueMembers,
  agentQueueStatus,
  inboundCallLogs,
  ivrMessages,
  agentSessions,
  users,
  didRoutes,
  voicemailBoxes,
  voicemailMessages,
  callLogs,
  ivrMenus,
  ivrMenuOptions,
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
  originateFailures?: number;
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
  enteredAt: Date;
}

interface AssignedCall {
  call: QueuedCall;
  agentId: string;
  queueId: string;
  queue: InboundQueue;
  assignedAt: Date;
}

export class QueueEngine extends EventEmitter {
  private ariClient: AriClient;
  private waitingCalls: Map<string, QueuedCall> = new Map();
  private agentStates: Map<string, AgentState> = new Map();
  private roundRobinIndex: Map<string, number> = new Map();
  private wrapUpTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private lastChannelCheck: number = 0;
  private cachedLiveChannels: Set<string> | null = null;
  private pendingWelcome: Map<string, { channelId: string; queueId: string }> = new Map();
  private pendingWelcomeCallData: Map<string, { channelId: string; queueId: string; callerNumber: string; callerName: string; customerId: string | null; queueName: string }> = new Map();
  private mohPlaybacks: Map<string, string> = new Map();
  private pendingAgentCalls: Map<string, PendingAgentCall> = new Map();
  private activeBridges: Map<string, { bridgeId: string; callerChannelId: string; agentChannelId: string; callId: string; agentId: string }> = new Map();
  private assignedCalls: Map<string, AssignedCall> = new Map();
  private isProcessing: boolean = false;
  private lastAnnouncementTime: Map<string, number> = new Map();
  private announcementPlayingFor: Set<string> = new Set();
  private overflowInProgress: Set<string> = new Set();
  private agentOriginateCooldown: Map<string, number> = new Map();
  private ringAllPending: Map<string, { callId: string; agentChannelIds: Map<string, string>; agentIds: Set<string> }> = new Map();
  private pendingOutboundCallerIds: Map<string, { callerIdNumber: string; expiresAt: number }> = new Map();
  private subscribedEndpoints: Set<string> = new Set();

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
        this.handleChannelDestroyed(event.channel.id).catch(err => {
          console.error("[QueueEngine] handleChannelDestroyed error:", err instanceof Error ? err.message : err);
        });
      }
    });

    this.ariClient.on("channel-hangup-request", (event: AriEvent) => {
      if (event.channel) {
        this.handleCallerHangup(event.channel.id);
      }
    });

    this.ariClient.on("stasis-end", (event: AriEvent) => {
      if (event.channel) {
        const chId = event.channel.id;
        const isOverflowing = this.overflowInProgress.has(chId);
        console.log(`[QueueEngine] StasisEnd for channel ${chId}${isOverflowing ? " (overflow in progress, skipping cleanup)" : ""}`);
        if (isOverflowing) return;
        const isWaiting = this.waitingCalls.has(chId);
        const isAssigned = this.assignedCalls.has(chId);
        if (isWaiting || isAssigned) {
          console.log(`[QueueEngine] StasisEnd: caller channel ${chId} left Stasis (waiting=${isWaiting}, assigned=${isAssigned}), cleaning up as abandoned`);
          this.handleChannelLeftStasis(chId).catch(err => {
            console.error("[QueueEngine] handleChannelLeftStasis error:", err instanceof Error ? err.message : err);
          });
        }
      }
    });

    this.ariClient.on("playback-finished", (event: AriEvent) => {
      this.handlePlaybackFinished(event);
    });

    this.ariClient.on("channel-dtmf", (event: AriEvent) => {
      if (event.channel && event.digit) {
        console.log(`[QueueEngine] DTMF received: channel=${event.channel.id}, digit=${event.digit}`);
        this.emit(`dtmf:${event.channel.id}`, event.digit);
      }
    });

    this.ariClient.on("channel-created", (event: AriEvent) => {
      if (event.channel) {
        this.handleOutboundCallerIdInterception(event.channel).catch(err => {
          console.warn("[QueueEngine] Outbound caller ID interception error:", err instanceof Error ? err.message : err);
        });
      }
    });
  }

  private async handleOutboundCallerIdInterception(channel: AriChannel): Promise<void> {
    let extension: string | null = null;

    const nameMatch = (channel.name || "").match(/^PJSIP\/([^-]+)/);
    if (nameMatch) {
      const candidate = nameMatch[1];
      if (this.pendingOutboundCallerIds.has(candidate)) {
        extension = candidate;
      }
    }

    if (!extension && channel.caller?.number) {
      if (this.pendingOutboundCallerIds.has(channel.caller.number)) {
        extension = channel.caller.number;
      }
    }

    if (!extension) return;

    const pending = this.pendingOutboundCallerIds.get(extension);
    if (!pending) return;

    if (Date.now() > pending.expiresAt) {
      this.pendingOutboundCallerIds.delete(extension);
      return;
    }

    try {
      await this.ariClient.setChannelVariable(channel.id, "CALLERID(num)", pending.callerIdNumber);
      await this.ariClient.setChannelVariable(channel.id, "CALLERID(name)", pending.callerIdNumber);
      console.log(`[QueueEngine] Set outbound caller ID ${pending.callerIdNumber} on channel ${channel.id} (ext: ${extension}, name: ${channel.name})`);
    } catch (err) {
      console.warn(`[QueueEngine] Failed to set caller ID on channel ${channel.id}:`, err instanceof Error ? err.message : err);
    }

    this.pendingOutboundCallerIds.delete(extension);
  }

  async setOutboundCallerId(sipExtension: string, callerIdNumber: string): Promise<void> {
    if (!this.subscribedEndpoints.has(sipExtension)) {
      await this.ariClient.subscribeToEndpoint("PJSIP", sipExtension);
      this.subscribedEndpoints.add(sipExtension);
    }

    this.pendingOutboundCallerIds.set(sipExtension, {
      callerIdNumber,
      expiresAt: Date.now() + 30000,
    });
    console.log(`[QueueEngine] Pending outbound caller ID set: ext=${sipExtension}, callerId=${callerIdNumber} (expires in 30s)`);
  }

  private async handlePlaybackFinished(event: AriEvent): Promise<void> {
    const playbackId = event.playback?.id;
    if (!playbackId) return;

    const welcome = this.pendingWelcome.get(playbackId);
    if (welcome) {
      this.pendingWelcome.delete(playbackId);
      console.log(`[QueueEngine] Welcome playback finished for channel ${welcome.channelId}, starting MOH and queueing call`);
      await this.startMohForChannel(welcome.channelId, welcome.queueId);

      const pendingData = this.pendingWelcomeCallData.get(welcome.channelId);
      if (pendingData) {
        this.pendingWelcomeCallData.delete(welcome.channelId);
        await this.addCallToQueue(
          pendingData.channelId,
          pendingData.queueId,
          pendingData.queueName,
          pendingData.callerNumber,
          pendingData.callerName,
          pendingData.customerId
        );
      }
      return;
    }

    for (const [channelId, mohPbId] of this.mohPlaybacks.entries()) {
      if (mohPbId === playbackId) {
        if (this.overflowInProgress.has(channelId)) {
          console.log(`[QueueEngine] MOH playback finished for channel ${channelId} but overflow in progress, NOT restarting`);
          this.mohPlaybacks.delete(channelId);
          break;
        }
        if (this.waitingCalls.has(channelId)) {
          console.log(`[QueueEngine] MOH playback finished, restarting (loop) for waiting channel ${channelId}`);
          await this.startMohForChannel(channelId, this.waitingCalls.get(channelId)!.queueId);
        } else if (this.assignedCalls.has(channelId)) {
          console.log(`[QueueEngine] MOH playback finished, restarting (loop) for assigned channel ${channelId}`);
          await this.startMohForChannel(channelId, this.assignedCalls.get(channelId)!.queueId);
        } else {
          this.mohPlaybacks.delete(channelId);
        }
        break;
      }
    }
  }

  private async startMohForChannel(channelId: string, queueId: string): Promise<void> {
    try {
      const existingPbId = this.mohPlaybacks.get(channelId);
      if (existingPbId) {
        this.mohPlaybacks.delete(channelId);
        if (existingPbId === "default-moh") {
          try { await this.ariClient.stopMoh(channelId); } catch {}
        } else {
          try { await this.ariClient.stopPlayback(existingPbId); } catch {}
        }
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
    this.checkInterval = setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;
      try {
        await this.processQueues();
        await this.checkTimeouts();
      } catch (err) {
        console.error("[QueueEngine] Interval processing error:", err instanceof Error ? err.message : err);
      } finally {
        this.isProcessing = false;
      }
      this.processAnnouncements().catch(err => {
        console.error("[QueueEngine] Announcement processing error:", err instanceof Error ? err.message : err);
      });
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
    const rawCallerNumber = channel.caller?.number || stasisArgs[1] || "unknown";
    const callerNumber = rawCallerNumber.split("@")[0];
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
      console.log(`[QueueEngine] No queue found for DID "${dialedNumber}", checking DID routes...`);
      const didRoute = await this.findDidRouteForNumber(dialedNumber);
      if (didRoute) {
        console.log(`[QueueEngine] Found DID route: "${didRoute.name}" action=${didRoute.action}`);
        await this.handleDidRoute(channel, didRoute, callerNumber, callerName);
        return;
      }
      console.log(`[QueueEngine] No DID route found either. Available queues:`);
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
      await this.handleAfterHours(channel.id, queue, callerNumber, callerName);
      return;
    }

    if (this.getQueueSize(queue.id) >= queue.maxQueueSize) {
      console.log(`[QueueEngine] Queue ${queue.name} is full, handling overflow`);
      await this.handleOverflow(channel.id, queue, callerNumber, callerName);
      return;
    }

    try {
      await this.ariClient.answerChannel(channel.id);
    } catch (err) {
      console.error(`[QueueEngine] Failed to answer channel ${channel.id}:`, err);
      return;
    }

    const customerId = await this.lookupCustomer(callerNumber);

    let welcomePlayed = false;
    if (queue.welcomeMessageId) {
      try {
        const [msg] = await db.select().from(ivrMessages).where(eq(ivrMessages.id, queue.welcomeMessageId)).limit(1);
        if (msg) {
          const soundName = msg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const welcomePbId = `welcome-${channel.id}-${Date.now()}`;
          console.log(`[QueueEngine] Playing welcome: sound:custom/${soundName} (pbId: ${welcomePbId})`);
          this.pendingWelcome.set(welcomePbId, { channelId: channel.id, queueId: queue.id });
          this.pendingWelcomeCallData.set(channel.id, {
            channelId: channel.id,
            queueId: queue.id,
            callerNumber,
            callerName,
            customerId,
            queueName: queue.name,
          });
          await this.ariClient.playMedia(channel.id, `sound:custom/${soundName}`, welcomePbId);
          welcomePlayed = true;
          console.log(`[QueueEngine] Welcome playing for ${channel.id}, call will be queued after welcome finishes`);
        }
      } catch (err) {
        console.warn(`[QueueEngine] Welcome message playback failed, continuing:`, err instanceof Error ? err.message : err);
      }
    }

    if (!welcomePlayed) {
      await this.startMohForChannel(channel.id, queue.id);
      await this.addCallToQueue(channel.id, queue.id, queue.name, callerNumber, callerName, customerId);
    }
  }

  private async addCallToQueue(channelId: string, queueId: string, queueName: string, callerNumber: string, callerName: string, customerId: string | null): Promise<void> {
    const callLog = await db.insert(inboundCallLogs).values({
      queueId,
      callerNumber,
      callerName,
      customerId,
      ariChannelId: channelId,
      status: "queued",
      queuePosition: this.getQueueSize(queueId) + 1,
    }).returning();

    const queuedCall: QueuedCall = {
      id: callLog[0].id,
      channelId,
      callerNumber,
      callerName,
      queueId,
      customerId,
      enteredAt: new Date(),
      position: this.getQueueSize(queueId) + 1,
    };

    this.waitingCalls.set(channelId, queuedCall);

    this.emit("call-queued", {
      callId: queuedCall.id,
      queueId,
      queueName,
      callerNumber,
      callerName,
      customerId,
      position: queuedCall.position,
      channelId,
    });

    console.log(`[QueueEngine] Call ${queuedCall.id} added to queue "${queueName}" at position ${queuedCall.position}`);
    this.processQueues();
  }

  private async findQueueForNumber(didNumber: string): Promise<InboundQueue | null> {
    if (!didNumber) return null;
    const queues = await db.select().from(inboundQueues)
      .where(and(eq(inboundQueues.isActive, true), eq(inboundQueues.didNumber, didNumber)))
      .limit(1);
    return queues[0] || null;
  }

  private async findDidRouteForNumber(didNumber: string): Promise<typeof didRoutes.$inferSelect | null> {
    if (!didNumber) return null;
    const routes = await db.select().from(didRoutes)
      .where(and(eq(didRoutes.isActive, true), eq(didRoutes.didNumber, didNumber)))
      .limit(1);
    return routes[0] || null;
  }

  private async handleDidRoute(channel: AriChannel, route: typeof didRoutes.$inferSelect, callerNumber: string, callerName: string): Promise<void> {
    try {
      switch (route.action) {
        case "voicemail": {
          const boxId = route.voicemailBox;
          if (!boxId) {
            console.warn(`[QueueEngine] DID route "${route.name}" has voicemail action but no voicemail box, hanging up`);
            await this.ariClient.hangupChannel(channel.id, "normal");
            return;
          }
          const [box] = await db.select().from(voicemailBoxes).where(eq(voicemailBoxes.id, boxId)).limit(1);
          if (!box) {
            console.warn(`[QueueEngine] Voicemail box ${boxId} not found, hanging up`);
            await this.ariClient.hangupChannel(channel.id, "normal");
            return;
          }
          const customerId = await this.lookupCustomer(callerNumber);
          await this.sendToVoicemail(channel.id, box, callerNumber, callerName, customerId, route.didNumber);
          break;
        }
        case "inbound_queue": {
          if (route.targetQueueId) {
            const [targetQueue] = await db.select().from(inboundQueues)
              .where(and(eq(inboundQueues.id, route.targetQueueId), eq(inboundQueues.isActive, true)))
              .limit(1);
            if (targetQueue) {
              console.log(`[QueueEngine] DID route → queue "${targetQueue.name}" (id: ${targetQueue.id})`);
              await this.routeCallToQueue(channel, targetQueue, callerNumber, callerName);
              return;
            }
          }
          console.warn(`[QueueEngine] DID route target queue not found, hanging up`);
          await this.ariClient.hangupChannel(channel.id, "normal");
          break;
        }
        case "pjsip_user": {
          if (route.targetUserId) {
            const [targetUser] = await db.select({ sipExtension: users.sipExtension, sipEnabled: users.sipEnabled })
              .from(users).where(eq(users.id, route.targetUserId)).limit(1);
            if (targetUser?.sipEnabled && targetUser.sipExtension) {
              try {
                await this.ariClient.answerChannel(channel.id);
              } catch {}
              const ok = await this.transferCallToEndpoint(channel.id, `PJSIP/${targetUser.sipExtension}`, null as any);
              if (!ok) {
                await this.ariClient.hangupChannel(channel.id, "normal");
              }
              return;
            }
          }
          console.warn(`[QueueEngine] DID route target user has no SIP extension, hanging up`);
          await this.ariClient.hangupChannel(channel.id, "normal");
          break;
        }
        case "transfer": {
          if (route.targetExtension) {
            try {
              await this.ariClient.answerChannel(channel.id);
            } catch {}
            const endpoint = route.targetExtension.includes("/") ? route.targetExtension : `PJSIP/${route.targetExtension}`;
            const ok = await this.transferCallToEndpoint(channel.id, endpoint, null as any);
            if (!ok) {
              await this.ariClient.hangupChannel(channel.id, "normal");
            }
            return;
          }
          await this.ariClient.hangupChannel(channel.id, "normal");
          break;
        }
        case "ivr_menu": {
          if (route.targetIvrMenuId) {
            try {
              await this.ariClient.answerChannel(channel.id);
            } catch {}
            console.log(`[QueueEngine] DID route → IVR menu (id: ${route.targetIvrMenuId})`);
            await this.routeToIvrMenu(channel.id, route.targetIvrMenuId, callerNumber, callerName, null);
            return;
          }
          console.warn(`[QueueEngine] DID route "${route.name}" has ivr_menu action but no targetIvrMenuId, hanging up`);
          await this.ariClient.hangupChannel(channel.id, "normal");
          break;
        }
        case "hangup":
        default:
          await this.ariClient.hangupChannel(channel.id, "normal");
          break;
      }
    } catch (err) {
      console.error(`[QueueEngine] DID route handling failed:`, err);
      try { await this.ariClient.hangupChannel(channel.id, "normal"); } catch {}
    }
  }

  private waitForPlaybackFinished(playbackId: string, timeoutMs: number = 30000): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.ariClient.removeListener("playback-finished", handler);
        resolve();
      }, timeoutMs);
      const handler = (event: AriEvent) => {
        if (event.playback?.id === playbackId) {
          clearTimeout(timer);
          this.ariClient.removeListener("playback-finished", handler);
          resolve();
        }
      };
      this.ariClient.on("playback-finished", handler);
    });
  }

  async sendToVoicemail(channelId: string, box: typeof voicemailBoxes.$inferSelect, callerNumber: string, callerName: string, customerId: string | null, didNumber?: string, queueId?: string): Promise<void> {
    let channelGone = false;
    const stasisEndHandler = (event: AriEvent) => {
      if (event.channel?.id === channelId) {
        console.log(`[QueueEngine] VOICEMAIL: channel ${channelId} left Stasis during voicemail`);
        channelGone = true;
      }
    };
    const channelDestroyedHandler = (event: AriEvent) => {
      if (event.channel?.id === channelId) {
        console.log(`[QueueEngine] VOICEMAIL: channel ${channelId} destroyed during voicemail`);
        channelGone = true;
      }
    };
    this.ariClient.on("stasis-end", stasisEndHandler);
    this.ariClient.on("channel-destroyed", channelDestroyedHandler);

    try {
      console.log(`[QueueEngine] === SENDING TO VOICEMAIL ===`);
      console.log(`[QueueEngine]   Box: "${box.name}" (id: ${box.id})`);
      console.log(`[QueueEngine]   Caller: ${callerNumber} (${callerName})`);

      let channelState = "unknown";
      try {
        const chInfo = await this.ariClient.getChannel(channelId);
        channelState = chInfo?.state || "unknown";
        console.log(`[QueueEngine] VOICEMAIL: channel ${channelId} state=${channelState}`);
      } catch {
        console.log(`[QueueEngine] VOICEMAIL: channel ${channelId} not found, aborting`);
        return;
      }

      if (channelState !== "Up") {
        try {
          await this.ariClient.answerChannel(channelId);
          console.log(`[QueueEngine] VOICEMAIL: answered channel ${channelId}`);
        } catch (err) {
          console.warn(`[QueueEngine] VOICEMAIL: answer failed:`, err instanceof Error ? err.message : err);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      if (channelGone) {
        console.log(`[QueueEngine] VOICEMAIL: channel gone before greeting, aborting`);
        try { await this.ariClient.hangupChannel(channelId, "normal"); } catch {}
        return;
      }

      try {
        const chInfo2 = await this.ariClient.getChannel(channelId);
        console.log(`[QueueEngine] VOICEMAIL: pre-greeting channel check: state=${chInfo2?.state}, id=${channelId}`);
      } catch (err) {
        console.log(`[QueueEngine] VOICEMAIL: channel ${channelId} disappeared before greeting, aborting`);
        return;
      }

      const greetingInfo = this.resolveGreetingSoundName(box);
      if (greetingInfo) {
        try {
          const pbId = `vm-greeting-${channelId}-${Date.now()}`;
          const greetingMedia = `sound:custom/${greetingInfo.soundName}`;
          console.log(`[QueueEngine] Playing voicemail greeting: ${greetingMedia} (pbId: ${pbId})`);
          const playResult = await this.ariClient.playMedia(channelId, greetingMedia, pbId);
          console.log(`[QueueEngine] VOICEMAIL: playMedia returned for greeting, result:`, JSON.stringify(playResult?.id || playResult));

          if (channelGone) {
            console.log(`[QueueEngine] VOICEMAIL: channel gone immediately after greeting playMedia, aborting`);
            try { await this.ariClient.hangupChannel(channelId, "normal"); } catch {}
            return;
          }

          await this.waitForPlaybackFinished(pbId, 60000);
          console.log(`[QueueEngine] Greeting playback finished, channelGone=${channelGone}`);
        } catch (err) {
          console.warn(`[QueueEngine] Greeting playback failed:`, err instanceof Error ? err.message : err);
          if (channelGone) {
            console.log(`[QueueEngine] VOICEMAIL: channel gone during greeting, aborting`);
            try { await this.ariClient.hangupChannel(channelId, "normal"); } catch {}
            return;
          }
        }
      } else {
        console.log(`[QueueEngine] No greeting configured for box "${box.name}", skipping greeting playback`);
      }

      if (channelGone) {
        console.log(`[QueueEngine] VOICEMAIL: channel gone before beep, aborting`);
        try { await this.ariClient.hangupChannel(channelId, "normal"); } catch {}
        return;
      }

      if (box.beepToneEnabled) {
        try {
          const beepPbId = `vm-beep-${channelId}-${Date.now()}`;
          console.log(`[QueueEngine] Playing beep tone before recording`);
          await this.ariClient.playMedia(channelId, "sound:beep", beepPbId);
          await this.waitForPlaybackFinished(beepPbId, 3000);
        } catch (err) {
          console.warn(`[QueueEngine] Beep tone playback failed:`, err instanceof Error ? err.message : err);
        }
      }

      if (channelGone) {
        console.log(`[QueueEngine] VOICEMAIL: channel gone before recording, aborting`);
        try { await this.ariClient.hangupChannel(channelId, "normal"); } catch {}
        return;
      }

      const recordingName = `voicemail-${box.id}-${Date.now()}`;
      const recordingDir = path.resolve("voicemail-recordings");
      if (!fs.existsSync(recordingDir)) {
        fs.mkdirSync(recordingDir, { recursive: true });
      }

      const recordingStartTime = Date.now();
      try {
        console.log(`[QueueEngine] Starting voicemail recording: ${recordingName} (max ${box.maxDurationSeconds}s)`);
        await this.ariClient.startRecording(channelId, recordingName, "wav");

        await new Promise<void>((resolve) => {
          const maxTimer = setTimeout(() => {
            this.ariClient.removeListener("channel-hangup-request", hangupHandler);
            this.ariClient.removeListener("channel-destroyed", destroyHandler);
            this.ariClient.removeListener("stasis-end", stasisResolveHandler);
            resolve();
          }, (box.maxDurationSeconds || 120) * 1000);
          const hangupHandler = (event: AriEvent) => {
            if (event.channel?.id === channelId) {
              clearTimeout(maxTimer);
              this.ariClient.removeListener("channel-destroyed", destroyHandler);
              this.ariClient.removeListener("stasis-end", stasisResolveHandler);
              resolve();
            }
          };
          const destroyHandler = (event: AriEvent) => {
            if (event.channel?.id === channelId) {
              clearTimeout(maxTimer);
              this.ariClient.removeListener("channel-hangup-request", hangupHandler);
              this.ariClient.removeListener("stasis-end", stasisResolveHandler);
              resolve();
            }
          };
          const stasisResolveHandler = (event: AriEvent) => {
            if (event.channel?.id === channelId) {
              clearTimeout(maxTimer);
              this.ariClient.removeListener("channel-hangup-request", hangupHandler);
              this.ariClient.removeListener("channel-destroyed", destroyHandler);
              resolve();
            }
          };
          this.ariClient.on("channel-hangup-request", hangupHandler);
          this.ariClient.on("channel-destroyed", destroyHandler);
          this.ariClient.on("stasis-end", stasisResolveHandler);
        });
      } catch (err) {
        console.warn(`[QueueEngine] Recording may have ended early:`, err instanceof Error ? err.message : err);
      }

      const durationSeconds = Math.round((Date.now() - recordingStartTime) / 1000);

      try {
        await this.ariClient.stopRecording(recordingName);
      } catch {}

      try {
        await this.ariClient.hangupChannel(channelId, "normal");
      } catch {}

      const { DATA_ROOT } = await import("../config/storage-paths");
      const voicemailDir = path.join(DATA_ROOT, "voicemails");
      if (!fs.existsSync(voicemailDir)) {
        fs.mkdirSync(voicemailDir, { recursive: true });
      }
      const localFileName = `${recordingName}.wav`;
      const localFilePath = path.join(voicemailDir, localFileName);
      const recordingPath = path.join("voicemails", localFileName);

      let downloadSuccess = false;
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const { downloadVoicemailRecordingFromAsterisk } = await import("./asterisk-audio-sync");
        console.log(`[QueueEngine] Downloading voicemail via SFTP: ${recordingName}`);
        const sftpResult = await downloadVoicemailRecordingFromAsterisk(recordingName, voicemailDir);
        if (sftpResult.success && sftpResult.localPath) {
          downloadSuccess = true;
          console.log(`[QueueEngine] Voicemail downloaded via SFTP: ${sftpResult.localPath}`);
        } else {
          console.warn(`[QueueEngine] SFTP download failed: ${sftpResult.error}`);
        }
      } catch (sftpErr) {
        console.warn(`[QueueEngine] SFTP download error:`, sftpErr instanceof Error ? sftpErr.message : sftpErr);
      }

      if (!downloadSuccess) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await new Promise(resolve => setTimeout(resolve, 1000 + attempt * 1000));
            console.log(`[QueueEngine] Fallback: ARI download attempt ${attempt + 1}: ${recordingName}`);
            const recordingBuffer = await this.ariClient.downloadStoredRecording(recordingName);
            fs.writeFileSync(localFilePath, recordingBuffer);
            console.log(`[QueueEngine] Voicemail downloaded via ARI: ${localFilePath} (${recordingBuffer.length} bytes)`);
            downloadSuccess = true;
            try { await this.ariClient.deleteStoredRecording(recordingName); } catch {}
            break;
          } catch (dlErr) {
            console.warn(`[QueueEngine] ARI download attempt ${attempt + 1} failed:`, dlErr instanceof Error ? dlErr.message : dlErr);
          }
        }
      }

      if (durationSeconds < 2) {
        console.log(`[QueueEngine] Voicemail too short (${durationSeconds}s), discarding - caller likely hung up immediately`);
        if (downloadSuccess) {
          try { fs.unlinkSync(localFilePath); } catch {}
        }
        return;
      }

      const [vmMessage] = await db.insert(voicemailMessages).values({
        boxId: box.id,
        queueId: queueId || null,
        callerNumber,
        callerName: callerName || null,
        customerId,
        didNumber: didNumber || null,
        recordingPath: downloadSuccess ? recordingPath : null,
        durationSeconds,
        status: "unread",
        transcriptStatus: downloadSuccess ? "pending" : "failed",
      }).returning();

      console.log(`[QueueEngine] Voicemail message saved: ${vmMessage.id} (${durationSeconds}s, download: ${downloadSuccess ? "OK" : "FAILED"})`);

      this.emit("voicemail-received", {
        messageId: vmMessage.id,
        boxId: box.id,
        boxName: box.name,
        callerNumber,
        callerName,
        customerId,
      });

      if (downloadSuccess) {
        this.processVoicemailAsync(vmMessage.id, localFilePath, box, customerId, callerNumber, callerName).catch(err => {
          console.error(`[QueueEngine] Async voicemail processing failed:`, err);
        });
      }

    } catch (err) {
      console.error(`[QueueEngine] Voicemail handling failed:`, err);
      try { await this.ariClient.hangupChannel(channelId, "normal"); } catch {}
    } finally {
      this.ariClient.removeListener("stasis-end", stasisEndHandler);
      this.ariClient.removeListener("channel-destroyed", channelDestroyedHandler);
    }
  }

  private async processVoicemailAsync(
    messageId: string,
    filePath: string,
    box: typeof voicemailBoxes.$inferSelect,
    customerId: string | null,
    callerNumber: string,
    callerName: string,
  ): Promise<void> {
    if (!fs.existsSync(filePath)) {
      console.warn(`[QueueEngine] Voicemail file not found for transcription: ${filePath}`);
      await db.update(voicemailMessages).set({ transcriptStatus: "failed" }).where(eq(voicemailMessages.id, messageId));
      return;
    }

    let callLogId: string | null = null;
    if (customerId) {
      try {
        const [logEntry] = await db.insert(callLogs).values({
          userId: "system",
          customerId,
          phoneNumber: callerNumber,
          direction: "inbound",
          status: "completed",
          startedAt: new Date(),
          endedAt: new Date(),
          durationSeconds: 0,
          notes: `Voicemail zanechaný v schránke "${box.name}"`,
          metadata: JSON.stringify({
            type: "voicemail",
            voicemailMessageId: messageId,
            voicemailBoxId: box.id,
            voicemailBoxName: box.name,
            callerNumber,
            callerName: callerName || null,
          }),
        }).returning();
        callLogId = logEntry.id;
        console.log(`[QueueEngine] Voicemail logged to customer history: ${customerId} (callLog: ${callLogId})`);
      } catch (err) {
        console.error(`[QueueEngine] Failed to log voicemail to customer history:`, err);
      }
    }

    if (!box.transcriptionEnabled || !process.env.OPENAI_API_KEY) {
      await db.update(voicemailMessages).set({ transcriptStatus: "completed" }).where(eq(voicemailMessages.id, messageId));
      return;
    }

    try {
      await db.update(voicemailMessages).set({ transcriptStatus: "processing" }).where(eq(voicemailMessages.id, messageId));
      console.log(`[QueueEngine] Starting voicemail transcription for ${messageId}`);

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI();
      const transcriptionResult = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-1",
        response_format: "text",
      });
      const transcriptText = transcriptionResult as unknown as string;
      console.log(`[QueueEngine] Voicemail transcription complete: ${transcriptText.length} chars`);

      await db.update(voicemailMessages).set({
        transcriptText,
        transcriptStatus: "completed",
      }).where(eq(voicemailMessages.id, messageId));

      if (customerId && transcriptText && transcriptText.trim().length > 10) {
        try {
          const analysisResult = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{
              role: "system",
              content: "You are analyzing a voicemail left by a customer for a cord blood banking company. Provide a brief JSON analysis with: sentiment (positive/negative/neutral), summary (1-2 sentences in the same language as the transcript), urgency (low/medium/high), keyTopics (array of strings)."
            }, {
              role: "user",
              content: `Voicemail transcript:\n${transcriptText}`
            }],
            response_format: { type: "json_object" },
            max_tokens: 500,
          });

          const analysisText = analysisResult.choices[0]?.message?.content;
          if (analysisText && callLogId) {
            const analysis = JSON.parse(analysisText);
            const [existingLog] = await db.select().from(callLogs).where(eq(callLogs.id, callLogId));
            if (existingLog) {
              const meta = JSON.parse(existingLog.metadata || "{}");
              meta.voicemailAnalysis = analysis;
              meta.transcriptText = transcriptText;
              await db.update(callLogs).set({
                metadata: JSON.stringify(meta),
                notes: `Voicemail: ${analysis.summary || transcriptText.substring(0, 100)}`,
              }).where(eq(callLogs.id, callLogId));
            }
            console.log(`[QueueEngine] Voicemail analysis saved for ${messageId}: ${analysis.sentiment}, urgency: ${analysis.urgency}`);
          }
        } catch (analysisErr) {
          console.warn(`[QueueEngine] Voicemail analysis failed:`, analysisErr instanceof Error ? analysisErr.message : analysisErr);
        }
      }
    } catch (err) {
      console.error(`[QueueEngine] Voicemail transcription failed:`, err);
      await db.update(voicemailMessages).set({ transcriptStatus: "failed" }).where(eq(voicemailMessages.id, messageId));
    }
  }

  private hasAvailableAgents(queueId: string): boolean {
    for (const agent of this.agentStates.values()) {
      if (agent.queueIds.includes(queueId) && agent.status === "available") {
        return true;
      }
    }
    return false;
  }

  private hasLoggedInAgents(queueId: string): boolean {
    for (const agent of this.agentStates.values()) {
      if (agent.queueIds.includes(queueId) && agent.status !== "offline") {
        return true;
      }
    }
    return false;
  }

  private async hasLoggedInAgentsDb(queueId: string): Promise<boolean> {
    try {
      const activeSessions = await db.select().from(agentSessions)
        .where(inArray(agentSessions.status, ["available", "break", "busy"]));
      const members = await db.select().from(queueMembers)
        .where(and(eq(queueMembers.queueId, queueId), eq(queueMembers.isActive, true)));
      const memberUserIds = new Set(members.map(m => m.userId));
      const activeSessionUserIds = new Set(activeSessions.map(s => s.userId));
      const sessionAgentIdsForQueue = new Set<string>();
      for (const session of activeSessions) {
        const sessionQueueIds: string[] = (session as any).inboundQueueIds || [];
        if (sessionQueueIds.includes(queueId)) {
          sessionAgentIdsForQueue.add(session.userId);
        }
      }
      const allCandidateIds = [...new Set([...memberUserIds, ...sessionAgentIdsForQueue])];
      for (const userId of allCandidateIds) {
        if (activeSessionUserIds.has(userId) && sessionAgentIdsForQueue.has(userId)) {
          return true;
        }
      }
      return false;
    } catch (err) {
      console.warn(`[QueueEngine] hasLoggedInAgentsDb error:`, err instanceof Error ? err.message : err);
      return this.hasLoggedInAgents(queueId);
    }
  }

  private async handleNoAgents(channelId: string, queue: InboundQueue, callerNumber: string, callerName: string): Promise<void> {
    const action = queue.noAgentsAction || "wait";
    if (action === "wait") return;

    try {
      await this.ariClient.answerChannel(channelId);
    } catch {}

    const customerId = await this.lookupCustomer(callerNumber);

    const messageId = queue.noAgentsMessageId;
    if (messageId) {
      try {
        const [msg] = await db.select().from(ivrMessages).where(eq(ivrMessages.id, messageId)).limit(1);
        if (msg) {
          const soundName = msg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const pbId = `noagents-${channelId}-${Date.now()}`;
          await this.ariClient.playMedia(channelId, `sound:custom/${soundName}`, pbId);
          await this.waitForPlaybackFinished(pbId, 60000);
        }
      } catch (err) {
        console.warn(`[QueueEngine] No-agents message playback failed:`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`[QueueEngine] No agents logged in for queue "${queue.name}", action: ${action}`);

    switch (action) {
      case "voicemail": {
        const vmBoxId = queue.noAgentsVoicemailBoxId;
        if (vmBoxId) {
          const [vmBox] = await db.select().from(voicemailBoxes).where(eq(voicemailBoxes.id, vmBoxId)).limit(1);
          if (vmBox) {
            await this.sendToVoicemail(channelId, vmBox, callerNumber, callerName, customerId, queue.didNumber || undefined, queue.id);
            return;
          }
        }
        await this.ariClient.hangupChannel(channelId, "normal");
        break;
      }
      case "hangup":
        await this.ariClient.hangupChannel(channelId, "normal");
        break;
      case "transfer":
        if (queue.noAgentsTarget) {
          const target = queue.noAgentsTarget;
          const dialEndpoint = target.includes("/") ? target : `PJSIP/${target}`;
          const ok = await this.transferCallToEndpoint(channelId, dialEndpoint, queue);
          if (!ok) await this.ariClient.hangupChannel(channelId, "normal");
        } else {
          await this.ariClient.hangupChannel(channelId, "normal");
        }
        break;
      case "queue": {
        const targetQueueId = queue.noAgentsTarget;
        if (targetQueueId) {
          const [targetQueue] = await db.select().from(inboundQueues).where(eq(inboundQueues.id, targetQueueId)).limit(1);
          const targetName = targetQueue?.name || queue.name;
          await this.addCallToQueue(channelId, targetQueueId, targetName, callerNumber, callerName, customerId);
          await this.startMohForChannel(channelId, targetQueueId);
        } else {
          await this.ariClient.hangupChannel(channelId, "normal");
        }
        break;
      }
      case "user_pjsip":
        if (queue.noAgentsUserId) {
          const [targetUser] = await db.select({ sipExtension: users.sipExtension, sipEnabled: users.sipEnabled })
            .from(users).where(eq(users.id, queue.noAgentsUserId)).limit(1);
          if (targetUser?.sipEnabled && targetUser.sipExtension) {
            const ok = await this.transferCallToEndpoint(channelId, `PJSIP/${targetUser.sipExtension}`, queue);
            if (!ok) await this.ariClient.hangupChannel(channelId, "normal");
          } else {
            await this.ariClient.hangupChannel(channelId, "normal");
          }
        } else {
          await this.ariClient.hangupChannel(channelId, "normal");
        }
        break;
      case "announcement": {
        const annMsgId = queue.noAgentsMessageId;
        if (annMsgId) {
          try {
            const [msg] = await db.select().from(ivrMessages).where(eq(ivrMessages.id, annMsgId)).limit(1);
            if (msg) {
              const soundName = msg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
              const pbId = `noagents-ann-${channelId}-${Date.now()}`;
              await this.ariClient.playMedia(channelId, `sound:custom/${soundName}`, pbId);
              await this.waitForPlaybackFinished(pbId, 60000);
            }
          } catch (err) {
            console.warn(`[QueueEngine] No-agents announcement playback failed:`, err instanceof Error ? err.message : err);
          }
        }
        await this.ariClient.hangupChannel(channelId, "normal");
        break;
      }
      case "ivr": {
        const ivrMenuId = (queue as any).noAgentsIvrMenuId;
        if (ivrMenuId) {
          console.log(`[QueueEngine] No-agents: routing to IVR menu ${ivrMenuId}`);
          await this.routeToIvrMenu(channelId, ivrMenuId, callerNumber, callerName, queue);
        } else {
          console.warn(`[QueueEngine] No-agents IVR action but no menu configured, hanging up`);
          await this.ariClient.hangupChannel(channelId, "normal");
        }
        break;
      }
      case "virtual_agent": {
        const vaConfigId = (queue as any).noAgentsVirtualAgentId;
        if (vaConfigId) {
          console.log(`[QueueEngine] No-agents: routing to virtual agent ${vaConfigId}`);
          try {
            const { VirtualAgentEngine } = await import("./virtual-agent");
            const vaEngine = new VirtualAgentEngine(this.ariClient);
            await vaEngine.startConversation(channelId, vaConfigId, callerNumber, callerName, customerId, queue.id);
          } catch (err) {
            console.error(`[QueueEngine] Virtual agent failed:`, err);
            await this.ariClient.hangupChannel(channelId, "normal");
          }
        } else {
          console.warn(`[QueueEngine] No-agents virtual_agent action but no config ID, hanging up`);
          await this.ariClient.hangupChannel(channelId, "normal");
        }
        break;
      }
      default:
        await this.ariClient.hangupChannel(channelId, "normal");
    }
  }

  private async routeCallToQueue(channel: AriChannel, queue: InboundQueue, callerNumber: string, callerName: string): Promise<void> {
    if (!this.isWithinBusinessHours(queue)) {
      console.log(`[QueueEngine] Queue "${queue.name}" is outside business hours`);
      await this.handleAfterHours(channel.id, queue, callerNumber, callerName);
      return;
    }

    const noAgentsAction = queue.noAgentsAction || "wait";
    if (noAgentsAction !== "wait") {
      const hasAgents = await this.hasLoggedInAgentsDb(queue.id);
      if (!hasAgents) {
        console.log(`[QueueEngine] No agents logged in (DB check) for queue "${queue.name}", action: ${noAgentsAction}`);
        await this.handleNoAgents(channel.id, queue, callerNumber, callerName);
        return;
      }
    }

    if (this.getQueueSize(queue.id) >= queue.maxQueueSize) {
      console.log(`[QueueEngine] Queue "${queue.name}" is full, handling overflow`);
      await this.handleOverflow(channel.id, queue, callerNumber, callerName);
      return;
    }
    try {
      await this.ariClient.answerChannel(channel.id);
    } catch (err) {
      console.error(`[QueueEngine] Failed to answer channel ${channel.id}:`, err);
      return;
    }
    const customerId = await this.lookupCustomer(callerNumber);
    let welcomePlayed = false;
    if (queue.welcomeMessageId) {
      try {
        const [msg] = await db.select().from(ivrMessages).where(eq(ivrMessages.id, queue.welcomeMessageId)).limit(1);
        if (msg) {
          const soundName = msg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const welcomePbId = `welcome-${channel.id}-${Date.now()}`;
          this.pendingWelcome.set(welcomePbId, { channelId: channel.id, queueId: queue.id });
          this.pendingWelcomeCallData.set(channel.id, {
            channelId: channel.id,
            queueId: queue.id,
            callerNumber,
            callerName,
            customerId,
            queueName: queue.name,
          });
          await this.ariClient.playMedia(channel.id, `sound:custom/${soundName}`, welcomePbId);
          welcomePlayed = true;
        }
      } catch (err) {
        console.warn(`[QueueEngine] Welcome message playback failed:`, err instanceof Error ? err.message : err);
      }
    }
    if (!welcomePlayed) {
      await this.startMohForChannel(channel.id, queue.id);
      await this.addCallToQueue(channel.id, queue.id, queue.name, callerNumber, callerName, customerId);
    }
  }

  private getCallerFromChannel(channelId: string): string | null {
    const waitingCall = this.waitingCalls.get(channelId);
    if (waitingCall) return waitingCall.callerNumber;
    const pendingData = this.pendingWelcomeCallData.get(channelId);
    if (pendingData) return pendingData.callerNumber;
    return null;
  }

  private resolveGreetingSoundName(box: typeof voicemailBoxes.$inferSelect): { soundName: string } | null {
    const period = this.getTimeBasedGreetingPeriod();

    if (period === "morning" && box.greetingMorningFilePath) {
      return { soundName: `vm-greeting-${box.id}-morning` };
    } else if (period === "afternoon" && box.greetingAfternoonFilePath) {
      return { soundName: `vm-greeting-${box.id}-afternoon` };
    } else if (period === "evening" && box.greetingEveningFilePath) {
      return { soundName: `vm-greeting-${box.id}-evening` };
    }

    if (box.greetingMorningFilePath) return { soundName: `vm-greeting-${box.id}-morning` };
    if (box.greetingAfternoonFilePath) return { soundName: `vm-greeting-${box.id}-afternoon` };
    if (box.greetingEveningFilePath) return { soundName: `vm-greeting-${box.id}-evening` };

    return null;
  }

  private getTimeBasedGreetingPeriod(): "morning" | "afternoon" | "evening" {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "morning";
    if (hour >= 12 && hour < 18) return "afternoon";
    return "evening";
  }

  private getTimeBasedGreeting(box: typeof voicemailBoxes.$inferSelect): string | null {
    const period = this.getTimeBasedGreetingPeriod();

    let filePath: string | null = null;
    if (period === "morning") {
      filePath = box.greetingMorningFilePath;
    } else if (period === "afternoon") {
      filePath = box.greetingAfternoonFilePath;
    } else {
      filePath = box.greetingEveningFilePath;
    }

    if (!filePath) {
      filePath = box.greetingFilePath;
    }

    return filePath;
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

  private recalculatePositions(queueId: string): void {
    const calls = this.getWaitingCallsForQueue(queueId);
    for (let i = 0; i < calls.length; i++) {
      calls[i].position = i + 1;
    }
  }

  async processQueues(): Promise<void> {
    const queues = await db.select().from(inboundQueues)
      .where(eq(inboundQueues.isActive, true))
      .orderBy(desc(inboundQueues.priority));

    for (const queue of queues) {
      const waitingCalls = this.getWaitingCallsForQueue(queue.id);
      if (waitingCalls.length === 0) continue;

      const noAgentsAction = queue.noAgentsAction || "wait";
      const noAgentsCheck = noAgentsAction !== "wait" ? !(await this.hasLoggedInAgentsDb(queue.id)) : false;
      if (noAgentsCheck) {
        console.log(`[QueueEngine] All agents logged out (DB check) for queue "${queue.name}", applying noAgents action "${noAgentsAction}" to ${waitingCalls.length} waiting call(s)`);
        for (const call of waitingCalls) {
          this.waitingCalls.delete(call.channelId);
          this.lastAnnouncementTime.delete(call.channelId);
          this.announcementPlayingFor.delete(call.channelId);
          await this.stopMohForChannel(call.channelId);
          const waitTime = (Date.now() - call.enteredAt.getTime()) / 1000;
          await db.update(inboundCallLogs)
            .set({
              status: "no_agents",
              completedAt: new Date(),
              abandonReason: "no_agents",
              waitDurationSeconds: Math.floor(waitTime),
            })
            .where(eq(inboundCallLogs.id, call.id));
          await this.handleNoAgents(call.channelId, queue, call.callerNumber, call.callerName || "");
        }
        continue;
      }

      for (const call of waitingCalls) {
        if (this.overflowInProgress.has(call.channelId)) continue;

        if (queue.strategy === "ring-all") {
          if (this.ringAllPending.has(call.channelId)) continue;
          const allAvailable = await this.getAvailableAgents(queue);
          if (allAvailable.length === 0) break;
          await this.connectCallToAllAgents(call, allAvailable, queue);
        } else {
          const agent = await this.selectAgent(queue);
          if (!agent) break;
          await this.connectCallToAgent(call, agent, queue);
        }
        this.recalculatePositions(queue.id);
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
    const activeSessionUserIds = new Set(activeSessions.map(s => s.userId));
    const sessionAgentIdSet = new Set(sessionAgentIds);
    const allAgentIds = [...new Set([...memberUserIds, ...sessionAgentIds])].filter(id => {
      if (!activeSessionUserIds.has(id)) {
        console.log(`[QueueEngine]   Skipping agent ${id}: no active session`);
        return false;
      }
      if (!sessionAgentIdSet.has(id)) {
        console.log(`[QueueEngine]   Skipping agent ${id}: active session but queue "${queue.name}" not selected`);
        return false;
      }
      return true;
    });

    console.log(`[QueueEngine]   Total candidate agents (session-filtered): ${allAgentIds.length}`);

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
        const cooldownUntil = this.agentOriginateCooldown.get(agentId);
        if (cooldownUntil && Date.now() < cooldownUntil) {
          console.log(`[QueueEngine]   Agent ${agentId}: on originate cooldown for ${Math.ceil((cooldownUntil - Date.now()) / 1000)}s more, skipping`);
          continue;
        }
        if (cooldownUntil) this.agentOriginateCooldown.delete(agentId);
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

  private async getAvailableAgents(queue: InboundQueue): Promise<AgentState[]> {
    const members = await db.select().from(queueMembers)
      .where(and(eq(queueMembers.queueId, queue.id), eq(queueMembers.isActive, true)));

    const activeSessions = await db.select().from(agentSessions)
      .where(inArray(agentSessions.status, ["available", "break", "busy"]));

    const sessionAgentIds: string[] = [];
    for (const session of activeSessions) {
      const sessionQueueIds: string[] = (session as any).inboundQueueIds || [];
      if (sessionQueueIds.includes(queue.id)) {
        sessionAgentIds.push(session.userId);
      }
    }

    const memberUserIds = members.map(m => m.userId);
    const activeSessionUserIds = new Set(activeSessions.map(s => s.userId));
    const sessionAgentIdSet = new Set(sessionAgentIds);
    const allAgentIds = [...new Set([...memberUserIds, ...sessionAgentIds])].filter(id =>
      activeSessionUserIds.has(id) && sessionAgentIdSet.has(id)
    );

    if (allAgentIds.length === 0) return [];

    const dbStates = await db.select().from(agentQueueStatus)
      .where(inArray(agentQueueStatus.userId, allAgentIds));

    for (const dbState of dbStates) {
      const existing = this.agentStates.get(dbState.userId);
      const memberInfo = members.find(m => m.userId === dbState.userId);
      const memberQueueIds = members.filter(m => m.userId === dbState.userId).map(m => m.queueId);
      const sessionQIds = activeSessions
        .filter(s => s.userId === dbState.userId)
        .flatMap(s => (s as any).inboundQueueIds || []);
      const allQueueIds = [...new Set([...memberQueueIds, ...sessionQIds])];

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
    }

    for (const agentId of allAgentIds) {
      if (!this.agentStates.has(agentId)) {
        const session = activeSessions.find(s => s.userId === agentId);
        if (session) {
          const sessionStatus = session.status === "available" ? "available" : session.status === "busy" ? "busy" : "break";
          const sessionQIds: string[] = (session as any).inboundQueueIds || [];
          const mQIds = members.filter(m => m.userId === agentId).map(m => m.queueId);
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
      if (state && state.status === "available") {
        const cooldownUntil = this.agentOriginateCooldown.get(agentId);
        if (cooldownUntil && Date.now() < cooldownUntil) continue;
        if (cooldownUntil) this.agentOriginateCooldown.delete(agentId);
        const memberInfo = members.find(m => m.userId === agentId);
        availableAgents.push({ ...state, penalty: memberInfo?.penalty ?? state.penalty ?? 0 });
      }
    }

    return availableAgents;
  }

  private async connectCallToAllAgents(call: QueuedCall, agents: AgentState[], queue: InboundQueue): Promise<void> {
    console.log(`[QueueEngine] RING-ALL: Notifying ${agents.length} agents for call ${call.id}`);

    this.waitingCalls.delete(call.channelId);
    const waitDuration = Math.floor((Date.now() - call.enteredAt.getTime()) / 1000);

    await db.update(inboundCallLogs)
      .set({
        status: "ringing",
        waitDurationSeconds: waitDuration,
      })
      .where(eq(inboundCallLogs.id, call.id));

    const ringAllState = {
      callId: call.id,
      agentChannelIds: new Map<string, string>(),
      agentIds: new Set<string>(),
    };
    this.ringAllPending.set(call.channelId, ringAllState);

    for (const agent of agents) {
      ringAllState.agentIds.add(agent.userId);

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
        recordCalls: queue.recordCalls ?? false,
        ringAll: true,
      });
    }

    this.assignedCalls.set(call.channelId, {
      call,
      agentId: agents[0].userId,
      queueId: queue.id,
      queue,
      assignedAt: new Date(),
    });

    const agentUsers = await db.select({
      id: users.id,
      sipExtension: users.sipExtension,
      sipEnabled: users.sipEnabled,
      fullName: users.fullName,
    }).from(users).where(inArray(users.id, agents.map(a => a.userId)));

    const elapsedSoFar = (Date.now() - call.enteredAt.getTime()) / 1000;
    const maxRing = 30;
    let ringTimeout = maxRing;
    if (queue.maxWaitTime && queue.maxWaitTime > 0) {
      const remaining = queue.maxWaitTime - elapsedSoFar;
      if (remaining <= 3) {
        console.log(`[QueueEngine] RING-ALL: Only ${Math.floor(remaining)}s remaining, firing overflow`);
        this.ringAllPending.delete(call.channelId);
        await this.fireOverflowForCall(call.channelId, call.id, queue, call.callerNumber, call.callerName || "", elapsedSoFar, agents[0].userId);
        return;
      }
      ringTimeout = Math.min(maxRing, Math.floor(remaining));
    }

    for (const agentUser of agentUsers) {
      if (!agentUser.sipEnabled || !agentUser.sipExtension) continue;
      try {
        const sipEndpoint = `PJSIP/${agentUser.sipExtension}`;
        console.log(`[QueueEngine] RING-ALL: Originating to ${agentUser.fullName} (${sipEndpoint})`);
        const agentChannel = await this.ariClient.originateChannel(
          sipEndpoint,
          agentUser.sipExtension,
          "default",
          call.callerNumber,
          `ring-all,${agentUser.id},${call.channelId}`
        );
        ringAllState.agentChannelIds.set(agentUser.id, agentChannel.id);

        this.pendingAgentCalls.set(agentChannel.id, {
          callerChannelId: call.channelId,
          callId: call.id,
          agentId: agentUser.id,
          queueId: queue.id,
          callerNumber: call.callerNumber,
          callerName: call.callerName,
          customerId: call.customerId,
          waitDuration,
          queueName: queue.name,
          enteredAt: call.enteredAt,
        });
      } catch (err: any) {
        console.error(`[QueueEngine] RING-ALL: Failed to originate to ${agentUser.fullName}:`, err.message);
      }
    }

    setTimeout(async () => {
      try {
        const pending = this.ringAllPending.get(call.channelId);
        if (!pending) return;

        console.log(`[QueueEngine] RING-ALL: Ring timeout (${ringTimeout}s) for call ${call.id}, cancelling`);
        await this.cancelRingAll(call.channelId, null);

        const totalWait = (Date.now() - call.enteredAt.getTime()) / 1000;
        if (queue.maxWaitTime && queue.maxWaitTime > 0 && totalWait >= queue.maxWaitTime - 2) {
          await this.fireOverflowForCall(call.channelId, call.id, queue, call.callerNumber, call.callerName || "", totalWait, agents[0].userId);
        } else {
          call.position = this.getQueueSize(queue.id) + 1;
          this.waitingCalls.set(call.channelId, call);
          this.recalculatePositions(queue.id);
          await db.update(inboundCallLogs)
            .set({ status: "queued", assignedAgentId: null })
            .where(eq(inboundCallLogs.id, call.id));
          await this.startMohForChannel(call.channelId, queue.id);
        }
      } catch (err) {
        console.error(`[QueueEngine] RING-ALL: Error in ring timeout handler:`, err instanceof Error ? err.message : err);
      }
    }, ringTimeout * 1000);
  }

  async cancelRingAll(callerChannelId: string, winnerAgentId: string | null): Promise<void> {
    const pending = this.ringAllPending.get(callerChannelId);
    if (!pending) return;

    console.log(`[QueueEngine] RING-ALL: Cancelling ring-all for call ${pending.callId}, winner: ${winnerAgentId || 'none'}`);

    for (const [agentId, agentChannelId] of pending.agentChannelIds.entries()) {
      if (agentId === winnerAgentId) continue;
      try {
        this.pendingAgentCalls.delete(agentChannelId);
        await this.ariClient.hangupChannel(agentChannelId, "normal");
      } catch {}
    }

    for (const agentId of pending.agentIds) {
      if (agentId === winnerAgentId) continue;
      this.emit("call-cancelled-for-agent", {
        callId: pending.callId,
        agentId,
        callerChannelId,
      });
    }

    this.ringAllPending.delete(callerChannelId);
    this.assignedCalls.delete(callerChannelId);
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
      recordCalls: queue.recordCalls ?? false,
    });

    const [agentUser] = await db.select({
      sipExtension: users.sipExtension,
      sipEnabled: users.sipEnabled,
      fullName: users.fullName,
    }).from(users).where(eq(users.id, agent.userId)).limit(1);

    this.assignedCalls.set(call.channelId, {
      call,
      agentId: agent.userId,
      queueId: queue.id,
      queue,
      assignedAt: new Date(),
    });

    if (!agentUser || !agentUser.sipEnabled || !agentUser.sipExtension) {
      console.log(`[QueueEngine] Agent ${agent.userId} has no SIP extension configured (sipEnabled=${agentUser?.sipEnabled}, ext=${agentUser?.sipExtension})`);
      console.log(`[QueueEngine] Call ${call.id} waiting for agent to answer via WebRTC/workspace (maxWaitTime: ${queue.maxWaitTime}s)`);
      return;
    }

    const sipEndpoint = `PJSIP/${agentUser.sipExtension}`;
    const elapsedSoFar = (Date.now() - call.enteredAt.getTime()) / 1000;
    const maxRing = 30;
    let ringTimeout = maxRing;
    if (queue.maxWaitTime && queue.maxWaitTime > 0) {
      const remaining = queue.maxWaitTime - elapsedSoFar;
      if (remaining <= 3) {
        console.log(`[QueueEngine] Only ${Math.floor(remaining)}s remaining of maxWaitTime=${queue.maxWaitTime}s, firing overflow immediately`);
        await this.fireOverflowForCall(call.channelId, call.id, queue, call.callerNumber, call.callerName || "", elapsedSoFar, agent.userId);
        return;
      }
      ringTimeout = Math.min(maxRing, Math.floor(remaining));
    }
    console.log(`[QueueEngine] === ORIGINATING CALL TO AGENT ===`);
    console.log(`[QueueEngine]   Agent: ${agentUser.fullName} (ext: ${agentUser.sipExtension})`);
    console.log(`[QueueEngine]   Endpoint: ${sipEndpoint}`);
    console.log(`[QueueEngine]   Caller channel: ${call.channelId}`);
    console.log(`[QueueEngine]   Call ID: ${call.id}`);
    console.log(`[QueueEngine]   Ring timeout: ${ringTimeout}s (elapsed: ${Math.floor(elapsedSoFar)}s, maxWait: ${queue.maxWaitTime}s)`);

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
        enteredAt: call.enteredAt,
      });

      setTimeout(async () => {
        try {
          if (this.overflowInProgress.has(call.channelId)) {
            console.log(`[QueueEngine] Ring timeout for ${agentChannel.id}: overflow already in progress for caller ${call.channelId}, skipping`);
            return;
          }
          const pendingTimeout = this.pendingAgentCalls.get(agentChannel.id);
          if (pendingTimeout) {
            console.log(`[QueueEngine] Agent ${agent.userId} did not answer within ${ringTimeout}s, cancelling`);
            this.pendingAgentCalls.delete(agentChannel.id);
            this.assignedCalls.delete(call.channelId);
            try { await this.ariClient.hangupChannel(agentChannel.id, "normal"); } catch {}

            const totalWait = (Date.now() - call.enteredAt.getTime()) / 1000;
            console.log(`[QueueEngine] Ring timeout: call=${call.id}, totalWait=${Math.floor(totalWait)}s, maxWaitTime=${queue.maxWaitTime}s`);

            if (queue.maxWaitTime && queue.maxWaitTime > 0 && totalWait >= queue.maxWaitTime - 2) {
              console.log(`[QueueEngine] maxWaitTime reached or nearly reached (${Math.floor(totalWait)}s >= ${queue.maxWaitTime - 2}s), firing overflow`);
              await this.fireOverflowForCall(call.channelId, call.id, queue, call.callerNumber, call.callerName || "", totalWait, agent.userId);
              return;
            }

            console.log(`[QueueEngine] Requeuing call ${call.id} (still within maxWaitTime, ${Math.floor(queue.maxWaitTime - totalWait)}s remaining)`);
            await this.stopMohForChannel(call.channelId);
            call.position = this.getQueueSize(queue.id) + 1;
            this.waitingCalls.set(call.channelId, call);
            this.recalculatePositions(queue.id);
            await db.update(inboundCallLogs)
              .set({ status: "queued", assignedAgentId: null })
              .where(eq(inboundCallLogs.id, call.id));
            await this.startMohForChannel(call.channelId, queue.id);
            this.updateAgentStatus(agent.userId, "available", null);
          }
        } catch (err) {
          console.error(`[QueueEngine] Error in ring timeout handler:`, err instanceof Error ? err.message : err);
        }
      }, ringTimeout * 1000);
    } catch (err: any) {
      console.error(`[QueueEngine] Failed to originate call to agent ${agent.userId}:`, err.message);
      this.assignedCalls.delete(call.channelId);

      call.originateFailures = (call.originateFailures || 0) + 1;
      const totalWait = (Date.now() - call.enteredAt.getTime()) / 1000;
      console.log(`[QueueEngine] Originate failure: call=${call.id}, totalWait=${Math.floor(totalWait)}s, maxWaitTime=${queue.maxWaitTime}s, failures=${call.originateFailures}`);

      this.agentOriginateCooldown.set(agent.userId, Date.now() + 5000);

      if ((queue.maxWaitTime && queue.maxWaitTime > 0 && totalWait >= queue.maxWaitTime - 2) || call.originateFailures >= 3) {
        const reason = call.originateFailures >= 3 ? "max originate failures reached" : "maxWaitTime reached";
        console.log(`[QueueEngine] Firing overflow after originate failure: ${reason}`);
        await this.fireOverflowForCall(call.channelId, call.id, queue, call.callerNumber, call.callerName || "", totalWait, agent.userId);
      } else {
        call.position = this.getQueueSize(queue.id) + 1;
        this.waitingCalls.set(call.channelId, call);
        this.recalculatePositions(queue.id);
        await this.startMohForChannel(call.channelId, queue.id);
        await db.update(inboundCallLogs)
          .set({ status: "queued", assignedAgentId: null })
          .where(eq(inboundCallLogs.id, call.id));
        console.log(`[QueueEngine] Requeued call ${call.id} after originate failure, will retry after cooldown`);
      }

      this.updateAgentStatus(agent.userId, "available", null);
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

    if (callerChannelId && this.ringAllPending.has(callerChannelId)) {
      console.log(`[QueueEngine] RING-ALL: Agent ${agentId} answered first, cancelling other agents`);
      await this.cancelRingAll(callerChannelId, agentId);
    }

    if (callerChannelId) {
      this.assignedCalls.delete(callerChannelId);
      console.log(`[QueueEngine] Removed assigned call tracking for answered call ${callId}`);
    }

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

  private async handleChannelLeftStasis(channelId: string): Promise<void> {
    const waitingCall = this.waitingCalls.get(channelId);
    const assignedEntry = this.assignedCalls.get(channelId);
    const call = waitingCall || assignedEntry?.call;
    if (!call) return;

    const agentId = assignedEntry?.agentId;
    const queueId = call.queueId;

    this.waitingCalls.delete(channelId);
    this.assignedCalls.delete(channelId);
    this.mohPlaybacks.delete(channelId);
    this.lastAnnouncementTime.delete(channelId);
    this.announcementPlayingFor.delete(channelId);
    this.recalculatePositions(queueId);

    if (this.ringAllPending.has(channelId)) {
      console.log(`[QueueEngine] StasisEnd: cancelling ring-all for abandoned call`);
      await this.cancelRingAll(channelId, null);
    }

    if (agentId) {
      this.updateAgentStatus(agentId, "available", null);
    }

    for (const [agentChId, pending] of this.pendingAgentCalls.entries()) {
      if (pending.callerChannelId === channelId) {
        console.log(`[QueueEngine] StasisEnd cleanup: cancelling pending agent call ${agentChId}`);
        this.pendingAgentCalls.delete(agentChId);
        try { await this.ariClient.hangupChannel(agentChId, "normal"); } catch {}
        if (!agentId) this.updateAgentStatus(pending.agentId, "available", null);
        break;
      }
    }

    const waitDuration = Math.floor((Date.now() - call.enteredAt.getTime()) / 1000);
    await db.update(inboundCallLogs)
      .set({ status: "abandoned", completedAt: new Date(), abandonReason: "caller_left_stasis", waitDurationSeconds: waitDuration, assignedAgentId: null })
      .where(eq(inboundCallLogs.id, call.id));

    console.log(`[QueueEngine] StasisEnd: call ${call.id} marked as abandoned (waited ${waitDuration}s), caller=${call.callerNumber}`);

    this.emit("call-cancelled", {
      callId: call.id,
      callerNumber: call.callerNumber,
      callerName: call.callerName,
      queueId,
      queueName: assignedEntry?.queue?.name || "",
      reason: "caller_left_stasis",
      assignedAgentId: agentId,
    });
  }

  private async handleChannelDestroyed(channelId: string): Promise<void> {
    if (this.overflowInProgress.has(channelId)) {
      console.log(`[QueueEngine] Channel ${channelId} destroyed during overflow, skipping cleanup`);
      return;
    }
    this.mohPlaybacks.delete(channelId);
    this.pendingWelcomeCallData.delete(channelId);
    const assignedCallData = this.assignedCalls.get(channelId);
    this.assignedCalls.delete(channelId);
    this.lastAnnouncementTime.delete(channelId);
    this.announcementPlayingFor.delete(channelId);
    for (const [pbId, info] of this.pendingWelcome.entries()) {
      if (info.channelId === channelId) {
        this.pendingWelcome.delete(pbId);
      }
    }

    const pending = this.pendingAgentCalls.get(channelId);
    if (pending) {
      if (this.overflowInProgress.has(pending.callerChannelId)) {
        console.log(`[QueueEngine] Agent channel ${channelId} destroyed but overflow already in progress for caller ${pending.callerChannelId}, skipping`);
        this.pendingAgentCalls.delete(channelId);
        this.updateAgentStatus(pending.agentId, "available", null);
        return;
      }
      console.log(`[QueueEngine] Agent channel ${channelId} destroyed before answer (agent rejected/unavailable)`);
      this.pendingAgentCalls.delete(channelId);
      const assignedCall = this.assignedCalls.get(pending.callerChannelId);
      const originalEnteredAt = assignedCall?.call.enteredAt || pending.enteredAt;
      const prevFailures = assignedCall?.call.originateFailures || 0;
      this.assignedCalls.delete(pending.callerChannelId);

      this.agentOriginateCooldown.set(pending.agentId, Date.now() + 5000);

      const totalWait = (Date.now() - originalEnteredAt.getTime()) / 1000;
      const [queueData] = await db.select().from(inboundQueues).where(eq(inboundQueues.id, pending.queueId)).limit(1);
      const maxWait = queueData?.maxWaitTime || 0;
      console.log(`[QueueEngine] Agent channel destroyed: call=${pending.callId}, totalWait=${Math.floor(totalWait)}s, maxWaitTime=${maxWait}s`);

      if (maxWait > 0 && totalWait >= maxWait - 2) {
        if (queueData) {
          await this.fireOverflowForCall(pending.callerChannelId, pending.callId, queueData, pending.callerNumber, pending.callerName || "", totalWait, pending.agentId);
        } else {
          try { await this.ariClient.hangupChannel(pending.callerChannelId, "normal"); } catch {}
        }
        this.updateAgentStatus(pending.agentId, "available", null);
        return;
      }

      const call: QueuedCall = {
        id: pending.callId,
        channelId: pending.callerChannelId,
        callerNumber: pending.callerNumber,
        callerName: pending.callerName,
        queueId: pending.queueId,
        customerId: pending.customerId,
        enteredAt: originalEnteredAt,
        position: this.getQueueSize(pending.queueId) + 1,
        originateFailures: prevFailures,
      };
      this.waitingCalls.set(pending.callerChannelId, call);
      this.recalculatePositions(pending.queueId);
      await this.startMohForChannel(pending.callerChannelId, pending.queueId);
      this.updateAgentStatus(pending.agentId, "available", null);
      return;
    }

    const bridge = this.activeBridges.get(channelId);
    if (bridge) {
      console.log(`[QueueEngine] Channel ${channelId} in active bridge destroyed, completing call ${bridge.callId}`);
      this.activeBridges.delete(bridge.callerChannelId);
      this.activeBridges.delete(bridge.agentChannelId);

      const otherChannelId = channelId === bridge.callerChannelId ? bridge.agentChannelId : bridge.callerChannelId;
      try { await this.ariClient.hangupChannel(otherChannelId, "normal"); } catch {}
      try { await this.ariClient.destroyBridge(bridge.bridgeId); } catch {}

      this.agentCompletedCall(bridge.callId, bridge.agentId);
      return;
    }

    for (const [agentChId, pending] of this.pendingAgentCalls.entries()) {
      if (pending.callerChannelId === channelId) {
        console.log(`[QueueEngine] Caller channel ${channelId} destroyed while agent ${agentChId} is ringing`);
        this.pendingAgentCalls.delete(agentChId);
        try { await this.ariClient.hangupChannel(agentChId, "normal"); } catch {}
        this.updateAgentStatus(pending.agentId, "available", null);
        db.update(inboundCallLogs)
          .set({ status: "abandoned", completedAt: new Date(), abandonReason: "caller_hangup" })
          .where(eq(inboundCallLogs.id, pending.callId))
          .catch(() => {});
        this.emit("call-abandoned", {
          callId: pending.callId,
          queueId: pending.queueId,
          callerNumber: pending.callerNumber,
          callerName: pending.callerName,
          queueName: pending.queueName,
          reason: "caller_hangup",
          assignedAgentId: pending.agentId,
        });
        return;
      }
    }

    const call = this.waitingCalls.get(channelId);
    if (call) {
      this.handleCallerHangup(channelId);
      return;
    }

    if (assignedCallData) {
      console.log(`[QueueEngine] Caller channel ${channelId} destroyed while assigned to agent ${assignedCallData.agentId} (no pending SIP originate)`);
      this.updateAgentStatus(assignedCallData.agentId, "available", null);
      const waitDuration = Math.floor((Date.now() - assignedCallData.call.enteredAt.getTime()) / 1000);
      await db.update(inboundCallLogs)
        .set({
          status: "abandoned",
          completedAt: new Date(),
          abandonReason: "caller_hangup",
          waitDurationSeconds: waitDuration,
        })
        .where(eq(inboundCallLogs.id, assignedCallData.call.id));
      this.emit("call-abandoned", {
        callId: assignedCallData.call.id,
        queueId: assignedCallData.queueId,
        callerNumber: assignedCallData.call.callerNumber,
        callerName: assignedCallData.call.callerName,
        queueName: assignedCallData.queue?.name || "",
        reason: "caller_hangup",
        assignedAgentId: assignedCallData.agentId,
      });
    }
  }

  private async handleCallerHangup(channelId: string): Promise<void> {
    if (this.overflowInProgress.has(channelId)) return;
    const call = this.waitingCalls.get(channelId);
    if (!call) return;

    const queueIdForRecalc = call.queueId;
    this.mohPlaybacks.delete(channelId);
    this.waitingCalls.delete(channelId);
    this.lastAnnouncementTime.delete(channelId);
    this.announcementPlayingFor.delete(channelId);
    this.recalculatePositions(queueIdForRecalc);

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
      callerName: call.callerName,
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

  private async handleAfterHours(channelId: string, queue: InboundQueue, callerNumber: string = "unknown", callerName: string = ""): Promise<void> {
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
        case "announcement": {
          const annMsgId = queue.afterHoursMessageId;
          if (annMsgId) {
            try {
              const [msg] = await db.select().from(ivrMessages).where(eq(ivrMessages.id, annMsgId)).limit(1);
              if (msg) {
                const soundName = msg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                const pbId = `afterhours-ann-${channelId}-${Date.now()}`;
                await this.ariClient.playMedia(channelId, `sound:custom/${soundName}`, pbId);
                await this.waitForPlaybackFinished(pbId, 60000);
              }
            } catch (err) {
              console.warn(`[QueueEngine] After-hours announcement playback failed:`, err instanceof Error ? err.message : err);
            }
          }
          await this.ariClient.hangupChannel(channelId, "normal");
          break;
        }
        case "voicemail":
        default: {
          const vmBoxId = queue.afterHoursVoicemailBoxId;
          if (vmBoxId) {
            const [vmBox] = await db.select().from(voicemailBoxes).where(eq(voicemailBoxes.id, vmBoxId)).limit(1);
            if (vmBox) {
              const customerId = await this.lookupCustomer(callerNumber);
              await this.sendToVoicemail(channelId, vmBox, callerNumber, callerName, customerId, queue.didNumber || undefined, queue.id);
              break;
            }
          }
          await this.ariClient.hangupChannel(channelId, "normal");
          break;
        }
      }
    } catch (err) {
      console.error("[QueueEngine] After-hours handling failed:", err);
      try { await this.ariClient.hangupChannel(channelId, "normal"); } catch {}
    }
  }

  private async transferCallToEndpoint(callerChannelId: string, endpoint: string, queue: InboundQueue): Promise<boolean> {
    const waitingCall = this.waitingCalls.get(callerChannelId);
    const callerNumber = waitingCall?.callerNumber || "unknown";
    const extension = endpoint.replace(/^PJSIP\//, "").replace(/^SIP\//, "");

    console.log(`[QueueEngine] === TRANSFER TO ENDPOINT ===`);
    console.log(`[QueueEngine]   Caller channel: ${callerChannelId}`);
    console.log(`[QueueEngine]   Target endpoint: ${endpoint}`);
    console.log(`[QueueEngine]   Extension: ${extension}`);
    console.log(`[QueueEngine]   Caller: ${callerNumber}`);

    const endpointStatus = await this.ariClient.getEndpointStatus("PJSIP", extension);
    if (endpointStatus) {
      console.log(`[QueueEngine]   Endpoint PJSIP/${extension} state: ${endpointStatus.state}`);
      if (endpointStatus.state === "offline" || endpointStatus.state === "unknown") {
        console.warn(`[QueueEngine] WARNING: Endpoint PJSIP/${extension} is ${endpointStatus.state} - phone may not be registered!`);
      }
    }

    await this.stopMohForChannel(callerChannelId);
    this.waitingCalls.delete(callerChannelId);

    try {
      await this.ariClient.setChannelVar(callerChannelId, "TRANSFER_CONTEXT", "from-internal");
      await this.ariClient.setChannelVar(callerChannelId, "TRANSFER_EXTEN", extension);
    } catch (e: any) {
      console.log(`[QueueEngine] Could not set channel vars (non-critical): ${e.message}`);
    }

    const contexts = ["from-internal-indexus", "from-internal", "default"];
    for (const ctx of contexts) {
      try {
        console.log(`[QueueEngine] Attempting continueDialplan: context=${ctx}, extension=${extension}, priority=1`);
        await this.ariClient.continueDialplan(callerChannelId, ctx, extension, 1);
        console.log(`[QueueEngine] SUCCESS: Transfer via continueDialplan to ${ctx}/${extension}/1`);
        console.log(`[QueueEngine] Caller channel ${callerChannelId} has exited Stasis`);
        return true;
      } catch (err: any) {
        console.log(`[QueueEngine] continueDialplan with context=${ctx} failed: ${err.message}`);
      }
    }

    try {
      console.log(`[QueueEngine] Attempting redirect to endpoint ${endpoint}...`);
      await this.ariClient.redirectChannel(callerChannelId, endpoint);
      console.log(`[QueueEngine] SUCCESS: Redirect to ${endpoint}`);
      return true;
    } catch (err: any) {
      console.log(`[QueueEngine] Redirect failed: ${err.message}`);
    }

    try {
      console.log(`[QueueEngine] Attempting originate+bridge for ${endpoint}...`);
      const agentChannel = await this.ariClient.originateChannel(
        endpoint,
        extension,
        "default",
        callerNumber !== "unknown" ? callerNumber : undefined,
        `transfer,${callerChannelId}`
      );

      console.log(`[QueueEngine] Originate+bridge transfer channel created: ${agentChannel.id}`);

      this.pendingAgentCalls.set(agentChannel.id, {
        callerChannelId,
        agentId: "transfer-target",
        callId: waitingCall?.id || `transfer-${Date.now()}`,
        queueId: queue.id,
        callerNumber,
        callerName: waitingCall?.callerName || "",
        customerId: null,
        waitDuration: waitingCall ? (Date.now() - waitingCall.enteredAt.getTime()) / 1000 : 0,
        queueName: queue.name,
        enteredAt: waitingCall?.enteredAt || new Date(),
      });

      return true;
    } catch (fallbackErr: any) {
      console.error(`[QueueEngine] ALL transfer methods failed for ${endpoint}:`, fallbackErr.message);
      return false;
    }
  }

  private async handleOverflow(channelId: string, queue: InboundQueue, callerNumber: string = "unknown", callerName: string = ""): Promise<void> {
    try {
      console.log(`[QueueEngine] Handling overflow for channel ${channelId}: action=${queue.overflowAction}, caller=${callerNumber}`);
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
              const oldQueueId = call.queueId;
              this.waitingCalls.delete(channelId);
              this.lastAnnouncementTime.delete(channelId);
              this.recalculatePositions(oldQueueId);
              call.queueId = queue.overflowTarget;
              call.position = this.getQueueSize(queue.overflowTarget) + 1;
              call.enteredAt = new Date();
              this.waitingCalls.set(channelId, call);
              await this.startMohForChannel(channelId, queue.overflowTarget);
            } else {
              const customerId = await this.lookupCustomer(callerNumber);
              const [targetQueue] = await db.select().from(inboundQueues).where(eq(inboundQueues.id, queue.overflowTarget)).limit(1);
              const targetName = targetQueue?.name || queue.name;
              await this.addCallToQueue(channelId, queue.overflowTarget, targetName, callerNumber, callerName, customerId);
              await this.startMohForChannel(channelId, queue.overflowTarget);
            }
          } else {
            await this.ariClient.hangupChannel(channelId, "normal");
          }
          break;
        case "announcement": {
          const annMsgId = queue.overflowMessageId;
          if (annMsgId) {
            try {
              const [msg] = await db.select().from(ivrMessages).where(eq(ivrMessages.id, annMsgId)).limit(1);
              if (msg) {
                const soundName = msg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                const pbId = `overflow-ann-${channelId}-${Date.now()}`;
                await this.ariClient.playMedia(channelId, `sound:custom/${soundName}`, pbId);
                await this.waitForPlaybackFinished(pbId, 60000);
              }
            } catch (err) {
              console.warn(`[QueueEngine] Overflow announcement playback failed:`, err instanceof Error ? err.message : err);
            }
          }
          await this.ariClient.hangupChannel(channelId, "normal");
          break;
        }
        case "voicemail": {
          const vmBoxId = queue.overflowVoicemailBoxId;
          if (vmBoxId) {
            const [vmBox] = await db.select().from(voicemailBoxes).where(eq(voicemailBoxes.id, vmBoxId)).limit(1);
            if (vmBox) {
              const customerId = await this.lookupCustomer(callerNumber);
              await this.sendToVoicemail(channelId, vmBox, callerNumber, callerName, customerId, queue.didNumber || undefined, queue.id);
              break;
            }
          }
          await this.ariClient.hangupChannel(channelId, "normal");
          break;
        }
        case "ivr": {
          const ivrMenuId = (queue as any).overflowIvrMenuId;
          if (ivrMenuId) {
            console.log(`[QueueEngine] Overflow: routing to IVR menu ${ivrMenuId}`);
            await this.routeToIvrMenu(channelId, ivrMenuId, callerNumber, callerName, queue);
          } else {
            console.warn(`[QueueEngine] Overflow IVR action but no menu configured, hanging up`);
            await this.ariClient.hangupChannel(channelId, "normal");
          }
          break;
        }
        case "virtual_agent": {
          const vaConfigId = (queue as any).overflowVirtualAgentId;
          if (vaConfigId) {
            console.log(`[QueueEngine] Overflow: routing to virtual agent ${vaConfigId}`);
            try {
              const customerId = await this.lookupCustomer(callerNumber);
              const { VirtualAgentEngine } = await import("./virtual-agent");
              const vaEngine = new VirtualAgentEngine(this.ariClient);
              await vaEngine.startConversation(channelId, vaConfigId, callerNumber, callerName, customerId, queue.id);
            } catch (err) {
              console.error(`[QueueEngine] Virtual agent overflow failed:`, err);
              await this.ariClient.hangupChannel(channelId, "normal");
            }
          } else {
            console.warn(`[QueueEngine] Overflow virtual_agent action but no config, hanging up`);
            await this.ariClient.hangupChannel(channelId, "normal");
          }
          break;
        }
        default:
          await this.ariClient.hangupChannel(channelId, "normal");
      }
    } catch (err) {
      console.error("[QueueEngine] Overflow handling failed:", err);
      try { await this.ariClient.hangupChannel(channelId, "normal"); } catch {}
    }
  }

  private async routeToIvrMenu(channelId: string, menuId: string, callerNumber: string, callerName: string, queue: InboundQueue | null): Promise<void> {
    try {
      const [menu] = await db.select().from(ivrMenus).where(eq(ivrMenus.id, menuId)).limit(1);
      if (!menu) {
        console.warn(`[QueueEngine] IVR menu ${menuId} not found, hanging up`);
        await this.ariClient.hangupChannel(channelId, "normal");
        return;
      }

      const options = await db.select().from(ivrMenuOptions)
        .where(eq(ivrMenuOptions.menuId, menuId))
        .orderBy(asc(ivrMenuOptions.sortOrder));

      if (menu.promptMessageId) {
        try {
          const [greetMsg] = await db.select().from(ivrMessages).where(eq(ivrMessages.id, menu.promptMessageId)).limit(1);
          if (greetMsg) {
            const soundName = greetMsg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const pbId = `ivr-greet-${channelId}-${Date.now()}`;
            await this.ariClient.playMedia(channelId, `sound:custom/${soundName}`, pbId);
            await this.waitForPlaybackFinished(pbId, 60000);
          }
        } catch (err) {
          console.warn(`[QueueEngine] IVR greeting playback failed:`, err instanceof Error ? err.message : err);
        }
      }

      const maxAttempts = menu.maxRetries || 3;
      const timeout = (menu.timeout || 5) * 1000;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const dtmf = await this.waitForDtmf(channelId, timeout);
          if (dtmf) {
            const matchedOption = options.find(o => o.dtmfKey === dtmf);
            if (matchedOption) {
              console.log(`[QueueEngine] IVR: caller pressed ${dtmf}, routing to ${matchedOption.action}:${matchedOption.targetId}`);
              await this.executeIvrAction(channelId, matchedOption, callerNumber, callerName, queue);
              return;
            }
          }

          if (menu.invalidMessageId) {
            try {
              const [invMsg] = await db.select().from(ivrMessages).where(eq(ivrMessages.id, menu.invalidMessageId)).limit(1);
              if (invMsg) {
                const soundName = invMsg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                const pbId = `ivr-invalid-${channelId}-${Date.now()}`;
                await this.ariClient.playMedia(channelId, `sound:custom/${soundName}`, pbId);
                await this.waitForPlaybackFinished(pbId, 60000);
              }
            } catch {}
          }
        } catch (err) {
          console.warn(`[QueueEngine] IVR DTMF wait failed:`, err instanceof Error ? err.message : err);
        }
      }

      console.log(`[QueueEngine] IVR: max retries reached, hanging up`);
      await this.ariClient.hangupChannel(channelId, "normal");
    } catch (err) {
      console.error(`[QueueEngine] IVR menu routing failed:`, err);
      try { await this.ariClient.hangupChannel(channelId, "normal"); } catch {}
    }
  }

  private async waitForDtmf(channelId: string, timeoutMs: number): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => {
        this.removeAllListeners(`dtmf:${channelId}`);
        resolve(null);
      }, timeoutMs);

      this.once(`dtmf:${channelId}`, (digit: string) => {
        clearTimeout(timer);
        resolve(digit);
      });
    });
  }

  private async executeIvrAction(channelId: string, option: any, callerNumber: string, callerName: string, queue: InboundQueue | null): Promise<void> {
    const actionType = option.action || option.actionType;
    const actionTarget = option.targetId || option.actionTarget;
    switch (actionType) {
      case "queue": {
        if (actionTarget) {
          const [targetQueue] = await db.select().from(inboundQueues).where(eq(inboundQueues.id, actionTarget)).limit(1);
          if (targetQueue) {
            const customerId = await this.lookupCustomer(callerNumber);
            await this.addCallToQueue(channelId, targetQueue.id, targetQueue.name, callerNumber, callerName, customerId);
            await this.startMohForChannel(channelId, targetQueue.id);
            return;
          }
        }
        break;
      }
      case "extension":
      case "user_pjsip":
      case "transfer": {
        if (actionTarget) {
          const endpoint = actionTarget.includes("/") ? actionTarget : `PJSIP/${actionTarget}`;
          const ok = await this.transferCallToEndpoint(channelId, endpoint, queue as any);
          if (ok) return;
        }
        break;
      }
      case "ivr_menu":
      case "submenu": {
        if (actionTarget) {
          await this.routeToIvrMenu(channelId, actionTarget, callerNumber, callerName, queue);
          return;
        }
        break;
      }
      case "voicemail": {
        if (actionTarget) {
          const [vmBox] = await db.select().from(voicemailBoxes).where(eq(voicemailBoxes.id, actionTarget)).limit(1);
          if (vmBox) {
            const customerId = await this.lookupCustomer(callerNumber);
            await this.sendToVoicemail(channelId, vmBox, callerNumber, callerName, customerId, queue?.didNumber || undefined, queue?.id);
            return;
          }
        }
        break;
      }
      case "repeat": {
        return;
      }
      case "hangup":
        break;
    }
    await this.ariClient.hangupChannel(channelId, "normal");
  }

  private async fireOverflowForCall(channelId: string, callId: string, queue: InboundQueue, callerNumber: string, callerName: string, waitSeconds: number, agentId?: string): Promise<void> {
    if (this.overflowInProgress.has(channelId)) {
      console.log(`[QueueEngine] >>>>>>> OVERFLOW SKIPPED for call ${callId}, channel=${channelId} - already in progress <<<<<<<`);
      return;
    }
    this.overflowInProgress.add(channelId);

    try {
      console.log(`[QueueEngine] >>>>>>> OVERFLOW FIRING for call ${callId}, channel=${channelId}, waited=${Math.floor(waitSeconds)}s, maxWait=${queue.maxWaitTime}s, action=${queue.overflowAction} <<<<<<<`);

      this.waitingCalls.delete(channelId);
      this.assignedCalls.delete(channelId);
      this.lastAnnouncementTime.delete(channelId);
      this.announcementPlayingFor.delete(channelId);
      this.recalculatePositions(queue.id);

      if (agentId) {
        this.updateAgentStatus(agentId, "available", null);
        for (const [agentChId, pending] of this.pendingAgentCalls.entries()) {
          if (pending.callerChannelId === channelId) {
            this.pendingAgentCalls.delete(agentChId);
            try { await this.ariClient.hangupChannel(agentChId, "normal"); } catch {}
            break;
          }
        }
      }

      await db.update(inboundCallLogs)
        .set({
          status: "timeout",
          completedAt: new Date(),
          abandonReason: "timeout",
          waitDurationSeconds: Math.floor(waitSeconds),
          assignedAgentId: null,
        })
        .where(eq(inboundCallLogs.id, callId));

      let channelAlive = false;
      try {
        await this.ariClient.getChannel(channelId);
        channelAlive = true;
      } catch {
        channelAlive = false;
      }

      if (!channelAlive) {
        console.log(`[QueueEngine] >>>>>>> OVERFLOW: channel ${channelId} no longer exists (caller hung up), marking as abandoned <<<<<<<`);
        await db.update(inboundCallLogs)
          .set({
            status: "abandoned",
            abandonReason: "caller_hangup_before_overflow",
          })
          .where(eq(inboundCallLogs.id, callId));

        this.emit("call-timeout", { callId, queueId: queue.id, callerNumber, callerName, assignedAgentId: agentId, queueName: queue.name });
        this.emit("call-cancelled", { callId, callerNumber, callerName, queueId: queue.id, queueName: queue.name, reason: "caller_hangup" });
        return;
      }

      try { await this.stopMohForChannel(channelId); } catch {}

      await new Promise(resolve => setTimeout(resolve, 300));

      const needsSafetyHangup = queue.overflowAction === "voicemail" || queue.overflowAction === "hangup" || queue.overflowAction === "announcement" || !queue.overflowAction;

      try {
        await this.handleOverflow(channelId, queue, callerNumber, callerName);
        console.log(`[QueueEngine] >>>>>>> OVERFLOW COMPLETED for call ${callId}, action=${queue.overflowAction} <<<<<<<`);
      } catch (err) {
        console.error(`[QueueEngine] >>>>>>> OVERFLOW FAILED for call ${callId}:`, err instanceof Error ? err.message : err, "<<<<<<<");
        try { await this.ariClient.hangupChannel(channelId, "normal"); } catch {}
      }

      if (needsSafetyHangup) {
        try { await this.ariClient.hangupChannel(channelId, "normal"); } catch {}
      }

      this.emit("call-timeout", {
        callId,
        queueId: queue.id,
        callerNumber,
        callerName,
        assignedAgentId: agentId,
        queueName: queue.name,
      });
      this.emit("call-cancelled", {
        callId,
        callerNumber,
        callerName,
        queueId: queue.id,
        queueName: queue.name,
        reason: "timeout",
      });
    } finally {
      this.overflowInProgress.delete(channelId);
    }
  }

  private async checkTimeouts(): Promise<void> {
    const now = Date.now();
    const queuesCache = new Map<string, InboundQueue>();
    const waitingCount = this.waitingCalls.size;
    const assignedCount = this.assignedCalls.size;

    if (waitingCount > 0 || assignedCount > 0) {
      console.log(`[QueueEngine] checkTimeouts: waiting=${waitingCount}, assigned=${assignedCount}, pending=${this.pendingAgentCalls.size}`);
    }

    const deadChannels = new Set<string>();
    const hasTrackedCalls = waitingCount > 0 || assignedCount > 0;
    if (hasTrackedCalls && (now - this.lastChannelCheck) > 10000) {
      this.lastChannelCheck = now;
      try {
        const liveChannels = await this.ariClient.listChannels();
        this.cachedLiveChannels = new Set(liveChannels.map(ch => ch.id));
        for (const chId of this.waitingCalls.keys()) {
          if (!this.cachedLiveChannels.has(chId)) deadChannels.add(chId);
        }
        for (const chId of this.assignedCalls.keys()) {
          if (!this.cachedLiveChannels.has(chId)) deadChannels.add(chId);
        }
        if (deadChannels.size > 0) {
          console.log(`[QueueEngine] checkTimeouts: found ${deadChannels.size} dead channel(s): ${[...deadChannels].join(", ")}`);
        }
      } catch (err) {
        console.warn(`[QueueEngine] listChannels failed, skipping dead channel check:`, err instanceof Error ? err.message : err);
      }
    }

    for (const [channelId, call] of this.waitingCalls.entries()) {
      if (this.overflowInProgress.has(channelId)) continue;
      if (deadChannels.has(channelId)) {
        console.log(`[QueueEngine] checkTimeouts: WAITING call ${call.id} has dead channel ${channelId}, marking abandoned`);
        this.waitingCalls.delete(channelId);
        this.lastAnnouncementTime.delete(channelId);
        this.announcementPlayingFor.delete(channelId);
        this.recalculatePositions(call.queueId);
        const waitTime = (now - call.enteredAt.getTime()) / 1000;
        await db.update(inboundCallLogs)
          .set({ status: "abandoned", completedAt: new Date(), abandonReason: "channel_gone", waitDurationSeconds: Math.floor(waitTime), assignedAgentId: null })
          .where(eq(inboundCallLogs.id, call.id));
        this.emit("call-cancelled", { callId: call.id, callerNumber: call.callerNumber, callerName: call.callerName, queueId: call.queueId, queueName: "", reason: "channel_gone" });
        continue;
      }

      if (!queuesCache.has(call.queueId)) {
        const q = await db.select().from(inboundQueues).where(eq(inboundQueues.id, call.queueId)).limit(1);
        if (q[0]) queuesCache.set(call.queueId, q[0]);
      }

      const queue = queuesCache.get(call.queueId);
      if (!queue) continue;

      const noAgentsAct = queue.noAgentsAction || "wait";
      if (noAgentsAct !== "wait") {
        const hasAgents = await this.hasLoggedInAgentsDb(queue.id);
        if (!hasAgents) {
          const waitTime = (now - call.enteredAt.getTime()) / 1000;
          console.log(`[QueueEngine] checkTimeouts: no agents (DB check) for call ${call.id} in queue "${queue.name}", applying noAgents action "${noAgentsAct}" after ${Math.floor(waitTime)}s`);
          this.waitingCalls.delete(channelId);
          this.lastAnnouncementTime.delete(channelId);
          this.announcementPlayingFor.delete(channelId);
          this.recalculatePositions(call.queueId);
          await this.stopMohForChannel(channelId);
          await db.update(inboundCallLogs)
            .set({ status: "no_agents", completedAt: new Date(), abandonReason: "no_agents", waitDurationSeconds: Math.floor(waitTime) })
            .where(eq(inboundCallLogs.id, call.id));
          await this.handleNoAgents(channelId, queue, call.callerNumber, call.callerName || "");
          continue;
        }
      }

      if (!queue.maxWaitTime || queue.maxWaitTime <= 0) continue;

      const waitTime = (now - call.enteredAt.getTime()) / 1000;
      console.log(`[QueueEngine] checkTimeouts WAITING: call=${call.id}, waited=${Math.floor(waitTime)}s/${queue.maxWaitTime}s, caller=${call.callerNumber}`);

      if (waitTime >= queue.maxWaitTime) {
        console.log(`[QueueEngine] checkTimeouts: WAITING call ${call.id} exceeded maxWaitTime (${Math.floor(waitTime)}s >= ${queue.maxWaitTime}s), firing overflow`);
        await this.fireOverflowForCall(channelId, call.id, queue, call.callerNumber, call.callerName || "", waitTime);
      }
    }

    for (const [channelId, assigned] of this.assignedCalls.entries()) {
      if (this.overflowInProgress.has(channelId)) continue;
      const { call, queue, agentId } = assigned;

      if (deadChannels.has(channelId)) {
        console.log(`[QueueEngine] checkTimeouts: ASSIGNED call ${call.id} has dead channel ${channelId}, marking abandoned`);
        this.assignedCalls.delete(channelId);
        this.updateAgentStatus(agentId, "available", null);
        for (const [agentChId, pending] of this.pendingAgentCalls.entries()) {
          if (pending.callerChannelId === channelId) {
            this.pendingAgentCalls.delete(agentChId);
            try { await this.ariClient.hangupChannel(agentChId, "normal"); } catch {}
            break;
          }
        }
        const waitTime = (now - call.enteredAt.getTime()) / 1000;
        await db.update(inboundCallLogs)
          .set({ status: "abandoned", completedAt: new Date(), abandonReason: "channel_gone", waitDurationSeconds: Math.floor(waitTime), assignedAgentId: null })
          .where(eq(inboundCallLogs.id, call.id));
        this.emit("call-cancelled", { callId: call.id, callerNumber: call.callerNumber, callerName: call.callerName, queueId: queue.id, queueName: queue.name, reason: "channel_gone", assignedAgentId: agentId });
        continue;
      }

      const [freshQueue] = await db.select().from(inboundQueues).where(eq(inboundQueues.id, queue.id)).limit(1);
      const maxWait = freshQueue?.maxWaitTime || queue.maxWaitTime || 0;
      if (!maxWait || maxWait <= 0) continue;

      const totalWaitTime = (now - call.enteredAt.getTime()) / 1000;
      console.log(`[QueueEngine] checkTimeouts ASSIGNED: call=${call.id}, waited=${Math.floor(totalWaitTime)}s/${maxWait}s, agent=${agentId}, caller=${call.callerNumber}`);

      if (totalWaitTime >= maxWait) {
        const callLog = await db.select().from(inboundCallLogs).where(eq(inboundCallLogs.id, call.id)).limit(1);
        const dbStatus = callLog[0]?.status;
        console.log(`[QueueEngine] checkTimeouts: call ${call.id} EXCEEDED maxWaitTime! totalWait=${Math.floor(totalWaitTime)}s >= maxWait=${maxWait}s, dbStatus=${dbStatus}`);

        if (dbStatus === "answered" || dbStatus === "completed") {
          console.log(`[QueueEngine] checkTimeouts: call ${call.id} already ${dbStatus}, just cleaning up tracking`);
          this.assignedCalls.delete(channelId);
          continue;
        }

        const overflowQueue = freshQueue || queue;
        await this.fireOverflowForCall(channelId, call.id, overflowQueue, call.callerNumber, call.callerName || "", totalWaitTime, agentId);
      }
    }

    await this.checkDbSafetyNet(now, queuesCache);
  }

  private async checkDbSafetyNet(now: number, queuesCache: Map<string, InboundQueue>): Promise<void> {
    try {
      const stuckCalls = await db.select().from(inboundCallLogs)
        .where(and(
          inArray(inboundCallLogs.status, ["queued", "ringing"]),
          isNotNull(inboundCallLogs.createdAt),
        ));

      for (const callLog of stuckCalls) {
        if (this.waitingCalls.has(callLog.ariChannelId || "") || this.assignedCalls.has(callLog.ariChannelId || "")) {
          continue;
        }
        if (this.overflowInProgress.has(callLog.ariChannelId || "")) {
          continue;
        }

        if (!queuesCache.has(callLog.queueId || "")) {
          if (callLog.queueId) {
            const q = await db.select().from(inboundQueues).where(eq(inboundQueues.id, callLog.queueId)).limit(1);
            if (q[0]) queuesCache.set(callLog.queueId, q[0]);
          }
        }

        const queue = queuesCache.get(callLog.queueId || "");
        if (!queue || !queue.maxWaitTime || queue.maxWaitTime <= 0) continue;

        const createdAt = callLog.createdAt ? new Date(callLog.createdAt).getTime() : 0;
        if (createdAt === 0) continue;

        const waitTime = (now - createdAt) / 1000;
        if (waitTime > queue.maxWaitTime) {
          console.log(`[QueueEngine] >>>>>>> DB SAFETY NET: call ${callLog.id} stuck in DB as "${callLog.status}" for ${Math.floor(waitTime)}s (maxWait=${queue.maxWaitTime}s), channel=${callLog.ariChannelId} <<<<<<<`);

          if (callLog.ariChannelId) {
            await this.fireOverflowForCall(callLog.ariChannelId, callLog.id, queue, callLog.callerNumber || "", callLog.callerName || "", waitTime, callLog.assignedAgentId || undefined);
          } else {
            await db.update(inboundCallLogs)
              .set({ status: "timeout", completedAt: new Date(), abandonReason: "timeout_safety_net", waitDurationSeconds: Math.floor(waitTime) })
              .where(eq(inboundCallLogs.id, callLog.id));
            console.log(`[QueueEngine] DB SAFETY NET: marked call ${callLog.id} as timeout (no ARI channel)`);
          }
        }
      }
    } catch (err) {
      console.warn("[QueueEngine] DB safety net check error:", err instanceof Error ? err.message : err);
    }
  }

  private async processAnnouncements(): Promise<void> {
    const now = Date.now();
    const queuesCache = new Map<string, InboundQueue>();

    for (const [channelId, call] of this.waitingCalls.entries()) {
      if (this.announcementPlayingFor.has(channelId)) continue;

      if (!queuesCache.has(call.queueId)) {
        const q = await db.select().from(inboundQueues).where(eq(inboundQueues.id, call.queueId)).limit(1);
        if (q[0]) queuesCache.set(call.queueId, q[0]);
      }
      const queue = queuesCache.get(call.queueId);
      if (!queue) continue;

      const wantsPosition = queue.announcePosition === true;
      const wantsWaitTime = queue.announceWaitTime === true;
      if (!wantsPosition && !wantsWaitTime) continue;

      const frequency = (queue.announceFrequency || 30) * 1000;
      const lastAnn = this.lastAnnouncementTime.get(channelId) || 0;
      if (now - lastAnn < frequency) continue;

      const waitTimeSecs = Math.floor((now - call.enteredAt.getTime()) / 1000);
      if (waitTimeSecs < 5) continue;

      this.lastAnnouncementTime.set(channelId, now);
      this.announcementPlayingFor.add(channelId);

      this.playQueueAnnouncement(channelId, call, queue, wantsPosition, wantsWaitTime).catch(err => {
        console.warn(`[QueueEngine] Announcement failed for ${channelId}:`, err instanceof Error ? err.message : err);
      }).finally(() => {
        this.announcementPlayingFor.delete(channelId);
      });
    }
  }

  private isCallStillWaitingInQueue(channelId: string, expectedQueueId: string): boolean {
    const current = this.waitingCalls.get(channelId);
    return !!current && current.queueId === expectedQueueId;
  }

  private async safePlaySound(channelId: string, media: string, queueId: string, label: string): Promise<boolean> {
    if (!this.isCallStillWaitingInQueue(channelId, queueId)) return false;
    try {
      const pbId = `ann-${label}-${channelId}-${Date.now()}`;
      await this.ariClient.playMedia(channelId, media, pbId);
      await this.waitForPlaybackFinished(pbId, 10000);
      return this.isCallStillWaitingInQueue(channelId, queueId);
    } catch (err) {
      console.warn(`[QueueEngine] Sound ${label} failed for ${channelId}:`, err instanceof Error ? err.message : err);
      return this.isCallStillWaitingInQueue(channelId, queueId);
    }
  }

  private async playQueueAnnouncement(channelId: string, call: QueuedCall, queue: InboundQueue, announcePos: boolean, announceWait: boolean): Promise<void> {
    const queueId = queue.id;
    if (!this.isCallStillWaitingInQueue(channelId, queueId)) return;

    try {
      await this.stopMohForChannel(channelId);
    } catch {}

    try {
      if (announcePos && this.isCallStillWaitingInQueue(channelId, queueId)) {
        const currentCall = this.waitingCalls.get(channelId);
        const position = currentCall?.position || call.position;

        if (queue.announcePositionMessageId) {
          const [msg] = await db.select().from(ivrMessages).where(eq(ivrMessages.id, queue.announcePositionMessageId)).limit(1);
          if (msg) {
            const soundName = msg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            await this.safePlaySound(channelId, `sound:custom/${soundName}`, queueId, "pos-custom");
          }
        } else {
          const ok1 = await this.safePlaySound(channelId, "sound:queue-youare", queueId, "pos-youare");
          if (ok1) {
            const ok2 = await this.safePlaySound(channelId, `number:${position}`, queueId, "pos-num");
            if (ok2) {
              const ok3 = await this.safePlaySound(channelId, "sound:queue-callswaiting", queueId, "pos-calls");
              if (ok3) {
                await this.safePlaySound(channelId, "sound:queue-thankyou", queueId, "pos-thanks");
              }
            }
          }
        }
      }

      if (announceWait && this.isCallStillWaitingInQueue(channelId, queueId)) {
        const currentCall = this.waitingCalls.get(channelId);
        const enteredAt = currentCall?.enteredAt || call.enteredAt;
        const waitMins = Math.max(1, Math.ceil((Date.now() - enteredAt.getTime()) / 60000));

        if (queue.announceWaitTimeMessageId) {
          const [msg] = await db.select().from(ivrMessages).where(eq(ivrMessages.id, queue.announceWaitTimeMessageId)).limit(1);
          if (msg) {
            const soundName = msg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            await this.safePlaySound(channelId, `sound:custom/${soundName}`, queueId, "wait-custom");
          }
        } else {
          const ok1 = await this.safePlaySound(channelId, "sound:queue-holdtime", queueId, "wait-hold");
          if (ok1) {
            const ok2 = await this.safePlaySound(channelId, `number:${waitMins}`, queueId, "wait-num");
            if (ok2) {
              await this.safePlaySound(channelId, "sound:queue-minutes", queueId, "wait-mins");
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[QueueEngine] Announcement playback error for ${channelId}:`, err instanceof Error ? err.message : err);
    }

    const currentCall = this.waitingCalls.get(channelId);
    if (currentCall) {
      await this.startMohForChannel(channelId, currentCall.queueId);
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
