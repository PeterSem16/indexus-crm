import type { Locale } from "@/i18n/translations";

export type RecordActivityCopy = {
  actions: Record<string, string>;
  fields: Record<string, string>;
  yes: string;
  no: string;
  unknown: string;
  genericAction: string;
  moduleNames: Record<string, string>;
};

export const recordActivityTranslations: Record<Locale, RecordActivityCopy> = {
  en: {
    actions: {
      status_list_background: "Background automation ran",
      status_list_action: "Automation action ran",
      status_list_answer: "Automation answer recorded",
      set_callback: "Callback scheduled",
      send_email: "Email sent",
      send_email_group: "Email sent to group",
      send_sms: "Text message sent",
      set_status: "Status changed",
      assign_task: "Task assigned",
      create_task: "Task created",
      complete_task: "Task completed",
      call: "Call recorded",
      agreement_updated: "Agreement updated",
      agreement_added: "Agreement added",
      agreement_version_added: "Agreement version added",
      agreement_archived: "Agreement archived",
      agreement_file_deletion_requested: "File deletion requested",
      agreement_file_deleted: "File deleted",
    },
    fields: { validFrom: "Valid from", validTo: "Valid until", active: "Active", status: "Status", name: "Name", title: "Title", description: "Description", reason: "Reason", campaignName: "Campaign", campaign: "Campaign", action: "Action", answer: "Answer", value: "Value", actionType: "Action", dispositionCode: "Outcome", recipientCount: "Recipients", fileName: "File", version: "Version", previousStatus: "Previous status", newStatus: "New status", statusListItemLabel: "Status-list item", itemLabel: "Item", questionLabel: "Question", optionLabel: "Option", callbackDate: "Callback date", previousCallbackDate: "Previous callback date", callbackNote: "Callback note", taskTitle: "Task", assignedToName: "Assigned to", outcome: "Outcome" },
    yes: "Yes", no: "No", unknown: "Other event", genericAction: "Activity recorded",
    moduleNames: { clinic: "Clinic", clinics: "Clinics", hospital: "Hospital", hospitals: "Hospitals", agreement: "Agreement", agreements: "Agreements", campaign: "Campaign", status_list: "Status list" },
  },
  sk: {
    actions: { status_list_background: "Spustená automatizácia na pozadí", status_list_action: "Vykonaný automatizačný krok", status_list_answer: "Zaznamenaná automatizačná odpoveď", set_callback: "Naplánovaný spätný hovor", send_email: "Odoslaný e-mail", send_email_group: "Odoslaný e-mail skupine", send_sms: "Odoslaná SMS", set_status: "Zmenený stav", assign_task: "Priradená úloha", create_task: "Vytvorená úloha", complete_task: "Úloha dokončená", call: "Zaznamenaný hovor", agreement_updated: "Zmluva upravená", agreement_added: "Zmluva pridaná", agreement_version_added: "Pridaná verzia zmluvy", agreement_archived: "Zmluva archivovaná", agreement_file_deletion_requested: "Vyžiadané odstránenie súboru", agreement_file_deleted: "Súbor odstránený" },
    fields: { validFrom: "Platná od", validTo: "Platná do", active: "Aktívna", status: "Stav", name: "Názov", title: "Nadpis", description: "Popis", reason: "Dôvod", campaignName: "Kampaň", campaign: "Kampaň", action: "Akcia", answer: "Odpoveď", value: "Hodnota", actionType: "Akcia", dispositionCode: "Výsledok", recipientCount: "Príjemcovia", fileName: "Súbor", version: "Verzia", previousStatus: "Predchádzajúci stav", newStatus: "Nový stav", statusListItemLabel: "Položka zoznamu stavov", itemLabel: "Položka", questionLabel: "Otázka", optionLabel: "Možnosť", callbackDate: "Dátum spätného hovoru", previousCallbackDate: "Predchádzajúci dátum hovoru", callbackNote: "Poznámka k hovoru", taskTitle: "Úloha", assignedToName: "Priradené", outcome: "Výsledok" },
    yes: "Áno", no: "Nie", unknown: "Iná udalosť", genericAction: "Zaznamenaná aktivita",
    moduleNames: { clinic: "Klinika", clinics: "Kliniky", hospital: "Nemocnica", hospitals: "Nemocnice", agreement: "Zmluva", agreements: "Zmluvy", campaign: "Kampaň", status_list: "Zoznam stavov" },
  },
  cs: {
    actions: { status_list_background: "Spuštěna automatizace na pozadí", status_list_action: "Provedena automatizační akce", status_list_answer: "Zaznamenána automatizační odpověď", set_callback: "Naplánováno zpětné volání", send_email: "Odeslán e-mail", send_email_group: "E-mail odeslán skupině", send_sms: "Odeslána SMS", set_status: "Změněn stav", assign_task: "Přiřazen úkol", create_task: "Vytvořen úkol", complete_task: "Úkol dokončen", call: "Zaznamenán hovor", agreement_updated: "Smlouva upravena", agreement_added: "Smlouva přidána", agreement_version_added: "Přidána verze smlouvy", agreement_archived: "Smlouva archivována", agreement_file_deletion_requested: "Vyžádáno odstranění souboru", agreement_file_deleted: "Soubor odstraněn" },
    fields: { validFrom: "Platnost od", validTo: "Platnost do", active: "Aktivní", status: "Stav", name: "Název", title: "Název", description: "Popis", reason: "Důvod", campaignName: "Kampaň", campaign: "Kampaň", action: "Akce", answer: "Odpověď", value: "Hodnota", actionType: "Akce", dispositionCode: "Výsledek", recipientCount: "Příjemci", fileName: "Soubor", version: "Verze", previousStatus: "Předchozí stav", newStatus: "Nový stav", statusListItemLabel: "Položka seznamu stavů", itemLabel: "Položka", questionLabel: "Otázka", optionLabel: "Možnost", callbackDate: "Datum zpětného volání", previousCallbackDate: "Předchozí datum volání", callbackNote: "Poznámka k volání", taskTitle: "Úkol", assignedToName: "Přiřazeno", outcome: "Výsledek" },
    yes: "Ano", no: "Ne", unknown: "Jiná událost", genericAction: "Zaznamenaná aktivita",
    moduleNames: { clinic: "Klinika", clinics: "Kliniky", hospital: "Nemocnice", hospitals: "Nemocnice", agreement: "Smlouva", agreements: "Smlouvy", campaign: "Kampaň", status_list: "Seznam stavů" },
  },
  hu: {
    actions: { status_list_background: "Háttér-automatizálás futott", status_list_action: "Automatizálási művelet futott", status_list_answer: "Automatizálási válasz rögzítve", set_callback: "Visszahívás ütemezve", send_email: "E-mail elküldve", send_email_group: "E-mail elküldve a csoportnak", send_sms: "SMS elküldve", set_status: "Állapot módosítva", assign_task: "Feladat kiosztva", create_task: "Feladat létrehozva", complete_task: "Feladat befejezve", call: "Hívás rögzítve", agreement_updated: "Megállapodás módosítva", agreement_added: "Megállapodás hozzáadva", agreement_version_added: "Megállapodás-verzió hozzáadva", agreement_archived: "Megállapodás archiválva", agreement_file_deletion_requested: "Fájltörlés kérve", agreement_file_deleted: "Fájl törölve" },
    fields: { validFrom: "Érvényes ettől", validTo: "Érvényes eddig", active: "Aktív", status: "Állapot", name: "Név", title: "Cím", description: "Leírás", reason: "Indok", campaignName: "Kampány", campaign: "Kampány", action: "Művelet", answer: "Válasz", value: "Érték", actionType: "Művelet", dispositionCode: "Eredmény", recipientCount: "Címzettek", fileName: "Fájl", version: "Verzió", previousStatus: "Korábbi állapot", newStatus: "Új állapot", statusListItemLabel: "Állapotlista-elem", itemLabel: "Elem", questionLabel: "Kérdés", optionLabel: "Lehetőség", callbackDate: "Visszahívás dátuma", previousCallbackDate: "Korábbi hívás dátuma", callbackNote: "Hívási megjegyzés", taskTitle: "Feladat", assignedToName: "Felelős", outcome: "Eredmény" },
    yes: "Igen", no: "Nem", unknown: "Egyéb esemény", genericAction: "Tevékenység rögzítve",
    moduleNames: { clinic: "Rendelő", clinics: "Rendelők", hospital: "Kórház", hospitals: "Kórházak", agreement: "Megállapodás", agreements: "Megállapodások", campaign: "Kampány", status_list: "Állapotlista" },
  },
  ro: {
    actions: { status_list_background: "A rulat automatizarea de fundal", status_list_action: "A rulat o acțiune automatizată", status_list_answer: "Răspuns automat înregistrat", set_callback: "Apel programat", send_email: "E-mail trimis", send_email_group: "E-mail trimis grupului", send_sms: "SMS trimis", set_status: "Stare modificată", assign_task: "Sarcină atribuită", create_task: "Sarcină creată", complete_task: "Sarcină finalizată", call: "Apel înregistrat", agreement_updated: "Acord actualizat", agreement_added: "Acord adăugat", agreement_version_added: "Versiune de acord adăugată", agreement_archived: "Acord arhivat", agreement_file_deletion_requested: "Ștergere de fișier solicitată", agreement_file_deleted: "Fișier șters" },
    fields: { validFrom: "Valabil de la", validTo: "Valabil până la", active: "Activ", status: "Stare", name: "Nume", title: "Titlu", description: "Descriere", reason: "Motiv", campaignName: "Campanie", campaign: "Campanie", action: "Acțiune", answer: "Răspuns", value: "Valoare", actionType: "Acțiune", dispositionCode: "Rezultat", recipientCount: "Destinatari", fileName: "Fișier", version: "Versiune", previousStatus: "Stare anterioară", newStatus: "Stare nouă", statusListItemLabel: "Element din lista de stări", itemLabel: "Element", questionLabel: "Întrebare", optionLabel: "Opțiune", callbackDate: "Data apelului", previousCallbackDate: "Data anterioară a apelului", callbackNote: "Notă apel", taskTitle: "Sarcină", assignedToName: "Atribuit către", outcome: "Rezultat" },
    yes: "Da", no: "Nu", unknown: "Alt eveniment", genericAction: "Activitate înregistrată",
    moduleNames: { clinic: "Clinică", clinics: "Clinici", hospital: "Spital", hospitals: "Spitale", agreement: "Acord", agreements: "Acorduri", campaign: "Campanie", status_list: "Listă de stări" },
  },
  it: {
    actions: { status_list_background: "Automazione in background eseguita", status_list_action: "Azione automatizzata eseguita", status_list_answer: "Risposta automatizzata registrata", set_callback: "Richiamo pianificato", send_email: "E-mail inviata", send_email_group: "E-mail inviata al gruppo", send_sms: "SMS inviato", set_status: "Stato modificato", assign_task: "Attività assegnata", create_task: "Attività creata", complete_task: "Attività completata", call: "Chiamata registrata", agreement_updated: "Accordo aggiornato", agreement_added: "Accordo aggiunto", agreement_version_added: "Versione accordo aggiunta", agreement_archived: "Accordo archiviato", agreement_file_deletion_requested: "Eliminazione file richiesta", agreement_file_deleted: "File eliminato" },
    fields: { validFrom: "Valido dal", validTo: "Valido fino al", active: "Attivo", status: "Stato", name: "Nome", title: "Titolo", description: "Descrizione", reason: "Motivo", campaignName: "Campagna", campaign: "Campagna", action: "Azione", answer: "Risposta", value: "Valore", actionType: "Azione", dispositionCode: "Esito", recipientCount: "Destinatari", fileName: "File", version: "Versione", previousStatus: "Stato precedente", newStatus: "Nuovo stato", statusListItemLabel: "Elemento elenco stati", itemLabel: "Elemento", questionLabel: "Domanda", optionLabel: "Opzione", callbackDate: "Data richiamo", previousCallbackDate: "Data richiamo precedente", callbackNote: "Nota chiamata", taskTitle: "Attività", assignedToName: "Assegnato a", outcome: "Esito" },
    yes: "Sì", no: "No", unknown: "Altro evento", genericAction: "Attività registrata",
    moduleNames: { clinic: "Clinica", clinics: "Cliniche", hospital: "Ospedale", hospitals: "Ospedali", agreement: "Accordo", agreements: "Accordi", campaign: "Campagna", status_list: "Elenco stati" },
  },
  de: {
    actions: { status_list_background: "Hintergrundautomatisierung ausgeführt", status_list_action: "Automatisierungsaktion ausgeführt", status_list_answer: "Automatisierungsantwort erfasst", set_callback: "Rückruf geplant", send_email: "E-Mail gesendet", send_email_group: "E-Mail an Gruppe gesendet", send_sms: "SMS gesendet", set_status: "Status geändert", assign_task: "Aufgabe zugewiesen", create_task: "Aufgabe erstellt", complete_task: "Aufgabe abgeschlossen", call: "Anruf erfasst", agreement_updated: "Vereinbarung aktualisiert", agreement_added: "Vereinbarung hinzugefügt", agreement_version_added: "Vereinbarungsversion hinzugefügt", agreement_archived: "Vereinbarung archiviert", agreement_file_deletion_requested: "Dateilöschung angefordert", agreement_file_deleted: "Datei gelöscht" },
    fields: { validFrom: "Gültig ab", validTo: "Gültig bis", active: "Aktiv", status: "Status", name: "Name", title: "Titel", description: "Beschreibung", reason: "Grund", campaignName: "Kampagne", campaign: "Kampagne", action: "Aktion", answer: "Antwort", value: "Wert", actionType: "Aktion", dispositionCode: "Ergebnis", recipientCount: "Empfänger", fileName: "Datei", version: "Version", previousStatus: "Vorheriger Status", newStatus: "Neuer Status", statusListItemLabel: "Statuslisteneintrag", itemLabel: "Eintrag", questionLabel: "Frage", optionLabel: "Option", callbackDate: "Rückrufdatum", previousCallbackDate: "Vorheriges Rückrufdatum", callbackNote: "Rückrufnotiz", taskTitle: "Aufgabe", assignedToName: "Zugewiesen an", outcome: "Ergebnis" },
    yes: "Ja", no: "Nein", unknown: "Sonstiges Ereignis", genericAction: "Aktivität erfasst",
    moduleNames: { clinic: "Klinik", clinics: "Kliniken", hospital: "Krankenhaus", hospitals: "Krankenhäuser", agreement: "Vereinbarung", agreements: "Vereinbarungen", campaign: "Kampagne", status_list: "Statusliste" },
  },
};

export function getRecordActivityCopy(locale: Locale): RecordActivityCopy {
  return recordActivityTranslations[locale] || recordActivityTranslations.en;
}
