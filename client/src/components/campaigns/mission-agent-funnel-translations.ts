import type { Locale } from "@/i18n/translations";

export interface MissionAgentFunnelTranslation {
  title: string;
  cohortLabel: string;
  contributionLabel: string;
  helpTitle: string;
  helpParagraphs: string[];
  clinicCount: string;
  agent: string;
  unknownAgent: string;
  stage: string;
  direct: string;
  inferred: string;
  total: string;
  missionShare: string;
  previous: string;
  qualified: string;
  selectAgent: string;
  selectStep: string;
  evidenceTitle: string;
  noEvidence: string;
  search: string;
  page: string;
  previousPage: string;
  nextPage: string;
  firstDate: string;
  evidenceDate: string;
  basis: string;
  inferredEvidence: string;
  directEvidence: string;
  noDate: string;
  allTime: string;
  referral: string;
  from: string;
  to: string;
  generated: string;
  timezone: string;
  exportCsv: string;
  exportXlsx: string;
  exportFailed: string;
  summarySheet: string;
  evidenceSheet: string;
  metadataSheet: string;
  clinicId: string;
  exportScope: string;
  cohortRateBasis: string;
  contributionRateBasis: string;
  selectedChart: string;
  sortAscending: string;
  sortDescending: string;
  mode: string;
  unknown: string;
  unmeasured: string;
  assignedExcluded: string;
  periodNote: string;
  proofAuthor: string;
  unknownProofAuthor: string;
  primaryPath: string;
  noContract: string;
  outcomes: string;
  noComparison: string;
  showing: string;
  of: string;
}

const en: MissionAgentFunnelTranslation = {
  title: "Agent comparison",
  cohortLabel: "Clinic cohort",
  contributionLabel: "Milestone evidence",
  helpTitle: "How to read this comparison",
  helpParagraphs: [
    "Clinic cohort groups each eligible clinic once by the first outbound caller. Stage results remain with that cohort even when another person later records evidence. Real and legacy-eligible attempts are included; uncertain caller identity stays under Unknown.",
    "Milestone evidence credits a clinic and stage only to the real author of the dated call or history that proves that exact milestone. State-only, inferred, current, derived, or ambiguous authors are not credited and remain Unknown. Later evidence does not transfer credit for earlier milestones.",
    "The selected period selects clinics by their first Mission outbound attempt; it does not restrict milestone events to dates within the period. Contribution events may occur before or after the selected dates. This is not a measure of activity performed during the period; use Agent Productivity for that.",
    "For a combined milestone, credit goes to the author who completed the confirmation. Simultaneous conflicting authors and duplicate-enrollment ties remain Unknown.",
    "Clinic count is distinct within each agent and is not the sum of stage totals. Direct and inferred counts describe evidence type. Percentages are shown only where measurable; zero is different from unmeasured. In cohort view, previous and qualified rates use the report's stage denominators. Mission share is the agent's share of the Mission stage total, not a conversion rate.",
    "Assigned is intentionally omitted: assignment to an institution representative is not agent attribution. The primary path, without-contract branch, and combined outcomes are separate paths. No weighted score, ranking, or quality judgement is calculated.",
  ],
  clinicCount: "Distinct clinics",
  agent: "Agent",
  unknownAgent: "Unknown caller / author",
  stage: "Milestone",
  direct: "Direct",
  inferred: "Inferred",
  total: "Clinics",
  missionShare: "Mission share",
  previous: "vs previous",
  qualified: "of qualified",
  selectAgent: "Select an agent",
  selectStep: "Select a milestone",
  evidenceTitle: "Clinic evidence",
  noEvidence: "No clinic evidence is available for this selection.",
  search: "Search clinics",
  page: "Page",
  previousPage: "Previous",
  nextPage: "Next",
  firstDate: "First date",
  evidenceDate: "Evidence date",
  basis: "Basis",
  inferredEvidence: "Inferred",
  directEvidence: "Direct",
  noDate: "Not recorded",
  allTime: "All time",
  referral: "Referral",
  from: "From",
  to: "To",
  generated: "Generated",
  timezone: "Timezone",
  exportCsv: "Download CSV",
  exportXlsx: "Download Excel",
  exportFailed: "The comparison could not be exported. Please try again.",
  summarySheet: "Agent comparison",
  evidenceSheet: "Clinic evidence",
  metadataSheet: "Filters and definitions",
  clinicId: "Clinic ID",
  exportScope: "All agents and evidence in this report view are exported; table search and selection do not restrict the export.",
  cohortRateBasis: "Share of this agent's called clinic cohort",
  contributionRateBasis: "Share of the Mission stage total",
  selectedChart: "Selected agent funnel",
  sortAscending: "Sort ascending",
  sortDescending: "Sort descending",
  mode: "View",
  unknown: "Unknown",
  unmeasured: "Unmeasured",
  assignedExcluded: "Institution representative assignment is not agent attribution and is excluded.",
  periodNote: "The selected period selects clinics by their first Mission outbound attempt. Milestone events can be before or after the period; this is not activity performed during these dates. See Agent Productivity for activity during a period.",
  proofAuthor: "Proof author",
  unknownProofAuthor: "Unknown author",
  primaryPath: "Primary path",
  noContract: "Without contract",
  outcomes: "Combined outcomes",
  noComparison: "Agent comparison is not available for this report.",
  showing: "Showing",
  of: "of",
};

const translations: Record<Locale, MissionAgentFunnelTranslation> = {
  en,
  sk: {
    title: "Porovnanie agentov", cohortLabel: "Kohorta kliník", contributionLabel: "Dôkazy míľnikov",
    helpTitle: "Ako čítať porovnanie", helpParagraphs: [
      "Každá oprávnená klinika je v kohortovom pohľade zaradená raz podľa prvého odchádzajúceho volajúceho. Výsledky míľnikov zostávajú v tejto kohorte aj vtedy, keď dôkaz neskôr zaznamená iná osoba. Zahrnuté sú skutočné aj oprávnené staršie pokusy; neistá identita volajúceho patrí medzi neznámych.",
      "Pohľad dôkazov míľnikov pripisuje kliniku a míľnik iba skutočnému autorovi datovaného hovoru alebo histórie, ktorá dokazuje presne daný míľnik. Dôkazy iba zo stavu, odvodené, aktuálne alebo s nejednoznačným autorom sa nepripisujú agentovi a zostávajú medzi neznámymi. Neskorší dôkaz nemení autora skorších míľnikov.",
      "Vybrané obdobie vyberá kliniky podľa prvého odchádzajúceho pokusu Mission; neobmedzuje míľniky na dátumy v období. Udalosti príspevku môžu byť pred alebo po vybraných dátumoch. Nejde o aktivitu vykonanú v tomto období; na tú slúži Produktivita agentov.",
      "Pri kombinovanom míľniku získava kredit autor, ktorý dokončil potvrdenie. Súčasné konfliktné autorstvá a zhody pri duplicitnom zápise zostávajú neznáme.",
      "Počet kliník je jedinečný pre každého agenta a nie je súčtom míľnikov. Priamy a odvodený počet označuje typ dôkazu. Percentá sa zobrazia iba pri merateľných údajoch; nula sa líši od nemerateľného údaja. V kohortovom pohľade používajú miery predchádzajúceho kroku a kvalifikovaných kliník menovatele reportu. Podiel na misii je podiel agenta z celkového počtu daného kroku, nie miera konverzie.",
      "Priradenie zástupcovi kliniky je zámerne vynechané: nejde o pripísanie agentovi. Hlavná cesta, vetva bez zmluvy a kombinované výsledky sú samostatné cesty. Nevypočítava sa vážené skóre, poradie ani hodnotenie kvality.",
    ],
    clinicCount: "Jedinečné kliniky", agent: "Agent", unknownAgent: "Neznámy volajúci / autor", stage: "Míľnik",
    direct: "Priame", inferred: "Odvodené", total: "Kliniky", missionShare: "Podiel na misii", previous: "z predchádzajúceho", qualified: "z kvalifikovaných",
    selectAgent: "Vyberte agenta", selectStep: "Vyberte míľnik", evidenceTitle: "Dôkazy kliník", noEvidence: "Pre tento výber nie sú dostupné dôkazy kliník.",
    search: "Hľadať kliniky", page: "Strana", previousPage: "Predchádzajúca", nextPage: "Ďalšia", firstDate: "Prvý dátum", evidenceDate: "Dátum dôkazu",
    basis: "Základ", inferredEvidence: "Odvodený", directEvidence: "Priamy", noDate: "Nezaznamenané", allTime: "Celé obdobie",
    referral: "Odporúčanie", from: "Od", to: "Do", generated: "Vygenerované", timezone: "Časové pásmo", exportCsv: "Stiahnuť CSV", exportXlsx: "Stiahnuť Excel",
    exportFailed: "Porovnanie sa nepodarilo exportovať. Skúste to znova.", summarySheet: "Porovnanie agentov", evidenceSheet: "Dôkazy kliník", metadataSheet: "Filtre a definície",
    clinicId: "ID kliniky", exportScope: "Export zahŕňa všetkých agentov a dôkazy v tomto zobrazení reportu; vyhľadávanie a výber tabuľky export neobmedzujú.",
    cohortRateBasis: "Podiel z volanej kohorty kliník agenta", contributionRateBasis: "Podiel z celkového počtu v kroku Mission",
    selectedChart: "Lievik vybraného agenta", sortAscending: "Zoradiť vzostupne", sortDescending: "Zoradiť zostupne", mode: "Zobrazenie", unknown: "Neznámy", unmeasured: "Nemerané",
    assignedExcluded: "Priradenie zástupcovi kliniky nie je pripísanie agentovi a je vynechané.", periodNote: "Obdobie vyberá kliniky podľa prvého odchádzajúceho pokusu Mission. Udalosti míľnikov môžu byť pred alebo po období; nejde o aktivitu vykonanú v tomto období. Aktivitu za obdobie sleduje Produktivita agentov.",
    proofAuthor: "Autor dôkazu", unknownProofAuthor: "Neznámy autor", primaryPath: "Hlavná cesta", noContract: "Bez zmluvy",
    outcomes: "Kombinované výsledky", noComparison: "Porovnanie agentov nie je pre tento report dostupné.", showing: "Zobrazené", of: "z",
  },
  cs: {
    title: "Porovnání agentů", cohortLabel: "Kohorta klinik", contributionLabel: "Důkazy milníků",
    helpTitle: "Jak číst toto porovnání", helpParagraphs: [
      "V kohortním zobrazení je každá způsobilá klinika zařazena právě jednou podle prvního odchozího volajícího. Výsledky milníků zůstávají v této kohortě, i když důkaz později zaznamená někdo jiný. Zahrnuty jsou skutečné i způsobilé starší pokusy; nejistá identita volajícího zůstává mezi neznámými.",
      "Zobrazení důkazů milníků připisuje kliniku a milník pouze skutečnému autorovi datovaného hovoru nebo historie, která prokazuje přesně daný milník. Důkazy pouze ze stavu, odvozené, aktuální nebo s nejednoznačným autorem nejsou agentovi připsány a zůstávají mezi neznámými. Pozdější důkaz nepřenáší zásluhu za dřívější milníky.",
      "Vybrané období vybírá kliniky podle prvního odchozího pokusu Mission; neomezuje milníky na data v období. Události příspěvku mohou být před vybranými daty i po nich. Nejde o aktivitu provedenou během období; tu sleduje Produktivita agentů.",
      "U kombinovaného milníku získává zásluhu autor, který dokončil potvrzení. Současné rozporné autorství a shody při duplicitním zápisu zůstávají neznámé.",
      "Počet klinik je u každého agenta jedinečný a není součtem milníků. Přímý a odvozený počet popisuje typ důkazu. Procenta se zobrazí jen u měřitelných údajů; nula se liší od neměřeného údaje. V kohortním zobrazení používají míry předchozího kroku a kvalifikovaných klinik jmenovatele reportu. Podíl na misi je podíl agenta na celkovém počtu daného kroku, nikoli míra konverze.",
       "Přiřazení zástupci kliniky je záměrně vynecháno: nejde o přiřazení agentovi. Hlavní cesta, větev bez smlouvy a kombinované výsledky jsou samostatné cesty. Nevypočítává se vážené skóre, pořadí ani hodnocení kvality.",
    ],
    clinicCount: "Jedinečné kliniky", agent: "Agent", unknownAgent: "Neznámý volající / autor", stage: "Milník", direct: "Přímé", inferred: "Odvozené",
    total: "Kliniky", missionShare: "Podíl na misi", previous: "z předchozího", qualified: "z kvalifikovaných", selectAgent: "Vyberte agenta", selectStep: "Vyberte milník",
    evidenceTitle: "Důkazy klinik", noEvidence: "Pro tento výběr nejsou dostupné žádné důkazy klinik.", search: "Hledat kliniky", page: "Strana", previousPage: "Předchozí",
    nextPage: "Další", firstDate: "První datum", evidenceDate: "Datum důkazu", basis: "Základ", inferredEvidence: "Odvozený", directEvidence: "Přímý",
    noDate: "Nezaznamenáno", allTime: "Celé období", referral: "Doporučení", from: "Od", to: "Do", generated: "Vygenerováno", timezone: "Časové pásmo",
    exportCsv: "Stáhnout CSV", exportXlsx: "Stáhnout Excel", exportFailed: "Porovnání se nepodařilo exportovat. Zkuste to znovu.",
    summarySheet: "Porovnání agentů", evidenceSheet: "Důkazy klinik", metadataSheet: "Filtry a definice", clinicId: "ID kliniky",
    exportScope: "Export zahrnuje všechny agenty a důkazy v tomto zobrazení reportu; vyhledávání a výběr tabulky export neomezují.",
    cohortRateBasis: "Podíl z volané kohorty klinik agenta", contributionRateBasis: "Podíl z celkového počtu v kroku Mission",
    selectedChart: "Trychtýř vybraného agenta", sortAscending: "Řadit vzestupně", sortDescending: "Řadit sestupně", mode: "Zobrazení",
    unknown: "Neznámý", unmeasured: "Neměřeno", assignedExcluded: "Přiřazení zástupci kliniky není přiřazení agentovi a je vynecháno.",
    periodNote: "Období vybírá kliniky podle prvního odchozího pokusu Mission. Události milníků mohou nastat před obdobím i po něm; nejde o aktivitu během období. Tu sleduje Produktivita agentů.",
    proofAuthor: "Autor důkazu", unknownProofAuthor: "Neznámý autor",
    primaryPath: "Hlavní cesta", noContract: "Bez smlouvy", outcomes: "Kombinované výsledky", noComparison: "Porovnání agentů není pro tento report dostupné.",
    showing: "Zobrazeno", of: "z",
  },
  hu: {
    title: "Ügynökök összehasonlítása", cohortLabel: "Klinikakohorsz", contributionLabel: "Mérföldkő-bizonyítékok",
    helpTitle: "Az összehasonlítás értelmezése", helpParagraphs: [
      "A kohorsznézet minden jogosult klinikát egyszer sorol be az első kimenő hívó alapján. A mérföldkövek eredményei ebben a kohorszban maradnak akkor is, ha később más rögzíti a bizonyítékot. A valódi és a jogosult régi próbálkozások is szerepelnek; a bizonytalan hívóazonosság az Ismeretlen csoportba kerül.",
      "A mérföldkő-bizonyíték nézet egy klinikát és mérföldkövet kizárólag az adott mérföldkövet igazoló, dátummal ellátott hívás vagy előzmény valódi szerzőjének tulajdonít. Az állapotból származó, kikövetkeztetett, aktuális vagy kétértelmű szerzőjű bizonyíték nem írható jóvá, az Ismeretlen csoportban marad. A későbbi bizonyíték nem írja át a korábbi mérföldkövek szerzőjét.",
      "A kiválasztott időszak az első Mission kimenő próbálkozás alapján választja ki a klinikákat; a mérföldkő-eseményeket nem korlátozza erre az időszakra. A hozzájárulási események a dátumok előtt vagy után is történhetnek. Ez nem az időszak alatti aktivitás mérése; arra az Ügynöki produktivitás szolgál.",
      "Összetett mérföldkőnél a megerősítést befejező szerző kapja a jóváírást. Az egyidejű, ellentmondó szerzők és a duplikált felvételek holtversenye Ismeretlen marad.",
      "A klinikaszám ügynökönként egyedi, nem a mérföldkövek összege. A közvetlen és kikövetkeztetett szám a bizonyíték típusát mutatja. Százalék csak mérhető adatnál jelenik meg; a nulla nem azonos a nem mérttel. A kohorsznézet előző és minősített arányai a jelentés nevezőit használják. A missziórészesedés az ügynök része az adott missziólépés összeséből, nem konverziós arány.",
       "A klinika képviselőjének hozzárendelése szándékosan kimarad: nem ügynökhöz rendelés. A fő útvonal, a szerződés nélküli ág és az összevont eredmények külön útvonalak. Súlyozott pontszám, rangsor vagy minőségi értékelés nem készül.",
    ],
    clinicCount: "Egyedi klinikák", agent: "Ügynök", unknownAgent: "Ismeretlen hívó / szerző", stage: "Mérföldkő", direct: "Közvetlen", inferred: "Kikövetkeztetett",
    total: "Klinikák", missionShare: "Misszió részesedése", previous: "előzőhöz képest", qualified: "minősítettekből", selectAgent: "Ügynök kiválasztása", selectStep: "Mérföldkő kiválasztása",
    evidenceTitle: "Klinikabizonyíték", noEvidence: "Ehhez a kiválasztáshoz nincs klinikabizonyíték.", search: "Klinikák keresése", page: "Oldal",
    previousPage: "Előző", nextPage: "Következő", firstDate: "Első dátum", evidenceDate: "Bizonyíték dátuma", basis: "Alap", inferredEvidence: "Kikövetkeztetett",
    directEvidence: "Közvetlen", noDate: "Nincs rögzítve", allTime: "Teljes időszak", referral: "Ajánlás", from: "Ettől", to: "Eddig",
    generated: "Létrehozva", timezone: "Időzóna", exportCsv: "CSV letöltése", exportXlsx: "Excel letöltése",
    exportFailed: "Az összehasonlítás exportálása nem sikerült. Próbálja újra.", summarySheet: "Ügynökök összehasonlítása", evidenceSheet: "Klinikabizonyíték",
    metadataSheet: "Szűrők és definíciók", clinicId: "Klinikaazonosító",
    exportScope: "Az export a jelentésnézet összes ügynökét és bizonyítékát tartalmazza; a táblázat keresése és kijelölése nem szűkíti az exportot.",
    cohortRateBasis: "Az ügynök felhívott klinikáinak kohorszából", contributionRateBasis: "A Mission mérföldkő összeséből",
    selectedChart: "Kiválasztott ügynök tölcsére", sortAscending: "Rendezés növekvő sorrendbe", sortDescending: "Rendezés csökkenő sorrendbe",
    mode: "Nézet", unknown: "Ismeretlen", unmeasured: "Nem mért",
    assignedExcluded: "A klinika képviselőjének hozzárendelése nem ügynökhöz rendelés, ezért kimarad.",
    periodNote: "Az időszak az első Mission kimenő próbálkozás alapján választja ki a klinikákat. A mérföldkő-események az időszak előtt vagy után is történhetnek; ez nem az időszak alatti aktivitás. Az Ügynöki produktivitás mutatja az időszaki aktivitást.",
    proofAuthor: "Bizonyíték szerzője", unknownProofAuthor: "Ismeretlen szerző", primaryPath: "Fő útvonal", noContract: "Szerződés nélkül",
    outcomes: "Összevont eredmények", noComparison: "Ehhez a jelentéshez nem érhető el ügynök-összehasonlítás.", showing: "Megjelenítve", of: "ebből",
  },
  ro: {
    title: "Comparația agenților", cohortLabel: "Cohorta clinicilor", contributionLabel: "Dovezi pentru etape",
    helpTitle: "Cum se citește comparația", helpParagraphs: [
      "În vizualizarea cohortei, fiecare clinică eligibilă este inclusă o singură dată, după primul apelant care a efectuat un apel de ieșire. Rezultatele etapelor rămân în cohortă chiar dacă o altă persoană înregistrează ulterior dovada. Sunt incluse încercările reale și cele istorice eligibile; identitatea incertă a apelantului rămâne la Necunoscut.",
      "Vizualizarea dovezilor atribuie clinica și etapa numai autorului real al apelului sau istoricului datat care dovedește exact etapa respectivă. Dovezile bazate doar pe stare, deduse, curente sau cu autor ambiguu nu sunt atribuite și rămân la Necunoscut. Dovezile ulterioare nu transferă creditul pentru etapele anterioare.",
      "Perioada selectată include clinicile după prima încercare de apel de ieșire Mission; nu limitează etapele la evenimente din interval. Evenimentele de contribuție pot avea loc înainte sau după datele selectate. Acesta nu este un raport al activității efectuate în interval; pentru aceasta folosiți Productivitatea agenților.",
      "Pentru o etapă combinată, creditul revine autorului care a finalizat confirmarea. Autorii conflictuali simultani și egalitățile din înscrieri duplicate rămân Necunoscut.",
      "Numărul clinicilor este distinct pentru fiecare agent și nu reprezintă suma etapelor. Numerele directe și deduse descriu tipul dovezii. Procentele apar numai când datele sunt măsurabile; zero diferă de nemăsurat. În vizualizarea cohortei, ratele față de etapa anterioară și față de clinicile calificate folosesc numitorii raportului. Ponderea în misiune este partea agentului din totalul etapei, nu o rată de conversie.",
      "Atribuirea reprezentantului clinicii este omisă intenționat: nu reprezintă atribuirea către un agent. Traseul principal, ramura fără contract și rezultatele combinate sunt trasee separate. Nu se calculează scor ponderat, clasament sau evaluare a calității.",
    ],
    clinicCount: "Clinici distincte", agent: "Agent", unknownAgent: "Apelant / autor necunoscut", stage: "Etapă", direct: "Direct", inferred: "Dedus",
    total: "Clinici", missionShare: "Pondere în misiune", previous: "față de etapa anterioară", qualified: "din cele calificate", selectAgent: "Selectați un agent",
    selectStep: "Selectați o etapă", evidenceTitle: "Dovezi pentru clinici", noEvidence: "Nu există dovezi pentru clinici în această selecție.", search: "Caută clinici",
    page: "Pagina", previousPage: "Anterior", nextPage: "Următor", firstDate: "Prima dată", evidenceDate: "Data dovezii", basis: "Bază",
    inferredEvidence: "Deducție", directEvidence: "Direct", noDate: "Neînregistrat", allTime: "Toată perioada", referral: "Recomandare", from: "De la",
    to: "Până la", generated: "Generat", timezone: "Fus orar", exportCsv: "Descarcă CSV", exportXlsx: "Descarcă Excel",
    summarySheet: "Comparația agenților", metadataSheet: "Filtre și definiții", mode: "Vizualizare", unknown: "Necunoscut", unmeasured: "Nemăsurat",
    assignedExcluded: "Atribuirea reprezentantului clinicii nu reprezintă atribuirea agentului și este exclusă.",
    periodNote: "Perioada selectată include clinicile după prima încercare de apel de ieșire Mission. Evenimentele etapelor pot fi înainte sau după interval; activitatea din interval este raportată de Productivitatea agenților.",
    proofAuthor: "Autorul dovezii", unknownProofAuthor: "Autor necunoscut", primaryPath: "Traseu principal",
    noContract: "Fără contract", outcomes: "Rezultate combinate", noComparison: "Comparația agenților nu este disponibilă pentru acest raport.",
    exportFailed: "Comparația nu a putut fi exportată. Încercați din nou.", evidenceSheet: "Dovezi clinice", clinicId: "ID clinică",
    exportScope: "Exportul include toți agenții și toate dovezile din această vizualizare; căutarea și selecția din tabel nu îl restrâng.",
    cohortRateBasis: "Procent din cohorta de clinici apelate a agentului", contributionRateBasis: "Procent din totalul etapei Mission",
    selectedChart: "Pâlnia agentului selectat", sortAscending: "Sortare crescătoare", sortDescending: "Sortare descrescătoare",
    showing: "Se afișează", of: "din",
  },
  it: {
    title: "Confronto agenti", cohortLabel: "Coorte cliniche", contributionLabel: "Prove delle tappe",
    helpTitle: "Come leggere il confronto", helpParagraphs: [
      "Nella vista coorte, ogni clinica idonea è assegnata una sola volta in base al primo chiamante in uscita. I risultati delle tappe restano nella coorte anche se in seguito la prova viene registrata da un'altra persona. Sono inclusi i tentativi reali e quelli legacy idonei; l'identità incerta resta in Sconosciuto.",
      "La vista delle prove attribuisce una clinica e una tappa solo all'autore reale della chiamata o della cronologia datata che dimostra quella specifica tappa. Le prove basate solo sullo stato, inferite, correnti o con autore ambiguo non vengono attribuite e restano in Sconosciuto. Una prova successiva non trasferisce il merito delle tappe precedenti.",
      "Il periodo selezionato individua le cliniche in base al primo tentativo di chiamata Mission in uscita; non limita gli eventi delle tappe alle date selezionate. Gli eventi di contributo possono avvenire prima o dopo il periodo. Non misura l'attività svolta nel periodo; per quella usare Produttività agenti.",
      "Per una tappa combinata, il merito va all'autore che ha completato la conferma. Autori simultanei in conflitto e parità dovute a iscrizioni duplicate restano Sconosciuto.",
      "Il numero di cliniche è distinto per agente e non è la somma delle tappe. I conteggi diretti e inferiti descrivono il tipo di prova. Le percentuali sono mostrate solo quando misurabili; zero è diverso da non misurato. Nella vista coorte, i tassi rispetto alla tappa precedente e alle cliniche qualificate usano i denominatori del report. La quota Mission è la parte dell'agente sul totale della tappa Mission, non un tasso di conversione.",
      "L'assegnazione al rappresentante della clinica è intenzionalmente esclusa: non equivale all'attribuzione a un agente. Percorso principale, ramo senza contratto e risultati combinati sono percorsi separati. Non vengono calcolati punteggi ponderati, classifiche o giudizi di qualità.",
    ],
    clinicCount: "Cliniche distinte", agent: "Agente", unknownAgent: "Chiamante / autore sconosciuto", stage: "Tappa", direct: "Diretto", inferred: "Inferito",
    total: "Cliniche", missionShare: "Quota Mission", previous: "rispetto alla precedente", qualified: "delle qualificate", selectAgent: "Seleziona un agente",
    selectStep: "Seleziona una tappa", evidenceTitle: "Prove delle cliniche", noEvidence: "Nessuna prova clinica disponibile per questa selezione.", search: "Cerca cliniche",
    page: "Pagina", previousPage: "Precedente", nextPage: "Successiva", firstDate: "Prima data", evidenceDate: "Data della prova", basis: "Base",
    inferredEvidence: "Inferita", directEvidence: "Diretta", noDate: "Non registrata", allTime: "Tutto il periodo", referral: "Referral", from: "Da", to: "A",
    generated: "Generato", timezone: "Fuso orario", exportCsv: "Scarica CSV", exportXlsx: "Scarica Excel", summarySheet: "Confronto agenti",
    exportFailed: "Impossibile esportare il confronto. Riprova.", evidenceSheet: "Prove delle cliniche", clinicId: "ID clinica",
    exportScope: "L'esportazione include tutti gli agenti e le prove di questa vista del report; ricerca e selezione non la limitano.",
    cohortRateBasis: "Quota della coorte di cliniche chiamate dell'agente", contributionRateBasis: "Quota del totale della tappa Mission",
    selectedChart: "Funnel dell'agente selezionato", sortAscending: "Ordina in modo crescente", sortDescending: "Ordina in modo decrescente",
    metadataSheet: "Filtri e definizioni", mode: "Vista", unknown: "Sconosciuto", unmeasured: "Non misurato",
    assignedExcluded: "L'assegnazione del rappresentante della clinica non è attribuzione a un agente ed è esclusa.",
    periodNote: "Il periodo seleziona le cliniche in base al primo tentativo di chiamata Mission in uscita. Gli eventi delle tappe possono precedere o seguire il periodo; l'attività svolta nel periodo è in Produttività agenti.",
    proofAuthor: "Autore della prova", unknownProofAuthor: "Autore sconosciuto", primaryPath: "Percorso principale",
    noContract: "Senza contratto", outcomes: "Risultati combinati", noComparison: "Il confronto agenti non è disponibile per questo report.",
    showing: "Visualizzate", of: "di",
  },
  de: {
    title: "Agentenvergleich", cohortLabel: "Klinik-Kohorte", contributionLabel: "Meilenstein-Nachweise",
    helpTitle: "So lesen Sie den Vergleich", helpParagraphs: [
      "In der Kohortenansicht wird jede geeignete Klinik genau einmal anhand des ersten ausgehenden Anrufers gruppiert. Meilensteinergebnisse bleiben in dieser Kohorte, auch wenn eine andere Person den Nachweis später erfasst. Echte und geeignete ältere Versuche werden berücksichtigt; eine unsichere Anruferidentität bleibt unter Unbekannt.",
      "Die Nachweisansicht ordnet eine Klinik und einen Meilenstein ausschließlich dem tatsächlichen Verfasser des datierten Anrufs oder Verlaufs zu, der genau diesen Meilenstein belegt. Nur statusbasierte, abgeleitete, aktuelle oder mehrdeutige Nachweise werden keinem Agenten gutgeschrieben und bleiben unter Unbekannt. Spätere Nachweise ändern die Zuordnung früherer Meilensteine nicht.",
      "Der gewählte Zeitraum wählt Kliniken anhand des ersten ausgehenden Mission-Anrufversuchs aus; Meilensteinereignisse werden nicht auf diesen Zeitraum begrenzt. Beitragsereignisse können vor oder nach den gewählten Daten liegen. Dies misst keine Aktivität innerhalb des Zeitraums; dafür dient Agent Productivity.",
      "Bei einem kombinierten Meilenstein wird der Autor gutgeschrieben, der die Bestätigung abgeschlossen hat. Gleichzeitige widersprüchliche Autoren und Gleichstände bei doppelten Einschreibungen bleiben Unbekannt.",
      "Die Klinikanzahl ist je Agent eindeutig und nicht die Summe der Meilensteine. Direkte und abgeleitete Zahlen beschreiben die Art des Nachweises. Prozentwerte erscheinen nur bei messbaren Daten; null ist nicht dasselbe wie nicht gemessen. In der Kohortenansicht verwenden die Quoten gegenüber dem vorherigen Schritt und den qualifizierten Kliniken die Nenner des Berichts. Der Missionsanteil ist der Anteil des Agenten an der Gesamtzahl des Missionsschritts, keine Konversionsrate.",
      "Die Zuweisung des Klinikvertreters wird bewusst ausgelassen: Sie ist keine Agentenzuordnung. Hauptpfad, Zweig ohne Vertrag und kombinierte Ergebnisse sind getrennte Pfade. Es werden weder gewichtete Punktzahlen noch Ranglisten oder Qualitätsurteile berechnet.",
    ],
    clinicCount: "Eindeutige Kliniken", agent: "Agent", unknownAgent: "Unbekannter Anrufer / Verfasser", stage: "Meilenstein", direct: "Direkt", inferred: "Abgeleitet",
    total: "Kliniken", missionShare: "Missionsanteil", previous: "zum vorherigen Schritt", qualified: "der qualifizierten", selectAgent: "Agent auswählen",
    selectStep: "Meilenstein auswählen", evidenceTitle: "Kliniknachweise", noEvidence: "Für diese Auswahl sind keine Kliniknachweise verfügbar.", search: "Kliniken suchen",
    page: "Seite", previousPage: "Zurück", nextPage: "Weiter", firstDate: "Erstes Datum", evidenceDate: "Nachweisdatum", basis: "Grundlage",
    inferredEvidence: "Abgeleitet", directEvidence: "Direkt", noDate: "Nicht erfasst", allTime: "Gesamter Zeitraum", referral: "Empfehlung", from: "Von", to: "Bis",
    generated: "Erstellt", timezone: "Zeitzone", exportCsv: "CSV herunterladen", exportXlsx: "Excel herunterladen", summarySheet: "Agentenvergleich",
    exportFailed: "Der Vergleich konnte nicht exportiert werden. Bitte versuchen Sie es erneut.", evidenceSheet: "Kliniknachweise", clinicId: "Klinik-ID",
    exportScope: "Der Export enthält alle Agenten und Nachweise dieser Berichtsansicht; Suche und Auswahl schränken den Export nicht ein.",
    cohortRateBasis: "Anteil an der angerufenen Klinikkohorte des Agenten", contributionRateBasis: "Anteil an der Gesamtzahl des Missionsschritts",
    selectedChart: "Trichter des ausgewählten Agenten", sortAscending: "Aufsteigend sortieren", sortDescending: "Absteigend sortieren",
    metadataSheet: "Filter und Definitionen", mode: "Ansicht", unknown: "Unbekannt", unmeasured: "Nicht gemessen",
    assignedExcluded: "Die Zuweisung des Klinikvertreters ist keine Agentenzuordnung und wird ausgeschlossen.",
    periodNote: "Der Zeitraum wählt Kliniken anhand des ersten ausgehenden Mission-Anrufversuchs aus. Meilensteinereignisse können davor oder danach liegen; Aktivität innerhalb des Zeitraums zeigt Agent Productivity.",
    proofAuthor: "Nachweisautor", unknownProofAuthor: "Unbekannter Autor", primaryPath: "Hauptpfad",
    noContract: "Ohne Vertrag", outcomes: "Kombinierte Ergebnisse", noComparison: "Für diesen Bericht ist kein Agentenvergleich verfügbar.",
    showing: "Angezeigt", of: "von",
  },
};

export const agentFunnelTranslations = translations;
