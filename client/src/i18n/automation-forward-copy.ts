import type { Locale } from "./translations";
const locales = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;
const strings = {
  heading: ["Forward email / SMS", "Preposlať e-mail / SMS", "Přeposlat e-mail / SMS", "E-mail / SMS továbbítása", "Redirecționează e-mail / SMS", "Inoltra e-mail / SMS", "E-Mail / SMS weiterleiten"],
  help: ["After analysis and IF, forward the authorized original. User and Back Office destinations create an internal task with private files; email uses the rule author's mailbox.",
    "Po analýze a IF odovzdá oprávnený originál. Používateľ a Back Office dostanú internú úlohu s privátnymi súbormi; e-mail odošle schránka autora pravidla.",
    "Po analýze a IF předá oprávněný originál. Uživatel a Back Office dostanou interní úkol se soukromými soubory; e-mail odešle schránka autora pravidla.",
    "Az elemzés és az IF után továbbítja az engedélyezett eredetit. A felhasználó és a Back Office belső feladatot kap privát fájlokkal; az e-mailt a szabály szerzője küldi.",
    "După analiză și IF, redirecționează originalul autorizat. Utilizatorul și Back Office primesc o sarcină internă cu fișiere private; e-mailul folosește contul autorului regulii.",
    "Dopo l'analisi e IF inoltra l'originale autorizzato. Utente e Back Office ricevono un'attività interna con file privati; l'e-mail usa la casella dell'autore della regola.",
    "Nach Analyse und IF wird das berechtigte Original weitergeleitet. Benutzer und Back Office erhalten eine interne Aufgabe mit privaten Dateien; E-Mail nutzt das Postfach des Regelautors."],
  destination: ["Destination", "Cieľ", "Cíl", "Cél", "Destinație", "Destinazione", "Ziel"],
  email: ["Email recipient", "E-mailový príjemca", "E-mailový příjemce", "E-mail-címzett", "Destinatar e-mail", "Destinatario e-mail", "E-Mail-Empfänger"],
  user: ["INDEXUS user (internal task)", "Používateľ INDEXUS (interná úloha)", "Uživatel INDEXUS (interní úkol)", "INDEXUS-felhasználó (belső feladat)", "Utilizator INDEXUS (sarcină internă)", "Utente INDEXUS (attività interna)", "INDEXUS-Benutzer (interne Aufgabe)"],
  backOffice: ["Back Office group", "Skupina Back Office", "Skupina Back Office", "Back Office csoport", "Grup Back Office", "Gruppo Back Office", "Back-Office-Gruppe"],
  choose: ["Choose recipient", "Vyberte príjemcu", "Vyberte příjemce", "Válasszon címzettet", "Alegeți destinatarul", "Scegli il destinatario", "Empfänger auswählen"],
  mode: ["What to forward", "Čo preposlať", "Co přeposlat", "Mit továbbítson", "Ce se redirecționează", "Cosa inoltrare", "Was weiterleiten"],
  whole: ["Whole message with all attachments", "Celú správu so všetkými prílohami", "Celou zprávu se všemi přílohami", "Teljes üzenet az összes melléklettel", "Mesajul complet cu toate atașamentele", "Messaggio completo con tutti gli allegati", "Ganze Nachricht mit allen Anhängen"],
  attachments: ["Attachments only (email)", "Iba prílohy (e-mail)", "Pouze přílohy (e-mail)", "Csak mellékletek (e-mail)", "Doar atașamentele (e-mail)", "Solo allegati (e-mail)", "Nur Anhänge (E-Mail)"],
  selection: ["Which attachments", "Ktoré prílohy", "Které přílohy", "Mely mellékletek", "Care atașamente", "Quali allegati", "Welche Anhänge"],
  invoice: ["Content-recognized invoices only", "Iba obsahovo rozpoznané faktúry", "Pouze obsahově rozpoznané faktury", "Csak tartalom alapján felismert számlák", "Doar facturile recunoscute după conținut", "Solo fatture riconosciute dal contenuto", "Nur inhaltlich erkannte Rechnungen"],
  all: ["All file attachments", "Všetky súborové prílohy", "Všechny souborové přílohy", "Minden fájlmelléklet", "Toate fișierele atașate", "Tutti i file allegati", "Alle Dateianhänge"],
  original: ["A whole email is retained as original-email.eml, including original headers and all attachments. SMS keeps its original text. No message is sent while editing.",
    "Celý e-mail sa zachová ako original-email.eml vrátane pôvodných hlavičiek a všetkých príloh. SMS zachová pôvodný text. Pri úpravách sa nič neodosiela.",
    "Celý e-mail se zachová jako original-email.eml včetně původních hlaviček a všech příloh. SMS zachová původní text. Při úpravách se nic neodesílá.",
    "A teljes e-mail original-email.eml formában megőrzi az eredeti fejléceket és mellékleteket. Az SMS eredeti szövege megmarad. Szerkesztéskor nincs küldés.",
    "E-mailul complet se păstrează ca original-email.eml, cu antetele și toate atașamentele originale. SMS păstrează textul original. Editarea nu trimite mesaje.",
    "L'e-mail completa viene conservata come original-email.eml con intestazioni e allegati originali. L'SMS conserva il testo originale. La modifica non invia messaggi.",
    "Die ganze E-Mail bleibt als original-email.eml mit Originalkopfzeilen und allen Anhängen erhalten. SMS behält den Originaltext. Beim Bearbeiten wird nichts gesendet."],
  invalid: ["Complete the forwarding destination.", "Doplňte cieľ preposlania.", "Doplňte cíl přeposlání.", "Töltse ki a továbbítás célját.", "Completați destinația.", "Completa la destinazione.", "Weiterleitungsziel vervollständigen."],
};
export function getForwardCopy(locale: Locale) {
  const index = Math.max(0, locales.indexOf(locale as typeof locales[number]));
  return Object.fromEntries(Object.entries(strings).map(([key, values]) => [key, values[index]])) as Record<keyof typeof strings, string>;
}
