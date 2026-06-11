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
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, ChevronDown, ChevronRight, GripVertical, Zap,
  ClipboardList, Mail, MessageSquare, Tag, Webhook, Bell,
  CheckSquare, Radio, Info, Loader2, Pencil, X, Check,
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
    conditionField: automation?.conditionField || "",
    conditionOperator: automation?.conditionOperator || "eq",
    conditionValue: automation?.conditionValue || "",
  });

  const isEdit = !!automation?.id;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        targetRole: form.targetRole || null,
        taskDescription: form.taskDescription || null,
        taskDeadlineOffset: form.taskDeadlineOffset || null,
        emailTemplateId: form.emailTemplateId || null,
        smsTemplateId: form.smsTemplateId || null,
        conditionField: form.conditionField || null,
        conditionOperator: form.conditionOperator || null,
        conditionValue: form.conditionValue || null,
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
        <div className="text-xs font-medium text-muted-foreground">Podmienka IF (voliteľné)</div>
        <div className="grid grid-cols-3 gap-1.5">
          <Input
            className="h-7 text-xs"
            value={form.conditionField}
            onChange={e => setForm(f => ({ ...f, conditionField: e.target.value }))}
            placeholder="Pole (napr. country)"
          />
          <Select value={form.conditionOperator} onValueChange={v => setForm(f => ({ ...f, conditionOperator: v }))}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eq">= rovná sa</SelectItem>
              <SelectItem value="neq">≠ nerovná sa</SelectItem>
              <SelectItem value="in">∈ obsahuje</SelectItem>
            </SelectContent>
          </Select>
          <Input
            className="h-7 text-xs"
            value={form.conditionValue}
            onChange={e => setForm(f => ({ ...f, conditionValue: e.target.value }))}
            placeholder="Hodnota (napr. SK)"
          />
        </div>
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
                        <div className="text-muted-foreground">IF {auto.conditionField} {auto.conditionOperator} {auto.conditionValue}</div>
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
  const [addingItem, setAddingItem] = useState(false);

  const { data: items = [], isLoading } = useQuery<StatusListItem[]>({
    queryKey: ["/api/campaigns", campaignId, "status-list"],
    queryFn: () => apiRequest("GET", `/api/campaigns/${campaignId}/status-list`).then(r => r.json()),
    enabled: !!campaignId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Načítavam status list...
      </div>
    );
  }

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

      {items.length === 0 && !addingItem && (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed rounded-lg text-muted-foreground">
          <ClipboardList className="h-8 w-8 mb-2 opacity-20" />
          <p className="text-sm font-medium">Status list je prázdny</p>
          <p className="text-xs mt-1">Pridajte kroky s automatizáciami pre túto misiu</p>
          <Button type="button" variant="outline" size="sm" className="mt-4 gap-1.5 text-xs" onClick={() => setAddingItem(true)}>
            <Plus className="h-3.5 w-3.5" />
            Pridať prvý krok
          </Button>
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
    </div>
  );
}
