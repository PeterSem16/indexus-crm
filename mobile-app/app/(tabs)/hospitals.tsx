import { View, Text, StyleSheet, FlatList, Pressable, TouchableOpacity, ActivityIndicator, Linking, Platform, RefreshControl } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/hooks/useTranslation';
import { useHospitals, Hospital } from '@/hooks/useHospitals';
import { useClinics, Clinic } from '@/hooks/useClinics';
import { useSipStore } from '@/stores/sipStore';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

type ViewTab = 'hospitals' | 'clinics';

interface ListItem {
  id: string;
  name: string;
  subtitle?: string;
  phone?: string;
  email?: string;
  city?: string;
  type: 'hospital' | 'clinic';
  latitude?: string;
  longitude?: string;
  streetNumber?: string;
}

export default function HospitalsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ViewTab>('hospitals');
  const { translations } = useTranslation();
  const { data: hospitals = [], isLoading: hospitalsLoading, error: hospitalsError, refetch: refetchHospitals } = useHospitals();
  const { data: clinics = [], isLoading: clinicsLoading, error: clinicsError, refetch: refetchClinics } = useClinics();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'hospitals') {
      await refetchHospitals();
    } else {
      await refetchClinics();
    }
    setRefreshing(false);
  }, [refetchHospitals, refetchClinics, activeTab]);

  const openMap = (item: ListItem) => {
    if (item.latitude && item.longitude) {
      const lat = item.latitude;
      const lng = item.longitude;
      const label = encodeURIComponent(item.name);
      const url = Platform.select({
        ios: `maps:0,0?q=${label}@${lat},${lng}`,
        android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      });
      if (url) Linking.openURL(url);
    } else if (item.streetNumber && item.city) {
      const address = encodeURIComponent(`${item.streetNumber}, ${item.city}`);
      const url = Platform.select({
        ios: `maps:0,0?q=${address}`,
        android: `geo:0,0?q=${address}`,
      });
      if (url) Linking.openURL(url);
    } else if (item.city) {
      const address = encodeURIComponent(item.city);
      const url = Platform.select({
        ios: `maps:0,0?q=${address}`,
        android: `geo:0,0?q=${address}`,
      });
      if (url) Linking.openURL(url);
    }
  };

  const { registrationState, makeCall } = useSipStore();

  const callItem = (phone: string) => {
    if (registrationState === 'registered') {
      makeCall(phone);
    } else {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const hospitalItems: ListItem[] = useMemo(() => {
    return hospitals.map((h: Hospital) => ({
      id: String(h.id),
      name: h.name,
      subtitle: [h.streetNumber, h.city].filter(Boolean).join(', '),
      phone: h.phone,
      email: h.email,
      city: h.city,
      type: 'hospital' as const,
      latitude: h.latitude,
      longitude: h.longitude,
      streetNumber: h.streetNumber,
    }));
  }, [hospitals]);

  const clinicItems: ListItem[] = useMemo(() => {
    return clinics.map((c: Clinic) => ({
      id: String(c.id),
      name: c.name,
      subtitle: [c.doctorName, c.city].filter(Boolean).join(' · '),
      phone: c.phone,
      email: c.email,
      city: c.city,
      type: 'clinic' as const,
    }));
  }, [clinics]);

  const currentItems = activeTab === 'hospitals' ? hospitalItems : clinicItems;
  const isLoading = activeTab === 'hospitals' ? hospitalsLoading : clinicsLoading;
  const error = activeTab === 'hospitals' ? hospitalsError : clinicsError;

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return currentItems;

    const query = searchQuery.toLowerCase();
    return currentItems.filter((item) =>
      item.name.toLowerCase().includes(query) ||
      (item.subtitle?.toLowerCase() || '').includes(query) ||
      (item.city?.toLowerCase() || '').includes(query) ||
      (item.phone?.toLowerCase() || '').includes(query) ||
      (item.email?.toLowerCase() || '').includes(query)
    );
  }, [currentItems, searchQuery]);

  const navigateToDetail = (itemId: string) => {
    if (activeTab === 'hospitals') {
      router.push(`/hospital/${itemId}`);
    }
  };

  const renderItem = ({ item }: { item: ListItem }) => (
    <Pressable
      onPress={() => navigateToDetail(item.id)}
      testID={`${item.type}-card-${item.id}`}
    >
      <Card style={styles.itemCard}>
        <View style={[styles.itemIcon, item.type === 'clinic' && styles.clinicIcon]}>
          <Ionicons
            name={item.type === 'hospital' ? 'business' : 'medkit'}
            size={24}
            color={item.type === 'hospital' ? Colors.primary : '#10b981'}
          />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          {item.subtitle && (
            <Text style={styles.itemSubtitle} numberOfLines={1}>{item.subtitle}</Text>
          )}
          {item.email && (
            <Text style={styles.itemEmail} numberOfLines={1}>{item.email}</Text>
          )}
        </View>
        <View style={styles.actionButtons}>
          {item.phone && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => callItem(item.phone!)}
              activeOpacity={0.6}
              testID={`button-call-${item.type}-${item.id}`}
            >
              <Ionicons name="call" size={18} color={Colors.primary} />
            </TouchableOpacity>
          )}
          {(item.city || item.streetNumber) && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => openMap(item)}
              activeOpacity={0.6}
              testID={`button-map-${item.type}-${item.id}`}
            >
              <Ionicons name="navigate" size={18} color={Colors.primary} />
            </TouchableOpacity>
          )}
          {item.type === 'hospital' && (
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          )}
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

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'hospitals' && styles.tabActive]}
          onPress={() => { setActiveTab('hospitals'); setSearchQuery(''); }}
          activeOpacity={0.7}
          testID="tab-hospitals"
        >
          <Ionicons name="business" size={16} color={activeTab === 'hospitals' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'hospitals' && styles.tabTextActive]}>
            {translations.hospitals.hospitalsTab || 'Hospitals'}
          </Text>
          <View style={[styles.tabBadge, activeTab === 'hospitals' && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'hospitals' && styles.tabBadgeTextActive]}>
              {hospitals.length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'clinics' && styles.tabActive]}
          onPress={() => { setActiveTab('clinics'); setSearchQuery(''); }}
          activeOpacity={0.7}
          testID="tab-clinics"
        >
          <Ionicons name="medkit" size={16} color={activeTab === 'clinics' ? '#10b981' : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'clinics' && styles.tabTextActive]}>
            {translations.hospitals.clinicsTab || 'Clinics'}
          </Text>
          <View style={[styles.tabBadge, activeTab === 'clinics' && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'clinics' && styles.tabBadgeTextActive]}>
              {clinics.length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
        <Input
          placeholder={activeTab === 'hospitals' ? (translations.hospitals.searchPlaceholder) : (translations.hospitals.searchClinicsPlaceholder || 'Search clinics...')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={styles.searchInput}
          testID="input-search-facilities"
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
            onPress={() => activeTab === 'hospitals' ? refetchHospitals() : refetchClinics()}
          >
            <Text style={styles.retryText}>{translations.hospitals.retryText}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.type}-${item.id}`}
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
              <Ionicons name={activeTab === 'hospitals' ? 'business-outline' : 'medkit-outline'} size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>
                {searchQuery
                  ? translations.hospitals.noResults
                  : (activeTab === 'hospitals' ? translations.hospitals.noHospitals : (translations.hospitals.noClinics || 'No clinics found'))
                }
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
              {filteredItems.length} {activeTab === 'hospitals'
                ? (filteredItems.length === 1 ? translations.hospitals.hospitalCount : translations.hospitals.hospitalsCount)
                : (filteredItems.length === 1 ? (translations.hospitals.clinicCount || 'clinic') : (translations.hospitals.clinicsCount || 'clinics'))
              }
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  tabActive: {
    backgroundColor: Colors.primary + '15',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  tabText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: Colors.primary,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabBadgeTextActive: {
    color: Colors.white,
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
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  clinicIcon: {
    backgroundColor: '#ecfdf5',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  itemSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemEmail: {
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
