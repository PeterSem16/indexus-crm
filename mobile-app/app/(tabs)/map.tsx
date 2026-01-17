import { View, Text, StyleSheet, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTranslation } from '@/hooks/useTranslation';
import { useHospitals } from '@/hooks/useHospitals';
import { useVisits } from '@/hooks/useVisits';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

const { width, height } = Dimensions.get('window');

const INITIAL_REGION = {
  latitude: 48.7164,
  longitude: 21.2611,
  latitudeDelta: 2,
  longitudeDelta: 2,
};

export default function MapScreen() {
  const { translations } = useTranslation();
  const { data: hospitals = [], isLoading: hospitalsLoading } = useHospitals();
  const { data: visits = [], isLoading: visitsLoading } = useVisits();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied');
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        setLocationError('Failed to get location');
      }
    })();
  }, []);

  const getVisitStatus = (hospitalId: string): string | null => {
    const visit = visits.find((v: any) => 
      (v.hospitalId === hospitalId || v.hospital_id === hospitalId) && 
      v.status !== 'cancelled'
    );
    return visit?.status || null;
  };

  const getMarkerColor = (status: string | null) => {
    switch (status) {
      case 'completed': return Colors.success;
      case 'in_progress': return Colors.warning;
      case 'scheduled': return Colors.info;
      default: return Colors.primary;
    }
  };

  const isLoading = hospitalsLoading || visitsLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{translations.navigation.map}</Text>
      </View>

      <View style={styles.mapContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        ) : (
          <MapView
            style={styles.map}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={userLocation ? {
              ...userLocation,
              latitudeDelta: 0.5,
              longitudeDelta: 0.5,
            } : INITIAL_REGION}
            showsUserLocation={true}
            showsMyLocationButton={true}
          >
            {hospitals.map((hospital: any) => {
              if (!hospital.latitude || !hospital.longitude) return null;
              
              const status = getVisitStatus(hospital.id);
              const markerColor = getMarkerColor(status);
              
              return (
                <Marker
                  key={hospital.id}
                  coordinate={{
                    latitude: parseFloat(hospital.latitude),
                    longitude: parseFloat(hospital.longitude),
                  }}
                  title={hospital.name}
                  description={hospital.city || hospital.address}
                  pinColor={markerColor}
                />
              );
            })}
          </MapView>
        )}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.legendText}>Completed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
          <Text style={styles.legendText}>In Progress</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.info }]} />
          <Text style={styles.legendText}>Scheduled</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
          <Text style={styles.legendText}>Hospital</Text>
        </View>
      </View>

      {hospitals.length === 0 && !isLoading && (
        <View style={styles.emptyOverlay}>
          <View style={styles.emptyCard}>
            <Ionicons name="location-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No hospitals with location data</Text>
            <Text style={styles.emptySubtext}>
              Hospitals will appear on the map when they have GPS coordinates
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    width: width,
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.xs,
  },
  legendText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginTop: 60,
    marginBottom: 60,
  },
  emptyCard: {
    backgroundColor: Colors.white,
    padding: Spacing.xl,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginHorizontal: Spacing.lg,
  },
  emptyText: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
});
