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

  REG_IST_INDUE: { sk: "V lehote splatnosti", cs: "Ve lhůtě splatnosti", en: "Within due date", hu: "Határidőn belül", ro: "În termen de plată", it: "Entro scadenza", de: "Innerhalb der Frist" },
  REG_IST_OVERDUE: { sk: "Po splatnosti", cs: "Po splatnosti", en: "Overdue", hu: "Lejárt határidejű", ro: "Restantă", it: "Scaduta", de: "Überfällig" },
  REG_IST_PAID: { sk: "Uhradená", cs: "Uhrazená", en: "Paid", hu: "Kifizetve", ro: "Plătită", it: "Pagata", de: "Bezahlt" },
  REG_IST_PARTIALLY_PAID: { sk: "Čiastočne uhradená", cs: "Částečně uhrazená", en: "Partially paid", hu: "Részben kifizetve", ro: "Plătită parțial", it: "Parzialmente pagata", de: "Teilweise bezahlt" },
  REG_IST_CANCELLED: { sk: "Zrušená", cs: "Zrušená", en: "Cancelled", hu: "Törölve", ro: "Anulată", it: "Annullata", de: "Storniert" },
  REG_IST_STORNO: { sk: "Stornovaná", cs: "Stornovaná", en: "Reversed", hu: "Sztornózva", ro: "Stornată", it: "Stornata", de: "Storniert" },
  INDUE: { sk: "V lehote splatnosti", cs: "Ve lhůtě splatnosti", en: "Within due date", hu: "Határidőn belül", ro: "În termen de plată", it: "Entro scadenza", de: "Innerhalb der Frist" },
  OVERDUE: { sk: "Po splatnosti", cs: "Po splatnosti", en: "Overdue", hu: "Lejárt határidejű", ro: "Restantă", it: "Scaduta", de: "Überfällig" },
  PAID: { sk: "Uhradená", cs: "Uhrazená", en: "Paid", hu: "Kifizetve", ro: "Plătită", it: "Pagata", de: "Bezahlt" },
  UNPAID: { sk: "Neuhradená", cs: "Neuhrazená", en: "Unpaid", hu: "Kifizetetlen", ro: "Neplătită", it: "Non pagata", de: "Unbezahlt" },
  PARTIALLY_PAID: { sk: "Čiastočne uhradená", cs: "Částečně uhrazená", en: "Partially paid", hu: "Részben kifizetve", ro: "Plătită parțial", it: "Parzialmente pagata", de: "Teilweise bezahlt" },
  CANCELLED: { sk: "Zrušená", cs: "Zrušená", en: "Cancelled", hu: "Törölve", ro: "Anulată", it: "Annullata", de: "Storniert" },
  STORNO: { sk: "Stornovaná", cs: "Stornovaná", en: "Reversed", hu: "Sztornózva", ro: "Stornată", it: "Stornata", de: "Storniert" },

  CON_ACTIVE: { sk: "Aktívna", cs: "Aktivní", en: "Active", hu: "Aktív", ro: "Activă", it: "Attiva", de: "Aktiv" },
  CON_SIGNED: { sk: "Podpísaná", cs: "Podepsaná", en: "Signed", hu: "Aláírva", ro: "Semnată", it: "Firmata", de: "Unterschrieben" },
  CON_CANCELLED: { sk: "Zrušená", cs: "Zrušená", en: "Cancelled", hu: "Törölve", ro: "Anulată", it: "Annullata", de: "Storniert" },
  CON_EXPIRED: { sk: "Expirovaná", cs: "Expirovaná", en: "Expired", hu: "Lejárt", ro: "Expirată", it: "Scaduta", de: "Abgelaufen" },
  CON_DRAFT: { sk: "Koncept", cs: "Koncept", en: "Draft", hu: "Vázlat", ro: "Ciornă", it: "Bozza", de: "Entwurf" },
  CON_COMPLETED: { sk: "Dokončená", cs: "Dokončená", en: "Completed", hu: "Befejezve", ro: "Finalizată", it: "Completata", de: "Abgeschlossen" },

  new: { sk: "Nová", cs: "Nová", en: "New", hu: "Új", ro: "Nouă", it: "Nuova", de: "Neu" },
  NEW: { sk: "Nová", cs: "Nová", en: "New", hu: "Új", ro: "Nouă", it: "Nuova", de: "Neu" },
  writeoff: { sk: "Odpísaná", cs: "Odepsaná", en: "Written off", hu: "Leírt", ro: "Scrisă", it: "Cancellata", de: "Abgeschrieben" },
  WRITEOFF: { sk: "Odpísaná", cs: "Odepsaná", en: "Written off", hu: "Leírt", ro: "Scrisă", it: "Cancellata", de: "Abgeschrieben" },
  REG_IST_NEW: { sk: "Nová", cs: "Nová", en: "New", hu: "Új", ro: "Nouă", it: "Nuova", de: "Neu" },
  REG_IST_WRITEOFF: { sk: "Odpísaná", cs: "Odepsaná", en: "Written off", hu: "Leírt", ro: "Scrisă", it: "Cancellata", de: "Abgeschrieben" },
};

export function getDocumentStatusLabel(status: string, locale: Locale = "sk"): string {
  const labels = STATUS_LABELS[status] || STATUS_LABELS[status.toUpperCase()] || STATUS_LABELS[status.toLowerCase()];
  if (labels) return labels[locale] || labels.en || status;
  return status;
}

export function getDocumentStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  const s = status.toLowerCase();
  if ((s.includes("paid") && !s.includes("unpaid") && !s.includes("partial")) || s.includes("sign") || s.includes("complet") || s === "active" || s === "con_active") return "default";
  if (s.includes("sent") || s.includes("pending") || s.includes("indue") || s.includes("generated")) return "secondary";
  if (s.includes("overdue") || s.includes("cancel") || s.includes("storno") || s.includes("expir") || s.includes("unpaid")) return "destructive";
  return "outline";
}

export const DEBT_STATUS_LABELS: Record<string, Record<Locale, string>> = {
  active: { sk: "Aktívny", cs: "Aktivní", en: "Active", hu: "Aktív", ro: "Activ", it: "Attivo", de: "Aktiv" },
  closed: { sk: "Uzavretý", cs: "Uzavřený", en: "Closed", hu: "Lezárva", ro: "Închis", it: "Chiuso", de: "Geschlossen" },
};

export function getDebtStatusLabel(status: string, locale: Locale = "sk"): string {
  const labels = DEBT_STATUS_LABELS[status];
  if (labels) return labels[locale] || labels.en || status;
  return status;
}
