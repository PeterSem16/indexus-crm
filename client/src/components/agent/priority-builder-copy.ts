import type { Locale } from "@/i18n/translations";

const priorityCityCopy: Record<Locale, {
  groupByCity: string;
  groupByCityHint: string;
  cityRankingPending: string;
  cityRankingReady: string;
  cityRankingError: string;
  cityRankingRetry: string;
  cityRankingRefresh: string;
  cityRankingEstimated: string;
  cityRankingLocations: string;
  cityRankingTooMany: string;
  unknownCity: string;
  cityCountrySeparator: string;
}> = {
  en: { groupByCity: "Group by city", groupByCityHint: "Rank eligible cities with AI before saving this view.", cityRankingPending: "Ranking cities…", cityRankingReady: "AI city order ready", cityRankingError: "City ranking failed.", cityRankingRetry: "Retry ranking", cityRankingRefresh: "Refresh ranking", cityRankingEstimated: "Estimated order", cityRankingLocations: "locations", cityRankingTooMany: "There are too many locations to rank.", unknownCity: "Unknown location", cityCountrySeparator: ", " },
  sk: { groupByCity: "Zoskupiť podľa mesta", groupByCityHint: "Pred uložením zobrazenia zoradí oprávnené mestá AI.", cityRankingPending: "Zoraďujú sa mestá…", cityRankingReady: "Poradie miest AI je pripravené", cityRankingError: "Poradie miest zlyhalo.", cityRankingRetry: "Zopakovať poradie", cityRankingRefresh: "Obnoviť poradie", cityRankingEstimated: "Odhadované poradie", cityRankingLocations: "lokalít", cityRankingTooMany: "Na zoradenie je príliš veľa lokalít.", unknownCity: "Neznáma lokalita", cityCountrySeparator: ", " },
  cs: { groupByCity: "Seskupit podle města", groupByCityHint: "Před uložením zobrazení seřadí způsobilá města AI.", cityRankingPending: "Řazení měst…", cityRankingReady: "Pořadí měst AI je připraveno", cityRankingError: "Řazení měst selhalo.", cityRankingRetry: "Řadit znovu", cityRankingRefresh: "Obnovit pořadí", cityRankingEstimated: "Odhadované pořadí", cityRankingLocations: "lokalit", cityRankingTooMany: "K seřazení je příliš mnoho lokalit.", unknownCity: "Neznámá lokalita", cityCountrySeparator: ", " },
  hu: { groupByCity: "Csoportosítás város szerint", groupByCityHint: "A nézet mentése előtt az AI sorba rendezi a jogosult városokat.", cityRankingPending: "Városok rangsorolása…", cityRankingReady: "Az AI városi sorrend kész", cityRankingError: "A városi rangsorolás sikertelen.", cityRankingRetry: "Rangsorolás újra", cityRankingRefresh: "Sorrend frissítése", cityRankingEstimated: "Becsült sorrend", cityRankingLocations: "helyszín", cityRankingTooMany: "Túl sok helyszín rangsorolható.", unknownCity: "Ismeretlen hely", cityCountrySeparator: ", " },
  ro: { groupByCity: "Grupează după oraș", groupByCityHint: "AI ordonează orașele eligibile înainte de salvarea vizualizării.", cityRankingPending: "Se ordonează orașele…", cityRankingReady: "Ordinea orașelor AI este gata", cityRankingError: "Ordonarea orașelor a eșuat.", cityRankingRetry: "Reîncearcă ordonarea", cityRankingRefresh: "Reîmprospătează ordinea", cityRankingEstimated: "Ordine estimată", cityRankingLocations: "locații", cityRankingTooMany: "Sunt prea multe locații pentru ordonare.", unknownCity: "Locație necunoscută", cityCountrySeparator: ", " },
  it: { groupByCity: "Raggruppa per città", groupByCityHint: "L'AI ordina le città idonee prima di salvare questa vista.", cityRankingPending: "Città in classificazione…", cityRankingReady: "Ordine città AI pronto", cityRankingError: "Classificazione città non riuscita.", cityRankingRetry: "Riprova classificazione", cityRankingRefresh: "Aggiorna ordine", cityRankingEstimated: "Ordine stimato", cityRankingLocations: "località", cityRankingTooMany: "Troppe località da classificare.", unknownCity: "Località sconosciuta", cityCountrySeparator: ", " },
  de: { groupByCity: "Nach Stadt gruppieren", groupByCityHint: "Die KI ordnet berechtigte Städte vor dem Speichern dieser Ansicht.", cityRankingPending: "Städte werden geordnet…", cityRankingReady: "KI-Städtereihenfolge bereit", cityRankingError: "Städterangfolge fehlgeschlagen.", cityRankingRetry: "Rangfolge wiederholen", cityRankingRefresh: "Rangfolge aktualisieren", cityRankingEstimated: "Geschätzte Reihenfolge", cityRankingLocations: "Orte", cityRankingTooMany: "Zu viele Orte für eine Rangfolge.", unknownCity: "Unbekannter Ort", cityCountrySeparator: ", " },
};

export const priorityBuilderCopy: Record<Locale, {
  contactsSavedView: string;
  evaluationOrder: string;
  evaluationHint: string;
  eligibleContacts: string;
  uniqueContacts: string;
  personalView: string;
  savedViews: string;
  liveResult: string;
  workNext: string;
  dedupActive: string;
  dedupDetail: string;
  whyThisOrder: string;
  whyOne: string;
  whyMany: string;
  reset: string;
  fieldAll: string;
  moreActions: string;
  removeSegment: string;
  renameView: string;
  auto: string;
  autoOn: string;
  autoOff: string;
  nextContact: string;
  queueSyncHint: string;
  loadError: string;
  saveError: string;
  retry: string;
  dragHint: string;
  close: string;
  queuePosition: string;
  nextUp: string;
  group: string;
  scheduledCallback: string;
  notScheduled: string;
  callAttempts: string;
  noAttempts: string;
  unknownAttempts: string;
  otherGroup: string;
  groupByCity: string;
  groupByCityHint: string;
  cityRankingPending: string;
  cityRankingReady: string;
  cityRankingError: string;
  cityRankingRetry: string;
  cityRankingRefresh: string;
  cityRankingEstimated: string;
  cityRankingLocations: string;
  cityRankingTooMany: string;
  unknownCity: string;
  cityCountrySeparator: string;
}> = {
  en: {
    contactsSavedView: "Contacts / saved view", evaluationOrder: "Evaluation order", evaluationHint: "First matching segment wins. Unmatched eligible contacts follow once.", eligibleContacts: "eligible contacts", uniqueContacts: "unique contacts", personalView: "Personal view", savedViews: "Saved views", liveResult: "Live result", workNext: "What will be worked next", dedupActive: "Deduplication active.", dedupDetail: "contacts match more than one rule and appear only in their highest segment.", whyThisOrder: "Why this order?", whyOne: "is evaluated before", whyMany: "is evaluated first, so matching contacts reach the front of the queue.", reset: "Reset", fieldAll: "Field: all", moreActions: "More segment actions", removeSegment: "Remove segment", renameView: "Rename view", auto: "Auto", autoOn: "on", autoOff: "off", nextContact: "Next contact", queueSyncHint: "Save changes before Auto or Next use this order.", loadError: "Saved views could not be loaded.", saveError: "The view could not be saved.", retry: "Retry", dragHint: "Use arrows to make priority tangible. Deduplication happens top to bottom.", close: "Close", queuePosition: "Queue position", nextUp: "Next up", group: "Group", scheduledCallback: "Scheduled callback", notScheduled: "Not scheduled", callAttempts: "Call attempts in this Mission", noAttempts: "No attempts", unknownAttempts: "Unknown", otherGroup: "Other eligible contacts", groupByCity: "Group by city", groupByCityHint: "Rank eligible cities with AI before saving this view.", cityRankingPending: "Ranking cities…", cityRankingReady: "AI city order ready", cityRankingError: "City ranking failed.", cityRankingRetry: "Retry ranking", cityRankingRefresh: "Refresh ranking", cityRankingEstimated: "Estimated order", cityRankingLocations: "locations", cityRankingTooMany: "There are too many locations to rank.", unknownCity: "Unknown location", cityCountrySeparator: ", ",
  },
  sk: {
    contactsSavedView: "Kontakty / uložené zobrazenie", evaluationOrder: "Poradie vyhodnotenia", evaluationHint: "Vyhráva prvý zodpovedajúci segment. Nezhodné oprávnené kontakty nasledujú raz.", eligibleContacts: "oprávnených kontaktov", uniqueContacts: "jedinečných kontaktov", personalView: "Osobné zobrazenie", savedViews: "Uložené zobrazenia", liveResult: "Živý výsledok", workNext: "Čo bude spracované ako ďalšie", dedupActive: "Deduplikácia je aktívna.", dedupDetail: "kontaktov zodpovedá viacerým pravidlám a zobrazí sa iba v najvyššom segmente.", whyThisOrder: "Prečo toto poradie?", whyOne: "sa vyhodnocuje pred", whyMany: "sa vyhodnocuje ako prvý, preto sa zodpovedajúce kontakty dostanú na začiatok frontu.", reset: "Obnoviť", fieldAll: "Pole: všetky", moreActions: "Ďalšie akcie segmentu", removeSegment: "Odstrániť segment", renameView: "Premenovať zobrazenie", auto: "Auto", autoOn: "zap.", autoOff: "vyp.", nextContact: "Ďalší kontakt", queueSyncHint: "Pred použitím Auto alebo Ďalší kontakt uložte zmeny.", loadError: "Uložené zobrazenia sa nepodarilo načítať.", saveError: "Zobrazenie sa nepodarilo uložiť.", retry: "Skúsiť znova", dragHint: "Na úpravu priority použite šípky. Deduplikácia prebieha zhora nadol.", close: "Zavrieť", queuePosition: "Pozícia vo fronte", nextUp: "Ďalší na rade", group: "Skupina", scheduledCallback: "Naplánovaný spätný hovor", notScheduled: "Nenaplánované", callAttempts: "Pokusy o hovor v tejto misii", noAttempts: "Bez pokusov", unknownAttempts: "Neznáme", otherGroup: "Ostatné oprávnené kontakty", groupByCity: "Zoskupiť podľa mesta", groupByCityHint: "Pred uložením zobrazenia zoradí oprávnené mestá AI.", cityRankingPending: "Zoraďujú sa mestá…", cityRankingReady: "Poradie miest AI je pripravené", cityRankingError: "Poradie miest zlyhalo.", cityRankingRetry: "Zopakovať poradie", cityRankingRefresh: "Obnoviť poradie", cityRankingEstimated: "Odhadované poradie", cityRankingLocations: "lokalít", cityRankingTooMany: "Na zoradenie je príliš veľa lokalít.", unknownCity: "Neznáma lokalita", cityCountrySeparator: ", ",
  },
  cs: {
    contactsSavedView: "Kontakty / uložené zobrazení", evaluationOrder: "Pořadí vyhodnocení", evaluationHint: "Vyhrává první odpovídající segment. Neshodné způsobilé kontakty následují jednou.", eligibleContacts: "způsobilých kontaktů", uniqueContacts: "jedinečných kontaktů", personalView: "Osobní zobrazení", savedViews: "Uložená zobrazení", liveResult: "Živý výsledek", workNext: "Co bude zpracováno jako další", dedupActive: "Deduplikace je aktivní.", dedupDetail: "kontaktů odpovídá více pravidlům a zobrazí se jen v nejvyšším segmentu.", whyThisOrder: "Proč toto pořadí?", whyOne: "se vyhodnocuje před", whyMany: "se vyhodnocuje jako první, proto se odpovídající kontakty dostanou na začátek fronty.", reset: "Obnovit", fieldAll: "Pole: všechna", moreActions: "Další akce segmentu", removeSegment: "Odebrat segment", renameView: "Přejmenovat zobrazení", auto: "Auto", autoOn: "zap.", autoOff: "vyp.", nextContact: "Další kontakt", queueSyncHint: "Před použitím Auto nebo Další kontakt změny uložte.", loadError: "Uložená zobrazení nelze načíst.", saveError: "Zobrazení nelze uložit.", retry: "Zkusit znovu", dragHint: "Pro úpravu priority použijte šipky. Deduplikace probíhá shora dolů.", close: "Zavřít", queuePosition: "Pozice ve frontě", nextUp: "Další na řadě", group: "Skupina", scheduledCallback: "Naplánovaný zpětný hovor", notScheduled: "Nenaplánováno", callAttempts: "Pokusy o volání v této misi", noAttempts: "Bez pokusů", unknownAttempts: "Neznámé", otherGroup: "Ostatní způsobilé kontakty",
    ...priorityCityCopy.cs,
  },
  hu: {
    contactsSavedView: "Kapcsolatok / mentett nézet", evaluationOrder: "Értékelési sorrend", evaluationHint: "Az első egyező szegmens nyer. A nem egyező jogosult kapcsolatok egyszer követik.", eligibleContacts: "jogosult kapcsolat", uniqueContacts: "egyedi kapcsolat", personalView: "Személyes nézet", savedViews: "Mentett nézetek", liveResult: "Élő eredmény", workNext: "A következő feldolgozandó", dedupActive: "Duplikációmentesítés aktív.", dedupDetail: "kapcsolat több szabálynak is megfelel, de csak a legmagasabb szegmensben jelenik meg.", whyThisOrder: "Miért ez a sorrend?", whyOne: "értékelése megelőzi ezt:", whyMany: "értékelése történik először, ezért az egyező kapcsolatok a sor elejére kerülnek.", reset: "Visszaállítás", fieldAll: "Mező: összes", moreActions: "További szegmensműveletek", removeSegment: "Szegmens eltávolítása", renameView: "Nézet átnevezése", auto: "Automatikus", autoOn: "be", autoOff: "ki", nextContact: "Következő kapcsolat", queueSyncHint: "Mentse a módosításokat az Automatikus vagy Következő kapcsolat használata előtt.", loadError: "A mentett nézetek betöltése sikertelen.", saveError: "A nézet mentése sikertelen.", retry: "Újrapróbálás", dragHint: "A prioritás módosításához használja a nyilakat. A duplikációmentesítés felülről lefelé történik.", close: "Bezárás", queuePosition: "Várólista-pozíció", nextUp: "Következik", group: "Csoport", scheduledCallback: "Ütemezett visszahívás", notScheduled: "Nincs ütemezve", callAttempts: "Hívási kísérletek ebben a küldetésben", noAttempts: "Nincs próbálkozás", unknownAttempts: "Ismeretlen", otherGroup: "Egyéb jogosult kapcsolatok",
    ...priorityCityCopy.hu,
  },
  ro: {
    contactsSavedView: "Contacte / vizualizare salvată", evaluationOrder: "Ordinea evaluării", evaluationHint: "Primul segment potrivit câștigă. Contactele eligibile necorespunzătoare urmează o singură dată.", eligibleContacts: "contacte eligibile", uniqueContacts: "contacte unice", personalView: "Vizualizare personală", savedViews: "Vizualizări salvate", liveResult: "Rezultat live", workNext: "Ce va fi procesat în continuare", dedupActive: "Deduplicare activă.", dedupDetail: "contacte corespund mai multor reguli și apar numai în segmentul cu prioritatea cea mai mare.", whyThisOrder: "De ce această ordine?", whyOne: "este evaluat înainte de", whyMany: "este evaluat primul, astfel contactele potrivite ajung în fața cozii.", reset: "Resetează", fieldAll: "Câmp: toate", moreActions: "Mai multe acțiuni pentru segment", removeSegment: "Elimină segmentul", renameView: "Redenumește vizualizarea", auto: "Auto", autoOn: "pornit", autoOff: "oprit", nextContact: "Următorul contact", queueSyncHint: "Salvați modificările înainte ca Auto sau Următorul contact să folosească această ordine.", loadError: "Vizualizările salvate nu au putut fi încărcate.", saveError: "Vizualizarea nu a putut fi salvată.", retry: "Reîncearcă", dragHint: "Folosiți săgețile pentru a modifica prioritatea. Deduplicarea se face de sus în jos.", close: "Închide", queuePosition: "Poziția în coadă", nextUp: "Urmează", group: "Grup", scheduledCallback: "Callback programat", notScheduled: "Nu este programat", callAttempts: "Încercări de apel în această misiune", noAttempts: "Fără încercări", unknownAttempts: "Necunoscut", otherGroup: "Alte contacte eligibile",
    ...priorityCityCopy.ro,
  },
  it: {
    contactsSavedView: "Contatti / vista salvata", evaluationOrder: "Ordine di valutazione", evaluationHint: "Vince il primo segmento corrispondente. I contatti idonei non corrispondenti seguono una sola volta.", eligibleContacts: "contatti idonei", uniqueContacts: "contatti unici", personalView: "Vista personale", savedViews: "Viste salvate", liveResult: "Risultato live", workNext: "Cosa verrà gestito dopo", dedupActive: "Deduplicazione attiva.", dedupDetail: "contatti soddisfano più di una regola e appaiono solo nel segmento con priorità più alta.", whyThisOrder: "Perché questo ordine?", whyOne: "viene valutato prima di", whyMany: "viene valutato per primo, quindi i contatti corrispondenti arrivano all'inizio della coda.", reset: "Reimposta", fieldAll: "Campo: tutti", moreActions: "Altre azioni del segmento", removeSegment: "Rimuovi segmento", renameView: "Rinomina vista", auto: "Auto", autoOn: "attivo", autoOff: "disattivo", nextContact: "Contatto successivo", queueSyncHint: "Salva le modifiche prima che Auto o Contatto successivo usino questo ordine.", loadError: "Impossibile caricare le viste salvate.", saveError: "Impossibile salvare la vista.", retry: "Riprova", dragHint: "Usa le frecce per modificare la priorità. La deduplicazione avviene dall'alto verso il basso.", close: "Chiudi", queuePosition: "Posizione in coda", nextUp: "Prossimo", group: "Gruppo", scheduledCallback: "Callback programmato", notScheduled: "Non programmato", callAttempts: "Tentativi di chiamata in questa missione", noAttempts: "Nessun tentativo", unknownAttempts: "Sconosciuto", otherGroup: "Altri contatti idonei",
    ...priorityCityCopy.it,
  },
  de: {
    contactsSavedView: "Kontakte / gespeicherte Ansicht", evaluationOrder: "Auswertungsreihenfolge", evaluationHint: "Das erste passende Segment gewinnt. Nicht passende berechtigte Kontakte folgen einmal.", eligibleContacts: "berechtigte Kontakte", uniqueContacts: "eindeutige Kontakte", personalView: "Persönliche Ansicht", savedViews: "Gespeicherte Ansichten", liveResult: "Live-Ergebnis", workNext: "Was als Nächstes bearbeitet wird", dedupActive: "Deduplizierung aktiv.", dedupDetail: "Kontakte treffen auf mehrere Regeln zu und erscheinen nur in ihrem höchsten Segment.", whyThisOrder: "Warum diese Reihenfolge?", whyOne: "wird vor", whyMany: "zuerst ausgewertet, daher stehen passende Kontakte am Anfang der Warteschlange.", reset: "Zurücksetzen", fieldAll: "Feld: alle", moreActions: "Weitere Segmentaktionen", removeSegment: "Segment entfernen", renameView: "Ansicht umbenennen", auto: "Auto", autoOn: "an", autoOff: "aus", nextContact: "Nächster Kontakt", queueSyncHint: "Speichern Sie Änderungen, bevor Auto oder Nächster Kontakt diese Reihenfolge verwenden.", loadError: "Gespeicherte Ansichten konnten nicht geladen werden.", saveError: "Die Ansicht konnte nicht gespeichert werden.", retry: "Erneut versuchen", dragHint: "Verwenden Sie die Pfeile, um die Priorität anzupassen. Die Deduplizierung erfolgt von oben nach unten.", close: "Schließen", queuePosition: "Warteschlangenposition", nextUp: "Als Nächstes", group: "Gruppe", scheduledCallback: "Geplanter Rückruf", notScheduled: "Nicht geplant", callAttempts: "Anrufversuche in dieser Mission", noAttempts: "Keine Versuche", unknownAttempts: "Unbekannt", otherGroup: "Weitere berechtigte Kontakte",
    ...priorityCityCopy.de,
  },
};