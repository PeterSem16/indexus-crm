import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Phone, Mail, Play, CheckCircle, ArrowRight, Trash2,
  Clock, Users, BarChart3, Pencil, Eye, ChevronRight, Layers
} from "lucide-react";
import type { CampaignPhase, CampaignContactPhase } from "@shared/schema";

const phasesT: Record<string, Record<string, string>> = {
  sk: {
    title: "Fázy kampane",
    addPhase: "Pridať fázu",
    noPhases: "Žiadne fázy. Vytvorte prvú fázu kampane.",
    phaseName: "Názov fázy",
    phaseType: "Typ",
    phone: "Telefón",
    email: "Email",
    draft: "Koncept",
    active: "Aktívna",
    completed: "Dokončená",
    evaluating: "Vyhodnocovanie",
    activate: "Aktivovať",
    evaluate: "Vyhodnotiť",
    transition: "Presunúť kontakty",
    delete: "Zmazať",
    edit: "Upraviť",
    contacts: "Kontakty",
    total: "Celkom",
    pending: "Čakajúce",
    inProgress: "Prebiehajúce",
    completedCount: "Dokončené",
    skipped: "Preskočené",
    results: "Výsledky",
    noContacts: "Žiadne kontakty v tejto fáze",
    createPhase: "Vytvoriť fázu",
    editPhase: "Upraviť fázu",
    save: "Uložiť",
    cancel: "Zrušiť",
    phaseNumber: "Poradie",
    evaluationDate: "Dátum vyhodnotenia",
    transitionTitle: "Prechod kontaktov do ďalšej fázy",
    targetPhase: "Cieľová fáza",
    includeStatuses: "Zahrnúť statusy (oddelené čiarkou)",
    excludeStatuses: "Vylúčiť statusy (oddelené čiarkou)",
    transitioned: "presunutých",
    of: "z",
    phaseTimeline: "Timeline kontaktu",
    viewContacts: "Zobraziť kontakty",
    customer: "Zákazník",
    hospital: "Nemocnica",
    clinic: "Klinika",
    contactName: "Meno",
    contactResult: "Výsledok",
    contactStatus: "Stav",
    phase: "Fáza",
    enteredAt: "Vstup do fázy",
    completedAt: "Dokončené",
  },
  en: {
    title: "Campaign Phases",
    addPhase: "Add Phase",
    noPhases: "No phases. Create the first campaign phase.",
    phaseName: "Phase Name",
    phaseType: "Type",
    phone: "Phone",
    email: "Email",
    draft: "Draft",
    active: "Active",
    completed: "Completed",
    evaluating: "Evaluating",
    activate: "Activate",
    evaluate: "Evaluate",
    transition: "Transition Contacts",
    delete: "Delete",
    edit: "Edit",
    contacts: "Contacts",
    total: "Total",
    pending: "Pending",
    inProgress: "In Progress",
    completedCount: "Completed",
    skipped: "Skipped",
    results: "Results",
    noContacts: "No contacts in this phase",
    createPhase: "Create Phase",
    editPhase: "Edit Phase",
    save: "Save",
    cancel: "Cancel",
    phaseNumber: "Order",
    evaluationDate: "Evaluation Date",
    transitionTitle: "Transition contacts to next phase",
    targetPhase: "Target Phase",
    includeStatuses: "Include statuses (comma separated)",
    excludeStatuses: "Exclude statuses (comma separated)",
    transitioned: "transitioned",
    of: "of",
    phaseTimeline: "Contact Timeline",
    viewContacts: "View Contacts",
    customer: "Customer",
    hospital: "Hospital",
    clinic: "Clinic",
    contactName: "Name",
    contactResult: "Result",
    contactStatus: "Status",
    phase: "Phase",
    enteredAt: "Entered Phase",
    completedAt: "Completed",
  },
};

interface PhaseWithStats extends CampaignPhase {
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    skipped: number;
    results: Record<string, number>;
  };
}

interface EnrichedContactPhase extends CampaignContactPhase {
  contactType: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  dispositionCode?: string;
}

export default function CampaignPhasesTab({ campaignId }: { campaignId: string }) {
  const { language } = useI18n();
  const pt = phasesT[language] || phasesT.sk;
  const { toast } = useToast();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPhase, setEditingPhase] = useState<PhaseWithStats | null>(null);
  const [showTransitionDialog, setShowTransitionDialog] = useState<string | null>(null);
  const [viewContactsPhaseId, setViewContactsPhaseId] = useState<string | null>(null);
  const [viewTimelineContactId, setViewTimelineContactId] = useState<string | null>(null);
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newPhaseType, setNewPhaseType] = useState<"phone" | "email">("phone");
  const [newPhaseEvalDate, setNewPhaseEvalDate] = useState("");
  const [transitionTargetId, setTransitionTargetId] = useState("");
  const [transitionInclude, setTransitionInclude] = useState("");
  const [transitionExclude, setTransitionExclude] = useState("");

  const { data: phases = [], isLoading } = useQuery<PhaseWithStats[]>({
    queryKey: ["/api/campaigns", campaignId, "phases"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/phases`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: phaseContacts = [] } = useQuery<EnrichedContactPhase[]>({
    queryKey: ["/api/campaigns", campaignId, "phases", viewContactsPhaseId, "contacts"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/phases/${viewContactsPhaseId}/contacts`, { credentials: "include" }).then(r => r.json()),
    enabled: !!viewContactsPhaseId,
  });

  const { data: contactTimeline = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaignId, "contacts", viewTimelineContactId, "timeline"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/contacts/${viewTimelineContactId}/timeline`, { credentials: "include" }).then(r => r.json()),
    enabled: !!viewTimelineContactId,
  });

  const createPhaseMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/campaigns/${campaignId}/phases`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      setShowCreateDialog(false);
      setNewPhaseName("");
      setNewPhaseType("phone");
      setNewPhaseEvalDate("");
      toast({ title: pt.createPhase, description: "OK" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa vytvoriť fázu", variant: "destructive" });
    },
  });

  const updatePhaseMutation = useMutation({
    mutationFn: ({ phaseId, data }: { phaseId: string; data: any }) =>
      apiRequest("PATCH", `/api/campaigns/${campaignId}/phases/${phaseId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      setEditingPhase(null);
      toast({ title: pt.save, description: "OK" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa uložiť fázu", variant: "destructive" });
    },
  });

  const deletePhaseMutation = useMutation({
    mutationFn: (phaseId: string) => apiRequest("DELETE", `/api/campaigns/${campaignId}/phases/${phaseId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      toast({ title: pt.delete, description: "OK" });
    },
  });

  const activatePhaseMutation = useMutation({
    mutationFn: (phaseId: string) => apiRequest("POST", `/api/campaigns/${campaignId}/phases/${phaseId}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      toast({ title: pt.activate, description: "OK" });
    },
  });

  const evaluatePhaseMutation = useMutation({
    mutationFn: (phaseId: string) => apiRequest("POST", `/api/campaigns/${campaignId}/phases/${phaseId}/evaluate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      toast({ title: pt.evaluate, description: "OK" });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: ({ phaseId, data }: { phaseId: string; data: any }) =>
      apiRequest("POST", `/api/campaigns/${campaignId}/phases/${phaseId}/transition`, data),
    onSuccess: async (res) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "phases"] });
      setShowTransitionDialog(null);
      toast({ title: pt.transition, description: `${result.transitioned} ${pt.transitioned} ${pt.of} ${result.total}` });
    },
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "draft": return "secondary";
      case "active": return "default";
      case "completed": return "outline";
      case "evaluating": return "destructive";
      default: return "secondary";
    }
  };

  const statusLabel = (status: string) => {
    return (pt as any)[status] || status;
  };

  const typeIcon = (type: string) => {
    return type === "email" ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />;
  };

  const formatDate = (d: string | Date | null | undefined) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString(language === "sk" ? "sk-SK" : "en-US", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Clock className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">{pt.title}</h3>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} size="sm" data-testid="button-add-phase">
          <Plus className="w-4 h-4 mr-2" />
          {pt.addPhase}
        </Button>
      </div>

      {phases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>{pt.noPhases}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {phases.map((phase, idx) => (
              <div key={phase.id} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 min-w-[120px] cursor-pointer transition-colors ${
                    phase.status === "active" ? "border-primary bg-primary/5" :
                    phase.status === "completed" ? "border-green-500 bg-green-50 dark:bg-green-950" :
                    phase.status === "evaluating" ? "border-orange-500 bg-orange-50 dark:bg-orange-950" :
                    "border-border"
                  }`}
                  onClick={() => setViewContactsPhaseId(phase.id)}
                  data-testid={`phase-card-${phase.id}`}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-muted-foreground">#{phase.phaseNumber}</span>
                    {typeIcon(phase.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{phase.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge variant={statusColor(phase.status)} className="text-[10px] px-1.5 py-0">
                        {statusLabel(phase.status)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{phase.stats.total} {pt.contacts.toLowerCase()}</span>
                    </div>
                  </div>
                </div>
                {idx < phases.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {phases.map((phase) => (
              <Card key={phase.id} className={phase.status === "active" ? "ring-2 ring-primary" : ""} data-testid={`phase-detail-${phase.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-muted-foreground">#{phase.phaseNumber}</span>
                      {typeIcon(phase.type)}
                      <CardTitle className="text-base">{phase.name}</CardTitle>
                    </div>
                    <Badge variant={statusColor(phase.status)}>{statusLabel(phase.status)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">{pt.total}:</span>
                      <span className="font-medium">{phase.stats.total}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-yellow-500" />
                      <span className="text-muted-foreground">{pt.pending}:</span>
                      <span className="font-medium">{phase.stats.pending}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Play className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-muted-foreground">{pt.inProgress}:</span>
                      <span className="font-medium">{phase.stats.inProgress}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-muted-foreground">{pt.completedCount}:</span>
                      <span className="font-medium">{phase.stats.completed}</span>
                    </div>
                  </div>

                  {Object.keys(phase.stats.results).length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">{pt.results}:</span>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(phase.stats.results).map(([result, count]) => (
                          <Badge key={result} variant="outline" className="text-[10px]">
                            {result}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {phase.evaluationAt && (
                    <div className="text-xs text-muted-foreground">
                      {pt.evaluationDate}: {formatDate(phase.evaluationAt)}
                    </div>
                  )}

                  {phase.stats.total > 0 && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${Math.round((phase.stats.completed / Math.max(phase.stats.total, 1)) * 100)}%` }}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {phase.status === "draft" && (
                      <Button size="sm" variant="default" onClick={() => activatePhaseMutation.mutate(phase.id)} data-testid={`button-activate-${phase.id}`}>
                        <Play className="w-3.5 h-3.5 mr-1" />
                        {pt.activate}
                      </Button>
                    )}
                    {phase.status === "active" && (
                      <Button size="sm" variant="default" onClick={() => evaluatePhaseMutation.mutate(phase.id)} data-testid={`button-evaluate-${phase.id}`}>
                        <BarChart3 className="w-3.5 h-3.5 mr-1" />
                        {pt.evaluate}
                      </Button>
                    )}
                    {(phase.status === "evaluating" || phase.status === "completed") && phases.length > 1 && (
                      <Button size="sm" variant="outline" onClick={() => {
                        setShowTransitionDialog(phase.id);
                        setTransitionTargetId("");
                        setTransitionInclude("");
                        setTransitionExclude("");
                      }} data-testid={`button-transition-${phase.id}`}>
                        <ArrowRight className="w-3.5 h-3.5 mr-1" />
                        {pt.transition}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setViewContactsPhaseId(phase.id)} data-testid={`button-view-contacts-${phase.id}`}>
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      {pt.viewContacts}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditingPhase(phase);
                      setNewPhaseName(phase.name);
                      setNewPhaseType(phase.type as "phone" | "email");
                      setNewPhaseEvalDate(phase.evaluationAt ? new Date(phase.evaluationAt).toISOString().slice(0, 16) : "");
                    }} data-testid={`button-edit-${phase.id}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {phase.status === "draft" && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deletePhaseMutation.mutate(phase.id)} data-testid={`button-delete-${phase.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={showCreateDialog || !!editingPhase} onOpenChange={(open) => {
        if (!open) { setShowCreateDialog(false); setEditingPhase(null); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPhase ? pt.editPhase : pt.createPhase}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{pt.phaseName}</Label>
              <Input
                value={newPhaseName}
                onChange={(e) => setNewPhaseName(e.target.value)}
                placeholder={pt.phaseName}
                data-testid="input-phase-name"
              />
            </div>
            <div>
              <Label>{pt.phaseType}</Label>
              <Select value={newPhaseType} onValueChange={(v) => setNewPhaseType(v as "phone" | "email")}>
                <SelectTrigger data-testid="select-phase-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone"><div className="flex items-center gap-2"><Phone className="w-4 h-4" />{pt.phone}</div></SelectItem>
                  <SelectItem value="email"><div className="flex items-center gap-2"><Mail className="w-4 h-4" />{pt.email}</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{pt.evaluationDate}</Label>
              <Input
                type="datetime-local"
                value={newPhaseEvalDate}
                onChange={(e) => setNewPhaseEvalDate(e.target.value)}
                data-testid="input-phase-eval-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingPhase(null); }}>{pt.cancel}</Button>
            <Button
              onClick={() => {
                if (!newPhaseName.trim()) return;
                if (editingPhase) {
                  updatePhaseMutation.mutate({
                    phaseId: editingPhase.id,
                    data: {
                      name: newPhaseName,
                      type: newPhaseType,
                      evaluationAt: newPhaseEvalDate || null,
                    }
                  });
                } else {
                  createPhaseMutation.mutate({
                    name: newPhaseName,
                    type: newPhaseType,
                    evaluationAt: newPhaseEvalDate || null,
                  });
                }
              }}
              disabled={!newPhaseName.trim()}
              data-testid="button-save-phase"
            >
              {pt.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showTransitionDialog} onOpenChange={(open) => { if (!open) setShowTransitionDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pt.transitionTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{pt.targetPhase}</Label>
              <Select value={transitionTargetId} onValueChange={setTransitionTargetId}>
                <SelectTrigger data-testid="select-target-phase">
                  <SelectValue placeholder={pt.targetPhase} />
                </SelectTrigger>
                <SelectContent>
                  {phases.filter(p => p.id !== showTransitionDialog).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      #{p.phaseNumber} {p.name} ({pt[p.type]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{pt.includeStatuses}</Label>
              <Input
                value={transitionInclude}
                onChange={(e) => setTransitionInclude(e.target.value)}
                placeholder="opened, clicked, interested, callback"
                data-testid="input-include-statuses"
              />
            </div>
            <div>
              <Label>{pt.excludeStatuses}</Label>
              <Input
                value={transitionExclude}
                onChange={(e) => setTransitionExclude(e.target.value)}
                placeholder="bounced, unsubscribed, refused"
                data-testid="input-exclude-statuses"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransitionDialog(null)}>{pt.cancel}</Button>
            <Button
              onClick={() => {
                if (!showTransitionDialog || !transitionTargetId) return;
                const includeArr = transitionInclude ? transitionInclude.split(",").map(s => s.trim()).filter(Boolean) : undefined;
                const excludeArr = transitionExclude ? transitionExclude.split(",").map(s => s.trim()).filter(Boolean) : undefined;
                transitionMutation.mutate({
                  phaseId: showTransitionDialog,
                  data: {
                    targetPhaseId: transitionTargetId,
                    includeStatuses: includeArr && includeArr.length > 0 ? includeArr : undefined,
                    excludeStatuses: excludeArr && excludeArr.length > 0 ? excludeArr : undefined,
                  }
                });
              }}
              disabled={!transitionTargetId || transitionMutation.isPending}
              data-testid="button-execute-transition"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              {pt.transition}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewContactsPhaseId} onOpenChange={(open) => { if (!open) setViewContactsPhaseId(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {phases.find(p => p.id === viewContactsPhaseId)?.name} — {pt.contacts}
            </DialogTitle>
          </DialogHeader>
          {phaseContacts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{pt.noContacts}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">{pt.contactName}</th>
                    <th className="text-left py-2 px-2">{pt.phaseType}</th>
                    <th className="text-left py-2 px-2">{pt.contactStatus}</th>
                    <th className="text-left py-2 px-2">{pt.contactResult}</th>
                    <th className="text-left py-2 px-2">{pt.enteredAt}</th>
                    <th className="text-right py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {phaseContacts.map((cp) => (
                    <tr key={cp.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{cp.contactName || "-"}</span>
                          <Badge variant="outline" className="text-[10px] ml-1">
                            {(pt as any)[cp.contactType] || cp.contactType}
                          </Badge>
                        </div>
                        {cp.contactEmail && <div className="text-xs text-muted-foreground">{cp.contactEmail}</div>}
                      </td>
                      <td className="py-2 px-2">
                        {typeIcon(phases.find(p => p.id === viewContactsPhaseId)?.type || "phone")}
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant={cp.status === "completed" ? "default" : "secondary"} className="text-xs">
                          {statusLabel(cp.status)}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        {cp.result ? (
                          <Badge variant="outline" className="text-xs">{cp.result}</Badge>
                        ) : "-"}
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        {formatDate(cp.enteredAt)}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setViewTimelineContactId(cp.contactId)} data-testid={`button-timeline-${cp.contactId}`}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewTimelineContactId} onOpenChange={(open) => { if (!open) setViewTimelineContactId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{pt.phaseTimeline}</DialogTitle>
          </DialogHeader>
          <div className="space-y-0">
            {contactTimeline.map((entry: any, idx: number) => (
              <div key={entry.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    entry.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                    entry.status === "in_progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {entry.phaseNumber || idx + 1}
                  </div>
                  {idx < contactTimeline.length - 1 && (
                    <div className="w-0.5 h-12 bg-border" />
                  )}
                </div>
                <div className="pb-6">
                  <div className="font-medium text-sm">{entry.phaseName || `${pt.phase} ${entry.phaseNumber}`}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {entry.phaseType && typeIcon(entry.phaseType)}
                    <Badge variant={entry.status === "completed" ? "default" : "secondary"} className="text-[10px]">
                      {statusLabel(entry.status)}
                    </Badge>
                    {entry.result && (
                      <Badge variant="outline" className="text-[10px]">{entry.result}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {pt.enteredAt}: {formatDate(entry.enteredAt)}
                    {entry.completedAt && <span className="ml-2">| {pt.completedAt}: {formatDate(entry.completedAt)}</span>}
                  </div>
                </div>
              </div>
            ))}
            {contactTimeline.length === 0 && (
              <p className="text-center text-muted-foreground py-4">{pt.noContacts}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}