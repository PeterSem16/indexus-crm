import type { Locale } from "./translations";

export interface FunnelExportCopy {
  excel: string; csv: string; exporting: string; error: string;
  metadata: string; summary: string; evidence: string; exceptions: string; quality: string;
  field: string; value: string; allTime: string; clinicId: string;
}
export const funnelExportTranslations: Record<Locale, FunnelExportCopy> = {
  en: { excel: "Excel (.xlsx)", csv: "CSV (.csv)", exporting: "Exporting…", error: "Could not export the report. Please try again.", metadata: "Report information", summary: "Funnel summary", evidence: "Clinic evidence", exceptions: "Exceptions", quality: "Data quality", field: "Field", value: "Value", allTime: "All time", clinicId: "Clinic ID" },
  sk: { excel: "Excel (.xlsx)", csv: "CSV (.csv)", exporting: "Exportujem…", error: "Report sa nepodarilo exportovať. Skúste to znova.", metadata: "Informácie o reporte", summary: "Súhrn lievika", evidence: "Dôkazy kliník", exceptions: "Výnimky", quality: "Kvalita údajov", field: "Pole", value: "Hodnota", allTime: "Celé obdobie", clinicId: "ID kliniky" },
  cs: { excel: "Excel (.xlsx)", csv: "CSV (.csv)", exporting: "Exportuji…", error: "Report se nepodařilo exportovat. Zkuste to znovu.", metadata: "Informace o reportu", summary: "Souhrn trychtýře", evidence: "Důkazy klinik", exceptions: "Výjimky", quality: "Kvalita dat", field: "Pole", value: "Hodnota", allTime: "Celé období", clinicId: "ID kliniky" },
  hu: { excel: "Excel (.xlsx)", csv: "CSV (.csv)", exporting: "Exportálás…", error: "A jelentés exportálása nem sikerült. Próbálja újra.", metadata: "Jelentés adatai", summary: "Tölcsér összesítő", evidence: "Klinikai bizonyítékok", exceptions: "Kivételek", quality: "Adatminőség", field: "Mező", value: "Érték", allTime: "Teljes időszak", clinicId: "Klinika azonosítója" },
  ro: { excel: "Excel (.xlsx)", csv: "CSV (.csv)", exporting: "Se exportă…", error: "Raportul nu a putut fi exportat. Încercați din nou.", metadata: "Informații raport", summary: "Rezumat pâlnie", evidence: "Dovezi clinici", exceptions: "Excepții", quality: "Calitatea datelor", field: "Câmp", value: "Valoare", allTime: "Întreaga perioadă", clinicId: "ID clinică" },
  it: { excel: "Excel (.xlsx)", csv: "CSV (.csv)", exporting: "Esportazione…", error: "Impossibile esportare il report. Riprovare.", metadata: "Informazioni report", summary: "Riepilogo funnel", evidence: "Evidenze cliniche", exceptions: "Eccezioni", quality: "Qualità dei dati", field: "Campo", value: "Valore", allTime: "Tutto il periodo", clinicId: "ID clinica" },
  de: { excel: "Excel (.xlsx)", csv: "CSV (.csv)", exporting: "Wird exportiert…", error: "Der Bericht konnte nicht exportiert werden. Bitte erneut versuchen.", metadata: "Berichtsinformationen", summary: "Funnel-Zusammenfassung", evidence: "Kliniknachweise", exceptions: "Ausnahmen", quality: "Datenqualität", field: "Feld", value: "Wert", allTime: "Gesamter Zeitraum", clinicId: "Klinik-ID" },
};
