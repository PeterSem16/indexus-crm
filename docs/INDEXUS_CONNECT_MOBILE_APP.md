# INDEXUS Connect - Mobile Application Design

## Overview

INDEXUS Connect is a mobile application for field representatives (collaborators) of cord blood banking companies. The app enables efficient management of hospital visits, GPS tracking, offline work capability, and voice note transcription.

**Target Platforms:** iOS 14+, Android 10+
**Technology Stack:** React Native with Expo

---

## 1. Architecture

### 1.1 Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    INDEXUS Connect App                       │
├─────────────────────────────────────────────────────────────┤
│  React Native + Expo SDK 50+                                │
│  ├── Navigation: React Navigation 6                         │
│  ├── State: Zustand + React Query                           │
│  ├── Storage: expo-sqlite + AsyncStorage                    │
│  ├── Maps: react-native-maps                                │
│  ├── Audio: expo-av                                         │
│  ├── Location: expo-location                                │
│  └── Notifications: expo-notifications                      │
├─────────────────────────────────────────────────────────────┤
│  Offline-First Layer                                         │
│  ├── SQLite for structured data                             │
│  ├── Queue for pending sync operations                      │
│  └── Conflict resolution (server-wins strategy)             │
├─────────────────────────────────────────────────────────────┤
│  API Communication                                           │
│  ├── JWT Authentication (Bearer token)                      │
│  ├── REST API: /api/mobile/*                                │
│  └── Automatic retry with exponential backoff               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Project Structure

```
indexus-connect/
├── app/                          # Expo Router screens
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── _layout.tsx
│   ├── (tabs)/
│   │   ├── index.tsx            # Dashboard
│   │   ├── visits.tsx           # Visit calendar
│   │   ├── hospitals.tsx        # Hospital list
│   │   ├── map.tsx              # GPS map view
│   │   └── profile.tsx          # User profile
│   ├── visit/
│   │   ├── [id].tsx             # Visit detail
│   │   └── new.tsx              # Create visit
│   └── _layout.tsx
├── components/
│   ├── ui/                      # Reusable UI components
│   ├── visits/                  # Visit-related components
│   ├── hospitals/               # Hospital components
│   └── common/                  # Shared components
├── lib/
│   ├── api.ts                   # API client
│   ├── auth.ts                  # Authentication
│   ├── db.ts                    # SQLite database
│   ├── sync.ts                  # Sync engine
│   ├── location.ts              # GPS tracking
│   └── audio.ts                 # Voice recording
├── stores/
│   ├── authStore.ts
│   ├── syncStore.ts
│   └── settingsStore.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useVisits.ts
│   ├── useHospitals.ts
│   ├── useLocation.ts
│   └── useVoiceNote.ts
├── i18n/                        # Translations (SK, CZ, HU, DE, IT, RO, EN)
├── assets/
└── app.json
```

---

## 2. Screens & Navigation

### 2.1 Authentication Flow

```
┌──────────────────────────────────────────┐
│              LOGIN SCREEN                 │
├──────────────────────────────────────────┤
│                                          │
│         [INDEXUS Connect Logo]           │
│                                          │
│   ┌────────────────────────────────┐    │
│   │  Username                       │    │
│   └────────────────────────────────┘    │
│                                          │
│   ┌────────────────────────────────┐    │
│   │  Password           [Show/Hide]│    │
│   └────────────────────────────────┘    │
│                                          │
│   [Remember me] checkbox                 │
│                                          │
│   ┌────────────────────────────────┐    │
│   │         SIGN IN                 │    │
│   └────────────────────────────────┘    │
│                                          │
│   Language selector: SK|CZ|HU|DE|IT|RO|EN│
│                                          │
│   ────────────────────────────────────   │
│   Offline mode available                 │
│   (if previously logged in)              │
└──────────────────────────────────────────┘
```

### 2.2 Main Tab Navigation

```
┌──────────────────────────────────────────┐
│  [Sync indicator]     [Notifications]    │
├──────────────────────────────────────────┤
│                                          │
│              SCREEN CONTENT              │
│                                          │
├──────────────────────────────────────────┤
│   [Home]  [Visits]  [+]  [Map]  [Profile]│
└──────────────────────────────────────────┘
```

### 2.3 Dashboard (Home)

```
┌──────────────────────────────────────────┐
│  Good morning, Jan!                      │
│  [Sync: 2 pending]              [Bell]   │
├──────────────────────────────────────────┤
│                                          │
│  TODAY'S VISITS                          │
│  ┌────────────────────────────────────┐ │
│  │ 09:00  FN Bratislava              │ │
│  │        Dr. Novak - Delivery        │ │
│  │        [Navigate] [Start Visit]    │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ 14:00  Nemocnica sv. Michala      │ │
│  │        New contract signing        │ │
│  └────────────────────────────────────┘ │
│                                          │
│  QUICK STATS                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │    12    │ │     3    │ │    89%   │ │
│  │  Visits  │ │ Pending  │ │ Complete │ │
│  │ This Week│ │  Sync    │ │   Rate   │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│                                          │
│  RECENT ACTIVITY                         │
│  • Visit completed at FN Košice         │
│  • New hospital added: NsP Nitra        │
│  • Voice note transcribed               │
│                                          │
└──────────────────────────────────────────┘
```

### 2.4 Visits Calendar

```
┌──────────────────────────────────────────┐
│  < January 2026 >                        │
│  [Calendar] [List] [Map]                 │
├──────────────────────────────────────────┤
│  Mo Tu We Th Fr Sa Su                    │
│  .. .. .. 01 02 03 04                    │
│  05 06 07 08 09 10 11                    │
│  12 13 14[15]16 17 18   <- Today         │
│  19 20 21 22 23 24 25      highlighted   │
│  26 27 28 29 30 31 ..                    │
│                                          │
│  Dots indicate visits on that day        │
├──────────────────────────────────────────┤
│  JANUARY 15, 2026                        │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ [Icon] 09:00 - FN Bratislava       │ │
│  │        Delivery - COMPLETED        │ │
│  │        [Voice note attached]       │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ [Icon] 14:00 - NsP Trnava          │ │
│  │        Contract - SCHEDULED        │ │
│  │        [Tap to start]              │ │
│  └────────────────────────────────────┘ │
│                                          │
│             [+ New Visit]                │
└──────────────────────────────────────────┘
```

### 2.5 Visit Detail / Active Visit

```
┌──────────────────────────────────────────┐
│  < Back                    [More ...]    │
├──────────────────────────────────────────┤
│  FN BRATISLAVA                           │
│  Antolská 11, 851 07 Bratislava          │
│                                          │
│  Visit Type: Delivery                    │
│  Status: [IN PROGRESS]                   │
│  Started: 09:15                          │
│  Duration: 00:45:32                      │
├──────────────────────────────────────────┤
│  LOCATION                                │
│  ┌────────────────────────────────────┐ │
│  │      [Mini Map with pin]           │ │
│  │      GPS: 48.1234, 17.5678         │ │
│  │      Accuracy: 5m                  │ │
│  └────────────────────────────────────┘ │
├──────────────────────────────────────────┤
│  NOTES                                   │
│  ┌────────────────────────────────────┐ │
│  │ Meeting with Dr. Novak about new   │ │
│  │ contract terms. Discussed pricing  │ │
│  │ and delivery schedule...           │ │
│  └────────────────────────────────────┘ │
│  [Edit Notes]                            │
├──────────────────────────────────────────┤
│  VOICE NOTES                             │
│  ┌────────────────────────────────────┐ │
│  │ [Play] Recording 1 - 02:34         │ │
│  │        "Discussed new pricing..."  │ │
│  └────────────────────────────────────┘ │
│  [+ Record Voice Note]                   │
├──────────────────────────────────────────┤
│  OUTCOME                                 │
│  [Select outcome...]                     │
│  • Successful                            │
│  • Follow-up needed                      │
│  • Unsuccessful                          │
│  • Rescheduled                           │
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐ │
│  │         COMPLETE VISIT              │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### 2.6 New Visit Form

```
┌──────────────────────────────────────────┐
│  < Cancel            NEW VISIT    Save > │
├──────────────────────────────────────────┤
│                                          │
│  HOSPITAL *                              │
│  ┌────────────────────────────────────┐ │
│  │ [Search or select hospital]      v │ │
│  └────────────────────────────────────┘ │
│  [+ Add New Hospital]                    │
│                                          │
│  VISIT TYPE *                            │
│  ┌────────────────────────────────────┐ │
│  │ [Select type]                    v │ │
│  └────────────────────────────────────┘ │
│  Options: Delivery, Contract, Training,  │
│           Consultation, Other            │
│                                          │
│  DATE & TIME *                           │
│  ┌──────────────┐ ┌──────────────────┐  │
│  │ 2026-01-16   │ │ 10:00            │  │
│  └──────────────┘ └──────────────────┘  │
│                                          │
│  CONTACT PERSON                          │
│  ┌────────────────────────────────────┐ │
│  │ Dr. Novák                          │ │
│  └────────────────────────────────────┘ │
│                                          │
│  NOTES                                   │
│  ┌────────────────────────────────────┐ │
│  │                                    │ │
│  │                                    │ │
│  │ Add visit notes here...            │ │
│  │                                    │ │
│  └────────────────────────────────────┘ │
│                                          │
│  [x] Track GPS when visit starts         │
│  [x] Send reminder notification          │
│                                          │
└──────────────────────────────────────────┘
```

### 2.7 Map View

```
┌──────────────────────────────────────────┐
│  [Search]                    [Filter]    │
├──────────────────────────────────────────┤
│                                          │
│     ┌─────────────────────────────┐     │
│     │                             │     │
│     │    [H] Hospital Pin         │     │
│     │         •                   │     │
│     │              [H]            │     │
│     │    [H]           •          │     │
│     │         [You]              │     │
│     │              [H]            │     │
│     │                    [H]      │     │
│     │                             │     │
│     └─────────────────────────────┘     │
│                                          │
│  [My Location]  [All Hospitals]  [Today] │
├──────────────────────────────────────────┤
│  NEARBY (within 5km)                     │
│  ┌────────────────────────────────────┐ │
│  │ FN Bratislava - 1.2 km            │ │
│  │ Next visit: Today 14:00            │ │
│  │ [Navigate]  [Details]              │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ NsP Ružinov - 3.5 km              │ │
│  │ Last visit: 3 days ago             │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### 2.8 Hospital List & Detail

```
┌──────────────────────────────────────────┐
│  HOSPITALS                    [+ Add]    │
│  ┌────────────────────────────────────┐ │
│  │ [Search hospitals...]              │ │
│  └────────────────────────────────────┘ │
├──────────────────────────────────────────┤
│  BRATISLAVA                              │
│  ┌────────────────────────────────────┐ │
│  │ FN Bratislava                      │ │
│  │ Antolská 11, 851 07                │ │
│  │ Last visit: 2 days ago             │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ Nemocnica sv. Michala              │ │
│  │ Satinského 1, 811 08               │ │
│  │ Last visit: 1 week ago             │ │
│  └────────────────────────────────────┘ │
│                                          │
│  TRNAVA                                  │
│  ┌────────────────────────────────────┐ │
│  │ FN Trnava                          │ │
│  │ A. Žarnova 11, 917 75              │ │
│  │ No visits yet                      │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### 2.9 Profile & Settings

```
┌──────────────────────────────────────────┐
│  PROFILE                                 │
├──────────────────────────────────────────┤
│                                          │
│         [Avatar Image]                   │
│         Ján Novák                        │
│         jan.novak@cordblood.sk           │
│         Slovakia                         │
│                                          │
├──────────────────────────────────────────┤
│  STATISTICS                              │
│  Total visits: 156                       │
│  This month: 12                          │
│  Avg. visits/week: 4.2                   │
├──────────────────────────────────────────┤
│  SETTINGS                                │
│                                          │
│  Language                      [Slovak]  │
│  Notifications                    [ON]   │
│  GPS Background Tracking          [ON]   │
│  Auto-sync when online           [ON]   │
│  Voice note quality           [High]    │
│                                          │
├──────────────────────────────────────────┤
│  SYNC STATUS                             │
│  Last sync: 5 minutes ago                │
│  Pending uploads: 2                      │
│  [Force Sync Now]                        │
├──────────────────────────────────────────┤
│  DATA                                    │
│  [Clear Local Cache]                     │
│  [Download All Data]                     │
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐ │
│  │            SIGN OUT                 │ │
│  └────────────────────────────────────┘ │
│                                          │
│  App Version: 1.0.0                      │
└──────────────────────────────────────────┘
```

---

## 3. Offline-First Architecture

### 3.1 Data Storage Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                     LOCAL STORAGE                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SQLite Database (expo-sqlite)                              │
│  ├── hospitals          - Hospital records                  │
│  ├── visit_events       - Visit event records               │
│  ├── voice_notes        - Voice recording metadata          │
│  ├── sync_queue         - Pending sync operations           │
│  └── settings           - App configuration                 │
│                                                             │
│  AsyncStorage (Encrypted)                                   │
│  ├── auth_token         - JWT token                         │
│  ├── user_profile       - Cached user data                  │
│  └── last_sync          - Sync timestamps                   │
│                                                             │
│  File System                                                │
│  └── voice_recordings/  - Audio files (.m4a)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 SQLite Schema

```sql
-- Local SQLite schema for offline storage

CREATE TABLE hospitals (
  id TEXT PRIMARY KEY,
  server_id TEXT,              -- NULL if not synced yet
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  country_code TEXT,
  latitude REAL,
  longitude REAL,
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  notes TEXT,
  is_synced INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT              -- Soft delete for sync
);

CREATE TABLE visit_events (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  hospital_id TEXT NOT NULL,
  collaborator_id TEXT NOT NULL,
  visit_type TEXT NOT NULL,
  status TEXT DEFAULT 'scheduled',
  scheduled_date TEXT,
  scheduled_time TEXT,
  started_at TEXT,
  completed_at TEXT,
  gps_latitude REAL,
  gps_longitude REAL,
  gps_accuracy REAL,
  contact_person TEXT,
  notes TEXT,
  outcome TEXT,
  is_synced INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
);

CREATE TABLE voice_notes (
  id TEXT PRIMARY KEY,
  visit_event_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  duration_seconds INTEGER,
  transcription TEXT,
  is_transcribed INTEGER DEFAULT 0,
  is_synced INTEGER DEFAULT 0,
  created_at TEXT,
  FOREIGN KEY (visit_event_id) REFERENCES visit_events(id)
);

CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,   -- 'hospital', 'visit_event', 'voice_note'
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,     -- 'create', 'update', 'delete'
  payload TEXT,                -- JSON data
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TEXT,
  UNIQUE(entity_type, entity_id, operation)
);

CREATE INDEX idx_hospitals_synced ON hospitals(is_synced);
CREATE INDEX idx_visits_synced ON visit_events(is_synced);
CREATE INDEX idx_visits_date ON visit_events(scheduled_date);
CREATE INDEX idx_sync_queue_type ON sync_queue(entity_type);
```

### 3.3 Sync Engine

```typescript
// lib/sync.ts - Synchronization Engine

interface SyncOperation {
  entityType: 'hospital' | 'visit_event' | 'voice_note';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: any;
  retryCount: number;
}

class SyncEngine {
  private isRunning = false;
  private syncInterval: NodeJS.Timer | null = null;

  // Start background sync (every 30 seconds when online)
  startBackgroundSync() {
    this.syncInterval = setInterval(() => {
      if (NetInfo.isConnected) {
        this.syncAll();
      }
    }, 30000);
  }

  // Full sync process
  async syncAll(): Promise<SyncResult> {
    if (this.isRunning) return { skipped: true };
    this.isRunning = true;

    try {
      // 1. Push local changes to server
      await this.pushPendingChanges();
      
      // 2. Pull latest data from server
      await this.pullServerData();
      
      // 3. Resolve any conflicts (server wins)
      await this.resolveConflicts();
      
      return { success: true };
    } catch (error) {
      return { success: false, error };
    } finally {
      this.isRunning = false;
    }
  }

  // Push pending changes from sync_queue
  async pushPendingChanges(): Promise<void> {
    const queue = await db.getAllAsync<SyncOperation>(
      'SELECT * FROM sync_queue ORDER BY created_at ASC'
    );

    for (const item of queue) {
      try {
        await this.pushSingleChange(item);
        await db.runAsync(
          'DELETE FROM sync_queue WHERE id = ?',
          [item.id]
        );
      } catch (error) {
        // Increment retry count
        await db.runAsync(
          'UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?',
          [error.message, item.id]
        );
        
        // Skip after 5 retries
        if (item.retryCount >= 5) {
          console.error('Max retries reached for sync item:', item);
        }
      }
    }
  }

  // Pull data from server (incremental sync)
  async pullServerData(): Promise<void> {
    const lastSync = await AsyncStorage.getItem('last_sync');
    const since = lastSync ? new Date(lastSync).toISOString() : null;

    // Fetch hospitals
    const hospitals = await api.get('/mobile/hospitals', { since });
    await this.upsertHospitals(hospitals);

    // Fetch visit events
    const visits = await api.get('/mobile/visit-events', { since });
    await this.upsertVisitEvents(visits);

    // Update last sync timestamp
    await AsyncStorage.setItem('last_sync', new Date().toISOString());
  }
}
```

---

## 4. GPS Tracking Implementation

### 4.1 Location Service

```typescript
// lib/location.ts - GPS Tracking Service

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const LOCATION_TASK_NAME = 'indexus-location-tracking';

// Define background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }
  
  const { locations } = data as { locations: Location.LocationObject[] };
  const location = locations[0];
  
  // Store location for active visit
  await storeVisitLocation(location);
});

class LocationService {
  private watchSubscription: Location.LocationSubscription | null = null;

  // Request permissions
  async requestPermissions(): Promise<boolean> {
    const { status: foreground } = await Location.requestForegroundPermissionsAsync();
    if (foreground !== 'granted') return false;

    const { status: background } = await Location.requestBackgroundPermissionsAsync();
    return background === 'granted';
  }

  // Get current location (one-time)
  async getCurrentLocation(): Promise<LocationData> {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: new Date(location.timestamp).toISOString(),
    };
  }

  // Start tracking for active visit
  async startVisitTracking(visitId: string): Promise<void> {
    // Store active visit ID
    await AsyncStorage.setItem('active_visit_id', visitId);

    // Start foreground location watching
    this.watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 60000,        // Every minute
        distanceInterval: 50,       // Or every 50 meters
      },
      async (location) => {
        await this.updateVisitLocation(visitId, location);
      }
    );

    // Also start background tracking
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 300000,         // Every 5 minutes in background
      distanceInterval: 100,        // Or every 100 meters
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'INDEXUS Connect',
        notificationBody: 'Tracking visit location',
        notificationColor: '#6B1D35',
      },
    });
  }

  // Stop tracking
  async stopVisitTracking(): Promise<void> {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
    
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    await AsyncStorage.removeItem('active_visit_id');
  }

  // Calculate distance between two points (Haversine formula)
  calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const locationService = new LocationService();
```

### 4.2 Visit Geofencing

```typescript
// Verify collaborator is at hospital location
async function verifyAtHospital(
  visitLocation: LocationData,
  hospitalLocation: { latitude: number; longitude: number }
): Promise<{ verified: boolean; distance: number }> {
  const distance = locationService.calculateDistance(
    visitLocation.latitude,
    visitLocation.longitude,
    hospitalLocation.latitude,
    hospitalLocation.longitude
  );

  // Within 200 meters is considered "at location"
  const GEOFENCE_RADIUS_KM = 0.2;
  
  return {
    verified: distance <= GEOFENCE_RADIUS_KM,
    distance: Math.round(distance * 1000), // Return in meters
  };
}
```

---

## 5. Voice Note & Transcription

### 5.1 Audio Recording

```typescript
// lib/audio.ts - Voice Recording Service

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

class VoiceRecordingService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;

  // Initialize audio session
  async initialize(): Promise<void> {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
  }

  // Start recording
  async startRecording(): Promise<void> {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) throw new Error('Microphone permission required');

      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await this.recording.startAsync();
      this.isRecording = true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  // Stop recording and save
  async stopRecording(visitId: string): Promise<VoiceNoteRecord> {
    if (!this.recording) throw new Error('No active recording');

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.isRecording = false;

      // Get recording duration
      const status = await this.recording.getStatusAsync();
      const durationSeconds = Math.floor(status.durationMillis / 1000);

      // Move to permanent storage
      const filename = `voice_${visitId}_${Date.now()}.m4a`;
      const permanentUri = `${FileSystem.documentDirectory}voice_recordings/${filename}`;
      
      await FileSystem.makeDirectoryAsync(
        `${FileSystem.documentDirectory}voice_recordings/`,
        { intermediates: true }
      );
      await FileSystem.moveAsync({ from: uri!, to: permanentUri });

      // Create database record
      const voiceNote: VoiceNoteRecord = {
        id: generateUUID(),
        visitEventId: visitId,
        filePath: permanentUri,
        durationSeconds,
        transcription: null,
        isTranscribed: false,
        isSynced: false,
        createdAt: new Date().toISOString(),
      };

      await db.runAsync(
        `INSERT INTO voice_notes (id, visit_event_id, file_path, duration_seconds, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [voiceNote.id, visitId, permanentUri, durationSeconds, voiceNote.createdAt]
      );

      // Queue for sync (upload + transcription)
      await this.queueForTranscription(voiceNote);

      this.recording = null;
      return voiceNote;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  // Queue voice note for server transcription
  private async queueForTranscription(voiceNote: VoiceNoteRecord): Promise<void> {
    await db.runAsync(
      `INSERT INTO sync_queue (entity_type, entity_id, operation, payload, created_at)
       VALUES ('voice_note', ?, 'create', ?, ?)`,
      [voiceNote.id, JSON.stringify(voiceNote), new Date().toISOString()]
    );
  }

  // Play voice note
  async playVoiceNote(filePath: string): Promise<Audio.Sound> {
    const { sound } = await Audio.Sound.createAsync({ uri: filePath });
    await sound.playAsync();
    return sound;
  }
}

export const voiceRecordingService = new VoiceRecordingService();
```

### 5.2 Server-Side Transcription (OpenAI Whisper)

```typescript
// server/lib/transcription.ts - Add to INDEXUS backend

import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI();

export async function transcribeVoiceNote(
  audioFilePath: string,
  language?: string
): Promise<string> {
  const audioFile = fs.createReadStream(audioFilePath);
  
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: language || 'sk', // Default to Slovak
    response_format: 'text',
  });

  return transcription;
}

// API endpoint for voice note upload + transcription
// POST /api/mobile/voice-notes
app.post("/api/mobile/voice-notes", upload.single('audio'), async (req, res) => {
  const tokenData = await getMobileCollaboratorFromToken(req);
  if (!tokenData) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { visitEventId, durationSeconds } = req.body;
  const audioFile = req.file;

  // Save audio file
  const savedPath = await saveVoiceNoteFile(audioFile, visitEventId);

  // Transcribe using OpenAI Whisper
  const transcription = await transcribeVoiceNote(savedPath, 'sk');

  // Store in database
  const voiceNote = await storage.createVoiceNote({
    visitEventId,
    filePath: savedPath,
    durationSeconds,
    transcription,
    isTranscribed: true,
  });

  res.json({ success: true, voiceNote });
});
```

---

## 6. API Client

### 6.1 Authenticated API Client

```typescript
// lib/api.ts - API Client with JWT Authentication

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = __DEV__ 
  ? 'https://your-replit-dev.replit.app'
  : 'https://indexus.cordbloodcenter.com';

class ApiClient {
  private token: string | null = null;

  // Load token from storage
  async loadToken(): Promise<void> {
    this.token = await AsyncStorage.getItem('auth_token');
  }

  // Set token after login
  async setToken(token: string): Promise<void> {
    this.token = token;
    await AsyncStorage.setItem('auth_token', token);
  }

  // Clear token on logout
  async clearToken(): Promise<void> {
    this.token = null;
    await AsyncStorage.removeItem('auth_token');
  }

  // Make authenticated request
  async request<T>(
    method: string,
    endpoint: string,
    body?: any,
    isFormData = false
  ): Promise<T> {
    const url = `${API_BASE_URL}/api${endpoint}`;
    
    const headers: Record<string, string> = {};
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = isFormData ? body : JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (response.status === 401) {
      // Token expired, trigger re-login
      await this.clearToken();
      throw new AuthError('Session expired');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(error.error || 'Request failed', response.status);
    }

    return response.json();
  }

  // Convenience methods
  get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<T>('GET', endpoint + query);
  }

  post<T>(endpoint: string, body: any): Promise<T> {
    return this.request<T>('POST', endpoint, body);
  }

  put<T>(endpoint: string, body: any): Promise<T> {
    return this.request<T>('PUT', endpoint, body);
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>('DELETE', endpoint);
  }

  // Upload file (voice note, etc.)
  async uploadFile(endpoint: string, file: any, additionalData?: Record<string, any>): Promise<any> {
    const formData = new FormData();
    formData.append('audio', {
      uri: file.uri,
      type: 'audio/m4a',
      name: file.name || 'recording.m4a',
    } as any);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }

    return this.request('POST', endpoint, formData, true);
  }
}

export const api = new ApiClient();
```

---

## 7. Authentication Flow

### 7.1 Login Implementation

```typescript
// hooks/useAuth.ts

import { create } from 'zustand';
import { api } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/lib/db';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  collaborator: Collaborator | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  collaborator: null,

  login: async (username: string, password: string) => {
    try {
      const response = await api.post<LoginResponse>('/mobile/auth/login', {
        username,
        password,
      });

      await api.setToken(response.token);
      
      // Cache collaborator data for offline access
      await AsyncStorage.setItem(
        'cached_collaborator',
        JSON.stringify(response.collaborator)
      );

      set({
        isAuthenticated: true,
        collaborator: response.collaborator,
      });

      // Initial data sync
      await syncEngine.syncAll();
    } catch (error) {
      throw error;
    }
  },

  logout: async () => {
    await api.clearToken();
    await AsyncStorage.multiRemove([
      'auth_token',
      'cached_collaborator',
      'last_sync',
    ]);
    
    // Clear local database
    await db.runAsync('DELETE FROM visit_events');
    await db.runAsync('DELETE FROM hospitals');
    await db.runAsync('DELETE FROM voice_notes');
    await db.runAsync('DELETE FROM sync_queue');

    set({
      isAuthenticated: false,
      collaborator: null,
    });
  },

  checkAuth: async () => {
    try {
      await api.loadToken();
      
      // Try to verify token with server
      const response = await api.get<{ collaborator: Collaborator }>(
        '/mobile/auth/verify'
      );
      
      set({
        isAuthenticated: true,
        collaborator: response.collaborator,
        isLoading: false,
      });
    } catch (error) {
      // If offline, check for cached credentials
      const cached = await AsyncStorage.getItem('cached_collaborator');
      if (cached) {
        set({
          isAuthenticated: true,
          collaborator: JSON.parse(cached),
          isLoading: false,
        });
      } else {
        set({
          isAuthenticated: false,
          collaborator: null,
          isLoading: false,
        });
      }
    }
  },
}));
```

---

## 8. Internationalization (i18n)

### 8.1 Language Support

```typescript
// i18n/index.ts

import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';

import sk from './translations/sk';
import cs from './translations/cs';
import hu from './translations/hu';
import de from './translations/de';
import it from './translations/it';
import ro from './translations/ro';
import en from './translations/en';

const i18n = new I18n({
  sk,
  cs,
  hu,
  de,
  it,
  ro,
  en,
});

// Set default locale based on device
i18n.defaultLocale = 'en';
i18n.locale = Localization.locale.split('-')[0];
i18n.enableFallback = true;

export default i18n;
```

### 8.2 Slovak Translation Example

```typescript
// i18n/translations/sk.ts

export default {
  common: {
    save: 'Uložiť',
    cancel: 'Zrušiť',
    delete: 'Vymazať',
    edit: 'Upraviť',
    search: 'Hľadať',
    loading: 'Načítava sa...',
    error: 'Chyba',
    success: 'Úspech',
    retry: 'Skúsiť znova',
    offline: 'Offline režim',
    sync: 'Synchronizovať',
    syncing: 'Synchronizuje sa...',
  },
  auth: {
    login: 'Prihlásiť sa',
    logout: 'Odhlásiť sa',
    username: 'Používateľské meno',
    password: 'Heslo',
    rememberMe: 'Zapamätať si ma',
    invalidCredentials: 'Neplatné prihlasovacie údaje',
  },
  dashboard: {
    greeting: 'Dobré ráno',
    todaysVisits: 'Dnešné návštevy',
    quickStats: 'Rýchla štatistika',
    visitsThisWeek: 'Návštevy tento týždeň',
    pendingSync: 'Čaká na synchronizáciu',
    completionRate: 'Miera dokončenia',
    recentActivity: 'Posledná aktivita',
  },
  visits: {
    title: 'Návštevy',
    newVisit: 'Nová návšteva',
    scheduled: 'Naplánované',
    inProgress: 'Prebieha',
    completed: 'Dokončené',
    cancelled: 'Zrušené',
    startVisit: 'Začať návštevu',
    completeVisit: 'Dokončiť návštevu',
    visitType: 'Typ návštevy',
    types: {
      delivery: 'Dodávka',
      contract: 'Zmluva',
      training: 'Školenie',
      consultation: 'Konzultácia',
      other: 'Iné',
    },
    outcome: 'Výsledok',
    outcomes: {
      successful: 'Úspešná',
      followUp: 'Vyžaduje následné stretnutie',
      unsuccessful: 'Neúspešná',
      rescheduled: 'Preložená',
    },
  },
  hospitals: {
    title: 'Nemocnice',
    addHospital: 'Pridať nemocnicu',
    name: 'Názov',
    address: 'Adresa',
    city: 'Mesto',
    contactPerson: 'Kontaktná osoba',
    lastVisit: 'Posledná návšteva',
    noVisitsYet: 'Zatiaľ žiadne návštevy',
  },
  map: {
    myLocation: 'Moja poloha',
    allHospitals: 'Všetky nemocnice',
    todaysVisits: 'Dnešné návštevy',
    nearby: 'V blízkosti',
    navigate: 'Navigovať',
  },
  voiceNote: {
    record: 'Nahrať hlasovú poznámku',
    recording: 'Nahráva sa...',
    stopRecording: 'Zastaviť nahrávanie',
    transcribing: 'Prepisuje sa...',
    transcribed: 'Prepísané',
    play: 'Prehrať',
    pause: 'Pozastaviť',
  },
  profile: {
    title: 'Profil',
    settings: 'Nastavenia',
    language: 'Jazyk',
    notifications: 'Notifikácie',
    gpsTracking: 'GPS sledovanie',
    autoSync: 'Automatická synchronizácia',
    syncStatus: 'Stav synchronizácie',
    lastSync: 'Posledná synchronizácia',
    pendingUploads: 'Čakajúce nahrania',
    forceSyncNow: 'Synchronizovať teraz',
    clearCache: 'Vymazať cache',
    signOut: 'Odhlásiť sa',
  },
  errors: {
    networkError: 'Chyba siete. Skontrolujte pripojenie.',
    syncFailed: 'Synchronizácia zlyhala',
    locationPermission: 'Vyžaduje sa povolenie polohy',
    microphonePermission: 'Vyžaduje sa povolenie mikrofónu',
  },
};
```

---

## 9. Push Notifications

### 9.1 Notification Setup

```typescript
// lib/notifications.ts

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { api } from './api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'your-expo-project-id',
  });

  // Register token with server
  await api.post('/mobile/push-token', { token: token.data });

  return token.data;
}

// Schedule local reminder for upcoming visit
export async function scheduleVisitReminder(
  visitId: string,
  hospitalName: string,
  scheduledDate: Date
): Promise<void> {
  // Remind 1 hour before
  const reminderTime = new Date(scheduledDate.getTime() - 60 * 60 * 1000);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Pripomienka návštevy',
      body: `Návšteva v ${hospitalName} o 1 hodinu`,
      data: { visitId },
    },
    trigger: {
      date: reminderTime,
    },
  });
}
```

---

## 10. App Configuration

### 10.1 app.json (Expo Config)

```json
{
  "expo": {
    "name": "INDEXUS Connect",
    "slug": "indexus-connect",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#6B1D35"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.cordbloodcenter.indexusconnect",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "INDEXUS Connect needs your location to track visits.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "INDEXUS Connect needs background location access to track visits even when the app is closed.",
        "NSMicrophoneUsageDescription": "INDEXUS Connect needs microphone access to record voice notes.",
        "UIBackgroundModes": ["location", "audio"]
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#6B1D35"
      },
      "package": "com.cordbloodcenter.indexusconnect",
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "RECORD_AUDIO",
        "FOREGROUND_SERVICE",
        "RECEIVE_BOOT_COMPLETED"
      ]
    },
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow INDEXUS Connect to use your location for visit tracking.",
          "isAndroidBackgroundLocationEnabled": true
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#6B1D35"
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    }
  }
}
```

---

## 11. Color Scheme & Branding

```typescript
// constants/Colors.ts

export const Colors = {
  // Primary brand color (burgundy)
  primary: '#6B1D35',
  primaryLight: '#8B3D55',
  primaryDark: '#4B0D25',
  
  // Secondary colors
  secondary: '#2C3E50',
  accent: '#E67E22',
  
  // Status colors
  success: '#27AE60',
  warning: '#F39C12',
  error: '#E74C3C',
  info: '#3498DB',
  
  // Visit status colors
  scheduled: '#3498DB',
  inProgress: '#F39C12',
  completed: '#27AE60',
  cancelled: '#95A5A6',
  
  // Neutral colors
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#2C3E50',
  textSecondary: '#7F8C8D',
  border: '#E0E0E0',
  
  // Dark mode
  dark: {
    background: '#1A1A2E',
    surface: '#16213E',
    text: '#EAEAEA',
    textSecondary: '#A0A0A0',
    border: '#2D2D44',
  },
};
```

---

## 12. Security Considerations

### 12.1 Data Protection

1. **JWT Token Storage**: Stored in encrypted AsyncStorage
2. **SQLite Encryption**: Use SQLCipher for sensitive data
3. **Network Security**: TLS 1.3 only, certificate pinning
4. **Biometric Auth**: Optional fingerprint/Face ID for app unlock
5. **Session Timeout**: Auto-logout after 24 hours of inactivity
6. **Remote Wipe**: Server can invalidate token and request local data deletion

### 12.2 Privacy Compliance

- GPS data stored only during active visits
- Voice notes encrypted at rest
- User can request data export/deletion
- GDPR compliant data handling

---

## 13. Development Roadmap

### Phase 1: Core Functionality (MVP)
- [ ] Authentication (login/logout)
- [ ] Dashboard with today's visits
- [ ] Visit list and detail views
- [ ] Hospital list and selection
- [ ] Basic GPS tracking for visits
- [ ] Offline data storage

### Phase 2: Enhanced Features
- [ ] Voice note recording
- [ ] Server-side transcription
- [ ] Full calendar view
- [ ] Map view with hospital pins
- [ ] Push notifications

### Phase 3: Advanced Features
- [ ] Background location tracking
- [ ] Geofencing verification
- [ ] Visit analytics
- [ ] Route optimization
- [ ] Biometric authentication

### Phase 4: Polish
- [ ] Dark mode support
- [ ] All 7 language translations
- [ ] Performance optimization
- [ ] Comprehensive error handling
- [ ] App Store / Play Store submission

---

## 14. Testing Strategy

### Unit Tests
- API client functions
- Sync engine logic
- Location calculations
- Date/time utilities

### Integration Tests
- Authentication flow
- Offline/online sync
- Database operations
- Voice recording flow

### E2E Tests (Detox)
- Complete visit creation flow
- Offline mode behavior
- GPS tracking accuracy
- Voice note recording

---

## Appendix: API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/mobile/auth/login | Authenticate and get JWT token |
| GET | /api/mobile/auth/verify | Verify token validity |
| GET | /api/mobile/hospitals | List hospitals |
| POST | /api/mobile/hospitals | Create new hospital |
| PUT | /api/mobile/hospitals/:id | Update hospital |
| GET | /api/mobile/visit-events | List visit events |
| POST | /api/mobile/visit-events | Create visit event |
| PUT | /api/mobile/visit-events/:id | Update visit event |
| DELETE | /api/mobile/visit-events/:id | Delete visit event |
| GET | /api/mobile/visit-options | Get localized visit options |
| POST | /api/mobile/voice-notes | Upload voice note for transcription |
| POST | /api/mobile/push-token | Register push notification token |
