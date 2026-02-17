import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { format } from "date-fns";

interface TimelineEvent {
  action: string;
  actorType: string;
  actorName: string | null;
  createdAt: string;
  details: string | null;
}

interface TimelineData {
  customerCountry: string;
  brandName?: string;
  contract: {
    contractNumber: string;
    status: string;
    createdAt: string;
    signedAt: string | null;
    contactDate: string | null;
    hasPdf: boolean;
  };
  participants: Array<{
    fullName: string;
    participantType: string;
    role: string;
    signedAt: string | null;
    signatureRequired: boolean;
  }>;
  events: TimelineEvent[];
}

const COUNTRY_TO_LANG: Record<string, string> = {
  SK: "sk", CZ: "cs", HU: "hu", RO: "ro", IT: "it", DE: "de", US: "en", GB: "en", AT: "de",
};

type LangStrings = {
  title: string;
  subtitle: string;
  contractDate: string;
  participants: string;
  signed: string;
  awaitingSignature: string;
  signatureNotRequired: string;
  timeline: string;
  downloadContract: string;
  secureView: string;
  linkExpired: string;
  notFound: string;
  loading: string;
  footer: string;
  footerSecure: string;
  actions: Record<string, string>;
  statuses: Record<string, string>;
  actorTypes: Record<string, string>;
  participantTypes: Record<string, string>;
  roles: Record<string, string>;
  detailKeys: Record<string, string>;
};

const TRANSLATIONS: Record<string, LangStrings> = {
  en: {
    title: "Contract Audit Timeline",
    subtitle: "INDEXUS CRM",
    contractDate: "Contract Date",
    participants: "Participants",
    signed: "Signed",
    awaitingSignature: "Awaiting signature",
    signatureNotRequired: "Observer",
    timeline: "Timeline",
    downloadContract: "Download Contract",
    secureView: "This is a secure, read-only view of the contract audit trail.",
    linkExpired: "Link Expired",
    notFound: "Not Found",
    loading: "Loading timeline...",
    footer: "Contract Audit Timeline",
    footerSecure: "This is a secure, read-only view of the contract audit trail.",
    actions: {
      created: "Contract Created", updated: "Contract Updated", sent: "Sent for Signature",
      viewed: "Contract Viewed", signing_page_viewed: "Signing Page Viewed",
      otp_sent: "Verification Code Sent", otp_resent: "Verification Code Resent", otp_send_failed: "Verification Code Delivery Failed", otp_verified: "Identity Verified",
      signed: "Contract Signed", completed: "Contract Completed", executed: "Contract Executed",
      cancelled: "Contract Cancelled", terminated: "Contract Terminated",
      audit_exported: "Audit Timeline Exported", status_changed: "Status Changed",
      received: "Contract Received", returned: "Contract Returned", verified: "Contract Verified",
      pdf_generated: "PDF Generated", pdf_regenerated: "PDF Regenerated",
      resent: "Resent for Signature", participant_added: "Participant Added",
      email_sent: "Email Sent", sms_sent: "SMS Sent",
    },
    statuses: {
      draft: "DRAFT", created: "CREATED", sent: "SENT", received: "RECEIVED", returned: "RETURNED",
      pending_signature: "PENDING SIGNATURE", signed: "SIGNED", verified: "VERIFIED",
      executed: "EXECUTED", completed: "COMPLETED", cancelled: "CANCELLED",
      terminated: "TERMINATED", expired: "EXPIRED",
    },
    actorTypes: { customer: "Customer", system: "System", user: "User" },
    participantTypes: { customer: "Customer", guarantor: "Guarantor", witness: "Witness", representative: "Representative", other: "Other" },
    roles: { signer: "Signer", observer: "Observer", witness: "Witness", guarantor: "Guarantor" },
    detailKeys: { signerName: "Signer", signerEmail: "Email", method: "Method", verifiedAt: "Verified at", statusChangedTo: "New status", message: "Note", signedAt: "Signed at", templateName: "Template", fileName: "File" },
  },
  sk: {
    title: "Audit timeline zmluvy",
    subtitle: "INDEXUS CRM",
    contractDate: "Dátum zmluvy",
    participants: "Účastníci",
    signed: "Podpísané",
    awaitingSignature: "Čaká na podpis",
    signatureNotRequired: "Pozorovateľ",
    timeline: "Časová os",
    downloadContract: "Stiahnuť zmluvu",
    secureView: "Toto je zabezpečený pohľad na audit trail zmluvy (iba na čítanie).",
    linkExpired: "Odkaz vypršal",
    notFound: "Nenájdené",
    loading: "Načítavam timeline...",
    footer: "Audit timeline zmluvy",
    footerSecure: "Toto je zabezpečený pohľad na audit trail zmluvy (iba na čítanie).",
    actions: {
      created: "Zmluva vytvorená", updated: "Zmluva aktualizovaná", sent: "Odoslaná na podpis",
      viewed: "Zmluva zobrazená", signing_page_viewed: "Podpisová stránka zobrazená",
      otp_sent: "OTP kód odoslaný", otp_resent: "Overovací kód opätovne odoslaný", otp_send_failed: "Odoslanie overovacieho kódu zlyhalo", otp_verified: "Identita overená",
      signed: "Zmluva podpísaná", completed: "Zmluva dokončená", executed: "Zmluva vykonaná",
      cancelled: "Zmluva zrušená", terminated: "Zmluva ukončená",
      audit_exported: "Audit timeline exportovaný", status_changed: "Zmena stavu",
      received: "Zmluva prijatá", returned: "Zmluva vrátená", verified: "Zmluva overená",
      pdf_generated: "PDF vygenerované", pdf_regenerated: "PDF pregenerované",
      resent: "Opätovne odoslaná na podpis", participant_added: "Účastník pridaný",
      email_sent: "Email odoslaný", sms_sent: "SMS odoslaná",
    },
    statuses: {
      draft: "KONCEPT", created: "VYTVORENÁ", sent: "ODOSLANÁ", received: "PRIJATÁ", returned: "VRÁTENÁ",
      pending_signature: "ČAKÁ NA PODPIS", signed: "PODPÍSANÁ", verified: "OVERENÁ",
      executed: "VYKONANÁ", completed: "DOKONČENÁ", cancelled: "ZRUŠENÁ",
      terminated: "UKONČENÁ", expired: "EXPIROVANÁ",
    },
    actorTypes: { customer: "Zákazník", system: "Systém", user: "Používateľ" },
    participantTypes: { customer: "Zákazník", guarantor: "Ručiteľ", witness: "Svedok", representative: "Zástupca", other: "Iný" },
    roles: { signer: "Podpisujúci", observer: "Pozorovateľ", witness: "Svedok", guarantor: "Ručiteľ" },
    detailKeys: { signerName: "Podpisujúci", signerEmail: "Email", method: "Metóda", verifiedAt: "Overené", statusChangedTo: "Nový stav", message: "Poznámka", signedAt: "Podpísané", templateName: "Šablóna", fileName: "Súbor" },
  },
  cs: {
    title: "Audit timeline smlouvy",
    subtitle: "INDEXUS CRM",
    contractDate: "Datum smlouvy",
    participants: "Účastníci",
    signed: "Podepsáno",
    awaitingSignature: "Čeká na podpis",
    signatureNotRequired: "Pozorovatel",
    timeline: "Časová osa",
    downloadContract: "Stáhnout smlouvu",
    secureView: "Toto je zabezpečený náhled na audit trail smlouvy (pouze ke čtení).",
    linkExpired: "Odkaz vypršel",
    notFound: "Nenalezeno",
    loading: "Načítám timeline...",
    footer: "Audit timeline smlouvy",
    footerSecure: "Toto je zabezpečený náhled na audit trail smlouvy (pouze ke čtení).",
    actions: {
      created: "Smlouva vytvořena", updated: "Smlouva aktualizována", sent: "Odeslána k podpisu",
      viewed: "Smlouva zobrazena", signing_page_viewed: "Podpisová stránka zobrazena",
      otp_sent: "OTP kód odeslán", otp_resent: "Ověřovací kód znovu odeslán", otp_send_failed: "Odeslání ověřovacího kódu selhalo", otp_verified: "Identita ověřena",
      signed: "Smlouva podepsána", completed: "Smlouva dokončena", executed: "Smlouva provedena",
      cancelled: "Smlouva zrušena", terminated: "Smlouva ukončena",
      audit_exported: "Audit timeline exportován", status_changed: "Změna stavu",
      received: "Smlouva přijata", returned: "Smlouva vrácena", verified: "Smlouva ověřena",
      pdf_generated: "PDF vygenerováno", pdf_regenerated: "PDF přegenerováno",
      resent: "Znovu odeslána k podpisu", participant_added: "Účastník přidán",
      email_sent: "Email odeslán", sms_sent: "SMS odeslána",
    },
    statuses: {
      draft: "KONCEPT", created: "VYTVOŘENA", sent: "ODESLÁNA", received: "PŘIJATA", returned: "VRÁCENA",
      pending_signature: "ČEKÁ NA PODPIS", signed: "PODEPSÁNA", verified: "OVĚŘENA",
      executed: "PROVEDENA", completed: "DOKONČENA", cancelled: "ZRUŠENA",
      terminated: "UKONČENA", expired: "EXPIROVÁNA",
    },
    actorTypes: { customer: "Zákazník", system: "Systém", user: "Uživatel" },
    participantTypes: { customer: "Zákazník", guarantor: "Ručitel", witness: "Svědek", representative: "Zástupce", other: "Jiný" },
    roles: { signer: "Podepisující", observer: "Pozorovatel", witness: "Svědek", guarantor: "Ručitel" },
    detailKeys: { signerName: "Podepisující", signerEmail: "Email", method: "Metoda", verifiedAt: "Ověřeno", statusChangedTo: "Nový stav", message: "Poznámka", signedAt: "Podepsáno", templateName: "Šablona", fileName: "Soubor" },
  },
  hu: {
    title: "Szerződés audit idővonal",
    subtitle: "INDEXUS CRM",
    contractDate: "Szerződés dátuma",
    participants: "Résztvevők",
    signed: "Aláírva",
    awaitingSignature: "Aláírásra vár",
    signatureNotRequired: "Megfigyelő",
    timeline: "Idővonal",
    downloadContract: "Szerződés letöltése",
    secureView: "Ez a szerződés audit nyomvonalának biztonságos, csak olvasható nézete.",
    linkExpired: "A link lejárt",
    notFound: "Nem található",
    loading: "Idővonal betöltése...",
    footer: "Szerződés audit idővonal",
    footerSecure: "Ez a szerződés audit nyomvonalának biztonságos, csak olvasható nézete.",
    actions: {
      created: "Szerződés létrehozva", updated: "Szerződés frissítve", sent: "Aláírásra elküldve",
      viewed: "Szerződés megtekintve", signing_page_viewed: "Aláírási oldal megtekintve",
      otp_sent: "OTP kód elküldve", otp_resent: "Ellenőrző kód újraküldve", otp_send_failed: "Ellenőrző kód küldése sikertelen", otp_verified: "Személyazonosság ellenőrizve",
      signed: "Szerződés aláírva", completed: "Szerződés befejezve", executed: "Szerződés végrehajtva",
      cancelled: "Szerződés törölve", terminated: "Szerződés megszüntetve",
      audit_exported: "Audit idővonal exportálva", status_changed: "Állapot megváltoztatva",
      received: "Szerződés átvéve", returned: "Szerződés visszaküldve", verified: "Szerződés ellenőrizve",
      pdf_generated: "PDF generálva", pdf_regenerated: "PDF újragenerálva",
      resent: "Újraküldve aláírásra", participant_added: "Résztvevő hozzáadva",
      email_sent: "Email elküldve", sms_sent: "SMS elküldve",
    },
    statuses: {
      draft: "TERVEZET", created: "LÉTREHOZVA", sent: "ELKÜLDVE", received: "ÁTVÉVE", returned: "VISSZAKÜLDVE",
      pending_signature: "ALÁÍRÁSRA VÁR", signed: "ALÁÍRVA", verified: "ELLENŐRIZVE",
      executed: "VÉGREHAJTVA", completed: "BEFEJEZVE", cancelled: "TÖRÖLVE",
      terminated: "MEGSZÜNTETVE", expired: "LEJÁRT",
    },
    actorTypes: { customer: "Ügyfél", system: "Rendszer", user: "Felhasználó" },
    participantTypes: { customer: "Ügyfél", guarantor: "Kezes", witness: "Tanú", representative: "Képviselő", other: "Egyéb" },
    roles: { signer: "Aláíró", observer: "Megfigyelő", witness: "Tanú", guarantor: "Kezes" },
    detailKeys: { signerName: "Aláíró", signerEmail: "Email", method: "Módszer", verifiedAt: "Ellenőrizve", statusChangedTo: "Új állapot", message: "Megjegyzés", signedAt: "Aláírva", templateName: "Sablon", fileName: "Fájl" },
  },
  ro: {
    title: "Cronologia audit a contractului",
    subtitle: "INDEXUS CRM",
    contractDate: "Data contractului",
    participants: "Participanți",
    signed: "Semnat",
    awaitingSignature: "Așteaptă semnarea",
    signatureNotRequired: "Observator",
    timeline: "Cronologie",
    downloadContract: "Descarcă contractul",
    secureView: "Aceasta este o vizualizare securizată, doar pentru citire, a auditului contractului.",
    linkExpired: "Link expirat",
    notFound: "Negăsit",
    loading: "Se încarcă cronologia...",
    footer: "Cronologia audit a contractului",
    footerSecure: "Aceasta este o vizualizare securizată, doar pentru citire, a auditului contractului.",
    actions: {
      created: "Contract creat", updated: "Contract actualizat", sent: "Trimis pentru semnare",
      viewed: "Contract vizualizat", signing_page_viewed: "Pagina de semnare vizualizată",
      otp_sent: "Cod OTP trimis", otp_resent: "Cod de verificare retrimis", otp_send_failed: "Trimiterea codului de verificare a eșuat", otp_verified: "Identitate verificată",
      signed: "Contract semnat", completed: "Contract finalizat", executed: "Contract executat",
      cancelled: "Contract anulat", terminated: "Contract reziliat",
      audit_exported: "Cronologie audit exportată", status_changed: "Stare modificată",
      received: "Contract recepționat", returned: "Contract returnat", verified: "Contract verificat",
      pdf_generated: "PDF generat", pdf_regenerated: "PDF regenerat",
      resent: "Retrimis pentru semnare", participant_added: "Participant adăugat",
      email_sent: "Email trimis", sms_sent: "SMS trimis",
    },
    statuses: {
      draft: "CIORNĂ", created: "CREAT", sent: "TRIMIS", received: "RECEPȚIONAT", returned: "RETURNAT",
      pending_signature: "AȘTEAPTĂ SEMNAREA", signed: "SEMNAT", verified: "VERIFICAT",
      executed: "EXECUTAT", completed: "FINALIZAT", cancelled: "ANULAT",
      terminated: "REZILIAT", expired: "EXPIRAT",
    },
    actorTypes: { customer: "Client", system: "Sistem", user: "Utilizator" },
    participantTypes: { customer: "Client", guarantor: "Garant", witness: "Martor", representative: "Reprezentant", other: "Altul" },
    roles: { signer: "Semnatar", observer: "Observator", witness: "Martor", guarantor: "Garant" },
    detailKeys: { signerName: "Semnatar", signerEmail: "Email", method: "Metodă", verifiedAt: "Verificat", statusChangedTo: "Stare nouă", message: "Notă", signedAt: "Semnat", templateName: "Șablon", fileName: "Fișier" },
  },
  it: {
    title: "Cronologia audit del contratto",
    subtitle: "INDEXUS CRM",
    contractDate: "Data del contratto",
    participants: "Partecipanti",
    signed: "Firmato",
    awaitingSignature: "In attesa di firma",
    signatureNotRequired: "Osservatore",
    timeline: "Cronologia",
    downloadContract: "Scarica contratto",
    secureView: "Questa è una visualizzazione sicura e di sola lettura dell'audit trail del contratto.",
    linkExpired: "Link scaduto",
    notFound: "Non trovato",
    loading: "Caricamento cronologia...",
    footer: "Cronologia audit del contratto",
    footerSecure: "Questa è una visualizzazione sicura e di sola lettura dell'audit trail del contratto.",
    actions: {
      created: "Contratto creato", updated: "Contratto aggiornato", sent: "Inviato per la firma",
      viewed: "Contratto visualizzato", signing_page_viewed: "Pagina di firma visualizzata",
      otp_sent: "Codice OTP inviato", otp_resent: "Codice di verifica reinviato", otp_send_failed: "Invio del codice di verifica fallito", otp_verified: "Identità verificata",
      signed: "Contratto firmato", completed: "Contratto completato", executed: "Contratto eseguito",
      cancelled: "Contratto annullato", terminated: "Contratto risolto",
      audit_exported: "Cronologia audit esportata", status_changed: "Stato modificato",
      received: "Contratto ricevuto", returned: "Contratto restituito", verified: "Contratto verificato",
      pdf_generated: "PDF generato", pdf_regenerated: "PDF rigenerato",
      resent: "Reinviato per la firma", participant_added: "Partecipante aggiunto",
      email_sent: "Email inviata", sms_sent: "SMS inviato",
    },
    statuses: {
      draft: "BOZZA", created: "CREATO", sent: "INVIATO", received: "RICEVUTO", returned: "RESTITUITO",
      pending_signature: "IN ATTESA DI FIRMA", signed: "FIRMATO", verified: "VERIFICATO",
      executed: "ESEGUITO", completed: "COMPLETATO", cancelled: "ANNULLATO",
      terminated: "RISOLTO", expired: "SCADUTO",
    },
    actorTypes: { customer: "Cliente", system: "Sistema", user: "Utente" },
    participantTypes: { customer: "Cliente", guarantor: "Garante", witness: "Testimone", representative: "Rappresentante", other: "Altro" },
    roles: { signer: "Firmatario", observer: "Osservatore", witness: "Testimone", guarantor: "Garante" },
    detailKeys: { signerName: "Firmatario", signerEmail: "Email", method: "Metodo", verifiedAt: "Verificato", statusChangedTo: "Nuovo stato", message: "Nota", signedAt: "Firmato", templateName: "Modello", fileName: "File" },
  },
  de: {
    title: "Vertrag Audit-Zeitleiste",
    subtitle: "INDEXUS CRM",
    contractDate: "Vertragsdatum",
    participants: "Teilnehmer",
    signed: "Unterschrieben",
    awaitingSignature: "Wartet auf Unterschrift",
    signatureNotRequired: "Beobachter",
    timeline: "Zeitleiste",
    downloadContract: "Vertrag herunterladen",
    secureView: "Dies ist eine sichere, schreibgeschützte Ansicht des Vertrags-Audit-Trails.",
    linkExpired: "Link abgelaufen",
    notFound: "Nicht gefunden",
    loading: "Zeitleiste wird geladen...",
    footer: "Vertrag Audit-Zeitleiste",
    footerSecure: "Dies ist eine sichere, schreibgeschützte Ansicht des Vertrags-Audit-Trails.",
    actions: {
      created: "Vertrag erstellt", updated: "Vertrag aktualisiert", sent: "Zur Unterschrift gesendet",
      viewed: "Vertrag angezeigt", signing_page_viewed: "Unterschriftsseite angezeigt",
      otp_sent: "OTP-Code gesendet", otp_resent: "Verifizierungscode erneut gesendet", otp_send_failed: "Senden des Verifizierungscodes fehlgeschlagen", otp_verified: "Identität verifiziert",
      signed: "Vertrag unterschrieben", completed: "Vertrag abgeschlossen", executed: "Vertrag ausgeführt",
      cancelled: "Vertrag storniert", terminated: "Vertrag beendet",
      audit_exported: "Audit-Zeitleiste exportiert", status_changed: "Status geändert",
      received: "Vertrag empfangen", returned: "Vertrag zurückgesandt", verified: "Vertrag verifiziert",
      pdf_generated: "PDF generiert", pdf_regenerated: "PDF neu generiert",
      resent: "Erneut zur Unterschrift gesendet", participant_added: "Teilnehmer hinzugefügt",
      email_sent: "E-Mail gesendet", sms_sent: "SMS gesendet",
    },
    statuses: {
      draft: "ENTWURF", created: "ERSTELLT", sent: "GESENDET", received: "EMPFANGEN", returned: "ZURÜCKGESANDT",
      pending_signature: "WARTEN AUF UNTERSCHRIFT", signed: "UNTERSCHRIEBEN", verified: "VERIFIZIERT",
      executed: "AUSGEFÜHRT", completed: "ABGESCHLOSSEN", cancelled: "STORNIERT",
      terminated: "BEENDET", expired: "ABGELAUFEN",
    },
    actorTypes: { customer: "Kunde", system: "System", user: "Benutzer" },
    participantTypes: { customer: "Kunde", guarantor: "Bürge", witness: "Zeuge", representative: "Vertreter", other: "Sonstige" },
    roles: { signer: "Unterzeichner", observer: "Beobachter", witness: "Zeuge", guarantor: "Bürge" },
    detailKeys: { signerName: "Unterzeichner", signerEmail: "E-Mail", method: "Methode", verifiedAt: "Verifiziert", statusChangedTo: "Neuer Status", message: "Hinweis", signedAt: "Unterschrieben", templateName: "Vorlage", fileName: "Datei" },
  },
};

const ACTION_COLORS: Record<string, { color: string; bgColor: string }> = {
  created: { color: "#3B82F6", bgColor: "#EFF6FF" },
  updated: { color: "#8B5CF6", bgColor: "#F5F3FF" },
  sent: { color: "#F59E0B", bgColor: "#FFFBEB" },
  viewed: { color: "#6366F1", bgColor: "#EEF2FF" },
  signing_page_viewed: { color: "#6366F1", bgColor: "#EEF2FF" },
  otp_sent: { color: "#F97316", bgColor: "#FFF7ED" },
  otp_resent: { color: "#D97706", bgColor: "#FFFBEB" },
  otp_send_failed: { color: "#EF4444", bgColor: "#FEF2F2" },
  otp_verified: { color: "#10B981", bgColor: "#ECFDF5" },
  signed: { color: "#059669", bgColor: "#ECFDF5" },
  completed: { color: "#059669", bgColor: "#ECFDF5" },
  executed: { color: "#059669", bgColor: "#ECFDF5" },
  cancelled: { color: "#EF4444", bgColor: "#FEF2F2" },
  terminated: { color: "#EF4444", bgColor: "#FEF2F2" },
  audit_exported: { color: "#6B7280", bgColor: "#F9FAFB" },
  status_changed: { color: "#8B5CF6", bgColor: "#F5F3FF" },
  received: { color: "#7C3AED", bgColor: "#F5F3FF" },
  returned: { color: "#F97316", bgColor: "#FFF7ED" },
  verified: { color: "#10B981", bgColor: "#ECFDF5" },
  pdf_generated: { color: "#3B82F6", bgColor: "#EFF6FF" },
  pdf_regenerated: { color: "#3B82F6", bgColor: "#EFF6FF" },
  resent: { color: "#F59E0B", bgColor: "#FFFBEB" },
  participant_added: { color: "#8B5CF6", bgColor: "#F5F3FF" },
  email_sent: { color: "#6366F1", bgColor: "#EEF2FF" },
  sms_sent: { color: "#6366F1", bgColor: "#EEF2FF" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB" },
  created: { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD" },
  sent: { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
  received: { bg: "#EDE9FE", text: "#5B21B6", border: "#C4B5FD" },
  returned: { bg: "#FFF7ED", text: "#C2410C", border: "#FDBA74" },
  pending_signature: { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  signed: { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
  verified: { bg: "#CCFBF1", text: "#115E59", border: "#5EEAD4" },
  executed: { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
  completed: { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
  cancelled: { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  terminated: { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  expired: { bg: "#F3F4F6", text: "#6B7280", border: "#D1D5DB" },
};

function formatDate(date: string | null | undefined) {
  if (!date) return "-";
  try { return format(new Date(date), "dd.MM.yyyy"); } catch { return "-"; }
}

function formatDateTime(date: string | null | undefined) {
  if (!date) return "-";
  try { return format(new Date(date), "dd.MM.yyyy HH:mm:ss"); } catch { return "-"; }
}

function getLang(country: string): LangStrings {
  const langCode = COUNTRY_TO_LANG[country] || "en";
  return TRANSLATIONS[langCode] || TRANSLATIONS.en;
}

export default function AuditTimelinePublic() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<TimelineData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/public/audit-timeline/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed to load" }));
          throw new Error(err.error || "Failed to load");
        }
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, border: "4px solid #E5E7EB", borderTop: "4px solid #6B1C3B", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#6B7280", fontSize: 14 }}>Loading timeline...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    const isExpired = error === "This timeline link has expired";
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB" }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }} data-testid="status-error-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 style={{ color: "#991B1B", fontSize: 20, margin: "0 0 8px" }} data-testid="text-error-title">{isExpired ? "Link Expired" : "Not Found"}</h2>
          <p style={{ color: "#6B7280", fontSize: 14 }} data-testid="text-error-message">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const lang = getLang(data.customerCountry);
  const statusConfig = STATUS_COLORS[data.contract.status] || STATUS_COLORS.draft;

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "'Segoe UI', -apple-system, sans-serif" }}>
      <header style={{ background: "#6B1C3B", color: "white", padding: "24px 0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{lang.title}</h1>
          </div>
          <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>{data.brandName || lang.subtitle}</p>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, color: "#111827" }} data-testid="text-contract-number">{data.contract.contractNumber}</h2>
              <p style={{ margin: 0, color: "#6B7280", fontSize: 14 }}>{lang.contractDate}: {formatDate(data.contract.contactDate || data.contract.createdAt)}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{
                padding: "6px 16px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                background: statusConfig.bg,
                color: statusConfig.text,
                border: `1px solid ${statusConfig.border}`,
              }} data-testid="badge-contract-status">
                {lang.statuses[data.contract.status] || data.contract.status.replace(/_/g, " ").toUpperCase()}
              </div>
            </div>
          </div>

          {data.contract.hasPdf && (
            <div style={{ marginTop: 16 }}>
              <a
                href={`/api/public/audit-timeline/${token}/download-contract`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 8,
                  background: "#6B1C3B",
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                  transition: "opacity 0.15s",
                }}
                data-testid="link-download-contract"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {lang.downloadContract}
              </a>
            </div>
          )}

          {data.participants.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #F3F4F6" }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{lang.participants}</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {data.participants.map((p, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 14px", borderRadius: 8,
                    background: p.signedAt ? "#ECFDF5" : "#F9FAFB",
                    border: `1px solid ${p.signedAt ? "#A7F3D0" : "#E5E7EB"}`,
                    fontSize: 13,
                  }} data-testid={`card-participant-${i}`}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: p.signedAt ? "#059669" : "#D1D5DB",
                      color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 600,
                    }}>
                      {p.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, color: "#111827" }}>{p.fullName}</div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>
                        {lang.participantTypes[p.participantType] || lang.participantTypes[p.role] || p.participantType} {p.signedAt ? `\u2022 ${lang.signed} ${formatDate(p.signedAt)}` : p.signatureRequired ? `\u2022 ${lang.awaitingSignature}` : `\u2022 ${lang.signatureNotRequired}`}
                      </div>
                    </div>
                    {p.signedAt && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "#111827", fontWeight: 600 }}>{lang.timeline}</h3>

        <div style={{ position: "relative" }}>
          <div style={{
            position: "absolute", left: 19, top: 0, bottom: 0, width: 2,
            background: "linear-gradient(to bottom, #6B1C3B, #D1D5DB, transparent)",
          }} />

          {data.events.map((event, index) => {
            const colorConfig = ACTION_COLORS[event.action] || { color: "#6B7280", bgColor: "#F9FAFB" };
            const label = lang.actions[event.action] || event.action;
            let details: Record<string, any> = {};
            let detailsIsString = false;
            try { 
              if (event.details) {
                const parsed = JSON.parse(event.details);
                if (typeof parsed === "object" && parsed !== null) {
                  details = parsed;
                } else {
                  detailsIsString = true;
                }
              }
            } catch { detailsIsString = !!event.details; }
            const isFirst = index === 0;
            const isLast = index === data.events.length - 1;
            const isSignature = event.action === "signed" || event.action === "completed";

            return (
              <div key={index} style={{
                display: "flex", gap: 16, marginBottom: isLast ? 0 : 8,
                position: "relative",
              }} data-testid={`row-timeline-event-${index}`}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: isSignature ? colorConfig.color : "white",
                  border: `3px solid ${colorConfig.color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, zIndex: 1,
                  boxShadow: isFirst ? `0 0 0 4px ${colorConfig.bgColor}` : "none",
                  fontSize: 16,
                }}>
                  {isSignature ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: colorConfig.color }} />
                  )}
                </div>

                <div style={{
                  flex: 1, background: "white", borderRadius: 10,
                  border: `1px solid ${isSignature ? colorConfig.color + "40" : "#E5E7EB"}`,
                  padding: "14px 18px",
                  boxShadow: isSignature ? `0 1px 4px ${colorConfig.color}15` : "0 1px 2px rgba(0,0,0,0.04)",
                  marginBottom: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: colorConfig.color }} data-testid={`text-event-label-${index}`}>
                        {label}
                      </span>
                      {event.actorName && (
                        <span style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 12,
                          background: event.actorType === "customer" ? "#FEF3C7" : event.actorType === "system" ? "#F3F4F6" : "#EFF6FF",
                          color: event.actorType === "customer" ? "#92400E" : event.actorType === "system" ? "#374151" : "#1E40AF",
                          fontWeight: 500,
                        }}>
                          {event.actorName}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9CA3AF", fontSize: 12 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                      {formatDateTime(event.createdAt)}
                    </div>
                  </div>

                  {detailsIsString && event.details && (
                    <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#F9FAFB", fontSize: 12, color: "#6B7280" }}>
                      {event.details}
                    </div>
                  )}
                  {!detailsIsString && Object.keys(details).length > 0 && (
                    <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#F9FAFB", fontSize: 12, color: "#6B7280" }}>
                      {Object.entries(details).filter(([key]) => !["signatureHash", "ipAddress", "userAgent"].includes(key)).map(([key, value]) => {
                        const translatedKey = lang.detailKeys[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                        let displayValue = String(value);
                        if (key === "statusChangedTo") {
                          displayValue = lang.statuses[displayValue] || displayValue;
                        }
                        return (
                          <div key={key} style={{ display: "flex", gap: 4, marginBottom: 2 }}>
                            <span style={{ fontWeight: 500, color: "#374151" }}>{translatedKey}:</span>
                            <span>{displayValue}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", marginTop: 32, padding: "16px 0", borderTop: "1px solid #E5E7EB" }}>
          <p style={{ color: "#9CA3AF", fontSize: 12, margin: 0 }}>{data.brandName || "INDEXUS CRM"} &bull; {lang.footer}</p>
          <p style={{ color: "#D1D5DB", fontSize: 11, margin: "4px 0 0" }}>{lang.footerSecure}</p>
        </div>
      </main>
    </div>
  );
}