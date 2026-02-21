import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";

interface ConnectedAgent {
  ws: WebSocket;
  userId: string;
  connectedAt: Date;
}

class InboundCallWebSocketService {
  private wss: WebSocketServer | null = null;
  private agents: Map<string, ConnectedAgent[]> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: "/ws/inbound-calls",
    });

    this.wss.on("connection", (ws, req) => {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const userId = url.searchParams.get("userId");

      if (!userId) {
        ws.close(1008, "User ID required");
        return;
      }

      this.addAgent(userId, ws);

      ws.on("close", () => {
        this.removeAgent(userId, ws);
      });

      ws.on("error", () => {
        this.removeAgent(userId, ws);
      });

      this.sendToAgent(userId, {
        type: "connected",
        message: "Connected to inbound call service",
      });
    });

    console.log("Inbound call WebSocket server initialized on /ws/inbound-calls");
  }

  private addAgent(userId: string, ws: WebSocket) {
    const agents = this.agents.get(userId) || [];
    agents.push({ ws, userId, connectedAt: new Date() });
    this.agents.set(userId, agents);
  }

  private removeAgent(userId: string, ws: WebSocket) {
    const agents = this.agents.get(userId) || [];
    const filtered = agents.filter((a) => a.ws !== ws);
    if (filtered.length === 0) {
      this.agents.delete(userId);
    } else {
      this.agents.set(userId, filtered);
    }
  }

  sendToAgent(userId: string, data: any) {
    const agents = this.agents.get(userId) || [];
    const message = JSON.stringify(data);
    for (const agent of agents) {
      if (agent.ws.readyState === WebSocket.OPEN) {
        agent.ws.send(message);
      }
    }
  }

  notifyInboundCall(agentUserId: string, callData: {
    callId: string;
    callerNumber: string;
    callerName?: string;
    queueName: string;
    queueId: string;
    waitTime: number;
    channelId: string;
  }) {
    this.sendToAgent(agentUserId, {
      type: "inbound-call",
      ...callData,
    });
  }

  notifyCallCancelled(agentUserId: string, callId: string) {
    this.sendToAgent(agentUserId, {
      type: "call-cancelled",
      callId,
    });
  }

  notifyQueueStats(agentUserId: string, stats: {
    queueId: string;
    queueName: string;
    waiting: number;
    activeAgents: number;
    avgWaitTime: number;
  }) {
    this.sendToAgent(agentUserId, {
      type: "queue-stats",
      ...stats,
    });
  }

  getConnectedAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  isAgentConnected(userId: string): boolean {
    const agents = this.agents.get(userId) || [];
    return agents.some((a) => a.ws.readyState === WebSocket.OPEN);
  }
}

export const inboundCallWs = new InboundCallWebSocketService();
