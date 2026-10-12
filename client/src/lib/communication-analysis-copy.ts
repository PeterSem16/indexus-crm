import type { Locale } from "@/i18n";

export type CommunicationAnalysisLocale = Extract<Locale, "en" | "sk" | "cs" | "hu" | "ro" | "it" | "de">;
export type CommunicationAnalysisCopy = {
  analysisTitle: string;
  analysisDescription: string;
  fieldLabels: Record<string, string>;
  optionLabels: Record<string, string>;
  generalAutomation: { title: string; hint: string };
  analysisSource: string;
  analysisWhen: string;
  conversionUnavailable: string;
  conversionDescription: string;
  externalChannelHint: string;
  legacyPreserved: string;
  emailAction: string;
  smsAction: string;
  countryCode: string;
  provider: string;
  any: string;
  yes: string;
  no: string;
  selected: string;
  matchHelp: string;
  preservedCondition: string;
  malformedCondition: string;
  nonAnalysisHint: string;
  legacySmsScope: string;
  legacyHandoff: string;
  pausedHandoff: string;
  startEmail: string;
  startSms: string;
  startInApp: string;
  noAutomationCallback: string;
};

const commonFields: Record<string, string> = {
  "newValues.countryCode": "Country",
  "newValues.type": "Message type",
  "newValues.sentiment": "Message sentiment",
  "newValues.alertLevel": "Alert level",
  "newValues.provider": "SMS provider",
  "newValues.hasAngryTone": "Angry tone",
  "newValues.hasRudeExpressions": "Rude language",
  "newValues.wantsToCancel": "Wants to cancel",
  "newValues.wantsConsent": "Asks for consent",
  "newValues.doesNotAcceptContract": "Does not accept the contract",
};
const commonOptions: Record<string, string> = {
  positive: "Positive", neutral: "Neutral", negative: "Negative", angry: "Angry", none: "None",
  warning: "Warning", critical: "Critical", smstools: "SMSTOOLS", bulkgate: "BulkGate", email: "Email", sms: "SMS",
};
const languages: Record<CommunicationAnalysisLocale, {
  fields: Record<string, string>; options: Record<string, string>; heading: string; description: string;
  automation: string; automationHint: string; source: string; when: string; conversion: string; conversionHint: string;
  preserved: string; email: string; sms: string; country: string; provider: string; any: string; yes: string; no: string;
  selected: string; matching: string; kept: string; malformed: string; handoff: string; paused: string;
  nonAnalysis: string; smsScope: string;
  channelHint: string;
  startEmail: string; startSms: string; startInApp: string; notConnected: string;
}> = {
  en: {
    fields: commonFields, options: { ...commonOptions, low: "Low", medium: "Medium", high: "High" },
    heading: "Message analysis", description: "Choose the signals that should match. Every row must match; multiple choices in a row mean any of them.",
    automation: "Build this as an automation", automationHint: "Analysis automations can combine message signals with follow-up actions.",
    source: "Communication analysis", when: "After an SMS or email has been analyzed",
    conversion: "Some saved conditions cannot be transferred automatically",
    conversionHint: "The original notification rule stays unchanged. The new automation draft starts paused for review.",
    channelHint: "These notification rules deliver in-app only. For email or SMS, use the corresponding action in a general automation.",
    preserved: "This saved rule includes conditions that are not shown here. They will stay saved unless you edit that specific condition.",
    email: "Send an email", sms: "Send an SMS", country: "Country", provider: "SMS provider",
    any: "Any", yes: "Yes", no: "No", selected: "selected",
    matching: "All chosen rows must match. If a row has several choices, any one can match.",
    kept: "Saved condition kept", malformed: "These saved conditions cannot be edited here. They will be kept as-is.",
    nonAnalysis: "This trigger does not use communication-analysis filters. Use a general automation to analyze messages; this saved snapshot is shown for reference only.",
    smsScope: "Legacy analysis filters apply to SMS triggers. Use a general automation to combine analyzed SMS and email sources.",
    handoff: "This creates a separate automation. Your current notification rule is not saved, changed, or fired.",
    paused: "The new automation will start paused so you can review it before it runs.",
    startEmail: "Create email automation", startSms: "Create SMS automation", startInApp: "Create analysis automation",
    notConnected: "General automation setup is not connected here. Your notification rule and saved channel flags remain unchanged.",
  },
  sk: {
    fields: {
      "newValues.countryCode": "Krajina", "newValues.type": "Typ správy", "newValues.sentiment": "Sentiment správy",
      "newValues.alertLevel": "Úroveň upozornenia", "newValues.provider": "Poskytovateľ SMS", "newValues.hasAngryTone": "Nahnevaný tón",
      "newValues.hasRudeExpressions": "Hrubý jazyk", "newValues.wantsToCancel": "Chce zrušiť", "newValues.wantsConsent": "Žiada súhlas",
      "newValues.doesNotAcceptContract": "Neprijíma zmluvu",
    },
    options: { positive: "Pozitívny", neutral: "Neutrálny", negative: "Negatívny", angry: "Nahnevaný", none: "Žiadny", warning: "Upozornenie", critical: "Kritická", smstools: "SMSTOOLS", bulkgate: "BulkGate", email: "E-mail", sms: "SMS", low: "Nízka", medium: "Stredná", high: "Vysoká" },
    heading: "Analýza správy", description: "Vyberte signály, ktoré sa majú zhodovať. Musí platiť každý riadok; pri viacerých voľbách stačí ktorákoľvek.",
    automation: "Vytvoriť automatizáciu", automationHint: "Automatizácie analýzy môžu spájať signály správy s následnými akciami.",
    source: "Analýza komunikácie", when: "Po analýze SMS alebo e-mailu",
    conversion: "Niektoré uložené podmienky nemožno automaticky preniesť",
    conversionHint: "Pôvodné pravidlo upozornenia zostane nezmenené. Nový návrh automatizácie sa začne pozastavený na kontrolu.",
    channelHint: "Tieto pravidlá doručujú iba upozornenia v aplikácii. Na e-mail alebo SMS použite príslušnú akciu vo všeobecnej automatizácii.",
    preserved: "Toto uložené pravidlo obsahuje podmienky, ktoré tu nezobrazujeme. Zostanú uložené, kým neupravíte konkrétnu podmienku.",
    email: "Poslať e-mail", sms: "Poslať SMS", country: "Krajina", provider: "Poskytovateľ SMS",
    any: "Ľubovoľné", yes: "Áno", no: "Nie", selected: "vybraté",
    matching: "Musia platiť všetky vybraté riadky. Pri viacerých voľbách stačí jedna.",
    kept: "Uložená podmienka zostáva", malformed: "Tieto uložené podmienky tu nemožno upraviť. Zostanú nezmenené.",
    nonAnalysis: "Tento spúšťač nepoužíva filtre analýzy komunikácie. Na analýzu správ použite všeobecnú automatizáciu; uložený snímok je tu iba na čítanie.",
    smsScope: "Staršie filtre analýzy platia pre SMS spúšťače. Na spojenie analyzovaných SMS a e-mailov použite všeobecnú automatizáciu.",
    handoff: "Vznikne samostatná automatizácia. Toto pravidlo upozornenia sa neuloží, nezmení ani nespustí.",
    paused: "Nová automatizácia bude na začiatku pozastavená, aby ste ju mohli skontrolovať.",
    startEmail: "Vytvoriť e-mailovú automatizáciu", startSms: "Vytvoriť SMS automatizáciu", startInApp: "Vytvoriť automatizáciu analýzy",
    notConnected: "Nastavenie všeobecnej automatizácie tu nie je pripojené. Pravidlo aj uložené kanály zostanú nezmenené.",
  },
  cs: {
    fields: {
      "newValues.countryCode": "Země", "newValues.type": "Typ zprávy", "newValues.sentiment": "Sentiment zprávy",
      "newValues.alertLevel": "Úroveň upozornění", "newValues.provider": "Poskytovatel SMS", "newValues.hasAngryTone": "Rozzlobený tón",
      "newValues.hasRudeExpressions": "Hrubý jazyk", "newValues.wantsToCancel": "Chce zrušit", "newValues.wantsConsent": "Žádá o souhlas",
      "newValues.doesNotAcceptContract": "Nepřijímá smlouvu",
    },
    options: { positive: "Pozitivní", neutral: "Neutrální", negative: "Negativní", angry: "Rozzlobený", none: "Žádný", warning: "Varování", critical: "Kritická", smstools: "SMSTOOLS", bulkgate: "BulkGate", email: "E-mail", sms: "SMS", low: "Nízká", medium: "Střední", high: "Vysoká" },
    heading: "Analýza zprávy", description: "Vyberte signály, které se mají shodovat. Platit musí každý řádek; u více možností stačí kterákoli.",
    automation: "Vytvořit automatizaci", automationHint: "Automatizace analýzy mohou spojit signály zprávy s navazujícími akcemi.",
    source: "Analýza komunikace", when: "Po analýze SMS nebo e-mailu",
    conversion: "Některé uložené podmínky nelze automaticky převést",
    conversionHint: "Původní pravidlo oznámení zůstane beze změny. Nový návrh automatizace se spustí pozastavený ke kontrole.",
    channelHint: "Tato pravidla doručují pouze oznámení v aplikaci. Pro e-mail nebo SMS použijte příslušnou akci v obecné automatizaci.",
    preserved: "Toto uložené pravidlo obsahuje podmínky, které zde nezobrazujeme. Zůstanou uložené, dokud neupravíte konkrétní podmínku.",
    email: "Odeslat e-mail", sms: "Odeslat SMS", country: "Země", provider: "Poskytovatel SMS",
    any: "Libovolné", yes: "Ano", no: "Ne", selected: "vybráno",
    matching: "Platí všechny vybrané řádky. Pokud má řádek více možností, stačí jedna.",
    kept: "Uložená podmínka zachována", malformed: "Tyto uložené podmínky zde nelze upravit. Zůstanou beze změny.",
    nonAnalysis: "Tento spouštěč nepoužívá filtry analýzy komunikace. K analýze zpráv použijte obecnou automatizaci; uložený snímek je pouze pro čtení.",
    smsScope: "Starší filtry analýzy platí pro SMS spouštěče. Pro spojení analyzovaných SMS a e-mailů použijte obecnou automatizaci.",
    handoff: "Vznikne samostatná automatizace. Toto pravidlo oznámení se neuloží, nezmění ani nespustí.",
    paused: "Nová automatizace bude nejprve pozastavena, abyste ji mohli zkontrolovat.",
    startEmail: "Vytvořit e-mailovou automatizaci", startSms: "Vytvořit SMS automatizaci", startInApp: "Vytvořit automatizaci analýzy",
    notConnected: "Nastavení obecné automatizace zde není připojeno. Pravidlo i uložené kanály zůstanou beze změny.",
  },
  hu: {
    fields: {
      "newValues.countryCode": "Ország", "newValues.type": "Üzenet típusa", "newValues.sentiment": "Üzenet hangulata",
      "newValues.alertLevel": "Riasztási szint", "newValues.provider": "SMS-szolgáltató", "newValues.hasAngryTone": "Dühös hangnem",
      "newValues.hasRudeExpressions": "Durva kifejezések", "newValues.wantsToCancel": "Lemondaná", "newValues.wantsConsent": "Hozzájárulást kér",
      "newValues.doesNotAcceptContract": "Nem fogadja el a szerződést",
    },
    options: { positive: "Pozitív", neutral: "Semleges", negative: "Negatív", angry: "Dühös", none: "Nincs", warning: "Figyelmeztetés", critical: "Kritikus", smstools: "SMSTOOLS", bulkgate: "BulkGate", email: "E-mail", sms: "SMS", low: "Alacsony", medium: "Közepes", high: "Magas" },
    heading: "Üzenetelemzés", description: "Válassza ki az egyező jeleket. Minden sornak teljesülnie kell; egy soron belül bármelyik választás elegendő.",
    automation: "Automatizálás létrehozása", automationHint: "Az elemzési automatizálás üzenetjeleket kapcsolhat össze következő műveletekkel.",
    source: "Kommunikációelemzés", when: "SMS vagy e-mail elemzése után",
    conversion: "Néhány mentett feltétel nem alakítható át automatikusan",
    conversionHint: "Az eredeti értesítési szabály változatlan marad. Az új automatizálási piszkozat szüneteltetve indul ellenőrzésre.",
    channelHint: "Ezek a szabályok csak alkalmazáson belüli értesítéseket küldenek. E-mailhez vagy SMS-hez használja az általános automatizálás megfelelő műveletét.",
    preserved: "A mentett szabály itt nem megjelenített feltételeket is tartalmaz. Ezek megmaradnak, amíg külön nem szerkeszti őket.",
    email: "E-mail küldése", sms: "SMS küldése", country: "Ország", provider: "SMS-szolgáltató",
    any: "Bármelyik", yes: "Igen", no: "Nem", selected: "kiválasztva",
    matching: "Minden kiválasztott sornak egyeznie kell. Egy sor több választása közül bármelyik megfelelő.",
    kept: "Mentett feltétel megőrizve", malformed: "Ezek a mentett feltételek itt nem szerkeszthetők, változatlanok maradnak.",
    nonAnalysis: "Ez az esemény nem használ kommunikációelemzési szűrőket. Üzenetelemzéshez használjon általános automatizálást; a mentett feltétel csak olvasható.",
    smsScope: "A régi elemzési szűrők SMS-eseményekre vonatkoznak. Az elemzett SMS- és e-mail-források összekapcsolásához használjon általános automatizálást.",
    handoff: "Külön automatizálás jön létre. A jelenlegi értesítési szabály nem kerül mentésre, módosításra vagy futtatásra.",
    paused: "Az új automatizálás szüneteltetve indul, így futtatás előtt átnézheti.",
    startEmail: "E-mail-automatizálás létrehozása", startSms: "SMS-automatizálás létrehozása", startInApp: "Elemzési automatizálás létrehozása",
    notConnected: "Az általános automatizálás beállítása itt nincs összekötve. A szabály és a mentett csatornák változatlanok maradnak.",
  },
  ro: {
    fields: {
      "newValues.countryCode": "Țară", "newValues.type": "Tipul mesajului", "newValues.sentiment": "Sentimentul mesajului",
      "newValues.alertLevel": "Nivel de alertă", "newValues.provider": "Furnizor SMS", "newValues.hasAngryTone": "Ton furios",
      "newValues.hasRudeExpressions": "Limbaj nepoliticos", "newValues.wantsToCancel": "Dorește anularea", "newValues.wantsConsent": "Solicită consimțământul",
      "newValues.doesNotAcceptContract": "Nu acceptă contractul",
    },
    options: { positive: "Pozitiv", neutral: "Neutru", negative: "Negativ", angry: "Furios", none: "Niciunul", warning: "Avertizare", critical: "Critic", smstools: "SMSTOOLS", bulkgate: "BulkGate", email: "E-mail", sms: "SMS", low: "Scăzut", medium: "Mediu", high: "Ridicat" },
    heading: "Analiza mesajului", description: "Alegeți semnalele care trebuie să se potrivească. Fiecare rând trebuie să corespundă; în același rând este suficientă oricare opțiune.",
    automation: "Creează o automatizare", automationHint: "Automatizările de analiză pot combina semnalele mesajelor cu acțiuni ulterioare.",
    source: "Analiza comunicării", when: "După analizarea unui SMS sau e-mail",
    conversion: "Unele condiții salvate nu pot fi transferate automat",
    conversionHint: "Regula originală rămâne neschimbată. Noua automatizare începe în pauză pentru verificare.",
    channelHint: "Aceste reguli trimit doar notificări în aplicație. Pentru e-mail sau SMS, folosiți acțiunea corespunzătoare într-o automatizare generală.",
    preserved: "Această regulă salvată include condiții care nu sunt afișate aici. Se păstrează până când editați condiția respectivă.",
    email: "Trimite un e-mail", sms: "Trimite un SMS", country: "Țară", provider: "Furnizor SMS",
    any: "Oricare", yes: "Da", no: "Nu", selected: "selectate",
    matching: "Toate rândurile alese trebuie să corespundă. Dacă un rând are mai multe opțiuni, este suficientă oricare.",
    kept: "Condiție salvată păstrată", malformed: "Aceste condiții salvate nu pot fi editate aici și vor rămâne neschimbate.",
    nonAnalysis: "Acest declanșator nu folosește filtre de analiză a comunicării. Folosiți o automatizare generală pentru analiza mesajelor; condiția salvată este doar pentru citire.",
    smsScope: "Filtrele vechi de analiză se aplică declanșatoarelor SMS. Folosiți o automatizare generală pentru a combina SMS-urile și e-mailurile analizate.",
    handoff: "Se creează o automatizare separată. Regula actuală nu este salvată, modificată sau declanșată.",
    paused: "Noua automatizare va porni în pauză, ca să o puteți verifica înainte de activare.",
    startEmail: "Creează automatizare pentru e-mail", startSms: "Creează automatizare pentru SMS", startInApp: "Creează automatizare de analiză",
    notConnected: "Configurarea automatizărilor generale nu este conectată aici. Regula și canalele salvate rămân neschimbate.",
  },
  it: {
    fields: {
      "newValues.countryCode": "Paese", "newValues.type": "Tipo di messaggio", "newValues.sentiment": "Tono del messaggio",
      "newValues.alertLevel": "Livello di allerta", "newValues.provider": "Provider SMS", "newValues.hasAngryTone": "Tono arrabbiato",
      "newValues.hasRudeExpressions": "Linguaggio scortese", "newValues.wantsToCancel": "Vuole annullare", "newValues.wantsConsent": "Chiede il consenso",
      "newValues.doesNotAcceptContract": "Non accetta il contratto",
    },
    options: { positive: "Positivo", neutral: "Neutro", negative: "Negativo", angry: "Arrabbiato", none: "Nessuno", warning: "Avviso", critical: "Critico", smstools: "SMSTOOLS", bulkgate: "BulkGate", email: "E-mail", sms: "SMS", low: "Basso", medium: "Medio", high: "Alto" },
    heading: "Analisi del messaggio", description: "Scegli i segnali da confrontare. Ogni riga deve corrispondere; nella stessa riga basta una qualsiasi opzione.",
    automation: "Crea un’automazione", automationHint: "Le automazioni di analisi combinano i segnali del messaggio con azioni successive.",
    source: "Analisi della comunicazione", when: "Dopo l’analisi di un SMS o un’e-mail",
    conversion: "Alcune condizioni salvate non possono essere convertite automaticamente",
    conversionHint: "La regola originale resta invariata. La nuova bozza di automazione parte in pausa per la revisione.",
    channelHint: "Queste regole inviano solo notifiche nell’app. Per e-mail o SMS usa l’azione corrispondente in un’automazione generale.",
    preserved: "Questa regola contiene condizioni salvate che qui non vengono mostrate. Restano salvate finché non modifichi quella condizione.",
    email: "Invia un’e-mail", sms: "Invia un SMS", country: "Paese", provider: "Provider SMS",
    any: "Qualsiasi", yes: "Sì", no: "No", selected: "selezionati",
    matching: "Tutte le righe scelte devono corrispondere. Con più opzioni in una riga, ne basta una.",
    kept: "Condizione salvata mantenuta", malformed: "Queste condizioni non si possono modificare qui e resteranno invariate.",
    nonAnalysis: "Questo trigger non usa filtri di analisi della comunicazione. Usa un’automazione generale per analizzare i messaggi; la condizione salvata è solo in lettura.",
    smsScope: "I filtri di analisi legacy si applicano ai trigger SMS. Usa un’automazione generale per combinare SMS ed e-mail analizzati.",
    handoff: "Viene creata un’automazione separata. La regola attuale non viene salvata, modificata o attivata.",
    paused: "La nuova automazione parte in pausa, così puoi controllarla prima di attivarla.",
    startEmail: "Crea automazione e-mail", startSms: "Crea automazione SMS", startInApp: "Crea automazione di analisi",
    notConnected: "La configurazione delle automazioni generali non è collegata qui. Regola e canali salvati restano invariati.",
  },
  de: {
    fields: {
      "newValues.countryCode": "Land", "newValues.type": "Nachrichtentyp", "newValues.sentiment": "Stimmung der Nachricht",
      "newValues.alertLevel": "Warnstufe", "newValues.provider": "SMS-Anbieter", "newValues.hasAngryTone": "Verärgerter Ton",
      "newValues.hasRudeExpressions": "Unhöfliche Sprache", "newValues.wantsToCancel": "Möchte kündigen", "newValues.wantsConsent": "Fragt nach Zustimmung",
      "newValues.doesNotAcceptContract": "Akzeptiert den Vertrag nicht",
    },
    options: { positive: "Positiv", neutral: "Neutral", negative: "Negativ", angry: "Verärgert", none: "Keines", warning: "Warnung", critical: "Kritisch", smstools: "SMSTOOLS", bulkgate: "BulkGate", email: "E-Mail", sms: "SMS", low: "Niedrig", medium: "Mittel", high: "Hoch" },
    heading: "Nachrichtenanalyse", description: "Wähle passende Signale aus. Jede Zeile muss zutreffen; bei mehreren Optionen pro Zeile genügt eine davon.",
    automation: "Automation erstellen", automationHint: "Analyse-Automationen verbinden Nachrichtensignale mit Folgeaktionen.",
    source: "Kommunikationsanalyse", when: "Nachdem eine SMS oder E-Mail analysiert wurde",
    conversion: "Einige gespeicherte Bedingungen lassen sich nicht automatisch übertragen",
    conversionHint: "Die ursprüngliche Benachrichtigungsregel bleibt unverändert. Der neue Automationsentwurf startet pausiert zur Prüfung.",
    channelHint: "Diese Regeln senden nur Benachrichtigungen in der App. Für E-Mail oder SMS nutze die entsprechende Aktion in einer allgemeinen Automation.",
    preserved: "Diese gespeicherte Regel enthält hier nicht angezeigte Bedingungen. Sie bleiben erhalten, bis du sie einzeln bearbeitest.",
    email: "E-Mail senden", sms: "SMS senden", country: "Land", provider: "SMS-Anbieter",
    any: "Beliebig", yes: "Ja", no: "Nein", selected: "ausgewählt",
    matching: "Alle ausgewählten Zeilen müssen zutreffen. Bei mehreren Optionen in einer Zeile genügt eine.",
    kept: "Gespeicherte Bedingung bleibt erhalten", malformed: "Diese gespeicherten Bedingungen können hier nicht bearbeitet werden und bleiben unverändert.",
    nonAnalysis: "Dieser Auslöser verwendet keine Kommunikationsanalyse-Filter. Nutze eine allgemeine Automation zur Nachrichtenanalyse; die gespeicherte Bedingung ist schreibgeschützt.",
    smsScope: "Ältere Analysefilter gelten für SMS-Auslöser. Nutze eine allgemeine Automation, um analysierte SMS- und E-Mail-Quellen zu kombinieren.",
    handoff: "Es wird eine separate Automation erstellt. Die aktuelle Benachrichtigungsregel wird weder gespeichert noch geändert oder ausgelöst.",
    paused: "Die neue Automation startet pausiert, damit du sie vor dem Aktivieren prüfen kannst.",
    startEmail: "E-Mail-Automation erstellen", startSms: "SMS-Automation erstellen", startInApp: "Analyse-Automation erstellen",
    notConnected: "Die allgemeine Automationseinrichtung ist hier nicht verbunden. Regel und gespeicherte Kanäle bleiben unverändert.",
  },
};

export function getCommunicationAnalysisCopy(locale: Locale): CommunicationAnalysisCopy {
  const language = languages[(locale in languages ? locale : "en") as CommunicationAnalysisLocale];
  return {
    analysisTitle: language.heading,
    analysisDescription: language.description,
    fieldLabels: language.fields,
    optionLabels: language.options,
    generalAutomation: { title: language.automation, hint: language.automationHint },
    analysisSource: language.source,
    analysisWhen: language.when,
    conversionUnavailable: language.conversion,
    conversionDescription: language.conversionHint,
    externalChannelHint: language.channelHint,
    legacyPreserved: language.preserved,
    emailAction: language.email,
    smsAction: language.sms,
    countryCode: language.country,
    provider: language.provider,
    any: language.any,
    yes: language.yes,
    no: language.no,
    selected: language.selected,
    matchHelp: language.matching,
    preservedCondition: language.kept,
    malformedCondition: language.malformed,
    nonAnalysisHint: language.nonAnalysis,
    legacySmsScope: language.smsScope,
    legacyHandoff: language.handoff,
    pausedHandoff: language.paused,
    startEmail: language.startEmail,
    startSms: language.startSms,
    startInApp: language.startInApp,
    noAutomationCallback: language.notConnected,
  };
}
