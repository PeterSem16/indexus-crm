import type { Locale } from "./translations";
const locales = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;
const labels: Record<string, string[]> = {
  no_agents: ["No available agents", "Žiadni dostupní agenti", "Žádní dostupní agenti", "Nincs elérhető ügynök", "Niciun agent disponibil", "Nessun agente disponibile", "Keine verfügbaren Agenten"],
  caller_hangup: ["Caller hung up", "Volajúci zložil", "Volající zavěsil", "A hívó letette", "Apelantul a închis", "Il chiamante ha riagganciato", "Anrufer hat aufgelegt"],
  caller_left_stasis: ["Caller left the queue", "Volajúci opustil frontu", "Volající opustil frontu", "A hívó elhagyta a sort", "Apelantul a părăsit coada", "Il chiamante ha lasciato la coda", "Anrufer hat die Warteschlange verlassen"],
  timeout: ["Timeout", "Vypršal čas", "Vypršel čas", "Időtúllépés", "Timp expirat", "Tempo scaduto", "Zeitüberschreitung"],
  received: ["Received", "Prijaté", "Přijaté", "Fogadott", "Primit", "Ricevuto", "Empfangen"],
  sent: ["Sent", "Odoslané", "Odeslané", "Elküldött", "Trimis", "Inviato", "Gesendet"],
  delivered: ["Delivered", "Doručené", "Doručené", "Kézbesített", "Livrat", "Consegnato", "Zugestellt"],
  failed: ["Failed", "Zlyhalo", "Selhalo", "Sikertelen", "Eșuat", "Non riuscito", "Fehlgeschlagen"],
  calling: ["Dialing", "Vytáčanie", "Vytáčení", "Tárcsázás", "Se apelează", "Composizione", "Wählen"],
  ringing: ["Ringing", "Vyzváňanie", "Vyzvánění", "Csengés", "Sună", "Squillo", "Klingeln"],
  answered: ["Answered", "Prijatý hovor", "Přijatý hovor", "Fogadott hívás", "Apel preluat", "Chiamata risposta", "Angenommen"],
  missed: ["Missed", "Zmeškaný hovor", "Zmeškaný hovor", "Nem fogadott hívás", "Apel pierdut", "Chiamata persa", "Verpasst"],
  busy: ["Busy", "Obsadené", "Obsazeno", "Foglalt", "Ocupat", "Occupato", "Besetzt"],
  no_answer: ["No answer", "Bez odpovede", "Bez odpovědi", "Nincs válasz", "Fără răspuns", "Nessuna risposta", "Keine Antwort"],
  waiting_agent: ["Waiting for agent", "Čaká na agenta", "Čeká na agenta", "Ügynökre vár", "Așteaptă agentul", "In attesa dell’agente", "Wartet auf Agent"],
  done: ["Done", "Vybavené", "Vyřízené", "Elintézve", "Rezolvat", "Completato", "Erledigt"],
  comment: ["Comment", "Komentár", "Komentář", "Hozzászólás", "Comentariu", "Commento", "Kommentar"],
  question: ["Question", "Otázka", "Otázka", "Kérdés", "Întrebare", "Domanda", "Frage"],
  answer: ["Answer", "Odpoveď", "Odpověď", "Válasz", "Răspuns", "Risposta", "Antwort"],
  state_change: ["State change", "Zmena stavu", "Změna stavu", "Állapotváltozás", "Schimbare de stare", "Cambio di stato", "Statusänderung"],
  user: ["User", "Používateľ", "Uživatel", "Felhasználó", "Utilizator", "Utente", "Benutzer"],
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
  inbound: ["Incoming", "Prichádzajúca", "Příchozí", "Bejövő", "Primită", "In entrata", "Eingehend"],
  outbound: ["Outgoing", "Odchádzajúca", "Odchozí", "Kimenő", "Trimisă", "In uscita", "Ausgehend"],
  internal: ["Internal", "Interná", "Interní", "Belső", "Internă", "Interna", "Intern"],
  referral: ["Referral", "Odporúčanie", "Doporučení", "Ajánlás", "Recomandare", "Segnalazione", "Empfehlung"],
};
export type ConditionChoiceCopy = { saved: string; choose: string; chooseOne: string; values: Record<string, string> };
export function getConditionChoiceCopy(locale: Locale): ConditionChoiceCopy {
  const index = Math.max(0, locales.indexOf(locale as typeof locales[number]));
  const translated = Object.fromEntries(Object.entries(labels).map(([key, values]) => [key, values[index]]));
  return { saved: translated.saved, choose: translated.choose, chooseOne: translated.chooseOne, values: translated };
}
