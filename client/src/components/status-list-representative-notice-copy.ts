export type RepresentativeNoticeLocale = "en" | "sk" | "cs" | "hu" | "ro" | "it" | "de";

export type RepresentativeNoticeCopy = {
  dismiss: string;
  restore: string;
  notice: string;
};

export const representativeNoticeCopy: Record<RepresentativeNoticeLocale, RepresentativeNoticeCopy> = {
  en: { dismiss: "Dismiss coordinator information", restore: "Show coordinator information", notice: "Coordinator information" },
  sk: { dismiss: "Skryť informácie o koordinátorovi", restore: "Zobraziť informácie o koordinátorovi", notice: "Informácie o koordinátorovi" },
  cs: { dismiss: "Skrýt informace o koordinátorovi", restore: "Zobrazit informace o koordinátorovi", notice: "Informace o koordinátorovi" },
  hu: { dismiss: "Koordinátori információk elrejtése", restore: "Koordinátori információk megjelenítése", notice: "Koordinátori információk" },
  ro: { dismiss: "Ascunde informațiile despre coordonator", restore: "Afișează informațiile despre coordonator", notice: "Informații despre coordonator" },
  it: { dismiss: "Nascondi le informazioni sul coordinatore", restore: "Mostra le informazioni sul coordinatore", notice: "Informazioni sul coordinatore" },
  de: { dismiss: "Koordinatorinformationen ausblenden", restore: "Koordinatorinformationen anzeigen", notice: "Koordinatorinformationen" },
};

export function getRepresentativeNoticeCopy(locale: string): RepresentativeNoticeCopy {
  return representativeNoticeCopy[locale as RepresentativeNoticeLocale] || representativeNoticeCopy.en;
}
