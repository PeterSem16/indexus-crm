import type { Locale } from "@/i18n";

export type RepresentativeCheckCopy = {
  title: string;
  enabled: string;
  enabledHelp: string;
  triggerLabel: string;
  trigger: {
    pulse_open: string;
    card_open: string;
    background_change: string;
  };
  behaviorLabel: string;
  behavior: {
    information: string;
    confirm: string;
    automatic: string;
  };
  scope: string;
  previewTitle: string;
  assignedPreview: string;
  unassignedPreview: string;
  actionsTitle: string;
  actionSteps: string[];
  reopening: string;
  hiddenIndependent: string;
  enabledSummary: string;
  disabledSummary: string;
  at: string;
  as: string;
  actionStatus: {
    pending: string;
    done: string;
    blocked: string;
    failed: string;
    none: string;
  };
  reviewActions: string;
  batchPending: string;
  newQuestion: string;
  createOnSave: string;
  selectQuestion: string;
};

export const representativeCheckCopy: Record<Locale, RepresentativeCheckCopy> = {
  en: {
    title: "Automatic coordinator check",
    enabled: "Show and run the coordinator check",
    enabledHelp: "Off stops both the check and its message. Hiding the source question is a separate setting.",
    triggerLabel: "When to check",
    trigger: { pulse_open: "When Nexus Pulse opens (recommended)", card_open: "When a record opens", background_change: "When the assignment changes" },
    behaviorLabel: "If no coordinator is assigned",
    behavior: { information: "Show information only", confirm: "Offer actions for confirmation (recommended)", automatic: "Run actions automatically" },
    scope: "This checks the clinic or hospital’s Assigned representative field. It is not the agent assigned in Mission.",
    previewTitle: "What people will see",
    assignedPreview: "Assigned representative: Morgan Lee",
    unassignedPreview: "This record has no assigned coordinator.",
    actionsTitle: "Set up actions in the question studio",
    actionSteps: [
      "Open this question in the question studio and choose 05 Actions.",
      "Add the actions to offer or run when the answer indicates no assigned representative.",
      "Return here to choose whether those actions are offered for confirmation or run automatically.",
    ],
    reopening: "Reopening a record does not repeat actions that have already been completed.",
    hiddenIndependent: "The source question can stay hidden without hiding this check or its information message.",
    enabledSummary: "Check enabled",
    disabledSummary: "Check disabled",
    at: "Check",
    as: "When unassigned",
    actionStatus: { pending: "Actions are queued for processing.", done: "Actions completed.", blocked: "Actions are unavailable for this record.", failed: "Actions could not be completed.", none: "No actions are ready for this record." },
    batchPending: "Actions will run only after saving in Batch mode.",
    newQuestion: "New hidden source question",
    createOnSave: "Saving will create the required hidden source question in this step and save the configuration together. Existing answers and actions are not changed.",
    selectQuestion: "Choose a compatible question in Source before saving.",
    reviewActions: "Review actions",
  },
  sk: {
    title: "Automatická kontrola koordinátora",
    enabled: "Zobrazovať a spúšťať kontrolu koordinátora",
    enabledHelp: "Vypnutím sa zastaví kontrola aj jej správa. Skrytie zdrojovej otázky je samostatné nastavenie.",
    triggerLabel: "Kedy kontrolovať",
    trigger: { pulse_open: "Pri otvorení Nexus Pulse (odporúčané)", card_open: "Pri otvorení záznamu", background_change: "Pri zmene priradenia" },
    behaviorLabel: "Ak nie je priradený koordinátor",
    behavior: { information: "Zobraziť iba informáciu", confirm: "Ponúknuť akcie na potvrdenie (odporúčané)", automatic: "Spustiť akcie automaticky" },
    scope: "Kontroluje pole Assigned representative kliniky alebo nemocnice. Nejde o agenta priradeného v Mission.",
    previewTitle: "Čo uvidia používatelia",
    assignedPreview: "Priradený koordinátor: Morgan Lee",
    unassignedPreview: "Tento záznam nemá priradeného koordinátora.",
    actionsTitle: "Akcie nastavte v štúdiu otázky",
    actionSteps: ["Otvorte túto otázku v štúdiu otázky a vyberte 05 Actions.", "Pridajte akcie, ktoré sa majú ponúknuť alebo spustiť, keď odpoveď znamená, že záznam nemá priradeného koordinátora.", "Vráťte sa sem a vyberte, či sa akcie ponúknu na potvrdenie alebo spustia automaticky."],
    reopening: "Opätovné otvorenie záznamu nezopakuje už dokončené akcie.",
    hiddenIndependent: "Zdrojová otázka môže zostať skrytá bez skrytia kontroly alebo informačnej správy.",
    enabledSummary: "Kontrola zapnutá", disabledSummary: "Kontrola vypnutá", at: "Kontrola", as: "Ak nie je priradený",
    actionStatus: { pending: "Akcie sú zaradené na spracovanie.", done: "Akcie boli dokončené.", blocked: "Akcie nie sú pre tento záznam dostupné.", failed: "Akcie sa nepodarilo dokončiť.", none: "Pre tento záznam nie sú pripravené žiadne akcie." },
    batchPending: "Akcie sa vykonajú až po uložení v režime Batch.",
    newQuestion: "Nová skrytá zdrojová otázka",
    createOnSave: "Pri uložení sa v tomto kroku vytvorí potrebná skrytá zdrojová otázka a súčasne sa uloží konfigurácia. Existujúce odpovede ani akcie sa nemenia.",
    selectQuestion: "Pred uložením vyberte kompatibilnú otázku v časti Zdroj.",
    reviewActions: "Skontrolovať akcie",
  },
  cs: {
    title: "Automatická kontrola koordinátora",
    enabled: "Zobrazovat a spouštět kontrolu koordinátora",
    enabledHelp: "Vypnutím se zastaví kontrola i její zpráva. Skrytí zdrojové otázky je samostatné nastavení.",
    triggerLabel: "Kdy kontrolovat",
    trigger: { pulse_open: "Při otevření Nexus Pulse (doporučeno)", card_open: "Při otevření záznamu", background_change: "Při změně přiřazení" },
    behaviorLabel: "Pokud není přiřazen koordinátor",
    behavior: { information: "Zobrazit pouze informaci", confirm: "Nabídnout akce k potvrzení (doporučeno)", automatic: "Spustit akce automaticky" },
    scope: "Kontroluje pole Assigned representative kliniky nebo nemocnice. Nejde o agenta přiřazeného v Mission.",
    previewTitle: "Co uživatelé uvidí",
    assignedPreview: "Přiřazený koordinátor: Morgan Lee",
    unassignedPreview: "Tento záznam nemá přiřazeného koordinátora.",
    actionsTitle: "Akce nastavte ve studiu otázek",
    actionSteps: ["Otevřete tuto otázku ve studiu otázek a zvolte 05 Actions.", "Přidejte akce, které se mají nabídnout nebo spustit, když odpověď znamená, že záznam nemá přiřazeného koordinátora.", "Vraťte se sem a zvolte, zda se akce nabídnou k potvrzení, nebo se spustí automaticky."],
    reopening: "Opětovné otevření záznamu neopakuje již dokončené akce.",
    hiddenIndependent: "Zdrojová otázka může zůstat skrytá, aniž by se skryla tato kontrola nebo informační zpráva.",
    enabledSummary: "Kontrola zapnuta", disabledSummary: "Kontrola vypnuta", at: "Kontrola", as: "Pokud není přiřazen",
    actionStatus: { pending: "Akce jsou zařazeny ke zpracování.", done: "Akce byly dokončeny.", blocked: "Akce nejsou pro tento záznam dostupné.", failed: "Akce se nepodařilo dokončit.", none: "Pro tento záznam nejsou připraveny žádné akce." },
    batchPending: "Akce se provedou až po uložení v režimu Batch.",
    newQuestion: "Nová skrytá zdrojová otázka",
    createOnSave: "Při uložení se v tomto kroku vytvoří potřebná skrytá zdrojová otázka a současně se uloží konfigurace. Existující odpovědi ani akce se nemění.",
    selectQuestion: "Před uložením vyberte kompatibilní otázku v části Zdroj.",
    reviewActions: "Zkontrolovat akce",
  },
  hu: {
    title: "Automatikus koordinátor-ellenőrzés",
    enabled: "Koordinátor-ellenőrzés és üzenet megjelenítése",
    enabledHelp: "Kikapcsolva az ellenőrzés és az üzenet is leáll. A forráskérdés elrejtése ettől független beállítás.",
    triggerLabel: "Mikor ellenőrizzen",
    trigger: { pulse_open: "A Nexus Pulse megnyitásakor (ajánlott)", card_open: "A rekord megnyitásakor", background_change: "A hozzárendelés változásakor" },
    behaviorLabel: "Ha nincs koordinátor hozzárendelve",
    behavior: { information: "Csak tájékoztató üzenet", confirm: "Műveletek felajánlása megerősítésre (ajánlott)", automatic: "Műveletek automatikus futtatása" },
    scope: "A klinika vagy kórház Assigned representative mezőjét ellenőrzi. Nem a Mission ügynökét.",
    previewTitle: "Ezt látják a felhasználók",
    assignedPreview: "Hozzárendelt koordinátor: Morgan Lee",
    unassignedPreview: "Ehhez a rekordhoz nincs koordinátor rendelve.",
    actionsTitle: "A műveleteket a kérdésszerkesztőben állítsa be",
    actionSteps: ["Nyissa meg ezt a kérdést a kérdésszerkesztőben, majd válassza a 05 Actions lehetőséget.", "Adja hozzá azokat a műveleteket, amelyeket fel kell ajánlani vagy futtatni kell, ha a válasz szerint nincs hozzárendelt koordinátor.", "Térjen vissza ide, és válassza ki, hogy a műveletek megerősítésre jelenjenek meg vagy automatikusan fussanak."],
    reopening: "A rekord újbóli megnyitása nem ismétli meg a már befejezett műveleteket.",
    hiddenIndependent: "A forráskérdés elrejthető anélkül, hogy ez az ellenőrzés vagy az üzenet eltűnne.",
    enabledSummary: "Ellenőrzés bekapcsolva", disabledSummary: "Ellenőrzés kikapcsolva", at: "Ellenőrzés", as: "Ha nincs hozzárendelve",
    actionStatus: { pending: "A műveletek feldolgozásra várnak.", done: "A műveletek befejeződtek.", blocked: "A műveletek ennél a rekordnál nem érhetők el.", failed: "A műveleteket nem sikerült befejezni.", none: "Ehhez a rekordhoz nincs végrehajtásra kész művelet." },
    batchPending: "Batch módban a műveletek csak mentés után indulnak el.",
    newQuestion: "Új rejtett forráskérdés",
    createOnSave: "Mentéskor ebben a lépésben létrejön a szükséges rejtett forráskérdés, és a konfiguráció is mentésre kerül. A meglévő válaszok és műveletek nem változnak.",
    selectQuestion: "Mentés előtt válasszon kompatibilis kérdést a Forrás résznél.",
    reviewActions: "Műveletek áttekintése",
  },
  ro: {
    title: "Verificarea automată a coordonatorului",
    enabled: "Afișează și execută verificarea coordonatorului",
    enabledHelp: "Dezactivarea oprește verificarea și mesajul. Ascunderea întrebării sursă este o setare separată.",
    triggerLabel: "Când se verifică",
    trigger: { pulse_open: "La deschiderea Nexus Pulse (recomandat)", card_open: "La deschiderea fișei", background_change: "La schimbarea atribuirii" },
    behaviorLabel: "Dacă nu este atribuit niciun coordonator",
    behavior: { information: "Afișează doar informații", confirm: "Oferă acțiuni pentru confirmare (recomandat)", automatic: "Execută acțiunile automat" },
    scope: "Verifică câmpul Assigned representative al clinicii sau spitalului, nu agentul atribuit în Mission.",
    previewTitle: "Ce vor vedea utilizatorii",
    assignedPreview: "Coordonator atribuit: Morgan Lee",
    unassignedPreview: "Această fișă nu are un coordonator atribuit.",
    actionsTitle: "Configurați acțiunile în editorul întrebării",
    actionSteps: ["Deschideți această întrebare în editor și selectați 05 Actions.", "Adăugați acțiunile de oferit sau executat când răspunsul indică lipsa unui coordonator atribuit.", "Reveniți aici pentru a alege dacă acțiunile se oferă pentru confirmare sau se execută automat."],
    reopening: "Redeschiderea unei fișe nu repetă acțiunile deja finalizate.",
    hiddenIndependent: "Întrebarea sursă poate rămâne ascunsă fără a ascunde verificarea sau mesajul informativ.",
    enabledSummary: "Verificare activată", disabledSummary: "Verificare dezactivată", at: "Verificare", as: "Dacă nu este atribuit",
    actionStatus: { pending: "Acțiunile sunt în așteptarea procesării.", done: "Acțiunile au fost finalizate.", blocked: "Acțiunile nu sunt disponibile pentru această fișă.", failed: "Acțiunile nu au putut fi finalizate.", none: "Nu există acțiuni pregătite pentru această fișă." },
    batchPending: "În modul Batch, acțiunile se execută numai după salvare.",
    newQuestion: "Întrebare sursă ascunsă nouă",
    createOnSave: "La salvare se creează întrebarea sursă ascunsă necesară în acest pas și se salvează configurația împreună. Răspunsurile și acțiunile existente nu se modifică.",
    selectQuestion: "Înainte de salvare, alegeți o întrebare compatibilă în secțiunea Sursă.",
    reviewActions: "Revizuiește acțiunile",
  },
  it: {
    title: "Verifica automatica del coordinatore",
    enabled: "Mostra ed esegui la verifica del coordinatore",
    enabledHelp: "Disattivando si interrompono sia la verifica sia il messaggio. Nascondere la domanda sorgente è un'impostazione separata.",
    triggerLabel: "Quando verificare",
    trigger: { pulse_open: "All'apertura di Nexus Pulse (consigliato)", card_open: "All'apertura della scheda", background_change: "Quando cambia l'assegnazione" },
    behaviorLabel: "Se non è assegnato alcun coordinatore",
    behavior: { information: "Mostra solo informazioni", confirm: "Offri azioni da confermare (consigliato)", automatic: "Esegui automaticamente le azioni" },
    scope: "Verifica il campo Assigned representative della clinica o dell'ospedale, non l'agente assegnato in Mission.",
    previewTitle: "Cosa vedranno gli utenti",
    assignedPreview: "Coordinatore assegnato: Morgan Lee",
    unassignedPreview: "Questa scheda non ha un coordinatore assegnato.",
    actionsTitle: "Configura le azioni nello studio della domanda",
    actionSteps: ["Apri questa domanda nello studio e seleziona 05 Actions.", "Aggiungi le azioni da proporre o eseguire quando la risposta indica che non è assegnato un coordinatore.", "Torna qui per scegliere se proporre le azioni per conferma o eseguirle automaticamente."],
    reopening: "Riaprire una scheda non ripete le azioni già completate.",
    hiddenIndependent: "La domanda sorgente può restare nascosta senza nascondere la verifica o il messaggio informativo.",
    enabledSummary: "Verifica attiva", disabledSummary: "Verifica disattivata", at: "Verifica", as: "Se non assegnato",
    actionStatus: { pending: "Azioni in coda per l'elaborazione.", done: "Azioni completate.", blocked: "Azioni non disponibili per questa scheda.", failed: "Impossibile completare le azioni.", none: "Nessuna azione pronta per questa scheda." },
    batchPending: "In modalità Batch, le azioni vengono eseguite solo dopo il salvataggio.",
    newQuestion: "Nuova domanda sorgente nascosta",
    createOnSave: "Il salvataggio crea la domanda sorgente nascosta necessaria in questo passaggio e salva insieme la configurazione. Le risposte e le azioni esistenti non cambiano.",
    selectQuestion: "Prima di salvare, scegli una domanda compatibile nella sezione Sorgente.",
    reviewActions: "Rivedi le azioni",
  },
  de: {
    title: "Automatische Koordinatorprüfung",
    enabled: "Koordinatorprüfung und Meldung anzeigen",
    enabledHelp: "Beim Ausschalten werden Prüfung und Meldung beendet. Das Ausblenden der Quellfrage ist eine separate Einstellung.",
    triggerLabel: "Wann prüfen",
    trigger: { pulse_open: "Beim Öffnen von Nexus Pulse (empfohlen)", card_open: "Beim Öffnen eines Datensatzes", background_change: "Bei einer Änderung der Zuweisung" },
    behaviorLabel: "Wenn kein Koordinator zugewiesen ist",
    behavior: { information: "Nur Information anzeigen", confirm: "Aktionen zur Bestätigung anbieten (empfohlen)", automatic: "Aktionen automatisch ausführen" },
    scope: "Prüft das Feld Assigned representative der Klinik oder des Krankenhauses, nicht den Mission-Agenten.",
    previewTitle: "Was Nutzende sehen",
    assignedPreview: "Zugewiesener Koordinator: Morgan Lee",
    unassignedPreview: "Diesem Datensatz ist kein Koordinator zugewiesen.",
    actionsTitle: "Aktionen im Fragenstudio einrichten",
    actionSteps: ["Öffnen Sie diese Frage im Fragenstudio und wählen Sie 05 Actions.", "Fügen Sie die Aktionen hinzu, die angeboten oder ausgeführt werden sollen, wenn die Antwort keinen zugewiesenen Koordinator bedeutet.", "Kehren Sie hierher zurück und wählen Sie, ob Aktionen zur Bestätigung angeboten oder automatisch ausgeführt werden."],
    reopening: "Beim erneuten Öffnen eines Datensatzes werden bereits abgeschlossene Aktionen nicht wiederholt.",
    hiddenIndependent: "Die Quellfrage kann ausgeblendet bleiben, ohne diese Prüfung oder die Informationsmeldung auszublenden.",
    enabledSummary: "Prüfung aktiviert", disabledSummary: "Prüfung deaktiviert", at: "Prüfung", as: "Wenn nicht zugewiesen",
    actionStatus: { pending: "Aktionen stehen zur Verarbeitung an.", done: "Aktionen abgeschlossen.", blocked: "Aktionen sind für diesen Datensatz nicht verfügbar.", failed: "Aktionen konnten nicht abgeschlossen werden.", none: "Für diesen Datensatz stehen keine Aktionen bereit." },
    batchPending: "Im Batch-Modus werden Aktionen erst nach dem Speichern ausgeführt.",
    newQuestion: "Neue ausgeblendete Quellfrage",
    createOnSave: "Beim Speichern wird die benötigte ausgeblendete Quellfrage in diesem Schritt erstellt und die Konfiguration gemeinsam gespeichert. Bestehende Antworten und Aktionen bleiben unverändert.",
    selectQuestion: "Wählen Sie vor dem Speichern eine kompatible Frage im Bereich Quelle.",
    reviewActions: "Aktionen prüfen",
  },
};

export function getRepresentativeCheckCopy(locale: Locale | string): RepresentativeCheckCopy {
  return representativeCheckCopy[locale as Locale] || representativeCheckCopy.en;
}
