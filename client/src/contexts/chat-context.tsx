import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
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
  openChat: (partner: OnlineUser) => void;
  closeChat: (partnerId: string) => void;
  minimizeChat: (partnerId: string, minimized: boolean) => void;
  sendMessage: (receiverId: string, content: string) => void;
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
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageHandlersRef = useRef<Map<string, (msg: ChatMessage, sender?: SafeUser) => void>>(new Map());
  const openChatsRef = useRef<ChatWindow[]>([]);
  
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
            
          case "new_message":
            const msg = data.message as ChatMessage;
            const sender = data.sender as SafeUser;
            
            window.dispatchEvent(new CustomEvent("chat_new_message", {
              detail: { message: msg, partnerId: msg.senderId }
            }));
            
            const currentOpenChats = openChatsRef.current;
            const isOpen = currentOpenChats.some(c => c.partnerId === msg.senderId && !c.minimized);
            if (!isOpen) {
              setUnreadCounts(prev => {
                const newCounts = new Map(prev);
                newCounts.set(msg.senderId, (newCounts.get(msg.senderId) || 0) + 1);
                return newCounts;
              });
              
              if (!currentOpenChats.some(c => c.partnerId === msg.senderId)) {
                setOpenChats(prev => [...prev, {
                  partnerId: msg.senderId,
                  partner: {
                    id: sender.id,
                    fullName: sender.fullName,
                    username: sender.username,
                    avatarUrl: (sender as any).avatarUrl || null
                  },
                  minimized: false
                }]);
              }
            }
            break;
            
          case "message_sent":
            window.dispatchEvent(new CustomEvent("chat_message_sent", {
              detail: { message: data.message, receiverId: data.message.receiverId }
            }));
            break;
            
          case "messages_read":
            break;
            
          case "user_typing":
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
      setIsConnected(false);
      wsRef.current = null;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
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
    
    setUnreadCounts(prev => {
      const newCounts = new Map(prev);
      newCounts.delete(partner.id);
      return newCounts;
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

  const sendMessage = useCallback((receiverId: string, content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "chat_message",
        receiverId,
        content
      }));
    }
  }, []);

  const markAsRead = useCallback((senderId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "mark_read",
        senderId
      }));
    }
    
    setUnreadCounts(prev => {
      const newCounts = new Map(prev);
      newCounts.delete(senderId);
      return newCounts;
    });
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
      unreadCounts,
      openChat,
      closeChat,
      minimizeChat,
      sendMessage,
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
