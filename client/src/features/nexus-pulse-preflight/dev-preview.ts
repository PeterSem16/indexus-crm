// The build-time DEV guard is mandatory: a URL must never enable this in production.
export function canUsePulseDevPreview(development: boolean, hostname: string): boolean {
  return development && (hostname.endsWith(".replit.dev") || hostname === "localhost" || hostname === "127.0.0.1");
}

export const PULSE_DEV_PREVIEW_PARAM = "pulse-ui-preview";

type PreviewCopy = { enter: string; notice: string; exit: string };
const copy: Record<string, PreviewCopy> = {
  sk: { enter: "Replit: otvoriť UI bez vstupného testu", notice: "Replit UI test — vstupné kontroly sú preskočené, nie splnené. Nie je to test telefonovania. Dáta a akcie sú skutočné.", exit: "Ukončiť UI test" },
  cs: { enter: "Replit: otevřít UI bez vstupního testu", notice: "Replit UI test — vstupní kontroly jsou přeskočené, ne splněné. Nejde o test volání. Data a akce jsou skutečné.", exit: "Ukončit UI test" },
  en: { enter: "Replit: open UI without readiness checks", notice: "Replit UI test — readiness checks are skipped, not passed. This does not test calling. Data and actions are real.", exit: "Exit UI test" },
  hu: { enter: "Replit: felület megnyitása ellenőrzés nélkül", notice: "Replit felületteszt — az ellenőrzések kimaradtak, nem teljesültek. Ez nem hívásteszt. Az adatok és műveletek valódiak.", exit: "Felületteszt bezárása" },
  ro: { enter: "Replit: deschide interfața fără verificări", notice: "Test interfață Replit — verificările sunt omise, nu trecute. Acesta nu este un test de apelare. Datele și acțiunile sunt reale.", exit: "Încheie testul interfeței" },
  it: { enter: "Replit: apri interfaccia senza verifiche", notice: "Test interfaccia Replit — verifiche saltate, non superate. Non è un test delle chiamate. Dati e azioni sono reali.", exit: "Termina test interfaccia" },
  de: { enter: "Replit: Oberfläche ohne Prüfung öffnen", notice: "Replit-Oberflächentest — Prüfungen übersprungen, nicht bestanden. Dies ist kein Anruftest. Daten und Aktionen sind echt.", exit: "Oberflächentest beenden" },
};
export function pulseDevPreviewCopy(locale: string): PreviewCopy {
  return copy[locale] || copy.en;
}