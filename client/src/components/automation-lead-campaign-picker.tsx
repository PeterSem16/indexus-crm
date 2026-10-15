import { useMemo, useState } from "react";
import { Check, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLeadSearchCopy, leadCampaignSelectionValid } from "@shared/automation-lead-search";

export type LeadCampaignOption = {
  id: number;
  name: string;
  country: string | null;
  isActive: boolean;
};

export function AutomationLeadCampaignPicker({
  locale, value, campaigns, loading, error, onRetry, onChange,
  retryLabel,
}: {
  locale: string;
  value: number[];
  campaigns: LeadCampaignOption[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onChange: (ids: number[]) => void;
  retryLabel: string;
}) {
  const copy = getLeadSearchCopy(locale);
  const [search, setSearch] = useState("");
  const byId = useMemo(() => new Map(campaigns.map(campaign => [campaign.id, campaign])), [campaigns]);
  const selected = value.map(id => ({ id, campaign: byId.get(id) }));
  const filtered = campaigns.filter(campaign =>
    `${campaign.name} ${campaign.country || ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const selectionValid = leadCampaignSelectionValid(value) && value.every(id => byId.has(id));

  const toggle = (id: number) => {
    onChange(value.includes(id) ? value.filter(current => current !== id) : [...value, id]);
  };

  return <section className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.025] p-3 sm:p-4"
    aria-labelledby="lead-search-campaigns-label" data-testid="lead-search-campaign-picker">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <label id="lead-search-campaigns-label" className="text-sm font-medium">{copy.campaigns}</label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.help}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={loading}
        data-testid="lead-search-campaign-refresh">
        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true"/>
        {copy.refresh}
      </Button>
    </div>

    {!loading && !error && <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground" aria-live="polite" data-testid="lead-search-selected-count">
        {copy.selectedCount.replace("{selected}", String(selected.filter(item => item.campaign).length)).replace("{total}", String(campaigns.length))}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={campaigns.length === 0}
          data-testid="lead-search-select-all" onClick={() => onChange(campaigns.map(campaign => campaign.id))}>
          {copy.selectAll}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={value.length === 0}
          data-testid="lead-search-clear-selection" onClick={() => onChange([])}>
          {copy.clearSelection}
        </Button>
      </div>
    </div>}

    {selected.length > 0 && <div className="flex flex-wrap gap-2" aria-label={copy.campaigns}>
      {selected.map(({ id, campaign }) => <span key={id}
        className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${campaign ? "border-primary/20 bg-primary/5 text-foreground" : "border-destructive/30 bg-destructive/5 text-destructive"}`}
        data-testid={`lead-search-selected-${id}`}>
        <span className="max-w-[220px] truncate">{campaign?.name || `${copy.missing} · ${id}`}</span>
        {!campaign && <span className="shrink-0">({id})</span>}
        <button type="button" aria-label={`${copy.missing}: ${campaign?.name || id}`}
          className="rounded-full p-0.5 hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => toggle(id)}><X size={13}/></button>
      </span>)}
    </div>}

    {loading ? <p className="rounded-lg bg-muted/50 px-3 py-4 text-sm text-muted-foreground" role="status">{copy.loading}</p>
      : error ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-3 text-sm" role="alert">
        <span>{copy.error}</span><Button type="button" variant="outline" size="sm" onClick={onRetry}>{retryLabel}</Button>
      </div>
        : <div className="space-y-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true"/>
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder={copy.campaigns}
              aria-label={copy.campaigns} className="pl-9" data-testid="lead-search-campaign-search"/>
          </label>
          {campaigns.length === 0 ? <div className="space-y-1 rounded-lg bg-muted/50 px-3 py-4" role="status">
            <p className="text-sm text-muted-foreground">{copy.empty}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{copy.emptyHelp}</p>
          </div>
            : filtered.length === 0 ? <p className="px-1 py-2 text-sm text-muted-foreground" role="status">{copy.filteredEmpty}</p>
              : <div className="grid max-h-52 grid-cols-1 gap-1 overflow-y-auto rounded-lg border bg-background p-1 sm:grid-cols-2">
                {filtered.map(campaign => {
                  const checked = value.includes(campaign.id);
                  return <button type="button" key={campaign.id} aria-pressed={checked}
                    onClick={() => toggle(campaign.id)} data-testid={`lead-search-campaign-${campaign.id}`}
                    className={`flex min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${checked ? "bg-primary/10 text-primary" : "hover:bg-muted/70"}`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>
                      {checked && <Check size={12}/>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{campaign.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[campaign.country, !campaign.isActive ? copy.paused : null].filter(Boolean).join(" · ")}</span>
                    </span>
                  </button>;
                })}
              </div>}
        </div>}

    {!selectionValid && <p role="alert" className="text-xs font-medium text-destructive" data-testid="lead-search-selection-error">
      {value.length === 0 ? copy.select : copy.error}
    </p>}
  </section>;
}
