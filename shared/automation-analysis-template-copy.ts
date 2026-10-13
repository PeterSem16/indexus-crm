export const AUTOMATION_ANALYSIS_TEMPLATE_LANGUAGES = ["sk", "en", "cs", "hu", "ro", "it", "de"] as const;
export type AutomationAnalysisTemplateLanguage = typeof AUTOMATION_ANALYSIS_TEMPLATE_LANGUAGES[number];
export const AUTOMATION_ANALYSIS_TEMPLATE_KEYS = [
  "positive-sentiment", "negative-sentiment", "urgent-tone", "invoice-found",
  "complaint", "reply-needed", "callback-requested", "thank-you",
] as const;
export type AutomationAnalysisTemplateKey = typeof AUTOMATION_ANALYSIS_TEMPLATE_KEYS[number];

export type AutomationAnalysisVariantCopy = { name: string; summary: string; sms: string };
export type AutomationAnalysisLocaleCopy = {
  badge: string;
  preheader: string;
  sectionHeading: string;
  sectionBody: string;
  cta: string;
  artworkAlt: string;
  linkTitle: string;
  notificationSummaryPrefix: string;
  variants: Record<AutomationAnalysisTemplateKey, AutomationAnalysisVariantCopy>;
};

const localized: Record<AutomationAnalysisTemplateLanguage, AutomationAnalysisLocaleCopy> = {
  sk: {
    badge: "ANALÝZA KOMUNIKÁCIE",
    preheader: "V INDEXUS je pripravený bezpečný prehľad analyzovanej komunikácie.",
    sectionHeading: "Skontrolujte v INDEXUS",
    sectionBody: "E-mail neobsahuje pôvodný text komunikácie ani kontaktné údaje. Po prihlásení si overte kontext a rozhodnite o ďalšom postupe.",
    cta: "Otvoriť INDEXUS",
    artworkAlt: "Ilustrácia bezpečného prehľadu komunikácie",
    linkTitle: "Otvorte príslušný záznam v INDEXUS",
    notificationSummaryPrefix: "Interný súhrn:",
    variants: {
      "positive-sentiment": { name: "Pozitívny sentiment", summary: "Analýza označila komunikáciu ako pozitívnu. Kontext si overte v INDEXUS.", sms: "Analýza označila pozitívnu komunikáciu. Skontrolujte ju v INDEXUS." },
      "negative-sentiment": { name: "Negatívny sentiment", summary: "Analýza označila komunikáciu ako negatívnu. Skontrolujte ju v INDEXUS.", sms: "Analýza označila negatívnu komunikáciu. Skontrolujte ju v INDEXUS." },
      "urgent-tone": { name: "Urgentný alebo nahnevaný tón", summary: "Analýza zaznamenala naliehavý alebo nahnevaný tón. Situáciu posúďte v INDEXUS.", sms: "Analýza zaznamenala naliehavý tón. Posúďte ho v INDEXUS." },
      "invoice-found": { name: "Nájdená faktúra v prílohe", summary: "Analýza rozpoznala faktúru v prílohe. Skontrolujte dokument v INDEXUS.", sms: "Analýza rozpoznala faktúru v prílohe. Skontrolujte ju v INDEXUS." },
      complaint: { name: "Rozpoznaná sťažnosť", summary: "Analýza rozpoznala sťažnosť. Preverte komunikáciu a ďalší postup v INDEXUS.", sms: "Analýza rozpoznala sťažnosť. Preverte ďalší postup v INDEXUS." },
      "reply-needed": { name: "Vyžaduje sa odpoveď", summary: "Analýza naznačuje, že komunikácia vyžaduje odpoveď. Skontrolujte ju v INDEXUS.", sms: "Komunikácia môže vyžadovať odpoveď. Skontrolujte ju v INDEXUS." },
      "callback-requested": { name: "Požiadavka na spätné zavolanie", summary: "Analýza zaznamenala požiadavku na spätné zavolanie. Overte ju v INDEXUS.", sms: "Zaznamenaná požiadavka na spätné zavolanie. Overte ju v INDEXUS." },
      "thank-you": { name: "Poďakovanie v komunikácii", summary: "Analýza rozpoznala poďakovanie. Kontext nájdete v INDEXUS.", sms: "Analýza rozpoznala poďakovanie. Kontext nájdete v INDEXUS." },
    },
  },
  en: {
    badge: "COMMUNICATION ANALYSIS",
    preheader: "A secure review of the analyzed communication is available in INDEXUS.",
    sectionHeading: "Review in INDEXUS",
    sectionBody: "This email contains no original message text or contact details. Sign in to review the context and decide on the next step.",
    cta: "Open INDEXUS",
    artworkAlt: "Illustration of a secure communication review",
    linkTitle: "Open the relevant record in INDEXUS",
    notificationSummaryPrefix: "Internal summary:",
    variants: {
      "positive-sentiment": { name: "Positive sentiment", summary: "Analysis marked the communication as positive. Review its context in INDEXUS.", sms: "Analysis marked a positive communication. Review it in INDEXUS." },
      "negative-sentiment": { name: "Negative sentiment", summary: "Analysis marked the communication as negative. Review it in INDEXUS.", sms: "Analysis marked a negative communication. Review it in INDEXUS." },
      "urgent-tone": { name: "Urgent or angry tone", summary: "Analysis detected an urgent or angry tone. Assess the situation in INDEXUS.", sms: "Analysis detected an urgent tone. Review it in INDEXUS." },
      "invoice-found": { name: "Invoice found in attachment", summary: "Analysis detected an invoice in an attachment. Review the document in INDEXUS.", sms: "Analysis detected an invoice attachment. Review it in INDEXUS." },
      complaint: { name: "Complaint detected", summary: "Analysis detected a complaint. Review the communication and next steps in INDEXUS.", sms: "Analysis detected a complaint. Review next steps in INDEXUS." },
      "reply-needed": { name: "Reply may be needed", summary: "Analysis indicates that a reply may be needed. Review the communication in INDEXUS.", sms: "A reply may be needed. Review the communication in INDEXUS." },
      "callback-requested": { name: "Callback requested", summary: "Analysis detected a callback request. Review it in INDEXUS.", sms: "Analysis detected a callback request. Review it in INDEXUS." },
      "thank-you": { name: "Thank-you detected", summary: "Analysis detected a thank-you. Review its context in INDEXUS.", sms: "Analysis detected a thank-you. Review its context in INDEXUS." },
    },
  },
  cs: {
    badge: "ANALÝZA KOMUNIKACE",
    preheader: "V INDEXUS je připraven bezpečný přehled analyzované komunikace.",
    sectionHeading: "Zkontrolujte v INDEXUS",
    sectionBody: "E-mail neobsahuje původní text komunikace ani kontaktní údaje. Po přihlášení ověřte kontext a rozhodněte o dalším postupu.",
    cta: "Otevřít INDEXUS",
    artworkAlt: "Ilustrace bezpečného přehledu komunikace",
    linkTitle: "Otevřete příslušný záznam v INDEXUS",
    notificationSummaryPrefix: "Interní shrnutí:",
    variants: {
      "positive-sentiment": { name: "Pozitivní sentiment", summary: "Analýza označila komunikaci jako pozitivní. Kontext ověřte v INDEXUS.", sms: "Analýza označila pozitivní komunikaci. Zkontrolujte ji v INDEXUS." },
      "negative-sentiment": { name: "Negativní sentiment", summary: "Analýza označila komunikaci jako negativní. Zkontrolujte ji v INDEXUS.", sms: "Analýza označila negativní komunikaci. Zkontrolujte ji v INDEXUS." },
      "urgent-tone": { name: "Naléhavý nebo rozzlobený tón", summary: "Analýza zaznamenala naléhavý nebo rozzlobený tón. Situaci posuďte v INDEXUS.", sms: "Analýza zaznamenala naléhavý tón. Posuďte jej v INDEXUS." },
      "invoice-found": { name: "Faktura nalezena v příloze", summary: "Analýza rozpoznala fakturu v příloze. Zkontrolujte dokument v INDEXUS.", sms: "Analýza rozpoznala fakturu v příloze. Zkontrolujte ji v INDEXUS." },
      complaint: { name: "Rozpoznána stížnost", summary: "Analýza rozpoznala stížnost. Prověřte komunikaci a další postup v INDEXUS.", sms: "Analýza rozpoznala stížnost. Prověřte další postup v INDEXUS." },
      "reply-needed": { name: "Je potřeba odpovědět", summary: "Analýza naznačuje, že je potřeba odpovědět. Zkontrolujte komunikaci v INDEXUS.", sms: "Může být potřeba odpovědět. Zkontrolujte komunikaci v INDEXUS." },
      "callback-requested": { name: "Žádost o zpětné zavolání", summary: "Analýza zaznamenala žádost o zpětné zavolání. Ověřte ji v INDEXUS.", sms: "Byla zaznamenána žádost o zpětné zavolání. Ověřte ji v INDEXUS." },
      "thank-you": { name: "Poděkování v komunikaci", summary: "Analýza rozpoznala poděkování. Kontext najdete v INDEXUS.", sms: "Analýza rozpoznala poděkování. Kontext najdete v INDEXUS." },
    },
  },
  hu: {
    badge: "KOMMUNIKÁCIÓ ELEMZÉSE",
    preheader: "Az elemzett kommunikáció biztonságos áttekintése elérhető az INDEXUS-ban.",
    sectionHeading: "Ellenőrzés az INDEXUS-ban",
    sectionBody: "Ez az e-mail nem tartalmazza az eredeti üzenetet vagy kapcsolattartási adatokat. Jelentkezzen be, ellenőrizze a körülményeket, és döntsön a következő lépésről.",
    cta: "INDEXUS megnyitása",
    artworkAlt: "Biztonságos kommunikációs áttekintést ábrázoló illusztráció",
    linkTitle: "Nyissa meg a megfelelő rekordot az INDEXUS-ban",
    notificationSummaryPrefix: "Belső összefoglaló:",
    variants: {
      "positive-sentiment": { name: "Pozitív hangulat", summary: "Az elemzés pozitívnak jelölte a kommunikációt. A körülményeket ellenőrizze az INDEXUS-ban.", sms: "Az elemzés pozitív kommunikációt jelölt. Ellenőrizze az INDEXUS-ban." },
      "negative-sentiment": { name: "Negatív hangulat", summary: "Az elemzés negatívnak jelölte a kommunikációt. Ellenőrizze az INDEXUS-ban.", sms: "Az elemzés negatív kommunikációt jelölt. Ellenőrizze az INDEXUS-ban." },
      "urgent-tone": { name: "Sürgető vagy dühös hangnem", summary: "Az elemzés sürgető vagy dühös hangnemet észlelt. Mérje fel a helyzetet az INDEXUS-ban.", sms: "Az elemzés sürgető hangnemet észlelt. Ellenőrizze az INDEXUS-ban." },
      "invoice-found": { name: "Számla a mellékletben", summary: "Az elemzés számlát észlelt egy mellékletben. Ellenőrizze a dokumentumot az INDEXUS-ban.", sms: "Az elemzés számlát talált a mellékletben. Ellenőrizze az INDEXUS-ban." },
      complaint: { name: "Panasz észlelve", summary: "Az elemzés panaszt észlelt. Ellenőrizze a kommunikációt és a következő lépést az INDEXUS-ban.", sms: "Az elemzés panaszt észlelt. Ellenőrizze a következő lépést az INDEXUS-ban." },
      "reply-needed": { name: "Válasz szükséges", summary: "Az elemzés szerint válaszra lehet szükség. Ellenőrizze a kommunikációt az INDEXUS-ban.", sms: "Lehetséges, hogy válasz szükséges. Ellenőrizze az INDEXUS-ban." },
      "callback-requested": { name: "Visszahívást kértek", summary: "Az elemzés visszahívási kérést észlelt. Ellenőrizze az INDEXUS-ban.", sms: "Az elemzés visszahívási kérést jelzett. Ellenőrizze az INDEXUS-ban." },
      "thank-you": { name: "Köszönetnyilvánítás", summary: "Az elemzés köszönetnyilvánítást észlelt. A körülményeket az INDEXUS-ban találja.", sms: "Az elemzés köszönetnyilvánítást észlelt. Ellenőrizze az INDEXUS-ban." },
    },
  },
  ro: {
    badge: "ANALIZA COMUNICĂRII",
    preheader: "O verificare securizată a comunicării analizate este disponibilă în INDEXUS.",
    sectionHeading: "Verificați în INDEXUS",
    sectionBody: "Acest e-mail nu conține textul original al mesajului sau date de contact. Conectați-vă pentru a verifica contextul și a decide următorul pas.",
    cta: "Deschideți INDEXUS",
    artworkAlt: "Ilustrație a unei verificări securizate a comunicării",
    linkTitle: "Deschideți înregistrarea relevantă în INDEXUS",
    notificationSummaryPrefix: "Rezumat intern:",
    variants: {
      "positive-sentiment": { name: "Sentiment pozitiv", summary: "Analiza a clasificat comunicarea ca pozitivă. Verificați contextul în INDEXUS.", sms: "Analiza a detectat o comunicare pozitivă. Verificați în INDEXUS." },
      "negative-sentiment": { name: "Sentiment negativ", summary: "Analiza a clasificat comunicarea ca negativă. Verificați-o în INDEXUS.", sms: "Analiza a detectat o comunicare negativă. Verificați în INDEXUS." },
      "urgent-tone": { name: "Ton urgent sau furios", summary: "Analiza a detectat un ton urgent sau furios. Evaluați situația în INDEXUS.", sms: "Analiza a detectat un ton urgent. Verificați în INDEXUS." },
      "invoice-found": { name: "Factură găsită în atașament", summary: "Analiza a identificat o factură într-un atașament. Verificați documentul în INDEXUS.", sms: "Analiza a identificat o factură atașată. Verificați în INDEXUS." },
      complaint: { name: "Reclamație detectată", summary: "Analiza a detectat o reclamație. Verificați comunicarea și pașii următori în INDEXUS.", sms: "Analiza a detectat o reclamație. Verificați pașii următori în INDEXUS." },
      "reply-needed": { name: "Este posibil să fie necesar un răspuns", summary: "Analiza indică faptul că poate fi necesar un răspuns. Verificați comunicarea în INDEXUS.", sms: "Este posibil să fie necesar un răspuns. Verificați în INDEXUS." },
      "callback-requested": { name: "Solicitare de reapelare", summary: "Analiza a detectat o solicitare de reapelare. Verificați-o în INDEXUS.", sms: "Analiza a detectat o solicitare de reapelare. Verificați în INDEXUS." },
      "thank-you": { name: "Mesaj de mulțumire detectat", summary: "Analiza a detectat un mesaj de mulțumire. Verificați contextul în INDEXUS.", sms: "Analiza a detectat un mesaj de mulțumire. Verificați în INDEXUS." },
    },
  },
  it: {
    badge: "ANALISI DELLA COMUNICAZIONE",
    preheader: "In INDEXUS è disponibile una revisione sicura della comunicazione analizzata.",
    sectionHeading: "Verifica in INDEXUS",
    sectionBody: "Questa e-mail non contiene il testo originale della comunicazione né dati di contatto. Accedi per verificare il contesto e decidere il prossimo passo.",
    cta: "Apri INDEXUS",
    artworkAlt: "Illustrazione di una revisione sicura della comunicazione",
    linkTitle: "Apri il record pertinente in INDEXUS",
    notificationSummaryPrefix: "Riepilogo interno:",
    variants: {
      "positive-sentiment": { name: "Sentiment positivo", summary: "L’analisi ha classificato la comunicazione come positiva. Verifica il contesto in INDEXUS.", sms: "L’analisi ha rilevato una comunicazione positiva. Verifica in INDEXUS." },
      "negative-sentiment": { name: "Sentiment negativo", summary: "L’analisi ha classificato la comunicazione come negativa. Verificala in INDEXUS.", sms: "L’analisi ha rilevato una comunicazione negativa. Verifica in INDEXUS." },
      "urgent-tone": { name: "Tono urgente o arrabbiato", summary: "L’analisi ha rilevato un tono urgente o arrabbiato. Valuta la situazione in INDEXUS.", sms: "L’analisi ha rilevato un tono urgente. Verifica in INDEXUS." },
      "invoice-found": { name: "Fattura trovata in allegato", summary: "L’analisi ha rilevato una fattura in un allegato. Verifica il documento in INDEXUS.", sms: "L’analisi ha rilevato una fattura allegata. Verifica in INDEXUS." },
      complaint: { name: "Reclamo rilevato", summary: "L’analisi ha rilevato un reclamo. Verifica la comunicazione e i prossimi passi in INDEXUS.", sms: "L’analisi ha rilevato un reclamo. Verifica i prossimi passi in INDEXUS." },
      "reply-needed": { name: "Potrebbe essere necessaria una risposta", summary: "L’analisi indica che potrebbe essere necessaria una risposta. Verifica la comunicazione in INDEXUS.", sms: "Potrebbe essere necessaria una risposta. Verifica in INDEXUS." },
      "callback-requested": { name: "Richiesta di richiamata", summary: "L’analisi ha rilevato una richiesta di richiamata. Verificala in INDEXUS.", sms: "L’analisi ha rilevato una richiesta di richiamata. Verifica in INDEXUS." },
      "thank-you": { name: "Ringraziamento rilevato", summary: "L’analisi ha rilevato un ringraziamento. Verifica il contesto in INDEXUS.", sms: "L’analisi ha rilevato un ringraziamento. Verifica in INDEXUS." },
    },
  },
  de: {
    badge: "KOMMUNIKATIONSANALYSE",
    preheader: "Eine sichere Übersicht der analysierten Kommunikation ist in INDEXUS verfügbar.",
    sectionHeading: "In INDEXUS prüfen",
    sectionBody: "Diese E-Mail enthält weder den ursprünglichen Nachrichtentext noch Kontaktdaten. Melden Sie sich an, prüfen Sie den Kontext und entscheiden Sie über die nächsten Schritte.",
    cta: "INDEXUS öffnen",
    artworkAlt: "Illustration einer sicheren Kommunikationsprüfung",
    linkTitle: "Den passenden Datensatz in INDEXUS öffnen",
    notificationSummaryPrefix: "Interne Zusammenfassung:",
    variants: {
      "positive-sentiment": { name: "Positive Stimmung", summary: "Die Analyse hat die Kommunikation als positiv eingestuft. Prüfen Sie den Kontext in INDEXUS.", sms: "Die Analyse hat positive Kommunikation erkannt. In INDEXUS prüfen." },
      "negative-sentiment": { name: "Negative Stimmung", summary: "Die Analyse hat die Kommunikation als negativ eingestuft. Prüfen Sie sie in INDEXUS.", sms: "Die Analyse hat negative Kommunikation erkannt. In INDEXUS prüfen." },
      "urgent-tone": { name: "Dringender oder verärgerter Ton", summary: "Die Analyse hat einen dringenden oder verärgerten Ton erkannt. Bewerten Sie die Situation in INDEXUS.", sms: "Die Analyse hat einen dringenden Ton erkannt. In INDEXUS prüfen." },
      "invoice-found": { name: "Rechnung im Anhang gefunden", summary: "Die Analyse hat eine Rechnung in einem Anhang erkannt. Prüfen Sie das Dokument in INDEXUS.", sms: "Die Analyse hat einen Rechnungsanhang erkannt. In INDEXUS prüfen." },
      complaint: { name: "Beschwerde erkannt", summary: "Die Analyse hat eine Beschwerde erkannt. Prüfen Sie die Kommunikation und die nächsten Schritte in INDEXUS.", sms: "Die Analyse hat eine Beschwerde erkannt. Nächste Schritte in INDEXUS prüfen." },
      "reply-needed": { name: "Antwort möglicherweise erforderlich", summary: "Die Analyse deutet darauf hin, dass eine Antwort erforderlich sein könnte. Prüfen Sie die Kommunikation in INDEXUS.", sms: "Möglicherweise ist eine Antwort erforderlich. In INDEXUS prüfen." },
      "callback-requested": { name: "Rückruf angefragt", summary: "Die Analyse hat eine Rückrufanfrage erkannt. Prüfen Sie sie in INDEXUS.", sms: "Die Analyse hat eine Rückrufanfrage erkannt. In INDEXUS prüfen." },
      "thank-you": { name: "Dank erkannt", summary: "Die Analyse hat einen Dank erkannt. Prüfen Sie den Kontext in INDEXUS.", sms: "Die Analyse hat einen Dank erkannt. Kontext in INDEXUS prüfen." },
    },
  },
};

export function automationAnalysisTemplateCopy(language: AutomationAnalysisTemplateLanguage) {
  return localized[language];
}
