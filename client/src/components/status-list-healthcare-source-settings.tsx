import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Check, Save } from "lucide-react";
import { healthcarePolicySchema, healthcareStates, type HealthcarePolicy } from "@shared/status-list-healthcare";
import type { OptionSource } from "@shared/status-list-option-source";
import { queryClient } from "@/lib/queryClient";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { StatusListBackgroundActions } from "./status-list-background-actions";
import { getHealthcareCopy } from "./status-list-healthcare-copy";

type HealthcareSource = Extract<OptionSource, { source: "healthcare_reachability" }>;
type SourcePayload = Pick<HealthcareSource, "source" | "hidden" | "mapping" | "policy">;
type Draft = { policy: HealthcarePolicy; failedAttempts: string; minTalkSeconds: string };

function makeDraft(source: HealthcareSource): Draft {
  const policy = healthcarePolicySchema.parse(source.policy || {});
  return { policy, failedAttempts: String(policy.failedAttempts), minTalkSeconds: String(policy.minTalkSeconds) };
}
function snapshot(draft: Draft) {
  return JSON.stringify({ policy: draft.policy, failedAttempts: draft.failedAttempts, minTalkSeconds: draft.minTalkSeconds });
}
function numberProblem(value: string, min: number, max: number) {
  if (!/^\d+$/.test(value)) return false;
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max;
}

export function StatusListHealthcareSourceSettings({
  campaignId, locale, source, onDirtyChange,
}: {
  campaignId: string; locale: string; source: HealthcareSource; onDirtyChange?: (dirty: boolean) => void;
}) {
  const c = getHealthcareCopy(locale);
  const initial = useMemo(() => makeDraft(source), [source.groupId]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [savedDraft, setSavedDraft] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [validationError, setValidationError] = useState("");
  const initializedFor = useRef(source.groupId);
  useEffect(() => {
    if (initializedFor.current === source.groupId) return;
    initializedFor.current = source.groupId;
    const next = makeDraft(source);
    setDraft(next);
    setSavedDraft(next);
    setSaved(false);
  }, [source.groupId, source]);
  const dirty = snapshot(draft) !== snapshot(savedDraft);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const endpoint = `/api/campaigns/${encodeURIComponent(campaignId)}/status-list-workflows/option-sources`;
  const save = useMutation({
    mutationFn: async (config: SourcePayload) => {
      const response = await fetch(`${endpoint}/${encodeURIComponent(source.groupId)}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error(String(response.status));
      return config;
    },
    onSuccess: async config => {
      const next = { policy: config.policy, failedAttempts: String(config.policy.failedAttempts), minTalkSeconds: String(config.policy.minTalkSeconds) };
      setDraft(next);
      setSavedDraft(next);
      setSaved(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [endpoint] }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }),
        queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/status-list-workflows`] }),
      ]);
    },
  });
  const allOff = healthcareStates.every(state => !draft.policy.enabled[state]);
  const failedValid = numberProblem(draft.failedAttempts, 1, 100);
  const talkValid = numberProblem(draft.minTalkSeconds, 1, 3600);

  const reset = () => {
    setDraft(savedDraft);
    setValidationError("");
    setSaved(false);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setSaved(false);
    if (!failedValid || !talkValid) {
      setValidationError(!failedValid ? c.threshold : c.talkTime);
      return;
    }
    setValidationError("");
    const policy = healthcarePolicySchema.parse({
      ...draft.policy,
      failedAttempts: Number(draft.failedAttempts),
      minTalkSeconds: Number(draft.minTalkSeconds),
    });
    save.mutate({ source: "healthcare_reachability", hidden: source.hidden, mapping: source.mapping, policy });
  };

  return <div className="space-y-3" data-testid="healthcare-source-settings" onKeyDown={event => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.type === "number") {
      event.preventDefault();
      submit(event);
    }
  }}>
    <div className="grid gap-2 sm:grid-cols-2">
      {healthcareStates.map(state => <fieldset key={state} className="min-w-0 rounded-md border border-border/70 bg-muted/20 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <label className="flex min-w-0 items-center gap-2 text-xs font-semibold">
            <input type="checkbox" data-testid={`healthcare-use-${state}`} className="h-4 w-4 accent-primary" aria-label={`${c.use}: ${c.states[state]}`}
              checked={draft.policy.enabled[state]} disabled={save.isPending}
              onChange={event => setDraft(current => ({ ...current, policy: {
                ...current.policy, enabled: { ...current.policy.enabled, [state]: event.target.checked },
              } }))}/>
            <span>{c.states[state]}</span><span className="font-normal text-muted-foreground">· {c.use}</span>
          </label>
          <StatusListBackgroundActions campaignId={campaignId} locale={locale}
            targets={[{ kind: "item", id: source.mapping[state], label: c.states[state] }]}/>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{c.descriptions[state]}</p>
      </fieldset>)}
    </div>
    <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-3 sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-medium">
        <span>{c.threshold}</span>
        <Input type="number" data-testid="healthcare-failed-attempts" min={1} max={100} step={1} inputMode="numeric" value={draft.failedAttempts}
          aria-invalid={!failedValid} disabled={save.isPending}
          onChange={event => setDraft(current => ({ ...current, failedAttempts: event.target.value }))}/>
        <span className="font-normal text-muted-foreground">1–100 · {c.states.unreachable}</span>
        {!failedValid && <span className="font-normal text-destructive">{c.invalidNumber}</span>}
      </label>
      <label className="grid gap-1 text-xs font-medium">
        <span>{c.talkTime}</span>
        <Input type="number" data-testid="healthcare-min-talk-seconds" min={1} max={3600} step={1} inputMode="numeric" value={draft.minTalkSeconds}
          aria-invalid={!talkValid} disabled={save.isPending}
          onChange={event => setDraft(current => ({ ...current, minTalkSeconds: event.target.value }))}/>
        <span className="font-normal text-muted-foreground">1–3600 · {c.states.reachable}</span>
        {!talkValid && <span className="font-normal text-destructive">{c.invalidNumber}</span>}
      </label>
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">{c.disabledBehavior} {c.resetExplanation}</p>
    {allOff && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-xs">{c.allOff}</p>}
    {(validationError || save.isError) && <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
      <AlertCircle className="h-3.5 w-3.5 shrink-0"/>{validationError || c.error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
      <div aria-live="polite" className="text-xs text-muted-foreground">
        {saved && !dirty && <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3.5 w-3.5"/>{c.saved}</span>}
        {!saved && dirty && c.unsaved}
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" disabled={!dirty || save.isPending} onClick={reset}>{c.cancel}</Button>
        <Button type="button" size="sm" onClick={submit} disabled={!failedValid || !talkValid || save.isPending}>
          <Save className="mr-1.5 h-3.5 w-3.5"/>{save.isPending ? c.saving : c.save}
        </Button>
      </div>
    </div>
  </div>;
}
