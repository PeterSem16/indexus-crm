import { storage } from "./storage";
import type { InsertVariableBlock, InsertVariable, InsertVariableKeyword } from "@shared/schema";

const VARIABLE_BLOCKS: InsertVariableBlock[] = [
  { code: "customer", displayName: "Zákazník / Rodička", displayNameEn: "Customer / Mother", icon: "User", priority: 1 },
  { code: "father", displayName: "Otec", displayNameEn: "Father", icon: "UserPlus", priority: 2 },
  { code: "child", displayName: "Dieťa", displayNameEn: "Child", icon: "Baby", priority: 3 },
  { code: "company", displayName: "Spoločnosť", displayNameEn: "Company", icon: "Building2", priority: 4 },
  { code: "contract", displayName: "Zmluva", displayNameEn: "Contract", icon: "FileText", priority: 5 },
  { code: "witness", displayName: "Svedok", displayNameEn: "Witness", icon: "Users", priority: 6 },
  { code: "collaborator", displayName: "Spolupracovník", displayNameEn: "Collaborator", icon: "Briefcase", priority: 7 },
  { code: "hospital", displayName: "Nemocnica", displayNameEn: "Hospital", icon: "Hospital", priority: 8 },
  { code: "clinic", displayName: "Ambulancia / Klinika", displayNameEn: "Clinic", icon: "Building2", priority: 9 },
  { code: "invoice", displayName: "Faktúra", displayNameEn: "Invoice", icon: "Receipt", priority: 9 },
  { code: "payment", displayName: "Platba", displayNameEn: "Payment", icon: "CreditCard", priority: 10 },
  { code: "product", displayName: "Produkt", displayNameEn: "Product", icon: "Package", priority: 11 },
  { code: "system", displayName: "Systémové", displayNameEn: "System", icon: "Settings", priority: 100 },
];

const BLOCK_KEYWORDS: Record<string, { keyword: string; locale: string; weight: number }[]> = {
  customer: [
    { keyword: "rodička", locale: "sk", weight: 10 },
    { keyword: "matka", locale: "sk", weight: 8 },
    { keyword: "zákazník", locale: "sk", weight: 5 },
    { keyword: "klient", locale: "sk", weight: 5 },
    { keyword: "rodičky", locale: "sk", weight: 10 },
    { keyword: "rodičke", locale: "sk", weight: 10 },
    { keyword: "rodička výslovne", locale: "sk", weight: 10 },
    { keyword: "mother", locale: "en", weight: 10 },
    { keyword: "customer", locale: "en", weight: 5 },
    { keyword: "client", locale: "en", weight: 5 },
    { keyword: "rodička a otec", locale: "sk", weight: 3 },
    { keyword: "madre", locale: "it", weight: 10 },
    { keyword: "mutter", locale: "de", weight: 10 },
    { keyword: "anya", locale: "hu", weight: 10 },
    { keyword: "mama", locale: "ro", weight: 10 },
    { keyword: "matka", locale: "cs", weight: 10 },
  ],
  father: [
    { keyword: "otec", locale: "sk", weight: 10 },
    { keyword: "otca", locale: "sk", weight: 10 },
    { keyword: "otcovi", locale: "sk", weight: 10 },
    { keyword: "father", locale: "en", weight: 10 },
    { keyword: "padre", locale: "it", weight: 10 },
    { keyword: "vater", locale: "de", weight: 10 },
    { keyword: "apa", locale: "hu", weight: 10 },
    { keyword: "tată", locale: "ro", weight: 10 },
    { keyword: "otec", locale: "cs", weight: 10 },
  ],
  child: [
    { keyword: "dieťa", locale: "sk", weight: 10 },
    { keyword: "dieťaťa", locale: "sk", weight: 10 },
    { keyword: "novorodenec", locale: "sk", weight: 8 },
    { keyword: "child", locale: "en", weight: 10 },
    { keyword: "baby", locale: "en", weight: 8 },
    { keyword: "newborn", locale: "en", weight: 8 },
    { keyword: "bambino", locale: "it", weight: 10 },
    { keyword: "kind", locale: "de", weight: 10 },
    { keyword: "gyermek", locale: "hu", weight: 10 },
    { keyword: "copil", locale: "ro", weight: 10 },
    { keyword: "dítě", locale: "cs", weight: 10 },
  ],
  company: [
    { keyword: "spoločnosť", locale: "sk", weight: 10 },
    { keyword: "firma", locale: "sk", weight: 8 },
    { keyword: "cbc ag", locale: "sk", weight: 15 },
    { keyword: "cord blood center", locale: "sk", weight: 15 },
    { keyword: "s.r.p.k.b", locale: "sk", weight: 12 },
    { keyword: "company", locale: "en", weight: 10 },
    { keyword: "corporation", locale: "en", weight: 8 },
    { keyword: "società", locale: "it", weight: 10 },
    { keyword: "gesellschaft", locale: "de", weight: 10 },
    { keyword: "cég", locale: "hu", weight: 10 },
    { keyword: "companie", locale: "ro", weight: 10 },
    { keyword: "společnost", locale: "cs", weight: 10 },
  ],
  contract: [
    { keyword: "zmluva", locale: "sk", weight: 10 },
    { keyword: "zmluve", locale: "sk", weight: 10 },
    { keyword: "zmluvou", locale: "sk", weight: 10 },
    { keyword: "číslo zmluvy", locale: "sk", weight: 12 },
    { keyword: "dátum zmluvy", locale: "sk", weight: 12 },
    { keyword: "contract", locale: "en", weight: 10 },
    { keyword: "agreement", locale: "en", weight: 8 },
    { keyword: "contratto", locale: "it", weight: 10 },
    { keyword: "vertrag", locale: "de", weight: 10 },
    { keyword: "szerződés", locale: "hu", weight: 10 },
    { keyword: "contract", locale: "ro", weight: 10 },
    { keyword: "smlouva", locale: "cs", weight: 10 },
  ],
  witness: [
    { keyword: "svedok", locale: "sk", weight: 10 },
    { keyword: "svedka", locale: "sk", weight: 10 },
    { keyword: "witness", locale: "en", weight: 10 },
    { keyword: "testimone", locale: "it", weight: 10 },
    { keyword: "zeuge", locale: "de", weight: 10 },
    { keyword: "tanú", locale: "hu", weight: 10 },
    { keyword: "martor", locale: "ro", weight: 10 },
    { keyword: "svědek", locale: "cs", weight: 10 },
  ],
  hospital: [
    { keyword: "nemocnica", locale: "sk", weight: 10 },
    { keyword: "nemocnici", locale: "sk", weight: 10 },
    { keyword: "pôrodnica", locale: "sk", weight: 10 },
    { keyword: "zdravotnícke zariadenie", locale: "sk", weight: 8 },
    { keyword: "hospital", locale: "en", weight: 10 },
    { keyword: "ospedale", locale: "it", weight: 10 },
    { keyword: "krankenhaus", locale: "de", weight: 10 },
    { keyword: "kórház", locale: "hu", weight: 10 },
    { keyword: "spital", locale: "ro", weight: 10 },
    { keyword: "nemocnice", locale: "cs", weight: 10 },
  ],
  payment: [
    { keyword: "platba", locale: "sk", weight: 10 },
    { keyword: "úhrada", locale: "sk", weight: 8 },
    { keyword: "splátka", locale: "sk", weight: 8 },
    { keyword: "iban", locale: "sk", weight: 12 },
    { keyword: "bankový účet", locale: "sk", weight: 10 },
    { keyword: "payment", locale: "en", weight: 10 },
    { keyword: "pagamento", locale: "it", weight: 10 },
    { keyword: "zahlung", locale: "de", weight: 10 },
    { keyword: "fizetés", locale: "hu", weight: 10 },
    { keyword: "plată", locale: "ro", weight: 10 },
    { keyword: "platba", locale: "cs", weight: 10 },
  ],
  product: [
    { keyword: "produkt", locale: "sk", weight: 10 },
    { keyword: "typ produktu", locale: "sk", weight: 12 },
    { keyword: "štandard", locale: "sk", weight: 8 },
    { keyword: "prémium", locale: "sk", weight: 8 },
    { keyword: "product", locale: "en", weight: 10 },
    { keyword: "prodotto", locale: "it", weight: 10 },
    { keyword: "produkt", locale: "de", weight: 10 },
    { keyword: "termék", locale: "hu", weight: 10 },
    { keyword: "produs", locale: "ro", weight: 10 },
    { keyword: "produkt", locale: "cs", weight: 10 },
  ],
  collaborator: [
    { keyword: "spolupracovník", locale: "sk", weight: 10 },
    { keyword: "spolupracovníčka", locale: "sk", weight: 10 },
    { keyword: "representant", locale: "sk", weight: 8 },
    { keyword: "poradca", locale: "sk", weight: 8 },
    { keyword: "agent", locale: "sk", weight: 5 },
    { keyword: "collaborator", locale: "en", weight: 10 },
    { keyword: "representative", locale: "en", weight: 8 },
    { keyword: "agent", locale: "en", weight: 5 },
    { keyword: "collaboratore", locale: "it", weight: 10 },
    { keyword: "mitarbeiter", locale: "de", weight: 10 },
    { keyword: "munkatárs", locale: "hu", weight: 10 },
    { keyword: "colaborator", locale: "ro", weight: 10 },
    { keyword: "spolupracovník", locale: "cs", weight: 10 },
  ],
  clinic: [
    { keyword: "ambulancia", locale: "sk", weight: 10 },
    { keyword: "klinika", locale: "sk", weight: 10 },
    { keyword: "lekár", locale: "sk", weight: 8 },
    { keyword: "doktor", locale: "sk", weight: 8 },
    { keyword: "gynekológ", locale: "sk", weight: 8 },
    { keyword: "clinic", locale: "en", weight: 10 },
    { keyword: "doctor", locale: "en", weight: 8 },
    { keyword: "ambulance", locale: "en", weight: 5 },
    { keyword: "clinica", locale: "it", weight: 10 },
    { keyword: "klinik", locale: "de", weight: 10 },
    { keyword: "klinika", locale: "hu", weight: 10 },
    { keyword: "clinică", locale: "ro", weight: 10 },
    { keyword: "ambulance", locale: "cs", weight: 10 },
    { keyword: "klinika", locale: "cs", weight: 10 },
  ],
  system: [
    { keyword: "dátum", locale: "sk", weight: 5 },
    { keyword: "dnes", locale: "sk", weight: 5 },
    { keyword: "date", locale: "en", weight: 5 },
    { keyword: "today", locale: "en", weight: 5 },
  ],
};

const VARIABLES_BY_BLOCK: Record<string, Omit<InsertVariable, "blockId">[]> = {
  customer: [
    { key: "customer.fullName", label: "Celé meno", labelEn: "Full Name", dataType: "text", example: "Jana Nováková", priority: 1 },
    { key: "customer.firstName", label: "Meno", labelEn: "First Name", dataType: "text", example: "Jana", priority: 2 },
    { key: "customer.lastName", label: "Priezvisko", labelEn: "Last Name", dataType: "text", example: "Nováková", priority: 3 },
    { key: "customer.birthDate", label: "Dátum narodenia", labelEn: "Birth Date", dataType: "date", example: "15.03.1990", priority: 4 },
    { key: "customer.personalId", label: "Rodné číslo", labelEn: "Personal ID", dataType: "text", example: "900315/1234", priority: 5 },
    { key: "customer.permanentAddress", label: "Trvalý pobyt", labelEn: "Permanent Address", dataType: "address", example: "Hlavná 123, 831 01 Bratislava", priority: 6 },
    { key: "customer.correspondenceAddress", label: "Korešpondenčná adresa", labelEn: "Correspondence Address", dataType: "address", example: "Hlavná 123, 831 01 Bratislava", priority: 7 },
    { key: "customer.email", label: "E-mail", labelEn: "Email", dataType: "email", example: "jana.novakova@email.sk", priority: 8 },
    { key: "customer.phone", label: "Telefón", labelEn: "Phone", dataType: "phone", example: "+421 900 123 456", priority: 9 },
    { key: "customer.IBAN", label: "IBAN", labelEn: "IBAN", dataType: "iban", example: "SK89 1100 0000 0012 3456 7890", priority: 10 },
    { key: "customer.nationality", label: "Štátna príslušnosť", labelEn: "Nationality", dataType: "text", example: "slovenská", priority: 11 },
    { key: "customer.idCardNumber", label: "Číslo OP", labelEn: "ID Card Number", dataType: "text", example: "EA123456", priority: 12 },
    { key: "customer.signature", label: "Podpis", labelEn: "Signature", dataType: "text", example: "[podpis]", priority: 13 },
    { key: "customer.signatureDate", label: "Dátum podpisu", labelEn: "Signature Date", dataType: "date", example: "01.01.2026", priority: 14 },
    { key: "customer.signaturePlace", label: "Miesto podpisu", labelEn: "Signature Place", dataType: "text", example: "Bratislava", priority: 15 },
  ],
  father: [
    { key: "father.fullName", label: "Celé meno otca", labelEn: "Father Full Name", dataType: "text", example: "Peter Novák", priority: 1 },
    { key: "father.firstName", label: "Meno otca", labelEn: "Father First Name", dataType: "text", example: "Peter", priority: 2 },
    { key: "father.lastName", label: "Priezvisko otca", labelEn: "Father Last Name", dataType: "text", example: "Novák", priority: 3 },
    { key: "father.birthDate", label: "Dátum narodenia otca", labelEn: "Father Birth Date", dataType: "date", example: "20.06.1988", priority: 4 },
    { key: "father.personalId", label: "Rodné číslo otca", labelEn: "Father Personal ID", dataType: "text", example: "880620/1234", priority: 5 },
    { key: "father.permanentAddress", label: "Trvalý pobyt otca", labelEn: "Father Permanent Address", dataType: "address", example: "Hlavná 123, 831 01 Bratislava", priority: 6 },
    { key: "father.email", label: "E-mail otca", labelEn: "Father Email", dataType: "email", example: "peter.novak@email.sk", priority: 7 },
    { key: "father.phone", label: "Telefón otca", labelEn: "Father Phone", dataType: "phone", example: "+421 901 234 567", priority: 8 },
    { key: "father.signature", label: "Podpis otca", labelEn: "Father Signature", dataType: "text", example: "[podpis]", priority: 9 },
    { key: "father.signatureDate", label: "Dátum podpisu otca", labelEn: "Father Signature Date", dataType: "date", example: "01.01.2026", priority: 10 },
  ],
  child: [
    { key: "child.fullName", label: "Meno dieťaťa", labelEn: "Child Full Name", dataType: "text", example: "Michal Novák", priority: 1 },
    { key: "child.firstName", label: "Meno dieťaťa", labelEn: "Child First Name", dataType: "text", example: "Michal", priority: 2 },
    { key: "child.lastName", label: "Priezvisko dieťaťa", labelEn: "Child Last Name", dataType: "text", example: "Novák", priority: 3 },
    { key: "child.birthDate", label: "Dátum narodenia dieťaťa", labelEn: "Child Birth Date", dataType: "date", example: "01.01.2026", priority: 4 },
    { key: "child.birthPlace", label: "Miesto narodenia", labelEn: "Birth Place", dataType: "text", example: "Bratislava", priority: 5 },
    { key: "child.personalId", label: "Rodné číslo dieťaťa", labelEn: "Child Personal ID", dataType: "text", example: "260101/1234", priority: 6 },
    { key: "child.gender", label: "Pohlavie", labelEn: "Gender", dataType: "text", example: "muž", priority: 7 },
  ],
  company: [
    { key: "company.name", label: "Názov spoločnosti", labelEn: "Company Name", dataType: "text", example: "Cord Blood Center AG", priority: 1 },
    { key: "company.address", label: "Sídlo spoločnosti", labelEn: "Company Address", dataType: "address", example: "Bodenhof 4, 6014 Luzern", priority: 2 },
    { key: "company.registrationNumber", label: "IČO", labelEn: "Registration Number", dataType: "text", example: "12345678", priority: 3 },
    { key: "company.taxId", label: "DIČ", labelEn: "Tax ID", dataType: "text", example: "2012345678", priority: 4 },
    { key: "company.vatNumber", label: "IČ DPH", labelEn: "VAT Number", dataType: "text", example: "SK2012345678", priority: 5 },
    { key: "company.IBAN", label: "IBAN spoločnosti", labelEn: "Company IBAN", dataType: "iban", example: "SK44 1111 0000 0013 8851 9013", priority: 6 },
    { key: "company.bankName", label: "Názov banky", labelEn: "Bank Name", dataType: "text", example: "Tatra banka", priority: 7 },
    { key: "company.phone", label: "Telefón spoločnosti", labelEn: "Company Phone", dataType: "phone", example: "+421 2 1234 5678", priority: 8 },
    { key: "company.email", label: "E-mail spoločnosti", labelEn: "Company Email", dataType: "email", example: "info@cordblood.sk", priority: 9 },
    { key: "company.representative", label: "Zástupca spoločnosti", labelEn: "Company Representative", dataType: "text", example: "Ján Šidlík, MBA", priority: 10 },
  ],
  contract: [
    { key: "contract.number", label: "Číslo zmluvy", labelEn: "Contract Number", dataType: "text", example: "ZML-2026-0001", priority: 1 },
    { key: "contract.date", label: "Dátum zmluvy", labelEn: "Contract Date", dataType: "date", example: "7. januára 2026", priority: 2 },
    { key: "contract.validFrom", label: "Platnosť od", labelEn: "Valid From", dataType: "date", example: "7.1.2026", priority: 3 },
    { key: "contract.validTo", label: "Platnosť do", labelEn: "Valid To", dataType: "date", example: "31.12.2046", priority: 4 },
    { key: "contract.totalAmount", label: "Celková suma", labelEn: "Total Amount", dataType: "number", example: "1 500,00 €", priority: 5 },
    { key: "contract.depositAmount", label: "Záloha", labelEn: "Deposit Amount", dataType: "number", example: "150,00 €", priority: 6 },
    { key: "contract.signaturePlace", label: "Miesto podpisu zmluvy", labelEn: "Contract Signature Place", dataType: "text", example: "Bratislava", priority: 7 },
  ],
  witness: [
    { key: "witness.fullName", label: "Meno svedka", labelEn: "Witness Full Name", dataType: "text", example: "Mária Horváthová", priority: 1 },
    { key: "witness.address", label: "Adresa svedka", labelEn: "Witness Address", dataType: "address", example: "Dlhá 45, 811 02 Bratislava", priority: 2 },
    { key: "witness.signature", label: "Podpis svedka", labelEn: "Witness Signature", dataType: "text", example: "[podpis]", priority: 3 },
  ],
  hospital: [
    { key: "hospital.name", label: "Názov nemocnice", labelEn: "Hospital Name", dataType: "text", example: "Univerzitná nemocnica Bratislava", priority: 1 },
    { key: "hospital.fullName", label: "Plný názov nemocnice", labelEn: "Hospital Full Name", dataType: "text", example: "Univerzitná nemocnica Bratislava - Petržalka", priority: 2 },
    { key: "hospital.streetNumber", label: "Ulica a číslo", labelEn: "Street & Number", dataType: "text", example: "Antolská 11", priority: 3 },
    { key: "hospital.city", label: "Mesto", labelEn: "City", dataType: "text", example: "Bratislava", priority: 4 },
    { key: "hospital.postalCode", label: "PSČ", labelEn: "Postal Code", dataType: "text", example: "851 07", priority: 5 },
    { key: "hospital.region", label: "Oblasť / Región", labelEn: "Region", dataType: "text", example: "Bratislavský kraj", priority: 6 },
    { key: "hospital.countryCode", label: "Kód krajiny", labelEn: "Country Code", dataType: "text", example: "SK", priority: 7 },
    { key: "hospital.contactPerson", label: "Kontaktná osoba", labelEn: "Contact Person", dataType: "text", example: "MUDr. Jana Nováková", priority: 8 },
    { key: "hospital.phone", label: "Telefón nemocnice", labelEn: "Hospital Phone", dataType: "phone", example: "+421 2 6867 1111", priority: 9 },
    { key: "hospital.email", label: "E-mail nemocnice", labelEn: "Hospital Email", dataType: "email", example: "info@unb.sk", priority: 10 },
    { key: "hospital.latitude", label: "GPS šírka", labelEn: "Latitude", dataType: "number", example: "48.1234567", priority: 11 },
    { key: "hospital.longitude", label: "GPS dĺžka", labelEn: "Longitude", dataType: "number", example: "17.1234567", priority: 12 },
  ],
  clinic: [
    { key: "clinic.name", label: "Názov ambulancie", labelEn: "Clinic Name", dataType: "text", example: "Gynekologická ambulancia MUDr. Kováčová", priority: 1 },
    { key: "clinic.doctorName", label: "Meno lekára", labelEn: "Doctor Name", dataType: "text", example: "MUDr. Kováčová", priority: 2 },
    { key: "clinic.doctorTitle", label: "Titul lekára", labelEn: "Doctor Title", dataType: "text", example: "MUDr.", priority: 3 },
    { key: "clinic.doctorFirstName", label: "Meno lekára (krstné)", labelEn: "Doctor First Name", dataType: "text", example: "Zuzana", priority: 4 },
    { key: "clinic.doctorLastName", label: "Priezvisko lekára", labelEn: "Doctor Last Name", dataType: "text", example: "Kováčová", priority: 5 },
    { key: "clinic.address", label: "Adresa ambulancie", labelEn: "Clinic Address", dataType: "address", example: "Odbojárov 3, 831 04 Bratislava", priority: 6 },
    { key: "clinic.city", label: "Mesto ambulancie", labelEn: "Clinic City", dataType: "text", example: "Bratislava", priority: 7 },
    { key: "clinic.postalCode", label: "PSČ ambulancie", labelEn: "Clinic Postal Code", dataType: "text", example: "831 04", priority: 8 },
    { key: "clinic.countryCode", label: "Kód krajiny", labelEn: "Country Code", dataType: "text", example: "SK", priority: 9 },
    { key: "clinic.phone", label: "Telefón ambulancie", labelEn: "Clinic Phone", dataType: "phone", example: "+421 2 1234 5678", priority: 10 },
    { key: "clinic.email", label: "E-mail ambulancie", labelEn: "Clinic Email", dataType: "email", example: "ambulancia@klinika.sk", priority: 11 },
    { key: "clinic.website", label: "Web stránka", labelEn: "Website", dataType: "text", example: "www.klinika.sk", priority: 12 },
    { key: "clinic.notes", label: "Poznámky", labelEn: "Notes", dataType: "text", example: "Spolupráca od 2024", priority: 13 },
    { key: "clinic.contractStatus", label: "Stav zmluvy", labelEn: "Contract Status", dataType: "text", example: "active", priority: 14 },
    { key: "clinic.lastCallResult", label: "Výsledok posledného hovoru", labelEn: "Last Call Result", dataType: "text", example: "Záujem o spoluprácu", priority: 15 },
    { key: "clinic.lastCallNote", label: "Poznámka k poslednému hovoru", labelEn: "Last Call Note", dataType: "text", example: "Dohodnúť stretnutie", priority: 16 },
    { key: "clinic.nextContactDate", label: "Dátum ďalšieho kontaktu", labelEn: "Next Contact Date", dataType: "date", example: "15.04.2026", priority: 17 },
    { key: "clinic.conferenceName", label: "Názov konferencie", labelEn: "Conference Name", dataType: "text", example: "Gynekologický kongres 2026", priority: 18 },
    { key: "clinic.latitude", label: "GPS šírka", labelEn: "Latitude", dataType: "number", example: "48.1234567", priority: 19 },
    { key: "clinic.longitude", label: "GPS dĺžka", labelEn: "Longitude", dataType: "number", example: "17.1234567", priority: 20 },
  ],
  payment: [
    { key: "payment.amount", label: "Suma platby", labelEn: "Payment Amount", dataType: "number", example: "150,00 €", priority: 1 },
    { key: "payment.dueDate", label: "Dátum splatnosti", labelEn: "Due Date", dataType: "date", example: "15.02.2026", priority: 2 },
    { key: "payment.variableSymbol", label: "Variabilný symbol", labelEn: "Variable Symbol", dataType: "text", example: "2026000001", priority: 3 },
    { key: "payment.IBAN", label: "IBAN pre platbu", labelEn: "Payment IBAN", dataType: "iban", example: "SK44 1111 0000 0013 8851 9013", priority: 4 },
  ],
  product: [
    { key: "product.name", label: "Názov produktu", labelEn: "Product Name", dataType: "text", example: "Štandard + tkanivo pupočníka", priority: 1 },
    { key: "product.price", label: "Cena produktu", labelEn: "Product Price", dataType: "number", example: "790,00 €", priority: 2 },
    { key: "product.description", label: "Popis produktu", labelEn: "Product Description", dataType: "text", example: "Odber a skladovanie pupočníkovej krvi", priority: 3 },
  ],
  collaborator: [
    { key: "collaborator.titleBefore", label: "Titul pred menom", labelEn: "Title Before", dataType: "text", example: "MUDr.", priority: 1 },
    { key: "collaborator.firstName", label: "Meno", labelEn: "First Name", dataType: "text", example: "Peter", priority: 2 },
    { key: "collaborator.lastName", label: "Priezvisko", labelEn: "Last Name", dataType: "text", example: "Horváth", priority: 3 },
    { key: "collaborator.titleAfter", label: "Titul za menom", labelEn: "Title After", dataType: "text", example: "PhD.", priority: 4 },
    { key: "collaborator.fullName", label: "Celé meno", labelEn: "Full Name", dataType: "text", example: "MUDr. Peter Horváth, PhD.", priority: 5 },
    { key: "collaborator.maidenName", label: "Rodné priezvisko", labelEn: "Maiden Name", dataType: "text", example: "Kováčová", priority: 6 },
    { key: "collaborator.birthNumber", label: "Rodné číslo", labelEn: "Birth Number", dataType: "text", example: "880620/1234", priority: 7 },
    { key: "collaborator.birthDay", label: "Deň narodenia", labelEn: "Birth Day", dataType: "number", example: "20", priority: 8 },
    { key: "collaborator.birthMonth", label: "Mesiac narodenia", labelEn: "Birth Month", dataType: "number", example: "6", priority: 9 },
    { key: "collaborator.birthYear", label: "Rok narodenia", labelEn: "Birth Year", dataType: "number", example: "1988", priority: 10 },
    { key: "collaborator.birthPlace", label: "Miesto narodenia", labelEn: "Birth Place", dataType: "text", example: "Bratislava", priority: 11 },
    { key: "collaborator.maritalStatus", label: "Rodinný stav", labelEn: "Marital Status", dataType: "text", example: "ženatý", priority: 12 },
    { key: "collaborator.collaboratorType", label: "Typ spolupracovníka", labelEn: "Collaborator Type", dataType: "text", example: "externý", priority: 13 },
    { key: "collaborator.phone", label: "Telefón", labelEn: "Phone", dataType: "phone", example: "+421 900 123 456", priority: 14 },
    { key: "collaborator.mobile", label: "Mobil", labelEn: "Mobile", dataType: "phone", example: "+421 900 123 456", priority: 15 },
    { key: "collaborator.mobile2", label: "Mobil 2", labelEn: "Mobile 2", dataType: "phone", example: "+421 901 234 567", priority: 16 },
    { key: "collaborator.email", label: "E-mail", labelEn: "Email", dataType: "email", example: "peter.horvath@email.sk", priority: 17 },
    { key: "collaborator.otherContact", label: "Iný kontakt", labelEn: "Other Contact", dataType: "text", example: "Skype: peter.horvath", priority: 18 },
    { key: "collaborator.bankAccountIban", label: "IBAN", labelEn: "IBAN", dataType: "iban", example: "SK89 1100 0000 0012 3456 7890", priority: 19 },
    { key: "collaborator.swiftCode", label: "SWIFT kód", labelEn: "SWIFT Code", dataType: "text", example: "TATRSKBX", priority: 20 },
    { key: "collaborator.companyName", label: "Názov firmy", labelEn: "Company Name", dataType: "text", example: "Horváth s.r.o.", priority: 21 },
    { key: "collaborator.ico", label: "IČO", labelEn: "Company ID", dataType: "text", example: "12345678", priority: 22 },
    { key: "collaborator.dic", label: "DIČ", labelEn: "Tax ID", dataType: "text", example: "2012345678", priority: 23 },
    { key: "collaborator.icDph", label: "IČ DPH", labelEn: "VAT Number", dataType: "text", example: "SK2012345678", priority: 24 },
    { key: "collaborator.companyIban", label: "IBAN firmy", labelEn: "Company IBAN", dataType: "iban", example: "SK44 1111 0000 0013 8851 9013", priority: 25 },
    { key: "collaborator.companySwift", label: "SWIFT firmy", labelEn: "Company SWIFT", dataType: "text", example: "TATRSKBX", priority: 26 },
    { key: "collaborator.countryCode", label: "Kód krajiny", labelEn: "Country Code", dataType: "text", example: "SK", priority: 27 },
    { key: "collaborator.note", label: "Poznámka", labelEn: "Note", dataType: "text", example: "Spolupracuje od 2020", priority: 28 },
    { key: "collaborator.rewardType", label: "Typ odmeny", labelEn: "Reward Type", dataType: "text", example: "fixed", priority: 29 },
    { key: "collaborator.fixedRewardAmount", label: "Fixná odmena", labelEn: "Fixed Reward Amount", dataType: "number", example: "50,00 €", priority: 30 },
    { key: "collaborator.fixedRewardCurrency", label: "Mena odmeny", labelEn: "Reward Currency", dataType: "text", example: "EUR", priority: 31 },
  ],
  system: [
    { key: "today", label: "Dnešný dátum", labelEn: "Today's Date", dataType: "date", example: "7. 1. 2026", priority: 1 },
    { key: "currentYear", label: "Aktuálny rok", labelEn: "Current Year", dataType: "text", example: "2026", priority: 2 },
  ],
};

export async function seedVariableRegistry(): Promise<void> {
  console.log("[Variable Registry] Starting seed...");
  
  const existingBlocks = await storage.getAllVariableBlocks();
  const blockIdMap: Record<string, string> = {};
  const existingBlockCodes = new Set<string>();

  for (const block of existingBlocks) {
    blockIdMap[block.code] = block.id;
    existingBlockCodes.add(block.code);
  }

  let createdBlocks = 0;
  for (const blockData of VARIABLE_BLOCKS) {
    if (!existingBlockCodes.has(blockData.code)) {
      const block = await storage.createVariableBlock(blockData);
      blockIdMap[blockData.code] = block.id;
      createdBlocks++;
      console.log(`[Variable Registry] Created block: ${blockData.code}`);
    }
  }

  if (existingBlocks.length === 0) {
    for (const [blockCode, keywords] of Object.entries(BLOCK_KEYWORDS)) {
      const blockId = blockIdMap[blockCode];
      if (!blockId) continue;
      for (const kw of keywords) {
        await storage.createVariableKeyword({ blockId, keyword: kw.keyword, locale: kw.locale, weight: kw.weight });
      }
      console.log(`[Variable Registry] Created ${keywords.length} keywords for block: ${blockCode}`);
    }
  } else if (createdBlocks > 0) {
    for (const [blockCode, keywords] of Object.entries(BLOCK_KEYWORDS)) {
      if (existingBlockCodes.has(blockCode)) continue;
      const blockId = blockIdMap[blockCode];
      if (!blockId) continue;
      for (const kw of keywords) {
        await storage.createVariableKeyword({ blockId, keyword: kw.keyword, locale: kw.locale, weight: kw.weight });
      }
      console.log(`[Variable Registry] Created ${keywords.length} keywords for new block: ${blockCode}`);
    }
  }

  const registry = await storage.getFullVariableRegistry();
  const existingVarKeys = new Set<string>();
  for (const block of registry.blocks || []) {
    for (const v of block.variables || []) {
      existingVarKeys.add(v.key);
    }
  }

  let createdVars = 0;
  for (const [blockCode, vars] of Object.entries(VARIABLES_BY_BLOCK)) {
    const blockId = blockIdMap[blockCode];
    if (!blockId) continue;

    for (const v of vars) {
      if (!existingVarKeys.has(v.key)) {
        await storage.createVariable({ ...v, blockId });
        createdVars++;
      }
    }
  }

  if (createdBlocks > 0 || createdVars > 0) {
    console.log(`[Variable Registry] Seed completed: ${createdBlocks} new blocks, ${createdVars} new variables added.`);
  } else {
    console.log("[Variable Registry] Registry up to date, no changes needed.");
  }
}
