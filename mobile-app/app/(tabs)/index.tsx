import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useVisits } from '@/hooks/useVisits';
import { useSyncStore } from '@/stores/syncStore';
import { syncAll } from '@/lib/sync';
import { Colors, Spacing, FontSizes } from '@/constants/colors';

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const { translations, language } = useTranslation();
  const { pendingCount, isOnline, isSyncing } = useSyncStore();
  const { data: visits, isLoading: visitsLoading, refetch: refetchVisits } = useVisits();

  const onRefresh = async () => {
    setRefreshing(true);
    await syncAll();
    await refetchVisits();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    const greetings: Record<string, { morning: string; day: string; evening: string }> = {
      sk: { morning: 'Dobré ráno', day: 'Dobrý deň', evening: 'Dobrý večer' },
      cs: { morning: 'Dobré ráno', day: 'Dobrý den', evening: 'Dobrý večer' },
      hu: { morning: 'Jó reggelt', day: 'Jó napot', evening: 'Jó estét' },
      de: { morning: 'Guten Morgen', day: 'Guten Tag', evening: 'Guten Abend' },
      it: { morning: 'Buongiorno', day: 'Buon pomeriggio', evening: 'Buonasera' },
      ro: { morning: 'Bună dimineața', day: 'Bună ziua', evening: 'Bună seara' },
      en: { morning: 'Good morning', day: 'Good afternoon', evening: 'Good evening' },
    };
    const lang = greetings[language] || greetings.en;
    if (hour < 12) return lang.morning;
    if (hour < 18) return lang.day;
    return lang.evening;
  };

  const todayVisits = visits?.filter((v: any) => {
    const visitDate = new Date(v.scheduledStart || v.scheduled_start).toDateString();
    return visitDate === new Date().toDateString();
  }) || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}, {user?.firstName}!</Text>
          {!isOnline && (
            <View style={styles.offlineIndicator}>
              <Ionicons name="cloud-offline" size={14} color={Colors.warning} />
              <Text style={styles.offlineText}>{translations.common.offline}</Text>
            </View>
          )}
        </View>
        {pendingCount > 0 && (
          <View style={styles.syncBadge}>
            <Ionicons name="sync" size={14} color={Colors.white} />
            <Text style={styles.syncBadgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.sectionTitle}>{translations.visits.today}</Text>
        
        {visitsLoading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : todayVisits.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>{translations.visits.noVisits}</Text>
          </Card>
        ) : (
          todayVisits.map((visit: any) => (
            <Link key={visit.id} href={`/visit/${visit.id}`} asChild>
              <TouchableOpacity>
                <Card style={styles.visitCard}>
                  <View style={styles.visitTime}>
                    <Text style={styles.visitTimeText}>
                      {new Date(visit.scheduledStart || visit.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={styles.visitInfo}>
                    <Text style={styles.visitHospital}>{visit.hospitalName || visit.hospital_name}</Text>
                    <Text style={styles.visitType}>{visit.visitType || visit.visit_type}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </Card>
              </TouchableOpacity>
            </Link>
          ))
        )}

        <Text style={styles.sectionTitle}>{translations.profile.settings}</Text>
        
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{visits?.length || 0}</Text>
            <Text style={styles.statLabel}>{translations.navigation.visits}</Text>
          </Card>
          <Card style={styles.statCard}>
            {isSyncing ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Text style={styles.statNumber}>{pendingCount}</Text>
            )}
            <Text style={styles.statLabel}>{translations.common.pendingSync}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{todayVisits.length}</Text>
            <Text style={styles.statLabel}>{translations.visits.today}</Text>
          </Card>
        </View>
      </ScrollView>
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
  greeting: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  offlineText: {
    fontSize: FontSizes.xs,
    color: Colors.warning,
    marginLeft: Spacing.xs,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  syncBadgeText: {
    color: Colors.white,
    fontSize: FontSizes.xs,
    marginLeft: Spacing.xs,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  visitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  visitTime: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 4,
    marginRight: Spacing.md,
  },
  visitTimeText: {
    color: Colors.white,
    fontSize: FontSizes.sm,
    fontWeight: '600',
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
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
  },
  statNumber: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    textAlign: 'center',
  },
  statSubtext: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  emptyCard: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
  },
});
