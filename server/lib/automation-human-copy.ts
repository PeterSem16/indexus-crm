import { ACTIVITY_TEMPLATE_LANGUAGES, type ActivityTemplateLanguage } from "../../shared/automation-activity-template-copy";

const copy: Record<string, readonly string[]> = {
  tagline: ["Less searching, more understanding", "Menej hľadania, viac porozumenia", "Méně hledání, více porozumění", "Kevesebb keresés, több megértés", "Mai puțină căutare, mai multă claritate", "Meno ricerche, più chiarezza", "Weniger suchen, mehr verstehen"],
  footer: ["An automatic message about an event in your INDEXUS workspace.", "Automatická správa o udalosti vo vašom pracovnom priestore INDEXUS.", "Automatická zpráva o události ve vašem pracovním prostoru INDEXUS.", "Automatikus üzenet az INDEXUS-munkaterület egy eseményéről.", "Mesaj automat despre un eveniment din spațiul INDEXUS.", "Messaggio automatico su un evento nel tuo spazio INDEXUS.", "Automatische Nachricht zu einem Ereignis in Ihrem INDEXUS-Arbeitsbereich."],
  task: ["Review the task context and choose what comes next.", "Pozrite si súvislosti úlohy a zvoľte ďalší krok.", "Prohlédněte si souvislosti úkolu a zvolte další krok.", "Tekintse át a feladatot és válassza ki a következő lépést.", "Verifică contextul sarcinii și alege următorul pas.", "Verifica il contesto dell’attività e scegli il prossimo passo.", "Prüfen Sie den Aufgabenkontext und wählen Sie den nächsten Schritt."],
  author: ["Prepared by {{person}}.", "Pripravil/a {{person}}.", "Připravil/a {{person}}.", "Készítette: {{person}}.", "Pregătit de {{person}}.", "Preparato da {{person}}.", "Vorbereitet von {{person}}."],
  assigned: ["Assignment: {{person}}.", "Priradenie: {{person}}.", "Přiřazení: {{person}}.", "Hozzárendelés: {{person}}.", "Alocare: {{person}}.", "Assegnazione: {{person}}.", "Zuweisung: {{person}}."],
  recipient: ["Recipient: {{person}}.", "Príjemca: {{person}}.", "Příjemce: {{person}}.", "Címzett: {{person}}.", "Destinatar: {{person}}.", "Destinatario: {{person}}.", "Empfänger: {{person}}."],
  sourcePerson: ["Source: {{person}}.", "Zdroj: {{person}}.", "Zdroj: {{person}}.", "Forrás: {{person}}.", "Sursă: {{person}}.", "Fonte: {{person}}.", "Quelle: {{person}}."],
  count: ["Invoices in the analysis", "Faktúry v analýze", "Faktury v analýze", "Számlák az elemzésben", "Facturi în analiză", "Fatture nell’analisi", "Rechnungen in der Analyse"],
  source: ["Here is the context of the message so you can decide what comes next.", "Tu sú súvislosti správy, aby ste mohli zvoliť ďalší krok.", "Zde jsou souvislosti zprávy, abyste mohli zvolit další krok.", "Az üzenet körülményei segítenek a következő lépés kiválasztásában.", "Iată contextul mesajului, pentru a decide următorul pas.", "Ecco il contesto del messaggio, per decidere il prossimo passo.", "Hier ist der Kontext der Nachricht für Ihre nächste Entscheidung."],
  record: ["The update concerns {{activity.title}}. Review the current situation in INDEXUS.", "Aktualizácia sa týka {{activity.title}}. Skontrolujte aktuálnu situáciu v INDEXUS.", "Aktualizace se týká {{activity.title}}. Zkontrolujte aktuální situaci v INDEXUS.", "A frissítés érinti: {{activity.title}}. Ellenőrizze az aktuális helyzetet az INDEXUS-ban.", "Actualizarea privește {{activity.title}}. Verifică situația în INDEXUS.", "L’aggiornamento riguarda {{activity.title}}. Verifica la situazione in INDEXUS.", "Die Aktualisierung betrifft {{activity.title}}. Prüfen Sie die Situation in INDEXUS."],
  call: ["Review the call context and choose the next step in INDEXUS.", "Pozrite si súvislosti hovoru a zvoľte ďalší krok v INDEXUS.", "Prohlédněte si souvislosti hovoru a zvolte další krok v INDEXUS.", "Tekintse át a hívást és válassza ki a következő lépést az INDEXUS-ban.", "Verifică contextul apelului și alege următorul pas în INDEXUS.", "Verifica il contesto della chiamata e scegli il prossimo passo in INDEXUS.", "Prüfen Sie den Anrufkontext und wählen Sie den nächsten Schritt in INDEXUS."],
  next: ["Next step", "Ďalší krok", "Další krok", "Következő lépés", "Pasul următor", "Prossimo passo", "Nächster Schritt"],
  open: ["Open INDEXUS", "Otvoriť INDEXUS", "Otevřít INDEXUS", "INDEXUS megnyitása", "Deschide INDEXUS", "Apri INDEXUS", "INDEXUS öffnen"],
  analysis: ["Finding after completed analysis", "Zistenie po dokončenej analýze", "Zjištění po dokončené analýze", "Megállapítás a befejezett elemzésből", "Constatare după analiza finalizată", "Risultato dell’analisi completata", "Ergebnis der abgeschlossenen Analyse"],
};

const findings: Record<string, readonly string[]> = {
  positive: ["Positive", "Pozitívny", "Pozitivní", "Pozitív", "Pozitiv", "Positivo", "Positiv"],
  negative: ["Negative", "Negatívny", "Negativní", "Negatív", "Negativ", "Negativo", "Negativ"],
  neutral: ["Neutral", "Neutrálny", "Neutrální", "Semleges", "Neutru", "Neutro", "Neutral"],
  angry: ["Angry", "Nahnevaný", "Rozzlobený", "Dühös", "Furios", "Arrabbiato", "Verärgert"],
  calm: ["Calm", "Pokojný", "Klidný", "Nyugodt", "Calm", "Calmo", "Ruhig"],
  concerned: ["Concerned", "Znepokojený", "Znepokojený", "Aggódó", "Îngrijorat", "Preoccupato", "Besorgt"],
  rude: ["Rude", "Hrubý", "Hrubý", "Durva", "Nepoliticos", "Scortese", "Unhöflich"],
};
export function humanFindingLabel(language: string, value: string): string | null {
  const index = ACTIVITY_TEMPLATE_LANGUAGES.indexOf(language as ActivityTemplateLanguage);
  return findings[value]?.[index < 0 ? 0 : index] || null;
}
const priorities: Record<string, readonly string[]> = {
  low: ["Low", "Nízka", "Nízká", "Alacsony", "Scăzută", "Bassa", "Niedrig"],
  medium: ["Medium", "Stredná", "Střední", "Közepes", "Medie", "Media", "Mittel"],
  normal: ["Normal", "Bežná", "Běžná", "Normál", "Normală", "Normale", "Normal"],
  high: ["High", "Vysoká", "Vysoká", "Magas", "Ridicată", "Alta", "Hoch"],
  urgent: ["Urgent", "Urgentná", "Urgentní", "Sürgős", "Urgentă", "Urgente", "Dringend"],
};
export function humanPriorityLabel(language: string, value: unknown): string | null {
  const index = ACTIVITY_TEMPLATE_LANGUAGES.indexOf(language as ActivityTemplateLanguage);
  return typeof value === "string" ? priorities[value]?.[index < 0 ? 0 : index] || null : null;
}

export function humanTemplateCopy(language: ActivityTemplateLanguage, key: string) {
  if (!copy[key]) throw new Error(`Missing human template copy: ${key}`);
  return copy[key][ACTIVITY_TEMPLATE_LANGUAGES.indexOf(language)];
}
