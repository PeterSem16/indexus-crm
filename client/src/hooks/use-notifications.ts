import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  priority: string;
  entityType: string | null;
  entityId: string | null;
  metadata: any;
  countryCode: string | null;
  isRead: boolean;
  readAt: string | null;
  isDismissed: boolean;
  dismissedAt: string | null;
  createdAt: string;
}

interface WebSocketMessage {
  type: string;
  notification?: Notification;
  count?: number;
  message?: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const { data: notifications = [], isLoading, refetch } = useQuery<Notification[]>({
    queryKey: ["/api/notifications?includeRead=true&includeDismissed=false&limit=100"],
    enabled: !!user,
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: !!user,
  });

  useEffect(() => {
    if (countData) {
      setUnreadCount(countData.count);
    }
  }, [countData]);

  const connect = useCallback(() => {
    if (!user || wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/notifications?userId=${user.id}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
        console.log("[Notifications] WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case "notification":
              queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
              break;
            case "unreadCount":
              setUnreadCount(message.count || 0);
              break;
            case "allRead":
              setUnreadCount(0);
              queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
              break;
          }
        } catch (error) {
          console.error("[Notifications] Error parsing message:", error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        if (reconnectAttempts.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error("[Notifications] WebSocket error:", error);
      };
    } catch (error) {
      console.error("[Notifications] Failed to create WebSocket:", error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user, connect]);

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/mark-all-read"),
    onSuccess: () => {
      setUnreadCount(0);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const dismissAllMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/dismiss-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const sendWebSocketMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    isConnected,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    dismiss: dismissMutation.mutate,
    dismissAll: dismissAllMutation.mutate,
    refetch,
    sendWebSocketMessage,
  };
}
