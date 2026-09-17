export type WallboardQueueCallStatus = "waiting" | "ringing" | "talking";

export interface WallboardQueueCall {
  id: string;
  campaignId: string | null;
  queueId: string;
  agentId: string | null;
  agentIds?: string[];
  status: WallboardQueueCallStatus;
  since: Date | null;
}

export interface WallboardWaitingCallInput {
  id: string;
  campaignId?: string | null;
  queueId: string;
  enteredAt: Date;
}

export interface WallboardAssignedCallInput {
  id: string;
  campaignId?: string | null;
  queueId: string;
  agentId?: string | null;
  agentIds?: readonly string[];
  assignedAt?: Date | null;
}

export interface WallboardActiveBridgeInput {
  callId: string;
  campaignId?: string | null;
  queueId: string;
  agentId?: string | null;
  createdAt?: Date | null;
}

export interface WallboardQueueProjectionInput {
  waitingCalls: readonly WallboardWaitingCallInput[];
  assignedCalls: readonly WallboardAssignedCallInput[];
  activeBridges: readonly WallboardActiveBridgeInput[];
}

const STATUS_PRIORITY: Record<WallboardQueueCallStatus, number> = {
  waiting: 1,
  ringing: 2,
  talking: 3,
};

function copyDate(value: Date | null | undefined): Date | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  return new Date(value.getTime());
}

/**
 * Project the queue engine's live tracking records without leaking any of its
 * mutable call/bridge objects. A call can briefly occur in more than one map
 * while an ARI transition is in flight; the most advanced state wins.
 */
export function projectWallboardQueueCalls(
  input: WallboardQueueProjectionInput,
): WallboardQueueCall[] {
  const byId = new Map<string, WallboardQueueCall>();

  const add = (call: WallboardQueueCall): void => {
    const existing = byId.get(call.id);
    if (!existing || STATUS_PRIORITY[call.status] > STATUS_PRIORITY[existing.status]) {
      byId.set(call.id, call);
    }
  };

  for (const call of input.waitingCalls) {
    add({
      id: call.id,
      campaignId: call.campaignId ?? null,
      queueId: call.queueId,
      agentId: null,
      status: "waiting",
      since: copyDate(call.enteredAt),
    });
  }

  for (const call of input.assignedCalls) {
    const projected: WallboardQueueCall = {
      id: call.id,
      campaignId: call.campaignId ?? null,
      queueId: call.queueId,
      agentId: call.agentId || null,
      status: "ringing",
      since: copyDate(call.assignedAt),
    };
    if (call.agentIds) projected.agentIds = Array.from(call.agentIds);
    add(projected);
  }

  for (const bridge of input.activeBridges) {
    add({
      id: bridge.callId,
      campaignId: bridge.campaignId ?? null,
      queueId: bridge.queueId,
      agentId: bridge.agentId || null,
      status: "talking",
      since: copyDate(bridge.createdAt),
    });
  }

  return Array.from(byId.values());
}