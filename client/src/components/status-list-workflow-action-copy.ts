import type { WorkflowAction } from "@shared/status-list-workflow";

type ActionCopy = {
  type: string; text: string; notes: string; noteHint: string; selectionHint: string; clearHint: string;
  labels: Record<WorkflowAction["type"], string>;
};
const copy: Record<string, ActionCopy> = {
  en: {
    type: "Action type", text: "Note text", notes: "Step notes",
    noteHint: "Changes only the note, including on an unconfirmed step. It does not confirm the step or run its automations.",
    selectionHint: "Changes this option only. Other choices remain selected. Available only in multiple-choice groups.",
    clearHint: "Removes the answer or confirmation, not its note. No subsequent automations are triggered.",
    labels: { set_answer: "Set an answer", clear_answer: "Clear an answer", confirm_step: "Confirm a step", unconfirm_step: "Remove step confirmation", add_selection: "Add a multiple-choice option", remove_selection: "Remove a multiple-choice option", replace_note: "Replace a note", append_note: "Append to a note", clear_note: "Clear a note" },
  },
  sk: {
    type: "Typ akcie", text: "Text poznámky", notes: "Poznámky krokov",
    noteHint: "Mení iba poznámku, aj pri nepotvrdenom kroku. Krok nepotvrdí a nespustí jeho automatizácie.",
    selectionHint: "Mení iba túto možnosť. Ostatné výbery zostanú zachované. Dostupné iba v skupinách s viacnásobným výberom.",
    clearHint: "Odstráni odpoveď alebo potvrdenie, nie poznámku. Nadväzujúce automatizácie sa nespustia.",
    labels: { set_answer: "Nastaviť odpoveď", clear_answer: "Vymazať odpoveď", confirm_step: "Potvrdiť krok", unconfirm_step: "Zrušiť potvrdenie kroku", add_selection: "Pridať možnosť viacnásobného výberu", remove_selection: "Odobrať možnosť viacnásobného výberu", replace_note: "Nahradiť poznámku", append_note: "Doplniť poznámku", clear_note: "Vymazať poznámku" },
  },
  cs: {
    type: "Typ akce", text: "Text poznámky", notes: "Poznámky kroků",
    noteHint: "Mění pouze poznámku, i u nepotvrzeného kroku. Krok nepotvrdí a nespustí jeho automatizace.",
    selectionHint: "Mění pouze tuto možnost. Ostatní výběry zůstanou zachovány. Dostupné pouze ve skupinách s vícenásobným výběrem.",
    clearHint: "Odstraní odpověď nebo potvrzení, nikoli poznámku. Navazující automatizace se nespustí.",
    labels: { set_answer: "Nastavit odpověď", clear_answer: "Vymazat odpověď", confirm_step: "Potvrdit krok", unconfirm_step: "Zrušit potvrzení kroku", add_selection: "Přidat možnost vícenásobného výběru", remove_selection: "Odebrat možnost vícenásobného výběru", replace_note: "Nahradit poznámku", append_note: "Doplnit poznámku", clear_note: "Vymazat poznámku" },
  },
  hu: {
    type: "Művelet típusa", text: "Megjegyzés szövege", notes: "Lépések megjegyzései",
    noteHint: "Csak a megjegyzést módosítja, meg nem erősített lépésnél is. Nem erősíti meg a lépést, és nem indít automatizálást.",
    selectionHint: "Csak ezt a lehetőséget módosítja. A többi választás megmarad. Csak többválasztásos csoportoknál érhető el.",
    clearHint: "A választ vagy megerősítést törli, nem a megjegyzést. További automatizálás nem indul.",
    labels: { set_answer: "Válasz beállítása", clear_answer: "Válasz törlése", confirm_step: "Lépés megerősítése", unconfirm_step: "Lépés megerősítésének visszavonása", add_selection: "Többválasztásos lehetőség hozzáadása", remove_selection: "Többválasztásos lehetőség eltávolítása", replace_note: "Megjegyzés cseréje", append_note: "Megjegyzés kiegészítése", clear_note: "Megjegyzés törlése" },
  },
  ro: {
    type: "Tip de acțiune", text: "Textul notei", notes: "Notele pașilor",
    noteHint: "Modifică doar nota, inclusiv pentru un pas neconfirmat. Nu confirmă pasul și nu pornește automatizările acestuia.",
    selectionHint: "Modifică doar această opțiune. Celelalte selecții se păstrează. Disponibil numai în grupurile cu selecție multiplă.",
    clearHint: "Elimină răspunsul sau confirmarea, nu nota. Nu se declanșează automatizări ulterioare.",
    labels: { set_answer: "Setează un răspuns", clear_answer: "Șterge un răspuns", confirm_step: "Confirmă un pas", unconfirm_step: "Anulează confirmarea pasului", add_selection: "Adaugă o opțiune de selecție multiplă", remove_selection: "Elimină o opțiune de selecție multiplă", replace_note: "Înlocuiește nota", append_note: "Completează nota", clear_note: "Șterge nota" },
  },
  it: {
    type: "Tipo di azione", text: "Testo della nota", notes: "Note dei passaggi",
    noteHint: "Modifica solo la nota, anche per un passaggio non confermato. Non conferma il passaggio e non avvia le sue automazioni.",
    selectionHint: "Modifica solo questa opzione. Le altre selezioni restano invariate. Disponibile solo nei gruppi a scelta multipla.",
    clearHint: "Rimuove la risposta o la conferma, non la nota. Non vengono avviate automazioni successive.",
    labels: { set_answer: "Imposta una risposta", clear_answer: "Cancella una risposta", confirm_step: "Conferma un passaggio", unconfirm_step: "Annulla la conferma del passaggio", add_selection: "Aggiungi un'opzione a scelta multipla", remove_selection: "Rimuovi un'opzione a scelta multipla", replace_note: "Sostituisci la nota", append_note: "Aggiungi alla nota", clear_note: "Cancella la nota" },
  },
  de: {
    type: "Aktionstyp", text: "Notiztext", notes: "Schrittnotizen",
    noteHint: "Ändert nur die Notiz, auch bei einem unbestätigten Schritt. Bestätigt den Schritt nicht und startet keine Automatisierungen.",
    selectionHint: "Ändert nur diese Option. Andere Auswahlen bleiben erhalten. Nur in Mehrfachauswahlgruppen verfügbar.",
    clearHint: "Entfernt die Antwort oder Bestätigung, nicht die Notiz. Es werden keine Folgeautomatisierungen ausgelöst.",
    labels: { set_answer: "Antwort setzen", clear_answer: "Antwort löschen", confirm_step: "Schritt bestätigen", unconfirm_step: "Schrittbestätigung aufheben", add_selection: "Mehrfachauswahloption hinzufügen", remove_selection: "Mehrfachauswahloption entfernen", replace_note: "Notiz ersetzen", append_note: "Notiz ergänzen", clear_note: "Notiz löschen" },
  },
};
export const getStatusWorkflowActionCopy = (locale: string): ActionCopy => copy[locale] || copy.en;
