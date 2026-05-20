# INDEXUS Connect — WebRTC Phone Integration (Architektúra)

## Prehľad

Integrácia WebRTC telefónu do mobilnej aplikácie INDEXUS Connect umožní spolupracovníkom (collaborators) vykonávať a prijímať hovory priamo cez Android aplikáciu. Hovory budú smerované cez Asterisk server rovnako ako v desktopovej verzii INDEXUS CRM.

---

## 1. Architektúra systému

```
┌──────────────────────────────────────────────────────────────────┐
│                    INDEXUS Connect (Android)                      │
│  ┌────────────────────┐  ┌─────────────────────────────────┐    │
│  │  Dialer Screen     │  │  SIP/WebRTC Engine              │    │
│  │  - Číselník        │  │  - react-native-location (FG)   │    │
│  │  - Kontakty        │  │  - expo-av (audio)              │    │
│  │  - História        │  │  - WebSocket → Asterisk WSS     │    │
│  │  - Nahrávanie      │  │  - ICE/STUN/TURN               │    │
│  └────────────────────┘  └──────────────┬──────────────────┘    │
│                                          │                       │
│  ┌────────────────────────────────────────┼─────────────────┐   │
│  │  Push Notifications (FCM)             │                   │   │
│  │  - Incoming call alert                │                   │   │
│  │  - Missed call notification           │                   │   │
│  └───────────────────────────────────────┘                   │   │
└──────────────────────────────┬───────────────────────────────────┘
                               │ WSS (WebSocket Secure)
                               │ + SRTP (encrypted media)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Asterisk PBX Server                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  WebSocket    │  │  SIP Proxy   │  │  Recording Engine  │    │
│  │  Transport    │  │  & Routing   │  │  (MixMonitor)      │    │
│  │  (port 8089)  │  │              │  │  server-side rec   │    │
│  └──────────────┘  └──────────────┘  └────────────────────┘    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  Queue Engine │  │  CDR / CEL   │  │  ARI Interface     │    │
│  │  (inbound)    │  │  (call logs) │  │  (call control)    │    │
│  └──────────────┘  └──────────────┘  └────────────────────┘    │
└──────────────────────────────┬───────────────────────────────────┘
                               │ ARI / AMI
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      INDEXUS CRM Backend                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Nové API endpointy:                                      │   │
│  │  POST /api/mobile/sip/credentials  - SIP prihlasovacie    │   │
│  │  GET  /api/mobile/sip/settings     - server + nastavenia  │   │
│  │  POST /api/mobile/call-log         - záznam hovoru        │   │
│  │  POST /api/mobile/call-recording   - nahratie nahrávky    │   │
│  │  GET  /api/mobile/contacts         - CRM kontakty         │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Collaborator Management:                                  │   │
│  │  - mobileWebrtcEnabled (nové pole)                        │   │
│  │  - mobileSipExtensionId (nové pole)                       │   │
│  │  - mobileCallRecording (nové pole)                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Zmeny v databáze (Schema)

### 2.1 Collaborators tabuľka — nové polia

```typescript
// shared/schema.ts - collaborators tabuľka
mobileWebrtcEnabled: boolean("mobile_webrtc_enabled").notNull().default(false),
mobileSipExtensionId: varchar("mobile_sip_extension_id"),  // FK na sip_extensions
mobileCallRecording: boolean("mobile_call_recording").notNull().default(true),
```

### 2.2 SIP Extensions tabuľka — rozšírenie

```typescript
// Existujúce pole assignedToUserId je pre CRM users
// Nové pole pre mobile collaborator assignment:
assignedToCollaboratorId: varchar("assigned_to_collaborator_id"),
assignmentType: text("assignment_type").default("crm"),  // "crm" | "mobile"
```

---

## 3. CRM Backend — Nové API endpointy

### 3.1 Mobile SIP Credentials

```
GET /api/mobile/sip/credentials
Authorization: Bearer <mobile-jwt>

Response:
{
  "enabled": true,
  "sipServer": "asterisk.cordbloodcenter.com",
  "wsPort": 8089,
  "wsPath": "/ws",
  "transport": "wss",
  "extension": "2015",
  "sipUsername": "2015",
  "sipPassword": "decrypted-password",
  "stunServers": ["stun:stun.l.google.com:19302"],
  "turnServers": [...],
  "callRecording": true,
  "realm": "asterisk"
}
```

### 3.2 Mobile Call Log

```
POST /api/mobile/call-log
Authorization: Bearer <mobile-jwt>

Body:
{
  "callDirection": "outbound",
  "calledNumber": "+421905123456",
  "customerId": "uuid-or-null",
  "duration": 125,
  "status": "answered",
  "startedAt": "2026-03-05T10:30:00Z",
  "endedAt": "2026-03-05T10:32:05Z"
}
```

### 3.3 Mobile Call Recording Upload

```
POST /api/mobile/call-recording
Authorization: Bearer <mobile-jwt>
Content-Type: multipart/form-data

Fields:
  - file: recording.webm
  - callLogId: "uuid"
  - duration: 125
```

### 3.4 Mobile Contacts (pre dialer)

```
GET /api/mobile/contacts?search=novak&limit=20
Authorization: Bearer <mobile-jwt>

Response:
{
  "contacts": [
    {
      "id": "customer-uuid",
      "name": "Ján Novák",
      "phone": "+421905123456",
      "email": "jan@example.com",
      "type": "customer",
      "contractNumber": "SK-2024-001"
    }
  ]
}
```

---

## 4. CRM Frontend — Collaborator INDEXUS Connect tab

### 4.1 Nová sekcia "WebRTC Telefón" v záložke INDEXUS Connect

```
┌──────────────────────────────────────────────────────────────┐
│  INDEXUS Connect                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Mobilná aplikácia                                           │
│  ┌────────────────────────────────┐                          │
│  │ [x] Povoliť mobilnú aplikáciu │                          │
│  │ Username: jan.novak            │                          │
│  │ Password: ********             │                          │
│  └────────────────────────────────┘                          │
│                                                              │
│  ──────────────────────────────────────────                  │
│                                                              │
│  WebRTC Telefón                                              │
│  ┌────────────────────────────────────────────────────┐      │
│  │ [x] Povoliť WebRTC telefón v mobilnej aplikácii    │      │
│  │                                                    │      │
│  │ SIP Extension:  [Výber voľnej linky        ▼]      │      │
│  │                  2015 - Voľná (SK)                 │      │
│  │                  2016 - Voľná (SK)                 │      │
│  │                  2023 - Voľná (CZ)                 │      │
│  │                                                    │      │
│  │ Priradená linka: 2015                              │      │
│  │ SIP Username:    2015                              │      │
│  │ SIP Password:    ●●●●●●●● [Zobraziť]              │      │
│  │                                                    │      │
│  │ [x] Nahrávať hovory                                │      │
│  │                                                    │      │
│  │ Stav:  ● Online (naposledy 5 min)                  │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Logika výberu SIP extension

1. Načítať všetky `sip_extensions` kde `assignedToUserId IS NULL` AND `assignedToCollaboratorId IS NULL`
2. Filtrovať podľa `countryCode` collaboratora
3. Pri výbere nastaviť `assignedToCollaboratorId` na collaborator ID
4. Pri zrušení uvoľniť extension (nastaviť `assignedToCollaboratorId = NULL`)

---

## 5. INDEXUS Connect Android App — Nové komponenty

### 5.1 Nová záložka "Phone" v tab navigácii

```
[Home]  [Visits]  [Phone]  [Map]  [Profile]
                    ↑ NOVÁ
```

### 5.2 Phone Screen — Dialer

```
┌──────────────────────────────────────────┐
│  INDEXUS Phone           [● Registered]  │
├──────────────────────────────────────────┤
│  [Recent]  [Contacts]  [Keypad]          │
├──────────────────────────────────────────┤
│                                          │
│  KEYPAD MODE:                            │
│         ┌─────────────────┐              │
│         │  +421905123456  │              │
│         └─────────────────┘              │
│                                          │
│         [1]    [2]    [3]                │
│         [4]    [5]    [6]                │
│         [7]    [8]    [9]                │
│         [*]    [0]    [#]                │
│                                          │
│              [📞 Call]                    │
│                                          │
│  CONTACTS MODE:                          │
│  🔍 Hľadať kontakt...                   │
│  ┌────────────────────────────────────┐  │
│  │ Ján Novák         +421905123456   │  │
│  │ SK-2024-001       [📞]            │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ Mária Horváthová  +421903654321   │  │
│  │ SK-2024-015       [📞]            │  │
│  └────────────────────────────────────┘  │
│                                          │
│  RECENT MODE:                            │
│  ┌────────────────────────────────────┐  │
│  │ ↗ +421905123456    Dnes 10:30     │  │
│  │   Ján Novák        2:05           │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ ↙ +421907888999    Včera 14:15    │  │
│  │   Neznáme číslo     0:45          │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

### 5.3 Active Call Screen

```
┌──────────────────────────────────────────┐
│                                          │
│          Ján Novák                       │
│          +421905123456                   │
│                                          │
│            02:34                         │
│          Prebieha hovor                  │
│                                          │
│     [🔇]     [⏸]      [📋]             │
│     Mute     Hold    Keypad              │
│                                          │
│     [🔊]     [●]                         │
│    Speaker  Recording                    │
│                                          │
│              [🔴]                        │
│            Ukončiť                       │
│                                          │
└──────────────────────────────────────────┘
```

### 5.4 Incoming Call Screen (s Push Notification)

```
┌──────────────────────────────────────────┐
│                                          │
│          Prichádzajúci hovor             │
│                                          │
│          Ján Novák                       │
│          +421905123456                   │
│          Zákazník: SK-2024-001           │
│                                          │
│                                          │
│     [🔴 Odmietnuť]  [🟢 Prijať]        │
│                                          │
└──────────────────────────────────────────┘
```

---

## 6. Technická implementácia — Android WebRTC

### 6.1 Potrebné Expo/RN knižnice

```json
{
  "react-native-location": "^2.5.0",
  "react-native-location-foreground-service": "^0.2.0",
  "expo-av": "~14.0.0",
  "@orama/react-native-location": "^1.0.0",
  "react-native-location-enabler": "^4.2.0"
}
```

**Pre WebRTC/SIP v React Native sú 2 hlavné možnosti:**

**Možnosť A: react-native-location + custom SIP.js port**
- Využiť SIP.js (rovnaký ako v CRM) portovaný pre React Native
- Vyžaduje `react-native-location` pre WebRTC
- Výhoda: rovnaký kód ako desktop

**Možnosť B: react-native-location + JsSIP**
- JsSIP je menšia knižnica kompatibilná s React Native
- Lepšia podpora pre mobilné zariadenia
- Výhoda: stabilnejšie na mobile

**Odporúčaná možnosť: `react-native-location` + `sip.js` (rovnaký stack ako CRM)**

### 6.2 SIP Registrácia v Android App

```typescript
// mobile-app/lib/sip.ts
import { UserAgent, Registerer, Inviter, SessionState } from 'sip.js';

class MobileSipClient {
  private ua: UserAgent | null = null;
  private registerer: Registerer | null = null;

  async connect(credentials: SipCredentials) {
    const uri = UserAgent.makeURI(`sip:${credentials.extension}@${credentials.sipServer}`);

    this.ua = new UserAgent({
      uri,
      transportOptions: {
        server: `wss://${credentials.sipServer}:${credentials.wsPort}${credentials.wsPath}`,
      },
      authorizationUsername: credentials.sipUsername,
      authorizationPassword: credentials.sipPassword,
      sessionDescriptionHandlerFactoryOptions: {
        peerConnectionConfiguration: {
          iceServers: credentials.stunServers.map(s => ({ urls: s })),
        },
      },
    });

    await this.ua.start();
    this.registerer = new Registerer(this.ua);
    await this.registerer.register();
  }

  async makeCall(number: string): Promise<Session> {
    const target = UserAgent.makeURI(`sip:${number}@${this.sipServer}`);
    const inviter = new Inviter(this.ua!, target!);
    await inviter.invite();
    return inviter;
  }

  async hangup(session: Session) {
    if (session.state === SessionState.Established) {
      session.bye();
    } else {
      session.cancel();
    }
  }
}
```

### 6.3 Nahrávanie hovorov

**Server-side (odporúčané):**
- Asterisk MixMonitor automaticky nahráva ak je `mobileCallRecording = true`
- Konfigurácia v Asterisk dialplane pre mobile extensions
- Nahrávky sa uložia na server a prepoja s call_logs

**Client-side (záložné):**
- Ak server-side nahrávanie nie je možné
- Použitie `expo-av` na zachytenie audio streamu
- Upload nahrávky cez `POST /api/mobile/call-recording`

---

## 7. Push Notifications pre prichádzajúce hovory

### 7.1 Flow

```
1. Prichádzajúci hovor na Asterisk
2. Asterisk ARI → INDEXUS Backend (webhook)
3. Backend identifikuje mobile extension → collaborator
4. Backend odošle FCM push notification
5. Android app zobrazí Incoming Call screen
6. Collaborator prijme → WebRTC spojenie cez WSS
```

### 7.2 FCM Payload

```json
{
  "to": "expo-push-token",
  "data": {
    "type": "incoming_call",
    "callerNumber": "+421905123456",
    "callerName": "Ján Novák",
    "customerId": "uuid",
    "contractNumber": "SK-2024-001",
    "callId": "asterisk-call-id"
  },
  "priority": "high",
  "android": {
    "priority": "high",
    "channelId": "incoming-calls"
  }
}
```

---

## 8. Implementačný plán

### Fáza 1: CRM Backend + Collaborator Settings (server)
1. Pridať nové polia do `collaborators` schémy
2. Rozšíriť `sip_extensions` o `assignedToCollaboratorId`
3. Vytvoriť API endpointy (`/api/mobile/sip/*`, `/api/mobile/call-log`, atď.)
4. Pridať WebRTC sekciu do Collaborator INDEXUS Connect záložky
5. Implementovať logiku prideľovania SIP extensions collaboratorom

### Fáza 2: Android App — Dialer UI
1. Pridať Phone záložku do tab navigácie
2. Vytvoriť Keypad, Contacts, Recent screens
3. Implementovať CRM contacts search endpoint
4. Lokálna história hovorov v SQLite

### Fáza 3: Android App — SIP/WebRTC Engine
1. Integrovať SIP.js alebo JsSIP do React Native
2. Implementovať SIP registráciu pri spustení app
3. Odchádzajúce hovory cez WebRTC/WSS
4. Audio handling (speaker, mute, hold)

### Fáza 4: Nahrávanie hovorov
1. Konfigurácia Asterisk MixMonitor pre mobile extensions
2. Webhook na prenos nahrávok do INDEXUS
3. Záložné client-side nahrávanie

### Fáza 5: Prichádzajúce hovory
1. FCM push notifications pre incoming calls
2. ARI webhook pre detekciu incoming calls na mobile extensions
3. Full-screen incoming call UI
4. Background call handling

---

## 9. Bezpečnosť

- SIP heslá sú šifrované v databáze (rovnaký `token-crypto.ts` ako pre CRM)
- Heslo sa dešifruje len pri odoslaní do mobilnej app cez HTTPS
- WebSocket spojenie je vždy WSS (šifrované)
- Media stream je SRTP (šifrované)
- JWT token pre mobile auth má obmedzenú platnosť
- SIP credentials sa ukladajú v `expo-secure-store` na zariadení

---

## 10. Zhrnutie zmien

| Komponent | Zmena |
|-----------|-------|
| `shared/schema.ts` | Nové polia: `mobileWebrtcEnabled`, `mobileSipExtensionId`, `mobileCallRecording` |
| `shared/schema.ts` | Rozšírenie `sip_extensions`: `assignedToCollaboratorId`, `assignmentType` |
| `server/routes.ts` | Nové endpointy: `/api/mobile/sip/*`, `/api/mobile/call-log`, `/api/mobile/contacts` |
| `collaborator-detail.tsx` | Nová sekcia "WebRTC Telefón" v INDEXUS Connect záložke |
| `mobile-app/app/(tabs)/` | Nová záložka "Phone" |
| `mobile-app/lib/sip.ts` | SIP/WebRTC engine pre mobilnú app |
| `mobile-app/components/` | Dialer, ActiveCall, IncomingCall komponenty |
| Asterisk | Konfigurácia MixMonitor pre mobile extensions |
