import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '@/hooks/useTranslation';
import { useHospitals } from '@/hooks/useHospitals';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

export default function HospitalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { translations } = useTranslation();
  const { data: hospitals = [], isLoading } = useHospitals();
  
  const hospital = hospitals.find(h => String(h.id) === id);

  const openMap = () => {
    if (!hospital) return;
    
    if (hospital.latitude && hospital.longitude) {
      const lat = hospital.latitude;
      const lng = hospital.longitude;
      const label = encodeURIComponent(hospital.name);
      const url = Platform.select({
        ios: `maps:0,0?q=${label}@${lat},${lng}`,
        android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      });
      if (url) Linking.openURL(url);
    } else if (hospital.streetNumber && hospital.city) {
      const address = encodeURIComponent(`${hospital.streetNumber}, ${hospital.city}`);
      const url = Platform.select({
        ios: `maps:0,0?q=${address}`,
        android: `geo:0,0?q=${address}`,
      });
      if (url) Linking.openURL(url);
    }
  };

  const callHospital = () => {
    if (hospital?.phone) {
      Linking.openURL(`tel:${hospital.phone}`);
    }
  };

  const sendEmail = () => {
    if (hospital?.email) {
      Linking.openURL(`mailto:${hospital.email}`);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!hospital) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
          <Text style={styles.errorText}>{translations.hospitals.noResults}</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>{translations.common.back}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const formatAddress = () => {
    const parts = [
      hospital.streetNumber,
      hospital.postalCode,
      hospital.city,
      hospital.region,
    ].filter(Boolean);
    return parts.join(', ') || translations.hospitals.noData;
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={styles.headerButton}
              testID="button-back"
            >
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {translations.hospitals.details}
            </Text>
            <View style={styles.headerButton} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hospitalHeader}>
          <View style={styles.hospitalIconContainer}>
            <Ionicons name="business" size={32} color={Colors.primary} />
          </View>
          <View style={styles.hospitalTitleSection}>
            <Text style={styles.hospitalName} numberOfLines={2}>{hospital.name}</Text>
            {hospital.fullName && hospital.fullName !== hospital.name && (
              <Text style={styles.hospitalFullName} numberOfLines={2}>{hospital.fullName}</Text>
            )}
            <View style={[
              styles.statusBadge,
              { backgroundColor: hospital.isActive !== false ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)' }
            ]}>
              <Ionicons 
                name={hospital.isActive !== false ? "checkmark-circle" : "close-circle"} 
                size={14} 
                color={hospital.isActive !== false ? Colors.success : Colors.error} 
              />
              <Text style={[
                styles.statusText,
                { color: hospital.isActive !== false ? Colors.success : Colors.error }
              ]}>
                {hospital.isActive !== false ? translations.hospitals.activeHospital : translations.hospitals.inactiveHospital}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {hospital.phone && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={callHospital}
              testID="button-call"
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="call" size={20} color={Colors.white} />
                <Text style={styles.actionButtonText}>{translations.hospitals.callHospital}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {hospital.email && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={sendEmail}
              testID="button-email"
            >
              <View style={styles.actionButtonOutline}>
                <Ionicons name="mail" size={20} color={Colors.primary} />
                <Text style={styles.actionButtonTextOutline}>{translations.hospitals.sendEmail}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>{translations.hospitals.basicInfo}</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="business-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.infoLabelText}>{translations.hospitals.name}</Text>
            </View>
            <Text style={styles.infoValue}>{hospital.name}</Text>
          </View>
          
          {hospital.fullName && (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Ionicons name="document-text-outline" size={18} color={Colors.textSecondary} />
                  <Text style={styles.infoLabelText}>{translations.hospitals.fullName}</Text>
                </View>
                <Text style={styles.infoValue}>{hospital.fullName}</Text>
              </View>
            </>
          )}

          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="flag-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.infoLabelText}>{translations.hospitals.country}</Text>
            </View>
            <Text style={styles.infoValue}>{hospital.countryCode || translations.hospitals.noData}</Text>
          </View>

          {hospital.region && (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Ionicons name="map-outline" size={18} color={Colors.textSecondary} />
                  <Text style={styles.infoLabelText}>{translations.hospitals.region}</Text>
                </View>
                <Text style={styles.infoValue}>{hospital.region}</Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>{translations.hospitals.locationInfo}</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="location-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.infoLabelText}>{translations.hospitals.address}</Text>
            </View>
            <Text style={styles.infoValue}>{formatAddress()}</Text>
          </View>

          {(hospital.latitude && hospital.longitude) && (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Ionicons name="navigate-outline" size={18} color={Colors.textSecondary} />
                  <Text style={styles.infoLabelText}>{translations.hospitals.coordinates}</Text>
                </View>
                <Text style={styles.infoValue}>{hospital.latitude}, {hospital.longitude}</Text>
              </View>
            </>
          )}

          <TouchableOpacity 
            style={styles.mapButton}
            onPress={openMap}
            testID="button-navigate"
          >
            <Ionicons name="navigate" size={18} color={Colors.primary} />
            <Text style={styles.mapButtonText}>{translations.hospitals.navigateToHospital}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>{translations.hospitals.contactInfo}</Text>
        <View style={styles.infoCard}>
          {hospital.contactPerson && (
            <>
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Ionicons name="person-outline" size={18} color={Colors.textSecondary} />
                  <Text style={styles.infoLabelText}>{translations.hospitals.contactPerson}</Text>
                </View>
                <Text style={styles.infoValue}>{hospital.contactPerson}</Text>
              </View>
              <View style={styles.infoDivider} />
            </>
          )}

          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="call-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.infoLabelText}>{translations.hospitals.phone}</Text>
            </View>
            <Text style={styles.infoValue}>{hospital.phone || translations.hospitals.noData}</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="mail-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.infoLabelText}>{translations.hospitals.email}</Text>
            </View>
            <Text style={styles.infoValue}>{hospital.email || translations.hospitals.noData}</Text>
          </View>
        </View>

        <View style={styles.footerSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    fontSize: FontSizes.lg,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  backButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  headerGradient: {
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
  },
  hospitalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  hospitalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(107, 28, 59, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  hospitalTitleSection: {
    flex: 1,
  },
  hospitalName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  hospitalFullName: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  actionButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.white,
  },
  actionButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  actionButtonTextOutline: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: Spacing.md,
  },
  infoRow: {
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  infoLabelText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: FontSizes.md,
    color: Colors.text,
    fontWeight: '500',
    marginLeft: 26,
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(107, 28, 59, 0.1)',
    borderRadius: 8,
    gap: Spacing.sm,
  },
  mapButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  footerSpace: {
    height: Spacing.xxl,
  },
});
