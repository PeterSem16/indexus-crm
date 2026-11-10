import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { COUNTRIES } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RegionEntry = { name: string; count: number; values: string[] };
type CountryOption = { code: string; name: string; flag: string };
type SuggestionResult = {
  countryCode: string;
  mode: "official" | "balanced";
  source: "catalogue" | "ai";
  catalogue: RegionEntry[];
  unmapped: RegionEntry[];
  unknownCount: number;
  groups: { index: number; regions: string[]; count: number }[];
  total: number;
};
type Props = {
  entity: "clinic" | "hospital";
  criteria: any;
  onApply: (countryCode: string, regions: string[]) => void;
};

export function RepresentativeRegionSuggestions({ entity, criteria, onApply }: Props) {
  const { t } = useI18n();
  const c = t.representativeAssist;
  const scopedCountries: string[] = Array.isArray(criteria?.countryScope)
    ? criteria.countryScope.filter((code: unknown): code is string => typeof code === "string")
    : [];
  const countries = useMemo<CountryOption[]>(
    () => scopedCountries.length
      ? scopedCountries.map((code: string) => COUNTRIES.find((country: CountryOption) => country.code === code) || { code, name: code, flag: "" })
      : [...COUNTRIES],
    [JSON.stringify(scopedCountries)],
  );
  const [countryCode, setCountryCode] = useState(countries.length === 1 ? countries[0].code : "");
  const [mode, setMode] = useState<"official" | "balanced">("official");
  const [territories, setTerritories] = useState(4);
  const [result, setResult] = useState<SuggestionResult | null>(null);
  const [resultKey, setResultKey] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const requestKey = JSON.stringify({ entity, criteria, countryCode, mode, territories });
  const currentKey = useRef(requestKey);
  currentKey.current = requestKey;

  useEffect(() => {
    setResult(null);
    setResultKey("");
    setSelected([]);
    setError("");
    setLoading(false);
  }, [requestKey]);

  useEffect(() => {
    if (countries.length === 1) setCountryCode(countries[0].code);
    else if (countryCode && !countries.some(country => country.code === countryCode)) setCountryCode("");
  }, [entity, JSON.stringify(criteria), JSON.stringify(countries)]);

  const requestSuggestions = async () => {
    const key = currentKey.current;
    const id = ++requestId.current;
    setResult(null);
    setResultKey("");
    setSelected([]);
    setError("");
    if (!countryCode) {
      setError(c.selectCountryFirst);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/representatives/distribution/suggestions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, criteria, countryCode, mode, territories: Number(territories) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (id !== requestId.current || key !== currentKey.current) return;
      if (!response.ok) {
        const code = payload?.code;
        setError(code === "ai_unavailable" ? c.aiUnavailable
          : code === "ai_invalid" ? c.aiInvalid
            : code === "ai_error" ? c.aiError
              : code === "empty" ? c.noSuggestions
              : code === "scope" || code === "scope_error" ? c.scopeFailure : c.suggestionError);
        return;
      }
      setResult(payload as SuggestionResult);
      setResultKey(key);
    } catch {
      if (id === requestId.current && key === currentKey.current) setError(c.suggestionError);
    } finally {
      if (id === requestId.current && key === currentKey.current) setLoading(false);
    }
  };

  const setName = (name: string, checked: boolean) => {
    setSelected(previous => checked
      ? previous.includes(name) ? previous : [...previous, name]
      : previous.filter(value => value !== name));
  };
  const apply = () => {
    if (!result || resultKey !== requestKey || result.countryCode !== countryCode || !selected.length) {
      if (!selected.length) setError(c.noSelection);
      return;
    }
    const entries = [...result.catalogue, ...result.unmapped];
    const values = selected.flatMap(name => {
      const entry = entries.find(item => item.name === name);
      return entry?.values?.length ? entry.values : [name];
    });
    onApply(result.countryCode, Array.from(new Set(values.filter(value => value.trim().length > 0))));
  };
  const chooseGroup = (regions: string[]) => {
    setSelected(previous => Array.from(new Set([...previous, ...regions])));
    setError("");
  };
  const selectedKeys = new Set(selected);

  return <section className="space-y-3 border-t pt-4" data-testid="representative-region-suggestions">
    <div>
      <h3 className="text-sm font-semibold">{c.suggestionsTitle}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{c.suggestionsHelp}</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs">{c.country}</Label>
        <Select value={countryCode || "__choose"} onValueChange={value => setCountryCode(value === "__choose" ? "" : value)}>
          <SelectTrigger data-testid="suggestion-country"><SelectValue placeholder={c.chooseCountry} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__choose">{c.chooseCountry}</SelectItem>
            {countries.map(country => <SelectItem key={country.code} value={country.code}>{country.name} · {country.code}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{c.officialMode} / {c.balancedMode}</Label>
        <Select value={mode} onValueChange={value => setMode(value as "official" | "balanced")}>
          <SelectTrigger data-testid="suggestion-mode"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="official">{c.officialMode}</SelectItem>
            <SelectItem value="balanced">{c.balancedMode}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    {mode === "balanced" && <div className="space-y-1.5">
      <Label className="text-xs">{c.territories}</Label>
      <Select value={String(territories)} onValueChange={value => setTerritories(Math.max(2, Math.min(10, Number(value))))}>
        <SelectTrigger data-testid="suggestion-territories"><SelectValue /></SelectTrigger>
        <SelectContent>{Array.from({ length: 9 }, (_, index) => index + 2).map(value =>
          <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent>
      </Select>
    </div>}
    <Button type="button" variant="outline" size="sm" data-testid="suggestion-load" onClick={requestSuggestions} disabled={loading}>
      {loading ? c.loading : c.suggestionsTitle}
    </Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {result && resultKey === requestKey && result.countryCode === countryCode && <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{c.portfolioTotal}: {result.total}</span>
        <span>{c.unknownCount}: {result.unknownCount}</span>
      </div>
      <p className="text-xs text-muted-foreground">{c.unknownNotSelectable}</p>
      {mode === "balanced" && result.groups.length > 0 && <div className="space-y-2">
        {result.groups.map(group => <div key={group.index} data-testid={`suggestion-group-${group.index}`} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
          <div className="min-w-0"><span>{c.territories} {group.index + 1} · {group.count}</span>
            <p className="mt-1 text-xs text-muted-foreground break-words">{group.regions.join(", ")}</p></div>
          <Button type="button" variant="outline" size="sm" onClick={() => chooseGroup(group.regions)}>{c.selectGroup}</Button>
        </div>)}
      </div>}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold">{c.officialRegions}</h4>
        {!result.catalogue.length && <p className="text-xs text-muted-foreground">{c.noSuggestions}</p>}
        {result.catalogue.map((entry, index) => <label key={entry.name} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
          <Checkbox data-testid={`suggestion-region-${index}`} checked={selectedKeys.has(entry.name)} onCheckedChange={checked => setName(entry.name, checked === true)} />
          <span className="min-w-0 flex-1">{entry.name}</span><span className="text-xs tabular-nums text-muted-foreground">{entry.count}</span>
        </label>)}
      </div>
      {result.unmapped.length > 0 && <div className="space-y-2">
        <h4 className="text-xs font-semibold">{c.unmatchedRegions}</h4>
        {result.unmapped.map((entry, index) => <label key={entry.name} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
          <Checkbox data-testid={`suggestion-unmapped-region-${index}`} checked={selectedKeys.has(entry.name)} onCheckedChange={checked => setName(entry.name, checked === true)} />
          <span className="min-w-0 flex-1">{entry.name}</span><span className="text-xs tabular-nums text-muted-foreground">{entry.count}</span>
        </label>)}
      </div>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" data-testid="suggestion-apply" onClick={apply} disabled={!selected.length}>{c.applyFilter}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])} disabled={!selected.length}>{c.clear}</Button>
      </div>
    </>}
  </section>;
}
