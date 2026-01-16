import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useTranslation } from '@/hooks/useTranslation';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

type ViewMode = 'calendar' | 'list';

export default function VisitsScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const { translations } = useTranslation();

  const visits = [
    { id: '1', time: '09:00', hospital: 'FN Bratislava', type: 'Delivery', status: 'completed' },
    { id: '2', time: '14:00', hospital: 'NsP Trnava', type: 'Contract', status: 'scheduled' },
    { id: '3', time: '16:30', hospital: 'Nemocnica Košice', type: 'Follow-up', status: 'scheduled' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{translations.visits.title}</Text>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'calendar' && styles.toggleButtonActive]}
            onPress={() => setViewMode('calendar')}
          >
            <Ionicons 
              name="calendar" 
              size={18} 
              color={viewMode === 'calendar' ? Colors.white : Colors.textSecondary} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons 
              name="list" 
              size={18} 
              color={viewMode === 'list' ? Colors.white : Colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.dateHeader}>January 16, 2026</Text>

        {visits.map((visit) => (
          <Link key={visit.id} href={`/visit/${visit.id}`} asChild>
            <TouchableOpacity>
              <Card style={styles.visitCard}>
                <View style={styles.visitLeft}>
                  <View style={[
                    styles.statusDot,
                    visit.status === 'completed' && styles.statusCompleted,
                    visit.status === 'scheduled' && styles.statusScheduled,
                  ]} />
                  <Text style={styles.visitTime}>{visit.time}</Text>
                </View>
                <View style={styles.visitInfo}>
                  <Text style={styles.visitHospital}>{visit.hospital}</Text>
                  <Text style={styles.visitType}>{visit.type}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </Card>
            </TouchableOpacity>
          </Link>
        ))}
      </ScrollView>

      <Link href="/visit/new" asChild>
        <TouchableOpacity style={styles.fab} testID="button-new-visit">
          <Ionicons name="add" size={28} color={Colors.white} />
        </TouchableOpacity>
      </Link>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    padding: Spacing.sm,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  dateHeader: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  visitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  visitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  statusCompleted: {
    backgroundColor: Colors.success,
  },
  statusScheduled: {
    backgroundColor: Colors.info,
  },
  visitTime: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  visitInfo: {
    flex: 1,
  },
  visitHospital: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  visitType: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
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
