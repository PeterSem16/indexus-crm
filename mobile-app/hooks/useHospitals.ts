import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import * as db from '@/lib/db';
import { useSyncStore } from '@/stores/syncStore';

export interface Hospital {
  id: string;
  name: string;
  fullName?: string;
  city?: string;
  address?: string;
  streetNumber?: string;
  postalCode?: string;
  region?: string;
  countryCode?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  latitude?: string;
  longitude?: string;
  isActive?: boolean;
  svetZdravia?: boolean;
  autoRecruiting?: boolean;
}

export function useHospitals() {
  const isOnline = useSyncStore((state) => state.isOnline);
  
  return useQuery({
    queryKey: ['hospitals'],
    queryFn: async () => {
      console.log('[useHospitals] Fetching hospitals, isOnline:', isOnline);
      
      if (isOnline) {
        try {
          console.log('[useHospitals] Making API request to /api/mobile/hospitals');
          const hospitals = await api.get<Hospital[]>('/api/mobile/hospitals');
          console.log('[useHospitals] API returned', hospitals.length, 'hospitals');
          
          for (const hospital of hospitals) {
            await db.saveHospital(hospital);
          }
          return hospitals;
        } catch (error) {
          console.error('[useHospitals] API error, falling back to local DB:', error);
          const localHospitals = await db.getHospitals();
          console.log('[useHospitals] Local DB returned', localHospitals.length, 'hospitals');
          return localHospitals;
        }
      }
      
      const localHospitals = await db.getHospitals();
      console.log('[useHospitals] Offline mode, local DB returned', localHospitals.length, 'hospitals');
      return localHospitals;
    },
  });
}

export function useCreateHospital() {
  const queryClient = useQueryClient();
  const isOnline = useSyncStore((state) => state.isOnline);
  
  return useMutation({
    mutationFn: async (hospital: Omit<Hospital, 'id'>) => {
      if (isOnline) {
        return await api.post<Hospital>('/api/mobile/hospitals', hospital);
      }
      const id = generateUUID();
      await db.saveHospital({ id, ...hospital });
      await db.addToSyncQueue('hospital', id, 'create', { id, ...hospital });
      return { id, ...hospital };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospitals'] });
    },
  });
}

export function useUpdateHospital() {
  const queryClient = useQueryClient();
  const isOnline = useSyncStore((state) => state.isOnline);
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Hospital>) => {
      if (isOnline) {
        return await api.put<Hospital>(`/api/mobile/hospitals/${id}`, updates);
      }
      await db.saveHospital({ id, ...updates } as Hospital);
      await db.addToSyncQueue('hospital', id, 'update', updates);
      return { id, ...updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospitals'] });
    },
  });
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
