import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Eye, Loader2, Play, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStatusListHistoryCopy } from "./status-list-history-copy";
import { StatusListAutomaticInitial } from "./status-list-automatic-initial";
import "./status-list-automatic-trigger-inspector.css";

type Trigger = "agent_confirmation" | "card_open" | "background_change";
type AutomaticItem = {
  item: { id: string; label: string; isHidden: boolean; confirmationType: string };
  config: { trigger: Trigger; enabled: boolean; revision: string | null };
  mode: "immediate" | "batch";
  actions: { id: string; actionType: string; questionLabel: string | null; issues: string[] }[];
  supportedConditionFields: string[];
};
type Contact = { id: string; label: string };
type Preview = {
  readOnly: true; trigger: Trigger; mode: "immediate" | "batch"; enabled: boolean; baseline: boolean;
  actions: { id: string; actionType: string; questionLabel: string | null; condition: boolean | null; status: string }[];
};
type Copy = {
  title: string; subtitle: string; reload: string; loading: string; error: string; saveFailure: string; retry: string;
  trigger: string; enabled: string; off: string; on: string; save: string; saving: string; saved: string;
  acknowledge: string; agent: string; card: string; background: string; modeImmediate: string; modeBatch: string;
  hidden: string; visible: string; noActions: string; actions: string; supported: string; noFields: string;
  behaviorAgent: string; behaviorCard: string; behaviorBackground: string; visibility: string; noReplay: string; batchNote: string;
  contact: string; searchContact: string; chooseContact: string; preview: string; previewTitle: string;
  previewHelp: string; previewLoading: string; previewError: string; selectFirst: string; result: string;
  baseline: string; conditionTrue: string; conditionFalse: string; conditionUnknown: string;
  readOnly: string; statuses: Record<string, string>; yes: string; no: string; acknowledgementRequired: string;
};

const copy: Record<string, Copy> = {
  en: {
    title: "Automatic trigger & test", subtitle: "Explicit trigger configuration for this status step. Legacy service actions remain separate below.", reload: "Reload", loading: "Loading trigger configuration…", error: "Trigger information could not be loaded. Controls are locked until it can be verified.", saveFailure: "The trigger could not be saved. Review the configuration and try again.", retry: "Try again",
    trigger: "Trigger", enabled: "Automatic workflow", off: "Off", on: "On", save: "Save trigger", saving: "Saving…", saved: "Trigger saved.", acknowledge: "I understand enabling this trigger may deliver the listed actions under these rules.", agent: "Agent confirmation", card: "Card open", background: "Background change",
    modeImmediate: "Immediate mode", modeBatch: "Batch mode", hidden: "Hidden step", visible: "Visible step", noActions: "No automatic actions are configured.", actions: "Actions covered by this trigger", supported: "Supported condition fields", noFields: "No condition fields reported.",
    behaviorAgent: "Runs only when an agent confirms this step. A hidden step cannot be confirmed by an agent, so this trigger cannot run for it.", behaviorCard: "Opening the card reads current answers. If IF is true, an action may run once per action and contact; it does not replay.", behaviorBackground: "Enabling this trigger does not process current state. The first evaluation establishes a baseline with no external effects. For general actions without a source, a later false → true IF change can trigger. For system-source actions, a real transition of the configured source question or option plus a true IF is required. Administrators can separately preview and explicitly confirm one-time processing of currently true conditions.",
    visibility: "Visibility only controls whether the step is shown; it does not change its trigger.", noReplay: "Toggling or saving this configuration never replays an action already delivered.", batchNote: "Batch events wait in a durable awaiting-batch queue; no effects occur until the agent performs a real Batch save.", contact: "Contact for preview", searchContact: "Search contacts…", chooseContact: "Choose one contact", preview: "Preview without execution", previewTitle: "Read-only contact preview", previewHelp: "This requests an evaluation only. It does not execute, queue, or deliver any action.", previewLoading: "Evaluating without execution…", previewError: "Preview could not be loaded. Nothing was executed.", selectFirst: "Choose a contact to preview.", result: "Evaluation", baseline: "First evaluation is baseline; no actions run.", conditionTrue: "IF true", conditionFalse: "IF false", conditionUnknown: "IF unknown", readOnly: "Read only", statuses: {
      ready: "Ready", disabled: "Disabled", unsupported_action: "Unsupported action", invalid_condition: "Invalid condition", missing_answer: "Missing answer", condition_false: "Condition is false", waiting_transition: "General action: waiting for IF to change false → true; system-source action: waiting for an actual change to its configured source question or option", already_executed: "Already delivered — will not replay", background_baseline: "Baseline — no action", batch_deferred: "Deferred until save", pending: "Pending", indeterminate: "Indeterminate", succeeded: "Succeeded", failed: "Failed", superseded: "Superseded",
    }, yes: "Yes", no: "No", acknowledgementRequired: "Acknowledge the delivery behavior before enabling.",
  },
  sk: {
    title: "Automatický spúšťač a test", subtitle: "Výslovné nastavenie spúšťača tohto statusového kroku. Staršie servisné akcie zostávajú oddelené nižšie.", reload: "Obnoviť", loading: "Načítavam nastavenie spúšťača…", error: "Informácie o spúšťači sa nepodarilo načítať. Ovládanie je uzamknuté, kým sa nastavenie nedá overiť.", saveFailure: "Spúšťač sa nepodarilo uložiť. Skontrolujte nastavenie a skúste znova.", retry: "Skúsiť znova",
    trigger: "Spúšťač", enabled: "Automatický workflow", off: "Vypnutý", on: "Zapnutý", save: "Uložiť spúšťač", saving: "Ukladám…", saved: "Spúšťač uložený.", acknowledge: "Rozumiem, že zapnutie môže doručiť uvedené akcie podľa týchto pravidiel.", agent: "Potvrdenie agentom", card: "Otvorenie karty", background: "Zmena na pozadí",
    modeImmediate: "Okamžitý režim", modeBatch: "Dávkový režim", hidden: "Skrytý krok", visible: "Viditeľný krok", noActions: "Nie sú nastavené automatické akcie.", actions: "Akcie zahrnuté v tomto spúšťači", supported: "Podporované polia podmienok", noFields: "Nie sú uvedené žiadne polia podmienok.",
    behaviorAgent: "Spustí sa iba po potvrdení kroku agentom. Skrytý krok agent nemôže potvrdiť, preto sa tento spúšťač nedá použiť.", behaviorCard: "Otvorenie karty načíta aktuálne odpovede. Ak je IF pravdivé, akcia sa môže vykonať raz na akciu a kontakt; neopakuje sa.", behaviorBackground: "Zapnutie tohto spúšťača nespracuje aktuálny stav. Prvé vyhodnotenie vytvorí základný stav bez externých účinkov. Pri všeobecných akciách bez zdroja môže neskoršia zmena IF false → true spustiť akciu. Pri akciách systémového zdroja je potrebná skutočná zmena nakonfigurovanej zdrojovej otázky alebo možnosti a zároveň pravdivé IF. Správca môže samostatne zobraziť náhľad a výslovne potvrdiť jednorazové spracovanie aktuálne pravdivých podmienok.",
    visibility: "Viditeľnosť určuje iba zobrazenie kroku, nie jeho spúšťač.", noReplay: "Prepnutie ani opätovné uloženie nikdy nezopakuje už doručenú akciu.", batchNote: "Dávkové udalosti čakajú v trvalom fronte. Bez účinkov zostanú až do skutočného uloženia dávky agentom.", contact: "Kontakt na náhľad", searchContact: "Hľadať kontakty…", chooseContact: "Vyberte jeden kontakt", preview: "Overiť bez vykonania", previewTitle: "Náhľad kontaktu iba na čítanie", previewHelp: "Vyžiada sa iba vyhodnotenie. Akcia sa nevykoná, nezaradí do frontu ani nedoručí.", previewLoading: "Vyhodnocujem bez vykonania…", previewError: "Náhľad sa nepodarilo načítať. Nič sa nevykonalo.", selectFirst: "Najprv vyberte kontakt.", result: "Vyhodnotenie", baseline: "Prvé vyhodnotenie je základný stav; akcie sa nespúšťajú.", conditionTrue: "IF platí", conditionFalse: "IF neplatí", conditionUnknown: "IF neznáme", readOnly: "Iba na čítanie", statuses: {
      ready: "Pripravené", disabled: "Vypnuté", unsupported_action: "Nepodporovaná akcia", invalid_condition: "Neplatná podmienka", missing_answer: "Chýba odpoveď", condition_false: "Podmienka neplatí", waiting_transition: "Všeobecná akcia: čaká sa na zmenu IF false → true; akcia systémového zdroja: čaká sa na skutočnú zmenu nakonfigurovanej zdrojovej otázky alebo možnosti", already_executed: "Už doručené — neopakuje sa", background_baseline: "Základný stav — bez akcie", batch_deferred: "Odložené do uloženia", pending: "Čaká", indeterminate: "Nejednoznačné", succeeded: "Úspešné", failed: "Zlyhalo", superseded: "Nahradené",
    }, yes: "Áno", no: "Nie", acknowledgementRequired: "Pred zapnutím potvrďte, že rozumiete spôsobu doručovania.",
  },
  cs: {
    title: "Automatický spouštěč a test", subtitle: "Výslovné nastavení spouštěče tohoto stavového kroku. Starší servisní akce zůstávají níže oddělené.", reload: "Obnovit", loading: "Načítám nastavení spouštěče…", error: "Informace o spouštěči nelze načíst. Ovládání je uzamčeno, dokud nastavení nepůjde ověřit.", saveFailure: "Spouštěč se nepodařilo uložit. Zkontrolujte nastavení a zkuste to znovu.", retry: "Zkusit znovu",
    trigger: "Spouštěč", enabled: "Automatický workflow", off: "Vypnuto", on: "Zapnuto", save: "Uložit spouštěč", saving: "Ukládám…", saved: "Spouštěč uložen.", acknowledge: "Rozumím, že zapnutí může doručit uvedené akce podle těchto pravidel.", agent: "Potvrzení agentem", card: "Otevření karty", background: "Změna na pozadí",
    modeImmediate: "Okamžitý režim", modeBatch: "Dávkový režim", hidden: "Skrytý krok", visible: "Viditelný krok", noActions: "Nejsou nastavené automatické akce.", actions: "Akce zahrnuté tímto spouštěčem", supported: "Podporovaná pole podmínek", noFields: "Nejsou uvedena žádná pole podmínek.",
    behaviorAgent: "Spustí se pouze při potvrzení kroku agentem. Skrytý krok agent potvrdit nemůže, takže tento spouštěč nelze použít.", behaviorCard: "Otevření karty načte aktuální odpovědi. Pokud je IF pravdivé, akce se může provést jednou pro akci a kontakt; neopakuje se.", behaviorBackground: "Zapnutí spouštěče nezpracuje aktuální stav. První vyhodnocení vytvoří základní stav bez externích účinků. U obecných akcí bez zdroje může spustit pozdější změna IF false → true. U akcí systémového zdroje je nutná skutečná změna nakonfigurované zdrojové otázky nebo možnosti a zároveň pravdivé IF. Správce může samostatně zobrazit náhled a výslovně potvrdit jednorázové zpracování aktuálně pravdivých podmínek.",
    visibility: "Viditelnost určuje pouze zobrazení kroku, nikoli jeho spouštěč.", noReplay: "Přepnutí ani opětovné uložení nikdy nezopakuje již doručenou akci.", batchNote: "Dávkové události čekají v trvalé frontě; bez účinků zůstávají až do skutečného uložení dávky agentem.", contact: "Kontakt pro náhled", searchContact: "Hledat kontakty…", chooseContact: "Vyberte jeden kontakt", preview: "Ověřit bez spuštění", previewTitle: "Náhled kontaktu pouze pro čtení", previewHelp: "Vyžádá se pouze vyhodnocení. Akce se neprovede, nezařadí do fronty ani nedoručí.", previewLoading: "Vyhodnocuji bez provedení…", previewError: "Náhled nelze načíst. Nic nebylo provedeno.", selectFirst: "Nejprve vyberte kontakt.", result: "Vyhodnocení", baseline: "První vyhodnocení je základní stav; akce se nespouštějí.", conditionTrue: "IF platí", conditionFalse: "IF neplatí", conditionUnknown: "IF neznámé", readOnly: "Pouze pro čtení", statuses: {
      ready: "Připraveno", disabled: "Vypnuto", unsupported_action: "Nepodporovaná akce", invalid_condition: "Neplatná podmínka", missing_answer: "Chybí odpověď", condition_false: "Podmínka neplatí", waiting_transition: "Obecná akce: čeká na změnu IF false → true; akce systémového zdroje: čeká na skutečnou změnu nakonfigurované zdrojové otázky nebo možnosti", already_executed: "Již doručeno — neopakuje se", background_baseline: "Základní stav — bez akce", batch_deferred: "Odloženo do uložení", pending: "Čeká", indeterminate: "Neurčité", succeeded: "Úspěšné", failed: "Selhalo", superseded: "Nahrazeno",
    }, yes: "Ano", no: "Ne", acknowledgementRequired: "Před zapnutím potvrďte, že rozumíte způsobu doručování.",
  },
  hu: {
    title: "Automatikus indító és teszt", subtitle: "A státuszlépés indítójának kifejezett beállítása. A régi szolgáltatási műveletek lent külön maradnak.", reload: "Frissítés", loading: "Indítóbeállítás betöltése…", error: "Az indító adatai nem tölthetők be. Az ellenőrzésig a beállítások zárolva vannak.", saveFailure: "Az indítót nem sikerült menteni. Ellenőrizze a beállítást, majd próbálja újra.", retry: "Újrapróbálás",
    trigger: "Indító", enabled: "Automatikus munkafolyamat", off: "Ki", on: "Be", save: "Indító mentése", saving: "Mentés…", saved: "Indító mentve.", acknowledge: "Megértem, hogy a bekapcsolás a felsorolt műveleteket kézbesítheti e szabályok szerint.", agent: "Ügynöki megerősítés", card: "Kártya megnyitása", background: "Háttérváltozás",
    modeImmediate: "Azonnali mód", modeBatch: "Kötegelt mód", hidden: "Rejtett lépés", visible: "Látható lépés", noActions: "Nincs automatikus művelet beállítva.", actions: "Az indító által kezelt műveletek", supported: "Támogatott feltételmezők", noFields: "Nincs megadott feltételmező.",
    behaviorAgent: "Csak akkor fut, ha az ügynök megerősíti a lépést. Rejtett lépést az ügynök nem erősíthet meg, ezért ez az indító nem futhat.", behaviorCard: "A kártya megnyitása beolvassa az aktuális válaszokat. Igaz IF esetén a művelet műveletenként és kapcsolatonként egyszer futhat; nem ismétlődik.", behaviorBackground: "Az indító bekapcsolása nem dolgozza fel az aktuális állapotot. Az első kiértékelés külső hatás nélküli alapállapotot rögzít. Forrás nélküli általános műveleteknél egy későbbi false → true IF-váltás indíthat. Rendszerforrás-műveleteknél a beállított forráskérdés vagy -opció valódi változása és igaz IF szükséges. Az adminisztrátor külön előnézetet készíthet és kifejezetten megerősítheti az aktuálisan igaz feltételek egyszeri feldolgozását.",
    visibility: "A láthatóság csak a lépés megjelenítését vezérli, az indítót nem.", noReplay: "A váltás vagy újramentés nem ismétli meg a már kézbesített műveletet.", batchNote: "A kötegelt események tartós várakozó sorban maradnak; hatásuk csak az ügynök tényleges Batch mentésekor érvényesül.", contact: "Kapcsolat az előnézethez", searchContact: "Kapcsolatok keresése…", chooseContact: "Válasszon egy kapcsolatot", preview: "Végrehajtás nélkül ellenőrzés", previewTitle: "Csak olvasható kapcsolat-előnézet", previewHelp: "Ez csak kiértékelést kér. Nem hajt végre, nem sorol be és nem kézbesít műveletet.", previewLoading: "Kiértékelés végrehajtás nélkül…", previewError: "Az előnézet nem tölthető be. Nem történt végrehajtás.", selectFirst: "Válasszon kapcsolatot az előnézethez.", result: "Kiértékelés", baseline: "Az első kiértékelés alapállapot; nincs művelet.", conditionTrue: "IF igaz", conditionFalse: "IF hamis", conditionUnknown: "IF ismeretlen", readOnly: "Csak olvasható", statuses: {
      ready: "Kész", disabled: "Kikapcsolva", unsupported_action: "Nem támogatott művelet", invalid_condition: "Érvénytelen feltétel", missing_answer: "Hiányzó válasz", condition_false: "A feltétel hamis", waiting_transition: "Általános művelet: false → true IF-váltásra vár; rendszerforrás-művelet: a beállított forráskérdés vagy -opció tényleges változására vár", already_executed: "Már kézbesítve — nem ismétlődik", background_baseline: "Alapállapot — nincs művelet", batch_deferred: "Mentésig halasztva", pending: "Függőben", indeterminate: "Nem meghatározható", succeeded: "Sikeres", failed: "Sikertelen", superseded: "Felülírva",
    }, yes: "Igen", no: "Nem", acknowledgementRequired: "Bekapcsolás előtt erősítse meg a kézbesítési szabályok megértését.",
  },
  ro: {
    title: "Declanșator automat și test", subtitle: "Configurare explicită pentru declanșatorul acestui pas. Acțiunile vechi de serviciu rămân separate mai jos.", reload: "Reîncarcă", loading: "Se încarcă setarea declanșatorului…", error: "Informațiile declanșatorului nu pot fi încărcate. Setările rămân blocate până la verificare.", saveFailure: "Declanșatorul nu a putut fi salvat. Verificați configurarea și încercați din nou.", retry: "Reîncearcă",
    trigger: "Declanșator", enabled: "Flux automat", off: "Oprit", on: "Pornit", save: "Salvează declanșatorul", saving: "Se salvează…", saved: "Declanșator salvat.", acknowledge: "Înțeleg că activarea poate livra acțiunile listate conform acestor reguli.", agent: "Confirmare agent", card: "Deschidere fișă", background: "Schimbare în fundal",
    modeImmediate: "Mod imediat", modeBatch: "Mod grupat", hidden: "Pas ascuns", visible: "Pas vizibil", noActions: "Nu există acțiuni automate configurate.", actions: "Acțiuni acoperite de declanșator", supported: "Câmpuri de condiție acceptate", noFields: "Nu sunt raportate câmpuri de condiție.",
    behaviorAgent: "Rulează numai când agentul confirmă pasul. Un pas ascuns nu poate fi confirmat de agent, deci acest declanșator nu poate rula.", behaviorCard: "Deschiderea fișei citește răspunsurile curente. Dacă IF este adevărat, o acțiune poate rula o singură dată per acțiune și contact; nu se repetă.", behaviorBackground: "Activarea declanșatorului nu procesează starea curentă. Prima evaluare stabilește valoarea de bază fără efecte externe. Pentru acțiuni generale fără sursă, o schimbare ulterioară IF false → true poate declanșa acțiunea. Pentru acțiunile cu sursă de sistem este necesară o schimbare reală a întrebării sau opțiunii sursă configurate și IF adevărat. Administratorul poate crea separat o previzualizare și confirma explicit procesarea unică a condițiilor adevărate în prezent.",
    visibility: "Vizibilitatea controlează doar afișarea pasului, nu declanșatorul.", noReplay: "Comutarea sau salvarea din nou nu repetă o acțiune deja livrată.", batchNote: "Evenimentele batch așteaptă într-o coadă persistentă; efectele apar numai după o salvare Batch reală a agentului.", contact: "Contact pentru previzualizare", searchContact: "Caută contacte…", chooseContact: "Alegeți un singur contact", preview: "Verifică fără executare", previewTitle: "Previzualizare contact doar în citire", previewHelp: "Se solicită doar evaluarea. Nicio acțiune nu este executată, pusă în coadă sau livrată.", previewLoading: "Se evaluează fără execuție…", previewError: "Previzualizarea nu poate fi încărcată. Nu s-a executat nimic.", selectFirst: "Alegeți un contact pentru previzualizare.", result: "Evaluare", baseline: "Prima evaluare este valoarea de bază; nu rulează acțiuni.", conditionTrue: "IF adevărat", conditionFalse: "IF fals", conditionUnknown: "IF necunoscut", readOnly: "Doar în citire", statuses: {
      ready: "Pregătit", disabled: "Dezactivat", unsupported_action: "Acțiune neacceptată", invalid_condition: "Condiție invalidă", missing_answer: "Răspuns lipsă", condition_false: "Condiția este falsă", waiting_transition: "Acțiune generală: așteaptă IF false → true; acțiune cu sursă de sistem: așteaptă o schimbare reală a întrebării sau opțiunii sursă configurate", already_executed: "Deja livrată — nu se repetă", background_baseline: "Valoare de bază — fără acțiune", batch_deferred: "Amânat până la salvare", pending: "În așteptare", indeterminate: "Nedeterminat", succeeded: "Reușit", failed: "Eșuat", superseded: "Înlocuit",
    }, yes: "Da", no: "Nu", acknowledgementRequired: "Confirmați că înțelegeți comportamentul de livrare înainte de activare.",
  },
  it: {
    title: "Trigger automatico e test", subtitle: "Configurazione esplicita del trigger per questo passaggio di stato. Le azioni di servizio legacy restano separate qui sotto.", reload: "Ricarica", loading: "Caricamento configurazione trigger…", error: "Impossibile caricare le informazioni del trigger. Le impostazioni restano bloccate finché non sono verificabili.", saveFailure: "Impossibile salvare il trigger. Controlla la configurazione e riprova.", retry: "Riprova",
    trigger: "Trigger", enabled: "Workflow automatico", off: "Disattivato", on: "Attivato", save: "Salva trigger", saving: "Salvataggio…", saved: "Trigger salvato.", acknowledge: "Comprendo che l'attivazione può consegnare le azioni elencate secondo queste regole.", agent: "Conferma agente", card: "Apertura scheda", background: "Modifica in background",
    modeImmediate: "Modalità immediata", modeBatch: "Modalità batch", hidden: "Passaggio nascosto", visible: "Passaggio visibile", noActions: "Nessuna azione automatica configurata.", actions: "Azioni coperte da questo trigger", supported: "Campi condizione supportati", noFields: "Nessun campo condizione indicato.",
    behaviorAgent: "Parte solo quando un agente conferma il passaggio. Un passaggio nascosto non può essere confermato dall'agente, quindi questo trigger non può partire.", behaviorCard: "L'apertura della scheda legge le risposte correnti. Se IF è vero, un'azione può partire una sola volta per azione e contatto; non viene ripetuta.", behaviorBackground: "L'attivazione del trigger non elabora lo stato corrente. La prima valutazione stabilisce la baseline senza effetti esterni. Per azioni generiche senza sorgente, una successiva variazione di IF da false a true può attivare l'azione. Per azioni con sorgente di sistema serve una variazione reale della domanda o opzione sorgente configurata e IF vero. L'amministratore può creare separatamente un'anteprima e confermare esplicitamente l'elaborazione una tantum delle condizioni attualmente vere.",
    visibility: "La visibilità controlla solo la visualizzazione del passaggio, non il trigger.", noReplay: "Attivare/disattivare o salvare di nuovo non ripete un'azione già consegnata.", batchNote: "Gli eventi batch attendono in una coda persistente; gli effetti avvengono solo dopo un vero salvataggio Batch dell'agente.", contact: "Contatto per anteprima", searchContact: "Cerca contatti…", chooseContact: "Scegli un contatto", preview: "Verifica senza eseguire", previewTitle: "Anteprima contatto in sola lettura", previewHelp: "Richiede solo una valutazione. Nessuna azione viene eseguita, accodata o consegnata.", previewLoading: "Valutazione senza esecuzione…", previewError: "Impossibile caricare l'anteprima. Non è stata eseguita alcuna azione.", selectFirst: "Scegli un contatto per l'anteprima.", result: "Valutazione", baseline: "La prima valutazione è una baseline; nessuna azione parte.", conditionTrue: "IF vero", conditionFalse: "IF falso", conditionUnknown: "IF sconosciuto", readOnly: "Sola lettura", statuses: {
      ready: "Pronto", disabled: "Disattivato", unsupported_action: "Azione non supportata", invalid_condition: "Condizione non valida", missing_answer: "Risposta mancante", condition_false: "Condizione falsa", waiting_transition: "Azione generale: in attesa del passaggio IF false → true; azione con sorgente di sistema: in attesa di una variazione reale della domanda o opzione sorgente configurata", already_executed: "Già consegnata — non viene ripetuta", background_baseline: "Baseline — nessuna azione", batch_deferred: "Rinviata al salvataggio", pending: "In attesa", indeterminate: "Indeterminato", succeeded: "Completata", failed: "Fallita", superseded: "Sostituita",
    }, yes: "Sì", no: "No", acknowledgementRequired: "Conferma di aver compreso il comportamento di consegna prima di attivare.",
  },
  de: {
    title: "Automatischer Auslöser & Test", subtitle: "Explizite Auslöserkonfiguration für diesen Statusschritt. Bestehende Serviceaktionen bleiben unten separat.", reload: "Neu laden", loading: "Auslöserkonfiguration wird geladen…", error: "Auslöserinformationen konnten nicht geladen werden. Einstellungen bleiben bis zur Prüfung gesperrt.", saveFailure: "Der Auslöser konnte nicht gespeichert werden. Konfiguration prüfen und erneut versuchen.", retry: "Erneut versuchen",
    trigger: "Auslöser", enabled: "Automatischer Workflow", off: "Aus", on: "Ein", save: "Auslöser speichern", saving: "Wird gespeichert…", saved: "Auslöser gespeichert.", acknowledge: "Ich verstehe, dass die Aktivierung die aufgeführten Aktionen nach diesen Regeln zustellen kann.", agent: "Agentenbestätigung", card: "Kartenöffnung", background: "Hintergrundänderung",
    modeImmediate: "Sofortmodus", modeBatch: "Stapelmodus", hidden: "Verborgener Schritt", visible: "Sichtbarer Schritt", noActions: "Keine automatischen Aktionen konfiguriert.", actions: "Von diesem Auslöser erfasste Aktionen", supported: "Unterstützte Bedingungsfelder", noFields: "Keine Bedingungsfelder gemeldet.",
    behaviorAgent: "Wird nur ausgeführt, wenn ein Agent diesen Schritt bestätigt. Einen verborgenen Schritt kann ein Agent nicht bestätigen; dieser Auslöser kann dort nicht laufen.", behaviorCard: "Beim Öffnen der Karte werden aktuelle Antworten gelesen. Wenn IF wahr ist, kann eine Aktion einmal je Aktion und Kontakt laufen; sie wird nicht wiederholt.", behaviorBackground: "Das Aktivieren dieses Auslösers verarbeitet den aktuellen Stand nicht. Die erste Auswertung setzt den Ausgangswert ohne externe Effekte. Bei allgemeinen Aktionen ohne Quelle kann eine spätere IF-Änderung von false zu true auslösen. Bei Aktionen mit Systemquelle sind eine tatsächliche Änderung der konfigurierten Quellfrage oder -option und ein wahres IF erforderlich. Administratoren können separat eine Vorschau erstellen und die einmalige Verarbeitung aktuell wahrer Bedingungen ausdrücklich bestätigen.",
    visibility: "Die Sichtbarkeit steuert nur, ob der Schritt angezeigt wird, nicht seinen Auslöser.", noReplay: "Umschalten oder erneutes Speichern wiederholt keine bereits zugestellte Aktion.", batchNote: "Batch-Ereignisse warten in einer dauerhaften Warteschlange; Effekte entstehen erst nach einem echten Batch-Speichern durch den Agenten.", contact: "Kontakt für Vorschau", searchContact: "Kontakte suchen…", chooseContact: "Einen Kontakt auswählen", preview: "Ohne Ausführung prüfen", previewTitle: "Schreibgeschützte Kontaktvorschau", previewHelp: "Dies fordert nur eine Auswertung an. Es wird keine Aktion ausgeführt, eingereiht oder zugestellt.", previewLoading: "Auswertung ohne Ausführung…", previewError: "Vorschau konnte nicht geladen werden. Es wurde nichts ausgeführt.", selectFirst: "Wählen Sie einen Kontakt für die Vorschau.", result: "Auswertung", baseline: "Die erste Auswertung ist der Ausgangswert; keine Aktion läuft.", conditionTrue: "IF wahr", conditionFalse: "IF falsch", conditionUnknown: "IF unbekannt", readOnly: "Nur lesend", statuses: {
      ready: "Bereit", disabled: "Deaktiviert", unsupported_action: "Nicht unterstützte Aktion", invalid_condition: "Ungültige Bedingung", missing_answer: "Antwort fehlt", condition_false: "Bedingung ist falsch", waiting_transition: "Allgemeine Aktion: wartet auf IF-Wechsel false → true; Systemquellenaktion: wartet auf eine tatsächliche Änderung der konfigurierten Quellfrage oder -option", already_executed: "Bereits zugestellt — keine Wiederholung", background_baseline: "Ausgangswert — keine Aktion", batch_deferred: "Bis zum Speichern zurückgestellt", pending: "Ausstehend", indeterminate: "Unbestimmt", succeeded: "Erfolgreich", failed: "Fehlgeschlagen", superseded: "Abgelöst",
    }, yes: "Ja", no: "Nein", acknowledgementRequired: "Bestätigen Sie vor der Aktivierung, dass Sie das Zustellverhalten verstehen.",
  },
};

const actionKeys = ["assign_task", "send_email", "update_record", "send_email_group", "notify_email", "send_sms", "send_contact_email", "set_contact_status", "set_callback", "notify_role", "sys_webhook"];
const actionNames: Record<string, string[]> = {
  en: ["Assign task", "Send email", "Update record", "Send group email", "Send external notification email", "Send SMS", "Email contact", "Set contact status", "Schedule callback", "Notify role", "System webhook"],
  sk: ["Priradiť úlohu", "Odoslať e-mail", "Aktualizovať záznam", "Odoslať skupinový e-mail", "Odoslať externý notifikačný e-mail", "Odoslať SMS", "Poslať e-mail kontaktu", "Nastaviť stav kontaktu", "Naplánovať spätné volanie", "Upozorniť rolu", "Systémový webhook"],
  cs: ["Přiřadit úkol", "Odeslat e-mail", "Aktualizovat záznam", "Odeslat skupinový e-mail", "Odeslat externí notifikační e-mail", "Odeslat SMS", "Poslat e-mail kontaktu", "Nastavit stav kontaktu", "Naplánovat zpětné volání", "Upozornit roli", "Systémový webhook"],
  hu: ["Feladat hozzárendelése", "E-mail küldése", "Rekord frissítése", "Csoportos e-mail küldése", "Külső értesítő e-mail küldése", "SMS küldése", "E-mail a kapcsolatnak", "Kapcsolati állapot beállítása", "Visszahívás ütemezése", "Szerepkör értesítése", "Rendszer-webhook"],
  ro: ["Atribuire sarcină", "Trimite e-mail", "Actualizează înregistrarea", "Trimite e-mail de grup", "Trimite e-mail de notificare externă", "Trimite SMS", "E-mail către contact", "Setează statusul contactului", "Programează apel de revenire", "Notifică rolul", "Webhook de sistem"],
  it: ["Assegna attività", "Invia e-mail", "Aggiorna record", "Invia e-mail di gruppo", "Invia e-mail di notifica esterna", "Invia SMS", "Invia e-mail al contatto", "Imposta stato contatto", "Pianifica richiamata", "Notifica il ruolo", "Webhook di sistema"],
  de: ["Aufgabe zuweisen", "E-Mail senden", "Datensatz aktualisieren", "Gruppen-E-Mail senden", "Externe Benachrichtigungs-E-Mail senden", "SMS senden", "E-Mail an Kontakt", "Kontaktstatus festlegen", "Rückruf planen", "Rolle benachrichtigen", "System-Webhook"],
};
const issueKeys = ["native_config", "owner_required", "invalid_condition", "unsupported_action", "missing_answer", "invalid_template", "missing_target", "revision_conflict"];
const issueNames: Record<string, string[]> = {
  en: ["Native action configuration is invalid or incomplete.", "A required owner or role is missing.", "The IF condition is invalid.", "This action type is not supported by this trigger.", "A required answer is missing.", "A required template is missing or invalid.", "A required target is missing or invalid.", "Configuration changed elsewhere. Reload before saving."],
  sk: ["Natívna konfigurácia akcie je neplatná alebo neúplná.", "Chýba povinný vlastník alebo rola.", "Podmienka IF je neplatná.", "Tento typ akcie tento spúšťač nepodporuje.", "Chýba povinná odpoveď.", "Povinná šablóna chýba alebo je neplatná.", "Povinný cieľ chýba alebo je neplatný.", "Nastavenie sa medzitým zmenilo. Pred uložením obnovte údaje."],
  cs: ["Nativní konfigurace akce je neplatná nebo neúplná.", "Chybí povinný vlastník nebo role.", "Podmínka IF je neplatná.", "Tento typ akce tento spouštěč nepodporuje.", "Chybí povinná odpověď.", "Povinná šablona chybí nebo je neplatná.", "Povinný cíl chybí nebo je neplatný.", "Nastavení se mezitím změnilo. Před uložením obnovte data."],
  hu: ["A natív művelet konfigurációja érvénytelen vagy hiányos.", "Hiányzik a kötelező tulajdonos vagy szerepkör.", "Az IF-feltétel érvénytelen.", "Ezt a művelettípust ez az indító nem támogatja.", "Hiányzik a kötelező válasz.", "A kötelező sablon hiányzik vagy érvénytelen.", "A kötelező cél hiányzik vagy érvénytelen.", "A beállítás időközben módosult. Mentés előtt frissítsen."],
  ro: ["Configurația nativă a acțiunii este invalidă sau incompletă.", "Lipsește proprietarul sau rolul obligatoriu.", "Condiția IF este invalidă.", "Acest tip de acțiune nu este acceptat de declanșator.", "Lipsește răspunsul obligatoriu.", "Șablonul obligatoriu lipsește sau este invalid.", "Ținta obligatorie lipsește sau este invalidă.", "Configurația s-a schimbat între timp. Reîncărcați înainte de salvare."],
  it: ["La configurazione nativa dell'azione è incompleta o non valida.", "Manca il proprietario o il ruolo obbligatorio.", "La condizione IF non è valida.", "Questo tipo di azione non è supportato dal trigger.", "Manca una risposta obbligatoria.", "Il modello obbligatorio manca o non è valido.", "La destinazione obbligatoria manca o non è valida.", "La configurazione è cambiata. Ricarica prima di salvare."],
  de: ["Die native Aktionskonfiguration ist ungültig oder unvollständig.", "Ein erforderlicher Eigentümer oder eine Rolle fehlt.", "Die IF-Bedingung ist ungültig.", "Dieser Aktionstyp wird von diesem Auslöser nicht unterstützt.", "Eine erforderliche Antwort fehlt.", "Eine erforderliche Vorlage fehlt oder ist ungültig.", "Ein erforderliches Ziel fehlt oder ist ungültig.", "Die Konfiguration wurde zwischenzeitlich geändert. Vor dem Speichern neu laden."],
};
const issueAliases: Record<string, string> = {
  invalid_native_config: "native_config", invalid_native_action_config: "native_config", native_config_invalid: "native_config",
  missing_owner: "owner_required", owner_missing: "owner_required", missing_role: "owner_required",
  invalid_condition_config: "invalid_condition", unsupported: "unsupported_action", action_unsupported: "unsupported_action",
  missing_required_answer: "missing_answer", template_required: "invalid_template", missing_template: "invalid_template",
  invalid_target: "missing_target", target_required: "missing_target", stale_revision: "revision_conflict", conflict: "revision_conflict",
};
const fieldKeys = ["country", "has_email", "has_phone", "is_pregnant", "due_date_weeks", "segment", "answer_is_yes", "answer_for_question", "hour_of_day", "day_of_week", "call_count", "days_in_status", "last_call_outcome", "dispositions_count", "assigned_status_code", "contact.status_code", "contact.segment", "contact.contract_signed", "contact.hospital_id", "contact.clinic_id"];
const fieldNames: Record<string, string[]> = {
  en: ["Contact country", "Has email", "Has phone", "Is pregnant", "Weeks until due date", "Contact segment", "Last answer is yes", "Answer for a specific question", "Hour of day", "Day of week", "Call count", "Days in status", "Last call outcome", "Campaign disposition count", "Assigned status code", "CRM contact status", "CRM contact segment", "Contract signed", "Assigned hospital", "Assigned clinic"],
  sk: ["Krajina kontaktu", "Má e-mail", "Má telefón", "Je tehotná", "Týždňov do pôrodu", "Segment kontaktu", "Posledná odpoveď je áno", "Odpoveď na konkrétnu otázku", "Hodina dňa", "Deň týždňa", "Počet hovorov", "Dní v tomto stave", "Výsledok posledného hovoru", "Počet dispozícií v kampani", "Kód priradeného stavu", "Kód stavu kontaktu (CRM)", "CRM segment kontaktu", "Zmluva podpísaná", "Priradená nemocnica", "Priradená klinika"],
  cs: ["Země kontaktu", "Má e-mail", "Má telefon", "Je těhotná", "Týdnů do porodu", "Segment kontaktu", "Poslední odpověď je ano", "Odpověď na konkrétní otázku", "Hodina dne", "Den v týdnu", "Počet hovorů", "Dní v tomto stavu", "Výsledek posledního hovoru", "Počet dispozic v kampani", "Kód přiřazeného stavu", "Kód stavu kontaktu (CRM)", "CRM segment kontaktu", "Smlouva podepsána", "Přiřazená nemocnice", "Přiřazená klinika"],
  hu: ["Kapcsolat országa", "Van e-mail", "Van telefonszám", "Várandós", "Hátralévő hetek a szülésig", "Kapcsolati szegmens", "Az utolsó válasz igen", "Válasz egy adott kérdésre", "A nap órája", "A hét napja", "Hívások száma", "Napok ebben az állapotban", "Utolsó hívás eredménye", "Kampánybeli diszpozíciók száma", "Hozzárendelt állapotkód", "CRM-kapcsolati státusz", "CRM-kapcsolati szegmens", "Szerződés aláírva", "Hozzárendelt kórház", "Hozzárendelt klinika"],
  ro: ["Țara contactului", "Are e-mail", "Are telefon", "Este însărcinată", "Săptămâni până la termen", "Segmentul contactului", "Ultimul răspuns este da", "Răspuns la o întrebare specifică", "Ora din zi", "Ziua săptămânii", "Număr de apeluri", "Zile în acest status", "Rezultatul ultimului apel", "Număr de dispoziții în campanie", "Codul statusului atribuit", "Status CRM al contactului", "Segment CRM al contactului", "Contract semnat", "Spital atribuit", "Clinică atribuită"],
  it: ["Paese del contatto", "Ha un'e-mail", "Ha un telefono", "È in gravidanza", "Settimane alla data prevista", "Segmento del contatto", "Ultima risposta positiva", "Risposta a una domanda specifica", "Ora del giorno", "Giorno della settimana", "Numero di chiamate", "Giorni nello stato", "Esito dell'ultima chiamata", "Numero di disposizioni nella campagna", "Codice stato assegnato", "Stato CRM del contatto", "Segmento CRM del contatto", "Contratto firmato", "Ospedale assegnato", "Clinica assegnata"],
  de: ["Land des Kontakts", "E-Mail vorhanden", "Telefon vorhanden", "Schwanger", "Wochen bis zum Geburtstermin", "Kontaktsegment", "Letzte Antwort ist Ja", "Antwort auf eine bestimmte Frage", "Tagesstunde", "Wochentag", "Anzahl der Anrufe", "Tage in diesem Status", "Ergebnis des letzten Anrufs", "Anzahl der Dispositionen in der Kampagne", "Zugewiesener Statuscode", "CRM-Kontaktstatus", "CRM-Kontaktsegment", "Vertrag unterzeichnet", "Zugewiesenes Krankenhaus", "Zugewiesene Klinik"],
};
const genericText: Record<string, { genericAction: string; genericIssue: string; extraField: string }> = {
  en: { genericAction: "Unsupported action", genericIssue: "This action has an unresolved configuration issue.", extraField: "Additional supported condition" },
  sk: { genericAction: "Nepodporovaná akcia", genericIssue: "Táto akcia má nevyriešený problém nastavenia.", extraField: "Ďalšia podporovaná podmienka" },
  cs: { genericAction: "Nepodporovaná akce", genericIssue: "Tato akce má nevyřešený problém konfigurace.", extraField: "Další podporovaná podmínka" },
  hu: { genericAction: "Nem támogatott művelet", genericIssue: "A művelet konfigurációs problémája nincs megoldva.", extraField: "További támogatott feltétel" },
  ro: { genericAction: "Acțiune neacceptată", genericIssue: "Acțiunea are o problemă de configurare nerezolvată.", extraField: "Condiție acceptată suplimentară" },
  it: { genericAction: "Azione non supportata", genericIssue: "L'azione ha un problema di configurazione irrisolto.", extraField: "Ulteriore condizione supportata" },
  de: { genericAction: "Nicht unterstützte Aktion", genericIssue: "Für diese Aktion besteht ein ungelöstes Konfigurationsproblem.", extraField: "Zusätzliche unterstützte Bedingung" },
};

function normalizeCode(code: string): string {
  return code.trim().toLowerCase().replace(/[\s.-]+/g, "_");
}

function localizedAction(actionType: string, locale: string): string {
  const index = actionKeys.indexOf(normalizeCode(actionType));
  return index < 0 ? genericText[locale]?.genericAction || genericText.en.genericAction : actionNames[locale]?.[index] || actionNames.en[index];
}

function localizedIssue(issue: string, locale: string): string {
  const normalized = normalizeCode(issue);
  const key = issueAliases[normalized] || (normalized.startsWith("native_config_") ? "native_config" : normalized.startsWith("owner_required_") ? "owner_required" : normalized.startsWith("invalid_condition_") ? "invalid_condition" : normalized);
  const index = issueKeys.indexOf(key);
  return index < 0 ? genericText[locale]?.genericIssue || genericText.en.genericIssue : issueNames[locale]?.[index] || issueNames.en[index];
}

function localizedField(field: string, locale: string): string {
  const history = getStatusListHistoryCopy(locale).fields.find(entry => entry.key === field);
  if (history) return history.label;
  const index = fieldKeys.indexOf(field);
  return index < 0 ? genericText[locale]?.extraField || genericText.en.extraField : fieldNames[locale]?.[index] || fieldNames.en[index];
}

const triggerKeys: Trigger[] = ["agent_confirmation", "card_open", "background_change"];

export function StatusListAutomaticTriggerInspector({ campaignId, itemId, locale, disabled = false }: { campaignId: string; itemId: string; locale: string; disabled?: boolean }) {
  const t = copy[locale] || copy.en;
  const [record, setRecord] = useState<AutomaticItem | null>(null);
  const [trigger, setTrigger] = useState<Trigger>("agent_confirmation");
  const [enabled, setEnabled] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactError, setContactError] = useState(false);
  const [contactReload, setContactReload] = useState(0);
  const [contactId, setContactId] = useState("");
  const contactIdRef = useRef("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const loadIdentity = useRef(0);
  const previewIdentity = useRef(0);
  const endpoint = `/api/campaigns/${campaignId}/status-list-workflows/automatic-items/${itemId}`;

  const load = async () => {
    const identity = ++loadIdentity.current;
    setRecord(null); setLoadError(false); setSaveMessage("");
    try {
      const response = await fetch(endpoint, { credentials: "include" });
      if (!response.ok) throw new Error("load");
      const result = await response.json() as AutomaticItem;
      if (identity !== loadIdentity.current) return;
      if (!result?.item || !result?.config || !Array.isArray(result.actions) || !Array.isArray(result.supportedConditionFields)) throw new Error("shape");
      setRecord(result); setTrigger(result.config.trigger); setEnabled(result.config.enabled); setAcknowledged(false);
    } catch {
      if (identity === loadIdentity.current) { setLoadError(true); setRecord(null); }
    }
  };
  useEffect(() => {
    void load();
    return () => { loadIdentity.current++; previewIdentity.current++; };
    // Reload on identity changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    const identity = loadIdentity.current;
    setContactsLoading(true); setContactError(false); setContacts([]); setContactId("");
    const timer = window.setTimeout(async () => {
      try {
        const url = `/api/campaigns/${campaignId}/status-list-workflows/automatic-contacts?search=${encodeURIComponent(search)}`;
        const response = await fetch(url, { credentials: "include", signal: controller.signal });
        if (!response.ok) throw new Error("contacts");
        const result = await response.json() as { contacts: Contact[] };
        if (!controller.signal.aborted && identity === loadIdentity.current) setContacts(Array.isArray(result.contacts) ? result.contacts : []);
      } catch {
        if (!controller.signal.aborted && identity === loadIdentity.current) setContactError(true);
      } finally {
        if (!controller.signal.aborted && identity === loadIdentity.current) setContactsLoading(false);
      }
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [campaignId, search, endpoint, contactReload]);

  useEffect(() => {
    contactIdRef.current = contactId;
    setPreview(null); setPreviewError(false); setPreviewLoading(false);
    previewIdentity.current++;
  }, [contactId, itemId]);

  const save = async () => {
    if (!record || saving || disabled || (enabled && !acknowledged)) return;
    setSaving(true); setSaveMessage(""); setSaveError(false);
    try {
      const response = await fetch(endpoint, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger, enabled, expectedRevision: record.config.revision, acknowledged: true }),
      });
      if (!response.ok) {
        let code = "";
        try {
          const body = await response.json();
          const candidate = body?.code ?? body?.errorCode ?? body?.error ?? body?.reason ?? body?.message;
          if (typeof candidate === "string") code = candidate;
        } catch { /* Use the localized generic save message when the response has no JSON code. */ }
        setSaveMessage(code ? localizedIssue(code, locale) : t.saveFailure);
        setSaveError(true);
        return;
      }
      const next = await response.json() as AutomaticItem;
      if (!next?.config || !Array.isArray(next.actions)) throw new Error("shape");
      setRecord(next); setTrigger(next.config.trigger); setEnabled(next.config.enabled); setAcknowledged(false); setSaveMessage(t.saved);
      setSaveError(false);
    } catch {
      setSaveMessage(t.saveFailure);
      setSaveError(true);
    } finally { setSaving(false); }
  };
  const runPreview = async () => {
    if (!contactId || previewLoading) return;
    const identity = ++previewIdentity.current;
    const selectedContactId = contactId;
    setPreview(null); setPreviewError(false); setPreviewLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/contacts/${encodeURIComponent(selectedContactId)}/status-list-workflows/automatic-preview`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId }),
      });
      if (!response.ok) throw new Error("preview");
      const result = await response.json() as Preview;
      if (identity !== previewIdentity.current || selectedContactId !== contactIdRef.current) return;
      if (result.readOnly !== true || !Array.isArray(result.actions)) throw new Error("shape");
      setPreview(result);
    } catch {
      if (identity === previewIdentity.current && selectedContactId === contactIdRef.current) setPreviewError(true);
    } finally {
      if (identity === previewIdentity.current && selectedContactId === contactIdRef.current) setPreviewLoading(false);
    }
  };
  const triggerLabel = (value: Trigger) => value === "agent_confirmation" ? t.agent : value === "card_open" ? t.card : t.background;
  const behavior = trigger === "agent_confirmation" ? t.behaviorAgent : trigger === "card_open" ? t.behaviorCard : t.behaviorBackground;

  return <section className="slati" data-testid="automatic-trigger-inspector" aria-busy={!record && !loadError}>
    <header className="slati-head">
      <div className="slati-title"><span><Zap size={16}/></span><div><h3>{t.title}</h3><p>{t.subtitle}</p></div></div>
      <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={!record || saving}><RefreshCw size={14} className="mr-1.5"/>{t.reload}</Button>
    </header>
    {!record && !loadError && <div className="slati-skeleton" aria-label={t.loading}><span/><span/><span/></div>}
    {loadError && <div className="slati-error" role="alert"><AlertTriangle size={16}/><span>{t.error}</span><Button type="button" size="sm" variant="outline" onClick={() => void load()}>{t.retry}</Button></div>}
    {record && <>
      {!record.config.enabled && <p className="slati-muted">{({
        en:"The explicit automatic trigger is off. Existing agent-confirmation rules are unchanged; this does not disable them.",
        sk:"Výslovný automatický spúšťač je vypnutý. Pôvodné pravidlá potvrdenia agentom ostávajú nezmenené; týmto sa nevypínajú.",
        cs:"Výslovný automatický spouštěč je vypnutý. Původní pravidla potvrzení agentem zůstávají beze změny; tímto se nevypínají.",
        hu:"A kifejezett automatikus indítás ki van kapcsolva. Az ügynöki megerősítés meglévő szabályai változatlanok maradnak; ez nem kapcsolja ki őket.",
        ro:"Declanșatorul automat explicit este oprit. Regulile existente de confirmare de către agent rămân neschimbate; acestea nu sunt dezactivate.",
        it:"Il trigger automatico esplicito è disattivato. Le regole esistenti di conferma dell’agente restano invariate; non vengono disattivate.",
        de:"Der ausdrückliche automatische Auslöser ist aus. Bestehende Regeln zur Agentenbestätigung bleiben unverändert und werden hierdurch nicht deaktiviert.",
      } as Record<string,string>)[locale] || "Existing agent-confirmation rules are unchanged."}</p>}
      <div className="slati-meta"><strong>{record.item.label}</strong><span>{record.item.isHidden ? t.hidden : t.visible}</span><span>{record.mode === "batch" ? t.modeBatch : t.modeImmediate}</span></div>
      <div className="slati-controls">
        <label className="slati-field"><span>{t.trigger}</span><select value={trigger} onChange={event => { setTrigger(event.target.value as Trigger); setSaveMessage(""); setSaveError(false); }}>{triggerKeys.map(value => <option value={value} key={value}>{triggerLabel(value)}</option>)}</select></label>
        <label className="slati-switch"><span><strong>{t.enabled}</strong><small>{enabled ? t.on : t.off}</small></span><input type="checkbox" checked={enabled} onChange={event => { setEnabled(event.target.checked); setAcknowledged(false); setSaveMessage(""); setSaveError(false); }}/><i aria-hidden="true"/></label>
      </div>
      <div className="slati-explain"><ShieldCheck size={15}/><div><p>{behavior}</p><p>{t.visibility} {t.noReplay}{record.mode === "batch" ? ` ${t.batchNote}` : ""}</p></div></div>
      {enabled && <label className="slati-ack"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)}/><span>{t.acknowledge}</span></label>}
      <div className="slati-save-row">
        <Button type="button" size="sm" onClick={() => void save()} disabled={saving || disabled || (enabled && !acknowledged)}>{saving && <Loader2 size={14} className="mr-1.5 animate-spin"/>}{saving ? t.saving : t.save}</Button>
        {saveMessage && <span role={saveError ? "alert" : "status"} className={saveError ? "is-error" : ""}>{saveMessage}</span>}
        {enabled && !acknowledged && <small>{t.acknowledgementRequired}</small>}
      </div>
      {record.config.enabled && record.config.trigger === "background_change" && <StatusListAutomaticInitial
        campaignId={campaignId}
        itemId={itemId}
        locale={locale}
        selectedContactId={contactId}
        disabled={saving || trigger !== record.config.trigger || enabled !== record.config.enabled || disabled}
        revisionIdentity={`${record.config.revision ?? "unversioned"}:${record.config.trigger}:${record.config.enabled}`}
      />}
      <section className="slati-actions">
        <h4>{t.actions} <b>{record.actions.length}</b></h4>
        {record.actions.length ? record.actions.map(action => <article key={action.id}>
          <div><strong>{localizedAction(action.actionType, locale)}</strong>{action.questionLabel && <small>{action.questionLabel}</small>}</div>
          {action.issues.length > 0 && <ul>{action.issues.map((issue, index) => <li key={`${issue}-${index}`}><AlertTriangle size={12}/>{localizedIssue(issue, locale)}</li>)}</ul>}
        </article>) : <p className="slati-muted">{t.noActions}</p>}
      </section>
      <details className="slati-fields"><summary>{t.supported}</summary><p>{record.supportedConditionFields.length ? record.supportedConditionFields.map((field, index) => fieldKeys.includes(field) || getStatusListHistoryCopy(locale).fields.some(entry => entry.key === field) ? localizedField(field, locale) : `${genericText[locale]?.extraField || genericText.en.extraField} ${index + 1}`).join(" · ") : t.noFields}</p></details>
      <section className="slati-preview">
        <header><div><h4><Eye size={15}/>{t.previewTitle}</h4><p>{t.previewHelp}</p></div><span><ShieldCheck size={13}/>{t.readOnly}</span></header>
        <label className="slati-field"><span>{t.contact}</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t.searchContact}/></label>
        <label className="slati-field"><span>{t.chooseContact}</span><select value={contactId} onChange={event => { const next = event.target.value; contactIdRef.current = next; previewIdentity.current++; setPreview(null); setPreviewError(false); setPreviewLoading(false); setContactId(next); }} disabled={contactsLoading || contactError}>
          <option value="">{contactsLoading ? t.loading : t.chooseContact}</option>{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.label}</option>)}
        </select></label>
        {contactError && <p className="slati-error-inline" role="alert">{t.error} <button type="button" onClick={() => setContactReload(value => value + 1)}>{t.retry}</button></p>}
        <div className="slati-preview-action"><Button type="button" variant="outline" size="sm" onClick={() => void runPreview()} disabled={!contactId || previewLoading}><Play size={13} className="mr-1.5"/>{t.preview}</Button>{!contactId && <small>{t.selectFirst}</small>}</div>
        {previewLoading && <div className="slati-preview-state"><span className="slati-mini-skeleton"/>{t.previewLoading}</div>}
        {previewError && <p className="slati-error-inline" role="alert">{t.previewError}</p>}
        {preview && <div className="slati-result" aria-live="polite">
          <h5>{t.result} · {triggerLabel(preview.trigger)} · {preview.mode === "batch" ? t.modeBatch : t.modeImmediate} · {preview.enabled ? t.on : t.off}</h5>
          {preview.baseline && <p className="slati-baseline">{t.baseline}</p>}
          {preview.actions.map((action, index) => <article key={`${action.id}-${index}`}>
            <div><strong>{localizedAction(action.actionType, locale)}</strong>{action.questionLabel && <small>{action.questionLabel}</small>}</div>
            <span className={`slati-status slati-status-${action.status}`}>{t.statuses[action.status] || t.statuses.indeterminate}</span>
            <small>{action.condition === true ? t.conditionTrue : action.condition === false ? t.conditionFalse : t.conditionUnknown}</small>
          </article>)}
        </div>}
      </section>
    </>}
  </section>;
}

export default StatusListAutomaticTriggerInspector;
