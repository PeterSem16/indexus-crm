import type { AttachmentFailureReason } from "@shared/automation-attachment-outcomes";

export type AutomationAttachmentCopy = {
  title: string; attachment: string; invoice: string; other: string; unprocessed: string;
  unavailable: string; notRecorded: string; empty: string;
  reasons: Record<AttachmentFailureReason, string>;
};
export const automationAttachmentTranslations = {
  en: {
    title: "Attachment analysis", attachment: "Attachment", invoice: "Invoice", other: "Other document", unprocessed: "Unprocessed",
    unavailable: "The source is unavailable or you do not have access.", notRecorded: "No attachment results were recorded for this run.", empty: "No attachments.",
    reasons: { missing: "Document is missing.", unsupported: "Unsupported document format.", encrypted: "Document is encrypted or password-protected.", unavailable: "Document or analysis service is temporarily unavailable.", unreadable: "Document could not be read.", limit: "Document exceeds processing limits.", unknown: "The reason was not recorded in this older run." },
  },
  sk: {
    title: "Analýza príloh", attachment: "Príloha", invoice: "Faktúra", other: "Iný dokument", unprocessed: "Nespracované",
    unavailable: "Zdroj nie je dostupný alebo k nemu nemáte prístup.", notRecorded: "Pre tento beh neboli zaznamenané výsledky príloh.", empty: "Bez príloh.",
    reasons: { missing: "Dokument chýba.", unsupported: "Nepodporovaný formát dokumentu.", encrypted: "Dokument je zašifrovaný alebo chránený heslom.", unavailable: "Dokument alebo služba analýzy sú dočasne nedostupné.", unreadable: "Dokument sa nepodarilo prečítať.", limit: "Dokument prekračuje limity spracovania.", unknown: "Dôvod nebol pri tomto staršom behu zaznamenaný." },
  },
  cs: {
    title: "Analýza příloh", attachment: "Příloha", invoice: "Faktura", other: "Jiný dokument", unprocessed: "Nezpracováno",
    unavailable: "Zdroj není dostupný nebo k němu nemáte přístup.", notRecorded: "Pro tento běh nebyly zaznamenány výsledky příloh.", empty: "Bez příloh.",
    reasons: { missing: "Dokument chybí.", unsupported: "Nepodporovaný formát dokumentu.", encrypted: "Dokument je zašifrovaný nebo chráněný heslem.", unavailable: "Dokument nebo služba analýzy jsou dočasně nedostupné.", unreadable: "Dokument se nepodařilo přečíst.", limit: "Dokument překračuje limity zpracování.", unknown: "Důvod nebyl u tohoto staršího běhu zaznamenán." },
  },
  hu: {
    title: "Mellékletek elemzése", attachment: "Melléklet", invoice: "Számla", other: "Egyéb dokumentum", unprocessed: "Feldolgozatlan",
    unavailable: "A forrás nem érhető el, vagy nincs hozzáférési jogosultsága.", notRecorded: "Ehhez a futáshoz nem rögzítettek mellékleteredményeket.", empty: "Nincsenek mellékletek.",
    reasons: { missing: "A dokumentum hiányzik.", unsupported: "Nem támogatott dokumentumformátum.", encrypted: "A dokumentum titkosított vagy jelszóval védett.", unavailable: "A dokumentum vagy az elemzőszolgáltatás átmenetileg nem érhető el.", unreadable: "A dokumentum nem olvasható.", limit: "A dokumentum meghaladja a feldolgozási korlátokat.", unknown: "Ennél a régebbi futásnál az okot nem rögzítették." },
  },
  ro: {
    title: "Analiza atașamentelor", attachment: "Atașament", invoice: "Factură", other: "Alt document", unprocessed: "Neprocesat",
    unavailable: "Sursa nu este disponibilă sau nu aveți acces.", notRecorded: "Nu au fost înregistrate rezultate pentru atașamentele acestei execuții.", empty: "Fără atașamente.",
    reasons: { missing: "Documentul lipsește.", unsupported: "Format de document neacceptat.", encrypted: "Documentul este criptat sau protejat prin parolă.", unavailable: "Documentul sau serviciul de analiză este temporar indisponibil.", unreadable: "Documentul nu a putut fi citit.", limit: "Documentul depășește limitele de procesare.", unknown: "Motivul nu a fost înregistrat la această execuție mai veche." },
  },
  it: {
    title: "Analisi degli allegati", attachment: "Allegato", invoice: "Fattura", other: "Altro documento", unprocessed: "Non elaborato",
    unavailable: "La fonte non è disponibile oppure non disponi dell'accesso.", notRecorded: "Non sono stati registrati risultati degli allegati per questa esecuzione.", empty: "Nessun allegato.",
    reasons: { missing: "Documento mancante.", unsupported: "Formato del documento non supportato.", encrypted: "Il documento è crittografato o protetto da password.", unavailable: "Il documento o il servizio di analisi è temporaneamente non disponibile.", unreadable: "Impossibile leggere il documento.", limit: "Il documento supera i limiti di elaborazione.", unknown: "Il motivo non è stato registrato in questa esecuzione precedente." },
  },
  de: {
    title: "Anhangsanalyse", attachment: "Anhang", invoice: "Rechnung", other: "Anderes Dokument", unprocessed: "Nicht verarbeitet",
    unavailable: "Die Quelle ist nicht verfügbar oder Sie haben keinen Zugriff.", notRecorded: "Für diesen Lauf wurden keine Anhangsergebnisse aufgezeichnet.", empty: "Keine Anhänge.",
    reasons: { missing: "Das Dokument fehlt.", unsupported: "Nicht unterstütztes Dokumentformat.", encrypted: "Das Dokument ist verschlüsselt oder passwortgeschützt.", unavailable: "Das Dokument oder der Analysedienst ist vorübergehend nicht verfügbar.", unreadable: "Das Dokument konnte nicht gelesen werden.", limit: "Das Dokument überschreitet die Verarbeitungsgrenzen.", unknown: "Der Grund wurde bei diesem älteren Lauf nicht aufgezeichnet." },
  },
} satisfies Record<string, AutomationAttachmentCopy>;
