const labels: Record<string, readonly string[]> = {
  assign_task: ["Assign task", "Priradiť úlohu", "Přiřadit úkol", "Feladat kiosztása", "Atribuie sarcină", "Assegna attività", "Aufgabe zuweisen"],
  create_task: ["Create task", "Vytvoriť úlohu", "Vytvořit úkol", "Feladat létrehozása", "Creează sarcină", "Crea attività", "Aufgabe erstellen"],
  send_email_group: ["Email group", "E-mail skupine", "E-mail skupině", "Csoportos e-mail", "E-mail grupului", "E-mail al gruppo", "E-Mail an Gruppe"],
  notify_email: ["Email notification", "E-mailové upozornenie", "E-mailové upozornění", "E-mail-értesítés", "Notificare e-mail", "Notifica e-mail", "E-Mail-Benachrichtigung"],
  send_sms: ["Send SMS", "Poslať SMS", "Poslat SMS", "SMS küldése", "Trimite SMS", "Invia SMS", "SMS senden"],
  send_contact_sms: ["SMS to contact", "SMS kontaktu", "SMS kontaktu", "SMS a kapcsolatnak", "SMS contactului", "SMS al contatto", "SMS an Kontakt"],
  send_contact_email: ["Email contact", "E-mail kontaktu", "E-mail kontaktu", "E-mail a kapcsolatnak", "E-mail contactului", "E-mail al contatto", "E-Mail an Kontakt"],
  set_contact_status: ["Change contact status", "Zmeniť stav kontaktu", "Změnit stav kontaktu", "Kapcsolati állapot módosítása", "Schimbă starea contactului", "Modifica stato contatto", "Kontaktstatus ändern"],
  set_callback: ["Schedule callback", "Naplánovať spätné volanie", "Naplánovat zpětné volání", "Visszahívás ütemezése", "Programează reapelare", "Pianifica richiamata", "Rückruf planen"],
  notify_role: ["Notify role", "Upozorniť rolu", "Upozornit roli", "Szerepkör értesítése", "Notifică rol", "Notifica ruolo", "Rolle benachrichtigen"],
  sys_webhook: ["System update", "Systémová aktualizácia", "Systémová aktualizace", "Rendszerfrissítés", "Actualizare sistem", "Aggiornamento sistema", "Systemaktualisierung"],
};
export function statusListActionLabel(type: string, locale: string) {
  return labels[type]?.[Math.max(0, ["en", "sk", "cs", "hu", "ro", "it", "de"].indexOf(locale))] || type.replaceAll("_", " ");
}
