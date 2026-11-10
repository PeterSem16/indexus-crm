export type ClinicCreationCopy = { pending: string; partial: string; addressUnavailable?: string };
export const clinicCreationCopy: Record<"en" | "sk" | "cs" | "hu" | "ro" | "it" | "de", ClinicCreationCopy> = {
  en: { pending: "These details will be linked when you save the clinic.", partial: "The clinic was created, but some related details could not be saved. Keep this window open and retry Save; it will not create another clinic." },
  sk: { pending: "Tieto údaje sa priradia pri uložení ambulancie.", partial: "Ambulancia bola vytvorená, ale niektoré súvisiace údaje sa nepodarilo uložiť. Nechajte okno otvorené a zopakujte Uložiť; ďalšia ambulancia sa nevytvorí." },
  cs: { pending: "Tyto údaje se přiřadí při uložení ambulance.", partial: "Ambulance byla vytvořena, ale některé související údaje se nepodařilo uložit. Nechte okno otevřené a zopakujte Uložit; další ambulance se nevytvoří." },
  hu: { pending: "Ezek az adatok a rendelő mentésekor lesznek hozzárendelve.", partial: "A rendelő létrejött, de egyes kapcsolódó adatokat nem sikerült menteni. Hagyja nyitva az ablakot, és próbálja újra a mentést; nem jön létre újabb rendelő." },
  ro: { pending: "Aceste date vor fi asociate la salvarea clinicii.", partial: "Clinica a fost creată, dar unele date asociate nu au putut fi salvate. Păstrați fereastra deschisă și încercați din nou Salvare; nu va fi creată o altă clinică." },
  it: { pending: "Questi dati saranno associati al salvataggio della clinica.", partial: "La clinica è stata creata, ma alcuni dati collegati non sono stati salvati. Lascia aperta la finestra e riprova Salva; non verrà creata un'altra clinica." },
  de: { pending: "Diese Angaben werden beim Speichern der Praxis zugeordnet.", partial: "Die Praxis wurde erstellt, aber einige zugehörige Angaben konnten nicht gespeichert werden. Lassen Sie das Fenster offen und wiederholen Sie Speichern; es wird keine weitere Praxis erstellt." },
};
const unavailable: Record<keyof typeof clinicCreationCopy, string> = {
  en: "Address completion is unavailable. Select the region and district manually.",
  sk: "Služba dopĺňania adresy nie je dostupná. Kraj a okres vyberte ručne.",
  cs: "Služba doplňování adresy není dostupná. Kraj a okres vyberte ručně.",
  hu: "A címkiegészítés nem érhető el. Válassza ki kézzel a régiót és a járást.",
  ro: "Completarea adresei nu este disponibilă. Selectați manual regiunea și districtul.",
  it: "Il completamento dell'indirizzo non è disponibile. Seleziona manualmente regione e distretto.",
  de: "Die Adressvervollständigung ist nicht verfügbar. Wählen Sie Region und Bezirk manuell.",
};
for (const locale of Object.keys(clinicCreationCopy) as (keyof typeof clinicCreationCopy)[]) {
  clinicCreationCopy[locale].addressUnavailable = unavailable[locale];
}
