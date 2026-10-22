export type AutomaticInitialCopy = {
  title: string;
  intro: string;
  scopeLabel: string;
  contactScope: string;
  missionScope: string;
  missionCaution: string;
  transitionNote: string;
  noContact: string;
  preview: string;
  refreshing: string;
  previewError: string;
  confirmError: string;
  previewChanged: string;
  tooMany: string;
  summary: string;
  contacts: string;
  eligibleContacts: string;
  eligibleActions: string;
  skippedActions: string;
  noActions: string;
  actionCount: string;
  condition: string;
  conditionTrue: string;
  conditionFalse: string;
  conditionUnknown: string;
  status: string;
  issues: string;
  acknowledge: string;
  confirm: string;
  confirming: string;
  complete: string;
  queued: string;
  deferred: string;
  noEligible: string;
  ready: string;
  skipped: string;
  immediate: string;
  batch: string;
  statusNames: Record<string, string>;
  actionNames: Record<string, string>;
  issueNames: Record<string, string>;
  unknownStatus: string;
  unknownAction: string;
  unknownIssue: string;
};

const copy: Record<string, AutomaticInitialCopy> = {
  en: {
    title: "Process current state once",
    intro: "Review the read-only plan first. Only the actions listed as eligible below can be confirmed.",
    scopeLabel: "Preview scope",
    contactScope: "One selected contact",
    missionScope: "Whole Mission",
    missionCaution: "This includes every eligible contact in the Mission (maximum 500). Review every row before confirming.",
    transitionNote: "This one-time pass reads conditions that are true now. Future false → true transitions remain active; previously attempted actions are excluded, not retried. Batch actions wait for the existing Save flow.",
    noContact: "Choose a contact above before previewing. This never switches to the whole Mission automatically.",
    preview: "Build read-only preview",
    refreshing: "Building preview…",
    previewError: "The preview could not be loaded. Nothing was queued or executed.",
    confirmError: "Confirmation could not be completed. Refresh the preview before trying again.",
    previewChanged: "The configuration or current state changed. This preview is no longer valid; build a fresh one.",
    tooMany: "This Mission is larger than the preview limit. Select one contact instead.",
    summary: "Preview totals",
    contacts: "Contacts",
    eligibleContacts: "Eligible contacts",
    eligibleActions: "Eligible actions",
    skippedActions: "Skipped actions",
    noActions: "No eligible actions to confirm.",
    actionCount: "actions",
    condition: "Condition",
    conditionTrue: "IF true",
    conditionFalse: "IF false",
    conditionUnknown: "IF unknown",
    status: "Outcome",
    issues: "Why skipped",
    acknowledge: "I reviewed the full list and understand that confirming processes currently true conditions once. Previously attempted actions are excluded and are not retried.",
    confirm: "Confirm current-state processing",
    confirming: "Confirming…",
    complete: "Confirmed. The listed actions were accepted for processing.",
    queued: "Queued",
    deferred: "Deferred to the existing Save flow",
    noEligible: "There are no eligible actions in this preview, so confirmation is unavailable.",
    ready: "Eligible",
    skipped: "Skipped",
    immediate: "Immediate processing",
    batch: "Batch · waits for the existing Save flow",
    statusNames: {
      ready: "Eligible to process", batch_deferred: "Will wait for existing Save flow",
      disabled: "Disabled", unsupported_action: "Unsupported action", invalid_condition: "Invalid condition",
      missing_answer: "Required answer missing", condition_false: "Condition is false",
      waiting_transition: "Waiting for a new qualifying transition", already_executed: "Already recorded — not repeated",
      background_baseline: "Baseline — no action", pending: "Pending", indeterminate: "Cannot determine",
      succeeded: "Succeeded", failed: "Failed", superseded: "Replaced",
    },
    actionNames: {
      assign_task: "Assign task", send_email: "Send email", update_record: "Update record",
      send_email_group: "Send group email", notify_email: "Send notification email", send_sms: "Send SMS",
      send_contact_email: "Email contact", set_contact_status: "Set contact status",
      set_callback: "Schedule callback", notify_role: "Notify role", sys_webhook: "System webhook",
    },
    issueNames: {
      native_config: "Action configuration is incomplete or invalid", owner_required: "Required owner or role is missing",
      invalid_condition: "The IF condition is invalid", unsupported_action: "This action is not supported",
      missing_answer: "A required answer is missing", invalid_template: "A required template is missing or invalid",
      missing_target: "A required target is missing or invalid", revision_conflict: "Configuration has changed",
      previous_attempt: "This action was previously attempted and will not be retried",
    },
    unknownStatus: "Not eligible", unknownAction: "Action", unknownIssue: "Action cannot be processed",
  },
  sk: {
    title: "Jednorazovo spracovať aktuálny stav",
    intro: "Najprv skontrolujte náhľad iba na čítanie. Potvrdiť možno iba nižšie uvedené oprávnené akcie.",
    scopeLabel: "Rozsah náhľadu", contactScope: "Jeden vybraný kontakt", missionScope: "Celá Misia",
    missionCaution: "Zahŕňa všetky oprávnené kontakty v Misii (najviac 500). Pred potvrdením skontrolujte každý riadok.",
    transitionNote: "Toto jednorazové spracovanie vyhodnotí podmienky pravdivé teraz. Budúce zmeny false → true zostávajú aktívne; už skúšané akcie sú vylúčené a neopakujú sa. Dávkové akcie čakajú na existujúci proces Uložiť.",
    noContact: "Pred náhľadom vyberte kontakt. Rozsah sa nikdy automaticky nezmení na celú Misiu.",
    preview: "Vytvoriť náhľad iba na čítanie", refreshing: "Vytváram náhľad…",
    previewError: "Náhľad sa nepodarilo načítať. Nič sa nezaradilo do frontu ani nevykonalo.",
    confirmError: "Potvrdenie sa nepodarilo dokončiť. Pred ďalším pokusom obnovte náhľad.",
    previewChanged: "Nastavenie alebo aktuálny stav sa zmenil. Náhľad už neplatí; vytvorte nový.",
    tooMany: "Misia prekračuje limit náhľadu. Vyberte jeden kontakt.",
    summary: "Súhrn náhľadu", contacts: "Kontakty", eligibleContacts: "Oprávnené kontakty",
    eligibleActions: "Oprávnené akcie", skippedActions: "Vynechané akcie", noActions: "Nie sú dostupné žiadne oprávnené akcie.",
    actionCount: "akcie", condition: "Podmienka", status: "Výsledok", issues: "Dôvod vynechania",
    conditionTrue: "IF platí", conditionFalse: "IF neplatí", conditionUnknown: "IF neznáme",
    acknowledge: "Skontroloval/-a som celý zoznam a rozumiem, že potvrdenie jednorazovo spracuje aktuálne pravdivé podmienky. Už skúšané akcie sú vylúčené a neopakujú sa.",
    confirm: "Potvrdiť spracovanie aktuálneho stavu", confirming: "Potvrdzujem…",
    complete: "Potvrdené. Uvedené akcie boli prijaté na spracovanie.", queued: "Zaradené do frontu",
    deferred: "Odložené do existujúceho procesu Uložiť",
    noEligible: "V tomto náhľade nie sú oprávnené akcie, potvrdenie preto nie je dostupné.",
    ready: "Oprávnené", skipped: "Vynechané", immediate: "Okamžité spracovanie",
    batch: "Dávka · čaká na existujúci proces Uložiť",
    statusNames: {
      ready: "Oprávnené na spracovanie", batch_deferred: "Počká na existujúci proces Uložiť",
      disabled: "Vypnuté", unsupported_action: "Nepodporovaná akcia", invalid_condition: "Neplatná podmienka",
      missing_answer: "Chýba povinná odpoveď", condition_false: "Podmienka neplatí",
      waiting_transition: "Čaká na novú vyhovujúcu zmenu", already_executed: "Už evidované — neopakuje sa",
      background_baseline: "Základný stav — bez akcie", pending: "Čaká", indeterminate: "Nedá sa určiť",
      succeeded: "Úspešné", failed: "Zlyhalo", superseded: "Nahradené",
    },
    actionNames: {
      assign_task: "Priradiť úlohu", send_email: "Odoslať e-mail", update_record: "Aktualizovať záznam",
      send_email_group: "Odoslať skupinový e-mail", notify_email: "Odoslať notifikačný e-mail", send_sms: "Odoslať SMS",
      send_contact_email: "Poslať e-mail kontaktu", set_contact_status: "Nastaviť stav kontaktu",
      set_callback: "Naplánovať spätné volanie", notify_role: "Upozorniť rolu", sys_webhook: "Systémový webhook",
    },
    issueNames: {
      native_config: "Konfigurácia akcie je neúplná alebo neplatná", owner_required: "Chýba povinný vlastník alebo rola",
      invalid_condition: "Podmienka IF je neplatná", unsupported_action: "Akcia nie je podporovaná",
      missing_answer: "Chýba povinná odpoveď", invalid_template: "Povinná šablóna chýba alebo je neplatná",
      missing_target: "Povinný cieľ chýba alebo je neplatný", revision_conflict: "Nastavenie sa zmenilo",
      previous_attempt: "Akcia už bola skúšaná a nebude sa opakovať",
    },
    unknownStatus: "Nie je oprávnené", unknownAction: "Akcia", unknownIssue: "Akciu nemožno spracovať",
  },
  cs: {
    title: "Jednorázově zpracovat aktuální stav",
    intro: "Nejprve zkontrolujte náhled pouze pro čtení. Potvrdit lze jen níže uvedené způsobilé akce.",
    scopeLabel: "Rozsah náhledu", contactScope: "Jeden vybraný kontakt", missionScope: "Celá Mise",
    missionCaution: "Zahrnuje všechny způsobilé kontakty v Misi (nejvýše 500). Před potvrzením zkontrolujte každý řádek.",
    transitionNote: "Toto jednorázové zpracování vyhodnotí nyní pravdivé podmínky. Budoucí změny false → true zůstávají aktivní; již zkoušené akce jsou vyloučené a neopakují se. Dávkové akce čekají na stávající proces Uložit.",
    noContact: "Před náhledem vyberte kontakt. Rozsah se nikdy automaticky nepřepne na celou Misi.",
    preview: "Vytvořit náhled pouze pro čtení", refreshing: "Vytvářím náhled…",
    previewError: "Náhled nelze načíst. Nic nebylo zařazeno do fronty ani provedeno.",
    confirmError: "Potvrzení se nepodařilo dokončit. Před dalším pokusem obnovte náhled.",
    previewChanged: "Nastavení nebo aktuální stav se změnil. Náhled již neplatí; vytvořte nový.",
    tooMany: "Mise překračuje limit náhledu. Vyberte jeden kontakt.",
    summary: "Souhrn náhledu", contacts: "Kontakty", eligibleContacts: "Způsobilé kontakty",
    eligibleActions: "Způsobilé akce", skippedActions: "Přeskočené akce", noActions: "Nejsou k dispozici žádné způsobilé akce.",
    actionCount: "akce", condition: "Podmínka", status: "Výsledek", issues: "Důvod přeskočení",
    conditionTrue: "IF platí", conditionFalse: "IF neplatí", conditionUnknown: "IF neznámé",
    acknowledge: "Zkontroloval/a jsem celý seznam a rozumím tomu, že potvrzení jednorázově zpracuje aktuálně pravdivé podmínky. Již zkoušené akce jsou vyloučené a neopakují se.",
    confirm: "Potvrdit zpracování aktuálního stavu", confirming: "Potvrzuji…",
    complete: "Potvrzeno. Uvedené akce byly přijaty ke zpracování.", queued: "Zařazeno do fronty",
    deferred: "Odloženo do stávajícího procesu Uložit",
    noEligible: "V tomto náhledu nejsou způsobilé akce, potvrzení proto není dostupné.",
    ready: "Způsobilé", skipped: "Přeskočené", immediate: "Okamžité zpracování",
    batch: "Dávka · čeká na stávající proces Uložit",
    statusNames: {
      ready: "Způsobilé ke zpracování", batch_deferred: "Počká na stávající proces Uložit",
      disabled: "Vypnuto", unsupported_action: "Nepodporovaná akce", invalid_condition: "Neplatná podmínka",
      missing_answer: "Chybí povinná odpověď", condition_false: "Podmínka není splněna",
      waiting_transition: "Čeká na novou odpovídající změnu", already_executed: "Již evidováno — neopakuje se",
      background_baseline: "Základní stav — bez akce", pending: "Čeká", indeterminate: "Nelze určit",
      succeeded: "Úspěšné", failed: "Selhalo", superseded: "Nahrazeno",
    },
    actionNames: {
      assign_task: "Přiřadit úkol", send_email: "Odeslat e-mail", update_record: "Aktualizovat záznam",
      send_email_group: "Odeslat skupinový e-mail", notify_email: "Odeslat notifikační e-mail", send_sms: "Odeslat SMS",
      send_contact_email: "Poslat e-mail kontaktu", set_contact_status: "Nastavit stav kontaktu",
      set_callback: "Naplánovat zpětné volání", notify_role: "Upozornit roli", sys_webhook: "Systémový webhook",
    },
    issueNames: {
      native_config: "Konfigurace akce je neúplná nebo neplatná", owner_required: "Chybí povinný vlastník nebo role",
      invalid_condition: "Podmínka IF je neplatná", unsupported_action: "Akce není podporována",
      missing_answer: "Chybí povinná odpověď", invalid_template: "Povinná šablona chybí nebo je neplatná",
      missing_target: "Povinný cíl chybí nebo je neplatný", revision_conflict: "Nastavení se změnilo",
      previous_attempt: "Akce již byla zkoušena a nebude se opakovat",
    },
    unknownStatus: "Není způsobilé", unknownAction: "Akce", unknownIssue: "Akci nelze zpracovat",
  },
  hu: {
    title: "Aktuális állapot egyszeri feldolgozása",
    intro: "Először tekintse át a csak olvasható előnézetet. Csak az alább jogosultként jelölt műveletek erősíthetők meg.",
    scopeLabel: "Előnézet hatóköre", contactScope: "Egy kiválasztott kapcsolat", missionScope: "Teljes Misszió",
    missionCaution: "A Misszió minden jogosult kapcsolatát tartalmazza (legfeljebb 500-at). Megerősítés előtt tekintsen át minden sort.",
    transitionNote: "Ez az egyszeri feldolgozás a most igaz feltételeket értékeli ki. A későbbi false → true átmenetek aktívak maradnak; a korábban megkísérelt műveletek kimaradnak, és nem próbálja újra őket. A kötegelt műveletek a meglévő Mentés folyamatra várnak.",
    noContact: "Előnézet előtt válasszon kapcsolatot. A rendszer soha nem vált automatikusan a teljes Misszióra.",
    preview: "Csak olvasható előnézet készítése", refreshing: "Előnézet készítése…",
    previewError: "Az előnézet nem tölthető be. Nem történt végrehajtás vagy sorba állítás.",
    confirmError: "A megerősítés nem sikerült. Új próbálkozás előtt frissítse az előnézetet.",
    previewChanged: "A beállítás vagy az aktuális állapot megváltozott. Az előnézet érvénytelen; készítsen újat.",
    tooMany: "A Misszió túllépi az előnézeti korlátot. Válasszon egy kapcsolatot.",
    summary: "Előnézeti összesítés", contacts: "Kapcsolatok", eligibleContacts: "Jogosult kapcsolatok",
    eligibleActions: "Jogosult műveletek", skippedActions: "Kihagyott műveletek", noActions: "Nincs megerősíthető jogosult művelet.",
    actionCount: "művelet", condition: "Feltétel", status: "Eredmény", issues: "Kihagyás oka",
    conditionTrue: "IF igaz", conditionFalse: "IF hamis", conditionUnknown: "IF ismeretlen",
    acknowledge: "Áttekintettem a teljes listát, és értem, hogy a megerősítés egyszer feldolgozza a jelenleg igaz feltételeket. A korábban megkísérelt műveletek kimaradnak, és nem próbálkozik újra velük.",
    confirm: "Aktuális állapot feldolgozásának megerősítése", confirming: "Megerősítés…",
    complete: "Megerősítve. A felsorolt műveleteket feldolgozásra elfogadtuk.", queued: "Sorba állítva",
    deferred: "A meglévő Mentés folyamatra halasztva",
    noEligible: "Az előnézetben nincs jogosult művelet, ezért a megerősítés nem érhető el.",
    ready: "Jogosult", skipped: "Kihagyva", immediate: "Azonnali feldolgozás",
    batch: "Kötegelt · a meglévő Mentés folyamatra vár",
    statusNames: {
      ready: "Feldolgozásra jogosult", batch_deferred: "A meglévő Mentés folyamatra vár",
      disabled: "Kikapcsolva", unsupported_action: "Nem támogatott művelet", invalid_condition: "Érvénytelen feltétel",
      missing_answer: "Hiányzó kötelező válasz", condition_false: "A feltétel hamis",
      waiting_transition: "Új, megfelelő átmenetre vár", already_executed: "Már rögzítve — nem ismétlődik",
      background_baseline: "Alapállapot — nincs művelet", pending: "Függőben", indeterminate: "Nem meghatározható",
      succeeded: "Sikeres", failed: "Sikertelen", superseded: "Felváltva",
    },
    actionNames: {
      assign_task: "Feladat hozzárendelése", send_email: "E-mail küldése", update_record: "Rekord frissítése",
      send_email_group: "Csoportos e-mail küldése", notify_email: "Értesítő e-mail küldése", send_sms: "SMS küldése",
      send_contact_email: "E-mail a kapcsolatnak", set_contact_status: "Kapcsolati állapot beállítása",
      set_callback: "Visszahívás ütemezése", notify_role: "Szerepkör értesítése", sys_webhook: "Rendszer-webhook",
    },
    issueNames: {
      native_config: "A művelet beállítása hiányos vagy érvénytelen", owner_required: "Hiányzik a kötelező tulajdonos vagy szerepkör",
      invalid_condition: "Az IF-feltétel érvénytelen", unsupported_action: "A művelet nem támogatott",
      missing_answer: "Hiányzik a kötelező válasz", invalid_template: "A kötelező sablon hiányzik vagy érvénytelen",
      missing_target: "A kötelező cél hiányzik vagy érvénytelen", revision_conflict: "A beállítás megváltozott",
      previous_attempt: "A műveletet korábban már megkísérelték; nem próbáljuk újra",
    },
    unknownStatus: "Nem jogosult", unknownAction: "Művelet", unknownIssue: "A művelet nem dolgozható fel",
  },
  ro: {
    title: "Procesează o singură dată starea curentă",
    intro: "Verificați mai întâi previzualizarea doar în citire. Pot fi confirmate numai acțiunile eligibile afișate mai jos.",
    scopeLabel: "Domeniul previzualizării", contactScope: "Un singur contact selectat", missionScope: "Întreaga Misiune",
    missionCaution: "Include toate contactele eligibile din Misiune (maximum 500). Verificați fiecare rând înainte de confirmare.",
    transitionNote: "Această procesare unică evaluează condițiile adevărate acum. Tranzițiile viitoare false → true rămân active; acțiunile încercate anterior sunt excluse și nu se reîncearcă. Acțiunile grupate așteaptă fluxul existent de Salvare.",
    noContact: "Selectați un contact înainte de previzualizare. Domeniul nu trece niciodată automat la întreaga Misiune.",
    preview: "Generează previzualizare doar în citire", refreshing: "Se generează previzualizarea…",
    previewError: "Previzualizarea nu a putut fi încărcată. Nimic nu a fost pus în coadă sau executat.",
    confirmError: "Confirmarea nu a putut fi finalizată. Reîmprospătați previzualizarea înainte de a încerca din nou.",
    previewChanged: "Configurația sau starea curentă s-a schimbat. Previzualizarea nu mai este validă; generați una nouă.",
    tooMany: "Misiunea depășește limita previzualizării. Selectați un singur contact.",
    summary: "Totaluri previzualizare", contacts: "Contacte", eligibleContacts: "Contacte eligibile",
    eligibleActions: "Acțiuni eligibile", skippedActions: "Acțiuni omise", noActions: "Nu există acțiuni eligibile de confirmat.",
    actionCount: "acțiuni", condition: "Condiție", status: "Rezultat", issues: "Motivul omiterii",
    conditionTrue: "IF adevărat", conditionFalse: "IF fals", conditionUnknown: "IF necunoscut",
    acknowledge: "Am verificat întreaga listă și înțeleg că confirmarea procesează o singură dată condițiile adevărate în prezent. Acțiunile încercate anterior sunt excluse și nu se reîncearcă.",
    confirm: "Confirmă procesarea stării curente", confirming: "Se confirmă…",
    complete: "Confirmat. Acțiunile afișate au fost acceptate pentru procesare.", queued: "Puse în coadă",
    deferred: "Amânate până la fluxul existent de Salvare",
    noEligible: "Nu există acțiuni eligibile în această previzualizare, deci confirmarea nu este disponibilă.",
    ready: "Eligibilă", skipped: "Omisă", immediate: "Procesare imediată",
    batch: "Grupat · așteaptă fluxul existent de Salvare",
    statusNames: {
      ready: "Eligibilă pentru procesare", batch_deferred: "Așteaptă fluxul existent de Salvare",
      disabled: "Dezactivată", unsupported_action: "Acțiune neacceptată", invalid_condition: "Condiție invalidă",
      missing_answer: "Lipsește răspunsul obligatoriu", condition_false: "Condiția este falsă",
      waiting_transition: "Așteaptă o nouă tranziție eligibilă", already_executed: "Deja înregistrată — nu se repetă",
      background_baseline: "Valoare de bază — fără acțiune", pending: "În așteptare", indeterminate: "Nu se poate determina",
      succeeded: "Reușită", failed: "Eșuată", superseded: "Înlocuită",
    },
    actionNames: {
      assign_task: "Atribuire sarcină", send_email: "Trimite e-mail", update_record: "Actualizează înregistrarea",
      send_email_group: "Trimite e-mail de grup", notify_email: "Trimite e-mail de notificare", send_sms: "Trimite SMS",
      send_contact_email: "E-mail către contact", set_contact_status: "Setează statusul contactului",
      set_callback: "Programează apel de revenire", notify_role: "Notifică rolul", sys_webhook: "Webhook de sistem",
    },
    issueNames: {
      native_config: "Configurația acțiunii este incompletă sau invalidă", owner_required: "Lipsește proprietarul sau rolul obligatoriu",
      invalid_condition: "Condiția IF este invalidă", unsupported_action: "Acțiunea nu este acceptată",
      missing_answer: "Lipsește răspunsul obligatoriu", invalid_template: "Șablonul obligatoriu lipsește sau este invalid",
      missing_target: "Ținta obligatorie lipsește sau este invalidă", revision_conflict: "Configurația s-a schimbat",
      previous_attempt: "Acțiunea a fost încercată anterior și nu va fi reîncercată",
    },
    unknownStatus: "Neeligibilă", unknownAction: "Acțiune", unknownIssue: "Acțiunea nu poate fi procesată",
  },
  it: {
    title: "Elabora una volta lo stato corrente",
    intro: "Esamina prima l'anteprima in sola lettura. Puoi confermare solo le azioni idonee elencate qui sotto.",
    scopeLabel: "Ambito anteprima", contactScope: "Un solo contatto selezionato", missionScope: "Intera Missione",
    missionCaution: "Include tutti i contatti idonei della Missione (massimo 500). Esamina ogni riga prima di confermare.",
    transitionNote: "Questa elaborazione una tantum valuta le condizioni attualmente vere. Le future transizioni false → true restano attive; le azioni già tentate sono escluse e non vengono ritentate. Le azioni batch attendono il flusso di Salvataggio esistente.",
    noContact: "Seleziona un contatto prima dell'anteprima. L'ambito non passa mai automaticamente all'intera Missione.",
    preview: "Crea anteprima in sola lettura", refreshing: "Creazione anteprima…",
    previewError: "Impossibile caricare l'anteprima. Non è stata accodata né eseguita alcuna azione.",
    confirmError: "Impossibile completare la conferma. Aggiorna l'anteprima prima di riprovare.",
    previewChanged: "La configurazione o lo stato corrente è cambiato. L'anteprima non è più valida; creane una nuova.",
    tooMany: "La Missione supera il limite dell'anteprima. Seleziona un contatto.",
    summary: "Totali anteprima", contacts: "Contatti", eligibleContacts: "Contatti idonei",
    eligibleActions: "Azioni idonee", skippedActions: "Azioni ignorate", noActions: "Nessuna azione idonea da confermare.",
    actionCount: "azioni", condition: "Condizione", status: "Esito", issues: "Motivo esclusione",
    conditionTrue: "IF vero", conditionFalse: "IF falso", conditionUnknown: "IF sconosciuto",
    acknowledge: "Ho esaminato l'elenco completo e comprendo che la conferma elabora una sola volta le condizioni attualmente vere. Le azioni già tentate sono escluse e non vengono ritentate.",
    confirm: "Conferma elaborazione stato corrente", confirming: "Conferma in corso…",
    complete: "Confermato. Le azioni elencate sono state accettate per l'elaborazione.", queued: "Accodate",
    deferred: "Rinviate al flusso di Salvataggio esistente",
    noEligible: "Non ci sono azioni idonee in questa anteprima, quindi la conferma non è disponibile.",
    ready: "Idonea", skipped: "Ignorata", immediate: "Elaborazione immediata",
    batch: "Batch · in attesa del flusso di Salvataggio esistente",
    statusNames: {
      ready: "Idonea all'elaborazione", batch_deferred: "Attende il flusso di Salvataggio esistente",
      disabled: "Disattivata", unsupported_action: "Azione non supportata", invalid_condition: "Condizione non valida",
      missing_answer: "Risposta obbligatoria mancante", condition_false: "La condizione è falsa",
      waiting_transition: "In attesa di una nuova transizione valida", already_executed: "Già registrata — non viene ripetuta",
      background_baseline: "Baseline — nessuna azione", pending: "In attesa", indeterminate: "Non determinabile",
      succeeded: "Completata", failed: "Non riuscita", superseded: "Sostituita",
    },
    actionNames: {
      assign_task: "Assegna attività", send_email: "Invia e-mail", update_record: "Aggiorna record",
      send_email_group: "Invia e-mail di gruppo", notify_email: "Invia e-mail di notifica", send_sms: "Invia SMS",
      send_contact_email: "Invia e-mail al contatto", set_contact_status: "Imposta stato contatto",
      set_callback: "Pianifica richiamata", notify_role: "Notifica il ruolo", sys_webhook: "Webhook di sistema",
    },
    issueNames: {
      native_config: "Configurazione azione incompleta o non valida", owner_required: "Manca il proprietario o il ruolo obbligatorio",
      invalid_condition: "La condizione IF non è valida", unsupported_action: "L'azione non è supportata",
      missing_answer: "Manca una risposta obbligatoria", invalid_template: "Il modello obbligatorio manca o non è valido",
      missing_target: "La destinazione obbligatoria manca o non è valida", revision_conflict: "La configurazione è cambiata",
      previous_attempt: "Azione già tentata: non verrà ripetuta",
    },
    unknownStatus: "Non idonea", unknownAction: "Azione", unknownIssue: "Impossibile elaborare l'azione",
  },
  de: {
    title: "Aktuellen Stand einmalig verarbeiten",
    intro: "Prüfen Sie zuerst die schreibgeschützte Vorschau. Bestätigt werden können nur die unten als geeignet aufgeführten Aktionen.",
    scopeLabel: "Vorschauumfang", contactScope: "Ein ausgewählter Kontakt", missionScope: "Gesamte Mission",
    missionCaution: "Enthält alle geeigneten Kontakte der Mission (höchstens 500). Prüfen Sie vor der Bestätigung jede Zeile.",
    transitionNote: "Dieser einmalige Durchlauf wertet aktuell wahre Bedingungen aus. Zukünftige false → true-Übergänge bleiben aktiv; bereits versuchte Aktionen sind ausgeschlossen und werden nicht erneut versucht. Stapelaktionen warten auf den bestehenden Speichern-Ablauf.",
    noContact: "Wählen Sie vor der Vorschau einen Kontakt. Es wird niemals automatisch auf die gesamte Mission gewechselt.",
    preview: "Schreibgeschützte Vorschau erstellen", refreshing: "Vorschau wird erstellt…",
    previewError: "Die Vorschau konnte nicht geladen werden. Es wurde nichts eingereiht oder ausgeführt.",
    confirmError: "Die Bestätigung konnte nicht abgeschlossen werden. Aktualisieren Sie die Vorschau und versuchen Sie es erneut.",
    previewChanged: "Konfiguration oder aktueller Stand wurde geändert. Die Vorschau ist ungültig; erstellen Sie eine neue.",
    tooMany: "Die Mission überschreitet das Vorschau-Limit. Wählen Sie einen Kontakt aus.",
    summary: "Vorschauübersicht", contacts: "Kontakte", eligibleContacts: "Geeignete Kontakte",
    eligibleActions: "Geeignete Aktionen", skippedActions: "Übersprungene Aktionen", noActions: "Keine geeigneten Aktionen zur Bestätigung.",
    actionCount: "Aktionen", condition: "Bedingung", status: "Ergebnis", issues: "Grund für Überspringen",
    conditionTrue: "IF wahr", conditionFalse: "IF falsch", conditionUnknown: "IF unbekannt",
    acknowledge: "Ich habe die vollständige Liste geprüft und verstanden, dass die Bestätigung aktuell wahre Bedingungen einmalig verarbeitet. Bereits versuchte Aktionen sind ausgeschlossen und werden nicht erneut versucht.",
    confirm: "Verarbeitung des aktuellen Stands bestätigen", confirming: "Wird bestätigt…",
    complete: "Bestätigt. Die aufgeführten Aktionen wurden zur Verarbeitung angenommen.", queued: "Eingereiht",
    deferred: "Bis zum bestehenden Speichern-Ablauf zurückgestellt",
    noEligible: "In dieser Vorschau gibt es keine geeigneten Aktionen; die Bestätigung ist daher nicht verfügbar.",
    ready: "Geeignet", skipped: "Übersprungen", immediate: "Sofortige Verarbeitung",
    batch: "Stapel · wartet auf den bestehenden Speichern-Ablauf",
    statusNames: {
      ready: "Zur Verarbeitung geeignet", batch_deferred: "Wartet auf bestehenden Speichern-Ablauf",
      disabled: "Deaktiviert", unsupported_action: "Nicht unterstützte Aktion", invalid_condition: "Ungültige Bedingung",
      missing_answer: "Erforderliche Antwort fehlt", condition_false: "Bedingung ist falsch",
      waiting_transition: "Wartet auf einen neuen passenden Übergang", already_executed: "Bereits erfasst — keine Wiederholung",
      background_baseline: "Ausgangswert — keine Aktion", pending: "Ausstehend", indeterminate: "Nicht bestimmbar",
      succeeded: "Erfolgreich", failed: "Fehlgeschlagen", superseded: "Abgelöst",
    },
    actionNames: {
      assign_task: "Aufgabe zuweisen", send_email: "E-Mail senden", update_record: "Datensatz aktualisieren",
      send_email_group: "Gruppen-E-Mail senden", notify_email: "Benachrichtigungs-E-Mail senden", send_sms: "SMS senden",
      send_contact_email: "E-Mail an Kontakt", set_contact_status: "Kontaktstatus festlegen",
      set_callback: "Rückruf planen", notify_role: "Rolle benachrichtigen", sys_webhook: "System-Webhook",
    },
    issueNames: {
      native_config: "Aktionskonfiguration ist unvollständig oder ungültig", owner_required: "Erforderlicher Eigentümer oder Rolle fehlt",
      invalid_condition: "Die IF-Bedingung ist ungültig", unsupported_action: "Diese Aktion wird nicht unterstützt",
      missing_answer: "Eine erforderliche Antwort fehlt", invalid_template: "Eine erforderliche Vorlage fehlt oder ist ungültig",
      missing_target: "Ein erforderliches Ziel fehlt oder ist ungültig", revision_conflict: "Konfiguration wurde geändert",
      previous_attempt: "Aktion wurde bereits versucht und wird nicht erneut versucht",
    },
    unknownStatus: "Nicht geeignet", unknownAction: "Aktion", unknownIssue: "Aktion kann nicht verarbeitet werden",
  },
};

export function getAutomaticInitialCopy(locale: string): AutomaticInitialCopy {
  return copy[locale] || copy.en;
}

