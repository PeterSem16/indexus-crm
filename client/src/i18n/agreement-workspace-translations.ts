import type { Locale } from "./translations";

export interface AgreementWorkspaceCopy {
  activeView: string; archive: string; activeCount: string; archiveCount: string; search: string;
  noResults: string; selectRecord: string; history: string; timeline: string; versions: string;
  version: string; latest: string; reason: string; createdBy: string; createdAt: string;
  noReason: string; addVersion: string; newAgreement: string; versionTitle: string;
  versionDescription: string; newDescription: string; reasonRequired: string; reasonPlaceholder: string;
  saveVersion: string; saveNew: string; archiveAction: string; archiveTitle: string; archiveDescription: string;
  archiveReason: string; archiveConfirm: string; cancel: string; fileRemoved: string; fileDelete: string;
  fileDeleteTitle: string; fileDeleteDescription: string; fileDeleteReason: string; fileDeleteConfirm: string;
  irreversible: string; unavailable: string; preview: string; previewTitle: string; previewFailed: string;
  unsupportedPreview: string; downloadFallback: string; zoomIn: string; zoomOut: string; close: string;
  uploadDrop: string; uploadChoose: string; uploadRules: string; selectedFile: string;
  loadingPreview: string; active: string; inactive: string; future: string; expired: string;
  current: string; archived: string; coverageNote: string; loading: string; module: string;
  action: string; actor: string; date: string; details: string; loadMore: string; activityEmpty: string;
  activityError: string; noDetails: string; before: string; after: string; unknownAction: string;
  searchActivity: string; allModules: string; allActions: string; fromDate: string; toDate: string;
  purgePending?: string; purgeRetry?: string; purgeConfirmed?: string; purgeRetryError?: string; previewRetry?: string;
  eventAgreementAdded?: string; eventVersionAdded?: string; eventAgreementUpdated?: string; eventAgreementArchived?: string;
  eventFileDeletionRequested?: string; eventFileDeleted?: string;
  dateRangeError?: string;
  requiredField?: string;
}

export const agreementWorkspaceTranslations: Record<Locale, AgreementWorkspaceCopy> = {
  en: {
    activeView:"Current agreements",archive:"Archive",activeCount:"CURRENT",archiveCount:"ARCHIVE",search:"Search agreements",
    noResults:"No agreements match this view.",selectRecord:"Select an agreement to review its history.",history:"Record activity",
    timeline:"Version history",versions:"versions",version:"Version",latest:"Latest",reason:"Reason / note",createdBy:"Added by",
    createdAt:"Created",noReason:"No reason was recorded.",addVersion:"New version",newAgreement:"Add agreement",
    versionTitle:"New agreement version",versionDescription:"This creates a new version in the existing agreement record.",
    newDescription:"Add a signed agreement and its validity period.",reasonRequired:"A reason is required for every new version.",
    reasonPlaceholder:"Describe what changed and why",saveVersion:"Save version",saveNew:"Add agreement",
    archiveAction:"Archive agreement",archiveTitle:"Archive this agreement chain?",archiveDescription:"Every version in this agreement chain will be archived. Records and files remain available.",
    archiveReason:"Reason for archiving",archiveConfirm:"Archive agreement",cancel:"Cancel",fileRemoved:"File removed",
    fileDelete:"Delete file",fileDeleteTitle:"Permanently delete this file?",fileDeleteDescription:"This cannot be undone. The agreement record and its metadata will remain.",
    fileDeleteReason:"Required reason",fileDeleteConfirm:"Permanently delete file",irreversible:"This action permanently removes the file for this exact version.",
    unavailable:"File unavailable",preview:"Preview",previewTitle:"Document preview",previewFailed:"Preview could not be prepared.",
    unsupportedPreview:"This file cannot be previewed in the application.",downloadFallback:"Download the original file instead.",
    zoomIn:"Zoom in",zoomOut:"Zoom out",close:"Close",uploadDrop:"Drop a file here or",uploadChoose:"choose a file",
    uploadRules:"PDF, DOC, DOCX, JPEG or PNG · maximum 20 MB",selectedFile:"Selected file",loadingPreview:"Preparing preview…",
    active:"Active",inactive:"Inactive",future:"Starts later",expired:"Expired",current:"In validity",archived:"Archived",
    coverageNote:"Activity shows authorized events returned by the server. Filters apply to loaded entries only.",
    loading:"Loading activity…",module:"Module",action:"Action",actor:"Person",date:"Date",details:"Details",
    loadMore:"Load more",activityEmpty:"No activity is available for this record.",activityError:"Activity could not be loaded.",
    noDetails:"No additional details.",before:"Before",after:"After",unknownAction:"Other event",searchActivity:"Search loaded activity",
    allModules:"All modules",allActions:"All actions",fromDate:"From date",toDate:"To date"
  },
  sk: {
    activeView:"Aktuálne zmluvy",archive:"Archív",activeCount:"AKTUÁLNE",archiveCount:"ARCHÍV",search:"Hľadať zmluvy",
    noResults:"Tomuto zobrazeniu nevyhovujú žiadne zmluvy.",selectRecord:"Vyberte zmluvu a zobrazte jej históriu.",history:"Aktivita záznamu",
    timeline:"História verzií",versions:"verzie",version:"Verzia",latest:"Najnovšia",reason:"Dôvod / poznámka",createdBy:"Pridal/a",
    createdAt:"Vytvorené",noReason:"Dôvod nebol zaznamenaný.",addVersion:"Nová verzia",newAgreement:"Pridať zmluvu",
    versionTitle:"Nová verzia zmluvy",versionDescription:"Vytvorí sa nová verzia v existujúcom zázname zmluvy.",
    newDescription:"Pridajte podpísanú zmluvu a obdobie jej platnosti.",reasonRequired:"Pri každej novej verzii je povinný dôvod.",
    reasonPlaceholder:"Opíšte, čo sa zmenilo a prečo",saveVersion:"Uložiť verziu",saveNew:"Pridať zmluvu",
    archiveAction:"Archivovať zmluvu",archiveTitle:"Archivovať tento reťazec zmluvy?",archiveDescription:"Archivujú sa všetky verzie. Záznamy a súbory zostanú dostupné.",
    archiveReason:"Dôvod archivácie",archiveConfirm:"Archivovať zmluvu",cancel:"Zrušiť",fileRemoved:"Súbor odstránený",
    fileDelete:"Odstrániť súbor",fileDeleteTitle:"Natrvalo odstrániť tento súbor?",fileDeleteDescription:"Tento krok nemožno vrátiť späť. Záznam a metadáta zmluvy zostanú.",
    fileDeleteReason:"Povinný dôvod",fileDeleteConfirm:"Natrvalo odstrániť súbor",irreversible:"Táto akcia natrvalo odstráni súbor tejto konkrétnej verzie.",
    unavailable:"Súbor nie je dostupný",preview:"Náhľad",previewTitle:"Náhľad dokumentu",previewFailed:"Náhľad sa nepodarilo pripraviť.",
    unsupportedPreview:"Tento súbor nemožno zobraziť v aplikácii.",downloadFallback:"Stiahnite si namiesto toho pôvodný súbor.",
    zoomIn:"Priblížiť",zoomOut:"Oddialiť",close:"Zavrieť",uploadDrop:"Presuňte sem súbor alebo",uploadChoose:"vyberte súbor",
    uploadRules:"PDF, DOC, DOCX, JPEG alebo PNG · najviac 20 MB",selectedFile:"Vybraný súbor",loadingPreview:"Pripravuje sa náhľad…",
    active:"Aktívna",inactive:"Neaktívna",future:"Začína neskôr",expired:"Expirovaná",current:"V čase platnosti",archived:"Archivovaná",
    coverageNote:"Aktivita zobrazuje oprávnené udalosti vrátené serverom. Filtre platia len pre načítané záznamy.",
    loading:"Načítava sa aktivita…",module:"Modul",action:"Udalosť",actor:"Osoba",date:"Dátum",details:"Podrobnosti",
    loadMore:"Načítať ďalšie",activityEmpty:"Pre tento záznam nie je dostupná aktivita.",activityError:"Aktivitu sa nepodarilo načítať.",
    noDetails:"Žiadne ďalšie podrobnosti.",before:"Predtým",after:"Potom",unknownAction:"Iná udalosť",searchActivity:"Hľadať v načítanej aktivite",
    allModules:"Všetky moduly",allActions:"Všetky udalosti",fromDate:"Od dátumu",toDate:"Do dátumu"
  },
  cs: {
    activeView:"Aktuální smlouvy",archive:"Archiv",activeCount:"AKTUÁLNÍ",archiveCount:"ARCHIV",search:"Hledat smlouvy",
    noResults:"Tomuto zobrazení neodpovídají žádné smlouvy.",selectRecord:"Vyberte smlouvu a zobrazte její historii.",history:"Aktivita záznamu",
    timeline:"Historie verzí",versions:"verze",version:"Verze",latest:"Nejnovější",reason:"Důvod / poznámka",createdBy:"Přidal/a",
    createdAt:"Vytvořeno",noReason:"Důvod nebyl zaznamenán.",addVersion:"Nová verze",newAgreement:"Přidat smlouvu",
    versionTitle:"Nová verze smlouvy",versionDescription:"Vytvoří se nová verze v existujícím záznamu smlouvy.",
    newDescription:"Přidejte podepsanou smlouvu a dobu její platnosti.",reasonRequired:"U každé nové verze je povinný důvod.",
    reasonPlaceholder:"Popište, co se změnilo a proč",saveVersion:"Uložit verzi",saveNew:"Přidat smlouvu",
    archiveAction:"Archivovat smlouvu",archiveTitle:"Archivovat tento řetězec smlouvy?",archiveDescription:"Archivují se všechny verze. Záznamy a soubory zůstanou dostupné.",
    archiveReason:"Důvod archivace",archiveConfirm:"Archivovat smlouvu",cancel:"Zrušit",fileRemoved:"Soubor odstraněn",
    fileDelete:"Odstranit soubor",fileDeleteTitle:"Trvale odstranit tento soubor?",fileDeleteDescription:"Tuto akci nelze vrátit. Záznam a metadata smlouvy zůstanou.",
    fileDeleteReason:"Povinný důvod",fileDeleteConfirm:"Trvale odstranit soubor",irreversible:"Tato akce trvale odstraní soubor této konkrétní verze.",
    unavailable:"Soubor není dostupný",preview:"Náhled",previewTitle:"Náhled dokumentu",previewFailed:"Náhled se nepodařilo připravit.",
    unsupportedPreview:"Tento soubor nelze zobrazit v aplikaci.",downloadFallback:"Místo toho stáhněte původní soubor.",
    zoomIn:"Přiblížit",zoomOut:"Oddálit",close:"Zavřít",uploadDrop:"Přetáhněte sem soubor nebo",uploadChoose:"vyberte soubor",
    uploadRules:"PDF, DOC, DOCX, JPEG nebo PNG · nejvýše 20 MB",selectedFile:"Vybraný soubor",loadingPreview:"Připravuje se náhled…",
    active:"Aktivní",inactive:"Neaktivní",future:"Začíná později",expired:"Prošlá",current:"V době platnosti",archived:"Archivováno",
    coverageNote:"Aktivita zobrazuje oprávněné události vrácené serverem. Filtry platí jen pro načtené záznamy.",
    loading:"Načítá se aktivita…",module:"Modul",action:"Událost",actor:"Osoba",date:"Datum",details:"Podrobnosti",
    loadMore:"Načíst další",activityEmpty:"Pro tento záznam není dostupná aktivita.",activityError:"Aktivitu se nepodařilo načíst.",
    noDetails:"Žádné další podrobnosti.",before:"Předtím",after:"Poté",unknownAction:"Jiná událost",searchActivity:"Hledat v načtené aktivitě",
    allModules:"Všechny moduly",allActions:"Všechny události",fromDate:"Od data",toDate:"Do data"
  },
  hu: {
    activeView:"Aktuális megállapodások",archive:"Archívum",activeCount:"AKTUÁLIS",archiveCount:"ARCHÍVUM",search:"Megállapodások keresése",
    noResults:"Nincs a nézetnek megfelelő megállapodás.",selectRecord:"Válasszon megállapodást az előzmények megtekintéséhez.",history:"Rekordtevékenység",
    timeline:"Verzióelőzmények",versions:"verzió",version:"Verzió",latest:"Legújabb",reason:"Indok / megjegyzés",createdBy:"Hozzáadta",
    createdAt:"Létrehozva",noReason:"Nem rögzítettek indokot.",addVersion:"Új verzió",newAgreement:"Megállapodás hozzáadása",
    versionTitle:"Új megállapodás-verzió",versionDescription:"Új verzió jön létre a meglévő megállapodás rekordjában.",
    newDescription:"Adja hozzá az aláírt megállapodást és érvényességi idejét.",reasonRequired:"Minden új verzióhoz indok szükséges.",
    reasonPlaceholder:"Írja le, mi és miért változott",saveVersion:"Verzió mentése",saveNew:"Megállapodás hozzáadása",
    archiveAction:"Megállapodás archiválása",archiveTitle:"Archiválja ezt a megállapodásláncot?",archiveDescription:"A lánc minden verziója archiválódik. A rekordok és fájlok megmaradnak.",
    archiveReason:"Archiválás indoka",archiveConfirm:"Megállapodás archiválása",cancel:"Mégse",fileRemoved:"Fájl törölve",
    fileDelete:"Fájl törlése",fileDeleteTitle:"Véglegesen törli ezt a fájlt?",fileDeleteDescription:"Ez nem vonható vissza. A megállapodás rekordja és metaadatai megmaradnak.",
    fileDeleteReason:"Kötelező indok",fileDeleteConfirm:"Fájl végleges törlése",irreversible:"Ez a művelet véglegesen eltávolítja az adott verzió fájlját.",
    unavailable:"A fájl nem érhető el",preview:"Előnézet",previewTitle:"Dokumentum előnézete",previewFailed:"Az előnézet nem készíthető el.",
    unsupportedPreview:"Ez a fájl nem tekinthető meg az alkalmazásban.",downloadFallback:"Töltse le inkább az eredeti fájlt.",
    zoomIn:"Nagyítás",zoomOut:"Kicsinyítés",close:"Bezárás",uploadDrop:"Húzza ide a fájlt, vagy",uploadChoose:"válasszon fájlt",
    uploadRules:"PDF, DOC, DOCX, JPEG vagy PNG · legfeljebb 20 MB",selectedFile:"Kiválasztott fájl",loadingPreview:"Előnézet készítése…",
    active:"Aktív",inactive:"Inaktív",future:"Később kezdődik",expired:"Lejárt",current:"Érvényességi időn belül",archived:"Archivált",
    coverageNote:"A tevékenység a szerver által visszaadott engedélyezett eseményeket mutatja. A szűrők csak a betöltött elemekre vonatkoznak.",
    loading:"Tevékenység betöltése…",module:"Modul",action:"Esemény",actor:"Személy",date:"Dátum",details:"Részletek",
    loadMore:"Továbbiak betöltése",activityEmpty:"Ehhez a rekordhoz nincs tevékenység.",activityError:"A tevékenység nem tölthető be.",
    noDetails:"Nincs további részlet.",before:"Előtte",after:"Utána",unknownAction:"Egyéb esemény",searchActivity:"Betöltött tevékenység keresése",
    allModules:"Minden modul",allActions:"Minden esemény",fromDate:"Kezdő dátum",toDate:"Záró dátum"
  },
  ro: {
    activeView:"Acorduri curente",archive:"Arhivă",activeCount:"CURENTE",archiveCount:"ARHIVĂ",search:"Caută acorduri",
    noResults:"Niciun acord nu corespunde acestei vizualizări.",selectRecord:"Selectați un acord pentru a-i vedea istoricul.",history:"Activitatea înregistrării",
    timeline:"Istoricul versiunilor",versions:"versiuni",version:"Versiune",latest:"Cea mai nouă",reason:"Motiv / notă",createdBy:"Adăugat de",
    createdAt:"Creat",noReason:"Nu a fost înregistrat niciun motiv.",addVersion:"Versiune nouă",newAgreement:"Adaugă acord",
    versionTitle:"Versiune nouă a acordului",versionDescription:"Se va crea o versiune nouă în înregistrarea existentă.",
    newDescription:"Adăugați acordul semnat și perioada de valabilitate.",reasonRequired:"Motivul este obligatoriu pentru fiecare versiune nouă.",
    reasonPlaceholder:"Descrieți ce s-a schimbat și de ce",saveVersion:"Salvează versiunea",saveNew:"Adaugă acord",
    archiveAction:"Arhivează acordul",archiveTitle:"Arhivați acest lanț de acorduri?",archiveDescription:"Toate versiunile vor fi arhivate. Înregistrările și fișierele rămân disponibile.",
    archiveReason:"Motivul arhivării",archiveConfirm:"Arhivează acordul",cancel:"Anulează",fileRemoved:"Fișier eliminat",
    fileDelete:"Șterge fișierul",fileDeleteTitle:"Ștergeți definitiv acest fișier?",fileDeleteDescription:"Acțiunea nu poate fi anulată. Înregistrarea și metadatele acordului rămân.",
    fileDeleteReason:"Motiv obligatoriu",fileDeleteConfirm:"Șterge definitiv fișierul",irreversible:"Această acțiune elimină definitiv fișierul acestei versiuni.",
    unavailable:"Fișier indisponibil",preview:"Previzualizare",previewTitle:"Previzualizare document",previewFailed:"Previzualizarea nu a putut fi pregătită.",
    unsupportedPreview:"Acest fișier nu poate fi previzualizat în aplicație.",downloadFallback:"Descărcați fișierul original.",
    zoomIn:"Mărește",zoomOut:"Micșorează",close:"Închide",uploadDrop:"Plasați fișierul aici sau",uploadChoose:"alegeți un fișier",
    uploadRules:"PDF, DOC, DOCX, JPEG sau PNG · maximum 20 MB",selectedFile:"Fișier selectat",loadingPreview:"Se pregătește previzualizarea…",
    active:"Activ",inactive:"Inactiv",future:"Începe mai târziu",expired:"Expirat",current:"În perioada de valabilitate",archived:"Arhivat",
    coverageNote:"Activitatea afișează evenimentele autorizate returnate de server. Filtrele se aplică doar intrărilor încărcate.",
    loading:"Se încarcă activitatea…",module:"Modul",action:"Eveniment",actor:"Persoană",date:"Dată",details:"Detalii",
    loadMore:"Încarcă mai multe",activityEmpty:"Nu există activitate pentru această înregistrare.",activityError:"Activitatea nu a putut fi încărcată.",
    noDetails:"Nu există alte detalii.",before:"Înainte",after:"După",unknownAction:"Alt eveniment",searchActivity:"Caută în activitatea încărcată",
    allModules:"Toate modulele",allActions:"Toate evenimentele",fromDate:"De la data",toDate:"Până la data"
  },
  it: {
    activeView:"Accordi correnti",archive:"Archivio",activeCount:"CORRENTI",archiveCount:"ARCHIVIO",search:"Cerca accordi",
    noResults:"Nessun accordo corrisponde a questa vista.",selectRecord:"Seleziona un accordo per consultarne la cronologia.",history:"Attività del record",
    timeline:"Cronologia versioni",versions:"versioni",version:"Versione",latest:"Più recente",reason:"Motivo / nota",createdBy:"Aggiunto da",
    createdAt:"Creato",noReason:"Non è stato registrato alcun motivo.",addVersion:"Nuova versione",newAgreement:"Aggiungi accordo",
    versionTitle:"Nuova versione dell’accordo",versionDescription:"Verrà creata una nuova versione nel record esistente.",
    newDescription:"Aggiungi l’accordo firmato e il relativo periodo di validità.",reasonRequired:"Per ogni nuova versione è obbligatorio indicare il motivo.",
    reasonPlaceholder:"Descrivi cosa è cambiato e perché",saveVersion:"Salva versione",saveNew:"Aggiungi accordo",
    archiveAction:"Archivia accordo",archiveTitle:"Archiviare questa serie di accordi?",archiveDescription:"Tutte le versioni verranno archiviate. Record e file restano disponibili.",
    archiveReason:"Motivo dell’archiviazione",archiveConfirm:"Archivia accordo",cancel:"Annulla",fileRemoved:"File rimosso",
    fileDelete:"Elimina file",fileDeleteTitle:"Eliminare definitivamente questo file?",fileDeleteDescription:"L’azione non può essere annullata. Il record e i metadati dell’accordo restano.",
    fileDeleteReason:"Motivo obbligatorio",fileDeleteConfirm:"Elimina definitivamente il file",irreversible:"Questa azione rimuove definitivamente il file di questa versione.",
    unavailable:"File non disponibile",preview:"Anteprima",previewTitle:"Anteprima documento",previewFailed:"Impossibile preparare l’anteprima.",
    unsupportedPreview:"Questo file non può essere visualizzato nell’applicazione.",downloadFallback:"Scarica invece il file originale.",
    zoomIn:"Ingrandisci",zoomOut:"Riduci",close:"Chiudi",uploadDrop:"Trascina qui un file oppure",uploadChoose:"scegli un file",
    uploadRules:"PDF, DOC, DOCX, JPEG o PNG · massimo 20 MB",selectedFile:"File selezionato",loadingPreview:"Preparazione anteprima…",
    active:"Attivo",inactive:"Inattivo",future:"Inizia più avanti",expired:"Scaduto",current:"Nel periodo di validità",archived:"Archiviato",
    coverageNote:"L’attività mostra gli eventi autorizzati restituiti dal server. I filtri si applicano solo agli elementi caricati.",
    loading:"Caricamento attività…",module:"Modulo",action:"Evento",actor:"Persona",date:"Data",details:"Dettagli",
    loadMore:"Carica altri",activityEmpty:"Nessuna attività disponibile per questo record.",activityError:"Impossibile caricare l’attività.",
    noDetails:"Nessun altro dettaglio.",before:"Prima",after:"Dopo",unknownAction:"Altro evento",searchActivity:"Cerca nell’attività caricata",
    allModules:"Tutti i moduli",allActions:"Tutti gli eventi",fromDate:"Dalla data",toDate:"Alla data"
  },
  de: {
    activeView:"Aktuelle Vereinbarungen",archive:"Archiv",activeCount:"AKTUELL",archiveCount:"ARCHIV",search:"Vereinbarungen suchen",
    noResults:"Keine Vereinbarung passt zu dieser Ansicht.",selectRecord:"Wählen Sie eine Vereinbarung, um den Verlauf anzusehen.",history:"Datensatzaktivität",
    timeline:"Versionsverlauf",versions:"Versionen",version:"Version",latest:"Neueste",reason:"Grund / Notiz",createdBy:"Hinzugefügt von",
    createdAt:"Erstellt",noReason:"Es wurde kein Grund erfasst.",addVersion:"Neue Version",newAgreement:"Vereinbarung hinzufügen",
    versionTitle:"Neue Vereinbarungsversion",versionDescription:"Eine neue Version wird im bestehenden Vereinbarungsdatensatz angelegt.",
    newDescription:"Fügen Sie die unterzeichnete Vereinbarung und ihre Gültigkeitsdauer hinzu.",reasonRequired:"Für jede neue Version ist ein Grund erforderlich.",
    reasonPlaceholder:"Beschreiben Sie, was und warum geändert wurde",saveVersion:"Version speichern",saveNew:"Vereinbarung hinzufügen",
    archiveAction:"Vereinbarung archivieren",archiveTitle:"Diese Vereinbarungskette archivieren?",archiveDescription:"Alle Versionen dieser Kette werden archiviert. Datensätze und Dateien bleiben verfügbar.",
    archiveReason:"Grund für die Archivierung",archiveConfirm:"Vereinbarung archivieren",cancel:"Abbrechen",fileRemoved:"Datei entfernt",
    fileDelete:"Datei löschen",fileDeleteTitle:"Diese Datei endgültig löschen?",fileDeleteDescription:"Dies kann nicht rückgängig gemacht werden. Vereinbarungsdatensatz und Metadaten bleiben erhalten.",
    fileDeleteReason:"Grund erforderlich",fileDeleteConfirm:"Datei endgültig löschen",irreversible:"Diese Aktion entfernt die Datei dieser konkreten Version endgültig.",
    unavailable:"Datei nicht verfügbar",preview:"Vorschau",previewTitle:"Dokumentvorschau",previewFailed:"Vorschau konnte nicht erstellt werden.",
    unsupportedPreview:"Diese Datei kann in der Anwendung nicht angezeigt werden.",downloadFallback:"Laden Sie stattdessen die Originaldatei herunter.",
    zoomIn:"Vergrößern",zoomOut:"Verkleinern",close:"Schließen",uploadDrop:"Datei hier ablegen oder",uploadChoose:"Datei auswählen",
    uploadRules:"PDF, DOC, DOCX, JPEG oder PNG · maximal 20 MB",selectedFile:"Ausgewählte Datei",loadingPreview:"Vorschau wird erstellt…",
    active:"Aktiv",inactive:"Inaktiv",future:"Beginnt später",expired:"Abgelaufen",current:"Innerhalb der Gültigkeit",archived:"Archiviert",
    coverageNote:"Die Aktivität zeigt autorisierte, vom Server gelieferte Ereignisse. Filter gelten nur für geladene Einträge.",
    loading:"Aktivität wird geladen…",module:"Modul",action:"Ereignis",actor:"Person",date:"Datum",details:"Details",
    loadMore:"Weitere laden",activityEmpty:"Für diesen Datensatz ist keine Aktivität verfügbar.",activityError:"Aktivität konnte nicht geladen werden.",
    noDetails:"Keine weiteren Details.",before:"Vorher",after:"Nachher",unknownAction:"Sonstiges Ereignis",searchActivity:"Geladene Aktivität durchsuchen",
    allModules:"Alle Module",allActions:"Alle Ereignisse",fromDate:"Ab Datum",toDate:"Bis Datum"
  }
};

const lifecycleCopy: Record<Locale, Pick<AgreementWorkspaceCopy, "purgePending" | "purgeRetry" | "purgeConfirmed" | "purgeRetryError" | "previewRetry" | "eventAgreementAdded" | "eventVersionAdded" | "eventAgreementUpdated" | "eventAgreementArchived" | "eventFileDeletionRequested" | "eventFileDeleted" | "dateRangeError">> = {
  en:{purgePending:"File removal requested; physical deletion is not yet confirmed.",purgeRetry:"Retry file deletion",purgeConfirmed:"File permanently deleted",purgeRetryError:"File deletion is still pending. Retry or contact support.",previewRetry:"Retry preview",eventAgreementAdded:"Agreement added",eventVersionAdded:"Agreement version added",eventAgreementUpdated:"Agreement updated",eventAgreementArchived:"Agreement archived",eventFileDeletionRequested:"File deletion requested",eventFileDeleted:"File deleted",dateRangeError:"The valid-from date cannot be after the valid-to date."},
  sk:{purgePending:"Odstránenie súboru bolo vyžiadané, fyzické odstránenie zatiaľ nie je potvrdené.",purgeRetry:"Zopakovať odstránenie súboru",purgeConfirmed:"Súbor bol natrvalo odstránený",purgeRetryError:"Odstránenie súboru stále čaká na dokončenie. Skúste znova alebo kontaktujte podporu.",previewRetry:"Zopakovať náhľad",eventAgreementAdded:"Pridaná zmluva",eventVersionAdded:"Pridaná verzia zmluvy",eventAgreementUpdated:"Zmluva upravená",eventAgreementArchived:"Zmluva archivovaná",eventFileDeletionRequested:"Vyžiadané odstránenie súboru",eventFileDeleted:"Súbor odstránený",dateRangeError:"Dátum „Platná od“ nemôže byť po dátume „Platná do“."},
  cs:{purgePending:"Odstranění souboru bylo vyžádáno, fyzické smazání zatím není potvrzeno.",purgeRetry:"Zkusit odstranění souboru znovu",purgeConfirmed:"Soubor byl trvale odstraněn",purgeRetryError:"Odstranění souboru stále čeká na dokončení. Zkuste to znovu nebo kontaktujte podporu.",previewRetry:"Zkusit náhled znovu",eventAgreementAdded:"Smlouva přidána",eventVersionAdded:"Přidána verze smlouvy",eventAgreementUpdated:"Smlouva upravena",eventAgreementArchived:"Smlouva archivována",eventFileDeletionRequested:"Vyžádáno odstranění souboru",eventFileDeleted:"Soubor odstraněn",dateRangeError:"Datum „Platná od“ nesmí být po datu „Platná do“."},
  hu:{purgePending:"A fájl törlését kérték, a fizikai eltávolítás még nincs megerősítve.",purgeRetry:"Fájltörlés ismétlése",purgeConfirmed:"A fájl véglegesen törölve",purgeRetryError:"A fájl törlése még függőben van. Próbálja újra, vagy forduljon az ügyfélszolgálathoz.",previewRetry:"Előnézet újrapróbálása",eventAgreementAdded:"Megállapodás hozzáadva",eventVersionAdded:"Megállapodás-verzió hozzáadva",eventAgreementUpdated:"Megállapodás módosítva",eventAgreementArchived:"Megállapodás archiválva",eventFileDeletionRequested:"Fájltörlés kérve",eventFileDeleted:"Fájl törölve",dateRangeError:"Az érvényesség kezdete nem lehet későbbi a végénél."},
  ro:{purgePending:"Eliminarea fișierului a fost solicitată; ștergerea fizică nu este încă confirmată.",purgeRetry:"Reîncearcă ștergerea fișierului",purgeConfirmed:"Fișierul a fost șters definitiv",purgeRetryError:"Ștergerea fișierului este încă în așteptare. Reîncercați sau contactați asistența.",previewRetry:"Reîncearcă previzualizarea",eventAgreementAdded:"Acord adăugat",eventVersionAdded:"Versiune de acord adăugată",eventAgreementUpdated:"Acord actualizat",eventAgreementArchived:"Acord arhivat",eventFileDeletionRequested:"Ștergere fișier solicitată",eventFileDeleted:"Fișier șters",dateRangeError:"Data de început nu poate fi după data de încheiere."},
  it:{purgePending:"Eliminazione del file richiesta; la rimozione fisica non è ancora confermata.",purgeRetry:"Riprova eliminazione file",purgeConfirmed:"File eliminato definitivamente",purgeRetryError:"L’eliminazione del file è ancora in sospeso. Riprova o contatta l’assistenza.",previewRetry:"Riprova anteprima",eventAgreementAdded:"Accordo aggiunto",eventVersionAdded:"Versione accordo aggiunta",eventAgreementUpdated:"Accordo aggiornato",eventAgreementArchived:"Accordo archiviato",eventFileDeletionRequested:"Eliminazione file richiesta",eventFileDeleted:"File eliminato",dateRangeError:"La data di inizio non può essere successiva alla data di fine."},
  de:{purgePending:"Dateientfernung angefordert; die physische Löschung ist noch nicht bestätigt.",purgeRetry:"Dateilöschung erneut versuchen",purgeConfirmed:"Datei endgültig gelöscht",purgeRetryError:"Die Dateilöschung steht noch aus. Versuchen Sie es erneut oder wenden Sie sich an den Support.",previewRetry:"Vorschau erneut versuchen",eventAgreementAdded:"Vereinbarung hinzugefügt",eventVersionAdded:"Vereinbarungsversion hinzugefügt",eventAgreementUpdated:"Vereinbarung aktualisiert",eventAgreementArchived:"Vereinbarung archiviert",eventFileDeletionRequested:"Dateilöschung angefordert",eventFileDeleted:"Datei gelöscht",dateRangeError:"Das Gültigkeitsdatum ab darf nicht nach dem Gültigkeitsdatum bis liegen."}
};

const requiredFields: Record<Locale, string> = {
  en: "Complete the required field: {field}.",
  sk: "Vyplňte povinné pole: {field}.",
  cs: "Vyplňte povinné pole: {field}.",
  hu: "Töltse ki a kötelező mezőt: {field}.",
  ro: "Completați câmpul obligatoriu: {field}.",
  it: "Compila il campo obbligatorio: {field}.",
  de: "Füllen Sie das Pflichtfeld aus: {field}.",
};
for (const locale of Object.keys(agreementWorkspaceTranslations) as Locale[]) {
  Object.assign(agreementWorkspaceTranslations[locale], lifecycleCopy[locale], { requiredField: requiredFields[locale] });
}
