import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useVisits } from '@/hooks/useVisits';
import { useSyncStore } from '@/stores/syncStore';
import { syncAll } from '@/lib/sync';
import { Colors, Spacing, FontSizes } from '@/constants/colors';
import { getVisitTypeName } from '@/lib/visitTypes';
import { SupportedLanguage } from '@/constants/config';
import Constants from 'expo-constants';

const APP_VERSION = Constants.expoConfig?.version || '1.1.0';

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const { translations, language: currentLanguage } = useTranslation();
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
    if (hour < 12) return translations.common.goodMorning;
    if (hour < 18) return translations.common.goodAfternoon;
    return translations.common.goodEvening;
  };

  const todayVisits = visits?.filter((v: any) => {
    const visitDate = new Date(v.scheduledStart || v.scheduled_start).toDateString();
    return visitDate === new Date().toDateString();
  }) || [];

  const upcomingVisits = visits?.filter((v: any) => {
    const visitDate = new Date(v.scheduledStart || v.scheduled_start);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return visitDate >= today && v.status !== 'completed';
  }).slice(0, 5) || [];

  const completedVisits = visits?.filter((v: any) => v.status === 'completed') || [];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark, '#2A0515']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Text>
              </View>
              <View style={styles.greetingContainer}>
                <Text style={styles.greeting}>{getGreeting()}</Text>
                <Text style={styles.userName}>{user?.firstName} {user?.lastName}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              {!isOnline && (
                <View style={styles.offlineBadge}>
                  <Ionicons name="cloud-offline" size={16} color={Colors.white} />
                </View>
              )}
              {pendingCount > 0 && (
                <View style={styles.syncBadge}>
                  <Ionicons name="sync" size={14} color={Colors.white} />
                  <Text style={styles.syncBadgeText}>{pendingCount}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{todayVisits.length}</Text>
              <Text style={styles.statLabel}>{translations.visits.today}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{upcomingVisits.length}</Text>
              <Text style={styles.statLabel}>{translations.visits.upcoming}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{completedVisits.length}</Text>
              <Text style={styles.statLabel}>{translations.visits.completed}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{translations.visits.today}</Text>
          <Link href="/visits" asChild>
            <TouchableOpacity style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>{translations.common.viewAll}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </Link>
        </View>

        {visitsLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : todayVisits.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="calendar-outline" size={40} color={Colors.primaryLight} />
            </View>
            <Text style={styles.emptyTitle}>{translations.visits.noVisits}</Text>
            <Text style={styles.emptySubtitle}>{translations.visits.noVisitsToday}</Text>
            <Link href="/visit/new" asChild>
              <TouchableOpacity style={styles.emptyButton}>
                <Ionicons name="add" size={20} color={Colors.white} />
                <Text style={styles.emptyButtonText}>{translations.visits.newVisit}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        ) : (
          todayVisits.map((visit: any, index: number) => (
            <Link key={visit.id} href={`/visit/${visit.id}`} asChild>
              <TouchableOpacity style={styles.visitCard} activeOpacity={0.7}>
                <View style={styles.visitTimeContainer}>
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryDark]}
                    style={styles.visitTimeGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.visitTimeText}>
                      {new Date(visit.scheduledStart || visit.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </LinearGradient>
                </View>
                <View style={styles.visitInfo}>
                  <Text style={styles.visitHospital} numberOfLines={1}>
                    {visit.hospitalName || visit.hospital_name || translations.visits.unknownHospital}
                  </Text>
                  <Text style={styles.visitType} numberOfLines={1}>
                    {getVisitTypeName(visit.visitType || visit.visit_type, currentLanguage as SupportedLanguage) || visit.subject || translations.navigation.visits}
                  </Text>
                </View>
                <View style={styles.visitArrow}>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </View>
              </TouchableOpacity>
            </Link>
          ))
        )}

        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>{translations.common.quickActions}</Text>
          <View style={styles.quickActionsGrid}>
            <Link href="/visit/new" asChild>
              <TouchableOpacity style={styles.quickActionCard}>
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryDark]}
                  style={styles.quickActionIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="add" size={24} color={Colors.white} />
                </LinearGradient>
                <Text style={styles.quickActionLabel}>{translations.visits.newVisit}</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/visits" asChild>
              <TouchableOpacity style={styles.quickActionCard}>
                <LinearGradient
                  colors={[Colors.info, '#1565C0']}
                  style={styles.quickActionIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="calendar" size={24} color={Colors.white} />
                </LinearGradient>
                <Text style={styles.quickActionLabel}>{translations.navigation.visits}</Text>
              </TouchableOpacity>
            </Link>
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={onRefresh}
            >
              <LinearGradient
                colors={[Colors.success, '#2E7D32']}
                style={styles.quickActionIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {isSyncing ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Ionicons name="sync" size={24} color={Colors.white} />
                )}
              </LinearGradient>
              <Text style={styles.quickActionLabel}>{translations.common.sync}</Text>
            </TouchableOpacity>
            <Link href="/profile" asChild>
              <TouchableOpacity style={styles.quickActionCard}>
                <LinearGradient
                  colors={[Colors.secondary, '#B8941F']}
                  style={styles.quickActionIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="person" size={24} color={Colors.white} />
                </LinearGradient>
                <Text style={styles.quickActionLabel}>{translations.profile.title}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>{translations.common.versionPrefix}{APP_VERSION}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerGradient: {
    paddingBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarText: {
    color: Colors.white,
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  greetingContainer: {
    marginLeft: Spacing.md,
  },
  greeting: {
    fontSize: FontSizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  userName: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  offlineBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 152, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 16,
    gap: 4,
  },
  syncBadgeText: {
    color: Colors.white,
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    paddingVertical: Spacing.md,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.white,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '70%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  content: {
    flex: 1,
    marginTop: -Spacing.md,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  loadingCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(107, 28, 59, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 24,
    gap: Spacing.xs,
  },
  emptyButtonText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  visitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  visitTimeContainer: {
    marginRight: Spacing.md,
  },
  visitTimeGradient: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  visitTimeText: {
    color: Colors.white,
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  visitInfo: {
    flex: 1,
  },
  visitHospital: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  visitType: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  visitArrow: {
    marginLeft: Spacing.sm,
  },
  quickActionsSection: {
    marginTop: Spacing.xl,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  quickActionCard: {
    width: '47%',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.md,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  quickActionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  versionContainer: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  versionText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
});
