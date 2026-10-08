import type { Locale } from "./translations";
import callWebhookHelp, { type CallWebhookHelpCopy } from "./automation-call-webhook-help";

export type AutomationEditorCopy = CallWebhookHelpCopy & {
  help: string;
  whenTitle: string;
  when: string[];
  ifTitle: string;
  if: string[];
  thenTitle: string;
  then: string[];
  notifyTitle: string;
  notify: string[];
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
    ...callWebhookHelp.en,
    notifyTitle: "Notify a user — internal notification",
    notify: [
      "Creates an internal INDEXUS notification. It appears under the bell in the top bar (if enabled for the user) and in the notification centre. The bell shows the unread count.",
      "For signed-in recipients, the list updates live. For offline recipients, the notification is saved and is available after sign-in. This action does not itself open a pop-up or play a sound.",
      "Choose the recipient, priority, title and message. A group or role sends a separate notification to each member. Priority marks importance; it does not change the delivery channel.",
      "It does not send email, SMS or a mobile push, and does not create or assign a Task. Use separate THEN actions for those operations. Example: when a Task is completed, notify its creator under the bell.",
    ],
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
    ...callWebhookHelp.sk,
    notifyTitle: "Upozorniť používateľa — interná notifikácia",
    notify: [
      "Vytvorí interné upozornenie v INDEXUS. Zobrazí sa pod zvončekom v hornej lište (ak ho má používateľ zapnutý) a v centre notifikácií. Zvonček ukazuje počet neprečítaných upozornení.",
      "Prihláseným príjemcom sa zoznam aktualizuje priebežne. Neprihláseným sa upozornenie uloží a nájdu ho po prihlásení. Táto akcia sama neotvára vyskakovacie okno ani neprehráva zvuk.",
      "Vyberte príjemcu, prioritu, nadpis a text správy. Pri skupine alebo role dostane každý člen vlastné upozornenie. Priorita označuje dôležitosť, nemení spôsob doručenia.",
      "Neposiela e-mail, SMS ani mobilnú push notifikáciu a nevytvára ani nepriraďuje Task. Na tieto operácie použite samostatné THEN akcie. Príklad: keď sa Task dokončí, upozornite jeho tvorcu pod zvončekom.",
    ],
    help: "Pomoc", whenTitle: "Kedy — spúšťač", when: ["Vyberte udalosť alebo plán a potom oprávnený rozsah záznamov. Dostupné moduly a udalosti závisia od podporovaných kombinácií pravidiel. Plán sa spúšťa v nastavenom intervale; udalosť pri jej vzniku."],
    ifTitle: "Ak — ďalšie kontroly", if: ["Podmienky pridajte len vtedy, keď spúšťač potrebuje ďalšie filtrovanie. VŠETKY vyžaduje zhodu každej kontroly; ĽUBOVOĽNÁ aspoň jednej. Bez podmienok sa neuplatní ďalší filter. Jednorazové plány podmienky Ak nepoužívajú."],
    thenTitle: "Potom — akcie", then: ["Akcie sa vykonajú v poradí po zhode spúšťača a podmienok. Vybraná skupina dostane jednu spoločnú úlohu. Vybraní ľudia dostanú osobné úlohy; členovia rolí tiež osobné úlohy, bez duplicitných úloh pri prekrývaní."],
    chooseRecipients: "Vybrať príjemcov", groupsFirst: "Skupiny", people: "Ľudia", groups: "Skupiny", roles: "Roly", searchRecipients: "Hľadať príjemcov…",
    noMatches: "Nenašli sa príjemcovia.", unavailable: "Uložený príjemca nie je dostupný", selectionSummary: "Vybraní príjemcovia", apply: "Použiť", cancel: "Zrušiť",
    language: "Jazyk šablóny", allLanguages: "Všetky jazyky", currentSnapshot: "Aktuálna uložená kópia",
  },
  cs: {
    ...callWebhookHelp.cs,
    notifyTitle: "Upozornit uživatele — interní notifikace",
    notify: [
      "Vytvoří interní upozornění v INDEXUS. Zobrazí se pod zvonkem v horní liště (pokud ho má uživatel zapnutý) a v centru notifikací. Zvonek ukazuje počet nepřečtených upozornění.",
      "Přihlášeným příjemcům se seznam aktualizuje průběžně. Nepřihlášeným se upozornění uloží a najdou ho po přihlášení. Tato akce sama neotevírá vyskakovací okno ani nepřehrává zvuk.",
      "Vyberte příjemce, prioritu, nadpis a text zprávy. U skupiny nebo role dostane každý člen vlastní upozornění. Priorita označuje důležitost, nemění způsob doručení.",
      "Neposílá e-mail, SMS ani mobilní push notifikaci a nevytváří ani nepřiřazuje Task. Pro tyto operace použijte samostatné THEN akce. Příklad: při dokončení Tasku upozorněte jeho tvůrce pod zvonkem.",
    ],
    help: "Nápověda", whenTitle: "Kdy — spouštěč", when: ["Vyberte událost nebo plán a poté oprávněný rozsah záznamů. Dostupné moduly a události jsou omezeny podporovanými kombinacemi pravidel. Plán se spouští v nastaveném intervalu; událost při svém vzniku."],
    ifTitle: "Pokud — další kontroly", if: ["Podmínky přidávejte jen tehdy, když spouštěč potřebuje další filtrování. VŠECHNY vyžaduje shodu každé kontroly; LIBOVOLNÁ alespoň jedné. Bez podmínek se nepoužije další filtr. Jednorázové plány podmínky Pokud nepoužívají."],
    thenTitle: "Pak — akce", then: ["Akce se provedou v pořadí po shodě spouštěče a podmínek. Vybraná skupina dostane jeden společný úkol. Vybrané osoby dostanou osobní úkoly; členové rolí také osobní úkoly, bez duplicit při překryvu."],
    chooseRecipients: "Vybrat příjemce", groupsFirst: "Skupiny", people: "Osoby", groups: "Skupiny", roles: "Role", searchRecipients: "Hledat příjemce…",
    noMatches: "Žádní odpovídající příjemci.", unavailable: "Uložený příjemce není dostupný", selectionSummary: "Vybraní příjemci", apply: "Použít", cancel: "Zrušit",
    language: "Jazyk šablony", allLanguages: "Všechny jazyky", currentSnapshot: "Aktuální uložená kopie",
  },
  hu: {
    ...callWebhookHelp.hu,
    notifyTitle: "Felhasználó értesítése — belső értesítés",
    notify: [
      "Belső INDEXUS-értesítést hoz létre. A felső sáv harangja alatt (ha a felhasználónál engedélyezett) és az értesítési központban jelenik meg. A harang az olvasatlan értesítések számát mutatja.",
      "A bejelentkezett címzettek listája élőben frissül. A kijelentkezett címzettek értesítését a rendszer elmenti, és bejelentkezés után elérhető. Ez a művelet önmagában nem nyit felugró ablakot és nem játszik le hangot.",
      "Válassza ki a címzettet, a prioritást, a címet és az üzenetet. Csoport vagy szerepkör esetén minden tag külön értesítést kap. A prioritás a fontosságot jelöli, nem változtatja meg a kézbesítési csatornát.",
      "Nem küld e-mailt, SMS-t vagy mobil push értesítést, és nem hoz létre vagy rendel hozzá Taskot. Ezekhez külön THEN-műveleteket használjon. Példa: egy Task befejezésekor értesítse annak létrehozóját a harang alatt.",
    ],
    help: "Súgó", whenTitle: "Mikor — indító", when: ["Válasszon eseményt vagy ütemezést, majd adja meg a jogosult rekordkört. Az elérhető modulokat és eseményeket a szabály támogatott kombinációi korlátozzák. Az ütemezés a beállított időközönként, az esemény annak bekövetkezésekor indul."],
    ifTitle: "Ha — további ellenőrzések", if: ["Csak akkor adjon hozzá feltételeket, ha további szűrés szükséges. A MIND feltétel minden ellenőrzés egyezését, a BÁRMELY legalább egyét követeli meg. Feltétel nélkül nincs további szűrés. Az egyszeri ütemezés nem használ Ha-feltételeket."],
    thenTitle: "Akkor — műveletek", then: ["A műveletek sorrendben futnak, miután az indító és a feltételek egyeznek. A kiválasztott csoport egy közös feladatot kap. A kiválasztott személyek és szerepkör-tagok személyes feladatot kapnak; az átfedések nem hoznak létre duplikátumot."],
    chooseRecipients: "Címzettek kiválasztása", groupsFirst: "Csoportok", people: "Személyek", groups: "Csoportok", roles: "Szerepkörök", searchRecipients: "Címzettek keresése…",
    noMatches: "Nincs egyező címzett.", unavailable: "A mentett címzett nem érhető el", selectionSummary: "Kiválasztott címzettek", apply: "Alkalmaz", cancel: "Mégse",
    language: "Sablon nyelve", allLanguages: "Minden nyelv", currentSnapshot: "Jelenlegi mentett példány",
  },
  ro: {
    ...callWebhookHelp.ro,
    notifyTitle: "Notifică un utilizator — notificare internă",
    notify: [
      "Creează o notificare internă în INDEXUS. Apare sub clopoțelul din bara de sus (dacă este activat pentru utilizator) și în centrul de notificări. Clopoțelul arată numărul notificărilor necitite.",
      "Lista destinatarilor conectați se actualizează în timp real. Pentru cei deconectați, notificarea este salvată și disponibilă după conectare. Această acțiune nu deschide singură o fereastră pop-up și nu redă un sunet.",
      "Alegeți destinatarul, prioritatea, titlul și mesajul. Pentru un grup sau rol, fiecare membru primește o notificare separată. Prioritatea indică importanța, nu schimbă canalul de livrare.",
      "Nu trimite e-mail, SMS sau notificări push pe mobil și nu creează sau atribuie un Task. Folosiți acțiuni THEN separate pentru acestea. Exemplu: la finalizarea unui Task, notificați creatorul acestuia sub clopoțel.",
    ],
    help: "Ajutor", whenTitle: "Când — declanșator", when: ["Alegeți un eveniment sau un program, apoi un domeniu eligibil de înregistrări. Modulele și evenimentele disponibile sunt limitate la combinațiile acceptate. Programul rulează la intervalul stabilit; evenimentul când acesta are loc."],
    ifTitle: "Dacă — verificări suplimentare", if: ["Adăugați condiții doar pentru filtrare suplimentară. TOATE cere ca fiecare verificare să corespundă; ORICARE cere cel puțin una. Fără condiții nu există filtru suplimentar. Programele unice nu folosesc condiții."],
    thenTitle: "Atunci — acțiuni", then: ["Acțiunile rulează în ordine după potrivirea declanșatorului și a condițiilor. Un grup selectat primește o singură sarcină comună. Persoanele selectate și membrii rolurilor primesc sarcini personale, deduplicate inclusiv între roluri."],
    chooseRecipients: "Alege destinatarii", groupsFirst: "Grupuri", people: "Persoane", groups: "Grupuri", roles: "Roluri", searchRecipients: "Caută destinatari…",
    noMatches: "Nu există destinatari potriviți.", unavailable: "Destinatarul salvat nu este disponibil", selectionSummary: "Destinatari selectați", apply: "Aplică", cancel: "Anulează",
    language: "Limba șablonului", allLanguages: "Toate limbile", currentSnapshot: "Instantaneul salvat curent",
  },
  it: {
    ...callWebhookHelp.it,
    notifyTitle: "Notifica un utente — notifica interna",
    notify: [
      "Crea una notifica interna in INDEXUS. Appare sotto la campanella nella barra superiore (se abilitata per l’utente) e nel centro notifiche. La campanella mostra il numero di notifiche non lette.",
      "L’elenco dei destinatari connessi si aggiorna in tempo reale. Per quelli non connessi, la notifica viene salvata ed è disponibile dopo l’accesso. Questa azione da sola non apre finestre pop-up e non riproduce suoni.",
      "Scegliere destinatario, priorità, titolo e messaggio. Per un gruppo o ruolo, ogni membro riceve una notifica separata. La priorità indica l’importanza, non cambia il canale di consegna.",
      "Non invia e-mail, SMS o notifiche push sul cellulare e non crea né assegna un Task. Usare azioni THEN separate per queste operazioni. Esempio: al completamento di un Task, notificare il suo creatore sotto la campanella.",
    ],
    help: "Guida", whenTitle: "Quando — attivazione", when: ["Scegli un evento o una pianificazione, quindi un ambito di record ammesso. Moduli ed eventi disponibili dipendono dalle combinazioni supportate. La pianificazione si attiva all’intervallo impostato; l’evento quando si verifica."],
    ifTitle: "Se — controlli aggiuntivi", if: ["Aggiungi condizioni solo per filtrare ulteriormente. TUTTE richiede che ogni controllo corrisponda; QUALSIASI ne richiede almeno uno. Senza condizioni non viene applicato alcun filtro aggiuntivo. Le pianificazioni singole non usano condizioni."],
    thenTitle: "Allora — azioni", then: ["Le azioni vengono eseguite in ordine dopo la corrispondenza dell’attivazione e delle condizioni. Un gruppo selezionato riceve un’unica attività condivisa. Persone selezionate e membri dei ruoli ricevono attività personali, deduplicate anche tra ruoli sovrapposti."],
    chooseRecipients: "Scegli destinatari", groupsFirst: "Gruppi", people: "Persone", groups: "Gruppi", roles: "Ruoli", searchRecipients: "Cerca destinatari…",
    noMatches: "Nessun destinatario corrispondente.", unavailable: "Destinatario salvato non disponibile", selectionSummary: "Destinatari selezionati", apply: "Applica", cancel: "Annulla",
    language: "Lingua del modello", allLanguages: "Tutte le lingue", currentSnapshot: "Snapshot salvato corrente",
  },
  de: {
    ...callWebhookHelp.de,
    notifyTitle: "Benutzer benachrichtigen — interne Benachrichtigung",
    notify: [
      "Erstellt eine interne INDEXUS-Benachrichtigung. Sie erscheint unter der Glocke in der oberen Leiste (falls für den Benutzer aktiviert) und im Benachrichtigungszentrum. Die Glocke zeigt die Anzahl ungelesener Benachrichtigungen.",
      "Bei angemeldeten Empfängern wird die Liste live aktualisiert. Für abgemeldete Empfänger wird die Benachrichtigung gespeichert und ist nach der Anmeldung verfügbar. Diese Aktion öffnet selbst kein Pop-up und spielt keinen Ton ab.",
      "Wählen Sie Empfänger, Priorität, Titel und Nachricht. Bei einer Gruppe oder Rolle erhält jedes Mitglied eine eigene Benachrichtigung. Die Priorität kennzeichnet die Wichtigkeit, nicht den Zustellkanal.",
      "Sendet keine E-Mail, SMS oder mobile Push-Nachricht und erstellt oder weist keinen Task zu. Verwenden Sie dafür separate THEN-Aktionen. Beispiel: Nach Abschluss eines Tasks dessen Ersteller unter der Glocke benachrichtigen.",
    ],
    help: "Hilfe", whenTitle: "Wann — Auslöser", when: ["Wählen Sie ein Ereignis oder einen Zeitplan und anschließend einen zulässigen Datensatzbereich. Verfügbare Module und Ereignisse sind auf unterstützte Regelkombinationen begrenzt. Ein Zeitplan läuft im festgelegten Intervall, ein Ereignis bei seinem Eintreten."],
    ifTitle: "Falls — zusätzliche Prüfungen", if: ["Fügen Sie Bedingungen nur für eine zusätzliche Filterung hinzu. ALLE verlangt, dass jede Prüfung zutrifft; BELIEBIGE mindestens eine. Ohne Bedingungen gibt es keinen Zusatzfilter. Einmalige Zeitpläne verwenden keine Falls-Bedingungen."],
    thenTitle: "Dann — Aktionen", then: ["Aktionen werden der Reihe nach ausgeführt, wenn Auslöser und Bedingungen zutreffen. Eine ausgewählte Gruppe erhält eine gemeinsame Aufgabe. Ausgewählte Personen und Rollenmitglieder erhalten persönliche Aufgaben; Überschneidungen werden dedupliziert."],
    chooseRecipients: "Empfänger auswählen", groupsFirst: "Gruppen", people: "Personen", groups: "Gruppen", roles: "Rollen", searchRecipients: "Empfänger suchen…",
    noMatches: "Keine passenden Empfänger.", unavailable: "Gespeicherter Empfänger nicht verfügbar", selectionSummary: "Ausgewählte Empfänger", apply: "Übernehmen", cancel: "Abbrechen",
    language: "Vorlagensprache", allLanguages: "Alle Sprachen", currentSnapshot: "Aktueller gespeicherter Snapshot",
  },
};

export default copy;
