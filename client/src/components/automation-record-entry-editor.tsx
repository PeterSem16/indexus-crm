import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/i18n";
import { getRecordEntryCopy } from "@/i18n/automation-record-entry-copy";
import { getRecordReviewCopy } from "@/i18n/automation-record-review-copy";
import type { RecordEntryConfig } from "@shared/automation-record-entry";
export type { RecordEntryConfig } from "@shared/automation-record-entry";
type Props = {
  value: RecordEntryConfig;
  onChange: (value: RecordEntryConfig) => void;
  availableVariables: { value: string; label: string }[];
  ruleId?: string;
  countries: string[];
  taskGroups: { id: string; name: string; displayAlias?: string | null; isBackOffice?: boolean | null }[];
};

export function AutomationRecordEntryEditor({ value, onChange, ruleId, countries, availableVariables, taskGroups }: Props) {
  const { locale } = useI18n();
  const c = getRecordEntryCopy(locale);
  const review = getRecordReviewCopy(locale);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestVersion = useRef(0);
  const signature = JSON.stringify([value, countries, ruleId]);
  useEffect(() => {
    requestVersion.current++;
    setPreview(null); setError(false); setLoading(false);
    return () => { requestVersion.current++; };
  }, [signature]);
  const change = (patch: Partial<RecordEntryConfig>) => {
    requestVersion.current++;
    setPreview(null);
    setError(false);
    onChange({ ...value, ...patch });
  };
  const runPreview = async () => {
    const version = ++requestVersion.current;
    setLoading(true); setError(false); setPreview(null);
    try {
      const res = await fetch("/api/automation/record-match", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: value.targetType, email: value.email || "", phone: value.phone || "", countryCodes: countries, ruleId }),
      });
      if (!res.ok) throw new Error("preview failed");
      const result = await res.json();
      if (version === requestVersion.current) setPreview(result);
    } catch { if (version === requestVersion.current) setError(true); }
    finally { if (version === requestVersion.current) setLoading(false); }
  };
  const matches = preview?.records ?? preview?.matches ?? preview?.results ?? [];
  const count = Number(preview?.count ?? preview?.matchCount ?? matches.length ?? 0);
  const status = preview?.status ?? preview?.result ?? (count === 1 ? "unique" : count > 1 ? "ambiguous" : "none");
  const stateLabel = status === "ambiguous" || preview?.truncated || count > 1 ? c.ambiguous
    : status === "unique" && count === 1 ? c.unique : c.noMatch;
  return <section className="space-y-4 rounded-lg border border-border/70 bg-card p-4" data-testid="automation-record-entry-editor">
    <header><h3 className="text-sm font-semibold">{c.heading}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.help}</p></header>
    <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-950/20">
      <Label>{review.handling}</Label>
      <Select value={value.onAmbiguous ? "back_office" : "stop"} onValueChange={v => change({ onAmbiguous: v === "back_office" ? { taskGroupId: "" } : undefined })}>
        <SelectTrigger data-testid="record-entry-ambiguity"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="stop">{review.stop}</SelectItem><SelectItem value="back_office">{review.send}</SelectItem></SelectContent>
      </Select>
      {value.onAmbiguous && <><Label>{review.group}</Label>
        <Select value={value.onAmbiguous.taskGroupId || "__empty__"} onValueChange={id => change({ onAmbiguous: { taskGroupId: id } })}>
          <SelectTrigger data-testid="record-entry-review-group"><SelectValue placeholder={review.group} /></SelectTrigger>
          <SelectContent><SelectItem value="__empty__" disabled>{review.group}</SelectItem>
            {taskGroups.filter(group => group.isBackOffice).map(group => <SelectItem key={group.id} value={group.id}>{group.displayAlias || group.name}</SelectItem>)}
          </SelectContent>
        </Select><p className="text-xs text-muted-foreground">{review.help}</p></>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label>{c.target}</Label><Select value={value.targetType} onValueChange={(v: RecordEntryConfig["targetType"]) => change({ targetType: v })}><SelectTrigger data-testid="record-entry-type"><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="auto">{c.auto}</SelectItem><SelectItem value="customer">{c.customer}</SelectItem><SelectItem value="clinic">{c.clinic}</SelectItem><SelectItem value="hospital">{c.hospital}</SelectItem><SelectItem value="collaborator">{c.collaborator}</SelectItem>
      </SelectContent></Select></div>
      <div className="space-y-1.5"><Label>{c.lookup}</Label><Select value={value.lookup} onValueChange={(v: RecordEntryConfig["lookup"]) => change({ lookup: v })}><SelectTrigger data-testid="record-entry-lookup"><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="sender">{c.sender}</SelectItem><SelectItem value="recipient">{c.recipient}</SelectItem><SelectItem value="configured">{c.configured}</SelectItem>
      </SelectContent></Select></div>
    </div>
    {value.lookup === "configured" ? <div className="space-y-3 rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{c.exact} {c.matching}</p>
      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>{c.email}</Label><Input type="email" value={value.email || ""} onChange={e => change({ email: e.target.value })} data-testid="record-entry-email" /></div><div className="space-y-1.5"><Label>{c.phone}</Label><Input type="tel" value={value.phone || ""} onChange={e => change({ phone: e.target.value })} data-testid="record-entry-phone" /></div></div>
      <div className="flex flex-wrap items-center gap-3"><Button type="button" size="sm" variant="outline" onClick={runPreview} disabled={loading} data-testid="record-entry-preview">{loading ? c.loading : c.preview}</Button><span className="text-xs text-muted-foreground">{c.previewOnly}</span></div>
      {error && <p role="alert" className="text-sm text-destructive">{c.previewError}</p>}
      {preview && <div role="status" className="space-y-2 rounded border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{stateLabel}</span><span className="font-mono text-xs text-muted-foreground">{c.count}: {count}</span></div>
        {!!matches.length && <ul className="space-y-1 border-t pt-2">{matches.map((item: any, index: number) => <li key={item.id ?? index} className="text-sm">{item.label ?? item.name ?? item.displayName ?? item.title ?? item.email ?? c.record}</li>)}</ul>}
      </div>}
    </div> : <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">{c.trusted} {c.sourceRuntime}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label>{c.mode}</Label><Select value={value.mode} onValueChange={(v: RecordEntryConfig["mode"]) => change({ mode: v })}><SelectTrigger data-testid="record-entry-mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="history">{c.history}</SelectItem><SelectItem value="invoice">{c.invoice}</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">{value.mode === "history" ? c.historyHelp : c.invoiceHelp}</p></div>
      <div className="space-y-1.5"><Label>{c.title}</Label><Input value={value.title} onChange={e => change({ title: e.target.value })} placeholder={c.emptyTitle} data-testid="record-entry-title" /></div>
    </div>
    <div className="space-y-1.5"><Label>{c.note} <span className="font-normal text-muted-foreground">({c.optional})</span></Label><Textarea value={value.note || ""} onChange={e => change({ note: e.target.value })} rows={2} data-testid="record-entry-note" /></div>
    <div className="flex max-h-28 flex-wrap gap-1 overflow-auto">
      {availableVariables.map(variable => <Button key={variable.value} type="button" size="sm" variant="outline"
        className="h-7 font-mono text-[11px]" title={variable.label}
        onClick={() => change({ note: `${value.note || ""}${value.note ? " " : ""}{{${variable.value}}}` })}>
        {`{{${variable.value}}}`}
      </Button>)}
    </div>
  </section>;
}
