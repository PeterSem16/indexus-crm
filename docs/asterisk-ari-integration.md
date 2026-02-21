# INDEXUS CRM - Asterisk ARI Integration Guide

## Overview

INDEXUS CRM integrates with Asterisk PBX via ARI (Asterisk REST Interface) to manage inbound calls. In this architecture, Asterisk handles the media (audio) while the CRM controls all call logic — queue management, agent routing, IVR, and call distribution.

---

## Architecture

```
Incoming Call → Asterisk PBX → Stasis(indexus-inbound) → ARI WebSocket → INDEXUS CRM
                                                                            ↓
                                                                    Queue Engine
                                                                    (routing, agent selection)
                                                                            ↓
                                                                    Agent Notification
                                                                    (WebSocket popup)
                                                                            ↓
                                                                    Agent Answers
                                                                            ↓
                                                              ARI command → Bridge Call
```

**Key Principle:** Asterisk is the media server only. All queue logic, routing decisions, IVR messages, agent assignments, and call distribution are managed by the CRM.

---

## Prerequisites

- Asterisk 13+ (tested with Asterisk 13.21.0)
- ARI module loaded (`res_ari`)
- HTTP server enabled on Asterisk
- Network connectivity between CRM server and Asterisk

---

## Asterisk Configuration

### Step 1: Enable HTTP Server

File: `/etc/asterisk/http.conf`

```ini
[general]
enabled = yes
bindaddr = 0.0.0.0
bindport = 8088
```

Verify with:
```bash
asterisk -rx "http show status"
```

Expected output should include:
```
Server Enabled and Bound to 0.0.0.0:8088
```

### Step 2: Enable and Configure ARI

File: `/etc/asterisk/ari.conf`

```ini
[general]
enabled = yes
pretty = yes
allowed_origins = *

[indexus]
type = user
read_only = no
password = your_secure_password
password_format = plain
```

- `indexus` — username for CRM authentication (can be any name)
- `read_only = no` — CRM needs full control (answer, bridge, hangup, record)
- `password` — set a strong password

Load/reload the ARI module:
```bash
asterisk -rx "module load res_ari.so"
asterisk -rx "ari reload"
```

Verify ARI is active:
```bash
asterisk -rx "module show like res_ari"
```

Expected output:
```
res_ari.so                   Asterisk RESTful Interface
res_ari_channels.so          RESTful API module - Channel resources
res_ari_bridges.so           RESTful API module - Bridge resources
res_ari_recordings.so        RESTful API module - Recording resources
res_ari_playbacks.so         RESTful API module - Playback control
```

After loading ARI, the HTTP status should show:
```
/ari/... => Asterisk RESTful API
```

### Step 3: Configure Dialplan

File: `/etc/asterisk/extensions.conf`

```ini
[incoming]
exten => _X.,1,NoOp(Incoming call from ${CALLERID(num)} to ${EXTEN})
 same => n,Answer()
 same => n,Stasis(indexus-inbound)
 same => n,Hangup()
```

Important notes:
- `[incoming]` — this context must match your SIP trunk's context setting
- `Stasis(indexus-inbound)` — the application name must match what you configure in the CRM settings
- When a call enters `Stasis()`, Asterisk sends a `StasisStart` event to the CRM via ARI WebSocket
- The CRM then takes full control of the call

For multiple DID numbers (different queues):
```ini
[incoming]
; Route to different queues based on DID number
exten => 100,1,NoOp(Support line)
 same => n,Answer()
 same => n,Stasis(indexus-inbound,support)
 same => n,Hangup()

exten => 200,1,NoOp(Sales line)
 same => n,Answer()
 same => n,Stasis(indexus-inbound,sales)
 same => n,Hangup()

; Default catch-all
exten => _X.,1,NoOp(General incoming)
 same => n,Answer()
 same => n,Stasis(indexus-inbound)
 same => n,Hangup()
```

Reload dialplan:
```bash
asterisk -rx "dialplan reload"
```

### Step 4: Configure SIP Trunk

File: `/etc/asterisk/pjsip.conf` (or `sip.conf` for older versions)

Ensure your SIP trunk routes incoming calls to the `incoming` context:

```ini
[your-trunk]
type = endpoint
context = incoming
; ... other trunk settings
```

---

## CRM Configuration

### Step 1: ARI Connection Settings

Navigate to **Settings → SIP Phone → Asterisk ARI** tab.

Fill in the following fields:

| Field | Description | Example |
|-------|-------------|---------|
| Host / IP Address | Asterisk server IP or hostname | `192.168.1.100` |
| HTTP Port | ARI HTTP port (from http.conf) | `8088` |
| Username | ARI user name (from ari.conf) | `indexus` |
| Password | ARI user password | `your_secure_password` |
| Application Name | Must match Stasis() in dialplan | `indexus-inbound` |
| WebSocket Port | Usually same as HTTP port | `8088` |
| Use TLS/SSL | Enable for HTTPS/WSS connections | Off (for internal network) |
| Enable Connection | Activate the ARI integration | On |

1. Click **Test Connection** to verify connectivity
2. Click **Save Settings** to store the configuration

### Step 2: Create Inbound Queues

Navigate to **Campaigns → Inbound Queues** tab.

1. Click **Create Queue**
2. Set queue name (e.g., "Slovakia - Support")
3. Choose routing strategy:
   - **Round Robin** — distributes calls evenly in order
   - **Least Calls** — sends to agent with fewest calls today
   - **Longest Idle** — sends to agent waiting longest
   - **Skills Based** — matches caller needs to agent skills
   - **Random** — random agent selection
4. Set maximum wait time (seconds before timeout)
5. Set wrap-up time (seconds after call for agent notes)
6. Optionally set a welcome message

### Step 3: Assign Agents to Queues

In the queue detail view:

1. Click **Add Members**
2. Select agents (users with call center role)
3. Set priority for each agent (lower number = higher priority)
4. Agents must set their status to **Available** in the Agent Workspace to receive calls

---

## Call Flow

1. **Incoming Call** → Asterisk receives call on SIP trunk
2. **Dialplan** → Routes to `Stasis(indexus-inbound)`
3. **ARI Event** → CRM receives `StasisStart` via WebSocket
4. **Queue Engine** → CRM identifies the target queue and finds available agent
5. **Agent Notification** → WebSocket popup appears in agent's workspace with caller info
6. **Customer Lookup** → CRM matches caller number against customer database
7. **Agent Accepts** → CRM sends ARI command to bridge the call
8. **Call Recording** → Optionally starts recording via ARI
9. **Call Ends** → CRM logs call details, duration, and disposition

---

## Agent States

| State | Description |
|-------|-------------|
| **Available** | Ready to receive calls |
| **Busy** | Currently on a call |
| **Break** | On break, not receiving calls |
| **Wrap-up** | Post-call processing, temporarily unavailable |
| **Offline** | Not logged into agent workspace |

---

## Routing Strategies

| Strategy | How It Works |
|----------|-------------|
| **Round Robin** | Cycles through agents in order; fair distribution |
| **Least Calls** | Sends call to agent who handled fewest calls today |
| **Longest Idle** | Sends call to agent who has been waiting the longest |
| **Skills Based** | Matches required skills (language, product knowledge) to agent skills |
| **Random** | Random selection among available agents |

---

## Troubleshooting

### ARI Not Loading
```bash
# Check if module exists
ls /usr/lib/asterisk/modules/res_ari*

# Load manually
asterisk -rx "module load res_ari.so"

# Check for errors
asterisk -rx "core show channels"
```

### Connection Test Fails
- Verify Asterisk HTTP server is running: `asterisk -rx "http show status"`
- Check firewall allows port 8088 from CRM server
- Verify ARI user credentials in `ari.conf`
- Check CRM can reach Asterisk: `curl http://ASTERISK_IP:8088/ari/asterisk/info`

### Calls Not Reaching CRM
- Verify dialplan context matches SIP trunk: `asterisk -rx "dialplan show incoming"`
- Check Stasis application name matches CRM setting
- Monitor ARI events: `asterisk -rx "ari show apps"`
- Check CRM logs for WebSocket connection status

### Agent Not Receiving Calls
- Verify agent status is "Available" in Agent Workspace
- Check agent is assigned to the correct queue
- Verify WebSocket connection in browser console (should show connected to `/ws/inbound-calls`)

---

## Security Recommendations

1. **Network Isolation** — Keep Asterisk on an internal network, not exposed to the internet
2. **Strong Passwords** — Use complex passwords for ARI users
3. **TLS/SSL** — Enable HTTPS/WSS for production environments
4. **Firewall Rules** — Only allow CRM server IP to connect to ARI port
5. **Read-Only Users** — Create separate read-only ARI users for monitoring

---

## Supported Asterisk Versions

- Asterisk 13.x (tested)
- Asterisk 16.x (compatible)
- Asterisk 18.x (compatible)
- Asterisk 20.x (compatible)

ARI API is stable across these versions. The CRM uses standard ARI endpoints that are available in all supported versions.
