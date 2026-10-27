type HistoryCopy = {
  source: string; answer: string; cleared: string; question: string; step: string;
  confirmed: string; unconfirmed: string; note: string; status: string; callback: string;
  email: string; sms: string; task: string; action: string; workflow: string;
  selected: string; unselected: string; failed: string; skipped: string; kept: string;
};
const copies: Record<string, HistoryCopy> = {
  en: { source: "Status list", answer: "Answer saved", cleared: "Answer cleared", question: "Question",
    step: "Step", confirmed: "Step confirmed", unconfirmed: "Step confirmation removed", note: "Step note updated",
    status: "Call status changed", callback: "Callback scheduled", email: "Email sent", sms: "SMS sent",
    task: "Task assigned", action: "Action recorded", workflow: "Rule evaluated", selected: "Selected",
    unselected: "Not selected", failed: "Action failed", skipped: "Action skipped", kept: "Existing callback preserved" },
  sk: { source: "Status list", answer: "Odpoveď uložená", cleared: "Odpoveď zrušená", question: "Otázka",
    step: "Krok", confirmed: "Krok potvrdený", unconfirmed: "Potvrdenie kroku zrušené", note: "Poznámka ku kroku upravená",
    status: "Stav hovoru zmenený", callback: "Spätné volanie naplánované", email: "E-mail odoslaný", sms: "SMS odoslaná",
    task: "Úloha pridelená", action: "Akcia zaznamenaná", workflow: "Pravidlo vyhodnotené", selected: "Vybrané",
    unselected: "Nevybrané", failed: "Akcia zlyhala", skipped: "Akcia preskočená", kept: "Pôvodné spätné volanie zachované" },
  cs: { source: "Status list", answer: "Odpověď uložena", cleared: "Odpověď zrušena", question: "Otázka",
    step: "Krok", confirmed: "Krok potvrzen", unconfirmed: "Potvrzení kroku zrušeno", note: "Poznámka ke kroku upravena",
    status: "Stav hovoru změněn", callback: "Zpětné volání naplánováno", email: "E-mail odeslán", sms: "SMS odeslána",
    task: "Úkol přidělen", action: "Akce zaznamenána", workflow: "Pravidlo vyhodnoceno", selected: "Vybráno",
    unselected: "Nevybráno", failed: "Akce selhala", skipped: "Akce přeskočena", kept: "Původní zpětné volání zachováno" },
  hu: { source: "Status list", answer: "Válasz mentve", cleared: "Válasz törölve", question: "Kérdés",
    step: "Lépés", confirmed: "Lépés megerősítve", unconfirmed: "Lépés megerősítése törölve", note: "Lépés megjegyzése módosítva",
    status: "Hívásállapot módosítva", callback: "Visszahívás ütemezve", email: "E-mail elküldve", sms: "SMS elküldve",
    task: "Feladat kiosztva", action: "Művelet rögzítve", workflow: "Szabály kiértékelve", selected: "Kiválasztva",
    unselected: "Nincs kiválasztva", failed: "Sikertelen művelet", skipped: "Művelet kihagyva", kept: "Korábbi visszahívás megtartva" },
  ro: { source: "Status list", answer: "Răspuns salvat", cleared: "Răspuns șters", question: "Întrebare",
    step: "Pas", confirmed: "Pas confirmat", unconfirmed: "Confirmarea pasului anulată", note: "Nota pasului actualizată",
    status: "Starea apelului modificată", callback: "Reapelare programată", email: "E-mail trimis", sms: "SMS trimis",
    task: "Sarcină atribuită", action: "Acțiune înregistrată", workflow: "Regulă evaluată", selected: "Selectat",
    unselected: "Neselectat", failed: "Acțiune eșuată", skipped: "Acțiune omisă", kept: "Reapelarea existentă păstrată" },
  it: { source: "Status list", answer: "Risposta salvata", cleared: "Risposta cancellata", question: "Domanda",
    step: "Passaggio", confirmed: "Passaggio confermato", unconfirmed: "Conferma del passaggio annullata", note: "Nota del passaggio aggiornata",
    status: "Stato chiamata modificato", callback: "Richiamata pianificata", email: "E-mail inviata", sms: "SMS inviato",
    task: "Attività assegnata", action: "Azione registrata", workflow: "Regola valutata", selected: "Selezionato",
    unselected: "Non selezionato", failed: "Azione non riuscita", skipped: "Azione saltata", kept: "Richiamata esistente mantenuta" },
  de: { source: "Status list", answer: "Antwort gespeichert", cleared: "Antwort gelöscht", question: "Frage",
    step: "Schritt", confirmed: "Schritt bestätigt", unconfirmed: "Schrittbestätigung aufgehoben", note: "Schrittnotiz aktualisiert",
    status: "Anrufstatus geändert", callback: "Rückruf geplant", email: "E-Mail gesendet", sms: "SMS gesendet",
    task: "Aufgabe zugewiesen", action: "Aktion protokolliert", workflow: "Regel ausgewertet", selected: "Ausgewählt",
    unselected: "Nicht ausgewählt", failed: "Aktion fehlgeschlagen", skipped: "Aktion übersprungen", kept: "Bestehender Rückruf beibehalten" },
};
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const object = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};

/** Human text only: never fall back to event codes, UUIDs, or JSON serialization. */
export function formatStatusListHistory(event: { action?: string; metadata?: unknown }, locale = "en") {
  if (!event.action?.startsWith("status_list_")) return null;
  const c = copies[locale] || copies.en;
  const m = object(event.metadata);
  const labels = object(m.statusListHistory);
  const snapshot = (key: string) => Object.prototype.hasOwnProperty.call(m, key)
    ? text(m[key]) : text(labels[key]);
  const question = snapshot("questionLabel") || snapshot("questionText");
  const item = snapshot("itemLabel");
  const disposition = snapshot("dispositionName");
  const detail: string[] = [];
  let title = c.action;
  const withLabel = (label: string, name: string) => name ? `${label}: ${name}` : label;
  if (event.action === "status_list_answer") {
    title = withLabel(m.value === null ? c.cleared : c.answer, question || item || c.question);
    const answer = (value: unknown): string => {
      if (value === true) return c.selected;
      if (value === false) return c.unselected;
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
      if (typeof value === "string" && !/^[a-f0-9-]{36}$/i.test(value)) return value;
      return "";
    };
    const previous = answer(m.previous);
    const value = answer(m.value);
    if (value) detail.push(previous && previous !== value ? `${previous} → ${value}` : value);
  } else if (event.action === "status_list_confirmation") {
    title = withLabel(m.confirmed === false ? c.unconfirmed : c.confirmed, item || c.step);
    if (text(m.itemNote)) detail.push(m.itemNote);
  } else if (event.action === "status_list_note_update") {
    title = withLabel(c.note, item || c.step);
    if (text(m.itemNote)) detail.push(m.itemNote);
  } else if (event.action === "status_list_workflow") {
    title = withLabel(c.workflow, text(m.ruleName));
    if (text(m.sourceLabel) || question || item) detail.push(text(m.sourceLabel) || question || item);
  } else {
    const type = text(m.actionType) || text(labels.actionType);
    const names: Record<string, string> = {
      set_contact_status: c.status, set_callback: c.callback, send_email_group: c.email,
      send_contact_email: c.email, notify_email: c.email, send_sms: c.sms, assign_task: c.task,
    };
    title = names[type] || c.action;
    if (m.ok === false || m.status === "failed") title = c.failed;
    else if (m.skipped === true || m.status === "skipped") title = c.skipped;
    else if (m.keptExisting === true || m.status === "kept_existing") title = c.kept;
    if (type === "set_contact_status") title = withLabel(title, disposition);
    if (question || item) detail.push(question || item);
    if (typeof m.callbackDate === "string") {
      const date = new Date(m.callbackDate);
      if (Number.isFinite(date.getTime())) detail.push(new Intl.DateTimeFormat(locale in copies ? locale : "en", {
        timeZone: "Europe/Bratislava", dateStyle: "medium", timeStyle: "short",
      }).format(date));
    }
    if (text(m.callbackNote)) detail.push(m.callbackNote);
  }
  return { source: c.source, title, details: detail.join(" · ") };
}
