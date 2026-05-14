import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSyncStore } from '@/stores/syncStore';

export interface Clinic {
  id: string;
  name: string;
  doctorName?: string;
  doctorTitle?: string;
  doctorFirstName?: string;
  doctorLastName?: string;
  pzsCode?: string;
  ico?: string;
  phone?: string;
  phone2?: string;
  phone3?: string;
  email?: string;
  email2?: string;
  email3?: string;
  website?: string;
  address?: string;
  street?: string;
  streetNumber?: string;
  orientationNumber?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  region?: string;
  district?: string;
  latitude?: string | null;
  longitude?: string | null;
  isActive?: boolean;
  notes?: string;
  contractStatus?: string;
  lastCallResult?: string;
  lastCallNote?: string;
  interestCooperation?: string;
  interestContract?: string;
  hasFlyers?: boolean;
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

export function useUpdateClinic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Clinic> & { id: string }) => {
      return api.patch<Clinic>(`/api/mobile/clinics/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinics'] });
    },
  });
}
