import type { Locale } from "./translations";

export interface TaskActionCopy {
  templatesLabel: string;
  salutationLabels: Record<string, string>;
  taskType: string;
  taskTitle: string;
  explanation: string;
  title: string;
  description: string;
  recipients: string;
  searchRecipients: string;
  noRecipients: string;
  selected: string;
  users: string;
  groups: string;
  roles: string;
  legacyDepartment: string;
  priority: string;
  due: string;
  noDeadline: string;
  relative: string;
  fixedDate: string;
  duration: string;
  days: string;
  hours: string;
  minutes: string;
  time: string;
  presets: string;
  clear: string;
  template: string;
  customText: string;
  templateLoadError: string;
  taskText: string;
  variables: string;
  taskVariablesHint: string;
  unsupportedVariables: string;
  preview: string;
  eventPreviewNote: string;
  checklist: string;
  checklistHint: string;
  priorityLabels: Record<"low" | "medium" | "high" | "urgent", string>;
}

const taskActionCopy: Record<Locale, TaskActionCopy> = {
  en: {
    templatesLabel: "Templates",
    salutationLabels: { salutation: "Salutation", salutationFull: "Full salutation", salutationDoc: "Doctor salutation" },
    taskType: "Task", taskTitle: "Task title", taskVariablesHint: "Select a field to insert it in the focused title, description, or task text.", explanation: "Create a task when this rule matches. Groups receive one shared task; people and roles create personal tasks.",
    title: "Task title", description: "Short description (optional)", recipients: "Assign to", searchRecipients: "Search people, groups, or roles…",
    noRecipients: "No matching recipients", selected: "Selected recipients", users: "People", groups: "Groups", roles: "Roles",
    legacyDepartment: "Legacy department assignment", priority: "Priority", due: "Deadline", noDeadline: "No deadline",
    relative: "After trigger", fixedDate: "On a date", duration: "Time from trigger", days: "days", hours: "hours", minutes: "minutes",
    time: "Time", presets: "Quick set", clear: "Clear", template: "Task template", customText: "Custom task text", templateLoadError: "Templates could not be loaded.",
    taskText: "Task instructions", variables: "Available event fields", unsupportedVariables: "Unsupported variables",
    preview: "Preview", eventPreviewNote: "Event values appear when the automation runs; tokens are shown unchanged here.",
    checklist: "Checklist", checklistHint: "One item per line",
    priorityLabels: { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" },
  },
  sk: {
    templatesLabel: "Šablóny",
    salutationLabels: { salutation: "Oslovenie", salutationFull: "Plné oslovenie", salutationDoc: "Oslovenie lekára" },
    taskType: "Úloha", taskTitle: "Názov úlohy", taskVariablesHint: "Vyberte pole a vložte ho do aktívneho názvu, opisu alebo textu úlohy.", explanation: "Vytvorí úlohu pri zhode pravidla. Skupiny dostanú jednu spoločnú úlohu; ľudia a roly osobné úlohy.",
    title: "Názov úlohy", description: "Krátky opis (nepovinné)", recipients: "Priradiť komu", searchRecipients: "Hľadať ľudí, skupiny alebo roly…",
    noRecipients: "Nenašli sa príjemcovia", selected: "Vybraní príjemcovia", users: "Ľudia", groups: "Skupiny", roles: "Roly",
    legacyDepartment: "Staršie priradenie oddeleniu", priority: "Priorita", due: "Termín", noDeadline: "Bez termínu",
    relative: "Po spustení", fixedDate: "Konkrétny dátum", duration: "Čas od spustenia", days: "dni", hours: "hodiny", minutes: "minúty",
    time: "Čas", presets: "Rýchle nastavenie", clear: "Vymazať", template: "Šablóna úlohy", customText: "Vlastný text úlohy", templateLoadError: "Šablóny sa nepodarilo načítať.",
    taskText: "Pokyny k úlohe", variables: "Dostupné polia udalosti", unsupportedVariables: "Nepodporované premenné",
    preview: "Ukážka", eventPreviewNote: "Hodnoty udalosti sa doplnia pri spustení automatizácie; tu sú značky zobrazené nezmenené.",
    checklist: "Kontrolný zoznam", checklistHint: "Jedna položka na riadok",
    priorityLabels: { low: "Nízka", medium: "Stredná", high: "Vysoká", urgent: "Urgentná" },
  },
  cs: {
    templatesLabel: "Šablony",
    salutationLabels: { salutation: "Oslovení", salutationFull: "Plné oslovení", salutationDoc: "Oslovení lékaře" },
    taskType: "Úkol", taskTitle: "Název úkolu", taskVariablesHint: "Vyberte pole a vložte ho do aktivního názvu, popisu nebo textu úkolu.", explanation: "Při shodě pravidla vytvoří úkol. Skupiny dostanou jeden sdílený úkol; lidé a role osobní úkoly.",
    title: "Název úkolu", description: "Krátký popis (volitelné)", recipients: "Přiřadit komu", searchRecipients: "Hledat osoby, skupiny nebo role…",
    noRecipients: "Žádní odpovídající příjemci", selected: "Vybraní příjemci", users: "Osoby", groups: "Skupiny", roles: "Role",
    legacyDepartment: "Starší přiřazení oddělení", priority: "Priorita", due: "Termín", noDeadline: "Bez termínu",
    relative: "Po spuštění", fixedDate: "Konkrétní datum", duration: "Čas od spuštění", days: "dny", hours: "hodiny", minutes: "minuty",
    time: "Čas", presets: "Rychlé nastavení", clear: "Vymazat", template: "Šablona úkolu", customText: "Vlastní text úkolu", templateLoadError: "Šablony se nepodařilo načíst.",
    taskText: "Pokyny k úkolu", variables: "Dostupná pole události", unsupportedVariables: "Nepodporované proměnné",
    preview: "Náhled", eventPreviewNote: "Hodnoty události se doplní při spuštění automatizace; značky jsou zde zobrazeny beze změny.",
    checklist: "Kontrolní seznam", checklistHint: "Jedna položka na řádek",
    priorityLabels: { low: "Nízká", medium: "Střední", high: "Vysoká", urgent: "Naléhavá" },
  },
  hu: {
    templatesLabel: "Sablonok",
    salutationLabels: { salutation: "Megszólítás", salutationFull: "Teljes megszólítás", salutationDoc: "Orvos megszólítása" },
    taskType: "Feladat", taskTitle: "Feladat címe", taskVariablesHint: "Válasszon mezőt a beszúráshoz az aktív címbe, leírásba vagy feladatszövegbe.", explanation: "Feladatot hoz létre, ha a szabály egyezik. A csoportok egy közös, a személyek és szerepkörök személyes feladatot kapnak.",
    title: "Feladat címe", description: "Rövid leírás (nem kötelező)", recipients: "Felelősök", searchRecipients: "Személyek, csoportok vagy szerepkörök keresése…",
    noRecipients: "Nincs egyező címzett", selected: "Kiválasztott címzettek", users: "Személyek", groups: "Csoportok", roles: "Szerepkörök",
    legacyDepartment: "Régi részleg-hozzárendelés", priority: "Prioritás", due: "Határidő", noDeadline: "Határidő nélkül",
    relative: "Indítástól számítva", fixedDate: "Adott dátumon", duration: "Indítástól eltelt idő", days: "nap", hours: "óra", minutes: "perc",
    time: "Idő", presets: "Gyors beállítás", clear: "Törlés", template: "Feladatsablon", customText: "Egyéni feladatszöveg", templateLoadError: "A sablonok betöltése nem sikerült.",
    taskText: "Feladatutasítások", variables: "Elérhető eseménymezők", unsupportedVariables: "Nem támogatott változók",
    preview: "Előnézet", eventPreviewNote: "Az esemény értékei futtatáskor jelennek meg; itt a változók változatlanul láthatók.",
    checklist: "Ellenőrzőlista", checklistHint: "Soronként egy elem",
    priorityLabels: { low: "Alacsony", medium: "Közepes", high: "Magas", urgent: "Sürgős" },
  },
  ro: {
    templatesLabel: "Șabloane",
    salutationLabels: { salutation: "Formulă de adresare", salutationFull: "Formulă completă de adresare", salutationDoc: "Adresare către medic" },
    taskType: "Sarcină", taskTitle: "Titlul sarcinii", taskVariablesHint: "Selectați un câmp pentru a-l insera în titlul, descrierea sau textul activ.", explanation: "Creează o sarcină când regula se potrivește. Grupurile primesc o sarcină comună; persoanele și rolurile primesc sarcini personale.",
    title: "Titlul sarcinii", description: "Descriere scurtă (opțional)", recipients: "Atribuie către", searchRecipients: "Caută persoane, grupuri sau roluri…",
    noRecipients: "Nu există destinatari potriviți", selected: "Destinatari selectați", users: "Persoane", groups: "Grupuri", roles: "Roluri",
    legacyDepartment: "Atribuire veche către departament", priority: "Prioritate", due: "Termen", noDeadline: "Fără termen",
    relative: "După declanșare", fixedDate: "La o dată", duration: "Durata de la declanșare", days: "zile", hours: "ore", minutes: "minute",
    time: "Ora", presets: "Setare rapidă", clear: "Șterge", template: "Șablon de sarcină", customText: "Text personalizat", templateLoadError: "Șabloanele nu au putut fi încărcate.",
    taskText: "Instrucțiuni pentru sarcină", variables: "Câmpuri disponibile ale evenimentului", unsupportedVariables: "Variabile nesuportate",
    preview: "Previzualizare", eventPreviewNote: "Valorile evenimentului apar la rularea automatizării; aici variabilele sunt afișate nemodificate.",
    checklist: "Listă de verificare", checklistHint: "Un element pe rând",
    priorityLabels: { low: "Scăzută", medium: "Medie", high: "Ridicată", urgent: "Urgentă" },
  },
  it: {
    templatesLabel: "Modelli",
    salutationLabels: { salutation: "Formula di saluto", salutationFull: "Formula di saluto completa", salutationDoc: "Saluto al medico" },
    taskType: "Attività", taskTitle: "Titolo dell’attività", taskVariablesHint: "Seleziona un campo per inserirlo nel titolo, nella descrizione o nel testo attivo.", explanation: "Crea un’attività quando la regola corrisponde. I gruppi ricevono un’attività condivisa; persone e ruoli attività personali.",
    title: "Titolo dell’attività", description: "Descrizione breve (facoltativa)", recipients: "Assegna a", searchRecipients: "Cerca persone, gruppi o ruoli…",
    noRecipients: "Nessun destinatario corrispondente", selected: "Destinatari selezionati", users: "Persone", groups: "Gruppi", roles: "Ruoli",
    legacyDepartment: "Assegnazione dipartimento legacy", priority: "Priorità", due: "Scadenza", noDeadline: "Nessuna scadenza",
    relative: "Dopo l’attivazione", fixedDate: "In una data", duration: "Tempo dall’attivazione", days: "giorni", hours: "ore", minutes: "minuti",
    time: "Ora", presets: "Impostazione rapida", clear: "Rimuovi", template: "Modello attività", customText: "Testo personalizzato", templateLoadError: "Impossibile caricare i modelli.",
    taskText: "Istruzioni dell’attività", variables: "Campi evento disponibili", unsupportedVariables: "Variabili non supportate",
    preview: "Anteprima", eventPreviewNote: "I valori dell’evento saranno disponibili all’esecuzione; qui i segnaposto restano invariati.",
    checklist: "Lista di controllo", checklistHint: "Un elemento per riga",
    priorityLabels: { low: "Bassa", medium: "Media", high: "Alta", urgent: "Urgente" },
  },
  de: {
    templatesLabel: "Vorlagen",
    salutationLabels: { salutation: "Anrede", salutationFull: "Vollständige Anrede", salutationDoc: "Ärztliche Anrede" },
    taskType: "Aufgabe", taskTitle: "Aufgabentitel", taskVariablesHint: "Feld auswählen, um es in Titel, Beschreibung oder Aufgabentext einzufügen.", explanation: "Erstellt bei passender Regel eine Aufgabe. Gruppen erhalten eine gemeinsame Aufgabe; Personen und Rollen persönliche Aufgaben.",
    title: "Aufgabentitel", description: "Kurze Beschreibung (optional)", recipients: "Zuweisen an", searchRecipients: "Personen, Gruppen oder Rollen suchen…",
    noRecipients: "Keine passenden Empfänger", selected: "Ausgewählte Empfänger", users: "Personen", groups: "Gruppen", roles: "Rollen",
    legacyDepartment: "Alte Abteilungszuweisung", priority: "Priorität", due: "Fälligkeitsdatum", noDeadline: "Kein Termin",
    relative: "Nach Auslösung", fixedDate: "An einem Datum", duration: "Zeit ab Auslösung", days: "Tage", hours: "Stunden", minutes: "Minuten",
    time: "Uhrzeit", presets: "Schnellauswahl", clear: "Entfernen", template: "Aufgabenvorlage", customText: "Eigener Aufgabentext", templateLoadError: "Vorlagen konnten nicht geladen werden.",
    taskText: "Aufgabenanweisungen", variables: "Verfügbare Ereignisfelder", unsupportedVariables: "Nicht unterstützte Variablen",
    preview: "Vorschau", eventPreviewNote: "Ereigniswerte werden beim Ausführen eingesetzt; Variablen bleiben hier unverändert.",
    checklist: "Checkliste", checklistHint: "Ein Eintrag pro Zeile",
    priorityLabels: { low: "Niedrig", medium: "Mittel", high: "Hoch", urgent: "Dringend" },
  },
};

export function getTaskActionCopy(locale: Locale): TaskActionCopy {
  return taskActionCopy[locale] ?? taskActionCopy.en;
}
