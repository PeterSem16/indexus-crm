import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { queryClient } from "@/lib/queryClient";
import { playShiftLoginSound, unlockAmbientAudio, stopAmbientChatAudio } from "@/lib/shift-login-sounds";
import type { TaskAttachment } from "@shared/task-attachments";
import type { ChatMessage, SafeUser } from "@shared/schema";

interface OnlineUser {
  id: string;
  fullName: string;
  username: string;
  avatarUrl?: string | null;
}

interface ChatWindow {
  partnerId: string;
  partner: OnlineUser;
  minimized: boolean;
}

interface ChatContextType {
  isConnected: boolean;
  onlineUsers: OnlineUser[];
  openChats: ChatWindow[];
  unreadCounts: Map<string, number>;
  soundsMuted: boolean;
  setSoundsMuted: (muted: boolean) => void;
  openChat: (partner: OnlineUser) => void;
  closeChat: (partnerId: string) => void;
  minimizeChat: (partnerId: string, minimized: boolean) => void;
  sendMessage: (receiverId: string, content: string, clientMessageId?: string, attachments?: TaskAttachment[]) => boolean;
  setCommunicationView: (open: boolean, partnerId: string | null) => void;
  markAsRead: (senderId: string) => void;
  sendTypingIndicator: (receiverId: string, isTyping: boolean) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}

interface ChatProviderProps {
  children: React.ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [openChats, setOpenChats] = useState<ChatWindow[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [soundsMuted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const receivedIds = useRef(new Set<string>());
  const sentIds = useRef(new Set<string>());
  const conversations = useQuery<Array<{ partnerId: string; unreadCount: number }>>({
    queryKey: ["/api/chat/conversations", user?.id],
    queryFn: async () => {
      const response = await fetch("/api/chat/conversations", { credentials: "include" });
      if (!response.ok) throw new Error(`Chat conversations failed (${response.status})`);
      return response.json();
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const effectiveUnread = useMemo(() => {
    const result = new Map(unreadCounts);
    for (const conversation of conversations.data || []) {
      if (conversation.unreadCount > 0) result.set(conversation.partnerId, Math.max(result.get(conversation.partnerId) || 0, conversation.unreadCount));
    }
    return result;
  }, [unreadCounts, conversations.data]);
  const setSoundsMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;
    setMuted(muted);
    if (muted) stopAmbientChatAudio();
    else unlockAmbientAudio();
    if (user?.id) {
      try { localStorage.setItem(`chat-sounds-muted:${user.id}`, String(muted)); } catch { /* Browser storage may be unavailable. */ }
    }
  }, [user?.id]);
  useEffect(() => {
    let muted = false;
    try {
      const saved = user?.id ? localStorage.getItem(`chat-sounds-muted:${user.id}`) : null;
      muted = saved !== null ? saved === "true" : JSON.parse(localStorage.getItem("nexus-email-prefs") || "{}").chatNotifySound === false;
    } catch { /* Keep the in-memory preference when storage is unavailable. */ }
    mutedRef.current = muted;
    setMuted(muted);
    receivedIds.current.clear();
    sentIds.current.clear();
    const unlock = () => { if (!mutedRef.current) unlockAmbientAudio(); };
    const syncMute = (event: StorageEvent) => {
      if (event.key !== `chat-sounds-muted:${user?.id}`) return;
      const next = event.newValue === "true";
      mutedRef.current = next;
      setMuted(next);
      if (next) stopAmbientChatAudio();
    };
    window.addEventListener("storage", syncMute);
    document.addEventListener("pointerdown", unlock, { passive: true });
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      window.removeEventListener("storage", syncMute);
      stopAmbientChatAudio();
    };
  }, [user?.id]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageHandlersRef = useRef<Map<string, (msg: ChatMessage, sender?: SafeUser) => void>>(new Map());
  const openChatsRef = useRef<ChatWindow[]>([]);
  const communicationViewRef = useRef({ open: false, partnerId: null as string | null });
  const keepConnectedRef = useRef(false);
  const setCommunicationView = useCallback((open: boolean, partnerId: string | null) => {
    communicationViewRef.current = { open, partnerId };
  }, []);
  
  useEffect(() => {
    openChatsRef.current = openChats;
  }, [openChats]);

  const connect = useCallback(() => {
    if (!user?.id || wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", userId: user.id }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case "auth_success":
            setIsConnected(true);
            break;
            
          case "presence_update":
            setOnlineUsers(data.onlineUsers.filter((u: OnlineUser) => u.id !== user?.id));
            break;
          case "chat_policy_changed":
            setUnreadCounts(new Map());
            setOpenChats([]);
            window.dispatchEvent(new CustomEvent("chat_policy_changed"));
            void queryClient.invalidateQueries({ predicate: query =>
              typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/chat/") });
            break;
            
          case "new_message":
            const msg = data.message as ChatMessage;
            const sender = data.sender as SafeUser;
            if (!msg?.id || msg.receiverId !== user.id || receivedIds.current.has(msg.id)) break;
            receivedIds.current.add(msg.id);
            if (receivedIds.current.size > 1000) receivedIds.current.delete(receivedIds.current.values().next().value!);
            if (!mutedRef.current) void playShiftLoginSound("chatReceive");
            void queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations", user.id] });
            
            window.dispatchEvent(new CustomEvent("chat_new_message", {
              detail: { message: msg, partnerId: msg.senderId }
            }));
            
            const currentOpenChats = openChatsRef.current;
             const isOpen = !document.hidden && document.hasFocus() && (
               currentOpenChats.some(c => c.partnerId === msg.senderId && !c.minimized)
               || (communicationViewRef.current.open && communicationViewRef.current.partnerId === msg.senderId));
            if (!isOpen) {
              setUnreadCounts(prev => {
                const newCounts = new Map(prev);
                newCounts.set(msg.senderId, (newCounts.get(msg.senderId) || 0) + 1);
                return newCounts;
              });
              
            }
            break;
            
          case "message_sent":
            if (!data.message?.id || data.message.senderId !== user.id || sentIds.current.has(data.message.id)) break;
            sentIds.current.add(data.message.id);
            if (sentIds.current.size > 1000) sentIds.current.delete(sentIds.current.values().next().value!);
            if (!mutedRef.current) void playShiftLoginSound("chatSend");
            window.dispatchEvent(new CustomEvent("chat_message_sent", {
              detail: { message: data.message, receiverId: data.message.receiverId }
             }));
             window.dispatchEvent(new CustomEvent("chat_delivery_confirmed", {
               detail: { message: data.message, clientMessageId: data.clientMessageId }
            }));
            break;
            
          case "messages_read":
            window.dispatchEvent(new CustomEvent("chat_messages_read", { detail: { readBy: data.readBy } }));
            break;
          case "read_confirmed":
            queryClient.setQueryData<Array<{ partnerId: string; unreadCount: number }>>(
              ["/api/chat/conversations", user.id],
              previous => previous?.map(conversation => conversation.partnerId === data.senderId ? { ...conversation, unreadCount: 0 } : conversation));
            setUnreadCounts(previous => {
              const next = new Map(previous); next.delete(data.senderId); return next;
            });
            void queryClient.invalidateQueries({ predicate: query =>
              String(query.queryKey[0]).startsWith("/api/notifications") });
            window.dispatchEvent(new CustomEvent("chat_read_confirmed", { detail: { senderId: data.senderId } }));
            break;
           case "error":
             window.dispatchEvent(new CustomEvent("chat_delivery_error", { detail: { clientMessageId: data.clientMessageId } }));
             break;
            
          case "user_typing":
            window.dispatchEvent(new CustomEvent("chat_user_typing", { detail: { userId: data.userId, isTyping: data.isTyping } }));
            const typingHandler = messageHandlersRef.current.get(`typing_${data.userId}`);
            if (typingHandler) {
              typingHandler({ isTyping: data.isTyping } as any);
            }
            break;
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      setIsConnected(false);
      wsRef.current = null;
      if (!keepConnectedRef.current) return;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }, [user?.id]);

  useEffect(() => {
    keepConnectedRef.current = true;
    setOpenChats([]);
    setOnlineUsers([]);
    setUnreadCounts(new Map());
    if (user?.id) {
      connect();
    }

    return () => {
      keepConnectedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        const socket = wsRef.current;
        wsRef.current = null;
        socket.close();
      }
      setIsConnected(false);
    };
  }, [user?.id, connect]);

  const openChat = useCallback((partner: OnlineUser) => {
    setOpenChats(prev => {
      const existing = prev.find(c => c.partnerId === partner.id);
      if (existing) {
        return prev.map(c => 
          c.partnerId === partner.id ? { ...c, minimized: false } : c
        );
      }
      return [...prev, { partnerId: partner.id, partner, minimized: false }];
    });
    
  }, []);

  const closeChat = useCallback((partnerId: string) => {
    setOpenChats(prev => prev.filter(c => c.partnerId !== partnerId));
    messageHandlersRef.current.delete(partnerId);
  }, []);

  const minimizeChat = useCallback((partnerId: string, minimized: boolean) => {
    setOpenChats(prev => prev.map(c => 
      c.partnerId === partnerId ? { ...c, minimized } : c
    ));
  }, []);

  const sendMessage = useCallback((receiverId: string, content: string, clientMessageId?: string, attachments: TaskAttachment[] = []) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "chat_message",
        receiverId,
        content,
        clientMessageId,
        attachments,
      }));
      return true;
    }
    return false;
  }, []);

  const markAsRead = useCallback((senderId: string) => {
    if (document.hidden) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "mark_read",
        senderId
      }));
    }
    
  }, []);

  const sendTypingIndicator = useCallback((receiverId: string, isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "typing",
        receiverId,
        isTyping
      }));
    }
  }, []);

  return (
    <ChatContext.Provider value={{
      isConnected,
      onlineUsers,
      openChats,
      unreadCounts: effectiveUnread,
      soundsMuted,
      setSoundsMuted,
      openChat,
      closeChat,
      minimizeChat,
      sendMessage,
      setCommunicationView,
      markAsRead,
      sendTypingIndicator
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useMessageHandler(partnerId: string, handler: (msg: ChatMessage, sender?: SafeUser) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrapped = (msg: ChatMessage, sender?: SafeUser) => handlerRef.current(msg, sender);
    
    const handlersMap = (window as any).__chatMessageHandlers || new Map();
    handlersMap.set(partnerId, wrapped);
    (window as any).__chatMessageHandlers = handlersMap;
    
    return () => {
      handlersMap.delete(partnerId);
    };
  }, [partnerId]);
}
