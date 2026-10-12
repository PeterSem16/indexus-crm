import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Check, Pencil, Plus, Search, Shield, Trash2, UserRound, Users } from "lucide-react";
import type { Role, User as UserType } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { getMetricAlertLabel, getNotificationAlertCopy } from "@/components/notification-alert-copy";
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

type AlertRule = {
  id: string; name: string; description?: string | null; metricType: string; comparisonOperator: string;
  thresholdValue: number; checkFrequency: string; notificationPriority: string; cooldownMinutes: number;
  targetType: string; targetRoles?: string[] | null; targetUserIds?: string[] | null; countryCodes?: string[] | null;
  isActive: boolean; lastCheckedAt?: string | null; nextCheckAt?: string | null; lastAlertedAt?: string | null;
};
type AlertForm = Omit<AlertRule, "id" | "lastCheckedAt" | "nextCheckAt" | "lastAlertedAt">;
const metrics = ["pending_lab_results", "collections_without_hospital", "overdue_collections", "pending_evaluations", "expiring_api_keys", "inactive_customers", "upcoming_collection_dates", "low_collection_rate", "pending_invoices", "overdue_tasks"];
const operators = ["gt", "gte", "lt", "lte", "eq", "neq"];
const frequencies = ["hourly", "every_6_hours", "daily", "weekly"];
const priorities = ["low", "normal", "high", "urgent"];
const countries = ["SK", "CZ", "HU", "RO", "IT", "DE", "AT", "PL", "GB", "US"];
const blank: AlertForm = {
  name: "", description: "", metricType: metrics[0], comparisonOperator: "gt", thresholdValue: 0, checkFrequency: "daily",
  notificationPriority: "high", cooldownMinutes: 60, targetType: "all", targetRoles: [], targetUserIds: [], countryCodes: [], isActive: true,
};

export function AlertRulesManager() {
  const { locale } = useI18n();
  const copy = getNotificationAlertCopy(locale);
  const { toast } = useToast();
  const [queryText, setQueryText] = useState("");
  const [editing, setEditing] = useState<AlertRule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<AlertRule | null>(null);
  const [form, setForm] = useState<AlertForm>({ ...blank });
  const rules = useQuery<AlertRule[]>({ queryKey: ["/api/alert-rules"] });
  const roles = useQuery<Role[]>({ queryKey: ["/api/roles"] });
  const users = useQuery<UserType[]>({ queryKey: ["/api/users"] });
  const { data: alertRules = [] } = rules;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
  const save = useMutation({
    mutationFn: (payload: AlertForm) => editing
      ? apiRequest("PATCH", `/api/alert-rules/${editing.id}`, payload)
      : apiRequest("POST", "/api/alert-rules", payload),
    onSuccess: () => { void refresh(); setFormOpen(false); toast({ title: copy.saved }); },
    onError: () => toast({ title: copy.saveFailed, variant: "destructive" }),
  });
  const toggle = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/alert-rules/${id}/toggle`),
    onSuccess: refresh, onError: () => toast({ title: copy.metricToggleFailed, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/alert-rules/${id}`),
    onSuccess: () => { void refresh(); setDeleting(null); toast({ title: copy.removed }); },
    onError: () => toast({ title: copy.deleteFailed, variant: "destructive" }),
  });
  const filtered = useMemo(() => alertRules.filter(rule =>
    `${rule.name} ${rule.description || ""} ${rule.metricType}`.toLowerCase().includes(queryText.toLowerCase())
  ), [alertRules, queryText]);
  const set = <K extends keyof AlertForm>(key: K, value: AlertForm[K]) => setForm(current => ({ ...current, [key]: value }));
  const toggleValues = (key: "targetRoles" | "targetUserIds" | "countryCodes", value: string) => {
    const current = form[key] || [];
    set(key, (current.includes(value) ? current.filter(item => item !== value) : [...current, value]) as AlertForm[typeof key]);
  };
  const countryOptions = Array.from(new Set([...countries, ...(form.countryCodes || [])]));
  const create = () => { setEditing(null); setForm({ ...blank }); setFormOpen(true); };
  const edit = (rule: AlertRule) => {
    setEditing(rule);
    setForm({
      name: rule.name, description: rule.description || "", metricType: rule.metricType, comparisonOperator: rule.comparisonOperator,
      thresholdValue: rule.thresholdValue, checkFrequency: rule.checkFrequency, notificationPriority: rule.notificationPriority,
      cooldownMinutes: rule.cooldownMinutes, targetType: rule.targetType || "all", targetRoles: rule.targetRoles || [],
      targetUserIds: rule.targetUserIds || [], countryCodes: rule.countryCodes || [], isActive: rule.isActive,
    });
    setFormOpen(true);
  };
  const submit = () => {
    if (!form.name.trim() || form.thresholdValue === null || Number.isNaN(Number(form.thresholdValue))) return;
    save.mutate({ ...form, name: form.name.trim(), thresholdValue: Number(form.thresholdValue), cooldownMinutes: Math.max(1, Number(form.cooldownMinutes) || 1) });
  };
  const labels = copy as Record<string, string>;
  const recipientLabel = (rule: AlertRule) => {
    if (rule.targetType === "role") return `${copy.selectedRoles} (${rule.targetRoles?.length || 0})`;
    if (rule.targetType === "specific_users") return `${copy.selectedUsers} (${rule.targetUserIds?.length || 0})`;
    return copy.all;
  };
  const metricText = (value: string) => getMetricAlertLabel(value, locale);
  const conditionLabel = (rule: AlertRule) => `${metricText(rule.metricType)} ${labels[`operator_${rule.comparisonOperator}`] || rule.comparisonOperator} ${rule.thresholdValue}`;

  return <section className="space-y-5" data-testid="metric-alert-rules-manager">
    <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-800"><Activity className="h-4 w-4" />INDEXUS / {copy.metric}</div>
        <h2 className="text-2xl font-semibold tracking-tight">{copy.metricHeading}</h2><p className="mt-1 text-sm text-muted-foreground">{copy.metricIntro}</p>
      </div><Button onClick={create} data-testid="button-add-alert-rule"><Plus className="mr-2 h-4 w-4" />{copy.addMetric}</Button>
    </header>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={queryText} onChange={event => setQueryText(event.target.value)} className="pl-9" placeholder={copy.metricSearch} aria-label={copy.metricSearch} /></div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{alertRules.length} {copy.metricHeading.toLowerCase()}</p>
    </div>
    {rules.isLoading ? <div className="space-y-3" aria-label={copy.loading}><div className="h-24 animate-pulse rounded-xl bg-muted/70" /><div className="h-24 animate-pulse rounded-xl bg-muted/70" /></div>
      : rules.isError ? <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm sm:flex-row sm:items-center sm:justify-between"><span>{copy.metricError}</span><Button variant="outline" size="sm" onClick={() => void rules.refetch()}>{copy.retry}</Button></div>
      : !filtered.length ? <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><Activity className="h-5 w-5" /></div>
        <h3 className="font-semibold">{alertRules.length ? copy.noMatches : copy.metricEmpty}</h3><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{alertRules.length ? copy.noMatches : copy.metricEmptyInfo}</p>
        {!alertRules.length && <Button variant="outline" className="mt-5" onClick={create}><Plus className="mr-2 h-4 w-4" />{copy.addMetric}</Button>}
      </div>
      : <div className="space-y-3">{filtered.map(rule => <Card key={rule.id} className={`overflow-hidden border-border/80 ${rule.isActive ? "" : "bg-muted/30"}`}>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${rule.isActive ? "bg-amber-100 text-amber-900" : "bg-muted text-muted-foreground"}`}><Activity className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{rule.name}</h3><Badge variant={rule.isActive ? "default" : "secondary"}>{rule.isActive ? copy.active : copy.paused}</Badge><Badge variant="outline">{labels[rule.notificationPriority] || rule.notificationPriority}</Badge></div>
            {rule.description && <p className="mt-1 text-sm text-muted-foreground">{rule.description}</p>}
            <p className="mt-3 font-medium text-foreground">{conditionLabel(rule)}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{labels[`frequency_${rule.checkFrequency}`] || rule.checkFrequency}</Badge>
              <Badge variant="outline">{rule.cooldownMinutes} {copy.cooldown.toLowerCase()}</Badge>
              <Badge variant="outline">{copy.recipientsTitle}: {recipientLabel(rule)}</Badge>
              <Badge variant="outline">{copy.countries}: {rule.countryCodes?.length ? rule.countryCodes.join(", ") : copy.everyCountry}</Badge>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />{copy.channelsNotStored}</p>
            {rule.lastCheckedAt && <p className="mt-1 text-xs text-muted-foreground">{copy.frequency}: {new Date(rule.lastCheckedAt).toLocaleString(locale)}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
            <Switch checked={rule.isActive} disabled={toggle.isPending} onCheckedChange={() => toggle.mutate(rule.id)} aria-label={`${copy.active}: ${rule.name}`} />
            <Button size="icon" variant="ghost" onClick={() => edit(rule)} data-testid={`edit-alert-rule-${rule.id}`} aria-label={`${copy.edit}: ${rule.name}`}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setDeleting(rule)} data-testid={`delete-alert-rule-${rule.id}`} aria-label={`${copy.delete}: ${rule.name}`}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>)}</div>}

    <Dialog open={formOpen} onOpenChange={open => { if (!save.isPending) setFormOpen(open); }}>
      <DialogContent overlayClassName="task-modern-modal-overlay task-modern-modal-overlay--nested"
        className="task-modern-modal task-modern-modal--nested flex h-[min(800px,calc(100dvh-2rem))] w-[min(1000px,calc(100vw-1rem))] max-w-[1000px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800"><Activity className="h-4 w-4" />{editing ? copy.metricEdit : copy.metricCreate}</div>
          <DialogTitle className="text-xl">{editing ? form.name || copy.metricEdit : copy.metricCreate}</DialogTitle><DialogDescription>{copy.metricIntro}</DialogDescription>
        </DialogHeader>
        <div className="task-modern-modal-body min-h-0 flex-1">
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="space-y-4 rounded-xl border p-4">
              <h3 className="text-sm font-semibold">{copy.metric}</h3>
              <div className="space-y-2"><Label htmlFor="alert-name">{copy.metricName} *</Label><Input id="alert-name" maxLength={100} value={form.name} onChange={event => set("name", event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="alert-description">{copy.metricDescription}</Label><Textarea id="alert-description" rows={2} value={form.description || ""} onChange={event => set("description", event.target.value)} /></div>
                <div className="space-y-2"><Label>{copy.metric}</Label><Select value={form.metricType} onValueChange={metricType => set("metricType", metricType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{metrics.map(metric => <SelectItem key={metric} value={metric}>{metricText(metric)}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2"><Label>{copy.condition}</Label><Select value={form.comparisonOperator} onValueChange={comparisonOperator => set("comparisonOperator", comparisonOperator)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{operators.map(operator => <SelectItem key={operator} value={operator}>{labels[`operator_${operator}`]}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="alert-threshold">{copy.threshold}</Label><Input id="alert-threshold" type="number" step={1} value={form.thresholdValue} onChange={event => set("thresholdValue", Number(event.target.value))} /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2"><Label>{copy.frequency}</Label><Select value={form.checkFrequency} onValueChange={checkFrequency => set("checkFrequency", checkFrequency)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{frequencies.map(value => <SelectItem key={value} value={value}>{labels[`frequency_${value}`]}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="alert-cooldown">{copy.cooldown}</Label><Input id="alert-cooldown" type="number" min={1} value={form.cooldownMinutes} onChange={event => set("cooldownMinutes", Math.max(1, Number(event.target.value)))} /></div>
              </div><p className="text-xs text-muted-foreground">{copy.cooldownHint}</p>
              <div className="space-y-2"><Label>{copy.alertPriority}</Label><Select value={form.notificationPriority} onValueChange={notificationPriority => set("notificationPriority", notificationPriority)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map(value => <SelectItem key={value} value={value}>{labels[value]}</SelectItem>)}</SelectContent></Select></div>
            </section>
            <div className="space-y-5">
              <section className="space-y-3 rounded-xl border p-4"><div><h3 className="text-sm font-semibold">{copy.recipientsTitle}</h3><p className="mt-1 text-xs text-muted-foreground">{copy.audience}</p></div>
                <div className="grid grid-cols-3 gap-2">{[
                  { value: "all", label: copy.all, Icon: Users },
                  { value: "role", label: copy.roles, Icon: Shield },
                  { value: "specific_users", label: copy.people, Icon: UserRound },
                ].map(({ value, label, Icon }) => <button type="button" key={value} aria-pressed={form.targetType === value} onClick={() => { set("targetType", value); set("targetRoles", []); set("targetUserIds", []); }}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-xs font-medium ${form.targetType === value ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted"}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
                {form.targetType === "role" && <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {(roles.data || []).map(role => <label key={role.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted"><Checkbox checked={(form.targetRoles || []).includes(role.id)} onCheckedChange={() => toggleValues("targetRoles", role.id)} /><span className="text-sm">{role.name}</span></label>)}
                  {roles.isLoading && <div className="h-8 animate-pulse rounded bg-muted" />}{roles.isError && <Button variant="ghost" size="sm" onClick={() => void roles.refetch()}>{copy.retry}</Button>}
                  {!roles.isLoading && !roles.isError && !roles.data?.length && <p className="p-2 text-xs text-muted-foreground">{copy.noMatches}</p>}
                </div>}
                {form.targetType === "specific_users" && <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {(users.data || []).map(user => <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted"><Checkbox checked={(form.targetUserIds || []).includes(user.id)} onCheckedChange={() => toggleValues("targetUserIds", user.id)} /><span className="min-w-0 flex-1 truncate text-sm">{user.fullName}<span className="block truncate text-xs text-muted-foreground">{user.email}</span></span></label>)}
                  {users.isLoading && <div className="h-8 animate-pulse rounded bg-muted" />}{users.isError && <Button variant="ghost" size="sm" onClick={() => void users.refetch()}>{copy.retry}</Button>}
                  {!users.isLoading && !users.isError && !users.data?.length && <p className="p-2 text-xs text-muted-foreground">{copy.noMatches}</p>}
                </div>}
              </section>
              <section className="space-y-3 rounded-xl border p-4"><div><h3 className="text-sm font-semibold">{copy.countries}</h3><p className="mt-1 text-xs text-muted-foreground">{copy.countryHelp}</p></div>
                <div className="flex flex-wrap gap-2">{countryOptions.map(country => {
                  const selected = (form.countryCodes || []).includes(country);
                  return <button type="button" key={country} aria-pressed={selected} onClick={() => toggleValues("countryCodes", country)} className={`rounded-md border px-3 py-1.5 text-xs font-medium ${selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{selected && <Check className="mr-1 inline h-3 w-3" />}{country}</button>;
                })}</div>
              </section>
              <section className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{copy.active}</p><p className="mt-1 text-xs text-muted-foreground">{copy.metricIntro}</p></div><Switch checked={form.isActive} onCheckedChange={isActive => set("isActive", isActive)} /></div>
                <div className="mt-4 border-t pt-3"><p className="flex items-start gap-2 text-xs leading-relaxed text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{copy.channelsNotStored}</p></div>
              </section>
            </div>
          </div>
        </div>
        <DialogFooter className="task-modern-modal-footer mt-0 gap-2 sm:gap-2"><Button variant="outline" disabled={save.isPending} onClick={() => setFormOpen(false)}>{copy.cancel}</Button>
          <Button disabled={!form.name.trim() || save.isPending} data-testid="save-alert-rule" onClick={submit}>{save.isPending ? copy.loading : editing ? copy.saveMetric : copy.createMetric}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!deleting} onOpenChange={open => !open && !remove.isPending && setDeleting(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{copy.confirmDelete}</DialogTitle><DialogDescription>{copy.confirmDeleteText} {deleting?.name}</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" disabled={remove.isPending} onClick={() => setDeleting(null)}>{copy.cancel}</Button><Button variant="destructive" data-testid="confirm-delete-alert-rule" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>{remove.isPending ? copy.loading : copy.confirm}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
