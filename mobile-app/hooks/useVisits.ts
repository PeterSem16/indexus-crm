import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import * as db from '@/lib/db';
import { createVisitOffline, updateVisitOffline } from '@/lib/sync';
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
  isCancelled?: boolean;
  isNotRealized?: boolean;
}

interface CreateVisitInput {
  hospitalId?: string;
  subject: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  remark?: string;
}

export function useVisits(date?: string) {
  const isOnline = useSyncStore((state) => state.isOnline);
  
  return useQuery({
    queryKey: ['visits', date],
    queryFn: async () => {
      if (isOnline) {
        try {
          const visits = await api.get<VisitEvent[]>('/api/mobile/visit-events');
          return visits;
        } catch {
          return await db.getVisitEvents(date);
        }
      }
      return await db.getVisitEvents(date);
    },
  });
}

export function useVisit(id: string) {
  return useQuery({
    queryKey: ['visit', id],
    queryFn: async () => {
      const visits = await db.getVisitEvents();
      return visits.find((v: any) => v.id === id);
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
        return await api.post<VisitEvent>('/api/mobile/visit-events', visit);
      }
      const id = await createVisitOffline(visit);
      return { id, ...visit } as VisitEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
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
  
  return useMutation({
    mutationFn: async ({ id, latitude, longitude }: { id: string; latitude: number; longitude: number }) => {
      await db.startVisit(id, latitude, longitude);
      return { id };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['visit', variables.id] });
    },
  });
}

export function useEndVisit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, latitude, longitude }: { id: string; latitude: number; longitude: number }) => {
      await db.endVisit(id, latitude, longitude);
      return { id };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['visit', variables.id] });
    },
  });
}
