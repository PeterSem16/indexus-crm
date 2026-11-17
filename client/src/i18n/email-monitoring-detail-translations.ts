export interface EmailMonitoringDetailCopy {
  title: string;
  inappropriate: string;
  note: string;
  loadError: string;
  empty: string;
}
export const emailMonitoringDetailTranslations: Record<
  "en" | "sk" | "cs" | "hu" | "ro" | "it" | "de", EmailMonitoringDetailCopy
> = {
  en: { title: "Saved email monitoring result", inappropriate: "Inappropriate content", note: "Analysis note", loadError: "The email detail could not be loaded. Refresh or check mailbox access.", empty: "No monitoring result has been saved for this email. No classification or note is available." },
  sk: { title: "Uložený výsledok monitoringu e-mailu", inappropriate: "Nevhodný obsah", note: "Poznámka k analýze", loadError: "Detail e-mailu sa nepodarilo načítať. Obnovte ho alebo overte prístup ku schránke.", empty: "Pre tento e-mail nie je uložený výsledok monitoringu. Klasifikácia ani poznámka nie sú k dispozícii." },
  cs: { title: "Uložený výsledek monitoringu e-mailu", inappropriate: "Nevhodný obsah", note: "Poznámka k analýze", loadError: "Detail e-mailu se nepodařilo načíst. Obnovte jej nebo ověřte přístup ke schránce.", empty: "Pro tento e-mail není uložen výsledek monitoringu. Klasifikace ani poznámka nejsou k dispozici." },
  hu: { title: "Az e-mail-figyelés mentett eredménye", inappropriate: "Nem megfelelő tartalom", note: "Elemzési megjegyzés", loadError: "Az e-mail részletei nem tölthetők be. Frissítsen, vagy ellenőrizze a postafiók-hozzáférést.", empty: "Ehhez az e-mailhez nincs mentett figyelési eredmény. Nem érhető el besorolás vagy megjegyzés." },
  ro: { title: "Rezultatul salvat al monitorizării e-mailului", inappropriate: "Conținut neadecvat", note: "Notă de analiză", loadError: "Detaliile e-mailului nu au putut fi încărcate. Reîmprospătați sau verificați accesul la căsuța poștală.", empty: "Nu există un rezultat de monitorizare salvat pentru acest e-mail. Clasificarea și nota nu sunt disponibile." },
  it: { title: "Risultato salvato del monitoraggio email", inappropriate: "Contenuto inappropriato", note: "Nota di analisi", loadError: "Impossibile caricare i dettagli dell'email. Aggiorna o verifica l'accesso alla casella di posta.", empty: "Non è stato salvato alcun risultato di monitoraggio per questa email. Classificazione e nota non sono disponibili." },
  de: { title: "Gespeichertes Ergebnis der E-Mail-Überwachung", inappropriate: "Unangemessener Inhalt", note: "Analysenotiz", loadError: "Die E-Mail-Details konnten nicht geladen werden. Aktualisieren Sie oder prüfen Sie den Postfachzugriff.", empty: "Für diese E-Mail wurde kein Überwachungsergebnis gespeichert. Klassifizierung und Notiz sind nicht verfügbar." },
};
