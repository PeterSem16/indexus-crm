export type StatusListBehaviorCopy = {
  roleLabel: string;
  roleHelp: string;
  infoTitle: string;
  infoDescription: string;
  confirmedTitle: string;
  confirmedDescription: string;
  autoTitle: string;
  autoDescription: string;
  infoContext: string;
  confirmedContext: string;
  autoContext: string;
  noOwnActions: string;
  previewActions: string;
  previewActionsHelp: string;
  noteEnabled: string;
  notesHistory: string;
  batchRecapTitle: string;
  batchRecapDescription: string;
  previewRecapTitle: string;
  previewRecapDescription: string;
};

const dictionaries: Record<string, StatusListBehaviorCopy> = {
  en: {
    roleLabel: "What is this step for?",
    roleHelp: "Choose the step’s role. Hidden steps and automatic steps are different: hidden steps are manually omitted; automatic steps are evaluated by the system.",
    infoTitle: "Main question / heading only",
    infoDescription: "Visible context for its interactive child questions. No confirmation or actions on this heading.",
    confirmedTitle: "Agent confirms this step",
    confirmedDescription: "The agent answers or confirms this step directly.",
    autoTitle: "Automatic",
    autoDescription: "The system evaluates this step; it is not a manual confirmation.",
    infoContext: "This is a visible heading only. It has no own confirmation, required answer, auto-confirm control, or actions. Its child questions remain interactive.",
    confirmedContext: "An agent completes this step directly. Its confirmation and configured actions remain available.",
    autoContext: "Automatic means system-evaluated, not manually hidden. Configure its source and any actions separately; this setting does not choose a trigger.",
    noOwnActions: "This heading has no own actions. Existing stored rules are retained; its child questions remain independently configurable.",
    previewActions: "Preview evaluated actions before confirmation",
    previewActionsHelp: "When enabled, show the real evaluated actions in a read-only recap before confirmation. Cancel does not change or apply anything.",
    noteEnabled: "Allow agent notes",
    notesHistory: "Turning notes off hides the note input for future work. Existing historical notes are kept.",
    batchRecapTitle: "Batch recap",
    batchRecapDescription: "Show the evaluated recap before the actual Batch save. The recap is informational; save remains a separate action.",
    previewRecapTitle: "Action recap",
    previewRecapDescription: "Read-only evaluated actions shown before confirmation. Cancel leaves the record unchanged.",
  },
  sk: {
    roleLabel: "Na čo slúži tento krok?",
    roleHelp: "Vyberte úlohu kroku. Skrytý krok a automatický krok nie sú to isté: skrytý krok sa manuálne nezobrazuje, automatický vyhodnocuje systém.",
    infoTitle: "Hlavná otázka / iba nadpis",
    infoDescription: "Viditeľný kontext pre interaktívne podotázky. Nadpis nemá vlastné potvrdenie ani akcie.",
    confirmedTitle: "Krok potvrdzuje agent",
    confirmedDescription: "Agent na tento krok priamo odpovedá alebo ho potvrdzuje.",
    autoTitle: "Automaticky",
    autoDescription: "Krok vyhodnocuje systém; nejde o manuálne potvrdenie.",
    infoContext: "Ide iba o viditeľný nadpis. Nemá vlastné potvrdenie, povinnú odpoveď, automatické potvrdenie ani akcie. Podotázky zostávajú interaktívne.",
    confirmedContext: "Agent dokončí tento krok priamo. Jeho potvrdenie a nastavené akcie zostávajú dostupné.",
    autoContext: "Automatický znamená, že krok vyhodnocuje systém; nejde o manuálne skrytý krok. Zdroj a akcie nastavte samostatne; toto nastavenie nevyberá spúšťač.",
    noOwnActions: "Tento nadpis nemá vlastné akcie. Uložené pravidlá zostávajú zachované; podotázky sa nastavujú samostatne.",
    previewActions: "Zobraziť vyhodnotené akcie pred potvrdením",
    previewActionsHelp: "Po zapnutí sa pred potvrdením zobrazí skutočný vyhodnotený prehľad iba na čítanie. Zrušenie nič nemení ani nevykoná.",
    noteEnabled: "Povoliť poznámky agenta",
    notesHistory: "Vypnutím sa skryje pole na poznámky pre ďalšiu prácu. Existujúce historické poznámky zostanú zachované.",
    batchRecapTitle: "Prehľad dávky",
    batchRecapDescription: "Vyhodnotený prehľad sa zobrazí pred samotným uložením dávky. Je iba informatívny; uloženie je samostatná akcia.",
    previewRecapTitle: "Prehľad akcií",
    previewRecapDescription: "Vyhodnotené akcie iba na čítanie pred potvrdením. Zrušenie ponechá záznam nezmenený.",
  },
  cs: {
    roleLabel: "K čemu tento krok slouží?",
    roleHelp: "Zvolte roli kroku. Skrytý a automatický krok se liší: skrytý krok je ručně vynechán, automatický vyhodnocuje systém.",
    infoTitle: "Hlavní otázka / pouze nadpis",
    infoDescription: "Viditelný kontext pro interaktivní podotázky. Nadpis nemá vlastní potvrzení ani akce.",
    confirmedTitle: "Krok potvrzuje agent",
    confirmedDescription: "Agent na tento krok přímo odpovídá nebo jej potvrzuje.",
    autoTitle: "Automaticky",
    autoDescription: "Krok vyhodnocuje systém; nejde o ruční potvrzení.",
    infoContext: "Jde pouze o viditelný nadpis. Nemá vlastní potvrzení, povinnou odpověď, automatické potvrzení ani akce. Podotázky zůstávají interaktivní.",
    confirmedContext: "Agent tento krok dokončí přímo. Jeho potvrzení a nastavené akce zůstávají dostupné.",
    autoContext: "Automatický znamená, že krok vyhodnocuje systém; nejde o ručně skrytý krok. Zdroj a akce nastavte zvlášť; toto nastavení nevybírá spouštěč.",
    noOwnActions: "Tento nadpis nemá vlastní akce. Uložená pravidla zůstávají zachována; podotázky se nastavují samostatně.",
    previewActions: "Zobrazit vyhodnocené akce před potvrzením",
    previewActionsHelp: "Po zapnutí se před potvrzením zobrazí skutečný vyhodnocený přehled pouze pro čtení. Zrušení nic nezmění ani nespustí.",
    noteEnabled: "Povolit poznámky agenta",
    notesHistory: "Vypnutím se skryje pole pro poznámky do budoucna. Stávající historické poznámky zůstanou zachovány.",
    batchRecapTitle: "Přehled dávky",
    batchRecapDescription: "Vyhodnocený přehled se zobrazí před skutečným uložením dávky. Je informativní; uložení je samostatná akce.",
    previewRecapTitle: "Přehled akcí",
    previewRecapDescription: "Vyhodnocené akce pouze pro čtení před potvrzením. Zrušení ponechá záznam beze změny.",
  },
  hu: {
    roleLabel: "Mi a lépés szerepe?",
    roleHelp: "Válassza ki a lépés szerepét. A rejtett és az automatikus lépés különbözik: a rejtett lépés kézzel marad ki, az automatikusat a rendszer értékeli ki.",
    infoTitle: "Főkérdés / csak címsor",
    infoDescription: "Látható kontextus az interaktív al-kérdésekhez. A címsornak nincs saját megerősítése vagy művelete.",
    confirmedTitle: "Az ügynök erősíti meg",
    confirmedDescription: "Az ügynök közvetlenül válaszol erre a lépésre vagy erősíti meg azt.",
    autoTitle: "Automatikus",
    autoDescription: "A lépést a rendszer értékeli ki; ez nem kézi megerősítés.",
    infoContext: "Ez kizárólag látható címsor. Nincs saját megerősítése, kötelező válasza, automatikus megerősítési vezérlője vagy művelete. Az al-kérdések interaktívak maradnak.",
    confirmedContext: "Az ügynök közvetlenül végzi el ezt a lépést. A megerősítés és a beállított műveletek elérhetők maradnak.",
    autoContext: "Az automatikus lépést a rendszer értékeli ki, nem kézzel rejti el. A forrást és a műveleteket külön állítsa be; ez a beállítás nem választ ki aktiválót.",
    noOwnActions: "Ennek a címsornak nincsenek saját műveletei. A mentett szabályok megmaradnak; az al-kérdések külön állíthatók be.",
    previewActions: "Kiértékelt műveletek előnézete megerősítés előtt",
    previewActionsHelp: "Bekapcsolva megerősítés előtt a ténylegesen kiértékelt műveletek csak olvasható összegzése jelenik meg. A Mégse nem módosít és nem hajt végre semmit.",
    noteEnabled: "Ügynöki jegyzetek engedélyezése",
    notesHistory: "Kikapcsoláskor a jövőbeli jegyzetmező rejtve marad. A korábbi jegyzetek megőrződnek.",
    batchRecapTitle: "Kötegelt összegzés",
    batchRecapDescription: "A kiértékelt összegzés a tényleges kötegelt mentés előtt jelenik meg. Tájékoztató jellegű; a mentés külön művelet.",
    previewRecapTitle: "Műveletek összegzése",
    previewRecapDescription: "Csak olvasható, kiértékelt műveletek megerősítés előtt. A Mégse változatlanul hagyja a rekordot.",
  },
  ro: {
    roleLabel: "Care este rolul acestui pas?",
    roleHelp: "Alegeți rolul pasului. Un pas ascuns diferă de unul automat: pasul ascuns este omis manual, iar cel automat este evaluat de sistem.",
    infoTitle: "Întrebare principală / doar titlu",
    infoDescription: "Context vizibil pentru subîntrebările interactive. Titlul nu are confirmare sau acțiuni proprii.",
    confirmedTitle: "Agentul confirmă pasul",
    confirmedDescription: "Agentul răspunde direct la acest pas sau îl confirmă.",
    autoTitle: "Automat",
    autoDescription: "Sistemul evaluează pasul; nu este o confirmare manuală.",
    infoContext: "Acesta este doar un titlu vizibil. Nu are confirmare proprie, răspuns obligatoriu, control de confirmare automată sau acțiuni proprii. Subîntrebările rămân interactive.",
    confirmedContext: "Agentul finalizează direct acest pas. Confirmarea și acțiunile configurate rămân disponibile.",
    autoContext: "Automat înseamnă evaluat de sistem, nu ascuns manual. Configurați separat sursa și acțiunile; această setare nu alege un declanșator.",
    noOwnActions: "Acest titlu nu are acțiuni proprii. Regulile salvate sunt păstrate; subîntrebările se configurează separat.",
    previewActions: "Previzualizează acțiunile evaluate înainte de confirmare",
    previewActionsHelp: "Dacă este activată, înainte de confirmare apare un rezumat real, evaluat, doar pentru citire. Anulare nu modifică și nu aplică nimic.",
    noteEnabled: "Permite notele agentului",
    notesHistory: "Dezactivarea ascunde câmpul de notițe pentru lucrul viitor. Notele istorice existente sunt păstrate.",
    batchRecapTitle: "Rezumatul lotului",
    batchRecapDescription: "Rezumatul evaluat apare înainte de salvarea efectivă a lotului. Este informativ; salvarea rămâne o acțiune separată.",
    previewRecapTitle: "Rezumatul acțiunilor",
    previewRecapDescription: "Acțiuni evaluate, doar pentru citire, înainte de confirmare. Anulare lasă înregistrarea neschimbată.",
  },
  it: {
    roleLabel: "Qual è il ruolo di questo passaggio?",
    roleHelp: "Scegli il ruolo del passaggio. Nascosto e automatico sono diversi: il passaggio nascosto viene omesso manualmente, quello automatico viene valutato dal sistema.",
    infoTitle: "Domanda principale / solo intestazione",
    infoDescription: "Contesto visibile per le sotto-domande interattive. L’intestazione non ha conferme o azioni proprie.",
    confirmedTitle: "L’agente conferma il passaggio",
    confirmedDescription: "L’agente risponde direttamente a questo passaggio o lo conferma.",
    autoTitle: "Automatico",
    autoDescription: "Il sistema valuta il passaggio; non è una conferma manuale.",
    infoContext: "È solo un’intestazione visibile. Non ha conferma, risposta obbligatoria, controllo di conferma automatica o azioni proprie. Le sotto-domande restano interattive.",
    confirmedContext: "L’agente completa direttamente questo passaggio. La conferma e le azioni configurate restano disponibili.",
    autoContext: "Automatico significa valutato dal sistema, non nascosto manualmente. Configura separatamente origine e azioni; questa impostazione non sceglie un trigger.",
    noOwnActions: "Questa intestazione non ha azioni proprie. Le regole salvate vengono mantenute; le sotto-domande restano configurabili.",
    previewActions: "Mostra le azioni valutate prima della conferma",
    previewActionsHelp: "Se attivo, prima della conferma viene mostrato un riepilogo reale e valutato, in sola lettura. Annulla non modifica né applica nulla.",
    noteEnabled: "Consenti note dell’agente",
    notesHistory: "Disattivando l’opzione, il campo note sarà nascosto per il lavoro futuro. Le note storiche esistenti restano.",
    batchRecapTitle: "Riepilogo batch",
    batchRecapDescription: "Il riepilogo valutato appare prima del salvataggio batch effettivo. È informativo; il salvataggio è un’azione separata.",
    previewRecapTitle: "Riepilogo azioni",
    previewRecapDescription: "Azioni valutate in sola lettura prima della conferma. Annulla lascia invariato il record.",
  },
  de: {
    roleLabel: "Welche Aufgabe hat dieser Schritt?",
    roleHelp: "Wählen Sie die Rolle des Schritts. Verborgen und automatisch sind verschieden: Ein verborgener Schritt wird manuell ausgelassen, ein automatischer vom System ausgewertet.",
    infoTitle: "Hauptfrage / nur Überschrift",
    infoDescription: "Sichtbarer Kontext für interaktive Unterfragen. Die Überschrift hat keine eigene Bestätigung oder Aktionen.",
    confirmedTitle: "Agent bestätigt diesen Schritt",
    confirmedDescription: "Der Agent beantwortet oder bestätigt diesen Schritt direkt.",
    autoTitle: "Automatisch",
    autoDescription: "Das System wertet diesen Schritt aus; es ist keine manuelle Bestätigung.",
    infoContext: "Dies ist nur eine sichtbare Überschrift. Sie hat keine eigene Bestätigung, Pflichtantwort, automatische Bestätigung oder Aktionen. Unterfragen bleiben interaktiv.",
    confirmedContext: "Der Agent schließt diesen Schritt direkt ab. Bestätigung und konfigurierte Aktionen bleiben verfügbar.",
    autoContext: "Automatisch bedeutet systemseitig ausgewertet, nicht manuell verborgen. Quelle und Aktionen separat konfigurieren; diese Einstellung wählt keinen Auslöser.",
    noOwnActions: "Diese Überschrift hat keine eigenen Aktionen. Gespeicherte Regeln bleiben erhalten; Unterfragen lassen sich separat konfigurieren.",
    previewActions: "Ausgewertete Aktionen vor der Bestätigung anzeigen",
    previewActionsHelp: "Wenn aktiviert, wird vor der Bestätigung eine echte, ausgewertete und schreibgeschützte Zusammenfassung angezeigt. Abbrechen ändert oder startet nichts.",
    noteEnabled: "Agentennotizen erlauben",
    notesHistory: "Beim Deaktivieren wird das Notizfeld künftig ausgeblendet. Vorhandene historische Notizen bleiben erhalten.",
    batchRecapTitle: "Batch-Zusammenfassung",
    batchRecapDescription: "Die ausgewertete Zusammenfassung erscheint vor dem tatsächlichen Batch-Speichern. Sie ist informativ; Speichern bleibt eine separate Aktion.",
    previewRecapTitle: "Aktionsübersicht",
    previewRecapDescription: "Schreibgeschützte, ausgewertete Aktionen vor der Bestätigung. Abbrechen lässt den Datensatz unverändert.",
  },
};

export function getStatusListBehaviorCopy(locale: string): StatusListBehaviorCopy {
  const language = (locale || "en").toLowerCase().split(/[-_]/)[0];
  return dictionaries[language] || dictionaries.en;
}
