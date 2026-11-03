import type { FunnelException, FunnelSource, FunnelStep } from "../../../../shared/mission-funnel";
import type { Locale } from "@/i18n/translations";
import { exportScopeTranslations } from "./export-scope-translations";
import { agentFunnelTranslations } from "./mission-agent-funnel-translations";
import { missionFunnelTranslations } from "@/i18n/mission-funnel-translations";
import { cooperationRuleCopy, standaloneCooperationCopy, optionalPosterCopy } from "./mission-material-package-copy";

export const missionFunnelHelpChapterIds = [
  "scope", "contact-contract", "without-contract", "combined", "evidence", "exceptions-quality", "configuration", "sources", "interpret-export", "agents",
] as const;
export type MissionFunnelHelpChapter = typeof missionFunnelHelpChapterIds[number];
export const missionFunnelQualityKeys = ["clinics", "cohort", "withoutAttempt", "provisional", "orphanCalls", "duplicateEnrollments", "stateOnly", "unknownProposal"] as const;
export type MissionFunnelQualityKey = typeof missionFunnelQualityKeys[number];
export type MissionFunnelEvidenceBasis = "call" | "history" | "state" | "derived" | "current";
type MissionFunnelHelpStep = FunnelStep | "packageSent";

export interface MissionFunnelHelpLocale {
  title: string;
  intro: string;
  close: string;
  button: string;
  contents: string;
  previous: string;
  next: string;
  chapters: Record<MissionFunnelHelpChapter, string>;
  content: Record<MissionFunnelHelpChapter, string[]>;
  stages: Record<MissionFunnelHelpStep, string>;
  sources: Record<FunnelSource, string>;
  exceptions: Record<FunnelException, string>;
  quality: Record<MissionFunnelQualityKey, string>;
  basis: Record<MissionFunnelEvidenceBasis, string>;
}
type HelpDraft = Omit<MissionFunnelHelpLocale, "quality" | "basis" | "button" | "contents" | "previous" | "next" | "chapters" | "content">
  & { chapters: Omit<MissionFunnelHelpLocale["chapters"], "without-contract" | "agents">; content: Omit<MissionFunnelHelpLocale["content"], "without-contract" | "agents"> };

const en: HelpDraft = {
  title: "INDEXUS Mission funnel · field guide",
  intro: "A practical guide to what each clinic count means, which evidence qualifies, and how to read the branches safely.",
  close: "Close manual",
  chapters: {
    scope: "Scope & cohort", "contact-contract": "Contact and contract path", combined: "Combined outcomes",
    evidence: "Clinic evidence", "exceptions-quality": "Exceptions & quality", configuration: "Configure evidence",
    sources: "All mapping sources", "interpret-export": "Read & export the funnel",
  },
  content: {
    scope: [
      "The report counts distinct Mission clinic entities once at each step. It does not count enrollment rows, contacts, or calls. A clinic with duplicate enrollments is still one clinic in a step; those extra rows are separately visible in data quality.",
      "Your access is limited to the countries permitted for your account. The referral filter further selects referral, non-referral, or all eligible clinics.",
      "The selected period chooses clinics by the date of their first eligible real or legacy outbound attempt, interpreted in Europe/Bratislava time. It does not filter each later event by date: once a clinic is in the cohort, its later milestones can have happened before or after the selected period. This is a cohort view, not a snapshot of events within the dates or of status at period end.",
      "Assigned is intentionally different: it counts currently assigned clinics across the whole eligible Mission, regardless of period, and still respects country access and referral selection. It is neither a conversion step nor a count of uncalled backlog.",
      "Some older first-attempt records use legacy call-log evidence. Those dates are provisional where dispatch evidence is incomplete; consult the provisional quality count and clinic evidence before comparing periods.",
    ],
    "contact-contract": [
      "The main contact and contract path is ordered: Called → Reached → Qualified → Agreed to cooperate → Wants a contract → Email with contract proposal sent → Wants to sign a contract → Contract sent → Contract delivered to the doctor → Contract returned → Contract validated.",
      "Called uses the clinic's earliest eligible outbound attempt. Reached requires a linked call with an answeredAt time and duration greater than zero. This establishes a technically answered call, not that the doctor personally answered or that a conversation took place.",
      "Qualified and Agreed to cooperate come from the mapped Status List confirmations. Wants a contract requires agreement plus a proven accepted or other eligible proposal response. A missing proposal answer is unknown; it is not treated as “not accepted.”",
      "Email, sent, delivered, returned, and validated each represent their mapped Status List evidence. Email and sent are confirmation records, not proof that an SMTP message was delivered or read; operational reconciliation is separate.",
      "Without a contract is a separate branch: the same enrollment must have agreement and an explicit mapped unaccepted proposal. Agreement alone never proves this outcome. This branch is not a failed contract or a cooperation success by itself.",
      "Wants to sign requires agreement and an accepted proposal. Supported later contract evidence can infer missing earlier contract milestones, but only after the contract branch is proven. An explicit “other / considering” response must not be silently interpreted as wanting to sign.",
      "A milestone is the earliest known attainment and remains historical even if a later confirmation changes. It does not necessarily describe the clinic's currently active Status List state.",
    ],
    combined: [
      "Cooperating combines two alternative, same-enrollment evidence patterns into a clinic-level OR union. Contract cooperation requires validated + agreed + accepted-or-other proposal evidence together. No-contract cooperation requires activeWithout + agreed + explicit unaccepted proposal together.",
      "A clinic meeting either pattern counts once. Never add the two branch totals: the same clinic may satisfy both patterns, and the combined result is deduplicated at clinic level. The separate branch rows remain useful context, not additive parts of a total.",
      "Package of materials sent requires cooperation already achieved on that same enrollment plus all three confirmations at once: information materials, waiting-room leaflets, and pregnancy booklets sent. The cooperation pattern need not still be active at the time the materials confirmations are reached. A poster is optional and is not part of the three-part rule.",
      "Historic first attainment is retained. A combined outcome therefore means the evidence pattern existed at some point, not necessarily that the clinic is still cooperating now.",
    ],
    evidence: [
      "Open clinic evidence by activating a chart step or its View clinic evidence control in the table. Search and page through the matching clinics. The clinic is counted once for that step.",
      "First date is the earliest direct attainment date when one is known. Evidence date is the later supporting event date when a milestone was inferred. An inferred milestone keeps its first date unknown; a blank date means unknown, never “today.”",
      "Evidence basis identifies Call, History, State, Derived, or Current. A state-only confirmation can count directly without a date. Derived evidence supports a reporting milestone only: it does not create a call, Status List entry, email, historical timestamp, or automation action.",
      "Inference can fill supported missing predecessors, including contract milestones from later contract evidence once that branch is proven. It cannot invent a proposal branch from a missing answer. An explicit considering/other response does not automatically become Wants to sign.",
      "A direct count can include a current state confirmation without a dated history event. Direct means not inferred; it does not guarantee a timestamp exists.",
    ],
    "exceptions-quality": [
      "Exception cohorts are scoped to the selected clinic cohort and can overlap both each other and funnel milestones. They are not mutually exclusive categories and must not be added as losses. Unqualified, Refused, Long-term absence, Incorrect number, and Non-functional number come from currently mapped states.",
      "Unavailable includes at least five consecutive unsuccessful outbound attempts marked busy or no_answer with no answeredAt, and also includes active long-term absence. The independent call rule can continue to qualify a clinic even after an absence return date removes the absence-derived component.",
      "Refused shows the first known confirmation and a return date six calendar months later. That date is informational; it does not schedule a follow-up or automatically change eligibility.",
      "The optional long-term-absence date question uses a valid configured date. On or after that date the clinic is removed from the Absent exception and the absence-derived part of Unavailable. It does not edit the Status List or create calls. Escalated has no approved source and is not currently measured; do not infer or invent a count.",
      "The eight data-quality figures are diagnostics over the whole eligible Mission, not just period-filtered clinics, and they are not additive unique-clinic totals: Clinics; Clinics in cohort; Without attempt; Provisional evidence; Calls without a matched clinic; Duplicate enrollments; State-only evidence; Unknown proposal response.",
      "Without attempt means no eligible outbound proof. Provisional indicates fallback/legacy attempt evidence or earlier observed logs. Orphan calls have no resolvable clinic. Duplicate enrollments count extra enrollment rows beyond unique clinics. State-only evidence lacks item history, so dates are not fabricated. Unknown proposal means agreement exists but neither contract nor no-contract branch is proven.",
    ],
    configuration: [
      "Open Evidence mapping and work through its four tabs: Contact & agreement, Contract, Cooperation & materials, and Exceptions. Pick a focused source, then search the Mission Status List by item label or step ID.",
      "Add one or more actual positive-choice items to a source. Multiple selected items within one source mean OR. Selected chips remove an item from that source; an empty source means that evidence is unmeasured, not that zero clinics qualify. Choose the actual positive answer, not a generic question heading or a shared canonical key that could also represent a negative answer.",
      "Accepted, unaccepted, and other proposal answers have distinct meanings. Accepted supports Wants a contract and Wants to sign; explicit unaccepted supports the Without contract branch; other is an eligible response for the contract branch but is not itself acceptance or Wants to sign.",
      "For materials, all three material sources are required together (AND); alternatives within each source remain OR. In Exceptions, an optional date question may record a long-term-absence return date.",
      "Draft selections remain while you move between tabs and search. Save mapping is the only action that saves configuration; it changes the analytical interpretation, not clinic history, Status List, calls, or automation. Read-only roles cannot edit. Exact MPN code suggestions appear only when no saved configuration exists; they are suggestions to review, and an existing saved mapping is never automatically replaced.",
      "There are 19 configurable sources. The retained legacy “Cooperating (explicit yes)” source may still appear in saved configuration but no longer controls the contract cooperation branch. If a mapped item is deleted, it is filtered out of the report configuration; choose a current real item and save the corrected mapping.",
    ],
    sources: [
      "Use these descriptions as a guide to the configurable Mission items. The exact localized item/source names below are taken from the report's existing labels.",
      "Contact & agreement: Qualified identifies the positive qualification result; Agreed identifies explicit agreement to cooperate.",
      "Contract responses: Proposal accepted is explicit acceptance; Proposal not accepted is explicit refusal of the proposal; Other proposal response is a supported eligible response distinct from acceptance and refusal.",
      "Contract progress: Email, Sent, Received, Returned, and Validated record their matching Status List confirmations. They do not verify actual email delivery or receipt outside the Status List.",
      "Cooperation: Cooperating (explicit no) is the active confirmation for the no-contract branch and must be paired with agreement plus an explicit unaccepted proposal. The retained Cooperating (explicit yes) mapping is legacy and is not used to calculate the current contract branch.",
      "Materials: Cord blood information materials sent, Waiting-room leaflets sent, and Pregnancy booklets sent are the three required confirmations. All three must be present on the same enrollment after a cooperation pattern.",
      "Exceptions: Unqualified, Refused, Absent, Wrong number, and Not working are current mapped exception states. They do not represent sequential funnel losses.",
    ],
    "interpret-export": [
      "Read the cohort first: confirm the selected period and referral filter, remember that the period selects clinics by first eligible outbound attempt, and note that Assigned is whole-Mission current assignment rather than cohort conversion.",
      "Read the paths separately. The primary path is contact then contract; Without contract is an independent explicit-answer branch. Combined cooperation is a deduplicated OR across the proven contract and no-contract patterns. Materials are the additional three-confirmation AND outcome.",
      "Totals equal Direct + Inferred. “vs previous” uses the immediate predecessor shown by the business path: Assigned has no predecessor; Called / Assigned; Reached / Called; Qualified / Reached; Agreed / Qualified; Wants a contract and Without a contract / Agreed; Email / Wants a contract; Wants to sign / Email; Sent / Wants to sign; Received / Sent; Returned / Received; Validated / Returned; Cooperating / Agreed; Materials / Cooperating. “of qualified” uses Qualified as denominator, except Assigned is not applicable.",
      "A missing or zero denominator is shown as a dash. Percentages may exceed 100%, and later stages may have more clinics than an earlier stage because historical milestones and supported inference can span non-nested cohorts. Treat ratios as evidence comparisons, not strict sequential retention. Never subtract or add the separate branch totals to derive combined outcomes.",
      "A hatched/unmeasured value means the source is not configured (or a step is not measurable); a measured zero means the configured/measurable rule found no qualifying clinics. Check mapping coverage, Unknown proposal, State-only evidence, and Provisional evidence before drawing conclusions.",
      "The download menu exports CSV or XLSX from the filtered server report, including clinic evidence. It does not export unsaved draft mappings. A mapping change recalculates the report's analytical interpretation; it does not rewrite historical records.",
      "Illustrative hypothetical example, not real Mission data: if 8 clinics meet the contract cooperation rule and 5 meet the no-contract rule, with 2 clinics in both, Combined Cooperating is 11 (8 + 5 − 2), not 13. If only 7 of those 11 have all three material confirmations, Package of materials sent is 7.",
      "Before sharing a performance conclusion, check the cohort definition, which branch is being discussed, whether combined cooperation/material requirements are met, the Direct/Inferred split and dates, and the mapping plus quality caveats. This manual explains report behavior; it does not assert a production rollout state.",
    ],
  },
  stages: {
    assigned: "Current representative assignment among all eligible Mission clinics; period-independent and not a conversion step.",
    dialed: "Earliest eligible outbound attempt for the clinic.",
    connected: "Linked answered call with a recorded answer time and positive duration; not proof of who answered.",
    qualified: "At least one mapped positive qualification confirmation.",
    agreed: "At least one mapped agreement-to-cooperate confirmation.",
    wantsContract: "Agreement plus an accepted or other proven eligible proposal response.",
    withoutContract: "Agreement plus an explicit unaccepted proposal on the same enrollment.",
    email: "Mapped confirmation that an email with the proposal was sent; not SMTP delivery proof.",
    wantsToSign: "Agreement plus an accepted proposal, or supported later contract evidence; explicit considering is not enough.",
    sent: "Mapped contract-sent confirmation.",
    received: "Mapped contract-delivered-to-doctor confirmation.",
    returned: "Mapped contract-returned confirmation.",
    validated: "Mapped contract-validated confirmation.",
    cooperating: "Clinic-level union of the proven contract and no-contract cooperation patterns.",
    packageSent: "Proof that the whole package was sent, or valid existing component/exclusion proof; cooperation is not required. It has no previous-stage percentage because it is independent; its Qualified percentage uses the standard Qualified baseline.",
    materials: "The existing eligibility rule: cooperating AND package sent on the same enrollment. Its existing previous-percent denominator is unchanged.",
  },
  sources: {
    qualified: "Positive qualification choice; not a generic heading.",
    agreed: "Explicit agreement to cooperate.",
    proposalAccepted: "Explicit accepted proposal answer.",
    proposalUnaccepted: "Explicit unaccepted proposal answer; enables the separate Without contract branch with agreement.",
    proposalOther: "Other supported proposal response; not the same as accepted or wants-to-sign.",
    email: "Status List confirmation that the proposal email was sent, not proof of SMTP delivery.",
    sent: "Status List confirmation that the contract was sent.",
    received: "Status List confirmation that the contract was delivered to the doctor.",
    returned: "Status List confirmation that the contract was returned.",
    validated: "Status List confirmation that the contract was validated.",
    activeWith: "Legacy saved source only; no longer used by the current contract branch.",
    activeWithout: "Explicit cooperation confirmation for the no-contract branch.",
    materials17: "First required sent-material confirmation: information materials.",
    materials18: "Second required sent-material confirmation: waiting-room leaflets.",
    materials19: "Third required sent-material confirmation: pregnancy booklets.",
    unqualified: "Current mapped unqualified state.",
    refused: "Current mapped refusal state; first known date anchors the six-month return date.",
    absent: "Current mapped long-term absence state; may also contribute to Unavailable.",
    wrongNumber: "Current mapped incorrect-number state.",
    notWorking: "Current mapped non-functional-number state.",
  },
  exceptions: {
    unqualified: "Current mapped state; can coexist with other milestones.",
    refused: "Current mapped state; six-month return date is informational only.",
    unreachable: "Five consecutive busy/no_answer outbound attempts without answeredAt, or active long-term absence.",
    absent: "Current mapped long-term absence, removed on/after a configured valid return date.",
    wrongNumber: "Current mapped incorrect-number state.",
    notWorking: "Current mapped non-functional-number state.",
  },
};

const sk: HelpDraft = {
  title: "INDEXUS Lievik misie · praktická príručka", intro: "Praktický sprievodca významom počtov kliník, dôkazmi a bezpečným čítaním vetiev.", close: "Zavrieť príručku",
  chapters: { scope:"Rozsah a kohorta","contact-contract":"Kontakt a zmluva",combined:"Kombinované výsledky",evidence:"Dôkazy kliniky","exceptions-quality":"Výnimky a kvalita",configuration:"Nastavenie dôkazov",sources:"Všetky zdroje mapovania","interpret-export":"Čítanie a export lievika" },
  content: {
    scope:["Report počíta v každom kroku jedinečné kliniky misie, nie riadky zaradení, kontakty ani hovory. Klinika s duplicitnými zaradeniami sa v kroku počíta raz; nadbytočné riadky sa zobrazujú v kvalite údajov.","Prístup je obmedzený na krajiny povolené pre váš účet. Filter odporúčania ďalej vyberá odporúčané, neodporúčané alebo všetky oprávnené kliniky.","Zvolené obdobie vyberá kliniky podľa dátumu ich prvého oprávneného skutočného alebo staršieho odchádzajúceho pokusu, v časovom pásme Europe/Bratislava. Nefiltruje dátumy neskorších udalostí: míľniky môžu nastať pred obdobím alebo po ňom. Ide o kohortu podľa prvého pokusu, nie o udalosti v období ani historický stav ku koncu obdobia.","Priradené sa počíta odlišne: zahŕňa aktuálne priradené kliniky celej oprávnenej misie bez ohľadu na obdobie a rešpektuje krajinu aj filter odporúčania. Nie je to konverzný krok ani počet nevolaných kliník.","Staršie záznamy prvého pokusu môžu vychádzať zo starších dôkazov hovoru. Pri neúplnom dôkaze odoslania sú predbežné; pri porovnaní období skontrolujte kvalitu a dôkazy kliniky."],
    "contact-contract":["Hlavná cesta je: Volané → Zastihnuté → Kvalifikované → Súhlasí so spoluprácou → Chce zmluvu → Odoslaný e-mail s návrhom zmluvy → Chce podpísať zmluvu → Zmluva odoslaná → Zmluva doručená lekárovi → Zmluva vrátená → Zmluva overená.","Volané používa najskorší oprávnený odchádzajúci pokus. Zastihnuté vyžaduje prepojený hovor s časom odpovede a trvaním väčším ako nula. Potvrdzuje technicky prijatý hovor, nie to, že odpovedal lekár alebo prebehol rozhovor.","Kvalifikácia a súhlas pochádzajú z namapovaných potvrdení Status List. Chce zmluvu vyžaduje súhlas a preukázanú prijatú alebo inú oprávnenú odpoveď na návrh. Chýbajúca odpoveď je neznáma, nie „neprijatá“.","E-mail, odoslanie, doručenie, vrátenie a overenie predstavujú namapované potvrdenia Status List. E-mail a odoslanie nedokazujú doručenie cez SMTP ani prečítanie; prevádzkové overenie je samostatné.","Bez zmluvy je samostatná vetva: rovnaké zaradenie musí mať súhlas a výslovnú namapovanú neprijatú ponuku. Samotný súhlas tento výsledok nedokazuje. Nie je to neúspešná zmluva ani samostatný úspech spolupráce.","Chce podpísať vyžaduje súhlas a prijatú ponuku. Podporené neskoršie zmluvné dôkazy môžu odvodiť chýbajúce skoršie míľniky až po preukázaní zmluvnej vetvy. Výslovná odpoveď „iné/zvažuje“ sa nesmie automaticky vyložiť ako záujem podpísať.","Míľnik zachováva najskoršie známe dosiahnutie aj po neskoršej zmene potvrdenia. Nemusí opisovať aktuálny stav Status List."],
    combined:["Spolupracuje spája dve alternatívne vzory dôkazov z rovnakého zaradenia do zjednotenia na úrovni kliniky. Zmluvná spolupráca vyžaduje overenú zmluvu + súhlas + prijatú alebo inú odpoveď. Vetva bez zmluvy vyžaduje aktívne potvrdenie spolupráce bez zmluvy + súhlas + výslovne neprijatú ponuku.","Klinika spĺňajúca ktorýkoľvek vzor sa počíta raz. Vetvy nikdy nesčítavajte: klinika môže spĺňať obe a kombinovaný výsledok je deduplikovaný. Samostatné riadky vetiev sú kontext, nie sčítateľné časti celku.","Balík materiálov vyžaduje už dosiahnutú spoluprácu v tom istom zaradení a súčasne všetky tri potvrdenia: informačné materiály, letáky do čakárne a tehotenské knižky odoslané. Spolupráca nemusí byť aktívna v čase dosiahnutia materiálov. Plagát je voliteľný.","Zachováva sa historické prvé dosiahnutie. Kombinovaný výsledok teda znamená, že vzor dôkazov niekedy existoval, nie že klinika spolupracuje aj teraz."],
    evidence:["Dôkazy kliniky otvorte aktivovaním kroku v grafe alebo ovládača dôkazov v tabuľke. Vyhľadávajte a prechádzajte stránky kliník. Klinika sa v kroku počíta raz.","Prvý dátum je najskorší známy dátum priameho dosiahnutia. Dátum dôkazu je neskoršia podporná udalosť pri odvodenom míľniku. Odvodený míľnik ponecháva prvý dátum neznámy; prázdny dátum nikdy neznamená „dnes“.","Základ dôkazu označuje Hovor, História, Stav, Odvodené alebo Aktuálne. Potvrdenie iba v stave sa môže počítať priamo bez dátumu. Odvodenie podporuje iba reportovací míľnik; nevytvára hovor, položku Status List, e-mail, historický čas ani automatizáciu.","Odvodenie môže doplniť podporené predchádzajúce kroky vrátane zmluvných míľnikov po preukázaní vetvy. Nevymýšľa vetvu z chýbajúcej odpovede. Výslovné „iné/zvažuje“ sa automaticky nemení na Chce podpísať.","Priamy počet môže obsahovať aktuálne potvrdenie stavu bez dátovanej histórie. Priame znamená, že nebolo odvodené, nie že existuje časová značka."],
    "exceptions-quality":["Výnimky patria do vybranej kohorty a môžu sa prekrývať navzájom aj s míľnikmi. Nie sú vzájomne výlučné ani sčítateľnými stratami. Nekvalifikované, odmieta spoluprácu, dlhodobá neprítomnosť, nesprávne a nefunkčné číslo vychádzajú z aktuálnych namapovaných stavov.","Nedostupné zahŕňa aspoň päť po sebe idúcich neúspešných odchádzajúcich pokusov busy alebo no_answer bez answeredAt a tiež aktívnu dlhodobú neprítomnosť. Pravidlo hovorov môže kliniku naďalej kvalifikovať aj po odstránení zložky neprítomnosti dátumom návratu.","Odmietnutie zobrazuje prvé známe potvrdenie a dátum návratu o šesť kalendárnych mesiacov. Dátum je informačný; neplánuje následný kontakt ani automaticky nemení oprávnenosť.","Voliteľná otázka dátumu používa platný nastavený dátum návratu. V tento deň alebo neskôr sa klinika odstráni z výnimky Neprítomnosť a zo zložky Nedostupné odvodenej od neprítomnosti. Status List sa nemení a nevytvárajú sa hovory. Pre Eskalované neexistuje schválený zdroj; momentálne sa nemeria.","Osem ukazovateľov kvality pokrýva celú oprávnenú misiu, nie iba filtrované obdobie, a nie sú sčítateľným počtom jedinečných kliník: kliniky; kliniky v kohorte; bez pokusu; predbežné dôkazy; hovory bez kliniky; duplicitné zaradenia; iba stav; neznáma odpoveď na ponuku.","Bez pokusu znamená chýbajúci oprávnený odchádzajúci dôkaz. Predbežné označuje náhradný/starší dôkaz alebo staršie logy. Osirelé hovory nemajú rozpoznateľnú kliniku. Duplicitné zaradenia počítajú nadbytočné riadky. Iba stav nemá históriu položky, preto sa dátum nevymýšľa. Neznáma ponuka znamená súhlas bez preukázanej zmluvnej alebo bez-zmluvnej vetvy."],
    configuration:["Otvorte Mapovanie dôkazov a použite štyri karty: Kontakt a súhlas, Zmluva, Spolupráca a materiály, Výnimky. Vyberte zdroj a vyhľadávajte v Status List podľa názvu položky alebo ID kroku.","Pridajte skutočné pozitívne položky. Viaceré položky v zdroji znamenajú ALEBO. Čipy odstránia položku; prázdny zdroj je nemeraný, nie nulový. Vyberte skutočnú pozitívnu odpoveď, nie všeobecnú hlavičku otázky ani zdieľaný kľúč, ktorý môže znamenať aj zápornú odpoveď.","Prijatá, neprijatá a iná odpoveď na návrh majú odlišný význam. Prijatá podporuje Chce zmluvu a Chce podpísať; výslovne neprijatá podporuje samostatnú vetvu Bez zmluvy; iná oprávnená odpoveď nie je prijatím ani záujmom podpísať.","Pri materiáloch treba všetky tri zdroje súčasne (AND); alternatívy v každom zdroji zostávajú OR. Vo Výnimkách možno nastaviť voliteľnú otázku dátumu návratu.","Výbery zostávajú počas prepínania kariet a vyhľadávania. Uložiť mapovanie je jediný spôsob uloženia konfigurácie; mení analytickú interpretáciu, nie históriu, Status List, hovory ani automatizáciu. Roly iba na čítanie nemôžu upravovať. Presné návrhy kódov MPN sa zobrazia iba bez uloženej konfigurácie; existujúca konfigurácia sa automaticky nenahrádza.","Existuje 19 nastaviteľných zdrojov. Starší zdroj „Spolupracuje (výslovné áno)“ môže zostať uložený, ale už neriadi zmluvnú vetvu. Odstránené ID položiek zostávajú na kontrolu a výpočet ich ignoruje."],
    sources:["Opisy pomáhajú vybrať správne položky misie. Zobrazené názvy sú presne existujúce lokalizované štítky reportu.","Kontakt a súhlas: Kvalifikované označuje pozitívny výsledok; súhlas znamená výslovný súhlas so spoluprácou.","Odpovede na zmluvu: prijatá je výslovné prijatie; neprijatá je výslovné odmietnutie návrhu; iná je podporená oprávnená odpoveď odlišná od prijatia a odmietnutia.","Postup zmluvy: E-mail, odoslaná, doručená, vrátená a overená zaznamenávajú príslušné potvrdenia Status List, nie skutočné doručenie e-mailu.","Spolupráca: aktívne potvrdenie bez zmluvy patrí do vetvy bez zmluvy a vyžaduje súhlas aj výslovne neprijatý návrh. Staršie výslovné áno je iba historické mapovanie.","Materiály: informačné materiály, letáky do čakárne a tehotenské knižky sú tri povinné potvrdenia. Všetky musia byť v rovnakom zaradení po vzore spolupráce.","Výnimky: Nekvalifikované, odmietnutie, neprítomnosť, nesprávne a nefunkčné číslo sú aktuálne namapované stavy, nie postupné straty."],
    "interpret-export":["Najskôr skontrolujte kohortu: obdobie a filter odporúčania. Obdobie vyberá podľa prvého oprávneného odchádzajúceho pokusu; Priradené je aktuálne priradenie v celej misii.","Čítajte cesty oddelene. Hlavná cesta je kontakt a zmluva; Bez zmluvy je nezávislá vetva s výslovnou odpoveďou. Spolupracuje je deduplikované OR zjednotenie oboch preukázaných vzorov. Materiály pridávajú AND troch potvrdení.","Celkom = Priame + Odvodené. „Voči predchádzajúcemu“ používa bezprostredný predchodca: Priradené nemá predchodcu; Volané/Priradené; Zastihnuté/Volané; Kvalifikované/Zastihnuté; Súhlasí/Kvalifikované; Chce zmluvu a Bez zmluvy/Súhlasí; E-mail/Chce zmluvu; Chce podpísať/E-mail; Odoslané/Chce podpísať; Doručené/Odoslané; Vrátené/Doručené; Overené/Vrátené; Spolupracuje/Súhlasí; Materiály/Spolupracuje. „Z kvalifikovaných“ používa menovateľ Kvalifikované, okrem Priradených.","Chýbajúci alebo nulový menovateľ sa zobrazí pomlčkou. Percentá môžu presiahnuť 100 % a neskorší krok môže mať viac kliník pre historické míľniky a odvodenia naprieč kohortami. Pomer nie je striktne postupná retencia. Vetvy nikdy nesčítavajte ani neodčítavajte na výpočet kombinovaného výsledku.","Šrafované/nemerané znamená nenastavený zdroj alebo nemerateľný krok; meraná nula znamená, že pravidlo nenašlo kliniky. Pred záverom skontrolujte mapovanie, neznámu ponuku, stavové a predbežné dôkazy.","CSV/XLSX exportuje filtrovaný report servera vrátane dôkazov kliník, nie neuložené návrhy konfigurácie. Zmena mapovania prepočíta analytickú interpretáciu, ale neprepisuje históriu.","Ilustračný hypotetický príklad, nie skutočné údaje misie: 8 kliník spĺňa zmluvnú spoluprácu, 5 bez-zmluvnú a 2 sú v oboch. Kombinované Spolupracuje je 11 (8 + 5 − 2), nie 13. Ak 7 z nich má všetky tri potvrdenia materiálov, výsledok balíka je 7.","Pred zdieľaním záveru overte kohortu, vetvu, podmienky spolupráce a materiálov, podiel Priame/odvodené a dátumy, mapovanie a kvalitu. Príručka vysvetľuje report, nepotvrdzuje stav nasadenia."],
  },
  stages:{assigned:"Aktuálne priradenie v celej oprávnenej misii; nezávislé od obdobia, nie konverzný krok.",dialed:"Najskorší oprávnený odchádzajúci pokus.",connected:"Prepojený hovor s časom odpovede a kladným trvaním; nepotvrdzuje, kto odpovedal.",qualified:"Aspoň jedno namapované pozitívne potvrdenie kvalifikácie.",agreed:"Aspoň jedno namapované potvrdenie súhlasu so spoluprácou.",wantsContract:"Súhlas a preukázaná prijatá alebo iná oprávnená odpoveď.",withoutContract:"Súhlas a výslovne neprijatý návrh v rovnakom zaradení.",email:"Namapované potvrdenie odoslania e-mailu; nie dôkaz SMTP doručenia.",wantsToSign:"Súhlas a prijatý návrh alebo podporený neskorší zmluvný dôkaz; zvažovanie nestačí.",sent:"Namapované potvrdenie odoslania zmluvy.",received:"Namapované potvrdenie doručenia zmluvy lekárovi.",returned:"Namapované potvrdenie vrátenia zmluvy.",validated:"Namapované potvrdenie overenia zmluvy.",cooperating:"Zjednotenie preukázaných zmluvných a bez-zmluvných vzorov na úrovni kliniky.",packageSent:"Dôkaz o odoslaní celého balíka alebo platný existujúci dôkaz o súčastiach/vylúčení; spolupráca sa nevyžaduje. Nemá percento voči predchádzajúcemu kroku, pretože ide o nezávislý výsledok; percento z kvalifikovaných používa bežný menovateľ Kvalifikované.",materials:"Pôvodné pravidlo: spolupracuje A balík odoslaný v rovnakom zaradení; existujúci menovateľ percenta voči predchádzajúcemu zostáva nezmenený."},
  sources:{qualified:"Pozitívna kvalifikácia, nie všeobecná hlavička.",agreed:"Výslovný súhlas so spoluprácou.",proposalAccepted:"Výslovne prijatá odpoveď.",proposalUnaccepted:"Výslovne neprijatá odpoveď; so súhlasom umožňuje vetvu Bez zmluvy.",proposalOther:"Iná podporená odpoveď; nie prijatie ani záujem podpísať.",email:"Potvrdenie Status List o odoslaní návrhu, nie SMTP doručenie.",sent:"Potvrdenie Status List o odoslaní zmluvy.",received:"Potvrdenie doručenia zmluvy lekárovi.",returned:"Potvrdenie vrátenia zmluvy.",validated:"Potvrdenie overenia zmluvy.",activeWith:"Iba starší uložený zdroj; aktuálna zmluvná vetva ho nepoužíva.",activeWithout:"Výslovné potvrdenie spolupráce pre vetvu bez zmluvy.",materials17:"Prvé povinné potvrdenie: informačné materiály.",materials18:"Druhé povinné potvrdenie: letáky do čakárne.",materials19:"Tretie povinné potvrdenie: tehotenské knižky.",unqualified:"Aktuálny namapovaný stav nekvalifikovanosti.",refused:"Aktuálny stav odmietnutia; prvý známy dátum určuje šesťmesačný návrat.",absent:"Aktuálna dlhodobá neprítomnosť; môže prispieť k Nedostupným.",wrongNumber:"Aktuálny stav nesprávneho čísla.",notWorking:"Aktuálny stav nefunkčného čísla."},
  exceptions:{unqualified:"Aktuálny stav; môže sa prekrývať s míľnikmi.",refused:"Aktuálny stav; šesťmesačný návrat je iba informačný.",unreachable:"Päť po sebe idúcich busy/no_answer pokusov bez answeredAt alebo aktívna dlhodobá neprítomnosť.",absent:"Aktuálna neprítomnosť; po nastavenom dátume návratu sa odstráni.",wrongNumber:"Aktuálny stav nesprávneho čísla.",notWorking:"Aktuálny stav nefunkčného čísla."},
};

const cs: HelpDraft = {
  ...sk,
  title:"INDEXUS Trychtýř mise · praktická příručka",intro:"Praktický průvodce významem počtů klinik, důkazy a bezpečným čtením větví.",close:"Zavřít příručku",
  chapters:{scope:"Rozsah a kohorta","contact-contract":"Kontakt a smlouva",combined:"Kombinované výsledky",evidence:"Důkazy kliniky","exceptions-quality":"Výjimky a kvalita",configuration:"Nastavení důkazů",sources:"Všechny zdroje mapování","interpret-export":"Čtení a export trychtýře"},
  content:{
    scope:["Report počítá v každém kroku jedinečné kliniky mise, nikoli řádky zařazení, kontakty ani hovory. Klinika s duplicitními zařazeními se v kroku počítá jednou; přebytečné řádky jsou samostatně v kvalitě dat.","Přístup je omezen na země povolené pro váš účet. Filtr doporučení dále vybírá doporučené, nedoporučené nebo všechny oprávněné kliniky.","Zvolené období vybírá kliniky podle data jejich prvního oprávněného skutečného nebo historického odchozího pokusu v časovém pásmu Europe/Bratislava. Nefiltruje pozdější události podle data: milníky mohou nastat před obdobím i po něm. Jde o kohortu podle prvního pokusu, nikoli události v období ani stav ke konci období.","Přiřazeno se počítá jinak: zahrnuje aktuálně přiřazené kliniky celé oprávněné mise bez ohledu na období a respektuje zemi i filtr doporučení. Není to konverzní krok ani počet nevolaných klinik.","Starší důkazy prvního pokusu mohou být předběžné, pokud chybí důkaz odeslání. Před porovnáním období zkontrolujte kvalitu a důkazy kliniky."],
    "contact-contract":["Hlavní cesta: Voláno → Dovoláno → Kvalifikované → Souhlasí se spoluprací → Chce smlouvu → Odeslán e-mail s návrhem smlouvy → Chce podepsat smlouvu → Smlouva odeslána → Smlouva doručena lékaři → Smlouva vrácena → Smlouva ověřena.","Voláno používá nejčasnější oprávněný odchozí pokus. Dovoláno vyžaduje propojený hovor s časem odpovědi a délkou větší než nula. Dokládá technicky přijatý hovor, ne to, že odpověděl lékař nebo proběhl rozhovor.","Kvalifikace a souhlas vycházejí z namapovaných potvrzení Status List. Chce smlouvu vyžaduje souhlas a prokázanou přijatou či jinou oprávněnou odpověď. Chybějící odpověď je neznámá, nikoli „nepřijata“.","E-mail, odeslání, doručení, vrácení a ověření jsou namapovaná potvrzení Status List. E-mail a odesláno nedokládají doručení či přečtení přes SMTP; provozní ověření je samostatné.","Bez smlouvy je oddělená větev: stejné zařazení musí mít souhlas a výslovně nepřijatý návrh. Samotný souhlas výsledek nedokládá. Není to neúspěšná smlouva ani úspěch spolupráce sám o sobě.","Chce podepsat vyžaduje souhlas a přijatý návrh. Podporované pozdější důkazy mohou odvodit chybějící dřívější milníky až po prokázání smluvní větve. Výslovné „jiné/zvažuje“ se nesmí automaticky považovat za zájem podepsat.","Milník zachovává nejstarší známé dosažení i po pozdější změně potvrzení. Nemusí popisovat aktuální stav Status List."],
    combined:["Spolupracuje slučuje dva alternativní vzory důkazů ze stejného zařazení do sjednocení na úrovni kliniky. Smluvní spolupráce vyžaduje ověřenou smlouvu + souhlas + přijatou nebo jinou odpověď. Větev bez smlouvy vyžaduje aktivní potvrzení bez smlouvy + souhlas + výslovně nepřijatý návrh.","Klinika splňující kterýkoli vzor se započítá jednou. Větve nikdy nesčítejte: klinika může splnit obě a kombinovaný výsledek je deduplikovaný. Samostatné řádky větví jsou kontext, nikoli sčitatelné části celku.","Balíček materiálů vyžaduje dosaženou spolupráci na stejném zařazení a současně všechna tři potvrzení: informační materiály, letáky do čekárny a těhotenské knížky odeslány. Spolupráce nemusí být aktivní v době dosažení materiálů. Plakát je volitelný.","Zachovává se historické první dosažení. Kombinovaný výsledek znamená, že vzor někdy existoval, ne že klinika spolupracuje právě nyní."],
    evidence:["Důkazy kliniky otevřete aktivací kroku v grafu nebo tlačítka důkazů v tabulce. Kliniky lze hledat a procházet po stránkách; v kroku se počítá každá jednou.","První datum je nejčasnější známé přímé dosažení. Datum důkazu je pozdější podpůrná událost při odvození. Odvozený milník ponechává první datum neznámé; prázdné datum nikdy neznamená „dnes“.","Základ důkazu označuje Hovor, Historie, Stav, Odvozené nebo Aktuální. Potvrzení pouze ve stavu se může počítat přímo bez data. Odvození podporuje jen reportovací milník; nevytváří hovor, položku Status List, e-mail, historické datum ani automatizaci.","Odvození může doplnit podporované předchůdce včetně smluvních milníků po prokázání větve. Nevytváří větev z chybějící odpovědi. Výslovné „jiné/zvažuje“ se automaticky nemění na Chce podepsat.","Přímý počet může zahrnovat aktuální potvrzení bez datované historie. Přímé znamená neodvozené, nikoli s časovou značkou."],
    "exceptions-quality":["Výjimky se vztahují k vybrané kohortě a mohou se překrývat navzájem i s milníky. Nejsou vzájemně výlučné ani sčitatelné ztráty. Nekvalifikované, odmítnutí, dlouhodobá nepřítomnost, chybné a nefunkční číslo vycházejí z aktuálních namapovaných stavů.","Nedostupné zahrnuje nejméně pět po sobě jdoucích neúspěšných odchozích pokusů busy/no_answer bez answeredAt a také aktivní dlouhodobou nepřítomnost. Nezávislé pravidlo hovorů může platit i po odstranění absence datem návratu.","Odmítnutí ukazuje první známé potvrzení a datum návratu o šest kalendářních měsíců později. Datum je informativní; nesjednává následný kontakt ani automaticky nemění způsobilost.","Volitelná otázka používá platné nastavené datum návratu. V tento den nebo později se klinika odebere z Nepřítomných a z části Nedostupných odvozené od absence. Status List se nemění a hovory nevznikají. Eskalováno nemá schválený zdroj a nyní se neměří.","Osm ukazatelů kvality pokrývá celou oprávněnou misi, nikoli pouze období, a nejsou sčitatelným počtem jedinečných klinik: kliniky, kohorta, bez pokusu, předběžné důkazy, hovory bez kliniky, duplicitní zařazení, pouze stav, neznámá odpověď.","Bez pokusu znamená chybějící oprávněný odchozí důkaz. Předběžné označuje náhradní/starší důkazy. Osamocené hovory nemají přiřaditelnou kliniku. Duplicitní zařazení jsou řádky navíc. Pouze stav nemá historii, proto se datum nevymýšlí. Neznámá nabídka znamená souhlas bez prokázané smluvní či bezsmluvní větve."],
    configuration:["Otevřete Mapování důkazů a použijte čtyři karty: Kontakt a souhlas, Smlouva, Spolupráce a materiály, Výjimky. Vyberte zdroj a hledejte v Status List podle názvu nebo ID kroku.","Přidávejte skutečné pozitivní volby. Více položek v jednom zdroji znamená NEBO. Čipy položku odeberou; prázdný zdroj je neměřený, nikoli nula. Vyberte konkrétní pozitivní odpověď, ne obecný nadpis otázky ani sdílený klíč, který může označovat i zápornou volbu.","Přijatá, nepřijatá a jiná odpověď mají odlišný význam. Přijatá podporuje Chce smlouvu a Chce podepsat; výslovně nepřijatá podporuje Bez smlouvy; jiná odpověď není přijetí ani zájem podepsat.","U materiálů jsou nutné všechny tři zdroje zároveň (AND); alternativy v každém zdroji jsou OR. Ve Výjimkách lze nastavit volitelnou otázku data návratu.","Výběry zůstávají při přepínání karet a hledání. Uložit mapování ukládá pouze konfiguraci; mění analytickou interpretaci, nikoli historii, Status List, hovory ani automatizaci. Role pouze pro čtení nemohou upravovat. Přesné návrhy kódů MPN se zobrazí jen bez uložené konfigurace a existující mapování se nikdy samo nenahradí.","Existuje 19 nastavitelných zdrojů. Starší zdroj „Spolupracuje (výslovné ano)“ může zůstat uložený, ale současnou smluvní větev neřídí. Smazaná ID zůstávají ke kontrole a výpočet je ignoruje."],
    sources:["Popisy pomáhají zvolit správné položky mise. Zobrazené názvy jsou přesné existující lokalizované popisky reportu.","Kontakt a souhlas: Kvalifikované označuje pozitivní výsledek; souhlas je výslovný souhlas se spoluprací.","Odpovědi k návrhu: přijatý je výslovné přijetí; nepřijatý je výslovné odmítnutí; jiný je podporovaná oprávněná odpověď odlišná od přijetí i odmítnutí.","Průběh smlouvy: E-mail, Odesláno, Doručeno, Vráceno a Ověřeno zaznamenávají odpovídající potvrzení Status List, nikoli skutečné doručení e-mailu.","Spolupráce: aktivní potvrzení bez smlouvy patří do této větve a vyžaduje souhlas i výslovně nepřijatý návrh. Starší výslovné ano je pouze historické mapování.","Materiály: informační materiály, letáky do čekárny a těhotenské knížky jsou tři povinná potvrzení. Všechny musí být v jednom zařazení po vzoru spolupráce.","Výjimky: Nekvalifikované, odmítnutí, nepřítomnost, chybné a nefunkční číslo jsou aktuální namapované stavy, nikoli postupné ztráty."],
    "interpret-export":["Nejprve ověřte kohortu: období a filtr doporučení. Období vybírá podle prvního oprávněného odchozího pokusu; Přiřazeno je aktuální přiřazení celé mise.","Cesty čtěte odděleně. Hlavní cesta je kontakt a smlouva; Bez smlouvy je nezávislá větev s výslovnou odpovědí. Spolupracuje je deduplikované sjednocení OR obou prokázaných vzorů. Materiály přidávají AND tří potvrzení.","Celkem = Přímé + Odvozené. „Vůči předchozímu“ používá bezprostředního předchůdce: Přiřazeno nemá předchůdce; Voláno/Přiřazeno; Dovoláno/Voláno; Kvalifikované/Dovoláno; Souhlas/Kvalifikované; Chce smlouvu a Bez smlouvy/Souhlas; E-mail/Chce smlouvu; Chce podepsat/E-mail; Odesláno/Chce podepsat; Doručeno/Odesláno; Vráceno/Doručeno; Ověřeno/Vráceno; Spolupracuje/Souhlas; Materiály/Spolupracuje. „Z kvalifikovaných“ používá jmenovatel Kvalifikované, kromě Přiřazeno.","Chybějící nebo nulový jmenovatel se zobrazí pomlčkou. Procenta mohou přesáhnout 100 % a pozdější krok může mít více klinik kvůli historickým milníkům a odvození napříč kohortami. Jde o srovnání důkazů, ne striktní retenci. Větve nikdy nesčítejte ani neodečítejte pro kombinovaný výsledek.","Šrafovaná/neměřená hodnota znamená nenastavený zdroj nebo neměřitelný krok; měřená nula znamená, že pravidlo nenašlo žádnou kliniku. Před závěrem zkontrolujte mapování, neznámou odpověď, stavové a předběžné důkazy.","CSV/XLSX exportuje filtrovaný serverový report včetně důkazů, ne neuložené návrhy konfigurace. Změna mapování přepočítá interpretaci, ale nepřepisuje historii.","Hypotetický příklad, nikoli skutečná data mise: smluvní spolupráci splní 8 klinik, bez smlouvy 5, z toho 2 v obou skupinách. Kombinované Spolupracuje je 11 (8 + 5 − 2), nikoli 13. Pokud 7 z nich má všechna tři potvrzení materiálů, balíček má 7.","Před sdílením závěru ověřte kohortu, větev, podmínky spolupráce a materiálů, přímé/odvozené důkazy i mapování a kvalitu. Příručka popisuje chování reportu, nepotvrzuje stav nasazení."],
  },
  stages:sk.stages,sources:sk.sources,exceptions:sk.exceptions,
};

// Hungarian, Romanian, Italian and German versions keep the same chapter structure and
// evidence rules so coordinators can use the manual in their selected interface language.
const hu: HelpDraft = {
  ...en, title:"INDEXUS Missziós tölcsér · útmutató",intro:"Gyakorlati útmutató a klinikai számok, bizonyítékok és elágazások értelmezéséhez.",close:"Útmutató bezárása",
  chapters:{scope:"Hatókör és kohorsz","contact-contract":"Kapcsolat és szerződés",combined:"Összesített eredmények",evidence:"Klinikai bizonyíték","exceptions-quality":"Kivételek és minőség",configuration:"Bizonyíték beállítása",sources:"Minden leképezési forrás","interpret-export":"Értelmezés és export"},
  content:{
    scope:["A jelentés lépésenként egyedi Mission-klinikákat számol, nem beiratkozási sorokat, kapcsolatokat vagy hívásokat. A többszörös beiratkozású klinika egy lépésben egyszer szerepel; a többletsorok külön adatminőségi mutatók.","A hozzáférés a fiókhoz engedélyezett országokra korlátozódik. Az ajánlási szűrő tovább választ az ajánlott, nem ajánlott vagy valamennyi jogosult klinika között.","Az időszak a klinikákat az első jogosult valós vagy örökölt kimenő próbálkozás dátuma alapján választja ki, Europe/Bratislava időzónában. A későbbi mérföldkövek dátumát nem szűri: azok az időszakon kívül is történhettek. Ez kohorsznézet, nem az időszak eseményeinek vagy zárónapi állapotának pillanatképe.","A Hozzárendelt ettől eltér: a teljes jogosult Mission jelenleg koordinátorhoz rendelt klinikáit számolja időszaktól függetlenül, az ország- és ajánlási szűrőt megtartva. Nem konverziós lépés és nem a fel nem hívott klinikák száma.","A régi első próbálkozások bizonyítéka hiányos lehet, ezért előzetesnek minősülhet. Időszakok összehasonlításakor vizsgálja meg a minőségi mutatót és a klinikai bizonyítékot."],
    "contact-contract":["A fő útvonal: Felhívva → Elérve → Minősített → Együttműködés elfogadva → Szerződést szeretne → Szerződésajánlat e-mailben elküldve → Alá szeretná írni → Szerződés elküldve → Szerződés kézbesítve az orvosnak → Szerződés visszaküldve → Szerződés ellenőrizve.","A Felhívva a klinika legkorábbi jogosult kimenő próbálkozását használja. Az Elérve összekapcsolt hívást, válaszidőt és pozitív időtartamot igényel. Ez technikailag fogadott hívás, nem bizonyítja, hogy az orvos válaszolt vagy beszélgetés történt.","A Minősített és az Együttműködés elfogadva a leképezett Status List megerősítésekből származik. A Szerződést szeretne megköveteli az együttműködést és az elfogadott vagy más igazolt jogosult választ. A hiányzó válasz ismeretlen, nem „elutasított”.","Az e-mail, elküldött, kézbesített, visszaküldött és ellenőrzött a megfelelő Status List-megerősítést jelenti. Az e-mail/elküldött nem bizonyítja az SMTP-kézbesítést vagy olvasást; az operatív egyeztetés külön feladat.","A Szerződés nélkül külön ág: ugyanazon beiratkozásban együttműködési elfogadás és kifejezett, el nem fogadott ajánlat kell. Az együttműködés önmagában nem elég, és ez nem szerződési kudarc vagy önálló együttműködési siker.","Az Alá szeretné írni együttműködést és elfogadott ajánlatot igényel. A támogatott későbbi szerződésbizonyíték hiányzó korábbi mérföldkövet következtethet ki, de csak az igazolt szerződéses ágban. A kifejezett „másik/mérlegeli” válasz nem jelent automatikusan aláírási szándékot.","A mérföldkő a legkorábbi ismert elérést őrzi meg későbbi változás után is; nem feltétlenül a jelenlegi Status List-állapot."],
    combined:["Az Együttműködik két alternatív, ugyanazon beiratkozáshoz tartozó bizonyítékmintát egyesít klinikaszintű VAGY unióként. A szerződéses együttműködéshez ellenőrzött szerződés + együttműködés + elfogadott vagy más ajánlatválasz kell. A szerződés nélküli ághoz aktív, szerződés nélküli együttműködés + együttműködés + kifejezetten el nem fogadott ajánlat kell.","Bármelyik mintát teljesítő klinika egyszer számít. Ne adja össze a két ágat: ugyanaz a klinika mindkettőnek megfelelhet, az összesített eredmény deduplikált. Az ágsorok külön tájékoztatók, nem összeadható részek.","Az Anyagcsomaghoz ugyanazon beiratkozásban már elért együttműködés és mindhárom megerősítés együttesen kell: köldökvér-információs anyagok, várótermi szórólapok és várandóskönyvek elküldve. Az együttműködésnek nem kell az anyagok elérésekor is aktívnak lennie. A poszter opcionális.","A történeti első elérés megmarad. Az összesített eredmény azt jelenti, hogy a mintázat valamikor fennállt, nem feltétlenül azt, hogy a klinika most is együttműködik."],
    evidence:["A klinikai bizonyíték a diagramlépés vagy a táblázat bizonyítékmegtekintő vezérlő aktiválásával nyitható meg. Keressen és lapozzon a klinikák között; egy klinika lépésenként egyszer számít.","Az Első dátum a legkorábbi ismert közvetlen elérés. A Bizonyíték dátuma az inferált mérföldkövet alátámasztó későbbi esemény. Az inferált lépés első dátuma ismeretlen marad; az üres dátum nem „ma”.","A bizonyítékalap Hívás, Előzmény, Állapot, Származtatott vagy Jelenlegi. A csak állapotban lévő megerősítés dátum nélkül is közvetlenül számíthat. A származtatás csak riportmérföldkövet támogat: nem hoz létre hívást, Status List-bejegyzést, e-mailt, időbélyeget vagy automatizmust.","A következtetés alátámasztott előzményeket pótolhat, beleértve a szerződéses lépéseket az ág igazolása után. Hiányzó válaszból nem talál ki ágat. A kifejezett „másik/mérlegeli” nem válik automatikusan aláírási szándékká.","A közvetlen szám aktuális, dátum nélküli állapotmegerősítést is tartalmazhat. A közvetlen nem inferáltat jelent, nem feltétlenül időbélyegzettet."],
    "exceptions-quality":["A kivételcsoportok a kiválasztott kohorszra vonatkoznak, és egymással, valamint mérföldkövekkel átfedhetnek. Nem kizáró kategóriák és nem összeadható veszteségek. A minősítetlen, elutasított, tartósan távol, hibás és nem működő szám az aktuális leképezett állapotból származik.","A Nem elérhető legalább öt egymást követő, answeredAt nélküli busy/no_answer sikertelen kimenő próbát, valamint az aktív tartós távollétet tartalmazza. A hívási szabály a visszatérési dátum után is önállóan érvényes lehet.","Az Elutasított az első ismert megerősítést és a hat naptári hónappal későbbi visszatérési dátumot mutatja. Ez tájékoztató, nem ütemez követést és nem módosít jogosultságot.","Az opcionális távolléti dátumkérdés érvényes beállított dátumot használ. E napon vagy később a klinika kikerül a Távollétből és a Nem elérhető távollétből eredő részéből. A Status List nem módosul, hívás nem jön létre. Az Eszkalált állapothoz nincs jóváhagyott forrás, jelenleg nem mérjük.","A nyolc minőségi adat a teljes jogosult Missiont vizsgálja, nem csak a szűrt időszakot, és nem összeadható egyedi klinikaszám: klinikák, kohorsz, próbálkozás nélkül, előzetes bizonyíték, klinikához nem rendelt hívás, duplikált beiratkozás, csak állapot, ismeretlen ajánlatválasz.","Próbálkozás nélkül: nincs jogosult kimenő bizonyíték. Az előzetes régi vagy korábbi naplókat jelez. Az árva hívás nem oldható fel klinikára. A duplikált beiratkozás többletsor. A csak állapothoz nincs előzmény, ezért nincs kitalált dátum. Az ismeretlen ajánlatnál van együttműködés, de egyik ág sem igazolt."],
    configuration:["Nyissa meg a Bizonyíték-leképezést és használja a négy lapot: Kapcsolat és megállapodás, Szerződés, Együttműködés és anyagok, Kivételek. Válasszon forrást, majd keressen címke vagy lépésazonosító szerint.","Adjon hozzá tényleges pozitív választásokat. Egy forrás több választása VAGY. A kiválasztott címke eltávolítható; az üres forrás nem mért, nem nulla. A pozitív választ válassza, ne általános kérdésfejlécet vagy olyan közös kulcsot, amely negatív választ is jelölhet.","Az elfogadott, el nem fogadott és egyéb ajánlatválasz eltérő jelentésű. Az elfogadott támogatja a Szerződést szeretne és az Alá szeretné írni lépést; a kifejezetten el nem fogadott a külön szerződés nélküli ágat; az egyéb nem elfogadás és nem aláírási szándék.","Az anyagokhoz mindhárom forrás együtt szükséges (ÉS); forráson belül a választások VAGY kapcsolatban állnak. A Kivételek lapon opcionális visszatérési dátum kérdés állítható be.","A piszkozatok lapváltás és keresés közben megmaradnak. A Leképezés mentése csak a konfigurációt menti, az értelmezést változtatja, nem az előzményeket, Status Listet, hívásokat vagy automatizmust. Olvasási jogosultság nem szerkeszthet. A pontos MPN-javaslat csak mentett konfiguráció hiányában jelenik meg; meglévő mentést nem cserél le automatikusan.","19 állítható forrás van. A régi „Együttműködik (kifejezett igen)” mentve maradhat, de a jelenlegi szerződéses ágat nem vezérli. A törölt ID-k áttekinthetők maradnak, a számítás figyelmen kívül hagyja őket."],
    sources:["A leírások segítenek a megfelelő Mission-elemek kiválasztásában. A megjelenített nevek a riport jelenlegi pontos címkéi.","Kapcsolat és megállapodás: a Minősített pozitív minősítést, az Együttműködés elfogadva kifejezett beleegyezést jelent.","Ajánlatválaszok: elfogadott a kifejezett elfogadás; el nem fogadott a kifejezett elutasítás; egyéb a támogatott, ettől eltérő válasz.","Szerződésmenet: e-mail, elküldött, kézbesített, visszaküldött, ellenőrzött a megfelelő Status List-megerősítés, nem a külső e-mail kézbesítése.","Együttműködés: a szerződés nélküli aktív megerősítéshez beleegyezés és kifejezetten el nem fogadott ajánlat szükséges. A régi kifejezett igen már nem használatos.","Anyagok: az információs anyagok, várótermi szórólapok és várandóskönyvek a három kötelező megerősítés ugyanazon beiratkozásban.","Kivételek: minősítetlen, elutasított, távol, hibás szám és nem működő szám aktuális állapot, nem egymást követő veszteség."],
    "interpret-export":["Először ellenőrizze a kohorszt: időszak és ajánlási szűrő. Az időszak az első jogosult próbálkozás alapján választ; a Hozzárendelt a teljes Mission aktuális hozzárendelése.","Az útvonalakat külön olvassa. A fő útvonal kapcsolat és szerződés; a szerződés nélküli külön, kifejezett válaszág. Az Együttműködik a két igazolt minta deduplikált VAGY uniója. Az anyagok további háromtagú ÉS feltétel.","Összesen = Közvetlen + Következtetett. Az „előzőhöz képest” közvetlen elődjét használja: Hozzárendeltnek nincs elődje; Felhívva/Hozzárendelt; Elérve/Felhívva; Minősített/Elérve; Együttműködés/Minősített; Szerződést szeretne és Szerződés nélkül/Együttműködés; E-mail/Szerződést szeretne; Aláírná/E-mail; Elküldve/Aláírná; Kézbesítve/Elküldve; Visszaküldve/Kézbesítve; Ellenőrizve/Visszaküldve; Együttműködik/Együttműködés; Anyagok/Együttműködik. A „minősítettekből” nevezője Minősített, kivéve a Hozzárendeltet.","Hiányzó vagy nulla nevező kötőjel. A százalék 100 fölé kerülhet; a későbbi lépésben több klinika lehet történeti mérföldkövek és inferencia miatt. Ez nem szigorú lemorzsolódási arány. Az ágakat soha ne adjuk össze vagy vonjuk ki az összesített eredményhez.","A sraffozott/nem mért érték hiányzó leképezést vagy nem mérhető lépést jelez; a mért nulla azt, hogy a szabály nem talált klinikát. Következtetés előtt ellenőrizze a leképezést, ismeretlen ajánlatot és minőségi jelzéseket.","CSV/XLSX a szűrt szerverjelentést és klinikai bizonyítékot exportálja, nem a nem mentett piszkozatot. A leképezés módosítása újraértelmezi az adatot, de nem írja át az előzményt.","Szemléltető hipotetikus példa, nem valódi Mission-adat: 8 klinika szerződéses, 5 szerződés nélküli együttműködési feltételt teljesít, közülük 2 mindkettőt. Az összesített szám 11 (8 + 5 − 2), nem 13. Ha 7-nél mindhárom anyag megerősített, az anyagcsomag 7.","Következtetés megosztása előtt ellenőrizze a kohorszt, ágat, együttműködési és anyagfeltételeket, közvetlen/következtetett bizonyítékokat, dátumokat és minőséget. Az útmutató nem állítja a bevezetés állapotát."],
  }, stages:en.stages,sources:en.sources,exceptions:en.exceptions,
};

const ro: HelpDraft = {
  ...en,title:"INDEXUS Fluxul misiunii · ghid practic",intro:"Ghid practic pentru semnificația numărului de clinici, dovezi și interpretarea sigură a ramurilor.",close:"Închide ghidul",
  chapters:{scope:"Domeniu și cohortă","contact-contract":"Contact și contract",combined:"Rezultate combinate",evidence:"Dovezi clinică","exceptions-quality":"Excepții și calitate",configuration:"Configurarea dovezilor",sources:"Toate sursele de mapare","interpret-export":"Interpretare și export"},
  content:{
    scope:["Raportul numără clinici Mission distincte o singură dată pentru fiecare etapă, nu rânduri de înscriere, contacte sau apeluri. Înscrierile duplicate sunt raportate separat la calitatea datelor.","Accesul este limitat la țările permise contului. Filtrul de recomandare selectează în plus clinicile recomandate, nerecomandate sau toate clinicile eligibile.","Perioada selectează clinicile după data primei încercări eligibile de ieșire, reale sau istorice, în fusul Europe/Bratislava. Nu filtrează ulterior fiecare etapă după dată: reperele pot fi înainte sau după perioadă. Este o cohortă, nu evenimentele din perioadă sau o fotografie la finalul ei.","Alocate este diferit: numără clinicile alocate în prezent din întreaga misiune eligibilă, independent de perioadă și respectând țara și recomandarea. Nu este etapă de conversie și nici numărul clinicilor neapelate.","Dovezile vechi pentru prima încercare pot fi provizorii când lipsesc datele expedierii. Verificați indicatorii de calitate și dovezile clinicii la compararea perioadelor."],
    "contact-contract":["Traseul principal: Apelată → Contactată → Calificată → De acord cu colaborarea → Dorește contract → E-mail cu propunerea trimis → Dorește să semneze → Contract trimis → Contract livrat medicului → Contract returnat → Contract validat.","Apelată folosește prima încercare eligibilă de ieșire. Contactată cere apel asociat, oră de răspuns și durată pozitivă. Dovedește un apel răspuns tehnic, nu că medicul a răspuns sau că a avut loc o conversație.","Calificată și De acord provin din confirmările Status List mapate. Dorește contract cere acord și un răspuns acceptat sau alt răspuns eligibil dovedit. Răspunsul lipsă este necunoscut, nu „neacceptat”.","E-mail, trimis, livrat, returnat și validat sunt confirmări Status List. E-mailul și trimiterea nu dovedesc livrarea SMTP sau citirea; reconcilierea operațională este separată.","Fără contract este o ramură separată: aceeași înscriere trebuie să aibă acord și o propunere explicit neacceptată. Acordul singur nu o dovedește. Nu este un contract eșuat și nici succes de colaborare de sine stătător.","Dorește să semneze cere acord și propunere acceptată. Dovezile ulterioare susținute pot deduce repere contractuale lipsă doar după dovedirea ramurii. Răspunsul explicit „altul/în analiză” nu înseamnă automat dorință de semnare.","Reperul păstrează prima atingere cunoscută chiar după o schimbare ulterioară; nu descrie neapărat starea Status List curentă."],
    combined:["Colaborează unește două tipare alternative de dovezi din aceeași înscriere, într-o uniune SAU la nivel de clinică. Colaborarea contractuală cere validat + acord + răspuns acceptat sau altul. Ramura fără contract cere confirmare activă fără contract + acord + propunere explicit neacceptată.","Clinica ce îndeplinește oricare tipar se numără o singură dată. Nu adunați ramurile: aceeași clinică poate îndeplini ambele, iar rezultatul este deduplicat.","Pachetul de materiale cere colaborare deja atinsă în aceeași înscriere și toate cele trei confirmări simultan: materiale informative, pliante de sală de așteptare și broșuri de sarcină trimise. Colaborarea nu trebuie să fie încă activă atunci. Posterul este opțional.","Prima atingere istorică se păstrează. Rezultatul combinat arată că tiparul a existat cândva, nu neapărat că clinica colaborează acum."],
    evidence:["Deschideți dovezile clinicii activând o etapă din grafic sau controlul de dovezi din tabel. Căutați și parcurgeți paginile; clinica se numără o dată per etapă.","Prima dată este cea mai timpurie dată cunoscută a atingerii directe. Data dovezii este evenimentul ulterior care susține o inferență. O etapă inferată păstrează prima dată necunoscută; lipsa datei nu înseamnă „astăzi”.","Baza dovezii este Apel, Istoric, Stare, Derivat sau Curent. Confirmarea doar în stare poate fi numărată direct fără dată. Derivarea susține numai un reper de raportare: nu creează apel, Status List, e-mail, dată istorică sau automatizare.","Inferența poate completa predecesori susținuți, inclusiv repere contractuale după dovedirea ramurii. Nu inventează o ramură dintr-un răspuns lipsă. „Altul/în analiză” explicit nu devine automat Dorește să semneze.","Un număr direct poate include starea curentă fără istoric datat. Direct înseamnă neinferat, nu neapărat cu marcaj temporal."],
    "exceptions-quality":["Excepțiile sunt limitate la cohorta selectată și se pot suprapune între ele și cu reperele. Nu sunt categorii mutual exclusive și nu reprezintă pierderi aditive. Necalificată, Refuzată, Absență pe termen lung, Număr incorect și Număr nefuncțional provin din stări mapate curente.","Indisponibilă include cel puțin cinci încercări consecutive busy/no_answer fără answeredAt și absența activă pe termen lung. Regula independentă a apelurilor poate continua chiar dacă data de revenire elimină componenta absenței.","Refuzată afișează prima confirmare cunoscută și data revenirii după șase luni calendaristice. Data este informativă, nu programează urmărire și nu schimbă automat eligibilitatea.","Întrebarea opțională folosește o dată de revenire validă configurată. La sau după dată, clinica este scoasă din Absentă și din componenta Indisponibilă derivată din absență. Status List nu se modifică și nu se creează apeluri. Escaladată nu are sursă aprobată și nu este măsurată.","Cei opt indicatori de calitate acoperă întreaga misiune eligibilă, nu doar perioada filtrată, și nu sunt totaluri aditive de clinici: clinici, cohortă, fără încercare, provizoriu, apeluri fără clinică, înscrieri duplicate, doar stare, propunere necunoscută.","Fără încercare înseamnă lipsa dovezii de ieșire. Provizoriu indică dovezi vechi/de rezervă. Apelurile orfane nu au clinică rezolvabilă. Duplicate numără rândurile suplimentare. Doar stare nu are istoric, deci data nu este inventată. Propunere necunoscută înseamnă acord fără ramură dovedită."],
    configuration:["Deschideți Maparea dovezilor și folosiți cele patru file: Contact și acord, Contract, Colaborare și materiale, Excepții. Alegeți o sursă și căutați elementul Status List după etichetă sau ID-ul etapei.","Adăugați opțiuni pozitive reale. Mai multe selecții într-o sursă înseamnă SAU. Cipurile selectate se elimină; o sursă goală este nemăsurată, nu zero. Alegeți răspunsul pozitiv real, nu titlul generic sau o cheie comună care poate reprezenta și un răspuns negativ.","Răspunsurile acceptat, neacceptat și altul au semnificații diferite. Acceptat susține Dorește contract și Dorește să semneze; neacceptat explicit susține ramura Fără contract; altul este eligibil, dar nu înseamnă acceptare sau dorință de semnare.","Materialele cer toate cele trei surse simultan (ȘI); opțiunile din fiecare sursă rămân SAU. În Excepții se poate seta o întrebare opțională pentru data revenirii.","Selecțiile păstrate rămân între file și căutări. Salvarea mapării salvează doar configurația și schimbă interpretarea analitică, nu istoricul, Status List, apelurile sau automatizările. Rolurile doar cu citire nu pot edita. Sugestiile exacte MPN apar doar dacă nu există configurație salvată; una existentă nu este înlocuită automat.","Sunt 19 surse configurabile. Sursa istorică „Colaborează (da explicit)” poate rămâne salvată, dar nu mai controlează ramura contractuală. ID-urile șterse rămân pentru revizuire și sunt ignorate la calcul."],
    sources:["Descrierile ghidează alegerea elementelor Mission. Numele afișate sunt etichetele exacte existente în raport.","Contact și acord: Calificată este rezultatul pozitiv; De acord este acord explicit pentru colaborare.","Răspunsuri: acceptat este acceptare explicită; neacceptat este refuz explicit; altul este un răspuns eligibil distinct.","Progres contract: E-mail, Trimis, Primit, Returnat și Validat sunt confirmările Status List corespunzătoare, nu dovada livrării e-mailului.","Colaborare: confirmarea activă fără contract cere acord și ofertă explicit neacceptată. Sursa veche da explicit este doar istorică.","Materiale: materialele informative, pliantele și broșurile de sarcină sunt cele trei confirmări obligatorii în aceeași înscriere după tiparul de colaborare.","Excepții: necalificată, refuzată, absentă, număr incorect și nefuncțional sunt stări mapate curente, nu pierderi secvențiale."],
    "interpret-export":["Verificați mai întâi cohorta: perioada și filtrul de recomandare. Perioada selectează prima încercare eligibilă; Alocate este alocarea curentă a întregii misiuni.","Citiți traseele separat. Traseul principal este contact și contract; Fără contract este o ramură independentă cu răspuns explicit. Colaborează este uniunea SAU deduplicată a tiparelor dovedite. Materialele adaugă condiția ȘI pentru trei confirmări.","Total = Direct + Inferat. „față de precedent” folosește predecesorul imediat: Alocate nu are predecesor; Apelată/Alocate; Contactată/Apelată; Calificată/Contactată; De acord/Calificată; Dorește contract și Fără contract/De acord; E-mail/Dorește contract; Dorește să semneze/E-mail; Trimis/Dorește să semneze; Primit/Trimis; Returnat/Primit; Validat/Returnat; Colaborează/De acord; Materiale/Colaborează. „din calificate” folosește Calificată ca numitor, cu excepția Alocate.","Numitorul lipsă sau zero se afișează cu liniuță. Procentele pot depăși 100%, iar etapele ulterioare pot avea mai multe clinici din cauza reperelor istorice și inferenței între cohorte. Nu sunt pierderi secvențiale. Nu adunați sau scădeți ramurile pentru rezultatul combinat.","Valoarea hașurată/nemăsurată indică sursă neconfigurată ori etapă nemăsurabilă; zero măsurat indică nicio clinică eligibilă. Verificați maparea și indicatorii de calitate înainte de concluzii.","CSV/XLSX exportă raportul serverului filtrat și dovezile clinicilor, nu schițele nesalvate. Schimbarea mapării reinterpretează analiza, nu rescrie istoricul.","Exemplu ipotetic ilustrativ, nu date reale: 8 clinici îndeplinesc regula contractuală, 5 regula fără contract, iar 2 sunt comune. Colaborează combinat este 11 (8 + 5 − 2), nu 13. Dacă 7 au toate cele trei confirmări, pachetul de materiale este 7.","Înainte de a comunica o concluzie verificați cohorta, ramura, regulile de colaborare și materiale, ponderea directă/inferată, datele și calitatea mapării. Ghidul nu declară starea lansării în producție."],
  }, stages:en.stages,sources:en.sources,exceptions:en.exceptions,
};

const it: HelpDraft = {
  ...en,title:"INDEXUS Funnel Mission · guida pratica",intro:"Guida pratica al significato dei conteggi delle cliniche, alle prove e alla lettura sicura dei rami.",close:"Chiudi la guida",
  chapters:{scope:"Ambito e coorte","contact-contract":"Contatto e contratto",combined:"Esiti combinati",evidence:"Prove della clinica","exceptions-quality":"Eccezioni e qualità",configuration:"Configura le prove",sources:"Tutte le fonti di mappatura","interpret-export":"Leggere ed esportare il funnel"},
  content:{
    scope:["Il report conta entità cliniche Mission distinte una volta per fase, non righe di iscrizione, contatti o chiamate. Le iscrizioni duplicate sono riportate separatamente nella qualità dei dati.","L'accesso è limitato ai paesi autorizzati per l'account. Il filtro referral seleziona ulteriormente cliniche referral, non-referral o tutte le cliniche idonee.","Il periodo seleziona le cliniche in base alla data del primo tentativo outbound idoneo, reale o legacy, nel fuso Europe/Bratislava. Non filtra per data i traguardi successivi: possono essere avvenuti prima o dopo il periodo. È una coorte, non gli eventi nel periodo né uno snapshot a fine periodo.","Assegnate è diverso: conta le cliniche attualmente assegnate nell'intera Mission idonea, indipendentemente dal periodo e rispettando paese e referral. Non è una fase di conversione né il numero di cliniche mai chiamate.","Le prove dei primi tentativi legacy possono essere provvisorie se manca la prova di dispatch. Prima di confrontare periodi controllare qualità e prove della clinica."],
    "contact-contract":["Percorso principale: Chiamata → Raggiunta → Qualificata → Accetta la collaborazione → Vuole un contratto → Email con proposta inviata → Vuole firmare → Contratto inviato → Consegnato al medico → Restituito → Convalidato.","Chiamata usa il primo tentativo outbound idoneo. Raggiunta richiede una chiamata collegata con answeredAt e durata positiva. Prova una risposta tecnica, non che abbia risposto il medico o che ci sia stata una conversazione.","Qualificata e Accetta derivano dalle conferme Status List mappate. Vuole un contratto richiede accordo e una risposta accettata o altra risposta idonea provata. Una risposta mancante è sconosciuta, non “non accettata”.","Email, inviato, consegnato, restituito e convalidato sono conferme Status List. Email e inviato non provano la consegna SMTP o la lettura; la riconciliazione operativa è separata.","Senza contratto è un ramo distinto: la stessa iscrizione deve avere accordo e una proposta esplicitamente non accettata. Il solo accordo non lo dimostra. Non è un insuccesso contrattuale né un successo di collaborazione da solo.","Vuole firmare richiede accordo e proposta accettata. Prove contrattuali successive supportate possono inferire traguardi precedenti mancanti solo dopo aver provato il ramo. “Altro/ci sta pensando” esplicito non significa automaticamente voler firmare.","Il traguardo conserva la prima data di raggiungimento nota anche dopo un cambiamento successivo; non rappresenta necessariamente lo stato Status List attuale."],
    combined:["Collabora unisce due modelli alternativi di prova della stessa iscrizione in un'unione OR a livello di clinica. La collaborazione con contratto richiede convalidato + accordo + risposta accettata o altra. Il ramo senza contratto richiede attivo senza contratto + accordo + proposta esplicitamente non accettata.","Una clinica che soddisfa uno dei modelli è conteggiata una volta. Non sommare i rami: la stessa clinica può soddisfarli entrambi e il risultato combinato è deduplicato.","Il pacchetto materiali richiede collaborazione già raggiunta sulla stessa iscrizione e tutte e tre le conferme insieme: materiali informativi, opuscoli sala d'attesa e libretti gravidanza inviati. La collaborazione non deve essere ancora attiva quando arrivano le conferme materiali. Il poster è facoltativo.","La prima conquista storica è conservata. Un esito combinato indica che il modello è esistito, non necessariamente che la clinica collabori ancora."],
    evidence:["Aprire le prove della clinica attivando una fase del grafico o il controllo nella tabella. Cercare e sfogliare le cliniche; ogni clinica conta una volta per fase.","Prima data è la prima data nota di conseguimento diretto. Data prova è l'evento successivo che supporta un'inferenza. Una fase inferita mantiene ignota la prima data; una data vuota non significa mai “oggi”.","La base della prova è Chiamata, Cronologia, Stato, Derivata o Corrente. Una conferma solo nello stato può essere conteggiata direttamente senza data. La derivazione supporta solo un traguardo di report: non crea chiamate, voci Status List, email, date storiche o automazioni.","L'inferenza può completare predecessori supportati, anche traguardi contrattuali dopo aver provato il ramo. Non inventa un ramo da una risposta assente. “Altro/ci sta pensando” non diventa automaticamente Vuole firmare.","Il conteggio diretto può includere uno stato corrente senza cronologia datata. Diretto significa non inferito, non necessariamente con data."],
    "exceptions-quality":["Le eccezioni riguardano la coorte selezionata e possono sovrapporsi tra loro e ai traguardi. Non sono categorie esclusive né perdite additive. Non qualificata, Rifiutata, Assenza prolungata, Numero errato e Non funzionante derivano da stati mappati correnti.","Non raggiungibile include almeno cinque tentativi outbound consecutivi busy/no_answer senza answeredAt e anche l'assenza prolungata attiva. La regola indipendente delle chiamate può ancora valere dopo che la data di rientro rimuove la componente dell'assenza.","Rifiutata mostra la prima conferma nota e una data di rientro dopo sei mesi di calendario. È informativa: non pianifica un follow-up né cambia automaticamente l'idoneità.","La domanda opzionale usa una data di rientro valida configurata. Da quel giorno la clinica esce da Assente e dalla componente di Non raggiungibile dovuta all'assenza. Non modifica Status List né crea chiamate. Escalation non ha una fonte approvata e attualmente non è misurata.","Gli otto indicatori di qualità coprono l'intera Mission idonea, non solo il periodo filtrato, e non sono totali additivi di cliniche: cliniche, coorte, senza tentativo, prova provvisoria, chiamate senza clinica, iscrizioni duplicate, solo stato, proposta sconosciuta.","Senza tentativo significa nessuna prova outbound idonea. Provvisoria indica prove legacy/di ripiego o log precedenti. Le chiamate orfane non hanno clinica risolvibile. I duplicati sono righe extra. Solo stato non ha cronologia, quindi la data non è inventata. Proposta sconosciuta significa accordo senza ramo provato."],
    configuration:["Aprire Mappatura prove e usare le quattro schede: Contatto e accordo, Contratto, Collaborazione e materiali, Eccezioni. Scegliere una fonte e cercare nella Status List per etichetta o ID fase.","Aggiungere scelte positive reali. Più elementi per fonte significano OR. Le selezioni possono essere rimosse; una fonte vuota è non misurata, non zero. Scegliere la risposta positiva effettiva, non un'intestazione generica o una chiave condivisa anche da una scelta negativa.","Accettata, non accettata e altra risposta hanno significati distinti. Accettata supporta Vuole un contratto e Vuole firmare; non accettata supporta il ramo Senza contratto; altra è idonea ma non equivale ad accettazione o volontà di firmare.","Per i materiali servono tutte e tre le fonti insieme (AND); le alternative in ciascuna fonte restano OR. In Eccezioni è possibile scegliere una domanda data facoltativa per il rientro dall'assenza.","Le selezioni in bozza restano tra schede e ricerche. Salva mappatura salva solo la configurazione e cambia l'interpretazione analitica, non cronologia, Status List, chiamate o automazioni. I ruoli di sola lettura non possono modificare. I suggerimenti MPN esatti compaiono solo senza configurazione salvata; una configurazione esistente non viene sostituita automaticamente.","Esistono 19 fonti configurabili. La vecchia fonte “Collabora (sì esplicito)” può restare salvata, ma non controlla più il ramo contrattuale. Gli ID eliminati restano visibili per revisione e sono ignorati dal calcolo."],
    sources:["Le descrizioni aiutano a scegliere gli elementi Mission corretti. I nomi mostrati sono le etichette localizzate esatte del report.","Contatto e accordo: Qualificata indica un esito positivo; Accetta è accordo esplicito alla collaborazione.","Risposte proposta: accettata è accettazione esplicita; non accettata è rifiuto esplicito; altra è una risposta idonea distinta.","Avanzamento contratto: Email, Inviato, Ricevuto, Restituito e Convalidato sono le conferme Status List, non prova di consegna email.","Collaborazione: la conferma attiva senza contratto richiede accordo e proposta esplicitamente non accettata. Il vecchio sì esplicito è solo legacy.","Materiali: materiali informativi, opuscoli sala d'attesa e libretti gravidanza sono le tre conferme obbligatorie sulla stessa iscrizione dopo un modello di collaborazione.","Eccezioni: non qualificata, rifiutata, assente, numero errato e non funzionante sono stati correnti, non perdite sequenziali."],
    "interpret-export":["Controllare prima la coorte: periodo e referral. Il periodo seleziona dal primo tentativo outbound idoneo; Assegnate è l'assegnazione corrente dell'intera Mission.","Leggere i percorsi separatamente. Il principale è contatto e contratto; Senza contratto è un ramo indipendente con risposta esplicita. Collabora è l'unione OR deduplicata dei modelli provati. I materiali aggiungono l'AND delle tre conferme.","Totale = Diretto + Inferito. “rispetto al precedente” usa il predecessore immediato: Assegnate non ne ha; Chiamata/Assegnate; Raggiunta/Chiamata; Qualificata/Raggiunta; Accetta/Qualificata; Vuole contratto e Senza contratto/Accetta; Email/Vuole contratto; Vuole firmare/Email; Inviato/Vuole firmare; Ricevuto/Inviato; Restituito/Ricevuto; Convalidato/Restituito; Collabora/Accetta; Materiali/Collabora. “delle qualificate” usa Qualificata come denominatore, tranne Assegnate.","Denominatore mancante o zero è un trattino. Le percentuali possono superare 100%; fasi successive possono avere più cliniche per traguardi storici e inferenze tra coorti. Non sono perdite sequenziali. Non sommare o sottrarre i rami per il totale combinato.","Un valore tratteggiato/non misurato indica fonte non configurata o fase non misurabile; zero misurato significa nessuna clinica idonea. Controllare mappatura e qualità prima di concludere.","CSV/XLSX esporta il report server filtrato con prove delle cliniche, non le bozze di mappatura non salvate. Cambiare la mappatura ricalcola l'interpretazione, non riscrive la cronologia.","Esempio ipotetico illustrativo, non dati reali Mission: 8 cliniche soddisfano la regola contrattuale, 5 quella senza contratto e 2 sono comuni. Collabora combinato è 11 (8 + 5 − 2), non 13. Se 7 hanno tutte le conferme materiali, il pacchetto è 7.","Prima di condividere una conclusione verificare coorte, ramo, regole di collaborazione/materiali, prove dirette/inferite, date e qualità della mappatura. La guida non dichiara lo stato del rilascio in produzione."],
  }, stages:en.stages,sources:en.sources,exceptions:en.exceptions,
};

const de: HelpDraft = {
  ...en,title:"INDEXUS Mission-Trichter · Leitfaden",intro:"Praktischer Leitfaden zur Bedeutung der Klinikzahlen, Nachweise und sicheren Interpretation der Zweige.",close:"Leitfaden schließen",
  chapters:{scope:"Umfang und Kohorte","contact-contract":"Kontakt und Vertrag",combined:"Kombinierte Ergebnisse",evidence:"Kliniknachweise","exceptions-quality":"Ausnahmen und Qualität",configuration:"Nachweise konfigurieren",sources:"Alle Zuordnungsquellen","interpret-export":"Trichter lesen und exportieren"},
  content:{
    scope:["Der Bericht zählt pro Schritt eindeutige Mission-Kliniken einmal, nicht Einschreibungszeilen, Kontakte oder Anrufe. Zusätzliche Einschreibungen werden separat in der Datenqualität ausgewiesen.","Der Zugriff ist auf die für Ihr Konto zulässigen Länder beschränkt. Der Empfehlungsfilter wählt zusätzlich empfohlene, nicht empfohlene oder alle berechtigten Kliniken.","Der Zeitraum wählt Kliniken anhand des Datums ihres ersten zulässigen realen oder älteren ausgehenden Versuchs in der Zeitzone Europe/Bratislava aus. Spätere Meilensteine werden nicht nach Datum gefiltert; sie können vor oder nach dem Zeitraum liegen. Dies ist eine Kohorte, keine Ereignisliste des Zeitraums und kein historischer Endstand.","Zugewiesen ist davon unabhängig: Es zählt aktuell zugewiesene Kliniken der gesamten berechtigten Mission, unabhängig vom Zeitraum und unter Beachtung von Land und Empfehlungsfilter. Es ist weder ein Konversionsschritt noch die Zahl unangerufener Kliniken.","Ältere Nachweise des ersten Versuchs können bei fehlendem Dispatch-Nachweis vorläufig sein. Prüfen Sie Qualität und Kliniknachweise, bevor Sie Zeiträume vergleichen."],
    "contact-contract":["Der Hauptpfad lautet: Angerufen → Erreicht → Qualifiziert → Zusammenarbeit zugestimmt → Möchte Vertrag → E-Mail mit Vertragsangebot gesendet → Möchte unterschreiben → Vertrag gesendet → Dem Arzt zugestellt → Vertrag zurückgesendet → Vertrag validiert.","Angerufen verwendet den frühesten zulässigen ausgehenden Versuch. Erreicht erfordert einen verknüpften Anruf mit answeredAt und positiver Dauer. Das belegt eine technisch angenommene Verbindung, nicht dass der Arzt abnahm oder ein Gespräch stattfand.","Qualifiziert und Zustimmung stammen aus zugeordneten Status-List-Bestätigungen. Möchte Vertrag verlangt Zustimmung und eine nachgewiesene angenommene oder andere zulässige Angebotsantwort. Eine fehlende Antwort ist unbekannt, nicht „abgelehnt“.","E-Mail, gesendet, zugestellt, zurückgesendet und validiert sind die jeweiligen Status-List-Bestätigungen. E-Mail und gesendet belegen keine SMTP-Zustellung oder das Lesen; die operative Prüfung erfolgt separat.","Ohne Vertrag ist ein eigener Zweig: dieselbe Einschreibung muss Zustimmung und ein ausdrücklich nicht angenommenes Angebot enthalten. Zustimmung allein genügt nicht. Es bedeutet weder Vertragsfehler noch alleinigen Kooperationserfolg.","Möchte unterschreiben erfordert Zustimmung und ein angenommenes Angebot. Unterstützte spätere Vertragsnachweise können fehlende frühere Vertragsmeilensteine ableiten, jedoch erst nach Nachweis des Vertragszweigs. Eine ausdrückliche Antwort „sonstiges/überlegt“ bedeutet nicht automatisch Unterschriftsabsicht.","Der Meilenstein bewahrt die früheste bekannte Erreichung auch nach späterer Änderung. Er beschreibt nicht zwingend den aktuellen Status-List-Zustand."],
    combined:["Kooperiert bildet die ODER-Vereinigung zweier alternativer Nachweismuster derselben Einschreibung auf Klinikebene. Vertragliche Kooperation erfordert validiert + zugestimmt + angenommenes oder anderes Angebot. Der Zweig ohne Vertrag erfordert aktive Bestätigung ohne Vertrag + Zustimmung + ausdrücklich nicht angenommenes Angebot.","Eine Klinik, die eines der Muster erfüllt, zählt einmal. Addieren Sie die Zweige niemals: Eine Klinik kann beide erfüllen; das Ergebnis ist dedupliziert. Die einzelnen Zweige dienen als Kontext, nicht als Summanden.","Das Materialpaket erfordert bereits erreichte Kooperation derselben Einschreibung und gleichzeitig alle drei Bestätigungen: Informationsmaterial, Wartezimmer-Flyer und Schwangerschaftsbroschüren gesendet. Die Kooperation muss beim Erreichen der Materialbestätigungen nicht mehr aktiv sein. Ein Poster ist optional.","Der historische erste Zeitpunkt bleibt erhalten. Ein kombiniertes Ergebnis zeigt, dass das Muster irgendwann vorlag, nicht zwingend eine aktuelle Kooperation."],
    evidence:["Kliniknachweise öffnen Sie durch Aktivieren eines Diagrammschritts oder der Nachweisaktion in der Tabelle. Kliniken können gesucht und seitenweise durchgesehen werden; pro Schritt zählt jede Klinik einmal.","Erstes Datum ist das früheste bekannte direkte Erreichen. Nachweisdatum ist das spätere unterstützende Ereignis für einen abgeleiteten Meilenstein. Bei abgeleiteten Meilensteinen bleibt das erste Datum unbekannt; ein leeres Datum bedeutet niemals „heute“.","Nachweisgrund ist Anruf, Verlauf, Status, Abgeleitet oder Aktuell. Eine reine Statusbestätigung kann direkt ohne Datum zählen. Abgeleitete Nachweise unterstützen nur einen Berichtsmeilenstein: Sie erzeugen weder Anruf noch Status-List-Eintrag, E-Mail, historisches Datum oder Automatisierung.","Ableitung kann unterstützte Vorgänger ergänzen, auch Vertragsmeilensteine nach Nachweis des Zweigs. Sie erfindet keinen Zweig aus einer fehlenden Antwort. „Sonstiges/überlegt“ wird nicht automatisch zu Möchte unterschreiben.","Direkte Zahlen können aktuelle Statusbestätigungen ohne datierten Verlauf enthalten. Direkt bedeutet nicht abgeleitet, nicht zwingend mit Zeitstempel."],
    "exceptions-quality":["Ausnahmen gelten für die ausgewählte Kohorte und können sich untereinander und mit Meilensteinen überschneiden. Sie sind weder gegenseitig ausschließend noch addierbare Verluste. Nicht qualifiziert, Ablehnung, Langzeitabwesenheit, falsche und nicht funktionierende Nummer stammen aus aktuellen zugeordneten Statuswerten.","Nicht erreichbar umfasst mindestens fünf aufeinanderfolgende erfolglose ausgehende Versuche mit busy/no_answer ohne answeredAt sowie aktive Langzeitabwesenheit. Die unabhängige Anrufregel kann weiterhin gelten, wenn das Rückkehrdatum den Abwesenheitsanteil entfernt.","Abgelehnt zeigt die erste bekannte Bestätigung und ein Rückkehrdatum sechs Kalendermonate später. Dieses Datum informiert lediglich; es plant keinen Rückruf und ändert die Berechtigung nicht automatisch.","Die optionale Abwesenheitsfrage verwendet ein gültiges konfiguriertes Rückkehrdatum. Am oder nach diesem Datum entfällt die Klinik bei Abwesend und der abwesenheitsbedingte Anteil von Nicht erreichbar. Status List wird nicht geändert und Anrufe werden nicht erzeugt. Eskaliert hat keine genehmigte Quelle und wird derzeit nicht gemessen.","Die acht Qualitätswerte betreffen die gesamte berechtigte Mission, nicht nur den gefilterten Zeitraum, und sind keine addierbaren eindeutigen Klinikzahlen: Kliniken, Kohorte, ohne Versuch, vorläufig, Anrufe ohne Klinik, doppelte Einschreibungen, nur Status, unbekanntes Angebot.","Ohne Versuch bedeutet kein zulässiger ausgehender Nachweis. Vorläufig weist auf ältere/Ersatznachweise hin. Verwaiste Anrufe haben keine auflösbare Klinik. Doppelte Einschreibungen zählen Zusatzzeilen. Nur Status hat keinen Verlauf; daher wird kein Datum erfunden. Unbekanntes Angebot bedeutet Zustimmung ohne nachgewiesenen Vertragszweig."],
    configuration:["Öffnen Sie Nachweiszuordnung und verwenden Sie die vier Register: Kontakt & Zustimmung, Vertrag, Kooperation & Materialien und Ausnahmen. Wählen Sie eine Quelle und suchen Sie Status-List-Einträge nach Bezeichnung oder Schritt-ID.","Fügen Sie tatsächliche positive Auswahlwerte hinzu. Mehrere Werte in einer Quelle bedeuten ODER. Ausgewählte Chips lassen sich entfernen; eine leere Quelle ist nicht gemessen, nicht null. Wählen Sie die positive Antwort, keinen allgemeinen Fragetitel oder gemeinsamen Schlüssel, der auch eine negative Antwort bedeuten kann.","Angenommen, nicht angenommen und sonstige Antwort haben unterschiedliche Bedeutungen. Angenommen unterstützt Möchte Vertrag und Möchte unterschreiben; ausdrücklich nicht angenommen unterstützt den eigenen Zweig Ohne Vertrag; sonstig ist zulässig, aber weder Annahme noch Unterschriftsabsicht.","Für Materialien sind alle drei Quellen gemeinsam erforderlich (UND); Alternativen innerhalb einer Quelle bleiben ODER. Unter Ausnahmen kann optional eine Datumsfrage für die Rückkehr nach Abwesenheit gewählt werden.","Entwürfe bleiben beim Wechsel zwischen Registern und Suchen erhalten. Zuordnung speichern speichert nur die Konfiguration und ändert die analytische Interpretation, nicht Verlauf, Status List, Anrufe oder Automatisierung. Leseberechtigte Rollen dürfen nicht bearbeiten. Exakte MPN-Vorschläge erscheinen nur ohne gespeicherte Konfiguration; bestehende Zuordnungen werden nie automatisch ersetzt.","Es gibt 19 konfigurierbare Quellen. Die ältere Quelle „Kooperiert (explizites Ja)“ kann gespeichert bleiben, steuert aber nicht mehr den Vertragszweig. Gelöschte IDs bleiben zur Prüfung sichtbar und werden bei der Berechnung ignoriert."],
    sources:["Diese Beschreibungen helfen bei der Auswahl passender Mission-Einträge. Angezeigte Namen sind die vorhandenen exakten Berichtsbeschriftungen.","Kontakt & Zustimmung: Qualifiziert ist das positive Ergebnis; Zugestimmt ist die ausdrückliche Zustimmung zur Kooperation.","Angebotsantworten: Angenommen ist ausdrücklich akzeptiert; nicht angenommen ist ausdrücklich abgelehnt; sonstig ist eine unterstützte andere zulässige Antwort.","Vertragsfortschritt: E-Mail, gesendet, empfangen, zurückgesendet und validiert sind Status-List-Bestätigungen, kein Nachweis tatsächlicher E-Mail-Zustellung.","Kooperation: Aktive Bestätigung ohne Vertrag gehört zum Zweig ohne Vertrag und erfordert Zustimmung plus ausdrücklich nicht angenommenes Angebot. Das ältere explizite Ja ist nur historisch.","Materialien: Informationsmaterial, Wartezimmer-Flyer und Schwangerschaftsbroschüren sind die drei erforderlichen Bestätigungen derselben Einschreibung nach dem Kooperationsmuster.","Ausnahmen: Nicht qualifiziert, abgelehnt, abwesend, falsche Nummer und nicht funktionierend sind aktuelle Statuswerte, keine sequenziellen Verluste."],
    "interpret-export":["Prüfen Sie zuerst die Kohorte: Zeitraum und Empfehlungsfilter. Der Zeitraum wählt nach dem ersten zulässigen ausgehenden Versuch; Zugewiesen ist die aktuelle Zuordnung der gesamten Mission.","Lesen Sie die Pfade getrennt. Der Hauptpfad ist Kontakt und Vertrag; Ohne Vertrag ist ein unabhängiger Zweig mit ausdrücklicher Antwort. Kooperiert ist die deduplizierte ODER-Vereinigung der nachgewiesenen Muster. Materialien ergänzen die UND-Bedingung aus drei Bestätigungen.","Gesamt = Direkt + Abgeleitet. „zum vorherigen“ verwendet den unmittelbaren Vorgänger: Zugewiesen hat keinen; Angerufen/Zugewiesen; Erreicht/Angerufen; Qualifiziert/Erreicht; Zustimmung/Qualifiziert; Möchte Vertrag und Ohne Vertrag/Zustimmung; E-Mail/Möchte Vertrag; Möchte unterschreiben/E-Mail; Gesendet/Möchte unterschreiben; Empfangen/Gesendet; Zurückgesendet/Empfangen; Validiert/Zurückgesendet; Kooperiert/Zustimmung; Materialien/Kooperiert. „von qualifiziert“ verwendet Qualifiziert als Nenner, außer bei Zugewiesen.","Ein fehlender oder nullwertiger Nenner wird als Strich angezeigt. Prozente können über 100 % liegen; spätere Schritte können wegen historischer Meilensteine und Ableitungen über nicht verschachtelte Kohorten mehr Kliniken enthalten. Das sind keine strikten sequenziellen Verluste. Zweige niemals addieren oder abziehen.","Schraffiert/nicht gemessen bedeutet fehlende Zuordnung oder nicht messbarer Schritt; gemessene null bedeutet keine qualifizierende Klinik. Prüfen Sie Zuordnung und Qualitätswerte, bevor Sie Schlussfolgerungen ziehen.","CSV/XLSX exportiert den gefilterten Serverbericht einschließlich Kliniknachweisen, nicht ungespeicherte Zuordnungsentwürfe. Eine Änderung interpretiert die Analyse neu, schreibt aber keine Historie um.","Veranschaulichendes hypothetisches Beispiel, keine echten Mission-Daten: 8 Kliniken erfüllen die Vertragsregel, 5 die Regel ohne Vertrag, 2 davon beide. Kombiniert Kooperiert ergibt 11 (8 + 5 − 2), nicht 13. Haben 7 alle drei Materialbestätigungen, beträgt das Materialpaket 7.","Prüfen Sie vor einer Leistungsbewertung Kohorte, Zweig, Kooperations- und Materialbedingungen, direkt/abgeleitete Nachweise, Daten sowie Zuordnungs- und Qualitätsrisiken. Der Leitfaden behauptet keinen Produktions-Rollout-Status."],
  }, stages:en.stages,sources:en.sources,exceptions:en.exceptions,
};

const withFinalConfigNote = (guide: HelpDraft, finalParagraph: string, quality: Record<MissionFunnelQualityKey, string>, basis: Record<MissionFunnelEvidenceBasis, string>) => ({
  ...guide,
  content: { ...guide.content, configuration: [...guide.content.configuration.slice(0, -1), finalParagraph] },
  quality,
  basis,
});

const qualityEn: Record<MissionFunnelQualityKey, string> = {
  clinics:"Distinct eligible Mission clinics available after country and referral access filters.",
  cohort:"Eligible clinics whose first eligible outbound attempt falls inside the selected Bratislava-time period.",
  withoutAttempt:"Eligible clinics with no qualifying outbound attempt evidence.",
  provisional:"Cohort clinics whose first-attempt date relies on legacy or incomplete dispatch evidence.",
  orphanCalls:"Mission call records that cannot be linked to a resolvable clinic.",
  duplicateEnrollments:"Extra clinic enrollment rows beyond one enrollment per unique clinic.",
  stateOnly:"Clinics with current mapped confirmations that have no matching item history; no event date is fabricated.",
  unknownProposal:"Clinics with agreement evidence but no proven contract or no-contract proposal branch.",
};
const basisEn: Record<MissionFunnelEvidenceBasis, string> = {
  call:"Derived from qualifying call-log evidence, such as the first outbound attempt or a linked answered call.",
  history:"Supported by dated Status List confirmation history.",
  state:"Supported by current Status List state without a matching dated history event.",
  derived:"A report-only milestone inferred from later supported evidence; it creates no operational event.",
  current:"A current assignment or state, not a historical milestone.",
};
const qualitySk: Record<MissionFunnelQualityKey, string> = {
  clinics:"Jedinečné oprávnené kliniky po filtroch krajiny a odporúčania.",
  cohort:"Oprávnené kliniky s prvým oprávneným odchádzajúcim pokusom vo vybranom období Bratislavy.",
  withoutAttempt:"Oprávnené kliniky bez dôkazu oprávneného odchádzajúceho pokusu.",
  provisional:"Kliniky kohorty, ktorých prvý dátum pokusu vychádza zo staršieho alebo neúplného dôkazu odoslania.",
  orphanCalls:"Záznamy hovorov misie bez priraditeľnej kliniky.",
  duplicateEnrollments:"Nadbytočné riadky zaradenia kliník nad počet jedinečných kliník.",
  stateOnly:"Aktuálne namapované potvrdenia bez zodpovedajúcej histórie položky; dátum udalosti sa nevymýšľa.",
  unknownProposal:"Kliniky so súhlasom, ale bez preukázanej zmluvnej alebo bez-zmluvnej vetvy ponuky.",
};
const basisSk: Record<MissionFunnelEvidenceBasis, string> = {
  call:"Dôkaz z kvalifikovaných záznamov hovoru, napríklad prvý odchádzajúci pokus alebo prepojený prijatý hovor.",
  history:"Podporené dátovanou históriou potvrdení Status List.",
  state:"Podporené aktuálnym stavom Status List bez zodpovedajúcej dátovanej historickej udalosti.",
  derived:"Míľnik odvodený pre report z neskorších dôkazov; nevytvára prevádzkovú udalosť.",
  current:"Aktuálne priradenie alebo stav, nie historický míľnik.",
};
const basisCs: Record<MissionFunnelEvidenceBasis, string> = {
  call:"Důkaz z kvalifikovaných záznamů hovoru, například první odchozí pokus nebo propojený přijatý hovor.",
  history:"Podpořeno datovanou historií potvrzení Status List.",
  state:"Podpořeno aktuálním stavem Status List bez odpovídající datované historické události.",
  derived:"Milník odvozený pro report z pozdějších důkazů; nevytváří provozní událost.",
  current:"Aktuální přiřazení nebo stav, nikoli historický milník.",
};
const qualityCs: Record<MissionFunnelQualityKey, string> = {
  clinics:"Jedinečné oprávněné kliniky po filtrech země a doporučení.",
  cohort:"Oprávněné kliniky s prvním oprávněným odchozím pokusem ve zvoleném období Bratislavy.",
  withoutAttempt:"Oprávněné kliniky bez důkazu oprávněného odchozího pokusu.",
  provisional:"Kliniky kohorty, jejichž první datum pokusu vychází ze staršího nebo neúplného důkazu odeslání.",
  orphanCalls:"Záznamy hovorů mise bez přiřaditelné kliniky.",
  duplicateEnrollments:"Přebytečné řádky zařazení klinik nad počet jedinečných klinik.",
  stateOnly:"Aktuální namapovaná potvrzení bez odpovídající historie položky; datum události se nevymýšlí.",
  unknownProposal:"Kliniky se souhlasem, ale bez prokázané smluvní nebo bezesmluvní větve nabídky.",
};
const qualityHu: Record<MissionFunnelQualityKey, string> = {
  clinics:"Egyedi, jogosult Mission-klinikák az ország- és ajánlási szűrők után.",
  cohort:"Jogosult klinikák, amelyek első jogosult kimenő próbálkozása a kiválasztott pozsonyi időszakra esik.",
  withoutAttempt:"Jogosult klinikák megfelelő kimenő próbálkozás bizonyítéka nélkül.",
  provisional:"Kohorszklinikák, amelyek első próbálkozási dátuma örökölt vagy hiányos dispatch-bizonyítékon alapul.",
  orphanCalls:"Mission-hívásrekordok feloldható klinikai kapcsolat nélkül.",
  duplicateEnrollments:"Az egyedi klinikák számán felüli többlet-beiratkozási sorok.",
  stateOnly:"Jelenlegi leképezett megerősítés megfelelő előzmény nélkül; eseménydátumot nem találunk ki.",
  unknownProposal:"Együttműködést elfogadó klinikák igazolt szerződéses vagy szerződés nélküli ajánlati ág nélkül.",
};
const qualityRo: Record<MissionFunnelQualityKey, string> = {
  clinics:"Clinici Mission eligibile distincte după filtrele de țară și recomandare.",
  cohort:"Clinici eligibile cu prima încercare outbound în perioada selectată, ora Bratislava.",
  withoutAttempt:"Clinici eligibile fără dovezi ale unei încercări outbound eligibile.",
  provisional:"Clinici din cohortă cu data primei încercări bazată pe dovezi vechi sau incomplete.",
  orphanCalls:"Înregistrări de apel Mission fără clinică identificabilă.",
  duplicateEnrollments:"Rânduri de înscriere suplimentare peste numărul clinicilor distincte.",
  stateOnly:"Confirmări mapate curente fără istoric asociat; data evenimentului nu este inventată.",
  unknownProposal:"Clinici cu acord, dar fără ramură dovedită cu sau fără contract.",
};
const qualityIt: Record<MissionFunnelQualityKey, string> = {
  clinics:"Cliniche Mission idonee distinte dopo i filtri paese e referral.",
  cohort:"Cliniche idonee con primo tentativo outbound nel periodo selezionato, ora Bratislava.",
  withoutAttempt:"Cliniche idonee senza prova di un tentativo outbound valido.",
  provisional:"Cliniche della coorte con data del primo tentativo basata su prove legacy o incomplete.",
  orphanCalls:"Registrazioni di chiamata Mission senza una clinica risolvibile.",
  duplicateEnrollments:"Righe di iscrizione aggiuntive oltre il numero di cliniche distinte.",
  stateOnly:"Conferme mappate correnti senza cronologia corrispondente; la data non viene inventata.",
  unknownProposal:"Cliniche con accordo ma senza ramo contrattuale o senza contratto dimostrato.",
};
const qualityDe: Record<MissionFunnelQualityKey, string> = {
  clinics:"Eindeutige berechtigte Mission-Kliniken nach Länder- und Empfehlungsfiltern.",
  cohort:"Berechtigte Kliniken, deren erster zulässiger ausgehender Versuch im gewählten Zeitraum (Bratislava) liegt.",
  withoutAttempt:"Berechtigte Kliniken ohne Nachweis eines zulässigen ausgehenden Versuchs.",
  provisional:"Kohortenkliniken mit einem Datum des ersten Versuchs aus älteren oder unvollständigen Dispatch-Nachweisen.",
  orphanCalls:"Mission-Anrufdatensätze ohne auflösbare Klinik.",
  duplicateEnrollments:"Zusätzliche Einschreibungszeilen über die Anzahl eindeutiger Kliniken hinaus.",
  stateOnly:"Aktuelle zugeordnete Bestätigungen ohne passenden Verlauf; Ereignisdaten werden nicht erfunden.",
  unknownProposal:"Kliniken mit Zustimmung, aber ohne nachgewiesenen Vertrags- oder Ohne-Vertrag-Zweig.",
};
const qualityAndBasis = {
  en: [qualityEn, basisEn], sk: [qualitySk, basisSk], cs: [qualityCs, basisCs],
  hu: [qualityHu, basisEn], ro: [qualityRo, basisEn], it: [qualityIt, basisEn], de: [qualityDe, basisEn],
} as const;
const finalConfigNotes: Record<Locale, string> = {
  en:"There are 19 configurable sources. The retained legacy “Cooperating (explicit yes)” source may remain in saved configuration but no longer controls the contract branch. If a mapped item is deleted, it is filtered out of the report configuration; select a current real item and save the corrected mapping.",
  sk:"Existuje 19 nastaviteľných zdrojov. Starší zdroj „Spolupracuje (výslovné áno)“ môže zostať uložený, ale už neriadi zmluvnú vetvu. Ak sa namapovaná položka odstráni, report ju odfiltruje z konfigurácie; vyberte aktuálnu položku a uložte opravené mapovanie.",
  cs:"Existuje 19 nastavitelných zdrojů. Starší zdroj „Spolupracuje (výslovné ano)“ může zůstat uložený, ale současnou smluvní větev neřídí. Pokud se namapovaná položka smaže, report ji odfiltruje z konfigurace; vyberte aktuální položku a uložte opravené mapování.",
  hu:"19 beállítható forrás van. A régi „Együttműködik (kifejezett igen)” mentve maradhat, de a szerződéses ágat nem vezérli. Törölt leképezett elem kikerül a jelentés konfigurációjából; válasszon aktuális elemet, majd mentse a javított leképezést.",
  ro:"Există 19 surse configurabile. Sursa veche „Colaborează (da explicit)” poate rămâne salvată, dar nu controlează ramura contractuală. Un element mapat șters este eliminat din configurația raportului; selectați un element actual și salvați maparea corectată.",
  it:"Esistono 19 fonti configurabili. La vecchia fonte “Collabora (sì esplicito)” può restare salvata, ma non controlla il ramo contrattuale. Un elemento mappato eliminato viene filtrato dalla configurazione del report; selezionare un elemento attuale e salvare la mappatura corretta.",
  de:"Es gibt 19 konfigurierbare Quellen. Die ältere Quelle „Kooperiert (explizites Ja)“ kann gespeichert bleiben, steuert aber nicht mehr den Vertragszweig. Gelöschte zugeordnete Einträge werden aus der Berichtskonfiguration gefiltert; wählen Sie einen aktuellen Eintrag und speichern Sie die korrigierte Zuordnung.",
};
const baseLocales: Record<Locale, HelpDraft> = { en, sk, cs, hu, ro, it, de };
const baseTranslationSet = Object.fromEntries(
  (Object.keys(baseLocales) as Locale[]).map(locale => [
    locale,
    withFinalConfigNote(baseLocales[locale], finalConfigNotes[locale], qualityAndBasis[locale][0], qualityAndBasis[locale][1]),
  ]),
) as Record<Locale, HelpDraft & Pick<MissionFunnelHelpLocale, "quality" | "basis">>;

const stageHu: Record<MissionFunnelHelpStep, string> = {
  assigned:"A jelenleg koordinátorhoz rendelt klinikák száma a teljes jogosult Missionben; az időszaktól független, nem konverziós lépés.",
  dialed:"A klinikához tartozó legkorábbi jogosult kimenő próbálkozás; régi napló alapján ideiglenes lehet.",
  connected:"Közvetlenül összekapcsolt, válaszidővel és pozitív hívásidővel rendelkező hívás; későbbi minősítési bizonyíték ezt inferálhatja.",
  qualified:"Pozitív minősítést jelölő leképezett Status List-választás; későbbi együttműködési bizonyíték pótolhatja.",
  agreed:"Leképezett, kifejezett együttműködési beleegyezés; alátámasztott későbbi mérföldkőből is következtethető.",
  wantsContract:"Együttműködési beleegyezés és elfogadott vagy más igazolt ajánlati válasz; későbbi szerződéses bizonyíték pótolhatja.",
  withoutContract:"Ugyanazon beiratkozásban együttműködési beleegyezés és kifejezetten el nem fogadott ajánlat szükséges.",
  email:"A saját, leképezett ajánlat-e-mail küldési megerősítése; későbbi igazolt szerződéses lépés pótolhatja.",
  wantsToSign:"Együttműködési beleegyezés és elfogadott ajánlat; későbbi bizonyíték pótolhatja, de a mérlegelés nem elfogadás.",
  sent:"A saját, leképezett szerződésküldési megerősítés; későbbi bizonyított szerződéses lépés pótolhatja.",
  received:"A saját, leképezett, orvosnak történő szerződéskézbesítési megerősítés; későbbi bizonyíték pótolhatja.",
  returned:"A saját, leképezett szerződés-visszaküldési megerősítés; későbbi bizonyíték pótolhatja.",
  validated:"A saját, leképezett szerződés-ellenőrzési megerősítés; ez zárja a szerződéses bizonyítékutat.",
  cooperating:"A szerződéses és a szerződés nélküli, azonos beiratkozáson bizonyított együttműködési minták klinikaszintű uniója.",
  packageSent:"A teljes csomag elküldésének vagy a meglévő érvényes összetevő-/kizárási bizonyítéknak az igazolása; együttműködés nem szükséges.",
  materials:"A korábbi jogosultsági szabály: együttműködik ÉS a csomag elküldve, ugyanazon beiratkozáson; a korábbi százalék nevezője változatlan.",
};
const sourceHu: Record<FunnelSource, string> = {
  qualified:"A pozitív minősítési válasz tényleges Status List-elemét válassza.",
  agreed:"Kifejezett együttműködési beleegyezést igazoló elem.",
  proposalAccepted:"A szerződési ajánlat kifejezett elfogadása; támogatja a szerződéses ágat és az aláírási szándékot.",
  proposalUnaccepted:"A szerződési ajánlat kifejezett el nem fogadása; beleegyezéssel a külön szerződés nélküli ágat támasztja alá.",
  proposalOther:"Támogatott, egyéb ajánlati válasz; nem elfogadás és nem aláírási szándék.",
  email:"A saját Status List-megerősítés, hogy az ajánlat e-mailben elküldve; nem bizonyítja a külső kézbesítést.",
  sent:"A szerződés elküldését jelző saját Status List-megerősítés.",
  received:"A szerződés orvosnak történő kézbesítését jelző saját Status List-megerősítés.",
  returned:"A szerződés visszaküldését jelző saját Status List-megerősítés.",
  validated:"A szerződés ellenőrzését jelző saját Status List-megerősítés.",
  activeWith:"Régi mentett forrás; a jelenlegi szerződéses együttműködési számítást nem vezérli.",
  activeWithout:"Kifejezett együttműködési megerősítés szerződés nélkül; a külön ághoz további bizonyítékok kellenek.",
  materials17:"Az MPN-13d anyagküldési választása: információs anyagok elküldve.",
  materials18:"Az MPN-14d anyagküldési választása: várótermi szórólapok elküldve.",
  materials19:"Az MPN-15d anyagküldési választása: várandóskönyvek elküldve.",
  unqualified:"Jelenlegi, leképezett minősítetlen állapot.",
  refused:"Jelenlegi, leképezett együttműködés-elutasítás; az első ismert dátum alapozza meg a hat hónapos visszatérési dátumot.",
  absent:"Jelenlegi, leképezett tartós távollét; opcionális visszatérési dátum hatására kikerülhet a kivételből.",
  wrongNumber:"Jelenlegi, leképezett hibás telefonszám állapot.",
  notWorking:"Jelenlegi, leképezett nem működő telefonszám állapot.",
};
const exceptionHu: Record<FunnelException, string> = {
  unqualified:"A kiválasztott kohorszban jelenleg minősítetlenként jelölt klinikák; más mérföldkővel átfedhet.",
  refused:"Jelenlegi elutasítási állapot; az első ismert megerősítés dátumától hat naptári hónap a tájékoztató visszatérési dátum.",
  unreachable:"Öt egymást követő, foglalt vagy megválaszolatlan sikertelen kimenő próbálkozás, illetve aktív tartós távollét.",
  absent:"Jelenlegi tartós távollét; érvényes visszatérési dátum napján vagy utána kikerül a kivételből.",
  wrongNumber:"Jelenlegi, leképezett hibás telefonszám állapot.",
  notWorking:"Jelenlegi, leképezett nem működő telefonszám állapot.",
};

const stageRo: Record<MissionFunnelHelpStep, string> = {
  assigned:"Clinici atribuite în prezent unui coordonator în întreaga Mission eligibilă; independent de perioadă, nu este conversie.",
  dialed:"Cea mai timpurie încercare outbound eligibilă a clinicii; dovezile vechi pot fi provizorii.",
  connected:"Apel asociat direct, cu oră de răspuns și durată pozitivă; dovezile ulterioare de calificare pot susține o inferență.",
  qualified:"Alegerea Status List mapată pentru calificare pozitivă; dovezile ulterioare de acord o pot susține prin inferență.",
  agreed:"Confirmare mapată de acord explicit pentru colaborare; poate fi inferată din dovezi ulterioare susținute.",
  wantsContract:"Acord plus răspuns acceptat sau alt răspuns eligibil dovedit; dovezile contractuale ulterioare pot completa reperul.",
  withoutContract:"Acord și propunere explicit neacceptată pe aceeași înscriere.",
  email:"Confirmarea mapată proprie că e-mailul cu propunerea a fost trimis; poate fi inferată din dovezi contractuale ulterioare.",
  wantsToSign:"Acord plus propunere acceptată; dovezile ulterioare pot completa reperul, dar răspunsul de analiză nu înseamnă acceptare.",
  sent:"Confirmarea mapată proprie că acel contract a fost trimis; poate fi inferată din dovezi contractuale ulterioare.",
  received:"Confirmarea mapată proprie că acel contract a fost livrat medicului; poate fi inferată din dovezi ulterioare.",
  returned:"Confirmarea mapată proprie că acel contract a fost returnat; poate fi inferată din dovezi ulterioare.",
  validated:"Confirmarea mapată proprie că acel contract a fost validat; încheie traseul dovezilor contractuale.",
  cooperating:"Uniunea la nivel de clinică a modelelor de colaborare cu și fără contract, dovedite pe aceeași înscriere.",
  packageSent:"Dovada expedierii întregului pachet sau dovada existentă validă privind componentele/excluderea; colaborarea nu este necesară.",
  materials:"Regula de eligibilitate anterioară: colaborează ȘI pachet trimis, pe aceeași înscriere; numitorul anterior al procentului rămâne neschimbat.",
};
const sourceRo: Record<FunnelSource, string> = {
  qualified:"Alegeți elementul Status List care reprezintă calificarea pozitivă.",
  agreed:"Elementul care confirmă explicit acordul de colaborare.",
  proposalAccepted:"Acceptarea explicită a propunerii; susține ramura contractuală și intenția de semnare.",
  proposalUnaccepted:"Propunere explicit neacceptată; împreună cu acordul susține ramura separată fără contract.",
  proposalOther:"Alt răspuns de propunere susținut; nu este acceptare și nu indică intenția de semnare.",
  email:"Confirmarea Status List că e-mailul cu propunerea a fost trimis; nu dovedește livrarea externă.",
  sent:"Confirmarea mapată proprie pentru trimiterea contractului.",
  received:"Confirmarea mapată proprie pentru livrarea contractului medicului.",
  returned:"Confirmarea mapată proprie pentru returnarea contractului.",
  validated:"Confirmarea mapată proprie pentru validarea contractului.",
  activeWith:"Sursă legacy păstrată; nu controlează calculul curent al colaborării contractuale.",
  activeWithout:"Confirmarea explicită a colaborării fără contract; ramura cere și alte dovezi.",
  materials17:"Alegerea codului MPN-13d: materiale informative trimise.",
  materials18:"Alegerea codului MPN-14d: pliante pentru sala de așteptare trimise.",
  materials19:"Alegerea codului MPN-15d: broșuri de sarcină trimise.",
  unqualified:"Stare curentă mapată de necalificare.",
  refused:"Stare curentă mapată de refuz; prima dată cunoscută stabilește revenirea informativă după șase luni.",
  absent:"Stare curentă mapată de absență îndelungată; data de revenire configurată poate elimina excepția.",
  wrongNumber:"Stare curentă mapată de număr incorect.",
  notWorking:"Stare curentă mapată de număr nefuncțional.",
};
const exceptionRo: Record<FunnelException, string> = {
  unqualified:"Clinici marcate în prezent necalificate în cohorta selectată; se pot suprapune altor repere.",
  refused:"Stare curentă de refuz; data primei confirmări plus șase luni calendaristice este doar informativă.",
  unreachable:"Cinci încercări outbound consecutive fără răspuns sau ocupat, ori absență îndelungată activă.",
  absent:"Absență îndelungată curentă; eliminată în ziua datei de revenire valide sau după aceasta.",
  wrongNumber:"Stare curentă mapată de număr incorect.",
  notWorking:"Stare curentă mapată de număr nefuncțional.",
};

const stageIt: Record<MissionFunnelHelpStep, string> = {
  assigned:"Cliniche assegnate attualmente a un coordinatore nell'intera Mission idonea; indipendente dal periodo, non è conversione.",
  dialed:"Primo tentativo outbound idoneo della clinica; le prove legacy possono essere provvisorie.",
  connected:"Chiamata collegata direttamente, con ora di risposta e durata positiva; prove successive di qualifica possono supportare un'inferenza.",
  qualified:"Scelta Status List mappata per la qualifica positiva; prove successive di accordo possono supportarne l'inferenza.",
  agreed:"Conferma mappata di accordo esplicito alla collaborazione; può essere inferita da prove successive supportate.",
  wantsContract:"Accordo più risposta accettata o altra risposta idonea provata; prove contrattuali successive possono completare il traguardo.",
  withoutContract:"Accordo e proposta esplicitamente non accettata sulla stessa iscrizione.",
  email:"Conferma mappata specifica dell'invio dell'e-mail con proposta; inferibile da prove contrattuali successive.",
  wantsToSign:"Accordo più proposta accettata; prove successive possono completare il traguardo, ma la risposta in valutazione non è accettazione.",
  sent:"Conferma mappata specifica dell'invio del contratto; inferibile da prove contrattuali successive.",
  received:"Conferma mappata specifica della consegna del contratto al medico; inferibile da prove successive.",
  returned:"Conferma mappata specifica della restituzione del contratto; inferibile da prove successive.",
  validated:"Conferma mappata specifica della convalida del contratto; chiude il percorso delle prove contrattuali.",
  cooperating:"Unione a livello di clinica dei modelli di collaborazione con e senza contratto provati sulla stessa iscrizione.",
  packageSent:"Prova dell'invio dell'intero pacchetto oppure prova esistente e valida di componenti/esclusione; la collaborazione non è richiesta.",
  materials:"La regola di idoneità precedente: collabora E pacchetto spedito sulla stessa iscrizione; il denominatore precedente della percentuale resta invariato.",
};
const sourceIt: Record<FunnelSource, string> = {
  qualified:"Scegliere l'elemento Status List che indica la qualifica positiva.",
  agreed:"Elemento che conferma esplicitamente l'accordo alla collaborazione.",
  proposalAccepted:"Accettazione esplicita della proposta; supporta il ramo contrattuale e l'intenzione di firmare.",
  proposalUnaccepted:"Proposta esplicitamente non accettata; con l'accordo supporta il ramo separato senza contratto.",
  proposalOther:"Altra risposta supportata alla proposta; non è accettazione né intenzione di firmare.",
  email:"Conferma Status List dell'invio dell'e-mail con proposta; non prova la consegna esterna.",
  sent:"Conferma mappata specifica dell'invio del contratto.",
  received:"Conferma mappata specifica della consegna del contratto al medico.",
  returned:"Conferma mappata specifica della restituzione del contratto.",
  validated:"Conferma mappata specifica della convalida del contratto.",
  activeWith:"Fonte legacy conservata; non controlla il calcolo attuale della collaborazione contrattuale.",
  activeWithout:"Conferma esplicita di collaborazione senza contratto; il ramo richiede anche altre prove.",
  materials17:"Scelta del codice MPN-13d: materiali informativi inviati.",
  materials18:"Scelta del codice MPN-14d: opuscoli per la sala d'attesa inviati.",
  materials19:"Scelta del codice MPN-15d: libretti di gravidanza inviati.",
  unqualified:"Stato corrente mappato di non qualificata.",
  refused:"Stato corrente mappato di rifiuto; la prima data nota fissa il rientro informativo dopo sei mesi.",
  absent:"Stato corrente mappato di assenza prolungata; la data di rientro configurata può rimuovere l'eccezione.",
  wrongNumber:"Stato corrente mappato di numero errato.",
  notWorking:"Stato corrente mappato di numero non funzionante.",
};
const exceptionIt: Record<FunnelException, string> = {
  unqualified:"Cliniche attualmente segnate come non qualificate nella coorte selezionata; possono sovrapporsi ad altri traguardi.",
  refused:"Stato corrente di rifiuto; la prima conferma più sei mesi di calendario è solo informativa.",
  unreachable:"Cinque tentativi outbound consecutivi senza risposta o occupato, oppure assenza prolungata attiva.",
  absent:"Assenza prolungata corrente; rimossa il giorno della data di rientro valida o successivamente.",
  wrongNumber:"Stato corrente mappato di numero errato.",
  notWorking:"Stato corrente mappato di numero non funzionante.",
};

const stageDe: Record<MissionFunnelHelpStep, string> = {
  assigned:"Derzeit einer Koordination zugewiesene Kliniken der gesamten berechtigten Mission; zeitraumunabhängig, kein Konversionsschritt.",
  dialed:"Frühester zulässiger ausgehender Versuch der Klinik; ältere Nachweise können vorläufig sein.",
  connected:"Direkt verknüpfter Anruf mit Antwortzeit und positiver Dauer; spätere Qualifikationsnachweise können diesen Schritt stützen.",
  qualified:"Zugeordnete Status-List-Auswahl für positive Qualifikation; spätere Zustimmungsnachweise können ihn ableiten.",
  agreed:"Zugeordnete ausdrückliche Zustimmung zur Kooperation; kann aus späteren belegten Nachweisen abgeleitet werden.",
  wantsContract:"Zustimmung plus angenommenes oder anderes belegtes zulässiges Angebot; spätere Vertragsnachweise können den Schritt ergänzen.",
  withoutContract:"Zustimmung und ausdrücklich nicht angenommenes Angebot in derselben Einschreibung.",
  email:"Eigene zugeordnete Bestätigung, dass die Angebots-E-Mail gesendet wurde; spätere Vertragsnachweise können sie ableiten.",
  wantsToSign:"Zustimmung plus angenommenes Angebot; spätere Nachweise können ergänzen, eine Antwort „wird erwogen“ ist keine Annahme.",
  sent:"Eigene zugeordnete Bestätigung, dass der Vertrag gesendet wurde; spätere Vertragsnachweise können sie ableiten.",
  received:"Eigene zugeordnete Bestätigung, dass der Vertrag dem Arzt zugestellt wurde; spätere Nachweise können sie ableiten.",
  returned:"Eigene zugeordnete Bestätigung, dass der Vertrag zurückgesendet wurde; spätere Nachweise können sie ableiten.",
  validated:"Eigene zugeordnete Bestätigung, dass der Vertrag validiert wurde; letzter Schritt des Vertragsnachweises.",
  cooperating:"Klinikbezogene Vereinigung der belegten Kooperationsmuster mit und ohne Vertrag derselben Einschreibung.",
  packageSent:"Nachweis, dass das gesamte Paket versendet wurde, oder ein gültiger bestehender Komponenten-/Ausschlussnachweis; Kooperation ist nicht erforderlich.",
  materials:"Die bisherige Anspruchsregel: kooperiert UND Paket versendet, in derselben Einschreibung; der bisherige Nenner des Vorher-Prozentsatzes bleibt unverändert.",
};
const sourceDe: Record<FunnelSource, string> = {
  qualified:"Wählen Sie den Status-List-Eintrag für eine positive Qualifikation.",
  agreed:"Eintrag für die ausdrückliche Zustimmung zur Kooperation.",
  proposalAccepted:"Ausdrückliche Annahme des Angebots; stützt Vertragszweig und Unterschriftsabsicht.",
  proposalUnaccepted:"Ausdrücklich nicht angenommenes Angebot; mit Zustimmung Nachweis des Zweigs ohne Vertrag.",
  proposalOther:"Andere unterstützte Angebotsantwort; weder Annahme noch Unterschriftsabsicht.",
  email:"Status-List-Bestätigung, dass die Angebots-E-Mail gesendet wurde; kein Nachweis externer Zustellung.",
  sent:"Eigene zugeordnete Bestätigung, dass der Vertrag gesendet wurde.",
  received:"Eigene zugeordnete Bestätigung der Zustellung des Vertrags an den Arzt.",
  returned:"Eigene zugeordnete Bestätigung, dass der Vertrag zurückgesendet wurde.",
  validated:"Eigene zugeordnete Bestätigung der Vertragsvalidierung.",
  activeWith:"Ältere gespeicherte Quelle; steuert die aktuelle vertragliche Kooperation nicht.",
  activeWithout:"Ausdrückliche Bestätigung der Kooperation ohne Vertrag; der Zweig benötigt weitere Nachweise.",
  materials17:"MPN-13d-Auswahl: Informationsmaterialien gesendet.",
  materials18:"MPN-14d-Auswahl: Wartezimmer-Flyer gesendet.",
  materials19:"MPN-15d-Auswahl: Schwangerschaftsbroschüren gesendet.",
  unqualified:"Aktuell zugeordneter Status „nicht qualifiziert“.",
  refused:"Aktuell zugeordneter Ablehnungsstatus; erstes bekanntes Datum bestimmt das informative Rückkehrdatum nach sechs Monaten.",
  absent:"Aktuell zugeordneter Status Langzeitabwesenheit; ein konfiguriertes Rückkehrdatum kann die Ausnahme beenden.",
  wrongNumber:"Aktuell zugeordneter Status falsche Telefonnummer.",
  notWorking:"Aktuell zugeordneter Status nicht funktionsfähige Telefonnummer.",
};
const exceptionDe: Record<FunnelException, string> = {
  unqualified:"Aktuell als nicht qualifiziert markierte Kliniken der gewählten Kohorte; Überschneidungen mit Meilensteinen sind möglich.",
  refused:"Aktueller Ablehnungsstatus; erstes bekanntes Bestätigungsdatum plus sechs Kalendermonate ist nur informativ.",
  unreachable:"Fünf aufeinanderfolgende erfolglose ausgehende Versuche ohne Antwort oder mit besetzt, oder aktive Langzeitabwesenheit.",
  absent:"Aktuelle Langzeitabwesenheit; am oder nach einem gültigen Rückkehrdatum ausgenommen.",
  wrongNumber:"Aktuell zugeordneter Status falsche Telefonnummer.",
  notWorking:"Aktuell zugeordneter Status nicht funktionsfähige Telefonnummer.",
};

const stageCs: Record<MissionFunnelHelpStep, string> = {
  assigned:"Kliniky aktuálně přiřazené koordinátorovi v celé oprávněné misi; nezávislé na období, nejde o konverzi.",
  dialed:"Nejčasnější oprávněný odchozí pokus kliniky; starší důkazy mohou být předběžné.",
  connected:"Přímo propojený hovor s časem odpovědi a kladnou délkou; pozdější důkazy kvalifikace mohou krok podpořit odvozením.",
  qualified:"Namapovaná volba Status List pro pozitivní kvalifikaci; pozdější důkazy souhlasu ji mohou odvodit.",
  agreed:"Namapované výslovné potvrzení souhlasu se spoluprací; lze odvodit z pozdějších podložených důkazů.",
  wantsContract:"Souhlas a přijatá nebo jiná prokázaná způsobilá odpověď na nabídku; pozdější smluvní důkazy mohou krok doplnit.",
  withoutContract:"Souhlas a výslovně nepřijatá nabídka v témže zařazení kliniky.",
  email:"Vlastní namapované potvrzení odeslání e-mailu s nabídkou; lze odvodit z pozdějších smluvních důkazů.",
  wantsToSign:"Souhlas a přijatá nabídka; pozdější důkazy mohou krok doplnit, odpověď „zvažuje“ však není přijetí.",
  sent:"Vlastní namapované potvrzení odeslání smlouvy; lze odvodit z pozdějších smluvních důkazů.",
  received:"Vlastní namapované potvrzení doručení smlouvy lékaři; lze odvodit z pozdějších důkazů.",
  returned:"Vlastní namapované potvrzení vrácení smlouvy; lze odvodit z pozdějších důkazů.",
  validated:"Vlastní namapované potvrzení ověření smlouvy; uzavírá důkazní cestu smlouvy.",
  cooperating:"Sjednocení smluvních a bezesmluvních vzorů spolupráce prokázaných na stejném zařazení, deduplikované na kliniku.",
  packageSent:"Důkaz o odeslání celého balíčku nebo platný existující důkaz o součástech/vyloučení; spolupráce není nutná.",
  materials:"Původní pravidlo způsobilosti: spolupracuje A balíček odeslán v témže zařazení; původní jmenovatel předchozího procenta zůstává beze změny.",
};
const sourceCs: Record<FunnelSource, string> = {
  qualified:"Vyberte skutečnou položku Status List pro pozitivní kvalifikaci.",
  agreed:"Položka výslovně potvrzující souhlas se spoluprací.",
  proposalAccepted:"Výslovné přijetí nabídky; podporuje smluvní větev a záměr podepsat.",
  proposalUnaccepted:"Výslovně nepřijatá nabídka; se souhlasem podporuje samostatnou větev Bez smlouvy.",
  proposalOther:"Jiná podložená odpověď na nabídku; nejde o přijetí ani záměr podepsat.",
  email:"Potvrzení Status List o odeslání e-mailu s nabídkou; nedokládá externí doručení.",
  sent:"Vlastní namapované potvrzení odeslání smlouvy.",
  received:"Vlastní namapované potvrzení doručení smlouvy lékaři.",
  returned:"Vlastní namapované potvrzení vrácení smlouvy.",
  validated:"Vlastní namapované potvrzení ověření smlouvy.",
  activeWith:"Starší uložený zdroj; neřídí současný výpočet smluvní spolupráce.",
  activeWithout:"Výslovné potvrzení spolupráce bez smlouvy; větev vyžaduje další důkazy.",
  materials17:"Volba kódu MPN-13d: informační materiály odeslány.",
  materials18:"Volba kódu MPN-14d: letáky do čekárny odeslány.",
  materials19:"Volba kódu MPN-15d: těhotenské knížky odeslány.",
  unqualified:"Aktuální namapovaný stav nekvalifikovanosti.",
  refused:"Aktuální namapovaný stav odmítnutí; první známé datum určuje informativní návrat za šest měsíců.",
  absent:"Aktuální namapovaný stav dlouhodobé nepřítomnosti; nastavené datum návratu může výjimku ukončit.",
  wrongNumber:"Aktuální namapovaný stav chybného telefonního čísla.",
  notWorking:"Aktuální namapovaný stav nefunkčního telefonního čísla.",
};
const exceptionCs: Record<FunnelException, string> = {
  unqualified:"Kliniky aktuálně označené jako nekvalifikované ve vybrané kohortě; mohou se překrývat s milníky.",
  refused:"Aktuální stav odmítnutí; první známé potvrzení plus šest kalendářních měsíců je pouze informativní.",
  unreachable:"Pět po sobě jdoucích neúspěšných odchozích pokusů: obsazeno nebo bez odpovědi; zahrnuje také aktivní dlouhodobou nepřítomnost.",
  absent:"Aktuální dlouhodobá nepřítomnost; v den platného data návratu nebo později se výjimka odstraní.",
  wrongNumber:"Aktuální namapovaný stav chybného telefonního čísla.",
  notWorking:"Aktuální namapovaný stav nefunkčního telefonního čísla.",
};

const qualityDetailed: Record<Locale, Record<MissionFunnelQualityKey, string>> = {
  en:{
    clinics:"Distinct clinics in the eligible Mission after country access and referral selection; whole eligible Mission, not period-filtered.",
    cohort:"Clinics whose first eligible outbound attempt falls within the selected date range in Bratislava time; this is the date- and referral-filtered cohort.",
    withoutAttempt:"Eligible Mission clinics with no qualifying outbound attempt; not filtered by the selected period.",
    provisional:"Eligible Mission clinics whose first-attempt date relies on legacy fallback evidence, incomplete dispatch details, or earlier observed call logs; not filtered by period.",
    orphanCalls:"Mission-scoped call records without a resolvable clinic, subject to available country access; referral selection does not narrow this count.",
    duplicateEnrollments:"Extra clinic enrollment rows beyond unique clinics in the eligible Mission; not filtered by period.",
    stateOnly:"Eligible Mission clinics with a mapped current confirmation but no matching item history; no date is invented.",
    unknownProposal:"Eligible Mission clinics with agreement but no proven proposal branch; not filtered by period.",
  },
  sk:{
    clinics:"Jedinečné kliniky oprávnenej misie po prístupovom filtri krajiny a výbere odporúčania; celá oprávnená misia, nie filtrované obdobie.",
    cohort:"Kliniky, ktorých prvý oprávnený odchádzajúci pokus spadá do zvoleného obdobia v čase Bratislavy; kohorta je filtrovaná dátumom aj odporúčaním.",
    withoutAttempt:"Kliniky oprávnenej misie bez dôkazu oprávneného odchádzajúceho pokusu; bez filtra obdobia.",
    provisional:"Kliniky oprávnenej misie s prvým pokusom doloženým starším náhradným dôkazom, neúplným dôkazom odoslania alebo skoršími pozorovanými záznamami hovorov; bez filtra obdobia.",
    orphanCalls:"Záznamy hovorov misie bez rozpoznateľnej kliniky, v rozsahu dostupných krajín; výber odporúčania tento počet nezužuje.",
    duplicateEnrollments:"Nadbytočné riadky zaradenia nad počet jedinečných kliník oprávnenej misie; bez filtra obdobia.",
    stateOnly:"Kliniky oprávnenej misie s namapovaným aktuálnym potvrdením bez zodpovedajúcej histórie položky; dátum sa nevymýšľa.",
    unknownProposal:"Kliniky oprávnenej misie so súhlasom bez preukázanej vetvy ponuky; bez filtra obdobia.",
  },
  cs:{
    clinics:"Jedinečné kliniky oprávněné mise po přístupovém filtru země a výběru doporučení; celá oprávněná mise, nikoli období.",
    cohort:"Kliniky, jejichž první oprávněný odchozí pokus spadá do zvoleného období v čase Bratislavy; kohorta je filtrována datem i doporučením.",
    withoutAttempt:"Kliniky oprávněné mise bez důkazu oprávněného odchozího pokusu; bez filtru období.",
    provisional:"Kliniky oprávněné mise s prvním pokusem doloženým starším náhradním důkazem, neúplným důkazem odeslání nebo dříve zaznamenanými hovory; bez filtru období.",
    orphanCalls:"Záznamy hovorů mise bez rozpoznatelné kliniky, v rozsahu dostupných zemí; výběr doporučení tento počet nezužuje.",
    duplicateEnrollments:"Přebytečné řádky zařazení nad počet jedinečných klinik oprávněné mise; bez filtru období.",
    stateOnly:"Kliniky oprávněné mise s namapovaným aktuálním potvrzením bez odpovídající historie položky; datum se nevymýšlí.",
    unknownProposal:"Kliniky oprávněné mise se souhlasem bez prokázané větve nabídky; bez filtru období.",
  },
  hu:{
    clinics:"Az ország-hozzáférési és ajánlási szűrés után jogosult Mission egyedi klinikái; a teljes jogosult Mission, időszakszűrés nélkül.",
    cohort:"Azon klinikák, amelyek első jogosult kimenő próbálkozása a választott időszakra esik pozsonyi idő szerint; dátum és ajánlás szerint szűrt kohorsz.",
    withoutAttempt:"Jogosult Mission-klinikák megfelelő kimenő próbálkozási bizonyíték nélkül; az időszak nem szűri.",
    provisional:"A jogosult Mission azon klinikái, amelyek első próbálkozási dátuma régi tartalékbizonyítékon, hiányos küldési bizonyítékon vagy korábban megfigyelt hívásnaplón alapul; időszakszűrés nélkül.",
    orphanCalls:"Feloldható klinika nélküli, Mission-szintű hívásrekordok az elérhető ország-hozzáférés szerint; az ajánlási szűrő nem szűkíti.",
    duplicateEnrollments:"Az egyedi klinikákon felüli többlet-beiratkozási sorok a jogosult Missionben; időszakszűrés nélkül.",
    stateOnly:"Jogosult klinikák leképezett aktuális megerősítéssel, de megfelelő tételtörténet nélkül; dátumot nem találunk ki.",
    unknownProposal:"Jogosult klinikák együttműködési beleegyezéssel, de igazolt ajánlati ág nélkül; időszakszűrés nélkül.",
  },
  ro:{
    clinics:"Clinici Mission distincte eligibile după accesul pe țară și filtrul de recomandare; întreaga misiune eligibilă, fără filtru de perioadă.",
    cohort:"Clinici a căror primă încercare outbound eligibilă se află în intervalul ales, ora Bratislava; cohortă filtrată după dată și recomandare.",
    withoutAttempt:"Clinici Mission eligibile fără dovada unei încercări outbound valide; nefiltrate după perioadă.",
    provisional:"Clinici Mission eligibile a căror primă dată se bazează pe dovezi vechi de rezervă, dovezi incomplete de expediere sau jurnale de apel observate anterior; nefiltrate după perioadă.",
    orphanCalls:"Apeluri la nivelul Mission fără clinică identificabilă, în limita accesului disponibil pe țară; filtrul de recomandare nu restrânge acest număr.",
    duplicateEnrollments:"Rânduri suplimentare de înscriere peste clinicile distincte eligibile; nefiltrate după perioadă.",
    stateOnly:"Clinici eligibile cu confirmare curentă mapată, dar fără istoric al elementului; data nu este inventată.",
    unknownProposal:"Clinici eligibile cu acord, dar fără ramură de propunere dovedită; nefiltrate după perioadă.",
  },
  it:{
    clinics:"Cliniche Mission distinte idonee dopo accesso per paese e selezione referral; intera Mission idonea, senza filtro periodo.",
    cohort:"Cliniche il cui primo tentativo outbound idoneo ricade nell'intervallo selezionato, ora Bratislava; coorte filtrata per data e referral.",
    withoutAttempt:"Cliniche Mission idonee senza prova di un tentativo outbound valido; non filtrate per periodo.",
    provisional:"Cliniche Mission idonee la cui data del primo tentativo dipende da prove legacy di riserva, prove di dispatch incomplete o registri di chiamate osservati in precedenza; non filtrate per periodo.",
    orphanCalls:"Chiamate Mission senza clinica risolvibile, entro l'accesso paese disponibile; il filtro referral non restringe questo conteggio.",
    duplicateEnrollments:"Righe di iscrizione aggiuntive rispetto alle cliniche distinte idonee; non filtrate per periodo.",
    stateOnly:"Cliniche idonee con conferma corrente mappata ma senza cronologia dell'elemento; la data non viene inventata.",
    unknownProposal:"Cliniche idonee con accordo ma senza ramo della proposta dimostrato; non filtrate per periodo.",
  },
  de:{
    clinics:"Eindeutige berechtigte Mission-Kliniken nach Länderzugriff und Empfehlungsfilter; gesamte berechtigte Mission, nicht zeitraumgefiltert.",
    cohort:"Kliniken, deren erster zulässiger ausgehender Versuch im gewählten Zeitraum (Bratislava) liegt; nach Datum und Empfehlung gefilterte Kohorte.",
    withoutAttempt:"Berechtigte Mission-Kliniken ohne Nachweis eines zulässigen ausgehenden Versuchs; nicht nach Zeitraum gefiltert.",
    provisional:"Berechtigte Mission-Kliniken, deren Datum des ersten Versuchs auf älteren Ersatznachweisen, unvollständigen Dispatch-Nachweisen oder früher beobachteten Anrufprotokollen beruht; nicht nach Zeitraum gefiltert.",
    orphanCalls:"Mission-Anrufe ohne auflösbare Klinik, im Rahmen des Länderzugriffs; der Empfehlungsfilter schränkt diese Zahl nicht ein.",
    duplicateEnrollments:"Zusätzliche Einschreibungszeilen über eindeutige berechtigte Kliniken hinaus; nicht nach Zeitraum gefiltert.",
    stateOnly:"Berechtigte Kliniken mit aktueller zugeordneter Bestätigung ohne passenden Eintragsverlauf; kein Datum wird erfunden.",
    unknownProposal:"Berechtigte Kliniken mit Zustimmung, aber ohne nachgewiesenen Angebotszweig; nicht nach Zeitraum gefiltert.",
  },
};

const basisDetailed: Record<Locale, Record<MissionFunnelEvidenceBasis, string>> = {
  en:{
    call:"Call-log and signalling evidence: the first eligible outbound attempt or a linked call with a recorded answer and positive duration.",
    history:"A dated Status List confirmation event supports the milestone.",
    state:"A current Status List confirmation has no matching item-history event; its event date is unknown.",
    derived:"A supported predecessor inferred from later evidence has no dated event of its own; the later supporting date is shown separately.",
    current:"Present assignment, not a historical milestone.",
  },
  sk:{
    call:"Dôkaz z denníka hovorov a signalizácie: prvý oprávnený odchádzajúci pokus alebo prepojený hovor so zaznamenanou odpoveďou a kladným trvaním.",
    history:"Míľnik podporuje dátovaná udalosť potvrdenia Status List.",
    state:"Aktuálne potvrdenie Status List nemá zodpovedajúcu históriu položky; dátum udalosti nie je známy.",
    derived:"Podporený predchádzajúci krok odvodený z neskoršieho dôkazu nemá vlastný dátovaný záznam; dátum podpory sa uvádza samostatne.",
    current:"Súčasné priradenie, nie historický míľnik.",
  },
  cs:{
    call:"Důkaz z protokolu hovorů a signalizace: první oprávněný odchozí pokus nebo propojený hovor se zaznamenanou odpovědí a kladnou délkou.",
    history:"Milník podporuje datovaná událost potvrzení Status List.",
    state:"Aktuální potvrzení Status List nemá odpovídající historii položky; datum události není známo.",
    derived:"Podložený předchozí krok odvozený z pozdějšího důkazu nemá vlastní datovaný záznam; datum podpory se uvádí samostatně.",
    current:"Současné přiřazení, nikoli historický milník.",
  },
  hu:{
    call:"Hívásnapló- és jelzési bizonyíték: az első jogosult kimenő próbálkozás, vagy kapcsolt hívás rögzített válasszal és pozitív időtartammal.",
    history:"A mérföldkövet dátummal rendelkező Status List-megerősítési esemény támasztja alá.",
    state:"Az aktuális Status List-megerősítéshez nincs megfelelő elem-előzmény; az esemény dátuma ismeretlen.",
    derived:"A későbbi bizonyítékból következtetett, alátámasztott előzménynek nincs saját dátumozott eseménye; a támogató dátum külön látható.",
    current:"Jelenlegi hozzárendelés, nem történeti mérföldkő.",
  },
  ro:{
    call:"Dovezi din jurnalul apelurilor și semnalizare: prima încercare outbound eligibilă sau apel asociat cu răspuns înregistrat și durată pozitivă.",
    history:"Reperul este susținut de un eveniment Status List datat.",
    state:"Confirmarea Status List curentă nu are un eveniment corespunzător în istoricul elementului; data evenimentului este necunoscută.",
    derived:"Predecesorul susținut dedus din dovezi ulterioare nu are propriul eveniment datat; data dovezii ulterioare este afișată separat.",
    current:"Atribuire prezentă, nu reper istoric.",
  },
  it:{
    call:"Prova da registro chiamate e segnalazione: primo tentativo outbound idoneo oppure chiamata collegata con risposta registrata e durata positiva.",
    history:"Il traguardo è supportato da un evento Status List datato.",
    state:"La conferma Status List corrente non ha un evento corrispondente nella cronologia dell'elemento; la data dell'evento è sconosciuta.",
    derived:"Il predecessore supportato inferito da prove successive non ha un proprio evento datato; la data della prova successiva è mostrata separatamente.",
    current:"Assegnazione presente, non traguardo storico.",
  },
  de:{
    call:"Nachweis aus Anrufprotokoll und Signalisierung: erster zulässiger ausgehender Versuch oder verknüpfter Anruf mit erfasster Antwort und positiver Dauer.",
    history:"Ein datiertes Status-List-Bestätigungsereignis stützt den Meilenstein.",
    state:"Eine aktuelle Status-List-Bestätigung hat keinen passenden Eintragsverlauf; das Ereignisdatum ist unbekannt.",
    derived:"Ein aus späteren Nachweisen abgeleiteter, belegter Vorgänger hat kein eigenes datiertes Ereignis; das unterstützende Datum wird separat angezeigt.",
    current:"Aktuelle Zuweisung, kein historischer Meilenstein.",
  },
};

const withoutContractTitles: Record<Locale, string> = {
  en:"Without contract · separate branch", sk:"Bez zmluvy · samostatná vetva", cs:"Bez smlouvy · samostatná větev",
  hu:"Szerződés nélkül · külön ág", ro:"Fără contract · ramură separată", it:"Senza contratto · ramo separato", de:"Ohne Vertrag · eigener Zweig",
};
const withoutContractContent: Record<Locale, string[]> = {
  en:[
    "This is a distinct outcome branch, not a stage after Wants a contract. Count a clinic only when one and the same enrollment has both an agreement-to-cooperate confirmation and an explicit mapped answer that the proposal was not accepted.",
    "Cooperation agreement alone is not enough. A missing proposal answer is unknown; it is not evidence that the proposal was declined. The branch requires a real positive Status List choice for the explicit unaccepted response.",
    "The Without contract clinic count is separate from the contract path. A clinic may qualify for both branches through different evidence on the same enrollment, so do not add branch totals to calculate Combined outcomes.",
    "This branch alone does not mean cooperation was completed. It contributes to Cooperating only when the same enrollment also has the mapped explicit cooperation-without-contract confirmation.",
  ],
  sk:[
    "Ide o samostatný výsledok, nie krok po možnosti Chce zmluvu. Klinika sa počíta iba vtedy, keď má to isté zaradenie potvrdený súhlas so spoluprácou aj výslovnú namapovanú odpoveď, že návrh nebol prijatý.",
    "Samotný súhlas nestačí. Chýbajúca odpoveď na návrh je neznáma, nie dôkaz odmietnutia. Vetva vyžaduje skutočnú pozitívnu položku Status List pre výslovnú neprijatú odpoveď.",
    "Počet kliník Bez zmluvy je oddelený od zmluvnej cesty. Klinika môže spĺňať obe vetvy, preto ich nesčítavajte na výpočet kombinovaných výsledkov.",
    "Táto vetva sama osebe neznamená dokončenú spoluprácu. Do kroku Spolupracuje prispieva až po potvrdení spolupráce bez zmluvy v tom istom zaradení.",
  ],
  cs:[
    "Jde o samostatný výsledek, nikoli krok po možnosti Chce smlouvu. Klinika se počítá pouze tehdy, když má stejné zařazení potvrzený souhlas se spoluprací i výslovnou namapovanou odpověď, že nabídka nebyla přijata.",
    "Samotný souhlas nestačí. Chybějící odpověď na nabídku je neznámá, nikoli důkaz odmítnutí. Větev vyžaduje skutečnou pozitivní položku Status List pro výslovnou nepřijatou odpověď.",
    "Počet klinik Bez smlouvy je oddělený od smluvní cesty. Klinika může splnit obě větve, proto jejich součtem nevypočítávejte kombinované výsledky.",
    "Tato větev sama o sobě neznamená dokončenou spolupráci. Do kroku Spolupracuje přispívá až po potvrzení spolupráce bez smlouvy ve stejném zařazení.",
  ],
  hu:[
    "Ez külön eredményág, nem a Szerződést szeretne lépés utáni szakasz. Csak akkor számítson a klinika, ha ugyanabban a beiratkozásban szerepel az együttműködési beleegyezés és a kifejezett, leképezett válasz, hogy az ajánlatot nem fogadták el.",
    "Az együttműködési beleegyezés önmagában nem elegendő. A hiányzó ajánlati válasz ismeretlen, nem az elutasítás bizonyítéka. Az ághoz tényleges pozitív Status List-választás kell az el nem fogadott válaszhoz.",
    "A Szerződés nélkül klinikaszám különáll a szerződéses úttól. Egy klinika mindkét ágba bekerülhet, ezért az ágak számait ne adja össze az összesített eredményhez.",
    "Ez az ág önmagában nem jelenti a sikeres együttműködést. Csak akkor járul hozzá az Együttműködik eredményhez, ha ugyanazon beiratkozásban a szerződés nélküli együttműködés kifejezett megerősítése is megvan.",
  ],
  ro:[
    "Aceasta este o ramură distinctă, nu o etapă după Dorește contract. Clinica se numără numai când aceeași înscriere are atât acordul de colaborare, cât și un răspuns mapat explicit că propunerea nu a fost acceptată.",
    "Acordul singur nu este suficient. Lipsa răspunsului la propunere este necunoscută, nu dovadă de refuz. Ramura cere alegerea pozitivă reală din Status List pentru răspunsul explicit neacceptat.",
    "Numărul clinicilor Fără contract este separat de traseul contractual. O clinică poate îndeplini ambele ramuri; nu adunați totalurile pentru rezultatele combinate.",
    "Această ramură singură nu înseamnă colaborare finalizată. Contribuie la Colaborează numai dacă aceeași înscriere are și confirmarea explicită a colaborării fără contract.",
  ],
  it:[
    "È un esito distinto, non una fase successiva a Vuole un contratto. La clinica si conta solo se la stessa iscrizione contiene sia l'accordo alla collaborazione sia una risposta mappata esplicita che la proposta non è stata accettata.",
    "Il solo accordo non basta. Una risposta alla proposta mancante è sconosciuta, non prova di rifiuto. Il ramo richiede la scelta positiva Status List reale per la risposta esplicitamente non accettata.",
    "Il conteggio Senza contratto è separato dal percorso contrattuale. Una clinica può soddisfare entrambi i rami: non sommare i totali per ottenere gli esiti combinati.",
    "Questo ramo da solo non significa collaborazione completata. Contribuisce a Collabora solo se la stessa iscrizione contiene anche la conferma esplicita di collaborazione senza contratto.",
  ],
  de:[
    "Dies ist ein eigener Ergebniszweig, keine Stufe nach Möchte Vertrag. Eine Klinik zählt nur, wenn dieselbe Einschreibung sowohl die Zustimmung zur Kooperation als auch die ausdrücklich zugeordnete Antwort enthält, dass das Angebot nicht angenommen wurde.",
    "Die Zustimmung allein reicht nicht. Eine fehlende Angebotsantwort ist unbekannt und kein Nachweis einer Ablehnung. Der Zweig benötigt eine tatsächliche positive Status-List-Auswahl für die ausdrückliche Nichtannahme.",
    "Die Klinikzahl Ohne Vertrag ist vom Vertragspfad getrennt. Eine Klinik kann beide Zweige erfüllen; addieren Sie die Zweigzahlen nicht für kombinierte Ergebnisse.",
    "Dieser Zweig allein bedeutet keine abgeschlossene Kooperation. Er zählt nur dann zu Kooperiert, wenn dieselbe Einschreibung auch die ausdrückliche Bestätigung der Kooperation ohne Vertrag enthält.",
  ],
};

const helpLabels: Record<Locale, Pick<MissionFunnelHelpLocale, "button" | "contents" | "previous" | "next">> = {
  en:{button:"Help & manual",contents:"Manual chapters",previous:"Previous chapter",next:"Next chapter"},
  sk:{button:"Pomoc a príručka",contents:"Kapitoly príručky",previous:"Predchádzajúca kapitola",next:"Ďalšia kapitola"},
  cs:{button:"Nápověda a příručka",contents:"Kapitoly příručky",previous:"Předchozí kapitola",next:"Další kapitola"},
  hu:{button:"Súgó és kézikönyv",contents:"A kézikönyv fejezetei",previous:"Előző fejezet",next:"Következő fejezet"},
  ro:{button:"Ajutor și ghid",contents:"Capitolele ghidului",previous:"Capitolul anterior",next:"Capitolul următor"},
  it:{button:"Aiuto e guida",contents:"Capitoli della guida",previous:"Capitolo precedente",next:"Capitolo successivo"},
  de:{button:"Hilfe & Leitfaden",contents:"Kapitelübersicht",previous:"Vorheriges Kapitel",next:"Nächstes Kapitel"},
};
const reachedNotes: Record<Locale, string> = {
  en:"Direct Reached evidence is a linked call with a recorded answer time and positive duration. Reached can also be inferred from supported Qualified or Agreed evidence; an answer record does not prove the doctor personally answered.",
  sk:"Priamy dôkaz kroku Zastihnuté je prepojený hovor so zaznamenaným časom odpovede a kladným trvaním. Krok možno odvodiť aj z podporeného dôkazu Kvalifikované alebo Súhlasí; záznam nedokazuje, že odpovedal osobne lekár.",
  cs:"Přímým důkazem kroku Dovoláno je propojený hovor se zaznamenaným časem odpovědi a kladnou délkou. Krok lze také odvodit z podloženého důkazu Kvalifikované nebo Souhlasí; záznam nedokazuje, že osobně odpověděl lékař.",
  hu:"Az Elérve közvetlen bizonyítéka kapcsolt hívás rögzített válaszidővel és pozitív időtartammal. A lépés alátámasztott Minősített vagy Együttműködés-elfogadás bizonyítékából is következtethető; a válaszrekord nem bizonyítja, hogy személyesen az orvos válaszolt.",
  ro:"Dovada directă pentru Contactată este un apel asociat cu ora răspunsului înregistrată și durată pozitivă. Etapa poate fi inferată și din dovezi susținute de calificare sau acord; înregistrarea nu dovedește că medicul a răspuns personal.",
  it:"La prova diretta di Raggiunta è una chiamata collegata con ora di risposta registrata e durata positiva. La fase può anche essere inferita da prove supportate di Qualificata o Accetta; il record non dimostra che abbia risposto personalmente il medico.",
  de:"Der direkte Nachweis für Erreicht ist ein verknüpfter Anruf mit erfasster Antwortzeit und positiver Dauer. Der Schritt kann auch aus belegten Nachweisen für Qualifiziert oder Zustimmung abgeleitet werden; der Anrufdatensatz beweist nicht, dass der Arzt persönlich antwortete.",
};
const unavailableNotes: Record<Locale, string> = {
  en:"Unavailable includes five or more consecutive unsuccessful outbound attempts marked busy or no answer, with no answered call in that attempt, and also includes active long-term absence. The call-based rule can still qualify a clinic after its absence-based part ends.",
  sk:"Nedostupné zahŕňa najmenej päť po sebe idúcich neúspešných odchádzajúcich pokusov označených ako obsadené alebo bez odpovede, pri ktorých hovor nebol prijatý; zahŕňa aj aktívnu dlhodobú neprítomnosť. Pravidlo podľa hovorov môže platiť aj po skončení zložky neprítomnosti.",
  cs:"Nedostupné zahrnuje nejméně pět po sobě jdoucích neúspěšných odchozích pokusů označených jako obsazeno nebo bez odpovědi, u nichž hovor nebyl přijat; zahrnuje také aktivní dlouhodobou nepřítomnost. Pravidlo podle hovorů může platit i po skončení části odvozené od nepřítomnosti.",
  hu:"A Nem elérhető legalább öt egymást követő sikertelen kimenő próbálkozást jelent foglalt vagy megválaszolatlan jelzéssel, fogadott hívás nélkül; az aktív tartós távollétet is tartalmazza. A hívásalapú szabály a távolléti rész megszűnése után is érvényes maradhat.",
  ro:"Indisponibilă include cel puțin cinci încercări outbound consecutive nereușite, ocupat sau fără răspuns, fără apel preluat, și absența activă îndelungată. Regula bazată pe apeluri poate continua după eliminarea componentei absenței.",
  it:"Non raggiungibile include almeno cinque tentativi outbound consecutivi non riusciti, occupato o senza risposta, senza chiamata risposta, e include anche l'assenza prolungata attiva. La regola basata sulle chiamate può restare valida dopo la fine della componente di assenza.",
  de:"Nicht erreichbar umfasst mindestens fünf aufeinanderfolgende erfolglose ausgehende Versuche mit Besetzt- oder Keine-Antwort-Ergebnis ohne angenommenen Anruf sowie aktive Langzeitabwesenheit. Die anrufbasierte Regel kann nach Ende des abwesenheitsbedingten Anteils weiter gelten.",
};
const mappingRuleNotes: Record<Locale, string> = {
  en:"Choose actual positive Status List choices for each source; alternatives within one source are OR. An empty source has no direct mapped evidence, but supported inference may still produce a count. A step is unmeasured only when it has no usable mapping and no supported inferred evidence; a measured zero means the configured rule found no qualifying clinics.",
  sk:"Pre každý zdroj vyberte skutočné pozitívne položky Status List; alternatívy v jednom zdroji znamenajú ALEBO. Prázdny zdroj nemá priamy namapovaný dôkaz, podporené odvodenie však môže stále vytvoriť počet. Krok je nemeraný až vtedy, keď nemá použiteľné mapovanie ani podporený odvodený dôkaz; meraná nula znamená, že pravidlo nenašlo oprávnené kliniky.",
  cs:"Pro každý zdroj vyberte skutečné pozitivní položky Status List; alternativy v jednom zdroji znamenají NEBO. Prázdný zdroj nemá přímý namapovaný důkaz, podložené odvození však může stále vytvořit počet. Krok je neměřený až tehdy, když nemá použitelné mapování ani podložený odvozený důkaz; měřená nula znamená, že pravidlo nenašlo způsobilé kliniky.",
  hu:"Minden forráshoz tényleges pozitív Status List-választást rendeljen; egy forráson belül a lehetőségek VAGY kapcsolatúak. Az üres forrásnak nincs közvetlen leképezett bizonyítéka, de támogatott következtetés továbbra is adhat számot. Egy lépés csak akkor nem mért, ha nincs használható leképezése és alátámasztott következtetett bizonyítéka sem; a mért nulla azt jelenti, hogy a szabály nem talált megfelelő klinikát.",
  ro:"Alegeți opțiuni pozitive reale din Status List pentru fiecare sursă; alternativele dintr-o sursă sunt SAU. O sursă goală nu are dovezi mapate directe, dar o inferență susținută poate produce totuși un număr. Etapa este nemăsurată numai dacă nu are mapare utilizabilă și nici dovezi inferate susținute; zero măsurat înseamnă că regula nu a găsit clinici eligibile.",
  it:"Scegliere scelte positive Status List reali per ogni fonte; le alternative nella stessa fonte sono OR. Una fonte vuota non ha prove mappate dirette, ma un'inferenza supportata può comunque produrre un conteggio. Una fase è non misurata solo se non ha una mappatura utilizzabile né prove inferite supportate; zero misurato significa che la regola non ha trovato cliniche idonee.",
  de:"Wählen Sie für jede Quelle tatsächliche positive Status-List-Auswahlen; Alternativen innerhalb einer Quelle bedeuten ODER. Eine leere Quelle hat keinen direkten Zuordnungsnachweis, unterstützte Ableitung kann dennoch zu einer Zahl führen. Ein Schritt ist nur dann nicht gemessen, wenn weder eine verwendbare Zuordnung noch unterstützte abgeleitete Nachweise vorliegen; gemessene null bedeutet, dass die Regel keine qualifizierende Klinik fand.",
};
const qualityScopeNotes: Record<Locale, string> = {
  en:"Scope matters: Clinics in cohort is specifically filtered by first-attempt date and referral. The other clinic-level diagnostics cover the eligible Mission without the period filter (while honoring country access and referral selection). Calls without a matched clinic is Mission-call scoped under available country access and is not narrowed by referral. These diagnostic counts are not additive clinic outcomes.",
  sk:"Rozsah je dôležitý: Kliniky v kohorte sú filtrované dátumom prvého pokusu a odporúčaním. Ostatné diagnostiky na úrovni kliník pokrývajú oprávnenú misiu bez filtra obdobia (pri zachovaní krajiny a odporúčania). Hovory bez priradenej kliniky sú v rozsahu hovorov misie podľa dostupného prístupu ku krajinám a filter odporúčania ich nezužuje. Tieto diagnostické počty nie sú sčítateľnými výsledkami kliník.",
  cs:"Rozsah je důležitý: Kliniky v kohortě jsou filtrovány datem prvního pokusu a doporučením. Ostatní diagnostiky na úrovni klinik pokrývají oprávněnou misi bez filtru období (při zachování země a doporučení). Hovory bez přiřazené kliniky jsou v rozsahu hovorů mise podle dostupného přístupu k zemím a filtr doporučení je nezužuje. Tyto diagnostické počty nejsou sčitatelné výsledky klinik.",
  hu:"A hatókör lényeges: A Kohorsz klinikái az első próbálkozás dátuma és az ajánlás szerint szűrtek. A többi klinikaszintű diagnosztika a jogosult Missiont fedi le időszakszűrés nélkül (az ország- és ajánlási hozzáférés megtartásával). A klinikához nem rendelt hívások Mission-szintűek, az elérhető ország-hozzáférés szerint, és az ajánlási szűrő nem szűkíti őket. Ezek a diagnosztikai értékek nem összeadható klinikai eredmények.",
  ro:"Domeniul contează: Clinicile din cohortă sunt filtrate după data primei încercări și recomandare. Celelalte diagnostice la nivel de clinică acoperă Mission eligibilă fără filtrul perioadei (păstrând accesul pe țară și recomandarea). Apelurile fără clinică asociată sunt la nivelul Mission, în limita accesului pe țară, și nu sunt restrânse de filtrul de recomandare. Aceste valori de diagnostic nu sunt rezultate clinice aditive.",
  it:"L'ambito è importante: le Cliniche nella coorte sono filtrate per data del primo tentativo e referral. Le altre diagnostiche per clinica coprono la Mission idonea senza filtro periodo (rispettando paese e referral). Le chiamate senza clinica associata sono a livello Mission, entro l'accesso paese disponibile, e non sono ristrette dal filtro referral. Questi conteggi diagnostici non sono esiti di cliniche da sommare.",
  de:"Der Umfang ist wichtig: Kliniken in der Kohorte werden nach Datum des ersten Versuchs und Empfehlung gefiltert. Die übrigen Klinikdiagnosen umfassen die berechtigte Mission ohne Zeitraumfilter (unter Beachtung von Länderzugriff und Empfehlung). Anrufe ohne zugeordnete Klinik sind Mission-weit im Rahmen des Länderzugriffs und werden nicht durch den Empfehlungsfilter eingeschränkt. Diese Diagnosewerte sind keine addierbaren Klinik-Ergebnisse.",
};
const combinedRuleNotes: Record<Locale, string> = {
  en:"Cooperating is the clinic-level OR union of two same-enrollment patterns: validated contract + agreement + accepted/other proposal response, OR explicit cooperation without contract + agreement + explicitly unaccepted proposal. Each clinic counts once even if both patterns apply.",
  sk:"Spolupracuje je zjednotenie ALEBO na úrovni kliniky dvoch vzorov v rovnakom zaradení: overená zmluva + súhlas + prijatá/iná odpoveď, ALEBO výslovná spolupráca bez zmluvy + súhlas + výslovne neprijatý návrh. Klinika sa počíta raz, aj keď spĺňa oba vzory.",
  cs:"Spolupracuje je sjednocení NEBO na úrovni kliniky dvou vzorů ve stejném zařazení: ověřená smlouva + souhlas + přijatá/jiná odpověď, NEBO výslovná spolupráce bez smlouvy + souhlas + výslovně nepřijatá nabídka. Klinika se počítá jednou, i když splní oba vzory.",
  hu:"Az Együttműködik klinikaszintű VAGY-uniója két, azonos beiratkozáson bizonyított mintának: ellenőrzött szerződés + beleegyezés + elfogadott/egyéb válasz, VAGY kifejezett szerződés nélküli együttműködés + beleegyezés + kifejezetten el nem fogadott ajánlat. A klinika akkor is egyszer számít, ha mindkét mintát teljesíti.",
  ro:"Colaborează este uniunea SAU la nivel de clinică a două tipare dovedite pe aceeași înscriere: contract validat + acord + răspuns acceptat/altul, SAU confirmare explicită de colaborare fără contract + acord + propunere explicit neacceptată. Clinica se numără o singură dată chiar dacă îndeplinește ambele tipare.",
  it:"Collabora è l'unione OR a livello di clinica di due modelli provati sulla stessa iscrizione: contratto convalidato + accordo + risposta accettata/altra, OPPURE conferma esplicita di collaborazione senza contratto + accordo + proposta esplicitamente non accettata. La clinica conta una volta anche se soddisfa entrambi.",
  de:"Kooperiert ist die klinikbezogene ODER-Vereinigung zweier auf derselben Einschreibung belegter Muster: validierter Vertrag + Zustimmung + angenommene/andere Antwort ODER ausdrückliche Kooperation ohne Vertrag + Zustimmung + ausdrücklich nicht angenommenes Angebot. Eine Klinik zählt auch bei beiden Mustern nur einmal.",
};
const packageSentRuleNotes: Record<Locale, string> = {
  en:"Package sent means there is proof that the whole package was sent, or valid existing component/exclusion proof. It has no cooperation prerequisite and is independent of Cooperating. Its previous-stage percentage is intentionally not applicable; its Qualified percentage keeps the standard Qualified baseline.",
  sk:"Balík odoslaný znamená dôkaz o odoslaní celého balíka alebo platný existujúci dôkaz o súčastiach/vylúčení. Nevyžaduje spoluprácu a je nezávislý od kroku Spolupracuje. Percento voči predchádzajúcemu kroku sa zámerne nepoužíva; percento z kvalifikovaných zachováva bežný menovateľ Kvalifikované.",
  cs:"Balíček odeslán znamená důkaz o odeslání celého balíčku nebo platný existující důkaz o součástech/vyloučení. Nevyžaduje spolupráci a je nezávislý na kroku Spolupracuje. Procento vůči předchozímu kroku se záměrně nepoužívá; procento z kvalifikovaných zachovává běžný jmenovatel Kvalifikované.",
  hu:"A Csomag elküldve a teljes csomag elküldésének bizonyítékát vagy meglévő, érvényes összetevő-/kizárási bizonyítékot jelent. Nem feltétele az együttműködés, és független az Együttműködik lépéstől. Az előző lépéshez viszonyított százalék szándékosan nem alkalmazható; a minősítettekhez viszonyított százalék a szokásos Minősített nevezőt használja.",
  ro:"Pachet trimis înseamnă dovada expedierii întregului pachet sau dovada existentă validă privind componentele/excluderea. Nu necesită colaborare și este independent de etapa Colaborează. Procentul față de etapa anterioară nu se aplică intenționat; procentul din clinicile calificate păstrează numitorul standard Calificat.",
  it:"Pacchetto spedito indica la prova dell'invio dell'intero pacchetto oppure una prova esistente e valida di componenti/esclusione. Non richiede collaborazione ed è indipendente dalla fase Collabora. La percentuale rispetto alla fase precedente non si applica intenzionalmente; quella sui qualificati mantiene il normale denominatore Qualificata.",
  de:"Paket versendet bedeutet: Nachweis, dass das gesamte Paket versendet wurde, oder ein gültiger bestehender Komponenten-/Ausschlussnachweis. Kooperation ist keine Voraussetzung; der Schritt ist unabhängig von Kooperiert. Ein Prozentsatz zum vorherigen Schritt ist absichtlich nicht anwendbar; der Prozentsatz der Qualifizierten verwendet weiterhin den üblichen Nenner Qualifiziert.",
};
const materialsOutcomeNotes: Record<Locale, string> = {
  en:"Materials retains its previous eligibility rule: cooperating AND package sent on the same enrollment. Its existing previous-percent denominator is unchanged; it is not recalculated against a newly broadened Cooperating population.",
  sk:"Materiály zachovávajú pôvodné pravidlo oprávnenosti: spolupracuje A balík odoslaný v rovnakom zaradení. Existujúci menovateľ percenta voči predchádzajúcemu zostáva nezmenený; neprepočítava sa voči novo rozšírenej populácii kroku Spolupracuje.",
  cs:"Materiály zachovávají původní pravidlo způsobilosti: spolupracuje A balíček odeslán v témže zařazení. Dosavadní jmenovatel předchozího procenta zůstává beze změny; nepřepočítává se vůči nově rozšířené populaci kroku Spolupracuje.",
  hu:"Az Anyagok megtartja a korábbi jogosultsági szabályt: együttműködik ÉS a csomag elküldve ugyanazon beiratkozáson. A korábbi százalék nevezője változatlan; nem számolódik újra az Együttműködik kibővített populációjára.",
  ro:"Materiale păstrează regula anterioară de eligibilitate: colaborează ȘI pachet trimis pe aceeași înscriere. Numitorul existent al procentului anterior rămâne neschimbat; nu se recalculează față de populația extinsă recent a etapei Colaborează.",
  it:"Materiali mantiene la precedente regola di idoneità: collabora E pacchetto spedito sulla stessa iscrizione. Il denominatore esistente della percentuale precedente resta invariato e non viene ricalcolato sulla popolazione ampliata di Collabora.",
  de:"Materialien behält die bisherige Anspruchsregel bei: kooperiert UND Paket versendet in derselben Einschreibung. Der bisherige Nenner des Vorher-Prozentsatzes bleibt unverändert und wird nicht anhand der neu erweiterten Population von Kooperiert neu berechnet.",
};
const legacySourceNotes: Record<Locale, string> = {
  en:"The legacy “Cooperating (explicit yes)” source may remain in saved configuration for reference, but it does not control the current contract cooperation calculation.",
  sk:"Starší zdroj „Spolupracuje (výslovné áno)“ môže zostať uložený na referenciu, ale neriadi aktuálny výpočet zmluvnej spolupráce.",
  cs:"Starší zdroj „Spolupracuje (výslovné ano)“ může zůstat uložený pro přehled, ale neřídí současný výpočet smluvní spolupráce.",
  hu:"A régi „Együttműködik (kifejezett igen)” forrás megmaradhat a mentett beállításban, de nem vezérli a jelenlegi szerződéses együttműködés számítását.",
  ro:"Sursa legacy „Colaborează (da explicit)” poate rămâne în configurația salvată ca referință, dar nu controlează calculul curent al colaborării contractuale.",
  it:"La fonte legacy “Collabora (sì esplicito)” può restare nella configurazione salvata come riferimento, ma non controlla il calcolo attuale della collaborazione contrattuale.",
  de:"Die ältere Quelle „Kooperiert (explizites Ja)“ kann als Referenz gespeichert bleiben, steuert aber nicht die aktuelle Berechnung der vertraglichen Kooperation.",
};
const contactBranchRefs: Record<Locale, string> = {
  en:"For the explicit no-contract requirements, see the separate Without contract chapter.",
  sk:"Požiadavky výslovnej vetvy Bez zmluvy nájdete v samostatnej kapitole Bez zmluvy.",
  cs:"Požadavky výslovné větve Bez smlouvy najdete v samostatné kapitole Bez smlouvy.",
  hu:"A kifejezett szerződés nélküli feltételeket a külön Szerződés nélkül fejezet ismerteti.",
  ro:"Cerințele explicite ale ramurii Fără contract sunt descrise în capitolul separat Fără contract.",
  it:"I requisiti espliciti del ramo Senza contratto sono descritti nel capitolo dedicato Senza contratto.",
  de:"Die ausdrücklichen Anforderungen des Zweigs Ohne Vertrag stehen im eigenen Kapitel Ohne Vertrag.",
};
const chapterNavigation: Record<Locale, Omit<MissionFunnelHelpLocale["chapters"], "without-contract" | "agents">> = {
  en:{scope:"Scope & cohort","contact-contract":"Contact and contract path",combined:"Combined outcomes",evidence:"Clinic evidence","exceptions-quality":"Exceptions & quality",configuration:"Configure evidence",sources:"All mapping sources","interpret-export":"Read & export the funnel"},
  sk:{scope:"Rozsah a kohorta","contact-contract":"Kontakt a zmluva",combined:"Kombinované výsledky",evidence:"Dôkazy kliniky","exceptions-quality":"Výnimky a kvalita",configuration:"Nastavenie dôkazov",sources:"Všetky zdroje mapovania","interpret-export":"Čítanie a export lievika"},
  cs:{scope:"Rozsah a kohorta","contact-contract":"Kontakt a smlouva",combined:"Kombinované výsledky",evidence:"Důkazy kliniky","exceptions-quality":"Výjimky a kvalita",configuration:"Nastavení důkazů",sources:"Všechny zdroje mapování","interpret-export":"Čtení a export trychtýře"},
  hu:{scope:"Hatókör és kohorsz","contact-contract":"Kapcsolat és szerződés",combined:"Összesített eredmények",evidence:"Klinikai bizonyíték","exceptions-quality":"Kivételek és minőség",configuration:"Bizonyíték beállítása",sources:"Minden leképezési forrás","interpret-export":"Értelmezés és export"},
  ro:{scope:"Domeniu și cohortă","contact-contract":"Contact și contract",combined:"Rezultate combinate",evidence:"Dovezi clinică","exceptions-quality":"Excepții și calitate",configuration:"Configurarea dovezilor",sources:"Toate sursele de mapare","interpret-export":"Interpretare și export"},
  it:{scope:"Ambito e coorte","contact-contract":"Contatto e contratto",combined:"Esiti combinati",evidence:"Prove della clinica","exceptions-quality":"Eccezioni e qualità",configuration:"Configura le prove",sources:"Tutte le fonti di mappatura","interpret-export":"Leggere ed esportare il funnel"},
  de:{scope:"Umfang und Kohorte","contact-contract":"Kontakt und Vertrag",combined:"Kombinierte Ergebnisse",evidence:"Kliniknachweise","exceptions-quality":"Ausnahmen und Qualität",configuration:"Nachweise konfigurieren",sources:"Alle Zuordnungsquellen","interpret-export":"Trichter lesen und exportieren"},
};
const correctedCombined: Record<Locale, string> = {
  en:combinedRuleNotes.en,
  sk:combinedRuleNotes.sk,
  cs:combinedRuleNotes.cs,
  hu:combinedRuleNotes.hu,
  ro:combinedRuleNotes.ro,
  it:combinedRuleNotes.it,
  de:combinedRuleNotes.de,
};
const stageEn: Record<MissionFunnelHelpStep, string> = {
  assigned:"Currently assigned clinics across the eligible Mission, independent of period; this is not a conversion step.",
  dialed:"The clinic's earliest eligible outbound attempt; legacy first-attempt evidence may be provisional.",
  connected:"Direct evidence is a linked call with a recorded answer time and positive duration; supported Qualified or Agreed evidence may also infer Reached.",
  qualified:"A mapped positive qualification confirmation; may also be inferred from supported later agreement evidence.",
  agreed:"A mapped cooperation-agreement confirmation; supported later evidence may infer this predecessor.",
  wantsContract:"Agreement plus an accepted or other proven eligible proposal response; supported later contract evidence may infer it.",
  withoutContract:"Agreement plus an explicit unaccepted proposal on the same enrollment; missing proposal response does not qualify.",
  email:"This step's own mapped confirmation that the proposal email was sent; it may also be inferred from later proven contract evidence.",
  wantsToSign:"Agreement plus accepted proposal; later proven contract evidence may infer it, but an explicit considering response is not acceptance.",
  sent:"This step's own mapped contract-sent confirmation; later proven contract evidence may infer it.",
  received:"This step's own mapped confirmation that the contract was delivered to the doctor; later proven evidence may infer it.",
  returned:"This step's own mapped contract-returned confirmation; later proven evidence may infer it.",
  validated:"This step's own mapped contract-validated confirmation; it is the final contract-path milestone.",
  cooperating:"Clinic-level union of the two proven cooperation patterns on the same enrollment, counted once.",
  packageSent:"Proof that the whole package was sent, or valid existing component/exclusion proof; cooperation is not required. No previous-stage percentage applies because this is independent; its Qualified percentage uses the standard Qualified baseline.",
  materials:"The existing eligibility rule: cooperating AND package sent on the same enrollment. Its existing previous-percent denominator is unchanged.",
};
const stageMaps: Record<Locale, Record<MissionFunnelHelpStep, string>> = {
  en:stageEn,
  sk:{
    ...sk.stages,
    connected:"Priamy dôkaz je prepojený hovor so zaznamenanou odpoveďou a kladným trvaním; podporený dôkaz Kvalifikované alebo Súhlasí môže krok tiež odvodiť.",
    sent:"Vlastné namapované potvrdenie odoslania zmluvy; chýbajúci krok možno odvodiť z neskoršieho podporeného zmluvného dôkazu.",
    received:"Vlastné namapované potvrdenie doručenia zmluvy lekárovi; chýbajúci krok možno odvodiť z neskoršieho podporeného dôkazu.",
    returned:"Vlastné namapované potvrdenie vrátenia zmluvy; chýbajúci krok možno odvodiť z neskoršieho podporeného dôkazu.",
    validated:"Vlastné namapované potvrdenie overenia zmluvy; posledný míľnik zmluvnej cesty.",
  },
  cs:stageCs, hu:stageHu, ro:stageRo, it:stageIt, de:stageDe,
};
const sourceEn: Record<FunnelSource, string> = {
  qualified:"The actual mapped positive-choice item for qualification.",
  agreed:"Explicit mapped agreement to cooperate.",
  proposalAccepted:"Explicit proposal acceptance; supports Wants a contract and Wants to sign.",
  proposalUnaccepted:"Explicit proposal non-acceptance; with agreement, supports the separate Without contract branch.",
  proposalOther:"A supported other proposal response; it is not acceptance or a sign-intent answer.",
  email:"Mapped Status List confirmation that the proposal email was sent; not proof of SMTP delivery or reading.",
  sent:"This source's own mapped confirmation that the contract was sent.",
  received:"This source's own mapped confirmation that the contract was delivered to the doctor.",
  returned:"This source's own mapped confirmation that the contract was returned.",
  validated:"This source's own mapped confirmation that the contract was validated.",
  activeWith:"Legacy saved source only; it does not control the current contract-cooperation calculation.",
  activeWithout:"Explicit mapped confirmation of cooperation without a contract; agreement and an unaccepted proposal are also required.",
  materials17:"MPN-13d: cord-blood information materials sent.",
  materials18:"MPN-14d: waiting-room leaflets sent.",
  materials19:"MPN-15d: pregnancy booklets sent.",
  unqualified:"Current mapped unqualified status.",
  refused:"Current mapped refusal status; first known confirmation anchors the informational six-month return date.",
  absent:"Current mapped long-term-absence status; a configured valid return date can remove the exception.",
  wrongNumber:"Current mapped incorrect-number status.",
  notWorking:"Current mapped non-functional-number status.",
};
const sourceSk: Record<FunnelSource, string> = {
  ...sk.sources,
  materials17:"Kód MPN-13d: odoslané informačné materiály o pupočníkovej krvi.",
  materials18:"Kód MPN-14d: odoslané letáky do čakárne.",
  materials19:"Kód MPN-15d: odoslané tehotenské knižky.",
};
const sourceMaps: Record<Locale, Record<FunnelSource, string>> = {
  en:sourceEn, sk:sourceSk, cs:sourceCs, hu:sourceHu, ro:sourceRo, it:sourceIt, de:sourceDe,
};
const exceptionMaps: Record<Locale, Record<FunnelException, string>> = {
  en:{
    unqualified:"Current mapped unqualified state; may overlap funnel milestones.",
    refused:"Current mapped refusal state; six-calendar-month return date is informational only.",
    unreachable:"Five consecutive unsuccessful outbound attempts marked busy or no answer, or active long-term absence.",
    absent:"Current long-term absence; removed on or after a configured valid return date.",
    wrongNumber:"Current mapped incorrect-number state.",
    notWorking:"Current mapped non-functional-number state.",
  },
  sk:{
    unqualified:"Aktuálny namapovaný stav nekvalifikovanosti; môže sa prekrývať s míľnikmi.",
    refused:"Aktuálny namapovaný stav odmietnutia; šesťmesačný dátum návratu je iba informačný.",
    unreachable:"Päť po sebe idúcich neúspešných odchádzajúcich pokusov označených ako obsadené alebo bez odpovede, prípadne aktívna dlhodobá neprítomnosť.",
    absent:"Aktuálna dlhodobá neprítomnosť; odstraňuje sa v deň platného dátumu návratu alebo po ňom.",
    wrongNumber:"Aktuálny namapovaný stav nesprávneho čísla.",
    notWorking:"Aktuálny namapovaný stav nefunkčného čísla.",
  },
  cs:exceptionCs, hu:exceptionHu, ro:exceptionRo, it:exceptionIt, de:exceptionDe,
};
const contentCorrections: Record<Locale, { chapterTitle: string; contactReference: string; qualityScope: string; qualityDetails: string; legacySource: string }> = {
  en:{chapterTitle:withoutContractTitles.en,contactReference:contactBranchRefs.en,qualityScope:qualityScopeNotes.en,qualityDetails:"The individual definitions below describe what each quality value counts and its scope.",legacySource:legacySourceNotes.en},
  sk:{chapterTitle:withoutContractTitles.sk,contactReference:contactBranchRefs.sk,qualityScope:qualityScopeNotes.sk,qualityDetails:"Jednotlivé definície nižšie vysvetľujú význam a rozsah každého ukazovateľa kvality.",legacySource:legacySourceNotes.sk},
  cs:{chapterTitle:withoutContractTitles.cs,contactReference:contactBranchRefs.cs,qualityScope:qualityScopeNotes.cs,qualityDetails:"Jednotlivé definice níže vysvětlují význam a rozsah každého ukazatele kvality.",legacySource:legacySourceNotes.cs},
  hu:{chapterTitle:withoutContractTitles.hu,contactReference:contactBranchRefs.hu,qualityScope:qualityScopeNotes.hu,qualityDetails:"Az alábbi külön meghatározások ismertetik mindegyik minőségi érték jelentését és hatókörét.",legacySource:legacySourceNotes.hu},
  ro:{chapterTitle:withoutContractTitles.ro,contactReference:contactBranchRefs.ro,qualityScope:qualityScopeNotes.ro,qualityDetails:"Definițiile individuale de mai jos explică semnificația și domeniul fiecărui indicator de calitate.",legacySource:legacySourceNotes.ro},
  it:{chapterTitle:withoutContractTitles.it,contactReference:contactBranchRefs.it,qualityScope:qualityScopeNotes.it,qualityDetails:"Le definizioni seguenti spiegano singolarmente il significato e l'ambito di ciascun indicatore di qualità.",legacySource:legacySourceNotes.it},
  de:{chapterTitle:withoutContractTitles.de,contactReference:contactBranchRefs.de,qualityScope:qualityScopeNotes.de,qualityDetails:"Die folgenden Einzeldefinitionen erläutern Bedeutung und Umfang jedes Qualitätswerts.",legacySource:legacySourceNotes.de},
};

export const missionFunnelHelpTranslations: Record<Locale, MissionFunnelHelpLocale> = Object.fromEntries(
  (Object.keys(baseTranslationSet) as Locale[]).map(locale => {
    const base = baseTranslationSet[locale];
    const corrections = contentCorrections[locale];
    const chapterContent = {
      ...base.content,
      scope: [...base.content.scope, missionFunnelTranslations[locale].referralHelp],
      "without-contract": [cooperationRuleCopy[locale].without, base.content.combined[3]],
      agents: agentFunnelTranslations[locale].helpParagraphs,
      combined: [cooperationRuleCopy[locale].contract, cooperationRuleCopy[locale].without,
        standaloneCooperationCopy[locale], base.content.combined[1],
        packageSentRuleNotes[locale], materialsOutcomeNotes[locale], base.content.combined[3], optionalPosterCopy[locale]],
      configuration: [
        base.content.configuration[0],
        mappingRuleNotes[locale],
        ...base.content.configuration.slice(2, -1).map((paragraph, index) => index === 0 ? materialsOutcomeNotes[locale] : paragraph),
        finalConfigNotes[locale],
      ],
      sources: [
        ...base.content.sources.slice(0, 4),
        corrections.legacySource,
        packageSentRuleNotes[locale],
        materialsOutcomeNotes[locale],
        ...base.content.sources.slice(6),
      ],
      "contact-contract": [
        ...base.content["contact-contract"].slice(0, 1),
        reachedNotes[locale],
        ...base.content["contact-contract"].slice(2, -1),
        `${base.content["contact-contract"].at(-1)} ${corrections.contactReference}`,
      ],
      "exceptions-quality": [
        ...base.content["exceptions-quality"].slice(0, 1),
        unavailableNotes[locale],
        ...base.content["exceptions-quality"].slice(2, 4),
        corrections.qualityScope,
        corrections.qualityDetails,
      ],
      "interpret-export": [
        ...base.content["interpret-export"].map((paragraph, index) => {
          if (index === 1) return `${packageSentRuleNotes[locale]} ${materialsOutcomeNotes[locale]}`;
          return index === 4 ? mappingRuleNotes[locale] : paragraph;
        }),
        exportScopeTranslations[locale].help,
      ],
    };
    return [locale, {
      ...base,
      ...helpLabels[locale],
      chapters: { ...chapterNavigation[locale], "without-contract": corrections.chapterTitle, agents: agentFunnelTranslations[locale].title },
      content: chapterContent,
      stages: { ...stageMaps[locale], withoutContract: cooperationRuleCopy[locale].without,
        cooperating: `${cooperationRuleCopy[locale].contract} ${cooperationRuleCopy[locale].without} ${standaloneCooperationCopy[locale]}`,
        packageSent: packageSentRuleNotes[locale],
        materials: materialsOutcomeNotes[locale] },
      sources: { ...sourceMaps[locale], activeWithout: cooperationRuleCopy[locale].without },
      exceptions: exceptionMaps[locale],
      quality: qualityDetailed[locale],
      basis: basisDetailed[locale],
    }];
  }),
) as Record<Locale, MissionFunnelHelpLocale>;
