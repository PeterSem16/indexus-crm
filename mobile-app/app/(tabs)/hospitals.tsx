import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Linking, Platform, RefreshControl } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/hooks/useTranslation';
import { useHospitals, Hospital } from '@/hooks/useHospitals';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

export default function HospitalsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const { translations } = useTranslation();
  const { data: hospitals = [], isLoading, error, refetch } = useHospitals();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const openMap = (hospital: Hospital) => {
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

  const callHospital = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const filteredHospitals = useMemo(() => {
    if (!searchQuery.trim()) return hospitals;
    
    const query = searchQuery.toLowerCase();
    return hospitals.filter((h) =>
      h.name.toLowerCase().includes(query) ||
      (h.city?.toLowerCase() || '').includes(query) ||
      (h.streetNumber?.toLowerCase() || '').includes(query) ||
      (h.region?.toLowerCase() || '').includes(query) ||
      (h.phone?.toLowerCase() || '').includes(query) ||
      (h.email?.toLowerCase() || '').includes(query)
    );
  }, [hospitals, searchQuery]);

  const navigateToDetail = (hospitalId: string) => {
    router.push(`/hospital/${hospitalId}`);
  };

  const renderHospital = ({ item }: { item: Hospital }) => (
    <Pressable 
      onPress={() => navigateToDetail(String(item.id))}
      testID={`hospital-card-${item.id}`}
    >
      <Card style={styles.hospitalCard}>
        <View style={styles.hospitalIcon}>
          <Ionicons name="business" size={24} color={Colors.primary} />
        </View>
        <View style={styles.hospitalInfo}>
          <Text style={styles.hospitalName} numberOfLines={2}>{item.name}</Text>
          {(item.streetNumber || item.city) && (
            <Text style={styles.hospitalAddress} numberOfLines={1}>
              {[item.streetNumber, item.city].filter(Boolean).join(', ')}
            </Text>
          )}
          {item.email && (
            <Text style={styles.hospitalEmail} numberOfLines={1}>{item.email}</Text>
          )}
        </View>
        <View style={styles.actionButtons}>
          {item.phone && (
            <Pressable 
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                callHospital(item.phone!);
              }}
              android_ripple={{ color: Colors.border }}
            >
              <Ionicons name="call" size={18} color={Colors.primary} />
            </Pressable>
          )}
          <Pressable 
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              openMap(item);
            }}
            android_ripple={{ color: Colors.border }}
          >
            <Ionicons name="navigate" size={18} color={Colors.primary} />
          </Pressable>
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
        </View>
      </Card>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{translations.hospitals.title}</Text>
        <Text style={styles.subtitle}>{translations.hospitals.subtitle}</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
        <Input
          placeholder={translations.hospitals.searchPlaceholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={styles.searchInput}
          testID="input-search-hospitals"
        />
        {searchQuery.length > 0 && (
          <Pressable 
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}
          >
            <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{translations.hospitals.loadingHospitals}</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.emptyText}>{translations.hospitals.loadError}</Text>
          <Pressable 
            style={styles.retryButton}
            onPress={() => refetch()}
          >
            <Text style={styles.retryText}>{translations.hospitals.retryText}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredHospitals}
          renderItem={renderHospital}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>
                {searchQuery ? translations.hospitals.noResults : translations.hospitals.noHospitals}
              </Text>
              {searchQuery && (
                <Pressable 
                  style={styles.clearSearchButton}
                  onPress={() => setSearchQuery('')}
                >
                  <Text style={styles.clearSearchText}>{translations.hospitals.clearFilter}</Text>
                </Pressable>
              )}
            </View>
          }
          ListHeaderComponent={
            <Text style={styles.countText}>
              {filteredHospitals.length} {filteredHospitals.length === 1 ? translations.hospitals.hospitalCount : translations.hospitals.hospitalsCount}
            </Text>
          }
        />
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
  subtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.white,
  },
  searchIcon: {
    position: 'absolute',
    left: Spacing.xl,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  clearButton: {
    position: 'absolute',
    right: Spacing.xl,
    zIndex: 1,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  hospitalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  hospitalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  hospitalInfo: {
    flex: 1,
  },
  hospitalName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  hospitalAddress: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  hospitalEmail: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionButton: {
    padding: Spacing.sm,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    flex: 1,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  retryButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  clearSearchButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  clearSearchText: {
    color: Colors.primary,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  countText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
});
