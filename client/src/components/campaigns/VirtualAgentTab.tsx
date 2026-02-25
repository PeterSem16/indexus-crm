import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Bot, Plus, Pencil, Trash2, Phone, Clock, MessageSquare, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Loader2, Volume2, Settings, Cpu, Info, Zap, Mic, Globe, RefreshCw, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import type { VirtualAgentConfig, VirtualAgentConversation } from "@shared/schema";

const TTS_VOICES = [
  { value: "nova", label: "Nova (ženský)", desc: "Priateľský a teplý ženský hlas" },
  { value: "shimmer", label: "Shimmer (ženský)", desc: "Jemný a profesionálny ženský hlas" },
  { value: "alloy", label: "Alloy (neutrálny)", desc: "Vyvážený neutrálny hlas" },
  { value: "coral", label: "Coral (ženský)", desc: "Energický a jasný ženský hlas" },
  { value: "sage", label: "Sage (ženský)", desc: "Pokojný a dôveryhodný ženský hlas" },
  { value: "onyx", label: "Onyx (mužský)", desc: "Hlboký a autoritatívny mužský hlas" },
  { value: "echo", label: "Echo (mužský)", desc: "Dynamický mužský hlas" },
  { value: "fable", label: "Fable (mužský)", desc: "Rozprávačský mužský hlas" },
  { value: "ash", label: "Ash (mužský)", desc: "Kľudný mužský hlas" },
];

const LANGUAGES = [
  { value: "sk", label: "Slovenčina" },
  { value: "cs", label: "Čeština" },
  { value: "en", label: "Angličtina" },
  { value: "hu", label: "Maďarčina" },
  { value: "de", label: "Nemčina" },
  { value: "ro", label: "Rumunčina" },
  { value: "it", label: "Taliančina" },
];

const GPT_MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini", desc: "Najrýchlejší, odporúčaný pre real-time konverzáciu" },
  { value: "gpt-4o", label: "GPT-4o", desc: "Najkvalitnejší, ale pomalší odozva" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", desc: "Nová generácia, rýchly a presný" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 Nano", desc: "Ultra-rýchly, najnižšia latencia" },
];

const TTS_MODELS = [
  { value: "tts-1", label: "TTS-1 (štandard)", desc: "Rýchla syntéza reči, nižšia kvalita" },
  { value: "tts-1-hd", label: "TTS-1 HD (kvalitný)", desc: "Vyššia kvalita zvuku, pomalšia syntéza" },
];

function FieldHint({ text }: { text: string }) {
  return <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{text}</p>;
}

export function VirtualAgentTab() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<VirtualAgentConfig | null>(null);
  const [expandedConversation, setExpandedConversation] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"configs" | "conversations">("configs");
  const [dialogTab, setDialogTab] = useState("general");

  const [formData, setFormData] = useState({
    name: "",
    language: "sk",
    greetingText: "Momentálne nie je dostupný žiadny operátor. Som virtuálna asistentka, ako vám môžem pomôcť?",
    systemPrompt: "Si virtuálna asistentka spoločnosti zaoberajúcej sa uchovávaním pupočníkovej krvi. Zbieraj informácie od volajúceho: meno, kontakt, dôvod volania. Buď stručná a profesionálna. Ak je zákazník známy, oslovuj ho menom a využívaj dostupné údaje o posledných hovoroch, emailoch alebo SMS. Odpovedaj v slovenčine.",
    ttsVoice: "nova",
    ttsModel: "tts-1",
    ttsSpeed: "1.05",
    gptModel: "gpt-4o-mini",
    gptTemperature: "0.5",
    gptMaxTokens: 100,
    maxTurns: 6,
    maxRecordingSeconds: 30,
    silenceTimeoutSeconds: 2,
    farewellText: "Ďakujem za informácie. Operátor vás bude kontaktovať. Dovidenia.",
    websiteUrl: "",
    isActive: true,
  });

  const { data: configs = [], isLoading: configsLoading } = useQuery<VirtualAgentConfig[]>({
    queryKey: ["/api/virtual-agent-configs"],
  });

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<VirtualAgentConversation[]>({
    queryKey: ["/api/virtual-agent-conversations"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/virtual-agent-configs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/virtual-agent-configs"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Konfigurácia vytvorená" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await apiRequest("PATCH", `/api/virtual-agent-configs/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/virtual-agent-configs"] });
      setIsDialogOpen(false);
      setEditingConfig(null);
      resetForm();
      toast({ title: "Konfigurácia aktualizovaná" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/virtual-agent-configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/virtual-agent-configs"] });
      toast({ title: "Konfigurácia vymazaná" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      language: "sk",
      greetingText: "Momentálne nie je dostupný žiadny operátor. Som virtuálna asistentka, ako vám môžem pomôcť?",
      systemPrompt: "Si virtuálna asistentka spoločnosti zaoberajúcej sa uchovávaním pupočníkovej krvi. Zbieraj informácie od volajúceho: meno, kontakt, dôvod volania. Buď stručná a profesionálna. Ak je zákazník známy, oslovuj ho menom a využívaj dostupné údaje o posledných hovoroch, emailoch alebo SMS. Odpovedaj v slovenčine.",
      ttsVoice: "nova",
      ttsModel: "tts-1",
      ttsSpeed: "1.05",
      gptModel: "gpt-4o-mini",
      gptTemperature: "0.5",
      gptMaxTokens: 100,
      maxTurns: 6,
      maxRecordingSeconds: 30,
      silenceTimeoutSeconds: 2,
      farewellText: "Ďakujem za informácie. Operátor vás bude kontaktovať. Dovidenia.",
      websiteUrl: "",
      isActive: true,
    });
    setDialogTab("general");
  };

  const openEdit = (config: VirtualAgentConfig) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      language: config.language,
      greetingText: config.greetingText,
      systemPrompt: config.systemPrompt,
      ttsVoice: config.ttsVoice,
      ttsModel: (config as any).ttsModel || "tts-1",
      ttsSpeed: (config as any).ttsSpeed || "1.05",
      gptModel: (config as any).gptModel || "gpt-4o-mini",
      gptTemperature: (config as any).gptTemperature || "0.5",
      gptMaxTokens: (config as any).gptMaxTokens || 100,
      maxTurns: config.maxTurns,
      maxRecordingSeconds: config.maxRecordingSeconds,
      silenceTimeoutSeconds: config.silenceTimeoutSeconds,
      farewellText: config.farewellText,
      websiteUrl: (config as any).websiteUrl || "",
      isActive: config.isActive,
    });
    setDialogTab("general");
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Zadajte názov", variant: "destructive" });
      return;
    }
    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getSentimentBadge = (sentiment: string | null) => {
    switch (sentiment) {
      case "positive": return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Pozitívny</Badge>;
      case "negative": return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Negatívny</Badge>;
      default: return <Badge variant="secondary">Neutrálny</Badge>;
    }
  };

  const getUrgencyBadge = (urgency: string | null) => {
    switch (urgency) {
      case "high": return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Vysoká</Badge>;
      case "low": return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Nízka</Badge>;
      default: return <Badge variant="outline">Stredná</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeView === "configs" ? "default" : "outline"}
            onClick={() => setActiveView("configs")}
            data-testid="btn-va-configs"
          >
            <Bot className="h-4 w-4 mr-2" />
            Konfigurácie ({configs.length})
          </Button>
          <Button
            variant={activeView === "conversations" ? "default" : "outline"}
            onClick={() => setActiveView("conversations")}
            data-testid="btn-va-conversations"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Konverzácie ({conversations.length})
          </Button>
        </div>
        {activeView === "configs" && (
          <Button onClick={() => { resetForm(); setEditingConfig(null); setIsDialogOpen(true); }} data-testid="btn-add-va-config">
            <Plus className="h-4 w-4 mr-2" />
            Nová konfigurácia
          </Button>
        )}
      </div>

      {activeView === "configs" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {configsLoading && <Loader2 className="h-6 w-6 animate-spin" />}
          {configs.map((config) => (
            <Card key={config.id} data-testid={`card-va-config-${config.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    {config.name}
                  </CardTitle>
                  <Badge variant={config.isActive ? "default" : "secondary"}>
                    {config.isActive ? "Aktívny" : "Neaktívny"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="gap-1">
                    <Volume2 className="h-3 w-3" />
                    {TTS_VOICES.find(v => v.value === config.ttsVoice)?.label || config.ttsVoice}
                  </Badge>
                  <Badge variant="outline">
                    {LANGUAGES.find(l => l.value === config.language)?.label || config.language}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Cpu className="h-3 w-3" />
                    {(config as any).gptModel || "gpt-4o-mini"}
                  </Badge>
                  <Badge variant="outline">
                    Max {config.maxTurns} výmen
                  </Badge>
                  {(config as any).websiteUrl && (
                    <Badge variant="outline" className="gap-1">
                      <Globe className="h-3 w-3" />
                      Web
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 italic">
                  „{config.greetingText}"
                </p>
                <div className="flex gap-1 justify-end">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(config)} data-testid={`btn-edit-va-${config.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(config.id)} data-testid={`btn-delete-va-${config.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!configsLoading && configs.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm">Žiadne konfigurácie virtuálneho agenta</p>
              <p className="text-xs mt-1">Vytvorte prvú konfiguráciu na začatie</p>
            </div>
          )}
        </div>
      )}

      {activeView === "conversations" && (
        <div className="space-y-3">
          {conversationsLoading && <Loader2 className="h-6 w-6 animate-spin" />}
          {conversations.map((conv) => (
            <Card key={conv.id} data-testid={`card-va-conv-${conv.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm font-medium">{conv.callerNumber}</span>
                    {conv.callerName && <span className="text-sm text-muted-foreground">({conv.callerName})</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {getSentimentBadge(conv.sentiment)}
                    {getUrgencyBadge(conv.urgency)}
                    {conv.callbackRequested && (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 gap-1">
                        <Phone className="h-3 w-3" />
                        Spätné volanie
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {conv.createdAt ? format(new Date(conv.createdAt), "dd.MM.yyyy HH:mm") : "—"}
                  </span>
                  <span>{conv.durationSeconds}s</span>
                  <span>{conv.turns} výmen</span>
                  <Badge variant={conv.status === "completed" ? "default" : "secondary"} className="text-[10px]">
                    {conv.status === "completed" ? "Dokončená" : conv.status === "active" ? "Aktívna" : conv.status}
                  </Badge>
                </div>

                {conv.summary && (
                  <p className="text-sm text-muted-foreground mb-2">{conv.summary}</p>
                )}

                {conv.keyTopics && conv.keyTopics.length > 0 && (
                  <div className="flex gap-1 flex-wrap mb-2">
                    {conv.keyTopics.map((topic, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{topic}</Badge>
                    ))}
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => setExpandedConversation(expandedConversation === conv.id ? null : conv.id)}
                  data-testid={`btn-toggle-transcript-${conv.id}`}
                >
                  {expandedConversation === conv.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {expandedConversation === conv.id ? "Skryť prepis" : "Zobraziť prepis"}
                </Button>

                {expandedConversation === conv.id && conv.transcript && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-md space-y-2 text-sm">
                    {conv.transcript.split("\n\n").map((line, i) => {
                      const isAssistant = line.startsWith("Asistent:");
                      return (
                        <div key={i} className={`flex gap-2 ${isAssistant ? "" : "justify-end"}`}>
                          <div className={`max-w-[80%] p-2 rounded-lg text-xs ${
                            isAssistant
                              ? "bg-primary/10 text-foreground"
                              : "bg-blue-100 dark:bg-blue-900 text-foreground"
                          }`}>
                            <span className="font-semibold text-[10px] block mb-0.5">
                              {isAssistant ? "Asistent" : "Volajúci"}
                            </span>
                            {line.replace(/^(Asistent|Volajúci):\s*/, "")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {!conversationsLoading && conversations.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm">Zatiaľ žiadne konverzácie</p>
              <p className="text-xs mt-1">Konverzácie sa zobrazia po tom, čo virtuálny agent obslúži prvý hovor</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) { setEditingConfig(null); resetForm(); }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              {editingConfig ? "Upraviť konfiguráciu" : "Nová konfigurácia virtuálneho agenta"}
            </DialogTitle>
            <DialogDescription>
              Nastavte správanie AI hlasového bota pre obsluhu prichádzajúcich hovorov
            </DialogDescription>
          </DialogHeader>

          <Tabs value={dialogTab} onValueChange={setDialogTab}>
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="general" className="gap-1.5" data-testid="tab-va-general">
                <Settings className="h-3.5 w-3.5" />
                Základné
              </TabsTrigger>
              <TabsTrigger value="voice" className="gap-1.5" data-testid="tab-va-voice">
                <Volume2 className="h-3.5 w-3.5" />
                Hlas a reč
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5" data-testid="tab-va-ai">
                <Cpu className="h-3.5 w-3.5" />
                AI Model
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="gap-1.5" data-testid="tab-va-knowledge">
                <Globe className="h-3.5 w-3.5" />
                Znalosti
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Názov konfigurácie</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Napr. Hlavný virtuálny agent"
                    data-testid="input-va-name"
                  />
                  <FieldHint text="Interný identifikátor pre rozlíšenie viacerých agentov." />
                </div>
                <div className="space-y-1.5">
                  <Label>Jazyk konverzácie</Label>
                  <Select value={formData.language} onValueChange={(v) => setFormData({ ...formData, language: v })}>
                    <SelectTrigger data-testid="select-va-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(l => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldHint text="Jazyk pre rozpoznávanie reči (Whisper) aj generovanie odpovedí." />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Úvodný pozdrav</Label>
                <Textarea
                  value={formData.greetingText}
                  onChange={(e) => setFormData({ ...formData, greetingText: e.target.value })}
                  rows={3}
                  data-testid="input-va-greeting"
                />
                <FieldHint text="Prvá veta, ktorú agent povie volajúcemu ihneď po zdvihnutí. Systém automaticky pridá pozdrav podľa dennej doby a meno zákazníka (ak je známy)." />
                <div className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-xs space-y-1.5">
                  <div className="font-medium text-foreground flex items-center gap-1.5"><Info className="h-3.5 w-3.5 text-primary" /> Automatické oslovenie</div>
                  <p className="text-muted-foreground leading-relaxed">
                    Systém automaticky pred váš text pridá pozdrav podľa fázy dňa a meno zákazníka ak je nájdený v databáze:
                  </p>
                  <div className="space-y-0.5 text-muted-foreground pl-2 border-l-2 border-primary/30">
                    <div><span className="font-medium text-foreground">Ráno (5-12h):</span> „Dobré ráno, [Meno Priezvisko]. [váš text]"</div>
                    <div><span className="font-medium text-foreground">Popoludnie (12-18h):</span> „Dobrý deň, [Meno Priezvisko]. [váš text]"</div>
                    <div><span className="font-medium text-foreground">Večer (18-22h):</span> „Dobrý večer, [Meno Priezvisko]. [váš text]"</div>
                    <div><span className="font-medium text-foreground">Neznámy volajúci:</span> „Dobrý deň. [váš text]"</div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed pt-1">
                    <span className="font-medium text-foreground">Príklad:</span> Ak zadáte text <span className="italic">„Momentálne nie je dostupný operátor. Som virtuálna asistentka, ako vám môžem pomôcť?"</span> — zákazníkovi sa prehrá: <span className="italic text-foreground">„Dobré ráno, Peter Seman. Momentálne nie je dostupný operátor. Som virtuálna asistentka, ako vám môžem pomôcť?"</span>
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Systémové inštrukcie (prompt)</Label>
                <Textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  rows={5}
                  data-testid="input-va-prompt"
                />
                <FieldHint text="Hlavné inštrukcie pre AI. Definujú osobnosť, ciele a pravidlá agenta. Čím konkrétnejšie, tým lepšie odpovede." />
                <div className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-xs space-y-1.5">
                  <div className="font-medium text-foreground flex items-center gap-1.5"><Info className="h-3.5 w-3.5 text-primary" /> Prístup k zákazníckym údajom</div>
                  <p className="text-muted-foreground leading-relaxed">
                    Ak je volajúci nájdený v databáze zákazníkov (podľa telefónneho čísla), agent automaticky dostane tieto údaje a môže ich použiť v konverzácii:
                  </p>
                  <div className="space-y-0.5 text-muted-foreground pl-2 border-l-2 border-primary/30">
                    <div><span className="font-medium text-foreground">Meno a priezvisko</span> — oslovuje zákazníka menom</div>
                    <div><span className="font-medium text-foreground">Email a telefón</span> — vie potvrdiť kontaktné údaje</div>
                    <div><span className="font-medium text-foreground">Posledný hovor</span> — kto volal, kedy, smer, trvanie</div>
                    <div><span className="font-medium text-foreground">Posledný email</span> — predmet, odosielateľ, dátum</div>
                    <div><span className="font-medium text-foreground">Posledná SMS</span> — obsah, odosielateľ, dátum</div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed pt-1">
                    <span className="font-medium text-foreground">Príklad:</span> Zákazník sa spýta „Kto mi naposledy volal?" — agent odpovie: <span className="italic text-foreground">„Posledný hovor ste mali s Janou Novákovou dňa 24.2.2026."</span>
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Rozlúčkový text</Label>
                <Textarea
                  value={formData.farewellText}
                  onChange={(e) => setFormData({ ...formData, farewellText: e.target.value })}
                  rows={2}
                  data-testid="input-va-farewell"
                />
                <FieldHint text="Posledná veta pred ukončením hovoru. Prehráva sa po vyčerpaní max. počtu výmen alebo keď volajúci nemá ďalšie otázky." />
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Max. počet výmen</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={formData.maxTurns}
                    onChange={(e) => setFormData({ ...formData, maxTurns: parseInt(e.target.value) || 6 })}
                    data-testid="input-va-max-turns"
                  />
                  <FieldHint text="Koľko otázka-odpoveď cyklov prebehne, než agent automaticky ukončí hovor. Typicky 4-8." />
                </div>
                <div className="space-y-1.5">
                  <Label>Max. dĺžka nahrávky (s)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={formData.maxRecordingSeconds}
                    onChange={(e) => setFormData({ ...formData, maxRecordingSeconds: parseInt(e.target.value) || 30 })}
                    data-testid="input-va-max-rec"
                  />
                  <FieldHint text="Maximálna dĺžka jedného vstupu volajúceho v sekundách. Pre bežné odpovede stačí 15-30s." />
                </div>
                <div className="space-y-1.5">
                  <Label>Detekcia ticha (s)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    step={0.5}
                    value={formData.silenceTimeoutSeconds}
                    onChange={(e) => setFormData({ ...formData, silenceTimeoutSeconds: parseFloat(e.target.value) || 2 })}
                    data-testid="input-va-silence"
                  />
                  <FieldHint text="Koľko sekúnd ticha ukončí nahrávanie vstupu. Nižšia hodnota = rýchlejšia reakcia, ale môže prerušiť pomalších hovorcov. Odporúčané: 2s." />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-va-active"
                />
                <div>
                  <Label className="cursor-pointer">Aktívny agent</Label>
                  <p className="text-[11px] text-muted-foreground">Ak je vypnutý, agent nebude prijímať hovory aj keď je priradený ku queue.</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="voice" className="space-y-4 mt-4">
              <div className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Nastavenia hlasu ovplyvňujú ako znie AI agent. Počas čakania na odpoveď sa prehráva hudba z priradenej Inbound Queue (MOH). Rýchlejší TTS model = kratšia odozva.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Hlas (OpenAI TTS)</Label>
                <Select value={formData.ttsVoice} onValueChange={(v) => setFormData({ ...formData, ttsVoice: v })}>
                  <SelectTrigger data-testid="select-va-voice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TTS_VOICES.map(v => (
                      <SelectItem key={v.value} value={v.value}>
                        <div>
                          <span>{v.label}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">— {v.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldHint text="Vyberte hlas pre syntézu reči. Každý hlas má iný charakter a tón." />
              </div>

              <div className="space-y-1.5">
                <Label>TTS Model</Label>
                <Select value={formData.ttsModel} onValueChange={(v) => setFormData({ ...formData, ttsModel: v })}>
                  <SelectTrigger data-testid="select-va-tts-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TTS_MODELS.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        <div>
                          <span>{m.label}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">— {m.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldHint text="TTS-1 je rýchlejší a odporúčaný pre real-time konverzáciu. TTS-1 HD má lepšiu kvalitu zvuku, ale pridáva latenciu." />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Rýchlosť reči: {formData.ttsSpeed}x</Label>
                  <Badge variant="outline" className="text-xs">
                    {parseFloat(formData.ttsSpeed) < 0.9 ? "Pomalá" : parseFloat(formData.ttsSpeed) > 1.2 ? "Rýchla" : "Normálna"}
                  </Badge>
                </div>
                <Slider
                  value={[parseFloat(formData.ttsSpeed) || 1.05]}
                  onValueChange={([v]) => setFormData({ ...formData, ttsSpeed: v.toFixed(2) })}
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  data-testid="slider-va-tts-speed"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0.5x (pomalá)</span>
                  <span>1.0x (normálna)</span>
                  <span>2.0x (rýchla)</span>
                </div>
                <FieldHint text="Rýchlosť prehrávania reči. 1.0 = prirodzená rýchlosť. Zvýšenie na 1.1-1.2 môže zrýchliť dojem odozvy bez straty zrozumiteľnosti." />
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 mt-4">
              <div className="p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20">
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Tieto nastavenia priamo ovplyvňujú rýchlosť a kvalitu odpovedí AI. Pre najnižšiu latenciu použite GPT-4.1 Nano/Mini s nízkymi max tokenmi. Pre komplexnejšie konverzácie GPT-4o.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>AI Model (GPT)</Label>
                <Select value={formData.gptModel} onValueChange={(v) => setFormData({ ...formData, gptModel: v })}>
                  <SelectTrigger data-testid="select-va-gpt-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GPT_MODELS.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        <div className="flex items-center gap-2">
                          <span>{m.label}</span>
                          <span className="text-[10px] text-muted-foreground">— {m.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldHint text="Model pre generovanie odpovedí. GPT-4o Mini je najlepší pomer rýchlosť/kvalita. GPT-4.1 Nano má najnižšiu latenciu." />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Kreativita (temperature): {formData.gptTemperature}</Label>
                  <Badge variant="outline" className="text-xs">
                    {parseFloat(formData.gptTemperature) < 0.3 ? "Konzistentná" : parseFloat(formData.gptTemperature) > 0.7 ? "Kreatívna" : "Vyvážená"}
                  </Badge>
                </div>
                <Slider
                  value={[parseFloat(formData.gptTemperature) || 0.5]}
                  onValueChange={([v]) => setFormData({ ...formData, gptTemperature: v.toFixed(1) })}
                  min={0}
                  max={1.0}
                  step={0.1}
                  data-testid="slider-va-temperature"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0.0 (presné)</span>
                  <span>0.5 (vyvážené)</span>
                  <span>1.0 (kreatívne)</span>
                </div>
                <FieldHint text="Nízka hodnota = konzistentné a predvídateľné odpovede. Vysoká hodnota = rozmanitejšie, ale menej predvídateľné. Pre zákaznícky servis odporúčame 0.3-0.5." />
              </div>

              <div className="space-y-1.5">
                <Label>Max. dĺžka odpovede (tokeny)</Label>
                <Input
                  type="number"
                  min={30}
                  max={500}
                  value={formData.gptMaxTokens}
                  onChange={(e) => setFormData({ ...formData, gptMaxTokens: parseInt(e.target.value) || 100 })}
                  data-testid="input-va-max-tokens"
                />
                <FieldHint text="Maximálny počet tokenov (slov) v jednej odpovedi. Nižšia hodnota = kratšie a rýchlejšie odpovede. 50-80 pre stručné odpovede, 100-150 pre podrobnejšie. Priamo ovplyvňuje latenciu!" />
              </div>

              <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Odporúčané nastavenia pre najrýchlejšiu odozvu:
                </p>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 ml-5 list-disc">
                  <li>Model: GPT-4o Mini alebo GPT-4.1 Nano</li>
                  <li>Max tokeny: 60-80</li>
                  <li>Temperature: 0.3-0.5</li>
                  <li>TTS Model: TTS-1 (štandard)</li>
                  <li>Rýchlosť reči: 1.05-1.15x</li>
                  <li>Detekcia ticha: 2s</li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="knowledge" className="space-y-4 mt-4">
              <div className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
                <div className="flex items-start gap-2">
                  <Globe className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Zadajte URL webstránky spoločnosti a agent automaticky načíta obsah (služby, ceny, kontakty atď.) a bude ho používať na zodpovedanie otázok volajúcich. Obsah sa cachuje na 24 hodín.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>URL webstránky spoločnosti</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                    placeholder="https://www.vasaspolocnost.sk"
                    data-testid="input-va-website-url"
                  />
                  {formData.websiteUrl && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => window.open(formData.websiteUrl, "_blank")}
                      title="Otvoriť v novom okne"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <FieldHint text="Agent automaticky prehľadá hlavnú stránku a relevantné podstránky (služby, ceny, kontakt, o nás). Obsah sa použije ako znalostná báza pre odpovedanie na otázky." />
              </div>

              {editingConfig && (editingConfig as any).websiteUrl && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Stav znalostnej bázy</p>
                      <p className="text-xs text-muted-foreground">
                        {(editingConfig as any).websiteLastFetched
                          ? `Posledná aktualizácia: ${format(new Date((editingConfig as any).websiteLastFetched), "dd.MM.yyyy HH:mm")}`
                          : "Obsah ešte nebol načítaný"
                        }
                      </p>
                      {(editingConfig as any).websiteContentCache && (
                        <p className="text-xs text-muted-foreground">
                          Veľkosť cache: {((editingConfig as any).websiteContentCache.length / 1024).toFixed(1)} KB
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          toast({ title: "Načítavam obsah webstránky..." });
                          const res = await apiRequest("POST", `/api/virtual-agent-configs/${editingConfig.id}/refresh-website`);
                          const result = await res.json();
                          if (result.success) {
                            toast({ title: `Načítané: ${result.pages} stránok, ${(result.chars / 1024).toFixed(1)} KB` });
                            queryClient.invalidateQueries({ queryKey: ["/api/virtual-agent-configs"] });
                          } else {
                            toast({ title: result.error || "Nepodarilo sa načítať", variant: "destructive" });
                          }
                        } catch {
                          toast({ title: "Chyba pri načítaní", variant: "destructive" });
                        }
                      }}
                      data-testid="btn-refresh-website"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Obnoviť teraz
                    </Button>
                  </div>

                  {(editingConfig as any).websiteContentCache && (
                    <div className="space-y-1.5">
                      <Label>Náhľad načítaného obsahu</Label>
                      <div className="max-h-[200px] overflow-y-auto p-3 rounded-lg border bg-muted/20 text-xs font-mono whitespace-pre-wrap">
                        {(editingConfig as any).websiteContentCache.substring(0, 2000)}
                        {(editingConfig as any).websiteContentCache.length > 2000 && "\n...(skrátené)"}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs space-y-1.5">
                <div className="font-medium text-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-primary" /> Ako to funguje
                </div>
                <ul className="text-muted-foreground space-y-0.5 ml-5 list-disc">
                  <li>Agent prehľadá hlavnú stránku a automaticky nájde relevantné podstránky (služby, cenník, kontakt, FAQ atď.)</li>
                  <li>Extrahovaný text sa uloží ako znalostná báza a cachuje na 24 hodín</li>
                  <li>Keď sa volajúci opýta na služby, ceny alebo kontakt, agent hľadá odpoveď v texte webstránky</li>
                  <li>Obsah sa automaticky obnoví po 24 hodinách alebo manuálne tlačidlom „Obnoviť"</li>
                  <li>Maximálna veľkosť cache je 12 KB — dlhšie texty sa automaticky skrátia</li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>

          <Separator />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Zrušiť</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="btn-save-va-config"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingConfig ? "Uložiť zmeny" : "Vytvoriť"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
