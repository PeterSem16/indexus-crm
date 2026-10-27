export interface HospitalAgreementCopy {
  tab: string;
  title: string;
  description: string;
  saveFirstTitle: string;
  saveFirstDescription: string;
  viewOnly: string;
  loadError: string;
  retry: string;
  emptyTitle: string;
  emptyDescription: string;
  active: string;
  inactive: string;
  inValidity: string;
  expired: string;
  future: string;
  contractNumber: string;
  validFrom: string;
  validTo: string;
  file: string;
  fileRules: string;
  addAgreement: string;
  agreementTitle: string;
  download: string;
  edit: string;
  cancel: string;
  save: string;
  endValidity: string;
  reactivate: string;
  uploading: string;
  upload: string;
  uploadError: string;
  saveError: string;
  invalidFile: string;
  fileTooLarge: string;
  delete: string;
  deleteConfirmTitle: string;
  deleteConfirmDescription: string;
  deleteCancel: string;
  deleteConfirm: string;
  deleteError: string;
}

export const hospitalAgreementTranslations: Record<string, HospitalAgreementCopy> = {
  en: {
    tab: "Agreements", title: "Hospital agreements", description: "Files and validity periods attached to this hospital. An agreement does not by itself indicate cooperation.",
    saveFirstTitle: "Save the hospital first", saveFirstDescription: "Agreements can be added after the hospital has been saved.", viewOnly: "View only",
    loadError: "Hospital agreements could not be loaded.", retry: "Try again", emptyTitle: "No hospital agreements yet",
    emptyDescription: "Add a signed agreement and its validity dates for this hospital.", active: "Active", inactive: "Inactive",
    inValidity: "Within validity", expired: "Expired", future: "Starts in future", contractNumber: "Contract number",
    validFrom: "Valid from", validTo: "Valid to", file: "Agreement file", fileRules: "PDF, DOC, DOCX, JPEG or PNG · up to 20 MB",
    addAgreement: "Add hospital agreement", agreementTitle: "Agreement title", download: "Download", edit: "Edit details",
    cancel: "Cancel edit", save: "Save changes", endValidity: "End validity", reactivate: "Reactivate", uploading: "Uploading…",
    upload: "Upload agreement", uploadError: "Upload failed. Your form is still here.", saveError: "Could not save changes. Your draft is still here.",
    invalidFile: "Choose a PDF, DOC, DOCX, JPEG, or PNG file.", fileTooLarge: "The file must be no larger than 20 MB.",
    delete: "Delete", deleteConfirmTitle: "Delete this hospital agreement?", deleteConfirmDescription: "This permanently removes the agreement and its file from this hospital.",
    deleteCancel: "Keep agreement", deleteConfirm: "Delete agreement", deleteError: "The hospital agreement could not be deleted.",
  },
  sk: {
    tab: "Dohody", title: "Dohody nemocnice", description: "Súbory a obdobia platnosti priradené k tejto nemocnici. Dohoda sama osebe neznamená spoluprácu.",
    saveFirstTitle: "Najprv uložte nemocnicu", saveFirstDescription: "Dohody možno pridať po uložení nemocnice.", viewOnly: "Iba na čítanie",
    loadError: "Dohody nemocnice sa nepodarilo načítať.", retry: "Skúsiť znova", emptyTitle: "Zatiaľ bez dohôd nemocnice",
    emptyDescription: "Pridajte podpísanú dohodu a jej obdobie platnosti pre túto nemocnicu.", active: "Aktívna", inactive: "Neaktívna",
    inValidity: "V období platnosti", expired: "Platnosť skončila", future: "Platnosť začne neskôr", contractNumber: "Číslo zmluvy",
    validFrom: "Platná od", validTo: "Platná do", file: "Súbor dohody", fileRules: "PDF, DOC, DOCX, JPEG alebo PNG · najviac 20 MB",
    addAgreement: "Pridať dohodu nemocnice", agreementTitle: "Názov dohody", download: "Stiahnuť", edit: "Upraviť údaje",
    cancel: "Zrušiť úpravy", save: "Uložiť zmeny", endValidity: "Ukončiť platnosť", reactivate: "Znova aktivovať", uploading: "Nahrávanie…",
    upload: "Nahrať dohodu", uploadError: "Nahratie zlyhalo. Vyplnené údaje zostali zachované.", saveError: "Zmeny sa nepodarilo uložiť. Rozpracované údaje zostali zachované.",
    invalidFile: "Vyberte súbor PDF, DOC, DOCX, JPEG alebo PNG.", fileTooLarge: "Súbor môže mať najviac 20 MB.",
    delete: "Odstrániť", deleteConfirmTitle: "Odstrániť túto dohodu nemocnice?", deleteConfirmDescription: "Dohoda aj jej súbor sa natrvalo odstránia z tejto nemocnice.",
    deleteCancel: "Ponechať dohodu", deleteConfirm: "Odstrániť dohodu", deleteError: "Dohodu nemocnice sa nepodarilo odstrániť.",
  },
  cs: {
    tab: "Dohody", title: "Dohody nemocnice", description: "Soubory a období platnosti přiřazené k této nemocnici. Dohoda sama o sobě neznamená spolupráci.",
    saveFirstTitle: "Nejprve uložte nemocnici", saveFirstDescription: "Dohody lze přidat po uložení nemocnice.", viewOnly: "Pouze ke čtení",
    loadError: "Dohody nemocnice se nepodařilo načíst.", retry: "Zkusit znovu", emptyTitle: "Zatím žádné dohody nemocnice",
    emptyDescription: "Přidejte podepsanou dohodu a její období platnosti pro tuto nemocnici.", active: "Aktivní", inactive: "Neaktivní",
    inValidity: "V době platnosti", expired: "Platnost skončila", future: "Platnost začne později", contractNumber: "Číslo smlouvy",
    validFrom: "Platná od", validTo: "Platná do", file: "Soubor dohody", fileRules: "PDF, DOC, DOCX, JPEG nebo PNG · nejvýše 20 MB",
    addAgreement: "Přidat dohodu nemocnice", agreementTitle: "Název dohody", download: "Stáhnout", edit: "Upravit údaje",
    cancel: "Zrušit úpravy", save: "Uložit změny", endValidity: "Ukončit platnost", reactivate: "Znovu aktivovat", uploading: "Nahrávání…",
    upload: "Nahrát dohodu", uploadError: "Nahrání se nezdařilo. Vyplněné údaje zůstaly zachovány.", saveError: "Změny se nepodařilo uložit. Rozpracované údaje zůstaly zachovány.",
    invalidFile: "Vyberte soubor PDF, DOC, DOCX, JPEG nebo PNG.", fileTooLarge: "Soubor může mít nejvýše 20 MB.",
    delete: "Odstranit", deleteConfirmTitle: "Odstranit tuto dohodu nemocnice?", deleteConfirmDescription: "Dohoda i její soubor budou z této nemocnice trvale odstraněny.",
    deleteCancel: "Ponechat dohodu", deleteConfirm: "Odstranit dohodu", deleteError: "Dohodu nemocnice se nepodařilo odstranit.",
  },
  hu: {
    tab: "Megállapodások", title: "Kórházi megállapodások", description: "A kórházhoz tartozó fájlok és érvényességi időszakok. A megállapodás önmagában nem jelent együttműködést.",
    saveFirstTitle: "Először mentse a kórházat", saveFirstDescription: "Megállapodás csak a kórház mentése után adható hozzá.", viewOnly: "Csak megtekintés",
    loadError: "A kórházi megállapodások betöltése nem sikerült.", retry: "Újra", emptyTitle: "Még nincs kórházi megállapodás",
    emptyDescription: "Adja hozzá a kórház aláírt megállapodását és érvényességi dátumait.", active: "Aktív", inactive: "Inaktív",
    inValidity: "Érvényességi időn belül", expired: "Lejárt", future: "Később kezdődik", contractNumber: "Szerződésszám",
    validFrom: "Érvényes ettől", validTo: "Érvényes eddig", file: "Megállapodás fájlja", fileRules: "PDF, DOC, DOCX, JPEG vagy PNG · legfeljebb 20 MB",
    addAgreement: "Kórházi megállapodás hozzáadása", agreementTitle: "Megállapodás címe", download: "Letöltés", edit: "Adatok szerkesztése",
    cancel: "Mégse", save: "Módosítások mentése", endValidity: "Érvényesség lezárása", reactivate: "Újraaktiválás", uploading: "Feltöltés…",
    upload: "Megállapodás feltöltése", uploadError: "A feltöltés nem sikerült. A megadott adatok megmaradtak.", saveError: "A módosítások mentése nem sikerült. A piszkozat megmaradt.",
    invalidFile: "PDF, DOC, DOCX, JPEG vagy PNG fájlt válasszon.", fileTooLarge: "A fájl legfeljebb 20 MB lehet.",
    delete: "Törlés", deleteConfirmTitle: "Törli ezt a kórházi megállapodást?", deleteConfirmDescription: "A megállapodás és fájlja végleg törlődik ebből a kórházból.",
    deleteCancel: "Megtartás", deleteConfirm: "Megállapodás törlése", deleteError: "A kórházi megállapodás törlése nem sikerült.",
  },
  ro: {
    tab: "Acorduri", title: "Acorduri ale spitalului", description: "Fișiere și perioade de valabilitate asociate acestui spital. Un acord nu implică prin el însuși o colaborare.",
    saveFirstTitle: "Salvați mai întâi spitalul", saveFirstDescription: "Acordurile pot fi adăugate după salvarea spitalului.", viewOnly: "Doar vizualizare",
    loadError: "Acordurile spitalului nu au putut fi încărcate.", retry: "Încercați din nou", emptyTitle: "Nu există încă acorduri pentru spital",
    emptyDescription: "Adăugați acordul semnat și datele sale de valabilitate pentru acest spital.", active: "Activ", inactive: "Inactiv",
    inValidity: "În perioada de valabilitate", expired: "Expirat", future: "Începe în viitor", contractNumber: "Număr contract",
    validFrom: "Valabil de la", validTo: "Valabil până la", file: "Fișierul acordului", fileRules: "PDF, DOC, DOCX, JPEG sau PNG · maximum 20 MB",
    addAgreement: "Adaugă acordul spitalului", agreementTitle: "Titlul acordului", download: "Descarcă", edit: "Editează detaliile",
    cancel: "Anulează editarea", save: "Salvează modificările", endValidity: "Încheie valabilitatea", reactivate: "Reactivează", uploading: "Se încarcă…",
    upload: "Încarcă acordul", uploadError: "Încărcarea a eșuat. Formularul a fost păstrat.", saveError: "Modificările nu au putut fi salvate. Ciorna a fost păstrată.",
    invalidFile: "Alegeți un fișier PDF, DOC, DOCX, JPEG sau PNG.", fileTooLarge: "Fișierul nu poate depăși 20 MB.",
    delete: "Șterge", deleteConfirmTitle: "Ștergeți acest acord al spitalului?", deleteConfirmDescription: "Acordul și fișierul său vor fi eliminate definitiv din acest spital.",
    deleteCancel: "Păstrează acordul", deleteConfirm: "Șterge acordul", deleteError: "Acordul spitalului nu a putut fi șters.",
  },
  it: {
    tab: "Accordi", title: "Accordi dell’ospedale", description: "File e periodi di validità associati a questo ospedale. Un accordo non implica di per sé una collaborazione.",
    saveFirstTitle: "Salva prima l’ospedale", saveFirstDescription: "Gli accordi possono essere aggiunti dopo aver salvato l’ospedale.", viewOnly: "Sola visualizzazione",
    loadError: "Impossibile caricare gli accordi dell’ospedale.", retry: "Riprova", emptyTitle: "Nessun accordo ospedaliero",
    emptyDescription: "Aggiungi l’accordo firmato e le relative date di validità per questo ospedale.", active: "Attivo", inactive: "Inattivo",
    inValidity: "Nel periodo di validità", expired: "Scaduto", future: "Valido in futuro", contractNumber: "Numero contratto",
    validFrom: "Valido dal", validTo: "Valido fino al", file: "File dell’accordo", fileRules: "PDF, DOC, DOCX, JPEG o PNG · massimo 20 MB",
    addAgreement: "Aggiungi accordo ospedaliero", agreementTitle: "Titolo dell’accordo", download: "Scarica", edit: "Modifica dettagli",
    cancel: "Annulla modifica", save: "Salva modifiche", endValidity: "Termina validità", reactivate: "Riattiva", uploading: "Caricamento…",
    upload: "Carica accordo", uploadError: "Caricamento non riuscito. I dati inseriti sono stati conservati.", saveError: "Impossibile salvare le modifiche. La bozza è stata conservata.",
    invalidFile: "Scegli un file PDF, DOC, DOCX, JPEG o PNG.", fileTooLarge: "Il file non può superare 20 MB.",
    delete: "Elimina", deleteConfirmTitle: "Eliminare questo accordo ospedaliero?", deleteConfirmDescription: "L’accordo e il relativo file saranno eliminati definitivamente da questo ospedale.",
    deleteCancel: "Mantieni accordo", deleteConfirm: "Elimina accordo", deleteError: "Impossibile eliminare l’accordo dell’ospedale.",
  },
  de: {
    tab: "Vereinbarungen", title: "Krankenhausvereinbarungen", description: "Dateien und Gültigkeitszeiträume dieses Krankenhauses. Eine Vereinbarung bedeutet nicht automatisch eine Zusammenarbeit.",
    saveFirstTitle: "Krankenhaus zuerst speichern", saveFirstDescription: "Vereinbarungen können nach dem Speichern des Krankenhauses hinzugefügt werden.", viewOnly: "Nur Ansicht",
    loadError: "Krankenhausvereinbarungen konnten nicht geladen werden.", retry: "Erneut versuchen", emptyTitle: "Noch keine Krankenhausvereinbarungen",
    emptyDescription: "Fügen Sie die unterzeichnete Vereinbarung und ihre Gültigkeitsdaten für dieses Krankenhaus hinzu.", active: "Aktiv", inactive: "Inaktiv",
    inValidity: "Innerhalb der Gültigkeit", expired: "Abgelaufen", future: "Beginnt künftig", contractNumber: "Vertragsnummer",
    validFrom: "Gültig ab", validTo: "Gültig bis", file: "Vereinbarungsdatei", fileRules: "PDF, DOC, DOCX, JPEG oder PNG · maximal 20 MB",
    addAgreement: "Krankenhausvereinbarung hinzufügen", agreementTitle: "Titel der Vereinbarung", download: "Herunterladen", edit: "Details bearbeiten",
    cancel: "Bearbeitung abbrechen", save: "Änderungen speichern", endValidity: "Gültigkeit beenden", reactivate: "Reaktivieren", uploading: "Wird hochgeladen…",
    upload: "Vereinbarung hochladen", uploadError: "Upload fehlgeschlagen. Ihre Eingaben sind erhalten geblieben.", saveError: "Änderungen konnten nicht gespeichert werden. Ihr Entwurf ist erhalten geblieben.",
    invalidFile: "Wählen Sie eine PDF-, DOC-, DOCX-, JPEG- oder PNG-Datei.", fileTooLarge: "Die Datei darf maximal 20 MB groß sein.",
    delete: "Löschen", deleteConfirmTitle: "Diese Krankenhausvereinbarung löschen?", deleteConfirmDescription: "Die Vereinbarung und ihre Datei werden dauerhaft aus diesem Krankenhaus entfernt.",
    deleteCancel: "Vereinbarung behalten", deleteConfirm: "Vereinbarung löschen", deleteError: "Die Krankenhausvereinbarung konnte nicht gelöscht werden.",
  },
};

