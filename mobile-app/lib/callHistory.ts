import { getDatabase } from './db';

export interface CallHistoryEntry {
  id: string;
  phoneNumber: string;
  direction: string;
  duration: number;
  status: string;
  contactName: string | null;
  contactId: string | null;
  createdAt: string;
}

export async function saveCallToHistory(entry: {
  phoneNumber: string;
  direction: string;
  duration: number;
  status: string;
  contactName: string | null;
  contactId: string | null;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    const id = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    database.transaction(
      (tx) => {
        tx.executeSql(
          `INSERT INTO call_history (id, phone_number, direction, duration, status, contact_name, contact_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [id, entry.phoneNumber, entry.direction, entry.duration, entry.status, entry.contactName, entry.contactId]
        );
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

export async function getCallHistory(limit: number = 50): Promise<CallHistoryEntry[]> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql(
          'SELECT id, phone_number, direction, duration, status, contact_name, contact_id, created_at FROM call_history ORDER BY created_at DESC LIMIT ?',
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
