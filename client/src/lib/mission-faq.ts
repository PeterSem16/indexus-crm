import { normalizeMissionFaqItems, type MissionFaqItem } from "@shared/mission-faq";

const defaults: Record<string, MissionFaqItem[]> = {
  en: [
    { id:"1", question:"What is cord blood?", answer:"Cord blood is the blood that remains in the umbilical cord and placenta after birth. It contains stem cells that can be used to treat various diseases.", category:"General" },
    { id:"2", question:"Is the collection painful?", answer:"No, cord blood collection is completely painless for both the mother and the baby. It is performed after birth and after the umbilical cord is cut.", category:"Collection" },
    { id:"3", question:"How long can it be stored?", answer:"Stem cells from cord blood can be stored in cryopreservation virtually indefinitely. Studies confirm viability even after 25+ years.", category:"Storage" },
    { id:"4", question:"What diseases can be treated?", answer:"Stem cells from cord blood are used to treat more than 80 diseases including leukemia, lymphomas, anemia, metabolic disorders and immunodeficiencies.", category:"Treatment" },
    { id:"5", question:"How much does it cost?", answer:"The price depends on the chosen service package. The basic package starts from 990€. For more detailed pricing information, see the current price list or contact our advisor.", category:"Pricing" },
    { id:"6", question:"When should I decide?", answer:"Ideally, you should decide before week 34 of pregnancy so we have time to prepare all necessary documents and the collection kit. In urgent cases, we can arrange faster processing.", category:"Process" },
    { id:"7", question:"What if I have a cesarean section?", answer:"Cord blood collection is also possible with a cesarean section. The procedure is equally safe and painless. Inform your maternity hospital and our coordinator.", category:"Collection" },
    { id:"8", question:"Is it compatible for siblings?", answer:"Yes, cord blood is more likely to be compatible between siblings (25% full match). For the child itself, the match is 100%. Storing for one child can help the entire family.", category:"Treatment" },
  ],
  sk: [
    { id:"1", question:"Čo je pupočníková krv?", answer:"Pupočníková krv je krv, ktorá zostáva v pupočníku a placente po pôrode. Obsahuje kmeňové bunky, ktoré môžu byť použité na liečbu rôznych ochorení.", category:"Všeobecné" },
    { id:"2", question:"Je odber bolestivý?", answer:"Nie, odber pupočníkovej krvi je úplne bezbolestný pre matku aj dieťa. Vykonáva sa až po pôrode a prestrihnutí pupočníka.", category:"Odber" },
    { id:"3", question:"Ako dlho sa dá uchovávať?", answer:"Kmeňové bunky z pupočníkovej krvi je možné uchovávať v kryokonzervácii prakticky neobmedzene dlho. Štúdie potvrdzujú životaschopnosť aj po 25+ rokoch.", category:"Uchovávanie" },
    { id:"4", question:"Aké ochorenia sa dajú liečiť?", answer:"Kmeňové bunky z pupočníkovej krvi sa používajú na liečbu viac ako 80 ochorení vrátane leukémie, lymfómov, anémie, metabolických porúch a imunodeficiencií.", category:"Liečba" },
    { id:"5", question:"Koľko to stojí?", answer:"Cena závisí od zvoleného balíka služieb. Základný balík začína od 990€. Podrobnejšie informácie o cenách nájdete v aktuálnom cenníku alebo kontaktujte nášho poradcu.", category:"Cena" },
    { id:"6", question:"Kedy sa mám rozhodnúť?", answer:"Ideálne je rozhodnúť sa do 34. týždňa tehotenstva, aby sme stihli pripraviť všetky potrebné dokumenty a odberový set. V urgentných prípadoch vieme zabezpečiť aj rýchlejšie spracovanie.", category:"Proces" },
    { id:"7", question:"Čo ak mám cisársky rez?", answer:"Odber pupočníkovej krvi je možný aj pri cisárskom reze. Postup je rovnako bezpečný a bezbolestný. Informujte o tom vašu pôrodnicu a nášho koordinátora.", category:"Odber" },
    { id:"8", question:"Je to kompatibilné pre súrodencov?", answer:"Áno, pupočníková krv je s vyššou pravdepodobnosťou kompatibilná medzi súrodencami (25% plná zhoda). Pre samotné dieťa je zhoda 100%. Uchovanie pre jedného potomka môže pomôcť celej rodine.", category:"Liečba" },
  ],
  cs: [
    { id:"1", question:"Co je pupečníková krev?", answer:"Pupečníková krev je krev, která zůstává v pupečníku a placentě po porodu. Obsahuje kmenové buňky, které mohou být použity k léčbě různých onemocnění.", category:"Obecné" },
    { id:"2", question:"Je odběr bolestivý?", answer:"Ne, odběr pupečníkové krve je zcela bezbolestný pro matku i dítě. Provádí se až po porodu a přestřižení pupečníku.", category:"Odběr" },
    { id:"3", question:"Jak dlouho lze uchovávat?", answer:"Kmenové buňky z pupečníkové krve lze uchovávat v kryokonzervaci prakticky neomezeně dlouho. Studie potvrzují životaschopnost i po 25+ letech.", category:"Uchovávání" },
    { id:"4", question:"Jaká onemocnění lze léčit?", answer:"Kmenové buňky z pupečníkové krve se používají k léčbě více než 80 onemocnění včetně leukémie, lymfomů, anémie, metabolických poruch a imunodeficiencí.", category:"Léčba" },
    { id:"5", question:"Kolik to stojí?", answer:"Cena závisí na zvoleném balíčku služeb. Základní balíček začíná od 990€. Podrobnější informace o cenách najdete v aktuálním ceníku nebo kontaktujte našeho poradce.", category:"Cena" },
    { id:"6", question:"Kdy se mám rozhodnout?", answer:"Ideálně je rozhodnout se do 34. týdne těhotenství, abychom stihli připravit všechny potřebné dokumenty a odběrový set.", category:"Proces" },
    { id:"7", question:"Co když mám císařský řez?", answer:"Odběr pupečníkové krve je možný i při císařském řezu. Postup je stejně bezpečný a bezbolestný. Informujte o tom vaši porodnici a našeho koordinátora.", category:"Odběr" },
    { id:"8", question:"Je to kompatibilní pro sourozence?", answer:"Ano, pupečníková krev je s vyšší pravděpodobností kompatibilní mezi sourozenci (25% plná shoda). Pro samotné dítě je shoda 100%.", category:"Léčba" },
  ],
  hu: [
    { id:"1", question:"Mi az a köldökzsinórvér?", answer:"A köldökzsinórvér a születés után a köldökzsinórban és a méhlepényben maradó vér. Őssejteket tartalmaz, amelyek különböző betegségek kezelésére használhatók.", category:"Általános" },
    { id:"2", question:"Fájdalmas a gyűjtés?", answer:"Nem, a köldökzsinórvér gyűjtése teljesen fájdalommentes az anya és a baba számára egyaránt. A születés és a köldökzsinór elvágása után végzik.", category:"Gyűjtés" },
    { id:"3", question:"Meddig tárolható?", answer:"A köldökzsinórvérből nyert őssejtek kriőkonzerválással gyakorlatilag korlátlanul tárolhatók. Tanulmányok 25+ év után is igazolják az életképességet.", category:"Tárolás" },
    { id:"4", question:"Milyen betegségek kezelhetők?", answer:"A köldökzsinórvérből nyert őssejteket több mint 80 betegség kezelésére használják, beleértve a leukémiát, limfómákat, anémiát és immunhiányos állapotokat.", category:"Kezelés" },
    { id:"5", question:"Mennyibe kerül?", answer:"Az ár a választott szolgáltatási csomagtól függ. Az alapcsomag 990€-tól indul. Részletesebb árinformációkért tekintse meg az aktuális árlistát.", category:"Árazás" },
    { id:"6", question:"Mikor kell döntenem?", answer:"Ideális esetben a terhesség 34. hetéig kell dönteni, hogy legyen idő az összes szükséges dokumentum és gyűjtőkészlet előkészítésére.", category:"Folyamat" },
    { id:"7", question:"Mi van, ha császármetszésem lesz?", answer:"A köldökzsinórvér gyűjtése császármetszés esetén is lehetséges. Az eljárás ugyanolyan biztonságos és fájdalommentes.", category:"Gyűjtés" },
    { id:"8", question:"Kompatibilis a testvérek számára?", answer:"Igen, a köldökzsinórvér nagyobb valószínűséggel kompatibilis a testvérek között (25% teljes egyezés). A gyermek számára 100%-os az egyezés.", category:"Kezelés" },
  ],
  ro: [
    { id:"1", question:"Ce este sângele din cordonul ombilical?", answer:"Sângele din cordonul ombilical este sângele care rămâne în cordonul ombilical și placentă după naștere. Conține celule stem care pot fi folosite pentru tratarea diverselor boli.", category:"General" },
    { id:"2", question:"Este colectarea dureroasă?", answer:"Nu, colectarea sângelui din cordonul ombilical este complet nedureroasă atât pentru mamă, cât și pentru copil. Se efectuează după naștere.", category:"Colectare" },
    { id:"3", question:"Cât timp poate fi depozitat?", answer:"Celulele stem din sângele cordonului ombilical pot fi depozitate prin crioconservare practic la nesfârșit. Studiile confirmă viabilitatea chiar și după 25+ ani.", category:"Depozitare" },
    { id:"4", question:"Ce boli pot fi tratate?", answer:"Celulele stem sunt folosite pentru tratarea a peste 80 de boli, inclusiv leucemie, limfoame, anemie și imunodeficiențe.", category:"Tratament" },
    { id:"5", question:"Cât costă?", answer:"Prețul depinde de pachetul de servicii ales. Pachetul de bază pornește de la 990€.", category:"Prețuri" },
    { id:"6", question:"Când trebuie să mă decid?", answer:"Ideal este să vă decideți înainte de săptămâna 34 de sarcină pentru a avea timp să pregătim toate documentele necesare.", category:"Proces" },
    { id:"7", question:"Ce se întâmplă dacă am cezariană?", answer:"Colectarea sângelui din cordonul ombilical este posibilă și în cazul cezarianei. Procedura este la fel de sigură și nedureroasă.", category:"Colectare" },
    { id:"8", question:"Este compatibil pentru frați?", answer:"Da, sângele din cordonul ombilical este mai probabil compatibil între frați (25% potrivire completă). Pentru copil, potrivirea este de 100%.", category:"Tratament" },
  ],
  it: [
    { id:"1", question:"Cos'è il sangue del cordone ombelicale?", answer:"Il sangue del cordone ombelicale è il sangue che rimane nel cordone ombelicale e nella placenta dopo il parto. Contiene cellule staminali utilizzabili per il trattamento di varie malattie.", category:"Generale" },
    { id:"2", question:"La raccolta è dolorosa?", answer:"No, la raccolta del sangue del cordone ombelicale è completamente indolore sia per la madre che per il bambino. Viene eseguita dopo il parto.", category:"Raccolta" },
    { id:"3", question:"Per quanto tempo può essere conservato?", answer:"Le cellule staminali possono essere conservate in crioconservazione praticamente a tempo indeterminato. Gli studi confermano la vitalità anche dopo 25+ anni.", category:"Conservazione" },
    { id:"4", question:"Quali malattie possono essere trattate?", answer:"Le cellule staminali sono utilizzate per trattare oltre 80 malattie tra cui leucemia, linfomi, anemia e immunodeficienze.", category:"Trattamento" },
    { id:"5", question:"Quanto costa?", answer:"Il prezzo dipende dal pacchetto di servizi scelto. Il pacchetto base parte da 990€.", category:"Prezzi" },
    { id:"6", question:"Quando devo decidere?", answer:"Idealmente bisogna decidere entro la 34a settimana di gravidanza per avere tempo di preparare tutti i documenti necessari.", category:"Processo" },
    { id:"7", question:"E se ho un taglio cesareo?", answer:"La raccolta del sangue cordonale è possibile anche con taglio cesareo. La procedura è ugualmente sicura e indolore.", category:"Raccolta" },
    { id:"8", question:"È compatibile per i fratelli?", answer:"Sì, il sangue cordonale è più probabilmente compatibile tra fratelli (25% corrispondenza completa). Per il bambino stesso, la corrispondenza è del 100%.", category:"Trattamento" },
  ],
  de: [
    { id:"1", question:"Was ist Nabelschnurblut?", answer:"Nabelschnurblut ist das Blut, das nach der Geburt in der Nabelschnur und Plazenta verbleibt. Es enthält Stammzellen, die zur Behandlung verschiedener Krankheiten verwendet werden können.", category:"Allgemein" },
    { id:"2", question:"Ist die Entnahme schmerzhaft?", answer:"Nein, die Nabelschnurblutentnahme ist für Mutter und Kind völlig schmerzfrei. Sie wird nach der Geburt und dem Durchtrennen der Nabelschnur durchgeführt.", category:"Entnahme" },
    { id:"3", question:"Wie lange kann es gelagert werden?", answer:"Stammzellen aus Nabelschnurblut können durch Kryokonservierung praktisch unbegrenzt gelagert werden. Studien bestätigen die Lebensfähigkeit auch nach 25+ Jahren.", category:"Lagerung" },
    { id:"4", question:"Welche Krankheiten können behandelt werden?", answer:"Stammzellen aus Nabelschnurblut werden zur Behandlung von über 80 Krankheiten eingesetzt, darunter Leukämie, Lymphome, Anämie und Immundefizienzen.", category:"Behandlung" },
    { id:"5", question:"Was kostet es?", answer:"Der Preis hängt vom gewählten Servicepaket ab. Das Basispaket beginnt ab 990€.", category:"Preise" },
    { id:"6", question:"Wann muss ich mich entscheiden?", answer:"Idealerweise sollten Sie sich vor der 34. Schwangerschaftswoche entscheiden, damit genug Zeit bleibt, alle notwendigen Dokumente vorzubereiten.", category:"Prozess" },
    { id:"7", question:"Was ist bei einem Kaiserschnitt?", answer:"Die Nabelschnurblutentnahme ist auch bei einem Kaiserschnitt möglich. Das Verfahren ist ebenso sicher und schmerzfrei.", category:"Entnahme" },
    { id:"8", question:"Ist es für Geschwister kompatibel?", answer:"Ja, Nabelschnurblut ist mit höherer Wahrscheinlichkeit zwischen Geschwistern kompatibel (25% volle Übereinstimmung). Für das Kind selbst beträgt die Übereinstimmung 100%.", category:"Behandlung" },
  ],
};

export function defaultMissionFaq(locale: string): MissionFaqItem[] {
  return (defaults[locale] || defaults.en).map((item) => ({ ...item }));
}

export function readMissionFaq(settings: string | null | undefined, locale: string): MissionFaqItem[] {
  try {
    const parsed = JSON.parse(settings || "{}");
    if (Object.prototype.hasOwnProperty.call(parsed, "faq")) {
      return normalizeMissionFaqItems(parsed.faq);
    }
  } catch {}
  return defaultMissionFaq(locale);
}