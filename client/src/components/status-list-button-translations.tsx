import { useEffect, useRef, useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { translations, type Locale } from "@/i18n/translations";
import { statusListLabelLanguages, statusListLabelTranslationsSchema, type StatusListLabelTranslations } from "@shared/status-list-label-translations";

const languageNames = { en: "English", sk: "Slovenčina", cs: "Čeština", hu: "Magyar", ro: "Română", it: "Italiano", de: "Deutsch" };

export function StatusListButtonTranslations({ campaignId, locale, name, value, onChange, onBusyChange }: {
  campaignId: string; locale: string; name: string; value: StatusListLabelTranslations;
  onChange: (value: StatusListLabelTranslations) => void; onBusyChange: (value: boolean) => void;
}) {
  const copy = translations[locale as Locale].statusListButtonTranslations;
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const latestName = useRef(name); latestName.current = name;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const generate = async () => {
    if (busy || !name.trim()) return;
    const original = name;
    setBusy(true); onBusyChange(true); setError(false);
    try {
      const response = await apiRequest("POST", `/api/campaigns/${campaignId}/status-list-label-translations`, { text: name.trim() });
      const parsed = statusListLabelTranslationsSchema.required().parse((await response.json()).translations);
      if (mounted.current && latestName.current === original) onChange(parsed);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) { setBusy(false); onBusyChange(false); }
    }
  };
  return <section className="col-span-2 space-y-3 rounded-lg border bg-muted/20 p-3" data-testid="quick-option-translations" aria-busy={busy}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-xs font-semibold">{copy.title}</h4>
      <Button type="button" size="sm" variant="outline" disabled={busy || !name.trim() || name.trim().length > 240} onClick={generate} data-testid="quick-option-ai-translate">
        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <Languages className="mr-1.5 h-3.5 w-3.5"/>}{busy ? copy.generating : copy.generate}
      </Button>
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">{copy.help}</p>
    {error && <p role="alert" className="text-xs text-destructive" data-testid="quick-option-translation-error">{copy.error}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{statusListLabelLanguages.map(language =>
      <label key={language} className="grid gap-1.5 text-xs"><span lang={language}>{languageNames[language]} <span className="text-muted-foreground">({language.toUpperCase()})</span></span>
        <Input value={value[language] || ""} lang={language} maxLength={240} disabled={busy} data-testid={`quick-option-name-${language}`} onChange={event => {
          const next = { ...value };
          if (event.target.value.trim()) next[language] = event.target.value; else delete next[language];
          onChange(next);
        }}/></label>)}</div>
  </section>;
}
