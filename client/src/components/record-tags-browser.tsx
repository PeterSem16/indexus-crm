import { useEffect, useState } from "react";
import { Search, Tags } from "lucide-react";
import { RECORD_TAG_ENTITY_TYPES, visibleRecordTags } from "@shared/automation-record-tags";
import { useI18n } from "@/i18n";
import { getUpdateRecordCopy } from "@/i18n/automation-update-record-copy";
import { getAutomationRecordTagCopy } from "@/i18n/automation-record-tag-copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = { countryCodes?: string[] };
type DirectoryRecord = { id: string; label: string; secondary?: string; country?: string; tags: string[] };

export function RecordTagsBrowser({ countryCodes = [] }: Props) {
  const { locale } = useI18n();
  const copy = getAutomationRecordTagCopy(locale);
  const updateCopy = getUpdateRecordCopy(locale);
  const countries = countryCodes.map(code => code.toUpperCase()).join(",");
  const [entityType, setEntityType] = useState(RECORD_TAG_ENTITY_TYPES[0] || "");
  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState(false);
  const [records, setRecords] = useState<DirectoryRecord[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const entityNames: Record<string, string> = {
    task: "Task", customer: "Customer", hospital: "Hospital", clinic: "Clinic", invoice: "Invoice",
    collection: "Collection", collaborator: "Collaborator", contract: "Contract", campaign: "Mission", product: "Product",
  };
  const entityLabel = (value: string) => (updateCopy.entity as Record<string, string>)[value] || entityNames[value] || value;

  useEffect(() => {
    if (!entityType) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setSuggestionLoading(true); setSuggestionError(false);
      try {
        const params = new URLSearchParams({ entityType, q: tag.trim(), countries });
        const response = await fetch(`/api/automation/record-tags/suggestions?${params}`, { credentials: "include" });
        if (!response.ok) throw new Error("tag suggestions");
        const data = await response.json();
        if (active) setSuggestions(visibleRecordTags(data.tags));
      } catch { if (active) setSuggestionError(true); }
      finally { if (active) setSuggestionLoading(false); }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [entityType, tag, countries, retryKey]);

  useEffect(() => {
    if (!entityType || !tag.trim()) { setRecords([]); setTruncated(false); setLoading(false); setError(false); return; }
    let active = true;
    setLoading(true); setError(false); setRecords([]);
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ entityType, tag: tag.trim(), q: search.trim(), countries });
        const response = await fetch(`/api/automation/record-tags/tagged?${params}`, { credentials: "include" });
        if (!response.ok) throw new Error("tag directory");
        const data = await response.json();
        if (active) {
          setRecords(Array.isArray(data.records) ? data.records.filter((item: any) => item?.label && item?.id != null)
            .map((item: any) => ({ ...item, id: String(item.id), tags: visibleRecordTags(item.tags) })) : []);
          setTruncated(Boolean(data.truncated));
        }
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [entityType, tag, search, countries, retryKey]);

  return <section className="space-y-4" data-testid="record-tags-browser">
    <header className="flex items-start gap-3">
      <span className="rounded-lg bg-primary/10 p-2 text-primary"><Tags className="h-4 w-4" /></span>
      <div><h2 className="text-base font-semibold">{copy.title}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.directoryHelp}</p></div>
    </header>
    <div className="grid gap-3 sm:grid-cols-[minmax(150px,.8fr)_minmax(180px,1fr)_minmax(180px,1fr)]">
      <div className="space-y-1.5">
        <Label>{copy.type}</Label>
        <Select value={entityType} onValueChange={value => { setEntityType(value); setTag(""); setSearch(""); }}>
          <SelectTrigger data-testid="tag-browser-type"><SelectValue /></SelectTrigger>
          <SelectContent>{RECORD_TAG_ENTITY_TYPES.map(type => <SelectItem key={type} value={type}>{entityLabel(type)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{copy.tag}</Label>
        <Input value={tag} list="record-tag-browser-suggestions" data-testid="tag-browser-tag" placeholder={copy.allTags}
          onChange={event => setTag(event.target.value)} />
        <datalist id="record-tag-browser-suggestions">{suggestions.map(value => <option key={value} value={value} />)}</datalist>
        {suggestionLoading && <p className="text-xs text-muted-foreground">{copy.loading}</p>}
        {suggestionError && <button type="button" className="text-xs text-destructive underline" onClick={() => setRetryKey(key => key + 1)}>{copy.loadError} {copy.retry}</button>}
      </div>
      <div className="space-y-1.5">
        <Label>{copy.search}</Label>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} data-testid="tag-browser-search" className="pl-9" placeholder={copy.searchHint} onChange={event => setSearch(event.target.value)} />
        </div>
      </div>
    </div>
    <div className="min-h-28 rounded-xl border bg-card/50">
      {!tag.trim() && <div className="grid min-h-28 place-items-center px-4 text-center text-sm text-muted-foreground">{copy.chooseTagFirst}</div>}
      {tag.trim() && loading && <div className="space-y-3 p-4" aria-label={copy.loading}>
        {[0, 1, 2].map(row => <div key={row} className="flex items-center gap-3 animate-pulse"><div className="h-9 w-9 rounded-lg bg-muted" /><div className="flex-1 space-y-2"><div className="h-3 w-2/5 rounded bg-muted" /><div className="h-2 w-1/4 rounded bg-muted" /></div></div>)}
      </div>}
      {tag.trim() && error && !loading && <div className="grid min-h-28 place-items-center gap-2 px-4 text-center">
        <p role="alert" className="text-sm text-destructive">{copy.loadError}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setRetryKey(key => key + 1)}>{copy.retry}</Button>
      </div>}
      {tag.trim() && !loading && !error && records.length === 0 && <div className="grid min-h-28 place-items-center px-4 text-center text-sm text-muted-foreground">{copy.empty}</div>}
      {tag.trim() && !loading && !error && records.length > 0 && <div className="divide-y">
        <div className="px-4 py-2 text-xs font-medium text-muted-foreground">{copy.records} · {records.length}{truncated ? "+" : ""}</div>
        {records.map(item => <article key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.label}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{[item.secondary, item.country].filter(Boolean).join(" · ") || entityLabel(entityType)}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">{item.tags.map(name => <Badge key={name} variant="secondary">{name}</Badge>)}</div>
        </article>)}
        {truncated && <p className="px-4 py-3 text-xs text-muted-foreground">{copy.truncated}</p>}
      </div>}
    </div>
  </section>;
}
