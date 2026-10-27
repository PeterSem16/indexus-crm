import type { EligibilityHistory } from "@shared/automation-eligibility";

export type EligibilityHistoryCopy = {
  currentTitle: string; historyTitle: string; historyHint: string; permissionUnknown: string;
  historyStatus: Record<EligibilityHistory["status"], string>;
  changed: string; unchanged: string; version: string; eventAt: string; recordedAt: string;
  channels: string; countries: string; allCountries: string; activation: string; noActivation: string;
  state: string; enabled: string; paused: string; filters: string; filtersHint: string;
  mailboxes: string; senders: string; textSearch: string; conditions: string;
};
export const eligibilityHistoryTranslations: Record<"en" | "sk" | "cs" | "hu" | "ro" | "it" | "de", EligibilityHistoryCopy> = {
  en: {
    currentTitle: "Current saved rule and current access", historyTitle: "Settings at the stored source event",
    historyHint: "Versions are captured when settings change and bound when the source event is stored. The event time is not proof of the original email receipt time. Older events are not reconstructed from today's settings.",
    permissionUnknown: "Historical access permissions and source-filter matches are not recorded. Current access does not prove past access. A verified version confirms settings only, not eligibility or execution.",
    historyStatus: { verified: "Verified historical settings", missing: "Historical settings are missing. No verified version was bound to this event.", event_missing: "No stored event; historical settings cannot be verified.", unavailable: "History is not disclosed because the source is unavailable or inaccessible." },
    changed: "The current input settings differ from this version.", unchanged: "The current input settings match this version.",
    version: "Version", eventAt: "Stored event time", recordedAt: "Version recorded from",
    channels: "Channels", countries: "Countries", allCountries: "All countries", activation: "Listening / reviewed activation",
    noActivation: "No explicit activation boundary", state: "Rule state", enabled: "Enabled", paused: "Paused",
    filters: "Filter summary", filtersHint: "Only counts and the presence of filters are shown. Addresses, mailbox identities, literal text and IF values are not copied into history. Definition fingerprints detect changes without exposing these values.",
    mailboxes: "Selected mailboxes", senders: "Sender filters", textSearch: "Literal-text filter", conditions: "IF filter",
  },
  sk: {
    currentTitle: "Dnešné uložené pravidlo a dnešný prístup", historyTitle: "Nastavenie pri uloženej zdrojovej udalosti",
    historyHint: "Verzie sa zachytávajú pri zmene nastavení a priraďujú pri uložení zdrojovej udalosti. Čas udalosti nedokazuje pôvodný čas prijatia e-mailu. Staršie udalosti sa nerekonštruujú z dnešných nastavení.",
    permissionUnknown: "Historické oprávnenia a zhoda zdroja s filtrami nie sú zaznamenané. Dnešný prístup nedokazuje minulý. Overená verzia potvrdzuje iba nastavenie, nie zaradenie ani vykonanie pravidla.",
    historyStatus: { verified: "Overené historické nastavenie", missing: "Historické nastavenie chýba. K udalosti nebola priradená overená verzia.", event_missing: "Uložená udalosť chýba; historické nastavenie nemožno overiť.", unavailable: "História sa nezobrazuje, pretože zdroj nie je dostupný alebo k nemu nemáte prístup." },
    changed: "Dnešné vstupné nastavenie sa od tejto verzie líši.", unchanged: "Dnešné vstupné nastavenie zodpovedá tejto verzii.",
    version: "Verzia", eventAt: "Čas uloženej udalosti", recordedAt: "Verzia zaznamenaná od",
    channels: "Kanály", countries: "Krajiny", allCountries: "Všetky krajiny", activation: "Začiatok sledovania / schválená aktivácia",
    noActivation: "Bez výslovnej hranice aktivácie", state: "Stav pravidla", enabled: "Zapnuté", paused: "Pozastavené",
    filters: "Prehľad filtrov", filtersHint: "Zobrazujú sa iba počty a prítomnosť filtrov. Adresy, identity schránok, hľadaný text ani hodnoty IF sa do histórie nekopírujú. Odtlačok definície rozpozná zmenu bez odhalenia týchto hodnôt.",
    mailboxes: "Vybrané schránky", senders: "Filtre odosielateľov", textSearch: "Filter doslovného textu", conditions: "Filter IF",
  },
  cs: {
    currentTitle: "Dnešní uložené pravidlo a dnešní přístup", historyTitle: "Nastavení při uložené zdrojové události",
    historyHint: "Verze se zachycují při změně nastavení a přiřazují při uložení zdrojové události. Čas události nedokazuje původní čas přijetí e-mailu. Starší události se nerekonstruují z dnešních nastavení.",
    permissionUnknown: "Historická oprávnění a shoda zdroje s filtry nejsou zaznamenány. Dnešní přístup nedokazuje minulý. Ověřená verze potvrzuje pouze nastavení, nikoli zařazení ani provedení pravidla.",
    historyStatus: { verified: "Ověřené historické nastavení", missing: "Historické nastavení chybí. K události nebyla přiřazena ověřená verze.", event_missing: "Uložená událost chybí; historické nastavení nelze ověřit.", unavailable: "Historie se nezobrazuje, protože zdroj není dostupný nebo k němu nemáte přístup." },
    changed: "Dnešní vstupní nastavení se od této verze liší.", unchanged: "Dnešní vstupní nastavení odpovídá této verzi.",
    version: "Verze", eventAt: "Čas uložené události", recordedAt: "Verze zaznamenaná od",
    channels: "Kanály", countries: "Země", allCountries: "Všechny země", activation: "Začátek sledování / schválená aktivace",
    noActivation: "Bez výslovné hranice aktivace", state: "Stav pravidla", enabled: "Zapnuto", paused: "Pozastaveno",
    filters: "Přehled filtrů", filtersHint: "Zobrazují se pouze počty a přítomnost filtrů. Adresy, identity schránek, hledaný text ani hodnoty IF se do historie nekopírují. Otisk definice rozpozná změnu bez odhalení těchto hodnot.",
    mailboxes: "Vybrané schránky", senders: "Filtry odesílatelů", textSearch: "Filtr doslovného textu", conditions: "Filtr IF",
  },
  hu: {
    currentTitle: "Jelenlegi mentett szabály és hozzáférés", historyTitle: "A tárolt forráseseménykori beállítások",
    historyHint: "A verziók beállításváltozáskor készülnek, és a forrásesemény mentésekor kapcsolódnak. Az esemény ideje nem bizonyítja az e-mail eredeti érkezési idejét. A régi eseményeket nem rekonstruáljuk a mai beállításokból.",
    permissionUnknown: "A korábbi jogosultságok és szűrőegyezések nincsenek rögzítve. A mai hozzáférés nem bizonyítja a korábbit. Az ellenőrzött verzió csak a beállításokat igazolja, nem a jogosultságot vagy végrehajtást.",
    historyStatus: { verified: "Ellenőrzött korábbi beállítások", missing: "Hiányzó előzmények. Az eseményhez nem kapcsolódott ellenőrzött verzió.", event_missing: "Nincs tárolt esemény; a korábbi beállítások nem ellenőrizhetők.", unavailable: "Az előzmények nem láthatók, mert a forrás nem érhető el vagy nincs hozzáférése." },
    changed: "A jelenlegi bemeneti beállítások eltérnek ettől a verziótól.", unchanged: "A jelenlegi bemeneti beállítások megegyeznek ezzel a verzióval.",
    version: "Verzió", eventAt: "Tárolt esemény ideje", recordedAt: "Verzió rögzítésének kezdete",
    channels: "Csatornák", countries: "Országok", allCountries: "Minden ország", activation: "Figyelés kezdete / jóváhagyott aktiválás",
    noActivation: "Nincs kifejezett aktiválási határ", state: "Szabály állapota", enabled: "Aktív", paused: "Szüneteltetve",
    filters: "Szűrők összefoglalója", filtersHint: "Csak a szűrők száma és jelenléte látható. Címeket, postafiók-azonosságokat, keresett szöveget vagy IF-értékeket nem másolunk az előzményekbe. A definíció ujjlenyomata értékek felfedése nélkül érzékeli a változást.",
    mailboxes: "Kiválasztott postafiókok", senders: "Feladószűrők", textSearch: "Szó szerinti szövegszűrő", conditions: "IF-szűrő",
  },
  ro: {
    currentTitle: "Regula salvată și accesul actual", historyTitle: "Setări la evenimentul sursă stocat",
    historyHint: "Versiunile sunt înregistrate la schimbarea setărilor și asociate la stocarea evenimentului sursă. Ora evenimentului nu dovedește ora inițială a primirii e-mailului. Evenimentele vechi nu sunt reconstruite din setările actuale.",
    permissionUnknown: "Permisiunile istorice și potrivirile filtrelor nu sunt înregistrate. Accesul actual nu dovedește accesul trecut. O versiune verificată confirmă doar setările, nu eligibilitatea sau executarea.",
    historyStatus: { verified: "Setări istorice verificate", missing: "Setările istorice lipsesc. Nicio versiune verificată nu a fost asociată evenimentului.", event_missing: "Nu există eveniment stocat; setările istorice nu pot fi verificate.", unavailable: "Istoricul nu este afișat deoarece sursa nu este disponibilă sau accesibilă." },
    changed: "Setările actuale de intrare diferă de această versiune.", unchanged: "Setările actuale de intrare corespund acestei versiuni.",
    version: "Versiune", eventAt: "Ora evenimentului stocat", recordedAt: "Versiune înregistrată de la",
    channels: "Canale", countries: "Țări", allCountries: "Toate țările", activation: "Începutul urmăririi / activare aprobată",
    noActivation: "Fără limită explicită de activare", state: "Starea regulii", enabled: "Activată", paused: "În pauză",
    filters: "Rezumatul filtrelor", filtersHint: "Sunt afișate doar numerele și prezența filtrelor. Adresele, identitățile căsuțelor, textul căutat și valorile IF nu sunt copiate în istoric. Amprentele definiției detectează schimbări fără a dezvălui valorile.",
    mailboxes: "Căsuțe selectate", senders: "Filtre de expeditor", textSearch: "Filtru de text literal", conditions: "Filtru IF",
  },
  it: {
    currentTitle: "Regola salvata e accesso attuali", historyTitle: "Impostazioni all'evento sorgente archiviato",
    historyHint: "Le versioni sono registrate alle modifiche e associate quando viene archiviato l'evento sorgente. L'ora dell'evento non prova l'ora originale di ricezione dell'e-mail. Gli eventi precedenti non sono ricostruiti dalle impostazioni attuali.",
    permissionUnknown: "I permessi storici e le corrispondenze dei filtri non sono registrati. L'accesso attuale non prova quello passato. Una versione verificata conferma solo le impostazioni, non l'idoneità o l'esecuzione.",
    historyStatus: { verified: "Impostazioni storiche verificate", missing: "Impostazioni storiche mancanti. Nessuna versione verificata è stata associata all'evento.", event_missing: "Nessun evento archiviato; le impostazioni storiche non possono essere verificate.", unavailable: "La cronologia non è mostrata perché la sorgente non è disponibile o accessibile." },
    changed: "Le impostazioni di ingresso attuali differiscono da questa versione.", unchanged: "Le impostazioni di ingresso attuali corrispondono a questa versione.",
    version: "Versione", eventAt: "Ora dell'evento archiviato", recordedAt: "Versione registrata dal",
    channels: "Canali", countries: "Paesi", allCountries: "Tutti i paesi", activation: "Inizio ascolto / attivazione approvata",
    noActivation: "Nessun limite di attivazione esplicito", state: "Stato della regola", enabled: "Attiva", paused: "In pausa",
    filters: "Riepilogo filtri", filtersHint: "Sono mostrati solo conteggi e presenza dei filtri. Indirizzi, identità delle caselle, testo cercato e valori IF non vengono copiati nella cronologia. Le impronte della definizione rilevano modifiche senza esporre questi valori.",
    mailboxes: "Caselle selezionate", senders: "Filtri mittente", textSearch: "Filtro testo letterale", conditions: "Filtro IF",
  },
  de: {
    currentTitle: "Aktuell gespeicherte Regel und aktueller Zugriff", historyTitle: "Einstellungen beim gespeicherten Quellereignis",
    historyHint: "Versionen werden bei Änderungen erfasst und beim Speichern des Quellereignisses zugeordnet. Die Ereigniszeit belegt nicht die ursprüngliche E-Mail-Empfangszeit. Ältere Ereignisse werden nicht aus heutigen Einstellungen rekonstruiert.",
    permissionUnknown: "Historische Berechtigungen und Filtertreffer sind nicht erfasst. Heutiger Zugriff belegt keinen früheren Zugriff. Eine verifizierte Version bestätigt nur Einstellungen, nicht Berechtigung oder Ausführung.",
    historyStatus: { verified: "Verifizierte historische Einstellungen", missing: "Historische Einstellungen fehlen. Dem Ereignis wurde keine verifizierte Version zugeordnet.", event_missing: "Kein gespeichertes Ereignis; historische Einstellungen sind nicht verifizierbar.", unavailable: "Der Verlauf wird nicht angezeigt, da die Quelle nicht verfügbar oder nicht zugänglich ist." },
    changed: "Die aktuellen Eingangseinstellungen unterscheiden sich von dieser Version.", unchanged: "Die aktuellen Eingangseinstellungen entsprechen dieser Version.",
    version: "Version", eventAt: "Zeit des gespeicherten Ereignisses", recordedAt: "Version erfasst ab",
    channels: "Kanäle", countries: "Länder", allCountries: "Alle Länder", activation: "Überwachungsbeginn / genehmigte Aktivierung",
    noActivation: "Keine ausdrückliche Aktivierungsgrenze", state: "Regelstatus", enabled: "Aktiviert", paused: "Pausiert",
    filters: "Filterübersicht", filtersHint: "Nur Anzahl und Vorhandensein der Filter werden angezeigt. Adressen, Postfachidentitäten, Suchtext und IF-Werte werden nicht in den Verlauf kopiert. Definitionsfingerabdrücke erkennen Änderungen ohne diese Werte offenzulegen.",
    mailboxes: "Ausgewählte Postfächer", senders: "Absenderfilter", textSearch: "Wörtlicher Textfilter", conditions: "IF-Filter",
  },
};
