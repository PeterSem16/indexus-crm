export type EmailCardRecipientSource = "main" | "persons";

export const automationEmailCardRecipientCopy = {
  en: {
    section: "Card recipients",
    main: "Main clinic / hospital email",
    persons: "Assigned people",
    help: "Addresses are read when the action runs from the event’s clinic or hospital card. Assigned people means active linked collaborators with an email. The card’s country must pass validation; addresses are deduplicated across To, CC and BCC. If no eligible person or email is available, the action fails rather than choosing another card.",
  },
  sk: {
    section: "Príjemcovia z karty",
    main: "Hlavný e-mail kliniky / nemocnice",
    persons: "Priradené osoby",
    help: "Adresy sa načítajú pri spustení akcie z karty kliniky alebo nemocnice v udalosti. Priradené osoby sú aktívni prepojení spolupracovníci s e-mailom. Krajina karty musí prejsť validáciou; adresy sa deduplikujú naprieč Komu, Kópia a Skrytá kópia. Ak nie je dostupná oprávnená osoba alebo e-mail, akcia zlyhá a nevyberie inú kartu.",
  },
  cs: {
    section: "Příjemci z karty",
    main: "Hlavní e-mail ordinace / nemocnice",
    persons: "Přiřazené osoby",
    help: "Adresy se načtou při spuštění akce z karty ordinace nebo nemocnice v události. Přiřazené osoby jsou aktivní propojení spolupracovníci s e-mailem. Země karty musí projít validací; adresy se deduplikují napříč Komu, Kopie a Skrytá kopie. Pokud není dostupná oprávněná osoba nebo e-mail, akce selže a nevybere jinou kartu.",
  },
  hu: {
    section: "Kártya címzettjei",
    main: "Klinika / kórház fő e-mail-címe",
    persons: "Hozzárendelt személyek",
    help: "A címek a művelet futásakor, az esemény klinika- vagy kórházi kártyájáról töltődnek be. A hozzárendelt személyek aktív, kapcsolt, e-mail-címmel rendelkező közreműködők. A kártya országának át kell mennie az ellenőrzésen; a címek a Címzett, Másolat és Titkos másolat mezők között deduplikálódnak. Ha nincs jogosult személy vagy cím, a művelet hibával leáll, nem választ másik kártyát.",
  },
  ro: {
    section: "Destinatari din fișă",
    main: "E-mailul principal al clinicii / spitalului",
    persons: "Persoane alocate",
    help: "Adresele sunt citite la executarea acțiunii din fișa clinicii sau spitalului din eveniment. Persoanele alocate sunt colaboratori activi conectați, cu e-mail. Țara fișei trebuie să treacă validarea; adresele sunt deduplicate între Către, CC și BCC. Dacă nu există o persoană eligibilă sau un e-mail, acțiunea eșuează în loc să aleagă altă fișă.",
  },
  it: {
    section: "Destinatari dalla scheda",
    main: "E-mail principale della clinica / ospedale",
    persons: "Persone assegnate",
    help: "Gli indirizzi vengono letti all’esecuzione dalla scheda clinica o ospedaliera dell’evento. Le persone assegnate sono collaboratori attivi collegati con un indirizzo e-mail. Il paese della scheda deve superare la convalida; gli indirizzi vengono deduplicati tra A, CC e CCN. Se non è disponibile una persona idonea o un’e-mail, l’azione fallisce senza scegliere un’altra scheda.",
  },
  de: {
    section: "Empfänger aus der Karte",
    main: "Haupt-E-Mail der Klinik / des Krankenhauses",
    persons: "Zugewiesene Personen",
    help: "Adressen werden bei Ausführung aus der Klinik- oder Krankenhauskarte des Ereignisses gelesen. Zugewiesene Personen sind aktive verknüpfte Mitarbeitende mit E-Mail-Adresse. Das Land der Karte muss die Prüfung bestehen; Adressen werden über An, CC und BCC hinweg dedupliziert. Gibt es keine geeignete Person oder E-Mail-Adresse, schlägt die Aktion fehl, statt eine andere Karte auszuwählen.",
  },
} as const;

export function getAutomationEmailCardRecipientCopy(locale: string) {
  return automationEmailCardRecipientCopy[locale.split("-")[0] as keyof typeof automationEmailCardRecipientCopy]
    || automationEmailCardRecipientCopy.en;
}
