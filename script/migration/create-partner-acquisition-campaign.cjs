const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/indexus_crm',
});

async function createCampaign() {
  const client = await pool.connect();

  try {
    console.log('=== CREATE PARTNER ACQUISITION CAMPAIGN ===\n');
    await client.query('BEGIN');

    const operatorScript = JSON.stringify({
      steps: [
        {
          id: "step_outreach",
          title: "Fáza 1: OUTREACH — Email 1 / List 1",
          description: "Deň 0: Odoslať Email 1 alebo List 1 s predstavením spoločnosti a služieb. Partner bol oslovený.",
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
          description: "Po 2 pracovných dňoch od Email 1. Nadviazať kontakt, dohodnúť termín s lekárom, uviesť referenciu.",
          elements: [
            { type: "radio", label: "Výsledok Call 1", name: "call1_result", required: true, options: [
              { label: "Termín dohodnutý", value: "appointment_set", nextStepId: "step_call2" },
              { label: "Nedostupný — callback", value: "unavailable", nextStepId: "step_call1_callback" },
              { label: "Odmietnutie", value: "declined", nextStepId: "step_declined" }
            ]},
            { type: "textarea", label: "Referencia uvedená", name: "reference_name", required: false },
            { type: "textarea", label: "Poznámky", name: "call1_notes", required: false }
          ]
        },
        {
          id: "step_call1_callback",
          title: "Call 1 — Callback",
          description: "Lekár/ambulancia nedostupní. Nastaviť nový pokus o kontakt — ďalší pracovný deň alebo podľa dohody.",
          elements: [
            { type: "textarea", label: "Dôvod nedostupnosti", name: "callback_reason", required: false }
          ],
          nextStepId: "step_call1"
        },
        {
          id: "step_call2",
          title: "Fáza 3: INTEREST QUALIFICATION — Call 2",
          description: "V dohodnutom termíne. Zistiť potenciálny záujem, získať súhlas so zaslaním detailov, uviesť referenciu.",
          elements: [
            { type: "radio", label: "Výsledok Call 2", name: "call2_result", required: true, options: [
              { label: "Má záujem — poslať Email 2", value: "interested", nextStepId: "step_email2" },
              { label: "Potrebuje čas — follow-up o 1 týždeň", value: "needs_time", nextStepId: "step_call2_followup" },
              { label: "Odmieta", value: "declined", nextStepId: "step_declined" }
            ]},
            { type: "textarea", label: "Otázky partnera", name: "call2_questions", required: false },
            { type: "textarea", label: "Poznámky", name: "call2_notes", required: false }
          ]
        },
        {
          id: "step_call2_followup",
          title: "Call 2 — Follow-up",
          description: "Partner potrebuje čas na rozmyslenie. Callback o 1 týždeň.",
          elements: [
            { type: "textarea", label: "Poznámky k follow-up", name: "followup_notes", required: false }
          ],
          nextStepId: "step_call3"
        },
        {
          id: "step_email2",
          title: "Email 2 — Detailné informácie",
          description: "Zaslať Email 2 s detailnými informáciami o službách. Callback o 1 týždeň.",
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
          description: "Po 1 týždni od Email 2. Potvrdiť záujem o spoluprácu, zodpovedať otázky, informovať o zaslaní zmluvy.",
          elements: [
            { type: "radio", label: "Výsledok Call 3", name: "call3_result", required: true, options: [
              { label: "Súhlasí — zaslať zmluvu (List 3)", value: "agrees", nextStepId: "step_list3" },
              { label: "Ešte váha — callback podľa dohody", value: "hesitant", nextStepId: "step_call3" },
              { label: "Odmieta", value: "declined", nextStepId: "step_declined" }
            ]},
            { type: "textarea", label: "Otázky partnera", name: "call3_questions", required: false },
            { type: "textarea", label: "Poznámky", name: "call3_notes", required: false }
          ]
        },
        {
          id: "step_list3",
          title: "List 3 — Zaslanie zmluvy",
          description: "Odoslať: sprievodný list + 2x zmluva s prílohami + návratová obálka. Callback o 1 týždeň.",
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
          description: "Po 1 týždni od odoslania zmluvy. Overiť doručenie zmluvy, či bola zaslaná späť, či sú otázky.",
          elements: [
            { type: "radio", label: "Výsledok Call 4", name: "call4_result", required: true, options: [
              { label: "Partner zmluvu ešte neposlal — callback o 1 týždeň", value: "not_sent_yet", nextStepId: "step_call4" },
              { label: "Partner zmluvu odoslal — čakáme na doručenie", value: "sent_back", nextStepId: "step_contract_check" },
              { label: "Zmluva nedoručená do 2 týždňov", value: "not_delivered", nextStepId: "step_call4a" },
              { label: "Odmieta", value: "declined", nextStepId: "step_declined" }
            ]},
            { type: "textarea", label: "Poznámky", name: "call4_notes", required: false }
          ]
        },
        {
          id: "step_contract_check",
          title: "Kontrola doručenej zmluvy",
          description: "Zmluva fyzicky doručená — skontrolovať úplnosť a platnosť.",
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
          title: "Call 4.a — Zmluva nedoručená / bez podpisu",
          description: "Informovať partnera o zaslaní novej kópie. Odoslať List 3.a: 1 originál zmluvy + návratová obálka.",
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
          description: "Zmluva prišla bez potrebných údajov. Získať chýbajúce údaje telefonicky, doplniť do zmluvy.",
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
          description: "Next working day po validácii zmluvy. Potvrdiť prijatie originálu, ponúknuť letáky/poster/tehotenské knižky.",
          elements: [
            { type: "radio", label: "Výsledok Call 5", name: "call5_result", required: true, options: [
              { label: "Súhlas s materiálmi — zaslať balík", value: "wants_materials", nextStepId: "step_materials" },
              { label: "Bez záujmu o materiály — partner aktívny", value: "no_materials", nextStepId: "step_active_no_materials" }
            ]},
            { type: "textarea", label: "Požadované materiály", name: "materials_requested", required: false },
            { type: "textarea", label: "Poznámky", name: "call5_notes", required: false }
          ]
        },
        {
          id: "step_materials",
          title: "Odoslanie materiálov",
          description: "Zaslať: 50 ks letákov, poster (podľa potreby), 50 ks tehotenských knižiek (podľa záujmu), Pocket Guide + brožúra, email s PDF.",
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
          description: "Po 1 týždni od odoslania materiálov. Overiť doručenie materiálov a potreby partnera.",
          elements: [
            { type: "radio", label: "Výsledok Call 6", name: "call6_result", required: true, options: [
              { label: "Materiály doručené — dlhodobý follow-up o 3 mesiace", value: "delivered", nextStepId: "step_retention" },
              { label: "Materiály nedoručené — riešiť", value: "not_delivered" }
            ]},
            { type: "textarea", label: "Poznámky", name: "call6_notes", required: false }
          ]
        },
        {
          id: "step_active_no_materials",
          title: "Partner aktívny bez materiálov",
          description: "Partner je aktívny ale bez záujmu o tlačené materiály. Servisný follow-up o 3 mesiace.",
          elements: [
            { type: "textarea", label: "Poznámky", name: "active_notes", required: false }
          ],
          nextStepId: "step_retention"
        },
        {
          id: "step_retention",
          title: "Fáza 8: RETENTION / FOLLOW-UP",
          description: "Dlhodobý follow-up o 3 mesiace. Udržiavať vzťah s partnerom, overiť potreby.",
          elements: [
            { type: "radio", label: "Výsledok follow-up", name: "retention_result", required: true, options: [
              { label: "Partner spokojný — ďalší follow-up o 3 mesiace", value: "satisfied", nextStepId: "step_retention" },
              { label: "Potrebuje doplniť materiály", value: "needs_materials", nextStepId: "step_materials" },
              { label: "Problém / sťažnosť", value: "issue" }
            ]},
            { type: "textarea", label: "Poznámky", name: "retention_notes", required: false }
          ]
        },
        {
          id: "step_declined",
          title: "ODMIETNUTÉ — Reactivation Flow",
          description: "Partner odmietol v niektorej fáze. Uzavrieť aktuálnu vetvu. Callback o 6 mesiacov. Ak pribudne referencia: reštart najskôr po 3 mesiacoch.",
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
            { type: "textarea", label: "Poznámky k odmietnutiu", name: "decline_notes", required: false }
          ]
        }
      ]
    });

    const campaignSettings = JSON.stringify({
      workflow: {
        activityTypes: ["EMAIL", "LETTER", "CALL", "CALLBACK", "VALIDATION", "MATERIAL_DISPATCH", "FOLLOW_UP"],
        leadStatuses: [
          "EMAIL1_SENT", "CALL1_CALLBACK", "CALL1_DONE",
          "INTEREST_CONFIRMED", "INTEREST_PENDING", "INFO_SENT",
          "COOPERATION_AGREED", "COOPERATION_PENDING",
          "CONTRACT_SENT", "CONTRACT_AWAITING_RETURN", "CONTRACT_INBOUND_PENDING",
          "CONTRACT_NOT_DELIVERED", "CONTRACT_RESENT", "CONTRACT_UNSIGNED", "CONTRACT_INCOMPLETE",
          "CONTRACT_VALIDATED", "ONBOARDING_CONFIRMED",
          "MATERIALS_SENT", "MATERIALS_DELIVERED", "ACTIVE_NO_MATERIALS",
          "DECLINED_6M", "DECLINED_REFERENCE_3M"
        ],
        decisionRules: [
          { id: "R1", description: "Ak partner odmietne v hociktorej fáze: uzavrieť aktuálnu vetvu, vytvoriť callback o 6 mesiacov.", triggerStatus: "DECLINED_6M", callbackDays: 180 },
          { id: "R2", description: "Ak po odmietnutí pribudne referencia: nevstupovať hneď, reštart najskôr po 3 mesiacoch.", triggerStatus: "DECLINED_REFERENCE_3M", callbackDays: 90 },
          { id: "R3", description: "Ak zmluva neprišla: nepresúvať lead do odmietnutých, riešiť vetvu CONTRACT_NOT_DELIVERED → CONTRACT_RESENT.", fromStatus: "CONTRACT_NOT_DELIVERED", toStatus: "CONTRACT_RESENT" },
          { id: "R4", description: "Ak zmluva prišla neúplná: riešiť doplnenie údajov bez resetu procesu.", fromStatus: "CONTRACT_INCOMPLETE", toStatus: "CONTRACT_VALIDATED" },
          { id: "R5", description: "Po validácii zmluvy: vždy next working day Call 5.", fromStatus: "CONTRACT_VALIDATED", toStatus: "ONBOARDING_CONFIRMED", callbackDays: 1 }
        ],
        funnel: [
          { phase: 1, name: "Outreach", actions: "Email 1 / List 1", status: "EMAIL1_SENT" },
          { phase: 2, name: "Contact", actions: "Call 1", statuses: ["CALL1_DONE", "CALL1_CALLBACK"] },
          { phase: 3, name: "Interest Qualification", actions: "Call 2 + Email 2", statuses: ["INTEREST_CONFIRMED", "INTEREST_PENDING", "INFO_SENT"] },
          { phase: 4, name: "Agreement", actions: "Call 3 + List 3", statuses: ["COOPERATION_AGREED", "COOPERATION_PENDING", "CONTRACT_SENT"] },
          { phase: 5, name: "Contract Return Control", actions: "Call 4 / 4.a / 4.b", statuses: ["CONTRACT_AWAITING_RETURN", "CONTRACT_INBOUND_PENDING", "CONTRACT_NOT_DELIVERED", "CONTRACT_RESENT", "CONTRACT_UNSIGNED", "CONTRACT_INCOMPLETE", "CONTRACT_VALIDATED"] },
          { phase: 6, name: "Onboarding", actions: "Call 5", statuses: ["ONBOARDING_CONFIRMED", "ACTIVE_NO_MATERIALS"] },
          { phase: 7, name: "Material Confirmation", actions: "Call 6", statuses: ["MATERIALS_SENT", "MATERIALS_DELIVERED"] },
          { phase: 8, name: "Retention / Reactivation", actions: "3M follow-up alebo 6M recontact", statuses: ["DECLINED_6M", "DECLINED_REFERENCE_3M"] }
        ]
      }
    });

    const campaignResult = await client.query(`
      INSERT INTO campaigns (id, name, description, type, channel, status, country_codes, settings, script, default_active_tab, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'Partner Acquisition — Collaborator Onboarding',
        'Komplexná kampaň pre akvizíciu nových partnerov (lekárov/ambulancií). 8-fázový workflow: Outreach → Contact → Interest Qualification → Agreement → Contract Control → Onboarding → Material Confirmation → Retention. Obsahuje decision rules pre odmietnutie (6M recontact), referencie (3M reštart), nedoručené zmluvy a neúplné zmluvy.',
        'sales',
        'mixed',
        'draft',
        ARRAY['SK', 'CZ', 'HU', 'RO', 'IT', 'DE']::text[],
        $1,
        $2,
        'script',
        now(),
        now()
      )
      RETURNING id
    `, [campaignSettings, operatorScript]);

    const campaignId = campaignResult.rows[0].id;
    console.log(`Campaign created: ${campaignId}`);

    const phases = [
      { num: 1, name: "Outreach — Email 1 / List 1", type: "email" },
      { num: 2, name: "Contact — Call 1", type: "phone" },
      { num: 3, name: "Interest Qualification — Call 2 + Email 2", type: "phone" },
      { num: 4, name: "Agreement — Call 3 + List 3", type: "phone" },
      { num: 5, name: "Contract Return Control — Call 4", type: "phone" },
      { num: 6, name: "Onboarding — Call 5", type: "phone" },
      { num: 7, name: "Material Confirmation — Call 6", type: "phone" },
      { num: 8, name: "Retention / Reactivation", type: "phone" }
    ];

    for (const phase of phases) {
      await client.query(`
        INSERT INTO campaign_phases (id, campaign_id, phase_number, name, type, status, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, 'draft', now(), now())
      `, [campaignId, phase.num, phase.name, phase.type]);
    }
    console.log(`Created ${phases.length} campaign phases`);

    const dispositions = [
      { name: "Termín dohodnutý", code: "appointment_set", icon: "Calendar", color: "green", actionType: "convert", channel: "phone", sort: 1 },
      { name: "Záujem potvrdený", code: "interest_confirmed", icon: "ThumbsUp", color: "green", actionType: "convert", channel: "phone", sort: 2 },
      { name: "Súhlas so spoluprácou", code: "cooperation_agreed", icon: "Handshake", color: "green", actionType: "convert", channel: "phone", sort: 3 },
      { name: "Zmluva odoslaná", code: "contract_sent", icon: "FileText", color: "green", actionType: "none", channel: "phone", sort: 4 },
      { name: "Zmluva validovaná", code: "contract_validated", icon: "CheckCircle", color: "green", actionType: "convert", channel: "phone", sort: 5 },
      { name: "Onboarding potvrdený", code: "onboarding_confirmed", icon: "UserPlus", color: "green", actionType: "convert", channel: "phone", sort: 6 },
      { name: "Materiály odoslané", code: "materials_sent", icon: "Package", color: "green", actionType: "none", channel: "phone", sort: 7 },
      { name: "Materiály doručené", code: "materials_delivered", icon: "PackageCheck", color: "green", actionType: "complete", channel: "phone", sort: 8 },
      { name: "Callback — dohodnutý termín", code: "callback_scheduled", icon: "CalendarPlus", color: "blue", actionType: "callback", channel: "phone", sort: 10 },
      { name: "Callback — 1 týždeň", code: "callback_1week", icon: "Clock", color: "blue", actionType: "callback", channel: "phone", sort: 11 },
      { name: "Callback — next working day", code: "callback_nwd", icon: "Clock", color: "blue", actionType: "callback", channel: "phone", sort: 12 },
      { name: "Potrebuje čas", code: "needs_time", icon: "Clock", color: "blue", actionType: "callback", channel: "phone", sort: 13 },
      { name: "Ešte váha", code: "hesitant", icon: "HelpCircle", color: "blue", actionType: "callback", channel: "phone", sort: 14 },
      { name: "Zmluva ešte neodoslaná späť", code: "contract_awaiting", icon: "Clock", color: "yellow", actionType: "callback", channel: "phone", sort: 20 },
      { name: "Zmluva nedoručená", code: "contract_not_delivered", icon: "AlertTriangle", color: "orange", actionType: "callback", channel: "phone", sort: 21 },
      { name: "Zmluva bez podpisu", code: "contract_unsigned", icon: "AlertCircle", color: "orange", actionType: "callback", channel: "phone", sort: 22 },
      { name: "Zmluva neúplná", code: "contract_incomplete", icon: "FileWarning", color: "orange", actionType: "callback", channel: "phone", sort: 23 },
      { name: "Zmluva opätovne odoslaná", code: "contract_resent", icon: "RotateCcw", color: "yellow", actionType: "callback", channel: "phone", sort: 24 },
      { name: "Nedvíha", code: "no_answer", icon: "PhoneOff", color: "gray", actionType: "callback", channel: "phone", sort: 30 },
      { name: "Obsadené", code: "busy", icon: "Phone", color: "yellow", actionType: "callback", channel: "phone", sort: 31 },
      { name: "Hlasová schránka", code: "voicemail", icon: "MessageSquare", color: "gray", actionType: "callback", channel: "phone", sort: 32 },
      { name: "Odmietnutie — callback 6M", code: "declined_6m", icon: "ThumbsDown", color: "red", actionType: "callback", channel: "phone", sort: 40 },
      { name: "Odmietnutie — referencia 3M reštart", code: "declined_ref_3m", icon: "RotateCcw", color: "orange", actionType: "callback", channel: "phone", sort: 41 },
      { name: "Definitívne odmietnutie", code: "declined_final", icon: "XCircle", color: "red", actionType: "dnd", channel: "phone", sort: 42 },
      { name: "Partner aktívny bez materiálov", code: "active_no_materials", icon: "User", color: "green", actionType: "complete", channel: "phone", sort: 50 },
      { name: "Email 1 odoslaný", code: "email1_sent", icon: "Send", color: "green", actionType: "send_email", channel: "email", sort: 60 },
      { name: "Email 2 — detailné info", code: "email2_sent", icon: "Send", color: "green", actionType: "send_email", channel: "email", sort: 61 },
      { name: "Email s PDF odoslaný", code: "pdf_email_sent", icon: "Send", color: "green", actionType: "send_email", channel: "email", sort: 62 },
    ];

    for (const d of dispositions) {
      await client.query(`
        INSERT INTO campaign_dispositions (id, campaign_id, name, code, channel, icon, color, action_type, is_default, is_active, sort_order, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, true, $8, now(), now())
      `, [campaignId, d.name, d.code, d.channel, d.icon, d.color, d.actionType, d.sort]);
    }
    console.log(`Created ${dispositions.length} campaign dispositions`);

    await client.query(`
      INSERT INTO campaign_schedules (id, campaign_id, working_days, working_hours_start, working_hours_end, max_attempts_per_contact, min_hours_between_attempts, auto_assign_contacts, prioritize_callbacks, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, ARRAY['monday','tuesday','wednesday','thursday','friday']::text[], '08:00', '17:00', 10, 24, true, true, now(), now())
    `, [campaignId]);
    console.log('Created campaign schedule (Mon-Fri, 08:00-17:00)');

    await client.query('COMMIT');

    console.log('\n=== CAMPAIGN CREATED SUCCESSFULLY ===');
    console.log(`Campaign ID: ${campaignId}`);
    console.log('Name: Partner Acquisition — Collaborator Onboarding');
    console.log('Type: Sales | Channel: Mixed (phone + email + letter)');
    console.log('Status: Draft (activate when ready)');
    console.log('Phases: 8 (Outreach → Contact → Interest → Agreement → Contract → Onboarding → Materials → Retention)');
    console.log(`Dispositions: ${dispositions.length}`);
    console.log('Schedule: Mon-Fri, 08:00-17:00, max 10 attempts/contact');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed, rolled back:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createCampaign();
