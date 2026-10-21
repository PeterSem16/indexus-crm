export type StatusListAgentPreviewCopy = {
  phaseAcquisition: string;
  phaseContract: string;
  phaseRetention: string;
  options: string;
  batchTitle: string;
  batchMessage: string;
  batchPending: string;
  save: string;
  dismiss: string;
  requiredMissing: string;
  localSelected: string;
  localNothingSelected: string;
  runEmail: string;
  runStatus: string;
  runCallback: string;
  yes: string;
  no: string;
  previewEmpty: string;
  safePreview: string;
  note: string;
  loading: string;
  error: string;
  retry: string;
};

const statusListAgentPreviewTranslations: Record<string, StatusListAgentPreviewCopy> = {
  en: {
    phaseAcquisition: "Acquisition", phaseContract: "Contract", phaseRetention: "Retention",
    options: "Options", batchTitle: "Batch mode", batchMessage: "Save changes this preview only; no backend actions run.",
    batchPending: "automations pending", save: "Save status list", dismiss: "Dismiss",
    requiredMissing: "Required missing:", localSelected: "selected in preview only",
    localNothingSelected: "Clicks only change this local preview.", runEmail: "Send email",
    runStatus: "Set status", runCallback: "Schedule callback", yes: "Áno", no: "Nie",
    previewEmpty: "Status list is not configured", safePreview: "Safe preview: answers are not saved and automations or messages are not triggered.",
    note: "Note for this step...", loading: "Loading Mission settings…",
    error: "Mission settings could not be loaded.", retry: "Retry",
  },
  sk: {
    phaseAcquisition: "Acquisition", phaseContract: "Contract", phaseRetention: "Retention",
    options: "Možnosti", batchTitle: "Dávkový režim", batchMessage: "Uloženie zmení iba tento náhľad; nespustí žiadne akcie.",
    batchPending: "automácií čaká", save: "Uložiť status list", dismiss: "Dismiss",
    requiredMissing: "Povinné nevyplnené:", localSelected: "vybrané iba v náhľade",
    localNothingSelected: "Kliknutia menia iba lokálny náhľad.", runEmail: "Poslať e-mail",
    runStatus: "Nastaviť status", runCallback: "Naplánovať callback", yes: "Áno", no: "Nie",
    previewEmpty: "Status list nie je nakonfigurovaný", safePreview: "Bezpečný náhľad: odpovede sa neukladajú a automatizácie ani správy sa nespúšťajú.",
    note: "Poznámka k tomuto kroku...", loading: "Načítavam nastavenia Mission…",
    error: "Nastavenia Mission sa nepodarilo načítať.", retry: "Skúsiť znova",
  },
  cs: {
    phaseAcquisition: "Acquisition", phaseContract: "Contract", phaseRetention: "Retention",
    options: "Možnosti", batchTitle: "Dávkový režim", batchMessage: "Uložení změní pouze tento náhled; nespustí žádné akce.",
    batchPending: "automatizací čeká", save: "Uložit status list", dismiss: "Dismiss",
    requiredMissing: "Povinné nevyplněné:", localSelected: "vybráno pouze v náhledu",
    localNothingSelected: "Kliknutí mění pouze místní náhled.", runEmail: "Odeslat e-mail",
    runStatus: "Nastavit status", runCallback: "Naplánovat callback", yes: "Áno", no: "Nie",
    previewEmpty: "Status list není nakonfigurován", safePreview: "Bezpečný náhled: odpovědi se neukládají a automatizace ani zprávy se nespouštějí.",
    note: "Poznámka k tomuto kroku...", loading: "Načítám nastavení Mission…",
    error: "Nastavení Mission se nepodařilo načíst.", retry: "Zkusit znovu",
  },
  hu: {
    phaseAcquisition: "Acquisition", phaseContract: "Contract", phaseRetention: "Retention",
    options: "Lehetőségek", batchTitle: "Kötegelt mód", batchMessage: "A mentés csak ezt az előnézetet módosítja; nem indít műveleteket.",
    batchPending: "automatizálás vár", save: "Status lista mentése", dismiss: "Dismiss",
    requiredMissing: "Hátralévő kötelező:", localSelected: "csak az előnézetben kijelölve",
    localNothingSelected: "A kattintások csak ezt az előnézetet módosítják.", runEmail: "E-mail küldése",
    runStatus: "Státusz beállítása", runCallback: "Visszahívás ütemezése", yes: "Áno", no: "Nie",
    previewEmpty: "Az állapotlista nincs konfigurálva", safePreview: "Biztonságos előnézet: a válaszok nem kerülnek mentésre, és automatizálás vagy üzenetküldés nem indul.",
    note: "Megjegyzés ehhez a lépéshez...", loading: "Mission-beállítások betöltése…",
    error: "A Mission-beállításokat nem sikerült betölteni.", retry: "Újrapróbálás",
  },
  ro: {
    phaseAcquisition: "Acquisition", phaseContract: "Contract", phaseRetention: "Retention",
    options: "Opțiuni", batchTitle: "Mod batch", batchMessage: "Salvarea modifică doar această previzualizare; nu rulează acțiuni.",
    batchPending: "automatizări în așteptare", save: "Salvează lista de status", dismiss: "Dismiss",
    requiredMissing: "Obligatoriu lipsă:", localSelected: "selectate doar în previzualizare",
    localNothingSelected: "Clicurile modifică doar această previzualizare locală.", runEmail: "Trimite email",
    runStatus: "Setează status", runCallback: "Programează callback", yes: "Áno", no: "Nie",
    previewEmpty: "Lista de status nu este configurată", safePreview: "Previzualizare sigură: răspunsurile nu se salvează și automatizările sau mesajele nu sunt declanșate.",
    note: "Notă pentru acest pas...", loading: "Se încarcă setările Mission…",
    error: "Setările Mission nu au putut fi încărcate.", retry: "Reîncearcă",
  },
  it: {
    phaseAcquisition: "Acquisition", phaseContract: "Contract", phaseRetention: "Retention",
    options: "Opzioni", batchTitle: "Modalità batch", batchMessage: "Il salvataggio modifica solo questa anteprima; non esegue azioni.",
    batchPending: "automazioni in attesa", save: "Salva lista stato", dismiss: "Dismiss",
    requiredMissing: "Obbligatorio mancante:", localSelected: "selezionati solo nell'anteprima",
    localNothingSelected: "I clic modificano solo questa anteprima locale.", runEmail: "Invia email",
    runStatus: "Imposta stato", runCallback: "Pianifica richiamo", yes: "Áno", no: "Nie",
    previewEmpty: "Lista stato non configurata", safePreview: "Anteprima sicura: le risposte non vengono salvate e automazioni o messaggi non vengono avviati.",
    note: "Nota per questo passaggio...", loading: "Caricamento delle impostazioni Mission…",
    error: "Impossibile caricare le impostazioni Mission.", retry: "Riprova",
  },
  de: {
    phaseAcquisition: "Acquisition", phaseContract: "Contract", phaseRetention: "Retention",
    options: "Optionen", batchTitle: "Batch-Modus", batchMessage: "Speichern ändert nur diese Vorschau; es werden keine Aktionen ausgeführt.",
    batchPending: "Automatisierungen ausstehend", save: "Statusliste speichern", dismiss: "Dismiss",
    requiredMissing: "Pflichtfeld fehlt:", localSelected: "nur in der Vorschau ausgewählt",
    localNothingSelected: "Klicks ändern nur diese lokale Vorschau.", runEmail: "E-Mail senden",
    runStatus: "Status setzen", runCallback: "Rückruf planen", yes: "Áno", no: "Nie",
    previewEmpty: "Statusliste nicht konfiguriert", safePreview: "Sichere Vorschau: Antworten werden nicht gespeichert und Automatisierungen oder Nachrichten nicht ausgelöst.",
    note: "Anmerkung zu diesem Schritt...", loading: "Mission-Einstellungen werden geladen…",
    error: "Mission-Einstellungen konnten nicht geladen werden.", retry: "Erneut versuchen",
  },
};

export default statusListAgentPreviewTranslations;
