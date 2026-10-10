import type { Locale } from "./translations";

const keys = [
  "routingTitle", "routingSubtitle", "requestTypes", "addType", "enabledRouting", "manual",
  "sharedHint", "recipientsUnavailable", "replaceTitle", "replaceBody", "replace", "keep",
  "groups", "colleagues", "preview", "newType", "centerTitle", "centerSubtitle", "myRequests",
  "directMessages", "newRequest", "taskScope", "privateScope", "history", "created", "discussion",
  "discussionHint", "noComments", "taskMessage", "addComment", "privateHint", "privateMessage",
  "offlineHint", "loadFailed", "saveFailed", "noRequests", "clearFilters", "generalRequest", "handler", "unsaved", "unsavedHint", "send",
] as const;
export type TaskCommunicationCopy = Record<typeof keys[number], string>;
function copy(values: string[]): TaskCommunicationCopy {
  if (values.length !== keys.length) throw new Error("Incomplete task communication translations");
  return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as TaskCommunicationCopy;
}
export const taskCommunicationTranslations: Record<Locale, TaskCommunicationCopy> = {
  en: copy([
    "Request routing", "Choose default groups, colleagues or both for each request type.", "Request types", "Add type", "Default routing is active", "No default recipients — select recipients manually.",
    "One shared request and discussion, not separate copies.", "Some selected recipients are unavailable. Review the selection before sending.", "Replace manually selected recipients?", "Changing the type can replace your recipient selection. Your title and message will stay unchanged.", "Use type defaults", "Keep my recipients",
    "Groups", "Colleagues", "Agent preview", "New request type", "Communication center", "Follow your requests and conversations with colleagues.", "My requests",
    "Direct messages", "New request", "Discussion belongs to this task", "Private conversation · outside tasks", "Task history", "Request created", "Task discussion",
    "Visible to authorized participants of this request.", "No replies yet.", "Write a message for this task…", "Add comment", "Direct messages are not part of a task discussion.", "Write a private message…",
    "Chat is disconnected. Your draft is saved here; wait for reconnection.", "Unable to load data. Try again.", "Unable to save or confirm delivery. Your draft has been kept.", "No requests found.", "Clear filters", "General request", "Handled by", "Discard unsaved changes?", "The edits to this request type have not been saved.", "Send",
  ]),
  sk: copy([
    "Smerovanie požiadaviek", "Vyberte predvolené skupiny, kolegov alebo ich kombináciu podľa typu požiadavky.", "Typy požiadaviek", "Pridať typ", "Predvolené smerovanie je aktívne", "Bez predvolených príjemcov — príjemcov vyberte ručne.",
    "Jedna spoločná požiadavka a diskusia, nie samostatné kópie.", "Niektorí vybraní príjemcovia nie sú dostupní. Pred odoslaním skontrolujte výber.", "Nahradiť ručne vybraných príjemcov?", "Zmena typu môže nahradiť váš výber príjemcov. Nadpis a správa zostanú nezmenené.", "Použiť príjemcov typu", "Ponechať môj výber",
    "Skupiny", "Kolegovia", "Náhľad pre agenta", "Nový typ požiadavky", "Centrum komunikácie", "Sledujte svoje požiadavky a rozhovory s kolegami.", "Moje požiadavky",
    "Priame správy", "Nová požiadavka", "Diskusia patrí k tejto úlohe", "Súkromný rozhovor · mimo úloh", "História úlohy", "Požiadavka vytvorená", "Diskusia k úlohe",
    "Viditeľné pre oprávnených účastníkov tejto požiadavky.", "Zatiaľ bez odpovedí.", "Napísať do diskusie k tejto úlohe…", "Pridať komentár", "Priame správy nie sú súčasťou diskusie k úlohe.", "Napísať súkromnú správu…",
    "Chat nie je pripojený. Rozpísaná správa zostáva tu; počkajte na obnovenie spojenia.", "Údaje sa nepodarilo načítať. Skúste znova.", "Uloženie alebo doručenie sa nepodarilo potvrdiť. Rozpísaná správa zostala zachovaná.", "Nenašli sa požiadavky.", "Zrušiť filtre", "Všeobecná požiadavka", "Vybavuje", "Zahodiť neuložené zmeny?", "Úpravy tohto typu požiadavky zatiaľ neboli uložené.", "Odoslať",
  ]),
  cs: copy([
    "Směrování požadavků", "Vyberte výchozí skupiny, kolegy nebo jejich kombinaci podle typu požadavku.", "Typy požadavků", "Přidat typ", "Výchozí směrování je aktivní", "Bez výchozích příjemců — příjemce vyberte ručně.",
    "Jeden společný požadavek a diskuse, nikoli samostatné kopie.", "Někteří vybraní příjemci nejsou dostupní. Před odesláním zkontrolujte výběr.", "Nahradit ručně vybrané příjemce?", "Změna typu může nahradit váš výběr příjemců. Nadpis a zpráva zůstanou nezměněné.", "Použít příjemce typu", "Ponechat můj výběr",
    "Skupiny", "Kolegové", "Náhled pro agenta", "Nový typ požadavku", "Centrum komunikace", "Sledujte své požadavky a rozhovory s kolegy.", "Moje požadavky",
    "Přímé zprávy", "Nový požadavek", "Diskuse patří k tomuto úkolu", "Soukromý rozhovor · mimo úkoly", "Historie úkolu", "Požadavek vytvořen", "Diskuse k úkolu",
    "Viditelné pro oprávněné účastníky tohoto požadavku.", "Zatím bez odpovědí.", "Napsat do diskuse k tomuto úkolu…", "Přidat komentář", "Přímé zprávy nejsou součástí diskuse k úkolu.", "Napsat soukromou zprávu…",
    "Chat není připojen. Rozepsaná zpráva zůstává zde; počkejte na obnovení spojení.", "Údaje se nepodařilo načíst. Zkuste znovu.", "Uložení nebo doručení se nepodařilo potvrdit. Rozepsaná zpráva byla zachována.", "Nebyly nalezeny požadavky.", "Zrušit filtry", "Obecný požadavek", "Vyřizuje", "Zahodit neuložené změny?", "Úpravy tohoto typu požadavku zatím nebyly uloženy.", "Odeslat",
  ]),
  hu: copy([
    "Kérések irányítása", "Válasszon alapértelmezett csoportokat, munkatársakat vagy mindkettőt a kérés típusához.", "Kéréstípusok", "Típus hozzáadása", "Az alapértelmezett irányítás aktív", "Nincs alapértelmezett címzett — válasszon kézzel.",
    "Egy közös kérés és beszélgetés, nem külön másolatok.", "Néhány kiválasztott címzett nem érhető el. Küldés előtt ellenőrizze a választást.", "Lecseréli a kézzel választott címzetteket?", "A típusváltás lecserélheti a címzetteket. A cím és az üzenet változatlan marad.", "Típus címzettjeinek használata", "Saját választás megtartása",
    "Csoportok", "Munkatársak", "Ügynöki előnézet", "Új kéréstípus", "Kommunikációs központ", "Kövesse kéréseit és a munkatársakkal folytatott beszélgetéseket.", "Saját kérések",
    "Közvetlen üzenetek", "Új kérés", "A beszélgetés ehhez a feladathoz tartozik", "Privát beszélgetés · feladatokon kívül", "Feladatelőzmények", "Kérés létrehozva", "Feladat megbeszélése",
    "A kérés jogosult résztvevői számára látható.", "Még nincs válasz.", "Üzenet írása ehhez a feladathoz…", "Hozzászólás", "A közvetlen üzenetek nem részei a feladat megbeszélésének.", "Privát üzenet írása…",
    "A chat nem csatlakozik. A piszkozat megmarad; várjon az újracsatlakozásra.", "Az adatok nem tölthetők be. Próbálja újra.", "A mentés vagy kézbesítés nem igazolható. A piszkozat megmaradt.", "Nem található kérés.", "Szűrők törlése", "Általános kérés", "Ügyintéző", "Elveti a nem mentett módosításokat?", "A kéréstípus módosításai még nincsenek mentve.", "Küldés",
  ]),
  ro: copy([
    "Rutarea solicitărilor", "Alegeți grupuri, colegi sau ambele ca destinatari impliciți pentru fiecare tip.", "Tipuri de solicitări", "Adaugă tip", "Rutarea implicită este activă", "Fără destinatari impliciți — selectați manual.",
    "O singură solicitare și discuție comună, nu copii separate.", "Unii destinatari selectați nu sunt disponibili. Verificați înainte de trimitere.", "Înlocuiți destinatarii selectați manual?", "Schimbarea tipului poate înlocui destinatarii. Titlul și mesajul rămân neschimbate.", "Folosește destinatarii tipului", "Păstrează selecția mea",
    "Grupuri", "Colegi", "Previzualizare pentru agent", "Tip nou de solicitare", "Centrul de comunicare", "Urmăriți solicitările și conversațiile cu colegii.", "Solicitările mele",
    "Mesaje directe", "Solicitare nouă", "Discuția aparține acestei sarcini", "Conversație privată · în afara sarcinilor", "Istoricul sarcinii", "Solicitare creată", "Discuția sarcinii",
    "Vizibilă participanților autorizați ai solicitării.", "Încă nu există răspunsuri.", "Scrieți în discuția acestei sarcini…", "Adaugă comentariu", "Mesajele directe nu fac parte din discuția unei sarcini.", "Scrieți un mesaj privat…",
    "Chatul este deconectat. Ciorna rămâne aici; așteptați reconectarea.", "Datele nu au putut fi încărcate. Încercați din nou.", "Salvarea sau livrarea nu a putut fi confirmată. Ciorna a fost păstrată.", "Nu s-au găsit solicitări.", "Șterge filtrele", "Solicitare generală", "Gestionată de", "Renunțați la modificările nesalvate?", "Modificările acestui tip de solicitare nu au fost încă salvate.", "Trimite",
  ]),
  it: copy([
    "Instradamento richieste", "Scegli gruppi, colleghi o entrambi come destinatari predefiniti per ogni tipo.", "Tipi di richiesta", "Aggiungi tipo", "L'instradamento predefinito è attivo", "Nessun destinatario predefinito — seleziona manualmente.",
    "Un'unica richiesta e discussione condivisa, non copie separate.", "Alcuni destinatari selezionati non sono disponibili. Verifica prima di inviare.", "Sostituire i destinatari scelti manualmente?", "Cambiare tipo può sostituire i destinatari. Titolo e messaggio resteranno invariati.", "Usa i destinatari del tipo", "Mantieni la mia selezione",
    "Gruppi", "Colleghi", "Anteprima per l'agente", "Nuovo tipo di richiesta", "Centro comunicazioni", "Segui le tue richieste e le conversazioni con i colleghi.", "Le mie richieste",
    "Messaggi diretti", "Nuova richiesta", "La discussione appartiene a questa attività", "Conversazione privata · fuori dalle attività", "Cronologia attività", "Richiesta creata", "Discussione attività",
    "Visibile ai partecipanti autorizzati della richiesta.", "Nessuna risposta ancora.", "Scrivi nella discussione di questa attività…", "Aggiungi commento", "I messaggi diretti non fanno parte della discussione di un'attività.", "Scrivi un messaggio privato…",
    "Chat disconnessa. La bozza resta qui; attendi la riconnessione.", "Impossibile caricare i dati. Riprova.", "Impossibile confermare il salvataggio o la consegna. La bozza è stata mantenuta.", "Nessuna richiesta trovata.", "Cancella filtri", "Richiesta generale", "Gestita da", "Eliminare le modifiche non salvate?", "Le modifiche a questo tipo di richiesta non sono ancora state salvate.", "Invia",
  ]),
  de: copy([
    "Anfragenzuordnung", "Wählen Sie Standardgruppen, Kollegen oder beides für jeden Anfragetyp.", "Anfragetypen", "Typ hinzufügen", "Standardzuordnung ist aktiv", "Keine Standardempfänger — bitte manuell auswählen.",
    "Eine gemeinsame Anfrage und Diskussion, keine getrennten Kopien.", "Einige ausgewählte Empfänger sind nicht verfügbar. Prüfen Sie die Auswahl vor dem Senden.", "Manuell ausgewählte Empfänger ersetzen?", "Ein Typwechsel kann die Empfänger ersetzen. Titel und Nachricht bleiben unverändert.", "Empfänger des Typs verwenden", "Meine Auswahl behalten",
    "Gruppen", "Kollegen", "Agentenvorschau", "Neuer Anfragetyp", "Kommunikationszentrum", "Verfolgen Sie Ihre Anfragen und Gespräche mit Kollegen.", "Meine Anfragen",
    "Direktnachrichten", "Neue Anfrage", "Die Diskussion gehört zu dieser Aufgabe", "Privates Gespräch · außerhalb von Aufgaben", "Aufgabenverlauf", "Anfrage erstellt", "Aufgabendiskussion",
    "Sichtbar für berechtigte Teilnehmer dieser Anfrage.", "Noch keine Antworten.", "Nachricht zu dieser Aufgabe schreiben…", "Kommentar hinzufügen", "Direktnachrichten sind nicht Teil einer Aufgabendiskussion.", "Private Nachricht schreiben…",
    "Chat ist nicht verbunden. Ihr Entwurf bleibt hier; warten Sie auf die Wiederverbindung.", "Daten konnten nicht geladen werden. Versuchen Sie es erneut.", "Speicherung oder Zustellung konnte nicht bestätigt werden. Der Entwurf wurde behalten.", "Keine Anfragen gefunden.", "Filter löschen", "Allgemeine Anfrage", "Bearbeitet von", "Ungespeicherte Änderungen verwerfen?", "Die Änderungen an diesem Anfragetyp wurden noch nicht gespeichert.", "Senden",
  ]),
};
