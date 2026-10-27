export type StatusListRepresentativeInformationCopy = {
  type: string;
  assigned: string;
  unassigned: string;
  unknown: string;
  unnamed: string;
  help: string;
  actions: string;
};

export const statusListRepresentativeInformationTranslations: Record<string, StatusListRepresentativeInformationCopy> = {
  sk: {
    type: "Kontrola koordinátora · informačná správa",
    assigned: "Táto karta je priradená ku koordinátorovi:",
    unassigned: "Táto karta nemá priradeného koordinátora.",
    unknown: "Priradenie koordinátora sa nepodarilo jednoznačne overiť.",
    unnamed: "Meno nie je dostupné",
    help: "Overuje pole Assigned representative kliniky alebo nemocnice, nie agenta priradeného v Mission. Informačná správa sa zobrazí v Nexus Pulse aj pri skrytej zdrojovej otázke.",
    actions: "Akcie nastavte v Pravidlách a akciách: zdrojom je táto otázka, podmienka Odpoveď = Nie znamená chýbajúceho koordinátora. Prvé zapnutie iba uloží východiskový stav bez akcií; ďalšie skutočné zmeny môžu spustiť pravidlá. Otvorenie karty samo akcie neopakuje.",
  },
  en: {
    type: "Coordinator check · information message",
    assigned: "This record is assigned to coordinator:",
    unassigned: "This record has no assigned coordinator.",
    unknown: "The coordinator assignment could not be verified unambiguously.",
    unnamed: "Name unavailable",
    help: "Checks the clinic or hospital's Assigned representative field, not the agent assigned in the Mission. The information message appears in Nexus Pulse even when the source question is hidden.",
    actions: "Configure actions in Rules and actions: use this question as the source; Answer = No means no coordinator. First activation only saves a baseline without actions; subsequent actual changes can trigger rules. Opening the record does not repeat actions.",
  },
  cs: {
    type: "Kontrola koordinátora · informační zpráva",
    assigned: "Tato karta je přiřazena koordinátorovi:",
    unassigned: "Tato karta nemá přiřazeného koordinátora.",
    unknown: "Přiřazení koordinátora se nepodařilo jednoznačně ověřit.",
    unnamed: "Jméno není dostupné",
    help: "Ověřuje pole Assigned representative kliniky nebo nemocnice, nikoli agenta přiřazeného v Mission. Informační zpráva se zobrazí v Nexus Pulse i při skryté zdrojové otázce.",
    actions: "Akce nastavte v Pravidlech a akcích: zdrojem je tato otázka, podmínka Odpověď = Ne znamená chybějícího koordinátora. První zapnutí pouze uloží výchozí stav bez akcí; další skutečné změny mohou spustit pravidla. Otevření karty samo akce neopakuje.",
  },
  hu: {
    type: "Koordinátor ellenőrzése · tájékoztató üzenet",
    assigned: "A rekordhoz rendelt koordinátor:",
    unassigned: "Ehhez a rekordhoz nincs koordinátor rendelve.",
    unknown: "A koordinátor hozzárendelése nem ellenőrizhető egyértelműen.",
    unnamed: "A név nem érhető el",
    help: "A klinika vagy kórház Assigned representative mezőjét ellenőrzi, nem a Mission ügynökét. Az üzenet a Nexus Pulse-ban rejtett forráskérdés esetén is megjelenik.",
    actions: "A műveleteket a Szabályok és műveletek részben állítsa be: a forrás ez a kérdés; Válasz = Nem jelenti a hiányzó koordinátort. Az első bekapcsolás csak alapállapotot ment műveletek nélkül; a későbbi tényleges változások szabályokat indíthatnak. A rekord megnyitása nem ismétli meg a műveleteket.",
  },
  ro: {
    type: "Verificare coordonator · mesaj informativ",
    assigned: "Această fișă este atribuită coordonatorului:",
    unassigned: "Această fișă nu are un coordonator atribuit.",
    unknown: "Atribuirea coordonatorului nu a putut fi verificată fără ambiguitate.",
    unnamed: "Nume indisponibil",
    help: "Verifică câmpul Assigned representative al clinicii sau spitalului, nu agentul atribuit în Mission. Mesajul apare în Nexus Pulse chiar dacă întrebarea sursă este ascunsă.",
    actions: "Configurați acțiunile în Reguli și acțiuni: sursa este această întrebare; Răspuns = Nu indică lipsa coordonatorului. Prima activare salvează doar starea inițială fără acțiuni; modificările reale ulterioare pot declanșa reguli. Deschiderea fișei nu repetă acțiunile.",
  },
  it: {
    type: "Verifica coordinatore · messaggio informativo",
    assigned: "Questa scheda è assegnata al coordinatore:",
    unassigned: "Questa scheda non ha un coordinatore assegnato.",
    unknown: "Non è stato possibile verificare univocamente il coordinatore assegnato.",
    unnamed: "Nome non disponibile",
    help: "Verifica il campo Assigned representative della clinica o dell'ospedale, non l'agente della Mission. Il messaggio appare in Nexus Pulse anche se la domanda sorgente è nascosta.",
    actions: "Configurare le azioni in Regole e azioni: la sorgente è questa domanda; Risposta = No indica l'assenza del coordinatore. La prima attivazione salva solo lo stato iniziale senza azioni; le successive modifiche effettive possono attivare regole. Aprire la scheda non ripete le azioni.",
  },
  de: {
    type: "Koordinatorprüfung · Informationsmeldung",
    assigned: "Dieser Datensatz ist folgendem Koordinator zugewiesen:",
    unassigned: "Diesem Datensatz ist kein Koordinator zugewiesen.",
    unknown: "Die Koordinatorzuweisung konnte nicht eindeutig geprüft werden.",
    unnamed: "Name nicht verfügbar",
    help: "Prüft das Feld Assigned representative der Klinik oder des Krankenhauses, nicht den Mission-Agenten. Die Meldung erscheint in Nexus Pulse auch bei ausgeblendeter Quellfrage.",
    actions: "Aktionen unter Regeln und Aktionen konfigurieren: Diese Frage ist die Quelle; Antwort = Nein bedeutet kein Koordinator. Die erste Aktivierung speichert nur den Ausgangszustand ohne Aktionen; spätere tatsächliche Änderungen können Regeln auslösen. Das Öffnen des Datensatzes wiederholt keine Aktionen.",
  },
};
