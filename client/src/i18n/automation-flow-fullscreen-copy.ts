import type { Locale } from "@/i18n";

export interface AutomationFlowFullscreenCopy {
  maximize: string;
  restore: string;
  close: string;
  dialogDescription: string;
}

const copy: Record<string, AutomationFlowFullscreenCopy> = {
  en: {
    maximize: "Maximize",
    restore: "Restore",
    close: "Close",
    dialogDescription: "Expanded automation flow preview. Press Escape to restore the preview.",
  },
  sk: {
    maximize: "Na celú obrazovku",
    restore: "Zmenšiť",
    close: "Zavrieť",
    dialogDescription: "Rozšírený náhľad automatizácie. Stlačením Escape obnovíte náhľad.",
  },
  cs: {
    maximize: "Na celou obrazovku",
    restore: "Zmenšit",
    close: "Zavřít",
    dialogDescription: "Rozšířený náhled automatizace. Stisknutím Escape obnovíte náhled.",
  },
  hu: {
    maximize: "Teljes méret",
    restore: "Visszaállítás",
    close: "Bezárás",
    dialogDescription: "A teljes méretű automatizmus-előnézet. Az Escape billentyűvel visszaállítható.",
  },
  ro: {
    maximize: "Mărește",
    restore: "Restabilește",
    close: "Închide",
    dialogDescription: "Previzualizare extinsă a fluxului automatizării. Apasă Escape pentru a reveni.",
  },
  it: {
    maximize: "Espandi",
    restore: "Ripristina",
    close: "Chiudi",
    dialogDescription: "Anteprima espansa del flusso di automazione. Premi Escape per tornare indietro.",
  },
  de: {
    maximize: "Vergrößern",
    restore: "Wiederherstellen",
    close: "Schließen",
    dialogDescription: "Vergrößerte Vorschau des Automatisierungsablaufs. Mit Escape zur Vorschau zurückkehren.",
  },
};

export function getAutomationFlowFullscreenCopy(locale: Locale): AutomationFlowFullscreenCopy {
  return copy[locale] || copy.en;
}
