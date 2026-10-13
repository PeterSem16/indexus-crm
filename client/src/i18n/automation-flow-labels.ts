import type { Locale } from "./translations";
const languages = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;
const labels: Record<string, readonly string[]> = {
  listenAfter: ["Listen from", "Spracovať od", "Zpracovat od", "Feldolgozás kezdete", "Procesează de la", "Elabora da", "Verarbeiten ab"],
  "analysis.hasInvoice": ["Contains an invoice", "Obsahuje faktúru", "Obsahuje fakturu", "Számlát tartalmaz", "Conține o factură", "Contiene una fattura", "Enthält eine Rechnung"],
  "analysis.invoiceCount": ["Invoice count", "Počet faktúr", "Počet faktur", "Számlák száma", "Număr de facturi", "Numero di fatture", "Rechnungsanzahl"],
  "analysis.attachmentCount": ["Attachment count", "Počet príloh", "Počet příloh", "Mellékletek száma", "Număr de atașamente", "Numero di allegati", "Anzahl der Anhänge"],
  "analysis.failedAttachmentCount": ["Unprocessed attachments", "Nespracované prílohy", "Nezpracované přílohy", "Feldolgozatlan mellékletek", "Atașamente neprocesate", "Allegati non elaborati", "Unverarbeitete Anhänge"],
  "analysis.sentiment": ["Sentiment", "Sentiment", "Sentiment", "Érzelmi töltet", "Sentiment", "Sentiment", "Stimmung"],
  "analysis.tone": ["Tone", "Tón", "Tón", "Hangnem", "Ton", "Tono", "Ton"],
  "analysis.summary": ["Summary", "Zhrnutie", "Shrnutí", "Összefoglaló", "Rezumat", "Riepilogo", "Zusammenfassung"],
  "analysis.wantsToCancel": ["Cancellation intent", "Zámer zrušenia", "Záměr zrušení", "Lemondási szándék", "Intenție de anulare", "Intenzione di annullare", "Kündigungsabsicht"],
  role: ["Role", "Rola", "Role", "Szerepkör", "Rol", "Ruolo", "Rolle"],
  assignmentTarget: ["Assignment filter", "Filter priradenia", "Filtr přiřazení", "Hozzárendelési szűrő", "Filtru de atribuire", "Filtro assegnazione", "Zuweisungsfilter"],
  target: ["Target record", "Cieľový záznam", "Cílový záznam", "Célrekord", "Înregistrare țintă", "Record di destinazione", "Zieldatensatz"],
  id: ["Selection", "Výber", "Výběr", "Kiválasztás", "Selecție", "Selezione", "Auswahl"],
  kind: ["Selection type", "Typ výberu", "Typ výběru", "Kiválasztás típusa", "Tip selecție", "Tipo di selezione", "Auswahltyp"],
  dueAt: ["Deadline", "Termín", "Termín", "Határidő", "Termen limită", "Scadenza", "Frist"],
  dueInHours: ["Deadline offset (hours)", "Termín o (hodiny)", "Termín za (hodiny)", "Határidő (óra múlva)", "Termen peste (ore)", "Scadenza tra (ore)", "Frist in (Stunden)"],
  attachmentSelectionMode: ["Task attachments", "Prílohy úlohy", "Přílohy úkolu", "Feladat mellékletei", "Atașamente sarcină", "Allegati attività", "Aufgabenanhänge"],
  senderMode: ["Sender mailbox", "Schránka odosielateľa", "Schránka odesílatele", "Feladó postafiókja", "Căsuța expeditorului", "Casella mittente", "Absenderpostfach"],
  to: ["To", "Komu", "Komu", "Címzett", "Către", "A", "An"],
  cc: ["Copy", "Kópia", "Kopie", "Másolat", "Copie", "Copia", "Kopie"],
  bcc: ["Blind copy", "Skrytá kópia", "Skrytá kopie", "Titkos másolat", "Copie ascunsă", "Copia nascosta", "Blindkopie"],
  event: ["Event", "Udalosť", "Událost", "Esemény", "Eveniment", "Evento", "Ereignis"],
  oncePerTick: ["Once per scheduled tick", "Raz pri každom plánovanom intervale", "Jednou při každém plánovaném intervalu", "Egyszer minden ütemezett futáskor", "O dată la fiecare interval programat", "Una volta a ogni intervallo pianificato", "Einmal pro geplantem Intervall"],
  "value.schedule": ["Scheduled", "Plánované", "Plánované", "Ütemezett", "Programat", "Pianificato", "Geplant"],
  "value.hourly": ["Hourly", "Každú hodinu", "Každou hodinu", "Óránként", "Din oră în oră", "Ogni ora", "Stündlich"],
  "value.every_6_hours": ["Every 6 hours", "Každých 6 hodín", "Každých 6 hodin", "6 óránként", "La fiecare 6 ore", "Ogni 6 ore", "Alle 6 Stunden"],
  "value.daily": ["Daily", "Denne", "Denně", "Naponta", "Zilnic", "Ogni giorno", "Täglich"],
  "value.weekly": ["Weekly", "Týždenne", "Týdně", "Hetente", "Săptămânal", "Ogni settimana", "Wöchentlich"],
  "value.user": ["User", "Používateľ", "Uživatel", "Felhasználó", "Utilizator", "Utente", "Benutzer"],
  "value.group": ["Group", "Skupina", "Skupina", "Csoport", "Grup", "Gruppo", "Gruppe"],
  "value.role": ["Role", "Rola", "Role", "Szerepkör", "Rol", "Ruolo", "Rolle"],
  "value.personal": ["Personal mailbox", "Osobná schránka", "Osobní schránka", "Személyes postafiók", "Căsuță personală", "Casella personale", "Persönliches Postfach"],
  "value.system": ["System mailbox", "Systémová schránka", "Systémová schránka", "Rendszerpostafiók", "Căsuță de sistem", "Casella di sistema", "Systempostfach"],
  "value.selected": ["Selected", "Vybrané", "Vybrané", "Kiválasztott", "Selectate", "Selezionati", "Ausgewählt"],
  "value.any_sender": ["Any sender", "Ľubovoľný odosielateľ", "Libovolný odesílatel", "Bármely feladó", "Orice expeditor", "Qualsiasi mittente", "Beliebiger Absender"],
};
export function getFlowExtraLabels(locale: Locale): Record<string, string> {
  const index = Math.max(0, languages.indexOf(locale as typeof languages[number]));
  return Object.fromEntries(Object.entries(labels).map(([key, values]) => [key, values[index]]));
}
