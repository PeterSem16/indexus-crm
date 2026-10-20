import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, CircleCheck, ClipboardList, Loader2, Plus, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAutoLabel, getAutoTaskDescription, getStepDescription, getStepLabel, ROLE_BADGE_MAP, type TemplateStep } from "@/data/cla-template";
import { StatusListHelp } from "./status-list-help";
import "./status-list-template-editor.css";

type TemplateId = "CLA" | "CLB" | "MPN";
type Question = { id: string; questionText: string; questionTextL10n?: Record<string, string>; description?: string; descriptionL10n?: Record<string, string>; fieldType: "text"; required?: boolean };
type StepWithQuestions = TemplateStep & { questions?: Question[] };
type StepWithTiming = StepWithQuestions & { callbackTimingL10n?: Record<string, string> };
type PlanStep = { step: StepWithQuestions; sortOrder: number; parentStepId: string | null; automations: TemplateStep["automations"]; questions: Question[] };
type Props = {
  open: boolean;
  campaignId: string;
  locale: string;
  existingSteps: { stepId: string }[];
  templates: Record<TemplateId, StepWithQuestions[]>;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
};

const languages = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;
const copy = {
  title: ["Status List templates", "Šablóny Status Listu", "Šablony Status Listu", "Status List sablonok", "Șabloane Status List", "Modelli Status List", "Status-List-Vorlagen"],
  intro: ["Choose a template and shape the additions before anything is written.", "Vyberte šablónu a upravte prírastky pred ich uložením.", "Vyberte šablonu a upravte přírůstky před uložením.", "Válasszon sablont, és alakítsa a hozzáadásokat mentés előtt.", "Alegeți un șablon și configurați adăugările înainte de salvare.", "Scegli un modello e definisci le aggiunte prima del salvataggio.", "Vorlage wählen und Ergänzungen vor dem Speichern festlegen."],
  selection: ["Selection", "Výber", "Výběr", "Kiválasztás", "Selectare", "Selezione", "Auswahl"], review: ["Review", "Kontrola", "Kontrola", "Ellenőrzés", "Verificare", "Verifica", "Prüfen"], result: ["Result", "Výsledok", "Výsledek", "Eredmény", "Rezultat", "Risultato", "Ergebnis"],
  step: ["steps", "kroky", "kroky", "lépés", "pași", "passaggi", "Schritte"], action: ["actions", "akcie", "akce", "művelet", "acțiuni", "azioni", "Aktionen"], questions: ["questions", "otázky", "otázky", "kérdés", "întrebări", "domande", "Fragen"],
  all: ["Select all", "Vybrať všetko", "Vybrat vše", "Összes kijelölése", "Selectează tot", "Seleziona tutto", "Alle auswählen"], none: ["Clear all", "Zrušiť výber", "Zrušit výběr", "Kijelölés törlése", "Deselectează tot", "Deseleziona tutto", "Auswahl aufheben"],
  next: ["Review plan", "Skontrolovať plán", "Zkontrolovat plán", "Terv ellenőrzése", "Verifică planul", "Verifica piano", "Plan prüfen"], back: ["Back to selection", "Späť na výber", "Zpět k výběru", "Vissza a kijelöléshez", "Înapoi la selecție", "Torna alla selezione", "Zurück zur Auswahl"],
  cancel: ["Cancel", "Zrušiť", "Zrušit", "Mégse", "Anulează", "Annulla", "Abbrechen"], close: ["Close", "Zavrieť", "Zavřít", "Bezárás", "Închide", "Chiudi", "Schließen"],
  apply: ["Confirm additions", "Potvrdiť pridanie", "Potvrdit přidání", "Hozzáadás megerősítése", "Confirmă adăugările", "Conferma aggiunte", "Ergänzungen bestätigen"], retry: ["Retry remaining", "Zopakovať zvyšok", "Zopakovat zbývající", "Hátralévők újrapróbálása", "Reîncearcă restul", "Riprova il resto", "Rest erneut versuchen"],
  impact: ["This adds new steps, actions and questions only. Existing records and duplicate codes are not merged, replaced or changed. No configured action runs when you apply this plan.", "Týmto sa pridajú iba nové kroky, akcie a otázky. Existujúce záznamy ani duplicitné kódy sa nezlučujú, nenahrádzajú ani nemenia. Konfigurácia nespúšťa žiadnu akciu.", "Tím se přidají pouze nové kroky, akce a otázky. Stávající záznamy ani duplicitní kódy se neslučují, nenahrazují ani nemění. Konfigurace nespouští žádnou akci.", "Ez csak új lépéseket, műveleteket és kérdéseket ad hozzá. A meglévő rekordok és kódütközések nem kerülnek összevonásra, cserére vagy módosításra. Alkalmazáskor nem fut le művelet.", "Se adaugă doar pași, acțiuni și întrebări noi. Înregistrările existente și codurile duplicate nu sunt unite, înlocuite sau modificate. Aplicarea configurației nu execută acțiuni.", "Aggiunge solo nuovi passaggi, azioni e domande. I record esistenti e i codici duplicati non vengono uniti, sostituiti o modificati. L'applicazione non esegue azioni.", "Es werden nur neue Schritte, Aktionen und Fragen ergänzt. Bestehende Datensätze und doppelte Codes werden weder zusammengeführt noch ersetzt oder geändert. Beim Anwenden wird keine Aktion ausgeführt."],
  duplicate: ["Code already exists — this will be an additional step.", "Kód už existuje — pridá sa ďalší krok.", "Kód již existuje — přidá se další krok.", "A kód már létezik — további lépés kerül hozzáadásra.", "Codul există deja — se va adăuga un pas suplimentar.", "Codice già presente: verrà aggiunto un altro passaggio.", "Code bereits vorhanden — ein weiterer Schritt wird ergänzt."],
  parent: ["Required parent included automatically", "Potrebný nadradený krok bol pridaný automaticky", "Potřebný nadřazený krok byl přidán automaticky", "A szükséges szülőlépés automatikusan bekerült", "Pasul părinte necesar a fost inclus automat", "Passaggio padre necessario incluso automaticamente", "Erforderlicher übergeordneter Schritt automatisch enthalten"],
  descendant: ["Remove selected child steps first.", "Najprv odoberte vybrané podriadené kroky.", "Nejprve odeberte vybrané podřízené kroky.", "Először távolítsa el a kijelölt gyermeklépéseket.", "Eliminați mai întâi pașii copil selectați.", "Rimuovi prima i passaggi figli selezionati.", "Entfernen Sie zuerst ausgewählte untergeordnete Schritte."],
  acknowledge: ["I reviewed the additions and understand existing codes will remain unchanged.", "Skontroloval/-a som prírastky a rozumiem, že existujúce kódy zostanú nezmenené.", "Zkontroloval/a jsem přírůstky a rozumím, že stávající kódy zůstanou beze změny.", "Áttekintettem a hozzáadásokat, és tudomásul veszem, hogy a meglévő kódok változatlanok maradnak.", "Am verificat adăugările și înțeleg că codurile existente rămân neschimbate.", "Ho verificato le aggiunte e comprendo che i codici esistenti resteranno invariati.", "Ich habe die Ergänzungen geprüft und verstanden, dass bestehende Codes unverändert bleiben."],
  instructions: ["Reference instructions only — conditions, restrictions, action notes and callback timing are not executed by this template import.", "Iba informačné pokyny — podmienky, obmedzenia, poznámky k akciám ani načasovanie callbacku sa importom nevykonávajú.", "Pouze informativní pokyny — podmínky, omezení, poznámky k akcím ani načasování callbacku se importem nevykonávají.", "Csak tájékoztató utasítások — a feltételek, korlátozások, műveleti megjegyzések és callback-időzítés nem futnak le.", "Doar instrucțiuni informative — condițiile, restricțiile, notele de acțiune și programarea callbackului nu sunt executate.", "Solo istruzioni informative: condizioni, restrizioni, note sulle azioni e tempistiche callback non vengono eseguite.", "Nur Hinweise — Bedingungen, Einschränkungen, Aktionsnotizen und Callback-Zeitpunkte werden nicht ausgeführt."],
  error: ["Some additions could not be confirmed. Successful items are remembered for this open editor; retry sends only the remaining items. Network loss may leave an unconfirmed server result.", "Niektoré prírastky sa nepodarilo potvrdiť. Úspešné položky si editor počas otvorenia pamätá; opakovanie odošle iba zvyšné. Pri strate spojenia môže výsledok na serveri zostať nepotvrdený.", "Některé přírůstky se nepodařilo potvrdit. Úspěšné položky si editor během otevření pamatuje; opakování odešle jen zbývající. Při ztrátě spojení může výsledek na serveru zůstat nepotvrzený.", "Néhány hozzáadás nem igazolható. A szerkesztő a megnyitás idején megjegyzi a sikeres elemeket; az újrapróbálás csak a többit küldi el. Hálózati hiba esetén a szervereredmény bizonytalan lehet.", "Unele adăugări nu au putut fi confirmate. Editorul reține elementele reușite cât timp este deschis; reîncercarea trimite doar restul. Pierderea conexiunii poate lăsa rezultatul serverului neconfirmat.", "Non è stato possibile confermare alcune aggiunte. L'editor ricorda quelle riuscite finché resta aperto; il nuovo tentativo invia solo le restanti. Una perdita di rete può lasciare incerto il risultato sul server.", "Einige Ergänzungen konnten nicht bestätigt werden. Erfolgreiche Elemente bleiben während dieser geöffneten Sitzung vorgemerkt; ein erneuter Versuch sendet nur den Rest. Bei Verbindungsverlust kann das Serverergebnis unbestätigt bleiben."],
  done: ["Added", "Pridané", "Přidáno", "Hozzáadva", "Adăugate", "Aggiunti", "Hinzugefügt"], reviewTitle: ["Review additions", "Kontrola prírastkov", "Kontrola přírůstků", "Hozzáadások áttekintése", "Verificarea adăugărilor", "Verifica aggiunte", "Ergänzungen prüfen"],
  hidden: ["Hidden", "Skryté", "Skryté", "Rejtett", "Ascuns", "Nascosto", "Ausgeblendet"],
  parentLabel: ["Parent", "Nadradený krok", "Nadřazený krok", "Szülőlépés", "Pas părinte", "Passaggio padre", "Übergeordneter Schritt"],
  condition: ["Condition", "Podmienka", "Podmínka", "Feltétel", "Condiție", "Condizione", "Bedingung"],
  actionNote: ["Action note", "Pokyn k akcii", "Pokyn k akci", "Műveleti megjegyzés", "Notă de acțiune", "Nota sull'azione", "Aktionshinweis"],
  timing: ["Callback timing", "Načasovanie callbacku", "Načasování callbacku", "Visszahívás időzítése", "Termen revenire", "Tempistica richiamata", "Rückrufzeitpunkt"],
  restrictions: ["Restrictions", "Obmedzenia", "Omezení", "Korlátozások", "Restricții", "Restrizioni", "Einschränkungen"],
  included: ["included with this step", "zahrnuté v tomto kroku", "zahrnuté v tomto kroku", "ebben a lépésben", "incluse în acest pas", "incluse in questo passaggio", "in diesem Schritt enthalten"],
  timingReference: ["Timing reference", "Informačný termín", "Informativní termín", "Tájékoztató időpont", "Termen informativ", "Termine indicativo", "Zeitangabe"],
  descriptionLabel: ["Step description", "Popis kroku", "Popis kroku", "Lépés leírása", "Descrierea pasului", "Descrizione del passaggio", "Schrittbeschreibung"],
} as const;

export function StatusListTemplateEditor({ open, campaignId, locale, existingSteps, templates, onClose, onDirtyChange, onPendingChange }: Props) {
  const lang = languages.includes(locale as typeof languages[number]) ? locale : "en";
  const index = languages.indexOf(lang as typeof languages[number]);
  const t = (key: keyof typeof copy) => copy[key][index];
  const [tab, setTab] = useState<TemplateId>("CLA");
  const [stage, setStage] = useState<"selection" | "review" | "result">("selection");
  const [selectedByTab, setSelectedByTab] = useState<Record<TemplateId, Set<string>>>({ CLA: new Set(), CLB: new Set(), MPN: new Set() });
  const [autosByTab, setAutosByTab] = useState<Record<TemplateId, Map<string, Set<string>>>>({ CLA: new Map(), CLB: new Map(), MPN: new Map() });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [acknowledged, setAcknowledged] = useState(false);
  const [partialError, setPartialError] = useState(false);
  const [createdSteps, setCreatedSteps] = useState<Set<string>>(new Set());
  const [createdAutos, setCreatedAutos] = useState<Set<string>>(new Set());
  const [createdQuestions, setCreatedQuestions] = useState<Set<string>>(new Set());
  const createdStepIds = useRef(new Map<string, string>());
  const createdAutosRef = useRef(new Set<string>());
  const createdQuestionsRef = useRef(new Set<string>());
  const wasOpen = useRef(false);
  const planRef = useRef<PlanStep[]>([]);
  const active = templates[tab];
  const selected = selectedByTab[tab];
  const selectedAutos = autosByTab[tab];
  const existingCodes = useMemo(() => new Set(existingSteps.map(row => row.stepId)), [existingSteps]);
  const ordered = useMemo(() => {
    const byId = new Map(active.map(step => [step.stepId, step]));
    const depth = (step: StepWithQuestions) => {
      let count = 0; let parent = step.parentStepId; const seen = new Set<string>();
      while (parent && byId.has(parent) && !seen.has(parent)) { seen.add(parent); count++; parent = byId.get(parent)?.parentStepId; }
      return count;
    };
    return [...active].sort((a, b) => depth(a) - depth(b) || active.indexOf(a) - active.indexOf(b));
  }, [active]);
  const descendants = (id: string) => {
    const found = new Set<string>(); let changed = true;
    while (changed) { changed = false; for (const step of active) if (step.parentStepId && (step.parentStepId === id || found.has(step.parentStepId)) && !found.has(step.stepId)) { found.add(step.stepId); changed = true; } }
    return found;
  };
  const selectedStepsCount = selected.size;
  const actionCount = Array.from(selectedAutos.entries()).filter(([id]) => selected.has(id)).reduce((n, [, ids]) => n + ids.size, 0);
  const questionsCount = active.filter(step => selected.has(step.stepId)).reduce((n, step) => n + (step.questions?.length ?? 0), 0);
  const isDirty = partialError || Object.entries(selectedByTab).some(([id, ids]) => ids.size > 0 && (stage !== "result" || id !== tab));
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const dirtyRef = useRef(onDirtyChange); dirtyRef.current = onDirtyChange;
  const pendingRef = useRef(onPendingChange); pendingRef.current = onPendingChange;
  useLayoutEffect(() => { dirtyRef.current(isDirty); }, [isDirty]);
  useEffect(() => () => { dirtyRef.current(false); pendingRef.current(false); }, []);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setTab("CLA"); setStage("selection");
      setSelectedByTab({ CLA: new Set(), CLB: new Set(), MPN: new Set() });
      setAutosByTab({ CLA: new Map(), CLB: new Map(), MPN: new Map() });
      setExpanded(new Set()); setAcknowledged(false); setPartialError(false);
      setCreatedSteps(new Set()); setCreatedAutos(new Set()); setCreatedQuestions(new Set());
      createdStepIds.current.clear(); createdAutosRef.current.clear(); createdQuestionsRef.current.clear(); planRef.current = []; run.reset();
    }
    wasOpen.current = open;
  }, [open]);
  useEffect(() => {
    if (!open || !isDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [open, isDirty]);
  const requestClose = () => {
    if (run.isPending) return;
    closeRef.current();
  };
  const toggleStep = (step: StepWithQuestions) => {
    setSelectedByTab(current => {
      const next = new Set(current[tab]);
      if (next.has(step.stepId)) {
        const children = descendants(step.stepId);
        if (Array.from(children).some(id => next.has(id))) return current;
        next.delete(step.stepId);
      } else {
        next.add(step.stepId);
        let parent = step.parentStepId;
        const seen = new Set<string>();
        while (parent && !seen.has(parent)) { seen.add(parent); next.add(parent); parent = active.find(row => row.stepId === parent)?.parentStepId; }
      }
      return { ...current, [tab]: next };
    });
  };
  const toggleAuto = (stepId: string, triggerId: string) => setAutosByTab(current => {
    const tabMap = new Map(current[tab]); const next = new Set(tabMap.get(stepId) ?? []);
    next.has(triggerId) ? next.delete(triggerId) : next.add(triggerId);
    tabMap.set(stepId, next);
    return { ...current, [tab]: tabMap };
  });
  const run = useMutation({
    mutationFn: async () => {
      const stepsCreatedThisAttempt: string[] = [];
      for (const row of planRef.current) {
        const { step } = row;
        let itemId = createdStepIds.current.get(step.stepId);
        if (!itemId) {
          const callbackTiming = (step as StepWithTiming).callbackTimingL10n?.[locale] ?? (step as StepWithTiming).callbackTimingL10n?.sk ?? step.callbackTiming;
          const description = [getStepDescription(step, locale), step.conditionIf && step.conditionIf !== "—" ? `IF: ${step.conditionIf}` : "", step.actionThen && step.actionThen !== "—" ? `THEN: ${step.actionThen}` : "", callbackTiming && callbackTiming !== "—" ? `${t("timingReference")}: ${callbackTiming}` : ""].filter(Boolean).join("\n");
          const parentId = row.parentStepId ? createdStepIds.current.get(row.parentStepId) ?? null : null;
          const response = await apiRequest("POST", `/api/campaigns/${campaignId}/status-list`, {
            stepId: step.stepId, label: getStepLabel(step, locale), description,
            confirmationType: step.confirmationType, required: false, sortOrder: row.sortOrder,
            nextStepId: step.nextStepId && step.nextStepId !== "—" ? step.nextStepId : null,
            restrictions: step.restrictions || null, isHidden: step.isHidden ?? false, parentId,
          });
          const created = await response.json();
          if (!created?.id) throw new Error(`Step ${step.stepId} was not confirmed`);
          itemId = String(created.id);
          createdStepIds.current.set(step.stepId, itemId);
          stepsCreatedThisAttempt.push(step.stepId);
          setCreatedSteps(new Set(createdStepIds.current.keys()));
        }
        for (const auto of row.automations) {
          const successKey = `${step.stepId}:${auto.triggerId}`;
          if (createdAutosRef.current.has(successKey)) continue;
          await apiRequest("POST", `/api/campaigns/${campaignId}/status-list/${itemId}/automations`, {
            actionType: auto.actionType, targetRole: auto.targetRole, taskDescription: getAutoTaskDescription(auto, locale),
            taskDeadlineOffset: auto.taskDeadlineOffset, taskPriority: auto.taskPriority, sortOrder: 0,
          });
          createdAutosRef.current.add(successKey);
          setCreatedAutos(current => new Set(current).add(successKey));
        }
        for (const question of row.questions) {
          const successKey = `${step.stepId}:${question.id}`;
          if (createdQuestionsRef.current.has(successKey)) continue;
          const localized = (values: Record<string, string> | undefined, fallback: string) => values?.[locale] ?? values?.sk ?? fallback;
          await apiRequest("POST", `/api/campaigns/${campaignId}/status-list/${itemId}/questions`, {
            questionText: localized(question.questionTextL10n, question.questionText),
            description: localized(question.descriptionL10n, question.description ?? ""),
            fieldType: "text", required: false, logicOperator: "OR", sortOrder: row.questions.indexOf(question), isHidden: false,
          });
          createdQuestionsRef.current.add(successKey);
          setCreatedQuestions(current => new Set(current).add(successKey));
        }
      }
      return stepsCreatedThisAttempt;
    },
    onSuccess: () => { setPartialError(false); setStage("result"); },
    onError: () => { setPartialError(true); setStage("result"); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }); },
  });
  useEffect(() => { pendingRef.current(run.isPending); }, [run.isPending]);
  const review = () => {
    const chosen = ordered.filter(step => selected.has(step.stepId));
    planRef.current = chosen.map((step, position) => ({
      step, sortOrder: existingSteps.length + position, parentStepId: step.parentStepId ?? null,
      automations: step.automations.filter(auto => selectedAutos.get(step.stepId)?.has(auto.triggerId)),
      questions: step.questions ?? [],
    }));
    setAcknowledged(false); setPartialError(false); run.reset(); setStage("review");
  };
  const switchTab = (next: TemplateId) => { if (stage !== "selection" || run.isPending) return; setTab(next); setAcknowledged(false); };
  const toggleAll = () => {
    if (allSelected) {
      setSelectedByTab(current => ({ ...current, [tab]: new Set() }));
      setAutosByTab(current => ({ ...current, [tab]: new Map() }));
      return;
    }
    setSelectedByTab(current => ({ ...current, [tab]: new Set(active.map(step => step.stepId)) }));
  };
  const allSelected = active.length > 0 && active.every(step => selected.has(step.stepId));
  return <Dialog open={open} onOpenChange={next => { if (!next) requestClose(); }}>
    <DialogContent data-testid="status-list-template-dialog" className="status-template-dialog flex max-h-[90dvh] w-[min(1120px,calc(100vw-24px))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl" onEscapeKeyDown={event => { if (run.isPending) event.preventDefault(); else if (isDirty) { event.preventDefault(); requestClose(); } }}>
      <DialogHeader className="status-template-head shrink-0 px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
        <div className="status-template-head-main"><div className="flex min-w-0 items-start gap-3"><span className="status-template-mark"><ClipboardList className="h-5 w-5"/></span><div className="min-w-0"><p className="status-template-kicker">INDEXUS / STATUS LIST</p><DialogTitle>{t("title")}</DialogTitle><p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p></div></div><StatusListHelp locale={locale}/></div>
      </DialogHeader>
      <div className="status-template-progress flex shrink-0 items-center px-5 sm:px-7" aria-label={t(stage)}>
        {(["selection", "review", "result"] as const).map((step, i) => <div key={step} className={`status-template-stage ${stage === step ? "is-current" : ""} ${(["selection", "review", "result"].indexOf(stage) > i ? "is-done" : "")}`}><span>{stage === "result" && i < 2 ? <Check className="h-3.5 w-3.5"/> : i + 1}</span>{t(step)}</div>)}
      </div>
      <div className="status-template-body min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-7">
        {stage === "selection" && <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="status-template-tabs" role="tablist" aria-label={t("title")}>{(["CLA", "CLB", "MPN"] as const).map(id => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} data-testid={`template-tab-${id}`} onClick={() => switchTab(id)}>{id}</button>)}</div>
            <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={toggleAll} data-testid="btn-tpl-select-all">{allSelected ? t("none") : t("all")}</Button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">{selectedStepsCount} {t("step")} · {actionCount} {t("action")} · {questionsCount} {t("questions")}</p>
          <div className="space-y-2">
            {ordered.map(step => {
              const isSelected = selected.has(step.stepId); const child = !!step.parentStepId;
              const blocked = isSelected && Array.from(descendants(step.stepId)).some(id => selected.has(id));
              const autos = selectedAutos.get(step.stepId) ?? new Set<string>();
              const badge = ROLE_BADGE_MAP[step.role] ?? { label: step.role, color: "bg-muted text-muted-foreground" };
              const callbackTiming = (step as StepWithTiming).callbackTimingL10n?.[locale] ?? (step as StepWithTiming).callbackTimingL10n?.sk ?? step.callbackTiming;
              const stepDescription = getStepDescription(step, locale);
              return <article key={step.stepId} className={`status-template-row ${isSelected ? "selected" : ""} ${child ? "child" : ""}`} style={{ "--depth": Math.min(6, (() => { let n = 0, p = step.parentStepId; while (p && n < 6) { n++; p = active.find(x => x.stepId === p)?.parentStepId; } return n; })()) } as CSSProperties}>
                <div className="status-template-row-main">
                  <Checkbox id={`template-step-${step.stepId}`} data-testid={`template-step-${step.stepId}`} checked={isSelected} disabled={blocked || stage !== "selection"} onCheckedChange={() => toggleStep(step)} aria-label={getStepLabel(step, locale)}/>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="status-template-code">{step.stepId}</span><span className={`status-template-role ${badge.color}`}>{badge.label}</span>{step.isHidden && <span className="status-template-tag">{t("hidden")}</span>}<strong>{getStepLabel(step, locale)}</strong></div>
                    {stepDescription && (stepDescription.length > 140
                      ? <details className="status-template-description"><summary>{t("descriptionLabel")}</summary><p>{stepDescription}</p></details>
                      : <p className="status-template-description-brief">{stepDescription}</p>)}
                    {existingCodes.has(step.stepId) && <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300"><AlertTriangle className="mr-1 inline h-3.5 w-3.5"/>{t("duplicate")}</p>}
                    {blocked && <p className="mt-1 text-xs text-muted-foreground">{t("descendant")}</p>}
                    {child && <p className="mt-1 text-[11px] text-primary">{t("parent")}: {step.parentStepId}</p>}
                    {(step.conditionIf && step.conditionIf !== "—" || step.actionThen && step.actionThen !== "—" || callbackTiming && callbackTiming !== "—" || step.restrictions) && <div className="status-template-instructions mt-2"><strong>{t("instructions")}</strong>{step.conditionIf && step.conditionIf !== "—" && <p><b>{t("condition")}:</b> {step.conditionIf}</p>}{step.actionThen && step.actionThen !== "—" && <p><b>{t("actionNote")}:</b> {step.actionThen}</p>}{callbackTiming && callbackTiming !== "—" && <p><b>{t("timing")}:</b> {callbackTiming}</p>}{step.restrictions && <p><b>{t("restrictions")}:</b> {step.restrictions}</p>}</div>}
                    {(step.questions?.length ?? 0) > 0 && <p className="mt-2 text-[11px] text-muted-foreground"><ClipboardList className="mr-1 inline h-3 w-3"/>{step.questions!.length} {t("questions")} {t("included")}</p>}
                  </div>
                  {step.automations.length > 0 && <button type="button" className="status-template-expand" onClick={() => setExpanded(current => { const next = new Set(current); next.has(step.stepId) ? next.delete(step.stepId) : next.add(step.stepId); return next; })} aria-expanded={expanded.has(step.stepId)}><Zap className="h-3.5 w-3.5"/><span>{autos.size}/{step.automations.length}</span>{expanded.has(step.stepId) ? <ChevronUp className="h-3.5 w-3.5"/> : <ChevronDown className="h-3.5 w-3.5"/>}</button>}
                </div>
                {expanded.has(step.stepId) && <div className="status-template-actions">{step.automations.map(auto => {
                  const chosen = autos.has(auto.triggerId);
                  return <label key={auto.triggerId} className={`status-template-action ${chosen ? "chosen" : ""}`}><Checkbox data-testid={`template-auto-${step.stepId}-${auto.triggerId}`} checked={chosen} disabled={!isSelected || stage !== "selection"} onCheckedChange={() => toggleAuto(step.stepId, auto.triggerId)} aria-label={getAutoLabel(auto, locale)}/><span className="min-w-0 flex-1"><b>{getAutoLabel(auto, locale)}</b><small>{getAutoTaskDescription(auto, locale) || auto.description}</small>{auto.taskDeadlineOffset && <small className="status-template-deadline">{t("timingReference")}: {auto.taskDeadlineOffset}</small>}</span></label>;
                })}</div>}
              </article>;
            })}
          </div>
        </>}
        {stage === "review" && <section data-testid="template-review-plan" className="space-y-4">
          <div className="status-template-impact"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0"/><p>{t("impact")}</p></div>
          <div className="flex items-center justify-between gap-3"><div><p className="status-template-kicker">{tab} / {t("reviewTitle")}</p><h3 className="text-lg font-semibold">{planRef.current.length} {t("step")}</h3></div><span className="text-right text-xs text-muted-foreground">{planRef.current.reduce((n, row) => n + row.automations.length, 0)} {t("action")} · {planRef.current.reduce((n, row) => n + row.questions.length, 0)} {t("questions")}</span></div>
          <p className="text-xs text-muted-foreground">{t("duplicate")}</p>
           <div className="space-y-2">{planRef.current.map((row, position) => {
             const description = getStepDescription(row.step, locale);
             return <article key={row.step.stepId} className="status-template-review-row"><span className="status-template-order">{String(position + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{getStepLabel(row.step, locale)}</strong><code>{row.step.stepId}</code>{existingCodes.has(row.step.stepId) && <span className="status-template-duplicate">{t("duplicate")}</span>}</div>{description && (description.length > 140 ? <details className="status-template-description"><summary>{t("descriptionLabel")}</summary><p>{description}</p></details> : <p className="status-template-description-brief">{description}</p>)}{row.parentStepId && <small>{t("parentLabel")}: {row.parentStepId}</small>}<div className="mt-2 flex flex-wrap gap-1.5">{row.automations.map(auto => <span className="status-template-summary-tag" key={auto.triggerId}><Zap className="h-3 w-3"/>{getAutoLabel(auto, locale)}</span>)}{row.questions.map(q => <span className="status-template-summary-tag question" key={q.id}><ClipboardList className="h-3 w-3"/>{q.questionTextL10n?.[locale] ?? q.questionTextL10n?.sk ?? q.questionText}</span>)}</div></div></article>;
           })}</div>
          <label className="status-template-ack"><Checkbox data-testid="template-acknowledge" checked={acknowledged} onCheckedChange={value => setAcknowledged(value === true)}/><span>{t("acknowledge")}</span></label>
        </section>}
        {stage === "result" && <section data-testid="template-result" role="status" className="space-y-4">
          <div className={`status-template-result ${partialError ? "has-error" : ""}`}>{partialError ? <AlertTriangle className="h-6 w-6"/> : <CircleCheck className="h-6 w-6"/>}<div><h3>{partialError ? t("error") : t("result")}</h3><p>{t("done")}: {createdSteps.size} {t("step")} · {createdAutos.size} {t("action")} · {createdQuestions.size} {t("questions")}</p></div></div>
          {partialError && <div className="status-template-error"><strong>{t("error")}</strong><p>{t("done")}: {createdSteps.size} / {planRef.current.length} {t("step")}; {createdAutos.size} / {planRef.current.reduce((n, row) => n + row.automations.length, 0)} {t("action")}; {createdQuestions.size} / {planRef.current.reduce((n, row) => n + row.questions.length, 0)} {t("questions")}.</p></div>}
          <div className="space-y-2">{planRef.current.map(row => {
            const complete = createdSteps.has(row.step.stepId) && row.automations.every(auto => createdAutos.has(`${row.step.stepId}:${auto.triggerId}`)) && row.questions.every(question => createdQuestions.has(`${row.step.stepId}:${question.id}`));
            return <div key={row.step.stepId} className="status-template-result-row" data-testid={`template-result-${row.step.stepId}`} data-complete={complete}><span>{complete ? <Check className="h-4 w-4 text-emerald-600"/> : <AlertTriangle className="h-4 w-4 text-amber-600"/>}</span><strong>{row.step.stepId}</strong><span>{getStepLabel(row.step, locale)}</span></div>;
          })}</div>
        </section>}
      </div>
      <DialogFooter className="status-template-footer flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <span className="text-xs text-muted-foreground">{stage === "selection" ? `${selectedStepsCount} ${t("step")} · ${actionCount} ${t("action")} · ${questionsCount} ${t("questions")}` : stage === "result" ? `${createdSteps.size} ${t("step")} · ${createdAutos.size} ${t("action")} · ${createdQuestions.size} ${t("questions")}` : t("impact")}</span>
        <div className="flex flex-wrap justify-end gap-2">
          {stage !== "result" && <Button variant="ghost" onClick={requestClose} disabled={run.isPending}>{t("cancel")}</Button>}
          {stage === "selection" && <Button onClick={review} disabled={!selected.size} data-testid="template-review">{t("next")}<ArrowRight className="ml-2 h-4 w-4"/></Button>}
          {stage === "review" && <><Button variant="outline" onClick={() => { setStage("selection"); run.reset(); }} disabled={run.isPending} data-testid="template-back"><ArrowLeft className="mr-2 h-4 w-4"/>{t("back")}</Button><Button onClick={() => run.mutate()} disabled={!acknowledged || run.isPending} data-testid="btn-apply-cla-template">{run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Plus className="mr-2 h-4 w-4"/>}{t("apply")}</Button></>}
          {stage === "result" && <>{partialError && <Button variant="outline" data-testid="template-retry" onClick={() => { run.reset(); run.mutate(); }} disabled={run.isPending}>{run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}{t("retry")}</Button>}<Button onClick={requestClose} disabled={run.isPending} data-testid="template-close">{t("close")}</Button></>}
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
