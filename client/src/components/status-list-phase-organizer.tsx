import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Layers3, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const text = {
  title: ["Place existing questions", "Zaradiť existujúce otázky", "Zařadit existující otázky", "Meglévő kérdések elhelyezése", "Încadrează întrebările existente", "Assegna le domande esistenti", "Vorhandene Fragen zuordnen"],
  explanation: ["Choose the groups to move. Their subquestions inherit this phase unless they have their own explicit assignment. Nothing changes until you save.", "Vyber skupiny, ktoré chceš zaradiť. Ich podotázky preberajú fázu, pokiaľ nemajú vlastné zaradenie. Do uloženia sa nič nemení.", "Vyberte skupiny k zařazení. Jejich podotázky přebírají fázi, pokud nemají vlastní zařazení. Do uložení se nic nemění.", "Válassza ki a csoportokat. Az alkérdések öröklik a fázist, ha nincs saját besorolásuk. Mentésig semmi nem változik.", "Alege grupurile. Subîntrebările moștenesc faza dacă nu au o încadrare proprie. Nimic nu se schimbă până la salvare.", "Scegli i gruppi. Le sottodomande ereditano la fase se non hanno un'assegnazione propria. Nulla cambia prima del salvataggio.", "Wählen Sie die Gruppen. Unterfragen erben die Phase, sofern sie keine eigene Zuordnung haben. Bis zum Speichern ändert sich nichts."],
  phase: ["Where should agents see them?", "Kde ich má agent vidieť?", "Kde je má agent vidět?", "Hol lássa az ügyintéző?", "Unde le vede agentul?", "Dove deve vederle l'agente?", "Wo sollen Agenten sie sehen?"],
  shared: ["Shared / no specific phase", "Spoločné / bez určenej fázy", "Společné / bez určené fáze", "Közös / nincs külön fázis", "Comune / fără fază specifică", "Condivise / nessuna fase specifica", "Gemeinsam / keine bestimmte Phase"],
  acquisition: ["Acquisition", "Acquisition", "Acquisition", "Acquisition", "Acquisition", "Acquisition", "Acquisition"],
  contract: ["Contract", "Contract", "Contract", "Contract", "Contract", "Contract", "Contract"],
  retention: ["Retention", "Retention", "Retention", "Retention", "Retention", "Retention", "Retention"],
  all: ["Select all groups", "Vybrať všetky skupiny", "Vybrat všechny skupiny", "Minden csoport kijelölése", "Selectează toate grupurile", "Seleziona tutti i gruppi", "Alle Gruppen auswählen"],
  save: ["Save placement", "Uložiť zaradenie", "Uložit zařazení", "Elhelyezés mentése", "Salvează încadrarea", "Salva assegnazione", "Zuordnung speichern"],
  cancel: ["Cancel", "Zrušiť", "Zrušit", "Mégse", "Anulează", "Annulla", "Abbrechen"],
  impact: ["This changes the selected groups' placement in Nexus Pulse. It does not confirm answers or execute actions.", "Zmení sa umiestnenie vybraných skupín v Nexus Pulse. Odpovede sa nepotvrdia a žiadne akcie sa nespustia.", "Změní se umístění vybraných skupin v Nexus Pulse. Odpovědi se nepotvrdí a žádné akce se nespustí.", "A kiválasztott csoportok Nexus Pulse-elhelyezése változik. Válasz nem kerül megerősítésre és művelet sem indul.", "Se schimbă poziția grupurilor în Nexus Pulse. Nu se confirmă răspunsuri și nu se execută acțiuni.", "Cambia la posizione dei gruppi in Nexus Pulse. Non conferma risposte né esegue azioni.", "Die Platzierung der Gruppen in Nexus Pulse ändert sich. Keine Antworten werden bestätigt und keine Aktionen ausgeführt."],
  saved: ["Placement saved", "Zaradenie uložené", "Zařazení uloženo", "Elhelyezés mentve", "Încadrare salvată", "Assegnazione salvata", "Zuordnung gespeichert"],
  partial: ["Some groups could not be saved. The unsaved groups remain selected; retry or cancel.", "Niektoré skupiny sa nepodarilo uložiť. Neuložené zostali vybrané; zopakuj uloženie alebo zruš.", "Některé skupiny se nepodařilo uložit. Neuložené zůstaly vybrané; zkuste znovu nebo zrušte.", "Egyes csoportok mentése sikertelen. Ezek kijelölve maradtak; próbálja újra vagy szakítsa meg.", "Unele grupuri nu au fost salvate. Cele nesalvate rămân selectate; reîncearcă sau anulează.", "Alcuni gruppi non sono stati salvati. Restano selezionati: riprova o annulla.", "Einige Gruppen konnten nicht gespeichert werden. Sie bleiben ausgewählt; erneut versuchen oder abbrechen."],
  empty: ["No groups are available.", "Nie sú dostupné žiadne skupiny.", "Nejsou dostupné žádné skupiny.", "Nincsenek elérhető csoportok.", "Nu sunt grupuri disponibile.", "Nessun gruppo disponibile.", "Keine Gruppen verfügbar."],
  unassigned: ["No phase assigned", "Fáza nie je nastavená", "Fáze není nastavena", "Nincs fázis megadva", "Fază nesetată", "Fase non impostata", "Keine Phase festgelegt"],
  selected: ["Selected groups", "Vybrané skupiny", "Vybrané skupiny", "Kiválasztott csoportok", "Grupuri selectate", "Gruppi selezionati", "Ausgewählte Gruppen"],
  emptyPhase: ["No question has been assigned to this phase yet.", "Do tejto fázy zatiaľ nie je zaradená žiadna otázka.", "Do této fáze zatím není zařazena žádná otázka.", "Ehhez a fázishoz még nincs kérdés rendelve.", "Nicio întrebare nu a fost încadrată încă în această fază.", "Nessuna domanda è ancora assegnata a questa fase.", "Dieser Phase ist noch keine Frage zugeordnet."],
  legacy: ["Questions without a phase are under Shared. Imports did not set this field; names and clinic statuses are not phase assignments.", "Otázky bez fázy nájdeš v Spoločné. Import toto pole nevypĺňal; názov ani stav ambulancie nie sú zaradením do fázy.", "Otázky bez fáze najdete ve Společné. Import toto pole nevyplňoval; název ani stav ambulance nejsou zařazením do fáze.", "A fázis nélküli kérdések a Közös alatt találhatók. Az import nem töltötte ki ezt a mezőt; a név és a rendelő állapota nem fázisbesorolás.", "Întrebările fără fază sunt la Comune. Importul nu completa acest câmp; numele și starea clinicii nu reprezintă o încadrare.", "Le domande senza fase sono in Condivise. L'importazione non compilava questo campo; nome e stato della clinica non sono assegnazioni di fase.", "Fragen ohne Phase stehen unter Gemeinsam. Der Import füllte dieses Feld nicht aus; Name und Klinikstatus sind keine Phasenzuordnung."],
} as const;
export function getPhaseOrganizerCopy(locale: string) {
  const index = Math.max(0, ["en", "sk", "cs", "hu", "ro", "it", "de"].indexOf(locale));
  return Object.fromEntries(Object.entries(text).map(([key, values]) => [key, values[index]])) as { [K in keyof typeof text]: string };
}

type Item = { id: string; parentId: string | null; label: string; stepId: string; tab?: string | null; itemType?: string };
export function StatusListPhaseOrganizer({ campaignId, locale, items, phase = "all" }: { campaignId: string; locale: string; items: Item[]; phase?: string }) {
  const copy = getPhaseOrganizerCopy(locale);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("acquisition");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);
  const roots = items.filter(item => !item.parentId && item.itemType !== "option");
  const save = useMutation({
    mutationFn: async () => {
      const unsuccessful: string[] = [];
      for (const id of selected) {
        try {
          await apiRequest("PATCH", `/api/campaigns/${campaignId}/status-list-workflows/items/${id}/presentation`, { tab: target === "shared" ? null : target });
        } catch { unsuccessful.push(id); }
      }
      return unsuccessful;
    },
    onSuccess: async unsuccessful => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }),
        queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/status-list-workflows/option-sources`] }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list-workflows"] }),
      ]);
      if (unsuccessful.length) {
        setSelected(new Set(unsuccessful)); setFailed(true);
        toast({ title: copy.partial, variant: "destructive" });
      } else { setOpen(false); toast({ title: copy.saved }); }
    },
  });
  return <>
    <Button type="button" variant="outline" size="sm" className="w-full gap-2 text-xs" data-testid="status-list-organize-phases" onClick={() => {
      setTarget(["acquisition", "contract", "retention"].includes(phase) ? phase : "acquisition");
      setSelected(new Set()); setFailed(false); setOpen(true);
    }}><Layers3 size={14}/>{copy.title}</Button>
    <Dialog open={open} onOpenChange={value => { if (!save.isPending) setOpen(value); }}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto" data-testid="status-list-phase-organizer">
        <DialogHeader><DialogTitle>{copy.title}</DialogTitle></DialogHeader>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.explanation}</p>
        <label className="grid gap-2 text-sm font-medium">{copy.phase}
          <select value={target} onChange={event => setTarget(event.target.value)} disabled={save.isPending} className="slw-native-select" data-testid="status-list-organizer-target">
            {(["acquisition", "contract", "retention", "shared"] as const).map(value => <option key={value} value={value}>{copy[value]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={save.isPending || !roots.length} checked={!!roots.length && selected.size === roots.length} onChange={event => setSelected(new Set(event.target.checked ? roots.map(item => item.id) : []))}/>{copy.all}</label>
        <div className="max-h-[35dvh] overflow-y-auto rounded-lg border divide-y">
          {roots.map(item => <label key={item.id} className="flex cursor-pointer items-start gap-3 p-3 text-sm hover:bg-muted/40">
            <input type="checkbox" className="mt-1" data-testid={`status-list-organizer-select-${item.id}`} disabled={save.isPending} checked={selected.has(item.id)} onChange={event => setSelected(previous => {
              const result = new Set(previous); event.target.checked ? result.add(item.id) : result.delete(item.id); return result;
            })}/>
            <span className="min-w-0 flex-1"><strong className="block font-medium">{item.label}</strong><small className="text-muted-foreground">{item.stepId} · {item.tab && item.tab !== "both" ? item.tab : copy.unassigned}</small></span>
          </label>)}
          {!roots.length && <p className="p-4 text-sm text-muted-foreground">{copy.empty}</p>}
        </div>
        <p className="rounded-lg bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">{copy.impact}</p>
        {failed && <p role="alert" className="text-sm text-destructive">{copy.partial}</p>}
        <footer className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{copy.selected}: {selected.size}</span>
          <div className="flex gap-2"><Button type="button" variant="ghost" disabled={save.isPending} onClick={() => setOpen(false)}>{copy.cancel}</Button>
            <Button type="button" disabled={save.isPending || !selected.size} onClick={() => save.mutate()} data-testid="status-list-organizer-save">{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{copy.save}</Button></div>
        </footer>
      </DialogContent>
    </Dialog>
  </>;
}
