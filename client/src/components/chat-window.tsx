import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useChatContext } from "@/contexts/chat-context";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Minus, Send, Circle, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  unreadCount: number;
}

export function ChatWindow({ partnerId, partner, minimized, position, unreadCount }: ChatWindowProps) {
  const { closeChat, minimizeChat, sendMessage, markAsRead, onlineUsers } = useChatContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isOnline = onlineUsers.some(u => u.id === partnerId);

  const createTaskMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/tasks", {
        title: `Chat: ${content.slice(0, 50)}${content.length > 50 ? "..." : ""}`,
        description: content,
        priority: "medium",
        status: "pending",
        assignedUserId: user?.id,
        createdByUserId: user?.id,
        country: user?.assignedCountries?.[0] || "SK"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Úloha vytvorená", description: "Úloha bola úspešne vytvorená z chatu" });
      setSelectedMessages(new Set());
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa vytvoriť úlohu", variant: "destructive" });
    }
  });

  const handleCreateTask = () => {
    const selectedIndices = messages
      .map((msg, idx) => selectedMessages.has(msg.id) ? idx : -1)
      .filter(idx => idx !== -1);
    
    if (selectedIndices.length === 0) return;

    const contextMessages: string[] = [];
    const includedIndices = new Set<number>();
    
    selectedIndices.forEach(selectedIdx => {
      const startIdx = Math.max(0, selectedIdx - 3);
      for (let i = startIdx; i <= selectedIdx; i++) {
        if (!includedIndices.has(i)) {
          includedIndices.add(i);
          const msg = messages[i];
          const senderName = msg.senderId === user?.id || msg.senderId === "self" 
            ? user?.fullName || "Ja" 
            : partner.fullName;
          const isSelected = selectedMessages.has(msg.id);
          const prefix = isSelected ? ">> " : "   ";
          contextMessages.push(`${prefix}${senderName}: ${msg.content}`);
        }
      }
    });
    
    const content = contextMessages.join("\n");
    if (content) {
      createTaskMutation.mutate(content);
    }
  };

  const toggleMessageSelection = (msgId: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(msgId)) {
        newSet.delete(msgId);
      } else {
        newSet.add(msgId);
      }
      return newSet;
    });
  };

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
                <AvatarImage src={partner.avatarUrl || undefined} className="object-cover" />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              {isOnline && (
                <Circle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-green-500 text-green-500" />
              )}
            </div>
            <span className="text-sm font-medium truncate">{partner.fullName}</span>
            {unreadCount > 0 && (
              <span 
                className="flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-medium bg-destructive text-destructive-foreground rounded-full"
                data-testid={`badge-unread-${partnerId}`}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
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
              <AvatarImage src={partner.avatarUrl || undefined} className="object-cover" />
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
          const isSelf = msg.senderId === "self" || msg.senderId === user?.id;
          const senderName = isSelf ? (user?.fullName || "Ja") : partner.fullName;
          const isSelected = selectedMessages.has(msg.id);
          return (
            <div
              key={msg.id || idx}
              className={cn(
                "flex items-start gap-1",
                isSelf ? "justify-end" : "justify-start"
              )}
            >
              {!isSelf && (
                <div 
                  className="flex items-center gap-0.5 mt-1 cursor-pointer group"
                  onClick={() => toggleMessageSelection(msg.id)}
                  title="Pridať do úlohy"
                >
                  <ListTodo className={cn(
                    "h-3 w-3 transition-colors",
                    isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleMessageSelection(msg.id)}
                    className="h-3 w-3"
                    data-testid={`checkbox-msg-${msg.id}`}
                  />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                  isSelf
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                  isSelected && "ring-2 ring-primary"
                )}
              >
                <p className={cn(
                  "text-[10px] font-medium mb-0.5",
                  isSelf ? "text-primary-foreground/80" : "text-muted-foreground"
                )}>
                  {senderName}
                </p>
                <p className="break-words">{msg.content}</p>
                <p className={cn(
                  "text-[10px] mt-1",
                  isSelf ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {format(new Date(msg.createdAt), "HH:mm")}
                </p>
              </div>
              {isSelf && (
                <div 
                  className="flex items-center gap-0.5 mt-1 cursor-pointer group"
                  onClick={() => toggleMessageSelection(msg.id)}
                  title="Pridať do úlohy"
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleMessageSelection(msg.id)}
                    className="h-3 w-3"
                    data-testid={`checkbox-msg-${msg.id}`}
                  />
                  <ListTodo className={cn(
                    "h-3 w-3 transition-colors",
                    isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2 border-t border-border space-y-2">
        {selectedMessages.size > 0 && (
          <div className="flex items-center justify-between bg-muted/50 rounded px-2 py-1">
            <span className="text-xs text-muted-foreground">
              {selectedMessages.size} správ vybraných
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateTask}
              disabled={createTaskMutation.isPending}
              data-testid={`button-create-task-${partnerId}`}
            >
              <ListTodo className="h-3 w-3 mr-1" />
              Vytvoriť úlohu
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Napíšte správu..."
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
