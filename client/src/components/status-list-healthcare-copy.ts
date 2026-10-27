import type { HealthcareState } from "@shared/status-list-healthcare";

type Copy = {
  title: string; create: string; sourceHelp: string; summary: string; loading: string; error: string; retryAction: string;
  save: string; cancel: string; edit: string; manual: string; substatus: string; proposed: string;
  voicemail: string; attempts: string; alternative: string; taskHelp: string; reviewTitle: string;
  confirm: string; retry: string; batchHelp: string; use: string; configure: string; paused: string; held: string;
  allOff: string; threshold: string; talkTime: string; invalidNumber: string; saved: string; unsaved: string; saving: string;
  disabledBehavior: string; dirtyWarning: string; triggerEffect: string; resetCounter: string; resetTitle: string; resetHelp: string;
  resetReason: string; resetConfirm: string; resetMin: string; resetSuccess: string; resetExplanation: string;
  counterSubstatus: string;
  states: Record<HealthcareState, string>;
  descriptions: Record<HealthcareState, string>;
  substatuses: Record<string, string>;
};

const languages: Record<string, Omit<Copy, "states" | "descriptions" | "substatuses"> & {
  stateNames: string[]; descriptionsList: string[]; substatusNames: string[];
}> = {
  en: {
    title:"Healthcare provider reachability",create:"Create seven-answer question",
    sourceHelp:"Evaluate provider reachability from call outcomes. Configure each state and its actions independently.",
    summary:"The source tracks whether a healthcare provider can be reached and keeps the last enabled state when a result is disabled.",
    loading:"Loading…",error:"Could not save or refresh. Reopen and try again.",retryAction:"Retry",save:"Save",cancel:"Cancel",edit:"Review status",
    manual:"Automatic evaluation",substatus:"Unreachable detail",proposed:"Proposed new contact (original is unchanged)",
    voicemail:"Mark latest connected call as voicemail",attempts:"Failed attempts",alternative:"Another phone number is available",
    taskHelp:"Configure database-administrator recipients in Create task. For Unreachable / Not working, tasks run only if no alternative number exists.",
    reviewTitle:"Actions awaiting review",confirm:"Confirm this action",
    retry:"Initial callback default: six business days at 09:00; an existing callback is kept. A coordinator can reschedule it in Queue.",
    batchHelp:"In Batch mode, confirmed actions wait until the Status List is saved.",
    use:"Use",configure:"Configure actions",paused:"Paused — this source is not evaluating states or running its actions.",held:"Disabled outcome; last enabled state retained.",
    allOff:"All states are off. This pauses the source; no healthcare state is evaluated and no source actions run.",
    threshold:"Failed calls before Unreachable",talkTime:"Minimum connected talk time (seconds)",invalidNumber:"Enter a whole number within the displayed range.",saved:"Settings saved.",
    unsaved:"Unsaved changes",saving:"Saving…",disabledBehavior:"A disabled state is not evaluated and its actions do not run; the last enabled state is retained.",dirtyWarning:"You have unsaved healthcare settings. Save or cancel before leaving.",
    triggerEffect:"Trigger and effect",resetCounter:"Reset counter",resetTitle:"Reset failed-attempt counter?",
    resetHelp:"This clears the recorded failed-attempt count for this provider. The server checks the current record before applying it.",
    resetReason:"Reason for reset",resetConfirm:"Reset counter",resetMin:"Enter a reason of at least 3 characters.",
    resetSuccess:"Failed-attempt counter reset.",resetExplanation:"Counters reset automatically after a successful non-voicemail connection with a doctor or other personnel, or when the actual phone number is corrected. Long-term absence does not reset it.",
    counterSubstatus:"{count} failed attempts",
    stateNames:["Not defined yet","Unreached","Unreachable","Reachable","Wrong number","Not working","Long-term absent"],
    descriptionsList:[
      "No qualifying call outcome has established a state yet. This is the neutral baseline and runs no state action.",
      "A call attempt did not reach a conversation, but the configured Unreachable threshold has not been met. The state updates and its configured actions may run.",
      "The configured number of consecutive failed attempts has been reached. Its configured actions may run; an available alternative number can affect task execution.",
      "A non-voicemail call connected for at least the configured talk-time minimum. Its configured actions may run.",
      "An agent or verified update identifies the saved number as incorrect. The state is retained until a qualifying correction or later evaluation.",
      "The saved number is not working. Configured actions may run; tasks are conditional on there being no alternative phone number.",
      "The doctor is absent long-term. This state does not reset the failed-attempt counter."
    ],
    substatusNames:["Practice closed / not operating","Doctor left","Contact not found","Failed attempts"]
  },
  sk: {
    title:"Dosiahnuteľnosť poskytovateľa",create:"Vytvoriť otázku so 7 odpoveďami",
    sourceHelp:"Vyhodnocuje dosiahnuteľnosť podľa výsledkov hovorov. Každý stav a jeho akcie nastavte samostatne.",
    summary:"Zdroj sleduje, či je poskytovateľ dosiahnuteľný. Pri vypnutom výsledku ponechá posledný povolený stav.",
    loading:"Načítavam…",error:"Uloženie alebo obnovenie zlyhalo. Znovu otvorte a skúste opäť.",retryAction:"Skúsiť znova",save:"Uložiť",cancel:"Zrušiť",edit:"Skontrolovať stav",
    manual:"Automatické vyhodnocovanie",substatus:"Podrobnosť nedostupnosti",proposed:"Navrhnutý nový kontakt (pôvodný sa nemení)",
    voicemail:"Označiť posledný spojený hovor ako odkazovač",attempts:"Neúspešné pokusy",alternative:"Je k dispozícii iné telefónne číslo",
    taskHelp:"Príjemcu pre správu databázy nastavte v akcii Vytvoriť úlohu. Pri Unreachable / Not working sa úloha vykoná iba bez iného čísla.",
    reviewTitle:"Akcie čakajúce na kontrolu",confirm:"Potvrdiť túto akciu",
    retry:"Východiskový callback: o šesť pracovných dní o 09:00; existujúci callback zostáva. Koordinátor ho môže zmeniť v Queue.",
    batchHelp:"V režime Batch potvrdené akcie čakajú na uloženie Status Listu.",
    use:"Použiť",configure:"Nastaviť akcie",paused:"Pozastavené — zdroj nevyhodnocuje stavy ani nespúšťa ich akcie.",held:"Vypnutý výsledok; zachoval sa posledný povolený stav.",
    allOff:"Všetky stavy sú vypnuté. Zdroj je pozastavený; žiadny zdravotnícky stav sa nevyhodnocuje a akcie sa nespúšťajú.",
    threshold:"Počet neúspešných hovorov pre Unreachable",talkTime:"Minimálny čas hovoru po spojení (sekundy)",invalidNumber:"Zadajte celé číslo v uvedenom rozsahu.",saved:"Nastavenia uložené.",
    unsaved:"Neuložené zmeny",saving:"Ukladám…",disabledBehavior:"Vypnutý stav sa nevyhodnocuje a jeho akcie sa nespúšťajú; zachová sa posledný povolený stav.",dirtyWarning:"Máte neuložené nastavenia. Pred odchodom ich uložte alebo zrušte.",
    triggerEffect:"Spúšťač a účinok",resetCounter:"Vynulovať počítadlo",resetTitle:"Vynulovať počítadlo neúspešných pokusov?",
    resetHelp:"Vymaže zaznamenaný počet neúspešných pokusov. Server pred zmenou overí aktuálny záznam.",
    resetReason:"Dôvod vynulovania",resetConfirm:"Vynulovať počítadlo",resetMin:"Zadajte dôvod s dĺžkou aspoň 3 znaky.",
    resetSuccess:"Počítadlo neúspešných pokusov bolo vynulované.",resetExplanation:"Počítadlo sa automaticky vynuluje po úspešnom spojení bez odkazovača s lekárom alebo iným personálom, prípadne po oprave skutočného telefónneho čísla. Dlhodobá neprítomnosť ho nevynuluje.",
    counterSubstatus:"{count} neúspešných pokusov",
    stateNames:["Zatiaľ neurčené","Nezastihnutý","Nedostupný","Dostupný","Nesprávne číslo","Nefunkčné číslo","Dlhodobo neprítomný"],
    descriptionsList:[
      "Zatiaľ nebol zaznamenaný výsledok hovoru, ktorý určuje stav. Ide o neutrálny základ bez akcie.",
      "Hovor neviedol k rozhovoru, ale ešte nebol dosiahnutý limit stavu Unreachable. Stav a jeho nastavené akcie sa môžu aktualizovať.",
      "Bol dosiahnutý nastavený počet po sebe idúcich neúspešných pokusov. Nastavené akcie sa môžu spustiť; alternatívne číslo môže ovplyvniť úlohy.",
      "Hovor bez odkazovača bol spojený aspoň na nastavený minimálny čas. Nastavené akcie sa môžu spustiť.",
      "Agent alebo overená aktualizácia označila uložené číslo za nesprávne. Stav zostáva do opravy alebo ďalšieho vyhodnotenia.",
      "Uložené číslo nefunguje. Úlohy sa vykonajú iba vtedy, ak nie je k dispozícii iné telefónne číslo.",
      "Lekár je dlhodobo neprítomný. Tento stav nevynuluje počítadlo neúspešných pokusov."
    ],substatusNames:["Ambulancia zrušená / mimo prevádzky","Lekár odišiel","Kontakt nedohľadaný","Neúspešné pokusy"]
  },
  cs: {
    title:"Dosažitelnost poskytovatele",create:"Vytvořit otázku se 7 odpověďmi",
    sourceHelp:"Vyhodnocuje dosažitelnost podle výsledků hovorů. Každý stav a jeho akce nastavte samostatně.",
    summary:"Zdroj sleduje dosažitelnost poskytovatele. U vypnutého výsledku zachová poslední povolený stav.",
    loading:"Načítám…",error:"Uložení nebo obnovení selhalo. Otevřete znovu a opakujte.",retryAction:"Zkusit znovu",save:"Uložit",cancel:"Zrušit",edit:"Zkontrolovat stav",
    manual:"Automatické vyhodnocování",substatus:"Podrobnost nedostupnosti",proposed:"Navržený nový kontakt (původní se nemění)",
    voicemail:"Označit poslední spojený hovor jako záznamník",attempts:"Neúspěšné pokusy",alternative:"Je dostupné jiné telefonní číslo",
    taskHelp:"Příjemce správy databáze nastavte v akci Vytvořit úkol. U Unreachable / Not working se úkol provede pouze bez jiného čísla.",
    reviewTitle:"Akce čekající na kontrolu",confirm:"Potvrdit tuto akci",
    retry:"Výchozí callback: za šest pracovních dnů v 09:00; stávající callback zůstane. Koordinátor jej může změnit v Queue.",
    batchHelp:"V režimu Batch potvrzené akce čekají na uložení Status Listu.",
    use:"Použít",configure:"Nastavit akce",paused:"Pozastaveno — zdroj nevyhodnocuje stavy ani nespouští jejich akce.",held:"Vypnutý výsledek; zachoval se poslední povolený stav.",
    allOff:"Všechny stavy jsou vypnuté. Zdroj je pozastaven; žádný zdravotní stav se nevyhodnocuje a akce se nespouštějí.",
    threshold:"Počet neúspěšných hovorů pro Unreachable",talkTime:"Minimální doba spojeného hovoru (sekundy)",invalidNumber:"Zadejte celé číslo v uvedeném rozsahu.",saved:"Nastavení uloženo.",
    unsaved:"Neuložené změny",saving:"Ukládání…",disabledBehavior:"Vypnutý stav se nevyhodnocuje a jeho akce se nespouštějí; zachová se poslední povolený stav.",dirtyWarning:"Máte neuložená nastavení. Před odchodem je uložte nebo zrušte.",
    triggerEffect:"Spouštěč a účinek",resetCounter:"Vynulovat počítadlo",resetTitle:"Vynulovat počítadlo neúspěšných pokusů?",
    resetHelp:"Vymaže zaznamenaný počet neúspěšných pokusů. Server před změnou ověří aktuální záznam.",
    resetReason:"Důvod vynulování",resetConfirm:"Vynulovat počítadlo",resetMin:"Zadejte důvod o délce alespoň 3 znaků.",
    resetSuccess:"Počítadlo neúspěšných pokusů bylo vynulováno.",resetExplanation:"Počítadlo se automaticky vynuluje po úspěšném spojení bez záznamníku s lékařem či personálem nebo po opravě skutečného telefonního čísla. Dlouhodobá nepřítomnost jej nevynuluje.",
    counterSubstatus:"{count} neúspěšných pokusů",
    stateNames:["Zatím neurčeno","Nezastižen","Nedostupný","Dostupný","Nesprávné číslo","Nefunkční číslo","Dlouhodobě nepřítomný"],
    descriptionsList:[
      "Zatím nebyl zaznamenán výsledek hovoru určující stav. Jde o neutrální základ bez akce.",
      "Hovor nevedl k rozhovoru, ale limit stavu Unreachable ještě nebyl dosažen. Stav a nastavené akce se mohou aktualizovat.",
      "Byl dosažen nastavený počet po sobě jdoucích neúspěšných pokusů. Nastavené akce se mohou spustit; jiné číslo může ovlivnit úkoly.",
      "Hovor bez záznamníku byl spojen alespoň na nastavenou minimální dobu. Nastavené akce se mohou spustit.",
      "Agent nebo ověřená aktualizace označila uložené číslo za nesprávné. Stav zůstává do opravy nebo dalšího vyhodnocení.",
      "Uložené číslo nefunguje. Úkoly se provedou pouze tehdy, pokud není k dispozici jiné číslo.",
      "Lékař je dlouhodobě nepřítomen. Tento stav nevynuluje počítadlo neúspěšných pokusů."
    ],substatusNames:["Ordinace zrušena / mimo provoz","Lékař odešel","Kontakt nedohledán","Neúspěšné pokusy"]
  },
  hu: {
    title:"Szolgáltató elérhetősége",create:"Hétválaszos kérdés létrehozása",
    sourceHelp:"A hívások eredménye alapján értékeli az elérhetőséget. Minden állapotot és műveletet külön állítson be.",
    summary:"A forrás a szolgáltató elérhetőségét követi. Letiltott eredménynél megtartja az utolsó engedélyezett állapotot.",
    loading:"Betöltés…",error:"A mentés vagy frissítés sikertelen. Nyissa meg újra.",retryAction:"Újrapróbálás",save:"Mentés",cancel:"Mégse",edit:"Állapot ellenőrzése",
    manual:"Automatikus értékelés",substatus:"Nem elérhető részlete",proposed:"Javasolt új kapcsolat (az eredeti nem változik)",
    voicemail:"Utolsó kapcsolt hívás jelölése hangpostaként",attempts:"Sikertelen kísérletek",alternative:"Másik telefonszám is elérhető",
    taskHelp:"Az adatbázis-kezelő címzettjét a Feladat létrehozása műveletben adja meg. Nem elérhető / Nem működik esetén csak másik szám hiányában fut.",
    reviewTitle:"Ellenőrzésre váró műveletek",confirm:"Művelet jóváhagyása",
    retry:"Kezdeti visszahívási alapérték: hat munkanap múlva 09:00-kor; a meglévő visszahívás megmarad. A koordinátor a Queue-ban módosíthatja.",
    batchHelp:"Batch módban a jóváhagyott műveletek a Status List mentésére várnak.",
    use:"Használat",configure:"Műveletek beállítása",paused:"Szünetel — a forrás nem értékeli az állapotokat és nem futtat műveleteket.",held:"Letiltott eredmény; megmarad az utolsó engedélyezett állapot.",
    allOff:"Minden állapot ki van kapcsolva. A forrás szünetel; nincs értékelés és műveletfuttatás.",
    threshold:"Sikertelen hívások száma a Nem elérhető állapothoz",talkTime:"Minimális kapcsolt beszélgetési idő (másodperc)",invalidNumber:"A megadott tartományon belüli egész számot adjon meg.",saved:"Beállítások mentve.",
    unsaved:"Nem mentett módosítások",saving:"Mentés…",disabledBehavior:"A kikapcsolt állapotot a rendszer nem értékeli, és műveletei sem futnak; az utolsó engedélyezett állapot marad meg.",dirtyWarning:"Nem mentett beállításai vannak. Kilépés előtt mentse vagy vonja vissza őket.",
    triggerEffect:"Kiváltó ok és hatás",resetCounter:"Számláló visszaállítása",resetTitle:"Visszaállítja a sikertelen kísérletek számlálóját?",
    resetHelp:"Törli a rögzített sikertelen kísérletek számát. A szerver alkalmazás előtt ellenőrzi az aktuális rekordot.",
    resetReason:"Visszaállítás oka",resetConfirm:"Számláló visszaállítása",resetMin:"Legalább 3 karakteres indoklást adjon meg.",
    resetSuccess:"A sikertelen kísérletek számlálója visszaállt.",resetExplanation:"A számláló automatikusan visszaáll orvossal vagy más személyzettel létrejött, nem hangpostás sikeres kapcsolat után, illetve a tényleges telefonszám javításakor. A tartós távollét nem állítja vissza.",
    counterSubstatus:"{count} sikertelen kísérlet",
    stateNames:["Még nincs meghatározva","Nem sikerült elérni","Nem elérhető","Elérhető","Téves szám","Nem működő szám","Tartósan távol"],
    descriptionsList:[
      "Még nincs állapotot meghatározó híváseredmény. Ez a semleges kiinduló állapot, művelet nélkül.",
      "A hívásból nem lett beszélgetés, de a Nem elérhető küszöb még nem teljesült. Az állapot és beállított műveletei frissülhetnek.",
      "Elérte a beállított egymást követő sikertelen kísérletek számát. A műveletek lefuthatnak; másik szám módosíthatja a feladatokat.",
      "Nem hangpostás hívás kapcsolódott legalább a beállított minimális időre. A műveletek lefuthatnak.",
      "Ügynök vagy ellenőrzött frissítés hibásnak jelölte a mentett számot. Az állapot javításig vagy új értékelésig megmarad.",
      "A mentett szám nem működik. Feladat csak másik telefonszám hiányában fut.",
      "Az orvos tartósan távol van. Ez az állapot nem állítja vissza a sikertelen kísérletek számlálóját."
    ],substatusNames:["Rendelő megszűnt / nem működik","Orvos távozott","Kapcsolat nem található","Sikertelen kísérletek"]
  },
  ro: {
    title:"Accesibilitatea furnizorului",create:"Creează întrebarea cu 7 răspunsuri",
    sourceHelp:"Evaluează accesibilitatea pe baza rezultatelor apelurilor. Configurați separat fiecare stare și acțiunile ei.",
    summary:"Sursa urmărește dacă furnizorul poate fi contactat. Pentru un rezultat dezactivat păstrează ultima stare activată.",
    loading:"Se încarcă…",error:"Salvarea sau actualizarea a eșuat. Redeschideți și reîncercați.",retryAction:"Reîncearcă",save:"Salvează",cancel:"Anulează",edit:"Verifică starea",
    manual:"Evaluare automată",substatus:"Detaliu inaccesibil",proposed:"Contact nou propus (originalul nu se modifică)",
    voicemail:"Marchează ultimul apel conectat ca mesagerie vocală",attempts:"Încercări nereușite",alternative:"Este disponibil un alt număr",
    taskHelp:"Configurați destinatarul administratorului bazei de date în Creează sarcină. Pentru Inaccesibil / Nefuncțional, sarcina rulează doar fără alt număr.",
    reviewTitle:"Acțiuni în așteptarea verificării",confirm:"Confirmă această acțiune",
    retry:"Valoare inițială pentru reapelare: peste șase zile lucrătoare la 09:00; reapelarea existentă se păstrează. Coordonatorul o poate reprograma în Queue.",
    batchHelp:"În modul Batch, acțiunile confirmate așteaptă salvarea Status List.",
    use:"Folosește",configure:"Configurează acțiunile",paused:"În pauză — sursa nu evaluează stări și nu rulează acțiuni.",held:"Rezultat dezactivat; se păstrează ultima stare activată.",
    allOff:"Toate stările sunt dezactivate. Sursa este în pauză; nu evaluează stări și nu rulează acțiuni.",
    threshold:"Apeluri eșuate până la Inaccesibil",talkTime:"Durata minimă a conversației conectate (secunde)",invalidNumber:"Introduceți un număr întreg în intervalul afișat.",saved:"Setări salvate.",
    unsaved:"Modificări nesalvate",saving:"Se salvează…",disabledBehavior:"O stare dezactivată nu este evaluată și acțiunile ei nu rulează; se păstrează ultima stare activată.",dirtyWarning:"Aveți setări nesalvate. Salvați sau anulați înainte de a părăsi pagina.",
    triggerEffect:"Declanșator și efect",resetCounter:"Resetează contorul",resetTitle:"Resetați contorul încercărilor nereușite?",
    resetHelp:"Șterge numărul înregistrat de încercări nereușite. Serverul verifică înregistrarea curentă înainte de aplicare.",
    resetReason:"Motivul resetării",resetConfirm:"Resetează contorul",resetMin:"Introduceți un motiv de cel puțin 3 caractere.",
    resetSuccess:"Contorul încercărilor nereușite a fost resetat.",resetExplanation:"Contorul se resetează automat după o conexiune reușită fără mesagerie vocală cu medicul sau personalul, ori după corectarea numărului real de telefon. Absența pe termen lung nu îl resetează.",
    counterSubstatus:"{count} încercări nereușite",
    stateNames:["Încă nedefinit","Necontactat","Inaccesibil","Accesibil","Număr greșit","Număr nefuncțional","Absent pe termen lung"],
    descriptionsList:[
      "Nu există încă un rezultat de apel care să stabilească starea. Este baza neutră, fără acțiuni.",
      "Apelul nu a dus la o conversație, dar pragul Inaccesibil nu a fost atins. Starea și acțiunile configurate se pot actualiza.",
      "A fost atins numărul configurat de încercări eșuate consecutive. Acțiunile configurate pot rula; un număr alternativ poate afecta sarcinile.",
      "Un apel fără mesagerie vocală s-a conectat cel puțin cât durata minimă configurată. Acțiunile configurate pot rula.",
      "Un agent sau o actualizare verificată a identificat numărul salvat ca greșit. Starea rămâne până la corectare sau evaluare ulterioară.",
      "Numărul salvat nu funcționează. Sarcinile rulează numai dacă nu există alt număr disponibil.",
      "Medicul este absent pe termen lung. Această stare nu resetează contorul încercărilor nereușite."
    ],substatusNames:["Cabinet închis / nefuncțional","Medicul a plecat","Contact negăsit","Încercări nereușite"]
  },
  it: {
    title:"Raggiungibilità del fornitore",create:"Crea domanda con 7 risposte",
    sourceHelp:"Valuta la raggiungibilità dai risultati delle chiamate. Configura separatamente ogni stato e le relative azioni.",
    summary:"La fonte rileva se il fornitore è raggiungibile. Se un risultato è disattivato, conserva l’ultimo stato attivo.",
    loading:"Caricamento…",error:"Salvataggio o aggiornamento non riuscito. Riapri e riprova.",retryAction:"Riprova",save:"Salva",cancel:"Annulla",edit:"Controlla stato",
    manual:"Valutazione automatica",substatus:"Dettaglio Non raggiungibile",proposed:"Nuovo contatto proposto (originale invariato)",
    voicemail:"Segna l’ultima chiamata connessa come segreteria",attempts:"Tentativi falliti",alternative:"È disponibile un altro numero",
    taskHelp:"Imposta il destinatario della gestione database nell’azione Crea attività. Per Non raggiungibile / Non funzionante, l’attività parte solo senza altri numeri.",
    reviewTitle:"Azioni in attesa di controllo",confirm:"Conferma questa azione",
    retry:"Valore iniziale richiamata: tra sei giorni lavorativi alle 09:00; conserva la richiamata esistente. Il coordinatore può riprogrammarla in Queue.",
    batchHelp:"In modalità Batch le azioni confermate attendono il salvataggio della Status List.",
    use:"Usa",configure:"Configura azioni",paused:"In pausa — la fonte non valuta stati e non esegue azioni.",held:"Risultato disattivato; resta l’ultimo stato attivo.",
    allOff:"Tutti gli stati sono disattivati. La fonte è in pausa; non valuta stati né esegue azioni.",
    threshold:"Chiamate fallite prima di Non raggiungibile",talkTime:"Durata minima della conversazione connessa (secondi)",invalidNumber:"Inserisci un numero intero nell’intervallo visualizzato.",saved:"Impostazioni salvate.",
    unsaved:"Modifiche non salvate",saving:"Salvataggio…",disabledBehavior:"Uno stato disattivato non viene valutato e le sue azioni non partono; resta l’ultimo stato attivo.",dirtyWarning:"Hai impostazioni non salvate. Salva o annulla prima di uscire.",
    triggerEffect:"Trigger ed effetto",resetCounter:"Reimposta contatore",resetTitle:"Reimpostare il contatore dei tentativi falliti?",
    resetHelp:"Azzera il numero registrato di tentativi falliti. Il server verifica il record corrente prima di applicare la modifica.",
    resetReason:"Motivo della reimpostazione",resetConfirm:"Reimposta contatore",resetMin:"Inserisci un motivo di almeno 3 caratteri.",
    resetSuccess:"Contatore dei tentativi falliti reimpostato.",resetExplanation:"Il contatore si azzera automaticamente dopo una connessione riuscita senza segreteria con medico o personale, oppure quando viene corretto il numero telefonico effettivo. L’assenza a lungo termine non lo azzera.",
    counterSubstatus:"{count} tentativi falliti",
    stateNames:["Non ancora definito","Non contattato","Non raggiungibile","Raggiungibile","Numero errato","Numero non funzionante","Assente a lungo termine"],
    descriptionsList:[
      "Nessun esito di chiamata ha ancora determinato uno stato. È la base neutra senza azioni.",
      "Il tentativo non ha prodotto una conversazione, ma la soglia Non raggiungibile non è stata raggiunta. Stato e azioni configurate possono aggiornarsi.",
      "È stato raggiunto il numero configurato di tentativi falliti consecutivi. Le azioni configurate possono partire; un altro numero può influire sulle attività.",
      "Una chiamata senza segreteria si è connessa per almeno la durata minima configurata. Le azioni configurate possono partire.",
      "Un agente o un aggiornamento verificato ha identificato il numero salvato come errato. Lo stato resta fino alla correzione o a una valutazione successiva.",
      "Il numero salvato non funziona. Le attività partono solo se non sono disponibili altri numeri.",
      "Il medico è assente a lungo termine. Questo stato non azzera il contatore dei tentativi falliti."
    ],substatusNames:["Ambulatorio chiuso / non operativo","Medico trasferito","Contatto non trovato","Tentativi falliti"]
  },
  de: {
    title:"Erreichbarkeit des Leistungserbringers",create:"Frage mit 7 Antworten erstellen",
    sourceHelp:"Bewertet die Erreichbarkeit anhand der Anrufergebnisse. Richten Sie jeden Status und seine Aktionen einzeln ein.",
    summary:"Die Quelle erfasst, ob ein Leistungserbringer erreichbar ist. Bei deaktivierten Ergebnissen bleibt der letzte aktivierte Status erhalten.",
    loading:"Wird geladen…",error:"Speichern oder Aktualisieren fehlgeschlagen. Erneut öffnen und versuchen.",retryAction:"Erneut versuchen",save:"Speichern",cancel:"Abbrechen",edit:"Status prüfen",
    manual:"Automatische Auswertung",substatus:"Details zu Nicht erreichbar",proposed:"Vorgeschlagener neuer Kontakt (Original unverändert)",
    voicemail:"Letztes verbundenes Gespräch als Anrufbeantworter markieren",attempts:"Fehlversuche",alternative:"Eine andere Telefonnummer ist verfügbar",
    taskHelp:"Empfänger der Datenbankverwaltung in Aufgabe erstellen festlegen. Bei Nicht erreichbar / Nummer funktioniert nicht nur ohne andere Nummer.",
    reviewTitle:"Aktionen zur Prüfung",confirm:"Diese Aktion bestätigen",
    retry:"Anfänglicher Rückruf-Standard: in sechs Werktagen um 09:00; ein bestehender Rückruf bleibt erhalten. Koordinatoren können ihn in Queue umplanen.",
    batchHelp:"Im Batch-Modus warten bestätigte Aktionen auf das Speichern der Status List.",
    use:"Verwenden",configure:"Aktionen konfigurieren",paused:"Pausiert — die Quelle wertet keine Status aus und führt keine Aktionen aus.",held:"Deaktiviertes Ergebnis; der letzte aktivierte Status bleibt erhalten.",
    allOff:"Alle Status sind deaktiviert. Die Quelle pausiert; es werden keine Status ausgewertet oder Aktionen ausgeführt.",
    threshold:"Fehlgeschlagene Anrufe bis Nicht erreichbar",talkTime:"Mindestdauer des verbundenen Gesprächs (Sekunden)",invalidNumber:"Geben Sie eine ganze Zahl im angezeigten Bereich ein.",saved:"Einstellungen gespeichert.",
    unsaved:"Nicht gespeicherte Änderungen",saving:"Wird gespeichert…",disabledBehavior:"Ein deaktivierter Status wird nicht ausgewertet und seine Aktionen laufen nicht; der letzte aktivierte Status bleibt erhalten.",dirtyWarning:"Es gibt nicht gespeicherte Einstellungen. Vor dem Verlassen speichern oder abbrechen.",
    triggerEffect:"Auslöser und Wirkung",resetCounter:"Zähler zurücksetzen",resetTitle:"Zähler der Fehlversuche zurücksetzen?",
    resetHelp:"Setzt die erfasste Anzahl der Fehlversuche zurück. Der Server prüft vor der Anwendung den aktuellen Datensatz.",
    resetReason:"Grund für das Zurücksetzen",resetConfirm:"Zähler zurücksetzen",resetMin:"Geben Sie einen Grund mit mindestens 3 Zeichen ein.",
    resetSuccess:"Zähler der Fehlversuche zurückgesetzt.",resetExplanation:"Der Zähler wird nach einem erfolgreichen Gespräch ohne Anrufbeantworter mit Arzt oder anderem Personal sowie nach Korrektur der tatsächlichen Telefonnummer automatisch zurückgesetzt. Langfristige Abwesenheit setzt ihn nicht zurück.",
    counterSubstatus:"{count} Fehlversuche",
    stateNames:["Noch nicht definiert","Nicht erreicht","Nicht erreichbar","Erreichbar","Falsche Nummer","Nummer funktioniert nicht","Langfristig abwesend"],
    descriptionsList:[
      "Noch kein Anrufergebnis hat einen Status festgelegt. Dies ist der neutrale Ausgangspunkt ohne Aktion.",
      "Der Anruf führte zu keinem Gespräch, aber der Grenzwert für Nicht erreichbar ist noch nicht erreicht. Status und konfigurierte Aktionen können aktualisiert werden.",
      "Die konfigurierte Zahl aufeinanderfolgender Fehlversuche wurde erreicht. Aktionen können ausgeführt werden; eine alternative Nummer kann Aufgaben beeinflussen.",
      "Ein Gespräch ohne Anrufbeantworter wurde mindestens für die konfigurierte Mindestdauer verbunden. Aktionen können ausgeführt werden.",
      "Ein Agent oder eine bestätigte Aktualisierung hat die gespeicherte Nummer als falsch erkannt. Der Status bleibt bis zur Korrektur oder erneuten Auswertung bestehen.",
      "Die gespeicherte Nummer funktioniert nicht. Aufgaben laufen nur, wenn keine andere Telefonnummer verfügbar ist.",
      "Der Arzt ist langfristig abwesend. Dieser Status setzt den Zähler der Fehlversuche nicht zurück."
    ],substatusNames:["Praxis geschlossen / außer Betrieb","Arzt ausgeschieden","Kontakt nicht gefunden","Fehlversuche"]
  }
};

const stateKeys: HealthcareState[] = ["not_defined","unreached","unreachable","reachable","wrong_number","not_working","long_term_absent"];
const substatusKeys = ["practice_closed","doctor_left","contact_not_found","five_failed_attempts"];
export function getHealthcareCopy(locale: string): Copy {
  const lang = locale.split("-")[0].toLowerCase();
  const row = languages[lang] || languages.en;
  return {
    ...row,
    states: Object.fromEntries(stateKeys.map((key, index) => [key, row.stateNames[index]])) as Record<HealthcareState,string>,
    descriptions: Object.fromEntries(stateKeys.map((key, index) => [key, row.descriptionsList[index]])) as Record<HealthcareState,string>,
    substatuses: Object.fromEntries(substatusKeys.map((key, index) => [key, row.substatusNames[index]])),
  };
}
export function getHealthcareCounterSubstatus(locale: string, count: number) {
  return getHealthcareCopy(locale).counterSubstatus.replace("{count}", String(count));
}
