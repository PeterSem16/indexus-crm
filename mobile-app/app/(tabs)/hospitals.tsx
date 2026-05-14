import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Linking, Platform, RefreshControl } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/hooks/useTranslation';
import { useHospitals, Hospital } from '@/hooks/useHospitals';
import { useClinics, Clinic } from '@/hooks/useClinics';
import { useSipStore } from '@/stores/sipStore';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

type ViewTab = 'hospitals' | 'clinics';

interface ListItem {
  id: string;
  type: 'hospital' | 'clinic';
  name: string;
  fullName?: string;
  doctorName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  city?: string;
  streetNumber?: string;
  postalCode?: string;
  latitude?: string;
  longitude?: string;
}

function FieldRow({ label, value, color }: { label: string; value?: string | null; color?: string }) {
  if (!value) return null;
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, color ? { color } : null]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function HospitalsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ViewTab>('hospitals');
  const { translations } = useTranslation();
  const { data: hospitals = [], isLoading: hospitalsLoading, error: hospitalsError, refetch: refetchHospitals } = useHospitals();
  const { data: clinics = [], isLoading: clinicsLoading, error: clinicsError, refetch: refetchClinics } = useClinics();
  const [refreshing, setRefreshing] = useState(false);
  const { registrationState, makeCall } = useSipStore();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'hospitals') await refetchHospitals();
    else await refetchClinics();
    setRefreshing(false);
  }, [refetchHospitals, refetchClinics, activeTab]);

  const openMap = (item: ListItem) => {
    if (item.latitude && item.longitude) {
      const label = encodeURIComponent(item.name);
      const url = Platform.select({
        ios: `maps:0,0?q=${label}@${item.latitude},${item.longitude}`,
        android: `geo:${item.latitude},${item.longitude}?q=${item.latitude},${item.longitude}(${label})`,
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
      const url = Platform.select({
        ios: `maps:0,0?q=${encodeURIComponent(item.city)}`,
        android: `geo:0,0?q=${encodeURIComponent(item.city)}`,
      });
      if (url) Linking.openURL(url);
    }
  };

  const callItem = (phone: string) => {
    if (registrationState === 'registered') makeCall(phone);
    else Linking.openURL(`tel:${phone}`);
  };

  const hospitalItems: ListItem[] = useMemo(() => hospitals.map((h: Hospital) => ({
    id: String(h.id),
    type: 'hospital' as const,
    name: h.name,
    fullName: h.fullName,
    contactPerson: h.contactPerson,
    phone: h.phone,
    email: h.email,
    city: h.city,
    streetNumber: h.streetNumber,
    postalCode: h.postalCode,
    latitude: h.latitude,
    longitude: h.longitude,
  })), [hospitals]);

  const clinicItems: ListItem[] = useMemo(() => clinics.map((c: Clinic) => ({
    id: String(c.id),
    type: 'clinic' as const,
    name: c.name,
    doctorName: [c.doctorTitle, c.doctorFirstName, c.doctorLastName].filter(Boolean).join(' ') || c.doctorName,
    phone: c.phone,
    email: c.email,
    city: c.city,
    streetNumber: c.streetNumber,
    postalCode: c.postalCode,
    latitude: c.latitude ?? undefined,
    longitude: c.longitude ?? undefined,
  })), [clinics]);

  const currentItems = activeTab === 'hospitals' ? hospitalItems : clinicItems;
  const isLoading = activeTab === 'hospitals' ? hospitalsLoading : clinicsLoading;
  const error = activeTab === 'hospitals' ? hospitalsError : clinicsError;

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return currentItems;
    const q = searchQuery.toLowerCase();
    return currentItems.filter(item =>
      item.name.toLowerCase().includes(q) ||
      (item.doctorName?.toLowerCase() || '').includes(q) ||
      (item.contactPerson?.toLowerCase() || '').includes(q) ||
      (item.city?.toLowerCase() || '').includes(q) ||
      (item.phone?.toLowerCase() || '').includes(q) ||
      (item.email?.toLowerCase() || '').includes(q)
    );
  }, [currentItems, searchQuery]);

  const navigateToDetail = (itemId: string) => {
    if (activeTab === 'hospitals') router.push(`/hospital/${itemId}`);
    else router.push(`/clinic/${itemId}`);
  };

  const isClinic = activeTab === 'clinics';
  const accentColor = isClinic ? '#10b981' : Colors.primary;

  const renderItem = ({ item }: { item: ListItem }) => {
    const addressParts = [item.streetNumber, item.postalCode ? `${item.postalCode} ${item.city || ''}`.trim() : item.city].filter(Boolean);
    const address = addressParts.join(', ');

    return (
      <TouchableOpacity
        onPress={() => navigateToDetail(item.id)}
        activeOpacity={0.7}
        testID={`${item.type}-card-${item.id}`}
        style={styles.card}
      >
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconBadge, { backgroundColor: isClinic ? 'rgba(16,185,129,0.1)' : `${Colors.primary}12` }]}>
            <Ionicons
              name={isClinic ? 'medkit' : 'business'}
              size={18}
              color={accentColor}
            />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
            {item.fullName && item.fullName !== item.name && (
              <Text style={styles.cardFullName} numberOfLines={1}>{item.fullName}</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
        </View>

        {/* Separator */}
        <View style={styles.cardDivider} />

        {/* Labeled fields */}
        <View style={styles.cardFields}>
          {isClinic && item.doctorName ? (
            <FieldRow label="LEKÁR" value={item.doctorName} />
          ) : item.contactPerson ? (
            <FieldRow label="KONTAKT" value={item.contactPerson} />
          ) : null}
          <FieldRow label="TELEFÓN" value={item.phone} color={accentColor} />
          <FieldRow label="EMAIL" value={item.email} />
          {address ? <FieldRow label="ADRESA" value={address} /> : null}
        </View>

        {/* Action buttons */}
        {(item.phone || item.city || item.streetNumber) && (
          <View style={styles.cardActions}>
            {item.phone && (
              <TouchableOpacity
                style={[styles.cardActionBtn, { borderColor: accentColor }]}
                onPress={(e) => { e.stopPropagation(); callItem(item.phone!); }}
                testID={`button-call-${item.type}-${item.id}`}
              >
                <Ionicons name="call" size={14} color={accentColor} />
                <Text style={[styles.cardActionText, { color: accentColor }]}>Zavolať</Text>
              </TouchableOpacity>
            )}
            {(item.city || item.streetNumber) && (
              <TouchableOpacity
                style={[styles.cardActionBtn, { borderColor: '#94A3B8' }]}
                onPress={(e) => { e.stopPropagation(); openMap(item); }}
                testID={`button-map-${item.type}-${item.id}`}
              >
                <Ionicons name="navigate" size={14} color={Colors.textSecondary} />
                <Text style={[styles.cardActionText, { color: Colors.textSecondary }]}>Navigovať</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

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
          style={[styles.tab, activeTab === 'clinics' && styles.tabActiveClinic]}
          onPress={() => { setActiveTab('clinics'); setSearchQuery(''); }}
          activeOpacity={0.7}
          testID="tab-clinics"
        >
          <Ionicons name="medkit" size={16} color={activeTab === 'clinics' ? '#10b981' : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'clinics' && styles.tabTextClinic]}>
            {translations.hospitals.clinicsTab || 'Clinics'}
          </Text>
          <View style={[styles.tabBadge, activeTab === 'clinics' && styles.tabBadgeClinic]}>
            <Text style={[styles.tabBadgeText, activeTab === 'clinics' && styles.tabBadgeTextActive]}>
              {clinics.length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} style={styles.searchIcon} />
        <Input
          placeholder={activeTab === 'hospitals'
            ? (translations.hospitals.searchPlaceholder)
            : (translations.hospitals.searchClinicsPlaceholder || 'Hľadať ambulanciu...')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          testID="input-search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Načítavam...</Text>
        </View>
      ) : error ? (
        <View style={styles.loadingState}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.loadingText}>Chyba pri načítaní</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => activeTab === 'hospitals' ? refetchHospitals() : refetchClinics()}>
            <Text style={styles.retryText}>Skúsiť znova</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[accentColor]} tintColor={accentColor} />}
          ListHeaderComponent={filteredItems.length > 0 ? (
            <Text style={styles.countText}>{filteredItems.length} záznamov{searchQuery ? ` (filter: "${searchQuery}")` : ''}</Text>
          ) : null}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name={isClinic ? 'medkit-outline' : 'business-outline'} size={56} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Žiadne výsledky' : (isClinic ? 'Žiadne ambulancie' : 'Žiadne nemocnice')}
              </Text>
              {searchQuery ? (
                <TouchableOpacity style={styles.clearSearchButton} onPress={() => setSearchQuery('')}>
                  <Text style={styles.clearSearchText}>Zrušiť filter</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA' },
  header: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm, backgroundColor: Colors.white },
  title: { fontSize: FontSizes.xxl, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },

  tabContainer: { flexDirection: 'row', backgroundColor: Colors.white, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: Spacing.sm, borderRadius: 10, backgroundColor: '#F4F6FA' },
  tabActive: { backgroundColor: `${Colors.primary}15`, borderWidth: 1, borderColor: `${Colors.primary}30` },
  tabActiveClinic: { backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)' },
  tabText: { fontSize: FontSizes.sm, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },
  tabTextClinic: { color: '#10b981', fontWeight: '600' },
  tabBadge: { backgroundColor: Colors.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 22, alignItems: 'center' },
  tabBadgeActive: { backgroundColor: Colors.primary },
  tabBadgeClinic: { backgroundColor: '#10b981' },
  tabBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  tabBadgeTextActive: { color: Colors.white },

  searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: '#EAECF0' },
  searchIcon: { position: 'absolute', left: Spacing.xl + 4, zIndex: 1 },
  searchInput: { flex: 1, marginBottom: 0 },
  clearButton: { position: 'absolute', right: Spacing.xl, zIndex: 1 },

  listContent: { padding: Spacing.md, paddingBottom: 80 },
  countText: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginBottom: Spacing.sm },

  /* Card */
  card: {
    backgroundColor: Colors.white, borderRadius: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  cardIconBadge: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardTitleWrap: { flex: 1 },
  cardName: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  cardFullName: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 1 },
  cardDivider: { height: 1, backgroundColor: '#F0F2F6', marginHorizontal: 12 },

  cardFields: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 4 },
  fieldRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingVertical: 3 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: '#A0A8B4', textTransform: 'uppercase', letterSpacing: 0.4, width: 60, flexShrink: 0 },
  fieldValue: { flex: 1, fontSize: FontSizes.sm, color: Colors.text, fontWeight: '500' },

  cardActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8, paddingTop: 6 },
  cardActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, backgroundColor: 'transparent' },
  cardActionText: { fontSize: 12, fontWeight: '600' },

  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  loadingText: { fontSize: FontSizes.md, color: Colors.textSecondary },
  retryButton: { marginTop: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, backgroundColor: Colors.primary, borderRadius: 8 },
  retryText: { color: Colors.white, fontSize: FontSizes.md, fontWeight: '600' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.md },
  clearSearchButton: { marginTop: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, backgroundColor: Colors.surface, borderRadius: 8 },
  clearSearchText: { color: Colors.primary, fontSize: FontSizes.md, fontWeight: '500' },
});
