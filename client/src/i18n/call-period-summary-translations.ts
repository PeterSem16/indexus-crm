export interface CallPeriodSummaryCopy {
  title: string; quality: string; close: string; dismissHint: string; alerts: string;
  unratedTitle: string; unratedCopy: string;
  excellentTitle: string; excellentCopy: string;
  strongTitle: string; strongCopy: string;
  goodTitle: string; goodCopy: string;
  developingTitle: string; developingCopy: string;
  supportiveTitle: string; supportiveCopy: string;
}
export const callPeriodSummaryTranslations: Record<"en" | "sk" | "cs" | "hu" | "ro" | "it" | "de", CallPeriodSummaryCopy> = {
  en: {
    title: "Calls in the selected period", quality: "AVERAGE QUALITY", close: "Close call summary", dismissHint: "Closes automatically shortly. You can also press Escape.", alerts: "Calls with alerts",
    unratedTitle: "Every call is an opportunity", unratedCopy: "Average quality is available after calls are analyzed.",
    excellentTitle: "Outstanding result!", excellentCopy: "Your attention to detail delivers excellent results.",
    strongTitle: "Excellent work!", strongCopy: "Call quality is at a very good level.",
    goodTitle: "Nice work!", goodCopy: "Keep up the good momentum.",
    developingTitle: "Every step counts", developingCopy: "Small improvements help quality move forward.",
    supportiveTitle: "Every call is a fresh start", supportiveCopy: "Focus on one small improvement in your next call.",
  },
  sk: {
    title: "Hovory vo vybranom období", quality: "PRIEMERNÉ HODNOTENIE", close: "Zavrieť súhrn hovorov", dismissHint: "Automaticky sa zavrie o chvíľu; zavriete ho aj stlačením Esc.", alerts: "Hovory s upozornením",
    unratedTitle: "Každý hovor je príležitosť", unratedCopy: "Priemerné hodnotenie sa zobrazí po analýze hovorov.",
    excellentTitle: "Mimoriadny výsledok!", excellentCopy: "Vaša dôslednosť prináša skvelé výsledky.",
    strongTitle: "Výborná práca!", strongCopy: "Kvalita hovorov je na veľmi dobrej úrovni.",
    goodTitle: "Pekná práca!", goodCopy: "Pokračujte v tomto dobrom tempe.",
    developingTitle: "Každý krok sa počíta", developingCopy: "Aj malé zlepšenia posúvajú kvalitu vpred.",
    supportiveTitle: "Každý hovor je nový začiatok", supportiveCopy: "Skúste sa zamerať na jeden malý krok pri ďalšom hovore.",
  },
  cs: {
    title: "Hovory ve vybraném období", quality: "PRŮMĚRNÉ HODNOCENÍ", close: "Zavřít souhrn hovorů", dismissHint: "Za chvíli se automaticky zavře; zavřete jej také klávesou Esc.", alerts: "Hovory s upozorněním",
    unratedTitle: "Každý hovor je příležitost", unratedCopy: "Průměrné hodnocení se zobrazí po analýze hovorů.",
    excellentTitle: "Mimořádný výsledek!", excellentCopy: "Vaše důslednost přináší skvělé výsledky.",
    strongTitle: "Výborná práce!", strongCopy: "Kvalita hovorů je na velmi dobré úrovni.",
    goodTitle: "Pěkná práce!", goodCopy: "Pokračujte v tomto dobrém tempu.",
    developingTitle: "Každý krok se počítá", developingCopy: "I malá zlepšení posouvají kvalitu vpřed.",
    supportiveTitle: "Každý hovor je nový začátek", supportiveCopy: "Zaměřte se při dalším hovoru na jedno malé zlepšení.",
  },
  hu: {
    title: "Hívások a kiválasztott időszakban", quality: "ÁTLAGOS ÉRTÉKELÉS", close: "Hívásösszesítő bezárása", dismissHint: "Hamarosan automatikusan bezárul; az Esc billentyűvel is bezárható.", alerts: "Figyelmeztetést tartalmazó hívások",
    unratedTitle: "Minden hívás egy lehetőség", unratedCopy: "Az átlagos értékelés a hívások elemzése után jelenik meg.",
    excellentTitle: "Kiemelkedő eredmény!", excellentCopy: "Az alapossága nagyszerű eredményeket hoz.",
    strongTitle: "Kiváló munka!", strongCopy: "A hívások minősége nagyon jó szinten van.",
    goodTitle: "Szép munka!", goodCopy: "Folytassa ebben a jó ütemben.",
    developingTitle: "Minden lépés számít", developingCopy: "A kis javulások is előreviszik a minőséget.",
    supportiveTitle: "Minden hívás új kezdet", supportiveCopy: "A következő hívásnál összpontosítson egy apró javításra.",
  },
  ro: {
    title: "Apeluri în perioada selectată", quality: "EVALUARE MEDIE", close: "Închide rezumatul apelurilor", dismissHint: "Se închide automat în curând; îl puteți închide și cu Esc.", alerts: "Apeluri cu avertizări",
    unratedTitle: "Fiecare apel este o oportunitate", unratedCopy: "Evaluarea medie apare după analiza apelurilor.",
    excellentTitle: "Rezultat remarcabil!", excellentCopy: "Atenția dumneavoastră la detalii aduce rezultate excelente.",
    strongTitle: "Muncă excelentă!", strongCopy: "Calitatea apelurilor este la un nivel foarte bun.",
    goodTitle: "Bună treabă!", goodCopy: "Continuați în acest ritm bun.",
    developingTitle: "Fiecare pas contează", developingCopy: "Chiar și micile îmbunătățiri cresc calitatea.",
    supportiveTitle: "Fiecare apel este un nou început", supportiveCopy: "Concentrați-vă pe o mică îmbunătățire la următorul apel.",
  },
  it: {
    title: "Chiamate nel periodo selezionato", quality: "VALUTAZIONE MEDIA", close: "Chiudi riepilogo chiamate", dismissHint: "Si chiude automaticamente tra poco; puoi chiuderlo anche con Esc.", alerts: "Chiamate con avvisi",
    unratedTitle: "Ogni chiamata è un'opportunità", unratedCopy: "La valutazione media appare dopo l'analisi delle chiamate.",
    excellentTitle: "Risultato straordinario!", excellentCopy: "La tua attenzione ai dettagli porta ottimi risultati.",
    strongTitle: "Ottimo lavoro!", strongCopy: "La qualità delle chiamate è a un livello molto buono.",
    goodTitle: "Bel lavoro!", goodCopy: "Continua con questo buon ritmo.",
    developingTitle: "Ogni passo conta", developingCopy: "Anche piccoli miglioramenti fanno avanzare la qualità.",
    supportiveTitle: "Ogni chiamata è un nuovo inizio", supportiveCopy: "Concentrati su un piccolo miglioramento nella prossima chiamata.",
  },
  de: {
    title: "Anrufe im ausgewählten Zeitraum", quality: "DURCHSCHNITTLICHE BEWERTUNG", close: "Anrufübersicht schließen", dismissHint: "Schließt sich gleich automatisch; auch mit Esc schließbar.", alerts: "Anrufe mit Warnungen",
    unratedTitle: "Jeder Anruf ist eine Chance", unratedCopy: "Die durchschnittliche Bewertung erscheint nach der Anrufanalyse.",
    excellentTitle: "Herausragendes Ergebnis!", excellentCopy: "Ihre Sorgfalt bringt ausgezeichnete Ergebnisse.",
    strongTitle: "Ausgezeichnete Arbeit!", strongCopy: "Die Anrufqualität ist auf einem sehr guten Niveau.",
    goodTitle: "Gute Arbeit!", goodCopy: "Machen Sie in diesem guten Tempo weiter.",
    developingTitle: "Jeder Schritt zählt", developingCopy: "Auch kleine Verbesserungen bringen die Qualität voran.",
    supportiveTitle: "Jeder Anruf ist ein neuer Anfang", supportiveCopy: "Konzentrieren Sie sich beim nächsten Anruf auf eine kleine Verbesserung.",
  },
};
