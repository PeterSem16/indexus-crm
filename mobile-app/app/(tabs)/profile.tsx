import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { Colors, Spacing, FontSizes } from '@/constants/colors';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '@/constants/config';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  sk: 'Slovenčina',
  cs: 'Čeština',
  hu: 'Magyar',
  de: 'Deutsch',
  it: 'Italiano',
  ro: 'Română',
  en: 'English',
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { translations, language } = useTranslation();
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const { lastSyncAt, pendingCount } = useSyncStore();

  const handleLogout = () => {
    Alert.alert(
      translations.auth.logout,
      'Are you sure you want to logout?',
      [
        { text: translations.common.cancel, style: 'cancel' },
        { text: translations.auth.logout, style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleLanguageChange = () => {
    const currentIndex = SUPPORTED_LANGUAGES.indexOf(language);
    const nextIndex = (currentIndex + 1) % SUPPORTED_LANGUAGES.length;
    setLanguage(SUPPORTED_LANGUAGES[nextIndex]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{translations.profile.title}</Text>
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.firstName} {user?.lastName}</Text>
          <Text style={styles.userCountry}>{user?.countryCode}</Text>
        </Card>

        <Text style={styles.sectionTitle}>{translations.profile.settings}</Text>

        <Card style={styles.settingsCard}>
          <TouchableOpacity 
            style={styles.settingsItem} 
            onPress={handleLanguageChange}
            testID="button-change-language"
          >
            <View style={styles.settingsLeft}>
              <Ionicons name="language" size={22} color={Colors.primary} />
              <Text style={styles.settingsLabel}>{translations.profile.language}</Text>
            </View>
            <View style={styles.settingsRight}>
              <Text style={styles.settingsValue}>{LANGUAGE_LABELS[language]}</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingsItem}>
            <View style={styles.settingsLeft}>
              <Ionicons name="notifications" size={22} color={Colors.primary} />
              <Text style={styles.settingsLabel}>{translations.profile.notifications}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </Card>

        <Text style={styles.sectionTitle}>Sync Status</Text>

        <Card style={styles.syncCard}>
          <View style={styles.syncItem}>
            <Text style={styles.syncLabel}>Last Sync</Text>
            <Text style={styles.syncValue}>
              {lastSyncAt ? lastSyncAt.toLocaleTimeString() : 'Never'}
            </Text>
          </View>
          <View style={styles.syncItem}>
            <Text style={styles.syncLabel}>Pending</Text>
            <Text style={styles.syncValue}>{pendingCount} items</Text>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>{translations.profile.about}</Text>

        <Card style={styles.settingsCard}>
          <View style={styles.settingsItem}>
            <View style={styles.settingsLeft}>
              <Ionicons name="information-circle" size={22} color={Colors.primary} />
              <Text style={styles.settingsLabel}>{translations.profile.version}</Text>
            </View>
            <Text style={styles.settingsValue}>1.0.0</Text>
          </View>
        </Card>

        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          testID="button-logout"
        >
          <Ionicons name="log-out" size={22} color={Colors.error} />
          <Text style={styles.logoutText}>{translations.auth.logout}</Text>
        </TouchableOpacity>
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
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  profileCard: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    color: Colors.white,
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  userCountry: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsLabel: {
    fontSize: FontSizes.md,
    color: Colors.text,
    marginLeft: Spacing.md,
  },
  settingsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsValue: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  syncCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  syncItem: {
    alignItems: 'center',
  },
  syncLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  syncValue: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxl,
  },
  logoutText: {
    fontSize: FontSizes.md,
    color: Colors.error,
    marginLeft: Spacing.sm,
    fontWeight: '600',
  },
});
