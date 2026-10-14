import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown, ArrowUp, Bell, CalendarClock, Check, ChevronDown, CircleCheck,
  Clock3, Filter, Mail, MessageSquare, Phone, Plus, RefreshCw, Search, Sparkles,
  Target, X,
} from "lucide-react";
import { activityTemplateMissingVariables } from "./automation-activity-template-utils";
import { AutomationActivityTemplateIcon } from "./automation-activity-template-icon";
import { templateVisualTone } from "@shared/automation-template-visual";
import { automationTemplatePickerCopy as text } from "@shared/automation-template-picker-copy";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export type AutomationTemplatePickerTemplate = {
  id: string;
  name: string;
  subject?: unknown;
  content?: unknown;
  contentHtml?: unknown;
  language?: string | null;
  type?: string;
};

export type AutomationTemplatePickerVariable = { value: string; label: string };

export type AutomationTemplatePickerProps = {
  locale: string;
  templates: AutomationTemplatePickerTemplate[];
  value?: string;
  onSelect: (id: string) => void;
  availableVariables: AutomationTemplatePickerVariable[];
  sourceModule?: string;
  onRefresh?: () => void | Promise<unknown>;
  customLabel?: string;
  customValue?: string;
  snapshot?: { id: string; name: string };
  testId?: string;
};

export type AutomationTemplateSource = "calls" | "tasks" | "email" | "messages" | "records" | "notifications" | "analysis" | "other";
export type AutomationTemplateMeaning = "sentiment" | "tone" | "success" | "urgency" | "deadlines";
type SourceKey = AutomationTemplateSource;
type MeaningKey = AutomationTemplateMeaning;
type Direction = "all" | "inbound" | "outbound";
type TemplateEntry = {
  template: AutomationTemplatePickerTemplate;
  source: SourceKey;
  meanings: MeaningKey[];
  direction: "inbound" | "outbound" | "both" | null;
  missing: string[];
};

const wordPattern = /{{\s*([^{}]+?)\s*}}/g;

function normalized(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ");
}

function templateTexts(template: AutomationTemplatePickerTemplate) {
  return [template.subject, template.contentHtml, template.content]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function classifySource(template: AutomationTemplatePickerTemplate): AutomationTemplateSource {
  const id = normalized(template.id);
  const name = normalized(template.name);
  const parts = id.split(" ");
  const activityId = parts[0] === "indexus" && parts[1] === "activity";
  const legacyAutomationId = parts[0] === "indexus" && parts[1] === "automation";

  // Legacy email-analysis entries describe analysis, not their delivery channel.
  if (!activityId && parts.includes("analysis")) return "analysis";

  // In activity IDs the trigger is the module after "analysis"; the leading
  // module can be the delivery type (for example, email-analysis-task).
  const triggerToken = activityId
    ? parts[3] === "analysis" ? parts[4] : parts[3]
    : undefined;
  if (activityId && parts.some(part => ["inbound", "outbound", "voice"].includes(part))) return "calls";
  const fromToken = (token?: string): SourceKey | null => {
    if (!token) return null;
    if (["call", "calls", "phone", "voice", "inbound", "outbound"].includes(token)) return "calls";
    if (["task", "tasks", "todo"].includes(token)) return "tasks";
    if (["email", "e-mail"].includes(token)) return "email";
    if (["sms", "chat", "message"].includes(token)) return "messages";
    if (["customer", "clinic", "hospital", "contract", "invoice", "campaign", "collection", "product", "metric", "record"].includes(token)) return "records";
    if (["notification", "notifications"].includes(token)) return "notifications";
    return null;
  };
  if (activityId) {
    const source = fromToken(triggerToken);
    if (source) return source;
    if (parts.includes("call") || parts.includes("phone")) return "calls";
    return "other";
  }

  // Stable legacy catalogs and names are used only when the ID does not
  // encode an activity trigger. Never use `type` as a source: it may be a
  // delivery channel on email/SMS action templates.
  const idTokens = id.split(" ");
  const byId = idTokens.map(fromToken).find((source): source is SourceKey => source !== null);
  if (byId) return byId;
  const named = name.split(" ").map(fromToken).find((source): source is SourceKey => source !== null);
  return named || "other";
}

export function classifyMeanings(template: AutomationTemplatePickerTemplate): AutomationTemplateMeaning[] {
  const identity = normalized(`${template.id} ${template.name}`);
  const tone = templateVisualTone(template.id);
  const hasSentimentFacet = /\bsentiment\b|\bpositive\b|\bnegative\b/.test(identity);
  const hasToneFacet = /\btone\b/.test(identity) || /\banalysis\b.*\burgent\b/.test(identity);
  const meanings: MeaningKey[] = [];
  if (hasToneFacet) meanings.push("tone");
  else if (hasSentimentFacet) meanings.push("sentiment");
  if (/\b(?:success|successful|completed|complete|answered|won|delivered|resolved)\b/.test(identity)) meanings.push("success");
  if (/urgent|urgency|critical|escalat|priority|overdue/.test(identity) && !hasToneFacet) meanings.push("urgency");
  if (tone === "deadline" || /deadline|due date|due|overdue|expires|expiry/.test(identity)) meanings.push("deadlines");
  return Array.from(new Set(meanings));
}

function getVoiceDirection(template: AutomationTemplatePickerTemplate): "inbound" | "outbound" | "both" | null {
  if (classifySource(template) !== "calls") return null;
  const id = normalized(template.id);
  const name = normalized(template.name);
  if (/inbound|incoming|received/.test(`${id} ${name}`)) return "inbound";
  if (/outbound|outgoing|started/.test(`${id} ${name}`)) return "outbound";
  return "both";
}

function summaryFor(template: AutomationTemplatePickerTemplate, locale: string) {
  const sample = templateTexts(template)[0];
  if (!sample) return text(locale, "descriptionFallback");
  const plain = sample.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(wordPattern, "…").replace(/\s+/g, " ").trim();
  return plain.length > 112 ? `${plain.slice(0, 109).trimEnd()}…` : plain || text(locale, "descriptionFallback");
}

function variableCount(template: AutomationTemplatePickerTemplate) {
  const all = templateTexts(template).join(" ");
  return new Set(Array.from(all.matchAll(wordPattern), match => match[1].trim())).size;
}

const sourceIcons: Record<SourceKey, typeof Phone> = {
  calls: Phone, tasks: CalendarClock, email: Mail, messages: MessageSquare,
  records: Target, notifications: Bell, analysis: Sparkles, other: Sparkles,
};

const meaningIcons: Record<MeaningKey, typeof Phone> = {
  sentiment: Sparkles, tone: MessageSquare, success: CircleCheck, urgency: Clock3, deadlines: CalendarClock,
};

const sourceOrder: SourceKey[] = ["calls", "tasks", "email", "messages", "records", "notifications", "analysis", "other"];
const meaningOrder: MeaningKey[] = ["sentiment", "tone", "success", "urgency", "deadlines"];

export function AutomationTemplatePicker({
  locale, templates, value, onSelect, availableVariables, sourceModule, onRefresh,
  customLabel, customValue = "__custom", snapshot, testId = "automation-template-picker",
}: AutomationTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceKey | "all">("all");
  const [meaning, setMeaning] = useState<MeaningKey | "all">("all");
  const [direction, setDirection] = useState<Direction>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedTemplate = templates.find(template => template.id === value);
  const selectedName = selectedTemplate?.name || (snapshot && snapshot.id === value ? snapshot.name : undefined);
  const snapshotMissing = snapshot && !templates.some(template => template.id === snapshot.id);
  const unsupportedSnapshot = snapshot && value === snapshot.id && !selectedTemplate;

  const entries = useMemo<TemplateEntry[]>(() => {
    const catalogEntries: TemplateEntry[] = templates.map(template => ({
      template,
      source: classifySource(template),
      meanings: classifyMeanings(template),
      direction: getVoiceDirection(template),
      missing: activityTemplateMissingVariables(template, availableVariables),
    }));
    const selectedSource = sourceModule?.toLowerCase() === "communication" ? "analysis" : sourceModule?.toLowerCase();
    return entriesSortBySource(catalogEntries, selectedSource);
  }, [templates, availableVariables, sourceModule]);

  const filtered = useMemo(() => {
    const needle = normalized(query.trim());
    return entries.filter(({ template, source: itemSource, meanings, direction: itemDirection }) => {
      if (source !== "all" && source !== itemSource && !(source === "calls" && itemSource === "analysis")) return false;
      if (meaning !== "all" && !meanings.includes(meaning)) return false;
      if (direction !== "all" && itemSource === "calls" && itemDirection !== direction && itemDirection !== "both") return false;
      if (direction !== "all" && itemSource !== "calls" && !(source === "calls" && itemSource === "analysis")) return false;
      if (!needle) return true;
      return normalized(`${template.name} ${template.id} ${templateTexts(template).join(" ")}`).includes(needle);
    });
  }, [entries, query, source, meaning, direction]);

  const sourceCounts = useMemo(() => {
    const counts = new Map<SourceKey, number>();
    entries.forEach(entry => counts.set(entry.source, (counts.get(entry.source) || 0) + 1));
    return counts;
  }, [entries]);
  const meaningCounts = useMemo(() => {
    const counts = new Map<MeaningKey, number>();
    entries.forEach(entry => entry.meanings.forEach(item => counts.set(item, (counts.get(item) || 0) + 1)));
    return counts;
  }, [entries]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function choose(id: string) {
    onSelect(id);
    setOpen(false);
  }

  async function refresh() {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    setRefreshFailed(false);
    try {
      await onRefresh();
    } catch {
      setRefreshFailed(true);
    } finally {
      setRefreshing(false);
    }
  }

  const overlay = <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        hideCloseButton
        aria-labelledby={`${testId}-title`}
        aria-describedby={`${testId}-hint`}
        overlayClassName="!z-[10060] bg-slate-950/35 backdrop-blur-[2px]"
        onPointerDown={event => { if (event.target === event.currentTarget) setOpen(false); }}
        className="!fixed !inset-0 !left-0 !top-0 !z-[10061] !m-0 !flex !h-[100dvh] !w-full !max-w-none !translate-x-0 !translate-y-0 !items-end !justify-center !overflow-visible !border-0 !bg-transparent !p-0 !shadow-none sm:!items-center sm:!p-5"
        data-testid={`${testId}-dialog`}
      >
      <div
        aria-labelledby={`${testId}-title`}
        aria-describedby={`${testId}-hint`}
        className="flex max-h-[min(850px,94dvh)] min-h-[min(560px,82dvh)] w-full max-w-[940px] flex-col overflow-hidden rounded-t-2xl border border-border bg-background text-foreground shadow-[0_24px_80px_-24px_rgba(15,23,42,.38)] sm:rounded-2xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-[0.99] motion-safe:duration-150"
      >
        <header className="shrink-0 border-b border-border/80 bg-[linear-gradient(105deg,hsl(var(--primary)/.075),transparent_65%)] px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.15em] text-primary">
                <Sparkles className="size-3.5" aria-hidden="true" />
                <span>{text(locale, "choose")}</span>
              </div>
              <h2 id={`${testId}-title`} className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
                {text(locale, "choose")}
              </h2>
              <p id={`${testId}-hint`} className="mt-1 text-sm text-muted-foreground">{text(locale, "chooseHint")}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onRefresh && <button type="button" onClick={() => void refresh()} disabled={refreshing}
                aria-label={refreshing ? text(locale, "loading") : text(locale, "refresh")}
                title={refreshing ? text(locale, "loading") : text(locale, "refresh")}
                className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
                <RefreshCw className={`size-4 ${refreshing ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
              </button>}
              <button type="button" onClick={() => setOpen(false)} aria-label={text(locale, "close")}
                className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          {refreshFailed && <p role="alert" className="mt-2 text-xs text-destructive">{text(locale, "refreshError")}</p>}
          {(meaning === "tone" || meaning === "sentiment") &&
            !availableVariables.some(variable => variable.value.replace(/[{}]/g, "").trim() === "analysis.tone") &&
            <p role="status" className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs leading-relaxed text-foreground">{text(locale, "analysisRequired")}</p>}
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)}
              placeholder={text(locale, "search")} aria-label={text(locale, "search")}
              data-testid={`${testId}-search`}
              className="h-11 w-full rounded-xl border border-border bg-background/90 pl-10 pr-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/15" />
          </div>
        </header>

        <div className="shrink-0 space-y-3 border-b border-border/70 px-4 py-3 sm:px-6">
          <FilterRow label={text(locale, "source")} icon={<Filter className="size-3.5" aria-hidden="true" />}>
            <FilterChip active={source === "all"} onClick={() => { setSource("all"); setDirection("all"); }} label={text(locale, "all")} count={templates.length} testId={`${testId}-source-all`} />
            {sourceOrder.filter(item => sourceCounts.has(item)).map(item => {
              const Icon = sourceIcons[item];
              return <FilterChip key={item} active={source === item && direction === "all"} onClick={() => { setSource(source === item ? "all" : item); setDirection("all"); }}
                label={text(locale, item)} count={sourceCounts.get(item)} testId={`${testId}-source-${item}`} icon={<Icon className="size-3.5" aria-hidden="true" />} />;
            })}
          </FilterRow>
          <FilterRow label={text(locale, "meaning")} icon={<Sparkles className="size-3.5" aria-hidden="true" />}>
            <FilterChip active={meaning === "all"} onClick={() => setMeaning("all")} label={text(locale, "all")} testId={`${testId}-meaning-all`} />
            {meaningOrder.filter(item => meaningCounts.has(item)).map(item => {
              const Icon = meaningIcons[item];
              return <FilterChip key={item} active={meaning === item} onClick={() => setMeaning(meaning === item ? "all" : item)}
                label={text(locale, item)} testId={`${testId}-meaning-${item}`} icon={<Icon className="size-3.5" aria-hidden="true" />} />;
            })}
          </FilterRow>
          <div className="flex flex-wrap items-center gap-2" aria-label={text(locale, "voiceChoices")}>
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{text(locale, "voiceChoices")}</span>
            {(["inbound", "outbound", "both"] as const).map(item => {
              const Icon = item === "inbound" ? ArrowDown : item === "outbound" ? ArrowUp : Phone;
              const active = direction === item || (item === "both" && direction === "all" && source === "calls");
              return <button key={item} type="button" onClick={() => {
                setSource("calls");
                setDirection(item === "both" ? "all" : direction === item ? "all" : item);
              }} aria-pressed={active} data-testid={`${testId}-voice-${item}`}
                className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${active ? "border-primary/35 bg-primary/10 font-medium text-primary" : "border-border bg-background text-muted-foreground hover:bg-muted"}`}>
                <Icon className="size-3.5" aria-hidden="true" />{text(locale, item)}
              </button>;
            })}
          </div>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <button type="button" onClick={() => choose(customValue)} data-testid={`${testId}-custom`}
            className={`mb-3 flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${value === customValue || !value ? "border-primary/35 bg-primary/[.055]" : "border-border bg-card hover:bg-muted/50"}`}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Plus className="size-4" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{customLabel || text(locale, "custom")}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{text(locale, "chooseHint")}</span>
            </span>
            {(value === customValue || !value) && <Check className="size-4 shrink-0 text-primary" aria-label={text(locale, "custom")} />}
          </button>

          {snapshotMissing && <button type="button" onClick={() => choose(snapshot!.id)}
            className={`mb-3 flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${value === snapshot!.id ? "border-amber-500/40 bg-amber-500/[.06]" : "border-border bg-card hover:bg-muted/50"}`}>
            <AutomationActivityTemplateIcon templateId={snapshot!.id} />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{snapshot!.name}</span><span className="block text-xs text-muted-foreground">{text(locale, "snapshotOnly")}</span></span>
            {value === snapshot!.id && <Check className="size-4 text-primary" aria-hidden="true" />}
          </button>}

          {filtered.length ? <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {filtered.map(({ template, source: itemSource, meanings, direction: itemDirection, missing }) => {
              const disabled = missing.length > 0;
              const selected = value === template.id;
              const hasSnapshot = snapshot?.id === template.id;
              return <button key={template.id} type="button" disabled={disabled} onClick={() => choose(template.id)}
                data-testid={`${testId}-template-${template.id}`}
                aria-describedby={disabled ? `${testId}-missing-${template.id}` : undefined}
                className={`group relative flex min-h-[112px] w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${disabled ? "cursor-not-allowed border-border/70 bg-muted/30 opacity-75" : selected ? "border-primary/40 bg-primary/[.055]" : "border-border bg-card hover:border-primary/25 hover:bg-muted/30"}`}>
                <AutomationActivityTemplateIcon templateId={template.id} type={template.type} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 truncate text-sm font-semibold">{template.name}</span>
                    {selected && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"><Check className="size-3" aria-hidden="true" />{text(locale, "current")}</span>}
                    {hasSnapshot && !selected && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{text(locale, "current")}</span>}
                    {template.language && <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{template.language}</span>}
                  </span>
                  <span className="mt-1.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{summaryFor(template, locale)}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">{text(locale, itemSource)}</span>
                    {meanings.slice(0, 2).map(item => <span key={item} className="rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">{text(locale, item)}</span>)}
                    {itemSource === "calls" && itemDirection && <span className="rounded-md border border-primary/15 bg-primary/[.04] px-1.5 py-0.5 text-[10px] text-primary">{text(locale, itemDirection)}</span>}
                    <span className="ml-auto text-[10px] text-muted-foreground">{variableCount(template)} {text(locale, "variableCount")}</span>
                  </span>
                  {disabled && <span id={`${testId}-missing-${template.id}`} className="mt-2 block text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    <span className="font-semibold">{text(locale, "missing")}:</span> {missing.map(item => `{{${item}}}`).join(", ")}
                  </span>}
                </span>
                {selected && <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />}
              </button>;
            })}
          </div> : <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
            <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Search className="size-4" aria-hidden="true" /></span>
            <p className="text-sm font-medium">{templates.length ? text(locale, "noMatches") : text(locale, "noTemplates")}</p>
            {templates.length > 0 && <button type="button" onClick={() => { setQuery(""); setSource("all"); setMeaning("all"); setDirection("all"); }}
              className="mt-2 text-xs font-medium text-primary underline-offset-4 hover:underline">{text(locale, "all")}</button>}
          </div>}
          <div aria-live="polite" className="sr-only">{filtered.length} {text(locale, "templates")}</div>
        </main>
        <footer className="flex shrink-0 items-center justify-between border-t border-border/70 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground sm:px-6">
          <span>{filtered.length} {text(locale, "templates")}</span>
          <button type="button" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary">
            {text(locale, "close")} <ChevronDown className="size-3.5" aria-hidden="true" />
          </button>
        </footer>
      </div>
      </DialogContent>
    </Dialog>;

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
      data-testid={testId}
      className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40">
      <span className="flex min-w-0 items-center gap-2.5">
        {selectedTemplate || unsupportedSnapshot ? <AutomationActivityTemplateIcon templateId={selectedTemplate?.id || snapshot!.id} type={selectedTemplate?.type} /> : null}
        <span className="truncate">{selectedName || (value === customValue || !value ? customLabel || text(locale, "custom") : value) || text(locale, "choose")}</span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
    {overlay}
  </>;
}

function entriesSortBySource<T extends { template: AutomationTemplatePickerTemplate }>(entries: T[], sourceModule?: string) {
  if (!sourceModule) return entries;
  const module = sourceModule.toLowerCase();
  const desired: SourceKey | null = /call|phone|voice/.test(module) ? "calls"
    : /task/.test(module) ? "tasks"
      : /email/.test(module) ? "email"
        : /sms|chat|communication/.test(module) ? "messages" : null;
  if (!desired) return entries;
  const relevant = (template: AutomationTemplatePickerTemplate) => {
    const source = classifySource(template);
    return source === desired || (desired === "calls" && source === "analysis");
  };
  return [...entries].sort((a, b) => Number(relevant(b.template)) - Number(relevant(a.template)));
}

function FilterRow({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return <div className="flex min-w-0 items-start gap-2.5">
    <span className="flex h-7 shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{icon}{label}</span>
    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{children}</div>
  </div>;
}

function FilterChip({ active, onClick, label, count, icon, testId }: {
  active: boolean; onClick: () => void; label: string; count?: number; icon?: ReactNode; testId?: string;
}) {
  return <button type="button" onClick={onClick} aria-pressed={active} data-testid={testId}
    className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${active ? "border-primary/35 bg-primary/10 font-medium text-primary" : "border-border bg-background text-muted-foreground hover:bg-muted"}`}>
    {icon}{label}{count !== undefined && <span className={`text-[10px] ${active ? "text-primary/75" : "text-muted-foreground/75"}`}>{count}</span>}
  </button>;
}
