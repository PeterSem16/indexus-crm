import type { Locale } from "./translations";

const locales = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;

const strings = {
  scopeUnavailable: [
    "Enable content or attachment analysis for the selected search scope.",
    "Pre zvolený rozsah zapnite analýzu obsahu alebo príloh.",
    "Pro zvolený rozsah zapněte analýzu obsahu nebo příloh.",
    "Kapcsolja be a tartalom- vagy mellékletelemzést a kiválasztott keresési tartományhoz.",
    "Activați analiza conținutului sau a atașamentelor pentru domeniul de căutare selectat.",
    "Attiva l’analisi del contenuto o degli allegati per l’ambito di ricerca selezionato.",
    "Aktivieren Sie die Inhalts- oder Anhangsanalyse für den gewählten Suchbereich."
  ],
  enabled: ["Search for literal text", "Hľadať doslovný text", "Hledat doslovný text", "Szó szerinti szöveg keresése", "Căutare text literal", "Cerca testo letterale", "Wörtlichen Text suchen"],
  help: [
    "Searches the original message or voice transcript and readable attachment text. Scans and images use OCR; unreadable sources are unknown, not treated as absent.",
    "Prehľadáva pôvodnú správu alebo hlasový prepis a čitateľný text príloh. Skeny a obrázky sa spracúvajú pomocou OCR; nečitateľné zdroje sú neznáme, nie považované za neprítomné.",
    "Prohledává původní zprávu nebo hlasový přepis a čitelný text příloh. Skeny a obrázky se zpracovávají pomocí OCR; nečitelné zdroje jsou neznámé, nikoli považované za nepřítomné.",
    "Az eredeti üzenetben vagy hangátiratban, valamint a mellékletek olvasható szövegében keres. A szkennelt dokumentumokat és képeket OCR dolgozza fel; az olvashatatlan források állapota ismeretlen, nem pedig hiányzó.",
    "Caută în mesajul original sau în transcrierea vocală și în textul lizibil al atașamentelor. Scanările și imaginile folosesc OCR; sursele ilizibile sunt considerate necunoscute, nu absente.",
    "Cerca nel messaggio originale o nella trascrizione vocale e nel testo leggibile degli allegati. Scansioni e immagini usano l'OCR; le fonti illeggibili sono sconosciute, non considerate assenti.",
    "Durchsucht die Originalnachricht oder das Sprachtranskript sowie lesbaren Anhangstext. Scans und Bilder werden per OCR verarbeitet; unlesbare Quellen gelten als unbekannt, nicht als nicht vorhanden."
  ],
  terms: ["Search terms", "Hľadané výrazy", "Hledané výrazy", "Keresési kifejezések", "Termeni de căutare", "Termini di ricerca", "Suchbegriffe"],
  termsPlaceholder: [
    "One phrase or character per line",
    "Jeden výraz alebo znak na riadok",
    "Jeden výraz nebo znak na řádek",
    "Soronként egy kifejezés vagy karakter",
    "O expresie sau un caracter pe linie",
    "Una frase o un carattere per riga",
    "Ein Ausdruck oder Zeichen pro Zeile"
  ],
  termsHint: [
    "Use one literal phrase or character per line. No regular expressions. Up to 20 terms, 200 characters each.",
    "Zadajte jeden doslovný výraz alebo znak na riadok. Regulárne výrazy nie sú podporované. Najviac 20 výrazov, každý do 200 znakov.",
    "Zadejte jeden doslovný výraz nebo znak na řádek. Regulární výrazy nejsou podporovány. Nejvýše 20 výrazů, každý do 200 znaků.",
    "Soronként egy szó szerinti kifejezést vagy karaktert adjon meg. Reguláris kifejezések nem használhatók. Legfeljebb 20 kifejezés, egyenként 200 karakter.",
    "Introduceți o expresie literală sau un caracter pe linie. Expresiile regulate nu sunt acceptate. Maximum 20 de termeni, fiecare de cel mult 200 de caractere.",
    "Inserisci una frase letterale o un carattere per riga. Le espressioni regolari non sono supportate. Massimo 20 termini, fino a 200 caratteri ciascuno.",
    "Eine wörtliche Phrase oder ein Zeichen pro Zeile. Reguläre Ausdrücke werden nicht unterstützt. Bis zu 20 Begriffe mit jeweils maximal 200 Zeichen."
  ],
  scope: ["Search in", "Hľadať v", "Hledat v", "Keresés helye", "Caută în", "Cerca in", "Suchen in"],
  content: ["Message / call", "Správa / hovor", "Zpráva / hovor", "Üzenet / hívás", "Mesaj / apel", "Messaggio / chiamata", "Nachricht / Anruf"],
  attachments: ["Attachments", "Prílohy", "Přílohy", "Mellékletek", "Atașamente", "Allegati", "Anhänge"],
  all: ["Message / call and attachments", "Správa / hovor a prílohy", "Zpráva / hovor a přílohy", "Üzenet / hívás és mellékletek", "Mesaj / apel și atașamente", "Messaggio / chiamata e allegati", "Nachricht / Anruf und Anhänge"],
  match: ["Match terms", "Zhoda výrazov", "Shoda výrazů", "Kifejezések egyezése", "Potrivire termeni", "Corrispondenza termini", "Begriffe abgleichen"],
  any: ["Any term", "Ktorýkoľvek výraz", "Kterýkoli výraz", "Bármelyik kifejezés", "Orice termen", "Qualsiasi termine", "Beliebiger Begriff"],
  every: ["All terms", "Všetky výrazy", "Všechny výrazy", "Minden kifejezés", "Toți termenii", "Tutti i termini", "Alle Begriffe"],
  caseSensitive: ["Case-sensitive", "Rozlišovať malé a veľké písmená", "Rozlišovat malá a velká písmena", "Kis- és nagybetűk megkülönböztetése", "Sensibil la majuscule", "Distingui maiuscole/minuscole", "Groß-/Kleinschreibung beachten"],
  emptyError: ["Add at least one search term.", "Pridajte aspoň jeden hľadaný výraz.", "Přidejte alespoň jeden hledaný výraz.", "Adjon meg legalább egy keresési kifejezést.", "Adăugați cel puțin un termen de căutare.", "Aggiungi almeno un termine di ricerca.", "Fügen Sie mindestens einen Suchbegriff hinzu."],
  tooManyError: ["Use no more than 20 search terms.", "Použite najviac 20 hľadaných výrazov.", "Použijte nejvýše 20 hledaných výrazů.", "Legfeljebb 20 keresési kifejezést használjon.", "Folosiți cel mult 20 de termeni de căutare.", "Usa al massimo 20 termini di ricerca.", "Verwenden Sie höchstens 20 Suchbegriffe."],
  tooLongError: ["Each search term can be no longer than 200 characters.", "Každý hľadaný výraz môže mať najviac 200 znakov.", "Každý hledaný výraz může mít nejvýše 200 znaků.", "Egy keresési kifejezés legfeljebb 200 karakter lehet.", "Fiecare termen de căutare poate avea cel mult 200 de caractere.", "Ogni termine di ricerca può contenere al massimo 200 caratteri.", "Jeder Suchbegriff darf höchstens 200 Zeichen enthalten."]
} as const;

export function getTextSearchCopy(locale: Locale) {
  const index = Math.max(0, locales.indexOf(locale as typeof locales[number]));
  return Object.fromEntries(Object.entries(strings).map(([key, values]) => [key, values[index]])) as Record<keyof typeof strings, string>;
}
