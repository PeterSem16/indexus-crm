export interface EmailMonitoringDetailCopy {
  title: string;
  inappropriate: string;
  note: string;
  loadError: string;
}
export const emailMonitoringDetailTranslations: Record<
  "en" | "sk" | "cs" | "hu" | "ro" | "it" | "de", EmailMonitoringDetailCopy
> = {
  en: { title: "Saved email monitoring result", inappropriate: "Inappropriate content", note: "Analysis note", loadError: "The email detail could not be loaded. Refresh or check mailbox access." },
  sk: { title: "Uložený výsledok monitoringu e-mailu", inappropriate: "Nevhodný obsah", note: "Poznámka k analýze", loadError: "Detail e-mailu sa nepodarilo načítať. Obnovte ho alebo overte prístup ku schránke." },
  cs: { title: "Uložený výsledek monitoringu e-mailu", inappropriate: "Nevhodný obsah", note: "Poznámka k analýze", loadError: "Detail e-mailu se nepodařilo načíst. Obnovte jej nebo ověřte přístup ke schránce." },
  hu: { title: "Az e-mail-figyelés mentett eredménye", inappropriate: "Nem megfelelő tartalom", note: "Elemzési megjegyzés", loadError: "Az e-mail részletei nem tölthetők be. Frissítsen, vagy ellenőrizze a postafiók-hozzáférést." },
  ro: { title: "Rezultatul salvat al monitorizării e-mailului", inappropriate: "Conținut neadecvat", note: "Notă de analiză", loadError: "Detaliile e-mailului nu au putut fi încărcate. Reîmprospătați sau verificați accesul la căsuța poștală." },
  it: { title: "Risultato salvato del monitoraggio email", inappropriate: "Contenuto inappropriato", note: "Nota di analisi", loadError: "Impossibile caricare i dettagli dell'email. Aggiorna o verifica l'accesso alla casella di posta." },
  de: { title: "Gespeichertes Ergebnis der E-Mail-Überwachung", inappropriate: "Unangemessener Inhalt", note: "Analysenotiz", loadError: "Die E-Mail-Details konnten nicht geladen werden. Aktualisieren Sie oder prüfen Sie den Postfachzugriff." },
};
