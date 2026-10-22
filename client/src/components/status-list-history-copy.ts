import { statusListHistoryFields, type StatusListHistoryField } from "@shared/status-list-history";

const languages = ["en", "sk", "cs", "hu", "ro", "it", "de"];
const text = (values: readonly string[], locale: string) => values[Math.max(0, languages.indexOf(locale))];
// One source for the IF selector, inline explanations, review and searchable manual.
const entries: Record<StatusListHistoryField, readonly string[]> = {
  "history.outreach_attempted": [
    "Outreach attempted|An outbound call was started, or an outbound email/SMS has status sent, delivered or failed. Drafts and queued messages do not count. This is not proof of contact.",
    "Pokus o oslovenie existuje|Začalo sa odchádzajúce volanie alebo má odchádzajúci e-mail/SMS stav odoslané, doručené či zlyhané. Koncepty a správy vo fronte sa nepočítajú. Nie je to dôkaz zastihnutia.",
    "Existuje pokus o oslovení|Začal odchozí hovor nebo má odchozí e-mail/SMS stav odesláno, doručeno či selhalo. Koncepty a zprávy ve frontě se nepočítají. Není to důkaz zastižení.",
    "Történt kapcsolatfelvételi kísérlet|Kimenő hívás indult, vagy kimenő e-mail/SMS elküldött, kézbesített vagy sikertelen állapotú. Piszkozat és várakozó üzenet nem számít. Ez nem bizonyít elérést.",
    "Există o încercare de contact|A început un apel de ieșire sau un e-mail/SMS de ieșire are starea trimis, livrat sau eșuat. Ciornele și mesajele în așteptare nu contează. Nu dovedește contactul.",
    "Esiste un tentativo di contatto|È iniziata una chiamata in uscita oppure un'e-mail/SMS in uscita risulta inviato, consegnato o fallito. Bozze e messaggi in coda non contano. Non prova il contatto.",
    "Kontaktversuch vorhanden|Ein ausgehender Anruf wurde gestartet oder eine ausgehende E-Mail/SMS ist gesendet, zugestellt oder fehlgeschlagen. Entwürfe und wartende Nachrichten zählen nicht. Kein Erreichbarkeitsnachweis.",
  ],
  "history.call_attempted": [
    "Outbound call attempted|At least one outbound call has a recorded start. Ringing or a failed attempt counts; an inbound call does not.",
    "Existuje pokus o odchádzajúci hovor|Aspoň jeden odchádzajúci hovor má zaznamenaný začiatok. Počíta sa aj zvonenie či neúspešný pokus; prichádzajúci hovor nie.",
    "Existuje pokus o odchozí hovor|Alespoň jeden odchozí hovor má zaznamenaný začátek. Počítá se i vyzvánění či neúspěšný pokus; příchozí hovor ne.",
    "Történt kimenő hívási kísérlet|Legalább egy kimenő hívás kezdete rögzített. A csengés és sikertelen kísérlet is számít; a bejövő hívás nem.",
    "Există un apel de ieșire încercat|Cel puțin un apel de ieșire are începutul înregistrat. Sunarea sau eșecul contează; un apel de intrare nu.",
    "Tentativo di chiamata in uscita|Almeno una chiamata in uscita ha un inizio registrato. Squillo e tentativi falliti contano; una chiamata in entrata no.",
    "Ausgehender Anruf versucht|Mindestens ein ausgehender Anruf hat einen erfassten Beginn. Klingeln und Fehlversuche zählen, eingehende Anrufe nicht.",
  ],
  "history.call_answered": [
    "Answered call recorded|An inbound/outbound call is answered or completed, has an answer time and at least 1 second duration. Forwarded calls are excluded because caller connection does not prove destination answer.",
    "Existuje prijatý hovor|Prichádzajúci/odchádzajúci hovor má stav answered/completed, čas prijatia a trvanie aspoň 1 sekundu. Presmerované hovory sa nepočítajú: spojenie volajúceho nedokazuje prijatie cieľom.",
    "Existuje přijatý hovor|Příchozí/odchozí hovor má stav answered/completed, čas přijetí a trvání alespoň 1 sekundu. Přesměrované hovory se nepočítají: spojení volajícího nedokazuje přijetí cílem.",
    "Van fogadott hívás|Bejövő/kimenő hívás answered/completed állapotú, válaszidővel és legalább 1 másodperces időtartammal. Átirányított hívások kizárva: a hívó kapcsolódása nem bizonyítja a cél válaszát.",
    "Există un apel preluat|Un apel de intrare/ieșire este answered/completed, are ora preluării și durează minimum 1 secundă. Apelurile redirecționate sunt excluse: conectarea apelantului nu dovedește răspunsul destinației.",
    "Esiste una chiamata risposta|Una chiamata in entrata/uscita è answered/completed, con ora di risposta e almeno 1 secondo di durata. Escluse le chiamate inoltrate: connettere il chiamante non prova la risposta della destinazione.",
    "Angenommener Anruf vorhanden|Ein ein-/ausgehender Anruf ist answered/completed, mit Antwortzeit und mindestens 1 Sekunde Dauer. Weiterleitungen sind ausgeschlossen: die Verbindung des Anrufers beweist keine Zielannahme.",
  ],
  "history.call_failed": [
    "Unsuccessful outbound call recorded|At least one outbound call ended failed, no_answer, busy, cancelled, or completed without answer time. This fact can coexist with a later successful call.",
    "Existuje neúspešný odchádzajúci hovor|Aspoň jeden odchádzajúci hovor skončil failed, no_answer, busy, cancelled alebo completed bez času prijatia. Môže súčasne existovať aj neskorší úspešný hovor.",
    "Existuje neúspěšný odchozí hovor|Alespoň jeden odchozí hovor skončil failed, no_answer, busy, cancelled nebo completed bez času přijetí. Současně může existovat i pozdější úspěšný hovor.",
    "Van sikertelen kimenő hívás|Legalább egy kimenő hívás failed, no_answer, busy, cancelled, vagy completed válaszidő nélkül. Későbbi sikeres hívással együtt is igaz lehet.",
    "Există un apel de ieșire nereușit|Un apel de ieșire s-a încheiat failed, no_answer, busy, cancelled sau completed fără ora preluării. Poate coexista cu un apel reușit ulterior.",
    "Esiste una chiamata in uscita non riuscita|Almeno una chiamata è terminata failed, no_answer, busy, cancelled o completed senza ora di risposta. Può coesistere con una chiamata successiva riuscita.",
    "Erfolgloser ausgehender Anruf vorhanden|Mindestens ein Anruf endete als failed, no_answer, busy, cancelled oder completed ohne Antwortzeit. Ein späterer erfolgreicher Anruf kann gleichzeitig vorliegen.",
  ],
  "history.email_sent": [
    "Email sent|At least one outbound email has status sent or delivered. Provider acceptance is not delivery or a reply; failed, draft and queued emails do not count.",
    "E-mail bol odoslaný|Aspoň jeden odchádzajúci e-mail má stav sent alebo delivered. Prijatie poskytovateľom nie je doručenie ani odpoveď; failed, koncepty a fronta sa nepočítajú.",
    "E-mail byl odeslán|Alespoň jeden odchozí e-mail má stav sent nebo delivered. Přijetí poskytovatelem není doručení ani odpověď; failed, koncepty a fronta se nepočítají.",
    "E-mail elküldve|Legalább egy kimenő e-mail sent vagy delivered állapotú. A szolgáltatói átvétel nem kézbesítés vagy válasz; hibás, piszkozat és várakozó levél nem számít.",
    "E-mail trimis|Cel puțin un e-mail de ieșire are starea sent sau delivered. Acceptarea de către furnizor nu înseamnă livrare sau răspuns; eșecurile, ciornele și coada nu contează.",
    "E-mail inviata|Almeno un'e-mail in uscita è sent o delivered. L'accettazione del fornitore non è consegna né risposta; errori, bozze e coda non contano.",
    "E-Mail gesendet|Mindestens eine ausgehende E-Mail ist sent oder delivered. Anbieterannahme ist weder Zustellung noch Antwort; Fehler, Entwürfe und Warteschlange zählen nicht.",
  ],
  "history.sms_sent": [
    "SMS sent|At least one outbound SMS has status sent or delivered. Sending is not a delivery receipt or a reply; failed, draft and queued SMS do not count.",
    "SMS bola odoslaná|Aspoň jedna odchádzajúca SMS má stav sent alebo delivered. Odoslanie nie je doručenka ani odpoveď; failed, koncepty a fronta sa nepočítajú.",
    "SMS byla odeslána|Alespoň jedna odchozí SMS má stav sent nebo delivered. Odeslání není doručenka ani odpověď; failed, koncepty a fronta se nepočítají.",
    "SMS elküldve|Legalább egy kimenő SMS sent vagy delivered állapotú. Az elküldés nem kézbesítési igazolás vagy válasz; hibás, piszkozat és várakozó SMS nem számít.",
    "SMS trimis|Cel puțin un SMS de ieșire are starea sent sau delivered. Trimiterea nu este confirmare de livrare sau răspuns; eșecurile, ciornele și coada nu contează.",
    "SMS inviato|Almeno un SMS in uscita è sent o delivered. L'invio non è ricevuta di consegna né risposta; errori, bozze e coda non contano.",
    "SMS gesendet|Mindestens eine ausgehende SMS ist sent oder delivered. Versand ist weder Zustellbestätigung noch Antwort; Fehler, Entwürfe und Warteschlange zählen nicht.",
  ],
  "history.email_reply": [
    "Incoming email recorded|An incoming email is recorded as received, delivered or read and attributed to this Mission and entity. This does not prove a human reply to a specific template; automatic replies may count.",
    "Existuje prijatý e-mail|Prichádzajúci e-mail má stav received, delivered alebo read a patrí tejto Mission a inštitúcii. Nedokazuje ľudskú odpoveď na konkrétnu šablónu; môže ísť aj o automatickú odpoveď.",
    "Existuje přijatý e-mail|Příchozí e-mail má stav received, delivered nebo read a patří této Mission a instituci. Nedokazuje lidskou odpověď na konkrétní šablonu; může jít i o automatickou odpověď.",
    "Van beérkezett e-mail|Bejövő e-mail received, delivered vagy read állapotú, ehhez a Missionhöz és intézményhez rendelve. Nem bizonyít emberi választ egy adott sablonra; automatikus válasz is számíthat.",
    "Există un e-mail primit|Un e-mail de intrare este received, delivered sau read și atribuit acestei Mission și entități. Nu dovedește un răspuns uman la un anumit șablon; pot conta răspunsurile automate.",
    "Esiste un'e-mail ricevuta|Un'e-mail in entrata è received, delivered o read e attribuita a questa Mission ed entità. Non prova una risposta umana a un modello specifico; può contare una risposta automatica.",
    "Eingehende E-Mail vorhanden|Eine eingehende E-Mail ist received, delivered oder read und dieser Mission und Einrichtung zugeordnet. Kein Nachweis einer menschlichen Antwort auf eine bestimmte Vorlage; automatische Antworten können zählen.",
  ],
  "history.sms_reply": [
    "Incoming SMS recorded|An incoming SMS is received, delivered or read and explicitly attributed to this Mission and entity, or linked as a reply to their outbound SMS. A matching phone number alone is insufficient.",
    "Existuje prijatá SMS|Prichádzajúca SMS má stav received, delivered alebo read a výslovnú väzbu na túto Mission a inštitúciu, alebo odkaz na ich odchádzajúcu SMS. Samotná zhoda čísla nestačí.",
    "Existuje přijatá SMS|Příchozí SMS má stav received, delivered nebo read a výslovnou vazbu na tuto Mission a instituci, nebo odkaz na jejich odchozí SMS. Samotná shoda čísla nestačí.",
    "Van beérkezett SMS|Bejövő SMS received, delivered vagy read állapotú, ehhez a Missionhöz és intézményhez rendelve, vagy azok kimenő SMS-ére hivatkozó válasz. Azonos telefonszám önmagában nem elég.",
    "Există un SMS primit|Un SMS de intrare este received, delivered sau read și atribuit explicit acestei Mission și entități, sau legat ca răspuns la SMS-ul lor. Numărul identic nu este suficient.",
    "Esiste un SMS ricevuto|Un SMS in entrata è received, delivered o read e attribuito a questa Mission ed entità, oppure collegato come risposta al loro SMS in uscita. Il solo numero uguale non basta.",
    "Eingehende SMS vorhanden|Eine eingehende SMS ist received, delivered oder read und dieser Mission und Einrichtung zugeordnet oder als Antwort auf deren ausgehende SMS verknüpft. Eine gleiche Nummer allein genügt nicht.",
  ],
  "history.message_delivered": [
    "Message delivery confirmed|At least one outbound email/SMS has status delivered. Status sent, opening and a missing receipt are not delivery confirmation. Delivery does not prove a conversation.",
    "Doručenie správy je potvrdené|Aspoň jeden odchádzajúci e-mail/SMS má stav delivered. Stav sent, otvorenie ani chýbajúca doručenka nie sú potvrdením doručenia. Doručenie nedokazuje rozhovor.",
    "Doručení zprávy je potvrzeno|Alespoň jeden odchozí e-mail/SMS má stav delivered. Stav sent, otevření ani chybějící doručenka nejsou potvrzením doručení. Doručení nedokazuje rozhovor.",
    "Üzenetkézbesítés igazolt|Legalább egy kimenő e-mail/SMS delivered állapotú. A sent állapot, megnyitás vagy hiányzó visszaigazolás nem kézbesítési bizonyíték. A kézbesítés nem beszélgetés.",
    "Livrarea mesajului este confirmată|Un e-mail/SMS de ieșire are starea delivered. Starea sent, deschiderea sau lipsa confirmării nu confirmă livrarea. Livrarea nu dovedește conversația.",
    "Consegna del messaggio confermata|Almeno un'e-mail/SMS in uscita è delivered. Stato sent, apertura o ricevuta assente non confermano la consegna. La consegna non prova una conversazione.",
    "Nachrichtenzustellung bestätigt|Mindestens eine ausgehende E-Mail/SMS ist delivered. Status sent, Öffnung oder fehlender Beleg bestätigen keine Zustellung. Zustellung beweist kein Gespräch.",
  ],
  "history.reached": [
    "Communication evidence exists|An answered call (at least 1 second, not forwarded) OR an attributed incoming email/SMS exists. Sent/delivered messages alone do not qualify. This historical fact is not a time-limited Reachable policy.",
    "Existuje dôkaz komunikácie|Existuje prijatý hovor (aspoň 1 sekunda, nie presmerovaný) ALEBO priradený prichádzajúci e-mail/SMS. Samotné odoslanie/doručenie nestačí. Tento historický fakt nie je časovo obmedzená politika Reachable.",
    "Existuje důkaz komunikace|Existuje přijatý hovor (alespoň 1 sekunda, ne přesměrovaný) NEBO přiřazený příchozí e-mail/SMS. Samotné odeslání/doručení nestačí. Historický fakt není časově omezená politika Reachable.",
    "Van kommunikációs bizonyíték|Van fogadott hívás (legalább 1 másodperc, nem átirányított) VAGY hozzárendelt bejövő e-mail/SMS. Az elküldés/kézbesítés nem elég. Ez múltbeli tény, nem időkorlátos Reachable-szabály.",
    "Există dovadă de comunicare|Există un apel preluat (minimum 1 secundă, fără redirecționare) SAU e-mail/SMS de intrare atribuit. Trimiterea/livrarea singură nu este suficientă. Faptul istoric nu este o politică Reachable limitată în timp.",
    "Esiste prova di comunicazione|Esiste una chiamata risposta (almeno 1 secondo, non inoltrata) O un'e-mail/SMS in entrata attribuito. Il solo invio/consegna non basta. Questo fatto storico non è una politica Reachable con scadenza.",
    "Kommunikationsnachweis vorhanden|Ein angenommener Anruf (mindestens 1 Sekunde, nicht weitergeleitet) ODER eine zugeordnete eingehende E-Mail/SMS liegt vor. Versand/Zustellung allein reicht nicht. Historischer Fakt, keine zeitbegrenzte Reachable-Richtlinie.",
  ],
};
const headings = [
  "Communication history · this Mission", "História komunikácie · táto Mission", "Historie komunikace · tato Mission",
  "Kommunikációs előzmények · ez a Mission", "Istoric comunicare · această Mission", "Cronologia comunicazioni · questa Mission", "Kommunikationsverlauf · diese Mission",
];
const scope = [
  "Facts cover all recorded history of this entity in this Mission, not other Missions. No matching by phone/email. No means no qualifying evidence, not proof that contact never happened outside INDEXUS. Missing identity fails the condition, including No. Yes/No facts do not measure counts, recency or consent.",
  "Fakty zahŕňajú celú zaznamenanú históriu inštitúcie v tejto Mission, nie iné Mission. Bez párovania podľa telefónu/e-mailu. Nie znamená chýbajúci dôkaz, nie istotu, že komunikácia mimo INDEXUS neprebehla. Pri chýbajúcej identite podmienka neplatí ani pre Nie. Áno/Nie nemeria počet, aktuálnosť ani súhlas.",
  "Fakta zahrnují celou zaznamenanou historii instituce v této Mission, ne jiné Mission. Bez párování podle telefonu/e-mailu. Ne znamená chybějící důkaz, ne jistotu, že komunikace mimo INDEXUS neproběhla. Při chybějící identitě neplatí ani Ne. Ano/Ne neměří počet, aktuálnost ani souhlas.",
  "A tények az intézmény teljes rögzített előzményét fedik ebben a Missionben, nem más Missionöket. Nincs telefon/e-mail szerinti párosítás. A Nem bizonyítékhiány, nem az INDEXUS-on kívüli kommunikáció kizárása. Hiányzó azonosításnál a Nem sem teljesül. Nem mér darabszámot, frissességet vagy hozzájárulást.",
  "Faptele acoperă întregul istoric înregistrat al entității în această Mission, nu alte Mission. Fără potrivire după telefon/e-mail. Nu înseamnă lipsă de dovezi, nu că nu a existat comunicare în afara INDEXUS. Identitatea lipsă face falsă inclusiv condiția Nu. Nu măsoară numărul, actualitatea sau consimțământul.",
  "I fatti coprono tutta la cronologia registrata dell'entità in questa Mission, non altre Mission. Nessuna corrispondenza per telefono/e-mail. No indica assenza di prove, non assenza certa di comunicazioni fuori INDEXUS. Senza identità fallisce anche No. Sì/No non misura conteggi, attualità o consenso.",
  "Die Fakten betreffen den gesamten erfassten Verlauf der Einrichtung in dieser Mission, nicht andere Missions. Kein Abgleich über Telefon/E-Mail. Nein bedeutet fehlenden Nachweis, nicht sicher fehlende Kommunikation außerhalb INDEXUS. Bei fehlender Identität gilt auch Nein nicht. Kein Maß für Anzahl, Aktualität oder Einwilligung.",
];
const timing = [
    "Service action: choose Field rules, then a history field and Yes/No. IF is checked when invoked; hiding an item creates no trigger. Internal workflow IF can use the same facts but still needs its configured source event. For unattended Reachable/Unreachable, configure the reachability system source, map all four options and set failure threshold, reply wait and success validity. Initial activation establishes a baseline without replaying historical actions.",
    "Servisná akcia: vyberte Pravidlá polí, pole histórie a Áno/Nie. IF sa overí pri vyvolaní; skrytie položky nevytvára spúšťač. Rovnaké fakty sú aj v IF vnútorného workflow, ktoré stále potrebuje nastavenú zdrojovú udalosť. Pre Reachable/Unreachable bez agenta nastavte systémový zdroj dosiahnuteľnosti, mapujte všetky štyri možnosti a nastavte počet neúspechov, čakanie na odpoveď a platnosť úspechu. Prvé zapnutie vytvorí východiskový stav bez prehratia historických akcií.",
  "Servisní akce: zvolte Kombinované podmínky, pole historie a Ano/Ne. IF se ověří při vyvolání; skrytí nevytváří spouštěč. Stejná fakta jsou v IF vnitřního workflow, které stále potřebuje zdrojovou událost. Pro Reachable/Unreachable bez agenta nastavte systémový zdroj dosažitelnosti, mapujte čtyři možnosti a nastavte počet neúspěchů, čekání a platnost úspěchu. První zapnutí vytvoří výchozí stav bez přehrání historických akcí.",
  "Szolgáltatási művelet: Összetett feltételek, előzménymező, Igen/Nem. Az IF meghíváskor értékelődik; az elrejtés nem eseményindító. A belső munkafolyamat IF ugyanazokat a tényeket használhatja, de forrásesemény kell. Ügynök nélküli Reachable/Unreachable esetén állítsa be az elérhetőségi rendszerforrást, mind a négy állapotot, hibaküszöböt, válaszvárást és sikerérvényességet. Első aktiváláskor alapállapot készül, múltbeli műveletek újrajátszása nélkül.",
  "Acțiune de serviciu: Condiții combinate, câmp de istoric, Da/Nu. IF se verifică la invocare; ascunderea nu creează un declanșator. IF intern poate folosi aceleași fapte, dar necesită evenimentul sursă configurat. Pentru Reachable/Unreachable fără agent configurați sursa de disponibilitate, mapați toate cele patru opțiuni și setați pragul de eșecuri, așteptarea și valabilitatea succesului. Activarea inițială stabilește baza fără reluarea acțiunilor istorice.",
  "Azione di servizio: Condizioni combinate, campo cronologia, Sì/No. IF viene verificato all'invocazione; nascondere non crea un trigger. IF interno usa gli stessi fatti ma richiede l'evento sorgente configurato. Per Reachable/Unreachable senza agente configurare la sorgente di raggiungibilità, mappare tutte e quattro le opzioni e impostare soglia errori, attesa risposta e validità successo. La prima attivazione crea una base senza ripetere azioni storiche.",
  "Serviceaktion: Kombinierte Bedingungen, Verlaufsfeld, Ja/Nein. IF wird beim Aufruf geprüft; Ausblenden erzeugt keinen Auslöser. Internes Workflow-IF nutzt dieselben Fakten, braucht aber das konfigurierte Quellereignis. Für Reachable/Unreachable ohne Agent die Systemquelle für Erreichbarkeit konfigurieren, alle vier Optionen zuordnen und Fehlerschwelle, Antwortwartezeit sowie Erfolgsgültigkeit festlegen. Erstaktivierung setzt einen Ausgangszustand ohne Wiederholung historischer Aktionen.",
];
const examples = [
  "Examples: not yet approached = Outreach attempted equals No. Approached without communication = AND: Outreach attempted Yes + Communication evidence No. Never label this immediately Unreachable: the contact may still be waiting for a reply. Use the reachability source for Not defined / Waiting / Unreachable / Reachable. A failed call Yes alone never means currently Unreachable.",
  "Príklady: ešte neoslovený = Pokus o oslovenie existuje je Nie. Oslovený bez komunikácie = AND: Pokus o oslovenie Áno + Dôkaz komunikácie Nie. Neoznačujte ho hneď Unreachable: môže ešte čakať na odpoveď. Na Neurčené / Čaká / Unreachable / Reachable použite zdroj dosiahnuteľnosti. Samotný neúspešný hovor Áno nikdy neznamená aktuálne Unreachable.",
  "Příklady: dosud neoslovený = Pokus o oslovení je Ne. Oslovený bez komunikace = AND: Pokus o oslovení Ano + Důkaz komunikace Ne. Neoznačujte hned Unreachable: může čekat na odpověď. Pro Neurčeno / Čeká / Unreachable / Reachable použijte zdroj dosažitelnosti. Samotný neúspěšný hovor Ano neznamená aktuálně Unreachable.",
  "Példák: még nem keresett = Kapcsolatfelvételi kísérlet Nem. Keresett, kommunikáció nélkül = ÉS: Kísérlet Igen + Kommunikációs bizonyíték Nem. Ne legyen azonnal Unreachable: még válaszra várhat. A Nincs megadva / Várakozás / Unreachable / Reachable állapotokhoz az elérhetőségi forrást használja. Egy korábbi sikertelen hívás nem jelent jelenlegi elérhetetlenséget.",
  "Exemple: neabordat = Încercare de contact Nu. Abordat fără comunicare = ȘI: Încercare Da + Dovadă de comunicare Nu. Nu marcați imediat Unreachable: poate aștepta răspunsul. Pentru Nedefinit / Așteaptă / Unreachable / Reachable folosiți sursa de disponibilitate. Un apel nereușit singur nu înseamnă Unreachable în prezent.",
  "Esempi: mai contattato = Tentativo di contatto No. Contattato senza comunicazione = E: Tentativo Sì + Prova di comunicazione No. Non segnare subito Unreachable: può attendere risposta. Per Non definito / In attesa / Unreachable / Reachable usare la sorgente di raggiungibilità. Una chiamata fallita da sola non significa Unreachable attuale.",
  "Beispiele: noch nicht angesprochen = Kontaktversuch Nein. Angesprochen ohne Kommunikation = UND: Kontaktversuch Ja + Kommunikationsnachweis Nein. Nicht sofort Unreachable setzen: eine Antwort kann noch ausstehen. Für Nicht definiert / Wartend / Unreachable / Reachable die Erreichbarkeitsquelle nutzen. Ein früherer Fehlanruf allein bedeutet nicht aktuell Unreachable.",
];
export function getStatusListHistoryCopy(locale: string) {
  const fields = statusListHistoryFields.map(key => {
    const [label, description] = text(entries[key], locale).split("|");
    return { key, label, description };
  });
  return { title: text(headings, locale), scope: text(scope, locale), timing: text(timing, locale), examples: text(examples, locale), fields };
}
export function statusListHistoryMetadata() {
  const en = getStatusListHistoryCopy("en"), sk = getStatusListHistoryCopy("sk");
  return en.fields.map((field, index) => ({
    key: field.key, category: "history", labelEn: field.label, labelSk: sk.fields[index].label,
    descEn: field.description, descSk: sk.fields[index].description, valueType: "bool" as const,
    ops: [{ value: "eq", labelEn: "Equals", labelSk: "Je rovné" }, { value: "neq", labelEn: "Not equal", labelSk: "Nie je rovné" }],
  }));
}
