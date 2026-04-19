# OpenAI Realtime SIP — Asterisk Setup Guide

End-to-end migration from the existing STT→GPT→TTS pipeline (`server/lib/virtual-agent.ts`)
to OpenAI Realtime API over SIP. Replit drops out of the audio path; only tool-calls
flow back to Replit via webhook.

---

## Architecture

```
Caller → Asterisk (PJSIP) ──SIP/SRTP──▶ sip.api.openai.com (Realtime agent)
                                             │
                                             │  webhook POST when model needs CRM data
                                             ▼
                                       Replit /api/realtime/webhook
                                             │
                                             ▼
                                       Postgres (storage layer)
```

---

## 1. Replit side — already done in this codebase

| What | Where |
|---|---|
| Tool definitions (lookup_customer, get_contracts, get_documents) | `server/lib/realtime-tools.ts` |
| Webhook handler `POST /api/realtime/webhook` | `server/routes.ts` |
| Tool definitions JSON `GET /api/realtime/tool-definitions` | `server/routes.ts` |
| Latency log per turn (existing pipeline, for A/B comparison) | `[VA-LATENCY]` lines in workflow logs |

### Required env var

Set in Replit Secrets (or `.env` on Ubuntu):

```
REALTIME_WEBHOOK_SECRET=<generate-a-long-random-string>
```

OpenAI agent must send this in header `x-realtime-secret` on every tool call.
Leave unset to disable auth (NOT recommended for production).

### Get the tool definitions JSON

After deploy, fetch from your prod domain:

```bash
curl https://YOUR_DOMAIN/api/realtime/tool-definitions
```

Paste this into the OpenAI Realtime agent config (step 3 below).

---

## 2. OpenAI side — Project webhook + Project ID

OpenAI Agent Builder (the dashboard "Create new agent" UI) does **NOT** support
voice / SIP. For telephony you must use the **Realtime API directly** with a
project-level webhook that OpenAI calls when an inbound SIP call arrives.

### 2a. Create the project webhook
1. Go to **https://platform.openai.com/settings/organization/projects**
   → pick (or create) the project
2. Open **Webhooks** in the left nav → **Create webhook**
3. URL: `https://YOUR_DOMAIN/api/realtime/incoming-call`
   (we will add this endpoint in step 5 — it answers OpenAI with the agent
   session config: model, voice, instructions, tools)
4. Events: enable **`realtime.call.incoming`**
5. Copy the **signing secret** OpenAI shows you — save it as
   `OPENAI_WEBHOOK_SECRET` in Replit Secrets / Ubuntu `.env`

### 2b. Get your Project ID
1. **Settings → Project → General**
2. Copy the value labelled **Project ID**, format `proj_XXXXXXXXXXXXXXXX`
3. Save as `OPENAI_PROJECT_ID` in env vars (used only for documentation —
   the SIP URI hard-codes it, see step 3)

### 2c. (Optional but recommended) Pin a Realtime API key
Create a dedicated API key for this project under **API keys**, restrict it
to the Realtime scope, and save as `OPENAI_REALTIME_API_KEY`. The webhook
handler in step 5 uses this to acknowledge / configure the call.

---

## 3. Asterisk PJSIP — outbound trunk to OpenAI SIP

OpenAI's SIP endpoint authenticates the call by the **Project ID embedded in
the request URI** — there is no SIP username/password. The Project ID goes in
front of `@sip.api.openai.com` in the dialled URI.

Add to `/etc/asterisk/pjsip.conf`:

```ini
;------- OpenAI Realtime SIP trunk -------
[openai-realtime]
type = endpoint
transport = transport-tls
context = from-openai
disallow = all
allow = opus
allow = ulaw
direct_media = no
rtp_symmetric = yes
force_rport = yes
media_encryption = sdes
from_domain = sip.api.openai.com
aors = openai-aor

[openai-aor]
type = aor
contact = sip:sip.api.openai.com:5061\;transport=tls

[transport-tls]
type = transport
protocol = tls
bind = 0.0.0.0:5061
cert_file = /etc/asterisk/keys/asterisk.pem
priv_key_file = /etc/asterisk/keys/asterisk.key
method = tlsv1_2
```

Reload PJSIP and verify:

```bash
asterisk -rx "pjsip reload"
asterisk -rx "pjsip show endpoint openai-realtime"
asterisk -rx "pjsip show aor openai-aor"
```

---

## 4. Asterisk dialplan — route calls to OpenAI

The dial string embeds the **Project ID** (`proj_…`) in the user-part of the
SIP URI; this is how OpenAI routes the inbound INVITE to your project and
fires the `realtime.call.incoming` webhook.

Add to `/etc/asterisk/extensions.conf`:

```ini
;------- Test extension (parallel to existing virtual agent) -------
[from-pstn]
exten => _X.,1,NoOp(Inbound call from ${CALLERID(num)} to ${EXTEN})
 ; Route specific test number to OpenAI Realtime
 same => n,GotoIf($["${EXTEN}" = "421900000111"]?openai_agent,1)
 ; Default: existing ARI virtual agent
 same => n,Stasis(virtual-agent)
 same => n,Hangup()

[openai_agent]
exten => 1,1,NoOp(Routing to OpenAI Realtime SIP - caller=${CALLERID(num)})
 same => n,Set(CALLERID(name)=${CALLERID(num)})
 ; Replace proj_XXXX… with your real Project ID (from step 2b)
 same => n,Dial(PJSIP/proj_XXXXXXXXXXXXXXXX@openai-realtime,60,gT)
 same => n,Hangup()

[from-openai]
; OpenAI does not place outbound calls to us; log if it does
exten => _X.,1,NoOp(Unexpected inbound from OpenAI: ${EXTEN})
 same => n,Hangup()
```

Reload dialplan:

```bash
asterisk -rx "dialplan reload"
asterisk -rx "dialplan show openai_agent"
```

---

## 5. Replit-side webhook handler — `realtime.call.incoming`

When OpenAI receives the INVITE with your Project ID, it fires the
`realtime.call.incoming` event to the webhook you registered in step 2a.
Your handler must answer with the **session config** (model, voice,
instructions, tools, tool-webhook URL) — that defines the agent for this call.

This codebase ships with the endpoint already wired:

| Endpoint | Purpose |
|---|---|
| `POST /api/realtime/incoming-call` | Receives `realtime.call.incoming`, returns session config |
| `POST /api/realtime/webhook`       | Receives **tool calls** from the live agent (lookup_customer, get_contracts, get_documents) |
| `GET  /api/realtime/tool-definitions` | Returns the tool JSON for inspection |

### Required env vars on Ubuntu / Replit

```
OPENAI_API_KEY=sk-…                 # already set
OPENAI_PROJECT_ID=proj_…            # from step 2b
OPENAI_WEBHOOK_SECRET=whsec_…       # signing secret from step 2a
REALTIME_WEBHOOK_SECRET=<random>    # for our own /api/realtime/webhook auth
```

### Customising the agent

Edit `server/lib/realtime-tools.ts` to change the `REALTIME_SESSION_CONFIG`
object — model, voice, system prompt. Keep the system prompt short:

```
You are INDEXUS support agent. Greet the caller in Slovak.
Always start by calling lookup_customer with the caller's phone number.
Speak naturally, max 1–2 sentences per turn.
If asked about contracts, call get_contracts.
For document details, call get_documents.
Never invent data. If lookup fails, ask for full name and DOB.
```

Recommended model: `gpt-4o-mini-realtime-preview` (cheaper, fast).
Switch to `gpt-4o-realtime-preview` only if quality insufficient.

---

## 6. Testing

1. Deploy Replit changes (`git pull && npm run build && pm2 restart indexus-crm` on Ubuntu)
2. Reload Asterisk: `pjsip reload && dialplan reload`
3. Call your test number `421 900 000 111` (from step 3 dialplan)
4. Watch logs:
   - Asterisk: `asterisk -rvvv` — verify SIP INVITE goes to OpenAI
   - Replit: `pm2 logs indexus-crm | grep "\[Realtime\]"` — verify webhook fires
5. Compare latency:
   - Old pipeline: search logs for `[VA-LATENCY]` lines (totalUserPerceived field)
   - New pipeline: count seconds from "you said X" to "agent responds"

Expected: old 2000–5000 ms, new 500–800 ms.

---

## 6. Cutover

Once test is stable, change dialplan in step 3 to route all DIDs (or per-country DIDs)
to `openai_agent` instead of `Stasis(virtual-agent)`. Keep the old code as fallback —
if Asterisk gets a SIP timeout from OpenAI, dial-fail handler can fall back:

```ini
[openai_agent]
exten => 1,1,Dial(PJSIP/<AGENT_ID>@openai-realtime,30,gT)
 same => n,GotoIf($["${DIALSTATUS}" = "ANSWER"]?end)
 same => n,NoOp(OpenAI SIP failed: ${DIALSTATUS}, fallback to ARI)
 same => n,Stasis(virtual-agent)
 same => n(end),Hangup()
```

---

## 7. Tool latency budget

Each tool call adds latency to the user-perceived response. Targets:

| Tool | Target | Current bottleneck if slow |
|---|---|---|
| lookup_customer | < 200 ms | Index `customers(phone)` and `customers(mobile)` |
| get_contracts | < 200 ms | Index `contract_instances(customer_id)` |
| get_documents | < 300 ms | 3 queries — could be 1 join later |

Run on Ubuntu prod DB to verify indexes exist:

```sql
\d+ customers
\d+ contract_instances
```

If `idx_customers_phone` etc. missing, add them in a migration.

---

## 8. Cost note

Realtime API is ~6× more expensive per minute than chat + Whisper + TTS combined,
but UX win is dramatic. Mitigate by:
- Using `gpt-realtime-mini` not full model
- Keeping system prompt short (lower input token cost per turn)
- Setting `max_response_output_tokens` to ~80 (1–2 sentences)
- Hard turn limit (e.g. 15 turns) before escalating to human
