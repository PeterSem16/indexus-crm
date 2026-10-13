import type { Locale } from "./translations";
const locales = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;
const labels = {
  title: ["When conditions do not match", "Keď podmienky nesedia", "Když podmínky nesedí", "Ha a feltételek nem teljesülnek", "Când condițiile nu se potrivesc", "Quando le condizioni non corrispondono", "Wenn Bedingungen nicht zutreffen"],
  stop: ["Stop without actions", "Zastaviť bez akcií", "Zastavit bez akcí", "Leállítás művelet nélkül", "Oprire fără acțiuni", "Interrompi senza azioni", "Ohne Aktionen stoppen"],
  evaluate: ["Evaluate another rule", "Vyhodnotiť ďalšie pravidlo", "Vyhodnotit další pravidlo", "Másik szabály kiértékelése", "Evaluează altă regulă", "Valuta un’altra regola", "Andere Regel auswerten"],
  help: ["The selected rule checks its own source access, country, channels and conditions. It does not bypass them or run twice for the same event. Circular links are blocked.",
    "Vybrané pravidlo overí vlastné oprávnenia k zdroju, krajinu, kanály a podmienky. Neobíde ich ani sa pre rovnakú udalosť nespustí dvakrát. Kruhové prepojenia sú zakázané.",
    "Vybrané pravidlo ověří vlastní přístup ke zdroji, zemi, kanály a podmínky. Neobejde je ani se pro stejnou událost nespustí dvakrát. Kruhová propojení jsou zakázána.",
    "A kiválasztott szabály ellenőrzi saját forrásjogosultságait, országát, csatornáit és feltételeit. Nem kerüli meg ezeket, és egy eseményre nem fut kétszer. Körkörös kapcsolatok tiltottak.",
    "Regula selectată verifică propriul acces, țara, canalele și condițiile. Nu le ocolește și nu rulează de două ori pentru același eveniment. Legăturile circulare sunt blocate.",
    "La regola selezionata verifica accesso, paese, canali e condizioni propri. Non li aggira e non viene eseguita due volte per lo stesso evento. I collegamenti circolari sono bloccati.",
    "Die ausgewählte Regel prüft eigenen Quellzugriff, Land, Kanäle und Bedingungen. Sie umgeht diese nicht und läuft nicht zweimal pro Ereignis. Kreisverweise sind gesperrt."],
  unavailable: ["Saved target is unavailable", "Uložené cieľové pravidlo nie je dostupné", "Uložené cílové pravidlo není dostupné", "A mentett célszabály nem elérhető", "Regula țintă salvată nu este disponibilă", "La regola salvata non è disponibile", "Gespeicherte Zielregel nicht verfügbar"],
};
export function getNoMatchCopy(locale: Locale) {
  const index = Math.max(0, locales.indexOf(locale as typeof locales[number]));
  return Object.fromEntries(Object.entries(labels).map(([key, values]) => [key, values[index]])) as Record<keyof typeof labels, string>;
}
