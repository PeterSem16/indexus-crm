const languages = ["en","sk","cs","hu","ro","it","de"];
const rows: Record<string,string[]> = {
  callbackRuleDate:["Rule date and time","Dátum a čas podľa pravidla","Datum a čas podle pravidla","Szabály szerinti dátum és idő","Data și ora regulii","Data e ora della regola","Datum und Uhrzeit der Regel"],
  title:["Before you confirm","Pred potvrdením","Před potvrzením","Megerősítés előtt","Înainte de confirmare","Prima di confermare","Vor der Bestätigung"],
  help:["Review the related actions. Nothing has been saved or sent yet.","Skontrolujte súvisiace akcie. Zatiaľ sa nič neuložilo ani neodoslalo.","Zkontrolujte související akce. Zatím se nic neuložilo ani neodeslalo.","Ellenőrizze a kapcsolódó műveleteket. Még semmit nem mentettünk vagy küldtünk el.","Verificați acțiunile asociate. Nu s-a salvat sau trimis nimic încă.","Controlla le azioni associate. Nulla è stato salvato o inviato.","Prüfen Sie die zugehörigen Aktionen. Noch wurde nichts gespeichert oder gesendet."],
  caution:["Conditions are checked again on execution. Delivery, chained actions and callback availability are not guaranteed by this preview.","Podmienky sa pri vykonaní overia znova. Náhľad nepotvrdzuje doručenie, nadväzujúce akcie ani dostupnosť callback termínu.","Podmínky se při provedení znovu ověří. Náhled nepotvrzuje doručení, navazující akce ani dostupnost callback termínu.","A feltételeket végrehajtáskor újra ellenőrizzük. Az előnézet nem garantálja a kézbesítést, a láncolt műveleteket vagy a visszahívási időpontot.","Condițiile se verifică din nou la execuție. Previzualizarea nu garantează livrarea, acțiunile în lanț sau disponibilitatea programării.","Le condizioni vengono ricontrollate all’esecuzione. L’anteprima non garantisce consegna, azioni concatenate o disponibilità del richiamo.","Bedingungen werden bei Ausführung erneut geprüft. Die Vorschau garantiert weder Zustellung noch Folgeaktionen oder Rückrufverfügbarkeit."],
  loading:["Evaluating actions…","Vyhodnocujem akcie…","Vyhodnocuji akce…","Műveletek értékelése…","Se evaluează acțiunile…","Valutazione delle azioni…","Aktionen werden geprüft…"],
  error:["Could not verify actions. Nothing was executed. Retry or cancel.","Akcie sa nepodarilo overiť. Nič sa nevykonalo. Zopakujte kontrolu alebo zrušte.","Akce se nepodařilo ověřit. Nic se neprovedlo. Zopakujte kontrolu nebo zrušte.","A műveletek nem ellenőrizhetők. Nem történt végrehajtás. Próbálja újra vagy mégse.","Acțiunile nu au putut fi verificate. Nu s-a executat nimic. Reîncercați sau anulați.","Impossibile verificare le azioni. Nulla è stato eseguito. Riprova o annulla.","Aktionen konnten nicht geprüft werden. Nichts wurde ausgeführt. Erneut versuchen oder abbrechen."],
  retry:["Retry","Zopakovať kontrolu","Zopakovat kontrolu","Újra","Reîncearcă","Riprova","Erneut prüfen"],
  cancel:["Cancel","Zrušiť","Zrušit","Mégse","Anulează","Annulla","Abbrechen"],
  confirm:["Confirm and continue","Potvrdiť a pokračovať","Potvrdit a pokračovat","Megerősítés és folytatás","Confirmă și continuă","Conferma e continua","Bestätigen und fortfahren"],
  empty:["No related actions will run for this change.","Pre túto zmenu nie sú pripravené žiadne súvisiace akcie.","Pro tuto změnu nejsou připravené žádné související akce.","Ehhez a változáshoz nincs kapcsolódó művelet.","Nu sunt pregătite acțiuni asociate pentru această modificare.","Nessuna azione associata è prevista per questa modifica.","Für diese Änderung sind keine zugehörigen Aktionen vorgesehen."],
  matched:["Condition met","Podmienka splnená","Podmínka splněna","Feltétel teljesül","Condiție îndeplinită","Condizione soddisfatta","Bedingung erfüllt"],
  not_matched:["Will be skipped — condition not met","Preskočí sa — podmienka nesplnená","Přeskočí se — podmínka nesplněna","Kimarad — feltétel nem teljesül","Se omite — condiție neîndeplinită","Saltata — condizione non soddisfatta","Wird übersprungen — Bedingung nicht erfüllt"],
  unknown:["Evaluated after saving the answer","Overí sa až po uložení odpovede","Ověří se až po uložení odpovědi","A válasz mentése után ellenőrizve","Se verifică după salvarea răspunsului","Verificata dopo il salvataggio della risposta","Wird nach Speichern der Antwort geprüft"],
  blocked:["Configuration needs attention","Nastavenie vyžaduje pozornosť","Nastavení vyžaduje pozornost","A beállítás javítandó","Configurația necesită atenție","Configurazione da verificare","Konfiguration muss geprüft werden"],
  then:["THEN","POTOM","POTOM","AKKOR","ATUNCI","ALLORA","DANN"],
  else:["ELSE","INAK","JINAK","KÜLÖNBEN","ALTFEL","ALTRIMENTI","SONST"],
  action:["Related action","Súvisiaca akcia","Související akce","Kapcsolódó művelet","Acțiune asociată","Azione associata","Zugehörige Aktion"],
  email:["Send email","Odoslať e-mail","Odeslat e-mail","E-mail küldése","Trimite e-mail","Invia e-mail","E-Mail senden"],
  sms:["Send SMS","Odoslať SMS","Odeslat SMS","SMS küldése","Trimite SMS","Invia SMS","SMS senden"],
  task:["Create task","Vytvoriť úlohu","Vytvořit úkol","Feladat létrehozása","Creează sarcină","Crea attività","Aufgabe erstellen"],
  callback:["Schedule callback","Naplánovať callback","Naplánovat callback","Visszahívás ütemezése","Programează reapelare","Pianifica richiamo","Rückruf planen"],
  callbackWhen:["New callback date and time","Nový dátum a čas hovoru","Nové datum a čas hovoru","Új visszahívási dátum és idő","Data și ora noului apel","Nuova data e ora del richiamo","Neuer Rückruftermin"],
  callbackNote:["Callback note","Poznámka k hovoru","Poznámka k hovoru","Visszahívási megjegyzés","Notă apel","Nota richiamo","Rückrufnotiz"],
  summaryOverview:["Quick summary","Stručné zhrnutie","Stručné shrnutí","Rövid összefoglaló","Rezumat scurt","Riepilogo breve","Kurzübersicht"],
  rescheduleNewDate:["New date","Nový dátum","Nové datum","Új dátum","Data nouă","Nuova data","Neues Datum"],
  rescheduleTime:["Time","Čas","Čas","Idő","Ora","Ora","Uhrzeit"],
  reschedule24Hour:["24-hour time","24-hodinový čas","24hodinový čas","24 órás idő","Format 24 de ore","Formato 24 ore","24-Stunden-Format"],
  reschedulePreviousWeekday:["Previous weekday","Predchádzajúci pracovný deň","Předchozí pracovní den","Előző munkanap","Zi lucrătoare precedentă","Giorno feriale precedente","Vorheriger Werktag"],
  rescheduleNextWeekday:["Next weekday","Nasledujúci pracovný deň","Následující pracovní den","Következő munkanap","Următoarea zi lucrătoare","Prossimo giorno feriale","Nächster Werktag"],
  taskFor:["For","Pre","Pro","Címzett","Pentru","Per","Für"],
  callbackKept:["Existing callback will be kept","Existujúci callback zostane zachovaný","Stávající callback zůstane zachován","A meglévő visszahívás megmarad","Apelul existent va fi păstrat","Il richiamo esistente verrà mantenuto","Bestehender Rückruf bleibt erhalten"],
  taskTargetUnknown:["Recipient must be checked in the action settings","Príjemcu treba overiť v nastavení akcie","Příjemce je nutné ověřit v nastavení akce","A címzettet ellenőrizni kell a művelet beállításaiban","Destinatarul trebuie verificat în setările acțiunii","Verificare il destinatario nelle impostazioni dell’azione","Empfänger in den Aktionseinstellungen prüfen"],
  record:["Update contact","Upraviť kontakt","Upravit kontakt","Kapcsolat módosítása","Actualizează contactul","Aggiorna contatto","Kontakt aktualisieren"],
  answer:["Change answer","Zmeniť odpoveď","Změnit odpověď","Válasz módosítása","Modifică răspunsul","Modifica risposta","Antwort ändern"],
  note:["Update note","Upraviť poznámku","Upravit poznámku","Megjegyzés módosítása","Actualizează nota","Aggiorna nota","Notiz ändern"],
  notify:["Notify user","Upozorniť používateľa","Upozornit uživatele","Felhasználó értesítése","Notifică utilizatorul","Notifica utente","Benutzer benachrichtigen"],
};
export function getStatusListRecapCopy(locale:string) {
  const index=Math.max(0,languages.indexOf(locale));
  return Object.fromEntries(Object.entries(rows).map(([key,values])=>[key,values[index]])) as Record<keyof typeof rows,string>;
}
export function statusListRecapActionLabel(type:string,locale:string) {
  const c=getStatusListRecapCopy(locale);
  const key=/email/.test(type)?"email":/sms/.test(type)?"sms":/task/.test(type)?"task":/callback/.test(type)?"callback":
    /note/.test(type)?"note":/answer|selection|confirm_step/.test(type)?"answer":/notif/.test(type)?"notify":
    /record|status|owner|tag|assign/.test(type)?"record":"action";
  return c[key];
}
