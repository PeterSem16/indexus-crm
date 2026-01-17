import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { Colors, Spacing, FontSizes } from '@/constants/colors';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '@/constants/config';
import Constants from 'expo-constants';

const APP_VERSION = Constants.expoConfig?.version || '1.1.0';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { translations, language } = useTranslation();
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const notificationsEnabled = useSettingsStore((state) => state.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore((state) => state.setNotificationsEnabled);
  const { lastSyncAt, pendingCount, isOnline } = useSyncStore();

  const handleLogout = () => {
    Alert.alert(
      translations.auth.logout,
      translations.profile.logoutConfirm,
      [
        { text: translations.common.cancel, style: 'cancel' },
        { text: translations.auth.logout, style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleLanguageSelect = () => {
    const options = SUPPORTED_LANGUAGES.map((lang) => ({
      text: `${translations.languageCodes[lang]} - ${translations.languages[lang]}`,
      onPress: () => setLanguage(lang),
    }));
    
    Alert.alert(
      translations.profile.selectLanguage,
      '',
      [...options, { text: translations.common.cancel, style: 'cancel' }]
    );
  };

  const formatLastSync = () => {
    if (!lastSyncAt) return translations.common.never;
    const now = new Date();
    const diff = now.getTime() - lastSyncAt.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return translations.common.justNow;
    if (minutes < 60) return `${minutes} ${translations.common.minutesAgo}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${translations.common.hoursAgo}`;
    return lastSyncAt.toLocaleDateString();
  };

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
            <Text style={styles.headerTitle}>{translations.profile.title}</Text>
          </View>
          
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </Text>
            </View>
            <Text style={styles.userName}>{user?.firstName} {user?.lastName}</Text>
            <View style={styles.countryBadge}>
              <Ionicons name="location" size={14} color={Colors.white} />
              <Text style={styles.countryText}>{user?.countryCode}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.syncStatusCard}>
          <View style={styles.syncStatusHeader}>
            <Ionicons name="cloud" size={20} color={Colors.primary} />
            <Text style={styles.syncStatusTitle}>{translations.profile.syncStatus}</Text>
            <View style={[styles.onlineIndicator, { backgroundColor: isOnline ? Colors.success : Colors.warning }]} />
          </View>
          <View style={styles.syncStatusBody}>
            <View style={styles.syncItem}>
              <Text style={styles.syncLabel}>{translations.profile.lastSync}</Text>
              <Text style={styles.syncValue}>{formatLastSync()}</Text>
            </View>
            <View style={styles.syncDivider} />
            <View style={styles.syncItem}>
              <Text style={styles.syncLabel}>{translations.profile.pending}</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>{pendingCount}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{translations.profile.settings}</Text>
        
        <View style={styles.settingsCard}>
          <TouchableOpacity 
            style={styles.settingsItem} 
            onPress={handleLanguageSelect}
            testID="button-change-language"
          >
            <View style={styles.settingsIconContainer}>
              <Ionicons name="language" size={20} color={Colors.primary} />
            </View>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>{translations.profile.language}</Text>
              <Text style={styles.settingsDescription}>{translations.profile.languageDescription}</Text>
            </View>
            <View style={styles.settingsValueContainer}>
              <Text style={styles.settingsValue}>{translations.languageCodes[language]}</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.settingsItem}>
            <View style={styles.settingsIconContainer}>
              <Ionicons name="notifications" size={20} color={Colors.primary} />
            </View>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>{translations.profile.notifications}</Text>
              <Text style={styles.settingsDescription}>{translations.profile.notificationsDescription}</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={notificationsEnabled ? Colors.primary : Colors.textSecondary}
              testID="switch-notifications"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>{translations.profile.about}</Text>

        <View style={styles.settingsCard}>
          <View style={styles.settingsItem}>
            <View style={styles.settingsIconContainer}>
              <Ionicons name="information-circle" size={20} color={Colors.primary} />
            </View>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>{translations.profile.version}</Text>
              <Text style={styles.settingsDescription}>{translations.common.brandName} {translations.common.appName}</Text>
            </View>
            <Text style={styles.versionNumber}>{translations.common.versionPrefix}{APP_VERSION}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingsItem}>
            <View style={styles.settingsIconContainer}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.success} />
            </View>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>{translations.profile.status}</Text>
              <Text style={styles.settingsDescription}>{translations.profile.accountActive}</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeText}>{translations.common.active}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          testID="button-logout"
        >
          <LinearGradient
            colors={[Colors.error, '#C62828']}
            style={styles.logoutGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="log-out" size={22} color={Colors.white} />
            <Text style={styles.logoutText}>{translations.auth.logout}</Text>
          </LinearGradient>
        </TouchableOpacity>

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
  headerGradient: {
    paddingBottom: Spacing.xl,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: Spacing.md,
  },
  avatarText: {
    color: Colors.white,
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: FontSizes.xl,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  countryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 16,
    gap: Spacing.xs,
  },
  countryText: {
    color: Colors.white,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    marginTop: -Spacing.md,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  syncStatusCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  syncStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  syncStatusTitle: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  syncStatusBody: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  syncItem: {
    alignItems: 'center',
    flex: 1,
  },
  syncLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  syncValue: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  syncDivider: {
    width: 1,
    height: '100%',
    backgroundColor: Colors.border,
  },
  pendingBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  pendingText: {
    color: Colors.white,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  settingsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: Spacing.md,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  settingsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(107, 28, 59, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  settingsContent: {
    flex: 1,
  },
  settingsLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  settingsDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  settingsValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  settingsValue: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  versionNumber: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 68,
  },
  activeBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  activeText: {
    color: Colors.success,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: Spacing.lg,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  logoutText: {
    fontSize: FontSizes.md,
    color: Colors.white,
    fontWeight: '600',
  },
  footerSpace: {
    height: Spacing.xxl,
  },
});
