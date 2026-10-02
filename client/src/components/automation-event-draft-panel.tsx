import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Source = { module: string; label: string; events: string[]; fieldsByEvent: Record<string, string[]> };
type Context = { sources: Source[]; countries: string[]; intents: string[] };
type Proposal = {
  intent: string; evidence: string; condition: string; explanation: string;
  draftText?: string; missingInformation: string[]; support: "not_integrated";
};
type Draft = {
  scope: { module: string; entityType: string; eventType: string; countryCode: string; conditionField: string | null; conditionValue: string | null };
  proposals: Proposal[]; questions: string[];
};

export function AutomationEventDraftPanel() {
  const { t } = useI18n();
  const text = t.automationDraft;
  const context = useQuery<Context>({
    queryKey: ["/api/automation/draft-context/events"], staleTime: 0, refetchOnMount: "always",
  });
  const [module, setModule] = useState("");
  const [eventType, setEventType] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [conditionField, setConditionField] = useState("");
  const [conditionValue, setConditionValue] = useState("");
  const [desiredIntent, setDesiredIntent] = useState("");
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const source = context.data?.sources.find(item => item.module === module);
  const eventFields = source?.fieldsByEvent[eventType] || [];
  const friendly = (value: string) => text.eventCodeLabels[value] || value;
  const clearDraft = () => { requestId.current++; setDraft(null); setError(""); setLoading(false); };

  async function generate() {
    if (!module || !eventType || !countryCode || instruction.trim().length < 8 || (conditionField && !conditionValue.trim())) return;
    clearDraft();
    const thisRequest = requestId.current;
    setLoading(true);
    try {
      const res = await fetch("/api/automation/draft-context/events/propose", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module, eventType, countryCode, conditionField: conditionField || undefined,
          conditionValue: conditionField ? conditionValue.trim() : undefined,
          desiredIntent: desiredIntent || undefined, instruction: instruction.trim(),
        }),
      });
      if (!res.ok) throw new Error(res.status === 503 ? text.unavailable : res.status === 401 || res.status === 403 ? text.forbidden : text.error);
      const result = await res.json();
      if (requestId.current === thisRequest) setDraft(result);
    } catch (e) {
      if (requestId.current === thisRequest) setError(e instanceof Error ? e.message : text.error);
    } finally {
      if (requestId.current === thisRequest) setLoading(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="automation-event-draft">
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-sm font-medium">{text.eventSetupTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{text.eventIntro}</p>
      </div>
      {context.isError && <p role="alert" className="text-sm text-destructive">{text.forbidden}</p>}
      {context.isLoading && <p className="text-sm text-muted-foreground">{text.loading}</p>}
      {context.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{text.eventModule}</Label><p className="text-xs text-muted-foreground">{text.eventModuleHelp}</p>
              <Select value={module} onValueChange={value => { setModule(value); setEventType(""); setConditionField(""); setConditionValue(""); clearDraft(); }}>
                <SelectTrigger data-testid="select-event-module"><SelectValue placeholder={text.eventModule} /></SelectTrigger>
                <SelectContent>{context.data.sources.map(item => <SelectItem key={item.module} value={item.module}>{item.module === "collaborator" ? t.automationCatalog.collaborator : item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{text.eventType}</Label><p className="text-xs text-muted-foreground">{text.eventTypeHelp}</p>
              <Select value={eventType} onValueChange={value => { setEventType(value); setConditionField(""); setConditionValue(""); clearDraft(); }} disabled={!source}>
                <SelectTrigger data-testid="select-event-type"><SelectValue placeholder={text.eventType} /></SelectTrigger>
                <SelectContent>{source?.events.map(value => <SelectItem key={value} value={value}>{friendly(value)} · {t.automationCatalog.supportedIn}: {source.module === "collaborator" ? t.automationCatalog.collaborator : source.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{text.eventCountry}</Label><p className="text-xs text-muted-foreground">{text.eventCountryHelp}</p>
              <Select value={countryCode} onValueChange={value => { setCountryCode(value); clearDraft(); }}>
                <SelectTrigger data-testid="select-event-country"><SelectValue placeholder={text.eventCountry} /></SelectTrigger>
                <SelectContent>{context.data.countries.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
              {context.data.countries.length === 0 && <p className="text-sm text-destructive">{text.noCountries}</p>}
            </div>
            <div className="space-y-2">
              <Label>{text.eventAction}</Label>
              <Select value={desiredIntent || "discover"} onValueChange={value => { setDesiredIntent(value === "discover" ? "" : value); clearDraft(); }}>
                <SelectTrigger data-testid="select-event-action"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="discover">{text.discoverAction}</SelectItem>
                  {context.data.intents.map(value => <SelectItem key={value} value={value}>{friendly(value)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{text.eventField}</Label><p className="text-xs text-muted-foreground">{text.eventFieldHelp}</p>
              <Select value={conditionField || "none"} onValueChange={value => { setConditionField(value === "none" ? "" : value); setConditionValue(""); clearDraft(); }} disabled={!source || !eventFields.length}>
                <SelectTrigger data-testid="select-event-field"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{text.noField}</SelectItem>
                  {eventFields.map(value => <SelectItem key={value} value={value}>{friendly(value)} · {t.automationCatalog.supportedIn}: {source.module === "collaborator" ? t.automationCatalog.collaborator : source.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {conditionField && (
              <div className="space-y-2">
                <Label htmlFor="event-draft-value">{text.eventValue}</Label>
                <Input id="event-draft-value" value={conditionValue} maxLength={120} onChange={e => { setConditionValue(e.target.value); clearDraft(); }} />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-draft-instruction">{text.eventInstruction}</Label>
            <Textarea id="event-draft-instruction" value={instruction} maxLength={1000} rows={3}
              placeholder={text.eventInstructionHint} onChange={e => { setInstruction(e.target.value); clearDraft(); }} />
          </div>
          <Button type="button" onClick={generate} disabled={loading || !source || !eventType || !countryCode || instruction.trim().length < 8 || (!!conditionField && !conditionValue.trim())}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{text.generate}
          </Button>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {draft && (
            <div className="space-y-3 border-t pt-4" aria-live="polite">
              <div className="rounded-md bg-muted p-3 text-sm">
                <strong>{text.eventScope}:</strong> {draft.scope.countryCode} · {draft.scope.module} · {friendly(draft.scope.eventType)}
                {draft.scope.conditionField && <span> · {friendly(draft.scope.conditionField)} = {draft.scope.conditionValue}</span>}
              </div>
              <p className="text-sm text-muted-foreground">{text.eventBlocked}</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">{text.unverified}</p>
              {draft.proposals.length === 0 && <p className="text-sm text-muted-foreground">{text.empty}</p>}
              {draft.proposals.map((p, i) => (
                  <div key={i} className="rounded-md border p-3 space-y-1.5 text-sm">
                   <div className="flex justify-between gap-3"><strong>{friendly(p.intent)}</strong><span className="text-xs text-muted-foreground">{text.notIntegrated}</span></div>
                  <p>{p.condition}</p><p className="text-muted-foreground">{p.explanation}</p>
                  <p className="text-xs text-muted-foreground">{text.instructionEvidence}: “{p.evidence}”</p>
                  {p.draftText && <blockquote className="border-l-2 pl-3 whitespace-pre-wrap">{p.draftText}</blockquote>}
                  {p.missingInformation.length > 0 && <div><strong>{text.missing}:</strong><ul className="list-disc pl-5">{p.missingInformation.map((m, index) => <li key={index}>{m}</li>)}</ul></div>}
                </div>
              ))}
              {draft.questions.length > 0 && <div className="text-sm"><strong>{text.question}:</strong><ul className="list-disc pl-5">{draft.questions.map((q, index) => <li key={index}>{q}</li>)}</ul></div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}