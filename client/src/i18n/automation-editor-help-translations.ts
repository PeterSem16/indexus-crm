import type { Locale } from "./translations";

export type AutomationEditorCopy = {
  help: string;
  whenTitle: string;
  when: string[];
  ifTitle: string;
  if: string[];
  thenTitle: string;
  then: string[];
  chooseRecipients: string;
  groupsFirst: string;
  people: string;
  groups: string;
  roles: string;
  searchRecipients: string;
  noMatches: string;
  unavailable: string;
  selectionSummary: string;
  apply: string;
  cancel: string;
  language: string;
  allLanguages: string;
  currentSnapshot: string;
};

const copy: Record<Locale, AutomationEditorCopy> = {
  en: {
    help: "Help",
    whenTitle: "When — trigger",
    when: ["Choose an event or a schedule, then select an eligible record scope. Available modules and events are limited to supported rule combinations. A schedule runs at its interval; an event runs when the selected event occurs."],
    ifTitle: "If — extra checks",
    if: ["Add conditions only when the trigger needs extra filtering. ALL requires every check to match; ANY requires at least one. No conditions means no extra filter. One-time schedules do not use IF conditions."],
    thenTitle: "Then — actions",
    then: ["Actions run in order after the trigger and any IF checks match. A selected group receives one shared task. Selected people receive personal tasks; role members also receive personal tasks, deduplicated across people and overlapping roles."],
    chooseRecipients: "Choose recipients", groupsFirst: "Groups", people: "People", groups: "Groups", roles: "Roles",
    searchRecipients: "Search recipients…", noMatches: "No matching recipients.", unavailable: "Saved recipient unavailable",
    selectionSummary: "Selected recipients", apply: "Apply", cancel: "Cancel", language: "Template language",
    allLanguages: "All languages", currentSnapshot: "Current saved snapshot",
  },
  sk: {
    help: "Pomoc", whenTitle: "Kedy — spúšťač", when: ["Vyberte udalosť alebo plán a potom oprávnený rozsah záznamov. Dostupné moduly a udalosti závisia od podporovaných kombinácií pravidiel. Plán sa spúšťa v nastavenom intervale; udalosť pri jej vzniku."],
    ifTitle: "Ak — ďalšie kontroly", if: ["Podmienky pridajte len vtedy, keď spúšťač potrebuje ďalšie filtrovanie. VŠETKY vyžaduje zhodu každej kontroly; ĽUBOVOĽNÁ aspoň jednej. Bez podmienok sa neuplatní ďalší filter. Jednorazové plány podmienky Ak nepoužívajú."],
    thenTitle: "Potom — akcie", then: ["Akcie sa vykonajú v poradí po zhode spúšťača a podmienok. Vybraná skupina dostane jednu spoločnú úlohu. Vybraní ľudia dostanú osobné úlohy; členovia rolí tiež osobné úlohy, bez duplicitných úloh pri prekrývaní."],
    chooseRecipients: "Vybrať príjemcov", groupsFirst: "Skupiny", people: "Ľudia", groups: "Skupiny", roles: "Roly", searchRecipients: "Hľadať príjemcov…",
    noMatches: "Nenašli sa príjemcovia.", unavailable: "Uložený príjemca nie je dostupný", selectionSummary: "Vybraní príjemcovia", apply: "Použiť", cancel: "Zrušiť",
    language: "Jazyk šablóny", allLanguages: "Všetky jazyky", currentSnapshot: "Aktuálna uložená kópia",
  },
  cs: {
    help: "Nápověda", whenTitle: "Kdy — spouštěč", when: ["Vyberte událost nebo plán a poté oprávněný rozsah záznamů. Dostupné moduly a události jsou omezeny podporovanými kombinacemi pravidel. Plán se spouští v nastaveném intervalu; událost při svém vzniku."],
    ifTitle: "Pokud — další kontroly", if: ["Podmínky přidávejte jen tehdy, když spouštěč potřebuje další filtrování. VŠECHNY vyžaduje shodu každé kontroly; LIBOVOLNÁ alespoň jedné. Bez podmínek se nepoužije další filtr. Jednorázové plány podmínky Pokud nepoužívají."],
    thenTitle: "Pak — akce", then: ["Akce se provedou v pořadí po shodě spouštěče a podmínek. Vybraná skupina dostane jeden společný úkol. Vybrané osoby dostanou osobní úkoly; členové rolí také osobní úkoly, bez duplicit při překryvu."],
    chooseRecipients: "Vybrat příjemce", groupsFirst: "Skupiny", people: "Osoby", groups: "Skupiny", roles: "Role", searchRecipients: "Hledat příjemce…",
    noMatches: "Žádní odpovídající příjemci.", unavailable: "Uložený příjemce není dostupný", selectionSummary: "Vybraní příjemci", apply: "Použít", cancel: "Zrušit",
    language: "Jazyk šablony", allLanguages: "Všechny jazyky", currentSnapshot: "Aktuální uložená kopie",
  },
  hu: {
    help: "Súgó", whenTitle: "Mikor — indító", when: ["Válasszon eseményt vagy ütemezést, majd adja meg a jogosult rekordkört. Az elérhető modulokat és eseményeket a szabály támogatott kombinációi korlátozzák. Az ütemezés a beállított időközönként, az esemény annak bekövetkezésekor indul."],
    ifTitle: "Ha — további ellenőrzések", if: ["Csak akkor adjon hozzá feltételeket, ha további szűrés szükséges. A MIND feltétel minden ellenőrzés egyezését, a BÁRMELY legalább egyét követeli meg. Feltétel nélkül nincs további szűrés. Az egyszeri ütemezés nem használ Ha-feltételeket."],
    thenTitle: "Akkor — műveletek", then: ["A műveletek sorrendben futnak, miután az indító és a feltételek egyeznek. A kiválasztott csoport egy közös feladatot kap. A kiválasztott személyek és szerepkör-tagok személyes feladatot kapnak; az átfedések nem hoznak létre duplikátumot."],
    chooseRecipients: "Címzettek kiválasztása", groupsFirst: "Csoportok", people: "Személyek", groups: "Csoportok", roles: "Szerepkörök", searchRecipients: "Címzettek keresése…",
    noMatches: "Nincs egyező címzett.", unavailable: "A mentett címzett nem érhető el", selectionSummary: "Kiválasztott címzettek", apply: "Alkalmaz", cancel: "Mégse",
    language: "Sablon nyelve", allLanguages: "Minden nyelv", currentSnapshot: "Jelenlegi mentett példány",
  },
  ro: {
    help: "Ajutor", whenTitle: "Când — declanșator", when: ["Alegeți un eveniment sau un program, apoi un domeniu eligibil de înregistrări. Modulele și evenimentele disponibile sunt limitate la combinațiile acceptate. Programul rulează la intervalul stabilit; evenimentul când acesta are loc."],
    ifTitle: "Dacă — verificări suplimentare", if: ["Adăugați condiții doar pentru filtrare suplimentară. TOATE cere ca fiecare verificare să corespundă; ORICARE cere cel puțin una. Fără condiții nu există filtru suplimentar. Programele unice nu folosesc condiții."],
    thenTitle: "Atunci — acțiuni", then: ["Acțiunile rulează în ordine după potrivirea declanșatorului și a condițiilor. Un grup selectat primește o singură sarcină comună. Persoanele selectate și membrii rolurilor primesc sarcini personale, deduplicate inclusiv între roluri."],
    chooseRecipients: "Alege destinatarii", groupsFirst: "Grupuri", people: "Persoane", groups: "Grupuri", roles: "Roluri", searchRecipients: "Caută destinatari…",
    noMatches: "Nu există destinatari potriviți.", unavailable: "Destinatarul salvat nu este disponibil", selectionSummary: "Destinatari selectați", apply: "Aplică", cancel: "Anulează",
    language: "Limba șablonului", allLanguages: "Toate limbile", currentSnapshot: "Instantaneul salvat curent",
  },
  it: {
    help: "Guida", whenTitle: "Quando — attivazione", when: ["Scegli un evento o una pianificazione, quindi un ambito di record ammesso. Moduli ed eventi disponibili dipendono dalle combinazioni supportate. La pianificazione si attiva all’intervallo impostato; l’evento quando si verifica."],
    ifTitle: "Se — controlli aggiuntivi", if: ["Aggiungi condizioni solo per filtrare ulteriormente. TUTTE richiede che ogni controllo corrisponda; QUALSIASI ne richiede almeno uno. Senza condizioni non viene applicato alcun filtro aggiuntivo. Le pianificazioni singole non usano condizioni."],
    thenTitle: "Allora — azioni", then: ["Le azioni vengono eseguite in ordine dopo la corrispondenza dell’attivazione e delle condizioni. Un gruppo selezionato riceve un’unica attività condivisa. Persone selezionate e membri dei ruoli ricevono attività personali, deduplicate anche tra ruoli sovrapposti."],
    chooseRecipients: "Scegli destinatari", groupsFirst: "Gruppi", people: "Persone", groups: "Gruppi", roles: "Ruoli", searchRecipients: "Cerca destinatari…",
    noMatches: "Nessun destinatario corrispondente.", unavailable: "Destinatario salvato non disponibile", selectionSummary: "Destinatari selezionati", apply: "Applica", cancel: "Annulla",
    language: "Lingua del modello", allLanguages: "Tutte le lingue", currentSnapshot: "Snapshot salvato corrente",
  },
  de: {
    help: "Hilfe", whenTitle: "Wann — Auslöser", when: ["Wählen Sie ein Ereignis oder einen Zeitplan und anschließend einen zulässigen Datensatzbereich. Verfügbare Module und Ereignisse sind auf unterstützte Regelkombinationen begrenzt. Ein Zeitplan läuft im festgelegten Intervall, ein Ereignis bei seinem Eintreten."],
    ifTitle: "Falls — zusätzliche Prüfungen", if: ["Fügen Sie Bedingungen nur für eine zusätzliche Filterung hinzu. ALLE verlangt, dass jede Prüfung zutrifft; BELIEBIGE mindestens eine. Ohne Bedingungen gibt es keinen Zusatzfilter. Einmalige Zeitpläne verwenden keine Falls-Bedingungen."],
    thenTitle: "Dann — Aktionen", then: ["Aktionen werden der Reihe nach ausgeführt, wenn Auslöser und Bedingungen zutreffen. Eine ausgewählte Gruppe erhält eine gemeinsame Aufgabe. Ausgewählte Personen und Rollenmitglieder erhalten persönliche Aufgaben; Überschneidungen werden dedupliziert."],
    chooseRecipients: "Empfänger auswählen", groupsFirst: "Gruppen", people: "Personen", groups: "Gruppen", roles: "Rollen", searchRecipients: "Empfänger suchen…",
    noMatches: "Keine passenden Empfänger.", unavailable: "Gespeicherter Empfänger nicht verfügbar", selectionSummary: "Ausgewählte Empfänger", apply: "Übernehmen", cancel: "Abbrechen",
    language: "Vorlagensprache", allLanguages: "Alle Sprachen", currentSnapshot: "Aktueller gespeicherter Snapshot",
  },
};

export default copy;
