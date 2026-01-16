import { useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { getCurrentLocation, startLocationTracking, stopLocationTracking, isTracking } from '@/lib/location';

export function useLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);

  const getLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const loc = await getCurrentLocation();
      if (loc) {
        setLocation(loc);
      } else {
        setError('Could not get location');
      }
    } catch (e) {
      setError('Location error');
    } finally {
      setLoading(false);
    }
  }, []);

  const startTracking = useCallback(async (visitId: string) => {
    try {
      await startLocationTracking(visitId);
      setTracking(true);
    } catch (e) {
      setError('Could not start tracking');
    }
  }, []);

  const stopTracking = useCallback(async () => {
    try {
      const loc = await stopLocationTracking();
      setTracking(false);
      if (loc) {
        setLocation(loc);
      }
      return loc;
    } catch (e) {
      setError('Could not stop tracking');
      return null;
    }
  }, []);

  return {
    location,
    loading,
    error,
    tracking,
    getLocation,
    startTracking,
    stopTracking,
    isTracking: isTracking(),
  };
}
