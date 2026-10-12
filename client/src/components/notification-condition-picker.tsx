import { useMemo } from "react";
import { Check, CircleHelp, Sparkles } from "lucide-react";
import type { Locale } from "@/i18n";
import { getCommunicationAnalysisCopy } from "@/lib/communication-analysis-copy";
import { Button } from "@/components/ui/button";

type ConditionKey = "countryCode" | "provider" | "sentiment" | "alertLevel" | "hasAngryTone" | "hasRudeExpressions" | "wantsToCancel" | "wantsConsent" | "doesNotAcceptContract";
const countries = ["SK", "CZ", "HU", "RO", "IT", "DE", "AT", "PL", "GB", "US"];
const providers = ["smstools", "bulkgate"];
const sentimentValues = ["positive", "neutral", "negative", "angry"];
const alertValues = ["none", "warning", "critical"];
const booleanKeys: ConditionKey[] = ["hasAngryTone", "hasRudeExpressions", "wantsToCancel", "wantsConsent", "doesNotAcceptContract"];
const supportedKeys = new Set<ConditionKey>(["countryCode", "provider", "sentiment", "alertLevel", ...booleanKeys]);

function readObject(value: unknown): Record<string, unknown> | null {
  if (value == null || value === "") return {};
  let candidate = value;
  if (typeof candidate === "string") {
    try { candidate = JSON.parse(candidate); } catch { return null; }
  }
  return candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate as Record<string, unknown> : null;
}

function valuesFor(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(item => typeof item === "string" || typeof item === "number").map(String);
  return value === undefined || value === null ? [] : [String(value)];
}
function readBoolean(value: unknown): { choice: "any" | "yes" | "no"; unsupported: boolean } {
  if (value === undefined || value === null) return { choice: "any", unsupported: false };
  const candidate = Array.isArray(value) && value.length === 1 ? value[0] : value;
  if (candidate === true) return { choice: "yes", unsupported: false };
  if (candidate === false) return { choice: "no", unsupported: false };
  return { choice: "any", unsupported: true };
}

export function NotificationConditionPicker({
  value, onChange, locale, triggerType,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  locale: Locale;
  triggerType: string;
}) {
  const copy = getCommunicationAnalysisCopy(locale);
  const conditions = readObject(value);
  const options = useMemo(() => ({
    countryCode: Array.from(new Set([...countries, ...valuesFor(conditions?.countryCode)])),
    provider: Array.from(new Set([...providers, ...valuesFor(conditions?.provider)])),
    sentiment: Array.from(new Set([...sentimentValues, ...valuesFor(conditions?.sentiment)])),
    alertLevel: Array.from(new Set([...alertValues, ...valuesFor(conditions?.alertLevel)])),
  }), [conditions?.countryCode, conditions?.provider, conditions?.sentiment, conditions?.alertLevel]);
  const isAnalysis = triggerType === "new_sms" || triggerType === "sentiment_negative";
  const setKey = (key: ConditionKey, next: unknown) => {
    if (!conditions) return;
    const updated = { ...conditions };
    if (next === undefined || (Array.isArray(next) && next.length === 0)) delete updated[key];
    else updated[key] = next;
    onChange(Object.keys(updated).length ? updated : null);
  };
  const toggleValue = (key: "countryCode" | "provider" | "sentiment" | "alertLevel", option: string) => {
    if (!conditions) return;
    const current = valuesFor(conditions[key]);
    const next = current.includes(option) ? current.filter(item => item !== option) : [...current, option];
    setKey(key, next);
  };
  const booleanState = (key: ConditionKey) => readBoolean(conditions?.[key]);
  const booleanValue = (key: ConditionKey) => booleanState(key).choice;
  const labelFor = (key: ConditionKey) => copy.fieldLabels[`newValues.${key}` as keyof typeof copy.fieldLabels];
  const renderOptions = (key: "countryCode" | "provider" | "sentiment" | "alertLevel", list: string[]) => {
    const selected = valuesFor(conditions?.[key]);
    return <div className="flex flex-wrap gap-2">
      {list.map(option => {
        const active = selected.includes(option);
        const label = key === "sentiment" || key === "alertLevel" ? copy.optionLabels[option] || option
          : key === "provider" ? option === "smstools" ? "SMS.to" : "BulkGate"
          : option;
        return <button type="button" key={option} aria-pressed={active} onClick={() => toggleValue(key, option)}
          data-testid={`condition-${key}-${option}`} data-value={option}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors duration-150 ${active ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-background/70 text-foreground hover:bg-muted"}`}>
          {active && <Check className="h-3 w-3" />}{label}
        </button>;
      })}
    </div>;
  };
  const hasUnsupported = conditions && Object.keys(conditions).some(key => !supportedKeys.has(key as ConditionKey));
  const conditionCount = conditions ? Object.keys(conditions).filter(key => supportedKeys.has(key as ConditionKey)).length : 0;
  const hasComplexBoolean = conditions ? booleanKeys.some(key => booleanState(key).unsupported) : false;
  const savedSummary = conditions ? Object.entries(conditions).filter(([key]) => supportedKeys.has(key as ConditionKey)).map(([key, raw]) => {
    const typedKey = key as ConditionKey;
    const values = booleanKeys.includes(typedKey) ? (() => {
      const state = readBoolean(raw);
      return state.unsupported ? [copy.preservedCondition] : state.choice === "any" ? [] : [copy[state.choice]];
    })() : valuesFor(raw).map(item => typedKey === "sentiment" || typedKey === "alertLevel" ? copy.optionLabels[item] || item : typedKey === "provider" ? item === "smstools" ? "SMS.to" : "BulkGate" : item);
    return values.length ? `${labelFor(typedKey)}: ${values.join(", ")}` : "";
  }).filter(Boolean) : [];

  return <section className="space-y-4 rounded-xl border border-border/80 bg-background/55 p-4" data-testid="notification-condition-picker">
    <div className="flex items-start gap-3">
      <span className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><Sparkles className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{copy.analysisTitle}</h3>{conditionCount > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{conditionCount} {copy.selected}</span>}</div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.analysisDescription}</p>
      </div>
    </div>
    {isAnalysis && <div className="flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/[0.045] p-3 text-xs leading-relaxed text-foreground/80"><CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{copy.matchHelp}</div>}
    {!isAnalysis && <div className="rounded-lg border border-primary/15 bg-primary/[0.045] p-3 text-xs leading-relaxed text-foreground/80">{copy.nonAnalysisHint}</div>}
    {conditions && !isAnalysis && savedSummary.length > 0 && <div className="rounded-lg border border-border/70 bg-muted/25 p-3" aria-label={copy.analysisTitle}>
      <p className="text-xs font-medium">{savedSummary.join(" · ")}</p>
    </div>}
    {conditions && !isAnalysis && (hasUnsupported || hasComplexBoolean) && <div className="rounded-lg border border-amber-300/50 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-950">{copy.legacyPreserved}</div>}
    {!conditions ? <div className="rounded-lg border border-amber-300/50 bg-amber-50/70 p-3 text-xs text-amber-950">{copy.malformedCondition}</div>
      : isAnalysis ? <>
      <div className="rounded-lg border border-primary/15 bg-primary/[0.045] p-3 text-xs leading-relaxed text-foreground/80">{copy.legacySmsScope}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2" data-testid="condition-countryCode"><p className="text-xs font-semibold">{copy.countryCode}</p>{renderOptions("countryCode", options.countryCode)}</div>
        <div className="space-y-2" data-testid="condition-provider"><p className="text-xs font-semibold">{copy.provider}</p>{renderOptions("provider", options.provider)}</div>
        <div className="space-y-2" data-testid="condition-sentiment"><p className="text-xs font-semibold">{labelFor("sentiment")}</p>{renderOptions("sentiment", options.sentiment)}</div>
        <div className="space-y-2" data-testid="condition-alertLevel"><p className="text-xs font-semibold">{labelFor("alertLevel")}</p>{renderOptions("alertLevel", options.alertLevel)}</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {booleanKeys.map(key => <div key={key} data-testid={`condition-${key}`} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-2">
          <span className="text-xs font-medium">{labelFor(key)}</span>
          <div className="flex shrink-0 rounded-md bg-muted/75 p-0.5" role="group" aria-label={labelFor(key)}>
            {(["any", "yes", "no"] as const).map(choice => <Button key={choice} type="button" variant="ghost" size="sm" aria-pressed={booleanValue(key) === choice}
              data-testid={`condition-${key}-${choice}`} data-value={choice}
              disabled={booleanState(key).unsupported}
              className={`h-7 px-2 text-[11px] ${booleanValue(key) === choice ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              onClick={() => setKey(key, choice === "any" ? undefined : choice === "yes")}>{copy[choice]}</Button>)}
          </div>
          {booleanState(key).unsupported && <span className="sr-only">{copy.preservedCondition}</span>}
        </div>)}
      </div>
      {(hasUnsupported || hasComplexBoolean) && <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-950"><CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" />{copy.legacyPreserved}</div>}
    </> : null}
  </section>;
}
