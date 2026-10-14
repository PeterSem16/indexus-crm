export const AUTOMATION_TEMPLATE_PICKER_LOCALES = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;
export type AutomationTemplatePickerLocale = typeof AUTOMATION_TEMPLATE_PICKER_LOCALES[number];

const copy: Record<string, readonly string[]> = {
  choose: ["Choose a template", "Vybrať šablónu", "Vybrat šablonu", "Sablon kiválasztása", "Alege un șablon", "Scegli un modello", "Vorlage auswählen"],
  custom: ["Custom content", "Vlastný obsah", "Vlastní obsah", "Egyéni tartalom", "Conținut personalizat", "Contenuto personalizzato", "Eigener Inhalt"],
  current: ["Current saved snapshot", "Aktuálne uložená verzia", "Aktuální uložená verze", "Jelenlegi mentett változat", "Versiunea salvată curentă", "Versione salvata attuale", "Aktueller gespeicherter Stand"],
  search: ["Search templates by name or content", "Hľadať šablóny podľa názvu alebo obsahu", "Hledat šablony podle názvu nebo obsahu", "Sablonák keresése név vagy tartalom szerint", "Caută șabloane după nume sau conținut", "Cerca modelli per nome o contenuto", "Vorlagen nach Name oder Inhalt suchen"],
  source: ["Source", "Zdroj", "Zdroj", "Forrás", "Sursă", "Origine", "Quelle"],
  meaning: ["Meaning", "Význam", "Význam", "Jelentés", "Semnificație", "Significato", "Bedeutung"],
  all: ["All", "Všetko", "Vše", "Mind", "Toate", "Tutti", "Alle"],
  calls: ["Telephone calls", "Telefonáty", "Telefonáty", "Telefonhívások", "Apeluri telefonice", "Chiamate telefoniche", "Telefonanrufe"],
  tasks: ["Tasks", "Úlohy", "Úkoly", "Feladatok", "Sarcini", "Attività", "Aufgaben"],
  email: ["Email", "E-mail", "E-mail", "E-mail", "E-mail", "Email", "E-Mail"],
  messages: ["SMS & chat", "SMS a chat", "SMS a chat", "SMS és chat", "SMS și chat", "SMS e chat", "SMS & Chat"],
  records: ["Records", "Záznamy", "Záznamy", "Rekordok", "Înregistrări", "Record", "Datensätze"],
  analysis: ["Analysis", "Analýza", "Analýza", "Elemzés", "Analiză", "Analisi", "Analyse"],
  notifications: ["Notifications", "Upozornenia", "Upozornění", "Értesítések", "Notificări", "Notifiche", "Benachrichtigungen"],
  other: ["Other", "Ostatné", "Ostatní", "Egyéb", "Altele", "Altro", "Weitere"],
  sentiment: ["Sentiment", "Sentiment", "Sentiment", "Érzelmi értékelés", "Sentiment", "Sentiment", "Stimmung"],
  tone: ["Tone", "Tón", "Tón", "Hangnem", "Ton", "Tono", "Tonfall"],
  analysisRequired: ["Call sentiment and tone require a completed analysis. Choose the analyzed communication source with Calls enabled; call-start/answer/end events do not contain AI findings.", "Sentiment a tón hovoru vyžadujú dokončenú analýzu. Zvoľte zdroj analyzovanej komunikácie so zapnutými hovormi; udalosti začatia, prijatia a ukončenia hovoru neobsahujú AI zistenia.", "Sentiment a tón hovoru vyžadují dokončenou analýzu. Zvolte zdroj analyzované komunikace se zapnutými hovory; události zahájení, přijetí a ukončení hovoru neobsahují AI zjištění.", "A hívás érzelmi értékeléséhez és hangneméhez befejezett elemzés kell. Válassza az elemzett kommunikáció forrását engedélyezett hívásokkal; a híváskezdési, fogadási és befejezési események nem tartalmaznak AI-eredményeket.", "Sentimentul și tonul apelului necesită o analiză finalizată. Alege sursa de comunicare analizată cu apeluri activate; evenimentele de început, preluare și încheiere nu conțin rezultate AI.", "Sentiment e tono della chiamata richiedono un'analisi completata. Seleziona la comunicazione analizzata con le chiamate abilitate; gli eventi di inizio, risposta e fine non contengono risultati AI.", "Stimmung und Tonfall eines Anrufs erfordern eine abgeschlossene Analyse. Wählen Sie analysierte Kommunikation mit aktivierten Anrufen; Start-, Antwort- und Endereignisse enthalten keine KI-Ergebnisse."],
  success: ["Success", "Úspech", "Úspěch", "Siker", "Succes", "Successo", "Erfolg"],
  urgency: ["Urgency", "Naliehavosť", "Naléhavost", "Sürgősség", "Urgență", "Urgenza", "Dringlichkeit"],
  deadlines: ["Deadlines", "Termíny", "Termíny", "Határidők", "Termene", "Scadenze", "Fristen"],
  positive: ["Positive", "Pozitívny", "Pozitivní", "Pozitív", "Pozitiv", "Positivo", "Positiv"],
  negative: ["Negative", "Negatívny", "Negativní", "Negatív", "Negativ", "Negativo", "Negativ"],
  urgent: ["Urgent", "Naliehavé", "Naléhavé", "Sürgős", "Urgent", "Urgente", "Dringend"],
  due: ["Deadline", "Termín", "Termín", "Határidő", "Termen", "Scadenza", "Frist"],
  inbound: ["Inbound", "Prichádzajúce", "Příchozí", "Bejövő", "Primite", "In entrata", "Eingehend"],
  outbound: ["Outbound", "Odchádzajúce", "Odchozí", "Kimenő", "Efectuate", "In uscita", "Ausgehend"],
  both: ["Both directions", "Oba smery", "Oba směry", "Mindkét irány", "Ambele direcții", "Entrambe le direzioni", "Beide Richtungen"],
  voiceChoices: ["Voice choices", "Možnosti hlasu", "Možnosti hlasu", "Hangbeállítások", "Opțiuni de voce", "Scelte vocali", "Sprachauswahl"],
  templates: ["templates", "šablón", "šablon", "sablon", "șabloane", "modelli", "Vorlagen"],
  variableCount: ["variables", "premenných", "proměnných", "változó", "variabile", "variabili", "Variablen"],
  missing: ["Unavailable variables for this action", "Premenné nedostupné pre túto akciu", "Proměnné nedostupné pro tuto akci", "Ehhez a művelethez nem elérhető változók", "Variabile indisponibile pentru această acțiune", "Variabili non disponibili per questa azione", "Für diese Aktion nicht verfügbare Variablen"],
  noMatches: ["No templates match these filters.", "Žiadne šablóny nezodpovedajú filtrom.", "Žádné šablony neodpovídají filtrům.", "Nincs a szűrőknek megfelelő sablon.", "Niciun șablon nu corespunde filtrelor.", "Nessun modello corrisponde ai filtri.", "Keine Vorlage passt zu diesen Filtern."],
  noTemplates: ["No templates are available yet.", "Zatiaľ nie sú dostupné žiadne šablóny.", "Zatím nejsou dostupné žádné šablony.", "Még nincsenek elérhető sablonok.", "Nu există încă șabloane disponibile.", "Non ci sono ancora modelli disponibili.", "Noch sind keine Vorlagen verfügbar."],
  refresh: ["Refresh templates", "Obnoviť šablóny", "Obnovit šablony", "Sablonák frissítése", "Reîmprospătează șabloanele", "Aggiorna i modelli", "Vorlagen aktualisieren"],
  refreshError: ["Templates could not be refreshed. Try again.", "Šablóny sa nepodarilo obnoviť. Skúste to znova.", "Šablony se nepodařilo obnovit. Zkuste to znovu.", "A sablonák frissítése nem sikerült. Próbálja újra.", "Șabloanele nu au putut fi reîmprospătate. Încearcă din nou.", "Impossibile aggiornare i modelli. Riprova.", "Vorlagen konnten nicht aktualisiert werden. Bitte erneut versuchen."],
  loading: ["Refreshing…", "Obnovovanie…", "Obnovování…", "Frissítés…", "Se reîmprospătează…", "Aggiornamento…", "Wird aktualisiert…"],
  close: ["Close template picker", "Zavrieť výber šablón", "Zavřít výběr šablon", "Sablonaválasztó bezárása", "Închide selectorul de șabloane", "Chiudi selettore modelli", "Vorlagenauswahl schließen"],
  snapshotOnly: ["This saved snapshot is no longer in the template list.", "Táto uložená verzia už nie je v zozname šablón.", "Tato uložená verze už není v seznamu šablon.", "Ez a mentett változat már nincs a sablonlistában.", "Această versiune salvată nu mai este în lista de șabloane.", "Questa versione salvata non è più nell’elenco.", "Dieser gespeicherte Stand ist nicht mehr in der Vorlagenliste."],
  descriptionFallback: ["Ready-to-use content", "Obsah pripravený na použitie", "Obsah připravený k použití", "Azonnal használható tartalom", "Conținut gata de folosit", "Contenuto pronto all’uso", "Sofort verwendbarer Inhalt"],
  chooseHint: ["Browse by where it starts and what it does.", "Vyberajte podľa zdroja a účelu.", "Vybírejte podle zdroje a účelu.", "Válasszon forrás és cél szerint.", "Alege după sursă și scop.", "Scegli in base all’origine e allo scopo.", "Nach Quelle und Zweck auswählen."],
};

export function automationTemplatePickerCopy(locale: string, key: string): string {
  const language = AUTOMATION_TEMPLATE_PICKER_LOCALES.includes(locale.toLowerCase().split("-")[0] as AutomationTemplatePickerLocale)
    ? locale.toLowerCase().split("-")[0] as AutomationTemplatePickerLocale
    : "en";
  const values = copy[key];
  if (!values) return key;
  return values[AUTOMATION_TEMPLATE_PICKER_LOCALES.indexOf(language)];
}
