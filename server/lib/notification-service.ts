import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";
import type { InsertNotification, Notification, NotificationRule } from "@shared/schema";
import { storage } from "../storage";

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  connectedAt: Date;
}

class NotificationService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ConnectedClient[]> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: "/ws/notifications"
    });

    this.wss.on("connection", (ws, req) => {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const userId = url.searchParams.get("userId");

      if (!userId) {
        ws.close(1008, "User ID required");
        return;
      }

      this.addClient(userId, ws);

      ws.on("message", async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(userId, message);
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      });

      ws.on("close", () => {
        this.removeClient(userId, ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.removeClient(userId, ws);
      });

      this.sendToClient(userId, {
        type: "connected",
        message: "Connected to notification service"
      });

      this.sendUnreadCount(userId);
    });

    console.log("Notification WebSocket server initialized on /ws/notifications");
  }

  private addClient(userId: string, ws: WebSocket) {
    const clients = this.clients.get(userId) || [];
    clients.push({ ws, userId, connectedAt: new Date() });
    this.clients.set(userId, clients);
  }

  private removeClient(userId: string, ws: WebSocket) {
    const clients = this.clients.get(userId) || [];
    const filtered = clients.filter(c => c.ws !== ws);
    if (filtered.length === 0) {
      this.clients.delete(userId);
    } else {
      this.clients.set(userId, filtered);
    }
  }

  private async handleMessage(userId: string, message: any) {
    switch (message.type) {
      case "ping":
        this.sendToClient(userId, { type: "pong" });
        break;
      case "getUnreadCount":
        await this.sendUnreadCount(userId);
        break;
      case "markRead":
        if (message.notificationId) {
          await storage.markNotificationRead(message.notificationId);
          await this.sendUnreadCount(userId);
        }
        break;
      case "markAllRead":
        await storage.markAllNotificationsRead(userId);
        await this.sendUnreadCount(userId);
        this.sendToClient(userId, { type: "allRead" });
        break;
    }
  }

  private async sendUnreadCount(userId: string) {
    const count = await storage.getUnreadNotificationsCount(userId);
    this.sendToClient(userId, { type: "unreadCount", count });
  }

  private sendToClient(userId: string, data: any) {
    const clients = this.clients.get(userId) || [];
    const message = JSON.stringify(data);
    clients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  async sendNotification(notification: Notification) {
    this.sendToClient(notification.userId, {
      type: "notification",
      notification
    });
    await this.sendUnreadCount(notification.userId);
  }

  async sendNotificationToUsers(userIds: string[], notification: Omit<InsertNotification, "userId">) {
    for (const userId of userIds) {
      const created = await storage.createNotification({
        ...notification,
        userId
      });
      await this.sendNotification(created);
    }
  }

  async triggerNotification(
    triggerType: string,
    data: {
      title: string;
      message?: string;
      entityType?: string;
      entityId?: string;
      countryCode?: string;
      metadata?: any;
      priority?: string;
    }
  ) {
    try {
      const rules = await storage.getActiveNotificationRulesByTrigger(triggerType);
      
      for (const rule of rules) {
        if (rule.countryCodes && rule.countryCodes.length > 0 && data.countryCode) {
          if (!rule.countryCodes.includes(data.countryCode)) {
            continue;
          }
        }

        const targetUserIds = await this.getTargetUsers(rule);

        if (targetUserIds.length > 0) {
          const notificationData: Omit<InsertNotification, "userId"> = {
            type: triggerType,
            title: this.interpolateTemplate(rule.notificationTitle, data),
            message: rule.notificationMessage ? this.interpolateTemplate(rule.notificationMessage, data) : data.message,
            priority: rule.priority || data.priority || "normal",
            entityType: data.entityType,
            entityId: data.entityId,
            countryCode: data.countryCode,
            metadata: data.metadata,
          };

          await this.sendNotificationToUsers(targetUserIds, notificationData);
        }
      }
    } catch (error) {
      console.error("Error triggering notification:", error);
    }
  }

  private async getTargetUsers(rule: NotificationRule): Promise<string[]> {
    const allUsers = await storage.getAllUsers();
    let targetUsers: string[] = [];

    switch (rule.targetType) {
      case "all":
        targetUsers = allUsers.map(u => u.id);
        break;
      case "role":
        if (rule.targetRoles && rule.targetRoles.length > 0) {
          targetUsers = allUsers
            .filter(u => u.roleId && rule.targetRoles?.includes(u.roleId))
            .map(u => u.id);
        }
        break;
      case "specific_users":
        if (rule.targetUserIds && rule.targetUserIds.length > 0) {
          targetUsers = rule.targetUserIds;
        }
        break;
    }

    return targetUsers;
  }

  private interpolateTemplate(template: string, data: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || data.metadata?.[key] || match;
    });
  }

  getConnectedClientsCount(): number {
    let count = 0;
    this.clients.forEach(clients => {
      count += clients.length;
    });
    return count;
  }

  isUserConnected(userId: string): boolean {
    const clients = this.clients.get(userId) || [];
    return clients.some(c => c.ws.readyState === WebSocket.OPEN);
  }
}

export const notificationService = new NotificationService();
