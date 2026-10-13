import type { Locale } from "./translations";
const locales = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;
const labels: Record<string, string[]> = {
  mentionsInvoice: ["Message mentions an invoice", "Správa spomína faktúru", "Zpráva zmiňuje fakturu", "Az üzenet számlát említ", "Mesajul menționează o factură", "Il messaggio menziona una fattura", "Nachricht erwähnt eine Rechnung"],
  hasComplaint: ["Contains a complaint", "Obsahuje sťažnosť", "Obsahuje stížnost", "Panaszt tartalmaz", "Conține o reclamație", "Contiene un reclamo", "Enthält eine Beschwerde"],
  needsReply: ["Needs a reply", "Vyžaduje odpoveď", "Vyžaduje odpověď", "Választ igényel", "Necesită răspuns", "Richiede una risposta", "Benötigt eine Antwort"],
  isUrgent: ["Urgent content", "Urgentný obsah", "Urgentní obsah", "Sürgős tartalom", "Conținut urgent", "Contenuto urgente", "Dringender Inhalt"],
  isThankYou: ["Thank-you message", "Poďakovanie", "Poděkování", "Köszönő üzenet", "Mesaj de mulțumire", "Messaggio di ringraziamento", "Dankesnachricht"],
  requestsCallback: ["Requests a callback", "Žiada spätný hovor", "Žádá zpětný hovor", "Visszahívást kér", "Solicită reapelare", "Richiede una richiamata", "Bittet um Rückruf"],
};
export function contentSignalLabels(locale: Locale) {
  const index = Math.max(0, locales.indexOf(locale as typeof locales[number]));
  return Object.fromEntries(Object.entries(labels).map(([key, values]) => [`analysis.${key}`, values[index]]));
}
