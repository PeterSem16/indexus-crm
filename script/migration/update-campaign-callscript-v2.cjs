const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/indexus_crm',
});

let eid = 0;
function elemId() { return `el_${++eid}`; }

function scriptBlock(heading, text) {
  return [
    { id: elemId(), type: "heading", label: heading, content: heading },
    { id: elemId(), type: "paragraph", label: "", content: text }
  ];
}

function noteBlock(text) {
  return [{ id: elemId(), type: "note", label: "", content: text, style: "info" }];
}

function radioEl(label, name, required, options) {
  return { id: elemId(), type: "radio", label, name, required: required, options };
}

function textareaEl(label, name, required) {
  return { id: elemId(), type: "textarea", label, name, required: required || false };
}

function divider() {
  return { id: elemId(), type: "divider", label: "" };
}

async function updateCallScript() {
  const client = await pool.connect();

  try {
    console.log('=== UPDATE CAMPAIGN CALL SCRIPT v2 ===\n');

    const campaign = await client.query(
      "SELECT id, name FROM campaigns WHERE name LIKE '%Partner Acquisition%' LIMIT 1"
    );

    if (campaign.rows.length === 0) {
      console.log('Campaign not found!');
      return;
    }

    const campaignId = campaign.rows[0].id;
    console.log(`Found campaign: ${campaign.rows[0].name} (${campaignId})`);

    const script = {
      version: 1,
      name: "Partner Acquisition — Collaborator Onboarding",
      description: "Kompletný call script pre akvizíciu nových partnerov. 8-fázový workflow s textami hovorov, emailovými šablónami a námietkami.",
      startStepId: "step_outreach",
      steps: [
        {
          id: "step_outreach",
          title: "Fáza 1: OUTREACH — Email 1 / List 1",
          description: "Deň 0: Odoslať Email 1 alebo List 1 s predstavením spoločnosti a služieb.",
          nextStepId: "step_call1",
          elements: [
            ...scriptBlock("Predmet emailu", "Spolupráca s Cord Blood Center — informácie pre Vašu ambulanciu"),
            ...scriptBlock("Text emailu / listu",
`Vážený pán doktor / Vážená pani doktorka,

dovoľujeme si Vás osloviť v mene spoločnosti Cord Blood Center, ktorá je lídrom v oblasti spracovania a uchovávania pupočníkovej krvi na Slovensku.

Radi by sme Vám predstavili možnosť spolupráce, ktorá prinesie pridanú hodnotu Vašim pacientkam a zároveň Vašej ambulancii.

Čo ponúkame:
• Bezplatnú spoluprácu — žiadne náklady pre Vašu ambulanciu
• Informačné materiály pre pacientky (letáky, plagáty, brožúry)
• Odborné školenie a podporu
• Referencie od spolupracujúcich lekárov vo Vašom regióne

V nasledujúcich dňoch Vás budeme kontaktovať telefonicky, aby sme Vám mohli poskytnúť podrobnejšie informácie.

S pozdravom,
[Meno agenta]
Cord Blood Center`),
            divider(),
            radioEl("Spôsob oslovenia", "outreach_method", true, [
              { label: "Email 1 odoslaný", value: "email_sent" },
              { label: "List 1 odoslaný poštou", value: "letter_sent" }
            ]),
            textareaEl("Poznámky k osloveniu", "outreach_notes", false)
          ]
        },

        {
          id: "step_call1",
          title: "Fáza 2: CONTACT — Call 1",
          description: "Po 2 pracovných dňoch od Email 1. Nadviazať kontakt, dohodnúť termín, uviesť referenciu.",
          elements: [
            ...scriptBlock("Úvod hovoru",
`"Dobrý deň, tu [meno agenta] zo spoločnosti Cord Blood Center. Mohla by som hovoriť s pánom doktorom / pani doktorkou [priezvisko]?"`),

            ...scriptBlock("Ak prepoja na lekára",
`"Dobrý deň, pán doktor / pani doktorka. Volám Vám v nadväznosti na email [alebo list], ktorý sme Vám zaslali pred dvoma dňami ohľadom možnosti spolupráce s Cord Blood Center.

Sme spoločnosť, ktorá sa špecializuje na spracovanie a uchovávanie pupočníkovej krvi. S Vašou ambulanciou by sme radi nadviazali spoluprácu, tak ako napríklad s doktorom [meno referencie] z [miesto], s ktorým úspešne spolupracujeme.

Mohli by sme si dohodnúť krátky termín, kedy by som Vám mohla priblížiť detaily?"`),

            ...scriptBlock("Ak je k dispozícii len sestra / recepcia",
`"Rozumiem, že pán doktor / pani doktorka je momentálne zaneprázdnený/á. Mohli by ste mu/jej, prosím, odovzdať odkaz, že sme volali zo spoločnosti Cord Blood Center ohľadom spolupráce? Kedy by bolo najlepšie zavolať, aby som ho/ju zastihla?"`),

            ...scriptBlock("Ak sa opýta 'O čo ide?'",
`"Ide o možnosť bezplatnej spolupráce v oblasti uchovávania pupočníkovej krvi. Pre pána doktora / pani doktorku to znamená pridanú hodnotu pre jeho/jej pacientky bez akýchkoľvek nákladov. Radi by sme mu/jej to bližšie vysvetlili."`),

            ...scriptBlock("Dohodnutie termínu",
`"Výborne, ďakujem za Váš čas. Tak sa teda ozvem [dohodnutý termín]. Prajem Vám pekný deň!"`),

            ...scriptBlock("Ak odmietne",
`"Rozumiem, pán doktor / pani doktorka. Ďakujem Vám za čas. Ak by ste v budúcnosti zmenili názor, neváhajte nás kontaktovať. Prajem Vám pekný deň."`),

            divider(),
            radioEl("Výsledok Call 1", "call1_result", true, [
              { label: "Termín dohodnutý", value: "appointment_set", nextStepId: "step_call2" },
              { label: "Nedostupný — callback", value: "unavailable", nextStepId: "step_call1_callback" },
              { label: "Odmietnutie", value: "declined", nextStepId: "step_declined" }
            ]),
            textareaEl("Referencia uvedená", "reference_name", false),
            textareaEl("Poznámky z hovoru", "call1_notes", false)
          ]
        },

        {
          id: "step_call1_callback",
          title: "Call 1 — Callback (nedostupný)",
          description: "Lekár/ambulancia nedostupní. Nový pokus ďalší pracovný deň.",
          nextStepId: "step_call1",
          elements: [
            ...noteBlock("Použite rovnaký skript ako pri Call 1. Ak sa nedovoláte 3x po sebe, skúste volať v inom čase dňa (ráno namiesto poobedia alebo naopak)."),
            textareaEl("Dôvod nedostupnosti", "callback_reason", false)
          ]
        },

        {
          id: "step_call2",
          title: "Fáza 3: INTEREST QUALIFICATION — Call 2",
          description: "V dohodnutom termíne. Zistiť záujem, získať súhlas so zaslaním detailov.",
          elements: [
            ...scriptBlock("Úvod hovoru",
`"Dobrý deň, pán doktor / pani doktorka. Tu [meno agenta] z Cord Blood Center. Volám Vám podľa našej dohody z [dátum]."`),

            ...scriptBlock("Predstavenie služieb",
`"Ako som spomínala, Cord Blood Center sa špecializuje na spracovanie a uchovávanie pupočníkovej krvi. Naša spolupráca s lekármi funguje veľmi jednoducho:

1. Do Vašej ambulancie dodáme informačné materiály pre pacientky
2. Vy pacientky informujete o tejto možnosti v rámci bežnej prenatálnej starostlivosti
3. Ak má pacientka záujem, my zabezpečíme všetko ostatné — od odbornej konzultácie až po samotný odber

Pre Vás to neznamená žiadnu administratívnu záťaž ani náklady.

Čo hovoríte, mali by ste záujem o bližšie informácie?"`),

            ...scriptBlock("Ak má záujem",
`"Výborne! V takom prípade Vám ihneď zašlem email s detailnými informáciami o našich službách, cenníkom a referenciami. Dám Vám týždeň na preštudovanie a potom sa ozvem.

Môžem potvrdiť Vašu emailovú adresu? [overiť email]

Ďakujem, pán doktor / pani doktorka. Email Vám odošlem ešte dnes. Ozvem sa Vám [dátum o týždeň]. Prajem pekný deň!"`),

            ...scriptBlock("Ak potrebuje čas",
`"Úplne rozumiem, pán doktor / pani doktorka. Ide o dôležité rozhodnutie. Čo keby som sa Vám ozvala o týždeň? Dovtedy si môžete v pokoji všetko premyslieť a ja Vám rád/a zodpoviem všetky otázky."`),

            ...scriptBlock("Ak odmieta",
`"Rozumiem, pán doktor / pani doktorka. Môžem sa opýtať, čo je hlavným dôvodom? [počúvať]

Ďakujem Vám za úprimnosť. Ak by ste v budúcnosti zmenili názor, neváhajte sa na nás obrátiť. Prajem Vám pekný deň."`),

            ...scriptBlock("Námietky a odpovede",
`NÁMIETKA: "Nemám na to čas."
→ "Práve preto je naša spolupráca nastavená tak, aby Vám nezabrala prakticky žiaden čas. Stačí umiestniť naše letáky v čakárni — pacientky sa informujú samy."

NÁMIETKA: "Už spolupracujem s konkurenciou."
→ "Rozumiem. Môžem sa opýtať, s kým spolupracujete? Radi by sme Vám ukázali, v čom sa líšime."

NÁMIETKA: "Pacientky sa o to nezaujímajú."
→ "Až [%] tehotných žien má záujem o informácie o uchovávaní pupočníkovej krvi, ak sú im poskytnuté lekárom. Doktor [referencia] mal podobnú obavu a dnes je jedným z našich najaktívnejších partnerov."`),

            divider(),
            radioEl("Výsledok Call 2", "call2_result", true, [
              { label: "Má záujem — poslať Email 2", value: "interested", nextStepId: "step_email2" },
              { label: "Potrebuje čas — follow-up o 1 týždeň", value: "needs_time", nextStepId: "step_call2_followup" },
              { label: "Odmieta", value: "declined", nextStepId: "step_declined" }
            ]),
            textareaEl("Otázky partnera", "call2_questions", false),
            textareaEl("Námietky", "call2_objections", false),
            textareaEl("Poznámky z hovoru", "call2_notes", false)
          ]
        },

        {
          id: "step_call2_followup",
          title: "Call 2 — Follow-up (potrebuje čas)",
          description: "Partner potrebuje čas. Callback o 1 týždeň.",
          nextStepId: "step_call3",
          elements: [
            ...noteBlock("Pri ďalšom hovore nadviažte na predchádzajúci rozhovor a použite skript Call 3."),
            textareaEl("Poznámky k follow-up", "followup_notes", false)
          ]
        },

        {
          id: "step_email2",
          title: "Email 2 — Detailné informácie",
          description: "Zaslať Email 2 s detailnými informáciami. Callback o 1 týždeň.",
          nextStepId: "step_call3",
          elements: [
            ...scriptBlock("Predmet emailu", "Podrobné informácie o spolupráci s Cord Blood Center — podľa našej dohody"),
            ...scriptBlock("Text emailu",
`Vážený pán doktor / Vážená pani doktorka [priezvisko],

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

S pozdravom,
[Meno agenta]
Cord Blood Center
[telefón] | [email]`),
            divider(),
            radioEl("Email 2 odoslaný", "email2_sent", true, [
              { label: "Áno, odoslaný", value: "sent" }
            ]),
            textareaEl("Poznámky", "email2_notes", false)
          ]
        },

        {
          id: "step_call3",
          title: "Fáza 4: AGREEMENT — Call 3",
          description: "Po 1 týždni od Email 2. Potvrdiť záujem, zodpovedať otázky, dohodnúť zmluvu.",
          elements: [
            ...scriptBlock("Úvod hovoru",
`"Dobrý deň, pán doktor / pani doktorka. Tu [meno agenta] z Cord Blood Center. Volám Vám, ako sme sa dohodli, ohľadom informácií, ktoré som Vám zaslal/a minulý týždeň.

Mali ste možnosť si ich pozrieť?"`),

            ...scriptBlock("Zodpovedanie otázok",
`"Máte nejaké otázky k informáciám, ktoré som Vám zaslal/a?"

Hlavné body:
• Spolupráca je bezplatná — žiadne poplatky ani záväzky
• Dodáme materiály priamo do ambulancie
• Pacientky sa informujú samy z materiálov — nezaberá to čas lekára
• Zabezpečíme pravidelnú obnovu materiálov`),

            ...scriptBlock("Dohodnutie zmluvy",
`"Výborne! Ak súhlasíte so spoluprácou, radi by sme Vám zaslali zmluvu o spolupráci.

Pošleme Vám poštou:
• Sprievodný list s popisom spolupráce
• Dva výtlačky zmluvy — jeden si ponecháte, druhý nám pošlete späť v priloženej návratovej obálke
• Všetky prílohy

Vyhovuje Vám to?"`),

            ...scriptBlock("Ak súhlasí",
`"Ďakujem Vám za dôveru! Zmluvu Vám odošleme ešte dnes / zajtra. Mala by Vám prísť do 3-5 pracovných dní.

Ozvem sa Vám o týždeň, aby som overil/a, či Vám bola doručená. Prajem pekný deň!"`),

            ...scriptBlock("Ak váha",
`"Úplne rozumiem. Môžem sa opýtať, čo Vás ešte drží? [počúvať]

Keby som Vám zavolal/a [navrhnutý termín], mali by ste dovtedy čas sa rozhodnúť?"`),

            ...scriptBlock("Ak odmieta",
`"Rozumiem, pán doktor / pani doktorka. Ďakujem Vám za čas, ktorý ste nám venovali. Prajem Vám pekný deň."`),

            divider(),
            radioEl("Výsledok Call 3", "call3_result", true, [
              { label: "Súhlasí — zaslať zmluvu (List 3)", value: "agrees", nextStepId: "step_list3" },
              { label: "Ešte váha — callback podľa dohody", value: "hesitant", nextStepId: "step_call3" },
              { label: "Odmieta", value: "declined", nextStepId: "step_declined" }
            ]),
            textareaEl("Otázky partnera", "call3_questions", false),
            textareaEl("Poznámky z hovoru", "call3_notes", false)
          ]
        },

        {
          id: "step_list3",
          title: "List 3 — Zaslanie zmluvy",
          description: "Odoslať: sprievodný list + 2x zmluva + prílohy + návratová obálka.",
          nextStepId: "step_call4",
          elements: [
            ...scriptBlock("Checklist pred odoslaním",
`Overte, že zásielka obsahuje:
☐ Sprievodný list (personalizovaný s menom lekára)
☐ 2x zmluva o spolupráci (obe podpísané z našej strany)
☐ Prílohy k zmluve
☐ Návratová obálka (predplatená)
☐ Vizitka kontaktnej osoby`),
            divider(),
            radioEl("List 3 odoslaný", "list3_sent", true, [
              { label: "Áno, zmluva odoslaná", value: "sent" }
            ]),
            textareaEl("Poznámky k odoslaniu", "list3_notes", false)
          ]
        },

        {
          id: "step_call4",
          title: "Fáza 5: CONTRACT RETURN CONTROL — Call 4",
          description: "Po 1 týždni. Overiť doručenie a vrátenie zmluvy.",
          elements: [
            ...scriptBlock("Úvod hovoru",
`"Dobrý deň, pán doktor / pani doktorka. Tu [meno agenta] z Cord Blood Center. Volám Vám ohľadom zmluvy o spolupráci, ktorú sme Vám zaslali minulý týždeň.

Bola Vám doručená?"`),

            ...scriptBlock("Ak zmluvu dostal/a",
`"Výborne! Stihli ste ju už pozrieť a podpísať?"

Ak podpísal/a a odoslal/a:
"Ďakujem! Počkáme na doručenie a hneď ako ju dostaneme a skontrolujeme, ozvem sa Vám s potvrdením."

Ak ešte nepodpísal/a:
"Rozumiem. Stačí podpísať obidva výtlačky, jeden si ponechať a druhý vložiť do priloženej návratovej obálky. Kedy by ste to mohli stihnúť?"

Ak má otázky k zmluve:
"Samozrejme, rád/a Vám vysvetlím. O čo konkrétne ide?"`),

            ...scriptBlock("Ak zmluvu nedostal/a (2+ týždne)",
`"To ma mrzí. Ihneď Vám zašleme novú kópiu. Tentokrát bude obsahovať jeden originál zmluvy a návratovú obálku. Ozvem sa Vám o týždeň.

Môžem si overiť Vašu adresu? [overiť adresu]"`),

            divider(),
            radioEl("Výsledok Call 4", "call4_result", true, [
              { label: "Zmluvu ešte neposlal — callback o 1 týždeň", value: "not_sent_yet", nextStepId: "step_call4" },
              { label: "Zmluvu odoslal — čakáme na doručenie", value: "sent_back", nextStepId: "step_contract_check" },
              { label: "Zmluva nedoručená do 2 týždňov", value: "not_delivered", nextStepId: "step_call4a" },
              { label: "Odmieta", value: "declined", nextStepId: "step_declined" }
            ]),
            textareaEl("Poznámky z hovoru", "call4_notes", false)
          ]
        },

        {
          id: "step_contract_check",
          title: "Kontrola doručenej zmluvy",
          description: "Zmluva fyzicky doručená — skontrolovať úplnosť.",
          elements: [
            ...scriptBlock("Kontrolný checklist",
`☐ Je zmluva podpísaná? → Ak nie: Call 4.a
☐ Sú vyplnené všetky údaje (meno, IČO, adresa, dátum)? → Ak nie: Call 4.b
☐ Sú priložené všetky prílohy? → Ak nie: Call 4.b
☐ Je všetko v poriadku? → Validácia → Call 5 next working day`),
            divider(),
            radioEl("Stav zmluvy", "contract_status", true, [
              { label: "Zmluva validná a kompletná", value: "valid", nextStepId: "step_call5" },
              { label: "Zmluva bez podpisu", value: "unsigned", nextStepId: "step_call4a" },
              { label: "Zmluva bez potrebných údajov", value: "incomplete", nextStepId: "step_call4b" }
            ])
          ]
        },

        {
          id: "step_call4a",
          title: "Call 4.a — Nedoručená zmluva / bez podpisu",
          description: "Informovať partnera, odoslať novú kópiu.",
          nextStepId: "step_call4",
          elements: [
            ...scriptBlock("Hovor",
`"Dobrý deň, pán doktor / pani doktorka. Tu [meno agenta] z Cord Blood Center.

[Ak nedoručená:]
Bohužiaľ, zmluvu, ktorú sme Vám zaslali, sa nám nepodarilo doručiť. Ihneď Vám zašleme novú kópiu — tentokrát jeden originál zmluvy s návratovou obálkou.

[Ak bez podpisu:]
Zmluvu sme obdržali, ale bohužiaľ chýba Váš podpis. Zašleme Vám novú kópiu na podpísanie.

Ozvem sa Vám o týždeň. Prepáčte za komplikácie."`),
            divider(),
            radioEl("List 3.a odoslaný", "list3a_sent", true, [
              { label: "Áno, náhradná zmluva odoslaná", value: "sent" }
            ]),
            textareaEl("Poznámky", "call4a_notes", false)
          ]
        },

        {
          id: "step_call4b",
          title: "Call 4.b — Chýbajúce údaje",
          description: "Získať chýbajúce údaje telefonicky.",
          elements: [
            ...scriptBlock("Hovor",
`"Dobrý deň, pán doktor / pani doktorka. Tu [meno agenta] z Cord Blood Center.

Zmluvu sme obdržali, ďakujeme! Bohužiaľ, v niektorých poliach chýbajú údaje. Mohli by sme ich doplniť telefonicky?

Potrebujeme doplniť: [vymenovať chýbajúce údaje]

Výborne, ďakujem! Údaje doplníme a zmluva bude kompletná."`),
            divider(),
            textareaEl("Chýbajúce údaje", "missing_data", true),
            radioEl("Údaje doplnené", "data_completed", true, [
              { label: "Áno, údaje doplnené", value: "completed", nextStepId: "step_call5" }
            ]),
            textareaEl("Poznámky", "call4b_notes", false)
          ]
        },

        {
          id: "step_call5",
          title: "Fáza 6: ONBOARDING — Call 5",
          description: "Next working day po validácii. Potvrdiť prijatie, ponúknuť materiály.",
          elements: [
            ...scriptBlock("Úvod hovoru",
`"Dobrý deň, pán doktor / pani doktorka! Tu [meno agenta] z Cord Blood Center.

Volám Vám s radostnou správou — Vašu zmluvu sme obdržali a je všetko v poriadku. Vaša originálna kópia Vám bude doručená poštou v najbližších dňoch.

Oficiálne Vás vítam medzi partnermi Cord Blood Center!"`),

            ...scriptBlock("Ponuka materiálov",
`"Teraz by som s Vami rád/a prešiel/šla, aké informačné materiály Vám môžeme dodať:

1. Letáky pre pacientky (50 kusov) — do čakárne alebo na recepciu
2. Plagát — ak máte miesto na nástenku
3. Tehotenské knižky (50 kusov) — veľmi obľúbené u pacientiek
4. Pocket Guide a brožúru — pre Vás a Váš tím

Všetko Vám zašleme poštou a navyše email s PDF verziami.

O čo by ste mali záujem?"`),

            ...scriptBlock("Ak chce materiály",
`"Výborne! Balík Vám odošleme ešte dnes / zajtra. Ozvem sa Vám o týždeň, aby som overil/a doručenie.

Ešte raz ďakujem za dôveru a teším sa na spoluprácu!"`),

            ...scriptBlock("Ak nechce materiály",
`"Rozumiem, nie je problém. Ak by ste sa v budúcnosti rozhodli, neváhajte sa ozvať.

Dohodli by sme sa na servisný hovor o 3 mesiace? Ďakujem a teším sa na spoluprácu!"`),

            divider(),
            radioEl("Výsledok Call 5", "call5_result", true, [
              { label: "Súhlas s materiálmi — zaslať balík", value: "wants_materials", nextStepId: "step_materials" },
              { label: "Bez záujmu o materiály", value: "no_materials", nextStepId: "step_active_no_materials" }
            ]),
            textareaEl("Požadované materiály", "materials_requested", false),
            textareaEl("Poznámky z hovoru", "call5_notes", false)
          ]
        },

        {
          id: "step_materials",
          title: "Odoslanie materiálov",
          description: "Zaslať materiálový balík podľa dohody z Call 5.",
          nextStepId: "step_call6",
          elements: [
            ...scriptBlock("Checklist pred odoslaním",
`Podľa dohody z Call 5 pripravte:
☐ Letáky pre pacientky (50 ks)
☐ Plagát do čakárne (podľa záujmu)
☐ Tehotenské knižky (50 ks, podľa záujmu)
☐ Pocket Guide + brožúra
☐ Email s PDF verziami materiálov`),
            divider(),
            radioEl("Letáky (50 ks)", "leaflets", true, [
              { label: "Odoslané", value: "sent" },
              { label: "Nežiadané", value: "not_requested" }
            ]),
            radioEl("Poster", "poster", true, [
              { label: "Odoslaný", value: "sent" },
              { label: "Nežiadaný", value: "not_requested" }
            ]),
            radioEl("Tehotenské knižky (50 ks)", "pregnancy_books", true, [
              { label: "Odoslané", value: "sent" },
              { label: "Nežiadané", value: "not_requested" }
            ]),
            radioEl("Pocket Guide + brožúra", "pocket_guide", true, [
              { label: "Odoslané", value: "sent" },
              { label: "Nežiadané", value: "not_requested" }
            ]),
            radioEl("Email s PDF", "pdf_email", true, [
              { label: "Odoslaný", value: "sent" },
              { label: "Neodoslaný", value: "not_sent" }
            ]),
            textareaEl("Poznámky k materiálom", "materials_notes", false)
          ]
        },

        {
          id: "step_call6",
          title: "Fáza 7: MATERIAL CONFIRMATION — Call 6",
          description: "Po 1 týždni od odoslania materiálov.",
          elements: [
            ...scriptBlock("Hovor",
`"Dobrý deň, pán doktor / pani doktorka. Tu [meno agenta] z Cord Blood Center.

Volám Vám ohľadom materiálov, ktoré sme Vám zaslali minulý týždeň. Boli Vám doručené?"`),

            ...scriptBlock("Ak doručené",
`"Výborne! Je všetko v poriadku? Máte dostatok materiálov?

Ozvem sa Vám znova o tri mesiace na servisný hovor. Ak by ste niečo potrebovali skôr, neváhajte sa ozvať.

Ďakujem Vám a prajem veľa úspechov!"`),

            ...scriptBlock("Ak nedoručené",
`"To ma mrzí. Overím to a zabezpečíme opätovné doručenie. Ozvem sa Vám do [termín]."`),

            divider(),
            radioEl("Výsledok Call 6", "call6_result", true, [
              { label: "Materiály doručené — follow-up o 3 mesiace", value: "delivered", nextStepId: "step_retention" },
              { label: "Materiály nedoručené — riešiť", value: "not_delivered" }
            ]),
            textareaEl("Poznámky z hovoru", "call6_notes", false)
          ]
        },

        {
          id: "step_active_no_materials",
          title: "Partner aktívny bez materiálov",
          description: "Partner aktívny, bez záujmu o materiály. Follow-up o 3 mesiace.",
          nextStepId: "step_retention",
          elements: [
            ...noteBlock("Partner má platnú zmluvu ale nemá záujem o materiály. Servisný follow-up o 3 mesiace."),
            textareaEl("Poznámky", "active_notes", false)
          ]
        },

        {
          id: "step_retention",
          title: "Fáza 8: RETENTION — Dlhodobý follow-up",
          description: "Každé 3 mesiace. Udržiavanie vzťahu.",
          elements: [
            ...scriptBlock("Hovor",
`"Dobrý deň, pán doktor / pani doktorka. Tu [meno agenta] z Cord Blood Center.

Volám Vám v rámci pravidelného servisného hovoru. Chcel/a by som sa opýtať:

1. Je u Vás všetko v poriadku so spoluprácou?
2. Potrebujete doplniť nejaké materiály? Letáky, knižky, plagát?
3. Máte nejaké otázky alebo návrhy na zlepšenie?

Ďakujem Vám za spoluprácu. Ozvem sa Vám znova o tri mesiace. Prajem pekný deň!"`),

            divider(),
            radioEl("Výsledok follow-up", "retention_result", true, [
              { label: "Spokojný — ďalší follow-up o 3 mesiace", value: "satisfied", nextStepId: "step_retention" },
              { label: "Potrebuje doplniť materiály", value: "needs_materials", nextStepId: "step_materials" },
              { label: "Problém / sťažnosť", value: "issue" }
            ]),
            textareaEl("Poznámky z hovoru", "retention_notes", false)
          ]
        },

        {
          id: "step_declined",
          title: "ODMIETNUTÉ — Reactivation Flow",
          description: "Partner odmietol. Callback 6M alebo 3M pri referencii.",
          isEndStep: true,
          elements: [
            ...scriptBlock("Rozlúčka",
`"Rozumiem, pán doktor / pani doktorka. Ďakujem Vám za čas, ktorý ste nám venovali. Ak by ste v budúcnosti zmenili názor alebo mali akékoľvek otázky, neváhajte sa na nás obrátiť. Prajem Vám pekný deň."`),

            ...noteBlock(`DÔLEŽITÉ:
• Nikdy nebuďte nátlakoví
• Zapíšte presný dôvod odmietnutia — je cenný pre budúci kontakt
• Systém automaticky nastaví callback o 6 mesiacov
• Ak medzitým získame referenciu z okolia, kontakt sa reštartuje po 3 mesiacoch`),

            divider(),
            radioEl("Dôvod odmietnutia", "decline_reason", true, [
              { label: "Momentálne nemá záujem", value: "not_now" },
              { label: "Má konkurenciu", value: "has_competitor" },
              { label: "Nikdy nebude mať záujem", value: "never" },
              { label: "Iný dôvod", value: "other" }
            ]),
            radioEl("Reactivation", "reactivation", true, [
              { label: "Callback o 6 mesiacov", value: "recontact_6m" },
              { label: "Nová referencia — reštart o 3 mesiace", value: "reference_restart_3m" },
              { label: "Definitívne uzavrieť", value: "close" }
            ]),
            textareaEl("Presný dôvod odmietnutia", "decline_notes", false)
          ]
        }
      ]
    };

    await client.query(
      "UPDATE campaigns SET script = $1, updated_at = now() WHERE id = $2",
      [JSON.stringify(script), campaignId]
    );

    console.log('\nCall script v2 updated successfully!');
    console.log(`Total steps: ${script.steps.length}`);
    console.log(`Total elements: ${eid}`);
    console.log('Format: OperatorScript v1 (compatible with Script Builder UI)');

  } catch (error) {
    console.error('Failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

updateCallScript();
