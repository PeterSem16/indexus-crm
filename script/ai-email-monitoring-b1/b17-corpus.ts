import crypto from "node:crypto";
import type { B13Expected } from "./b13-corpus";
import { B13_FIELDS } from "./b13-corpus";
import { B14_CORPUS } from "./b14-corpus";
import { emailMonitoringSchema } from "../../server/lib/ai/email-monitoring-contract";

export const B17_CATEGORIES = Object.freeze({
  neutral: "Bežná neutrálna komunikácia", consent: "Výslovný súhlas so zmluvou",
  conditionalConsent: "Nejednoznačný alebo podmienený súhlas",
  rejection: "Odmietnutie novej ponuky bez zrušenia služby",
  cancellation: "Výslovné zrušenie existujúcej služby",
  indirectCancellation: "Nepriame alebo nejednoznačné zrušenie",
  complaint: "Vecné sťažnosti a reklamácie", angry: "Nahnevaná, agresívna alebo vulgárna komunikácia",
  mixed: "Zmiešané požiadavky a protichodné vyjadrenia",
  complex: "Ironické, neúplné alebo jazykovo komplikované správy",
});
export type B17Expected = { [K in keyof B13Expected]: B13Expected[K] | null };
const base: B17Expected = { sentiment: "neutral", hasInappropriateContent: false, hasAngryTone: false,
  hasRudeExpressions: false, wantsToCancel: false, wantsConsent: false, doesNotAcceptContract: false, alertLevel: "none" };
function item(n: number, category: keyof typeof B17_CATEGORIES, language: "sk" | "cs" | "en" | "hu",
  input: string, patch: Partial<B17Expected> = {}, reviewReason: string | null = null) {
  return Object.freeze({ id: `SYN-B17-${String(n).padStart(3, "0")}`, category, language, input,
    expected: Object.freeze({ ...base, ...patch }), reviewReason });
}
const yes = { sentiment: "positive", wantsConsent: true } as const;
const no = { sentiment: "negative", doesNotAcceptContract: true, alertLevel: "warning" } as const;
const cancel = { wantsToCancel: true, alertLevel: "critical" } as const;
const complaint = { sentiment: "negative", alertLevel: "critical" } as const;
const angry = { sentiment: "angry", hasAngryTone: true, alertLevel: "critical" } as const;
const rude = { ...angry, hasRudeExpressions: true } as const;
const vulgar = { ...rude, hasInappropriateContent: true } as const;
const maybe = "Znenie neurčuje jednoznačne záväzný aktuálny úmysel; označené polia musí posúdiť hodnotiteľ.";
const tone = "Bez kontextu nemožno spoľahlivo určiť tón ani naliehavosť; nevnucovať jedinú interpretáciu.";

/** Authored before inference. Synthetic only. Null is unresolved gold, never a model-correct wildcard. */
export const B17_CORPUS = Object.freeze([
  item(1, "neutral", "sk", "Na ktorú adresu máme poslať originál žiadosti o zmenu korešpondenčných údajov?"),
  item(2, "neutral", "sk", "dobry den, da sa vyziadat kopia potvrdenia o ulozeni vzorky cez zakaznicky portal?"),
  item(3, "neutral", "sk", "V návode vidím dve prílohy, ale stiahla sa iba jedna. Kde je dostupný druhý formulár? Ide mi len o postup stiahnutia."),
  item(4, "neutral", "cs", "Můžete mi napsat, zda lze změnu kontaktního telefonu vyřídit elektronicky?"),
  item(5, "neutral", "cs", "V patek budu mimo republiku. Dokument, o kterem jsme mluvili, poslu v pondeli dopoledne."),
  item(6, "neutral", "cs", "Prosím o seznam podkladů potřebných pro aktualizaci doručovací adresy, nikoli o změnu smlouvy."),
  item(7, "neutral", "en", "Where in the portal can I download last year's storage confirmation? I only need the document location."),
  item(8, "neutral", "en", "The attachment will follow in a separate message tomorrow. This email is just to let you know the delivery date."),
  item(9, "neutral", "hu", "Hol találom az ügyfélportálon a tárolási igazolás letöltésére szolgáló menüpontot?"),
  item(10, "neutral", "hu", "Kérem, írják meg, milyen dokumentumok szükségesek a levelezési cím módosításához."),
  item(11, "consent", "sk", "Teší ma, že sme všetko vysvetlili. Aktuálny návrh zmluvy prijímam bez výhrad a súhlasím s jeho uzavretím.", yes),
  item(12, "consent", "sk", "Som spokojna s ponukou. Zavazne suhlasim s touto zmluvou vratane ceny a vsetkych priloh.", yes),
  item(13, "consent", "sk", "Ďakujem za ochotu, výsledok ma potešil. Potvrdzujem svoj výslovný súhlas s uzavretím predloženej zmluvy, nie iba prijatie dokumentu.", yes),
  item(14, "consent", "cs", "Jsem s konečným návrhem spokojená a tímto ho bez dalších podmínek přijímám. Souhlasím s uzavřením smlouvy.", yes),
  item(15, "consent", "cs", "Vyborne, nabidka mi vyhovuje. Davam zavazny souhlas se smlouvou v zaslane podobe.", yes),
  item(16, "consent", "cs", "Děkuji za příjemné vysvětlení. Mám radost, že jsme se dohodli; se všemi ustanoveními předložené smlouvy výslovně souhlasím.", yes),
  item(17, "consent", "en", "I'm delighted with the final offer. I explicitly accept this contract, including its price and terms, without conditions.", yes),
  item(18, "consent", "en", "Thank you for the excellent support. I am happy to give my binding consent to enter into the attached agreement as written.", yes),
  item(19, "consent", "hu", "Örülök a végleges ajánlatnak. A megküldött szerződést minden feltételével együtt, fenntartás nélkül elfogadom.", yes),
  item(20, "consent", "hu", "Köszönöm a kedves segítséget, elégedett vagyok. Ezennel kifejezetten hozzájárulok a mellékelt szerződés megkötéséhez.", yes),
  item(21, "conditionalConsent", "sk", "Zmluvu odsúhlasím až po doručení nového cenníka. Dnes ešte záväzný súhlas nedávam."),
  item(22, "conditionalConsent", "sk", "asi ano, len sa na to musim este pozriet", { wantsConsent: null }, maybe),
  item(23, "conditionalConsent", "sk", "Ponuka vyzerá prijateľne, ale najprv potrebujem stanovisko partnera. Zatiaľ iba potvrdzujem, že ju mám."),
  item(24, "conditionalConsent", "cs", "Souhlasit budu teprve tehdy, až opravíte adresu ve smlouvě. Tato zpráva ještě není souhlas."),
  item(25, "conditionalConsent", "cs", "Za me by to slo, pokud zustane cena. Tak to nejak zaridte.", { wantsConsent: null }, maybe),
  item(26, "conditionalConsent", "cs", "Návrh nyní jen posuzuji. Konečné rozhodnutí o přijetí smlouvy pošlu samostatně."),
  item(27, "conditionalConsent", "en", "I will agree only after my adviser reviews the final wording. Please do not treat this message as acceptance."),
  item(28, "conditionalConsent", "en", "Looks fine, I suppose. Go ahead if everything is as discussed.", { wantsConsent: null }, maybe),
  item(29, "conditionalConsent", "hu", "Csak az új díjszabás kézhezvétele után adok hozzájárulást. Ez az üzenet még nem elfogadás."),
  item(30, "conditionalConsent", "hu", "Részemről talán rendben, ha valóban ugyanaz marad minden. Intézhetik.", { wantsConsent: null }, maybe),
  item(31, "rejection", "sk", "Nové cenové podmienky pokladám za nevýhodné, a preto túto doplnkovú zmluvu odmietam. Existujúce uchovanie ponechajte bez zmeny.", no),
  item(32, "rejection", "sk", "Vyssie poplatky noveho balika mi nevyhovuju. Ponukany dodatok neprijimam; sucasnu sluzbu nerusim.", no),
  item(33, "rejection", "sk", "Rozšírenie je pre mňa pridrahé. Nesúhlasím s predloženou novou ponukou, nie s pokračovaním platnej služby.", no),
  item(34, "rejection", "cs", "Příplatek v novém návrhu považuji za nevýhodný a návrh odmítám. Současná smlouva má dál platit.", no),
  item(35, "rejection", "cs", "Nabizene rozsireni mi cenove nevyhovuje, novou smlouvu neprijimam. Stavajici sluzbu ponechte aktivni.", no),
  item(36, "rejection", "cs", "S podmínkami nové nabídky nejsem spokojená a odmítám je. Nežádám tím o ukončení dosavadního uchování.", no),
  item(37, "rejection", "en", "The proposed upgrade is too expensive and its terms are unacceptable to me. I reject the new agreement, but keep my existing service active.", no),
  item(38, "rejection", "en", "I am dissatisfied with the new offer and will not accept that contract. This is not a request to cancel my current storage arrangement.", no),
  item(39, "rejection", "hu", "Az új csomag feltételei számomra kedvezőtlenek, ezért az ajánlott szerződést elutasítom. A jelenlegi szolgáltatást nem mondom fel.", no),
  item(40, "rejection", "hu", "Nem vagyok elégedett az új ajánlat árával, a kiegészítő szerződést nem fogadom el. A meglévő tárolás maradjon változatlan.", no),
  item(41, "cancellation", "sk", "Moju aktuálnu službu uchovania týmto vypovedám. Ukončite ju, prosím, po uplynutí platnej výpovednej lehoty.", cancel),
  item(42, "cancellation", "sk", "prosim deaktivujte moje existujuce predplatne a ukoncite jeho poskytovanie. Je to ziadost o zrusenie, nie otazka na cenu.", cancel),
  item(43, "cancellation", "sk", "Rozhodnutie je konečné: žiadam ukončiť dnes platnú službu. Prosím o potvrdenie prijatia tejto výpovede.", cancel),
  item(44, "cancellation", "cs", "Tímto podávám výpověď své stávající smlouvy. Prosím o ukončení nyní aktivní služby v řádném termínu.", cancel),
  item(45, "cancellation", "cs", "Moje soucasne predplatne prosim zruste. Dalsi poskytovani teto sluzby uz nepozaduji.", cancel),
  item(46, "cancellation", "cs", "Prosím proveďte ukončení platné služby uchování. Tato zpráva představuje mou výslovnou žádost o její zrušení.", cancel),
  item(47, "cancellation", "en", "Please terminate my currently active storage service at the end of the contractual notice period. This is my formal cancellation request.", cancel),
  item(48, "cancellation", "en", "I hereby cancel my existing subscription. Please stop providing it and confirm the effective termination date.", cancel),
  item(49, "cancellation", "hu", "Ezennel felmondom a jelenleg érvényes tárolási szolgáltatásomat. Kérem annak megszüntetését a felmondási idő végén.", cancel),
  item(50, "cancellation", "hu", "Kérem, szüntessék meg a most aktív előfizetésemet. Ez kifejezett felmondási kérelem.", cancel),
  item(51, "indirectCancellation", "sk", "Ak by som raz chcel skončiť, aká by bola výpovedná lehota? Teraz iba zisťujem podmienky, nič nerušte."),
  item(52, "indirectCancellation", "sk", "Už to asi nebudeme potrebovať. Viete to nejako uzavrieť?", { wantsToCancel: null, alertLevel: null }, maybe),
  item(53, "indirectCancellation", "sk", "Po tomto mesiaci uz so mnou radsej nepocitajte.", { wantsToCancel: null, sentiment: null, alertLevel: null }, maybe),
  item(54, "indirectCancellation", "cs", "Zajímá mě pouze postup případné výpovědi. Zatím se nerozhoduji a službu prosím nerušte."),
  item(55, "indirectCancellation", "cs", "Asi bychom to nechali byt. Co s tim muzete udelat?", { wantsToCancel: null, alertLevel: null }, maybe),
  item(56, "indirectCancellation", "cs", "Dalsi rok uz nejspis ne. Berte to prosim na vedomi.", { wantsToCancel: null, alertLevel: null }, maybe),
  item(57, "indirectCancellation", "en", "What would happen if I cancelled next year? This is an information request, not an instruction to end the service."),
  item(58, "indirectCancellation", "en", "I don't really see us needing this anymore. Can you close things out somehow?", { wantsToCancel: null, alertLevel: null }, maybe),
  item(59, "indirectCancellation", "hu", "Mennyi lenne a felmondási idő, ha később megszüntetném? Most csak tájékozódom, ne mondják fel a szolgáltatást."),
  item(60, "indirectCancellation", "hu", "Talán már nem lesz rá szükségünk. Le lehet ezt valahogy zárni?", { wantsToCancel: null, alertLevel: null }, maybe),
  item(61, "complaint", "sk", "Podávam reklamáciu duplicitného ročného poplatku. Účtovaná suma je nesprávna; žiadam opraviť vyúčtovanie a vrátiť preplatok.", complaint),
  item(62, "complaint", "sk", "Reklamujem chybny datum na vystavenom potvrdeni. Tento udaj nezodpoveda dorucenym podkladom a ziadam napravu.", complaint),
  item(63, "complaint", "sk", "Uplatňujem sťažnosť na nedodržaný termín zaslania výsledku. Termín uvedený v potvrdení už uplynul. Prosím o nápravu, službu nezrušujte.", complaint),
  item(64, "complaint", "cs", "Reklamuji neoprávněně naúčtovaný poplatek za změnu adresy. V přehledu je chyba a žádám její opravu.", complaint),
  item(65, "complaint", "cs", "Podavam stiznost na chybne uvedene obdobi ve vyuctovani. Pozaduji opravny doklad.", complaint),
  item(66, "complaint", "cs", "Uplatňuji reklamaci: slíbené potvrzení nepřišlo ve sjednané lhůtě. Prosím o vyřízení této stížnosti a zaslání dokumentu.", complaint),
  item(67, "complaint", "en", "I am filing a formal complaint about a duplicate storage charge. The statement is incorrect; please correct it and refund the overpayment.", complaint),
  item(68, "complaint", "en", "This is a formal complaint concerning the missed delivery deadline for my certificate. Please remedy the delay; do not cancel the service.", complaint),
  item(69, "complaint", "hu", "Hivatalos panaszt teszek a kétszer felszámított tárolási díj miatt. Az elszámolás hibás, kérem annak javítását.", complaint),
  item(70, "complaint", "hu", "Reklamációt nyújtok be az igazoláson szereplő hibás dátum miatt. Kérem a téves adat helyesbítését.", complaint),
  item(71, "angry", "sk", "Som nahnevaná a veľmi frustrovaná! Tretíkrát žiadam odpoveď, tak ma už neignorujte!", angry),
  item(72, "angry", "sk", "Vy arogantní neschopáci, začnite sa konečne venovať mojej žiadosti! Toto ma poriadne vytáča!", rude),
  item(73, "angry", "sk", "Do piče, už mám toho vášho bordelu plné zuby! Prestaňte ma konečne nasierať a odpovedzte!", vulgar),
  item(74, "angry", "cs", "Jsem opravdu naštvaný a rozčilený! Už nemám trpělivost, přestaňte mou žádost ignorovat!", angry),
  item(75, "angry", "cs", "Vy neschopní hlupáci, okamžitě začněte pracovat! Tohle vaše jednání mě vytáčí!", rude),
  item(76, "angry", "cs", "Do prdele, co je to za zasraný bordel! Už mě tím svým přístupem vážně serete!", vulgar),
  item(77, "angry", "en", "I am furious and extremely frustrated! Stop ignoring my messages and answer me now!", angry),
  item(78, "angry", "en", "You fucking idiots, this is total bullshit! I am sick of this mess, deal with my request now!", vulgar),
  item(79, "angry", "hu", "Nagyon dühös és csalódott vagyok! Ne hagyják tovább válasz nélkül az üzeneteimet!", angry),
  item(80, "angry", "hu", "Bassza meg, ez egy kurva nagy szar! Elegem van ebből a kibaszott rendetlenségből, azonnal válaszoljanak!", vulgar),
  item(81, "mixed", "sk", "Pošlite mi kópiu potvrdenia a zároveň zrušte moje aktívne predplatné. Obe tieto žiadosti platia.", cancel),
  item(82, "mixed", "sk", "Súhlasím, vlastne ešte nie. Radšej počkajte. Ale ak treba, vybavte to.", { wantsConsent: null }, maybe),
  item(83, "mixed", "sk", "Žiadam opraviť chybne vyúčtovaný poplatok a ukončiť moju existujúcu službu. Uplatňujem reklamáciu aj výpoveď.", { ...complaint, ...cancel }),
  item(84, "mixed", "cs", "Zrušte mou službu. Ne, nezrušte ji. Rozhodněte podle toho, co jsme řešili minule.", { wantsToCancel: null, alertLevel: null }, maybe),
  item(85, "mixed", "cs", "Novy drazsi balik je nevyhodny a jeho smlouvu odmitam. Puvodni sluzbu zachovejte a poslete mi kopii dokladu.", no),
  item(86, "mixed", "cs", "Děkuji, jsem velmi spokojená. Novou smlouvu výslovně přijímám bez podmínek; zároveň prosím o změnu korespondenční adresy.", yes),
  item(87, "mixed", "en", "I accept the contract. On second thought, hold off. Unless the deadline is today, then proceed.", { wantsConsent: null }, maybe),
  item(88, "mixed", "en", "Please send a copy of my statement and terminate my existing subscription. Both requests are intentional.", cancel),
  item(89, "mixed", "hu", "Az új ajánlat ára kedvezőtlen, ezért azt elutasítom. A jelenlegi szolgáltatás maradjon aktív, és kérek róla egy igazolást.", no),
  item(90, "mixed", "hu", "Mondják fel a szolgáltatást, vagy inkább mégse. Ha szükséges, intézzék úgy, ahogy jónak látják.", { wantsToCancel: null, alertLevel: null }, maybe),
  item(91, "complex", "sk", "No výborne. Naozaj výborne.", { sentiment: null, hasAngryTone: null, alertLevel: null }, tone),
  item(92, "complex", "sk", "áno... teda k tomu druhému, nie k zmluve. zvyšok potom.", { wantsConsent: true }),
  item(93, "complex", "sk", "V ukážke odpovede stojí „zrušte službu“. Citujem iba text z návodu; sám teraz o zrušenie nežiadam."),
  item(94, "complex", "cs", "Tak to je teda paráda, že jo.", { sentiment: null, hasAngryTone: null, alertLevel: null }, tone),
  item(95, "complex", "cs", "ne ze bych nesouhlasil, ale ani nerikam ze ano. nic zatim nepotvrzuju."),
  item(96, "complex", "cs", "Pokud píšu „neukončujte“, znamená to zachovat službu. Právě o to žádám: neukončujte ji."),
  item(97, "complex", "en", "Great. Just great.", { sentiment: null, hasAngryTone: null, alertLevel: null }, tone),
  item(98, "complex", "en", "The phrase 'I accept the contract' is quoted from your sample. I am not giving consent in this message."),
  item(99, "complex", "hu", "Hát ez aztán remek.", { sentiment: null, hasAngryTone: null, alertLevel: null }, tone),
  item(100, "complex", "hu", "Az útmutatóban az áll: „mondja fel”. Ezt csak idézem, én most nem kérem a szolgáltatás megszüntetését."),
]);
export const B17_CORPUS_SHA256 = crypto.createHash("sha256").update(JSON.stringify(B17_CORPUS)).digest("hex");
export const B17_POLICY = Object.freeze({
  fieldTargetPct: 98, caseTargetPct: 95, technicalCases: 100, maxAttempts: 100,
  scoring: "800 fields / 100 cases; unresolved gold is neither correct nor wrong. Report lower/upper bounds and known-only metrics.",
  ambiguity: "Any unresolved reference or note-language review prevents PASS. No post-inference edits to frozen gold.",
  note: "Required nonempty string, <=100 UTF-16 units (CRM schema), <=100 Unicode code points; Slovak requires independent language review.",
});
export const B17_POLICY_SHA256 = crypto.createHash("sha256").update(JSON.stringify(B17_POLICY)).digest("hex");
export function validateB17Corpus() {
  if (B17_CORPUS.length !== 100 || new Set(B17_CORPUS.map(c => c.id)).size !== 100 ||
    new Set(B17_CORPUS.map(c => c.input)).size !== 100 ||
    B17_CORPUS.some(c => B14_CORPUS.some(old => old.input.normalize("NFKC").trim().toLowerCase() === c.input.normalize("NFKC").trim().toLowerCase())))
    throw Error("B17_CORPUS_INVALID");
  for (const category of Object.keys(B17_CATEGORIES))
    if (B17_CORPUS.filter(c => c.category === category).length !== 10) throw Error("B17_CATEGORY_COUNT_INVALID");
  for (const c of B17_CORPUS) {
    const completed = Object.fromEntries(B13_FIELDS.map(k => [k, c.expected[k] ?? base[k]]));
    if (Object.keys(c.expected).length !== 8 || !c.input.trim() || c.input.length > 2000 ||
      !emailMonitoringSchema.safeParse({ ...completed, note: "" }).success ||
      (Object.values(c.expected).some(v => v === null) !== Boolean(c.reviewReason)))
      throw Error("B17_EXPECTATIONS_INVALID");
  }
}
