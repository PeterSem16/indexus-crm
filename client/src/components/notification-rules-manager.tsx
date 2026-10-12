import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, Check, Clock3, Mail, MessageSquare, Pencil, Plus, Search, Shield, Trash2, UserRound, Users, Workflow } from "lucide-react";
import type { NotificationRule as NotificationRuleType, Role, User as UserType } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { getNotificationAlertCopy } from "@/components/notification-alert-copy";
import { NotificationConditionPicker } from "@/components/notification-condition-picker";
import { getCommunicationAnalysisCopy } from "@/lib/communication-analysis-copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type Rule = NotificationRuleType & { triggerConditions?: unknown; countryCodes?: string[] | null; targetRoles?: string[] | null; targetUserIds?: string[] | null };
export type NotificationRuleDraft = Omit<Rule, "id" | "createdAt" | "updatedAt" | "createdBy">;
type Form = NotificationRuleDraft;
export type NotificationAutomationActionType = "notify_user" | "send_email" | "send_sms";
const triggers = ["new_email", "new_sms", "new_customer", "status_change", "sentiment_negative", "task_overdue", "task_assigned"];
const priorities = ["low", "normal", "high", "urgent"];
const countries = ["SK", "CZ", "HU", "RO", "IT", "DE", "AT", "PL", "GB", "US"];
const blank: Form = {
  name: "", description: "", triggerType: "new_email", triggerConditions: null, countryCodes: [],
  targetType: "all", targetRoles: [], targetUserIds: [], notificationTitle: "", notificationMessage: "",
  priority: "normal", sendPush: true, sendEmail: false, sendSms: false, isActive: true,
};
const priorityClass: Record<string, string> = {
  low: "border-slate-300 bg-slate-100 text-slate-700", normal: "border-sky-300 bg-sky-50 text-sky-800",
  high: "border-amber-300 bg-amber-50 text-amber-900", urgent: "border-rose-300 bg-rose-50 text-rose-800",
};
const audienceOptions = [
  { value: "all", icon: Users }, { value: "role", icon: Shield },
  { value: "specific_users", icon: UserRound }, { value: "assignee", icon: UserRound },
];

export function NotificationRulesManager({ onCreateAutomation }: {
  onCreateAutomation?: (draft?: NotificationRuleDraft, actionType?: NotificationAutomationActionType) => void;
}) {
  const { locale } = useI18n();
  const copy = getNotificationAlertCopy(locale);
  const analysisCopy = getCommunicationAnalysisCopy(locale);
  const { toast } = useToast();
  const [queryText, setQueryText] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [deleting, setDeleting] = useState<Rule | null>(null);
  const [form, setForm] = useState<Form>({ ...blank });
  const rules = useQuery<Rule[]>({ queryKey: ["/api/notification-rules"] });
  const roles = useQuery<Role[]>({ queryKey: ["/api/roles"] });
  const users = useQuery<UserType[]>({ queryKey: ["/api/users"] });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/notification-rules"] });
  const save = useMutation({
    mutationFn: (payload: Form) => editing
      ? apiRequest("PUT", `/api/notification-rules/${editing.id}`, payload)
      : apiRequest("POST", "/api/notification-rules", payload),
    onSuccess: () => { void refresh(); setEditorOpen(false); toast({ title: copy.saved }); },
    onError: () => toast({ title: copy.saveFailed, variant: "destructive" }),
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiRequest("PATCH", `/api/notification-rules/${id}/toggle`, { isActive }),
    onSuccess: refresh, onError: () => toast({ title: copy.toggleFailed, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/notification-rules/${id}`),
    onSuccess: () => { void refresh(); setDeleting(null); toast({ title: copy.removed }); },
    onError: () => toast({ title: copy.deleteFailed, variant: "destructive" }),
  });
  const filtered = useMemo(() => (rules.data || []).filter(rule =>
    `${rule.name} ${rule.description || ""} ${rule.triggerType}`.toLowerCase().includes(queryText.toLowerCase())
  ), [rules.data, queryText]);
  const startNew = () => { setEditing(null); setForm({ ...blank }); setEditorOpen(true); };
  const handoff = (actionType: NotificationAutomationActionType, draft?: Form) => {
    if (!onCreateAutomation) return;
    onCreateAutomation(draft ? { ...draft } : undefined, actionType);
    setEditorOpen(false);
  };
  const startEdit = (rule: Rule) => {
    setEditing(rule);
    setForm({
      name: rule.name, description: rule.description || "", triggerType: rule.triggerType,
      triggerConditions: rule.triggerConditions ?? null, countryCodes: rule.countryCodes || [],
      targetType: rule.targetType, targetRoles: rule.targetRoles || [], targetUserIds: rule.targetUserIds || [],
      notificationTitle: rule.notificationTitle, notificationMessage: rule.notificationMessage || "",
      priority: rule.priority, sendPush: rule.sendPush, sendEmail: rule.sendEmail, sendSms: rule.sendSms, isActive: rule.isActive,
    });
    setEditorOpen(true);
  };
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(current => ({ ...current, [key]: value }));
  const toggleArray = (key: "countryCodes" | "targetRoles" | "targetUserIds", value: string, single = false) => {
    const current = form[key] || [];
    set(key, (single ? (current.includes(value) ? [] : [value]) : current.includes(value) ? current.filter(item => item !== value) : [...current, value]) as Form[typeof key]);
  };
  const countryOptions = Array.from(new Set([...countries, ...(form.countryCodes || [])]));
  const submit = () => {
    if (!form.name.trim() || !form.notificationTitle.trim()) {
      toast({ title: copy.required, variant: "destructive" });
      return;
    }
    save.mutate(form);
  };
  const labels = copy as Record<string, string>;

  return <section className="space-y-5" data-testid="notification-rules-manager">
    <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><Bell className="h-4 w-4" />INDEXUS / {copy.audience}</div>
        <h2 className="text-2xl font-semibold tracking-tight">{copy.notificationHeading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{copy.notificationIntro}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onCreateAutomation && <Button variant="outline" onClick={() => handoff("notify_user")} data-testid="general-analysis-create"><Workflow className="mr-2 h-4 w-4" />{analysisCopy.startInApp}</Button>}
        <Button onClick={startNew} data-testid="button-add-rule"><Plus className="mr-2 h-4 w-4" />{copy.addNotification}</Button>
      </div>
    </header>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label={copy.search} placeholder={copy.search} className="pl-9" value={queryText} onChange={e => setQueryText(e.target.value)} /></div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{rules.data?.length || 0} {copy.notificationHeading.toLocaleLowerCase()}</p>
    </div>
    {rules.isLoading ? <div className="space-y-3" aria-label={copy.loading}><div className="h-24 animate-pulse rounded-xl bg-muted/70" /><div className="h-24 animate-pulse rounded-xl bg-muted/70" /></div>
      : rules.isError ? <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span>{copy.error}</span><Button variant="outline" size="sm" onClick={() => void rules.refetch()}>{copy.retry}</Button>
      </div>
      : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Bell className="h-5 w-5" /></div>
        <h3 className="font-semibold">{rules.data?.length ? copy.noMatches : copy.noRules}</h3><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{rules.data?.length ? copy.noMatches : copy.start}</p>
        {!rules.data?.length && <Button className="mt-5" variant="outline" onClick={startNew}><Plus className="mr-2 h-4 w-4" />{copy.addNotification}</Button>}
      </div>
      : <div className="space-y-3">{filtered.map(rule => {
        const triggerLabel = labels[`trigger_${rule.triggerType}`] || rule.triggerType.replace(/_/g, " ");
        const targetLabel = labels[`target_${rule.targetType}`] || rule.targetType;
        return <Card key={rule.id} className={`overflow-hidden border-border/80 transition-colors ${rule.isActive ? "bg-card" : "bg-muted/35"}`}>
          <CardContent className="p-0">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${rule.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {rule.triggerType === "new_sms" ? <MessageSquare className="h-5 w-5" /> : rule.triggerType === "sentiment_negative" ? <AlertTriangle className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{rule.name}</h3><Badge variant={rule.isActive ? "default" : "secondary"}>{rule.isActive ? copy.active : copy.paused}</Badge>
                  <Badge variant="outline" className={priorityClass[rule.priority] || ""}>{labels[rule.priority] || rule.priority}</Badge>
                </div>
                {rule.description && <p className="mt-1 text-sm text-muted-foreground">{rule.description}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md bg-primary/8 px-2.5 py-1.5 font-medium text-primary">{copy.trigger}: {triggerLabel}</span>
                  <span className="rounded-md bg-muted px-2.5 py-1.5 text-foreground">{copy.audience}: {targetLabel}{rule.targetType === "role" && rule.targetRoles?.length ? ` (${rule.targetRoles.length})` : ""}{["specific_users", "assignee"].includes(rule.targetType) && rule.targetUserIds?.length ? ` (${rule.targetUserIds.length})` : ""}</span>
                  <span className="rounded-md bg-muted px-2.5 py-1.5 text-foreground">{copy.countries}: {rule.countryCodes?.length ? rule.countryCodes.join(", ") : copy.allCountries}</span>
                  {rule.sendPush && <Badge variant="outline">{copy.push}</Badge>}
                  {rule.sendEmail && <Badge variant="outline"><Mail className="mr-1 h-3 w-3" />{copy.email}</Badge>}
                  {rule.sendSms && <Badge variant="outline"><MessageSquare className="mr-1 h-3 w-3" />{copy.sms}</Badge>}
                </div>
                <p className="mt-3 truncate text-sm text-muted-foreground"><span className="font-medium text-foreground">{rule.notificationTitle}</span>{rule.notificationMessage ? ` — ${rule.notificationMessage}` : ""}</p>
                {(rule.sendEmail || rule.sendSms) && <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-800"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{copy.unsupported}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
                <Switch checked={rule.isActive} disabled={toggle.isPending} data-testid={`toggle-rule-${rule.id}`} aria-label={`${copy.active}: ${rule.name}`} onCheckedChange={isActive => toggle.mutate({ id: rule.id, isActive })} />
                <Button variant="ghost" size="icon" aria-label={`${copy.edit}: ${rule.name}`} data-testid={`edit-rule-${rule.id}`} onClick={() => startEdit(rule)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={`${copy.delete}: ${rule.name}`} data-testid={`delete-rule-${rule.id}`} onClick={() => setDeleting(rule)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>;
      })}</div>}

    <Dialog open={editorOpen} onOpenChange={open => { if (!save.isPending) setEditorOpen(open); }}>
      <DialogContent overlayClassName="task-modern-modal-overlay task-modern-modal-overlay--nested"
        className="task-modern-modal task-modern-modal--nested flex h-[min(860px,calc(100dvh-2rem))] w-[min(1120px,calc(100vw-1rem))] max-w-[1120px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary"><Bell className="h-4 w-4" />{editing ? copy.editTitle : copy.createTitle}</div>
          <DialogTitle className="text-xl">{editing ? form.name || copy.editTitle : copy.createTitle}</DialogTitle>
          <DialogDescription>{copy.notificationIntro}</DialogDescription>
        </DialogHeader>
        <div className="task-modern-modal-body min-h-0 flex-1">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-5">
              <section className="space-y-4 rounded-xl border p-4">
                <h3 className="text-sm font-semibold">{copy.basics}</h3>
                <div className="space-y-2"><Label htmlFor="nr-name">{copy.name} *</Label><Input id="nr-name" value={form.name} onChange={e => set("name", e.target.value)} maxLength={100} /></div>
                <div className="space-y-2"><Label htmlFor="nr-description">{copy.description}</Label><Textarea id="nr-description" value={form.description || ""} onChange={e => set("description", e.target.value)} rows={2} /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label>{copy.triggerType}</Label><Select value={form.triggerType} onValueChange={value => set("triggerType", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{triggers.map(value => <SelectItem key={value} value={value}>{labels[`trigger_${value}`] || value}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>{copy.priority}</Label><Select value={form.priority} onValueChange={value => set("priority", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map(value => <SelectItem key={value} value={value}>{labels[value]}</SelectItem>)}</SelectContent></Select></div>
                </div>
                {["new_sms", "sentiment_negative"].includes(form.triggerType) && <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-950"><MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />{copy.smsHelp}</div>}
                <div data-testid="nr-conditions" className="space-y-3">
                  <NotificationConditionPicker value={form.triggerConditions} onChange={value => set("triggerConditions", value)} locale={locale} triggerType={form.triggerType} />
                  {onCreateAutomation && <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><p className="text-sm font-semibold">{analysisCopy.generalAutomation.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{analysisCopy.generalAutomation.hint}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{analysisCopy.legacyHandoff} {analysisCopy.pausedHandoff}</p></div>
                    <Button type="button" variant="outline" className="shrink-0" onClick={() => handoff("notify_user", form)} data-testid="general-analysis-handoff"><Workflow className="mr-2 h-4 w-4" />{analysisCopy.startInApp}</Button>
                  </div>}
                </div>
              </section>
              <section className="space-y-3 rounded-xl border p-4">
                <div><h3 className="text-sm font-semibold">{copy.countries}</h3><p className="mt-1 text-xs text-muted-foreground">{copy.countryHelp}</p></div>
                <div className="flex flex-wrap gap-2">{countryOptions.map(country => {
                  const selected = (form.countryCodes || []).includes(country);
                  return <button type="button" key={country} aria-pressed={selected} className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`} onClick={() => toggleArray("countryCodes", country)}>{selected && <Check className="mr-1 inline h-3 w-3" />}{country}</button>;
                })}</div>
              </section>
            </div>
            <div className="space-y-5">
              <section className="space-y-4 rounded-xl border p-4">
                <div><h3 className="text-sm font-semibold">{copy.recipients}</h3><p className="mt-1 text-xs text-muted-foreground">{copy.audience}</p></div>
                <div className="grid grid-cols-2 gap-2">{audienceOptions.map(({ value, icon: Icon }) => {
                  const selected = form.targetType === value;
                  return <button type="button" key={value} aria-pressed={selected} onClick={() => { set("targetType", value); set("targetRoles", []); set("targetUserIds", []); }}
                    className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium ${selected ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted"}`}>
                    <Icon className="h-4 w-4 shrink-0" />{labels[`target_${value}`] || value}
                  </button>;
                })}</div>
                {form.targetType === "role" && <div className="space-y-2"><Label>{copy.chooseRoles}</Label><div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {(roles.data || []).map(role => <label key={role.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted"><Checkbox checked={(form.targetRoles || []).includes(role.id)} onCheckedChange={() => toggleArray("targetRoles", role.id)} /><Shield className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{role.name}</span></label>)}
                  {roles.isLoading && <div className="h-8 animate-pulse rounded bg-muted" />}
                  {roles.isError && <p role="alert" className="p-2 text-xs text-destructive">{copy.error} <Button size="sm" variant="ghost" onClick={() => void roles.refetch()}>{copy.retry}</Button></p>}
                  {!roles.isLoading && !roles.isError && !roles.data?.length && <p className="p-3 text-xs text-muted-foreground">{copy.noMatches}</p>}
                </div></div>}
                {(form.targetType === "specific_users" || form.targetType === "assignee") && <div className="space-y-2"><Label>{copy.chooseUsers}</Label><div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {(users.data || []).map(user => <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted"><Checkbox checked={(form.targetUserIds || []).includes(user.id)} onCheckedChange={() => toggleArray("targetUserIds", user.id, form.targetType === "assignee")} /><span className="min-w-0 flex-1"><span className="block truncate text-sm">{user.fullName}</span><span className="block truncate text-xs text-muted-foreground">{user.email}</span></span></label>)}
                  {users.isLoading && <div className="h-8 animate-pulse rounded bg-muted" />}
                  {users.isError && <p role="alert" className="p-2 text-xs text-destructive">{copy.error} <Button size="sm" variant="ghost" onClick={() => void users.refetch()}>{copy.retry}</Button></p>}
                  {!users.isLoading && !users.isError && !users.data?.length && <p className="p-3 text-xs text-muted-foreground">{copy.noMatches}</p>}
                </div></div>}
              </section>
              <section className="space-y-4 rounded-xl border p-4">
                <h3 className="text-sm font-semibold">{copy.message}</h3>
                <div className="space-y-2"><Label htmlFor="nr-title">{copy.title} *</Label><Input id="nr-title" value={form.notificationTitle} onChange={e => set("notificationTitle", e.target.value)} maxLength={255} /></div>
                <div className="space-y-2"><Label htmlFor="nr-message">{copy.message}</Label><Textarea id="nr-message" value={form.notificationMessage || ""} onChange={e => set("notificationMessage", e.target.value)} rows={3} /></div>
                <div className="rounded-lg bg-muted/60 p-3"><p className="text-xs leading-relaxed text-muted-foreground">{copy.variables}</p></div>
                <div className="space-y-2 border-t pt-3">
                  <p className="text-sm font-semibold">{copy.channels}</p>
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3"><span className="flex items-center gap-2 text-sm"><Bell className="h-4 w-4 text-primary" />{copy.push}<span className="block text-xs text-muted-foreground">{copy.pushHelp}</span></span><Switch checked={form.sendPush} onCheckedChange={value => set("sendPush", value)} /></label>
                  <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                    <div className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">{copy.email}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{analysisCopy.externalChannelHint}</p></div></div>
                    {onCreateAutomation && <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => handoff("send_email", form)} data-testid="handoff-email-automation">{analysisCopy.startEmail}</Button>}
                  </div>
                  <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                    <div className="flex gap-2"><MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">{copy.sms}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{analysisCopy.externalChannelHint}</p></div></div>
                    {onCreateAutomation && <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => handoff("send_sms", form)} data-testid="handoff-sms-automation">{analysisCopy.startSms}</Button>}
                  </div>
                  {!onCreateAutomation && <p className="text-xs leading-relaxed text-muted-foreground">{analysisCopy.noAutomationCallback}</p>}
                </div>
                <label className="flex items-center justify-between border-t pt-3 text-sm"><span>{copy.active}</span><Switch checked={form.isActive} onCheckedChange={value => set("isActive", value)} /></label>
              </section>
            </div>
          </div>
        </div>
        <DialogFooter className="task-modern-modal-footer mt-0 gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={save.isPending}>{copy.cancel}</Button>
          <Button onClick={submit} data-testid="save-notification-rule" disabled={save.isPending || !form.name.trim() || !form.notificationTitle.trim()}>{save.isPending && <Clock3 className="mr-2 h-4 w-4 animate-pulse" />}{editing ? copy.save : copy.create}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!deleting} onOpenChange={open => !open && !remove.isPending && setDeleting(null)}>
      <DialogContent className="max-w-md"><DialogHeader><DialogTitle>{copy.confirmDelete}</DialogTitle><DialogDescription>{copy.confirmDeleteText} {deleting?.name}</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => setDeleting(null)} disabled={remove.isPending}>{copy.cancel}</Button><Button variant="destructive" data-testid="confirm-delete-notification-rule" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>{remove.isPending ? copy.loading : copy.confirm}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
