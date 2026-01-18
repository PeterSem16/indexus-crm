import { SupportedLanguage } from '@/constants/config';

type VisitTypeOption = {
  code: string;
  en: string;
  sk: string;
  cs: string;
  hu: string;
  ro: string;
  it: string;
  de: string;
};

const VISIT_SUBJECTS: VisitTypeOption[] = [
  { code: "1", en: "Standard visit to strengthen recommendations and CBC cooperation", sk: "Standardna navsteva na posilnenie odporucani a spoluprace CBC", cs: "Standardni navsteva k posileni doporuceni a spoluprace CBC", hu: "Ajanlasokat es CBC egyuttmukodest erosito standard latogatas", ro: "Vizita standard pentru consolidarea recomandarilor si cooperarii CBC", it: "Visita standard per rafforzare raccomandazioni e cooperazione CBC", de: "Standardbesuch zur Starkung von Empfehlungen und CBC-Kooperation" },
  { code: "2", en: "Individual training - collection process", sk: "Individualne skolenie - proces odberu", cs: "Individualni skoleni - proces odberu", hu: "Egyeni kepzes - levelel menete", ro: "Instruire individuala - procesul de colectare", it: "Formazione individuale - processo di raccolta", de: "Einzelschulung - Entnahmeprozess" },
  { code: "3", en: "Examination of problematic collection", sk: "Preskumanie problemoveho odberu", cs: "Prosetreni problemoveho odberu", hu: "Problemas level kivizsgalasa", ro: "Examinarea colectarii problematice", it: "Esame della raccolta problematica", de: "Untersuchung problematischer Entnahme" },
  { code: "4", en: "Hospital kit delivery", sk: "Dodanie nemocnicnej supravy", cs: "Dodani nemocnicni soupravy", hu: "Korhazi szett atadas", ro: "Livrarea kitului de spital", it: "Consegna kit ospedaliero", de: "Krankenhauskit-Lieferung" },
  { code: "5", en: "Pregnancy preparation lecture for pregnant women", sk: "Prednaska pripravy na porod pre tehotne", cs: "Prednaska pripravy na porod pro tehotne", hu: "Szulesfelkeszito eloadas varandosoknak", ro: "Curs de pregatire pentru nastere pentru gravide", it: "Corso di preparazione al parto per gestanti", de: "Geburtsvorbereitung fur Schwangere" },
  { code: "6", en: "Group lecture for midwives", sk: "Skupinova prednaska pre porodne asistentky", cs: "Skupinova prednaska pro porodni asistentky", hu: "Csoportos eloadas szulesznoknek", ro: "Curs de grup pentru moase", it: "Corso di gruppo per ostetriche", de: "Gruppenvortrag fur Hebammen" },
  { code: "7", en: "Group lecture for doctors", sk: "Skupinova prednaska pre lekarov", cs: "Skupinova prednaska pro lekare", hu: "Csoportos eloadas orvosoknak", ro: "Curs de grup pentru medici", it: "Corso di gruppo per medici", de: "Gruppenvortrag fur Arzte" },
  { code: "8", en: "Hospital contract management", sk: "Sprava nemocnicnej zmluvy", cs: "Sprava nemocnicni smlouvy", hu: "Korhazi szerzodes intezese", ro: "Gestionarea contractului de spital", it: "Gestione contratto ospedaliero", de: "Krankenhausvertragsmanagement" },
  { code: "9", en: "Doctor contract management", sk: "Sprava lekarskej zmluvy", cs: "Sprava lekarske smlouvy", hu: "Orvosi szerzodes intezese", ro: "Gestionarea contractului de medic", it: "Gestione contratto medico", de: "Arztvertragsmanagement" },
  { code: "10", en: "Business partner contract management - other collaborator", sk: "Sprava zmluvy s obchodnym partnerom - iny spolupracovnik", cs: "Sprava smlouvy s obchodnim partnerem - jiny spolupracovnik", hu: "Uzleti partner szerzodes intezese - egyeb egyuttmukodo", ro: "Gestionarea contractului partener de afaceri - alt colaborator", it: "Gestione contratto partner commerciale - altro collaboratore", de: "Geschaftspartnervertragsmanagement - anderer Mitarbeiter" },
  { code: "11", en: "Other", sk: "Ine", cs: "Jine", hu: "Egyeb", ro: "Altele", it: "Altro", de: "Sonstiges" },
  { code: "12", en: "Phone call / Video conference", sk: "Telefonat / Videokonferencia", cs: "Telefonat / Videokonference", hu: "Telefonhivas / Videokonferencia", ro: "Apel telefonic / Videoconferinta", it: "Telefonata / Videoconferenza", de: "Telefonat / Videokonferenz" },
];

const VISIT_PLACE_OPTIONS: VisitTypeOption[] = [
  { code: "1", en: "Department of Obstetrics, Hospital", sk: "Porodnicke oddelenie, Nemocnica", cs: "Porodnicke oddeleni, Nemocnice", hu: "Korhaz szuleszeti osztalya", ro: "Sectia de obstetrica, Spital", it: "Reparto di Ostetricia, Ospedale", de: "Geburtshilfe-Abteilung, Krankenhaus" },
  { code: "2", en: "Private doctor's office", sk: "Sukromna ordinacia lekara", cs: "Soukroma ordinace lekare", hu: "Orvos maganrendeloje", ro: "Cabinet medical privat", it: "Studio medico privato", de: "Private Arztpraxis" },
  { code: "3", en: "State doctor's office", sk: "Statna ordinacia lekara", cs: "Statni ordinace lekare", hu: "Orvos szakrendeloje", ro: "Cabinet medical de stat", it: "Studio medico statale", de: "Staatliche Arztpraxis" },
  { code: "4", en: "Hospital management department", sk: "Vedenie nemocnice", cs: "Vedeni nemocnice", hu: "Korhaz vezetosegi osztaly", ro: "Departamentul de management al spitalului", it: "Direzione ospedaliera", de: "Krankenhausverwaltung" },
  { code: "5", en: "Other", sk: "Ine", cs: "Jine", hu: "Egyeb", ro: "Altele", it: "Altro", de: "Sonstiges" },
  { code: "6", en: "Phone call / Video conference", sk: "Telefonat / Videokonferencia", cs: "Telefonat / Videokonference", hu: "Telefonhivas / Videokonferencia", ro: "Apel telefonic / Videoconferinta", it: "Telefonata / Videoconferenza", de: "Telefonat / Videokonferenz" },
];

export function getVisitTypeName(code: string | undefined | null, language: SupportedLanguage): string {
  if (!code) return '';
  const option = VISIT_SUBJECTS.find(o => o.code === code);
  if (!option) return code;
  return option[language] || option.en || code;
}

export function getPlaceName(code: string | undefined | null, language: SupportedLanguage): string {
  if (!code) return '';
  const option = VISIT_PLACE_OPTIONS.find(o => o.code === code);
  if (!option) return code;
  return option[language] || option.en || code;
}
