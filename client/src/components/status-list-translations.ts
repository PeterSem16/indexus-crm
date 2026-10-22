import type { Locale } from "@/i18n/translations";

export interface StatusListQuestionAppearanceCopy {
  icon: string;
  color: string;
  current: string;
  custom: string;
  keep: string;
  palette: string[];
}

export interface StatusListQuestionHistoryCopy {
  saved: string;
  by: string;
  note: string;
  save: string;
  pending: string;
  notePlaceholder: string;
  saveError: string;
  saving: string;
}

export interface MobileStatusListNoteCopy {
  placeholder: string;
  save: string;
  saving: string;
  saveError: string;
}

export interface StatusListCopyNamespaces {
  statusListQuestionAppearance: StatusListQuestionAppearanceCopy;
  statusListReportingLabels: Record<string, string>;
  statusListCanonicalStatusHint: string;
  statusListQuestionHistory: StatusListQuestionHistoryCopy;
  mobileStatusListNote: MobileStatusListNoteCopy;
}

export const statusListCopyNamespaces: Record<Locale, StatusListCopyNamespaces> = {
  en: {
    statusListQuestionAppearance: { icon: "Question icon", color: "Question accent", current: "Current saved value", custom: "Custom color", keep: "This saved color is preserved until you choose a replacement.", palette: ["Sea glass", "Moss", "Terracotta", "Saffron", "Berry", "Slate"] },
    statusListReportingLabels: { acquisition_contacted: "First contact made", acquisition_interested: "Interested in cooperation", acquisition_not_interested: "Not interested", acquisition_in_negotiation: "In negotiation", contract_sent: "Contract sent", contract_signed: "Contract signed", contract_rejected: "Contract rejected", flyers_sent: "Flyers sent", flyers_accepted: "Flyers accepted", flyers_rejected: "Flyers rejected", retention_active: "Active cooperation", retention_paused: "Cooperation paused", retention_terminated: "Cooperation terminated", services_confirmed: "Services confirmed", services_declined: "Services declined", retention_leaflets_sent: "Leaflets sent · active cooperation", retention_pregbook_sent: "Pregnancy booklets sent", retention_posters_sent: "Posters sent", retention_materials_sent: "Marketing materials sent" },
    statusListCanonicalStatusHint: "Canonical clinic cooperation status — a reporting label, not a phase or question group.",
    statusListQuestionHistory: { saved: "Answered", by: "by", note: "Question note", save: "Save note", pending: "Answer pending save", notePlaceholder: "Add a note about this question…", saving: "Saving…", saveError: "Could not save note" },
    mobileStatusListNote: { placeholder: "Note for this step…", save: "Save note", saving: "Saving…", saveError: "Could not save note" },
  },
  sk: {
    statusListQuestionAppearance: { icon: "Ikona otázky", color: "Farba otázky", current: "Aktuálna uložená hodnota", custom: "Vlastná farba", keep: "Táto uložená farba zostane zachovaná, kým nevyberiete inú.", palette: ["Morské sklo", "Mach", "Terakota", "Šafran", "Bobuľová", "Bridlica"] },
    statusListReportingLabels: { acquisition_contacted: "Oslovená (prvý kontakt)", acquisition_interested: "Záujem o spoluprácu", acquisition_not_interested: "Nezáujem", acquisition_in_negotiation: "V rokovaní", contract_sent: "Zmluva odoslaná", contract_signed: "Zmluva podpísaná", contract_rejected: "Zmluva odmietnutá", flyers_sent: "Letáky odoslané", flyers_accepted: "Letáky prijaté", flyers_rejected: "Letáky odmietnuté", retention_active: "Aktívna spolupráca", retention_paused: "Spolupráca pozastavená", retention_terminated: "Spolupráca ukončená", services_confirmed: "Služby potvrdené", services_declined: "Služby odmietnuté", retention_leaflets_sent: "Letáky odoslané · aktívna spolupráca", retention_pregbook_sent: "Tehotenské knižky odoslané", retention_posters_sent: "Postery odoslané", retention_materials_sent: "Marketingové materiály odoslané" },
    statusListCanonicalStatusHint: "Kanonický stav spolupráce kliniky — označenie pre reporting, nie fáza ani skupina otázok.",
    statusListQuestionHistory: { saved: "Odpovedané", by: "od", note: "Poznámka k otázke", save: "Uložiť poznámku", pending: "Odpoveď čaká na uloženie", notePlaceholder: "Pridajte poznámku k otázke…", saving: "Ukladá sa…", saveError: "Poznámku sa nepodarilo uložiť" },
    mobileStatusListNote: { placeholder: "Poznámka k tomuto kroku…", save: "Uložiť poznámku", saving: "Ukladá sa…", saveError: "Poznámku sa nepodarilo uložiť" },
  },
  cs: {
    statusListQuestionAppearance: { icon: "Ikona otázky", color: "Barva otázky", current: "Aktuální uložená hodnota", custom: "Vlastní barva", keep: "Tato uložená barva zůstane zachována, dokud nevyberete jinou.", palette: ["Mořské sklo", "Mech", "Terakota", "Šafrán", "Bobulová", "Břidlice"] },
    statusListReportingLabels: { acquisition_contacted: "Oslovena (první kontakt)", acquisition_interested: "Zájem o spolupráci", acquisition_not_interested: "Nezájem", acquisition_in_negotiation: "Ve vyjednávání", contract_sent: "Smlouva odeslána", contract_signed: "Smlouva podepsána", contract_rejected: "Smlouva odmítnuta", flyers_sent: "Letáky odeslány", flyers_accepted: "Letáky přijaty", flyers_rejected: "Letáky odmítnuty", retention_active: "Aktivní spolupráce", retention_paused: "Spolupráce pozastavena", retention_terminated: "Spolupráce ukončena", services_confirmed: "Služby potvrzeny", services_declined: "Služby odmítnuty", retention_leaflets_sent: "Letáky odeslány · aktivní spolupráce", retention_pregbook_sent: "Těhotenské knížky odeslány", retention_posters_sent: "Plakáty odeslány", retention_materials_sent: "Marketingové materiály odeslány" },
    statusListCanonicalStatusHint: "Kanonický stav spolupráce kliniky — popisek pro reporting, nikoli fáze ani skupina otázek.",
    statusListQuestionHistory: { saved: "Zodpovězeno", by: "od", note: "Poznámka k otázce", save: "Uložit poznámku", pending: "Odpověď čeká na uložení", notePlaceholder: "Přidejte poznámku k otázce…", saving: "Ukládá se…", saveError: "Poznámku se nepodařilo uložit" },
    mobileStatusListNote: { placeholder: "Poznámka k tomuto kroku…", save: "Uložit poznámku", saving: "Ukládá se…", saveError: "Poznámku se nepodařilo uložit" },
  },
  hu: {
    statusListQuestionAppearance: { icon: "Kérdés ikonja", color: "Kérdés kiemelőszíne", current: "Jelenlegi mentett érték", custom: "Egyéni szín", keep: "A mentett szín megmarad, amíg nem választ másikat.", palette: ["Tengerüveg", "Moha", "Terrakotta", "Sáfrány", "Bogyó", "Pala"] },
    statusListReportingLabels: { acquisition_contacted: "Megkeresve (első kapcsolatfelvétel)", acquisition_interested: "Érdeklődik az együttműködés iránt", acquisition_not_interested: "Nem érdeklődik", acquisition_in_negotiation: "Tárgyalás alatt", contract_sent: "Szerződés elküldve", contract_signed: "Szerződés aláírva", contract_rejected: "Szerződés elutasítva", flyers_sent: "Szórólapok elküldve", flyers_accepted: "Szórólapok elfogadva", flyers_rejected: "Szórólapok elutasítva", retention_active: "Aktív együttműködés", retention_paused: "Együttműködés szünetel", retention_terminated: "Együttműködés megszűnt", services_confirmed: "Szolgáltatások megerősítve", services_declined: "Szolgáltatások elutasítva", retention_leaflets_sent: "Szórólapok elküldve · aktív együttműködés", retention_pregbook_sent: "Várandóskönyvek elküldve", retention_posters_sent: "Plakátok elküldve", retention_materials_sent: "Marketinganyagok elküldve" },
    statusListCanonicalStatusHint: "Kanonikus klinikai együttműködési állapot — riportcímke, nem fázis vagy kérdéscsoport.",
    statusListQuestionHistory: { saved: "Megválaszolva", by: "kitől", note: "Megjegyzés a kérdéshez", save: "Megjegyzés mentése", pending: "A válasz mentésre vár", notePlaceholder: "Megjegyzés a kérdéshez…", saving: "Mentés…", saveError: "A megjegyzés mentése nem sikerült" },
    mobileStatusListNote: { placeholder: "Megjegyzés ehhez a lépéshez…", save: "Megjegyzés mentése", saving: "Mentés…", saveError: "A megjegyzés mentése nem sikerült" },
  },
  ro: {
    statusListQuestionAppearance: { icon: "Pictograma întrebării", color: "Accentul întrebării", current: "Valoare salvată", custom: "Culoare personalizată", keep: "Culoarea salvată rămâne până alegi alta.", palette: ["Sticlă marină", "Mușchi", "Teracotă", "Șofran", "Fructe de pădure", "Ardezie"] },
    statusListReportingLabels: { acquisition_contacted: "Contactată (primul contact)", acquisition_interested: "Interesată de cooperare", acquisition_not_interested: "Neinteresată", acquisition_in_negotiation: "În negociere", contract_sent: "Contract trimis", contract_signed: "Contract semnat", contract_rejected: "Contract respins", flyers_sent: "Pliante trimise", flyers_accepted: "Pliante acceptate", flyers_rejected: "Pliante respinse", retention_active: "Cooperare activă", retention_paused: "Cooperare suspendată", retention_terminated: "Cooperare încheiată", services_confirmed: "Servicii confirmate", services_declined: "Servicii refuzate", retention_leaflets_sent: "Pliante trimise · cooperare activă", retention_pregbook_sent: "Cărți de sarcină trimise", retention_posters_sent: "Postere trimise", retention_materials_sent: "Materiale de marketing trimise" },
    statusListCanonicalStatusHint: "Starea canonică a cooperării clinicii — etichetă de raportare, nu fază sau grup de întrebări.",
    statusListQuestionHistory: { saved: "Răspuns", by: "de", note: "Notă despre întrebare", save: "Salvează nota", pending: "Răspunsul așteaptă salvarea", notePlaceholder: "Adaugă o notă despre această întrebare…", saving: "Se salvează…", saveError: "Nota nu a putut fi salvată" },
    mobileStatusListNote: { placeholder: "Notă pentru acest pas…", save: "Salvează nota", saving: "Se salvează…", saveError: "Nota nu a putut fi salvată" },
  },
  it: {
    statusListQuestionAppearance: { icon: "Icona domanda", color: "Colore domanda", current: "Valore salvato", custom: "Colore personalizzato", keep: "Il colore salvato resta finché non ne scegli un altro.", palette: ["Vetro marino", "Muschio", "Terracotta", "Zafferano", "Bacca", "Ardesia"] },
    statusListReportingLabels: { acquisition_contacted: "Contattata (primo contatto)", acquisition_interested: "Interessata alla cooperazione", acquisition_not_interested: "Non interessata", acquisition_in_negotiation: "In negoziazione", contract_sent: "Contratto inviato", contract_signed: "Contratto firmato", contract_rejected: "Contratto rifiutato", flyers_sent: "Volantini inviati", flyers_accepted: "Volantini accettati", flyers_rejected: "Volantini rifiutati", retention_active: "Cooperazione attiva", retention_paused: "Cooperazione in pausa", retention_terminated: "Cooperazione conclusa", services_confirmed: "Servizi confermati", services_declined: "Servizi rifiutati", retention_leaflets_sent: "Volantini inviati · cooperazione attiva", retention_pregbook_sent: "Libretti gravidanza inviati", retention_posters_sent: "Poster inviati", retention_materials_sent: "Materiali di marketing inviati" },
    statusListCanonicalStatusHint: "Stato canonico della collaborazione con la clinica — etichetta di report, non fase né gruppo di domande.",
    statusListQuestionHistory: { saved: "Risposta", by: "da", note: "Nota sulla domanda", save: "Salva nota", pending: "Risposta in attesa di salvataggio", notePlaceholder: "Aggiungi una nota sulla domanda…", saving: "Salvataggio…", saveError: "Impossibile salvare la nota" },
    mobileStatusListNote: { placeholder: "Nota per questo passaggio…", save: "Salva nota", saving: "Salvataggio…", saveError: "Impossibile salvare la nota" },
  },
  de: {
    statusListQuestionAppearance: { icon: "Frage-Symbol", color: "Frage-Akzentfarbe", current: "Gespeicherter Wert", custom: "Eigene Farbe", keep: "Diese gespeicherte Farbe bleibt erhalten, bis Sie eine andere wählen.", palette: ["Meerglas", "Moos", "Terrakotta", "Safran", "Beere", "Schiefer"] },
    statusListReportingLabels: { acquisition_contacted: "Kontaktiert (Erstkontakt)", acquisition_interested: "Interesse an Zusammenarbeit", acquisition_not_interested: "Kein Interesse", acquisition_in_negotiation: "In Verhandlung", contract_sent: "Vertrag gesendet", contract_signed: "Vertrag unterzeichnet", contract_rejected: "Vertrag abgelehnt", flyers_sent: "Flyer gesendet", flyers_accepted: "Flyer akzeptiert", flyers_rejected: "Flyer abgelehnt", retention_active: "Aktive Zusammenarbeit", retention_paused: "Zusammenarbeit pausiert", retention_terminated: "Zusammenarbeit beendet", services_confirmed: "Leistungen bestätigt", services_declined: "Leistungen abgelehnt", retention_leaflets_sent: "Flyer gesendet · aktive Zusammenarbeit", retention_pregbook_sent: "Schwangerschaftsbücher gesendet", retention_posters_sent: "Poster gesendet", retention_materials_sent: "Marketingmaterialien gesendet" },
    statusListCanonicalStatusHint: "Kanonischer Status der Klinikzusammenarbeit — Reporting-Bezeichnung, keine Phase oder Fragengruppe.",
    statusListQuestionHistory: { saved: "Beantwortet", by: "von", note: "Notiz zur Frage", save: "Notiz speichern", pending: "Antwort wartet auf das Speichern", notePlaceholder: "Notiz zu dieser Frage hinzufügen…", saving: "Wird gespeichert…", saveError: "Notiz konnte nicht gespeichert werden" },
    mobileStatusListNote: { placeholder: "Notiz zu diesem Schritt…", save: "Notiz speichern", saving: "Wird gespeichert…", saveError: "Notiz konnte nicht gespeichert werden" },
  },
};
