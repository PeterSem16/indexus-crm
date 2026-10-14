import type { Locale } from "./translations";

const locales = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;

const strings = {
  title: [
    "Call recording",
    "Nahrávka hovoru",
    "Nahrávka hovoru",
    "Hívásfelvétel",
    "Înregistrarea apelului",
    "Registrazione della chiamata",
    "Anrufaufzeichnung",
  ],
  description: [
    "Review the recording and transcript for this call.",
    "Prehrajte si nahrávku a prezrite prepis tohto hovoru.",
    "Přehrajte si nahrávku a prohlédněte přepis tohoto hovoru.",
    "Hallgassa meg a hívást, és tekintse át az átiratot.",
    "Ascultați înregistrarea și consultați transcrierea acestui apel.",
    "Ascolta la registrazione e consulta la trascrizione della chiamata.",
    "Hören Sie die Aufzeichnung an und prüfen Sie das Transkript dieses Anrufs.",
  ],
  loading: [
    "Checking recording access…",
    "Overuje sa prístup k nahrávke…",
    "Ověřuje se přístup k nahrávce…",
    "A felvételhez való hozzáférés ellenőrzése…",
    "Se verifică accesul la înregistrare…",
    "Verifica dell’accesso alla registrazione…",
    "Zugriff auf die Aufzeichnung wird geprüft…",
  ],
  unavailableTitle: [
    "Recording unavailable",
    "Nahrávka nie je dostupná",
    "Nahrávka není dostupná",
    "A felvétel nem érhető el",
    "Înregistrarea nu este disponibilă",
    "Registrazione non disponibile",
    "Aufzeichnung nicht verfügbar",
  ],
  unavailableDescription: [
    "This call or recording is unavailable to your account. It may have been removed, or you may not have access.",
    "Tento hovor alebo nahrávka nie sú pre váš účet dostupné. Mohli byť odstránené alebo k nim nemáte prístup.",
    "Tento hovor nebo nahrávka nejsou pro váš účet dostupné. Mohly být odstraněny nebo k nim nemáte přístup.",
    "Ez a hívás vagy felvétel nem érhető el a fiókjában. Lehet, hogy törölték, vagy nincs hozzáférése.",
    "Acest apel sau înregistrarea nu sunt disponibile pentru contul dvs. Este posibil să fi fost șterse sau să nu aveți acces.",
    "Questa chiamata o registrazione non è disponibile per il tuo account. Potrebbe essere stata rimossa oppure potresti non avere accesso.",
    "Dieser Anruf oder diese Aufzeichnung ist für Ihr Konto nicht verfügbar. Sie wurde möglicherweise entfernt oder Ihnen fehlt der Zugriff.",
  ],
  emptyTitle: [
    "No recording available",
    "Nahrávka nie je k dispozícii",
    "Nahrávka není k dispozici",
    "Nincs elérhető felvétel",
    "Nicio înregistrare disponibilă",
    "Nessuna registrazione disponibile",
    "Keine Aufzeichnung verfügbar",
  ],
  emptyDescription: [
    "There are no recordings available for this call.",
    "Pre tento hovor nie sú dostupné žiadne nahrávky.",
    "Pro tento hovor nejsou dostupné žádné nahrávky.",
    "Ehhez a híváshoz nem érhető el felvétel.",
    "Nu există înregistrări disponibile pentru acest apel.",
    "Non ci sono registrazioni disponibili per questa chiamata.",
    "Für diesen Anruf sind keine Aufzeichnungen verfügbar.",
  ],
  selectedRecordingUnavailable: [
    "That recording is not available for this call or your account.",
    "Táto nahrávka nie je dostupná pre tento hovor alebo váš účet.",
    "Tato nahrávka není dostupná pro tento hovor nebo váš účet.",
    "Ez a felvétel nem érhető el ehhez a híváshoz vagy a fiókjához.",
    "Această înregistrare nu este disponibilă pentru apel sau pentru contul dvs.",
    "Questa registrazione non è disponibile per la chiamata o per il tuo account.",
    "Diese Aufzeichnung ist für diesen Anruf oder Ihr Konto nicht verfügbar.",
  ],
  errorTitle: [
    "Could not load call recordings",
    "Nahrávky hovorov sa nepodarilo načítať",
    "Nahrávky hovorů se nepodařilo načíst",
    "A hívásfelvételek betöltése nem sikerült",
    "Înregistrările apelului nu au putut fi încărcate",
    "Impossibile caricare le registrazioni della chiamata",
    "Anrufaufzeichnungen konnten nicht geladen werden",
  ],
  errorDescription: [
    "A temporary problem prevented the recordings from loading. Try again.",
    "Dočasný problém zabránil načítaniu nahrávok. Skúste to znova.",
    "Dočasný problém zabránil načtení nahrávek. Zkuste to znovu.",
    "Átmeneti hiba miatt a felvételek nem töltődtek be. Próbálja újra.",
    "O problemă temporară a împiedicat încărcarea înregistrărilor. Încercați din nou.",
    "Un problema temporaneo ha impedito il caricamento delle registrazioni. Riprova.",
    "Ein vorübergehendes Problem hat das Laden der Aufzeichnungen verhindert. Versuchen Sie es erneut.",
  ],
  retry: [
    "Try again",
    "Skúsiť znova",
    "Zkusit znovu",
    "Újrapróbálás",
    "Încercați din nou",
    "Riprova",
    "Erneut versuchen",
  ],
  playerLabel: [
    "Call recording player",
    "Prehrávač nahrávky hovoru",
    "Přehrávač nahrávky hovoru",
    "Hívásfelvétel-lejátszó",
    "Player pentru înregistrarea apelului",
    "Lettore della registrazione della chiamata",
    "Anrufaufzeichnungs-Player",
  ],
} as const;

export type AutomationCallPageCopy = Record<keyof typeof strings, string>;

export function getAutomationCallPageCopy(locale: Locale): AutomationCallPageCopy {
  const index = Math.max(0, locales.indexOf(locale as (typeof locales)[number]));
  return Object.fromEntries(
    Object.entries(strings).map(([key, values]) => [key, values[index]]),
  ) as AutomationCallPageCopy;
}
