import type { Locale } from "@/i18n/translations";

const STATUS_LABELS: Record<string, Record<Locale, string>> = {
  draft: { sk: "Koncept", cs: "Koncept", en: "Draft", hu: "Vázlat", ro: "Ciornă", it: "Bozza", de: "Entwurf" },
  sent: { sk: "Odoslaná", cs: "Odeslaná", en: "Sent", hu: "Elküldve", ro: "Trimisă", it: "Inviata", de: "Gesendet" },
  pending_signature: { sk: "Čaká na podpis", cs: "Čeká na podpis", en: "Pending signature", hu: "Aláírásra vár", ro: "Așteaptă semnătura", it: "In attesa di firma", de: "Wartet auf Unterschrift" },
  signed: { sk: "Podpísaná", cs: "Podepsaná", en: "Signed", hu: "Aláírva", ro: "Semnată", it: "Firmata", de: "Unterschrieben" },
  completed: { sk: "Dokončená", cs: "Dokončená", en: "Completed", hu: "Befejezve", ro: "Finalizată", it: "Completata", de: "Abgeschlossen" },
  cancelled: { sk: "Zrušená", cs: "Zrušená", en: "Cancelled", hu: "Törölve", ro: "Anulată", it: "Annullata", de: "Storniert" },
  expired: { sk: "Expirovaná", cs: "Expirovaná", en: "Expired", hu: "Lejárt", ro: "Expirată", it: "Scaduta", de: "Abgelaufen" },
  generated: { sk: "Vygenerovaná", cs: "Vygenerovaná", en: "Generated", hu: "Generálva", ro: "Generată", it: "Generata", de: "Generiert" },
  paid: { sk: "Uhradená", cs: "Uhrazená", en: "Paid", hu: "Kifizetve", ro: "Plătită", it: "Pagata", de: "Bezahlt" },
  unpaid: { sk: "Neuhradená", cs: "Neuhrazená", en: "Unpaid", hu: "Kifizetetlen", ro: "Neplătită", it: "Non pagata", de: "Unbezahlt" },
  partially_paid: { sk: "Čiastočne uhradená", cs: "Částečně uhrazená", en: "Partially paid", hu: "Részben kifizetve", ro: "Plătită parțial", it: "Parzialmente pagata", de: "Teilweise bezahlt" },
  overdue: { sk: "Po splatnosti", cs: "Po splatnosti", en: "Overdue", hu: "Lejárt határidejű", ro: "Restantă", it: "Scaduta", de: "Überfällig" },
  storno: { sk: "Stornovaná", cs: "Stornovaná", en: "Reversed", hu: "Sztornózva", ro: "Stornată", it: "Stornata", de: "Storniert" },
  active: { sk: "Aktívna", cs: "Aktivní", en: "Active", hu: "Aktív", ro: "Activă", it: "Attiva", de: "Aktiv" },
  new: { sk: "Nová", cs: "Nová", en: "New", hu: "Új", ro: "Nouă", it: "Nuova", de: "Neu" },
  writeoff: { sk: "Odpísaná", cs: "Odepsaná", en: "Written off", hu: "Leírt", ro: "Scrisă", it: "Cancellata", de: "Abgeschrieben" },

  REG_IST_INDUE: { sk: "V lehote splatnosti", cs: "Ve lhůtě splatnosti", en: "Within due date", hu: "Határidőn belül", ro: "În termen de plată", it: "Entro scadenza", de: "Innerhalb der Frist" },
  REG_IST_OVERDUE: { sk: "Po splatnosti", cs: "Po splatnosti", en: "Overdue", hu: "Lejárt határidejű", ro: "Restantă", it: "Scaduta", de: "Überfällig" },
  REG_IST_PAID: { sk: "Uhradená", cs: "Uhrazená", en: "Paid", hu: "Kifizetve", ro: "Plătită", it: "Pagata", de: "Bezahlt" },
  REG_IST_PARTIALLY_PAID: { sk: "Čiastočne uhradená", cs: "Částečně uhrazená", en: "Partially paid", hu: "Részben kifizetve", ro: "Plătită parțial", it: "Parzialmente pagata", de: "Teilweise bezahlt" },
  REG_IST_CANCELLED: { sk: "Zrušená", cs: "Zrušená", en: "Cancelled", hu: "Törölve", ro: "Anulată", it: "Annullata", de: "Storniert" },
  REG_IST_STORNO: { sk: "Stornovaná", cs: "Stornovaná", en: "Reversed", hu: "Sztornózva", ro: "Stornată", it: "Stornata", de: "Storniert" },
  REG_IST_NEW: { sk: "Nová", cs: "Nová", en: "New", hu: "Új", ro: "Nouă", it: "Nuova", de: "Neu" },
  REG_IST_WRITEOFF: { sk: "Odpísaná", cs: "Odepsaná", en: "Written off", hu: "Leírt", ro: "Scrisă", it: "Cancellata", de: "Abgeschrieben" },
  REG_IST_CREDIT_NOTE: { sk: "Dobropis", cs: "Dobropis", en: "Credit note", hu: "Jóváírás", ro: "Notă de credit", it: "Nota di credito", de: "Gutschrift" },
  REG_IST_PROFORMA: { sk: "Proforma", cs: "Proforma", en: "Proforma", hu: "Proforma", ro: "Proforma", it: "Proforma", de: "Proforma" },

  REG_CSA_SENT_PACKAGE: { sk: "Odoslaný balík", cs: "Odeslaný balík", en: "Package sent", hu: "Csomag elküldve", ro: "Pachet trimis", it: "Pacco inviato", de: "Paket gesendet" },
  REG_CSA_REALIZED: { sk: "Realizovaná", cs: "Realizovaná", en: "Realized", hu: "Megvalósítva", ro: "Realizată", it: "Realizzata", de: "Realisiert" },
  REG_CSA_CONFIRMED_RECEPTION: { sk: "Potvrdený príjem", cs: "Potvrzený příjem", en: "Reception confirmed", hu: "Átvétel megerősítve", ro: "Recepție confirmată", it: "Ricezione confermata", de: "Empfang bestätigt" },
  REG_CSA_RETURNED: { sk: "Vrátená", cs: "Vrácená", en: "Returned", hu: "Visszaküldve", ro: "Returnată", it: "Restituita", de: "Zurückgegeben" },
  REG_CSA_VALIDATED: { sk: "Validovaná", cs: "Validovaná", en: "Validated", hu: "Érvényesítve", ro: "Validată", it: "Validata", de: "Validiert" },
  REG_CSA_TERMINATED: { sk: "Ukončená", cs: "Ukončená", en: "Terminated", hu: "Megszüntetve", ro: "Terminată", it: "Terminata", de: "Beendet" },
  REG_CSA_CANCELLED: { sk: "Zrušená", cs: "Zrušená", en: "Cancelled", hu: "Törölve", ro: "Anulată", it: "Annullata", de: "Storniert" },
  REG_CSA_SIGNED: { sk: "Podpísaná", cs: "Podepsaná", en: "Signed", hu: "Aláírva", ro: "Semnată", it: "Firmata", de: "Unterschrieben" },
  REG_CSA_SENT: { sk: "Odoslaná", cs: "Odeslaná", en: "Sent", hu: "Elküldve", ro: "Trimisă", it: "Inviata", de: "Gesendet" },
  REG_CSA_REGISTERED: { sk: "Registrovaná", cs: "Registrovaná", en: "Registered", hu: "Regisztrálva", ro: "Înregistrată", it: "Registrata", de: "Registriert" },
  REG_CSA_ACTIVE: { sk: "Aktívna", cs: "Aktivní", en: "Active", hu: "Aktív", ro: "Activă", it: "Attiva", de: "Aktiv" },
  REG_CSA_EXPIRED: { sk: "Expirovaná", cs: "Expirovaná", en: "Expired", hu: "Lejárt", ro: "Expirată", it: "Scaduta", de: "Abgelaufen" },
  REG_CSA_DRAFT: { sk: "Koncept", cs: "Koncept", en: "Draft", hu: "Vázlat", ro: "Ciornă", it: "Bozza", de: "Entwurf" },
  REG_CSA_IN_PROGRESS: { sk: "V procese", cs: "V procesu", en: "In progress", hu: "Folyamatban", ro: "În curs", it: "In corso", de: "In Bearbeitung" },
  REG_CSA_WAITING_FOR_PAYMENT: { sk: "Čaká na platbu", cs: "Čeká na platbu", en: "Waiting for payment", hu: "Fizetésre vár", ro: "Așteaptă plata", it: "In attesa di pagamento", de: "Warten auf Zahlung" },
  REG_CSA_STORED: { sk: "Uskladnená", cs: "Uskladněná", en: "Stored", hu: "Tárolt", ro: "Depozitată", it: "Immagazzinata", de: "Gelagert" },
  REG_CSA_COLLECTION_PLANNED: { sk: "Plánovaný odber", cs: "Plánovaný odběr", en: "Collection planned", hu: "Gyűjtés tervezve", ro: "Colectare planificată", it: "Raccolta pianificata", de: "Sammlung geplant" },
  REG_CSA_SAMPLE_RECEIVED: { sk: "Vzorka prijatá", cs: "Vzorek přijat", en: "Sample received", hu: "Minta beérkezett", ro: "Probă primită", it: "Campione ricevuto", de: "Probe empfangen" },
  REG_CSA_LAB_PROCESSING: { sk: "Spracovanie v laboratóriu", cs: "Zpracování v laboratoři", en: "Lab processing", hu: "Labor feldolgozás", ro: "Procesare în laborator", it: "Elaborazione in laboratorio", de: "Laborverarbeitung" },
  REG_CSA_PROCESSED: { sk: "Spracovaná", cs: "Zpracovaná", en: "Processed", hu: "Feldolgozva", ro: "Procesată", it: "Elaborata", de: "Verarbeitet" },
  REG_CSA_SUSPENDED: { sk: "Pozastavená", cs: "Pozastavená", en: "Suspended", hu: "Felfüggesztve", ro: "Suspendată", it: "Sospesa", de: "Ausgesetzt" },
  REG_CSA_PENDING: { sk: "Čakajúca", cs: "Čekající", en: "Pending", hu: "Függőben", ro: "În așteptare", it: "In sospeso", de: "Ausstehend" },

  INDUE: { sk: "V lehote splatnosti", cs: "Ve lhůtě splatnosti", en: "Within due date", hu: "Határidőn belül", ro: "În termen de plată", it: "Entro scadenza", de: "Innerhalb der Frist" },
  OVERDUE: { sk: "Po splatnosti", cs: "Po splatnosti", en: "Overdue", hu: "Lejárt határidejű", ro: "Restantă", it: "Scaduta", de: "Überfällig" },
  PAID: { sk: "Uhradená", cs: "Uhrazená", en: "Paid", hu: "Kifizetve", ro: "Plătită", it: "Pagata", de: "Bezahlt" },
  UNPAID: { sk: "Neuhradená", cs: "Neuhrazená", en: "Unpaid", hu: "Kifizetetlen", ro: "Neplătită", it: "Non pagata", de: "Unbezahlt" },
  PARTIALLY_PAID: { sk: "Čiastočne uhradená", cs: "Částečně uhrazená", en: "Partially paid", hu: "Részben kifizetve", ro: "Plătită parțial", it: "Parzialmente pagata", de: "Teilweise bezahlt" },
  CANCELLED: { sk: "Zrušená", cs: "Zrušená", en: "Cancelled", hu: "Törölve", ro: "Anulată", it: "Annullata", de: "Storniert" },
  STORNO: { sk: "Stornovaná", cs: "Stornovaná", en: "Reversed", hu: "Sztornózva", ro: "Stornată", it: "Stornata", de: "Storniert" },
  NEW: { sk: "Nová", cs: "Nová", en: "New", hu: "Új", ro: "Nouă", it: "Nuova", de: "Neu" },
  WRITEOFF: { sk: "Odpísaná", cs: "Odepsaná", en: "Written off", hu: "Leírt", ro: "Scrisă", it: "Cancellata", de: "Abgeschrieben" },
  CREDIT_NOTE: { sk: "Dobropis", cs: "Dobropis", en: "Credit note", hu: "Jóváírás", ro: "Notă de credit", it: "Nota di credito", de: "Gutschrift" },
  PROFORMA: { sk: "Proforma", cs: "Proforma", en: "Proforma", hu: "Proforma", ro: "Proforma", it: "Proforma", de: "Proforma" },

  CON_ACTIVE: { sk: "Aktívna", cs: "Aktivní", en: "Active", hu: "Aktív", ro: "Activă", it: "Attiva", de: "Aktiv" },
  CON_SIGNED: { sk: "Podpísaná", cs: "Podepsaná", en: "Signed", hu: "Aláírva", ro: "Semnată", it: "Firmata", de: "Unterschrieben" },
  CON_CANCELLED: { sk: "Zrušená", cs: "Zrušená", en: "Cancelled", hu: "Törölve", ro: "Anulată", it: "Annullata", de: "Storniert" },
  CON_EXPIRED: { sk: "Expirovaná", cs: "Expirovaná", en: "Expired", hu: "Lejárt", ro: "Expirată", it: "Scaduta", de: "Abgelaufen" },
  CON_DRAFT: { sk: "Koncept", cs: "Koncept", en: "Draft", hu: "Vázlat", ro: "Ciornă", it: "Bozza", de: "Entwurf" },
  CON_COMPLETED: { sk: "Dokončená", cs: "Dokončená", en: "Completed", hu: "Befejezve", ro: "Finalizată", it: "Completata", de: "Abgeschlossen" },
};

export function getDocumentStatusLabel(status: string, locale: Locale = "sk"): string {
  const labels = STATUS_LABELS[status] || STATUS_LABELS[status.toUpperCase()] || STATUS_LABELS[status.toLowerCase()];
  if (labels) return labels[locale] || labels.en || status;
  return status;
}

export function getDocumentStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  const s = status.toLowerCase();
  if (s.includes("realized") || s.includes("validated") || s.includes("confirmed") || s.includes("stored") || s.includes("processed")) return "default";
  if ((s.includes("paid") && !s.includes("unpaid") && !s.includes("partial")) || s.includes("sign") || s.includes("complet") || s === "active" || s.includes("csa_active")) return "default";
  if (s.includes("sent") || s.includes("pending") || s.includes("indue") || s.includes("generated") || s.includes("registered") || s.includes("progress") || s.includes("planned") || s.includes("lab_processing") || s.includes("sample_received") || s.includes("waiting") || s.includes("proforma") || s.includes("new")) return "secondary";
  if (s.includes("overdue") || s.includes("cancel") || s.includes("storno") || s.includes("expir") || s.includes("unpaid") || s.includes("terminat") || s.includes("writeoff") || s.includes("suspend")) return "destructive";
  if (s.includes("draft") || s.includes("returned") || s.includes("credit")) return "outline";
  return "outline";
}

const TYPE_LABELS: Record<string, Record<Locale, string>> = {
  contract: { sk: "Zmluva", cs: "Smlouva", en: "Contract", hu: "Szerződés", ro: "Contract", it: "Contratto", de: "Vertrag" },
  invoice: { sk: "Faktúra", cs: "Faktura", en: "Invoice", hu: "Számla", ro: "Factură", it: "Fattura", de: "Rechnung" },
  credit_note: { sk: "Dobropis", cs: "Dobropis", en: "Credit note", hu: "Jóváírás", ro: "Notă de credit", it: "Nota di credito", de: "Gutschrift" },
  proforma: { sk: "Proforma", cs: "Proforma", en: "Proforma", hu: "Proforma", ro: "Proforma", it: "Proforma", de: "Proforma" },

  REG_ITY_INVOICE: { sk: "Faktúra", cs: "Faktura", en: "Invoice", hu: "Számla", ro: "Factură", it: "Fattura", de: "Rechnung" },
  REG_ITY_CREDIT_NOTE: { sk: "Dobropis", cs: "Dobropis", en: "Credit note", hu: "Jóváírás", ro: "Notă de credit", it: "Nota di credito", de: "Gutschrift" },
  REG_ITY_PROFORMA: { sk: "Zálohová faktúra", cs: "Zálohová faktura", en: "Proforma invoice", hu: "Előlegszámla", ro: "Factură proforma", it: "Fattura proforma", de: "Proforma-Rechnung" },
  REG_ITY_ADVANCE: { sk: "Záloha", cs: "Záloha", en: "Advance", hu: "Előleg", ro: "Avans", it: "Anticipo", de: "Vorauszahlung" },
  REG_ITY_ADVANCE_INVOICE: { sk: "Zálohová faktúra", cs: "Zálohová faktura", en: "Advance invoice", hu: "Előlegszámla", ro: "Factură de avans", it: "Fattura di anticipo", de: "Vorauszahlungsrechnung" },
  REG_ITY_DEPOSIT: { sk: "Záloha", cs: "Záloha", en: "Deposit", hu: "Letét", ro: "Depozit", it: "Deposito", de: "Anzahlung" },
  REG_ITY_CORRECTION: { sk: "Opravná faktúra", cs: "Opravná faktura", en: "Correction", hu: "Korrekciós számla", ro: "Factură de corecție", it: "Nota di correzione", de: "Korrekturrechnung" },
  REG_ITY_FINAL: { sk: "Vyúčtovacia faktúra", cs: "Vyúčtovací faktura", en: "Final invoice", hu: "Végszámla", ro: "Factură finală", it: "Fattura finale", de: "Schlussrechnung" },
  REG_ITY_RECURRING: { sk: "Opakovaná faktúra", cs: "Opakovaná faktura", en: "Recurring invoice", hu: "Ismétlődő számla", ro: "Factură recurentă", it: "Fattura ricorrente", de: "Wiederkehrende Rechnung" },
  REG_ITY_PENALTY: { sk: "Penále", cs: "Penále", en: "Penalty", hu: "Büntetés", ro: "Penalitate", it: "Penale", de: "Strafgebühr" },
  REG_ITY_INTEREST: { sk: "Úrok z omeškania", cs: "Úrok z prodlení", en: "Late interest", hu: "Késedelmi kamat", ro: "Dobândă de întârziere", it: "Interessi di mora", de: "Verzugszinsen" },
  REG_ITY_FEE: { sk: "Poplatok", cs: "Poplatek", en: "Fee", hu: "Díj", ro: "Taxă", it: "Tassa", de: "Gebühr" },
  REG_ITY_STORNO: { sk: "Storno faktúra", cs: "Storno faktura", en: "Reversal invoice", hu: "Sztornó számla", ro: "Factură storno", it: "Fattura di storno", de: "Stornorechnung" },
  REG_ITY_DELIVERY_NOTE: { sk: "Dodací list", cs: "Dodací list", en: "Delivery note", hu: "Szállítólevél", ro: "Aviz de expediție", it: "Bolla di consegna", de: "Lieferschein" },
  REG_ITY_ORDER: { sk: "Objednávka", cs: "Objednávka", en: "Order", hu: "Megrendelés", ro: "Comandă", it: "Ordine", de: "Bestellung" },
  REG_ITY_RECEIPT: { sk: "Príjmový doklad", cs: "Příjmový doklad", en: "Receipt", hu: "Nyugta", ro: "Chitanță", it: "Ricevuta", de: "Quittung" },
  REG_ITY_REMINDER: { sk: "Upomienka", cs: "Upomínka", en: "Reminder", hu: "Emlékeztető", ro: "Reamintire", it: "Sollecito", de: "Mahnung" },

  INVOICE: { sk: "Faktúra", cs: "Faktura", en: "Invoice", hu: "Számla", ro: "Factură", it: "Fattura", de: "Rechnung" },
  CREDIT_NOTE: { sk: "Dobropis", cs: "Dobropis", en: "Credit note", hu: "Jóváírás", ro: "Notă de credit", it: "Nota di credito", de: "Gutschrift" },
  PROFORMA: { sk: "Zálohová faktúra", cs: "Zálohová faktura", en: "Proforma", hu: "Proforma", ro: "Proforma", it: "Proforma", de: "Proforma" },
  ADVANCE: { sk: "Záloha", cs: "Záloha", en: "Advance", hu: "Előleg", ro: "Avans", it: "Anticipo", de: "Vorauszahlung" },
  CORRECTION: { sk: "Opravná faktúra", cs: "Opravná faktura", en: "Correction", hu: "Korrekció", ro: "Corecție", it: "Correzione", de: "Korrektur" },
  STORNO: { sk: "Storno faktúra", cs: "Storno faktura", en: "Reversal", hu: "Sztornó", ro: "Storno", it: "Storno", de: "Storno" },
  PENALTY: { sk: "Penále", cs: "Penále", en: "Penalty", hu: "Büntetés", ro: "Penalitate", it: "Penale", de: "Strafe" },
  INTEREST: { sk: "Úrok z omeškania", cs: "Úrok z prodlení", en: "Interest", hu: "Kamat", ro: "Dobândă", it: "Interesse", de: "Zinsen" },
  FEE: { sk: "Poplatok", cs: "Poplatek", en: "Fee", hu: "Díj", ro: "Taxă", it: "Tassa", de: "Gebühr" },
};

export function getDocumentTypeLabel(typeCode: string, locale: Locale = "sk"): string {
  const labels = TYPE_LABELS[typeCode] || TYPE_LABELS[typeCode.toUpperCase()] || TYPE_LABELS[typeCode.toLowerCase()];
  if (labels) return labels[locale] || labels.en || typeCode;
  return typeCode;
}

export const DEBT_STATUS_LABELS: Record<string, Record<Locale, string>> = {
  active: { sk: "Aktívny", cs: "Aktivní", en: "Active", hu: "Aktív", ro: "Activ", it: "Attivo", de: "Aktiv" },
  closed: { sk: "Uzavretý", cs: "Uzavřený", en: "Closed", hu: "Lezárva", ro: "Închis", it: "Chiuso", de: "Geschlossen" },
};

export function getDebtStatusLabel(status: string, locale: Locale = "sk"): string {
  const labels = DEBT_STATUS_LABELS[status] || DEBT_STATUS_LABELS[status.toLowerCase()];
  if (labels) return labels[locale] || labels.en || status;
  return status;
}
