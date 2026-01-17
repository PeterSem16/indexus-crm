import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { useTranslation } from '@/hooks/useTranslation';
import { useHospitals } from '@/hooks/useHospitals';
import { useVisits } from '@/hooks/useVisits';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

const { width } = Dimensions.get('window');

const INITIAL_COORDS = {
  latitude: 48.7164,
  longitude: 21.2611,
};

export default function MapScreen() {
  const { translations } = useTranslation();
  const { data: hospitals = [], isLoading: hospitalsLoading } = useHospitals();
  const { data: visits = [], isLoading: visitsLoading } = useVisits();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError(translations.map.locationPermissionDenied);
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
        console.log('Location error:', error);
        setLocationError(translations.map.failedToGetLocation);
      }
    })();
  }, [translations.map.locationPermissionDenied, translations.map.failedToGetLocation]);

  const getVisitStatus = (hospitalId: string): string | null => {
    const visit = visits.find((v: any) => 
      (String(v.hospitalId) === String(hospitalId) || String(v.hospital_id) === String(hospitalId)) && 
      v.status !== 'cancelled'
    );
    return visit?.status || null;
  };

  const getMarkerColor = (status: string | null) => {
    switch (status) {
      case 'completed': return '#22C55E';
      case 'in_progress': return '#F59E0B';
      case 'scheduled': return '#3B82F6';
      default: return '#6B1C3B';
    }
  };

  const isLoading = hospitalsLoading || visitsLoading;

  const centerLat = userLocation?.latitude || INITIAL_COORDS.latitude;
  const centerLng = userLocation?.longitude || INITIAL_COORDS.longitude;

  const hospitalsWithCoords = hospitals.filter((h: any) => h.latitude && h.longitude);

  const markersJson = JSON.stringify(hospitalsWithCoords.map((hospital: any) => ({
    id: String(hospital.id),
    lat: parseFloat(hospital.latitude),
    lng: parseFloat(hospital.longitude),
    name: hospital.name || translations.map.hospital,
    city: hospital.city || '',
    color: getMarkerColor(getVisitStatus(String(hospital.id))),
  })));

  const leafletHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; padding: 0; }
    #map { width: 100%; height: 100vh; }
    .custom-marker {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .user-marker {
      width: 16px;
      height: 16px;
      background-color: #4285F4;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${centerLat}, ${centerLng}], 8);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '${translations.map.mapAttribution}',
      maxZoom: 19
    }).addTo(map);

    // User location marker
    ${userLocation ? `
    var userIcon = L.divIcon({
      className: 'user-marker-container',
      html: '<div class="user-marker"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    L.marker([${userLocation.latitude}, ${userLocation.longitude}], { icon: userIcon })
      .addTo(map)
      .bindPopup('${translations.map.yourLocation}');
    ` : ''}

    // Hospital markers
    var markers = ${markersJson};
    markers.forEach(function(m) {
      var icon = L.divIcon({
        className: 'marker-container',
        html: '<div class="custom-marker" style="background-color: ' + m.color + ';"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      L.marker([m.lat, m.lng], { icon: icon })
        .addTo(map)
        .bindPopup('<strong>' + m.name + '</strong>' + (m.city ? '<br/>' + m.city : ''));
    });

    // Fit bounds if we have markers
    if (markers.length > 0) {
      var bounds = L.latLngBounds(markers.map(function(m) { return [m.lat, m.lng]; }));
      ${userLocation ? `bounds.extend([${userLocation.latitude}, ${userLocation.longitude}]);` : ''}
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  </script>
</body>
</html>
`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{translations.navigation.map}</Text>
      </View>

      <View style={styles.mapContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>{translations.map.loadingMap}</Text>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: leafletHtml }}
            style={styles.map}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            onLoadEnd={() => setMapReady(true)}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            )}
          />
        )}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.legendText}>{translations.map.completed}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
          <Text style={styles.legendText}>{translations.map.inProgress}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.info }]} />
          <Text style={styles.legendText}>{translations.map.scheduled}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
          <Text style={styles.legendText}>{translations.map.hospital}</Text>
        </View>
      </View>

      {hospitalsWithCoords.length === 0 && !isLoading && (
        <View style={styles.emptyOverlay}>
          <View style={styles.emptyCard}>
            <Ionicons name="location-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>{translations.map.noHospitalsWithLocation}</Text>
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
