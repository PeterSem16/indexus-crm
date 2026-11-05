import { Download, Loader2, Mail, Maximize2, Minimize2, Search, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import "./omni-search-results-header.css";

type ExportFormat = "eml" | "msg";
type LocaleCode = "en" | "sk" | "cs" | "hu" | "ro" | "it" | "de";

type OmniSearchResultsHeaderCopy = {
  results: string;
  resultsCount: string;
  exportFormat: string;
  exportEml: string;
  exportMsg: string;
  exportZip: string;
  exportAll: string;
  exporting: string;
  sendZip: string;
  sendByEmail: string;
  noPersonalAccount: string;
  fromDate: string;
  throughDate: string;
  clearSearch: string;
  minimizePanel: string;
  maximizePanel: string;
};

type OmniSearchResultsHeaderProps = {
  query: string;
  dateFrom: string;
  dateTo: string;
  count: number | null;
  locale: LocaleCode;
  copy: OmniSearchResultsHeaderCopy;
  format: ExportFormat;
  onFormatChange: (format: ExportFormat) => void;
  hasResults: boolean;
  refreshing: boolean;
  failed: boolean;
  exporting: boolean;
  hasPersonalAccount: boolean;
  expanded: boolean;
  onClear: () => void;
  onExport: () => void;
  onSend: () => void;
  onToggleExpanded: () => void;
};

const intlLocales: Record<LocaleCode, string> = {
  en: "en-US",
  sk: "sk-SK",
  cs: "cs-CZ",
  hu: "hu-HU",
  ro: "ro-RO",
  it: "it-IT",
  de: "de-DE",
};

function localizedDate(value: string, locale: LocaleCode): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return new Intl.DateTimeFormat(intlLocales[locale], { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function OmniSearchResultsHeader({
  query,
  dateFrom,
  dateTo,
  count,
  locale,
  copy,
  format,
  onFormatChange,
  hasResults,
  refreshing,
  failed,
  exporting,
  hasPersonalAccount,
  expanded,
  onClear,
  onExport,
  onSend,
  onToggleExpanded,
}: OmniSearchResultsHeaderProps) {
  const from = localizedDate(dateFrom, locale);
  const to = localizedDate(dateTo, locale);
  const dateSummary = from && to
    ? from === to ? from : `${from} – ${to}`
    : from ? `${copy.fromDate} ${from}` : to ? `${copy.throughDate} ${to}` : "";
  const trimmedQuery = query.trim();
  const summaryText = trimmedQuery || dateSummary;
  const unavailable = refreshing || failed || !hasResults;

  return (
    <CardHeader
      data-testid="omni-search-results-header"
      className="omni-search-results-header flex min-w-0 flex-col gap-2.5 space-y-0 border-b border-border/70 bg-card px-3 py-3"
    >
      <div className="flex min-w-0 items-start gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-xs font-semibold tracking-wide text-muted-foreground">{copy.results}</span>
            {count !== null && (
              <Badge
                variant="secondary"
                className="h-5 shrink-0 rounded-md px-1.5 text-[10px] font-semibold tabular-nums"
                aria-label={`${count} ${copy.resultsCount}`}
              >
                {count}
              </Badge>
            )}
          </div>
          {summaryText && (
            <div
              className="omni-search-summary mt-0.5 min-w-0 text-[13px] font-semibold leading-[1.35] text-foreground"
              data-testid="omni-search-summary"
              title={trimmedQuery || dateSummary}
              aria-label={trimmedQuery || dateSummary}
            >
              {trimmedQuery
                ? `“${trimmedQuery}”`
                : <span data-testid="omni-search-date-summary">{dateSummary}</span>}
            </div>
          )}
          {trimmedQuery && dateSummary && (
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-muted-foreground" data-testid="omni-search-date-summary">
              <span className="h-1 w-1 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{dateSummary}</span>
            </div>
          )}
        </div>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClear}
                aria-label={copy.clearSearch}
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{copy.clearSearch}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="omni-search-header-tools grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
        <Select value={format} onValueChange={(value: ExportFormat) => onFormatChange(value)}>
          <SelectTrigger className="h-8 min-w-0 w-[88px] max-w-full justify-self-start rounded-md px-2 text-xs" aria-label={copy.exportFormat} data-testid="search-export-format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="eml">{copy.exportEml}</SelectItem>
            <SelectItem value="msg">{copy.exportMsg}</SelectItem>
          </SelectContent>
        </Select>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleExpanded}
                aria-label={expanded ? copy.minimizePanel : copy.maximizePanel}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="button-expand-search"
              >
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{expanded ? copy.minimizePanel : copy.maximizePanel}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="omni-search-actions grid min-w-0 grid-cols-2 gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-auto min-h-9 min-w-0 w-full justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] leading-[1.2] whitespace-normal"
          data-testid="button-export-search"
          title={copy.exportAll}
          aria-label={copy.exportAll}
          disabled={unavailable || exporting}
          onClick={onExport}
        >
          {exporting ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Download className="h-3.5 w-3.5 shrink-0" />}
          <span className="min-w-0 [overflow-wrap:anywhere]">{exporting ? copy.exporting : copy.exportZip}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-auto min-h-9 min-w-0 w-full justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] leading-[1.2] whitespace-normal shadow-sm"
          data-testid="button-email-search-export"
          disabled={unavailable || !hasPersonalAccount}
          title={copy.sendZip}
          aria-label={copy.sendZip}
          onClick={onSend}
        >
          <Send className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{copy.sendByEmail}</span>
        </Button>
        {!hasPersonalAccount && (
          <p className="col-span-full -mt-0.5 flex min-w-0 items-start gap-1.5 px-0.5 text-[10px] leading-[1.35] text-muted-foreground">
            <Mail className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{copy.noPersonalAccount}</span>
          </p>
        )}
      </div>
    </CardHeader>
  );
}
