const en = {
  title: "Account groups", description: "Organize accessible mailboxes and search a whole group.",
  showAccountIndividually: "Show account individually",
  showAccountIndividuallyDescription: "Show this account in the bottom navigation as well as in its groups. Hiding it here does not remove it from groups or searches.",
  name: "Group name", create: "Create group", save: "Save groups", cancel: "Cancel",
  remove: "Delete group", deleteQuestion: "Delete this group? Connected accounts will not be deleted.",
  confirm: "Delete", empty: "No groups yet.", access: "Groups do not grant access to mailboxes. An account can belong to multiple groups.",
  saved: "Groups saved", saveError: "Groups could not be saved. Try again.",
  loadError: "Groups could not be loaded.", conflict: "Groups changed in another window. Reload before editing.",
  retry: "Reload", scope: "Search scope", all: "All accessible accounts", ungrouped: "Other accounts",
  missing: "This group is empty or unavailable.", aiError: "AI search failed. Try again or switch to regular search.",
  searchError: "Some mailboxes could not be searched. Please retry.", maxGroups: "You can create up to 30 groups.",
};
type Copy = { [K in keyof typeof en]: string };
type CoreCopy = Omit<Copy, "showAccountIndividually" | "showAccountIndividuallyDescription">;
const translations: Record<"en" | "sk" | "cs" | "hu" | "ro" | "it" | "de", CoreCopy> = {
  en,
  sk: { title:"Skupiny kont",description:"Usporiadajte dostupné schránky a prehľadávajte celú skupinu.",name:"Názov skupiny",create:"Vytvoriť skupinu",save:"Uložiť skupiny",cancel:"Zrušiť",remove:"Odstrániť skupinu",deleteQuestion:"Odstrániť túto skupinu? Pripojené kontá sa neodstránia.",confirm:"Odstrániť",empty:"Zatiaľ nemáte žiadne skupiny.",access:"Skupiny neudeľujú prístup ku schránkam. Konto môže patriť do viacerých skupín.",saved:"Skupiny boli uložené",saveError:"Skupiny sa nepodarilo uložiť. Skúste to znova.",loadError:"Skupiny sa nepodarilo načítať.",conflict:"Skupiny boli zmenené v inom okne. Pred úpravou ich znova načítajte.",retry:"Znova načítať",scope:"Rozsah vyhľadávania",all:"Všetky dostupné kontá",ungrouped:"Ostatné kontá",missing:"Táto skupina je prázdna alebo nedostupná.",aiError:"AI vyhľadávanie zlyhalo. Skúste to znova alebo prepnite na bežné vyhľadávanie.",searchError:"Niektoré schránky sa nepodarilo prehľadať. Skúste to znova.",maxGroups:"Môžete vytvoriť najviac 30 skupín." },
  cs: { title:"Skupiny účtů",description:"Uspořádejte dostupné schránky a prohledávejte celou skupinu.",name:"Název skupiny",create:"Vytvořit skupinu",save:"Uložit skupiny",cancel:"Zrušit",remove:"Odstranit skupinu",deleteQuestion:"Odstranit tuto skupinu? Připojené účty nebudou odstraněny.",confirm:"Odstranit",empty:"Zatím nemáte žádné skupiny.",access:"Skupiny neudělují přístup ke schránkám. Účet může patřit do více skupin.",saved:"Skupiny byly uloženy",saveError:"Skupiny se nepodařilo uložit. Zkuste to znovu.",loadError:"Skupiny se nepodařilo načíst.",conflict:"Skupiny byly změněny v jiném okně. Před úpravou je znovu načtěte.",retry:"Znovu načíst",scope:"Rozsah vyhledávání",all:"Všechny dostupné účty",ungrouped:"Ostatní účty",missing:"Tato skupina je prázdná nebo nedostupná.",aiError:"AI vyhledávání selhalo. Zkuste to znovu nebo přepněte na běžné vyhledávání.",searchError:"Některé schránky se nepodařilo prohledat. Zkuste to znovu.",maxGroups:"Můžete vytvořit nejvýše 30 skupin." },
  hu: { title:"Fiókcsoportok",description:"Rendezze a hozzáférhető postaládákat, és keressen az egész csoportban.",name:"Csoport neve",create:"Csoport létrehozása",save:"Csoportok mentése",cancel:"Mégse",remove:"Csoport törlése",deleteQuestion:"Törli ezt a csoportot? A kapcsolt fiókok nem törlődnek.",confirm:"Törlés",empty:"Még nincsenek csoportok.",access:"A csoportok nem adnak hozzáférést a postaládákhoz. Egy fiók több csoporthoz is tartozhat.",saved:"Csoportok mentve",saveError:"A csoportok mentése sikertelen. Próbálja újra.",loadError:"A csoportok betöltése sikertelen.",conflict:"A csoportok egy másik ablakban megváltoztak. Szerkesztés előtt töltse újra.",retry:"Újratöltés",scope:"Keresési hatókör",all:"Minden hozzáférhető fiók",ungrouped:"Egyéb fiókok",missing:"Ez a csoport üres vagy nem érhető el.",aiError:"Az AI-keresés sikertelen. Próbálja újra, vagy váltson normál keresésre.",searchError:"Néhány postaláda keresése sikertelen. Próbálja újra.",maxGroups:"Legfeljebb 30 csoport hozható létre." },
  ro: { title:"Grupuri de conturi",description:"Organizați cutiile poștale accesibile și căutați în întregul grup.",name:"Numele grupului",create:"Creați grup",save:"Salvați grupurile",cancel:"Anulați",remove:"Ștergeți grupul",deleteQuestion:"Ștergeți acest grup? Conturile conectate nu vor fi șterse.",confirm:"Ștergeți",empty:"Nu aveți încă grupuri.",access:"Grupurile nu acordă acces la cutii poștale. Un cont poate aparține mai multor grupuri.",saved:"Grupurile au fost salvate",saveError:"Grupurile nu au putut fi salvate. Încercați din nou.",loadError:"Grupurile nu au putut fi încărcate.",conflict:"Grupurile au fost modificate în altă fereastră. Reîncărcați înainte de editare.",retry:"Reîncărcați",scope:"Domeniul căutării",all:"Toate conturile accesibile",ungrouped:"Alte conturi",missing:"Acest grup este gol sau indisponibil.",aiError:"Căutarea AI a eșuat. Încercați din nou sau alegeți căutarea obișnuită.",searchError:"Unele cutii poștale nu au putut fi căutate. Încercați din nou.",maxGroups:"Puteți crea cel mult 30 de grupuri." },
  it: { title:"Gruppi di account",description:"Organizza le caselle accessibili e cerca in tutto il gruppo.",name:"Nome del gruppo",create:"Crea gruppo",save:"Salva gruppi",cancel:"Annulla",remove:"Elimina gruppo",deleteQuestion:"Eliminare questo gruppo? Gli account collegati non verranno eliminati.",confirm:"Elimina",empty:"Non ci sono ancora gruppi.",access:"I gruppi non concedono accesso alle caselle. Un account può appartenere a più gruppi.",saved:"Gruppi salvati",saveError:"Impossibile salvare i gruppi. Riprova.",loadError:"Impossibile caricare i gruppi.",conflict:"I gruppi sono stati modificati in un'altra finestra. Ricarica prima di modificarli.",retry:"Ricarica",scope:"Ambito di ricerca",all:"Tutti gli account accessibili",ungrouped:"Altri account",missing:"Questo gruppo è vuoto o non disponibile.",aiError:"Ricerca AI non riuscita. Riprova o passa alla ricerca normale.",searchError:"Impossibile cercare in alcune caselle. Riprova.",maxGroups:"Puoi creare al massimo 30 gruppi." },
  de: { title:"Kontogruppen",description:"Ordnen Sie zugängliche Postfächer und durchsuchen Sie eine ganze Gruppe.",name:"Gruppenname",create:"Gruppe erstellen",save:"Gruppen speichern",cancel:"Abbrechen",remove:"Gruppe löschen",deleteQuestion:"Diese Gruppe löschen? Verbundene Konten werden nicht gelöscht.",confirm:"Löschen",empty:"Noch keine Gruppen vorhanden.",access:"Gruppen gewähren keinen Zugriff auf Postfächer. Ein Konto kann mehreren Gruppen angehören.",saved:"Gruppen gespeichert",saveError:"Gruppen konnten nicht gespeichert werden. Versuchen Sie es erneut.",loadError:"Gruppen konnten nicht geladen werden.",conflict:"Die Gruppen wurden in einem anderen Fenster geändert. Laden Sie sie vor der Bearbeitung neu.",retry:"Neu laden",scope:"Suchbereich",all:"Alle zugänglichen Konten",ungrouped:"Weitere Konten",missing:"Diese Gruppe ist leer oder nicht verfügbar.",aiError:"KI-Suche fehlgeschlagen. Versuchen Sie es erneut oder wechseln Sie zur normalen Suche.",searchError:"Einige Postfächer konnten nicht durchsucht werden. Versuchen Sie es erneut.",maxGroups:"Sie können höchstens 30 Gruppen erstellen." },
};
const visibilityCopy = {
  en: { showAccountIndividually: en.showAccountIndividually, showAccountIndividuallyDescription: en.showAccountIndividuallyDescription },
  sk: { showAccountIndividually:"Zobrazovať konto samostatne",showAccountIndividuallyDescription:"Zobrazí konto aj v spodnej navigácii popri jeho skupinách. Skrytie ho neodstráni zo skupín ani z vyhľadávania." },
  cs: { showAccountIndividually:"Zobrazovat účet samostatně",showAccountIndividuallyDescription:"Zobrazí účet také ve spodní navigaci vedle jeho skupin. Skrytí jej neodebere ze skupin ani z vyhledávání." },
  hu: { showAccountIndividually:"Fiók külön megjelenítése",showAccountIndividuallyDescription:"A fiók az alsó navigációban és a csoportjaiban is megjelenik. Elrejtése nem távolítja el a csoportokból vagy a keresésből." },
  ro: { showAccountIndividually:"Afișează contul individual",showAccountIndividuallyDescription:"Afișează contul și în navigarea de jos, pe lângă grupurile sale. Ascunderea nu îl elimină din grupuri sau din căutare." },
  it: { showAccountIndividually:"Mostra account singolarmente",showAccountIndividuallyDescription:"Mostra l’account anche nella navigazione in basso, oltre che nei gruppi. Nasconderlo non lo rimuove dai gruppi o dalla ricerca." },
  de: { showAccountIndividually:"Konto einzeln anzeigen",showAccountIndividuallyDescription:"Zeigt dieses Konto zusätzlich zu seinen Gruppen in der unteren Navigation an. Das Ausblenden entfernt es weder aus Gruppen noch aus der Suche." },
};
const extraEn = {
  groupIcon: "Group icon", groupColor: "Group color",
  exportZip: "Download ZIP", exportAll: "Download all search results as ZIP with original emails and attachments",
  exporting: "Preparing ZIP…", exportError: "Export failed. No incomplete archive was downloaded. Please try again.",
  exportLimit: "The export exceeds the size limit. Narrow the search and try again.",
  exportFormat: "ZIP format", exportEml: "EML", exportMsg: "MSG",
  sendZip: "Send results by email", sendZipDescription: "A ZIP of the current full result set will be sent.",
  recipient: "Recipient", subject: "Subject", body: "Message", sender: "Connected personal account",
  confirmSend: "Confirm and send", sending: "Sending…", sendSuccess: "Search ZIP sent",
  invalidDelivery: "Enter a valid recipient and message details.", exportBusy: "An export is already being prepared. Try again shortly.",
  dateFrom: "From date", dateTo: "To date", applyDates: "Search these dates", reversedDates: "The start date must not be after the end date.",
  sendError: "Sending could not be confirmed. Check Sent before retrying.", emailExportLimit: "The ZIP attached to an email must be 25 MB or smaller.",
  resultsCount: "messages", fromDate: "From", throughDate: "Through",
  noPersonalAccount: "Connect a personal mailbox to send these results by email.",
  sendByEmail: "Send by email",
};
type Extra = { [K in keyof typeof extraEn]: string };
const extra: Record<keyof typeof translations, Extra> = {
  en: extraEn,
  sk: { groupIcon:"Ikona skupiny",groupColor:"Farba skupiny",exportZip:"Stiahnuť ZIP",exportAll:"Stiahnuť všetky výsledky vyhľadávania ako ZIP s pôvodnými e-mailami a prílohami",exporting:"Pripravujem ZIP…",exportError:"Export zlyhal. Neúplný archív sa nestiahol. Skúste to znova.",exportLimit:"Export prekračuje limit veľkosti. Zúžte vyhľadávanie a skúste to znova.",exportFormat:"Formát ZIP",exportEml:"EML",exportMsg:"MSG",sendZip:"Poslať výsledky e-mailom",sendZipDescription:"Odošle sa ZIP aktuálnej úplnej množiny výsledkov.",recipient:"Príjemca",subject:"Predmet",body:"Správa",sender:"Pripojené osobné konto",confirmSend:"Potvrdiť a odoslať",sending:"Odosielam…",sendSuccess:"ZIP vyhľadávania bol odoslaný",invalidDelivery:"Zadajte platného príjemcu a podrobnosti správy.",exportBusy:"Export sa už pripravuje. Skúste to o chvíľu znova.",dateFrom:"Dátum od",dateTo:"Dátum do",applyDates:"Hľadať v týchto dátumoch",reversedDates:"Dátum začiatku nemôže byť po dátume konca.",sendError:"Odoslanie sa nepodarilo potvrdiť. Pred opakovaním skontrolujte priečinok Odoslané.",emailExportLimit:"ZIP priložený k e-mailu môže mať najviac 25 MB.",resultsCount:"správ",fromDate:"Od",throughDate:"Do",noPersonalAccount:"Ak chcete poslať výsledky e-mailom, pripojte osobnú schránku.",sendByEmail:"Poslať e-mailom" },
  cs: { groupIcon:"Ikona skupiny",groupColor:"Barva skupiny",exportZip:"Stáhnout ZIP",exportAll:"Stáhnout všechny výsledky hledání jako ZIP s původními e-maily a přílohami",exporting:"Připravuji ZIP…",exportError:"Export selhal. Neúplný archiv nebyl stažen. Zkuste to znovu.",exportLimit:"Export překračuje limit velikosti. Zužte hledání a zkuste to znovu.",exportFormat:"Formát ZIP",exportEml:"EML",exportMsg:"MSG",sendZip:"Poslat výsledky e-mailem",sendZipDescription:"Odešle se ZIP aktuální úplné sady výsledků.",recipient:"Příjemce",subject:"Předmět",body:"Zpráva",sender:"Připojený osobní účet",confirmSend:"Potvrdit a odeslat",sending:"Odesílám…",sendSuccess:"ZIP s výsledky hledání byl odeslán",invalidDelivery:"Zadejte platného příjemce a údaje zprávy.",exportBusy:"Export se již připravuje. Zkuste to za chvíli znovu.",dateFrom:"Datum od",dateTo:"Datum do",applyDates:"Hledat v těchto datech",reversedDates:"Počáteční datum nesmí být po koncovém datu.",sendError:"Odeslání se nepodařilo potvrdit. Před opakováním zkontrolujte složku Odeslané.",emailExportLimit:"ZIP přiložený k e-mailu může mít nejvýše 25 MB.",resultsCount:"zpráv",fromDate:"Od",throughDate:"Do",noPersonalAccount:"Chcete-li poslat výsledky e-mailem, připojte osobní schránku.",sendByEmail:"Poslat e-mailem" },
  hu: { groupIcon:"Csoport ikonja",groupColor:"Csoport színe",exportZip:"ZIP letöltése",exportAll:"Az összes találat letöltése ZIP-ként eredeti e-mailekkel és mellékletekkel",exporting:"ZIP előkészítése…",exportError:"Az export sikertelen. Nem töltődött le hiányos archívum. Próbálja újra.",exportLimit:"Az export meghaladja a méretkorlátot. Szűkítse a keresést, és próbálja újra.",exportFormat:"ZIP-formátum",exportEml:"EML",exportMsg:"MSG",sendZip:"Találatok küldése e-mailben",sendZipDescription:"Az aktuális teljes találati lista ZIP-fájlja kerül elküldésre.",recipient:"Címzett",subject:"Tárgy",body:"Üzenet",sender:"Csatlakoztatott személyes fiók",confirmSend:"Megerősítés és küldés",sending:"Küldés…",sendSuccess:"A keresési ZIP elküldve",invalidDelivery:"Adjon meg érvényes címzettet és üzenetadatokat.",exportBusy:"Az export előkészítése folyamatban van. Próbálja újra később.",dateFrom:"Kezdő dátum",dateTo:"Záró dátum",applyDates:"Keresés ezeken a dátumokon",reversedDates:"A kezdő dátum nem lehet a záró dátum után.",sendError:"A küldés nem erősíthető meg. Újrapróbálás előtt ellenőrizze az Elküldött elemeket.",emailExportLimit:"Az e-mailhez csatolt ZIP legfeljebb 25 MB lehet.",resultsCount:"üzenet",fromDate:"Ettől",throughDate:"Eddig",noPersonalAccount:"E-mailes küldéshez csatlakoztasson személyes postafiókot.",sendByEmail:"Küldés e-mailben" },
  ro: { groupIcon:"Pictograma grupului",groupColor:"Culoarea grupului",exportZip:"Descarcă ZIP",exportAll:"Descărcați toate rezultatele ca ZIP cu e-mailurile originale și atașamentele",exporting:"Se pregătește ZIP…",exportError:"Exportul a eșuat. Nu s-a descărcat o arhivă incompletă. Încercați din nou.",exportLimit:"Exportul depășește limita de dimensiune. Restrângeți căutarea și încercați din nou.",exportFormat:"Format ZIP",exportEml:"EML",exportMsg:"MSG",sendZip:"Trimite rezultatele prin e-mail",sendZipDescription:"Se va trimite un ZIP cu setul complet de rezultate curent.",recipient:"Destinatar",subject:"Subiect",body:"Mesaj",sender:"Cont personal conectat",confirmSend:"Confirmă și trimite",sending:"Se trimite…",sendSuccess:"ZIP-ul căutării a fost trimis",invalidDelivery:"Introduceți un destinatar valid și detaliile mesajului.",exportBusy:"Un export este deja în curs. Încercați din nou în scurt timp.",dateFrom:"Data de la",dateTo:"Data până la",applyDates:"Caută în aceste date",reversedDates:"Data de început nu poate fi după data de sfârșit.",sendError:"Trimiterea nu a putut fi confirmată. Verificați folderul Trimise înainte de a reîncerca.",emailExportLimit:"ZIP-ul atașat e-mailului poate avea cel mult 25 MB.",resultsCount:"mesaje",fromDate:"De la",throughDate:"Până la",noPersonalAccount:"Conectați o căsuță personală pentru a trimite rezultatele prin e-mail.",sendByEmail:"Trimite prin e-mail" },
  it: { groupIcon:"Icona del gruppo",groupColor:"Colore del gruppo",exportZip:"Scarica ZIP",exportAll:"Scarica tutti i risultati come ZIP con email originali e allegati",exporting:"Preparazione ZIP…",exportError:"Esportazione non riuscita. Non è stato scaricato un archivio incompleto. Riprova.",exportLimit:"L’esportazione supera il limite di dimensione. Restringi la ricerca e riprova.",exportFormat:"Formato ZIP",exportEml:"EML",exportMsg:"MSG",sendZip:"Invia risultati via e-mail",sendZipDescription:"Verrà inviato uno ZIP dell’intero set di risultati corrente.",recipient:"Destinatario",subject:"Oggetto",body:"Messaggio",sender:"Account personale connesso",confirmSend:"Conferma e invia",sending:"Invio…",sendSuccess:"ZIP della ricerca inviato",invalidDelivery:"Inserisci un destinatario valido e i dettagli del messaggio.",exportBusy:"Un’esportazione è già in corso. Riprova tra poco.",dateFrom:"Data da",dateTo:"Data a",applyDates:"Cerca in queste date",reversedDates:"La data iniziale non può essere successiva a quella finale.",sendError:"L’invio non può essere confermato. Controlla la cartella Posta inviata prima di riprovare.",emailExportLimit:"Lo ZIP allegato all’e-mail può avere una dimensione massima di 25 MB.",resultsCount:"messaggi",fromDate:"Dal",throughDate:"Fino al",noPersonalAccount:"Collega una casella personale per inviare questi risultati via e-mail.",sendByEmail:"Invia via e-mail" },
  de: { groupIcon:"Gruppensymbol",groupColor:"Gruppenfarbe",exportZip:"ZIP herunterladen",exportAll:"Alle Suchergebnisse als ZIP mit ursprünglichen E-Mails und Anhängen herunterladen",exporting:"ZIP wird vorbereitet…",exportError:"Export fehlgeschlagen. Es wurde kein unvollständiges Archiv heruntergeladen. Versuchen Sie es erneut.",exportLimit:"Der Export überschreitet die Größenbegrenzung. Grenzen Sie die Suche ein und versuchen Sie es erneut.",exportFormat:"ZIP-Format",exportEml:"EML",exportMsg:"MSG",sendZip:"Ergebnisse per E-Mail senden",sendZipDescription:"Ein ZIP der vollständigen aktuellen Ergebnismenge wird gesendet.",recipient:"Empfänger",subject:"Betreff",body:"Nachricht",sender:"Verbundenes persönliches Konto",confirmSend:"Bestätigen und senden",sending:"Wird gesendet…",sendSuccess:"Such-ZIP gesendet",invalidDelivery:"Geben Sie einen gültigen Empfänger und Nachrichtendetails ein.",exportBusy:"Ein Export wird bereits vorbereitet. Versuchen Sie es gleich erneut.",dateFrom:"Datum von",dateTo:"Datum bis",applyDates:"In diesen Zeiträumen suchen",reversedDates:"Das Startdatum darf nicht nach dem Enddatum liegen.",sendError:"Der Versand konnte nicht bestätigt werden. Prüfen Sie vor einem erneuten Versuch den Ordner „Gesendete Elemente“.",emailExportLimit:"Das per E-Mail angehängte ZIP darf höchstens 25 MB groß sein.",resultsCount:"Nachrichten",fromDate:"Ab",throughDate:"Bis",noPersonalAccount:"Verbinden Sie ein persönliches Postfach, um diese Ergebnisse per E-Mail zu senden.",sendByEmail:"Per E-Mail senden" },
};
const replyTemplateCopy: Record<keyof typeof translations, {
  replySubjectDefault: string;
  replyBodyDefault: string;
  replyTemplateTitle: string;
  replyTemplateDescription: string;
  includeSignature: string;
  groupContext: string;
  missingSignature: string;
}> = {
  en: {
    replySubjectDefault: "Search results — {group}",
    replyBodyDefault: "The original messages I searched are attached in a ZIP file.",
    replyTemplateTitle: "ZIP email template",
    replyTemplateDescription: "Used for results searched in this group. The signature is taken from the connected personal account.",
    includeSignature: "Include the existing personal-account signature",
    groupContext: "Results searched in",
    missingSignature: "The connected personal account has no active signature to include.",
  },
  sk: {
    replySubjectDefault: "Výsledky vyhľadávania — {group}",
    replyBodyDefault: "Pôvodné vyhľadané správy sú priložené v súbore ZIP.",
    replyTemplateTitle: "Šablóna e-mailu ZIP",
    replyTemplateDescription: "Použije sa pri odosielaní výsledkov vyhľadaných v tejto skupine. Podpis sa prevezme z pripojeného osobného konta.",
    includeSignature: "Pripojiť existujúci podpis osobného konta",
    groupContext: "Výsledky vyhľadané v skupine",
    missingSignature: "Pripojené osobné konto nemá aktívny podpis, ktorý možno pripojiť.",
  },
  cs: {
    replySubjectDefault: "Výsledky hledání — {group}",
    replyBodyDefault: "Původní vyhledané zprávy jsou přiloženy v souboru ZIP.",
    replyTemplateTitle: "Šablona e-mailu ZIP",
    replyTemplateDescription: "Použije se při odesílání výsledků vyhledaných v této skupině. Podpis se převezme z připojeného osobního účtu.",
    includeSignature: "Připojit existující podpis osobního účtu",
    groupContext: "Výsledky vyhledané ve skupině",
    missingSignature: "Připojený osobní účet nemá aktivní podpis, který lze připojit.",
  },
  hu: {
    replySubjectDefault: "Keresési találatok — {group}",
    replyBodyDefault: "A keresett eredeti üzenetek ZIP-fájlban vannak csatolva.",
    replyTemplateTitle: "ZIP e-mail sablon",
    replyTemplateDescription: "A csoportban keresett találatok e-mailes küldésekor használatos. Az aláírás a csatlakoztatott személyes fiókból származik.",
    includeSignature: "Meglévő személyes fiók aláírásának hozzáadása",
    groupContext: "Találatok keresési csoportja",
    missingSignature: "A csatlakoztatott személyes fiókban nincs aktív, hozzáadható aláírás.",
  },
  ro: {
    replySubjectDefault: "Rezultatele căutării — {group}",
    replyBodyDefault: "Mesajele originale căutate sunt atașate într-un fișier ZIP.",
    replyTemplateTitle: "Șablon e-mail ZIP",
    replyTemplateDescription: "Folosit la trimiterea rezultatelor căutate în acest grup. Semnătura este preluată din contul personal conectat.",
    includeSignature: "Include semnătura existentă a contului personal",
    groupContext: "Rezultate căutate în",
    missingSignature: "Contul personal conectat nu are o semnătură activă care să poată fi inclusă.",
  },
  it: {
    replySubjectDefault: "Risultati della ricerca — {group}",
    replyBodyDefault: "I messaggi originali cercati sono allegati in un file ZIP.",
    replyTemplateTitle: "Modello e-mail ZIP",
    replyTemplateDescription: "Usato per inviare i risultati cercati in questo gruppo. La firma viene presa dall’account personale connesso.",
    includeSignature: "Includi la firma esistente dell’account personale",
    groupContext: "Risultati cercati in",
    missingSignature: "L’account personale connesso non ha una firma attiva da includere.",
  },
  de: {
    replySubjectDefault: "Suchergebnisse — {group}",
    replyBodyDefault: "Die gesuchten Originalnachrichten sind als ZIP-Datei angehängt.",
    replyTemplateTitle: "E-Mail-Vorlage für ZIP",
    replyTemplateDescription: "Wird für Ergebnisse aus dieser Gruppe verwendet. Die Signatur stammt aus dem verbundenen persönlichen Konto.",
    includeSignature: "Vorhandene Signatur des persönlichen Kontos einfügen",
    groupContext: "Ergebnisse gesucht in",
    missingSignature: "Das verbundene persönliche Konto hat keine aktive Signatur zum Einfügen.",
  },
};
const criteriaCopy = {
  en: {
    criteriaTitle: "Search criteria", criteriaQuery: "Search expression", criteriaNoQuery: "No text restriction",
    criteriaPeriod: "Period", criteriaAnyDate: "No date restriction", criteriaAccounts: "Email accounts searched",
    criteriaGroup: "Account group",
    criteriaBodyTooLong: "The message including search criteria exceeds 20,000 characters. Shorten it before sending.",
  },
  sk: {
    criteriaTitle: "Kritériá vyhľadávania", criteriaQuery: "Hľadaný výraz", criteriaNoQuery: "Bez textového obmedzenia",
    criteriaPeriod: "Obdobie", criteriaAnyDate: "Bez dátumového obmedzenia", criteriaAccounts: "Prehľadávané e-mailové kontá",
    criteriaGroup: "Skupina kont",
    criteriaBodyTooLong: "Správa vrátane kritérií vyhľadávania presahuje 20 000 znakov. Pred odoslaním ju skráťte.",
  },
  cs: {
    criteriaTitle: "Kritéria vyhledávání", criteriaQuery: "Hledaný výraz", criteriaNoQuery: "Bez textového omezení",
    criteriaPeriod: "Období", criteriaAnyDate: "Bez omezení data", criteriaAccounts: "Prohledávané e-mailové účty",
    criteriaGroup: "Skupina účtů",
    criteriaBodyTooLong: "Zpráva včetně kritérií vyhledávání přesahuje 20 000 znaků. Před odesláním ji zkraťte.",
  },
  hu: {
    criteriaTitle: "Keresési feltételek", criteriaQuery: "Keresőkifejezés", criteriaNoQuery: "Nincs szöveges korlátozás",
    criteriaPeriod: "Időszak", criteriaAnyDate: "Nincs dátumkorlátozás", criteriaAccounts: "Átkeresett e-mail-fiókok",
    criteriaGroup: "Fiókcsoport",
    criteriaBodyTooLong: "Az üzenet a keresési feltételekkel együtt meghaladja a 20 000 karaktert. Küldés előtt rövidítse le.",
  },
  ro: {
    criteriaTitle: "Criterii de căutare", criteriaQuery: "Expresie căutată", criteriaNoQuery: "Fără restricție de text",
    criteriaPeriod: "Perioadă", criteriaAnyDate: "Fără restricție de dată", criteriaAccounts: "Conturi de e-mail căutate",
    criteriaGroup: "Grup de conturi",
    criteriaBodyTooLong: "Mesajul cu criteriile de căutare depășește 20.000 de caractere. Scurtați-l înainte de trimitere.",
  },
  it: {
    criteriaTitle: "Criteri di ricerca", criteriaQuery: "Espressione cercata", criteriaNoQuery: "Nessuna restrizione di testo",
    criteriaPeriod: "Periodo", criteriaAnyDate: "Nessuna restrizione di data", criteriaAccounts: "Account e-mail esaminati",
    criteriaGroup: "Gruppo di account",
    criteriaBodyTooLong: "Il messaggio con i criteri di ricerca supera i 20.000 caratteri. Abbreviarlo prima dell’invio.",
  },
  de: {
    criteriaTitle: "Suchkriterien", criteriaQuery: "Suchausdruck", criteriaNoQuery: "Keine Texteinschränkung",
    criteriaPeriod: "Zeitraum", criteriaAnyDate: "Keine Datumseinschränkung", criteriaAccounts: "Durchsuchte E-Mail-Konten",
    criteriaGroup: "Kontogruppe",
    criteriaBodyTooLong: "Die Nachricht mit Suchkriterien überschreitet 20.000 Zeichen. Kürzen Sie sie vor dem Senden.",
  },
};
const deliveryCopy = {
  en: {
    defaultSearchSubject: "Search results",
    exportSourceError: "The original messages or attachments could not be loaded. No email was sent.",
    exportUnsupportedAttachment: "A message contains an attachment that cannot be exported as MSG. Try EML instead. No email was sent.",
    exportMailboxError: "The Microsoft 365 connection has expired or is unavailable. Reconnect your personal account.",
    exportPermissionError: "Microsoft 365 denied the required sending or draft permissions. Check the account's permissions.",
    sendPreparationError: "The ZIP could not be prepared for sending. No email was sent.",
    sendRejectedError: "Microsoft 365 rejected sending. Check the recipient and account permissions.",
    exportForbidden: "You do not have access to all selected email accounts. Check your access and repeat the search.",
  },
  sk: {
    defaultSearchSubject: "Výsledky vyhľadávania",
    exportSourceError: "Nepodarilo sa načítať pôvodné správy alebo prílohy. E-mail nebol odoslaný.",
    exportUnsupportedAttachment: "Správa obsahuje prílohu, ktorú nemožno exportovať do MSG. Skúste formát EML. E-mail nebol odoslaný.",
    exportMailboxError: "Pripojenie Microsoft 365 vypršalo alebo nie je dostupné. Znovu pripojte osobné konto.",
    exportPermissionError: "Microsoft 365 odmietol potrebné oprávnenia na odosielanie alebo koncepty. Skontrolujte oprávnenia konta.",
    sendPreparationError: "ZIP sa nepodarilo pripraviť na odoslanie. E-mail nebol odoslaný.",
    sendRejectedError: "Microsoft 365 odmietol odoslanie. Skontrolujte príjemcu a oprávnenia konta.",
    exportForbidden: "Nemáte prístup ku všetkým vybraným e-mailovým kontám. Skontrolujte prístup a zopakujte vyhľadávanie.",
  },
  cs: {
    defaultSearchSubject: "Výsledky vyhledávání",
    exportSourceError: "Původní zprávy nebo přílohy se nepodařilo načíst. E-mail nebyl odeslán.",
    exportUnsupportedAttachment: "Zpráva obsahuje přílohu, kterou nelze exportovat do MSG. Zkuste formát EML. E-mail nebyl odeslán.",
    exportMailboxError: "Připojení Microsoft 365 vypršelo nebo není dostupné. Znovu připojte osobní účet.",
    exportPermissionError: "Microsoft 365 odmítl potřebná oprávnění k odesílání nebo konceptům. Zkontrolujte oprávnění účtu.",
    sendPreparationError: "ZIP se nepodařilo připravit k odeslání. E-mail nebyl odeslán.",
    sendRejectedError: "Microsoft 365 odmítl odeslání. Zkontrolujte příjemce a oprávnění účtu.",
    exportForbidden: "Nemáte přístup ke všem vybraným e-mailovým účtům. Zkontrolujte přístup a zopakujte vyhledávání.",
  },
  hu: {
    defaultSearchSubject: "Keresési eredmények",
    exportSourceError: "Az eredeti üzenetek vagy mellékletek nem tölthetők be. Nem történt e-mail-küldés.",
    exportUnsupportedAttachment: "Egy üzenet MSG-be nem exportálható mellékletet tartalmaz. Próbálja az EML formátumot. Nem történt e-mail-küldés.",
    exportMailboxError: "A Microsoft 365-kapcsolat lejárt vagy nem érhető el. Csatlakoztassa újra személyes fiókját.",
    exportPermissionError: "A Microsoft 365 megtagadta a küldési vagy piszkozatkezelési jogosultságot. Ellenőrizze a fiók jogosultságait.",
    sendPreparationError: "A ZIP küldése nem készíthető elő. Nem történt e-mail-küldés.",
    sendRejectedError: "A Microsoft 365 elutasította a küldést. Ellenőrizze a címzettet és a fiók jogosultságait.",
    exportForbidden: "Nincs hozzáférése az összes kiválasztott e-mail-fiókhoz. Ellenőrizze a hozzáférést, majd ismételje meg a keresést.",
  },
  ro: {
    defaultSearchSubject: "Rezultatele căutării",
    exportSourceError: "Mesajele originale sau atașamentele nu au putut fi încărcate. E-mailul nu a fost trimis.",
    exportUnsupportedAttachment: "Un mesaj conține un atașament care nu poate fi exportat în MSG. Încercați formatul EML. E-mailul nu a fost trimis.",
    exportMailboxError: "Conexiunea Microsoft 365 a expirat sau nu este disponibilă. Reconectați contul personal.",
    exportPermissionError: "Microsoft 365 a refuzat permisiunile necesare pentru trimitere sau ciorne. Verificați permisiunile contului.",
    sendPreparationError: "Fișierul ZIP nu a putut fi pregătit pentru trimitere. E-mailul nu a fost trimis.",
    sendRejectedError: "Microsoft 365 a refuzat trimiterea. Verificați destinatarul și permisiunile contului.",
    exportForbidden: "Nu aveți acces la toate conturile de e-mail selectate. Verificați accesul și repetați căutarea.",
  },
  it: {
    defaultSearchSubject: "Risultati della ricerca",
    exportSourceError: "Impossibile caricare i messaggi originali o gli allegati. Nessuna e-mail è stata inviata.",
    exportUnsupportedAttachment: "Un messaggio contiene un allegato non esportabile in MSG. Provare il formato EML. Nessuna e-mail è stata inviata.",
    exportMailboxError: "La connessione Microsoft 365 è scaduta o non disponibile. Ricollegare l’account personale.",
    exportPermissionError: "Microsoft 365 ha negato i permessi necessari per l’invio o le bozze. Verificare i permessi dell’account.",
    sendPreparationError: "Impossibile preparare il file ZIP per l’invio. Nessuna e-mail è stata inviata.",
    sendRejectedError: "Microsoft 365 ha rifiutato l’invio. Verificare il destinatario e i permessi dell’account.",
    exportForbidden: "Non si dispone dell’accesso a tutti gli account e-mail selezionati. Verificare l’accesso e ripetere la ricerca.",
  },
  de: {
    defaultSearchSubject: "Suchergebnisse",
    exportSourceError: "Die Originalnachrichten oder Anhänge konnten nicht geladen werden. Es wurde keine E-Mail gesendet.",
    exportUnsupportedAttachment: "Eine Nachricht enthält einen nicht als MSG exportierbaren Anhang. Versuchen Sie EML. Es wurde keine E-Mail gesendet.",
    exportMailboxError: "Die Microsoft-365-Verbindung ist abgelaufen oder nicht verfügbar. Verbinden Sie das persönliche Konto erneut.",
    exportPermissionError: "Microsoft 365 hat die erforderlichen Sende- oder Entwurfsberechtigungen verweigert. Prüfen Sie die Kontoberechtigungen.",
    sendPreparationError: "Die ZIP-Datei konnte nicht zum Senden vorbereitet werden. Es wurde keine E-Mail gesendet.",
    sendRejectedError: "Microsoft 365 hat das Senden abgelehnt. Prüfen Sie Empfänger und Kontoberechtigungen.",
    exportForbidden: "Sie haben nicht auf alle ausgewählten E-Mail-Konten Zugriff. Prüfen Sie den Zugriff und wiederholen Sie die Suche.",
  },
};
export default {
  en: { ...translations.en, ...visibilityCopy.en, ...extra.en, ...replyTemplateCopy.en, ...criteriaCopy.en, ...deliveryCopy.en }, sk: { ...translations.sk, ...visibilityCopy.sk, ...extra.sk, ...replyTemplateCopy.sk, ...criteriaCopy.sk, ...deliveryCopy.sk },
  cs: { ...translations.cs, ...visibilityCopy.cs, ...extra.cs, ...replyTemplateCopy.cs, ...criteriaCopy.cs, ...deliveryCopy.cs }, hu: { ...translations.hu, ...visibilityCopy.hu, ...extra.hu, ...replyTemplateCopy.hu, ...criteriaCopy.hu, ...deliveryCopy.hu },
  ro: { ...translations.ro, ...visibilityCopy.ro, ...extra.ro, ...replyTemplateCopy.ro, ...criteriaCopy.ro, ...deliveryCopy.ro }, it: { ...translations.it, ...visibilityCopy.it, ...extra.it, ...replyTemplateCopy.it, ...criteriaCopy.it, ...deliveryCopy.it },
  de: { ...translations.de, ...visibilityCopy.de, ...extra.de, ...replyTemplateCopy.de, ...criteriaCopy.de, ...deliveryCopy.de },
};
