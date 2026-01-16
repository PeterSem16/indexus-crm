import * as SQLite from 'expo-sqlite';

const DB_NAME = 'indexus_connect.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await initializeDatabase(db);
  }
  return db;
}

export { db };

async function initializeDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS hospitals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      address TEXT,
      country_code TEXT,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      synced INTEGER DEFAULT 0,
      updated_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS visit_events (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      hospital_name TEXT,
      visit_type TEXT,
      status TEXT DEFAULT 'scheduled',
      scheduled_start TEXT,
      scheduled_end TEXT,
      actual_start TEXT,
      actual_end TEXT,
      start_latitude REAL,
      start_longitude REAL,
      end_latitude REAL,
      end_longitude REAL,
      notes TEXT,
      synced INTEGER DEFAULT 0,
      updated_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS voice_notes (
      id TEXT PRIMARY KEY,
      visit_event_id TEXT,
      file_path TEXT,
      duration INTEGER,
      transcription TEXT,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS gps_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_event_id TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_visits_status ON visit_events(status);
    CREATE INDEX IF NOT EXISTS idx_visits_scheduled ON visit_events(scheduled_start);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_gps_tracks_visit ON gps_tracks(visit_event_id);
  `);
}

export async function saveHospital(hospital: {
  id: string;
  name: string;
  city?: string;
  address?: string;
  countryCode?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
}): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO hospitals (id, name, city, address, country_code, contact_person, phone, email, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [hospital.id, hospital.name, hospital.city || null, hospital.address || null,
     hospital.countryCode || null, hospital.contactPerson || null, hospital.phone || null, hospital.email || null]
  );
}

export async function getHospitals(): Promise<any[]> {
  const database = await getDatabase();
  return await database.getAllAsync('SELECT * FROM hospitals ORDER BY name');
}

export async function saveVisitEvent(visit: {
  id: string;
  hospitalId?: string;
  hospitalName?: string;
  visitType?: string;
  status?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  notes?: string;
}): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO visit_events (id, hospital_id, hospital_name, visit_type, status, scheduled_start, scheduled_end, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [visit.id, visit.hospitalId || null, visit.hospitalName || null, visit.visitType || null,
     visit.status || 'scheduled', visit.scheduledStart || null, visit.scheduledEnd || null, visit.notes || null]
  );
}

export async function getVisitEvents(date?: string): Promise<any[]> {
  const database = await getDatabase();
  if (date) {
    return await database.getAllAsync(
      `SELECT * FROM visit_events WHERE date(scheduled_start) = ? ORDER BY scheduled_start`,
      [date]
    );
  }
  return await database.getAllAsync('SELECT * FROM visit_events ORDER BY scheduled_start DESC');
}

export async function startVisit(visitId: string, latitude: number, longitude: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE visit_events SET status = 'in_progress', actual_start = datetime('now'), start_latitude = ?, start_longitude = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [latitude, longitude, visitId]
  );
}

export async function endVisit(visitId: string, latitude: number, longitude: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE visit_events SET status = 'completed', actual_end = datetime('now'), end_latitude = ?, end_longitude = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [latitude, longitude, visitId]
  );
}

export async function addGpsTrack(visitEventId: string, latitude: number, longitude: number, accuracy: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO gps_tracks (visit_event_id, latitude, longitude, accuracy, timestamp)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [visitEventId, latitude, longitude, accuracy]
  );
}

export async function addToSyncQueue(entityType: string, entityId: string, action: string, payload: any): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO sync_queue (entity_type, entity_id, action, payload)
     VALUES (?, ?, ?, ?)`,
    [entityType, entityId, action, JSON.stringify(payload)]
  );
}

export async function getSyncQueue(): Promise<any[]> {
  const database = await getDatabase();
  return await database.getAllAsync(
    'SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT 50'
  );
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
}

export async function getSyncQueueCount(): Promise<number> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_queue');
  return result?.count || 0;
}

export async function markAsSynced(entityType: string, entityId: string): Promise<void> {
  const database = await getDatabase();
  const table = entityType === 'hospital' ? 'hospitals' : 
                entityType === 'visit' ? 'visit_events' : 
                entityType === 'voice_note' ? 'voice_notes' : null;
  
  if (table) {
    await database.runAsync(`UPDATE ${table} SET synced = 1 WHERE id = ?`, [entityId]);
  }
}

export async function clearDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    DELETE FROM hospitals;
    DELETE FROM visit_events;
    DELETE FROM voice_notes;
    DELETE FROM sync_queue;
    DELETE FROM gps_tracks;
  `);
}
