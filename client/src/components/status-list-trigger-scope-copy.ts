export type StatusListTriggerScopeCopy = {
  missionCard: string;
  pulseOpen: string;
  backgroundChange: string;
  agentConfirmation: string;
  scopeAgent: string;
  scopeCard: string;
  scopePulse: string;
  scopeBackground: string;
  executionScope: string;
  missionExecution: string;
  missionExecutionHelp: string;
  unattendedExecution: string;
  unattendedExecutionHelp: string;
  unattendedAcknowledgement: string;
  backgroundStart: string;
  visibilitySeparate: string;
  activationBlock: string;
  headingBlock: string;
  dirty: string;
  editorBlocked: string;
};

const dictionaries: Record<string, StatusListTriggerScopeCopy> = {
  en: {
    missionCard: "Mission contact card open",
    pulseOpen: "Nexus Pulse Status List opening",
    backgroundChange: "Server background change",
    agentConfirmation: "Agent confirmation",
    scopeAgent: "Runs only when an agent confirms this step.",
    scopeCard: "Runs when this contact’s Mission card opens; it evaluates current answers, not a historical replay.",
    scopePulse: "Runs when the Nexus Pulse Status List opens for this contact.",
    scopeBackground: "Evaluates real changes server-side across Mission, including when no contact card is open. It does not replay history; the first observed state is an inert baseline.",
    executionScope: "Where background actions run",
    missionExecution: "Mission execution",
    missionExecutionHelp: "Preserves Mission Immediate and Batch behavior. In Batch mode, actions wait for the agent’s actual Batch save.",
    unattendedExecution: "Unattended server execution",
    unattendedExecutionHelp: "Runs on the server without any agent save, including in Batch mode. No Mission card or later Batch save is required.",
    unattendedAcknowledgement: "I understand that unattended execution can run the listed actions without any agent save, even in Batch mode.",
    backgroundStart: "Background changes are evaluated across Mission, even without an open card. There is no historical replay; the first baseline is inert.",
    visibilitySeparate: "Hidden visibility only controls whether agents see the step; it does not select, pause, or change the trigger.",
    activationBlock: "An action missing its required owner or template cannot activate. Resolve the listed issues before enabling this workflow.",
    headingBlock: "This is a main-question heading only. It cannot have its own automatic trigger or agent-confirmation workflow; its child questions remain separate.",
    dirty: "Unsaved trigger changes",
    editorBlocked: "Save or cancel the open action editor first. The trigger is locked while that editor has unsaved changes or is saving.",
  },
  sk: {
    missionCard: "Otvorenie karty kontaktu v Mission",
    pulseOpen: "Otvorenie zoznamu stavov Nexus Pulse",
    backgroundChange: "Zmena na pozadí servera",
    agentConfirmation: "Potvrdenie agentom",
    scopeAgent: "Spustí sa iba po potvrdení tohto kroku agentom.",
    scopeCard: "Spustí sa pri otvorení karty tohto kontaktu v Mission; vyhodnotí aktuálne odpovede, nie historické udalosti.",
    scopePulse: "Spustí sa pri otvorení zoznamu stavov Nexus Pulse pre tento kontakt.",
    scopeBackground: "Vyhodnocuje skutočné zmeny na serveri naprieč Mission, aj keď nie je otvorená karta kontaktu. Históriu neprehráva; prvý zaznamenaný stav je neaktívny základ.",
    executionScope: "Kde sa vykonávajú akcie na pozadí",
    missionExecution: "Vykonávanie v Mission",
    missionExecutionHelp: "Zachováva režim Mission Immediate aj Batch. V režime Batch akcie čakajú na skutočné uloženie dávky agentom.",
    unattendedExecution: "Vykonávanie na serveri bez obsluhy",
    unattendedExecutionHelp: "Spúšťa sa na serveri bez uloženia agentom, aj v režime Batch. Nevyžaduje otvorenie karty Mission ani neskoršie uloženie dávky.",
    unattendedAcknowledgement: "Rozumiem, že vykonávanie bez obsluhy môže spustiť uvedené akcie bez uloženia agentom, aj v režime Batch.",
    backgroundStart: "Zmeny na pozadí sa vyhodnocujú naprieč Mission aj bez otvorenej karty. História sa neprehráva; prvý základný stav je neaktívny.",
    visibilitySeparate: "Skrytá viditeľnosť určuje iba to, či agenti krok uvidia; nevyberá, nepozastavuje ani nemení spúšťač.",
    activationBlock: "Akciu bez povinného vlastníka alebo šablóny nemožno aktivovať. Pred zapnutím workflowu vyriešte uvedené problémy.",
    headingBlock: "Ide iba o nadpis hlavnej otázky. Nemôže mať vlastný automatický spúšťač ani workflow potvrdenia agentom; podotázky zostávajú samostatné.",
    dirty: "Neuložené zmeny spúšťača",
    editorBlocked: "Najprv uložte alebo zrušte rozpracovanú akciu. Počas jej úprav alebo ukladania je spúšťač uzamknutý.",
  },
  cs: {
    missionCard: "Otevření kontaktní karty Mission",
    pulseOpen: "Otevření seznamu stavů Nexus Pulse",
    backgroundChange: "Změna na pozadí serveru",
    agentConfirmation: "Potvrzení agentem",
    scopeAgent: "Spustí se pouze tehdy, když agent potvrdí tento krok.",
    scopeCard: "Spustí se při otevření karty tohoto kontaktu v Mission; vyhodnotí aktuální odpovědi, nikoli historické události.",
    scopePulse: "Spustí se při otevření seznamu stavů Nexus Pulse pro tento kontakt.",
    scopeBackground: "Vyhodnocuje skutečné změny na serveru napříč Mission, i když není otevřená kontaktní karta. Historii nepřehrává; první zjištěný stav je neaktivní základ.",
    executionScope: "Kde se provádějí akce na pozadí",
    missionExecution: "Provádění v Mission",
    missionExecutionHelp: "Zachovává režim Mission Immediate i Batch. V režimu Batch akce čekají na skutečné uložení dávky agentem.",
    unattendedExecution: "Neobsluhované provádění serverem",
    unattendedExecutionHelp: "Spouští se na serveru bez uložení agentem, i v režimu Batch. Nevyžaduje otevření karty Mission ani pozdější uložení dávky.",
    unattendedAcknowledgement: "Rozumím, že neobsluhované provádění může spustit uvedené akce bez uložení agentem, i v režimu Batch.",
    backgroundStart: "Změny na pozadí se vyhodnocují napříč Mission i bez otevřené karty. Historie se nepřehrává; první základní stav je neaktivní.",
    visibilitySeparate: "Skrytá viditelnost určuje pouze to, zda agenti krok uvidí; nevybírá, nepozastavuje ani nemění spouštěč.",
    activationBlock: "Akci bez povinného vlastníka nebo šablony nelze aktivovat. Před zapnutím workflowu vyřešte uvedené problémy.",
    headingBlock: "Jde pouze o nadpis hlavní otázky. Nemůže mít vlastní automatický spouštěč ani workflow potvrzení agentem; podotázky zůstávají samostatné.",
    dirty: "Neuložené změny spouštěče",
    editorBlocked: "Nejprve uložte nebo zrušte rozpracovanou akci. Během jejích úprav nebo ukládání je spouštěč uzamčený.",
  },
  hu: {
    missionCard: "Mission kapcsolati kártya megnyitása",
    pulseOpen: "Nexus Pulse státuszlista megnyitása",
    backgroundChange: "Szerveroldali háttérváltozás",
    agentConfirmation: "Ügynöki megerősítés",
    scopeAgent: "Csak akkor fut, amikor az ügynök megerősíti ezt a lépést.",
    scopeCard: "A kapcsolat Mission-kártyájának megnyitásakor fut; az aktuális válaszokat értékeli ki, nem játszik vissza előzményeket.",
    scopePulse: "A kapcsolat Nexus Pulse státuszlistájának megnyitásakor fut.",
    scopeBackground: "A Mission egészében, szerveroldalon értékeli ki a valós változásokat akkor is, ha nincs nyitva kapcsolati kártya. Nincs előzmény-visszajátszás; az első észlelt állapot hatástalan alapállapot.",
    executionScope: "A háttérműveletek végrehajtási helye",
    missionExecution: "Mission-végrehajtás",
    missionExecutionHelp: "Megőrzi a Mission Immediate és Batch működését. Batch módban a műveletek az ügynök tényleges Batch mentéséig várnak.",
    unattendedExecution: "Felügyelet nélküli szerveres végrehajtás",
    unattendedExecutionHelp: "A szerveren fut ügynöki mentés nélkül, Batch módban is. Nem szükséges Mission-kártya vagy későbbi Batch mentés.",
    unattendedAcknowledgement: "Megértem, hogy a felügyelet nélküli végrehajtás a felsorolt műveleteket ügynöki mentés nélkül is elindíthatja, Batch módban is.",
    backgroundStart: "A háttérváltozásokat a Mission egészében kiértékeli, nyitott kártya nélkül is. Nincs előzmény-visszajátszás; az első alapállapot hatástalan.",
    visibilitySeparate: "A rejtett láthatóság csak azt szabályozza, hogy az ügynökök látják-e a lépést; az indítót nem választja ki, nem szünetelteti és nem módosítja.",
    activationBlock: "A kötelező tulajdonos vagy sablon nélküli művelet nem aktiválható. A munkafolyamat bekapcsolása előtt oldja meg a felsorolt problémákat.",
    headingBlock: "Ez kizárólag fő kérdés címsora. Nem lehet saját automatikus indítója vagy ügynöki megerősítési munkafolyamata; az al-kérdések különállók.",
    dirty: "Nem mentett indítóbeállítások",
    editorBlocked: "Előbb mentse vagy vesse el a szerkesztett műveletet. Nem mentett módosítás vagy mentés közben az indító zárolva van.",
  },
  ro: {
    missionCard: "Deschiderea fișei contactului în Mission",
    pulseOpen: "Deschiderea listei de statusuri Nexus Pulse",
    backgroundChange: "Modificare în fundal pe server",
    agentConfirmation: "Confirmare agent",
    scopeAgent: "Rulează numai când agentul confirmă acest pas.",
    scopeCard: "Rulează când se deschide fișa acestui contact în Mission; evaluează răspunsurile curente, nu redă evenimente istorice.",
    scopePulse: "Rulează când se deschide lista de statusuri Nexus Pulse pentru acest contact.",
    scopeBackground: "Evaluează modificările reale pe server în Mission, chiar și fără o fișă de contact deschisă. Nu reia istoricul; prima stare observată este o valoare de bază fără efecte.",
    executionScope: "Unde rulează acțiunile în fundal",
    missionExecution: "Execuție Mission",
    missionExecutionHelp: "Păstrează comportamentul Mission Immediate și Batch. În modul Batch, acțiunile așteaptă salvarea Batch reală a agentului.",
    unattendedExecution: "Execuție pe server fără agent",
    unattendedExecutionHelp: "Rulează pe server fără nicio salvare a agentului, inclusiv în modul Batch. Nu este necesară deschiderea fișei Mission sau o salvare Batch ulterioară.",
    unattendedAcknowledgement: "Înțeleg că execuția fără agent poate rula acțiunile listate fără salvarea agentului, inclusiv în modul Batch.",
    backgroundStart: "Modificările în fundal sunt evaluate în Mission, chiar și fără o fișă deschisă. Nu există reluare istorică; prima valoare de bază este inertă.",
    visibilitySeparate: "Vizibilitatea ascunsă controlează doar dacă agenții văd pasul; nu selectează, nu suspendă și nu schimbă declanșatorul.",
    activationBlock: "O acțiune fără proprietarul sau șablonul obligatoriu nu poate fi activată. Rezolvați problemele afișate înainte de activarea fluxului.",
    headingBlock: "Acesta este doar titlul întrebării principale. Nu poate avea declanșator automat sau flux propriu de confirmare; subîntrebările rămân separate.",
    dirty: "Modificări nesalvate ale declanșatorului",
    editorBlocked: "Salvați sau anulați mai întâi acțiunea editată. Declanșatorul este blocat cât timp există modificări nesalvate sau salvarea este în curs.",
  },
  it: {
    missionCard: "Apertura scheda contatto Mission",
    pulseOpen: "Apertura della Status List Nexus Pulse",
    backgroundChange: "Modifica in background sul server",
    agentConfirmation: "Conferma dell’agente",
    scopeAgent: "Si avvia solo quando un agente conferma questo passaggio.",
    scopeCard: "Si avvia quando viene aperta la scheda Mission del contatto; valuta le risposte correnti, senza riprodurre eventi storici.",
    scopePulse: "Si avvia quando viene aperta la Status List Nexus Pulse per questo contatto.",
    scopeBackground: "Valuta le modifiche reali lato server in Mission, anche senza una scheda contatto aperta. Non riproduce la cronologia; il primo stato osservato è una baseline inerte.",
    executionScope: "Dove vengono eseguite le azioni in background",
    missionExecution: "Esecuzione Mission",
    missionExecutionHelp: "Mantiene il comportamento Mission Immediate e Batch. In modalità Batch, le azioni attendono il salvataggio Batch effettivo dell’agente.",
    unattendedExecution: "Esecuzione server senza agente",
    unattendedExecutionHelp: "Si avvia sul server senza alcun salvataggio dell’agente, anche in modalità Batch. Non serve aprire una scheda Mission né eseguire un successivo salvataggio Batch.",
    unattendedAcknowledgement: "Comprendo che l’esecuzione senza agente può avviare le azioni elencate senza un salvataggio dell’agente, anche in modalità Batch.",
    backgroundStart: "Le modifiche in background vengono valutate in Mission anche senza una scheda aperta. Nessuna riproduzione storica; la prima baseline è inerte.",
    visibilitySeparate: "La visibilità nascosta controlla solo se gli agenti vedono il passaggio; non seleziona, sospende o modifica il trigger.",
    activationBlock: "Un’azione senza il proprietario o il modello richiesto non può essere attivata. Risolvi i problemi elencati prima di abilitare il workflow.",
    headingBlock: "Questa è solo l’intestazione della domanda principale. Non può avere un trigger automatico o un workflow di conferma proprio; le sotto-domande restano separate.",
    dirty: "Modifiche al trigger non salvate",
    editorBlocked: "Salva o annulla prima l'azione in modifica. Il trigger è bloccato finché ci sono modifiche non salvate o un salvataggio in corso.",
  },
  de: {
    missionCard: "Öffnen der Mission-Kontaktkarte",
    pulseOpen: "Öffnen der Nexus Pulse Status List",
    backgroundChange: "Serverseitige Hintergrundänderung",
    agentConfirmation: "Agentenbestätigung",
    scopeAgent: "Wird nur ausgeführt, wenn ein Agent diesen Schritt bestätigt.",
    scopeCard: "Wird beim Öffnen der Mission-Karte dieses Kontakts ausgeführt; wertet aktuelle Antworten aus und spielt keine historischen Ereignisse erneut ab.",
    scopePulse: "Wird ausgeführt, wenn die Nexus Pulse Status List für diesen Kontakt geöffnet wird.",
    scopeBackground: "Wertet echte Änderungen serverseitig über Mission hinweg aus, auch wenn keine Kontaktkarte geöffnet ist. Keine historische Wiedergabe; der erste beobachtete Stand ist eine wirkungslose Baseline.",
    executionScope: "Ausführungsort der Hintergrundaktionen",
    missionExecution: "Mission-Ausführung",
    missionExecutionHelp: "Behält das Verhalten von Mission Immediate und Batch bei. Im Batch-Modus warten Aktionen auf das tatsächliche Batch-Speichern durch den Agenten.",
    unattendedExecution: "Unbeaufsichtigte Serverausführung",
    unattendedExecutionHelp: "Läuft serverseitig ohne Agentenspeicherung, auch im Batch-Modus. Weder das Öffnen einer Mission-Karte noch ein späteres Batch-Speichern ist erforderlich.",
    unattendedAcknowledgement: "Ich verstehe, dass die unbeaufsichtigte Ausführung die aufgeführten Aktionen auch im Batch-Modus ohne Agentenspeicherung starten kann.",
    backgroundStart: "Hintergrundänderungen werden über Mission hinweg ausgewertet, auch ohne geöffnete Karte. Keine historische Wiedergabe; die erste Baseline bleibt wirkungslos.",
    visibilitySeparate: "Die verborgene Sichtbarkeit steuert nur, ob Agents den Schritt sehen; sie wählt, pausiert oder ändert den Auslöser nicht.",
    activationBlock: "Eine Aktion ohne erforderlichen Owner oder Vorlage kann nicht aktiviert werden. Beheben Sie die aufgeführten Probleme, bevor Sie den Workflow einschalten.",
    headingBlock: "Dies ist nur die Überschrift einer Hauptfrage. Sie kann keinen eigenen automatischen Auslöser oder Agentenbestätigungs-Workflow haben; Unterfragen bleiben separat.",
    dirty: "Ungespeicherte Auslöseränderungen",
    editorBlocked: "Zuerst die bearbeitete Aktion speichern oder verwerfen. Bei ungespeicherten Änderungen oder während des Speicherns ist der Auslöser gesperrt.",
  },
};

export function getStatusListTriggerScopeCopy(locale: string): StatusListTriggerScopeCopy {
  const language = (locale || "en").toLowerCase().split(/[-_]/)[0];
  return dictionaries[language] || dictionaries.en;
}
