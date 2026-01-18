import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import * as db from '@/lib/db';
import { createVisitOffline, updateVisitOffline, syncAll } from '@/lib/sync';
import { useSyncStore } from '@/stores/syncStore';

interface VisitEvent {
  id: string;
  collaboratorId?: string;
  countryCode?: string;
  hospitalId?: string;
  hospitalName?: string;
  subject: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  latitude?: number;
  longitude?: number;
  locationAddress?: string;
  remark?: string;
  remarkVoiceUrl?: string;
  remarkDetail?: string;
  visitType?: string;
  place?: string;
  status?: string;
  actualStart?: string;
  actualEnd?: string;
  startLatitude?: number;
  startLongitude?: number;
  endLatitude?: number;
  endLongitude?: number;
  isCancelled?: boolean;
  isNotRealized?: boolean;
}

interface CreateVisitInput {
  hospitalId?: string;
  hospitalName?: string;
  subject: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  remark?: string;
  visitType?: string;
  place?: string;
  remarkDetail?: string;
}

export function useVisits(date?: string) {
  const isOnline = useSyncStore((state) => state.isOnline);
  
  return useQuery({
    queryKey: ['visits', date],
    queryFn: async () => {
      if (isOnline) {
        try {
          const visits = await api.get<VisitEvent[]>('/api/mobile/visit-events');
          if (visits && Array.isArray(visits)) {
            for (const visit of visits) {
              await db.saveVisitEvent({
                id: String(visit.id),
                hospitalId: visit.hospitalId,
                hospitalName: visit.hospitalName,
                visitType: visit.visitType || visit.subject,
                place: visit.place,
                remarkDetail: visit.remarkDetail,
                status: visit.status || (visit.isCancelled ? 'cancelled' : visit.isNotRealized ? 'not_realized' : 'scheduled'),
                scheduledStart: visit.startTime,
                scheduledEnd: visit.endTime,
                actualStart: visit.actualStart,
                actualEnd: visit.actualEnd,
                startLatitude: visit.startLatitude,
                startLongitude: visit.startLongitude,
                endLatitude: visit.endLatitude,
                endLongitude: visit.endLongitude,
                notes: visit.remark,
                isCancelled: visit.isCancelled,
                isNotRealized: visit.isNotRealized,
              });
            }
          }
          return await db.getVisitEvents(date);
        } catch {
          return await db.getVisitEvents(date);
        }
      }
      return await db.getVisitEvents(date);
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });
}

export function useVisit(id: string) {
  const isOnline = useSyncStore((state) => state.isOnline);
  
  return useQuery({
    queryKey: ['visit', id],
    queryFn: async () => {
      if (isOnline) {
        try {
          const visit = await api.get<VisitEvent>(`/api/mobile/visit-events/${id}`);
          if (visit) {
            await db.saveVisitEvent(visit);
            return visit;
          }
        } catch (error) {
          console.log('[useVisit] API error, falling back to local DB');
        }
      }
      const visits = await db.getVisitEvents();
      return visits.find((v: any) => String(v.id) === String(id));
    },
    enabled: !!id,
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();
  const isOnline = useSyncStore((state) => state.isOnline);
  
  return useMutation({
    mutationFn: async (visit: CreateVisitInput) => {
      if (isOnline) {
        try {
          const result = await api.post<VisitEvent>('/api/mobile/visit-events', visit);
          return result;
        } catch (error) {
          const id = await createVisitOffline(visit);
          return { id, ...visit } as VisitEvent;
        }
      }
      const id = await createVisitOffline(visit);
      return { id, ...visit } as VisitEvent;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      try {
        await syncAll();
      } catch (e) {
        // Sync failed, will retry later
      }
      queryClient.refetchQueries({ queryKey: ['visits'] });
    },
  });
}

export function useUpdateVisit() {
  const queryClient = useQueryClient();
  const isOnline = useSyncStore((state) => state.isOnline);
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<VisitEvent>) => {
      if (isOnline) {
        return await api.put<VisitEvent>(`/api/mobile/visit-events/${id}`, updates);
      }
      await updateVisitOffline(id, updates);
      return { id, ...updates } as VisitEvent;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['visit', variables.id] });
    },
  });
}

export function useStartVisit() {
  const queryClient = useQueryClient();
  const isOnline = useSyncStore((state) => state.isOnline);
  
  return useMutation({
    mutationFn: async ({ id, latitude, longitude }: { id: string; latitude: number; longitude: number }) => {
      await db.startVisit(id, latitude, longitude);
      return { id };
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['visit', variables.id] });
      if (isOnline) {
        try {
          await syncAll();
        } catch (e) {
          // Sync will retry later
        }
      }
    },
  });
}

export function useEndVisit() {
  const queryClient = useQueryClient();
  const isOnline = useSyncStore((state) => state.isOnline);
  
  return useMutation({
    mutationFn: async ({ id, latitude, longitude }: { id: string; latitude: number; longitude: number }) => {
      await db.endVisit(id, latitude, longitude);
      return { id };
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['visit', variables.id] });
      if (isOnline) {
        try {
          await syncAll();
        } catch (e) {
          // Sync will retry later
        }
      }
    },
  });
}

export function useCancelVisit() {
  const queryClient = useQueryClient();
  const isOnline = useSyncStore((state) => state.isOnline);
  
  return useMutation({
    mutationFn: async (id: string) => {
      if (isOnline) {
        try {
          return await api.put<VisitEvent>(`/api/mobile/visit-events/${id}`, { status: 'cancelled', isCancelled: true });
        } catch {
          await db.cancelVisit(id);
          return { id };
        }
      }
      await db.cancelVisit(id);
      return { id };
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['visit', id] });
    },
  });
}

export function useMarkVisitNotRealized() {
  const queryClient = useQueryClient();
  const isOnline = useSyncStore((state) => state.isOnline);
  
  return useMutation({
    mutationFn: async (id: string) => {
      if (isOnline) {
        try {
          return await api.put<VisitEvent>(`/api/mobile/visit-events/${id}`, { status: 'not_realized', isNotRealized: true });
        } catch {
          await db.markVisitNotRealized(id);
          return { id };
        }
      }
      await db.markVisitNotRealized(id);
      return { id };
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['visit', id] });
    },
  });
}
