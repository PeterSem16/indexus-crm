import { useState, useEffect, useCallback, useRef, createElement } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useI18n } from "@/i18n";
import { playBackOfficeChime, installBackOfficeAudioUnlock } from "@/lib/back-office-chime";
import { dispatchBackOfficeAlert } from "@/lib/back-office-alert";
import {
  dispatchTaskCompletionNoticeOnce,
  setActiveTaskCompletionNoticeUser,
} from "@/lib/task-completion-notice";

const _shownSmsToasts = new Set<string>();
const _shownChatToasts = new Set<string>();
const _shownNegSmsToasts = new Set<string>();
const _shownBoQuestionToasts = new Set<string>();
const UNREAD_NOTIFICATIONS_URL = "/api/notifications?includeRead=false&includeDismissed=false&limit=100";
let _questionToastUserId: string | null = null;

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
  const { toast } = useToast();
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  // The WebSocket handler closes over these once per connection; refs keep it pointed
  // at the latest toast/translations/navigation without reconnecting.
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  const setLocationRef = useRef(setLocation);
  toastRef.current = toast;
  tRef.current = t;
  setLocationRef.current = setLocation;

  // Unlock audio on the first user gesture so the BO chime is reliably audible.
  useEffect(() => {
    installBackOfficeAudioUnlock();
  }, []);

  const { data: notifications = [], isLoading, refetch } = useQuery<Notification[]>({
    queryKey: ["/api/notifications?includeRead=true&includeDismissed=false&limit=100"],
    enabled: !!user,
  });

  // Persisted unread notices rehydrate the agent inbox after offline periods and
  // remounts. Keep the query user-scoped so one authenticated user's cached
  // completion notices can never be emitted into another user's session.
  const { data: unreadNotifications = [] } = useQuery<Notification[]>({
    queryKey: [UNREAD_NOTIFICATIONS_URL, user?.id],
    queryFn: () => apiRequest("GET", UNREAD_NOTIFICATIONS_URL).then(r => r.json()),
    enabled: !!user,
    refetchOnMount: "always",
  });

  useEffect(() => {
    setActiveTaskCompletionNoticeUser(user?.id ?? null);
    const activeUserId = user?.id ?? null;
    if (_questionToastUserId !== activeUserId) {
      _shownBoQuestionToasts.clear();
      _questionToastUserId = activeUserId;
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    for (const notification of unreadNotifications) {
      dispatchTaskCompletionNoticeOnce(notification, user.id, savedNotification => {
        try {
          window.dispatchEvent(new CustomEvent("indexus:bo-resolved", { detail: savedNotification }));
        } catch {}
      });
    }
  }, [unreadNotifications, user?.id]);

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
  userIdRef.current = user?.id ?? null;
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
                queryClient.invalidateQueries({ queryKey: [UNREAD_NOTIFICATIONS_URL] });
                queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
                break;
              case "notification": {
                queryClient.invalidateQueries({ queryKey: ["/api/notifications?includeRead=true&includeDismissed=false&limit=100"] });
                queryClient.invalidateQueries({ queryKey: [UNREAD_NOTIFICATIONS_URL] });
                queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
                if (message.notification?.type === "new_chat" && !_shownChatToasts.has(message.notification.id)) {
                  const notification = message.notification;
                  _shownChatToasts.add(notification.id);
                  toastRef.current({
                    title: tRef.current.taskCommunication.directMessages,
                    description: notification.message || undefined,
                    action: createElement(ToastAction, {
                      altText: tRef.current.taskCommunication.directMessages,
                      onClick: () => {
                        const partnerId = notification.metadata?.senderId;
                        if (typeof partnerId !== "string") return;
                        setLocationRef.current(`/email?tab=chats&partner=${encodeURIComponent(partnerId)}`);
                        window.dispatchEvent(new CustomEvent("chat_open_conversation", { detail: { partnerId } }));
                      },
                    }, tRef.current.taskCommunication.directMessages),
                  });
                }
                const pulseTaskCompletion = message.notification?.type === "back_office_resolved" &&
                  message.notification.entityType?.toLowerCase() === "task" &&
                  message.notification.metadata?.source === "nexus_pulse";
                const taskNotification = message.notification &&
                  (message.notification.entityType?.toLowerCase() === "task" ||
                    ["task_assigned", "group_task_assigned", "task_due", "task_completed"]
                      .includes(message.notification.type));
                if (taskNotification || pulseTaskCompletion) {
                  // Omni queries all tasks under ["/api/tasks"]; the signed-in
                  // user's task list and people-task cache refresh for task changes.
                  queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/tasks/people"] });
                }
                // Inbound SMS notification → immediately refresh customer messages + history
                if (message.notification?.entityType === "sms" && message.notification?.metadata?.customerId) {
                  const cid = message.notification.metadata.customerId;
                  queryClient.invalidateQueries({ queryKey: ["/api/customers", cid, "messages"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/entity-history", cid] });
                }
                // Toast for new inbound SMS — exactly once per notification ID
                if (message.notification?.type === "new_sms") {
                  const smsNotif = message.notification!;
                  if (!_shownSmsToasts.has(smsNotif.id)) {
                    _shownSmsToasts.add(smsNotif.id);
                    const preview = smsNotif.metadata?.messagePreview?.substring(0, 120) || smsNotif.message || undefined;
                    toastRef.current({ title: smsNotif.title, description: preview });
                  }
                }
                // Toast for negative SMS sentiment alert — exactly once per notification ID
                if (message.notification?.type === "sentiment_negative" && message.notification?.entityType === "sms") {
                  const negNotif = message.notification!;
                  if (!_shownNegSmsToasts.has(negNotif.id)) {
                    _shownNegSmsToasts.add(negNotif.id);
                    toastRef.current({
                      title: negNotif.title,
                      description: negNotif.message || "SMS obsahuje negatívny sentiment",
                      variant: "destructive",
                    });
                  }
                }
                const notif = message.notification;
                // New Back Office task → pleasant chime + clickable toast, exactly once
                // per task across all concurrent mounts (see dispatchBackOfficeAlert).
                const fired = dispatchBackOfficeAlert(notif, {
                  playChime: playBackOfficeChime,
                  showToast: () => {
                    const tt = tRef.current;
                    const openBackOffice = () => {
                      try { sessionStorage.setItem("indexus:pendingOpenBackOffice", "1"); } catch {}
                      try { window.dispatchEvent(new CustomEvent("indexus:open-back-office")); } catch {}
                      try { setLocationRef.current("/agent-workspace"); } catch {}
                    };
                    toastRef.current({
                      title: tt.backOffice.newTaskToastTitle,
                      description: notif!.metadata?.taskTitle || notif!.title || tt.backOffice.newTaskToastDesc,
                      action: createElement(
                        ToastAction,
                        { altText: tt.backOffice.openBackOffice, onClick: openBackOffice },
                        tt.backOffice.openBackOffice,
                      ),
                    });
                  },
                });
                if (fired) {
                  // Refresh both the BO board (panel uses ["/api/back-office/tasks", country];
                  // prefix match covers it) and the personal task list — once per task.
                  queryClient.invalidateQueries({ queryKey: ["/api/back-office/tasks"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
                }
                // Back Office sent a question to the originating agent — refresh the agent
                // questions inbox immediately regardless of whether the agent has BO access.
                if (notif?.type === "back_office_question") {
                  queryClient.invalidateQueries({ queryKey: ["/api/agent/bo-questions"] });
                  if (!_shownBoQuestionToasts.has(notif.id)) {
                    _shownBoQuestionToasts.add(notif.id);
                    if (_shownBoQuestionToasts.size > 300) {
                      _shownBoQuestionToasts.clear();
                      _shownBoQuestionToasts.add(notif.id);
                    }
                    const tt = tRef.current;
                    const taskLabel = (notif.metadata?.taskTitle || notif.title || "").slice(0, 120);
                    const custLabel = notif.metadata?.customerName ? notif.metadata.customerName : null;
                    toastRef.current({
                      title: tt.backOffice?.questionToastTitle || "Back Office sa pýta",
                      description: custLabel ? `${custLabel} — ${taskLabel}` : taskLabel || undefined,
                    });
                  }
                }
                // Back Office resolved the agent's task — show a beautiful notification and
                // dispatch a window event so BackOfficeQuestionsInbox can render a resolved card.
                if (notif?.type === "back_office_resolved") {
                  queryClient.invalidateQueries({ queryKey: ["/api/agent/bo-questions"] });
                  const activeUserId = userIdRef.current;
                  if (activeUserId && notif.userId === activeUserId) {
                    dispatchTaskCompletionNoticeOnce(notif, activeUserId, savedNotification => {
                      try {
                        window.dispatchEvent(new CustomEvent("indexus:bo-resolved", { detail: savedNotification }));
                      } catch {}
                    });
                  }
                }
                break;
              }
              case "unreadCount":
                setUnreadCount(message.count || 0);
                break;
              case "allRead":
                setUnreadCount(0);
                queryClient.invalidateQueries({ queryKey: ["/api/notifications?includeRead=true&includeDismissed=false&limit=100"] });
                queryClient.invalidateQueries({ queryKey: [UNREAD_NOTIFICATIONS_URL] });
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
      queryClient.invalidateQueries({ queryKey: [UNREAD_NOTIFICATIONS_URL] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/mark-all-read"),
    onSuccess: () => {
      setUnreadCount(0);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications?includeRead=true&includeDismissed=false&limit=100"] });
      queryClient.invalidateQueries({ queryKey: [UNREAD_NOTIFICATIONS_URL] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications?includeRead=true&includeDismissed=false&limit=100"] });
      queryClient.invalidateQueries({ queryKey: [UNREAD_NOTIFICATIONS_URL] });
    },
  });

  const dismissAllMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/dismiss-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications?includeRead=true&includeDismissed=false&limit=100"] });
      queryClient.invalidateQueries({ queryKey: [UNREAD_NOTIFICATIONS_URL] });
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
