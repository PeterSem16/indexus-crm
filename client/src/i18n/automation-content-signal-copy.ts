import type { Locale } from "./translations";
const locales = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;
const labels: Record<string, string[]> = {
  mentionsInvoice: ["Message mentions an invoice", "Správa spomína faktúru", "Zpráva zmiňuje fakturu", "Az üzenet számlát említ", "Mesajul menționează o factură", "Il messaggio menziona una fattura", "Nachricht erwähnt eine Rechnung"],
  hasComplaint: ["Contains a complaint", "Obsahuje sťažnosť", "Obsahuje stížnost", "Panaszt tartalmaz", "Conține o reclamație", "Contiene un reclamo", "Enthält eine Beschwerde"],
  needsReply: ["Needs a reply", "Vyžaduje odpoveď", "Vyžaduje odpověď", "Választ igényel", "Necesită răspuns", "Richiede una risposta", "Benötigt eine Antwort"],
  isUrgent: ["Urgent content", "Urgentný obsah", "Urgentní obsah", "Sürgős tartalom", "Conținut urgent", "Contenuto urgente", "Dringender Inhalt"],
  isThankYou: ["Thank-you message", "Poďakovanie", "Poděkování", "Köszönő üzenet", "Mesaj de mulțumire", "Messaggio di ringraziamento", "Dankesnachricht"],
  requestsCallback: ["Requests a callback", "Žiada spätný hovor", "Žádá zpětný hovor", "Visszahívást kér", "Solicită reapelare", "Richiede una richiamata", "Bittet um Rückruf"],
  textMatched: ["Requested text found", "Požadovaný text nájdený", "Požadovaný text nalezen", "Keresett szöveg megtalálva", "Textul căutat a fost găsit", "Testo richiesto trovato", "Gesuchter Text gefunden"],
  textContentMatched: ["Requested text found in message / call", "Požadovaný text nájdený v správe / hovore", "Požadovaný text nalezen ve zprávě / hovoru", "Keresett szöveg az üzenetben / hívásban", "Textul căutat a fost găsit în mesaj / apel", "Testo richiesto trovato nel messaggio / chiamata", "Gesuchter Text in Nachricht / Anruf gefunden"],
  textAttachmentsMatched: ["Requested text found in attachments", "Požadovaný text nájdený v prílohách", "Požadovaný text nalezen v přílohách", "Keresett szöveg a mellékletekben", "Textul căutat a fost găsit în atașamente", "Testo richiesto trovato negli allegati", "Gesuchter Text in Anhängen gefunden"],
  textMatchCount: ["Number of matched search terms", "Počet zhodných hľadaných výrazov", "Počet shodných hledaných výrazů", "Egyező keresési kifejezések száma", "Numărul termenilor de căutare potriviți", "Numero di termini di ricerca corrispondenti", "Anzahl übereinstimmender Suchbegriffe"],
};
export function contentSignalLabels(locale: Locale) {
  const index = Math.max(0, locales.indexOf(locale as typeof locales[number]));
  return Object.fromEntries(Object.entries(labels).map(([key, values]) => [`analysis.${key}`, values[index]]));
}
