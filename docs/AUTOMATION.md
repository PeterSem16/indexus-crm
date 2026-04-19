# Automation Engine — Documentation

Komplexná dokumentácia automatizačného systému INDEXUS CRM.
Engine reaguje na **udalosti (events)** vo všetkých moduloch CRM, vyhodnocuje
**podmienky (conditions)** a vykonáva **akcie (actions)** — od vytvorenia úloh
cez emaily, SMS, webhooky až po manipuláciu entít a tagov.

---

## 1. Architektúra

```
   ┌─────────────┐     emit       ┌────────────┐    match     ┌────────────┐
   │  CRM moduly │ ─────────────▶│ event_bus  │────────────▶│   Engine   │
   │ (customer,  │                │ (in-memory │              │ - rules    │
   │  task,      │                │  + persist)│              │ - cond eval│
   │  hospital,  │                └────────────┘              │ - actions  │
   │  call, …)   │                                            └─────┬──────┘
   └─────────────┘                                                  │
                                                                    ▼
                                            ┌──────────────────────────────────┐
                                            │  workflow_runs / action_log      │
                                            │  (history, retries, dry-run)     │
                                            └──────────────────────────────────┘
```

**Kľúčové súbory:**
| File | Zodpovednosť |
|---|---|
| `server/lib/event-bus.ts` | Definícia `EventInput`, in-memory bus, persistencia do `workflow_events` |
| `server/lib/automation-engine.ts` | `processEvent`, vyhodnocovanie podmienok, registry akcií |
| `server/lib/automation-routes.ts` | REST API + katalóg pre UI |
| `client/src/pages/automations.tsx` | UI: Rules / Builder / Run history |
| `shared/schema.ts` | Tabuľky `workflow_rules`, `workflow_runs`, `workflow_action_log`, `workflow_events` |

---

## 2. Štruktúra pravidla (Rule)

```jsonc
{
  "name": "VIP klient — okamžitý task pre agenta",
  "description": "Optional...",
  "module": "customer",          // customer | task | contract | hospital | clinic | call
  "countryCode": "SK",           // optional, scope na krajinu (null = global)
  "enabled": true,
  "isSystem": false,
  "rateLimitPerHour": null,      // (planned) max executions / rule / hour
  "trigger": {
    "type": "event",             // event | schedule
    "entityType": "customer",
    "eventType": "updated"
  },
  "conditions": { /* viď bod 4 */ },
  "actions": [ /* viď bod 5 */ ]
}
```

### Triggers

#### `event` triggers
| Event type | Emitted by |
|---|---|
| `created` | POST handlers (customer, task, contract, hospital, clinic, invoice) |
| `updated` | PATCH handlers (s old/new snapshotom) |
| `status_changed` | Špeciálny prípad `updated` ak sa zmenil `status` |
| `task.completed` | Task workflow |
| `task.overdue` | Auto-emisia z `alert-evaluator` keď `dueDate < now()` |
| `call.assigned` | Inbound call assigned to agent |
| `call.answered` | Agent picked up |
| `call.completed` | Call finished normally |
| `call.abandoned` | Caller hung up before answer |
| `call.timeout` | Queue timeout |
| `manual` | Manual trigger from UI / API |

#### `schedule` triggers
```jsonc
"trigger": { "type": "schedule", "interval": "*/15 * * * *" }
```
Cron-light syntax. Scheduler v `alert-evaluator.ts` tickne každú minútu a vyhodnotí, či nejaké pravidlo má bežať.

---

## 3. Event payload (kontext pre podmienky a akcie)

Engine vyhodnocuje podmienky a šablóny voči objektu `ctx`:

```jsonc
{
  "event": {
    "id": "evt_xxx",
    "module": "customer",
    "entityType": "customer",
    "entityId": "cust-uuid",
    "eventType": "updated",
    "country": "SK",
    "source": "api" | "inbound-call" | "schedule" | "manual",
    "createdAt": "2026-04-19T..."
  },
  "oldValues": { /* snapshot pred zmenou */ },
  "newValues": { /* snapshot po zmene; alebo entity payload pri created */ },
  "rule": { "id": "...", "name": "..." },
  "user": { "id": "...", "fullName": "..." }
}
```

V akciách / hodnotách podmienok môžete použiť **šablónu** `{{path.to.value}}`:
- `{{newValues.email}}`
- `{{event.entityId}}`
- `{{oldValues.status}} → {{newValues.status}}`

---

## 4. Conditions (podmienky)

Stromová štruktúra **AND/OR/NOT** s leaf-podmienkami. Engine vyhodnocuje rekurzívne.

```jsonc
"conditions": {
  "all": [                                       // AND
    { "field": "newValues.country", "op": "eq", "value": "SK" },
    {
      "any": [                                   // OR
        { "field": "newValues.status", "op": "eq", "value": "vip" },
        { "field": "newValues.leadScore", "op": "gte", "value": 80 }
      ]
    },
    { "not": { "field": "newValues.assignedUserId", "op": "exists" } }
  ]
}
```

### Operátory
| Operator | Význam | Arity |
|---|---|---|
| `eq` | rovná sa | 1 |
| `neq` | nerovná sa | 1 |
| `gt`, `gte`, `lt`, `lte` | porovnania | 1 |
| `in` | hodnota v zozname (CSV alebo array) | 1 |
| `not_in` | hodnota mimo zoznamu | 1 |
| `contains` | substring (string) / element (array) | 1 |
| `starts_with`, `ends_with` | string match | 1 |
| `between` | medzi A a B (inclusive) | 2 |
| `exists` | hodnota nie je null/undefined/"" | 0 |
| `not_exists` | opak | 0 |
| `changed` | `oldValues.X !== newValues.X` | 0 |
| `changed_to` | nová hodnota === value | 1 |
| `changed_from` | stará hodnota === value | 1 |

`field` môže byť ľubovoľná dot-path do `ctx`. Príklady: `newValues.status`,
`event.country`, `oldValues.priority`.

---

## 5. Actions (akcie)

### 5.1 `create_task`
Vytvorí task s šablónovaným titulom/popisom.
```jsonc
{
  "type": "create_task",
  "config": {
    "title": "Volat klientku {{newValues.firstName}}",
    "description": "Lead score: {{newValues.leadScore}}",
    "assignedUserId": "user-uuid",
    "assignedDepartmentId": null,
    "priority": "high",                          // low|medium|high|urgent
    "dueDate": "+1d",                            // +Nd|+Nh|+Nm alebo ISO
    "customerId": "{{event.entityId}}"
  }
}
```

### 5.2 `notify_user`
Push notifikácia do Notification panelu (cez WebSocket).
```jsonc
{
  "type": "notify_user",
  "config": {
    "userId": "{{newValues.assignedUserId}}",
    "title": "Nový VIP klient",
    "body": "{{newValues.firstName}} {{newValues.lastName}}",
    "link": "/customers/{{event.entityId}}"
  }
}
```

### 5.3 `send_email`
**Multi-provider:** MS365 systémový mailbox per krajina → SendGrid fallback → log-only.
```jsonc
{
  "type": "send_email",
  "config": {
    "templateId": "tpl-uuid",                    // optional, override below
    "to": "{{newValues.email}}",
    "cc": "manager@indexus.com,sales@indexus.com",
    "bcc": "audit@indexus.com",                  // MS365 only
    "from": "noreply@indexus.com",               // optional
    "subject": "Vitajte v INDEXUS",
    "body": "<p>Ahoj {{newValues.firstName}}...</p>",
    "attachments": [
      { "name": "brochure.pdf", "url": "https://files.indexus.com/x.pdf" },
      { "name": "logo.png", "contentType": "image/png", "contentBase64": "iVBOR..." }
    ]
  }
}
```
**Limity príloh:** max 5 súborov, 10 MB / súbor, 25 MB total. URL prílohy s SSRF guard (no localhost / private IPs), 15 s timeout.

**Output:** `{ provider, sent, failed, simulated, attachmentErrors? }`.

### 5.4 `send_sms`
BulkGate provider, per-country routing.
```jsonc
{
  "type": "send_sms",
  "config": {
    "templateId": "tpl-uuid",                    // optional
    "to": "{{newValues.mobile}}",
    "text": "Vitajte! Aktivujte konto: {{event.activationLink}}",
    "country": "SK",                             // defaults to event.country
    "kind": "transactional",                     // transactional|promotional
    "unicode": false,
    "tag": "welcome-sms"
  }
}
```

### 5.5 `webhook`
Generický POST na externý systém. SSRF guard zablokuje localhost / private IPs.
```jsonc
{
  "type": "webhook",
  "config": {
    "url": "https://hooks.zapier.com/...",
    "method": "POST",
    "headers": { "Authorization": "Bearer xyz" },
    "body": { "customerId": "{{event.entityId}}" }
  }
}
```

### 5.6 `update_entity`
Atomická mutácia polí na entite. **Allow-list per typ** — nedá sa cez to upraviť ID, audit polia atď.
```jsonc
{
  "type": "update_entity",
  "config": {
    "entityType": "customer",     // task|customer|hospital|clinic|invoice
    "entityId": "{{event.entityId}}",
    "fields": {
      "leadStatus": "qualified",
      "notes": "Auto-qualified by rule"
    }
  }
}
```
Allow-listy:
| Entity | Polia |
|---|---|
| task | status, priority, assignedUserId, assignedDepartmentId, dueDate, title, description, resolution, resolvedByUserId, resolvedAt |
| customer | status, clientStatus, leadStatus, leadScore, assignedUserId, notes, country |
| hospital | isActive, autoRecruiting, responsiblePersonId, representativeId |
| clinic | isActive, notes, initialStatus, contractStatus, lastCallResult, lastCallNote, nextContactDate |
| invoice | status, note, sendDate, dueDate, paidAmount |

### 5.7 `assign_user` (auto-pridelovanie)
Vyberie agenta podľa stratégie a priradí ho ako vlastníka entity.
```jsonc
{
  "type": "assign_user",
  "config": {
    "entityType": "customer",     // task|customer|hospital|clinic
    "entityId": "{{event.entityId}}",
    "strategy": "least_loaded",   // round_robin|least_loaded|random|specific
    "userIds": ["u1","u2","u3"],  // explicit pool (optional)
    "userId": "u1",               // pre strategy=specific
    "roleFilter": "agent",        // ak userIds prázdny — filter všetkých aktívnych
    "countryFilter": ["SK","CZ"]
  }
}
```
Mapovanie cieľového stĺpca:
- `task`, `customer` → `assignedUserId`
- `hospital`, `clinic` → `responsiblePersonId`

**Stratégie:**
- `round_robin` — cyklicky cez pool. Cursor v pamäti per `(ruleId + sorted(pool))`.
- `least_loaded` — user s najmenej otvorených taskov (`status NOT IN (completed, cancelled)`).
- `random` — náhodný výber.
- `specific` — pevný user.

### 5.8 `add_tag` / `remove_tag`
Atomická manipulácia s `tags TEXT[]` stĺpcom. Add deduplikuje cez `unnest + DISTINCT`, remove odfiltruje cez `<> ALL`.
```jsonc
{ "type": "add_tag",
  "config": { "entityType": "customer", "tags": ["vip", "newsletter-2026"] } }

{ "type": "remove_tag",
  "config": { "entityType": "task", "entityId": "{{event.entityId}}", "tags": "stale" } }
```
`tags` akceptuje pole alebo CSV. Output vráti `currentTags` po operácii.

Podporované entity: `customer`, `task`, `hospital`, `clinic`. Stĺpec `tags` sa
vytvára cez auto-migráciu v `server/index.ts` (idempotentné `ADD COLUMN IF NOT EXISTS`).

---

## 6. Message templates (uložené šablóny)

Tabuľka `message_templates`:
| Pole | Popis |
|---|---|
| `id`, `name`, `type` | `email` \| `sms` |
| `subject`, `content`, `contentHtml` | telo (subject len pre email) |
| `format` | `text` \| `html` (pre email volí stĺpec) |
| `attachments` | JSON `[{ fileName, filePath, mimeType, size }]` — uložené na disku |
| `isActive` | či sa dá použiť |
| `usageCount` | inkrementuje sa pri každom použití |

V akciách `send_email` / `send_sms` uveďte `templateId`. Inline polia v config-u **prepíšu** template hodnoty (napr. vlastný subject pri zachovanom body).

---

## 7. Rate limiting (planned, MVP-2)

Stĺpec `workflow_rules.rate_limit_per_hour` už existuje. Engine v `processEvent`
preskočí pravidlo (`status = "skipped"`, `reason = "rate-limited"`) ak počet
runov v poslednej hodine prekročí limit.

---

## 8. Run history & dry-run

### 8.1 REST API
```
GET   /api/automation/rules                  list (?module, ?country)
POST  /api/automation/rules                  create (admin)
GET   /api/automation/rules/:id              detail
PATCH /api/automation/rules/:id              update (admin)
DELETE /api/automation/rules/:id             delete (admin)
POST  /api/automation/rules/:id/test         dry-run with sampleEvent (admin)
POST  /api/automation/rules/:id/run          force run (admin)

GET   /api/automation/runs                   recent runs (?ruleId, ?limit)
GET   /api/automation/runs/:id               { run, actions[], event }

GET   /api/automation/catalog                modules, eventTypes, actionTypes,
                                              operators, fields, countries
GET   /api/automation/users                  user dropdown
POST  /api/automation/emit                   manual emit (admin)
```
**Auth:** `requireAuth` pre čítanie, `requireAutomationAdmin` (role admin/superadmin/owner) pre zápis.

### 8.2 Run statuses
- `running` — beží práve teraz
- `success` — všetky akcie OK
- `failed` — aspoň jedna akcia neuspela
- `skipped` — pravidlo nebolo spustené (rate limit, podmienky)

### 8.3 UI tabs
- **Rules** — karta s pravidlami, prepínač enabled, edit, delete, runs.
- **Runs** — globálny prehľad:
  - **6 stat kariet** — Total / Success / Failed / Skipped / Success rate / Avg duration
  - **Sparkline** posledných 50 runov (farebné prúžky, klik → detail)
  - **Top 8 pravidiel** podľa aktivity s progress-barom úspešnosti
  - **Filter** podľa statusu a pravidla, expandable detail per run

---

## 9. Cross-module event emission

Eventy sa emitujú v `server/routes.ts` z týchto miest:
| Modul | POST/PATCH | Event |
|---|---|---|
| customers | POST `/api/customers` | `customer.created` |
| customers | PATCH `/api/customers/:id` | `customer.updated` (+ `status_changed` ak sa zmenil status) |
| tasks | POST/PATCH | `task.created`, `task.updated`, `task.completed` |
| contracts | POST/PATCH | `contract.created`, `contract.updated` |
| hospitals | POST/PATCH | `hospital.created`, `hospital.updated` |
| clinics | POST/PATCH | `clinic.created`, `clinic.updated` |
| customer-invoices | POST/PATCH | `invoice.created`, `invoice.updated` |
| inbound-calls | queue engine | `call.assigned/answered/completed/abandoned/timeout` |

Všetky obsahujú `oldValues` / `newValues` snapshoty + `country`.

---

## 10. Quick recipes

### A) Auto-priradenie nového klienta na agenta s najmenej taskami
```jsonc
{
  "name": "Round-robin assign new customers",
  "module": "customer",
  "trigger": { "type": "event", "entityType": "customer", "eventType": "created" },
  "conditions": { "field": "event.country", "op": "eq", "value": "SK" },
  "actions": [
    { "type": "assign_user",
      "config": { "entityType": "customer", "strategy": "least_loaded", "roleFilter": "agent", "countryFilter": "SK" } }
  ]
}
```

### B) Welcome email + tag pri registrácii cez web
```jsonc
{
  "name": "Welcome web-form lead",
  "module": "customer",
  "trigger": { "type": "event", "entityType": "customer", "eventType": "created" },
  "conditions": { "field": "newValues.registrationSource", "op": "eq", "value": "web_form" },
  "actions": [
    { "type": "send_email",
      "config": { "templateId": "tpl-welcome-sk", "to": "{{newValues.email}}" } },
    { "type": "add_tag",
      "config": { "entityType": "customer", "tags": ["web-lead", "needs-followup"] } },
    { "type": "create_task",
      "config": { "title": "Volať webový lead {{newValues.firstName}}", "priority": "high", "dueDate": "+1d", "customerId": "{{event.entityId}}" } }
  ]
}
```

### C) Eskalácia neprijatého hovoru
```jsonc
{
  "name": "Missed call → SMS callback offer",
  "module": "call",
  "trigger": { "type": "event", "entityType": "call", "eventType": "call.abandoned" },
  "actions": [
    { "type": "send_sms",
      "config": { "to": "{{event.callerNumber}}", "templateId": "tpl-callback-offer" } },
    { "type": "create_task",
      "config": { "title": "Zavolať späť: {{event.callerNumber}}", "priority": "urgent", "dueDate": "+30m" } }
  ]
}
```

### D) Status zmena → notifikácia + log
```jsonc
{
  "name": "VIP qualified → notify CEO",
  "module": "customer",
  "trigger": { "type": "event", "entityType": "customer", "eventType": "updated" },
  "conditions": {
    "all": [
      { "field": "newValues.leadStatus", "op": "changed_to", "value": "qualified" },
      { "field": "newValues.leadScore", "op": "gte", "value": 90 }
    ]
  },
  "actions": [
    { "type": "notify_user", "config": { "userId": "ceo-user-id", "title": "VIP qualified", "body": "{{newValues.firstName}} {{newValues.lastName}}" } },
    { "type": "add_tag", "config": { "entityType": "customer", "tags": ["vip-2026"] } }
  ]
}
```

---

## 11. Nexus Pulse — statusy a integrácia s automatizáciami

**Nexus Pulse** je centrálny dispozičný engine pre statusy interakcií (najmä
hovorov v kampaniach). Statusy sú jeden z najsilnejších zdrojov triggerov pre
automatizácie — väčšina obchodných pravidiel sa odpaľuje práve pri ich zmene.

### 11.1 Hierarchia
```
Status Category   →   Status Definition   →   Campaign Assignment   →   Default Action
(farba/ikona)         (konkrétny disp)        (povolené v kampani)       (auto-akcia)
```

### 11.2 Tabuľky
| Tabuľka | Účel |
|---|---|
| `status_categories` | 9 farebných skupín (gray/blue/green/purple/cyan/teal/orange/emerald/red) |
| `status_definitions` | konkrétne statusy + meta-flagy + `defaultAction` |
| `campaign_status_assignments` | ktoré statusy môže agent použiť v danej kampani |

### 11.3 Kategórie
| Code | Názov | Farba |
|---|---|---|
| `not_reached` | Nedovolané / bez spojenia | gray |
| `callback` | Callback / odložené | blue |
| `interest` | Záujem / obchodný progres | green |
| `contract` | Zmluva / dokumenty | purple |
| `email_sms` | Email / SMS komunikácia | cyan |
| `materials` | Materiály / onboarding | teal |
| `declined` | Odmietnutie / stop | orange |
| `completed` | Dokončené / uzatvorené | emerald |
| `invalid` | Chybné / neplatné kontakty | red |

### 11.4 Meta-pravidlá per status
| Flag | Význam pre agenta | Význam pre automation engine |
|---|---|---|
| `isFinal` | ukončí lead — kontakt zmizne z queue | spoľahlivý trigger pre **archive / report / VIP escalation** |
| `isConversion` | úspech (zmluva, predaj) | trigger pre **welcome flow, accountant notify, commission task** |
| `requiresNote` | vynúti poznámku | poznámka je dostupná v `newValues.lastCallNote` pre šablóny `{{...}}` |
| `requiresCallback` | vynúti naplánovanie callbacku | trigger pre `create_task` s `dueDate` z formulára |
| `defaultAction` | builtin akcia (callback / send_email / start_onboarding / do_not_call / reschedule) | beží **pred** automatizáciami; rule môže defaultnú akciu doplniť alebo prepísať |

### 11.5 Eventy emitované pri zmene statusu

Keď agent zvolí status v Nexus Pulse, systém emituje:

| Event | Modul | `newValues` obsahuje |
|---|---|---|
| `customer.updated` (`status_changed`) | customer | `clientStatus`, `leadStatus`, `lastCallResult`, `lastCallNote`, `lastDispositionId`, `lastDispositionCategory` |
| `clinic.updated` (`status_changed`) | clinic | `contractStatus`, `lastCallResult`, `lastCallNote`, `nextContactDate` |
| `hospital.updated` (`status_changed`) | hospital | `lastDispositionId`, `lastCallResult` |
| `call.completed` | call | `callId`, `disposition`, `dispositionCategory`, `dispositionFlags` (isFinal/isConversion), `durationSec`, `agentId` |

**Kľúčová zhoda:** v podmienkach pravidiel používajte:
- `newValues.lastCallResult` — kód statusu (napr. `contract.signed`)
- `newValues.lastDispositionCategory` — kategória (napr. `contract`, `interest`)
- `event.dispositionFlags.isConversion` — pri `call.completed`

### 11.6 Recepty — automatizácie naviazané na Pulse statusy

#### A) Konverzia → kompletný onboarding flow
Spustí sa kedykoľvek agent vyberie status z kategórie `contract` s `isConversion=true`.
```jsonc
{
  "name": "Konverzia → onboarding",
  "module": "customer",
  "trigger": { "type": "event", "entityType": "customer", "eventType": "updated" },
  "conditions": {
    "all": [
      { "field": "newValues.lastDispositionCategory", "op": "eq", "value": "contract" },
      { "field": "newValues.lastCallResult", "op": "changed_to", "value": "contract.signed" }
    ]
  },
  "actions": [
    { "type": "add_tag", "config": { "entityType": "customer", "tags": ["converted-2026", "onboarding"] } },
    { "type": "send_email", "config": { "templateId": "tpl-welcome-pack", "to": "{{newValues.email}}" } },
    { "type": "create_task", "config": {
        "title": "Odoslať odberovú sadu — {{newValues.firstName}} {{newValues.lastName}}",
        "priority": "high", "dueDate": "+1d",
        "customerId": "{{event.entityId}}",
        "description": "Adresa: {{newValues.address}}, {{newValues.city}}\nPoznámka agenta: {{newValues.lastCallNote}}"
      } },
    { "type": "assign_user", "config": {
        "entityType": "customer", "strategy": "least_loaded", "roleFilter": "onboarding-specialist"
      } },
    { "type": "notify_user", "config": {
        "userId": "{{newValues.salesManagerId}}",
        "title": "Nová konverzia",
        "body": "{{newValues.firstName}} podpísal zmluvu (provízia: {{newValues.contractValue}})"
      } }
  ]
}
```

#### B) Callback status → automatický task s deadline
```jsonc
{
  "name": "Callback → task pre agenta",
  "module": "customer",
  "trigger": { "type": "event", "entityType": "customer", "eventType": "updated" },
  "conditions": { "field": "newValues.lastDispositionCategory", "op": "eq", "value": "callback" },
  "actions": [
    { "type": "create_task", "config": {
        "title": "Callback: {{newValues.firstName}} {{newValues.lastName}}",
        "description": "Dôvod: {{newValues.lastCallNote}}",
        "priority": "high",
        "dueDate": "{{newValues.nextContactDate}}",
        "assignedUserId": "{{newValues.assignedUserId}}",
        "customerId": "{{event.entityId}}"
      } },
    { "type": "add_tag", "config": { "entityType": "customer", "tags": ["pending-callback"] } }
  ]
}
```

#### C) Odmietnutie → odhlásenie z marketingu + archív
```jsonc
{
  "name": "Declined → unsubscribe",
  "module": "customer",
  "trigger": { "type": "event", "entityType": "customer", "eventType": "updated" },
  "conditions": {
    "any": [
      { "field": "newValues.lastDispositionCategory", "op": "eq", "value": "declined" },
      { "field": "newValues.lastCallResult", "op": "eq", "value": "invalid.do_not_call" }
    ]
  },
  "actions": [
    { "type": "remove_tag", "config": { "entityType": "customer", "tags": ["newsletter", "promo-eligible"] } },
    { "type": "add_tag", "config": { "entityType": "customer", "tags": ["do-not-contact"] } },
    { "type": "update_entity", "config": {
        "entityType": "customer",
        "entityId": "{{event.entityId}}",
        "fields": { "clientStatus": "terminated", "leadStatus": "lost" }
      } }
  ]
}
```

#### D) Nedovolané 3×+ → preradiť na seniora
Vyžaduje políčko `noAnswerCount` na zákazníkovi — engine inkrementuje pri každom statuse z kategórie `not_reached` (cez `update_entity` v inom pravidle alebo backendovo).
```jsonc
{
  "name": "3× nedovolané → senior agent",
  "module": "customer",
  "trigger": { "type": "event", "entityType": "customer", "eventType": "updated" },
  "conditions": {
    "all": [
      { "field": "newValues.lastDispositionCategory", "op": "eq", "value": "not_reached" },
      { "field": "newValues.noAnswerCount", "op": "gte", "value": 3 }
    ]
  },
  "actions": [
    { "type": "assign_user", "config": {
        "entityType": "customer", "strategy": "least_loaded", "roleFilter": "senior-agent"
      } },
    { "type": "add_tag", "config": { "entityType": "customer", "tags": ["hard-to-reach"] } },
    { "type": "notify_user", "config": {
        "userId": "{{newValues.assignedUserId}}",
        "title": "Lead preradený", "body": "{{newValues.firstName}} — 3× nedovolané, prevzatý seniorom"
      } }
  ]
}
```

#### E) Final disposition → email s materiálmi
```jsonc
{
  "name": "Materiály odoslané → tracking SMS",
  "module": "customer",
  "trigger": { "type": "event", "entityType": "customer", "eventType": "updated" },
  "conditions": {
    "all": [
      { "field": "newValues.lastDispositionCategory", "op": "eq", "value": "materials" },
      { "field": "newValues.lastCallResult", "op": "changed_to", "value": "materials.sent" }
    ]
  },
  "actions": [
    { "type": "send_sms", "config": {
        "to": "{{newValues.mobile}}",
        "text": "Dobrý deň, balík s informáciami sme odoslali. Sledovanie: {{newValues.shipmentTrackingUrl}}"
      } },
    { "type": "create_task", "config": {
        "title": "Follow-up po doručení materiálov — {{newValues.firstName}}",
        "priority": "medium", "dueDate": "+5d",
        "customerId": "{{event.entityId}}"
      } }
  ]
}
```

### 11.7 Best practices

1. **Filtrujte podľa kategórie, nie status kódu**, ak je to možné — pravidlo prežije
   pridanie nových statusov do tej istej kategórie.
2. **Kombinujte `changed_to` s konkrétnym statusom** keď chcete reagovať len pri
   prechode (nie pri každom uložení toho istého statusu).
3. **`requiresNote` statusy** garantujú, že `newValues.lastCallNote` nebude
   prázdny — bezpečne ho použite v šablónach.
4. **`isFinal=true` statusy** používajte ako trigger pre archív/audit/report
   pravidlá — kontakt sa už nebude nikdy zmení.
5. **`defaultAction`** beží **pred** automation enginom. Ak `defaultAction=send_email`
   a aj automation rule pošle email, klient dostane dva — buď vypnite jeden,
   alebo nechajte automatizácii dokončenie cez `update_entity`.
6. **Per-kampaň scope** — to isté pravidlo môžete obmedziť cez podmienku
   `event.campaignId == "..."` ak chcete inú logiku v rôznych kampaniach.

### 11.8 Mapovanie polí v automations katalógu
V Builder UI nájdete tieto polia pre Pulse-driven podmienky:
| Pole v UI | Skutočná cesta | Typ |
|---|---|---|
| Posledný status | `newValues.lastCallResult` | string (kód) |
| Kategória statusu | `newValues.lastDispositionCategory` | enum |
| Klient status | `newValues.clientStatus` | enum (potential/in_process/acquired/terminated) |
| Lead status | `newValues.leadStatus` | enum (new/qualified/lost/won) |
| Posledná poznámka | `newValues.lastCallNote` | text |
| Nasledujúci kontakt | `newValues.nextContactDate` | date |
| Status flag isFinal | `event.dispositionFlags.isFinal` | bool (len v `call.completed`) |
| Status flag isConversion | `event.dispositionFlags.isConversion` | bool (len v `call.completed`) |

---

## 12. Roadmap (post-MVP)

- [x] A1 — Catalog field metadata
- [x] A2 — Visual rule builder UI
- [x] B1 — Cross-module event emission (vrátane inbound-calls)
- [x] C1 — Scheduled cron triggers + `task.overdue` auto-emisia
- [x] Bod 1 — Email attachments (URL + base64)
- [x] Bod 2 — cc/bcc support (MS365 + SendGrid)
- [x] Bod 3 — Stored message templates
- [x] Bod 4 — `assign_user` action
- [x] Bod 5 — `add_tag` / `remove_tag` actions
- [x] Bod 6 — Run history visualization
- [ ] Bod 7 — Per-rule rate limiting
- [ ] Bod 8 — Auto-disable rule on repeated errors
