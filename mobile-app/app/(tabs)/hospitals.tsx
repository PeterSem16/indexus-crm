import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/hooks/useTranslation';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

interface Hospital {
  id: string;
  name: string;
  city: string;
  address: string;
  contactPerson?: string;
}

export default function HospitalsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const { translations } = useTranslation();

  const hospitals: Hospital[] = [
    { id: '1', name: 'FN Bratislava', city: 'Bratislava', address: 'Antolská 11', contactPerson: 'Dr. Novak' },
    { id: '2', name: 'NsP Trnava', city: 'Trnava', address: 'A. Žarnova 11', contactPerson: 'Dr. Kováč' },
    { id: '3', name: 'Nemocnica sv. Michala', city: 'Bratislava', address: 'Satinského 1' },
    { id: '4', name: 'FN Košice', city: 'Košice', address: 'Trieda SNP 1', contactPerson: 'Dr. Horváth' },
    { id: '5', name: 'NsP Nitra', city: 'Nitra', address: 'Špitálska 6' },
  ];

  const filteredHospitals = hospitals.filter(
    (h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderHospital = ({ item }: { item: Hospital }) => (
    <TouchableOpacity testID={`card-hospital-${item.id}`}>
      <Card style={styles.hospitalCard}>
        <View style={styles.hospitalIcon}>
          <Ionicons name="business" size={24} color={Colors.primary} />
        </View>
        <View style={styles.hospitalInfo}>
          <Text style={styles.hospitalName}>{item.name}</Text>
          <Text style={styles.hospitalAddress}>{item.address}, {item.city}</Text>
          {item.contactPerson && (
            <Text style={styles.hospitalContact}>{item.contactPerson}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.navigateButton}>
          <Ionicons name="navigate" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{translations.hospitals.title}</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
        <Input
          placeholder={translations.common.search}
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={styles.searchInput}
          testID="input-search-hospitals"
        />
      </View>

      <FlatList
        data={filteredHospitals}
        renderItem={renderHospital}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>{translations.hospitals.noHospitals}</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} testID="button-add-hospital">
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>
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
  listContent: {
    padding: Spacing.md,
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
  },
  hospitalContact: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    marginTop: Spacing.xs,
  },
  navigateButton: {
    padding: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});
