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

  const userIdRef = useRef<string | null>(null);
  const connectingRef = useRef(false);

  useEffect(() => {
    if (!user) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      userIdRef.current = null;
      connectingRef.current = false;
      setIsConnected(false);
      return;
    }

    if (userIdRef.current === user.id && (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING)) {
      return;
    }

    userIdRef.current = user.id;

    function doConnect() {
      if (connectingRef.current) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      connectingRef.current = true;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/notifications?userId=${user!.id}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          connectingRef.current = false;
          setIsConnected(true);
          reconnectAttempts.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            switch (message.type) {
              case "connected":
                queryClient.invalidateQueries({ queryKey: ["/api/notifications?includeRead=true&includeDismissed=false&limit=100"] });
                queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
                break;
              case "notification":
                queryClient.invalidateQueries({ queryKey: ["/api/notifications?includeRead=true&includeDismissed=false&limit=100"] });
                queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
                break;
              case "unreadCount":
                setUnreadCount(message.count || 0);
                break;
              case "allRead":
                setUnreadCount(0);
                queryClient.invalidateQueries({ queryKey: ["/api/notifications?includeRead=true&includeDismissed=false&limit=100"] });
                break;
            }
          } catch (error) {
            console.error("[Notifications] Error parsing message:", error);
          }
        };

        ws.onclose = () => {
          connectingRef.current = false;
          setIsConnected(false);
          wsRef.current = null;

          if (userIdRef.current && reconnectAttempts.current < 5) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttempts.current++;
              doConnect();
            }, delay);
          }
        };

        ws.onerror = () => {
          connectingRef.current = false;
        };
      } catch (error) {
        connectingRef.current = false;
      }
    }

    doConnect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      connectingRef.current = false;
    };
  }, [user?.id]);

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications?includeRead=true&includeDismissed=false&limit=100"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/mark-all-read"),
    onSuccess: () => {
      setUnreadCount(0);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications?includeRead=true&includeDismissed=false&limit=100"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications?includeRead=true&includeDismissed=false&limit=100"] });
    },
  });

  const dismissAllMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/dismiss-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications?includeRead=true&includeDismissed=false&limit=100"] });
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
