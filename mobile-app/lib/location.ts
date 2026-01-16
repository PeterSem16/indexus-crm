import * as Location from 'expo-location';
import * as db from './db';

let locationSubscription: Location.LocationSubscription | null = null;
let currentVisitId: string | null = null;

export async function requestLocationPermissions(): Promise<boolean> {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    return false;
  }
  
  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  return backgroundStatus === 'granted';
}

export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  try {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) return null;
    
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch (error) {
    return null;
  }
}

export async function startLocationTracking(visitId: string): Promise<void> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return;
  
  currentVisitId = visitId;
  
  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 30000,
      distanceInterval: 50,
    },
    async (location) => {
      if (currentVisitId) {
        await db.addGpsTrack(
          currentVisitId,
          location.coords.latitude,
          location.coords.longitude,
          location.coords.accuracy || 0
        );
      }
    }
  );
}

export async function stopLocationTracking(): Promise<Location.LocationObject | null> {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
  
  currentVisitId = null;
  
  return await getCurrentLocation();
}

export function isTracking(): boolean {
  return locationSubscription !== null;
}
