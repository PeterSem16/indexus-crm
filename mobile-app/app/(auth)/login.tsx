import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/stores/settingsStore';
import { Colors, Spacing, FontSizes } from '@/constants/colors';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '@/constants/config';

const APP_VERSION = Constants.expoConfig?.version || '1.1.0';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, isLoading, error, clearError } = useAuth();
  const { translations, language } = useTranslation();
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  const handleLogin = async () => {
    if (!username || !password) return;
    clearError();
    await login(username, password);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark, '#2A0515']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />
      <View style={styles.decorativeCircle3} />
      
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <View style={styles.logoOuter}>
                <View style={styles.logoInner}>
                  <Ionicons name="heart" size={40} color={Colors.white} />
                </View>
              </View>
              <View style={styles.logoPulse} />
            </View>
            
            <Text style={styles.brandName}>{translations.common.brandName}</Text>
            <Text style={styles.appName}>{translations.common.appName}</Text>
            <Text style={styles.tagline}>{translations.auth.appDescription}</Text>
            
            <View style={styles.featuresRow}>
              <View style={styles.featureItem}>
                <Ionicons name="location" size={16} color="rgba(255,255,255,0.7)" />
              </View>
              <View style={styles.featureDot} />
              <View style={styles.featureItem}>
                <Ionicons name="mic" size={16} color="rgba(255,255,255,0.7)" />
              </View>
              <View style={styles.featureDot} />
              <View style={styles.featureItem}>
                <Ionicons name="cloud-offline" size={16} color="rgba(255,255,255,0.7)" />
              </View>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.welcomeText}>{translations.auth.welcome}</Text>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                <Input
                  placeholder={translations.auth.username}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  testID="input-username"
                />
              </View>

              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                <Input
                  placeholder={translations.auth.password}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={styles.input}
                  testID="input-password"
                />
                <TouchableOpacity
                  style={styles.showPasswordButton}
                  onPress={() => setShowPassword(!showPassword)}
                  testID="button-toggle-password"
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.loginButton,
                (!username || !password || isLoading) && styles.loginButtonDisabled
              ]}
              onPress={handleLogin}
              disabled={!username || !password || isLoading}
              testID="button-login"
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                style={styles.loginButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <Text style={styles.loginButtonText}>{translations.auth.signingIn}</Text>
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>{translations.auth.signIn}</Text>
                    <Ionicons name="arrow-forward" size={20} color={Colors.white} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.languageSection}>
            <Text style={styles.languageLabel}>{translations.profile.language}</Text>
            <View style={styles.languageButtons}>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.languageButton,
                    language === lang && styles.languageButtonActive,
                  ]}
                  onPress={() => setLanguage(lang)}
                  testID={`button-language-${lang}`}
                >
                  <Text style={[
                    styles.languageCode,
                    language === lang && styles.languageCodeActive,
                  ]}>{translations.languageCodes[lang]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.versionText}>{translations.common.versionPrefix}{APP_VERSION}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.03)',
    top: -100,
    right: -100,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.02)',
    bottom: 100,
    left: -80,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.04)',
    top: height * 0.4,
    right: -60,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: height * 0.08,
    paddingBottom: Spacing.xl,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  logoOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPulse: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    top: -10,
    left: -10,
  },
  brandName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: 4,
  },
  appName: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 8,
    marginTop: -4,
  },
  tagline: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.6)',
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  featuresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: Spacing.md,
  },
  formCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  welcomeText: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  inputContainer: {
    gap: Spacing.md,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: Spacing.md,
    top: 14,
    zIndex: 1,
  },
  input: {
    paddingLeft: 44,
  },
  showPasswordButton: {
    position: 'absolute',
    right: Spacing.md,
    top: 14,
    padding: Spacing.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 8,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSizes.sm,
  },
  loginButton: {
    marginTop: Spacing.xl,
    borderRadius: 12,
    overflow: 'hidden',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  loginButtonText: {
    color: Colors.white,
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  languageSection: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  languageLabel: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: Spacing.sm,
  },
  languageButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  languageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  languageCode: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  languageCodeActive: {
    color: Colors.white,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
  },
  versionText: {
    fontSize: FontSizes.xs,
    color: 'rgba(255,255,255,0.3)',
  },
});
