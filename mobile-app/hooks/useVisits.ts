import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import * as db from '@/lib/db';
import { createVisitOffline, updateVisitOffline, syncAll, syncPendingChanges } from '@/lib/sync';
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

const STATUS_PRIORITY: Record<string, number> = {
  scheduled: 1,
  in_progress: 2,
  completed: 3,
  cancelled: 4,
  not_realized: 5,
};

function isLocalStatusMoreAdvanced(localStatus: string | undefined, serverStatus: string): boolean {
  if (!localStatus) return false;
  const localPriority = STATUS_PRIORITY[localStatus] || 0;
  const serverPriority = STATUS_PRIORITY[serverStatus] || 0;
  return localPriority > serverPriority;
}

function mapServerVisitToLocal(visit: any): Parameters<typeof db.saveVisitEvent>[0] {
  return {
    id: String(visit.id),
    hospitalId: visit.hospitalId,
    hospitalName: visit.hospitalName,
    visitType: visit.visitType || visit.subject,
    place: visit.place,
    remarkDetail: visit.remarkDetail,
    status: visit.status || (visit.isCancelled ? 'cancelled' : visit.isNotRealized ? 'not_realized' : 'scheduled'),
    scheduledStart: visit.scheduledStart || visit.startTime,
    scheduledEnd: visit.scheduledEnd || visit.endTime,
    actualStart: visit.actualStart,
    actualEnd: visit.actualEnd,
    startLatitude: visit.startLatitude,
    startLongitude: visit.startLongitude,
    endLatitude: visit.endLatitude,
    endLongitude: visit.endLongitude,
    notes: visit.notes || visit.remark,
    isCancelled: visit.isCancelled,
    isNotRealized: visit.isNotRealized,
  };
}

function mergeVisitPreservingLocal(serverVisit: any, localVisit: any): Parameters<typeof db.saveVisitEvent>[0] {
  const mapped = mapServerVisitToLocal(serverVisit);
  if (!localVisit) return mapped;
  
  if (isLocalStatusMoreAdvanced(localVisit.status, mapped.status || 'scheduled')) {
    return {
      ...mapped,
      status: localVisit.status,
      actualStart: localVisit.actualStart || mapped.actualStart,
      actualEnd: localVisit.actualEnd || mapped.actualEnd,
      startLatitude: localVisit.startLatitude || mapped.startLatitude,
      startLongitude: localVisit.startLongitude || mapped.startLongitude,
      endLatitude: localVisit.endLatitude || mapped.endLatitude,
      endLongitude: localVisit.endLongitude || mapped.endLongitude,
      isCancelled: localVisit.isCancelled || mapped.isCancelled,
      isNotRealized: localVisit.isNotRealized || mapped.isNotRealized,
    };
  }
  
  return {
    ...mapped,
    actualStart: mapped.actualStart || localVisit.actualStart,
    actualEnd: mapped.actualEnd || localVisit.actualEnd,
    startLatitude: mapped.startLatitude || localVisit.startLatitude,
    startLongitude: mapped.startLongitude || localVisit.startLongitude,
    endLatitude: mapped.endLatitude || localVisit.endLatitude,
    endLongitude: mapped.endLongitude || localVisit.endLongitude,
  };
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
      const allLocalVisits = await db.getVisitEvents();
      const localVisitMap = new Map<string, any>();
      for (const v of allLocalVisits) {
        localVisitMap.set(String(v.id), v);
      }
      
      if (isOnline) {
        try {
          const visits = await api.get<VisitEvent[]>('/api/mobile/visit-events');
          if (visits && Array.isArray(visits)) {
            for (const visit of visits) {
              const localVisit = localVisitMap.get(String(visit.id));
              const merged = mergeVisitPreservingLocal(visit, localVisit);
              await db.saveVisitEvent(merged);
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
      const localVisits = await db.getVisitEvents();
      const localVisit = localVisits.find((v: any) => String(v.id) === String(id));
      
      if (isOnline) {
        try {
          const serverVisit = await api.get<VisitEvent>(`/api/mobile/visit-events/${id}`);
          if (serverVisit) {
            const merged = mergeVisitPreservingLocal(serverVisit, localVisit);
            await db.saveVisitEvent(merged);
            return await db.getVisitEvents().then(visits => 
              visits.find((v: any) => String(v.id) === String(id))
            );
          }
        } catch (error) {
        }
      }
      return localVisit;
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
      return { id, status: 'in_progress', actualStart: new Date().toISOString(), startLatitude: latitude, startLongitude: longitude };
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['visit', variables.id] });
      await queryClient.cancelQueries({ queryKey: ['visits'] });
      
      const previousVisit = queryClient.getQueryData(['visit', variables.id]);
      const previousVisits = queryClient.getQueryData(['visits']);
      
      queryClient.setQueryData(['visit', variables.id], (old: any) => 
        old ? { ...old, status: 'in_progress', actualStart: new Date().toISOString() } : old
      );
      
      queryClient.setQueryData(['visits'], (old: any[]) => 
        old?.map(v => String(v.id) === variables.id ? { ...v, status: 'in_progress' } : v)
      );
      
      return { previousVisit, previousVisits };
    },
    onError: (err, variables, context) => {
      if (context?.previousVisit) {
        queryClient.setQueryData(['visit', variables.id], context.previousVisit);
      }
      if (context?.previousVisits) {
        queryClient.setQueryData(['visits'], context.previousVisits);
      }
    },
    onSettled: async (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['visit', variables.id] });
      if (isOnline) {
        try {
          await syncPendingChanges();
        } catch (e) {
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
      return { id, status: 'completed', actualEnd: new Date().toISOString(), endLatitude: latitude, endLongitude: longitude };
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['visit', variables.id] });
      await queryClient.cancelQueries({ queryKey: ['visits'] });
      
      const previousVisit = queryClient.getQueryData(['visit', variables.id]);
      const previousVisits = queryClient.getQueryData(['visits']);
      
      queryClient.setQueryData(['visit', variables.id], (old: any) => 
        old ? { ...old, status: 'completed', actualEnd: new Date().toISOString() } : old
      );
      
      queryClient.setQueryData(['visits'], (old: any[]) => 
        old?.map(v => String(v.id) === variables.id ? { ...v, status: 'completed' } : v)
      );
      
      return { previousVisit, previousVisits };
    },
    onError: (err, variables, context) => {
      if (context?.previousVisit) {
        queryClient.setQueryData(['visit', variables.id], context.previousVisit);
      }
      if (context?.previousVisits) {
        queryClient.setQueryData(['visits'], context.previousVisits);
      }
    },
    onSettled: async (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['visit', variables.id] });
      if (isOnline) {
        try {
          await syncPendingChanges();
        } catch (e) {
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
      await db.cancelVisit(id);
      if (isOnline) {
        try {
          await api.put<VisitEvent>(`/api/mobile/visit-events/${id}`, { status: 'cancelled', isCancelled: true });
        } catch {
        }
      }
      return { id, status: 'cancelled' };
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['visit', id] });
      await queryClient.cancelQueries({ queryKey: ['visits'] });
      
      const previousVisit = queryClient.getQueryData(['visit', id]);
      const previousVisits = queryClient.getQueryData(['visits']);
      
      queryClient.setQueryData(['visit', id], (old: any) => 
        old ? { ...old, status: 'cancelled', isCancelled: true } : old
      );
      
      queryClient.setQueryData(['visits'], (old: any[]) => 
        old?.map(v => String(v.id) === id ? { ...v, status: 'cancelled', isCancelled: true } : v)
      );
      
      return { previousVisit, previousVisits };
    },
    onError: (err, id, context) => {
      if (context?.previousVisit) {
        queryClient.setQueryData(['visit', id], context.previousVisit);
      }
      if (context?.previousVisits) {
        queryClient.setQueryData(['visits'], context.previousVisits);
      }
    },
    onSettled: (_, __, id) => {
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
      await db.markVisitNotRealized(id);
      if (isOnline) {
        try {
          await api.put<VisitEvent>(`/api/mobile/visit-events/${id}`, { status: 'not_realized', isNotRealized: true });
        } catch {
        }
      }
      return { id, status: 'not_realized' };
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['visit', id] });
      await queryClient.cancelQueries({ queryKey: ['visits'] });
      
      const previousVisit = queryClient.getQueryData(['visit', id]);
      const previousVisits = queryClient.getQueryData(['visits']);
      
      queryClient.setQueryData(['visit', id], (old: any) => 
        old ? { ...old, status: 'not_realized', isNotRealized: true } : old
      );
      
      queryClient.setQueryData(['visits'], (old: any[]) => 
        old?.map(v => String(v.id) === id ? { ...v, status: 'not_realized', isNotRealized: true } : v)
      );
      
      return { previousVisit, previousVisits };
    },
    onError: (err, id, context) => {
      if (context?.previousVisit) {
        queryClient.setQueryData(['visit', id], context.previousVisit);
      }
      if (context?.previousVisits) {
        queryClient.setQueryData(['visits'], context.previousVisits);
      }
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['visit', id] });
    },
  });
}
