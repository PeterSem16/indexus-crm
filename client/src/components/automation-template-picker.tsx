import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown, ArrowUp, Bell, CalendarClock, Check, ChevronDown, CircleCheck,
  Clock3, Filter, Mail, MessageSquare, Phone, Plus, RefreshCw, Search, Sparkles,
  Target, X, AlertCircle, CheckCircle2, SlidersHorizontal, Eye,
} from "lucide-react";
import { activityTemplateUsedVariables } from "./automation-activity-template-utils";
import { AutomationActivityTemplateIcon } from "./automation-activity-template-icon";
import { templateVisualTone } from "@shared/automation-template-visual";
import { automationTemplatePickerCopy as text } from "@shared/automation-template-picker-copy";
import { classifyMeanings, classifySource } from "./automation-template-classification";
import { templateEligibility } from "./automation-template-eligibility";
import { templateFieldLabel } from "./automation-template-field-label";
import { activityTemplateLabel, type ActivityTemplateLanguage } from "@shared/automation-activity-template-copy";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export { classifyMeanings, classifySource } from "./automation-template-classification";

export type AutomationTemplatePickerTemplate = {
  id: string;
  name: string;
  subject?: unknown;
  content?: unknown;
  contentHtml?: unknown;
  language?: string | null;
  type?: string;
  isActive?: boolean;
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

type SourceKey = "calls" | "tasks" | "email" | "messages" | "records" | "notifications" | "analysis" | "other";
type MeaningKey = "sentiment" | "tone" | "success" | "urgency" | "deadlines";
type Direction = "all" | "inbound" | "outbound";
type Availability = "usable" | "unavailable" | "all";
type TemplateEntry = {
  template: AutomationTemplatePickerTemplate;
  source: SourceKey;
  meanings: MeaningKey[];
  direction: "inbound" | "outbound" | "both" | null;
  usable: boolean;
  missing: string[];
  requiredSource: SourceKey | null;
  requiredModule: string | null;
  sourceMismatch: boolean;
  analysisRequired: boolean;
};

const wordPattern = /{{\s*([^{}]+?)\s*}}/g;
const PAGE_SIZE = 40;

function normalized(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ");
}

function templateTexts(template: AutomationTemplatePickerTemplate) {
  return [template.subject, template.contentHtml, template.content]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function plainText(value: string) {
  return value.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ").trim();
}

function safePreview(value: string, locale: string, availableVariables: AutomationTemplatePickerVariable[]) {
  return plainText(value).replace(wordPattern, (_match, key: string) => {
    const cleanKey = key.trim();
    const label = templateFieldLabel(cleanKey, locale, availableVariables);
    return label.startsWith("{{") ? `${text(locale, "unknownVariable")}: ${label}` : `[${label}]`;
  });
}

function getVoiceDirection(template: AutomationTemplatePickerTemplate): "inbound" | "outbound" | "both" | null {
  if (classifySource(template) !== "calls") return null;
  const identity = normalized(`${template.id} ${template.name}`);
  if (/inbound|incoming|received/.test(identity)) return "inbound";
  if (/outbound|outgoing|started/.test(identity)) return "outbound";
  return "both";
}

function variableCount(template: AutomationTemplatePickerTemplate) {
  return activityTemplateUsedVariables(template).length;
}

function sourceDisplayKey(source: string | null | undefined): string {
  if (!source) return "anySource";
  const value = source.toLowerCase().replace(/[_\s-]+/g, "");
  if (/call|phone|voice/.test(value)) return "calls";
  if (/task|todo/.test(value)) return "tasks";
  if (/email/.test(value)) return "email";
  if (/sms|chat|message|communication/.test(value)) return value === "communication" ? "analysis" : "messages";
  if (/record|clinic|hospital|customer|invoice|contract|campaign|collection|product|metric/.test(value)) return "records";
  if (/notification/.test(value)) return "notifications";
  if (/analysis/.test(value)) return "analysis";
  return "other";
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
  const [availability, setAvailability] = useState<Availability>("usable");
  const [refinementsOpen, setRefinementsOpen] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedTemplate = templates.find(template => template.id === value);
  const selectedName = selectedTemplate?.name || (snapshot && snapshot.id === value ? snapshot.name : undefined);
  const snapshotMissing = snapshot && !templates.some(template => template.id === snapshot.id);
  const unsupportedSnapshot = snapshot && value === snapshot.id && !selectedTemplate;

  const entries = useMemo<TemplateEntry[]>(() => {
    const catalogEntries = templates.map(template => {
      const eligibility = templateEligibility(template, availableVariables, sourceModule);
      return {
        template,
        source: classifySource(template),
        meanings: classifyMeanings(template),
        direction: getVoiceDirection(template),
        usable: eligibility.usable && template.isActive !== false,
        missing: eligibility.missing,
        requiredSource: eligibility.requiredSource,
        requiredModule: eligibility.requiredModule,
        sourceMismatch: eligibility.sourceMismatch,
        analysisRequired: eligibility.analysisRequired,
      };
    });
    return entriesSortBySource(catalogEntries, sourceModule);
  }, [templates, availableVariables, sourceModule]);

  const availabilityCounts = useMemo(() => ({
    usable: entries.filter(entry => entry.usable).length,
    unavailable: entries.filter(entry => !entry.usable).length,
    all: entries.length,
  }), [entries]);

  const filtered = useMemo(() => {
    const needle = normalized(query.trim());
    return entries.filter(({ template, source: itemSource, meanings, direction: itemDirection, usable }) => {
      if (availability === "usable" && !usable) return false;
      if (availability === "unavailable" && usable) return false;
      if (source !== "all" && source !== itemSource && !(source === "calls" && itemSource === "analysis")) return false;
      if (meaning !== "all" && !meanings.includes(meaning)) return false;
      if (direction !== "all" && itemSource === "calls" && itemDirection !== direction && itemDirection !== "both") return false;
      if (direction !== "all" && itemSource !== "calls" && !(source === "calls" && itemSource === "analysis")) return false;
      if (!needle) return true;
      return normalized(`${template.name} ${template.id} ${templateTexts(template).join(" ")}`).includes(needle);
    });
  }, [entries, query, source, meaning, direction, availability]);

  const visibleEntries = filtered.slice(0, visibleLimit);
  const availabilityEntries = entries.filter(entry => availability === "all" || entry.usable === (availability === "usable"));
  const sourceCounts = useMemo(() => {
    const counts = new Map<SourceKey, number>();
    entries.filter(entry => availability === "all" || entry.usable === (availability === "usable"))
      .forEach(entry => counts.set(entry.source, (counts.get(entry.source) || 0) + 1));
    return counts;
  }, [entries, availability]);
  const meaningCounts = useMemo(() => {
    const counts = new Map<MeaningKey, number>();
    entries.filter(entry => (availability === "all" || entry.usable === (availability === "usable")) &&
      (source === "all" || source === entry.source || (source === "calls" && entry.source === "analysis")))
      .forEach(entry => entry.meanings.forEach(item => counts.set(item, (counts.get(item) || 0) + 1)));
    return counts;
  }, [entries, availability, source]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  useEffect(() => setVisibleLimit(PAGE_SIZE), [query, source, meaning, direction, availability]);

  function choose(id: string) {
    onSelect(id);
    setOpen(false);
  }
  async function refresh() {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    setRefreshFailed(false);
    try { await onRefresh(); } catch { setRefreshFailed(true); } finally { setRefreshing(false); }
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
      <div aria-labelledby={`${testId}-title`} aria-describedby={`${testId}-hint`}
        className="flex max-h-[min(850px,96dvh)] min-h-0 w-full max-w-[1000px] flex-col overflow-hidden rounded-t-2xl border border-border bg-background text-foreground shadow-[0_24px_80px_-24px_rgba(15,23,42,.38)] sm:max-h-[min(850px,94dvh)] sm:min-h-[min(560px,82dvh)] sm:rounded-2xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-[0.99] motion-safe:duration-150">
        <header className="shrink-0 border-b border-border/80 bg-[linear-gradient(105deg,hsl(var(--primary)/.075),transparent_65%)] px-4 pb-3 pt-3 sm:px-6 sm:pb-4 sm:pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.15em] text-primary">
                <Sparkles className="size-3.5" aria-hidden="true" /><span>{text(locale, "choose")}</span>
              </div>
              <h2 id={`${testId}-title`} className="font-display text-lg font-semibold tracking-tight sm:text-2xl">{text(locale, "choose")}</h2>
              <p id={`${testId}-hint`} className="mt-0.5 text-xs text-muted-foreground sm:mt-1 sm:text-sm">{text(locale, "chooseHint")}</p>
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
          {(meaning === "tone" || meaning === "sentiment") && entries.some(entry => entry.analysisRequired) &&
            <p role="status" className="mt-2 rounded-lg border border-primary/15 bg-primary/[.045] p-2.5 text-xs leading-relaxed text-foreground sm:mt-3 sm:p-3">{text(locale, "analysisRequired")}</p>}
          <div className="relative mt-3 sm:mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)}
              placeholder={text(locale, "search")} aria-label={text(locale, "search")} data-testid={`${testId}-search`}
              className="h-10 w-full rounded-xl border border-border bg-background/90 pl-10 pr-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 sm:h-11" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-muted/65 p-1 sm:mt-4 sm:gap-2">
            {(["usable", "unavailable", "all"] as const).map(item => <button key={item} type="button"
              onClick={() => setAvailability(item)} aria-pressed={availability === item}
              data-testid={`${testId}-availability-${item}`}
              className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-1.5 text-[11px] font-medium transition-colors sm:gap-2 sm:text-xs ${availability === item ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {item === "usable" ? <CheckCircle2 className="size-3.5 text-emerald-700" aria-hidden="true" /> : item === "unavailable" ? <AlertCircle className="size-3.5 text-amber-700" aria-hidden="true" /> : null}
              <span>{text(locale, item)}</span><span className="tabular-nums text-[10px] opacity-75">{availabilityCounts[item]}</span>
            </button>)}
          </div>
        </header>

        <div className="shrink-0 border-b border-border/70 px-4 py-2.5 sm:px-6 sm:py-3">
          <button type="button" onClick={() => setRefinementsOpen(value => !value)}
            aria-expanded={refinementsOpen} aria-controls={`${testId}-refinements`}
            className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground sm:hidden">
            <span className="flex items-center gap-2"><SlidersHorizontal className="size-3.5" aria-hidden="true" />{text(locale, "refine")}</span>
            <span className="flex items-center gap-2">{text(locale, "refinementsHint")}<ChevronDown className={`size-3.5 transition-transform ${refinementsOpen ? "rotate-180" : ""}`} /></span>
          </button>
          <div id={`${testId}-refinements`} className={`${refinementsOpen ? "mt-3 block" : "hidden"} space-y-3 sm:block`}>
            <FilterRow label={text(locale, "source")} icon={<Filter className="size-3.5" aria-hidden="true" />}>
              <FilterChip active={source === "all"} onClick={() => { setSource("all"); setDirection("all"); }} label={text(locale, "all")} count={availabilityEntries.length} testId={`${testId}-source-all`} />
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
            {(source === "calls" || sourceCounts.has("calls")) && <div className="flex flex-wrap items-center gap-2" aria-label={text(locale, "voiceChoices")}>
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{text(locale, "voiceChoices")}</span>
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
            </div>}
          </div>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span><strong className="font-semibold text-foreground">{filtered.length}</strong> {text(locale, "matchingOf")} {entries.length} {text(locale, "templates")}</span>
            {filtered.length > 0 && <span>{text(locale, "showing")} {Math.min(visibleLimit, filtered.length)} {text(locale, "of")} {filtered.length}</span>}
          </div>
          <button type="button" onClick={() => choose(customValue)} data-testid={`${testId}-custom`}
            className={`mb-3 flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${value === customValue || !value ? "border-primary/35 bg-primary/[.055]" : "border-border bg-card hover:bg-muted/50"}`}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Plus className="size-4" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{customLabel || text(locale, "custom")}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{text(locale, "customHint")}</span></span>
            {(value === customValue || !value) && <Check className="size-4 shrink-0 text-primary" aria-label={text(locale, "custom")} />}
          </button>
          {snapshotMissing && <button type="button" onClick={() => choose(snapshot!.id)}
            className={`mb-3 flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${value === snapshot!.id ? "border-amber-500/40 bg-amber-500/[.06]" : "border-border bg-card hover:bg-muted/50"}`}>
            <AutomationActivityTemplateIcon templateId={snapshot!.id} />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{snapshot!.name}</span><span className="block text-xs text-muted-foreground">{text(locale, "snapshotOnly")}</span></span>
            {value === snapshot!.id && <Check className="size-4 text-primary" aria-hidden="true" />}
          </button>}

          {visibleEntries.length ? <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {visibleEntries.map(({ template, source: itemSource, meanings, direction: itemDirection, usable, missing, requiredSource, requiredModule, sourceMismatch, analysisRequired }) => {
              const selected = value === template.id;
              const hasSnapshot = snapshot?.id === template.id;
              const reasonItems: string[] = [];
              if (template.isActive === false) reasonItems.push(text(locale, "adminDisabled"));
              if (sourceMismatch) {
                reasonItems.push(text(locale, "sourceMismatch")
                  .replace("{required}", requiredModule ? activityTemplateLabel(locale as ActivityTemplateLanguage, requiredModule) : text(locale, sourceDisplayKey(requiredSource)))
                  .replace("{current}", requiredModule && sourceModule ? activityTemplateLabel(locale as ActivityTemplateLanguage, sourceModule) : text(locale, sourceDisplayKey(sourceModule))));
              }
              if (missing.length) {
                reasonItems.push(`${text(locale, "missing")}: ${missing.map(key => templateFieldLabel(key, locale, availableVariables)).join(", ")}`);
              }
              if (analysisRequired) reasonItems.push(text(locale, "analysisRequiredShort"));
              const identity = safePreview(typeof template.subject === "string" ? template.subject : template.name, locale, availableVariables);
              const content = typeof template.content === "string" && template.content.trim() ? template.content :
                templateTexts(template).find(item => item !== template.subject) || (typeof template.subject === "string" ? template.subject : "");
              const preview = safePreview(content, locale, availableVariables);
              const deadline = meanings.includes("deadlines") || templateVisualTone(template.id) === "deadline";
              return <button key={template.id} type="button" disabled={!usable} onClick={() => choose(template.id)}
                data-testid={`${testId}-template-${template.id}`}
                aria-describedby={`${testId}-eligibility-${template.id}`}
                className={`group relative flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:p-3.5 ${!usable ? "cursor-not-allowed border-border/70 bg-muted/30" : selected ? "border-primary/40 bg-primary/[.055]" : "border-border bg-card hover:border-primary/25 hover:bg-muted/30"}`}>
                <AutomationActivityTemplateIcon templateId={template.id} type={template.type} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 truncate text-sm font-semibold">{template.name}</span>
                    {selected && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"><Check className="size-3" aria-hidden="true" />{text(locale, "current")}</span>}
                    {hasSnapshot && !selected && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{text(locale, "current")}</span>}
                    {template.language && <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{template.language}</span>}
                  </span>
                  <span className="mt-2 block rounded-lg border border-border/70 bg-background/75 px-2.5 py-2">
                    <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[.11em] text-muted-foreground"><Eye className="size-3" aria-hidden="true" />{text(locale, "preview")}</span>
                    <span className="mt-1 block text-xs font-semibold leading-snug text-foreground">{identity || template.name}</span>
                    {preview && <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-muted-foreground">{preview}</span>}
                    {deadline && <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
                      <CalendarClock className="size-3" aria-hidden="true" />{text(locale, "deadlineContext")}{activityTemplateUsedVariables(template).filter(key => /due|deadline|expiry|expires/i.test(key)).map(key => {
                        return ` · ${templateFieldLabel(key, locale, availableVariables)}`;
                      })}
                    </span>}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">{text(locale, itemSource)}</span>
                    {meanings.slice(0, 2).map(item => <span key={item} className="rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">{text(locale, item)}</span>)}
                    {itemSource === "calls" && itemDirection && <span className="rounded-md border border-primary/15 bg-primary/[.04] px-1.5 py-0.5 text-[10px] text-primary">{text(locale, itemDirection)}</span>}
                    <span className="ml-auto text-[10px] text-muted-foreground">{variableCount(template)} {text(locale, "variableCount")}</span>
                  </span>
                  <span id={`${testId}-eligibility-${template.id}`} className={`mt-2 flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[11px] leading-relaxed ${usable ? "bg-emerald-700/[.07] text-emerald-800 dark:text-emerald-300" : "bg-amber-600/[.08] text-amber-900 dark:text-amber-200"}`}>
                    {usable ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> : <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />}
                    <span><strong className="font-semibold">{usable ? text(locale, "usableStatus") : text(locale, "unavailableStatus")}</strong>
                      <span className="ml-1">{usable ? text(locale, "eligibleExplanation") : reasonItems.join(" · ") || text(locale, "unavailableExplanation")}</span>
                    </span>
                  </span>
                  {missing.some(key => templateFieldLabel(key, locale, availableVariables).startsWith("{{")) &&
                    <span className="mt-1.5 block text-[10px] leading-relaxed text-muted-foreground">{text(locale, "unknownVariableHelp")}</span>}
                </span>
                {selected && <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />}
              </button>;
            })}
          </div> : <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center sm:min-h-44">
            <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Search className="size-4" aria-hidden="true" /></span>
            <p className="text-sm font-medium">{templates.length ? text(locale, "noMatches") : text(locale, "noTemplates")}</p>
            {templates.length > 0 && <button type="button" onClick={() => { setQuery(""); setSource("all"); setMeaning("all"); setDirection("all"); setAvailability("all"); }}
              className="mt-2 text-xs font-medium text-primary underline-offset-4 hover:underline">{text(locale, "clearFilters")}</button>}
          </div>}
          {filtered.length > visibleLimit && <button type="button" onClick={() => setVisibleLimit(limit => limit + PAGE_SIZE)}
            className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-muted/40">
            {text(locale, "showMore")} <span className="text-xs text-muted-foreground">({Math.min(PAGE_SIZE, filtered.length - visibleLimit)} {text(locale, "more")})</span>
          </button>}
          <div aria-live="polite" className="sr-only">{filtered.length} {text(locale, "templates")}</div>
        </main>
        <footer className="flex shrink-0 items-center justify-between border-t border-border/70 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground sm:px-6">
          <span>{Math.min(visibleLimit, filtered.length)} {text(locale, "of")} {filtered.length} {text(locale, "matchingTemplates")}</span>
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
  const desired = sourceDisplayKey(sourceModule);
  if (desired === "other") return entries;
  const relevant = (template: AutomationTemplatePickerTemplate) => {
    const source = classifySource(template);
    return source === desired || (desired === "calls" && source === "analysis") || (desired === "analysis" && source === "messages");
  };
  return [...entries].sort((a, b) => Number(relevant(b.template)) - Number(relevant(a.template)));
}

function FilterRow({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return <div className="flex min-w-0 items-start gap-2.5">
    <span className="flex h-7 shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{icon}{label}</span>
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
