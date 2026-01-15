import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2, User, Sparkles } from "lucide-react";
import { NexusIcon } from "./nexus-icon";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface NexusChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NexusChat({ open, onOpenChange }: NexusChatProps) {
  const getWelcomeMessage = () => {
    const lang = navigator.language?.toLowerCase() || "en";
    if (lang.startsWith("sk")) {
      return "Ahoj! Som NEXUS, váš inteligentný asistent systému INDEXUS. Opýtajte sa ma na čokoľvek o vašich dátach - používatelia, zákazníci, kampane, protokoly aktivít a ďalšie. Odpoviem v akomkoľvek jazyku.";
    }
    if (lang.startsWith("cs")) {
      return "Ahoj! Jsem NEXUS, váš inteligentní asistent systému INDEXUS. Zeptejte se mě na cokoliv o vašich datech - uživatelé, zákazníci, kampaně, protokoly aktivit a další. Odpovím v jakémkoliv jazyce.";
    }
    if (lang.startsWith("hu")) {
      return "Helló! NEXUS vagyok, az INDEXUS intelligens asszisztense. Kérdezzen bármit az adatairól - felhasználók, ügyfelek, kampányok, tevékenységnaplók és egyebek. Bármilyen nyelven válaszolok.";
    }
    if (lang.startsWith("de")) {
      return "Hallo! Ich bin NEXUS, Ihr intelligenter INDEXUS-Assistent. Fragen Sie mich alles über Ihre Daten - Benutzer, Kunden, Kampagnen, Aktivitätsprotokolle und mehr. Ich antworte in jeder Sprache.";
    }
    if (lang.startsWith("it")) {
      return "Ciao! Sono NEXUS, il tuo assistente intelligente INDEXUS. Chiedimi qualsiasi cosa sui tuoi dati: utenti, clienti, campagne, log delle attività e altro. Rispondo in qualsiasi lingua.";
    }
    if (lang.startsWith("ro")) {
      return "Salut! Sunt NEXUS, asistentul tău inteligent INDEXUS. Întreabă-mă orice despre datele tale - utilizatori, clienți, campanii, jurnale de activitate și multe altele. Răspund în orice limbă.";
    }
    return "Hello! I am NEXUS, your intelligent INDEXUS assistant. Ask me anything about your data - users, customers, campaigns, activity logs, and more. I can answer in any language.";
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: getWelcomeMessage(),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const queryMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", "/api/nexus/query", { query });
      return res.json();
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: data.response || "I could not process that request.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error: any) => {
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: `Sorry, an error occurred: ${error.message || "Unknown error"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  const handleSend = () => {
    if (!input.trim() || queryMutation.isPending) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    queryMutation.mutate(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-0 gap-0" data-testid="dialog-nexus-chat">
        <DialogHeader className="p-4 pb-2 border-b bg-gradient-to-r from-primary/10 to-primary/5">
          <DialogTitle className="flex items-center gap-3">
            <NexusIcon className="h-8 w-8" animate />
            <div>
              <span className="text-lg font-semibold">NEXUS</span>
              <p className="text-xs font-normal text-muted-foreground">
                Intelligent INDEXUS Assistant
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" && "flex-row-reverse"
                )}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback
                    className={cn(
                      message.role === "assistant"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <Sparkles className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "rounded-lg px-4 py-2 max-w-[80%]",
                    message.role === "assistant"
                      ? "bg-muted"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-[10px] opacity-60 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {queryMutation.isPending && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Sparkles className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-lg px-4 py-2 bg-muted">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about INDEXUS data..."
              className="min-h-[80px] max-h-[120px] resize-none"
              disabled={queryMutation.isPending}
              data-testid="input-nexus-query"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || queryMutation.isPending}
              size="icon"
              data-testid="button-nexus-send"
            >
              {queryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
