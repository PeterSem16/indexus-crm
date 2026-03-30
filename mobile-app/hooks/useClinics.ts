import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSyncStore } from '@/stores/syncStore';

export interface Clinic {
  id: string;
  name: string;
  doctorName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  countryCode?: string;
}

export function useClinics() {
  const isOnline = useSyncStore((state) => state.isOnline);

  return useQuery({
    queryKey: ['clinics'],
    queryFn: async () => {
      if (isOnline) {
        try {
          const clinics = await api.get<Clinic[]>('/api/mobile/clinics');
          return clinics;
        } catch (error) {
          console.error('[useClinics] API error:', error);
          return [];
        }
      }
      return [];
    },
  });
}
