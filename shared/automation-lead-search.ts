export const LEAD_SEARCH_EVENTS = [
  "lead_search.results_found", "lead_search.completed", "lead_search.failed", "lead_search.cancelled",
] as const;
export type LeadSearchEvent = typeof LEAD_SEARCH_EVENTS[number];
export const LEAD_SEARCH_LANGUAGES = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;
type Language = typeof LEAD_SEARCH_LANGUAGES[number];
const rows = {
  module: ["LEAD SEARCH", "LEAD SEARCH", "LEAD SEARCH", "LEAD SEARCH", "LEAD SEARCH", "LEAD SEARCH", "LEAD SEARCH"],
  help: [
    "Searches never send notifications by themselves. Choose campaigns and enable a rule with your own recipients and message.",
    "Vyhľadávanie samo neposiela notifikácie. Vyberte kampane a zapnite pravidlo s vlastnými príjemcami a správou.",
    "Vyhledávání samo neposílá oznámení. Vyberte kampaně a zapněte pravidlo s vlastními příjemci a zprávou.",
    "A keresések önmagukban nem küldenek értesítést. Válasszon kampányokat, és engedélyezzen szabályt saját címzettekkel és üzenettel.",
    "Căutările nu trimit singure notificări. Selectați campanii și activați o regulă cu destinatarii și mesajul propriu.",
    "Le ricerche non inviano notifiche autonomamente. Seleziona le campagne e attiva una regola con destinatari e messaggio.",
    "Suchen versenden selbst keine Benachrichtigungen. Wählen Sie Kampagnen und aktivieren Sie eine Regel mit eigenen Empfängern und Nachricht.",
  ],
  campaigns: ["Search campaigns", "Vyhľadávacie kampane", "Vyhledávací kampaně", "Keresési kampányok", "Campanii de căutare", "Campagne di ricerca", "Suchkampagnen"],
  select: ["Select at least one search campaign", "Vyberte aspoň jednu vyhľadávaciu kampaň", "Vyberte alespoň jednu vyhledávací kampaň", "Válasszon legalább egy keresési kampányt", "Selectați cel puțin o campanie de căutare", "Seleziona almeno una campagna di ricerca", "Wählen Sie mindestens eine Suchkampagne"],
  empty: ["No search campaigns available", "Nie sú dostupné vyhľadávacie kampane", "Nejsou dostupné vyhledávací kampaně", "Nincsenek elérhető keresési kampányok", "Nu sunt disponibile campanii de căutare", "Nessuna campagna di ricerca disponibile", "Keine Suchkampagnen verfügbar"],
  loading: ["Loading campaigns…", "Načítavam kampane…", "Načítání kampaní…", "Kampányok betöltése…", "Se încarcă campaniile…", "Caricamento campagne…", "Kampagnen werden geladen…"],
  error: ["Could not load campaigns", "Kampane sa nepodarilo načítať", "Kampaně se nepodařilo načíst", "A kampányok nem tölthetők be", "Campaniile nu au putut fi încărcate", "Impossibile caricare le campagne", "Kampagnen konnten nicht geladen werden"],
  missing: ["Unavailable campaign", "Nedostupná kampaň", "Nedostupná kampaň", "Nem elérhető kampány", "Campanie indisponibilă", "Campagna non disponibile", "Nicht verfügbare Kampagne"],
  paused: ["Paused", "Pozastavená", "Pozastavená", "Szüneteltetve", "În pauză", "In pausa", "Pausiert"],
  results_found: ["New leads found", "Nájdené nové leady", "Nalezeny nové leady", "Új érdeklődők találhatók", "Leaduri noi găsite", "Nuovi lead trovati", "Neue Leads gefunden"],
  completed: ["Search completed", "Vyhľadávanie dokončené", "Vyhledávání dokončeno", "Keresés befejezve", "Căutare finalizată", "Ricerca completata", "Suche abgeschlossen"],
  failed: ["Search failed", "Vyhľadávanie zlyhalo", "Vyhledávání selhalo", "A keresés sikertelen", "Căutare eșuată", "Ricerca non riuscita", "Suche fehlgeschlagen"],
  cancelled: ["Search stopped", "Vyhľadávanie zastavené", "Vyhledávání zastaveno", "Keresés leállítva", "Căutare oprită", "Ricerca interrotta", "Suche gestoppt"],
  campaignName: ["Campaign", "Kampaň", "Kampaň", "Kampány", "Campanie", "Campagna", "Kampagne"],
  campaignId: ["Search campaign", "Vyhľadávacia kampaň", "Vyhledávací kampaň", "Keresési kampány", "Campanie de căutare", "Campagna di ricerca", "Suchkampagne"],
  jobId: ["Search run ID", "ID vyhľadávania", "ID vyhledávání", "Keresésazonosító", "ID rulare căutare", "ID esecuzione ricerca", "Suchlauf-ID"],
  jobName: ["Search name", "Názov vyhľadávania", "Název vyhledávání", "Keresés neve", "Nume căutare", "Nome ricerca", "Suchname"],
  newLeads: ["New leads saved", "Nové uložené leady", "Nové uložené leady", "Mentett új érdeklődők", "Leaduri noi salvate", "Nuovi lead salvati", "Neu gespeicherte Leads"],
  totalResults: ["Saved results", "Uložené výsledky", "Uložené výsledky", "Mentett eredmények", "Rezultate salvate", "Risultati salvati", "Gespeicherte Ergebnisse"],
  targetModule: ["Target module", "Cieľový modul", "Cílový modul", "Célmodul", "Modul țintă", "Modulo di destinazione", "Zielmodul"],
  status: ["Search status", "Stav vyhľadávania", "Stav vyhledávání", "Keresés állapota", "Stare căutare", "Stato ricerca", "Suchstatus"],
  completedAt: ["Finished at", "Čas ukončenia", "Čas ukončení", "Befejezés időpontja", "Ora finalizării", "Ora di conclusione", "Beendet am"],
  country: ["Country", "Krajina", "Země", "Ország", "Țară", "Paese", "Land"],
  resultsMessage: [
    'Campaign "{{newValues.campaignName}}" saved {{newValues.newLeads}} new leads. Search: {{newValues.jobName}} (#{{newValues.jobId}}).',
    'Kampaň „{{newValues.campaignName}}“ uložila {{newValues.newLeads}} nových leadov. Vyhľadávanie: {{newValues.jobName}} (#{{newValues.jobId}}).',
    'Kampaň „{{newValues.campaignName}}“ uložila {{newValues.newLeads}} nových leadů. Vyhledávání: {{newValues.jobName}} (#{{newValues.jobId}}).',
    'A(z) „{{newValues.campaignName}}” kampány {{newValues.newLeads}} új érdeklődőt mentett. Keresés: {{newValues.jobName}} (#{{newValues.jobId}}).',
    'Campania „{{newValues.campaignName}}” a salvat {{newValues.newLeads}} leaduri noi. Căutare: {{newValues.jobName}} (#{{newValues.jobId}}).',
    'La campagna “{{newValues.campaignName}}” ha salvato {{newValues.newLeads}} nuovi lead. Ricerca: {{newValues.jobName}} (#{{newValues.jobId}}).',
    'Kampagne „{{newValues.campaignName}}“ hat {{newValues.newLeads}} neue Leads gespeichert. Suche: {{newValues.jobName}} (#{{newValues.jobId}}).',
  ],
  completedMessage: [
    'Search "{{newValues.jobName}}" for campaign "{{newValues.campaignName}}" is complete. Saved results: {{newValues.totalResults}}; new leads: {{newValues.newLeads}}.',
    'Vyhľadávanie „{{newValues.jobName}}“ kampane „{{newValues.campaignName}}“ je dokončené. Uložené výsledky: {{newValues.totalResults}}; nové leady: {{newValues.newLeads}}.',
    'Vyhledávání „{{newValues.jobName}}“ kampaně „{{newValues.campaignName}}“ je dokončeno. Uložené výsledky: {{newValues.totalResults}}; nové leady: {{newValues.newLeads}}.',
    'A(z) „{{newValues.campaignName}}” kampány „{{newValues.jobName}}” keresése befejeződött. Mentett eredmények: {{newValues.totalResults}}; új érdeklődők: {{newValues.newLeads}}.',
    'Căutarea „{{newValues.jobName}}” a campaniei „{{newValues.campaignName}}” s-a încheiat. Rezultate salvate: {{newValues.totalResults}}; leaduri noi: {{newValues.newLeads}}.',
    'La ricerca “{{newValues.jobName}}” della campagna “{{newValues.campaignName}}” è completa. Risultati salvati: {{newValues.totalResults}}; nuovi lead: {{newValues.newLeads}}.',
    'Suche „{{newValues.jobName}}“ für Kampagne „{{newValues.campaignName}}“ ist abgeschlossen. Gespeicherte Ergebnisse: {{newValues.totalResults}}; neue Leads: {{newValues.newLeads}}.',
  ],
  failedMessage: [
    'Search "{{newValues.jobName}}" for campaign "{{newValues.campaignName}}" failed. Check search run #{{newValues.jobId}} in LEAD SEARCH.',
    'Vyhľadávanie „{{newValues.jobName}}“ kampane „{{newValues.campaignName}}“ zlyhalo. Skontrolujte vyhľadávanie #{{newValues.jobId}} v LEAD SEARCH.',
    'Vyhledávání „{{newValues.jobName}}“ kampaně „{{newValues.campaignName}}“ selhalo. Zkontrolujte vyhledávání #{{newValues.jobId}} v LEAD SEARCH.',
    'A(z) „{{newValues.campaignName}}” kampány „{{newValues.jobName}}” keresése sikertelen. Ellenőrizze a(z) #{{newValues.jobId}} keresést a LEAD SEARCH modulban.',
    'Căutarea „{{newValues.jobName}}” a campaniei „{{newValues.campaignName}}” a eșuat. Verificați rularea #{{newValues.jobId}} în LEAD SEARCH.',
    'La ricerca “{{newValues.jobName}}” della campagna “{{newValues.campaignName}}” non è riuscita. Controlla l’esecuzione #{{newValues.jobId}} in LEAD SEARCH.',
    'Suche „{{newValues.jobName}}“ für Kampagne „{{newValues.campaignName}}“ ist fehlgeschlagen. Prüfen Sie Suchlauf #{{newValues.jobId}} in LEAD SEARCH.',
  ],
  cancelledMessage: [
    'Search "{{newValues.jobName}}" for campaign "{{newValues.campaignName}}" was stopped. Search run #{{newValues.jobId}}.',
    'Vyhľadávanie „{{newValues.jobName}}“ kampane „{{newValues.campaignName}}“ bolo zastavené. Vyhľadávanie #{{newValues.jobId}}.',
    'Vyhledávání „{{newValues.jobName}}“ kampaně „{{newValues.campaignName}}“ bylo zastaveno. Vyhledávání #{{newValues.jobId}}.',
    'A(z) „{{newValues.campaignName}}” kampány „{{newValues.jobName}}” keresése leállt. Keresés #{{newValues.jobId}}.',
    'Căutarea „{{newValues.jobName}}” a campaniei „{{newValues.campaignName}}” a fost oprită. Rulare #{{newValues.jobId}}.',
    'La ricerca “{{newValues.jobName}}” della campagna “{{newValues.campaignName}}” è stata interrotta. Esecuzione #{{newValues.jobId}}.',
    'Suche „{{newValues.jobName}}“ für Kampagne „{{newValues.campaignName}}“ wurde gestoppt. Suchlauf #{{newValues.jobId}}.',
  ],
} satisfies Record<string, readonly string[]>;
export function getLeadSearchCopy(locale: string) {
  const index = Math.max(0, LEAD_SEARCH_LANGUAGES.indexOf(locale as Language));
  return Object.fromEntries(Object.entries(rows).map(([key, values]) => [key, values[index]])) as Record<keyof typeof rows, string>;
}
export function leadSearchEventLabel(locale: string, event: string): string | undefined {
  return (LEAD_SEARCH_EVENTS as readonly string[]).includes(event)
    ? getLeadSearchCopy(locale)[event.slice("lead_search.".length) as "results_found"] : undefined;
}
export const LEAD_SEARCH_FIELDS = [
  { key: "campaignId", type: "number" }, { key: "campaignName", type: "string" },
  { key: "jobId", type: "number" }, { key: "jobName", type: "string" },
  { key: "newLeads", type: "number" }, { key: "totalResults", type: "number" },
  { key: "targetModule", type: "string" }, { key: "status", type: "string" },
  { key: "completedAt", type: "string" }, { key: "country", type: "string" },
] as const;
export function leadCampaignSelectionValid(ids: unknown): ids is number[] {
  return Array.isArray(ids) && ids.length > 0 && ids.length <= 200 &&
    ids.every(id => Number.isSafeInteger(id) && id > 0) && new Set(ids).size === ids.length;
}
export function leadSearchTriggerMatches(trigger: any, event: { module: string; newValues?: unknown }): boolean {
  if (event.module !== "lead_search") return true;
  const values = event.newValues as Record<string, unknown> | null;
  return leadCampaignSelectionValid(trigger?.leadCampaignIds) &&
    typeof values?.campaignId === "number" && trigger.leadCampaignIds.includes(values.campaignId);
}
