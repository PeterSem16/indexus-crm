import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChatContext } from "@/contexts/chat-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Minus, Send, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { ChatMessage } from "@shared/schema";

interface ChatWindowProps {
  partnerId: string;
  partner: {
    id: string;
    fullName: string;
    username: string;
    avatarUrl?: string | null;
  };
  minimized: boolean;
  position: number;
}

export function ChatWindow({ partnerId, partner, minimized, position }: ChatWindowProps) {
  const { closeChat, minimizeChat, sendMessage, markAsRead, onlineUsers } = useChatContext();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isOnline = onlineUsers.some(u => u.id === partnerId);

  const { data: historicalMessages } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", partnerId],
    enabled: !minimized,
  });

  useEffect(() => {
    if (historicalMessages) {
      setMessages(historicalMessages);
    }
  }, [historicalMessages]);

  useEffect(() => {
    if (!minimized) {
      markAsRead(partnerId);
      inputRef.current?.focus();
    }
  }, [minimized, partnerId, markAsRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleNewMessage = (event: CustomEvent) => {
      const { message: msg, partnerId: msgPartnerId } = event.detail;
      if (msgPartnerId === partnerId) {
        setMessages(prev => [...prev, msg]);
        if (!minimized) {
          markAsRead(partnerId);
        }
      }
    };

    const handleSentMessage = (event: CustomEvent) => {
      const { message: msg, receiverId } = event.detail;
      if (receiverId === partnerId) {
        // Replace optimistic message with server-confirmed message
        setMessages(prev => {
          const optimisticIndex = prev.findIndex(m => m.senderId === "self" && m.content === msg.content);
          if (optimisticIndex >= 0) {
            const newMessages = [...prev];
            newMessages[optimisticIndex] = msg;
            return newMessages;
          }
          return prev;
        });
      }
    };

    window.addEventListener("chat_new_message" as any, handleNewMessage);
    window.addEventListener("chat_message_sent" as any, handleSentMessage);

    return () => {
      window.removeEventListener("chat_new_message" as any, handleNewMessage);
      window.removeEventListener("chat_message_sent" as any, handleSentMessage);
    };
  }, [partnerId, minimized, markAsRead]);

  const handleSend = useCallback(() => {
    if (!message.trim()) return;
    
    const newMsg: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: "self",
      receiverId: partnerId,
      content: message.trim(),
      isRead: false,
      createdAt: new Date()
    };
    
    setMessages(prev => [...prev, newMsg]);
    sendMessage(partnerId, message.trim());
    setMessage("");
  }, [message, partnerId, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const initials = partner.fullName
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const rightPosition = 16 + (position * 336);

  if (minimized) {
    return (
      <div 
        className="fixed bottom-0 bg-card border border-border rounded-t-lg shadow-lg cursor-pointer z-50"
        style={{ right: rightPosition, width: 320 }}
        onClick={() => minimizeChat(partnerId, false)}
        data-testid={`chat-minimized-${partnerId}`}
      >
        <div className="flex items-center justify-between gap-2 p-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Avatar className="h-6 w-6">
                <AvatarImage src={partner.avatarUrl || undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              {isOnline && (
                <Circle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-green-500 text-green-500" />
              )}
            </div>
            <span className="text-sm font-medium truncate">{partner.fullName}</span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              closeChat(partnerId);
            }}
            data-testid={`button-close-chat-${partnerId}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed bottom-0 bg-card border border-border rounded-t-lg shadow-lg flex flex-col z-50"
      style={{ right: rightPosition, width: 320, height: 400 }}
      data-testid={`chat-window-${partnerId}`}
    >
      <div className="flex items-center justify-between gap-2 p-2 border-b border-border bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Avatar className="h-8 w-8">
              <AvatarImage src={partner.avatarUrl || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            {isOnline && (
              <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-green-500 text-green-500" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">{partner.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => minimizeChat(partnerId, true)}
            data-testid={`button-minimize-chat-${partnerId}`}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => closeChat(partnerId)}
            data-testid={`button-close-chat-${partnerId}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg, idx) => {
          const isSelf = msg.senderId === "self" || msg.receiverId === partnerId && msg.senderId !== partnerId;
          return (
            <div
              key={msg.id || idx}
              className={cn(
                "flex",
                isSelf ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                  isSelf
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                <p className="break-words">{msg.content}</p>
                <p className={cn(
                  "text-[10px] mt-1",
                  isSelf ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {format(new Date(msg.createdAt), "HH:mm")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2 border-t border-border">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1"
            data-testid={`input-message-${partnerId}`}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!message.trim()}
            data-testid={`button-send-${partnerId}`}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
