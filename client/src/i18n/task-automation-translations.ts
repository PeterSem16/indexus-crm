import type { Locale } from "./translations";

export interface TaskAutomationCopy {
  assignmentTargets: string;
  allAssignments: string;
  assignmentHint: string;
  resolverGroupHint: string;
  resolvedAtHint: string;
  eventDescriptions: Record<string, string>;
  fieldLabels: Record<string, string>;
}

const fieldKeys = [
  "id", "title", "priority", "status", "assignedUserId", "assignedDepartmentId", "taskGroupIds",
  "createdByUserId", "dueDate", "customerId", "relatedEntityType", "relatedEntityId",
  "resolvedByUserId", "resolvedByGroupIds", "resolvedAt", "boState", "createdAt", "updatedAt",
] as const;
function labels(values: string[]) {
  return Object.fromEntries(fieldKeys.map((key, index) => [`newValues.${key}`, values[index]]));
}

export const taskAutomationTranslations: Record<Locale, TaskAutomationCopy> = {
  en: {
    assignmentTargets: "Assigned to", allAssignments: "Any assignment",
    assignmentHint: "Match any assignment, selected task groups, or selected people. A shared task's nominal owner is not a personal assignment.",
    resolverGroupHint: "Matches the resolver's group membership at the time of this event.",
    resolvedAtHint: "Resolution date/time, not a person. Choose a date to filter when the task was resolved.",
    eventDescriptions: {
      created: "A task is created, regardless of who created it.",
      updated: "Any task edit is saved: title, priority, deadline, assignment or status.",
      status_changed: "Only the task status changes, for example Pending → In progress. Other edits do not trigger this event.",
      "task.assigned": "A task is assigned or reassigned to a group or a person.",
      "task.completed": "A task is resolved and its status becomes Completed.",
      "task.overdue": "An unfinished task passes its resolution deadline.",
    },
    fieldLabels: labels(["Task ID", "Title", "Priority", "Status", "Assignee (person)", "Assigned department", "Assigned task group", "Created by", "Due date", "Linked customer ID", "Related record type", "Related record ID", "Resolved by (person)", "Resolved by (group)", "Resolved at", "Back Office state", "Created at", "Updated at"]),
  },
  sk: {
    assignmentTargets: "Priradené komu", allAssignments: "Akékoľvek priradenie",
    assignmentHint: "Sleduje všetky priradenia, vybrané skupiny úloh alebo konkrétnych ľudí. Evidenčný vlastník spoločnej úlohy nie je osobné priradenie.",
    resolverGroupHint: "Sleduje členstvo riešiteľa v skupine v čase tejto udalosti.",
    resolvedAtHint: "Dátum a čas vyriešenia, nie osoba. Vyberte dátum, podľa ktorého sa má filtrovať vyriešenie úlohy.",
    eventDescriptions: {
      created: "Vytvorí sa úloha bez ohľadu na to, kto ju vytvoril.",
      updated: "Uloží sa ľubovoľná úprava úlohy: názov, priorita, termín, priradenie alebo stav.",
      status_changed: "Zmení sa iba stav úlohy, napríklad Čakajúca → V riešení. Iné úpravy túto udalosť nespustia.",
      "task.assigned": "Úloha sa priradí alebo presunie skupine či konkrétnemu človeku.",
      "task.completed": "Úloha je vyriešená a jej stav sa zmení na Dokončená.",
      "task.overdue": "Nevyriešená úloha prekročí požadovaný termín riešenia.",
    },
    fieldLabels: labels(["ID úlohy", "Názov", "Priorita", "Stav", "Priradená osoba", "Priradené oddelenie", "Priradená skupina úloh", "Vytvoril", "Termín riešenia", "ID prepojeného klienta", "Typ súvisiaceho záznamu", "ID súvisiaceho záznamu", "Vyriešil (osoba)", "Vyriešil (skupina)", "Čas vyriešenia", "Stav Back Office", "Čas vytvorenia", "Čas úpravy"]),
  },
  cs: {
    assignmentTargets: "Přiřazeno komu", allAssignments: "Jakékoli přiřazení",
    assignmentHint: "Sleduje všechna přiřazení, vybrané skupiny úkolů nebo konkrétní lidi. Evidenční vlastník společného úkolu není osobní přiřazení.",
    resolverGroupHint: "Sleduje členství řešitele ve skupině v době této události.",
    resolvedAtHint: "Datum a čas vyřešení, nikoli osoba. Vyberte datum pro filtrování vyřešených úkolů.",
    eventDescriptions: {
      created: "Vytvoří se úkol bez ohledu na to, kdo jej vytvořil.",
      updated: "Uloží se libovolná úprava úkolu: název, priorita, termín, přiřazení nebo stav.",
      status_changed: "Změní se pouze stav úkolu, například Čekající → V řešení. Jiné úpravy tuto událost nespustí.",
      "task.assigned": "Úkol se přiřadí nebo přesune skupině či konkrétnímu člověku.",
      "task.completed": "Úkol je vyřešen a jeho stav se změní na Dokončený.",
      "task.overdue": "Nevyřešený úkol překročí požadovaný termín řešení.",
    },
    fieldLabels: labels(["ID úkolu", "Název", "Priorita", "Stav", "Přiřazená osoba", "Přiřazené oddělení", "Přiřazená skupina úkolů", "Vytvořil", "Termín řešení", "ID propojeného klienta", "Typ souvisejícího záznamu", "ID souvisejícího záznamu", "Vyřešil (osoba)", "Vyřešil (skupina)", "Čas vyřešení", "Stav Back Office", "Čas vytvoření", "Čas úpravy"]),
  },
  hu: {
    assignmentTargets: "Hozzárendelve", allAssignments: "Bármely hozzárendelés",
    assignmentHint: "Minden hozzárendelésre, kijelölt feladatcsoportokra vagy személyekre illeszkedik. A közös feladat névleges tulajdonosa nem személyes hozzárendelés.",
    resolverGroupHint: "A megoldó csoporttagságát vizsgálja az esemény időpontjában.",
    resolvedAtHint: "A megoldás dátuma és ideje, nem személy. Válasszon dátumot a megoldás idejének szűréséhez.",
    eventDescriptions: {
      created: "Feladat jön létre, függetlenül a létrehozójától.",
      updated: "A feladat bármely módosítását elmentik: cím, prioritás, határidő, hozzárendelés vagy állapot.",
      status_changed: "Csak a feladat állapota változik, például Függőben → Folyamatban. Más módosítás nem indítja el.",
      "task.assigned": "Feladatot rendelnek vagy adnak át egy csoportnak vagy személynek.",
      "task.completed": "A feladat megoldott, állapota Befejezett lesz.",
      "task.overdue": "Egy megoldatlan feladat túllépi a megoldási határidőt.",
    },
    fieldLabels: labels(["Feladatazonosító", "Cím", "Prioritás", "Állapot", "Hozzárendelt személy", "Hozzárendelt részleg", "Hozzárendelt feladatcsoport", "Létrehozó", "Határidő", "Kapcsolt ügyfélazonosító", "Kapcsolódó rekord típusa", "Kapcsolódó rekord azonosítója", "Megoldó (személy)", "Megoldó (csoport)", "Megoldás ideje", "Back Office állapot", "Létrehozás ideje", "Módosítás ideje"]),
  },
  ro: {
    assignmentTargets: "Atribuit către", allAssignments: "Orice atribuire",
    assignmentHint: "Urmărește toate atribuirile, grupurile de sarcini selectate sau persoanele selectate. Proprietarul nominal al unei sarcini comune nu este o atribuire personală.",
    resolverGroupHint: "Verifică apartenența rezolvitorului la grup în momentul evenimentului.",
    resolvedAtHint: "Data și ora rezolvării, nu o persoană. Alegeți o dată pentru a filtra momentul rezolvării.",
    eventDescriptions: {
      created: "Se creează o sarcină, indiferent cine o creează.",
      updated: "Se salvează orice modificare: titlu, prioritate, termen, atribuire sau stare.",
      status_changed: "Se schimbă doar starea sarcinii, de exemplu În așteptare → În curs. Alte modificări nu declanșează evenimentul.",
      "task.assigned": "O sarcină este atribuită sau reatribuită unui grup sau unei persoane.",
      "task.completed": "Sarcina este rezolvată și starea devine Finalizată.",
      "task.overdue": "O sarcină nerezolvată depășește termenul de rezolvare.",
    },
    fieldLabels: labels(["ID sarcină", "Titlu", "Prioritate", "Stare", "Persoană atribuită", "Departament atribuit", "Grup de sarcini atribuit", "Creat de", "Termen de rezolvare", "ID client asociat", "Tip înregistrare asociată", "ID înregistrare asociată", "Rezolvat de (persoană)", "Rezolvat de (grup)", "Ora rezolvării", "Stare Back Office", "Data creării", "Data modificării"]),
  },
  it: {
    assignmentTargets: "Assegnata a", allAssignments: "Qualsiasi assegnazione",
    assignmentHint: "Corrisponde a tutte le assegnazioni, ai gruppi di attività o alle persone selezionate. Il titolare nominale di un'attività condivisa non è un'assegnazione personale.",
    resolverGroupHint: "Verifica l'appartenenza del risolutore al gruppo al momento dell'evento.",
    resolvedAtHint: "Data e ora della risoluzione, non una persona. Scegli una data per filtrare il momento della risoluzione.",
    eventDescriptions: {
      created: "Viene creata un'attività, indipendentemente da chi la crea.",
      updated: "Viene salvata qualsiasi modifica: titolo, priorità, scadenza, assegnazione o stato.",
      status_changed: "Cambia solo lo stato dell'attività, ad esempio In attesa → In corso. Altre modifiche non avviano l'evento.",
      "task.assigned": "Un'attività viene assegnata o riassegnata a un gruppo o a una persona.",
      "task.completed": "L'attività viene risolta e lo stato diventa Completata.",
      "task.overdue": "Un'attività non risolta supera il termine di risoluzione.",
    },
    fieldLabels: labels(["ID attività", "Titolo", "Priorità", "Stato", "Persona assegnata", "Reparto assegnato", "Gruppo di attività assegnato", "Creata da", "Scadenza", "ID cliente collegato", "Tipo di record correlato", "ID record correlato", "Risolta da (persona)", "Risolta da (gruppo)", "Data di risoluzione", "Stato Back Office", "Data di creazione", "Data di modifica"]),
  },
  de: {
    assignmentTargets: "Zugewiesen an", allAssignments: "Jede Zuweisung",
    assignmentHint: "Prüft alle Zuweisungen, ausgewählte Aufgabengruppen oder Personen. Der nominelle Eigentümer einer gemeinsamen Aufgabe ist keine persönliche Zuweisung.",
    resolverGroupHint: "Prüft die Gruppenmitgliedschaft des Bearbeiters zum Zeitpunkt des Ereignisses.",
    resolvedAtHint: "Datum und Uhrzeit der Lösung, keine Person. Wählen Sie ein Datum, um den Lösungszeitpunkt zu filtern.",
    eventDescriptions: {
      created: "Eine Aufgabe wird erstellt, unabhängig davon, wer sie erstellt.",
      updated: "Jede Änderung wird gespeichert: Titel, Priorität, Frist, Zuweisung oder Status.",
      status_changed: "Nur der Aufgabenstatus ändert sich, etwa Ausstehend → In Bearbeitung. Andere Änderungen lösen das Ereignis nicht aus.",
      "task.assigned": "Eine Aufgabe wird einer Gruppe oder Person zugewiesen oder neu zugewiesen.",
      "task.completed": "Die Aufgabe wird gelöst und ihr Status wird Abgeschlossen.",
      "task.overdue": "Eine ungelöste Aufgabe überschreitet ihre Lösungsfrist.",
    },
    fieldLabels: labels(["Aufgaben-ID", "Titel", "Priorität", "Status", "Zugewiesene Person", "Zugewiesene Abteilung", "Zugewiesene Aufgabengruppe", "Erstellt von", "Frist", "Verknüpfte Kunden-ID", "Verknüpfter Datensatztyp", "Verknüpfte Datensatz-ID", "Gelöst von (Person)", "Gelöst von (Gruppe)", "Lösungszeitpunkt", "Back Office Status", "Erstellungszeitpunkt", "Änderungszeitpunkt"]),
  },
};
