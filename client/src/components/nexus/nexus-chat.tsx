import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Loader2, User, Sparkles, Settings, Copy, ExternalLink, X, Thermometer, Brain, Globe, MessageSquare, RotateCcw } from "lucide-react";
import { NexusIcon } from "./nexus-icon";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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

interface NexusSettings {
  model: string;
  temperature: number;
  language: string;
  systemPrompt: string;
  maxTokens: number;
}

const DEFAULT_SETTINGS: NexusSettings = {
  model: "gpt-4o",
  temperature: 0.7,
  language: "auto",
  systemPrompt: "",
  maxTokens: 2048,
};

const MODEL_OPTIONS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
];

const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "sk", label: "Slovensky" },
  { value: "cs", label: "Cesky" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "hu", label: "Magyar" },
  { value: "it", label: "Italiano" },
  { value: "ro", label: "Romana" },
];

function MessageDetailDialog({
  message,
  open,
  onOpenChange,
  settings,
  onSettingsChange,
  messages,
  onSend,
  isPending,
}: {
  message: Message | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: NexusSettings;
  onSettingsChange: (settings: NexusSettings) => void;
  messages: Message[];
  onSend: (query: string) => void;
  isPending: boolean;
}) {
  const [followUpInput, setFollowUpInput] = useState("");
  const { toast } = useToast();

  if (!message) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast({ title: "Skopirované", description: "Správa bola skopírovaná do schránky" });
  };

  const handleSendFollowUp = () => {
    if (!followUpInput.trim() || isPending) return;
    onSend(followUpInput.trim());
    setFollowUpInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col p-0 gap-0" data-testid="dialog-nexus-detail">
        <DialogHeader className="p-4 pb-2 border-b bg-gradient-to-r from-primary/10 to-primary/5">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <NexusIcon className="h-7 w-7" animate />
              <div>
                <span className="text-base font-semibold">NEXUS</span>
                <p className="text-[10px] font-normal text-muted-foreground">
                  Detail správy + Nastavenia
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                title="Kopírovať správu"
                data-testid="button-nexus-copy"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-[10px]">
                    {message.role === "assistant" ? "NEXUS" : "Vy"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {message.timestamp.toLocaleString()}
                  </span>
                </div>

                <div className={cn(
                  "rounded-lg p-4",
                  message.role === "assistant" ? "bg-muted" : "bg-primary/10"
                )}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </div>

                {messages.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquare className="h-3 w-3" />
                        Konverzácia ({messages.length})
                      </h4>
                      {messages.slice(-6).map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex gap-2",
                            msg.role === "user" && "flex-row-reverse"
                          )}
                        >
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarFallback className={cn(
                              "text-[10px]",
                              msg.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}>
                              {msg.role === "assistant" ? <Sparkles className="h-3 w-3" /> : <User className="h-3 w-3" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className={cn(
                            "rounded-md px-3 py-1.5 max-w-[80%]",
                            msg.role === "assistant" ? "bg-muted/60" : "bg-primary/10"
                          )}>
                            <p className="text-xs whitespace-pre-wrap line-clamp-3">{msg.content}</p>
                            <p className="text-[9px] opacity-50 mt-0.5">{msg.timestamp.toLocaleTimeString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            <div className="p-3 border-t bg-background">
              <div className="flex gap-2">
                <Textarea
                  value={followUpInput}
                  onChange={(e) => setFollowUpInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendFollowUp();
                    }
                  }}
                  placeholder="Opýtajte sa ďalej..."
                  className="min-h-[60px] max-h-[100px] resize-none text-sm"
                  disabled={isPending}
                  data-testid="input-nexus-followup"
                />
                <Button
                  onClick={handleSendFollowUp}
                  disabled={!followUpInput.trim() || isPending}
                  size="icon"
                  data-testid="button-nexus-followup-send"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="w-64 border-l bg-card flex flex-col shrink-0">
            <div className="p-3 border-b">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Settings className="h-3 w-3" />
                Nastavenia
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Brain className="h-3 w-3 text-primary" />
                    Model
                  </Label>
                  <Select
                    value={settings.model}
                    onValueChange={(v) => onSettingsChange({ ...settings, model: v })}
                  >
                    <SelectTrigger className="text-xs" data-testid="select-nexus-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Thermometer className="h-3 w-3 text-orange-500" />
                    Teplota: {settings.temperature.toFixed(1)}
                  </Label>
                  <input
                    type="range"
                    value={settings.temperature}
                    onChange={(e) => onSettingsChange({ ...settings, temperature: parseFloat(e.target.value) })}
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full h-2 bg-muted rounded-full accent-primary cursor-pointer"
                    data-testid="slider-nexus-temperature"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>Presné</span>
                    <span>Kreatívne</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Globe className="h-3 w-3 text-blue-500" />
                    Jazyk odpovede
                  </Label>
                  <Select
                    value={settings.language}
                    onValueChange={(v) => onSettingsChange({ ...settings, language: v })}
                  >
                    <SelectTrigger className="text-xs" data-testid="select-nexus-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Max tokeny</Label>
                  <Select
                    value={String(settings.maxTokens)}
                    onValueChange={(v) => onSettingsChange({ ...settings, maxTokens: Number(v) })}
                  >
                    <SelectTrigger className="text-xs" data-testid="select-nexus-max-tokens">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1024">1024</SelectItem>
                      <SelectItem value="2048">2048</SelectItem>
                      <SelectItem value="4096">4096</SelectItem>
                      <SelectItem value="8192">8192</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs">Systémový prompt (voliteľné)</Label>
                  <Textarea
                    value={settings.systemPrompt}
                    onChange={(e) => onSettingsChange({ ...settings, systemPrompt: e.target.value })}
                    placeholder="Vlastné inštrukcie pre NEXUS..."
                    className="min-h-[80px] text-xs resize-none"
                    data-testid="input-nexus-system-prompt"
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  onClick={() => onSettingsChange(DEFAULT_SETTINGS)}
                  data-testid="button-nexus-reset-settings"
                >
                  <RotateCcw className="h-3 w-3" />
                  Obnoviť predvolené
                </Button>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NexusChat({ open, onOpenChange }: NexusChatProps) {
  const { toast } = useToast();

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
  const [settings, setSettings] = useState<NexusSettings>(DEFAULT_SETTINGS);
  const [detailMessage, setDetailMessage] = useState<Message | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
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

  const handleSend = (query?: string) => {
    const text = query || input.trim();
    if (!text || queryMutation.isPending) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    queryMutation.mutate(text);
    if (!query) setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDoubleClick = (message: Message) => {
    setDetailMessage(message);
    setDetailOpen(true);
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
    <>
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
                    "flex gap-3 cursor-pointer",
                    message.role === "user" && "flex-row-reverse"
                  )}
                  onDoubleClick={() => handleDoubleClick(message)}
                  title="Dvojklik pre detail"
                  data-testid={`nexus-message-${message.id}`}
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
                      "rounded-lg px-4 py-2 max-w-[80%] transition-colors",
                      message.role === "assistant"
                        ? "bg-muted hover:bg-muted/80"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
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

          <div className="px-4 pb-1 pt-0">
            <p className="text-[9px] text-muted-foreground text-center">
              Dvojklik na správu pre detail a nastavenia
            </p>
          </div>

          <div className="p-4 pt-1 border-t bg-background">
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
                onClick={() => handleSend()}
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

      <MessageDetailDialog
        message={detailMessage}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        settings={settings}
        onSettingsChange={setSettings}
        messages={messages}
        onSend={(query) => handleSend(query)}
        isPending={queryMutation.isPending}
      />
    </>
  );
}
