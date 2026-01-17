import NetInfo from '@react-native-community/netinfo';
import { api } from './api';
import * as db from './db';
import { useSyncStore } from '@/stores/syncStore';

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

export async function checkNetworkStatus(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true;
}

export async function syncAll(): Promise<void> {
  const { startSync, finishSync, setPendingCount, setOnline } = useSyncStore.getState();
  
  const isOnline = await checkNetworkStatus();
  setOnline(isOnline);
  
  if (!isOnline) {
    finishSync(false, 'No network connection');
    return;
  }
  
  startSync();
  
  try {
    await syncPendingChanges();
    await pullServerData();
    
    const pendingCount = await db.getSyncQueueCount();
    setPendingCount(pendingCount);
    
    finishSync(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    finishSync(false, message);
  }
}

async function syncPendingChanges(): Promise<void> {
  const queue = await db.getSyncQueue();
  
  for (const item of queue) {
    try {
      const payload = JSON.parse(item.payload);
      
      switch (item.entity_type) {
        case 'visit':
          await syncVisit(item.action, item.entity_id, payload);
          break;
        case 'hospital':
          await syncHospital(item.action, item.entity_id, payload);
          break;
        case 'voice_note':
          await syncVoiceNote(item.entity_id, payload);
          break;
        case 'gps_track':
          await syncGpsTracks(item.entity_id);
          break;
      }
      
      await db.removeSyncQueueItem(item.id);
      await db.markAsSynced(item.entity_type, item.entity_id);
    } catch (error) {
      await incrementRetryCount(item.id, item.retry_count);
      if (item.retry_count >= MAX_RETRIES) {
        await db.removeSyncQueueItem(item.id);
      } else {
        await delay(RETRY_DELAY * Math.pow(2, item.retry_count));
      }
    }
  }
}

async function syncVisit(action: string, entityId: string, payload: any): Promise<void> {
  switch (action) {
    case 'create':
      await api.post('/api/mobile/visit-events', payload);
      break;
    case 'update':
      await api.put(`/api/mobile/visit-events/${entityId}`, payload);
      break;
    case 'delete':
      await api.delete(`/api/mobile/visit-events/${entityId}`);
      break;
  }
}

async function syncHospital(action: string, entityId: string, payload: any): Promise<void> {
  switch (action) {
    case 'create':
      await api.post('/api/mobile/hospitals', payload);
      break;
    case 'update':
      await api.put(`/api/mobile/hospitals/${entityId}`, payload);
      break;
  }
}

async function syncVoiceNote(entityId: string, payload: any): Promise<void> {
  const { uploadVoiceNote } = await import('./audio');
  if (payload.fileUri && payload.visitEventId && payload.duration) {
    await uploadVoiceNote(payload.visitEventId, payload.fileUri, payload.duration);
  }
}

async function pullServerData(): Promise<void> {
  try {
    const hospitals = await api.get<any[]>('/api/mobile/hospitals');
    for (const hospital of hospitals) {
      await db.saveHospital({
        id: hospital.id,
        name: hospital.name,
        city: hospital.city,
        address: hospital.address,
        countryCode: hospital.countryCode,
        contactPerson: hospital.contactPerson,
        phone: hospital.phone,
        email: hospital.email,
      });
    }
  } catch (error) {
  }
  
  try {
    const visits = await api.get<any[]>('/api/mobile/visit-events');
    for (const visit of visits) {
      await db.saveVisitEvent({
        id: visit.id,
        hospitalId: visit.hospitalId,
        hospitalName: visit.hospitalName,
        visitType: visit.visitType,
        status: visit.status,
        scheduledStart: visit.scheduledStart,
        scheduledEnd: visit.scheduledEnd,
        notes: visit.notes,
      });
    }
  } catch (error) {
  }
}

export async function createVisitOffline(visit: {
  hospitalId?: string;
  hospitalName?: string;
  subject?: string;
  startTime?: string;
  endTime?: string;
  remark?: string;
}): Promise<string> {
  const id = generateUUID();
  
  await db.saveVisitEvent({
    id,
    hospitalId: visit.hospitalId,
    hospitalName: visit.hospitalName,
    visitType: visit.subject,
    status: 'scheduled',
    scheduledStart: visit.startTime,
    scheduledEnd: visit.endTime,
    notes: visit.remark,
  });
  
  await db.addToSyncQueue('visit', id, 'create', { id, ...visit });
  
  const pendingCount = await db.getSyncQueueCount();
  useSyncStore.getState().setPendingCount(pendingCount);
  
  return id;
}

export async function updateVisitOffline(id: string, updates: any): Promise<void> {
  await db.saveVisitEvent({ id, ...updates });
  await db.addToSyncQueue('visit', id, 'update', updates);
  
  const pendingCount = await db.getSyncQueueCount();
  useSyncStore.getState().setPendingCount(pendingCount);
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function incrementRetryCount(id: number, currentCount: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = db.getDatabase();
    database.transaction(
      (tx) => {
        tx.executeSql('UPDATE sync_queue SET retry_count = ? WHERE id = ?', [currentCount + 1, id]);
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

async function syncGpsTracks(visitEventId: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const database = db.getDatabase();
    
    database.transaction(
      (tx) => {
        tx.executeSql(
          'SELECT * FROM gps_tracks WHERE visit_event_id = ?',
          [visitEventId],
          async (_, { rows }) => {
            const tracks = rows._array;
            if (tracks.length > 0) {
              try {
                await api.post(`/api/mobile/visit-events/${visitEventId}/gps-tracks`, { tracks });
                database.transaction(
                  (tx2) => {
                    tx2.executeSql('DELETE FROM gps_tracks WHERE visit_event_id = ?', [visitEventId]);
                  },
                  (error) => reject(error),
                  () => resolve()
                );
              } catch (error) {
                reject(error);
              }
            } else {
              resolve();
            }
          },
          (_, error) => { reject(error); return false; }
        );
      },
      (error) => reject(error)
    );
  });
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
