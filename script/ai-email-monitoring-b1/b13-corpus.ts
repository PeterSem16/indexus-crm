import type { EmailMonitoringAnalysis } from "../../server/lib/ai/email-monitoring-contract";
export type B13Expected = Omit<EmailMonitoringAnalysis, "note">;
export const B13_CATEGORIES = Object.freeze({
  neutral: "Bežná neutrálna komunikácia",
  consent: "Výslovný súhlas zákazníka",
  receipt: "Potvrdenie prijatia bez súhlasu",
  rejection: "Odmietnutie zmluvných podmienok",
  cancellation: "Požiadavka na zrušenie služby",
  complaint: "Sťažnosti, agresívny tón a nevhodný obsah",
});
export const B13_FIELDS = Object.freeze([
  "sentiment", "hasInappropriateContent", "hasAngryTone", "hasRudeExpressions",
  "wantsToCancel", "wantsConsent", "doesNotAcceptContract", "alertLevel",
] as const);
const base: B13Expected = { sentiment: "neutral", hasInappropriateContent: false,
  hasAngryTone: false, hasRudeExpressions: false, wantsToCancel: false,
  wantsConsent: false, doesNotAcceptContract: false, alertLevel: "none" };
function item(n: number, category: keyof typeof B13_CATEGORIES, input: string, patch: Partial<B13Expected> = {}) {
  return Object.freeze({ id: `SYN-B13-${String(n).padStart(2, "0")}`, category, input,
    expected: Object.freeze({ ...base, ...patch }) });
}
const consent = { sentiment: "positive", wantsConsent: true } as const;
const rejection = { sentiment: "negative", doesNotAcceptContract: true, alertLevel: "warning" } as const;
const cancellation = { wantsToCancel: true, alertLevel: "critical" } as const;
/** Fixed before inference. No real identities, contacts, account numbers or model-derived labels. */
export const B13_CORPUS = Object.freeze([
  item(1, "neutral", "Dobrý deň, v prílohe posielam vyplnený kontaktný formulár. Prajem pekný deň."),
  item(2, "neutral", "Prosím o informáciu, v akých hodinách je dostupná zákaznícka podpora."),
  item(3, "neutral", "Dobrý deň, kde nájdem všeobecný prehľad dokumentov k službe?"),
  item(4, "neutral", "Oznamujem, že požadované dokumenty pošlem budúci týždeň."),
  item(5, "neutral", "Prosím o zaslanie informačného letáka o postupe uchovania vzorky."),
  item(6, "consent", "S radosťou súhlasím s navrhovanou zmluvou a prijímam všetky jej podmienky. Ďakujem za milý prístup.", consent),
  item(7, "consent", "Som spokojný s vysvetlením služby. Týmto výslovne udeľujem súhlas s jej objednaním za uvedených podmienok.", consent),
  item(8, "consent", "Vaša ponuka ma potešila. Výslovne prijímam návrh zmluvy a súhlasím s uvedenou cenou aj podmienkami.", consent),
  item(9, "consent", "Ďakujem za výborné vysvetlenie. Rozhodol som sa kladne a udeľujem súhlas s navrhovaným postupom uchovania vzorky.", consent),
  item(10, "consent", "S vaším návrhom som veľmi spokojný. Áno, súhlasím s uzavretím zmluvy v predloženej podobe.", consent),
  item(11, "receipt", "Potvrdzujem prijatie vášho e-mailu. O samotnej ponuke sa rozhodnem neskôr."),
  item(12, "receipt", "Správa mi bola doručená. Toto je iba potvrdenie prijatia, nie súhlas s návrhom zmluvy."),
  item(13, "receipt", "Prosím potvrďte prijatie správy. Ďakujem."),
  item(14, "receipt", "Dokumenty som dostal. Zatiaľ ich len evidujem a rozhodnutie o návrhu ešte neposkytujem."),
  item(15, "receipt", "Vo vzore sa píše „súhlasím“. Ja teraz iba potvrdzujem prijatie e-mailu; o podmienkach sa ešte rozhodnem."),
  item(16, "rejection", "Navrhované podmienky sú pre mňa nevýhodné. Návrh zmluvy odmietam a neprijímam ho. Zmluvu som nepodpísal.", rejection),
  item(17, "rejection", "S cenovými podmienkami novej ponuky nie som spokojný a neprijímam ich. O uzavretie tejto navrhovanej zmluvy nemám záujem.", rejection),
  item(18, "rejection", "Predložený návrh mi nevyhovuje. Výslovne odmietam jeho zmluvné podmienky; žiadna zmluva zatiaľ nevznikla.", rejection),
  item(19, "rejection", "Podmienky nového návrhu považujem za nevýhodné a nesúhlasím s nimi. Tento návrh zmluvy neprijímam.", rejection),
  item(20, "rejection", "Navrhovaný rozsah zmluvných povinností mi nevyhovuje. Odmietam ponúkanú zmluvu, ktorú som zatiaľ neuzavrel.", rejection),
  item(21, "cancellation", "Prosím o zrušenie mojej aktívnej služby k najbližšiemu možnému termínu.", cancellation),
  item(22, "cancellation", "Žiadam o ukončenie existujúcej zmluvy o uchovaní vzorky. V službe už nechcem pokračovať.", cancellation),
  item(23, "cancellation", "Dobrý deň, rozhodol som sa ukončiť využívanie služby. Prosím vykonajte jej zrušenie.", cancellation),
  item(24, "cancellation", "Týmto žiadam zrušiť svoje súčasné predplatné služby a zastaviť jeho ďalšie poskytovanie.", cancellation),
  item(25, "cancellation", "Prosím o ukončenie mojej platnej zmluvy a zaslanie postupu zrušenia služby.", cancellation),
  item(26, "complaint", "Podávam sťažnosť na nesprávne vyúčtovanie. Uvedená suma je chybná a žiadam jej opravu.", { sentiment: "negative", alertLevel: "critical" }),
  item(27, "complaint", "Som naozaj nahnevaný! Na moju žiadosť opakovane nikto nereaguje a už ma to veľmi frustruje!", { sentiment: "angry", hasAngryTone: true, alertLevel: "critical" }),
  item(28, "complaint", "Toto je úplná neschopnosť z vašej strany! Okamžite prestaňte ignorovať moje otázky a konečne robte svoju prácu!", { sentiment: "angry", hasAngryTone: true, hasRudeExpressions: true, alertLevel: "critical" }),
  item(29, "complaint", "Do riti, vaše vysvetlenia sú na hovno! Som nahnevaný na tento bordel, okamžite opravte tú chybu!", { sentiment: "angry", hasAngryTone: true, hasRudeExpressions: true, hasInappropriateContent: true, alertLevel: "critical" }),
  item(30, "complaint", "Ste banda neschopných idiotov! Toto vaše mizerné vybavovanie ma poriadne nasralo, žiadam okamžité vyriešenie sťažnosti!", { sentiment: "angry", hasAngryTone: true, hasRudeExpressions: true, hasInappropriateContent: true, alertLevel: "critical" }),
]);
export type B13Case = typeof B13_CORPUS[number];
