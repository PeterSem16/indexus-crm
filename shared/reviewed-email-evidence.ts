import type { FunnelMember } from "./mission-funnel";
const labels = {
  en: "Reviewed email record; sending time unknown",
  sk: "Skontrolovaný e-mailový záznam; čas odoslania neznámy",
  cs: "Zkontrolovaný e-mailový záznam; čas odeslání neznámý",
  hu: "Ellenőrzött e-mail-bejegyzés; küldési idő ismeretlen",
  ro: "Înregistrare e-mail verificată; ora trimiterii necunoscută",
  it: "Registrazione email verificata; ora di invio sconosciuta",
  de: "Geprüfter E-Mail-Eintrag; Versandzeit unbekannt",
};
export function funnelEvidenceBasisLabel(member: Pick<FunnelMember, "timestampKind">, fallback: string, locale: string) {
  return member.timestampKind === "recorded" ? labels[locale as keyof typeof labels] ?? labels.en : fallback;
}
