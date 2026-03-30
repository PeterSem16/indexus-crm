const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/indexus_crm',
});

async function updateCallScript() {
  const client = await pool.connect();

  try {
    console.log('=== UPDATE CAMPAIGN CALL SCRIPT ===\n');

    const campaign = await client.query(
      "SELECT id, name FROM campaigns WHERE name LIKE '%Partner Acquisition%' LIMIT 1"
    );

    if (campaign.rows.length === 0) {
      console.log('Campaign not found!');
      return;
    }

    const campaignId = campaign.rows[0].id;
    console.log(`Found campaign: ${campaign.rows[0].name} (${campaignId})`);

    const operatorScript = JSON.stringify({
      steps: [
        {
          id: "step_outreach",
          title: "Fáza 1: OUTREACH — Email 1 / List 1",
          description: "Deň 0: Odoslať Email 1 alebo List 1 s predstavením spoločnosti a služieb.",
          callScript: {
            title: "Oslovovací email / list",
            sections: [
              {
                heading: "Predmet emailu",
                text: "Spolupráca s Cord Blood Center — informácie pre Vašu ambulanciu"
              },
              {
                heading: "Text emailu / listu",
                text: `Vážený pán doktor / Vážená pani doktorka,

dovoľujeme si Vás osloviť v mene spoločnosti Cord Blood Center, ktorá je lídrom v oblasti spracovania a uchovávania pupočníkovej krvi na Slovensku.

Radi by sme Vám predstavili možnosť spolupráce, ktorá prinesie pridanú hodnotu Vašim pacientkam a zároveň Vašej ambulancii.

Čo ponúkame:
• Bezplatnú spoluprácu — žiadne náklady pre Vašu ambulanciu
• Informačné materiály pre pacientky (letáky, plagáty, brožúry)
• Odborné školenie a podporu
• Referencie od spolupracujúcich lekárov vo Vašom regióne

V nasledujúcich dňoch Vás budeme kontaktovať telefonicky, aby sme Vám mohli poskytnúť podrobnejšie informácie.

Ak máte otázky, neváhajte nás kontaktovať.

S pozdravom,
[Meno agenta]
Cord Blood Center`
              }
            ]
          },
          elements: [
            { type: "radio", label: "Spôsob oslovenia", name: "outreach_method", required: true, options: [
              { label: "Email 1 odoslaný", value: "email_sent" },
              { label: "List 1 odoslaný poštou", value: "letter_sent" }
            ]},
            { type: "textarea", label: "Poznámky k osloveniu", name: "outreach_notes", required: false }
          ],
          nextStepId: "step_call1"
        },
        {
          id: "step_call1",
          title: "Fáza 2: CONTACT — Call 1",
          description: "Po 2 pracovných dňoch od Email 1. Nadviazať kontakt, dohodnúť termín, uviesť referenciu.",
          callScript: {
            title: "Call 1 — Prvý kontakt",
            sections: [
              {
                heading: "Úvod hovoru",
                text: `"Dobrý deň, tu [meno agenta] zo spoločnosti Cord Blood Center. Mohla by som hovoriť s pánom doktorom / pani doktorkou [priezvisko]?"`
              },
              {
                heading: "Ak prepoja na lekára",
                text: `"Dobrý deň, pán doktor / pani doktorka. Volám Vám v nadväznosti na email [alebo list], ktorý sme Vám zaslali pred dvoma dňami ohľadom možnosti spolupráce s Cord Blood Center.

Sme spoločnosť, ktorá sa špecializuje na spracovanie a uchovávanie pupočníkovej krvi. S Vašou ambulanciou by sme radi nadviazali spoluprácu, tak ako napríklad s doktorom [meno referencie] z [miesto], s ktorým úspešne spolupracujeme.

Mohli by sme si dohodnúť krátky termín, kedy by som Vám mohla priblížiť detaily?"`
              },
              {
                heading: "Ak je k dispozícii len sestra / recepcia",
                text: `"Rozumiem, že pán doktor / pani doktorka je momentálne zaneprázdnený/á. Mohli by ste mu/jej, prosím, odovzdať odkaz, že sme volali zo spoločnosti Cord Blood Center ohľadom spolupráce? Kedy by bolo najlepšie zavolať, aby som ho/ju zastihla?"`
              },
              {
                heading: "Ak sa opýta 'O čo ide?'",
                text: `"Ide o možnosť bezplatnej spolupráce v oblasti uchovávania pupočníkovej krvi. Pre pána doktora / pani doktorku to znamená pridanú hodnotu pre jeho/jej pacientky bez akýchkoľvek nákladov. Radi by sme mu/jej to bližšie vysvetlili."`
              },
              {
                heading: "Dohodnutie termínu",
                text: `"Výborne, ďakujem za Váš čas. Tak sa teda ozvem [dohodnutý termín]. Prajem Vám pekný deň!"`
              },
              {
                heading: "Ak odmietne",
                text: `"Rozumiem, pán doktor / pani doktorka. Ďakujem Vám za čas. Ak by ste v budúcnosti zmenili názor, neváhajte nás kontaktovať. Prajem Vám pekný deň."`
              }
            ]
          },
          elements: [
            { type: "radio", label: "Výsledok Call 1", name: "call1_result", required: true, options: [
              { label: "Termín dohodnutý", value: "appointment_set", nextStepId: "step_call2" },
              { label: "Nedostupný — callback", value: "unavailable", nextStepId: "step_call1_callback" },
              { label: "Odmietnutie", value: "declined", nextStepId: "step_declined" }
            ]},
            { type: "textarea", label: "Referencia uvedená", name: "reference_name", required: false },
            { type: "textarea", label: "Poznámky z hovoru", name: "call1_notes", required: false }
          ]
        },
        {
          id: "step_call1_callback",
          title: "Call 1 — Callback (nedostupný)",
          description: "Lekár/ambulancia nedostupní. Nový pokus ďalší pracovný deň.",
          callScript: {
            title: "Callback po neúspešnom Call 1",
            sections: [
              {
                heading: "Opakovaný pokus",
                text: `Použite rovnaký skript ako pri Call 1. Ak sa nedovoláte 3x po sebe, skúste volať v inom čase dňa (ráno namiesto poobedia alebo naopak).`
              }
            ]
          },
          elements: [
            { type: "textarea", label: "Dôvod nedostupnosti", name: "callback_reason", required: false }
          ],
          nextStepId: "step_call1"
        },
        {
          id: "step_call2",
          title: "Fáza 3: INTEREST QUALIFICATION — Call 2",
          description: "V dohodnutom termíne. Zistiť záujem, získať súhlas so zaslaním detailov.",
          callScript: {
            title: "Call 2 — Kvalifikácia záujmu",
            sections: [
              {
                heading: "Úvod hovoru",
                text: `"Dobrý deň, pán doktor / pani doktorka. Tu [meno agenta] z Cord Blood Center. Volám Vám podľa našej dohody z [dátum]."`
              },
              {
                heading: "Predstavenie služieb",
                text: `"Ako som spomínala, Cord Blood Center sa špecializuje na spracovanie a uchovávanie pupočníkovej krvi. Naša spolupráca s lekármi funguje veľmi jednoducho:

1. Do Vašej ambulancie dodáme informačné materiály pre pacientky
2. Vy pacientky informujete o tejto možnosti v rámci bežnej prenatálnej starostlivosti
3. Ak má pacientka záujem, my zabezpečíme všetko ostatné — od odbornej konzultácie až po samotný odber

Pre Vás to neznamená žiadnu administratívnu záťaž ani náklady. Spolupracujeme napríklad s doktorom [referencia], ktorý je s touto formou spolupráce veľmi spokojný.

Čo hovoríte, mali by ste záujem o bližšie informácie?"`
              },
              {
                heading: "Ak má záujem",
                text: `"Výborne! V takom prípade Vám ihneď zašlem email s detailnými informáciami o našich službách, cenníkom a referenciami. Dám Vám týždeň na preštudovanie a potom sa ozvem. Súhlasíte?

Môžem potvrdiť Vašu emailovú adresu? [overiť email]

Ďakujem, pán doktor / pani doktorka. Email Vám odošlem ešte dnes. Ozvem sa Vám [dátum o týždeň]. Prajem pekný deň!"`
              },
              {
                heading: "Ak potrebuje čas",
                text: `"Úplne rozumiem, pán doktor / pani doktorka. Ide o dôležité rozhodnutie. Čo keby som sa Vám ozvala o týždeň? Dovtedy si môžete v pokoji všetko premyslieť a ja Vám rád/a zodpoviem všetky otázky.

Vyhovuje Vám [deň o týždeň] okolo [čas]?"`
              },
              {
                heading: "Ak odmieta",
                text: `"Rozumiem, pán doktor / pani doktorka. Môžem sa opýtať, čo je hlavným dôvodom? [počúvať]

Ďakujem Vám za úprimnosť. Ak by ste v budúcnosti zmenili názor, neváhajte sa na nás obrátiť. Prajem Vám pekný deň."`
              },
              {
                heading: "Časté námietky a odpovede",
                text: `NÁMIETKA: "Nemám na to čas."
ODPOVEĎ: "Úplne Vás chápem, pán doktor / pani doktorka. Práve preto je naša spolupráca nastavená tak, aby Vám nezabrala prakticky žiaden čas. Stačí umiestniť naše letáky v čakárni — pacientky sa informujú samy a o všetko ostatné sa postaráme my."

NÁMIETKA: "Už spolupracujem s konkurenciou."
ODPOVEĎ: "Rozumiem. Môžem sa opýtať, s kým spolupracujete? Radi by sme Vám ukázali, v čom sa líšime a aké výhody ponúkame navyše."

NÁMIETKA: "Pacientky sa o to nezaujímajú."
ODPOVEĎ: "Chápem Vašu skúsenosť. Z našich štatistík však vyplýva, že až [%] tehotných žien má záujem o informácie o uchovávaní pupočníkovej krvi, ak sú im poskytnuté lekárom. Doktor [referencia] mal podobnú obavu a dnes je jedným z našich najaktívnejších partnerov."`
              }
            ]
          },
          elements: [
            { type: "radio", label: "Výsledok Call 2", name: "call2_result", required: true, options: [
              { label: "Má záujem — poslať Email 2", value: "interested", nextStepId: "step_email2" },
              { label: "Potrebuje čas — follow-up o 1 týždeň", value: "needs_time", nextStepId: "step_call2_followup" },
              { label: "Odmieta", value: "declined", nextStepId: "step_declined" }
            ]},
            { type: "textarea", label: "Otázky partnera", name: "call2_questions", required: false },
            { type: "textarea", label: "Námietky", name: "call2_objections", required: false },
            { type: "textarea", label: "Poznámky z hovoru", name: "call2_notes", required: false }
          ]
        },
        {
          id: "step_call2_followup",
          title: "Call 2 — Follow-up (potrebuje čas)",
          description: "Partner potrebuje čas. Callback o 1 týždeň.",
          callScript: {
            title: "Follow-up po Call 2",
            sections: [
              {
                heading: "Pokračovanie",
                text: `Pri ďalšom hovore nadviažte na predchádzajúci rozhovor a použite skript Call 3.`
              }
            ]
          },
          elements: [
            { type: "textarea", label: "Poznámky k follow-up", name: "followup_notes", required: false }
          ],
          nextStepId: "step_call3"
        },
        {
          id: "step_email2",
          title: "Email 2 — Detailné informácie",
          description: "Zaslať Email 2 s detailnými informáciami. Callback o 1 týždeň.",
          callScript: {
            title: "Email 2 — Detaily služieb",
            sections: [
              {
                heading: "Predmet emailu",
                text: "Podrobné informácie o spolupráci s Cord Blood Center — podľa našej dohody"
              },
              {
                heading: "Text emailu",
                text: `Vážený pán doktor / Vážená pani doktorka [priezvisko],

v nadväznosti na náš dnešný telefonický rozhovor Vám zasielam podrobné informácie o spolupráci s Cord Blood Center.

V prílohe nájdete:
• Podrobný popis našich služieb
• Podmienky spolupráce
• Referencie od spolupracujúcich lekárov
• Vzorové informačné materiály pre pacientky

Ako som spomínal/a, spolupráca je pre Vás úplne bezplatná. Zabezpečíme:
✓ Dodanie informačných materiálov do Vašej ambulancie
✓ Odborné preškolenie Vás a Vášho tímu (ak máte záujem)
✓ Pravidelné dopĺňanie materiálov
✓ Odbornú podporu pre Vaše pacientky

Ozvem sa Vám [dátum o týždeň], aby sme si mohli dohodnúť ďalšie kroky.

Ak máte medzitým akékoľvek otázky, neváhajte ma kontaktovať.

S pozdravom,
[Meno agenta]
Cord Blood Center
[telefón] | [email]`
              }
            ]
          },
          elements: [
            { type: "radio", label: "Email 2 odoslaný", name: "email2_sent", required: true, options: [
              { label: "Áno, odoslaný", value: "sent" }
            ]},
            { type: "textarea", label: "Poznámky", name: "email2_notes", required: false }
          ],
          nextStepId: "step_call3"
        },
        {
          id: "step_call3",
          title: "Fáza 4: AGREEMENT — Call 3",
          description: "Po 1 týždni od Email 2. Potvrdiť záujem, zodpovedať otázky, dohodnúť zmluvu.",
          callScript: {
            title: "Call 3 — Dohoda o spolupráci",
            sections: [
              {
                heading: "Úvod hovoru",
                text: `"Dobrý deň, pán doktor / pani doktorka. Tu [meno agenta] z Cord Blood Center. Volám Vám, ako sme sa dohodli, ohľadom informácií, ktoré som Vám zaslal/a minulý týždeň.

Mali ste možnosť si ich pozrieť?"`
              },
              {
                heading: "Zodpovedanie otázok",
                text: `"Máte nejaké otázky k informáciám, ktoré som Vám zaslal/a?"

[Počúvajte a odpovedajte na otázky. Hlavné body:]

• Spolupráca je bezplatná — žiadne poplatky ani záväzky
• Dodáme materiály priamo do ambulancie
• Pacientky sa informujú samy z materiálov — nezaberá to čas lekára
• Zabezpečíme pravidelnú obnovu materiálov
• Máme referencie od [počet] spolupracujúcich lekárov na Slovensku`
              },
              {
                heading: "Dohodnutie zmluvy",
                text: `"Výborne! Ak súhlasíte so spoluprácou, radi by sme Vám zaslali zmluvu o spolupráci. Je to jednoduchý dokument, ktorý formalizuje naše partnerstvo.

Pošleme Vám poštou:
• Sprievodný list s popisom spolupráce
• Dva výtlačky zmluvy — jeden si ponecháte, druhý nám pošlete späť v priloženej návratovej obálke
• Všetky prílohy

Vyhovuje Vám to?"`
              },
              {
                heading: "Ak súhlasí",
                text: `"Ďakujem Vám za dôveru, pán doktor / pani doktorka! Zmluvu Vám odošleme ešte dnes / zajtra. Mala by Vám prísť do [3-5 pracovných dní].

Ozvem sa Vám o týždeň, aby som overil/a, či Vám bola doručená. Ak by ste medzitým mali akékoľvek otázky, neváhajte zavolať.

Prajem Vám pekný deň!"`
              },
              {
                heading: "Ak váha",
                text: `"Úplne rozumiem. Môžem sa opýtať, čo Vás ešte drží? [počúvať]

Keby som Vám zavolal/a [navrhnutý termín], mali by ste dovtedy čas sa rozhodnúť?"`
              },
              {
                heading: "Ak odmieta",
                text: `"Rozumiem, pán doktor / pani doktorka. Ďakujem Vám za čas, ktorý ste nám venovali. Ak by ste sa v budúcnosti rozhodli inak, budeme radi. Prajem Vám pekný deň."`
              }
            ]
          },
          elements: [
            { type: "radio", label: "Výsledok Call 3", name: "call3_result", required: true, options: [
              { label: "Súhlasí — zaslať zmluvu (List 3)", value: "agrees", nextStepId: "step_list3" },
              { label: "Ešte váha — callback podľa dohody", value: "hesitant", nextStepId: "step_call3" },
              { label: "Odmieta", value: "declined", nextStepId: "step_declined" }
            ]},
            { type: "textarea", label: "Otázky partnera", name: "call3_questions", required: false },
            { type: "textarea", label: "Poznámky z hovoru", name: "call3_notes", required: false }
          ]
        },
        {
          id: "step_list3",
          title: "List 3 — Zaslanie zmluvy",
          description: "Odoslať: sprievodný list + 2x zmluva + prílohy + návratová obálka.",
          callScript: {
            title: "List 3 — Obsah zásielky",
            sections: [
              {
                heading: "Checklist pred odoslaním",
                text: `Overte, že zásielka obsahuje:
☐ Sprievodný list (personalizovaný s menom lekára)
☐ 2x zmluva o spolupráci (obe podpísané z našej strany)
☐ Prílohy k zmluve
☐ Návratová obálka (predplatená)
☐ Vizitka kontaktnej osoby`
              }
            ]
          },
          elements: [
            { type: "radio", label: "List 3 odoslaný", name: "list3_sent", required: true, options: [
              { label: "Áno, zmluva odoslaná", value: "sent" }
            ]},
            { type: "textarea", label: "Poznámky k odoslaniu", name: "list3_notes", required: false }
          ],
          nextStepId: "step_call4"
        },
        {
          id: "step_call4",
          title: "Fáza 5: CONTRACT RETURN CONTROL — Call 4",
          description: "Po 1 týždni od odoslania. Overiť doručenie a vrátenie zmluvy.",
          callScript: {
            title: "Call 4 — Kontrola zmluvy",
            sections: [
              {
                heading: "Úvod hovoru",
                text: `"Dobrý deň, pán doktor / pani doktorka. Tu [meno agenta] z Cord Blood Center. Volám Vám ohľadom zmluvy o spolupráci, ktorú sme Vám zaslali minulý týždeň.

Bola Vám doručená?"`
              },
              {
                heading: "Ak zmluvu dostal/a",
                text: `"Výborne! Stihli ste ju už pozrieť a podpísať?"

Ak podpísal/a a odoslal/a:
"Ďakujem! Počkáme na doručenie a hneď ako ju dostaneme a skontrolujeme, ozvem sa Vám s potvrdením. Malo by to byť do [časový odhad]."

Ak ešte nepodpísal/a:
"Rozumiem, nie je žiaden problém. Stačí podpísať obidva výtlačky, jeden si ponechať a druhý vložiť do priloženej návratovej obálky a hodiť do schránky. Kedy by ste to mohli stihnúť?"

Ak má otázky k zmluve:
"Samozrejme, rád/a Vám vysvetlím. O čo konkrétne ide?" [zodpovedať otázky]`
              },
              {
                heading: "Ak zmluvu nedostal/a (2+ týždne)",
                text: `"To ma mrzí, pán doktor / pani doktorka. Ihneď Vám zašleme novú kópiu. Tentokrát bude obsahovať jeden originál zmluvy a návratovú obálku. Ozvem sa Vám o týždeň, aby som overil/a doručenie.

Môžem si overiť Vašu adresu? [overiť adresu]"`
              },
              {
                heading: "Ak zmluvu odoslal/a",
                text: `"Výborne, ďakujem! Budeme sledovať doručenie k nám. Ak bude všetko v poriadku, ozvem sa Vám s potvrdením nasledujúci pracovný deň po validácii."`
              }
            ]
          },
          elements: [
            { type: "radio", label: "Výsledok Call 4", name: "call4_result", required: true, options: [
              { label: "Partner zmluvu ešte neposlal — callback o 1 týždeň", value: "not_sent_yet", nextStepId: "step_call4" },
              { label: "Partner zmluvu odoslal — čakáme na doručenie", value: "sent_back", nextStepId: "step_contract_check" },
              { label: "Zmluva nedoručená do 2 týždňov", value: "not_delivered", nextStepId: "step_call4a" },
              { label: "Odmieta", value: "declined", nextStepId: "step_declined" }
            ]},
            { type: "textarea", label: "Poznámky z hovoru", name: "call4_notes", required: false }
          ]
        },
        {
          id: "step_contract_check",
          title: "Kontrola doručenej zmluvy",
          description: "Zmluva fyzicky doručená — skontrolovať úplnosť.",
          callScript: {
            title: "Interná kontrola zmluvy",
            sections: [
              {
                heading: "Kontrolný checklist",
                text: `Skontrolujte:
☐ Je zmluva podpísaná? → Ak nie: Call 4.a
☐ Sú vyplnené všetky údaje (meno, IČO, adresa, dátum)? → Ak nie: Call 4.b
☐ Sú priložené všetky prílohy? → Ak nie: Call 4.b
☐ Je všetko v poriadku? → Validácia → Call 5 next working day`
              }
            ]
          },
          elements: [
            { type: "radio", label: "Stav zmluvy", name: "contract_status", required: true, options: [
              { label: "Zmluva validná a kompletná", value: "valid", nextStepId: "step_call5" },
              { label: "Zmluva bez podpisu", value: "unsigned", nextStepId: "step_call4a" },
              { label: "Zmluva bez potrebných údajov", value: "incomplete", nextStepId: "step_call4b" }
            ]}
          ]
        },
        {
          id: "step_call4a",
          title: "Call 4.a — Nedoručená zmluva / bez podpisu",
          description: "Informovať partnera, odoslať novú kópiu.",
          callScript: {
            title: "Call 4.a — Nová kópia zmluvy",
            sections: [
              {
                heading: "Hovor",
                text: `"Dobrý deň, pán doktor / pani doktorka. Tu [meno agenta] z Cord Blood Center.

[Ak nedoručená:]
Bohužiaľ, zmluvu, ktorú sme Vám zaslali, sa nám nepodarilo doručiť. Ihneď Vám zašleme novú kópiu — tentokrát jeden originál zmluvy s návratovou obálkou.

[Ak bez podpisu:]
Zmluvu sme obdržali, ale bohužiaľ chýba Váš podpis. Zašleme Vám novú kópiu na podpísanie. Stačí ju podpísať a poslať späť v priloženej obálke.

Ozvem sa Vám o týždeň. Prepáčte za komplikácie."`
              }
            ]
          },
          elements: [
            { type: "radio", label: "List 3.a odoslaný", name: "list3a_sent", required: true, options: [
              { label: "Áno, náhradná zmluva odoslaná", value: "sent" }
            ]},
            { type: "textarea", label: "Poznámky", name: "call4a_notes", required: false }
          ],
          nextStepId: "step_call4"
        },
        {
          id: "step_call4b",
          title: "Call 4.b — Chýbajúce údaje",
          description: "Získať chýbajúce údaje telefonicky.",
          callScript: {
            title: "Call 4.b — Doplnenie údajov",
            sections: [
              {
                heading: "Hovor",
                text: `"Dobrý deň, pán doktor / pani doktorka. Tu [meno agenta] z Cord Blood Center.

Zmluvu sme obdržali, ďakujeme! Bohužiaľ, v niektorých poliach chýbajú údaje, ktoré potrebujeme pre platnosť zmluvy. Mohli by sme ich doplniť telefonicky?

Potrebujeme doplniť:
[vymenovať chýbajúce údaje — napr. IČO, presná adresa, dátum narodenia, atď.]

Výborne, ďakujem! Údaje doplníme a zmluva bude kompletná. Ozvem sa Vám s potvrdením do [termín]."`
              }
            ]
          },
          elements: [
            { type: "textarea", label: "Chýbajúce údaje", name: "missing_data", required: true },
            { type: "radio", label: "Údaje doplnené", name: "data_completed", required: true, options: [
              { label: "Áno, údaje doplnené", value: "completed", nextStepId: "step_call5" }
            ]},
            { type: "textarea", label: "Poznámky", name: "call4b_notes", required: false }
          ]
        },
        {
          id: "step_call5",
          title: "Fáza 6: ONBOARDING — Call 5",
          description: "Next working day po validácii. Potvrdiť prijatie, ponúknuť materiály.",
          callScript: {
            title: "Call 5 — Onboarding",
            sections: [
              {
                heading: "Úvod hovoru",
                text: `"Dobrý deň, pán doktor / pani doktorka! Tu [meno agenta] z Cord Blood Center.

Volám Vám s radostnou správou — Vašu zmluvu sme obdržali a je všetko v poriadku. Vaša originálna kópia Vám bude doručená poštou v najbližších dňoch.

Oficiálne Vás vítam medzi partnermi Cord Blood Center!"`
              },
              {
                heading: "Ponuka materiálov",
                text: `"Teraz by som s Vami rád/a prešiel/šla, aké informačné materiály Vám môžeme dodať do ambulancie:

1. Letáky pre pacientky (50 kusov) — ideálne do čakárne alebo na recepciu
2. Plagát — ak máte v ambulancii alebo čakárni miesto na nástenku
3. Tehotenské knižky (50 kusov) — veľmi obľúbené u pacientiek, obsahujú aj informácie o uchovávaní pupočníkovej krvi
4. Pocket Guide a brožúru — pre Vás a Váš tím

Všetko Vám zašleme poštou a navyše Vám pošlem aj email s PDF verziami materiálov.

O čo by ste mali záujem?"`
              },
              {
                heading: "Ak chce materiály",
                text: `"Výborne! Zaznamenal/a som si: [vymenovať]. Balík Vám odošleme ešte dnes / zajtra. Ozvem sa Vám o týždeň, aby som overil/a doručenie.

Ešte raz Vám ďakujem za dôveru a teším sa na spoluprácu!"`
              },
              {
                heading: "Ak nechce materiály",
                text: `"Rozumiem, nie je problém. Ak by ste sa v budúcnosti rozhodli, neváhajte sa ozvať. Kedy by som sa Vám mohol/la ozvať na servisný hovor? Dohodli by sme sa na [termín o 3 mesiace]?

Ďakujem Vám a teším sa na spoluprácu!"`
              }
            ]
          },
          elements: [
            { type: "radio", label: "Výsledok Call 5", name: "call5_result", required: true, options: [
              { label: "Súhlas s materiálmi — zaslať balík", value: "wants_materials", nextStepId: "step_materials" },
              { label: "Bez záujmu o materiály — partner aktívny", value: "no_materials", nextStepId: "step_active_no_materials" }
            ]},
            { type: "textarea", label: "Požadované materiály", name: "materials_requested", required: false },
            { type: "textarea", label: "Poznámky z hovoru", name: "call5_notes", required: false }
          ]
        },
        {
          id: "step_materials",
          title: "Odoslanie materiálov",
          description: "Zaslať materiálový balík podľa dohody z Call 5.",
          callScript: {
            title: "Materiálový balík",
            sections: [
              {
                heading: "Checklist pred odoslaním",
                text: `Podľa dohody z Call 5 pripravte:
☐ Letáky pre pacientky (50 ks)
☐ Plagát do čakárne (podľa záujmu)
☐ Tehotenské knižky (50 ks, podľa záujmu)
☐ Pocket Guide + brožúra
☐ Email s PDF verziami materiálov`
              }
            ]
          },
          elements: [
            { type: "radio", label: "Letáky (50 ks)", name: "leaflets", required: true, options: [
              { label: "Odoslané", value: "sent" },
              { label: "Nežiadané", value: "not_requested" }
            ]},
            { type: "radio", label: "Poster", name: "poster", required: true, options: [
              { label: "Odoslaný", value: "sent" },
              { label: "Nežiadaný", value: "not_requested" }
            ]},
            { type: "radio", label: "Tehotenské knižky (50 ks)", name: "pregnancy_books", required: true, options: [
              { label: "Odoslané", value: "sent" },
              { label: "Nežiadané", value: "not_requested" }
            ]},
            { type: "radio", label: "Pocket Guide + brožúra", name: "pocket_guide", required: true, options: [
              { label: "Odoslané", value: "sent" },
              { label: "Nežiadané", value: "not_requested" }
            ]},
            { type: "radio", label: "Email s PDF", name: "pdf_email", required: true, options: [
              { label: "Odoslaný", value: "sent" },
              { label: "Neodoslaný", value: "not_sent" }
            ]},
            { type: "textarea", label: "Poznámky k materiálom", name: "materials_notes", required: false }
          ],
          nextStepId: "step_call6"
        },
        {
          id: "step_call6",
          title: "Fáza 7: MATERIAL CONFIRMATION — Call 6",
          description: "Po 1 týždni od odoslania materiálov.",
          callScript: {
            title: "Call 6 — Potvrdenie materiálov",
            sections: [
              {
                heading: "Hovor",
                text: `"Dobrý deň, pán doktor / pani doktorka. Tu [meno agenta] z Cord Blood Center.

Volám Vám ohľadom materiálov, ktoré sme Vám zaslali minulý týždeň. Boli Vám doručené?"`
              },
              {
                heading: "Ak doručené",
                text: `"Výborne! Je všetko v poriadku? Máte dostatok materiálov, alebo by ste niečo potrebovali doplniť?

Skvelé. Ozvem sa Vám znova o tri mesiace na servisný hovor, aby sme overili, či nepotrebujete doplniť zásoby. Samozrejme, ak by ste niečo potrebovali skôr, neváhajte sa ozvať.

Ďakujem Vám a prajem veľa úspechov!"`
              },
              {
                heading: "Ak nedoručené",
                text: `"To ma mrzí. Overiť to a zabezpečíme opätovné doručenie. Ozvem sa Vám do [termín]."`
              }
            ]
          },
          elements: [
            { type: "radio", label: "Výsledok Call 6", name: "call6_result", required: true, options: [
              { label: "Materiály doručené — follow-up o 3 mesiace", value: "delivered", nextStepId: "step_retention" },
              { label: "Materiály nedoručené — riešiť", value: "not_delivered" }
            ]},
            { type: "textarea", label: "Poznámky z hovoru", name: "call6_notes", required: false }
          ]
        },
        {
          id: "step_active_no_materials",
          title: "Partner aktívny bez materiálov",
          description: "Partner aktívny, bez záujmu o materiály. Follow-up o 3 mesiace.",
          callScript: {
            title: "Poznámka",
            sections: [
              {
                heading: "Stav",
                text: "Partner má platnú zmluvu ale nemá záujem o materiály. Servisný follow-up o 3 mesiace."
              }
            ]
          },
          elements: [
            { type: "textarea", label: "Poznámky", name: "active_notes", required: false }
          ],
          nextStepId: "step_retention"
        },
        {
          id: "step_retention",
          title: "Fáza 8: RETENTION — Dlhodobý follow-up",
          description: "Každé 3 mesiace. Udržiavanie vzťahu.",
          callScript: {
            title: "Follow-up hovor (každé 3 mesiace)",
            sections: [
              {
                heading: "Hovor",
                text: `"Dobrý deň, pán doktor / pani doktorka. Tu [meno agenta] z Cord Blood Center.

Volám Vám v rámci nášho pravidelného servisného hovoru. Chcel/a by som sa opýtať:

1. Je u Vás všetko v poriadku so spoluprácou?
2. Potrebujete doplniť nejaké materiály? Letáky, knižky, plagát?
3. Máte nejaké otázky alebo návrhy na zlepšenie?

[Ak má novinky, reagujte podľa kontextu]

Ďakujem Vám za spoluprácu. Ozvem sa Vám znova o tri mesiace. Prajem pekný deň!"`
              }
            ]
          },
          elements: [
            { type: "radio", label: "Výsledok follow-up", name: "retention_result", required: true, options: [
              { label: "Partner spokojný — ďalší follow-up o 3 mesiace", value: "satisfied", nextStepId: "step_retention" },
              { label: "Potrebuje doplniť materiály", value: "needs_materials", nextStepId: "step_materials" },
              { label: "Problém / sťažnosť", value: "issue" }
            ]},
            { type: "textarea", label: "Poznámky z hovoru", name: "retention_notes", required: false }
          ]
        },
        {
          id: "step_declined",
          title: "ODMIETNUTÉ — Reactivation Flow",
          description: "Partner odmietol. Callback 6M alebo 3M pri referencii.",
          callScript: {
            title: "Záver hovoru pri odmietnutí",
            sections: [
              {
                heading: "Rozlúčka",
                text: `"Rozumiem, pán doktor / pani doktorka. Ďakujem Vám za čas, ktorý ste nám venovali. Ak by ste v budúcnosti zmenili názor alebo mali akékoľvek otázky, neváhajte sa na nás obrátiť. Prajem Vám pekný deň."`
              },
              {
                heading: "Dôležité",
                text: `• Nikdy nebuďte nátlakoví
• Zapíšte presný dôvod odmietnutia — je cenný pre budúci kontakt
• Systém automaticky nastaví callback o 6 mesiacov
• Ak medzitým získame novú referenciu z okolia partnera, kontakt sa reštartuje po 3 mesiacoch`
              }
            ]
          },
          elements: [
            { type: "radio", label: "Dôvod odmietnutia", name: "decline_reason", required: true, options: [
              { label: "Momentálne nemá záujem", value: "not_now" },
              { label: "Má konkurenciu", value: "has_competitor" },
              { label: "Nikdy nebude mať záujem", value: "never" },
              { label: "Iný dôvod", value: "other" }
            ]},
            { type: "radio", label: "Reactivation", name: "reactivation", required: true, options: [
              { label: "Callback o 6 mesiacov", value: "recontact_6m" },
              { label: "Nová referencia — reštart o 3 mesiace", value: "reference_restart_3m" },
              { label: "Definitívne uzavrieť", value: "close" }
            ]},
            { type: "textarea", label: "Presný dôvod odmietnutia", name: "decline_notes", required: false }
          ]
        }
      ]
    });

    await client.query(
      "UPDATE campaigns SET script = $1, updated_at = now() WHERE id = $2",
      [operatorScript, campaignId]
    );

    console.log('Call script updated successfully!');
    console.log(`Campaign: ${campaign.rows[0].name}`);
    console.log('Script includes full call texts for all phases:');
    console.log('  - Outreach (Email 1 / List 1 templates)');
    console.log('  - Call 1 (first contact + objection handling)');
    console.log('  - Call 2 (interest qualification + objections + FAQ)');
    console.log('  - Email 2 (detailed info template)');
    console.log('  - Call 3 (agreement + contract explanation)');
    console.log('  - List 3 (contract checklist)');
    console.log('  - Call 4 (contract follow-up + all scenarios)');
    console.log('  - Call 4.a (resend contract)');
    console.log('  - Call 4.b (missing data)');
    console.log('  - Call 5 (onboarding + materials offer)');
    console.log('  - Call 6 (materials confirmation)');
    console.log('  - Retention (3-month follow-up)');
    console.log('  - Declined (graceful closing + reactivation)');

  } catch (error) {
    console.error('Failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

updateCallScript();
