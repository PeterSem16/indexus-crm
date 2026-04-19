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

## 2. Asterisk PJSIP — add OpenAI trunk

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
outbound_auth = openai-auth
aors = openai-aor

[openai-auth]
type = auth
auth_type = userpass
username = <YOUR_OPENAI_PROJECT_ID_OR_AGENT_ID>
password = <YOUR_OPENAI_REALTIME_SIP_TOKEN>

[openai-aor]
type = aor
contact = sip:sip.api.openai.com:5061;transport=tls

[transport-tls]
type = transport
protocol = tls
bind = 0.0.0.0:5061
cert_file = /etc/asterisk/keys/asterisk.pem
priv_key_file = /etc/asterisk/keys/asterisk.key
method = tlsv1_2
```

Reload PJSIP:

```bash
asterisk -rx "pjsip reload"
asterisk -rx "pjsip show endpoint openai-realtime"
```

---

## 3. Asterisk dialplan — route calls to OpenAI

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
exten => 1,1,NoOp(Routing to OpenAI Realtime SIP agent)
 same => n,Set(CALLERID(name)=${CALLERID(num)})
 same => n,Dial(PJSIP/<YOUR_AGENT_ID>@openai-realtime,60,gT)
 same => n,Hangup()

[from-openai]
; OpenAI shouldn't initiate inbound calls but log if it happens
exten => _X.,1,NoOp(Unexpected inbound from OpenAI: ${EXTEN})
 same => n,Hangup()
```

Reload dialplan:

```bash
asterisk -rx "dialplan reload"
```

---

## 4. OpenAI Realtime agent — configure

Two ways:

### Option A: OpenAI Dashboard (easier for first agent)
1. Go to https://platform.openai.com/realtime → Create new agent
2. Model: `gpt-realtime-mini` (cheaper, faster — switch to full model only if quality insufficient)
3. Voice: pick one (alloy / nova / shimmer)
4. SIP: enable, copy the SIP credentials (project ID + token) into `pjsip.conf` step 2
5. System prompt (KEEP SHORT, max 10 lines):

```
You are INDEXUS support agent. Greet the caller in Slovak.
Always start by calling lookup_customer with their phone number.
Speak naturally, max 1-2 sentences per turn.
If asked about contracts, call get_contracts.
For document details, call get_documents.
Never invent data. If lookup fails, ask for full name and DOB.
```

6. Tools: paste the JSON from `GET /api/realtime/tool-definitions`
7. Webhook URL: `https://YOUR_DOMAIN/api/realtime/webhook`
8. Webhook headers: `x-realtime-secret: <value of REALTIME_WEBHOOK_SECRET>`

### Option B: API (for IaC / multiple agents per country)
Use the OpenAI Realtime Agents API (POST `/v1/realtime/agents`) with the same
config. Document this in a deploy script later.

---

## 5. Testing

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
