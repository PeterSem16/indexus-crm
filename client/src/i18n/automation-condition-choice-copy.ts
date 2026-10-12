import type { Locale } from "./translations";
const locales = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;
const labels: Record<string, string[]> = {
  saved: ["Saved value", "Uložená hodnota", "Uložená hodnota", "Mentett érték", "Valoare salvată", "Valore salvato", "Gespeicherter Wert"],
  choose: ["Choose one or more values from the list.", "Vyberte jednu alebo viac hodnôt zo zoznamu.", "Vyberte jednu nebo více hodnot ze seznamu.", "Válasszon egy vagy több értéket a listából.", "Alegeți una sau mai multe valori din listă.", "Scegli uno o più valori dall’elenco.", "Wählen Sie einen oder mehrere Werte aus der Liste."],
  chooseOne: ["Choose a value from the list.", "Vyberte hodnotu zo zoznamu.", "Vyberte hodnotu ze seznamu.", "Válasszon egy értéket a listából.", "Alegeți o valoare din listă.", "Scegli un valore dall’elenco.", "Wählen Sie einen Wert aus der Liste."],
  calm: ["Calm", "Pokojný", "Klidný", "Nyugodt", "Calm", "Calmo", "Ruhig"],
  concerned: ["Concerned", "Znepokojený", "Znepokojený", "Aggódó", "Îngrijorat", "Preoccupato", "Besorgt"],
  rude: ["Rude", "Hrubý", "Hrubý", "Durva", "Necivilizat", "Scortese", "Unhöflich"],
  inbound_call: ["Incoming call", "Prichádzajúci hovor", "Příchozí hovor", "Bejövő hívás", "Apel primit", "Chiamata in entrata", "Eingehender Anruf"],
  outbound_call: ["Outgoing call", "Odchádzajúci hovor", "Odchozí hovor", "Kimenő hívás", "Apel efectuat", "Chiamata in uscita", "Ausgehender Anruf"],
  cold: ["Cold", "Studený", "Studený", "Hideg", "Rece", "Freddo", "Kalt"],
  warm: ["Warm", "Záujem", "Zájem", "Érdeklődő", "Interesat", "Interessato", "Interessiert"],
  hot: ["Hot", "Vysoký záujem", "Vysoký zájem", "Erős érdeklődés", "Interes ridicat", "Molto interessato", "Stark interessiert"],
  qualified: ["Qualified", "Kvalifikovaný", "Kvalifikovaný", "Minősített", "Calificat", "Qualificato", "Qualifiziert"],
  web_form: ["Web form", "Webový formulár", "Webový formulář", "Webes űrlap", "Formular web", "Modulo web", "Webformular"],
  phone: ["Phone", "Telefón", "Telefon", "Telefon", "Telefon", "Telefono", "Telefon"],
  in_person: ["In person", "Osobne", "Osobně", "Személyesen", "Personal", "Di persona", "Persönlich"],
  referral: ["Referral", "Odporúčanie", "Doporučení", "Ajánlás", "Recomandare", "Segnalazione", "Empfehlung"],
};
export type ConditionChoiceCopy = { saved: string; choose: string; chooseOne: string; values: Record<string, string> };
export function getConditionChoiceCopy(locale: Locale): ConditionChoiceCopy {
  const index = Math.max(0, locales.indexOf(locale as typeof locales[number]));
  const translated = Object.fromEntries(Object.entries(labels).map(([key, values]) => [key, values[index]]));
  return { saved: translated.saved, choose: translated.choose, chooseOne: translated.chooseOne, values: translated };
}
