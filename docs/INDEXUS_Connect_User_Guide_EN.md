# INDEXUS Connect — User Guide

**Version 1.2 | May 2026**

---

## What is INDEXUS Connect?

INDEXUS Connect is a mobile app for field representatives working with cord blood banking companies. It keeps everything you need on the road in one place — your hospital and clinic contacts, visit scheduling, phone calls, voice notes, and GPS tracking — all automatically synced with the central INDEXUS CRM system.

Your manager sees everything you do in real time. You never have to fill in reports manually.

**Available on:** Android 10+ · iOS 14+  
**Languages:** English · Slovak · Czech · Hungarian · German · Italian · Romanian

---

## Getting the App

### Android

1. Open your browser and go to **https://indexus.cordbloodcenter.com**
2. Tap **"Download INDEXUS Connect"**
3. Install the downloaded APK file
4. If prompted, allow installation from unknown sources in your device settings

### iOS

Contact your administrator for access via TestFlight.

---

## Logging In

1. Open **INDEXUS Connect**
2. Choose your language
3. Enter your **username** and **password** — provided by your administrator
4. Tap **Log In**

> Your login credentials are specific to the mobile app. They are different from your web CRM login. Contact your administrator if you don't have them.

**Remember Me** — tick this box to stay logged in automatically on your next visit.

**No internet?** If you've logged in before, you can still access the app offline using your saved credentials.

---

## Home Screen (Dashboard)

After logging in you land on the Dashboard — your daily overview:

| Section | What you see |
|---|---|
| **Today's Visits** | All visits planned for today |
| **This Week** | Count of visits scheduled this week |
| **Pending Sync** | Items waiting to upload when you're back online |
| **Completion Rate** | Percentage of visits marked as done |
| **Recent Activity** | A running list of your latest actions |

---

## Hospitals & Clinics

### Hospital Directory

All hospitals in your assigned territory are listed here. You can:

- **Browse** — scroll the full list
- **Search** — type a name, city, or address
- **View details** — tap any hospital to see address, contact person, phone, email, and notes
- **Edit** — update hospital information directly from the field
- **Add new** — tap **"+"** to register a hospital you've discovered

### Clinic Contacts

Same as hospitals but for outpatient clinics and doctor offices. You can browse by doctor name, specialization, city, or clinic name.

### CRM Contacts

Full central directory from INDEXUS CRM — hospitals, clinics, collaborators, and partners. Search across all types and call directly from a contact card.

---

## Visit Management

Visits are the core of INDEXUS Connect. Every time you go somewhere for work, you create a visit. This keeps your manager informed and builds your activity history automatically.

### Creating a Visit

1. Tap **"+"** or **"New Visit"**
2. Select the **Hospital**
3. Choose **Date and Time**
4. Select the **Visit Type**:

| Type | When to use |
|---|---|
| Routine Visit | Regular check-in at a hospital |
| Delivery | Cord blood sample collection |
| Contract | Signing a new contract |
| Training | Staff training session |
| Meeting | Any other work meeting |
| Other | Anything that doesn't fit above |

5. Add **Notes** (optional)
6. Tap **Save**

The visit appears in your calendar and is immediately visible to your manager in CRM.

### Visit Status

| Status | Meaning |
|---|---|
| 🔵 Planned | Scheduled for the future |
| 🟠 In Progress | You've started the visit |
| 🟢 Completed | Visit finished successfully |
| 🔴 Cancelled | Visit did not take place |

### Starting and Finishing a Visit

**To start:** Open the visit and tap **"Start Visit"** — GPS tracking begins automatically.

**To finish:** Tap **"End Visit"**, add a brief summary if needed, and save. GPS stops and everything syncs.

### Voice Notes

The fastest way to document what happened during a visit — just speak, the app does the rest.

1. Open a visit
2. Tap the **microphone icon**
3. Speak naturally — describe what happened, who you met, what was discussed
4. Tap **Stop**
5. The recording uploads and is **automatically transcribed to text** by AI

Both the audio recording and the text transcript are stored in CRM and visible to your manager. You can attach multiple voice notes to a single visit.

> Transcription requires an internet connection. If you're offline, the audio is saved and transcribed automatically once you reconnect.

---

## Phone Calls (VoIP)

INDEXUS Connect includes a built-in phone system. You can make and receive calls directly through the app — no need to use your personal number.

> VoIP calling must be enabled for your account by your administrator. You'll also need a SIP extension assigned to your profile.

### Making a Call

**From a contact:**
1. Open any hospital, clinic, or contact
2. Tap the **phone icon** next to the number
3. The call connects through the INDEXUS phone system

**Manual dial:**
1. Go to the **Dialer** screen
2. Type the number in international format (e.g. `+421901234567`)
3. Tap **Call**

> Always use the full international format with the country code — `+421` for Slovakia, `+420` for Czech Republic, `+36` for Hungary, etc.

### Receiving a Call

When someone calls your extension:
- A notification appears even if the app is in the background
- You'll see the caller's number (and name if it matches a CRM contact)
- Tap **Accept** to answer or **Decline** to reject

> Make sure push notifications are enabled for INDEXUS Connect, otherwise you may miss incoming calls.

### During a Call

| Button | Action |
|---|---|
| 🎙️ Mute | Mute/unmute your microphone |
| 🔊 Speaker | Switch to speakerphone |
| 🔴 End | Hang up |

### Call Recording

If call recording is enabled on your account, all calls are recorded automatically. Recordings are uploaded to CRM after the call ends, where your manager can review them and see AI-generated transcripts.

### Your Outbound Caller ID

When you call someone, the number they see is set by your administrator — it may be a company number, not your personal one. Contact your administrator if you need to change it.

---

## Call History

The **Call History** screen shows all your past calls:

- Phone number and contact name (if matched)
- Direction: inbound or outbound
- Status: answered, missed, busy, failed
- Date, time, and duration

Use the search bar to filter by number, name, or notes.

**Export:** Tap **Export** to download your call history as a CSV file for a selected time period.

---

## GPS Tracking

GPS tracking starts automatically when you begin a visit and stops when you end it. Your location is recorded every 30 seconds and uploaded to CRM.

**Map view:** The **Map** tab shows your current location, all hospitals in your territory, and your visit history on a map.

**Permissions required:**
- Android: Allow location access → "Always" or "While using the app"
- iOS: "Allow while using the app"

> If GPS seems inaccurate, check that location permissions are set correctly in your device settings.

---

## Personal Contacts

Keep a private contact list within the app — separate from the main CRM directory.

- Tap **"+"** to add a contact (name, phone, email, notes)
- Tap any contact to call, edit, or delete
- Personal contacts sync with your account — available on any device you log into

---

## Offline Mode

INDEXUS Connect works without internet. When you lose connection:

| Feature | Works offline? |
|---|---|
| View visits and contacts | ✅ Yes |
| Create/edit visits | ✅ Yes |
| GPS tracking | ✅ Yes |
| Voice notes (recording) | ✅ Yes |
| Voice notes (transcription) | ⏳ When back online |
| Phone calls | ❌ No |
| Sync to CRM | ⏳ When back online |

Everything you do offline is saved locally and uploaded automatically when you reconnect. You'll see a sync counter showing how many items are waiting to upload.

**Manual sync:** Pull down on any screen to trigger a sync manually.

---

## Settings & Profile

Access your profile and settings from the **Profile** tab:

| Setting | Description |
|---|---|
| Language | Change the app language |
| Auto-sync | Toggle automatic background sync |
| GPS accuracy | High / Medium / Low battery impact |
| Push notifications | Enable/disable call and sync alerts |
| Dark mode | Switch between light and dark theme |

You can also see your assigned region, total visit count, and last sync time.

**Log out:** Go to Profile → **Log Out** → Confirm. Your locally saved data stays on the device for offline access.

---

## Troubleshooting

### Can't log in

| Problem | Fix |
|---|---|
| Wrong credentials | Double-check username/password with your admin |
| Access not enabled | Ask admin to enable mobile access in your collaborator profile |
| No internet | Try offline login (if you've logged in before) |

### Calls not working

| Problem | Fix |
|---|---|
| "WebRTC not enabled" | Ask admin to enable WebRTC on your account |
| "No SIP extension" | Ask admin to assign a SIP extension to your profile |
| Wrong number format | Use full international format: `+421...`, `+420...`, etc. |
| No audio during call | Check microphone permissions in device settings |

### GPS not tracking

1. Check location permissions in device settings
2. Enable GPS/Location in device settings
3. Restart the app

### Voice notes not transcribed

1. Check internet connection — transcription requires connectivity
2. Pull down to trigger manual sync
3. Wait a few minutes — transcription may be queued

### Sync not working

1. Check internet connection
2. Pull down to trigger manual sync
3. Restart the app
4. If the issue persists, contact your administrator

### App crashes

1. Close and reopen the app
2. Clear the app cache in device settings
3. Update to the latest version from the INDEXUS landing page
4. Contact support if the issue continues

---

## Quick Reference Card

| Task | How to do it |
|---|---|
| Create a visit | Tap **"+"** → fill details → Save |
| Start a visit | Open visit → **"Start Visit"** |
| Add a voice note | Open visit → tap 🎙️ → record → Stop |
| Make a call | Tap 📞 on any contact, or use the Dialer |
| Answer a call | Tap **Accept** on the notification |
| View call history | Go to **Call History** tab |
| Export calls | Call History → **Export** |
| View map | Go to **Map** tab |
| Add a hospital | Hospital list → **"+"** |
| Manual sync | Pull down on any screen |
| Change language | Profile → Settings → Language |

---

---

# Future Roadmap: INDEXUS Connect Web Portal

> This section outlines planned options for extending INDEXUS Connect capabilities to a web-based interface for field representatives. These are proposals for future development — not currently available.

## Why a Web Portal?

Field representatives currently have two separate access points: the full INDEXUS CRM (complex, built for office users) and the INDEXUS Connect mobile app. A dedicated web portal would give representatives a simplified browser-based workspace focused only on what they need — without the complexity of the full CRM.

---

## Option A — Lightweight Representative Portal (Recommended)

**Concept:** A clean, focused web interface accessible at a dedicated URL (e.g. `https://rep.indexus.cordbloodcenter.com`). Representatives log in with their existing Connect credentials and see only their own data.

**What it includes:**

| Feature | Description |
|---|---|
| **Visit Calendar** | Full-screen calendar view of all planned and past visits. Create, edit, and view visits. |
| **Hospital & Clinic Directory** | Browse and edit hospitals/clinics in their territory |
| **Call History** | View call logs, listen to recordings, read AI transcripts |
| **Voice Notes** | Read transcripts, play recordings from past visits |
| **GPS Route History** | Map view of routes taken during visits |
| **Basic Reports** | Personal stats: visits this month, call count, completion rate |

**Access control:** Representatives only see their own data. No access to other reps, campaigns, billing, or CRM administration.

**Effort estimate:** ~4–6 weeks development (new frontend module + restricted API layer)

---

## Option B — Enhanced Portal with Meeting Management

**Everything in Option A, plus:**

| Feature | Description |
|---|---|
| **Meeting Scheduler** | Book meetings with doctors/contacts with date, time, location, agenda |
| **Meeting Templates** | Pre-defined meeting types (product demo, follow-up, annual review) |
| **Attendee Management** | Add contacts from hospital/clinic directory as attendees |
| **Meeting Notes & Outcomes** | Structured outcome form after each meeting (met/missed, next steps, follow-up date) |
| **Upcoming Meetings Widget** | Dashboard widget showing next 5 meetings |
| **Calendar Sync** | Export to Google Calendar / Outlook (iCal format) |
| **Reminder Notifications** | Email/push reminders before meetings |

**Effort estimate:** ~8–10 weeks development

---

## Option C — Full Field Representative Workspace

**Everything in Option B, plus:**

| Feature | Description |
|---|---|
| **Target Management** | View monthly/quarterly targets set by manager, track progress |
| **Commission Tracker** | See earned commissions linked to completed visits and outcomes |
| **Document Sharing** | Access company documents, contracts, price lists uploaded by managers |
| **Territory Map** | Interactive map of entire territory with hospital coverage indicators |
| **Expense Reports** | Log travel expenses linked to visits (mileage, fuel, accommodation) |
| **Chat with Manager** | Direct messaging with assigned manager |
| **Training Materials** | Access product knowledge base and SOP documents |

**Effort estimate:** ~16–20 weeks development

---

## Technical Approach for Any Option

The web portal would be built as a new restricted area within the existing INDEXUS system:

- **Authentication:** Representatives log in with their existing INDEXUS Connect credentials (mobile username/password)
- **Data:** All data comes from the same database — no duplication
- **API:** New set of restricted API endpoints (`/api/rep-portal/*`) with scope-limited tokens
- **UI:** Same design language as INDEXUS CRM (React + shadcn/ui + Tailwind)
- **Hosting:** Same server as INDEXUS CRM — no additional infrastructure needed
- **Mobile-responsive:** Designed to work on both desktop browsers and mobile browsers

---

## Recommendation

Start with **Option A** to validate the concept and gather representative feedback. Option B's meeting management features would likely deliver the most value based on current workflows. Option C can be phased in incrementally after Options A and B are stable.

---

*INDEXUS Connect User Guide v1.2*
*Last updated: May 2026*
*For support, contact your CRM administrator or: support@cordbloodcenter.com*
