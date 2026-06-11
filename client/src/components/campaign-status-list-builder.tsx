import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CLA_TEMPLATE, ROLE_BADGE_MAP } from "@/data/cla-template";
import {
  Plus, Trash2, ChevronDown, ChevronRight, GripVertical, Zap,
  ClipboardList, Mail, MessageSquare, Tag, Webhook, Bell,
  CheckSquare, Radio, Info, Loader2, Pencil, X, Check, Download,
  BookTemplate, ChevronUp,
} from "lucide-react";

type StatusListAutomation = {
  id: string;
  statusListItemId: string;
  sortOrder: number;
  actionType: string;
  targetRole: string | null;
  emailTemplateId: string | null;
  smsTemplateId: string | null;
  taskDescription: string | null;
  taskDeadlineOffset: string | null;
  taskPriority: string;
  conditionField: string | null;
  conditionOperator: string | null;
  conditionValue: string | null;
};

type StatusListItem = {
  id: string;
  campaignId: string;
  stepId: string;
  label: string;
  description: string | null;
  sortOrder: number;
  required: boolean;
  parentId: string | null;
  confirmationType: string;
  automations: StatusListAutomation[];
};

const ACTION_TYPE_OPTIONS = [
  { value: "assign_task", label: "Priradiť úlohu", icon: ClipboardList, color: "text-blue-500" },
  { value: "send_email_group", label: "Email skupne", icon: Mail, color: "text-green-500" },
  { value: "send_sms", label: "SMS zákazníkovi", icon: MessageSquare, color: "text-yellow-500" },
  { value: "set_contact_status", label: "Nastaviť status", icon: Tag, color: "text-purple-500" },
  { value: "notify_role", label: "Notifikovať rolu", icon: Bell, color: "text-orange-500" },
  { value: "sys_webhook", label: "Systémový webhook", icon: Webhook, color: "text-rose-500" },
];

const ROLE_OPTIONS = [
  { value: "role:back_office", label: "Back Office" },
  { value: "role:coordinator", label: "Koordinátor (KO)" },
  { value: "role:admin", label: "Administrator (DB Admin)" },
  { value: "role:manager", label: "Manager" },
  { value: "sys", label: "Systém (SYS)" },
];

const DEADLINE_OPTIONS = [
  { value: "+1h", label: "+1 hodina" },
  { value: "+4h", label: "+4 hodiny" },
  { value: "+24h", label: "+24 hodín (1 deň)" },
  { value: "+2d", label: "+2 dni" },
  { value: "+3d", label: "+3 dni" },
  { value: "+7d", label: "+7 dní" },
  { value: "+14d", label: "+14 dní" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Nízka" },
  { value: "medium", label: "Stredná" },
  { value: "high", label: "Vysoká" },
  { value: "urgent", label: "Urgentná" },
];

const CONFIRM_TYPE_OPTIONS = [
  { value: "checkbox", label: "Zaškrtávacie políčko", icon: CheckSquare },
  { value: "radio", label: "Výber (Radio)", icon: Radio },
  { value: "info", label: "Informácia (len čítanie)", icon: Info },
];

function getActionIcon(actionType: string) {
  const opt = ACTION_TYPE_OPTIONS.find(o => o.value === actionType);
  if (!opt) return <Zap className="h-3 w-3" />;
  const Icon = opt.icon;
  return <Icon className={`h-3 w-3 ${opt.color}`} />;
}

function getActionLabel(actionType: string) {
  return ACTION_TYPE_OPTIONS.find(o => o.value === actionType)?.label || actionType;
}

function getRoleLabel(role: string | null) {
  if (!role) return "—";
  return ROLE_OPTIONS.find(o => o.value === role)?.label || role;
}

function AutomationBadge({ automation }: { automation: StatusListAutomation }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border/50">
      {getActionIcon(automation.actionType)}
      <span className="text-muted-foreground">{getActionLabel(automation.actionType)}</span>
      {automation.targetRole && (
        <span className="font-medium">→ {getRoleLabel(automation.targetRole)}</span>
      )}
    </span>
  );
}

function AutomationForm({
  automation,
  itemId,
  campaignId,
  onSaved,
  onCancel,
}: {
  automation?: StatusListAutomation;
  itemId: string;
  campaignId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    actionType: automation?.actionType || "assign_task",
    targetRole: automation?.targetRole || "role:back_office",
    taskDescription: automation?.taskDescription || "",
    taskDeadlineOffset: automation?.taskDeadlineOffset || "+24h",
    taskPriority: automation?.taskPriority || "medium",
    emailTemplateId: automation?.emailTemplateId || "",
    smsTemplateId: automation?.smsTemplateId || "",
    conditionType: automation?.conditionField === "country" ? "country" : automation?.conditionField === "answer" ? "answer" : "always",
    conditionCountry: automation?.conditionField === "country" ? (automation?.conditionValue || "SK") : "SK",
    conditionAnswer: automation?.conditionField === "answer" ? (automation?.conditionValue || "") : "",
  });

  const isEdit = !!automation?.id;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        actionType: form.actionType,
        targetRole: form.targetRole || null,
        taskDescription: form.taskDescription || null,
        taskDeadlineOffset: form.taskDeadlineOffset || null,
        taskPriority: form.taskPriority,
        emailTemplateId: form.emailTemplateId || null,
        smsTemplateId: form.smsTemplateId || null,
        conditionField: form.conditionType === "always" ? null : form.conditionType,
        conditionOperator: form.conditionType === "always" ? null : "eq",
        conditionValue: form.conditionType === "always" ? null : (form.conditionType === "country" ? form.conditionCountry : (form.conditionAnswer || null)),
      };
      if (isEdit) {
        return apiRequest("PUT", `/api/campaigns/${campaignId}/status-list/${itemId}/automations/${automation.id}`, payload);
      }
      return apiRequest("POST", `/api/campaigns/${campaignId}/status-list/${itemId}/automations`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: isEdit ? "Automatizácia uložená" : "Automatizácia pridaná" });
      onSaved();
    },
    onError: () => toast({ title: "Chyba pri ukladaní", variant: "destructive" }),
  });

  const needsRole = ["assign_task", "send_email_group", "notify_role"].includes(form.actionType);
  const needsTask = form.actionType === "assign_task";
  const needsEmail = form.actionType === "send_email_group";

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {isEdit ? "Upraviť akciu" : "Nová akcia"}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold tracking-wide">POTOM</span>
        <span className="text-xs font-medium text-muted-foreground">Akcia ktorá sa vykoná</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-xs mb-1 block">Typ akcie</Label>
          <Select value={form.actionType} onValueChange={v => setForm(f => ({ ...f, actionType: v }))}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    <opt.icon className={`h-3.5 w-3.5 ${opt.color}`} />
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {needsRole && (
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">Cieľová rola</Label>
            <Select value={form.targetRole} onValueChange={v => setForm(f => ({ ...f, targetRole: v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {needsTask && (
          <>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Popis úlohy</Label>
              <Textarea
                className="text-xs min-h-[60px] resize-none"
                value={form.taskDescription}
                onChange={e => setForm(f => ({ ...f, taskDescription: e.target.value }))}
                placeholder="Popis úlohy pre Back Office / Koordinátora..."
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Termín</Label>
              <Select value={form.taskDeadlineOffset} onValueChange={v => setForm(f => ({ ...f, taskDeadlineOffset: v }))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEADLINE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Priorita</Label>
              <Select value={form.taskPriority} onValueChange={v => setForm(f => ({ ...f, taskPriority: v }))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {needsEmail && (
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">ID emailovej šablóny</Label>
            <Input
              className="h-8 text-xs"
              value={form.emailTemplateId}
              onChange={e => setForm(f => ({ ...f, emailTemplateId: e.target.value }))}
              placeholder="ID šablóny..."
            />
          </div>
        )}
      </div>

      <div className="border-t pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-bold tracking-wide">AK</span>
          <span className="text-xs font-medium text-muted-foreground">Podmienka (voliteľné)</span>
        </div>
        <Select value={form.conditionType} onValueChange={v => setForm(f => ({ ...f, conditionType: v }))}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="always">Vždy — pri každom potvrdení kroku</SelectItem>
            <SelectItem value="country">Krajina zákazníka je...</SelectItem>
            <SelectItem value="answer">Odpoveď zákazníka je...</SelectItem>
          </SelectContent>
        </Select>
        {form.conditionType === "country" && (
          <Select value={form.conditionCountry} onValueChange={v => setForm(f => ({ ...f, conditionCountry: v }))}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[{v:"SK",l:"Slovensko (SK)"},{v:"CZ",l:"Česko (CZ)"},{v:"HU",l:"Maďarsko (HU)"},{v:"RO",l:"Rumunsko (RO)"},{v:"AT",l:"Rakúsko (AT)"},{v:"DE",l:"Nemecko (DE)"},{v:"IT",l:"Taliansko (IT)"},{v:"US",l:"USA (US)"}].map(c => (
                <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {form.conditionType === "answer" && (
          <Input
            className="h-8 text-xs"
            value={form.conditionAnswer}
            onChange={e => setForm(f => ({ ...f, conditionAnswer: e.target.value }))}
            placeholder="Hodnota odpovede (napr. áno, nie, záujem...)"
          />
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">
          <X className="h-3 w-3 mr-1" /> Zrušiť
        </Button>
        <Button type="button" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="h-7 text-xs">
          {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
          Uložiť akciu
        </Button>
      </div>
    </div>
  );
}

function StatusListItemRow({
  item,
  campaignId,
  onDeleted,
}: {
  item: StatusListItem;
  campaignId: string;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [addingAutomation, setAddingAutomation] = useState(false);
  const [editingAutoId, setEditingAutoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    stepId: item.stepId,
    label: item.label,
    description: item.description || "",
    confirmationType: item.confirmationType,
    required: item.required,
  });

  const updateMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/campaigns/${campaignId}/status-list/${item.id}`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: "Krok uložený" });
      setEditMode(false);
    },
    onError: () => toast({ title: "Chyba pri ukladaní", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/campaigns/${campaignId}/status-list/${item.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: "Krok zmazaný" });
      onDeleted();
    },
    onError: () => toast({ title: "Chyba pri mazaní", variant: "destructive" }),
  });

  const deleteAutoMutation = useMutation({
    mutationFn: (autoId: string) => apiRequest("DELETE", `/api/campaigns/${campaignId}/status-list/${item.id}/automations/${autoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: "Automatizácia zmazaná" });
    },
    onError: () => toast({ title: "Chyba pri mazaní", variant: "destructive" }),
  });

  const ConfirmIcon = CONFIRM_TYPE_OPTIONS.find(o => o.value === item.confirmationType)?.icon || CheckSquare;

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 group">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 cursor-grab" />
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{item.stepId}</span>
          <ConfirmIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{item.label}</span>
          {item.required && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 shrink-0">Povinný</Badge>}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          {item.automations.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Zap className="h-3 w-3 text-amber-500" />
              {item.automations.length}
            </span>
          )}
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => { setEditMode(e => !e); setExpanded(true); }}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate()}>
            {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/10 px-3 py-3 space-y-3">
          {editMode ? (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">Krok ID</Label>
                  <Input className="h-8 text-xs font-mono" value={form.stepId} onChange={e => setForm(f => ({ ...f, stepId: e.target.value }))} placeholder="CLA-01" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs mb-1 block">Názov kroku</Label>
                  <Input className="h-8 text-xs" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Popis kroku..." />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Popis (voliteľný)</Label>
                <Textarea className="text-xs min-h-[50px] resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailný popis pre agenta..." />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-xs mb-1 block">Typ potvrdenia</Label>
                  <Select value={form.confirmationType} onValueChange={v => setForm(f => ({ ...f, confirmationType: v }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONFIRM_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-2">
                            <opt.icon className="h-3.5 w-3.5" />
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <Switch checked={form.required} onCheckedChange={v => setForm(f => ({ ...f, required: v }))} />
                  <Label className="text-xs">Povinný krok</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditMode(false)}>
                  <X className="h-3 w-3 mr-1" /> Zrušiť
                </Button>
                <Button type="button" size="sm" className="h-7 text-xs" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                  Uložiť krok
                </Button>
              </div>
            </div>
          ) : (
            <>
              {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
              <div className="flex flex-wrap gap-1">
                {item.automations.map(auto => (
                  <AutomationBadge key={auto.id} automation={auto} />
                ))}
              </div>
            </>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Zap className="h-3 w-3 text-amber-500" />
                Automatizácie pri potvrdení
              </span>
              <Button type="button" variant="outline" size="sm" className="h-6 text-xs gap-1 px-2" onClick={() => { setAddingAutomation(true); setEditingAutoId(null); }}>
                <Plus className="h-3 w-3" /> Pridať akciu
              </Button>
            </div>

            {item.automations.map(auto => (
              <div key={auto.id}>
                {editingAutoId === auto.id ? (
                  <AutomationForm
                    automation={auto}
                    itemId={item.id}
                    campaignId={campaignId}
                    onSaved={() => setEditingAutoId(null)}
                    onCancel={() => setEditingAutoId(null)}
                  />
                ) : (
                  <div className="flex items-start gap-2 p-2 rounded-md border bg-background group/auto text-xs">
                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                      {getActionIcon(auto.actionType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{getActionLabel(auto.actionType)}</div>
                      {auto.targetRole && <div className="text-muted-foreground">→ {getRoleLabel(auto.targetRole)}</div>}
                      {auto.taskDescription && <div className="text-muted-foreground truncate">{auto.taskDescription}</div>}
                      {auto.taskDeadlineOffset && <div className="text-muted-foreground">Termín: {DEADLINE_OPTIONS.find(d => d.value === auto.taskDeadlineOffset)?.label || auto.taskDeadlineOffset}</div>}
                      {auto.conditionField && (
                        <div className="text-muted-foreground text-[10px] flex items-center gap-1">
                          <span className="px-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-bold">AK</span>
                          {auto.conditionField === "country" ? `krajina = ${auto.conditionValue}` : `odpoveď = "${auto.conditionValue}"`}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover/auto:opacity-100 shrink-0">
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setEditingAutoId(auto.id); setAddingAutomation(false); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => deleteAutoMutation.mutate(auto.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {addingAutomation && (
              <AutomationForm
                itemId={item.id}
                campaignId={campaignId}
                onSaved={() => setAddingAutomation(false)}
                onCancel={() => setAddingAutomation(false)}
              />
            )}

            {item.automations.length === 0 && !addingAutomation && (
              <div className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-md">
                Žiadne automatizácie — krok sa len zaznamená bez ďalšej akcie
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddItemForm({
  campaignId,
  existingCount,
  onSaved,
  onCancel,
}: {
  campaignId: string;
  existingCount: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    stepId: `STEP-${String(existingCount + 1).padStart(2, "0")}`,
    label: "",
    description: "",
    confirmationType: "checkbox",
    required: false,
    sortOrder: existingCount,
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/campaigns/${campaignId}/status-list`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: "Krok pridaný" });
      onSaved();
    },
    onError: () => toast({ title: "Chyba pri pridávaní", variant: "destructive" }),
  });

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/20 border-primary/30">
      <div className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        Nový krok
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs mb-1 block">Krok ID</Label>
          <Input className="h-8 text-xs font-mono" value={form.stepId} onChange={e => setForm(f => ({ ...f, stepId: e.target.value }))} placeholder="CLA-01" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs mb-1 block">Názov kroku *</Label>
          <Input className="h-8 text-xs" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Popis kroku pre agenta..." autoFocus />
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">Popis (voliteľný)</Label>
        <Textarea className="text-xs min-h-[50px] resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailný popis alebo inštrukcie..." />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label className="text-xs mb-1 block">Typ potvrdenia</Label>
          <Select value={form.confirmationType} onValueChange={v => setForm(f => ({ ...f, confirmationType: v }))}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONFIRM_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    <opt.icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-4">
          <Switch checked={form.required} onCheckedChange={v => setForm(f => ({ ...f, required: v }))} />
          <Label className="text-xs">Povinný krok</Label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          <X className="h-3 w-3 mr-1" /> Zrušiť
        </Button>
        <Button type="button" size="sm" className="h-7 text-xs" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !form.label.trim()}>
          {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
          Pridať krok
        </Button>
      </div>
    </div>
  );
}

export function CampaignStatusListBuilder({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const [addingItem, setAddingItem] = useState(false);

  // Import z Disposition dialog
  const [importOpen, setImportOpen] = useState(false);
  const [selectedDisps, setSelectedDisps] = useState<Set<string>>(new Set());

  // CLA Template dialog
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateProgress, setTemplateProgress] = useState<string | null>(null);
  // stepId → selected (true/false)
  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(new Set(CLA_TEMPLATE.map(s => s.stepId)));
  // stepId → Set<triggerId>
  const [selectedAutos, setSelectedAutos] = useState<Map<string, Set<string>>>(() => {
    const m = new Map<string, Set<string>>();
    CLA_TEMPLATE.forEach(s => { m.set(s.stepId, new Set(s.automations.map(a => a.triggerId))); });
    return m;
  });
  // which steps are expanded to show automations
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const { data: items = [], isLoading } = useQuery<StatusListItem[]>({
    queryKey: ["/api/campaigns", campaignId, "status-list"],
    queryFn: () => apiRequest("GET", `/api/campaigns/${campaignId}/status-list`).then(r => r.json()),
    enabled: !!campaignId,
  });

  const { data: dispositions = [], isLoading: dispsLoading } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaignId, "dispositions"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/dispositions`, { credentials: "include" }).then(r => r.json()),
    enabled: importOpen,
  });

  // ── Disposition import mutation ──────────────────────────────────────
  const importMutation = useMutation({
    mutationFn: async () => {
      const toImport = dispositions.filter((d: any) => selectedDisps.has(d.id));
      const existingCount = items.length;
      for (let i = 0; i < toImport.length; i++) {
        const d = toImport[i];
        await apiRequest("POST", `/api/campaigns/${campaignId}/status-list`, {
          stepId: d.code || `DISP-${String(existingCount + i + 1).padStart(2, "0")}`,
          label: d.name,
          description: d.description || "",
          confirmationType: "checkbox",
          required: false,
          sortOrder: existingCount + i,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      toast({ title: `${selectedDisps.size} položiek importovaných zo Disposície` });
      setSelectedDisps(new Set());
      setImportOpen(false);
    },
    onError: () => toast({ title: "Chyba pri importe", variant: "destructive" }),
  });

  // ── CLA Template apply mutation ──────────────────────────────────────
  const templateMutation = useMutation({
    mutationFn: async () => {
      const stepsToCreate = CLA_TEMPLATE.filter(s => selectedSteps.has(s.stepId));
      const base = items.length;
      for (let i = 0; i < stepsToCreate.length; i++) {
        const step = stepsToCreate[i];
        setTemplateProgress(`Vytváram krok ${i + 1}/${stepsToCreate.length}: ${step.stepId}…`);
        const res = await apiRequest("POST", `/api/campaigns/${campaignId}/status-list`, {
          stepId: step.stepId,
          label: step.label,
          description: [
            step.description,
            step.conditionIf ? `Podmienka: ${step.conditionIf}` : "",
            step.actionThen ? `Akcia: ${step.actionThen}` : "",
            step.callbackTiming && step.callbackTiming !== "—" ? `Timing: ${step.callbackTiming}` : "",
          ].filter(Boolean).join("\n"),
          confirmationType: step.confirmationType,
          required: false,
          sortOrder: base + i,
        });
        const created = await res.json();
        const itemId = created.id;
        if (!itemId) continue;

        const autoSet = selectedAutos.get(step.stepId) ?? new Set();
        const autosToCreate = step.automations.filter(a => autoSet.has(a.triggerId));
        for (const auto of autosToCreate) {
          await apiRequest("POST", `/api/campaigns/${campaignId}/status-list/${itemId}/automations`, {
            actionType: auto.actionType,
            targetRole: auto.targetRole,
            taskDescription: auto.taskDescription,
            taskDeadlineOffset: auto.taskDeadlineOffset,
            taskPriority: auto.taskPriority,
            sortOrder: 0,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] });
      setTemplateProgress(null);
      setTemplateOpen(false);
      const stepCount = selectedSteps.size;
      const autoCount = Array.from(selectedAutos.entries())
        .filter(([sid]) => selectedSteps.has(sid))
        .reduce((sum, [, aset]) => sum + aset.size, 0);
      toast({ title: `✅ Template aplikovaný: ${stepCount} krokov, ${autoCount} automatizácií` });
    },
    onError: () => { setTemplateProgress(null); toast({ title: "Chyba pri aplikovaní template", variant: "destructive" }); },
  });

  const toggleDisp = (id: string) => setSelectedDisps(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleStep = (sid: string) => setSelectedSteps(prev => { const n = new Set(prev); n.has(sid) ? n.delete(sid) : n.add(sid); return n; });
  const toggleAuto = (sid: string, tid: string) => setSelectedAutos(prev => {
    const n = new Map(prev);
    const s = new Set(n.get(sid) ?? []);
    s.has(tid) ? s.delete(tid) : s.add(tid);
    n.set(sid, s);
    return n;
  });
  const toggleExpand = (sid: string) => setExpandedSteps(prev => { const n = new Set(prev); n.has(sid) ? n.delete(sid) : n.add(sid); return n; });

  const selectAllSteps = () => {
    setSelectedSteps(new Set(CLA_TEMPLATE.map(s => s.stepId)));
    const m = new Map<string, Set<string>>();
    CLA_TEMPLATE.forEach(s => m.set(s.stepId, new Set(s.automations.map(a => a.triggerId))));
    setSelectedAutos(m);
  };
  const deselectAllSteps = () => { setSelectedSteps(new Set()); setSelectedAutos(new Map()); };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Načítavam status list...
      </div>
    );
  }

  const parentDisps = dispositions.filter((d: any) => !d.parentId && d.isActive);
  const childDisps = (parentId: string) => dispositions.filter((d: any) => d.parentId === parentId && d.isActive);

  const selectedStepCount = selectedSteps.size;
  const selectedAutoCount = Array.from(selectedAutos.entries())
    .filter(([sid]) => selectedSteps.has(sid))
    .reduce((sum, [, aset]) => sum + aset.size, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-emerald-500" />
            Kroky Status Listu
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Každý krok môže spustiť automatizáciu — priradiť úlohu, odoslať email, nastaviť status atď.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
            onClick={() => setTemplateOpen(true)}
            data-testid="btn-use-cla-template"
          >
            <BookTemplate className="h-3.5 w-3.5" />
            Template CL A
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => { setSelectedDisps(new Set()); setImportOpen(true); }}
            data-testid="btn-import-from-disposition"
          >
            <Download className="h-3.5 w-3.5" />
            Import z Disposition
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => setAddingItem(true)}
            data-testid="btn-add-status-list-item"
          >
            <Plus className="h-3.5 w-3.5" />
            Pridať krok
          </Button>
        </div>
      </div>

      {items.length === 0 && !addingItem && (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed rounded-lg text-muted-foreground">
          <ClipboardList className="h-8 w-8 mb-2 opacity-20" />
          <p className="text-sm font-medium">Status list je prázdny</p>
          <p className="text-xs mt-1">Použite template CL A alebo pridajte kroky manuálne</p>
          <div className="flex gap-2 mt-4">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950" onClick={() => setTemplateOpen(true)}>
              <BookTemplate className="h-3.5 w-3.5" />
              Template CL A — Akvizícia
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setAddingItem(true)}>
              <Plus className="h-3.5 w-3.5" />
              Pridať krok
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <StatusListItemRow
            key={item.id}
            item={item}
            campaignId={campaignId}
            onDeleted={() => {}}
          />
        ))}
      </div>

      {addingItem && (
        <AddItemForm
          campaignId={campaignId}
          existingCount={items.length}
          onSaved={() => setAddingItem(false)}
          onCancel={() => setAddingItem(false)}
        />
      )}

      {/* ── CLA Template Dialog ────────────────────────────────────────── */}
      <Dialog open={templateOpen} onOpenChange={v => { if (!templateMutation.isPending) setTemplateOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookTemplate className="h-5 w-5 text-emerald-500" />
              Template: CL A — Akvizícia (Medical Partner)
            </DialogTitle>
            <p className="text-xs text-muted-foreground pt-1">
              Vyberte kroky a k nim voliteľné automatizácie (AT triggre), ktoré sa majú vytvoriť v status liste tejto misie.
            </p>
          </DialogHeader>

          {/* Quick select bar */}
          <div className="flex items-center gap-2 px-1 py-1.5 border-b shrink-0">
            <button type="button" className="text-xs text-primary hover:underline" onClick={selectAllSteps}>Vybrať všetko</button>
            <span className="text-muted-foreground text-xs">·</span>
            <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={deselectAllSteps}>Odznačiť všetko</button>
            <span className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {selectedStepCount} krokov · {selectedAutoCount} akcií vybraných
            </span>
          </div>

          {/* Step list */}
          <div className="flex-1 overflow-y-auto space-y-1 py-1 min-h-0">
            {CLA_TEMPLATE.map((step) => {
              const isSelected = selectedSteps.has(step.stepId);
              const isExpanded = expandedSteps.has(step.stepId);
              const autoSet = selectedAutos.get(step.stepId) ?? new Set();
              const roleBadge = ROLE_BADGE_MAP[step.role] ?? { label: step.role, color: "bg-muted text-muted-foreground" };
              const isSys = step.confirmationType === "info";

              return (
                <div key={step.stepId} className={`rounded-lg border transition-colors ${isSelected ? "border-primary/30 bg-primary/5" : "border-border bg-background"}`}>
                  {/* Step header row */}
                  <div className="flex items-start gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleStep(step.stepId)}
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-primary border-primary" : "border-border"}`}
                      data-testid={`tpl-step-${step.stepId}`}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-muted-foreground">{step.stepId}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleBadge.color}`}>{roleBadge.label}</span>
                        {isSys && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">AUTO</span>}
                        <span className={`text-sm font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{step.description}</p>
                      {step.conditionIf && step.conditionIf !== "—" && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          <span className="font-semibold">IF:</span> {step.conditionIf}
                        </p>
                      )}
                      {step.nextStepId && (
                        <p className="text-[10px] text-muted-foreground/70">
                          <span className="font-semibold">→</span> {step.nextStepId}
                          {step.callbackTiming && step.callbackTiming !== "—" && ` · ${step.callbackTiming}`}
                        </p>
                      )}
                    </div>
                    {step.automations.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(step.stepId)}
                        className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded hover:bg-muted"
                        data-testid={`tpl-expand-${step.stepId}`}
                      >
                        <Zap className="h-3 w-3 text-amber-500" />
                        <span>{autoSet.size}/{step.automations.length} akcií</span>
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    )}
                  </div>

                  {/* Automations (expanded) */}
                  {isExpanded && step.automations.length > 0 && (
                    <div className="border-t border-border/50 px-3 py-2 space-y-1.5 bg-muted/30">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-1">
                        <Zap className="h-3 w-3 text-amber-500" />
                        Automatizácie tohto kroku (voliteľné)
                      </div>
                      {step.automations.map((auto) => {
                        const autoSelected = autoSet.has(auto.triggerId);
                        return (
                          <div
                            key={auto.triggerId}
                            className={`flex items-start gap-2 p-2 rounded-md border transition-colors ${autoSelected ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20" : "border-border/50 bg-background"}`}
                          >
                            <button
                              type="button"
                              onClick={() => { if (isSelected) toggleAuto(step.stepId, auto.triggerId); }}
                              disabled={!isSelected}
                              className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${autoSelected && isSelected ? "bg-amber-500 border-amber-500" : "border-border"} ${!isSelected ? "opacity-30 cursor-not-allowed" : ""}`}
                              data-testid={`tpl-auto-${step.stepId}-${auto.triggerId}`}
                            >
                              {autoSelected && isSelected && <Check className="h-2 w-2 text-white" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-mono text-muted-foreground">{auto.triggerId}</span>
                                <span className="text-xs font-medium">{auto.label}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{auto.description}</p>
                              {auto.taskDescription && (
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                                  📋 {auto.taskDescription}
                                </p>
                              )}
                              {auto.taskDeadlineOffset && (
                                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground mt-0.5">
                                  ⏱ {auto.taskDeadlineOffset}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress indicator */}
          {templateProgress && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 border-t shrink-0">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              {templateProgress}
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2 border-t pt-3 shrink-0">
            <span className="text-xs text-muted-foreground">
              {selectedStepCount} krokov · {selectedAutoCount} automatizácií
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setTemplateOpen(false)} disabled={templateMutation.isPending}>
                Zrušiť
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={selectedStepCount === 0 || templateMutation.isPending}
                onClick={() => templateMutation.mutate()}
                data-testid="btn-apply-cla-template"
              >
                {templateMutation.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <BookTemplate className="h-3.5 w-3.5" />
                }
                Aplikovať template ({selectedStepCount} krokov)
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import z Disposition Dialog ─────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-4 w-4 text-emerald-500" />
              Import zo Disposície
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-1 max-h-80 overflow-y-auto">
            {dispsLoading && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Načítavam...
              </div>
            )}
            {!dispsLoading && parentDisps.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Táto misia nemá žiadne disposície.
              </p>
            )}
            {parentDisps.map((d: any) => {
              const children = childDisps(d.id);
              return (
                <div key={d.id}>
                  <button
                    type="button"
                    onClick={() => toggleDisp(d.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors text-sm ${selectedDisps.has(d.id) ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                    data-testid={`import-disp-${d.id}`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedDisps.has(d.id) ? "bg-primary border-primary" : "border-border"}`}>
                      {selectedDisps.has(d.id) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </div>
                    <span className="font-medium flex-1">{d.name}</span>
                    {d.code && <span className="text-xs text-muted-foreground font-mono">{d.code}</span>}
                  </button>
                  {children.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleDisp(c.id)}
                      className={`w-full flex items-center gap-2.5 pl-8 pr-3 py-1.5 rounded-md text-left transition-colors text-sm ${selectedDisps.has(c.id) ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                      data-testid={`import-disp-${c.id}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedDisps.has(c.id) ? "bg-primary border-primary" : "border-border"}`}>
                        {selectedDisps.has(c.id) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <span className="flex-1">{c.name}</span>
                      {c.code && <span className="text-xs text-muted-foreground font-mono">{c.code}</span>}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          <DialogFooter className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{selectedDisps.size} vybraných</span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setImportOpen(false)}>Zrušiť</Button>
              <Button
                type="button"
                size="sm"
                disabled={selectedDisps.size === 0 || importMutation.isPending}
                onClick={() => importMutation.mutate()}
                data-testid="btn-confirm-import-dispositions"
              >
                {importMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                Importovať ({selectedDisps.size})
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
