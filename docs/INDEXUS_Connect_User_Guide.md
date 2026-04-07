# INDEXUS Connect — User Guide

## 1. Introduction

INDEXUS Connect is a mobile application for field collaborators (sales representatives, medical consultants, partners) working with the INDEXUS CRM platform. It provides on-the-go access to hospitals, visit scheduling, VoIP calling, call recording, voice notes, personal contacts, and call history — all synced with the central CRM.

---

## 2. Getting Started

### 2.1 Installation

Download and install the INDEXUS Connect app on your Android device. The latest version of the app is available for download from the INDEXUS landing page:

**https://indexus.cordbloodcenter.com**

Visit the page from your Android device, scroll to the download section, and install the APK directly.

### 2.2 Login

1. Open the INDEXUS Connect app.
2. Enter your **Username** and **Password** provided by your CRM administrator.
3. Tap **Login**.

> Your credentials are specific to the mobile app. They are set up by an administrator in the CRM under **Collaborators > Mobile Access**.

### 2.2.1 Test Account

For testing purposes, a pre-configured test collaborator is available for the **Romania** region:

| Field | Value |
|---|---|
| Username | `pero` |
| Password | `pero` |

> This account is intended for development and QA testing only. Do not use it in production environments.

### 2.3 First-Time Setup

After logging in for the first time:

- The app will sync your assigned hospitals and contacts.
- If VoIP calling is enabled for your account, SIP credentials will be automatically downloaded and configured.
- Allow all requested permissions (microphone, notifications, phone) for full functionality.

---

## 3. Main Features

### 3.1 Hospital Directory

View all hospitals assigned to your country/region.

- **Browse hospitals** — scroll through the list or use the search bar.
- **View details** — tap a hospital to see its name, address, contact person, phone, email, and other information.
- **Edit hospital** — if you have editing permissions, tap the edit icon to update hospital information.
- **Add new hospital** — tap the "+" button to register a new hospital you've discovered in the field.

### 3.2 Clinic Contacts

Access the directory of clinics (outpatient facilities, doctor offices) in your territory.

- Browse and search clinics by name, doctor, city, or specialization.
- View doctor details including title, specialization, phone, and email.

### 3.3 CRM Contacts

Access the full CRM contact directory including hospitals, clinics, and collaborators from the central database.

- Search across all contact types.
- Tap a contact to view details or initiate a call.

---

## 4. Visit Management

### 4.1 Viewing Visits

The **Visits** screen shows all your scheduled and completed hospital visits.

- Each visit shows: hospital name, date, time, visit type, and status.
- Visits are synced with the CRM — your manager can see them in the central system.

### 4.2 Creating a Visit

1. Tap the **"+" button** or **"New Visit"**.
2. Select the **Hospital** from the dropdown list.
3. Choose the **Date and Time**.
4. Select the **Visit Type** (e.g., routine visit, training, delivery, sample collection).
5. Add optional **Notes**.
6. Tap **Save**.

The visit is immediately synced to the CRM.

### 4.3 Editing / Deleting a Visit

- Tap an existing visit to open it.
- Modify any fields and tap **Save**.
- To delete, use the delete option (available only for your own visits).

### 4.4 Voice Notes

You can attach voice notes to any visit for hands-free documentation.

1. Open a visit.
2. Tap the **Microphone** icon.
3. Record your note (e.g., "Met with Dr. Novak, discussed cord blood collection protocol").
4. Tap **Stop** when finished.
5. The recording is uploaded and automatically **transcribed to text** using AI.

> Voice notes are stored securely and linked to the specific visit. Both the audio recording and the text transcription are visible in the CRM.

---

## 5. VoIP Calling (WebRTC)

### 5.1 Requirements

VoIP calling must be enabled for your account by the administrator. You need:

- **Mobile App Enabled** — turned on in your collaborator profile.
- **WebRTC Enabled** — turned on in your collaborator profile.
- **SIP Extension Assigned** — a SIP extension (e.g., 4000) must be assigned to your account.
- **Stable internet connection** — Wi-Fi or 4G/5G recommended.

### 5.2 Making an Outbound Call

1. Navigate to any contact (hospital, clinic, CRM contact, or personal contact).
2. Tap the **Phone icon** next to the phone number.
3. The app will initiate a VoIP call through the INDEXUS telephony system.
4. You will hear the ringing tone. Wait for the other party to answer.

**Alternatively — Manual Dialing:**

1. Go to the **Dialer** screen.
2. Enter the phone number in international format (e.g., `+421901234567`).
3. Tap the **Call** button.

> **Important:** Always use the full international format with country code (e.g., `+421` for Slovakia, `+420` for Czech Republic, `+36` for Hungary). The system will automatically route the call through the correct trunk.

### 5.3 Receiving an Inbound Call

When someone calls your assigned SIP extension:

1. The app will show an **incoming call notification** (even if the app is in the background).
2. You will see the caller's phone number (and name if it matches a contact in the CRM).
3. Tap **Accept** to answer the call, or **Decline** to reject it.

> Make sure push notifications are enabled for the INDEXUS Connect app on your device, otherwise you may miss incoming calls.

### 5.4 During a Call

While on an active call, you can:

- **Mute/Unmute** — tap the microphone icon to mute your microphone.
- **Speaker** — tap the speaker icon to switch to speakerphone.
- **End Call** — tap the red hang-up button to end the call.

### 5.5 Call Recording

If call recording is enabled for your account (configured by the administrator):

- All calls are **automatically recorded**.
- Recordings are uploaded to the CRM after the call ends.
- Recordings can be reviewed and analyzed (AI transcription) in the CRM by your manager.

> A small recording indicator may be visible during the call. Call recording complies with your organization's data protection policies.

### 5.6 Caller ID (Outbound Number)

When you make an outbound call, the system sets your Caller ID based on:

1. **Collaborator Caller ID** — if your profile has an `outboundCallerId` set, this number will be shown to the called party.
2. **Campaign Caller ID** — if calling within a campaign context, the campaign's caller ID takes priority.
3. **Default** — if neither is set, the system uses the default trunk caller ID.

> Contact your administrator if you need to change your outbound caller ID.

---

## 6. Call History

### 6.1 Viewing Call History

The **Call History** screen shows all your past calls:

- **Phone number** and **contact name** (if matched).
- **Direction** — inbound or outbound.
- **Status** — answered, missed, busy, failed.
- **Date/Time** and **Duration**.

Use the search bar to filter by phone number, contact name, or notes.

### 6.2 Exporting Call History

You can export your call history as a CSV file:

1. Open **Call History**.
2. Tap the **Export** button.
3. Select the time period (this month, last month, last 3 months, etc.).
4. The CSV file will be downloaded to your device.

---

## 7. Personal Contacts

You can maintain a personal contact directory within the app, separate from the CRM's central contacts.

### 7.1 Adding a Personal Contact

1. Go to **Personal Contacts**.
2. Tap the **"+"** button.
3. Enter the contact's **Name**, **Phone Number**, **Email**, and optional **Notes**.
4. Tap **Save**.

### 7.2 Calling a Personal Contact

Tap the phone icon next to any personal contact to initiate a VoIP call.

### 7.3 Editing / Deleting

Tap a contact to edit or delete it. Changes are stored on the server and synced across sessions.

---

## 8. Reports

Access summary reports directly from the app:

- Visit summaries by period.
- Call statistics.

> Report types and availability depend on your administrator's configuration.

---

## 9. Troubleshooting

### Call Quality Issues

| Problem | Solution |
|---|---|
| Choppy audio / delays | Switch to a stronger Wi-Fi or use 4G/5G instead. |
| One-way audio | Check microphone permissions in your device settings. |
| Call drops | Ensure stable internet. Avoid switching between Wi-Fi and mobile data mid-call. |
| Echo | Lower the speaker volume or use headphones. |

### Cannot Make Calls

| Problem | Solution |
|---|---|
| "WebRTC not enabled" | Contact your administrator to enable WebRTC on your account. |
| "No SIP extension assigned" | Contact your administrator to assign a SIP extension to your account. |
| "No outbound route matched" | The dialed number format may be incorrect. Use full international format (e.g., `+421...`). |
| Call connects but no audio | Check if your Asterisk server has the correct NAT/media settings for your network. |

### Cannot Login

| Problem | Solution |
|---|---|
| "Invalid credentials" | Verify your username and password with your administrator. |
| "Mobile API not configured" | The server's mobile API is not set up. Contact your administrator. |
| App freezes on login | Force close the app and try again. Check internet connectivity. |

### SIP Registration Issues

If the app registers with a wrong extension (e.g., 2030 instead of 4000):

1. **Check the CRM database** — ensure the correct SIP extension is assigned to your collaborator profile (`mobile_sip_extension_id` field).
2. **Check the SIP extensions pool** — ensure the extension (e.g., 4000) exists in the `sip_extensions` table.
3. **Log out and log back in** on the Android app — the app fetches fresh SIP credentials on each login.
4. **Verify on Asterisk** — run `pjsip show contacts` to confirm which extension the device is registered as.

---

## 10. Administrator Setup Checklist

For an administrator setting up a new collaborator in INDEXUS Connect:

1. **Create the collaborator** in CRM (Collaborators module).
2. **Enable Mobile App** — toggle `Mobile App Enabled` on.
3. **Set mobile credentials** — assign a `Username` and `Password` for mobile login.
4. **Enable WebRTC** (if VoIP calling is needed) — toggle `WebRTC Enabled` on.
5. **Add SIP extension to pool** — ensure the desired extension (e.g., 4000) exists in the SIP Extensions table in CRM, with the correct password matching the Asterisk configuration.
6. **Assign SIP extension** — link the SIP extension to the collaborator using `Assign to Mobile` in the SIP Extensions management.
7. **Set Outbound Caller ID** (optional) — configure which number is shown when the collaborator makes outbound calls.
8. **Enable Call Recording** (optional) — toggle `Call Recording` on for the collaborator.

> After setup, ask the collaborator to log out and log back in on their Android app to pick up the new SIP configuration.

---

## 11. Quick Reference

| Action | How To |
|---|---|
| Make a call | Tap phone icon on any contact, or use the dialer |
| Answer a call | Tap "Accept" on the incoming call notification |
| Record a voice note | Open a visit > tap microphone > record > stop |
| Create a visit | Visits > "+" > fill details > Save |
| Search contacts | Use the search bar in Hospitals, Clinics, or Contacts |
| Export call history | Call History > Export > select period |
| View call recordings | Available in the CRM (web) under the call log |
| Change SIP extension | Contact your administrator |

---

*INDEXUS Connect v1.0 — User Guide*
*For support, contact your CRM administrator.*
