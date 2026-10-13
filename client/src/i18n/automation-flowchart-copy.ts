import type { Locale } from "./translations";

export type AutomationFlowchartLocale = Extract<Locale, "en" | "sk" | "cs" | "hu" | "ro" | "it" | "de">;

export type AutomationFlowchartCopy = {
  preview: string;
  definitionNotice: string;
  active: string;
  paused: string;
  scope: string;
  trigger: string;
  analysis: string;
  conditions: string;
  conditionNote: string;
  decisionSummary: string;
  conditionsIgnored: string;
  reference: string;
  stop: string;
  noConditions: string;
  all: string;
  any: string;
  not: string;
  allHint: string;
  anyHint: string;
  notHint: string;
  emptyAll: string;
  emptyAny: string;
  emptyNot: string;
  yes: string;
  no: string;
  noAction: string;
  noActions: string;
  action: string;
  actions: string;
  unconditional: string;
  and: string;
  unknown: string;
  allCountries: string;
  unlimited: string;
  once: string;
  perRecord: string;
  schedule: string;
  rateLimit: string;
  threshold: string;
  openMessage: string;
  messagePreview: string;
  closeMessage: string;
  fields: Record<string, string>;
  boolean: { yes: string; no: string };
};

const copy: Record<AutomationFlowchartLocale, AutomationFlowchartCopy> = {
  en: {
    preview: "Rule flow",
    definitionNotice: "Definition preview · actions run in configured order and continue after a failure; this is not a run-status report.",
    active: "Active", paused: "Paused", scope: "Applies to", trigger: "When", analysis: "Before conditions",
    conditions: "Conditions", conditionNote: "The rule continues only when the complete condition set matches.",
    decisionSummary: "One decision: evaluate this complete nested condition tree as a single result.",
    conditionsIgnored: "This schedule mode ignores stored conditions and runs once on every schedule tick. Conditions are shown for reference and do not block the actions.",
    reference: "Reference only · not connected to this route", stop: "STOP",
    noConditions: "No conditions — this rule applies whenever its trigger occurs.",
    all: "ALL", any: "ANY", not: "NOT", allHint: "Every condition below must match",
    anyHint: "At least one condition below must match", notHint: "The condition below must not match",
    emptyAll: "No conditions in this group — ALL of zero conditions is always true.",
    emptyAny: "No conditions in this group — ANY of zero conditions is false.",
    emptyNot: "No conditions in this group — NOT of zero conditions is false.",
    yes: "Yes — conditions match", no: "No — conditions do not match", noAction: "No action on this branch",
    noActions: "No actions configured", action: "Action", actions: "Actions",
    unconditional: "No condition check; actions follow the trigger directly.",
    and: "and", unknown: "Not specified", allCountries: "All countries", unlimited: "No limit",
    once: "Once", perRecord: "For each record", schedule: "Schedule", rateLimit: "Rate limit",
    threshold: "Threshold", openMessage: "Preview content", messagePreview: "Message preview", closeMessage: "Close preview", fields: {
      field: "Field", fieldName: "Field", field_name: "Field", fieldId: "Field", field_id: "Field",
      recordType: "Record type", record_type: "Record type", module: "Record type", country: "Country",
      countries: "Countries", countryCodes: "Countries", country_codes: "Countries", owner: "Owner",
      assignedTo: "Assigned to", assigned_to: "Assigned to", status: "Status", event: "Event",
      eventType: "Event", event_type: "Event", value: "Value", values: "Values", operator: "Operator",
      template: "Template", subject: "Subject", message: "Message", body: "Message", url: "URL",
      method: "Method", headers: "Headers", timeout: "Timeout", delay: "Delay", count: "Count",
      limit: "Limit", minutes: "Minutes", hours: "Hours", days: "Days", timezone: "Time zone",
      frequency: "Frequency", interval: "Interval", mode: "Mode", enabled: "Enabled",
      notify: "Notify", recipient: "Recipient", recipients: "Recipients", tag: "Tag", tags: "Tags",
      queue: "Queue", userId: "User", user_id: "User", groupId: "Group", group_id: "Group",
      campaignId: "Campaign", campaign_id: "Campaign", source: "Source", name: "Name",
      description: "Description", condition: "Condition", conditions: "Conditions",
    }, boolean: { yes: "Yes", no: "No" },
  },
  sk: {
    preview: "Priebeh pravidla", definitionNotice: "Náhľad definície · akcie sa vykonávajú v nastavenom poradí a pokračujú aj po chybe; nejde o stav vykonania.",
    active: "Aktívne", paused: "Pozastavené", scope: "Platí pre", trigger: "Keď", analysis: "Pred podmienkami",
    conditions: "Podmienky", conditionNote: "Pravidlo pokračuje, len ak sa zhoduje celá skupina podmienok.",
    decisionSummary: "Jedno rozhodnutie: celý vnorený strom podmienok sa vyhodnotí ako jeden výsledok.",
    conditionsIgnored: "Tento režim plánu ignoruje uložené podmienky a spustí pravidlo pri každom plánovanom intervale. Podmienky sú zobrazené pre informáciu a neblokujú akcie.",
    reference: "Len referencia · nie je prepojená s touto trasou", stop: "KONIEC",
    noConditions: "Bez podmienok — pravidlo platí pri každom spustení.",
    all: "VŠETKY", any: "ĽUBOVOĽNÁ", not: "NIE", allHint: "Musia platiť všetky nižšie uvedené podmienky",
    anyHint: "Musí platiť aspoň jedna nižšie uvedená podmienka", notHint: "Nižšie uvedená podmienka nesmie platiť",
    emptyAll: "Táto skupina nemá podmienky — VŠETKY z nula podmienok vždy platí.",
    emptyAny: "Táto skupina nemá podmienky — ĽUBOVOĽNÁ z nula podmienok neplatí.",
    emptyNot: "Táto skupina nemá podmienky — NIE z nula podmienok neplatí.",
    yes: "Áno — podmienky platia", no: "Nie — podmienky neplatia", noAction: "V tejto vetve sa nevykoná žiadna akcia",
    noActions: "Nie sú nastavené žiadne akcie", action: "Akcia", actions: "Akcie",
    unconditional: "Bez kontroly podmienok; akcie nasledujú priamo po spúšťači.",
    and: "a", unknown: "Neuvedené", allCountries: "Všetky krajiny", unlimited: "Bez limitu",
    once: "Raz", perRecord: "Pre každý záznam", schedule: "Plán", rateLimit: "Obmedzenie frekvencie",
    threshold: "Prahová hodnota", openMessage: "Zobraziť obsah", messagePreview: "Náhľad správy", closeMessage: "Zavrieť náhľad", fields: {
      field: "Pole", fieldName: "Pole", field_name: "Pole", fieldId: "Pole", field_id: "Pole",
      recordType: "Typ záznamu", record_type: "Typ záznamu", module: "Typ záznamu", country: "Krajina",
      countries: "Krajiny", countryCodes: "Krajiny", country_codes: "Krajiny", owner: "Vlastník",
      assignedTo: "Priradené", assigned_to: "Priradené", status: "Stav", event: "Udalosť",
      eventType: "Udalosť", event_type: "Udalosť", value: "Hodnota", values: "Hodnoty", operator: "Operátor",
      template: "Šablóna", subject: "Predmet", message: "Správa", body: "Správa", url: "URL",
      method: "Metóda", headers: "Hlavičky", timeout: "Časový limit", delay: "Oneskorenie", count: "Počet",
      limit: "Limit", minutes: "Minúty", hours: "Hodiny", days: "Dni", timezone: "Časové pásmo",
      frequency: "Frekvencia", interval: "Interval", mode: "Režim", enabled: "Zapnuté",
      notify: "Upozorniť", recipient: "Príjemca", recipients: "Príjemcovia", tag: "Značka", tags: "Značky",
      queue: "Front", userId: "Používateľ", user_id: "Používateľ", groupId: "Skupina", group_id: "Skupina",
      campaignId: "Kampaň", campaign_id: "Kampaň", source: "Zdroj", name: "Názov",
      description: "Popis", condition: "Podmienka", conditions: "Podmienky",
    }, boolean: { yes: "Áno", no: "Nie" },
  },
  cs: {
    preview: "Průběh pravidla", definitionNotice: "Náhled definice · akce běží v nastaveném pořadí a pokračují i po chybě; nejde o stav provedení.",
    active: "Aktivní", paused: "Pozastaveno", scope: "Platí pro", trigger: "Když", analysis: "Před podmínkami",
    conditions: "Podmínky", conditionNote: "Pravidlo pokračuje, pouze pokud odpovídá celá skupina podmínek.",
    decisionSummary: "Jedno rozhodnutí: celý vnořený strom podmínek se vyhodnotí jako jediný výsledek.",
    conditionsIgnored: "Tento režim plánu ignoruje uložené podmínky a spustí pravidlo při každém plánovaném intervalu. Podmínky jsou zobrazeny pro informaci a neblokují akce.",
    reference: "Pouze reference · není propojena s touto trasou", stop: "KONEC",
    noConditions: "Bez podmínek — pravidlo platí při každém spuštění.",
    all: "VŠECHNY", any: "LIBOVOLNÁ", not: "NE", allHint: "Musí platit všechny níže uvedené podmínky",
    anyHint: "Musí platit alespoň jedna níže uvedená podmínka", notHint: "Níže uvedená podmínka nesmí platit",
    emptyAll: "Tato skupina nemá podmínky — VŠECHNY z nula podmínek vždy platí.",
    emptyAny: "Tato skupina nemá podmínky — LIBOVOLNÁ z nula podmínek neplatí.",
    emptyNot: "Tato skupina nemá podmínky — NE z nula podmínek neplatí.",
    yes: "Ano — podmínky platí", no: "Ne — podmínky neplatí", noAction: "V této větvi se neprovede žádná akce",
    noActions: "Nejsou nastaveny žádné akce", action: "Akce", actions: "Akce",
    unconditional: "Bez kontroly podmínek; akce následují přímo po spouštěči.",
    and: "a", unknown: "Neuvedeno", allCountries: "Všechny země", unlimited: "Bez limitu",
    once: "Jednou", perRecord: "Pro každý záznam", schedule: "Plán", rateLimit: "Omezení frekvence",
    threshold: "Prahová hodnota", openMessage: "Zobrazit obsah", messagePreview: "Náhled zprávy", closeMessage: "Zavřít náhled", fields: {
      field: "Pole", fieldName: "Pole", field_name: "Pole", fieldId: "Pole", field_id: "Pole",
      recordType: "Typ záznamu", record_type: "Typ záznamu", module: "Typ záznamu", country: "Země",
      countries: "Země", countryCodes: "Země", country_codes: "Země", owner: "Vlastník",
      assignedTo: "Přiřazeno", assigned_to: "Přiřazeno", status: "Stav", event: "Událost",
      eventType: "Událost", event_type: "Událost", value: "Hodnota", values: "Hodnoty", operator: "Operátor",
      template: "Šablona", subject: "Předmět", message: "Zpráva", body: "Zpráva", url: "URL",
      method: "Metoda", headers: "Hlavičky", timeout: "Časový limit", delay: "Zpoždění", count: "Počet",
      limit: "Limit", minutes: "Minuty", hours: "Hodiny", days: "Dny", timezone: "Časové pásmo",
      frequency: "Frekvence", interval: "Interval", mode: "Režim", enabled: "Zapnuto",
      notify: "Upozornit", recipient: "Příjemce", recipients: "Příjemci", tag: "Štítek", tags: "Štítky",
      queue: "Fronta", userId: "Uživatel", user_id: "Uživatel", groupId: "Skupina", group_id: "Skupina",
      campaignId: "Kampaň", campaign_id: "Kampaň", source: "Zdroj", name: "Název",
      description: "Popis", condition: "Podmínka", conditions: "Podmínky",
    }, boolean: { yes: "Ano", no: "Ne" },
  },
  hu: {
    preview: "Szabályfolyamat", definitionNotice: "Definícióelőnézet · a műveletek a beállított sorrendben futnak, hiba után is folytatódnak; ez nem futási állapotjelzés.",
    active: "Aktív", paused: "Szüneteltetve", scope: "Érvényesség", trigger: "Amikor", analysis: "Feltételek előtt",
    conditions: "Feltételek", conditionNote: "A szabály csak akkor folytatódik, ha a teljes feltételcsoport egyezik.",
    decisionSummary: "Egyetlen döntés: a teljes, beágyazott feltételfa egyetlen eredményt ad.",
    conditionsIgnored: "Ez az ütemezési mód figyelmen kívül hagyja a tárolt feltételeket, és minden ütemezési ciklusban egyszer fut le. A feltételek tájékoztatásként láthatók, de nem akadályozzák a műveleteket.",
    reference: "Csak tájékoztató · nincs összekötve ezzel az útvonallal", stop: "VÉGE",
    noConditions: "Nincsenek feltételek — a szabály minden indításkor érvényes.",
    all: "MIND", any: "BÁRMELYIK", not: "NEM", allHint: "Az összes alábbi feltételnek egyeznie kell",
    anyHint: "Legalább egy alábbi feltételnek egyeznie kell", notHint: "Az alábbi feltétel nem egyezhet",
    emptyAll: "Ebben a csoportban nincs feltétel — nulla feltétel MIND esetén az eredmény mindig igaz.",
    emptyAny: "Ebben a csoportban nincs feltétel — nulla feltétel BÁRMELYIK esetén az eredmény hamis.",
    emptyNot: "Ebben a csoportban nincs feltétel — nulla feltétel NEM esetén az eredmény hamis.",
    yes: "Igen — a feltételek egyeznek", no: "Nem — a feltételek nem egyeznek", noAction: "Ezen az ágon nincs művelet",
    noActions: "Nincs beállított művelet", action: "Művelet", actions: "Műveletek",
    unconditional: "Nincs feltételvizsgálat; a műveletek közvetlenül az indítás után következnek.",
    and: "és", unknown: "Nincs megadva", allCountries: "Minden ország", unlimited: "Korlátlan",
    once: "Egyszer", perRecord: "Minden rekordnál", schedule: "Ütemezés", rateLimit: "Gyakorisági korlát",
    threshold: "Küszöbérték", openMessage: "Tartalom előnézete", messagePreview: "Üzenet előnézete", closeMessage: "Előnézet bezárása", fields: {
      field: "Mező", fieldName: "Mező", field_name: "Mező", fieldId: "Mező", field_id: "Mező",
      recordType: "Rekordtípus", record_type: "Rekordtípus", module: "Rekordtípus", country: "Ország",
      countries: "Országok", countryCodes: "Országok", country_codes: "Országok", owner: "Felelős",
      assignedTo: "Hozzárendelve", assigned_to: "Hozzárendelve", status: "Állapot", event: "Esemény",
      eventType: "Esemény", event_type: "Esemény", value: "Érték", values: "Értékek", operator: "Operátor",
      template: "Sablon", subject: "Tárgy", message: "Üzenet", body: "Üzenet", url: "URL",
      method: "Módszer", headers: "Fejlécek", timeout: "Időkorlát", delay: "Késleltetés", count: "Darab",
      limit: "Korlát", minutes: "Perc", hours: "Óra", days: "Nap", timezone: "Időzóna",
      frequency: "Gyakoriság", interval: "Időköz", mode: "Mód", enabled: "Engedélyezve",
      notify: "Értesítés", recipient: "Címzett", recipients: "Címzettek", tag: "Címke", tags: "Címkék",
      queue: "Sor", userId: "Felhasználó", user_id: "Felhasználó", groupId: "Csoport", group_id: "Csoport",
      campaignId: "Kampány", campaign_id: "Kampány", source: "Forrás", name: "Név",
      description: "Leírás", condition: "Feltétel", conditions: "Feltételek",
    }, boolean: { yes: "Igen", no: "Nem" },
  },
  ro: {
    preview: "Fluxul regulii", definitionNotice: "Previzualizare a definiției · acțiunile rulează în ordinea configurată și continuă după o eroare; aceasta nu este o stare de execuție.",
    active: "Activă", paused: "În pauză", scope: "Se aplică la", trigger: "Când", analysis: "Înainte de condiții",
    conditions: "Condiții", conditionNote: "Regula continuă doar dacă întregul grup de condiții corespunde.",
    decisionSummary: "O singură decizie: întregul arbore imbricat de condiții este evaluat ca un singur rezultat.",
    conditionsIgnored: "Acest mod de programare ignoră condițiile salvate și rulează o dată la fiecare ciclu programat. Condițiile rămân vizibile ca referință și nu blochează acțiunile.",
    reference: "Doar referință · neconectată la acest traseu", stop: "STOP",
    noConditions: "Fără condiții — regula se aplică la fiecare declanșare.",
    all: "TOATE", any: "ORICARE", not: "NU", allHint: "Toate condițiile de mai jos trebuie să corespundă",
    anyHint: "Cel puțin o condiție de mai jos trebuie să corespundă", notHint: "Condiția de mai jos nu trebuie să corespundă",
    emptyAll: "Acest grup nu are condiții — TOATE din zero condiții este întotdeauna adevărat.",
    emptyAny: "Acest grup nu are condiții — ORICARE din zero condiții este fals.",
    emptyNot: "Acest grup nu are condiții — NU din zero condiții este fals.",
    yes: "Da — condițiile corespund", no: "Nu — condițiile nu corespund", noAction: "Nicio acțiune pe această ramură",
    noActions: "Nu sunt configurate acțiuni", action: "Acțiune", actions: "Acțiuni",
    unconditional: "Fără verificarea condițiilor; acțiunile urmează direct declanșatorului.",
    and: "și", unknown: "Nespecificat", allCountries: "Toate țările", unlimited: "Fără limită",
    once: "O singură dată", perRecord: "Pentru fiecare înregistrare", schedule: "Programare", rateLimit: "Limită de frecvență",
    threshold: "Prag", openMessage: "Previzualizează conținutul", messagePreview: "Previzualizare mesaj", closeMessage: "Închide previzualizarea", fields: {
      field: "Câmp", fieldName: "Câmp", field_name: "Câmp", fieldId: "Câmp", field_id: "Câmp",
      recordType: "Tip înregistrare", record_type: "Tip înregistrare", module: "Tip înregistrare", country: "Țară",
      countries: "Țări", countryCodes: "Țări", country_codes: "Țări", owner: "Responsabil",
      assignedTo: "Atribuit către", assigned_to: "Atribuit către", status: "Stare", event: "Eveniment",
      eventType: "Eveniment", event_type: "Eveniment", value: "Valoare", values: "Valori", operator: "Operator",
      template: "Șablon", subject: "Subiect", message: "Mesaj", body: "Mesaj", url: "URL",
      method: "Metodă", headers: "Antete", timeout: "Limită de timp", delay: "Întârziere", count: "Număr",
      limit: "Limită", minutes: "Minute", hours: "Ore", days: "Zile", timezone: "Fus orar",
      frequency: "Frecvență", interval: "Interval", mode: "Mod", enabled: "Activat",
      notify: "Notifică", recipient: "Destinatar", recipients: "Destinatari", tag: "Etichetă", tags: "Etichete",
      queue: "Coadă", userId: "Utilizator", user_id: "Utilizator", groupId: "Grup", group_id: "Grup",
      campaignId: "Campanie", campaign_id: "Campanie", source: "Sursă", name: "Nume",
      description: "Descriere", condition: "Condiție", conditions: "Condiții",
    }, boolean: { yes: "Da", no: "Nu" },
  },
  it: {
    preview: "Flusso della regola", definitionNotice: "Anteprima della definizione · le azioni seguono l’ordine configurato e proseguono dopo un errore; non è un rapporto sullo stato di esecuzione.",
    active: "Attiva", paused: "In pausa", scope: "Si applica a", trigger: "Quando", analysis: "Prima delle condizioni",
    conditions: "Condizioni", conditionNote: "La regola prosegue solo se l’intero gruppo di condizioni corrisponde.",
    decisionSummary: "Un’unica decisione: l’intero albero annidato delle condizioni viene valutato come un solo risultato.",
    conditionsIgnored: "Questa modalità di programmazione ignora le condizioni salvate ed esegue la regola una volta a ogni ciclo pianificato. Le condizioni restano visibili come riferimento e non bloccano le azioni.",
    reference: "Solo riferimento · non collegato a questo percorso", stop: "FINE",
    noConditions: "Nessuna condizione — la regola si applica a ogni attivazione.",
    all: "TUTTE", any: "QUALSIASI", not: "NON", allHint: "Devono corrispondere tutte le condizioni seguenti",
    anyHint: "Deve corrispondere almeno una condizione seguente", notHint: "La condizione seguente non deve corrispondere",
    emptyAll: "Questo gruppo non contiene condizioni — TUTTE le zero condizioni è sempre vero.",
    emptyAny: "Questo gruppo non contiene condizioni — QUALSIASI di zero condizioni è falso.",
    emptyNot: "Questo gruppo non contiene condizioni — NON di zero condizioni è falso.",
    yes: "Sì — condizioni corrispondenti", no: "No — condizioni non corrispondenti", noAction: "Nessuna azione in questo ramo",
    noActions: "Nessuna azione configurata", action: "Azione", actions: "Azioni",
    unconditional: "Nessun controllo delle condizioni; le azioni seguono direttamente l’attivazione.",
    and: "e", unknown: "Non specificato", allCountries: "Tutti i paesi", unlimited: "Nessun limite",
    once: "Una volta", perRecord: "Per ogni record", schedule: "Programmazione", rateLimit: "Limite di frequenza",
    threshold: "Soglia", openMessage: "Anteprima contenuto", messagePreview: "Anteprima messaggio", closeMessage: "Chiudi anteprima", fields: {
      field: "Campo", fieldName: "Campo", field_name: "Campo", fieldId: "Campo", field_id: "Campo",
      recordType: "Tipo di record", record_type: "Tipo di record", module: "Tipo di record", country: "Paese",
      countries: "Paesi", countryCodes: "Paesi", country_codes: "Paesi", owner: "Responsabile",
      assignedTo: "Assegnato a", assigned_to: "Assegnato a", status: "Stato", event: "Evento",
      eventType: "Evento", event_type: "Evento", value: "Valore", values: "Valori", operator: "Operatore",
      template: "Modello", subject: "Oggetto", message: "Messaggio", body: "Messaggio", url: "URL",
      method: "Metodo", headers: "Intestazioni", timeout: "Timeout", delay: "Ritardo", count: "Conteggio",
      limit: "Limite", minutes: "Minuti", hours: "Ore", days: "Giorni", timezone: "Fuso orario",
      frequency: "Frequenza", interval: "Intervallo", mode: "Modalità", enabled: "Abilitato",
      notify: "Notifica", recipient: "Destinatario", recipients: "Destinatari", tag: "Etichetta", tags: "Etichette",
      queue: "Coda", userId: "Utente", user_id: "Utente", groupId: "Gruppo", group_id: "Gruppo",
      campaignId: "Campagna", campaign_id: "Campagna", source: "Origine", name: "Nome",
      description: "Descrizione", condition: "Condizione", conditions: "Condizioni",
    }, boolean: { yes: "Sì", no: "No" },
  },
  de: {
    preview: "Regelablauf", definitionNotice: "Definitionsvorschau · Aktionen laufen in der konfigurierten Reihenfolge und werden auch nach einem Fehler fortgesetzt; dies ist keine Laufstatusanzeige.",
    active: "Aktiv", paused: "Pausiert", scope: "Gilt für", trigger: "Wenn", analysis: "Vor Bedingungen",
    conditions: "Bedingungen", conditionNote: "Die Regel wird nur fortgesetzt, wenn die gesamte Bedingungsgruppe zutrifft.",
    decisionSummary: "Eine Entscheidung: Der gesamte verschachtelte Bedingungsbaum wird als ein Ergebnis ausgewertet.",
    conditionsIgnored: "Dieser Zeitplanmodus ignoriert gespeicherte Bedingungen und führt die Regel bei jedem Zeitplan-Takt einmal aus. Die Bedingungen bleiben als Referenz sichtbar und verhindern die Aktionen nicht.",
    reference: "Nur Referenz · nicht mit diesem Ablauf verbunden", stop: "ENDE",
    noConditions: "Keine Bedingungen — die Regel gilt bei jeder Auslösung.",
    all: "ALLE", any: "BELIEBIGE", not: "NICHT", allHint: "Alle folgenden Bedingungen müssen zutreffen",
    anyHint: "Mindestens eine der folgenden Bedingungen muss zutreffen", notHint: "Die folgende Bedingung darf nicht zutreffen",
    emptyAll: "Keine Bedingungen in dieser Gruppe — ALLE von null Bedingungen ist immer wahr.",
    emptyAny: "Keine Bedingungen in dieser Gruppe — BELIEBIGE von null Bedingungen ist falsch.",
    emptyNot: "Keine Bedingungen in dieser Gruppe — NICHT von null Bedingungen ist falsch.",
    yes: "Ja — Bedingungen treffen zu", no: "Nein — Bedingungen treffen nicht zu", noAction: "Keine Aktion in diesem Zweig",
    noActions: "Keine Aktionen konfiguriert", action: "Aktion", actions: "Aktionen",
    unconditional: "Keine Bedingungsprüfung; Aktionen folgen direkt auf den Auslöser.",
    and: "und", unknown: "Nicht angegeben", allCountries: "Alle Länder", unlimited: "Unbegrenzt",
    once: "Einmal", perRecord: "Für jeden Datensatz", schedule: "Zeitplan", rateLimit: "Ratenbegrenzung",
    threshold: "Schwellenwert", openMessage: "Inhalt ansehen", messagePreview: "Nachrichtenvorschau", closeMessage: "Vorschau schließen", fields: {
      field: "Feld", fieldName: "Feld", field_name: "Feld", fieldId: "Feld", field_id: "Feld",
      recordType: "Datensatztyp", record_type: "Datensatztyp", module: "Datensatztyp", country: "Land",
      countries: "Länder", countryCodes: "Länder", country_codes: "Länder", owner: "Verantwortlich",
      assignedTo: "Zugewiesen an", assigned_to: "Zugewiesen an", status: "Status", event: "Ereignis",
      eventType: "Ereignis", event_type: "Ereignis", value: "Wert", values: "Werte", operator: "Operator",
      template: "Vorlage", subject: "Betreff", message: "Nachricht", body: "Nachricht", url: "URL",
      method: "Methode", headers: "Header", timeout: "Zeitlimit", delay: "Verzögerung", count: "Anzahl",
      limit: "Limit", minutes: "Minuten", hours: "Stunden", days: "Tage", timezone: "Zeitzone",
      frequency: "Häufigkeit", interval: "Intervall", mode: "Modus", enabled: "Aktiviert",
      notify: "Benachrichtigen", recipient: "Empfänger", recipients: "Empfänger", tag: "Markierung", tags: "Markierungen",
      queue: "Warteschlange", userId: "Benutzer", user_id: "Benutzer", groupId: "Gruppe", group_id: "Gruppe",
      campaignId: "Kampagne", campaign_id: "Kampagne", source: "Quelle", name: "Name",
      description: "Beschreibung", condition: "Bedingung", conditions: "Bedingungen",
    }, boolean: { yes: "Ja", no: "Nein" },
  },
};

export function getFlowchartCopy(locale: Locale): AutomationFlowchartCopy {
  return copy[locale as AutomationFlowchartLocale] ?? copy.en;
}
