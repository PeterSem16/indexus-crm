/** Default notification copies. Applying one never changes routing or WHEN/IF. */
export const NOTIFICATION_TEMPLATE_LANGUAGES = ["sk", "en", "cs", "hu", "ro", "it", "de"] as const;
export const NOTIFICATION_TEMPLATE_KEYS = ["attention", "created", "updated", "status-changed", "assigned", "completed", "overdue"] as const;

const localized: Record<typeof NOTIFICATION_TEMPLATE_LANGUAGES[number], { names: string[]; messages: string[] }> = {
  sk: {
    names: ["Potrebná pozornosť", "Bola vytvorená nová úloha", "Úloha bola upravená", "Stav úlohy bol zmenený na {{newValues.status}}", "Úloha bola priradená", "Úloha bola dokončená", "Úloha je po termíne"],
    messages: ["Záznam vyžaduje vašu pozornosť. Skontrolujte aktuálny stav a ďalší postup.", "Bola vytvorená úloha „{{newValues.title}}“.", "Úloha „{{newValues.title}}“ bola upravená. Skontrolujte aktuálne údaje.", "Úloha „{{newValues.title}}“ má nový stav: {{newValues.status}}.", "Úloha „{{newValues.title}}“ bola priradená. Skontrolujte jej podrobnosti.", "Úloha „{{newValues.title}}“ bola dokončená.", "Úloha „{{newValues.title}}“ má prekročený termín. Skontrolujte ďalší postup."],
  },
  en: {
    names: ["Attention required", "A new task was created", "Task updated", "Task status changed to {{newValues.status}}", "Task assigned", "Task completed", "Task overdue"],
    messages: ["This record needs your attention. Check its current state and next steps.", "Task “{{newValues.title}}” was created.", "Task “{{newValues.title}}” was updated. Check its current details.", "Task “{{newValues.title}}” has a new status: {{newValues.status}}.", "Task “{{newValues.title}}” was assigned. Check its details.", "Task “{{newValues.title}}” was completed.", "Task “{{newValues.title}}” is overdue. Check the next steps."],
  },
  cs: {
    names: ["Vyžaduje pozornost", "Byl vytvořen nový úkol", "Úkol byl upraven", "Stav úkolu byl změněn na {{newValues.status}}", "Úkol byl přiřazen", "Úkol byl dokončen", "Úkol je po termínu"],
    messages: ["Záznam vyžaduje vaši pozornost. Zkontrolujte aktuální stav a další postup.", "Byl vytvořen úkol „{{newValues.title}}“.", "Úkol „{{newValues.title}}“ byl upraven. Zkontrolujte aktuální údaje.", "Úkol „{{newValues.title}}“ má nový stav: {{newValues.status}}.", "Úkol „{{newValues.title}}“ byl přiřazen. Zkontrolujte jeho podrobnosti.", "Úkol „{{newValues.title}}“ byl dokončen.", "Úkol „{{newValues.title}}“ má překročený termín. Zkontrolujte další postup."],
  },
  hu: {
    names: ["Figyelmet igényel", "Új feladat jött létre", "A feladat módosult", "A feladat állapota erre változott: {{newValues.status}}", "A feladat kiosztva", "A feladat befejeződött", "A feladat határideje lejárt"],
    messages: ["Ez a rekord figyelmet igényel. Ellenőrizze az aktuális állapotot és a következő lépéseket.", "Létrejött a(z) „{{newValues.title}}” feladat.", "A(z) „{{newValues.title}}” feladat módosult. Ellenőrizze az aktuális adatokat.", "A(z) „{{newValues.title}}” feladat új állapota: {{newValues.status}}.", "A(z) „{{newValues.title}}” feladat kiosztásra került. Ellenőrizze a részleteit.", "A(z) „{{newValues.title}}” feladat befejeződött.", "A(z) „{{newValues.title}}” feladat határideje lejárt. Ellenőrizze a következő lépéseket."],
  },
  ro: {
    names: ["Necesită atenție", "A fost creată o sarcină nouă", "Sarcina a fost actualizată", "Starea sarcinii s-a schimbat în {{newValues.status}}", "Sarcina a fost atribuită", "Sarcina a fost finalizată", "Sarcina este întârziată"],
    messages: ["Această înregistrare necesită atenția dumneavoastră. Verificați starea actuală și pașii următori.", "A fost creată sarcina „{{newValues.title}}”.", "Sarcina „{{newValues.title}}” a fost actualizată. Verificați detaliile actuale.", "Sarcina „{{newValues.title}}” are o stare nouă: {{newValues.status}}.", "Sarcina „{{newValues.title}}” a fost atribuită. Verificați detaliile.", "Sarcina „{{newValues.title}}” a fost finalizată.", "Sarcina „{{newValues.title}}” a depășit termenul. Verificați pașii următori."],
  },
  it: {
    names: ["Richiede attenzione", "È stata creata una nuova attività", "Attività aggiornata", "Lo stato dell’attività è cambiato in {{newValues.status}}", "Attività assegnata", "Attività completata", "Attività scaduta"],
    messages: ["Questo record richiede attenzione. Verificare lo stato attuale e i prossimi passi.", "È stata creata l’attività “{{newValues.title}}”.", "L’attività “{{newValues.title}}” è stata aggiornata. Verificare i dettagli attuali.", "L’attività “{{newValues.title}}” ha un nuovo stato: {{newValues.status}}.", "L’attività “{{newValues.title}}” è stata assegnata. Verificare i dettagli.", "L’attività “{{newValues.title}}” è stata completata.", "L’attività “{{newValues.title}}” ha superato la scadenza. Verificare i prossimi passi."],
  },
  de: {
    names: ["Aufmerksamkeit erforderlich", "Eine neue Aufgabe wurde erstellt", "Aufgabe aktualisiert", "Aufgabenstatus geändert auf {{newValues.status}}", "Aufgabe zugewiesen", "Aufgabe abgeschlossen", "Aufgabe überfällig"],
    messages: ["Dieser Datensatz benötigt Ihre Aufmerksamkeit. Prüfen Sie den aktuellen Stand und die nächsten Schritte.", "Die Aufgabe „{{newValues.title}}“ wurde erstellt.", "Die Aufgabe „{{newValues.title}}“ wurde aktualisiert. Prüfen Sie die aktuellen Angaben.", "Die Aufgabe „{{newValues.title}}“ hat einen neuen Status: {{newValues.status}}.", "Die Aufgabe „{{newValues.title}}“ wurde zugewiesen. Prüfen Sie die Details.", "Die Aufgabe „{{newValues.title}}“ wurde abgeschlossen.", "Die Aufgabe „{{newValues.title}}“ ist überfällig. Prüfen Sie die nächsten Schritte."],
  },
};

export function notificationTemplateDefaults(language: typeof NOTIFICATION_TEMPLATE_LANGUAGES[number]) {
  return NOTIFICATION_TEMPLATE_KEYS.map((key, index) => ({
    id: `indexus-notification-template-${key}-${language}`,
    name: localized[language].names[index].replace("{{newValues.status}}", "…"),
    type: "notification" as const,
    format: "text" as const,
    subject: localized[language].names[index],
    content: localized[language].messages[index],
    language,
    isActive: true,
  }));
}
