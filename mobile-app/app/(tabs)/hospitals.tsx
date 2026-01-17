import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Linking, Platform, RefreshControl, ScrollView } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/hooks/useTranslation';
import { useHospitals } from '@/hooks/useHospitals';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

interface Hospital {
  id: string;
  name: string;
  city?: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  latitude?: string;
  longitude?: string;
  countryCode?: string;
}

const COUNTRY_TABS = [
  { code: 'ALL', label: 'Všetky', flag: '' },
  { code: 'SK', label: 'Slovensko', flag: 'SK' },
  { code: 'CZ', label: 'Česko', flag: 'CZ' },
  { code: 'HU', label: 'Maďarsko', flag: 'HU' },
  { code: 'RO', label: 'Rumunsko', flag: 'RO' },
  { code: 'IT', label: 'Taliansko', flag: 'IT' },
  { code: 'DE', label: 'Nemecko', flag: 'DE' },
  { code: 'US', label: 'USA', flag: 'US' },
];

export default function HospitalsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('ALL');
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
    } else if (hospital.address && hospital.city) {
      const address = encodeURIComponent(`${hospital.address}, ${hospital.city}`);
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

  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: hospitals.length };
    hospitals.forEach((h) => {
      const code = h.countryCode || 'UNKNOWN';
      counts[code] = (counts[code] || 0) + 1;
    });
    return counts;
  }, [hospitals]);

  const filteredHospitals = useMemo(() => {
    let filtered = hospitals;
    
    if (selectedCountry !== 'ALL') {
      filtered = filtered.filter((h) => h.countryCode === selectedCountry);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((h) =>
        h.name.toLowerCase().includes(query) ||
        (h.city?.toLowerCase() || '').includes(query) ||
        (h.address?.toLowerCase() || '').includes(query) ||
        (h.phone?.toLowerCase() || '').includes(query) ||
        (h.email?.toLowerCase() || '').includes(query)
      );
    }
    
    return filtered;
  }, [hospitals, selectedCountry, searchQuery]);

  const renderCountryTab = (tab: typeof COUNTRY_TABS[0]) => {
    const isActive = selectedCountry === tab.code;
    const count = countryCounts[tab.code] || 0;
    
    return (
      <Pressable
        key={tab.code}
        style={[styles.countryTab, isActive && styles.countryTabActive]}
        onPress={() => setSelectedCountry(tab.code)}
        android_ripple={{ color: Colors.border }}
        testID={`tab-country-${tab.code}`}
      >
        <Text style={[styles.countryTabText, isActive && styles.countryTabTextActive]}>
          {tab.flag ? `${tab.flag} ` : ''}{tab.code === 'ALL' ? 'Všetky' : tab.code}
        </Text>
        <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
          <Text style={[styles.countBadgeText, isActive && styles.countBadgeTextActive]}>
            {count}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderHospital = ({ item }: { item: Hospital }) => (
    <Card style={styles.hospitalCard}>
      <View style={styles.hospitalIcon}>
        <Ionicons name="business" size={24} color={Colors.primary} />
      </View>
      <View style={styles.hospitalInfo}>
        <View style={styles.hospitalHeader}>
          <Text style={styles.hospitalName} numberOfLines={2}>{item.name}</Text>
          {item.countryCode && (
            <View style={styles.countryBadge}>
              <Text style={styles.countryBadgeText}>{item.countryCode}</Text>
            </View>
          )}
        </View>
        {(item.address || item.city) && (
          <Text style={styles.hospitalAddress} numberOfLines={1}>
            {[item.address, item.city].filter(Boolean).join(', ')}
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
            onPress={() => callHospital(item.phone!)}
            android_ripple={{ color: Colors.border }}
          >
            <Ionicons name="call" size={18} color={Colors.primary} />
          </Pressable>
        )}
        <Pressable 
          style={styles.actionButton}
          onPress={() => openMap(item)}
          android_ripple={{ color: Colors.border }}
        >
          <Ionicons name="navigate" size={18} color={Colors.primary} />
        </Pressable>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{translations.hospitals.title}</Text>
      </View>

      <View style={styles.tabsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {COUNTRY_TABS.map(renderCountryTab)}
        </ScrollView>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
        <Input
          placeholder="Hľadať podľa názvu, mesta, adresy..."
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
          <Text style={styles.loadingText}>Načítavam nemocnice...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.emptyText}>Chyba pri načítavaní</Text>
          <Pressable 
            style={styles.retryButton}
            onPress={() => refetch()}
          >
            <Text style={styles.retryText}>Skúsiť znova</Text>
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
                {searchQuery ? 'Žiadne výsledky' : translations.hospitals.noHospitals}
              </Text>
              {searchQuery && (
                <Pressable 
                  style={styles.clearSearchButton}
                  onPress={() => setSearchQuery('')}
                >
                  <Text style={styles.clearSearchText}>Vymazať filter</Text>
                </Pressable>
              )}
            </View>
          }
          ListHeaderComponent={
            <Text style={styles.countText}>
              {filteredHospitals.length} {filteredHospitals.length === 1 ? 'nemocnica' : 'nemocníc'}
              {selectedCountry !== 'ALL' && ` v ${selectedCountry}`}
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
  tabsContainer: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabsContent: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  countryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    marginRight: Spacing.xs,
  },
  countryTabActive: {
    backgroundColor: Colors.primary,
  },
  countryTabText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.text,
  },
  countryTabTextActive: {
    color: Colors.white,
  },
  countBadge: {
    marginLeft: Spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: Colors.border,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  countBadgeTextActive: {
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
  hospitalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  hospitalName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.xs,
  },
  countryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.surface,
  },
  countryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
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
