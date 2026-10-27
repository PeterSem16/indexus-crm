import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getStatusListQuestionStudioCopy } from "./status-list-question-studio-copy";
import { StatusListQuickOptionIcon, StatusListQuickOptionIconPicker } from "./status-list-quick-option-icons";
import { useStatusListConfirm } from "./status-list-confirm";
import { getStatusListGuidanceCopy } from "./status-list-guidance-copy";
import { StatusListButtonTranslations } from "./status-list-button-translations";
import { statusListOptionLabel, type StatusListLabelTranslations } from "@shared/status-list-label-translations";
import { translations, type Locale } from "@/i18n/translations";
import { StatusListHelp } from "./status-list-help";

const messages = {
  title: ["Quick option settings", "Nastavenia rýchlej možnosti", "Nastavení rychlé možnosti", "Gyorslehetőség beállításai", "Setări opțiune rapidă", "Impostazioni opzione rapida", "Schnelloption einstellen"],
  create: ["Create quick option", "Vytvoriť rýchlu možnosť", "Vytvořit rychlou možnost", "Gyorslehetőség létrehozása", "Creează opțiune rapidă", "Crea opzione rapida", "Schnelloption erstellen"],
  name: ["Button name", "Názov tlačidla", "Název tlačítka", "Gomb neve", "Numele butonului", "Nome del pulsante", "Schaltflächenname"],
  description: ["Description (optional)", "Popis (voliteľné)", "Popis (volitelné)", "Leírás (opcionális)", "Descriere (opțional)", "Descrizione (facoltativa)", "Beschreibung (optional)"],
  color: ["Button color", "Farba tlačidla", "Barva tlačítka", "Gomb színe", "Culoarea butonului", "Colore del pulsante", "Schaltflächenfarbe"],
  preview: ["Button preview", "Náhľad tlačidla", "Náhled tlačítka", "Gomb előnézete", "Previzualizare buton", "Anteprima pulsante", "Schaltflächenvorschau"],
  placeholder: ["For example: Not interested, Call back, Interested", "Napríklad: Nezáujem, Zavolať neskôr, Záujem", "Například: Nezájem, Zavolat později, Zájem", "Például: Nem érdekli, Visszahívás, Érdekli", "De exemplu: Neinteresat, Reapelare, Interesat", "Ad esempio: Non interessato, Richiama, Interessato", "Zum Beispiel: Kein Interesse, Rückruf, Interessiert"],
  help: ["A quick option is a Nexus Pulse button, not a checklist question. Configure its status or callback action in the Actions tab. Editing settings never executes the action.", "Rýchla možnosť je tlačidlo v Nexus Pulse, nie otázka zo zoznamu. Zmenu statusu alebo callback nastavíš na karte Akcie. Úprava nastavení akciu nespúšťa.", "Rychlá možnost je tlačítko v Nexus Pulse, ne otázka ze seznamu. Změnu stavu nebo callback nastavíte na kartě Akce. Úprava nastavení akci nespouští.", "A gyorslehetőség Nexus Pulse-gomb, nem ellenőrzőlistás kérdés. Az állapotváltoztatás vagy visszahívás a Műveletek lapon állítható be. A szerkesztés nem hajtja végre a műveletet.", "Opțiunea rapidă este un buton Nexus Pulse, nu o întrebare din listă. Configurează starea sau reapelarea în fila Acțiuni. Editarea nu execută acțiunea.", "Un'opzione rapida è un pulsante Nexus Pulse, non una domanda della lista. Configura lo stato o la richiamata nella scheda Azioni. Modificare le impostazioni non esegue l'azione.", "Eine Schnelloption ist eine Nexus-Pulse-Schaltfläche, keine Checklistenfrage. Status oder Rückruf konfigurieren Sie im Tab Aktionen. Bearbeiten führt die Aktion nicht aus."],
  actions: ["Status and callback", "Status a callback", "Stav a callback", "Állapot és visszahívás", "Stare și reapelare", "Stato e richiamata", "Status und Rückruf"],
  createHelp: ["First create the button with its name and color. Status and callback settings open in a focused modal from the Actions tab.", "Najprv vytvor tlačidlo s názvom a farbou. Nastavenia statusu a callbacku sa otvoria v samostatnom modálnom okne na karte Akcie.", "Nejprve vytvořte tlačítko s názvem a barvou. Nastavení stavu a callbacku se otevře v samostatném modálním okně na kartě Akce.", "Először hozza létre a gombot névvel és színnel. Az állapot- és visszahívási beállítások külön modális ablakban nyílnak meg a Műveletek lapon.", "Creează întâi butonul cu nume și culoare. Setările de stare și reapelare se deschid într-o fereastră modală dedicată din fila Acțiuni.", "Crea prima il pulsante con nome e colore. Le impostazioni di stato e richiamata si aprono in una finestra modale dedicata dalla scheda Azioni.", "Erstellen Sie zuerst die Schaltfläche mit Name und Farbe. Status- und Rückrufeinstellungen öffnen sich in einem eigenen Dialog im Tab Aktionen."],
  icon: ["Icon", "Ikona", "Ikona", "Ikon", "Pictogramă", "Icona", "Symbol"],
  buttonTab: ["Button", "Tlačidlo", "Tlačítko", "Gomb", "Buton", "Pulsante", "Schaltfläche"],
} as const;
export function getQuickOptionCopy(locale: string) {
  const index = Math.max(0, ["en", "sk", "cs", "hu", "ro", "it", "de"].indexOf(locale));
  return Object.fromEntries(Object.entries(messages).map(([key, values]) => [key, values[index]])) as { [K in keyof typeof messages]: string };
}

type Item = { id: string; label: string; labelTranslations?: StatusListLabelTranslations | null; description: string | null; color?: string | null; icon?: string | null; canonicalClinicStatusKey?: string | null };
export function StatusListQuickOptionEditor({ item, campaignId, locale, canonicalOptions, renderActions, onDeleted, onDirtyChange }: {
  item: Item; campaignId: string; locale: string; canonicalOptions: { value: string; label: string }[];
  renderActions: (onDirtyChange: (dirty: boolean) => void, onPendingChange: (pending: boolean) => void) => ReactNode; onDeleted: () => void; onDirtyChange: (dirty: boolean) => void;
}) {
  const copy = getQuickOptionCopy(locale);
  const confirm = useStatusListConfirm(locale);
  const guidance = getStatusListGuidanceCopy(locale);
  const common = getStatusListQuestionStudioCopy(locale);
  const { toast } = useToast();
  const initial = { label: item.label, labelTranslations: item.labelTranslations || {}, description: item.description || "", color: item.color || "#3b82f6", icon: item.icon ?? null, canonicalClinicStatusKey: item.canonicalClinicStatusKey || "" };
  const [base, setBase] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [actionDirty, setActionDirty] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [translating, setTranslating] = useState(false);
  const translationCopy = translations[locale as Locale].statusListButtonTranslations;
  const [activeTab, setActiveTab] = useState<"button" | "actions">("button");
  const dirty = JSON.stringify(base) !== JSON.stringify(draft);
  const dirtyCallback = useRef(onDirtyChange); dirtyCallback.current = onDirtyChange;
  useEffect(() => { dirtyCallback.current(dirty || actionDirty || actionPending || translating); }, [dirty, actionDirty, actionPending, translating]);
  useEffect(() => () => dirtyCallback.current(false), []);
  useEffect(() => {
    if (!dirty && !actionDirty && !actionPending && !translating) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, actionDirty, actionPending, translating]);
  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list-workflows"] }),
  ]);
  const save = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/campaigns/${campaignId}/status-list/${item.id}`, {
       label: draft.label.trim(), labelTranslations: draft.labelTranslations, description: draft.description.trim() || null, color: draft.color,
      canonicalClinicStatusKey: draft.canonicalClinicStatusKey || null, icon: draft.icon,
    }),
    onSuccess: async () => { setBase({ ...draft }); await invalidate(); toast({ title: common.saved }); },
    onError: () => toast({ title: common.error, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/campaigns/${campaignId}/status-list/${item.id}`),
    onSuccess: async () => { await invalidate(); onDeleted(); },
    onError: () => toast({ title: common.error, variant: "destructive" }),
  });
  return <section className="space-y-5 rounded-xl border bg-card p-4" data-testid="status-list-quick-option-editor">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{copy.title}</h3><p className="mt-2 max-w-prose text-xs leading-relaxed text-muted-foreground">{copy.help}</p></div>
      <Button type="button" size="sm" variant="outline" disabled={remove.isPending || actionPending || translating} data-testid="quick-option-delete" onClick={async () => { if (await confirm(common.deleteConfirm, { destructive: true })) remove.mutate(); }}>{common.delete}</Button>
    </header>
    <div role="tablist" aria-label={copy.title} className="flex gap-1 border-b" data-testid="quick-option-editor-tabs"
      onKeyDown={event => {
        const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
        const current = tabs.indexOf(event.target as HTMLButtonElement);
        const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!delta || current < 0) return;
        event.preventDefault();
        const next = tabs[(current + delta + tabs.length) % tabs.length];
        next.focus();
        next.click();
      }}>
      <button type="button" role="tab" id="quick-option-tab-button" aria-controls="quick-option-panel-button" aria-selected={activeTab === "button"} tabIndex={activeTab === "button" ? 0 : -1} className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${activeTab === "button" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`} onClick={() => setActiveTab("button")}>{copy.buttonTab}</button>
      <button type="button" role="tab" disabled={translating} id="quick-option-tab-actions" aria-controls="quick-option-panel-actions" aria-selected={activeTab === "actions"} tabIndex={activeTab === "actions" ? 0 : -1} className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${activeTab === "actions" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`} onClick={() => setActiveTab("actions")}>{copy.actions}</button>
    </div>
    {activeTab === "button" && <div id="quick-option-panel-button" role="tabpanel" aria-labelledby="quick-option-tab-button">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 text-xs sm:col-span-2"><span>{copy.name} · {translationCopy.original}</span><Input data-testid="quick-option-name" value={draft.label} disabled={translating} maxLength={240} onChange={event => setDraft(current => ({ ...current, label: event.target.value, labelTranslations: {} }))}/><small className="text-muted-foreground">{translationCopy.renameHelp}</small></label>
      <StatusListButtonTranslations campaignId={campaignId} locale={locale} name={draft.label} value={draft.labelTranslations} onChange={labelTranslations => setDraft(current => ({ ...current, labelTranslations }))} onBusyChange={setTranslating}/>
      <label className="grid gap-2 text-xs"><span>{copy.description}</span><Input data-testid="quick-option-description" value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}/></label>
      <label className="grid gap-2 text-xs"><span>{copy.color}</span><input type="color" data-testid="quick-option-color" className="h-9 w-full rounded border bg-background p-1" value={draft.color} onChange={event => setDraft(current => ({ ...current, color: event.target.value }))}/></label>
      <div className="grid gap-2 text-xs sm:col-span-2"><StatusListQuickOptionIconPicker value={draft.icon} onChange={icon => setDraft(current => ({ ...current, icon }))} locale={locale} disabled={save.isPending || actionPending}/></div>
      <label className="grid gap-2 text-xs sm:col-span-2"><span>{guidance.reporting}</span>
        <select className="slw-native-select" data-testid="quick-option-canonical-status" value={draft.canonicalClinicStatusKey} onChange={event => setDraft(current => ({ ...current, canonicalClinicStatusKey: event.target.value }))}>
          <option value="">{guidance.none}</option>
          {draft.canonicalClinicStatusKey && !canonicalOptions.some(option => option.value === draft.canonicalClinicStatusKey) && <option value={draft.canonicalClinicStatusKey}>{draft.canonicalClinicStatusKey}</option>}
          {canonicalOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select><small className="leading-relaxed text-muted-foreground">{common.canonicalHelp}</small><small className="leading-relaxed text-muted-foreground">{guidance.reportingExample}</small><StatusListHelp locale={locale} section="clinicOutcome" contextual/>
      </label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><span className="grid gap-2 text-xs text-muted-foreground">{copy.preview}<span data-testid="quick-option-preview" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-semibold text-foreground" style={{ borderColor: draft.color, backgroundColor: `color-mix(in srgb, ${draft.color} 10%, transparent)` }}>{draft.icon && <StatusListQuickOptionIcon name={draft.icon} className="h-4 w-4 shrink-0" />}{statusListOptionLabel(draft, locale) || copy.name}</span></span>
      <Button type="button" data-testid="quick-option-save" disabled={!dirty || !draft.label.trim() || save.isPending || actionPending || translating} onClick={() => save.mutate()}>{common.save}</Button>
    </div>
    </div>}
    {activeTab === "actions" && <section id="quick-option-panel-actions" role="tabpanel" aria-labelledby="quick-option-tab-actions" className="pt-1">{renderActions(setActionDirty, setActionPending)}</section>}
  </section>;
}
