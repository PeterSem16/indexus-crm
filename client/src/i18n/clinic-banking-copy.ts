export type ClinicBankingCopy = { accountName: string; description: string };
export const clinicBankingCopy: Record<"en" | "sk" | "cs" | "hu" | "ro" | "it" | "de", ClinicBankingCopy> = {
  en: { accountName: "Account name according to the agreement", description: "Enter the clinic's bank details according to the agreement." },
  sk: { accountName: "Názov účtu podľa zmluvy", description: "Uveďte bankové spojenie ambulancie podľa zmluvy." },
  cs: { accountName: "Název účtu podle smlouvy", description: "Uveďte bankovní spojení ambulance podle smlouvy." },
  hu: { accountName: "Számla neve a szerződés szerint", description: "Adja meg a rendelő banki adatait a szerződés szerint." },
  ro: { accountName: "Denumirea contului conform contractului", description: "Introduceți datele bancare ale clinicii conform contractului." },
  it: { accountName: "Nome del conto come da contratto", description: "Inserisci i dati bancari della clinica come da contratto." },
  de: { accountName: "Kontoname laut Vertrag", description: "Geben Sie die Bankverbindung der Praxis laut Vertrag ein." },
};
