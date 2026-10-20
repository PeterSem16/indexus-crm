import type { TemplateStep } from "./cla-template";

// Document content only. These templates neither configure the reachability
// evaluator nor activate callback rules on existing Missions.
type Copy = Record<string, string>;
const l = (en: string, sk: string, cs: string, hu: string, ro: string, it: string, de: string): Copy =>
  ({ en, sk, cs, hu, ro, it, de });
const reachability = l(
  "Contact status: not assessed, unreached, unreachable, reachable, wrong number or non-working number. After five consecutive unsuccessful attempts spaced six working days apart, classify as unreachable. A successful call restores reachable. If unreachable, or the number does not work and no alternative is available, ask the HP Database Administrator to verify, deactivate or find another contact. These are policy instructions, not automatically installed rules.",
  "Dostupnosť kontaktu: neurčená, nezastihnutý, nedostupný, dostupný, nesprávne alebo nefunkčné číslo. Po piatich po sebe idúcich neúspešných pokusoch s odstupom šiestich pracovných dní je kontakt nedostupný. Úspešný hovor obnoví stav dostupný. Pri nedostupnosti alebo nefunkčnom čísle bez alternatívy má správca databázy preveriť, zrušiť alebo nájsť iný kontakt. Ide o pokyny, nie automaticky nainštalované pravidlá.",
  "Dostupnost kontaktu: neurčená, nezastižený, nedostupný, dostupný, nesprávné nebo nefunkční číslo. Po pěti po sobě jdoucích neúspěšných pokusech s odstupem šesti pracovních dnů je kontakt nedostupný. Úspěšný hovor obnoví stav dostupný. Při nedostupnosti nebo nefunkčním čísle bez alternativy má správce databáze ověřit, zrušit nebo najít jiný kontakt. Jde o pokyny, ne automaticky nainstalovaná pravidla.",
  "Elérhetőség: ismeretlen, nem sikerült elérni, elérhetetlen, elérhető, téves vagy nem működő szám. Öt egymást követő sikertelen próbálkozás után, hat munkanapos időközökkel, elérhetetlennek minősül. Sikeres híváskor ismét elérhető. Elérhetetlenség vagy alternatíva nélküli hibás szám esetén az adatbázis-kezelő ellenőrizze, szüntesse meg vagy keressen más elérhetőséget. Ezek útmutatások, nem automatikusan telepített szabályok.",
  "Disponibilitate: necunoscută, necontactat, inaccesibil, accesibil, număr greșit sau nefuncțional. După cinci încercări consecutive nereușite la șase zile lucrătoare distanță, contactul devine inaccesibil. Un apel reușit restabilește accesibilitatea. Pentru inaccesibilitate sau număr nefuncțional fără alternativă, administratorul bazei de date verifică, dezactivează sau caută alt contact. Sunt instrucțiuni, nu reguli instalate automat.",
  "Raggiungibilità: non valutata, non raggiunto, irraggiungibile, raggiungibile, numero errato o non funzionante. Dopo cinque tentativi consecutivi senza esito distanziati di sei giorni lavorativi, classificare come irraggiungibile. Una chiamata riuscita ripristina la raggiungibilità. Se irraggiungibile o senza numero alternativo funzionante, l'amministratore verifica, disattiva o cerca un altro contatto. Sono istruzioni, non regole installate automaticamente.",
  "Erreichbarkeit: ungeprüft, nicht erreicht, nicht erreichbar, erreichbar, falsche oder nicht funktionierende Nummer. Nach fünf erfolglosen Versuchen im Abstand von sechs Arbeitstagen gilt der Kontakt als nicht erreichbar. Ein erfolgreicher Anruf stellt die Erreichbarkeit wieder her. Bei Nichterreichbarkeit oder defekter Nummer ohne Alternative prüft der Datenbankadministrator den Kontakt, deaktiviert ihn oder sucht eine andere Nummer. Dies sind Hinweise, keine automatisch installierten Regeln.",
);
const unreached = l("Unreached — this contact attempt", "Nezastihnutý pri tomto pokuse", "Nezastižený při tomto pokusu", "Nem sikerült elérni ennél a próbálkozásnál", "Necontactat la această încercare", "Non raggiunto in questo tentativo", "Bei diesem Versuch nicht erreicht");
const unreachedDesc = l(
  "The specific contact was not reached. Follow-up is six working days later; the coordinator may change it. This is not the final unreachable status.",
  "Konkrétny kontakt sa nepodarilo zastihnúť. Ďalší pokus o šesť pracovných dní; koordinátor môže termín zmeniť. Nie je to konečný stav nedostupný.",
  "Konkrétní kontakt se nepodařilo zastihnout. Další pokus za šest pracovních dnů; koordinátor může termín změnit. Nejde o konečný stav nedostupný.",
  "A konkrét kapcsolatot nem sikerült elérni. Következő próbálkozás hat munkanap múlva; a koordinátor módosíthatja. Ez nem a végleges elérhetetlen állapot.",
  "Contactul nu a fost atins. Următoarea încercare după șase zile lucrătoare; coordonatorul poate modifica termenul. Nu este starea finală de inaccesibilitate.",
  "Il contatto specifico non è stato raggiunto. Prossimo tentativo dopo sei giorni lavorativi; il coordinatore può modificare la data. Non è lo stato definitivo di irraggiungibilità.",
  "Der konkrete Kontakt wurde nicht erreicht. Nächster Versuch nach sechs Arbeitstagen; der Koordinator darf den Termin ändern. Dies ist nicht der endgültige Status nicht erreichbar.",
);
const wrong = l("Wrong number", "Nesprávne číslo", "Nesprávné číslo", "Téves szám", "Număr greșit", "Numero errato", "Falsche Nummer");
const wrongDesc = l(
  "The card identifies the correct provider, but somebody else answered. Enter a proposed new contact below, without changing the clinic card. Ask the Database Administrator to verify and add it; if no proposal is supplied, the administrator should search online.",
  "Karta patrí správnemu poskytovateľovi, ale dovolali sme sa niekomu inému. Nižšie navrhni nový kontakt bez zmeny karty ambulancie. Správca databázy má kontakt overiť a doplniť; bez návrhu má správne číslo vyhľadať na internete.",
  "Karta patří správnému poskytovateli, ale dovolali jsme se někomu jinému. Níže navrhněte nový kontakt bez změny karty ambulance. Správce databáze kontakt ověří a doplní; bez návrhu hledá správné číslo na internetu.",
  "A kártya a helyes szolgáltatóé, de más vette fel. Alább javasoljon új elérhetőséget a rendelő kártyájának módosítása nélkül. Az adatbázis-kezelő ellenőrzi és hozzáadja; javaslat hiányában interneten keresi a számot.",
  "Fișa aparține furnizorului corect, dar a răspuns altcineva. Propune un contact nou mai jos fără a modifica fișa clinicii. Administratorul verifică și adaugă numărul; fără propunere îl caută online.",
  "La scheda identifica il fornitore corretto, ma ha risposto un'altra persona. Proponi un nuovo contatto senza modificare la scheda dell'ambulatorio. L'amministratore lo verifica e aggiunge; senza proposta cerca il numero online.",
  "Die Karte gehört zum richtigen Anbieter, aber jemand anderes nahm ab. Unten einen neuen Kontakt vorschlagen, ohne die Praxiskarte zu ändern. Der Administrator prüft und ergänzt ihn; ohne Vorschlag sucht er die Nummer online.",
);
const notWorking = l("Number not working", "Nefunkčné číslo", "Nefunkční číslo", "Nem működő szám", "Număr nefuncțional", "Numero non funzionante", "Nummer funktioniert nicht");
const notWorkingDesc = l(
  "The number does not work. Ask the HP Database Administrator to find the correct number online. If no other telephone number exists, request verification, deactivation review or an alternative contact.",
  "Číslo nefunguje. Správca databázy má správne číslo vyhľadať na internete. Ak neexistuje iné telefónne číslo, požiadaj o preverenie, posúdenie zrušenia alebo nájdenie alternatívneho kontaktu.",
  "Číslo nefunguje. Správce databáze má správné číslo vyhledat na internetu. Pokud neexistuje jiné telefonní číslo, požádejte o ověření, posouzení zrušení nebo nalezení alternativního kontaktu.",
  "A szám nem működik. Az adatbázis-kezelő keressen helyes számot az interneten. Más telefonszám hiányában ellenőrizze a kapcsolatot, mérlegelje a megszüntetést vagy keressen alternatívát.",
  "Numărul nu funcționează. Administratorul caută numărul corect online. Dacă nu există alt număr, solicită verificarea, evaluarea dezactivării sau găsirea unui contact alternativ.",
  "Il numero non funziona. L'amministratore cerca il numero corretto online. Senza un altro numero, richiedere verifica, valutazione della disattivazione o un contatto alternativo.",
  "Die Nummer funktioniert nicht. Der Administrator sucht die richtige Nummer online. Ohne andere Telefonnummer Prüfung, Bewertung einer Deaktivierung oder einen alternativen Kontakt anfordern.",
);
const noCall = l("Will contact us — asks us not to call", "Ozve sa sám — žiada, aby sme nevolali", "Ozve se sám — žádá, abychom nevolali", "Jelentkezik — kéri, hogy ne hívjuk", "Ne va contacta — solicită să nu sunăm", "Ci contatterà — chiede di non chiamare", "Meldet sich selbst — bittet, nicht anzurufen");
const mayCall = l("Will contact us — follow-up call allowed", "Ozve sa sám — následný kontakt nezakázal", "Ozve se sám — následný kontakt nezakázal", "Jelentkezik — utánkövető hívás engedélyezett", "Ne va contacta — apel ulterior permis", "Ci contatterà — richiamata consentita", "Meldet sich selbst — Rückruf erlaubt");
const noCallDesc = l(
  "The provider is considering cooperation and explicitly asks us not to call, saying they will contact us. The document specifies a follow-up date one month later. This is a planning instruction, not permission to disregard their request or an automatically placed call.",
  "Poskytovateľ zvažuje spoluprácu a výslovne žiada, aby sme nevolali; ozve sa sám. Dokument určuje následný termín o jeden mesiac. Je to pokyn na plánovanie, nie súhlas ignorovať jeho žiadosť ani automaticky uskutočnený hovor.",
  "Poskytovatel zvažuje spolupráci a výslovně žádá, abychom nevolali; ozve se sám. Dokument určuje následný termín za jeden měsíc. Jde o plánování, nikoli svolení ignorovat žádost nebo automaticky uskutečněný hovor.",
  "A szolgáltató mérlegeli az együttműködést, és kéri, hogy ne hívjuk; maga jelentkezik. A dokumentum egy hónappal későbbi utánkövetést ír elő. Ez tervezési útmutatás, nem a kérés figyelmen kívül hagyása vagy automatikus hívás.",
  "Furnizorul analizează cooperarea și solicită să nu fie sunat; ne va contacta. Documentul indică urmărirea după o lună. Este o instrucțiune de planificare, nu permisiunea de a ignora cererea sau un apel automat.",
  "Il fornitore valuta la collaborazione e chiede di non chiamare; ci contatterà. Il documento indica un termine di un mese. È un'indicazione di pianificazione, non il permesso di ignorare la richiesta o una chiamata automatica.",
  "Der Anbieter erwägt die Zusammenarbeit und bittet ausdrücklich, nicht anzurufen; er meldet sich selbst. Das Dokument nennt einen Folgetermin nach einem Monat. Dies ist ein Planungshinweis, keine Erlaubnis zum Ignorieren der Bitte und kein automatischer Anruf.",
);
const mayCallDesc = l(
  "The provider is considering cooperation and says they will contact us, without prohibiting us from calling. The document specifies follow-up one week later; applying this template alone does not schedule it.",
  "Poskytovateľ zvažuje spoluprácu a sľúbi, že sa ozve, ale nezakáže nám kontaktovať ho. Dokument určuje následný kontakt o jeden týždeň; samotné aplikovanie šablóny ho nenaplánuje.",
  "Poskytovatel zvažuje spolupráci a slíbí, že se ozve, ale nezakáže nám kontakt. Dokument určuje další kontakt za jeden týden; samotné použití šablony jej nenaplánuje.",
  "A szolgáltató mérlegeli az együttműködést és megígéri, hogy jelentkezik, de nem tiltja a hívást. A dokumentum egy hét múlva ír elő utánkövetést; a sablon alkalmazása önmagában nem ütemezi azt.",
  "Furnizorul analizează cooperarea și promite că ne contactează, fără a interzice apelul. Documentul indică urmărirea după o săptămână; aplicarea șablonului nu o programează.",
  "Il fornitore valuta la collaborazione e promette di contattarci, senza vietare una chiamata. Il documento indica il seguito dopo una settimana; applicare il modello non lo pianifica.",
  "Der Anbieter erwägt die Zusammenarbeit und verspricht, sich zu melden, ohne einen Rückruf zu verbieten. Das Dokument nennt eine Woche; das Anwenden der Vorlage plant diesen Termin nicht automatisch.",
);
const proposedContact = l("Proposed new contact", "Návrh nového kontaktu", "Návrh nového kontaktu", "Javasolt új elérhetőség", "Contact nou propus", "Nuovo contatto proposto", "Vorgeschlagener neuer Kontakt");
const proposedContactDesc = l(
  "Optional phone number or other contact for the Database Administrator to verify. Saved only with this Status List answer; the clinic card is not changed.",
  "Nepovinné telefónne číslo alebo iný kontakt na overenie správcom databázy. Uloží sa iba k tejto odpovedi Status Listu; karta ambulancie sa nemení.",
  "Nepovinné telefonní číslo nebo jiný kontakt k ověření správcem databáze. Uloží se pouze k této odpovědi Status Listu; karta ambulance se nemění.",
  "Opcionális telefonszám vagy más elérhetőség az adatbázis-kezelő ellenőrzéséhez. Csak ehhez a Status List válaszhoz mentődik; a rendelő kártyája nem változik.",
  "Număr opțional sau alt contact de verificat de administrator. Se salvează doar cu acest răspuns Status List; fișa clinicii nu se modifică.",
  "Numero facoltativo o altro contatto da verificare. Salvato solo con questa risposta Status List; la scheda dell'ambulatorio non cambia.",
  "Optionale Telefonnummer oder anderer Kontakt zur Prüfung. Nur mit dieser Status-List-Antwort gespeichert; die Praxiskarte bleibt unverändert.",
);
const timing6 = l("+6 working days; coordinator may change", "+6 pracovných dní; koordinátor môže zmeniť", "+6 pracovních dnů; koordinátor může změnit", "+6 munkanap; koordinátor módosíthatja", "+6 zile lucrătoare; coordonatorul poate modifica", "+6 giorni lavorativi; modificabile dal coordinatore", "+6 Arbeitstage; Koordinator darf ändern");
const timingMonth = l("+1 month", "+1 mesiac", "+1 měsíc", "+1 hónap", "+1 lună", "+1 mese", "+1 Monat");
const timingWeek = l("+1 week", "+1 týždeň", "+1 týden", "+1 hét", "+1 săptămână", "+1 settimana", "+1 Woche");
const step = (stepId: string, parentStepId: string, label: Copy, description: Copy, timing?: Copy): TemplateStep => ({
  stepId, parentStepId, label: label.en, labelL10n: label, description: description.en, descriptionL10n: description,
  confirmationType: "radio", role: "KO", conditionIf: "—", actionThen: "—", nextStepId: "—",
  callbackTiming: timing?.en ?? "—", callbackTimingL10n: timing, isHidden: false, automations: [],
});

/** Add only v04 yellow additions; retain all original IDs and unrelated rows. */
export function applyOutpatientV04(rows: TemplateStep[]): TemplateStep[] {
  const wrongStep = step("MPN-03e", "MPN-03", wrong, wrongDesc);
  wrongStep.questions = [{ id: "proposed-contact", questionText: proposedContact.en, questionTextL10n: proposedContact,
    description: proposedContactDesc.en, descriptionL10n: proposedContactDesc, fieldType: "text", required: false }];
  const insertAfter: Record<string, TemplateStep[]> = {
    "MPN-03a": [step("MPN-03d", "MPN-03", unreached, unreachedDesc, timing6)],
    "MPN-03c": [wrongStep, step("MPN-03f", "MPN-03", notWorking, notWorkingDesc)],
    "MPN-05b": [step("MPN-05b1", "MPN-05b", noCall, noCallDesc, timingMonth), step("MPN-05b2", "MPN-05b", mayCall, mayCallDesc, timingWeek)],
  };
  return rows.flatMap(row => {
    let next = row;
    if (row.stepId === "MPN-03") next = { ...row, isHidden: false, role: "KO+BO", description: reachability.en, descriptionL10n: reachability };
    if (row.stepId === "MPN-03b" || row.stepId === "MPN-03c") next = { ...row, description: reachability.en, descriptionL10n: reachability };
    return [next, ...(insertAfter[row.stepId] ?? [])];
  });
}
