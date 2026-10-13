import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, LoaderCircle, Search } from "lucide-react";
import { useI18n } from "@/i18n";
import { getConditionChoiceCopy } from "@/i18n/automation-condition-choice-copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Option = { value: string; label: string };

type Props = {
  field: string;
  module: string;
  eventType: string;
  countryCodes: string[];
  value: unknown;
  multiple: boolean;
  onChange(value: any): void;
};

const extraCopy: Record<string, { search: string; searchHint: string; loading: string; error: string; retry: string; noResults: string; truncated: string }> = {
  en: { search: "Search names, phone or email", searchHint: "Search names, phone or email…", loading: "Searching…", error: "Could not load options.", retry: "Retry", noResults: "No matching options.", truncated: "Showing the closest matches." },
  sk: { search: "Hľadať mená, telefón alebo e-mail", searchHint: "Hľadať mená, telefón alebo e-mail…", loading: "Vyhľadáva sa…", error: "Možnosti sa nepodarilo načítať.", retry: "Skúsiť znova", noResults: "Nenašli sa žiadne možnosti.", truncated: "Zobrazujú sa najbližšie zhody." },
  cs: { search: "Hledat jména, telefon nebo e-mail", searchHint: "Hledat jména, telefon nebo e-mail…", loading: "Vyhledávání…", error: "Možnosti se nepodařilo načíst.", retry: "Zkusit znovu", noResults: "Nebyly nalezeny žádné možnosti.", truncated: "Zobrazují se nejbližší shody." },
  hu: { search: "Keresés név, telefon vagy e-mail alapján", searchHint: "Keresés név, telefon vagy e-mail alapján…", loading: "Keresés…", error: "A lehetőségek betöltése nem sikerült.", retry: "Újrapróbálás", noResults: "Nincs egyező lehetőség.", truncated: "A legközelebbi találatok láthatók." },
  ro: { search: "Caută nume, telefon sau e-mail", searchHint: "Caută nume, telefon sau e-mail…", loading: "Se caută…", error: "Opțiunile nu au putut fi încărcate.", retry: "Reîncearcă", noResults: "Nu există opțiuni potrivite.", truncated: "Sunt afișate cele mai apropiate rezultate." },
  it: { search: "Cerca nomi, telefono o e-mail", searchHint: "Cerca nomi, telefono o e-mail…", loading: "Ricerca…", error: "Impossibile caricare le opzioni.", retry: "Riprova", noResults: "Nessuna opzione corrispondente.", truncated: "Sono mostrati i risultati più vicini." },
  de: { search: "Namen, Telefon oder E-Mail suchen", searchHint: "Namen, Telefon oder E-Mail suchen…", loading: "Suche…", error: "Optionen konnten nicht geladen werden.", retry: "Erneut versuchen", noResults: "Keine passenden Optionen.", truncated: "Die ähnlichsten Treffer werden angezeigt." },
};

function selectedValues(value: unknown, multiple: boolean): string[] {
  if (multiple) return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  return typeof value === "string" && value !== "" ? [value] : [];
}

export function AutomationConditionReferencePicker({
  field, module, eventType, countryCodes, value, multiple, onChange,
}: Props) {
  const { locale } = useI18n();
  const common = getConditionChoiceCopy(locale);
  const copy = extraCopy[locale] || extraCopy.en;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const requestVersion = useRef(0);
  const [savedLabels, setSavedLabels] = useState<{ scope: string; labels: Record<string, string> }>({ scope: "", labels: {} });
  const chosen = useMemo(() => selectedValues(value, multiple), [value, multiple]);
  const countries = countryCodes.map(code => code.toUpperCase()).join(",");
  const scope = JSON.stringify([field, module, eventType, countries]);
  const chosenKey = chosen.join(",");
  useEffect(() => {
    const controller = new AbortController();
    const ids = chosenKey.split(",").filter(Boolean).slice(0, 20);
    if (!ids.length) return;
    void Promise.all(ids.map(async id => {
      const params = new URLSearchParams({ field, module, eventType, q: id, countryCodes: countries });
      const response = await fetch(`/api/automation/condition-options?${params}`, { credentials: "include", signal: controller.signal });
      if (!response.ok) throw new Error("condition-options");
      const data = await response.json();
      return (data.options || []).filter((option: Option) => option.value === id);
    })).then(lists => {
      if (!controller.signal.aborted) setSavedLabels({ scope, labels: Object.fromEntries(lists.flat().map(option => [option.value, option.label])) });
    }).catch(() => { if (!controller.signal.aborted) setSavedLabels({ scope, labels: {} }); });
    return () => controller.abort();
  }, [scope, chosenKey]);

  useEffect(() => {
    if (!open) return;
    const version = ++requestVersion.current;
    const controller = new AbortController();
    setOptions([]);
    setTruncated(false);
    setLoading(true);
    setError(false);
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ field, module, eventType, q: query.trim(), countryCodes: countries });
        const response = await fetch(`/api/automation/condition-options?${params.toString()}`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("condition-options");
        const data = await response.json();
        if (requestVersion.current !== version || controller.signal.aborted) return;
        const next = Array.isArray(data.options)
          ? data.options.filter((option: unknown): option is Option =>
            Boolean(option && typeof option === "object" &&
              typeof (option as Option).value === "string" &&
              typeof (option as Option).label === "string"))
          : [];
        setOptions(next);
        setTruncated(Boolean(data.truncated));
        setError(false);
      } catch {
        if (requestVersion.current === version && !controller.signal.aborted) {
          setError(true);
          setOptions([]);
          setTruncated(false);
        }
      } finally {
        if (requestVersion.current === version && !controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (requestVersion.current === version) requestVersion.current += 1;
    };
  }, [open, query, field, module, eventType, countries, retryCount]);

  const listed = new Map<string, Option>();
  options.forEach(option => listed.set(option.value, option));
  const savedMissing = chosen.filter(item => !listed.has(item)).map(item => ({ value: item, label: item }));
  const visibleOptions = [...savedMissing, ...options];
  const labelFor = (item: string) => listed.get(item)?.label || (savedLabels.scope === scope ? savedLabels.labels[item] : undefined) || `${item} · ${common.saved}`;
  const summary = chosen.length
    ? chosen.map(labelFor).join(", ")
    : multiple ? common.choose : common.chooseOne;

  const toggle = (option: Option) => {
    if (multiple) {
      onChange(chosen.includes(option.value)
        ? chosen.filter(item => item !== option.value)
        : [...chosen, option.value]);
    } else {
      onChange(option.value);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open}
          className="h-10 w-full min-w-0 justify-between gap-2 text-left text-sm"
          data-testid="condition-reference-picker">
          <span className="truncate">{summary}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom"
        className="automation-rule-select-content z-[10050] w-[min(28rem,calc(100vw-2rem))] p-2"
        onOpenAutoFocus={event => event.preventDefault()}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input autoFocus value={query} placeholder={copy.searchHint} aria-label={copy.search}
            data-testid="condition-reference-search" className="h-10 pl-9 text-sm"
            onChange={event => setQuery(event.target.value)} />
        </div>
        <div className="mt-2 max-h-[min(50dvh,22rem)] overflow-y-auto overscroll-contain" role="listbox"
          aria-multiselectable={multiple}>
          {savedMissing.length > 0 && <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {common.saved}
          </div>}
          {visibleOptions.map(option => {
            const selected = chosen.includes(option.value);
            return (
              <button type="button" role="option" aria-selected={selected} key={option.value}
                onClick={() => toggle(option)}
                className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="min-w-0 flex-1 break-words">{option.label}</span>
                {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
              </button>
            );
          })}
          {loading && <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />{copy.loading}
          </div>}
          {error && <div className="flex items-center justify-between gap-3 px-3 py-3 text-sm text-destructive" role="alert">
            <span>{copy.error}</span>
            <button type="button" className="shrink-0 underline underline-offset-2" onClick={() => setRetryCount(count => count + 1)}>
              {copy.retry}
            </button>
          </div>}
          {!loading && !error && visibleOptions.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">{copy.noResults}</p>}
          {truncated && !error && <p className="px-3 py-2 text-xs text-muted-foreground">{copy.truncated}</p>}
        </div>
        {multiple && <p className="border-t px-3 pt-2 text-xs text-muted-foreground">{common.choose}</p>}
      </PopoverContent>
    </Popover>
  );
}
