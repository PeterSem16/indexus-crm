type HealthcareManagementCopy = {
  addQuestion: string;
  openContent: string;
  contentHelp: string;
  removeSource: string;
  removeHelp: string;
};

const copy: Record<string, HealthcareManagementCopy> = {
  en: {
    addQuestion: "Add custom question",
    openContent: "Open Content editor",
    contentHelp: "The seven entries are fixed system outcomes. Add custom questions in the Content editor; select this source group to continue there.",
    removeSource: "Remove background source",
    removeHelp: "Removing the source also deletes its reachability counters, manual reviews and reachability audit. Question and answer definitions, calls and messages remain. Callback approval checks still apply.",
  },
  sk: {
    addQuestion: "Pridať vlastnú otázku",
    openContent: "Otvoriť editor Obsahu",
    contentHelp: "Sedem položiek sú pevné systémové výsledky. Vlastné otázky pridávajte v editore Obsahu; pokračujte výberom tejto zdrojovej skupiny.",
    removeSource: "Odstrániť zdroj na pozadí",
    removeHelp: "So zdrojom sa vymažú aj jeho počítadlá dostupnosti, ručné hodnotenia a audit dostupnosti. Definície otázok a odpovedí, hovory a správy zostanú. Kontroly schválenia spätných volaní zostávajú platné.",
  },
  cs: {
    addQuestion: "Přidat vlastní otázku",
    openContent: "Otevřít editor Obsahu",
    contentHelp: "Sedm položek jsou pevné systémové výsledky. Vlastní otázky přidávejte v editoru Obsahu; pokračujte výběrem této zdrojové skupiny.",
    removeSource: "Odebrat zdroj na pozadí",
    removeHelp: "Se zdrojem se smažou také jeho počítadla dostupnosti, ruční hodnocení a audit dostupnosti. Definice otázek a odpovědí, hovory a zprávy zůstanou. Kontroly schválení zpětných volání nadále platí.",
  },
  hu: {
    addQuestion: "Egyéni kérdés hozzáadása",
    openContent: "Tartalomszerkesztő megnyitása",
    contentHelp: "A hét bejegyzés rögzített rendszereredmény. Egyéni kérdéseket a Tartalomszerkesztőben adhat hozzá; a folytatáshoz válassza ezt a forráscsoportot.",
    removeSource: "Háttérforrás eltávolítása",
    removeHelp: "A forrással együtt törlődnek az elérhetőségi számlálók, kézi értékelések és az elérhetőségi napló. A kérdés- és válaszdefiníciók, hívások és üzenetek megmaradnak. A visszahívások jóváhagyási ellenőrzései továbbra is érvényesek.",
  },
  ro: {
    addQuestion: "Adaugă o întrebare personalizată",
    openContent: "Deschide editorul de conținut",
    contentHelp: "Cele șapte intrări sunt rezultate de sistem fixe. Adăugați întrebări personalizate în editorul de conținut; selectați acest grup sursă pentru a continua.",
    removeSource: "Elimină sursa de fundal",
    removeHelp: "Eliminarea sursei șterge și contoarele de disponibilitate, evaluările manuale și auditul disponibilității. Definițiile întrebărilor și răspunsurilor, apelurile și mesajele rămân. Verificările aprobării reapelărilor se aplică în continuare.",
  },
  it: {
    addQuestion: "Aggiungi domanda personalizzata",
    openContent: "Apri editor Contenuto",
    contentHelp: "Le sette voci sono esiti di sistema fissi. Aggiungi domande personalizzate nell’editor Contenuto; seleziona questo gruppo sorgente per continuare.",
    removeSource: "Rimuovi origine in background",
    removeHelp: "La rimozione dell’origine elimina anche i contatori di reperibilità, le valutazioni manuali e il registro di reperibilità. Le definizioni di domande e risposte, le chiamate e i messaggi rimangono. Restano validi i controlli di approvazione delle richiamate.",
  },
  de: {
    addQuestion: "Eigene Frage hinzufügen",
    openContent: "Inhaltseditor öffnen",
    contentHelp: "Die sieben Einträge sind feste Systemergebnisse. Eigene Fragen werden im Inhaltseditor hinzugefügt; wählen Sie diese Quellgruppe, um dort fortzufahren.",
    removeSource: "Hintergrundquelle entfernen",
    removeHelp: "Mit der Quelle werden auch Erreichbarkeitszähler, manuelle Bewertungen und das Erreichbarkeitsprotokoll gelöscht. Frage- und Antwortdefinitionen, Anrufe und Nachrichten bleiben erhalten. Die Genehmigungsprüfungen für Rückrufe gelten weiterhin.",
  },
};

export function getHealthcareManagementCopy(locale: string): HealthcareManagementCopy {
  return copy[locale.split("-")[0].toLowerCase()] || copy.en;
}
