import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getStatusListQuestionStudioCopy } from "./status-list-question-studio-copy";

const messages = {
  title: ["Quick option settings", "Nastavenia rýchlej možnosti", "Nastavení rychlé možnosti", "Gyorslehetőség beállításai", "Setări opțiune rapidă", "Impostazioni opzione rapida", "Schnelloption einstellen"],
  create: ["Create quick option", "Vytvoriť rýchlu možnosť", "Vytvořit rychlou možnost", "Gyorslehetőség létrehozása", "Creează opțiune rapidă", "Crea opzione rapida", "Schnelloption erstellen"],
  name: ["Button name", "Názov tlačidla", "Název tlačítka", "Gomb neve", "Numele butonului", "Nome del pulsante", "Schaltflächenname"],
  description: ["Description (optional)", "Popis (voliteľné)", "Popis (volitelné)", "Leírás (opcionális)", "Descriere (opțional)", "Descrizione (facoltativa)", "Beschreibung (optional)"],
  color: ["Button color", "Farba tlačidla", "Barva tlačítka", "Gomb színe", "Culoarea butonului", "Colore del pulsante", "Schaltflächenfarbe"],
  preview: ["Button preview", "Náhľad tlačidla", "Náhled tlačítka", "Gomb előnézete", "Previzualizare buton", "Anteprima pulsante", "Schaltflächenvorschau"],
  placeholder: ["For example: Not interested, Call back, Interested", "Napríklad: Nezáujem, Zavolať neskôr, Záujem", "Například: Nezájem, Zavolat později, Zájem", "Például: Nem érdekli, Visszahívás, Érdekli", "De exemplu: Neinteresat, Reapelare, Interesat", "Ad esempio: Non interessato, Richiama, Interessato", "Zum Beispiel: Kein Interesse, Rückruf, Interessiert"],
  help: ["A quick option is a Nexus Pulse button, not a checklist question. Configure its status or callback action below. Editing these settings does not execute the action.", "Rýchla možnosť je tlačidlo v Nexus Pulse, nie otázka zo zoznamu. Nižšie nastav zmenu statusu alebo callback. Úprava nastavení akciu nespúšťa.", "Rychlá možnost je tlačítko v Nexus Pulse, ne otázka ze seznamu. Níže nastavte změnu stavu nebo callback. Úprava nastavení akci nespouští.", "A gyorslehetőség Nexus Pulse-gomb, nem ellenőrzőlistás kérdés. Alább állítsa be az állapotváltoztatást vagy visszahívást. A szerkesztés nem hajtja végre a műveletet.", "Opțiunea rapidă este un buton Nexus Pulse, nu o întrebare din listă. Configurează mai jos starea sau reapelarea. Editarea nu execută acțiunea.", "Un'opzione rapida è un pulsante Nexus Pulse, non una domanda della lista. Configura sotto lo stato o la richiamata. Modificare le impostazioni non esegue l'azione.", "Eine Schnelloption ist eine Nexus-Pulse-Schaltfläche, keine Checklistenfrage. Konfigurieren Sie unten Status oder Rückruf. Bearbeiten führt die Aktion nicht aus."],
  actions: ["Status and callback", "Status a callback", "Stav a callback", "Állapot és visszahívás", "Stare și reapelare", "Stato e richiamata", "Status und Rückruf"],
  createHelp: ["First create the button with its name and color. Its status or callback settings then open on this page, without a question dialog.", "Najprv vytvor tlačidlo s názvom a farbou. Potom sa priamo na stránke otvoria jeho nastavenia statusu alebo callbacku, bez okna otázky.", "Nejprve vytvořte tlačítko s názvem a barvou. Poté se přímo na stránce otevře nastavení stavu nebo callbacku, bez okna otázky.", "Először hozza létre a gombot névvel és színnel. Az állapot- vagy visszahívás-beállítások ezután az oldalon nyílnak meg, kérdésablak nélkül.", "Creează întâi butonul cu nume și culoare. Setările de stare sau reapelare se deschid apoi în pagină, fără dialog de întrebare.", "Crea prima il pulsante con nome e colore. Le impostazioni di stato o richiamata si apriranno nella pagina, senza finestra domanda.", "Erstellen Sie zuerst die Schaltfläche mit Name und Farbe. Status- oder Rückrufeinstellungen öffnen sich danach auf dieser Seite, ohne Fragendialog."],
} as const;
export function getQuickOptionCopy(locale: string) {
  const index = Math.max(0, ["en", "sk", "cs", "hu", "ro", "it", "de"].indexOf(locale));
  return Object.fromEntries(Object.entries(messages).map(([key, values]) => [key, values[index]])) as { [K in keyof typeof messages]: string };
}

type Item = { id: string; label: string; description: string | null; color?: string | null; canonicalClinicStatusKey?: string | null };
export function StatusListQuickOptionEditor({ item, campaignId, locale, canonicalOptions, renderActions, onDeleted, onDirtyChange }: {
  item: Item; campaignId: string; locale: string; canonicalOptions: { value: string; label: string }[];
  renderActions: (onDirtyChange: (dirty: boolean) => void, onPendingChange: (pending: boolean) => void) => ReactNode; onDeleted: () => void; onDirtyChange: (dirty: boolean) => void;
}) {
  const copy = getQuickOptionCopy(locale);
  const common = getStatusListQuestionStudioCopy(locale);
  const { toast } = useToast();
  const initial = { label: item.label, description: item.description || "", color: item.color || "#3b82f6", canonicalClinicStatusKey: item.canonicalClinicStatusKey || "" };
  const [base, setBase] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [actionDirty, setActionDirty] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const dirty = JSON.stringify(base) !== JSON.stringify(draft);
  const dirtyCallback = useRef(onDirtyChange); dirtyCallback.current = onDirtyChange;
  useEffect(() => { dirtyCallback.current(dirty || actionDirty || actionPending); }, [dirty, actionDirty, actionPending]);
  useEffect(() => () => dirtyCallback.current(false), []);
  useEffect(() => {
    if (!dirty && !actionDirty && !actionPending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, actionDirty, actionPending]);
  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list-workflows"] }),
  ]);
  const save = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/campaigns/${campaignId}/status-list/${item.id}`, {
      label: draft.label.trim(), description: draft.description.trim() || null, color: draft.color,
      canonicalClinicStatusKey: draft.canonicalClinicStatusKey || null,
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
      <Button type="button" size="sm" variant="outline" disabled={remove.isPending || actionPending} data-testid="quick-option-delete" onClick={() => { if (window.confirm(common.deleteConfirm)) remove.mutate(); }}>{common.delete}</Button>
    </header>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 text-xs sm:col-span-2"><span>{copy.name}</span><Input data-testid="quick-option-name" value={draft.label} onChange={event => setDraft(current => ({ ...current, label: event.target.value }))}/></label>
      <label className="grid gap-2 text-xs"><span>{copy.description}</span><Input data-testid="quick-option-description" value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}/></label>
      <label className="grid gap-2 text-xs"><span>{copy.color}</span><input type="color" data-testid="quick-option-color" className="h-9 w-full rounded border bg-background p-1" value={draft.color} onChange={event => setDraft(current => ({ ...current, color: event.target.value }))}/></label>
      <label className="grid gap-2 text-xs sm:col-span-2"><span>{common.canonical}</span>
        <select className="slw-native-select" data-testid="quick-option-canonical-status" value={draft.canonicalClinicStatusKey} onChange={event => setDraft(current => ({ ...current, canonicalClinicStatusKey: event.target.value }))}>
          <option value="">{common.noCanonical}</option>
          {draft.canonicalClinicStatusKey && !canonicalOptions.some(option => option.value === draft.canonicalClinicStatusKey) && <option value={draft.canonicalClinicStatusKey}>{draft.canonicalClinicStatusKey}</option>}
          {canonicalOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select><small className="leading-relaxed text-muted-foreground">{common.canonicalHelp}</small>
      </label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><span className="grid gap-2 text-xs text-muted-foreground">{copy.preview}<span className="rounded-md px-3 py-2 font-semibold text-white" style={{ backgroundColor: draft.color }}>{draft.label || copy.name}</span></span>
      <Button type="button" data-testid="quick-option-save" disabled={!dirty || !draft.label.trim() || save.isPending || actionPending} onClick={() => save.mutate()}>{common.save}</Button>
    </div>
    <section className="border-t pt-4" aria-label={copy.actions}>{renderActions(setActionDirty, setActionPending)}</section>
  </section>;
}
