import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import "./status-list-disposition-import-editor.css";

// Status List editors deliberately use local seven-language dictionaries.
const text = {
  select: ["Selection", "Výber", "Výběr", "Kiválasztás", "Selectare", "Selezione", "Auswahl"],
  review: ["Review", "Kontrola", "Kontrola", "Ellenőrzés", "Verificare", "Verifica", "Prüfen"],
  result: ["Result", "Výsledok", "Výsledek", "Eredmény", "Rezultat", "Risultato", "Ergebnis"],
  help: ["Choose dispositions to copy as new Status List steps.", "Vyber dispozície, ktoré sa skopírujú ako nové kroky Status Listu.", "Vyberte dispozice ke zkopírování jako nové kroky Status Listu.", "Válassza ki az új Status List lépésként másolandó diszpozíciókat.", "Alege dispozițiile de copiat ca pași noi în Status List.", "Scegli le disposizioni da copiare come nuovi passaggi dello Status List.", "Wählen Sie Dispositionen, die als neue Status-List-Schritte kopiert werden."],
  safety: ["Existing steps, answers and actions stay unchanged. Importing does not run actions.", "Existujúce kroky, odpovede a akcie zostanú nezmenené. Import nespúšťa akcie.", "Stávající kroky, odpovědi a akce zůstanou nezměněny. Import nespouští akce.", "A meglévő lépések, válaszok és műveletek változatlanok. Az import nem futtat műveleteket.", "Pașii, răspunsurile și acțiunile existente rămân neschimbate. Importul nu execută acțiuni.", "Passaggi, risposte e azioni esistenti restano invariati. L'importazione non esegue azioni.", "Vorhandene Schritte, Antworten und Aktionen bleiben unverändert. Der Import führt keine Aktionen aus."],
  mapping: ["Only code, name and description are copied. New steps are optional radio steps in Shared, without phase assignment. Disposition actions and parent/child links are not copied.", "Kopíruje sa iba kód, názov a popis. Vzniknú nepovinné rádio kroky v Zdieľané, bez priradenia fázy. Akcie dispozície ani väzby rodič/potomok sa nekopírujú.", "Kopíruje se pouze kód, název a popis. Vzniknou nepovinné rádiové kroky ve Sdílené, bez přiřazení fáze. Akce dispozice ani vazby rodič/potomek se nekopírují.", "Csak a kód, név és leírás másolódik. Opcionális rádiós lépések jönnek létre a Közös részben, fázis nélkül. A műveletek és szülő/gyermek kapcsolatok nem másolódnak.", "Se copiază doar codul, numele și descrierea. Se creează pași radio opționali în Partajate, fără fază. Acțiunile și relațiile părinte/copil nu se copiază.", "Si copiano solo codice, nome e descrizione. Si creano passaggi radio facoltativi in Condivisi, senza fase. Azioni e collegamenti padre/figlio non vengono copiati.", "Nur Code, Name und Beschreibung werden kopiert. Optionale Radio-Schritte entstehen unter Gemeinsam, ohne Phase. Aktionen und Eltern-Kind-Verknüpfungen werden nicht kopiert."],
  duplicate: ["Existing codes are highlighted. Import adds another step; it does not merge or replace it.", "Existujúce kódy sú zvýraznené. Import pridá ďalší krok; nezlučuje ho ani nenahrádza.", "Existující kódy jsou zvýrazněny. Import přidá další krok; neslučuje ani nenahrazuje.", "A meglévő kódok kiemelve láthatók. Az import új lépést ad hozzá, nem egyesít és nem cserél.", "Codurile existente sunt evidențiate. Importul adaugă alt pas, fără unire sau înlocuire.", "I codici esistenti sono evidenziati. L'importazione aggiunge un passaggio, senza unire o sostituire.", "Vorhandene Codes sind markiert. Der Import ergänzt einen Schritt, ohne Zusammenführen oder Ersetzen."],
  existing: ["Code already exists", "Kód už existuje", "Kód již existuje", "A kód már létezik", "Codul există deja", "Codice già presente", "Code bereits vorhanden"],
  count: ["Selected", "Vybrané", "Vybráno", "Kiválasztva", "Selectate", "Selezionate", "Ausgewählt"],
  added: ["Added steps", "Pridané kroky", "Přidané kroky", "Hozzáadott lépések", "Pași adăugați", "Passaggi aggiunti", "Hinzugefügte Schritte"],
  next: ["Review selection", "Skontrolovať výber", "Zkontrolovat výběr", "Kiválasztás ellenőrzése", "Verifică selecția", "Verifica selezione", "Auswahl prüfen"],
  back: ["Back", "Späť", "Zpět", "Vissza", "Înapoi", "Indietro", "Zurück"],
  cancel: ["Cancel", "Zrušiť", "Zrušit", "Mégse", "Anulează", "Annulla", "Abbrechen"],
  close: ["Done", "Hotovo", "Hotovo", "Kész", "Gata", "Fine", "Fertig"],
  apply: ["Confirm import", "Potvrdiť import", "Potvrdit import", "Import megerősítése", "Confirmă importul", "Conferma importazione", "Import bestätigen"],
  retry: ["Retry", "Skúsiť znova", "Zkusit znovu", "Újrapróbálás", "Reîncearcă", "Riprova", "Erneut versuchen"],
  loading: ["Loading dispositions…", "Načítavam dispozície…", "Načítám dispozice…", "Diszpozíciók betöltése…", "Se încarcă dispozițiile…", "Caricamento disposizioni…", "Dispositionen werden geladen…"],
  empty: ["No dispositions available.", "Nie sú dostupné žiadne dispozície.", "Nejsou dostupné žádné dispozice.", "Nincs elérhető diszpozíció.", "Nu există dispoziții disponibile.", "Nessuna disposizione disponibile.", "Keine Dispositionen verfügbar."],
  loadError: ["Dispositions could not be loaded.", "Dispozície sa nepodarilo načítať.", "Dispozice se nepodařilo načíst.", "A diszpozíciók nem tölthetők be.", "Dispozițiile nu au putut fi încărcate.", "Impossibile caricare le disposizioni.", "Dispositionen konnten nicht geladen werden."],
  error: ["Import stopped. Check the added steps before continuing. Confirmed additions will not be resent.", "Import sa zastavil. Pred pokračovaním skontroluj pridané kroky. Potvrdené prírastky sa neodošlú znova.", "Import se zastavil. Před pokračováním zkontrolujte přidané kroky. Potvrzené přírůstky se znovu neodešlou.", "Az import leállt. Folytatás előtt ellenőrizze a hozzáadott lépéseket. A megerősített tételek nem lesznek újraküldve.", "Importul s-a oprit. Verifică pașii adăugați înainte de continuare. Adăugările confirmate nu vor fi retrimise.", "Importazione interrotta. Controlla i passaggi aggiunti prima di continuare. Le aggiunte confermate non saranno reinviate.", "Import angehalten. Prüfen Sie hinzugefügte Schritte vor dem Fortfahren. Bestätigte Ergänzungen werden nicht erneut gesendet."],
} as const;
type Disposition = { id: string; code?: string | null; name: string; description?: string | null; parentId?: string | null };
export function StatusListDispositionImportEditor({ campaignId, locale, dispositions, existingSteps, loading, loadError, onRetry, onClose, onDirtyChange, onPendingChange }: {
  campaignId: string; locale: string; dispositions: Disposition[]; existingSteps: { stepId: string }[];
  loading: boolean; loadError: boolean; onRetry: () => void; onClose: () => void;
  onDirtyChange: (dirty: boolean) => void; onPendingChange: (pending: boolean) => void;
}) {
  const index = Math.max(0, ["en", "sk", "cs", "hu", "ro", "it", "de"].indexOf(locale));
  const copy = (key: keyof typeof text) => text[key][index];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<"select" | "review" | "result">("select");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const completedRef = useRef(new Set<string>());
  const planRef = useRef<{ disposition: Disposition; payload: { stepId: string; label: string; description: string | null; confirmationType: string; required: boolean; sortOrder: number } }[]>([]);
  const dirtyRef = useRef(onDirtyChange); dirtyRef.current = onDirtyChange;
  const pendingRef = useRef(onPendingChange); pendingRef.current = onPendingChange;
  useEffect(() => { dirtyRef.current(selected.size > 0 && stage !== "result"); }, [selected, stage]);
  useEffect(() => () => { dirtyRef.current(false); pendingRef.current(false); }, []);
  useEffect(() => {
    if (!selected.size || stage === "result") return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [selected.size, stage]);
  const run = useMutation({
    mutationFn: async () => {
      for (const row of planRef.current) {
        if (completedRef.current.has(row.disposition.id)) continue;
        await apiRequest("POST", `/api/campaigns/${campaignId}/status-list`, row.payload);
        completedRef.current.add(row.disposition.id);
        setCompleted(new Set(completedRef.current));
      }
    },
    onSuccess: () => setStage("result"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }),
  });
  useEffect(() => { pendingRef.current(run.isPending); }, [run.isPending]);
  const roots = dispositions.filter(row => !row.parentId);
  const rows = roots.flatMap(row => [row, ...dispositions.filter(child => child.parentId === row.id)]);
  const codes = new Set(existingSteps.map(row => row.stepId));
  const review = () => {
    planRef.current = [...selected].map((id, position) => {
      const disposition = dispositions.find(row => row.id === id)!;
      return { disposition, payload: { stepId: disposition.code || `DISP-${String(position + 1).padStart(2, "0")}`,
        label: disposition.name, description: disposition.description || null, confirmationType: "radio", required: false, sortOrder: existingSteps.length + position } };
    });
    setStage("review");
  };
  return <section className="min-w-0 space-y-5" data-testid="status-list-disposition-import-editor" aria-busy={run.isPending}>
    <nav className="flex gap-2 border-b pb-3 text-xs" aria-label={copy("review")}>
      {(["select", "review", "result"] as const).map((name, position) => <span key={name} aria-current={stage === name ? "step" : undefined} className={`rounded-md px-3 py-2 ${stage === name ? "bg-primary/10 font-semibold text-foreground" : "text-muted-foreground"}`}>{position + 1}. {copy(name)}</span>)}
    </nav>
    <p className="text-sm text-muted-foreground">{copy("help")}</p>
    <aside className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed" data-testid="disposition-import-impact"><strong>{copy("safety")}</strong><p className="mt-2">{copy("mapping")}</p></aside>
    {stage === "select" && <div className="space-y-2">
      {loading ? <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin"/>{copy("loading")}</p> : loadError ? <p role="alert" className="text-sm">{copy("loadError")} <Button variant="outline" onClick={onRetry}>{copy("retry")}</Button></p> : !rows.length ? <p className="p-5 text-center text-sm text-muted-foreground">{copy("empty")}</p> : rows.map(row => <label key={row.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/40 ${row.parentId ? "ml-5" : ""}`}>
        <input type="checkbox" className="h-4 w-4 accent-primary" data-testid={`import-disp-${row.id}`} checked={selected.has(row.id)} onChange={() => setSelected(current => { const next = new Set(current); next.has(row.id) ? next.delete(row.id) : next.add(row.id); return next; })}/>
        <span className="min-w-0 flex-1 break-words font-medium">{row.name}{row.code && <small className="mt-1 block font-mono text-muted-foreground">{row.code}</small>}</span>
        {row.code && codes.has(row.code) && <span className="text-xs text-amber-700 dark:text-amber-300">{copy("existing")}</span>}
      </label>)}
    </div>}
    {stage === "review" && <div className="space-y-3" data-testid="disposition-import-review">
      <p className="text-xs leading-relaxed text-muted-foreground">{copy("duplicate")}</p>
      {planRef.current.map(row => <div key={row.disposition.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
        {completed.has(row.disposition.id) && <Check className="h-4 w-4 shrink-0 text-emerald-600"/>}
        <div className="min-w-0 flex-1"><strong className="break-words">{row.payload.label}</strong><p className="mt-1 font-mono text-xs text-muted-foreground">{row.payload.stepId}</p>{row.payload.description && <p className="mt-1 break-words text-xs text-muted-foreground">{row.payload.description}</p>}</div>
        {codes.has(row.payload.stepId) && !completed.has(row.disposition.id) && <span className="text-xs text-amber-700 dark:text-amber-300">{copy("existing")}</span>}
      </div>)}
    </div>}
    {stage === "result" && <div role="status" className="rounded-lg border bg-emerald-500/5 p-5" data-testid="disposition-import-result"><Check className="mb-2 h-6 w-6 text-emerald-600"/><strong>{copy("added")}: {completed.size}</strong><p className="mt-2 text-xs text-muted-foreground">{copy("safety")}</p></div>}
    {run.isError && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm">{copy("error")} <strong>{copy("added")}: {completed.size}</strong></p>}
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <span className="text-xs text-muted-foreground">{copy(stage === "select" ? "count" : "added")}: {stage === "select" ? selected.size : completed.size}{stage === "review" && ` / ${planRef.current.length}`}</span>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={run.isPending} onClick={onClose}>{copy(stage === "result" ? "close" : "cancel")}</Button>
        {stage === "review" && !completed.size && <Button type="button" variant="outline" disabled={run.isPending} data-testid="disposition-import-back" onClick={() => { run.reset(); setStage("select"); }}>{copy("back")}</Button>}
        {stage === "select" && <Button type="button" disabled={!selected.size || loading || loadError} data-testid="disposition-import-next" onClick={review}>{copy("next")} ({selected.size})</Button>}
        {stage === "review" && <Button type="button" disabled={run.isPending} data-testid="btn-confirm-import-dispositions" onClick={() => run.mutate()}>{run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}{copy(run.isError ? "retry" : "apply")} ({planRef.current.length - completed.size})</Button>}
      </div>
    </footer>
  </section>;
}
