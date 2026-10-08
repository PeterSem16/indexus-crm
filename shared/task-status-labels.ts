const labels: Record<string, Record<string, string>> = {
  sk: { pending: "Čakajúca", in_progress: "V riešení", completed: "Dokončená", cancelled: "Zrušená" },
  en: { pending: "Pending", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled" },
  cs: { pending: "Čekající", in_progress: "V řešení", completed: "Dokončený", cancelled: "Zrušený" },
  hu: { pending: "Függőben", in_progress: "Folyamatban", completed: "Befejezett", cancelled: "Törölve" },
  ro: { pending: "În așteptare", in_progress: "În curs", completed: "Finalizată", cancelled: "Anulată" },
  it: { pending: "In attesa", in_progress: "In corso", completed: "Completata", cancelled: "Annullata" },
  de: { pending: "Ausstehend", in_progress: "In Bearbeitung", completed: "Abgeschlossen", cancelled: "Abgebrochen" },
};

/** Presentation only: persisted statuses and IF/action values remain technical. */
export function taskStatusTemplateLabel(status: unknown, language: string): string {
  const locale = language.toLowerCase() === "cz" ? "cs" : language.toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(labels, locale)) throw new Error("Unsupported Task template language");
  const result = typeof status === "string" && Object.prototype.hasOwnProperty.call(labels[locale], status)
    ? labels[locale][status] : undefined;
  if (!result) throw new Error("Unavailable Task template status");
  return result;
}
