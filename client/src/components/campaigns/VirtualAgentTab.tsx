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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Bot, Plus, Pencil, Trash2, Phone, Clock, MessageSquare, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Loader2, Volume2 } from "lucide-react";
import { format } from "date-fns";
import type { VirtualAgentConfig, VirtualAgentConversation } from "@shared/schema";

const TTS_VOICES = [
  { value: "nova", label: "Nova (ženský)" },
  { value: "shimmer", label: "Shimmer (ženský)" },
  { value: "alloy", label: "Alloy (neutrálny)" },
  { value: "coral", label: "Coral (ženský)" },
  { value: "sage", label: "Sage (ženský)" },
  { value: "onyx", label: "Onyx (mužský)" },
  { value: "echo", label: "Echo (mužský)" },
  { value: "fable", label: "Fable (mužský)" },
  { value: "ash", label: "Ash (mužský)" },
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

export function VirtualAgentTab() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<VirtualAgentConfig | null>(null);
  const [expandedConversation, setExpandedConversation] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"configs" | "conversations">("configs");

  const [formData, setFormData] = useState({
    name: "",
    language: "sk",
    greetingText: "Dobrý deň, momentálne nie je dostupný žiadny operátor. Som virtuálny asistent, ako vám môžem pomôcť?",
    systemPrompt: "Si virtuálny asistent spoločnosti zaoberajúcej sa uchovávaním pupočníkovej krvi. Zbieraj informácie od volajúceho: meno, kontakt, dôvod volania. Buď stručný a profesionálny. Odpovedaj v slovenčine.",
    ttsVoice: "nova",
    maxTurns: 6,
    maxRecordingSeconds: 30,
    silenceTimeoutSeconds: 3,
    farewellText: "Ďakujem za informácie. Operátor vás bude kontaktovať. Dovidenia.",
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
      greetingText: "Dobrý deň, momentálne nie je dostupný žiadny operátor. Som virtuálny asistent, ako vám môžem pomôcť?",
      systemPrompt: "Si virtuálny asistent spoločnosti zaoberajúcej sa uchovávaním pupočníkovej krvi. Zbieraj informácie od volajúceho: meno, kontakt, dôvod volania. Buď stručný a profesionálny. Odpovedaj v slovenčine.",
      ttsVoice: "nova",
      maxTurns: 6,
      maxRecordingSeconds: 30,
      silenceTimeoutSeconds: 3,
      farewellText: "Ďakujem za informácie. Operátor vás bude kontaktovať. Dovidenia.",
      isActive: true,
    });
  };

  const openEdit = (config: VirtualAgentConfig) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      language: config.language,
      greetingText: config.greetingText,
      systemPrompt: config.systemPrompt,
      ttsVoice: config.ttsVoice,
      maxTurns: config.maxTurns,
      maxRecordingSeconds: config.maxRecordingSeconds,
      silenceTimeoutSeconds: config.silenceTimeoutSeconds,
      farewellText: config.farewellText,
      isActive: config.isActive,
    });
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
                  <Badge variant="outline">
                    Max {config.maxTurns} výmen
                  </Badge>
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
                              {isAssistant ? "🤖 Asistent" : "👤 Volajúci"}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              {editingConfig ? "Upraviť konfiguráciu" : "Nová konfigurácia virtuálneho agenta"}
            </DialogTitle>
            <DialogDescription>
              Nastavte správanie AI hlasového bota pre obsluhu prichádzajúcich hovorov
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Názov</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Napr. Hlavný virtuálny agent"
                  data-testid="input-va-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Jazyk</Label>
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
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Hlas (TTS)</Label>
              <Select value={formData.ttsVoice} onValueChange={(v) => setFormData({ ...formData, ttsVoice: v })}>
                <SelectTrigger data-testid="select-va-voice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TTS_VOICES.map(v => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Úvodný pozdrav</Label>
              <Textarea
                value={formData.greetingText}
                onChange={(e) => setFormData({ ...formData, greetingText: e.target.value })}
                rows={3}
                data-testid="input-va-greeting"
              />
              <p className="text-xs text-muted-foreground">Text, ktorý agent povie na začiatku hovoru</p>
            </div>

            <div className="space-y-1.5">
              <Label>Systémové inštrukcie (prompt)</Label>
              <Textarea
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                rows={4}
                data-testid="input-va-prompt"
              />
              <p className="text-xs text-muted-foreground">Inštrukcie pre AI, ktoré definujú správanie agenta</p>
            </div>

            <div className="space-y-1.5">
              <Label>Rozlúčkový text</Label>
              <Textarea
                value={formData.farewellText}
                onChange={(e) => setFormData({ ...formData, farewellText: e.target.value })}
                rows={2}
                data-testid="input-va-farewell"
              />
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Max výmen</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={formData.maxTurns}
                  onChange={(e) => setFormData({ ...formData, maxTurns: parseInt(e.target.value) || 6 })}
                  data-testid="input-va-max-turns"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max nahrávania (s)</Label>
                <Input
                  type="number"
                  min={5}
                  max={120}
                  value={formData.maxRecordingSeconds}
                  onChange={(e) => setFormData({ ...formData, maxRecordingSeconds: parseInt(e.target.value) || 30 })}
                  data-testid="input-va-max-rec"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ticho timeout (s)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.silenceTimeoutSeconds}
                  onChange={(e) => setFormData({ ...formData, silenceTimeoutSeconds: parseInt(e.target.value) || 3 })}
                  data-testid="input-va-silence"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-va-active"
              />
              <Label>Aktívny</Label>
            </div>

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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
