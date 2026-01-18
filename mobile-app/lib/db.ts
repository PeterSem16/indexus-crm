import * as SQLite from 'expo-sqlite';

const DB_NAME = 'indexus_connect.db';

let db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabase(DB_NAME);
    initializeDatabase(db);
  }
  return db;
}

export { db };

function initializeDatabase(database: SQLite.SQLiteDatabase): void {
  database.transaction((tx) => {
    tx.executeSql(`
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
      )
    `);

    tx.executeSql(`
      CREATE TABLE IF NOT EXISTS visit_events (
        id TEXT PRIMARY KEY,
        hospital_id TEXT,
        hospital_name TEXT,
        visit_type TEXT,
        place TEXT,
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
        is_cancelled INTEGER DEFAULT 0,
        is_not_realized INTEGER DEFAULT 0,
        synced INTEGER DEFAULT 0,
        updated_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    tx.executeSql('ALTER TABLE visit_events ADD COLUMN place TEXT', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE visit_events ADD COLUMN is_cancelled INTEGER DEFAULT 0', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE visit_events ADD COLUMN is_not_realized INTEGER DEFAULT 0', [], () => {}, () => false);

    tx.executeSql(`
      CREATE TABLE IF NOT EXISTS voice_notes (
        id TEXT PRIMARY KEY,
        visit_event_id TEXT,
        file_path TEXT,
        duration INTEGER,
        transcription TEXT,
        synced INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    tx.executeSql(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    tx.executeSql(`
      CREATE TABLE IF NOT EXISTS gps_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visit_event_id TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy REAL,
        timestamp TEXT NOT NULL
      )
    `);

    tx.executeSql('CREATE INDEX IF NOT EXISTS idx_visits_status ON visit_events(status)');
    tx.executeSql('CREATE INDEX IF NOT EXISTS idx_visits_scheduled ON visit_events(scheduled_start)');
    tx.executeSql('CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)');
    tx.executeSql('CREATE INDEX IF NOT EXISTS idx_gps_tracks_visit ON gps_tracks(visit_event_id)');
  });
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
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          `INSERT OR REPLACE INTO hospitals (id, name, city, address, country_code, contact_person, phone, email, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [hospital.id, hospital.name, hospital.city || null, hospital.address || null,
           hospital.countryCode || null, hospital.contactPerson || null, hospital.phone || null, hospital.email || null]
        );
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

export async function getHospitals(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          'SELECT * FROM hospitals ORDER BY name',
          [],
          (_, { rows }) => {
            const hospitals = rows._array.map(row => ({
              id: String(row.id),
              name: row.name,
              city: row.city,
              address: row.address,
              countryCode: row.country_code,
              contactPerson: row.contact_person,
              phone: row.phone,
              email: row.email,
            }));
            resolve(hospitals);
          },
          (_, error) => { reject(error); return false; }
        );
      },
      (error) => reject(error)
    );
  });
}

export async function saveVisitEvent(visit: {
  id: string;
  hospitalId?: string;
  hospitalName?: string;
  visitType?: string;
  place?: string;
  status?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  notes?: string;
  isCancelled?: boolean;
  isNotRealized?: boolean;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          `INSERT OR REPLACE INTO visit_events (id, hospital_id, hospital_name, visit_type, place, status, scheduled_start, scheduled_end, notes, is_cancelled, is_not_realized, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [visit.id, visit.hospitalId || null, visit.hospitalName || null, visit.visitType || null, visit.place || null,
           visit.status || 'scheduled', visit.scheduledStart || null, visit.scheduledEnd || null, visit.notes || null,
           visit.isCancelled ? 1 : 0, visit.isNotRealized ? 1 : 0]
        );
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

export async function getVisitEvents(date?: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        if (date) {
          tx.executeSql(
            `SELECT * FROM visit_events WHERE date(scheduled_start) = ? ORDER BY scheduled_start`,
            [date],
            (_, { rows }) => resolve(rows._array),
            (_, error) => { reject(error); return false; }
          );
        } else {
          tx.executeSql(
            'SELECT * FROM visit_events ORDER BY scheduled_start DESC',
            [],
            (_, { rows }) => resolve(rows._array),
            (_, error) => { reject(error); return false; }
          );
        }
      },
      (error) => reject(error)
    );
  });
}

export async function startVisit(visitId: string, latitude: number, longitude: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          `UPDATE visit_events SET status = 'in_progress', actual_start = datetime('now'), start_latitude = ?, start_longitude = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [latitude, longitude, visitId]
        );
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

export async function endVisit(visitId: string, latitude: number, longitude: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          `UPDATE visit_events SET status = 'completed', actual_end = datetime('now'), end_latitude = ?, end_longitude = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [latitude, longitude, visitId]
        );
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

export async function cancelVisit(visitId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          `UPDATE visit_events SET status = 'cancelled', is_cancelled = 1, synced = 0, updated_at = datetime('now')
           WHERE id = ?`,
          [visitId]
        );
        tx.executeSql(
          `INSERT INTO sync_queue (entity_type, entity_id, action, payload) VALUES (?, ?, ?, ?)`,
          ['visit', visitId, 'update', JSON.stringify({ status: 'cancelled', isCancelled: true })]
        );
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

export async function markVisitNotRealized(visitId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          `UPDATE visit_events SET status = 'not_realized', is_not_realized = 1, synced = 0, updated_at = datetime('now')
           WHERE id = ?`,
          [visitId]
        );
        tx.executeSql(
          `INSERT INTO sync_queue (entity_type, entity_id, action, payload) VALUES (?, ?, ?, ?)`,
          ['visit', visitId, 'update', JSON.stringify({ status: 'not_realized', isNotRealized: true })]
        );
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

export async function addGpsTrack(visitEventId: string, latitude: number, longitude: number, accuracy: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          `INSERT INTO gps_tracks (visit_event_id, latitude, longitude, accuracy, timestamp)
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [visitEventId, latitude, longitude, accuracy]
        );
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

export async function addToSyncQueue(entityType: string, entityId: string, action: string, payload: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          `INSERT INTO sync_queue (entity_type, entity_id, action, payload)
           VALUES (?, ?, ?, ?)`,
          [entityType, entityId, action, JSON.stringify(payload)]
        );
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

export async function getSyncQueue(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          'SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT 50',
          [],
          (_, { rows }) => resolve(rows._array),
          (_, error) => { reject(error); return false; }
        );
      },
      (error) => reject(error)
    );
  });
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql('DELETE FROM sync_queue WHERE id = ?', [id]);
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

export async function getSyncQueueCount(): Promise<number> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          'SELECT COUNT(*) as count FROM sync_queue',
          [],
          (_, { rows }) => resolve(rows._array[0]?.count || 0),
          (_, error) => { reject(error); return false; }
        );
      },
      (error) => reject(error)
    );
  });
}

export async function markAsSynced(entityType: string, entityId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    const table = entityType === 'hospital' ? 'hospitals' : 
                  entityType === 'visit' ? 'visit_events' : 
                  entityType === 'voice_note' ? 'voice_notes' : null;
    
    if (!table) {
      resolve();
      return;
    }

    database.transaction(
      (tx) => {
        tx.executeSql(`UPDATE ${table} SET synced = 1 WHERE id = ?`, [entityId]);
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

export async function clearDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql('DELETE FROM hospitals');
        tx.executeSql('DELETE FROM visit_events');
        tx.executeSql('DELETE FROM voice_notes');
        tx.executeSql('DELETE FROM sync_queue');
        tx.executeSql('DELETE FROM gps_tracks');
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}
