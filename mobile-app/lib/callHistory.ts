import { getDatabase } from './db';

export interface CallHistoryEntry {
  id: string;
  phoneNumber: string;
  direction: string;
  duration: number;
  status: string;
  contactName: string | null;
  contactId: string | null;
  callLogId: string | null;
  createdAt: string;
}

function ensureCallLogIdColumn(): Promise<void> {
  return new Promise((resolve) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          `ALTER TABLE call_history ADD COLUMN call_log_id TEXT`,
          [],
          () => resolve(),
          () => { resolve(); return false; }
        );
      },
      () => resolve(),
      () => resolve()
    );
  });
}

let columnEnsured = false;

async function ensureSchema() {
  if (!columnEnsured) {
    await ensureCallLogIdColumn();
    columnEnsured = true;
  }
}

export async function saveCallToHistory(entry: {
  phoneNumber: string;
  direction: string;
  duration: number;
  status: string;
  contactName: string | null;
  contactId: string | null;
  callLogId?: string | null;
}): Promise<string> {
  await ensureSchema();
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    const id = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    database.transaction(
      (tx) => {
        tx.executeSql(
          `INSERT INTO call_history (id, phone_number, direction, duration, status, contact_name, contact_id, call_log_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [id, entry.phoneNumber, entry.direction, entry.duration, entry.status, entry.contactName, entry.contactId, entry.callLogId || null]
        );
      },
      (error) => reject(error),
      () => resolve(id)
    );
  });
}

export async function getCallHistory(limit: number = 50): Promise<CallHistoryEntry[]> {
  await ensureSchema();
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          'SELECT id, phone_number, direction, duration, status, contact_name, contact_id, call_log_id, created_at FROM call_history ORDER BY created_at DESC LIMIT ?',
          [limit],
          (_, { rows }) => {
            const results: CallHistoryEntry[] = [];
            for (let i = 0; i < rows.length; i++) {
              const row = rows.item(i);
              results.push({
                id: row.id,
                phoneNumber: row.phone_number,
                direction: row.direction,
                duration: row.duration,
                status: row.status,
                contactName: row.contact_name,
                contactId: row.contact_id,
                callLogId: row.call_log_id || null,
                createdAt: row.created_at,
              });
            }
            resolve(results);
          },
          (_, error) => { reject(error); return false; }
        );
      },
      (error) => reject(error)
    );
  });
}

export async function updateCallDuration(id: string, duration: number, status: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          'UPDATE call_history SET duration = ?, status = ? WHERE id = ?',
          [duration, status, id]
        );
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

export async function updateCallLogId(id: string, callLogId: string): Promise<void> {
  await ensureSchema();
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          'UPDATE call_history SET call_log_id = ? WHERE id = ?',
          [callLogId, id]
        );
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

export async function clearCallHistory(): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql('DELETE FROM call_history');
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}
