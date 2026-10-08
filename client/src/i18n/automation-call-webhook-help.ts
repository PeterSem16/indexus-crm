import type { Locale } from "./translations";

export type CallWebhookHelpCopy = {
  callTitle: string;
  call: string[];
  webhookTitle: string;
  webhook: string[];
};

const copy: Record<Locale, CallWebhookHelpCopy> = {
  en: {
    callTitle: "Call — react to call events",
    call: [
      "Call is an event source, not a THEN action that automatically dials a number.",
      "Inbound events: assigned to an agent, answered, completed, caller abandoned the queue, or answer timeout. Outbound events: started, answered, completed, or unanswered.",
      "Depending on the event, conditions can use Mission, queue, agent, waiting time or call duration. Use only the fields offered for the selected event.",
      "Examples: unanswered call → create a callback task; caller leaves after a long wait → notify a manager; completed call → send selected reporting data through a webhook.",
      "Creating a task does not itself schedule or dial a callback. Each follow-up action must be configured separately.",
    ],
    webhookTitle: "Webhook — send data to another system",
    webhook: [
      "A THEN action that calls an external HTTP endpoint. Set its URL, method (usually POST) and JSON body; supported event variables can be used in the payload.",
      "An empty Body sends the entire event, including old and new values. Prefer an explicit body containing only the data the recipient needs. Private/internal addresses are blocked; default timeout is 10 seconds.",
      "Zapier: create a Webhooks by Zapier → Catch Hook trigger, paste its URL here, select POST, and map the received fields to the following Zap action. A successful HTTP response confirms acceptance, not completion of the whole Zap.",
      "Trello via Zapier: task created → Catch Hook → Create Card; map the title and description and select a board/list in Zapier. Send only approved data, not a full customer record.",
      "Mailchimp via Zapier: an approved contact change → Catch Hook → add/update an audience contact or apply a tag. Respect marketing consent and unsubscribe status; never subscribe every CRM contact automatically.",
      "Trello and Mailchimp webhooks notify other systems about their own changes; they are not generic incoming URLs for creating cards or subscribing contacts.",
      "Direct Trello/Mailchimp integration requires authenticated API access and board/list or audience mapping. Those dedicated connections are not configured by this action. Do not paste API keys or tokens into the URL or JSON body.",
    ],
  },
  sk: {
    callTitle: "Call — reakcia na udalosti hovoru",
    call: [
      "Call je zdroj udalostí, nie akcia THEN, ktorá automaticky vytočí číslo.",
      "Prichádzajúce udalosti: priradenie agentovi, prijatie, ukončenie, odchod volajúceho z fronty alebo vypršanie času na prijatie. Odchádzajúce: začatie, prijatie, ukončenie alebo neprijatie.",
      "Podľa udalosti možno v podmienkach použiť Mission, frontu, agenta, čas čakania alebo dĺžku hovoru. Použite iba polia ponúkané pre vybranú udalosť.",
      "Príklady: neprijatý hovor → vytvoriť úlohu na spätné zavolanie; odchod po dlhom čakaní → upozorniť vedúceho; ukončený hovor → odoslať vybrané reportovacie údaje cez webhook.",
      "Samotné vytvorenie úlohy nenaplánuje ani nevytočí spätný hovor. Každú následnú akciu treba nastaviť samostatne.",
    ],
    webhookTitle: "Webhook — odoslanie údajov do iného systému",
    webhook: [
      "Akcia THEN zavolá externú HTTP adresu. Nastavte URL, metódu (zvyčajne POST) a telo JSON; v údajoch možno použiť podporované premenné udalosti.",
      "Prázdne Body odošle celú udalosť vrátane pôvodných a nových hodnôt. Uprednostnite vlastné telo iba s potrebnými údajmi. Privátne a interné adresy sú blokované; štandardný časový limit je 10 sekúnd.",
      "Zapier: vytvorte spúšťač Webhooks by Zapier → Catch Hook, jeho URL vložte sem, zvoľte POST a prijaté polia priraďte následnej akcii v Zapier. Úspešná HTTP odpoveď znamená prijatie, nie dokončenie celého Zapu.",
      "Trello cez Zapier: vytvorená úloha → Catch Hook → Create Card; priraďte názov a popis a v Zapier vyberte nástenku/zoznam. Posielajte iba schválené údaje, nie celú kartu klienta.",
      "Mailchimp cez Zapier: schválená zmena kontaktu → Catch Hook → pridanie/aktualizácia kontaktu v publiku alebo tagu. Rešpektujte marketingový súhlas a odhlásenie; nikdy automaticky neprihlasujte všetky kontakty CRM.",
      "Webhooky Trello a Mailchimp oznamujú vlastné zmeny iným systémom; nie sú všeobecnou prijímacou adresou na vytváranie kariet alebo prihlasovanie kontaktov.",
      "Priame napojenie Trello/Mailchimp potrebuje autorizovaný prístup k API a priradenie nástenky/zoznamu alebo publika. Táto akcia takéto samostatné spojenia nenastavuje. API kľúče ani tokeny nevkladajte do URL alebo tela JSON.",
    ],
  },
  cs: {
    callTitle: "Call — reakce na události hovoru",
    call: [
      "Call je zdroj událostí, nikoli akce THEN, která automaticky vytočí číslo.",
      "Příchozí události: přidělení agentovi, přijetí, ukončení, odchod volajícího z fronty nebo vypršení času na přijetí. Odchozí: zahájení, přijetí, ukončení nebo nepřijetí.",
      "Podle události lze použít Mission, frontu, agenta, dobu čekání nebo délku hovoru. Použijte pouze pole nabízená pro vybranou událost.",
      "Příklady: nepřijatý hovor → vytvořit úkol pro zpětné volání; odchod po dlouhém čekání → upozornit vedoucího; ukončený hovor → odeslat vybrané údaje přes webhook.",
      "Vytvoření úkolu samo nenaplánuje ani nevytočí zpětný hovor. Každou následnou akci nastavte samostatně.",
    ],
    webhookTitle: "Webhook — odeslání dat do jiného systému",
    webhook: [
      "Akce THEN zavolá externí HTTP adresu. Nastavte URL, metodu (obvykle POST) a tělo JSON; lze použít podporované proměnné události.",
      "Prázdné Body odešle celou událost včetně původních a nových hodnot. Upřednostněte vlastní tělo pouze s potřebnými údaji. Privátní a interní adresy jsou blokovány; výchozí limit je 10 sekund.",
      "Zapier: vytvořte spouštěč Webhooks by Zapier → Catch Hook, vložte jeho URL, zvolte POST a přijatá pole přiřaďte další akci v Zapier. Úspěšná HTTP odpověď znamená přijetí, ne dokončení celého Zapu.",
      "Trello přes Zapier: vytvořený úkol → Catch Hook → Create Card; přiřaďte název a popis a vyberte nástěnku/seznam v Zapier. Posílejte jen schválené údaje, ne celou kartu klienta.",
      "Mailchimp přes Zapier: schválená změna kontaktu → Catch Hook → přidání/aktualizace kontaktu v publiku nebo štítku. Respektujte marketingový souhlas a odhlášení; nikdy automaticky nepřihlašujte všechny kontakty CRM.",
      "Webhooky Trello a Mailchimp oznamují vlastní změny jiným systémům; nejsou univerzální přijímací adresou pro tvorbu karet nebo přihlášení kontaktů.",
      "Přímé napojení Trello/Mailchimp vyžaduje autorizovaný přístup k API a mapování nástěnky/seznamu nebo publika. Tato akce taková spojení nenastavuje. API klíče a tokeny nevkládejte do URL ani JSON.",
    ],
  },
  hu: {
    callTitle: "Call — reagálás híváseseményekre",
    call: [
      "A Call eseményforrás, nem olyan THEN művelet, amely automatikusan tárcsáz.",
      "Bejövő események: ügynökhöz rendelés, fogadás, befejezés, a várakozó hívó kilépése vagy fogadási időtúllépés. Kimenő: indítás, fogadás, befejezés vagy nem fogadott hívás.",
      "Az eseménytől függően Mission, sor, ügynök, várakozási idő vagy híváshossz használható. Csak a kiválasztott eseményhez kínált mezőket használja.",
      "Példák: nem fogadott hívás → visszahívási feladat; hosszú várakozás utáni kilépés → vezető értesítése; befejezett hívás → kiválasztott jelentési adatok küldése webhookkal.",
      "A feladat létrehozása önmagában nem ütemez és nem tárcsáz visszahívást. Minden további műveletet külön állítson be.",
    ],
    webhookTitle: "Webhook — adatok küldése más rendszerbe",
    webhook: [
      "A THEN művelet külső HTTP címet hív meg. Adja meg az URL-t, a metódust (általában POST) és a JSON törzset; támogatott eseményváltozók használhatók.",
      "Üres Body esetén a teljes esemény elküldésre kerül a régi és új értékekkel. Csak a szükséges adatokat tartalmazó saját törzset használjon. Belső/privát címek tiltottak; az alap időkorlát 10 másodperc.",
      "Zapier: hozzon létre Webhooks by Zapier → Catch Hook indítót, illessze be az URL-jét, válassza a POST-ot és rendelje a fogadott mezőket a következő Zapier művelethez. A sikeres HTTP válasz az átvételt, nem a teljes Zap befejezését igazolja.",
      "Trello Zapierrel: új feladat → Catch Hook → Create Card; rendelje hozzá a címet és leírást, válasszon táblát/listát a Zapierben. Csak jóváhagyott adatot küldjön, ne teljes ügyfélrekordot.",
      "Mailchimp Zapierrel: jóváhagyott kontaktmódosítás → Catch Hook → közönségkontakt hozzáadása/frissítése vagy címkézés. Tartsa tiszteletben a marketinghozzájárulást és leiratkozást; ne iratkoztasson fel automatikusan minden CRM-kontaktot.",
      "A Trello és Mailchimp webhookjai saját változásaikról értesítenek más rendszereket; nem általános fogadó URL-ek kártyák létrehozásához vagy feliratkozáshoz.",
      "A közvetlen Trello/Mailchimp kapcsolat hitelesített API-hozzáférést és tábla/lista vagy közönség megfeleltetést igényel. Ez a művelet nem állítja be e külön kapcsolatokat. Ne írjon API-kulcsot vagy tokent az URL-be vagy JSON-ba.",
    ],
  },
  ro: {
    callTitle: "Call — reacție la evenimentele apelurilor",
    call: [
      "Call este o sursă de evenimente, nu o acțiune THEN care formează automat un număr.",
      "Evenimente de intrare: alocare unui agent, răspuns, finalizare, abandonarea cozii de către apelant sau expirarea timpului de răspuns. De ieșire: inițiere, răspuns, finalizare sau fără răspuns.",
      "În funcție de eveniment, condițiile pot folosi Mission, coada, agentul, timpul de așteptare sau durata apelului. Folosiți doar câmpurile oferite pentru evenimentul ales.",
      "Exemple: apel fără răspuns → sarcină de reapelare; abandon după așteptare lungă → notificarea managerului; apel finalizat → date selectate pentru raportare prin webhook.",
      "Crearea unei sarcini nu programează și nu formează singură un reapel. Configurați separat fiecare acțiune ulterioară.",
    ],
    webhookTitle: "Webhook — trimiterea datelor către alt sistem",
    webhook: [
      "Acțiunea THEN apelează un endpoint HTTP extern. Configurați URL-ul, metoda (de obicei POST) și corpul JSON; puteți folosi variabilele acceptate ale evenimentului.",
      "Un Body gol trimite întregul eveniment, inclusiv valorile vechi și noi. Preferabil definiți un corp doar cu datele necesare. Adresele interne/private sunt blocate; limita implicită este 10 secunde.",
      "Zapier: creați un declanșator Webhooks by Zapier → Catch Hook, inserați URL-ul, selectați POST și asociați câmpurile primite acțiunii următoare din Zapier. Răspunsul HTTP reușit confirmă acceptarea, nu finalizarea întregului Zap.",
      "Trello prin Zapier: sarcină creată → Catch Hook → Create Card; asociați titlul și descrierea și alegeți tabla/lista în Zapier. Trimiteți doar date aprobate, nu întreaga fișă a clientului.",
      "Mailchimp prin Zapier: modificare aprobată a contactului → Catch Hook → adăugare/actualizare în audiență sau etichetare. Respectați consimțământul de marketing și dezabonarea; nu abonați automat toate contactele CRM.",
      "Webhook-urile Trello și Mailchimp notifică alte sisteme despre propriile modificări; nu sunt URL-uri generice de intrare pentru creare de carduri sau abonare de contacte.",
      "Integrarea directă Trello/Mailchimp necesită acces API autentificat și maparea tablei/listei sau audienței. Această acțiune nu configurează acele conexiuni dedicate. Nu introduceți chei API sau tokenuri în URL sau JSON.",
    ],
  },
  it: {
    callTitle: "Call — reagire agli eventi delle chiamate",
    call: [
      "Call è una fonte di eventi, non un'azione THEN che compone automaticamente un numero.",
      "Eventi in entrata: assegnazione all'agente, risposta, conclusione, abbandono della coda o timeout di risposta. In uscita: avvio, risposta, conclusione o mancata risposta.",
      "In base all'evento, le condizioni possono usare Mission, coda, agente, attesa o durata della chiamata. Usare solo i campi disponibili per l'evento scelto.",
      "Esempi: chiamata senza risposta → attività di richiamata; abbandono dopo lunga attesa → avviso al responsabile; chiamata conclusa → dati selezionati per i report tramite webhook.",
      "Creare un'attività non pianifica né compone da solo una richiamata. Configurare separatamente ogni azione successiva.",
    ],
    webhookTitle: "Webhook — inviare dati a un altro sistema",
    webhook: [
      "L'azione THEN chiama un endpoint HTTP esterno. Impostare URL, metodo (di solito POST) e corpo JSON; sono disponibili le variabili supportate dell'evento.",
      "Body vuoto invia l'intero evento con valori precedenti e nuovi. Preferire un corpo esplicito con i soli dati necessari. Gli indirizzi privati/interni sono bloccati; timeout predefinito di 10 secondi.",
      "Zapier: creare il trigger Webhooks by Zapier → Catch Hook, incollare l'URL, scegliere POST e mappare i campi ricevuti nell'azione successiva. Una risposta HTTP positiva conferma l'accettazione, non il completamento dell'intero Zap.",
      "Trello tramite Zapier: attività creata → Catch Hook → Create Card; mappare titolo e descrizione e scegliere bacheca/lista in Zapier. Inviare solo dati autorizzati, non l'intera scheda cliente.",
      "Mailchimp tramite Zapier: modifica approvata del contatto → Catch Hook → aggiunta/aggiornamento nel pubblico o applicazione di un tag. Rispettare consenso marketing e disiscrizione; non iscrivere automaticamente tutti i contatti CRM.",
      "I webhook Trello e Mailchimp notificano altri sistemi delle proprie modifiche; non sono URL generici in ingresso per creare schede o iscrivere contatti.",
      "L'integrazione diretta Trello/Mailchimp richiede accesso API autenticato e mappatura di bacheca/lista o pubblico. Questa azione non configura tali connessioni dedicate. Non inserire chiavi API o token nell'URL o nel JSON.",
    ],
  },
  de: {
    callTitle: "Call — auf Anrufereignisse reagieren",
    call: [
      "Call ist eine Ereignisquelle, keine THEN-Aktion, die automatisch eine Nummer wählt.",
      "Eingehend: Agentenzuweisung, Annahme, Abschluss, Verlassen der Warteschlange oder Annahme-Timeout. Ausgehend: Beginn, Annahme, Abschluss oder nicht beantworteter Anruf.",
      "Je nach Ereignis können Bedingungen Mission, Warteschlange, Agent, Wartezeit oder Gesprächsdauer verwenden. Nur die für das gewählte Ereignis angebotenen Felder verwenden.",
      "Beispiele: unbeantworteter Anruf → Rückrufaufgabe; Abbruch nach langer Wartezeit → Führungskraft benachrichtigen; abgeschlossener Anruf → ausgewählte Berichtsdaten per Webhook senden.",
      "Eine Aufgabe allein plant keinen Rückruf und wählt keine Nummer. Jede Folgeaktion muss separat eingerichtet werden.",
    ],
    webhookTitle: "Webhook — Daten an ein anderes System senden",
    webhook: [
      "Die THEN-Aktion ruft einen externen HTTP-Endpunkt auf. URL, Methode (meist POST) und JSON-Inhalt festlegen; unterstützte Ereignisvariablen können verwendet werden.",
      "Ein leeres Body sendet das gesamte Ereignis mit alten und neuen Werten. Besser nur benötigte Daten ausdrücklich angeben. Private/interne Adressen sind gesperrt; Standard-Timeout ist 10 Sekunden.",
      "Zapier: Webhooks by Zapier → Catch Hook als Auslöser erstellen, dessen URL einfügen, POST wählen und empfangene Felder der nächsten Zapier-Aktion zuordnen. HTTP-Erfolg bestätigt die Annahme, nicht den Abschluss des gesamten Zaps.",
      "Trello über Zapier: neue Aufgabe → Catch Hook → Create Card; Titel und Beschreibung zuordnen und Board/Liste in Zapier auswählen. Nur freigegebene Daten senden, keinen vollständigen Kundendatensatz.",
      "Mailchimp über Zapier: freigegebene Kontaktänderung → Catch Hook → Zielgruppenkontakt hinzufügen/aktualisieren oder Tag setzen. Marketingeinwilligung und Abmeldung beachten; niemals alle CRM-Kontakte automatisch anmelden.",
      "Trello- und Mailchimp-Webhooks melden eigene Änderungen an andere Systeme; sie sind keine allgemeinen Empfangs-URLs zum Erstellen von Karten oder Anmelden von Kontakten.",
      "Direkte Trello/Mailchimp-Anbindung benötigt authentifizierten API-Zugriff und Board/Listen- oder Zielgruppenzuordnung. Diese Aktion richtet solche Verbindungen nicht ein. API-Schlüssel oder Tokens nicht in URL oder JSON eingeben.",
    ],
  },
};

export default copy;
