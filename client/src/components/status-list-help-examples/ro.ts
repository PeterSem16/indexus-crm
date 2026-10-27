import type { ExampleChapters } from "./types";

export const ro: ExampleChapters = {
  healthcareExamples: {
    title: "Exemple: tranziții de contactabilitate",
    paragraphs: [
      "Stările pot fi condiții și declanșatoare ale acțiunilor. Separați schimbarea stării — de exemplu, un apel reușit schimbă Unreachable în Reachable — de reacția automatizării: notificare, sarcină sau confirmarea altei întrebări.",
      "ATUNCI nu poate rescrie momentan arbitrar starea sistemului în Reachable; este necesar un rezultat de apel justificativ. Acestea sunt instrucțiuni, nu reguli activate. Citirea ajutorului nu creează și nu trimite nimic.",
      "Mission → Setări → Status List → Reguli și acțiuni → Contactabilitatea furnizorului. Extindeți configurația comună și configurați acțiunile răspunsului. Pentru altă întrebare, selectați răspunsul în CÂND și condițiile în DACĂ. Stările necesare trebuie activate.",
    ],
    examples: [
      { title: "1. Unreachable → Reachable după un apel reușit", paragraphs: [
        "Situație: Cinci încercări nereușite. La următoarea răspunde medicul sau personalul. Conversația atinge minimul configurat, implicit 3 secunde. Sistemul setează Reachable și resetează încercările nereușite.",
        "CÂND: se activează Reachable\nATUNCI: trimite o notificare internă\n„Contactul este din nou contactabil.”",
        "Configurați notificarea în acțiunile Reachable sau folosiți răspunsul ca sursă pentru confirmarea pasului obișnuit „Contact telefonic verificat”.",
        "Atenție: Se aplică intrării în Reachable în general, nu numai din Unreachable.",
      ] },
      { title: "2. Wrong number → sarcină → apel confirmat", paragraphs: [
        "Situație: La număr răspunde o altă persoană.",
        "PROCES:\nDeschide Sarcină nouă și alege Număr de telefon greșit\n↓ selectează motivul și un câmp telefonic existent oferit pentru clinică sau spital\n↓ sarcina înregistrează motivul și numărul raportat; nu este necesară introducerea unui număr nou\n↓ salvează corecția în fișa medicală prin procesul obișnuit și apelează numărul corectat\n↓ la încheierea apelului confirmă numai după ce ai contactat furnizorul sau personalul corect",
        "Solicitarea verificării este doar o cerere; nu schimbă singură starea medicală de contactabilitate. Controlul de confirmare apare numai după ce serverul asociază un apel și un număr corespunzător raportării sau corecției. Apelul trebuie să atingă durata minimă configurată. Răspunsul tehnic singur nu reprezintă o confirmare.",
        "Solicitarea este legată de Mission, sesiunea, entitatea medicală, problema și numărul curente. După schimbarea contactului, nu confirma o sarcină veche.",
        "Corectarea numărului nu dovedește singură o conexiune reușită. Este necesar un apel corespunzător cu durata suficientă și confirmarea explicită a agentului.",
      ] },
      { title: "3. Cinci încercări nereușite → e-mail", paragraphs: [
        "Păstrați pragul 5 și adăugați o acțiune e-mail la Unreachable.",
        "CÂND: se activează Unreachable\nDACĂ: contactabilitate = Unreachable\nȘI: încercări nereușite ≥ 5\nATUNCI: trimite e-mail destinatarului desemnat",
        "Configurați destinatarul, subiectul, conținutul și executarea automată sau verificată. Tranziția declanșează e-mailul, nu fiecare deschidere a fișei sau fiecare încercare nereușită ulterioară.",
      ] },
      { title: "4. Not working → raportează numărul selectat", paragraphs: [
        "Deschide Sarcină nouă, alege Număr de telefon greșit, motivul „Numărul nu funcționează” și câmpul telefonic existent care trebuie verificat.",
        "Sarcina înregistrează numărul și motivul. Nu schimbă în mod ascuns contactabilitatea și nu adaugă un număr înlocuitor; actualizează fișa medicală prin procesul obișnuit de corectare.",
        "După corectare, la încheierea apelului poate fi verificat un apel corespunzător care atinge durata minimă. Agentul trebuie să confirme explicit furnizorul sau personalul corect; răspunsul tehnic nu este suficient.",
      ] },
      { title: "5. Contactabilitatea drept condiție a unei întrebări obișnuite", paragraphs: [
        "Declanșatorul nu trebuie să fie direct una dintre cele șapte stări.",
        "CÂND: agentul confirmă „Continuă contactarea telefonică”\nDACĂ: contactabilitate = Reachable\nATUNCI: confirmă „Contact telefonic verificat”",
        "Sau limitează o acțiune:\nExecută numai dacă stare = Unreachable\nȘI încercări nereușite ≥ 5.",
        "Confirmarea altei întrebări nu îi execută neapărat acțiunile. Activați explicit automatizările țintei dacă este necesar și verificați buclele și dublurile.",
      ] },
      { title: "Limite actuale", paragraphs: [
        "Sunt disponibile „trece în Reachable” și „starea actuală este Reachable”. Filtrul exact „anterior Wrong number, acum Reachable” nu este încă disponibil.",
        "Reachable se păstrează după încercări nereușite ulterioare, înregistrate separat. Un eșec obișnuit nu readuce automat Unreachable.",
        "Starea și contorul provin din configurația Mission și a contactului relevant. Sursele lipsă sau ambigue, evaluarea suspendată și rezultatele nepermise nu reprezintă condiții îndeplinite.",
      ] },
    ],
  },
  previousAutomationExamples: {
    title: "Exemple: alte automatizări",
    paragraphs: [
      "Exemple detaliate ale posibilităților pregătite anterior. Numele, descrierea sau SYS nu execută nimic singure; verificați acțiunea efectivă și parametrii.",
      "Alegeți executare automată sau verificare și confirmare pentru fiecare acțiune. Ascunderea sursei nu oprește evaluarea. Prima observare a unei stări existente este o referință inițială, nu o cerere de execuție retroactivă. În Batch respectați salvarea Status List.",
    ],
    examples: [
      { title: "1. Unreached → reapelare peste șase zile lucrătoare", paragraphs: [
        "Situație: Încercare nereușită sub pragul Unreachable, fără Reachable păstrat.",
        "CÂND: o nouă încercare nereușită activează Unreached\nATUNCI: programează reapelare peste 6 zile lucrătoare la 09:00",
        "În acțiunile Unreached verificați 6 zile, zile lucrătoare, 09:00 și politica reapelării existente. Acțiunea creată implicit păstrează programarea existentă, nu o mută automat.",
        "Coordonatorul o poate schimba în Queue. Redeschiderea fișei nu creează o altă reapelare.",
      ] },
      { title: "2. Mesagerie vocală conectată → corectare în Unreached", paragraphs: [
        "Situație: Apel conectat tehnic, dar răspunde mesageria vocală în locul medicului sau personalului.",
        "PROCES: deschide verificarea stării\nMARCHEAZĂ: ultimul apel conectat drept mesagerie vocală\nSALVEAZĂ: verificarea",
        "Acest apel nu mai dovedește Reachable. Fără alt apel reușit, sub prag rezultă Unreached; la prag poate rezulta Unreachable. Acțiunile urmează rezultatul efectiv.",
        "Marcajul aparține ultimului apel concret. Nu înseamnă că orice apel scurt este mesagerie vocală.",
      ] },
      { title: "3. Long-term absent → notificare internă", paragraphs: [
        "Coordonatorul verifică absența îndelungată și salvează Long-term absent în verificarea stării.",
        "CÂND: se activează Long-term absent\nATUNCI: notifică utilizatorul sau grupul desemnat\n„Verifică pașii următori în timpul absenței îndelungate.”",
        "Configurați destinatarul și mesajul. Starea nu modifică contorul și nu are termen automat. „Sună peste o lună” nu creează o reapelare; configurați o acțiune acceptată separată.",
      ] },
      { title: "4. Istoricul comunicării → condiția unei acțiuni", paragraphs: [
        "La confirmarea unei întrebări obișnuite, verificați dacă în această Mission există deja un e-mail înregistrat ca trimis.",
        "CÂND: agentul confirmă întrebarea\nDACĂ: istoricul comunicării — e-mail trimis = da\nATUNCI: confirmă „E-mail deja trimis”",
        "Selectați câmpul istoricului, nu o notă sau un telefon. Configurați eventuala acțiune următoare pe pasul țintă și permiteți explicit executarea ei de către regulă.",
        "Trimiterea nu dovedește livrarea sau răspunsul. Condiția nu este un temporizator „X zile fără răspuns” și singură nu identifică un anumit șablon sau conținut.",
      ] },
    ],
  },
};
