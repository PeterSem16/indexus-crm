import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type AlertRule = { id: string; name: string; description?: string | null; metricType: string; comparisonOperator: string; thresholdValue: number; checkFrequency: string; notificationPriority: string; cooldownMinutes: number; isActive: boolean; lastCheckedAt?: string | null };
const metrics = ["pending_lab_results", "collections_without_hospital", "overdue_collections", "pending_evaluations", "expiring_api_keys", "inactive_customers", "upcoming_collection_dates", "low_collection_rate", "pending_invoices", "overdue_tasks"];
const blank = { name: "", metricType: metrics[0], comparisonOperator: "gt", thresholdValue: 0, checkFrequency: "daily", notificationPriority: "high", cooldownMinutes: 60, isActive: true };

export function AlertRulesManager() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<AlertRule | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank });
  const rules = useQuery<AlertRule[]>({ queryKey: ["/api/alert-rules"] });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
  const save = useMutation({ mutationFn: () => editing ? apiRequest("PATCH", `/api/alert-rules/${editing.id}`, form) : apiRequest("POST", "/api/alert-rules", form), onSuccess: () => { refresh(); setOpen(false); toast({ title: editing ? "Alert updated" : "Alert created" }); }, onError: () => toast({ title: "Could not save alert", variant: "destructive" }) });
  const toggle = useMutation({ mutationFn: (id: string) => apiRequest("POST", `/api/alert-rules/${id}/toggle`), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => apiRequest("DELETE", `/api/alert-rules/${id}`), onSuccess: () => { refresh(); toast({ title: "Alert deleted" }); } });
  const beginEdit = (rule: AlertRule) => { setEditing(rule); setForm({ name: rule.name, metricType: rule.metricType, comparisonOperator: rule.comparisonOperator, thresholdValue: rule.thresholdValue, checkFrequency: rule.checkFrequency, notificationPriority: rule.notificationPriority, cooldownMinutes: rule.cooldownMinutes, isActive: rule.isActive }); setOpen(true); };
  if (rules.isLoading) return <div className="space-y-3 p-4"><div className="h-6 w-1/4 animate-pulse rounded bg-muted" /><div className="h-16 animate-pulse rounded bg-muted" /></div>;
  if (rules.isError) return <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm">Alert rules failed to load. <Button variant="outline" size="sm" onClick={() => rules.refetch()}>Retry</Button></div>;
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{rules.data?.length || 0} metric alert rules</p><Button onClick={() => { setEditing(null); setForm({ ...blank }); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Create alert</Button></div>
    {!rules.data?.length ? <div className="rounded-xl border border-dashed p-10 text-center"><Bell className="mx-auto mb-3 h-8 w-8 text-primary" /><h3 className="font-medium">No metric alerts yet</h3><p className="mt-1 text-sm text-muted-foreground">Create a threshold rule to watch operational signals.</p></div> : <div className="space-y-3">{rules.data.map(rule => <Card key={rule.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{rule.name}</h3><Badge variant={rule.isActive ? "default" : "secondary"}>{rule.isActive ? "Active" : "Paused"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{rule.metricType.replace(/_/g, " ")} {rule.comparisonOperator} {rule.thresholdValue}</p><p className="mt-1 text-xs text-muted-foreground">{rule.checkFrequency} · {rule.notificationPriority} priority</p></div><div className="flex items-center gap-2"><Switch checked={rule.isActive} onCheckedChange={() => toggle.mutate(rule.id)} aria-label={`Toggle ${rule.name}`} /><Button size="icon" variant="ghost" onClick={() => beginEdit(rule)} aria-label={`Edit ${rule.name}`}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete "${rule.name}"?`)) remove.mutate(rule.id); }} aria-label={`Delete ${rule.name}`}><Trash2 className="h-4 w-4" /></Button></div></div></Card>)}</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="task-modern-modal"><DialogHeader><DialogTitle>{editing ? "Edit metric alert" : "Create metric alert"}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2"><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
      <div className="space-y-2"><Label>Metric</Label><Select value={form.metricType} onValueChange={metricType => setForm({ ...form, metricType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{metrics.map(metric => <SelectItem key={metric} value={metric}>{metric.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Comparison</Label><Select value={form.comparisonOperator} onValueChange={comparisonOperator => setForm({ ...form, comparisonOperator })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["gt", "gte", "lt", "lte", "eq", "neq"].map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Threshold</Label><Input type="number" value={form.thresholdValue} onChange={e => setForm({ ...form, thresholdValue: Number(e.target.value) })} /></div>
      <div className="space-y-2"><Label>Check frequency</Label><Select value={form.checkFrequency} onValueChange={checkFrequency => setForm({ ...form, checkFrequency })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["hourly", "every_6_hours", "daily", "weekly"].map(freq => <SelectItem key={freq} value={freq}>{freq.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Cooldown (minutes)</Label><Input type="number" min={1} value={form.cooldownMinutes} onChange={e => setForm({ ...form, cooldownMinutes: Number(e.target.value) })} /></div><label className="flex items-center gap-2 pt-6"><Switch checked={form.isActive} onCheckedChange={isActive => setForm({ ...form, isActive })} />Active</label>
    </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save alert</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}